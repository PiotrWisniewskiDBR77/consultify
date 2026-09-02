/**
 * CommentsSection wrapper
 *
 * Wraps the existing shared CommentsSection component for the initiative context.
 */

import React from 'react';

import { Api } from '@/services/api';

import { CommentsSection as SharedCommentsSection } from '../../MyWork/shared';
import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

export const CommentsSection: React.FC<InitiativeSectionProps> = ({
  sectionType,
  expanded,
  onToggle,
}) => {
  const {
    initiativeId,
    comments,
    setComments,
    handleAddComment,
    handleGenerateAI,
    isGeneratingAI,
    currentUserId,
    isPolish,
  } = useInitiativeContext();

  return (
    <SharedCommentsSection
      comments={comments}
      onAddComment={async (content, parentId) => {
        // Initiative comments (context's handleAddComment) don't support
        // threaded replies — same contract TaskDetailView.handleAddComment
        // uses for the same limitation.
        if (parentId) {
          return { ok: false, error: new Error('Initiative comment replies are not supported') };
        }
        try {
          await handleAddComment(content);
          return { ok: true };
        } catch (error) {
          return { ok: false, error };
        }
      }}
      onDeleteComment={async (id) => {
        // Optimistic, best-effort: local state always updates; server
        // failure is swallowed (pre-existing behaviour, kept as-is).
        setComments((prev) => prev.filter((c) => c.id !== id));
        try {
          await Api.delete(`/initiatives/${initiativeId}/comments/${id}`);
        } catch {
          // best-effort
        }
        return { ok: true };
      }}
      onLikeComment={async (id) => {
        setComments((prev) =>
          prev.map((c) =>
            c.id === id
              ? {
                  ...c,
                  likes: c.likedByMe ? c.likes - 1 : c.likes + 1,
                  likedByMe: !c.likedByMe,
                }
              : c
          )
        );
        return { ok: true };
      }}
      onGenerateAIComment={() => handleGenerateAI('comments')}
      isGeneratingAI={isGeneratingAI === 'comments'}
      currentUserId={currentUserId}
      expanded={expanded}
      onToggleExpand={onToggle}
    />
  );
};
