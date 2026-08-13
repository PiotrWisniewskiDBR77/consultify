// F3 packet — drives a REAL Case + Run through the REAL HTTP API (backend on
// 127.0.0.1:3001, disposable Postgres on 127.0.0.1:55432) to produce two
// `case_workspace_node_result_acceptances` rows that Packet E5 could not
// reach: `resultAcceptance='PARTIAL'` and the SKIPPED/NOT_APPLICABLE row
// `runLifecycleService.recordUnselectedBranchesSkipped` writes for the
// branch a DECISION_GATEWAY did NOT select.
//
// NO STATIC MOCK. NO HAND-CRAFTED DOM. NO STUBBED /api/*. Every step below
// is a real `fetch` against the real Express app, which itself runs real SQL
// against the real disposable Postgres container.
//
// Graph shape (deliberately minimal — no predecessor CAPABILITY node is
// needed because the DECISION_GATEWAY is itself the entry node, and there is
// no HTTP route to claim/attempt a plain CAPABILITY NodeRun — see this
// packet's final report for why):
//
//   entryNodeIds: ['gw']
//   gw (DECISION_GATEWAY) --[e_a CONDITIONAL]--> branchA (CAPABILITY)
//                          --[e_b CONDITIONAL]--> branchB (CAPABILITY)
//
// The evaluation selects e_a. `advanceRun` then (a) resolves `gw`, (b)
// creates a real READY NodeRun for `branchA`, and (c) — inside the SAME
// call, `recordUnselectedBranchesSkipped` — writes a SKIPPED/NOT_APPLICABLE
// `node_result_acceptances` row for `branchB` (branchB's ONLY incoming edge
// is this gateway, so it qualifies; its NodeRun is deliberately never
// created — CW-RT-037's own locked invariant). We then record a genuine
// PARTIAL acceptance for branchA's real NodeRun, exactly the
// `POST /runs/:runId/node-result-acceptances` shape
// `partialResults.pg.test.ts` proved round-trips byte-exact.
//
// Usage:
//   node drive-states.mjs > drive-states-output.json

const API = 'http://127.0.0.1:3001/api/v8/case-workspace';
const AUTH_API = 'http://127.0.0.1:3001/api/auth';

const log = [];
function record(step, detail) {
  log.push({ step, ...detail });
  console.error(`[${step}]`, JSON.stringify(detail).slice(0, 300));
}

async function call(method, path, token, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, body: json };
}

