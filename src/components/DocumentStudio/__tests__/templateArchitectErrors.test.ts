import { describe, expect, it } from 'vitest';

import { getTemplateStructureSaveErrorMessage } from '../DocumentStudioTemplateArchitectView';

describe('Document Template Architect save errors', () => {
  it('turns business-case domain codes into author instructions', () => {
    expect(
      getTemplateStructureSaveErrorMessage(
        new Error('business_case_scope_or_approach_required')
      )
    ).toBe('Add a Scope, Approach or Proposed Initiative section before saving.');
    expect(
      getTemplateStructureSaveErrorMessage(
        new Error('business_case_assumptions_or_scenarios_required')
      )
    ).toBe(
      'Add an Assumptions, Scenario, Sensitivity or Economic Analysis section before saving.'
    );
  });

  it('does not expose unknown server error text', () => {
    expect(getTemplateStructureSaveErrorMessage(new Error('db driver detail'))).toBe(
      'Failed to save structure.'
    );
  });
});
