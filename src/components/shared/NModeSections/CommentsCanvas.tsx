/**
 * CommentsCanvas
 *
 * Generic N-mode section for comments / discussion thread.
 * Reusable across all artifact types (Decision, Task, Notification, Initiative).
 *
 * Shows:
 * - Date filter + sort controls
 * - Comment thread with avatars, priorities, timestamps
 * - Inline comment input with priority selector (L/N/H) and AI enhance
 *
 * @see docs/ui-standards/01-shell-layout/presentation-modes.md §2.5.3
 */

import { Loader2, MessageSquare, Plus, Sparkles, X } from 'lucide-react';
import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { DateFilterSortControl } from '@/components/shared/DateFilterSortControl';

// ── Types ───────────────────────────────────────────────────────────────────

export type CommentPriority = 'low' | 'normal' | 'high';

export interface CommentItem {
  id: string;
  authorName?: string;
  content: string;
  createdAt: string;
  isAIGenerated?: boolean;
  priority?: CommentPriority;
}

export type DateFilter = 'all' | 'today' | '7d' | '30d';
export type SortOrder = 'asc' | 'desc';

interface CommentsCanvasProps {
  /** Filtered comments list */
  comments: CommentItem[];
  /** Delete handler */
  onDeleteComment: (id: string) => void;
  /** Current date filter */
  dateFilter: DateFilter;
  /** Date filter change handler */
  onDateFilterChange: (filter: DateFilter) => void;
  /** Current sort order */
  sortOrder: SortOrder;
  /** Sort toggle handler */
  onToggleSort: () => void;
  /** Draft comment text */
  commentDraft: string;
  /** Draft change handler */
  onCommentDraftChange: (value: string) => void;
  /** Submit handler */
  onSubmitComment: () => void;
  /** Current draft priority */
  draftPriority: CommentPriority;
  /** Priority change handler */
  onDraftPriorityChange: (priority: CommentPriority) => void;
  /** AI enhance handler (omit to hide) */
  onAIEnhance?: () => void;
  /** Whether AI enhance is in progress */
  isAIEnhancing?: boolean;
  /** Whether inputs are locked/disabled */
  locked?: boolean;
  /** Resolve priority → CSS dot class */
  getPriorityDotClass: (priority: CommentPriority) => string;
  /** Resolve comment → priority */
  getCommentPriority: (comment: CommentItem) => CommentPriority;
  /** Resolve priority → button CSS class */
  getPriorityButtonClass: (priority: CommentPriority, isActive: boolean) => string;
  /** Resolve priority → human label */
  getCommentPriorityLabel: (priority: CommentPriority) => string;
  /** Resolve priority → hint text */
  getCommentPriorityHint: (priority: CommentPriority) => string;
}

// ── Component ───────────────────────────────────────────────────────────────

