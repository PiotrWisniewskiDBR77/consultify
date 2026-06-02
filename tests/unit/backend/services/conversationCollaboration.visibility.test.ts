import { describe, expect, it } from 'vitest';

import { conversationCollaborationService } from '../../../../server/src/services/ai/conversationCollaborationService.js';

describe('conversationCollaborationService.getVisibilityFilter', () => {
  it('returns owner visibility contract', () => {
    expect(conversationCollaborationService.getVisibilityFilter('owner')).toEqual({
      includeSystemContext: true,
      includeToolCalls: true,
      includeDebugInfo: true,
    });
  });

  it('returns editor visibility contract', () => {
    expect(conversationCollaborationService.getVisibilityFilter('editor')).toEqual({
      includeSystemContext: false,
      includeToolCalls: true,
      includeDebugInfo: false,
    });
  });

  it('returns viewer visibility contract', () => {
    expect(conversationCollaborationService.getVisibilityFilter('viewer')).toEqual({
      includeSystemContext: false,
      includeToolCalls: false,
      includeDebugInfo: false,
    });
  });
});
