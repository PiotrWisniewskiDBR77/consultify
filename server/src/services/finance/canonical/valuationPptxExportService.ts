import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { withPinnedPostgresTransaction } from '../../../database/PostgresDatabase.js';
import { exportsDir } from '../../../utils/storagePaths.js';
import { PptxPipelineService } from '../../report/pptx/PptxPipelineService.js';
import type { UnifiedReportJSON } from '../../report/pptx/types.js';
import { assertFinanceEditor } from './valuationLegacySuccessorService.js';

const canonical = (value: unknown): string =>
  value === null || typeof value !== 'object'
    ? JSON.stringify(value)
    : Array.isArray(value)
      ? `[${value.map(canonical).join(',')}]`
      : `{${Object.entries(value as Record<string, unknown>)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
          .join(',')}}`;
const sha = (value: unknown) =>
  createHash('sha256')
    .update(typeof value === 'string' || Buffer.isBuffer(value) ? value : canonical(value))
    .digest('hex');
const fail = (code: string, message: string) => Object.assign(new Error(message), { code });
type Options = {
  language: 'en' | 'pl';
  theme: 'corporate' | 'minimal' | 'modern';
  confidentiality: 'confidential' | 'internal' | 'public';
};
type Expected = {
  artifactId: string;
  businessVersionId: string;
  workingRevisionId: string;
  workingRevisionVersion: number;
};

async function snapshot(tx: any, organizationId: string, legacyId: string) {
  const identity = await tx.queryOne(
    `SELECT aa.artifact_id,aa.business_version_id,wr.working_revision_id,wr.version AS working_revision_version,v.status,v.title,v.currency,o.name AS organization_name
    FROM finance_artifact_aliases aa
    JOIN finance_artifacts a ON a.organization_id=aa.organization_id AND a.artifact_id=aa.artifact_id
    JOIN finance_business_versions bv ON bv.organization_id=aa.organization_id AND bv.business_version_id=aa.business_version_id AND bv.artifact_id=aa.artifact_id
    JOIN finance_working_revisions wr ON wr.organization_id=aa.organization_id AND wr.working_revision_id=bv.source_working_revision_id AND wr.is_current=true
    JOIN valuations v ON v.organization_id=aa.organization_id AND v.id=aa.legacy_id
    JOIN organizations o ON o.id=aa.organization_id
    WHERE aa.organization_id=? AND aa.legacy_table='valuations' AND aa.legacy_id=? AND a.artifact_type='VALUATION_CASE' AND a.current_business_version_id=aa.business_version_id
      AND a.archived_at IS NULL AND v.status <> 'ARCHIVED'
    ORDER BY aa.created_at DESC LIMIT 1`,
    [organizationId, legacyId]
  );
  if (!identity) throw fail('LEGACY_IDENTITY_UNMAPPED', 'Legacy valuation is not mapped');
  if (String(identity.status).toUpperCase() !== 'APPROVED')
    throw fail('VALUATION_NOT_APPROVED', 'Valuation must be APPROVED to export');
  const methods = await tx.queryAll(
    `SELECT id,method_type,readiness,result_value_status,result_ev_decimal::text,is_in_recommendation_basket,weight_pct::text FROM finance_valuation_methods WHERE organization_id=? AND business_version_id=? ORDER BY method_type,id`,
    [organizationId, identity.business_version_id]
  );
  const terminal = await tx.queryAll(
    `SELECT t.method_id,t.convention,t.terminal_value_decimal::text,t.terminal_share_pct::text FROM finance_valuation_terminal t JOIN finance_valuation_methods m ON m.organization_id=t.organization_id AND m.id=t.method_id WHERE t.organization_id=? AND m.business_version_id=? ORDER BY t.method_id,t.convention`,
    [organizationId, identity.business_version_id]
  );
  const bridge = await tx.queryOne(
    `SELECT enterprise_value_decimal::text,equity_value_decimal::text,as_of_date::text FROM finance_valuation_ev_equity_bridge WHERE organization_id=? AND business_version_id=?`,
    [organizationId, identity.business_version_id]
  );
  const ready = methods.filter(
    (row: any) =>
      row.readiness === 'READY' &&
      row.result_value_status !== 'MISSING' &&
      row.result_ev_decimal !== null
  );
  if (!ready.length || !bridge)
    throw fail('CANONICAL_RESULTS_NOT_READY', 'Canonical valuation results are required');
  return { identity, methods, terminal, bridge, ready };
}

function assertExpected(data: any, expected: Expected) {
  if (
    data.identity.artifact_id !== expected.artifactId ||
    data.identity.business_version_id !== expected.businessVersionId ||
    data.identity.working_revision_id !== expected.workingRevisionId ||
    Number(data.identity.working_revision_version) !== expected.workingRevisionVersion
  )
    throw fail('CANONICAL_IDENTITY_CAS_CONFLICT', 'Canonical valuation identity changed');
}

