/**
 * DEC-539 — JEDNO ŹRÓDŁO MAPOWANIA: 12 etapów produktu → 7 kodów zgodności.
 *
 * DLACZEGO TEN PLIK ISTNIEJE
 * --------------------------
 * Produkt ma DWIE prawdy o cyklu życia inicjatywy i obie są potrzebne:
 *
 *  1. **Etap silnika (12, DEC-490)** — `INITIATIVE_LIFECYCLE` z
 *     `src/contracts/initiatives-execution/foundation.ts`, opisany biznesowo
 *     w `docs/modules/INITIATIVES_EXECUTION_FUNCTIONS_CANON.md` §5.2. To jest
 *     prawda produktowa: rozróżnia `DEFINED` od `ANALYZING`, `SCHEDULED` od
 *     `APPROVED_BACKLOG`, `DELIVERED` od `CLOSED`. Mieszka w agregacie silnika
 *     (`ie_aggregate_state`, `aggregate_type='initiative'`, klucz
 *     `payload_json.lifecycleState`) — tam, gdzie już dziś ją zapisuje
 *     `registerInitiative` i czyta `initiativeUnifiedReader`.
 *
 *  2. **Kod kolumny (7, P12)** — `initiatives.status`, zawężony ŚWIADOMIE
 *     migracją `20262103_p12_initiative_status_slownik.sql` i pilnowany twardym
 *     CHECK `initiatives_status_check_p12`. To jest prawda bazodanowa, na
 *     której stoją bramki `INITIATIVE_TRANSITION_MATRIX`, RBAC i wszystkie
 *     odczyty listowe.
 *
 * DEC-539 uchyla DEC-506: etap 12 jest osobną kolumną
 * `initiatives.lifecycle_stage`, a `status` zostaje siedmiokodową pochodną do
 * czasu osobnej decyzji o jego usunięciu. Agregat pozostaje precyzyjnym źródłem
 * backfillu i projekcją zgodności dla istniejącego runtime-v1.
 *
 * CO BYŁO ZEPSUTE (tripwire `h1b-lifecycle-target-vocabulary-gap.test.ts`)
 * -----------------------------------------------------------------------
 * `EarlyLifecycleProposalSchema` przyjmował pięć celów ze STAREGO słownika
 * runtime (PROMOTED · PLANNING · SCHEDULED · EXECUTING · DONE), a jedyny writer
 * statusu (`coerceInitiativeStatusForWrite`) znał wyłącznie siedem kodów P12 —
 * więc ŻADEN cel, który dało się zaproponować, nie był zapisywalny. Zatwierdzona
 * recenzja A05 kończyła się 409 `UNKNOWN_TARGET_STATUS`.
 *
 * TABELA MAPOWANIA — PARYTET, NIE TRZECIA PRAWDA
 * ----------------------------------------------
 * `INITIATIVE_STAGE_TO_STATUS` jest jedyną tabelą mapowania. Klientowy adapter
 * `src/contracts/initiatives-execution/statusMapping.ts` importuje ten moduł,
 * więc frontend i serwer nie mogą rozjechać się przez dwie ręcznie utrzymywane
 * kopie. Test kontraktowy sprawdza oba kierunki adaptera.
 *
 * ZAŁOŻENIE DO ROZSTRZYGNIĘCIA PRZEZ WŁAŚCICIELA (oznaczone, nie ukryte):
 * `DELIVERED` / `BENEFITS_TRACKING` / `EFFECTIVENESS_REVIEWED` kolapsują na
 * kod `CLOSED`, bo siedmiokodowa kolumna nie ma dla nich osobnego kodu.
 * DEC-490 mówi „Done/Delivered osobno od Closed" — rozdzielenie ich W KOLUMNIE
 * wymaga migracji i zmiany CHECK, czyli dokładnie tego, czego DEC-506 zakazuje.
 * Rozdzielenie ISTNIEJE w etapie silnika (agregat), więc informacja nie ginie;
 * traci ją dopiero filtr listy oparty wyłącznie o `status`. To zastany kompromis
 * kontraktu klienta, nie nowa decyzja H1c.
 */

import { InitiativeStatus, type InitiativeStatusType } from './initiativeStatuses.js';

