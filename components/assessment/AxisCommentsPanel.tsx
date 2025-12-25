/**
 * Axis Comments Panel
 * Multi-stakeholder discussion threads for assessment axes
 * Supports threaded replies, mentions, and resolution
 */

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
    MessageSquare, Send, Reply, CheckCircle, MoreVertical,
    User, Clock, AlertCircle, Smile, ThumbsUp, Flag
} from 'lucide-react';
import axios from 'axios';
import { useAppStore } from '../../store/useAppStore';

interface Comment {
    id: string;
    assessment_id: string;
    axis_id: string;
    user_id: string;
    author_name: string;
    author_email: string;
    comment: string;
    parent_comment_id: string | null;
    is_resolved: boolean;
    resolved_by?: string;
    resolved_at?: string;
    created_at: string;
    updated_at: string;
    replies: Comment[];
}

interface Props {
    assessmentId: string;
    axisId: string;
    axisLabel: string;
    isReadOnly?: boolean;
    onCommentCountChange?: (count: number) => void;
}

// DRD Axis Colors
const AXIS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
    processes: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
    digitalProducts: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700' },
    businessModels: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
    dataManagement: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700' },
    culture: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
    cybersecurity: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
    aiMaturity: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' }
};

export const AxisCommentsPanel: React.FC<Props> = ({
    assessmentId,
    axisId,
    axisLabel,
    isReadOnly = false,
    onCommentCountChange
}) => {
    const { t } = useTranslation();
    const { currentUser } = useAppStore();
    
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [replyTo, setReplyTo] = useState<string | null>(null);
    const [replyText, setReplyText] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showResolved, setShowResolved] = useState(false);
    
    const commentInputRef = useRef<HTMLTextAreaElement>(null);
    const replyInputRef = useRef<HTMLTextAreaElement>(null);

    const axisColors = AXIS_COLORS[axisId] || AXIS_COLORS.processes;

    useEffect(() => {
        loadComments();
    }, [assessmentId, axisId]);

    useEffect(() => {
        if (replyTo && replyInputRef.current) {
            replyInputRef.current.focus();
        }
    }, [replyTo]);

    const loadComments = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/assessment-workflow/${assessmentId}/comments`, {
                params: { axisId }
            });
            setComments(res.data.comments || []);
            
            // Count total comments including replies
            const countComments = (arr: Comment[]): number => {
                return arr.reduce((acc, c) => acc + 1 + countComments(c.replies || []), 0);
            };
            onCommentCountChange?.(countComments(res.data.comments || []));
        } catch (error) {
            console.error('Error loading comments:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitComment = async (parentId: string | null = null) => {
        const text = parentId ? replyText : newComment;
        if (!text.trim()) return;

        setSubmitting(true);
        try {
            await axios.post(`/api/assessment-workflow/${assessmentId}/comments`, {
                axisId,
                comment: text.trim(),
                parentCommentId: parentId
            });
            
            if (parentId) {
                setReplyText('');
                setReplyTo(null);
            } else {
                setNewComment('');
            }
            
            loadComments();
        } catch (error) {
            console.error('Error submitting comment:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleResolveComment = async (commentId: string) => {
        try {
            await axios.post(`/api/assessment-workflow/${assessmentId}/comments/${commentId}/resolve`);
            loadComments();
        } catch (error) {
            console.error('Error resolving comment:', error);
        }
    };

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n.charAt(0)).join('').toUpperCase().slice(0, 2);
    };

    const getTimeAgo = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    const filteredComments = showResolved 
        ? comments 
        : comments.filter(c => !c.is_resolved);

    const resolvedCount = comments.filter(c => c.is_resolved).length;
    const unresolvedCount = comments.length - resolvedCount;

    return (
        <div className="bg-white dark:bg-navy-900 rounded-lg border border-slate-200 dark:border-white/10 overflow-hidden">
            {/* Header */}
            <div className={`px-4 py-3 ${axisColors.bg} dark:bg-navy-800 border-b ${axisColors.border} dark:border-white/10`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <MessageSquare className={`w-4 h-4 ${axisColors.text} dark:text-white`} />
                        <h3 className={`text-sm font-semibold ${axisColors.text} dark:text-white`}>
                            Discussion: {axisLabel}
                        </h3>
                        {comments.length > 0 && (
                            <span className="px-1.5 py-0.5 text-xs bg-white dark:bg-navy-900 rounded-full text-slate-600 dark:text-slate-400">
                                {unresolvedCount} active
                            </span>
                        )}
                    </div>
                    
                    {resolvedCount > 0 && (
                        <button
                            onClick={() => setShowResolved(!showResolved)}
                            className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1"
                        >
                            <CheckCircle size={12} />
                            {showResolved ? 'Hide' : 'Show'} {resolvedCount} resolved
                        </button>
                    )}
                </div>
            </div>

            {/* Comments List */}
            <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : filteredComments.length === 0 ? (
                    <div className="text-center py-8">
                        <MessageSquare className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            No comments yet. Start a discussion about this axis.
                        </p>
                    </div>
                ) : (
                    filteredComments.map(comment => (
                        <CommentThread
                            key={comment.id}
                            comment={comment}
                            currentUserId={currentUser?.id}
                            isReadOnly={isReadOnly}
                            replyTo={replyTo}
                            replyText={replyText}
                            onReplyToChange={setReplyTo}
                            onReplyTextChange={setReplyText}
                            onSubmitReply={() => handleSubmitComment(replyTo)}
                            onResolve={handleResolveComment}
                            getInitials={getInitials}
                            getTimeAgo={getTimeAgo}
                            submitting={submitting}
                            replyInputRef={replyInputRef}
                        />
                    ))
                )}
            </div>

            {/* New Comment Input */}
            {!isReadOnly && (
                <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-navy-950/50">
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-500 flex-shrink-0 flex items-center justify-center text-white text-xs font-medium">
                            {currentUser ? getInitials(`${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.email || 'U') : 'U'}
                        </div>
                        <div className="flex-1">
                            <textarea
                                ref={commentInputRef}
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder={`Add a comment about ${axisLabel}...`}
                                rows={2}
                                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-white/10 rounded-lg bg-white dark:bg-navy-800 text-navy-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                        handleSubmitComment();
                                    }
                                }}
                            />
                            <div className="flex justify-between items-center mt-2">
                                <span className="text-xs text-slate-400">
                                    Press ⌘+Enter to send
                                </span>
                                <button
                                    onClick={() => handleSubmitComment()}
                                    disabled={!newComment.trim() || submitting}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Send size={14} />
                                    Post
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Comment Thread Component
interface CommentThreadProps {
    comment: Comment;
    currentUserId?: string;
    isReadOnly: boolean;
    replyTo: string | null;
    replyText: string;
    onReplyToChange: (id: string | null) => void;
    onReplyTextChange: (text: string) => void;
    onSubmitReply: () => void;
    onResolve: (id: string) => void;
    getInitials: (name: string) => string;
    getTimeAgo: (date: string) => string;
    submitting: boolean;
    replyInputRef: React.RefObject<HTMLTextAreaElement | null>;
    depth?: number;
}

