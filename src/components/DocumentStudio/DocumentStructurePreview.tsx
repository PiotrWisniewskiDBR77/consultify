/**
 * Consultify Document Studio — read-only "structure preview" silhouette for
 * the Word Template Architect (robota genword-structure-preview, 2026-07-23).
 *
 * Renders the SHAPE of a document — hierarchy (indent by `level`) and
 * density (bar count by `expectedLengthHint`) — as plain c-* rectangles.
 * Deliberately shows no invented text: no section titles, no generated
 * copy, just proportional bars/lines so an author can eyeball whether the
 * template reads as top-heavy, evenly paced, or missing a long section
 * before ever seeing generated content.
 *
 * Mapping (see task spec):
 *   level 1|2|3        → left indent (0 / 14 / 28px) + heading bar
 *                         width/height taper (wider+thicker at level 1).
 *   expectedLengthHint  → number of content lines under the heading bar:
 *     short  = 1 line
 *     medium = 3 lines (spec range 2-3 → mid value)
 *     long   = 5 lines (spec range 4-5 → mid-high value)
 *   required            → small filled dot next to the heading bar.
 *
 * Pure presentational component: no data fetching, no i18n copy beyond
 * accessibility labels/empty-state, no crimson (tokens only).
 */
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { TemplateSectionBlueprint } from './types';

export type StructurePreviewSection = Pick<
  TemplateSectionBlueprint,
  'title' | 'level' | 'required' | 'expectedLengthHint'
>;

interface DocumentStructurePreviewProps {
  sections: readonly StructurePreviewSection[];
  className?: string;
}

const LEVEL_INDENT_PX: Record<1 | 2 | 3, number> = { 1: 0, 2: 14, 3: 28 };
const LEVEL_HEADING_WIDTH_PCT: Record<1 | 2 | 3, number> = { 1: 82, 2: 62, 3: 46 };
const LEVEL_HEADING_HEIGHT_PX: Record<1 | 2 | 3, number> = { 1: 10, 2: 8, 3: 6 };

// Deterministic per-hint line counts + slightly varied widths so the
// silhouette doesn't look like a rigid table — still pure geometry, no copy.
const LENGTH_LINE_WIDTHS_PCT: Record<TemplateSectionBlueprint['expectedLengthHint'], number[]> = {
  short: [55],
  medium: [92, 74, 50],
  long: [95, 82, 68, 88, 42],
};

function normalizeLevel(level: number): 1 | 2 | 3 {
  return level === 2 ? 2 : level === 3 ? 3 : 1;
}

/**
 * Vertical silhouette of a document's structure: indent = hierarchy,
 * bar length = header, stacked lines = content density. Read-only, no
 * generated text — safe to render live from either the approved
 * `sectionBlueprint` or an in-progress `editSections` draft.
 */
export const DocumentStructurePreview: React.FC<DocumentStructurePreviewProps> = ({
  sections,
  className,
}) => {
  const { t } = useTranslation();

  if (sections.length === 0) {
    return (
      <div
        className={`rounded-lg border border-dashed border-c-border-subtle p-4 text-center text-xs text-c-text-muted ${className ?? ''}`}
      >
        {t('documentStudio.templateArchitect.structurePreviewEmpty', 'No sections yet.')}
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={t(
        'documentStudio.templateArchitect.structurePreviewAriaLabel',
        'Document structure preview, {{count}} sections',
        { count: sections.length }
      )}
      className={`rounded-lg border border-c-border-subtle bg-c-surface-raised p-3 ${className ?? ''}`}
    >
      <div className="flex flex-col gap-2.5">
        {sections.map((section, idx) => {
          const level = normalizeLevel(section.level);
          const lineWidths =
            LENGTH_LINE_WIDTHS_PCT[section.expectedLengthHint] ?? LENGTH_LINE_WIDTHS_PCT.medium;
          return (
            <div
              key={idx}
              style={{ paddingLeft: `${LEVEL_INDENT_PX[level]}px` }}
              className="flex flex-col gap-1"
              title={section.title || undefined}
            >
              <div className="flex items-center gap-1.5">
                <div
                  className="rounded-sm bg-c-text-muted"
                  style={{
                    width: `${LEVEL_HEADING_WIDTH_PCT[level]}%`,
                    height: `${LEVEL_HEADING_HEIGHT_PX[level]}px`,
                  }}
                />
                {section.required ? (
                  <span
                    aria-hidden="true"
                    title={t(
                      'documentStudio.templateArchitect.requiredSectionMarker',
                      'Required section'
                    )}
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-c-text-secondary"
                  />
                ) : null}
              </div>
              <div className="flex flex-col gap-1">
                {lineWidths.map((widthPct, lineIdx) => (
                  <div
                    key={lineIdx}
                    className="h-1 rounded-sm bg-c-border-subtle"
                    style={{ width: `${widthPct}%` }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DocumentStructurePreview;
