import { describe, expect, it } from 'vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { __private__ as dbPromisePrivate } from '../../../utils/DbPromise.js';
import type { Database } from '../../../utils/DbPromise.js';
import { run } from '../../../utils/DbPromise.js';

describe('DbPromise placeholder translation', () => {
  describe('translatePlaceholders pattern', () => {
    const translatePlaceholders = dbPromisePrivate.translatePlaceholders;

    it('translates simple ? placeholders', () => {
      expect(translatePlaceholders('SELECT * FROM t WHERE id = ?')).toBe(
        'SELECT * FROM t WHERE id = $1'
      );
    });

    it('translates multiple ? placeholders', () => {
      expect(translatePlaceholders('INSERT INTO t (a, b, c) VALUES (?, ?, ?)')).toBe(
        'INSERT INTO t (a, b, c) VALUES ($1, $2, $3)'
      );
    });

    it('skips SQL that already uses $N placeholders', () => {
      const sql = 'SELECT * FROM t WHERE id = $1 AND name = $2';
      expect(translatePlaceholders(sql)).toBe(sql);
    });

    it('does not translate ? inside string literals', () => {
      expect(translatePlaceholders("SELECT * FROM t WHERE name = ? AND note = 'what?'")).toBe(
        "SELECT * FROM t WHERE name = $1 AND note = 'what?'"
      );
    });

    it('handles complex query with mixed ? and string literals', () => {
      const sql = "INSERT INTO t (a, b, c) VALUES (?, 'hello?world', ?)";
      expect(translatePlaceholders(sql)).toBe(
        "INSERT INTO t (a, b, c) VALUES ($1, 'hello?world', $2)"
      );
    });

    it('handles SQL with no placeholders', () => {
      expect(translatePlaceholders('SELECT * FROM t')).toBe('SELECT * FROM t');
    });

    it('handles empty string', () => {
      expect(translatePlaceholders('')).toBe('');
    });

    it('handles many placeholders (V8 services use up to 20+)', () => {
      const qs = Array(15).fill('?').join(', ');
      const expected = Array.from({ length: 15 }, (_, i) => `$${i + 1}`).join(', ');
      expect(translatePlaceholders(`INSERT INTO t VALUES (${qs})`)).toBe(
        `INSERT INTO t VALUES (${expected})`
      );
    });

    it('handles subquery with ?', () => {
      expect(
        translatePlaceholders(
          'SELECT * FROM t WHERE id = ? AND org = (SELECT id FROM orgs WHERE name = ?)'
        )
      ).toBe('SELECT * FROM t WHERE id = $1 AND org = (SELECT id FROM orgs WHERE name = $2)');
    });

    it('handles CASE WHEN with ?', () => {
      expect(
        translatePlaceholders(
          'UPDATE t SET status = CASE WHEN id = ? THEN ? ELSE ? END WHERE org = ?'
        )
      ).toBe('UPDATE t SET status = CASE WHEN id = $1 THEN $2 ELSE $3 END WHERE org = $4');
    });

    it('handles nested single quotes (escaped with double single-quote)', () => {
      expect(
        translatePlaceholders("SELECT * FROM t WHERE name = ? AND note = 'it''s a test' AND id = ?")
      ).toBe("SELECT * FROM t WHERE name = $1 AND note = 'it''s a test' AND id = $2");
    });

    it('handles multiline SQL with placeholders', () => {
      const sql = [
        'INSERT INTO v8_context_snapshots',
        '  (id, organization_id, conversation_id, status)',
        'VALUES',
        '  (?, ?, ?, ?)',
      ].join('\n');
      const expected = [
        'INSERT INTO v8_context_snapshots',
        '  (id, organization_id, conversation_id, status)',
        'VALUES',
        '  ($1, $2, $3, $4)',
      ].join('\n');
      expect(translatePlaceholders(sql)).toBe(expected);
    });

    it('handles ? in LIKE patterns inside string literals', () => {
      expect(translatePlaceholders("SELECT * FROM t WHERE name LIKE '%?%' AND id = ?")).toBe(
        "SELECT * FROM t WHERE name LIKE '%?%' AND id = $1"
      );
    });

    it('handles consecutive string literals with ? between them', () => {
      expect(translatePlaceholders("SELECT * FROM t WHERE a = 'x' AND b = ? AND c = 'y'")).toBe(
        "SELECT * FROM t WHERE a = 'x' AND b = $1 AND c = 'y'"
      );
    });

    it('handles JSON-like content in string literals', () => {
      expect(
        translatePlaceholders('INSERT INTO t (data) VALUES (?) WHERE meta = \'{"key": "value?"}\'')
      ).toBe('INSERT INTO t (data) VALUES ($1) WHERE meta = \'{"key": "value?"}\'');
    });
  });

  describe('run timeout behavior', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('rejects on timeout when fallback is false', async () => {
      const mockDb: Pick<Database, 'run'> = {
        run: vi.fn((_sql, _params, _cb) => {
          // Intentionally never call callback to simulate hung driver call.
        }),
      };

      const promise = run(mockDb as Database, 'INSERT INTO t (a) VALUES (?)', [1], {
        timeout: 50,
        fallback: false,
      });

      const rejection = expect(promise).rejects.toThrow(/timeout/i);
      await vi.advanceTimersByTimeAsync(50);
      await rejection;
    });
  });
});
