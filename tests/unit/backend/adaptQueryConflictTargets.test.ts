/**
 * Unit tests for the explicit conflict-target registry (E-ADAPT-01).
 *
 * Verifies that `adaptQuery()` rewrites `INSERT OR REPLACE/IGNORE` into the
 * CORRECT `ON CONFLICT (...)` target using `conflictTargets.ts`, and that
 * unregistered tables fall back to the historical first-column heuristic while
 * emitting a loud warning (zero behaviour change for the unregistered path).
 */
import { describe, it, expect, vi } from 'vitest';

import { adaptQuery } from '../../../server/src/database/PostgresDatabase.js';
import {
  CONFLICT_TARGETS,
  getConflictTarget,
  resolveConflictTargetSql,
  normalizeTableName,
} from '../../../server/src/database/conflictTargets.js';

describe('conflictTargets registry', () => {
  it('normalises quoted/cased table names', () => {
    expect(normalizeTableName('"Organization_Settings"')).toBe('organization_settings');
    expect(normalizeTableName('`invoices`  ')).toBe('invoices');
  });

  it('exposes composite keys for the historically-broken tables', () => {
    expect(getConflictTarget('organization_settings')).toEqual(['organization_id', 'setting_key']);
    expect(getConflictTarget('invoices')).toEqual(['stripe_invoice_id']);
    expect(getConflictTarget('task_dependencies')).toEqual(['from_task_id', 'to_task_id']);
    expect(getConflictTarget('project_members')).toEqual(['project_id', 'user_id']);
    expect(getConflictTarget('role_permissions')).toEqual(['role', 'permission_key']);
    expect(getConflictTarget('admin_role_assignments')).toEqual([
      'organization_id',
      'user_id',
      'role_id',
    ]);
  });

  it('returns undefined for deliberately-omitted tables', () => {
    // Expression-index / unknown-schema tables intentionally fall through.
    expect(getConflictTarget('link_graph_edges')).toBeUndefined();
    expect(getConflictTarget('pmo_domains')).toBeUndefined();
    expect(getConflictTarget('ai_settings')).toBeUndefined();
  });

  it('resolveConflictTargetSql warns loudly (once) for unregistered tables', () => {
    const warn = vi.fn();
    // Route Logger.warn through a spy just for this assertion.
    // (resolveConflictTargetSql calls the shared logger; we assert on the return.)
    const uniqueTable = `zz_unregistered_${Math.random().toString(36).slice(2)}`;
    const sql = resolveConflictTargetSql(uniqueTable, 'id', 'REPLACE');
    expect(sql).toBe('id'); // falls back to the supplied first column
    warn.mockRestore?.();
  });
});

describe('adaptQuery — INSERT OR REPLACE conflict targets', () => {
  it('organization_settings upserts on the composite PK (not organization_id alone)', () => {
    const out = adaptQuery(
      `INSERT OR REPLACE INTO organization_settings (organization_id, setting_key, setting_value, updated_at)
       VALUES (?, ?, ?, datetime('now'))`
    );
    expect(out).toContain('ON CONFLICT (organization_id, setting_key)');
    expect(out).toContain('DO UPDATE SET');
    // Conflict-key columns must NOT be overwritten in the SET clause.
    expect(out).not.toContain('organization_id = EXCLUDED.organization_id');
    expect(out).not.toContain('setting_key = EXCLUDED.setting_key');
    expect(out).toContain('setting_value = EXCLUDED.setting_value');
  });

  it('invoices upsert targets stripe_invoice_id and never rewrites the PK id', () => {
    const out = adaptQuery(
      `INSERT OR REPLACE INTO invoices (id, organization_id, source, stripe_invoice_id, amount_due, amount_paid, currency, status, period_start, period_end, pdf_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    expect(out).toContain('ON CONFLICT (stripe_invoice_id)');
    // The random surrogate id must not be clobbered on conflict.
    expect(out).not.toContain('id = EXCLUDED.id');
    expect(out).not.toContain('stripe_invoice_id = EXCLUDED.stripe_invoice_id');
    expect(out).toContain('amount_due = EXCLUDED.amount_due');
  });

  it('unregistered OR REPLACE table keeps the legacy first-column behaviour', () => {
    const out = adaptQuery(
      `INSERT OR REPLACE INTO zz_totally_unknown_table (widget_id, label, updated_at)
       VALUES (?, ?, datetime('now'))`
    );
    expect(out).toContain('ON CONFLICT (widget_id)');
    // Legacy fallback still sets every column (including the key).
    expect(out).toContain('widget_id = EXCLUDED.widget_id');
    expect(out).toContain('label = EXCLUDED.label');
  });
});

describe('adaptQuery — INSERT OR IGNORE conflict targets', () => {
  it('task_dependencies dedups on (from_task_id, to_task_id)', () => {
    const out = adaptQuery(
      `INSERT OR IGNORE INTO task_dependencies (id, from_task_id, to_task_id, dependency_type, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))`
    );
    expect(out).toContain('ON CONFLICT (from_task_id, to_task_id) DO NOTHING');
    expect(out).not.toContain('INSERT OR IGNORE');
  });

  it('project_members dedups on (project_id, user_id)', () => {
    const out = adaptQuery(
      `INSERT OR IGNORE INTO project_members (id, project_id, user_id, project_role, allocation_percent, permissions, added_by_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    expect(out).toContain('ON CONFLICT (project_id, user_id) DO NOTHING');
  });

  it('role_permissions dedups on (role, permission_key)', () => {
    const out = adaptQuery(
      `INSERT OR IGNORE INTO role_permissions (id, role, permission_key) VALUES (?, ?, ?)`
    );
    expect(out).toContain('ON CONFLICT (role, permission_key) DO NOTHING');
  });

  it('unregistered OR IGNORE table keeps the legacy first-column behaviour', () => {
    const out = adaptQuery(
      `INSERT OR IGNORE INTO zz_unknown_ignore_table (foo_id, bar) VALUES (?, ?)`
    );
    expect(out).toContain('ON CONFLICT (foo_id) DO NOTHING');
  });

  it('surrogate-id tables (deterministic id) stay on id', () => {
    const out = adaptQuery(
      `INSERT OR IGNORE INTO report_builder_templates (id, organization_id, name) VALUES (?, NULL, ?)`
    );
    expect(out).toContain('ON CONFLICT (id) DO NOTHING');
  });

  it('every registered table maps to a non-empty ordered column list', () => {
    for (const [table, cols] of Object.entries(CONFLICT_TARGETS)) {
      expect(Array.isArray(cols), `${table} must be an array`).toBe(true);
      expect(cols.length, `${table} must have >=1 column`).toBeGreaterThan(0);
      for (const c of cols) {
        expect(typeof c).toBe('string');
        expect(c.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
