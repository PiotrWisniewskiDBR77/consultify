#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const command = process.argv[2] || 'readback';
const baseUrl = process.env.INITIATIVES_SCENARIOS_BASE_URL || '';
const fixtureManifestPath = process.env.INITIATIVES_SCENARIOS_FIXTURE_MANIFEST || '';
const outputManifestPath = process.env.INITIATIVES_SCENARIOS_OUTPUT_MANIFEST || '';
const email = process.env.INITIATIVES_SCENARIOS_EMAIL || '';
const password = process.env.INITIATIVES_SCENARIOS_PASSWORD || '';
const confirm = process.env.INITIATIVES_SCENARIOS_CONFIRM;
const expectedFixtureId = 'W3-INITIATIVES-OWNER-v1';

function fail(message) {
  throw new Error(`[W3 Initiatives scenarios] BLOCKED: ${message}`);
}

function requireAbsoluteLocalFile(value, name) {
  if (!value || !path.isAbsolute(value) || value.includes('://')) {
    fail(`${name} must be an absolute local filesystem path`);
  }
}

function context() {
  if (!['seed', 'readback'].includes(command)) fail(`unknown command ${command}`);
  let target;
  try {
    target = new URL(baseUrl);
  } catch {
    fail('INITIATIVES_SCENARIOS_BASE_URL is invalid');
  }
  if (!['127.0.0.1', 'localhost', '::1'].includes(target.hostname)) {
    fail(`runtime host ${target.hostname} is not local`);
  }
  if (!/^https?:$/.test(target.protocol)) fail('runtime URL must use HTTP(S)');
  requireAbsoluteLocalFile(fixtureManifestPath, 'INITIATIVES_SCENARIOS_FIXTURE_MANIFEST');
  const fixture = JSON.parse(fs.readFileSync(fixtureManifestPath, 'utf8'));
  if (fixture.fixtureId !== expectedFixtureId || fixture.productionWrites !== false) {
    fail('fixture manifest is not the guarded Wave 3 owner fixture');
  }
  if (!fixture.deepLinks?.initiativeId) fail('fixture manifest has no initiativeId');
  if (!email || !password) fail('fixture credentials are required through environment variables');
  if (command === 'seed') {
    if (confirm !== 'YES') fail('seed requires INITIATIVES_SCENARIOS_CONFIRM=YES');
    requireAbsoluteLocalFile(outputManifestPath, 'INITIATIVES_SCENARIOS_OUTPUT_MANIFEST');
  }
  return { target: target.origin, fixture };
}

