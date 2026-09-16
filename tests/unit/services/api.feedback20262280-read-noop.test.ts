// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import {
  normalizeIdeaDisplayFields,
  normalizeInitiativeDisplayFields,
} from '@/services/api';

describe('FEEDBACK-1 20262280 read-side compatibility decoder', () => {
  it('is a no-op for already repaired idea and initiative display fields', () => {
    const idea = {
      id: 'idea-1',
      title: 'R&D "yes"',
      body: "Owner's `draft` & review",
      description: 'Keep <safe> as plain user text',
    };
    const initiative = {
      id: 'initiative-1',
      name: 'R&D "yes"',
      title: "Owner's `draft`",
      description: 'Keep <safe> as plain user text',
      summary: 'Plain & useful',
    };
    expect(normalizeIdeaDisplayFields(structuredClone(idea))).toEqual(idea);
    expect(normalizeInitiativeDisplayFields(structuredClone(initiative))).toEqual(initiative);
  });
});
