import { pgClient } from './harness.js';
import { describe, expect, it } from 'vitest';

/**
 * M01-P05 — schema drift check for the voice runtime config table (packet
 * instruction: "Sprawdź, czy /api/voice ma analogiczny rozjazd schematu albo
 * brakującą tabelę... Ufaj wyłącznie information_schema.").
 *
 * `/api/voice/stt` and `/api/voice/tts` themselves are stateless (multer disk
 * upload + immediate delete, or a streamed response) — neither writes to a
 * DB table, so there is no citation-provenance-style drift risk there.
 * `/api/v10/teresa/voice-event` is logger.info-only (confirmed by reading
 * `teresa.routes.ts` — no DB write at all), so it cannot drift either.
 *
 * The one DB-backed voice surface is `/api/v10/teresa/voice-config`, which
 * resolves through `voiceRuntimeService.resolveVoiceRuntime` →
 * `virtualWorkerService.getWorkerWithProfile`, reading `virtual_workers`
 * (status/surface/voice_enabled/voice_name). This asserts those columns
 * exist on the real DB rather than assuming the code and the schema agree —
 * exactly the class of bug two other packets hit this same round (a TEXT vs
 * TIMESTAMPTZ mismatch, and a migration never applied to demo).
 */
describe('M01-P05 — voice runtime config table schema (asserted, not assumed)', () => {
  it('virtual_workers has the columns voiceRuntimeService reads', async () => {
    const client = pgClient();
    await client.connect();
    try {
      const cols = await client.query(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'virtual_workers'`
      );
      const byName = Object.fromEntries(cols.rows.map((r) => [r.column_name, r.data_type]));
      expect(Object.keys(byName)).toEqual(
        expect.arrayContaining(['status', 'surface', 'voice_enabled', 'voice_name'])
      );
      // Type-level check too — a text/integer mismatch here is exactly the
      // class of bug that gave a false 409 elsewhere in the module this round.
      expect(byName.status).toBe('text');
      expect(byName.surface).toBe('text');
      expect(byName.voice_enabled).toBe('integer');
      expect(byName.voice_name).toBe('text');
    } finally {
      await client.end();
    }
  });

  it('the STT upload directory table surface does NOT exist — confirms /api/voice/stt is genuinely stateless (no table to drift)', async () => {
    const client = pgClient();
    await client.connect();
    try {
      const tables = await client.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name ILIKE '%voice%'`
      );
      const names = tables.rows.map((r) => String(r.table_name));
      // No `voice_recordings`/`voice_uploads`/similar table anywhere —
      // corroborates the code-reading finding that STT audio is multer-disk
      // + immediate delete, never persisted to a row.
      expect(names.some((n) => /recording|upload/i.test(n))).toBe(false);
    } finally {
      await client.end();
    }
  });
});
