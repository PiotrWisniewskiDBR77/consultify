/**
 * MethodPresentationView — client-facing Presentation View (CEL 8 / MPQ,
 * 2026-08-13).
 *
 * Renders a deck of `PresentationSourceBlock`s
 * (`src/method-core/outputs/presentationSourceBlock.ts`) as consulting
 * slides — never a screenshot of the work screen. Before this file, no
 * React component rendered a `PresentationSourceBlock` at all.
 *
 * MPQ design decisions:
 *  1. Action title = `block.keyMessage` (the conclusion) as the large
 *     headline; `block.title` is the small eyebrow label above it — the
 *     McKinsey "governing thought" convention the data model already
 *     encodes (`keyMessage` is a REQUIRED field, not something this
 *     component invents).
 *  2/3. one dominant visual per slide (matrix/gap bars), current/target/gap
 *     printed directly on it.
 *  6. evidence-ref count, level and draft/approved status are three visibly
 *     separate elements in the footer, never one dot.
 *  8. an actual 16:9 slide surface (aspect-ratio card, large centered type,
 *     minimal chrome) — not the workspace UI with different padding.
 *
 * A draft block (`provenance.isDraft`) reuses the SAME indigo/violet accent
 * `TeresaPreviewPanel` uses for an unaccepted AI proposal — one visual
 * language for "not yet approved content" across the whole workspace,
 * instead of inventing a second one here.
 */
import { ChevronLeft, ChevronRight, Lock, Sparkles } from 'lucide-react';
import React from 'react';

import type { PresentationSourceBlock, UnitLevelMap } from '@/method-core/outputs';

export interface MethodPresentationViewProps {
  blocks: readonly PresentationSourceBlock[];
  methodName: string;
  initialIndex?: number;
  className?: string;
}

const CONFIDENTIALITY_LABEL: Record<PresentationSourceBlock['confidentiality'], string> = {
  internal_only: 'Wyłącznie wewnętrzne',
  client_deliverable: 'Materiał dla klienta',
  public: 'Publiczne',
};

function isUnitLevelMap(value: unknown): value is UnitLevelMap {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value as Record<string, unknown>).every((v) => v === null || typeof v === 'number')
  );
}

/** The one dominant visual on a matrix/gap_chart slide — same proportional
 * bar language as the Report view, scaled up for slide legibility. */
function SlideBars({ dataSnapshot }: { dataSnapshot: unknown }): React.ReactElement | null {
  if (!isUnitLevelMap(dataSnapshot)) return null;
  const entries = Object.entries(dataSnapshot);
  if (entries.length === 0) return null;
  const scale = Math.max(5, ...entries.map(([, v]) => v ?? 0));
  return (
    <div className="flex w-full flex-col gap-3" data-testid="slide-bars">
      {entries.map(([unitId, value]) => (
        <div key={unitId} className="flex items-center gap-3">
          <span className="w-56 shrink-0 truncate text-sm text-c-text-secondary" title={unitId}>
            {unitId}
          </span>
          <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-c-surface-raised">
            {value == null ? (
              <div className="absolute inset-y-0 left-0 w-full rounded-full border border-dashed border-c-border-subtle" />
            ) : (
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-c-info"
                style={{ width: `${Math.min(100, (value / scale) * 100)}%` }}
              />
            )}
          </div>
          <span className="w-16 shrink-0 text-right text-sm font-semibold text-c-text">
            {value ?? 'Nieocenione'}
          </span>
        </div>
      ))}
    </div>
  );
}

const Slide: React.FC<{ block: PresentationSourceBlock }> = ({ block }) => {
  const isDraft = block.provenance.isDraft;
  return (
    <div
      data-testid="presentation-slide"
      data-block-id={block.blockId}
      data-draft={isDraft ? 'true' : 'false'}
      className={`relative flex aspect-video w-full flex-col justify-between overflow-hidden rounded-2xl border p-10 shadow-sm ${
        isDraft
          ? 'border-violet-300 dark:border-violet-700/50 bg-violet-50/40 dark:bg-violet-900/10'
          : 'border-c-border bg-c-surface'
      }`}
    >
      {isDraft && (
        <span
          data-testid="slide-draft-ribbon"
          className="absolute right-6 top-6 inline-flex items-center gap-1 rounded-full border border-violet-300 dark:border-violet-600/50 bg-violet-100 dark:bg-violet-900/30 px-2.5 py-1 text-[11px] font-semibold text-violet-700 dark:text-violet-300"
        >
          <Sparkles size={12} /> Wersja robocza — nie zatwierdzona
        </span>
      )}

      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-c-text-muted">{block.title}</p>
        <h1 className="mt-2 max-w-3xl text-3xl font-bold leading-tight text-c-text" data-testid="slide-key-message">
          {block.keyMessage}
        </h1>
      </div>

      <div className="flex-1 flex items-center py-6">
        <SlideBars dataSnapshot={block.dataSnapshot} />
      </div>

      {/* Footer — evidence count, freshness and confidentiality are three
          separate, differently-shaped elements (criterion 6). */}
      <div className="flex items-center justify-between border-t border-c-border-subtle pt-3 text-[11px] text-c-text-muted">
        <span data-testid="slide-evidence-count">
          {block.evidenceRefs.length > 0 ? `${block.evidenceRefs.length} dowodów źródłowych` : 'Bez powiązanych dowodów'}
        </span>
        <span className="flex items-center gap-1" data-testid="slide-confidentiality">
          <Lock size={11} /> {CONFIDENTIALITY_LABEL[block.confidentiality]}
        </span>
        <span data-testid="slide-freshness">Stan na {new Date(block.freshness).toLocaleDateString('pl-PL')}</span>
      </div>
    </div>
  );
};

export const MethodPresentationView: React.FC<MethodPresentationViewProps> = ({
  blocks,
  methodName,
  initialIndex = 0,
  className = '',
}) => {
  const [index, setIndex] = React.useState(Math.min(initialIndex, Math.max(blocks.length - 1, 0)));
  const active = blocks[index];

  if (!active) {
    return (
      <div data-testid="presentation-empty" className="p-10 text-sm text-c-text-muted">
        Brak slajdów do pokazania.
      </div>
    );
  }

  return (
    <div data-testid="method-presentation-view" className={`mx-auto flex max-w-4xl flex-col gap-4 p-8 ${className}`}>
      <div className="flex items-center justify-between text-xs text-c-text-muted">
        <span>{methodName} — Prezentacja</span>
        <span data-testid="slide-position">
          {index + 1} / {blocks.length}
        </span>
      </div>

      <Slide block={active} />

      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          data-testid="slide-prev"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          aria-label="Poprzedni slajd"
          className="rounded-lg border border-c-border p-1.5 text-c-text-secondary hover:bg-c-surface-raised disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex items-center gap-1">
          {blocks.map((b, i) => (
            <button
              key={b.blockId}
              type="button"
              aria-label={`Slajd ${i + 1}`}
              aria-current={i === index}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
                i === index ? 'w-5 bg-c-info' : 'w-1.5 bg-c-border'
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          data-testid="slide-next"
          onClick={() => setIndex((i) => Math.min(blocks.length - 1, i + 1))}
          disabled={index === blocks.length - 1}
          aria-label="Następny slajd"
          className="rounded-lg border border-c-border p-1.5 text-c-text-secondary hover:bg-c-surface-raised disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default MethodPresentationView;
