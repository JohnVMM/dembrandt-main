import test from "node:test";
import assert from "node:assert/strict";
import { validateBundleSchema, validateRawPageSchema } from "../lib/schemas.js";

test("validateRawPageSchema returns false for incomplete page", () => {
  assert.equal(validateRawPageSchema({}), false);
  assert.equal(
    validateRawPageSchema({
      url: "https://acme.com",
      finalUrl: "https://acme.com",
      extraction: {},
      metrics: {},
    }),
    true
  );
});

test("validateBundleSchema checks minimum contract", () => {
  assert.equal(validateBundleSchema({}), false);
  assert.equal(
    validateBundleSchema({
      schemaVersion: "1.0.0",
      report: {},
      tokensLight: {},
      components: {},
      layout: {},
      motion: {},
      summary: {},
      assets: {},
    }),
    true
  );
});
