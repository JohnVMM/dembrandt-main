/**
 * W3C Design Tokens Format Exporter
 * Converts dembrandt extraction output to W3C DTCG format
 */

import { URL } from 'url';

function normalizeHex(hex) {
  const clean = (hex || '').replace('#', '').toLowerCase();
  if (/^[0-9a-f]{3}$/.test(clean)) {
    return `#${clean[0]}${clean[0]}${clean[1]}${clean[1]}${clean[2]}${clean[2]}`;
  }
  if (/^[0-9a-f]{6}$/.test(clean)) {
    return `#${clean}`;
  }
  return null;
}

function toColorObject(r, g, b, alpha = 1) {
  const safe = {
    colorSpace: 'srgb',
    components: [r, g, b].map((v) => Math.round(v * 1000) / 1000),
    hex: `#${Math.round(r * 255).toString(16).padStart(2, '0')}${Math.round(g * 255).toString(16).padStart(2, '0')}${Math.round(b * 255).toString(16).padStart(2, '0')}`,
  };
  if (alpha !== 1) {
    safe.alpha = Math.round(alpha * 1000) / 1000;
  }
  return safe;
}

function parseColorString(color) {
  if (typeof color !== 'string') return null;
  const value = color.trim();

  const rgbaMatch = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/i);
  if (rgbaMatch) {
    const r = Number(rgbaMatch[1]) / 255;
    const g = Number(rgbaMatch[2]) / 255;
    const b = Number(rgbaMatch[3]) / 255;
    const a = rgbaMatch[4] ? Number(rgbaMatch[4]) : 1;
    return toColorObject(r, g, b, a);
  }

  const hex = normalizeHex(value);
  if (hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return toColorObject(r, g, b, 1);
  }

  return null;
}

function toW3CDimension(value) {
  if (typeof value === 'string') {
    const cleanValue = value.split('(')[0].trim();
    const match = cleanValue.match(/^([-\d.]+)\s*([a-z%]*)$/i);
    if (match) {
      return {
        value: parseFloat(match[1]),
        unit: match[2] || 'px',
      };
    }
  }

  if (typeof value === 'number') {
    return {
      value,
      unit: 'px',
    };
  }

  if (value && typeof value === 'object' && value.px !== undefined) {
    return {
      value: value.px,
      unit: 'px',
    };
  }

  return {
    value: parseFloat(value) || 0,
    unit: 'px',
  };
}

function sanitizeTokenName(name) {
  return String(name)
    .replace(/^\$/, '')
    .replace(/[{}.]/g, '-')
    .replace(/\s+/g, '-')
    .toLowerCase();
}

function exportColors(colors) {
  if (!colors) {
    return null;
  }

  const colorTokens = {};

  if (colors.semantic) {
    const semantic = {};
    for (const [key, value] of Object.entries(colors.semantic)) {
      if (!value) continue;
      const colorValue = typeof value === 'string' ? value : value.color;
      const parsed = parseColorString(colorValue);
      if (!parsed) continue;

      semantic[sanitizeTokenName(key)] = {
        $type: 'color',
        $value: parsed,
      };
    }

    if (Object.keys(semantic).length > 0) {
      colorTokens.semantic = semantic;
    }
  }

  if (Array.isArray(colors.palette) && colors.palette.length > 0) {
    const palette = {};
    colors.palette
      .filter((entry) => entry.confidence !== 'low')
      .slice(0, 30)
      .forEach((entry, index) => {
        const parsed = parseColorString(entry.color || entry.normalized);
        if (!parsed) return;

        palette[`palette-${index + 1}`] = {
          $type: 'color',
          $value: parsed,
          $description: `Count: ${entry.count || 0}, Confidence: ${entry.confidence || 'unknown'}`,
        };
      });

    if (Object.keys(palette).length > 0) {
      colorTokens.palette = palette;
    }
  }

  return Object.keys(colorTokens).length > 0 ? colorTokens : null;
}

function exportTypography(typography) {
  if (!typography || !Array.isArray(typography.styles) || typography.styles.length === 0) {
    return null;
  }

  const typographyTokens = {};
  const families = new Set();

  typography.styles.forEach((style) => {
    if (style.family) families.add(style.family);
  });

  if (families.size > 0) {
    const fontFamilies = {};
    Array.from(families).forEach((family, index) => {
      const name = sanitizeTokenName(family) || `font-${index + 1}`;
      fontFamilies[name] = {
        $type: 'fontFamily',
        $value: family,
      };
    });
    typographyTokens['font-family'] = fontFamilies;
  }

  const textStyles = {};
  typography.styles.slice(0, 10).forEach((style, index) => {
    const name = style.context ? `text-${sanitizeTokenName(style.context)}` : `text-${index + 1}`;
    const token = {
      $type: 'typography',
      $value: {},
    };

    if (style.family) {
      const familyName = sanitizeTokenName(style.family) || `font-${index + 1}`;
      token.$value.fontFamily = `{typography.font-family.${familyName}}`;
    }

    if (style.size) {
      token.$value.fontSize = {
        $type: 'dimension',
        $value: toW3CDimension(style.size),
      };
    }

    if (style.weight) {
      token.$value.fontWeight = {
        $type: 'fontWeight',
        $value: typeof style.weight === 'number' ? style.weight : parseInt(style.weight, 10) || 400,
      };
    }

    if (style.lineHeight) {
      token.$value.lineHeight = {
        $type: 'number',
        $value: parseFloat(style.lineHeight) || 1.5,
      };
    }

    const spacingValue = style.letterSpacing || style.spacing;
    if (spacingValue) {
      token.$value.letterSpacing = {
        $type: 'dimension',
        $value: toW3CDimension(spacingValue),
      };
    }

    textStyles[name] = token;
  });

  if (Object.keys(textStyles).length > 0) {
    typographyTokens.style = textStyles;
  }

  return Object.keys(typographyTokens).length > 0 ? typographyTokens : null;
}

