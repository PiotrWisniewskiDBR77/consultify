import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

const read = (file: string) => readFileSync(path.resolve(file), 'utf8');

describe('MTG-POL-001 recording/transcription approved-out contract', () => {
  it('keeps the Meeting product surface manual-text-only with no capture implementation', () => {
    const hub = read('src/components/Meeting/MeetingHub.tsx');
    const api = read('src/services/api.ts');
    const route = read('server/src/routes/meeting.routes.ts');
    const apiSlice = api.slice(api.indexOf('generateMeetingNotes:'), api.indexOf('listMeetingNotes:'));

    expect(hub).toContain('data-meeting-capture-policy="manual-text-only"');
    expect(hub).toContain('Recording and automatic transcription are OFF.');
    expect(`${hub}\n${apiSlice}`).not.toMatch(/MediaRecorder|getUserMedia|audio\/(?:webm|wav)|multipart\/form-data/);
    expect(route).toContain("const MANUAL_NOTE_FIELDS = new Set(['transcript', 'language', 'idempotencyKey'])");
    expect(apiSlice).not.toContain('persist?:');
  });

  it('restarts fail-closed regardless of activation-looking environment variables', async () => {
    const recording = process.env.MEETING_RECORDING_ENABLED;
    const provider = process.env.MEETING_TRANSCRIPTION_PROVIDER;
    try {
      process.env.MEETING_RECORDING_ENABLED = 'true';
      process.env.MEETING_TRANSCRIPTION_PROVIDER = 'external:any';
      vi.resetModules();
      const first = await import('../../../server/src/routes/meeting.routes.js');
      expect(first.MEETING_CAPTURE_POLICY).toEqual({
        recordingEnabled: false,
        automaticTranscriptionEnabled: false,
        acceptsManualSourceText: true,
      });
      expect(first.validateManualMeetingNotePayload({ transcript: 'typed by a person' })).toEqual({ ok: true });
      expect(first.validateManualMeetingNotePayload({ transcript: 'x', recording: true })).toMatchObject({
        ok: false,
        code: 'MEETING_CAPTURE_DISABLED',
      });
      vi.resetModules();
      const restarted = await import('../../../server/src/routes/meeting.routes.js');
      expect(restarted.MEETING_CAPTURE_POLICY).toEqual(first.MEETING_CAPTURE_POLICY);
    } finally {
      if (recording === undefined) delete process.env.MEETING_RECORDING_ENABLED;
      else process.env.MEETING_RECORDING_ENABLED = recording;
      if (provider === undefined) delete process.env.MEETING_TRANSCRIPTION_PROVIDER;
      else process.env.MEETING_TRANSCRIPTION_PROVIDER = provider;
    }
  });
});
