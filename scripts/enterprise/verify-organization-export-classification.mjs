#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ALLOWED = new Set(['EXPORT', 'EXCLUDE_SECURITY', 'DERIVED']);
const REBUILD_SOURCE = /^(server\/|src\/|scripts\/|docs\/ssot\/)[^\s]*[^\s/]$/;
export function verifyClassificationInventory(inventory, options = {}) {
  const expectedTotal = options.expectedTotal ?? 1930;
  const repositoryRoot = options.repositoryRoot ?? process.cwd();
  const requiredColumnExclusions = options.requiredColumnExclusions ?? new Map();
  const requiredLifecycleStateExports = options.requiredLifecycleStateExports ?? new Set();
  const requireLifecycleStateCompleteness = options.requireLifecycleStateCompleteness ?? false;
  const v8Dispositions = options.v8Dispositions ?? new Map();
  const requireV8DispositionCompleteness = options.requireV8DispositionCompleteness ?? false;
  const publicDispositions = options.publicDispositions ?? new Map();
  const requirePublicDispositionCompleteness = options.requirePublicDispositionCompleteness ?? false;
  const validateSemanticEvidence = options.validateSemanticEvidence ?? false;
  const rows = Array.isArray(inventory?.tables) ? inventory.tables : [];
  const byIdentity = new Map();
  const invalidTables = new Set();
  const errors = [];

  const reject = (identity, message) => {
    invalidTables.add(identity);
    errors.push(`${identity}: ${message}`);
  };

  // Build the full identity index before validating cross-table ownership or
  // derivation. Validation must not depend on alphabetical row order.
  for (const row of rows) {
    const identity = `${row?.schema}.${row?.table}`;
    if (byIdentity.has(identity)) reject(identity, 'duplicate identity');
    byIdentity.set(identity, row);
  }

  for (const row of rows) {
    const identity = `${row?.schema}.${row?.table}`;
    if (!['public', 'v8'].includes(row?.schema) || typeof row?.table !== 'string' || !row.table) {
      reject(identity, 'invalid schema-qualified identity');
      continue;
    }
    if (!ALLOWED.has(row.classification)) {
      reject(identity, `unresolved or invalid classification ${String(row.classification)}`);
    }
    if (
      typeof row.family !== 'string' ||
      row.family.trim() === '' ||
      row.family === 'UNREVIEWED'
    ) {
      reject(identity, 'missing reviewed family');
    }
    if (typeof row.reason !== 'string' || row.reason.trim().split(/\s+/).length < 4) {
      reject(identity, 'missing one-sentence rationale');
    }
    if (
      ALLOWED.has(row.classification) &&
      (typeof row.sourceEvidence !== 'string' || row.sourceEvidence.trim().length < 4)
    ) {
      reject(identity, 'classified row requires explicit sourceEvidence');
    }
    if (row.classification === 'EXPORT') {
      const liveColumns = (row.columns ?? []).map((column) => column.name);
      const projection = Array.isArray(row.projection) ? row.projection : [];
      const excludedColumns = Array.isArray(row.excludedColumns) ? row.excludedColumns : [];
      if (
        new Set(projection).size !== projection.length ||
        new Set(excludedColumns).size !== excludedColumns.length ||
        projection.some((column) => excludedColumns.includes(column)) ||
        [...projection, ...excludedColumns].sort().join('\0') !==
          [...liveColumns].sort().join('\0')
      ) {
        reject(identity, 'projection and excludedColumns must exactly partition live columns');
      }
      if (
        !row.columnPolicy ||
        typeof row.columnPolicy.reason !== 'string' ||
        row.columnPolicy.reason.trim().split(/\s+/).length < 6 ||
        typeof row.columnPolicy.sourceEvidence !== 'string' ||
        row.columnPolicy.sourceEvidence.trim().length < 4
      ) {
        reject(identity, 'EXPORT requires an explicit columnPolicy reason and sourceEvidence');
      }
      const columnDecisions = Array.isArray(row.columnDecisions) ? row.columnDecisions : [];
      if (
        columnDecisions.length !== liveColumns.length ||
        new Set(columnDecisions.map((decision) => decision.column)).size !== liveColumns.length
      ) {
        reject(identity, 'columnDecisions must classify every live column exactly once');
      }
      for (const decision of columnDecisions) {
        const expected = excludedColumns.includes(decision.column)
          ? 'EXCLUDE_SECURITY_COLUMN'
          : 'EXPORT_COLUMN';
        if (decision.category !== expected) {
          reject(identity, `column decision mismatch for ${decision.column}`);
        }
        if (
          typeof decision.reason !== 'string' ||
          decision.reason.trim().split(/\s+/).length < 6 ||
          typeof decision.sourceEvidence !== 'string' ||
          decision.sourceEvidence.trim().length < 4
        ) {
          reject(identity, `column decision lacks rationale/evidence for ${decision.column}`);
        }
      }
      for (const required of requiredColumnExclusions.get(identity) ?? []) {
        if (!excludedColumns.includes(required)) {
          reject(identity, `required privacy exclusion missing: ${required}`);
        }
      }
      const hasLiveState = liveColumns.includes('state');
      if (requiredLifecycleStateExports.has(identity)) {
        if (!hasLiveState || !projection.includes('state')) {
          reject(identity, 'required business lifecycle export missing: state');
        }
        const stateDecision = columnDecisions.find((decision) => decision.column === 'state');
        if (stateDecision?.category !== 'EXPORT_COLUMN') {
          reject(identity, 'business lifecycle state must have an EXPORT_COLUMN decision');
        }
      } else if (requireLifecycleStateCompleteness && hasLiveState) {
        reject(identity, 'exportable state column lacks an exact lifecycle-state policy');
      }
      if (
        row.family === 'TENANT_OWNED_RELATION' ||
        row.sourceEvidence.startsWith('staging-schema-inventory.json::')
      ) {
        reject(identity, 'EXPORT requires semantic family and active source evidence');
      }
      if (!Array.isArray(row.semanticEvidence) || row.semanticEvidence.length === 0) {
        reject(identity, 'EXPORT requires parser-verifiable semanticEvidence');
      } else if (validateSemanticEvidence) {
        let accepted = false;
        for (const evidence of row.semanticEvidence) {
          if (!evidence || typeof evidence !== 'object' || typeof evidence.path !== 'string') continue;
          const absolute = path.resolve(repositoryRoot, evidence.path);
          if (!fs.existsSync(absolute)) continue;
          if (evidence.kind === 'EXPLICIT_POLICY') {
            if (
              evidence.path !==
              'docs/ssot/organization-export-explicit-semantic-overrides.e1.json'
            ) {
              continue;
            }
            try {
              const policy = JSON.parse(fs.readFileSync(absolute, 'utf8'));
              accepted ||= policy.entries?.some((entry) => entry.identity === identity) === true;
            } catch {
              // Invalid policy is not evidence.
            }
            continue;
          }
          if (evidence.kind === 'PUBLIC_BUSINESS_DISPOSITION') {
            if (
              evidence.path !==
              'docs/ssot/organization-export-public-business-dispositions.e1.json'
            ) continue;
            try {
              const policy = JSON.parse(fs.readFileSync(absolute, 'utf8'));
              const disposition = policy.entries?.find((entry) => entry.identity === identity);
              if (!disposition || disposition.classification !== 'EXPORT') continue;
              accepted ||= (disposition.runtimeReferences ?? []).some((reference) => {
                const match = /^(server\/src\/[^:]+):(\d+)$/.exec(reference);
                if (!match) return false;
                const runtimePath = path.resolve(repositoryRoot, match[1]);
                if (!fs.existsSync(runtimePath)) return false;
                const line = fs.readFileSync(runtimePath, 'utf8').split(/\r?\n/)[Number(match[2]) - 1] ?? '';
                return new RegExp(`\\b${row.table.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`).test(line);
              });
              if (!accepted && identity === 'public._v8_flag_backup_20260710') {
                accepted = disposition.snapshotRows === 0 && disposition.runtimeReferences?.length === 0;
              }
            } catch {
              // Invalid disposition is not evidence.
            }
            continue;
          }
          if (!Number.isInteger(evidence.line) || evidence.line < 1) continue;
          if (!evidence.path.startsWith('server/src/')) continue;
          const source = fs
            .readFileSync(absolute, 'utf8')
            .replace(/\/\*[\s\S]*?\*\//g, (comment) => '\n'.repeat(comment.split('\n').length - 1))
            .replace(/(^|\s)\/\/[^\n]*/g, '$1');
          const lines = source.split(/\r?\n/);
          // The index records the exact line at which the relation token starts.
          // A wider window can accidentally validate a neighboring statement for
          // a same-named relation in another schema.
          const chunk = lines[evidence.line - 1] ?? '';
          const escaped = row.table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          if (evidence.kind === 'EXPORT_POLICY') {
            if (row.schema !== 'public') continue;
            if (!/server\/src\/services\/organizationExport.*Contract\.ts$/.test(evidence.path)) {
              continue;
            }
            accepted ||= new RegExp(`\\btable\\s*:\\s*['\"]${escaped}['\"]`).test(chunk);
          } else if (typeof evidence.kind === 'string' && evidence.kind.startsWith('SQL_')) {
            const verb = evidence.kind
              .slice(4)
              .replaceAll('_', '\\s+')
              .replace('INSERT\\s+INTO', 'INSERT\\s+INTO');
            const relation =
              row.schema === 'public'
                ? `(?:public\\.)?['\"\`]?${escaped}['\"\`]?`
                : `${row.schema}\\.['\"\`]?${escaped}['\"\`]?`;
            accepted ||= new RegExp(`\\b${verb}\\s+${relation}`, 'i').test(chunk);
          }
        }
        if (!accepted) reject(identity, 'semanticEvidence is not an executable SQL or exact policy source');
      }
      const ownership = row.ownership;
      if (!ownership || typeof ownership !== 'object' || Array.isArray(ownership)) {
        reject(identity, 'EXPORT requires structured ownership evidence');
      } else if (ownership.kind === 'ORGANIZATION_ROOT') {
        if (identity !== 'public.organizations' || ownership.column !== 'id') {
          reject(identity, 'ORGANIZATION_ROOT is reserved for public.organizations.id');
        }
      } else if (ownership.kind === 'DIRECT_COLUMN') {
        const columns = new Set((row.columns ?? []).map((column) => column.name));
        if (!['organization_id', 'org_id', 'tenant_id'].includes(ownership.column)) {
          reject(identity, 'DIRECT_COLUMN must use a reviewed tenant discriminator');
        } else if (!columns.has(ownership.column)) {
          reject(identity, `DIRECT_COLUMN ${ownership.column} is absent from live columns`);
        }
      } else if (ownership.kind === 'FOREIGN_KEY_PATH') {
        if (!Array.isArray(ownership.path) || ownership.path.length === 0) {
          reject(identity, 'FOREIGN_KEY_PATH requires at least one catalog edge');
        } else {
          let cursor = identity;
          for (const edge of ownership.path) {
            const child = byIdentity.get(cursor);
            const edgeIdentity = `${edge?.parentSchema}.${edge?.parentTable}`;
            const matches = (child?.foreignKeys ?? []).some(
              (candidate) =>
                candidate.column === edge?.column &&
                candidate.parentSchema === edge?.parentSchema &&
                candidate.parentTable === edge?.parentTable &&
                candidate.parentColumn === edge?.parentColumn
            );
            if (!matches) reject(identity, `ownership path edge from ${cursor} is absent`);
            cursor = edgeIdentity;
          }
          const root = byIdentity.get(cursor);
          const rootColumns = new Set((root?.columns ?? []).map((column) => column.name));
          if (
            cursor !== 'public.organizations' &&
            !['organization_id', 'org_id', 'tenant_id'].some((column) => rootColumns.has(column))
          ) {
            reject(identity, `ownership path terminus ${cursor} has no tenant discriminator`);
          }
        }
      } else {
        reject(identity, 'ownership.kind must be ORGANIZATION_ROOT, DIRECT_COLUMN, or FOREIGN_KEY_PATH');
      }
    }
    if (
      row.classification === 'EXCLUDE_SECURITY' &&
      ![
        'CREDENTIAL_OR_SESSION_MATERIAL',
        'NO_PROVABLE_TENANT_BOUNDARY',
        'ACTIVE_SEMANTIC_POLICY_MISSING',
      ].includes(
        row.exclusionBasis
      )
    ) {
      reject(identity, 'EXCLUDE_SECURITY requires an explicit exclusionBasis');
    }
    if (requirePublicDispositionCompleteness && row.schema === 'public' && row.exclusionBasis === 'ACTIVE_SEMANTIC_POLICY_MISSING') {
      reject(identity, 'active public business relation remains semantically unresolved');
    }
    if (requirePublicDispositionCompleteness && publicDispositions.has(identity)) {
      const disposition = publicDispositions.get(identity);
      if (row.classification !== disposition.classification) {
        reject(identity, 'classification differs from exact public business disposition');
      }
      if (row.family !== disposition.family) {
        reject(identity, 'family differs from exact public business disposition');
      }
    }
    if (
      requirePublicDispositionCompleteness &&
      row.schema === 'public' &&
      row.semanticEvidence?.some((evidence) => evidence?.kind === 'PUBLIC_BUSINESS_DISPOSITION') &&
      !publicDispositions.has(identity)
    ) {
      reject(identity, 'exact public business disposition entry is missing');
    }
    if (row.schema === 'v8' && row.classification === 'EXCLUDE_SECURITY' && requireV8DispositionCompleteness) {
      const disposition = v8Dispositions.get(identity);
      if (!disposition) {
        reject(identity, 'excluded v8 relation requires an exact reviewed disposition');
      } else {
        if (row.v8Disposition !== disposition.disposition) {
          reject(identity, 'classification v8Disposition differs from reviewed disposition');
        }
        if (
          !['HISTORICAL_PARALLEL_SCHEMA_COPY', 'INACTIVE_SCHEMA_ONLY_RELATION', 'SECURITY_CREDENTIAL_STATE'].includes(
            disposition.disposition
          )
        ) {
          reject(identity, 'unknown v8 disposition');
        }
        if (disposition.snapshotRows !== 0) {
          reject(identity, 'inactive v8 disposition requires measured zero snapshot rows');
        }
        if (!Array.isArray(disposition.activeSchemaQualifiedWriterEvidence) || disposition.activeSchemaQualifiedWriterEvidence.length !== 0) {
          reject(identity, 'inactive v8 disposition cannot retain active qualified writer evidence');
        }
        if (!Array.isArray(disposition.sourceEvidence) || disposition.sourceEvidence.length < 3) {
          reject(identity, 'v8 disposition requires DDL, live count, and active-writer evidence');
        }
      }
    }
  }

  const measured = {
    public: rows.filter((row) => row?.schema === 'public').length,
    v8: rows.filter((row) => row?.schema === 'v8').length,
    total: rows.length,
    classified: rows.filter((row) => ALLOWED.has(row?.classification)).length,
    unresolved: rows.filter((row) => !ALLOWED.has(row?.classification)).length,
  };
  for (const key of ['public', 'v8', 'total', 'classified', 'unresolved']) {
    const declared = Number(inventory?.counts?.[key]);
    if (!Number.isInteger(declared) || declared !== measured[key]) {
      reject(
        'inventory',
        `${key} count ${String(inventory?.counts?.[key])} != measured ${measured[key]}`
      );
    }
  }
  for (const identity of requiredLifecycleStateExports) {
    if (byIdentity.get(identity)?.classification !== 'EXPORT') {
      reject(identity, 'required lifecycle-state policy must identify an EXPORT relation');
    }
  }
  if (requireV8DispositionCompleteness) {
    for (const identity of v8Dispositions.keys()) {
      const row = byIdentity.get(identity);
      if (row?.schema !== 'v8' || row?.classification !== 'EXCLUDE_SECURITY') {
        reject(identity, 'v8 disposition must map exactly to an excluded schema-v8 relation');
      }
    }
  }
  if (requirePublicDispositionCompleteness) {
    for (const identity of publicDispositions.keys()) {
      if (!byIdentity.has(identity)) reject(identity, 'public business disposition identity is absent');
    }
  }
  if (measured.classified + measured.unresolved !== measured.total) {
    reject('inventory', 'classified and unresolved counts do not partition the inventory');
  }
  if (byIdentity.size !== measured.total) {
    reject('inventory', `unique identity count ${byIdentity.size} != row count ${measured.total}`);
  }
  if (measured.total !== expectedTotal) {
    reject('inventory', `staging denominator ${measured.total} != ${expectedTotal}`);
  }

  const tableDependencies = new Map();
  for (const [identity, row] of byIdentity) {
    if (row.classification !== 'DERIVED') continue;
    const derivedFrom = row.derivedFrom;
    if (!derivedFrom || typeof derivedFrom !== 'object' || Array.isArray(derivedFrom)) {
      reject(identity, 'DERIVED requires a structured derivedFrom');
      continue;
    }
    if (derivedFrom.kind === 'TABLES') {
      if (
        !Array.isArray(derivedFrom.tables) ||
        derivedFrom.tables.length === 0 ||
        new Set(derivedFrom.tables).size !== derivedFrom.tables.length ||
        !derivedFrom.tables.every(
          (source) => typeof source === 'string' && /^(public|v8)\.[^.]+$/.test(source)
        )
      ) {
        reject(identity, 'TABLES derivedFrom requires unique schema-qualified table identities');
        continue;
      }
      tableDependencies.set(identity, derivedFrom.tables);
      for (const source of derivedFrom.tables) {
        if (source === identity) reject(identity, 'DERIVED cannot reference itself');
        const sourceRow = byIdentity.get(source);
        if (!sourceRow) reject(identity, `derived source ${source} is absent`);
        else if (sourceRow.classification === 'EXCLUDE_SECURITY') {
          reject(identity, `derived source ${source} is security-excluded`);
        } else if (!['EXPORT', 'DERIVED'].includes(sourceRow.classification)) {
          reject(identity, `derived source ${source} is not a reviewed source`);
        }
      }
    } else if (derivedFrom.kind === 'REBUILD_PROCEDURE') {
      if (
        typeof derivedFrom.sourcePath !== 'string' ||
        !REBUILD_SOURCE.test(derivedFrom.sourcePath) ||
        derivedFrom.sourcePath.includes('..')
      ) {
        reject(identity, 'sourcePath must point to a reviewed repository artifact');
      } else if (!fs.existsSync(path.resolve(repositoryRoot, derivedFrom.sourcePath))) {
        reject(identity, `sourcePath does not exist: ${derivedFrom.sourcePath}`);
      }
      if (
        typeof derivedFrom.procedure !== 'string' ||
        derivedFrom.procedure.trim().split(/\s+/).length < 6
      ) {
        reject(identity, 'procedure must be an actionable sentence');
      }
    } else {
      reject(identity, 'derivedFrom.kind must be TABLES or REBUILD_PROCEDURE');
    }
  }

  const visiting = new Set();
  const visited = new Set();
  const visit = (identity, path = []) => {
    if (visiting.has(identity)) {
      for (const member of [...path, identity]) reject(member, 'derived dependency cycle');
      return;
    }
    if (visited.has(identity)) return;
    visiting.add(identity);
    for (const source of tableDependencies.get(identity) ?? []) {
      if (byIdentity.get(source)?.classification === 'DERIVED') visit(source, [...path, identity]);
    }
    visiting.delete(identity);
    visited.add(identity);
  };
  for (const identity of tableDependencies.keys()) visit(identity);

  return { errors, invalidTables, measured };
}

function runCli() {
  const inventoryPath = process.argv[2];
  const exclusionsPath = process.argv[3];
  const lifecycleStatePath = process.argv[4];
  const v8DispositionsPath = process.argv[5];
  if (!inventoryPath || !exclusionsPath || !lifecycleStatePath || !v8DispositionsPath) {
    console.error(
      'usage: verify-organization-export-classification.mjs <inventory.json> <required-exclusions.json> <required-lifecycle-state.json> <v8-dispositions.json>'
    );
    process.exitCode = 2;
    return;
  }
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  const exclusions = JSON.parse(fs.readFileSync(exclusionsPath, 'utf8'));
  const lifecycleState = JSON.parse(fs.readFileSync(lifecycleStatePath, 'utf8'));
  const v8DispositionDocument = JSON.parse(fs.readFileSync(v8DispositionsPath, 'utf8'));
  const publicDispositionDocument = JSON.parse(
    fs.readFileSync(
      path.resolve(process.cwd(), 'docs/ssot/organization-export-public-business-dispositions.e1.json'),
      'utf8'
    )
  );
  const requiredColumnExclusions = new Map(
    exclusions.tables.map((row) => [`${row.schema}.${row.table}`, row.columns])
  );
  const result = verifyClassificationInventory(inventory, {
    requiredColumnExclusions,
    requiredLifecycleStateExports: new Set(
      lifecycleState.tables.map((row) => `${row.schema}.${row.table}`)
    ),
    requireLifecycleStateCompleteness: true,
    v8Dispositions: new Map(v8DispositionDocument.entries.map((row) => [row.identity, row])),
    requireV8DispositionCompleteness: true,
    publicDispositions: new Map(publicDispositionDocument.entries.map((row) => [row.identity, row])),
    requirePublicDispositionCompleteness: true,
    validateSemanticEvidence: true,
  });
  if (result.errors.length) {
    console.error(
      `ORGANIZATION_EXPORT_CLASSIFICATION_RED tables=${result.invalidTables.size}/${result.measured.total} errors=${result.errors.length}`
    );
    for (const error of result.errors.slice(0, 25)) console.error(error);
    if (result.errors.length > 25) console.error(`... ${result.errors.length - 25} more`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `ORGANIZATION_EXPORT_CLASSIFICATION_GREEN ${result.measured.classified}/${result.measured.total}`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runCli();
