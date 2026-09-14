import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { verifyClassificationInventory } from '../verify-organization-export-classification.mjs';

const exportRow = (table) => ({
  schema: 'public',
  table,
  classification: 'EXPORT',
  family: 'BUSINESS',
  reason: 'This tenant-owned source table is included through an explicit reviewed policy.',
  sourceEvidence: 'server/src/services/example.ts',
  columns: [{ name: 'organization_id' }],
  foreignKeys: [],
  projection: ['organization_id'],
  excludedColumns: [],
  columnPolicy: {
    reason: 'The exact safe projection includes the tenant discriminator only.',
    sourceEvidence: 'server/src/services/example.ts',
  },
  columnDecisions: [
    {
      column: 'organization_id',
      category: 'EXPORT_COLUMN',
      reason: 'The semantic table policy explicitly includes this tenant discriminator.',
      sourceEvidence: 'server/src/services/example.ts',
    },
  ],
  semanticEvidence: [{ kind: 'EXPLICIT_POLICY', path: 'docs/ssot/example.json' }],
  ownership: { kind: 'DIRECT_COLUMN', column: 'organization_id' },
});

const derivedRow = (table, derivedFrom) => ({
  schema: 'public',
  table,
  classification: 'DERIVED',
  family: 'DERIVED_VIEW',
  reason: 'This projection is rebuilt deterministically from its named canonical source.',
  sourceEvidence: 'server/src/services/exampleProjection.ts',
  derivedFrom,
});

const inventory = (tables, counts = {}) => ({
  counts: {
    public: tables.filter((row) => row.schema === 'public').length,
    v8: tables.filter((row) => row.schema === 'v8').length,
    total: tables.length,
    classified: tables.filter((row) => row.classification !== 'UNRESOLVED').length,
    unresolved: tables.filter((row) => row.classification === 'UNRESOLVED').length,
    ...counts,
  },
  tables,
});

test('accepts an acyclic DERIVED chain that terminates in an EXPORT table', () => {
  const subject = inventory([
    exportRow('source'),
    derivedRow('projection', { kind: 'TABLES', tables: ['public.source'] }),
    derivedRow('cache', { kind: 'TABLES', tables: ['public.projection'] }),
  ]);
  assert.deepEqual(verifyClassificationInventory(subject, { expectedTotal: 3 }).errors, []);
});

test('accepts an explicit repository rebuild procedure', () => {
  const subject = inventory([
    derivedRow('migration_marker', {
      kind: 'REBUILD_PROCEDURE',
      sourcePath: 'scripts/enterprise/verify-organization-export-classification.mjs',
      procedure: 'Run the named additive migration on an empty database.',
    }),
  ]);
  assert.deepEqual(verifyClassificationInventory(subject, { expectedTotal: 1 }).errors, []);
});

test('rejects metadata counts that do not match the rows', () => {
  const subject = inventory([exportRow('source')], { classified: 0, unresolved: 1 });
  const result = verifyClassificationInventory(subject, { expectedTotal: 1 });
  assert.match(result.errors.join('\n'), /classified count 0 != measured 1/);
  assert.match(result.errors.join('\n'), /unresolved count 1 != measured 0/);
});

test('rejects an unresolved newly discovered relation even when declared counts lie', () => {
  const subject = inventory(
    [
      exportRow('source'),
      {
        schema: 'public',
        table: 'new_migration_table',
        classification: 'UNRESOLVED',
        family: 'UNREVIEWED',
        reason: 'Awaiting explicit review before any export authority can be granted.',
      },
    ],
    { classified: 2, unresolved: 0 }
  );
  const result = verifyClassificationInventory(subject, { expectedTotal: 2 });
  assert.ok(result.invalidTables.has('public.new_migration_table'));
  assert.match(result.errors.join('\n'), /classified count 2 != measured 1/);
  assert.match(result.errors.join('\n'), /unresolved count 0 != measured 1/);
});

