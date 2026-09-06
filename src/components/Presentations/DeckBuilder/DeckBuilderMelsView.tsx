/**
 * DeckBuilderMelsView — `ExecutiveModuleShell` adapter for the DeckBuilder
 * lane (EE / Deliverables unification WS-A4 phase 2).
 *
 * Mounted by `<DeckBuilder>` when `isMelsDeckBuilderEnabled()` is true.
 * It is PRESENTATIONAL ONLY — DeckBuilder retains all deck state, effects,
 * autosave, collaboration, version history and handlers, and forwards them
 * here as primitives + ready-made React nodes. This mirrors the proven
 * `TabeleMelsView` pattern so the three editors (Wordy / Tabele /
 * Prezentacje) share one shell with identical chrome.
 *
 * Layout:
 *   - TopBar chips      → buildDeckBuilderTopBarChips (MELS canonical order)
 *   - Left rail         → SlideSorter (supplied as `leftRail`)
 *   - Canvas            → CardCanvas (supplied as `canvas`)
 *   - Right rail        → Blocks / Media / Activity (supplied per tool)
 *   - Teresa            → canonised as the shell's `aiEntrySlot` (docked
 *                         aside on the RIGHT of the shell body), per
 *                         editor-shell-canon §6 Agent E. Previously rendered
 *                         as a bespoke `<aside>` to the LEFT of the shell,
 *                         outside its contract — now passed straight through
 *                         to `ExecutiveModuleShell`'s `aiEntrySlot` prop.
 *   - Banner / overlays → agent-edit proposal banner, modals, command
 *                         palette, share modal, bottom bar (supplied verbatim).
 */

import {
  Activity,
  ChevronDown,
  FileSearch,
  History,
  Link2,
  MessageSquare,
  Palette,
  Play,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CURATED_COLOR_SETS } from '@/components/shared/colorPatterns/curatedColorSets';
import { ExecutiveModuleShell } from '@/components/shared/ExecutiveModuleShell';
import {
  ARTIFACT_PANEL_SECTION_ORDER,
  ArtifactRightPanel,
  type ArtifactRightPanelSection,
} from '@/components/standard/ArtifactRightPanel';

import {
  buildDeckBuilderTopBarChips,
  type DeckBuilderTopBarChipsHandlers,
  type DeckBuilderTopBarChipsLabels,
  type DeckBuilderTopBarChipsState,
} from './DeckBuilderMelsChips';
import {
  buildDeckBuilderRightRailTools,
  type DeckBuilderRightRailLabels,
  DeckBuilderRightRailPanel,
  type DeckBuilderRightRailPanelRenderers,
  type DeckBuilderRightRailState,
  type DeckBuilderRightRailToolId,
} from './DeckBuilderMelsRightRail';

/**
 * Metadane artefaktu-prezentacji pokazywane w sekcji „Właściwości" prawego
 * panelu. Świadomie PRYMITYWY (a nie cały `Deck`): widok jest prezentacyjny,
 * a każdy props-obiekt domeny zaciąga tu logikę, której ten plik nie ma prawa
 * mieć (ten sam idiom co `topBarState`/`rightRailState`).
 */
export interface DeckBuilderArtifactPanelMeta {
  slideCount: number;
  /** 'public' | 'internal' | 'confidential' — etykieta rozwiązywana niżej. */
  confidentiality?: string;
  /** Status cyklu życia decku (draft/in_review/approved/final/ready). */
  status?: string;
  /** Numer wersji z serwera (CAS token). */
  version?: number | null;
  /** Nazwa zestawu kolorów / motywu. */
  colorSetId?: string | null;
  /** Liczba zablokowanych (ręcznie edytowanych) slajdów — sygnał dla Teresy. */
  lockedSlideCount?: number;
}

export interface DeckBuilderMelsViewProps {
  /** Enables the staged Artifact Studio shell contract. */
  artifactStudioMode?: boolean;
  /** Breadcrumb title (deck title). */
  title: string;
  onTitleChange?: (next: string) => void;
  onBack?: () => void;
  backLabel?: string;
  moduleLabel?: string;

  /** Top-bar chip handlers + state (forwarded verbatim from DeckBuilder). */
  topBarHandlers: DeckBuilderTopBarChipsHandlers;
  topBarState?: DeckBuilderTopBarChipsState;
  topBarLabels?: DeckBuilderTopBarChipsLabels;

