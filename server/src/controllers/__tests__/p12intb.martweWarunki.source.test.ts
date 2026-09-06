/**
 * @vitest-environment node
 *
 * P12-int-b / DEC-424 — martwe warunki na starym słowniku (strażnik źródła).
 *
 * POMIAR (evidence/p12int/pomiar-resztek-slownika.txt, sekcja B): po migracji
 * `20262103_p12_initiative_status_slownik.sql` kolumna `initiatives.status`
 * trzyma tylko 7 kodów, a te warunki porównywały ją z kodami skasowanymi:
 *
 *   InitiativeController:769   'CANCELLED' / 'ARCHIVED'  -> zamknięte i odrzucone
 *                              inicjatywy dawało się EDYTOWAĆ (blokada nie działała)
 *   InitiativeController:2843  DELETABLE = {'DRAFT','CANCELLED'} -> odrzuconej NIE
 *                              dawało się skasować
 *   InitiativeController:5757/5767  readiness dla PENDING_REVIEW/REVIEW/PROMOTED/
 *                              PLANNING -> żaden warunek nie trafiał
 *   DecisionController:403     `status === 'BLOCKED'` -> kaskadowe odblokowanie po
 *                              rozstrzygnięciu decyzji-blokera NIGDY nie startowało
 *
 * Warunki są wplecione w 6-tysięczne handlery za bramkami RBAC i transakcjami,
 * więc — jak reszta rodziny strażników w tym repo — blokujemy je na źródle.
 *
 * MUTACJA (dowód): wpisanie z powrotem `currentStatus === 'CANCELLED'` (poz. 1),
 * `new Set(['DRAFT', 'CANCELLED'])` (poz. 2), listy `['PENDING_REVIEW', ...]`
 * (poz. 3) albo `!== 'BLOCKED'` w DecisionController (poz. 4) wywraca
 * odpowiedni przypadek.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { InitiativeStatus } from '../../constants/initiativeStatuses.js';

const initiatives = readFileSync(new URL('../InitiativeController.ts', import.meta.url), 'utf8');
const decisions = readFileSync(new URL('../DecisionController.ts', import.meta.url), 'utf8');

/** Kody, których po migracji nie ma w `initiatives.status`. */
const MARTWE = [
  'PENDING_REVIEW', 'REVIEW', 'PROMOTED', 'PLANNING', 'SCHEDULED',
  'EXECUTING', 'BLOCKED', 'DONE', 'TRACKING', 'ARCHIVED', 'CANCELLED',
] as const;

const blok = (source: string, od: string, doTekstu: string): string => {
  const start = source.indexOf(od);
  expect(start, `nie znaleziono kotwicy: ${od}`).toBeGreaterThan(-1);
  const end = source.indexOf(doTekstu, start);
  return source.slice(start, end === -1 ? source.length : end);
};

describe('DEC-424 — martwe warunki przepisane na słownik 7', () => {
  it('1) blokada edycji celuje w CLOSED/REJECTED, nie w CANCELLED/ARCHIVED', () => {
    const fragment = blok(initiatives, '// 2. DEC-424: statusy terminalne', '// 2.1');
    expect(fragment).toContain('InitiativeStatus.CLOSED');
    expect(fragment).toContain('InitiativeStatus.REJECTED');
    expect(fragment).not.toContain("currentStatus === 'CANCELLED'");
    expect(fragment).not.toContain("currentStatus === 'ARCHIVED'");
  });

  it('2) kasowanie dopuszcza DRAFT i REJECTED (dawniej DRAFT + martwe CANCELLED)', () => {
    const fragment = blok(initiatives, 'const DELETABLE_STATUSES', 'INITIATIVE_DELETE_INVALID_STATE');
    expect(fragment).toContain('InitiativeStatus.DRAFT');
    expect(fragment).toContain('InitiativeStatus.REJECTED');
    expect(fragment).not.toContain("'CANCELLED'");
    // status z bazy przechodzi przez normalizator SSOT, nie przez surowe toUpperCase
    expect(fragment).toContain('normalizeStatus(');
  });

  it('3) readiness pyta o PENDING_APPROVAL/APPROVED, bez martwej rodziny kodów', () => {
    const fragment = blok(initiatives, "// Readiness criteria for current stage", "if (isScheduledOnward(currentStatus))");
    for (const kod of MARTWE) {
      expect(fragment, `readiness nadal wymienia martwy kod ${kod}`).not.toContain(`'${kod}'`);
    }
    expect(fragment).toContain('InitiativeStatus.PENDING_APPROVAL');
    expect(fragment).toContain('InitiativeStatus.APPROVED');
  });

  it('4) kaskadowe odblokowanie czyta IN_EXECUTION + on_hold i woła operację na fladze', () => {
    const fragment = blok(decisions, 'const refreshInitiativeDecisionBlock', 'return;\n  }\n\n  logger.info');
    expect(fragment).toContain('SELECT status, on_hold FROM initiatives');
    expect(fragment).toContain('InitiativeStatus.IN_EXECUTION');
    expect(fragment).toContain("flagOperation: 'RESUME'");
    expect(fragment).not.toContain("!== 'BLOCKED'");
    expect(fragment).not.toContain("nextStatusInput: 'EXECUTING'");
    expect(fragment).not.toContain("expectedCurrentStatus: 'BLOCKED'");
  });

  it('5) słownik SSOT nadal ma dokładnie 7 kodów (baza pomiaru się nie rozjechała)', () => {
    expect(Object.values(InitiativeStatus)).toHaveLength(7);
  });
});
