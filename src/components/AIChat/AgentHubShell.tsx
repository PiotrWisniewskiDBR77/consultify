/**
 * AgentHubShell — powłoka zakładki "Run agent" z dwiema pod-zakładkami (AGT-010).
 *
 * Piotr 2026-07-24 (zrzut demo): wejście w Run agent pokazywało od razu
 * launcher 31 gotowych agentów (AgentPlanWorkspace → AgentManifestLauncher).
 * Brakowało warstwy pośredniej — user ma WIELE uruchomionych/zapisanych
 * procesów, potrzebna tabela pozycji jak w Decisions, nie od razu kreator.
 *
 * Ta powłoka wchodzi PRZED AgentPlanWorkspace:
 *   "Moje procesy" — StandardTable nad `listAgentPlans` (GET /api/ai/agent-plan).
 *     Klik w wiersz otwiera PREVIEW (StandardPreview); "Otwórz" w preview albo
 *     w kebabie otwiera AgentPlanWorkspace jako KARTĘ w Menu 3 (dynamiczny tab
 *     z ×) — patrz niżej, poprawka odbioru triady 2026-07-24.
 *   "Szablony" (AGT-011) — StandardTable łącząca dwa źródła:
 *     - bibliotekę PROCESÓW (`listAgentProcesses`, ProcessLibrary — classic-5
 *       domyślny + wariant drd),
 *     - katalog GOTOWYCH ANALIZ (`listAgentManifests({status:'built'})` — 19
 *       wykonalnych z 31 manifestów Discovery Tools).
 *     Kolumna "Typ" (chip) rozróżnia Proces/Gotowa analiza; klik w wiersz
 *     otwiera preview, "Użyj szablonu" tworzy nowy plan i otwiera go jako
 *     kartę — patrz `handleSelectTemplate`.
 *
 * "Nowy proces" (Moje procesy) i "Użyj szablonu" (Szablony) dzielą JEDEN
 * handler tworzenia (`handleCreatePlan`) — patrz komentarz przy nim.
 * Ścieżka procesu (`processId`) zawsze `draft: true`: backend kładzie
 * schemat i zostawia plan w statusie 'planning' (NIE dispatchuje wykonania —
 * patrz agent-plan.routes.ts `effectiveDraft`), user przestawia klocki na
 * canvasie i dopiero jawne "Uruchom" startuje wykonanie. Ścieżka manifestu
 * (`manifestId`) zostaje wstecznie zgodna z katalogiem sprzed AGT-010 —
 * dispatch od razu (canvas otwiera się na już wystartowanym planie).
 *
 * ★ SELECTION/BULK (2026-07-26, audyt kanonu triady — MUST #7/#13):
 * "Moje procesy" dostała `selection` (checkbox po lewej) + pasek bulk
 * (renderowany lokalnie, `renderBulkBar` niżej — patrz ★ HubBarSlots poniżej)
 * z JEDNĄ akcją zbiorczą — "Anuluj zaznaczone".
 * Backend (`agentPlan.api.ts`) ma WYŁĄCZNIE `cancelAgentPlan(planId)`
 * (POST /:id/cancel, pojedynczo) — brak endpointu zbiorczego i brak
 * jakiegokolwiek DELETE dla planów, więc: (a) "Anuluj zaznaczone" woła
 * `cancelAgentPlan` sekwencyjnie per zaznaczony wiersz (`handleBulkCancelPlans`
 * niżej), (b) "Usuń zaznaczone" NIE istnieje — nie ma czego wołać, dopisywać
 * przycisku bez handlera byłoby fasadą. Przycisk disabled+tooltip, gdy w
 * zaznaczeniu zero anulowalnych planów (`CANCELLABLE_STATUSES`) — potwierdzenie
 * `window.confirm` przed wysłaniem (wzór `AssessmentHub.handleBulkDeleteList`).
 * "Szablony" NIE dostała selection — ŚWIADOMIE: wiersze to statyczna
 * biblioteka do przeglądania (procesy + gotowe analizy), jedyna akcja to
 * "Użyj szablonu" — z NATURY per-wiersz (tworzy jeden nowy plan z jednego
 * szablonu; "użyj 5 szablonów naraz" nie ma sensu domenowego), i nie ma
 * żadnej akcji destrukcyjnej/grupowej nad samą biblioteką (nie edytujemy ani
 * nie kasujemy szablonów z tego ekranu). Checkbox bez żadnej realnej akcji
 * pod nim byłby pustym elementem UI — pominięty do czasu, aż pojawi się
 * realna akcja zbiorcza (np. "Ukryj z listy"/"Oznacz jako ulubione").
 *
 * ★ POPRAWKA ODBIORU TRIADY (2026-07-24, zrzuty demo Piotra):
 * 1. Pigułki "Moje procesy"/"Szablony" przeniesione z lewej strony Menu 2
 *    (`tabs`) na PRAWĄ, obok CTA (`filterControls` + `Segmented` — jedyny
 *    gotowy segmented-switcher w repo, `TemplateBuilder/templateBuilderFields`,
 *    dotąd używany tylko w formularzach, tu pierwszy raz w Menu 2 — zgodnie
 *    z życzeniem właściciela "jako przełącznik widoku").
 * 2. Klik w wiersz = PREVIEW (StandardPreview: status, postęp, kroki z
 *    czytelnymi nazwami, bramki akceptu) — nie od razu pełny ekran.
 * 3. Kebab uzupełniony do kontraktu `rowMenu` (StandardTable dokłada SAMO
 *    "Otwórz podgląd/Edytuj/Archiwizuj" + destrukcyjne na końcu) — "Anuluj"
 *    JEST "Zatrzymaj" (jeden dom akcji, nie dublujemy — gestosc §"jedna akcja
 *    = jeden dom"). "Duplikuj"/"Uruchom ponownie" pominięte: brak backendu
 *    (AgentPlan nie niesie processId/manifestId źródłowego, `runAgentPlan`
 *    działa tylko na planie w statusie 'planning') — zgłoszone w raporcie.
 * 4. "Otwórz" (preview/kebab) NIE podmienia całego ekranu — dokłada kartę do
 *    Menu 3 (`openItems`/`activeItemId`/`onSelectItem`/`onCloseItem`, teraz
 *    zadeklarowane przez `useHubBarSlot` — patrz ★ HubBarSlots poniżej —
 *    a nie renderowane tu bezpośrednio przez `StandardModuleBar`).
 *    Treść karty: `AgentPlanWorkspace` (ArtifactRightPanel — z NATURY wąski
 *    prawy dok, doktryna "panel-Teresy-zawsze-po-prawej") dostaje TOWARZYSZA
 *    z lewej — `PlanSummaryCard` (też reużywana w preview) — bo bez niego
 *    ekran renderował wąski panel przy lewej krawędzi i pustkę z prawej
 *    (zgłoszony defekt). To NIE jest pełna migracja do `StandardArtifactShell`
 *    (SPEC-A/Karta-N) — ten kontrakt wymaga sections+aiContract+rightPanel o
 *    stałych kluczach, czyli osobnego, większego zadania; zgłoszone w raporcie
 *    z oszacowaniem zamiast robić połowicznie.
 *
 * Kanon: consultify-triada (StandardTable + StandardPreview — zero własnej
 * tabeli/preview) + consultify-gestosc (hub 2 zakładki ≤ 6; "Nowy agent" ma
 * jeden dom — Menu2 primary CTA).
 *
 * ★ HubBarSlots (2026-07-27, zgłoszenie właściciela na żywym demo — nad
 * obszarem roboczym w "My Work → Run agent" piętrzyły się 4 rzędy chrome,
 * dwa duplikat huba, cytat: „za dużo miejsca ucieka"). Ta powłoka PRZESTAŁA
 * rysować własny `StandardModuleBar` — hub (`MyWorkHub`) ma teraz JEDYNE
 * Menu 2/3 na ekranie, a ta powłoka tylko DEKLARUJE swoje elementy przez
 * `useHubBarSlot` (patrz `src/components/shared/HubBarSlots.tsx`):
 *   - `filterControls` — Segmented "Moje procesy | Szablony", TYLKO gdy
 *     `!activeItemId` (Piotr: na poziomie listy owszem, w otwartym agencie
 *     już nie ma po co go pokazywać);
 *   - `primaryCta` — "Nowy agent"/"New agent" (Piotr wprost zmienił nazwę z
 *     "Nowy proces"), TYLKO gdy `tab === 'processes' && !activeItemId`;
 *   - `openItems`/`activeItemId`/`onSelectItem`/`onCloseItem`/`onShowList` —
 *     1:1 to samo, co szło wcześniej do `StandardModuleBar` (karty otwartych
 *     procesów), teraz lądują w Menu 3 huba.
 * WYJĄTEK: `bulk` (pasek zaznaczenia "Moje procesy") NIE ma odpowiednika w
 * `HubBarSlotValue` — zostaje renderowany LOKALNIE nad tabelą (`renderBulkBar`,
 * ten sam wygląd co dawny `StandardModuleBar.bulk`, tylko inny, mniejszy pasek
 * zamiast pełnego Menu 2/3). ŚWIADOMA DECYZJA, ponownie oceniona i potwierdzona
 * AGT-015 §6 D3 (2026-07-28) — uzasadnienie przy `renderBulkBar` niżej.
 */