test('rejects free text, missing, self, security and cyclic DERIVED sources', () => {
  const security = {
    schema: 'public',
    table: 'secrets',
    classification: 'EXCLUDE_SECURITY',
    family: 'SECURITY',
    reason: 'Credential material is excluded from every organization export by policy.',
    sourceEvidence: 'server/src/services/securityPolicy.ts',
    exclusionBasis: 'CREDENTIAL_OR_SESSION_MATERIAL',
  };
  const subject = inventory([
    exportRow('source'),
    security,
    derivedRow('free_text', 'public.source'),
    derivedRow('missing', { kind: 'TABLES', tables: ['public.absent'] }),
    derivedRow('self', { kind: 'TABLES', tables: ['public.self'] }),
    derivedRow('from_security', { kind: 'TABLES', tables: ['public.secrets'] }),
    derivedRow('cycle_a', { kind: 'TABLES', tables: ['public.cycle_b'] }),
    derivedRow('cycle_b', { kind: 'TABLES', tables: ['public.cycle_a'] }),
  ]);
  const result = verifyClassificationInventory(subject, { expectedTotal: 8 });
  const errors = result.errors.join('\n');
  assert.match(errors, /public\.free_text: DERIVED requires a structured derivedFrom/);
  assert.match(errors, /public\.missing: derived source public\.absent is absent/);
  assert.match(errors, /public\.self: DERIVED cannot reference itself/);
  assert.match(errors, /public\.from_security: derived source public\.secrets is security-excluded/);
  assert.match(errors, /derived dependency cycle/);
});

test('rejects vague or unsafe rebuild procedure pointers', () => {
  const subject = inventory([
    derivedRow('unsafe', {
      kind: 'REBUILD_PROCEDURE',
      sourcePath: '../outside.sh',
      procedure: 'rerun it',
    }),
  ]);
  const errors = verifyClassificationInventory(subject, { expectedTotal: 1 }).errors.join('\n');
  assert.match(errors, /sourcePath must point to a reviewed repository artifact/);
  assert.match(errors, /procedure must be an actionable sentence/);
});

test('rejects mutation removing exact interview and webhook exclusions', () => {
  const interview = {
    ...exportRow('interview_distributions'),
    columns: [
      { name: 'organization_id' },
      { name: 'recipient_email' },
      { name: 'recipient_name' },
      { name: 'public_token' },
      { name: 'revoked_by' },
    ],
    projection: ['organization_id'],
    excludedColumns: ['recipient_email', 'recipient_name', 'public_token', 'revoked_by'],
    columnDecisions: [
      { column: 'organization_id', category: 'EXPORT_COLUMN', reason: 'The reviewed policy includes the tenant discriminator as business scope.', sourceEvidence: 'test policy' },
      ...['recipient_email', 'recipient_name', 'public_token', 'revoked_by'].map((column) => ({ column, category: 'EXCLUDE_SECURITY_COLUMN', reason: 'The reviewed DEC-493 policy excludes this identity or access field.', sourceEvidence: 'test policy' })),
    ],
  };
  const webhook = {
    ...exportRow('integration_webhooks'),
    columns: [{ name: 'organization_id' }, { name: 'webhook_secret' }],
    projection: ['organization_id'],
    excludedColumns: ['webhook_secret'],
    columnDecisions: [
      { column: 'organization_id', category: 'EXPORT_COLUMN', reason: 'The reviewed policy includes the tenant discriminator as business scope.', sourceEvidence: 'test policy' },
      { column: 'webhook_secret', category: 'EXCLUDE_SECURITY_COLUMN', reason: 'The reviewed policy excludes webhook signing material from every export.', sourceEvidence: 'test policy' },
    ],
  };
  const valid = inventory([interview, webhook]);
  const requiredColumnExclusions = new Map([
    ['public.interview_distributions', ['recipient_email', 'recipient_name', 'public_token', 'revoked_by']],
    ['public.integration_webhooks', ['webhook_secret']],
  ]);
  assert.deepEqual(
    verifyClassificationInventory(valid, { expectedTotal: 2, requiredColumnExclusions }).errors,
    []
  );
  for (const [table, column] of [
    ['interview_distributions', 'recipient_email'],
    ['interview_distributions', 'recipient_name'],
    ['interview_distributions', 'public_token'],
    ['interview_distributions', 'revoked_by'],
    ['integration_webhooks', 'webhook_secret'],
  ]) {
    const mutated = structuredClone(valid);
    const row = mutated.tables.find((candidate) => candidate.table === table);
    row.excludedColumns = row.excludedColumns.filter((candidate) => candidate !== column);
    row.projection.push(column);
    const errors = verifyClassificationInventory(mutated, {
      expectedTotal: 2,
      requiredColumnExclusions,
    }).errors.join('\n');
    assert.match(errors, new RegExp(`required privacy exclusion missing: ${column}`));
  }
});

