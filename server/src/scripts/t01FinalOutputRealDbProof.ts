import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { Pool } from 'pg';

import { adaptQuery } from '../database/PostgresDatabase.js';
import { seedT01FinalOutputFixture } from './fixtures/t01FinalOutputFixture.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const pool = new Pool({ connectionString: databaseUrl });
const proofDb = {
  get(
    text: string,
    params: unknown[] = [],
    callback?: (error: Error | null, row: unknown) => void
  ) {
    const promise = pool.query(adaptQuery(text), params).then((result) => result.rows[0] ?? null);
    if (callback)
      void promise.then(
        (row) => callback(null, row),
        (error) => callback(error as Error, null)
      );
    return proofDb;
  },
  all(
    text: string,
    params: unknown[] = [],
    callback?: (error: Error | null, rows: unknown[]) => void
  ) {
    const promise = pool.query(adaptQuery(text), params).then((result) => result.rows);
    if (callback)
      void promise.then(
        (rows) => callback(null, rows),
        (error) => callback(error as Error, [])
      );
    return proofDb;
  },
  run(text: string, params: unknown[] = [], callback?: (error: Error | null) => void) {
    const promise = pool
      .query(adaptQuery(text), params)
      .then((result) => ({ changes: result.rowCount ?? 0 }));
    if (callback)
      void promise.then(
        (result) => callback.call(result, null),
        (error) => callback.call({ changes: 0 }, error as Error)
      );
    return proofDb;
  },
  exec: (text: string) => pool.query(text).then(() => undefined),
  serialize: (callback: () => void) => callback(),
  close: () => Promise.resolve(),
};

/**
 * Key order differs between the fresh-generation return value and the A06
 * canonical readback, so native references are compared by value, not by
 * incidental JSON key order.
 */
const canonicalNative = (value: unknown): string =>
  JSON.stringify(
    Object.fromEntries(
      Object.entries((value ?? {}) as Record<string, unknown>).sort(([a], [b]) =>
        a.localeCompare(b)
      )
    )
  );

/**
 * U02-A owner schema.
 *
 * The T01 proof deliberately builds a minimal schema instead of running every
 * global migration, so the Report Builder / Presentation / Artifact Registry
 * owner tables are declared here with exactly the columns the native
 * final-output path touches. The U02 manifest migration itself is applied from
 * its real file so the proof exercises the shipped DDL, not a copy of it.
 */
