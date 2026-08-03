/**
 * adaptQuery / replacePositionalPlaceholders — placeholder-context safety.
 *
 * Background (RED-A, fala W4): the previous implementation replaced EVERY `?`
 * with `$n` via a naive `sql.replace(/\?/g, ...)`, including `?` characters
 * that live inside string literals, quoted identifiers, or comments. Any query
 * carrying a literal `?` (regex `~ '.*?'`, a comment with `?`, a JSON path,
 * etc.) received a bogus placeholder and failed with 42P18 / wrong-param.
 *
 * The fix makes the replacement context-aware. This suite proves TWO things:
 *   (A) REGRESSION: for normal queries (all `?` are real bind placeholders)
 *       the new function is byte-identical to the old naive replacement.
 *   (B) NEW: `?` inside a string / identifier / comment is left untouched, and
 *       mixed queries number only the real placeholders.
 */

import { describe, expect, it } from 'vitest';

import { adaptQuery, replacePositionalPlaceholders } from '../../src/database/PostgresDatabase.js';

/** The exact pre-fix behaviour, reproduced verbatim as the regression oracle. */
function naiveReplace(sql: string): string {
  let paramIndex = 1;
  return sql.replace(/\?/g, () => `$${paramIndex++}`);
}

/**
 * Corpus of REAL queries harvested from server/src (grep of live `?`-queries).
 * Every `?` here is a genuine bind placeholder — none appear inside literals.
 */
const REAL_QUERIES: string[] = [
  'SELECT value FROM user_preferences WHERE user_id = ? AND key = ?',
  'DELETE FROM user_preferences WHERE user_id = ? AND key = ?',
  'SELECT id, name FROM organizations WHERE id = ?',
  'SELECT COUNT(*) as c FROM projects WHERE organization_id = ?',
  'SELECT COUNT(*) as c FROM initiatives WHERE organization_id = ?',
  'SELECT COUNT(*) as c FROM tasks WHERE organization_id = ?',
  'SELECT COUNT(*) as c FROM decisions WHERE organization_id = ?',
  'SELECT COUNT(*) as c FROM users WHERE organization_id = ?',
  'SELECT status AS user_status FROM users WHERE id = ?',
  'SELECT subscription_plan_id FROM organization_billing WHERE organization_id = ?',
  'SELECT id, memory_limit_mb FROM subscription_plans WHERE id = ?',
  'SELECT memory_usage_mb_current, cpu_usage_percent_avg FROM organization_resource_usage WHERE organization_id = ?',
  'SELECT monthly_budget_usd, budget_spent_current_period FROM organizations WHERE id = ?',
  'SELECT project_id FROM tasks WHERE id = ? LIMIT 1',
  'SELECT project_id FROM interview_sessions WHERE id = ? LIMIT 1',
  'SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ? LIMIT 1',
  'SELECT status, project_id FROM initiatives WHERE id = ?',
  'SELECT status, initiative_id FROM tasks WHERE id = ?',
  'SELECT role FROM users WHERE id = ?',
  'SELECT jti FROM revoked_tokens WHERE jti = ?',
  'INSERT INTO server_start_events (id, git_sha, app_env, started_at) VALUES (?, ?, ?, ?)',
  'INSERT INTO customer_lifecycle_stages (id, name, description, order_index, color) VALUES (?, ?, ?, ?, ?)',
  'INSERT INTO plan_features (id, plan_id, feature_key, feature_value) VALUES (?, ?, ?, ?)',
  'INSERT INTO initiative_watchers (id, initiative_id, user_id) VALUES (?, ?, ?)',
  'INSERT INTO task_history (id, task_id, field, old_value, new_value, changed_by) VALUES (?, ?, ?, ?, ?, ?)',
  'UPDATE approved_domains SET auto_join = ? WHERE id = ? AND organization_id = ?',
  'UPDATE organizations SET owner_id = ? WHERE id = ?',
  'UPDATE users SET role = ?, updated_at = ? WHERE id IN (?, ?, ?) AND organization_id = ?',
  'DELETE FROM revoked_tokens WHERE user_id = ? AND jti = ?',
  'SELECT * FROM audit_events WHERE organization_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
];

