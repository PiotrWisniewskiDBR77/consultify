/**
 * kernelAdapter — granica między domeną Audits a wspólnym kernelem metodycznym.
 *
 * Contract SHA: e3b8be6cd706e2b563c84d0b5980f91d0eb8de5c
 * Manifest SHA: eaa80cfedb2562d676ddcbf41cb8caff59131298
 *
 * ZASADA: Audits NIE kopiuje kernela i NIE utrzymuje równoległego modelu
 * zdarzeń ani zatwierdzeń. Ten plik jest jedynym miejscem, w którym pojęcia
 * audytowe spotykają się z pojęciami kernela. Cała reszta modułu mówi po
 * audytowemu; kernel dostaje przekład.
 *
 * Trzy rzeczy, których ten adapter świadomie NIE robi:
 *
 *  1. Nie rozszerza `METHOD_SESSION_STATES`. Jedenaście etapów audytu to
 *     sub-etapy (`domainStage`) nad siedmioma stanami kernela.
 *  2. Nie wymyśla nowych typów zdarzeń. Zbiór 18 jest zamknięty; znaczenie
 *     audytowe jedzie w `payload`.
 *  3. Nie udaje, że audyt ma poziomy dojrzałości. `resolveOpenLevels`
 *     i `computeScore` zwracają uczciwe „metoda tego nie ma", a nie zgadnięty
 *     poziom — manifest §6 wymaga jawnej luki zamiast zgadywania.
 */

import {
  METHOD_EVENT_TYPES,
  METHOD_SESSION_STATES,
  TERESA_CAPABILITIES,
  canTransition,
  type AggregationInput,
  type AggregationResult,
  type MethodActorKind,
  type MethodEventType,
  type MethodProcessRole,
  type MethodSessionState,
  type ProgressionInput,
  type ProgressionResult,
  type ScoringInput,
  type ScoringResult,
  type TeresaCapabilityId,
} from '@/method-core/contracts';

/**
 * Typy domenowe Audits powtórzone tutaj świadomie, jako trzy unie stringów.
 *
 * Powód jest twardy: `server/tsconfig.json` ma `rootDir: "server"`, więc kod
 * serwera NIE MOŻE zaimportować niczego z `src/` — a kontrakt kernela żyje
 * właśnie w `src/method-core/`. Adapter musi stać po stronie kontraktu.
 * Alternatywą byłoby skopiowanie kernela do `server/`, czego manifest §9
 * zabrania wprost.
 *
 * Zgodność obu stron pilnuje test `auditsKernelAdapter.test.ts`, który
 * porównuje te unie z listami eksportowanymi przez serwer.
 */
export type AuditLifecycleState =
  | 'planning'
  | 'preparation'
  | 'fieldwork'
  | 'evidence_review'
  | 'findings_review'
  | 'management_response'
  | 'approval'
  | 'remediation'
  | 'effectiveness_verification'
  | 'closure'
  | 'closed';

export type AuditRole =
  | 'program_owner'
  | 'lead_auditor'
  | 'auditor'
  | 'technical_expert'
  | 'auditee'
  | 'evidence_owner'
  | 'reviewer'
  | 'action_owner'
  | 'administrator'
  | 'viewer';

export type ConformityStatus =
  | 'not_tested'
  | 'conforming'
  | 'nonconforming'
  | 'observation'
  | 'opportunity_for_improvement'
  | 'not_applicable'
  | 'evidence_insufficient';

// ---------------------------------------------------------------------------
// 1. Lifecycle audytu → stany kernela
// ---------------------------------------------------------------------------

/**
 * Jedenaście etapów audytu na siedem stanów kernela.
 *
 * Nieoczywisty fragment: `remediation`, `effectiveness_verification` i
 * `closure` mapują się na `frozen`, a nie na `active`. Powód jest domenowy —
 * po zatwierdzeniu raportu WYNIK audytu (ustalenia, wnioski, dowody) jest
 * zamrożony i nie wolno go już zmienić. To, co dzieje się dalej, dotyczy
 * statusu działań naprawczych, które są osobnymi obiektami. Gdyby naprawa
 * wracała audyt do `active`, oznaczałoby to, że zatwierdzone ustalenia znów
 * są edytowalne — a to podważa całą obronność.
 */
export const LIFECYCLE_TO_KERNEL_STATE: Readonly<
  Record<AuditLifecycleState, MethodSessionState>
> = {
  planning: 'draft',
  preparation: 'prepared',
  fieldwork: 'active',
  evidence_review: 'active',
  findings_review: 'in_review',
  management_response: 'in_review',
  approval: 'in_review',
  remediation: 'frozen',
  effectiveness_verification: 'frozen',
  closure: 'frozen',
  closed: 'closed',
} as const;

