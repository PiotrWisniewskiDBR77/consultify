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
  Lightbulb,
  Link2,
  ListChecks,
  MessageSquare,
  MessageSquarePlus,
  Pencil,
  Presentation,
  Rocket,
  Save,
  Shield,
  Sparkles,
  Star,
} from 'lucide-react';
import React, { useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ToolsPanelShell } from '@/components/shared/WorkspaceTools';

import { IdeaContextPanel } from './IdeaContextPanel';
import { getIdeaWorkspaceToolLabel } from './IdeaWorkspaceToolbar';
import { IdeaPanelComments } from './panel/IdeaPanelComments';
import { IdeaPanelHistory } from './panel/IdeaPanelHistory';
import { isIdeaPanelVisualEnabled } from './panel/ideaPanelVisualFlag';
import {
  IDEA_CONVERT_GROUP_LABELS,
  IDEA_CONVERT_GROUP_ORDER,
  IDEA_CONVERT_TARGETS,
  type IdeaConvertGroup,
  type IdeaConvertTarget,
} from './ideaConvertTargets';
import {
  IDEA_STAGE_COLORS,
  IDEA_STAGE_LABELS,
  IDEA_STAGES_V5,
  normalizeStageToV5,
} from './ideaEntryTypes';
import type { CanvasToolType, IdeaWorkspaceSelection } from './ideaSelectionTypes';
import { MapHealthScore } from './mindmap/MapHealthScore';
import { MindmapInspector } from './mindmap/MindmapInspector';
import { ProcessFlowHealthScore } from './processflow/ProcessFlowHealthScore';
import { ProcessFlowPropertiesPanel } from './processflow/ProcessFlowPropertiesPanel';
import { IdeaCompletenessWidget } from './table/IdeaCompletenessWidget';

const FIELD_CLASS =
  'w-full h-9 px-3 rounded-lg text-sm bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none focus:border-c-focus dark:focus:border-c-focus transition-colors';

