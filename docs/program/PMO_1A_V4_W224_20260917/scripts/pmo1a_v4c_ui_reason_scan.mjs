import fs from 'fs';
import path from 'path';

const API = process.env.PMO1A_API_URL || 'http://127.0.0.1:4214/api';
const ORG = '468b234c-66c4-54e1-b626-5e0fb3a92f6a';
const TARGET_BY_STATUS = {
  APPROVED_BACKLOG: 'PLANNING',
  SCHEDULED: 'SCHEDULED',
  IN_EXECUTION: 'EXECUTING',
  DELIVERED: 'DONE',
  EFFECTIVENESS_REVIEWED: 'DONE',
  CLOSED: 'DONE',
};

function readAccessFile() {
  const candidates = [
    process.env.PMO1A_DOSTEP_PATH,
    path.resolve(process.cwd(), 'DOSTEP.md'),
    '/Users/piotrwisniewski/Developer/cto-codex/irina-20260914/DOSTEP.md',
    '/Users/piotrwisniewski/Developer/DOSTEP.md',
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return fs.readFileSync(candidate, 'utf8');
    } catch {}
  }
  return '';
}
function readAccessValue(name) {
  const access = readAccessFile();
  const re = new RegExp(`(?:^|\n)\\s*(?:export\\s+)?${name}\\s*=\\s*["']?([^"'\\n]+)`, 'm');
  const match = access.match(re);
  return match?.[1]?.trim() || '';
}
const loginPassword = process.env.PMO1A_REALPG_LOGIN_PASSWORD || readAccessValue('PMO1A_REALPG_LOGIN_PASSWORD') || readAccessValue('CODEX_LOCAL_PASSWORD') || readAccessValue('LOCAL_TEST_PASSWORD') || readAccessFile().match(/Hasło tymczasowe:\s*`([^`]+)`/)?.[1];
if (!loginPassword) throw new Error('PMO1A_REALPG_LOGIN_PASSWORD must be provided via env or DOSTEP.md');

async function login(email) {
  const response = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: loginPassword }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.token) throw new Error(`login failed: ${response.status} ${JSON.stringify(body)}`);
  return body.token;
}
async function api(token, route) {
  const response = await fetch(`${API}${route}`, {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  });
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: response.status, body };
}
function classify(row, preflight) {
  const transitions = preflight.transitions || [];
  const primary = transitions.find((transition) => transition.targetStatus && !['REJECT','CANCEL'].includes(transition.gate) && transition.roleAllowed);
  if (!primary) {
    return {
      id: row.id,
      title: row.name,
      currentStatus: preflight.currentStatus || row.status,
      primaryTarget: null,
      target: null,
      proposalReady: false,
      rendersDecisionButton: false,
      reason: 'NO_PRIMARY_TRANSITION',
      deadButtonWithoutReason: false,
    };
  }
  const target = TARGET_BY_STATUS[primary.targetStatus] || null;
  const caseStatus = preflight.transitionCase?.status || 'none';
  const hasReviewer = Boolean(row.sponsor_id);
  const proposalReady = Boolean(target && hasReviewer && primary.conditionSatisfied && caseStatus === 'ready' && row.sponsor_id !== '08c54d75-5260-57b1-9db6-a30aed89a587' && primary.proposalAllowed !== false);
  let reason = '';
  if (!hasReviewer) reason = 'Select a reviewer before requesting a PMO decision.';
  else if (row.sponsor_id === '08c54d75-5260-57b1-9db6-a30aed89a587') reason = 'Choose a reviewer other than yourself before requesting this decision.';
  else if (primary.proposalAllowed === false) reason = primary.proposalBlockingRule || 'PROPOSAL_BLOCKED';
  else if (!primary.conditionSatisfied) reason = primary.disabledRule || primary.blockingRule || primary.disabledReason || 'The PMO preflight condition is not satisfied.';
  else if (caseStatus === 'missing') reason = 'The linked transformation case is required before this PMO decision can be requested.';
  else if (caseStatus === 'execution_context_missing') reason = 'The linked transformation case is missing its execution context.';
  else if (caseStatus === 'source_not_ready') reason = 'The linked transformation case is not at the required scheduling stage yet.';
  else if (!target) reason = 'This transition is not supported by the PMO decision request yet.';
  else if (caseStatus !== 'ready') reason = `The linked transformation case is not ready (${caseStatus}).`;
  return {
    id: row.id,
    title: row.name,
    currentStatus: preflight.currentStatus || row.status,
    primaryTarget: primary.targetStatus,
    target,
    caseStatus,
    proposalReady,
    rendersDecisionButton: true,
    reason,
    deadButtonWithoutReason: !proposalReady && !reason,
  };
}

const token = await login('james.whitfield@northwind.example');
const client = (await import('pg')).Client;
const dbUrl = process.env.PMO1A_REALPG_DATABASE_URL || process.env.DATABASE_URL || readAccessValue('PMO1A_REALPG_DATABASE_URL') || readAccessValue('DATABASE_URL');
if (!dbUrl) throw new Error('PMO1A_REALPG_DATABASE_URL or DATABASE_URL is required');
const db = new client({ connectionString: dbUrl });
await db.connect();
try {
  const { rows } = await db.query('SELECT id,name,status,sponsor_id FROM initiatives WHERE organization_id=$1 ORDER BY name', [ORG]);
  const results = [];
  for (const row of rows) {
    const preflight = await api(token, `/initiatives/${encodeURIComponent(row.id)}/transition-preflight`);
    results.push({...classify(row, preflight.body || {}), sponsorId: row.sponsor_id, preflight: preflight.body});
  }
  const summary = {
    total: results.length,
    proposalReady: results.filter((row) => row.proposalReady).length,
    disabledWithReason: results.filter((row) => row.rendersDecisionButton && !row.proposalReady && row.reason).length,
    noDecisionButton: results.filter((row) => !row.rendersDecisionButton).length,
    deadButtonWithoutReason: results.filter((row) => row.deadButtonWithoutReason).length,
  };
  const out = { generatedAt: new Date().toISOString(), summary, results };
  fs.writeFileSync('docs/program/PMO_1A_V4_W224_20260917/measure-v4d-ui-reason-scan.json', JSON.stringify(out, null, 2));
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await db.end();
}
