import { get as dbGet } from '../utils/DbPromise.js';
import { buildCanvasTableSeed } from './canvasTableSeed.js';
import MetadataService from './tablePlatform/MetadataService.js';
import RecordsService from './tablePlatform/RecordsService.js';

export interface CanvasTableMaterializeResult {
  baseId: string;
  tableId: string;
  url: string;
  fieldCount: number;
  recordCount: number;
}

/**
 * Canonical Canvas → Table Studio writer shared by the direct bridge and the
 * governed proposal/approval flow.
 */
export async function materializeCanvasTable(input: {
  organizationId: string;
  actorUserId: string;
  sourceDraftId: string;
  title: string;
  contentMd: string;
}): Promise<CanvasTableMaterializeResult> {
  const seed = buildCanvasTableSeed(input.contentMd);
  if (!seed || seed.fields.length === 0) {
    throw Object.assign(new Error('No markdown table found in the Canvas draft'), {
      statusCode: 400,
      code: 'CANVAS_TABLE_EMPTY',
    });
  }

  const workspaceTarget = input.organizationId;
  const existingBase = await dbGet<{ id: string }>(
    `SELECT id FROM tp_bases
      WHERE organization_id = ? AND workspace_id = ? AND name = ?
      ORDER BY created_at DESC LIMIT 1`,
    [input.organizationId, workspaceTarget, 'Canvas Workspace'],
    { fallback: false }
  );
  let baseId = existingBase?.id || '';
  if (!baseId) {
    const newBase = await MetadataService.createBase(
      workspaceTarget,
      input.organizationId,
      'Canvas Workspace',
      input.actorUserId
    );
    baseId = String((newBase as any)?.id || '');
  }
  if (!baseId) throw new Error('Failed to bootstrap Canvas Workspace base');

  const newTable = await MetadataService.createTable(
    baseId,
    input.title,
    undefined,
    input.actorUserId
  );
  const tableId = String((newTable as any)?.id || '');
  if (!tableId) throw new Error('Failed to create Table Studio table');

  const existingNameSet = new Set(['name']);
  for (const field of seed.fields) {
    if (existingNameSet.has(field.name.toLowerCase())) continue;
    await MetadataService.createField(
      tableId,
      field.name,
      field.fieldType,
      field.options || {},
      input.actorUserId
    );
    existingNameSet.add(field.name.toLowerCase());
  }

  const primaryFieldName = seed.fields[0]?.name;
  for (const record of seed.records) {
    const payload: Record<string, unknown> = { ...record };
    if (primaryFieldName && record[primaryFieldName] !== undefined) {
      payload.Name = String(record[primaryFieldName]);
    }
    await RecordsService.createRecord(tableId, payload, input.actorUserId);
  }

  return {
    baseId,
    tableId,
    url: `/table-studio?baseId=${encodeURIComponent(baseId)}&tableId=${encodeURIComponent(tableId)}`,
    fieldCount: seed.fields.length,
    recordCount: seed.records.length,
  };
}