import {
  FileStack,
  Folder,
  FolderPlus,
  Layers,
  ListChecks,
  PlayCircle,
  Timer,
  Trash2,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { FolderCreateDialog } from '@/components/shared/FolderCreateDialog';
import { useHubBarSlot } from '@/components/shared/HubBarSlots';
import { Menu3DropdownChip } from '@/components/shared/Menu3DropdownChip';
import type { OpenDocument } from '@/components/shared/ModuleHub/types';
import {
  MENU_3_ACTION_DANGER,
  MENU_3_INNER_CLASS,
  MENU_3_LEFT_CLASS,
  MENU_3_RIGHT_CLASS,
  Menu3Chip,
} from '@/components/shared/ModuleMenu3';
import {
  PreviewActionButton,
  PreviewDetailsSection,
  PreviewMetaCard,
} from '@/components/shared/PreviewPane';
import { EmptyState, LoadingState } from '@/components/shared/states';
import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import {
  type StandardRowMenu,
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard/StandardTable';
import { Segmented } from '@/components/TemplateBuilder/templateBuilderFields';
import { EntityStatusChip, MetaChip, StatusChip } from '@/components/ui/primitives/chips';
import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import { listAgentManifests } from '@/services/api/agentManifests.api';
import {
  type AgentFolder,
  type AgentPlan,
  type AgentPlanStatus,
  cancelAgentPlan,
  createAgentFolder,
  createAgentPlan,
  deleteAgentFolder,
  getAgentPlan,
  listAgentFolders,
  listAgentPlans,
  listAgentProcesses,
  setAgentPlanFolder,
} from '@/services/api/agentPlan.api';

import { readablePhaseName } from './AgentPlanPanel';
import { AgentPlanWorkspace } from './AgentPlanWorkspace';
import { AgentOperationsPanel } from './AgentOperationsPanel';
import { AgentProcessTemplatesPanel } from './AgentProcessTemplatesPanel';
import { TransformationCasesPanel } from './TransformationCasesPanel';

type AgentHubTab =
  | 'processes'
  | 'templates'
  | 'governed_templates'
  | 'transformations'
  | 'operations';

function agentHubTabLabel(tab: AgentHubTab, isPolish: boolean): string {
  const labels: Record<AgentHubTab, [string, string]> = {
    processes: ['Archiwum procesów', 'Process archive'],
    templates: ['Start i szablony', 'Start and templates'],
    governed_templates: ['Governance szablonów', 'Template governance'],
    transformations: ['Sprawy, akceptacje i wyniki', 'Cases, approvals and outputs'],
    operations: ['Operacje i odzyskiwanie', 'Operations and recovery'],
  };
  return labels[tab][isPolish ? 0 : 1];
}

type TemplateKind = 'process' | 'manifest';

interface TemplateRow {
  id: string;
  kind: TemplateKind;
  name: string;
  description: string;
  stepCount: number;
  isDefault: boolean;
}

const formatPlanDate = (iso: string, isPolish: boolean): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Kolumny „Zaplanowany na"/„Ostatnie uruchomienie" (2026-07-28): data+godzina,
 * nie tylko dzień jak `formatPlanDate` — dla harmonogramu i startu minuty
 * mają znaczenie (odróżnienie „za chwilę" od „za 8h" tego samego dnia).
 */
const formatPlanDateTime = (iso: string | undefined, isPolish: boolean): string => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * „Czas wykonania" (2026-07-28): completedAt-startedAt gdy plan już skończony;
 * gdy nadal `executing` — czas OD startu DO TERAZ (przybliżony, przelicza się
 * przy każdym odświeżeniu listy, nie ma tu tickera co sekundę — wystarczające
 * dla pytania „jak długo to już trwa", nie stoper).
 */
const formatDuration = (plan: Pick<AgentPlan, 'startedAt' | 'completedAt' | 'status'>): string => {
  if (!plan.startedAt) return '—';
  const start = new Date(plan.startedAt).getTime();
  if (Number.isNaN(start)) return '—';
  const endIso = plan.completedAt;
  const end = endIso ? new Date(endIso).getTime() : plan.status === 'executing' ? Date.now() : NaN;
  if (Number.isNaN(end) || end < start) return '—';
  const ms = end - start;
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};

const PLAN_STATUS_TONE: Record<
  AgentPlanStatus,
  'info' | 'warning' | 'success' | 'danger' | 'neutral'
> = {
  planning: 'info',
  scheduled: 'info',
  awaiting_approval: 'warning',
  executing: 'info',
  paused: 'warning',
  completed: 'success',
  completed_with_errors: 'warning',
  failed: 'danger',
  cancelled: 'neutral',
};

// Menu 3 dynamiczny tab wymaga `ItemStatus` (unia zamknięta, inna niż
// `AgentPlanStatus`) wyłącznie do koloru kropki — najbliższe dopasowanie,
// nie krytyczne semantycznie (patrz DynamicTabs.tsx `STATUS_COLORS`).
const PLAN_STATUS_TO_ITEM_STATUS: Record<AgentPlanStatus, OpenDocument['status']> = {
  planning: 'PLANNING',
  scheduled: 'SCHEDULED',
  awaiting_approval: 'PENDING_REVIEW',
  executing: 'EXECUTING',
  paused: 'BLOCKED',
  completed: 'DONE',
  completed_with_errors: 'DONE',
  failed: 'BLOCKED',
  cancelled: 'CANCELLED',
};

const CANCELLABLE_STATUSES: AgentPlanStatus[] = [
  'planning',
  'executing',
  'awaiting_approval',
  'paused',
];

function planStatusLabel(status: AgentPlanStatus, isPolish: boolean): string {
  const pl: Record<AgentPlanStatus, string> = {
    planning: 'Planowanie',
    scheduled: 'Zaplanowany',
    awaiting_approval: 'Czeka na akceptację',
    executing: 'W toku',
    paused: 'Wstrzymany',
    completed: 'Zakończony',
    completed_with_errors: 'Zakończony z błędami',
    failed: 'Nieudany',
    cancelled: 'Anulowany',
  };
  const en: Record<AgentPlanStatus, string> = {
    planning: 'Planning',
    scheduled: 'Scheduled',
    awaiting_approval: 'Awaiting approval',
    executing: 'Executing',
    paused: 'Paused',
    completed: 'Completed',
    completed_with_errors: 'Completed with errors',
    failed: 'Failed',
    cancelled: 'Cancelled',
  };
  return (isPolish ? pl : en)[status];
}

/**
 * Podgląd planu — reużywany w preview (StandardPreview.details/meta) I w
 * karcie towarzyszącej obok AgentPlanWorkspace (punkt 9). Jeden komponent,
 * dwa miejsca użycia (gestosc: reuse, nie duplikacja).
 */
const PlanSummaryCard: React.FC<{
  plan: AgentPlan;
  isPolish: boolean;
  compact?: boolean;
  /** Pomija chipy status/postęp — gdy wołający JUŻ pokazał je wyżej (np.
   * `PreviewMetaCard` w preview tabeli) — jedna karta meta, nie dwie
   * (gestosc §"żadna akcja/dana nie występuje w 2 miejscach"). */
  hideMeta?: boolean;
}> = ({ plan, isPolish, compact, hideMeta }) => (
  <div
    className={
      compact ? 'space-y-3' : 'space-y-4 rounded-xl border border-c-border-subtle bg-c-surface p-4'
    }
  >
    {!compact ? (
      <div>
        <div className="text-sm font-semibold text-c-text">{plan.title}</div>
        <div className="mt-1 text-xs text-c-text-secondary">
          {formatPlanDate(plan.createdAt, isPolish)}
        </div>
      </div>
    ) : null}
    {!hideMeta ? (
      <div className="flex flex-wrap items-center gap-2">
        <EntityStatusChip status={plan.status} />
        <MetaChip
          icon={ListChecks}
          label={`${plan.completedSteps}/${plan.totalSteps} ${isPolish ? 'kroków' : 'steps'}`}
        />
      </div>
    ) : null}
    <div>
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
        {isPolish ? 'Kroki i bramki' : 'Steps and gates'}
      </div>
      <ol className="space-y-1 text-xs text-c-text-secondary">
        {plan.steps.map((step, idx) => (
          <li key={step.id} className="flex items-start gap-1.5">
            <span className="tabular-nums text-c-text-muted">{idx + 1}.</span>
            <span className="flex-1">
              {readablePhaseName(step.toolInput) ?? step.toolName}
              {step.requiresApproval ? (
                <span className="ml-1.5 text-[10px] text-[var(--c-warning)]">
                  · {isPolish ? 'wymaga akceptacji' : 'requires approval'}
                </span>
              ) : null}
            </span>
            <span className="shrink-0 text-c-text-muted">{step.status}</span>
          </li>
        ))}
      </ol>
    </div>
    {plan.resultSummary ? (
      <div>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
          {isPolish ? 'Podsumowanie' : 'Summary'}
        </div>
        <p className="text-xs text-c-text-secondary">{plan.resultSummary}</p>
      </div>
    ) : null}
  </div>
);

export const AgentHubShell: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const currentUserRole = useAppStore((state) =>
    String(state.currentUser?.role || '').toUpperCase()
  );
  const isOperator = ['ADMIN', 'OWNER', 'SUPERADMIN'].includes(currentUserRole);
  const [searchParams, setSearchParams] = useSearchParams();

  const requestedView = searchParams.get('agentView');
  const unauthorizedOperationsRequest = requestedView === 'operations' && !isOperator;
  const validRequestedView: AgentHubTab | null =
    requestedView === 'processes' ||
    requestedView === 'templates' ||
    requestedView === 'governed_templates' ||
    requestedView === 'transformations' ||
    (requestedView === 'operations' && isOperator)
      ? requestedView
      : null;

  const [tab, setTab] = useState<AgentHubTab>(() => validRequestedView ?? 'transformations');
  const [plans, setPlans] = useState<AgentPlan[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [previewPlanId, setPreviewPlanId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TemplateRow[] | null>(null);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);

  useEffect(() => {
    const next = validRequestedView ?? 'transformations';
    setTab(next);
  }, [searchParams, validRequestedView]);

  const writeWorkspaceContext = useCallback(
    (view: AgentHubTab, context?: { transformationCaseId?: string; canonicalRunId?: string }) => {
      if (view === 'operations' && !isOperator) return;
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.set('tab', 'agent');
          next.set('agentView', view);
          if (context?.transformationCaseId) {
            next.set('transformationCaseId', context.transformationCaseId);
          }
          if (context && 'canonicalRunId' in context) {
            if (context.canonicalRunId) next.set('canonicalRunId', context.canonicalRunId);
            else next.delete('canonicalRunId');
          } else if (view !== 'operations') {
            next.delete('canonicalRunId');
          }
          return next;
        },
        { replace: false }
      );
    },
    [isOperator, setSearchParams]
  );
  const handleCanonicalContextChange = useCallback(
    (context: { transformationCaseId: string; canonicalRunId?: string }) =>
      writeWorkspaceContext('transformations', context),
    [writeWorkspaceContext]
  );
  const handleOpenOperations = useCallback(
    (context: { transformationCaseId: string; canonicalRunId: string }) =>
      writeWorkspaceContext('operations', context),
    [writeWorkspaceContext]
  );

  // Triada MUST #7 — checkbox selection "Moje procesy" (patrz nagłówek pliku
  // ★ SELECTION/BULK). Wyczyszczane przy zmianie zakładki i po odświeżeniu listy.
  const [selectedPlanIds, setSelectedPlanIds] = useState<Set<string>>(new Set());
  const [bulkCancelling, setBulkCancelling] = useState(false);

  // Menu 3 — karty otwarte (punkt 9: "Otwórz" dokłada tab, nie podmienia ekranu).
  const [openItems, setOpenItems] = useState<OpenDocument[]>([]);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [activePlanDetail, setActivePlanDetail] = useState<AgentPlan | null>(null);
  const [activePlanError, setActivePlanError] = useState<string | null>(null);

  // ── Foldery „Moje procesy" (AGT-FOLDERS, 2026-07-28) — wzór 1:1 Vault
  // (VaultDocumentsView.tsx §"Foldery WEWNĄTRZ tego sejfu"). `foldersAvailable`
  // chroni UI, gdyby migracja jeszcze nie doszła na danej bazie (fail-soft).
  const [folders, setFolders] = useState<AgentFolder[]>([]);
  const [foldersAvailable, setFoldersAvailable] = useState(false);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [projectMemberships, setProjectMemberships] = useState<Array<{ id: string; name: string }>>(
    []
  );
  // AGT-015 §6 D4 — dialog tworzenia folderu (zastępuje sekwencję window.prompt).
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderDialogBusy, setFolderDialogBusy] = useState(false);
  const [folderDialogError, setFolderDialogError] = useState<string | null>(null);

  useEffect(() => {
    Api.getMyProjectMemberships()
      .then(setProjectMemberships)
      .catch(() => setProjectMemberships([]));
  }, []);

  const loadFolders = useCallback(() => {
    // Bez `scope` — widok domyślny agentFolderService.getFolders: mój
    // prywatny + wszystkie organizacyjne + projektowe dla projektów, w
    // których jestem członkiem (patrz komentarz w serwisie backendowym).
    listAgentFolders({})
      .then((list) => {
        setFolders(list);
        setFoldersAvailable(true);
      })
      .catch(() => setFoldersAvailable(false));
  }, []);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  const folderNameById = useMemo(() => {
    const map = new Map<string, string>();
    folders.forEach((f) => map.set(f.id, f.name));
    return map;
  }, [folders]);

  const folderScopeLabel = useCallback(
    (scope: AgentFolder['scope']): string => {
      if (scope === 'user') return isPolish ? 'Prywatny' : 'Private';
      if (scope === 'project') return isPolish ? 'Projekt' : 'Project';
      return isPolish ? 'Organizacja' : 'Organization';
    },
    [isPolish]
  );

  /**
   * Nowy folder — poziom wybierany PRZY TWORZENIU (dziedziczy go na stałe,
   * jak Vault). W przeciwieństwie do Vault (poziom narzucony przez sejf, w
   * którym stoisz) Run agent jest JEDNĄ płaską listą, więc pytamy wprost.
   *
   * AGT-015 §6 D4 (odbiór, 2026-07-28): sekwencja `window.prompt` → poziom
   * cyfrą 1/2/3 → wybór projektu NUMEREM z listy zastąpiona wspólnym
   * `FolderCreateDialog` (`src/components/shared/FolderCreateDialog.tsx`,
   * dzieli komponent z `VaultDocumentsView.handleCreateFolder`). API
   * backendu (`createAgentFolder({ name, scope, projectId })`) NIEZMIENIONE.
   */
  const handleCreateFolder = useCallback(() => {
    setFolderDialogError(null);
    setFolderDialogOpen(true);
  }, []);

  const handleFolderDialogSubmit = useCallback(
    async (input: {
      name: string;
      scope: 'user' | 'project' | 'organization';
      projectId?: string;
    }) => {
      setFolderDialogBusy(true);
      setFolderDialogError(null);
      try {
        const created = await createAgentFolder({
          name: input.name,
          scope: input.scope,
          projectId: input.projectId,
        });
        setFolders((prev) => [...prev, created]);
        setFoldersAvailable(true);
        setFolderDialogOpen(false);
      } catch (error) {
        setFolderDialogError(
          error instanceof Error
            ? error.message
            : t(
                'agentPlan.hub.folders.createFailed',
                isPolish ? 'Nie udało się utworzyć folderu' : 'Failed to create folder'
              )
        );
      } finally {
        setFolderDialogBusy(false);
      }
    },
    [t, isPolish]
  );

  const handleDeleteFolder = useCallback(
    async (folderId: string) => {
      try {
        await deleteAgentFolder(folderId);
        setFolders((prev) => prev.filter((f) => f.id !== folderId));
        if (activeFolderId === folderId) setActiveFolderId(null);
      } catch (error) {
        window.alert(
          error instanceof Error
            ? error.message
            : t(
                'agentPlan.hub.folders.deleteFailed',
                isPolish ? 'Nie udało się usunąć folderu' : 'Failed to delete folder'
              )
        );
      }
    },
    [activeFolderId, t, isPolish]
  );

  const handleMoveToFolder = useCallback(async (plan: AgentPlan, folderId: string | null) => {
    setPlans((prev) =>
      prev ? prev.map((p) => (p.id === plan.id ? { ...p, folderId } : p)) : prev
    );
    try {
      await setAgentPlanFolder(plan.id, folderId);
    } catch {
      // best-effort UI optimism — re-fetch to reconcile on failure
      setPlans((prev) =>
        prev
          ? prev.map((p) => (p.id === plan.id ? { ...p, folderId: plan.folderId ?? null } : p))
          : prev
      );
    }
  }, []);

  const fetchPlans = useCallback(() => {
    setLoadError(null);
    listAgentPlans({ mine: true })
      .then(({ plans: fetched }) => setPlans(fetched))
      .catch((error) => {
        setLoadError(error instanceof Error ? error.message : 'Failed to load agent plans');
      });
  }, []);

  useEffect(() => {
    if (tab === 'processes' && !activeItemId) {
      fetchPlans();
    }
  }, [tab, activeItemId, fetchPlans]);

  // Triada MUST #7 — zaznaczenie należy do zakładki/widoku; wyjście z listy
  // (zmiana taba, otwarcie karty planu) czyści je, żeby bulk bar nie "wisiał".
  useEffect(() => {
    setSelectedPlanIds(new Set());
  }, [tab, activeItemId]);

  const fetchTemplates = useCallback(() => {
    setTemplatesError(null);
    Promise.all([listAgentProcesses(), listAgentManifests({ status: 'built' })])
      .then(([processesRes, manifestsRes]) => {
        const processRows: TemplateRow[] = processesRes.processes.map((p) => ({
          id: p.id,
          kind: 'process',
          name: p.label,
          description: p.description,
          stepCount: p.phaseCount,
          isDefault: p.isDefault,
        }));
        const manifestRows: TemplateRow[] = manifestsRes.manifests.map((m) => ({
          id: m.id,
          kind: 'manifest',
          name: isPolish ? m.displayName.pl : m.displayName.en,
          description: isPolish
            ? 'Gotowa analiza z katalogu Discovery Tools'
            : 'Ready-made Discovery Tools analysis',
          stepCount: m.stepCount ?? 0,
          isDefault: false,
        }));
        setTemplates([...processRows, ...manifestRows]);
      })
      .catch((error) => {
        setTemplatesError(error instanceof Error ? error.message : 'Failed to load templates');
      });
  }, [isPolish]);

  useEffect(() => {
    if (tab === 'templates' && !activeItemId && templates === null) {
      fetchTemplates();
    }
  }, [tab, activeItemId, templates, fetchTemplates]);

  // ── Karta w Menu 3 (punkt 9) ──────────────────────────────────────────────
  const buildOpenDoc = useCallback(
    (plan: Pick<AgentPlan, 'id' | 'title' | 'status'>): OpenDocument => ({
      id: plan.id,
      type: 'tool',
      subType: 'agent-plan',
      name: plan.title,
      status: PLAN_STATUS_TO_ITEM_STATUS[plan.status],
    }),
    []
  );

  const openPlanTab = useCallback(
    (plan: Pick<AgentPlan, 'id' | 'title' | 'status'>) => {
      setOpenItems((prev) => {
        const doc = buildOpenDoc(plan);
        const exists = prev.some((d) => d.id === plan.id);
        return exists ? prev.map((d) => (d.id === plan.id ? doc : d)) : [...prev, doc];
      });
      setActiveItemId(plan.id);
      setPreviewPlanId(null);
      setPreviewTemplateId(null);
    },
    [buildOpenDoc]
  );

  const handleOpenPlan = useCallback(
    (planId: string) => {
      const existing = plans?.find((p) => p.id === planId);
      if (existing) {
        openPlanTab(existing);
        return;
      }
      openPlanTab({
        id: planId,
        title: t('agentPlan.hub.openingPlan', isPolish ? 'Proces' : 'Process'),
        status: 'planning',
      });
    },
    [plans, openPlanTab, t, isPolish]
  );

  const handleSelectItem = useCallback((id: string) => setActiveItemId(id), []);

  const handleCloseItem = useCallback(
    (id: string) => {
      setOpenItems((prev) => prev.filter((d) => d.id !== id));
      setActiveItemId((current) => (current === id ? null : current));
      fetchPlans();
    },
    [fetchPlans]
  );

  const handleShowList = useCallback(() => {
    setActiveItemId(null);
    fetchPlans();
  }, [fetchPlans]);

  // Dociąga pełny plan (kroki, resultSummary) dla karty-towarzysza obok
  // AgentPlanWorkspace — nie polega WYŁĄCZNIE na liście `plans` (świeżo
  // utworzony plan z "Nowy proces"/"Użyj szablonu" ma to od razu z odpowiedzi
  // create; reopens z tabeli/tabów dociągają tu).
  useEffect(() => {
    if (!activeItemId) {
      setActivePlanDetail(null);
      setActivePlanError(null);
      return;
    }
    let cancelled = false;
    setActivePlanError(null);
    getAgentPlan(activeItemId)
      .then(({ plan }) => {
        if (!cancelled) setActivePlanDetail(plan);
      })
      .catch((error) => {
        if (!cancelled) {
          setActivePlanError(error instanceof Error ? error.message : 'Failed to load plan');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeItemId]);

  /**
   * Jeden handler tworzenia planu — dzielony przez "Nowy proces" (Moje
   * procesy) i "Użyj szablonu" (Szablony, AGT-011). `processId` => draft:true
   * (canvas edytowalny); `manifestId` => brak draft (dispatch od razu).
   */
  const handleCreatePlan = useCallback(
    async (input: { title: string; processId?: string; manifestId?: string; draft?: boolean }) => {
      setCreating(true);
      setCreateError(null);
      try {
        const { plan } = await createAgentPlan({
          title: input.title,
          processId: input.processId,
          manifestId: input.manifestId,
          draft: input.draft,
        });
        openPlanTab(plan);
        setActivePlanDetail(plan);
      } catch (error) {
        setCreateError(error instanceof Error ? error.message : 'Failed to create process');
      } finally {
        setCreating(false);
      }
    },
    [openPlanTab]
  );

  const handleNewProcess = useCallback(
    () =>
      handleCreatePlan({
        title: t('agentPlan.hub.newProcessTitle', 'New consulting process'),
        processId: 'classic-5',
        draft: true,
      }),
    [handleCreatePlan, t]
  );

  const handleSelectTemplate = useCallback(
    (row: TemplateRow) => {
      if (row.kind === 'process') {
        void handleCreatePlan({ title: row.name, processId: row.id, draft: true });
      } else {
        void handleCreatePlan({ title: row.name, manifestId: row.id });
      }
    },
    [handleCreatePlan]
  );

  const handleCancelPlan = useCallback(
    async (planId: string) => {
      try {
        await cancelAgentPlan(planId);
        fetchPlans();
        setPreviewPlanId(null);
      } catch {
        /* best-effort — row stays until next refresh */
      }
    },
    [fetchPlans]
  );

  // Ile z zaznaczonych wierszy jest w statusie, który da się anulować — steruje
  // disabled+tooltip przycisku "Anuluj zaznaczone" (patrz nagłówek pliku).
  const cancellableSelectedCount = useMemo(() => {
    if (selectedPlanIds.size === 0 || !plans) return 0;
    let count = 0;
    for (const plan of plans) {
      if (selectedPlanIds.has(plan.id) && CANCELLABLE_STATUSES.includes(plan.status)) count += 1;
    }
    return count;
  }, [selectedPlanIds, plans]);

  /**
   * Bulk "Anuluj zaznaczone" — brak endpointu zbiorczego w `agentPlan.api.ts`
   * (tylko `cancelAgentPlan(planId)` pojedynczo), więc wywołujemy sekwencyjnie
   * per anulowalny zaznaczony plan i odświeżamy listę raz na końcu. Ten sam
   * wzór potwierdzenia co `AssessmentHub.handleBulkDeleteList`.
   */
  const handleBulkCancelPlans = useCallback(async () => {
    if (!plans || cancellableSelectedCount === 0 || bulkCancelling) return;
    const ids = plans
      .filter((p) => selectedPlanIds.has(p.id) && CANCELLABLE_STATUSES.includes(p.status))
      .map((p) => p.id);
    if (ids.length === 0) return;
    const confirmed = window.confirm(
      isPolish
        ? `Anulować ${ids.length} zaznaczony(ch) proces(ów)? Tej operacji nie można cofnąć.`
        : `Cancel ${ids.length} selected process(es)? This cannot be undone.`
    );
    if (!confirmed) return;
    setBulkCancelling(true);
    try {
      for (const id of ids) {
        // Sekwencyjnie i best-effort — jeden nieudany cancel nie blokuje reszty
        // (spójne z `handleCancelPlan` pojedynczym, który też połyka błąd).
        try {
          await cancelAgentPlan(id);
        } catch {
          /* best-effort — kontynuuj z resztą zaznaczenia */
        }
      }
    } finally {
      setBulkCancelling(false);
      setSelectedPlanIds(new Set());
      setPreviewPlanId(null);
      fetchPlans();
    }
  }, [plans, cancellableSelectedCount, selectedPlanIds, bulkCancelling, isPolish, fetchPlans]);

  const columns: TableColumn[] = [
    {
      id: 'title',
      label: t('agentPlan.hub.columns.name', isPolish ? 'Nazwa' : 'Name'),
      width: '300px',
      render: (row: TableRow) => {
        const plan = row as unknown as AgentPlan;
        return <span className="text-sm font-semibold text-c-text">{plan.title}</span>;
      },
    },
    {
      id: 'status',
      label: t('agentPlan.hub.columns.status', isPolish ? 'Status' : 'Status'),
      width: '150px',
      render: (row: TableRow) => {
        const plan = row as unknown as AgentPlan;
        // ★ Znalezisko odbioru Mastera (2026-07-26): EntityStatusChip bez `label`
        // humanizuje SUROWY status po angielsku ("Planning") nawet w polskim UI.
        // `planStatusLabel` (słownik PL/EN, już użyty w preview linia ~671) daje
        // poprawną etykietę w obu językach.
        return (
          <EntityStatusChip status={plan.status} label={planStatusLabel(plan.status, isPolish)} />
        );
      },
    },
    {
      id: 'progress',
      label: t('agentPlan.hub.columns.progress', isPolish ? 'Postęp' : 'Progress'),
      width: '110px',
      render: (row: TableRow) => {
        const plan = row as unknown as AgentPlan;
        return (
          <MetaChip
            icon={ListChecks}
            label={`${plan.completedSteps}/${plan.totalSteps}`}
            title={t(
              'agentPlan.hub.columns.progressTitle',
              isPolish ? 'Ukończone kroki' : 'Steps completed'
            )}
          />
        );
      },
    },
    {
      // Piotr (zadanie 2026-07-28): „odpowiednie kolumny, żebyśmy zarządzali
      // agentami" — Harmonogram (Fala 1, 2026-07-26) dodał `scheduled_at` do
      // silnika, ale front nigdy go nie pokazywał. Odpowiada na „co jest
      // zaplanowane i kiedy ruszy" bez otwierania każdego wiersza.
      id: 'scheduledAt',
      label: t('agentPlan.hub.columns.scheduled', isPolish ? 'Zaplanowany na' : 'Scheduled for'),
      width: '130px',
      render: (row: TableRow) => {
        const plan = row as unknown as AgentPlan;
        return (
          <span className="text-xs text-c-text-secondary">
            {formatPlanDateTime(plan.scheduledAt, isPolish)}
          </span>
        );
      },
    },
    {
      // Odróżnia "utworzony" (kolumna Data, poniżej) od "faktycznie ruszył" —
      // plan w 'planning'/'scheduled' nie ma jeszcze `startedAt`.
      id: 'startedAt',
      label: t('agentPlan.hub.columns.lastRun', isPolish ? 'Ostatnie uruchomienie' : 'Last run'),
      width: '140px',
      render: (row: TableRow) => {
        const plan = row as unknown as AgentPlan;
        return (
          <span className="text-xs text-c-text-secondary">
            {formatPlanDateTime(plan.startedAt, isPolish)}
          </span>
        );
      },
    },
    {
      // "Ile to już trwa/trwało" — ważne dla procesów w tle (isBackground),
      // gdzie user wraca po godzinach i chce wiedzieć czy 5 minut czy 5 godzin.
      id: 'duration',
      label: t('agentPlan.hub.columns.duration', isPolish ? 'Czas wykonania' : 'Duration'),
      width: '110px',
      render: (row: TableRow) => {
        const plan = row as unknown as AgentPlan;
        const value = formatDuration(plan);
        return value === '—' ? (
          <span className="text-xs text-c-text-muted">—</span>
        ) : (
          <MetaChip icon={Timer} label={value} />
        );
      },
    },
    {
      id: 'date',
      label: t('agentPlan.hub.columns.created', isPolish ? 'Data' : 'Date'),
      width: '110px',
      render: (row: TableRow) => {
        const plan = row as unknown as AgentPlan;
        return (
          <span className="text-xs text-c-text-secondary">
            {formatPlanDate(plan.createdAt, isPolish)}
          </span>
        );
      },
    },
  ];

  // Folder aktywny w filtrze (Menu 2 huba) — filtr KLIENCKI nad planami, które
  // user i tak widzi z `listAgentPlans` (wzór 1:1 `VaultDocumentsView.tsx`
  // `matchesFolder`). Bez folderu = wszystko (łącznie z planami bez `folderId`).
  const visiblePlans = useMemo(() => {
    if (!plans) return plans;
    if (!activeFolderId) return plans;
    return plans.filter((p) => p.folderId === activeFolderId);
  }, [plans, activeFolderId]);

  const tableRows = (visiblePlans ?? []) as unknown as TableRow[];
  const previewPlan = useMemo(
    () => plans?.find((p) => p.id === previewPlanId) ?? null,
    [plans, previewPlanId]
  );

  /**
   * Pasek zaznaczenia "Moje procesy" — RENDEROWANY LOKALNIE (nie przez
   * HubBarSlots). `StandardModuleBar.bulk` renderował ten pasek jako Menu 3
   * WEWNĄTRZ własnego `ModuleNavBar` — teraz, gdy hub (MyWorkHub) rysuje
   * JEDYNE Menu 2/3, nie ma gdzie go doczepić bez rozbudowy kontraktu
   * `HubBarSlotValue` o osobny `bulk` slot. Zamiast fasady dublujemy TYLKO
   * wygląd (te same klasy `MENU_3_*`/`Menu3Chip` co
   * `StandardModuleBar.bulkContent`) i renderujemy go bezpośrednio nad
   * tabelą.
   *
   * ★ AGT-015 §6 D3 (2026-07-28, ponowna ocena — ŚWIADOMA DECYZJA, nie
   * przeoczenie): sprawdzone, czy warto wciągnąć ten pasek do
   * `HubBarSlotValue`. NIE — z trzech powodów: (1) pasek pojawia się TYLKO
   * warunkowo (selectedPlanIds.size > 0) i wyłącznie dla jednej tabeli
   * ("Moje procesy"), więc byłby jedynym opcjonalnym/warunkowym polem w
   * kontrakcie slotu, dziś w całości bezwarunkowym; (2) slot renderuje się w
   * Menu 2/3 huba, NAD `renderDynamicTabs()`/kartami otwartych obiektów —
   * odrywałby pasek bulk wizualnie od tabeli, do której się odnosi (dziś
   * siedzi BEZPOŚREDNIO nad `TableWithPreviewLayout`, linia niżej —
   * `renderBulkBar()` tuż przed nią); (3) jedyny inny caller `HubBarSlots`
   * (`VaultDocumentsView`) nie ma bulk bara wcale — rozbudowa kontraktu pod
   * JEDNEGO konsumenta to spekulacyjna generalizacja. Zostaje lokalnie.
   */
  const renderBulkBar = () => {
    if (tab !== 'processes' || activeItemId || selectedPlanIds.size === 0) return null;
    return (
      <div className="px-4 pt-3">
        <div
          className={MENU_3_INNER_CLASS}
          role="region"
          aria-label={t(
            'agentPlan.hub.bulk.actions',
            isPolish ? 'Akcje dla zaznaczonych procesów' : 'Selected process actions'
          )}
        >
          <div className={MENU_3_LEFT_CLASS}>
            <span className="inline-flex h-7 items-center rounded-full px-2.5 text-[11px] font-semibold text-c-text whitespace-nowrap">
              {t('agentPlan.hub.bulk.selected', {
                defaultValue: isPolish ? 'Zaznaczono: {{count}}' : '{{count}} selected',
                count: selectedPlanIds.size,
              })}
            </span>
            <Menu3Chip
              onClick={() => setSelectedPlanIds(new Set(tableRows.map((r) => String(r.id))))}
            >
              {t('agentPlan.hub.bulk.selectAll', isPolish ? 'Zaznacz wszystkie' : 'Select all')}
            </Menu3Chip>
            <Menu3Chip onClick={() => setSelectedPlanIds(new Set())}>
              {t('agentPlan.hub.bulk.clear', isPolish ? 'Wyczyść' : 'Clear')}
            </Menu3Chip>
          </div>
          <div className={MENU_3_RIGHT_CLASS}>
            <button
              type="button"
              onClick={() => void handleBulkCancelPlans()}
              disabled={cancellableSelectedCount === 0 || bulkCancelling}
              aria-disabled={cancellableSelectedCount === 0 || bulkCancelling}
              title={
                cancellableSelectedCount === 0
                  ? t(
                      'agentPlan.hub.bulk.cancelNote',
                      isPolish
                        ? 'W zaznaczeniu brak procesów, które da się anulować'
                        : 'None of the selected processes can be cancelled'
                    )
                  : undefined
              }
              className={`${MENU_3_ACTION_DANGER} disabled:cursor-not-allowed disabled:opacity-40`}
            >
              <XCircle size={12} />
              {bulkCancelling
                ? t('agentPlan.hub.bulk.cancelling', isPolish ? 'Anulowanie…' : 'Cancelling…')
                : t('agentPlan.hub.bulk.cancel', {
                    defaultValue: isPolish
                      ? 'Anuluj zaznaczone ({{count}})'
                      : 'Cancel selected ({{count}})',
                    count: cancellableSelectedCount,
                  })}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderProcesses = () => {
    if (loadError) {
      return (
        <EmptyState
          variant="error"
          title={t(
            'agentPlan.hub.loadErrorTitle',
            isPolish ? 'Nie udało się wczytać procesów' : 'Failed to load processes'
          )}
          description={loadError}
          onRetry={fetchPlans}
          className="h-full"
        />
      );
    }
    if (plans === null) {
      return (
        <div className="p-4">
          <LoadingState template="list" rows={4} />
        </div>
      );
    }
    if (plans.length === 0) {
      return (
        <EmptyState
          variant="new"
          icon={PlayCircle}
          title={t('agentPlan.hub.emptyTitle', isPolish ? 'Brak procesów' : 'No processes yet')}
          description={t(
            'agentPlan.hub.emptyDescription',
            isPolish
              ? 'Uruchom klasyczny schemat konsultingowy albo wybierz gotowego agenta w Szablonach.'
              : 'Start the classic consulting process or pick a ready-made agent from Templates.'
          )}
          primaryAction={{
            // AGT-015 §6 D2 (Piotr: nazwa CTA = „Nowy agent"/"New agent"): ten
            // ekran wołał osobny klucz `newProcess` ("Nowy proces") — rozjazd
            // z CTA Menu 2 (`primaryCtaValue` wyżej), które już miało
            // `newAgent`. Ujednolicone na WSPÓLNY klucz.
            label: t('agentPlan.hub.newAgent', isPolish ? 'Nowy agent' : 'New agent'),
            onClick: () => void handleNewProcess(),
          }}
          className="h-full"
        />
      );
    }
    if (activeFolderId && tableRows.length === 0) {
      return (
        <EmptyState
          icon={Folder}
          title={t(
            'agentPlan.hub.folders.emptyTitle',
            isPolish ? 'Brak procesów w tym folderze' : 'No processes in this folder'
          )}
          primaryAction={{
            label: t(
              'agentPlan.hub.folders.clearFilter',
              isPolish ? 'Pokaż wszystkie procesy' : 'Show all processes'
            ),
            onClick: () => setActiveFolderId(null),
          }}
          className="h-full"
        />
      );
    }
    return (
      <div className="h-full min-h-0">
        {createError ? <p className="px-4 pt-3 text-xs text-c-danger">{createError}</p> : null}
        {renderBulkBar()}
        <TableWithPreviewLayout<{ id: string; title: string }>
          selectedId={previewPlanId}
          selectedItem={previewPlan ? { id: previewPlan.id, title: previewPlan.title } : null}
          onSelect={setPreviewPlanId}
          onOpenFull={(id) => handleOpenPlan(id)}
          itemIds={tableRows.map((r) => String(r.id))}
          renderPreview={() => {
            if (!previewPlan) return null;
            // ★ Uwaga: `TableWithPreviewLayout` renderuje WŁASNY `PreviewPaneShell`
            // (tytuł/pin/Otwórz/× — blok 1 kanonu) wokół tego, co zwróci
            // `renderPreview` — użycie tu PEŁNEGO `StandardPreview` (który sam
            // jest `PreviewPaneShell`-em) dawało PODWÓJNY nagłówek. Zamiast
            // tego składamy treść z tych samych prymitywów co `StandardPreview`
            // (`PreviewMetaCard`) + `PlanSummaryCard` (reużyta z karty-towarzysza),
            // a akcje idą przez `renderPreviewFooter` (patrz niżej) — dokładnie
            // wzór `DecisionsPanelContent.tsx` (jedyny ekran, który realnie łączy
            // tę fasadę z bogatym preview).
            return (
              <div className="space-y-4">
                <PreviewMetaCard
                  pills={[
                    {
                      label: isPolish ? 'Status' : 'Status',
                      value: planStatusLabel(previewPlan.status, isPolish),
                      tone: PLAN_STATUS_TONE[previewPlan.status],
                    },
                    {
                      label: isPolish ? 'Postęp' : 'Progress',
                      value: `${previewPlan.completedSteps}/${previewPlan.totalSteps}`,
                    },
                  ]}
                />
                <PlanSummaryCard plan={previewPlan} isPolish={isPolish} compact hideMeta />
              </div>
            );
          }}
          renderPreviewFooter={() => {
            if (!previewPlan) return null;
            const cancellable = CANCELLABLE_STATUSES.includes(previewPlan.status);
            if (!cancellable) return null;
            return (
              <div className="grid grid-cols-2 gap-2">
                <PreviewActionButton
                  variant="destructive"
                  label={t('agentPlan.hub.rowCancel', isPolish ? 'Anuluj' : 'Cancel')}
                  icon={XCircle}
                  onClick={() => void handleCancelPlan(previewPlan.id)}
                />
              </div>
            );
          }}
        >
          <div className="p-4 pt-3">
            <StandardTable
              columns={columns}
              data={tableRows}
              selectedRowId={previewPlanId}
              onRowClick={(row) => setPreviewPlanId(String(row.id))}
              onRowDoubleClick={(row) => handleOpenPlan(String(row.id))}
              rowMenu={(row): StandardRowMenu => {
                const plan = row as unknown as AgentPlan;
                const cancellable = CANCELLABLE_STATUSES.includes(plan.status);
                return {
                  primary: [
                    {
                      id: 'open',
                      label: t('agentPlan.hub.rowOpen', isPolish ? 'Otwórz' : 'Open'),
                      onClick: () => handleOpenPlan(plan.id),
                    },
                    // AGT-FOLDERS (2026-07-28) — wzór 1:1 `VaultDocumentsView.tsx`
                    // "move-folder": submenu z "Bez folderu" + każdy widoczny folder;
                    // disabled+nota gdy user nie ma jeszcze żadnego folderu (nie ma
                    // czego wybrać — spójne z `common.comingSoonBackend` wzorcem
                    // "brak handlera = disabled z notą", tu brak DANYCH, nie backendu).
                    {
                      id: 'move-folder',
                      label: t(
                        'agentPlan.hub.rowMoveToFolder',
                        isPolish ? 'Przenieś do folderu' : 'Move to folder'
                      ),
                      icon: Folder,
                      disabled: !foldersAvailable || folders.length === 0,
                      note:
                        foldersAvailable && folders.length > 0
                          ? undefined
                          : t(
                              'agentPlan.hub.folders.noneYetNote',
                              isPolish
                                ? 'Brak folderów — utwórz jeden w pasku filtrów'
                                : 'No folders yet — create one in the filter bar'
                            ),
                      submenu: [
                        {
                          id: 'folder-none',
                          label: t(
                            'agentPlan.hub.folders.noFolder',
                            isPolish ? 'Bez folderu' : 'No folder'
                          ),
                          icon: Layers,
                          disabled: !plan.folderId,
                          onClick: () => void handleMoveToFolder(plan, null),
                        },
                        ...folders.map((f) => ({
                          id: `folder-${f.id}`,
                          label: f.name,
                          icon: Folder,
                          disabled: plan.folderId === f.id,
                          onClick: () => void handleMoveToFolder(plan, f.id),
                        })),
                      ],
                    },
                  ],
                  universalHandlers: {
                    preview: () => setPreviewPlanId(plan.id),
                  },
                  destructive: {
                    label: t('agentPlan.hub.rowCancel', isPolish ? 'Anuluj' : 'Cancel'),
                    icon: XCircle,
                    onClick: cancellable ? () => void handleCancelPlan(plan.id) : undefined,
                    note: cancellable
                      ? undefined
                      : t(
                          'agentPlan.hub.rowCancelNote',
                          isPolish ? 'Plan już zakończony' : 'Plan already finished'
                        ),
                  },
                };
              }}
              persistKey="agent.myprocesses.list"
              selection={{ selectedIds: selectedPlanIds, onChange: setSelectedPlanIds }}
            />
          </div>
        </TableWithPreviewLayout>
      </div>
    );
  };

  const templateColumns: TableColumn[] = [
    {
      id: 'name',
      label: t('agentPlan.hub.templates.columns.name', isPolish ? 'Nazwa' : 'Name'),
      width: '320px',
      render: (row: TableRow) => {
        const tpl = row as unknown as TemplateRow;
        return (
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-c-text">{tpl.name}</span>
            {tpl.isDefault ? (
              <StatusChip
                label={t('agentPlan.hub.templates.default', isPolish ? 'Domyślny' : 'Default')}
                tone="info"
                hideDot
                size="sm"
              />
            ) : null}
          </div>
        );
      },
    },
    {
      id: 'type',
      label: t('agentPlan.hub.templates.columns.type', isPolish ? 'Typ' : 'Type'),
      width: '160px',
      render: (row: TableRow) => {
        const tpl = row as unknown as TemplateRow;
        return tpl.kind === 'process' ? (
          <StatusChip
            label={t('agentPlan.hub.templates.kindProcess', isPolish ? 'Proces' : 'Process')}
            tone="info"
          />
        ) : (
          <StatusChip
            label={t(
              'agentPlan.hub.templates.kindManifest',
              isPolish ? 'Gotowa analiza' : 'Ready-made analysis'
            )}
            tone="neutral"
          />
        );
      },
    },
    {
      id: 'description',
      label: t('agentPlan.hub.templates.columns.description', isPolish ? 'Opis' : 'Description'),
      render: (row: TableRow) => {
        const tpl = row as unknown as TemplateRow;
        return <span className="text-xs text-c-text-secondary">{tpl.description}</span>;
      },
    },
    {
      id: 'steps',
      label: t('agentPlan.hub.templates.columns.steps', isPolish ? 'Liczba kroków' : 'Steps'),
      width: '150px',
      render: (row: TableRow) => {
        const tpl = row as unknown as TemplateRow;
        return (
          <MetaChip
            icon={ListChecks}
            label={String(tpl.stepCount)}
            title={t(
              'agentPlan.hub.templates.columns.stepsTitle',
              isPolish ? 'Liczba kroków szablonu' : 'Template step count'
            )}
          />
        );
      },
    },
  ];

  const templateRows = (templates ?? []) as unknown as TableRow[];
  const previewTemplate = useMemo(
    () => templates?.find((t2) => t2.id === previewTemplateId) ?? null,
    [templates, previewTemplateId]
  );

  const renderTemplates = () => {
    if (templatesError) {
      return (
        <EmptyState
          variant="error"
          title={t(
            'agentPlan.hub.templates.loadErrorTitle',
            isPolish ? 'Nie udało się wczytać szablonów' : 'Failed to load templates'
          )}
          description={templatesError}
          onRetry={fetchTemplates}
          className="h-full"
        />
      );
    }
    if (templates === null) {
      return (
        <div className="p-4">
          <LoadingState template="list" rows={4} />
        </div>
      );
    }
    if (templates.length === 0) {
      return (
        <EmptyState
          icon={FileStack}
          title={t('agentPlan.hub.templatesTitle', isPolish ? 'Szablony' : 'Templates')}
          description={t(
            'agentPlan.hub.templates.emptyDescription',
            isPolish ? 'Brak dostępnych szablonów.' : 'No templates available.'
          )}
          className="h-full"
        />
      );
    }
    return (
      <div className="h-full min-h-0">
        {createError ? <p className="px-4 pt-3 text-xs text-c-danger">{createError}</p> : null}
        <TableWithPreviewLayout<{ id: string; title: string }>
          selectedId={previewTemplateId}
          selectedItem={
            previewTemplate ? { id: previewTemplate.id, title: previewTemplate.name } : null
          }
          onSelect={setPreviewTemplateId}
          onOpenFull={(id) => {
            const tpl = templates.find((x) => x.id === id);
            if (tpl) handleSelectTemplate(tpl);
          }}
          itemIds={templateRows.map((r) => String(r.id))}
          renderPreview={() => {
            if (!previewTemplate) return null;
            // (patrz komentarz w renderProcesses powyżej — bez podwójnego
            // PreviewPaneShell, treść składana z prymitywów, akcje w footerze).
            return (
              <div className="space-y-4">
                <PreviewMetaCard
                  pills={[
                    {
                      label: isPolish ? 'Typ' : 'Type',
                      value:
                        previewTemplate.kind === 'process'
                          ? isPolish
                            ? 'Proces'
                            : 'Process'
                          : isPolish
                            ? 'Gotowa analiza'
                            : 'Ready-made analysis',
                      tone: previewTemplate.kind === 'process' ? 'info' : 'neutral',
                    },
                    { label: isPolish ? 'Kroki' : 'Steps', value: previewTemplate.stepCount },
                  ]}
                />
                <PreviewDetailsSection text={previewTemplate.description} />
              </div>
            );
          }}
          renderPreviewFooter={() => {
            if (!previewTemplate) return null;
            return (
              <div className="grid grid-cols-2 gap-2">
                <PreviewActionButton
                  variant="positive"
                  label={t(
                    'agentPlan.hub.templates.rowUse',
                    isPolish ? 'Użyj szablonu' : 'Use template'
                  )}
                  onClick={() => handleSelectTemplate(previewTemplate)}
                />
              </div>
            );
          }}
        >
          <div className="p-4 pt-3">
            <StandardTable
              columns={templateColumns}
              data={templateRows}
              selectedRowId={previewTemplateId}
              onRowClick={(row) => setPreviewTemplateId(String(row.id))}
              onRowDoubleClick={(row) => {
                const tpl = row as unknown as TemplateRow;
                handleSelectTemplate(tpl);
              }}
              rowMenu={(row): StandardRowMenu => {
                const tpl = row as unknown as TemplateRow;
                return {
                  primary: [
                    {
                      id: 'use',
                      label: t(
                        'agentPlan.hub.templates.rowUse',
                        isPolish ? 'Użyj szablonu' : 'Use template'
                      ),
                      onClick: () => handleSelectTemplate(tpl),
                    },
                  ],
                  universalHandlers: {
                    preview: () => setPreviewTemplateId(tpl.id),
                  },
                };
              }}
              persistKey="agent.templates.list"
            />
          </div>
        </TableWithPreviewLayout>
      </div>
    );
  };

  // ★ HubBarSlots (2026-07-27, zgłoszenie właściciela — 4 rzędy chrome nad
  // Run agent). Ta powłoka NIE rysuje już własnego `StandardModuleBar`; hub
  // (MyWorkHub) ma JEDYNE Menu 2/3 na ekranie i czyta to, co deklarujemy tu
  // (patrz HubBarSlots.tsx). Wyjątek: `bulk` — patrz `renderBulkBar` wyżej,
  // kontrakt slotu nie ma (jeszcze) pola na pasek zaznaczenia.
  const filterControlsNode = useMemo(() => {
    // Piotr: „My processes/Templates mają sens na poziomie listy; jak jestem
    // w agencie, to już nie ma po co go pokazywać" — ukryty przy otwartej karcie.
    if (activeItemId) return null;
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Segmented<AgentHubTab>
          value={tab}
          options={[
            {
              value: 'transformations',
              label: agentHubTabLabel('transformations', isPolish),
            },
            {
              value: 'processes',
              label: agentHubTabLabel('processes', isPolish),
            },
            {
              value: 'templates',
              label: agentHubTabLabel('templates', isPolish),
            },
            {
              value: 'governed_templates',
              label: agentHubTabLabel('governed_templates', isPolish),
            },
            ...(isOperator
              ? [
                  {
                    value: 'operations' as const,
                    label: agentHubTabLabel('operations', isPolish),
                  },
                ]
              : []),
          ]}
          onChange={(id) => writeWorkspaceContext(id)}
          testId="agent-hub-mode-switch"
        />
        {/* AGT-FOLDERS (2026-07-28) — filtr "Folder", TYLKO na "Moje procesy"
            (foldery grupują PROCESY, nie bibliotekę statycznych szablonów).
            Wzór 1:1 `VaultDocumentsView.tsx` chip "Folder". */}
        {tab === 'processes' && foldersAvailable ? (
          <Menu3DropdownChip
            data-testid="agent-hub-folder-chip"
            icon={<Folder size={14} className="text-c-text-muted" />}
            label={
              activeFolderId
                ? (folderNameById.get(activeFolderId) ??
                  t('agentPlan.hub.folders.chip', isPolish ? 'Folder' : 'Folder'))
                : t('agentPlan.hub.folders.chip', isPolish ? 'Folder' : 'Folder')
            }
            active={Boolean(activeFolderId)}
            ariaLabel={t('agentPlan.hub.folders.chip', isPolish ? 'Folder' : 'Folder')}
            items={[
              {
                id: 'all',
                label: t(
                  'agentPlan.hub.folders.allProcesses',
                  isPolish ? 'Wszystkie procesy' : 'All processes'
                ),
                icon: <Layers size={14} />,
                active: !activeFolderId,
                onSelect: () => setActiveFolderId(null),
              },
              ...folders.map((f) => ({
                id: f.id,
                label: f.name,
                icon: <Folder size={14} />,
                active: activeFolderId === f.id,
                trailing: folderScopeLabel(f.scope),
                onSelect: () => setActiveFolderId(f.id),
              })),
              {
                id: 'new-folder',
                label: t(
                  'agentPlan.hub.folders.newFolder',
                  isPolish ? 'Nowy folder…' : 'New folder…'
                ),
                icon: <FolderPlus size={14} />,
                dividerBefore: true,
                onSelect: () => void handleCreateFolder(),
              },
              ...(activeFolderId
                ? [
                    {
                      id: 'delete-folder',
                      label: t(
                        'agentPlan.hub.folders.deleteFolder',
                        isPolish ? 'Usuń ten folder' : 'Delete this folder'
                      ),
                      icon: <Trash2 size={14} />,
                      danger: true,
                      onSelect: () => void handleDeleteFolder(activeFolderId),
                    },
                  ]
                : []),
            ]}
          />
        ) : null}
      </div>
    );
  }, [
    tab,
    activeItemId,
    isPolish,
    isOperator,
    t,
    foldersAvailable,
    folders,
    activeFolderId,
    folderNameById,
    folderScopeLabel,
    handleCreateFolder,
    handleDeleteFolder,
  ]);

  const primaryCtaValue = useMemo(() => {
    if (tab !== 'processes' || activeItemId) return null;
    return {
      // Piotr: zmiana nazwy z „Nowy proces" na „Nowy agent" — TERAZ jedyny
      // klucz w tym pliku (AGT-015 §6 D2: empty-state poniżej ujednolicony
      // na ten sam klucz, `newProcess` usunięty).
      label: creating
        ? t('agentPlan.hub.newProcessLoading', isPolish ? 'Tworzenie…' : 'Creating…')
        : t('agentPlan.hub.newAgent', isPolish ? 'Nowy agent' : 'New agent'),
      // AGT-015 §6 D1: ikona CTA — przywrócona z przedmigracyjnej wersji tego
      // ekranu (`StandardModuleBar.primaryCta.icon = PlayCircle`, patrz
      // commit 401ea601c1^), zgubiona gdy ekran przeszedł na `HubBarSlots`
      // (kontrakt slotu wtedy nie niósł ikony — teraz niesie, patrz
      // `HubBarSlots.tsx`).
      icon: PlayCircle,
      onClick: () => void handleNewProcess(),
      disabled: creating,
      testId: 'agent-hub-new-agent',
    };
  }, [tab, activeItemId, creating, isPolish, handleNewProcess, t]);

  useHubBarSlot({
    filterControls: filterControlsNode,
    primaryCta: primaryCtaValue,
    openItems,
    activeItemId,
    onSelectItem: handleSelectItem,
    onCloseItem: handleCloseItem,
    onShowList: handleShowList,
  });

  const workspaceBusy = Boolean(
    (tab === 'processes' && !activeItemId && plans === null) ||
    (tab === 'templates' && !activeItemId && templates === null) ||
    (activeItemId && !activePlanDetail && !activePlanError)
  );

  return (
    <main
      className="flex-1 flex flex-col h-full overflow-hidden bg-c-bg"
      aria-label={isPolish ? 'Centrum Agenta' : 'Agent hub'}
      aria-busy={workspaceBusy}
    >
      <section
        className="shrink-0 border-b border-c-border bg-c-surface px-4 py-3"
        aria-labelledby="agent-hub-workspace-title"
        data-testid="agent-hub-workspace-summary"
      >
        <h1 id="agent-hub-workspace-title" className="text-sm font-semibold text-c-text">
          {isPolish ? 'Agent Hub — wspólna przestrzeń pracy' : 'Agent Hub — shared workspace'}
        </h1>
        <p className="mt-1 text-xs text-c-text-secondary">
          {isPolish
            ? 'Teresa przygotowuje pracę; My Work przechowuje kanoniczne Sprawy i Przebiegi; akceptacje, wyniki, historia i bezpieczne odzyskiwanie pozostają w tym samym Hubie.'
            : 'Teresa prepares the work; My Work keeps canonical Cases and Runs; approvals, outputs, history and safe recovery remain in this Hub.'}
        </p>
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {isPolish ? 'Bieżący obszar Agent Hub' : 'Current Agent Hub area'}:{' '}
          {agentHubTabLabel(tab, isPolish)}.
        </p>
        <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-c-text-muted">
          <div>
            <dt className="inline font-semibold">{isPolish ? 'Sprawa' : 'Case'}: </dt>
            <dd className="inline break-all">
              {searchParams.get('transformationCaseId') ||
                (isPolish ? 'nie wybrano' : 'not selected')}
            </dd>
          </div>
          <div>
            <dt className="inline font-semibold">{isPolish ? 'Przebieg' : 'Run'}: </dt>
            <dd className="inline break-all">
              {searchParams.get('canonicalRunId') || (isPolish ? 'nie wybrano' : 'not selected')}
            </dd>
          </div>
        </dl>
      </section>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {unauthorizedOperationsRequest ? (
          <EmptyState
            variant="forbidden"
            title={isPolish ? 'Brak dostępu do operacji Agenta' : 'Agent Operations access denied'}
            description={
              isPolish
                ? 'Diagnostyka i odzyskiwanie kanonicznego Przebiegu są dostępne tylko dla uprawnionej roli. Sprawa i pozostały kontekst URL nie zostały zmienione.'
                : 'Canonical Run diagnostics and recovery require an authorized role. The Case and remaining URL context were not changed.'
            }
            primaryAction={{
              label: isPolish ? 'Wróć do Spraw i akceptacji' : 'Return to Cases and approvals',
              onClick: () =>
                writeWorkspaceContext('transformations', {
                  transformationCaseId: searchParams.get('transformationCaseId') || undefined,
                  canonicalRunId: undefined,
                }),
            }}
            className="h-full"
          />
        ) : activeItemId ? (
          <div className="flex h-full min-h-0 overflow-hidden">
            <div className="flex-1 min-w-0 overflow-y-auto p-4">
              {activePlanError ? (
                <EmptyState variant="error" title={activePlanError} className="h-full" />
              ) : activePlanDetail && activePlanDetail.id === activeItemId ? (
                <PlanSummaryCard plan={activePlanDetail} isPolish={isPolish} />
              ) : (
                <LoadingState template="list" rows={4} />
              )}
            </div>
            <AgentPlanWorkspace
              key={activeItemId}
              initialPlanId={activeItemId}
              onClose={() => handleCloseItem(activeItemId)}
            />
          </div>
        ) : tab === 'processes' ? (
          renderProcesses()
        ) : tab === 'templates' ? (
          renderTemplates()
        ) : tab === 'governed_templates' ? (
          <AgentProcessTemplatesPanel />
        ) : tab === 'operations' ? (
          <AgentOperationsPanel initialCanonicalRunId={searchParams.get('canonicalRunId')} />
        ) : (
          <TransformationCasesPanel
            onCanonicalContextChange={handleCanonicalContextChange}
            onOpenOperations={isOperator ? handleOpenOperations : undefined}
          />
        )}
      </div>

      {/* AGT-015 §6 D4 — dialog "Nowy folder" (zastępuje window.prompt). */}
      <FolderCreateDialog
        open={folderDialogOpen}
        onClose={() => {
          if (folderDialogBusy) return;
          setFolderDialogOpen(false);
        }}
        onSubmit={handleFolderDialogSubmit}
        projects={projectMemberships}
        busy={folderDialogBusy}
        errorMessage={folderDialogError}
        title={t('agentPlan.hub.folders.newFolder', isPolish ? 'Nowy folder…' : 'New folder…')}
      />
    </main>
  );
};

export default AgentHubShell;
