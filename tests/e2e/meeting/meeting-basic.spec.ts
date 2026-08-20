/**
 * M21 Meeting — governed UI journey: create a meeting, manually supply source
 * text, create a durable proposal, explicitly approve/materialize it and prove
 * the approved note survives a hard reload. Recording/transcription stay OFF.
 *
 * This module had ZERO e2e coverage before this file even though the backend
 * (meeting.routes.ts: CRUD + decisions + follow-ups + generate-notes) and the
 * frontend (src/components/Meeting/MeetingHub.tsx, wired to real
 * `Api.getMeetings/createMeeting/addMeetingDecision/addMeetingFollowUp/
 * generateMeetingNotes` calls — grep-verified against src/services/api.ts,
 * not stubs) are both fully built. MODULE_MEETING is a closed beta
 * (src/utils/betaAccess.ts) but ADMIN/OWNER/SUPERADMIN are exempt
 * (BETA_ADMINS_EXEMPT), and the harness session is a real ADMIN minted by
 * test-support bootstrap, so the module is reachable with no special flag.
 * NOTE: `register-demo` does NOT mint an ADMIN — it is the public demo signup
 * and creates a CONSULTANT in the read-only demo org
 * (server/src/services/demo/demoSignupProvisioning.ts `DEMO_SIGNUP_ROLE`), which is exactly why
 * it is not used here. The server-side `betaGate` middleware is currently a
 * pure pass-through no-op (server/src/middleware/betaGate.middleware.ts) —
 * gating is client-only today.
 *
 * "Notes" here means the AI Notes feature (`meeting.aiNotes` button →
 * POST /:id/generate-notes), which falls back to a DETERMINISTIC regex
 * heuristic (server/src/services/ai/meetingIntelligenceService.ts
 * `generateHeuristic`) whenever no OPENAI_API_KEY is configured — so this
 * spec works with or without a real LLM configured in the harness. The
 * transcript below is deliberately written with both a decision-keyword
 * sentence ("decided") and an action-keyword sentence ("action") so the
 * heuristic path reliably extracts ≥1 decision AND ≥1 follow-up regardless.
 * A real LLM given the same explicit transcript should extract at least as
 * much, so the persistence assertions are written against "count increased
 * to ≥1", not exact wording — robust to either source.
 *
 * Uses the m06 harness's `authenticate()` (tests/e2e/m06/_m06.ts), which mints
 * a WRITE-access session via `/api/test-support/bootstrap` and has NO
 * register-demo fallback (see that file's header) — meeting create/update are
 * real writes, so a demo read-only session would 403. This spec therefore
 * REQUIRES ENABLE_TEST_SUPPORT=true + a matching TEST_SUPPORT_KEY on the
 * target backend.
 */
import { expect, test, type APIRequestContext } from '@playwright/test';
import { Pool } from 'pg';

import {
  getPrivilegedSession,
  makeRunId,
  type PrivilegedSession,
} from '../_helpers/privilegedSession';
import { injectSession } from '../m06/_m06';
import { dismissOverlayIfPresent, suppressOnboarding } from '../smoke/work-canvas-helpers';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Local-time `datetime-local` input value, `daysFromNow` days out at 10:00. */
function futureDateTimeLocal(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(10, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const TRANSCRIPT =
  'We decided to launch the new pricing page next week. ' +
  'John will action the deployment checklist before Friday. ' +
  'The team agreed the rollout communication plan is ready.';

const API = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const SUPPORT_KEY = process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me';
const CLEANUP_OPT_IN = 'MTG_UI_ALLOW_IMMUTABLE_FIXTURE_CLEANUP';
const DB_PREFIX_ENV = 'MTG_UI_TEST_DB_PREFIX';

type MeetingFixture = {
  runId: string;
  title: string;
  organizationId: string;
  userId: string;
  meetingId?: string;
  noteId?: string;
  noteSummary?: string;
  proposalId?: string;
  receiptId?: string;
  staleNoteId?: string;
  staleProposalId?: string;
  foreignRunId?: string;
};

let fixture: MeetingFixture | null = null;

const authHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'content-type': 'application/json',
});