// Convert-target union is owned by the SSOT registry (ideaConvertTargets.ts).
type ConvertTarget = IdeaConvertTarget;

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
  onRestoreSnapshot?: (
    nodes: any[],
    edges: any[],
    extensions?: Record<string, unknown>
  ) => void;
  /** Zakładka Powiązania (§6) — wstawienie pozycji kontekstu na płótno. */
  onInsertContextToCanvas?: (item: { text: string; type: string; detail?: string }) => void;
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
  mapExtensions,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language === 'pl';
  // P2-4 (Z2): warstwa wizualna panelu za flagą (domyślnie OFF = dzisiejszy wygląd 1:1).
  const visualV2 = isIdeaPanelVisualEnabled();
  const [stageDropdownOpen, setStageDropdownOpen] = useState(false);

  const v5Stage = normalizeStageToV5(stage);
  const stageLabel = isPl ? IDEA_STAGE_LABELS[v5Stage].pl : IDEA_STAGE_LABELS[v5Stage].en;
  const stageColor = IDEA_STAGE_COLORS[v5Stage];
  const stageIdx = IDEA_STAGES_V5.indexOf(v5Stage);
  const canAdvance = stageIdx >= 0 && stageIdx < IDEA_STAGES_V5.length - 1;

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
  /** Blok wspólny: legacy pokazuje go zawsze, tryb zakładek — w swojej zakładce. */
  const pokaz = (id: IdeaPanelTab) => wLegacy || wZakladce(id);

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
      <PanelVisual.Provider value={visualV2}>
      {/*
       * P2-4 (Z2): OFF → `contents` (kontener znika z layoutu, struktura 1:1 z dziś).
       * ON → kontener z paddingiem + odstępem 12 px między kartami; `[&>*]:shrink-0`
       * gwarantuje, że karty NIE kurczą się przy przewijaniu (07_PRAWY_PANEL.md §3).
       */}
      <div className={visualV2 ? 'flex flex-col gap-3 p-3.5 [&>*]:shrink-0' : 'contents'}>
      {/* ── 1. Problem ── */}
      {pokaz('overview') && (
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
      {pokaz('overview') && (
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
                  onClick={() => onStageChange(IDEA_STAGES_V5[stageIdx + 1])}
                  className="ml-2 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-c-info hover:bg-c-info/5 transition-colors"
                >
                  →{' '}
                  {isPl
                    ? IDEA_STAGE_LABELS[IDEA_STAGES_V5[stageIdx + 1]].pl
                    : IDEA_STAGE_LABELS[IDEA_STAGES_V5[stageIdx + 1]].en}
                </button>
              )}
              {stageDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 z-[120] w-48 rounded-xl bg-white dark:bg-navy-900 shadow-xl py-1">
                  {IDEA_STAGES_V5.map((s) => {
                    const label = isPl ? IDEA_STAGE_LABELS[s].pl : IDEA_STAGE_LABELS[s].en;
                    const isActive = s === v5Stage;
                    return (
                      <button
                        key={s}
                        onClick={() => {
                          onStageChange?.(s);
                          setStageDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors ${
                          isActive
                            ? 'font-semibold text-c-info bg-c-info/5'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.03]'
                        }`}
                      >
                        <span
                          className={`inline-block w-1.5 h-1.5 rounded-full mr-2 bg-gradient-to-r ${IDEA_STAGE_COLORS[s].split(' ')[0]} ${IDEA_STAGE_COLORS[s].split(' ')[1]}`}
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
      {wZakladce('overview') && statystyki.elementy > 0 && (
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

      {/* ── 3. Convert ── */}
      {wLegacy && (
      <Section title={t('myWorkIdeas.workspaceTools.convert')} icon={<Rocket size={12} />}>
        {selection.type !== 'none' && selection.count > 0 && (
          <div className="mb-2 text-[10px] font-medium text-c-info bg-c-info/5 rounded-lg px-2 py-1.5">
            {t('myWorkIdeas.workspaceTools.convertSelectionCount', { value: selection.count })}
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
                        title={isSoon ? t('myWorkIdeas.workspaceTools.comingSoon') : undefined}
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

      {activeTool === 'whiteboard' && pokaz('properties') && (
        <Section
          title={t('myWorkIdeas.workspaceTools.whiteboardInspector')}
          icon={<Activity size={12} />}
          defaultOpen
        >
          <div className="space-y-3 text-[11px]">
            {/* Selected node info */}
            {selection.type === 'node' &&
              selection.primaryId &&
              (() => {
                const node = (graphNodes ?? []).find((n: any) => n.id === selection.primaryId);
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

            {/* Session info */}
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

            {/* Outcome registry summary */}
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
          </div>
        </Section>
      )}

      {activeTool === 'process_flow' && pokaz('properties') && (
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

      {activeTool === 'process_flow' && pokaz('overview') && (
        <Section
          title={t('myWorkIdeas.workspaceTools.processHealth')}
          icon={<Activity size={13} />}
        >
          <ProcessFlowHealthScore nodes={graphNodes ?? []} edges={graphEdges ?? []} isPl={isPl} />
        </Section>
      )}

      {activeTool === 'mindmap' && (
        <>
          {/* ── 5. Mindmap Inspector (Style / Layout / Theme) ── */}
          {pokaz('properties') && (
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

          {/* ── 6. Map Health ── */}
          {pokaz('overview') && (
          <Section title={t('myWorkIdeas.workspaceTools.mapHealth')} icon={<Activity size={13} />}>
            <MapHealthScore
              nodes={graphNodes.map((n: any) => ({ id: n.id, data: n.data, type: n.type }))}
              edges={graphEdges.map((e: any) => ({ source: e.source, target: e.target }))}
              visible
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
      {wZakladce('relations') && (
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

      {/* ── Komentarze (§7) — first-class, nie szczegół elementu. ── */}
      {wZakladce('comments') && (
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

      {/* ── Historia (§8) — zdarzenia + wersje, AI = typ zdarzenia. ── */}
      {wZakladce('history') && (
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
      </div>
      </PanelVisual.Provider>
      </TrybZakladki.Provider>
    </ToolsPanelShell>
  );
};

export default IdeaWorkspaceTools;
