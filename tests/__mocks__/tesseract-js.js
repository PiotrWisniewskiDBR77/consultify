/**
 * Stub for `tesseract.js`.
 *
 * The package is imported by server/src/services/ai/deckImageSafetyGates.ts but
 * is NOT declared in package.json and is not installed — so that code path is
 * already broken at runtime, independently of any test. Vite still has to
 * RESOLVE the dynamic import while transforming the module graph, which made
 * every suite that mounts the full Gateway fail to load.
 *
 * The stub resolves; it does not pretend to work. Calling it throws, so no test
 * can go green on a fake OCR result.
 */
export function recognize() {
  throw new Error(
    '[tesseract.js stub] OCR is not available in tests: the package is not a declared dependency.'
  );
}

export default { recognize };
