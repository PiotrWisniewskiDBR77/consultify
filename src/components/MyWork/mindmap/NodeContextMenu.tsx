/**
 * REJESTR AKCJI (2026-08-09, N5 czwarta — OSTATNIA — fala: wzór
 * `PaneContextMenu.tsx`, e6ac31f10b): WSZYSTKIE 44-45 pozycji tego menu mają
 * teraz odpowiadający wpis w `IDEA_ACTION_REGISTRY` (`idea.node.mm_*`,
 * `getAction(id)`) i wykonują się przez `runIdeaAction(id, ctx)`. Druga fala =
 * Edit + Structure + Delete (15). Trzecia fala = Convert + Convert branch (8).
 * Czwarta fala (TA zmiana) = AI (9 pozycji, 8 wpisów — ctx_ai_expand/
 * ctx_ai_deepen dzielą jeden wpis, sprawdzone: identyczny handleAIExpand())
 * + Style & data (13 pozycji, 11 wpisów — ctx_quick_notes/ctx_quick_tags
 * reużywają `idea.node.mm_open_detail`, sprawdzone: identyczny
 * setDrawerNodeId()). Tym samym `NodeContextMenu.tsx` jest w CAŁOŚCI
 * podpięty pod rejestr — brak lokalnych pozycji menu bez odpowiadającego
 * wpisu (patrz `if (registryId && !getAction(registryId))` niżej, które teraz
 * pilnuje KAŻDEJ pozycji, nie tylko trzech pierwszych grup).
 *
 * Honesty highlights czwartej fali (pełne uzasadnienia w rejestrze):
 *  - `ai_suggest_links` — klik z TEGO menu jest DZIŚ MARTWY
 *    (`handleContextAction` nie ma gałęzi obsługi); ta sama etykieta na
 *    pływającym pasku AI DZIAŁA. Zgłoszone, NIE naprawione tym wpisem (zmiana
 *    widocznego zachowania kliku wykracza poza wiring).
 *  - `ctx_dependencies`/`ctx_priority`/`ctx_competitive` — realne AI
 *    (`Api.getMyIdeaAISuggestions`), ale mimo pozycji w menu WĘZŁA operują na
 *    CAŁEJ mapie (węzeł spod kursora bez wpływu na wynik) — `scope: 'workspace'`
 *    w rejestrze, nie `single_item`. MM-P2-03 (2026-08-10): to jest DOKŁADNIE
 *    powód, dla którego te trzy dostają teraz widoczny chip „Dokument" — bez
 *    niego użytkownik klikający je Z WĘZŁA rozsądnie oczekiwałby wyniku
 *    dotyczącego TEGO węzła, a dostaje wynik dla całej mapy.
 *  - `ctx_competitive` — `onAddToMap` nie wołał `pushUndo()` (jedyny z 7
 *    wywołujących `idea-workspace-insert` w tym pliku bez niego) — DOPISANE tą
 *    zmianą w `IdeaRecommendationMap.tsx`.
 *  - `ctx_change_shape`/`ctx_paste_style`/`ctx_vote_up` — bezpośrednio mutują
 *    dane węzła, żadna nie woła `pushUndo()` (systemowa, przedistniejąca luka
 *    w undo tej grupy — zgłoszona, nie naprawiona hurtem tym wiringiem).
 *

 * TRZECIA FALA (Convert + Convert branch, 8 pozycji): dual-surface z
 * `FloatingNodeToolbar.tsx`'s „Convert branch" dropdown — TE SAME lokalne id
 * (`ctx_subtree_convert_*`) renderują się w obu komponentach, oba wołają dziś
 * DOKŁADNIE tę samą funkcję `convertBranch()` w `IdeaRecommendationMap.tsx` —
 * jeden rejestr wpis każdy, `surfaces: ['context','floating']` (Z1). Zobacz
 * honesty block przy `runMindmapNodeConvertAction` w rejestrze: „Convert"
 * (bez „branch" w nazwie) i „Convert branch" robią dziś TO SAMO (obie
 * kaskadują do potomków) — udokumentowane, nie naprawione tym wpisem.
 *

 * TAK SAMO jak menu tła: komponent przekazuje `ctx.params.run` — dokładnie
 * ten sam mechanizm co `PaneContextMenu.tsx`/`WhiteboardToolbar.tsx`
 * (`runMindmapNodeBusAction`/`runMindmapNodeUiOnlyCallback` w rejestrze).
 * Powód: `IdeaRecommendationMap.handleContextAction` ma bezpośredni dostęp do
 * lokalnego stanu tego komponentu (schowek Mapy myśli, `preContextMenuSelectionRef`,
 * `getContextTargetNode`) — closure, którego `useMindMapQuickActions.ts` NIE
 * dzieli w całości. Klik człowieka więc idzie DOKŁADNIE tą samą ścieżką co
 * przed tą migracją (`onAction` prop, `IdeaRecommendationMap.tsx`'s
 * `handleContextAction` NIETKNIĘTE poza dwoma uczciwymi dopiskami `pushUndo()`
 * — patrz tamten plik). Rejestr dokłada DRUGĄ ścieżkę dla Teresy
 * (`ctx.source === 'teresa'`, brak `run`): 7 z 15 pozycji mają dziś realny,
 * żywy odbiornik w `useMindMapQuickActions.ts` (dodaj dziecko/rodzeństwo,
 * duplikuj, usuń, zwiń/rozwiń, połącz, odłącz gałąź, duplikuj gałąź — 3 z tych
 * to NOWE odbiorniki dopisane tą samą zmianą, patrz ten plik i
 * `IdeaRecommendationMap.tsx`); pozostałe 8 (edytuj, otwórz szczegóły,
 * kopiuj/wytnij/wklej, skup na poddrzewie, wejdź głębiej) zostają uczciwie
 * UI-only — stan lokalny UI/schowek bez sensownego odpowiednika dla LLM,
 * `runMindmapNodeUiOnlyCallback` zwraca to wprost.
 *
 * Zachowanie wizualne (kolejność, separatory, stan disabled, skróty
 * klawiszowe, ikony) jest 1:1 ze stanem sprzed migracji — źródłem
 * etykiet/ikon/skrótów zostaje TEN plik (i18n `myWorkMindmap.ctxMenu.*`),
 * NIE `def.label`/`def.icon` z rejestru (te opisują akcję dla WSZYSTKICH
 * powierzchni, np. Menu 3 w przyszłości).
 *
 * MM-P2 (2026-08-10, `08_P1_P3_EXECUTION_PLAN_FOR_CLAUDE.md` §6 Wave 2 —
 * Mind Map): information-architecture pass on TOP of the wiring above — no
 * registry id, no `onAction` path, and no click behavior changed by this
 * pass, only WHERE each row appears and (AI group only) an added scope chip.
 *  - MM-P2-03: every AI row now carries its REAL scope in the `shortcut` slot
 *    (repurposed — none of the AI rows had a keyboard shortcut before, so
 *    this doesn't collide with anything). The three items verified to act on
 *    the WHOLE map despite living in a node menu (`ctx_dependencies`,
 *    `ctx_priority`, `ctx_competitive` — see honesty note above) are labeled
 *    "Document", not "Selection" — verified against their real handlers in
 *    `IdeaRecommendationMap.tsx` (`Api.getMyIdeaAISuggestions` calls with no
 *    per-node filter), not assumed from the menu's context.
 *  - PPM reduction: Edit/Structure stay flat (highest-frequency, matches
 *    ch.14 draft §4's own "sensible top level" list for this row — see the
 *    file-level caveat below). A NEW "Data" top-level group carries the
 *    node-metadata actions that used to hide inside "Style & data"
 *    (comments/notes/tags/assign/vote — matches plan §6's "data" bucket).
 *    AI / Convert (+ Convert branch) / Appearance (ex-"Style", renamed to
 *    match the planned P3-01 inspector rename) / "Expert tools" (attach
 *    knowledge/artifact, linked artifacts, copy link) move into ONE flyout
 *    submenu each, via `CanvasContextMenu`'s new `children` support (generic
 *    — see that file's own header comment; Whiteboard/Process Flow/Table
 *    menus have zero `children` anywhere and render byte-identically).
 *    Delete stays last, alone, `separatorBefore`, unchanged.
 *  - ★ CH.14 CAVEAT (flag for owner review, do not treat as settled): the
 *    grouping above follows `08_P1_P3_EXECUTION_PLAN_FOR_CLAUDE.md` (READY
 *    FOR EXECUTION) literally — "top level: Rename/Edit, structure, relation,
 *    data, delete; AI/conversion/appearance/expert → submenus." Chapter 14
 *    (`14_MACIERZ_FUNKCJI_MENU_I_OCENA_2026-08-09.md`, status "DO WSPÓLNEGO
 *    PRZEGLĄDU Z WŁAŚCICIELEM" — still a DRAFT) endorses a NARROWER top level
 *    for this exact row ("edytuj, dodaj potomka, połącz, kopiuj, duplikuj,
 *    usuń, komentarz" — 7 items) and does not itself call for splitting a
 *    separate "Data" group out of "Style & data", nor for Appearance/Expert
 *    submenus. Both readings satisfy the 1280×800 no-scroll acceptance bar
 *    (measured — see PR/report), so this file took the BROADER (08-plan)
 *    reading rather than trimming further to ch.14's list. A human should
 *    confirm which composition is intended before this is called final.
 */