function report(data: any, options: Options): UnifiedReportJSON {
  const pl = options.language === 'pl';
  const primary = data.ready.find((row: any) => row.is_in_recommendation_basket) ?? data.ready[0];
  return {
    meta: {
      client: data.identity.organization_name,
      project: data.identity.title,
      date: new Date().toISOString().slice(0, 10),
      author: 'Consultify',
      confidentiality: options.confidentiality,
      language: options.language,
      template: options.theme,
      sourceType: 'canonical_valuation',
    },
    slides: [
      {
        intent: 'cover',
        key_message: data.identity.title,
        content: {
          type: 'cover',
          title: data.identity.title,
          subtitle: pl ? 'Wycena przedsiębiorstwa' : 'Enterprise Valuation',
          organization: data.identity.organization_name,
          date: new Date().toISOString().slice(0, 10),
          confidentiality: options.confidentiality,
        } as any,
      },
      {
        intent: 'executive_summary',
        key_message: pl ? 'Podsumowanie wyceny' : 'Valuation Summary',
        content: {
          type: 'executive_summary',
          headline: `Enterprise value: ${data.bridge.enterprise_value_decimal} ${data.identity.currency}`,
          key_findings: [
            `Equity value: ${data.bridge.equity_value_decimal ?? '—'} ${data.identity.currency}`,
            `Primary method: ${primary.method_type}`,
            `As of: ${data.bridge.as_of_date}`,
          ],
          recommendation: pl
            ? 'Materiał informacyjny; nie stanowi porady inwestycyjnej.'
            : 'Informational only; not investment advice.',
        },
      },
      {
        intent: 'appendix',
        key_message: pl ? 'Metody i wyniki' : 'Methods and results',
        content: {
          type: 'appendix',
          title: pl ? 'Metody i wyniki' : 'Methods and results',
          body: data.ready
            .map(
              (row: any) => `${row.method_type}: ${row.result_ev_decimal} ${data.identity.currency}`
            )
            .join('\n'),
          footnotes: [
            'Persisted canonical methods, terminal rows and EV/equity bridge.',
            'Informational only; not investment advice.',
          ],
        } as any,
      },
    ],
  };
}

