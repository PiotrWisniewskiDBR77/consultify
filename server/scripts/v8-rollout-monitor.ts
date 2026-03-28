#!/usr/bin/env npx tsx

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'node:child_process';

type MonitorUserRole = 'user' | 'superadmin';

type MonitorUser = {
  email: string;
  role: MonitorUserRole;
};

type EndpointResult = {
  path: string;
  category: 'v8-runtime' | 'v8-admin' | 'non-v8';
  status: number | null;
  ok: boolean;
  responseTimeMs: number;
  summary: unknown;
  error?: string;
};

type UserMonitorResult = {
  email: string;
  role: MonitorUserRole;
  loginStatus: number | null;
  loginOk: boolean;
  endpoints: EndpointResult[];
};

type MonitorReport = {
  generatedAt: string;
  baseUrl: string;
  keychainService: string;
  users: UserMonitorResult[];
  allPassed: boolean;
};

const DEFAULT_BASE_URL = 'https://consultify.ai';
const DEFAULT_KEYCHAIN_SERVICE = 'consultify-prod-credential-rotation-2026-03-28';
const DEFAULT_USERS: MonitorUser[] = [
  { email: 'admin@dbr77.com', role: 'superadmin' },
  { email: 'anna.zielinska@ateliertoys-demo.com', role: 'user' },
];

const runtimeEndpoints = [
  '/api/v8/admin/flags',
  '/api/v8/health',
  '/api/v8/health/readiness',
  '/api/v8/planning/pending-decisions',
] as const;

const adminEndpoints = [
  '/api/v8/admin/health',
  '/api/v8/admin/metrics',
  '/api/v8/admin/shadow/stats',
  '/api/v8/admin/shadow/promotion-readiness',
] as const;

const nonV8Endpoints = [
  '/api/notifications/unread-count',
  '/api/notifications?limit=20',
  '/api/llm/providers/health',
] as const;

function timestampForFile(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function parseArgs(argv: string[]) {
  const users: MonitorUser[] = [];
  let baseUrl = DEFAULT_BASE_URL;
  let keychainService = DEFAULT_KEYCHAIN_SERVICE;
  let jsonOutput = false;
  let outputPath: string | undefined;
  let help = false;

  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (current === '--help' || current === '-h') {
      help = true;
      continue;
    }
    if (current === '--json') {
      jsonOutput = true;
      continue;
    }
    if (current === '--url') {
      baseUrl = argv[i + 1] || '';
      i += 1;
      continue;
    }
    if (current === '--keychain-service') {
      keychainService = argv[i + 1] || '';
      i += 1;
      continue;
    }
    if (current === '--user') {
      const spec = argv[i + 1] || '';
      users.push(parseUserSpec(spec));
      i += 1;
      continue;
    }
    if (current === '--output') {
      outputPath = argv[i + 1] || '';
      i += 1;
      continue;
    }
  }

  if (!baseUrl) {
    throw new Error('Missing value for --url');
  }
  if (!keychainService) {
    throw new Error('Missing value for --keychain-service');
  }
  if (outputPath === '') {
    throw new Error('Missing value for --output');
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ''),
    keychainService,
    users: users.length > 0 ? users : DEFAULT_USERS,
    jsonOutput,
    outputPath,
    help,
  };
}

function parseUserSpec(spec: string): MonitorUser {
  if (!spec) {
    throw new Error('Missing value for --user');
  }
  const [email, roleSpec] = spec.split(':');
  if (!email) {
    throw new Error(`Invalid --user value "${spec}"`);
  }
  if (!roleSpec) {
    return { email, role: 'user' };
  }
  if (roleSpec !== 'superadmin' && roleSpec !== 'user') {
    throw new Error(`Unsupported user role "${roleSpec}" in --user ${spec}`);
  }
  return { email, role: roleSpec };
}

