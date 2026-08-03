/**
 * InitiativeDocumentView - Dynamic Section Renderer
 *
 * Refactored from a 3500-line monolith into a dynamic renderer that:
 * 1. Loads section types from the API (initiative_section_types table)
 * 2. Reads the template's visible_sections to determine which sections to show
 * 3. Renders sections dynamically using the Section Registry
 *
 * All section components live in ./sections/ and consume the InitiativeContext.
 */

import {
  AlertTriangle,
  Archive,
  ArrowRight,
  Ban,
  Calculator,
  Calendar,
  CheckCircle,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  Clock,
  Copy,
  Crosshair,
  DollarSign,
  Download,
  Edit3,
  ExternalLink,
  FileDown,
  FileSearch,
  FileText,
  FileType,
  Flag,
  FolderOpen,
  GitBranch,
  GitFork,
  GraduationCap,
  History,
  Layers,
  Lightbulb,
  Link2,
  ListChecks,
  Loader2,
  MessageSquare,
  Monitor,
  MoreVertical,
  NotebookPen,
  Package,
  Plus,
  Presentation,
  RotateCcw,
  Scale,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Undo2,
  User,
  Users,
  Wand2,
  X,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { PresentMode } from '@/components/Presentations/DeckBuilder/PresentMode';
import type { CardBlock, DeckCard } from '@/components/Presentations/wizard/types';
import { Callout, EmbeddedView, EmptyStateInline } from '@/components/shared/NModeBlocks';
import { ErrorState, SkeletonState } from '@/components/shared/states';
import { ArtifactApprovalStatusBar } from '@/components/standard/ArtifactApprovalStatusBar';
import { ArtifactPropertiesTable } from '@/components/standard/ArtifactPropertiesTable';
import {
  ARTIFACT_PANEL_CARD_CLASS_STICKY,
  ArtifactRightPanel,
  type ArtifactRightPanelSection,
} from '@/components/standard/ArtifactRightPanel';
import { EvidencePanelSection } from '@/components/standard/EvidencePanelSection';
import { LoadingState } from '@/components/ui/primitives';
import { useOpenChatWithContext } from '@/hooks/useOpenChatWithContext';
import { usePresentationMode } from '@/hooks/usePresentationMode';
import { Api, API_URL, getHeaders } from '@/services/api';
import { fetchEvidenceEnvelope } from '@/services/api/evidence.api';
import { V8PlanningApi } from '@/services/api/v8/planning';
import { V8ResultsApi } from '@/services/api/v8/results';
// ETAP 3 standardu n-Type — „Analizuj z AI" (silnik + panel wyników).
import type { CardAnalysisChange, CardAnalysisField } from '@/services/cardAnalysis';
import { mergeChangeValue } from '@/services/cardAnalysis';
import {
  getContextActions,
  getFilteredStatusActions,
  getModuleForStatus,
  getStatusActions,
  getStatusMeta,
  StatusAction,
  willChangeModule,
} from '@/services/initiativeLifecycle';
import {
  listSuggestedChanges,
  resolveSuggestedChange,
  type SuggestedChange,
} from '@/services/initiatives/suggestedChanges';
import {
  getInitiativeStatusPreflightTruth,
  saveInitiativeWriteTruth,
  updateInitiativeStatusWriteTruth,
} from '@/services/initiativeWriteTruth';
import { exportReportToPDF } from '@/services/pdf/pdfExport';
import { useAppStore } from '@/store/useAppStore';
import { useConversationStore } from '@/store/useConversationStore';
import { bumpInitiativeRefresh } from '@/store/useInitiativeRefreshStore';
import { AppView } from '@/types';
import {
  type GateAiCheckResponse,
  type GateAiReadiness,
  gateAiSoftBlocks,
  type GateAiTimeline,
} from '@/types/gateAi';
import { isArtifactApprovalUiEnabled } from '@/utils/artifactApprovalUiFlag';
import { buildArtifactCode, buildArtifactPermalink, getArtifactPath } from '@/utils/artifactLinks';
import { mapHubLoadFailureToPresentation } from '@/utils/errors/mapHubLoadFailureToPresentation';
import {
  getWorkflowStatusForInitiative,
  hasInitiativeStatusReadDrift,
} from '@/utils/initiativeWorkflowStatus';
import { isVf1InitSpecAEnabled } from '@/utils/vf1InitSpecAFlag';

import { INITIATIVE_STATUS_METADATA, InitiativeStatus } from '../../types/initiative';
import {
  type Attachment,
  type Comment,
  type LinkedItem,
  type Stakeholder,
  type StakeholderNotificationSettings,
  type StakeholderRole,
  type TaskDependency,
  type WarningThresholds,
} from '../MyWork/shared';
import { AIFieldEnhancer } from '../shared/AIFieldEnhancer';
import { AutoFitTextarea } from '../shared/AutoFitTextarea';
import { HubWorkAreaLoadError, HubWorkAreaLoading } from '../shared/ModuleHub';
import {
  NModeCanvas,
  NModeCardState,
  NModeCBoard,
  NModeHeader,
  NModeLeftNav,
  type NModePropertyField,
  type NModeSection,
  NModeSectionWrapper,
  // ToolbarAISolidButton celowo NIE importowany (SPEC-N §2.3 — poza slotem primary
  // nic nie jest solid). ETAP 1.2: AI Consultant to teraz Menu2AIButton (fiolet),
  // a ToolbarSubtleButton odszedl razem z przyciskiem "Nowy" (akcje -> kebab).
  ToolbarGhostButton,
} from '../shared/NModeLayout';
import {
  type AIConsultantAction,
  AIConsultantPanel,
} from '../shared/NModeLayout/AIConsultantPanel';
import { NCardAIAnalysisPanel } from '../shared/NModeLayout/NCardAIAnalysisPanel';
import { Menu2AIButton, NModeMenu2 } from '../shared/NModeLayout/NModeMenu2';
import { useCardAIAnalysis } from '../shared/NModeLayout/useCardAIAnalysis';
import type { EscalationRuleWithConfig, ReminderRuleWithDelivery } from '../shared/NModeSections';
import {
  type ActivityLogEntry as NModeActivityLogEntry,
  type ActivityTypeMeta,
  AttachmentsLinksCanvas,
  type CommentItem,
  type CommentPriority,
  type DateFilter,
  RaidCanvas as NModeRaidCanvas,
  type SortOrder,
} from '../shared/NModeSections';
import { SourceMetadataBlock } from '../shared/SourceMetadataBlock';
import { upsertFinancialBlock } from './financialNarrativeBlocks';
import { GateOverrideModal } from './gate-ai';
import { normalizeGateReadinessPayload } from './gateReadinessPayload';
import {
  extractInitiativeKpiRows,
  type InitiativeKpiEditorRow,
  toInitiativeKpiEditorRow,
} from './initiativeKpiContract';
import {
  createInitiativesDemoDataset,
  isShowcaseArtifactId,
  isShowcaseInitiativeId,
} from './initiativesDemoData';
import { getSourceDisplayLabel } from './InitiativeSourceLink';
import {
  DEFAULT_SECTION_ORDER,
  DEFAULT_VISIBLE_SECTIONS,
  GATE_CONFIG,
  GATE_DEFINITIONS,
  getModuleFromStatus,
  getNextGateForStatus,
  InitiativeContext,
  MODULE_CONFIG,
  SECTION_REGISTRY,
} from './sections';
// MIGRACJA (D-8): kompozycja kart Initiative wyprowadzona z WIĄŻĄCEGO kontraktu karty
// (cardContract.types.ts) — patrz sections/initiativeCardContract.ts. Za flagą (default OFF).
import {
  INITIATIVE_CARD_RENDER_IDS,
  INITIATIVE_CORE_BOARD_IDS,
  INITIATIVE_MINIMAL_BOARD_VISIBLE_IDS,
  isInitiativeCardContractEnabled,
} from './sections/initiativeCardContract';
import { InitiativeGatesWorkflowTable } from './sections/InitiativeGatesWorkflowTable';
import { ResourcesSection } from './sections/ResourcesSection';
import type {
  Decision,
  GateReadinessCheck,
  GateRoleAssignment,
  HistoryEvent,
  PendingApproval,
  RaidItem,
  SectionTypeInfo,
  StatusHistoryEntry,
  TaskItem,
  UserInfo,
  Watcher,
} from './sections/types';
import { SuggestedChangesPanel } from './Wizard/SuggestedChangesPanel';

const unwrapApiList = (response: unknown, listKey?: string): any[] => {
  if (Array.isArray(response)) return response;
  const payload = (response as { data?: unknown } | null)?.data;
  if (Array.isArray(payload)) return payload;
  if (listKey) {
    const directList = (response as Record<string, unknown> | null)?.[listKey];
    if (Array.isArray(directList)) return directList;
    const nestedList = (payload as Record<string, unknown> | null)?.[listKey];
    if (Array.isArray(nestedList)) return nestedList;
  }
  return [];
};

interface InitiativeDocumentViewProps {
  initiativeId: string;
  onBack?: () => void;
  onStatusChange?: (newStatus: string) => void;
  sourceModule?: 'tools' | 'assessment' | 'initiatives' | 'execution' | 'benefits';
  onOpenTask?: (taskId: string) => void;
  onOpenDecision?: (decisionId: string) => void;
}

const KPI_NAME_EN_MAP: Record<string, string> = {
  'Skrócenie czasu changeover': 'Changeover time reduction',
  'Redukcja odpadów rozruchowych': 'Startup scrap reduction',
  'OEE po changeover': 'Post-changeover OEE',
};

const toEnglishKpiName = (name: string, isPolish: boolean): string => {
  if (isPolish) return name;
  return KPI_NAME_EN_MAP[name] || name;
};

const toKpiNumber = (value?: string | null): number => {
  const normalized = String(value || '')
    .replace(',', '.')
    .trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Mirror of the server's CARD_CONTENT_FORMULA §B4 PASS threshold (≥ 90). Kept as a
 * local FE constant so we don't import server code into the client bundle; it only
 * labels the advisory verdict chip and must stay in sync with the service value
 * (server/src/services/initiativeGenerationService.ts → REVIEW_PASS_THRESHOLD).
 */
const REVIEW_PASS_THRESHOLD = 90;

// ── D-B: status lifecycle → Menu 1 pill tone ────────────────────────────────
// Header contract (faza 2): the card supplies statusLabel (already localized)
// + statusTone; the shell maps tone → c-* tokens (draft/neutral = muted,
// review = c-info, approved = c-success, rejected = c-danger). No bare dot,
// no raw Tailwind palette. Initiative's 13-status lifecycle is folded into the
// 4 semantic buckets: DRAFT = draft; awaiting-review = review; greenlit &
// progressing = approved; problem/terminal-negative = rejected; ARCHIVED = neutral.
type NModeStatusTone = 'draft' | 'review' | 'approved' | 'rejected' | 'neutral';
const INITIATIVE_STATUS_TONE: Record<InitiativeStatus, NModeStatusTone> = {
  [InitiativeStatus.DRAFT]: 'draft',
  [InitiativeStatus.PENDING_REVIEW]: 'review',
  [InitiativeStatus.REVIEW]: 'review',
  [InitiativeStatus.PROMOTED]: 'approved',
  [InitiativeStatus.PLANNING]: 'approved',
  [InitiativeStatus.APPROVED]: 'approved',
  [InitiativeStatus.SCHEDULED]: 'approved',
  [InitiativeStatus.EXECUTING]: 'approved',
  [InitiativeStatus.BLOCKED]: 'rejected',
  [InitiativeStatus.DONE]: 'approved',
  [InitiativeStatus.TRACKING]: 'approved',
  [InitiativeStatus.CANCELLED]: 'rejected',
  [InitiativeStatus.ARCHIVED]: 'neutral',
};

// Wzorzec N (§1 BCG) — sekcje-karty generowane przez AI, którym doklejamy
// afordancję AI-draft (badge stanu + pasek Regeneruj·Edytuj·Zaakceptuj przez
// NModeCardState). Ograniczone do sekcji z REALNYM generatorem AI w runSectionAi
// (nie no-op). Overview + Problem + Scope + Kill Criteria są scalone w
// initiative-definition / target-state-scope w tym widoku (13 kart §1 BCG →
// zestaw poniżej). Mapowanie ids = ids z initiativeNSections.
// Sekcje, których section-AI dispatch spada na handleGenerateAI (no-op toast,
// nic nie zapisuje) — dla nich NIE pokazujemy „Regeneruj". Zsynchronizowane z
// realnymi case'ami w runSectionAi. (Hoisted na moduł: statyczne + używane w
// memo sekcji przed deklaracją komponentowego SECTION_AI_NOOP.)
const SECTION_AI_NOOP_IDS: ReadonlySet<string> = new Set([
  'raci',
  'change-log',
  'workstream-owners',
  'suggested-changes',
]);

/**
 * SPEC-N §2.5 — KONTRAKT AI PER SEKCJA, deklaracja KOMPLETNA (nie opt-in).
 *
 * Reguła standardu: „każda sekcja deklaruje kontrakt AI ALBO jawne wykluczenie.
 * Milczenie przestaje być możliwe." Inwentarz A1 policzył tu 13/26 sekcji
 * z kontraktem — pozostałe 13 nie mówiły NIC, więc z kodu nie dało się odczytać,
 * czy brak afordancji AI jest decyzją, czy przeoczeniem.
 *
 * Ta mapa jest teraz JEDYNYM źródłem prawdy: `BCG_AI_SECTION_IDS` (używane przy
 * doklejaniu NModeCardState) jest z niej WYPROWADZANE, a nie utrzymywane obok.
 * Zachowanie runtime bez zmian — te same 13 sekcji dostają pasek
 * Regeneruj·Edytuj·Zaakceptuj co przed zmianą. Nowa jest wyłącznie kompletność
 * DEKLARACJI (27/27 id) i to, że każde wykluczenie ma powód zapisany w kodzie.
 *
 * `{ ai: true }`  = sekcja niesie kontrakt NModeCardState (stan + pasek akcji).
 * `{ none: true }` = jawne wykluczenie + powód (SPEC-N §2.5 wymaga `reason`).
 */
type SectionAiContract = { ai: true } | { none: true; reason: string };

const SECTION_AI_CONTRACT: Record<string, SectionAiContract> = {
  // ── Kontrakt realny (13) — sekcje z generatorem w runSectionAi ─────────────
  'initiative-definition': { ai: true }, // Overview + Problem Definition (scope card)
  'target-state-scope': { ai: true }, // Target State & Success + Scope & Kill Criteria
  tasks: { ai: true }, // Tasks & Milestones
  decisions: { ai: true }, // Decisions
  'risk-raid': { ai: true }, // RAID Log
  gates: { ai: true }, // Gates (readiness)
  'financial-analysis': { ai: true }, // Financial Analysis
  'financial-impact': { ai: true }, // Financial Impact
  kpi: { ai: true }, // KPIs & Benefits
  resources: { ai: true }, // Resources
  timeline: { ai: true }, // Timeline (plan)
  dependencies: { ai: true }, // Dependencies
  team: { ai: true }, // Team / RACI people

  // ── Wykluczenia jawne (14) ────────────────────────────────────────────────
  // Cztery poniżej są zsynchronizowane z SECTION_AI_NOOP_IDS: dispatch section-AI
  // spada na handleGenerateAI (toast, nic nie zapisuje) — pokazanie „Regeneruj"
  // obiecywałoby zdolność, której nie ma.
  raci: { none: true, reason: 'no-op w runSectionAi — macierz RACI wypełnia zespół' },
  'change-log': { none: true, reason: 'no-op w runSectionAi — dziennik zmian pisze system' },
  'workstream-owners': { none: true, reason: 'no-op w runSectionAi — obsada strumieni to decyzja' },
  'suggested-changes': {
    none: true,
    reason: 'no-op w runSectionAi — to lista propozycji AI, nie sekcja generowana',
  },
  'attachments-links': { none: true, reason: 'rejestr plików i powiązań, nie treść' },
  'used-in': { none: true, reason: 'backlinki liczy system, nie generator' },
  artifacts: { none: true, reason: 'rejestr wyjść z inicjatywy, nie treść' },
  'deliverables-milestones': { none: true, reason: 'brak generatora w runSectionAi' },
  okr: { none: true, reason: 'brak generatora w runSectionAi' },
  'lessons-learned': { none: true, reason: 'pole ręczne — wnioski spisuje zespół po fakcie' },
  hypothesis: {
    none: true,
    reason:
      'ma generację przez handleGenerateAI (CTA w stanie pustym), ale NIE ma stanu karty ' +
      '(ai-draft/edited) — świadomie nie obiecujemy paska Regeneruj·Edytuj·Zaakceptuj',
  },
  // Trzy poniżej opuściły lewą kolumnę i żyją w prawym panelu (SPEC-N §2.1/§2.2).
  comments: { none: true, reason: 'sekcja prawego panelu (SPEC-N §2.1), nie centrum' },
  'activity-log': { none: true, reason: 'sekcja prawego panelu (SPEC-N §2.1), nie centrum' },
  evidence: {
    none: true,
    reason: 'sekcja prawego panelu (SPEC-N §2.2); treść z kontraktu dowodowego HP-16, nie z sekcji',
  },
};

/**
 * Wyprowadzone z SECTION_AI_CONTRACT — patrz komentarz wyżej. NIE dopisuj tu id
 * ręcznie: dodanie sekcji do tej listy bez wpisu w mapie łamie §2.5.
 */
const BCG_AI_SECTION_IDS: ReadonlySet<string> = new Set(
  Object.entries(SECTION_AI_CONTRACT)
    .filter(([, contract]) => 'ai' in contract)
    .map(([id]) => id)
);

/**
 * Afordancja „AI przy polu" w trybie Podgląd (§4.4).
 *
 * Standard mówi: w Podglądzie NIE MA ramek edycyjnych, uchwytów zmiany
 * wysokości ani przycisków AI PRZY POLACH — ekran ma być czysty „do pokazania
 * klientowi". `AutoFitTextarea` sam gasi uchwyt i swój slot AI (`previewMode`),
 * ale 12 `AIFieldEnhancer`-ów tej karty stało POZA polem (w nagłówku pola),
 * więc żaden warunek ich nie dotyczył — audyt grafiki 2026-07-23 zmierzył
 * 4 przyciski „AI" w Podglądzie, tyle samo co w Edycji.
 *
 * Komponent-opakowanie zamiast 12 × `{!readMode && …}`: jedno miejsce decyzji,
 * zero szansy na pominięcie któregoś pola przy następnej zmianie. Zadeklarowany
 * na poziomie modułu (nie w ciele karty), żeby nie remountował się co render.
 */
const FieldAiEnhancer: React.FC<
  React.ComponentProps<typeof AIFieldEnhancer> & { hidden?: boolean }
> = ({ hidden, ...props }) => (hidden ? null : <AIFieldEnhancer {...props} />);

interface ExpandableNarrativeFieldProps {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  isPolish: boolean;
  /** Tryb Podgląd (§5.1/§4.4) — uchwyt, ramka edycyjna i edycja wyłączone. */
  previewMode?: boolean;
  /** Tylko-do-odczytu z powodu uprawnień (bez chowania ramki edycyjnej). */
  readOnly?: boolean;
}

/**
 * Opisowe pole narracyjne sekcji inicjatywy = STANDARDOWY `AutoFitTextarea`
 * (n-Type §5.1/§6.2/§6.3). Zastąpiło bespoke „ekspandowany textarea + toggle
 * Więcej/Mniej": standard daje auto-fit w obie strony, ręczne przeciągnięcie
 * uchwytu z zapamiętaniem wysokości, powrót do auto-fitu i tryb Podgląd
 * (uchwyt/ramka ukryte). Wygląd = wyłącznie tokeny `c-*`; ramka edycyjna
 * (podkreślenie) tylko w trybie Edycja przez `editClassName`.
 */
const ExpandableNarrativeField: React.FC<ExpandableNarrativeFieldProps> = ({
  value,
  onChange,
  placeholder,
  isPolish,
  previewMode = false,
  readOnly = false,
}) => (
  <AutoFitTextarea
    value={value}
    onValueChange={onChange}
    previewMode={previewMode}
    readOnly={readOnly}
    minRows={3}
    placeholder={placeholder}
    autoFitLabel={isPolish ? 'Auto-dopasowanie' : 'Auto-fit'}
    className="w-full px-0 py-2 bg-transparent text-sm leading-relaxed text-c-text-secondary focus:outline-none placeholder:text-c-text-muted transition-colors"
    editClassName="border-b border-c-border-subtle focus:border-c-focus-solid"
  />
);

export const InitiativeDocumentView: React.FC<InitiativeDocumentViewProps> = ({
  initiativeId,
  onBack,
  onStatusChange,
  sourceModule,
  onOpenTask,
  onOpenDecision,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const { isChatCollapsed, toggleChatCollapse, setCurrentView, setMyWorkIntent, currentUser } =
    useAppStore();
  const { updateWorkspaceFromView } = useConversationStore();
  const openChatWithContext = useOpenChatWithContext();

  const initiativesDemoData = useMemo(() => {
    const currentUserAny = currentUser as any;
    const currentUserName =
      currentUserAny?.name ||
      [currentUserAny?.firstName, currentUserAny?.lastName].filter(Boolean).join(' ') ||
      'Piotr Wisniewski';

    return createInitiativesDemoDataset({
      currentUserId: currentUserAny?.id,
      currentUserName,
      currentUserEmail: currentUserAny?.email,
    });
  }, [currentUser]);

  const normalizeStringList = (value: any): string[] => {
    if (Array.isArray(value)) {
      return value.map((v) => String(v ?? '').trim()).filter(Boolean);
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return [];
      return trimmed
        .split('\n')
        .map((v) => v.trim())
        .filter(Boolean);
    }
    if (value && typeof value === 'object') {
      // Common AI / backend wrapper shapes
      const maybeItems = (value as any).items ?? (value as any).list ?? (value as any).values;
      if (Array.isArray(maybeItems) || typeof maybeItems === 'string') {
        return normalizeStringList(maybeItems);
      }
      const maybeText = (value as any).text;
      if (typeof maybeText === 'string') {
        return normalizeStringList(maybeText);
      }
    }
    return [];
  };

  // ==========================================
  // STATE
  // ==========================================

  // Core state
  const [initiative, setInitiative] = useState<any | null>(null);
  const [initiativeTemplate, setInitiativeTemplate] = useState<any | null>(null);
  const [sectionTypes, setSectionTypes] = useState<SectionTypeInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState<string>('');
  const titleInputId = 'initiative-title-input';

  // Related data
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [raidItems, setRaidItems] = useState<RaidItem[]>([]);
  const [watchers, setWatchers] = useState<Watcher[]>([]);
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);

  // Editable fields
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  // Problem definition fields (structured)
  const [symptomDraft, setSymptomDraft] = useState('');
  const [rootCauseDraft, setRootCauseDraft] = useState('');
  const [costOfInactionDraft, setCostOfInactionDraft] = useState('');
  const [marketContextDraft, setMarketContextDraft] = useState('');
  // Target state description
  const [targetDescriptionDraft, setTargetDescriptionDraft] = useState('');
  // Success criteria fields (checklist-style)
  const [targetStateItems, setTargetStateItems] = useState<
    { id: string; text: string; done: boolean }[]
  >([]);
  const [successCriteriaItems, setSuccessCriteriaItems] = useState<
    { id: string; text: string; done: boolean }[]
  >([]);
  const [deliverableItems, setDeliverableItems] = useState<
    { id: string; text: string; done: boolean }[]
  >([]);
  // Scope & boundaries fields
  const [inScopeItems, setInScopeItems] = useState<string[]>([]);
  const [outScopeItems, setOutScopeItems] = useState<string[]>([]);
  const [killCriteriaItems, setKillCriteriaItems] = useState<string[]>([]);
  const [localKpis, setLocalKpis] = useState<InitiativeKpiEditorRow[]>([]);
  const [showCreateKpi, setShowCreateKpi] = useState(false);
  const [createKpiMode, setCreateKpiMode] = useState<'manual' | 'linked'>('manual');
  const [createKpiName, setCreateKpiName] = useState('');
  const [createKpiUnit, setCreateKpiUnit] = useState('');
  const [createKpiCategory, setCreateKpiCategory] = useState('benefits');
  const [createKpiBaseline, setCreateKpiBaseline] = useState('');
  const [createKpiObservationPhase, setCreateKpiObservationPhase] = useState<
    'realization' | 'post-implementation' | 'both'
  >('post-implementation');
  const [createKpiRealizationTarget, setCreateKpiRealizationTarget] = useState('');
  const [createKpiPostImplementationTarget, setCreateKpiPostImplementationTarget] = useState('');
  const [createKpiCadence, setCreateKpiCadence] = useState('MONTHLY');
  const [createKpiLibraryId, setCreateKpiLibraryId] = useState('');
  const [createKpiLibraryOptions, setCreateKpiLibraryOptions] = useState<
    Array<{
      id: string;
      name: string;
      unit?: string | null;
      category?: string | null;
      baselineValue?: number | null;
      targetValue?: number | null;
      measurementFrequency?: string;
    }>
  >([]);
  const [createKpiLibraryLoading, setCreateKpiLibraryLoading] = useState(false);
  const [kpiMenuId, setKpiMenuId] = useState<string | null>(null);
  const [editingKpiId, setEditingKpiId] = useState<string | null>(null);
  const [editKpiName, setEditKpiName] = useState('');
  const [editKpiUnit, setEditKpiUnit] = useState('');
  const [editKpiBaseline, setEditKpiBaseline] = useState('');
  const [editKpiCurrent, setEditKpiCurrent] = useState('');
  const [editKpiTarget, setEditKpiTarget] = useState('');
  const [resourceItems, setResourceItems] = useState<
    Array<{ id: string; name: string; role: string; allocation: number }>
  >([]);
  const [budgetDraft, setBudgetDraft] = useState('');
  const [resourceTools, setResourceTools] = useState<string[]>([]);
  const [showCreateResource, setShowCreateResource] = useState(false);
  const [newResourceName, setNewResourceName] = useState('');
  const [newResourceRole, setNewResourceRole] = useState('');
  const [newResourceAllocation, setNewResourceAllocation] = useState('50');
  const [newResourceTool, setNewResourceTool] = useState('');
  // Resources: Team/FTE, Budget Items, Tools (persisted via API)
  const [apiResourceItems, setApiResourceItems] = useState<
    Array<{
      id: string;
      initiativeId?: string;
      userId?: string;
      name: string;
      role: string;
      allocationPercentage: number;
      startDate?: string;
      endDate?: string;
      notes?: string;
      firstName?: string;
      lastName?: string;
      avatarUrl?: string;
      source?: 'manual' | 'ai';
      version?: number;
    }>
  >([]);
  const [apiBudgetItems, setApiBudgetItems] = useState<
    Array<{
      id: string;
      initiativeId?: string;
      category: string;
      costType: 'CAPEX' | 'OPEX';
      amount: number;
      currency: string;
      description?: string;
      source?: 'manual' | 'ai';
    }>
  >([]);
  const [apiToolItems, setApiToolItems] = useState<
    Array<{
      id: string;
      initiativeId?: string;
      name: string;
      category: string;
      vendor?: string;
      licenseCost: number;
      licenseType: string;
      status: string;
      notes?: string;
      costType?: 'CAPEX' | 'OPEX';
      source?: 'manual' | 'ai';
    }>
  >([]);
  const [apiIntangibleAssets, setApiIntangibleAssets] = useState<
    Array<{
      id: string;
      initiativeId?: string;
      assetType: string;
      name: string;
      provider?: string;
      cost: number;
      currency: string;
      validFrom?: string;
      validUntil?: string;
      status: string;
      beneficiaries?: string;
      notes?: string;
      costType?: 'CAPEX' | 'OPEX';
      source?: 'manual' | 'ai';
    }>
  >([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [linkedItems, setLinkedItems] = useState<LinkedItem[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [dependencies, setDependencies] = useState<TaskDependency[]>([]);
  const [reminders, setReminders] = useState<ReminderRuleWithDelivery[]>([]);
  const [escalationRules, setEscalationRules] = useState<EscalationRuleWithConfig[]>([]);
  const [thresholds, setThresholds] = useState<WarningThresholds>({
    warningDays: 3,
    criticalDays: 1,
    showOverdueAlert: true,
  });
  const [users, setUsers] = useState<UserInfo[]>([]);

  // Control fields
  const [priority, setPriority] = useState<string>('medium');
  const [ownerId, setOwnerId] = useState('');
  const [sponsorId, setSponsorId] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  // Timeline milestones & phases
  const [timelineMilestones, setTimelineMilestones] = useState<
    import('./sections/types').TimelineMilestone[]
  >([]);
  const [timelinePhases, setTimelinePhases] = useState<import('./sections/types').TimelinePhase[]>(
    []
  );
  const [estimatedDurationMonths, setEstimatedDurationMonths] = useState<number | null>(null);

  // ── SPEC-N §2.7 — DWA RÓŻNE POJĘCIA, DWIE RÓŻNE NAZWY ─────────────────────
  // Inwentarz A1: „Initiative miesza gęstość N/C z fullscreen card-walk pod
  // jednym słowem »Present«". Jedno słowo na dwie funkcje znaczy, że nikt (ani
  // autor, ani user) nie wie, którą włącza. Standard rozstrzyga: osobne nazwy
  // i osobne sloty.
  //
  //   densityMode: 'n' | 'c'            → GĘSTOŚĆ widoku. ETAP 1.1 n-Type
  //                                        (2026-07-23): przełącznik ZDJĘTY
  //                                        z Menu 1, karta ma jeden widok —
  //                                        wartość jest twardo pinowana na 'n'
  //                                        (strażnik pod tym hookiem).
  //   presentationMode: 'off'|'fullscreen' → TRYB POKAZU (PresentMode card-walk),
  //                                        wejście z menu kebab, nie z nagłówka.
  //
  // Powłoka (NModeHeader) nadal nazywa swój prop `presentationMode` i przyjmuje
  // 'n'|'c' — to jej dług nazewniczy, nie nasz; podajemy tam `densityMode`
  // jawnie, żeby po stronie karty nie było już dwuznaczności.
  const { mode: densityMode, setMode: setDensityMode } = usePresentationMode({
    entityType: 'initiative',
    syncURL: true,
  });

  // ETAP 1.1 n-Type: przełącznik N/C zniknął z Menu 1, więc tryb 'c' nie ma już
  // ani wejścia, ani wyjścia — a `usePresentationMode` wciąż potrafi go wczytać
  // z `?view=c` / localStorage i wpaść w gałąź `densityMode === 'c'` niżej.
  // Bez tego strażnika user, który kiedyś kliknął „C", utknąłby w nim na stałe.
  // Ten sam wzorzec ma już Task/Decision/Notification (TaskDetailView ~758).
  useEffect(() => {
    if (densityMode === 'c') {
      setDensityMode('n');
    }
  }, [densityMode, setDensityMode]);

  const [activeNSection, setActiveNSection] = useState<string>('initiative-definition');
  const [nModeSectionOrder, setNModeSectionOrder] = useState<string[] | null>(null);
  // Canon Toolbar (Layer 3) — user-toggled section visibility for the left nav.
  // Drops section ids from the nav until restored ("Restore defaults").
  const [hiddenSectionIds, setHiddenSectionIds] = useState<Set<string>>(new Set());

  // MIGRACJA (D-8): flaga kontraktu karty Initiative (default OFF; CLAUDE.md #7/#9).
  // Wartość stała per-montaż (URL/localStorage/env), więc liczymy raz. Pod flagą:
  // RDZEŃ (overview→board `initiative-definition`) staje się NIEUSUWALNY w pickerze „Sekcje".
  const initiativeCardContractEnabled = useMemo(() => isInitiativeCardContractEnabled(), []);
  // Wzorzec N (§3) — per-section AI-draft state map. Sekcje generowane AI dostają
  // badge stanu (AI-draft/Edytowane/Gotowe) + pasek Regeneruj·Edytuj·Zaakceptuj.
  // Stan trzymany LOKALNIE (brak persystencji regenerateCount w backendzie sekcji);
  // 'ai-draft' po regeneracji AI, 'edited' po ręcznej zmianie, 'done' po akceptacji.
  // Domyślnie brak wpisu = sekcja z istniejącą treścią, bez interruptu (traktowana done).
  const [sectionAiState, setSectionAiState] = useState<
    Record<string, 'ai-draft' | 'edited' | 'done'>
  >({});
  const setSectionState = useCallback((sectionId: string, next: 'ai-draft' | 'edited' | 'done') => {
    setSectionAiState((prev) => (prev[sectionId] === next ? prev : { ...prev, [sectionId]: next }));
  }, []);
  // Ref to the per-section AI dispatcher (runSectionAi), so the section-content
  // memo can trigger regeneration WITHOUT taking runSectionAi (declared later) as
  // a dependency — avoids use-before-declaration + keeps the memo stable.
  const runSectionAiRef = useRef<(sectionId: string) => void | Promise<void>>(() => {});

  // Canon Toolbar dropdown open-state (Sections / New / Export / kebab).
  const [showSectionsMenu, setShowSectionsMenu] = useState(false);
  // ETAP 1.2: przycisk "Nowy ▾" zszedl z paska do kebaba, wiec wlasny stan
  // otwarcia znika. Zmienna zostaje jako STALA false — czyta ja anyOverlayOpen
  // (guard Esc); usuniecie jej z tamtej listy zmienialoby semantyke guardu.
  const showNewMenu = false;
  const [showExportMenu, setShowExportMenu] = useState(false);
  // Kebab Menu 2 zwinięty do kebaba Menu 1 (2026-07-24), więc nikt już tego
  // stanu nie ustawia. Zostaje jako STALA false — dokładnie jak `showNewMenu`
  // wyżej — bo czyta ją `anyOverlayOpen` (guard Esc).
  const showToolbarKebab = false;

  // Tryb Read/Edit (§ menu 5A · „do pokazania klientowi"). Read = czysty widok:
  // pasek akcji kart (Regeneruj/Edytuj/Zaakceptuj) znika, pola sekcji stają się
  // read-only, akcje destrukcyjne (Archiwizuj/Usuń) i puste-stany „wypełnij" nie
  // pojawiają się. Zaimplementowane przez zwinięcie tego stanu w `canEditCards`
  // niżej (jedno źródło prawdy → propaguje do wszystkich afordancji edycji).
  // Default = Edit (readMode=false), żeby nie zmienić istniejącego zachowania.
  const [readMode, setReadMode] = useState(false);

  // Suggested changes (Formula §5 / Faza 4) — owner-side mini-gate. The Generator
  // proposes CHANGES to an existing initiative as pending suggested changes; the
  // owner accepts/rejects them here. Service degrades gracefully (never throws).
  const [suggestedChanges, setSuggestedChanges] = useState<SuggestedChange[]>([]);
  const [suggestedChangesLoading, setSuggestedChangesLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [isGeneratingAI, setIsGeneratingAI] = useState<string | null>(null);
  // Advisory quality verdict from the adversarial reviewer (§B4, PASS ≥ 90),
  // keyed by section id. Surfaced as a small chip next to the financial sections
  // so the human sees a quality signal BEFORE saving (M13 #2). ADVISORY only —
  // it never blocks the save. We opt into withReview ONLY for the financial
  // sections (highest data-quality risk), keeping the default generate path cheap.
  const [sectionReview, setSectionReview] = useState<
    Record<string, { score: number; verdict: 'PASS' | 'FAIL'; gaps: string[]; degraded: boolean }>
  >({});
  // Slot 9 — canonical artifact-level AI Consultant right panel (POZIOM 3).
  // Toggled by the solid-teal toolbar button; replaces the old one-shot generate.
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

  // Etap 5 gridu n-Type (_GRID_STABILIZATION_COMMAND_2026-07-24.md, sekcja
  // „Inicjatywa"): banner "co dalej" (InitiativeDraftJourney — „To jest
  // dokument roboczy inicjatywy — trzy kroki do startu") USUNIĘTY. SSOT
  // zakazuje instrukcyjnych pasków dublujących informacje ze statusu/
  // Properties/Actions — a etap/status i najbliższa akcja (brama) już żyją
  // w `nModePropertyFields` (pola „Status" i „Następna brama") oraz w
  // primary CTA Menu 1 (`primaryLifecycleAction`), więc banner był czystą
  // duplikacją. Stan dismissal + komponent usunięte razem z rendererem
  // niżej (był jedynym callerem InitiativeDraftJourney w repo).

  // SPEC-N §2.7 — TRYB POKAZU (fullscreen card-walk), pojęcie ROZŁĄCZNE
  // z `densityMode` ('n'|'c'). Typ jawny 'off'|'fullscreen' zamiast boolean
  // `presentOpen`, żeby z nazwy stanu było widać, że to tryb prezentacji,
  // a nie „otwarty panel".
  const [presentationMode, setPresentationMode] = useState<'off' | 'fullscreen'>('off');
  const isPresenting = presentationMode === 'fullscreen';
  // M13 Depth · Fala 1 — AI gate soft-block override modal state.
  const [gateAiOverride, setGateAiOverride] = useState<{
    targetStatus: string;
    readiness: GateAiReadiness | null;
    timeline: GateAiTimeline | null;
  } | null>(null);
  // Fork (Phase A4) — in-flight guard for the toolbar Fork action.
  const [isForking, setIsForking] = useState(false);
  // Smart Export dialog (Phase E) — section picker + target chooser.
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportSelectedSectionIds, setExportSelectedSectionIds] = useState<Set<string> | null>(
    null
  );
  const [isExporting, setIsExporting] = useState<null | 'markdown' | 'pdf' | 'notebook'>(null);

  // N-mode comment state (for CommentsCanvas — identical to Task)
  const [nCommentDraft, setNCommentDraft] = useState('');
  const [nCommentPriority, setNCommentPriority] = useState<CommentPriority>('normal');
  const [nCommentDateFilter, setNCommentDateFilter] = useState<DateFilter>('all');
  const [nCommentSortOrder, setNCommentSortOrder] = useState<SortOrder>('desc');
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showCreateDecision, setShowCreateDecision] = useState(false);
  const [showCreateRaid, setShowCreateRaid] = useState(false);
  const [tasksAiRequest, setTasksAiRequest] = useState<{
    mode: 'analyze' | 'addOne';
    nonce: number;
  } | null>(null);
  const [decisionsAiRequest, setDecisionsAiRequest] = useState<{
    mode: 'analyze' | 'addOne';
    nonce: number;
  } | null>(null);
  const [raidAiRequest, setRaidAiRequest] = useState<{ nonce: number } | null>(null);
  const [resourcesAiRequest, setResourcesAiRequest] = useState<{ nonce: number } | null>(null);
  const [timelineAiRequest, setTimelineAiRequest] = useState<{ nonce: number } | null>(null);
  const [dependenciesAiRequest, setDependenciesAiRequest] = useState<{ nonce: number } | null>(
    null
  );
  const [teamAiRequest, setTeamAiRequest] = useState<{ nonce: number } | null>(null);
  const [commentsAiRequest, setCommentsAiRequest] = useState<{ nonce: number } | null>(null);
  const [gatesAiRequest, setGatesAiRequest] = useState<{ nonce: number } | null>(null);
  const [kpisAiRequest, setKpisAiRequest] = useState<{ nonce: number } | null>(null);
  const [targetStateAiRequest, setTargetStateAiRequest] = useState<{ nonce: number } | null>(null);

  // RAID AI proposal (analyze → suggestions → apply)
  const [isRaidAIProposing, setIsRaidAIProposing] = useState(false);
  const [showRaidAIModal, setShowRaidAIModal] = useState(false);
  const [raidAiNoSuggestionsMessage, setRaidAiNoSuggestionsMessage] = useState<string | null>(null);
  const [raidAiProposal, setRaidAiProposal] = useState<{
    add: Array<{
      type: 'risk' | 'assumption' | 'issue' | 'dependency';
      title: string;
      description?: string;
      severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      rationale?: string;
    }>;
    remove: Array<{ raidId: string; reason: string }>;
  } | null>(null);
  const [raidAiSelectedAddIdx, setRaidAiSelectedAddIdx] = useState<Record<number, boolean>>({});
  const [raidAiSelectedRemoveIds, setRaidAiSelectedRemoveIds] = useState<Record<string, boolean>>(
    {}
  );

  // Comments AI proposal (analyze → suggestions → apply)
  const [isCommentsAIProposing, setIsCommentsAIProposing] = useState(false);
  const [showCommentsAIModal, setShowCommentsAIModal] = useState(false);
  const [commentsAiProposal, setCommentsAiProposal] = useState<{
    add: Array<{ content: string; rationale?: string }>;
    remove: Array<{ commentId: string; reason: string }>;
    note?: string;
  } | null>(null);
  const [commentsAiSelectedAddIdx, setCommentsAiSelectedAddIdx] = useState<Record<number, boolean>>(
    {}
  );
  const [commentsAiSelectedRemoveIds, setCommentsAiSelectedRemoveIds] = useState<
    Record<string, boolean>
  >({});

  // V4-IDEA-09: LinkGraph "Used in" backlinks
  const [initiativeBacklinks, setInitiativeBacklinks] = useState<
    Array<{ id: string; sourceType: string; sourceId: string }>
  >([]);
  const [initiativeBacklinksLoading, setInitiativeBacklinksLoading] = useState(false);

  // C7: Outputs-registry artifacts linked to this initiative (sourceInitiativeId)
  const [relatedArtifacts, setRelatedArtifacts] = useState<
    Array<{
      artifactId: string;
      outputType: string;
      title: string;
      updatedAt: string | null;
      openPath: string | null;
    }>
  >([]);
  const [relatedArtifactsLoading, setRelatedArtifactsLoading] = useState(false);

  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showPhaseDropdown, setShowPhaseDropdown] = useState(false);
  const [showApprovalWorkflow, setShowApprovalWorkflow] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [gateRoles, setGateRoles] = useState<GateRoleAssignment[]>([]);
  const [userGateRoles, setUserGateRoles] = useState<string[]>([]);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryEntry[]>([]);
  const [gateReadiness, setGateReadiness] = useState<GateReadinessCheck | null>(null);

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskIsMilestone, setNewTaskIsMilestone] = useState(false);
  const [newTaskMilestoneDate, setNewTaskMilestoneDate] = useState('');
  const [newDecisionTitle, setNewDecisionTitle] = useState('');
  const [newDecisionType, setNewDecisionType] = useState('GOVERNANCE_DECISION_MAKING');
  const [newRaidTitle, setNewRaidTitle] = useState('');
  const [newRaidType, setNewRaidType] = useState<'risk' | 'issue' | 'assumption' | 'dependency'>(
    'risk'
  );
  const [newRaidSeverity, setNewRaidSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>(
    'MEDIUM'
  );
  const [newRaidDescription, setNewRaidDescription] = useState('');

  const currentUserId = currentUser?.id || 'current-user';
  const nModeOrderStorageKey = `initiative:nmode:section-order:v2:${initiativeId}`;
  const initiativeDefinitionDraftStorageKey = `consultify-initiative-definition-draft:v1:${initiativeId}`;
  const definitionDraftRestoredRef = useRef(false);
  const decodeHtmlEntities = useCallback((value: string): string => {
    return value
      .replace(/&quot;/g, '"')
      .replace(/&#34;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  }, []);

  const requestTasksAi = useCallback((mode: 'analyze' | 'addOne') => {
    setTasksAiRequest({ mode, nonce: Date.now() });
  }, []);
  const clearTasksAiRequest = useCallback(() => setTasksAiRequest(null), []);

  const requestDecisionsAi = useCallback((mode: 'analyze' | 'addOne') => {
    setDecisionsAiRequest({ mode, nonce: Date.now() });
  }, []);
  const clearDecisionsAiRequest = useCallback(() => setDecisionsAiRequest(null), []);

  const requestRaidAi = useCallback(() => {
    setRaidAiRequest({ nonce: Date.now() });
  }, []);
  const clearRaidAiRequest = useCallback(() => setRaidAiRequest(null), []);

  const requestResourcesAi = useCallback(() => {
    setResourcesAiRequest({ nonce: Date.now() });
  }, []);
  const clearResourcesAiRequest = useCallback(() => setResourcesAiRequest(null), []);

  const requestTimelineAi = useCallback(() => {
    setTimelineAiRequest({ nonce: Date.now() });
  }, []);
  const clearTimelineAiRequest = useCallback(() => setTimelineAiRequest(null), []);

  const requestDependenciesAi = useCallback(() => {
    setDependenciesAiRequest({ nonce: Date.now() });
  }, []);
  const clearDependenciesAiRequest = useCallback(() => setDependenciesAiRequest(null), []);

  const requestTeamAi = useCallback(() => {
    setTeamAiRequest({ nonce: Date.now() });
  }, []);
  const clearTeamAiRequest = useCallback(() => setTeamAiRequest(null), []);

  const requestCommentsAi = useCallback(() => {
    setCommentsAiRequest({ nonce: Date.now() });
  }, []);
  const clearCommentsAiRequest = useCallback(() => setCommentsAiRequest(null), []);

  const requestGatesAi = useCallback(() => {
    setGatesAiRequest({ nonce: Date.now() });
  }, []);
  const clearGatesAiRequest = useCallback(() => setGatesAiRequest(null), []);

  const requestKpisAi = useCallback(() => {
    setKpisAiRequest({ nonce: Date.now() });
  }, []);
  const clearKpisAiRequest = useCallback(() => setKpisAiRequest(null), []);

  const requestTargetStateAi = useCallback(() => {
    setTargetStateAiRequest({ nonce: Date.now() });
  }, []);
  const clearTargetStateAiRequest = useCallback(() => setTargetStateAiRequest(null), []);

  // ==========================================
  // RAID AI (proposal flow like Tasks/Decisions)
  // ==========================================

  const closeRaidAIModal = useCallback(() => {
    setShowRaidAIModal(false);
    setRaidAiProposal(null);
    setRaidAiSelectedAddIdx({});
    setRaidAiSelectedRemoveIds({});
    setRaidAiNoSuggestionsMessage(null);
  }, []);

  const parseAIJson = useCallback((raw: string): any | null => {
    const text = String(raw || '').trim();
    if (!text) return null;
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const candidate = (fenced?.[1] || text).trim();
    try {
      return JSON.parse(candidate);
    } catch {
      const start = candidate.indexOf('{');
      const end = candidate.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try {
          return JSON.parse(candidate.slice(start, end + 1));
        } catch {
          return null;
        }
      }
      return null;
    }
  }, []);

  const normalizeRaidType = useCallback(
    (value: any): 'risk' | 'assumption' | 'issue' | 'dependency' => {
      const t = String(value || '')
        .trim()
        .toLowerCase();
      if (t === 'risk' || t === 'risks') return 'risk';
      if (t === 'assumption' || t === 'assumptions') return 'assumption';
      if (t === 'issue' || t === 'issues') return 'issue';
      if (t === 'dependency' || t === 'dependencies') return 'dependency';
      return 'risk';
    },
    []
  );

  const normalizeSeverity = useCallback((value: any): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' => {
    const s = String(value || '')
      .trim()
      .toUpperCase();
    if (s === 'LOW' || s === 'MEDIUM' || s === 'HIGH' || s === 'CRITICAL') return s;
    return 'MEDIUM';
  }, []);

  const buildRaidRemovalCandidates = useCallback(() => {
    const candidates: Array<{ raidId: string; title: string; type: string; why: string }> = [];
    const seen = new Map<string, string>(); // normTitle -> firstId

    const normalizeTitle = (title: string) =>
      String(title || '')
        .trim()
        .toLowerCase()
        .replace(/\s+—\s+.+$/g, '')
        .replace(/\s+/g, ' ')
        .replace(/[^\p{L}\p{N}\s]/gu, '')
        .trim();

    const junkPatterns: Array<{ re: RegExp; why: string }> = [
      { re: /\b(test|demo|dummy)\b/i, why: 'Test/demo placeholder — not a real RAID entry.' },
      { re: /\b(wip|tmp|temp)\b/i, why: 'Temporary/WIP placeholder — not a real RAID entry.' },
      { re: /^test[-_\s]*raid/i, why: 'Test placeholder — not a real RAID entry.' },
    ];

    const tooShort = (s: string) => String(s || '').trim().length < 6;
    const looksLikeGarbage = (s: string) =>
      /^\?+$/.test(s.trim()) || /^[\d\W_]+$/.test(s.trim()) || /^(new item|item|raid)$/i.test(s);

    for (const r of raidItems || []) {
      const id = String((r as any)?.id || '');
      const title = String((r as any)?.title || '').trim();
      const type = String((r as any)?.type || '').trim();
      const norm = normalizeTitle(title);

      if (!id) continue;

      if (!title) {
        candidates.push({
          raidId: id,
          title: '(empty title)',
          type,
          why: 'Empty title — invalid.',
        });
        continue;
      }

      if (tooShort(title) || looksLikeGarbage(title)) {
        candidates.push({
          raidId: id,
          title,
          type,
          why: 'Placeholder/garbage title — low quality.',
        });
      }

      for (const p of junkPatterns) {
        if (p.re.test(title)) {
          candidates.push({ raidId: id, title, type, why: p.why });
          break;
        }
      }

      if (norm) {
        const first = seen.get(`${type}:${norm}`);
        if (!first) {
          seen.set(`${type}:${norm}`, id);
        } else if (first !== id) {
          candidates.push({
            raidId: id,
            title,
            type,
            why: 'Duplicate (same type + same intent/title).',
          });
        }
      }
    }

    // De-dupe by raidId, keep first reason.
    const byId = new Map<string, (typeof candidates)[number]>();
    for (const c of candidates) {
      if (!byId.has(c.raidId)) byId.set(c.raidId, c);
    }
    return Array.from(byId.values()).slice(0, 25);
  }, [raidItems]);

  const proposeRaidWithAI = useCallback(async () => {
    setIsRaidAIProposing(true);
    setRaidAiNoSuggestionsMessage(null);
    try {
      const aiLanguage = isPolish ? 'pl' : 'en';
      const targetLanguageName = t('initiatives.english2');
      const existingIds = new Set((raidItems || []).map((r: any) => String(r?.id || '')));
      const removalCandidates = buildRaidRemovalCandidates();

      const existingRaidCompact = (raidItems || []).slice(0, 80).map((r: any) => ({
        id: String(r?.id || ''),
        type: String(r?.type || ''),
        title: String(r?.title || ''),
        severity: String(r?.severity || r?.impact || ''),
        status: String(r?.status || ''),
      }));

      const existingTasksCompact = (tasks || []).slice(0, 25).map((t: any) => ({
        id: String(t?.id || ''),
        title: String(t?.title || ''),
        status: String(t?.status || ''),
      }));

      const existingDecisionsCompact = (decisions || []).slice(0, 25).map((d: any) => ({
        id: String(d?.id || ''),
        title: String(d?.title || ''),
        status: String(d?.status || ''),
        type: String(d?.type || ''),
      }));

      const systemInstruction = [
        `You are a senior PMO risk and governance lead.`,
        `Your goal is to propose a lean, high-signal RAID log for an initiative.`,
        `Rules:`,
        `- RAID types: risk, assumption, issue, dependency.`,
        `- Keep the log lean: prefer fewer, higher-quality entries.`,
        `- Titles must be concrete and specific (no placeholders).`,
        `- Do NOT invent facts, systems, vendors, budgets, dates, owners, or KPIs not present in context.`,
        `- Use severity as a rough impact indicator: LOW | MEDIUM | HIGH | CRITICAL.`,
        `- Removal suggestions should focus on placeholders/tests/duplicates/low-quality entries.`,
        `- If REMOVAL CANDIDATES are provided, you MUST choose removals from them only (unless you explicitly justify keeping them by returning empty "remove").`,
        `- Output language MUST be ${targetLanguageName}. Translate if needed.`,
        ``,
        `Return ONLY valid JSON (no markdown, no code fences, no commentary).`,
        `IMPORTANT: For "remove", you MUST use existing raidId values only (prefer from REMOVAL CANDIDATES). Never fabricate ids.`,
        `Schema:`,
        `{`,
        `  "add": [ { "type": "risk|assumption|issue|dependency", "title": string, "description"?: string, "severity"?: "LOW|MEDIUM|HIGH|CRITICAL", "rationale"?: string } ],`,
        `  "remove": [ { "raidId": string, "reason": string } ]`,
        `}`,
        ``,
        `Mode: review. Return 0–8 items in "add" (only missing/high-value). Return 0–6 items in "remove" (only clearly low-quality/duplicate/placeholder). It is OK to return no changes (both arrays empty) if the RAID log is already good.`,
      ].join('\n');

      const contextText = [
        `[INITIATIVE CONTEXT]`,
        `Initiative name: ${initiative?.name || initiative?.title || ''}`,
        `Status: ${getWorkflowStatusForInitiative(initiative as any)}`,
        `Priority: ${initiative?.priority || ''}`,
        `Summary: ${(initiative?.summary || initiative?.description || '').toString()}`,
        ``,
        `[TASKS SNAPSHOT]`,
        JSON.stringify(existingTasksCompact, null, 2),
        ``,
        `[DECISIONS SNAPSHOT]`,
        JSON.stringify(existingDecisionsCompact, null, 2),
        ``,
        `[EXISTING RAID]`,
        JSON.stringify(existingRaidCompact, null, 2),
        ``,
        `[REMOVAL CANDIDATES]`,
        `These are flagged by deterministic quality rules. Prefer removing these if they are truly not real RAID entries:`,
        JSON.stringify(removalCandidates, null, 2),
      ].join('\n');

      const aiRes = await Api.post('/ai/refine-text?timeoutMs=20000', {
        text: contextText,
        mode: 'generate',
        systemInstruction,
        fieldLabel: 'Initiative RAID review',
        artifactContext: {
          title: initiative?.name || initiative?.title || '',
          status: getWorkflowStatusForInitiative(initiative as any),
          priority: initiative?.priority || '',
          type: 'initiative',
        },
        language: aiLanguage,
      });

      const parsed = parseAIJson(String((aiRes as any)?.text || (aiRes as any)?.content || ''));
      const proposal = {
        add: Array.isArray(parsed?.add) ? parsed.add : [],
        remove: Array.isArray(parsed?.remove) ? parsed.remove : [],
      } as NonNullable<typeof raidAiProposal>;

      proposal.add = proposal.add
        .map((x: any) => ({
          type: normalizeRaidType(x?.type),
          title: String(x?.title || '').trim(),
          description: x?.description ? String(x.description).trim() : '',
          severity: x?.severity ? normalizeSeverity(x.severity) : undefined,
          rationale: x?.rationale ? String(x.rationale).trim() : '',
        }))
        .filter((x) => x.title.length > 0)
        .slice(0, 20);

      proposal.remove = proposal.remove
        .map((x: any) => ({
          raidId: String(x?.raidId || '').trim(),
          reason: String(x?.reason || '').trim(),
        }))
        .filter((x) => x.raidId.length > 0 && x.reason.length > 0 && existingIds.has(x.raidId))
        .slice(0, 12);

      if (proposal.add.length === 0 && proposal.remove.length === 0) {
        setRaidAiNoSuggestionsMessage(t('initiatives.aiFoundNoChangeSuggestionsThe3'));
      }

      setRaidAiProposal(proposal);
      setRaidAiSelectedAddIdx(
        Object.fromEntries(proposal.add.map((_, idx) => [idx, true])) as Record<number, boolean>
      );
      setRaidAiSelectedRemoveIds(
        Object.fromEntries(proposal.remove.map((r) => [r.raidId, false])) as Record<string, boolean>
      );
      setShowRaidAIModal(true);
    } catch (e: any) {
      toast.error(e?.message || t('initiatives.failedToAnalyzeRaid2'));
    } finally {
      setIsRaidAIProposing(false);
    }
  }, [
    buildRaidRemovalCandidates,
    decisions,
    initiative,
    isPolish,
    normalizeRaidType,
    normalizeSeverity,
    parseAIJson,
    raidItems,
    tasks,
  ]);

  const applyRaidAIProposal = useCallback(async () => {
    if (!raidAiProposal) return;
    if (!initiativeId) return;

    const toAdd = raidAiProposal.add.filter((_, idx) => !!raidAiSelectedAddIdx[idx]);
    const toRemove = raidAiProposal.remove.filter((r) => !!raidAiSelectedRemoveIds[r.raidId]);

    if (toAdd.length === 0 && toRemove.length === 0) {
      toast(t('initiatives.noSelectedChanges2'));
      return;
    }

    if (toRemove.length > 0) {
      const ok = window.confirm(
        isPolish
          ? `Usunąć ${toRemove.length} element(ów) RAID? To działanie jest nieodwracalne.`
          : `Delete ${toRemove.length} RAID item(s)? This action cannot be undone.`
      );
      if (!ok) return;
    }

    setIsRaidAIProposing(true);
    try {
      // Add first (non-destructive), then remove.
      for (const x of toAdd) {
        const typeUpper = String(x.type || 'risk').toUpperCase();
        const res: any = await Api.post(`/initiatives/${initiativeId}/raid`, {
          type: typeUpper,
          title: x.title,
          description: x.description || x.rationale || '',
          severity: x.severity || 'MEDIUM',
        });

        const id = String(res?.id || res?.raidId || res?.item?.id || '');
        if (id) {
          setRaidItems((prev) => [
            ...prev,
            {
              id,
              initiativeId,
              type: x.type,
              title: x.title,
              description: x.description || x.rationale || '',
              status: 'OPEN',
              severity: x.severity || 'MEDIUM',
              ownerId: null,
              dueDate: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            } as any,
          ]);
        }
      }

      for (const r of toRemove) {
        const id = r.raidId;
        setRaidItems((prev) => prev.filter((item: any) => String(item?.id) !== String(id)));
        try {
          await Api.delete(`/initiatives/${initiativeId}/raid/${id}`);
        } catch {
          // best-effort
        }
      }

      // Refresh RAID list (server is source of truth)
      try {
        const refreshed = await Api.get(`/initiatives/${initiativeId}/raid`);
        setRaidItems(
          refreshed?.items || refreshed?.raid || (Array.isArray(refreshed) ? refreshed : [])
        );
      } catch {
        // best-effort
      }

      toast.success(t('initiatives.appliedAiSuggestions2'));
      closeRaidAIModal();
    } catch (e: any) {
      toast.error(e?.message || t('initiatives.failedToApplySuggestions2'));
    } finally {
      setIsRaidAIProposing(false);
    }
  }, [
    closeRaidAIModal,
    initiativeId,
    isPolish,
    raidAiProposal,
    raidAiSelectedAddIdx,
    raidAiSelectedRemoveIds,
    setRaidItems,
  ]);

  useEffect(() => {
    if (!raidAiRequest) return;
    const run = async () => {
      try {
        await proposeRaidWithAI();
      } finally {
        clearRaidAiRequest();
      }
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raidAiRequest?.nonce]);

  // ==========================================
  // COMPUTED VALUES
  // ==========================================

  const rawStatus = getWorkflowStatusForInitiative(initiative as any);
  const status = (
    (Object.values(InitiativeStatus) as string[]).includes(rawStatus)
      ? rawStatus
      : InitiativeStatus.DRAFT
  ) as InitiativeStatus;
  const statusMeta = getStatusMeta(status);
  // D-B: Menu 1 status pill. Label comes from INITIATIVE_STATUS_METADATA (already
  // bilingual — no new i18n key, no raw key on screen); tone from the fold above.
  const statusPillLabel = isPolish
    ? INITIATIVE_STATUS_METADATA[status].labelPL
    : INITIATIVE_STATUS_METADATA[status].label;
  const statusPillTone = INITIATIVE_STATUS_TONE[status];
  // Status actions are driven by backend `gate-readiness-check` (source of truth).
  const statusActions = useMemo(() => {
    const transitions = gateReadiness?.availableTransitions || [];
    if (!transitions || transitions.length === 0) return [];

    const byTarget = new Map<string, any>();
    transitions.forEach((t: any) => byTarget.set(String(t.targetStatus).toUpperCase(), t));

    return getStatusActions(status)
      .map((a) => {
        const tr = byTarget.get(String(a.targetStatus).toUpperCase());
        if (!tr || !tr.canCurrentUserExecute) return null;
        return { ...a, gate: tr.gate || null, requiredRoles: tr.requiredRoles || [] };
      })
      .filter(Boolean) as any[];
  }, [status, gateReadiness]);
  const statusDriftUi = useMemo(
    () => hasInitiativeStatusReadDrift(initiative as any),
    [initiative]
  );
  const primaryActions = statusActions.filter((a) => a.variant === 'primary').slice(0, 2);
  // Canon Toolbar (Warstwa 3): non-destructive transitions (primary + secondary,
  // e.g. Start Execution, Mark Complete → Done, Start Tracking, Archive) become
  // the Properties-Strip STATUS options. Destructive ones (danger: Block /
  // Cancel / Reject) live in the toolbar kebab only. Both reuse the same
  // handleStatusAction handler — no new transition semantics are introduced.
  const stripStatusActions = useMemo(
    () => statusActions.filter((a) => a.variant === 'primary' || a.variant === 'secondary'),
    [statusActions]
  );
  const destructiveStatusActions = useMemo(
    () => statusActions.filter((a) => a.variant === 'danger'),
    [statusActions]
  );
  // Wzorzec N — Menu 1 (tożsamość) niesie DOKŁADNIE JEDEN primary = przejście
  // stanu lifecycle (Submit for Review → Approve for Execution → Schedule …),
  // zależny od nextGate. To pierwsza forward-transition (primary, potem secondary).
  // Reszta akcji (Sekcje/Eksport/AI/Nowy) mieszka w Menu 3.
  const primaryLifecycleAction = useMemo(
    () => stripStatusActions.find((a) => a.variant === 'primary') || stripStatusActions[0] || null,
    [stripStatusActions]
  );
  const contextActions = useMemo(() => {
    return gateReadiness?.capabilities?.ctaBar?.contextCreateActions || [];
  }, [gateReadiness]);
  const currentModule = getModuleFromStatus(status);
  const moduleConfig = MODULE_CONFIG[currentModule];

  const topBarCaps = gateReadiness?.capabilities?.topBar;
  // §4.4 — tryb Podgląd zdejmuje edytowalność WŁAŚCIWOŚCI tak samo jak zdejmuje
  // ją z kart/sekcji (`canEditCards` niżej). Bez tego `readMode` docierał tylko
  // do treści, a status/priorytet/właściciel/termin zostawały żywymi kontrolkami
  // (audyt grafiki 2026-07-23: 5 × SELECT + 1 × INPUT[date] z readOnly:false
  // zmierzone IDENTYCZNIE w Edycji i w Podglądzie → przełącznik był dekoracją).
  const canEditPriority = !!topBarCaps?.canEditPriority && !readMode;
  const canEditOwner = !!topBarCaps?.canEditOwner && !readMode;
  const canEditTargetDate = !!topBarCaps?.canEditTargetDate && !readMode;
  // Tryb Read (readMode=true) globalnie wyłącza edycję kart/sekcji — jedno źródło
  // prawdy dla WSZYSTKICH afordancji edycji (readOnly pól, hideActions pasków,
  // onEdit/onAccept, empty-state „wypełnij", Archiwizuj/Usuń). Uprawnienie serwera
  // dalej obowiązuje (AND), więc read-mode nigdy nie „odblokuje" edycji.
  const canEditCards = !!gateReadiness?.capabilities?.cards?.canEditCards && !readMode;
  const canUseAi = !!gateReadiness?.capabilities?.ctaBar?.canUseAi;
  // D-A tryb otwarcia — set the card's OWN readMode once, on first load, from the
  // lifecycle state: a committed initiative (anything past DRAFT) opens in PODGLĄD
  // (clean presentation — readMode=true), a still-being-authored DRAFT opens ready
  // to edit (readMode=false, the existing default). Because titleReadOnly tracks
  // canEditCards (which folds readMode), the Menu 1 title follows the same rule:
  // span in preview, click→input in edit — and the Edycja/Podgląd toggle stays
  // consistent across title + body. A brand-new artifact (no id) always opens in
  // edit. Runs once (ref-guarded) so it never fights a later manual toggle.
  const didInitReadModeRef = useRef(false);
  useEffect(() => {
    if (didInitReadModeRef.current || !initiative) return;
    didInitReadModeRef.current = true;
    if (initiativeId && status !== InitiativeStatus.DRAFT) setReadMode(true);
  }, [initiative, initiativeId, status]);
  // Document-interior lifecycle affordances (Archive / Delete). Visible only to
  // users with write access; server re-enforces (archive: lifecycle, delete:
  // DRAFT/CANCELLED only → 409 otherwise). Wires handleArchive/handleDelete,
  // which were defined but previously unreachable from the document toolbar.
  const canArchiveDoc = canEditCards && status !== 'ARCHIVED' && status !== 'DRAFT';
  const canDeleteDoc = canEditCards && (status === 'DRAFT' || status === 'CANCELLED');

  // ── Mark Complete (Canon Blok C) ────────────────────────────────────────
  // section_completions is an AI signal only — it never locks fields. Persisted
  // as a JSON map on the initiatives row (lazy-ALTER'd TEXT column server-side).
  const sectionCompletions = useMemo<Record<string, boolean>>(() => {
    const raw = initiative?.sectionCompletions ?? initiative?.section_completions;
    if (!raw) return {};
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) || {};
      } catch {
        return {};
      }
    }
    return typeof raw === 'object' ? (raw as Record<string, boolean>) : {};
  }, [initiative]);

  const handleToggleSectionComplete = useCallback(
    async (sectionId: string) => {
      const prevMap = sectionCompletions;
      const next = { ...prevMap, [sectionId]: !prevMap[sectionId] };
      // Optimistic — reflect immediately in nav badge + section visual.
      setInitiative((prev: any) => ({
        ...prev,
        sectionCompletions: next,
        section_completions: next,
      }));
      try {
        await saveInitiativeWriteTruth(initiativeId, { sectionCompletions: next });
      } catch {
        // Rollback on failure.
        setInitiative((prev: any) => ({
          ...prev,
          sectionCompletions: prevMap,
          section_completions: prevMap,
        }));
        toast.error(t('initiatives.failedToSaveSectionStatus2'));
      }
    },
    [sectionCompletions, initiativeId, isPolish]
  );

  // ── Canon sections persisted via lazy-ALTER'd columns (Phase C) ──────────
  // hypothesis_statement is separate from the legacy `hypothesis` column (which
  // stores the Initiative Scope narrative via the `description` alias).
  const savedHypothesis = (initiative?.hypothesisStatement ??
    initiative?.hypothesis_statement ??
    '') as string;
  const savedLessons = (initiative?.lessonsLearned ?? initiative?.lessons_learned ?? '') as string;
  const parseJsonField = useCallback((raw: unknown): any[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try {
        const v = JSON.parse(raw);
        return Array.isArray(v) ? v : [];
      } catch {
        return [];
      }
    }
    return [];
  }, []);
  const changeLogItems = useMemo(
    () => parseJsonField(initiative?.changeLog ?? initiative?.change_log),
    [initiative, parseJsonField]
  );
  const okrItems = useMemo(() => parseJsonField(initiative?.okrs), [initiative, parseJsonField]);

  const [hypothesisDraft, setHypothesisDraft] = useState('');
  const [lessonsDraft, setLessonsDraft] = useState('');
  const [changeLogDraft, setChangeLogDraft] = useState('');
  const [okrDraft, setOkrDraft] = useState('');
  useEffect(() => {
    setHypothesisDraft(savedHypothesis);
  }, [savedHypothesis]);
  useEffect(() => {
    setLessonsDraft(savedLessons);
  }, [savedLessons]);

  // Generic persist for the lazy-ALTER'd canon fields. Optimistic + rollback.
  const persistInitiativeField = useCallback(
    async (patch: Record<string, unknown>, mirror: Record<string, unknown>) => {
      const snapshot = { ...mirror };
      setInitiative((prev: any) => ({ ...prev, ...patch, ...mirror }));
      try {
        await saveInitiativeWriteTruth(initiativeId, patch);
      } catch {
        setInitiative((prev: any) => ({ ...prev, ...snapshot }));
        toast.error(t('initiatives.saveFailed2'));
      }
    },
    [initiativeId, isPolish]
  );

  const saveHypothesis = useCallback(() => {
    if (hypothesisDraft === savedHypothesis) return;
    void persistInitiativeField(
      { hypothesisStatement: hypothesisDraft },
      { hypothesisStatement: hypothesisDraft, hypothesis_statement: hypothesisDraft }
    );
  }, [hypothesisDraft, savedHypothesis, persistInitiativeField]);

  const saveLessons = useCallback(() => {
    if (lessonsDraft === savedLessons) return;
    void persistInitiativeField(
      { lessonsLearned: lessonsDraft },
      { lessonsLearned: lessonsDraft, lessons_learned: lessonsDraft }
    );
  }, [lessonsDraft, savedLessons, persistInitiativeField]);

  const genId = useCallback(() => Math.random().toString(36).slice(2, 10), []);
  const addChangeLogEntry = useCallback(
    (entry: { change: string; reason?: string; impact?: string }) => {
      const cu = currentUser as any;
      const next = [
        ...changeLogItems,
        {
          id: genId(),
          date: new Date().toISOString().slice(0, 10),
          user: cu?.firstName || cu?.email || 'You',
          change: entry.change,
          reason: entry.reason || '',
          impact: entry.impact || '',
        },
      ];
      void persistInitiativeField({ changeLog: next }, { changeLog: next, change_log: next });
    },
    [changeLogItems, currentUser, genId, persistInitiativeField]
  );
  const removeChangeLogEntry = useCallback(
    (id: string) => {
      const next = changeLogItems.filter((e: any) => e.id !== id);
      void persistInitiativeField({ changeLog: next }, { changeLog: next, change_log: next });
    },
    [changeLogItems, persistInitiativeField]
  );

  const addOkr = useCallback(
    (objective: string) => {
      const next = [...okrItems, { id: genId(), objective, keyResults: [], confidence: 'MEDIUM' }];
      void persistInitiativeField({ okrs: next }, { okrs: next });
    },
    [okrItems, genId, persistInitiativeField]
  );
  const updateOkr = useCallback(
    (id: string, patch: Record<string, unknown>) => {
      const next = okrItems.map((o: any) => (o.id === id ? { ...o, ...patch } : o));
      void persistInitiativeField({ okrs: next }, { okrs: next });
    },
    [okrItems, persistInitiativeField]
  );
  const removeOkr = useCallback(
    (id: string) => {
      const next = okrItems.filter((o: any) => o.id !== id);
      void persistInitiativeField({ okrs: next }, { okrs: next });
    },
    [okrItems, persistInitiativeField]
  );

  const toggleSection = useCallback((id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const openSection = useCallback(
    (sectionId: string) => {
      if (!sectionId) return;
      // Ensure expanded in D-mode (accordion).
      setExpandedSections((prev) => {
        const next = new Set(prev);
        next.add(sectionId);
        return next;
      });
      // Switch active section in N-mode (left nav).
      const nModeMap: Record<string, string> = {
        overview: 'initiative-definition',
        problemDefinition: 'initiative-definition',
        targetState: 'target-state-scope',
        scope: 'target-state-scope',
        raid: 'risk-raid',
        kpis: 'kpi',
        history: 'activity-log',
        attachments: 'attachments-links',
        linkedItems: 'attachments-links',
      };
      const mappedN = nModeMap[sectionId] || sectionId;
      setActiveNSection(mappedN);
    },
    [setActiveNSection]
  );

  const focusTopBarField = useCallback(
    (field: 'title' | 'priority' | 'owner' | 'targetDate') => {
      const ids: Record<typeof field, string> = {
        title: titleInputId,
        priority: 'initiative-topbar-priority',
        owner: 'initiative-topbar-owner',
        targetDate: 'initiative-topbar-targetDate',
      };
      const id = ids[field];
      // Scroll to top so header/strip is visible.
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch {
        // ignore
      }
      // Focus after a tick to allow layout updates.
      window.setTimeout(() => {
        const el = document.getElementById(id) as any;
        if (el && typeof el.focus === 'function') {
          el.focus();
        }
      }, 50);
    },
    [titleInputId]
  );

  useEffect(() => {
    if (!kpiMenuId) return;
    const onDocClick = () => setKpiMenuId(null);
    const t = setTimeout(() => document.addEventListener('click', onDocClick), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('click', onDocClick);
    };
  }, [kpiMenuId]);

  const startEditKpi = useCallback(
    (kpi: {
      id: string;
      name: string;
      unit: string;
      baseline: string;
      current: string;
      target: string;
      cadence?: string;
    }) => {
      setEditingKpiId(kpi.id);
      setEditKpiName(kpi.name || '');
      setEditKpiUnit(kpi.unit || '');
      setEditKpiBaseline(kpi.baseline || '');
      setEditKpiCurrent(kpi.current || '');
      setEditKpiTarget(kpi.target || '');
    },
    []
  );

  const cancelEditKpi = useCallback(() => {
    setEditingKpiId(null);
    setEditKpiName('');
    setEditKpiUnit('');
    setEditKpiBaseline('');
    setEditKpiCurrent('');
    setEditKpiTarget('');
  }, []);

  const resetCreateKpiDraft = useCallback(() => {
    setCreateKpiMode('manual');
    setCreateKpiName('');
    setCreateKpiUnit('');
    setCreateKpiCategory('benefits');
    setCreateKpiBaseline('');
    setCreateKpiObservationPhase('post-implementation');
    setCreateKpiRealizationTarget('');
    setCreateKpiPostImplementationTarget('');
    setCreateKpiCadence('MONTHLY');
    setCreateKpiLibraryId('');
  }, []);

  useEffect(() => {
    if (!showCreateKpi) return;
    let cancelled = false;
    setCreateKpiLibraryLoading(true);
    V8ResultsApi.getKpiCatalog()
      .then((catalog) => {
        if (cancelled) return;
        const options = Array.isArray(catalog?.kpis)
          ? catalog.kpis.map((kpi) => ({
              id: kpi.id,
              name: kpi.name,
              unit: kpi.unit,
              category: kpi.category,
              baselineValue: kpi.baselineValue,
              targetValue: kpi.targetValue,
              measurementFrequency: kpi.measurementFrequency,
            }))
          : [];
        setCreateKpiLibraryOptions(options);
      })
      .catch(() => {
        if (!cancelled) setCreateKpiLibraryOptions([]);
      })
      .finally(() => {
        if (!cancelled) setCreateKpiLibraryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showCreateKpi]);

  useEffect(() => {
    if (createKpiMode !== 'linked' || !createKpiLibraryId) return;
    const selected = createKpiLibraryOptions.find((option) => option.id === createKpiLibraryId);
    if (!selected) return;
    setCreateKpiName(selected.name || '');
    setCreateKpiUnit(String(selected.unit || ''));
    setCreateKpiCategory(String(selected.category || 'benefits'));
    setCreateKpiBaseline(
      selected.baselineValue == null || Number.isNaN(Number(selected.baselineValue))
        ? ''
        : String(selected.baselineValue)
    );
    setCreateKpiCadence(String(selected.measurementFrequency || 'MONTHLY'));
    setCreateKpiRealizationTarget(
      selected.targetValue == null || Number.isNaN(Number(selected.targetValue))
        ? ''
        : String(selected.targetValue)
    );
    setCreateKpiPostImplementationTarget(
      selected.targetValue == null || Number.isNaN(Number(selected.targetValue))
        ? ''
        : String(selected.targetValue)
    );
  }, [createKpiLibraryId, createKpiLibraryOptions, createKpiMode]);

  const createKpi = useCallback(async () => {
    if (!initiativeId) return;
    if (createKpiMode === 'linked' && !createKpiLibraryId) {
      toast.error(t('initiatives.selectAKpiFromTheList2'));
      return;
    }
    if (createKpiMode === 'manual' && !createKpiName.trim()) {
      toast.error(t('initiatives.kpiNameIsRequired2'));
      return;
    }

    setIsMutating(true);
    try {
      const baselineValue = toKpiNumber(createKpiBaseline);
      const realizationTarget = toKpiNumber(createKpiRealizationTarget);
      const postImplementationTarget = toKpiNumber(createKpiPostImplementationTarget);
      const fallbackTarget =
        postImplementationTarget ?? realizationTarget ?? toKpiNumber(createKpiRealizationTarget);
      const payload = {
        kpiId: createKpiMode === 'linked' ? createKpiLibraryId : undefined,
        definitionSource: createKpiMode === 'linked' ? 'library' : 'initiative-custom',
        name: createKpiMode === 'manual' ? createKpiName.trim() : undefined,
        category: createKpiCategory || 'benefits',
        unit: createKpiUnit.trim() || undefined,
        baselineValue,
        targetValue: fallbackTarget,
        measurementFrequency: createKpiCadence || 'MONTHLY',
        observationPhase: createKpiObservationPhase,
        trackedInRealization:
          createKpiObservationPhase === 'realization' || createKpiObservationPhase === 'both',
        trackedPostImplementation:
          createKpiObservationPhase === 'post-implementation' ||
          createKpiObservationPhase === 'both',
        realizationExpectation: {
          baselineValue,
          targetValue: realizationTarget,
          measurementFrequency: createKpiCadence || 'MONTHLY',
        },
        postImplementationExpectation: {
          baselineValue,
          targetValue: postImplementationTarget,
          measurementFrequency: createKpiCadence || 'MONTHLY',
        },
      };

      const res = await Api.post(`/initiatives/${initiativeId}/kpis`, payload);
      const created = res?.kpi || res?.data?.kpi;
      setLocalKpis((prev) => [
        created
          ? toInitiativeKpiEditorRow(created, 0)
          : {
              id: `kpi-${Date.now()}`,
              mappingId: null,
              definitionSource: payload.definitionSource as 'library' | 'initiative-custom',
              name:
                createKpiMode === 'linked'
                  ? createKpiLibraryOptions.find((option) => option.id === createKpiLibraryId)
                      ?.name || createKpiName.trim()
                  : createKpiName.trim(),
              category: payload.category,
              unit: createKpiUnit.trim(),
              baseline: String(baselineValue ?? ''),
              target: String(fallbackTarget ?? ''),
              current: '',
              observationPhase: createKpiObservationPhase,
              trackedInRealization: Boolean(payload.trackedInRealization),
              trackedPostImplementation: Boolean(payload.trackedPostImplementation),
              realizationTarget: String(realizationTarget ?? ''),
              postImplementationTarget: String(postImplementationTarget ?? ''),
              cadence: createKpiCadence || 'MONTHLY',
            },
        ...prev,
      ]);
      toast.success(
        createKpiMode === 'linked'
          ? t('initiatives.kpiLinkedToInitiative2')
          : t('initiatives.kpiAddedToInitiative2')
      );
      resetCreateKpiDraft();
      setShowCreateKpi(false);
    } catch {
      toast.error(t('initiatives.failedToAddKpi2'));
    } finally {
      setIsMutating(false);
    }
  }, [
    createKpiBaseline,
    createKpiCadence,
    createKpiLibraryId,
    createKpiLibraryOptions,
    createKpiMode,
    createKpiName,
    createKpiObservationPhase,
    createKpiPostImplementationTarget,
    createKpiRealizationTarget,
    createKpiUnit,
    createKpiCategory,
    initiativeId,
    isPolish,
    resetCreateKpiDraft,
  ]);

  const saveEditKpi = useCallback(async () => {
    if (!initiativeId || !editingKpiId || !editKpiName.trim() || !editKpiUnit.trim()) return;
    setIsMutating(true);
    try {
      const baselineValue = toKpiNumber(editKpiBaseline);
      const targetValue = toKpiNumber(editKpiTarget);
      const currentValue = toKpiNumber(editKpiCurrent);
      const existing = localKpis.find((k) => k.id === editingKpiId);
      const res = await Api.put(`/initiatives/${initiativeId}/kpis/${editingKpiId}`, {
        name: editKpiName.trim(),
        unit: editKpiUnit.trim(),
        baselineValue,
        targetValue,
        currentValue,
        category: existing?.category || 'benefits',
        observationPhase: existing?.observationPhase || 'post-implementation',
        trackedInRealization: existing?.trackedInRealization ?? false,
        trackedPostImplementation: existing?.trackedPostImplementation ?? true,
        measurementFrequency: existing?.cadence || 'MONTHLY',
        realizationExpectation: {
          targetValue: toKpiNumber(existing?.realizationTarget || existing?.target),
          measurementFrequency: existing?.cadence || 'MONTHLY',
        },
        postImplementationExpectation: {
          targetValue: toKpiNumber(existing?.postImplementationTarget || existing?.target),
          measurementFrequency: existing?.cadence || 'MONTHLY',
        },
      });

      const saved = res?.kpi || res?.data?.kpi;
      setLocalKpis((prev) =>
        prev.map((k) =>
          k.id === editingKpiId
            ? {
                ...k,
                ...(saved
                  ? toInitiativeKpiEditorRow(saved, 0)
                  : {
                      name: editKpiName.trim(),
                      unit: editKpiUnit.trim(),
                      baseline: String(baselineValue ?? ''),
                      current: String(currentValue ?? ''),
                      target: String(targetValue ?? ''),
                      realizationTarget: String(existing?.realizationTarget ?? targetValue ?? ''),
                      postImplementationTarget: String(
                        existing?.postImplementationTarget ?? targetValue ?? ''
                      ),
                      cadence: String(existing?.cadence ?? 'MONTHLY'),
                    }),
              }
            : k
        )
      );
      toast.success(t('initiatives.kpiUpdated2'));
      cancelEditKpi();
    } catch {
      toast.error(t('initiatives.failedToSaveKpi2'));
    } finally {
      setIsMutating(false);
    }
  }, [
    initiativeId,
    cancelEditKpi,
    editKpiBaseline,
    editKpiCurrent,
    editKpiName,
    editKpiTarget,
    editKpiUnit,
    editingKpiId,
    isPolish,
    localKpis,
  ]);

  const duplicateKpi = useCallback(
    async (kpi: InitiativeKpiEditorRow) => {
      if (!initiativeId) return;
      setIsMutating(true);
      try {
        const baselineValue = toKpiNumber(kpi.baseline);
        const targetValue = toKpiNumber(kpi.target);
        const res = await Api.post(`/initiatives/${initiativeId}/kpis`, {
          name: `${kpi.name} (${t('initiatives.copy2')})`,
          category: String(kpi.category || 'benefits'),
          unit: kpi.unit || '%',
          description: null,
          baselineValue,
          targetValue,
          measurementFrequency: kpi.cadence || 'MONTHLY',
          observationPhase: kpi.observationPhase || 'post-implementation',
          trackedInRealization: kpi.trackedInRealization ?? false,
          trackedPostImplementation: kpi.trackedPostImplementation ?? true,
          realizationExpectation: {
            targetValue: toKpiNumber(kpi.realizationTarget || kpi.target),
            measurementFrequency: kpi.cadence || 'MONTHLY',
          },
          postImplementationExpectation: {
            targetValue: toKpiNumber(kpi.postImplementationTarget || kpi.target),
            measurementFrequency: kpi.cadence || 'MONTHLY',
          },
        });

        const created = res?.kpi || res?.data?.kpi || null;
        setLocalKpis((prev) => [
          created
            ? toInitiativeKpiEditorRow(created, 0)
            : {
                ...kpi,
                id: `kpi-${Date.now()}`,
                name: `${kpi.name} (${t('initiatives.copy2')})`,
                baseline: String(baselineValue),
                target: String(targetValue),
                current: String(baselineValue),
              },
          ...prev,
        ]);
        toast.success(t('initiatives.kpiDuplicated2'));
      } catch {
        toast.error(t('initiatives.failedToDuplicateKpi2'));
      } finally {
        setIsMutating(false);
      }
    },
    [initiativeId, isPolish]
  );

  const removeKpi = useCallback(
    async (kpiId: string) => {
      if (!initiativeId) return;
      setIsMutating(true);
      try {
        await Api.delete(`/initiatives/${initiativeId}/kpis/${kpiId}`);
        setLocalKpis((prev) => prev.filter((k) => k.id !== kpiId));
        if (editingKpiId === kpiId) cancelEditKpi();
        toast.success(t('initiatives.kpiRemoved2'));
      } catch {
        toast.error(t('initiatives.failedToRemoveKpi2'));
      } finally {
        setIsMutating(false);
      }
    },
    [initiativeId, cancelEditKpi, editingKpiId, isPolish]
  );

  const tasksDone = useMemo(
    () => tasks.filter((t) => t.status === 'done' || t.status === 'DONE').length,
    [tasks]
  );
  const tasksInProgress = useMemo(
    () => tasks.filter((t) => t.status === 'in_progress' || t.status === 'IN_PROGRESS').length,
    [tasks]
  );
  const milestones = useMemo(() => tasks.filter((t) => t.isMilestone), [tasks]);
  const riskCount = useMemo(() => raidItems.filter((r) => r.type === 'risk').length, [raidItems]);
  const issueCount = useMemo(() => raidItems.filter((r) => r.type === 'issue').length, [raidItems]);
  const criticalRaids = useMemo(
    () => raidItems.filter((r) => r.severity === 'CRITICAL' || r.severity === 'HIGH').length,
    [raidItems]
  );
  const ownerName = useMemo(() => {
    const user = users.find((u) => u.id === ownerId);
    return user ? `${user.firstName} ${user.lastName}` : '';
  }, [users, ownerId]);
  const sponsorName = useMemo(() => {
    const user = users.find((u) => u.id === sponsorId);
    return user ? `${user.firstName} ${user.lastName}` : '';
  }, [users, sponsorId]);

  const isWatching = useMemo(
    () => watchers.some((w) => w.userId === currentUserId),
    [watchers, currentUserId]
  );

  const requiredGates = useMemo(
    () => GATE_DEFINITIONS.filter((g) => g.forStatus === status),
    [status]
  );
  const pendingGates = useMemo(
    () =>
      requiredGates.filter((g) => {
        const match = decisions.find((d) => d.type === g.pmoDomain);
        return !match || match.status === 'PENDING';
      }),
    [requiredGates, decisions]
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(nModeOrderStorageKey);
      if (!raw) {
        setNModeSectionOrder(null);
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter(
          (id): id is string => typeof id === 'string' && id.length > 0
        );
        setNModeSectionOrder(cleaned.length > 0 ? cleaned : null);
      } else {
        setNModeSectionOrder(null);
      }
    } catch {
      setNModeSectionOrder(null);
    }
  }, [nModeOrderStorageKey]);

  const handleNModeSectionReorder = useCallback(
    (sectionIds: string[]) => {
      setNModeSectionOrder(sectionIds);
      try {
        localStorage.setItem(nModeOrderStorageKey, JSON.stringify(sectionIds));
      } catch {
        // Ignore storage errors; drag-and-drop still works for this session.
      }
    },
    [nModeOrderStorageKey]
  );

  // ==========================================
  // VISIBLE SECTIONS (template-driven)
  // ==========================================

  const visibleSections = useMemo(() => {
    const templateVS =
      initiativeTemplate?.visibleSections || initiativeTemplate?.visible_sections || {};
    const hasExplicitTemplateVisibility =
      templateVS && typeof templateVS === 'object' && Object.keys(templateVS).length > 0;
    // If template defines visibility explicitly, treat it as source-of-truth.
    // Otherwise keep legacy "show defaults" behavior.
    if (hasExplicitTemplateVisibility) return templateVS;
    return { ...DEFAULT_VISIBLE_SECTIONS };
  }, [initiativeTemplate]);

  const sectionOrder = useMemo(() => {
    const templateOrder =
      initiativeTemplate?.sectionOrder || initiativeTemplate?.section_order || {};
    return { ...DEFAULT_SECTION_ORDER, ...templateOrder };
  }, [initiativeTemplate]);

  // Resolve which sections to render, split by column
  const { leftSections, rightSections } = useMemo(() => {
    // If we have section types from the API, use them; otherwise fall back to defaults
    const resolvedTypes: SectionTypeInfo[] =
      sectionTypes.length > 0
        ? sectionTypes
        : Object.keys(DEFAULT_VISIBLE_SECTIONS).map((key) => ({
            id: `default-${key}`,
            key,
            name: key,
            namePl: null,
            description: null,
            descriptionPl: null,
            category: 'content' as const,
            columnPosition: (DEFAULT_SECTION_ORDER[key] !== undefined &&
            [
              'control',
              'team',
              'initiativeTeam',
              'raciEscalation',
              'resources',
              'stakeholders',
              'dependencies',
              'linkedItems',
              'tags',
              'reminders',
              'watchers',
            ].includes(key)
              ? 'right'
              : 'left') as 'left' | 'right',
            defaultOrder: DEFAULT_SECTION_ORDER[key] || 100,
            icon: null,
            iconColor: null,
            iconBg: null,
            componentKey: key,
            isSystem: true,
            isActive: true,
          }));

    const visible = resolvedTypes.filter((st) => {
      const key = st.key;
      return visibleSections[key] !== false && SECTION_REGISTRY[st.componentKey];
    });

    const left = visible
      .filter((st) => st.columnPosition === 'left')
      .sort(
        (a, b) => (sectionOrder[a.key] ?? a.defaultOrder) - (sectionOrder[b.key] ?? b.defaultOrder)
      );

    const right = visible
      .filter((st) => st.columnPosition === 'right')
      .sort(
        (a, b) => (sectionOrder[a.key] ?? a.defaultOrder) - (sectionOrder[b.key] ?? b.defaultOrder)
      );

    return { leftSections: left, rightSections: right };
  }, [sectionTypes, visibleSections, sectionOrder]);

  // MIGRACJA (D-8) R2 — cichy sygnał dev: każdy renderowany klucz registry ma wpis
  // w katalogu kanonicznym (INITIATIVE_CARD_RENDER_IDS) albo jest znanym martwym
  // aliasem. Nie blokuje renderu; ostrzega, gdyby klucz kod↔katalog się rozjechał.
  // Tylko dev + flaga (żeby nie hałasować w produkcie ani przy OFF).
  useEffect(() => {
    if (!import.meta.env.DEV || !initiativeCardContractEnabled) return;
    const known = new Set<string>(INITIATIVE_CARD_RENDER_IDS);
    const deadAliases = new Set(['initiativeTeam', 'linkedItems']);
    const missing = [...leftSections, ...rightSections]
      .map((st) => st.key)
      .filter((key) => !known.has(key) && !deadAliases.has(key));
    if (missing.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        '[initiativeCardContract] klucze registry bez wpisu w katalogu kanonicznym:',
        missing
      );
    }
  }, [initiativeCardContractEnabled, leftSections, rightSections]);

  // ── Suggested changes (Faza 4) — load + accept/reject (mini-gate) ──────────
  const loadSuggestedChanges = useCallback(async () => {
    if (!initiativeId) return;
    setSuggestedChangesLoading(true);
    try {
      const items = await listSuggestedChanges(initiativeId);
      setSuggestedChanges(items);
    } finally {
      setSuggestedChangesLoading(false);
    }
  }, [initiativeId]);

  useEffect(() => {
    void loadSuggestedChanges();
  }, [loadSuggestedChanges]);

  const handleResolveSuggestedChange = useCallback(
    async (change: SuggestedChange, accept: boolean) => {
      if (!change.id) return;
      await resolveSuggestedChange(change.id, accept);
      await loadSuggestedChanges();
    },
    [loadSuggestedChanges]
  );

  const pendingSuggestedChangesCount = useMemo(
    () => suggestedChanges.filter((c) => (c.status ?? 'pending') === 'pending').length,
    [suggestedChanges]
  );

  // ==========================================
  // DATA FETCHING
  // ==========================================

  const fetchAll = useCallback(async () => {
    if (!initiativeId) return;
    setIsLoading(true);
    setError(null);
    setErrorCode(null);
    try {
      const showcaseDetail = isShowcaseInitiativeId(initiativeId)
        ? initiativesDemoData.initiativeDetailsById[initiativeId]
        : null;
      const data =
        showcaseDetail?.initiative ||
        (await V8PlanningApi.getInitiative(initiativeId).catch(async () =>
          Api.getInitiativeById(initiativeId).catch(async () => {
            const interviewResponse = await Api.get('/initiatives?source=interview_insight');
            const interviewInitiatives = unwrapApiList(interviewResponse, 'initiatives');
            const interviewInitiative = interviewInitiatives.find(
              (item: any) => String(item?.id) === String(initiativeId)
            );
            if (!interviewInitiative) {
              throw new Error(t('initiatives.initiativeNotFound2'));
            }
            return interviewInitiative;
          })
        ));
      setInitiative(data);
      setInitiativeTemplate(null);
      setTitleDraft(String(data.title || data.name || '').trim());
      setSummary(data.summary || data.description || '');
      setDescription(data.description || '');
      // Sync problem definition fields — try structured object first, then parse JSON string
      let pd: Record<string, string> = {};
      const rawPd =
        data.problemDefinition ||
        data.problem_definition ||
        data.problemStatement ||
        data.problem_statement;
      if (rawPd && typeof rawPd === 'object') {
        pd = rawPd;
      } else if (rawPd && typeof rawPd === 'string') {
        try {
          const parsed = JSON.parse(rawPd);
          if (typeof parsed === 'object' && parsed !== null) {
            pd = parsed;
          }
        } catch {
          // Some payloads are HTML-escaped by sanitization middleware (e.g. &quot;).
          // Decode and try parsing once more.
          try {
            const decoded = decodeHtmlEntities(rawPd);
            const parsedDecoded = JSON.parse(decoded);
            if (typeof parsedDecoded === 'object' && parsedDecoded !== null) {
              pd = parsedDecoded;
            } else {
              pd = { symptom: decoded };
            }
          } catch {
            // Not JSON — treat as plain text problem statement (legacy)
            pd = { symptom: decodeHtmlEntities(rawPd) };
          }
        }
      }
      setSymptomDraft(pd.symptom || '');
      setRootCauseDraft(pd.rootCause || '');
      setCostOfInactionDraft(pd.costOfInaction || '');
      setMarketContextDraft(data.marketContext || data.market_context || '');
      // Sync success criteria fields
      const td = data.targetState || data.target_state || {};
      if (typeof td === 'object' && td !== null) {
        const tsDesc = td.description || '';
        setTargetDescriptionDraft(tsDesc);
        if (tsDesc) {
          const tsLines = tsDesc.split('\n').filter((l: string) => l.trim());
          setTargetStateItems(
            tsLines.length > 0
              ? tsLines.map((t: string, i: number) => ({
                  id: `ts-${i}`,
                  text: t.replace(/^[-•*]\s*/, ''),
                  done: false,
                }))
              : [{ id: 'ts-0', text: tsDesc, done: false }]
          );
        }
        const sc = td.successCriteria || [];
        setSuccessCriteriaItems(
          sc.map((t: string, i: number) => ({ id: `sc-${i}`, text: t, done: false }))
        );
        const dl = td.deliverables || data.deliverables || [];
        // Done flags persist as an index-aligned boolean[] alongside the texts.
        const dlDone = Array.isArray(data.deliverablesDone)
          ? data.deliverablesDone
          : Array.isArray(data.deliverables_done)
            ? data.deliverables_done
            : [];
        setDeliverableItems(
          dl.map((t: string, i: number) => ({
            id: `dl-${i}`,
            text: t,
            done: !!dlDone[i],
          }))
        );
      }
      setTags(data.tags || []);
      // Sync scope & boundaries fields
      const scopeObj = data.scope || {};
      if (typeof scopeObj === 'object' && scopeObj !== null) {
        setInScopeItems(normalizeStringList((scopeObj as any).inScope));
        setOutScopeItems(normalizeStringList((scopeObj as any).outScope));
      } else {
        setInScopeItems([]);
        setOutScopeItems([]);
      }
      setKillCriteriaItems(
        normalizeStringList(
          data.killCriteria ||
            data.kill_criteria ||
            (typeof scopeObj === 'object' && scopeObj !== null
              ? (scopeObj as any).killCriteria
              : [])
        )
      );

      // Restore local draft if user refreshed before autosave persisted to backend.
      // Only restore fields where server values are empty to avoid overwriting saved data.
      if (!definitionDraftRestoredRef.current) {
        try {
          const rawDraft = localStorage.getItem(initiativeDefinitionDraftStorageKey);
          if (rawDraft) {
            const draft = JSON.parse(rawDraft) as {
              symptomDraft?: string;
              rootCauseDraft?: string;
              costOfInactionDraft?: string;
              marketContextDraft?: string;
              inScopeItems?: string[];
              outScopeItems?: string[];
              killCriteriaItems?: string[];
            };

            const serverSymptom = String(pd.symptom || '').trim();
            const serverRoot = String(pd.rootCause || '').trim();
            const serverCost = String(pd.costOfInaction || '').trim();
            const serverMarket = String(data.marketContext || data.market_context || '').trim();
            const serverInScopeRaw =
              typeof scopeObj === 'object' ? (scopeObj as any).inScope || [] : [];
            const serverOutScopeRaw =
              typeof scopeObj === 'object' ? (scopeObj as any).outScope || [] : [];
            const serverKillRaw =
              data.killCriteria ||
              data.kill_criteria ||
              (typeof scopeObj === 'object' ? (scopeObj as any).killCriteria || [] : []);

            const serverInScope = normalizeStringList(serverInScopeRaw);
            const serverOutScope = normalizeStringList(serverOutScopeRaw);
            const serverKill = normalizeStringList(serverKillRaw);

            let restoredAny = false;
            if (!serverSymptom && String(draft.symptomDraft || '').trim()) {
              setSymptomDraft(String(draft.symptomDraft || ''));
              restoredAny = true;
            }
            if (!serverRoot && String(draft.rootCauseDraft || '').trim()) {
              setRootCauseDraft(String(draft.rootCauseDraft || ''));
              restoredAny = true;
            }
            if (!serverCost && String(draft.costOfInactionDraft || '').trim()) {
              setCostOfInactionDraft(String(draft.costOfInactionDraft || ''));
              restoredAny = true;
            }
            if (!serverMarket && String(draft.marketContextDraft || '').trim()) {
              setMarketContextDraft(String(draft.marketContextDraft || ''));
              restoredAny = true;
            }
            if (
              serverInScope.length === 0 &&
              Array.isArray(draft.inScopeItems) &&
              draft.inScopeItems.length > 0
            ) {
              setInScopeItems(draft.inScopeItems);
              restoredAny = true;
            }
            if (
              serverOutScope.length === 0 &&
              Array.isArray(draft.outScopeItems) &&
              draft.outScopeItems.length > 0
            ) {
              setOutScopeItems(draft.outScopeItems);
              restoredAny = true;
            }
            if (
              serverKill.length === 0 &&
              Array.isArray(draft.killCriteriaItems) &&
              draft.killCriteriaItems.length > 0
            ) {
              setKillCriteriaItems(draft.killCriteriaItems);
              restoredAny = true;
            }

            if (restoredAny) {
              definitionDraftRestoredRef.current = true;
              toast.success(t('initiatives.restoredLocalDraft2'));
            }
          }
        } catch {
          // ignore local draft parse errors
        }
      }

      const rawKpis = Array.isArray(data.kpis)
        ? data.kpis
        : Array.isArray(data.kpi)
          ? data.kpi
          : [];
      setLocalKpis(
        rawKpis.map((k: any, idx: number) =>
          toInitiativeKpiEditorRow(
            {
              ...k,
              targetValue: k.targetValue ?? k.target ?? null,
              baselineValue: k.baselineValue ?? k.baseline ?? null,
              currentValue: k.currentValue ?? k.current ?? null,
              latestValue: k.latestValue ?? k.currentValue ?? k.current ?? null,
              measurementFrequency: k.measurementFrequency ?? 'MONTHLY',
              alertDirection: k.alertDirection ?? 'BELOW',
              isPrimary: k.isPrimary ?? false,
              sortOrder: k.sortOrder ?? idx,
              isOnTarget: Boolean(k.isOnTarget),
              createdAt: k.createdAt ?? new Date().toISOString(),
            },
            idx
          )
        )
      );
      const rawResources = Array.isArray(data.resources) ? data.resources : [];
      setResourceItems(
        rawResources.map((r: any, idx: number) => ({
          id: String(r.id || `res-${idx}`),
          name: String(r.name || r.person || r.role || ''),
          role: String(r.role || ''),
          allocation: Number(r.allocation || r.percent || 0),
        }))
      );
      setBudgetDraft(
        String(
          data.estimatedBudget ||
            data.estimated_budget ||
            data.budget ||
            data.budgetEstimate ||
            data.costCapex ||
            data.cost_capex ||
            ''
        )
      );
      const rawTools = Array.isArray(data.resourceTools)
        ? data.resourceTools
        : Array.isArray(data.resource_tools)
          ? data.resource_tools
          : Array.isArray(data.tools)
            ? data.tools
            : Array.isArray(data.toolsNeeded)
              ? data.toolsNeeded
              : [];
      setResourceTools(rawTools.map((t: any) => String(t)));
      const rawPriority = (data.priority || 'medium').toLowerCase();
      setPriority(rawPriority);
      setOwnerId(data.ownerId || data.owner_id || '');
      setSponsorId(data.sponsorId || data.sponsor_id || '');
      setTargetDate(data.plannedEndDate || data.planned_end_date || data.targetDate || '');
      setStartDate(data.plannedStartDate || data.planned_start_date || null);
      setEndDate(data.plannedEndDate || data.planned_end_date || null);

      // Timeline milestones & phases from initiative data
      if (Array.isArray(data.milestones)) {
        setTimelineMilestones(
          data.milestones.map((m: any, idx: number) => ({
            id: m.id || `ms-${idx}`,
            name: m.name || m.title || '',
            date: m.date || m.plannedDate || '',
            actualDate: m.actualDate || undefined,
            status: m.status || 'pending',
            description: m.description || undefined,
          }))
        );
      }
      if (Array.isArray(data.timelinePhases)) {
        setTimelinePhases(data.timelinePhases);
      }
      if (data.estimatedDurationMonths != null) {
        setEstimatedDurationMonths(data.estimatedDurationMonths);
      }

      if (showcaseDetail) {
        setDecisions(showcaseDetail.decisions || []);
        setRaidItems(showcaseDetail.raidItems || []);
        setWatchers(showcaseDetail.watchers || []);
        setHistory(showcaseDetail.history || []);
        setTasks(showcaseDetail.tasks || []);
        setDependencies(showcaseDetail.dependencies || []);
        setStakeholders(showcaseDetail.stakeholders || []);
        setUsers(initiativesDemoData.users || []);
        setPendingApprovals(showcaseDetail.pendingApprovals || []);
        setComments(showcaseDetail.comments || []);
        setGateRoles(showcaseDetail.gateRoles || []);
        setGateReadiness(showcaseDetail.gateReadiness || null);
        setUserGateRoles(showcaseDetail.gateReadiness?.userRoles || []);
        setStatusHistory(showcaseDetail.statusHistory || []);
        setApiResourceItems(showcaseDetail.resources || []);
        setApiBudgetItems(showcaseDetail.budgetItems || []);
        setApiToolItems(showcaseDetail.tools || []);
        setApiIntangibleAssets(showcaseDetail.intangibleAssets || []);
        setAttachments(showcaseDetail.attachments || []);
        setLinkedItems(showcaseDetail.linkedItems || []);
        return;
      }

      // Fetch related data (best-effort, parallel)
      const fetches = [
        Api.get(`/decisions?relatedObjectId=${initiativeId}&relatedObjectType=initiative`)
          .then((ds: any) => {
            const raw = Array.isArray(ds) ? ds : ds?.decisions || [];
            // Hide soft-deleted decisions (DELETE /api/decisions/:id sets status='cancelled').
            // No archive view exists yet for this context — cancelled just drops out of
            // the active list (tab badge, DecisionsSection table, etc.).
            setDecisions(
              raw
                .filter((d: any) => String(d.status || '').toUpperCase() !== 'CANCELLED')
                .map((d: any) => ({
                  id: d.id,
                  title: d.title || '',
                  description: d.description || undefined,
                  type: d.decisionType || d.type || 'GENERAL',
                  status: d.status || 'PENDING',
                  priority: d.priority || undefined,
                  decisionMakerId: d.decisionOwnerId || d.decisionMakerId || undefined,
                  ownerName: d.ownerName || undefined,
                  requestedByName: d.requestedByName || undefined,
                  dueDate: d.dueDate || undefined,
                  createdAt: d.createdAt || undefined,
                  isOverdue: d.isOverdue || false,
                  daysOverdue: d.daysOverdue || 0,
                  source: d.source || 'manual',
                }))
            );
          })
          .catch(() => setDecisions([])),
        V8PlanningApi.getRaid(initiativeId)
          .catch(() => Api.get(`/initiatives/${initiativeId}/raid`))
          .then((r: any) => setRaidItems(r?.items || r?.raid || (Array.isArray(r) ? r : [])))
          .catch(() => setRaidItems([])),
        V8PlanningApi.getWatchers(initiativeId)
          .then((watchers) => setWatchers(Array.isArray(watchers) ? watchers : []))
          .catch(() =>
            Api.get(`/initiatives/${initiativeId}/watchers`).then((w: any) =>
              setWatchers(w?.watchers || (Array.isArray(w) ? w : []))
            )
          )
          .catch(() => setWatchers([])),
        V8PlanningApi.getKpis(initiativeId)
          .catch(() => Api.get(`/initiatives/${initiativeId}/kpis`))
          .then((res: any) => {
            const rows = extractInitiativeKpiRows(res);
            setLocalKpis(rows.map((kpi, idx) => toInitiativeKpiEditorRow(kpi, idx)));
          })
          .catch(() => {
            // keep fallback KPI mapping from initiative payload
          }),
        V8PlanningApi.getHistory(initiativeId)
          .catch(() => Api.get(`/initiatives/${initiativeId}/history`))
          .then((h: any) => setHistory(h?.events || h?.history || (Array.isArray(h) ? h : [])))
          .catch(() => setHistory([])),
        Api.get(`/tasks?initiativeId=${initiativeId}`)
          .then((ts: any) => {
            const taskList = Array.isArray(ts) ? ts : ts?.tasks || [];
            setTasks(
              taskList.map((t: any) => ({
                id: t.id,
                title: t.title,
                source: t.source || 'manual',
                description: t.description,
                status: t.status,
                priority: t.priority,
                dueDate: t.dueDate,
                taskType: t.taskType,
                estimatedHours: t.estimatedHours,
                assigneeId: t.assigneeId || t.assignee_id,
                assigneeName: t.assigneeName || t.assignee?.name,
                isMilestone: t.isMilestone || false,
                milestoneDate: t.milestoneDate,
              }))
            );
          })
          .catch(() => setTasks([])),
        V8PlanningApi.getTaskDependencies(initiativeId)
          .then((dependencies) => setDependencies(Array.isArray(dependencies) ? dependencies : []))
          .catch(() =>
            Api.get(`/initiatives/${initiativeId}/task-dependencies`).then((d: any) =>
              setDependencies(Array.isArray(d?.dependencies) ? d.dependencies : [])
            )
          )
          .catch(() => setDependencies([])),
        V8PlanningApi.getStakeholders(initiativeId)
          .catch(() => Api.get(`/initiatives/${initiativeId}/stakeholders`))
          .then((st: any) => {
            const mapped: Stakeholder[] = (st?.stakeholders || (Array.isArray(st) ? st : [])).map(
              (s: any) => {
                const raci =
                  String(s.raciType || s.raci_type || s.raci || s.role || '').toUpperCase() || 'I';
                const role: StakeholderRole =
                  raci === 'R'
                    ? 'responsible'
                    : raci === 'A'
                      ? 'accountable'
                      : raci === 'C'
                        ? 'consulted'
                        : 'informed';
                return {
                  id: s.id,
                  decisionId: initiativeId,
                  userId: s.userId || s.user_id,
                  userName: s.name || `${s.firstName || ''} ${s.lastName || ''}`.trim(),
                  userEmail: s.email,
                  role,
                  notificationSettings: {
                    enabled: true,
                    triggers: ['on_status_change'],
                    emailEnabled: true,
                    inAppEnabled: true,
                    integrationChannels: [],
                    syncTargets: [],
                  },
                };
              }
            );
            setStakeholders(mapped);
          })
          .catch(() => setStakeholders([])),
        Api.get('/users')
          .then((u: any) => setUsers(Array.isArray(u) ? u : u?.users || []))
          .catch(() => setUsers([])),
        Api.get(
          `/decisions?relatedObjectId=${initiativeId}&relatedObjectType=initiative&type=GATE_APPROVAL`
        )
          .then((ad: any) => {
            const approvals = (Array.isArray(ad) ? ad : ad?.decisions || [])
              .filter((d: any) => d.status === 'PENDING')
              .map((d: any) => ({
                id: d.id,
                gateType: d.gateType || d.metadata?.gateType || 'UNKNOWN',
                gateName: d.title,
                requiredRole: d.metadata?.requiredRole || 'sponsor',
                status: d.status,
                requestedAt: d.createdAt,
                deciderId: d.deciderId,
                deciderName: d.deciderName || d.decider?.name,
                dueDate: d.dueDate,
              }));
            setPendingApprovals(approvals);
          })
          .catch(() => setPendingApprovals([])),
        V8PlanningApi.getComments(initiativeId)
          .catch(() => Api.get(`/initiatives/${initiativeId}/comments`))
          .then((c: any) => {
            const rows = Array.isArray(c?.comments) ? c.comments : Array.isArray(c) ? c : [];
            setComments(
              rows.map((x: any) => ({
                id: String(x.id),
                content: String(x.content || ''),
                authorId: String(x.authorId || x.userId || x.user_id || ''),
                authorName: String(x.authorName || x.author_name || ''),
                createdAt: String(x.createdAt || x.created_at || new Date().toISOString()),
                likes: Number.isFinite(Number(x.likes)) ? Number(x.likes) : 0,
                likedByMe: !!x.likedByMe,
              }))
            );
          })
          .catch(() => setComments([])),
        // Gate roles & governance
        V8PlanningApi.getGateRoles(initiativeId)
          .catch(() => Api.get(`/initiatives/${initiativeId}/gate-roles`))
          .then((gr: any) => {
            const roles: GateRoleAssignment[] = (gr?.roles || []).map((r: any) => ({
              id: r.id,
              initiativeId: r.initiativeId || initiativeId,
              gateRole: r.gateRole,
              userId: r.userId,
              firstName: r.firstName,
              lastName: r.lastName,
              email: r.email,
              assignedBy: r.assignedBy,
              assignedAt: r.assignedAt,
              source: r.source || 'explicit',
            }));
            setGateRoles(roles);
          })
          .catch(() => setGateRoles([])),
        V8PlanningApi.getGateReadiness(initiativeId)
          .catch(() => Api.get(`/initiatives/${initiativeId}/gate-readiness-check`))
          .then((rc: any) => {
            const payload = normalizeGateReadinessPayload(rc);
            setGateReadiness((payload as GateReadinessCheck | null) || null);
            setUserGateRoles(payload?.userRoles || []);
          })
          .catch(() => {
            setGateReadiness(null);
            setUserGateRoles([]);
          }),
        V8PlanningApi.getStatusHistory(initiativeId)
          .catch(() => Api.get(`/initiatives/${initiativeId}/status-history`))
          .then((sh: any) => setStatusHistory(sh?.history || (Array.isArray(sh) ? sh : [])))
          .catch(() => setStatusHistory([])),
        // Resources: Team / FTE
        V8PlanningApi.getResources(initiativeId)
          .catch(() => Api.get(`/initiatives/${initiativeId}/resources`))
          .then((r: any) => {
            const rows = Array.isArray(r?.resources) ? r.resources : Array.isArray(r) ? r : [];
            setApiResourceItems(
              rows.map((item: any) => ({
                id: item.id,
                initiativeId: item.initiativeId,
                userId: item.userId,
                name: item.name || `${item.firstName || ''} ${item.lastName || ''}`.trim() || '',
                role: item.role || 'member',
                allocationPercentage: item.allocationPercentage || 100,
                startDate: item.startDate || undefined,
                endDate: item.endDate || undefined,
                notes: item.notes || undefined,
                firstName: item.firstName,
                lastName: item.lastName,
                avatarUrl: item.avatarUrl,
                version: typeof item.version === 'number' ? item.version : undefined,
              }))
            );
          })
          .catch(() => setApiResourceItems([])),
        // Resources: Budget Items
        V8PlanningApi.getBudgetItems(initiativeId)
          .catch(() => Api.get(`/initiatives/${initiativeId}/budget-items`))
          .then((r: any) => {
            const rows = Array.isArray(r?.budgetItems) ? r.budgetItems : [];
            setApiBudgetItems(
              rows.map((item: any) => ({
                id: item.id,
                initiativeId: item.initiativeId,
                category: item.category || 'other',
                costType: item.costType || 'OPEX',
                amount: item.amount || 0,
                currency: item.currency || 'PLN',
                description: item.description || undefined,
              }))
            );
          })
          .catch(() => setApiBudgetItems([])),
        // Resources: Tools
        V8PlanningApi.getTools(initiativeId)
          .catch(() => Api.get(`/initiatives/${initiativeId}/tools`))
          .then((r: any) => {
            const rows = Array.isArray(r?.tools) ? r.tools : [];
            setApiToolItems(
              rows.map((item: any) => ({
                id: item.id,
                initiativeId: item.initiativeId,
                name: item.name || '',
                category: item.category || 'software',
                vendor: item.vendor || undefined,
                licenseCost: item.licenseCost || 0,
                licenseType: item.licenseType || 'subscription',
                status: item.status || 'planned',
                notes: item.notes || undefined,
              }))
            );
          })
          .catch(() => setApiToolItems([])),
        // Resources: Intangible Assets (Licenses, Training, Knowledge)
        V8PlanningApi.getIntangibleAssets(initiativeId)
          .catch(() => Api.get(`/initiatives/${initiativeId}/intangible-assets`))
          .then((r: any) => {
            const rows = Array.isArray(r?.intangibleAssets) ? r.intangibleAssets : [];
            setApiIntangibleAssets(
              rows.map((item: any) => ({
                id: item.id,
                initiativeId: item.initiativeId,
                assetType: item.assetType || 'license',
                name: item.name || '',
                provider: item.provider || undefined,
                cost: item.cost || 0,
                currency: item.currency || 'PLN',
                validFrom: item.validFrom || undefined,
                validUntil: item.validUntil || undefined,
                status: item.status || 'planned',
                beneficiaries: item.beneficiaries || undefined,
                notes: item.notes || undefined,
              }))
            );
          })
          .catch(() => setApiIntangibleAssets([])),
      ];

      await Promise.allSettled(fetches);
    } catch (e: any) {
      const mapped = mapHubLoadFailureToPresentation(e, 'Failed to load initiative');
      setError(mapped.message);
      setErrorCode(mapped.code);
    } finally {
      setIsLoading(false);
    }
  }, [
    initiativeId,
    decodeHtmlEntities,
    initiativeDefinitionDraftStorageKey,
    initiativesDemoData,
    isPolish,
  ]);

  // Persist local draft continuously so refresh won't lose edits (even before autosave).
  useEffect(() => {
    if (!initiativeId) return;
    try {
      const hasAny =
        !!symptomDraft.trim() ||
        !!rootCauseDraft.trim() ||
        !!costOfInactionDraft.trim() ||
        !!marketContextDraft.trim() ||
        inScopeItems.length > 0 ||
        outScopeItems.length > 0 ||
        killCriteriaItems.length > 0;
      if (!hasAny) {
        localStorage.removeItem(initiativeDefinitionDraftStorageKey);
        return;
      }
      localStorage.setItem(
        initiativeDefinitionDraftStorageKey,
        JSON.stringify({
          savedAt: new Date().toISOString(),
          symptomDraft,
          rootCauseDraft,
          costOfInactionDraft,
          marketContextDraft,
          inScopeItems,
          outScopeItems,
          killCriteriaItems,
        })
      );
    } catch {
      // ignore localStorage errors (private mode / quota)
    }
  }, [
    initiativeId,
    initiativeDefinitionDraftStorageKey,
    symptomDraft,
    rootCauseDraft,
    costOfInactionDraft,
    marketContextDraft,
    inScopeItems,
    outScopeItems,
    killCriteriaItems,
  ]);

  // Fetch section types once
  useEffect(() => {
    Api.get('/initiatives/section-types')
      .then((data: any) => {
        if (Array.isArray(data)) setSectionTypes(data);
      })
      .catch(() => {
        // Fall back to default sections if API fails
        setSectionTypes([]);
      });
  }, []);

  // Fetch template when initiative loads
  useEffect(() => {
    const tplId = initiative?.initiativeTemplateId || initiative?.initiative_template_id;
    if (!tplId) {
      setInitiativeTemplate(null);
      return;
    }
    let cancelled = false;
    Api.get(`/initiatives/templates/${encodeURIComponent(String(tplId))}`)
      .then((resp: any) => {
        if (!cancelled) setInitiativeTemplate(resp?.template || null);
      })
      .catch(() => {
        if (!cancelled) setInitiativeTemplate(null);
      });
    return () => {
      cancelled = true;
    };
  }, [initiative?.initiativeTemplateId, initiative?.initiative_template_id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // V4-IDEA-09: Fetch LinkGraph backlinks for "Used in" section
  useEffect(() => {
    if (!initiativeId) return;
    setInitiativeBacklinksLoading(true);
    Api.getLinkGraphBacklinks({ type: 'initiative', id: initiativeId, limit: 50 })
      .then((rows: any) => {
        setInitiativeBacklinks(
          (Array.isArray(rows) ? rows : [])
            .map((x: any) => ({
              id: String(x?.id || ''),
              sourceType: String(x?.sourceType || ''),
              sourceId: String(x?.sourceId || ''),
            }))
            .filter((x) => x.sourceType && x.sourceId)
        );
      })
      .catch(() => setInitiativeBacklinks([]))
      .finally(() => setInitiativeBacklinksLoading(false));
  }, [initiativeId]);

  // C7: Fetch related artifacts from the canonical Outputs registry
  // (GET /api/artifacts?sourceInitiativeId=…) for the "Artefakty" section.
  useEffect(() => {
    if (!initiativeId || isShowcaseInitiativeId(initiativeId)) return;
    setRelatedArtifactsLoading(true);
    Api.get(`/artifacts?sourceInitiativeId=${encodeURIComponent(initiativeId)}&limit=20`)
      .then((res: any) => {
        // Api.get is axios-like (`res.data` = payload) and the endpoint itself
        // wraps the list as `{ data: [...] }` — unwrap both layers defensively.
        const payload: any = res?.data ?? res;
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : [];
        setRelatedArtifacts(
          list
            .map((item: any) => ({
              artifactId: String(item?.artifactId || ''),
              outputType: String(item?.outputType || ''),
              title: String(item?.resolvedTitle || item?.titleSnapshot || '').trim(),
              updatedAt: item?.lastTransitionAt ? String(item.lastTransitionAt) : null,
              openPath: item?.openPath ? String(item.openPath) : null,
            }))
            .filter((item: { artifactId: string; title: string }) => item.artifactId && item.title)
        );
      })
      .catch(() => setRelatedArtifacts([]))
      .finally(() => setRelatedArtifactsLoading(false));
  }, [initiativeId]);

  // ==========================================
  // HANDLERS
  // ==========================================

  const handleStatusAction = async (action: StatusAction) => {
    // Warn if this transition moves the initiative to a different module
    const targetStatus = action.targetStatus as InitiativeStatus;

    // ── SPEC-N §4A — BRAMKA DOWODOWA (miękka) ────────────────────────────────
    // Zasada standardu: „Bramka nie blokuje pisania, blokuje promocję". Piszesz
    // swobodnie; system pyta o źródła dopiero w momencie, w którym karta ma iść
    // dalej — tak jak działa bramka jakości w wywiadach.
    //
    // MIĘKKA ŚWIADOMIE, nie z lenistwa: twarda blokada musi stać na serwerze
    // (front da się obejść), a to osobne zgłoszenie do silnika — plan wdrożenia
    // §0 wprost trzyma ją poza tą falą. Tu dajemy ostrzeżenie z możliwością
    // kontynuowania.
    //
    // FAIL-OPEN: błąd sieci/braku endpointu → przepuszczamy. Bramka jakościowa
    // nie może zamienić się w awarię blokującą pracę (ten sam wzorzec co
    // gate-ai-check niżej).
    if (
      targetStatus === InitiativeStatus.REVIEW ||
      targetStatus === InitiativeStatus.PENDING_REVIEW
    ) {
      try {
        const envelope = await fetchEvidenceEnvelope('initiative', initiativeId);
        const sourceCount = envelope?.sources?.length ?? 0;
        const assumptionCount = envelope?.assumptions?.length ?? 0;
        if (sourceCount === 0 && assumptionCount === 0) {
          const proceed = window.confirm(
            isPolish
              ? 'Ta inicjatywa nie wskazuje źródeł. Kontynuować?'
              : 'This initiative does not cite any sources. Continue?'
          );
          if (!proceed) return;
        }
      } catch {
        /* fail-open — brak envelope nie może blokować przejścia statusu */
      }
    }
    if (willChangeModule(status, targetStatus)) {
      const targetModule = getModuleForStatus(targetStatus);
      const MODULE_NAMES: Record<string, { en: string; pl: string }> = {
        tools: { en: 'Assessment', pl: 'Ocena' },
        assessment: { en: 'Assessment', pl: 'Ocena' },
        initiatives: { en: 'Initiatives', pl: 'Inicjatywy' },
        execution: { en: 'Execution', pl: 'Realizacja' },
        benefits: { en: 'Benefits', pl: 'Korzyści' },
      };
      const moduleName = MODULE_NAMES[targetModule]?.[isPolish ? 'pl' : 'en'] || targetModule;
      const confirmed = window.confirm(
        isPolish
          ? `Ta zmiana przeniesie inicjatywę do modułu "${moduleName}". Kontynuować?`
          : `This change will move the initiative to the "${moduleName}" module. Continue?`
      );
      if (!confirmed) return;
    }

    setIsMutating(true);
    try {
      const { transition, blockingItems } = await getInitiativeStatusPreflightTruth(
        initiativeId,
        action.targetStatus
      );
      if (!transition || !transition.canCurrentUserExecute) {
        // #74: this FE preflight normally can't fire — statusActions already
        // filters buttons down to transitions the user can execute — so it
        // only trips on stale gateReadiness (role/approver changed since
        // fetch). Surface WHY instead of a silent generic toast; reuse the
        // same copy InitiativesHub already ships for this exact case.
        toast.error(
          t(
            'initiatives.toast.statusNotAllowed',
            'You do not have permission or the gate is not available at this stage.'
          ),
          { duration: 5000 }
        );
        return;
      }
      if (blockingItems.length > 0) {
        const list = blockingItems.slice(0, 5).join('\n• ');
        toast.error(
          t(
            'initiatives.toast.gateBlockedHub',
            'Cannot proceed — missing blocking items:\n• {{items}}',
            { items: list || t('common.missing', 'Missing required items') }
          ),
          { duration: 6500 }
        );
        return;
      }

      // M13 Depth · Fala 1 — AI gate soft-block (modal-before-commit). The
      // server PATCH /status is the authoritative backstop (returns 422); this
      // FE pre-check just surfaces the override modal first. Fail-open: any
      // error here → proceed and let the server decide.
      try {
        const raw: any = await Api.post(`/initiatives/${initiativeId}/gate-ai-check`, {
          targetStatus: action.targetStatus,
        });
        const resp = (raw?.data ?? raw) as GateAiCheckResponse;
        if (resp && gateAiSoftBlocks(resp)) {
          setGateAiOverride({
            targetStatus: String(action.targetStatus),
            readiness: resp.aiReadiness,
            timeline: resp.timeline,
          });
          return; // finally resets isMutating; modal drives the override path
        }
      } catch {
        /* fail-open — server 422 remains the backstop */
      }

      await commitStatusTransition(action.targetStatus);
    } catch (e: any) {
      toast.error(
        e?.message || t('initiatives.toast.statusUpdateError', 'Failed to update status')
      );
    } finally {
      setIsMutating(false);
    }
  };

  // Commit a status transition (shared by the normal path and the gate-AI
  // override-confirm path). Pass overrideReason to bypass an AI soft-block.
  const commitStatusTransition = async (targetStatus: string, overrideReason?: string) => {
    const truth = await updateInitiativeStatusWriteTruth(
      initiativeId,
      targetStatus,
      overrideReason
    );
    setInitiative((prev: any) => ({
      ...prev,
      ...(truth.initiative || {}),
      status: targetStatus,
    }));
    setGateReadiness(truth.gateReadiness);
    setStatusHistory(truth.statusHistory as any);
    setHistory(truth.history as any);
    onStatusChange?.(targetStatus as any);
    toast.success(t('initiatives.statusUpdated2'));
  };

  // Modal confirm — proceed past the AI soft-block with a mandatory reason.
  const handleGateAiOverrideConfirm = async (reason: string) => {
    const pending = gateAiOverride;
    if (!pending) return;
    setGateAiOverride(null);
    setIsMutating(true);
    try {
      await commitStatusTransition(pending.targetStatus, reason);
    } catch (e: any) {
      toast.error(
        e?.message || t('initiatives.toast.statusUpdateError', 'Failed to update status')
      );
    } finally {
      setIsMutating(false);
    }
  };

  const handleToggleWatch = async () => {
    setIsMutating(true);
    try {
      if (isWatching) {
        const myWatch = watchers.find((w) => w.userId === currentUserId);
        if (myWatch) await Api.delete(`/initiatives/${initiativeId}/watchers/${myWatch.id}`);
        setWatchers((prev) => prev.filter((w) => w.userId !== currentUserId));
        toast.success(t('initiatives.stoppedWatching2'));
      } else {
        const res = await Api.post(`/initiatives/${initiativeId}/watchers`, {
          userId: currentUserId,
        });
        setWatchers((prev) => [...prev, res]);
        toast.success(t('initiatives.nowWatching2'));
      }
    } catch (e: any) {
      toast.error(e?.message || t('initiatives.toast.watchError', 'Failed to change watching'));
    } finally {
      setIsMutating(false);
    }
  };

  const handleSave = async (silent = false) => {
    setIsMutating(true);
    try {
      // Build structured problem definition as JSON for the problemStatement field
      const problemDefinitionPayload =
        symptomDraft || rootCauseDraft || costOfInactionDraft
          ? JSON.stringify({
              symptom: symptomDraft,
              rootCause: rootCauseDraft,
              costOfInaction: costOfInactionDraft,
            })
          : undefined;

      // Keep texts + done[] index-aligned: filter on text once, derive both.
      const keptDeliverables = deliverableItems.filter((d) => String(d.text || '').trim() !== '');
      const normalizedDeliverables = keptDeliverables.map((d) => String(d.text || '').trim());
      const normalizedDeliverablesDone = keptDeliverables.map((d) => !!d.done);
      const normalizedSuccessCriteria = successCriteriaItems
        .map((c) => String(c.text || '').trim())
        .filter(Boolean);
      const normalizedScopeIn = inScopeItems.map((v) => String(v || '').trim()).filter(Boolean);
      const normalizedScopeOut = outScopeItems.map((v) => String(v || '').trim()).filter(Boolean);
      const normalizedKillCriteria = killCriteriaItems
        .map((v) => String(v || '').trim())
        .filter(Boolean);

      const normalizedPriority = String(priority || '')
        .trim()
        .toLowerCase();
      const normalizedTitle = String(titleDraft || '').trim();

      const updatePayload: Record<string, unknown> = {
        // Core narrative
        summary,
        description, // backend alias → hypothesis
        // Definition / scope
        problemStatement: problemDefinitionPayload,
        marketContext: marketContextDraft || undefined,
        deliverables: normalizedDeliverables,
        deliverablesDone: normalizedDeliverablesDone,
        successCriteria: normalizedSuccessCriteria,
        scopeIn: normalizedScopeIn,
        scopeOut: normalizedScopeOut,
        killCriteria: normalizedKillCriteria,
        // Financials / tools / tags
        estimatedBudget: budgetDraft ? parseFloat(budgetDraft.replace(/[^0-9.]/g, '')) : undefined,
        resourceTools,
        tags,
        // Target state (stored as JSON)
        targetState: {
          description: targetDescriptionDraft || undefined,
        },
      };

      // Title is edited in the header and saved as `title` (DB column may be title or name).
      // Guarded by canEditCards to avoid editing in read-only contexts.
      if (canEditCards && normalizedTitle) {
        const savedTitle = String(initiative?.title || initiative?.name || '').trim();
        if (normalizedTitle !== savedTitle) {
          updatePayload.title = normalizedTitle;
        }
      }

      // Top-bar fields are permissioned by backend capabilities (gateReadiness).
      // Do NOT send fields the current user cannot edit, otherwise backend rejects the save.
      if (canEditPriority) {
        updatePayload.priority = normalizedPriority || undefined;
      }
      if (canEditOwner) {
        updatePayload.ownerId = ownerId || undefined;
        updatePayload.sponsorId = sponsorId || undefined;
      }
      if (canEditTargetDate) {
        updatePayload.plannedStartDate = startDate || undefined;
        updatePayload.plannedEndDate = targetDate || undefined;
      }

      const truth = await saveInitiativeWriteTruth(initiativeId, updatePayload);

      // Keep local baseline in sync so dirty-check resets immediately.
      setInitiative((prev: any) => ({
        ...prev,
        ...(truth.initiative || {}),
        title: canEditCards && normalizedTitle ? normalizedTitle : prev?.title,
        name: canEditCards && normalizedTitle ? normalizedTitle : prev?.name,
        summary,
        description,
        priority,
        ownerId,
        owner_id: ownerId,
        sponsorId,
        sponsor_id: sponsorId,
        plannedStartDate: startDate || null,
        planned_start_date: startDate || null,
        plannedEndDate: targetDate || null,
        planned_end_date: targetDate || null,
        targetDate: targetDate || null,
        problemStatement: problemDefinitionPayload || null,
        problem_statement: problemDefinitionPayload || null,
        marketContext: marketContextDraft || null,
        market_context: marketContextDraft || null,
        estimatedBudget: budgetDraft ? parseFloat(budgetDraft.replace(/[^0-9.]/g, '')) : null,
        estimated_budget: budgetDraft ? parseFloat(budgetDraft.replace(/[^0-9.]/g, '')) : null,
        resourceTools,
        resource_tools: resourceTools,
        deliverables: normalizedDeliverables,
        deliverablesDone: normalizedDeliverablesDone,
        deliverables_done: normalizedDeliverablesDone,
        successCriteria: normalizedSuccessCriteria,
        scopeIn: normalizedScopeIn,
        scopeOut: normalizedScopeOut,
        killCriteria: normalizedKillCriteria,
        kill_criteria: normalizedKillCriteria,
        tags,
        targetState: { description: targetDescriptionDraft || '' },
        target_state: { description: targetDescriptionDraft || '' },
      }));
      setGateReadiness(truth.gateReadiness);
      setStatusHistory(truth.statusHistory as any);
      setHistory(truth.history as any);

      // Clear local draft backup after a successful save.
      try {
        localStorage.removeItem(initiativeDefinitionDraftStorageKey);
      } catch {
        // ignore
      }

      if (!silent) {
        toast.success(t('initiatives.saved2'));
      }
    } catch (e: any) {
      if (!silent) {
        toast.error(e?.message || t('initiatives.toast.saveError', 'Failed to save'));
      }
    } finally {
      setIsMutating(false);
    }
  };

  const hasUnsavedChanges = useMemo(() => {
    const savedProblemRaw = initiative?.problemStatement || initiative?.problem_statement || '';
    let savedSymptom = '';
    let savedRootCause = '';
    let savedCost = '';
    if (savedProblemRaw && typeof savedProblemRaw === 'string') {
      try {
        const parsed = JSON.parse(savedProblemRaw);
        savedSymptom = parsed?.symptom || '';
        savedRootCause = parsed?.rootCause || '';
        savedCost = parsed?.costOfInaction || '';
      } catch {
        try {
          const decoded = decodeHtmlEntities(savedProblemRaw);
          const parsedDecoded = JSON.parse(decoded);
          savedSymptom = parsedDecoded?.symptom || '';
          savedRootCause = parsedDecoded?.rootCause || '';
          savedCost = parsedDecoded?.costOfInaction || '';
        } catch {
          savedSymptom = decodeHtmlEntities(savedProblemRaw);
        }
      }
    }

    const savedBudget = String(
      initiative?.estimatedBudget ||
        initiative?.estimated_budget ||
        initiative?.budget ||
        initiative?.budgetEstimate ||
        initiative?.costCapex ||
        initiative?.cost_capex ||
        ''
    );
    const savedTools = Array.isArray(initiative?.resourceTools)
      ? initiative.resourceTools
      : Array.isArray(initiative?.resource_tools)
        ? initiative.resource_tools
        : Array.isArray(initiative?.tools)
          ? initiative.tools
          : [];

    const savedDeliverables = Array.isArray(initiative?.deliverables)
      ? initiative.deliverables
      : Array.isArray(initiative?.targetState?.deliverables)
        ? initiative.targetState.deliverables
        : Array.isArray(initiative?.target_state?.deliverables)
          ? initiative.target_state.deliverables
          : [];
    const savedSuccessCriteria = Array.isArray(initiative?.successCriteria)
      ? initiative.successCriteria
      : Array.isArray(initiative?.success_criteria)
        ? initiative.success_criteria
        : Array.isArray(initiative?.targetState?.successCriteria)
          ? initiative.targetState.successCriteria
          : Array.isArray(initiative?.target_state?.successCriteria)
            ? initiative.target_state.successCriteria
            : [];

    const savedScopeIn = Array.isArray(initiative?.scopeIn)
      ? initiative.scopeIn
      : Array.isArray(initiative?.scope_in)
        ? initiative.scope_in
        : Array.isArray(initiative?.scope?.inScope)
          ? initiative.scope.inScope
          : [];
    const savedScopeOut = Array.isArray(initiative?.scopeOut)
      ? initiative.scopeOut
      : Array.isArray(initiative?.scope_out)
        ? initiative.scope_out
        : Array.isArray(initiative?.scope?.outScope)
          ? initiative.scope.outScope
          : [];
    const savedKillCriteria = Array.isArray(initiative?.killCriteria)
      ? initiative.killCriteria
      : Array.isArray(initiative?.kill_criteria)
        ? initiative.kill_criteria
        : Array.isArray(initiative?.scope?.killCriteria)
          ? initiative.scope.killCriteria
          : [];

    const normalizedDeliverables = deliverableItems
      .map((d) => String(d.text || '').trim())
      .filter(Boolean);
    const normalizedSuccessCriteria = successCriteriaItems
      .map((c) => String(c.text || '').trim())
      .filter(Boolean);

    const savedTargetDescription = String(
      initiative?.targetState?.description || initiative?.target_state?.description || ''
    );

    return (
      String(titleDraft || '').trim() !==
        String(initiative?.title || initiative?.name || '').trim() ||
      summary !== (initiative?.summary || '') ||
      description !== (initiative?.description || '') ||
      priority !== (initiative?.priority || 'medium').toLowerCase() ||
      ownerId !== (initiative?.ownerId || initiative?.owner_id || '') ||
      sponsorId !== (initiative?.sponsorId || initiative?.sponsor_id || '') ||
      targetDate !== (initiative?.plannedEndDate || initiative?.targetDate || '') ||
      (startDate || '') !==
        (initiative?.plannedStartDate || initiative?.planned_start_date || '') ||
      symptomDraft !== savedSymptom ||
      rootCauseDraft !== savedRootCause ||
      costOfInactionDraft !== savedCost ||
      marketContextDraft !== (initiative?.marketContext || initiative?.market_context || '') ||
      budgetDraft !== savedBudget ||
      JSON.stringify(resourceTools) !== JSON.stringify(savedTools) ||
      JSON.stringify(tags) !== JSON.stringify(initiative?.tags || []) ||
      JSON.stringify(normalizedDeliverables) !== JSON.stringify(savedDeliverables) ||
      JSON.stringify(normalizedSuccessCriteria) !== JSON.stringify(savedSuccessCriteria) ||
      JSON.stringify(inScopeItems) !== JSON.stringify(savedScopeIn) ||
      JSON.stringify(outScopeItems) !== JSON.stringify(savedScopeOut) ||
      JSON.stringify(killCriteriaItems) !== JSON.stringify(savedKillCriteria) ||
      targetDescriptionDraft !== savedTargetDescription
    );
  }, [
    initiative,
    titleDraft,
    summary,
    description,
    priority,
    ownerId,
    sponsorId,
    targetDate,
    startDate,
    symptomDraft,
    rootCauseDraft,
    costOfInactionDraft,
    marketContextDraft,
    budgetDraft,
    resourceTools,
    tags,
    deliverableItems,
    successCriteriaItems,
    inScopeItems,
    outScopeItems,
    killCriteriaItems,
    targetDescriptionDraft,
    decodeHtmlEntities,
  ]);

  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!hasUnsavedChanges || isMutating || !initiativeId) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      handleSave(true);
    }, 1500);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUnsavedChanges, isMutating, initiativeId]);

  const handleCreateTask = async () => {
    if (!canEditCards) {
      toast.error(t('initiatives.youDoNotHaveEditPermissions2'));
      return;
    }
    if (!newTaskTitle.trim()) return;
    setIsMutating(true);
    try {
      const projectId = initiative?.projectId || initiative?.project_id || initiative?.project?.id;
      const res = await Api.post('/tasks', {
        title: newTaskTitle,
        projectId,
        initiativeId,
        status: 'todo',
        source: 'manual',
        isMilestone: newTaskIsMilestone,
        milestoneDate: newTaskIsMilestone ? newTaskMilestoneDate : undefined,
      });
      setTasks((prev) => [
        ...prev,
        {
          id: res.id,
          title: res.title,
          source: res.source || 'manual',
          description: res.description,
          status: res.status,
          priority: res.priority,
          dueDate: res.dueDate,
          taskType: res.taskType,
          estimatedHours: res.estimatedHours,
          assigneeId: res.assigneeId,
          assigneeName: res.assigneeName || res.assignee?.name,
          isMilestone: res.isMilestone,
          milestoneDate: res.milestoneDate,
        },
      ]);
      setNewTaskTitle('');
      setNewTaskIsMilestone(false);
      setNewTaskMilestoneDate('');
      setShowCreateTask(false);
      toast.success(t('initiatives.taskCreated2'));
    } catch (e: any) {
      toast.error(e?.message || t('initiatives.toast.createTaskError', 'Failed to create task'));
    } finally {
      setIsMutating(false);
    }
  };

  const handleCreateDecision = async () => {
    if (!canEditCards) {
      toast.error(t('initiatives.youDoNotHaveEditPermissions2'));
      return;
    }
    if (!newDecisionTitle.trim()) return;
    setIsMutating(true);
    try {
      const res = await Api.post('/decisions', {
        title: newDecisionTitle,
        type: newDecisionType,
        relatedObjectId: initiativeId,
        relatedObjectType: 'initiative',
        status: 'PENDING',
      });
      const mapped = {
        id: res.id,
        title: res.title || newDecisionTitle,
        description: res.description || undefined,
        type: res.decisionType || res.type || newDecisionType,
        status: res.status || 'PENDING',
        priority: res.priority || undefined,
        decisionMakerId: res.decisionOwnerId || res.decisionMakerId || undefined,
        ownerName: res.ownerName || undefined,
        requestedByName: res.requestedByName || undefined,
        dueDate: res.dueDate || undefined,
        createdAt: res.createdAt || new Date().toISOString(),
        isOverdue: false,
        daysOverdue: 0,
        source: 'manual' as const,
      };
      setDecisions((prev) => [...prev, mapped]);
      setNewDecisionTitle('');
      setShowCreateDecision(false);
      toast.success(t('initiatives.decisionCreated2'));
    } catch (e: any) {
      toast.error(
        e?.message || t('initiatives.toast.createDecisionError', 'Failed to create decision')
      );
    } finally {
      setIsMutating(false);
    }
  };

  const handleRemoveDecision = async (id: string) => {
    try {
      await Api.delete(`/decisions/${id}`);
      setDecisions((prev) => prev.filter((d) => d.id !== id));
      toast.success(t('initiatives.decisionRemoved2'));
    } catch {
      toast.error(t('initiatives.failedToRemoveDecision2'));
    }
  };

  const handleCreateRaid = async () => {
    if (!canEditCards) {
      toast.error(t('initiatives.youDoNotHaveEditPermissions2'));
      return;
    }
    if (!newRaidTitle.trim()) return;
    setIsMutating(true);
    try {
      const res = await Api.post(`/initiatives/${initiativeId}/raid`, {
        type: newRaidType,
        title: newRaidTitle,
        description: newRaidDescription,
        severity: newRaidSeverity,
        status: 'OPEN',
      });
      setRaidItems((prev) => [...prev, res]);
      setNewRaidTitle('');
      setNewRaidDescription('');
      setShowCreateRaid(false);
      toast.success(t('initiatives.raidItemAdded2'));
    } catch (e: any) {
      toast.error(e?.message || t('initiatives.toast.createRaidError', 'Failed to add RAID item'));
    } finally {
      setIsMutating(false);
    }
  };

  const handleUpdateRaid = useCallback((id: string, updates: Partial<RaidItem>) => {
    setRaidItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  }, []);

  const handleDeleteRaid = useCallback(
    async (id: string) => {
      setRaidItems((prev) => prev.filter((item) => item.id !== id));
      toast.success(t('initiatives.raidItemRemoved2'));
      try {
        await Api.delete(`/initiatives/${initiativeId}/raid/${id}`);
      } catch {
        // Best-effort backend delete — item already removed from UI
      }
    },
    [initiativeId, isPolish]
  );

  // ── Resource CRUD handlers (Team / Budget / Tools) ──────────────────────
  const handleAddResource = useCallback(
    async (data: Omit<(typeof apiResourceItems)[0], 'id'>) => {
      try {
        const res = await Api.post(`/initiatives/${initiativeId}/resources`, {
          name: data.name,
          role: data.role,
          allocationPercentage: data.allocationPercentage,
          startDate: data.startDate,
          endDate: data.endDate,
          notes: data.notes,
          userId: data.userId,
        });
        const newItem = res?.resource || res;
        setApiResourceItems((prev) => [
          ...prev,
          { ...data, id: newItem.id || `res-${Date.now()}` },
        ]);
        toast.success(t('initiatives.resourceAdded2'));
        // INI-05: any other open view reading this initiative's capacity
        // (portfolio list, timeline) must not keep showing a pre-add snapshot.
        bumpInitiativeRefresh();
      } catch (e: any) {
        toast.error(e?.message || t('initiatives.failedToAddResource2'));
      }
    },
    [initiativeId, isPolish]
  );

  // INI-05: was fire-and-forget (`catch { /* best-effort */ }`) — a failed
  // PUT left the optimistic edit on screen showing false success, and a
  // concurrent edit elsewhere could be silently overwritten with no signal
  // to either user. Now: send the last-known `version` for CAS, and on
  // ANY failure (network, 403, 404, or a real 409 version conflict) revert
  // the optimistic change and surface it — never a silent/false success.
  const handleUpdateResource = useCallback(
    async (id: string, data: Partial<(typeof apiResourceItems)[0]>) => {
      let previousItem: (typeof apiResourceItems)[0] | undefined;
      setApiResourceItems((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          previousItem = item;
          return { ...item, ...data };
        })
      );
      try {
        const expectedVersion = previousItem?.version;
        const res = await Api.put(`/initiatives/${initiativeId}/resources/${id}`, {
          ...data,
          ...(expectedVersion !== undefined ? { expectedVersion } : {}),
        });
        const nextVersion = res?.version;
        if (typeof nextVersion === 'number') {
          setApiResourceItems((prev) =>
            prev.map((item) => (item.id === id ? { ...item, version: nextVersion } : item))
          );
        }
        bumpInitiativeRefresh();
      } catch (e: any) {
        setApiResourceItems((prev) =>
          prev.map((item) => (item.id === id && previousItem ? previousItem : item))
        );
        if (e?.status === 409) {
          toast.error(
            t(
              'initiatives.resourceUpdateConflict',
              'This resource was changed elsewhere — refresh and try again'
            )
          );
        } else {
          toast.error(
            e?.message || t('initiatives.failedToUpdateResource', 'Failed to update resource')
          );
        }
      }
    },
    [initiativeId, t]
  );

  const handleDeleteResource = useCallback(
    async (id: string) => {
      setApiResourceItems((prev) => prev.filter((item) => item.id !== id));
      toast.success(t('initiatives.resourceRemoved2'));
      try {
        await Api.delete(`/initiatives/${initiativeId}/resources/${id}`);
        bumpInitiativeRefresh();
      } catch {
        // best-effort
      }
    },
    [initiativeId, isPolish]
  );

  const handleAddBudgetItem = useCallback(
    async (data: Omit<(typeof apiBudgetItems)[0], 'id'>) => {
      try {
        const res = await Api.post(`/initiatives/${initiativeId}/budget-items`, data);
        const newItem = res?.budgetItem || res;
        setApiBudgetItems((prev) => [...prev, { ...data, id: newItem.id || `bi-${Date.now()}` }]);
        toast.success(t('initiatives.budgetItemAdded2'));
      } catch (e: any) {
        toast.error(e?.message || t('initiatives.failedToAddBudgetItem2'));
      }
    },
    [initiativeId, isPolish]
  );

  const handleUpdateBudgetItem = useCallback(
    async (id: string, data: Partial<(typeof apiBudgetItems)[0]>) => {
      setApiBudgetItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...data } : item))
      );
      try {
        await Api.put(`/initiatives/${initiativeId}/budget-items/${id}`, data);
      } catch {
        // best-effort
      }
    },
    [initiativeId]
  );

  const handleDeleteBudgetItem = useCallback(
    async (id: string) => {
      setApiBudgetItems((prev) => prev.filter((item) => item.id !== id));
      toast.success(t('initiatives.budgetItemRemoved2'));
      try {
        await Api.delete(`/initiatives/${initiativeId}/budget-items/${id}`);
      } catch {
        // best-effort
      }
    },
    [initiativeId, isPolish]
  );

  const handleAddTool = useCallback(
    async (data: Omit<(typeof apiToolItems)[0], 'id'>) => {
      try {
        const res = await Api.post(`/initiatives/${initiativeId}/tools`, data);
        const newItem = res?.tool || res;
        setApiToolItems((prev) => [...prev, { ...data, id: newItem.id || `tool-${Date.now()}` }]);
        toast.success(t('initiatives.toolAdded2'));
      } catch (e: any) {
        toast.error(e?.message || t('initiatives.failedToAddTool2'));
      }
    },
    [initiativeId, isPolish]
  );

  const handleUpdateTool = useCallback(
    async (id: string, data: Partial<(typeof apiToolItems)[0]>) => {
      setApiToolItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...data } : item)));
      try {
        await Api.put(`/initiatives/${initiativeId}/tools/${id}`, data);
      } catch {
        // best-effort
      }
    },
    [initiativeId]
  );

  const handleDeleteTool = useCallback(
    async (id: string) => {
      setApiToolItems((prev) => prev.filter((item) => item.id !== id));
      toast.success(t('initiatives.toolRemoved2'));
      try {
        await Api.delete(`/initiatives/${initiativeId}/tools/${id}`);
      } catch {
        // best-effort
      }
    },
    [initiativeId, isPolish]
  );

  // ── Intangible Assets CRUD handlers ──────────────────────
  const handleAddIntangibleAsset = useCallback(
    async (data: Omit<(typeof apiIntangibleAssets)[0], 'id'>) => {
      try {
        const res = await Api.post(`/initiatives/${initiativeId}/intangible-assets`, data);
        const newItem = res?.intangibleAsset || res;
        setApiIntangibleAssets((prev) => [
          ...prev,
          { ...data, id: newItem.id || `ia-${Date.now()}` },
        ]);
        toast.success(t('initiatives.intangibleAssetAdded2'));
      } catch (e: any) {
        toast.error(e?.message || t('initiatives.failedToAddAsset2'));
      }
    },
    [initiativeId, isPolish]
  );

  const handleUpdateIntangibleAsset = useCallback(
    async (id: string, data: Partial<(typeof apiIntangibleAssets)[0]>) => {
      setApiIntangibleAssets((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...data } : item))
      );
      try {
        await Api.put(`/initiatives/${initiativeId}/intangible-assets/${id}`, data);
      } catch {
        // best-effort
      }
    },
    [initiativeId]
  );

  const handleDeleteIntangibleAsset = useCallback(
    async (id: string) => {
      setApiIntangibleAssets((prev) => prev.filter((item) => item.id !== id));
      toast.success(t('initiatives.assetRemoved2'));
      try {
        await Api.delete(`/initiatives/${initiativeId}/intangible-assets/${id}`);
      } catch {
        // best-effort
      }
    },
    [initiativeId, isPolish]
  );

  const handleAddComment = async (content: string) => {
    const authorName = currentUser
      ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() ||
        currentUser.email ||
        'User'
      : 'User';

    // Optimistic local update
    const tempId = Math.random().toString(36).substr(2, 9);
    const newComment: Comment = {
      id: tempId,
      content,
      authorId: currentUserId,
      authorName,
      createdAt: new Date().toISOString(),
      likes: 0,
      likedByMe: false,
    };
    setComments((prev) => [...prev, newComment]);

    // Persist to backend
    try {
      const saved = await Api.post(`/initiatives/${initiativeId}/comments`, { content });
      // Replace temp ID with server-generated ID
      if (saved?.id) {
        setComments((prev) => prev.map((c) => (c.id === tempId ? { ...c, id: saved.id } : c)));
      }
    } catch {
      // Comment is shown locally even if persist fails (best-effort)
      // Endpoint may not exist yet — no toast to avoid noise
    }
  };

  // ── Attachment handlers (for AttachmentsLinksCanvas) ──────────────────────
  const handleUploadAttachments = useCallback(async (files: FileList) => {
    const newAttachments: Attachment[] = Array.from(files).map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      type: file.type,
      size: file.size,
      url: URL.createObjectURL(file),
      uploadedAt: new Date().toISOString(),
    }));
    setAttachments((prev) => [...prev, ...newAttachments]);
  }, []);

  const handleDeleteAttachment = useCallback(async (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // ── Linked items handlers (for AttachmentsLinksCanvas) ──────────────────
  const handleAddLinkedItem = useCallback(
    async (item: LinkedItem) => {
      const isDuplicate = linkedItems.some((li) => li.id === item.id && li.type === item.type);
      if (isDuplicate) {
        toast(t('initiatives.thisItemIsAlreadyLinked2'), {
          icon: '⚠️',
        });
        return;
      }
      setLinkedItems((prev) => [...prev, item]);
    },
    [linkedItems, isPolish]
  );

  const handleRemoveLinkedItem = useCallback(async (item: Pick<LinkedItem, 'id' | 'type'>) => {
    setLinkedItems((prev) =>
      prev.filter((i) =>
        item.type ? !(i.id === item.id && i.type === item.type) : i.id !== item.id
      )
    );
  }, []);

  const searchLinkedItems = useCallback(async (query: string): Promise<LinkedItem[]> => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    try {
      const [
        tasksRes,
        initiativesRes,
        decisionsRes,
        projectsRes,
        assessmentsRes,
        reportsRes,
        toolsRes,
        insightsRes,
      ] = await Promise.allSettled([
        Api.get('/tasks?limit=50'),
        Api.get('/initiatives'),
        Api.getDecisions(),
        Api.getProjects(),
        Api.get('/assessments'),
        Api.get('/reports'),
        Api.listToolSessions({ limit: 50 }),
        Api.get('/interview/insights'),
      ]);

      const tasks =
        tasksRes.status === 'fulfilled'
          ? Array.isArray(tasksRes.value)
            ? tasksRes.value
            : tasksRes.value?.tasks || []
          : [];
      const initiatives =
        initiativesRes.status === 'fulfilled'
          ? Array.isArray(initiativesRes.value)
            ? initiativesRes.value
            : initiativesRes.value?.initiatives || []
          : [];
      const decisions = decisionsRes.status === 'fulfilled' ? decisionsRes.value || [] : [];
      const projects =
        projectsRes.status === 'fulfilled'
          ? Array.isArray(projectsRes.value)
            ? projectsRes.value
            : (projectsRes.value as any)?.projects || []
          : [];
      const assessments =
        assessmentsRes.status === 'fulfilled'
          ? Array.isArray(assessmentsRes.value)
            ? assessmentsRes.value
            : assessmentsRes.value?.assessments || []
          : [];
      const reports =
        reportsRes.status === 'fulfilled'
          ? Array.isArray(reportsRes.value)
            ? reportsRes.value
            : reportsRes.value?.reports || []
          : [];
      const tools =
        toolsRes.status === 'fulfilled'
          ? Array.isArray(toolsRes.value)
            ? toolsRes.value
            : toolsRes.value?.items || []
          : [];
      const insights =
        insightsRes.status === 'fulfilled'
          ? Array.isArray(insightsRes.value)
            ? insightsRes.value
            : insightsRes.value?.insights || []
          : [];

      const mappedTasks: LinkedItem[] = tasks
        .filter((t: any) =>
          String(t.title || '')
            .toLowerCase()
            .includes(q)
        )
        .slice(0, 10)
        .map((t: any) => ({
          id: String(t.id),
          type: 'task' as const,
          title: String(t.title || 'Task'),
          status: t.status,
          priority: t.priority,
        }));
      const mappedInitiatives: LinkedItem[] = initiatives
        .filter((i: any) =>
          String(i.name || i.title || '')
            .toLowerCase()
            .includes(q)
        )
        .slice(0, 10)
        .map((i: any) => ({
          id: String(i.id),
          type: 'initiative' as const,
          title: String(i.name || i.title || 'Initiative'),
          status: i.status,
          priority: i.priority,
        }));
      const mappedDecisions: LinkedItem[] = decisions
        .filter((d: any) =>
          String(d.title || '')
            .toLowerCase()
            .includes(q)
        )
        .slice(0, 10)
        .map((d: any) => ({
          id: String(d.id),
          type: 'decision' as const,
          title: String(d.title || 'Decision'),
          status: d.status,
          priority: d.priority,
        }));
      const mappedProjects: LinkedItem[] = projects
        .filter((p: any) =>
          String(p.name || p.title || '')
            .toLowerCase()
            .includes(q)
        )
        .slice(0, 10)
        .map((p: any) => ({
          id: String(p.id),
          type: 'project' as const,
          title: String(p.name || p.title || 'Project'),
          status: p.status,
          priority: p.priority,
        }));
      const mappedAssessments: LinkedItem[] = assessments
        .filter((a: any) =>
          String(a.title || a.name || '')
            .toLowerCase()
            .includes(q)
        )
        .slice(0, 8)
        .map((a: any) => ({
          id: String(a.id),
          type: 'assessment' as const,
          title: String(a.title || a.name || 'Assessment'),
          status: a.status,
          url: '/assessment',
        }));
      const mappedReports: LinkedItem[] = reports
        .filter((r: any) =>
          String(r.title || r.name || '')
            .toLowerCase()
            .includes(q)
        )
        .slice(0, 8)
        .map((r: any) => ({
          id: String(r.id),
          type: 'report' as const,
          title: String(r.title || r.name || 'Report'),
          status: r.status,
          url: `/assessment-reports/${String(r.id)}`,
        }));
      const mappedTools: LinkedItem[] = tools
        .filter((tool: any) =>
          String(tool.name || tool.title || tool.toolType || '')
            .toLowerCase()
            .includes(q)
        )
        .slice(0, 8)
        .map((tool: any) => ({
          id: String(tool.id),
          type: 'tool' as const,
          title: String(tool.name || tool.title || tool.toolType || 'Tool'),
          status: tool.status,
          url: '/tools',
        }));
      const mappedInsights: LinkedItem[] = insights
        .filter((insight: any) =>
          String(insight.title || insight.name || insight.summary || '')
            .toLowerCase()
            .includes(q)
        )
        .slice(0, 8)
        .map((insight: any) => ({
          id: String(insight.id),
          type: 'insight' as const,
          title: String(insight.title || insight.name || 'Insight'),
          status: insight.status,
          url: '/interview',
        }));

      return [
        ...mappedTasks,
        ...mappedInitiatives,
        ...mappedDecisions,
        ...mappedProjects,
        ...mappedAssessments,
        ...mappedReports,
        ...mappedTools,
        ...mappedInsights,
      ].slice(0, 24);
    } catch {
      return [];
    }
  }, []);

  const openLinkedItemTarget = useCallback(
    (item: LinkedItem) => {
      const explicitUrl = item.externalUrl || item.url;
      const normalizedItemId = String(item.id);
      const fallbackPath =
        item.type === 'task'
          ? `/my-work/tasks/${normalizedItemId}`
          : item.type === 'decision'
            ? `/my-work/decisions/${normalizedItemId}`
            : item.type === 'initiative'
              ? `/initiatives/${normalizedItemId}`
              : item.type === 'project'
                ? `/projects/${normalizedItemId}`
                : item.type === 'assessment'
                  ? '/assessment'
                  : item.type === 'report'
                    ? `/assessment-reports/${normalizedItemId}`
                    : item.type === 'tool'
                      ? '/tools'
                      : item.type === 'insight'
                        ? '/interview'
                        : null;
      const target = explicitUrl || fallbackPath;
      if (!target) {
        toast(t('initiatives.noTargetLinkAvailable2'), { icon: 'ℹ️' });
        return;
      }
      window.open(target, '_blank', 'noopener,noreferrer');
    },
    [isPolish]
  );

  const handleCopyLink = () => {
    navigator.clipboard
      .writeText(buildArtifactPermalink('initiative', initiativeId))
      .then(() => {
        toast.success(t('initiatives.initiativePermalinkCopied2'));
      })
      .catch(() => {
        toast.error(t('initiatives.failedToCopyLink2'));
      })
      .finally(() => {
        setShowMoreMenu(false);
      });
  };
  const handleExportPDF = () => {
    toast(t('initiatives.pdfExportComingSoon2'), {
      icon: '📄',
    });
    setShowMoreMenu(false);
  };

  const handleGenerateScopeCard = async (): Promise<void> => {
    setIsGeneratingAI('scope');
    const aiLanguage = isPolish ? 'pl' : 'en';
    const targetLanguageName = t('initiatives.english2');

    const buildParagraphSystemInstruction = (
      fieldLabel: string,
      mode: 'generate' | 'improve',
      opts?: {
        /** Minimum number of sentences when using paragraph format */
        minSentences?: number;
        /** Suggested sentence range when using paragraph format */
        sentenceRangeHint?: string;
        /** Allow simple hyphen bullets as an alternative */
        allowBullets?: boolean;
        /** If bullets are used, suggested range */
        bulletRangeHint?: string;
      }
    ) =>
      [
        mode === 'generate'
          ? `You are a senior PMO consultant and an expert business writer.`
          : `You are a professional PMO content editor.`,
        mode === 'generate'
          ? `Generate professional content for the field "${fieldLabel}".`
          : `Refine the user's text for the field "${fieldLabel}".`,
        `Rules:`,
        `- Output language MUST be ${targetLanguageName}, even if the input/context is in a different language (translate as needed).`,
        `- Do NOT invent new facts, numbers, dates, systems, or KPI values that are not present in the provided context. If information is missing, keep it generic and/or explicitly mark what needs confirmation in a single short sentence.`,
        `- Return ONLY the final field text. No commentary, no quotes, no prefixes, no markdown.`,
        `- Length: ${
          opts?.sentenceRangeHint || '2–5 sentences'
        } (minimum ${opts?.minSentences ?? 2} sentences).`,
        `- Do NOT return a single sentence.`,
        opts?.allowBullets
          ? [
              `- You MAY use a simple hyphen bullet list instead if there are multiple distinct arguments.`,
              `  - Bullets: ${opts?.bulletRangeHint || '3–7 bullets'}`,
              `  - Each bullet must start with "- " and be a standalone point`,
              `  - No numbering, no headings, no bold/italics, no empty lines`,
            ].join('\n')
          : ``,
        mode === 'generate'
          ? `- Style: concrete, delivery-oriented, executive/PMO. Prefer specific operational/business impacts over generic filler.`
          : `- Keep the same meaning, but make it clearer, more decision-oriented, and more actionable.`,
      ].join('\n');

    const buildListSystemInstruction = (fieldLabel: string, mode: 'generate' | 'improve') =>
      [
        mode === 'generate'
          ? `You are a senior PMO consultant and an expert business writer.`
          : `You are a professional PMO content editor.`,
        mode === 'generate'
          ? `Generate a list for the field "${fieldLabel}".`
          : `Refine the list items for the field "${fieldLabel}".`,
        `Rules:`,
        `- Output language MUST be ${targetLanguageName}, even if the input/context is in a different language (translate as needed).`,
        `- Do NOT invent new facts, numbers, dates, systems, or KPI values that are not present in the provided context.`,
        `- Return ONLY the final list text. No commentary, no quotes, no prefixes, no markdown.`,
        `Formatting requirements:`,
        `- ONE item per line`,
        `- No bullets, no numbering`,
        `- No empty lines`,
        mode === 'generate'
          ? `- Return 5–8 distinct items.`
          : `- Make items clearer and more action-oriented.`,
      ].join('\n');

    const refineOrGenerate = async (
      fieldLabel: string,
      current: string,
      output: 'paragraph' | 'list'
    ) => {
      const sanitizedCurrent = String(current || '')
        .replace(/&quot;/g, '"')
        .trim();
      const looksLikeJsonObject =
        sanitizedCurrent.startsWith('{') &&
        (sanitizedCurrent.includes('"symptom"') ||
          sanitizedCurrent.includes('"rootCause"') ||
          sanitizedCurrent.includes('"costOfInaction"') ||
          sanitizedCurrent.includes('"marketContext"'));

      const mode: 'generate' | 'improve' =
        sanitizedCurrent && !looksLikeJsonObject ? 'improve' : 'generate';
      const systemInstruction =
        output === 'list'
          ? buildListSystemInstruction(fieldLabel, mode)
          : buildParagraphSystemInstruction(fieldLabel, mode);

      const text =
        mode === 'generate'
          ? [
              `[GENERATE FROM SCRATCH]`,
              `Field: ${fieldLabel}`,
              `Initiative: ${initiative?.name || ''}`,
              `Known summary: ${String(summary || initiative?.description || '').trim()}`,
              `Known problem: ${String(symptomDraft || '').trim()}`,
              `Known solution: ${String(rootCauseDraft || '').trim()}`,
              `Known cost of inaction: ${String(costOfInactionDraft || '').trim()}`,
              `Known market context: ${String(marketContextDraft || '').trim()}`,
            ].join('\n')
          : sanitizedCurrent;

      const aiRes = await Api.post('/ai/refine-text', {
        text,
        mode,
        systemInstruction,
        fieldLabel,
        artifactContext: {
          title: initiative?.name || '',
          status,
          priority,
          type: 'initiative',
        },
        language: aiLanguage,
      });
      return String(aiRes?.text || '').trim();
    };

    try {
      // 1) Fill the Description & Context fields (generate if empty, improve if present)
      const [problem, solution, cost, market] = await Promise.all([
        refineOrGenerate(t('initiatives.problem2'), symptomDraft, 'paragraph'),
        refineOrGenerate(t('initiatives.proposedSolution2'), rootCauseDraft, 'paragraph'),
        // Cost of inaction tends to have multiple arguments → allow bullets
        (async () => {
          const current = costOfInactionDraft;
          const mode: 'generate' | 'improve' = String(current || '').trim()
            ? 'improve'
            : 'generate';
          const fieldLabel = t('initiatives.costOfInaction2');
          const systemInstruction = buildParagraphSystemInstruction(fieldLabel, mode, {
            minSentences: 2,
            sentenceRangeHint: '2–6 sentences',
            allowBullets: true,
            bulletRangeHint: '3–8 bullets',
          });
          const text =
            mode === 'generate'
              ? [
                  `[GENERATE FROM SCRATCH]`,
                  `Field: ${fieldLabel}`,
                  `Initiative: ${initiative?.name || ''}`,
                  `Known summary: ${String(summary || initiative?.description || '').trim()}`,
                  `Known problem: ${String(symptomDraft || '').trim()}`,
                  `Known solution: ${String(rootCauseDraft || '').trim()}`,
                  `Known market context: ${String(marketContextDraft || '').trim()}`,
                  ``,
                  `Hint: If multiple distinct impacts exist, prefer hyphen bullets. Mix quantitative and qualitative impacts. If a number is unknown, mark it as [confirm].`,
                ].join('\n')
              : String(current || '')
                  .replace(/&quot;/g, '"')
                  .trim();

          const aiRes = await Api.post('/ai/refine-text', {
            text,
            mode,
            systemInstruction,
            fieldLabel,
            artifactContext: {
              title: initiative?.name || '',
              status,
              priority,
              type: 'initiative',
            },
            language: aiLanguage,
          });
          return String(aiRes?.text || '').trim();
        })(),
        refineOrGenerate(t('initiatives.marketContext2'), marketContextDraft, 'paragraph'),
      ]);

      if (problem) setSymptomDraft(problem);
      if (solution) setRootCauseDraft(solution);
      if (cost) setCostOfInactionDraft(cost);
      if (market) setMarketContextDraft(market);

      // 2) Scope boundaries lists: if all empty -> use structured section prompt; otherwise refine/generate lists
      const safeInScope = normalizeStringList(inScopeItems);
      const safeOutScope = normalizeStringList(outScopeItems);
      const safeKillCriteria = normalizeStringList(killCriteriaItems);

      const hasAnyScope =
        safeInScope.filter(Boolean).length > 0 ||
        safeOutScope.filter(Boolean).length > 0 ||
        safeKillCriteria.filter(Boolean).length > 0;

      if (!hasAnyScope) {
        const context = {
          sectionKey: 'scope',
          initiativeId,
          initiativeName: initiative?.name || '',
          summary: summary || initiative?.description || '',
          problemStatement: initiative?.problem_statement || '',
          category: initiative?.category || '',
          module: initiative?.module || '',
          status: getWorkflowStatusForInitiative(initiative as any),
          language: aiLanguage,
        };
        const res = await Api.post('/initiatives/generate-section', context);
        const parsed = res?.parsedContent || res?.content;
        const parsedInScope = normalizeStringList(parsed?.inScope);
        const parsedOutScope = normalizeStringList(parsed?.outOfScope ?? parsed?.outScope);
        const parsedKillCriteria = normalizeStringList(
          parsed?.killCriteria ?? parsed?.kill_criteria ?? parsed?.killCriteriaItems
        );

        if (parsedInScope.length) setInScopeItems(parsedInScope);
        if (parsedOutScope.length) setOutScopeItems(parsedOutScope);
        if (parsedKillCriteria.length) setKillCriteriaItems(parsedKillCriteria);
      } else {
        const [inScopeText, outScopeText, killText] = await Promise.all([
          refineOrGenerate(
            t('initiatives.inScopeList2'),
            safeInScope.filter(Boolean).join('\n'),
            'list'
          ),
          refineOrGenerate(
            t('initiatives.outOfScopeList2'),
            safeOutScope.filter(Boolean).join('\n'),
            'list'
          ),
          refineOrGenerate(
            t('initiatives.killCriteriaList2'),
            safeKillCriteria.filter(Boolean).join('\n'),
            'list'
          ),
        ]);

        if (inScopeText) setInScopeItems(normalizeStringList(inScopeText));
        if (outScopeText) setOutScopeItems(normalizeStringList(outScopeText));
        if (killText) setKillCriteriaItems(normalizeStringList(killText));
      }

      toast.success(t('initiatives.scopeGeneratedByAi2'));
    } catch (e: any) {
      toast.error(e?.message || t('initiatives.generateScopeFailed2'));
    } finally {
      setIsGeneratingAI(null);
    }
  };

  const handleGenerateAI = async (section: string): Promise<any> => {
    setIsGeneratingAI(section);
    try {
      const aiLanguage = isPolish ? 'pl' : 'en';
      const targetLanguageName = t('initiatives.english2');
      const context = {
        sectionKey: section,
        initiativeId,
        initiativeName: initiative?.name || '',
        summary: summary || initiative?.description || '',
        problemStatement: initiative?.problem_statement || '',
        category: initiative?.category || '',
        module: initiative?.module || '',
        status: getWorkflowStatusForInitiative(initiative as any),
        language: aiLanguage,
      };

      const result = await Api.post('/initiatives/generate-section', context);

      if (result?.parsedContent || result?.content) {
        if (section === 'overview' || section === 'summary') {
          // Set the summary
          setSummary(result.parsedContent || result.content);

          // Also generate content for Description & Context sub-fields if they are empty
          const subFieldsToGenerate: {
            key: string;
            setter: (v: string) => void;
            current: string;
          }[] = [
            {
              key: 'problem_definition',
              setter: (v: string) => setSymptomDraft(v),
              current: symptomDraft,
            },
            {
              key: 'proposed_solution',
              setter: (v: string) => setRootCauseDraft(v),
              current: rootCauseDraft,
            },
            {
              key: 'cost_of_inaction',
              setter: (v: string) => setCostOfInactionDraft(v),
              current: costOfInactionDraft,
            },
            {
              key: 'market_context',
              setter: (v: string) => setMarketContextDraft(v),
              current: marketContextDraft,
            },
          ];

          // Generate sub-fields in parallel (only empty ones)
          const emptyFields = subFieldsToGenerate.filter((f) => !f.current.trim());
          if (emptyFields.length > 0) {
            const subResults = await Promise.allSettled(
              emptyFields.map((f) =>
                Api.post('/ai/refine-text', {
                  text: `[GENERATE FROM SCRATCH] Section: ${f.key}. Initiative: ${initiative?.name || ''}. Summary: ${result.parsedContent || result.content}`,
                  mode: 'generate',
                  systemInstruction: `You are a strategic PMO expert. Generate professional content for the "${f.key}" section of initiative "${initiative?.name || ''}". Return ONLY the content — no commentary, no quotes, no prefixes. Write concisely (2-4 sentences). Output language: ${targetLanguageName}. Translate as needed.`,
                  fieldLabel: f.key,
                  artifactContext: {
                    title: initiative?.name || '',
                    status,
                    priority,
                    type: 'initiative',
                  },
                  language: aiLanguage,
                })
              )
            );

            subResults.forEach((res, idx) => {
              if (res.status === 'fulfilled' && res.value?.text) {
                emptyFields[idx].setter(String(res.value.text).trim());
              }
            });
          }

          toast.success(t('initiatives.descriptionGeneratedByAi2'));
        } else if (section === 'raid') {
          // Parse RAID JSON and insert items into state
          const parsed =
            result.parsedContent ||
            (() => {
              try {
                const jsonMatch = (result.content || '').match(
                  /```(?:json)?\s*([\s\S]*?)\s*```/
                ) || [null, result.content];
                return JSON.parse(jsonMatch[1] || result.content || '{}');
              } catch {
                return null;
              }
            })();
          if (parsed) {
            const now = Date.now();
            const newItems: any[] = [];
            const mapItem = (item: any, type: string, idx: number) => ({
              id: `raid-ai-${now}-${type}-${idx}`,
              type,
              title: item.title || '',
              description: item.description || '',
              severity: (item.impact || item.severity || 'MEDIUM').toUpperCase(),
              status: (item.status || 'OPEN').toUpperCase(),
              owner: item.owner || '',
              mitigationPlan: item.mitigation || item.proposedAction || '',
              probability: item.probability || undefined,
              category: item.category || 'business',
              contingency: item.contingency || '',
              proposedAction: item.proposedAction || '',
              responseStrategy: item.responseStrategy || undefined,
              dueDate: item.dueDate || '',
              source: item.source || 'AI analysis',
            });
            if (Array.isArray(parsed.risks)) {
              parsed.risks.forEach((r: any, i: number) => newItems.push(mapItem(r, 'risk', i)));
            }
            if (Array.isArray(parsed.assumptions)) {
              parsed.assumptions.forEach((r: any, i: number) =>
                newItems.push(mapItem(r, 'assumption', i))
              );
            }
            if (Array.isArray(parsed.issues)) {
              parsed.issues.forEach((r: any, i: number) => newItems.push(mapItem(r, 'issue', i)));
            }
            if (Array.isArray(parsed.dependencies)) {
              parsed.dependencies.forEach((r: any, i: number) =>
                newItems.push(mapItem(r, 'dependency', i))
              );
            }
            if (newItems.length > 0) {
              setRaidItems((prev) => [...newItems, ...prev]);
              toast.success(
                isPolish
                  ? `AI wygenerował ${newItems.length} elementów RAID`
                  : `AI generated ${newItems.length} RAID items`
              );
            } else {
              toast.error(t('initiatives.aiGeneratedNoRaidItems2'));
            }
          } else {
            toast.error(t('initiatives.failedToParseAiResponse2'));
          }
        } else if (section === 'comments') {
          const aiComment: Comment = {
            id: `ai-${Date.now()}`,
            content: result.content || t('initiatives.aiAnalysis2'),
            authorId: 'ai-assistant',
            authorName: 'AI Assistant',
            createdAt: new Date().toISOString(),
            likes: 0,
            likedByMe: false,
          };
          setComments((prev) => [aiComment, ...prev]);
          toast.success(t('initiatives.aiAddedComment2'));
        } else {
          // For structured sections, the result is returned to the calling component
          toast.success(
            isPolish
              ? `AI wygenerował zawartość: ${section}`
              : `AI generated content for: ${section}`
          );
        }
        return result;
      } else {
        toast.error(t('initiatives.aiReturnedNoResults2'));
        return null;
      }
    } catch (e: any) {
      toast.error(e?.message || t('initiatives.toast.aiGenerationError', 'AI generation failed'));
      return null;
    } finally {
      setIsGeneratingAI(null);
    }
  };

  // Financial sections (financial-analysis / financial-impact) AI-fill.
  // Propose → review → persist, mirroring the other section handlers. The backend
  // prompt/guidance for these section keys already exists; the canonical
  // persistence target for sizing/ROI prose is `market_context` (saved by the
  // existing dirty/save flow via marketContextDraft — see the initiative PATCH
  // payload `market_context: marketContextDraft`). We never auto-submit: the
  // generated text lands in the editable draft and the user reviews + saves it.
  const handleGenerateFinancial = useCallback(
    async (section: 'financial-analysis' | 'financial-impact'): Promise<void> => {
      if (!canUseAi) {
        toast.error(t('initiatives.aiIsUnavailableBecauseYouHave2'));
        return;
      }
      setIsGeneratingAI(section);
      try {
        const aiLanguage = isPolish ? 'pl' : 'en';
        const result = await Api.post('/initiatives/generate-section', {
          sectionKey: section,
          initiativeId,
          initiativeName: initiative?.name || '',
          summary: summary || initiative?.description || '',
          problemStatement: initiative?.problem_statement || '',
          category: initiative?.category || '',
          module: initiative?.module || '',
          status: getWorkflowStatusForInitiative(initiative as any),
          language: aiLanguage,
          // Opt into the advisory adversarial review for financial sections — the
          // sizing/ROI numbers are the highest-risk content to ship unchecked.
          withReview: true,
        });

        // Capture the advisory verdict (if the backend ran the second pass) so the
        // chip can render. Never blocks — purely informational.
        const review = result?.review;
        if (review && typeof review === 'object') {
          setSectionReview((prev) => ({
            ...prev,
            [section]: {
              score: Number(review.score) || 0,
              verdict: review.verdict === 'PASS' ? 'PASS' : 'FAIL',
              gaps: Array.isArray(review.qualityGaps) ? review.qualityGaps.slice(0, 4) : [],
              degraded: !!review.degraded,
            },
          }));
        }

        // Normalize: financial prompts may return JSON (sizing object) or prose.
        let text = '';
        if (result?.parsedContent && typeof result.parsedContent === 'object') {
          const p = result.parsedContent as Record<string, any>;
          const parts: string[] = [];
          const pick = (...keys: string[]) => {
            for (const k of keys) {
              const v = p[k];
              if (typeof v === 'string' && v.trim()) return v.trim();
            }
            return '';
          };
          const sizing = pick('sizing', 'roiAnalysis', 'roi', 'marketContext', 'market_context');
          const revenue = pick('revenueImpact', 'revenue_impact');
          const cost = pick('costSavings', 'cost_savings');
          const benefits = pick('benefitsRealization', 'benefits_realization');
          if (sizing) parts.push(sizing);
          if (revenue) parts.push(`${t('initiatives.revenueImpact2')}: ${revenue}`);
          if (cost) parts.push(`${t('initiatives.costSavings2')}: ${cost}`);
          if (benefits) parts.push(`${t('initiatives.benefitsRealization2')}: ${benefits}`);
          text = parts.join('\n\n').trim() || JSON.stringify(result.parsedContent, null, 2);
        } else {
          text = String(result?.content || '').trim();
        }

        if (!text) {
          toast.error(t('initiatives.aiReturnedNoResults2'));
          return;
        }

        // PROPOSE → REVIEW: surface in the editable draft. Both financial sections
        // share the single `market_context` field, so we upsert THIS section's
        // labeled block (M13 #1) — re-generating one section replaces only its own
        // block and never clobbers the other's content.
        setMarketContextDraft((prev) => upsertFinancialBlock(prev, section, text, isPolish));
        toast.success(t('initiatives.aiGeneratedAFinancialDraftReview2'));
      } catch (e: any) {
        toast.error(e?.message || t('initiatives.toast.aiGenerationError', 'AI generation failed'));
      } finally {
        setIsGeneratingAI(null);
      }
    },
    [canUseAi, isPolish, initiativeId, initiative, summary, t]
  );

  const handleRequestApproval = async (role: 'owner' | 'sponsor', gateType: string) => {
    setIsMutating(true);
    try {
      const targetUserId = role === 'owner' ? ownerId : sponsorId;
      if (!targetUserId) {
        toast.error(
          isPolish
            ? `Wybierz ${role === 'owner' ? 'właściciela' : 'sponsora'}`
            : `Select ${role} first`
        );
        return;
      }
      await Api.post('/decisions', {
        title: `${gateType} - ${initiative?.name}`,
        type: gateType,
        relatedObjectId: initiativeId,
        relatedObjectType: 'initiative',
        status: 'PENDING',
        deciderId: targetUserId,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
      toast.success(t('initiatives.approvalRequestSent2'));
      fetchAll();
    } catch (e: any) {
      toast.error(
        e?.message || t('initiatives.toast.approvalRequestError', 'Failed to send approval request')
      );
    } finally {
      setIsMutating(false);
    }
  };

  // D13 (Menu 1 audit 2026-07-22): Menu 1 NO LONGER wires `onChat` to NModeHeader.
  // The header AI button renders only with `showChatButton`, so passing `onChat`
  // alone was dead (same defect fixed on Interview — "MARTWE WPIECIE AI"). Here the
  // fix is the OPPOSITE of Interview: Initiative is a card WITH Menu 3, so AI lives
  // in Menu 3 + the Slot 9 AI Consultant panel + per-section AI CTAs. Adding a
  // header button would be a THIRD, redundant AI entry point (§2.6 "ta sama treść
  // w dwóch miejscach"). So we REMOVE the header wiring, not enable showChatButton.
  // `handleOpenChat` stays alive: it's exported via InitiativeContext (contextValue)
  // and consumed by section CTAs — this is NOT dead code.
  const handleOpenChat = () => {
    if (isChatCollapsed) toggleChatCollapse();
    updateWorkspaceFromView(AppView.INITIATIVE_GENERATOR, initiativeId, {
      type: 'initiative',
      id: initiativeId,
      title: initiative?.name || '',
      status,
      phase: isPolish ? moduleConfig.labelPl : moduleConfig.label,
      summary,
      tasksCount: tasks.length,
      tasksDone,
      decisionsCount: decisions.length,
      raidCount: raidItems.length,
    });
  };

  // #33 — contextual AI-CTA on the Initiative card ("Zaproponuj kolejne kroki" /
  // "Propose next steps"), same doctrine (D17) as TaskDetailView's "Create Ideas"
  // and DecisionDetailView's "Analyze options": ONE docked Teresa panel opened via
  // useOpenChatWithContext + a pre-seeded prompt (contextData.teresaPrompt, the
  // same mechanism InsightViewer's openInsightConsultant relies on). Deliberately
  // separate from the legacy Slot 9 "AI Consultant" button (setAiPanelOpen /
  // AIConsultantPanel below) — that is a second, non-canonical panel out of scope
  // here; this CTA routes only through the single Teresa panel.
  const handleProposeNextStepsWithAI = useCallback(async () => {
    const teresaPrompt = isPolish
      ? `Zaproponuj kolejne kroki dla inicjatywy „${initiative?.name || 'bez tytułu'}” na podstawie jej obecnego statusu (${status}), otwartych zadań (${tasks.length - tasksDone}/${tasks.length}) i decyzji (${decisions.length}). Podaj konkretną, priorytetową listę akcji.`
      : `Propose next steps for the initiative "${initiative?.name || 'untitled'}" based on its current status (${status}), open tasks (${tasks.length - tasksDone}/${tasks.length}), and decisions (${decisions.length}). Give a concrete, prioritized action list.`;
    await openChatWithContext({
      entityType: 'initiative',
      entityId: initiativeId,
      entityName: initiative?.name || '',
      contextData: {
        module: 'initiative',
        status,
        tasksCount: tasks.length,
        tasksDone,
        decisionsCount: decisions.length,
        teresaPrompt,
      },
    });
  }, [
    openChatWithContext,
    initiativeId,
    initiative?.name,
    status,
    tasks.length,
    tasksDone,
    decisions.length,
    isPolish,
  ]);

  const handleOpenTaskArtifact = useCallback(
    (taskId: string) => {
      if (isShowcaseArtifactId(taskId)) {
        toast(t('initiatives.thisDemoTaskIsPresentedInside2'));
        return;
      }
      if (onOpenTask) {
        onOpenTask(taskId);
        return;
      }
      // Fallback: open task artifact in My Work floating document panel
      setMyWorkIntent({
        tab: 'tasks',
        open: {
          type: 'task',
          id: taskId,
          name: t('initiatives.task2'),
        },
      });
      setCurrentView(AppView.MY_WORK);
    },
    [onOpenTask, setMyWorkIntent, setCurrentView, isPolish]
  );

  const handleOpenDecisionArtifact = useCallback(
    (decisionId: string) => {
      if (isShowcaseArtifactId(decisionId)) {
        toast(t('initiatives.thisDemoDecisionIsPresentedInside2'));
        return;
      }
      if (onOpenDecision) {
        onOpenDecision(decisionId);
        return;
      }
      // Fallback: open decision artifact in My Work floating document panel
      setMyWorkIntent({
        tab: 'decisions',
        open: {
          type: 'decision',
          id: decisionId,
          name: t('initiatives.decision2'),
        },
      });
      setCurrentView(AppView.MY_WORK);
    },
    [onOpenDecision, setMyWorkIntent, setCurrentView, isPolish]
  );

  const handleArchive = async () => {
    if (!confirm(t('initiatives.areYouSureYouWantTo3'))) return;
    setIsMutating(true);
    try {
      await Api.post(`/initiatives/${initiativeId}/archive`, {});
      toast.success(t('initiatives.initiativeArchived2'));
      setShowMoreMenu(false);
      fetchAll();
    } catch (e: any) {
      toast.error(e?.message || t('initiatives.toast.archiveError', 'Failed to archive'));
    } finally {
      setIsMutating(false);
    }
  };

  const handleDelete = async () => {
    // Mirror the server guard (InitiativeController.deleteInitiative): only
    // not-yet-active initiatives can be hard-deleted; everything else must be
    // cancelled first so linked M14/15/16 rows unwind through the lifecycle.
    if (status !== 'DRAFT' && status !== 'CANCELLED') {
      toast.error(t('initiatives.onlyDraftsCanBeDeleted2'));
      return;
    }
    if (!confirm(t('initiatives.areYouSureYouWantTo4'))) return;
    setIsMutating(true);
    try {
      await Api.delete(`/initiatives/${initiativeId}`);
      toast.success(t('initiatives.initiativeDeleted2'));
      setShowMoreMenu(false);
      onBack?.();
    } catch (e: any) {
      toast.error(e?.message || t('initiatives.toast.deleteError', 'Failed to delete'));
    } finally {
      setIsMutating(false);
    }
  };

  // ==========================================
  // CONTEXT VALUE
  // ==========================================

  const contextValue = useMemo(
    () => ({
      initiative,
      initiativeId,
      initiativeTemplate,
      isPolish,
      canEditPriority,
      canEditOwner,
      canEditTargetDate,
      canEditCards,
      openSection,
      focusTopBarField,
      decisions,
      setDecisions,
      raidItems,
      setRaidItems,
      watchers,
      setWatchers,
      history,
      tasks,
      setTasks,
      comments,
      setComments,
      linkedItems,
      setLinkedItems,
      attachments,
      setAttachments,
      stakeholders,
      setStakeholders,
      dependencies,
      setDependencies,
      tags,
      setTags,
      users,
      pendingApprovals,
      gateRoles,
      setGateRoles,
      userGateRoles,
      statusHistory,
      gateReadiness,
      summary,
      setSummary,
      description,
      setDescription,
      targetDescriptionDraft,
      setTargetDescriptionDraft,
      successCriteriaItems,
      setSuccessCriteriaItems,
      deliverableItems,
      setDeliverableItems,
      priority,
      setPriority,
      ownerId,
      setOwnerId,
      sponsorId,
      setSponsorId,
      targetDate,
      setTargetDate,
      startDate,
      setStartDate,
      endDate,
      setEndDate,
      timelineMilestones,
      setTimelineMilestones,
      timelinePhases,
      setTimelinePhases,
      timelineLocked: ['SCHEDULED', 'EXECUTING', 'BLOCKED', 'DONE', 'TRACKING'].includes(status),
      baselineVersion: initiative?.baselineVersion ?? null,
      estimatedDurationMonths,
      setEstimatedDurationMonths,
      budgetDraft,
      setBudgetDraft,
      resourceTools,
      setResourceTools,
      resourceItems: apiResourceItems,
      setResourceItems: setApiResourceItems,
      budgetItems: apiBudgetItems,
      setBudgetItems: setApiBudgetItems,
      toolItems: apiToolItems,
      setToolItems: setApiToolItems,
      handleAddResource,
      handleUpdateResource,
      handleDeleteResource,
      handleAddBudgetItem,
      handleUpdateBudgetItem,
      handleDeleteBudgetItem,
      handleAddTool,
      handleUpdateTool,
      handleDeleteTool,
      intangibleAssets: apiIntangibleAssets,
      setIntangibleAssets: setApiIntangibleAssets,
      handleAddIntangibleAsset,
      handleUpdateIntangibleAsset,
      handleDeleteIntangibleAsset,
      reminders,
      setReminders,
      escalationRules,
      setEscalationRules,
      thresholds,
      setThresholds,
      expandedSections,
      toggleSection,
      isGeneratingAI,
      isMutating,
      currentUserId,
      status,
      ownerName,
      sponsorName,
      tasksDone,
      tasksInProgress,
      milestones,
      riskCount,
      issueCount,
      criticalRaids,
      isWatching,
      pendingGates,
      statusActions,
      primaryActions,
      handleSave,
      handleStatusAction,
      handleToggleWatch,
      handleGenerateAI,
      tasksAiRequest,
      requestTasksAi,
      clearTasksAiRequest,
      decisionsAiRequest,
      requestDecisionsAi,
      clearDecisionsAiRequest,
      raidAiRequest,
      requestRaidAi,
      clearRaidAiRequest,
      resourcesAiRequest,
      requestResourcesAi,
      clearResourcesAiRequest,
      timelineAiRequest,
      requestTimelineAi,
      clearTimelineAiRequest,
      dependenciesAiRequest,
      requestDependenciesAi,
      clearDependenciesAiRequest,
      teamAiRequest,
      requestTeamAi,
      clearTeamAiRequest,
      gatesAiRequest,
      requestGatesAi,
      clearGatesAiRequest,
      kpisAiRequest,
      requestKpisAi,
      clearKpisAiRequest,
      targetStateAiRequest,
      requestTargetStateAi,
      clearTargetStateAiRequest,
      handleCreateTask,
      handleCreateDecision,
      handleRemoveDecision,
      handleCreateRaid,
      handleUpdateRaid,
      handleDeleteRaid,
      handleAddComment,
      handleRequestApproval,
      handleOpenChat,
      handleArchive,
      handleDelete,
      handleCopyLink,
      handleExportPDF,
      fetchAll,
      newTaskTitle,
      setNewTaskTitle,
      newTaskIsMilestone,
      setNewTaskIsMilestone,
      newTaskMilestoneDate,
      setNewTaskMilestoneDate,
      showCreateTask,
      setShowCreateTask,
      newDecisionTitle,
      setNewDecisionTitle,
      newDecisionType,
      setNewDecisionType,
      showCreateDecision,
      setShowCreateDecision,
      newRaidTitle,
      setNewRaidTitle,
      newRaidType,
      setNewRaidType,
      newRaidSeverity,
      setNewRaidSeverity,
      newRaidDescription,
      setNewRaidDescription,
      showCreateRaid,
      setShowCreateRaid,
      showMoreMenu,
      setShowMoreMenu,
      showStatusDropdown,
      setShowStatusDropdown,
      showPriorityDropdown,
      setShowPriorityDropdown,
      showPhaseDropdown,
      setShowPhaseDropdown,
      showApprovalWorkflow,
      setShowApprovalWorkflow,
      newTag,
      setNewTag,
      onBack,
      onStatusChange,
      onOpenTask: handleOpenTaskArtifact,
      onOpenDecision: handleOpenDecisionArtifact,
    }),
    [
      initiative,
      initiativeId,
      initiativeTemplate,
      isPolish,
      decisions,
      raidItems,
      watchers,
      history,
      tasks,
      comments,
      linkedItems,
      attachments,
      stakeholders,
      dependencies,
      tags,
      users,
      pendingApprovals,
      gateRoles,
      userGateRoles,
      statusHistory,
      gateReadiness,
      canEditPriority,
      canEditOwner,
      canEditTargetDate,
      canEditCards,
      openSection,
      focusTopBarField,
      summary,
      description,
      targetDescriptionDraft,
      setTargetDescriptionDraft,
      successCriteriaItems,
      setSuccessCriteriaItems,
      deliverableItems,
      setDeliverableItems,
      priority,
      ownerId,
      sponsorId,
      targetDate,
      startDate,
      endDate,
      timelineMilestones,
      timelinePhases,
      estimatedDurationMonths,
      apiResourceItems,
      apiBudgetItems,
      apiToolItems,
      handleAddResource,
      handleUpdateResource,
      handleDeleteResource,
      handleAddBudgetItem,
      handleUpdateBudgetItem,
      handleDeleteBudgetItem,
      handleAddTool,
      handleUpdateTool,
      handleDeleteTool,
      apiIntangibleAssets,
      handleAddIntangibleAsset,
      handleUpdateIntangibleAsset,
      handleDeleteIntangibleAsset,
      reminders,
      escalationRules,
      thresholds,
      expandedSections,
      toggleSection,
      isGeneratingAI,
      isMutating,
      currentUserId,
      status,
      ownerName,
      sponsorName,
      tasksDone,
      tasksInProgress,
      milestones,
      riskCount,
      issueCount,
      criticalRaids,
      isWatching,
      pendingGates,
      statusActions,
      primaryActions,
      handleSave,
      handleStatusAction,
      handleToggleWatch,
      handleGenerateAI,
      tasksAiRequest,
      requestTasksAi,
      clearTasksAiRequest,
      decisionsAiRequest,
      requestDecisionsAi,
      clearDecisionsAiRequest,
      resourcesAiRequest,
      requestResourcesAi,
      clearResourcesAiRequest,
      timelineAiRequest,
      requestTimelineAi,
      clearTimelineAiRequest,
      dependenciesAiRequest,
      requestDependenciesAi,
      clearDependenciesAiRequest,
      teamAiRequest,
      requestTeamAi,
      clearTeamAiRequest,
      gatesAiRequest,
      requestGatesAi,
      clearGatesAiRequest,
      kpisAiRequest,
      requestKpisAi,
      clearKpisAiRequest,
      targetStateAiRequest,
      requestTargetStateAi,
      clearTargetStateAiRequest,
      handleCreateTask,
      handleCreateDecision,
      handleRemoveDecision,
      handleCreateRaid,
      handleUpdateRaid,
      handleDeleteRaid,
      handleAddComment,
      handleRequestApproval,
      handleOpenChat,
      handleArchive,
      handleDelete,
      handleCopyLink,
      handleExportPDF,
      fetchAll,
      newTaskTitle,
      newTaskIsMilestone,
      newTaskMilestoneDate,
      showCreateTask,
      newDecisionTitle,
      newDecisionType,
      showCreateDecision,
      newRaidTitle,
      newRaidType,
      newRaidSeverity,
      newRaidDescription,
      showCreateRaid,
      showMoreMenu,
      showStatusDropdown,
      showPriorityDropdown,
      showPhaseDropdown,
      showApprovalWorkflow,
      newTag,
      onBack,
      onStatusChange,
      handleOpenTaskArtifact,
      handleOpenDecisionArtifact,
    ]
  );

  // ==========================================
  // N-MODE: SECTION DEFINITIONS (template-driven visibility)
  // ==========================================

  const templateToNModeSectionIds: Record<string, string[]> = useMemo(
    () => ({
      overview: ['initiative-definition'],
      problemDefinition: ['initiative-definition'],
      targetState: ['target-state-scope'],
      scope: ['target-state-scope'],
      tasks: ['tasks'],
      dependencies: ['dependencies'],
      team: ['team'],
      stakeholders: ['raci'],
      timeline: ['timeline'],
      resources: ['resources'],
      financialAnalysis: ['financial-analysis'],
      financialImpact: ['financial-impact'],
      raid: ['risk-raid'],
      decisions: ['decisions'],
      gates: ['gates', 'suggested-changes'],
      comments: ['comments'],
      history: ['activity-log'],
      // C7 — 'artifacts' rides with the attachments/linked-items canon keys so
      // template-restricted views still surface registry outputs.
      attachments: ['attachments-links', 'artifacts'],
      linkedItems: ['attachments-links', 'used-in', 'artifacts'],
      kpis: ['kpi'],
    }),
    []
  );

  const enabledNModeSectionIds = useMemo(() => {
    const templateVS =
      initiativeTemplate?.visibleSections || initiativeTemplate?.visible_sections || {};
    const hasExplicitTemplateVisibility =
      templateVS && typeof templateVS === 'object' && Object.keys(templateVS).length > 0;
    if (!hasExplicitTemplateVisibility) return null;

    const enabledIds = new Set<string>();
    for (const [key, isVisible] of Object.entries(templateVS)) {
      if (isVisible === false) continue;
      const mappedIds = templateToNModeSectionIds[key];
      if (!mappedIds) continue;
      for (const sectionId of mappedIds) enabledIds.add(sectionId);
    }
    return enabledIds;
  }, [initiativeTemplate, templateToNModeSectionIds]);

  const initiativeNSections: NModeSection[] = useMemo(() => {
    const allSections: NModeSection[] = [
      // --- Definition (always at top) ---
      {
        id: 'initiative-definition',
        icon: Search,
        label: { en: 'Initiative Scope', pl: 'Zakres inicjatywy' },
        component: null,
      },
      // --- Codzienne operacje ---
      {
        id: 'tasks',
        icon: ListChecks,
        label: { en: 'Tasks', pl: 'Zadania' },
        badge: tasks.length > 0 ? tasks.length : undefined,
        cSpan: 2,
        cHidden: tasks.length === 0,
        component: null,
      },
      {
        id: 'decisions',
        icon: Scale,
        label: { en: 'Decisions', pl: 'Decyzje' },
        badge: decisions.length > 0 ? decisions.length : undefined,
        cSpan: 2,
        cHidden: decisions.length === 0,
        component: null,
      },
      {
        id: 'team',
        icon: Users,
        label: { en: 'Team', pl: 'Zespół' },
        component: null,
      },
      {
        id: 'timeline',
        icon: Calendar,
        label: { en: 'Timeline', pl: 'Harmonogram' },
        cSpan: 3,
        component: null,
      },
      {
        id: 'risk-raid',
        icon: Scale,
        label: { en: 'Risk & RAID', pl: 'Ryzyko i RAID' },
        badge: raidItems.length > 0 ? raidItems.length : undefined,
        cSpan: 2,
        cHidden: raidItems.length === 0,
        component: null,
      },
      // --- Cele i mierniki ---
      {
        id: 'target-state-scope',
        icon: Target,
        label: { en: 'Success Criteria', pl: 'Kryteria sukcesu' },
        component: null,
      },
      {
        id: 'kpi',
        icon: TrendingUp,
        label: { en: 'KPIs & Benefits', pl: 'KPI i korzyści' },
        cSpan: 2,
        component: null,
      },
      {
        id: 'dependencies',
        icon: GitBranch,
        label: { en: 'Dependencies', pl: 'Zależności' },
        badge: dependencies.length > 0 ? dependencies.length : undefined,
        cSpan: 2,
        cHidden: dependencies.length === 0,
        component: null,
      },
      // --- Finanse ---
      {
        id: 'financial-analysis',
        icon: DollarSign,
        label: { en: 'Financial Analysis', pl: 'Analiza finansowa' },
        cSpan: 2,
        component: null,
      },
      {
        id: 'financial-impact',
        icon: DollarSign,
        label: { en: 'Financial Impact', pl: 'Wpływ finansowy' },
        cSpan: 2,
        component: null,
      },
      // --- Governance (rarely used) ---
      {
        id: 'raci',
        icon: ShieldCheck,
        label: { en: 'RACI', pl: 'RACI' },
        badge: stakeholders.length > 0 ? stakeholders.length : undefined,
        cSpan: 2,
        cHidden: stakeholders.length === 0,
        component: null,
      },
      {
        id: 'gates',
        icon: Shield,
        label: { en: 'Gates', pl: 'Bramy' },
        badge: pendingGates.length > 0 ? pendingGates.length : undefined,
        component: null,
      },
      {
        id: 'suggested-changes',
        icon: GitBranch,
        label: { en: 'Suggested changes', pl: 'Sugerowane zmiany' },
        badge: pendingSuggestedChangesCount > 0 ? pendingSuggestedChangesCount : undefined,
        cSpan: 2,
        component: null,
      },
      {
        id: 'resources',
        icon: FolderOpen,
        label: { en: 'Resources', pl: 'Zasoby' },
        component: null,
      },
      // --- Documentation and logs (bottom) ---
      {
        id: 'attachments-links',
        icon: FolderOpen,
        label: { en: 'Attachments & Links', pl: 'Załączniki i powiązania' },
        badge:
          attachments.length + linkedItems.length > 0
            ? attachments.length + linkedItems.length
            : undefined,
        cHidden: attachments.length + linkedItems.length === 0,
        component: null,
      },
      {
        id: 'used-in',
        icon: Link2,
        label: { en: 'Used in (backlinks)', pl: 'Użyte w (powiązania)' },
        component: null,
      },
      // C7 — Outputs-registry artifacts generated from this initiative
      {
        id: 'artifacts',
        icon: Package,
        label: { en: 'Artifacts', pl: 'Artefakty' },
        badge: relatedArtifacts.length > 0 ? relatedArtifacts.length : undefined,
        cHidden: relatedArtifacts.length === 0,
        component: null,
      },
      // SPEC-N §2.1 — ZAREZERWOWANE ID: `comments` · `history` · `activity-log`
      // NIE MOGĄ być sekcją lewej kolumny; należą wyłącznie do prawego panelu.
      // Były tu (R3, inwentarz A1) jako pełne sekcje canvas — zeszły do
      // ArtifactRightPanel (sekcje `comments` i `history`, patrz
      // initiativeRightPanelSections). Nie zniknęły użytkownikowi: panel jest
      // widoczny ZAWSZE, a sekcja canvas była widoczna tylko po wybraniu jej
      // w lewej nawigacji.
      // ── Canon sections added in Phase C (→ 21/21) ──────────────────────────
      {
        id: 'deliverables-milestones',
        icon: Package,
        label: { en: 'Deliverables & Milestones', pl: 'Produkty i kamienie milowe' },
        badge: deliverableItems.length > 0 ? deliverableItems.length : undefined,
        cSpan: 2,
        component: null,
      },
      {
        id: 'change-log',
        icon: FileText,
        label: { en: 'Change Log', pl: 'Dziennik zmian' },
        badge: changeLogItems.length > 0 ? changeLogItems.length : undefined,
        cSpan: 2,
        component: null,
      },
      {
        id: 'okr',
        icon: Target,
        label: { en: 'OKR', pl: 'OKR' },
        badge: okrItems.length > 0 ? okrItems.length : undefined,
        cSpan: 2,
        component: null,
      },
      {
        id: 'hypothesis',
        icon: Lightbulb,
        label: { en: 'Hypothesis', pl: 'Hipoteza' },
        component: null,
      },
      {
        id: 'workstream-owners',
        icon: Users,
        label: { en: 'Workstream Owners', pl: 'Właściciele strumieni' },
        component: null,
      },
      {
        id: 'lessons-learned',
        icon: GraduationCap,
        label: { en: 'Lessons Learned', pl: 'Wnioski i lekcje' },
        component: null,
      },
    ];

    // SPEC-N §2.2 — WARSTWA DOWODOWA jest sekcją PRAWEGO PANELU (między
    // Powiązaniami a Komentarzami), nie sekcją lewej kolumny. HP-17 wpiął ją
    // tutaj, bo panelu wtedy nie było; teraz jest — patrz
    // initiativeRightPanelSections, sekcja `evidence`.
    // Zmiana wobec HP-17: sekcja NIE jest już warunkowana flagą
    // `ff_evidencePanel`. Decyzja właściciela P2 (SPEC-N §7): dla Initiative
    // warstwa dowodowa jest OBOWIĄZKOWA — „inicjatywa bez odpowiedzi »z czego to
    // wynika« jest pomysłem, nie inicjatywą". Brak dowodów pokazujemy jako
    // uczciwy stan pusty, NIE jako ukrytą sekcję (§4A).

    // Group tabs (mirrors InsightViewer's bilingual groupLabels + groupIndexById).
    const groupLabels = isPolish
      ? ['Zakres i plan', 'Decyzje i ryzyko', 'Rezultaty', 'Ludzie', 'Zapisy']
      : ['Scope & Plan', 'Decisions & Risk', 'Outcomes', 'People', 'Records'];
    const groupIndexById: Record<string, number> = {
      // 0 — Zakres i plan / Scope & Plan
      'initiative-definition': 0,
      tasks: 0,
      timeline: 0,
      'deliverables-milestones': 0,
      dependencies: 0,
      // 1 — Decyzje i ryzyko / Decisions & Risk
      decisions: 1,
      'risk-raid': 1,
      'change-log': 1,
      gates: 1,
      'suggested-changes': 1,
      // 2 — Rezultaty / Outcomes
      'target-state-scope': 2,
      kpi: 2,
      okr: 2,
      hypothesis: 2,
      'financial-analysis': 2,
      'financial-impact': 2,
      // 3 — Ludzie / People
      team: 3,
      'workstream-owners': 3,
      raci: 3,
      // 4 — Zapisy / Records
      resources: 4,
      'attachments-links': 4,
      'used-in': 4,
      artifacts: 4,
      'lessons-learned': 4,
      comments: 4,
      'activity-log': 4,
      evidence: 4, // HP-17 — grupa „Zapisy"/Records
    };

    const withGroup = (sections: NModeSection[]): NModeSection[] =>
      sections.map((section) => ({
        ...section,
        group: groupLabels[groupIndexById[section.id] ?? 4],
      }));

    if (!enabledNModeSectionIds || enabledNModeSectionIds.size === 0) {
      return withGroup(allSections);
    }

    return withGroup(allSections.filter((section) => enabledNModeSectionIds.has(section.id)));
  }, [
    isPolish,
    tasks.length,
    milestones.length,
    dependencies.length,
    stakeholders.length,
    raidItems.length,
    decisions.length,
    pendingGates.length,
    comments.length,
    history.length,
    attachments.length,
    linkedItems.length,
    relatedArtifacts.length,
    enabledNModeSectionIds,
    pendingSuggestedChangesCount,
  ]);

  // ==========================================
  // N-MODE: PROPERTIES STRIP FIELDS
  // ==========================================

  const nModePropertyFields: NModePropertyField[] = useMemo(() => {
    const priorityOptions = [
      { value: 'critical', label: { en: 'Critical', pl: 'Krytyczny' } },
      { value: 'high', label: { en: 'High', pl: 'Wysoki' } },
      { value: 'medium', label: { en: 'Medium', pl: 'Średni' } },
      { value: 'low', label: { en: 'Low', pl: 'Niski' } },
    ];

    const nextGate = getNextGateForStatus(status);
    const gateConf = nextGate ? GATE_CONFIG[nextGate] : null;
    const fallbackNextAction =
      statusActions.find((a) => a.variant === 'primary') || statusActions[0];
    const gateLabel = gateConf
      ? { en: gateConf.name, pl: gateConf.namePl }
      : fallbackNextAction
        ? { en: fallbackNextAction.label, pl: fallbackNextAction.labelPl }
        : { en: 'Not defined', pl: 'Nie zdefiniowano' };
    // `gateValue`/`gateOptions`/`phaseOptions` USUNIĘTE (2026-07-23): karmiły
    // WYŁĄCZNIE atrapy `<select onChange={() => {}}>` w polach „Faza" i
    // „Następna brama". Oba pola są tylko-do-odczytu, więc kontrolki zniknęły,
    // a listy opcji nie mają już konsumenta.

    // Gate color — depends on whether there's a pending gate and what it targets
    const gateVisual = (() => {
      if (!gateConf)
        if (fallbackNextAction?.targetStatus) {
          const fallbackTargetModule = getModuleFromStatus(fallbackNextAction.targetStatus);
          const fallbackModConf = MODULE_CONFIG[fallbackTargetModule];
          return {
            dot: fallbackModConf.color,
            bg: fallbackModConf.bgLight,
            text: fallbackModConf.textColor,
          };
        }
      if (!gateConf)
        return {
          dot: 'bg-c-border-strong',
          bg: 'bg-c-surface-raised',
          text: 'text-c-text-secondary',
        };
      // Map target status to module color
      const targetModule = getModuleFromStatus(gateConf.toStatus);
      const targetModConf = MODULE_CONFIG[targetModule];
      return {
        dot: targetModConf.color,
        bg: targetModConf.bgLight,
        text: targetModConf.textColor,
      };
    })();

    // Status color mapping
    const statusAlertBorder = (() => {
      if (status === 'BLOCKED') return 'border-danger-400/60';
      if (status === 'EXECUTING') return 'border-emerald-400/60';
      if (status === 'DONE' || status === 'TRACKING') return 'border-blue-400/60';
      if (status === 'CANCELLED' || status === 'ARCHIVED') return 'border-c-border-strong';
      return undefined;
    })();

    // Priority color mapping
    const priorityAlertBorder = (() => {
      if (priority === 'critical') return 'border-danger-400/60';
      if (priority === 'high') return 'border-amber-400/60';
      return undefined;
    })();

    // Helper: get metadata for current status.
    // `bgColor`/`color` z metadanych NIE są już używane — wartości właściwości
    // stoją na neutralnej pigułce (kontrast AA), semantykę niesie kropka.
    const currentStatusMeta = INITIATIVE_STATUS_METADATA[status as InitiativeStatus];
    const currentStatusDot = currentStatusMeta?.dotColor || 'bg-c-border-strong';
    const currentStatusLabel = currentStatusMeta
      ? isPolish
        ? currentStatusMeta.labelPL
        : currentStatusMeta.label
      : status;

    // Helper: get metadata for current priority
    const priorityMeta: Record<
      string,
      { dot: string; bg: string; text: string; label: string; labelPl: string }
    > = {
      critical: {
        dot: 'bg-danger-500',
        bg: 'bg-danger-100 dark:bg-danger-500/20',
        text: 'text-danger-800 dark:text-danger-400',
        label: 'Critical',
        labelPl: 'Krytyczny',
      },
      high: {
        dot: 'bg-amber-500',
        bg: 'bg-amber-500/10',
        text: 'text-amber-600',
        label: 'High',
        labelPl: 'Wysoki',
      },
      medium: {
        dot: 'bg-amber-400',
        bg: 'bg-amber-400/10',
        text: 'text-amber-600',
        label: 'Medium',
        labelPl: 'Średni',
      },
      low: {
        dot: 'bg-emerald-500',
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-600',
        label: 'Low',
        labelPl: 'Niski',
      },
    };
    const currentPriorityMeta = priorityMeta[priority] || priorityMeta.medium;

    // ── Prezentacja wartości we „Właściwościach" (audyt grafiki 2026-07-23) ──
    // BYŁO: każde pole renderowało pełnowymiarowy chip `h-8` z KOLOROWYM tłem
    // i kolorowym tekstem (danger/amber/emerald). W wąskiej komórce panelu dawało
    // to 4 chipy w 3 barwach — podczas gdy Decyzja/Zadanie mają czysty tekst
    // wyrównany do prawej — a kontrast tekstu spadał poniżej AA (zmierzone
    // @12px: „W realizacji" 3,81:1, „Wysoki" 3,47:1, „Realizacja" 3,94:1).
    // JEST: neutralna pigułka `bg-c-surface-raised text-c-text` (dokładnie
    // `rpPill` z DecisionDetailView) + kolorowa KROPKA jako nośnik semantyki.
    // Kropka to element nietekstowy, więc próg 4,5:1 jej nie dotyczy, a tekst
    // na `c-text` przechodzi AA w light i dark.
    const dashProp = '—';
    const propPill =
      'inline-flex max-w-full items-center gap-1.5 h-5 px-2 rounded-md text-xs bg-c-surface-raised text-c-text';
    const propDot = (cls: string) => (
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cls}`} aria-hidden="true" />
    );
    // Kontrolka edycji = przezroczysta nakładka NA pigułce (ten sam wzorzec dla
    // select-a i dla daty), dzięki czemu w Edycji wartość czyta się identycznie
    // jak w Podglądzie, a natywny chrome (strzałka select-a, ikona kalendarza,
    // placeholder „dd/mm/yyyy") nigdy nie trafia na ekran.
    const overlayCtl = 'absolute inset-0 h-full w-full cursor-pointer opacity-0';
    const fmtPropDate = (value?: string | null) => {
      if (!value) return dashProp;
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return dashProp;
      return d.toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    };

    return [
      {
        id: 'status',
        label: { en: 'Status', pl: 'Status' },
        type: 'custom' as const,
        value: status,
        // Canon: status changes IN the strip. Selecting a valid next-state runs
        // the SAME transition handler the old toolbar buttons called (with all its
        // gate/preflight guards). Destructive transitions are excluded (kebab only).
        onChange: (next: string) => {
          if (!next || next === status) return;
          const action = stripStatusActions.find((a) => a.targetStatus === next);
          if (action) void handleStatusAction(action);
        },
        readOnly: stripStatusActions.length === 0,
        alertBorderClass: statusAlertBorder,
        render: () => {
          // `readMode` wchodzi tu jako pełnoprawny warunek — w Podglądzie select
          // NIE JEST renderowany (nie „disabled", tylko go nie ma).
          const canChangeStatus = stripStatusActions.length > 0 && !isMutating && !readMode;
          const pill = (
            <span className={propPill}>
              {propDot(currentStatusDot)}
              <span className="truncate">{currentStatusLabel}</span>
              {canChangeStatus && <ChevronDown size={11} className="shrink-0 opacity-60" />}
            </span>
          );
          if (!canChangeStatus) return pill;
          return (
            <span className="relative inline-flex max-w-full">
              {pill}
              <select
                value={status}
                onChange={(e) => {
                  const next = e.target.value;
                  if (!next || next === status) return;
                  const action = stripStatusActions.find((a) => a.targetStatus === next);
                  if (action) void handleStatusAction(action);
                }}
                className={overlayCtl}
                aria-label={t('initiatives.changeStatus2')}
                title={t('initiatives.changeStatus2')}
              >
                {/* Current status — always present so the select reflects state */}
                <option value={status}>{currentStatusLabel}</option>
                {/* Valid non-destructive next-states (reuse transition definitions) */}
                {stripStatusActions.map((action) => (
                  <option key={action.targetStatus} value={action.targetStatus}>
                    {isPolish ? action.labelPl : action.label}
                  </option>
                ))}
              </select>
            </span>
          );
        },
      },
      {
        id: 'phase',
        label: { en: 'Phase', pl: 'Faza' },
        type: 'custom' as const,
        value: isPolish ? moduleConfig.labelPl : moduleConfig.label,
        onChange: () => {},
        readOnly: true,
        // `phaseOptions` zostaje policzone wyżej wyłącznie jako źródło etykiet;
        // POLE JEST TYLKO-DO-ODCZYTU, więc select zniknął. Był to select
        // z `onChange: () => {}` — pusta atrapa, którą audyt liczył jako
        // edytowalną kontrolkę zarówno w Edycji, jak i w Podglądzie.
        render: () => (
          <span className={propPill}>
            {propDot(moduleConfig.color)}
            <span className="truncate">{isPolish ? moduleConfig.labelPl : moduleConfig.label}</span>
          </span>
        ),
      },
      {
        id: 'gate',
        label: { en: 'Next Gate', pl: 'Następna brama' },
        type: 'custom' as const,
        value: isPolish ? gateLabel.pl : gateLabel.en,
        onChange: () => {},
        readOnly: true,
        // Jak wyżej (faza): select był atrapą (`onChange: () => {}`) — pole jest
        // tylko-do-odczytu, więc renderuje się jako tekst.
        render: () => (
          <span className={propPill}>
            {propDot(gateVisual.dot)}
            <span className="truncate">{isPolish ? gateLabel.pl : gateLabel.en}</span>
          </span>
        ),
      },
      {
        id: 'priority',
        label: { en: 'Priority', pl: 'Priorytet' },
        type: 'custom' as const,
        value: priority,
        onChange: canEditPriority ? setPriority : () => {},
        readOnly: !canEditPriority,
        alertBorderClass: priorityAlertBorder,
        render: () => {
          const pill = (
            <span className={propPill}>
              {propDot(currentPriorityMeta.dot)}
              <span className="truncate">
                {isPolish ? currentPriorityMeta.labelPl : currentPriorityMeta.label}
              </span>
              {canEditPriority && <ChevronDown size={11} className="shrink-0 opacity-60" />}
            </span>
          );
          // Podgląd (lub brak uprawnienia) → sam tekst, ZERO kontrolki w DOM.
          if (!canEditPriority) return pill;
          return (
            <span className="relative inline-flex max-w-full">
              {pill}
              <select
                id="initiative-topbar-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className={overlayCtl}
                aria-label={isPolish ? 'Priorytet' : 'Priority'}
              >
                {priorityOptions.map((opt) => {
                  const pm = priorityMeta[opt.value];
                  return (
                    <option key={opt.value} value={opt.value}>
                      {isPolish ? pm?.labelPl || opt.label.pl : pm?.label || opt.label.en}
                    </option>
                  );
                })}
              </select>
            </span>
          );
        },
      },
      {
        id: 'owner',
        label: { en: 'Owner', pl: 'Właściciel' },
        type: 'custom' as const,
        value: ownerId,
        onChange: canEditOwner ? setOwnerId : () => {},
        readOnly: !canEditOwner,
        render: () => {
          const ownerUser = users.find((u) => u.id === ownerId);
          const ownerName = ownerUser
            ? `${ownerUser.firstName} ${ownerUser.lastName}`.trim()
            : dashProp;
          const pill = (
            <span className={propPill}>
              <span className="truncate">{ownerName}</span>
              {canEditOwner && <ChevronDown size={11} className="shrink-0 opacity-60" />}
            </span>
          );
          // Podgląd → nazwisko jako TEKST; wcześniej zawsze renderował się
          // `<select disabled>`, czyli ramka kontrolki w czystym widoku.
          if (!canEditOwner) return pill;
          return (
            <span className="relative inline-flex max-w-full">
              {pill}
              <select
                id="initiative-topbar-owner"
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                className={overlayCtl}
                aria-label={isPolish ? 'Właściciel' : 'Owner'}
              >
                <option value="">{t('initiatives.select2')}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName}
                  </option>
                ))}
              </select>
            </span>
          );
        },
      },
      {
        id: 'targetDate',
        label: { en: 'Target', pl: 'Termin' },
        type: 'custom' as const,
        value: targetDate,
        onChange: canEditTargetDate ? setTargetDate : () => {},
        readOnly: !canEditTargetDate,
        // Natywny `input[type=date]` pokazywał w wierszu „Termin" placeholder
        // „dd/mm/yyyy" i systemową ikonę kalendarza — jedyny element ekranu
        // renderowany chromem przeglądarki, a nie systemem projektowym.
        // Podgląd: data sformatowana tekstem. Edycja: ta sama sformatowana data,
        // a input leży pod nią przezroczystą nakładką (natywny picker działa,
        // ale jego chrome nigdy nie jest widoczny).
        render: () => {
          const pill = (
            <span className={`${propPill} tabular-nums`}>
              <span className="truncate">{fmtPropDate(targetDate)}</span>
            </span>
          );
          if (!canEditTargetDate) return pill;
          return (
            <span className="relative inline-flex max-w-full">
              {pill}
              <input
                id="initiative-topbar-targetDate"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className={overlayCtl}
                aria-label={isPolish ? 'Termin' : 'Target date'}
              />
            </span>
          );
        },
      },
      ...(() => {
        const srcType = initiative?.source_type || initiative?.sourceType;
        const srcId = initiative?.source_id || initiative?.sourceId;
        if (!srcType || !srcId) return [];
        const normalizedSourceType = String(srcType).toLowerCase();
        if (
          ![
            'interview',
            'interview_insight',
            'insight',
            'conclusion',
            'conclusion_readout',
          ].includes(normalizedSourceType)
        ) {
          return [];
        }
        const sourceTitle = initiative?.source_title || initiative?.sourceTitle || srcId;
        const sourcePath =
          normalizedSourceType === 'interview' ||
          normalizedSourceType === 'interview_insight' ||
          normalizedSourceType === 'insight' ||
          normalizedSourceType === 'conclusion'
            ? getArtifactPath('insight', srcId)
            : normalizedSourceType === 'conclusion_readout'
              ? '/presentations?tab=documents'
              : getArtifactPath('insight', srcId);
        const sourceLabel =
          normalizedSourceType === 'interview' ||
          normalizedSourceType === 'interview_insight' ||
          normalizedSourceType === 'insight' ||
          normalizedSourceType === 'conclusion'
            ? t('initiatives.fromInsight2')
            : t('initiatives.fromReadout2');
        return [
          {
            id: 'sourceInsight',
            label: { en: 'Source', pl: 'Źródło' },
            type: 'custom' as const,
            value: srcId,
            onChange: () => {},
            readOnly: true,
            render: () => (
              <a
                href={sourcePath}
                title={t('initiatives.initiativeDocumentView.openSourceTitle', {
                  title: sourceTitle,
                })}
                className="flex h-8 items-center gap-2 w-full px-2.5 rounded-lg text-xs font-semibold bg-c-surface-raised border border-c-border-subtle text-c-info hover:bg-c-surface transition-colors truncate"
              >
                <Sparkles size={12} className="shrink-0" />
                <span className="truncate">
                  {sourceLabel}
                  {sourceTitle}
                </span>
                <ExternalLink size={10} className="shrink-0 ml-auto opacity-60" />
              </a>
            ),
          },
        ] as NModePropertyField[];
      })(),
    ];
  }, [
    initiative,
    status,
    priority,
    ownerId,
    sponsorId,
    startDate,
    targetDate,
    tasks.length,
    tasksDone,
    users,
    isPolish,
    moduleConfig,
    statusActions,
    stripStatusActions,
    isMutating,
    handleStatusAction,
    setPriority,
    setOwnerId,
    setSponsorId,
    setStartDate,
    setTargetDate,
    pendingGates.length,
    canEditPriority,
    canEditOwner,
    canEditTargetDate,
    /* readMode: status/priorytet/właściciel/termin renderują się INACZEJ
       w Podglądzie (tekst) niż w Edycji (tekst + nakładka kontrolki) —
       bez tej zależności memo zwracałoby wersję z poprzedniego trybu. */
    readMode,
    /* + t: tlumaczenia ladowane async — bez tego memo zwraca surowy klucz na stale (2026-07-21) */
    t,
  ]);

  // ==========================================
  // N-MODE: COMMENTS CANVAS ADAPTERS (identical to Task)
  // ==========================================

  const nModeComments: CommentItem[] = useMemo(
    () =>
      comments
        .filter((c) => {
          if (nCommentDateFilter === 'all') return true;
          const d = new Date(c.createdAt);
          const now = new Date();
          if (nCommentDateFilter === 'today') return d.toDateString() === now.toDateString();
          if (nCommentDateFilter === '7d') return now.getTime() - d.getTime() < 7 * 86400000;
          if (nCommentDateFilter === '30d') return now.getTime() - d.getTime() < 30 * 86400000;
          return true;
        })
        .sort((a, b) =>
          nCommentSortOrder === 'desc'
            ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )
        .map((c) => ({
          id: c.id,
          authorName: c.authorName,
          content: c.content,
          createdAt: c.createdAt,
          isAIGenerated: c.authorId === 'ai-assistant',
          priority: 'normal' as CommentPriority,
        })),
    [comments, nCommentDateFilter, nCommentSortOrder]
  );

  const getPriorityDotClass = (p: CommentPriority) =>
    p === 'high' ? 'bg-danger-500' : p === 'low' ? 'bg-c-border-strong' : 'bg-blue-500';
  const getCommentPriority = (_c: CommentItem): CommentPriority => 'normal';
  const getPriorityButtonClass = (p: CommentPriority, active: boolean) =>
    active
      ? p === 'high'
        ? 'border-danger-400/80 text-danger-300 bg-danger-500/20 shadow-[0_0_0_1px_rgba(239,68,68,0.3)]'
        : p === 'low'
          ? 'border-emerald-400/80 text-emerald-300 bg-emerald-500/20 shadow-[0_0_0_1px_rgba(16,185,129,0.3)]'
          : 'border-indigo-400/70 text-indigo-300 bg-indigo-500/15 shadow-[0_0_0_1px_rgba(129,140,248,0.2)]'
      : 'border-c-border-strong text-c-text-muted hover:border-c-border-strong hover:text-c-text-secondary';
  const getCommentPriorityLabel = (p: CommentPriority) =>
    p === 'high' ? 'High' : p === 'low' ? 'Low' : 'Normal';
  const getCommentPriorityHint = (p: CommentPriority) =>
    p === 'high'
      ? t('initiatives.requiresImmediateAttention2')
      : p === 'low'
        ? t('initiatives.informationalComment2')
        : t('initiatives.standardComment2');

  const handleNModeSubmitComment = () => {
    if (!nCommentDraft.trim()) return;
    handleAddComment(nCommentDraft);
    setNCommentDraft('');
  };

  const handleDeleteComment = (commentId: string) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    // Best-effort backend delete (comments are stored in initiative_comments)
    Api.delete(`/initiatives/${initiativeId}/comments/${commentId}`).catch(() => {});
  };

  // ==========================================
  // COMMENTS AI (Analyze with AI → proposal → apply)
  // ==========================================

  const closeCommentsAIModal = useCallback(() => {
    setShowCommentsAIModal(false);
    setCommentsAiProposal(null);
    setCommentsAiSelectedAddIdx({});
    setCommentsAiSelectedRemoveIds({});
  }, []);

  const buildCommentRemovalCandidates = useCallback(() => {
    const candidates: Array<{ commentId: string; excerpt: string; why: string }> = [];
    const seen = new Map<string, string>(); // norm -> firstId

    const normalize = (s: string) =>
      String(s || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[^\p{L}\p{N}\s]/gu, '')
        .trim();

    const junkPatterns: Array<{ re: RegExp; why: string }> = [
      {
        re: /\b(test-comment|test comment|demo|dummy)\b/i,
        why: 'Test/demo placeholder — not a real delivery comment.',
      },
      {
        re: /^\s*test[-_\s]*comment\b/i,
        why: 'Test placeholder — not a real delivery comment.',
      },
      {
        re: /\b(wip|tmp|temp)\b/i,
        why: 'Temporary/WIP placeholder — low signal.',
      },
    ];

    const tooShort = (s: string) => String(s || '').trim().length < 10;
    const looksLikeGarbage = (s: string) =>
      /^\?+$/.test(s.trim()) || /^[\d\W_]+$/.test(s.trim()) || /^(comment|new comment)$/i.test(s);

    for (const c of comments) {
      const id = String((c as any)?.id || '');
      const content = String((c as any)?.content || '').trim();
      if (!id) continue;

      if (!content) {
        candidates.push({ commentId: id, excerpt: '(empty)', why: 'Empty comment — invalid.' });
        continue;
      }

      if (looksLikeGarbage(content) || tooShort(content)) {
        candidates.push({
          commentId: id,
          excerpt: content.slice(0, 140),
          why: 'Low-signal comment.',
        });
      }

      for (const p of junkPatterns) {
        if (p.re.test(content)) {
          candidates.push({ commentId: id, excerpt: content.slice(0, 140), why: p.why });
          break;
        }
      }

      const norm = normalize(content);
      if (norm) {
        const first = seen.get(norm);
        if (!first) {
          seen.set(norm, id);
        } else if (first !== id) {
          candidates.push({
            commentId: id,
            excerpt: content.slice(0, 140),
            why: 'Duplicate comment (same content/intent).',
          });
        }
      }
    }

    // De-dupe by commentId, keep first reason.
    const byId = new Map<string, (typeof candidates)[number]>();
    for (const c of candidates) {
      if (!byId.has(c.commentId)) byId.set(c.commentId, c);
    }
    return Array.from(byId.values()).slice(0, 20);
  }, [comments]);

  const proposeCommentsWithAI = useCallback(async () => {
    setIsCommentsAIProposing(true);
    try {
      const aiLanguage = isPolish ? 'pl' : 'en';
      const targetLanguageName = t('initiatives.english2');
      const existingIds = new Set(comments.map((c) => String((c as any)?.id || '')));
      const removalCandidates = buildCommentRemovalCandidates();

      const compactComments = [...comments]
        .slice()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 30)
        .map((c) => ({
          id: String((c as any)?.id || ''),
          author: String((c as any)?.authorName || ''),
          createdAt: String((c as any)?.createdAt || ''),
          content: String((c as any)?.content || '').slice(0, 500),
        }));

      const systemInstruction = [
        `You are a senior PMO advisor reviewing an initiative discussion thread.`,
        `Your goal is to propose HIGH-SIGNAL improvements to the Comments module (not a summary).`,
        `Rules:`,
        `- Add suggestions should be actionable, specific, and tied to delivery risk reduction.`,
        `- Prefer FEWER, better comments. 0-3 adds is fine.`,
        `- Remove suggestions should focus ONLY on placeholders/tests/duplicates/low-signal noise.`,
        `- If REMOVAL CANDIDATES are provided, you MAY remove from them, but never fabricate ids.`,
        `- Do NOT invent facts, dates, numbers, vendors, systems, or commitments not in context.`,
        `- Output language MUST be ${targetLanguageName}. Translate if needed.`,
        ``,
        `Return ONLY valid JSON (no markdown, no code fences, no commentary).`,
        `IMPORTANT: For "remove", you MUST use existing commentId values only (prefer from REMOVAL CANDIDATES). Never fabricate ids.`,
        `Schema:`,
        `{`,
        `  "add": [ { "content": string, "rationale"?: string } ],`,
        `  "remove": [ { "commentId": string, "reason": string } ],`,
        `  "note"?: string`,
        `}`,
      ].join('\n');

      const contextText = [
        `[INITIATIVE CONTEXT]`,
        `Initiative name: ${initiative?.name || ''}`,
        `Status: ${status || ''}`,
        `Priority: ${priority || ''}`,
        `Summary: ${(summary || initiative?.description || '').toString()}`,
        `Problem statement: ${(initiative?.problem_statement || '').toString()}`,
        ``,
        `[EXISTING COMMENTS]`,
        JSON.stringify(compactComments, null, 2),
        ``,
        `[REMOVAL CANDIDATES]`,
        `These are flagged by deterministic quality rules. Remove ONLY if truly low-signal:`,
        JSON.stringify(removalCandidates, null, 2),
      ].join('\n');

      const aiRes = await Api.post('/ai/refine-text?timeoutMs=20000', {
        text: contextText,
        mode: 'generate',
        systemInstruction,
        fieldLabel: 'Initiative comments review',
        artifactContext: {
          title: initiative?.name || '',
          status,
          priority,
          type: 'initiative',
        },
        language: aiLanguage,
      });

      const parsed = parseAIJson(String(aiRes?.text || '')) as any;
      const proposal = {
        add: Array.isArray(parsed?.add) ? parsed.add : [],
        remove: Array.isArray(parsed?.remove) ? parsed.remove : [],
        note: parsed?.note ? String(parsed.note).trim() : '',
      };

      const seenAdds = new Set<string>();
      const normalizeAdd = (s: string) =>
        String(s || '')
          .trim()
          .toLowerCase()
          .replace(/\s+/g, ' ')
          .slice(0, 240);

      proposal.add = proposal.add
        .map((a: any) => ({
          content: String(a?.content || a?.text || a?.comment || '').trim(),
          rationale: a?.rationale ? String(a.rationale).trim() : '',
        }))
        .filter((a: any) => a.content.length > 0)
        .filter((a: any) => {
          const key = normalizeAdd(a.content);
          if (!key) return true;
          if (seenAdds.has(key)) return false;
          seenAdds.add(key);
          return true;
        })
        .slice(0, 5);

      proposal.remove = proposal.remove
        .map((r: any) => ({
          commentId: String(r?.commentId || r?.id || '').trim(),
          reason: String(r?.reason || '').trim(),
        }))
        .filter((r: any) => r.commentId && r.reason && existingIds.has(r.commentId))
        .slice(0, 10);

      const hasAny = proposal.add.length > 0 || proposal.remove.length > 0;
      if (!hasAny && !proposal.note) {
        proposal.note = t('initiatives.aiFoundNoChangeSuggestionsThe4');
      }

      setCommentsAiProposal(proposal);
      setCommentsAiSelectedAddIdx(
        Object.fromEntries(proposal.add.map((_a: any, idx: number) => [idx, true])) as Record<
          number,
          boolean
        >
      );
      setCommentsAiSelectedRemoveIds(
        Object.fromEntries(proposal.remove.map((r: any) => [r.commentId, false])) as Record<
          string,
          boolean
        >
      );
      setShowCommentsAIModal(true);
    } catch (e: any) {
      toast.error(e?.message || t('initiatives.failedToAnalyzeComments2'));
    } finally {
      setIsCommentsAIProposing(false);
    }
  }, [
    buildCommentRemovalCandidates,
    comments,
    initiative,
    isPolish,
    parseAIJson,
    priority,
    status,
    summary,
  ]);

  const applyCommentsAIProposal = useCallback(async () => {
    if (!commentsAiProposal) return;
    const toAdd = commentsAiProposal.add.filter((_a, idx) => !!commentsAiSelectedAddIdx[idx]);
    const toRemove = commentsAiProposal.remove.filter(
      (r) => !!commentsAiSelectedRemoveIds[r.commentId]
    );

    if (toAdd.length === 0 && toRemove.length === 0) {
      toast(t('initiatives.noSelectedChanges2'));
      return;
    }

    if (toRemove.length > 0) {
      const ok = window.confirm(
        isPolish
          ? `Usunąć ${toRemove.length} komentarz(e)? To działanie jest nieodwracalne.`
          : `Delete ${toRemove.length} comment(s)? This action cannot be undone.`
      );
      if (!ok) return;
    }

    setIsCommentsAIProposing(true);
    try {
      for (const r of toRemove) {
        handleDeleteComment(r.commentId);
      }
      for (const a of toAdd) {
        await handleAddComment(String((a as any)?.content || '').trim());
      }

      toast.success(
        isPolish
          ? `Zastosowano sugestie AI (${toAdd.length} dodano${toRemove.length ? `, ${toRemove.length} usunięto` : ''})`
          : `Applied AI suggestions (${toAdd.length} added${toRemove.length ? `, ${toRemove.length} removed` : ''})`
      );
      closeCommentsAIModal();
    } catch {
      toast.error(t('initiatives.failedToApplySuggestions2'));
    } finally {
      setIsCommentsAIProposing(false);
    }
  }, [
    closeCommentsAIModal,
    commentsAiProposal,
    commentsAiSelectedAddIdx,
    commentsAiSelectedRemoveIds,
    handleAddComment,
    handleDeleteComment,
    isPolish,
  ]);

  useEffect(() => {
    if (!commentsAiRequest) return;
    const run = async () => {
      try {
        await proposeCommentsWithAI();
      } finally {
        // Keep CTA-bar spinner visible until AI finishes.
        clearCommentsAiRequest();
      }
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commentsAiRequest?.nonce]);

  // ==========================================
  // N-MODE: ACTIVITY LOG ADAPTERS (shared ActivityLogCanvas)
  // ==========================================

  const nModeActivityEntries: NModeActivityLogEntry[] = useMemo(
    () =>
      [...history]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .map((e) => {
          // API returns: eventType, actorId, createdAt, oldValue, newValue, notes
          const raw = e as any;
          const notes = raw.notes as string | undefined;
          const eventType =
            typeof (raw.eventType ?? (e as any).eventType) === 'string' &&
            String(raw.eventType ?? (e as any).eventType).trim().length > 0
              ? String(raw.eventType ?? (e as any).eventType)
              : 'unknown_event';
          const eventTypeLabel =
            eventType === 'unknown_event'
              ? t('initiatives.unknownEvent2')
              : eventType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
          const description = notes || eventTypeLabel;
          return {
            id: e.id,
            type: eventType,
            description,
            timestamp: e.createdAt,
            userName: e.actorName || raw.actorId || undefined,
            oldValue: raw.oldValue || e.payload?.oldValue,
            newValue: raw.newValue || e.payload?.newValue,
          };
        }),
    [history]
  );

  const nModeActivityTypeMeta = useCallback(
    (type: string): ActivityTypeMeta => {
      const MAP: Record<string, ActivityTypeMeta> = {
        created: {
          icon: <Plus size={12} />,
          label: t('initiatives.created2'),
          style: 'text-emerald-500 bg-emerald-500/10 border-emerald-400/30',
        },
        status_change: {
          icon: <CheckCircle size={12} />,
          label: t('initiatives.statusChange2'),
          style: 'text-blue-500 bg-blue-500/10 border-blue-400/30',
        },
        update: {
          icon: <Edit3 size={12} />,
          label: t('initiatives.update2'),
          style: 'text-blue-500 bg-blue-500/10 border-blue-400/30',
        },
        field_change: {
          icon: <Edit3 size={12} />,
          label: t('initiatives.edit3'),
          style: 'text-c-text-muted bg-c-surface-raised border-c-border-strong',
        },
        edit: {
          icon: <Edit3 size={12} />,
          label: t('initiatives.edit3'),
          style: 'text-c-text-muted bg-c-surface-raised border-c-border-strong',
        },
        comment: {
          icon: <MessageSquare size={12} />,
          label: t('initiatives.comment2'),
          style: 'text-indigo-500 bg-indigo-500/10 border-indigo-400/30',
        },
        assignment: {
          icon: <User size={12} />,
          label: t('initiatives.assignment2'),
          style: 'text-c-info bg-c-surface-raised border-c-border-subtle',
        },
        task_added: {
          icon: <CheckSquare size={12} />,
          label: t('initiatives.taskAdded2'),
          style: 'text-sky-500 bg-sky-500/10 border-sky-400/30',
        },
        decision_added: {
          icon: <Scale size={12} />,
          label: t('initiatives.decisionAdded2'),
          style: 'text-c-info bg-c-surface-raised border-c-border-subtle',
        },
        risk_added: {
          icon: <AlertTriangle size={12} />,
          label: t('initiatives.riskAdded2'),
          style: 'text-amber-500 bg-amber-500/10 border-amber-400/30',
        },
        stakeholder_added: {
          icon: <Users size={12} />,
          label: t('initiatives.stakeholder2'),
          style: 'text-sky-500 bg-sky-500/10 border-sky-400/30',
        },
        gate_review: {
          icon: <ShieldCheck size={12} />,
          label: t('initiatives.gateReview2'),
          style: 'text-emerald-500 bg-emerald-500/10 border-emerald-400/30',
        },
        deadline: {
          icon: <Calendar size={12} />,
          label: t('initiatives.deadline2'),
          style: 'text-danger-500 bg-danger-500/10 border-danger-400/30',
        },
        priority: {
          icon: <Flag size={12} />,
          label: t('initiatives.priority3'),
          style: 'text-amber-500 bg-amber-500/10 border-amber-400/30',
        },
        escalated: {
          icon: <AlertTriangle size={12} />,
          label: t('initiatives.escalation2'),
          style: 'text-amber-500 bg-amber-500/10 border-amber-400/30',
        },
      };
      return (
        MAP[type] || {
          icon: <Clock size={12} />,
          label: type.replace(/_/g, ' '),
          style: 'text-c-text-secondary bg-c-surface-raised border-c-border-subtle',
        }
      );
    },
    [isPolish]
  );

  // ==========================================
  // N-MODE: SECTION CONTENT BUILDER
  // ==========================================

  // SPEC-N §2.5 — bramka deweloperska: kontrakt AI musi być zadeklarowany dla
  // KAŻDEJ sekcji. Milczenie (stan sprzed tej migracji: 13 z 26 sekcji nic nie
  // deklarowało) przestaje być możliwe do przeoczenia — nowa sekcja bez wpisu
  // w SECTION_AI_CONTRACT krzyczy w konsoli przy pierwszym renderze, a nie na
  // odbiorze zrzutu. Ostrzeżenie, nie wyjątek: brak deklaracji jest defektem
  // procesu, nie powodem do wywalenia karty użytkownikowi.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const bez = initiativeNSections
      .map((sec) => sec.id)
      .filter((id) => !(id in SECTION_AI_CONTRACT));
    if (bez.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        `[InitiativeDocumentView] SPEC-N §2.5 — sekcje bez deklaracji kontraktu AI: ${bez.join(', ')}. ` +
          'Dopisz je do SECTION_AI_CONTRACT ({ ai: true } albo { none: true, reason }).'
      );
    }
  }, [initiativeNSections]);

  const nModeSectionsWithContent: NModeSection[] = useMemo(() => {
    return initiativeNSections.map((section) => {
      let component: React.ReactNode = null;

      switch (section.id) {
        case 'initiative-definition': {
          component = (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                {/* Tytuł centrum = ETYKIETA TEJ SAMEJ SEKCJI co w nawigacji.
                    BYŁO: literał `initiatives.descriptionContext2` („Opis
                    i kontekst") przy zaznaczonej w nawigacji pozycji „Zakres
                    inicjatywy" — dwa różne imiona jednego ekranu, więc nie dało
                    się powiedzieć, gdzie się jest. JEST: czytamy `section.label`,
                    czyli dokładnie to, co rysuje `NModeLeftNav` — rozjazd nie
                    może już wrócić przy zmianie jednej z dwóch stron. */}
                <h2 className="text-lg font-semibold text-c-text">
                  {isPolish ? section.label.pl : section.label.en}
                </h2>
              </div>

              {/* 1) Problem */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-c-text-secondary">
                      {t('initiatives.problem2')}
                    </label>
                    <p className="text-[10px] text-c-text-secondary mt-0.5">
                      {t('initiatives.whatProblemDoesThisInitiativeSolve2')}
                    </p>
                  </div>
                  <FieldAiEnhancer
                    hidden={readMode}
                    fieldKey="initiative-problem"
                    sectionLabel={t('initiatives.problem2')}
                    currentValue={symptomDraft}
                    onApply={setSymptomDraft}
                    artifactContext={{
                      title: initiative?.name || '',
                      status,
                      priority,
                      type: 'initiative',
                    }}
                  />
                </div>
                <ExpandableNarrativeField
                  value={symptomDraft}
                  onChange={setSymptomDraft}
                  previewMode={readMode}
                  readOnly={!canEditCards}
                  isPolish={isPolish}
                  placeholder={t('initiatives.whatProblemAreWeSolvingWhat2')}
                />
              </div>

              {/* 2) Proposed Solution */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-c-text-secondary">
                      {t('initiatives.proposedSolution2')}
                    </label>
                    <p className="text-[10px] text-c-text-secondary mt-0.5">
                      {t('initiatives.proposedApproachAndImplementationMethod2')}
                    </p>
                  </div>
                  <FieldAiEnhancer
                    hidden={readMode}
                    fieldKey="initiative-proposed-solution"
                    sectionLabel={t('initiatives.proposedSolution2')}
                    currentValue={rootCauseDraft}
                    onApply={setRootCauseDraft}
                    artifactContext={{
                      title: initiative?.name || '',
                      status,
                      priority,
                      type: 'initiative',
                    }}
                  />
                </div>
                <ExpandableNarrativeField
                  value={rootCauseDraft}
                  onChange={setRootCauseDraft}
                  previewMode={readMode}
                  readOnly={!canEditCards}
                  isPolish={isPolish}
                  placeholder={t('initiatives.whatSolutionDoWeProposeWhat2')}
                />
              </div>

              {/* 3) Cost of Inaction */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-c-text-secondary">
                      {t('initiatives.costOfInaction2')}
                    </label>
                    <p className="text-[10px] text-c-text-secondary mt-0.5">
                      {t('initiatives.consequencesOfNotTakingAction2')}
                    </p>
                  </div>
                  <FieldAiEnhancer
                    hidden={readMode}
                    fieldKey="initiative-cost-of-inaction"
                    sectionLabel={t('initiatives.costOfInaction2')}
                    currentValue={costOfInactionDraft}
                    onApply={setCostOfInactionDraft}
                    artifactContext={{
                      title: initiative?.name || '',
                      status,
                      priority,
                      type: 'initiative',
                    }}
                  />
                </div>
                <ExpandableNarrativeField
                  value={costOfInactionDraft}
                  onChange={setCostOfInactionDraft}
                  previewMode={readMode}
                  readOnly={!canEditCards}
                  isPolish={isPolish}
                  placeholder={t('initiatives.whatHappensIfWeDoNothing2')}
                />
              </div>

              {/* 4) Market Context */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-c-text-secondary">
                      {t('initiatives.marketContext2')}
                    </label>
                    <p className="text-[10px] text-c-text-secondary mt-0.5">
                      {t('initiatives.marketEnvironmentCompetitionAndTrends2')}
                    </p>
                  </div>
                  <FieldAiEnhancer
                    hidden={readMode}
                    fieldKey="initiative-market-context"
                    sectionLabel={t('initiatives.marketContext2')}
                    currentValue={marketContextDraft}
                    onApply={setMarketContextDraft}
                    artifactContext={{
                      title: initiative?.name || '',
                      status,
                      priority,
                      type: 'initiative',
                    }}
                  />
                </div>
                <ExpandableNarrativeField
                  value={marketContextDraft}
                  onChange={setMarketContextDraft}
                  previewMode={readMode}
                  readOnly={!canEditCards}
                  isPolish={isPolish}
                  placeholder={t('initiatives.marketContextCompetitionTrends2')}
                />
              </div>
            </div>
          );
          break;
        }

        case 'target-state-scope': {
          const mkId = () => Math.random().toString(36).slice(2, 10);
          const addTarget = () =>
            setTargetStateItems((prev) => [...prev, { id: mkId(), text: '', done: false }]);
          const addCriteria = () =>
            setSuccessCriteriaItems((prev) => [...prev, { id: mkId(), text: '', done: false }]);
          const addDeliverable = () =>
            setDeliverableItems((prev) => [...prev, { id: mkId(), text: '', done: false }]);

          const updateTarget = (id: string, patch: Partial<{ text: string; done: boolean }>) =>
            setTargetStateItems((prev) =>
              prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
            );
          const updateCriteria = (id: string, patch: Partial<{ text: string; done: boolean }>) =>
            setSuccessCriteriaItems((prev) =>
              prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
            );
          const updateDeliverable = (id: string, patch: Partial<{ text: string; done: boolean }>) =>
            setDeliverableItems((prev) =>
              prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
            );

          const removeTarget = (id: string) =>
            setTargetStateItems((prev) => prev.filter((item) => item.id !== id));
          const removeCriteria = (id: string) =>
            setSuccessCriteriaItems((prev) => prev.filter((item) => item.id !== id));
          const removeDeliverable = (id: string) =>
            setDeliverableItems((prev) => prev.filter((item) => item.id !== id));

          const renderChecklistRow = (
            item: { id: string; text: string; done: boolean },
            onUpdate: (id: string, patch: Partial<{ text: string; done: boolean }>) => void,
            onRemove: (id: string) => void,
            placeholder: string,
            aiLabel: string,
            aiFieldKey: string
          ) => (
            <div key={item.id} className="group flex items-center gap-2 py-1.5">
              <button
                onClick={() => onUpdate(item.id, { done: !item.done })}
                className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                  item.done
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-c-border-strong'
                }`}
              >
                {item.done ? (
                  <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M2.5 6L5 8.5L9.5 3.5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : null}
              </button>
              <input
                value={item.text}
                onChange={(e) => onUpdate(item.id, { text: e.target.value })}
                placeholder={placeholder}
                className={`flex-1 bg-transparent text-sm leading-snug focus:outline-none placeholder:text-c-text-muted ${
                  item.done ? 'line-through text-c-text-secondary' : 'text-c-text-secondary'
                }`}
              />
              <FieldAiEnhancer
                hidden={readMode}
                fieldKey={`${aiFieldKey}.${item.id}`}
                sectionLabel={aiLabel}
                currentValue={item.text}
                onApply={(v) => onUpdate(item.id, { text: v })}
                artifactContext={{
                  title: initiative?.name || '',
                  status,
                  priority,
                  type: 'initiative',
                }}
                iconOnly
                outputFormat="short"
              />
              <button
                onClick={() => onRemove(item.id)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-danger-50 dark:hover:bg-danger-500/20 text-c-text-secondary hover:text-danger-500 transition-all"
              >
                <Trash2 size={12} />
              </button>
            </div>
          );

          const renderChecklistCard = (
            titleKey: string,
            helperKey: string,
            items: Array<{ id: string; text: string; done: boolean }>,
            onAdd: () => void,
            onUpdate: (id: string, patch: Partial<{ text: string; done: boolean }>) => void,
            onRemove: (id: string) => void,
            aiFieldKey: string,
            setItems: (items: Array<{ id: string; text: string; done: boolean }>) => void,
            placeholderKey: string
          ) => (
            <div className="rounded-2xl border border-c-border-subtle bg-c-surface/70 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-c-text-secondary">{t(titleKey)}</h3>
                  <p className="text-[10px] text-c-text-muted mt-0.5">{t(helperKey)}</p>
                </div>
                <div className="inline-flex items-center gap-2">
                  <button
                    onClick={onAdd}
                    className="inline-flex items-center gap-1 text-xs font-medium text-c-text-muted hover:text-c-info transition-colors"
                  >
                    <Plus size={12} />
                    {t('initiatives.addItem2')}
                  </button>
                  <FieldAiEnhancer
                    hidden={readMode}
                    fieldKey={aiFieldKey}
                    sectionLabel={t(titleKey)}
                    currentValue={items
                      .map((item) => item.text)
                      .filter(Boolean)
                      .join('\n')}
                    onApply={(value) => {
                      const rows = value
                        .split('\n')
                        .map((line: string) => line.replace(/^[-•*]\s*/, '').trim())
                        .filter(Boolean);
                      setItems(rows.map((row: string) => ({ id: mkId(), text: row, done: false })));
                    }}
                    artifactContext={{
                      title: initiative?.name || '',
                      status,
                      priority,
                      type: 'initiative',
                    }}
                    outputFormat="list"
                  />
                </div>
              </div>
              <div className="min-h-[56px] border-b border-c-border-subtle pb-2">
                {items.length === 0 ? (
                  <p className="text-xs text-c-text-secondary italic py-2">
                    {t('initiatives.noItemsYet3')}
                  </p>
                ) : (
                  items.map((item) =>
                    renderChecklistRow(
                      item,
                      onUpdate,
                      onRemove,
                      t(placeholderKey),
                      t('initiatives.initiativeDocumentView.listItemLabel', { title: t(titleKey) }),
                      aiFieldKey
                    )
                  )
                )}
              </div>
            </div>
          );

          component = (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-c-text">
                  {t('initiatives.successCriteria3')}
                </h2>
              </div>
              {renderChecklistCard(
                'initiatives.initiativeDocumentView.targetStateScopeTargetTitle',
                'initiatives.initiativeDocumentView.targetStateScopeTargetDesc',
                targetStateItems,
                addTarget,
                updateTarget,
                removeTarget,
                'initiative-target-state',
                setTargetStateItems,
                'initiatives.initiativeDocumentView.targetStateScopeTargetPlaceholder'
              )}
              {renderChecklistCard(
                'initiatives.initiativeDocumentView.targetStateScopeSuccessTitle',
                'initiatives.initiativeDocumentView.targetStateScopeSuccessDesc',
                successCriteriaItems,
                addCriteria,
                updateCriteria,
                removeCriteria,
                'initiative-success-criteria',
                setSuccessCriteriaItems,
                'initiatives.initiativeDocumentView.targetStateScopeSuccessPlaceholder'
              )}
              {renderChecklistCard(
                'initiatives.initiativeDocumentView.targetStateScopeDeliverablesTitle',
                'initiatives.initiativeDocumentView.targetStateScopeDeliverablesDesc',
                deliverableItems,
                addDeliverable,
                updateDeliverable,
                removeDeliverable,
                'initiative-deliverables',
                setDeliverableItems,
                'initiatives.initiativeDocumentView.targetStateScopeDeliverablesPlaceholder'
              )}
            </div>
          );
          break;
        }

        case 'target-success': {
          const mkId = () => Math.random().toString(36).substr(2, 9);
          const addTS = () =>
            setTargetStateItems([...targetStateItems, { id: mkId(), text: '', done: false }]);
          const addSC = () =>
            setSuccessCriteriaItems([
              ...successCriteriaItems,
              { id: mkId(), text: '', done: false },
            ]);
          const addDL = () =>
            setDeliverableItems([...deliverableItems, { id: mkId(), text: '', done: false }]);
          const updateTS = (id: string, p: Partial<{ text: string; done: boolean }>) =>
            setTargetStateItems(targetStateItems.map((c) => (c.id === id ? { ...c, ...p } : c)));
          const updateSC = (id: string, p: Partial<{ text: string; done: boolean }>) =>
            setSuccessCriteriaItems(
              successCriteriaItems.map((c) => (c.id === id ? { ...c, ...p } : c))
            );
          const updateDL = (id: string, p: Partial<{ text: string; done: boolean }>) =>
            setDeliverableItems(deliverableItems.map((d) => (d.id === id ? { ...d, ...p } : d)));
          const removeTS = (id: string) =>
            setTargetStateItems(targetStateItems.filter((c) => c.id !== id));
          const removeSC = (id: string) =>
            setSuccessCriteriaItems(successCriteriaItems.filter((c) => c.id !== id));
          const removeDL = (id: string) =>
            setDeliverableItems(deliverableItems.filter((d) => d.id !== id));

          /* ── Reusable checklist item row ── */
          const renderItem = (
            item: { id: string; text: string; done: boolean },
            onUpdate: (id: string, p: Partial<{ text: string; done: boolean }>) => void,
            onRemove: (id: string) => void,
            placeholder: string
          ) => (
            <div
              key={item.id}
              className={`group flex items-start gap-2.5 py-1.5 transition-all duration-200 ${item.done ? 'opacity-50 hover:opacity-70' : ''}`}
            >
              <button
                onClick={() => onUpdate(item.id, { done: !item.done })}
                className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                  item.done
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'border-c-border-strong hover:border-emerald-400'
                }`}
              >
                {item.done && (
                  <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M2.5 6L5 8.5L9.5 3.5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
              <input
                type="text"
                value={item.text}
                onChange={(e) => onUpdate(item.id, { text: e.target.value })}
                placeholder={placeholder}
                className={`flex-1 bg-transparent text-sm leading-snug focus:outline-none placeholder:text-c-text-muted transition-colors ${
                  item.done ? 'line-through text-c-text-secondary' : 'text-c-text-secondary'
                }`}
              />
              <button
                onClick={() => onRemove(item.id)}
                className="mt-0.5 opacity-0 group-hover:opacity-100 p-0.5 rounded-md hover:bg-danger-50 dark:hover:bg-danger-500/20 text-c-text-secondary hover:text-danger-500 transition-all"
              >
                <Trash2 size={12} />
              </button>
            </div>
          );

          /* ── Reusable checklist block (identical for all 3) ── */
          const renderBlock = (
            labelKey: string,
            descKey: string,
            items: { id: string; text: string; done: boolean }[],
            onUpdate: (id: string, p: Partial<{ text: string; done: boolean }>) => void,
            onRemove: (id: string) => void,
            onAdd: () => void,
            placeholderKey: string,
            aiFieldKey: string,
            setItems: (items: { id: string; text: string; done: boolean }[]) => void
          ) => (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-c-text-secondary">
                    {t(labelKey)}
                  </label>
                  <p className="text-[10px] text-c-text-secondary mt-0.5">{t(descKey)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={onAdd}
                    className="flex items-center gap-1 text-xs font-medium text-c-text-secondary hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                  >
                    <Plus size={14} />
                    {t('initiatives.addItem2')}
                  </button>
                  <FieldAiEnhancer
                    hidden={readMode}
                    fieldKey={aiFieldKey}
                    sectionLabel={t(labelKey)}
                    currentValue={items
                      .map((c) => c.text)
                      .filter(Boolean)
                      .join('\n')}
                    onApply={(val) => {
                      const lines = val.split('\n').filter((l: string) => l.trim());
                      setItems(
                        lines.map((t: string) => ({
                          id: mkId(),
                          text: t.replace(/^[-•*]\s*/, ''),
                          done: false,
                        }))
                      );
                    }}
                    artifactContext={{
                      title: initiative?.name || '',
                      status,
                      priority,
                      type: 'initiative',
                    }}
                    outputFormat="list"
                  />
                </div>
              </div>
              <div className="border-b border-c-border-subtle pb-2 min-h-[40px]">
                {items.map((item) => renderItem(item, onUpdate, onRemove, t(placeholderKey)))}
              </div>
            </div>
          );

          component = (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-c-text">
                  {t('initiatives.successCriteria3')}
                </h2>
              </div>

              {renderBlock(
                'initiatives.initiativeDocumentView.targetSuccessTargetTitle',
                'initiatives.initiativeDocumentView.targetSuccessTargetDesc',
                targetStateItems,
                updateTS,
                removeTS,
                addTS,
                'initiatives.initiativeDocumentView.targetSuccessTargetPlaceholder',
                'initiative-target-state',
                setTargetStateItems
              )}

              {renderBlock(
                'initiatives.initiativeDocumentView.targetSuccessSuccessTitle',
                'initiatives.initiativeDocumentView.targetSuccessSuccessDesc',
                successCriteriaItems,
                updateSC,
                removeSC,
                addSC,
                'initiatives.initiativeDocumentView.targetSuccessSuccessPlaceholder',
                'initiative-success-criteria',
                setSuccessCriteriaItems
              )}

              {renderBlock(
                'initiatives.initiativeDocumentView.targetSuccessDeliverablesTitle',
                'initiatives.initiativeDocumentView.targetSuccessDeliverablesDesc',
                deliverableItems,
                updateDL,
                removeDL,
                addDL,
                'initiatives.initiativeDocumentView.targetSuccessDeliverablesPlaceholder',
                'initiative-deliverables',
                setDeliverableItems
              )}
            </div>
          );
          break;
        }

        case 'scope-boundaries': {
          const mkId = () => Math.random().toString(36).substr(2, 9);
          const addInScope = () => setInScopeItems([...inScopeItems, '']);
          const addOutScope = () => setOutScopeItems([...outScopeItems, '']);
          const addKillCriteria = () => setKillCriteriaItems([...killCriteriaItems, '']);
          const updateInScope = (idx: number, val: string) =>
            setInScopeItems(inScopeItems.map((v, i) => (i === idx ? val : v)));
          const updateOutScope = (idx: number, val: string) =>
            setOutScopeItems(outScopeItems.map((v, i) => (i === idx ? val : v)));
          const updateKill = (idx: number, val: string) =>
            setKillCriteriaItems(killCriteriaItems.map((v, i) => (i === idx ? val : v)));
          const removeInScope = (idx: number) =>
            setInScopeItems(inScopeItems.filter((_, i) => i !== idx));
          const removeOutScope = (idx: number) =>
            setOutScopeItems(outScopeItems.filter((_, i) => i !== idx));
          const removeKill = (idx: number) =>
            setKillCriteriaItems(killCriteriaItems.filter((_, i) => i !== idx));

          /* ── Scope item row with colored dot ── */
          const renderScopeItem = (
            item: string,
            idx: number,
            onUpdate: (idx: number, val: string) => void,
            onRemove: (idx: number) => void,
            dotColor: 'emerald' | 'red',
            placeholder: string,
            aiLabel: string
          ) => (
            <div key={idx} className="group flex items-center gap-2 py-1">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  dotColor === 'emerald' ? 'bg-emerald-500' : 'bg-danger-400'
                }`}
              />
              <input
                type="text"
                value={item}
                onChange={(e) => onUpdate(idx, e.target.value)}
                placeholder={placeholder}
                autoFocus={!item}
                className="flex-1 bg-transparent text-sm leading-snug focus:outline-none placeholder:text-c-text-muted text-c-text-secondary"
              />
              <FieldAiEnhancer
                hidden={readMode}
                fieldKey={`initiative.scope.${dotColor}.${idx}`}
                sectionLabel={aiLabel}
                currentValue={item}
                onApply={(v) => onUpdate(idx, v)}
                artifactContext={{
                  title: initiative?.name || '',
                  status,
                  priority,
                  type: 'initiative',
                }}
                iconOnly
                outputFormat="short"
              />
              <button
                onClick={() => onRemove(idx)}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded-md hover:bg-danger-50 dark:hover:bg-danger-500/20 text-c-text-secondary hover:text-danger-500 transition-all"
              >
                <Trash2 size={12} />
              </button>
            </div>
          );

          component = (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-c-text">
                  {t('initiatives.scopeKillCriteria2')}
                </h2>
              </div>

              {/* ── Two-column layout: In Scope | Out of Scope with vertical divider ── */}
              <div className="flex gap-0">
                {/* ── In Scope (left) ── */}
                <div className="flex-1 space-y-2 pr-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                      <div>
                        <label className="text-[11px] font-semibold uppercase tracking-wide text-c-text-secondary">
                          {t('initiatives.inScope3')}
                        </label>
                        <p className="text-[10px] text-c-text-secondary mt-0.5">
                          {t('initiatives.elementsProcessesAndAreasIncludedIn2')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={addInScope}
                        className="flex items-center gap-1 text-xs font-medium text-c-text-secondary hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                      >
                        <Plus size={14} />
                        {t('initiatives.addItem2')}
                      </button>
                      <FieldAiEnhancer
                        hidden={readMode}
                        fieldKey="initiative-scope-in"
                        sectionLabel={t('initiatives.inScope3')}
                        currentValue={inScopeItems.filter(Boolean).join('\n')}
                        onApply={(val) => {
                          const lines = val.split('\n').filter((l: string) => l.trim());
                          setInScopeItems(lines.map((t: string) => t.replace(/^[-•*✓]\s*/, '')));
                        }}
                        artifactContext={{
                          title: initiative?.name || '',
                          status,
                          priority,
                          type: 'initiative',
                        }}
                        outputFormat="list"
                      />
                    </div>
                  </div>
                  <div className="border-b border-c-border-subtle pb-2 min-h-[40px]">
                    {inScopeItems.map((item, i) =>
                      renderScopeItem(
                        item,
                        i,
                        updateInScope,
                        removeInScope,
                        'emerald',
                        t('initiatives.scopeItem2'),
                        t('initiatives.inScopeListItem2')
                      )
                    )}
                    {inScopeItems.length === 0 && (
                      <p className="text-xs text-c-text-secondary italic py-2">
                        {t('initiatives.noItemsYet4')}
                      </p>
                    )}
                  </div>
                </div>

                {/* ── Vertical divider ── */}
                <div className="w-px bg-c-surface-raised shrink-0" />

                {/* ── Out of Scope (right) ── */}
                <div className="flex-1 space-y-2 pl-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-danger-400 shrink-0" />
                      <div>
                        <label className="text-[11px] font-semibold uppercase tracking-wide text-c-text-secondary">
                          {t('initiatives.outOfScope3')}
                        </label>
                        <p className="text-[10px] text-c-text-secondary mt-0.5">
                          {t('initiatives.exclusionsAndBoundariesNotCovered2')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={addOutScope}
                        className="flex items-center gap-1 text-xs font-medium text-c-text-secondary hover:text-danger-500 dark:hover:text-danger-400 transition-colors"
                      >
                        <Plus size={14} />
                        {t('initiatives.addItem2')}
                      </button>
                      <FieldAiEnhancer
                        hidden={readMode}
                        fieldKey="initiative-scope-out"
                        sectionLabel={t('initiatives.outOfScope3')}
                        currentValue={outScopeItems.filter(Boolean).join('\n')}
                        onApply={(val) => {
                          const lines = val.split('\n').filter((l: string) => l.trim());
                          setOutScopeItems(lines.map((t: string) => t.replace(/^[-•*✗]\s*/, '')));
                        }}
                        artifactContext={{
                          title: initiative?.name || '',
                          status,
                          priority,
                          type: 'initiative',
                        }}
                        outputFormat="list"
                      />
                    </div>
                  </div>
                  <div className="border-b border-c-border-subtle pb-2 min-h-[40px]">
                    {outScopeItems.map((item, i) =>
                      renderScopeItem(
                        item,
                        i,
                        updateOutScope,
                        removeOutScope,
                        'red',
                        t('initiatives.exclusion2'),
                        t('initiatives.outOfScopeListItem2')
                      )
                    )}
                    {outScopeItems.length === 0 && (
                      <p className="text-xs text-c-text-secondary italic py-2">
                        {t('initiatives.noItemsYet4')}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Horizontal separator ── */}
              <div className="border-t border-c-border-subtle mt-2" />

              {/* ── Kill Criteria (full width, below) ── */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-danger-500 shrink-0" />
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wide text-c-text-secondary">
                        {t('initiatives.killCriteria5')}
                      </label>
                      <p className="text-[10px] text-c-text-secondary mt-0.5">
                        {t('initiatives.conditionsThatTriggerImmediateInitiative2')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={addKillCriteria}
                      className="flex items-center gap-1 text-xs font-medium text-c-text-secondary hover:text-danger-600 dark:hover:text-danger-400 transition-colors"
                    >
                      <Plus size={14} />
                      {t('initiatives.addItem2')}
                    </button>
                    <FieldAiEnhancer
                      hidden={readMode}
                      fieldKey="initiative-kill-criteria"
                      sectionLabel={t('initiatives.killCriteria6')}
                      currentValue={killCriteriaItems.filter(Boolean).join('\n')}
                      onApply={(val) => {
                        const lines = val.split('\n').filter((l: string) => l.trim());
                        setKillCriteriaItems(lines.map((t: string) => t.replace(/^[-•*!]\s*/, '')));
                      }}
                      artifactContext={{
                        title: initiative?.name || '',
                        status,
                        priority,
                        type: 'initiative',
                      }}
                      outputFormat="list"
                    />
                  </div>
                </div>
                <div className="border-b border-danger-200/40 dark:border-danger-500/20 pb-2 min-h-[40px]">
                  {killCriteriaItems.map((item, i) => (
                    <div key={i} className="group flex items-center gap-2 py-1">
                      <AlertTriangle size={12} className="text-danger-500 shrink-0" />
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => updateKill(i, e.target.value)}
                        placeholder={t('initiatives.killCriteria7')}
                        autoFocus={!item}
                        className="flex-1 bg-transparent text-sm leading-snug focus:outline-none placeholder:text-c-text-muted text-c-text-secondary"
                      />
                      <FieldAiEnhancer
                        hidden={readMode}
                        fieldKey={`initiative.scope.killCriteria.${i}`}
                        sectionLabel={t('initiatives.killCriteriaListItem2')}
                        currentValue={item}
                        onApply={(v) => updateKill(i, v)}
                        artifactContext={{
                          title: initiative?.name || '',
                          status,
                          priority,
                          type: 'initiative',
                        }}
                        iconOnly
                        outputFormat="short"
                      />
                      <button
                        onClick={() => removeKill(i)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded-md hover:bg-danger-50 dark:hover:bg-danger-500/20 text-c-text-secondary hover:text-danger-500 transition-all"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  {killCriteriaItems.length === 0 && (
                    <p className="text-xs text-c-text-secondary italic py-2">
                      {t('initiatives.noCriteriaYet2')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
          break;
        }

        case 'tasks': {
          const TasksComp = SECTION_REGISTRY['tasks'];
          const tasksST = [...leftSections, ...rightSections].find((s) => s.key === 'tasks');
          component = (
            <div className="space-y-6">
              {/* Tasks section */}
              {tasksST && TasksComp && (
                <TasksComp sectionType={tasksST} expanded={true} onToggle={() => {}} />
              )}
              {/* Effort Profile */}
              {initiative?.effortProfile && (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-c-text-muted mb-2 block">
                    {t('initiatives.effortProfile2')}
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {Object.entries(initiative.effortProfile).map(([key, val]) => (
                      <div
                        key={key}
                        className="p-2.5 rounded-lg bg-c-surface/60 dark:bg-c-surface/40 border border-c-border-subtle"
                      >
                        <p className="text-[10px] text-c-text-muted capitalize mb-1">{key}</p>
                        <div className="h-1.5 rounded-full bg-c-surface-raised overflow-hidden">
                          <div
                            className="h-full rounded-full bg-c-surface"
                            style={{ width: `${val as number}%` }}
                          />
                        </div>
                        <p className="text-xs font-medium text-c-text-secondary mt-0.5">
                          {val as number}%
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
          break;
        }

        case 'dependencies': {
          const DepsTabComp = SECTION_REGISTRY['dependencies'];
          const depsTabST = [...leftSections, ...rightSections].find(
            (s) => s.key === 'dependencies'
          );
          const depsFallbackST = {
            id: 'dependencies',
            key: 'dependencies',
            name: 'Dependencies',
            namePl: 'Zależności',
            description: null,
            descriptionPl: null,
            category: 'content' as const,
            columnPosition: 'right' as const,
            defaultOrder: 60,
            icon: null,
            iconColor: null,
            iconBg: null,
            componentKey: 'dependencies',
            isSystem: false,
            isActive: true,
          };
          component = DepsTabComp ? (
            <div className="space-y-6">
              <DepsTabComp
                sectionType={depsTabST || depsFallbackST}
                expanded={true}
                onToggle={() => {}}
              />
            </div>
          ) : null;
          break;
        }

        case 'team': {
          const TeamComp = SECTION_REGISTRY['team'];
          const InitTeamComp = SECTION_REGISTRY['initiativeTeam'];
          const teamST = [...leftSections, ...rightSections].find((s) => s.key === 'team');
          const teamFallbackST = {
            id: 'team',
            key: 'team',
            name: 'Team',
            namePl: 'Zespół',
            description: null,
            descriptionPl: null,
            category: 'control' as const,
            columnPosition: 'right' as const,
            defaultOrder: 20,
            icon: null,
            iconColor: null,
            iconBg: null,
            componentKey: 'team',
            isSystem: true,
            isActive: true,
          };
          const initTeamFallbackST = {
            id: 'initiativeTeam',
            key: 'initiativeTeam',
            name: 'Team management',
            namePl: 'Zarządzanie zespołem',
            description: null,
            descriptionPl: null,
            category: 'content' as const,
            columnPosition: 'right' as const,
            defaultOrder: 120,
            icon: null,
            iconColor: null,
            iconBg: null,
            componentKey: 'initiativeTeam',
            isSystem: false,
            isActive: true,
          };
          component = TeamComp ? (
            <div className="space-y-6">
              <TeamComp
                sectionType={teamST || teamFallbackST}
                expanded={true}
                onToggle={() => {}}
              />
              {InitTeamComp ? (
                <InitTeamComp
                  sectionType={initTeamFallbackST}
                  expanded={true}
                  onToggle={() => {}}
                />
              ) : null}
            </div>
          ) : null;
          break;
        }

        case 'raci': {
          const RaciComp = SECTION_REGISTRY['raciEscalation'];
          const raciFallbackST = {
            id: 'raciEscalation',
            key: 'raciEscalation',
            name: 'RACI & Escalation',
            namePl: 'RACI i eskalacja',
            description: null,
            descriptionPl: null,
            category: 'content' as const,
            columnPosition: 'right' as const,
            defaultOrder: 55,
            icon: null,
            iconColor: null,
            iconBg: null,
            componentKey: 'raciEscalation',
            isSystem: false,
            isActive: true,
          };
          component = RaciComp ? (
            <RaciComp sectionType={raciFallbackST} expanded={true} onToggle={() => {}} />
          ) : null;
          break;
        }

        case 'timeline': {
          const TimelineComp = SECTION_REGISTRY['timeline'];
          const timelineFallbackST = {
            id: 'timeline',
            key: 'timeline',
            name: 'Timeline',
            namePl: 'Harmonogram',
            description: null,
            descriptionPl: null,
            category: 'control' as const,
            columnPosition: 'right' as const,
            defaultOrder: 30,
            icon: null,
            iconColor: null,
            iconBg: null,
            componentKey: 'timeline',
            isSystem: false,
            isActive: true,
          };
          component = TimelineComp ? (
            <TimelineComp sectionType={timelineFallbackST} expanded={true} onToggle={() => {}} />
          ) : null;
          break;
        }

        case 'resources': {
          component = <ResourcesSection />;
          break;
        }

        case 'financial-analysis':
        case 'financial-impact': {
          // Financial sizing/ROI prose persists into `market_context`
          // (marketContextDraft → saved by the existing dirty/save flow). The
          // editable narrative IS the persistence target, so this section both
          // renders + edits that draft and offers a real AI-fill button.
          const isAnalysis = section.id === 'financial-analysis';
          const FinIcon = isAnalysis ? Calculator : TrendingUp;
          const busy = isGeneratingAI === section.id;
          const heading = isAnalysis
            ? t('initiatives.financialAnalysisSizingRoi2')
            : t('initiatives.financialImpact2');
          component = (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FinIcon size={16} className="text-c-text-secondary" />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-c-text-secondary">
                    {heading}
                  </span>
                  {(() => {
                    // Advisory quality verdict chip (M13 #2). Renders only after an
                    // AI-fill that ran the review pass. PASS ≥ 90 = green; otherwise
                    // amber with the top gaps in the tooltip. Never blocks the save.
                    const rv = sectionReview[section.id];
                    if (!rv) return null;
                    const pass = rv.verdict === 'PASS';
                    const label = pass ? t('initiatives.qualityOk2') : t('initiatives.needsWork2');
                    const tip = [
                      `${t('initiatives.qualityScore2')}: ${rv.score}/100 (PASS ≥ ${REVIEW_PASS_THRESHOLD})`,
                      rv.degraded ? t('initiatives.heuristicScoreNoLlmVerifyManually2') : '',
                      ...rv.gaps.map((g) => `• ${g}`),
                    ]
                      .filter(Boolean)
                      .join('\n');
                    return (
                      <span
                        title={tip}
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                          pass
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300'
                            : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300'
                        }`}
                      >
                        {pass ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                        {label} · {rv.score}
                      </span>
                    );
                  })()}
                </div>
                {canUseAi && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void handleGenerateFinancial(
                        section.id as 'financial-analysis' | 'financial-impact'
                      )
                    }
                    title={t('initiatives.generateAnAiDraftSizingRoi2')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-500/40 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Sparkles size={13} />
                    {busy ? t('initiatives.generating2') : t('initiatives.generateWithAi2')}
                  </button>
                )}
              </div>
              {!marketContextDraft.trim() && !busy && (
                <p className="text-xs text-c-text-secondary">
                  {isAnalysis
                    ? t('initiatives.emptyUseGenerateWithAiOr3')
                    : t('initiatives.emptyUseGenerateWithAiOr4')}
                </p>
              )}
              <ExpandableNarrativeField
                value={marketContextDraft}
                onChange={setMarketContextDraft}
                previewMode={readMode}
                readOnly={!canEditCards}
                isPolish={isPolish}
                placeholder={
                  isAnalysis
                    ? t('initiatives.sizingCurrencyDaysExplicitAssumptionRoi2')
                    : t('initiatives.revenueImpactCostSavingsBenefitsRealizat2')
                }
              />
            </div>
          );
          break;
        }

        case 'risk-raid': {
          // N-mode Risk & RAID — uses shared RaidCanvas component
          const nModeRaidItems = raidItems.map((r: any) => ({
            id: r.id,
            type: r.type as any,
            title: r.title,
            description: r.description || '',
            probability: r.probability || undefined,
            impact: (r.severity || 'MEDIUM').toLowerCase(),
            category: r.category || undefined,
            mitigation: r.mitigation || r.mitigationPlan || '',
            contingency: r.contingency || '',
            proposedAction: r.proposedAction || '',
            status: (r.status || 'OPEN').toLowerCase(),
            responseStrategy: r.responseStrategy || undefined,
            owner: r.owner || r.ownerName || '',
            dueDate: r.dueDate || '',
            source: r.source || '',
          }));
          const nModeRaidUsers = users.map((u: any) => ({
            id: u.id,
            name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || u.id,
          }));
          component = (
            <NModeRaidCanvas
              items={nModeRaidItems}
              onAddItem={(type: any) => {
                const newItem = {
                  id: `raid-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                  type,
                  title: '',
                  severity: 'MEDIUM' as const,
                  status: 'OPEN',
                  owner: '',
                  mitigationPlan: '',
                };
                setRaidItems((prev: any) => [newItem, ...prev]);
              }}
              onUpdateItem={(id: string, updates: any) => {
                setRaidItems((prev: any) =>
                  prev.map((item: any) => {
                    if (item.id !== id) return item;
                    const patch: any = { ...item };
                    if (updates.title !== undefined) patch.title = updates.title;
                    if (updates.type !== undefined) patch.type = updates.type;
                    if (updates.impact !== undefined) patch.severity = updates.impact.toUpperCase();
                    if (updates.status !== undefined) patch.status = updates.status.toUpperCase();
                    if (updates.owner !== undefined) patch.owner = updates.owner;
                    if (updates.mitigation !== undefined) patch.mitigationPlan = updates.mitigation;
                    if (updates.probability !== undefined) patch.probability = updates.probability;
                    if (updates.category !== undefined) patch.category = updates.category;
                    if (updates.contingency !== undefined) patch.contingency = updates.contingency;
                    if (updates.proposedAction !== undefined)
                      patch.proposedAction = updates.proposedAction;
                    if (updates.dueDate !== undefined) patch.dueDate = updates.dueDate;
                    if (updates.source !== undefined) patch.source = updates.source;
                    if (updates.responseStrategy !== undefined)
                      patch.responseStrategy = updates.responseStrategy;
                    if (updates.description !== undefined) patch.description = updates.description;
                    return patch;
                  })
                );
              }}
              onRemoveItem={(id: string) => {
                setRaidItems((prev: any) => prev.filter((item: any) => item.id !== id));
              }}
              onConvertToIssue={(id: string) => {
                setRaidItems((prev: any) =>
                  prev.map((item: any) => {
                    if (item.id !== id) return item;
                    return {
                      ...item,
                      type: 'issue',
                      status: 'OPEN',
                      source: `${t('initiatives.convertedFrom2')} ${item.type}: ${item.title}`,
                    };
                  })
                );
              }}
              onAIGenerate={() => requestRaidAi()}
              isGeneratingAI={!!raidAiRequest || isRaidAIProposing}
              locked={!canEditCards}
              artifactContext={{
                title: initiative?.title || initiative?.name || '',
                status: status || '',
                priority: priority || '',
                type: 'initiative',
              }}
              fieldKeyPrefix="init"
              users={nModeRaidUsers}
            />
          );
          break;
        }

        case 'decisions': {
          const DecisionsComp = SECTION_REGISTRY['decisions'];
          const decisionsST = [...leftSections, ...rightSections].find(
            (s) => s.key === 'decisions'
          );
          const decisionsFallbackST = {
            id: 'decisions',
            key: 'decisions',
            name: 'Decisions',
            namePl: 'Decyzje',
            description: null,
            descriptionPl: null,
            category: 'content' as const,
            columnPosition: 'left' as const,
            defaultOrder: 60,
            icon: 'Scale',
            iconColor: 'text-amber-500',
            iconBg: null,
            componentKey: 'decisions',
            isSystem: false,
            isActive: true,
          };
          component = DecisionsComp ? (
            <DecisionsComp
              sectionType={decisionsST || decisionsFallbackST}
              expanded={true}
              onToggle={() => {}}
            />
          ) : null;
          break;
        }

        case 'gates': {
          component = (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-c-text">{t('initiatives.gates2')}</h2>
              </div>

              {/* Full lifecycle gate workflow table (13 stages) */}
              <InitiativeGatesWorkflowTable />
            </div>
          );
          break;
        }

        case 'suggested-changes': {
          component = (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-c-text">
                {t('initiatives.suggestedChanges2')}
              </h2>
              {suggestedChangesLoading ? (
                <p className="text-sm text-c-text-muted">{t('initiatives.loading2')}</p>
              ) : (
                <div className="min-h-[200px]">
                  <SuggestedChangesPanel
                    items={suggestedChanges}
                    isPolish={isPolish}
                    onAccept={(c) => void handleResolveSuggestedChange(c, true)}
                    onReject={(c) => void handleResolveSuggestedChange(c, false)}
                  />
                </div>
              )}
            </div>
          );
          break;
        }

        // SPEC-N §2.1 — sekcja `comments` NIE JEST już sekcją centrum
        // (zarezerwowane id → prawy panel). Treść żyje w
        // initiativeRightPanelSections. Modal propozycji AI dla komentarzy
        // („Analizuj z AI" → dodaj/usuń) przeniesiony do korzenia RENDER —
        // obok modala RAID — bo `fixed inset-0` i tak nie zależy od miejsca
        // w drzewie, a tutaj przestałby się renderować razem z sekcją.
        //
        // Sekcja `activity-log` — j.w., zeszła do panelu jako `history`.
        // Sekcja `evidence` — j.w. (§2.2), zeszła do panelu między
        // Powiązania a Komentarze.

        case 'kpi': {
          component = (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-c-text">
                  {t('initiatives.kpisBenefits2')}
                </h2>
                <div className="inline-flex items-center gap-2">
                  <button
                    onClick={() => setShowCreateKpi((prev) => !prev)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-c-text-muted hover:text-c-info transition-colors"
                  >
                    <Plus size={12} />+ Add KPI
                  </button>
                </div>
              </div>
              {showCreateKpi && (
                <div className="rounded-2xl border border-c-border-subtle bg-c-surface/70 px-4 py-3 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-c-text-secondary">
                      {t('initiatives.addAManualKpiOrLink2')}
                    </p>
                    <div className="inline-flex rounded-xl border border-c-border-subtle p-1 bg-c-surface/80">
                      <button
                        onClick={() => setCreateKpiMode('manual')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          createKpiMode === 'manual'
                            ? 'bg-c-text text-c-bg'
                            : 'text-c-text-muted hover:text-c-text-secondary dark:hover:text-c-text-muted'
                        }`}
                      >
                        {t('initiatives.manualKpi2')}
                      </button>
                      <button
                        onClick={() => setCreateKpiMode('linked')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          createKpiMode === 'linked'
                            ? 'bg-c-text text-c-bg'
                            : 'text-c-text-muted hover:text-c-text-secondary dark:hover:text-c-text-muted'
                        }`}
                      >
                        {t('initiatives.linkExisting2')}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                    {createKpiMode === 'linked' && (
                      <div className="md:col-span-6">
                        <select
                          value={createKpiLibraryId}
                          onChange={(e) => setCreateKpiLibraryId(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-c-border-subtle bg-c-surface/90 dark:bg-c-surface/70 text-sm"
                        >
                          <option value="">
                            {createKpiLibraryLoading
                              ? t('initiatives.loadingKpiCatalog2')
                              : t('initiatives.selectKpiFromCatalog2')}
                          </option>
                          {createKpiLibraryOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.name}
                              {option.unit ? ` (${option.unit})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <input
                      value={createKpiName}
                      onChange={(e) => setCreateKpiName(e.target.value)}
                      placeholder={t('initiatives.kpiName2')}
                      disabled={createKpiMode === 'linked'}
                      className="md:col-span-2 px-3 py-2 rounded-lg border border-c-border-subtle bg-c-surface/90 dark:bg-c-surface/70 text-sm disabled:opacity-60"
                    />
                    <input
                      value={createKpiUnit}
                      onChange={(e) => setCreateKpiUnit(e.target.value)}
                      placeholder={t('initiatives.unit2')}
                      disabled={createKpiMode === 'linked'}
                      className="px-3 py-2 rounded-lg border border-c-border-subtle bg-c-surface/90 dark:bg-c-surface/70 text-sm disabled:opacity-60"
                    />
                    <input
                      value={createKpiCategory}
                      onChange={(e) => setCreateKpiCategory(e.target.value)}
                      placeholder={t('initiatives.category2')}
                      className="px-3 py-2 rounded-lg border border-c-border-subtle bg-c-surface/90 dark:bg-c-surface/70 text-sm"
                    />
                    <input
                      value={createKpiBaseline}
                      onChange={(e) => setCreateKpiBaseline(e.target.value)}
                      placeholder="Baseline"
                      className="px-3 py-2 rounded-lg border border-c-border-subtle bg-c-surface/90 dark:bg-c-surface/70 text-sm"
                    />
                    <select
                      value={createKpiCadence}
                      onChange={(e) => setCreateKpiCadence(e.target.value)}
                      className="px-3 py-2 rounded-lg border border-c-border-subtle bg-c-surface/90 dark:bg-c-surface/70 text-sm"
                    >
                      {['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY'].map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <select
                      value={createKpiObservationPhase}
                      onChange={(e) =>
                        setCreateKpiObservationPhase(
                          e.target.value as 'realization' | 'post-implementation' | 'both'
                        )
                      }
                      className="md:col-span-2 px-3 py-2 rounded-lg border border-c-border-subtle bg-c-surface/90 dark:bg-c-surface/70 text-sm"
                    >
                      <option value="realization">{t('initiatives.realizationOnly2')}</option>
                      <option value="post-implementation">
                        {t('initiatives.postImplementationOnly2')}
                      </option>
                      <option value="both">{t('initiatives.bothPhases2')}</option>
                    </select>
                    <input
                      value={createKpiRealizationTarget}
                      onChange={(e) => setCreateKpiRealizationTarget(e.target.value)}
                      placeholder={t('initiatives.realizationTarget2')}
                      className="px-3 py-2 rounded-lg border border-c-border-subtle bg-c-surface/90 dark:bg-c-surface/70 text-sm"
                    />
                    <input
                      value={createKpiPostImplementationTarget}
                      onChange={(e) => setCreateKpiPostImplementationTarget(e.target.value)}
                      placeholder={t('initiatives.postImplementationTarget2')}
                      className="px-3 py-2 rounded-lg border border-c-border-subtle bg-c-surface/90 dark:bg-c-surface/70 text-sm"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        resetCreateKpiDraft();
                        setShowCreateKpi(false);
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-c-text-muted hover:text-c-text-secondary"
                    >
                      {t('initiatives.cancel2')}
                    </button>
                    <button
                      onClick={() => {
                        void createKpi();
                      }}
                      disabled={
                        isMutating ||
                        (createKpiMode === 'manual' ? !createKpiName.trim() : !createKpiLibraryId)
                      }
                      className="px-3 py-1.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 hover:bg-teal-100 dark:bg-teal-900/20 dark:border-teal-700/40 dark:text-teal-300 dark:hover:bg-teal-900/40 text-xs font-medium disabled:opacity-50"
                    >
                      {createKpiMode === 'linked'
                        ? t('initiatives.linkKpi2')
                        : t('initiatives.addKpi2')}
                    </button>
                  </div>
                </div>
              )}
              {editingKpiId && (
                <div className="rounded-2xl border border-indigo-300/70 dark:border-indigo-500/40 bg-indigo-50/30 dark:bg-indigo-500/5 p-3 grid grid-cols-1 md:grid-cols-6 gap-2">
                  <input
                    value={editKpiName}
                    onChange={(e) => setEditKpiName(e.target.value)}
                    placeholder={t('initiatives.kpiName2')}
                    className="md:col-span-2 px-3 py-1.5 rounded-lg border border-c-border-subtle bg-c-surface/90 dark:bg-c-surface/70 text-sm"
                  />
                  <input
                    value={editKpiUnit}
                    onChange={(e) => setEditKpiUnit(e.target.value)}
                    placeholder={t('initiatives.unit2')}
                    className="px-3 py-1.5 rounded-lg border border-c-border-subtle bg-c-surface/90 dark:bg-c-surface/70 text-sm"
                  />
                  <input
                    value={editKpiBaseline}
                    onChange={(e) => setEditKpiBaseline(e.target.value)}
                    placeholder="Baseline"
                    className="px-3 py-1.5 rounded-lg border border-c-border-subtle bg-c-surface/90 dark:bg-c-surface/70 text-sm"
                  />
                  <input
                    value={editKpiCurrent}
                    onChange={(e) => setEditKpiCurrent(e.target.value)}
                    placeholder={t('initiatives.current2')}
                    className="px-3 py-1.5 rounded-lg border border-c-border-subtle bg-c-surface/90 dark:bg-c-surface/70 text-sm"
                  />
                  <input
                    value={editKpiTarget}
                    onChange={(e) => setEditKpiTarget(e.target.value)}
                    placeholder="Target"
                    className="px-3 py-1.5 rounded-lg border border-c-border-subtle bg-c-surface/90 dark:bg-c-surface/70 text-sm"
                  />
                  <div className="md:col-span-6 flex justify-end gap-2">
                    <button
                      onClick={cancelEditKpi}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-c-text-muted hover:text-c-text-secondary"
                    >
                      {t('initiatives.cancel2')}
                    </button>
                    <button
                      onClick={saveEditKpi}
                      disabled={!editKpiName.trim() || !editKpiUnit.trim()}
                      className="px-3 py-1.5 rounded-lg border border-indigo-400/50 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/10 text-xs font-medium disabled:opacity-50"
                    >
                      {t('initiatives.saveChanges2')}
                    </button>
                  </div>
                </div>
              )}
              <div className="rounded-2xl border border-c-border-subtle bg-c-surface/70 p-3">
                <table
                  /* §27-exempt: tabela dokumentowa/raportowa read-only, do druku/eksportu */ className="w-full text-sm"
                >
                  {/* §27 — sticky header (KPI list has no sort/expand → kept custom;
                      FilterableTable would drop the inline edit-form + AI-add). */}
                  <thead className="sticky top-0 z-10 bg-c-surface">
                    <tr className="text-[11px] uppercase tracking-wide text-c-text-muted border-b border-c-border-subtle">
                      <th className="text-left py-2 pr-2">{t('initiatives.kpi2')}</th>
                      <th className="text-left py-2 pr-2">{t('initiatives.phase2')}</th>
                      <th className="text-left py-2 pr-2">{t('initiatives.unit2')}</th>
                      <th className="text-left py-2 pr-2">{t('initiatives.baseline2')}</th>
                      <th className="text-left py-2 pr-2">{t('initiatives.current2')}</th>
                      <th className="text-left py-2 pr-2">{t('initiatives.realizationTarget2')}</th>
                      <th className="text-left py-2 pr-2">
                        {t('initiatives.postImplementationTarget2')}
                      </th>
                      <th className="text-right py-2">{t('initiatives.tracking2')}</th>
                      <th className="text-right py-2 w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-c-border-subtle">
                    {localKpis.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-xs text-c-text-muted">
                          {t('initiatives.noKpisDefinedYetClickNew2')}
                        </td>
                      </tr>
                    ) : (
                      localKpis.map((kpi) => (
                        <tr key={kpi.id}>
                          <td className="py-2 pr-2 text-c-text-secondary">
                            <div className="flex items-center gap-2">
                              <span>{toEnglishKpiName(kpi.name, isPolish)}</span>
                              <span className="inline-flex items-center rounded-md border border-c-border-subtle px-1.5 py-0.5 text-[10px] text-c-text-muted">
                                {kpi.definitionSource === 'library'
                                  ? t('initiatives.linked2')
                                  : t('initiatives.manual2')}
                              </span>
                            </div>
                          </td>
                          <td className="py-2 pr-2 text-c-text-muted">
                            {kpi.observationPhase === 'both'
                              ? t('initiatives.both2')
                              : kpi.observationPhase === 'realization'
                                ? t('initiatives.realization2')
                                : t('initiatives.postImplementation2')}
                          </td>
                          <td className="py-2 pr-2 text-c-text-muted">{kpi.unit || '—'}</td>
                          <td className="py-2 pr-2 text-c-text-muted">{kpi.baseline || '—'}</td>
                          <td className="py-2 pr-2 text-c-text-muted">{kpi.current || '—'}</td>
                          <td className="py-2 pr-2 text-c-text-muted">
                            {kpi.realizationTarget || '—'}
                          </td>
                          <td className="py-2 pr-2 text-c-text-muted">
                            {kpi.postImplementationTarget || '—'}
                          </td>
                          <td className="py-2 text-right">
                            <span className="inline-flex items-center rounded-md border border-emerald-300/50 dark:border-emerald-500/40 bg-emerald-50/70 dark:bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                              {kpi.cadence || 'MONTHLY'}
                            </span>
                          </td>
                          <td className="py-2 text-right relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setKpiMenuId((prev) => (prev === kpi.id ? null : kpi.id));
                              }}
                              className="inline-flex items-center justify-center p-1 rounded-md text-c-text-secondary hover:text-c-text-secondary dark:hover:text-c-text-muted hover:bg-c-surface-raised/60 transition-colors"
                              title={t('initiatives.kpiActions2')}
                            >
                              <MoreVertical size={14} />
                            </button>
                            {kpiMenuId === kpi.id && (
                              <div className="absolute right-0 top-8 z-20 w-40 rounded-xl border border-c-border-subtle bg-c-surface p-1.5 shadow-xl shadow-c-border-strong/10 dark:shadow-black/30">
                                <button
                                  onClick={() => {
                                    setKpiMenuId(null);
                                    startEditKpi(kpi);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-c-text-secondary hover:bg-c-surface-raised transition-colors"
                                >
                                  <Edit3 size={13} />
                                  {t('initiatives.edit4')}
                                </button>
                                <button
                                  onClick={() => {
                                    setKpiMenuId(null);
                                    void duplicateKpi(kpi);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-c-text-secondary hover:bg-c-surface-raised transition-colors"
                                >
                                  <Copy size={13} />
                                  {t('initiatives.duplicate2')}
                                </button>
                                <div className="my-1 border-t border-c-border-subtle" />
                                <button
                                  onClick={() => {
                                    setKpiMenuId(null);
                                    const ok = window.confirm(t('initiatives.deleteThisKpi2'));
                                    if (ok) removeKpi(kpi.id);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/10 transition-colors"
                                >
                                  <Trash2 size={13} />
                                  {t('initiatives.delete2')}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
          break;
        }

        case 'watchers': {
          component = (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-c-text">{t('initiatives.watchers2')}</h2>
                <span className="text-xs text-c-text-muted">{watchers.length}</span>
              </div>
              {watchers.length === 0 ? (
                <div className="p-5 rounded-xl border border-c-border-subtle bg-c-surface/70 text-sm text-c-text-muted">
                  {t('initiatives.noWatchersForThisInitiativeYet2')}
                </div>
              ) : (
                <div className="space-y-2">
                  {watchers.map((watcher) => (
                    <div
                      key={watcher.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-c-border-subtle bg-c-surface/70"
                    >
                      <div>
                        <p className="text-sm font-medium text-c-text">
                          {watcher.name ||
                            users.find((u) => u.id === watcher.userId)?.firstName ||
                            watcher.userId}
                        </p>
                        <p className="text-xs text-c-text-muted">
                          {watcher.email ||
                            users.find((u) => u.id === watcher.userId)?.email ||
                            '—'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
          break;
        }

        // ── Attachments & Links (shared AttachmentsLinksCanvas — same as Task) ──
        case 'attachments-links': {
          component = (
            <AttachmentsLinksCanvas
              attachments={attachments}
              onUploadAttachments={handleUploadAttachments}
              onDeleteAttachment={handleDeleteAttachment}
              onEditAttachment={(id, patch) => {
                setAttachments((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
              }}
              linkedItems={linkedItems}
              onAddLinkedItem={handleAddLinkedItem}
              onRemoveLinkedItem={handleRemoveLinkedItem}
              onEditLinkedItem={(key, patch) => {
                const [type, id] = key.split(':');
                setLinkedItems((prev) =>
                  prev.map((item) =>
                    item.type === type && item.id === id ? { ...item, ...patch } : item
                  )
                );
              }}
              onNavigateLinkedItem={openLinkedItemTarget}
              searchLinkedItems={searchLinkedItems}
              readOnly={!canEditCards}
            />
          );
          break;
        }

        // ── V4-IDEA-09: Used in (backlinks) — LinkGraph parity with Ideas/Notebook/Tools ──
        case 'used-in': {
          const openBacklinkItem = (sourceType: string, sourceId: string) => {
            window.dispatchEvent(
              new CustomEvent('mywork-open-item', {
                detail: { type: sourceType, id: sourceId, name: `${sourceType} ${sourceId}` },
              })
            );
          };
          component = (
            <EmbeddedView
              title={t('initiatives.usedInBacklinks2')}
              count={initiativeBacklinks.length}
              loading={initiativeBacklinksLoading}
              readOnly
              viewModes={['list']}
            >
              {initiativeBacklinks.length === 0 && !initiativeBacklinksLoading ? (
                <div className="text-[11px] text-c-text-muted px-1">
                  {t('initiatives.noLinksYet2')}
                </div>
              ) : (
                <div className="space-y-2">
                  {initiativeBacklinks.slice(0, 10).map((bl) => (
                    <div
                      key={bl.id}
                      className="rounded-xl border border-c-border-subtle dark:border-white/[0.04] bg-white/40 dark:bg-white/[0.02] p-2.5 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-[11px] font-medium text-c-text truncate">
                          {getSourceDisplayLabel(bl.sourceType, isPolish)}
                        </div>
                        <div className="text-[10px] text-c-text-muted truncate">{bl.sourceId}</div>
                      </div>
                      <button
                        onClick={() => openBacklinkItem(bl.sourceType, bl.sourceId)}
                        className="text-c-text-secondary hover:text-c-text-secondary transition-colors shrink-0"
                      >
                        <ExternalLink size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </EmbeddedView>
          );
          break;
        }

        // ── C7: Artefakty — Outputs-registry artifacts linked via sourceInitiativeId ──
        case 'artifacts': {
          const artifactTypeLabel = (outputType: string): string => {
            if (outputType === 'presentation') return t('initiatives.presentation2');
            if (outputType === 'sheet') return t('initiatives.sheet2');
            return t('initiatives.document3');
          };
          component = (
            <EmbeddedView
              title={t('initiatives.artifacts2')}
              count={relatedArtifacts.length}
              loading={relatedArtifactsLoading}
              readOnly
              viewModes={['list']}
            >
              {relatedArtifacts.length === 0 && !relatedArtifactsLoading ? (
                <div className="text-[11px] text-c-text-muted px-1">
                  {t('initiatives.noArtifactsYet2')}
                </div>
              ) : (
                <div className="space-y-2">
                  {relatedArtifacts.slice(0, 10).map((artifact) => (
                    <div
                      key={artifact.artifactId}
                      className="rounded-xl border border-c-border-subtle dark:border-white/[0.04] bg-white/40 dark:bg-white/[0.02] p-2.5 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-[11px] font-medium text-c-text truncate">
                          {artifact.title}
                        </div>
                        <div className="text-[10px] text-c-text-muted truncate">
                          <span className="inline-flex items-center rounded px-1 py-px mr-1.5 border border-c-border-subtle dark:border-white/[0.06] uppercase tracking-wide">
                            {artifactTypeLabel(artifact.outputType)}
                          </span>
                          {artifact.updatedAt
                            ? new Date(artifact.updatedAt).toLocaleDateString(
                                isPolish ? 'pl-PL' : 'en-US'
                              )
                            : ''}
                        </div>
                      </div>
                      {artifact.openPath && (
                        <button
                          onClick={() =>
                            window.open(
                              artifact.openPath as string,
                              '_blank',
                              'noopener,noreferrer'
                            )
                          }
                          className="text-c-text-secondary hover:text-c-text-secondary transition-colors shrink-0"
                          title={t('initiatives.openInWorkspace2')}
                        >
                          <ExternalLink size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </EmbeddedView>
          );
          break;
        }

        // ── Phase C: Canon sections → 21/21 ───────────────────────────────
        case 'deliverables-milestones': {
          const persistDeliverables = (items: typeof deliverableItems) => {
            setDeliverableItems(items);
            // Keep texts as the canonical string[] shape (exports/badges/other
            // readers depend on it) and persist an index-aligned done[] alongside
            // so the checkbox state round-trips on reload. Both arrays are built
            // from the SAME filtered set to stay aligned.
            const kept = items.filter((d) => d.text.trim());
            const texts = kept.map((d) => d.text);
            const done = kept.map((d) => !!d.done);
            void persistInitiativeField(
              { deliverables: texts, deliverablesDone: done },
              { deliverablesDone: done, deliverables_done: done }
            );
          };
          component = (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-c-text">
                  {t('initiatives.deliverablesMilestones2')}
                </h2>
                {canEditCards && (
                  <button
                    onClick={() =>
                      persistDeliverables([
                        ...deliverableItems,
                        { id: genId(), text: '', done: false },
                      ])
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-c-border-strong text-c-text-secondary hover:bg-c-surface-raised/60"
                  >
                    <Plus size={13} /> {t('initiatives.addDeliverable2')}
                  </button>
                )}
              </div>
              {deliverableItems.length === 0 ? (
                <p className="text-sm text-c-text-muted">
                  {t('initiatives.noDeliverablesYetAddTheInitiative2')}
                </p>
              ) : (
                <ul className="space-y-2">
                  {deliverableItems.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center gap-2 rounded-lg border border-c-border-subtle px-3 py-2"
                    >
                      <input
                        type="checkbox"
                        checked={d.done}
                        disabled={!canEditCards}
                        onChange={() =>
                          persistDeliverables(
                            deliverableItems.map((x) =>
                              x.id === d.id ? { ...x, done: !x.done } : x
                            )
                          )
                        }
                        className="accent-teal-600"
                      />
                      <input
                        defaultValue={d.text}
                        readOnly={!canEditCards}
                        onBlur={(e) =>
                          persistDeliverables(
                            deliverableItems.map((x) =>
                              x.id === d.id ? { ...x, text: e.target.value } : x
                            )
                          )
                        }
                        placeholder={t('initiatives.deliverable2')}
                        className="flex-1 bg-transparent text-sm text-c-text-secondary focus:outline-none"
                      />
                      {canEditCards && (
                        <button
                          onClick={() =>
                            persistDeliverables(deliverableItems.filter((x) => x.id !== d.id))
                          }
                          className="text-c-text-muted hover:text-danger-500"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
          break;
        }

        case 'change-log': {
          component = (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-c-text">{t('initiatives.changeLog2')}</h2>
              {canEditCards && (
                <div className="flex items-center gap-2">
                  <input
                    value={changeLogDraft}
                    onChange={(e) => setChangeLogDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && changeLogDraft.trim()) {
                        addChangeLogEntry({ change: changeLogDraft.trim() });
                        setChangeLogDraft('');
                      }
                    }}
                    placeholder={t('initiatives.describeAChangePressEnter2')}
                    className="flex-1 rounded-lg border border-c-border-strong bg-transparent px-3 py-1.5 text-sm text-c-text-secondary focus:outline-none focus:border-teal-400"
                  />
                  <button
                    onClick={() => {
                      if (changeLogDraft.trim()) {
                        addChangeLogEntry({ change: changeLogDraft.trim() });
                        setChangeLogDraft('');
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-c-border-strong text-c-text-secondary hover:bg-c-surface-raised/60"
                  >
                    <Plus size={13} /> {t('initiatives.add2')}
                  </button>
                </div>
              )}
              {changeLogItems.length === 0 ? (
                <p className="text-sm text-c-text-muted">
                  {t('initiatives.noStrategicChangesRecordedYet2')}
                </p>
              ) : (
                <ul className="space-y-2">
                  {changeLogItems.map((e: any) => (
                    <li
                      key={e.id}
                      className="flex items-start gap-3 rounded-lg border border-c-border-subtle px-3 py-2"
                    >
                      <span className="text-[11px] font-mono text-c-text-muted pt-0.5 shrink-0">
                        {e.date}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-c-text-secondary">{e.change}</div>
                        {e.reason && <div className="text-xs text-c-text-muted">{e.reason}</div>}
                        {e.user && (
                          <div className="text-[11px] text-c-text-muted mt-0.5">{e.user}</div>
                        )}
                      </div>
                      {canEditCards && (
                        <button
                          onClick={() => removeChangeLogEntry(e.id)}
                          className="text-c-text-muted hover:text-danger-500"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
          break;
        }

        case 'okr': {
          component = (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-c-text">OKR</h2>
              {canEditCards && (
                <div className="flex items-center gap-2">
                  <input
                    value={okrDraft}
                    onChange={(e) => setOkrDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && okrDraft.trim()) {
                        addOkr(okrDraft.trim());
                        setOkrDraft('');
                      }
                    }}
                    placeholder={t('initiatives.objective2')}
                    className="flex-1 rounded-lg border border-c-border-strong bg-transparent px-3 py-1.5 text-sm text-c-text-secondary focus:outline-none focus:border-teal-400"
                  />
                  <button
                    onClick={() => {
                      if (okrDraft.trim()) {
                        addOkr(okrDraft.trim());
                        setOkrDraft('');
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-c-border-strong text-c-text-secondary hover:bg-c-surface-raised/60"
                  >
                    <Plus size={13} /> {t('initiatives.addObjective2')}
                  </button>
                </div>
              )}
              {okrItems.length === 0 ? (
                <p className="text-sm text-c-text-muted">
                  {t('initiatives.noOkrsYetAddAnObjective2')}
                </p>
              ) : (
                <div className="space-y-3">
                  {okrItems.map((o: any) => (
                    <div
                      key={o.id}
                      className="rounded-xl border border-c-border-subtle p-3 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <input
                          defaultValue={o.objective}
                          readOnly={!canEditCards}
                          onBlur={(e) => updateOkr(o.id, { objective: e.target.value })}
                          className="flex-1 bg-transparent text-sm font-medium text-c-text focus:outline-none"
                        />
                        <select
                          value={o.confidence || 'MEDIUM'}
                          disabled={!canEditCards}
                          onChange={(e) => updateOkr(o.id, { confidence: e.target.value })}
                          className="text-[11px] rounded-md bg-c-surface-raised text-c-text-secondary px-1.5 py-0.5"
                        >
                          <option value="LOW">{t('initiatives.low2')}</option>
                          <option value="MEDIUM">{t('initiatives.medium2')}</option>
                          <option value="HIGH">{t('initiatives.high2')}</option>
                        </select>
                        {canEditCards && (
                          <button
                            onClick={() => removeOkr(o.id)}
                            className="text-c-text-muted hover:text-danger-500"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                      <textarea
                        defaultValue={(o.keyResults || []).join('\n')}
                        readOnly={!canEditCards}
                        onBlur={(e) =>
                          updateOkr(o.id, {
                            keyResults: e.target.value
                              .split('\n')
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                        rows={2}
                        placeholder={t('initiatives.keyResultsOnePerLine2')}
                        className="w-full bg-transparent text-xs text-c-text-secondary focus:outline-none resize-none border-t border-c-border-subtle pt-2"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
          break;
        }

        case 'hypothesis': {
          component = (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-c-text">{t('initiatives.hypothesis2')}</h2>
              <p className="text-xs text-c-text-muted">
                {t('initiatives.theValueHypothesisWhatWeBelieve2')}
              </p>
              <AutoFitTextarea
                value={hypothesisDraft}
                previewMode={readMode}
                readOnly={!canEditCards}
                onValueChange={setHypothesisDraft}
                onBlur={saveHypothesis}
                minRows={5}
                placeholder={t('initiatives.weBelieveThatBecauseWeWill2')}
                autoFitLabel={isPolish ? 'Auto-dopasowanie' : 'Auto-fit'}
                className="w-full rounded-lg bg-transparent px-3 py-2 text-sm text-c-text-secondary focus:outline-none"
                editClassName="border border-c-border-subtle focus:border-teal-400"
              />
            </div>
          );
          break;
        }

        case 'workstream-owners': {
          const owners = [
            {
              role: t('initiatives.businessOwner2'),
              name:
                (initiative as any)?.ownerBusinessName ||
                `${(initiative as any)?.ob_first_name || ''} ${(initiative as any)?.ob_last_name || ''}`.trim(),
            },
            {
              role: t('initiatives.executionOwner2'),
              name:
                (initiative as any)?.ownerExecutionName ||
                `${(initiative as any)?.oe_first_name || ''} ${(initiative as any)?.oe_last_name || ''}`.trim(),
            },
          ].filter((o) => o.name);
          component = (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-c-text">
                {t('initiatives.workstreamOwners2')}
              </h2>
              {owners.length === 0 ? (
                <p className="text-sm text-c-text-muted">
                  {t('initiatives.noOwnersAssignedAssignThemIn2')}
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {owners.map((o, i) => (
                    <div key={i} className="rounded-xl border border-c-border-subtle p-3">
                      <div className="text-[11px] uppercase tracking-wide text-c-text-muted">
                        {o.role}
                      </div>
                      <div className="text-sm font-medium text-c-text mt-0.5">{o.name}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
          break;
        }

        case 'lessons-learned': {
          component = (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-c-text">
                {t('initiatives.lessonsLearned2')}
              </h2>
              <AutoFitTextarea
                value={lessonsDraft}
                previewMode={readMode}
                readOnly={!canEditCards}
                onValueChange={setLessonsDraft}
                onBlur={saveLessons}
                minRows={6}
                placeholder={t('initiatives.whatWorkedWhatDidnTWhat2')}
                autoFitLabel={isPolish ? 'Auto-dopasowanie' : 'Auto-fit'}
                className="w-full rounded-lg bg-transparent px-3 py-2 text-sm text-c-text-secondary focus:outline-none"
                editClassName="border border-c-border-subtle focus:border-teal-400"
              />
            </div>
          );
          break;
        }
      }

      // Canon Blok C / P0-9: every section is wrapped so it carries a uniform
      // completion visual (success rail + ✓). Sections self-title internally, so
      // no `heading` is passed here (avoids a double header). The contextual
      // section-AI + Mark Complete affordances live in the toolbar.
      const completed = !!sectionCompletions[section.id];

      // Canon B5: key empty-able sections get a "way forward" CTA in their empty
      // state. The CTA reuses each section's EXISTING handler (no new endpoints).
      // teal styling = AI affordance; add-actions reuse local mutators.
      type EmptyCfg = {
        isEmpty: boolean;
        emptyState: NonNullable<React.ComponentProps<typeof NModeSectionWrapper>['emptyState']>;
      };
      const aiCta = {
        label: { en: 'Generate with AI', pl: 'Generuj z AI' },
        onClick: () => {
          if (!canUseAi) return;
          void handleGenerateAI(section.id);
        },
      };
      const emptyConfigById: Record<string, EmptyCfg> = {
        hypothesis: {
          isEmpty: !(hypothesisDraft || '').trim(),
          emptyState: {
            icon: Lightbulb,
            message: {
              en: 'No hypothesis yet — state what you believe and how you’ll test it.',
              pl: 'Brak hipotezy — opisz, co zakładasz i jak to zweryfikujesz.',
            },
            cta: aiCta,
          },
        },
        'lessons-learned': {
          isEmpty: !(lessonsDraft || '').trim(),
          emptyState: {
            icon: GraduationCap,
            message: {
              en: 'No lessons captured yet — what worked, what didn’t?',
              pl: 'Brak wniosków — co zadziałało, a co nie?',
            },
            cta: aiCta,
          },
        },
        'change-log': {
          isEmpty: changeLogItems.length === 0,
          emptyState: {
            icon: FileText,
            message: {
              en: 'No change-log entries yet.',
              pl: 'Brak wpisów w dzienniku zmian.',
            },
            cta: {
              label: { en: 'Add entry', pl: 'Dodaj wpis' },
              onClick: () => setActiveNSection('change-log'),
            },
          },
        },
        okr: {
          isEmpty: okrItems.length === 0,
          emptyState: {
            icon: Target,
            message: {
              en: 'No objectives yet — define an objective and its key results.',
              pl: 'Brak celów — zdefiniuj cel i kluczowe rezultaty.',
            },
            cta: {
              label: { en: 'Add objective', pl: 'Dodaj cel' },
              onClick: () => {
                addOkr(t('initiatives.newObjective2'));
              },
            },
          },
        },
        'deliverables-milestones': {
          isEmpty: deliverableItems.length === 0,
          emptyState: {
            icon: Package,
            message: {
              en: 'No deliverables or milestones yet.',
              pl: 'Brak produktów ani kamieni milowych.',
            },
            cta: {
              label: { en: 'Add milestone', pl: 'Dodaj kamień milowy' },
              onClick: () =>
                setDeliverableItems((prev) => [...prev, { id: genId(), text: '', done: false }]),
            },
          },
        },
        kpi: {
          isEmpty: localKpis.length === 0,
          emptyState: {
            icon: TrendingUp,
            message: {
              en: 'No KPIs yet — generate measurable success metrics.',
              pl: 'Brak KPI — wygeneruj mierzalne wskaźniki sukcesu.',
            },
            cta: aiCta,
          },
        },
      };
      const emptyCfg = emptyConfigById[section.id];
      // Don't show the empty state on a section the user marked complete.
      const showEmpty = !!emptyCfg && emptyCfg.isEmpty && !completed && canEditCards;

      // Wzorzec N (§3) — dla sekcji-kart generowanych AI doklejamy afordancję
      // AI-draft (badge stanu + pasek Regeneruj·Edytuj·Zaakceptuj) NAD istniejącą
      // treścią. Nie podmieniamy body sekcji (empty/generating obsługuje już
      // NModeSectionWrapper wyżej). Wrap TYLKO gdy sekcja jest AI-tknięta
      // (ai-draft/edited) — sekcje nietknięte zostają wizualnie bez zmian (bez
      // dublowania nagłówka i bez mylącego badge „Gotowe" na wszystkim).
      const isBcgAiCard = BCG_AI_SECTION_IDS.has(section.id);
      const cardState = sectionAiState[section.id];
      const sectionAiDispatchable = !SECTION_AI_NOOP_IDS.has(section.id);
      const showAiCard =
        component != null &&
        isBcgAiCard &&
        !showEmpty &&
        (cardState === 'ai-draft' || cardState === 'edited');

      let contentNode: React.ReactNode = component;
      if (showAiCard) {
        contentNode = (
          <NModeCardState
            state={cardState as 'ai-draft' | 'edited'}
            sectionName={section.label}
            aiGenerated={cardState === 'ai-draft'}
            isPolish={isPolish}
            hideActions={!canEditCards}
            /* Podgląd = widok dla klienta: badge stanu redakcyjnego znika.
               `canEditCards` łączy readMode z uprawnieniami bramki, więc badge
               wiążemy wprost z readMode — w Edycji bez uprawnień badge zostaje. */
            hideBadge={readMode}
            onRegenerate={
              canUseAi && sectionAiDispatchable
                ? () => void runSectionAiRef.current(section.id)
                : undefined
            }
            onEdit={
              canEditCards
                ? () => {
                    setActiveNSection(section.id);
                    setSectionState(section.id, 'edited');
                  }
                : undefined
            }
            onAccept={canEditCards ? () => setSectionState(section.id, 'done') : undefined}
          >
            {component}
          </NModeCardState>
        );
      }

      const wrappedComponent =
        component != null ? (
          <NModeSectionWrapper
            completed={completed}
            isEmpty={showEmpty}
            emptyState={emptyCfg?.emptyState}
          >
            {contentNode}
          </NModeSectionWrapper>
        ) : (
          component
        );

      return { ...section, completed, component: wrappedComponent };
    });
  }, [
    // Wzorzec N — per-section AI-draft affordance (NModeCardState) deps.
    sectionAiState,
    setSectionState,
    canUseAi,
    canEditCards,
    setActiveNSection,
    initiativeNSections,
    initiative,
    sectionCompletions,
    isPolish,
    summary,
    setSummary,
    tasks,
    tasksDone,
    tasksInProgress,
    ownerName,
    startDate,
    endDate,
    targetDate,
    riskCount,
    criticalRaids,
    pendingGates,
    comments,
    users,
    sponsorId,
    leftSections,
    rightSections,
    decisions,
    raidItems,
    stakeholders,
    attachments,
    linkedItems,
    watchers,
    history,
    nModeActivityEntries,
    nModeActivityTypeMeta,
    // CommentsCanvas state
    nModeComments,
    nCommentDraft,
    nCommentPriority,
    nCommentDateFilter,
    nCommentSortOrder,
    // Checklist & draft states — required so useMemo re-computes when items change
    targetStateItems,
    successCriteriaItems,
    deliverableItems,
    inScopeItems,
    outScopeItems,
    killCriteriaItems,
    symptomDraft,
    rootCauseDraft,
    costOfInactionDraft,
    marketContextDraft,
    localKpis,
    showCreateKpi,
    createKpiMode,
    createKpiName,
    createKpiUnit,
    createKpiCategory,
    createKpiBaseline,
    createKpiObservationPhase,
    createKpiRealizationTarget,
    createKpiPostImplementationTarget,
    createKpiCadence,
    createKpiLibraryId,
    createKpiLibraryOptions,
    createKpiLibraryLoading,
    kpiMenuId,
    editingKpiId,
    editKpiName,
    editKpiUnit,
    editKpiBaseline,
    editKpiCurrent,
    editKpiTarget,
    resourceItems,
    budgetDraft,
    resourceTools,
    showCreateResource,
    newResourceName,
    newResourceRole,
    newResourceAllocation,
    newResourceTool,
    showCreateDecision,
    newDecisionTitle,
    showCreateRaid,
    newRaidTitle,
    newRaidType,
    newRaidSeverity,
    newRaidDescription,
    isGeneratingAI,
    isMutating,
    handleCreateDecision,
    onOpenDecision,
    setStartDate,
    setEndDate,
    handleCreateRaid,
    startEditKpi,
    cancelEditKpi,
    saveEditKpi,
    createKpi,
    resetCreateKpiDraft,
    duplicateKpi,
    removeKpi,
    // AttachmentsLinksCanvas handlers
    handleUploadAttachments,
    handleDeleteAttachment,
    handleAddLinkedItem,
    handleRemoveLinkedItem,
    searchLinkedItems,
    openLinkedItemTarget,
    initiativeBacklinks,
    initiativeBacklinksLoading,
    relatedArtifacts,
    relatedArtifactsLoading,
    // Phase C canon sections — reactive drafts/data + handlers
    canEditCards,
    changeLogItems,
    okrItems,
    hypothesisDraft,
    lessonsDraft,
    changeLogDraft,
    okrDraft,
    genId,
    setDeliverableItems,
    persistInitiativeField,
    saveHypothesis,
    saveLessons,
    addChangeLogEntry,
    removeChangeLogEntry,
    addOkr,
    updateOkr,
    removeOkr,
    canUseAi,
    handleGenerateAI,
    setActiveNSection,
    // Suggested changes (Faza 4)
    suggestedChanges,
    suggestedChangesLoading,
    handleResolveSuggestedChange,
    /* + t: tlumaczenia ladowane async — bez tego memo zwraca surowy klucz na stale (2026-07-21) */ t,
  ]);

  // MIGRACJA (D-8, ETAP 2): zestaw id boardu tworzący „Rdzeń inicjatywy" =
  // RDZEŃ nieusuwalny (overview→`initiative-definition`) + minimal domyślny
  // (`target-state-scope`, `tasks`, `kpi`). Wspólne źródło dla seed-effectu i
  // przycisków przełącznika Rdzeń/Pełny. Statyczne → deps [].
  const initiativeCoreBoardIdSet = useMemo(
    () => new Set<string>([...INITIATIVE_CORE_BOARD_IDS, ...INITIATIVE_MINIMAL_BOARD_VISIBLE_IDS]),
    []
  );

  // MIGRACJA (D-8, ETAP 2): SEED węższego defaultu za flagą. ON → ukryj wszystko
  // poza rdzeniem+minimal (jednorazowo, nie walczy z userem po pierwszym ziarnie).
  // OFF → no-op → hiddenSectionIds pozostaje new Set() → 24 sekcje jak dziś (gwarancja b).
  const didSeedHiddenRef = useRef(false);
  useEffect(() => {
    if (!initiativeCardContractEnabled) return; // OFF => zero zmian
    if (didSeedHiddenRef.current) return; // one-shot: nie walcz z userem
    if (nModeSectionsWithContent.length === 0) return; // czekaj aż board znany
    const hide = nModeSectionsWithContent
      .map((s) => s.id)
      .filter((id) => !initiativeCoreBoardIdSet.has(id));
    setHiddenSectionIds(new Set(hide));
    didSeedHiddenRef.current = true;
  }, [initiativeCardContractEnabled, nModeSectionsWithContent, initiativeCoreBoardIdSet]);

  const orderedNModeSectionsWithContent: NModeSection[] = useMemo(() => {
    const ordered = (() => {
      if (!nModeSectionOrder || nModeSectionOrder.length === 0) return nModeSectionsWithContent;

      const byId = new Map(nModeSectionsWithContent.map((section) => [section.id, section]));
      const inOrder = nModeSectionOrder
        .map((id) => byId.get(id))
        .filter((section): section is NModeSection => Boolean(section));
      const missing = nModeSectionsWithContent.filter(
        (section) => !nModeSectionOrder.includes(section.id)
      );
      return [...inOrder, ...missing];
    })();

    // Canon Toolbar (Slot 1): user-hidden sections drop out of the nav.
    if (hiddenSectionIds.size === 0) return ordered;
    return ordered.filter((section) => !hiddenSectionIds.has(section.id));
  }, [nModeSectionsWithContent, nModeSectionOrder, hiddenSectionIds]);

  useEffect(() => {
    if (orderedNModeSectionsWithContent.length === 0) return;
    if (!orderedNModeSectionsWithContent.some((section) => section.id === activeNSection)) {
      setActiveNSection(orderedNModeSectionsWithContent[0].id);
    }
  }, [orderedNModeSectionsWithContent, activeNSection]);

  // ── Smart Export / Present (Phase A3 + E) ──────────────────────────────────
  // Canonical, presentable sections in nav order, EXCLUDING Comments + Activity
  // Log (records, not deliverable content). Drives Present mode, the export
  // section picker, the markdown builder and the deck-card mapper.
  // HP-17: 'evidence' to żywy panel async (źródła/założenia z API), nie treść
  // deliverable — wyłączony z eksportu/decka jak comments/activity-log.
  const EXPORT_EXCLUDED_SECTION_IDS = useMemo(
    () => new Set(['comments', 'activity-log', 'evidence']),
    []
  );

  const exportableSections = useMemo(
    () =>
      orderedNModeSectionsWithContent.filter(
        (section) => !EXPORT_EXCLUDED_SECTION_IDS.has(section.id)
      ),
    [orderedNModeSectionsWithContent, EXPORT_EXCLUDED_SECTION_IDS]
  );

  const sectionLabel = useCallback(
    (section: NModeSection): string => (isPolish ? section.label.pl : section.label.en),
    [isPolish]
  );

  // Plain-text body for a single canonical section. Pulls from the same reactive
  // state the canvas renders, so exports always mirror what the user sees.
  const buildSectionBody = useCallback(
    (sectionId: string): string => {
      const lines = (arr: { text: string; done?: boolean }[]): string =>
        arr
          .filter((i) => (i.text || '').trim())
          .map((i) => `- ${i.text.trim()}`)
          .join('\n');
      const strLines = (arr: string[]): string =>
        arr
          .filter((s) => (s || '').trim())
          .map((s) => `- ${s.trim()}`)
          .join('\n');

      switch (sectionId) {
        case 'initiative-definition':
          return [
            initiative?.title || initiative?.name
              ? `**${initiative?.title || initiative?.name}**`
              : '',
            (summary || initiative?.summary || initiative?.description || '').toString().trim(),
            inScopeItems.length
              ? `\n_${t('initiatives.inScope4')}_\n${strLines(inScopeItems)}`
              : '',
            outScopeItems.length
              ? `\n_${t('initiatives.outOfScope4')}_\n${strLines(outScopeItems)}`
              : '',
            killCriteriaItems.length
              ? `\n_${t('initiatives.killCriteria8')}_\n${strLines(killCriteriaItems)}`
              : '',
          ]
            .filter(Boolean)
            .join('\n');
        case 'target-state-scope':
          return targetStateItems.length || successCriteriaItems.length
            ? [
                successCriteriaItems.length
                  ? `_${t('initiatives.successCriteria4')}_\n${lines(successCriteriaItems)}`
                  : '',
                targetStateItems.length
                  ? `_${t('initiatives.targetState2')}_\n${lines(targetStateItems)}`
                  : '',
              ]
                .filter(Boolean)
                .join('\n\n')
            : '';
        case 'deliverables-milestones':
          return lines(deliverableItems);
        case 'kpi':
          return localKpis
            .map(
              (k) => `- ${toEnglishKpiName(k.name || '', isPolish)}${k.unit ? ` (${k.unit})` : ''}`
            )
            .join('\n');
        case 'tasks':
          return tasks
            .map((t: any) => `- ${t.title || t.name || ''}`.trim())
            .filter((l) => l !== '-')
            .join('\n');
        case 'decisions':
          return decisions
            .map((d: any) => `- ${d.title || d.name || ''}`.trim())
            .filter((l) => l !== '-')
            .join('\n');
        case 'risk-raid':
          return raidItems
            .map((r: any) => `- [${r.type || 'RAID'}] ${r.title || r.description || ''}`.trim())
            .join('\n');
        case 'okr':
          return okrItems
            .map((o: any) => `- ${o.objective || ''}`.trim())
            .filter((l) => l !== '-')
            .join('\n');
        case 'change-log':
          return changeLogItems
            .map((e: any) => `- ${e.change || e.text || ''}`.trim())
            .filter((l) => l !== '-')
            .join('\n');
        case 'hypothesis':
          return (hypothesisDraft || '').trim();
        case 'lessons-learned':
          return (lessonsDraft || '').trim();
        default:
          return '';
      }
    },
    [
      initiative,
      summary,
      inScopeItems,
      outScopeItems,
      killCriteriaItems,
      targetStateItems,
      successCriteriaItems,
      deliverableItems,
      localKpis,
      tasks,
      decisions,
      raidItems,
      okrItems,
      changeLogItems,
      hypothesisDraft,
      lessonsDraft,
      isPolish,
    ]
  );

  // Markdown across a chosen set of section ids, in canonical (nav) order.
  const buildExportMarkdown = useCallback(
    (sectionIds: Set<string>): string => {
      const title = String(initiative?.title || initiative?.name || 'Initiative').trim();
      const parts: string[] = [`# ${title}`, ''];
      for (const section of exportableSections) {
        if (!sectionIds.has(section.id)) continue;
        const body = buildSectionBody(section.id);
        parts.push(`## ${sectionLabel(section)}`);
        parts.push(body.trim() ? body : t('initiatives.noContent3'));
        parts.push('');
      }
      return parts.join('\n');
    },
    [exportableSections, buildSectionBody, sectionLabel, initiative, isPolish]
  );

  // Map chosen sections → PresentMode DeckCards (canonical order). Title card +
  // one card per section; cSpan drives a heading-level hint.
  const buildDeckCards = useCallback(
    (sectionIds: Set<string>): DeckCard[] => {
      const blankBg = { type: 'theme' as const };
      const blankAnim = { entrance: 'fade' as const, block_stagger: false };
      const mkCard = (
        id: string,
        order: number,
        title: string,
        body: string,
        level: number
      ): DeckCard => {
        const blocks: CardBlock[] = [
          {
            block_id: `${id}-h`,
            card_id: id,
            type: 'heading',
            content: { text: title, level },
            is_refreshable: false,
            position: { area: 'full', order: 0 },
            ai_editable: false,
          },
        ];
        if (body.trim()) {
          blocks.push({
            block_id: `${id}-p`,
            card_id: id,
            type: 'paragraph',
            content: { text: body },
            is_refreshable: false,
            position: { area: 'full', order: 1 },
            ai_editable: false,
          });
        }
        return {
          card_id: id,
          deck_id: `initiative-${initiativeId}`,
          order_index: order,
          intent: 'content',
          layout_id: 'default',
          title,
          blocks,
          source_refs: [],
          has_refreshable_data: false,
          background: blankBg,
          animations: blankAnim,
          is_locked: false,
        };
      };

      const title = String(initiative?.title || initiative?.name || 'Initiative').trim();
      const cards: DeckCard[] = [mkCard('title-card', 0, title, '', 1)];
      let order = 1;
      for (const section of exportableSections) {
        if (!sectionIds.has(section.id)) continue;
        // cSpan>=3 → "feature" section gets a larger heading hint (level 1), else level 2.
        const level = (section.cSpan ?? 1) >= 3 ? 1 : 2;
        cards.push(
          mkCard(section.id, order++, sectionLabel(section), buildSectionBody(section.id), level)
        );
      }
      return cards;
    },
    [exportableSections, buildSectionBody, sectionLabel, initiative, initiativeId]
  );

  const presentDeckCards = useMemo(() => {
    const allIds = new Set(exportableSections.map((s) => s.id));
    return buildDeckCards(allIds);
  }, [exportableSections, buildDeckCards]);

  // Effective export selection: defaults to all exportable sections until the
  // user toggles something.
  const effectiveExportSelection = useMemo(() => {
    if (exportSelectedSectionIds) return exportSelectedSectionIds;
    return new Set(exportableSections.map((s) => s.id));
  }, [exportSelectedSectionIds, exportableSections]);

  const toggleExportSection = useCallback(
    (id: string) => {
      setExportSelectedSectionIds((prev) => {
        const base = prev ?? new Set(exportableSections.map((s) => s.id));
        const next = new Set(base);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [exportableSections]
  );

  const handleExportMarkdown = useCallback(() => {
    setIsExporting('markdown');
    try {
      const md = buildExportMarkdown(effectiveExportSelection);
      const safeName = String(initiative?.title || initiative?.name || 'initiative')
        .replace(/[^\w.-]+/g, '_')
        .slice(0, 80);
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeName || 'initiative'}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(t('initiatives.markdownDownloaded2'));
      setShowExportDialog(false);
    } catch {
      toast.error(t('initiatives.exportFailed2'));
    } finally {
      setIsExporting(null);
    }
  }, [
    buildExportMarkdown,
    effectiveExportSelection,
    initiative,
    isPolish,
    /* + t: tlumaczenia ladowane async — bez tego memo zwraca surowy klucz na stale (2026-07-21) */ t,
  ]);

  const handleExportReportPDF = useCallback(async () => {
    setIsExporting('pdf');
    try {
      const safeName = String(initiative?.title || initiative?.name || 'initiative')
        .replace(/[^\w.-]+/g, '_')
        .slice(0, 80);
      const ok = await exportReportToPDF('initiative-export-printable', safeName || 'initiative');
      if (ok === false) {
        toast.error(t('initiatives.pdfExportFailed2'));
      } else {
        toast.success(t('initiatives.pdfExported2'));
        setShowExportDialog(false);
      }
    } catch {
      toast.error(t('initiatives.pdfExportFailed2'));
    } finally {
      setIsExporting(null);
    }
  }, [initiative, isPolish]);

  const handleExportDeck = useCallback(() => {
    // No server-side deck exists for an ad-hoc initiative, so "Deck" opens the
    // in-app Present mode walk of the selected sections (reuses the same mapping).
    setShowExportDialog(false);
    setPresentationMode('fullscreen');
  }, []);

  const handleExportNotebook = useCallback(async () => {
    setIsExporting('notebook');
    try {
      const md = buildExportMarkdown(effectiveExportSelection);
      await Api.post('/my-work/notebook/pages', {
        title: String(initiative?.title || initiative?.name || 'Initiative'),
        content: md,
        source: 'initiative',
        metadata: {
          initiativeId,
          sectionIds: Array.from(effectiveExportSelection),
        },
      });
      toast.success(t('initiatives.savedToNotebook2'));
      setShowExportDialog(false);
    } catch {
      toast.error(t('initiatives.failedToSaveToNotebook2'));
    } finally {
      setIsExporting(null);
    }
  }, [buildExportMarkdown, effectiveExportSelection, initiative, initiativeId, isPolish]);

  // Fork (Phase A4) — clone the initiative server-side, then deep-link to the copy.
  const handleFork = useCallback(async () => {
    if (isForking) return;
    setIsForking(true);
    try {
      const forked = await V8PlanningApi.forkInitiative(initiativeId);
      const newId = String((forked as any)?.id || '');
      toast.success(t('initiatives.initiativeForked2'));
      if (newId) {
        window.location.assign(
          `${window.location.origin}/initiatives?open=${encodeURIComponent(newId)}&mode=doc`
        );
      }
    } catch (e: any) {
      toast.error(e?.message || t('initiatives.failedToFork2'));
    } finally {
      setIsForking(false);
    }
  }, [isForking, initiativeId, isPolish]);

  // ==========================================
  // CANON TOOLBAR (Warstwa 3) — derived helpers
  // ==========================================

  // Slot 2 — "New ▾": the context create action(s) for the active/relevant
  // section. Reuses the same handlers the old contextGroup buttons called.
  const newMenuActions = useMemo(() => {
    const items: Array<{ id: string; label: { en: string; pl: string }; onClick: () => void }> = [];
    if (contextActions.includes('task')) {
      items.push({
        id: 'new-task',
        label: { en: 'New Task', pl: 'Nowe zadanie' },
        onClick: () => {
          toggleSection('tasks');
          setShowCreateTask(true);
        },
      });
    }
    if (contextActions.includes('decision')) {
      items.push({
        id: 'new-decision',
        label: { en: 'New Decision', pl: 'Nowa decyzja' },
        onClick: () => {
          toggleSection('decisions');
          setShowCreateDecision(true);
        },
      });
    }
    if (contextActions.includes('raid')) {
      items.push({
        id: 'add-raid',
        label: { en: 'Add RAID', pl: 'Dodaj RAID' },
        onClick: () => {
          toggleSection('raid');
          setShowCreateRaid(true);
        },
      });
    }
    return items;
  }, [contextActions, toggleSection, setShowCreateTask, setShowCreateDecision, setShowCreateRaid]);

  // ── JEDEN KEBAB NA EKRANIE (2026-07-24) ────────────────────────────────────
  // BYŁO: kebab „Więcej" w Menu 2 (x≈876) OBOK kebaba Menu 1 (x≈1354) — dwa
  // nieodróżnialne kebaby w jednym rzędzie wzroku i Menu 2 z PIĘCIOMA
  // kontrolkami zamiast trzech (Sekcje · Edycja|Podgląd · Analizuj z AI).
  //
  // DLACZEGO SCALENIE, A NIE USUNIĘCIE: żadna z pozycji tamtego kebaba nie
  // dotyczy KARTY (sekcji) — to akcje całego ARTEFAKTU (Nowe zadanie/decyzja/
  // RAID, Eksport, Wstrzymaj/Anuluj, Archiwizuj, Usuń). Ich dom to Menu 1
  // (tożsamość artefaktu), gdzie już mieszkają „Kopiuj kod/link". Usunięcie
  // skasowałoby zdolności; scalenie tylko zmienia dom — a Menu 2 wraca do
  // kontraktu trzech stref (`NModeMenu2` §props: `overflowKebab` opisany jako
  // wyjątek „dla zdolności bez nowego domu" — ten dom właśnie dostały).
  //
  // Wcześniejszy komentarz przy Menu 2 twierdził, że kebaby „mają różne domy:
  // Menu 1 = akcje artefaktu, Menu 2 = akcje karty". Rozbiór zawartości tego
  // nie potwierdza — ani jedna pozycja nie operowała na aktywnej karcie.
  const menu1ExtraOverflowItems = useMemo(() => {
    const items: Array<{
      id: string;
      label: string;
      icon: React.FC<{ size?: number; className?: string }>;
      onClick: () => void;
      danger?: boolean;
    }> = [];
    // Tworzenie — tylko w Edycji (Podgląd ma być czysty; tak było w Menu 2).
    if (!readMode) {
      for (const item of newMenuActions) {
        items.push({
          id: item.id,
          label: isPolish ? item.label.pl : item.label.en,
          icon: Plus,
          onClick: item.onClick,
        });
      }
    }
    items.push({
      id: 'export',
      label: `${t('initiatives.export2')}…`,
      icon: Download,
      onClick: () => setShowExportDialog(true),
    });
    // Kolejność: neutralne najpierw, dopiero potem grupa destrukcyjna —
    // `NModeHeader` rysuje separator NAD pierwszą pozycją `danger`, więc
    // wstawienie „Archiwizuj" (neutralne) po „Oznacz jako zablokowane"
    // rozbijało tę grupę na dwa kawałki.
    if (canArchiveDoc) {
      items.push({
        id: 'archive',
        label: t('initiatives.archiveAction'),
        icon: Archive,
        onClick: () => void handleArchive(),
      });
    }
    // PODGLĄD = TYLKO CZYTANIE (2026-07-24): przejścia destrukcyjne
    // („Oznacz jako zablokowane", „Anuluj") ZMIENIAJĄ STATUS rekordu, więc
    // znikają razem z resztą akcji. Wcześniej kebab filtrował w Podglądzie
    // tylko „Nowe…"/„Archiwizuj", a tę grupę zostawiał — jedyna aktywna
    // zmiana stanu w menu, które poza tym miało już wyłącznie czytanie.
    for (const sa of readMode ? [] : destructiveStatusActions) {
      items.push({
        id: `status-${sa.targetStatus}`,
        label: isPolish ? sa.labelPl : sa.label,
        icon:
          sa.targetStatus === InitiativeStatus.CANCELLED
            ? XCircle
            : sa.targetStatus === InitiativeStatus.BLOCKED
              ? Ban
              : AlertTriangle,
        onClick: () => void handleStatusAction(sa),
        danger: true,
      });
    }
    if (canDeleteDoc) {
      items.push({
        id: 'delete',
        label: t('initiatives.delete2'),
        icon: Trash2,
        onClick: () => void handleDelete(),
        danger: true,
      });
    }
    return items;
    // `handleStatusAction`/`handleArchive`/`handleDelete` to zwykłe funkcje
    // odtwarzane co render — celowo poza tablicą zależności (identycznie jak
    // w poprzednim, inline'owym kebabie, który czytał je wprost z domknięcia).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    readMode,
    newMenuActions,
    isPolish,
    t,
    destructiveStatusActions,
    canArchiveDoc,
    canDeleteDoc,
    setShowExportDialog,
  ]);

  // Slot 5 — section-level AI: dispatches to the existing per-section request
  // handler for the active section (same calls the old per-section buttons made).
  const activeSectionAiBusy = useMemo(() => {
    switch (activeNSection) {
      case 'tasks':
        return !!tasksAiRequest;
      case 'decisions':
        return !!decisionsAiRequest;
      case 'comments':
        return !!commentsAiRequest;
      case 'resources':
        return !!resourcesAiRequest;
      case 'timeline':
        return !!timelineAiRequest;
      case 'dependencies':
        return !!dependenciesAiRequest;
      case 'kpi':
      case 'kpis':
        return !!kpisAiRequest;
      case 'team':
        return !!teamAiRequest;
      case 'target-state-scope':
      case 'targetState':
        return !!targetStateAiRequest;
      case 'gates':
        return !!gatesAiRequest;
      case 'risk-raid':
        return !!raidAiRequest || isRaidAIProposing;
      case 'initiative-definition':
        return isGeneratingAI === 'scope';
      default:
        return isGeneratingAI === activeNSection;
    }
  }, [
    activeNSection,
    tasksAiRequest,
    decisionsAiRequest,
    commentsAiRequest,
    resourcesAiRequest,
    timelineAiRequest,
    dependenciesAiRequest,
    kpisAiRequest,
    teamAiRequest,
    targetStateAiRequest,
    gatesAiRequest,
    raidAiRequest,
    isRaidAIProposing,
    isGeneratingAI,
  ]);

  // Sections whose section-AI dispatch falls through to handleGenerateAI, which
  // only toasts a fake "AI generated content" success and writes nothing. We must
  // NOT fire that no-op in front of a client — the toolbar AI button is disabled
  // for these instead. Keep this in sync with the real-AI cases in
  // runActiveSectionAi's switch (tasks/decisions/timeline/dependencies/team/kpi/
  // gates/risk-raid/resources/initiative-definition/target-state-scope/comments).
  // financial-analysis / financial-impact → handleGenerateFinancial (real).
  // hypothesis / okr / lessons-learned → K4 real handlers above (removed from no-op).
  // (SSOT = module-level SECTION_AI_NOOP_IDS, reused by the section-content memo.)
  const activeSectionAiUnavailable = SECTION_AI_NOOP_IDS.has(activeNSection);

  // Per-section AI dispatcher, parameterised by section id (used both by the
  // toolbar "AI: section" button for the active section AND by each BCG section
  // card's ✨Regeneruj action). On dispatch we mark the section 'ai-draft' so the
  // NModeCardState badge/action-bar reflects that AI just (re)wrote the card.
  const runSectionAi = useCallback(
    async (sectionId: string) => {
      if (!canUseAi) {
        toast.error(t('initiatives.aiIsUnavailableBecauseYouHave2'));
        return;
      }
      // Optimistically flag AI-draft; the section's own request/handler owns the
      // actual write. Card state is advisory (human still reviews & accepts).
      setSectionState(sectionId, 'ai-draft');
      switch (sectionId) {
        case 'tasks':
          requestTasksAi('analyze');
          return;
        case 'decisions':
          requestDecisionsAi('analyze');
          return;
        case 'comments':
          requestCommentsAi();
          return;
        case 'resources':
          requestResourcesAi();
          return;
        case 'timeline':
          requestTimelineAi();
          return;
        case 'dependencies':
          requestDependenciesAi();
          return;
        case 'kpi':
        case 'kpis':
          requestKpisAi();
          return;
        case 'team':
          requestTeamAi();
          return;
        case 'target-state-scope':
        case 'targetState':
          requestTargetStateAi();
          return;
        case 'gates':
          requestGatesAi();
          return;
        case 'risk-raid':
          requestRaidAi();
          return;
        case 'initiative-definition':
          await handleGenerateScopeCard();
          return;
        case 'financial-analysis':
        case 'financial-impact':
          await handleGenerateFinancial(sectionId);
          return;
        // K4 — AI-fill for sections previously no-op
        case 'hypothesis': {
          const res = await handleGenerateAI('hypothesis');
          if (res?.parsedContent || res?.content) {
            const text = String(res.parsedContent || res.content).trim();
            setHypothesisDraft(text);
            void persistInitiativeField(
              { hypothesisStatement: text },
              { hypothesisStatement: text, hypothesis_statement: text }
            );
          }
          return;
        }
        case 'lessons-learned': {
          const res = await handleGenerateAI('lessons-learned');
          if (res?.parsedContent || res?.content) {
            const text = String(res.parsedContent || res.content).trim();
            setLessonsDraft(text);
            void persistInitiativeField(
              { lessonsLearned: text },
              { lessonsLearned: text, lessons_learned: text }
            );
          }
          return;
        }
        case 'okr': {
          const res = await handleGenerateAI('okr');
          if (res?.parsedContent || res?.content) {
            const raw = res.parsedContent ?? res.content;
            let objectives: Array<{ objective: string; keyResults: string[]; confidence: string }> =
              [];
            try {
              const parsed = typeof raw === 'object' ? raw : JSON.parse(String(raw));
              const arr = Array.isArray(parsed)
                ? parsed
                : ((parsed as any).objectives ?? (parsed as any).okrs ?? []);
              objectives = arr.map((o: any) => ({
                objective: typeof o === 'string' ? o : (o.objective ?? o.title ?? ''),
                keyResults: Array.isArray(o?.keyResults) ? o.keyResults : [],
                confidence: (o?.confidence ?? 'MEDIUM').toUpperCase(),
              }));
            } catch {
              objectives = [
                { objective: String(raw).trim(), keyResults: [], confidence: 'MEDIUM' },
              ];
            }
            if (objectives.length) {
              const now = Date.now();
              const newItems = objectives.map((o, i) => ({ id: `okr-ai-${now}-${i}`, ...o }));
              const next = [...newItems, ...okrItems];
              void persistInitiativeField({ okrs: next }, { okrs: next });
            }
          }
          return;
        }
        default:
          await handleGenerateAI(sectionId);
      }
    },
    [
      canUseAi,
      isPolish,
      handleGenerateFinancial,
      handleGenerateAI,
      handleGenerateScopeCard,
      okrItems,
      persistInitiativeField,
      setHypothesisDraft,
      setLessonsDraft,
      setSectionState,
      requestTasksAi,
      requestDecisionsAi,
      requestCommentsAi,
      requestResourcesAi,
      requestTimelineAi,
      requestDependenciesAi,
      requestKpisAi,
      requestTeamAi,
      requestTargetStateAi,
      requestGatesAi,
      requestRaidAi,
    ]
  );

  // Keep the ref (consumed by the BCG section-card ✨Regeneruj action) pointed at
  // the latest runSectionAi. Lets the section-content memo trigger regeneration
  // without depending on runSectionAi (declared after that memo).
  useEffect(() => {
    runSectionAiRef.current = runSectionAi;
  }, [runSectionAi]);

  // Thin wrapper: the toolbar "AI: section" button targets the active section.
  const runActiveSectionAi = useCallback(
    () => runSectionAi(activeNSection),
    [runSectionAi, activeNSection]
  );

  // Slot 9 — canonical AI Consultant (POZIOM 3 / ARTEFAKT) wiring.
  // contextText = whole-initiative plain-text summary (title + every section
  // heading + its content, in canonical nav order). Reuses the Smart Export
  // markdown builder so the panel chat sees the same SSOT the export does.
  const aiPanelContextText = useMemo(() => {
    if (!aiPanelOpen) return '';
    const allIds = new Set(exportableSections.map((s) => s.id));
    return buildExportMarkdown(allIds);
  }, [aiPanelOpen, exportableSections, buildExportMarkdown]);

  // The 5 canon actions. Refresh is wired to the real per-section generate
  // handler (handleGenerateAI) for the active section. Fill empty / Synthesize /
  // Quality check / Continue route best-effort to the existing section-level AI
  // dispatcher (runActiveSectionAi) — no new backend endpoints are invented; the
  // embedded chat (whole-artifact context) carries the richer intent.
  const aiConsultantActions = useMemo<AIConsultantAction[]>(() => {
    const sectionBusy = activeSectionAiBusy;
    return [
      {
        // Pakiet M7 pkt 5 — jedyne, co zostało po zdjętym z paska przycisku
        // „Propose next steps". Ta sama funkcja (Teresa + kontekst inicjatywy),
        // jedno wejście AI zamiast dwóch nierozróżnialnych (SPEC-N §2.6).
        id: 'next-steps',
        label: 'Propose next steps',
        labelPl: 'Zaproponuj kolejne kroki',
        icon: <ArrowRight size={14} />,
        onClick: () => void handleProposeNextStepsWithAI(),
        busy: false,
      },
      {
        id: 'fill-empty',
        label: 'Fill empty',
        labelPl: 'Uzupełnij puste',
        icon: <Wand2 size={14} />,
        onClick: () => void runActiveSectionAi(),
        busy: sectionBusy,
      },
      {
        id: 'synthesize',
        label: 'Synthesize',
        labelPl: 'Synteza',
        icon: <Layers size={14} />,
        onClick: () => void runActiveSectionAi(),
        busy: sectionBusy,
      },
      {
        id: 'quality-check',
        label: 'Quality check',
        labelPl: 'Kontrola jakości',
        icon: <ShieldCheck size={14} />,
        onClick: () => void runActiveSectionAi(),
        busy: sectionBusy,
      },
      {
        id: 'refresh',
        label: 'Refresh',
        labelPl: 'Odśwież',
        icon: <RotateCcw size={14} />,
        onClick: () => void handleGenerateAI(activeNSection),
        busy: isGeneratingAI === activeNSection,
      },
      {
        id: 'continue',
        label: 'Continue',
        labelPl: 'Kontynuuj',
        icon: <ArrowRight size={14} />,
        onClick: () => void runActiveSectionAi(),
        busy: sectionBusy,
      },
    ];
  }, [
    activeSectionAiBusy,
    runActiveSectionAi,
    handleGenerateAI,
    activeNSection,
    isGeneratingAI,
    handleProposeNextStepsWithAI,
  ]);

  // A11y (SPEC-A, unconditional): Esc closes the artifact (calls onBack), but
  // ONLY when it would otherwise do nothing else — skip when focus is in an
  // editable field (the field owns Esc) or any overlay/dropdown/modal is open
  // (those must close first). Guards prevent Esc from yanking the user out of
  // the whole card mid-edit or while a menu is open.
  const anyOverlayOpen =
    showSectionsMenu ||
    showNewMenu ||
    showExportMenu ||
    showToolbarKebab ||
    showMoreMenu ||
    showStatusDropdown ||
    showPriorityDropdown ||
    showPhaseDropdown ||
    showApprovalWorkflow ||
    aiPanelOpen ||
    isPresenting ||
    showExportDialog ||
    showCreateKpi ||
    showCreateResource ||
    showCreateTask ||
    showCreateDecision ||
    showCreateRaid ||
    showRaidAIModal ||
    showCommentsAIModal;
  useEffect(() => {
    if (!onBack) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (anyOverlayOpen) return;
      const el = document.activeElement as HTMLElement | null;
      if (el) {
        const tag = el.tagName;
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          el.isContentEditable ||
          el.getAttribute('role') === 'textbox'
        ) {
          return;
        }
      }
      onBack();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onBack, anyOverlayOpen]);

  // ════════════════════════════════════════════════════════════════════════
  // PRAWY PANEL ARTEFAKTU (SPEC-N §2.2 · SPEC-A §11.2)
  // ════════════════════════════════════════════════════════════════════════
  //
  // DLACZEGO to powstało: inwentarz A1 wykazał, że Initiative — największa
  // i najważniejsza karta w produkcie — jako JEDYNA z ciężkich kart nie miała
  // prawego panelu W OGÓLE (`ArtifactRightPanel`: 0 użyć w tym pliku).
  // Właściwości leżały jako POZIOMA SIATKA 7 PÓL pod nagłówkiem, a Komentarze
  // i Dziennik aktywności były sekcjami canvas w lewej kolumnie — czyli pod
  // zarezerwowanymi id, których §2.1 tam zabrania.
  //
  // KANONICZNA KOLEJNOŚĆ (§11.2, bez odstępstw):
  //   Akcje · Właściwości · Powiązania · Źródła i założenia · [Rezultaty] ·
  //   Komentarze · Historia   (kanon n-Type = ARTIFACT_PANEL_SECTION_ORDER)
  // Sekcja `evidence` to JEDYNE dozwolone rozszerzenie poza piątkę i zawsze
  // stoi między Powiązaniami a Komentarzami (§2.2).
  //
  // STAN DOMYŚLNY (R3): otwarte są WYŁĄCZNIE „Akcje". Reszta zwinięta.
  //
  // ANTY-DUPLIKACJA (§2.6) — co świadomie NIE trafiło do panelu:
  //   · Zapisz — nagłówek (NModeHeader.onSave) niesie zapis i wskaźnik stanu;
  //     druga kopia to dokładnie defekt, który M4/M5/M6 mają wycinać.
  //   · Primary cyklu życia — Menu 1, jeden slot, bez powtórzeń.
  //   · Eksport i akcje destrukcyjne — kebab paska; nie dublujemy ich tutaj.
  //   · Fork i Tryb pokazu ZESZŁY tu Z PASKA (były ikonami-only z tooltipem):
  //     panel jest widoczny zawsze, pasek chowa je w Podglądzie — więc wg
  //     reguły „zostaje tam, gdzie widać zawsze" ich domem jest panel.
  const initiativeRightPanelSections: ArtifactRightPanelSection[] = useMemo(() => {
    const dash = '—';
    const panelBtn =
      'inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium bg-c-surface-raised text-c-text border border-c-border-subtle hover:bg-c-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] disabled:opacity-50';

    const fmtDateTime = (value?: string | null) => {
      if (!value) return dash;
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return dash;
      // Stały locale zamiast t('...') — klucz z nazwą locale istnieje tylko
      // w pl/en, a w de/es/ja/ar i18next zwraca sam klucz → RangeError
      // i cały ekran w error-boundary (realny wypadek 21.07, InterviewWorkspace).
      return d.toLocaleString(isPolish ? 'pl-PL' : 'en-US', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    };

    const sourceTitle = initiative?.source_title || initiative?.sourceTitle || null;
    // N2 — nawigacja do źródła (Insight/wywiad), którego dotyczy inicjatywa.
    // Ten sam obliczenie co we `Właściwościach` (pole `sourceInsight` powyżej) —
    // tylko obsłużone typy source_type dostają realny href, reszta zostaje
    // czystym tekstem (brak wiarygodnego celu nawigacji).
    const srcType = initiative?.source_type || initiative?.sourceType;
    const srcId = initiative?.source_id || initiative?.sourceId;
    const normalizedSourceType = srcType ? String(srcType).toLowerCase() : '';
    const sourceNavPath =
      srcType &&
      srcId &&
      ['interview', 'interview_insight', 'insight', 'conclusion'].includes(normalizedSourceType)
        ? getArtifactPath('insight', srcId)
        : normalizedSourceType === 'conclusion_readout'
          ? '/presentations?tab=documents'
          : null;
    // Wiersze powiązań — każdy ma odpowiadającą sekcję Menu 2 W TYM SAMYM
    // dokumencie (Zadania/Decyzje/RAID/Artefakty/Załączniki), więc klik = ta
    // sama nawigacja co istniejące pigułki (por. `setActiveNSection('tasks')`
    // przy CTA „Plan"), nie nowy wzorzec.
    const relationRows: { label: string; value: string; sectionId: string }[] = [
      {
        label: t('initiatives.panel.tasks', 'Tasks'),
        value: `${tasksDone}/${tasks.length}`,
        sectionId: 'tasks',
      },
      {
        label: t('initiatives.panel.decisions', 'Decisions'),
        value: String(decisions.length),
        sectionId: 'decisions',
      },
      {
        label: t('initiatives.panel.raid', 'RAID'),
        value: String(raidItems.length),
        sectionId: 'risk-raid',
      },
      {
        label: t('initiatives.artifacts2', 'Artifacts'),
        value: String(relatedArtifacts.length),
        sectionId: 'artifacts',
      },
      {
        label: t('initiatives.panel.attachments', 'Attachments'),
        value: String(attachments.length + linkedItems.length),
        sectionId: 'attachments-links',
      },
    ];
    const hasRelations =
      tasks.length +
        decisions.length +
        raidItems.length +
        relatedArtifacts.length +
        attachments.length +
        linkedItems.length >
        0 || !!sourceTitle;

    return [
      {
        id: 'actions',
        label: t('initiatives.panel.actions', 'Actions'),
        icon: Sparkles,
        // §6.4: sekcja „Akcje" niesie działania NA REKORDZIE. „Utwórz wariant"
        // (odnoga biznesowa — tworzy nową inicjatywę-wariant) zostaje tu.
        // „Tryb pokazu" NIE jest działaniem na rekordzie, tylko sposobem
        // PREZENTACJI wyniku → przeniesiony do sekcji „Rezultaty" (§6.4/§6.5).
        //
        // ── PODGLĄD = TYLKO CZYTANIE (decyzja właściciela 2026-07-24) ──
        // Sekcja jest PUSTA w Podglądzie — dokładnie jak w Zadaniu i Decyzji.
        // Wcześniej stał tu aktywny „Utwórz wariant", czyli akcja TWORZĄCA
        // nowy obiekt w trybie, który ma nic nie zmieniać. Chcesz wariant →
        // przełącz na Edycję. Etap 4 gridu n-Type
        // (_GRID_STABILIZATION_COMMAND_2026-07-24.md): w Podglądzie sekcja jest
        // ZWINIĘTA z licznikiem 0, bez komunikatu opisowego (był tu tekst
        // „Actions are hidden in preview mode" — SSOT go zakazuje wprost).
        defaultOpen: !readMode,
        isEmpty: readMode,
        badge: readMode ? 0 : undefined,
        showZeroBadge: true,
        children: readMode ? null : (
          <div className="flex flex-col gap-2">
            <button type="button" onClick={() => void handleFork()} className={panelBtn}>
              <GitFork size={14} className="text-c-text-muted" />
              {/* Etykieta lokalna, NIE `initiatives.fork2` — tamten klucz niesie
                  ponglish „Forkuj" i jest współdzielony z innymi ekranami, więc
                  jego zmiana wyszłaby poza tę kartę. Tu nazwa jest po polsku
                  i mówi, co się stanie (powstaje nowa inicjatywa-wariant). */}
              {isPolish ? 'Utwórz wariant' : 'Create variant'}
            </button>
            {/* Pkt 10 audytu: „Oznacz gotowe" było PŁYWAJĄCĄ akcją nad treścią
                — poza Menu 1 i poza Menu 2, czyli poza jakąkolwiek strefą
                powłoki. Menu 1 ma zajęty jedyny slot primary (przejście cyklu
                życia), więc zgodnie z §6.4 akcja ląduje w „Akcjach" panelu.
                Dotyczy AKTYWNEJ sekcji, więc etykieta ją nazywa.
                W Podglądzie ukryta — to sygnał redakcyjny, nie treść. */}
            {!readMode && activeNSection !== 'activity-log' && activeNSection !== 'comments' ? (
              <button
                type="button"
                onClick={() => handleToggleSectionComplete(activeNSection)}
                className={panelBtn}
                title={
                  sectionCompletions[activeNSection]
                    ? t('initiatives.markSectionAsNotComplete2')
                    : t('initiatives.markSectionAsComplete2')
                }
              >
                {sectionCompletions[activeNSection] ? (
                  <Undo2 size={14} className="text-c-text-muted" />
                ) : (
                  <CheckCircle2 size={14} className="text-c-text-muted" />
                )}
                {sectionCompletions[activeNSection]
                  ? t('initiatives.reopen2')
                  : t('initiatives.markComplete2')}
              </button>
            ) : null}
          </div>
        ),
      },
      {
        id: 'properties',
        label: t('initiatives.panel.properties', 'Properties'),
        icon: Flag,
        defaultOpen: true,
        children: (
          // Pola pochodzą z `nModePropertyFields` — TEJ SAMEJ tablicy, którą
          // wcześniej konsumował NModePropertiesStrip. Renderujemy je przez ich
          // własne `render()`, więc status/priorytet/właściciel/termin
          // pozostają EDYTOWALNE dokładnie jak w siatce. To przeniesienie
          // miejsca, nie zamiana na tekst tylko-do-odczytu.
          //
          // Rama tabeli (nagłówek Property/Value, ramki, ostatni wiersz bez
          // dolnej linii) = `ArtifactPropertiesTable` — TA SAMA co Task/Decision/
          // Insight (akcept Piotra 2026-07-22). Karta dostarcza tylko rows.
          <ArtifactPropertiesTable
            propertyLabel={t('initiatives.panel.property', 'Property')}
            valueLabel={t('initiatives.panel.value', 'Value')}
            rows={nModePropertyFields.map((field) => ({
              id: field.id,
              label: isPolish ? field.label.pl : field.label.en,
              mono: field.id === 'targetDate',
              value: (
                // BYŁO: nakładka klas neutralizująca chrome kontrolki
                // (`[&_select]:appearance-none …`) — hack, bo pola przyszły
                // z poziomego paska właściwości i renderowały się jako ciemne
                // prostokąty. JEST: `render()` każdego pola zwraca już gotową
                // neutralną pigułkę (Edycja dokłada przezroczystą nakładkę
                // kontrolki), więc neutralizator jest zbędny — a jego reguły
                // `w-auto/h-auto` kolidowały z `inset-0` nakładek.
                <span className="inline-flex max-w-full items-center justify-end">
                  {field.render ? field.render() : String(field.value ?? dash)}
                </span>
              ),
            }))}
          />
        ),
      },
      {
        id: 'relations',
        label: t('initiatives.panel.relations', 'Relations'),
        icon: Link2,
        defaultOpen: false,
        isEmpty: !hasRelations,
        emptyLabel: t('initiatives.panel.noRelations', 'No relations'),
        children: (
          <div className="flex flex-col gap-1">
            {sourceTitle ? (
              sourceNavPath ? (
                // Źródło ma realny cel (Insight/wywiad) — klikalny link,
                // ten sam href co pole „Źródło" we Właściwościach powyżej.
                <a
                  href={sourceNavPath}
                  title={t('initiatives.initiativeDocumentView.openSourceTitle', {
                    title: sourceTitle,
                  })}
                  className="flex items-center justify-between gap-2 -mx-1.5 px-1.5 py-1 rounded-lg text-c-info hover:bg-c-surface-raised transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
                >
                  <span className="text-xs text-c-text-muted shrink-0">
                    {t('initiatives.panel.source', 'Source')}
                  </span>
                  <span className="inline-flex items-center gap-1 min-w-0">
                    <span className="text-xs truncate">{sourceTitle}</span>
                    <ExternalLink size={10} className="shrink-0 opacity-60" />
                  </span>
                </a>
              ) : (
                // Brak wiarygodnego source_type/source_id → zostaje tekstem
                // (nawigacja donikąd byłaby gorsza niż licznik).
                <div className="flex items-center justify-between gap-2 px-1.5 py-1">
                  <span className="text-xs text-c-text-muted shrink-0">
                    {t('initiatives.panel.source', 'Source')}
                  </span>
                  <span className="text-xs text-c-text truncate">{sourceTitle}</span>
                </div>
              )
            ) : null}
            {relationRows.map((row) => (
              <button
                key={row.label}
                type="button"
                onClick={() => {
                  // MARTWY KLIK (2026-07-22): przy zwężeniu etap-2 sekcje spoza
                  // rdzenia (RAID/Artefakty/Decyzje/Załączniki…) są schowane
                  // (`hiddenSectionIds`) — samo `setActiveNSection` na schowaną
                  // sekcję cofa efekt niżej (8896-8901) z powrotem na pierwszą
                  // widoczną. Odkryj cel PRZED nawigacją (ten sam wzorzec co
                  // `onPlanTasks` wyżej), tylko na jawny klik użytkownika —
                  // seed-zwężenie (one-shot, 8862-8875) zostaje nietknięte.
                  setHiddenSectionIds((prev) => {
                    if (!prev.has(row.sectionId)) return prev;
                    const next = new Set(prev);
                    next.delete(row.sectionId);
                    return next;
                  });
                  setActiveNSection(row.sectionId);
                }}
                // Brak dedykowanego klucza i18n dla tego tooltipu — budujemy
                // go wprost z `isPolish` (ten sam wzorzec co pola właściwości
                // powyżej), żeby nie ciągnąć angielskiego fallbacku do PL UI.
                title={isPolish ? `Otwórz: ${row.label}` : `Open: ${row.label}`}
                className="flex items-center justify-between gap-2 -mx-1.5 px-1.5 py-1 rounded-lg text-left hover:bg-c-surface-raised transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
              >
                <span className="text-xs text-c-text-muted shrink-0">{row.label}</span>
                <span className="text-xs text-c-info tabular-nums">{row.value}</span>
              </button>
            ))}
          </div>
        ),
      },
      {
        // SPEC-N §2.2/§4A — warstwa dowodowa. Decyzja właściciela P2: dla
        // Initiative OBOWIĄZKOWA. Sekcja jest bezwarunkowa; gdy dowodów nie ma,
        // EvidencePanelSection pokazuje uczciwy stan pusty („Brak
        // zarejestrowanych źródeł i założeń"). Sekcja UKRYTA byłaby gorsza niż
        // pusta: ukrywanie sugeruje, że pytanie „skąd to wiecie?" nie istnieje.
        id: 'evidence',
        label: t('initiatives.panel.evidence', 'Sources & assumptions'),
        icon: FileSearch,
        defaultOpen: false,
        children: (
          <EvidencePanelSection
            artifactType="initiative"
            artifactId={initiativeId}
            isPolish={isPolish}
          />
        ),
      },
      {
        // §6.5: sekcja „Rezultaty" — inicjatywa generuje prezentację (card-walk
        // przez PresentMode) i inne wyniki. Tu mieszka działanie PREZENTACYJNE
        // („Tryb pokazu"), zdjęte z „Akcji" zgodnie z §6.4. Pozycja KANONICZNA
        // §7.2: Akcje · Właściwości · Powiązania · Źródła i założenia · REZULTATY
        // · Komentarze · Historia (pozycja 5 — nie tuż po Akcjach).
        id: 'outcomes',
        label: t('initiatives.panel.outcomes', 'Outcomes'),
        icon: Presentation,
        defaultOpen: false,
        children: (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setPresentationMode('fullscreen')}
              className={panelBtn}
            >
              <Monitor size={14} className="text-c-text-muted" />
              {t('initiatives.panel.presentationMode', 'Presentation mode')}
            </button>
          </div>
        ),
      },
      {
        id: 'comments',
        label: t('initiatives.panel.comments', 'Comments'),
        icon: MessageSquare,
        defaultOpen: false,
        badge: comments.length,
        children: (
          <div className="flex flex-col gap-3">
            {nModeComments.length === 0 ? (
              <p className="text-xs italic text-c-text-muted">
                {t('initiatives.panel.noComments', 'No comments')}
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {nModeComments.slice(0, 8).map((c) => (
                  <li key={c.id} className="flex flex-col gap-0.5 group/comment">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-semibold text-c-text truncate">
                        {c.authorName || t('initiatives.panel.user', 'User')}
                      </span>
                      <span className="flex items-center gap-1 shrink-0">
                        <span className="text-[11px] text-c-text-muted tabular-nums">
                          {fmtDateTime(c.createdAt)}
                        </span>
                        {/* Usuwanie komentarza — było w CommentsCanvas
                            (`onDeleteComment`). Bez tego zejście komentarzy do
                            panelu odebrałoby użytkownikowi zdolność, a reguła
                            mówi: znika DUPLIKAT, nie funkcja. */}
                        {canEditCards ? (
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(c.id)}
                            aria-label={t('initiatives.panel.deleteComment', 'Delete comment')}
                            title={t('initiatives.panel.deleteComment', 'Delete comment')}
                            className="p-0.5 rounded text-c-text-muted opacity-0 group-hover/comment:opacity-100 focus-visible:opacity-100 hover:text-c-danger transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
                          >
                            <Trash2 size={12} />
                          </button>
                        ) : null}
                      </span>
                    </div>
                    <p className="text-xs text-c-text-muted line-clamp-3">{c.content}</p>
                  </li>
                ))}
              </ul>
            )}
            {/* Kompozytor ZOSTAJE w panelu — bez niego zejście komentarzy
                z canvas do panelu byłoby utratą funkcji, a nie przeniesieniem
                (§2.6: znika duplikat, nie zdolność). */}
            {canEditCards ? (
              <div className="flex flex-col gap-2 pt-1 border-t border-c-border-subtle">
                <textarea
                  value={nCommentDraft}
                  onChange={(e) => setNCommentDraft(e.target.value)}
                  rows={2}
                  placeholder={t('initiatives.panel.commentPlaceholder', 'Add a comment…')}
                  className="w-full rounded-lg border border-c-border-subtle bg-transparent px-2 py-1.5 text-xs text-c-text placeholder:text-c-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] resize-y"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleNModeSubmitComment}
                    disabled={!nCommentDraft.trim()}
                    className={`${panelBtn} flex-1`}
                  >
                    {t('initiatives.panel.addComment', 'Add')}
                  </button>
                  <button
                    type="button"
                    onClick={() => requestCommentsAi()}
                    disabled={!canUseAi || isCommentsAIProposing}
                    title={t('initiatives.panel.analyzeComments', 'Analyze comments with AI')}
                    className={panelBtn}
                  >
                    {isCommentsAIProposing ? (
                      <Loader2 size={14} className="animate-spin text-c-info" />
                    ) : (
                      <Sparkles size={14} className="text-c-info" />
                    )}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ),
      },
      {
        id: 'history',
        label: t('initiatives.panel.history', 'History'),
        icon: History,
        defaultOpen: false,
        badge: nModeActivityEntries.length,
        isEmpty: nModeActivityEntries.length === 0,
        emptyLabel: t('initiatives.panel.noHistory', 'No history'),
        children: (
          <ul className="flex flex-col gap-2.5">
            {nModeActivityEntries.slice(0, 10).map((entry) => {
              const meta = nModeActivityTypeMeta(entry.type);
              return (
                <li key={entry.id} className="flex items-start gap-2">
                  <span className="shrink-0 mt-0.5 text-c-text-muted">{meta.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs text-c-text truncate">{entry.description}</span>
                      <span className="text-[11px] text-c-text-muted shrink-0 tabular-nums">
                        {fmtDateTime(entry.timestamp)}
                      </span>
                    </div>
                    {entry.oldValue || entry.newValue ? (
                      <span className="text-[11px] text-c-text-muted truncate">
                        {entry.oldValue ?? dash} → {entry.newValue ?? dash}
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ),
      },
    ];
  }, [
    isPolish,
    t,
    initiative,
    initiativeId,
    nModePropertyFields,
    nModeComments,
    nModeActivityEntries,
    nModeActivityTypeMeta,
    comments.length,
    tasks.length,
    tasksDone,
    decisions.length,
    raidItems.length,
    relatedArtifacts.length,
    attachments.length,
    linkedItems.length,
    canEditCards,
    canUseAi,
    isCommentsAIProposing,
    nCommentDraft,
    handleFork,
    handleNModeSubmitComment,
    handleDeleteComment,
    requestCommentsAi,
    setActiveNSection,
  ]);

  // ── Pasek stanu zatwierdzenia = `statusBar` PRAWEGO PANELU (nie sierota) ───
  // BYŁO: `ArtifactApprovalStatusBar` renderowany inline MIĘDZY Menu 1 a Menu 2,
  // czyli w miejscu, którego powłoka artefaktu nie przewiduje. Efekt zmierzony
  // 2026-07-23: 68 px pustej dziury nad Menu 2 (inne karty: 0–8 px), pasek
  // wyrównany do lewej i bez ramki — „sierocy Draft".
  // JEST: dokładnie ta sama droga co w Decyzji (DecisionDetailView) — slot
  // `statusBar` w `ArtifactRightPanel`, który komponent sam obramowuje
  // (`border-b px-4 py-3`). Jedna deklaracja obsługuje OBIE gęstości (N i C).
  // Flaga OFF → `undefined` → panel renderuje się 1:1 jak wcześniej.
  //
  // ── 2026-07-24: BRAMKA `status === DRAFT` DOŁOŻONA ────────────────────────
  // Pasek pokazywał pigułkę „Szkic" na inicjatywie, której własny status
  // (Menu 1 + Właściwości) brzmiał „W realizacji". Powód: pasek czyta WŁASNY
  // rekord HP-7 i przy jego braku (albo błędzie endpointu) spada na
  // `state ?? 'draft'` — czyli ZMYŚLA „Szkic". Dopóki nie przyjmuje stanu
  // z zewnątrz, mountujemy go tylko wtedy, gdy własny cykl życia karty JEST
  // szkicem — wtedy oba napisy mówią to samo. Poza szkicem prawdą jest status
  // karty. (Podglądu nie bramkujemy tu osobno jak w Decyzji: `hideSubmitAction`
  // już zdejmuje jedyną akcję, więc pasek niesie wyłącznie STAN.)
  const artifactApprovalStatusBar =
    isArtifactApprovalUiEnabled() && initiativeId && status === InitiativeStatus.DRAFT ? (
      <ArtifactApprovalStatusBar
        artifactType="initiative"
        artifactId={initiativeId}
        currentUserId={currentUser?.id}
        canReview
        /* Menu 1 (NModeHeader.primaryAction) niesie JUŻ tę samą akcję cyklu
           życia („Prześlij do przeglądu") — bez tego przycisk renderował się
           dwa razy (zgłoszenie Piotra 2026-07-21). Pasek zostaje: niesie STAN. */
        hideSubmitAction
      />
    ) : undefined;

  // ── ETAP 3 standardu n-Type: „Analizuj z AI" AKTYWNEJ KARTY ────────────────
  // Kryteria oceny Inicjatywy (kontrakt właściciela 2026-07-23) żyją w rubryce
  // silnika (`ARTIFACT_CRITERIA.initiative`): jasność celu · zakres i wyłączenia ·
  // jakość KPI · kryteria sukcesu · kompletność zadań · zależności · ryzyka ·
  // zgodność z decyzją/insightem źródłowym · gotowość do bramy.
  //
  // TREŚĆ KARTY czytamy przez ISTNIEJĄCE `buildSectionBody(sectionId)` — ten sam
  // ekstraktor, którego używa eksport, więc analiza widzi DOKŁADNIE to, co widzi
  // użytkownik i co wychodzi w dokumencie. Zero drugiego, rozjeżdżającego się
  // odczytu. Osobno deklarujemy pola ZAPISYWALNE — tylko tam, gdzie karta ma
  // realny setter drafta.
  const initiativeAnalysisFields = useMemo<CardAnalysisField[]>(() => {
    const asList = (items: { text: string }[]) =>
      items
        .filter((i) => (i.text || '').trim())
        .map((i) => `- ${i.text.trim()}`)
        .join('\n');
    const asStrList = (items: string[]) =>
      items
        .filter((s) => (s || '').trim())
        .map((s) => `- ${s.trim()}`)
        .join('\n');

    switch (activeNSection) {
      case 'initiative-definition':
        return [
          {
            id: 'symptom',
            label: isPolish ? 'Problem' : 'Problem',
            value: symptomDraft,
            kind: 'text',
            writable: true,
          },
          {
            id: 'rootCause',
            label: isPolish ? 'Proponowane rozwiązanie' : 'Proposed solution',
            value: rootCauseDraft,
            kind: 'text',
            writable: true,
          },
          {
            id: 'costOfInaction',
            label: isPolish ? 'Koszt zaniechania' : 'Cost of inaction',
            value: costOfInactionDraft,
            kind: 'text',
            writable: true,
          },
          {
            id: 'marketContext',
            label: isPolish ? 'Kontekst rynkowy' : 'Market context',
            value: marketContextDraft,
            kind: 'text',
            writable: true,
          },
        ];

      case 'target-state-scope':
        return [
          {
            id: 'successCriteria',
            label: isPolish ? 'Kryteria sukcesu' : 'Success criteria',
            value: asList(successCriteriaItems),
            kind: 'list',
            writable: true,
          },
          {
            id: 'targetState',
            label: isPolish ? 'Stan docelowy' : 'Target state',
            value: asList(targetStateItems),
            kind: 'list',
            writable: true,
          },
          {
            id: 'deliverables',
            label: isPolish ? 'Produkty' : 'Deliverables',
            value: asList(deliverableItems),
            kind: 'list',
            writable: true,
          },
          {
            id: 'inScope',
            label: isPolish ? 'W zakresie' : 'In scope',
            value: asStrList(inScopeItems),
            kind: 'list',
            writable: true,
          },
          {
            id: 'outScope',
            label: isPolish ? 'Poza zakresem' : 'Out of scope',
            value: asStrList(outScopeItems),
            kind: 'list',
            writable: true,
          },
          {
            id: 'killCriteria',
            label: isPolish ? 'Kryteria zatrzymania' : 'Kill criteria',
            value: asStrList(killCriteriaItems),
            kind: 'list',
            writable: true,
          },
        ];

      default:
        // Pozostałe karty (Zadania, KPI, RAID, Bramy, Finanse, Zespół…) niosą
        // OBIEKTY z własnymi bramkami zapisu i powiązaniami po id — dopisanie
        // ich prozą stworzyłoby atrapę wyglądającą jak dane. Analiza czyta je
        // przez `buildSectionBody`, ale nie proponuje zapisu.
        return [
          {
            id: `${activeNSection}-readonly`,
            label: (() => {
              const s = orderedNModeSectionsWithContent.find((x) => x.id === activeNSection);
              return s ? (isPolish ? s.label.pl : s.label.en) : activeNSection;
            })(),
            value: buildSectionBody(activeNSection),
            kind: 'text',
            writable: false,
          },
        ];
    }
  }, [
    activeNSection,
    isPolish,
    symptomDraft,
    rootCauseDraft,
    costOfInactionDraft,
    marketContextDraft,
    successCriteriaItems,
    targetStateItems,
    deliverableItems,
    inScopeItems,
    outScopeItems,
    killCriteriaItems,
    orderedNModeSectionsWithContent,
    buildSectionBody,
  ]);

  const initiativeWritableFieldIds = useMemo(
    () => initiativeAnalysisFields.filter((f) => f.writable).map((f) => f.id),
    [initiativeAnalysisFields]
  );

  const buildInitiativeAnalysisInput = useCallback(() => {
    const ctx = [
      `${isPolish ? 'Status' : 'Status'}: ${status}`,
      `${isPolish ? 'Priorytet' : 'Priority'}: ${priority}`,
      `${isPolish ? 'Zadania' : 'Tasks'}: ${tasks.length}`,
      `${isPolish ? 'KPI' : 'KPIs'}: ${localKpis.length}`,
      // „gotowość do bramy" bez treści karty Bram byłaby zgadywaniem.
      activeNSection !== 'gates'
        ? `${isPolish ? 'Bramy' : 'Gates'}:\n${buildSectionBody('gates') || '—'}`
        : '',
      activeNSection !== 'initiative-definition'
        ? `${isPolish ? 'Definicja inicjatywy' : 'Initiative definition'}:\n${buildSectionBody('initiative-definition')}`
        : '',
      activeNSection !== 'target-state-scope'
        ? `${isPolish ? 'Stan docelowy i zakres' : 'Target state & scope'}:\n${buildSectionBody('target-state-scope')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    return {
      artifactType: 'initiative' as const,
      cardId: activeNSection,
      artifactTitle: initiative?.name || initiative?.title || '',
      artifactContext: ctx,
      fields: initiativeAnalysisFields,
      isPolish,
    };
  }, [
    activeNSection,
    isPolish,
    initiative,
    status,
    priority,
    tasks,
    localKpis,
    buildSectionBody,
    initiativeAnalysisFields,
  ]);

  const applyInitiativeAnalysisChange = useCallback(
    (change: CardAnalysisChange): boolean => {
      if (readMode) return false;
      const newId = () => Math.random().toString(36).slice(2, 11);
      const linesOf = (text: string) =>
        String(text || '')
          .split('\n')
          .map((l) =>
            l
              .trim()
              .replace(/^(?:[-*•]\s+|\d+[.)]\s+)/, '')
              .trim()
          )
          .filter(Boolean);

      /** Listy „checklist-owe" ({id,text,done}) — wspólne scalanie. */
      const applyItemList = (
        setter: React.Dispatch<React.SetStateAction<{ id: string; text: string; done: boolean }[]>>
      ): boolean => {
        const incoming = linesOf(change.proposedValue);
        if (incoming.length === 0) return false;
        setter((prev) =>
          change.mode === 'append'
            ? [
                ...prev,
                ...incoming
                  .filter(
                    (line) => !prev.some((p) => p.text.trim().toLowerCase() === line.toLowerCase())
                  )
                  .map((text) => ({ id: newId(), text, done: false })),
              ]
            : incoming.map((text) => ({ id: newId(), text, done: false }))
        );
        return true;
      };

      /** Listy tekstowe (zakres/wyłączenia/kryteria zatrzymania). */
      const applyStrList = (setter: React.Dispatch<React.SetStateAction<string[]>>): boolean => {
        const incoming = linesOf(change.proposedValue);
        if (incoming.length === 0) return false;
        setter((prev) =>
          change.mode === 'append'
            ? [
                ...prev,
                ...incoming.filter(
                  (line) => !prev.some((p) => p.trim().toLowerCase() === line.toLowerCase())
                ),
              ]
            : incoming
        );
        return true;
      };

      switch (change.fieldId) {
        case 'symptom':
          setSymptomDraft((prev) => mergeChangeValue(change, prev));
          return true;
        case 'rootCause':
          setRootCauseDraft((prev) => mergeChangeValue(change, prev));
          return true;
        case 'costOfInaction':
          setCostOfInactionDraft((prev) => mergeChangeValue(change, prev));
          return true;
        case 'marketContext':
          setMarketContextDraft((prev) => mergeChangeValue(change, prev));
          return true;
        case 'successCriteria':
          return applyItemList(setSuccessCriteriaItems);
        case 'targetState':
          return applyItemList(setTargetStateItems);
        case 'deliverables':
          return applyItemList(setDeliverableItems);
        case 'inScope':
          return applyStrList(setInScopeItems);
        case 'outScope':
          return applyStrList(setOutScopeItems);
        case 'killCriteria':
          return applyStrList(setKillCriteriaItems);
        default:
          return false;
      }
    },
    [readMode]
  );

  const initiativeCardAnalysis = useCardAIAnalysis({
    activeCardId: activeNSection,
    buildInput: buildInitiativeAnalysisInput,
    applyChange: applyInitiativeAnalysisChange,
  });

  // ==========================================
  // LOADING & ERROR STATES
  // ==========================================

  if (isLoading) {
    // SPEC-A (VF1, flag default OFF): content-shaped record skeleton instead of
    // a bare centered spinner, so the load reads as "an initiative card is
    // arriving" rather than a generic wait. OFF = the original spinner, 1:1.
    if (isVf1InitSpecAEnabled()) {
      return (
        <div className="h-full overflow-y-auto bg-c-bg">
          {/* Ta sama geometria co karta po załadowaniu (px-6 pt-4 pb-6 NA ZEWNĄTRZ
              limitu) — inaczej szkielet stoi w innym miejscu niż treść, która go
              zastąpi, i wejście na kartę „przeskakuje". */}
          <div className="px-6 pt-4 pb-6">
            <div className="max-w-6xl mx-auto">
              <SkeletonState variant="record" />
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingState variant="spinner" className="py-0" />
      </div>
    );
  }

  if (error || !initiative) {
    const message = error || t('initiatives.document.notFound', 'Initiative not found');
    // SPEC-A (VF1, flag default OFF): whole-surface ErrorState with a clear exit
    // (retry + go back). Description is a fixed human sentence — never the raw
    // `message` (SPEC-A ErrorState hard rule). OFF = the original HubWorkAreaLoadError.
    if (isVf1InitSpecAEnabled()) {
      return (
        <ErrorState
          title={t('initiatives.document.failedToLoad', 'Failed to load initiative card.')}
          description={t(
            'initiatives.document.loadFailedDesc',
            'The card may have been moved or removed, or the connection dropped. Try again, or go back.'
          )}
          onRetry={() => {
            void fetchAll();
          }}
          onBack={onBack || undefined}
        />
      );
    }
    return (
      <HubWorkAreaLoadError
        title={t('initiatives.document.failedToLoad', 'Failed to load initiative card.')}
        message={message}
        errorCode={errorCode}
        retryLabel={t('initiatives.document.retry', 'Retry')}
        dismissLabel={t('initiatives.document.goBack', 'Go back')}
        onRetry={() => {
          void fetchAll();
        }}
        onDismiss={onBack || (() => {})}
      />
    );
  }

  // C-MODE (ClickUp-style): the LIVE C-mode render. Reached when the NModeHeader
  // presentation-mode toggle (rendered below in the 'n' branch) switches to 'c'.
  // PresentationMode is strictly 'n' | 'c', so this early return owns all of C-mode;
  // the InitiativeCompactPanel renders the compact card/scroll surface. (Verified W2-30c.)
  // NOTE: the "legacy D-mode cards + scroll" block further down (the ternary's else
  // branch) is dead code — 'c' is fully handled here before that ternary is reached.
  if (densityMode === 'c') {
    // Standard C (ClickUp-style dense board) — unified with the Insight detail
    // view via the shared NModeCBoard, driven by the SAME section data as the
    // N-mode left-nav/canvas. Header keeps the mode toggle so the user can flip
    // back to N. (The legacy InitiativeCompactPanel is retained in the module
    // for the portfolio quick-peek drawer; this detail surface now uses the
    // standard board — owner decision 2026-06-06.)
    return (
      <InitiativeContext.Provider value={contextValue}>
        <div className="h-full overflow-y-auto bg-c-bg">
          <div className="min-h-screen">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <NModeHeader
                title={titleDraft || initiative?.name || ''}
                onTitleChange={setTitleDraft}
                titleReadOnly={!canEditCards}
                titleInputId={titleInputId}
                artifactId={initiativeId}
                artifactType="initiative"
                onSave={() => handleSave(false)}
                saving={isMutating}
                isDirty={hasUnsavedChanges}
                onClose={onBack || (() => {})}
                statusLabel={statusPillLabel}
                statusTone={statusPillTone}
                presentationMode={densityMode}
                onPresentationModeChange={setDensityMode}
                // ETAP 1.1 n-Type: karta N ma JEDEN widok — bez przełącznika N/C.
                showModeSwitcher={false}
                buildArtifactCode={(type: string, id: string) => buildArtifactCode(type as any, id)}
                primaryAction={
                  primaryLifecycleAction
                    ? {
                        label: {
                          en: primaryLifecycleAction.label,
                          pl: primaryLifecycleAction.labelPl,
                        },
                        icon: ArrowRight,
                        onClick: () => void handleStatusAction(primaryLifecycleAction),
                        disabled: isMutating,
                      }
                    : undefined
                }
              />

              {/* SPEC-N §2.2 — panel jest częścią POWŁOKI, więc obowiązuje
                  w OBU gęstościach (N i C), nie tylko w N. Pozioma siatka
                  właściwości zniknęła też tutaj — pola żyją w sekcji
                  „Właściwości" panelu.
                  GRID ETAP 6 (2026-07-24, naprawa P0-1): BEZ `hidden xl:block`
                  (wzorzec z Powiadomienia, NotificationDetailView.tsx:4196) —
                  ukrywanie panelu <1280 zabierało Akcje/Właściwości/
                  Komentarze/Historię na 1024px. */}
              <div className="col-span-full mt-4 flex gap-4 items-start">
                <div className="flex-1 min-w-0 space-y-0">
                  <NModeCBoard sections={orderedNModeSectionsWithContent} />
                </div>
                <div className="shrink-0 sticky top-6 self-start">
                  <ArtifactRightPanel
                    sections={initiativeRightPanelSections}
                    className={ARTIFACT_PANEL_CARD_CLASS_STICKY}
                    ariaLabel={t('initiatives.panel.ariaLabel', 'Initiative details')}
                    statusBar={artifactApprovalStatusBar}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </InitiativeContext.Provider>
    );
  }

  // ==========================================
  // RENDER
  // ==========================================

  // Liczniki zaznaczeń dla modala propozycji AI komentarzy. Były lokalne
  // w `case 'comments'` — po zejściu komentarzy do prawego panelu (SPEC-N §2.1)
  // modal renderuje się w korzeniu, więc liczniki muszą być tutaj.
  const commentsAiSelectedAddCount = commentsAiProposal
    ? commentsAiProposal.add.reduce(
        (sum, _a, idx) => sum + (commentsAiSelectedAddIdx[idx] ? 1 : 0),
        0
      )
    : 0;
  const commentsAiSelectedRemoveCount = commentsAiProposal
    ? commentsAiProposal.remove.reduce(
        (sum, r) => sum + (commentsAiSelectedRemoveIds[r.commentId] ? 1 : 0),
        0
      )
    : 0;

  return (
    <InitiativeContext.Provider value={contextValue}>
      {showRaidAIModal && raidAiProposal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-3xl rounded-2xl bg-c-surface/95 backdrop-blur-xl shadow-2xl">
            <div className="flex items-start justify-between px-5 py-4 border-b border-c-border-subtle">
              <div>
                <h3 className="text-sm font-semibold text-c-text">
                  {t('initiatives.proposedRaidChangesAi2')}
                </h3>
                <p className="text-[11px] text-c-text-muted mt-0.5">
                  {t('initiatives.selectItemsToAddRemoveThen2')}
                </p>
              </div>
              <button
                onClick={closeRaidAIModal}
                className="p-2 rounded-lg text-c-text-muted hover:text-c-text-secondary dark:hover:text-c-text-muted hover:bg-c-surface-raised transition-colors"
                title={t('initiatives.close2')}
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-5 py-4 max-h-[65vh] overflow-y-auto space-y-5">
              {raidAiNoSuggestionsMessage ? (
                <Callout variant="purple" compact title={t('initiatives.ai2')}>
                  {raidAiNoSuggestionsMessage}
                </Callout>
              ) : null}

              <div className="rounded-xl bg-c-surface-raised dark:bg-c-bg/20 p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-c-text-secondary">
                    {t('initiatives.toRemove2')} ({raidAiProposal.remove.length})
                  </span>
                  {raidAiProposal.remove.length > 0 && (
                    <button
                      onClick={() =>
                        setRaidAiSelectedRemoveIds(
                          Object.fromEntries(
                            raidAiProposal.remove.map((r) => [r.raidId, true])
                          ) as Record<string, boolean>
                        )
                      }
                      className="text-[11px] text-c-text-muted hover:text-c-text-secondary dark:hover:text-c-text-muted"
                    >
                      {t('initiatives.selectAll2')}
                    </button>
                  )}
                </div>

                {raidAiProposal.remove.length === 0 ? (
                  <EmptyStateInline
                    icon={Trash2}
                    dashed={false}
                    className="p-5"
                    message={t('initiatives.noRemovalSuggestionsFromAi2')}
                    hint={t('initiatives.ifTheRaidLogIsAlready2')}
                  />
                ) : (
                  <div className="space-y-1.5">
                    {raidAiProposal.remove.map((r) => {
                      const existing = raidItems.find(
                        (x: any) => String(x?.id) === String(r.raidId)
                      );
                      return (
                        <label
                          key={r.raidId}
                          className="flex items-start gap-2 p-2 rounded-xl bg-amber-50/40 dark:bg-amber-500/5 hover:bg-amber-50/70 dark:hover:bg-amber-500/10 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={!!raidAiSelectedRemoveIds[r.raidId]}
                            onChange={(e) =>
                              setRaidAiSelectedRemoveIds((prev) => ({
                                ...prev,
                                [r.raidId]: e.target.checked,
                              }))
                            }
                            className="mt-1"
                          />
                          <div className="min-w-0">
                            <span className="text-sm font-medium text-c-text">
                              {existing?.title || r.raidId}
                            </span>
                            <p className="text-xs text-amber-800/90 dark:text-amber-200 mt-0.5">
                              {r.reason}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-xl bg-c-surface-raised dark:bg-c-bg/20 p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-c-text-secondary">
                    {t('initiatives.toAdd2')} ({raidAiProposal.add.length})
                  </span>
                  {raidAiProposal.add.length > 0 && (
                    <button
                      onClick={() =>
                        setRaidAiSelectedAddIdx(
                          Object.fromEntries(
                            raidAiProposal.add.map((_, idx) => [idx, true])
                          ) as Record<number, boolean>
                        )
                      }
                      className="text-[11px] text-c-text-muted hover:text-c-text-secondary dark:hover:text-c-text-muted"
                    >
                      {t('initiatives.selectAll2')}
                    </button>
                  )}
                </div>

                {raidAiProposal.add.length === 0 ? (
                  <EmptyStateInline
                    icon={Plus}
                    dashed={false}
                    className="p-5"
                    message={t('initiatives.noAdditionsProposed2')}
                    hint={t('initiatives.aiMayReturnOnlyRemovalsOr2')}
                  />
                ) : (
                  <div className="space-y-1.5">
                    {raidAiProposal.add.map((x, idx) => (
                      <label
                        key={idx}
                        className="flex items-start gap-2 p-2 rounded-xl bg-c-surface/60 dark:bg-c-surface/30 hover:bg-c-surface/80 dark:hover:bg-c-surface/40 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={!!raidAiSelectedAddIdx[idx]}
                          onChange={(e) =>
                            setRaidAiSelectedAddIdx((prev) => ({
                              ...prev,
                              [idx]: e.target.checked,
                            }))
                          }
                          className="mt-1"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-c-text">{x.title}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-c-surface-raised text-c-text-secondary">
                              {String(x.type || '').toUpperCase()}
                            </span>
                            {x.severity ? (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-c-surface-raised text-c-text-secondary">
                                {x.severity}
                              </span>
                            ) : null}
                          </div>
                          {x.description ? (
                            <p className="text-xs text-c-text-secondary mt-0.5 whitespace-pre-wrap">
                              {x.description}
                            </p>
                          ) : null}
                          {x.rationale ? (
                            <p className="text-[11px] text-c-text-muted mt-1">{x.rationale}</p>
                          ) : null}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <Callout
                variant="purple"
                title={t('initiatives.plan2')}
                compact
                className="rounded-xl"
              >
                <ul className="list-disc pl-4 space-y-1">
                  <li>
                    {t('initiatives.removeSelectedRaidItems2') +
                      raidAiProposal.remove.reduce(
                        (sum, r) => sum + (raidAiSelectedRemoveIds[r.raidId] ? 1 : 0),
                        0
                      )}
                  </li>
                  <li>
                    {t('initiatives.addSelectedRaidItems2') +
                      raidAiProposal.add.reduce(
                        (sum, _x, idx) => sum + (raidAiSelectedAddIdx[idx] ? 1 : 0),
                        0
                      )}
                  </li>
                </ul>
              </Callout>
            </div>

            <div className="px-5 py-4 border-t border-c-border-subtle flex items-center justify-end gap-2">
              <button
                onClick={closeRaidAIModal}
                disabled={isRaidAIProposing}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-c-border-subtle text-c-text-secondary hover:bg-c-surface-raised transition-colors disabled:opacity-50"
              >
                {t('initiatives.cancel2')}
              </button>
              <button
                onClick={() => void applyRaidAIProposal()}
                disabled={isRaidAIProposing || !canEditCards}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-c-border-subtle text-c-info hover:bg-c-surface-raised transition-colors disabled:opacity-50"
                title={
                  !canEditCards ? t('initiatives.noEditPermissionAtThisInitiative2') : undefined
                }
              >
                {isRaidAIProposing ? <Loader2 size={13} className="animate-spin" /> : null}
                {t('initiatives.apply2')}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* AI proposal modal (Analyze with AI → add/remove) */}
      {showCommentsAIModal && commentsAiProposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-3xl rounded-2xl bg-c-surface/95 backdrop-blur-xl shadow-2xl">
            <div className="flex items-start justify-between px-5 py-4 border-b border-c-border-subtle">
              <div>
                <h3 className="text-sm font-semibold text-c-text">
                  {t('initiatives.proposedCommentChangesAi2')}
                </h3>
                <p className="text-[11px] text-c-text-muted mt-0.5">
                  {t('initiatives.selectItemsToAddRemoveThen2')}
                </p>
              </div>
              <button
                onClick={closeCommentsAIModal}
                className="p-2 rounded-lg text-c-text-muted hover:text-c-text-secondary dark:hover:text-c-text-muted hover:bg-c-surface-raised transition-colors"
                title={t('initiatives.close2')}
                disabled={isCommentsAIProposing}
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-5 py-4 max-h-[65vh] overflow-y-auto space-y-5">
              {commentsAiProposal.note ? (
                <Callout variant="purple" compact title={t('initiatives.ai2')}>
                  {commentsAiProposal.note}
                </Callout>
              ) : null}

              {/* To remove (top) */}
              <div className="rounded-xl bg-c-surface-raised dark:bg-c-bg/20 p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-c-text-secondary">
                    {t('initiatives.toRemove2')} ({commentsAiProposal.remove.length})
                  </span>
                  {commentsAiProposal.remove.length > 0 && (
                    <button
                      onClick={() =>
                        setCommentsAiSelectedRemoveIds(
                          Object.fromEntries(
                            commentsAiProposal.remove.map((r) => [r.commentId, true])
                          ) as Record<string, boolean>
                        )
                      }
                      className="text-[11px] text-c-text-muted hover:text-c-text-secondary dark:hover:text-c-text-muted"
                      disabled={isCommentsAIProposing}
                    >
                      {t('initiatives.selectAll2')}
                    </button>
                  )}
                </div>

                {commentsAiProposal.remove.length === 0 ? (
                  <EmptyStateInline
                    icon={Trash2}
                    dashed={false}
                    className="p-5"
                    message={t('initiatives.noRemovalSuggestionsFromAi2')}
                    hint={t('initiatives.ifTheThreadLooksGoodAi2')}
                  />
                ) : (
                  <div className="space-y-1.5">
                    {commentsAiProposal.remove.map((r) => {
                      const existing = comments.find(
                        (c) => String((c as any)?.id) === String(r.commentId)
                      );
                      const title = existing
                        ? String((existing as any)?.content || '').slice(0, 120)
                        : r.commentId;
                      return (
                        <label
                          key={r.commentId}
                          className="flex items-start gap-2 p-2 rounded-xl bg-amber-50/40 dark:bg-amber-500/5 hover:bg-amber-50/70 dark:hover:bg-amber-500/10 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={!!commentsAiSelectedRemoveIds[r.commentId]}
                            onChange={(e) =>
                              setCommentsAiSelectedRemoveIds((prev) => ({
                                ...prev,
                                [r.commentId]: e.target.checked,
                              }))
                            }
                            className="mt-1"
                            disabled={isCommentsAIProposing}
                          />
                          <div className="min-w-0">
                            <span className="text-sm font-medium text-c-text">
                              {title || r.commentId}
                            </span>
                            <p className="text-xs text-amber-800/90 dark:text-amber-200 mt-0.5">
                              {r.reason}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* To add */}
              <div className="rounded-xl bg-c-surface-raised dark:bg-c-bg/20 p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-c-text-secondary">
                    {t('initiatives.toAdd2')} ({commentsAiProposal.add.length})
                  </span>
                  {commentsAiProposal.add.length > 0 && (
                    <button
                      onClick={() =>
                        setCommentsAiSelectedAddIdx(
                          Object.fromEntries(
                            commentsAiProposal.add.map((_a, idx) => [idx, true])
                          ) as Record<number, boolean>
                        )
                      }
                      className="text-[11px] text-c-text-muted hover:text-c-text-secondary dark:hover:text-c-text-muted"
                      disabled={isCommentsAIProposing}
                    >
                      {t('initiatives.selectAll2')}
                    </button>
                  )}
                </div>

                {commentsAiProposal.add.length === 0 ? (
                  <EmptyStateInline
                    icon={Plus}
                    dashed={false}
                    className="p-5"
                    message={t('initiatives.noAdditionsProposed2')}
                    hint={t('initiatives.ifTheThreadIsCompleteAi2')}
                  />
                ) : (
                  <div className="space-y-1.5">
                    {commentsAiProposal.add.map((a, idx) => (
                      <label
                        key={idx}
                        className="flex items-start gap-2 p-2 rounded-xl bg-c-surface/60 dark:bg-c-surface/30 hover:bg-c-surface/80 dark:hover:bg-c-surface/40 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={!!commentsAiSelectedAddIdx[idx]}
                          onChange={(e) =>
                            setCommentsAiSelectedAddIdx((prev) => ({
                              ...prev,
                              [idx]: e.target.checked,
                            }))
                          }
                          className="mt-1"
                          disabled={isCommentsAIProposing}
                        />
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-c-text whitespace-pre-wrap">
                            {a.content}
                          </span>
                          {a.rationale ? (
                            <p className="text-[11px] text-c-text-muted mt-1">{a.rationale}</p>
                          ) : null}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Plan (bottom) */}
              <Callout
                variant="purple"
                title={t('initiatives.plan2')}
                compact
                className="rounded-xl"
              >
                <ul className="list-disc pl-4 space-y-1">
                  <li>
                    {isPolish
                      ? `Usuń zaznaczone komentarze: ${commentsAiSelectedRemoveCount}.`
                      : `Remove selected comments: ${commentsAiSelectedRemoveCount}.`}
                  </li>
                  <li>
                    {isPolish
                      ? `Dodaj zaznaczone komentarze: ${commentsAiSelectedAddCount}.`
                      : `Add selected comments: ${commentsAiSelectedAddCount}.`}
                  </li>
                </ul>
              </Callout>
            </div>

            <div className="px-5 py-4 border-t border-c-border-subtle flex items-center justify-end gap-2">
              <button
                onClick={closeCommentsAIModal}
                disabled={isCommentsAIProposing}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-c-border-subtle text-c-text-secondary hover:bg-c-surface-raised transition-colors disabled:opacity-50"
              >
                {t('initiatives.cancel2')}
              </button>
              <button
                onClick={() => void applyCommentsAIProposal()}
                disabled={isCommentsAIProposing}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-c-border-subtle text-c-info hover:bg-c-surface-raised transition-colors disabled:opacity-50"
              >
                {isCommentsAIProposing ? <Loader2 size={13} className="animate-spin" /> : null}
                {t('initiatives.apply2')}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="h-full overflow-y-auto bg-c-bg">
        {/* ═══════════════════════════════════════════════════════════════
            N-MODE RENDER
            ═══════════════════════════════════════════════════════════════ */}
        {densityMode === 'n' ? (
          <div className="min-h-screen px-6 pt-4 pb-6">
            {/* ── GEOMETRIA CHROMU (2026-07-24) ────────────────────────────────
                BYŁO: `max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4` — padding
                WEWNĄTRZ limitu (zjadał 2×32 px przy lg) i Menu 1 POZA wierszem
                flex z prawym panelem. Zmierzone na renderze 1280/1440: Menu 1
                szer. 1088, Menu 2 szer. 712 — 376 px rozjazdu W OBRĘBIE JEDNEJ
                KARTY (Menu 1 biegło NAD panelem, Menu 2 kończyło się przed nim).
                JEST: padding NA ZEWNĄTRZ limitu (`px-6 pt-4 pb-6`, jak
                `NModeShell` :153) i wiersz flex obejmujący RÓWNIEŻ Menu 1 —
                identycznie jak w Decyzji/Zadaniu. Dzięki temu oba menu mają tę
                samą szerokość, a panel startuje na górnej krawędzi Menu 1.
                GRID ETAP 6 (2026-07-24, naprawa P0-2): `max-w-6xl` (1152px
                stałe) zamrażał centrum na ~592px, martwe marginesy na
                1920px. Wzorzec z Zadania (TaskDetailView.tsx:5306-5311) —
                token `--ntype-content-document-max-width` zamiast stałej.
                TYLKO ta ścieżka N-mode (densityMode === 'n', :11167) — C-mode
                (legacy, :10659) poza zakresem tego etapu. */}
            <div
              className="mx-auto xl:flex xl:gap-6 xl:items-start"
              style={{
                maxWidth:
                  'calc(var(--ntype-left-panel-width) + var(--ntype-column-gap) + var(--ntype-content-document-max-width) + var(--ntype-column-gap) + var(--ntype-right-panel-width))',
              }}
            >
              <div className="xl:flex-1 xl:min-w-0">
                <NModeHeader
                  title={titleDraft || initiative?.name || ''}
                  onTitleChange={setTitleDraft}
                  titleReadOnly={!canEditCards}
                  titleInputId={titleInputId}
                  artifactId={initiativeId}
                  artifactType="initiative"
                  onSave={() => handleSave(false)}
                  saving={isMutating}
                  isDirty={hasUnsavedChanges}
                  onClose={onBack || (() => {})}
                  statusLabel={statusPillLabel}
                  statusTone={statusPillTone}
                  presentationMode={densityMode}
                  onPresentationModeChange={setDensityMode}
                  // ETAP 1.1 n-Type: karta N ma JEDEN widok — bez przełącznika N/C.
                  showModeSwitcher={false}
                  buildArtifactCode={(type: string, id: string) =>
                    buildArtifactCode(type as any, id)
                  }
                  /* Pozycje zwinięte tu z kebaba Menu 2 — uzasadnienie przy
                     `menu1ExtraOverflowItems`. Jeden kebab na ekranie. */
                  extraOverflowItems={menu1ExtraOverflowItems}
                  /* PODGLĄD = TYLKO CZYTANIE (2026-07-24): CTA Menu 1 to przejście
                     cyklu życia („Oznacz jako ukończone" / „Zgłoś do przeglądu" …),
                     czyli ZAPIS statusu na rekordzie. W Podglądzie znika — tak jak
                     znikły akcje panelu. Zadanie i Decyzja nie mają w Podglądzie
                     żadnego primary w Menu 1; Inicjatywa była jedyną kartą, która
                     zostawiała tam żywy przycisk zmieniający stan. */
                  primaryAction={
                    primaryLifecycleAction && !readMode
                      ? {
                          label: {
                            en: primaryLifecycleAction.label,
                            pl: primaryLifecycleAction.labelPl,
                          },
                          icon: ArrowRight,
                          onClick: () => void handleStatusAction(primaryLifecycleAction),
                          disabled: isMutating,
                        }
                      : undefined
                  }
                />

                {/* ── Menu 1 (tożsamość) primary CTA — JEDEN przycisk = przejście stanu
                    lifecycle (Submit for Review → Approve for Execution → Schedule …).
                    Renderowany natywnie przez NModeHeader.primaryAction (patrz wyżej),
                    NIGDY crimson. Reszta akcji (Sekcje/Eksport/AI/Nowy)
                    → Menu 3. */}

                {/* RYTM PIONOWY (2026-07-24): `mt-2` (było `mt-4`) — razem
                    z `py-2` kontenera Menu 2 daje 16 px odstępu Menu 1 ↔ Menu 2,
                    dokładnie tyle co powłoka `NModeShell` (NMODE_TOOLBAR_SHELL_CLASS
                    `mt-2` + `py-2`). Zmierzone przedtem: 24 px tu, 16 px we
                    Wniosku/Narzędziu, 0 px w Decyzji/Zadaniu/Powiadomieniu. */}
                <div className="col-span-full space-y-4 mt-2">
                  {/* HP-8 workflow-engine status bar — ZESZŁA STĄD do slotu
                      `statusBar` prawego panelu (patrz `artifactApprovalStatusBar`).
                      Stała tu jako sierocy pasek między Menu 1 a Menu 2 i robiła
                      68 px pustej dziury; Decyzja od początku miała go w panelu. */}
                  {/* SPEC-N §2.2 / pakiet M7 pkt 1 — POZIOMA SIATKA 7 PÓL USUNIĘTA.
                      Był tu <NModePropertiesStrip fields={nModePropertyFields} />:
                      status · faza · następna brama · priorytet · właściciel ·
                      termin · źródło, rozłożone poziomo pod nagłówkiem. To był
                      „największa pojedyncza luka strukturalna" z inwentarza A1 —
                      właściwości artefaktu należą do akordeonu prawego panelu,
                      nie do pasa pod tytułem.
                      Te SAME pola (ta sama tablica `nModePropertyFields`, te same
                      `render()`, ta sama edytowalność) renderuje teraz sekcja
                      „Właściwości" w initiativeRightPanelSections. */}

                  {statusDriftUi ? (
                    <Callout variant="warning" compact title={t('initiatives.statusDrift2')}>
                      {t('initiatives.thisViewUsesNormalizedStatusAligned2')}
                    </Callout>
                  ) : null}

                  {/* Etap 5 gridu n-Type: banner „co dalej" (InitiativeDraftJourney)
                      USUNIĘTY stąd — patrz uzasadnienie przy stanie
                      `draftJourneyDismissed` (teraz nieistniejącym), ok. linii 793.
                      Status/faza/następna brama żyją w „Właściwościach"
                      (nModePropertyFields), primary CTA w Menu 1. */}

                  {/* Action Bar — grouped: primary | context-create | secondary + danger | AI right-aligned.
                      Container matches the shared NModeShell action-bar standard (slate, borderless)
                      so the Initiative toolbar reads identically to the Insight toolbar. */}
                  {/* ── Kolumna robocza ────────────────────────────────────────
                      Wiersz flex z prawym panelem WYPROWADZONY WYŻEJ (obejmuje
                      też Menu 1) — patrz komentarz „GEOMETRIA CHROMU" przy
                      `min-h-screen`. Wcześniej flex startował TUTAJ, przez co
                      Menu 1 (1088 px) i Menu 2 (712 px) rozjeżdżały się o 376 px
                      w obrębie jednej karty. Te dwa kontenery zostają jako czyste
                      grupy treści — bez własnej geometrii. */}
                  <div>
                    <div className="min-w-0">
                      {/* Kontener Menu 2 — PRZEZROCZYSTY (jak w Decyzji/Zadaniu, gdzie
                      zmierzone tło = rgba(0,0,0,0)). BYŁO: `bg-c-surface/95` +
                      `backdrop-blur` + `border-b` + ujemne marginesy
                      `-mx-4 sm:-mx-6 lg:-mx-8`, czyli biały pas na 1216 px = całą
                      szerokość ekranu. `NModeMenu2` jest już jasnym, zaokrąglonym
                      komponentem systemowym z własną ramką — pas pod nim kasował
                      tę „odsuniętość" i sklejał menu z tłem strony. */}
                      {/* `mb-2` (było `mb-4`): z `py-2` daje 16 px między Menu 2
                          a pasem sekcji — tyle, ile mają Decyzja/Zadanie/
                          Powiadomienie (`space-y-4`). Było 24 px. */}
                      <div className="sticky top-0 z-30 bg-transparent py-2 mb-2">
                        {(() => {
                          // ETAP 1.2: `activeSectionName` USUNIETA — nazwa aktywnej karty
                          // nie nalezy do zadnej z trzech stref menu 2 (dubel lewej nawigacji).
                          // Grouped section list for the Sections dropdown (mirrors left nav).
                          const sectionGroups: { group: string; sections: NModeSection[] }[] = [];
                          for (const s of nModeSectionsWithContent) {
                            const g = s.group || t('initiatives.other2');
                            let bucket = sectionGroups.find((x) => x.group === g);
                            if (!bucket) {
                              bucket = { group: g, sections: [] };
                              sectionGroups.push(bucket);
                            }
                            bucket.sections.push(s);
                          }
                          // ── MENU 2 (ETAP 1.2 standardu n-Type) ────────────────
                          // Trzy strefy narzucone przez wspolny `NModeMenu2`:
                          //   LEWA   Sekcje
                          //   SRODEK Edycja | Podglad (srodek GEOMETRYCZNY paska)
                          //   PRAWA  kebab + Analizuj z AI (fiolet) skrajnie
                          //
                          // ZDJETE (zgloszenie wlasciciela pkt 1 i 3):
                          //   - pigulka nawigacji "Zakres" (Menu3DropdownChip) —
                          //     dublowala lewa nawigacje, ktora juz pokazuje
                          //     i podswietla te same sekcje,
                          //   - nazwa aktywnej karty — ten sam dubel,
                          //   - "Nowy" (kontekstowe tworzenie) — lewa strefa ma niesc
                          //     WYLACZNIE Sekcje; akcje przeniesione do kebaba
                          //     (grupa neutralna, nad Eksportem),
                          //   - "AI sekcji" — te same akcje sa w panelu AI
                          //     (Uzupelnij puste / Synteza / Kontrola jakosci),
                          //     wiec pasek je dublowal.
                          // "+ Nowa karta" ta karta nigdy nie miala.
                          return (
                            <NModeMenu2
                              isPolish={isPolish}
                              readMode={readMode}
                              onReadModeChange={setReadMode}
                              aiButton={
                                // BEZWARUNKOWO (wzór: KnownToolDetailView) — było
                                // `readMode ? undefined : …`, a `readMode` startuje
                                // `true` dla każdej inicjatywy poza DRAFT, więc prawa
                                // strefa Menu 2 była PUSTA przy wejściu na kartę
                                // i standardowy przycisk „Analizuj z AI" nie istniał.
                                // Analiza niczego nie zapisuje — ocenia gotowość karty
                                // — więc nie jest afordancją EDYCJI i nie ma powodu,
                                // żeby znikała w Podglądzie.
                                //
                                // ETAP 3: przycisk ANALIZUJE aktywną kartę i otwiera
                                // panel wyników. Było: przełącznik `aiPanelOpen`
                                // (AIConsultantPanel = czat całego artefaktu).
                                // Konsultant NIE zniknął — `AIConsultantPanel` nadal
                                // renderuje się niżej i ma swoje wejścia; zmienia się
                                // tylko to, co robi TEN przycisk, zgodnie z jego nazwą.
                                <Menu2AIButton
                                  isPolish={isPolish}
                                  busy={initiativeCardAnalysis.loading}
                                  aria-expanded={initiativeCardAnalysis.open}
                                  disabled={!canUseAi}
                                  onClick={() => {
                                    if (!canUseAi) {
                                      toast.error(t('initiatives.aiIsUnavailableBecauseYouHave2'));
                                      return;
                                    }
                                    initiativeCardAnalysis.run();
                                  }}
                                />
                              }
                              /* KEBAB MENU 2 USUNIĘTY (2026-07-24) — jego pozycje żyją teraz
                                 w kebabie Menu 1 (`extraOverflowItems` = `menu1ExtraOverflowItems`).
                                 Menu 2 wraca do kontraktu trzech stref: Sekcje · Edycja|Podgląd ·
                                 Analizuj z AI. Zero utraconych zdolności — patrz uzasadnienie
                                 przy definicji `menu1ExtraOverflowItems`. */
                              sectionsMenu={
                                <div className="relative">
                                  <ToolbarGhostButton
                                    icon={<Layers size={14} />}
                                    onClick={() => setShowSectionsMenu((v) => !v)}
                                    aria-expanded={showSectionsMenu}
                                  >
                                    <span>{t('initiatives.sections2')}</span>
                                    <ChevronDown size={12} className="opacity-60" />
                                  </ToolbarGhostButton>
                                  {showSectionsMenu && (
                                    <>
                                      <div
                                        className="fixed inset-0 z-40"
                                        onClick={() => setShowSectionsMenu(false)}
                                      />
                                      <div className="absolute left-0 top-full mt-1 z-50 w-72 max-h-[60vh] overflow-y-auto rounded-xl border border-c-border-subtle bg-c-surface shadow-xl py-1.5">
                                        {/* MIGRACJA (D-8, ETAP 2): przełącznik zestawu domyślnego
                                        Rdzeń / Pełny (za flagą). Stan aktywny = NEUTRALNY
                                        (tokeny c-*, bez akcentu semantyki krytycznej). */}
                                        {initiativeCardContractEnabled &&
                                          (() => {
                                            const isRdzenActive =
                                              hiddenSectionIds.size > 0 &&
                                              nModeSectionsWithContent.every(
                                                (s) =>
                                                  initiativeCoreBoardIdSet.has(s.id) ||
                                                  hiddenSectionIds.has(s.id)
                                              ) &&
                                              nModeSectionsWithContent.some((s) =>
                                                hiddenSectionIds.has(s.id)
                                              );
                                            const isFullActive = hiddenSectionIds.size === 0;
                                            const applyRdzen = () =>
                                              setHiddenSectionIds(
                                                new Set(
                                                  nModeSectionsWithContent
                                                    .map((s) => s.id)
                                                    .filter(
                                                      (id) => !initiativeCoreBoardIdSet.has(id)
                                                    )
                                                )
                                              );
                                            const applyFull = () => setHiddenSectionIds(new Set());
                                            const modeBtn = (active: boolean) =>
                                              `flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                                                active
                                                  ? 'bg-c-surface-raised text-c-text'
                                                  : 'text-c-text-secondary hover:bg-c-surface-raised/60'
                                              }`;
                                            return (
                                              <div className="border-b border-c-border-subtle px-3 pb-2 pt-1">
                                                <div className="pb-1 text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">
                                                  {isPolish ? 'Zestaw domyślny' : 'Default set'}
                                                </div>
                                                <div className="flex gap-1 rounded-lg border border-c-border-subtle bg-c-surface p-0.5">
                                                  <button
                                                    type="button"
                                                    aria-pressed={isRdzenActive}
                                                    onClick={applyRdzen}
                                                    className={modeBtn(isRdzenActive)}
                                                  >
                                                    {isPolish ? 'Rdzeń inicjatywy' : 'Core'}
                                                  </button>
                                                  <button
                                                    type="button"
                                                    aria-pressed={isFullActive}
                                                    onClick={applyFull}
                                                    className={modeBtn(isFullActive)}
                                                  >
                                                    {isPolish ? 'Pełny' : 'Full'}
                                                  </button>
                                                </div>
                                              </div>
                                            );
                                          })()}
                                        {sectionGroups.map((grp) => (
                                          <div key={grp.group} className="py-0.5">
                                            <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">
                                              {grp.group}
                                            </div>
                                            {grp.sections.map((s) => {
                                              const isEmpty = s.cHidden === true;
                                              // MIGRACJA (D-8): RDZEŃ nieusuwalny pod flagą — sekcja boardu
                                              // z rdzenia kontraktu (overview→`initiative-definition`) nie
                                              // daje się ukryć; poza flagą zachowanie bez zmian.
                                              const isCore =
                                                initiativeCardContractEnabled &&
                                                INITIATIVE_CORE_BOARD_IDS.has(s.id);
                                              const isVisible =
                                                isCore || !hiddenSectionIds.has(s.id);
                                              const SectionIcon = s.icon;
                                              return (
                                                <button
                                                  key={s.id}
                                                  type="button"
                                                  disabled={isCore}
                                                  title={
                                                    isCore
                                                      ? isPolish
                                                        ? 'Karta rdzenia — nieusuwalna'
                                                        : 'Core card — cannot be hidden'
                                                      : undefined
                                                  }
                                                  onClick={() => {
                                                    if (isCore) return; // rdzeń: brak akcji ukrycia
                                                    setHiddenSectionIds((prev) => {
                                                      const next = new Set(prev);
                                                      if (next.has(s.id)) next.delete(s.id);
                                                      else next.add(s.id);
                                                      return next;
                                                    });
                                                  }}
                                                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
                                                    isCore
                                                      ? 'cursor-default'
                                                      : 'hover:bg-c-surface-raised/60'
                                                  } ${
                                                    isEmpty
                                                      ? 'text-c-text-muted'
                                                      : 'text-c-text-secondary'
                                                  }`}
                                                >
                                                  <span
                                                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                                      isVisible
                                                        ? 'border-teal-500 bg-teal-500 text-white'
                                                        : 'border-c-border-strong'
                                                    }`}
                                                  >
                                                    {isVisible && <CheckCircle size={10} />}
                                                  </span>
                                                  <SectionIcon
                                                    size={13}
                                                    className="shrink-0 opacity-70"
                                                  />
                                                  <span className="flex-1 truncate">
                                                    {isPolish ? s.label.pl : s.label.en}
                                                  </span>
                                                  {isCore && (
                                                    <span className="shrink-0 rounded bg-c-surface-raised px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-c-text-muted">
                                                      {isPolish ? 'Rdzeń' : 'Core'}
                                                    </span>
                                                  )}
                                                  {isEmpty && !isCore && (
                                                    <span className="shrink-0 rounded bg-c-surface-raised px-1.5 py-0.5 text-[9px] font-medium text-c-text-muted">
                                                      {t('initiatives.empty3')}
                                                    </span>
                                                  )}
                                                </button>
                                              );
                                            })}
                                          </div>
                                        ))}
                                        {hiddenSectionIds.size > 0 && (
                                          <div className="mt-1 border-t border-c-border-subtle pt-1">
                                            <button
                                              type="button"
                                              onClick={() => setHiddenSectionIds(new Set())}
                                              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors"
                                            >
                                              <RotateCcw size={13} className="shrink-0" />
                                              <span>{t('initiatives.restoreDefaults2')}</span>
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>
                              }
                            />
                          );
                        })()}
                      </div>

                      {/* LeftNav + Canvas. Pływająca akcja „Oznacz gotowe" ZESZŁA
                      STĄD do sekcji „Akcje" prawego panelu (pkt 10 audytu): stała
                      nad treścią, poza Menu 1 i poza Menu 2, czyli poza jakąkolwiek
                      strefą powłoki. */}
                      <div className="flex min-h-[60vh] items-start">
                        <div className="flex-1 min-w-0 flex gap-0">
                          <NModeLeftNav
                            sections={orderedNModeSectionsWithContent}
                            activeSection={activeNSection}
                            onSectionChange={setActiveNSection}
                            onSectionReorder={handleNModeSectionReorder}
                            /* SPEC-A §4.4: w trybie Podgląd uchwyty przeciągania
                               (GripVertical) są ukryte. */
                            readMode={readMode}
                          />
                          <div
                            className="flex-1 min-w-0 flex flex-col"
                            style={{ maxWidth: 'var(--ntype-content-document-max-width)' }}
                          >
                            <NModeCanvas
                              sections={orderedNModeSectionsWithContent}
                              activeSection={activeNSection}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Dokowany prawy panel (SPEC-A §11.2). SIOSTRA kolumny
                  roboczej (a nie element wiersza pod Menu 1), więc panel
                  biegnie od górnej krawędzi Menu 1, a oba menu kończą się
                  przed nim — jak w Decyzji.
                  GRID ETAP 6 (2026-07-24, naprawa P0-1): BEZ `hidden
                  xl:block` (wzorzec z Powiadomienia,
                  NotificationDetailView.tsx:4196) — próg 1280px, „ten sam
                  co w TaskDetailView", ukrywał panel na 1024px i zabierał
                  Akcje/Właściwości/Komentarze/Historię. Task miał TĘ SAMĄ
                  wadę i dostał tę samą naprawę w tym etapie. */}
              <div className="shrink-0 sticky top-4 self-start">
                <ArtifactRightPanel
                  sections={initiativeRightPanelSections}
                  className={ARTIFACT_PANEL_CARD_CLASS_STICKY}
                  ariaLabel={t('initiatives.panel.ariaLabel', 'Initiative details')}
                  statusBar={artifactApprovalStatusBar}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* ── Present mode (Phase A3) — fullscreen card walk of canonical sections ── */}
      {isPresenting && presentDeckCards.length > 0 && (
        <PresentMode
          cards={presentDeckCards}
          title={String(initiative?.title || initiative?.name || 'Initiative')}
          onExit={() => setPresentationMode('off')}
        />
      )}

      {/* M13 Depth · Fala 1 — AI gate soft-block override modal */}
      <GateOverrideModal
        open={!!gateAiOverride}
        readiness={gateAiOverride?.readiness ?? null}
        timeline={gateAiOverride?.timeline ?? null}
        onConfirm={(reason) => void handleGateAiOverrideConfirm(reason)}
        onCancel={() => setGateAiOverride(null)}
      />

      {/* ── Smart Export dialog (Phase E) — section picker + targets ───────────── */}
      {showExportDialog && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowExportDialog(false)}
        >
          <div
            className="w-full max-w-lg max-h-[85vh] overflow-hidden rounded-2xl bg-c-surface border border-c-border-subtle shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-c-border-subtle">
              <h2 className="text-base font-semibold text-c-text">
                {t('initiatives.exportInitiative2')}
              </h2>
              <button
                type="button"
                onClick={() => setShowExportDialog(false)}
                className="p-1 rounded-lg text-c-text-muted hover:bg-c-surface-raised"
                aria-label={t('initiatives.close2')}
              >
                <X size={18} />
              </button>
            </div>

            {/* Section picker */}
            <div className="px-5 py-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium uppercase tracking-wide text-c-text-muted">
                  {t('initiatives.sectionsToExport2')}
                </p>
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    className="text-c-text-muted hover:text-c-text"
                    onClick={() =>
                      setExportSelectedSectionIds(new Set(exportableSections.map((s) => s.id)))
                    }
                  >
                    {t('initiatives.all2')}
                  </button>
                  <span className="text-c-text-muted">·</span>
                  <button
                    type="button"
                    className="text-c-text-muted hover:text-c-text"
                    onClick={() => setExportSelectedSectionIds(new Set())}
                  >
                    {t('initiatives.none2')}
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                {exportableSections.map((section) => {
                  const checked = effectiveExportSelection.has(section.id);
                  return (
                    <label
                      key={section.id}
                      className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-c-surface-raised/60 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleExportSection(section.id)}
                        className="rounded border-c-border-strong text-teal-600 focus:ring-teal-500"
                      />
                      <span className="text-sm text-c-text-secondary">{sectionLabel(section)}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Targets */}
            <div className="px-5 py-4 border-t border-c-border-subtle space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-c-text-muted">
                {t('initiatives.format2')}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleExportMarkdown}
                  disabled={isExporting !== null || effectiveExportSelection.size === 0}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-c-border-strong text-c-text-secondary hover:bg-c-surface-raised transition-colors disabled:opacity-50"
                >
                  {isExporting === 'markdown' ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <FileType size={15} />
                  )}
                  Markdown
                </button>
                <button
                  type="button"
                  onClick={() => void handleExportReportPDF()}
                  disabled={isExporting !== null || effectiveExportSelection.size === 0}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-c-border-strong text-c-text-secondary hover:bg-c-surface-raised transition-colors disabled:opacity-50"
                >
                  {isExporting === 'pdf' ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <FileDown size={15} />
                  )}
                  {t('initiatives.reportPdf2')}
                </button>
                <button
                  type="button"
                  onClick={handleExportDeck}
                  disabled={effectiveExportSelection.size === 0}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-c-border-strong text-c-text-secondary hover:bg-c-surface-raised transition-colors disabled:opacity-50"
                >
                  <Presentation size={15} />
                  {t('initiatives.deck2')}
                </button>
                <button
                  type="button"
                  onClick={() => void handleExportNotebook()}
                  disabled={isExporting !== null || effectiveExportSelection.size === 0}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-c-border-strong text-c-text-secondary hover:bg-c-surface-raised transition-colors disabled:opacity-50"
                >
                  {isExporting === 'notebook' ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <NotebookPen size={15} />
                  )}
                  {t('initiatives.notebook2')}
                </button>
              </div>
            </div>
          </div>

          {/* Off-screen printable container — captured by exportReportToPDF. */}
          <div
            id="initiative-export-printable"
            aria-hidden="true"
            style={{
              position: 'fixed',
              left: '-10000px',
              top: 0,
              width: '794px',
              background: '#ffffff',
              color: '#0f172a',
              padding: '40px',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px' }}>
              {String(initiative?.title || initiative?.name || 'Initiative')}
            </h1>
            {exportableSections
              .filter((s) => effectiveExportSelection.has(s.id))
              .map((section) => {
                const body = buildSectionBody(section.id);
                return (
                  <div key={section.id} style={{ marginBottom: '20px' }}>
                    <h2
                      style={{
                        fontSize: '16px',
                        fontWeight: 600,
                        marginBottom: '6px',
                        borderBottom: '1px solid #e2e8f0',
                        paddingBottom: '4px',
                      }}
                    >
                      {sectionLabel(section)}
                    </h2>
                    <div style={{ fontSize: '13px', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                      {body.trim() || t('initiatives.noContent4')}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Slot 9 — canonical artifact-level AI Consultant right panel (POZIOM 3).
          Right-side ~360px slide-over with whole-initiative chat context + the
          5 canon actions. Toggled by the solid-teal toolbar button. */}
      <AIConsultantPanel
        open={aiPanelOpen}
        onClose={() => setAiPanelOpen(false)}
        artifactType="initiative"
        artifactId={String(initiative?.id ?? initiativeId)}
        artifactTitle={String(initiative?.title || initiative?.name || 'Initiative')}
        contextText={aiPanelContextText}
        actions={aiConsultantActions}
        isBusy={!canUseAi}
        isPolish={isPolish}
      />

      {/* ── ETAP 3: panel wyników „Analizuj z AI" ─────────────────────────────
          Analiza AKTYWNEJ KARTY (poziom karty), obok konsultanta artefaktu
          (poziom 3, wyżej). Zapis wyłącznie przez „Zastosuj". */}
      <NCardAIAnalysisPanel
        open={initiativeCardAnalysis.open}
        onClose={initiativeCardAnalysis.close}
        loading={initiativeCardAnalysis.loading}
        result={initiativeCardAnalysis.result}
        errorCode={initiativeCardAnalysis.errorCode}
        serverErrorCode={initiativeCardAnalysis.serverErrorCode}
        onRerun={initiativeCardAnalysis.rerun}
        onApplyChange={initiativeCardAnalysis.applyChange}
        writableFieldIds={initiativeWritableFieldIds}
        readMode={readMode}
        isPolish={isPolish}
      />
    </InitiativeContext.Provider>
  );
};
