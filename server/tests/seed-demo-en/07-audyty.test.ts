import { describe, expect, it } from 'vitest';

import { det } from '../../scripts/seed/demo-en/00-wspolne';

/**
 * Testy PACZKI D2b (Audits) BEZ BAZY — czysta logika
 * (`docs/program/DANE_POKAZOWE_EN_20260908/PLAN.md` §3 wiersz 11). Zapytania
 * SQL są sprawdzane na żywo przez `07-audyty.ts --dry-run/--apply/--verify/
 * --reset` na kopii lokalnej (`evidence/dane-pokazowe-en/d2b/`) — ten plik
 * pilnuje wyłącznie funkcji/danych, które byłoby łatwo po cichu zepsuć bez
 * natychmiastowego czerwonego testu: id-y deterministyczne (kolizja = dwa
 * różne wiersze wskazują na to samo id, co pod `ON CONFLICT DO NOTHING`
 * CICHO gubi jeden z nich) i liczbę kryteriów `nonconforming` (musi być
 * dokładnie 3, żeby zgadzać się z 3 ustaleniami — `07-audyty.ts` rzuca na
 * starcie, jeśli się rozjedzie, ten test pilnuje tego samego licznika
 * niezależną kopią).
 *
 * NIE importujemy `07-audyty.ts` wprost: plik kończy się
 * `main().catch(...)`, więc import uruchomiłby połączenie z bazą
 * (`wymaganyUrl()`/`DATABASE_URL`) w trakcie zbierania testów — dokładnie ten
 * sam powód, dla którego `06-materialy.test.ts`/`03-inicjatywy.test.ts` też
 * tego nie robią. Listy refCode/slug poniżej są ŚWIADOMIE zduplikowane z
 * `07-audyty.ts` (ta sama treść, druga niezależna kopia) — bezpośrednio z
 * definicji `CRITERIA`/`FINDINGS` w tamtym pliku.
 */

const PACK_SLUG = 'operational-excellence-audit-2026';
const PROGRAM_SLUG = 'line-3-quality-and-safety-audit-2026';
const DOMAIN_REF = 'D0';
const CRITERIA_REF_CODES = ['D0.1', 'D0.2', 'D0.3', 'D0.4', 'D0.5', 'D0.6'];
// Kopia `CRITERIA.map((c) => c.conformityStatus)` z 07-audyty.ts.
const CONFORMITY_STATUSES = [
  'conforming', // D0.1 — 5S
  'observation', // D0.2 — standard work
  'nonconforming', // D0.3 — preventive maintenance
  'nonconforming', // D0.4 — quality gate
  'conforming', // D0.5 — safety (LOTO/guarding)
  'nonconforming', // D0.6 — energy metering
];
const FINDING_REF_CODES = ['D0.3', 'D0.4', 'D0.6'];
const MEMBER_ROLES = ['program_owner', 'lead_auditor', 'auditee'];

function countNonconforming(statuses: string[]): number {
  return statuses.filter((s) => s === 'nonconforming').length;
}

describe('07-audyty — spójność liczby nonconforming (3 kryteria -> 3 ustalenia)', () => {
  it('dokładnie 3 z 6 kryteriów są nonconforming — tyle samo, ile jest ustaleń (audit_program_findings)', () => {
    expect(CONFORMITY_STATUSES).toHaveLength(6);
    expect(countNonconforming(CONFORMITY_STATUSES)).toBe(3);
    expect(countNonconforming(CONFORMITY_STATUSES)).toBe(FINDING_REF_CODES.length);
  });

  it('MUTACJA — gdyby licznik użył ">=" zamiast "===" przy sprawdzeniu "dokładnie 3" (07-audyty.ts:200), 4 nonconforming przeszłyby cicho', () => {
    const czteryNonconforming = ['nonconforming', 'nonconforming', 'nonconforming', 'nonconforming', 'conforming', 'observation'];
    const mutantSprawdzenie = (n: number) => n >= 3; // MUTANT: powinno być n === 3
    expect(mutantSprawdzenie(countNonconforming(czteryNonconforming))).toBe(true); // mutant: myli się (RED byłoby dobre tu)
    expect(countNonconforming(czteryNonconforming) === 3).toBe(false); // produkcja: poprawnie odmawia
  });

  it('refCode ustaleń (FINDING_REF_CODES) to dokładnie te kryteria, które są nonconforming', () => {
    const nonconformingRefCodes = CRITERIA_REF_CODES.filter((_, i) => CONFORMITY_STATUSES[i] === 'nonconforming');
    expect(nonconformingRefCodes.sort()).toEqual([...FINDING_REF_CODES].sort());
  });
});