async function bootstrapU02OwnerSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS report_builder_reports (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      project_id TEXT,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      source_name TEXT,
      source_framework TEXT,
      title TEXT NOT NULL,
      description TEXT,
      report_type TEXT NOT NULL,
      template_id TEXT,
      config_json TEXT,
      company_context_json TEXT,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      generated_at TIMESTAMPTZ,
      version INTEGER DEFAULT 1,
      source_refs_json TEXT
    );
    CREATE TABLE IF NOT EXISTS report_builder_sections (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL REFERENCES report_builder_reports(id) ON DELETE CASCADE,
      section_key TEXT NOT NULL,
      section_type TEXT NOT NULL,
      title TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      enabled BOOLEAN DEFAULT TRUE,
      required BOOLEAN DEFAULT FALSE,
      length TEXT DEFAULT 'medium',
      language TEXT DEFAULT 'business',
      content_format TEXT DEFAULT 'markdown',
      generated_content TEXT,
      edited_content TEXT,
      generated_at TIMESTAMPTZ,
      render_kind TEXT,
      source_refs_json TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_rb_sections UNIQUE (report_id, section_key)
    );
    CREATE TABLE IF NOT EXISTS report_builder_versions (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      snapshot_json TEXT NOT NULL,
      change_summary TEXT,
      change_type TEXT,
      previous_status TEXT,
      new_status TEXT,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS presentation_decks (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      project_id TEXT,
      title TEXT NOT NULL,
      template_id TEXT NOT NULL DEFAULT 'default',
      deck_type TEXT,
      audience TEXT,
      goal TEXT,
      language TEXT DEFAULT 'en',
      confidentiality TEXT DEFAULT 'internal',
      theme TEXT DEFAULT 'corporate',
      source_artifacts TEXT,
      outline_json TEXT,
      deck_json TEXT,
      unified_json TEXT,
      slide_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'draft'
        CHECK (status IN ('draft','generating','ready','exported','failed')),
      version INTEGER NOT NULL DEFAULT 1,
      validation_warnings TEXT,
      export_path TEXT,
      export_format TEXT,
      exported_at TIMESTAMPTZ,
      exported_version INTEGER,
      generated_by TEXT,
      source_type TEXT,
      source_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS presentation_deck_versions (
      id TEXT PRIMARY KEY,
      deck_id TEXT NOT NULL REFERENCES presentation_decks(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      deck_json_snapshot TEXT NOT NULL,
      slide_count INTEGER DEFAULT 0,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS v8_output_artifacts (
      artifact_id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      output_type TEXT NOT NULL,
      artifact_family TEXT,
      delivery_state TEXT NOT NULL DEFAULT 'draft',
      title_snapshot TEXT,
      owner_user_id TEXT,
      canonical_home TEXT,
      visibility_scope TEXT,
      project_id TEXT,
      context_snapshot_id TEXT,
      execution_run_id TEXT,
      template_family_ref TEXT,
      source_initiative_id TEXT,
      ai_governance_preset_ref TEXT,
      origin_summary_json TEXT,
      is_draft INTEGER NOT NULL DEFAULT 0,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_transition_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS v8_artifact_origin_links (
      link_id TEXT PRIMARY KEY,
      artifact_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      origin_runtime TEXT NOT NULL,
      origin_record_id TEXT NOT NULL,
      is_primary_origin INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_v81_origin_unique
      ON v8_artifact_origin_links(organization_id, origin_runtime, origin_record_id);
  `);
  await pool.query(
    fs.readFileSync(
      path.resolve(process.cwd(), 'server/migrations/20260810_t01_u02_native_final_outputs.sql'),
      'utf8'
    )
  );
}

async function main() {
  await seedT01FinalOutputFixture(pool);
  await bootstrapU02OwnerSchema();
  (globalThis as Record<string, unknown>).__CONSULTIFY_GLOBAL_DB_INSTANCE__ = proofDb;
  (process as unknown as Record<string, unknown>).__CONSULTIFY_GLOBAL_DB_INSTANCE__ = proofDb;
  const {
    coldReopenNativeFinalReport,
    generateFinalOutputs,
    getLatestFinalOutputRun,
    prepareFinalOutputPublication,
  } = await import('../services/v8/transformationFinalOutputService.js');
  const { registerRuntimeCapability, reportRuntimeEvidence } =
    await import('../services/v8/transformationRuntimeCapabilityService.js');
  const { reviewProposalScope, requestProposalRevision } =
    await import('../services/v8/agentProposalGovernanceService.js');
  const params = {
    transformationCaseId: 'tc-t01-i03',
    organizationId: 'org-t01-i03',
    actorUserId: 'user-t01-actor',
    correlationId: 't01-final-output-realdb-proof',
  };
  let preApprovalCode = '';
  try {
    await generateFinalOutputs(params);
  } catch (error) {
    preApprovalCode = String((error as { code?: string }).code || '');
  }
  const preApprovalCounts = (
    await pool.query(`SELECT
      (SELECT COUNT(*)::int FROM transformation_final_output_runs) manifests,
      (SELECT COUNT(*)::int FROM transformation_case_artifact_links WHERE lifecycle_stage='final_outputs') links,
      (SELECT COUNT(*)::int FROM transformation_case_audit_events WHERE event_type='transformation_final_outputs.generated') audits`)
  ).rows[0];
  if (
    preApprovalCode !== 'TRANSFORMATION_FINAL_OUTPUT_PUBLICATION_NOT_APPROVED' ||
    preApprovalCounts.manifests !== 0 ||
    preApprovalCounts.links !== 0 ||
    preApprovalCounts.audits !== 0
  )
    throw new Error(
      `Pre-approval publication was not fail-closed: ${JSON.stringify({ preApprovalCode, preApprovalCounts })}`
    );
  const publication = await prepareFinalOutputPublication(params);
  let unauthorizedCode = '';
  try {
    await reviewProposalScope({
      proposalVersionId: publication.proposalVersionId,
      organizationId: params.organizationId,
      scopeKey: publication.scopeKey,
      decision: 'approved',
      reason: 'Unauthorized publication attempt',
      actorUserId: 'user-t01-stakeholder',
    });
  } catch (error) {
    unauthorizedCode = String(error);
  }
  if (!/proposal_reviewer_not_authorized/.test(unauthorizedCode))
    throw new Error('Final output unauthorized review was not denied');
  await reviewProposalScope({
    proposalVersionId: publication.proposalVersionId,
    organizationId: params.organizationId,
    scopeKey: publication.scopeKey,
    decision: 'approved',
    reason: 'Exact final-output facts approved for publication',
    actorUserId: params.actorUserId,
  });
  await pool.query(
    `UPDATE v8_tool_catalog SET classification_status='under_review'
      WHERE organization_id=$1 AND name='transformation.final_outputs.publish'`,
    [params.organizationId]
  );
  let a06DeniedBeforePublication = '';
  try {
    await generateFinalOutputs(params);
  } catch (error) {
    a06DeniedBeforePublication = String((error as Error).message);
  }
  const a06DeniedCounts = (
    await pool.query(`SELECT
      (SELECT COUNT(*)::int FROM transformation_final_output_runs) manifests,
      (SELECT COUNT(*)::int FROM transformation_case_artifact_links WHERE lifecycle_stage='final_outputs') links,
      (SELECT COUNT(*)::int FROM transformation_case_audit_events WHERE event_type='transformation_final_outputs.generated') audits,
      (SELECT COUNT(*)::int FROM v8_agent_adapter_invocations WHERE adapter_key='transformation.final_outputs.publish') invocations`)
  ).rows[0];
  if (
    !/adapter_governance_denied:tool_not_ratified/.test(a06DeniedBeforePublication) ||
    a06DeniedCounts.manifests !== 0 ||
    a06DeniedCounts.links !== 0 ||
    a06DeniedCounts.audits !== 0 ||
    a06DeniedCounts.invocations !== 0
  )
    throw new Error(
      `A06 denial produced publication side effects: ${JSON.stringify({ a06DeniedBeforePublication, a06DeniedCounts })}`
    );
  await pool.query(
    `UPDATE v8_tool_catalog SET classification_status='ratified'
      WHERE organization_id=$1 AND name='transformation.final_outputs.publish'`,
    [params.organizationId]
  );
  const first = await generateFinalOutputs(params);
  const replay = await generateFinalOutputs(params);
  const latest = await getLatestFinalOutputRun(params.transformationCaseId, params.organizationId);
  const crossTenantRead = await getLatestFinalOutputRun(params.transformationCaseId, 'org-other');
  let crossTenantGenerateCode = '';
  try {
    await generateFinalOutputs({ ...params, organizationId: 'org-other' });
  } catch (error) {
    crossTenantGenerateCode = String((error as { code?: string }).code || '');
  }
  const counts = (
    await pool.query(`SELECT
      (SELECT COUNT(*)::int FROM transformation_final_output_runs) manifests,
      (SELECT COUNT(*)::int FROM transformation_case_artifact_links WHERE lifecycle_stage='final_outputs') links,
      (SELECT COUNT(*)::int FROM transformation_case_audit_events WHERE event_type='transformation_final_outputs.generated') audits`)
  ).rows[0];
  if (!latest || first.runId !== replay.runId || first.idempotentReplay || !replay.idempotentReplay)
    throw new Error('Final output idempotency proof failed');
  if (crossTenantRead !== null || crossTenantGenerateCode !== 'TRANSFORMATION_CASE_NOT_FOUND')
    throw new Error('Final output tenant isolation proof failed');
  const [docxBytes, pptxBytes] = await Promise.all([
    readFile(first.docxPath),
    readFile(first.pptxPath),
  ]);
  const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
  if (sha256(docxBytes) !== first.docxSha256 || sha256(pptxBytes) !== first.pptxSha256)
    throw new Error('Final output file hash readback failed');
  const coldReport = await coldReopenNativeFinalReport(
    params.transformationCaseId,
    params.organizationId
  );
  if (!coldReport || coldReport.run.runId !== first.runId || !coldReport.binary.verified)
    throw new Error('AGT-003 cold native report reopen failed');
  const mammoth = await import('mammoth');
  const parsedDocx = await mammoth.extractRawText({ buffer: docxBytes });
  const ownerNarrative = coldReport.report.sections.map((section) => section.content).join('\n');
  if (
    !parsedDocx.value.includes(coldReport.report.title) ||
    !parsedDocx.value.includes('Skrócić') ||
    !ownerNarrative.includes('Skrócić')
  )
    throw new Error('AGT-003 generated DOCX does not reopen with owner narrative content');
  // U02-A links: run + native report + report version + deck + deck version + both export hashes.
  if (counts.manifests !== 1 || counts.links !== 7 || counts.audits !== 1)
    throw new Error(`Final output persistence proof failed: ${JSON.stringify(counts)}`);

  // ── U02-A: native owner artifacts, immutable versions and registry receipts ──
  const native = first.native;
  const replayNative = replay.native;
  if (!native || !replayNative)
    throw new Error('U02 native artifact references missing from manifest');
  if (canonicalNative(native) !== canonicalNative(replayNative))
    throw new Error(
      `U02 replay returned different native versions: ${JSON.stringify({ native, replayNative })}`
    );

  const nativeReadback = (
    await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM report_builder_reports) reports,
         (SELECT COUNT(*)::int FROM report_builder_versions) report_versions,
         (SELECT COUNT(*)::int FROM presentation_decks) decks,
         (SELECT COUNT(*)::int FROM presentation_deck_versions) deck_versions,
         (SELECT COUNT(*)::int FROM v8_output_artifacts) registry_artifacts,
         (SELECT COUNT(*)::int FROM v8_artifact_origin_links) registry_links,
         (SELECT COUNT(*)::int FROM report_builder_sections WHERE report_id=$1) report_sections,
         (SELECT organization_id FROM report_builder_reports WHERE id=$1) report_org,
         (SELECT source_type FROM report_builder_reports WHERE id=$1) report_source_type,
         (SELECT source_id FROM report_builder_reports WHERE id=$1) report_source_id,
         (SELECT status FROM report_builder_reports WHERE id=$1) report_status,
         (SELECT version_number FROM report_builder_versions WHERE id=$2) report_version_number,
         (SELECT organization_id FROM presentation_decks WHERE id=$3) deck_org,
         (SELECT slide_count FROM presentation_decks WHERE id=$3) deck_slides,
         (SELECT status FROM presentation_decks WHERE id=$3) deck_status,
         (SELECT version FROM presentation_deck_versions WHERE id=$4) deck_version_number`,
      [native.reportId, native.reportVersionId, native.deckId, native.deckVersionId]
    )
  ).rows[0];
  if (
    nativeReadback.reports !== 1 ||
    nativeReadback.report_versions !== 1 ||
    nativeReadback.decks !== 1 ||
    nativeReadback.deck_versions !== 1 ||
    nativeReadback.registry_artifacts !== 2 ||
    nativeReadback.registry_links !== 2 ||
    nativeReadback.report_sections < 1 ||
    nativeReadback.report_org !== params.organizationId ||
    nativeReadback.report_source_type !== 'TRANSFORMATION_CASE' ||
    nativeReadback.report_source_id !== params.transformationCaseId ||
    nativeReadback.report_status !== 'APPROVED' ||
    Number(nativeReadback.report_version_number) !== native.reportVersionNumber ||
    nativeReadback.deck_org !== params.organizationId ||
    Number(nativeReadback.deck_slides) < 1 ||
    nativeReadback.deck_status !== 'ready' ||
    Number(nativeReadback.deck_version_number) !== native.deckVersionNumber
  )
    throw new Error(`U02 native owner readback failed: ${JSON.stringify(nativeReadback)}`);

  // Both native artifacts must carry the SAME facts digest, Case, run and lineage.
  const sharedLineage = (
    await pool.query(
      `SELECT
         (SELECT config_json FROM report_builder_reports WHERE id=$1) report_config,
         (SELECT origin_summary_json FROM v8_output_artifacts WHERE artifact_id=$2) report_origin,
         (SELECT origin_summary_json FROM v8_output_artifacts WHERE artifact_id=$3) deck_origin`,
      [native.reportId, native.reportRegistryArtifactId, native.deckRegistryArtifactId]
    )
  ).rows[0];
  const reportLineage = JSON.parse(String(sharedLineage.report_origin));
  const deckLineage = JSON.parse(String(sharedLineage.deck_origin));
  const reportConfig = JSON.parse(String(sharedLineage.report_config));
  if (
    reportLineage.factsDigest !== first.factsDigest ||
    deckLineage.factsDigest !== first.factsDigest ||
    reportConfig.factsDigest !== first.factsDigest ||
    reportLineage.transformationCaseId !== params.transformationCaseId ||
    deckLineage.transformationCaseId !== params.transformationCaseId ||
    reportLineage.lineageId !== deckLineage.lineageId ||
    reportLineage.canonicalRunId !== deckLineage.canonicalRunId ||
    reportLineage.planVersion !== deckLineage.planVersion ||
    reportLineage.agentId !== 'consultify:teresa:transformation-agent' ||
    deckLineage.actorUserId !== params.actorUserId
  )
    throw new Error(
      `U02 shared facts/lineage binding failed: ${JSON.stringify({ reportLineage, deckLineage })}`
    );

  // Concurrent same-key requests must not fork the native artifacts.
  const concurrent = await Promise.all([
    generateFinalOutputs(params),
    generateFinalOutputs(params),
    generateFinalOutputs(params),
  ]);
  const concurrentCounts = (
    await pool.query(`SELECT
      (SELECT COUNT(*)::int FROM transformation_final_output_runs) manifests,
      (SELECT COUNT(*)::int FROM report_builder_reports) reports,
      (SELECT COUNT(*)::int FROM report_builder_versions) report_versions,
      (SELECT COUNT(*)::int FROM presentation_decks) decks,
      (SELECT COUNT(*)::int FROM presentation_deck_versions) deck_versions,
      (SELECT COUNT(*)::int FROM v8_output_artifacts) registry_artifacts,
      (SELECT COUNT(*)::int FROM v8_agent_adapter_invocations WHERE adapter_key='transformation.final_outputs.publish') invocations`)
  ).rows[0];
  if (
    concurrent.some(
      (run) =>
        run.runId !== first.runId ||
        canonicalNative(run.native) !== canonicalNative(native) ||
        run.docxSha256 !== first.docxSha256 ||
        run.pptxSha256 !== first.pptxSha256
    ) ||
    concurrentCounts.manifests !== 1 ||
    concurrentCounts.reports !== 1 ||
    concurrentCounts.report_versions !== 1 ||
    concurrentCounts.decks !== 1 ||
    concurrentCounts.deck_versions !== 1 ||
    concurrentCounts.registry_artifacts !== 2 ||
    concurrentCounts.invocations !== 1
  )
    throw new Error(
      `U02 concurrent same-key proof failed: ${JSON.stringify({ concurrentCounts })}`
    );

  // Cross-tenant reads of the native owner rows must find nothing.
  const crossTenantNative = (
    await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM report_builder_reports WHERE id=$1 AND organization_id='org-other') reports,
         (SELECT COUNT(*)::int FROM presentation_decks WHERE id=$2 AND organization_id='org-other') decks,
         (SELECT COUNT(*)::int FROM v8_output_artifacts WHERE artifact_id IN ($3,$4) AND organization_id='org-other') registry`,
      [
        native.reportId,
        native.deckId,
        native.reportRegistryArtifactId,
        native.deckRegistryArtifactId,
      ]
    )
  ).rows[0];
  if (
    crossTenantNative.reports !== 0 ||
    crossTenantNative.decks !== 0 ||
    crossTenantNative.registry !== 0
  )
    throw new Error(`U02 native tenant isolation failed: ${JSON.stringify(crossTenantNative)}`);

  // A native narrative edit must not touch the facts snapshot or the deck.
  const deckJsonBeforeEdit = (
    await pool.query(`SELECT deck_json FROM presentation_decks WHERE id=$1`, [native.deckId])
  ).rows[0].deck_json;
  const factsBeforeEdit = (
    await pool.query(
      `SELECT facts_digest,facts_json FROM transformation_final_output_runs WHERE run_id=$1`,
      [first.runId]
    )
  ).rows[0];
  await pool.query(
    `UPDATE report_builder_sections SET edited_content=$2,updated_at=NOW()
      WHERE report_id=$1 AND order_index=0`,
    [native.reportId, 'Zredagowane podsumowanie zarządcze.']
  );
  const afterEdit = (
    await pool.query(
      `SELECT
         (SELECT deck_json FROM presentation_decks WHERE id=$1) deck_json,
         (SELECT facts_digest FROM transformation_final_output_runs WHERE run_id=$2) facts_digest,
         (SELECT snapshot_json FROM report_builder_versions WHERE id=$3) version_snapshot`,
      [native.deckId, first.runId, native.reportVersionId]
    )
  ).rows[0];
  if (
    String(afterEdit.deck_json) !== String(deckJsonBeforeEdit) ||
    afterEdit.facts_digest !== factsBeforeEdit.facts_digest ||
    String(afterEdit.version_snapshot).includes('Zredagowane podsumowanie zarządcze.')
  )
    throw new Error(
      'U02 native edit leaked into canonical facts, the immutable version or the deck'
    );
  await pool.query(
    `UPDATE report_builder_sections SET edited_content=NULL WHERE report_id=$1 AND order_index=0`,
    [native.reportId]
  );
  const a06Ledger = (
    await pool.query(
      `SELECT adapter_key,idempotency_key,status,compensation_policy,canonical_artifact_type,
              canonical_artifact_id,readback_digest,attempt_count
         FROM v8_agent_adapter_invocations
        WHERE transformation_case_id=$1 AND organization_id=$2
          AND adapter_key='transformation.final_outputs.publish'`,
      [params.transformationCaseId, params.organizationId]
    )
  ).rows;
  if (
    a06Ledger.length !== 1 ||
    a06Ledger[0].status !== 'succeeded' ||
    a06Ledger[0].compensation_policy !== 'delete_created' ||
    a06Ledger[0].canonical_artifact_type !== 'transformation_final_output_manifest' ||
    a06Ledger[0].canonical_artifact_id !== first.runId ||
    !a06Ledger[0].readback_digest ||
    Number(a06Ledger[0].attempt_count) !== 1
  )
    throw new Error(`A06 final-output ledger proof failed: ${JSON.stringify(a06Ledger)}`);
  await pool.query(
    `INSERT INTO transformation_case_audit_events
     (audit_event_id,transformation_case_id,organization_id,event_type,actor_user_id,payload_digest,detail_json)
     VALUES ('audit-final-digest-change-1',$1,$2,'proof.final_digest_changed',$3,'proof-1','{}'::jsonb)`,
    [params.transformationCaseId, params.organizationId, params.actorUserId]
  );
  const changedPublication = await prepareFinalOutputPublication(params);
  if (changedPublication.factsDigest === publication.factsDigest)
    throw new Error('Changed facts did not require a new publication proposal');
  let changedDigestCode = '';
  try {
    await generateFinalOutputs(params);
  } catch (error) {
    changedDigestCode = String((error as { code?: string }).code || '');
  }
  await requestProposalRevision({
    proposalVersionId: changedPublication.proposalVersionId,
    organizationId: params.organizationId,
    scopeKey: changedPublication.scopeKey,
    reason: 'Publication facts require revision',
    actorUserId: params.actorUserId,
  });
  let revisionCode = '';
  try {
    await generateFinalOutputs(params);
  } catch (error) {
    revisionCode = String((error as { code?: string }).code || '');
  }
  if (
    changedDigestCode !== 'TRANSFORMATION_FINAL_OUTPUT_PUBLICATION_NOT_APPROVED' ||
    revisionCode !== 'TRANSFORMATION_FINAL_OUTPUT_PUBLICATION_NOT_APPROVED'
  )
    throw new Error('Changed/revision-requested digest was not fail-closed');
  await pool.query(
    `INSERT INTO transformation_case_audit_events
     (audit_event_id,transformation_case_id,organization_id,event_type,actor_user_id,payload_digest,detail_json)
     VALUES ('audit-final-digest-change-2',$1,$2,'proof.final_digest_changed',$3,'proof-2','{}'::jsonb)`,
    [params.transformationCaseId, params.organizationId, params.actorUserId]
  );
  const expiredPublication = await prepareFinalOutputPublication(params);
  await pool.query(
    `UPDATE v8_agent_proposal_versions SET expires_at=NOW()-INTERVAL '1 second'
      WHERE proposal_version_id=$1`,
    [expiredPublication.proposalVersionId]
  );
  let expiredCode = '';
  try {
    await generateFinalOutputs(params);
  } catch (error) {
    expiredCode = String((error as { code?: string }).code || '');
  }
  await pool.query(
    `INSERT INTO transformation_case_audit_events
     (audit_event_id,transformation_case_id,organization_id,event_type,actor_user_id,payload_digest,detail_json)
     VALUES ('audit-final-digest-change-3',$1,$2,'proof.final_digest_changed',$3,'proof-3','{}'::jsonb)`,
    [params.transformationCaseId, params.organizationId, params.actorUserId]
  );
  const invalidatedPublication = await prepareFinalOutputPublication(params);
  await reviewProposalScope({
    proposalVersionId: invalidatedPublication.proposalVersionId,
    organizationId: params.organizationId,
    scopeKey: invalidatedPublication.scopeKey,
    decision: 'approved',
    reason: 'Approve before exact context invalidation proof',
    actorUserId: params.actorUserId,
  });
  const originalSnapshot = (
    await pool.query(
      `SELECT context_snapshot_id FROM transformation_cases WHERE transformation_case_id=$1`,
      [params.transformationCaseId]
    )
  ).rows[0].context_snapshot_id;
  await pool.query(
    `UPDATE transformation_cases SET context_snapshot_id='context-invalidated-for-proof'
      WHERE transformation_case_id=$1`,
    [params.transformationCaseId]
  );
  let invalidatedCode = '';
  try {
    await generateFinalOutputs(params);
  } catch (error) {
    invalidatedCode = String((error as { code?: string }).code || '');
  }
  await pool.query(
    `UPDATE transformation_cases SET context_snapshot_id=$2 WHERE transformation_case_id=$1`,
    [params.transformationCaseId, originalSnapshot]
  );
  if (
    expiredCode !== 'TRANSFORMATION_FINAL_OUTPUT_PUBLICATION_NOT_APPROVED' ||
    invalidatedCode !== 'TRANSFORMATION_FINAL_OUTPUT_PUBLICATION_NOT_APPROVED'
  )
    throw new Error('Expired/invalidated publication was not fail-closed');
  const postNegativeCounts = (
    await pool.query(`SELECT
      (SELECT COUNT(*)::int FROM transformation_final_output_runs) manifests,
      (SELECT COUNT(*)::int FROM transformation_case_artifact_links WHERE lifecycle_stage='final_outputs') links,
      (SELECT COUNT(*)::int FROM transformation_case_audit_events WHERE event_type='transformation_final_outputs.generated') audits`)
  ).rows[0];
  if (
    postNegativeCounts.manifests !== 1 ||
    postNegativeCounts.links !== 7 ||
    postNegativeCounts.audits !== 1
  )
    throw new Error(`Blocked digest produced side effects: ${JSON.stringify(postNegativeCounts)}`);

  // A blocked or changed digest must also leave the native owner artifacts alone.
  const postNegativeNative = (
    await pool.query(`SELECT
      (SELECT COUNT(*)::int FROM report_builder_reports) reports,
      (SELECT COUNT(*)::int FROM report_builder_versions) report_versions,
      (SELECT COUNT(*)::int FROM presentation_decks) decks,
      (SELECT COUNT(*)::int FROM presentation_deck_versions) deck_versions,
      (SELECT COUNT(*)::int FROM v8_output_artifacts) registry_artifacts`)
  ).rows[0];
  if (
    postNegativeNative.reports !== 1 ||
    postNegativeNative.report_versions !== 1 ||
    postNegativeNative.decks !== 1 ||
    postNegativeNative.deck_versions !== 1 ||
    postNegativeNative.registry_artifacts !== 2
  )
    throw new Error(
      `U02 blocked digest created native artifacts: ${JSON.stringify(postNegativeNative)}`
    );

  const observedAt = new Date().toISOString();
  await registerRuntimeCapability({
    organizationId: params.organizationId,
    actorUserId: params.actorUserId,
    lifecycleStage: 'final_outputs.native_doc',
    capabilityKey: 'transformation.final_outputs.native_doc',
    ownerModule: 'report_builder',
    evidenceContract: {
      requiredChecks: ['approved_owner_write', 'idempotent_retry', 'cold_reopen', 'binary_parse'],
    },
  });
  const capability = await reportRuntimeEvidence({
    organizationId: params.organizationId,
    actorUserId: params.actorUserId,
    lifecycleStage: 'final_outputs.native_doc',
    evidence: {
      approved_owner_write: { passed: true, evidenceRef: first.runId, observedAt },
      idempotent_retry: { passed: true, evidenceRef: replay.runId, observedAt },
      cold_reopen: { passed: true, evidenceRef: coldReport.report.reportVersionId, observedAt },
      binary_parse: { passed: true, evidenceRef: coldReport.binary.sha256, observedAt },
    },
  });
  if (capability.derivedStatus !== 'REAL' || capability.ownerModule !== 'report_builder')
    throw new Error(
      `AGT-003 bounded capability registry readback failed: ${JSON.stringify(capability)}`
    );

  console.log(
    JSON.stringify({
      proof: 'U02_NATIVE_REPORT_PRESENTATION_REALDB_GREEN',
      transformationCaseId: params.transformationCaseId,
      organizationId: params.organizationId,
      caseVersion: first.caseVersion,
      runId: first.runId,
      sharedFactsDigest: first.factsDigest,
      nativeReportId: native.reportId,
      nativeReportVersionId: native.reportVersionId,
      nativeReportVersionNumber: native.reportVersionNumber,
      reportRegistryArtifactId: native.reportRegistryArtifactId,
      nativeDeckId: native.deckId,
      nativeDeckVersionId: native.deckVersionId,
      nativeDeckVersionNumber: native.deckVersionNumber,
      deckRegistryArtifactId: native.deckRegistryArtifactId,
      idempotentReplayRuns: 1 + concurrent.length,
      idempotentReplayCounts: concurrentCounts,
      changedDigestRequiresNewApproval: true,
      tenantDenial: {
        latestRun: crossTenantRead,
        generateCode: crossTenantGenerateCode,
        nativeRows: crossTenantNative,
      },
      docxPath: first.docxPath,
      docxSha256: first.docxSha256,
      pptxPath: first.pptxPath,
      pptxSha256: first.pptxSha256,
      fileHashesVerified: true,
      nativeEditIsolated: true,
      coldReopen: {
        reportId: coldReport.report.reportId,
        reportVersionId: coldReport.report.reportVersionId,
        registryArtifactId: coldReport.report.registryArtifactId,
        parsedCharacters: parsedDocx.value.length,
        docxSha256: coldReport.binary.sha256,
      },
      boundedCapability: {
        lifecycleStage: capability.lifecycleStage,
        capabilityKey: capability.capabilityKey,
        ownerModule: capability.ownerModule,
        derivedStatus: capability.derivedStatus,
        evidenceDigest: capability.evidenceDigest,
      },
      links: postNegativeCounts.links,
    })
  );

  process.stdout.write(
    `${JSON.stringify(
      {
        first,
        replay,
        latest,
        counts,
        publication,
        preApprovalCode,
        preApprovalCounts,
        unauthorizedDenied: true,
        a06DeniedBeforePublication,
        a06DeniedCounts,
        a06Ledger,
        a06CanonicalReadback: 'exact_manifest_and_physical_hashes_verified',
        changedDigestRequiresNewReview: true,
        revisionRequestedBlocked: true,
        expiredBlocked: true,
        invalidatedBlocked: true,
        postNegativeCounts,
        crossTenantRead,
        crossTenantGenerateCode,
        fileHashReadback: 'verified',
        native,
        nativeReadback,
        concurrentCounts,
        crossTenantNative,
        postNegativeNative,
      },
      null,
      2
    )}\n`
  );
}

main().then(
  async () => {
    await pool.end();
    process.exit(0);
  },
  async (error) => {
    await pool.end();
    process.stderr.write(`${String(error?.stack || error)}\n`);
    process.exit(1);
  }
);