/**
 * 12 głównych stanów zarejestrowanej inicjatywy (DEC-490 / canon §5.2),
 * w kolejności przepływu. Kolejność jest znacząca — patrz
 * `INITIATIVE_STAGE_FLOW` niżej.
 */
export const INITIATIVE_LIFECYCLE_STAGES = [
  'REGISTERED_DRAFT',
  'DEFINED',
  'ANALYZING',
  'READY_FOR_DECISION',
  'APPROVED_BACKLOG',
  'SCHEDULED',
  'IN_EXECUTION',
  'DELIVERED',
  'BENEFITS_TRACKING',
  'EFFECTIVENESS_REVIEWED',
  'CLOSED',
  'ARCHIVED',
] as const;

export type InitiativeLifecycleStage = (typeof INITIATIVE_LIFECYCLE_STAGES)[number];

const STAGE_SET = new Set<string>(INITIATIVE_LIFECYCLE_STAGES);

/**
 * ★ TABELA MAPOWANIA 12 → 7. Jawna, kompletna, bez `default`.
 *
 * | # | Etap silnika (DEC-490)   | Kod kolumny (P12)  | Dlaczego                                                     |
 * |---|--------------------------|--------------------|--------------------------------------------------------------|
 * | 1 | REGISTERED_DRAFT         | DRAFT              | zarejestrowana, przed bramką definicji                        |
 * | 2 | DEFINED                  | DRAFT              | definicja uzgodniona, wciąż przed prośbą o decyzję            |
 * | 3 | ANALYZING                | PENDING_APPROVAL   | analiza trwa — wniosek już żyje w obiegu decyzyjnym           |
 * | 4 | READY_FOR_DECISION       | PENDING_APPROVAL   | evidence snapshot czeka na decydenta                          |
 * | 5 | APPROVED_BACKLOG         | APPROVED           | mandat merytoryczny bez zobowiązania czasowego                |
 * | 6 | SCHEDULED                | APPROVED           | okno i baseline zatwierdzone, realizacja jeszcze nie ruszyła  |
 * | 7 | IN_EXECUTION             | IN_EXECUTION       | 1:1                                                           |
 * | 8 | DELIVERED                | CLOSED             | ZAŁOŻENIE — brak osobnego kodu (patrz nagłówek pliku)         |
 * | 9 | BENEFITS_TRACKING        | CLOSED             | ZAŁOŻENIE — jw.                                               |
 * |10 | EFFECTIVENESS_REVIEWED   | CLOSED             | ZAŁOŻENIE — jw.                                               |
 * |11 | CLOSED                   | CLOSED             | 1:1                                                           |
 * |12 | ARCHIVED                 | CLOSED (+archived) | archiwum jest FLAGĄ `initiatives.archived`, nie kodem statusu |
 *
 * `REJECTED` i `PROPOSED` nie mają etapu-źródła: odrzucenie to `disposition`
 * (canon §5.3), a `PROPOSED` to stan sprzed rejestracji (§5.1). Dlatego
 * `INITIATIVE_STATUS_TO_STAGES` zwraca dla nich pustą listę.
 */
export const INITIATIVE_STAGE_TO_STATUS: Record<InitiativeLifecycleStage, InitiativeStatusType> = {
  REGISTERED_DRAFT: InitiativeStatus.DRAFT,
  DEFINED: InitiativeStatus.DRAFT,
  ANALYZING: InitiativeStatus.PENDING_APPROVAL,
  READY_FOR_DECISION: InitiativeStatus.PENDING_APPROVAL,
  APPROVED_BACKLOG: InitiativeStatus.APPROVED,
  SCHEDULED: InitiativeStatus.APPROVED,
  IN_EXECUTION: InitiativeStatus.IN_EXECUTION,
  DELIVERED: InitiativeStatus.CLOSED,
  BENEFITS_TRACKING: InitiativeStatus.CLOSED,
  EFFECTIVENESS_REVIEWED: InitiativeStatus.CLOSED,
  CLOSED: InitiativeStatus.CLOSED,
  ARCHIVED: InitiativeStatus.CLOSED,
};

