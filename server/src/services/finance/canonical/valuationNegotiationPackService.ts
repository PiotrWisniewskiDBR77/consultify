import { createHash } from 'node:crypto';

import { withPinnedPostgresTransaction } from '../../../database/PostgresDatabase.js';
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
const sha = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex');

type Expected = {
  artifactId: string;
  businessVersionId: string;
  workingRevisionId: string;
  workingRevisionVersion: number;
};

function error(code: string, message: string) {
  return Object.assign(new Error(message), { code });
}

export async function generateCanonicalLegacyNegotiationPack(params: {
  organizationId: string;
  userId: string;
  legacyId: string;
  expected: Expected;
  idempotencyKey: string;
}) {
  const key = params.idempotencyKey.trim();
  if (!key) throw error('IDEMPOTENCY_KEY_REQUIRED', 'x-idempotency-key is required');
  return withPinnedPostgresTransaction(async (tx) => {
    await assertFinanceEditor(tx, params.organizationId, params.userId);
    await tx.queryOne(`SELECT pg_advisory_xact_lock(hashtextextended(?,0))`, [
      `${params.organizationId}:${params.legacyId}:NEGOTIATION_PACK`,
    ]);
    const identity = await tx.queryOne<any>(
      `SELECT aa.artifact_id,aa.business_version_id,wr.working_revision_id,wr.version AS working_revision_version,v.status
      FROM finance_artifact_aliases aa
      JOIN finance_artifacts a ON a.organization_id=aa.organization_id AND a.artifact_id=aa.artifact_id
      JOIN finance_business_versions bv ON bv.organization_id=aa.organization_id AND bv.business_version_id=aa.business_version_id AND bv.artifact_id=aa.artifact_id
      JOIN finance_working_revisions wr ON wr.organization_id=aa.organization_id AND wr.working_revision_id=bv.source_working_revision_id AND wr.is_current=true
      JOIN valuations v ON v.organization_id=aa.organization_id AND v.id=aa.legacy_id
      WHERE aa.organization_id=? AND aa.legacy_table='valuations' AND aa.legacy_id=? AND a.artifact_type='VALUATION_CASE' AND a.current_business_version_id=aa.business_version_id
      ORDER BY aa.created_at DESC LIMIT 1 FOR UPDATE`,
      [params.organizationId, params.legacyId]
    );
    if (!identity) throw error('LEGACY_IDENTITY_UNMAPPED', 'Legacy valuation is not mapped');
    if (String(identity.status).toUpperCase() !== 'APPROVED')
      throw error(
        'VALUATION_NOT_APPROVED',
        'Valuation must be APPROVED to generate negotiation pack'
      );
    if (
      identity.artifact_id !== params.expected.artifactId ||
      identity.business_version_id !== params.expected.businessVersionId ||
      identity.working_revision_id !== params.expected.workingRevisionId ||
      Number(identity.working_revision_version) !== params.expected.workingRevisionVersion
    )
      throw error('CANONICAL_IDENTITY_CAS_CONFLICT', 'Canonical valuation identity changed');
    const methods = await tx.queryAll<any>(
      `SELECT id,method_type,readiness,result_value_status,result_ev_decimal::text,is_in_recommendation_basket,weight_pct::text FROM finance_valuation_methods WHERE organization_id=? AND business_version_id=? ORDER BY method_type,id`,
      [params.organizationId, identity.business_version_id]
    );
    const terminal = await tx.queryAll<any>(
      `SELECT t.method_id,t.convention,t.terminal_value_decimal::text FROM finance_valuation_terminal t JOIN finance_valuation_methods m ON m.organization_id=t.organization_id AND m.id=t.method_id WHERE t.organization_id=? AND m.business_version_id=? ORDER BY t.method_id,t.convention`,
      [params.organizationId, identity.business_version_id]
    );
    const bridge = await tx.queryOne<any>(
      `SELECT enterprise_value_decimal::text,equity_value_decimal::text FROM finance_valuation_ev_equity_bridge WHERE organization_id=? AND business_version_id=?`,
      [params.organizationId, identity.business_version_id]
    );
    const ready = methods.filter(
      (m: any) =>
        m.readiness === 'READY' &&
        m.result_value_status !== 'MISSING' &&
        m.result_ev_decimal !== null
    );
    if (!ready.length || !bridge)
      throw error('CANONICAL_RESULTS_NOT_READY', 'Canonical valuation results are required');
    const source = {
      methods,
      terminal,
      bridge,
      workingRevisionId: identity.working_revision_id,
      workingRevisionVersion: Number(identity.working_revision_version),
    };
    const sourceResultSha256 = sha(source);
    const requestSha256 = sha({
      legacyValuationId: params.legacyId,
      expected: params.expected,
      sourceResultSha256,
    });
    const prior = await tx.queryOne<any>(
      `SELECT request_sha256,response_json FROM finance_valuation_negotiation_pack_receipts WHERE organization_id=? AND idempotency_key=?`,
      [params.organizationId, key]
    );
    if (prior) {
      if (prior.request_sha256 !== requestSha256)
        throw error(
          'IDEMPOTENCY_KEY_REUSED',
          'Idempotency key reused after valuation results changed'
        );
      return { ...prior.response_json, replay: true };
    }
    const primary = ready.find((m: any) => m.is_in_recommendation_basket) ?? ready[0];
    const pack = {
      generatedAt: new Date().toISOString(),
      valuationId: params.legacyId,
      sourceResultSha256,
      proPoints: [
        {
          title: 'Canonical valuation result',
          oneLiner: 'The negotiation range is grounded in persisted canonical methods.',
          evidence: [
            `Enterprise value: ${bridge.enterprise_value_decimal}`,
            `Equity value: ${bridge.equity_value_decimal ?? '—'}`,
            `Primary method: ${primary.method_type}`,
          ],
        },
        {
          title: 'Method transparency',
          oneLiner: 'Every value is traceable to a typed canonical method.',
          evidence: ready.map((m: any) => `${m.method_type}: ${m.result_ev_decimal}`),
        },
      ],
      contraPoints: [
        {
          title: 'Assumptions can be challenged',
          objection: 'Valuation outcomes depend on forecast and terminal assumptions.',
          rebuttal:
            'Use the persisted method, terminal and bridge evidence to discuss a range rather than a single unsupported number.',
        },
      ],
      qa: [
        {
          question: 'What would change the valuation?',
          suggestedAnswer:
            'Changes to forecast cash flows, discount rate, terminal assumptions or the EV-to-equity bridge require a new canonical compute before regenerating this pack.',
        },
      ],
      dontSay: ['Do not describe the valuation as guaranteed or as investment advice.'],
      disclaimers: [
        'Informational only; not investment, legal, or tax advice.',
        'Figures are based on persisted canonical assumptions and are not audited.',
      ],
    };
    const response = {
      artifactId: identity.artifact_id,
      businessVersionId: identity.business_version_id,
      workingRevisionId: identity.working_revision_id,
      workingRevisionVersion: Number(identity.working_revision_version),
      legacyValuationId: params.legacyId,
      sourceResultSha256,
      requestSha256,
      pack,
      replay: false,
    };
    await tx.queryRun(
      `INSERT INTO finance_valuation_negotiation_packs(organization_id,legacy_valuation_id,artifact_id,business_version_id,source_working_revision_id,source_working_revision_version,source_result_sha256,pack_json,generated_by) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT (organization_id,business_version_id) DO UPDATE SET source_working_revision_id=EXCLUDED.source_working_revision_id,source_working_revision_version=EXCLUDED.source_working_revision_version,source_result_sha256=EXCLUDED.source_result_sha256,pack_json=EXCLUDED.pack_json,generated_by=EXCLUDED.generated_by,generated_at=now()`,
      [
        params.organizationId,
        params.legacyId,
        identity.artifact_id,
        identity.business_version_id,
        identity.working_revision_id,
        identity.working_revision_version,
        sourceResultSha256,
        JSON.stringify(pack),
        params.userId,
      ]
    );
    await tx.queryRun(
      `UPDATE valuations SET negotiation_pack=?,updated_at=now() WHERE organization_id=? AND id=?`,
      [JSON.stringify(pack), params.organizationId, params.legacyId]
    );
    await tx.queryRun(
      `INSERT INTO finance_valuation_negotiation_pack_receipts(organization_id,idempotency_key,request_sha256,legacy_valuation_id,artifact_id,business_version_id,working_revision_id,working_revision_version,source_result_sha256,response_json,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        params.organizationId,
        key,
        requestSha256,
        params.legacyId,
        identity.artifact_id,
        identity.business_version_id,
        identity.working_revision_id,
        identity.working_revision_version,
        sourceResultSha256,
        JSON.stringify(response),
        params.userId,
      ]
    );
    const cold = await tx.queryOne<any>(
      `SELECT source_result_sha256,pack_json FROM finance_valuation_negotiation_packs WHERE organization_id=? AND business_version_id=?`,
      [params.organizationId, identity.business_version_id]
    );
    if (
      !cold ||
      cold.source_result_sha256 !== sourceResultSha256 ||
      canonical(cold.pack_json) !== canonical(pack)
    )
      throw new Error('CANONICAL_COLD_READBACK_MISMATCH');
    return response;
  });
}
