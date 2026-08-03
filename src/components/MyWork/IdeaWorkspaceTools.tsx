/**
 * IdeaWorkspaceTools — prawy panel Idei (płótno: Mapa · Przepływ · Tablica · Tabela).
 *
 * ★ KANON PRAWEGO PANELU (decyzja właściciela D1) —
 *   docs/standards/idea-workspace/07_PRAWY_PANEL.md:
 *
 *       Przegląd · Właściwości · Powiązania · Komentarze · Historia
 *
 * Odwzorowanie dawnych pięciu zakładek (`problem·status·inspector·convert·health`):
 *   1. **Przegląd**    ← Problem + Status + Statystyki + Kondycja (§4: zdrowie NIE
 *                        jest osobną zakładką, jest częścią Przeglądu).
 *   2. **Właściwości** ← dawny Inspektor (mapa/przepływ/tablica). Bez zaznaczenia
 *                        pokazuje ustawienia reprezentacji (§5).
 *   3. **Powiązania**  ← NOWA. Treść = `<IdeaContextPanel embedded>` (backlinki,
 *                        artefakty, inicjatywy, luki, insighty, KPI, podobne idee)
 *                        — reużycie, nie drugi komponent (§6).
 *   4. **Komentarze**  ← NOWA. `panel/IdeaPanelComments` (§7).
 *   5. **Historia**    ← NOWA. `panel/IdeaPanelHistory` (§8).
 *
 * Gdzie poszła KONWERSJA: do Menu 1 (`IdeaConvertMenu` w `primaryActionSlot`
 * powłoki) — §9 mówi wprost, że konwersja to akcja, nie zakładka. Sekcja
 * „Konwertuj" zostaje w kodzie i renderuje się WYŁĄCZNIE w trybie legacy
 * (szuflada bez `onlySection`), bo tam Menu 1 nie istnieje, a przycisk
 * „Konwertuj" w `IdeaRightPanel` prowadzi właśnie do tej sekcji — usunięcie
 * zgubiłoby funkcję.
 *
 * DWA TRYBY (bez regresji):
 *   • `onlySection` podane (powłoka MELS, rail) → renderujemy DOKŁADNIE jedną
 *     zakładkę kanonu.
 *   • brak `onlySection` (legacy szuflada wewnątrz `IdeaRightPanel`) → jak dziś:
 *     Problem · Status · Konwersja · Inspektor · Kondycja. Powiązań/Komentarzy/
 *     Historii tam NIE dokładamy — `IdeaRightPanel` ma już własne sekcje o tych
 *     nazwach i powstałby dubel.
 */
import {
  Activity,
  BarChart3,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  GitBranch,
  Layers,
  LayoutDashboard,
  Lightbulb,
  Link2,
  ListChecks,
  MessageSquare,
  MessageSquarePlus,
  MousePointerClick,
  Pencil,
  Presentation,
  Rocket,
  Save,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Star,
} from 'lucide-react';
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ToolsPanelShell } from '@/components/shared/WorkspaceTools';
import {
  IDEA_ELEMENT_DETAILS_SLOT_ID,
  isIdeaDetailsInPanelEnabled,
} from '@/utils/ideaDetailsInPanelFlag';
import {
  isWhiteboardSessionInPanelEnabled,
  WHITEBOARD_SESSION_PANEL_SLOT_ID,
} from '@/utils/whiteboardSessionInPanelFlag';

import { IdeaContextPanel } from './IdeaContextPanel';
import {
  IDEA_CONVERT_GROUP_LABELS,
  IDEA_CONVERT_GROUP_ORDER,
  IDEA_CONVERT_TARGETS,
  type IdeaConvertGroup,
  type IdeaConvertTarget,
} from './ideaConvertTargets';
import {
  bucketIdeaStageForList,
  IDEA_STAGE_BUCKET_LABELS,
  IDEA_STAGE_COLORS,
  IDEA_STAGES_V5,
  type IdeaStageListBucket,
  type IdeaStageV5,
  normalizeStageToV5,
} from './ideaEntryTypes';
import type { CanvasToolType, IdeaWorkspaceSelection } from './ideaSelectionTypes';
import { getIdeaWorkspaceToolLabel } from './IdeaWorkspaceToolbar';
import { MapHealthScore } from './mindmap/MapHealthScore';
import { MindmapInspector } from './mindmap/MindmapInspector';
import {
  IDEA_PANEL_6_LABELS_EN,
  IDEA_PANEL_6_LABELS_PL,
  IDEA_PANEL_AI_SLOT_ID,
  IDEA_PANEL_TOOL_SLOT_ID,
  type IdeaPanel6SectionId,
  normalizujDoSzesciu,
} from './panel/ideaPanel6Sections';
import { isIdeaPanel6SectionsEnabled } from './panel/ideaPanel6SectionsFlag';
import { IdeaPanelActivity } from './panel/IdeaPanelActivity';
import { IdeaPanelComments } from './panel/IdeaPanelComments';
import { IdeaPanelHistory } from './panel/IdeaPanelHistory';
import { isIdeaPanelVisualEnabled } from './panel/ideaPanelVisualFlag';
import { ProcessFlowHealthScore } from './processflow/ProcessFlowHealthScore';
import { ProcessFlowPropertiesPanel } from './processflow/ProcessFlowPropertiesPanel';
import { IdeaCompletenessWidget } from './table/IdeaCompletenessWidget';

const FIELD_CLASS =
  'w-full h-9 px-3 rounded-lg text-sm bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none focus:border-c-focus dark:focus:border-c-focus transition-colors';

// Convert-target union is owned by the SSOT registry (ideaConvertTargets.ts).
type ConvertTarget = IdeaConvertTarget;

/**
 * 2026-07-24 SSOT unification: the panel used to show the 7-level V5 stage
 * vocabulary (`IDEA_STAGE_LABELS` — "Strukturyzacja", "Walidacja"...) while the
 * Ideas list showed the 5-bucket vocabulary (`IDEA_STAGE_BUCKET_LABELS` —
 * "Kształtuje się", "Gotowy"...). Same idea, two dictionaries. Data model and
 * transition logic (`IDEA_STAGES_V5` order, `onStageChange`, gating elsewhere)
 * are untouched — only what's PRINTED changes. The manual stage picker below
 * still writes a V5 enum value (`stage` column, `IdeaStageEnum` server-side),
 * but the dropdown now lists one row per BUCKET (not per V5 stage) so it
 * doesn't show two rows with identical bucket text (framing/exploring both
 * "Rośnie", validating/ready_to_convert both "Gotowy"). Picking a bucket the
 * user is already in is a no-op (keeps the current granular V5 value);
 * picking a different bucket jumps to that bucket's first V5 stage.
 */
const STAGE_BUCKET_OPTIONS: { bucket: IdeaStageListBucket; representative: IdeaStageV5 }[] =
  (() => {
    const seen = new Set<IdeaStageListBucket>();
    const opts: { bucket: IdeaStageListBucket; representative: IdeaStageV5 }[] = [];
    for (const s of IDEA_STAGES_V5) {
      const bucket = bucketIdeaStageForList(s);
      if (!seen.has(bucket)) {
        seen.add(bucket);
        opts.push({ bucket, representative: s });
      }
    }
    return opts;
  })();

/**
 * P0-4: zakladki prawego panelu. Powloka (EditorShell) przekazuje identyfikator
 * aktywnej ikony do `renderRightRailPanel`, host mapuje go na `onlySection`.
 * `undefined` = renderuj wszystkie sekcje (tryb legacy / szuflada).
 * Bez tego piec ikon railа pokazywalo TE SAMA tresc.
 *
 * Identyfikatory MUSZA odpowiadac 1:1 ikonom z
 * `buildIdeaCanvasRightRailTools` (ideaCanvasMelsChips.ts) — powloka przekazuje
 * identyfikator aktywnej ikony wprost jako `onlySection`.
 */
export const IDEA_PANEL_TABS = [
  'overview',
  'properties',
  'relations',
  'comments',
  'history',
] as const;
export type IdeaPanelTab = (typeof IDEA_PANEL_TABS)[number];

/**
 * Identyfikatory sprzed kanonu D1. Nadal PRZYJMOWANE (host i zapamiętany stan
 * railа mogą podać stary klucz — np. `convert` z localStorage), normalizowane
 * przez `normalizujZakladke`. Nie zostawiamy martwego panelu za starym id.
 */
export const IDEA_PANEL_LEGACY_SECTIONS = [
  'problem',
  'status',
  'inspector',
  'convert',
  'health',
] as const;
export type IdeaPanelLegacySection = (typeof IDEA_PANEL_LEGACY_SECTIONS)[number];

/** Zbiór wszystkich akceptowanych id (kanon + stare aliasy). */
export const IDEA_PANEL_SECTIONS = [...IDEA_PANEL_TABS, ...IDEA_PANEL_LEGACY_SECTIONS];
export type IdeaPanelSection = IdeaPanelTab | IdeaPanelLegacySection;

const LEGACY_NA_ZAKLADKE: Record<IdeaPanelLegacySection, IdeaPanelTab> = {
  problem: 'overview',
  status: 'overview',
  // Kondycja jest częścią Przeglądu (§4), Konwersja przeniosła się do Menu 1 (§9).
  health: 'overview',
  convert: 'overview',
  inspector: 'properties',
};

export function normalizujZakladke(sekcja: IdeaPanelSection): IdeaPanelTab {
  return (IDEA_PANEL_TABS as readonly string[]).includes(sekcja)
    ? (sekcja as IdeaPanelTab)
    : LEGACY_NA_ZAKLADKE[sekcja as IdeaPanelLegacySection];
}