export async function exportCanonicalLegacyValuationPptx(params: {
  organizationId: string;
  userId: string;
  legacyId: string;
  expected: Expected;
  idempotencyKey: string;
  options: Options;
}) {
  const key = params.idempotencyKey.trim();
  if (!key) throw fail('IDEMPOTENCY_KEY_REQUIRED', 'x-idempotency-key is required');
  const first = await withPinnedPostgresTransaction(async (tx) => {
    await assertFinanceEditor(tx, params.organizationId, params.userId);
    const data = await snapshot(tx, params.organizationId, params.legacyId);
    assertExpected(data, params.expected);
    return data;
  });
  const sourceContent = {
    identity: first.identity,
    methods: first.methods,
    terminal: first.terminal,
    bridge: first.bridge,
    options: params.options,
  };
  const sourceContentHash = sha(sourceContent);
  const completed = await withPinnedPostgresTransaction(async (tx) => {
    await assertFinanceEditor(tx, params.organizationId, params.userId);
    return tx.queryOne(
      `SELECT r.*,e.export_path,e.slide_count,e.warnings_json FROM artifact_export_receipts r JOIN finance_valuation_pptx_exports e ON e.organization_id=r.organization_id AND e.export_receipt_id=r.export_receipt_id WHERE r.organization_id=? AND r.idempotency_key=?`,
      [params.organizationId, key]
    );
  });
  if (completed) {
    if (completed.source_content_hash !== sourceContentHash)
      throw fail('IDEMPOTENCY_KEY_REUSED', 'Export key is bound to different canonical source');
    return {
      artifactId: first.identity.artifact_id,
      businessVersionId: first.identity.business_version_id,
      workingRevisionId: first.identity.working_revision_id,
      workingRevisionVersion: Number(first.identity.working_revision_version),
      exportReceiptId: completed.export_receipt_id,
      downloadUrl: `/api/economics/valuations/${params.legacyId}/export/pptx/download`,
      slideCount: Number(completed.slide_count),
      warnings: completed.warnings_json,
      sourceContentHash,
      outputContentHash: completed.output_content_hash,
      replay: true,
    };
  }
  const pipeline = new PptxPipelineService();
  const rendered = await pipeline.generateFromUnifiedJson(report(first, params.options), {
    template: params.options.theme,
    language: params.options.language,
    confidentiality: params.options.confidentiality,
    skipValidation: false,
  });
  if (!rendered.buffer?.length) throw fail('EXPORT_EMPTY', 'PPTX renderer produced no bytes');
  const outputContentHash = sha(rendered.buffer);
  const exportReceiptId = randomUUID();
  const fileName = `${params.legacyId}-${sourceContentHash.slice(0, 12)}.pptx`;
  const exportPathPublic = `/exports/valuations/${fileName}`;
  const exportPathFs = path.join(exportsDir('valuations'), fileName);
  let wrote = false;
  try {
    return await withPinnedPostgresTransaction(async (tx) => {
      await assertFinanceEditor(tx, params.organizationId, params.userId);
      await tx.queryOne(`SELECT pg_advisory_xact_lock(hashtextextended(?,0))`, [
        `${params.organizationId}:${params.legacyId}:VALUATION_PPTX_EXPORT`,
      ]);
      const current = await snapshot(tx, params.organizationId, params.legacyId);
      assertExpected(current, params.expected);
      if (
        sha({
          identity: current.identity,
          methods: current.methods,
          terminal: current.terminal,
          bridge: current.bridge,
          options: params.options,
        }) !== sourceContentHash
      )
        throw fail('CANONICAL_SOURCE_CAS_CONFLICT', 'Canonical valuation changed while rendering');
      const prior = await tx.queryOne(
        `SELECT r.*,e.export_path,e.slide_count,e.warnings_json FROM artifact_export_receipts r JOIN finance_valuation_pptx_exports e ON e.organization_id=r.organization_id AND e.export_receipt_id=r.export_receipt_id WHERE r.organization_id=? AND r.idempotency_key=?`,
        [params.organizationId, key]
      );
      if (prior) {
        if (prior.source_content_hash !== sourceContentHash)
          throw fail('IDEMPOTENCY_KEY_REUSED', 'Export key is bound to different source or bytes');
        return {
          artifactId: current.identity.artifact_id,
          businessVersionId: current.identity.business_version_id,
          workingRevisionId: current.identity.working_revision_id,
          workingRevisionVersion: Number(current.identity.working_revision_version),
          exportReceiptId: prior.export_receipt_id,
          downloadUrl: `/api/economics/valuations/${params.legacyId}/export/pptx/download`,
          slideCount: Number(prior.slide_count),
          warnings: prior.warnings_json,
          sourceContentHash,
          outputContentHash: prior.output_content_hash,
          replay: true,
        };
      }
      fs.writeFileSync(exportPathFs, rendered.buffer);
      wrote = true;
      await tx.queryRun(
        `INSERT INTO artifact_export_receipts(export_receipt_id,organization_id,artifact_kind,source_record_id,source_version,source_content_hash,output_format,provider_key,provider_job_id,status,output_byte_size,output_content_hash,idempotency_key,created_by,completed_at,policy_contract_version,render_engine_version,render_engine_license,output_semantics) VALUES (?,?,'presentation',?, ?,?,'pptx','native:pptxgenjs',?,'succeeded',?,?,?,?,now(),'mat-policy-v1','4.0.1','MIT','presentation')`,
        [
          exportReceiptId,
          params.organizationId,
          current.identity.artifact_id,
          current.identity.working_revision_version,
          sourceContentHash,
          `native-job:${key}`,
          rendered.buffer.length,
          outputContentHash,
          key,
          params.userId,
        ]
      );
      await tx.queryRun(
        `INSERT INTO finance_valuation_pptx_exports(organization_id,export_receipt_id,legacy_valuation_id,artifact_id,business_version_id,working_revision_id,working_revision_version,source_content_hash,output_content_hash,output_byte_size,export_path,language,theme,confidentiality,slide_count,warnings_json,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          params.organizationId,
          exportReceiptId,
          params.legacyId,
          current.identity.artifact_id,
          current.identity.business_version_id,
          current.identity.working_revision_id,
          current.identity.working_revision_version,
          sourceContentHash,
          outputContentHash,
          rendered.buffer.length,
          exportPathPublic,
          params.options.language,
          params.options.theme,
          params.options.confidentiality,
          rendered.slideCount,
          JSON.stringify(rendered.warnings),
          params.userId,
        ]
      );
      await tx.queryRun(
        `UPDATE valuations SET export_path=?,exported_at=now(),updated_at=now() WHERE organization_id=? AND id=?`,
        [exportPathPublic, params.organizationId, params.legacyId]
      );
      return {
        artifactId: current.identity.artifact_id,
        businessVersionId: current.identity.business_version_id,
        workingRevisionId: current.identity.working_revision_id,
        workingRevisionVersion: Number(current.identity.working_revision_version),
        exportReceiptId,
        downloadUrl: `/api/economics/valuations/${params.legacyId}/export/pptx/download`,
        slideCount: rendered.slideCount,
        warnings: rendered.warnings,
        sourceContentHash,
        outputContentHash,
        replay: false,
      };
    });
  } catch (error) {
    if (wrote) {
      try {
        fs.unlinkSync(exportPathFs);
      } catch {}
    }
    throw error;
  }
}
