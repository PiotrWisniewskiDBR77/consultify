#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';

type GateCheck = {
  id: string;
  ok: boolean;
  details: string;
};

function collectFiles(dir: string, matcher: (absolutePath: string) => boolean): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectFiles(absolutePath, matcher));
      continue;
    }
    if (matcher(absolutePath)) out.push(absolutePath);
  }
  return out;
}

function readAll(paths: string[]): Array<{ path: string; contents: string }> {
  return paths.map((filePath) => ({
    path: path.relative(process.cwd(), filePath),
    contents: fs.readFileSync(filePath, 'utf8'),
  }));
}

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function writeReport(contents: string) {
  const dir = path.resolve(process.cwd(), 'server/exports');
  fs.mkdirSync(dir, { recursive: true });
  const fullPath = path.join(dir, `data-truth-release-gate-${stamp()}.md`);
  fs.writeFileSync(fullPath, contents, 'utf8');
  return fullPath;
}

function buildChecks(): GateCheck[] {
  const createDemoTables = read('server/scripts/create-demo-tables.ts');
  const cleanupFinance = read('server/scripts/cleanup-all-finance-data.ts');
  const legacyMigrate = read('server/scripts/migrate.js');
  const reimportAllStatements = read('server/scripts/reimport-all-statements.ts');
  const reimportWithLlm = read('server/scripts/reimport-with-llm-pipeline.ts');
  const financeHook = read('src/components/Economics/hooks/useFinanceData.ts');
  const initiativesHub = read('src/components/Initiatives/InitiativesHub.tsx');
  const rapHook = read('src/components/ReportsAndPresentations/useRapData.ts');
  const interviewHub = read('src/components/Interview/InterviewHub.tsx');
  const tasksView = read('src/components/MyWork/MyTasksListContent.tsx');
  const healthRoutes = read('server/src/routes/health.routes.ts');
  const dbTargetResolver = read('server/src/config/databaseTargetResolver.ts');
  const deployGate = read('scripts/deploy-gate.sh');
  const dataContextTest = read('tests/integration/routes/health-data-context.test.ts');
  const riskyScriptAllowlist = new Set([
    'server/scripts/create-demo-tables.ts',
    'server/scripts/cleanup-all-finance-data.ts',
    'server/scripts/reimport-all-statements.ts',
    'server/scripts/reimport-with-llm-pipeline.ts',
    'server/scripts/migrate.postgres.ts',
    'server/scripts/ensure-staging-schema-compat.ts',
    'server/scripts/db-inventory.ts',
    'server/scripts/db-truth-audit.ts',
    'server/scripts/reassign-finance-org-to-primary.ts',
  ]);
  const scriptFiles = readAll(
    collectFiles(path.resolve(process.cwd(), 'server/scripts'), (absolutePath) =>
      absolutePath.endsWith('.ts') || absolutePath.endsWith('.js')
    )
  );
  const unsafeRawDatabaseEnvScripts = scriptFiles.filter(
    ({ path: filePath, contents }) =>
      riskyScriptAllowlist.has(filePath) &&
      contents.includes('process.env.DATABASE_URL') &&
      !contents.includes('resolveScriptDatabaseTarget(') &&
      !contents.includes('resolveReachableDatabaseUrl(') &&
      !contents.includes('resolveFinanceImportDatabaseUrl(')
  );
  const unsafeDotenvScripts = scriptFiles.filter(
    ({ path: filePath, contents }) =>
      riskyScriptAllowlist.has(filePath) &&
      (contents.includes("dotenv.config(") || contents.includes("import 'dotenv/config'")) &&
      !contents.includes("import '../src/config/loadEnv.js'") &&
      !contents.includes("import '../../src/config/loadEnv.js'")
  );

  return [
    {
      id: 'no-hardcoded-db-url',
      ok:
        !createDemoTables.includes('postgresql://') &&
        !cleanupFinance.includes('postgresql://') &&
        !legacyMigrate.includes('postgresql://'),
      details: 'Critical operational scripts must not embed literal Postgres connection strings.',
    },
    {
      id: 'legacy-migrate-blocked',
      ok: legacyMigrate.includes('legacy migration runner is blocked'),
      details: 'Legacy `migrate.js` must refuse execution and redirect to `migrate.postgres.ts`.',
    },
    {
      id: 'critical-demo-fallbacks-gated',
      ok:
        financeHook.includes('shouldAllowDemoData') &&
        initiativesHub.includes('shouldAllowDemoData') &&
        rapHook.includes('shouldAllowDemoData') &&
        interviewHub.includes('shouldAllowDemoData'),
      details: 'Critical business modules must gate sample/demo data behind explicit demo mode.',
    },
    {
      id: 'task-scope-visible',
      ok:
        tasksView.includes('Scope: personal tasks') &&
        tasksView.includes('/my-work/personal-tasks') &&
        tasksView.includes('done/completed/validated'),
      details: 'My Work personal tasks view must state its endpoint and default hidden statuses.',
    },
    {
      id: 'data-context-endpoint',
      ok: healthRoutes.includes("/data-context") && healthRoutes.includes('activeOrganizationId'),
      details: 'Backend must expose an authenticated diagnostic endpoint with active data context.',
    },
    {
      id: 'resolver-validates-final-selected-host',
      ok:
        dbTargetResolver.includes('assertResolvedDatabaseUrlIsReachable') &&
        dbTargetResolver.includes('points to private Railway host') &&
        dbTargetResolver.includes('points to local host'),
      details:
        'Database target resolver must validate the final selected URL, including DATABASE_PUBLIC_URL and finance-import fallbacks.',
    },
    {
      id: 'dangerous-finance-reimport-scripts-hardened',
      ok:
        reimportAllStatements.includes('resolveFinanceImportDatabaseUrl()') &&
        reimportAllStatements.includes('resolveFinanceImportOrgId()') &&
        reimportAllStatements.includes('FINANCE_REIMPORT_CONFIRM') &&
        !reimportAllStatements.includes('a3e05d4a-5397-419d-b486-8e44366c0063') &&
        reimportWithLlm.includes('resolveFinanceImportDatabaseUrl()') &&
        reimportWithLlm.includes('resolveFinanceImportOrgId()') &&
        reimportWithLlm.includes('FINANCE_REIMPORT_LLM_CONFIRM') &&
        !reimportWithLlm.includes('a3e05d4a-5397-419d-b486-8e44366c0063'),
      details:
        'Dangerous finance reimport scripts must use shared target resolution, explicit org targeting, and destructive confirmations.',
    },
    {
      id: 'no-unsafe-raw-db-env-in-scripts',
      ok: unsafeRawDatabaseEnvScripts.length === 0,
      details:
        unsafeRawDatabaseEnvScripts.length === 0
          ? 'All script files route DB access through shared target helpers.'
          : `Unsafe raw DB env usage found in: ${unsafeRawDatabaseEnvScripts
              .map((item) => `\`${item.path}\``)
              .join(', ')}`,
    },
    {
      id: 'no-unsafe-manual-dotenv-in-scripts',
      ok: unsafeDotenvScripts.length === 0,
      details:
        unsafeDotenvScripts.length === 0
          ? 'All script files use shared env loading or explicit safe helpers.'
          : `Unsafe manual dotenv loading found in: ${unsafeDotenvScripts
              .map((item) => `\`${item.path}\``)
              .join(', ')}`,
    },
    {
      id: 'deploy-gate-checks-real-health-paths',
      ok:
        deployGate.includes('/api/health/ping') &&
        deployGate.includes('/api/health/ready') &&
        deployGate.includes('/api/health/database') &&
        deployGate.includes('release:gate:data-truth'),
      details:
        'Deploy gate must hit the real health endpoints and run the data-truth release gate before GO.',
    },
    {
      id: 'data-context-runtime-test-exists',
      ok:
        dataContextTest.includes('/api/health/data-context') &&
        dataContextTest.includes('DATABASE_PUBLIC_URL') &&
        dataContextTest.includes('X-Demo-Mode'),
      details:
        'The authenticated data-context endpoint must have runtime integration coverage for DB resolution and demo/header state.',
    },
  ];
}

async function main() {
  const checks = buildChecks();
  const allOk = checks.every((check) => check.ok);

  const lines: string[] = [];
  lines.push('# Data Truth Release Gate');
  lines.push('');
  lines.push(`- Generated: \`${new Date().toISOString()}\``);
  lines.push(`- Result: \`${allOk ? 'PASS' : 'FAIL'}\``);
  lines.push('');
  lines.push('## Checks');
  lines.push('');
  for (const check of checks) {
    lines.push(`- [${check.ok ? 'x' : ' '}] \`${check.id}\` - ${check.details}`);
  }

  const reportPath = writeReport(lines.join('\n'));
  console.log(`${allOk ? '✅' : '❌'} Data truth release gate: ${allOk ? 'PASS' : 'FAIL'}`);
  console.log(`- ${reportPath}`);

  if (!allOk) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Data truth release gate failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