async function addMember(
  request: APIRequestContext,
  runId: string,
  role: 'USER' | 'ADMIN' = 'USER'
): Promise<PrivilegedSession> {
  const response = await request.post(`${API}/api/test-support/member`, {
    headers: { 'x-test-support-key': SUPPORT_KEY, 'content-type': 'application/json' },
    data: { runId, role },
  });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()) as PrivilegedSession;
}

async function cleanupRun(request: APIRequestContext, runId: string): Promise<void> {
  const response = await request.post(`${API}/api/test-support/cleanup`, {
    headers: { 'x-test-support-key': SUPPORT_KEY, 'content-type': 'application/json' },
    data: { runId },
  });
  expect(response.ok(), await response.text()).toBe(true);
}

test.afterEach(async ({ request }) => {
  if (!fixture) return;
  if (process.env[CLEANUP_OPT_IN] !== '1') {
    throw new Error(`${CLEANUP_OPT_IN}=1 is required for MTG UI fixture cleanup`);
  }
  const databasePrefix = process.env[DB_PREFIX_ENV]?.trim();
  if (!databasePrefix) throw new Error(`${DB_PREFIX_ENV} is required for MTG UI fixture cleanup`);
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for MTG UI cleanup');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const database = await client.query<{ current_database: string }>('SELECT current_database()');
    if (!database.rows[0]?.current_database.startsWith(databasePrefix)) {
      throw new Error(
        `refusing MTG UI cleanup on database ${database.rows[0]?.current_database ?? '<unknown>'}`
      );
    }
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      'mtg-ui-governed-note-fixture-cleanup',
    ]);
    const meetings = await client.query<{
      id: string;
      organization_id: string;
      created_by: string;
    }>(
      `SELECT id, organization_id, created_by
         FROM meetings
        WHERE id = $1 AND title = $2 AND organization_id = $3 AND created_by = $4
        FOR UPDATE`,
      [fixture.meetingId, fixture.title, fixture.organizationId, fixture.userId]
    );
    if (fixture.meetingId && meetings.rowCount !== 1) {
      throw new Error('refusing MTG UI cleanup: exact owned meeting identity was not found');
    }
    // These tables currently have no DB immutability trigger. Never use
    // DISABLE TRIGGER USER; if a named guard is added, this test must stop and
    // explicitly allow that exact trigger before fixture deletion is changed.
    const immutableGuards = await client.query<{ tgname: string }>(
      `SELECT t.tgname
         FROM pg_trigger t
        WHERE t.tgrelid IN ('artifact_handoff_receipts'::regclass, 'artifact_handoff_proposals'::regclass)
          AND NOT t.tgisinternal AND t.tgenabled <> 'D'`
    );
    if (immutableGuards.rowCount) {
      throw new Error(
        `unexpected immutable handoff trigger(s): ${immutableGuards.rows.map((r) => r.tgname).join(', ')}`
      );
    }
    if (fixture.receiptId) {
      await client.query(
        `DELETE FROM artifact_handoff_receipts WHERE receipt_id=$1 AND proposal_id=$2 AND organization_id=$3`,
        [fixture.receiptId, fixture.proposalId, fixture.organizationId]
      );
    }
    if (fixture.proposalId) {
      await client.query(
        `DELETE FROM artifact_handoff_proposals WHERE proposal_id=$1 AND producer_record_id=$2 AND organization_id=$3`,
        [fixture.proposalId, fixture.meetingId, fixture.organizationId]
      );
    }
    if (fixture.noteId) {
      await client.query(
        `DELETE FROM meeting_notes WHERE id=$1 AND meeting_id=$2 AND organization_id=$3 AND created_by=$4`,
        [fixture.noteId, fixture.meetingId, fixture.organizationId, fixture.userId]
      );
    }
    if (fixture.staleNoteId) {
      await client.query(
        `DELETE FROM meeting_notes WHERE id=$1 AND meeting_id=$2 AND organization_id=$3 AND created_by=$4`,
        [fixture.staleNoteId, fixture.meetingId, fixture.organizationId, fixture.userId]
      );
    }
    if (fixture.staleProposalId) {
      await client.query(
        `DELETE FROM artifact_handoff_proposals WHERE proposal_id=$1 AND producer_record_id=$2 AND organization_id=$3`,
        [fixture.staleProposalId, fixture.meetingId, fixture.organizationId]
      );
    }
    // Ownership was locked above through the parent meeting. The follow-up
    // table is scoped by that FK and does not duplicate organization_id.
    await client.query(`DELETE FROM meeting_follow_ups WHERE meeting_id=$1`, [fixture.meetingId]);
    if (fixture.meetingId) {
      await client.query(
        `DELETE FROM meetings WHERE id=$1 AND title=$2 AND organization_id=$3 AND created_by=$4`,
        [fixture.meetingId, fixture.title, fixture.organizationId, fixture.userId]
      );
    }
    const residue = await client.query<{ count: string }>(
      `SELECT (
          (SELECT count(*) FROM meetings WHERE id=$1 OR (title=$2 AND organization_id=$3)) +
          (SELECT count(*) FROM meeting_notes WHERE id=$4 OR meeting_id=$1) +
          (SELECT count(*) FROM meeting_follow_ups WHERE meeting_id=$1) +
          (SELECT count(*) FROM artifact_handoff_proposals WHERE proposal_id=$5) +
          (SELECT count(*) FROM artifact_handoff_receipts WHERE receipt_id=$6)
        )::text AS count`,
      [
        fixture.meetingId,
        fixture.title,
        fixture.organizationId,
        fixture.noteId,
        fixture.proposalId,
        fixture.receiptId,
      ]
    );
    expect(Number(residue.rows[0]?.count || -1)).toBe(0);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
  await cleanupRun(request, fixture.runId);
  if (fixture.foreignRunId) await cleanupRun(request, fixture.foreignRunId);
  fixture = null;
});

