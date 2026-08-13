/**
 * REJESTR AKCJI (2026-08-09, N5 kontynuacja z Mapy myśli — wzór pilota:
 * `EdgeContextMenu.tsx`, 768e44010d): tych 13 pozycji NIE jest już
 * hardkodowanych lokalnie co do TOŻSAMOŚCI akcji — każda ma odpowiadający
 * wpis w `IDEA_ACTION_REGISTRY` (`idea.view.*`/`idea.ai.suggest_nodes`,
 * `getAction(id)`) i wykonuje się przez `runIdeaAction(id, ctx)`.
 *
 * INACZEJ niż krawędzie Mapy myśli (które przeszły CAŁKOWICIE na szynę): menu
 * tła przekazuje `ctx.params.run` — dokładnie ten sam mechanizm, którym
 * `WhiteboardToolbar.tsx`/`IdeaCanvasContextMenu.tsx` już się posługują
 * (`runToolbarBusAction`/`runContextMenuUiOnlyCallback` w rejestrze). Powód:
 * `IdeaRecommendationMap.handlePaneContextAction` ma bezpośredni dostęp do
 * lokalnego stanu tego komponentu (schowek, `canvasX`/`canvasY` punktu
 * kliknięcia, stos undo) — closure, którego `useMindMapQuickActions.ts` NIE
 * dzieli. Klik człowieka więc idzie DOKŁADNIE tą samą ścieżką co przed tą
 * migracją (`onAction` prop, `IdeaRecommendationMap.tsx` NIETKNIĘTE — zero
 * zmiany zachowania, zero ryzyka regresji pozycji nowego węzła/schowka).
 * Rejestr dokłada DRUGĄ ścieżkę dla Teresy (`ctx.source === 'teresa'`, brak
 * `run`): 9 z 13 pozycji mają dziś realny, żywy odbiornik w
 * `useMindMapQuickActions.ts` (patrz mapy `RUNTIME_PANE_*` w rejestrze — jedna
 * NOWA, `mm_select_all`, pozostałe 8 PONOWNIE UŻYTE, nie duplikowane) i
 * dostają Teresę za darmo; „Auto-układ" wskazuje na JUŻ istniejące
 * `idea.view.auto_layout` (Z1, ta sama akcja co w Menu 3, nie drugi wpis).
 * 3 pozycje („Kopiuj/Wytnij/Wklej węzły") zostają UCZCIWIE UI-only — schowek
 * Mapy myśli to stan przeglądarki bez sensownego odpowiednika dla LLM,
 * `runMindmapPaneUiOnlyCallback` zwraca to wprost zamiast fałszywego sukcesu.
 *
 * Zachowanie wizualne (kolejność, separatory, stan disabled, skróty
 * klawiszowe pokazywane w menu) jest 1:1 ze stanem sprzed migracji — źródłem
 * etykiet/ikon/skrótów zostaje ten plik (i18n `myWorkMindmap.paneMenu.*`),
 * NIE `def.label`/`def.icon` z rejestru, bo te pola opisują akcję dla
 * WSZYSTKICH powierzchni (np. Menu 3), a to menu ma już własne, sprawdzone
 * tłumaczenia PL i własne ikony.
 */