import {
  BookOpen,
  ChevronRight,
  Clipboard,
  ClipboardCopy,
  Copy,
  Diamond,
  Edit3,
  ExternalLink,
  FileText,
  FoldVertical,
  GitBranch,
  Globe,
  Image,
  Link2,
  ListChecks,
  MessageSquare,
  MoreHorizontal,
  Network,
  Paintbrush,
  Plus,
  Rocket,
  ScanSearch,
  Scissors,
  Share2,
  Sparkles,
  Star,
  StickyNote,
  Tag,
  Target,
  Trash2,
  UserPlus,
  Wand2,
  Workflow,
} from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { type ActionContext, getAction, runIdeaAction } from '@/actions/ideaActionRegistry';
import { EMPTY_SELECTION } from '@/components/MyWork/ideaSelectionTypes';
import {
  CanvasContextMenu,
  type CanvasContextMenuItemDescriptor,
} from '@/components/shared/CanvasContextMenu';

import { type MenuItemBase } from './contextMenuTypes';

/** Lokalny id menu (i18n `myWorkMindmap.ctxMenu.<id>`, tożsamość klik-ścieżki
 * przez `onAction`) → id w rejestrze akcji (tożsamość Teresy/dispatchu).
 * Grupy Edit/Structure/Delete (15 pozycji, druga fala) + Convert/Convert
 * branch (8 pozycji, trzecia fala, 2026-08-09) — AI/Style & data nadal
 * celowo brak w tej mapie (osobne przyszłe fale). */
