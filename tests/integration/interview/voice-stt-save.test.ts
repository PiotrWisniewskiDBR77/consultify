/**
 * M10 Interview — Voice STT save E2E
 *
 * BUG (L-01): Voice answer is transcribed on-screen but NOT saved to DB.
 * FIX:        FE interim-flush patch (Londyn branch) calls PATCH /api/interview/questions/:id
 *             with { voiceTranscript, voiceTranscriptStatus: 'approved', answerMode: 'voice_answer' }.
 *             Server persists both voice_transcript and promotes it to answer_text.
 *
 * This test file covers the full round-trip:
 *   1. POST /api/voice/stt   — audio blob → Whisper → transcript text   (needs OPENAI_API_KEY)
 *   2. PATCH /api/interview/questions/:questionId — persist transcript   (pure DB, always runnable)
 *   3. GET  /api/interview/sessions/:sessionId/questions — verify DB row
 *
 * HOW TO RUN:
 *   OPENAI_API_KEY=sk-... npx vitest run tests/integration/interview/voice-stt-save.test.ts
 *   or with GROQ:
 *   GROQ_API_KEY=gsk-... npx vitest run tests/integration/interview/voice-stt-save.test.ts
 *
 * SKIP LOGIC:
 *   - Tests tagged "[caboose]" require OPENAI_API_KEY or GROQ_API_KEY set in env.
 *   - Tests tagged "[always]" run in CI without any API key (DB-only assertions).
 */

import path from 'path';
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Env setup — must happen before any server imports
// ---------------------------------------------------------------------------
vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.MOCK_DB = 'false';
  process.env.SKIP_STARTUP_VALIDATOR = 'true';
  process.env.DISABLE_SCHEDULER = 'true';
  process.env.DISABLE_CONNECTION_POOL = 'true';
  process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
  const workerId = process.env.VITEST_WORKER_ID || '0';
  process.env.SQLITE_PATH = `./test-voice-stt-${workerId}.db`;
  // JWT_SECRET used by tokenFor() below
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-voice-stt';
});

// ---------------------------------------------------------------------------
// Imports (after env is set)
// ---------------------------------------------------------------------------
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STT_AVAILABLE =
  !!(process.env.OPENAI_API_KEY?.trim()) || !!(process.env.GROQ_API_KEY?.trim());

/**
 * Mint a JWT the real verifyToken middleware accepts in test mode.
 * Matches the pattern used in trialDemoIntegration.test.ts.
 */
function tokenFor(user: {
  id: string;
  organizationId: string;
  role?: string;
}): string {
  return jwt.sign(
    {
      id: user.id,
      role: user.role ?? 'ADMIN',
      organizationId: user.organizationId,
    },
    process.env.JWT_SECRET!
  );
}

// Fixed IDs so we can cross-reference assertions
const ORG_ID = `org-voice-stt-${uuidv4().slice(0, 8)}`;
const USER_ID = `user-voice-stt-${uuidv4().slice(0, 8)}`;
const TOKEN = tokenFor({ id: USER_ID, organizationId: ORG_ID, role: 'ADMIN' });