const CommentThread: React.FC<CommentThreadProps> = ({
    comment,
    currentUserId,
    isReadOnly,
    replyTo,
    replyText,
    onReplyToChange,
    onReplyTextChange,
    onSubmitReply,
    onResolve,
    getInitials,
    getTimeAgo,
    submitting,
    replyInputRef,
    depth = 0
}) => {
    const [showMenu, setShowMenu] = useState(false);
    const maxDepth = 2;

    return (
        <div className={`${depth > 0 ? 'ml-8 pt-3 border-l-2 border-slate-200 dark:border-white/10 pl-4' : ''}`}>
            <div className={`group ${comment.is_resolved ? 'opacity-60' : ''}`}>
                <div className="flex gap-3">
                    <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-medium ${
                        comment.user_id === currentUserId ? 'bg-purple-500' : 'bg-slate-500'
                    }`}>
                        {getInitials(comment.author_name || 'User')}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-navy-900 dark:text-white">
                                {comment.author_name || 'Unknown User'}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                <Clock size={10} />
                                {getTimeAgo(comment.created_at)}
                            </span>
                            {comment.is_resolved && (
                                <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                                    <CheckCircle size={10} />
                                    Resolved
                                </span>
                            )}
                        </div>
                        
                        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                            {comment.comment}
                        </p>
                        
                        {/* Actions */}
                        <div className="mt-2 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!isReadOnly && depth < maxDepth && (
                                <button
                                    onClick={() => onReplyToChange(replyTo === comment.id ? null : comment.id)}
                                    className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400"
                                >
                                    <Reply size={12} />
                                    Reply
                                </button>
                            )}
                            
                            {!isReadOnly && !comment.is_resolved && (
                                <button
                                    onClick={() => onResolve(comment.id)}
                                    className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-green-600 dark:hover:text-green-400"
                                >
                                    <CheckCircle size={12} />
                                    Resolve
                                </button>
                            )}
                            
                            <button className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400">
                                <ThumbsUp size={12} />
                            </button>
                        </div>
                        
                        {/* Reply Input */}
                        {replyTo === comment.id && (
                            <div className="mt-3 flex gap-2">
                                <textarea
                                    ref={replyInputRef}
                                    value={replyText}
                                    onChange={(e) => onReplyTextChange(e.target.value)}
                                    placeholder="Write a reply..."
                                    rows={2}
                                    className="flex-1 px-3 py-2 text-sm border border-slate-200 dark:border-white/10 rounded-lg bg-white dark:bg-navy-800 text-navy-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                            onSubmitReply();
                                        }
                                        if (e.key === 'Escape') {
                                            onReplyToChange(null);
                                        }
                                    }}
                                />
                                <div className="flex flex-col gap-1">
                                    <button
                                        onClick={onSubmitReply}
                                        disabled={!replyText.trim() || submitting}
                                        className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                                    >
                                        <Send size={14} />
                                    </button>
                                    <button
                                        onClick={() => onReplyToChange(null)}
                                        className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Nested Replies */}
            {comment.replies && comment.replies.length > 0 && (
                <div className="space-y-3">
                    {comment.replies.map(reply => (
                        <CommentThread
                            key={reply.id}
                            comment={reply}
                            currentUserId={currentUserId}
                            isReadOnly={isReadOnly}
                            replyTo={replyTo}
                            replyText={replyText}
                            onReplyToChange={onReplyToChange}
                            onReplyTextChange={onReplyTextChange}
                            onSubmitReply={onSubmitReply}
                            onResolve={onResolve}
                            getInitials={getInitials}
                            getTimeAgo={getTimeAgo}
                            submitting={submitting}
                            replyInputRef={replyInputRef}
                            depth={depth + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default AxisCommentsPanel;

