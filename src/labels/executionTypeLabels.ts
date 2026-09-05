/**
 * executionTypeLabels — TYP column, Execution (`ExecutionHub.tsx`).
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
 */

export const EXECUTION_TYPE_LABELS = {
  PROCESSES: { pl: 'Procesy', en: 'Processes' },
  DIGITAL: { pl: 'Cyfryzacja', en: 'Digital' },
  MODELS: { pl: 'Modele biznesowe', en: 'Business models' },
  DATA: { pl: 'Dane', en: 'Data' },
  CULTURE: { pl: 'Kultura', en: 'Culture' },
  CYBERSECURITY: { pl: 'Cyberbezpieczeństwo', en: 'Cybersecurity' },
  AI: { pl: 'AI', en: 'AI' },
} as const;

type ExecutionAxisKey = keyof typeof EXECUTION_TYPE_LABELS;

const UNKNOWN_EXECUTION_TYPE = { pl: 'Nieznany typ', en: 'Unknown type' } as const;

/**
 * Maps assorted real-world spellings of the same 7 axis families onto one
 * canonical key. Order matters: more specific keywords (CYBER, CULTURE,
 * DATA, MODEL, PROCESS) are checked before the broader "DIGITAL", so e.g.
 * "Digital Processes" resolves to PROCESSES rather than DIGITAL. Returns
 * `null` for anything that isn't recognizably one of the 7 families
 * (including the unrelated `strategic`/`operational`/`tactical`/
 * `transformational` axis vocabulary used elsewhere for initiatives) —
 * callers must treat `null` as "unknown", never guess further.
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
  return null;
}

/** Human label for an Execution/Initiative `axis` value. Never returns a raw code. */
export function executionTypeLabel(axis: string | null | undefined, isPolish: boolean): string {
  const locale = isPolish ? 'pl' : 'en';
  const key = normalizeAxisKey(String(axis ?? ''));
  if (!key) return UNKNOWN_EXECUTION_TYPE[locale];
  return EXECUTION_TYPE_LABELS[key][locale];
}

export const executionTypeLabelEntries = EXECUTION_TYPE_LABELS;
export const UNKNOWN_EXECUTION_TYPE_LABEL = UNKNOWN_EXECUTION_TYPE;
