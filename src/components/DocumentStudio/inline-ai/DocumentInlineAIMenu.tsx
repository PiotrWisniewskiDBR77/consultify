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
import { useTranslation } from 'react-i18next';

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
  const { t, i18n } = useTranslation();
  const isPolish = (i18n.language || 'pl').startsWith('pl');
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
      className="fixed z-overlay rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-lg p-2"
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
        <div className="flex items-center gap-2 px-1 py-0.5 text-sm text-c-text-secondary">
          <Loader2 size={14} className="animate-spin text-c-accent" />
          <span>{t('documentStudio.inlineAi.working', 'Teresa pracuje…')}</span>
        </div>
      )}

      {/* Done — approve / reject */}
      {status === 'done' && (
        <div className="flex items-center gap-1">
          <button
            onClick={handleApprove}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-c-text bg-emerald-500 hover:bg-emerald-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <Check size={12} />
            {t('documentStudio.inlineAi.approve', 'Zatwierdź')}
          </button>
          <button
            onClick={handleReject}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-c-text-secondary bg-c-surface-raised/[0.06] hover:bg-c-border-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <X size={12} />
            {t('documentStudio.inlineAi.reject', 'Odrzuć')}
          </button>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && (
        <div className="space-y-1">
          <p className="text-xs text-red-600 dark:text-red-400">
            {errorMsg ?? t('documentStudio.inlineAi.error', 'Błąd AI. Spróbuj ponownie.')}
          </p>
          <button
            onClick={() => rejectProposal()}
            className="text-xs text-c-text-secondary underline hover:text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            {t('documentStudio.inlineAi.close', 'Zamknij')}
          </button>
        </div>
      )}

      {/* Idle — action picker */}
      {status === 'idle' && (
        <div>
          {!showActions ? (
            <button
              onClick={() => setShowActions(true)}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-c-text-secondary hover:bg-c-surface-raised/[0.06] transition-colors w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              <span>{t('documentStudio.inlineAi.trigger', 'Popraw z Teresa')}</span>
              <ChevronDown size={12} />
            </button>
          ) : (
            <div className="space-y-0.5">
              {INLINE_ACTIONS.map((action) => (
                <button
                  key={action.id}
                  data-testid={`doc-inline-ai-${action.id}`}
                  onClick={() => handleAction(action.id)}
                  className="w-full rounded px-2 py-1 text-left text-xs text-c-text hover:bg-c-surface-raised/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
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

export default DocumentInlineAIMenu;
