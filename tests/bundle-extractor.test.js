import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { extractBundle, saveBundleOutput } from "../lib/bundle-extractor.js";
import { validateBundleSchema, validateRawPageSchema } from "../lib/schemas.js";

function fakeSpinner() {
  return { text: "", start() {}, stop() {}, warn() {} };
}

test("extractBundle returns bundle contract", async () => {
  const originalFetch = global.fetch;

  global.fetch = async (url) => ({
    async text() {
      if (String(url).endsWith("/")) {
        return `<a href="/pricing">Pricing</a><a href="/docs">Docs</a>`;
      }
      return "";
    },
  });

  const fakeExtractBranding = async (url) => ({
    url,
    extractedAt: "2026-02-16T00:00:00.000Z",
    logo: null,
    favicons: [],
    colors: { semantic: { primary: "#112233" }, palette: [{ color: "#112233", confidence: "high", count: 3 }], cssVariables: {} },
    typography: { styles: [], sources: { googleFonts: [] } },
    spacing: { scaleType: "8pt", commonValues: [] },
    borderRadius: { values: [] },
    borders: { combinations: [] },
    shadows: [],
    components: { buttons: [], inputs: { text: [], checkbox: [], radio: [], select: [] }, links: [], badges: { all: [], byVariant: {} } },
    breakpoints: [],
    iconSystem: [],
    frameworks: [],
    layoutSemantics: { sections: [{ type: "hero", count: 1, confidence: "high" }], gridEvidence: 3 },
    motion: { durations: ["200ms"], easings: ["ease"], properties: ["transform"], keyframes: [], recipes: [{ name: "hover-lift" }] },
    media: { items: [{ type: "video", autoplay: true }] },
  });

  const bundle = await extractBundle({
    url: "https://acme.com/",
    spinner: fakeSpinner(),
    browser: {},
    extractBranding: fakeExtractBranding,
    limits: { maxPages: 2, maxDepth: 2, maxTimeMs: 5000, maxAssetBytes: 100000, concurrency: 1 },
    fingerprint: { jobId: "job-1" },
    options: { includeMotion: true, includeLayoutMap: true },
  });

  assert.equal(validateBundleSchema(bundle), true);
  assert.equal(validateRawPageSchema(bundle.rawPages[0]), true);
  assert.equal(bundle.layout.sections[0].type, "hero");
  assert.equal(bundle.motion.recipes[0].name, "hover-lift");
  assert.equal(bundle.assets.media[0].type, "video");

  global.fetch = originalFetch;
});

test("saveBundleOutput writes all bundle files", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "dembrandt-test-"));

  const bundle = {
    schemaVersion: "1.0.0",
    rawPages: [
      {
        url: "https://acme.com/",
        finalUrl: "https://acme.com/",
        extraction: {},
        metrics: {},
      },
    ],
    tokensLight: {},
    tokensDark: {},
    components: {},
    layout: {},
    motion: {},
    summary: {},
    assets: { references: [], downloads: [] },
    dtcg: {},
    report: {},
  };

  const { outputDir } = await saveBundleOutput({
    bundle,
    targetUrl: "https://acme.com/",
    outputRoot: tempDir,
    downloadAssets: false,
  });

  assert.equal(existsSync(join(outputDir, "tokens.light.json")), true);
  assert.equal(existsSync(join(outputDir, "tokens.dark.json")), true);
  assert.equal(existsSync(join(outputDir, "components.json")), true);
  assert.equal(existsSync(join(outputDir, "layout.json")), true);
  assert.equal(existsSync(join(outputDir, "motion.json")), true);
  assert.equal(existsSync(join(outputDir, "assets.json")), true);
  assert.equal(existsSync(join(outputDir, "summary.json")), true);
  assert.equal(existsSync(join(outputDir, "report.json")), true);
  assert.equal(existsSync(join(outputDir, "dtcg.tokens.json")), true);

  rmSync(tempDir, { recursive: true, force: true });
});

test("saveBundleOutput enforces allowlist in asset downloads", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "dembrandt-test-"));
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    headers: { get: () => "image/png" },
    async arrayBuffer() {
      return new Uint8Array([1, 2, 3]).buffer;
    },
  });

  const bundle = {
    schemaVersion: "1.0.0",
    rawPages: [],
    tokensLight: {},
    tokensDark: {},
    components: {},
    layout: {},
    motion: {},
    summary: {},
    assets: {
      references: [
        { type: "logo", url: "https://allowed.com/logo.png" },
        { type: "logo", url: "https://blocked.com/logo.png" },
      ],
      downloads: [],
    },
    dtcg: {},
    report: {},
  };

  await saveBundleOutput({
    bundle,
    targetUrl: "https://acme.com/",
    outputRoot: tempDir,
    downloadAssets: true,
    allowlistHosts: ["allowed.com"],
  });

  assert.equal(bundle.assets.downloads.some((d) => d.reason === "host-not-allowlisted"), true);

  global.fetch = originalFetch;
  rmSync(tempDir, { recursive: true, force: true });
});
