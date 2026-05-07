import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * `/ai/work-canvas` is a legacy standalone route (light/white UI).
 * The canonical product experience is the `/chat` split-layout with the Work Canvas panel.
 *
 * This redirect keeps deep-links working while ensuring users always land in the
 * canonical navy split UI.
 */
export function WorkCanvasRedirect() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const conversationId = String(params.get('conversationId') || '').trim();
  const draftId = String(params.get('draftId') || '').trim();
  const kind = String(params.get('kind') || '').trim();

  const targetParams = new URLSearchParams();
  targetParams.set('workPanel', '1');
  if (draftId) targetParams.set('canvasDraftId', draftId);
  if (kind) targetParams.set('canvasKind', kind);

  const targetPath = UUID_LIKE.test(conversationId) ? `/chat/${conversationId}` : '/chat';
  const search = targetParams.toString();

  return <Navigate to={`${targetPath}${search ? `?${search}` : ''}`} replace />;
}
