import { describe, expect, it } from 'vitest';

import { TASK_GENERATED_SECTION_PERSISTENCE } from '../taskGeneratedSectionPersistence';

describe('generated Task section persistence contract', () => {
  it('only promises Task Save persistence for fields present in the canonical payload', () => {
    expect(TASK_GENERATED_SECTION_PERSISTENCE).toEqual({
      'description-scope': 'task-save',
      checklist: 'task-save',
      evidence: 'local-only',
      dependencies: 'reference-only',
    });
  });
});
