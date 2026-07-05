/**
 * loadTabelePreview — shared helper that builds a fully-populated
 * `ArtifactPreview` (type: 'tabele') from a Table Platform `tableId`.
 *
 * Used by both:
 *  - `useKimiArtifactPipeline` (after a `materialize` step finishes), and
 *  - `TabeleView.loadReopenPreview` (when the user reopens an existing
 *    table via `?artifactId=`/Recent),
 *
 * to guarantee a single source of truth for what a Tabele preview looks
 * like (KPI strip + tableData rows/columns + schema fields + relations).
 *
 * The previous duplicated implementations diverged: the materialization
 * path forgot to set `tableData` and `kpiItems`, which made the canvas
 * render an empty grid right after a real materialization (T3 Phase B
 * blocker). This helper closes that gap.
 *
 * It is robust on partial failures: a record listing failure (e.g. RLS
 * race) does not throw — it simply returns an empty rows array so the
 * schema/relations sections can still render.
 */

import { Api } from '@/services/api';
import * as TablePlatformApi from '@/services/api/tablePlatform.api';

import type { ArtifactPreview } from '../KimiWorkspaceShell';

const PREVIEW_PAGE_SIZE = 200;

function unwrapData<T>(value: T | { data?: T }): T {
  if (value && typeof value === 'object' && 'data' in value) {
    const wrapped = value as { data?: T };
    if (wrapped.data !== undefined) return wrapped.data;
  }
  return value as T;
}

function normalizeRecords(recordsResult: any): Array<Record<string, unknown>> {
  const records = Array.isArray(recordsResult?.records)
    ? recordsResult.records
    : Array.isArray(recordsResult)
      ? recordsResult
      : [];
  return records.map((record: any) => {
    const data = record?.data ?? record ?? {};
    const id = record?.id ?? record?.recordId;
    return id !== undefined ? { id, ...data } : data;
  });
}

function normalizeColumns(tableInfo: any, rows: Array<Record<string, unknown>>): string[] {
  const fields = Array.isArray(tableInfo?.fields) ? tableInfo.fields : [];
  const fromFields = fields
    .map((field: any) => String(field?.name ?? '').trim())
    .filter((name: string) => name.length > 0);
  if (fromFields.length > 0) return fromFields;

  const firstRow = rows[0] || {};
  return Object.keys(firstRow).filter((key) => !['id', 'created_at', 'updated_at'].includes(key));
}

export interface ResolveAccessibleTableIdOptions {
  /**
   * URL params named `artifactId` should be resolved through the registry first.
   * This avoids a misleading `/table-platform/tables/{artifactId}` 404 before
   * the real artifact -> table mapping is checked.
   */
  preferArtifactRegistry?: boolean;
}

async function resolveTableIdFromArtifactRegistry(candidateId: string): Promise<string | null> {
  const normalized = String(candidateId || '').trim();
  if (!normalized) return null;

  try {
    const actionTargetRaw = await Api.get(
      `/artifacts/${encodeURIComponent(normalized)}/action-target`
    );
    const actionTarget = unwrapData<any>(actionTargetRaw);
    const originRuntime = String(actionTarget?.originRuntime || '')
      .trim()
      .toLowerCase();
    const originRecordId = String(actionTarget?.originRecordId || '').trim();
    return originRuntime === 'sheet' && originRecordId ? originRecordId : null;
  } catch {
    return null;
  }
}

async function resolveDirectTableId(candidateId: string): Promise<string | null> {
  const normalized = String(candidateId || '').trim();
  if (!normalized) return null;
  try {
    await TablePlatformApi.getTable(normalized);
    return normalized;
  } catch {
    return null;
  }
}

export async function resolveAccessibleTableId(
  candidateId: string,
  options: ResolveAccessibleTableIdOptions = {}
): Promise<string | null> {
  const normalized = String(candidateId || '').trim();
  if (!normalized) return null;

  const first = options.preferArtifactRegistry
    ? await resolveTableIdFromArtifactRegistry(normalized)
    : await resolveDirectTableId(normalized);
  if (first) return first;

  const fallback = options.preferArtifactRegistry
    ? await resolveDirectTableId(normalized)
    : await resolveTableIdFromArtifactRegistry(normalized);
  if (!fallback || fallback === normalized) return fallback;

  return resolveDirectTableId(fallback);
}

