/**
 * Zlecenie → wyniki wykonania kroków (`case_workspace_node_result_acceptances`)
 * + kontekst źródłowego Run (`case_workspace_run_bindings`).
 *
 * ★ DLACZEGO OSOBNY PLIK, a nie dopisane do `api.ts`. `api.ts` jest poza
 * zakresem tej zmiany (pakiet CW-T-D dostał go w ZAKAZANE — należy do prac A/C
 * prowadzonych równolegle w tym samym worktree). Ten plik jest samodzielną,
 * dopisywalną warstwą odczytu: importuje z `api.ts`/`types.ts` (odczyt WOLNO),
 * nigdy ich nie modyfikuje, i nie wymaga żadnej zmiany w `CaseDetailScreen.tsx`
 * (też ZAKAZANE) — `RezultatyView` woła te funkcje SAMODZIELNIE, w swoim
 * własnym `useEffect`.
 *
 * ★ ŹRÓDŁO PRAWDY DLA KSZTAŁTU DANYCH: `NodeResultAcceptance` poniżej jest
 * przepisany z `CaseNodeResultAcceptance`
 * (`server/src/services/caseWorkspace/executionGraphService.ts:311-328`) —
 * DOKŁADNIE te same nazwy pól co serwis zwraca po `res.json({ data })`
 * (trasa `GET /cases/:caseId/node-result-acceptances`,
 * `executionGraph.routes.ts`). `CaseRunBinding` jest tak samo przepisany z
 * `runBindingService.ts:107-114` (trasa `GET /run-bindings/:runId`).
 *
 * ★ UCZCIWIE O TYM, CZEGO TU NIE MA. `case_workspace_node_result_acceptances`
 * NIE MA kolumny wskazującej „ten wpis dotyczy TEGO deliverable" —
 * sprawdzone w migracji (`20260809_case_workspace_artifact_links.sql`:
 * `case_workspace_artifact_links` nie ma kolumny `run_id` ani `node_run_id`,
 * a `case_workspace_node_result_acceptances` nie ma kolumny wskazującej na
 * artefakt). `acceptanceInputSnapshot` to `unknown` — dowolny JSON bez
 * schematu (`RecordNodeResultAcceptanceInput.acceptanceInputSnapshot: unknown`,
 * tamże). `deliverableRefFromSnapshot` niżej czyta ZNANĄ w tym repo konwencję
 * (`typ:id`, ta sama co `evidenceRef` pomiaru wartości —
 * `buildArtifactRef`/`parseArtifactRef`, `src/utils/artifactLinks.ts`) —
 * a gdy migawka jej nie niesie, zwraca `null`. To NIE jest kontrakt backendu,
 * to najlepszy odczyt tego, co tam faktycznie bywa zapisane. `RezultatyView`
 * wzmacnia to realnym backendowym stanem WSZĘDZIE, gdzie się da — patrz
 * `resolveDeliverableForNodeResult` tamże, które najpierw próbuje dopasować
 * wyłuskany typ+id do już wczytanego, backendowo zweryfikowanego
 * `CaseArtifactLink` (z jego prawdziwym `linkStatus`/`isStale`), i dopiero gdy
 * dopasowania nie ma, spada na słabszą, generyczną ścieżkę otwarcia.
 */

import { v8Get } from '@/services/api/v8/client';

import { toFailure } from './api';
import type { CaseApiFailure } from './types';

const BASE = '/case-workspace';

// ═══════════════════════════════════════════════════════════════════════════
// Wyniki wykonania kroków (node result acceptances)
// ═══════════════════════════════════════════════════════════════════════════

/** CW-RT-037 (04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md:261) — katalog dosłowny. */
export type NodeResultAcceptanceValue = 'ACCEPTED' | 'PARTIAL' | 'REJECTED' | 'NOT_APPLICABLE';

export type NodeCompletionState = 'COMPLETED' | 'SKIPPED';

/** CW-GR-009 — pełny katalog typów węzłów, tak jak `executionGraphService.ts` (NODE_TYPES). */
export type ExecutionNodeType =
  | 'START'
  | 'END'
  | 'CAPABILITY'
  | 'HUMAN_TASK'
  | 'APPROVAL'
  | 'TIMER_WAIT'
  | 'EVENT_WAIT'
  | 'DECISION_GATEWAY'
  | 'PARALLEL_SPLIT'
  | 'PARALLEL_JOIN'
  | 'SUBFLOW'
  | 'ANNOTATION';

/** Przepisane z `CaseNodeResultAcceptance` — patrz nagłówek pliku. */
export interface NodeResultAcceptance {
  nodeRunId: string;
  organizationId: string;
  projectId: string | null;
  caseId: string;
  runId: string;
  nodeType: ExecutionNodeType;
  nodeCompletionState: NodeCompletionState;
  resultAcceptance: NodeResultAcceptanceValue;
  skipAuthorizedByGraphCondition: boolean | null;
  skipConditionRef: string | null;
  causedByGatewayNodeRunId: string | null;
  acceptanceInputSnapshot: unknown;
  acceptanceInputDigest: string;
  occurredAt: string;
  recordedAt: string;
  recordedByActorId: string;
}

