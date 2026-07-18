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

const MENU_WIDTH = 220;
const MARGIN = 8;
const SELECTION_GAP = 12; // offset below caret so we clear the format bubble

type Status = 'idle' | 'loading' | 'done' | 'error';

interface MenuPosition {
  top: number;
  left: number;
}

interface PendingReplace {
  proposalId: string;
}

export interface NotebookInlineAIMenuProps {
  editor: Editor | null;
  pageId: string | null;
  /** Called after an approved proposal has been applied so the host can reload. */
  onApplied: () => void;
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
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = (i18n.language || 'pl').startsWith('pl');
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const [showActions, setShowActions] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const pendingRef = useRef<PendingReplace | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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
    setShowActions(false);
    setPosition(null);
  };

  const handleAction = async (actionId: string) => {
    if (!editor || !pageId) return;
    const action = INLINE_ACTIONS.find((a) => a.id === actionId);
    if (!action) return;

    const { state } = editor;
    const { $from, $to, from, to } = state.selection;
    const selectedText = state.doc.textBetween(from, to, '\n\n').trim();
    if (!selectedText) return;

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
              pendingRef.current = { proposalId };
              trackFunnelEvent('notebook_inline_ai_rewrite_proposed', {
                actionId,
                selectionLength: selectedText.length,
              });
              setStatus('done');
            } catch {
              setStatus('error');
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
        setErrorMsg(t('myWorkNotebook.inlineAi.executeFailed', 'Błąd AI. Spróbuj ponownie.'));
      }
    }
  };

  const handleApprove = async () => {
    const pending = pendingRef.current;
    if (!pending) return;
    try {
      await Api.notebookResolveAIProposal(pending.proposalId, 'accepted');
      trackFunnelEvent('notebook_inline_ai_rewrite_accepted', {});
      onApplied();
    } catch {
      setStatus('error');
      setErrorMsg(t('myWorkNotebook.inlineAi.approveFailed', 'Nie udało się zatwierdzić.'));
      return;
    }
    reset();
  };

  const handleReject = async () => {
    const pending = pendingRef.current;
    if (pending) {
      try {
        await Api.notebookResolveAIProposal(pending.proposalId, 'rejected');
      } catch {
        /* best-effort cleanup */
      }
    }
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
        <div className="flex items-center gap-1">
          <button
            data-testid="notebook-inline-ai-approve"
            onClick={handleApprove}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-white bg-c-success hover:bg-c-success/90 transition-colors"
          >
            <Check size={12} />
            {t('myWorkNotebook.inlineAi.approve', 'Zatwierdź')}
          </button>
          <button
            data-testid="notebook-inline-ai-reject"
            onClick={handleReject}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-c-text-secondary bg-c-surface-raised/[0.06] hover:bg-c-border-subtle transition-colors"
          >
            <X size={12} />
            {t('myWorkNotebook.inlineAi.reject', 'Odrzuć')}
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-1">
          <p className="text-xs text-c-danger">
            {errorMsg ?? t('myWorkNotebook.inlineAi.error', 'Błąd AI. Spróbuj ponownie.')}
          </p>
          <button
            onClick={reset}
            className="text-xs text-c-text-secondary underline hover:text-c-text"
          >
            {t('myWorkNotebook.inlineAi.close', 'Zamknij')}
          </button>
        </div>
      )}

      {status === 'idle' && (
        <div>
          {!showActions ? (
            <button
              data-testid="notebook-inline-ai-trigger"
              onClick={() => setShowActions(true)}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-c-accent hover:bg-c-accent-soft transition-colors w-full"
            >
              <Sparkles size={12} />
              <span>{t('myWorkNotebook.inlineAi.trigger', 'Popraw z Teresą')}</span>
              <ChevronDown size={12} />
            </button>
          ) : (
            <div className="space-y-0.5">
              {INLINE_ACTIONS.map((action) => (
                <button
                  key={action.id}
                  data-testid={`notebook-inline-ai-${action.id}`}
                  onClick={() => handleAction(action.id)}
                  className="w-full rounded px-2 py-1 text-left text-xs text-c-text hover:bg-c-surface-raised/[0.06] transition-colors"
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
