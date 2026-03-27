/**
 * IdeasMindMap
 *
 * Deprecated compatibility shim. The old standalone ideas mind map is no longer
 * part of the live Idea workspace authority; callers are redirected to the
 * canonical My Work ideas lane.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/routes/routeConfig';

import type { MyIdea } from './MyIdeasListContent';

interface IdeasMindMapProps {
  ideas: MyIdea[];
  onIdeaClick?: (ideaId: string, ideaData?: MyIdea) => void;
  onCreateIdea?: () => void;
  isPolish?: boolean;
}

export const IdeasMindMap: React.FC<IdeasMindMapProps> = () => {
  const navigate = useNavigate();

  React.useEffect(() => {
    navigate(`${ROUTES.MY_WORK}/ideas`, { replace: true });
  }, [navigate]);

  return null;
};

export default IdeasMindMap;
