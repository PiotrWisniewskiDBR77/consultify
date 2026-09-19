// Console messages that the HARNESS itself causes must never be scored as app
// errors. `route.abort('blockedbyclient')` (the read-only proof) makes Chromium
// log "Failed to load resource: net::ERR_BLOCKED_BY_CLIENT" for the very request
// we blocked; without this filter the block is counted twice — once as the
// BLOCKED cell it belongs to, and again as an "uncaught console error" on the
// next cell, which flips MISSING surfaces from CONTRACT to PRODUCT.
const HARNESS_NOISE = /net::ERR_BLOCKED_BY_CLIENT/i;

// Third-party telemetry that is not the application's own code and was already
// filtered by the step-2 runner before this module existed.
const THIRD_PARTY_NOISE = /cloudflareinsights|beacon\.min\.js/i;

export function isHarnessConsoleNoise(text) {
  const value = String(text ?? '');
  return HARNESS_NOISE.test(value) || THIRD_PARTY_NOISE.test(value);
}

export function appConsoleErrors(errors) {
  return (Array.isArray(errors) ? errors : []).filter(
    (entry) => !isHarnessConsoleNoise(entry)
  );
}
