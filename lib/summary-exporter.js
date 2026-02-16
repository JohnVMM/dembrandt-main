function pickTopColors(colors = {}, limit = 6) {
  const semanticEntries = Object.entries(colors.semantic || {})
    .filter(([, value]) => typeof value === "string" && value)
    .map(([name, value]) => ({ name, value }));

  const paletteEntries = (colors.palette || [])
    .filter((entry) => entry && (entry.color || entry.normalized))
    .slice(0, limit)
    .map((entry, index) => ({
      name: `palette-${index + 1}`,
      value: entry.normalized || entry.color,
      confidence: entry.confidence || "unknown",
    }));

  return {
    semantic: semanticEntries,
    palette: paletteEntries,
  };
}

function pickTopBorders(borders = {}, limit = 5) {
  return (borders.combinations || [])
    .slice(0, limit)
    .map((item, index) => ({
      name: `border-${index + 1}`,
      width: item.width,
      style: item.style,
      color: item.color,
      confidence: item.confidence,
    }));
}

function pickTopPaddings(result, limit = 8) {
  const spacing = result.spacing?.commonValues || [];
  return spacing
    .slice(0, limit)
    .map((value, index) => ({
      name: `space-${index + 1}`,
      px: value.px || value,
      rem: value.rem || null,
      count: value.count || null,
    }));
}

function pickAnimationPoints(result, limit = 6) {
  const motion = result.motion || {};
  const recipes = (motion.recipes || []).slice(0, limit).map((r, i) => ({
    name: r.name || `recipe-${i + 1}`,
    trigger: r.trigger || "unknown",
    properties: r.properties || [],
  }));

  return {
    durations: (motion.durations || []).slice(0, limit),
    easings: (motion.easings || []).slice(0, limit),
    recipes,
  };
}

export function createSimpleSummary(result) {
  const colors = pickTopColors(result.colors || {});
  const borders = pickTopBorders(result.borders || {});
  const paddings = pickTopPaddings(result);
  const animation = pickAnimationPoints(result);

  return {
    title: "Design Summary",
    source: result.url,
    extractedAt: result.extractedAt,
    highlights: {
      animation: {
        mainDurations: animation.durations,
        mainEasings: animation.easings,
        mainRecipes: animation.recipes.map((r) => `${r.name} (${r.trigger})`),
      },
      palette: {
        semantic: colors.semantic,
        topPalette: colors.palette,
      },
      borders: borders.map((b) => `${b.width} ${b.style} ${b.color}`),
      paddings: paddings.map((p) => p.px),
    },
  };
}

export function createSummaryTokens(result) {
  const colors = pickTopColors(result.colors || {});
  const borders = pickTopBorders(result.borders || {});
  const paddings = pickTopPaddings(result);
  const animation = pickAnimationPoints(result);

  const tokenColors = {};
  colors.semantic.forEach((c) => {
    tokenColors[c.name] = { $type: "color", $value: c.value };
  });
  colors.palette.forEach((c) => {
    tokenColors[c.name] = { $type: "color", $value: c.value };
  });

  const tokenBorders = {};
  borders.forEach((b) => {
    tokenBorders[b.name] = {
      $type: "border",
      $value: {
        width: b.width,
        style: b.style,
        color: b.color,
      },
    };
  });

  const tokenSpacing = {};
  paddings.forEach((p) => {
    tokenSpacing[p.name] = {
      $type: "dimension",
      $value: p.px,
    };
  });

  const tokenAnimation = {
    duration: {},
    easing: {},
    recipe: {},
  };

  animation.durations.forEach((d, i) => {
    tokenAnimation.duration[`duration-${i + 1}`] = { $type: "duration", $value: d };
  });

  animation.easings.forEach((e, i) => {
    tokenAnimation.easing[`easing-${i + 1}`] = { $type: "cubicBezier", $value: e };
  });

  animation.recipes.forEach((r) => {
    tokenAnimation.recipe[r.name] = {
      $type: "transition",
      $value: {
        trigger: r.trigger,
        properties: r.properties,
      },
    };
  });

  return {
    schemaVersion: "1.0.0",
    summary: {
      color: tokenColors,
      border: tokenBorders,
      spacing: tokenSpacing,
      motion: tokenAnimation,
    },
  };
}

export function buildSummaryOutput(result) {
  return {
    simple: createSimpleSummary(result),
    tokens: createSummaryTokens(result),
  };
}
