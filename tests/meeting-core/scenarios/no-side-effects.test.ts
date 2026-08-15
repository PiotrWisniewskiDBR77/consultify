/**
 * no-side-effects.test.ts — Scenario 20 ("Nie jest wywoływane audio,
 * transkrypt, WebSocket ani zewnętrzny konektor").
 *
 * Two independent proofs, as specified:
 *  (a) DYNAMIC: monkey-patch globalThis.fetch and globalThis.WebSocket
 *      before exercising a full, representative slice of the Meeting Core
 *      surface (create → prep edit → participants → every lifecycle
 *      transition → close → notes incl. Teresa → propose/approve/reject →
 *      materialize, on real Postgres) and assert zero calls to either.
 *  (b) STATIC: grep server/src/services/meetingCore/ for realtime/audio/AI
 *      connector keywords and assert none are present — so this test fails
 *      loudly the day someone wires a websocket/whisper/gemini call into
 *      this module, even if that new code path is never exercised at
 *      runtime by (a).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  addNoteEntry,
  addParticipant,
  createMeetingCore,
  transitionMeeting,
  closeMeeting,
  updateMeetingPrep,
} from '../../../server/src/services/meetingCore/meetingCoreService.js';
import {
  approveOutput,
  materializeOutput,
  proposeOutput,
  rejectOutput,
} from '../../../server/src/services/meetingCore/outputs.js';
import { TERESA_ACTOR_ID } from '../../../server/src/services/meetingCore/types.js';
import { createFakeMaterializer } from '../domain/fakeMaterializer.js';
import { makeOrgId, makeUserId, setupDomainTestDb, type DomainTestDb } from '../domain/helpers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MEETING_CORE_DIR = resolve(__dirname, '../../../server/src/services/meetingCore');

describe('Meeting Core — Scenario 20: no audio/transcript/WebSocket/external connector calls', () => {
  let db: DomainTestDb;
  let fetchCalls: unknown[][] = [];
  let wsConstructions: unknown[][] = [];
  let originalFetch: typeof globalThis.fetch | undefined;
  let originalWebSocket: unknown;

  beforeAll(async () => {
    db = await setupDomainTestDb();
  }, 90_000);

  afterAll(async () => {
    if (db) await db.teardown();
  }, 30_000);

  beforeEach(() => {
    fetchCalls = [];
    wsConstructions = [];
    originalFetch = globalThis.fetch;
    originalWebSocket = (globalThis as Record<string, unknown>).WebSocket;

    globalThis.fetch = ((...args: unknown[]) => {
      fetchCalls.push(args);
      return Promise.reject(
        new Error('[no-side-effects probe] fetch should never be called from meetingCore')
      );
    }) as typeof globalThis.fetch;

    class ProbeWebSocket {
      constructor(...args: unknown[]) {
        wsConstructions.push(args);
        throw new Error(
          '[no-side-effects probe] WebSocket should never be constructed from meetingCore'
        );
      }
    }
    (globalThis as Record<string, unknown>).WebSocket = ProbeWebSocket;
  });

  afterEach(() => {
    if (originalFetch) globalThis.fetch = originalFetch;
    else delete (globalThis as Record<string, unknown>).fetch;
    if (originalWebSocket !== undefined)
      (globalThis as Record<string, unknown>).WebSocket = originalWebSocket;
    else delete (globalThis as Record<string, unknown>).WebSocket;
  });

  it('a full create -> prep -> participants -> full lifecycle -> notes (incl. Teresa) -> output saga -> materialize walk touches zero fetch/WebSocket calls', async () => {
    const organizationId = makeOrgId();
    const owner = makeUserId('owner');
    const participant = makeUserId('participant');

    const meeting = await createMeetingCore(
      {
        organizationId,
        createdBy: owner,
        title: 'No side effects walk',
        startAt: '2026-08-01T09:00:00.000Z',
        purpose: 'Prove the core is inert',
        expectedOutcomes: 'Zero network calls',
      },
      db.pool
    );

    await updateMeetingPrep(
      {
        organizationId,
        meetingId: meeting.id,
        actorUserId: owner,
        preparationNotes: 'Agenda drafted',
      },
      db.pool
    );
    await addParticipant(
      {
        organizationId,
        meetingId: meeting.id,
        actorUserId: owner,
        userId: participant,
        role: 'participant',
      },
      db.pool
    );

    await transitionMeeting(
      { organizationId, meetingId: meeting.id, actorUserId: owner, transition: 'START_PREPARING' },
      db.pool
    );
    await transitionMeeting(
      { organizationId, meetingId: meeting.id, actorUserId: owner, transition: 'MARK_READY' },
      db.pool
    );
    await transitionMeeting(
      { organizationId, meetingId: meeting.id, actorUserId: owner, transition: 'START_LIVE' },
      db.pool
    );

    await addNoteEntry(
      {
        organizationId,
        meetingId: meeting.id,
        actorUserId: participant,
        actorKind: 'human',
        entryType: 'discussion',
        content: 'Human note',
      },
      db.pool
    );
    await addNoteEntry(
      {
        organizationId,
        meetingId: meeting.id,
        actorUserId: TERESA_ACTOR_ID,
        actorKind: 'system',
        entryType: 'insight',
        content: 'Teresa note',
      },
      db.pool
    );

    const proposedTask = await proposeOutput(
      {
        organizationId,
        meetingId: meeting.id,
        actorUserId: TERESA_ACTOR_ID,
        actorKind: 'system',
        outputKind: 'task',
        payload: { title: 'Follow up' },
      },
      db.pool
    );
    await approveOutput(
      { organizationId, meetingId: meeting.id, outputId: proposedTask.id, actorUserId: owner },
      db.pool
    );
    await materializeOutput(
      { organizationId, meetingId: meeting.id, outputId: proposedTask.id, actorUserId: owner },
      createFakeMaterializer(db.pool),
      db.pool
    );

    const proposedDecision = await proposeOutput(
      {
        organizationId,
        meetingId: meeting.id,
        actorUserId: owner,
        actorKind: 'human',
        outputKind: 'decision',
        payload: { title: 'Skip it', decisionMakerId: owner },
      },
      db.pool
    );
    await rejectOutput(
      {
        organizationId,
        meetingId: meeting.id,
        outputId: proposedDecision.id,
        actorUserId: owner,
        reason: 'not needed',
      },
      db.pool
    );

    await transitionMeeting(
      { organizationId, meetingId: meeting.id, actorUserId: owner, transition: 'START_CLOSING' },
      db.pool
    );
    await closeMeeting({ organizationId, meetingId: meeting.id, actorUserId: owner }, db.pool);

    expect(fetchCalls).toEqual([]);
    expect(wsConstructions).toEqual([]);
  });

  it('STATIC: server/src/services/meetingCore/*.ts contains no realtime/audio/transcript/external-AI-connector keywords', () => {
    const forbidden =
      /websocket|socket\.io|whisper|gemini|getusermedia|mediarecorder|new\s+ws\(|require\(['"]ws['"]\)/i;
    const files = readdirSync(MEETING_CORE_DIR).filter((f) => f.endsWith('.ts'));
    expect(files.length).toBeGreaterThan(0); // sanity: the directory scan itself isn't silently empty

    const offenders: string[] = [];
    for (const file of files) {
      const contents = readFileSync(join(MEETING_CORE_DIR, file), 'utf8');
      if (forbidden.test(contents)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});
