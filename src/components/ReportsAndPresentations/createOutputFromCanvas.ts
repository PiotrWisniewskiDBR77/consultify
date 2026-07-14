/**
 * createOutputFromCanvas — #83e "From canvas" wizard option (3rd path alongside
 * Blank/Template in OutputsLauncherModal's step 2).
 *
 * Thin client for the EXISTING Work Canvas → Outputs conversion endpoint:
 *   POST /work-canvas/drafts/:id/create-output   { outputType: 'report'|'presentation'|'table' }
 * (same endpoint WorkCanvasDocumentPanel's runOutputAction calls via
 * Api.workCanvasCreateOutput — server/src/routes/work-canvas.routes.ts).
 *
 * Implemented as a plain fetch (NOT via services/api.ts) to avoid pulling the
 * api.ts → @/i18n import chain into this directory's test env — the existing
 * OutputsLauncherModal.test.tsx mocks around exactly that chain (see its header
 * comment), and duplicateArtifactToDraft.ts in this same folder uses the same
 * raw-fetch + localStorage-token pattern for the same reason.
 */

import type { DeliverableType } from './OutputsLauncherModal';

export interface CanvasOutputResource {
  type: DeliverableType;
  id: string;
  title: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

function authToken(): string {
  return typeof window !== 'undefined' ? window.localStorage.getItem('token') || '' : '';
}

/**
 * Convert a Work Canvas draft into a real output artifact of `outputType`.
 * Throws with a user-facing message on failure (caller shows it inline).
 */
export async function createOutputFromCanvasDraft(
  draftId: string,
  outputType: DeliverableType
): Promise<CanvasOutputResource> {
  const id = String(draftId || '').trim();
  if (!id) throw new Error('Cannot create output: canvas has no draft id');

  const token = authToken();
  const response = await fetch(`/api/work-canvas/drafts/${encodeURIComponent(id)}/create-output`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ outputType }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String(json?.error || 'Failed to create the output from this canvas'));
  }
  // POST .../create-output → { success, data: { draft, outputResource, readBack } }
  const resource = json?.data?.outputResource || json?.outputResource || {};
  const resourceId = String(resource?.id || '').trim();
  if (!resourceId) {
    throw new Error('Canvas output was created but no id was returned');
  }
  return {
    type: outputType,
    id: resourceId,
    title: String(resource?.title || '').trim() || 'Untitled output',
    url: typeof resource?.url === 'string' ? resource.url : undefined,
    metadata:
      resource?.metadata && typeof resource.metadata === 'object' ? resource.metadata : undefined,
  };
}
