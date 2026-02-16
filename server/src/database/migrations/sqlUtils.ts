/**
 * SQL utilities for migration scripts.
 *
 * Intentionally simple: migration files in this repo are plain SQL with `--` comments.
 * We split by `;` and drop empty/comment-only statements.
 */

function stripLeadingLineComments(statement: string): string {
  const lines = statement.split(/\r?\n/);
  const kept: string[] = [];
  let stripping = true;

  for (const line of lines) {
    const trimmed = line.trim();
    if (stripping && (trimmed === '' || trimmed.startsWith('--'))) continue;
    stripping = false;
    kept.push(line);
  }

  return kept.join('\n').trim();
}

export function splitSqlStatements(sql: string): string[] {
  const normalized = (sql || '').replace(/^\uFEFF/, '');
  return normalized
    .split(';')
    .map((s) => stripLeadingLineComments(s))
    .filter((s) => s.length > 0);
}