function usage(): string {
  return [
    'Usage:',
    '  npx tsx server/scripts/v8-rollout-monitor.ts [options]',
    '',
    'Options:',
    `  --url <base-url>                 Default: ${DEFAULT_BASE_URL}`,
    `  --keychain-service <name>       Default: ${DEFAULT_KEYCHAIN_SERVICE}`,
    '  --user <email[:role]>           Repeatable. role is user or superadmin.',
    '  --json                          Print full JSON report.',
    '  --output <relative-path>        Write JSON report to a file.',
    '                                 Default: server/exports/v8-rollout-monitor-<timestamp>.json',
    '  --help                          Show this help.',
    '',
    'Default users:',
    ...DEFAULT_USERS.map((user) => `  - ${user.email}:${user.role}`),
  ].join('\n');
}

function getPassword(email: string, keychainService: string): string {
  const result = spawnSync(
    'security',
    ['find-generic-password', '-s', keychainService, '-a', email, '-w'],
    { encoding: 'utf8' },
  );

  if (result.status !== 0) {
    throw new Error(
      (result.stderr || result.stdout || `Missing keychain password for ${email}`).trim(),
    );
  }

  return result.stdout.trim();
}

async function login(baseUrl: string, email: string, password: string) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await readJsonOrText(response);
  return { status: response.status, body };
}

