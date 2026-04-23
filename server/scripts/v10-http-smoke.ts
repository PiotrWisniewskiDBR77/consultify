#!/usr/bin/env npx tsx
/**
 * V10 HTTP smoke runner.
 *
 * Usage:
 *   npx tsx server/scripts/v10-http-smoke.ts --url http://127.0.0.1:3001 --token $JWT_TOKEN
 *   npx tsx server/scripts/v10-http-smoke.ts --url https://staging.example.com --email admin@example.com --password 'secret'
 *
 * Env fallbacks:
 *   V10_SMOKE_URL
 *   V10_SMOKE_TOKEN
 *   V10_SMOKE_EMAIL
 *   V10_SMOKE_PASSWORD
 */

type JsonRecord = Record<string, unknown>;

type SmokeOptions = {
  baseUrl: string;
  token?: string;
  email?: string;
  password?: string;
  jsonOutput: boolean;
};

type SmokeResult = {
  name: string;
  method: 'GET' | 'POST';
  path: string;
  passed: boolean;
  statusCode: number | null;
  responseTimeMs: number;
  error?: string;
  summary?: string;
};

type SmokeCheck = {
  name: string;
  method: 'GET' | 'POST';
  path: string;
  body?: unknown;
  expectedStatus?: number;
  validate?: (body: unknown) => string | null;
};

function usage(): string {
  return [
    'Usage:',
    '  tsx server/scripts/v10-http-smoke.ts --url <base-url> --token <jwt-token> [--json]',
    '  tsx server/scripts/v10-http-smoke.ts --url <base-url> --email <email> --password <password> [--json]',
    '',
    'Env fallbacks:',
    '  V10_SMOKE_URL, V10_SMOKE_TOKEN, V10_SMOKE_EMAIL, V10_SMOKE_PASSWORD',
  ].join('\n');
}

function parseArgs(): SmokeOptions {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(usage());
    process.exit(0);
  }

  const readArg = (name: string): string | undefined => {
    const idx = args.indexOf(name);
    if (idx === -1) return undefined;
    const value = args[idx + 1];
    return value && !value.startsWith('--') ? value : undefined;
  };

  const baseUrl = (
    readArg('--url') ||
    process.env.V10_SMOKE_URL ||
    process.env.APP_URL ||
    'http://127.0.0.1:3001'
  ).replace(/\/$/, '');

  const token = readArg('--token') || process.env.V10_SMOKE_TOKEN;
  const email = readArg('--email') || process.env.V10_SMOKE_EMAIL;
  const password = readArg('--password') || process.env.V10_SMOKE_PASSWORD;
  const jsonOutput = args.includes('--json');

  if (!token && !(email && password)) {
    console.error('Provide either --token or --email with --password.\n');
    console.error(usage());
    process.exit(1);
  }

  return { baseUrl, token, email, password, jsonOutput };
}