  /** Right-rail tool state + per-tool panel content. */
  rightRailState?: DeckBuilderRightRailState;
  rightRailLabels?: DeckBuilderRightRailLabels;
  rightRailPanels?: DeckBuilderRightRailPanelRenderers;
  /** Controlled active right-rail tool (so the top-bar can toggle a panel). */
  activeRightRailToolId?: string | null;
  onActiveRightRailToolChange?: (toolId: string | null) => void;

  /** Core slots. */
  leftRail: React.ReactNode;
  canvas: React.ReactNode;
  leftRailTitle?: string;
  /** Single contextual Artifact Studio work bar (Menu 3). */
  menu3Slot?: React.ReactNode;
  /** Unified QA and approval workflow rendered in the single left panel. */
  reviewPanel?: React.ReactNode;

  /**
   * Teresa split-chat aside — forwarded verbatim to the shell's canonical
   * `aiEntrySlot` (docked on the RIGHT of the shell body). Pass `null`/omit
   * when Teresa is closed.
   */
  aiEntrySlot?: React.ReactNode;
  /** Full-width banner above the shell (e.g. the agent-edit proposal banner). */
  bannerSlot?: React.ReactNode;
  /** Full-width bar below the shell (e.g. the deck bottom bar). */
  bottomBarSlot?: React.ReactNode;
  /** Modals / command palette / share modal rendered as floating siblings. */
  overlays?: React.ReactNode;
  /** Collaboration presence indicators for the top bar. */
  presenceSlot?: React.ReactNode;
  /** Artifact identity metadata rendered directly after the editable title. */
  titleTrailingSlot?: React.ReactNode;

  /**
   * Metadane prezentacji do sekcji „Właściwości" prawego panelu artefaktu
   * (SPEC-A §11.2). Pominięcie propa = sekcja nieobecna, nie pusty akordeon.
   */
  artifactPanelMeta?: DeckBuilderArtifactPanelMeta;

  /** Shortcut registry hooks. */
  onRunPrimary?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenShortcutHelp?: () => boolean | void;

  /** Persistence opt-out for tests. */
  persistRailState?: boolean;
}

const PresentMenu: React.FC<{
  enabled: boolean;
  onCurrent?: () => void;
  onStart?: () => void;
  onPresenter?: () => void;
  labels?: DeckBuilderTopBarChipsLabels;
}> = ({ enabled, onCurrent, onStart, onPresenter, labels }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const optionsButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent): void => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        window.setTimeout(() => optionsButtonRef.current?.focus(), 0);
      }
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const run = (handler?: () => void): void => {
    setOpen(false);
    handler?.();
  };

  return (
    <div ref={ref} className="relative flex shrink-0" data-testid="artifact-present-menu">
      <button
        type="button"
        disabled={!enabled || !onCurrent}
        onClick={() => run(onCurrent)}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-l-lg bg-c-text px-3 text-sm font-medium text-c-bg transition-colors hover:bg-c-text-secondary disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Play size={14} aria-hidden="true" />
        {labels?.run ?? 'Present'}
      </button>
      <button
        ref={optionsButtonRef}
        type="button"
        disabled={!enabled}
        aria-label={labels?.runOptions ?? 'Presentation options'}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-r-lg border-l border-c-bg/20 bg-c-text text-c-bg transition-colors hover:bg-c-text-secondary disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open ? (
        <div
          role="menu"
          aria-label={labels?.runOptions ?? 'Presentation options'}
          className="absolute right-0 top-[calc(100%+6px)] z-dropdown min-w-56 rounded-lg border border-c-border bg-c-surface p-1.5 shadow-xl"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => run(onCurrent)}
            className="w-full rounded-md px-3 py-2 text-left text-sm text-c-text hover:bg-c-surface-raised"
          >
            {labels?.runFromCurrent ?? 'From current slide'}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => run(onStart)}
            disabled={!onStart}
            className="w-full rounded-md px-3 py-2 text-left text-sm text-c-text hover:bg-c-surface-raised disabled:opacity-40"
          >
            {labels?.runFromStart ?? 'From beginning'}
          </button>
          <div className="my-1 border-t border-c-border-subtle" />
          <button
            type="button"
            role="menuitem"
            onClick={() => run(onPresenter)}
            disabled={!onPresenter}
            className="w-full rounded-md px-3 py-2 text-left text-sm text-c-text hover:bg-c-surface-raised disabled:opacity-40"
          >
            {labels?.presenter ?? 'Presenter view'}
          </button>
        </div>
      ) : null}
    </div>
  );
};

