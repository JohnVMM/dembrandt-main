export function validateRawPageSchema(rawPage) {
  return Boolean(
    rawPage &&
    typeof rawPage.url === "string" &&
    typeof rawPage.finalUrl === "string" &&
    rawPage.extraction &&
    rawPage.metrics
  );
}

export function validateBundleSchema(bundle) {
  return Boolean(
    bundle &&
    typeof bundle.schemaVersion === "string" &&
    bundle.report &&
    bundle.tokensLight &&
    bundle.components &&
    bundle.layout &&
    bundle.motion &&
    bundle.summary &&
    bundle.assets
  );
}
