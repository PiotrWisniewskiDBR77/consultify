// KONTRAKT DYŻURU 343 — każdy board-id ma własny lub jawnie zmapowany deskryptor.
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  INITIATIVE_BOARD_CANONICAL_ORDER,
  INITIATIVE_BOARD_DESCRIPTOR_BY_ID,
  INITIATIVE_CANONICAL_CARDS,
} from '../../../src/components/Initiatives/sections/initiativeCardContract';

const NEW_DESCRIPTOR_IDS = [
  'deliverables-milestones',
  'suggested-changes',
  'change-log',
  'okr',
  'hypothesis',
  'workstream-owners',
  'used-in',
  'artifacts',
  'lessons-learned',
] as const;

describe('DEC-388 — deskryptory 24 sekcji boardu Initiative', () => {
  it('każdy board-id wskazuje kompletny dwujęzyczny deskryptor', () => {
    for (const boardId of INITIATIVE_BOARD_CANONICAL_ORDER) {
      const descriptor = INITIATIVE_BOARD_DESCRIPTOR_BY_ID[boardId];
      expect(descriptor, `brak deskryptora boardu: ${boardId}`).toBeDefined();
      expect(descriptor.label.pl, `brak etykiety PL: ${boardId}`).toBeTruthy();
      expect(descriptor.label.en, `brak etykiety EN: ${boardId}`).toBeTruthy();
      expect(descriptor.kompozycja.length, `brak roli kompozycyjnej: ${boardId}`).toBeGreaterThan(
        0
      );
    }
    expect(Object.keys(INITIATIVE_BOARD_DESCRIPTOR_BY_ID)).toHaveLength(24);
  });

  it('dziewięć brakujących board-id ma własne, addytywne karty w katalogu', () => {
    const cardIds = INITIATIVE_CANONICAL_CARDS.map((card) => card.id);
    for (const id of NEW_DESCRIPTOR_IDS) {
      expect(cardIds, `brak nowej karty kanonicznej: ${id}`).toContain(id);
      expect(INITIATIVE_BOARD_DESCRIPTOR_BY_ID[id].id).toBe(id);
    }
    expect(INITIATIVE_CANONICAL_CARDS).toHaveLength(36);
  });

  it('etykiety nowych kart mają parytet istniejących kluczy i18n PL+EN', () => {
    const root = path.resolve(__dirname, '../../..');
    const pl = JSON.parse(
      fs.readFileSync(path.join(root, 'public/locales/pl/translation.json'), 'utf8')
    );
    const en = JSON.parse(
      fs.readFileSync(path.join(root, 'public/locales/en/translation.json'), 'utf8')
    );
    const keys = [
      'deliverablesMilestones',
      'suggestedChanges',
      'changeLog',
      'okr',
      'hypothesis',
      'workstreamOwners',
      'usedInBacklinks',
      'artifacts',
      'lessonsLearned',
    ];
    for (const key of keys) {
      expect(pl.initiatives[key], `brak initiatives.${key} w PL`).toBeTruthy();
      expect(en.initiatives[key], `brak initiatives.${key} w EN`).toBeTruthy();
    }
  });
});
