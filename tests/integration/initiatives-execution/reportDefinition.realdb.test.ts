import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createReportDefinition,
  transitionReportDefinition,
} from '../../../server/src/domain/initiatives-execution/reportDefinition';
import { createReportRun } from '../../../server/src/domain/initiatives-execution/reportRun';
import { PostgresInitiativeReader } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader';
import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';

const url = process.env.IE_TEST_DATABASE_URL?.trim();
const real = url ? describe : describe.skip;
real('ACO-45 canonical Report Definition realDB', () => {
  const pool = new Pool({ connectionString: url, max: 1 });
  const uow = new PostgresMaterialCommandUnitOfWork(pool);
  const reader = new PostgresInitiativeReader(pool);
  const org = 'org-aco45',
    definitionId = 'definition-aco45';
  const env = (
    id: string,
    actor: string,
    version: number,
    key: string,
    commandType: string,
    payload: any,
    create = false
  ) => ({
    organizationId: org,
    actorId: actor,
    aggregateType: 'report_definition',
    aggregateId: id,
    expectedVersion: version,
    clientRequestId: key,
    correlationId: key,
    policyId: 'report-definition',
    policyVersion: 1,
    commandType,
    createIfMissing: create,
    payload,
  });
  const content = {
    name: 'Weekly execution control',
    purpose: 'Governed steering truth',
    audience: ['Steering Committee'],
    cadence: 'P1W',
    scope: {
      type: 'EXECUTION_PORTFOLIO',
      refs: [],
      projectIds: ['project-ie075'],
      generalBacklogAllowed: false,
    },
    outputSchema: { type: 'object' },
    sections: [{ sectionId: 'health', title: 'Health and intervention', mandatory: true }],
    sourceBindings: [
      { bindingId: 'cases', sourceType: 'execution_case', required: true, scope: 'ACTIVE' },
    ],
    formulas: [
      {
        formulaId: 'blocked-rate',
        expression: 'blocked/total',
        unit: 'ratio',
        currency: null,
        windowId: 'weekly',
      },
    ],
    units: ['ratio'],
    currencies: ['PLN'],
    windows: [{ windowId: 'weekly', duration: 'P7D', timezone: 'Europe/Warsaw' }],
    access: { audienceRoles: ['STEERING'], classification: 'CONFIDENTIAL' },
    redaction: { rules: ['personal-data'], defaultState: 'REDACTED' as const },
    freshnessThresholdMinutes: 1440,
    confidenceThreshold: 'MEDIUM' as const,
    ownerId: 'owner',
    approverId: 'approver',
  };
  beforeAll(async () => {
    for (const file of [
      '932_initiatives_execution_material_commands.sql',
      '933_initiative_card_versions.sql',
    ])
      await pool.query(await readFile(path.resolve('server/migrations', file), 'utf8'));
  });
  beforeEach(async () => {
    for (const table of [
      'ie_aggregate_relations',
      'ie_command_receipts',
      'ie_audit_events',
      'ie_outbox_events',
      'ie_aggregate_state',
    ])
      await pool.query(`DELETE FROM ${table} WHERE organization_id=$1`, [org]);
  });
  afterAll(async () => pool.end());

  it('versions and independently publishes immutable truth; Report Run accepts only exact PUBLISHED version', async () => {
    const create = env(
      definitionId,
      'owner',
      0,
      'create',
      'report-definition.create',
      content,
      true
    );
    expect((await createReportDefinition(uow, create)).status).toBe('APPLIED');
    expect((await createReportDefinition(uow, create)).status).toBe('REPLAYED');
    const transition = (actor: string, version: number, key: string, payload: any) =>
      transitionReportDefinition(
        uow,
        env(definitionId, actor, version, key, 'report-definition.transition', payload)
      );
    await transition('owner', 1, 'validate-v1', { action: 'VALIDATE' });
    await expect(
      transition('owner', 2, 'self-publish', { action: 'PUBLISH', rationale: 'self' })
    ).rejects.toThrow('Independent');
    await transition('approver', 2, 'publish-v1', {
      action: 'PUBLISH',
      rationale: 'Approved source contract',
    });
    const runPayload = {
      definitionRef: { definitionId, version: 1 },
      parentRunRef: null,
      audience: ['Steering Committee'],
      scopeRefs: ['portfolio:active'],
      period: { start: '2026-08-03T00:00:00.000Z', end: '2026-08-10T00:00:00.000Z' },
      asOf: '2026-08-10T10:00:00.000Z',
      sources: [
        {
          sourceType: 'execution_case',
          sourceId: 'case-1',
          version: 1,
          capturedAt: '2026-08-10T10:00:00.000Z',
          freshness: 'CURRENT',
          formula: null,
          unit: null,
          currency: null,
          window: null,
          confidence: 'HIGH',
          accessState: 'FULL',
          redactions: [],
        },
      ],
      ownerId: 'owner',
      approverId: 'approver',
    };
    await createReportRun(uow, {
      ...env('run-v1', 'owner', 0, 'run-v1', 'report-run.create', runPayload, true),
      aggregateType: 'report_run',
    });
    await transition('owner', 3, 'revise', {
      action: 'CREATE_VERSION',
      patch: { name: 'Weekly execution control v2' },
    });
    await expect(
      createReportRun(uow, {
        ...env(
          'run-draft',
          'owner',
          0,
          'run-draft',
          'report-run.create',
          { ...runPayload, definitionRef: { definitionId, version: 2 } },
          true
        ),
        aggregateType: 'report_run',
      })
    ).rejects.toThrow('PUBLISHED');
    await transition('owner', 4, 'validate-v2', { action: 'VALIDATE' });
    await transition('approver', 5, 'publish-v2', {
      action: 'PUBLISH',
      rationale: 'Approved revision',
    });
    const found: any = await reader.findReportDefinition(org, definitionId);
    expect(found.versions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          definitionVersion: 1,
          state: 'SUPERSEDED',
          name: 'Weekly execution control',
        }),
        expect.objectContaining({
          definitionVersion: 2,
          state: 'PUBLISHED',
          name: 'Weekly execution control v2',
        }),
      ])
    );
    expect((await reader.listReportDefinitions(org))[0]).toMatchObject({
      definitionId,
      aggregateVersion: 6,
      currentVersion: 2,
      state: 'PUBLISHED',
    });
    expect(await reader.listReportDefinitions('foreign')).toEqual([]);
    await expect(
      createReportRun(uow, {
        ...env('run-old', 'owner', 0, 'run-old', 'report-run.create', runPayload, true),
        aggregateType: 'report_run',
      })
    ).rejects.toThrow('PUBLISHED');
    const counts = await pool.query(
      `SELECT (SELECT count(*) FROM ie_audit_events WHERE organization_id=$1)::int audits,(SELECT count(*) FROM ie_outbox_events WHERE organization_id=$1)::int outbox`,
      [org]
    );
    expect(counts.rows[0]).toMatchObject({ audits: 7, outbox: 7 });
  });
});
