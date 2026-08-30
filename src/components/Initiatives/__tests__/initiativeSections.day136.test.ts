import { describe, expect, it } from 'vitest';

import { getInitiativePersistedSectionKey } from '../InitiativeDocumentView';

describe('Day 136 initiative persisted section render contract', () => {
  it('binds all four persisted sections to reachable InitiativeDocumentView branches', () => {
    expect(getInitiativePersistedSectionKey('comments')).toBe('comments');
    expect(getInitiativePersistedSectionKey('attachments-links')).toBe('linkedItems');
    expect(getInitiativePersistedSectionKey('risk-raid')).toBe('raid');
    expect(getInitiativePersistedSectionKey('raci')).toBe('stakeholders');
    expect(getInitiativePersistedSectionKey('unknown')).toBeNull();
  });
});
