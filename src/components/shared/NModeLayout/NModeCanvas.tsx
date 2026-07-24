/**
 * NModeCanvas
 *
 * Content area that shows the currently selected section with AnimatePresence transitions.
 * Follows "N BLOCKS KIT" — flat, quiet UI with typography + whitespace, NOT frames.
 *
 * @see docs/ui-standards/01-shell-layout/presentation-modes.md §2.5.3
 */

import { AnimatePresence, motion } from 'framer-motion';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { SectionErrorBoundary } from './SectionErrorBoundary';
import type { NModeSection } from './types';

interface NModeCanvasProps {
  /** Available sections (used to find the active one) */
  sections: NModeSection[];
  /** Currently active section id */
  activeSection: string;
  /** Whether to skip animations (prefers-reduced-motion) */
  reducedMotion?: boolean;
  /** Motion transition duration in seconds (default: 0.22) */
  motionDuration?: number;
}

export const NModeCanvas: React.FC<NModeCanvasProps> = ({
  sections,
  activeSection,
  reducedMotion = false,
  motionDuration = 0.22,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const activeSectionDef = sections.find((s) => s.id === activeSection);

  // Brak pl-* celowo: odstęp lewy panel ↔ centrum (24px) niesie wyłącznie
  // NModeLeftNav przez token --ntype-column-gap (pr). Trzymanie tu drugiego
  // pl-6 dawało 40px podwójnego marginesu (SSOT: _GRID_STABILIZATION_COMMAND_2026-07-24).
  return (
    <div className="flex-1 pt-1 min-w-0">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSection}
          initial={reducedMotion ? {} : { opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducedMotion ? {} : { opacity: 0, y: -3 }}
          transition={{ duration: motionDuration }}
        >
          {/* ═══════════════════════════════════════════════
              N BLOCKS KIT — flat, quiet UI (§2.5.3 / §2.5.5)
              Typography + whitespace, NOT frames.
              A per-section boundary isolates a crashing section so it can't take
              down the whole detail view (#24) — applies to ALL NModeShell views.
              ═══════════════════════════════════════════════ */}
          <SectionErrorBoundary
            key={activeSection}
            sectionLabel={
              activeSectionDef
                ? isPolish
                  ? activeSectionDef.label.pl
                  : activeSectionDef.label.en
                : undefined
            }
            isPolish={isPolish}
          >
            {activeSectionDef?.component}
          </SectionErrorBoundary>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default NModeCanvas;
