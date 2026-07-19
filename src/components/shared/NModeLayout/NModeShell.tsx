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
import React from 'react';

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
  /** If false, hides the mode switcher in the header */
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
}

/** Sticky toolbar host — import this when building a custom toolbar container outside NModeShell */
export const NMODE_TOOLBAR_SHELL_CLASS =
  'sticky top-0 z-30 bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm border-b border-slate-200/60 dark:border-navy-700/40';

export const NModeShell: React.FC<NModeShellExtraProps> = ({
  header,
  properties,
  sections,
  actions = [],
  actionsVisible = false,
  aiContextActions = [],
  toolAIActions = [],
  renderActionBar,
  activeSection,
  onSectionChange,
  onSectionReorder,
  reducedMotion = false,
  motionDuration = 0.22,
  presentationMode,
  onPresentationModeChange,
  showModeSwitcher = true,
  buildArtifactCode,
  propertiesMaxColumns,
  loading = false,
  rightPanel,
  children,
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-white dark:bg-navy-950">
        <Loader2 className="animate-spin text-c-info" size={32} />
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex">
      {/* ── Kolumna centrum (własny scroll; gdy brak rightPanel = pełna szerokość, identycznie jak dawniej) ── */}
      <div className="flex-1 min-w-0 h-full min-h-0 overflow-y-auto bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950">
        {/* ── Segment 1: Header + PropertiesStrip (scrolls away) ────────────────── */}
        <div className="px-6 pt-4 pb-0">
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
        <div className={NMODE_TOOLBAR_SHELL_CLASS}>
          <div className="max-w-6xl mx-auto px-6 py-2">
            {renderActionBar
              ? renderActionBar()
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
