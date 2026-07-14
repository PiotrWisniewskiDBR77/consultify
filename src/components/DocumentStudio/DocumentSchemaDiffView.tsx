/**
 * B3 — Document Studio visual diff view (FR-15 track-changes surface).
 *
 * Shared, read-only renderer for a `DocumentSchemaDiff` used in BOTH contexts:
 * 1. Editor panel — reviewing an AI proposal before approve/reject
 *    (proposal adapted via `proposalToSchemaDiff()`);
 * 2. Document panel — comparing a version snapshot against the live schema
 *    (diff comes ready-made from `GET /:artifactId/diff`).
 *
 * Rendering rules:
 * - textual blocks (paragraph/heading/lists/quote/…) → inline token-level
 *   diff: added tokens get a subtle success highlight, removed tokens are
 *   struck through with a muted danger tone;
 * - structural blocks (table/chart/kpi_strip/risk_table/image) → a
 *   "changed block: <type>" label plus the canonical text projections as
 *   metadata (no word diff — the projection is machine-shaped);
 * - added / removed whole blocks → full-text highlight in the same palette.
 *
 * Colour tokens: success/danger families only (never tailwind `primary`,
 * which maps to crimson). Alpha variants use the tailwind `success-500` /
 * `danger-500` palette utilities already established in this module —
 * `bg-c-success/15`-style alpha on c-* tokens does not emit CSS rules.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import { diffTextSegments } from './diffText';
import { AGGREGATE_DIFF_SECTION_ID, isTextualBlockType } from './documentDiffModel';
import type { DocumentBlockDiffEntry, DocumentSchemaDiff, DocumentSectionDiffEntry } from './types';

const ADDED_SEGMENT_CLASS =
  'rounded-sm bg-success-500/15 text-success-800 dark:bg-success-500/20 dark:text-emerald-300';
const REMOVED_SEGMENT_CLASS =
  'rounded-sm bg-danger-500/10 text-danger-700 line-through decoration-danger-500/70 dark:bg-danger-500/15 dark:text-danger-300';

/** Inline token-level text diff (added = success highlight, removed = struck danger). */
export function InlineTextDiff({
  before,
  after,
}: {
  before: string;
  after: string;
}): React.ReactElement {
  const segments = diffTextSegments(before, after);
  return (
    <span className="whitespace-pre-wrap break-words text-c-text">
      {segments.map((segment, index) => {
        if (segment.kind === 'added') {
          return (
            <ins key={index} className={`no-underline ${ADDED_SEGMENT_CLASS}`}>
              {segment.value}
            </ins>
          );
        }
        if (segment.kind === 'removed') {
          return (
            <del key={index} className={REMOVED_SEGMENT_CLASS}>
              {segment.value}
            </del>
          );
        }
        return <span key={index}>{segment.value}</span>;
      })}
    </span>
  );
}

