import { describe, expect, it } from 'vitest';

import { DRD_STRUCTURE, getLocalizedDRDLevel } from '../drdStructure';

const visiblePolish = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]|\b(?:brak|wdrażanie|szkolenia|wspierający|zagrożeń|dostęp)\b/i;

describe('M6 — DRD mixed-source corpus locale projection', () => {
  const translatedLevels = DRD_STRUCTURE.flatMap((axis) => axis.areas)
    .flatMap((area) => area.levels)
    .filter((level) => level.titleEN || level.descriptionEN);

  it('renders every translated axis 5/6 level in English for an EN viewer', () => {
    expect(translatedLevels.length).toBe(60);
    for (const level of translatedLevels) {
      const rendered = getLocalizedDRDLevel(level, 'en');
      expect(`${rendered.title} ${rendered.description}`).not.toMatch(visiblePolish);
    }
  });

  it('preserves the owner-authored Polish source for a PL viewer', () => {
    for (const level of translatedLevels) {
      expect(getLocalizedDRDLevel(level, 'pl')).toEqual({
        title: level.title,
        description: level.description,
      });
    }
  });
});