async function readJsonOrText(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function summarizeResponseBody(endpointPath: string, body: unknown): unknown {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const payload = body as Record<string, any>;
  const data = payload.data;

  switch (endpointPath) {
    case '/api/v8/admin/flags':
      return data ?? payload;
    case '/api/v8/health':
      return {
        overall: data?.overall,
        domainStatuses: Object.fromEntries(
          Object.entries(data?.domains || {}).map(([name, value]) => [
            name,
            typeof value === 'object' && value ? (value as Record<string, unknown>).status : value,
          ]),
        ),
      };
    case '/api/v8/health/readiness':
      return {
        readyDomains: Array.isArray(data?.domains)
          ? data.domains.filter((entry: { ready?: boolean }) => entry?.ready).length
          : null,
        totalDomains: Array.isArray(data?.domains) ? data.domains.length : null,
      };
    case '/api/v8/planning/pending-decisions':
      return {
        pendingDecisionChains: Array.isArray(data?.pendingDecisionChains)
          ? data.pendingDecisionChains.length
          : null,
      };
    case '/api/v8/admin/health':
      return {
        overall: data?.health?.overall,
        integrity: data?.integrity?.status,
        metrics: data?.metrics,
      };
    case '/api/v8/admin/metrics':
      return data ?? payload;
    case '/api/v8/admin/shadow/stats':
      return data ?? payload;
    case '/api/v8/admin/shadow/promotion-readiness':
      return {
        ready: data?.ready,
        criteria: Array.isArray(data?.criteria)
          ? data.criteria.map((criterion: { name?: string; passed?: boolean; value?: string }) => ({
              name: criterion?.name,
              passed: criterion?.passed,
              value: criterion?.value,
            }))
          : null,
      };
    case '/api/notifications/unread-count':
      return payload;
    case '/api/notifications?limit=20':
      return { count: Array.isArray(body) ? body.length : null };
    case '/api/llm/providers/health':
      return {
        overall: payload.overall,
        providers: Array.isArray(payload.providers)
          ? payload.providers.map(
              (provider: { id?: string; status?: string; latency?: number; available?: boolean }) => ({
                id: provider?.id,
                status: provider?.status,
                latency: provider?.latency,
                available: provider?.available,
              }),
            )
          : null,
      };
    default:
      return payload;
  }
}

async function callEndpoint(
  baseUrl: string,
  token: string,
  endpointPath: string,
  category: EndpointResult['category'],
): Promise<EndpointResult> {
  const startedAt = Date.now();
  try {
    const response = await fetch(`${baseUrl}${endpointPath}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const body = await readJsonOrText(response);
    return {
      path: endpointPath,
      category,
      status: response.status,
      ok: response.status === 200,
      responseTimeMs: Date.now() - startedAt,
      summary: summarizeResponseBody(endpointPath, body),
      error: response.status === 200 ? undefined : `Expected 200, got ${response.status}`,
    };
  } catch (error: unknown) {
    return {
      path: endpointPath,
      category,
      status: null,
      ok: false,
      responseTimeMs: Date.now() - startedAt,
      summary: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function monitorUser(
  user: MonitorUser,
  baseUrl: string,
  keychainService: string,
): Promise<UserMonitorResult> {
  try {
    const loginResult = await login(baseUrl, user.email, getPassword(user.email, keychainService));
    const token = (loginResult.body as Record<string, any> | undefined)?.token;
    if (loginResult.status !== 200 || !token) {
      return {
        email: user.email,
        role: user.role,
        loginStatus: loginResult.status,
        loginOk: false,
        endpoints: [],
      };
    }

    const endpoints = [
      ...runtimeEndpoints.map((endpointPath) => callEndpoint(baseUrl, token, endpointPath, 'v8-runtime')),
      ...nonV8Endpoints.map((endpointPath) => callEndpoint(baseUrl, token, endpointPath, 'non-v8')),
      ...(user.role === 'superadmin'
        ? adminEndpoints.map((endpointPath) => callEndpoint(baseUrl, token, endpointPath, 'v8-admin'))
        : []),
    ];

    return {
      email: user.email,
      role: user.role,
      loginStatus: loginResult.status,
      loginOk: true,
      endpoints: await Promise.all(endpoints),
    };
  } catch (error: unknown) {
    return {
      email: user.email,
      role: user.role,
      loginStatus: null,
      loginOk: false,
      endpoints: [
        {
          path: '/api/auth/login',
          category: 'v8-runtime',
          status: null,
          ok: false,
          responseTimeMs: 0,
          summary: null,
          error: error instanceof Error ? error.message : String(error),
        },
      ],
    };
  }
}

function buildReport(
  baseUrl: string,
  keychainService: string,
  users: UserMonitorResult[],
): MonitorReport {
  return {
    generatedAt: new Date().toISOString(),
    baseUrl,
    keychainService,
    users,
    allPassed: users.every((user) => user.loginOk && user.endpoints.every((endpoint) => endpoint.ok)),
  };
}

function printHumanReport(report: MonitorReport): void {
  console.log('\n=== V8 Rollout Monitoring Checkpoint ===\n');
  console.log(`Target: ${report.baseUrl}`);
  console.log(`Time: ${report.generatedAt}`);
  console.log(`Keychain service: ${report.keychainService}\n`);

  for (const user of report.users) {
    const loginIcon = user.loginOk ? 'OK' : 'FAIL';
    console.log(`[${loginIcon}] ${user.email} (${user.role}) login=${user.loginStatus ?? 'N/A'}`);
    for (const endpoint of user.endpoints) {
      const icon = endpoint.ok ? 'OK' : 'FAIL';
      console.log(
        `  [${icon}] ${endpoint.category} ${endpoint.path} -> ${endpoint.status ?? 'N/A'} (${endpoint.responseTimeMs}ms)`,
      );
      if (!endpoint.ok && endpoint.error) {
        console.log(`       ${endpoint.error}`);
      }
    }
    console.log('');
  }

  console.log(report.allPassed ? 'Overall: PASS' : 'Overall: FAIL');
}

function writeReport(outputPath: string, report: MonitorReport): string {
  const absolutePath = path.resolve(process.cwd(), outputPath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return absolutePath;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    process.exit(0);
  }

  const users = await Promise.all(
    options.users.map((user) => monitorUser(user, options.baseUrl, options.keychainService)),
  );
  const report = buildReport(options.baseUrl, options.keychainService, users);
  const savedPath = writeReport(
    options.outputPath || `server/exports/v8-rollout-monitor-${timestampForFile()}.json`,
    report,
  );
  console.log(`Saved JSON report to ${savedPath}`);

  if (options.jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHumanReport(report);
  }

  process.exit(report.allPassed ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error('Rollout monitoring error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
