import test from "node:test";
import assert from "node:assert/strict";
import { toW3CFormat } from "../lib/w3c-exporter.js";

function baseExtraction(overrides = {}) {
  return {
    url: "https://acme.com",
    extractedAt: "2026-02-16T00:00:00.000Z",
    colors: { semantic: {}, palette: [], cssVariables: {} },
    typography: { styles: [], sources: {} },
    spacing: { commonValues: [] },
    borderRadius: { values: [] },
    borders: { combinations: [] },
    shadows: [],
    ...overrides,
  };
}

test("exports semantic colors even without palette", () => {
  const tokens = toW3CFormat(
    baseExtraction({
      colors: {
        semantic: { primary: "#112233" },
        palette: [],
      },
    })
  );

  assert.equal(tokens.color.semantic.primary.$value.hex, "#112233");
});

test("exports typography letterSpacing from spacing field", () => {
  const tokens = toW3CFormat(
    baseExtraction({
      typography: {
        styles: [
          {
            context: "heading-1",
            family: "Inter",
            size: "32px",
            weight: 700,
            spacing: "0.5px",
          },
        ],
      },
    })
  );

  assert.equal(tokens.typography.style["text-heading-1"].$value.letterSpacing.$value.value, 0.5);
});

test("ignores invalid colors instead of forcing black", () => {
  const tokens = toW3CFormat(
    baseExtraction({
      colors: {
        semantic: { primary: "not-a-color" },
        palette: [],
      },
    })
  );

  assert.equal(tokens.color, undefined);
});

test("parses rgba shadows", () => {
  const tokens = toW3CFormat(
    baseExtraction({
      shadows: [
        {
          shadow: "0px 2px 10px 0px rgba(0, 0, 0, 0.2)",
          confidence: "high",
        },
      ],
    })
  );

  assert.equal(tokens.shadow["shadow-1"].$value.offsetY.value, 2);
  assert.equal(tokens.shadow["shadow-1"].$value.color.alpha, 0.2);
});
