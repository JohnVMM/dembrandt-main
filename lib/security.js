import { lookup } from "dns/promises";
import { randomUUID } from "crypto";

const PRIVATE_IPV4_RANGES = [
  [/^10\./],
  [/^127\./],
  [/^169\.254\./],
  [/^172\.(1[6-9]|2\d|3[0-1])\./],
  [/^192\.168\./],
  [/^0\./],
];

const PRIVATE_IPV6_PATTERNS = [
  /^::1$/i,
  /^fc/i,
  /^fd/i,
  /^fe80:/i,
];

const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata",
  "metadata.google.internal",
  "169.254.169.254",
  "100.100.100.200",
]);

function isPrivateIpv4(ip) {
  return PRIVATE_IPV4_RANGES.some(([pattern]) => pattern.test(ip));
}

function isPrivateIpv6(ip) {
  return PRIVATE_IPV6_PATTERNS.some((pattern) => pattern.test(ip));
}

export function isPrivateOrLocalIp(ip) {
  if (!ip || typeof ip !== "string") return false;
  if (ip.includes(".")) return isPrivateIpv4(ip);
  if (ip.includes(":")) return isPrivateIpv6(ip);
  return false;
}

export function normalizeInputUrl(input) {
  if (!input || typeof input !== "string") {
    throw new Error("URL is required");
  }

  let value = input.trim();
  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value}`;
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Invalid URL format");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http/https URLs are supported");
  }

  parsed.hash = "";
  return parsed.toString();
}

async function resolveAllIps(hostname) {
  try {
    const records = await lookup(hostname, { all: true, verbatim: true });
    return records.map((r) => r.address);
  } catch {
    return [];
  }
}

export async function validateUrlSecurity(url, { strictSecurity = false } = {}) {
  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();

  if (BLOCKED_HOSTS.has(hostname)) {
    throw new Error(`Blocked hostname: ${hostname}`);
  }

  if (isPrivateOrLocalIp(hostname)) {
    throw new Error(`Blocked IP hostname: ${hostname}`);
  }

  if (strictSecurity) {
    const ips = await resolveAllIps(hostname);
    if (ips.some((ip) => isPrivateOrLocalIp(ip))) {
      throw new Error(`Blocked private resolved IP for host: ${hostname}`);
    }
  }

  return { hostname, protocol: parsed.protocol };
}

export async function validateAndNormalizeUrl(input, options = {}) {
  const normalizedUrl = normalizeInputUrl(input);
  const security = await validateUrlSecurity(normalizedUrl, options);
  return {
    normalizedUrl,
    ...security,
  };
}

export function createJobFingerprint({ url, viewport, browser, mode, flags }) {
  return {
    jobId: randomUUID(),
    timestamp: new Date().toISOString(),
    url,
    viewport,
    browser,
    mode,
    flags,
  };
}

export function buildExecutionLimits(opts = {}) {
  return {
    maxPages: Number(opts.maxPages) || 12,
    maxDepth: Number(opts.maxDepth) || 3,
    maxTimeMs: Number(opts.maxTimeMs) || 180000,
    maxAssetBytes: Number(opts.maxAssetBytes) || 8 * 1024 * 1024,
    concurrency: Number(opts.concurrency) || 3,
  };
}