export interface LoadTabelePreviewOptions {
  /** Title used when the table has no `name` set yet. */
  titleFallback: string;
  /** Workspace id used to fetch pending schema proposals. */
  workspaceIdForProposals?: string;
}

/**
 * Build a fully-populated `tabele` preview from a `tableId`. Returns null
 * if the table cannot be fetched at all (caller should render a recovery
 * state).
 */
export async function loadTabelePreviewByTableId(
  tableId: string,
  options: LoadTabelePreviewOptions
): Promise<(ArtifactPreview & { type: 'tabele' }) | null> {
  let tableInfoRaw: unknown = null;
  try {
    tableInfoRaw = await TablePlatformApi.getTable(tableId);
  } catch {
    return null;
  }

  const recordsResult = await TablePlatformApi.listRecords(tableId, {
    pageSize: PREVIEW_PAGE_SIZE,
  }).catch(() => null as any);

  const proposalsResult = options.workspaceIdForProposals
    ? await TablePlatformApi.listSchemaProposals(options.workspaceIdForProposals, 'pending').catch(
        () => [] as Awaited<ReturnType<typeof TablePlatformApi.listSchemaProposals>>
      )
    : ([] as Awaited<ReturnType<typeof TablePlatformApi.listSchemaProposals>>);

  const tableInfo = unwrapData<any>(tableInfoRaw);
  const fields = Array.isArray(tableInfo?.fields) ? tableInfo.fields : [];
  const rows = normalizeRecords(recordsResult);
  const columns = normalizeColumns(tableInfo, rows);
  const totalRows = typeof recordsResult?.total === 'number' ? recordsResult.total : rows.length;
  const title = String(tableInfo?.name || tableInfo?.title || options.titleFallback);

  const proposalByFieldId = new Map<string, string>();
  for (const proposal of Array.isArray(proposalsResult) ? proposalsResult : []) {
    const targetFieldId = (proposal as any)?.targetFieldId;
    const proposalId = (proposal as any)?.id;
    if (typeof targetFieldId === 'string' && typeof proposalId === 'string') {
      proposalByFieldId.set(targetFieldId, proposalId);
    }
  }

  const tabeleSchemaFields = fields.map((field: any) => {
    const fieldId = String(field?.id ?? field?.fieldId ?? '');
    const proposalId = proposalByFieldId.get(fieldId);
    // Surface the field's own description/help text when present so the schema
    // block caption reflects THIS field rather than a shared boilerplate string
    // (HOTFIX #62 UI-M6).
    const rawDescription = String(
      field?.description ?? field?.helpText ?? field?.help_text ?? ''
    ).trim();
    return {
      fieldId,
      name: String(field?.name ?? ''),
      fieldType: String(field?.type ?? field?.fieldType ?? 'text'),
      ...(rawDescription ? { description: rawDescription } : {}),
      governanceState: proposalId ? ('proposed' as const) : ('committed' as const),
      ...(proposalId ? { proposalId } : {}),
    };
  });

  const tabeleRelations = fields
    .filter((field: any) => (field?.type ?? field?.fieldType) === 'relation')
    .map((field: any) => ({
      fieldId: String(field?.id ?? field?.fieldId ?? ''),
      fieldName: String(field?.name ?? ''),
      targetTableId: String(field?.targetTableId ?? field?.relation?.targetTableId ?? ''),
      targetTableName: String(field?.targetTableName ?? field?.relation?.targetTableName ?? ''),
      targetCount: Number(field?.targetCount ?? 0),
    }));

  return {
    type: 'tabele',
    title,
    fileName: `${title.replace(/\s+/g, '_')}.csv`,
    summary: `Operational table "${title}" — ${totalRows} rows, ${columns.length} columns.`,
    kpiItems: [
      { label: 'Rows', value: String(totalRows) },
      { label: 'Columns', value: String(columns.length) },
      { label: 'Status', value: 'Committed' },
      { label: 'Format', value: 'Table / CSV' },
    ],
    tableId,
    tableData: { columns, rows },
    tabeleSchemaFields,
    tabeleRelations,
    tabeleRationale: {
      summary:
        tabeleRelations.length > 0
          ? 'Relations are available for explainability review.'
          : 'No relation fields detected yet.',
      bullets: [],
      citedSourceIds: [],
      proposalStatus: 'none',
    },
  };
}
