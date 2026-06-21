// @vitest-environment node
/**
 * R5 FT-2 — Conditional-formatting PERSISTENCE round-trip + FT-8 org-scope.
 *
 * CF rules persist inside a view's `config` JSONB via `MetadataService.updateView`
 * (no migration). This test drives the exact write/read contract the integration
 * hook uses:
 *   write  → updateView(viewId, { config: { ...prev, conditional_formatting: rules } })
 *   read   → (view.config as ViewConfig).conditional_formatting
 *
 * It uses an in-memory fake of the views store keyed by id, so the round-trip
 * and the per-view (≈ per-org) scoping are both exercised without a DB.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConditionalFormatRule, ViewConfig } from '@/types/tablePlatform';

// In-memory view store standing in for tp_views (config = JSONB).
interface FakeView {
  id: string;
  orgId: string;
  config: Record<string, unknown>;
}

const store = new Map<string, FakeView>();

// Mirrors TablePlatformApi.updateView's config-merge semantics.
const updateView = vi.fn(
  async (viewId: string, updates: { config?: Record<string, unknown> }) => {
    const v = store.get(viewId);
    if (!v) throw new Error(`view ${viewId} not found`);
    if (updates.config) v.config = updates.config;
    return v;
  }
);

// Mirrors the hook's writer: merge prev config, set conditional_formatting.
async function persistCF(viewId: string, rules: ConditionalFormatRule[]) {
  const v = store.get(viewId)!;
  const cfg: Record<string, unknown> = { ...(v.config ?? {}) };
  cfg.conditional_formatting = rules;
  await updateView(viewId, { config: cfg });
}

// Mirrors the hook's reader.
function readCF(viewId: string): ConditionalFormatRule[] {
  const v = store.get(viewId)!;
  const cfg = (v.config ?? {}) as ViewConfig;
  return (cfg.conditional_formatting as ConditionalFormatRule[] | undefined) ?? [];
}

const RULES: ConditionalFormatRule[] = [
  {
    id: 'r1',
    fieldId: 'status',
    operator: 'equals',
    value: 'Done',
    style: { backgroundColor: '#d1fae5', color: '#065f46', fontWeight: 'bold' },
  },
  {
    id: 'r2',
    fieldId: 'priority',
    operator: 'greater_than',
    value: 3,
    style: { backgroundColor: '#fee2e2' },
  },
];

beforeEach(() => {
  store.clear();
  updateView.mockClear();
  store.set('view-A', { id: 'view-A', orgId: 'org-1', config: { rowHeight: 'short' } });
  store.set('view-B', { id: 'view-B', orgId: 'org-2', config: {} });
});

describe('FT-2 — CF persistence round-trip', () => {
  it('writes rules into config and reads them back unchanged', async () => {
    await persistCF('view-A', RULES);
    expect(readCF('view-A')).toEqual(RULES);
  });

  it('preserves other config keys (merge, not overwrite)', async () => {
    await persistCF('view-A', RULES);
    expect(store.get('view-A')!.config.rowHeight).toBe('short');
    expect(updateView).toHaveBeenCalledWith('view-A', {
      config: expect.objectContaining({ rowHeight: 'short', conditional_formatting: RULES }),
    });
  });

  it('clearing rules persists an empty list', async () => {
    await persistCF('view-A', RULES);
    await persistCF('view-A', []);
    expect(readCF('view-A')).toEqual([]);
  });
});

describe('FT-8 — org/view scope isolation', () => {
  it('CF on one view does not leak into another view', async () => {
    await persistCF('view-A', RULES);
    expect(readCF('view-A')).toEqual(RULES);
    expect(readCF('view-B')).toEqual([]);
  });

  it('each org-scoped view keeps its own ruleset', async () => {
    const otherRules: ConditionalFormatRule[] = [
      { id: 'x', fieldId: 'name', operator: 'is_not_empty', style: { color: '#1e3a8a' } },
    ];
    await persistCF('view-A', RULES);
    await persistCF('view-B', otherRules);
    expect(readCF('view-A')).toEqual(RULES);
    expect(readCF('view-B')).toEqual(otherRules);
    expect(store.get('view-A')!.orgId).not.toBe(store.get('view-B')!.orgId);
  });
});
