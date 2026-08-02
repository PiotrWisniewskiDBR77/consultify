/**
 * workbookExportSanitizer — MAT-006 (2026-08-02).
 *
 * Neutralizes classic CSV/XLSX "formula injection" (a.k.a. DDE injection):
 * a cell whose LITERAL string content is data typed by a user (not a real
 * formula — real formulas live in `cell.formula`, a separate schema field,
 * see `WorkbookSchema.ts`'s `CellSchema`) but happens to start with `=`, `+`,
 * `-`, `@` (or a tab/CR, the extended OWASP list), which some spreadsheet
 * applications auto-execute as a formula/DDE command when the file is
 * re-opened or re-imported (classic example: a cell literally containing
 * `=cmd|'/c calc'!A1`).
 *
 * Applied at the EXPORT boundary only (XLSX build in `WorkbookBuilder.ts`,
 * CSV build below) — never at storage/`PATCH /:id/cell` time, so the stored
 * `schema_json` keeps the user's exact typed text (what they see echoed back
 * in the in-app grid is not silently mutated). This mirrors OWASP guidance:
 * sanitize on output to the untrusted-interpreter boundary, not on input.
 *
 * Numbers/booleans/null pass through untouched — only STRING values are
 * examined, and only strings whose first character is dangerous get a
 * leading `'` (single quote) prefix, which spreadsheet applications treat as
 * an explicit "force text" marker (not shown in the rendered cell, only in
 * the formula bar) — the standard, minimal-side-effect mitigation.
 */

const DANGEROUS_LEADING_CHARS = new Set(['=', '+', '-', '@', '\t', '\r']);

/**
 * Returns true when `value` is a string whose literal content would be
 * auto-interpreted as a formula/command by a spreadsheet application if
 * written verbatim into a cell/CSV field.
 */
export function isInjectionRisk(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  return DANGEROUS_LEADING_CHARS.has(value[0]);
}

/**
 * Neutralizes a single plain-text DATA value (never call this on an actual
 * formula string — formulas are supposed to start with an operator/`=`).
 * Non-string / safe-string values are returned unchanged.
 */
export function sanitizeSpreadsheetCellText<T>(value: T): T | string {
  if (!isInjectionRisk(value)) return value;
  return `'${value}`;
}
