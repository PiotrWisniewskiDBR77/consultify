/**
 * Document Studio — DocumentInlineAIMenu (R2).
 *
 * Floating menu that appears above text selected inside the TipTap document
 * editor. Lets the user pick one of 5 quick-rewrite actions which are sent
 * as bounded LLM proposals and approved/rejected inline.
 *
 * Positioning is modelled after CanvasAIFloatingMenu but uses `fixed`
 * coords from `editor.view.coordsAtPos` instead of window.getSelection()
 * so it works correctly even when the editor is inside a scrollable panel.
 */

import type { Editor } from '@tiptap/react';
import { Check, ChevronDown, Loader2, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

import type { DocumentSchema } from '../types';
import { INLINE_ACTIONS } from './inlineActionPrompts';
import { useDocumentInlineAI } from './useDocumentInlineAI';

const MENU_HEIGHT = 44; // approx rendered height (px)
const MENU_WIDTH = 220; // approx max-width (px)
const MARGIN = 8;

interface MenuPosition {
  top: number;
  left: number;
}

export interface DocumentInlineAIMenuProps {
  editor: Editor | null;
  artifactId: string;
  onSchemaUpdated?: (s: DocumentSchema) => void;
}

export const DocumentInlineAIMenu: React.FC<DocumentInlineAIMenuProps> = ({
  editor,
  artifactId,
  onSchemaUpdated,
}) => {
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const [showActions, setShowActions] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Derive sectionId/blockId from the current selection on every render.
  const getSectionAndBlock = (): { sectionId: string; blockId: string } => {
    if (!editor) return { sectionId: '', blockId: '' };
    const { $from } = editor.state.selection;
    const nodeAttrs = $from.parent.attrs as Record<string, unknown>;
    return {
      sectionId: String(nodeAttrs.sectionId ?? ''),
      blockId: String(nodeAttrs.blockId ?? ''),
    };
  };

  const { status, proposalId, errorMsg, triggerAction, approveProposal, rejectProposal } =
    useDocumentInlineAI();

  // Update position whenever the selection changes.
  useEffect(() => {
    if (!editor) return;

    const update = () => {
      const { selection } = editor.state;
      if (selection.empty || selection.content().size === 0) {
        setPosition(null);
        setShowActions(false);
        return;
      }
      try {
        const coords = editor.view.coordsAtPos(selection.from);
        const vw = window.innerWidth;
        const idealTop = coords.top - MENU_HEIGHT - MARGIN;
        const top = Math.max(MARGIN, Math.min(idealTop, window.innerHeight - MENU_HEIGHT - MARGIN));
        const idealLeft = coords.left;
        const left = Math.max(MARGIN, Math.min(idealLeft, vw - MENU_WIDTH - MARGIN));
        setPosition({ top, left });
      } catch {
        setPosition(null);
      }
    };

    editor.on('selectionUpdate', update);
    editor.on('blur', () => {
      // Keep menu visible while user clicks on it.
      // Actual close is handled by the selection becoming empty.
    });

    return () => {
      editor.off('selectionUpdate', update);
    };
  }, [editor]);

  // Close when selection becomes empty (e.g. Esc or click-away).
  useEffect(() => {
    if (!editor) return;
    const close = () => {
      if (editor.state.selection.empty) {
        setPosition(null);
        setShowActions(false);
      }
    };
    editor.on('selectionUpdate', close);
    return () => {
      editor.off('selectionUpdate', close);
    };
  }, [editor]);

  const handleAction = async (actionId: string) => {
    if (!editor) return;
    setShowActions(false);
    const selectedText = editor.state.doc.textBetween(
      editor.state.selection.from,
      editor.state.selection.to,
      ' '
    );
    const { sectionId, blockId } = getSectionAndBlock();
    if (!sectionId && !blockId) return; // guard: no block context
    await triggerAction(actionId, selectedText, sectionId, blockId, artifactId);
  };

  const handleApprove = async () => {
    if (!proposalId) return;
    const result = await approveProposal(artifactId, proposalId);
    if (result) {
      onSchemaUpdated?.(result.schema);
    }
    setPosition(null);
    setShowActions(false);
  };

  const handleReject = () => {
    rejectProposal();
    setPosition(null);
    setShowActions(false);
  };

  if (!position) return null;

  return (
    <div
      ref={menuRef}
      data-testid="doc-inline-ai-menu"
      className="fixed z-overlay rounded-lg border border-slate-200 bg-white shadow-lg dark:border-navy-700 dark:bg-navy-900 p-2"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        maxWidth: `${MENU_WIDTH}px`,
        minWidth: '160px',
      }}
      // Prevent the editor from losing focus when the user clicks the menu.
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Loading state */}
      {status === 'loading' && (
        <div className="flex items-center gap-2 px-1 py-0.5 text-sm text-slate-500 dark:text-slate-400">
          <Loader2 size={14} className="animate-spin text-primary-500" />
          <span>Teresa pracuje…</span>
        </div>
      )}

      {/* Done — approve / reject */}
      {status === 'done' && (
        <div className="flex items-center gap-1">
          <button
            onClick={handleApprove}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-white bg-emerald-500 hover:bg-emerald-600 transition-colors"
          >
            <Check size={12} />
            Zatwierdź
          </button>
          <button
            onClick={handleReject}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
          >
            <X size={12} />
            Odrzuć
          </button>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && (
        <div className="space-y-1">
          <p className="text-xs text-red-600 dark:text-red-400">
            {errorMsg ?? 'Błąd AI. Spróbuj ponownie.'}
          </p>
          <button
            onClick={() => rejectProposal()}
            className="text-xs text-slate-500 underline hover:text-slate-700 dark:hover:text-slate-300"
          >
            Zamknij
          </button>
        </div>
      )}

      {/* Idle — action picker */}
      {status === 'idle' && (
        <div>
          {!showActions ? (
            <button
              onClick={() => setShowActions(true)}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10 transition-colors w-full"
            >
              <span>Popraw z Teresa</span>
              <ChevronDown size={12} />
            </button>
          ) : (
            <div className="space-y-0.5">
              {INLINE_ACTIONS.map((action) => (
                <button
                  key={action.id}
                  data-testid={`doc-inline-ai-${action.id}`}
                  onClick={() => handleAction(action.id)}
                  className="w-full rounded px-2 py-1 text-left text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
                >
                  {action.labelPl}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DocumentInlineAIMenu;
