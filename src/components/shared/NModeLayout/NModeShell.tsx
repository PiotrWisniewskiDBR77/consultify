/**
 * NModeShell
 *
 * Top-level layout shell for N-mode (page-first, 2-pane) artifact detail views.
 * Composes: Header → PropertiesStrip → ActionBar → LeftNav + Canvas.
 *
 * This is the **standard** layout for all artifact types:
 * Decision, Task, Notification, Initiative, and future artifacts.
 *
 * Usage:
 * ```tsx
 * <NModeShell
 *   header={headerConfig}
 *   properties={propertyFields}
 *   sections={sections}
 *   actions={actions}
 *   actionsVisible={isPending}
 *   aiContextActions={aiActions}
 *   activeSection={activeSection}
 *   onSectionChange={setActiveSection}
 * />
 * ```
 *
 * @see docs/ui-standards/01-shell-layout/presentation-modes.md §2.5
 */

import { Loader2 } from 'lucide-react';
import React, { useEffect, useRef } from 'react';

import type { PresentationMode } from '@/hooks/usePresentationMode';

import NModeActionBar from './NModeActionBar';
import NModeCanvas from './NModeCanvas';
import { NModeCBoard } from './NModeCBoard';
import NModeHeader from './NModeHeader';
import NModeLeftNav from './NModeLeftNav';
import NModePropertiesStrip from './NModePropertiesStrip';
import type { NModeShellProps } from './types';

interface NModeShellExtraProps extends NModeShellProps {
  /** Current presentation mode (for the header switcher) */
  presentationMode: PresentationMode;
  /** Mode change handler */
  onPresentationModeChange: (mode: PresentationMode) => void;
  /** Pokazuje przełącznik gęstości N/C w nagłówku. Domyślnie `false` (standard
   *  n-Type ETAP 1.1 — karty N mają jeden widok). Włącza go tylko konsument,
   *  który jawnie poda `true` (dziś: Interview, nie jest kartą N). */
  showModeSwitcher?: boolean;
  /** Build artifact code string from type + id */
  buildArtifactCode?: (type: string, id: string) => string;
  /** Max columns for the properties strip (default 6). Use to balance a long
   *  metric strip — e.g. 5 for 10 metrics → a symmetric 5×2 (#27b). */
  propertiesMaxColumns?: number;
  /** Show loading state */
  loading?: boolean;
  /** SPEC-A prawy panel artefaktu (dokowany, na całą wysokość) — zwykle
   *  `<ArtifactRightPanel sections={…} />`. Gdy pominięty, powłoka renderuje się
   *  bez zmian (wstecznie zgodne). Ukryty <lg (mobile), by nie ściskać centrum. */
  rightPanel?: React.ReactNode;
  /**
   * Karta otwarta w trybie „Podgląd" (Menu 2 → Edycja | Podgląd).
   *
   * Powłoka przekazuje to dalej do `NModeLeftNav`, który w Podglądzie chowa
   * uchwyty przeciągania (standard §4.4). Opcjonalny — gdy konsument go nie
   * poda, powłoka próbuje ODCZYTAĆ tryb z paska Menu 2 zwróconego przez
   * `renderActionBar()` (patrz `resolveReadMode` niżej), a gdy i tego nie ma,
   * zachowuje dzisiejsze zachowanie 1:1.
   */
  readMode?: boolean;
}

/**
 * Fallback trybu Podglądu, gdy konsument nie podał `readMode` powłoce.
 *
 * DLACZEGO: stan „Edycja | Podgląd" mieszka dziś w karcie (lokalny `useState`)
 * i wędruje wyłącznie do `NModeMenu2` przez `renderActionBar()`. Powłoka nie ma
 * do niego innego dojścia, a Podgląd bez uchwytów to wymóg standardu — więc
 * zamiast wymuszać zmianę w sześciu kartach naraz, powłoka zagląda do
 * ELEMENTU Reacta, który sama za chwilę wyrenderuje. To zwykły odczyt propsów
 * elementu (nie DOM, nie ref, nie hack na czasie), w pełni bezpieczny: gdy
 * pasek nie niesie `readMode`, wynik to `false`, czyli stan sprzed zmiany.
 *
 * Docelowo (po fali kart): karta poda `readMode` powłoce wprost i ten fallback
 * będzie martwy — dlatego prop jawny ma pierwszeństwo.
 */
