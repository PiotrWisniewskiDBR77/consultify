import type { TFunction } from 'i18next';
import toast from 'react-hot-toast';

import {
  buildMyWorkSheetTableOpenPath,
  resolveTablePlatformWorkspaceIdForTable,
} from './sheetArtifactOpen';

export async function buildTableBuilderOpenPath(tableId: string): Promise<string | null> {
  const workspaceId = await resolveTablePlatformWorkspaceIdForTable(tableId);
  if (!workspaceId) return null;
  return buildMyWorkSheetTableOpenPath(workspaceId, tableId);
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
