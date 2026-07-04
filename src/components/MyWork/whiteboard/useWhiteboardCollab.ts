/**
 * useWhiteboardCollab — M09 L-02: realtime graph sync for the whiteboard.
 *
 * DP-3 (T6): the implementation moved to the shared, tool-parametrised
 * `useIdeaCollab` (canvas/useIdeaCollab.ts) so the mind map and whiteboard
 * apply remote `graph_patch` operations identically (functional
 * setNodes/setEdges, `applyingRemoteRef` echo guard, no canvas remount).
 * This wrapper keeps the original whiteboard signature and behavior.
 */
import type { Edge, Node } from 'reactflow';

import { useIdeaCollab } from '../canvas/useIdeaCollab';

interface UseWhiteboardCollabArgs {
  ideaId?: string;
  currentUserId: string;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
}

export function useWhiteboardCollab({
  ideaId,
  currentUserId,
  setNodes,
  setEdges,
}: UseWhiteboardCollabArgs) {
  return useIdeaCollab({ ideaId, tool: 'whiteboard', currentUserId, setNodes, setEdges });
}

export default useWhiteboardCollab;