/** Etap `ARCHIVED` dodatkowo podnosi flagę `initiatives.archived` (P12 §flagi). */
export const INITIATIVE_STAGE_SETS_ARCHIVED_FLAG: Record<InitiativeLifecycleStage, boolean> = {
  REGISTERED_DRAFT: false,
  DEFINED: false,
  ANALYZING: false,
  READY_FOR_DECISION: false,
  APPROVED_BACKLOG: false,
  SCHEDULED: false,
  IN_EXECUTION: false,
  DELIVERED: false,
  BENEFITS_TRACKING: false,
  EFFECTIVENESS_REVIEWED: false,
  CLOSED: false,
  ARCHIVED: true,
};

/** Odwrotność tabeli wyżej — który etap może stać za danym kodem kolumny. */
export const INITIATIVE_STATUS_TO_STAGES: Record<
  InitiativeStatusType,
  readonly InitiativeLifecycleStage[]
> = {
  PROPOSED: [],
  DRAFT: ['REGISTERED_DRAFT', 'DEFINED'],
  PENDING_APPROVAL: ['ANALYZING', 'READY_FOR_DECISION'],
  APPROVED: ['APPROVED_BACKLOG', 'SCHEDULED'],
  IN_EXECUTION: ['IN_EXECUTION'],
  CLOSED: ['DELIVERED', 'BENEFITS_TRACKING', 'EFFECTIVENESS_REVIEWED', 'CLOSED', 'ARCHIVED'],
  REJECTED: [],
};

/**
 * Słownik ZASTANY (13 kodów runtime sprzed P12 + 7 kodów P12) → etap silnika.
 * To jest most dla wszystkiego, co wciąż mówi starym słownikiem: pięciu celów
 * `EarlyLifecycleProposalSchema`, `APPROVED_EXPECTED_BY_TARGET` w adapterze,
 * danych zastanych. Klient korzysta z tego samego resolvera przez adapter
 * `src/contracts/initiatives-execution/statusMapping.ts`.
 */
export const LEGACY_TARGET_TO_STAGE: Record<string, InitiativeLifecycleStage> = {
  PROPOSED: 'REGISTERED_DRAFT',
  DRAFT: 'REGISTERED_DRAFT',
  PENDING_REVIEW: 'READY_FOR_DECISION',
  REVIEW: 'READY_FOR_DECISION',
  PROMOTED: 'READY_FOR_DECISION',
  PLANNING: 'READY_FOR_DECISION',
  PENDING_APPROVAL: 'READY_FOR_DECISION',
  APPROVED: 'APPROVED_BACKLOG',
  SCHEDULED: 'SCHEDULED',
  EXECUTING: 'IN_EXECUTION',
  IN_PROGRESS: 'IN_EXECUTION',
  IN_EXECUTION: 'IN_EXECUTION',
  BLOCKED: 'IN_EXECUTION',
  DONE: 'CLOSED',
  TRACKING: 'BENEFITS_TRACKING',
  ARCHIVED: 'ARCHIVED',
  CLOSED: 'CLOSED',
  CANCELLED: 'CLOSED',
  REJECTED: 'CLOSED',
};

/**
 * Rozwiąż DOWOLNY zapis etapu/statusu do etapu silnika.
 * Kolejność: najpierw słownik docelowy (12), potem słownik zastany (19).
 * `null` = nie zgadujemy (canon §5.5: „system nie zgaduje").
 */
export function resolveInitiativeLifecycleStage(
  value: string | null | undefined
): InitiativeLifecycleStage | null {
  const raw = String(value ?? '')
    .trim()
    .toUpperCase();
  if (!raw) return null;
  if (STAGE_SET.has(raw)) return raw as InitiativeLifecycleStage;
  return LEGACY_TARGET_TO_STAGE[raw] ?? null;
}

