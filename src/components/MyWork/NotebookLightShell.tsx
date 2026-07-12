/**
 * NotebookLightShell — lightweight, dense redesign of the Notebook module
 * surface (companion to `FinanceLightShell` / `DRDLightShell` — same
 * doctrine, same shell shape). NEW component; `NotebookContent.tsx` and
 * `NotebookLibraryContent.tsx` are untouched. Gated OFF by default behind
 * `notebookLightFlag.ts` (`?ff_notebookLight=1`) — real wiring into the
 * Notebook module happens in a later step, only after Piotr signs off on the
 * harness screenshot (CLAUDE.md rule #7: no flag-flip as a first look).
 *
 * WHY THIS SHAPE (audit of NotebookContent.tsx, owner notes #14/#14a):
 *   The current per-note page stacks: cover image bar → icon+title → tags row
 *   → verification <select> → review-cadence <select> → stale/reviewed badge
 *   → "Mark reviewed" button → divider → NotebookProgressChip (Sources/AI/
 *   Review/Convert/Initiatives, 5 separate entry points) → Mini outline card
 *   → AI-proposals card → editor. That is the "wielka karta pół-pusta" /
 *   "płaski wysyp" anti-pattern from DOKTRYNA_GESTOSCI.md §0/§2 — half those
 *   rows are metadata, not content, and every one of them competes for the
 *   same vertical rhythm as the actual note text.
 *
 * Composition mirrors FinanceLightShell / DRDLightShell:
 *   1. ONE compact header strip: breadcrumb · note title · saved-time text ·
 *      verification pill · "Zapytaj Teresę" (secondary, optional) · kebab
 *      "…" — the single home for Convert / Rozwiń w dokument / Historia
 *      wersji / Usuń (DOKTRYNA_GESTOSCI §1: one action, one home; the kebab
 *      only renders items that have a real handler, exactly like the real
 *      `NotebookHamburgerMenu`). No selects, no divider stack, no 5-icon row.
 *   2. Left rail: "Notatnik" library — lens chips (Wszystkie/Przypięte/Do
 *      przejrzenia) + a dense note list (icon/dot · title · updated), "+"
 *      to start a new note. This is Level-1 (NotebookLibraryContent) folded
 *      into the same rail as Level-2, instead of a separate screen.
 *   3. Center: the note itself, read densely — title/tags meta in one row,
 *      then real content blocks (heading/paragraph/bullet), zero decorative
 *      empty panels. AI-proposal count (if any) is a single thin banner, not
 *      a fixed-height card.
 *   4. Right rail: "Mini outline" (click → scroll, same UX as the current
 *      good pattern) + "Źródła" (capture/upload provenance) + "Konwersja"
 *      (read-only badges of what this note already became — the action
 *      itself lives ONLY in the kebab, never duplicated here).
 *
 * COLOR DOCTRINE (hard, identical to FinanceLightShell/DRDLightShell):
 *   - `c-accent` (Harvard Crimson) is reserved for critical semantics only —
 *     NOT used here. Active rail item / links = the blue focus token
 *     (`--c-focus-solid`). Verified = `c-success`, disputed = `c-warning`,
 *     destructive kebab item = `c-danger`. Primary CTA is neutral
 *     (`bg-c-text text-c-surface`).
 *   - All colors via c-* tokens (Tailwind classes or `var(--c-*)` /
 *     `rgb(var(--c-*-rgb) / a)`), never raw hex — both themes adapt.
 *
 * This component is presentational only (props in, JSX out) — no store, no
 * API calls, no context. Mock data for the dev-render harness lives in
 * `dev-render/screens/notebook-light.tsx`, not here (same split as
 * `finance-light.tsx` vs `FinanceLightShell.tsx`).
 */
import {
  AlertTriangle,
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  FolderOpen,
  Layers,
  MessageSquare,
  MinusCircle,
  MoreHorizontal,
  Network,
  Pin,
  Plus,
  Trash2,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

// ---------------------------------------------------------------------------
// Types — lightweight mirrors of the real Notebook data shapes
// (NotebookContent.tsx / notebookConvertedOutputSummary.ts). Kept local to
// the frontend bundle, presentational-only.
// ---------------------------------------------------------------------------

export type NotebookLightMaturity = 'seed' | 'growing' | 'mature';
export type NotebookLightVerification = 'unverified' | 'verified' | 'disputed';

export interface NotebookLightSourceLite {
  label: string;
  detail: string;
}

export type NotebookLightBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'bullet'; items: string[] };

