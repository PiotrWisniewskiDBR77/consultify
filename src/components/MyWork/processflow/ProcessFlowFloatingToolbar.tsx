import { Copy, Edit3, GitMerge, Link2, MessageCircle, MessageSquare, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import type { ArtifactLink } from '@/utils/artifactLinks';

interface ProcessFlowFloatingToolbarProps {
  nodeId: string;
  nodeData?: Record<string, any>;
  position: { x: number; y: number };
  locked?: boolean;
  isPl?: boolean;
  onRename?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onInsertBetween?: () => void;
  onOpenChat?: () => void;
  artifactLinks?: ArtifactLink[];
  onArtifactLinksChange?: (links: ArtifactLink[]) => void;
  /** M07 F5b B3: node comment thread trigger (badge shows comment count). */
  onOpenComments?: () => void;
  commentCount?: number;
}

const BTN =
  'inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors disabled:opacity-40';

export const ProcessFlowFloatingToolbar: React.FC<ProcessFlowFloatingToolbarProps> = ({
  nodeId,
  nodeData,
  position,
  locked,
  isPl,
  onRename,
  onDuplicate,
  onDelete,
  onInsertBetween,
  onOpenChat,
  artifactLinks,
  onArtifactLinksChange,
  onOpenComments,
  commentCount = 0,
}) => {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [showLinks, setShowLinks] = useState(false);

  useEffect(() => {
    setShowLinks(false);
  }, [nodeId]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
  }, []);

  const linkCount = artifactLinks?.length ?? 0;

  return (
    <div
      ref={toolbarRef}
      className="absolute z-50 flex items-center gap-0.5 rounded-xl border border-slate-200/60 dark:border-navy-700/60 bg-white/95 dark:bg-navy-900/95 shadow-lg backdrop-blur-sm px-1 py-0.5"
      style={{
        left: position.x,
        top: position.y - 44,
        transform: 'translateX(-50%)',
      }}
      onKeyDown={handleKeyDown}
    >
      {onRename && (
        <button
          type="button"
          className={BTN}
          onClick={onRename}
          disabled={locked}
          title={isPl ? 'Zmień nazwę (F2)' : 'Rename (F2)'}
          aria-label={isPl ? 'Zmień nazwę' : 'Rename'}
        >
          <Edit3 size={14} />
        </button>
      )}

      {onDuplicate && (
        <button
          type="button"
          className={BTN}
          onClick={onDuplicate}
          disabled={locked}
          title={isPl ? 'Duplikuj' : 'Duplicate'}
          aria-label={isPl ? 'Duplikuj' : 'Duplicate'}
        >
          <Copy size={14} />
        </button>
      )}

      {onInsertBetween && (
        <button
          type="button"
          className={BTN}
          onClick={onInsertBetween}
          disabled={locked}
          title={isPl ? 'Wstaw między' : 'Insert between'}
          aria-label={isPl ? 'Wstaw między' : 'Insert between'}
        >
          <GitMerge size={14} />
        </button>
      )}

      {onArtifactLinksChange && (
        <button
          type="button"
          className={`${BTN} relative`}
          onClick={() => setShowLinks((v) => !v)}
          title={isPl ? 'Powiązania' : 'Artifact links'}
          aria-label={isPl ? 'Powiązania' : 'Artifact links'}
        >
          <Link2 size={14} />
          {linkCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] rounded-full bg-indigo-500 text-white text-[8px] font-bold flex items-center justify-center">
              {linkCount}
            </span>
          )}
        </button>
      )}

      {onOpenComments && (
        <button
          type="button"
          className={`${BTN} relative`}
          onClick={onOpenComments}
          title={isPl ? 'Komentarze' : 'Comments'}
          aria-label={isPl ? 'Komentarze' : 'Comments'}
        >
          <MessageCircle size={14} />
          {commentCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] rounded-full bg-c-info text-white text-[8px] font-bold flex items-center justify-center">
              {commentCount}
            </span>
          )}
        </button>
      )}

      {onOpenChat && (
        <button
          type="button"
          className={BTN}
          onClick={onOpenChat}
          title={isPl ? 'Zapytaj AI' : 'Ask AI'}
          aria-label={isPl ? 'Zapytaj AI' : 'Ask AI'}
        >
          <MessageSquare size={14} />
        </button>
      )}

      <div className="w-px h-4 bg-slate-200 dark:bg-navy-700 mx-0.5" />

      {onDelete && (
        <button
          type="button"
          className={`${BTN} hover:text-danger-500 dark:hover:text-danger-400`}
          onClick={onDelete}
          disabled={locked}
          title={isPl ? 'Usuń' : 'Delete'}
          aria-label={isPl ? 'Usuń' : 'Delete'}
        >
          <Trash2 size={14} />
        </button>
      )}

      {showLinks && onArtifactLinksChange && (
        <div
          className="absolute top-full left-0 mt-1 w-64 rounded-xl border border-slate-200/60 dark:border-navy-700/60 bg-white dark:bg-navy-900 shadow-xl p-3 z-50"
          onKeyDown={handleKeyDown}
        >
          <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-2">
            {isPl ? 'Powiązane artefakty' : 'Linked artifacts'}
          </div>
          {linkCount === 0 ? (
            <div className="text-[10px] text-slate-500 dark:text-slate-400">
              {isPl ? 'Brak powiązań' : 'No links yet'}
            </div>
          ) : (
            <ul className="space-y-1">
              {artifactLinks!.map((link, idx) => (
                <li
                  key={idx}
                  className="flex items-center justify-between text-[10px] text-slate-600 dark:text-slate-400"
                >
                  <span className="truncate flex-1">
                    {link.label || link.artifactIndex || link.artifactRef.id}
                  </span>
                  <button
                    type="button"
                    className="text-danger-400 hover:text-danger-600 ml-1"
                    onClick={() => {
                      const next = artifactLinks!.filter((_, i) => i !== idx);
                      onArtifactLinksChange(next);
                    }}
                  >
                    <Trash2 size={10} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
