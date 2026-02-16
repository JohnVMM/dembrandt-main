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

    links.push(candidate);
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
