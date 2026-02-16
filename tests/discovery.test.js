import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyLinkIntent,
  extractInternalLinksFromHtml,
  pickRepresentativePages,
  discoverRepresentativePages,
} from "../lib/discovery.js";

test("classifyLinkIntent ranks known paths", () => {
  assert.equal(classifyLinkIntent("https://acme.com/pricing").intent, "pricing");
  assert.equal(classifyLinkIntent("https://acme.com/docs/api").intent, "docs");
  assert.equal(classifyLinkIntent("https://acme.com/").intent, "home");
});

test("extractInternalLinksFromHtml keeps only internal links", () => {
  const html = `
    <a href="/pricing">Pricing</a>
    <a href="https://acme.com/docs">Docs</a>
    <a href="https://other.com/blog">Offsite</a>
    <a href="mailto:hello@acme.com">Mail</a>
  `;

  const links = extractInternalLinksFromHtml(html, "https://acme.com");
  assert.deepEqual(links.sort(), ["https://acme.com/docs", "https://acme.com/pricing"]);
});

test("pickRepresentativePages deduplicates and limits pages", () => {
  const selected = pickRepresentativePages(
    [
      "https://acme.com/",
      "https://acme.com/pricing",
      "https://acme.com/pricing",
      "https://acme.com/docs",
      "https://acme.com/features",
      "https://acme.com/blog",
    ],
    { maxPages: 4 }
  );

  assert.equal(selected.length, 4);
  assert.equal(new Set(selected).size, 4);
});

test("discoverRepresentativePages crawls by depth budget", async () => {
  const pages = new Map([
    ["https://acme.com/", `<a href="/pricing">Pricing</a><a href="/docs">Docs</a>`],
    ["https://acme.com/pricing", `<a href="/features">Features</a>`],
    ["https://acme.com/docs", `<a href="/blog">Blog</a>`],
    ["https://acme.com/features", ``],
    ["https://acme.com/blog", ``],
  ]);

  const fetchImpl = async (url) => ({
    async text() {
      return pages.get(url) || "";
    },
  });

  const result = await discoverRepresentativePages({
    startUrl: "https://acme.com/",
    fetchImpl,
    maxPages: 3,
    maxDepth: 2,
    maxTimeMs: 5000,
  });

  assert.equal(result.selected.length, 3);
  assert.ok(result.discovered.includes("https://acme.com/pricing"));
});