function SectionKindBadge({
  kind,
}: {
  kind: DocumentSectionDiffEntry['kind'];
}): React.ReactElement {
  const { t } = useTranslation();
  const label =
    kind === 'added'
      ? t('documentStudio.diff.kindAdded', 'Added')
      : kind === 'removed'
        ? t('documentStudio.diff.kindRemoved', 'Removed')
        : kind === 'reordered'
          ? t('documentStudio.diff.kindReordered', 'Reordered')
          : t('documentStudio.diff.kindModified', 'Modified');
  const toneClass =
    kind === 'added'
      ? 'bg-success-500/10 text-success-700 dark:text-emerald-300'
      : kind === 'removed'
        ? 'bg-danger-500/10 text-danger-700 dark:text-danger-300'
        : 'bg-c-surface-raised text-c-text-secondary';
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${toneClass}`}
    >
      {label}
    </span>
  );
}

function StructuralBlockRow({ block }: { block: DocumentBlockDiffEntry }): React.ReactElement {
  const { t } = useTranslation();
  const type = block.blockType ?? t('documentStudio.diff.unknownBlockType', 'unknown');
  const label =
    block.kind === 'added'
      ? t('documentStudio.diff.structuralAdded', {
          defaultValue: 'Added block: {{type}}',
          type,
        })
      : block.kind === 'removed'
        ? t('documentStudio.diff.structuralRemoved', {
            defaultValue: 'Removed block: {{type}}',
            type,
          })
        : t('documentStudio.diff.structuralChanged', {
            defaultValue: 'Changed block: {{type}}',
            type,
          });
  return (
    <div>
      <div className="font-medium text-c-text">{label}</div>
      {block.kind === 'modified' && (block.beforeText || block.afterText) ? (
        <dl className="mt-1 space-y-1">
          <div className="flex gap-2">
            <dt className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">
              {t('documentStudio.diff.before', 'Before')}
            </dt>
            <dd className="min-w-0 truncate font-mono text-[11px] text-danger-700 dark:text-danger-300">
              {block.beforeText ?? '—'}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">
              {t('documentStudio.diff.after', 'After')}
            </dt>
            <dd className="min-w-0 truncate font-mono text-[11px] text-success-700 dark:text-emerald-300">
              {block.afterText ?? '—'}
            </dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
}

function BlockDiffRow({ block }: { block: DocumentBlockDiffEntry }): React.ReactElement {
  const { t } = useTranslation();
  const moved =
    block.beforePositionIndex != null &&
    block.afterPositionIndex != null &&
    block.beforePositionIndex !== block.afterPositionIndex;
  const textual = isTextualBlockType(block.blockType) || block.blockType == null;

  let body: React.ReactNode;
  if (!textual) {
    body = <StructuralBlockRow block={block} />;
  } else if (block.kind === 'added') {
    body = (
      <ins className={`whitespace-pre-wrap break-words no-underline ${ADDED_SEGMENT_CLASS}`}>
        {block.afterText ?? ''}
      </ins>
    );
  } else if (block.kind === 'removed') {
    body = (
      <del className={`whitespace-pre-wrap break-words ${REMOVED_SEGMENT_CLASS}`}>
        {block.beforeText ?? ''}
      </del>
    );
  } else {
    body = <InlineTextDiff before={block.beforeText ?? ''} after={block.afterText ?? ''} />;
  }

  return (
    <div
      className="rounded-md border border-c-border-subtle bg-c-surface-raised p-2 text-xs"
      data-testid={`diff-block-${block.blockId}`}
    >
      {block.blockType ? (
        <div className="mb-1 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wide text-c-text-muted">
          <span>{block.blockType}</span>
          {moved ? (
            <span>
              {t('documentStudio.diff.blockMoved', {
                defaultValue: 'position {{from}} → {{to}}',
                from: (block.beforePositionIndex ?? 0) + 1,
                to: (block.afterPositionIndex ?? 0) + 1,
              })}
            </span>
          ) : null}
        </div>
      ) : null}
      {body}
    </div>
  );
}

function SectionDiffCard({ section }: { section: DocumentSectionDiffEntry }): React.ReactElement {
  const { t } = useTranslation();
  const changedBlocks = section.blockDiffs.filter((block) => block.kind !== 'unchanged');
  const isAggregate = section.sectionId === AGGREGATE_DIFF_SECTION_ID;
  const title = isAggregate
    ? t('documentStudio.diff.wholeDocument', 'Whole document')
    : (section.afterTitle ?? section.beforeTitle ?? section.sectionId);
  const renamed =
    !isAggregate &&
    section.beforeTitle != null &&
    section.afterTitle != null &&
    section.beforeTitle !== section.afterTitle;
  const reordered =
    section.beforeOrderIndex != null &&
    section.afterOrderIndex != null &&
    section.beforeOrderIndex !== section.afterOrderIndex;

  return (
    <li
      className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-3 text-xs"
      data-testid={`diff-section-${section.sectionId}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 font-medium text-c-text">
          {renamed ? (
            <InlineTextDiff before={section.beforeTitle ?? ''} after={section.afterTitle ?? ''} />
          ) : (
            title
          )}
        </div>
        <SectionKindBadge kind={section.kind} />
      </div>
      {reordered ? (
        <div className="mt-1 text-[11px] text-c-text-secondary">
          {t('documentStudio.diff.sectionMoved', {
            defaultValue: 'Position {{from}} → {{to}}',
            from: (section.beforeOrderIndex ?? 0) + 1,
            to: (section.afterOrderIndex ?? 0) + 1,
          })}
        </div>
      ) : null}
      {changedBlocks.length > 0 ? (
        <div className="mt-1 text-c-text-secondary">
          {t('documentStudio.panel.diffChangedBlocks', {
            defaultValue: '{{count}} changed blocks',
            count: changedBlocks.length,
          })}
        </div>
      ) : null}
      {changedBlocks.length > 0 ? (
        <div className="mt-2 space-y-2">
          {changedBlocks.map((block) => (
            <BlockDiffRow key={block.blockId} block={block} />
          ))}
        </div>
      ) : null}
    </li>
  );
}

export interface DocumentSchemaDiffViewProps {
  diff: DocumentSchemaDiff;
}

/** Read-only block-level visual diff for a `DocumentSchemaDiff`. */
export function DocumentSchemaDiffView({ diff }: DocumentSchemaDiffViewProps): React.ReactElement {
  const { t } = useTranslation();
  const changedSections = diff.sectionDiffs.filter((section) => section.kind !== 'unchanged');

  if (!diff.hasChanges || changedSections.length === 0) {
    return (
      <div className="rounded-lg border border-success-500/30 bg-success-500/10 p-3 text-xs text-success-700 dark:text-emerald-300">
        {t('documentStudio.diff.noChanges', 'No changes to display.')}
      </div>
    );
  }

  return (
    <div data-testid="document-schema-diff-view">
      <div className="mb-2 flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-wide text-c-text-muted">
        <span className="flex items-center gap-1">
          <span className={`px-1 ${ADDED_SEGMENT_CLASS}`} aria-hidden="true">
            abc
          </span>
          {t('documentStudio.diff.legendAdded', 'added')}
        </span>
        <span className="flex items-center gap-1">
          <span className={`px-1 ${REMOVED_SEGMENT_CLASS}`} aria-hidden="true">
            abc
          </span>
          {t('documentStudio.diff.legendRemoved', 'removed')}
        </span>
      </div>
      <ul className="space-y-2">
        {changedSections.map((section) => (
          <SectionDiffCard key={section.sectionId} section={section} />
        ))}
      </ul>
    </div>
  );
}

export default DocumentSchemaDiffView;
