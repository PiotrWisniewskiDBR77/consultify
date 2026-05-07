import { describe, expect, it } from 'vitest';

import { buildPresentationRuntimeEventRecord } from '../presentationRuntimeTelemetryService.js';

describe('presentationRuntimeTelemetryService', () => {
  it('builds normalized runtime event record payload', () => {
    const row = buildPresentationRuntimeEventRecord({
      organizationId: 'org_1',
      deckId: 'deck_1',
      userId: 'usr_1',
      eventType: 'agent_edit_proposal_created',
      status: 'proposal',
      scope: 'section',
      metadata: { mutationKinds: ['content'], targetSlides: ['slide-2'] },
    });

    expect(row.id).toBeTypeOf('string');
    expect(row.id.length).toBeGreaterThan(8);
    expect(row.organizationId).toBe('org_1');
    expect(row.deckId).toBe('deck_1');
    expect(row.userId).toBe('usr_1');
    expect(row.eventType).toBe('agent_edit_proposal_created');
    expect(row.status).toBe('proposal');
    expect(row.scope).toBe('section');
    expect(JSON.parse(row.metadataJson)).toEqual({
      mutationKinds: ['content'],
      targetSlides: ['slide-2'],
    });
  });
});