interface IdeaWorkspaceToolsProps {
  open: boolean;
  onClose: () => void;
  /** P0-4: renderuj TYLKO wskazana sekcje (zakladka prawego panelu). */
  onlySection?: IdeaPanelSection;
  /**
   * EditorShell Wave W (W-1): render inside the shell right-rail column
   * (drops the panel's own fixed-width / bordered drawer chrome + close
   * button). Additive — default false = legacy sliding drawer unchanged.
   */
  embedded?: boolean;

  ideaId: string;
  title: string;
  seedText: string;
  stage: string;
  branch: string;
  area: string;
  priority: number;
  isDraft: boolean;
  isAccepted: boolean;
  saving: boolean;
  draftSavedLabel: string;

  activeTool: CanvasToolType;
  selection: IdeaWorkspaceSelection;

  onTitleChange: (v: string) => void;
  onSeedTextChange: (v: string) => void;
  onBranchChange: (v: string) => void;
  onAreaChange: (v: string) => void;
  onPriorityChange: (v: number) => void;
  onSave: () => void;
  onAcceptChallenge: () => void;
  onConvert: (target: ConvertTarget) => void;
  onOpenChat: () => void;
  onStageChange?: (stage: string) => void;
  graphNodes?: any[];
  graphEdges?: any[];
  evidenceCount?: number;
  onAISummarize?: () => void;
  onAIExpand?: () => void;
  onLayoutChange?: (mode: string) => void;
  onThemeChange?: (theme: string) => void;
  onStyleChange?: (patch: Record<string, any>) => void;
  onFitView?: () => void;
  onAutoLayout?: () => void;

  processFlowLanes?: { id: string; label: string; color: string }[];
  onProcessFlowNodeLabelChange?: (nodeId: string, label: string) => void;
  onProcessFlowGatewayKindChange?: (nodeId: string, kind: 'xor' | 'and') => void;
  onProcessFlowLaneChange?: (nodeId: string, laneId: string) => void;
  onProcessFlowEdgeLabelChange?: (edgeId: string, label: string) => void;
  onProcessFlowNodeMetricsChange?: (
    nodeId: string,
    metrics: { duration?: string; durationUnit?: string; cost?: string; fteCount?: string }
  ) => void;
  onProcessFlowEdgeConditionChange?: (edgeId: string, conditionType: string) => void;
  onProcessFlowNodeMetadataChange?: (
    nodeId: string,
    metadata: { description?: string; assignee?: string; system?: string }
  ) => void;

  whiteboardSession?: {
    role?: string;
    phase?: string;
    timerActive?: boolean;
    followActive?: boolean;
    participantCount?: number;
  };
  whiteboardOutcomes?: Array<{ type: string; label: string }>;

  /**
   * Zakładka Historia (§8) — „Przywróć wersję". Handler należy do płótna
   * (ten sam, którym host karmi modal `SnapshotHistory`). Gdy host go NIE poda,
   * przycisk się nie renderuje — nigdy nie rysujemy martwej akcji (Z3).
   */
  onRestoreSnapshot?: (nodes: any[], edges: any[], extensions?: Record<string, unknown>) => void;
  /** Zakładka Powiązania (§6) — wstawienie pozycji kontekstu na płótno. */
  onInsertContextToCanvas?: (item: { text: string; type: string; detail?: string }) => void;
  /**
   * Układ SZEŚCIU sekcji (flaga `ff_ideaPanel6Sections`), sekcja „AI" w
   * kontekście ELEMENTU: akcje AI wykonywane NA zaznaczonym węźle
   * (`mm_ai_expand_node`, `mm_ai_deepen`, `mm_ai_what_if`, `mm_ai_suggest_links`).
   * Host podaje handler TYLKO tam, gdzie te akcje mają wykonawcę
   * (`useMindMapQuickActions` = Mapa myśli) — brak handlera = brak przycisków,
   * nigdy martwy klik (Z3).
   */
  onAINodeAction?: (action: string, nodeId: string) => void;
  /** Rozszerzenia grafu (`graphRuntime.graph.extensions`) dla panelu kontekstu. */
  mapExtensions?: Record<string, any>;
}

/* ── Collapsible section wrapper ── */
/**
 * P0-4: gdy panel pracuje jako zakladka (`onlySection`), widoczna jest dokladnie
 * jedna sekcja i JEST ona trescia zakladki — nie pozycja akordeonu. Zwijanie
 * jedynej sekcji dawaloby pusta zakladke, wiec w tym trybie naglowek przestaje
 * byc przyciskiem, a tresc jest zawsze widoczna.
 */
const TrybZakladki = React.createContext(false);

/**
 * P2-4 (Z2): warstwa wizualna panelu. `false` = dzisiejszy płaski akordeon (OFF, 1:1).
 * `true` = kartowy język wizualny z zaakceptowanego prototypu (07_PRAWY_PANEL.md §3).
 * Sterowane flagą `isIdeaPanelVisualEnabled()` — patrz `panel/ideaPanelVisualFlag.ts`.
 * Zmieniamy WYŁĄCZNIE wygląd; treść, `onlySection`, `data-testid` i funkcje bez zmian.
 */
const PanelVisual = React.createContext(false);