export function toKernelState(stage: AuditLifecycleState): MethodSessionState {
  return LIFECYCLE_TO_KERNEL_STATE[stage] ?? 'draft';
}

/**
 * Czy przejście domenowe jest legalne również w kernelu. Przejścia wewnątrz
 * jednego stanu kernela (np. `remediation` → `effectiveness_verification`,
 * oba `frozen`) są zmianą sub-etapu i kernel ich nie dotyczy.
 */
export function isKernelLegalTransition(
  from: AuditLifecycleState,
  to: AuditLifecycleState,
): boolean {
  const kFrom = toKernelState(from);
  const kTo = toKernelState(to);
  if (kFrom === kTo) return true;
  return canTransition(kFrom, kTo);
}

// ---------------------------------------------------------------------------
// 2. Role audytowe → role procesu w kernelu
// ---------------------------------------------------------------------------

/**
 * Kernel nie buduje własnego katalogu osób i ma osiem ról procesu. Role
 * audytowe są węższe znaczeniowo, więc mapowanie jest jednokierunkowe:
 * kernel dostaje rolę ogólną, a segregacja obowiązków dalej egzekwowana jest
 * po stronie Audits, na rolach audytowych (`permissions.ts`).
 *
 * `approver` w kernelu może zamrażać. W Audits zamrożenie = zatwierdzenie
 * raportu, więc dostają je `program_owner` i `reviewer`.
 */
export const AUDIT_ROLE_TO_KERNEL_ROLE: Readonly<Record<AuditRole, MethodProcessRole>> = {
  program_owner: 'owner',
  lead_auditor: 'lead_assessor',
  auditor: 'assessor',
  technical_expert: 'assessor',
  auditee: 'respondent',
  evidence_owner: 'evidence_owner',
  reviewer: 'reviewer',
  /** Właściciel działania dostarcza dowód wdrożenia — stąd `evidence_owner`. */
  action_owner: 'evidence_owner',
  administrator: 'owner',
  viewer: 'observer',
} as const;

export function toKernelRole(role: AuditRole): MethodProcessRole {
  return AUDIT_ROLE_TO_KERNEL_ROLE[role] ?? 'observer';
}

// ---------------------------------------------------------------------------
// 3. Zdarzenia domenowe → 18 zdarzeń kernela
// ---------------------------------------------------------------------------

/**
 * Zbiór zdarzeń kernela jest zamknięty. Tam, gdzie audyt ma pojęcie bez
 * bezpośredniego odpowiednika (działanie korygujące, weryfikacja skuteczności),
 * jedzie `ARTIFACT_UPDATED` z rozróżnieniem w `payload.auditEventType` —
 * zgodnie z manifestem §4: „Znaczenie domenowe niesie payload za Waszym
 * adapterem".
 *
 * Luki wymagające eskalacji są wypisane w `KERNEL_EVENT_GAPS` niżej — jako
 * dane, nie komentarz, żeby dało się je pokazać w raporcie koordynacyjnym.
 */
export const AUDIT_EVENT_TO_KERNEL_EVENT: Readonly<Record<string, MethodEventType>> = {
  // odpowiedzi strony audytowanej
  'criterion.auditee_responded': 'ANSWER_DRAFTED',
  'criterion.response_confirmed': 'ANSWER_CONFIRMED',
  'criterion.response_revised': 'ANSWER_REVISED',
  'criterion.auditor_note': 'NOTE_ADDED',

  // dowody
  'evidence.submitted': 'EVIDENCE_ATTACHED',
  'evidence.accepted': 'EVIDENCE_VERIFIED',
  'evidence.rejected': 'EVIDENCE_ATTACHED',
  'evidence_request.created': 'NOTE_ADDED',

  // decyzje audytora — wniosek o zgodności JEST decyzją, nie odpowiedzią
  'criterion.concluded': 'DECISION_APPROVED',
  'finding.created': 'DECISION_PROPOSED',
  'finding.confirmed': 'DECISION_APPROVED',
  'finding.sent_back': 'DECISION_SENT_BACK',
  'finding.rejected': 'DECISION_SENT_BACK',
  'finding.closed': 'DECISION_APPROVED',
  'finding.risk_accepted': 'DECISION_APPROVED',
  'response.submitted': 'DECISION_PROPOSED',
  'response.reviewed': 'DECISION_APPROVED',

  // Teresa
  'ai.proposal_created': 'TERESA_PROPOSAL_CREATED',
  'ai.proposal_accepted': 'TERESA_PROPOSAL_ACCEPTED',
  'ai.proposal_rejected': 'TERESA_PROPOSAL_REJECTED',

  // obiekty bez własnego typu w kernelu — rozróżnienie w payload
  'action.proposed': 'ARTIFACT_UPDATED',
  'action.approved': 'ARTIFACT_UPDATED',
  'action.implemented': 'ARTIFACT_UPDATED',
  'verification.planned': 'ARTIFACT_UPDATED',
  'verification.performed': 'ARTIFACT_UPDATED',
  'program.lifecycle_changed': 'ARTIFACT_REORGANIZED',
  'program.member_changed': 'ARTIFACT_REORGANIZED',

  // wyniki
  'output.finalized': 'OUTPUT_CREATED',
  'output.approved': 'OUTPUT_APPROVED',
  'report.generated': 'REPORT_REQUESTED',
  'report.published': 'OUTPUT_APPROVED',
  'proposal.drafted': 'INITIATIVE_PROPOSED',
} as const;