test.describe('M21 Meeting — governed note approval + cold readback [@module:meeting]', () => {
  test.setTimeout(120000);

  test('create, propose, enforce roles and approve/materialize with cold readback', async ({
    page,
    request,
  }) => {
    const runId = makeRunId('mtg-ui');
    const session = await getPrivilegedSession(request, { runId, role: 'OWNER' });
    expect(session.role).toBe('OWNER');
    await injectSession(page, {
      token: session.token,
      user: {
        id: session.userId,
        email: session.email,
        role: session.role,
        organizationId: session.organizationId,
      },
    });
    await suppressOnboarding(page);

    const title = `E2E Meeting ${runId}`;
    fixture = { runId, title, organizationId: session.organizationId, userId: session.userId };

    await page.goto('/meeting', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await dismissOverlayIfPresent(page);

    // --- Create ---------------------------------------------------------
    const newMeetingBtn = page.getByRole('button', { name: /New meeting|Nowe spotkanie/i }).first();
    await expect(newMeetingBtn).toBeVisible({ timeout: 30000 });
    await newMeetingBtn.click();

    const modalTitleHeading = page.getByText(/^Create meeting$|^Utwórz spotkanie$/i).first();
    await expect(modalTitleHeading).toBeVisible({ timeout: 10000 });

    await page.getByLabel(/^Title$|^Tytuł$/i).fill(title);
    await page.getByLabel(/^Start$/i).fill(futureDateTimeLocal(3));

    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/meeting') && response.request().method() === 'POST'
    );
    await page
      .getByRole('button', { name: /^Create meeting$|^Utwórz spotkanie$/i })
      .first()
      .click();
    const createResponse = await createResponsePromise;
    expect(createResponse.status()).toBe(201);
    fixture.meetingId = String(((await createResponse.json()) as any)?.meeting?.id || '');
    expect(fixture.meetingId).not.toBe('');

    // Modal closes on success (handleSaveMeeting → closeMeetingModal()).
    await expect(modalTitleHeading).toBeHidden({ timeout: 15000 });

    // Row appears in the list (StandardTable), proving the POST round-tripped
    // through the server and the client refetched/merged the created row.
    const titleRe = new RegExp(escapeRegExp(title));
    await expect(page.getByText(titleRe).first()).toBeVisible({ timeout: 15000 });

    // --- Open the meeting -------------------------------------------------
    const row = page.getByRole('row', { name: titleRe }).first();
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.dblclick();

    // Detail view: heading shows the meeting title + AI Notes action.
    await expect(page.getByText(titleRe).first()).toBeVisible({ timeout: 15000 });
    const aiNotesBtn = page.getByRole('button', { name: /AI Notes|Notatki AI/i }).first();
    await expect(aiNotesBtn).toBeVisible({ timeout: 15000 });
    await aiNotesBtn.click();

    // --- Generate notes from a transcript ---------------------------------
    await expect(page.getByText(/Recording and automatic transcription are OFF/i)).toBeVisible();
    const transcriptField = page.getByLabel(/Meeting source text/i);
    await expect(transcriptField).toBeVisible({ timeout: 10000 });
    await transcriptField.fill(TRANSCRIPT);

    const generateBtn = page
      .getByRole('button', { name: /Generate notes|Generuj notatki/i })
      .first();
    await expect(generateBtn).toBeEnabled();
    const generateResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/generate-notes') && response.request().method() === 'POST'
    );
    await generateBtn.click();
    const generateResponse = await generateResponsePromise;
    expect(generateResponse.status()).toBe(201);
    const generated = (await generateResponse.json()) as any;
    fixture.noteId = String(generated.meetingNoteId || '');
    fixture.noteSummary = String(generated.meetingNote?.summary || generated.note?.summary || '');
    fixture.proposalId = String(generated.proposal?.proposalId || '');
    expect(fixture.noteId).not.toBe('');
    expect(fixture.noteSummary).not.toBe('');
    expect(fixture.proposalId).not.toBe('');

    // Result view is explicitly a proposal; nothing is presented as a saved
    // decision/follow-up before the separate human action.
    await expect(page.getByText(/^Summary$|^Podsumowanie$/i).first()).toBeVisible({
      timeout: 30000,
    });

    await expect(page.getByText(/not saved as decisions/i)).toBeVisible();
    await page.getByRole('button', { name: /Back to proposals/i }).click();

    const member = await addMember(request, runId, 'USER');
    const memberDecision = await request.post(
      `${API}/api/meeting/${fixture.meetingId}/notes/${fixture.noteId}/decision`,
      { headers: authHeaders(member.token), data: { action: 'approve' } }
    );
    expect(memberDecision.status()).toBe(403);

    const foreignRunId = makeRunId('mtg-ui-foreign');
    fixture.foreignRunId = foreignRunId;
    const foreign = await getPrivilegedSession(request, { runId: foreignRunId, role: 'ADMIN' });
    const foreignDecision = await request.post(
      `${API}/api/meeting/${fixture.meetingId}/notes/${fixture.noteId}/decision`,
      { headers: authHeaders(foreign.token), data: { action: 'approve' } }
    );
    expect(foreignDecision.status()).toBe(404);

    const revoked = await addMember(request, runId, 'USER');
    const revokeDb = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    await revokeDb.query(
      `UPDATE organization_members SET status='REVOKED' WHERE organization_id=$1 AND user_id=$2`,
      [session.organizationId, revoked.userId]
    );
    await revokeDb.end();
    const revokedDecision = await request.post(
      `${API}/api/meeting/${fixture.meetingId}/notes/${fixture.noteId}/decision`,
      { headers: authHeaders(revoked.token), data: { action: 'approve' } }
    );
    expect(revokedDecision.status()).toBe(403);

    // A second active administrator decides the proposal after this OWNER's
    // page loaded it. The OWNER's now-stale action must fail closed, reload the
    // authoritative state and expose no false materialization receipt.
    const concurrentAdmin = await addMember(request, runId, 'ADMIN');
    const concurrentReject = await request.post(
      `${API}/api/meeting/${fixture.meetingId}/notes/${fixture.noteId}/decision`,
      { headers: authHeaders(concurrentAdmin.token), data: { action: 'reject' } }
    );
    expect(concurrentReject.status(), await concurrentReject.text()).toBe(200);

    fixture.staleNoteId = fixture.noteId;
    fixture.staleProposalId = fixture.proposalId;
    const staleApprove = page.getByRole('button', { name: /Approve and materialize/i });
    const staleResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/notes/${fixture!.staleNoteId}/decision`) &&
        response.request().method() === 'POST'
    );
    await staleApprove.click();
    const staleResponse = await staleResponsePromise;
    expect(staleResponse.status()).toBe(409);
    await expect(page.getByText(/proposal changed.*Reloading/i)).toBeVisible();
    await expect(page.getByText(/Rejected/i).first()).toBeVisible();
    expect(await page.getByText(/Materialization receipt/i).count()).toBe(0);

    // Generate a fresh proposal after authoritative reconciliation. This
    // proves the stale command did not poison the OWNER's next explicit intent.
    await transcriptField.fill(`${TRANSCRIPT} Fresh owner-reviewed version.`);
    const freshGenerateResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/generate-notes') && response.request().method() === 'POST'
    );
    await generateBtn.click();
    const freshGenerateResponse = await freshGenerateResponsePromise;
    expect(freshGenerateResponse.status()).toBe(201);
    const freshGenerated = (await freshGenerateResponse.json()) as any;
    fixture.noteId = String(freshGenerated.meetingNoteId || '');
    fixture.noteSummary = String(
      freshGenerated.meetingNote?.summary || freshGenerated.note?.summary || ''
    );
    fixture.proposalId = String(freshGenerated.proposal?.proposalId || '');
    expect(fixture.noteId).not.toBe(fixture.staleNoteId);
    expect(fixture.proposalId).not.toBe(fixture.staleProposalId);
    await page.getByRole('button', { name: /Back to proposals/i }).click();

    const approve = page.getByRole('button', { name: /Approve and materialize/i });
    await expect(approve).toBeVisible();
    const approvalResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/notes/${fixture!.noteId}/decision`) &&
        response.request().method() === 'POST'
    );
    await approve.click();
    const approvalResponse = await approvalResponsePromise;
    expect(approvalResponse.status()).toBe(200);
    const approval = (await approvalResponse.json()) as any;
    fixture.receiptId = String(approval.receipt?.receiptId || '');
    expect(fixture.receiptId).not.toBe('');
    await expect(page.getByText(/Materialization receipt/i)).toBeVisible({ timeout: 15000 });

    // Close after the authoritative approval/materialization receipt.
    await page.getByRole('button', { name: /Back to proposals/i }).click();
    await page
      .getByRole('button', { name: /^Close$|^Zamknij$/i })
      .first()
      .click();

    // --- Persistence proof: hard reload (F5) -------------------------------
    // useModuleOpenDocuments('meeting') persists the open/active document id in
    // sessionStorage, so the reload reopens the SAME meeting detail view
    // automatically — and MeetingHub's loadMeetings() refetches from the
    // server on mount, so any data shown post-reload came from the DB, not a
    // client cache.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await dismissOverlayIfPresent(page);

    await expect(page.getByText(titleRe).first()).toBeVisible({ timeout: 20000 });

    await page.getByRole('button', { name: /AI Notes|Notatki AI/i }).click();
    await expect(page.getByText(/Materialized/i)).toBeVisible({ timeout: 15000 });
    const coldSummary = page.getByText(fixture.noteSummary!, { exact: true }).first();
    await expect(coldSummary).toBeVisible();
    await coldSummary.click();
    await expect(page.getByText(fixture.noteSummary!, { exact: true }).first()).toBeVisible();

    const coldDb = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    const receipt = await coldDb.query<{ target_record_id: string; output_content_hash: string }>(
      `SELECT target_record_id, output_content_hash
         FROM artifact_handoff_receipts
        WHERE receipt_id=$1 AND proposal_id=$2 AND organization_id=$3`,
      [fixture.receiptId, fixture.proposalId, fixture.organizationId]
    );
    await coldDb.end();
    expect(receipt.rowCount).toBe(1);
    expect(receipt.rows[0]?.target_record_id).toBe(fixture.noteId);
    expect(receipt.rows[0]?.output_content_hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
