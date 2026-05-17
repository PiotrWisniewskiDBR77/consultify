#!/usr/bin/env npx tsx
/**
 * V8 Smoke Test Runner
 * CP-17: Verifies V8 endpoints are healthy after deployment.
 * Includes Prompt OS runtime summary (B-03b staging proof: contract in response body).
 * Includes Planning continuity read bridge (B-07: snapshot + pending-decisions contracts).
 * Includes Execution control read bridge (B-08: risk-signals + timeline-warnings contracts).
 * Includes Results read bridge (B-09: dashboard contract under /results).
 * Includes Finance read bridge (B-10: dashboard contract under /finance).
 * Includes PM sync read bridge (B-13: persisted auth/connector/conflict truth under /sync).
 * Includes Multiplayer read bridge (B-14: persisted mappings/presence/locks under /multiplayer; not WS proof).
 *
 * Usage:
 *   npx tsx scripts/v8-smoke-test.ts --url https://staging.example.com --token $JWT_TOKEN
 *   npx tsx scripts/v8-smoke-test.ts --url http://localhost:3000 --token $JWT_TOKEN
 */

interface SmokeTestResult {
  name: string;
  endpoint: string;
  method: string;
  passed: boolean;
  statusCode: number | null;
  responseTime: number;
  error?: string;
}

function parseArgs(): { baseUrl: string; token: string; jsonOutput: boolean } {
  const args = process.argv.slice(2);
  const urlIdx = args.indexOf('--url');
  const tokenIdx = args.indexOf('--token');

  if (urlIdx === -1 || tokenIdx === -1) {
    console.error(
      'Usage: npx tsx scripts/v8-smoke-test.ts --url <base-url> --token <jwt-token> [--json]',
    );
    process.exit(1);
  }

  const baseUrlArg = args[urlIdx + 1];
  const tokenArg = args[tokenIdx + 1];
  if (!baseUrlArg || !tokenArg) {
    console.error(
      'Usage: npx tsx scripts/v8-smoke-test.ts --url <base-url> --token <jwt-token> [--json]',
    );
    process.exit(1);
  }

  return {
    baseUrl: baseUrlArg.replace(/\/$/, ''),
    token: tokenArg,
    jsonOutput: args.includes('--json'),
  };
}

