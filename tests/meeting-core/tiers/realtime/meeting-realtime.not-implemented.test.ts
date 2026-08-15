/**
 * meeting-realtime.not-implemented.test.ts — TIER 5 (realtime).
 *
 * ============================================================================
 * STATUS: NOT_IMPLEMENTED.
 * ============================================================================
 * There is no realtime channel for Meeting anywhere in this codebase — no
 * WebSocket, no Socket.IO, no live transcript sync, no presence. This is a
 * documented, deliberate scope boundary (docs/modules/13_meeting/README.md:
 * "Meeting jest poza MVP ... Nic w tym projekcie nie może wymagać zmian w
 * ... realtime, Socket.IO, WebSocket ..."), not an oversight.
 *
 * This file exists so that boundary is VISIBLE in test output instead of
 * silently absent. Two things happen here, deliberately NOT one:
 *
 *  1. `it.todo(...)` entries below name the real tests that will need to
 *     exist once realtime ships. Vitest reports these as "todo", never as
 *     "passed" — there is no way for a reader of a CI summary to mistake
 *     a todo count for a pass count.
 *  2. One real, passing `it(...)` asserts — by grepping actual source, not
 *     by trusting a comment — that no realtime transport is wired into the
 *     Meeting server code today. This is intentionally a TRIP-WIRE: if
 *     someone adds `socket.io`/`ws`/`WebSocket` to the Meeting routes or
 *     Meeting Core services without touching this file, this assertion
 *     starts failing. That failure is not a bug in this test — it is this
 *     tier correctly telling you "the NOT_IMPLEMENTED claim above is now
 *     stale, come update this file and write the real tests from the
 *     `it.todo` list instead of leaving them as placeholders forever."
 *
 * If this whole file is ever green with the todos still unimplemented,
 * that is CORRECT and EXPECTED — it is asserting an absence, not claiming
 * a capability. Do not read a green run here as "realtime works". Read the
 * printed STATUS line.
 * ============================================================================
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REALTIME_MARKERS = ['socket.io', "from 'ws'", 'from "ws"', 'WebSocket', 'io.on(', 'io.emit('];

const MEETING_SERVER_FILES = [
  'server/src/routes/meeting.routes.ts',
  'server/src/services/meetingService.ts',
  'server/src/services/meetingCore/index.ts',
  'server/src/services/meetingCore/meetingCoreService.ts',
  'server/src/services/meetingCore/lifecycle.ts',
  'server/src/services/meetingCore/outputs.ts',
  'server/src/services/meetingCore/outputsMaterializer.ts',
  'server/src/services/ai/meetingIntelligenceService.ts',
];

console.log(
  '\n[meeting:realtime] STATUS: NOT_IMPLEMENTED — no WebSocket/Socket.IO transport exists for Meeting.'
);
console.log(
  '[meeting:realtime] This is a scope boundary (Meeting is poza MVP), not a bug. See file header.'
);

describe('Meeting realtime — NOT_IMPLEMENTED (see header before trusting a green run)', () => {
  it('TRIP-WIRE: no realtime transport is wired into Meeting server code today', () => {
    const root = process.cwd();
    const offenders: string[] = [];
    for (const relPath of MEETING_SERVER_FILES) {
      const full = path.join(root, relPath);
      if (!fs.existsSync(full)) continue; // file moved/renamed — not this test's concern
      const content = fs.readFileSync(full, 'utf8');
      for (const marker of REALTIME_MARKERS) {
        if (content.includes(marker)) {
          offenders.push(`${relPath} contains "${marker}"`);
        }
      }
    }
    if (offenders.length > 0) {
      throw new Error(
        `Realtime code was found where none was expected — the NOT_IMPLEMENTED status in this file ` +
          `is now STALE. Update this test's assertions and replace the it.todo() list below with real ` +
          `tests instead of widening this check. Offenders:\n${offenders.join('\n')}`
      );
    }
    expect(offenders).toEqual([]);
  });

  // Real tests to write once realtime actually exists. `it.todo` — vitest
  // reports these distinctly from passed tests; they can never be mistaken
  // for coverage.
  it.todo('a client can open a realtime connection scoped to one meeting');
  it.todo('a note entry created by one participant is pushed to other connected participants');
  it.todo(
    'presence: joining/leaving a live meeting updates the participant list for other viewers'
  );
  it.todo('an unauthenticated or cross-org connection attempt is rejected, not silently dropped');
  it.todo('a dropped connection can reconnect and resume without duplicating already-seen events');
});
