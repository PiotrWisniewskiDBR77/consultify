/**
 * @vitest-environment node
 *
 * [ODMROZENIE 05_INITIATIVES DEC-607] H1c (Wpis 97, wiersz 53) — helper fazy
 * `phaseLabelKeyForStatus` / `phaseForStatus`.
 *
 * DEFECT: pill „Faza" w karcie inicjatywy spadał na NAZWĘ MODUŁU
 * (`getModuleFromStatus` → `MODULE_CONFIG.label`), a modułem domyślnym dla
 * PROPOSED/DRAFT/PENDING_APPROVAL/REJECTED jest TOOLS → użytkownik widział
 * „Tools" zamiast fazy. Faza to osobne pojęcie: 7 statusów → 6 faz.
 *
 * KONTRAKT testowany poniżej:
 *   - każdy z 7 statusów InitiativeStatus mapuje na fazę i klucz i18n,
 *   - klucz resolves na etykietę fazy z PRAWDZIWEGO słownika EN
 *     (`initiatives.phaseLabel.*`) — NIE nazwę modułu,
 *   - dla PROPOSED/DRAFT/PENDING_APPROVAL/REJECTED etykieta ≠ „Tools"
 *     (dokładnie te statusy, które wcześniej pokazywały moduł).
 *
 * MUTACJA: usunięcie `phaseLabel.*` ze słownika albo zmiana mapowania tak, by
 * klucz nie resolvesował, da surowy klucz / pustkę → asercje „≠ Tools" i
 * „rozwiązana etykieta" czerwone.
 */
import { describe, expect, it } from 'vitest';

import { InitiativeStatus } from '../../../packages/shared/src/constants/initiativeStatuses.generated';
import en from '../../../public/locales/en/translation.json';
import { phaseForStatus, phaseLabelKeyForStatus } from '../initiativeLifecycle';

/** Minimalny `t` rozwiązujący klucz kropkowy z prawdziwego słownika EN. */
const tEn = (key: string): string =>
  key.split('.').reduce<unknown>((acc, part) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined), en) as string;

const ALL_STATUSES = [
  InitiativeStatus.PROPOSED,
  InitiativeStatus.DRAFT,
  InitiativeStatus.PENDING_APPROVAL,
  InitiativeStatus.APPROVED,
  InitiativeStatus.IN_EXECUTION,
  InitiativeStatus.CLOSED,
  InitiativeStatus.REJECTED,
] as const;

/** Statusy, których modułem domyślnym jest TOOLS — czyli te, które wcześniej pokazywały „Tools". */
const TOOLS_MODULE_STATUSES = [
  InitiativeStatus.PROPOSED,
  InitiativeStatus.DRAFT,
  InitiativeStatus.PENDING_APPROVAL,
  InitiativeStatus.REJECTED,
] as const;

const EXPECTED_PHASE: Record<string, string> = {
  PROPOSED: 'discovery',
  DRAFT: 'discovery',
  PENDING_APPROVAL: 'approval',
  APPROVED: 'planning',
  IN_EXECUTION: 'execution',
  CLOSED: 'benefits',
  REJECTED: 'rejected',
};

const EXPECTED_EN_LABEL: Record<string, string> = {
  discovery: 'Discovery',
  approval: 'Approval',
  planning: 'Planning',
  execution: 'Execution',
  benefits: 'Benefits',
  rejected: 'Rejected',
};

describe('H1c — phaseForStatus / phaseLabelKeyForStatus (7 statusów → 6 faz)', () => {
  it('każdy z 7 statusów mapuje na oczekiwaną fazę', () => {
    for (const status of ALL_STATUSES) {
      expect(phaseForStatus(status)).toBe(EXPECTED_PHASE[status]);
    }
  });

  it('każdy status daje klucz initiatives.phaseLabel.<faza>', () => {
    for (const status of ALL_STATUSES) {
      expect(phaseLabelKeyForStatus(status)).toBe(`initiatives.phaseLabel.${EXPECTED_PHASE[status]}`);
    }
  });

  it('klucz rozwiązuje się na etykietę fazy z prawdziwego słownika EN (nie surowy klucz, nie puste)', () => {
    for (const status of ALL_STATUSES) {
      const label = tEn(phaseLabelKeyForStatus(status));
      expect(label).toBe(EXPECTED_EN_LABEL[EXPECTED_PHASE[status]]);
      expect(label).not.toBe(phaseLabelKeyForStatus(status)); // rozwiązał się, nie spadł na klucz
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it('TOOLS-modułowe statusy (PROPOSED/DRAFT/PENDING_APPROVAL/REJECTED) NIE pokazują już „Tools"', () => {
    for (const status of TOOLS_MODULE_STATUSES) {
      const label = tEn(phaseLabelKeyForStatus(status));
      expect(label).not.toBe('Tools');
      expect(label.toLowerCase()).not.toContain('tools');
    }
  });

  it('PROPOSED → „Discovery" (dokładny przypadek ze zrzutu dowodowego)', () => {
    expect(phaseForStatus(InitiativeStatus.PROPOSED)).toBe('discovery');
    expect(tEn(phaseLabelKeyForStatus(InitiativeStatus.PROPOSED))).toBe('Discovery');
  });
});
