/**
 * M10 Interview — VoiceService.transcribe() provider fail-safe (HARVARD H6.1)
 *
 * Covers the server-side transcribe() decision tree with MOCKED providers:
 *   - success:  Whisper (OpenAI) key set → returns Whisper text
 *   - provider awaria: Whisper key set but Whisper throws → falls through to
 *                      Gemini (Teresa's Google key) and still returns text
 *   - brak klucza: no provider at all → throws a clear "No STT provider" error
 *
 * The parallel client fail-safe (browser transcript always saved even when the
 * server errors) is asserted in tests/integration/interview/voice-stt-save.test.ts.
 *
 * NOTE: uses a FRESH VoiceService instance per case (the real export is a
 * singleton that caches clients) via (VoiceService as any) constructor reach —
 * we reset module state with vi.resetModules + dynamic import instead.
 *
 * Run: npx vitest run tests/unit/voice/voice-service-transcribe-failsafe.test.ts
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks (hoisted) --------------------------------------------------------
const whisperCreate = vi.fn();
const geminiGenerate = vi.fn();

vi.mock('openai', () => ({
  OpenAI: class {
    audio = { transcriptions: { create: whisperCreate }, speech: { create: vi.fn() } };
  },
}));

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel = () => ({ generateContent: geminiGenerate });
  },
}));

vi.mock('../../../server/src/services/ai/llmConfigService.js', () => ({
  llmConfigService: {
    getProviderConfig: vi.fn().mockResolvedValue(null),
    getAllProviders: vi.fn().mockResolvedValue([]),
  },
}));

// Import AFTER mocks so the singleton picks up mocked deps.
import { VoiceService } from '../../../server/src/services/ai/VoiceService.js';

/** Force a fresh VoiceService (bypass the module singleton's cached clients). */
function freshVoiceService(): VoiceService {
  // The constructor is private; reach past it for an isolated instance per test.
  return new (VoiceService as unknown as new () => VoiceService)();
}

describe('VoiceService.transcribe — provider fail-safe', () => {
  let audioPath: string;

  beforeEach(() => {
    whisperCreate.mockReset();
    geminiGenerate.mockReset();
    delete process.env.OPENAI_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_AI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    // Unique per-test path; left for the OS tmp reaper. We must NOT unlink in an
    // afterEach because Whisper's real code path opens a lazy fs.createReadStream
    // that resolves after the test returns — deleting first races into ENOENT.
    audioPath = path.join(
      os.tmpdir(),
      `vs-failsafe-${process.pid}-${Math.round(performance.now() * 1000)}.webm`
    );
    fs.writeFileSync(audioPath, Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  });

  it('success: transcribes with Whisper when OPENAI_API_KEY is set', async () => {
    process.env.OPENAI_API_KEY = 'sk-live-real';
    whisperCreate.mockResolvedValue({ text: 'Odpowiedź z Whispera.' });

    const svc = freshVoiceService();
    const text = await svc.transcribe(audioPath, 'pl');

    expect(whisperCreate).toHaveBeenCalledTimes(1);
    expect(geminiGenerate).not.toHaveBeenCalled();
    expect(text).toBe('Odpowiedź z Whispera.');
  });

  it('provider awaria: Whisper throws → falls through to Gemini and still returns text', async () => {
    process.env.OPENAI_API_KEY = 'sk-live-real';
    process.env.GEMINI_API_KEY = 'g-teresa-key';
    whisperCreate.mockRejectedValue(new Error('Whisper 500'));
    geminiGenerate.mockResolvedValue({
      response: { text: () => 'Odpowiedź z Gemini po awarii Whispera.' },
    });

    const svc = freshVoiceService();
    const text = await svc.transcribe(audioPath, 'pl');

    expect(whisperCreate).toHaveBeenCalledTimes(1);
    expect(geminiGenerate).toHaveBeenCalledTimes(1);
    expect(text).toBe('Odpowiedź z Gemini po awarii Whispera.');
  });

  it('brak klucza: no provider at all → throws a clear "No STT provider" error', async () => {
    const svc = freshVoiceService();
    await expect(svc.transcribe(audioPath, 'pl')).rejects.toThrow(/No STT provider available/);
    expect(whisperCreate).not.toHaveBeenCalled();
    expect(geminiGenerate).not.toHaveBeenCalled();
  });
});
