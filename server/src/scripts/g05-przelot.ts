import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import express, { type Express } from 'express';

const REQUIRED_ENV: Record<string, string> = {
  RUN_DB_TESTS: '1',
  MOCK_DB: 'false',
  DB_TYPE: 'postgres',
  NODE_ENV: 'test',
  ENABLE_V8_GLOBAL: 'true',
  ENABLE_TEST_AUTH_BYPASS: 'false',
  RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE: 'enforce',
  CI: 'true',
};

for (const [name, expected] of Object.entries(REQUIRED_ENV)) {
  assert.equal(process.env[name], expected, `${name} must equal ${expected}`);
}
assert.equal(
  process.env.DATABASE_URL,
  'postgresql://cx:cx@127.0.0.1:6274/cxg05',
  'DATABASE_URL must target the g05 disposable database'
);
assert.ok(process.env.JWT_SECRET, 'JWT_SECRET must be set');

const port = Number(process.env.PORT || '5276');
assert.ok(port === 5276 || port === 5277, 'Harness may only use ports 5276 or 5277');

const CREDS_FILE = '/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/b3755ab2-d353-4e48-8c39-5134ec500237/scratchpad/g05-creds.json';
const PASSWORD = 'G05-Local-Only-Password-1';

type Json = Record<string, any>;

async function requestJson(
  method: string,
  path: string,
  options: { token?: string; body?: Json } = {}
): Promise<{ status: number; body: Json }> {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      Connection: 'close',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  let body: Json;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  return { status: response.status, body };
}

async function register(email: string, companyName: string): Promise<Json> {
  const result = await requestJson('POST', '/api/auth/register', {
    body: {
      email,
      password: PASSWORD,
      firstName: 'G05',
      lastName: 'Przelot',
      companyName,
      isDemo: true,
    },
  });
  assert.equal(result.status, 200, `registration failed: ${JSON.stringify(result.body)}`);
  assert.equal(result.body.user?.companyName, companyName);
  assert.ok(result.body.user?.organizationId);
  return result.body;
}

async function login(email: string): Promise<{ token: string; userId: string }> {
  const result = await requestJson('POST', '/api/auth/login', {
    body: { email, password: PASSWORD },
  });
  assert.equal(result.status, 200, `login failed: ${JSON.stringify(result.body)}`);
  assert.ok(result.body.token, 'login did not issue a fresh access token');
  return { token: result.body.token as string, userId: result.body.user?.id as string };
}

// A "cold read" per the run's definition: a brand-new login (fresh JWT) and
// Connection: close on the request, so no state survives from the write.
async function coldRead(email: string, path: string): Promise<{ status: number; body: Json }> {
  const { token } = await login(email);
  return requestJson('GET', path, { token });
}

async function runR1R2(): Promise<void> {
  const nonce = Date.now();
  const emailA = `g05+a-${nonce}@local.test`;
  const emailB = `g05+b-${nonce}@local.test`;
  const companyA = `G05 Organization A ${nonce}`;
  const companyB = `G05 Organization B ${nonce}`;

  const registeredA = await register(emailA, companyA);
  const registeredB = await register(emailB, companyB);
  const organizationA = registeredA.user.organizationId as string;
  const organizationB = registeredB.user.organizationId as string;
  assert.notEqual(organizationA, organizationB);

  const coldA = await login(emailA);
  const positive = await requestJson('GET', `/api/organizations/${organizationA}`, {
    token: coldA.token,
  });
  assert.equal(positive.status, 200, `positive readback failed: ${JSON.stringify(positive.body)}`);
  const returnedOrganization = positive.body.organization || positive.body;
  assert.equal(returnedOrganization.id, organizationA);
  assert.equal(returnedOrganization.name, companyA);

  const coldB = await login(emailB);
  const negative = await requestJson('GET', `/api/organizations/${organizationA}`, {
    token: coldB.token,
  });
  assert.ok(
    [403, 404].includes(negative.status),
    `tenant B read organization A with status ${negative.status}: ${JSON.stringify(negative.body)}`
  );

  fs.mkdirSync(path.dirname(CREDS_FILE), { recursive: true });
  fs.writeFileSync(
    CREDS_FILE,
    JSON.stringify(
      { emailA, emailB, organizationA, organizationB, companyA, companyB, userIdA: coldA.userId },
      null,
      2
    )
  );

  console.log(
    JSON.stringify(
      {
        phase: 'R1-R2',
        emailVerificationSent: { A: registeredA.emailVerificationSent, B: registeredB.emailVerificationSent },
        registration: { organizationA, organizationB, companyA, companyB, emailA, emailB },
        coldReadback: { status: positive.status, id: returnedOrganization.id, name: returnedOrganization.name },
        tenantIsolation: { status: negative.status, body: negative.body },
      },
      null,
      2
    )
  );
}

