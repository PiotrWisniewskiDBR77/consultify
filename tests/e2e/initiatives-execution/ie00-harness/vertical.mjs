import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const dir = '/Users/piotrwisniewski/Developer/codex-wt/codex7-artefakty/ie00';
const tokens = JSON.parse(fs.readFileSync(`${dir}/local-test-tokens.json`, 'utf8'));
const id = JSON.parse(fs.readFileSync(`${dir}/ui-create-receipt.json`, 'utf8')).body.response
  .initiativeId;
const browser = await chromium.launch({ headless: true });
const evidence = { initiativeId: id, steps: [], errors: [] };
const contexts = [];
async function actor(who, view) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  contexts.push(context);
  await context.addInitScript((token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('i18nextLng', 'en');
  }, tokens[who]);
  const p = await context.newPage();
  p.on('pageerror', (e) => evidence.errors.push({ actor: who, error: e.message }));
  p.on('response', (r) => {
    if (r.status() >= 400) evidence.errors.push({ actor: who, status: r.status(), url: r.url() });
  });
  await p.goto(`http://127.0.0.1:5598/?view=${view}&initiativeId=${id}`);
  return p;
}
async function gates(p) {
  await p.getByText('Gates', { exact: true }).click();
  await p.getByRole('region', { name: 'Definition approval' }).waitFor();
}
async function preview(p) {
  await p.getByText('IE00 UI Definition vertical — Definition', { exact: true }).click();
  await p.getByRole('region', { name: 'Definition approval' }).waitFor();
}
async function write(p, suffix, click, label) {
  const pending = p.waitForResponse(
    (r) => r.url().endsWith(suffix) && r.request().method() === 'POST',
    { timeout: 15000 }
  );
  await click();
  const r = await pending;
  const body = await r.json();
  evidence.steps.push({ label, status: r.status(), body });
  assert.equal(r.status(), 201, JSON.stringify(body));
  await p.screenshot({ path: `${dir}/${label}.png`, fullPage: true });
  return body;
}
try {
  const owner = await actor('owner-1', 'initiative');
  const reviewer = await actor('definition-authority-1', 'decisions');
  let decisionId;
  if (process.env.IE00_RESUME_AT_RETURN === 'true') {
    const previous = JSON.parse(fs.readFileSync(`${dir}/ui-vertical-at-return.json`));
    evidence.steps.push(...previous.steps);
    evidence.errors.push(...previous.errors);
    decisionId = previous.decisionId;
  } else {
    await gates(owner);
    await owner.getByLabel('Approver', { exact: true }).selectOption('definition-authority-1');
    await owner.getByLabel('Decision deadline').fill('2027-01-01T12:00');
    const requested = await write(
      owner,
      '/definition/requests',
      () => owner.getByRole('button', { name: 'Request Definition approval', exact: true }).click(),
      'ui-01-request'
    );
    decisionId = requested.response.decisionId;
    await reviewer.reload();
    await preview(reviewer);
    await reviewer
      .getByRole('textbox', { name: 'Decision rationale', exact: true })
      .fill('Clarify that the scope covers Line 4 only.');
    const returned = await write(
      reviewer,
      '/definition/decisions',
      () => reviewer.getByRole('button', { name: 'Return for changes', exact: true }).click(),
      'ui-02-return'
    );
    assert.equal(returned.response.decisionId, decisionId);
    fs.writeFileSync(
      `${dir}/ui-vertical-at-return.json`,
      JSON.stringify({ ...evidence, decisionId }, null, 2)
    );
  }
  evidence.decisionId = decisionId;
  await owner.reload();
  await gates(owner);
  await owner.getByText('Definition card content and review', { exact: true }).click();
  await owner
    .getByRole('textbox', { name: 'Expected outcome', exact: true })
    .fill('Reduce changeover time on Line 4 only.');
  await write(
    owner,
    '/summary-scope/publications',
    () => owner.getByRole('button', { name: 'Save card and request review', exact: true }).click(),
    'ui-03-edit'
  );
  await reviewer.reload();
  await preview(reviewer);
  await reviewer.getByText('Definition card content and review', { exact: true }).click();
  await reviewer
    .getByRole('textbox', { name: 'Review rationale', exact: true })
    .fill('Line 4 scope has been clarified and independently checked.');
  await write(
    reviewer,
    '/summary-scope/reviews',
    () => reviewer.getByRole('button', { name: 'Accept card content', exact: true }).click(),
    'ui-04-review'
  );
  await owner.reload();
  await gates(owner);
  await owner.getByLabel('Approver', { exact: true }).selectOption('definition-authority-1');
  await owner.getByLabel('Decision deadline').fill('2027-01-01T12:00');
  const resubmitted = await write(
    owner,
    '/definition/requests',
    () => owner.getByRole('button', { name: 'Resubmit', exact: true }).click(),
    'ui-05-resubmit'
  );
  assert.equal(resubmitted.response.decisionId, decisionId);
  await reviewer.reload();
  await preview(reviewer);
  await reviewer
    .getByRole('textbox', { name: 'Decision rationale', exact: true })
    .fill('Definition accepted with the clarified scope.');
  const approved = await write(
    reviewer,
    '/definition/decisions',
    () => reviewer.getByRole('button', { name: 'Approve Definition', exact: true }).click(),
    'ui-06-approve'
  );
  assert.equal(approved.response.decisionId, decisionId);
  await owner.reload();
  await gates(owner);
  await owner.getByText('Decision: Approved', { exact: true }).waitFor();
  evidence.coldText = await owner.locator('body').innerText();
  assert.ok(evidence.coldText.includes('Initiative state: Defined'));
  await owner.screenshot({ path: `${dir}/ui-07-cold.png`, fullPage: true });
  evidence.status = 'PASS';
} catch (e) {
  evidence.status = 'FAIL';
  evidence.failure = String(e);
  for (const c of contexts)
    for (const p of c.pages())
      await p
        .screenshot({ path: `${dir}/ui-failure-${contexts.indexOf(c)}.png`, fullPage: true })
        .catch(() => {});
  throw e;
} finally {
  fs.writeFileSync(`${dir}/ui-vertical.json`, JSON.stringify(evidence, null, 2));
  await browser.close();
}
