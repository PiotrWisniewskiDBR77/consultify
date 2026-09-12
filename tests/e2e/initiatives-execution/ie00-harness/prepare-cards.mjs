import fs from 'node:fs';
const dir = '/Users/piotrwisniewski/Developer/codex-wt/codex7-artefakty/ie00';
const tokens = JSON.parse(fs.readFileSync(`${dir}/local-test-tokens.json`, 'utf8'));
const id = JSON.parse(fs.readFileSync(`${dir}/ui-create-receipt.json`, 'utf8')).body.response
  .initiativeId;
const cards = [
  [
    'summary-scope',
    {
      problem: 'Changeover takes too long',
      outcome: 'Reduce changeover time',
      inScope: ['Line 4'],
      outOfScope: ['Line 5'],
    },
  ],
  ['strategic-fit', { objectives: ['OEE'], rationale: 'Improve capacity' }],
  [
    'success-criteria',
    { successCriteria: ['Shorter changeovers'], measurementPlan: 'Weekly observation' },
  ],
  ['outcomes-benefits', { outcomes: ['Faster changeover'], benefits: ['More capacity'] }],
  ['options', { doNothing: 'Maintain current performance', alternatives: ['SMED'] }],
  ['people-team', { team: ['Operations'], capacityAssumptions: 'Part-time' }],
  ['roles-raci', { accountableOwnerId: 'owner-1', roles: ['Engineer'] }],
  ['stakeholders', { ownerId: 'owner-1', sponsorId: 'definition-authority-1' }],
];
const evidence = [];
async function api(actor, path, body) {
  const r = await fetch(
    `http://127.0.0.1:4217/api/initiatives/runtime-v1/initiatives/${id}${path}`,
    {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${tokens[actor]}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }
  );
  const data = await r.json();
  evidence.push({ path, status: r.status, body: data });
  if (!r.ok) throw new Error(JSON.stringify(evidence.at(-1)));
  return data;
}
try {
  let read = await api('owner-1', '/cards');
  let version = read.initiativeVersion;
  for (const [key, content] of cards) {
    const current = read.cards.find((c) => c.cardKey === key);
    if (current?.reviewState === 'ACCEPTED') continue;
    await api('owner-1', `/cards/${key}/publications`, {
      expectedVersion: version++,
      expectedCardVersion: current?.cardVersion || 0,
      clientRequestId: crypto.randomUUID(),
      applicability: 'REQUIRED',
      completion: 'COMPLETE',
      quality: 'SUFFICIENT',
      freshness: 'CURRENT',
      reviewState: 'REQUESTED',
      content,
      evidenceRefs: [`ie00-local-observation:${key}`],
      waiverDecisionId: null,
    });
    await api('definition-authority-1', `/cards/${key}/reviews`, {
      expectedVersion: version++,
      expectedCardVersion: (current?.cardVersion || 0) + 1,
      clientRequestId: crypto.randomUUID(),
      outcome: 'ACCEPTED',
      rationale: 'Local test evidence reviewed independently.',
    });
  }
  await api('owner-1', '/gates/definition/readiness');
} finally {
  fs.writeFileSync(`${dir}/ui-card-api-preparation.json`, JSON.stringify(evidence, null, 2));
}
