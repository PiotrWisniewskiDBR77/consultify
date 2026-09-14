import fs from 'node:fs';
import path from 'node:path';

import jwt from 'jsonwebtoken';
import { chromium } from 'playwright';
import { Client } from 'pg';

const OUT = path.resolve('evidence/f2-3-pmo/e2');
const BASE = 'http://127.0.0.1:5217';
const databaseUrl = 'postgresql://postgres:f23_local_only@127.0.0.1:6458/f23_e1';
const secret = 'test-jwt-secret-key-min-32-chars-long-for-validation';
const ids = {
  org: 'f2300000-0000-4000-8000-000000000001',
  owner: 'f2300000-0000-4000-8000-000000000002',
  member: 'f2300000-0000-4000-8000-000000000003',
  project: 'f2300000-0000-4000-8000-000000000004',
  ownerMembership: 'f2300000-0000-4000-8000-000000000005',
  memberMembership: 'f2300000-0000-4000-8000-000000000006',
  ownerProjectMember: 'f2300000-0000-4000-8000-000000000007',
  memberProjectMember: 'f2300000-0000-4000-8000-000000000008',
  notification: 'f2300000-0000-4000-8000-000000000009',
};
const technicalCopy = [
  'PROJECT_SPONSOR', 'PROJECT_LEADER', 'STEERING_COMMITTEE', 'WORKSTREAM_OWNER',
  'TASK_ASSIGNEE', 'BUSINESS_AUTHORITY', 'GATE_AUTHORITY', 'DOMAIN_AUTHORITY',
  'approve-business-case', 'accept-stage-gate', 'escalate-to-portfolio',
  'replace-project-manager-in-daily-delivery', 'manage-delivery', 'assign-work',
  'prepare-stage-gate', 'approve-own-business-case', 'resolve-escalations',
  'change-project-constraints', 'manage-individual-tasks', 'manage-workstream',
  'recommend-decisions', 'report-risks', 'approve-project-stage-gates',
  'deliver-assigned-work', 'report-progress', 'raise-blockers', 'approve-stage-gates',
];

const sql = new Client({ connectionString: databaseUrl });
let browser;
let context;
const failures = [];
const transportAborts = [];
const assertions = [];
let proofError;
let result;

const tokenFor = (userId, email, role) => jwt.sign({
  id: userId, userId, email, organizationId: ids.org, organization_id: ids.org, role,
}, secret, { expiresIn: '20m' });
const userFor = (id, email, firstName, lastName, role) => ({
  id, email, firstName, lastName, role, status: 'active', organizationId: ids.org,
  companyName: 'F2-3 PMO Browser', language: 'pl', isAuthenticated: true, accessLevel: 'full',
});
const ownerUser = userFor(ids.owner, 'owner@f23.local', 'Anna', 'Sponsor', 'OWNER');
const memberUser = userFor(ids.member, 'leader@f23.local', 'Jan', 'Kowalski', 'USER');
const ownerToken = tokenFor(ids.owner, ownerUser.email, 'OWNER');
const memberToken = tokenFor(ids.member, memberUser.email, 'USER');

async function deleteFixture() {
  await sql.query('DELETE FROM projects WHERE id=$1', [ids.project]);
  await sql.query('DELETE FROM organization_members WHERE organization_id=$1', [ids.org]);
  await sql.query('DELETE FROM users WHERE organization_id=$1', [ids.org]);
  await sql.query('DELETE FROM organizations WHERE id=$1', [ids.org]);
}

async function seedIdentity() {
  await sql.query(
    `INSERT INTO organizations(id,name,status,plan,default_language)
     VALUES($1,'F2-3 PMO Browser','active','enterprise','pl')`, [ids.org]
  );
  await sql.query(
    `INSERT INTO users(id,organization_id,email,password,role,status,first_name,last_name,language,onboarding_completed,email_verified,profile_survey_completed_at)
     VALUES($1,$3,'owner@f23.local','unused','OWNER','active','Anna','Sponsor','pl',true,1,CURRENT_TIMESTAMP),
           ($2,$3,'leader@f23.local','unused','USER','active','Jan','Kowalski','pl',true,1,CURRENT_TIMESTAMP)`,
    [ids.owner, ids.member, ids.org]
  );
  await sql.query(
    `INSERT INTO organization_members(id,organization_id,user_id,role,status)
     VALUES($1,$3,$4,'OWNER','ACTIVE'),($2,$3,$5,'USER','ACTIVE')`,
    [ids.ownerMembership, ids.memberMembership, ids.org, ids.owner, ids.member]
  );
}