import {
  ChevronDown,
  Clipboard,
  ClipboardCopy,
  Globe,
  Grid3X3,
  Layers,
  Layout,
  Maximize,
  Network,
  Plus,
  Scissors,
  Sparkles,
  Target,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { type ActionContext, getAction, runIdeaAction } from '@/actions/ideaActionRegistry';
import { EMPTY_SELECTION } from '@/components/MyWork/ideaSelectionTypes';
import { CanvasContextMenu } from '@/components/shared/CanvasContextMenu';

import { type MenuItemBase } from './contextMenuTypes';

export interface PaneContextMenuProps {
  x: number;
  y: number;
  canvasX: number;
  canvasY: number;
  isPl: boolean;
  isLocked: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canPaste: boolean;
  hasSelection: boolean;
  /**
   * E10 (2026-08-10): item ids rendered as disabled with a "Wkrótce / Coming
   * soon" badge — same mechanism as `NodeContextMenu.tsx`'s `comingSoonIds`
   * (DP-5 heuristic-AI gating). Used for `pane_dependencies` today.
   */
  comingSoonIds?: string[];
  onClose: () => void;
  onAction: (action: string) => void;
}

/** Lokalny id menu (i18n `myWorkMindmap.paneMenu.<id>`, tożsamość klik-ścieżki
 * przez `onAction`) → id w rejestrze akcji (tożsamość Teresy/dispatchu). */
const REGISTRY_ID_BY_LOCAL_ID: Record<string, string> = {
  pane_add_node: 'idea.view.add_root_topic',
  pane_copy: 'idea.view.copy_selection',
  pane_cut: 'idea.view.cut_selection',
  pane_paste: 'idea.view.paste_at_point',
  pane_select_all: 'idea.view.select_all',
  pane_fit_view: 'idea.view.fit_view',
  pane_auto_layout: 'idea.view.auto_layout',
  pane_auto_cluster: 'idea.view.auto_cluster',
  pane_collapse_all: 'idea.view.collapse_all',
  pane_fold_1: 'idea.view.fold_level_1',
  pane_fold_2: 'idea.view.fold_level_2',
  pane_expand_all: 'idea.view.expand_all',
  pane_ai_suggest: 'idea.ai.suggest_nodes',
  // E10 (2026-08-10): relocated from `NodeContextMenu.tsx`'s AI submenu — see
  // that file's header comment. These three generators genuinely take the
  // WHOLE map (`AIDependencyDetector`/`AIPriorityRecommender`/
  // `AICompetitiveLandscape` all receive the full `nodes`/`edges` arrays,
  // no per-node focus parameter), so the canvas-background menu (this file,
  // ch.09 §1 level-2 "Aktualny widok") is the surface whose scope they
  // actually have — not a per-node menu.
  pane_dependencies: 'idea.view.mm_ai_detect_dependencies',
  pane_priority: 'idea.view.mm_ai_prioritize',
  pane_competitive: 'idea.view.mm_ai_competitors',
};

export const PaneContextMenu: React.FC<PaneContextMenuProps> = ({
  x,
  y,
  isPl,
  isLocked,
  canUndo,
  canRedo,
  canPaste,
  hasSelection,
  comingSoonIds,
  onClose,
  onAction,
}) => {
  const { t } = useTranslation();

  const items: MenuItemBase[] = [
    {
      id: 'pane_add_node',
      labelEn: 'Add topic (to root)',
      icon: Plus,
      shortcut: 'N',
      disabled: isLocked,
    },
    {
      id: 'pane_copy',
      labelEn: 'Copy nodes',
      icon: ClipboardCopy,
      shortcut: '⌘C',
      disabled: !hasSelection,
    },
    {
      id: 'pane_cut',
      labelEn: 'Cut nodes',
      icon: Scissors,
      shortcut: '⌘X',
      disabled: isLocked || !hasSelection,
    },
    {
      id: 'pane_paste',
      labelEn: 'Paste nodes',
      icon: Clipboard,
      shortcut: '⌘V',
      disabled: isLocked || !canPaste,
      dividerAfter: true,
    },
    {
      id: 'pane_select_all',
      labelEn: 'Select all',
      icon: Grid3X3,
      shortcut: '⌘A',
    },
    {
      id: 'pane_fit_view',
      labelEn: 'Fit view',
      icon: Maximize,
      shortcut: '⌘0',
    },
    {
      id: 'pane_auto_layout',
      labelEn: 'Auto layout',
      icon: Layout,
      shortcut: '⌘L',
    },
    {
      id: 'pane_auto_cluster',
      labelEn: 'Auto-cluster',
      icon: Layers,
      shortcut: '',
      disabled: isLocked,
      dividerAfter: true,
    },
    {
      id: 'pane_collapse_all',
      labelEn: 'Collapse all',
      icon: ChevronDown,
      shortcut: 'Alt+0',
    },
    {
      id: 'pane_fold_1',
      labelEn: 'Show level 1',
      icon: ChevronDown,
      shortcut: 'Alt+1',
    },
    {
      id: 'pane_fold_2',
      labelEn: 'Show level 2',
      icon: ChevronDown,
      shortcut: 'Alt+2',
    },
    {
      id: 'pane_expand_all',
      labelEn: 'Expand all',
      icon: ChevronDown,
      shortcut: 'Alt+9',
      dividerAfter: true,
    },
    {
      id: 'pane_ai_suggest',
      labelEn: 'AI: Suggest nodes',
      icon: Sparkles,
      disabled: isLocked,
      dividerAfter: true,
    },
    // E10 (2026-08-10): relocated from the node context menu — see the
    // `REGISTRY_ID_BY_LOCAL_ID` comment above and `NodeContextMenu.tsx`'s
    // header. Whole-map generators, correctly at home on the canvas
    // background menu now.
    {
      id: 'pane_dependencies',
      labelEn: 'Detect dependencies',
      icon: Network,
      disabled: isLocked,
    },
    {
      id: 'pane_priority',
      labelEn: 'Prioritize',
      icon: Target,
      disabled: isLocked,
    },
    {
      id: 'pane_competitive',
      labelEn: 'Competitors',
      icon: Globe,
      disabled: isLocked,
    },
  ];

  return (
    <CanvasContextMenu
      x={x}
      y={y}
      onClose={onClose}
      ariaLabel={t('myWorkMindmap.paneMenu.ariaLabel', 'Mind map canvas actions')}
      testId="mindmap-pane-context-menu"
      items={items.map((item) => {
        const Icon = item.icon;
        const registryId = REGISTRY_ID_BY_LOCAL_ID[item.id];
        // Odbiór (Z3): każda z 13 pozycji MUSI mieć wpis w rejestrze — brak
        // wpisu to błąd migracji, nie stan przejściowy do cichego pominięcia.
        if (!registryId || !getAction(registryId)) {
          throw new Error(
            `PaneContextMenu: brak wpisu rejestru dla pozycji menu '${item.id}' (oczekiwano '${registryId ?? '?'}')`
          );
        }
        const comingSoon = comingSoonIds?.includes(item.id) ?? false;
        const disabled = item.disabled || comingSoon;
        return {
          id: item.id,
          label: t(`myWorkMindmap.paneMenu.${item.id}`, item.labelEn),
          icon: <Icon size={14} />,
          shortcut: comingSoon ? t('ideas.mindmap.comingSoon', 'Coming soon') : item.shortcut,
          disabled,
          disabledReason: comingSoon
            ? t('ideas.mindmap.comingSoon', 'Coming soon')
            : disabled
              ? t('myWorkMindmap.paneMenu.disabledReason', 'Unavailable in the current selection')
              : undefined,
          separatorAfter: item.dividerAfter,
          onSelect: () => {
            const ctx: ActionContext = {
              ideaId: '',
              tool: 'mindmap',
              selection: EMPTY_SELECTION,
              surface: 'context',
              source: 'ui',
              language: isPl ? 'pl' : 'en',
              // `run` = dokładnie dotychczasowa klik-ścieżka (`onAction` prop,
              // `IdeaRecommendationMap.handlePaneContextAction` nietknięte).
              // Rejestr konsultuje `run` PRZED jakąkolwiek szyną (Z1/`runToolbarBusAction`),
              // więc kliknięcie człowieka zachowuje się 1:1 jak przed migracją.
              params: { run: () => onAction(item.id) },
            };
            void runIdeaAction(registryId, ctx);
          },
        };
      })}
    />
  );
};
