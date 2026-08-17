/**
 * CLAUDE-NEXT-LEGACY-CUTOVER — MEETINGS domain (`/api/meeting`, router
 * `server/src/routes/meeting.routes.ts`).
 *
 * WHY THIS EXISTS: `meeting.routes.ts:262-280` documents the L-05/MTG-BVP-001
 * fix — `generate-notes` no longer auto-persists AI-extracted decisions/action
 * items into `meetings.decisions_json` / `meeting_follow_ups`, and an explicit
 * `persist:true` is rejected with 409 (`meeting.routes.ts:293-298`). That claim
 * is true for those two tables, but false for a THIRD one the same comment
 * never mentions: `meetingIntelligenceService.persistNote`
 * (`server/src/services/ai/meetingIntelligenceService.ts:239-262`, called
 * unconditionally at line 183, independent of `req.body.persist`) writes the
 * same AI-extracted content into `notebook_pages` immediately — no idempotency
 * key (`randomUUID()` per call, line 161/219), no approval gate, before the
 * route's own governed `proposeMeetingNote` call (line 333) ever runs. That is
 * MEETINGS-W08 below, registered as `observed` (not `disabled` — the lane rule
 * is no writer is retired without a telemetry window, and the governed
 * sibling flow has zero UI caller today, so disabling this would remove the
 * only durable copy of AI meeting notes without anywhere for a human to
 * approve the replacement).
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
      legacyTable: 'notebook_pages',
      reason:
        'THE PRIMARY FINDING. meeting.routes.ts:262-280 documents the L-05/MTG-BVP-001 fix (nothing written into meetings.decisions_json / meeting_follow_ups until human approval, persist:true rejected with 409 at meeting.routes.ts:293-298) — verified true for those two tables. But meetingIntelligenceService.persistNote (server/src/services/ai/meetingIntelligenceService.ts:239-262) is called unconditionally inside generateWithLLM (line 183, independent of req.body.persist), and its INSERT INTO notebook_pages (lines 245-249) lands the same AI-extracted decisions/action items into a readable page SYNCHRONOUSLY, with a fresh randomUUID() per call (line 161 — no idempotency, a retried request duplicates the page) and no human-approval gate, BEFORE the route own governed proposeMeetingNote call (meeting.routes.ts:333) even runs. The governed sibling (meeting_notes + artifact_handoff_proposals, targetKind material) has zero UI caller — MeetingHub.tsx:647-665 only displays response.note, never calls POST /:id/notes/:noteId/decision (MEETINGS-W09-CANONICAL below) — so in practice every real "Generate Notes" click persists ungoverned content while the governed proposal sits in "proposed" forever. Registered observed, not disabled: this is the only durable copy of AI meeting notes today, and the lane does not retire a writer without a telemetry window plus a working replacement UI path, neither of which exist yet — see INTEGRATOR_REQUEST in the report for what disabling this would actually require.',
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
