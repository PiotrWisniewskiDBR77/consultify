/**
 * Document Studio — useDocumentInlineAI hook (R2).
 *
 * Drives the inline "zaznacz → popraw" flow:
 *   1. triggerAction  → createDocumentStudioLocalProposal (useLlm:true)
 *   2. approveProposal → approveDocumentStudioProposal → returns { schema }
 *   3. rejectProposal  → reset to idle (no server call needed)
 *
 * NOTE: the backend `proposals/local` endpoint accepts an optional
 * `selectedText` field for the inline "block" scope (R2 extension).
 * We cast the payload because the FE type predates this field.
 */

import { useCallback, useState } from 'react';

import { approveDocumentStudioProposal, createDocumentStudioLocalProposal } from '../api';
import type { DocumentSchema } from '../types';
import { INLINE_ACTIONS } from './inlineActionPrompts';

type InlineAIStatus = 'idle' | 'loading' | 'done' | 'error';

interface InlineAIState {
  status: InlineAIStatus;
  proposalId: string | null;
  errorMsg: string | null;
}

const INITIAL_STATE: InlineAIState = {
  status: 'idle',
  proposalId: null,
  errorMsg: null,
};

export interface UseDocumentInlineAIResult {
  status: InlineAIStatus;
  proposalId: string | null;
  errorMsg: string | null;
  triggerAction: (
    actionId: string,
    selectedText: string,
    sectionId: string,
    blockId: string,
    artifactId: string
  ) => Promise<void>;
  approveProposal: (
    artifactId: string,
    proposalId: string
  ) => Promise<{ schema: DocumentSchema } | null>;
  rejectProposal: () => void;
}

export function useDocumentInlineAI(): UseDocumentInlineAIResult {
  const [state, setState] = useState<InlineAIState>(INITIAL_STATE);

  const triggerAction = useCallback(
    async (
      actionId: string,
      selectedText: string,
      sectionId: string,
      blockId: string,
      artifactId: string
    ) => {
      const action = INLINE_ACTIONS.find((a) => a.id === actionId);
      if (!action) return;

      setState({ status: 'loading', proposalId: null, errorMsg: null });
      try {
        // Cast includes the R2-extended `selectedText` and `scope:'block'`
        // fields that the backend already accepts but the FE type predates.
        const proposal = await createDocumentStudioLocalProposal(
          artifactId,
          {
            sectionId,
            blockId,
            instruction: action.instruction,
            scope: 'local',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            selectedText,
          } as any,
          { useLlm: true }
        );
        setState({ status: 'done', proposalId: proposal.proposalId, errorMsg: null });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Nie udało się wywołać propozycji AI.';
        setState({ status: 'error', proposalId: null, errorMsg: msg });
      }
    },
    []
  );

  const approveProposal = useCallback(
    async (artifactId: string, proposalId: string): Promise<{ schema: DocumentSchema } | null> => {
      try {
        const result = await approveDocumentStudioProposal(artifactId, proposalId);
        setState(INITIAL_STATE);
        return { schema: result.schema };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Nie udało się zatwierdzić propozycji.';
        setState((prev) => ({ ...prev, status: 'error', errorMsg: msg }));
        return null;
      }
    },
    []
  );

  const rejectProposal = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  return {
    status: state.status,
    proposalId: state.proposalId,
    errorMsg: state.errorMsg,
    triggerAction,
    approveProposal,
    rejectProposal,
  };
}