/**
 * GET /cases/:caseId/node-result-acceptances — `listNodeResultAcceptancesForCase`.
 * Jedyna trasa, która oddaje wyniki wykonania NA POZIOMIE CAŁEGO ZLECENIA
 * (a nie pojedynczego Run) — dokładnie ta, której potrzebuje zakładka
 * Rezultaty. Zero filtra po stronie serwera na tej trasie (sprawdzone —
 * `executionGraph.routes.ts`, wariant `/runs/:runId/...` przyjmuje
 * `resultAcceptance` w query, wariant `/cases/:caseId/...` NIE) — filtrowanie
 * po statusie robi UI.
 */
export function listNodeResultAcceptancesForCase(caseId: string): Promise<NodeResultAcceptance[]> {
  return v8Get<NodeResultAcceptance[]>(
    `${BASE}/cases/${encodeURIComponent(caseId)}/node-result-acceptances`
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Źródłowy Run (kontekst, nie treść)
// ═══════════════════════════════════════════════════════════════════════════

/** Przepisane z `CaseRunBinding` (`runBindingService.ts:107-114`). */
export interface CaseRunBinding {
  runId: string;
  casePlanVersionId: string;
  caseId: string;
  organizationId: string;
  graphDigest: string;
  boundByActorId: string;
  createdAt: string;
}

/**
 * GET /run-bindings/:runId. Wywoływane LENIWIE — dopiero gdy użytkownik
 * otworzy podgląd konkretnego wyniku kroku, nie z góry dla wszystkich
 * wierszy tabeli (N+1 zapytań bez potrzeby: lista wyników kroku ma już
 * `runId` do pokazania wprost, kontekst Run dochodzi dopiero na żądanie).
 */
export function getRunBinding(runId: string): Promise<CaseRunBinding> {
  return v8Get<CaseRunBinding>(`${BASE}/run-bindings/${encodeURIComponent(runId)}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// Etykiety i tony — słowniki, których `src/utils/enumLabels.ts` jeszcze nie zna
// (plik poza zakresem tej zmiany; ten katalog wartości jest NOWY w tym pakiecie)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * `Częściowo zakończone` to DOSŁOWNA etykieta z kanonu
 * (`04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md:276` — tabela mapowania
 * runtime→UI, wiersz `terminal result acceptance PARTIAL`), nie wymyślona
 * tu nazwa. To samo źródło mówi wprost: „UI »Częściowo zakończone« derives
 * from explicit PARTIAL, never from warnings or node counts" — dlatego ta
 * etykieta czyta WYŁĄCZNIE `resultAcceptance`, nigdy jakiekolwiek pole
 * „warnings" (którego zresztą `NodeResultAcceptance` w ogóle nie ma).
 */
export function resultAcceptanceLabel(value: NodeResultAcceptanceValue): string {
  switch (value) {
    case 'ACCEPTED':
      return 'Zaakceptowany';
    case 'PARTIAL':
      return 'Częściowo zakończone';
    case 'REJECTED':
      return 'Odrzucony';
    case 'NOT_APPLICABLE':
      return 'Nie dotyczy';
    default:
      return value;
  }
}

export function resultAcceptanceTone(
  value: NodeResultAcceptanceValue
): 'success' | 'warning' | 'critical' | 'neutral' {
  if (value === 'ACCEPTED') return 'success';
  if (value === 'PARTIAL') return 'warning';
  if (value === 'REJECTED') return 'critical';
  return 'neutral';
}

export function nodeCompletionStateLabel(value: NodeCompletionState): string {
  return value === 'SKIPPED' ? 'Pominięty' : 'Zakończony';
}

// ═══════════════════════════════════════════════════════════════════════════
// Wyłuskanie odwołania do rezultatu z dowodu (najlepsza próba — patrz nagłówek)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Najlepsza próba wyciągnięcia odwołania do obiektu-rezultatu z
 * `acceptanceInputSnapshot`. Sprawdza w kolejności:
 *  1. znane pola tekstowe w konwencji `typ:id` (ta sama, której repo już
 *     używa dla `evidenceRef` — `buildArtifactRef`/`parseArtifactRef`);
 *  2. strukturę `{ artifactType, artifactId }` (albo `deliverableType`/
 *     `deliverableId`) — złożoną z dwóch pól zamiast jednego stringa.
 * Nic nie zgaduje poza tym: brak dopasowania to `null`, czyli „ten zapis nie
 * wskazuje obiektu" — jawny, uczciwy stan, nie błąd.
 */
export function deliverableRefFromSnapshot(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const obj = snapshot as Record<string, unknown>;

  for (const key of ['deliverableRef', 'artifactRef', 'resultRef', 'outputRef']) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  const type = obj.artifactType ?? obj.deliverableType;
  const id = obj.artifactId ?? obj.deliverableId;
  if (
    typeof type === 'string' &&
    type.trim() &&
    (typeof id === 'string' || typeof id === 'number')
  ) {
    const idText = String(id).trim();
    if (idText) return `${type.trim()}:${idText}`;
  }
  return null;
}

/**
 * Czytelny opis dowodu z `acceptanceInputSnapshot`, do pokazania WPROST (bez
 * widoku eksperckiego). Rozpoznaje wyłącznie pole `summary` — konwencję, którą
 * ten backend już stosuje (golden case: `{ summary: 'margin analysis produced' }`,
 * `goldenCaseHappyPath.pg.test.ts:145`). Reszta kształtów zostaje ukryta za
 * widokiem eksperckim (surowy JSON) zamiast zgadywana.
 */
export function summaryFromSnapshot(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const value = (snapshot as Record<string, unknown>).summary;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export { toFailure };
export type { CaseApiFailure };