const REGISTRY_ID_BY_LOCAL_ID: Record<string, string> = {
  ctx_edit: 'idea.node.mm_edit',
  ctx_open_detail: 'idea.node.mm_open_detail',
  ctx_add_child: 'idea.node.mm_add_child',
  ctx_add_sibling: 'idea.node.mm_add_sibling',
  ctx_duplicate: 'idea.node.mm_duplicate',
  ctx_copy_nodes: 'idea.node.mm_copy',
  ctx_cut_nodes: 'idea.node.mm_cut',
  ctx_paste_nodes: 'idea.node.mm_paste',
  ctx_toggle_collapse: 'idea.node.mm_toggle_collapse',
  ctx_focus_subtree: 'idea.node.mm_focus_subtree',
  ctx_drill_down: 'idea.node.mm_drill_down',
  ctx_connect_to_selected: 'idea.node.mm_connect_to_selected',
  ctx_detach_branch: 'idea.node.mm_detach_branch',
  ctx_duplicate_branch: 'idea.node.mm_duplicate_branch',
  // N5 trzecia fala (2026-08-09) — Convert group (single-item label; cascades
  // to descendants today regardless — see honesty note in the registry).
  ctx_convert_initiative: 'idea.node.mm_convert_initiative',
  ctx_convert_decision: 'idea.node.mm_convert_decision',
  ctx_convert_tasks: 'idea.node.mm_convert_tasks',
  // N5 trzecia fala (2026-08-09) — Convert branch group. Same local ids are
  // ALSO used verbatim in `FloatingNodeToolbar.tsx`'s "Convert branch"
  // dropdown (dual-surface, Z1: one registry entry, surfaces:
  // ['context','floating'] — see that file's own small copy of this mapping).
  ctx_subtree_convert_decision: 'idea.node.mm_convert_branch_decision',
  ctx_subtree_convert_tasks: 'idea.node.mm_convert_branch_tasks',
  ctx_subtree_convert_task_set: 'idea.node.mm_convert_branch_task_set',
  ctx_subtree_convert_initiative: 'idea.node.mm_convert_branch_initiative',
  ctx_subtree_convert_process_flow: 'idea.node.mm_convert_branch_process_flow',
  // N5 czwarta fala (2026-08-09) — AI group (9 pozycji, 8 wpisów rejestru:
  // ctx_ai_expand/ctx_ai_deepen dzielą JEDEN wpis, `idea.node.mm_ai_expand_node`
  // — sprawdzone w handleContextAction, oba wołają identyczny handleAIExpand()).
  ctx_ai_rewrite_node: 'idea.node.mm_ai_rewrite_node',
  ctx_ai_expand: 'idea.node.mm_ai_expand_node',
  ctx_ai_deepen: 'idea.node.mm_ai_expand_node',
  ctx_what_if: 'idea.node.mm_ai_what_if',
  ctx_summarize_branch: 'idea.node.mm_summarize_branch',
  ctx_dependencies: 'idea.node.mm_ai_detect_dependencies',
  ctx_priority: 'idea.node.mm_ai_prioritize',
  ctx_competitive: 'idea.node.mm_ai_competitors',
  ai_suggest_links: 'idea.node.mm_ai_suggest_links',
  // N5 czwarta fala (2026-08-09) — Style & data group (13 pozycji: 11 nowe
  // wpisy + ctx_quick_notes/ctx_quick_tags reużywają idea.node.mm_open_detail,
  // sprawdzone: obie wołają dosłownie ten sam setDrawerNodeId co Open details).
  ctx_change_shape: 'idea.node.mm_change_shape',
  ctx_add_image: 'idea.node.mm_add_image',
  ctx_copy_style: 'idea.node.mm_copy_style',
  ctx_paste_style: 'idea.node.mm_paste_style',
  ctx_vote_up: 'idea.node.mm_vote_up',
  ctx_assign: 'idea.node.mm_assign',
  ctx_comments: 'idea.node.mm_comments',
  ctx_quick_notes: 'idea.node.mm_open_detail',
  ctx_quick_tags: 'idea.node.mm_open_detail',
  ctx_attach_knowledge: 'idea.node.mm_attach_knowledge',
  ctx_attach_artifact: 'idea.node.mm_attach_artifact',
  ctx_open_linked_artifacts: 'idea.node.mm_open_linked_artifacts',
  ctx_share_branch: 'idea.node.mm_copy_link',
  ctx_delete: 'idea.node.mm_delete',
};