/**
 * Pojęcia audytowe, które w kernelu nie mają własnego typu zdarzenia i jadą
 * jako `ARTIFACT_UPDATED`. Trzymane jako dane, żeby nota koordynacyjna do
 * Codexa mogła je wymienić co do jednego, a test pilnował, że lista nie rośnie
 * po cichu.
 *
 * To NIE jest prośba o 18 → 25 zdarzeń. Minimalne kompatybilne rozszerzenie,
 * gdyby koordynator je dopuścił, to trzy: CORRECTIVE_ACTION_DECIDED,
 * VERIFICATION_PERFORMED, CLOSURE_DECIDED.
 */
export const KERNEL_EVENT_GAPS = [
  'action.proposed',
  'action.approved',
  'action.implemented',
  'verification.planned',
  'verification.performed',
] as const;

export function toKernelEvent(auditEventType: string): MethodEventType | null {
  return AUDIT_EVENT_TO_KERNEL_EVENT[auditEventType] ?? null;
}

export function isKernelEventType(value: unknown): value is MethodEventType {
  return typeof value === 'string' && (METHOD_EVENT_TYPES as readonly string[]).includes(value);
}

/** Aktor: człowiek, Teresa albo system. Nigdy zlane z identyfikatorem osoby. */
export function toActorKind(source: 'human' | 'teresa' | 'system' | undefined): MethodActorKind {
  return source === 'teresa' || source === 'system' ? source : 'human';
}

// ---------------------------------------------------------------------------
// 4. Teresa — capability audytowa → capability kernela
// ---------------------------------------------------------------------------

/**
 * Manifest §7 zakazuje własnego rejestru capabilities: przycisk i rozmowa mają
 * trafiać w tę samą capability kernela.
 *
 * Cztery z sześciu intencji audytowych mapują się wprost. Dwie nie mają
 * odpowiednika i są wypisane w `TERESA_CAPABILITY_GAPS` — dla nich adapter
 * zwraca `null`, a warstwa Audits obsługuje je lokalnie i oznacza jako
 * domenowe, zamiast naciągać cudzą capability do innego znaczenia.
 */
export const AUDIT_INTENT_TO_TERESA_CAPABILITY: Readonly<
  Record<string, TeresaCapabilityId | null>
> = {
  explain_criterion: 'explain_method_unit',
  draft_evidence_request: 'request_specific_evidence',
  detect_evidence_gaps: 'challenge_coverage_and_scale',
  draft_finding: 'draft_finding',
  draft_report_section: 'prepare_output_outline',
  /** Brak odpowiednika: kernel zna `draft_finding`, nie zna planu naprawczego. */
  propose_corrective_options: null,
  /** Brak odpowiednika: notatka audytora nie jest odpowiedzią respondenta. */
  draft_auditor_note: null,
} as const;

export const TERESA_CAPABILITY_GAPS = [
  'propose_corrective_options',
  'draft_auditor_note',
] as const;

export function toTeresaCapability(auditIntent: string): TeresaCapabilityId | null {
  return AUDIT_INTENT_TO_TERESA_CAPABILITY[auditIntent] ?? null;
}

