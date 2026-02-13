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
 * @see docs/ui-standards/detail-view-presentation-modes.md §2.5
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
  /** Build artifact code string from type + id */
  buildArtifactCode?: (type: string, id: string) => string;
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
  activeSection,
  onSectionChange,
  reducedMotion = false,
  motionDuration = 0.22,
  presentationMode,
  onPresentationModeChange,
  buildArtifactCode,
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950">
      <div className="p-6">
        <div className="max-w-6xl mx-auto space-y-0">
          {/* ── Header ──────────────────────────────────────────── */}
          <NModeHeader
            {...header}
            presentationMode={presentationMode}
            onPresentationModeChange={onPresentationModeChange}
            buildArtifactCode={buildArtifactCode}
          />

          {/* ── N Mode Content ──────────────────────────────────── */}
          {presentationMode === 'n' && (
            <div className="col-span-full space-y-0 mt-4">
              {/* Properties Strip */}
              <NModePropertiesStrip fields={properties} />

              {/* Action Bar (conditional) */}
              {actionsVisible && actions.length > 0 && (
                <div className="mb-4 px-4 py-2 rounded-2xl bg-white/80 dark:bg-navy-900/80 backdrop-blur-xl border border-slate-200/60 dark:border-navy-700/60">
                  <NModeActionBar
                    actions={actions}
                    aiContextActions={aiContextActions}
                    activeSection={activeSection}
                  />
                </div>
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
