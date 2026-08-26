/** Shared, literal ILIKE semantics for Results search and registry filters. */
export function escapeResultsTextMatch(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export function resultsTextMatchPattern(value: string): string {
  return `%${escapeResultsTextMatch(value.trim())}%`;
}

export function resultsTextMatchSql(columns: readonly string[], parameter: string): string {
  if (columns.length === 0) throw new Error('resultsTextMatchSql requires at least one column');
  return `(${columns.map((column) => `${column} ILIKE ${parameter} ESCAPE E'\\\\'`).join(' OR ')})`;
}
