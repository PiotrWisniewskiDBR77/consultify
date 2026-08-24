import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  path.resolve(__dirname, '../../../src/components/Initiatives/InitiativesHub.tsx'),
  'utf8'
);

describe('InitiativesHub canonical intake navigation', () => {
  it('keeps the owner-approved three-tab information architecture', () => {
    const canonicalTabs = source.slice(
      source.indexOf('const CANONICAL_INITIATIVES_TABS'),
      source.indexOf('export const InitiativesHub')
    );
    expect(canonicalTabs).toContain("['list', 'plan', 'capacity']");
    expect(canonicalTabs).not.toContain("'candidates'");
    expect(canonicalTabs).not.toContain("'portfolio'");
  });

  it('preserves the selected proposal in URL context and links a scheduled initiative to Execution', () => {
    expect(source).toContain("next.set('sourceProposalId', proposalId)");
    expect(source).toContain('onOpenExecution={(executionCaseId, initiativeId) =>');
    expect(source).toContain(
      '`/execution?tab=list&mode=initiative&open=${encodeURIComponent(initiativeId)}&executionCaseId=${encodeURIComponent(executionCaseId)}`'
    );
  });
});
