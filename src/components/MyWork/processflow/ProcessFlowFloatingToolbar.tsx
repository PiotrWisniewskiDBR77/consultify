import { Copy, Edit3, GitMerge, Link2, MessageCircle, MessageSquare, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

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
  'inline-flex items-center justify-center w-7 h-7 rounded-lg text-c-text-secondary hover:bg-c-surface-raised transition-colors disabled:opacity-40';

export const ProcessFlowFloatingToolbar: React.FC<ProcessFlowFloatingToolbarProps> = ({
  nodeId,
  nodeData,
  position,
  locked,
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
  const { t } = useTranslation();
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
      className="absolute z-50 flex items-center gap-0.5 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-lg backdrop-blur-sm px-1 py-0.5"
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
          title={t('processFlow.floatingToolbar.renameTitle', 'Rename (F2)')}
          aria-label={t('processFlow.floatingToolbar.rename', 'Rename')}
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
          title={t('processFlow.floatingToolbar.duplicate', 'Duplicate')}
          aria-label={t('processFlow.floatingToolbar.duplicate', 'Duplicate')}
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
          title={t('processFlow.floatingToolbar.insertBetween', 'Insert between')}
          aria-label={t('processFlow.floatingToolbar.insertBetween', 'Insert between')}
        >
          <GitMerge size={14} />
        </button>
      )}

      {onArtifactLinksChange && (
        <button
          type="button"
          className={`${BTN} relative`}
          onClick={() => setShowLinks((v) => !v)}
          title={t('processFlow.floatingToolbar.artifactLinks', 'Artifact links')}
          aria-label={t('processFlow.floatingToolbar.artifactLinks', 'Artifact links')}
        >
          <Link2 size={14} />
          {linkCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] rounded-full bg-c-tag-2 text-white text-[8px] font-bold flex items-center justify-center">
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
          title={t('processFlow.floatingToolbar.comments', 'Comments')}
          aria-label={t('processFlow.floatingToolbar.comments', 'Comments')}
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
          title={t('processFlow.floatingToolbar.askAi', 'Ask AI')}
          aria-label={t('processFlow.floatingToolbar.askAi', 'Ask AI')}
        >
          <MessageSquare size={14} />
        </button>
      )}

      <div className="w-px h-4 bg-c-surface-raised mx-0.5" />

      {onDelete && (
        <button
          type="button"
          className={`${BTN} hover:text-danger-500 dark:hover:text-danger-400`}
          onClick={onDelete}
          disabled={locked}
          title={t('processFlow.floatingToolbar.delete', 'Delete')}
          aria-label={t('processFlow.floatingToolbar.delete', 'Delete')}
        >
          <Trash2 size={14} />
        </button>
      )}

      {showLinks && onArtifactLinksChange && (
        <div
          className="absolute top-full left-0 mt-1 w-64 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-xl p-3 z-50"
          onKeyDown={handleKeyDown}
        >
          <div className="text-[11px] font-semibold text-c-text-secondary mb-2">
            {t('processFlow.floatingToolbar.linkedArtifacts', 'Linked artifacts')}
          </div>
          {linkCount === 0 ? (
            <div className="text-[10px] text-c-text-muted">
              {t('processFlow.floatingToolbar.noLinksYet', 'No links yet')}
            </div>
          ) : (
            <ul className="space-y-1">
              {artifactLinks!.map((link, idx) => (
                <li
                  key={idx}
                  className="flex items-center justify-between text-[10px] text-c-text-secondary"
                >
                  <span className="truncate flex-1">
                    {link.label || link.artifactIndex || link.artifactRef.id}
                  </span>
                  <button
                    type="button"
                    className="text-danger-400 hover:text-danger-600 ml-1"
                    title={t('processFlow.floatingToolbar.removeLink', 'Remove link')}
                    aria-label={t('processFlow.floatingToolbar.removeLink', 'Remove link')}
                    onClick={() => {
                      const next = artifactLinks!.filter((_, i) => i !== idx);
                      onArtifactLinksChange(next);
                    }}
                  >
                    <Trash2 size={10} aria-hidden="true" />
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