function loadCreds(): {
  emailA: string;
  emailB: string;
  organizationA: string;
  userIdA: string;
  sharedProjectId?: string;
} {
  const raw = fs.readFileSync(CREDS_FILE, 'utf8');
  return JSON.parse(raw);
}

async function runR3(): Promise<void> {
  const { emailA, userIdA } = loadCreds();
  const write = await login(emailA);
  const results: Json = {};

  // ONE shared project reused across Interview/Initiatives (this phase) and
  // Execution (R4) — the org's trial plan caps projects at 3, so a fresh
  // project per module would exhaust the quota before reaching R4. Reuse an
  // existing project (e.g. left over from an earlier harness rerun) rather
  // than creating a new one when the org already sits at the cap.
  let sharedProjectId: string;
  const sharedProject = await requestJson('POST', '/api/projects', {
    token: write.token,
    body: { name: `G05 Shared Project ${Date.now()}` },
  });
  if (sharedProject.status === 201) {
    sharedProjectId = sharedProject.body.id;
  } else {
    const existing = await requestJson('GET', '/api/projects', { token: write.token });
    const list = Array.isArray(existing.body) ? existing.body : existing.body?.projects || existing.body?.data;
    assert.ok(Array.isArray(list) && list.length > 0, `no existing project to reuse: ${JSON.stringify(existing.body)}`);
    sharedProjectId = list[0].id;
  }
  fs.writeFileSync(
    CREDS_FILE,
    JSON.stringify({ ...loadCreds(), sharedProjectId }, null, 2)
  );

  // --- Interview ---
  {
    const projectId = sharedProjectId;
    const sessionName = `G05 Interview Session ${Date.now()}`;
    const created = await requestJson('POST', '/api/interview/sessions', {
      token: write.token,
      body: { name: sessionName, projectId },
    });
    assert.equal(created.status, 201, `interview session create failed: ${JSON.stringify(created.body)}`);
    const sessionId = created.body.id || created.body.session?.id;
    assert.ok(sessionId, `no session id in response: ${JSON.stringify(created.body)}`);
    const read = await coldRead(emailA, `/api/interview/sessions/${sessionId}`);
    results.interview = {
      write: { status: created.status, sessionId, sentName: sessionName },
      coldRead: { status: read.status, name: read.body.name || read.body.session?.name, full: read.body },
      match: (read.body.name || read.body.session?.name) === sessionName,
    };
  }

  // --- Tools ---
  {
    const toolName = `G05 Tool Session ${Date.now()}`;
    const created = await requestJson('POST', '/api/tools', {
      token: write.token,
      body: { toolType: 'MYWORK', name: toolName },
    });
    assert.ok([200, 201].includes(created.status), `tool session create failed: ${JSON.stringify(created.body)}`);
    const toolId = created.body.id || created.body.session?.id;
    assert.ok(toolId, `no tool id: ${JSON.stringify(created.body)}`);
    const read = await coldRead(emailA, `/api/tools/${toolId}`);
    results.tools = {
      write: { status: created.status, toolId, sentName: toolName },
      coldRead: { status: read.status, name: read.body.name || read.body.session?.name, full: read.body },
      match: (read.body.name || read.body.session?.name) === toolName,
    };
  }

  // --- Assessment ---
  {
    const assessmentName = `G05 Assessment ${Date.now()}`;
    const assessment = await requestJson('POST', '/api/assessments', {
      token: write.token,
      body: { name: assessmentName },
    });
    assert.equal(assessment.status, 201, `assessment create failed: ${JSON.stringify(assessment.body)}`);
    const assessmentId = assessment.body.assessment?.id;
    assert.ok(assessmentId, `no assessment id: ${JSON.stringify(assessment.body)}`);

    const reportName = `G05 Report ${Date.now()}`;
    const report = await requestJson('POST', '/api/assessment-reports', {
      token: write.token,
      body: { assessmentId, name: reportName },
    });
    assert.equal(report.status, 201, `report create failed: ${JSON.stringify(report.body)}`);
    const reportId = report.body.id;
    assert.ok(reportId, `no report id: ${JSON.stringify(report.body)}`);

    const execSummary = `G05 executive summary ${Date.now()}`;
    const updated = await requestJson('PUT', `/api/assessment-reports/${reportId}`, {
      token: write.token,
      body: { name: reportName, content: { executiveSummary: execSummary } },
    });
    assert.equal(updated.status, 200, `report update failed: ${JSON.stringify(updated.body)}`);

    const read = await coldRead(emailA, `/api/assessment-reports/${reportId}`);
    results.assessment = {
      write: { status: updated.status, reportId, sentName: reportName, sentSummary: execSummary },
      coldRead: {
        status: read.status,
        name: read.body.name,
        executiveSummary: read.body.content?.executiveSummary,
      },
      match: read.body.name === reportName && read.body.content?.executiveSummary === execSummary,
    };
  }

  // --- Initiatives ---
  {
    const title = `G05 Initiative ${Date.now()}`;
    const created = await requestJson('POST', '/api/initiatives', {
      token: write.token,
      body: { title, projectId: sharedProjectId },
    });
    assert.ok([200, 201].includes(created.status), `initiative create failed: ${JSON.stringify(created.body)}`);
    const initiativeId = created.body.id || created.body.initiative?.id;
    assert.ok(initiativeId, `no initiative id: ${JSON.stringify(created.body)}`);

    const newSummary = `G05 initiative summary ${Date.now()}`;
    const updated = await requestJson('PUT', `/api/initiatives/${initiativeId}`, {
      token: write.token,
      body: { title, summary: newSummary },
    });
    assert.equal(updated.status, 200, `initiative update failed: ${JSON.stringify(updated.body)}`);

    const read = await coldRead(emailA, `/api/initiatives/${initiativeId}`);
    const readInitiative = read.body.initiative || read.body;
    results.initiatives = {
      write: { status: updated.status, initiativeId, sentTitle: title, sentSummary: newSummary },
      coldRead: { status: read.status, title: readInitiative.title, summary: readInitiative.summary },
      match: readInitiative.title === title && readInitiative.summary === newSummary,
    };
  }

  console.log(JSON.stringify({ phase: 'R3', results }, null, 2));
}

