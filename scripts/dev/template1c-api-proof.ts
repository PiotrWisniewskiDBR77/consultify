import fs from 'node:fs/promises';
import path from 'node:path';

const NORTHWIND_ORG_ID = '468b234c-66c4-54e1-b626-5e0fb3a92f6a';
const NORTHWIND_OWNER_ID = '08c54d75-5260-57b1-9db6-a30aed89a587';
const SHEET_BASE_ID = '2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1';
const INVENTORY_95_ARTIFACT_ID = '0a757a44-2ef4-466a-9231-dff14b89e515';
const LEGACY_REPORT_ID = 'tpl-interview-summary';

function fail(message: string): never {
  throw new Error(`[TEMPLATE-1c proof] ${message}`);
}

async function main(): Promise<void> {
  const databaseUrl = String(process.env.TEMPLATE1C_PROOF_DATABASE_URL || '').trim();
  if (!databaseUrl) fail('TEMPLATE1C_PROOF_DATABASE_URL is required');
  const parsed = new URL(databaseUrl);
  if (parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') {
    fail(`refusing non-local database host ${parsed.hostname}`);
  }

  process.env.DB_TYPE = 'postgres';
  process.env.DATABASE_URL = databaseUrl;
  process.env.NODE_ENV = 'test';
  process.env.RUN_DB_TESTS = '1';
  process.env.MOCK_DB = 'false';
  process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
  process.env.POSTGRES_SKIP_INIT_IN_TEST = '1';

  const [{ default: express }, { default: request }, { default: artifactsRouter }] =
    await Promise.all([
      import('express'),
      import('supertest'),
      import('../../server/src/routes/artifacts.routes.js'),
    ]);

  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.user = {
      id: NORTHWIND_OWNER_ID,
      organizationId: NORTHWIND_ORG_ID,
      role: 'OWNER',
      email: 'local-proof@example.invalid',
    };
    req.userId = NORTHWIND_OWNER_ID;
    req.organizationId = NORTHWIND_ORG_ID;
    next();
  });
  app.use('/api/artifacts', artifactsRouter);
  app.use((error: any, _req: any, res: any, _next: any) => {
    res.status(500).json({ error: error?.message || String(error) });
  });

  const apiPath = '/api/artifacts?artifactFamily=template&include=drafts&dedupe=false&limit=500';
  const response = await request(app).get(apiPath);
  if (response.status !== 200) fail(`GET ${apiPath} returned HTTP ${response.status}`);

  const rows = Array.isArray(response.body?.data) ? response.body.data : [];
  const base = rows.find((row: any) => row.originRecordId === SHEET_BASE_ID);
  const inventory95 = rows.find((row: any) => row.artifactId === INVENTORY_95_ARTIFACT_ID);
  const legacy = rows.find((row: any) => row.originRecordId === LEGACY_REPORT_ID);
  if (!base || !inventory95 || !legacy) {
    fail(
      `required API rows missing: base=${Boolean(base)} #95=${Boolean(inventory95)} legacy=${Boolean(legacy)}`
    );
  }

  const projection = (row: any) => ({
    artifactId: row.artifactId,
    title: row.titleSnapshot,
    outputType: row.outputType,
    originRuntime: row.originRuntime,
    originRecordId: row.originRecordId,
    source: row.originSummary?.template?.source,
    legacy: row.originSummary?.template?.legacy,
    scope: row.originSummary?.template?.scope,
    status: row.originSummary?.template?.status,
    orphaned: row.originSummary?.template?.orphaned,
  });
  const selected = {
    sheetBase: projection(base),
    inventory95: projection(inventory95),
    realLegacyTemplate: projection(legacy),
  };

  if (selected.sheetBase.source !== 'canonical' || selected.sheetBase.scope !== 'system') {
    fail('SHEET-BASE is not canonical/system in the API response');
  }
  if (selected.inventory95.source !== 'canonical' || selected.inventory95.legacy !== false) {
    fail('inventory #95 is not canonical in the API response');
  }
  if (selected.inventory95.scope !== 'organization') {
    fail('inventory #95 did not preserve its Northwind organization scope');
  }
  if (
    selected.realLegacyTemplate.source !== 'legacy' ||
    selected.realLegacyTemplate.legacy !== true
  ) {
    fail('the real legacy registry card lost its Legacy classification');
  }

  const result = {
    verdict: 'PASS',
    method: 'GET',
    path: apiPath,
    status: response.status,
    total: response.body.total,
    database: `${parsed.hostname}:${parsed.port || '5432'}${parsed.pathname}`,
    organizationId: NORTHWIND_ORG_ID,
    selected,
  };
  const outputPath = path.resolve(
    process.env.TEMPLATE1C_PROOF_OUTPUT ||
      'docs/program/TEMPLATE_1C_20260916/evidence/api-readback.json'
  );
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

  const postgresDatabase = (await import('../../server/src/database/PostgresDatabase.js')).default;
  await postgresDatabase.close();
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
