import { createHash } from 'node:crypto';

import * as queryHelpers from '../../utils/queryHelpers.js';
import { buildWorkbookBuffer } from './WorkbookBuilder.js';
import { assertWorkbookSchema } from './workbookSchemaGuard.js';
import type { WorkbookSchema } from './WorkbookSchema.js';

export interface CreateCanonicalWorkbookInput {
  workbookId: string;
  organizationId: string;
  userId: string;
  title: string;
  schema: WorkbookSchema;
  sourceIdentity: string;
  sourceHash: string;
  sourcePack?: unknown;
  evidenceRefs?: unknown;
}

export interface CanonicalWorkbookResult {
  workbookId: string;
  version: number;
  schema: WorkbookSchema;
  bytesHash: string;
  contentHash: string;
  replayed: boolean;
}

const digest = (value: unknown) =>
  createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');

/** Canonical, provider-free workbook creation command. The caller supplies a
 * stable owner identity; replay reads and verifies the existing owner row. */
export async function createCanonicalWorkbook(
  input: CreateCanonicalWorkbookInput
): Promise<CanonicalWorkbookResult> {
  await assertWorkbookSchema();
  if (!input.workbookId || !input.organizationId || !input.userId || !input.title.trim()) {
    throw new Error('workbook_create_scope_invalid');
  }
  const schema = { ...input.schema, title: input.title };
  const contentHash = digest({ schema, sourceIdentity: input.sourceIdentity, sourceHash: input.sourceHash });
  const existing = await queryHelpers.queryOne<{ schema_json: string; version: number; evidence_refs_json: string }>(
    `SELECT schema_json, COALESCE(version,0) version, evidence_refs_json
       FROM generated_workbooks WHERE id=? AND organization_id=?`,
    [input.workbookId, input.organizationId]
  );
  if (existing) {
    const refs = JSON.parse(existing.evidence_refs_json || '{}') as { contentHash?: string };
    if (refs.contentHash !== contentHash) throw new Error('workbook_create_identity_collision');
    const reopened = JSON.parse(existing.schema_json) as WorkbookSchema;
    const bytes = await buildWorkbookBuffer(reopened);
    return { workbookId: input.workbookId, version: Number(existing.version), schema: reopened,
      bytesHash: digest(bytes), contentHash, replayed: true };
  }
  const bytes = await buildWorkbookBuffer(schema);
  await queryHelpers.queryRun(
    `INSERT INTO generated_workbooks
      (id,organization_id,title,description,prompt,schema_json,sheet_count,file_name,file_size,
       validation_errors,quality_score,pipeline_log,action_contract_json,source_pack_json,
       evidence_refs_json,quality_report_json,created_by,created_at,version)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,0)`,
    [input.workbookId,input.organizationId,input.title,null,'chat-approved-owner-command',
      JSON.stringify(schema),schema.sheets.length,`${input.title.replace(/\s+/g,'_')}.xlsx`,bytes.length,
      null,null,'[]',JSON.stringify({command:'chat-target-mapping',version:'v1'}),
      JSON.stringify(input.sourcePack??{sourceIdentity:input.sourceIdentity,sourceHash:input.sourceHash}),
      JSON.stringify(input.evidenceRefs??{contentHash}),JSON.stringify({}),input.userId]
  );
  return { workbookId: input.workbookId, version: 0, schema, bytesHash: digest(bytes), contentHash, replayed:false };
}
