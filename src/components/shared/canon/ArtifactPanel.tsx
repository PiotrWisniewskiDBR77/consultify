/**
 * ArtifactPanel — canon right panel of an artifact with an ENFORCED section
 * order (ARTIFACT_ANATOMY_STANDARD §2 right panel, §18.1 DoD:
 * "Akcje · Właściwości · Powiązania · Komentarze · Historia/AI").
 *
 * The whole point is that adopters CANNOT reorder sections. Callers pass content
 * per role (via named props), and the component renders the section headers and
 * their fixed sequence. A section with no content is skipped entirely (the
 * order of the remaining sections is preserved). This is why the API is
 * role-named slots, not a `children` array — an array would let the caller
 * choose order, defeating the standard.
 *
 * Section keys (fixed order):
 *   1. actions   — secondary actions (export/share)
 *   2. properties— owner/dates/budget metadata (use <MetaStrip orientation="vertical">)
 *   3. relations — first-class clickable links to other artifacts
 *   4. comments  — comment thread
 *   5. history   — history / versions / AI (§ groups "Historia/AI")
 *
 * @example
 *   <ArtifactPanel
 *     actions={<ExportButtons />}
 *     properties={<MetaStrip orientation="vertical">…</MetaStrip>}
 *     relations={<RelationLinks />}
 *     history={<ActivityLog />}
 *   />
 */

import React from 'react';

export type ArtifactPanelSectionKey =
  | 'actions'
  | 'properties'
  | 'relations'
  | 'comments'
  | 'history';

/**
 * Fixed section order + default heading text. Adopters may override the heading
 * text via `sectionLabels` (e.g. for i18n) but NEVER the order.
 */
export const ARTIFACT_PANEL_SECTION_ORDER: ArtifactPanelSectionKey[] = [
  'actions',
  'properties',
  'relations',
  'comments',
  'history',
];

const DEFAULT_LABELS: Record<ArtifactPanelSectionKey, string> = {
  actions: 'Actions',
  properties: 'Properties',
  relations: 'Relations',
  comments: 'Comments',
  history: 'History / AI',
};

export interface ArtifactPanelProps {
  /** 1 — secondary actions (export/share). */
  actions?: React.ReactNode;
  /** 2 — metadata (owner/dates/budget). */
  properties?: React.ReactNode;
  /** 3 — first-class clickable links to related artifacts. */
  relations?: React.ReactNode;
  /** 4 — comment thread. */
  comments?: React.ReactNode;
  /** 5 — history / versions / AI. */
  history?: React.ReactNode;
  /**
   * Optional per-section heading overrides (e.g. localized labels). Order is
   * still fixed by ARTIFACT_PANEL_SECTION_ORDER regardless of this map.
   */
  sectionLabels?: Partial<Record<ArtifactPanelSectionKey, string>>;
  /** Extra classes on the panel root. */
  className?: string;
}

/**
 * Right-side artifact panel. Renders only the sections that have content, in
 * the canonical order. See file header.
 */
export const ArtifactPanel: React.FC<ArtifactPanelProps> = ({
  actions,
  properties,
  relations,
  comments,
  history,
  sectionLabels,
  className = '',
}) => {
  const content: Record<ArtifactPanelSectionKey, React.ReactNode> = {
    actions,
    properties,
    relations,
    comments,
    history,
  };

  return (
    <aside
      className={`flex w-full flex-col gap-1 overflow-y-auto border-l border-c-border-subtle bg-c-surface ${className}`.trim()}
      aria-label="Artifact panel"
    >
      {ARTIFACT_PANEL_SECTION_ORDER.map((key) => {
        const node = content[key];
        if (node == null || node === false) return null;
        const label = sectionLabels?.[key] ?? DEFAULT_LABELS[key];
        return (
          <section
            key={key}
            data-section={key}
            className="border-b border-c-border-subtle px-4 py-3 last:border-b-0"
          >
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-c-text-muted">
              {label}
            </h3>
            <div className="text-[13px] text-c-text">{node}</div>
          </section>
        );
      })}
    </aside>
  );
};

export default ArtifactPanel;
