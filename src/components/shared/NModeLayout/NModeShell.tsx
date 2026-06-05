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
}

export const NModeShell: React.FC<NModeShellExtraProps> = ({
  header,
  properties,
  sections,
  actions = [],
  actionsVisible = false,
  aiContextActions = [],
  renderActionBar,
  activeSection,
  onSectionChange,
  reducedMotion = false,
  motionDuration = 0.22,
  presentationMode,
  onPresentationModeChange,
  showModeSwitcher = true,
  buildArtifactCode,
  propertiesMaxColumns,
  loading = false,
  children,
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-white dark:bg-navy-950">
        <Loader2 className="animate-spin text-primary-500" size={32} />
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950">
      <div className="p-6">
        <div className="max-w-6xl mx-auto space-y-0">
          {/* ── Header ──────────────────────────────────────────── */}
          <NModeHeader
            {...header}
            presentationMode={presentationMode}
            onPresentationModeChange={onPresentationModeChange}
            showModeSwitcher={showModeSwitcher}
            buildArtifactCode={buildArtifactCode}
          />

          {/* ── N Mode Content ──────────────────────────────────── */}
          {presentationMode === 'n' && (
            <div className="col-span-full space-y-0 mt-4">
              {/* Properties Strip */}
              <NModePropertiesStrip fields={properties} maxColumns={propertiesMaxColumns} />

              {/* Action Bar — custom slot or standard NModeActionBar */}
              {renderActionBar ? (
                <div className="mb-4 px-4 py-2 rounded-2xl bg-slate-50/90 dark:bg-navy-900/50 backdrop-blur-xl">
                  {renderActionBar()}
                </div>
              ) : (
                actionsVisible &&
                actions.length > 0 && (
                  <div className="mb-4 px-4 py-2 rounded-2xl bg-slate-50/90 dark:bg-navy-900/50 backdrop-blur-xl">
                    <NModeActionBar
                      actions={actions}
                      aiContextActions={aiContextActions}
                      activeSection={activeSection}
                    />
                  </div>
                )
              )}

              {/* 2-Pane: LeftNav + Canvas */}
              <div className="flex gap-0 min-h-[60vh]">
                <NModeLeftNav
                  sections={sections}
                  activeSection={activeSection}
                  onSectionChange={onSectionChange}
                />
                <NModeCanvas
                  sections={sections}
                  activeSection={activeSection}
                  reducedMotion={reducedMotion}
                  motionDuration={motionDuration}
                />
              </div>
            </div>
          )}

          {/* ── C Mode Content (rendered by consumer via children) ── */}
          {presentationMode === 'c' && children}
        </div>
      </div>
    </div>
  );
};

export default NModeShell;
