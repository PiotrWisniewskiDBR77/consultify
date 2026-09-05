/**
 * ReportComments Component
 *
 * Section-based commenting system for Management Reports.
 * Supports threads, mentions, and resolution tracking.
 *
 * PMO Standards: Stakeholder Communication (PMBOK 7)
 */

import {
  AtSign,
  CheckCircle2,
  Clock,
  MessageSquare,
  MoreVertical,
  Reply,
  Send,
  Trash2,
  User,
} from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';

import { ReportComment } from '../../../types';

interface ReportCommentsProps {
  reportId: string;
  sectionId: string;
  sectionName?: string;
  comments: ReportComment[];
  currentUserId: string;
  isLocked?: boolean;
  onAddComment: (content: string, mentions?: string[], parentId?: string) => Promise<void>;
  onResolveComment: (commentId: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  teamMembers?: Array<{ id: string; name: string; email: string }>;
  className?: string;
}

// Single comment item
const CommentItem: React.FC<{
  comment: ReportComment;
  currentUserId: string;
  isLocked: boolean;
  onReply: () => void;
  onResolve: () => void;
  onDelete: () => void;
}> = ({ comment, currentUserId, isLocked, onReply, onResolve, onDelete }) => {
  const [showMenu, setShowMenu] = useState(false);
  const isAuthor = comment.createdBy === currentUserId;
  const canDelete = isAuthor; // Only author can delete

  return (
    <div
      className={`group p-3 rounded-lg transition-colors ${
        comment.isResolved
          ? 'bg-emerald-50 dark:bg-emerald-900/10 opacity-75'
          : 'bg-slate-50 dark:bg-navy-800/50 hover:bg-slate-100 dark:hover:bg-navy-800'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
            <User size={16} className="text-primary-600 dark:text-primary-400" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm text-navy-900 dark:text-white">
                {comment.createdByName || 'Unknown User'}
              </span>
              <span className="text-xs text-slate-600 dark:text-slate-500">
                {new Date(comment.createdAt).toLocaleString()}
              </span>
              {comment.isResolved && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full text-xs">
                  <CheckCircle2 size={10} />
                  Resolved
                </span>
              )}
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
              {comment.content}
            </p>

            {/* Mentions */}
            {comment.mentions && comment.mentions.length > 0 && (
              <div className="flex items-center gap-1 mt-2 text-xs text-primary-600 dark:text-primary-400">
                <AtSign size={12} />
                {comment.mentions.length} mentioned
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        {!isLocked && (
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              aria-label="More options"
              className="p-1 opacity-0 group-hover:opacity-100 hover:bg-slate-200 dark:hover:bg-navy-700 rounded transition-all"
            >
              <MoreVertical size={16} className="text-slate-600 dark:text-slate-500" />
            </button>

            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-navy-900 rounded-lg shadow-lg border border-slate-200 dark:border-navy-700 py-1 z-20">
                  <button
                    onClick={() => {
                      onReply();
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 flex items-center gap-2"
                  >
                    <Reply size={14} />
                    Reply
                  </button>
                  {!comment.isResolved && (
                    <button
                      onClick={() => {
                        onResolve();
                        setShowMenu(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-emerald-600 dark:text-emerald-400 hover:bg-slate-50 dark:hover:bg-navy-800 flex items-center gap-2"
                    >
                      <CheckCircle2 size={14} />
                      Resolve
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => {
                        onDelete();
                        setShowMenu(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-danger-600 dark:text-danger-400 hover:bg-slate-50 dark:hover:bg-navy-800 flex items-center gap-2"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-3 ml-11 space-y-2 border-l-2 border-slate-200 dark:border-navy-700 pl-3">
          {comment.replies.map((reply: any) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              isLocked={isLocked}
              onReply={() => {}}
              onResolve={() => {}}
              onDelete={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Comment input with mentions
const CommentInput: React.FC<{
  placeholder?: string;
  onSubmit: (content: string, mentions: string[]) => void;
  teamMembers?: Array<{ id: string; name: string; email: string }>;
  autoFocus?: boolean;
  className?: string;
}> = ({
  placeholder = 'Add a comment...',
  onSubmit,
  teamMembers = [],
  autoFocus = false,
  className = '',
}) => {
  const [content, setContent] = useState('');
  const [mentions, setMentions] = useState<string[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const filteredMembers = useMemo(() => {
    if (!mentionSearch) return teamMembers;
    const search = mentionSearch.toLowerCase();
    return teamMembers.filter(
      (m) => m.name.toLowerCase().includes(search) || m.email.toLowerCase().includes(search)
    );
  }, [teamMembers, mentionSearch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === '@') {
      setShowMentions(true);
      setMentionSearch('');
    } else if (e.key === 'Escape') {
      setShowMentions(false);
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleMention = (member: { id: string; name: string }) => {
    setContent((prev) => prev.replace(/@\w*$/, `@${member.name} `));
    setMentions((prev) => [...prev, member.id]);
    setShowMentions(false);
    inputRef.current?.focus();
  };

  const handleSubmit = () => {
    if (!content.trim()) return;
    onSubmit(content.trim(), mentions);
    setContent('');
    setMentions([]);
  };

  return (
    <div className={`relative ${className}`}>
      <textarea
        ref={inputRef}
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          // Check for @mention
          const match = e.target.value.match(/@(\w*)$/);
          if (match) {
            setShowMentions(true);
            setMentionSearch(match[1]);
          } else {
            setShowMentions(false);
          }
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full px-3 py-2 pr-12 border border-slate-200 dark:border-navy-700 rounded-lg bg-white dark:bg-navy-800 text-navy-900 dark:text-white placeholder-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus resize-none"
        rows={2}
      />

      <button
        onClick={handleSubmit}
        disabled={!content.trim()}
        aria-label="Send comment"
        className="absolute right-2 bottom-2 p-2 bg-c-text hover:bg-c-text-secondary disabled:bg-slate-300 dark:disabled:bg-navy-700 text-c-bg rounded-lg transition-colors"
      >
        <Send size={16} />
      </button>

      {/* Mentions dropdown */}
      {showMentions && filteredMembers.length > 0 && (
        <div className="absolute left-0 bottom-full mb-1 w-64 bg-white dark:bg-navy-900 rounded-lg shadow-lg border border-slate-200 dark:border-navy-700 py-1 max-h-48 overflow-y-auto z-20">
          {filteredMembers.map((member) => (
            <button
              key={member.id}
              onClick={() => handleMention(member)}
              className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-navy-800 flex items-center gap-2"
            >
              <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                <User size={12} className="text-primary-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-navy-900 dark:text-white truncate">
                  {member.name}
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-500 truncate">
                  {member.email}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const ReportComments: React.FC<ReportCommentsProps> = ({
  reportId,
  sectionId,
  sectionName,
  comments,
  currentUserId,
  isLocked = false,
  onAddComment,
  onResolveComment,
  onDeleteComment,
  teamMembers = [],
  className = '',
}) => {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Count unresolved comments
  const unresolvedCount = useMemo(() => {
    return comments.filter((c) => !c.isResolved).length;
  }, [comments]);

  // Handle add comment
  const handleAddComment = useCallback(
    async (content: string, mentions: string[]) => {
      setSubmitting(true);
      try {
        await onAddComment(content, mentions, replyingTo || undefined);
        setReplyingTo(null);
      } finally {
        setSubmitting(false);
      }
    },
    [onAddComment, replyingTo]
  );

  return (
    <div className={`${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-slate-600 dark:text-slate-500" />
          <span className="text-sm font-medium text-navy-900 dark:text-white">
            {sectionName ? `Comments on ${sectionName}` : 'Comments'}
          </span>
          {unresolvedCount > 0 && (
            <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full text-xs">
              {unresolvedCount} unresolved
            </span>
          )}
        </div>
      </div>

      {/* Comments list */}
      {comments.length > 0 ? (
        <div className="space-y-2 mb-3">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserId={currentUserId}
              isLocked={isLocked}
              onReply={() => setReplyingTo(comment.id)}
              onResolve={() => onResolveComment(comment.id)}
              onDelete={() => onDeleteComment(comment.id)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-6 text-slate-600 dark:text-slate-500 text-sm">
          <MessageSquare size={24} className="mx-auto mb-2 opacity-50" />
          No comments yet
        </div>
      )}

      {/* Input */}
      {!isLocked && (
        <div>
          {replyingTo && (
            <div className="flex items-center gap-2 mb-2 text-sm text-slate-500 dark:text-slate-400">
              <Reply size={14} />
              <span>Replying to comment</span>
              <button
                onClick={() => setReplyingTo(null)}
                className="text-primary-500 hover:text-primary-600"
              >
                Cancel
              </button>
            </div>
          )}
          <CommentInput
            placeholder={replyingTo ? 'Write a reply...' : 'Add a comment... (@ to mention)'}
            onSubmit={handleAddComment}
            teamMembers={teamMembers}
          />
        </div>
      )}

      {isLocked && (
        <div className="text-center py-3 text-sm text-slate-600 dark:text-slate-500 flex items-center justify-center gap-2">
          <Clock size={14} />
          Report is finalized. Comments are read-only.
        </div>
      )}
    </div>
  );
};

export default ReportComments;