export function isKnownTeresaCapability(value: unknown): value is TeresaCapabilityId {
  return typeof value === 'string' && (TERESA_CAPABILITIES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// 5. MethodAdapter dla Audits
// ---------------------------------------------------------------------------

/**
 * Audyt nie mierzy dojrzałości poziomami. Nie ma „poziomu 3 z 5" — jest
 * zgodność albo jej brak wobec konkretnego wymagania. Dlatego dwie metody
 * kontraktu zwracają uczciwe „nie dotyczy" zamiast zgadniętej liczby.
 *
 * To jest zgodne z manifestem §6: metoda, która czegoś nie może uczciwie
 * dostarczyć, deklaruje to jawnie. Udawanie poziomów byłoby gorsze niż luka —
 * downstream (agregacje, wykresy) zacząłby liczyć średnie z wymyślonych liczb.
 */
export const AUDIT_METHOD_PACK_ID = 'consultify.audits';

export function resolveOpenLevels(input: ProgressionInput): ProgressionResult {
  return {
    currentLevel: null,
    blockedAtLevel: null,
    openLevels: [],
    aboveGapLevels: [],
  };
}

/**
 * Deterministyczna ocena kryterium — zero LLM, zgodnie z regułą kontraktu.
 * Zamiast poziomu zwraca werdykt: czy da się orzec zgodność, czy brakuje
 * dowodu. `needs_evidence` nigdy nie jest zamieniane na zero.
 */
export function computeScore(input: ScoringInput): ScoringResult {
  const conformity = String(
    (input.answers as Record<string, unknown>)?.conformityStatus ?? 'not_tested',
  ) as ConformityStatus;

  const verdict: ScoringResult['verdict'] =
    conformity === 'not_applicable'
      ? 'not_applicable'
      : conformity === 'evidence_insufficient'
        ? 'needs_evidence'
        : conformity === 'not_tested'
          ? 'unknown'
          : 'scored';

  const missingEvidence =
    conformity === 'evidence_insufficient' ? [String(input.unitId)] : [];

  return {
    // Audyt nie ma poziomów — null jest tu prawdą o metodzie, nie brakiem.
    proposedLevel: null,
    satisfiedAttributes: conformity === 'conforming' ? [String(input.unitId)] : [],
    unsatisfiedAttributes: conformity === 'nonconforming' ? [String(input.unitId)] : [],
    missingEvidence,
    contradictions: [],
    verdict,
  };
}

/**
 * Agregacja zgodności do obszarów. Reguła jest jawna i wersjonowana —
 * nieopisana średnia arytmetyczna jest defektem, nie agregacją.
 *
 * Wynik to udział kryteriów zgodnych wśród ocenionych i stosowalnych,
 * wyrażony w procentach (0–100). Kryteria nieprzetestowane i nie dotyczące są
 * WYŁĄCZANE z mianownika i raportowane w `excluded` — inaczej audyt w połowie
 * drogi wyglądałby na audyt z niskim wynikiem.
 */
export const AUDIT_AGGREGATION_RULE =
  'conformity_ratio_v1: 100 * conforming / (conforming + nonconforming); ' +
  'not_tested, not_applicable i evidence_insufficient wyłączone z mianownika';

export function aggregate(input: AggregationInput): AggregationResult {
  const byGroup: Record<string, number | null> = {};
  const excluded: Record<string, string> = {};

  const groups = new Map<string, { conforming: number; nonconforming: number }>();

  for (const [unitId, value] of Object.entries(input.unitLevels)) {
    const groupId = unitId.includes('/') ? unitId.split('/')[0] : unitId;
    if (!groups.has(groupId)) groups.set(groupId, { conforming: 0, nonconforming: 0 });
    const bucket = groups.get(groupId)!;

    if (value === 1) bucket.conforming += 1;
    else if (value === 0) bucket.nonconforming += 1;
    else excluded[unitId] = 'nieoceniony, nie dotyczy albo dowód niewystarczający';
  }

  for (const [groupId, bucket] of groups) {
    const denominator = bucket.conforming + bucket.nonconforming;
    byGroup[groupId] =
      denominator === 0 ? null : Math.round((100 * bucket.conforming) / denominator);
  }

  return {
    byGroup,
    mappingVersion: input.mappingVersion || 'audits-conformity-v1',
    rule: AUDIT_AGGREGATION_RULE,
    excluded,
  };
}

/**
 * Zgodność kryterium wyrażona liczbą, żeby `aggregate()` miało czym liczyć:
 * 1 = zgodne, 0 = niezgodne, null = wyłączone z mianownika.
 */
export function conformityToAggregationValue(status: ConformityStatus): number | null {
  if (status === 'conforming') return 1;
  if (status === 'nonconforming') return 0;
  return null;
}

/** Kontrola spójności adaptera — używana przez test, nie przez runtime. */
export function describeAdapterCoverage(): {
  kernelStates: number;
  mappedLifecycleStages: number;
  kernelEventTypes: number;
  mappedAuditEvents: number;
  eventGaps: number;
  teresaCapabilityGaps: number;
} {
  return {
    kernelStates: METHOD_SESSION_STATES.length,
    mappedLifecycleStages: Object.keys(LIFECYCLE_TO_KERNEL_STATE).length,
    kernelEventTypes: METHOD_EVENT_TYPES.length,
    mappedAuditEvents: Object.keys(AUDIT_EVENT_TO_KERNEL_EVENT).length,
    eventGaps: KERNEL_EVENT_GAPS.length,
    teresaCapabilityGaps: TERESA_CAPABILITY_GAPS.length,
  };
}