export interface NotebookLightConvertedLite {
  type: string;
}

export interface NotebookLightNoteLite {
  id: string;
  title: string;
  maturity: NotebookLightMaturity;
  verification: NotebookLightVerification;
  pinned?: boolean;
  tags: string[];
  updatedLabel: string;
  summary?: string;
  blocks: NotebookLightBlock[];
  sources: NotebookLightSourceLite[];
  convertedTo: NotebookLightConvertedLite[];
  backlinksCount?: number;
  pendingAIProposals?: number;
}

interface NotebookLightShellProps {
  notebookName?: string;
  notes?: NotebookLightNoteLite[];
  initialActiveNoteId?: string;
  onSelectNote?: (noteId: string) => void;
  onNewNote?: () => void;
  onAskAI?: (noteId: string) => void;
  onConvert?: (noteId: string, target: string) => void;
  onExpandDocument?: (noteId: string) => void;
  onVersionHistory?: (noteId: string) => void;
  onDeleteNote?: (noteId: string) => void;
}

type LightLens = 'all' | 'pinned' | 'toReview';

const BLUE = 'rgb(var(--c-focus-solid-rgb))';
const BLUE_SOFT = 'rgb(var(--c-focus-solid-rgb) / 0.10)';

const MATURITY_DOT: Record<NotebookLightMaturity, string> = {
  seed: 'bg-c-text-muted',
  growing: 'bg-c-warning',
  mature: 'bg-c-success',
};

const VERIFICATION_META: Record<
  NotebookLightVerification,
  { icon: React.ReactNode; colorClass: string; labelPl: string; labelEn: string }
> = {
  unverified: {
    icon: <MinusCircle className="h-3 w-3" />,
    colorClass: 'text-c-text-muted',
    labelPl: 'Nieweryfikowana',
    labelEn: 'Unverified',
  },
  verified: {
    icon: <CheckCircle2 className="h-3 w-3" />,
    colorClass: 'text-c-success',
    labelPl: 'Zweryfikowana',
    labelEn: 'Verified',
  },
  disputed: {
    icon: <AlertTriangle className="h-3 w-3" />,
    colorClass: 'text-c-warning',
    labelPl: 'Zakwestionowana',
    labelEn: 'Disputed',
  },
};

function headingSlug(noteId: string, index: number): string {
  return `nb-light-heading-${noteId}-${index}`;
}

