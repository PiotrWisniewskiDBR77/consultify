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
import { expect, test } from '@playwright/test';
import { Pool } from 'pg';

import { authenticate, injectSession } from '../m06/_m06';
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

const createdTitles = new Set<string>();

test.afterEach(async () => {
  if (!process.env.DATABASE_URL || createdTitles.size === 0) return;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const meetings = await client.query<{ id: string }>(
      `SELECT id FROM meetings WHERE title = ANY($1::text[])`,
      [[...createdTitles]]
    );
    const meetingIds = meetings.rows.map((row) => row.id);
    if (meetingIds.length) {
      const notes = await client.query<{ id: string; proposal_id: string | null }>(
        `SELECT id, proposal_id FROM meeting_notes WHERE meeting_id = ANY($1::text[])`,
        [meetingIds]
      );
      const proposalIds = notes.rows
        .map((row) => row.proposal_id)
        .filter((id): id is string => Boolean(id));
      if (proposalIds.length) {
        await client.query(
          `DELETE FROM artifact_handoff_receipts WHERE proposal_id = ANY($1::text[])`,
          [proposalIds]
        );
        await client.query(
          `DELETE FROM artifact_handoff_proposals WHERE proposal_id = ANY($1::text[])`,
          [proposalIds]
        );
      }
      await client.query(`DELETE FROM meeting_notes WHERE meeting_id = ANY($1::text[])`, [
        meetingIds,
      ]);
      await client.query(`DELETE FROM meeting_follow_ups WHERE meeting_id = ANY($1::text[])`, [
        meetingIds,
      ]);
      await client.query(`DELETE FROM meetings WHERE id = ANY($1::text[])`, [meetingIds]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
    createdTitles.clear();
  }
});

test.describe('M21 Meeting — governed note approval + cold readback [@module:meeting]', () => {
  test.setTimeout(120000);

  test('create, propose, approve/materialize and cold-read the governed note', async ({ page }) => {
    const session = await authenticate(page);
    await injectSession(page, session);
    await suppressOnboarding(page);

    const title = `E2E Meeting ${Date.now()}`;
    createdTitles.add(title);

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

    await page
      .getByRole('button', { name: /^Create meeting$|^Utwórz spotkanie$/i })
      .first()
      .click();

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
    await generateBtn.click();

    // Result view is explicitly a proposal; nothing is presented as a saved
    // decision/follow-up before the separate human action.
    await expect(page.getByText(/^Summary$|^Podsumowanie$/i).first()).toBeVisible({
      timeout: 30000,
    });

    await expect(page.getByText(/not saved as decisions/i)).toBeVisible();
    await page.getByRole('button', { name: /Back to proposals/i }).click();
    const approve = page.getByRole('button', { name: /Approve and materialize/i });
    await expect(approve).toBeVisible();
    await approve.click();
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
  });
});
