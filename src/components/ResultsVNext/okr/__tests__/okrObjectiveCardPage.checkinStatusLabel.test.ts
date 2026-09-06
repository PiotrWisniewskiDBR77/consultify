import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { OKR_CHECKIN_STATUS_TONE, okrCheckInStatusLabel } from '../okrCheckInMappers';
import type { OkrCheckInStatus } from '../okrCheckInApi';

/**
 * BLOKER audytu evidence/audyt-mvp-20260906/B3/RAPORT_B3.md (defekt #3):
 * `OkrObjectiveCardPage.tsx` sekcja "Check-iny" (L3) renderowała
 * `<StatusChip label={entry.ownerDeclaredStatus} tone="neutral" />` —
 * surowy enum `on_track`/`at_risk` WPROST jako tekst chipa, mimo że
 * dokładnie ta sama wartość jest poprawnie humanizowana przez
 * `okrCheckInStatusLabel()` gdzie indziej na tej samej stronie
 * (`okrCheckInPresenters.tsx:76`, lista check-inów w L2).
 *
 * Naprawa: `OkrObjectiveCardPage.tsx:815-820` woła teraz
 * `okrCheckInStatusLabel(entry.ownerDeclaredStatus, isPolish)` +
 * `OKR_CHECKIN_STATUS_TONE[entry.ownerDeclaredStatus]` — identyczny wzorzec
 * co `okrCheckInPresenters.tsx`.
 *
 * Ten test pilnuje DWÓCH rzeczy:
 *  1) statyczna asercja na źródle — call site w OkrObjectiveCardPage.tsx
 *     NIE przekazuje surowego `entry.ownerDeclaredStatus` jako `label`, tylko
 *     przez `okrCheckInStatusLabel(...)` (mutacja: przywróć
 *     `label={entry.ownerDeclaredStatus}` → test czerwony);
 *  2) mapper nigdy nie zwraca surowego enumu dla żadnego znanego stanu i
 *     `OKR_CHECKIN_STATUS_TONE` pokrywa każdy stan (fallback „Nieznany stan"
 *     nie jest potrzebny, bo domena jest zamkniętym wyliczeniem — patrz
 *     `okrCheckInMappers.ts`).
 */

const ALL_STATUSES: OkrCheckInStatus[] = [
  'not_started',
  'on_track',
  'at_risk',
  'off_track',
  'achieved',
  'not_achieved',
  'cancelled',
];

describe('OKR Check-iny (L3) — status check-inu bez surowego enumu', () => {
  it('okrCheckInStatusLabel nigdy nie zwraca surowej wartości technicznej (PL)', () => {
    for (const status of ALL_STATUSES) {
      const label = okrCheckInStatusLabel(status, true);
      expect(label).not.toBe(status);
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it('on_track → "Zgodnie z planem", at_risk → "Zagrożony" (PL) — te same etykiety co L2', () => {
    expect(okrCheckInStatusLabel('on_track', true)).toBe('Zgodnie z planem');
    expect(okrCheckInStatusLabel('at_risk', true)).toBe('Zagrożony');
  });

  it('OKR_CHECKIN_STATUS_TONE pokrywa każdy znany stan check-inu', () => {
    for (const status of ALL_STATUSES) {
      expect(OKR_CHECKIN_STATUS_TONE[status]).toEqual(expect.any(String));
    }
  });

  it('OkrObjectiveCardPage.tsx — sekcja Check-iny NIE renderuje surowego entry.ownerDeclaredStatus', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/components/ResultsVNext/okr/OkrObjectiveCardPage.tsx'),
      'utf8'
    );

    // Mutacja regresji: label={entry.ownerDeclaredStatus} bez humanizacji.
    expect(source).not.toMatch(/label=\{entry\.ownerDeclaredStatus\}/);

    // Naprawa musi wołać dokładnie ten mapper, z tym samym argumentem co L2.
    expect(source).toMatch(/okrCheckInStatusLabel\(entry\.ownerDeclaredStatus,\s*isPolish\)/);
    expect(source).toMatch(/OKR_CHECKIN_STATUS_TONE\[entry\.ownerDeclaredStatus\]/);
  });
});