const resolveReadMode = (bar: React.ReactNode): boolean => {
  if (!React.isValidElement(bar)) return false;
  const props = bar.props as { readMode?: unknown; children?: React.ReactNode };
  if (typeof props.readMode === 'boolean') return props.readMode;
  // Pasek opakowany we fragment / kontener — sprawdź bezpośrednie dzieci.
  return React.Children.toArray(props.children).some((child) => {
    if (!React.isValidElement(child)) return false;
    return (child.props as { readMode?: unknown }).readMode === true;
  });
};

/**
 * Sticky toolbar host — import this when building a custom toolbar container
 * outside NModeShell.
 *
 * `mt-2` (8 px) = JEDEN odstęp Menu 1 ↔ Menu 2 dla wszystkich kart. Pomiar
 * 2026-07-23 dał 0/0/0/8/8/68 px w sześciu kartach — dwa zaokrąglone paski
 * stykały się krawędziami, jakby były jednym elementem. Wartość siedzi w tej
 * stałej (a nie w każdej karcie z osobna), bo stałą importują też karty
 * budujące własny kontener paska — więc jedna zmiana ustawia je wszystkie.
 */
export const NMODE_TOOLBAR_SHELL_CLASS =
  'sticky top-0 z-30 mt-2 bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm border-b border-slate-200/60 dark:border-navy-700/40';

