/**
 * [ODMROZENIE 06_EXECUTION DEC-397] executionTypeLabels — TYP column,
 * Execution (`ExecutionHub.tsx`).
 *
 * NAPRAWA (audyt MVP 06.09, evidence/audyt-mvp-20260906/A2/RAPORT_A2.md
 * poz. 7.2, BLOKER): `getTypeCode()` w `ExecutionHub.tsx` renderowała
 * surowy 3-literowy kod wewnętrzny ("EXE"/"PRC"/"DIG"/"MDL"/"DAT"/"CUL"/
 * "SEC") wprost w UI, na KAŻDYM widocznym wierszu (zmierzone na żywo: 0/13
 * wierszy trafiało w mapę enum-podobnych kluczy `PROCESSES`/`DIGITAL`/…,
 * bo realne dane `initiative.axis` z `/api/initiatives` to czytelne frazy
 * — "Digital Processes", "Cybersecurity", "Digital Products",
 * "AI Maturity", "Data Management", "Culture of Transformation" —
 * niepasujące do żadnego z tych kluczy, więc WSZYSTKIE wiersze spadały do
 * fallbacku `'EXE'`).
 *
 * Ten sam pomysł kategoryzacji (7 osi transformacji: Procesy/Cyfrowe
 * Produkty/Modele Biznesowe/Dane/Kultura/Cyberbezpieczeństwo/AI) już
 * istnieje gdzie indziej jako `AXIS_LABELS` (camelCase klucze:
 * `processes`/`digitalProducts`/`businessModels`/`dataManagement`/
 * `culture`/`cybersecurity`/`aiMaturity`) w
 * `src/components/assessment/ReportEditor.tsx` i
 * `src/components/assessment/modals/InitiativeDetailsModal.tsx` — ale
 * NAWET te dwa miejsca nie złapałyby realnych wartości z bazy (inna
 * wielkość liter/spacje), więc kopiowanie ich 1:1 nie naprawiłoby
 * problemu. Zamiast więc szukać dokładnego dopasowania klucza,
 * `normalizeAxisKey` dopasowuje po SŁOWIE KLUCZOWYM (case-insensitive)
 * — to samo podejście, ale odporne na realny kształt danych. Test
 * `__tests__/executionTypeLabels.test.ts` przypina wszystkie 6 realnych
 * wartości zmierzonych na żywym stanowisku (patrz `curl
 * /api/initiatives` w raporcie naprawy).
 *
 * NAPRAWA #2 (audyt MVP 06.09, evidence/audyt-mvp-20260906/A3/RAPORT_A3.md,
 * WAŻNY #2): powyższa naprawa usunęła surowy kod, ale ~90% wierszy dalej
 * pokazywało „Nieznany typ" — zmierzone wprost na żywej bazie
 * (`select axis, count(*) from initiatives … group by axis`, stanowisko
 * lokalne, org DBR77, 71 wierszy):
 *
 *   axis=NULL                     48   (67,6%) — BRAK DANYCH, nie „nieznana wartość"
 *   axis='transformational'       13   (18,3%) — WALIDOWANA wartość enuma
 *                                                `InitiativeAxisEnum`
 *                                                (server/src/validators/
 *                                                initiative.validators.ts:24-29,
 *                                                `['strategic','operational',
 *                                                'transformational','compliance']`)
 *                                                — inna, RÓWNIE REALNA oś
 *                                                (charakter inicjatywy), nie
 *                                                jedna z 7 osi transformacji DRD
 *   'Digital Processes' i 5 innych 10  (14,1%) — już rozpoznawane
 *
 * Dwie osobne przyczyny, dwie osobne naprawy:
 *   (a) `axis === null` renderowało się jako tekst „Nieznany typ" — od teraz
 *       osobny, uczciwy stan „—" (BRAK POMIARU ≠ NIEROZPOZNANA WARTOŚĆ, patrz
 *       CLAUDE.md/pamięć nadzorcy „Brak pomiaru nie jest wynikiem"). Warunek
 *       sprawdza pusty/`null`/`undefined` PRZED próbą dopasowania słownika —
 *       nigdy nie zgaduje.
 *   (b) `'transformational'` (i siostrzane `strategic`/`operational`/
 *       `compliance` z TEGO SAMEGO zwalidowanego enuma — nie zgadywane,
 *       potwierdzone w `initiative.validators.ts`) dostają realne polskie
 *       etykiety zamiast wpadać do „Nieznany typ" tylko dlatego, że nie
 *       pasują do słownika 7 osi DRD — to legalna, inna oś tego samego pola.
 *
 * Po obu naprawach na żywej bazie: 23/71 (32%) rozpoznane etykiety, 48/71
 * (68%) „—" (brak `axis` w danych demo — dane, nie kod; `docs/program/
 * ODBIOR_CTO_20260905` zna ten dług), 0 „Nieznany typ" — bo każda REALNA,
 * niepusta wartość `axis` na stanowisku jest dziś rozpoznana. ≤10% „—"
 * z instrukcji zlecenia nie jest osiągalne bez wymyślania osi — 68%
 * inicjatyw demo naprawdę nie ma `axis` w bazie (sprawdzone SQL-em, nie
 * kodem) — patrz raport tego dyżuru.
 */

