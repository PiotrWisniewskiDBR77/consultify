import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  path.resolve(__dirname, '../../../src/components/Initiatives/InitiativesHub.tsx'),
  'utf8'
);

describe('InitiativesHub canonical intake navigation', () => {
  it('accepts and renders the governed candidates tab instead of normalizing its deep link to list', () => {
    const canonicalTabs = source.slice(
      source.indexOf('const CANONICAL_INITIATIVES_TABS'),
      source.indexOf('export const InitiativesHub')
    );
    expect(canonicalTabs).toContain("'candidates'");
    expect(source).toContain("id: 'candidates' as ModuleTab");
    expect(source).toContain("if (activeTab === 'candidates')");
    expect(source).toContain('<SourceProposalRegistrationSurface');
  });

  it('preserves the selected proposal in URL context and links a scheduled initiative to Execution', () => {
    expect(source).toContain("next.set('sourceProposalId', proposalId)");
    expect(source).toContain('onOpenExecution={(executionCaseId) =>');
    expect(source).toContain(
      'navigate(`/execution?tab=list&open=${encodeURIComponent(executionCaseId)}`)'
    );
  });
});
