import { createHash } from 'node:crypto';

import * as queryHelpers from '../../utils/queryHelpers.js';
import { createPinnedClientContext } from '../../utils/pinnedTransactionClient.js';
import type { PgTransactionClient } from '../../utils/queryHelpers.js';
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
  description?: string | null;
  prompt?: string | null;
  fileName?: string;
  validationErrors?: unknown;
  qualityScore?: number | null;
  pipelineLog?: unknown;
  actionContract?: unknown;
  qualityReport?: unknown;
  createdAt?: string;
  prebuiltBuffer?: Buffer;
}

export interface CanonicalWorkbookResult {
  workbookId: string;
  version: number;
  schema: WorkbookSchema;
  bytesHash: string;
  contentHash: string;
  replayed: boolean;
}

const workbookOwnerTransaction = createPinnedClientContext('workbook_owner');

export function withWorkbookOwnerClient<T>(
  client: PgTransactionClient,
  fn: () => Promise<T>
): Promise<T> {
  return workbookOwnerTransaction.withClient(client, fn);
}

async function workbookQueryOne<T>(sql: string, params: unknown[]): Promise<T | undefined> {
  const client = workbookOwnerTransaction.current();
  return client
    ? (await client.query<T>(sql, params)).rows[0]
    : (await queryHelpers.queryOne<T>(sql, params)) ?? undefined;
}

async function workbookQueryRun(sql: string, params: unknown[]) {
  const client = workbookOwnerTransaction.current();
  if (client) {
    const result = await client.query(sql, params);
    return { success: true, changes: result.rowCount ?? 0 };
  }
  return queryHelpers.queryRun(sql, params);
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
  const existing = await workbookQueryOne<{ organization_id:string; schema_json: string; version: number; evidence_refs_json: string; action_contract_json:string }>(
    `SELECT organization_id,schema_json, COALESCE(version,0) version, evidence_refs_json,action_contract_json
       FROM generated_workbooks WHERE id=?`,
    [input.workbookId]
  );
  if (existing) {
    if(existing.organization_id!==input.organizationId) throw new Error('workbook_create_identity_collision');
    const refs = JSON.parse(existing.evidence_refs_json || '{}') as { contentHash?: string };
    const contract = JSON.parse(existing.action_contract_json || '{}') as { ownerContentHash?: string };
    if ((contract.ownerContentHash??refs.contentHash) !== contentHash) throw new Error('workbook_create_identity_collision');
    const reopened = JSON.parse(existing.schema_json) as WorkbookSchema;
    const bytes = await buildWorkbookBuffer(reopened);
    return { workbookId: input.workbookId, version: Number(existing.version), schema: reopened,
      bytesHash: digest(bytes), contentHash, replayed: true };
  }
  const bytes = input.prebuiltBuffer ?? await buildWorkbookBuffer(schema);
  const inserted = await workbookQueryRun(
    `INSERT INTO generated_workbooks
      (id,organization_id,title,description,prompt,schema_json,sheet_count,file_name,file_size,
       validation_errors,quality_score,pipeline_log,action_contract_json,source_pack_json,
       evidence_refs_json,quality_report_json,created_by,created_at,version)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)`,
    [input.workbookId,input.organizationId,input.title,input.description??null,input.prompt??'canonical-owner-command',
      JSON.stringify(schema),schema.sheets.length,input.fileName??`${input.title.replace(/\s+/g,'_')}.xlsx`,bytes.length,
      input.validationErrors===undefined?null:JSON.stringify(input.validationErrors),input.qualityScore??null,JSON.stringify(input.pipelineLog??[]),JSON.stringify({
        ...(input.actionContract&&typeof input.actionContract==='object'?input.actionContract as Record<string,unknown>:{command:'canonical-workbook-create',version:'v1'}),
        ownerContentHash:contentHash,sourceIdentity:input.sourceIdentity,sourceHash:input.sourceHash,
      }),
      JSON.stringify(input.sourcePack??{sourceIdentity:input.sourceIdentity,sourceHash:input.sourceHash}),
      JSON.stringify(input.evidenceRefs??[]),JSON.stringify(input.qualityReport??{}),input.userId,
      input.createdAt??new Date().toISOString()]
  );
  if (inserted && typeof inserted === 'object' && 'changes' in inserted && inserted.changes === 0) {
    throw new Error('workbook_create_persist_failed');
  }
  return { workbookId: input.workbookId, version: 0, schema, bytesHash: digest(bytes), contentHash, replayed:false };
}
