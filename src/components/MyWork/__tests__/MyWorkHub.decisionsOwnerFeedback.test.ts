import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.resolve(__dirname, '../MyWorkHub.tsx'), 'utf8');

describe('MyWorkHub Decisions owner feedback', () => {
  it('mounts the canonical decisions list without the retired queue stack', () => {
    expect(source).toContain('<DecisionsPanelContent');

    for (const retiredQueue of [
      'DefinitionRemediationQueue',
      'GateSignoffQueue',
      'DefinitionDecisionQueue',
      'AnalysisDecisionQueue',
      'PortfolioDecisionQueue',
      'AIAnalysisProposalReviewQueue',
      'ScheduleDecisionQueue',
      'HandoffAcceptanceQueue',
      'DeliveryResultsAcceptanceQueue',
      'EffectivenessClosureQueue',
      'ClosureDecisionQueue',
      'MaterialChangeQueue',
      'ExecutionCanonicalWorkQueue',
    ]) {
      expect(source).not.toContain(`<${retiredQueue}`);
      expect(source).not.toMatch(new RegExp(`import\\s+.*${retiredQueue}`));
    }
  });
});
