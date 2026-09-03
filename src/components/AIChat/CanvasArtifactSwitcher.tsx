/**
 * CanvasArtifactSwitcher — B2 (artifact lifecycle, Claude-Artifacts style)
 *
 * Compact switcher rendered above the canvas split-view content. Lists this
 * conversation's mountable artifacts (chat-generated decks/docs persisted in
 * useArtifactsStore + the conversation's base working document) and swaps the
 * panel content on selection.
 *
 * Honest scope (what is switchable today):
 * - 'deck'  → CanvasPresentationView (deckId = deliverable generationId)
 * - 'doc'   → markdown document panel hydrated by draftId (= generationId)
 * - 'sheet' → same markdown panel (sheets are GFM-table markdown drafts)
 * - 'base'  → the panel's original document mount (props-driven)
 * Renders nothing when fewer than two entries exist, so existing single-artifact
 * flows are visually unchanged.
 */

import { FileText, Presentation, Table } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { useArtifactsStore } from '../../store/useArtifactsStore';

// ============================================================================
// Types
// ============================================================================

/** What the canvas panel currently mounts / should mount. */
export type CanvasMountSelection =
  | { kind: 'base' }
  | { kind: 'deck'; deckId: string | null; artifactId?: string }
  | { kind: 'doc'; draftId: string; artifactId?: string }
  // Sheet = GFM-table markdown draft; mounts the same markdown panel as 'doc'.
  | { kind: 'sheet'; draftId: string; artifactId?: string };

interface SwitcherEntry {
  key: string;
  kind: 'base' | 'deck' | 'doc' | 'sheet';
  title: string;
  selection: CanvasMountSelection;
  artifactId?: string;
}

export interface CanvasArtifactSwitcherProps {
  conversationId?: string | null;
  mounted: CanvasMountSelection;
  /** True when the panel was originally mounted as a (non-presentation) document canvas. */
  hasBaseDocument: boolean;
  /** Draft id of the base document mount (dedupes doc deliverables that ARE the base). */
  baseDraftId?: string | null;
  onSelect: (selection: CanvasMountSelection) => void;
}

// ============================================================================
// Component
// ============================================================================