async function runSmokeTest(
  name: string,
  baseUrl: string,
  token: string,
  endpoint: string,
  method: string = 'GET',
  expectedStatus: number = 200,
  options?: { expectJsonContract?: string; expectMetaContract?: string },
): Promise<SmokeTestResult> {
  const url = `${baseUrl}/api/v8${endpoint}`;
  const start = Date.now();

  try {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const responseTime = Date.now() - start;
    let passed = res.status === expectedStatus;
    let error: string | undefined = passed ? undefined : `Expected ${expectedStatus}, got ${res.status}`;

    if (passed && options?.expectJsonContract) {
      try {
        const body = (await res.clone().json()) as { data?: { contract?: string } };
        const contract = body?.data?.contract;
        if (contract !== options.expectJsonContract) {
          passed = false;
          error = `Expected data.contract "${options.expectJsonContract}", got ${JSON.stringify(contract)}`;
        }
      } catch (e: unknown) {
        passed = false;
        error = e instanceof Error ? e.message : 'Invalid JSON body';
      }
    }

    if (passed && options?.expectMetaContract) {
      try {
        const body = (await res.clone().json()) as { meta?: { contract?: string } };
        const contract = body?.meta?.contract;
        if (contract !== options.expectMetaContract) {
          passed = false;
          error = `Expected meta.contract "${options.expectMetaContract}", got ${JSON.stringify(contract)}`;
        }
      } catch (e: unknown) {
        passed = false;
        error = e instanceof Error ? e.message : 'Invalid JSON body';
      }
    }

    return {
      name,
      endpoint,
      method,
      passed,
      statusCode: res.status,
      responseTime,
      error,
    };
  } catch (err: unknown) {
    return {
      name,
      endpoint,
      method,
      passed: false,
      statusCode: null,
      responseTime: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main(): Promise<void> {
  const { baseUrl, token, jsonOutput } = parseArgs();

  console.log(`\n=== V8 Smoke Tests ===`);
  console.log(`Target: ${baseUrl}`);
  console.log(`Time: ${new Date().toISOString()}\n`);

  const tests: SmokeTestResult[] = [];

  // Core health
  tests.push(await runSmokeTest('Health endpoint', baseUrl, token, '/health'));
  tests.push(await runSmokeTest('Health readiness', baseUrl, token, '/health/readiness'));

  // Admin endpoints
  tests.push(await runSmokeTest('Feature flags', baseUrl, token, '/admin/flags'));
  tests.push(await runSmokeTest('Admin health', baseUrl, token, '/admin/health'));
  tests.push(await runSmokeTest('Admin metrics', baseUrl, token, '/admin/metrics'));
  tests.push(await runSmokeTest('Shadow stats', baseUrl, token, '/admin/shadow/stats'));

  // Chat endpoints (expect 400 without params — proves route exists)
  tests.push(
    await runSmokeTest('Chat snapshots (no params)', baseUrl, token, '/chat/snapshots', 'GET', 400),
  );
  tests.push(
    await runSmokeTest('Chat handoffs (no params)', baseUrl, token, '/chat/handoffs', 'GET', 400),
  );

  // AI Core endpoints
  tests.push(await runSmokeTest('AI Core environment', baseUrl, token, '/ai-core/environment'));
  tests.push(await runSmokeTest('AI Core tools', baseUrl, token, '/ai-core/tools'));

  // Prompt OS — same payload shape the superadmin UI consumes (V8PromptOsApi.getRuntimeSummary)
  tests.push(
    await runSmokeTest('Prompt OS runtime summary', baseUrl, token, '/prompt-os/runtime/summary', 'GET', 200, {
      expectJsonContract: 'prompt-os-runtime-v8',
    }),
  );

  // Help / Knowledge Base (B-11 read-only bridge; global KB, V8 auth + org gate)
  tests.push(await runSmokeTest('KB search', baseUrl, token, '/kb/search?q=ab'));
  tests.push(await runSmokeTest('KB context by module', baseUrl, token, '/kb/context/chat'));

  // Interview (B-06 read-only bridge; org-scoped sessions)
  tests.push(
    await runSmokeTest('Interview sessions list', baseUrl, token, '/interview/sessions', 'GET', 200, {
      expectMetaContract: 'interview_runtime_read_v1',
    }),
  );

  // Initiatives / PM — B-07 planning continuity read bridge (valid UUID; may return empty trees)
  const smokeInitiativeId = '00000000-0000-4000-8000-000000000010';
  tests.push(
    await runSmokeTest(
      'Planning initiative snapshot',
      baseUrl,
      token,
      `/planning/initiatives/${smokeInitiativeId}/snapshot`,
      'GET',
      200,
      { expectMetaContract: 'planning_continuity_read_v1' },
    ),
  );
  tests.push(
    await runSmokeTest('Planning pending decisions', baseUrl, token, '/planning/pending-decisions', 'GET', 200, {
      expectMetaContract: 'planning_continuity_read_v1',
    }),
  );

  // Execution / delivery control — B-08 read-only bridge
  tests.push(
    await runSmokeTest(
      'Execution control risk signals',
      baseUrl,
      token,
      '/execution-control/risk-signals',
      'GET',
      200,
      { expectMetaContract: 'execution_control_read_v1' },
    ),
  );
  tests.push(
    await runSmokeTest(
      'Execution control timeline warnings',
      baseUrl,
      token,
      '/execution-control/timeline-warnings',
      'GET',
      200,
      { expectMetaContract: 'execution_control_read_v1' },
    ),
  );

  // Results / KPI / ROI — B-09 read-only bridge
  tests.push(
    await runSmokeTest('Results dashboard', baseUrl, token, '/results/dashboard', 'GET', 200, {
      expectMetaContract: 'results_runtime_read_v1',
    }),
  );

  // Finance — B-10 read-only bridge (V8 finance integration runtime dashboard)
  tests.push(
    await runSmokeTest('Finance dashboard', baseUrl, token, '/finance/dashboard', 'GET', 200, {
      expectMetaContract: 'finance_runtime_read_v1',
    }),
  );

  // PM sync — B-13 read-only persisted truth (no live provider round-trips)
  const smokeConnectorId = '00000000-0000-4000-8000-000000000030';
  tests.push(
    await runSmokeTest('Sync auth health', baseUrl, token, '/sync/auth/health', 'GET', 200, {
      expectMetaContract: 'sync_runtime_read_v1',
    }),
  );
  tests.push(
    await runSmokeTest('Sync auth escalations', baseUrl, token, '/sync/auth/escalations', 'GET', 200, {
      expectMetaContract: 'sync_runtime_read_v1',
    }),
  );
  tests.push(
    await runSmokeTest(
      'Sync connector health',
      baseUrl,
      token,
      `/sync/connectors/${smokeConnectorId}/health`,
      'GET',
      200,
      { expectMetaContract: 'sync_runtime_read_v1' },
    ),
  );
  tests.push(
    await runSmokeTest('Sync conflicts', baseUrl, token, '/sync/conflicts?limit=50', 'GET', 200, {
      expectMetaContract: 'sync_runtime_read_v1',
    }),
  );

  // Multiplayer — B-14 persisted read bridge (no websocket transport proof)
  const smokeMultiplayerRoomId = '00000000-0000-4000-8000-000000000040';
  tests.push(
    await runSmokeTest(
      'Multiplayer resource mapping',
      baseUrl,
      token,
      '/multiplayer/resource-mappings/whiteboard',
      'GET',
      200,
      { expectMetaContract: 'multiplayer_persisted_read_v1' },
    ),
  );
  tests.push(
    await runSmokeTest(
      'Multiplayer room binding',
      baseUrl,
      token,
      `/multiplayer/room-binding?resourceType=whiteboard&resourceId=${smokeMultiplayerRoomId}`,
      'GET',
      200,
      { expectMetaContract: 'multiplayer_persisted_read_v1' },
    ),
  );
  tests.push(
    await runSmokeTest(
      'Multiplayer room presence',
      baseUrl,
      token,
      `/multiplayer/rooms/${smokeMultiplayerRoomId}/presence`,
      'GET',
      200,
      { expectMetaContract: 'multiplayer_persisted_read_v1' },
    ),
  );
  tests.push(
    await runSmokeTest(
      'Multiplayer presence by surface',
      baseUrl,
      token,
      `/multiplayer/rooms/${smokeMultiplayerRoomId}/presence/by-surface?surface=whiteboard`,
      'GET',
      200,
      { expectMetaContract: 'multiplayer_persisted_read_v1' },
    ),
  );
  tests.push(
    await runSmokeTest(
      'Multiplayer room locks',
      baseUrl,
      token,
      `/multiplayer/rooms/${smokeMultiplayerRoomId}/locks`,
      'GET',
      200,
      { expectMetaContract: 'multiplayer_persisted_read_v1' },
    ),
  );

  // Print results
  let passed = 0;
  for (const t of tests) {
    if (t.passed) passed++;
  }

  if (jsonOutput) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      target: baseUrl,
      passed,
      total: tests.length,
      allPassed: passed === tests.length,
      results: tests,
    }, null, 2));
    process.exit(passed === tests.length ? 0 : 1);
  }

  console.log('Results:\n');
  for (const t of tests) {
    const icon = t.passed ? '✅' : '❌';
    console.log(`${icon} ${t.name}`);
    console.log(`   ${t.method} ${t.endpoint} → ${t.statusCode ?? 'N/A'} (${t.responseTime}ms)`);
    if (t.error) console.log(`   Error: ${t.error}`);
  }

  console.log(`\n${passed}/${tests.length} smoke tests passed.`);

  if (passed < tests.length) {
    console.error('\n⚠️  Some smoke tests failed. Check the results above.');
    process.exit(1);
  } else {
    console.log('\n✅ All smoke tests passed. V8 deployment is healthy.');
  }
}

main().catch((err: unknown) => {
  console.error('Smoke test error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
