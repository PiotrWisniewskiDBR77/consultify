import React from 'react';

/**
 * CommentPinBadge — shared comment-count indicator for whiteboard nodes.
 *
 * Renders a small circular badge showing how many comments a node has, and on
 * click opens the shared IdeaNodeDetailDrawer via the global
 * `idea-node-open-detail` event (the same mechanism StickyNoteNode has always
 * used). The badge is intentionally invisible when there are no comments so it
 * never adds clutter to nodes without discussion.
 *
 * Visual treatment is copied verbatim from the original StickyNoteNode badge so
 * every node type reads identically.
 */
export interface CommentPinBadgeProps {
  /** The ReactFlow node id — used to target the detail drawer. */
  nodeId: string;
  /** Number of comments on the node. Badge only renders when > 0. */
  count: number;
  /**
   * Optional override for the absolute position classes. Defaults to the
   * sticky-note placement (`-top-2 -right-2`). ImageNode / LinkNode clip their
   * overflow, so they nudge the badge inward.
   */
  positionClassName?: string;
}

export const CommentPinBadge: React.FC<CommentPinBadgeProps> = ({
  nodeId,
  count,
  positionClassName = '-top-2 -right-2',
}) => {
  if (!count || count <= 0) return null;

  return (
    <div
      data-testid="comment-pin-badge"
      className={`absolute ${positionClassName} z-10 flex items-center justify-center w-5 h-5 rounded-full bg-c-info text-white text-[8px] font-bold shadow-sm cursor-pointer hover:brightness-110 transition-all`}
      onClick={(e) => {
        e.stopPropagation();
        window.dispatchEvent(new CustomEvent('idea-node-open-detail', { detail: { nodeId } }));
      }}
      title={`${count} comment${count !== 1 ? 's' : ''}`}
    >
      {count}
    </div>
  );
};

/** Shared helper: derive comment count from a node's data payload. */
export const commentCountOf = (data: unknown): number => {
  const comments = (data as { comments?: unknown })?.comments;
  return Array.isArray(comments) ? comments.length : 0;
};

export default CommentPinBadge;