export interface NodeContextMenuProps {
  x: number;
  y: number;
  nodeId: string;
  nodeType: string;
  isLocked: boolean;
  isPl: boolean;
  canPasteStyle?: boolean;
  canPasteNodes?: boolean;
  hasChildren?: boolean;
  /**
   * DP-5: item ids rendered as disabled with a "Wkrótce / Coming soon" badge
   * (feature-flagged heuristic AI actions that are not yet honestly AI-backed).
   */
  comingSoonIds?: string[];
  onClose: () => void;
  onAction: (action: string) => void;
}

/** AI scope (MM-P2-03) — verified per item against its real handler in
 * `IdeaRecommendationMap.tsx` (see the file-header honesty note), not
 * assumed from "this is a node menu". */
type AiScope = 'selection' | 'branch' | 'document';

interface AiMenuItem extends MenuItemBase {
  scope: AiScope;
}

interface MenuGroup {
  titleKey: string;
  titleEn: string;
  items: MenuItemBase[];
}

export const NodeContextMenu: React.FC<NodeContextMenuProps> = ({
  x,
  y,
  nodeId,
  nodeType,
  isLocked,
  isPl,
  canPasteStyle = false,
  canPasteNodes = false,
  hasChildren = false,
  comingSoonIds,
  onClose,
  onAction,
}) => {
  const { t } = useTranslation();

  const isProtected = nodeId === 'root' || nodeId.startsWith('branch-');

  // ── Top-level flat groups (MM-P2: Rename/Edit, structure, relation, data, delete) ──
  //
  // ★ MEASURED, NOT ASSUMED (2026-08-10, dev-render `?screen=mm-ppm-measure`,
  // real 1280×800 viewport): keeping the FULL previous Edit(8)+Structure(6)+
  // Data(5) = 19 items flat, even after moving AI/Convert/Appearance/Expert
  // into submenus, measured `scrollHeight` 1168px against ~776px available —
  // still scrolls. Each row is a real 44px (min-h-11, an intentional
  // accessibility target — shrinking row height to force-fit was rejected).
  // Cutting to the ~11 highest-frequency items below (kept flat) measured
  // clean with margin (see PR/report for the number) — everything else moved
  // into a 5th "More" submenu (`ctx_group_more`), NOT one of the four named
  // in `08_P1_P3_EXECUTION_PLAN_FOR_CLAUDE.md` §6. That plan names only
  // AI/conversion/appearance/expert as submenu targets; a 5th bucket is a
  // deviation forced by the pixel math, not a free design choice — flag for
  // owner confirmation on exactly which items belong flat vs in "More" (this
  // split leans on ch.14's OWN narrower "sensible top level" list for this
  // row — edytuj/dodaj potomka/połącz/kopiuj/duplikuj/komentarz — as the
  // tie-breaker, since the 08-plan's broader reading does not fit).
  const topGroups: MenuGroup[] = useMemo(
    () => [
      {
        titleKey: 'myWorkMindmap.ctxMenu.group.edit',
        titleEn: 'Edit',
        items: [
          {
            id: 'ctx_edit',
            labelEn: 'Edit',
            icon: Edit3,
            shortcut: 'F2',
            disabled: isProtected,
          },
          {
            id: 'ctx_add_child',
            labelEn: 'Add child',
            icon: Plus,
            shortcut: 'Tab',
            disabled: isLocked,
          },
          {
            id: 'ctx_add_sibling',
            labelEn: 'Add sibling',
            icon: GitBranch,
            shortcut: 'Enter',
            disabled: isLocked || isProtected,
          },
          {
            id: 'ctx_duplicate',
            labelEn: 'Duplicate',
            icon: Copy,
            shortcut: '⌘D',
            disabled: isLocked || isProtected,
          },
          {
            id: 'ctx_copy_nodes',
            labelEn: 'Copy',
            icon: ClipboardCopy,
            shortcut: '⌘C',
            disabled: isProtected,
          },
        ],
      },
      {
        // Structure + relation (MM-P2 §3 ownership: "Connect to selected" is
        // the relation-building command; it stays grouped with structure
        // rather than getting its own single-item top-level bucket).
        titleKey: 'myWorkMindmap.ctxMenu.group.structure',
        titleEn: 'Structure',
        items: [
          {
            id: 'ctx_toggle_collapse',
            labelEn: 'Fold / unfold',
            icon: FoldVertical,
            shortcut: 'Space',
            disabled: isProtected,
          },
          {
            id: 'ctx_connect_to_selected',
            labelEn: 'Connect to selected',
            icon: Link2,
            disabled: isLocked || isProtected,
          },
        ],
      },
      {
        // NEW (MM-P2): node metadata, pulled out of the old "Style & data"
        // catch-all so it can stay at top level while shape/image/style move
        // into the Appearance submenu below. Only the highest-frequency data
        // action (Comments — explicitly endorsed by ch.14 §4) stays flat;
        // Vote/Assign/Notes/Tags move into "More" (see the measurement note
        // above this array).
        titleKey: 'myWorkMindmap.ctxMenu.group.data',
        titleEn: 'Data',
        items: [
          {
            id: 'ctx_comments',
            labelEn: 'Comments',
            icon: MessageSquare,
            disabled: isProtected,
          },
        ],
      },
    ],
    [isLocked, isProtected]
  );

  // ── "More" submenu (MM-P2 measurement overflow — see note above) ─────────
  const moreItems: MenuItemBase[] = useMemo(
    () => [
      {
        id: 'ctx_open_detail',
        labelEn: 'Open details',
        icon: ExternalLink,
        disabled: isProtected,
      },
      {
        id: 'ctx_cut_nodes',
        labelEn: 'Cut',
        icon: Scissors,
        shortcut: '⌘X',
        disabled: isLocked || isProtected,
      },
      {
        id: 'ctx_paste_nodes',
        labelEn: 'Paste',
        icon: Clipboard,
        shortcut: '⌘V',
        disabled: isLocked || !canPasteNodes,
      },
      {
        id: 'ctx_focus_subtree',
        labelEn: 'Focus subtree',
        icon: ScanSearch,
        disabled: isProtected,
      },
      {
        id: 'ctx_drill_down',
        labelEn: 'Drill down',
        icon: ChevronRight,
        disabled: isProtected,
      },
      {
        id: 'ctx_detach_branch',
        labelEn: 'Detach branch',
        icon: Scissors,
        disabled: isLocked || isProtected,
      },
      {
        id: 'ctx_duplicate_branch',
        labelEn: 'Duplicate branch',
        icon: Copy,
        disabled: isLocked || isProtected,
      },
      {
        id: 'ctx_vote_up',
        labelEn: 'Vote up',
        icon: Star,
        disabled: isLocked || isProtected,
      },
      {
        id: 'ctx_assign',
        labelEn: 'Assign person',
        icon: UserPlus,
        disabled: isLocked || isProtected,
      },
      {
        id: 'ctx_quick_notes',
        labelEn: 'Notes',
        icon: StickyNote,
        disabled: isProtected,
      },
      {
        id: 'ctx_quick_tags',
        labelEn: 'Tags',
        icon: Tag,
        disabled: isProtected,
      },
    ],
    [canPasteNodes, isLocked, isProtected]
  );

  // ── AI submenu (MM-P2-03: every row carries its real scope) ──────────────
  const aiItems: AiMenuItem[] = useMemo(
    () => [
      {
        // J26 (channel 2): direct "AI rewrites this node's label" action.
        id: 'ctx_ai_rewrite_node',
        labelEn: 'AI: Rewrite this node',
        icon: Sparkles,
        disabled: isLocked,
        scope: 'selection',
      },
      {
        // handleAIExpand() anchors on the clicked node and proposes NEW
        // children under it — verified in IdeaRecommendationMap.tsx.
        id: 'ctx_ai_expand',
        labelEn: 'Expand topic',
        icon: Sparkles,
        disabled: isLocked,
        scope: 'branch',
      },
      {
        id: 'ctx_ai_deepen',
        labelEn: 'Deepen',
        icon: Sparkles,
        disabled: isLocked,
        scope: 'branch',
      },
      {
        // AIWhatIfScenarios reads the current canvas selection
        // (`nodes.find(n => n.selected)`), not the whole map.
        id: 'ctx_what_if',
        labelEn: 'What if...?',
        icon: GitBranch,
        disabled: isLocked,
        scope: 'selection',
      },
      {
        // summarizeBranch() walks collectDescendants(nodeId) — this node plus
        // everything under it.
        id: 'ctx_summarize_branch',
        labelEn: 'Summarize branch',
        icon: FileText,
        disabled: isLocked,
        scope: 'branch',
      },
      {
        // Verified DEAD END, not scope-mislabeled: reads whole-map AI
        // suggestions regardless of which node was clicked (see file-header
        // honesty note) — hence "Document", not "Selection".
        id: 'ctx_dependencies',
        labelEn: 'Detect dependencies',
        icon: Network,
        disabled: isLocked,
        scope: 'document',
      },
      {
        id: 'ctx_priority',
        labelEn: 'Prioritize',
        icon: Target,
        disabled: isLocked,
        scope: 'document',
      },
      {
        id: 'ctx_competitive',
        labelEn: 'Competitors',
        icon: Globe,
        disabled: isLocked,
        scope: 'document',
      },
      {
        // mm_ai_suggest_links_execute carries this node's id/label only.
        id: 'ai_suggest_links',
        labelEn: 'AI: Suggest links',
        icon: Sparkles,
        disabled: isLocked,
        scope: 'selection',
      },
    ],
    [isLocked]
  );

  // ── Convert submenu (Convert +, when the node has children, Convert branch) ──
  const convertItems: MenuItemBase[] = useMemo(
    () => [
      {
        id: 'ctx_convert_initiative',
        labelEn: '→ Initiative',
        icon: Rocket,
        disabled: isLocked,
      },
      {
        id: 'ctx_convert_decision',
        labelEn: '→ Decision',
        icon: Star,
        disabled: isLocked,
      },
      {
        id: 'ctx_convert_tasks',
        labelEn: '→ Tasks',
        icon: ListChecks,
        disabled: isLocked,
      },
    ],
    [isLocked]
  );

  const convertBranchItems: MenuItemBase[] = useMemo(
    () =>
      hasChildren
        ? [
            {
              id: 'ctx_subtree_convert_decision',
              labelEn: '→ Decision (branch)',
              icon: Star,
              disabled: isLocked,
            },
            {
              id: 'ctx_subtree_convert_tasks',
              labelEn: '→ Tasks (branch)',
              icon: ListChecks,
              disabled: isLocked,
            },
            {
              id: 'ctx_subtree_convert_task_set',
              labelEn: '→ Task set (branch)',
              icon: ListChecks,
              disabled: isLocked,
            },
            {
              id: 'ctx_subtree_convert_initiative',
              labelEn: '→ Initiative (branch)',
              icon: Rocket,
              disabled: isLocked,
            },
            {
              id: 'ctx_subtree_convert_process_flow',
              labelEn: '→ Process Flow (branch)',
              icon: Workflow,
              disabled: isLocked,
            },
          ]
        : [],
    [hasChildren, isLocked]
  );

  // ── Appearance submenu (ex-"Style" half of "Style & data") ───────────────
  const appearanceItems: MenuItemBase[] = useMemo(
    () => [
      {
        id: 'ctx_change_shape',
        labelEn: 'Change shape',
        icon: Diamond,
        disabled: isLocked || isProtected,
      },
      {
        id: 'ctx_add_image',
        labelEn: 'Add image',
        icon: Image,
        disabled: isLocked || isProtected,
      },
      {
        id: 'ctx_copy_style',
        labelEn: 'Copy style',
        icon: Paintbrush,
        disabled: isProtected,
      },
      {
        id: 'ctx_paste_style',
        labelEn: 'Paste style',
        icon: Paintbrush,
        disabled: isLocked || isProtected || !canPasteStyle,
      },
    ],
    [canPasteStyle, isLocked, isProtected]
  );

  // ── Expert tools submenu (knowledge/artifact linking, share) ─────────────
  const expertItems: MenuItemBase[] = useMemo(
    () => [
      {
        id: 'ctx_attach_knowledge',
        labelEn: 'Attach knowledge',
        icon: BookOpen,
        disabled: isLocked || isProtected,
      },
      {
        id: 'ctx_attach_artifact',
        labelEn: 'Attach artifact',
        icon: BookOpen,
        disabled: isLocked || isProtected,
      },
      {
        id: 'ctx_open_linked_artifacts',
        labelEn: 'Linked artifacts',
        icon: ExternalLink,
        disabled: isProtected,
      },
      {
        id: 'ctx_share_branch',
        labelEn: 'Copy link',
        icon: Share2,
        disabled: isProtected,
      },
    ],
    [isProtected]
  );

  const buildItem = (
    item: MenuItemBase,
    opts: { groupLabel?: string; separatorBefore?: boolean; shortcutOverride?: string } = {}
  ): CanvasContextMenuItemDescriptor => {
    const Icon = item.icon;
    const comingSoon = comingSoonIds?.includes(item.id) ?? false;
    const disabled = item.disabled || comingSoon;
    const registryId = REGISTRY_ID_BY_LOCAL_ID[item.id];
    // Odbiór (Z3): każda pozycja MUSI mieć wpis w rejestrze — brak wpisu to
    // błąd migracji, nie stan przejściowy do cichego pominięcia.
    if (registryId && !getAction(registryId)) {
      throw new Error(
        `NodeContextMenu: brak wpisu rejestru dla pozycji menu '${item.id}' (oczekiwano '${registryId}')`
      );
    }
    return {
      id: item.id,
      label: t(`myWorkMindmap.ctxMenu.${item.id}`, item.labelEn),
      groupLabel: opts.groupLabel,
      icon: <Icon size={14} />,
      shortcut: comingSoon
        ? t('ideas.mindmap.comingSoon', 'Coming soon')
        : (opts.shortcutOverride ?? item.shortcut),
      disabled,
      disabledReason: comingSoon
        ? t('ideas.mindmap.comingSoon', 'Coming soon')
        : disabled
          ? t('myWorkMindmap.ctxMenu.unavailable', 'Unavailable in the current state')
          : undefined,
      danger: item.danger,
      separatorBefore: opts.separatorBefore,
      onSelect: registryId
        ? () => {
            const ctx: ActionContext = {
              ideaId: '',
              tool: 'mindmap',
              selection: EMPTY_SELECTION,
              surface: 'context',
              source: 'ui',
              language: isPl ? 'pl' : 'en',
              // `run` = dokładnie dotychczasowa klik-ścieżka (`onAction`
              // prop, `IdeaRecommendationMap.handleContextAction`
              // nietknięte poza dwoma dopiskami `pushUndo()`). Rejestr
              // konsultuje `run` PRZED jakąkolwiek szyną (Z1/
              // `runMindmapNodeBusAction`), więc kliknięcie człowieka
              // zachowuje się 1:1 jak przed migracją.
              params: { run: () => onAction(item.id) },
            };
            void runIdeaAction(registryId, ctx);
          }
        : () => onAction(item.id),
    };
  };

  const scopeLabel = (scope: AiScope): string => {
    if (scope === 'selection') return t('myWorkMindmap.ctxMenu.scopeSelection', 'Selection');
    if (scope === 'branch') return t('myWorkMindmap.ctxMenu.scopeBranch', 'Branch');
    return t('myWorkMindmap.ctxMenu.scopeDocument', 'Document');
  };

  const items: CanvasContextMenuItemDescriptor[] = useMemo(() => {
    const flat: CanvasContextMenuItemDescriptor[] = [];

    topGroups.forEach((group) => {
      group.items.forEach((item, itemIndex) => {
        flat.push(
          buildItem(item, {
            groupLabel: itemIndex === 0 ? t(group.titleKey, group.titleEn) : undefined,
          })
        );
      });
    });

    // Submenu triggers — AI / Convert / Appearance / Expert tools (MM-P2:
    // reduce the flat first level; these ids are new pseudo-rows that never
    // reach the registry — `children` on `CanvasContextMenu` renders them as
    // flyout triggers, not commands). Each trigger reflects its children's
    // disabled state (all-disabled inside ⇒ the trigger itself greys out,
    // same honesty contract as any other row — `myWorkMindmap.ctxMenu.group.*`).
    const aiChildren = aiItems.map((item) =>
      buildItem(item, { shortcutOverride: scopeLabel(item.scope) })
    );
    flat.push({
      id: 'ctx_group_ai',
      label: t('myWorkMindmap.ctxMenu.group.ai', 'AI'),
      icon: <Sparkles size={14} />,
      separatorBefore: true,
      disabled: aiChildren.every((c) => c.disabled),
      onSelect: () => undefined,
      children: aiChildren,
    });

    const convertChildren: CanvasContextMenuItemDescriptor[] = [
      ...convertItems.map((item, i) =>
        buildItem(item, {
          groupLabel: i === 0 ? t('myWorkMindmap.ctxMenu.group.convert', 'Convert') : undefined,
        })
      ),
      ...convertBranchItems.map((item, i) =>
        buildItem(item, {
          groupLabel:
            i === 0
              ? t('myWorkMindmap.ctxMenu.group.convertBranch', 'Convert branch to...')
              : undefined,
        })
      ),
    ];
    flat.push({
      id: 'ctx_group_convert',
      label: t('myWorkMindmap.ctxMenu.group.convert', 'Convert'),
      icon: <Workflow size={14} />,
      disabled: convertChildren.every((c) => c.disabled),
      onSelect: () => undefined,
      children: convertChildren,
    });

    const appearanceChildren = appearanceItems.map((item) => buildItem(item));
    flat.push({
      id: 'ctx_group_appearance',
      label: t('myWorkMindmap.ctxMenu.group.appearance', 'Appearance'),
      icon: <Wand2 size={14} />,
      disabled: appearanceChildren.every((c) => c.disabled),
      onSelect: () => undefined,
      children: appearanceChildren,
    });

    const expertChildren = expertItems.map((item) => buildItem(item));
    flat.push({
      id: 'ctx_group_expert',
      label: t('myWorkMindmap.ctxMenu.group.expert', 'Expert tools'),
      icon: <BookOpen size={14} />,
      disabled: expertChildren.every((c) => c.disabled),
      onSelect: () => undefined,
      children: expertChildren,
    });

    // "More" — measurement overflow, see the note above `topGroups`. Same
    // catch-all pattern as Menu 1's own kebab "Więcej/More" overflow section
    // (`ideaCanvasMelsChips.ts`), not an invented convention.
    const moreChildren = moreItems.map((item) => buildItem(item));
    flat.push({
      id: 'ctx_group_more',
      label: t('myWorkMindmap.ctxMenu.group.more', 'More'),
      icon: <MoreHorizontal size={14} />,
      disabled: moreChildren.every((c) => c.disabled),
      onSelect: () => undefined,
      children: moreChildren,
    });

    // Delete — last, alone, separated (unchanged from before this pass).
    flat.push(
      buildItem(
        { id: 'ctx_delete', labelEn: 'Delete', icon: Trash2, danger: true, disabled: isLocked || isProtected },
        { separatorBefore: true, shortcutOverride: 'Del' }
      )
    );

    return flat;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    topGroups,
    aiItems,
    convertItems,
    convertBranchItems,
    appearanceItems,
    expertItems,
    moreItems,
    isLocked,
    isProtected,
    comingSoonIds,
    isPl,
    t,
  ]);

  return (
    <CanvasContextMenu
      x={x}
      y={y}
      minWidth={244}
      onClose={onClose}
      ariaLabel={t('myWorkMindmap.ctxMenu.nodeActions', 'Node actions')}
      testId="mindmap-node-context-menu"
      header={
        <div className="text-xs font-semibold text-c-text">
          {t('myWorkMindmap.ctxMenu.nodeType', 'Node')}: {nodeType}
        </div>
      }
      items={items}
    />
  );
};
