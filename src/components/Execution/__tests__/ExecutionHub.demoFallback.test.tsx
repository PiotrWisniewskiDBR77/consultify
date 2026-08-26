/**
 * @vitest-environment node
 *
 * DEC-120 A10 — in demo mode, a failed real-data load silently substituted
 * demo rows AND cleared initiativesLoadError, so a real backend failure
 * rendered identically to a healthy load. Demo rows also mixed into the
 * real list (the happy-path "review" rows) with no visible marker.
 *
 * ExecutionHub is too heavy to mount in a unit test (see the sibling
 * ExecutionHub.reportingMenu.smoke.test.tsx / ExecutionHub.entityLookup.test.tsx
 * for the same source-regression approach), so this locks the fix at the
 * source level.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const executionHubSource = readFileSync(new URL('../ExecutionHub.tsx', import.meta.url), 'utf8');

describe('ExecutionHub demo-fallback honesty (DEC-120 A10)', () => {
  it('never silently clears the load error when substituting demo data after a failure', () => {
    const start = executionHubSource.indexOf('const loadInitiatives = async () => {');
    const end = executionHubSource.indexOf('loadInitiatives();', start);
    const fn = executionHubSource.slice(start, end);
    const catchStart = fn.indexOf('} catch (err: any) {');
    const catchBody = fn.slice(catchStart);

    // The old bug: `setInitiativesLoadError(null); setInitiativesLoadErrorCode(null); return;`
    // inside the demo branch, right after substituting fallback data.
    expect(catchBody).not.toMatch(
      /setInitiativesLoadError\(null\);\s*setInitiativesLoadErrorCode\(null\);\s*return;/
    );

    // A visible, persistent flag now replaces that silent clear.
    expect(catchBody).toContain('setDemoFallbackActive(true)');
  });

  it('tags every demo-derived initiative row with isDemoSample', () => {
    const start = executionHubSource.indexOf('const loadInitiatives = async () => {');
    const end = executionHubSource.indexOf('loadInitiatives();', start);
    const fn = executionHubSource.slice(start, end);

    // Both the happy-path "review" rows (demo mixed with real) and the
    // failure-path fallback rows must be tagged.
    expect(fn.match(/isDemoSample: true/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('resets the stale banner once a real load succeeds', () => {
    const start = executionHubSource.indexOf('const loadInitiatives = async () => {');
    const successEnd = executionHubSource.indexOf('} catch (err: any) {', start);
    const successBody = executionHubSource.slice(start, successEnd);
    expect(successBody).toContain('setDemoFallbackActive(false)');
  });

  it('renders a visible "Sample" badge on the initiative-name cell for demo rows', () => {
    const nameColumnStart = executionHubSource.indexOf("id: 'name',");
    const nameColumnEnd = executionHubSource.indexOf("id: 'type',", nameColumnStart);
    const nameColumn = executionHubSource.slice(nameColumnStart, nameColumnEnd);
    expect(nameColumn).toContain('isDemoSample');
    expect(nameColumn).toContain('execution.table.demoSampleBadge');
  });

  it('shows a dedicated banner (not the full-page error blocker) while demo fallback is active', () => {
    expect(executionHubSource).toContain('data-testid="demo-fallback-banner"');
    expect(executionHubSource).toContain('execution.hub.demoFallback.title');
  });
});