/**
 * H1d — DYSPOZYCJE BEZ ETAPU. Canon §5.3: odrzucenie/anulowanie to `disposition`,
 * nie etap cyklu życia — w dwunastostopniowym łańcuchu DEC-490 nie ma dla nich
 * miejsca. `LEGACY_TARGET_TO_STAGE` mapuje je (w parytecie z klientem) na etap
 * `CLOSED`, co jest poprawne dla ODCZYTU, ale było fatalne dla ZAPISU: cel
 * `REJECTED` przechodził przez `INITIATIVE_STAGE_TO_STATUS['CLOSED']` i lądował
 * w kolumnie jako **CLOSED**, mimo że siedmiokodowy słownik P12 ma osobny kod
 * `REJECTED`. Zmierzone na realnym Postgresie: przejście IN_EXECUTION→REJECTED
 * zapisywało `status='CLOSED'` (test `p12IntC.statusWritePaths.pg.test.ts`
 * czerwieniał na tym JESZCZE PRZED zmianami H1d).
 *
 * Ścieżka ZAPISU musi je więc rozstrzygać PRZED tabelą etapów. Etap zostaje
 * `null` — inicjatywa odrzucona zachowuje w agregacie etap, na którym umarła;
 * nadpisanie go `CLOSED` kłamałoby, że przeszła całą ścieżkę realizacji.
 */
const DISPOSITION_WRITE_TARGETS: Record<string, InitiativeStatusType> = {
  REJECTED: InitiativeStatus.REJECTED,
  CANCELLED: InitiativeStatus.REJECTED,
};

export interface InitiativeStageWriteTarget {
  /** Etap silnika — prawda 12-stopniowa, ląduje w agregacie. `null` dla dyspozycji. */
  stage: InitiativeLifecycleStage | null;
  /** Kod kolumny `initiatives.status` — prawda 7-kodowa, przechodzi CHECK P12. */
  status: InitiativeStatusType;
  /** Czy etap wymusza podniesienie flagi `archived`. */
  archived: boolean;
}

/**
 * JEDYNE wejście dla ścieżki ZAPISU: cel przejścia (w dowolnym z dwóch
 * słowników) → para {etap silnika, kod kolumny}. Zwraca `null` dla wartości
 * bez jednoznacznego mapowania — wołający MUSI wtedy odmówić, nie zgadywać.
 */
export function resolveInitiativeStageWriteTarget(
  value: string | null | undefined
): InitiativeStageWriteTarget | null {
  // Dyspozycje NAJPIERW — patrz `DISPOSITION_WRITE_TARGETS`.
  const disposition = DISPOSITION_WRITE_TARGETS[String(value ?? '').trim().toUpperCase()];
  if (disposition) return { stage: null, status: disposition, archived: false };
  const stage = resolveInitiativeLifecycleStage(value);
  if (!stage) return null;
  return {
    stage,
    status: INITIATIVE_STAGE_TO_STATUS[stage],
    archived: INITIATIVE_STAGE_SETS_ARCHIVED_FLAG[stage],
  };
}

/**
 * Dozwolone następstwo etapów (canon §5.2 — łańcuch liniowy).
 * Używane tam, gdzie kod kolumny się NIE zmienia (np. APPROVED_BACKLOG →
 * SCHEDULED: oba to `APPROVED`), a mimo to przejście jest realną zmianą
 * produktową i musi być sprawdzone, żeby nie dało się cofnąć etapu po cichu.
 */
export const INITIATIVE_STAGE_FLOW: Record<
  InitiativeLifecycleStage,
  readonly InitiativeLifecycleStage[]
> = {
  REGISTERED_DRAFT: ['DEFINED'],
  DEFINED: ['ANALYZING'],
  ANALYZING: ['READY_FOR_DECISION'],
  READY_FOR_DECISION: ['APPROVED_BACKLOG'],
  APPROVED_BACKLOG: ['SCHEDULED'],
  SCHEDULED: ['IN_EXECUTION'],
  IN_EXECUTION: ['DELIVERED'],
  DELIVERED: ['BENEFITS_TRACKING'],
  BENEFITS_TRACKING: ['EFFECTIVENESS_REVIEWED'],
  EFFECTIVENESS_REVIEWED: ['CLOSED'],
  CLOSED: ['ARCHIVED'],
  ARCHIVED: [],
};

/** Czy przejście etapu jest zgodne z liniowym łańcuchem canonu §5.2. */
export function isValidInitiativeStageStep(
  from: InitiativeLifecycleStage,
  to: InitiativeLifecycleStage
): boolean {
  return INITIATIVE_STAGE_FLOW[from].includes(to);
}