export const NModeShell: React.FC<NModeShellExtraProps> = ({
  header,
  properties,
  sections,
  actions = [],
  actionsVisible = false,
  aiContextActions = [],
  toolAIActions = [],
  renderActionBar,
  hideToolbarWhenEmpty = false,
  activeSection,
  onSectionChange,
  onSectionReorder,
  reducedMotion = false,
  motionDuration = 0.22,
  presentationMode,
  onPresentationModeChange,
  showModeSwitcher = false,
  buildArtifactCode,
  propertiesMaxColumns,
  loading = false,
  rightPanel,
  readMode,
  children,
}) => {
  const centerScrollRef = useRef<HTMLDivElement>(null);

  // A document may be opened in the same hub without unmounting this shell.
  // Browsers then retain the previous document's scrollTop, which can make a
  // resumed tool session appear to start halfway through its canvas (with the
  // header, properties and phase summary hidden above the viewport). Artifact
  // identity is the navigation boundary: every newly opened card starts at its
  // canonical top, while normal scrolling inside the same card is preserved.
  useEffect(() => {
    centerScrollRef.current?.scrollTo?.({ top: 0, left: 0, behavior: 'auto' });
  }, [header.artifactId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-white dark:bg-navy-950">
        <Loader2 className="animate-spin text-c-info" size={32} />
      </div>
    );
  }

  // Pasek Menu 2 budujemy RAZ (a nie dwa razy: pod odczyt trybu i pod render),
  // żeby nie tworzyć dwóch drzew i nie ryzykować rozjazdu. Liczone PO bramce
  // `loading`, bo dawniej `renderActionBar()` też nie było wołane w ładowaniu.
  const actionBarNode = renderActionBar ? renderActionBar() : null;
  const hasToolbarContent = renderActionBar
    ? actionBarNode !== null && actionBarNode !== undefined && actionBarNode !== false
    : (actionsVisible && actions.length > 0) || toolAIActions.length > 0;
  const showToolbarShell = !hideToolbarWhenEmpty || hasToolbarContent;
  const effectiveReadMode = readMode ?? resolveReadMode(actionBarNode);
  const hasActionBar = Boolean(
    actionBarNode || (actionsVisible && actions.length > 0) || toolAIActions.length > 0
  );

  return (
    <div className="h-full min-h-0 flex">
      {/* ── Kolumna centrum (własny scroll; gdy brak rightPanel = pełna szerokość, identycznie jak dawniej) ── */}
      <div
        ref={centerScrollRef}
        className="flex-1 min-w-0 h-full min-h-0 overflow-y-auto bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950"
      >
        {/* ── Segment 1: Header + PropertiesStrip (scrolls away) ────────────────── */}
        <div
          className={`${header.sticky ? 'sticky top-0 z-30 bg-c-bg/90 pb-2 backdrop-blur-xl' : 'pb-0'} px-6 pt-4`}
        >
          <div className="max-w-6xl mx-auto">
            <NModeHeader
              {...header}
              presentationMode={presentationMode}
              onPresentationModeChange={onPresentationModeChange}
              showModeSwitcher={showModeSwitcher}
              buildArtifactCode={buildArtifactCode}
            />
            {(presentationMode === 'n' || presentationMode === 'c') && properties && (
              <NModePropertiesStrip fields={properties} maxColumns={propertiesMaxColumns} />
            )}
          </div>
        </div>

        {/* ── Segment 2: Sticky toolbar ──────────────────────────────────────────── */}
        {/* Padding `px-6` siedzi NA ZEWNĄTRZ limitu `max-w-6xl`, identycznie jak
            Segment 1 (Menu 1, :153) i Segment 3 (Sekcje, :188). Wcześniej `px-6`
            było WEWNĄTRZ limitu (`max-w-6xl mx-auto px-6`) i zjadało 48 px tylko
            Menu 2 przy szerokim oknie — pasek akcji rozjeżdżał się względem
            nagłówka o 2×24 px (zmierzone 2026-07-24: Menu 1 szer. 1152, Menu 2
            szer. 1104). Tło/ramka/`mt-2` zostają na pełnowymiarowym pasku
            (`NMODE_TOOLBAR_SHELL_CLASS`), więc sticky-tło dalej biegnie od
            krawędzi do krawędzi. Zmiana jest wspólna dla wszystkich sześciu
            kart N na tej powłoce. */}
        {hasActionBar && (
          <div className={NMODE_TOOLBAR_SHELL_CLASS}>
            <div className="px-6 py-2">
              <div className="max-w-6xl mx-auto">
                {renderActionBar
                  ? actionBarNode
                  : ((actionsVisible && actions.length > 0) || toolAIActions.length > 0) && (
                      <NModeActionBar
                        actions={actionsVisible ? actions : []}
                        aiContextActions={aiContextActions}
                        toolAIActions={toolAIActions}
                        activeSection={activeSection}
                      />
                    )}
              </div>
            </div>
          </div>
        )}

        {/* ── Segment 3: Main content (scrollable, padded) ──────────────────────── */}
        <div className="px-6 pb-6">
          <div className="max-w-6xl mx-auto">
            {/* N Mode */}
            {presentationMode === 'n' && (
              <div className="flex gap-0 min-h-[60vh] pt-4">
                <NModeLeftNav
                  sections={sections}
                  activeSection={activeSection}
                  onSectionChange={onSectionChange}
                  onSectionReorder={onSectionReorder}
                  readMode={effectiveReadMode}
                />
                <NModeCanvas
                  sections={sections}
                  activeSection={activeSection}
                  reducedMotion={reducedMotion}
                  motionDuration={motionDuration}
                />
              </div>
            )}

            {/* C Mode */}
            {presentationMode === 'c' && (
              <div className="pt-4">
                <NModeCBoard sections={sections} />
              </div>
            )}

            {/* Always-rendered children (modals, overlays, dialogs) — available in
              BOTH N and C modes, not gated by presentation mode. */}
            {children}
          </div>
        </div>
      </div>
      {/* ── Prawy panel dokowany (SPEC-A) — pełna wysokość, border-l własne; ukryty <lg by nie ściskać centrum ── */}
      {rightPanel ? (
        <div className="hidden lg:block shrink-0 h-full min-h-0">{rightPanel}</div>
      ) : null}
    </div>
  );
};

export default NModeShell;