export const CanvasArtifactSwitcher: React.FC<CanvasArtifactSwitcherProps> = ({
  conversationId,
  mounted,
  hasBaseDocument,
  baseDraftId,
  onSelect,
}) => {
  const { i18n } = useTranslation();
  const pl = (i18n.language || 'en').split('-')[0] === 'pl';

  const conversationArtifacts = useArtifactsStore((state) =>
    conversationId ? state.conversationArtifacts[conversationId] : undefined
  );

  const entries = React.useMemo<SwitcherEntry[]>(() => {
    const result: SwitcherEntry[] = [];

    if (hasBaseDocument) {
      result.push({
        key: 'base',
        kind: 'base',
        title: pl ? 'Dokument roboczy' : 'Working document',
        selection: { kind: 'base' },
      });
    }

    for (const artifact of conversationArtifacts || []) {
      const deliverable = (artifact as any)?.metadata?.deliverable as
        | { kind?: string; generationId?: string; title?: string }
        | undefined;
      if (!deliverable?.generationId) continue;
      const title =
        deliverable.title ||
        (artifact as any).title ||
        (deliverable.kind === 'doc'
          ? pl
            ? 'Dokument'
            : 'Document'
          : deliverable.kind === 'sheet'
            ? pl
              ? 'Arkusz'
              : 'Sheet'
            : pl
              ? 'Prezentacja'
              : 'Presentation');
      if (deliverable.kind === 'doc' || deliverable.kind === 'sheet') {
        // The base mount may already BE this generated doc/sheet draft — skip the duplicate.
        if (hasBaseDocument && baseDraftId && baseDraftId === deliverable.generationId) continue;
        result.push({
          key: `${deliverable.kind}-${deliverable.generationId}`,
          kind: deliverable.kind,
          title,
          artifactId: artifact.id,
          selection: {
            kind: deliverable.kind,
            draftId: deliverable.generationId,
            artifactId: artifact.id,
          },
        });
      } else {
        result.push({
          key: `deck-${deliverable.generationId}`,
          kind: 'deck',
          title,
          artifactId: artifact.id,
          selection: { kind: 'deck', deckId: deliverable.generationId, artifactId: artifact.id },
        });
      }
    }

    // Deck mounted right now but not (yet) registered in the store — e.g. still
    // generating. Keep it visible so the current view is always represented.
    if (
      mounted.kind === 'deck' &&
      mounted.deckId &&
      !result.some((entry) => entry.key === `deck-${mounted.deckId}`)
    ) {
      result.push({
        key: `deck-${mounted.deckId}`,
        kind: 'deck',
        title: pl ? 'Prezentacja' : 'Presentation',
        selection: { kind: 'deck', deckId: mounted.deckId },
      });
    }

    return result;
  }, [conversationArtifacts, hasBaseDocument, baseDraftId, mounted, pl]);

  const isSelected = (entry: SwitcherEntry): boolean => {
    if (entry.selection.kind !== mounted.kind) return false;
    if (entry.selection.kind === 'deck' && mounted.kind === 'deck') {
      return entry.selection.deckId === mounted.deckId;
    }
    if (entry.selection.kind === 'doc' && mounted.kind === 'doc') {
      return entry.selection.draftId === mounted.draftId;
    }
    if (entry.selection.kind === 'sheet' && mounted.kind === 'sheet') {
      return entry.selection.draftId === mounted.draftId;
    }
    return true; // base === base
  };

  const handleSelect = (entry: SwitcherEntry) => {
    if (isSelected(entry)) return;
    onSelect(entry.selection);
    // Persist the per-conversation active artifact (B2 lifecycle).
    if (conversationId) {
      useArtifactsStore.getState().setActiveArtifact(entry.artifactId ?? null, conversationId);
    }
  };

  // Single (or no) mountable artifact — nothing to switch, render nothing.
  if (entries.length < 2) return null;

  const iconFor = (kind: SwitcherEntry['kind']) =>
    kind === 'deck' ? (
      <Presentation size={12} />
    ) : kind === 'sheet' ? (
      <Table size={12} />
    ) : (
      <FileText size={12} />
    );

  return (
    <div className="flex h-9 shrink-0 items-center gap-1 overflow-x-auto border-b border-slate-200/70 bg-white/70 px-2 backdrop-blur dark:border-white/[0.06] dark:bg-navy-950/60">
      {entries.length <= 3 ? (
        entries.map((entry) => {
          const selected = isSelected(entry);
          return (
            <button
              key={entry.key}
              type="button"
              onClick={() => handleSelect(entry)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                selected
                  ? 'bg-c-surface-raised text-c-text-secondary dark:bg-c-surface-raised dark:text-c-text-secondary'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-navy-800 dark:hover:text-slate-200'
              }`}
              title={entry.title}
            >
              {iconFor(entry.kind)}
              <span className="max-w-[140px] truncate">{entry.title}</span>
            </button>
          );
        })
      ) : (
        <select
          value={entries.find((entry) => isSelected(entry))?.key || entries[0].key}
          onChange={(event) => {
            const next = entries.find((entry) => entry.key === event.target.value);
            if (next) handleSelect(next);
          }}
          className="h-7 max-w-[260px] rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-700 dark:border-navy-700 dark:bg-navy-900 dark:text-slate-200"
          aria-label={pl ? 'Przełącz artefakt' : 'Switch artifact'}
        >
          {entries.map((entry) => (
            <option key={entry.key} value={entry.key}>
              {(entry.kind === 'deck' ? '🖥 ' : entry.kind === 'sheet' ? '📊 ' : '📄 ') +
                entry.title}
            </option>
          ))}
        </select>
      )}
    </div>
  );
};

export default CanvasArtifactSwitcher;
