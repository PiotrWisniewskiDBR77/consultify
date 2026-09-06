import { describe, expect, it } from 'vitest';
import { isTaskSectionVisible } from '../taskSectionVisibility';

const empty = {
  implementationIdeas: [], risks: [], alternatives: [], stakeholders: [], escalationRules: [],
};

describe('task — warunkowe sekcje DEC-411', () => {
  it('ukrywa Pomysły, Ryzyko i RACI bez trwałej treści', () => {
    expect(['implementation', 'risk-alternatives', 'governance'].filter((id) =>
      isTaskSectionVisible(id, empty)
    )).toEqual([]);
  });

  it.each([
    ['implementation', { implementationIdeas: [{}] }],
    ['risk-alternatives', { risks: [{}] }],
    ['risk-alternatives', { alternatives: [{}] }],
    ['governance', { stakeholders: [{}] }],
    ['governance', { escalationRules: [{}] }],
  ])('pokazuje %s, gdy rekord ma dane', (sectionId, patch) => {
    expect(isTaskSectionVisible(sectionId, { ...empty, ...patch })).toBe(true);
  });

  it('nie ukrywa bezwarunkowych sekcji kontraktu', () => {
    expect(isTaskSectionVisible('description-scope', empty)).toBe(true);
  });
});
