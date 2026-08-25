/**
 * CLAUDE-NEXT-LEGACY-CUTOVER — MEETINGS domain (`/api/meeting`, router
 * `server/src/routes/meeting.routes.ts`).
 *
 * WHY THIS EXISTS: `meeting.routes.ts` documents the L-05/MTG-BVP-001 fix —
 * `generate-notes` no longer auto-persists AI-extracted decisions/action
 * items into `meetings.decisions_json` / `meeting_follow_ups`, and an explicit
 * `persist:true` is rejected with 409. That claim holds for those two tables.
 *
 * ★ CORRECTED 2026-08-25 (DEC-58 sceptyk, FIX-M-5c): this file used to claim a
 * THIRD, ungoverned writer here — `meetingIntelligenceService.persistNote`
 * allegedly writing straight into `notebook_pages`, unconditionally, ahead of
 * the governed `proposeMeetingNote` call. That code does not exist in this
 * baseline: `server/src/services/ai/meetingIntelligenceService.ts` is 226
 * lines total (no line 239-262, no `persistNote` export — `grep -rn
 * persistNote server/src/services/ai/meetingIntelligenceService.ts` is 0
 * hits), and `notebook_pages` has zero references anywhere under
 * `server/src/services/ai/` or `server/src/routes/meeting.routes.ts`. The
 * ACTUAL `POST /:id/generate-notes` handler (`meeting.routes.ts`, see its own
 * header comment above that route) calls
 * `meetingIntelligenceService.generateMeetingNotes` for pure text extraction
 * (no persistence side effect in that call) and then durably stores the
 * result via `proposeMeetingNote` (`meetingBoundaryService.ts`) straight into
 * the governed `meeting_notes` table + an `artifact_handoff_proposals` row —
 * the SAME governed path `MEETINGS-W09-CANONICAL` below approves/rejects.
 * There is no separate ungoverned copy. MEETINGS-W08 is corrected below to
 * describe this actual `meeting_notes` write instead of the fabricated
 * `notebook_pages` one; kept `observed` (not `disabled`/removed) because the
 * route still exists and still writes a table outside `meetings`/
 * `meeting_follow_ups`, so it stays in scope for this domain's telemetry.
 *
 * Also registered: the two manual outcome writers (`POST /:id/decisions`,
 * `POST /:id/follow-ups` + `PATCH .../follow-ups/:id`) that
 * `meetingBoundaryService.ts:25-28` documents as a DELIBERATE, permanent
 * exception to the governed AI-notes path — they write the same class of fact
 * (a meeting decision / action item) with only base auth, no role gate, no
 * approval, no idempotency. Intentional per that comment, but still a real
 * split-brain against `meeting_notes.decisions_json` / `.action_items_json`,
 * so it is observed here rather than silently excluded.
 *
 * Every id, path and line below was re-verified against this baseline's
 * `meeting.routes.ts`, `meetingService.ts`, `meetingIntelligenceService.ts`
 * and `meetingBoundaryService.ts` directly — the inventory JSON
 * (`docs/program/evidence/closure/codex/CLAUDE-NEXT-LEGACY-CUTOVER/inventory/
 * MEETINGS.json`) is a lead, not proof. No writer here is `disabled`: none of
 * the nine have a proven canonical successor route (MEETINGS-W09-CANONICAL
 * *is* the canonical/governed approval path itself, not a successor to
 * redirect callers to), so all nine register `successor: null`. The
 * inventory's own classification summary independently confirms this: "0
 * writers classify disabled or owner-blocked" for this domain.
 */

import type { LegacyCutoverDomainConfig } from '../legacyCutoverKernel.js';