async function json(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function login(target) {
  const response = await fetch(`${target}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await json(response);
  if (!response.ok || typeof body.token !== 'string') fail(`login failed with HTTP ${response.status}`);
  return body.token;
}

async function request(target, token, method, route, body) {
  const response = await fetch(`${target}${route}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await json(response) };
}

function scenarioFrom(body) {
  return body?.scenario || body?.snapshot?.scenario || null;
}

async function ensureScenario(target, token, kind, scenario) {
  const route = `/api/initiatives/runtime-v1/${kind}/${encodeURIComponent(scenario.scenarioId)}`;
  const existing = await request(target, token, 'GET', route);
  if (existing.status === 200) {
    const persisted = scenarioFrom(existing.body);
    if (!persisted || persisted.status !== 'PUBLISHED' || persisted.scenarioVersion !== 2) {
      fail(`${kind}/${scenario.scenarioId} exists but is not canonical PUBLISHED v2`);
    }
    return { id: scenario.scenarioId, version: persisted.scenarioVersion, status: persisted.status, replayed: true };
  }
  if (existing.status !== 404) fail(`${kind} preflight failed with HTTP ${existing.status}`);
  if (command !== 'seed') fail(`${kind}/${scenario.scenarioId} is missing`);

  const create = await request(target, token, 'POST', route, {
    expectedVersion: 0,
    clientRequestId: `${scenario.scenarioId}-owner-create`,
    operation: 'CREATE',
    scenario,
  });
  if (![200, 201].includes(create.status)) {
    fail(`${kind} create failed with HTTP ${create.status}: ${JSON.stringify(create.body)}`);
  }
  const publish = await request(target, token, 'POST', route, {
    expectedVersion: 1,
    clientRequestId: `${scenario.scenarioId}-owner-publish`,
    operation: 'PUBLISH',
    scenario,
  });
  if (![200, 201].includes(publish.status)) {
    fail(`${kind} publish failed with HTTP ${publish.status}: ${JSON.stringify(publish.body)}`);
  }
  const verify = await request(target, token, 'GET', route);
  const persisted = scenarioFrom(verify.body);
  if (verify.status !== 200 || persisted?.status !== 'PUBLISHED' || persisted?.scenarioVersion !== 2) {
    fail(`${kind} post-write readback is not PUBLISHED v2`);
  }
  return { id: scenario.scenarioId, version: 2, status: 'PUBLISHED', replayed: false };
}

async function main() {
  const { target, fixture } = context();
  const token = await login(target);
  const initiativeId = fixture.deepLinks.initiativeId;
  const initiativeRead = await request(
    target,
    token,
    'GET',
    `/api/initiatives/runtime-v1/initiatives/${encodeURIComponent(initiativeId)}`
  );
  if (initiativeRead.status !== 200) fail(`initiative read failed with HTTP ${initiativeRead.status}`);
  const initiative = initiativeRead.body?.initiative;
  const initiativeVersion = Number(
    initiativeRead.body?.version ?? initiativeRead.body?.aggregateVersion ?? initiative?.aggregateVersion
  );
  const projectId = initiative?.projectId;
  if (!projectId || !Number.isInteger(initiativeVersion)) fail('initiative project/version readback is incomplete');

  const period = {
    periodId: '2026-W35',
    start: '2026-08-24T00:00:00.000Z',
    end: '2026-08-31T00:00:00.000Z',
  };
  const portfolioScenarioId = `${initiativeId}-owner-portfolio`;
  const planScenarioId = `${initiativeId}-owner-plan`;
  const capacityScenarioId = `${initiativeId}-owner-capacity`;
  const portfolioScenario = {
    scenarioId: portfolioScenarioId,
    scenarioVersion: 0,
    status: 'DRAFT',
    scope: { portfolioId: projectId, goalIds: ['wave-03-owner-review'], asOf: '2026-08-24T08:00:00.000Z' },
    model: { modelId: 'wave03-value-readiness', version: 1 },
    memberships: [{
      initiativeId,
      initiativeVersion,
      disposition: 'INCLUDED',
      scoreDecomposition: { value: 8, readiness: 7 },
      rank: 1,
      rankOverride: null,
      coverage: { state: 'KNOWN', value: 1, basis: 'Single owner-review initiative.' },
      overlap: { state: 'KNOWN', value: [], basis: 'No overlap in bounded owner fixture.' },
      roughDemand: { state: 'ESTIMATED', value: { unit: 'FTE', low: 0.5, base: 1, high: 1.5 }, basis: 'Bounded Wave 3 review.' },
      confidence: 'HIGH',
      rationale: 'Persistent owner-review scenario for Plan and Capacity readback.',
    }],
    decompositionKeys: ['value', 'readiness'],
    createdBy: '', updatedBy: '', publishedBy: null, publishedAt: null,
    previousPublishedVersion: null,
  };
  const planScenario = {
    scenarioId: planScenarioId,
    scenarioVersion: 0,
    status: 'DRAFT',
    portfolioScenarioId,
    portfolioScenarioVersion: 2,
    windowUnit: 'WEEK', timezone: 'Europe/Warsaw', periods: [period],
    // The preserved Initiative is already IN_EXECUTION. Canonical scheduling only
    // accepts exact APPROVED_BACKLOG snapshots, so this review scenario must not
    // forge a second schedule window for it. The Portfolio still carries the
    // Initiative identity; Plan and Capacity prove durable scenario readback.
    windows: [],
    assumptions: [
      'Synthetic local owner-review data only',
      'Existing IN_EXECUTION initiative is intentionally not rescheduled',
    ],
    createdBy: '', updatedBy: '', publishedBy: null, publishedAt: null,
  };
  const range = {
    knowledgeState: 'KNOWN', low: 0.5, base: 1, high: 1.5,
    sourceRef: 'wave03-owner-capacity', sourceVersion: 1,
    asOf: '2026-08-24T08:00:00.000Z', confidence: 'HIGH',
    ownerId: fixture.personas.find((person) => person.role === 'ADMIN')?.id,
    reason: 'Explicit bounded synthetic capacity.',
  };
  if (!range.ownerId) fail('fixture manifest has no active admin persona');
  const capacityScenario = {
    scenarioId: capacityScenarioId,
    scenarioVersion: 0,
    status: 'DRAFT',
    planScenarioId, planScenarioVersion: 2,
    windowUnit: 'WEEK', timezone: 'Europe/Warsaw',
    periods: [{ ...period, demand: range, supply: range }],
    constraints: [], proposedAssignments: [],
    createdBy: '', updatedBy: '', publishedBy: null, publishedAt: null,
  };

  const portfolio = await ensureScenario(target, token, 'portfolio-scenarios', portfolioScenario);
  const plan = await ensureScenario(target, token, 'plan-scenarios', planScenario);
  const capacity = await ensureScenario(target, token, 'capacity-scenarios', capacityScenario);
  const proof = {
    fixtureId: expectedFixtureId,
    productionWrites: false,
    runtimeOrigin: target,
    initiativeId,
    projectId,
    initiativeVersion,
    scenarios: { portfolio, plan, capacity },
    verifiedAt: new Date().toISOString(),
  };
  if (command === 'seed') {
    fs.writeFileSync(outputManifestPath, `${JSON.stringify(proof, null, 2)}\n`, { flag: 'w', mode: 0o600 });
  }
  process.stdout.write(`${JSON.stringify(proof, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