async function seedProject() {
  await sql.query(
    `INSERT INTO projects(id,organization_id,name,description,goal,status,owner_id,pmo_standard,start_date,target_end_date,budget_amount,budget_currency)
     VALUES($1,$2,'Program modernizacji zakładu','Uruchomienie kanonicznego PMO','Dowieźć falę 2','active',$3,'pmbok','2026-09-15','2026-12-15',125000,'EUR')`,
    [ids.project, ids.org, ids.owner]
  );
  await sql.query(
    `INSERT INTO project_members(id,project_id,user_id,project_role,normalized_project_role,allocation_percent)
     VALUES($1,$3,$4,'PROJECT_SPONSOR','PROJECT_SPONSOR',40),
           ($2,$3,$5,'TASK_ASSIGNEE','TASK_ASSIGNEE',60)`,
    [ids.ownerProjectMember, ids.memberProjectMember, ids.project, ids.owner, ids.member]
  );
  await sql.query(
    `INSERT INTO project_notification_settings(id,project_id,task_overdue_enabled,decision_pending_enabled,email_weekly_summary,escalation_days)
     VALUES($1,$2,1,1,0,3)`, [ids.notification, ids.project]
  );
}

async function setSession(page, token, user) {
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('consultify_current_org_id', user.organizationId);
    localStorage.setItem('consultify_onboarding_done:' + user.id, 'true');
  }, { token, user });
}

async function captureBoth(page, stateName, locator) {
  await locator.waitFor({ state: 'visible', timeout: 30_000 });
  await locator.scrollIntoViewIfNeeded();
  await page.locator('html').evaluate((node) => node.classList.remove('dark'));
  await page.screenshot({ path: path.join(OUT, `${stateName}_light_1440x900.png`) });
  await page.locator('html').evaluate((node) => node.classList.add('dark'));
  await page.screenshot({ path: path.join(OUT, `${stateName}_dark_1440x900.png`) });
  await page.locator('html').evaluate((node) => node.classList.remove('dark'));
}

