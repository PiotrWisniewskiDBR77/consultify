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

export interface TablePlatformArtifactIdentity {
  tableId: string;
  workspaceId: string;
}

const unwrapApiData = (value: any): any => value?.data ?? value;

/**
 * Resolves both direct `tp_tables.id` values and artifact-registry ids without
 * losing the real table id. The older workspace-only helper could route an
 * artifact id as if it were a table id, producing a valid workspace URL whose
 * selected table did not exist.
 */
export async function resolveTablePlatformArtifactIdentity(
  candidateId: string
): Promise<TablePlatformArtifactIdentity | null> {
  try {
    const normalized = String(candidateId || '').trim();
    if (!normalized) return null;

    let tableId = normalized;
    let table: Record<string, unknown> | null = null;
    try {
      table = (await TablePlatformApi.getTable(tableId)) as Record<string, unknown>;
    } catch {
      const actionTargetRaw = await Api.get(
        `/artifacts/${encodeURIComponent(normalized)}/action-target`
      ).catch(() => null);
      const actionTarget = unwrapApiData(actionTargetRaw);
      const originRuntime = String(actionTarget?.originRuntime || '').trim().toLowerCase();
      const originRecordId = String(actionTarget?.originRecordId || '').trim();
      if (originRuntime !== 'sheet' || !originRecordId) return null;
      tableId = originRecordId;
      table = (await TablePlatformApi.getTable(tableId)) as Record<string, unknown>;
    }

    const baseId = String(table?.base_id ?? table?.baseId ?? '');
    if (!baseId) return null;
    const base = (await TablePlatformApi.getBase(baseId)) as Record<string, unknown>;
    const workspaceId = String(base.workspace_id ?? base.workspaceId ?? '');
    return workspaceId ? { tableId, workspaceId } : null;
  } catch {
    return null;
  }
}

/**
 * Returns the idea workspace id (`tp_bases.workspace_id`) that owns the table, or null.
 */
export async function resolveTablePlatformWorkspaceIdForTable(
  tableId: string
): Promise<string | null> {
  return (await resolveTablePlatformArtifactIdentity(tableId))?.workspaceId ?? null;
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