const Section: React.FC<{
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, icon, defaultOpen = false, badge, children }) => {
  const wZakladce = useContext(TrybZakladki);
  const v2 = useContext(PanelVisual);
  const [open, setOpen] = useState(defaultOpen);
  const otwarte = wZakladce || open;

  // OFF = klasy dzisiejsze (bez zmian). ON = język prototypu na tokenach c-*.
  const iconCls = v2 ? 'text-c-text-muted shrink-0' : 'text-slate-600 dark:text-slate-500 shrink-0';
  const labelCls = v2
    ? 'text-[10.5px] font-bold uppercase tracking-[0.08em] text-c-text-muted flex-1'
    : 'text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 flex-1';
  const containerCls = v2
    ? 'rounded-[11px] border border-c-border-subtle bg-c-surface-raised overflow-hidden'
    : 'border-b border-slate-200/50 dark:border-white/[0.04] last:border-b-0';
  const headHoverCls = v2
    ? 'hover:bg-c-surface'
    : 'hover:bg-slate-50/50 dark:hover:bg-white/[0.02]';
  const bodyPadCls = v2 ? 'px-3.5 pb-3.5' : 'px-3 pb-3';

  const naglowek = (
    <>
      {!wZakladce && (
        <span className={iconCls}>
          {otwarte ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
      )}
      <span className={iconCls}>{icon}</span>
      <span className={labelCls}>{title}</span>
      {badge}
    </>
  );
  return (
    <div className={containerCls}>
      {wZakladce ? (
        <div className="w-full flex items-center gap-2 px-3 py-2.5 text-left">{naglowek}</div>
      ) : (
        <button
          onClick={() => setOpen((v) => !v)}
          className={`w-full flex items-center gap-2 px-3 py-2.5 text-left ${headHoverCls} transition-colors`}
        >
          {naglowek}
        </button>
      )}
      {otwarte && <div className={bodyPadCls}>{children}</div>}
    </div>
  );
};

const PRIORITY_COLORS: Record<number, string> = {
  25: 'bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300',
  50: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
  75: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  100: 'bg-danger-50 text-danger-700 dark:bg-danger-500/10 dark:text-danger-300',
};

export const IdeaWorkspaceTools: React.FC<IdeaWorkspaceToolsProps> = ({
  open,
  onClose,
  embedded = false,
  ideaId,
  title,
  seedText,
  stage,
  branch,
  area,
  priority,
  isDraft,
  isAccepted,
  saving,
  draftSavedLabel,
  activeTool,
  selection,
  onTitleChange,
  onSeedTextChange,
  onBranchChange,
  onAreaChange,
  onPriorityChange,
  onSave,
  onAcceptChallenge,
  onConvert,
  onOpenChat,
  onStageChange,
  graphNodes = [],
  graphEdges = [],
  evidenceCount = 0,
  onAISummarize,
  onAIExpand,
  onLayoutChange,
  onThemeChange,
  onStyleChange,
  processFlowLanes,
  onProcessFlowNodeLabelChange,
  onProcessFlowGatewayKindChange,
  onProcessFlowLaneChange,
  onProcessFlowEdgeLabelChange,
  onProcessFlowNodeMetricsChange,
  onProcessFlowEdgeConditionChange,
  onProcessFlowNodeMetadataChange,
  onlySection,
  whiteboardSession,
  whiteboardOutcomes,
  onRestoreSnapshot,
  onInsertContextToCanvas,
  onAINodeAction,
  mapExtensions,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language === 'pl';
  // P2-4 (Z2): warstwa wizualna panelu za flagą (domyślnie OFF = dzisiejszy wygląd 1:1).
  const visualV2 = isIdeaPanelVisualEnabled();
  const [stageDropdownOpen, setStageDropdownOpen] = useState(false);

  const v5Stage = normalizeStageToV5(stage);
  const stageBucket = bucketIdeaStageForList(stage);
  const stageLabel = isPl
    ? IDEA_STAGE_BUCKET_LABELS[stageBucket].pl
    : IDEA_STAGE_BUCKET_LABELS[stageBucket].en;
  const stageColor = IDEA_STAGE_COLORS[v5Stage];
  const stageIdx = IDEA_STAGES_V5.indexOf(v5Stage);
  /**
   * ★ Właściciel zdecydował (2026-07-24): użytkownik widzi PIĘĆ etapów.
   * Wewnątrz wciąż żyje siedem wartości V5, a dwa przejścia są niewidoczne
   * (`framing→exploring` i `validating→ready_to_convert` NIE zmieniają nazwy).
   * Przy kroku „o jeden V5" te dwa kliknięcia wyglądałyby na bezczynne —
   * przycisk mówiłby „→ Gotowy", gdy plakietka już mówi „Gotowy".
   *
   * Dlatego przycisk przeskakuje do najbliższego etapu, który jest WIDOCZNIE
   * inny. Każde kliknięcie realnie przesuwa to, co użytkownik widzi.
   *
   * Sprawdzone przed decyzją: konwersja NIE jest bramkowana na `ready_to_convert`
   * (brak takiej bramki w `my-work.routes.ts` i w `IdeaConvertMenu`), a nudge na
   * `exploring` siedzi w nudge-u karty, który nie jest nigdzie używany
   * (dawny `IdeaPinnedCard.tsx` — usunięty jako martwy kod, higiena 2026-07-26).
   * KOSZT DO ŚWIADOMOŚCI: `IdeaFunnelAnalytics` (żywy, 6 odwołań) nie zobaczy już
   * `exploring`/`ready_to_convert` USTAWIONYCH TYM przyciskiem — inne ścieżki
   * (AI, akceptacja wyzwania) nadal je ustawiają.
   */
  const nextVisibleStageIdx = (() => {
    if (stageIdx < 0) return -1;
    for (let i = stageIdx + 1; i < IDEA_STAGES_V5.length; i++) {
      if (bucketIdeaStageForList(IDEA_STAGES_V5[i]) !== stageBucket) return i;
    }
    return -1;
  })();
  const canAdvance = nextVisibleStageIdx >= 0;

  const [branchEditing, setBranchEditing] = useState(false);
  const [areaEditing, setAreaEditing] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const branchRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLInputElement>(null);

  const handleBranchBlur = useCallback(() => {
    setBranchEditing(false);
    onSave();
  }, [onSave]);
  const handleAreaBlur = useCallback(() => {
    setAreaEditing(false);
    onSave();
  }, [onSave]);
  const handlePrioritySelect = useCallback(
    (v: number) => {
      onPriorityChange(v);
      setPriorityOpen(false);
      setTimeout(onSave, 50);
    },
    [onPriorityChange, onSave]
  );

  // PIATA kopia etykiet narzedzi — i jedyna, ktora zostala z „Mapa rekomendacji"
  // (zgloszenie Piotra 2026-07-24: w kolumnie ma byc czytelnie „Mapa mysli").
  // Czytamy z tego samego SSOT co lista, przelacznik i rail.
  const toolLabel = useMemo(
    () => getIdeaWorkspaceToolLabel(activeTool, Boolean(isPl)),
    [activeTool, isPl]
  );

  const normalizedPriority = Math.max(25, Math.min(100, Math.round(priority / 25) * 25)) || 25;
  const priorityOptions = [
    { value: 25, label: t('myWorkIdeas.workspaceTools.low') },
    { value: 50, label: t('myWorkIdeas.workspaceTools.medium') },
    { value: 75, label: t('myWorkIdeas.workspaceTools.high') },
    { value: 100, label: t('myWorkIdeas.workspaceTools.critical') },
  ];
  const currentPriorityLabel =
    priorityOptions.find((o) => o.value === normalizedPriority)?.label ?? 'Medium';

  // Visual map (icon + gradient) keyed by target id; labels/desc/status come from the SSOT registry.
  const CONVERT_VISUALS: Record<
    ConvertTarget,
    { icon: React.ComponentType<any>; gradient: string; textColor: string }
  > = {
    initiative: {
      icon: Rocket,
      gradient: 'from-amber-500/15 to-amber-500/10',
      textColor: 'text-amber-600 dark:text-amber-400',
    },
    task_set: {
      icon: CheckSquare,
      gradient: 'from-emerald-500/15 to-green-500/10',
      textColor: 'text-emerald-600 dark:text-emerald-400',
    },
    decision: {
      icon: Star,
      gradient: 'from-blue-500/15 to-blue-500/10',
      textColor: 'text-blue-600 dark:text-blue-400',
    },
    team_chat: {
      icon: MessageSquarePlus,
      gradient: 'from-violet-500/15 to-violet-500/10',
      textColor: 'text-violet-600 dark:text-violet-400',
    },
    report: {
      icon: FileText,
      gradient: 'from-slate-500/15 to-gray-500/10',
      textColor: 'text-slate-600 dark:text-slate-400',
    },
    presentation: {
      icon: Presentation,
      gradient: 'from-indigo-500/15 to-blue-500/10',
      textColor: 'text-indigo-600 dark:text-indigo-400',
    },
    action_plan: {
      icon: ListChecks,
      gradient: 'from-blue-500/15 to-blue-500/10',
      textColor: 'text-blue-600 dark:text-blue-400',
    },
    raid_log: {
      icon: Shield,
      gradient: 'from-danger-500/15 to-amber-500/10',
      textColor: 'text-danger-600 dark:text-danger-400',
    },
    financial_model: {
      icon: Activity,
      gradient: 'from-emerald-500/15 to-emerald-500/10',
      textColor: 'text-emerald-600 dark:text-emerald-400',
    },
    budget: {
      icon: ListChecks,
      gradient: 'from-slate-500/15 to-gray-500/10',
      textColor: 'text-slate-600 dark:text-slate-400',
    },
    valuation: {
      icon: Activity,
      gradient: 'from-indigo-500/15 to-indigo-500/10',
      textColor: 'text-indigo-600 dark:text-indigo-400',
    },
    analysis: {
      icon: Lightbulb,
      gradient: 'from-amber-500/15 to-amber-500/10',
      textColor: 'text-amber-600 dark:text-amber-400',
    },
  };
  const convertActions = IDEA_CONVERT_TARGETS.map((t) => ({
    id: t.id,
    status: t.status,
    group: t.group,
    labelPl: t.labelPl,
    labelEn: t.labelEn,
    descPl: t.descPl,
    descEn: t.descEn,
    ...CONVERT_VISUALS[t.id],
  }));
  // UI-L9: cluster the flat list into 3 legible groups (working actions · doc generators · AI models)
  const convertGroups = IDEA_CONVERT_GROUP_ORDER.map((g: IdeaConvertGroup) => ({
    group: g,
    label: isPl ? IDEA_CONVERT_GROUP_LABELS[g].pl : IDEA_CONVERT_GROUP_LABELS[g].en,
    items: convertActions.filter((a) => a.group === g),
  })).filter((g) => g.items.length > 0);

  // Legacy sliding-drawer path is gated by `open`. In embedded (EditorShell
  // right-rail) mode the shell only mounts the panel when its icon is active,
  // so visibility is the shell's responsibility — don't self-hide here.
  //
  // P0-4 + kanon D1: gdy powłoka poda aktywną zakładkę, renderujemy TYLKO jej
  // treść. Stare id (`problem`/`status`/`inspector`/`convert`/`health`) są
  // normalizowane do kanonu, więc zapamiętany stan railа nie daje pustki.
  // Brak `onlySection` = tryb legacy (wszystkie DZISIEJSZE sekcje w jednym
  // scrollu, 1:1 jak przed zmianą).
  const trybZakladek = !!onlySection;
  const zakladka: IdeaPanelTab | null = onlySection ? normalizujZakladke(onlySection) : null;
  /** Czy renderować blok należący do zakładki kanonu (tryb zakładek). */
  const wZakladce = (id: IdeaPanelTab) => zakladka === id;
  /** Czy renderować blok w trybie legacy (szuflada = wszystkie stare sekcje). */
  const wLegacy = !trybZakladek;

  /*
   * ── UKŁAD SZEŚCIU SEKCJI (flaga `ff_ideaPanel6Sections`, default OFF) ──
   *
   * Przegląd · Właściwości · Powiązania · AI · Aktywność · Narzędzie
   *
   * Panel mówi zawsze o jednej z DWÓCH rzeczy: o CAŁEJ IDEI albo o ZAZNACZONYM
   * ELEMENCIE. Sekcje zostają te same, zmienia się treść.
   *
   * Nie budujemy drugiego drzewa renderu — te same bloki co dziś dostają drugi
   * adres. `sek(pięć, sześć)` mówi: „w układzie 5 zakładek ten blok należy do
   * zakładki `pięć`, w układzie 6 sekcji — do sekcji `sześć`". Dzięki temu przy
   * fladze OFF nie zmienia się ANI JEDEN warunek (`szesc === false` → ta sama
   * gałąź `wZakladce` co dotąd).
   */
  const szesc = isIdeaPanel6SectionsEnabled() && trybZakladek;
  const sekcja6: IdeaPanel6SectionId | null = szesc ? normalizujDoSzesciu(onlySection) : null;
  const sek = (a: IdeaPanelTab, b: IdeaPanel6SectionId) => (szesc ? sekcja6 === b : wZakladce(a));
  /** Blok wspólny: legacy pokazuje go zawsze, tryb zakładek — w swojej sekcji. */
  const pokaz = (id: IdeaPanelTab, id6: IdeaPanel6SectionId = id as IdeaPanel6SectionId) =>
    wLegacy || sek(id, id6);

  // Przedmiot panelu. Zaznaczenie liczy się TYLKO gdy element realnie istnieje
  // w grafie — cztery reprezentacje dzielą jeden graf, a „duch" po usuniętym
  // węźle pokazywałby panel o czymś, czego nie ma.
  const wybranyWezel = useMemo(() => {
    if (selection?.type !== 'node' && selection?.type !== 'row') return null;
    const id = selection?.primaryId ? String(selection.primaryId) : null;
    if (!id) return null;
    return (graphNodes ?? []).find((n: any) => String(n?.id) === id) ?? null;
  }, [selection, graphNodes]);
  const wybranaKrawedz = useMemo(() => {
    if (selection?.type !== 'edge' || !selection?.primaryId) return null;
    return (
      (graphEdges ?? []).find((e: any) => String(e?.id) === String(selection.primaryId)) ?? null
    );
  }, [selection, graphEdges]);
  const maZaznaczenie = Boolean(wybranyWezel || wybranaKrawedz);
  /** IDE-025: szczegóły elementu mieszkają w panelu, nie w osobnym oknie. */
  const detaleWPanelu = isIdeaDetailsInPanelEnabled();
  /**
   * Czy drawer FAKTYCZNIE wportalował się do slotu. Nie wystarczy sama flaga:
   * użytkownik może mieć element tylko ZAZNACZONY (bez otwartych szczegółów) —
   * wtedy slot jest pusty i karta inspektora zostaje jedyną treścią sekcji.
   * Gasimy dubel dopiero, gdy szczegóły realnie są. `MutationObserver`, bo
   * `createPortal` nie zgłasza montażu rodzicowi w żaden inny sposób.
   */
  const [slotMaTresc, setSlotMaTresc] = useState(false);
  useEffect(() => {
    if (!detaleWPanelu || typeof MutationObserver === 'undefined') {
      setSlotMaTresc(false);
      return;
    }
    const sprawdz = () => {
      const el = document.getElementById(IDEA_ELEMENT_DETAILS_SLOT_ID);
      setSlotMaTresc(Boolean(el && el.childElementCount > 0));
    };
    sprawdz();
    const obs = new MutationObserver(sprawdz);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, [detaleWPanelu]);
  const etykieta6 = isPl ? IDEA_PANEL_6_LABELS_PL : IDEA_PANEL_6_LABELS_EN;
  const pl6 = (pl: string, en: string) => (isPl ? pl : en);

  /** Uczciwy pusty stan sekcji — mówi CZEGO brakuje i CO zrobić. */
  const pustaSekcja = (tekst: string, podpowiedz?: string) => (
    <div
      className="rounded-[11px] border border-c-border-subtle bg-c-surface-raised px-3 py-4 text-center"
      data-testid="idea-panel6-empty"
    >
      <MousePointerClick size={16} className="mx-auto mb-1.5 text-c-text-muted" />
      <div className="text-[11px] text-c-text-secondary">{tekst}</div>
      {podpowiedz && <div className="mt-1 text-[10px] text-c-text-muted">{podpowiedz}</div>}
    </div>
  );

  // Statystyki Przeglądu (§4 pkt 3) — liczone z żywego grafu, który panel i tak
  // dostaje. Bez zaokrągleń i bez „liczb-atrap": gdy grafu nie ma, karta się
  // nie renderuje.
  const statystyki = useMemo(() => {
    const nodes = graphNodes ?? [];
    const edges = graphEdges ?? [];
    const zWejsciem = new Set(edges.map((e: any) => e?.target));
    return {
      elementy: nodes.length,
      relacje: edges.length,
      // Gałęzie/kroki/wiersze = elementy bez krawędzi wchodzącej (korzenie).
      korzenie: nodes.filter((n: any) => !zWejsciem.has(n?.id)).length,
      dowody: evidenceCount,
    };
  }, [graphNodes, graphEdges, evidenceCount]);

  /**
   * Blok SESJI TABLICY (mount panelu sesji + rola/faza/uczestnicy + rejestr
   * wyników). Wyciągnięty ze środka „Inspektora tablicy", bo w układzie 6 sekcji
   * ma DWA adresy: przy fladze OFF zostaje tam, gdzie był (Właściwości), przy ON
   * przenosi się do „Narzędzia" — to opis NARZĘDZIA, nie zaznaczonego elementu.
   * Jeden byt, dwa miejsca renderu — bez kopiowania JSX.
   */
  /**
   * Panel sesji ląduje w prawym panelu przy DWÓCH niezależnych flagach:
   *   • `ff_whiteboardSessionInPanel` — starsza, punktowa (07-26, sekcja
   *     „Właściwości"); nigdy nie została domyślnie włączona.
   *   • `ff_ideaPanel6Sections` — układ sześciu sekcji (07-28); tam panel sesji
   *     jest częścią sekcji „Narzędzie" razem ze Scenami.
   * Jedna flaga wystarczy — inaczej ON na samych sześciu sekcjach zostawiałby
   * Warstwę sesji pływającą nad płótnem wbrew zgłoszeniu właściciela.
   */
  const sesjaTablicyWPanelu = isWhiteboardSessionInPanelEnabled() || szesc;
  const slotSesjiTablicy = sesjaTablicyWPanelu ? (
    /* Naprawa 2026-07-26 (Zadanie A, `ff_whiteboardSessionInPanel`, default OFF):
       mount point dla `WhiteboardSessionPanel` (Facilitator/Board mode/Voting/
       Follow-me/WORKSHOP PHASE/Ops+Governance), portalowanego tu z
       `IdeaWhiteboardTool` gdy flaga ON — patrz `usePortalSlot` +
       `whiteboardSessionInPanelFlag.ts`. Renderowany tylko gdy flaga włączona,
       żeby przy OFF (dziś) nie zostawiać pustego diva w drzewie. */
    <div id={WHITEBOARD_SESSION_PANEL_SLOT_ID} />
  ) : null;

  const blokSesjiTablicy = (
    <>
      {whiteboardSession && (
        <div className="rounded-lg bg-slate-50 dark:bg-navy-800/60 p-2.5 space-y-1.5">
          <div className="font-semibold text-slate-700 dark:text-slate-200">
            {t('myWorkIdeas.workspaceTools.session')}
          </div>
          {whiteboardSession.role && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 dark:text-slate-400">
                {t('myWorkIdeas.workspaceTools.role')}
              </span>
              <span className="font-medium text-slate-700 dark:text-slate-200 capitalize">
                {whiteboardSession.role}
              </span>
            </div>
          )}
          {whiteboardSession.phase && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 dark:text-slate-400">
                {t('myWorkIdeas.workspaceTools.phase')}
              </span>
              <span className="font-medium text-slate-700 dark:text-slate-200 capitalize">
                {whiteboardSession.phase}
              </span>
            </div>
          )}
          {(whiteboardSession.participantCount ?? 0) > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 dark:text-slate-400">
                {t('myWorkIdeas.workspaceTools.participants')}
              </span>
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {whiteboardSession.participantCount}
              </span>
            </div>
          )}
        </div>
      )}

      {whiteboardOutcomes && whiteboardOutcomes.length > 0 && (
        <div className="rounded-lg bg-slate-50 dark:bg-navy-800/60 p-2.5 space-y-1.5">
          <div className="font-semibold text-slate-700 dark:text-slate-200">
            {t('myWorkIdeas.workspaceTools.outcomes')} ({whiteboardOutcomes.length})
          </div>
          <div className="space-y-1 max-h-32 overflow-auto">
            {whiteboardOutcomes.slice(0, 8).map((o, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-[9px] font-bold uppercase text-slate-600 w-14 shrink-0">
                  {o.type}
                </span>
                <span className="text-slate-600 dark:text-slate-300 truncate">{o.label}</span>
              </div>
            ))}
            {whiteboardOutcomes.length > 8 && (
              <div className="text-[9px] text-slate-600">
                +{whiteboardOutcomes.length - 8} {t('myWorkIdeas.workspaceTools.more')}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );

  if (!embedded && !open) return null;

  return (
    <ToolsPanelShell
      title={title || t('myWorkIdeas.workspaceTools.untitled')}
      subtitle={toolLabel}
      embedded={embedded}
      icon={
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-sm shadow-amber-500/20">
          <Lightbulb size={13} className="text-white" />
        </div>
      }
      onClose={onClose}
    >
      <TrybZakladki.Provider value={!!onlySection}>
        <PanelVisual.Provider value={visualV2 || szesc}>
          {/*
           * P2-4 (Z2): OFF → `contents` (kontener znika z layoutu, struktura 1:1 z dziś).
           * ON → kontener z paddingiem + odstępem 12 px między kartami; `[&>*]:shrink-0`
           * gwarantuje, że karty NIE kurczą się przy przewijaniu (07_PRAWY_PANEL.md §3).
           * Układ 6 sekcji zawsze używa wersji kartowej — inaczej sekcje zlewałyby się
           * w jedną kolumnę bez oddechu.
           */}
          <div
            className={visualV2 || szesc ? 'flex flex-col gap-3 p-3.5 [&>*]:shrink-0' : 'contents'}
          >
            {/*
             * ── NAGŁÓWEK PRZEDMIOTU (układ 6 sekcji) ──
             * Jedno zdanie, które za każdym razem odpowiada na pytanie „o czym teraz
             * jest ten panel". Bez niego przełączanie treści przy zaznaczeniu wygląda
             * jak zniknięcie zawartości.
             */}
            {szesc && (
              <div
                className="flex items-center gap-2 rounded-[11px] border border-c-border-subtle bg-c-surface-raised px-3 py-2"
                data-testid="idea-panel6-subject"
                data-subject={maZaznaczenie ? 'element' : 'idea'}
              >
                <span className="text-c-text-muted shrink-0">
                  {maZaznaczenie ? <MousePointerClick size={12} /> : <Lightbulb size={12} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[9px] font-bold uppercase tracking-[0.08em] text-c-text-muted">
                    {maZaznaczenie
                      ? pl6('Zaznaczony element', 'Selected element')
                      : pl6('Cała Idea', 'Whole idea')}
                  </div>
                  <div className="truncate text-[11px] font-semibold text-c-text">
                    {maZaznaczenie
                      ? wybranyWezel?.data?.label ||
                        wybranaKrawedz?.data?.label ||
                        wybranaKrawedz?.label ||
                        pl6('(bez etykiety)', '(no label)')
                      : title || t('myWorkIdeas.workspaceTools.untitled')}
                  </div>
                </div>
                <span className="shrink-0 rounded-md bg-c-surface px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-c-text-muted">
                  {etykieta6[sekcja6 ?? 'overview']}
                </span>
              </div>
            )}

            {/* ── 1. Problem ── */}
            {pokaz('overview') && (!szesc || !maZaznaczenie) && (
              <Section
                title={t('myWorkIdeas.workspaceTools.problem')}
                icon={<Pencil size={12} />}
                defaultOpen
              >
                <div className="space-y-2.5">
                  <div>
                    <input
                      value={title}
                      onChange={(e) => onTitleChange(e.target.value)}
                      placeholder={t('myWorkIdeas.workspaceTools.challengeTitle')}
                      className={`${FIELD_CLASS} font-semibold`}
                    />
                  </div>
                  <div>
                    <textarea
                      value={seedText}
                      onChange={(e) => onSeedTextChange(e.target.value)}
                      rows={4}
                      placeholder={t('myWorkIdeas.workspaceTools.describeProblemIdea')}
                      className={`${FIELD_CLASS} h-auto py-2 resize-none`}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={onSave}
                      disabled={saving || isDraft}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 text-white dark:bg-white dark:text-slate-900 transition-colors hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-40"
                    >
                      <Save size={12} />
                      {t('myWorkIdeas.workspaceTools.save')}
                    </button>
                    {!isAccepted && (
                      <button
                        onClick={onAcceptChallenge}
                        disabled={saving || isDraft || !seedText.trim()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-amber-500 to-amber-500 text-white shadow-sm transition-all hover:shadow-md disabled:opacity-40"
                      >
                        <CheckCircle2 size={12} />
                        {t('myWorkIdeas.workspaceTools.accept')}
                      </button>
                    )}
                    {isAccepted && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 size={12} />
                        {t('myWorkIdeas.workspaceTools.accepted')}
                      </span>
                    )}
                  </div>
                </div>
              </Section>
            )}

            {/* ── 2. Status ── */}
            {pokaz('overview') && (!szesc || !maZaznaczenie) && (
              <Section
                title={t('myWorkIdeas.workspaceTools.status')}
                icon={<CheckCircle2 size={12} />}
                defaultOpen
                badge={
                  <span
                    className={`inline-flex items-center gap-1 rounded-lg bg-gradient-to-r ${stageColor} px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide`}
                  >
                    <span className="w-1 h-1 rounded-full bg-current opacity-70" />
                    {stageLabel}
                  </span>
                }
              >
                <div className="space-y-3">
                  {/* Stage selector */}
                  <div>
                    <div className="text-[10px] font-medium text-slate-600 dark:text-slate-500 mb-1.5">
                      {t('myWorkIdeas.workspaceTools.stage')}
                    </div>
                    <div className="relative">
                      <button
                        onClick={() => !isDraft && setStageDropdownOpen((v) => !v)}
                        disabled={isDraft}
                        className={`inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r ${stageColor} px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide shadow-sm transition-all disabled:opacity-50`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                        {stageLabel}
                        {!isDraft && <ChevronDown size={10} className="opacity-60" />}
                      </button>
                      {canAdvance && onStageChange && v5Stage !== 'converted' && (
                        <button
                          onClick={() => onStageChange(IDEA_STAGES_V5[nextVisibleStageIdx])}
                          className="ml-2 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-c-info hover:bg-c-info/5 transition-colors"
                        >
                          →{' '}
                          {isPl
                            ? IDEA_STAGE_BUCKET_LABELS[
                                bucketIdeaStageForList(IDEA_STAGES_V5[nextVisibleStageIdx])
                              ].pl
                            : IDEA_STAGE_BUCKET_LABELS[
                                bucketIdeaStageForList(IDEA_STAGES_V5[nextVisibleStageIdx])
                              ].en}
                        </button>
                      )}
                      {stageDropdownOpen && (
                        <div className="absolute top-full left-0 mt-1 z-[120] w-48 rounded-xl bg-white dark:bg-navy-900 shadow-xl py-1">
                          {STAGE_BUCKET_OPTIONS.map(({ bucket, representative }) => {
                            const label = isPl
                              ? IDEA_STAGE_BUCKET_LABELS[bucket].pl
                              : IDEA_STAGE_BUCKET_LABELS[bucket].en;
                            const isActive = bucket === stageBucket;
                            return (
                              <button
                                key={bucket}
                                onClick={() => {
                                  // Re-picking the current bucket keeps today's granular
                                  // V5 value (no silent regression to the bucket's first
                                  // sub-stage); picking a different bucket jumps to it.
                                  onStageChange?.(isActive ? v5Stage : representative);
                                  setStageDropdownOpen(false);
                                }}
                                className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors ${
                                  isActive
                                    ? 'font-semibold text-c-info bg-c-info/5'
                                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.03]'
                                }`}
                              >
                                <span
                                  className={`inline-block w-1.5 h-1.5 rounded-full mr-2 bg-gradient-to-r ${IDEA_STAGE_COLORS[representative].split(' ')[0]} ${IDEA_STAGE_COLORS[representative].split(' ')[1]}`}
                                />
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Save status + evidence */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[10px] text-slate-600 dark:text-slate-500">
                      {draftSavedLabel}
                    </span>
                    {evidenceCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-slate-600 dark:text-slate-500">
                        <FileText size={10} />
                        {evidenceCount} {t('myWorkIdeas.workspaceTools.evidence')}
                      </span>
                    )}
                  </div>

                  {/* AI actions row */}
                  <div className="flex items-center gap-1.5">
                    {onAISummarize && (
                      <button
                        onClick={onAISummarize}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-c-info hover:text-c-info/80 hover:bg-c-info/5 transition-colors"
                      >
                        <Sparkles size={10} />
                        {t('myWorkIdeas.workspaceTools.aiSummarize')}
                      </button>
                    )}
                    {onAIExpand && (
                      <button
                        onClick={onAIExpand}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-c-info/10 text-c-info hover:bg-c-info/15 transition-colors"
                      >
                        <Sparkles size={10} />
                        {t('myWorkIdeas.workspaceTools.aiExpand')}
                      </button>
                    )}
                  </div>

                  {/* Completeness */}
                  {graphNodes.length > 0 && (
                    <IdeaCompletenessWidget
                      nodes={graphNodes}
                      edges={graphEdges}
                      title={title}
                      seedText={seedText}
                    />
                  )}

                  {/*
                   * UI-L16 (Editor Shell Canon §2 PRAWA): metadata (branch/area/priority)
                   * is folded into Status as a secondary sub-group instead of a 6th top-level
                   * section — keeping the inspector at ≤5 visible sections.
                   */}
                  <div className="pt-1 border-t border-slate-200/50 dark:border-white/[0.04]">
                    <div className="text-[10px] font-medium text-slate-600 dark:text-slate-500 mb-1.5">
                      {t('myWorkIdeas.workspaceTools.metadata')}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {/* Branch pill */}
                      {branchEditing ? (
                        <input
                          ref={branchRef}
                          value={branch}
                          onChange={(e) => onBranchChange(e.target.value)}
                          onBlur={handleBranchBlur}
                          onKeyDown={(e) => e.key === 'Enter' && handleBranchBlur()}
                          placeholder={t('myWorkIdeas.workspaceTools.branch')}
                          autoFocus
                          className="h-7 px-2.5 rounded-lg text-xs bg-slate-50 dark:bg-navy-800 border border-c-focus-solid text-slate-700 dark:text-slate-300 outline-none w-28"
                        />
                      ) : (
                        <button
                          onClick={() => setBranchEditing(true)}
                          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-medium bg-slate-50 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
                        >
                          <GitBranch size={11} className="text-slate-600 shrink-0" />
                          {branch || t('myWorkIdeas.workspaceTools.branch2')}
                        </button>
                      )}

                      {/* Area pill */}
                      {areaEditing ? (
                        <input
                          ref={areaRef}
                          value={area}
                          onChange={(e) => onAreaChange(e.target.value)}
                          onBlur={handleAreaBlur}
                          onKeyDown={(e) => e.key === 'Enter' && handleAreaBlur()}
                          placeholder={t('myWorkIdeas.workspaceTools.area')}
                          autoFocus
                          className="h-7 px-2.5 rounded-lg text-xs bg-slate-50 dark:bg-navy-800 border border-c-focus-solid text-slate-700 dark:text-slate-300 outline-none w-28"
                        />
                      ) : (
                        <button
                          onClick={() => setAreaEditing(true)}
                          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-medium bg-slate-50 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
                        >
                          {area || t('myWorkIdeas.workspaceTools.area2')}
                        </button>
                      )}

                      {/* Priority badge */}
                      <div className="relative">
                        <button
                          onClick={() => setPriorityOpen((v) => !v)}
                          className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-medium transition-colors ${PRIORITY_COLORS[normalizedPriority]}`}
                        >
                          {currentPriorityLabel}
                          <ChevronDown size={10} className="opacity-60" />
                        </button>
                        {priorityOpen && (
                          <div className="absolute top-full left-0 mt-1 z-[120] w-32 rounded-xl bg-white dark:bg-navy-900 shadow-xl py-1">
                            {priorityOptions.map((o) => (
                              <button
                                key={o.value}
                                onClick={() => handlePrioritySelect(o.value)}
                                className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                                  o.value === normalizedPriority
                                    ? 'font-semibold text-c-info bg-c-info/5'
                                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.03]'
                                }`}
                              >
                                <span
                                  className={`inline-block w-2 h-2 rounded-full mr-2 ${PRIORITY_COLORS[o.value].split(' ')[0]}`}
                                />
                                {o.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Section>
            )}

            {/*
             * ── Przegląd · Statystyki (07_PRAWY_PANEL.md §4 pkt 3) ──
             * Siatka 2×2 liczona z żywego grafu. Tylko w trybie zakładek — w szufladzie
             * legacy zachowujemy dzisiejszy układ 1:1 (zero zmian wizualnych bez akceptu).
             */}
            {sek('overview', 'overview') &&
              (!szesc || !maZaznaczenie) &&
              statystyki.elementy > 0 && (
                <Section
                  title={t('myWorkIdeas.workspaceTools.statistics')}
                  icon={<BarChart3 size={12} />}
                  defaultOpen
                >
                  <div className="grid grid-cols-2 gap-2" data-testid="idea-panel-overview-stats">
                    {[
                      { k: 'statElements', v: statystyki.elementy },
                      { k: 'statRelations', v: statystyki.relacje },
                      { k: 'statRoots', v: statystyki.korzenie },
                      { k: 'statEvidence', v: statystyki.dowody },
                    ].map(({ k, v }) => (
                      <div
                        key={k}
                        className="rounded-[11px] border border-c-border-subtle bg-c-surface-raised px-3 py-2"
                      >
                        <div className="text-[15px] font-bold tabular-nums text-c-text">{v}</div>
                        <div className="text-[10px] text-c-text-muted">
                          {t(`myWorkIdeas.workspaceTools.${k}`)}
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

            {/*
             * ── Przegląd · TOŻSAMOŚĆ ELEMENTU (układ 6 sekcji, kontekst elementu) ──
             * Odpowiednik „Problemu + Statusu" na poziomie Idei: kim jest ten element.
             * Czytamy WYŁĄCZNIE to, co element realnie niesie (`data` węzła + meta
             * zaznaczenia) — pola bez wartości się nie renderują, zamiast pokazywać
             * puste etykiety. Edycja pól mieszka we „Właściwościach", nie tutaj.
             */}
            {szesc && sekcja6 === 'overview' && maZaznaczenie && (
              <Section
                title={pl6('Tożsamość', 'Identity')}
                icon={<LayoutDashboard size={12} />}
                defaultOpen
              >
                {(() => {
                  const d = (wybranyWezel?.data ?? {}) as Record<string, any>;
                  const m = (selection?.meta ?? {}) as Record<string, any>;
                  const wiersze: Array<{ k: string; v: string }> = [];
                  const dodaj = (k: string, v: unknown) => {
                    const s = v === null || v === undefined ? '' : String(v).trim();
                    if (s) wiersze.push({ k, v: s });
                  };
                  dodaj(
                    pl6('Typ', 'Type'),
                    d.semanticType ||
                      m.semanticType ||
                      wybranyWezel?.type ||
                      m.nodeType ||
                      (wybranaKrawedz ? pl6('połączenie', 'connection') : '')
                  );
                  dodaj(pl6('Nazwa', 'Name'), d.label || m.label || wybranaKrawedz?.data?.label);
                  dodaj(pl6('Status', 'Status'), d.status || m.status);
                  dodaj(pl6('Priorytet', 'Priority'), d.priority ?? m.priority);
                  dodaj(pl6('Właściciel', 'Owner'), d.owner || d.assignee || m.owner);
                  return (
                    <div className="space-y-1.5" data-testid="idea-panel6-identity">
                      {wiersze.length === 0
                        ? pustaSekcja(
                            pl6(
                              'Ten element nie ma jeszcze żadnych opisanych pól.',
                              'This element has no described fields yet.'
                            ),
                            pl6(
                              'Uzupełnij je we „Właściwościach".',
                              'Fill them in under “Properties”.'
                            )
                          )
                        : wiersze.map(({ k, v }) => (
                            <div key={k} className="flex items-start gap-2 text-[11px]">
                              <span className="w-20 shrink-0 text-c-text-muted">{k}</span>
                              <span className="min-w-0 flex-1 break-words font-medium text-c-text">
                                {v}
                              </span>
                            </div>
                          ))}
                      {selection && selection.count > 1 && (
                        <div className="pt-1 text-[10px] text-c-text-muted">
                          {pl6(
                            `Zaznaczono ${selection.count} elementów — panel opisuje pierwszy.`,
                            `${selection.count} elements selected — the panel describes the first one.`
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </Section>
            )}

            {/* ── 3. Convert ── */}
            {wLegacy && (
              <Section title={t('myWorkIdeas.workspaceTools.convert')} icon={<Rocket size={12} />}>
                {selection.type !== 'none' && selection.count > 0 && (
                  <div className="mb-2 text-[10px] font-medium text-c-info bg-c-info/5 rounded-lg px-2 py-1.5">
                    {t('myWorkIdeas.workspaceTools.convertSelectionCount', {
                      value: selection.count,
                    })}
                  </div>
                )}
                <div className="space-y-3">
                  {convertGroups.map(({ group, label, items }) => (
                    <div key={group}>
                      {/* Group separator + label */}
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          {label}
                        </span>
                        <span className="h-px flex-1 bg-slate-200/60 dark:bg-white/[0.05]" />
                      </div>
                      <div className="grid grid-cols-1 gap-1.5">
                        {items.map(
                          ({
                            id,
                            status,
                            icon: Icon,
                            labelPl,
                            labelEn,
                            descPl,
                            descEn,
                            gradient,
                            textColor,
                          }) => {
                            const isSoon = status === 'soon';
                            // `soon` targets have no server handler — keep them visible but inert so we never
                            // fire a request that returns a raw 400 (CANON §4). `live` targets convert for real.
                            return (
                              <button
                                key={id}
                                onClick={() => !isSoon && onConvert(id)}
                                disabled={isDraft || isSoon}
                                aria-disabled={isDraft || isSoon}
                                title={
                                  isSoon ? t('myWorkIdeas.workspaceTools.comingSoon') : undefined
                                }
                                className="group relative flex items-center gap-2.5 px-3 py-2 rounded-xl overflow-hidden transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <div
                                  className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-100 group-hover:opacity-80 transition-opacity`}
                                />
                                <div
                                  className={`relative w-6 h-6 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center ${textColor} shrink-0`}
                                >
                                  <Icon size={12} />
                                </div>
                                <div className="relative flex-1 min-w-0 text-left">
                                  <div
                                    className={`text-[11px] font-semibold ${textColor} flex items-center gap-1.5`}
                                  >
                                    {isPl ? labelPl : labelEn}
                                    {isSoon && (
                                      <span className="text-[8px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-200/70 dark:bg-navy-700 rounded px-1 py-px">
                                        {t('myWorkIdeas.workspaceTools.soon')}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[9px] text-slate-600 dark:text-slate-500">
                                    {isPl ? descPl : descEn}
                                  </div>
                                </div>
                              </button>
                            );
                          }
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/*
             * Inspektor tablicy. W układzie 6 sekcji rozpada się na dwa adresy:
             *   • zaznaczony element → „Właściwości" (karta elementu),
             *   • sesja / wyniki warsztatu → „Narzędzie" (opisują NARZĘDZIE, nie element).
             * Dlatego blok renderuje się we „Właściwościach" tylko przy zaznaczeniu,
             * a części sesyjne mają własny warunek niżej.
             */}
            {/* IDE-025: w układzie 6 sekcji z ZADOKOWANYMI szczegółami ta karta nie ma
          już czym się wypełnić (części sesyjne mieszkają w „Narzędziu", a blok
          nazwy zgasł jako dubel) — więc nie rysujemy pustego nagłówka. */}
            {activeTool === 'whiteboard' &&
              pokaz('properties') &&
              (!szesc || Boolean(wybranyWezel)) &&
              !(szesc && slotMaTresc) && (
                <Section
                  title={t('myWorkIdeas.workspaceTools.whiteboardInspector')}
                  icon={<Activity size={12} />}
                  defaultOpen
                >
                  <div className="space-y-3 text-[11px]">
                    {/* W układzie 6 sekcji panel sesji mieszka w „Narzędziu" (niżej). */}
                    {!szesc && slotSesjiTablicy}

                    {/* Selected node info — IDE-025: gaśnie, gdy szczegóły elementu są
                już zadokowane niżej w tej samej sekcji. Bez tego nazwa
                zaznaczonego elementu powtarzała się TRZY razy pod rząd
                (nagłówek „ZAZNACZONY ELEMENT" + ta karta + tytuł drawera). */}
                    {!slotMaTresc &&
                      selection.type === 'node' &&
                      selection.primaryId &&
                      (() => {
                        const node = (graphNodes ?? []).find(
                          (n: any) => n.id === selection.primaryId
                        );
                        if (!node) return null;
                        return (
                          <div className="rounded-lg bg-slate-50 dark:bg-navy-800/60 p-2.5 space-y-1.5">
                            <div className="font-semibold text-slate-700 dark:text-slate-200">
                              {t('myWorkIdeas.workspaceTools.selectedElement')}
                            </div>
                            <div className="text-slate-600 dark:text-slate-300 truncate">
                              {node.data?.label || t('myWorkIdeas.workspaceTools.noLabel')}
                            </div>
                            {node.data?.semanticType && (
                              <div className="text-[9px] font-bold uppercase tracking-wide text-c-info">
                                {String(node.data.semanticType)}
                              </div>
                            )}
                            {node.data?.locked && (
                              <div className="text-[9px] text-amber-600 dark:text-amber-400">
                                {t('myWorkIdeas.workspaceTools.locked')}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                    {/* Sesja + rejestr wyników: przy fladze 6 sekcji przenoszą się
                do „Narzędzia" (ten sam blok, inny adres). */}
                    {!szesc && blokSesjiTablicy}
                  </div>
                </Section>
              )}

            {activeTool === 'process_flow' && pokaz('properties') && (!szesc || maZaznaczenie) && (
              <Section
                title={t('myWorkIdeas.workspaceTools.processInspector')}
                icon={<Activity size={12} />}
                defaultOpen
              >
                <ProcessFlowPropertiesPanel
                  selectedNode={
                    selection.type === 'node' && selection.primaryId
                      ? ((graphNodes ?? []).find((n: any) => n.id === selection.primaryId) ?? null)
                      : null
                  }
                  selectedEdge={
                    selection.type === 'edge' && selection.primaryId
                      ? ((graphEdges ?? []).find((e: any) => e.id === selection.primaryId) ?? null)
                      : null
                  }
                  lanes={processFlowLanes ?? []}
                  isPl={isPl}
                  locked={saving}
                  onNodeLabelChange={onProcessFlowNodeLabelChange ?? (() => {})}
                  onGatewayKindChange={onProcessFlowGatewayKindChange ?? (() => {})}
                  onLaneChange={onProcessFlowLaneChange ?? (() => {})}
                  onEdgeLabelChange={onProcessFlowEdgeLabelChange ?? (() => {})}
                  onNodeMetricsChange={onProcessFlowNodeMetricsChange ?? (() => {})}
                  onEdgeConditionChange={onProcessFlowEdgeConditionChange as any}
                  onNodeMetadataChange={onProcessFlowNodeMetadataChange}
                />
              </Section>
            )}

            {/* Kondycja przepływu — w układzie 6 sekcji to treść AI, nie Przeglądu.
          Zostaje TAKŻE przy zaznaczeniu: kondycja opisuje CAŁY diagram, a
          kliknięcie braku zaznacza winne kroki — gdyby karta wtedy znikała,
          przejście do problemu działałoby raz i nie dałoby się kliknąć
          kolejnego braku. */}
            {activeTool === 'process_flow' && pokaz('overview', 'ai') && (
              <Section
                title={t('myWorkIdeas.workspaceTools.processHealth')}
                icon={<Activity size={13} />}
              >
                <ProcessFlowHealthScore
                  nodes={graphNodes ?? []}
                  edges={graphEdges ?? []}
                  isPl={isPl}
                />
              </Section>
            )}

            {/* ── IDE-025: SLOT szczegółów elementu ──
          Cel portalu dla `UnifiedNodeDetailDrawer` (wielkie okno, które
          właściciel kazał przenieść do panelu). Stoi PRZED inspektorem stylu,
          bo najpierw czytasz CZYM jest element, a dopiero potem go stylujesz.
          Drawer sam sprawdza obecność slotu — przy jego braku wraca do
          dotychczasowej nakładki, więc treść nigdy nie znika. */}
            {szesc && sekcja6 === 'properties' && maZaznaczenie && detaleWPanelu && (
              <div id={IDEA_ELEMENT_DETAILS_SLOT_ID} data-testid="idea-element-details-slot" />
            )}

            {activeTool === 'mindmap' && (
              <>
                {/* ── 5. Mindmap Inspector (Style / Layout / Theme) ──
              W układzie 6 sekcji: z zaznaczeniem = „Właściwości" (styl węzła);
              bez zaznaczenia ustawienia reprezentacji przenoszą się do
              „Narzędzia" (osobny blok niżej) — tam opisują NARZĘDZIE, nie element. */}
                {pokaz('properties') && (!szesc || maZaznaczenie) && (
                  <Section
                    title={t('myWorkIdeas.workspaceTools.mapInspector')}
                    icon={<Sparkles size={12} />}
                    defaultOpen
                  >
                    <MindmapInspector
                      selectedNodeId={selection.type === 'node' ? selection.primaryId : undefined}
                      selectedNodeData={
                        selection.type === 'node' && selection.primaryId
                          ? graphNodes.find((n: any) => n.id === selection.primaryId)?.data
                          : undefined
                      }
                      currentStructure="mindmap"
                      currentLayoutMode="tree"
                      onUpdateNode={(nodeId, patch) => onStyleChange?.({ nodeId, ...patch })}
                      onSetStructure={(s) => onLayoutChange?.(`structure_${s}`)}
                      onSetLayoutMode={(m) => onLayoutChange?.(m)}
                      onApplyTheme={(t) => onThemeChange?.(t)}
                    />
                  </Section>
                )}

                {/* ── 6. Map Health ── (6 sekcji: treść AI, nie Przeglądu)
              Zostaje TAKŻE przy zaznaczeniu — patrz komentarz przy kondycji
              przepływu: klik w brak zaznacza węzły, więc znikająca lista
              zabijałaby własną funkcję po pierwszym użyciu. */}
                {pokaz('overview', 'ai') && (
                  <Section
                    title={t('myWorkIdeas.workspaceTools.mapHealth')}
                    icon={<Activity size={13} />}
                  >
                    <MapHealthScore
                      nodes={graphNodes.map((n: any) => ({ id: n.id, data: n.data, type: n.type }))}
                      // `type`/`data` są tu POTRZEBNE: widget rozróżnia krawędzie
                      // strukturalne od relacji użytkownika (edgeRole/`labeled`), a
                      // wcześniejsze okrojenie do {source,target} kasowało ten sygnał.
                      edges={graphEdges.map((e: any) => ({
                        id: e.id,
                        source: e.source,
                        target: e.target,
                        type: e.type,
                        data: e.data,
                      }))}
                      visible
                      // Układ 6 sekcji: karta wypełnia sekcję „AI". Bez tego widget
                      // niósłby swoje `absolute top-14 right-3` także w panelu (to
                      // właśnie było „Map Health wpada mi w okno"). Przy fladze OFF
                      // zostaje dzisiejsze zachowanie 1:1.
                      embedded={szesc}
                    />
                  </Section>
                )}
              </>
            )}

            {/*
             * ── Powiązania (§6) ──
             * Treść to REUŻYCIE `<IdeaContextPanel embedded>` — ten sam komponent,
             * który w ścieżce legacy siedzi w sekcji „Powiązania" `IdeaRightPanel`
             * (backlinki · artefakty · inicjatywy · luki assessmentu · insighty · KPI ·
             * podobne idee · notatki i dowody). Nie budujemy drugiego widoku powiązań.
             * Dlatego renderujemy go WYŁĄCZNIE w trybie zakładek — w szufladzie legacy
             * ta treść już jest piętro wyżej i powstałby dubel.
             */}
            {sek('relations', 'relations') && (
              <Section
                title={t('myWorkIdeas.workspaceTools.relations')}
                icon={<Link2 size={12} />}
                defaultOpen
              >
                <div data-testid="idea-panel-relations">
                  <IdeaContextPanel
                    open
                    embedded
                    onClose={onClose}
                    ideaId={ideaId}
                    title={title}
                    selectedNodeId={selection.type === 'node' ? selection.primaryId : null}
                    selectionMeta={selection.meta ?? null}
                    liveGraphNodes={graphNodes}
                    liveGraphEdges={graphEdges}
                    mapExtensions={mapExtensions}
                    activeTool={activeTool}
                    stage={stage}
                    seedText={seedText}
                    onInsertToCanvas={onInsertContextToCanvas}
                  />
                </div>
              </Section>
            )}

            {/* ── Komentarze (§7) — first-class, nie szczegół elementu.
             W układzie 6 sekcji scalone z Historią w „Aktywność" (niżej). ── */}
            {!szesc && wZakladce('comments') && (
              <Section
                title={t('myWorkIdeas.workspaceTools.comments')}
                icon={<MessageSquare size={12} />}
                defaultOpen
              >
                <IdeaPanelComments
                  ideaId={ideaId}
                  isDraft={isDraft}
                  isPl={!!isPl}
                  selection={selection}
                  graphNodes={graphNodes ?? []}
                />
              </Section>
            )}

            {/* ── Historia (§8) — zdarzenia + wersje, AI = typ zdarzenia.
             W układzie 6 sekcji scalona z Komentarzami w „Aktywność" (niżej). ── */}
            {!szesc && wZakladce('history') && (
              <Section
                title={t('myWorkIdeas.workspaceTools.history')}
                icon={<Clock size={12} />}
                defaultOpen
              >
                <IdeaPanelHistory
                  ideaId={ideaId}
                  isDraft={isDraft}
                  isPl={!!isPl}
                  onRestoreSnapshot={onRestoreSnapshot}
                />
              </Section>
            )}

            {/*
             * ═══ SEKCJE WŁASNE UKŁADU SZEŚCIU (flaga ON) ═══
             * Renderują się WYŁĄCZNIE przy `szesc` — przy fladze OFF nie istnieją
             * w drzewie, więc stary układ jest nietknięty.
             */}

            {/* ── Właściwości bez zaznaczenia: uczciwy pusty stan ──
          Panel szczegółów wiersza Tabeli wprowadzi się tu osobnym zleceniem. */}
            {szesc && sekcja6 === 'properties' && !maZaznaczenie && (
              <Section
                title={etykieta6.properties}
                icon={<SlidersHorizontal size={12} />}
                defaultOpen
              >
                {pustaSekcja(
                  pl6(
                    'Zaznacz element, żeby zobaczyć jego pola.',
                    'Select an element to see its fields.'
                  ),
                  pl6(
                    'Ustawienia samej reprezentacji (styl, układ, motyw) są w sekcji „Narzędzie".',
                    'Representation settings (style, layout, theme) live under “Tool”.'
                  )
                )}
              </Section>
            )}

            {/*
             * ── Właściwości z zaznaczeniem, ale bez inspektora reprezentacji ──
             * Tabela nie ma inspektora w panelu (pola wiersza edytuje się w siatce),
             * a na Tablicy inspektor opisuje wyłącznie WĘZEŁ — przy zaznaczonym
             * połączeniu nie miałby czego pokazać. Bez tego bloku sekcja renderowała
             * pustą kartę z samym nagłówkiem. Docelowo mieszka tu przeskalowany panel
             * szczegółów wiersza (osobne zlecenie).
             */}
            {szesc &&
              sekcja6 === 'properties' &&
              maZaznaczenie &&
              (activeTool === 'table' || (activeTool === 'whiteboard' && !wybranyWezel)) && (
                <Section
                  title={etykieta6.properties}
                  icon={<SlidersHorizontal size={12} />}
                  defaultOpen
                >
                  {pustaSekcja(
                    activeTool === 'table'
                      ? pl6(
                          'Pola tego wiersza edytujesz w tabeli.',
                          'This row’s fields are edited in the table.'
                        )
                      : pl6(
                          'To połączenie nie ma własnych pól.',
                          'This connection has no fields of its own.'
                        ),
                    pl6(
                      'Tożsamość elementu widzisz w „Przeglądzie".',
                      'Its identity is under “Overview”.'
                    )
                  )}
                </Section>
              )}

            {/* ── AI · poziom Idei ──
          Karta rysuje się TYLKO gdy ma co pokazać. Dla Mapy myśli i Przepływu
          treścią sekcji jest kondycja (wyżej, `pokaz('overview','ai')`), więc
          bez akcji AI nie dokładamy pustej karty pod spodem. */}
            {szesc &&
              sekcja6 === 'ai' &&
              !maZaznaczenie &&
              (Boolean(onAISummarize || onAIExpand) ||
                (activeTool !== 'mindmap' && activeTool !== 'process_flow')) && (
                <Section title={etykieta6.ai} icon={<Sparkles size={12} />} defaultOpen>
                  <div className="space-y-2" data-testid="idea-panel6-ai-idea">
                    {onAISummarize || onAIExpand ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {onAISummarize && (
                          <button
                            onClick={onAISummarize}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-c-info hover:bg-c-info/5 transition-colors"
                          >
                            <Sparkles size={10} />
                            {t('myWorkIdeas.workspaceTools.aiSummarize')}
                          </button>
                        )}
                        {onAIExpand && (
                          <button
                            onClick={onAIExpand}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-c-info/10 text-c-info hover:bg-c-info/15 transition-colors"
                          >
                            <Sparkles size={10} />
                            {t('myWorkIdeas.workspaceTools.aiExpand')}
                          </button>
                        )}
                      </div>
                    ) : (
                      // Zero martwych przycisków (Z3): akcje AI mają wykonawcę wyłącznie
                      // tam, gdzie host go podłączył. Bez handlera mówimy to wprost.
                      activeTool !== 'mindmap' &&
                      activeTool !== 'process_flow' &&
                      pustaSekcja(
                        pl6(
                          'To narzędzie nie ma jeszcze własnych podpowiedzi AI.',
                          'This tool has no AI suggestions of its own yet.'
                        ),
                        pl6(
                          'Rozmowę z Teresą otwierasz z Menu 1.',
                          'Open the chat with Teresa from Menu 1.'
                        )
                      )
                    )}
                  </div>
                </Section>
              )}

            {/* ── AI · poziom elementu ── */}
            {szesc && sekcja6 === 'ai' && maZaznaczenie && (
              <Section title={etykieta6.ai} icon={<Sparkles size={12} />} defaultOpen>
                {onAINodeAction && wybranyWezel ? (
                  <div className="grid grid-cols-1 gap-1.5" data-testid="idea-panel6-ai-element">
                    {[
                      {
                        akcja: 'mm_ai_expand_node',
                        label: pl6('Rozbuduj temat', 'Expand this topic'),
                      },
                      { akcja: 'mm_ai_what_if', label: pl6('Kwestionuj', 'Challenge it') },
                      { akcja: 'mm_ai_deepen', label: pl6('Pogłęb', 'Go deeper') },
                      {
                        akcja: 'mm_ai_suggest_links',
                        label: pl6('Sugeruj połączenia', 'Suggest connections'),
                      },
                    ].map(({ akcja, label }) => (
                      <button
                        key={akcja}
                        type="button"
                        onClick={() => onAINodeAction(akcja, String(wybranyWezel.id))}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-c-border-subtle bg-c-surface px-2.5 py-1.5 text-[11px] font-semibold text-c-text-secondary transition-colors hover:border-c-focus hover:text-c-text"
                        data-testid={`idea-panel6-ai-${akcja}`}
                      >
                        <Sparkles size={11} className="shrink-0 text-c-info" />
                        {label}
                      </button>
                    ))}
                  </div>
                ) : (
                  pustaSekcja(
                    pl6(
                      'Akcje AI na elemencie działają na razie w Mapie myśli.',
                      'Element-level AI actions currently work in the Mind Map.'
                    ),
                    pl6(
                      'W pozostałych narzędziach użyj rozmowy z Teresą.',
                      'In the other tools, use the chat with Teresa.'
                    )
                  )
                )}
              </Section>
            )}

            {/* Gniazdo pływających paneli AI Mapy myśli (AI Blind Spots — portalowany
          tu z `IdeaRecommendationMap`). Poza kartą, żeby istniało także wtedy,
          gdy karta AI się nie renderuje; pusty węzeł nic nie rysuje.
          Renderowane NIEZALEŻNIE od zaznaczenia: Blind Spots mówią o całej
          mapie, a przycisk „Dodaj" wstawia węzeł (czyli zmienia zaznaczenie) —
          gniazdo znikające przy zaznaczeniu odmontowywałoby panel w środku
          jego własnej akcji i kasowało listę propozycji. */}
            {szesc && sekcja6 === 'ai' && <div id={IDEA_PANEL_AI_SLOT_ID} />}

            {/* ── Aktywność — Komentarze + Historia w JEDNEJ osi czasu ── */}
            {szesc && sekcja6 === 'activity' && (
              <Section title={etykieta6.activity} icon={<Clock size={12} />} defaultOpen>
                <IdeaPanelActivity
                  ideaId={ideaId}
                  isDraft={isDraft}
                  isPl={!!isPl}
                  selection={selection}
                  graphNodes={graphNodes ?? []}
                  onRestoreSnapshot={onRestoreSnapshot}
                />
              </Section>
            )}

            {/* ── Narzędzie — opisuje NARZĘDZIE, nie element (stąd brak wariantu
             „element" w tabeli układu). ── */}
            {szesc && sekcja6 === 'tool' && (
              <Section title={etykieta6.tool} icon={<Layers size={12} />} defaultOpen>
                <div className="space-y-3 text-[11px]" data-testid="idea-panel6-tool">
                  {activeTool === 'mindmap' && (
                    // Ustawienia REPREZENTACJI (struktura / układ / motyw). Bez
                    // `selectedNodeId` — styl pojedynczego węzła należy do Właściwości.
                    <MindmapInspector
                      currentStructure="mindmap"
                      currentLayoutMode="tree"
                      onUpdateNode={(nodeId, patch) => onStyleChange?.({ nodeId, ...patch })}
                      onSetStructure={(s) => onLayoutChange?.(`structure_${s}`)}
                      onSetLayoutMode={(m) => onLayoutChange?.(m)}
                      onApplyTheme={(th) => onThemeChange?.(th)}
                    />
                  )}

                  {activeTool === 'whiteboard' && (
                    <>
                      {slotSesjiTablicy}
                      {blokSesjiTablicy}
                    </>
                  )}

                  {/* Hak pod przeniesienie Scen i Warstwy sesji z płótna — osobne
                zlecenie. Pusty węzeł nic nie rysuje. */}
                  <div id={IDEA_PANEL_TOOL_SLOT_ID} />

                  {(activeTool === 'process_flow' || activeTool === 'table') &&
                    pustaSekcja(
                      pl6(
                        'To narzędzie nie ma jeszcze własnych ustawień w panelu.',
                        'This tool has no panel-level settings yet.'
                      ),
                      pl6(
                        'Układ i widok zmieniasz paskiem nad płótnem.',
                        'Layout and view are changed from the bar above the canvas.'
                      )
                    )}
                </div>
              </Section>
            )}
          </div>
        </PanelVisual.Provider>
      </TrybZakladki.Provider>
    </ToolsPanelShell>
  );
};

export default IdeaWorkspaceTools;
