import test from "node:test";
import assert from "node:assert/strict";
import { buildSummaryOutput } from "../lib/summary-exporter.js";

test("buildSummaryOutput returns simple and token summaries", () => {
  const result = {
    url: "https://acme.com",
    extractedAt: "2026-02-16T00:00:00.000Z",
    colors: {
      semantic: { primary: "#112233" },
      palette: [{ color: "#445566", normalized: "#445566", confidence: "high" }],
    },
    borders: {
      combinations: [{ width: "1px", style: "solid", color: "#112233", confidence: "high" }],
    },
    spacing: {
      commonValues: [{ px: "16px", rem: "1rem", count: 10 }],
    },
    motion: {
      durations: ["200ms"],
      easings: ["ease"],
      recipes: [{ name: "hover-lift", trigger: "hover", properties: ["transform"] }],
    },
  };

  const summary = buildSummaryOutput(result);

  assert.equal(summary.simple.title, "Design Summary");
  assert.equal(summary.simple.highlights.palette.semantic[0].name, "primary");
  assert.equal(summary.tokens.summary.color.primary.$value, "#112233");
  assert.equal(summary.tokens.summary.border["border-1"].$value.width, "1px");
  assert.equal(summary.tokens.summary.spacing["space-1"].$value, "16px");
  assert.equal(summary.tokens.summary.motion.duration["duration-1"].$value, "200ms");
});
