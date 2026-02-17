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
      onAddComment={handleAddComment}
      onDeleteComment={async (id) => {
        setComments((prev) => prev.filter((c) => c.id !== id));
        try {
          await Api.delete(`/initiatives/${initiativeId}/comments/${id}`);
        } catch {
          // best-effort
        }
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
      }}
      onGenerateAIComment={() => handleGenerateAI('comments')}
      isGeneratingAI={isGeneratingAI === 'comments'}
      currentUserId={currentUserId}
      expanded={expanded}
      onToggleExpand={onToggle}
    />
  );
};