function exportSpacing(spacing) {
  if (!spacing || !Array.isArray(spacing.commonValues) || spacing.commonValues.length === 0) {
    return null;
  }

  const spacingTokens = {};
  spacing.commonValues.slice(0, 12).forEach((value, index) => {
    spacingTokens[`spacing-${index + 1}`] = {
      $type: 'dimension',
      $value: toW3CDimension(value.px || value),
    };
  });

  return Object.keys(spacingTokens).length > 0 ? spacingTokens : null;
}

function exportBorderRadius(borderRadius) {
  if (!borderRadius || !Array.isArray(borderRadius.values) || borderRadius.values.length === 0) {
    return null;
  }

  const radiusTokens = {};
  borderRadius.values
    .filter((entry) => entry.confidence !== 'low')
    .slice(0, 6)
    .forEach((entry, index) => {
      radiusTokens[`radius-${index + 1}`] = {
        $type: 'dimension',
        $value: toW3CDimension(entry.value),
      };
    });

  return Object.keys(radiusTokens).length > 0 ? radiusTokens : null;
}

function exportBorders(borders) {
  if (!borders || !Array.isArray(borders.combinations) || borders.combinations.length === 0) {
    return null;
  }

  const borderTokens = {};
  const widths = {};
  const colors = {};
  const seenWidths = new Set();
  const seenColors = new Set();

  borders.combinations
    .filter((combo) => combo.confidence !== 'low')
    .slice(0, 10)
    .forEach((combo) => {
      if (combo.width && !seenWidths.has(combo.width)) {
        const index = seenWidths.size + 1;
        widths[`border-width-${index}`] = {
          $type: 'dimension',
          $value: toW3CDimension(combo.width),
        };
        seenWidths.add(combo.width);
      }

      if (combo.color && !seenColors.has(combo.color)) {
        const parsed = parseColorString(combo.color);
        if (!parsed) return;

        const index = seenColors.size + 1;
        colors[`border-color-${index}`] = {
          $type: 'color',
          $value: parsed,
        };
        seenColors.add(combo.color);
      }
    });

  if (Object.keys(widths).length > 0) borderTokens.width = widths;
  if (Object.keys(colors).length > 0) borderTokens.color = colors;

  return Object.keys(borderTokens).length > 0 ? borderTokens : null;
}

function parseShadowValue(shadow) {
  if (!shadow || shadow === 'none') return null;

  const colorMatch = shadow.match(/(rgba?\([^)]*\)|#[0-9a-fA-F]{3,8})/);
  const color = colorMatch ? parseColorString(colorMatch[1]) : null;
  const cleaned = shadow.replace(colorMatch?.[1] || '', ' ').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);

  if (parts.length < 2) return null;

  return {
    offsetX: toW3CDimension(parts[0] || '0px'),
    offsetY: toW3CDimension(parts[1] || '0px'),
    blur: toW3CDimension(parts[2] || '0px'),
    spread: toW3CDimension(parts[3] || '0px'),
    color: color || parseColorString('#000000'),
  };
}

function exportShadows(shadows) {
  if (!Array.isArray(shadows) || shadows.length === 0) {
    return null;
  }

  const shadowTokens = {};
  shadows
    .filter((entry) => entry.confidence !== 'low')
    .slice(0, 6)
    .forEach((entry, index) => {
      const parsed = parseShadowValue(entry.shadow);
      if (!parsed) return;

      shadowTokens[`shadow-${index + 1}`] = {
        $type: 'shadow',
        $value: parsed,
      };
    });

  return Object.keys(shadowTokens).length > 0 ? shadowTokens : null;
}

export function toW3CFormat(extractionResult) {
  const tokens = {};
  const domain = extractionResult.url
    ? new URL(extractionResult.url).hostname.replace('www.', '')
    : 'unknown';

  tokens.$extensions = {
    'com.dembrandt': {
      url: extractionResult.url,
      domain,
      extractedAt: extractionResult.extractedAt,
    },
  };

  const colors = exportColors(extractionResult.colors);
  if (colors) tokens.color = colors;

  const typography = exportTypography(extractionResult.typography);
  if (typography) tokens.typography = typography;

  const spacing = exportSpacing(extractionResult.spacing);
  if (spacing) tokens.spacing = spacing;

  const radius = exportBorderRadius(extractionResult.borderRadius);
  if (radius) tokens.radius = radius;

  const border = exportBorders(extractionResult.borders);
  if (border) tokens.border = border;

  const shadow = exportShadows(extractionResult.shadows);
  if (shadow) tokens.shadow = shadow;

  return tokens;
}