async function main() {
  // -- 0. Real login — same credentials the LIVE_STACK_RUNBOOK uses. --------
  const loginRes = await fetch(`${AUTH_API}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'cw.local@local.test', password: 'CaseWorkspaceLocal!2026' }),
  });
  const login = await loginRes.json();
  if (loginRes.status !== 200 || !login.token) {
    throw new Error(`login failed: ${loginRes.status} ${JSON.stringify(login)}`);
  }
  const token = login.token;
  record('login', { status: loginRes.status, userId: login.user?.id, orgId: login.user?.organizationId });

  const projectId = 'cw-local-project';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');

  // -- 1. Case ---------------------------------------------------------------
  const created = await call('POST', '/cases', token, {
    projectId,
    caseName: `F3 partial+skipped states (${stamp})`,
    caseProfile: 'STANDARD',
    governanceTier: 'STANDARD',
    contractedClosureType: 'DELIVERY_COMPLETED',
  });
  if (created.status !== 201) throw new Error(`create case failed: ${JSON.stringify(created)}`);
  const caseId = created.body.data.caseId;
  record('createCase', { status: created.status, caseId, caseStatus: created.body.data.caseStatus });

  // -- 2. Plan version with a DECISION_GATEWAY as the ONLY entry node -------
  const graph = {
    entryNodeIds: ['gw'],
    terminalNodeIds: ['branchA', 'branchB'],
    nodes: [
      { nodeId: 'gw', type: 'DECISION_GATEWAY' },
      { nodeId: 'branchA', type: 'CAPABILITY' },
      { nodeId: 'branchB', type: 'CAPABILITY' },
    ],
    edges: [
      { edgeId: 'e_a', sourceNodeId: 'gw', targetNodeId: 'branchA', edgeType: 'CONDITIONAL' },
      { edgeId: 'e_b', sourceNodeId: 'gw', targetNodeId: 'branchB', edgeType: 'CONDITIONAL' },
    ],
  };
  const draft = await call('POST', `/cases/${caseId}/plan-versions`, token, {
    semanticGraph: graph,
    changeReason: 'F3 partial+skipped states — gateway-only entry graph',
  });
  if (draft.status !== 201) throw new Error(`create plan draft failed: ${JSON.stringify(draft)}`);
  const planVersionId = draft.body.data.casePlanVersionId;
  record('createPlanDraft', { status: draft.status, planVersionId, version: draft.body.data.version });

  const proposed = await call('POST', `/plan-versions/${planVersionId}/propose`, token, {
    expectedVersion: draft.body.data.version,
  });
  if (proposed.status !== 200) throw new Error(`propose failed: ${JSON.stringify(proposed)}`);
  record('propose', { status: proposed.status, version: proposed.body.data.version });

  const published = await call('POST', `/plan-versions/${planVersionId}/publish`, token, {
    expectedVersion: proposed.body.data.version,
  });
  if (published.status !== 200) throw new Error(`publish failed: ${JSON.stringify(published)}`);
  record('publish', {
    status: published.status,
    version: published.body.data.version,
    graphDigest: published.body.data.graphDigest,
  });

  // -- 3. Run — createRun auto-creates the v8_execution_runs row AND the
  //      case_workspace_run_bindings row (runLifecycleService.createRun,
  //      confirmed by reading the source) — no separate /run-bindings call
  //      needed here. --------------------------------------------------------
  const idempotencyKey = `f3-run-${stamp}`;
  const run = await call('POST', `/cases/${caseId}/runs`, token, {
    casePlanVersionId: planVersionId,
    idempotencyKey,
  });
  if (run.status !== 201) throw new Error(`create run failed: ${JSON.stringify(run)}`);
  const runId = run.body.data.runId;
  record('createRun', { status: run.status, runId, runStatus: run.body.data.status });

  // -- 4. Start — mints a READY NodeRun for the entry node (`gw` itself). ---
  const started = await call('POST', `/runs/${runId}/start`, token, {});
  if (started.status !== 200) throw new Error(`start failed: ${JSON.stringify(started)}`);
  const gwNodeRunId = started.body.data.nodeRunIds[0];
  record('startRun', {
    status: started.status,
    outcome: started.body.data.outcome,
    nodeRunIds: started.body.data.nodeRunIds,
    gwNodeRunId,
  });

  // -- 5. Record the REAL gateway evaluation selecting branch A. ------------
  const evaluation = await call('POST', `/runs/${runId}/gateway-evaluations`, token, {
    nodeRunId: gwNodeRunId,
    gatewayNodeType: 'DECISION_GATEWAY',
    conditionExpression: 'input.choice == "A"',
    conditionSchemaVersion: 'v1',
    evaluationInputSnapshot: { choice: 'A' },
    outcomeStatus: 'BRANCH_SELECTED',
    outcomeDetail: { selectedEdgeId: 'e_a' },
    evaluatedAt: new Date().toISOString(),
  });
  if (evaluation.status !== 201) throw new Error(`gateway evaluation failed: ${JSON.stringify(evaluation)}`);
  record('recordGatewayEvaluation', { status: evaluation.status, data: evaluation.body.data });

  // -- 6. Advance — resolves `gw`, creates branchA's real NodeRun READY, and
  //      (inside the SAME call) writes the SKIPPED/NOT_APPLICABLE row for
  //      branchB via recordUnselectedBranchesSkipped. ------------------------
  const advanced = await call('POST', `/runs/${runId}/advance`, token, {});
  if (advanced.status !== 200) throw new Error(`advance failed: ${JSON.stringify(advanced)}`);
  const createdNodeRunIds = advanced.body.data.createdNodeRunIds;
  record('advanceRun', {
    status: advanced.status,
    runStatus: advanced.body.data.run.status,
    createdNodeRunIds,
  });
  const branchANodeRunId = createdNodeRunIds[0];
  if (!branchANodeRunId) throw new Error('advanceRun did not create a NodeRun for branchA — cannot continue');

  // -- 7. A deliverable the PARTIAL row's snapshot points at (same shape as
  //      partialResults.pg.test.ts's own deliverable identity proof), so the
  //      UI's "Otwórz" affordance on the PARTIAL row has something real to
  //      resolve against. -----------------------------------------------------
  const deliverableId = `f3-deliverable-${stamp}`;
  const link = await call('POST', `/cases/${caseId}/artifact-links`, token, {
    artifactType: 'document',
    artifactId: deliverableId,
    artifactRevision: 'rev-1',
    relation: 'DELIVERABLE',
  });
  if (link.status !== 201) throw new Error(`artifact link failed: ${JSON.stringify(link)}`);
  record('createArtifactLink', { status: link.status, linkId: link.body.data.linkId, deliverableId });

  // -- 8. THE PARTIAL ROW — a real partial acceptance of branchA's real
  //      result, per the canonical executionGraph route. ---------------------
  const partial = await call('POST', `/runs/${runId}/node-result-acceptances`, token, {
    nodeRunId: branchANodeRunId,
    nodeType: 'CAPABILITY',
    nodeCompletionState: 'COMPLETED',
    resultAcceptance: 'PARTIAL',
    acceptanceInputSnapshot: {
      summary: 'F3: branch A delivered a draft; sign-off still pending — genuinely partial.',
      artifactType: 'document',
      artifactId: deliverableId,
    },
    occurredAt: new Date().toISOString(),
  });
  if (partial.status !== 201) throw new Error(`partial acceptance failed: ${JSON.stringify(partial)}`);
  record('recordPartialAcceptance', { status: partial.status, data: partial.body.data });

  // -- 9. Read back through the EXACT route the UI calls (RezultatyView ->
  //      apiResults.ts -> GET /cases/:caseId/node-result-acceptances). ------
  const list = await call('GET', `/cases/${caseId}/node-result-acceptances`, token);
  record('listNodeResultAcceptancesForCase', { status: list.status, rows: list.body.data });

  // -- 10. A second, independent read — the refresh-safety proof at the API
  //       layer (UI-layer refresh proof comes from the Playwright capture). -
  const secondList = await call('GET', `/cases/${caseId}/node-result-acceptances`, token);
  record('secondRead', { status: secondList.status, rows: secondList.body.data });

  const summary = {
    caseId,
    planVersionId,
    runId,
    gwNodeRunId,
    branchANodeRunId,
    deliverableId,
    linkId: link.body.data.linkId,
    partialNodeResultRow: partial.body.data,
    skippedRowFromList: list.body.data.find((r) => r.nodeCompletionState === 'SKIPPED') ?? null,
    partialRowFromList: list.body.data.find((r) => r.resultAcceptance === 'PARTIAL') ?? null,
    allRowsSecondRead: secondList.body.data,
  };
  console.log(JSON.stringify({ summary, log }, null, 2));
}

main().catch((err) => {
  console.error('DRIVE_STATES_FAILED', err);
  console.log(JSON.stringify({ error: String(err), log }, null, 2));
  process.exit(1);
});