export const CommentsCanvas: React.FC<CommentsCanvasProps> = ({
  comments,
  onDeleteComment,
  dateFilter,
  onDateFilterChange,
  sortOrder,
  onToggleSort,
  commentDraft,
  onCommentDraftChange,
  onSubmitComment,
  draftPriority,
  onDraftPriorityChange,
  onAIEnhance,
  isAIEnhancing = false,
  locked = false,
  getPriorityDotClass,
  getCommentPriority,
  getPriorityButtonClass,
  getCommentPriorityLabel,
  getCommentPriorityHint,
}) => {
  const { t } = useTranslation();

  const [hoveredPriority, setHoveredPriority] = React.useState<CommentPriority | null>(null);
  const [showMoreComments, setShowMoreComments] = React.useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);

  const priorityOptions: { id: CommentPriority; label: string }[] = [
    { id: 'low', label: 'L' },
    { id: 'normal', label: 'N' },
    { id: 'high', label: 'H' },
  ];

  const scrollToInput = () => {
    if (locked) return;
    commentInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => commentInputRef.current?.focus(), 400);
  };

  const isExpandedComments = showMoreComments && comments.length > 4;
  const visibleComments = comments.slice(0, isExpandedComments ? 8 : 4);
  const canToggleCommentVisibility = comments.length > 4;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-c-text dark:text-white">
          {t('sharedComponents.commentsCanvas.title')}
        </h2>
        <button
          onClick={scrollToInput}
          disabled={locked}
          className="inline-flex items-center gap-1 text-xs text-c-text-secondary dark:text-c-text-muted hover:text-c-text transition-colors"
        >
          <Plus size={13} />
          {t('sharedComponents.commentsCanvas.addComment')}
        </button>
      </div>

      <div className="space-y-4">
        {/* Date filter & sort */}
        <div className="flex items-center justify-end">
          <DateFilterSortControl
            options={[
              { id: 'all', label: t('sharedComponents.commentsCanvas.filterAll') },
              { id: 'today', label: t('sharedComponents.commentsCanvas.filterToday') },
              { id: '7d', label: t('sharedComponents.commentsCanvas.filter7d') },
              { id: '30d', label: t('sharedComponents.commentsCanvas.filter30d') },
            ]}
            value={dateFilter}
            onChange={(next) => onDateFilterChange(next as DateFilter)}
            sortOrder={sortOrder}
            onToggleSort={onToggleSort}
            sortAscLabel={t('sharedComponents.commentsCanvas.sortAsc')}
            sortDescLabel={t('sharedComponents.commentsCanvas.sortDesc')}
            filterButtonTitle={t('sharedComponents.commentsCanvas.filterButtonTitle')}
          />
        </div>

        {/* Comment list */}
        {comments.length === 0 ? (
          <p className="text-xs text-c-text-secondary dark:text-c-text-muted py-4 text-center">
            {t('sharedComponents.commentsCanvas.noComments')}
          </p>
        ) : (
          <div className="space-y-4">
            {visibleComments.map((c) => (
              <div key={c.id} className="group">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-c-border-subtle flex items-center justify-center text-[10px] font-bold text-c-text flex-shrink-0 mt-0.5">
                    {(c.authorName || '?').charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium text-c-text dark:text-c-text-secondary">
                        {c.authorName}
                      </span>
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${getPriorityDotClass(getCommentPriority(c))}`}
                        title={t('sharedComponents.commentsCanvas.priorityTitle', {
                          priority: getCommentPriority(c),
                        })}
                      />
                      <span className="text-[10px] text-c-text-secondary">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </span>
                      {c.isAIGenerated && (
                        <span className="text-[9px] text-c-info font-medium">AI</span>
                      )}
                    </div>
                    <p className="text-sm text-c-text-secondary dark:text-c-text-secondary leading-relaxed">
                      {c.content}
                    </p>
                  </div>
                  <button
                    onClick={() => onDeleteComment(c.id)}
                    disabled={locked}
                    aria-label={t('sharedComponents.commentsCanvas.deleteComment', 'Delete comment')}
                    className="p-0.5 text-c-text-secondary hover:text-danger-500 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {canToggleCommentVisibility && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowMoreComments((prev) => !prev)}
              className="text-xs font-medium text-c-text-secondary dark:text-c-text-muted hover:text-c-text transition-colors"
            >
              {isExpandedComments
                ? t('sharedComponents.commentsCanvas.less')
                : t('sharedComponents.commentsCanvas.more')}
            </button>
          </div>
        )}

        {/* Inline comment input */}
        <div className="flex items-center gap-3 pt-2 border-t border-c-border/40 dark:border-c-border/40">
          {/* Priority selector */}
          <div className="relative inline-flex items-center gap-1">
            {priorityOptions.map((prio) => (
              <button
                key={prio.id}
                type="button"
                onClick={() => onDraftPriorityChange(prio.id)}
                disabled={locked}
                onMouseEnter={() => setHoveredPriority(prio.id)}
                onMouseLeave={() => setHoveredPriority(null)}
                onFocus={() => setHoveredPriority(prio.id)}
                onBlur={() => setHoveredPriority(null)}
                className={`w-6 h-6 rounded-full border text-[10px] font-bold transition-all ${getPriorityButtonClass(prio.id, draftPriority === prio.id)}`}
                title={t('sharedComponents.commentsCanvas.commentPriorityTitle', {
                  label: getCommentPriorityLabel(prio.id),
                })}
              >
                {prio.label}
              </button>
            ))}
            {hoveredPriority && (
              <div className="absolute left-0 -top-12 z-20 min-w-[190px] rounded-lg border border-c-border-strong/60 dark:border-c-border-strong/70 bg-white/95 dark:bg-c-surface/95 px-2.5 py-1.5 shadow-lg">
                <div className="text-[10px] font-semibold text-c-text dark:text-c-text">
                  {t('sharedComponents.commentsCanvas.priorityWord')}:{' '}
                  {getCommentPriorityLabel(hoveredPriority)}
                </div>
                <div className="text-[10px] text-c-text-secondary dark:text-c-text-secondary">
                  {getCommentPriorityHint(hoveredPriority)}
                </div>
              </div>
            )}
          </div>

          {/* Text input */}
          <input
            ref={commentInputRef}
            type="text"
            value={commentDraft}
            onChange={(e) => onCommentDraftChange(e.target.value)}
            disabled={locked}
            placeholder={t('sharedComponents.commentsCanvas.placeholder')}
            className="flex-1 text-sm bg-transparent text-c-text dark:text-c-text-secondary focus:outline-none placeholder-c-text-muted dark:placeholder-c-text-muted"
            onKeyDown={(e) => {
              if (!locked && e.key === 'Enter' && commentDraft.trim()) {
                onSubmitComment();
              }
            }}
          />

          {/* Send */}
          <button
            onClick={onSubmitComment}
            disabled={locked || !commentDraft.trim()}
            className="text-xs font-medium text-c-text dark:text-white hover:text-c-text dark:hover:text-white transition-colors disabled:opacity-40 disabled:text-c-text-muted dark:disabled:text-c-text-secondary"
            title={t('sharedComponents.commentsCanvas.sendTitle')}
          >
            {t('sharedComponents.commentsCanvas.send')}
          </button>

          {/* AI enhance */}
          {onAIEnhance && (
            <button
              onClick={onAIEnhance}
              disabled={locked || isAIEnhancing}
              className="inline-flex items-center gap-1 text-xs font-medium text-c-info hover:text-c-info transition-colors disabled:opacity-40"
              title={t('sharedComponents.commentsCanvas.aiEnhanceTitle')}
            >
              {isAIEnhancing ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Sparkles size={12} />
              )}
              AI
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommentsCanvas;
