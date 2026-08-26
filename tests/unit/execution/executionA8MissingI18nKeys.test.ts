/**
 * DEC-120 A8 — 53 missing PL i18n keys were flagged for the Execution
 * module. Cross-checked against real usage (grep) before adding anything:
 *
 *  - execution.managementTable.* (6)  — live (ExecutionManagementTable.tsx)
 *  - manager.preview.* (3)            — live (Manager/ProblemPreview.tsx)
 *  - execution.budget.delete-prefixed keys + entryDeleted (4) — live (BudgetControlPanel.tsx)
 *  - execution.rollout.closure.resultsHandoff.body / .derivedNote (2) — live (RolloutTab.tsx)
 *  - capability./change./stakeholder. prefixed keys (~22-39 across the three)
 *    — DEAD: the only source using them, PeopleChangeWorkspace.tsx, was
 *    removed in the same batch (A7) as confirmed dead code. Skipped per the
 *    brief's own rule ("jeśli komponent martwy, klucze pomiń i odnotuj").
 *  - execution.delivery.* (13) — DEAD: the only source, ExecutionDeliveryClosurePanel.tsx,
 *    was removed in A7. Skipped for the same reason.
 *
 * This test locks both halves of that decision: the 15 keys that were
 * genuinely live got added (PL non-empty, EN parity), and the two dead
 * prefixes stay absent from both the source tree and the translation files
 * (so nobody re-adds unused strings for code that no longer exists).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const pl = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'public/locales/pl/translation.json'), 'utf8')
);
const en = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'public/locales/en/translation.json'), 'utf8')
);

function get(obj: unknown, dottedPath: string): unknown {
  return dottedPath.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

const LIVE_KEYS = [
  'execution.managementTable.lane',
  'execution.managementTable.total',
  'execution.managementTable.critical',
  'execution.managementTable.warning',
  'execution.managementTable.openLane',
  'execution.managementTable.emptyTitle',
  'manager.preview.sourceEntity',
  'manager.preview.details',
  'manager.preview.affected',
  'execution.budget.deleteConfirm',
  'execution.budget.deleteEntry',
  'execution.budget.deleteFailed',
  'execution.budget.entryDeleted',
  'execution.rollout.closure.resultsHandoff.body',
  'execution.rollout.closure.derivedNote',
];

describe('DEC-120 A8 — Execution i18n coverage for confirmed-live keys', () => {
  it.each(LIVE_KEYS)('PL has a non-empty translation for %s', (key) => {
    const value = get(pl, key);
    expect(typeof value).toBe('string');
    expect((value as string).length).toBeGreaterThan(0);
  });

  it.each(LIVE_KEYS)('EN has a non-empty translation for %s', (key) => {
    const value = get(en, key);
    expect(typeof value).toBe('string');
    expect((value as string).length).toBeGreaterThan(0);
  });
});

describe('DEC-120 A8 — dead-component key prefixes intentionally skipped', () => {
  const executionSrcFiles = fs
    .readdirSync(path.resolve(process.cwd(), 'src/components/Execution'), { recursive: true })
    .filter((f): f is string => typeof f === 'string' && f.endsWith('.tsx'))
    .map((f) => fs.readFileSync(path.resolve(process.cwd(), 'src/components/Execution', f), 'utf8'))
    .join('\n');

  it('no live Execution source references capability./change./stakeholder. keys (PeopleChangeWorkspace removed in A7)', () => {
    expect(executionSrcFiles).not.toMatch(/t\(['"]capability\./);
    expect(executionSrcFiles).not.toMatch(/t\(['"]change\./);
    expect(executionSrcFiles).not.toMatch(/t\(['"]stakeholder\./);
  });

  it('no live Execution source references execution.delivery. keys (ExecutionDeliveryClosurePanel removed in A7)', () => {
    expect(executionSrcFiles).not.toMatch(/execution\.delivery\./);
  });
});
