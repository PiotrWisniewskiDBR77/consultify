import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { NOTIFICATION_CARD_RENDER_IDS, NOTIFICATION_CARD_SPEC } from '../../../src/components/MyWork/notificationCardContract';

describe('DEC-387 — kontrakt karty Notification zachowuje komplet sekcji', () => {
  it('M1: katalog pokrywa wszystkie renderowane sekcje', () => expect(NOTIFICATION_CARD_SPEC.catalog.map((c) => c.id).sort()).toEqual([...NOTIFICATION_CARD_RENDER_IDS].sort()));
  it('M2: domyślny zestaw jest permutacją renderowanych sekcji', () => expect([...NOTIFICATION_CARD_SPEC.sets[0].cards].sort()).toEqual([...NOTIFICATION_CARD_RENDER_IDS].sort()));
  it('M3: domyślny zestaw nie ma duplikatów', () => expect(new Set(NOTIFICATION_CARD_SPEC.sets[0].cards).size).toBe(NOTIFICATION_CARD_SPEC.sets[0].cards.length));
  it('M4: realny widok używa kontraktu w useCardLayout', () => expect(fs.readFileSync(path.resolve(__dirname, '../../../src/components/MyWork/NotificationDetailView.tsx'), 'utf8')).toMatch(/spec: NOTIFICATION_CARD_SPEC/));
});