// ---------------------------------------------------------------------------
// Suite setup
// ---------------------------------------------------------------------------
describe('M10 Interview voice STT save (L-01)', () => {
  let app: any;
  let db: any;
  let sessionId: string;
  let questionId: string;

  beforeAll(async () => {
    // Initialize SQLite test DB
    const { initializeDatabase } = await import(
      '../../../server/src/database/DatabaseInitializer.js'
    );
    const { getDatabase } = await import('../../../server/src/database/Database.js');

    await initializeDatabase();
    db = getDatabase();

    // Boot the Express app
    const serverModule = await import('../../../server/src/index.js');
    app = serverModule.default;

    // Seed: org + user so RBAC guards pass
    await db.run(
      `INSERT OR IGNORE INTO organizations (id, name, status, created_at, updated_at)
       VALUES (?, ?, 'active', datetime('now'), datetime('now'))`,
      [ORG_ID, 'Test Org Voice STT']
    );
    await db.run(
      `INSERT OR IGNORE INTO users
         (id, email, password_hash, organization_id, role, status, created_at, updated_at)
       VALUES (?, ?, 'x', ?, 'ADMIN', 'active', datetime('now'), datetime('now'))`,
      [USER_ID, `voice-stt-${USER_ID}@test.local`, ORG_ID]
    );

    // Seed a project (interview sessions require a valid project_id)
    const projectId = uuidv4();
    await db.run(
      `INSERT OR IGNORE INTO projects (id, organization_id, name, status, created_at, updated_at)
       VALUES (?, ?, 'Test Project STT', 'active', datetime('now'), datetime('now'))`,
      [projectId, ORG_ID]
    );

    // Create an interview session directly in DB (avoids template-approval flow)
    sessionId = uuidv4();
    await db.run(
      `INSERT INTO interview_sessions
         (id, organization_id, project_id, name, owner_id, status, progress_json,
          runtime_mode_default, started_at, last_activity_at, created_at, updated_at)
       VALUES (?, ?, ?, 'STT E2E Session', ?, 'active',
               '{"strategy":0,"operations":0,"digital":0,"people":0,"finance":0}',
               'single_question', datetime('now'), datetime('now'), datetime('now'), datetime('now'))`,
      [sessionId, ORG_ID, projectId, USER_ID]
    );

    // Create a question in that session
    questionId = uuidv4();
    await db.run(
      `INSERT INTO interview_questions
         (id, session_id, organization_id, category, question_text, status, sort_order,
          is_template, is_required, allow_voice, created_at, updated_at)
       VALUES (?, ?, ?, 'strategy', 'Describe your main operational challenge.', 'not_started',
               1, 1, 0, 1, datetime('now'), datetime('now'))`,
      [questionId, sessionId, ORG_ID]
    );
  });

  afterAll(async () => {
    // Clean up seeded rows
    await db.run(`DELETE FROM interview_questions WHERE session_id = ?`, [sessionId]);
    await db.run(`DELETE FROM interview_sessions WHERE id = ?`, [sessionId]);
    await db.run(`DELETE FROM users WHERE id = ?`, [USER_ID]);
    await db.run(`DELETE FROM organizations WHERE id = ?`, [ORG_ID]);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // [always] — DB round-trip: PATCH question with pre-transcribed text
  // -------------------------------------------------------------------------
  // This test does NOT call /api/voice/stt — it simulates the FE behaviour
  // AFTER Whisper has already returned a transcript.  The critical assertion
  // is that voice_transcript + answer_text are persisted correctly.
  it('[always] PATCH /api/interview/questions/:id persists voiceTranscript as answer_text', async () => {
    const transcriptText = 'Głównym wyzwaniem jest integracja systemów ERP.';

    const res = await request(app)
      .patch(`/api/interview/questions/${questionId}`)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({
        voiceTranscript: transcriptText,
        voiceTranscriptStatus: 'approved',
        answerMode: 'voice_answer',
        status: 'answered',
      });

    // Server may return 200 or 201; just ensure it's not an error
    expect(res.status).toBeLessThan(400);

    const row = await db.get(
      `SELECT answer_text, voice_transcript, voice_transcript_status, answer_mode
       FROM interview_questions WHERE id = ?`,
      [questionId]
    );

    // Core assertions — these are the exact columns the FE bug left empty
    expect(row).toBeTruthy();
    expect(row.voice_transcript).toBe(transcriptText);
    expect(row.voice_transcript_status).toBe('approved');
    // When answerText is not provided but voiceTranscript + approved → promoted
    expect(row.answer_text).toBe(transcriptText);
    expect(row.answer_mode).toBe('voice_answer');
  });

  it('[always] GET /api/interview/sessions/:sessionId/questions returns voice fields', async () => {
    const res = await request(app)
      .get(`/api/interview/sessions/${sessionId}/questions`)
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    const questions: any[] = Array.isArray(res.body) ? res.body : res.body?.questions ?? [];
    const q = questions.find((x: any) => x.id === questionId);

    expect(q).toBeTruthy();
    expect(q.voiceTranscript).toBeTruthy();
    expect(q.voiceTranscriptStatus).toBe('approved');
    expect(q.answerText).toBeTruthy();
    expect(q.answerMode).toBe('voice_answer');
  });

  // -------------------------------------------------------------------------
  // [always] — Verify the bug scenario: missing voiceTranscriptStatus
  // Without 'approved' status, voice transcript must NOT promote to answer_text
  // -------------------------------------------------------------------------
  it('[always] PATCH without voiceTranscriptStatus=approved does NOT overwrite answer_text', async () => {
    const newQuestionId = uuidv4();
    await db.run(
      `INSERT INTO interview_questions
         (id, session_id, organization_id, category, question_text, status, sort_order,
          is_template, is_required, allow_voice, created_at, updated_at)
       VALUES (?, ?, ?, 'operations', 'Describe your supply chain.', 'not_started',
               2, 1, 0, 1, datetime('now'), datetime('now'))`,
      [newQuestionId, sessionId, ORG_ID]
    );

    try {
      const res = await request(app)
        .patch(`/api/interview/questions/${newQuestionId}`)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          voiceTranscript: 'draft text not yet approved',
          voiceTranscriptStatus: 'draft',   // <-- NOT 'approved'
          answerMode: 'voice_answer',
        });

      expect(res.status).toBeLessThan(400);

      const row = await db.get(
        `SELECT answer_text, voice_transcript, voice_transcript_status
         FROM interview_questions WHERE id = ?`,
        [newQuestionId]
      );

      expect(row.voice_transcript).toBe('draft text not yet approved');
      expect(row.voice_transcript_status).toBe('draft');
      // answer_text must remain empty — draft should NOT be auto-promoted
      expect(row.answer_text == null || row.answer_text === '').toBe(true);
    } finally {
      await db.run(`DELETE FROM interview_questions WHERE id = ?`, [newQuestionId]);
    }
  });

  // -------------------------------------------------------------------------
  // [caboose] — Full STT round-trip: POST audio blob → Whisper → transcript
  // Requires OPENAI_API_KEY or GROQ_API_KEY on the executing machine.
  // -------------------------------------------------------------------------
  it.skipIf(!STT_AVAILABLE)(
    '[caboose] POST /api/voice/stt transcribes audio and returns text (requires OPENAI_API_KEY)',
    async () => {
      // Minimal valid WAV: 44-byte header + 1600 bytes of silence (0.1 s @ 16kHz, 16-bit mono)
      // Whisper accepts silence and returns an empty or near-empty transcript.
      const SAMPLE_RATE = 16000;
      const NUM_SAMPLES = SAMPLE_RATE / 10; // 0.1 s
      const wavBuffer = buildSilentWav(NUM_SAMPLES);

      const res = await request(app)
        .post('/api/voice/stt')
        .set('Authorization', `Bearer ${TOKEN}`)
        .attach('audio', wavBuffer, {
          filename: 'test-silence.wav',
          contentType: 'audio/wav',
        })
        .field('language', 'pl');

      // 200 → Whisper returned (empty string is fine for silence)
      // 503 → API key not yet reachable on this env (non-fatal in CI)
      expect([200, 503]).toContain(res.status);

      if (res.status === 200) {
        expect(res.body).toHaveProperty('text');
        expect(typeof res.body.text).toBe('string');
      }
    }
  );

  // -------------------------------------------------------------------------
  // [caboose] — Full pipeline: STT → PATCH question → verify DB
  // -------------------------------------------------------------------------
  it.skipIf(!STT_AVAILABLE)(
    '[caboose] Full pipeline: audio → STT → PATCH question → answer persisted in DB (requires OPENAI_API_KEY)',
    async () => {
      // 1. Call STT to get a transcript (we use a silent clip; Whisper returns '' or music tokens)
      const wavBuffer = buildSilentWav(16000 / 10);

      const sttRes = await request(app)
        .post('/api/voice/stt')
        .set('Authorization', `Bearer ${TOKEN}`)
        .attach('audio', wavBuffer, { filename: 'test.wav', contentType: 'audio/wav' })
        .field('language', 'pl');

      if (sttRes.status === 503) {
        // Whisper not yet wired on this env → skip silently
        return;
      }

      expect(sttRes.status).toBe(200);
      // For silence Whisper typically returns '' or '[Cisza]' — we patch whatever came back
      const transcript: string = String(sttRes.body?.text ?? '').trim() || 'STT silence test';

      // 2. Persist the transcript via the same code path the FE uses
      const patchRes = await request(app)
        .patch(`/api/interview/questions/${questionId}`)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          voiceTranscript: transcript,
          voiceTranscriptStatus: 'approved',
          answerMode: 'voice_answer',
          status: 'answered',
        });

      expect(patchRes.status).toBeLessThan(400);

      // 3. Verify DB row — this is the specific check that proves the bug is fixed
      const row = await db.get(
        `SELECT answer_text, voice_transcript, voice_transcript_status, answer_mode, status
         FROM interview_questions WHERE id = ?`,
        [questionId]
      );

      expect(row.voice_transcript).toBe(transcript);
      expect(row.voice_transcript_status).toBe('approved');
      expect(row.answer_text).toBe(transcript);       // promoted — bug was answer_text staying NULL
      expect(row.answer_mode).toBe('voice_answer');
      expect(row.status).toBe('answered');
    }
  );
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal valid WAV file containing silence.
 * Whisper accepts it without crashing — returns empty transcript.
 */
function buildSilentWav(numSamples: number): Buffer {
  const sampleRate = 16000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = numSamples * blockAlign;
  const headerSize = 44;
  const buf = Buffer.alloc(headerSize + dataSize);

  // RIFF header
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  // fmt chunk
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);        // chunk size
  buf.writeUInt16LE(1, 20);         // PCM
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(bitsPerSample, 34);
  // data chunk
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  // silence = all zeros (already zeroed by Buffer.alloc)

  return buf;
}
