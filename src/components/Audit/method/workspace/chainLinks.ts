/**
 * chainLinks — pure builder for the 18-link `ChainLink[]` state machine
 * shared by `CriterionWorkspace` (V1 shell) and `v2/CriterionWorkspaceV2`
 * (SPEC-A reshell, DEC-88). Extracted verbatim from the `useMemo` block that
 * used to live inline in `CriterionWorkspace.tsx` — SAME state derivation,
 * SAME 18 ids/labels/reasons, now importable from two shells so the
 * mechanika (which link is done/current/inactive and why) never drifts
 * between them.
 *
 * Also exports `REMEDIATION_LINK_IDS` (+ PL/EN labels) and
 * `AUDIT_CHAIN_PHASES` — the 4-macro-phase grouping accepted in DEC-88
 * (Variant A, question 1): Planowanie (1-3) · Badanie (4-8) · Ustalenia
 * (9-12) · Naprawa i zamknięcie (13-18). The phase boundaries are CONTIGUOUS
 * ranges over the same 18-id order the W1 mandate already uses — no id is
 * reordered, only grouped.
 */
import type { ChainLink } from './CriterionChain';
import type { CriterionDetail, WorkspaceFindingDetail } from './workspaceApi';

export const REMEDIATION_LINK_IDS = [
  'korekcja',
  'przyczyna-zrodlowa',
  'dzialanie-korygujace',
  'wlasciciel-termin',
  'weryfikacja-skutecznosci',
  'zamkniecie',
] as const;

export const REMEDIATION_LABELS_PL: Record<(typeof REMEDIATION_LINK_IDS)[number], string> = {
  korekcja: 'Korekcja',
  'przyczyna-zrodlowa': 'Przyczyna źródłowa',
  'dzialanie-korygujace': 'Działanie korygujące',
  'wlasciciel-termin': 'Właściciel / termin',
  'weryfikacja-skutecznosci': 'Weryfikacja skuteczności',
  zamkniecie: 'Zamknięcie',
};
export const REMEDIATION_LABELS_EN: Record<(typeof REMEDIATION_LINK_IDS)[number], string> = {
  korekcja: 'Correction',
  'przyczyna-zrodlowa': 'Root cause',
  'dzialanie-korygujace': 'Corrective action',
  'wlasciciel-termin': 'Owner / due date',
  'weryfikacja-skutecznosci': 'Effectiveness verification',
  zamkniecie: 'Closure',
};

interface BuildChainLinksArgs {
  criterion: NonNullable<CriterionDetail['criterion']> | null;
  findings: CriterionDetail['findings'] | undefined;
  hasAcceptedEvidence: boolean;
  selectedFindingId: string | null;
  selectedFindingDetail: WorkspaceFindingDetail | null;
  isPolish: boolean;
  t: (pl: string, en: string) => string;
}

export function buildChainLinks({
  criterion,
  findings,
  hasAcceptedEvidence,
  selectedFindingId,
  selectedFindingDetail,
  isPolish,
  t,
}: BuildChainLinksArgs): ChainLink[] {
  if (!criterion) return [];
  const testDone = !!criterion.testResult;
  const concluded = criterion.conformityStatus !== 'not_tested';
  const findingsCount = findings?.length ?? 0;
  const hasConfirmedFinding = (findings ?? []).some((f) => f.status === 'confirmed' || f.status !== 'draft');
  const remediationReachable = !!selectedFindingId;
  const remediationDone = selectedFindingDetail?.status === 'closed';

  const base: ChainLink[] = [
    { id: 'kryterium-zrodlo', label: t('Kryterium/źródło', 'Criterion/source'), state: 'done' },
    { id: 'pytanie-audytowe', label: t('Pytanie audytowe', 'Audit question'), state: 'done' },
    { id: 'oczekiwany-dowod', label: t('Oczekiwany dowód', 'Expected evidence'), state: 'done' },
    {
      id: 'dostarczony-dowod',
      label: t('Dostarczony dowód', 'Provided evidence'),
      state: hasAcceptedEvidence ? 'done' : 'current',
    },
    {
      id: 'procedura-audytora',
      label: t('Procedura audytora', "Auditor's procedure"),
      state: !criterion.applicable ? 'inactive' : criterion.procedurePerformed ? 'done' : 'current',
      reason: !criterion.applicable ? t('Kryterium oznaczone jako „nie dotyczy".', 'Criterion marked "not applicable".') : undefined,
    },
    {
      id: 'proba',
      label: t('Próba', 'Sample'),
      state: !criterion.applicable ? 'inactive' : criterion.sampleDescription ? 'done' : 'current',
      reason: !criterion.applicable ? t('Kryterium oznaczone jako „nie dotyczy".', 'Criterion marked "not applicable".') : undefined,
    },
    {
      id: 'wykonany-test',
      label: t('Wykonany test', 'Test performed'),
      state: !criterion.applicable ? 'inactive' : criterion.testPerformed ? 'done' : 'current',
      reason: !criterion.applicable ? t('Kryterium oznaczone jako „nie dotyczy".', 'Criterion marked "not applicable".') : undefined,
    },
    {
      id: 'wynik-testu',
      label: t('Wynik testu', 'Test result'),
      state: !criterion.applicable ? 'inactive' : testDone ? 'done' : 'current',
      reason: !criterion.applicable ? t('Kryterium oznaczone jako „nie dotyczy".', 'Criterion marked "not applicable".') : undefined,
    },
    {
      id: 'wniosek-audytora',
      label: t('Wniosek audytora', "Auditor's conclusion"),
      state: !testDone ? 'inactive' : concluded ? 'done' : 'current',
      reason: !testDone
        ? t('Wymaga wcześniej wykonanej procedury testowej (wynik testu).', 'Requires a recorded test result first.')
        : undefined,
    },
    {
      id: 'status-zgodnosci',
      label: t('Status zgodności', 'Conformity status'),
      state: !testDone ? 'inactive' : concluded ? 'done' : 'current',
      reason: !testDone
        ? t('Wymaga wcześniej wykonanej procedury testowej (wynik testu).', 'Requires a recorded test result first.')
        : undefined,
    },
    {
      id: 'ustalenie',
      label: t('Ustalenie', 'Finding'),
      state: findingsCount > 0 ? 'done' : 'current',
    },
    {
      id: 'odpowiedz-wlasciciela',
      label: t('Odpowiedź właściciela', 'Management response'),
      state: !hasConfirmedFinding ? 'inactive' : 'current',
      reason: !hasConfirmedFinding ? t('Wymaga potwierdzonego ustalenia.', 'Requires a confirmed finding.') : undefined,
    },
  ];

  for (const id of REMEDIATION_LINK_IDS) {
    base.push({
      id,
      label: isPolish ? REMEDIATION_LABELS_PL[id] : REMEDIATION_LABELS_EN[id],
      state: !remediationReachable ? 'inactive' : remediationDone ? 'done' : 'current',
      reason: !remediationReachable
        ? t('Wybierz ustalenie powyżej, aby zobaczyć ten krok naprawczy.', 'Select a finding above to see this remediation step.')
        : undefined,
    });
  }

  return base;
}

