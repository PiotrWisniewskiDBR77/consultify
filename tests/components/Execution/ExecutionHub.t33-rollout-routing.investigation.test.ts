/**
 * R14 T33-TABLE-T14 — routing investigation (source-provable, no fix
 * applied). Documents what was verified and what was found, so the next
 * package doesn't have to re-derive it from scratch.
 *
 * Verified correct (not the bug): both the tab-click handler and the
 * `?tab=rollout` deep-link effect set `activeTab` to 'rollout' directly,
 * synchronously, with no intermediate 'summary' state.
 *
 * Real, source-provable finding (not fixed here — shared mechanism, out of
 * this package's bounded scope, would touch every tab's history behavior):
 * every tab/view/document change writes the URL via
 * `setSearchParams(next, { replace: true })` in both history-sync effects,
 * so the browser back/forward stack never gets a separate entry per tab —
 * back after clicking Rollout does not step back to the previously active
 * tab, it steps past all tab changes entirely.
 */
import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  path.resolve(__dirname, '../../../src/components/Execution/ExecutionHub.tsx'),
  'utf-8'
);

describe('R14 T33-TABLE-T14 investigation — ExecutionHub.tsx', () => {
  it('handleMainTabChange sets activeTab directly on click, no intermediate state', () => {
    const start = source.indexOf('const handleMainTabChange = useCallback((tab: ModuleTab) => {');
    expect(start).toBeGreaterThan(-1);
    const body = source.slice(start, start + 200);
    expect(body).toContain('setActiveTab(tab);');
  });

  it("the ?tab=rollout deep-link effect sets activeTab('rollout') directly, not via 'summary'", () => {
    const marker = source.indexOf('// Rollout consolidation: /rollout redirects to /execution?tab=rollout');
    expect(marker).toBeGreaterThan(-1);
    const body = source.slice(marker, marker + 200);
    expect(body).toContain("setActiveTab('rollout' as ModuleTab);");
    expect(body).not.toContain("setActiveTab('summary'");
  });

  it('KNOWN OPEN FINDING: both history-sync effects use replace:true, so tab changes do not push separate browser-history entries (shared across every tab, not rollout-specific — not fixed in R14)', () => {
    const occurrences = source.match(/setSearchParams\(next, \{ replace: true \}\);/g) ?? [];
    expect(occurrences.length).toBe(2);
  });
});