await sql.connect();
try {
  await deleteFixture();
  await seedIdentity();

  browser = await chromium.launch();
  context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.route('https://www.google-analytics.com/**', (route) => route.fulfill({ status: 204 }));
  const page = await context.newPage();
  page.on('console', (message) => { if (message.type() === 'error') failures.push(`console: ${message.text()}`); });
  page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));
  page.on('requestfailed', (request) => transportAborts.push(`requestfailed: ${request.method()} ${request.url()} ${request.failure()?.errorText}`));
  page.on('response', (response) => { if (response.status() >= 400) failures.push(`http: ${response.status()} ${response.request().method()} ${response.url()}`); });
  await page.addInitScript(({ token, user }) => {
    if (!localStorage.getItem('token')) localStorage.setItem('token', token);
    if (!localStorage.getItem('user')) localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('consultify_current_org_id', user.organizationId);
    localStorage.setItem('i18nextLng', 'pl');
    localStorage.setItem('consultify_onboarding_done:' + user.id, 'true');
    if (!localStorage.getItem('consultify-storage')) {
      localStorage.setItem('consultify-storage', JSON.stringify({ state: { theme: 'light' }, version: 0 }));
    }
  }, { token: ownerToken, user: ownerUser });

  let releaseProjects;
  await page.route('**/api/projects', async (route) => {
    await new Promise((resolve) => { releaseProjects = resolve; });
    await route.continue();
  }, { times: 1 });
  const firstNavigation = page.goto(`${BASE}/projects`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const loading = page.getByTestId('standard-table-loading').first();
  await captureBoth(page, '18_state_loading', loading);
  assertions.push('loading state captured in light and dark');
  releaseProjects();
  await firstNavigation;
  await page.waitForLoadState('networkidle');
  const empty = page.getByTestId('standard-table-empty').first();
  await captureBoth(page, '19_state_empty', empty);
  assertions.push('empty state captured in light and dark');

  await seedProject();
  await setSession(page, memberToken, memberUser);
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByText('Program modernizacji zakładu', { exact: true }).first().click();
  const noPermission = page.getByTestId('pmo-no-management-permission');
  await captureBoth(page, '20_state_no_permission', noPermission);
  const deniedSelects = page.locator('select[aria-label="Rola projektowa"]');
  if ((await deniedSelects.count()) < 2 || !(await deniedSelects.first().isDisabled())) {
    throw new Error('no-permission state did not disable role writers');
  }
  assertions.push('no-permission state disables writers and is captured in light and dark');

  await setSession(page, ownerToken, ownerUser);
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByText('Program modernizacji zakładu', { exact: true }).first().click();
  const unassignedRole = page.getByTestId('pmo-unassigned-required-role');
  await captureBoth(page, '21_state_unassigned_role', unassignedRole);
  if (!(await unassignedRole.innerText()).includes('Kierownik projektu')) {
    throw new Error('unassigned required role is not human-labelled');
  }
  assertions.push('required unassigned role is human-labelled and captured in light and dark');

  const roleAssignments = page.getByTestId('pmo-role-assignments');
  const assignmentsBeforeEdit = await roleAssignments.innerText();
  if (!assignmentsBeforeEdit.includes('Sponsor projektu') ||
      !assignmentsBeforeEdit.includes('Anna Sponsor') ||
      !assignmentsBeforeEdit.includes('Członek zespołu') ||
      !assignmentsBeforeEdit.includes('Jan Kowalski') ||
      assignmentsBeforeEdit.includes('MEMBER')) {
    throw new Error(`production projectRole grouping mismatch before edit: ${assignmentsBeforeEdit}`);
  }
  assertions.push('production API projectRole renders distinct Sponsor projektu and Członek zespołu groups');

  const bodyText = await page.locator('body').innerText();
  fs.writeFileSync(path.join(OUT, 'browser-body-pl.txt'), bodyText);
  for (const raw of technicalCopy) {
    if (bodyText.includes(raw)) throw new Error(`raw technical copy visible in PL: ${raw}`);
  }
  assertions.push('complete rendered Polish PMO screen contains zero role/action/approval slugs');

  const roleSelects = page.locator('select[aria-label="Rola projektowa"]');
  let memberIndex = -1;
  for (let index = 0; index < await roleSelects.count(); index += 1) {
    if (memberIndex < 0 && (await roleSelects.nth(index).inputValue()) === 'TASK_ASSIGNEE') {
      memberIndex = index;
    }
  }
  if (memberIndex < 0) throw new Error('TASK_ASSIGNEE edit row not found');
  await roleSelects.nth(memberIndex).selectOption('PROJECT_LEADER');
  await page.locator('input[aria-label="Pojemność"]').nth(memberIndex).fill('75');
  await page.getByRole('button', { name: 'Zapisz' }).nth(memberIndex).click();
  await page.getByText('Zaktualizowano członka zespołu').waitFor({ state: 'visible' });
  const updated = (await sql.query(
    'SELECT normalized_project_role,allocation_percent FROM project_members WHERE project_id=$1 AND user_id=$2',
    [ids.project, ids.member]
  )).rows[0];
  if (updated.normalized_project_role !== 'PROJECT_LEADER' || Number(updated.allocation_percent) !== 75) {
    throw new Error(`DEC-480 UI readback mismatch: ${JSON.stringify(updated)}`);
  }
  assertions.push('existing member edited through UI and PostgreSQL readback = PROJECT_LEADER/75');

  await page.getByTestId('pmo-role-assignments').getByText('Kierownik projektu', { exact: true })
    .waitFor({ state: 'visible' });
  const assignmentsAfterEdit = await roleAssignments.innerText();
  if (!assignmentsAfterEdit.includes('Sponsor projektu') ||
      !assignmentsAfterEdit.includes('Kierownik projektu') ||
      assignmentsAfterEdit.includes('Członek zespołu') ||
      assignmentsAfterEdit.includes('MEMBER')) {
    throw new Error(`production projectRole grouping mismatch after edit: ${assignmentsAfterEdit}`);
  }
  assertions.push('role assignment summary follows UI edit without false MEMBER group');

  await captureBoth(page, '12_e2', page.getByRole('heading', { name: 'Zespół', exact: true }));
  await captureBoth(page, '29_filled_responsibilities', page.getByText('Odpowiedzialności ról', { exact: true }));
  await captureBoth(page, '30_filled_communication', page.getByText('Plan komunikacji', { exact: true }));
  await captureBoth(page, '31_filled_approval', page.getByText('Wejścia do akceptacji', { exact: true }));
  assertions.push('filled responsibilities captured in-scene light and dark');
  assertions.push('filled communication captured in-scene light and dark');
  assertions.push('filled approval inputs captured in-scene light and dark');

  result = {
    verdict: failures.length === 0 ? 'GREEN' : 'HOLD', builtFrontend: true,
    gatewayJwtRealPg: true, viewport: '1440x900', assertions, failures, transportAborts,
    sqlReadback: updated,
  };
} catch (error) {
  proofError = error;
  result = { verdict: 'HOLD', assertions, failures, transportAborts, error: String(error) };
} finally {
  if (context) await context.close().catch(() => {});
  if (browser) await browser.close().catch(() => {});
  await deleteFixture();
  const remaining = Number((await sql.query(
    `SELECT COUNT(*)::int AS count FROM organizations WHERE id=$1 OR name='F2-3 PMO Browser'`, [ids.org]
  )).rows[0].count);
  const childRows = Number((await sql.query(
    `SELECT (SELECT COUNT(*) FROM users WHERE organization_id=$1) +
            (SELECT COUNT(*) FROM organization_members WHERE organization_id=$1) +
            (SELECT COUNT(*) FROM projects WHERE organization_id=$1) AS count`, [ids.org]
  )).rows[0].count);
  const cleanup = { organizationRows: remaining, dependentRows: childRows, verdict: remaining === 0 && childRows === 0 ? 'GREEN' : 'HOLD' };
  fs.writeFileSync(path.join(OUT, '17_fixture_cleanup.json'), JSON.stringify(cleanup, null, 2));
  result.cleanup = cleanup;
  if (cleanup.verdict !== 'GREEN') result.verdict = 'HOLD';
  fs.writeFileSync(path.join(OUT, '14_browser_result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  await sql.end();
}

if (proofError || result.verdict !== 'GREEN') process.exitCode = 1;
