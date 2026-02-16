import { createHash } from "crypto";
import { mkdirSync, writeFileSync } from "fs";
import { readFile } from "fs/promises";
import { join } from "path";
import { toW3CFormat } from "./w3c-exporter.js";
import { discoverRepresentativePages } from "./discovery.js";
import { validateBundleSchema, validateRawPageSchema } from "./schemas.js";
import { buildSummaryOutput } from "./summary-exporter.js";

function slugifyUrl(url) {
  const parsed = new URL(url);
  const path = parsed.pathname.replace(/\/+$/g, "") || "/";
  const normalized = `${parsed.hostname}${path}`.replace(/[^a-z0-9]+/gi, "-");
  return normalized.replace(/^-+|-+$/g, "").toLowerCase() || "home";
}

export async function downloadAssetWithLimits(assetUrl, outputPath, maxAssetBytes) {
  const response = await fetch(assetUrl, { redirect: "follow" });
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length > maxAssetBytes) {
    throw new Error(`Asset exceeds max bytes: ${assetUrl}`);
  }

  writeFileSync(outputPath, buffer);
  const hash = createHash("sha256").update(buffer).digest("hex");
  return {
    bytes: buffer.length,
    hash,
    contentType: response.headers.get("content-type") || "application/octet-stream",
  };
}

function normalizeComponents(components = {}) {
  return {
    buttons: components.buttons || [],
    inputs: components.inputs || { text: [], checkbox: [], radio: [], select: [] },
    links: components.links || [],
    badges: components.badges || { all: [], byVariant: {} },
  };
}

function extractLayoutFromResult(result) {
  if (result.layoutSemantics && result.layoutSemantics.sections) {
    return {
      sections: result.layoutSemantics.sections,
      grid: {
        breakpoints: result.breakpoints || [],
        containerWidths: [],
        gaps: (result.spacing?.commonValues || []).slice(0, 8),
      },
      evidence: {
        gridEvidence: result.layoutSemantics.gridEvidence || 0,
      },
    };
  }

  const sectionMap = [];
  if (result.logo) sectionMap.push({ type: "header", confidence: "medium" });
  if (result.components?.buttons?.length) sectionMap.push({ type: "cta", confidence: "high" });
  if (result.breakpoints?.length) sectionMap.push({ type: "responsive", confidence: "medium" });
  return {
    sections: sectionMap,
    grid: {
      breakpoints: result.breakpoints || [],
      containerWidths: [],
      gaps: (result.spacing?.commonValues || []).slice(0, 8),
    },
  };
}

function extractMotionFromResult(result) {
  if (result.motion) {
    return result.motion;
  }

  const hasHover = (result.components?.buttons || []).some((btn) => Boolean(btn.states?.hover));
  return {
    durations: hasHover ? ["150ms", "200ms"] : [],
    easings: hasHover ? ["ease", "ease-in-out"] : [],
    recipes: hasHover
      ? [
        {
          name: "hover-lift",
          trigger: "hover",
          properties: ["transform", "box-shadow"],
        },
      ]
      : [],
  };
}

function extractAssetsFromResult(result) {
  const refs = [];
  if (result.logo?.url) refs.push({ type: "logo", url: result.logo.url });
  (result.favicons || []).forEach((f) => refs.push({ type: "favicon", url: f.url }));

  const googleFonts = result.typography?.sources?.googleFonts || [];
  googleFonts.forEach((font) => refs.push({ type: "font-family", name: font }));

  return {
    references: refs,
    downloads: [],
    media: result.media?.items || [],
  };
}

function buildReport({ fingerprint, pages, failures, timings, limits, discovery }) {
  return {
    schemaVersion: "1.0.0",
    fingerprint,
    limits,
    discovery,
    coverage: {
      pagesAttempted: pages.length,
      pagesSucceeded: pages.filter((p) => p.success).length,
      pagesFailed: failures.length,
    },
    timings,
    failures,
  };
}