// ---------------------------------------------------------------------------
// 4 macro-phases (DEC-88, Variant A) — contiguous ranges over the 18 ids
// above, in the SAME order. `phaseIndexRange` is [startInclusive, endExclusive)
// into the array `buildChainLinks` returns.
// ---------------------------------------------------------------------------

export type AuditChainPhaseId = 'planowanie' | 'badanie' | 'ustalenia' | 'naprawa';

export interface AuditChainPhaseDef {
  id: AuditChainPhaseId;
  ordinal: 1 | 2 | 3 | 4;
  labelPl: string;
  labelEn: string;
  descriptionPl: string;
  descriptionEn: string;
  /** [startInclusive, endExclusive) index range into the 18-link array. */
  range: [number, number];
}

export const AUDIT_CHAIN_PHASES: AuditChainPhaseDef[] = [
  {
    id: 'planowanie',
    ordinal: 1,
    labelPl: 'Planowanie',
    labelEn: 'Planning',
    descriptionPl: 'co badam i czego oczekuję',
    descriptionEn: 'what I am examining and what I expect',
    range: [0, 3],
  },
  {
    id: 'badanie',
    ordinal: 2,
    labelPl: 'Badanie',
    labelEn: 'Examination',
    descriptionPl: 'dowód, procedura, próba, test, wynik',
    descriptionEn: 'evidence, procedure, sample, test, result',
    range: [3, 8],
  },
  {
    id: 'ustalenia',
    ordinal: 3,
    labelPl: 'Ustalenia',
    labelEn: 'Findings',
    descriptionPl: 'wniosek, status, ustalenie, odpowiedź',
    descriptionEn: 'conclusion, status, finding, response',
    range: [8, 12],
  },
  {
    id: 'naprawa',
    ordinal: 4,
    labelPl: 'Naprawa i zamknięcie',
    labelEn: 'Remediation and closure',
    descriptionPl: 'korekcja, przyczyna, działanie, właściciel/termin, weryfikacja, zamknięcie',
    descriptionEn: 'correction, root cause, action, owner/due date, verification, closure',
    range: [12, 18],
  },
];

export type PhaseRuntimeState = 'done' | 'current' | 'locked';

export interface AuditChainPhaseRuntime extends AuditChainPhaseDef {
  links: ChainLink[];
  doneCount: number;
  totalCount: number;
  state: PhaseRuntimeState;
}

/** Groups a flat 18-link array (from `buildChainLinks`) into the 4 DEC-88 phases. */
export function groupLinksIntoPhases(links: ChainLink[]): AuditChainPhaseRuntime[] {
  return AUDIT_CHAIN_PHASES.map((def) => {
    const phaseLinks = links.slice(def.range[0], def.range[1]);
    const doneCount = phaseLinks.filter((l) => l.state === 'done').length;
    const anyCurrent = phaseLinks.some((l) => l.state === 'current');
    const state: PhaseRuntimeState =
      phaseLinks.length > 0 && doneCount === phaseLinks.length ? 'done' : anyCurrent ? 'current' : 'locked';
    return { ...def, links: phaseLinks, doneCount, totalCount: phaseLinks.length, state };
  });
}