async function readJsonOrText(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function extractContract(body: unknown): string | null {
  const root = asRecord(body);
  if (!root) return null;

  const dataContract = readString(asRecord(root.data)?.contract);
  if (dataContract) return dataContract;

  return readString(asRecord(root.meta)?.contract);
}

function getSummary(body: unknown): string | undefined {
  const root = asRecord(body);
  if (!root) return typeof body === 'string' ? body : undefined;

  const data = asRecord(root.data);
  const meta = asRecord(root.meta);

  if (data && Array.isArray(data.checks)) {
    return `checks=${data.checks.length}`;
  }
  if (data && Array.isArray(data.schedules)) {
    return `schedules=${data.schedules.length}`;
  }
  if (data && Array.isArray(data.sessions)) {
    return `sessions=${data.sessions.length}`;
  }
  if (data && Array.isArray(data.connectors)) {
    return `connectors=${data.connectors.length}`;
  }
  if (data && Array.isArray(data.personas)) {
    return `personas=${data.personas.length}`;
  }
  if (data && typeof data.coverage === 'number') {
    return `coverage=${data.coverage}`;
  }
  if (data && asRecord(data.summary)) {
    const summary = asRecord(data.summary);
    return `summary.total=${String(summary?.total ?? 'n/a')}`;
  }
  if (meta && readString(meta.contract)) {
    return `contract=${String(meta.contract)}`;
  }

  return undefined;
}

async function login(baseUrl: string, email: string, password: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const body = await readJsonOrText(response);
  if (!response.ok) {
    throw new Error(`Login failed with ${response.status}: ${JSON.stringify(body)}`);
  }

  const token = readString(asRecord(body)?.token);
  if (!token) {
    throw new Error('Login response did not include a token');
  }

  return token;
}

async function runCheck(baseUrl: string, token: string, check: SmokeCheck): Promise<SmokeResult> {
  const startedAt = Date.now();

  try {
    const response = await fetch(`${baseUrl}${check.path}`, {
      method: check.method,
      headers: {
        Authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: check.body === undefined ? undefined : JSON.stringify(check.body),
    });

    const body = await readJsonOrText(response);
    const expectedStatus = check.expectedStatus ?? 200;
    let error: string | undefined =
      response.status === expectedStatus ? undefined : `Expected ${expectedStatus}, got ${response.status}`;

    if (!error && check.validate) {
      error = check.validate(body) ?? undefined;
    }

    return {
      name: check.name,
      method: check.method,
      path: check.path,
      passed: !error,
      statusCode: response.status,
      responseTimeMs: Date.now() - startedAt,
      error,
      summary: getSummary(body),
    };
  } catch (error) {
    return {
      name: check.name,
      method: check.method,
      path: check.path,
      passed: false,
      statusCode: null,
      responseTimeMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function expectContract(contract: string) {
  return (body: unknown): string | null => {
    const actual = extractContract(body);
    return actual === contract ? null : `Expected contract "${contract}", got ${JSON.stringify(actual)}`;
  };
}

function expectArtifactPreflight(body: unknown): string | null {
  const data = asRecord(asRecord(body)?.data);
  if (!data) return 'Missing data payload';
  if (!Array.isArray(data.checks)) return 'Missing preflight checks array';
  return null;
}

function createArtifactPreflightBody() {
  const now = new Date().toISOString();
  const artifactId = 'artifact_demo_001';
  const currentVersionId = 'version_demo_001';
  const proposalId = 'proposal_demo_001';

  return {
    command: 'Tighten the executive summary and keep the artifact in memo format.',
    now,
    artifact: {
      id: artifactId,
      tenantId: 'tenant_demo',
      type: 'memo',
      ownerId: 'user_demo',
      permissionPolicyId: 'policy_demo',
      dataClassification: 'Internal',
      retentionPolicyId: 'retention_demo',
      reviewState: 'draft',
      currentVersionId,
      lineageRootId: null,
      parentArtifactId: null,
      derivedFromVersionId: null,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
      exportRecords: [],
      evidenceRefs: [],
      content: {
        title: 'Demo memo',
        blocks: [{ kind: 'paragraph', text: 'Hello artifact.' }],
      },
    },
    proposal: {
      id: proposalId,
      artifactId,
      declaredArtifactType: 'memo',
      baseVersionId: currentVersionId,
      intent: 'update_artifact',
      sourceSet: [],
      ops: [
        {
          kind: 'json_patch',
          path: '/title',
          before: 'Demo memo',
          after: 'Demo memo (updated)',
        },
      ],
      rationale: 'Demo pipeline run from V10 HTTP smoke.',
      citations: [],
      trustBundleHash: 'trust_demo',
      reversibleTxnId: 'txn_demo',
      preview: {
        title: 'Demo memo (updated)',
        blocks: [{ kind: 'paragraph', text: 'Hello artifact.' }],
      },
      createdAt: now,
      proposedBy: 'actor_demo',
      approvalRequired: false,
      approvalMode: 'inline',
    },
    selectionContext: { artifactId, selection: { kind: 'empty' } },
    selectedOpIndices: [0],
    reviewEvent: 'submit_for_review',
  };
}

const checks: SmokeCheck[] = [
  {
    name: 'Artifact Pipeline preflight',
    method: 'POST',
    path: '/api/v10/artifact-pipeline/preflight',
    body: createArtifactPreflightBody(),
    validate: expectArtifactPreflight,
  },
  {
    name: 'Agent schedules list',
    method: 'GET',
    path: '/api/v10/agent-schedules',
    validate: expectContract('agent_schedules_v1'),
  },
  {
    name: 'Agent schedule preferences',
    method: 'GET',
    path: '/api/v10/agent-schedules/preferences',
    validate: expectContract('agent_schedules_v1'),
  },
  {
    name: 'Onboarding KPI summary',
    method: 'GET',
    path: '/api/v10/onboarding-runtime/kpis/summary',
    validate: expectContract('onboarding_runtime_wave_a_v1'),
  },
  {
    name: 'Reasoning contract',
    method: 'GET',
    path: '/api/v10/reasoning-runtime/contract',
    validate: expectContract('reasoning_runtime_wave_a_v1'),
  },
  {
    name: 'Learning loop coverage',
    method: 'GET',
    path: '/api/v10/learning-loop/coverage/summary',
    validate: expectContract('learning_loop_wave_b_v1'),
  },
  {
    name: 'Learning runtime contract',
    method: 'GET',
    path: '/api/v10/learning-runtime/contract',
    validate: expectContract('learning_runtime_wave_a_v1'),
  },
  {
    name: 'Research runtime contract',
    method: 'GET',
    path: '/api/v10/research-runtime/contract',
    validate: expectContract('research_runtime_wave_a_v1'),
  },
  {
    name: 'Connectors catalog',
    method: 'GET',
    path: '/api/v10/connectors-runtime/catalog?persona=CFO&includePlanned=true',
    validate: expectContract('connectors_runtime_wave_a_v1'),
  },
  {
    name: 'Connectors sessions',
    method: 'GET',
    path: '/api/v10/connectors-runtime/sessions',
    validate: expectContract('connectors_runtime_wave_a_v1'),
  },
  {
    name: 'Outcome runtime contract',
    method: 'GET',
    path: '/api/v10/outcome-runtime/contract',
    validate: expectContract('outcome_runtime_wave_b_v1'),
  },
];

async function main(): Promise<void> {
  const options = parseArgs();
  const token =
    options.token || (options.email && options.password
      ? await login(options.baseUrl, options.email, options.password)
      : null);

  if (!token) {
    throw new Error('Failed to resolve auth token');
  }

  console.log('\n=== V10 HTTP Smoke ===');
  console.log(`Target: ${options.baseUrl}`);
  console.log(`Checks: ${checks.length}`);
  console.log(`Time: ${new Date().toISOString()}\n`);

  const results: SmokeResult[] = [];
  for (const check of checks) {
    results.push(await runCheck(options.baseUrl, token, check));
  }

  if (options.jsonOutput) {
    console.log(
      JSON.stringify(
        {
          target: options.baseUrl,
          passed: results.every((result) => result.passed),
          results,
        },
        null,
        2
      )
    );
  } else {
    for (const result of results) {
      const icon = result.passed ? 'PASS' : 'FAIL';
      const detail = result.error || result.summary || '';
      const suffix = detail ? ` :: ${detail}` : '';
      console.log(
        `[${icon}] ${result.method} ${result.path} (${result.statusCode ?? 'ERR'}, ${result.responseTimeMs}ms) - ${result.name}${suffix}`
      );
    }
  }

  const failed = results.filter((result) => !result.passed);
  if (failed.length > 0) {
    console.error(`\nV10 smoke failed: ${failed.length}/${results.length} checks failed.`);
    process.exit(1);
  }

  console.log(`\nV10 smoke passed: ${results.length}/${results.length} checks green.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