export const DeckBuilderMelsView: React.FC<DeckBuilderMelsViewProps> = ({
  artifactStudioMode = false,
  title,
  onTitleChange,
  onBack,
  backLabel,
  moduleLabel = 'Prezentacje',
  topBarHandlers,
  topBarState,
  topBarLabels,
  rightRailState,
  rightRailLabels,
  rightRailPanels = {},
  activeRightRailToolId,
  onActiveRightRailToolChange,
  leftRail,
  canvas,
  leftRailTitle = 'Slides',
  menu3Slot,
  reviewPanel,
  aiEntrySlot,
  bannerSlot,
  bottomBarSlot,
  overlays,
  presenceSlot,
  titleTrailingSlot,
  artifactPanelMeta,
  onRunPrimary,
  onOpenCommandPalette,
  onOpenShortcutHelp,
  persistRailState = true,
}) => {
  const { i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const [artifactLeftMode, setArtifactLeftMode] = useState<
    'structure' | 'comments' | 'sources' | 'review'
  >('structure');
  const chips = useMemo(() => {
    const descriptors = buildDeckBuilderTopBarChips({
      handlers: { ...topBarHandlers, onRun: topBarHandlers.onRun ?? onRunPrimary },
      state: topBarState,
      labels: topBarLabels,
    });
    if (!artifactStudioMode) return descriptors;

    // Artifact Studio keeps Menu 2 artifact-scoped and one-line. Theme belongs
    // to contextual Menu 3; Comments previously toggled the now-suppressed
    // local right rail; Teresa is global. Retain the working artifact actions
    // and existing workflow overlays until their common workflows replace
    // them, so the rollout does not trade visual cleanup for lost capability.
    const artifactMenu2Ids = new Set(['internal', 'history', 'qa', 'analytics', 'audit', 'share']);
    return descriptors
      .filter((descriptor) => artifactMenu2Ids.has(descriptor.id))
      .map((descriptor) => {
        switch (descriptor.id) {
          case 'qa':
            return {
              ...descriptor,
              label: 'QA i przegląd',
              overflowSection: 'QA i przegląd',
              onClick: () => setArtifactLeftMode('review'),
            };
          case 'history':
            return {
              ...descriptor,
              label: 'Historia',
              overflowSection: 'Historia',
            };
          case 'audit':
            return {
              ...descriptor,
              label: 'Dziennik audytu',
              overflowSection: 'Historia',
            };
          case 'analytics':
            return {
              ...descriptor,
              label: 'Analityka udostępniania',
              overflowSection: 'Udostępnianie',
            };
          default:
            return descriptor;
        }
      });
  }, [artifactStudioMode, topBarHandlers, onRunPrimary, topBarState, topBarLabels]);

  // HP-17: narzędzie „Źródła i założenia" pojawia się na pasku TYLKO gdy
  // wołający dostarczył jego panel (DeckBuilder robi to za flagą ff_evidencePanel,
  // default OFF). Brak panelu → pasek 1:1 jak przed HP-17.
  const includeEvidence = rightRailPanels.evidence != null;
  // J12-S3 (Honest-UI): „Media" na pasku TYLKO gdy wołający dostarczył panel.
  const includeMedia = rightRailPanels.media != null;
  const rightTools = useMemo(
    () =>
      buildDeckBuilderRightRailTools({
        state: rightRailState,
        labels: rightRailLabels,
        includeEvidence,
        includeMedia,
      }),
    [rightRailState, rightRailLabels, includeEvidence, includeMedia]
  );

  /*
    ★ LEWA SZYNA = WYŁĄCZNIE STRUKTURA (2026-08-30).
    Do dziś ta szyna miała cztery zakładki: Slajdy · Komentarze · Źródła ·
    QA i przegląd. Trzy z nich („o artefakcie", nie „po artefakcie") wróciły
    tam, gdzie SPEC-A §11.2 je stawia — do prawego panelu-akordeonu niżej.
    Trzymanie ich po obu stronach byłoby podwójnym wejściem do tej samej
    treści, czyli szumem; a lewa szyna prezentacji to sorter slajdów.
    „QA i przegląd" ZOSTAJE po lewej: to pełnowysokościowy warsztat przeglądu
    (lista kryteriów + akcje), nie metadana, i akordeon by go zdusił.
  */
  const artifactLeftRail = artifactStudioMode ? (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className="flex shrink-0 items-center gap-1 border-b border-c-border-subtle p-2"
        role="tablist"
        aria-label="Narzędzia prezentacji"
      >
        {(
          [['structure', 'Slajdy'], ...(reviewPanel ? [['review', 'QA i przegląd']] : [])] as Array<
            [typeof artifactLeftMode, string]
          >
        ).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={artifactLeftMode === mode}
            onClick={() => setArtifactLeftMode(mode)}
            className={`min-h-9 rounded-md px-2 text-xs font-medium transition-colors ${
              artifactLeftMode === mode
                ? // axe color-contrast: text-c-focus-solid on bg-c-focus/10 measures
                  // 4.31:1 (< 4.5) — text-c-focus-solid-on-tint is the scoped token
                  // added for this exact pairing (src/index.css, ~5.6:1).
                  'bg-c-focus/10 text-c-focus-solid-on-tint ring-1 ring-inset ring-c-focus'
                : 'text-c-text-secondary hover:bg-c-surface-hover hover:text-c-text'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {artifactLeftMode === 'review' && reviewPanel ? reviewPanel : leftRail}
      </div>
    </div>
  ) : (
    leftRail
  );

  /**
   * ★ PRAWY PANEL ARTEFAKTU-PREZENTACJI (SPEC-A §10.2/§11.2).
   *
   * POWÓD ISTNIENIA (uwaga właściciela 2026-08-30 do `?screen=deck-artifact`:
   * „układ graficzny — pełna zgoda […] do przepracowania mamy prawy panel"):
   * w trybie warsztatu powłoka wygasza `rightRailTools` (linia niżej: `[]`),
   * a `DeckBuilder` podawał `aiEntrySlot` WYŁĄCZNIE przy wyłączonym torze —
   * czyli włączenie toru `presentation` zabierało prezentacji CAŁĄ prawą
   * powierzchnię. Zmierzone przed naprawą: 56 px szyny ikon + 361 px czatu
   * Teresy = 417 px przy torze OFF, i 0 px przy torze ON. Ani jedno, ani
   * drugie nie jest kanonem: kanon to jeden akordeon `ArtifactRightPanel`
   * o stałej, wąskiej szerokości.
   *
   * Kolejność sekcji NIE jest tu zapisana ręcznie — bierze się z
   * `ARTIFACT_PANEL_SECTION_ORDER` (Akcje · Właściwości · Powiązania · Źródła
   * i założenia · Rezultaty · Komentarze · Historia), więc dosypanie sekcji
   * niżej nie może przestawić kolejności. Sekcja bez treści od wołającego
   * jest POMINIĘTA (kanon: „lepiej brak niż pusty akordeon udający funkcję").
   */
  const panelAction = (
    key: string,
    label: string,
    Icon: typeof Palette,
    onClick?: () => void
  ): React.ReactNode =>
    onClick ? (
      <button
        key={key}
        type="button"
        onClick={onClick}
        className="inline-flex min-h-10 w-full items-center gap-2 rounded-lg border border-c-border px-3 text-left text-sm font-medium text-c-text-secondary transition-colors hover:bg-c-surface-hover hover:text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
      >
        <Icon size={15} aria-hidden="true" />
        <span className="truncate">{label}</span>
      </button>
    ) : null;

  const detailRow = (label: string, value: React.ReactNode): React.ReactNode => (
    <div key={label} className="flex items-baseline justify-between gap-3 py-1">
      <dt className="shrink-0 text-xs text-c-text-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right text-xs font-medium text-c-text">{value}</dd>
    </div>
  );

  const artifactRightPanel = useMemo((): React.ReactNode => {
    if (!artifactStudioMode) return undefined;

    const L = (pl: string, en: string): string => (isPolish ? pl : en);
    const commentsBadge =
      typeof rightRailState?.openCommentCount === 'number' && rightRailState.openCommentCount > 0
        ? rightRailState.openCommentCount
        : undefined;
    const activityBadge =
      typeof rightRailState?.agentActivityCount === 'number' &&
      rightRailState.agentActivityCount > 0
        ? rightRailState.agentActivityCount
        : undefined;

    const actions = [
      panelAction(
        'theme',
        L('Motyw i kolorystyka', 'Theme and colours'),
        Palette,
        topBarHandlers.onTheme
      ),
      panelAction(
        'history',
        L('Historia wersji', 'Version history'),
        History,
        topBarHandlers.onHistory
      ),
      panelAction('share', L('Udostępnij', 'Share'), Share2, topBarHandlers.onShare),
      // DEC-419 (06.09.2026): wpis „Zapytaj Teresę o tę prezentację" usunięty
      // z listy akcji — wejście do Teresy jest w Menu 1 (DEC-404).
    ].filter(Boolean);

    const propertyRows = artifactPanelMeta
      ? [
          detailRow(L('Slajdy', 'Slides'), artifactPanelMeta.slideCount),
          artifactPanelMeta.confidentiality
            ? detailRow(
                L('Klasyfikacja', 'Classification'),
                artifactPanelMeta.confidentiality === 'public'
                  ? L('Publiczna', 'Public')
                  : artifactPanelMeta.confidentiality === 'confidential'
                    ? L('Poufna', 'Confidential')
                    : L('Wewnętrzna', 'Internal')
              )
            : null,
          artifactPanelMeta.status
            ? detailRow(
                L('Status', 'Status'),
                artifactPanelMeta.status === 'in_review'
                  ? L('Do przeglądu', 'In review')
                  : artifactPanelMeta.status === 'approved'
                    ? L('Zatwierdzona', 'Approved')
                    : artifactPanelMeta.status === 'final'
                      ? L('Finalna', 'Final')
                      : artifactPanelMeta.status === 'ready'
                        ? L('Gotowa', 'Ready')
                        : L('Szkic', 'Draft')
              )
            : null,
          artifactPanelMeta.colorSetId
            ? detailRow(
                L('Motyw', 'Theme'),
                artifactPanelMeta.colorSetId === 'brand_kit'
                  ? L('Identyfikacja marki', 'Brand kit')
                  : (CURATED_COLOR_SETS.find((set) => set.id === artifactPanelMeta.colorSetId)
                      ?.name ?? artifactPanelMeta.colorSetId.replace(/_/g, ' '))
              )
            : null,
          typeof artifactPanelMeta.version === 'number'
            ? detailRow(L('Wersja', 'Version'), artifactPanelMeta.version)
            : null,
          typeof artifactPanelMeta.lockedSlideCount === 'number' &&
          artifactPanelMeta.lockedSlideCount > 0
            ? detailRow(
                L('Edytowane ręcznie', 'Hand-edited'),
                L(
                  `${artifactPanelMeta.lockedSlideCount} z ${artifactPanelMeta.slideCount}`,
                  `${artifactPanelMeta.lockedSlideCount} of ${artifactPanelMeta.slideCount}`
                )
              )
            : null,
        ].filter(Boolean)
      : [];

    const byId: Partial<Record<string, ArtifactRightPanelSection>> = {};
    if (actions.length > 0) {
      byId.actions = {
        id: 'actions',
        label: L('Akcje', 'Actions'),
        icon: ShieldCheck,
        defaultOpen: true,
        children: <div className="space-y-2">{actions}</div>,
      };
    }
    if (propertyRows.length > 0) {
      byId.properties = {
        id: 'properties',
        label: L('Właściwości', 'Properties'),
        icon: SlidersHorizontal,
        defaultOpen: true,
        children: <dl className="divide-y divide-c-border-subtle">{propertyRows}</dl>,
      };
    }
    if (rightRailPanels.relations) {
      byId.relations = {
        id: 'relations',
        label: L('Powiązania', 'Relations'),
        icon: Link2,
        defaultOpen: false,
        children: rightRailPanels.relations,
      };
    }
    if (rightRailPanels.evidence) {
      byId.evidence = {
        id: 'evidence',
        label: L('Źródła i założenia', 'Sources and assumptions'),
        icon: FileSearch,
        defaultOpen: false,
        children: rightRailPanels.evidence,
      };
    }
    if (rightRailPanels.comments) {
      byId.comments = {
        id: 'comments',
        label: L('Komentarze', 'Comments'),
        icon: MessageSquare,
        defaultOpen: false,
        badge: commentsBadge,
        children: rightRailPanels.comments,
      };
    }
    if (rightRailPanels.activity) {
      byId.history = {
        id: 'history',
        label: L('Historia', 'History'),
        icon: Activity,
        defaultOpen: false,
        badge: activityBadge,
        children: rightRailPanels.activity,
      };
    }

    const sections = ARTIFACT_PANEL_SECTION_ORDER.map((id) => byId[id]).filter(
      (section): section is ArtifactRightPanelSection => section !== undefined
    );
    if (sections.length === 0) return undefined;

    return (
      // DEC-419 (06.09.2026): przycisk „Zapytaj Teresę o tę prezentację" usunięty
      // z sekcji Akcje — wejście do Teresy jest w Menu 1 (DEC-404).
      <ArtifactRightPanel
        sections={sections}
        width="100%"
        ariaLabel={L('Panel prezentacji', 'Presentation panel')}
      />
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    artifactStudioMode,
    artifactPanelMeta,
    isPolish,
    rightRailPanels.relations,
    rightRailPanels.evidence,
    rightRailPanels.comments,
    rightRailPanels.activity,
    rightRailState?.openCommentCount,
    rightRailState?.agentActivityCount,
    topBarHandlers.onTheme,
    topBarHandlers.onHistory,
    topBarHandlers.onShare,
    topBarHandlers.onToggleAgent,
  ]);

  const shell = (
    <ExecutiveModuleShell
      moduleKey="prezentacje"
      moduleLabel={moduleLabel}
      title={title}
      onTitleChange={onTitleChange}
      onBack={onBack}
      backLabel={backLabel}
      topBarChips={chips}
      topBarPrimaryActionSlot={
        artifactStudioMode ? (
          <PresentMenu
            enabled={topBarState?.runEnabled !== false}
            onCurrent={topBarHandlers.onRun ?? onRunPrimary}
            onStart={topBarHandlers.onRunFromStart}
            onPresenter={topBarHandlers.onPresenter}
            labels={topBarLabels}
          />
        ) : undefined
      }
      artifactStudioMode={artifactStudioMode}
      globalTeresaSlot={artifactStudioMode ? aiEntrySlot : undefined}
      bottomBar={artifactStudioMode ? bottomBarSlot : undefined}
      secondBar={artifactStudioMode ? menu3Slot : undefined}
      presenceSlot={presenceSlot}
      topBarTitleTrailingSlot={artifactStudioMode ? titleTrailingSlot : undefined}
      leftRailTitle={artifactStudioMode ? 'Struktura prezentacji' : leftRailTitle}
      leftRailContent={artifactLeftRail}
      // Stary pas ikon jest w trybie warsztatu wygaszany; prawa powierzchnia
      // prezentacji to `artifactRightPanelSlot` niżej (SPEC-A §11.2).
      rightRailTools={artifactStudioMode ? [] : rightTools}
      // ★ 2026-09-01 (dyżur 164): `artifactRightPanelWidth={300}` USUNIĘTE.
      // Panel Decka był o 20 px węższy od kart N i — zmierzone na żywym
      // renderze — przy 300 px dostawał WŁASNY poziomy pasek przewijania
      // (treść nie mieściła się w pasie). Szerokość bierze teraz powłoka
      // z tokenu `--ntype-right-panel-width`; nie wpisuj tu liczby.
      artifactRightPanelSlot={artifactRightPanel}
      activeRightRailToolId={activeRightRailToolId}
      onActiveRightRailToolChange={onActiveRightRailToolChange}
      renderRightRailPanel={(activeToolId) => (
        <DeckBuilderRightRailPanel
          activeToolId={activeToolId as DeckBuilderRightRailToolId | null}
          panels={rightRailPanels}
          isPolish={isPolish}
          state={rightRailState}
        />
      )}
      canvas={canvas}
      aiEntrySlot={artifactStudioMode ? undefined : aiEntrySlot}
      onRunPrimary={onRunPrimary}
      onToggleAgent={topBarHandlers.onToggleAgent}
      onOpenCommandPalette={onOpenCommandPalette}
      onOpenShortcutHelp={onOpenShortcutHelp}
      persistRailState={persistRailState}
      testId="deck-builder-mels-view"
    />
  );

  return (
    <div
      className="h-full flex flex-col bg-c-surface overflow-hidden"
      data-testid="deck-builder-mels-root"
    >
      {bannerSlot}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 min-w-0 flex flex-col">{shell}</div>
      </div>
      {!artifactStudioMode ? bottomBarSlot : null}
      {overlays}
    </div>
  );
};

export default DeckBuilderMelsView;
