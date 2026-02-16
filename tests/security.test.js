import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeInputUrl,
  isPrivateOrLocalIp,
  validateAndNormalizeUrl,
  buildExecutionLimits,
} from "../lib/security.js";

test("normalizeInputUrl adds https scheme", () => {
  const url = normalizeInputUrl("example.com/path");
  assert.equal(url, "https://example.com/path");
});

test("normalizeInputUrl rejects invalid protocol", () => {
  assert.throws(() => normalizeInputUrl("ftp://example.com"), /Only http\/https/);
});

test("isPrivateOrLocalIp detects private networks", () => {
  assert.equal(isPrivateOrLocalIp("127.0.0.1"), true);
  assert.equal(isPrivateOrLocalIp("192.168.1.1"), true);
  assert.equal(isPrivateOrLocalIp("8.8.8.8"), false);
  assert.equal(isPrivateOrLocalIp("::1"), true);
});

test("validateAndNormalizeUrl blocks localhost hostnames", async () => {
  await assert.rejects(
    () => validateAndNormalizeUrl("http://localhost:3000"),
    /Blocked hostname/
  );
});

test("buildExecutionLimits has robust defaults", () => {
  const limits = buildExecutionLimits({});
  assert.equal(limits.maxPages, 12);
  assert.equal(limits.maxDepth, 3);
  assert.equal(limits.maxTimeMs, 180000);
  assert.equal(limits.maxAssetBytes, 8 * 1024 * 1024);
  assert.equal(limits.concurrency, 3);
});
