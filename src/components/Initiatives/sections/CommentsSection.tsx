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
      onAddComment={async (content) => {
        // `handleAddComment` z kontekstu ma sygnature Promise<void> i jest
        // uzywany rowniez poza ta sekcja — opakowanie tutaj zamiast zmiany
        // kontraktu kontekstu, ktora dotknelaby wszystkich wolajacych.
        try {
          await handleAddComment(content);
          return { ok: true } as const;
        } catch (error) {
          return { ok: false, error } as const;
        }
      }}
      onDeleteComment={async (id) => {
        setComments((prev) => prev.filter((c) => c.id !== id));
        try {
          await Api.delete(`/initiatives/${initiativeId}/comments/${id}`);
          return { ok: true } as const;
        } catch (error) {
          // Bylo tu puste `catch { // best-effort }` — awaria kasowania na
          // serwerze nie docierala nigdzie. Kontrakt MutationResult istnieje
          // po to, zeby ja oddac wolajacemu.
          return { ok: false, error } as const;
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
        return { ok: true } as const;
      }}
      onGenerateAIComment={() => handleGenerateAI('comments')}
      isGeneratingAI={isGeneratingAI === 'comments'}
      currentUserId={currentUserId}
      expanded={expanded}
      onToggleExpand={onToggle}
    />
  );
};