test('rejects structural-only generic export evidence', () => {
  const row = exportRow('generic');
  row.family = 'TENANT_OWNED_RELATION';
  row.sourceEvidence = 'staging-schema-inventory.json::public.generic live column organization_id';
  const errors = verifyClassificationInventory(inventory([row]), { expectedTotal: 1 }).errors.join('\n');
  assert.match(errors, /requires semantic family and active source evidence/);
});

test('required-exclusions policy makes code_hash and every DEC-493 identity mutation RED', () => {
  const required = new Map([
    ['public.access_codes', ['code_hash']],
    ['public.interview_ai_parse_log', ['applied_by']],
    ['public.interview_assignment_events', ['actor_id']],
    ['public.interview_candidate_handoffs', ['created_by']],
    ['public.interview_evidence_access_log', ['actor_id', 'ip_address']],
    ['public.interview_insight_activity', ['user_id']],
    ['public.interview_inference_runs', ['created_by']],
    ['public.interview_report_packs', ['created_by']],
  ]);
  const rows = [...required].map(([identity, excluded]) => {
    const table = identity.slice('public.'.length);
    return {
      ...exportRow(table),
      columns: [{ name: 'organization_id' }, ...excluded.map((name) => ({ name }))],
      projection: ['organization_id'],
      excludedColumns: [...excluded],
      columnDecisions: [
        { column: 'organization_id', category: 'EXPORT_COLUMN', reason: 'The reviewed policy includes the tenant discriminator as business scope.', sourceEvidence: 'test policy' },
        ...excluded.map((column) => ({ column, category: 'EXCLUDE_SECURITY_COLUMN', reason: 'The reviewed policy excludes this identity or credential field from output.', sourceEvidence: 'test policy' })),
      ],
    };
  });
  const valid = inventory(rows);
  assert.deepEqual(
    verifyClassificationInventory(valid, {
      expectedTotal: rows.length,
      requiredColumnExclusions: required,
    }).errors,
    []
  );
  for (const [identity, excluded] of required) {
    for (const column of excluded) {
      const mutated = structuredClone(valid);
      const row = mutated.tables.find((candidate) => `public.${candidate.table}` === identity);
      row.excludedColumns = row.excludedColumns.filter((candidate) => candidate !== column);
      row.projection.push(column);
      row.columnDecisions.find((decision) => decision.column === column).category = 'EXPORT_COLUMN';
      const errors = verifyClassificationInventory(mutated, {
        expectedTotal: rows.length,
        requiredColumnExclusions: required,
      }).errors.join('\n');
      assert.match(errors, new RegExp(`required privacy exclusion missing: ${column}`));
    }
  }
});

