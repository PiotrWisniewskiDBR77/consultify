import fs from 'fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * M01-P05 — audio retention policy (contract item 6): the uploaded STT
 * recording must be deleted after every transcription attempt, not only
 * successful ones. Before this fix, `handleSTT` only called `fs.unlink` in
 * the success path — a transcription failure (provider down, bad audio,
 * network error) left the raw voice recording on disk indefinitely, with no
 * other cleanup job in this codebase to catch it. `unlink` is now in a
 * `finally` block.
 */
vi.mock('../../services/ai/VoiceService.js', () => ({
  voiceService: {
    transcribe: vi.fn(),
    synthesize: vi.fn(),
  },
}));

vi.mock('../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { voiceController } from '../voice.controller.js';
import { voiceService } from '../../services/ai/VoiceService.js';

function mockReqRes(filePath: string) {
  const req = {
    file: { path: filePath } as Express.Multer.File,
    body: { language: 'pl' },
  } as any;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as any;
  return { req, res };
}

describe('VoiceController.handleSTT — audio retention (M01-P05)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(fs, 'unlink').mockImplementation(((_path: any, cb: any) => cb(null)) as any);
  });

  it('deletes the uploaded file after a SUCCESSFUL transcription', async () => {
    (voiceService.transcribe as any).mockResolvedValue('hello world');
    const { req, res } = mockReqRes('/tmp/uploads/voice/ok-recording.webm');

    await voiceController.handleSTT(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(fs.unlink).toHaveBeenCalledWith(
      '/tmp/uploads/voice/ok-recording.webm',
      expect.any(Function)
    );
  });

  it('ALSO deletes the uploaded file after a FAILED transcription — the actual bug this packet fixes', async () => {
    (voiceService.transcribe as any).mockRejectedValue(new Error('provider timeout'));
    const { req, res } = mockReqRes('/tmp/uploads/voice/failed-recording.webm');

    await voiceController.handleSTT(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(fs.unlink).toHaveBeenCalledWith(
      '/tmp/uploads/voice/failed-recording.webm',
      expect.any(Function)
    );
  });

  it('deletes the uploaded file even when the failure is a 503 (service unavailable) response', async () => {
    (voiceService.transcribe as any).mockRejectedValue(
      new Error('API key not configured for provider')
    );
    const { req, res } = mockReqRes('/tmp/uploads/voice/unavailable-recording.webm');

    await voiceController.handleSTT(req, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(fs.unlink).toHaveBeenCalledWith(
      '/tmp/uploads/voice/unavailable-recording.webm',
      expect.any(Function)
    );
  });

  /**
   * Reproduces the pre-fix code path (unlink only in the try block, after
   * the awaited call) and shows it leaves the file on disk when transcribe()
   * rejects — the exact leak this fix closes.
   */
  it('[negative control] the pre-fix shape (unlink only after a successful transcribe) leaks the file on failure', async () => {
    const unlinkSpy = vi.fn();
    const brokenHandleSTT = async (transcribe: () => Promise<string>) => {
      try {
        const text = await transcribe();
        unlinkSpy(); // pre-fix: unlink lived HERE, only reached on success
        return { status: 200, text };
      } catch {
        return { status: 500 };
      }
    };

    await brokenHandleSTT(() => Promise.reject(new Error('boom')));
    expect(unlinkSpy).not.toHaveBeenCalled();
    expect(() => {
      expect(unlinkSpy).toHaveBeenCalled();
    }).toThrow();
  });
});