describe('replacePositionalPlaceholders — (A) regression vs. naive oracle', () => {
  it('corpus is non-trivial (>= 20 real queries, all carrying placeholders)', () => {
    expect(REAL_QUERIES.length).toBeGreaterThanOrEqual(20);
    for (const q of REAL_QUERIES) expect(q).toContain('?');
  });

  it.each(REAL_QUERIES)('is byte-identical to the old naive replacement: %s', (sql) => {
    expect(replacePositionalPlaceholders(sql)).toBe(naiveReplace(sql));
  });

  it('preserves exact sequential numbering for a normal query', () => {
    expect(replacePositionalPlaceholders('INSERT INTO t (a, b, c) VALUES (?, ?, ?)')).toBe(
      'INSERT INTO t (a, b, c) VALUES ($1, $2, $3)'
    );
  });

  it('numbers an IN (...) list left-to-right', () => {
    expect(replacePositionalPlaceholders('SELECT * FROM t WHERE id IN (?, ?, ?) AND org = ?')).toBe(
      'SELECT * FROM t WHERE id IN ($1, $2, $3) AND org = $4'
    );
  });
});

describe('replacePositionalPlaceholders — (B) new context-aware behaviour', () => {
  it('leaves ? inside a single-quoted string literal untouched', () => {
    expect(replacePositionalPlaceholders("SELECT * FROM t WHERE name ~ '.*?'")).toBe(
      "SELECT * FROM t WHERE name ~ '.*?'"
    );
  });

  it('leaves ? inside a double-quoted identifier untouched', () => {
    expect(replacePositionalPlaceholders('SELECT col AS "weird?name" FROM t')).toBe(
      'SELECT col AS "weird?name" FROM t'
    );
  });

  it('leaves ? inside a -- line comment untouched', () => {
    const sql = 'SELECT 1 -- is this ok? maybe\nFROM t WHERE id = ?';
    expect(replacePositionalPlaceholders(sql)).toBe(
      'SELECT 1 -- is this ok? maybe\nFROM t WHERE id = $1'
    );
  });

  it('leaves ? inside a /* block comment */ untouched', () => {
    const sql = 'SELECT /* what? really? */ 1 FROM t WHERE id = ?';
    expect(replacePositionalPlaceholders(sql)).toBe(
      'SELECT /* what? really? */ 1 FROM t WHERE id = $1'
    );
  });

  it('numbers only real placeholders when a literal ? is present', () => {
    const sql = "SELECT * FROM t WHERE re ~ '.*?' AND a = ? AND b = ?";
    expect(replacePositionalPlaceholders(sql)).toBe(
      "SELECT * FROM t WHERE re ~ '.*?' AND a = $1 AND b = $2"
    );
  });

  it('keeps placeholder numbering starting at $1 after a literal ? in a string', () => {
    // The literal ? must NOT consume a param slot: first real placeholder = $1.
    const sql = "SELECT '?' AS q, ? AS p";
    expect(replacePositionalPlaceholders(sql)).toBe("SELECT '?' AS q, $1 AS p");
  });

  it('handles Postgres doubled-quote escape (two single quotes) inside a string', () => {
    // The '' is an escaped quote; the ? after it is still inside the string.
    const sql = "SELECT * FROM t WHERE note = 'it''s a ? mark' AND id = ?";
    expect(replacePositionalPlaceholders(sql)).toBe(
      "SELECT * FROM t WHERE note = 'it''s a ? mark' AND id = $1"
    );
  });

  it('handles JSON-ish / operator literals containing ?', () => {
    const sql = "SELECT data->>'q?' AS x FROM t WHERE id = ?";
    expect(replacePositionalPlaceholders(sql)).toBe("SELECT data->>'q?' AS x FROM t WHERE id = $1");
  });

  it('handles multiple string literals with ? between real placeholders', () => {
    const sql = "SELECT ? , '?a', ? , '?b', ?";
    expect(replacePositionalPlaceholders(sql)).toBe("SELECT $1 , '?a', $2 , '?b', $3");
  });

  it('empty single-quoted string does not swallow a following placeholder', () => {
    const sql = "SELECT '' AS empty, ? AS p";
    expect(replacePositionalPlaceholders(sql)).toBe("SELECT '' AS empty, $1 AS p");
  });
});

describe('adaptQuery — end-to-end integration (placeholders + transforms)', () => {
  it('still adapts a normal parametrised query', () => {
    expect(adaptQuery('SELECT * FROM users WHERE id = ? AND org = ?')).toBe(
      'SELECT * FROM users WHERE id = $1 AND org = $2'
    );
  });

  it('adapts placeholders together with datetime("now") without miscounting', () => {
    const out = adaptQuery('INSERT INTO permissions (key, created_at) VALUES (?, datetime("now"))');
    expect(out).toBe('INSERT INTO permissions (key, created_at) VALUES ($1, NOW())');
  });

  it('does not treat a ? inside a string literal as a placeholder', () => {
    const out = adaptQuery("SELECT * FROM t WHERE label ~ '^A.*?$' AND id = ?");
    expect(out).toBe("SELECT * FROM t WHERE label ~ '^A.*?$' AND id = $1");
  });
});
