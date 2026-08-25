/**
 * NotebookInlineAIMenu — J26 (two-channel doctrine, channel 2).
 *
 * Floating "select → rewrite" AI menu for the Living Notebook TipTap editor.
 * Mirrors the reference implementation `DocumentStudio/inline-ai/DocumentInlineAIMenu`
 * (Word): the user highlights a fragment, picks a quick action (Shorten / Expand /
 * Improve / Formal tone / Explain), Teresa rewrites it, and an explicit Approve
 * REPLACES the fragment in-place (via `proposalType: 'replace'`) — never appends.
 *
 * Flow (Propose → Preview → Accept, per MyWorkHub SSOT rule):
 *   1. action    → Api.chatWithAIStream rewrites the selected fragment
 *   2. proposal  → Api.notebookCreateAIProposal({ proposalType: 'replace', … })
 *                  carrying `_replaceRange` + `_replaceBlocks` targeting metadata
 *   3. approve   → Api.notebookResolveAIProposal(id, 'accepted') → reload page
 *   4. reject    → Api.notebookResolveAIProposal(id, 'rejected')
 *
 * Positioned BELOW the selection so it never overlaps the format bubble
 * (NotebookBubbleToolbar, which anchors above).
 */

import type { Editor } from '@tiptap/react';
import { Check, ChevronDown, Loader2, Sparkles, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { INLINE_ACTIONS } from '@/components/DocumentStudio/inline-ai/inlineActionPrompts';
import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

import { NOTEBOOK_INLINE_AI_ACTION_IDS } from './notebookActionRegistry';

const MENU_WIDTH = 420;
const MARGIN = 8;
const SELECTION_GAP = 12; // offset below caret so we clear the format bubble

type Status = 'idle' | 'loading' | 'done' | 'error';

interface MenuPosition {
  top: number;
  left: number;
}

interface PendingReplace {
  proposalId: string;
  originalText: string;
  revisedText: string;
  actionLabel: string;
  createdAt: Date;
}

export interface NotebookInlineAIMenuProps {
  editor: Editor | null;
  pageId: string | null;
  /** Called after an approved proposal has been applied so the host can reload. */
  onApplied: () => void;
  /** Undefined preserves legacy integrators; the production Notebook passes an explicit capability set. */
  receiptCapableActionIds?: string[];
}

/** Split rewritten text into paragraph blocks (TipTap doc nodes). */
function textToParagraphBlocks(text: string): Array<Record<string, unknown>> {
  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const blocks = (paragraphs.length > 0 ? paragraphs : [text.trim()]).map((p) => ({
    type: 'paragraph',
    content: [{ type: 'text', text: p }],
  }));
  return blocks;
}

export const NotebookInlineAIMenu: React.FC<NotebookInlineAIMenuProps> = ({
  editor,
  pageId,
  onApplied,
  receiptCapableActionIds,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = (i18n.language || 'pl').startsWith('pl');
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const [showActions, setShowActions] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<'generate' | 'approve' | 'reject' | null>(null);
  const pendingRef = useRef<PendingReplace | null>(null);
  const lastActionIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const resolutionInFlightRef = useRef(false);
  const isReceiptCapable = (actionId: string) =>
    receiptCapableActionIds === undefined || receiptCapableActionIds.includes(actionId);

  // Track selection → position the trigger just below it.
  useEffect(() => {
    if (!editor) return;

    const update = () => {
      // Keep the menu open while a proposal is loading / awaiting approval.
      if (pendingRef.current || status === 'loading') return;
      const { selection } = editor.state;
      if (selection.empty || selection.content().size === 0) {
        setPosition(null);
        setShowActions(false);
        return;
      }
      try {
        const coords = editor.view.coordsAtPos(selection.from);
        const vw = window.innerWidth;
        const idealTop = coords.bottom + SELECTION_GAP;
        const top = Math.max(MARGIN, Math.min(idealTop, window.innerHeight - 60 - MARGIN));
        const left = Math.max(MARGIN, Math.min(coords.left, vw - MENU_WIDTH - MARGIN));
        setPosition({ top, left });
      } catch {
        setPosition(null);
      }
    };

    editor.on('selectionUpdate', update);
    return () => {
      editor.off('selectionUpdate', update);
    };
  }, [editor, status]);

  const reset = () => {
    pendingRef.current = null;
    setStatus('idle');
    setErrorMsg(null);
    setErrorAction(null);
    setShowActions(false);
    setPosition(null);
  };

  const handleAction = async (actionId: string) => {
    if (!isReceiptCapable(actionId)) return;
    if (!editor || !pageId) return;
    const action = INLINE_ACTIONS.find((a) => a.id === actionId);
    if (!action) return;

    const { state } = editor;
    const { $from, $to, from, to } = state.selection;
    const selectedText = state.doc.textBetween(from, to, '\n\n').trim();
    if (!selectedText) return;
    lastActionIdRef.current = actionId;

    // Resolve top-level block index range + the full text of that range so the
    // model can preserve unselected content while rewriting the fragment.
    let fromIdx = 0;
    let toIdx = 0;
    let contextText = selectedText;
    try {
      fromIdx = $from.index(0);
      toIdx = $to.index(0);
      const rangeStart = $from.before(1);
      const rangeEnd = $to.after(1);
      contextText = state.doc.textBetween(rangeStart, rangeEnd, '\n\n').trim() || selectedText;
    } catch {
      /* fall back to selectedText / index 0 */
    }

    setShowActions(false);
    setStatus('loading');
    setErrorMsg(null);
    abortRef.current = new AbortController();

    const systemPrompt = isPolish
      ? [
          'Jesteś redaktorem tekstu. Otrzymujesz FRAGMENT bieżącej treści notatki oraz zaznaczony wycinek do zmiany.',
          'Zastosuj polecenie WYŁĄCZNIE do zaznaczonego wycinka, ale zwróć CAŁY poprawiony fragment (zachowaj niezaznaczone części bez zmian).',
          'Zwróć tylko sam poprawiony tekst — bez komentarzy, bez cudzysłowów, bez nagłówków.',
        ].join(' ')
      : [
          'You are a text editor. You receive a FRAGMENT of the current note content and a highlighted excerpt to change.',
          'Apply the instruction ONLY to the highlighted excerpt, but return the WHOLE revised fragment (keep unselected parts unchanged).',
          'Return only the revised text — no commentary, no quotes, no headings.',
        ].join(' ');

    const userMessage = isPolish
      ? `Polecenie: ${action.instruction}\n\nBieżący fragment:\n${contextText}\n\nZaznaczony wycinek do zmiany:\n${selectedText}`
      : `Instruction: ${action.instruction}\n\nCurrent fragment:\n${contextText}\n\nHighlighted excerpt to change:\n${selectedText}`;

    let result = '';
    try {
      await Api.chatWithAIStream(
        userMessage,
        [],
        (chunk) => {
          result += chunk;
        },
        () => {
          void (async () => {
            const revised = result.trim();
            if (!revised) {
              setStatus('error');
              setErrorAction('generate');
              setErrorMsg(
                t('myWorkNotebook.inlineAi.empty', 'AI nie zwróciło treści. Spróbuj ponownie.')
              );
              return;
            }
            try {
              const blocks = textToParagraphBlocks(revised);
              const firstText =
                (blocks[0]?.content as Array<{ text?: string }> | undefined)?.[0]?.text || revised;
              const proposal = await Api.notebookCreateAIProposal(pageId, {
                proposalType: 'replace',
                rationale: action.instruction.slice(0, 500),
                blockContent: {
                  // Fallback block (used if targeting metadata is stripped).
                  type: 'paragraph',
                  content: [{ type: 'text', text: firstText }],
                  // J26 targeting metadata (server strips these before persisting).
                  _replaceRange: { from: fromIdx, to: toIdx },
                  _replaceBlocks: blocks,
                } as Record<string, unknown>,
              });
              const proposalId =
                (proposal as { id?: string; data?: { id?: string } })?.id ??
                (proposal as { data?: { id?: string } })?.data?.id ??
                null;
              if (!proposalId) {
                throw new Error('missing proposal id');
              }
              pendingRef.current = {
                proposalId,
                originalText: contextText,
                revisedText: revised,
                actionLabel: isPolish ? action.labelPl : action.labelEn,
                createdAt: new Date(),
              };
              trackFunnelEvent('notebook_inline_ai_rewrite_proposed', {
                actionId,
                selectionLength: selectedText.length,
              });
              setStatus('done');
            } catch {
              setStatus('error');
              setErrorAction('generate');
              setErrorMsg(
                t('myWorkNotebook.inlineAi.proposalFailed', 'Nie udało się utworzyć propozycji AI.')
              );
            }
          })();
        },
        systemPrompt,
        undefined,
        undefined,
        isPolish ? 'pl' : 'en',
        undefined,
        { responseStyle: 'concise', selectedTier: 'STANDARD' },
        abortRef.current.signal
      );
    } catch (err) {
      if ((err as { name?: string })?.name !== 'AbortError') {
        setStatus('error');
        setErrorAction('generate');
        setErrorMsg(t('myWorkNotebook.inlineAi.executeFailed', 'Błąd AI. Spróbuj ponownie.'));
      }
    }
  };

  const handleApprove = async () => {
    if (!isReceiptCapable('approve')) return;
    const pending = pendingRef.current;
    if (!pending || resolutionInFlightRef.current) return;
    resolutionInFlightRef.current = true;
    setStatus('loading');
    try {
      await Api.notebookResolveAIProposal(pending.proposalId, 'accepted');
      trackFunnelEvent('notebook_inline_ai_rewrite_accepted', {});
      onApplied();
    } catch {
      setStatus('error');
      setErrorAction('approve');
      setErrorMsg(t('myWorkNotebook.inlineAi.approveFailed', 'Nie udało się zatwierdzić.'));
      resolutionInFlightRef.current = false;
      return;
    }
    resolutionInFlightRef.current = false;
    reset();
  };

  // TRI-OBS-17 (2026-08-25, R10 traceability): the buttons below already
  // stamp `data-notebook-action-id="inline-ai:<id>"` from this exact list
  // (`NOTEBOOK_INLINE_AI_ACTION_IDS`, `notebookActionRegistry.ts`) — this
  // wrapper is the real traceable entry point `scripts/check-action-coverage.sh`
  // looks for (`runAction(id, run)`, same wiring convention as
  // `WhiteboardToolbar.tsx`/`ProcessFlowToolbar.tsx`'s `runAction`), and it
  // genuinely validates against that registry instead of trusting the caller.
  const runAction = (id: (typeof NOTEBOOK_INLINE_AI_ACTION_IDS)[number], run: () => void) => {
    if (!NOTEBOOK_INLINE_AI_ACTION_IDS.includes(id)) return;
    run();
  };

  const handleReject = async () => {
    if (!isReceiptCapable('reject')) return;
    const pending = pendingRef.current;
    if (resolutionInFlightRef.current) return;
    resolutionInFlightRef.current = true;
    setStatus('loading');
    if (pending) {
      try {
        await Api.notebookResolveAIProposal(pending.proposalId, 'rejected');
      } catch {
        setStatus('error');
        setErrorAction('reject');
        setErrorMsg(
          t('myWorkNotebook.inlineAi.rejectFailed', 'Nie udało się odrzucić propozycji.')
        );
        resolutionInFlightRef.current = false;
        return;
      }
    }
    resolutionInFlightRef.current = false;
    reset();
  };

  if (!position) return null;

  return (
    <div
      data-testid="notebook-inline-ai-menu"
      className="fixed z-overlay rounded-lg border border-c-border-subtle bg-c-surface shadow-lg p-2"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        maxWidth: `${MENU_WIDTH}px`,
        minWidth: '160px',
      }}
      // Keep the editor's text selection while interacting with the menu.
      onMouseDown={(e) => e.preventDefault()}
    >
      {status === 'loading' && (
        <div className="flex items-center gap-2 px-1 py-0.5 text-sm text-c-text-secondary">
          <Loader2 size={14} className="animate-spin text-c-accent" />
          <span>{t('myWorkNotebook.inlineAi.working', 'Teresa pracuje…')}</span>
        </div>
      )}

      {status === 'done' && (
        <div className="space-y-2" data-testid="notebook-inline-ai-preview">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">
            {t('myWorkNotebook.inlineAi.provenance', 'Źródło: Teresa')}
            {pendingRef.current?.actionLabel
              ? ` · ${t('myWorkNotebook.inlineAi.action', 'akcja')} „${pendingRef.current.actionLabel}”`
              : ''}
            {pendingRef.current?.createdAt
              ? ` · ${pendingRef.current.createdAt.toLocaleTimeString(isPolish ? 'pl' : 'en', { hour: '2-digit', minute: '2-digit' })}`
              : ''}
          </div>
          <div className="grid max-h-52 gap-2 overflow-y-auto sm:grid-cols-2">
            <section className="rounded border border-c-border-subtle bg-c-surface-raised p-2">
              <h4 className="text-[10px] font-semibold uppercase text-c-text-muted">
                {t('myWorkNotebook.inlineAi.before', 'Before')}
              </h4>
              <p className="mt-1 whitespace-pre-wrap text-xs text-c-text-secondary">
                {pendingRef.current?.originalText}
              </p>
            </section>
            <section className="rounded border border-c-border-subtle bg-c-surface-raised p-2">
              <h4 className="text-[10px] font-semibold uppercase text-c-text-muted">
                {t('myWorkNotebook.inlineAi.proposed', 'Proposed')}
              </h4>
              <p className="mt-1 whitespace-pre-wrap text-xs text-c-text">
                {pendingRef.current?.revisedText}
              </p>
            </section>
          </div>
          <div className="flex items-center gap-1">
            <button
              data-testid="notebook-inline-ai-approve"
              data-notebook-action-id="inline-ai:approve"
              aria-disabled={!isReceiptCapable('approve') || undefined}
              onClick={() => runAction('approve', () => void handleApprove())}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-white bg-c-success hover:bg-c-success/90 transition-colors"
            >
              <Check size={12} />
              {t('myWorkNotebook.inlineAi.approve', 'Zatwierdź')}
            </button>
            <button
              data-testid="notebook-inline-ai-reject"
              data-notebook-action-id="inline-ai:reject"
              aria-disabled={!isReceiptCapable('reject') || undefined}
              onClick={() => runAction('reject', () => void handleReject())}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-c-text-secondary bg-c-surface-raised/[0.06] hover:bg-c-border-subtle transition-colors"
            >
              <X size={12} />
              {t('myWorkNotebook.inlineAi.reject', 'Odrzuć')}
            </button>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-1" role="alert">
          <p className="text-xs text-c-danger">
            {errorMsg ?? t('myWorkNotebook.inlineAi.error', 'Błąd AI. Spróbuj ponownie.')}
          </p>
          <div className="flex gap-2">
            {errorAction && (
              <button
                type="button"
                data-notebook-action-id="inline-ai:retry"
                onClick={() =>
                  runAction('retry', () => {
                    setStatus(errorAction === 'generate' ? 'idle' : 'done');
                    setErrorMsg(null);
                    const action = errorAction;
                    setErrorAction(null);
                    if (action === 'generate' && lastActionIdRef.current) {
                      void handleAction(lastActionIdRef.current);
                    } else if (action === 'approve') {
                      void handleApprove();
                    } else if (action === 'reject') {
                      void handleReject();
                    }
                  })
                }
                className="text-xs font-semibold text-c-text-secondary underline hover:text-c-text"
              >
                {t('common.retry', 'Retry')}
              </button>
            )}
            <button
              type="button"
              data-notebook-action-id="inline-ai:close"
              onClick={reset}
              className="text-xs text-c-text-secondary underline hover:text-c-text"
            >
              {t('myWorkNotebook.inlineAi.close', 'Zamknij')}
            </button>
          </div>
        </div>
      )}

      {status === 'idle' && (
        <div>
          {!showActions ? (
            <button
              data-testid="notebook-inline-ai-trigger"
              data-notebook-action-id="inline-ai:trigger"
              onClick={() => setShowActions(true)}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-c-accent hover:bg-c-accent-soft transition-colors w-full"
            >
              <Sparkles size={12} />
              <span>{t('myWorkNotebook.inlineAi.trigger', 'Popraw z Teresą')}</span>
              <ChevronDown size={12} />
            </button>
          ) : (
            <div className="space-y-0.5">
              {receiptCapableActionIds?.length === 0 ? (
                <p
                  id="notebook-inline-ai-receipt-unavailable"
                  className="px-2 py-1 text-[11px] text-c-text-muted"
                >
                  {t(
                    'myWorkNotebook.inlineAi.receiptUnavailable',
                    'Unavailable until the server can return a durable action receipt'
                  )}
                </p>
              ) : null}
              {INLINE_ACTIONS.map((action) => (
                <button
                  key={action.id}
                  data-testid={`notebook-inline-ai-${action.id}`}
                  data-notebook-action-id={`inline-ai:${action.id}`}
                  aria-disabled={!isReceiptCapable(action.id) || undefined}
                  aria-describedby={
                    !isReceiptCapable(action.id)
                      ? 'notebook-inline-ai-receipt-unavailable'
                      : undefined
                  }
                  onClick={() => handleAction(action.id)}
                  className="w-full rounded px-2 py-1 text-left text-xs text-c-text hover:bg-c-surface-raised/[0.06] transition-colors aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
                >
                  {isPolish ? action.labelPl : action.labelEn}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotebookInlineAIMenu;
