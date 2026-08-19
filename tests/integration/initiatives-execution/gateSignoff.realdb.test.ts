import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanupInitiativesExecutionOrg } from '../../support/initiativesExecutionOrgCleanup';
import {
  assertGateQuorumReceipt,
  gateSignoffId,
  submitGateSignoff,
} from '../../../server/src/domain/initiatives-execution/gateSignoff';
import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';
import { PostgresInitiativeReader } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader';
const url = process.env.IE_TEST_DATABASE_URL?.trim(),
  real = url ? describe : describe.skip;
real('Canonical Gate Signoff quorum realDB', () => {
  const pool = new Pool({ connectionString: url, max: 2 }),
    uow = new PostgresMaterialCommandUnitOfWork(pool),
    reader = new PostgresInitiativeReader(pool),
    org = 'org-signoff';
  beforeAll(async () => {
    for (const f of [
      '932_initiatives_execution_material_commands.sql',
      '934_organization_governance_profiles.sql',
    ])
      await pool.query(await readFile(path.resolve('server/migrations', f), 'utf8'));
  });
  beforeEach(async () => {
    for (const t of [
      'ie_aggregate_relations',
      'ie_command_receipts',
      'ie_audit_events',
      'ie_outbox_events',
      'ie_aggregate_state',
    ])
      await pool.query(`DELETE FROM ${t} WHERE organization_id=$1`, [org]);
  });
  afterAll(async () => {
    await cleanupInitiativesExecutionOrg(pool, org);
    await pool.end();
  });
  const policy = (baseline: 'BASELINE_SMALL' | 'STANDARD' | 'COMPLEX', bindings: any[]) => ({
      policyId: `p-${baseline}`,
      version: 1,
      baseline,
      strictness: baseline === 'BASELINE_SMALL' ? 1 : baseline === 'STANDARD' ? 2 : 3,
      source: 'ORGANIZATION' as const,
      config: { enforceGateGovernance: true, roleBindings: bindings },
    }),
    sign = async (
      gate: any,
      decisionId: string,
      actor: string,
      roleKey: string,
      p: any,
      qv: number,
      key: string
    ) => {
      const id = gateSignoffId(gate, decisionId, actor, roleKey);
      return submitGateSignoff(uow, {
        organizationId: org,
        actorId: actor,
        aggregateType: 'gate_signoff',
        aggregateId: id,
        expectedVersion: 0,
        clientRequestId: key,
        correlationId: key,
        policyId: p.policyId,
        policyVersion: p.version,
        commandType: 'gate.signoff',
        createIfMissing: true,
        payload: {
          expectedQuorumVersion: qv,
          gate,
          decisionId,
          initiativeId: 'i1',
          requesterId: 'requester',
          roleKey,
          outcome: 'APPROVE',
          delegationProof: null,
          rationale: 'approve',
          policy: p,
        },
      });
    };
  it('creates quorum only from persisted signer-owned approvals for all profiles and rejects Admin', async () => {
    const small = policy('BASELINE_SMALL', [{ roleKey: 'TEAM_LEAD', principalId: 'boss' }]),
      standard = policy('STANDARD', [{ roleKey: 'GATE_AUTHORITY', principalId: 'approver' }]),
      complex = policy('COMPLEX', [
        { roleKey: 'BUSINESS_AUTHORITY', principalId: 'business' },
        { roleKey: 'DOMAIN_AUTHORITY', principalId: 'domain' },
      ]);
    await sign('DEFINITION', 'small-d', 'boss', 'TEAM_LEAD', small, 0, 'small-sign');
    await sign(
      'ANALYSIS',
      'standard-d',
      'approver',
      'GATE_AUTHORITY',
      standard,
      0,
      'standard-sign'
    );
    await sign(
      'PORTFOLIO',
      'complex-d',
      'business',
      'BUSINESS_AUTHORITY',
      complex,
      0,
      'complex-business'
    );
    await sign(
      'PORTFOLIO',
      'complex-d',
      'domain',
      'DOMAIN_AUTHORITY',
      complex,
      1,
      'complex-domain'
    );
    const replay = await sign(
      'PORTFOLIO',
      'complex-d',
      'domain',
      'DOMAIN_AUTHORITY',
      complex,
      1,
      'complex-domain'
    );
    expect(replay.status).toBe('REPLAYED');
    await expect(
      sign(
        'SCHEDULE',
        'admin-d',
        'admin',
        'ADMIN',
        policy('COMPLEX', [{ roleKey: 'ADMIN', principalId: 'admin' }]),
        0,
        'admin-sign'
      )
    ).rejects.toThrow('Authorized signer');
    const quorums = await reader.listGateQuorums(org);
    expect(quorums).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          quorumId: 'DEFINITION:small-d',
          status: 'SATISFIED',
          version: 1,
        }),
        expect.objectContaining({
          quorumId: 'ANALYSIS:standard-d',
          status: 'SATISFIED',
          version: 1,
        }),
        expect.objectContaining({
          quorumId: 'PORTFOLIO:complex-d',
          status: 'SATISFIED',
          version: 2,
          signoffs: expect.arrayContaining([
            expect.objectContaining({ signerId: 'business' }),
            expect.objectContaining({ signerId: 'domain' }),
          ]),
        }),
      ])
    );
    const q: any = quorums.find((x: any) => x.quorumId === 'PORTFOLIO:complex-d');
    await expect(
      uow.transaction((tx) =>
        assertGateQuorumReceipt(tx, org, {
          required: true,
          gate: 'PORTFOLIO',
          decisionId: 'complex-d',
          policyId: complex.policyId,
          policyVersion: 1,
          quorumRef: { quorumId: q.quorumId, version: q.version, receiptId: 'spoofed' },
        })
      )
    ).rejects.toThrow('Exact satisfied');
    await uow.transaction((tx) =>
      assertGateQuorumReceipt(tx, org, {
        required: true,
        gate: 'PORTFOLIO',
        decisionId: 'complex-d',
        policyId: complex.policyId,
        policyVersion: 1,
        quorumRef: { quorumId: q.quorumId, version: q.version, receiptId: q.receiptId },
      })
    );
    expect(await reader.listGateQuorums('foreign')).toEqual([]);
  });
});