export const NotebookLightShell: React.FC<NotebookLightShellProps> = ({
  notebookName,
  notes = [],
  initialActiveNoteId,
  onSelectNote,
  onNewNote,
  onAskAI,
  onConvert,
  onExpandDocument,
  onVersionHistory,
  onDeleteNote,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const t = (pl: string, en: string) => (isPolish ? pl : en);

  const [activeNoteId, setActiveNoteId] = useState<string | undefined>(
    initialActiveNoteId || notes[0]?.id
  );
  const [lens, setLens] = useState<LightLens>('all');
  const [kebabOpen, setKebabOpen] = useState(false);

  const activeNote = useMemo(
    () => notes.find((n) => n.id === activeNoteId) || notes[0],
    [notes, activeNoteId]
  );

  const filteredNotes = useMemo(() => {
    if (lens === 'pinned') return notes.filter((n) => n.pinned);
    if (lens === 'toReview') return notes.filter((n) => n.verification !== 'verified');
    return notes;
  }, [notes, lens]);

  const headingOutline = useMemo(
    () =>
      (activeNote?.blocks || [])
        .map((b, idx) => (b.type === 'heading' ? { ...b, idx } : null))
        .filter((b): b is { type: 'heading'; level: 1 | 2 | 3; text: string; idx: number } => !!b),
    [activeNote]
  );

  const LENS_LABEL: Record<LightLens, string> = {
    all: t('Wszystkie', 'All'),
    pinned: t('Przypięte', 'Pinned'),
    toReview: t('Do przejrzenia', 'To review'),
  };

  const selectNote = (id: string) => {
    setActiveNoteId(id);
    setKebabOpen(false);
    onSelectNote?.(id);
  };

  const vMeta = activeNote ? VERIFICATION_META[activeNote.verification] : null;

  return (
    <div className="flex h-full flex-col bg-c-bg text-c-text">
      {/* ─── Compact header strip (title · saved · kebab = home for actions) ─── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-c-border bg-c-surface px-5 py-3">
        <span className="text-[12px] text-c-text-muted">
          {t('Notatnik', 'Notebook')} <span className="mx-1 text-c-text-secondary">›</span>{' '}
          {notebookName || t('Notatki DBR77', 'DBR77 Notes')}
        </span>
        <h1 className="m-0 min-w-0 truncate text-[15px] font-semibold tracking-tight text-c-text">
          {activeNote?.title || t('Bez tytułu', 'Untitled')}
        </h1>
        {vMeta && (
          <span
            className={`inline-flex items-center gap-1 rounded-full border border-c-border bg-c-surface-raised px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${vMeta.colorClass}`}
          >
            {vMeta.icon}
            {isPolish ? vMeta.labelPl : vMeta.labelEn}
          </span>
        )}
        <span className="text-[12px] text-c-text-muted">
          {t('zapisano', 'saved')} {activeNote?.updatedLabel || t('przed chwilą', 'just now')}
        </span>

        <span className="flex-1" />

        {onAskAI && activeNote && (
          <button
            type="button"
            onClick={() => onAskAI(activeNote.id)}
            className="inline-flex items-center gap-2 rounded-lg border border-transparent px-3 py-1.5 text-[13px] font-medium text-c-text-secondary transition-colors hover:bg-c-surface-raised"
          >
            <MessageSquare className="h-4 w-4" />
            {t('Zapytaj Teresę', 'Ask Teresa')}
          </button>
        )}

        {/* ⋯ kebab — single home for Convert / Expand / History / Delete */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setKebabOpen((v) => !v)}
            title={t('Menu notatki', 'Note menu')}
            aria-label={t('Menu notatki', 'Note menu')}
            className={`inline-flex items-center justify-center rounded-lg p-1.5 transition-colors ${
              kebabOpen ? 'bg-c-surface-raised text-c-text' : 'text-c-text-muted hover:bg-c-surface-raised'
            }`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {kebabOpen && activeNote && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setKebabOpen(false)} />
              <div className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-xl border border-c-border bg-c-surface py-1 shadow-lg">
                {onConvert && (
                  <button
                    type="button"
                    onClick={() => {
                      onConvert(activeNote.id, 'report');
                      setKebabOpen(false);
                    }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] text-c-text transition-colors hover:bg-c-surface-raised"
                  >
                    <FileText className="h-3.5 w-3.5 text-c-text-muted" />
                    {t('Konwertuj na…', 'Convert to…')}
                  </button>
                )}
                {onExpandDocument && (
                  <button
                    type="button"
                    onClick={() => {
                      onExpandDocument(activeNote.id);
                      setKebabOpen(false);
                    }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] text-c-text transition-colors hover:bg-c-surface-raised"
                  >
                    <BookOpen className="h-3.5 w-3.5 text-c-text-muted" />
                    {t('Rozwiń w dokument', 'Expand into document')}
                  </button>
                )}
                {onVersionHistory && (
                  <button
                    type="button"
                    onClick={() => {
                      onVersionHistory(activeNote.id);
                      setKebabOpen(false);
                    }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] text-c-text transition-colors hover:bg-c-surface-raised"
                  >
                    <Clock className="h-3.5 w-3.5 text-c-text-muted" />
                    {t('Historia wersji', 'Version history')}
                  </button>
                )}
                {onDeleteNote && (
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteNote(activeNote.id);
                      setKebabOpen(false);
                    }}
                    className="flex w-full items-center gap-2.5 border-t border-c-border px-3.5 py-2 text-left text-[13px] text-c-danger transition-colors hover:bg-c-danger/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t('Usuń notatkę', 'Delete note')}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ─── 3-column work area ─── */}
      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[236px_1fr] lg:grid-cols-[236px_1fr_296px]">
        {/* LIBRARY RAIL */}
        <nav className="hidden overflow-y-auto border-r border-c-border bg-c-surface px-3 py-4 md:block">
          <div className="mb-2.5 flex items-center justify-between px-1.5">
            <p className="m-0 text-[10.5px] font-semibold uppercase tracking-[0.13em] text-c-text-muted">
              {t('Notatki', 'Notes')} · {notes.length}
            </p>
            {onNewNote && (
              <button
                type="button"
                onClick={onNewNote}
                title={t('Nowa notatka', 'New note')}
                aria-label={t('Nowa notatka', 'New note')}
                className="rounded-md p-1 text-c-text-muted transition-colors hover:bg-c-surface-raised hover:text-c-text"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="mb-3 flex flex-wrap gap-1.5 px-1">
            {(['all', 'pinned', 'toReview'] as LightLens[]).map((l) => {
              const on = l === lens;
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLens(l)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    on
                      ? 'border-transparent text-c-surface'
                      : 'border-c-border bg-c-surface-raised text-c-text-secondary hover:border-c-border-strong'
                  }`}
                  style={on ? { backgroundColor: BLUE } : undefined}
                >
                  {LENS_LABEL[l]}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-0.5">
            {filteredNotes.map((note) => {
              const on = note.id === activeNote?.id;
              return (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => selectNote(note.id)}
                  className={`relative flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                    on ? '' : 'hover:bg-c-surface-raised'
                  }`}
                  style={on ? { backgroundColor: BLUE_SOFT } : undefined}
                >
                  <span className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${MATURITY_DOT[note.maturity]}`} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1">
                      {note.pinned && <Pin className="h-2.5 w-2.5 flex-shrink-0 text-c-warning" />}
                      <span
                        className={`block truncate text-[13px] leading-tight tracking-tight ${
                          on ? 'font-semibold' : 'text-c-text'
                        }`}
                        style={on ? { color: BLUE } : undefined}
                      >
                        {note.title}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-c-text-muted tabular-nums">
                      {note.updatedLabel}
                    </span>
                  </span>
                </button>
              );
            })}
            {filteredNotes.length === 0 && (
              <div className="px-2.5 py-6 text-center text-[12px] text-c-text-muted">
                {t('Brak notatek w tym widoku.', 'No notes in this view.')}
              </div>
            )}
          </div>
        </nav>

        {/* CENTER — note content, densely */}
        <main className="min-w-0 overflow-y-auto px-6 py-5">
          {!activeNote ? (
            <div className="flex h-full items-center justify-center text-[13px] text-c-text-muted">
              {t('Wybierz notatkę z listy.', 'Select a note from the list.')}
            </div>
          ) : (
            <div className="mx-auto max-w-[720px]">
              {/* meta row — one line, not a stack of selects */}
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {activeNote.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-c-surface-raised px-2 py-0.5 text-[11px] font-medium text-c-text-muted"
                  >
                    {tag}
                  </span>
                ))}
                {activeNote.summary && (
                  <span className="text-[12.5px] text-c-text-secondary">{activeNote.summary}</span>
                )}
              </div>

              {typeof activeNote.pendingAIProposals === 'number' && activeNote.pendingAIProposals > 0 && (
                <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-c-border bg-c-surface-raised px-3.5 py-2.5 text-[12.5px]">
                  <Bot className="h-3.5 w-3.5 flex-shrink-0" style={{ color: BLUE }} />
                  <span className="text-c-text-secondary">
                    {activeNote.pendingAIProposals}{' '}
                    {t('propozycje AI czekają na review', 'AI proposals waiting for review')}
                  </span>
                </div>
              )}

              {/* content blocks — real note reading surface */}
              <div className="flex flex-col gap-3">
                {activeNote.blocks.map((block, idx) => {
                  if (block.type === 'heading') {
                    const Tag = (`h${block.level + 1}`) as 'h2' | 'h3' | 'h4';
                    const sizeClass =
                      block.level === 1
                        ? 'text-[19px] mt-3'
                        : block.level === 2
                          ? 'text-[16px] mt-2'
                          : 'text-[14px] mt-1.5';
                    return (
                      <Tag
                        key={idx}
                        id={headingSlug(activeNote.id, idx)}
                        className={`m-0 font-semibold tracking-tight text-c-text ${sizeClass}`}
                      >
                        {block.text}
                      </Tag>
                    );
                  }
                  if (block.type === 'bullet') {
                    return (
                      <ul key={idx} className="m-0 list-disc space-y-1 pl-5 text-[13.5px] leading-relaxed text-c-text-secondary">
                        {block.items.map((item, i2) => (
                          <li key={i2}>{item}</li>
                        ))}
                      </ul>
                    );
                  }
                  return (
                    <p key={idx} className="m-0 text-[13.5px] leading-relaxed text-c-text-secondary">
                      {block.text}
                    </p>
                  );
                })}
              </div>

              {typeof activeNote.backlinksCount === 'number' && activeNote.backlinksCount > 0 && (
                <div className="mt-6 flex items-center gap-1.5 border-t border-c-border pt-3 text-[11.5px] text-c-text-muted">
                  <Network className="h-3.5 w-3.5" />
                  {t('Wspomniana w', 'Mentioned in')} {activeNote.backlinksCount}{' '}
                  {t('innych notatkach', 'other notes')}
                </div>
              )}
            </div>
          )}
        </main>

        {/* ASIDE */}
        {activeNote && (
          <aside className="hidden overflow-y-auto border-l border-c-border bg-c-surface px-4 py-4 lg:block">
            <p className="mx-0.5 mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.13em] text-c-text-muted">
              {t('Wsparcie', 'Support')}
            </p>

            {/* Mini outline */}
            {headingOutline.length > 0 && (
              <div className="mb-3 overflow-hidden rounded-xl border border-c-border">
                <div className="flex items-center gap-2 px-3.5 py-3 text-[12.5px] font-semibold text-c-text">
                  <Layers className="h-[15px] w-[15px] text-c-text-muted" />
                  {t('Konspekt', 'Mini outline')}
                </div>
                <div className="flex flex-wrap gap-1.5 px-3.5 pb-3.5">
                  {headingOutline.map((h) => (
                    <button
                      key={h.idx}
                      type="button"
                      onClick={() => {
                        document
                          .getElementById(headingSlug(activeNote.id, h.idx))
                          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      className="rounded-full bg-c-surface-raised px-2.5 py-1 text-[11px] font-medium text-c-text-secondary transition-colors hover:bg-c-border-subtle"
                    >
                      {`H${h.level} ${h.text}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Źródła */}
            <div className="mb-3 overflow-hidden rounded-xl border border-c-border">
              <div className="flex items-center gap-2 px-3.5 py-3 text-[12.5px] font-semibold text-c-text">
                <FolderOpen className="h-[15px] w-[15px] text-c-text-muted" />
                {t('Źródła', 'Sources')}
                <span
                  className="ml-auto rounded-full px-1.5 py-px text-[10.5px] font-semibold"
                  style={{ backgroundColor: BLUE_SOFT, color: BLUE }}
                >
                  {activeNote.sources.length}
                </span>
              </div>
              <div className="flex flex-col gap-2.5 px-3.5 pb-3.5">
                {activeNote.sources.length === 0 && (
                  <p className="m-0 text-[12.5px] leading-snug text-c-text-muted">
                    {t('Brak podpiętych źródeł.', 'No sources attached.')}
                  </p>
                )}
                {activeNote.sources.map((src) => (
                  <div key={src.label} className="flex items-start gap-2 text-[12.5px] leading-snug">
                    <FileText className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-c-text-muted" />
                    <span>
                      <span className="font-semibold text-c-text">{src.label}</span>{' '}
                      <span className="text-c-text-secondary">{src.detail}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Konwersja — read-only badges; the action lives only in the kebab */}
            <div className="mb-3 overflow-hidden rounded-xl border border-c-border">
              <div className="flex items-center gap-2 px-3.5 py-3 text-[12.5px] font-semibold text-c-text">
                <ChevronRight className="h-[15px] w-[15px] text-c-text-muted" />
                {t('Konwersja', 'Conversion')}
              </div>
              <div className="flex flex-wrap gap-1.5 px-3.5 pb-3.5">
                {activeNote.convertedTo.length === 0 && (
                  <p className="m-0 text-[12.5px] leading-snug text-c-text-muted">
                    {t('Jeszcze nie skonwertowana.', 'Not converted yet.')}
                  </p>
                )}
                {activeNote.convertedTo.map((c, idx) => (
                  <span
                    key={`${c.type}-${idx}`}
                    className="rounded-md bg-c-success/10 px-1.5 py-0.5 text-[11px] font-medium text-c-success"
                  >
                    ✓ {c.type}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-2.5 border-t border-c-border pt-2.5 text-[11.5px] text-c-text-muted">
              {t(
                'AI proponuje bloki do notatki — Ty akceptujesz lub odrzucasz każdy wpis, treść nigdy nie zmienia się bez Twojej zgody.',
                'AI proposes blocks for the note — you accept or reject each one; content never changes without your say.'
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

export default NotebookLightShell;
