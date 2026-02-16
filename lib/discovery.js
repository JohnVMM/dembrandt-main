function normalizeCandidateUrl(baseUrl, href) {
  if (!href) return null;
  if (href.startsWith("javascript:") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return null;
  }

  try {
    const abs = new URL(href, baseUrl);
    abs.hash = "";
    return abs.toString();
  } catch {
    return null;
  }
}

const ASSET_EXTENSIONS = [
  ".css",
  ".js",
  ".mjs",
  ".json",
  ".xml",
  ".txt",
  ".map",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
  ".avif",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
  ".mp4",
  ".webm",
  ".mov",
  ".mp3",
  ".wav",
  ".pdf",
  ".zip",
];

function hasAssetExtension(pathname) {
  const lower = pathname.toLowerCase();
  return ASSET_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function isLikelyDocumentUrl(url) {
  try {
    const parsed = new URL(url);
    const pathname = (parsed.pathname || "/").toLowerCase();
    const normalizedPath = pathname.replace(/\/+$/, "") || "/";

    if (
      pathname.includes("/_nuxt/") ||
      pathname.includes("/_next/") ||
      pathname.includes("/static/") ||
      pathname.includes("/assets/") ||
      pathname.includes("/build/") ||
      pathname.includes("/favicon/") ||
      pathname.includes("/api/")
    ) {
      return false;
    }

    if (pathname.includes("${")) return false;
    if (hasAssetExtension(pathname)) return false;

    // Keep canonical HTML-like endpoints and clean path routes.
    if (
      normalizedPath === "/" ||
      normalizedPath.endsWith(".html") ||
      normalizedPath.endsWith(".htm") ||
      normalizedPath.endsWith(".php") ||
      normalizedPath.endsWith(".asp") ||
      normalizedPath.endsWith(".aspx")
    ) {
      return true;
    }

    // If the last path segment has a dot, treat it as file-like and skip.
    const lastSegment = normalizedPath.split("/").filter(Boolean).pop() || "";
    if (lastSegment.includes(".")) return false;

    return true;
  } catch {
    return false;
  }
}

function isHtmlResponse(response) {
  const contentType = (response?.headers?.get?.("content-type") || "").toLowerCase();
  if (!contentType) return true;
  return contentType.includes("text/html") || contentType.includes("application/xhtml+xml");
}

export function classifyLinkIntent(url) {
  const path = url.toLowerCase();
  const rules = [
    { intent: "pricing", score: /pricing|plan|subscription|quote/.test(path) ? 5 : 0 },
    { intent: "features", score: /feature|product|solutions|platform/.test(path) ? 4 : 0 },
    { intent: "docs", score: /docs|documentation|api|developer/.test(path) ? 4 : 0 },
    { intent: "login", score: /login|signin|auth|account/.test(path) ? 3 : 0 },
    { intent: "blog", score: /blog|news|article|insights/.test(path) ? 3 : 0 },
    { intent: "home", score: /\/$/.test(path) ? 2 : 0 },
  ];

  const best = rules.sort((a, b) => b.score - a.score)[0];
  if (!best || best.score === 0) {
    return { intent: "generic", score: 1 };
  }
  return best;
}

export function extractInternalLinksFromHtml(html, baseUrl) {
  const links = [];
  const base = new URL(baseUrl);
  const pattern = /href\s*=\s*["']([^"']+)["']/gi;

  let match;
  while ((match = pattern.exec(html))) {
    const candidate = normalizeCandidateUrl(baseUrl, match[1]);
    if (!candidate) continue;

    const candidateUrl = new URL(candidate);
    if (candidateUrl.hostname !== base.hostname) continue;

    if (isLikelyDocumentUrl(candidate)) {
      links.push(candidate);
    }
  }

  return links;
}

export function pickRepresentativePages(urls, { maxPages = 12 } = {}) {
  const deduped = Array.from(new Set(urls));
  const ranked = deduped
    .map((url) => ({
      url,
      ...classifyLinkIntent(url),
      depth: new URL(url).pathname.split("/").filter(Boolean).length,
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.depth - b.depth;
    });

  const picked = [];
  const seenIntent = new Set();

  for (const entry of ranked) {
    if (picked.length >= maxPages) break;
    if (!seenIntent.has(entry.intent) || entry.intent === "generic") {
      picked.push(entry.url);
      seenIntent.add(entry.intent);
    }
  }

  for (const entry of ranked) {
    if (picked.length >= maxPages) break;
    if (!picked.includes(entry.url)) {
      picked.push(entry.url);
    }
  }

  return picked;
}

export async function discoverRepresentativePages({
  startUrl,
  fetchImpl = fetch,
  maxPages = 12,
  maxDepth = 3,
  maxTimeMs = 180000,
}) {
  const startedAt = Date.now();
  const queue = [{ url: startUrl, depth: 0 }];
  const visited = new Set();
  const found = new Set([startUrl]);

  while (queue.length > 0 && visited.size < maxPages * 4) {
    if (Date.now() - startedAt > maxTimeMs) break;

    const { url, depth } = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);

    if (depth > maxDepth) continue;

    try {
      const response = await fetchImpl(url, { redirect: "follow" });
      if (!isHtmlResponse(response)) continue;
      const html = await response.text();
      const links = extractInternalLinksFromHtml(html, url);

      for (const link of links) {
        if (!found.has(link)) {
          found.add(link);
        }
        if (!visited.has(link) && depth + 1 <= maxDepth) {
          queue.push({ url: link, depth: depth + 1 });
        }
      }
    } catch {
      // Keep discovery resilient even when some pages fail.
    }
  }

  const selected = pickRepresentativePages(Array.from(found), { maxPages });
  return {
    discovered: Array.from(found),
    selected,
    visited: Array.from(visited),
  };
}