async function runR4(): Promise<void> {
  const { emailA, userIdA } = loadCreds();
  const write = await login(emailA);
  const results: Json = {};

  // --- Realizacja (Execution) — real write is the Runtime-v1 source-proposal
  // entry point (funnel start), not the legacy /api/tasks writer (retired,
  // see "Moja praca" below) and not the deep CAS execution-case/task chain
  // (requires a full handoff request->decide governance sequence which is
  // out of scope for one probe write).
  {
    // Reuse the project created in R3 (Interview/Initiatives) — the org's
    // trial plan caps projects at 3.
    const { sharedProjectId } = loadCreds() as Json;
    assert.ok(sharedProjectId, 'R3 must run first to create the shared project');

    const addMember = await requestJson('POST', `/api/project-members/${sharedProjectId}`, {
      token: write.token,
      body: { userId: userIdA, role: 'MEMBER' },
    });
    assert.equal(addMember.status, 201, `add project member failed: ${JSON.stringify(addMember.body)}`);

    const title = `G05 Source Proposal ${Date.now()}`;
    const problem = `G05 probe problem statement ${Date.now()}`;
    const clientRequestId = `g05-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const proposalId = `g05-prop-${Date.now()}`;
    const created = await requestJson('POST', '/api/initiatives/runtime-v1/source-proposals', {
      token: write.token,
      body: {
        proposalId,
        expectedVersion: 0,
        clientRequestId,
        sourceType: 'manual',
        sourceId: `g05-source-${Date.now()}`,
        sourceVersion: 1,
        provenance: {
          system: 'g05-harness',
          recordType: 'probe',
          capturedAt: new Date().toISOString(),
          evidenceRefs: [],
        },
        title,
        problem,
        proposedOutcome: null,
        priority: 'MEDIUM',
        projectId: sharedProjectId,
        initiativeOwnerId: userIdA,
        visibility: 'PROJECT',
      },
    });
    const read = created.status === 201
      ? await coldRead(emailA, `/api/initiatives/runtime-v1/source-proposals/${proposalId}`)
      : { status: -1, body: {} };
    results.execution = {
      write: { status: created.status, body: created.body, proposalId, sentTitle: title, sentProblem: problem },
      coldRead: { status: read.status, body: read.body },
      match:
        created.status === 201 &&
        read.status === 200 &&
        (read.body.proposal?.title || read.body.title) === title,
    };
  }

  // --- Moja praca (My Work) — legacy /api/tasks POST is deliberately
  // retired (requireCanonicalExecutionWriter, non-GET -> 409). Real evidence
  // via a real HTTP call, not a crash. The functioning replacement is the
  // same Runtime-v1 engine measured above under "execution".
  {
    const legacyAttempt = await requestJson('POST', '/api/tasks', {
      token: write.token,
      body: { title: 'G05 legacy task probe' },
    });
    results.myWork = {
      legacyWriteAttempt: { status: legacyAttempt.status, body: legacyAttempt.body },
      isDeliberateRetirement:
        legacyAttempt.status === 409 &&
        legacyAttempt.body?.code === 'EXECUTION_RUNTIME_V1_WRITE_REQUIRED',
      note: 'shares Runtime-v1 engine with Realizacja (see results.execution above)',
    };
  }

  // --- Spotkania (Meetings) ---
  {
    const title = `G05 Meeting ${Date.now()}`;
    const startAt = new Date(Date.now() + 3600_000).toISOString();
    const created = await requestJson('POST', '/api/meeting', {
      token: write.token,
      body: { title, startAt },
    });
    assert.equal(created.status, 201, `meeting create failed: ${JSON.stringify(created.body)}`);
    const meetingId = created.body.meeting?.id;
    assert.ok(meetingId, `no meeting id: ${JSON.stringify(created.body)}`);
    const read = await coldRead(emailA, `/api/meeting/${meetingId}`);
    results.meetings = {
      write: { status: created.status, meetingId, sentTitle: title, sentStartAt: startAt },
      coldRead: { status: read.status, title: read.body.meeting?.title, startAt: read.body.meeting?.startAt },
      match: read.body.meeting?.title === title,
    };
  }

  // --- Wyniki (Results) — OKR objective, org-wide projectId placeholder ---
  {
    const label = `G05 Objective ${Date.now()}`;
    const created = await requestJson('POST', '/api/results-strategic/all/okr/objectives', {
      token: write.token,
      body: { label },
    });
    const read = created.status === 201
      ? await coldRead(emailA, '/api/results-strategic/all/okr')
      : { status: -1, body: {} };
    const found = Array.isArray(read.body?.objectives)
      ? read.body.objectives.find((o: any) => o.id === created.body?.id)
      : null;
    results.results = {
      write: { status: created.status, body: created.body, sentLabel: label },
      coldRead: { status: read.status, found: found || null },
      match: created.status === 201 && !!found && found.label === label,
    };
  }

  console.log(JSON.stringify({ phase: 'R4', results }, null, 2));
}

async function runR5(): Promise<void> {
  const { emailA, userIdA } = loadCreds();
  const write = await login(emailA);
  const results: Json = {};

  // --- Finanse (Economics) ---
  {
    const name = `G05 Analysis ${Date.now()}`;
    const created = await requestJson('POST', '/api/economics/analyses', {
      token: write.token,
      body: { name },
    });
    assert.equal(created.status, 201, `analysis create failed: ${JSON.stringify(created.body)}`);
    const analysisId = created.body.analysis?.id || created.body.id;
    assert.ok(analysisId, `no analysis id: ${JSON.stringify(created.body)}`);
    const read = await coldRead(emailA, `/api/economics/analyses/${analysisId}`);
    const readName = read.body.analysis?.name ?? read.body.name;
    results.finance = {
      write: { status: created.status, analysisId, sentName: name },
      coldRead: { status: read.status, name: readName },
      match: readName === name,
    };
  }

  // --- Materiały (Artifacts / Wave5) ---
  {
    const title = `G05 Artifact ${Date.now()}`;
    const content = `G05 probe content ${Date.now()}`;
    const created = await requestJson('POST', '/api/artifacts/wave5', {
      token: write.token,
      body: { artifactType: 'note', title, content },
    });
    assert.equal(created.status, 201, `artifact create failed: ${JSON.stringify(created.body)}`);
    const artifactId = created.body.artifact?.artifactId || created.body.artifact?.id;
    assert.ok(artifactId, `no artifact id: ${JSON.stringify(created.body)}`);
    const read = await coldRead(emailA, `/api/artifacts/wave5/${artifactId}`);
    results.materials = {
      write: { status: created.status, artifactId, sentTitle: title },
      coldRead: { status: read.status, title: read.body.artifact?.title },
      match: read.body.artifact?.title === title,
    };
  }

  // --- Audyty (Audits) — pack (draft) -> approve-expert -> publish -> program -> finding ---
  {
    const seed = await requestJson('POST', '/api/audits/packs/seed-demo', { token: write.token, body: {} });
    const packId = seed.body?.data?.id;
    let approve: Json = {};
    let publish: Json = {};
    let program: Json = {};
    let finding: Json = {};
    let read: Json = { status: -1, body: {} };
    if (packId) {
      approve = await requestJson('POST', `/api/audits/packs/${packId}/approve-expert`, {
        token: write.token,
        body: {},
      });
      publish = await requestJson('POST', `/api/audits/packs/${packId}/publish`, {
        token: write.token,
        body: {},
      });
      // A rerun against a pack already published by a prior invocation gets
      // a 409 "already published" — that is still a published pack, so
      // check the pack's actual state rather than trusting this call's
      // transitional status code.
      const packState = await requestJson('GET', `/api/audits/packs/${packId}`, { token: write.token });
      const isPublished =
        publish.status === 200 ||
        publish.status === 201 ||
        String(packState.body?.data?.publicationStatus || '').toLowerCase() === 'published';
      if (isPublished) {
        const progName = `G05 Audit Program ${Date.now()}`;
        program = await requestJson('POST', '/api/audits/programs', {
          token: write.token,
          body: { packId, name: progName },
        });
        const programId = program.body?.data?.program?.id || program.body?.data?.id;
        if (programId) {
          // The program creator is auto-assigned 'program_owner', which does
          // NOT carry 'finding.draft' (server/src/services/audits/
          // permissions.ts ROLE_CAPABILITIES) — only lead_auditor/auditor/
          // technical_expert do. Add self as lead_auditor to be able to
          // draft a finding.
          await requestJson('POST', `/api/audits/programs/${programId}/members`, {
            token: write.token,
            body: { userId: userIdA, memberRole: 'lead_auditor' },
          });
          const statement = `G05 probe finding ${Date.now()}`;
          finding = await requestJson('POST', '/api/audits/findings', {
            token: write.token,
            body: { programId, statement, classification: 'observation' },
          });
          const findingId = finding.body?.data?.id;
          if (findingId) {
            read = await coldRead(emailA, `/api/audits/findings/${findingId}`);
          }
          results.audits = {
            packStatus: seed.status,
            approveStatus: approve.status,
            publishStatus: publish.status,
            programStatus: program.status,
            programId,
            findingWrite: { status: finding.status, findingId, sentStatement: statement },
            coldRead: { status: read.status, statement: read.body?.data?.statement },
            match: read.body?.data?.statement === statement,
          };
        } else {
          results.audits = {
            packStatus: seed.status,
            approveStatus: approve.status,
            publishStatus: publish.status,
            programStatus: program.status,
            programBody: program.body,
            blocked: 'program creation failed',
          };
        }
      } else {
        results.audits = {
          packStatus: seed.status,
          approveStatus: approve.status,
          publishStatus: publish.status,
          publishBody: publish.body,
          blocked: 'pack publish failed (requires platform-admin role)',
        };
      }
    } else {
      results.audits = { packStatus: seed.status, packBody: seed.body, blocked: 'pack seed failed' };
    }
  }

  // --- Czat (Chat Projects) ---
  {
    const name = `G05 Chat Project ${Date.now()}`;
    const created = await requestJson('POST', '/api/chat-projects', {
      token: write.token,
      body: { name },
    });
    assert.equal(created.status, 201, `chat project create failed: ${JSON.stringify(created.body)}`);
    const projectId = created.body.id;
    assert.ok(projectId, `no chat project id: ${JSON.stringify(created.body)}`);
    const read = await coldRead(emailA, `/api/chat-projects/${projectId}`);
    results.chat = {
      write: { status: created.status, projectId, sentName: name },
      coldRead: { status: read.status, name: read.body.name },
      match: read.body.name === name,
    };
  }

  console.log(JSON.stringify({ phase: 'R5', results }, null, 2));
}

async function runR6(): Promise<void> {
  const { emailA } = loadCreds();
  const write = await login(emailA);
  const results: Json = {};

  // --- Administracja (Admin org profile) ---
  {
    const defaultTimezone = 'Europe/Warsaw';
    const dateFormat = `DD.MM.YYYY-g05-${Date.now()}`;
    const updated = await requestJson('PUT', '/api/admin/organization-profile', {
      token: write.token,
      body: { defaultTimezone, defaultLanguage: 'pl', dateFormat },
    });
    const read = await coldRead(emailA, '/api/admin/organization-profile');
    results.admin = {
      write: { status: updated.status, body: updated.body, sentTimezone: defaultTimezone, sentDateFormat: dateFormat },
      coldRead: { status: read.status, profile: read.body.profile },
      match: read.body.profile?.dateFormat === dateFormat && read.body.profile?.defaultTimezone === defaultTimezone,
    };
  }

  // --- Ustawienia (Settings / Notifications) ---
  // (A) real backend-supported route (reversed path segments vs the hook)
  {
    const quietHoursStart = `07:${(Date.now() % 60).toString().padStart(2, '0')}`;
    const updated = await requestJson('PUT', '/api/settings/preferences/notifications', {
      token: write.token,
      body: { preferences: { quietHoursStart } },
    });
    const read = await coldRead(emailA, '/api/settings/preferences/notifications');
    results.settingsBackendRoute = {
      write: { status: updated.status, body: updated.body, sent: quietHoursStart },
      coldRead: { status: read.status, body: read.body },
    };
  }
  // (B) the exact URL the live frontend caller uses
  // (src/hooks/useUserNotificationPreferences.tsx:211) — checking whether
  // the real user-facing save path actually reaches a route at all.
  {
    const liveCallerAttempt = await requestJson('PUT', '/api/settings/notifications/preferences', {
      token: write.token,
      body: { quietHoursStart: '08:00' },
    });
    results.settingsLiveCallerUrl = {
      url: 'PUT /api/settings/notifications/preferences',
      caller: 'src/hooks/useUserNotificationPreferences.tsx:211',
      status: liveCallerAttempt.status,
      body: liveCallerAttempt.body,
    };
  }

  // --- Partner ---
  {
    const legacyAttempt = await requestJson('PUT', '/api/partners/organization', {
      token: write.token,
      body: { name: 'G05 Partner Org', contactEmail: 'g05-partner@local.test' },
    });
    // Canonical successor per the 410's own `successor` field — still
    // expected to refuse, but for a different reason: this org has never
    // been onboarded as a Partner (no partner_organizations/partner_users
    // binding), which is a separate application/approval flow.
    const v8Attempt = await requestJson('PUT', '/api/v8/partner/organization', {
      token: write.token,
      body: { contactPhone: '+48 000 000 000', website: 'https://g05.local.test' },
    });
    results.partner = {
      legacyWriteAttempt: { status: legacyAttempt.status, body: legacyAttempt.body },
      v8SuccessorAttempt: { status: v8Attempt.status, body: v8Attempt.body },
      note: 'legacy /api/partners/* wrapped in createLegacyCutoverGuard(PARTNERS_CUTOVER), server/src/routes/partners.routes.ts:278, writer PRT-W04 state:disabled -> 410. Canonical /api/v8/partner/organization (server/src/routes/v8/partner.routes.ts:1368) requires a pre-existing partner_organizations binding (getBoundPartnerOrgId) that a freshly self-registered org does not have -> expected 403 PARTNER_ORG_REQUIRED, a separate application/approval flow outside this pass.',
    };
  }

  console.log(JSON.stringify({ phase: 'R6', results }, null, 2));
}

async function main(): Promise<void> {
  const app: Express = express();
  app.use(express.json({ limit: '2mb' }));

  const { ApiGateway } = await import('../Gateway.js');
  ApiGateway.getInstance().initializeRoutes(app);
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[g05] unhandled route error', error);
    res.status(500).json({ error: 'g05_harness_error', detail: String(error) });
  });

  const server = app.listen(port, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  const phase = process.env.G05_PHASE || 'R1R2';

  try {
    if (phase === 'R1R2') await runR1R2();
    else if (phase === 'R3') await runR3();
    else if (phase === 'R4') await runR4();
    else if (phase === 'R5') await runR5();
    else if (phase === 'R6') await runR6();
    else throw new Error(`unknown phase ${phase}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error('[g05] FAILED', error);
    process.exit(1);
  }
);
