/**
 * Governed sheet artifacts (originRuntime === 'sheet') use table-platform `tp_tables.id`
 * as their origin record. This module resolves a safe in-app deep link into the existing
 * Idea workspace Table tool when metadata-first mode is enabled; otherwise callers fall back
 * to XLSX export.
 */

import { Api } from '@/services/api';
import * as TablePlatformApi from '@/services/api/tablePlatform.api';

import { getV8SheetArtifactXlsxExportPath } from './artifactLinks';

export { buildMyWorkSheetTableOpenPath } from './artifactLinks';

/**
 * Returns the idea workspace id (`tp_bases.workspace_id`) that owns the table, or null.
 */
export async function resolveTablePlatformWorkspaceIdForTable(
  tableId: string
): Promise<string | null> {
  try {
    let resolvedTableId = tableId;
    let table: Record<string, unknown> | null = null;
    try {
      table = (await TablePlatformApi.getTable(resolvedTableId)) as Record<string, unknown>;
    } catch {
      let fromArtifact: string | null = null;
      try {
        const actionTargetRaw = await Api.get(
          `/artifacts/${encodeURIComponent(tableId)}/action-target`
        );
        const actionTarget = (actionTargetRaw as { data?: any })?.data ?? actionTargetRaw;
        const originRuntime = String(actionTarget?.originRuntime || '')
          .trim()
          .toLowerCase();
        const originRecordId = String(actionTarget?.originRecordId || '').trim();
        if (originRuntime === 'sheet' && originRecordId) {
          fromArtifact = originRecordId;
        }
      } catch {
        fromArtifact = null;
      }
      if (!fromArtifact) return null;
      resolvedTableId = fromArtifact;
      table = (await TablePlatformApi.getTable(resolvedTableId)) as Record<string, unknown>;
    }
    if (!table) return null;
    const baseId = String(table.base_id ?? table.baseId ?? '');
    if (!baseId) return null;
    const base = (await TablePlatformApi.getBase(baseId)) as Record<string, unknown>;
    const ws = String(base.workspace_id ?? base.workspaceId ?? '');
    return ws || null;
  } catch {
    return null;
  }
}

export async function downloadSheetArtifactXlsx(tableId: string): Promise<boolean> {
  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
    const path = getV8SheetArtifactXlsxExportPath(tableId);
    const res = await fetch(path, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) return false;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sheet-${tableId}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}