export const EXECUTION_TYPE_LABELS = {
  PROCESSES: { pl: 'Procesy', en: 'Processes' },
  DIGITAL: { pl: 'Cyfryzacja', en: 'Digital' },
  MODELS: { pl: 'Modele biznesowe', en: 'Business models' },
  DATA: { pl: 'Dane', en: 'Data' },
  CULTURE: { pl: 'Kultura', en: 'Culture' },
  CYBERSECURITY: { pl: 'Cyberbezpieczeństwo', en: 'Cybersecurity' },
  AI: { pl: 'AI', en: 'AI' },
  // Druga, RÓWNIE REALNA oś tego samego pola `initiatives.axis` —
  // `InitiativeAxisEnum` (server/src/validators/initiative.validators.ts) —
  // opisuje CHARAKTER inicjatywy, nie domenę transformacji. Cztery wartości,
  // zwalidowany enum, nie zgadywane słowa.
  STRATEGIC: { pl: 'Strategiczna', en: 'Strategic' },
  OPERATIONAL: { pl: 'Operacyjna', en: 'Operational' },
  TRANSFORMATIONAL: { pl: 'Transformacyjna', en: 'Transformational' },
  COMPLIANCE: { pl: 'Zgodność (compliance)', en: 'Compliance' },
} as const;

type ExecutionAxisKey = keyof typeof EXECUTION_TYPE_LABELS;

const UNKNOWN_EXECUTION_TYPE = { pl: 'Nieznany typ', en: 'Unknown type' } as const;

/** `axis` puste/`null`/`undefined` — BRAK POMIARU, nie „nieznana wartość".
 * Osobny stan od `UNKNOWN_EXECUTION_TYPE`, żeby tabela nigdy nie myliła
 * braku danych z realną, ale nierozpoznaną wartością (CLAUDE.md — „Brak
 * pomiaru nie jest wynikiem"). */
const NO_AXIS_LABEL = { pl: '—', en: '—' } as const;

/**
 * Maps assorted real-world spellings of the same axis families onto one
 * canonical key. Order matters: more specific keywords (CYBER, CULTURE,
 * DATA, MODEL, PROCESS) are checked before the broader "DIGITAL", so e.g.
 * "Digital Processes" resolves to PROCESSES rather than DIGITAL. Returns
 * `null` for a non-empty value that isn't recognizably one of the known
 * families — callers must treat `null` as "unknown", never guess further.
 * An EMPTY string is a separate case, handled by the caller before this
 * function ever runs (see `executionTypeLabel`'s "no axis" branch) — this
 * function only classifies values that are actually present.
 */
function normalizeAxisKey(raw: string): ExecutionAxisKey | null {
  const v = raw.trim().toUpperCase();
  if (!v) return null;
  if (v in EXECUTION_TYPE_LABELS) return v as ExecutionAxisKey;
  if (v.includes('CYBER')) return 'CYBERSECURITY';
  if (v.includes('CULTURE')) return 'CULTURE';
  if (v.includes('DATA')) return 'DATA';
  if (v.includes('MODEL')) return 'MODELS';
  if (v.includes('PROCESS')) return 'PROCESSES';
  if (v.includes('DIGITAL')) return 'DIGITAL';
  if (v === 'AI' || v.startsWith('AI ') || v.includes(' AI') || v.includes('ARTIFICIAL INTELLIGENCE')) {
    return 'AI';
  }
  if (v.includes('STRATEG')) return 'STRATEGIC';
  if (v.includes('OPERATIONAL')) return 'OPERATIONAL';
  if (v.includes('TRANSFORMATIONAL')) return 'TRANSFORMATIONAL';
  if (v.includes('COMPLIANCE')) return 'COMPLIANCE';
  return null;
}

/**
 * Human label for an Execution/Initiative `axis` value. Never returns a raw
 * code. Three honest outcomes, checked in this order:
 *   1. empty/`null`/`undefined` → "—" (brak pomiaru — `NO_AXIS_LABEL`)
 *   2. non-empty but unrecognized → "Nieznany typ" (`UNKNOWN_EXECUTION_TYPE`)
 *   3. recognized → the real label
 */
export function executionTypeLabel(axis: string | null | undefined, isPolish: boolean): string {
  const locale = isPolish ? 'pl' : 'en';
  const trimmed = String(axis ?? '').trim();
  if (!trimmed) return NO_AXIS_LABEL[locale];
  const key = normalizeAxisKey(trimmed);
  if (!key) return UNKNOWN_EXECUTION_TYPE[locale];
  return EXECUTION_TYPE_LABELS[key][locale];
}

export const executionTypeLabelEntries = EXECUTION_TYPE_LABELS;
export const UNKNOWN_EXECUTION_TYPE_LABEL = UNKNOWN_EXECUTION_TYPE;
export const NO_AXIS_EXECUTION_TYPE_LABEL = NO_AXIS_LABEL;