export async function extractBundle({
  url,
  spinner,
  browser,
  extractBranding,
  limits,
  fingerprint,
  options,
}) {
  const startedAt = Date.now();
  const failures = [];
  const perPage = [];

  spinner.text = "Discovering representative pages...";
  const discovery = await discoverRepresentativePages({
    startUrl: url,
    maxPages: limits.maxPages,
    maxDepth: limits.maxDepth,
    maxTimeMs: limits.maxTimeMs,
  });

  const selectedPages = discovery.selected.slice(0, limits.maxPages);

  let cursor = 0;
  const workerCount = Math.max(1, limits.concurrency || 1);

  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= selectedPages.length) return;

      const pageUrl = selectedPages[index];
      if (Date.now() - startedAt > limits.maxTimeMs) {
        failures.push({ url: pageUrl, stage: "budget", error: "Global max time exceeded" });
        continue;
      }

      const pageStart = Date.now();
      try {
        const result = await extractBranding(pageUrl, spinner, browser, options);
        perPage.push({
          url: pageUrl,
          finalUrl: result.url,
          success: true,
          extraction: result,
          metrics: {
            durationMs: Date.now() - pageStart,
            colorCount: result.colors?.palette?.length || 0,
            typographyCount: result.typography?.styles?.length || 0,
          },
        });
      } catch (error) {
        failures.push({
          url: pageUrl,
          stage: "extract",
          error: error.message,
        });
        perPage.push({
          url: pageUrl,
          finalUrl: pageUrl,
          success: false,
          extraction: null,
          metrics: {
            durationMs: Date.now() - pageStart,
          },
        });
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  const firstSuccess = perPage.find((p) => p.success)?.extraction;
  const baseResult = firstSuccess || {
    url,
    extractedAt: new Date().toISOString(),
    colors: { semantic: {}, palette: [], cssVariables: {} },
    typography: { styles: [], sources: {} },
    spacing: { scaleType: "unknown", commonValues: [] },
    borderRadius: { values: [] },
    borders: { combinations: [] },
    shadows: [],
    components: normalizeComponents(),
    breakpoints: [],
    iconSystem: [],
    frameworks: [],
  };

  const tokensLight = {
    ...baseResult,
    schemaVersion: "1.0.0",
  };

  const tokensDark = {
    ...baseResult,
    theme: "dark",
  };

  const bundle = {
    schemaVersion: "1.0.0",
    rawPages: perPage,
    tokensLight,
    tokensDark,
    components: normalizeComponents(baseResult.components),
    layout: options.includeLayoutMap ? extractLayoutFromResult(baseResult) : { sections: [], grid: { breakpoints: [], containerWidths: [], gaps: [] } },
    motion: options.includeMotion ? extractMotionFromResult(baseResult) : { durations: [], easings: [], recipes: [] },
    assets: extractAssetsFromResult(baseResult),
    summary: buildSummaryOutput(baseResult),
    dtcg: toW3CFormat(baseResult),
    report: buildReport({
      fingerprint,
      pages: perPage,
      failures,
      timings: {
        totalMs: Date.now() - startedAt,
      },
      limits,
      discovery,
    }),
  };

  return bundle;
}

export async function saveBundleOutput({
  bundle,
  targetUrl,
  outputRoot,
  downloadAssets = false,
  maxAssetBytes = 8 * 1024 * 1024,
  allowlistHosts = null,
}) {
  if (!validateBundleSchema(bundle)) {
    throw new Error("Invalid bundle schema");
  }

  const domain = new URL(targetUrl).hostname.replace("www.", "");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split(".")[0];
  const outputDir = join(outputRoot, "output", domain, timestamp);

  mkdirSync(outputDir, { recursive: true });
  mkdirSync(join(outputDir, "raw", "pages"), { recursive: true });

  for (const page of bundle.rawPages) {
    if (!validateRawPageSchema(page)) {
      continue;
    }
    const slug = slugifyUrl(page.url);
    writeFileSync(join(outputDir, "raw", "pages", `${slug}.raw.json`), JSON.stringify(page, null, 2));
  }

  writeFileSync(join(outputDir, "tokens.light.json"), JSON.stringify(bundle.tokensLight, null, 2));
  writeFileSync(join(outputDir, "tokens.dark.json"), JSON.stringify(bundle.tokensDark, null, 2));
  writeFileSync(join(outputDir, "components.json"), JSON.stringify(bundle.components, null, 2));
  writeFileSync(join(outputDir, "layout.json"), JSON.stringify(bundle.layout, null, 2));
  writeFileSync(join(outputDir, "motion.json"), JSON.stringify(bundle.motion, null, 2));
  writeFileSync(join(outputDir, "assets.json"), JSON.stringify(bundle.assets, null, 2));
  writeFileSync(join(outputDir, "summary.json"), JSON.stringify(bundle.summary, null, 2));
  writeFileSync(join(outputDir, "report.json"), JSON.stringify(bundle.report, null, 2));
  writeFileSync(join(outputDir, "dtcg.tokens.json"), JSON.stringify(bundle.dtcg, null, 2));

  if (downloadAssets) {
    const assetsDir = join(outputDir, "assets");
    mkdirSync(assetsDir, { recursive: true });
    const downloads = [];

    for (const ref of bundle.assets.references) {
      if (!ref.url || !/^https?:\/\//.test(ref.url)) continue;
      const host = new URL(ref.url).hostname.toLowerCase();
      if (Array.isArray(allowlistHosts) && allowlistHosts.length > 0 && !allowlistHosts.includes(host)) {
        bundle.assets.downloads.push({ ...ref, path: null, skipped: true, reason: "host-not-allowlisted" });
        continue;
      }
      const fileName = slugifyUrl(ref.url);
      const out = join(assetsDir, fileName);
      downloads.push(
        // Best effort download with audit-friendly skip behavior.
        downloadAssetWithLimits(ref.url, out, maxAssetBytes)
        .then((meta) => {
          bundle.assets.downloads.push({ ...ref, path: out, ...meta });
        })
        .catch(() => {
          bundle.assets.downloads.push({ ...ref, path: null, skipped: true });
        })
      );
    }

    await Promise.all(downloads);
    writeFileSync(join(outputDir, "assets.json"), JSON.stringify(bundle.assets, null, 2));
  }

  return { outputDir, domain, timestamp };
}

export async function readJson(filePath) {
  const content = await readFile(filePath, "utf-8");
  return JSON.parse(content);
}