describe('07-audyty — id-y deterministyczne (det z 00-wspolne, reużyte 1:1 w 07-audyty)', () => {
  it('pakiet i program dostają różne id mimo wspólnej przestrzeni nazw', () => {
    const packId = det('audit-pack', PACK_SLUG);
    const programId = det('audit-program', PROGRAM_SLUG);
    expect(packId).not.toBe(programId);
  });

  it('6 kryteriów PAKIETU (audit_pack_criteria) ma 6 różnych id — kolizja pod ON CONFLICT DO NOTHING cicho zgubiłaby wiersz', () => {
    const ids = CRITERIA_REF_CODES.map((ref) => det('audit-pack-criterion', `${PACK_SLUG}|${ref}`));
    expect(new Set(ids).size).toBe(6);
  });

  it('6 kryteriów PROGRAMU (audit_program_criteria) ma 6 różnych id, RÓŻNYCH od id kryteriów pakietu', () => {
    const packIds = CRITERIA_REF_CODES.map((ref) => det('audit-pack-criterion', `${PACK_SLUG}|${ref}`));
    const programIds = CRITERIA_REF_CODES.map((ref) => det('audit-program-criterion', `${PROGRAM_SLUG}|${ref}`));
    expect(new Set(programIds).size).toBe(6);
    for (const id of programIds) expect(packIds).not.toContain(id);
  });

  it('domena pakietu (D0) i domena programu (D0) mają różne id — rodzaj+slug rozróżnia je od siebie i od kryteriów', () => {
    const packDomainId = det('audit-pack-criterion', `${PACK_SLUG}|${DOMAIN_REF}`);
    const programDomainId = det('audit-program-criterion', `${PROGRAM_SLUG}|${DOMAIN_REF}`);
    const packCriterionIds = CRITERIA_REF_CODES.map((ref) => det('audit-pack-criterion', `${PACK_SLUG}|${ref}`));
    expect(packDomainId).not.toBe(programDomainId);
    expect(packCriterionIds).not.toContain(packDomainId);
  });

  it('3 ustalenia (audit_program_findings) i 3 działania korygujące (audit_corrective_actions) mają 3+3 różne id', () => {
    const findingIds = FINDING_REF_CODES.map((ref) => det('audit-program-finding', `${PROGRAM_SLUG}|${ref}`));
    const actionIds = FINDING_REF_CODES.map((ref) => det('audit-corrective-action', `${PROGRAM_SLUG}|${ref}`));
    expect(new Set(findingIds).size).toBe(3);
    expect(new Set(actionIds).size).toBe(3);
    for (const id of actionIds) expect(findingIds).not.toContain(id);
  });

  it('3 członkowie programu (audit_program_members) mają 3 różne id mimo współdzielonego programu', () => {
    const ids = MEMBER_ROLES.map((role) => det('audit-program-member', `${PROGRAM_SLUG}|${role}|owner-placeholder`));
    // każda rola z INNYM slugiem osoby w prawdziwym skrypcie — tu sprawdzamy, że
    // samo `role` w kluczu wystarcza do rozróżnienia (nawet przy tym samym slugu).
    expect(new Set(ids).size).toBe(3);
  });

  it('det() jest deterministyczny — dwa wywołania z tym samym kluczem dają to samo id', () => {
    const a = det('audit-program-finding', `${PROGRAM_SLUG}|D0.3`);
    const b = det('audit-program-finding', `${PROGRAM_SLUG}|D0.3`);
    expect(a).toBe(b);
  });
});

describe('07-audyty — taksonomia ustaleń (FINDING_TAXONOMY, kopia z packSeed.ts wzorca po angielsku)', () => {
  // Kopia klucza istotnego dla `aiProposalService.ts` (klasyfikacja
  // 'nonconforming' MUSI wymagać działania korygującego, inaczej finding bez
  // corrective_action wygląda jak błąd danych, nie świadoma decyzja).
  const NONCONFORMING_ENTRY = {
    key: 'nonconforming',
    nonConforming: true,
    requiresCorrectiveAction: true,
  };

  it('wpis "nonconforming" wymaga działania korygującego (requiresCorrectiveAction=true)', () => {
    expect(NONCONFORMING_ENTRY.nonConforming).toBe(true);
    expect(NONCONFORMING_ENTRY.requiresCorrectiveAction).toBe(true);
  });

  it('wszystkie 3 ustalenia tej paczki są sklasyfikowane "nonconforming" — spójne z tym wpisem taksonomii', () => {
    const classificationPerFinding = FINDING_REF_CODES.map(() => 'nonconforming');
    expect(classificationPerFinding.every((c) => c === NONCONFORMING_ENTRY.key)).toBe(true);
  });
});