export const MEETINGS_CUTOVER: LegacyCutoverDomainConfig = {
  domain: 'meetings',
  rollbackEnv: 'MEETINGS_LEGACY_WRITER_ROLLBACK_ENABLED',
  rollbackWritersEnv: 'MEETINGS_LEGACY_ROLLBACK_WRITERS',
  disabledCode: 'MEETINGS_LEGACY_WRITER_DISABLED',
  unmappedCode: 'MEETINGS_LEGACY_IDENTITY_UNMAPPED',
  // No idBridge: `meetings` has no entry in canonicalIdentityBridge.ts's
  // DOMAIN_IDENTITY_REGISTRIES, so every legacyTable/legacyId pair below
  // resolves `not_applicable`, never a fabricated `resolved`.
  writers: [
    {
      writerId: 'MEETINGS-W01',
      method: 'POST',
      path: /^\/$/,
      state: 'observed',
      successor: null,
      legacyTable: 'meetings',
      reason:
        'INSERT INTO meetings (server/src/services/meetingService.ts:206), from meeting.routes.ts:97-131. req.body.decisions is passed through with zero validation (meeting.routes.ts:126) into meetings.decisions_json (meetingService.ts:221) — the live UI always sends decisions:[] (src/components/Meeting/MeetingHub.tsx:556) but the endpoint imposes no such restriction on any other caller. No canonical meeting-creation route exists.',
    },
    {
      writerId: 'MEETINGS-W02',
      method: 'PUT',
      path: /^\/[^/]+\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'meetings',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[1] || ''),
      reason:
        'UPDATE meetings (title/start_at/end_at/location/attendees_json/pre_read_json/agenda_json only; does not touch decisions_json), meetingService.ts:232-293 via meeting.routes.ts:133-160. Scheduling-metadata CRUD, not an outcome writer; no canonical successor exists.',
    },
    {
      writerId: 'MEETINGS-W03',
      method: 'DELETE',
      path: /^\/[^/]+\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'meetings',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[1] || ''),
      reason:
        'DELETE FROM meeting_follow_ups then DELETE FROM meetings (meetingService.ts:305-306), from meeting.routes.ts:162-175. Role-gated via requireMeetingAdmin (meeting.routes.ts:167, confirmed) but destructive, not an outcome persist — no approval workflow exists or is claimed for it, and no canonical successor exists.',
    },
    {
      writerId: 'MEETINGS-W04',
      method: 'PATCH',
      path: /^\/[^/]+\/status\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'meetings',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[1] || ''),
      reason:
        'UPDATE meetings SET status (meetingService.ts:320), from meeting.routes.ts:177-197. Role-gated via requireMeetingAdmin (meeting.routes.ts:182, confirmed) — the closest thing to a meeting-level sign-off — but no approval-service call exists anywhere in this handler or in updateMeetingStatus, so no canonical successor exists.',
    },
    {
      writerId: 'MEETINGS-W05',
      method: 'POST',
      path: /^\/[^/]+\/decisions\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'meetings',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[1] || ''),
      reason:
        'UPDATE meetings SET decisions_json (meetingService.ts:369, appends input.decision verbatim, no dedup, no idempotency key), from meeting.routes.ts:199-214 (confirmed: only verifyToken/isAuthenticated, NOT requireMeetingAdmin, unlike W03/W04). meetingBoundaryService.ts:25-28 documents this as a deliberate, permanent exception reserved for direct human-typed CRUD, coexisting by design with the governed meeting_notes.decisions_json path — but it still has no governed counterpart of its own, so it is observed, not exempted.',
    },
    {
      writerId: 'MEETINGS-W06',
      method: 'POST',
      path: /^\/[^/]+\/follow-ups\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'meeting_follow_ups',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[1] || ''),
      reason:
        'INSERT INTO meeting_follow_ups status=\'open\' (meetingService.ts:339) plus a meetings.updated_at touch (meetingService.ts:350), from meeting.routes.ts:216-232. Same base-auth-only, no-role-gate, no-approval, no-idempotency pattern as W05, and the same deliberate-coexistence exception per meetingBoundaryService.ts:25-28 (against meeting_notes.action_items_json). legacyIdFromPath resolves the parent meeting id, since this INSERTs a new follow-up row with no id of its own in the path.',
    },
    {
      writerId: 'MEETINGS-W07',
      method: 'PATCH',
      path: /^\/[^/]+\/follow-ups\/[^/]+\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'meeting_follow_ups',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[3] || ''),
      reason:
        'UPDATE meeting_follow_ups SET status (meetingService.ts:396), from meeting.routes.ts:234-254. Marks an action item done/open — an outcome sign-off — with only base auth, no admin gate, no approval. No canonical successor exists for action-item completion.',
    },
    {
      writerId: 'MEETINGS-W08',
      method: 'POST',
      path: /^\/[^/]+\/generate-notes\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'meeting_notes',
      reason:
        'CORRECTED 2026-08-25 (DEC-58 sceptyk, FIX-M-5c) — see the file header for the full re-verification. This writer previously claimed an unconditional, ungoverned INSERT INTO notebook_pages via a `meetingIntelligenceService.persistNote` that does not exist in this baseline (meetingIntelligenceService.ts is 226 lines, no persistNote export, zero notebook_pages references under server/src/services/ai/ or meeting.routes.ts). What the route actually does: meetingIntelligenceService.generateMeetingNotes extracts summary/decisions/action items with no persistence side effect, then proposeMeetingNote (meetingBoundaryService.ts) durably stores the result into meeting_notes plus an artifact_handoff_proposals row (targetKind material) — the SAME governed record MEETINGS-W09-CANONICAL below approves/rejects/materializes. Registered observed (not disabled): the route still writes meeting_notes directly with only base auth (verifyToken/isAuthenticated) and no admin/creator role gate, so it stays in scope for this domain\'s telemetry even though the earlier ungoverned-writer finding was false.',
    },
    {
      writerId: 'MEETINGS-W09-CANONICAL',
      method: 'POST',
      path: /^\/[^/]+\/notes\/[^/]+\/decision\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'This IS the canonical/governed approval path for meeting notes (role-gated via requireMeetingAdmin, meeting.routes.ts:402), delegating approve/reject/materialize to decideMeetingNote (server/src/services/meetingBoundary/meetingBoundaryService.ts:431-499) and handoffSpineService.ts (artifact_handoff_proposals/artifact_handoff_receipts). Writes no legacy table directly, so no legacyTable is set here. Registered as observed (not a successor-to-something-else) purely for telemetry: it is mounted and correctly gated, but has zero client references anywhere in src/ (verified: no match for "notes/.*decision|noteId" in src/services/api.ts or MeetingHub.tsx) — no human exercises it through the product UI today, which is the other half of the MEETINGS-W08 finding.',
    },
  ],
};