test('semantic evidence rejects comments and accepts the same exact executable SQL', () => {
  const repositoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'e1-semantic-evidence-'));
  const relative = 'server/src/source.ts';
  const absolute = path.join(repositoryRoot, relative);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  const row = exportRow('fake_table');
  row.semanticEvidence = [{ kind: 'SQL_INSERT_INTO', path: relative, line: 1 }];
  const subject = inventory([row]);
  try {
    fs.writeFileSync(absolute, '// INSERT INTO fake_table(id) VALUES (1);\n');
    let errors = verifyClassificationInventory(subject, {
      expectedTotal: 1,
      repositoryRoot,
      validateSemanticEvidence: true,
    }).errors.join('\n');
    assert.match(errors, /not an executable SQL or exact policy source/);
    fs.writeFileSync(absolute, 'const query = `INSERT INTO fake_table(id) VALUES (1)`;\n');
    errors = verifyClassificationInventory(subject, {
      expectedTotal: 1,
      repositoryRoot,
      validateSemanticEvidence: true,
    }).errors.join('\n');
    assert.equal(errors, '');
  } finally {
    fs.rmSync(repositoryRoot, { recursive: true, force: true });
  }
});

test('unqualified public writer cannot authorize a same-named v8 physical relation', () => {
  const repositoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'e1-schema-collision-'));
  const relative = 'server/src/source.ts';
  const absolute = path.join(repositoryRoot, relative);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, 'const query = `INSERT INTO shared_name(id) VALUES (1)`;\n');
  const publicRow = exportRow('shared_name');
  publicRow.semanticEvidence = [{ kind: 'SQL_INSERT_INTO', path: relative, line: 1 }];
  const v8Row = { ...structuredClone(publicRow), schema: 'v8' };
  try {
    assert.deepEqual(
      verifyClassificationInventory(inventory([publicRow]), {
        expectedTotal: 1,
        repositoryRoot,
        validateSemanticEvidence: true,
      }).errors,
      []
    );
    assert.match(
      verifyClassificationInventory(inventory([v8Row]), {
        expectedTotal: 1,
        repositoryRoot,
        validateSemanticEvidence: true,
      }).errors.join('\n'),
      /semanticEvidence is not an executable SQL or exact policy source/
    );
    fs.writeFileSync(absolute, 'const query = `INSERT INTO v8.shared_name(id) VALUES (1)`;\n');
    assert.deepEqual(
      verifyClassificationInventory(inventory([v8Row]), {
        expectedTotal: 1,
        repositoryRoot,
        validateSemanticEvidence: true,
      }).errors,
      []
    );
  } finally {
    fs.rmSync(repositoryRoot, { recursive: true, force: true });
  }
});

test('exact lifecycle-state policy rejects exclusion and incomplete coverage mutations', () => {
  const row = exportRow('workflow');
  row.columns.push({ name: 'state' });
  row.projection.push('state');
  row.columnDecisions.push({
    column: 'state',
    category: 'EXPORT_COLUMN',
    reason: 'The exact reviewed policy classifies this state as business lifecycle data.',
    sourceEvidence: 'test lifecycle policy',
  });
  const requiredLifecycleStateExports = new Set(['public.workflow']);
  const options = {
    expectedTotal: 1,
    requiredLifecycleStateExports,
    requireLifecycleStateCompleteness: true,
  };
  assert.deepEqual(verifyClassificationInventory(inventory([row]), options).errors, []);

  const excluded = structuredClone(row);
  excluded.projection = excluded.projection.filter((column) => column !== 'state');
  excluded.excludedColumns.push('state');
  excluded.columnDecisions.find((decision) => decision.column === 'state').category =
    'EXCLUDE_SECURITY_COLUMN';
  assert.match(
    verifyClassificationInventory(inventory([excluded]), options).errors.join('\n'),
    /required business lifecycle export missing: state/
  );

  assert.match(
    verifyClassificationInventory(inventory([row]), {
      expectedTotal: 1,
      requireLifecycleStateCompleteness: true,
    }).errors.join('\n'),
    /exportable state column lacks an exact lifecycle-state policy/
  );
});
