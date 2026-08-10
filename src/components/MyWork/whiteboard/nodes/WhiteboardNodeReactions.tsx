import React from 'react';
import { useTranslation } from 'react-i18next';

import { summarizeReactions, WHITEBOARD_REACTION_EMOJIS } from '../whiteboardReactions';

/**
 * WhiteboardNodeReactions — B4 emoji reactions overlay for a single node.
 *
 * Purely presentational: reads reaction state + a toggle callback off the
 * node's `data` (injected during hydration in IdeaWhiteboardTool). Renders:
 *   • reaction pills (emoji + count) for every emoji with count > 0, always
 *     visible so counts read at a glance;
 *   • a compact "react" affordance that opens the fixed 4-emoji tray, shown
 *     only while the node is hovered or selected (matches how other node
 *     chrome — comment/artifact badges — stays quiet until relevant).
 *
 * The whole thing renders nothing unless `enabled` (session.reactionsEnabled
 * AND an active facilitation session) is true, so default behaviour with the
 * flag off is byte-for-byte unchanged.
 *
 * Visual language mirrors StickyNoteNode's existing badges: rounded-full,
 * text-[9px]/[10px], bg-c-* tokens, shadow-sm, stopPropagation on click.
 */
export interface WhiteboardNodeReactionsProps {
  reactions: unknown;
  currentUserId: string;
  enabled: boolean;
  selected?: boolean;
  onToggle?: (emoji: string) => void;
}

export const WhiteboardNodeReactions: React.FC<WhiteboardNodeReactionsProps> = ({
  reactions,
  currentUserId,
  enabled,
  selected,
  onToggle,
}) => {
  const { t } = useTranslation();
  const [trayOpen, setTrayOpen] = React.useState(false);

  if (!enabled) return null;

  const summary = summarizeReactions(reactions, currentUserId);
  const showAffordance = Boolean(selected) || trayOpen;

  const fire = (emoji: string) => {
    onToggle?.(emoji);
  };

  return (
    <div
      className="nodrag absolute -bottom-3 left-1 z-20 flex items-center gap-1"
      data-testid="wb-node-reactions"
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {/* Existing reaction pills */}
      {summary.map((s) => (
        <button
          key={s.emoji}
          type="button"
          data-testid={`wb-reaction-pill-${s.emoji}`}
          className={`flex items-center gap-0.5 rounded-full border px-1.5 h-5 text-[10px] font-semibold shadow-sm transition-colors ${
            s.reactedByMe
              ? 'bg-c-info/15 border-c-info text-c-text'
              : 'bg-c-surface border-c-border-subtle text-c-text-muted hover:bg-c-surface-raised'
          }`}
          title={
            s.reactedByMe
              ? t('myWork.whiteboard.reactions.removeReaction', 'Remove your reaction')
              : t('myWork.whiteboard.reactions.addReaction', 'Add your reaction')
          }
          onClick={(e) => {
            e.stopPropagation();
            fire(s.emoji);
          }}
        >
          <span aria-hidden>{s.emoji}</span>
          <span>{s.count}</span>
        </button>
      ))}

      {/* React affordance — appears on hover/select via the group-hover wrapper
          in the host node, plus while its own tray is open. */}
      {onToggle && (
        <div
          className={showAffordance ? 'flex items-center' : 'hidden group-hover:flex items-center'}
        >
          {trayOpen ? (
            <div
              data-testid="wb-reaction-tray"
              className="flex items-center gap-0.5 rounded-full border border-c-border-subtle bg-c-surface px-1 h-5 shadow-sm"
            >
              {WHITEBOARD_REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  data-testid={`wb-reaction-add-${emoji}`}
                  className="flex items-center justify-center w-4 h-4 rounded-full text-[11px] leading-none hover:bg-c-surface-raised transition-colors"
                  title={t('myWork.whiteboard.reactions.reactWith', 'React {{emoji}}', { emoji })}
                  onClick={(e) => {
                    e.stopPropagation();
                    fire(emoji);
                    setTrayOpen(false);
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          ) : (
            <button
              type="button"
              data-testid="wb-reaction-toggle"
              className="flex items-center justify-center w-5 h-5 rounded-full border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-[10px] text-c-text-muted shadow-sm hover:bg-c-surface-raised transition-colors"
              title={t('myWork.whiteboard.reactions.openTray', 'Add reaction')}
              onClick={(e) => {
                e.stopPropagation();
                setTrayOpen(true);
              }}
            >
              🙂
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default WhiteboardNodeReactions;
