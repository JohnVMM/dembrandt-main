#!/usr/bin/env node

/**
 * Dembrandt - Design Token Extraction CLI
 */

import { program } from "commander";
import chalk from "chalk";
import ora from "ora";
import { chromium, firefox } from "playwright-core";
import { extractBranding } from "./lib/extractors.js";
import { displayResults } from "./lib/display.js";
import { toW3CFormat } from "./lib/w3c-exporter.js";
import { writeFileSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";
import {
  validateAndNormalizeUrl,
  createJobFingerprint,
  buildExecutionLimits,
} from "./lib/security.js";
import { extractBundle, saveBundleOutput } from "./lib/bundle-extractor.js";
import { buildSummaryOutput } from "./lib/summary-exporter.js";

function ensureOutputDir(url) {
  const domain = new URL(url).hostname.replace("www.", "");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split(".")[0];
  const outputDir = join(process.cwd(), "output", domain);
  mkdirSync(outputDir, { recursive: true });
  return { outputDir, domain, timestamp };
}

function saveSingleOutput({ url, data, dtcg }) {
  const { outputDir, domain, timestamp } = ensureOutputDir(url);
  const suffix = dtcg ? ".tokens" : "";
  const filename = `${timestamp}${suffix}.json`;
  const filepath = join(outputDir, filename);
  writeFileSync(filepath, JSON.stringify(data, null, 2));
  return { domain, filename, filepath };
}

function saveSingleReport({ url, fingerprint, limits }) {
  const { outputDir } = ensureOutputDir(url);
  const filepath = join(outputDir, "report.json");
  const report = {
    schemaVersion: "1.0.0",
    mode: "single",
    fingerprint,
    limits,
    generatedAt: new Date().toISOString(),
  };
  writeFileSync(filepath, JSON.stringify(report, null, 2));
}

function saveSingleSummary({ url, result }) {
  const { outputDir } = ensureOutputDir(url);
  const filepath = join(outputDir, "summary.json");
  writeFileSync(filepath, JSON.stringify(buildSummaryOutput(result), null, 2));
}

function loadAllowlistHosts(filePath) {
  if (!filePath) return [];
  const content = readFileSync(filePath, "utf-8");
  return content
    .split(/\r?\n/)
    .map((line) => line.trim().toLowerCase())
    .filter((line) => line && !line.startsWith("#"));
}

program
  .name("dembrandt")
  .description("Extract design tokens from any website")
  .version("0.6.1")
  .argument("<url>")
  .option("--browser <type>", "Browser to use (chromium|firefox)", "chromium")
  .option("--json-only", "Output raw JSON")
  .option("--save-output", "Save JSON file to output folder")
  .option("--output-bundle", "Save full bundle output (raw/tokens/components/layout/motion/report)")
  .option("--dtcg", "Export in W3C Design Tokens (DTCG) format")
  .option("--dark-mode", "Extract colors from dark mode")
  .option("--mobile", "Extract from mobile viewport")
  .option("--slow", "3x longer timeouts for slow-loading sites")
  .option("--no-sandbox", "Disable browser sandbox (needed for Docker/CI)")
  .option("--max-pages <n>", "Maximum representative pages for crawl", "12")
  .option("--max-depth <n>", "Maximum crawl depth", "3")
  .option("--max-time-ms <n>", "Global extraction time budget in milliseconds", "180000")
  .option("--max-asset-bytes <n>", "Maximum bytes per downloaded asset", `${8 * 1024 * 1024}`)
  .option("--concurrency <n>", "Extraction concurrency", "3")
  .option("--assets-mode <mode>", "Asset policy: all|refs-only|allowlist", "all")
  .option("--assets-allowlist <file>", "Path to allowlist file for asset downloads")
  .option("--crawl-seed <mode>", "Crawl seed mode: auto|sitemap|manual", "auto")
  .option("--strict-security", "Enable strict SSRF/DNS checks")
  .option("--include-motion", "Include motion recipes in bundle output")
  .option("--include-layout-map", "Include layout map in bundle output")
  .action(async (input, opts) => {
    const spinner = ora("Starting extraction...").start();
    let browser = null;

    try {
      const { normalizedUrl } = await validateAndNormalizeUrl(input, {
        strictSecurity: Boolean(opts.strictSecurity),
      });
      const limits = buildExecutionLimits(opts);

      const fingerprint = createJobFingerprint({
        url: normalizedUrl,
        viewport: opts.mobile ? "390x844" : "1920x1080",
        browser: opts.browser,
        mode: opts.outputBundle ? "bundle" : "single",
        flags: {
          darkMode: Boolean(opts.darkMode),
          mobile: Boolean(opts.mobile),
          slow: Boolean(opts.slow),
          dtcg: Boolean(opts.dtcg),
          includeMotion: Boolean(opts.includeMotion),
          includeLayoutMap: Boolean(opts.includeLayoutMap),
          assetsMode: opts.assetsMode,
          crawlSeed: opts.crawlSeed,
        },
      });

      let useHeaded = false;
      let singleResult;
      let bundleResult;

      while (true) {
        const browserType = opts.browser === "firefox" ? firefox : chromium;
        spinner.text = `Launching browser (${useHeaded ? "visible" : "headless"} mode)`;

        const launchArgs = opts.browser === "firefox"
          ? []
          : ["--disable-blink-features=AutomationControlled"];

        if (opts.noSandbox && opts.browser === "chromium") {
          launchArgs.push("--no-sandbox", "--disable-setuid-sandbox");
        }

        browser = await browserType.launch({
          headless: !useHeaded,
          args: launchArgs,
        });

        try {
          if (opts.outputBundle) {
            bundleResult = await extractBundle({
              url: normalizedUrl,
              spinner,
              browser,
              extractBranding,
              limits,
              fingerprint,
              options: {
                navigationTimeout: Math.min(90000, limits.maxTimeMs),
                darkMode: opts.darkMode,
                mobile: opts.mobile,
                slow: opts.slow,
                includeMotion: Boolean(opts.includeMotion),
                includeLayoutMap: Boolean(opts.includeLayoutMap),
              },
            });
          } else {
            singleResult = await extractBranding(normalizedUrl, spinner, browser, {
              navigationTimeout: Math.min(90000, limits.maxTimeMs),
              darkMode: opts.darkMode,
              mobile: opts.mobile,
              slow: opts.slow,
            });
          }

          break;
        } catch (err) {
          await browser.close();
          browser = null;

          if (useHeaded) throw err;

          if (err.message.includes("Timeout") || err.message.includes("net::ERR_")) {
            spinner.warn("Bot detection detected - retrying with visible browser");
            console.error(chalk.dim(`  -> Error: ${err.message}`));
            console.error(chalk.dim(`  -> URL: ${normalizedUrl}`));
            console.error(chalk.dim(`  -> Mode: headless`));
            useHeaded = true;
            continue;
          }

          throw err;
        }
      }

      console.log();

      if (opts.outputBundle && bundleResult) {
        const allowlistHosts = opts.assetsMode === "allowlist"
          ? loadAllowlistHosts(opts.assetsAllowlist)
          : [];
        const shouldDownloadAssets = opts.assetsMode === "all" || opts.assetsMode === "allowlist";
        const { outputDir } = await saveBundleOutput({
          bundle: bundleResult,
          targetUrl: normalizedUrl,
          outputRoot: process.cwd(),
          downloadAssets: shouldDownloadAssets,
          maxAssetBytes: limits.maxAssetBytes,
          allowlistHosts,
        });

        if (opts.jsonOnly) {
          console.log(JSON.stringify(bundleResult, null, 2));
        } else {
          displayResults(bundleResult.tokensLight);
          console.log(chalk.dim(`Bundle saved to: ${chalk.hex("#8BE9FD")(outputDir)}`));
        }

        return;
      }

      const outputData = opts.dtcg ? toW3CFormat(singleResult) : singleResult;

      if (opts.saveOutput || opts.dtcg) {
        const { domain, filename } = saveSingleOutput({
          url: normalizedUrl,
          data: outputData,
          dtcg: opts.dtcg,
        });
        saveSingleReport({
          url: normalizedUrl,
          fingerprint,
          limits,
        });
        saveSingleSummary({
          url: normalizedUrl,
          result: singleResult,
        });

        console.log(chalk.dim(`JSON saved to: ${chalk.hex("#8BE9FD")(`output/${domain}/${filename}`)}`));
      }

      if (opts.jsonOnly) {
        console.log(JSON.stringify(outputData, null, 2));
      } else {
        console.log();
        displayResults(singleResult);
      }
    } catch (err) {
      spinner.fail("Failed");
      console.error(chalk.red("\nExtraction failed"));
      console.error(chalk.red(`  Error: ${err.message}`));
      process.exit(1);
    } finally {
      if (browser) await browser.close();
    }
  });

program.parse();
