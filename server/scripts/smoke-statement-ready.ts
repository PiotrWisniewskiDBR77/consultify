#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

type Check = { name: string; pass: boolean };

function read(root: string, relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function includesAll(content: string, needles: string[]): boolean {
  return needles.every((needle) => content.includes(needle));
}

function main(): void {
  const root = process.cwd();
  const service = read(root, 'server/src/services/financialStatementService.ts');
  const routes = read(root, 'server/src/routes/finance-statements.routes.ts');
  const modeling = read(root, 'server/src/services/financialModelingService.ts');
  const analysis = read(root, 'server/src/services/financialAnalysisService.ts');
  const workspace = read(root, 'src/components/Finance/FinancialStatementWorkspace.tsx');
  const packWorkspace = read(root, 'src/components/Finance/FinancialStatementPackWorkspace.tsx');
  const packService = read(root, 'server/src/services/financialStatementPackService.ts');
  const documentIntel = read(root, 'server/src/services/documentIntelligenceService.ts');
  const contract = read(root, 'docs/product/STATEMENT_READY_CONTRACT.md');
  const migration = read(root, 'server/migrations/never-ran/668_statement_ready_contract.sql');
  const migrationRebuild = read(root, 'server/migrations/never-ran/669_statement_import_rebuild.sql');
  const packMigration = read(root, 'server/migrations/20260316_financial_statement_packs.sql');

  const checks: Check[] = [
    {
      name: 'Statement contract doc exists',
      pass: includesAll(contract, ['# Statement Ready Contract', '`statement-ready`', 'ready', 'recoverable', 'rejected']),
    },
    {
      name: 'Migration adds readiness contract tables',
      pass: includesAll(migration, [
        'readiness_status',
        'financial_statement_quality_runs',
        'financial_statement_value_versions',
        'financial_statement_line_aliases',
      ]),
    },
    {
      name: 'Service exposes readiness evaluation and document classification',
      pass: includesAll(service, [
        'classifyStatementDocument',
        'evaluateStatementReadiness',
        'recordStatementQualityRun',
        'learnStatementAliases',
        'locateStatementSections',
        'resolveDuplicateSuggestedMappings',
      ]),
    },
    {
      name: 'Routes persist readiness and enforce confirm gate',
      pass: includesAll(routes, [
        'updateStatementReadinessState',
        'recordStatementQualityRun',
        "error: 'Statement is not ready to confirm'",
        'readinessStatus',
        'document-intelligence/search',
        '/packs',
      ]),
    },
    {
      name: 'Rebuild migration adds ingest artifacts and repair sessions',
      pass: includesAll(migrationRebuild, [
        'financial_statement_ingest_runs',
        'financial_statement_source_artifacts',
        'financial_statement_candidate_rows',
        'financial_statement_mapping_candidates',
        'financial_statement_repair_sessions',
      ]),
    },
    {
      name: 'Pack migration adds pack tables and downstream references',
      pass: includesAll(packMigration, [
        'financial_statement_packs',
        'statement_pack_id',
        'source_statement_pack_id',
      ]),
    },
    {
      name: 'Pack service exposes sync and verified pack seed',
      pass: includesAll(packService, [
        'syncStatementToPack',
        'getVerifiedPackSeed',
        'listStatementPacks',
        'getStatementPackDetail',
      ]),
    },
    {
      name: 'Downstream only accepts statement-ready sources',
      pass: includesAll(modeling, ['readiness_status', 'Statement must be statement-ready']) &&
        includesAll(analysis, ["readiness_status = 'ready'", 'Only statement-ready statements can seed a financial analysis']) &&
        includesAll(modeling, ['sourceStatementPackId', 'buildSeededAssumptionsFromPack']) &&
        includesAll(analysis, ['sourceStatementPackId', 'getVerifiedPackSeed']),
    },
    {
      name: 'Workspace exposes pack-level view and underlying statement recovery',
      pass: includesAll(workspace, ['Recovery queue', 'qualityRuns']) &&
        includesAll(packWorkspace, ['Statement pack', 'FinancialStatementWorkspace', 'onCreateModelFromPack']),
    },
    {
      name: 'Document intelligence remains non-authoritative',
      pass: includesAll(documentIntel, ['authoritativeForNumbers: false', 'statement:', 'externalRagProvider']),
    },
  ];

  console.log('\n[smoke-statement-ready] Summary:');
  for (const check of checks) {
    console.log(` - ${check.pass ? 'OK' : 'FAIL'} ${check.name}`);
  }

  const failed = checks.filter((check) => !check.pass);
  if (failed.length > 0) {
    throw new Error(`Smoke failed: ${failed.map((check) => check.name).join(', ')}`);
  }
}

try {
  main();
} catch (error) {
  console.error('[smoke-statement-ready] Failed:', (error as Error)?.message || error);
  process.exit(1);
}
