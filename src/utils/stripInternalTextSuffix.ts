/**
 * CB-06 / RV-012 — interview question text sometimes carries a trailing
 * internal marker (e.g. "…improve onboarding? $8") left over from an
 * upstream interpolation/citation step. Strips it before the text ever
 * reaches a presentation surface; the stored question text is untouched.
 */
export function stripInternalTextSuffix(text: string): string {
  if (!text) return text;
  return text.replace(/\s*\$\d+\s*$/, '');
}
