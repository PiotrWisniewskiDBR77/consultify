import type { TFunction } from 'i18next';
import toast from 'react-hot-toast';

import { Api } from '@/services/api';

import { getArtifactPath } from './artifactLinks';
import {
  buildMyWorkSheetTableOpenPath,
  resolveTablePlatformWorkspaceIdForTable,
} from './sheetArtifactOpen';

/**
 * Z125/Z126 — route a table's "open/edit" click to the surface that actually owns it.
 *
 * The `/my-work/sheets/:workspaceId/...` deep link only resolves when `workspaceId`
 * is a real My Work idea. Materials / Table-Studio sheets carry
 * `tp_bases.workspace_id = organization_id` (no idea record), so that path 404s
 * ("Idea not found"). We probe `getMyIdea(workspaceId)`: if an idea exists the table
 * is idea-backed and keeps the My Work path (unchanged — zero regression); otherwise
 * it is a Materials sheet and opens on the `/tabele` surface instead.
 */
async function isIdeaBackedWorkspace(workspaceId: string): Promise<boolean> {
  try {
    const idea = await Api.getMyIdea(workspaceId);
    return Boolean(idea);
  } catch {
    return false;
  }
}

export async function buildTableBuilderOpenPath(tableId: string): Promise<string | null> {
  const workspaceId = await resolveTablePlatformWorkspaceIdForTable(tableId);
  if (!workspaceId) return null;
  if (await isIdeaBackedWorkspace(workspaceId)) {
    return buildMyWorkSheetTableOpenPath(workspaceId, tableId);
  }
  // Materials sheet → open on the Tabele surface (was: unconditional My Work → 404).
  return getArtifactPath('sheet', tableId);
}

export async function openTableBuilderInNewTab(tableId: string, t: TFunction): Promise<boolean> {
  const path = await buildTableBuilderOpenPath(tableId);
  if (!path) {
    toast.error(t('tabele.builderUnreachable', 'Could not resolve workspace for this table'));
    return false;
  }

  toast.success(t('tabele.openingBuilder', 'Opening Table Builder...'), { duration: 2000 });
  window.open(path, '_blank', 'noopener,noreferrer');
  return true;
}

export async function downloadTabeleArtifactCsv(tableId: string): Promise<boolean> {
  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
    const res = await fetch(
      `/api/table-platform/tables/${encodeURIComponent(tableId)}/export.csv`,
      {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      }
    );
    if (!res.ok) return false;

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `table-${tableId}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}
