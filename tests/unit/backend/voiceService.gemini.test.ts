import fs from 'fs';
import os from 'os';
import path from 'path';

import { describe, it, expect, vi, beforeEach } from 'vitest';

const genaiMocks = {
  generateContent: vi.fn(),
  getGenerativeModel: vi.fn(),
};

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel = genaiMocks.getGenerativeModel;
  },
}));

vi.mock('../../../server/src/services/ai/llmConfigService.js', () => ({
  llmConfigService: {
    getProviderConfig: vi.fn().mockResolvedValue(null),
    getAllProviders: vi.fn().mockResolvedValue([]),
  },
}));

import { VoiceService } from '../../../server/src/services/ai/VoiceService.js';

describe('VoiceService — Gemini STT fallback (reuses Teresa Google key)', () => {
  let audioPath: string;

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.GROQ_API_KEY;
    genaiMocks.generateContent.mockReset();
    genaiMocks.getGenerativeModel.mockReturnValue({ generateContent: genaiMocks.generateContent });
    audioPath = path.join(os.tmpdir(), `vs-gemini-${process.pid}-${Math.round(performance.now())}.webm`);
    fs.writeFileSync(audioPath, Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  });

  it('falls back to Gemini when no Whisper key is set', async () => {
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    genaiMocks.generateContent.mockResolvedValue({
      response: { text: () => '  To jest odpowiedź z wywiadu.  ' },
    });

    const text = await VoiceService.getInstance().transcribe(audioPath, 'pl');

    expect(genaiMocks.generateContent).toHaveBeenCalledTimes(1);
    const parts = genaiMocks.generateContent.mock.calls[0][0];
    expect(parts[0].inlineData.mimeType).toBe('audio/webm');
    expect(typeof parts[0].inlineData.data).toBe('string');
    expect(text).toBe('To jest odpowiedź z wywiadu.'); // trimmed verbatim transcript
  });

  it('throws a clear error when no STT provider at all', async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_AI_API_KEY;
    delete process.env.GOOGLE_API_KEY;

    await expect(VoiceService.getInstance().transcribe(audioPath)).rejects.toThrow(
      /No STT provider available/
    );
  });
});
