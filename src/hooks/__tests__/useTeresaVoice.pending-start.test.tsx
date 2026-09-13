/** @vitest-environment jsdom */
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTeresaVoice } from '../useTeresaVoice';

const sdk = vi.hoisted(() => ({ connect: vi.fn(), close: vi.fn(), construct: vi.fn() }));
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    constructor() { sdk.construct(); }
    live = { connect: sdk.connect };
  },
  Modality: { AUDIO: 'AUDIO' },
}));
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
};
let closeBarrier: ReturnType<typeof deferred> | null;
let closeAudio: ReturnType<typeof vi.fn>;
let mic: ReturnType<typeof vi.fn>;
let contexts: ReturnType<typeof vi.fn<() => void>>;
const mount = () => renderHook(() => useTeresaVoice({
  enabled: true, language: 'en', systemInstruction: 'test', apiKey: 'local-unit-token',
}));

beforeEach(() => {
  vi.clearAllMocks();
  closeBarrier = null;
  contexts = vi.fn();
  closeAudio = vi.fn(() => closeBarrier?.promise ?? Promise.resolve());
  sdk.connect.mockImplementation(async ({ callbacks }) => {
    callbacks.onopen?.();
    return { close: sdk.close, sendRealtimeInput: vi.fn(), sendClientContent: vi.fn() };
  });
  class AudioContextMock {
    constructor() { contexts(); }
    currentTime = 0;
    destination = {};
    close = closeAudio;
    createMediaStreamSource() { return { connect: vi.fn(), disconnect: vi.fn() }; }
    createScriptProcessor() { return { connect: vi.fn(), disconnect: vi.fn(), onaudioprocess: null }; }
  }
  vi.stubGlobal('AudioContext', AudioContextMock);
  mic = vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn(), enabled: true }] });
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: mic } });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Teresa voice cancellation at a real pending startup await', () => {
  // This pauses the existing teardown await, NOT a pretend synchronous SDK delay.
  // The subsequent lazy-import token guard must reject the abandoned attempt.
  for (const cancel of ['unmount', 'stop'] as const) {
    it(`${cancel} during pending restart cannot acquire another microphone or session`, async () => {
      const view = mount();
      await waitFor(() => expect(view.result.current.voiceAvailable).toBe(true));
      await act(async () => { await view.result.current.startVoiceConversation(); });
      expect(sdk.connect).toHaveBeenCalledTimes(1);
      closeBarrier = deferred();
      let restart!: Promise<void>;
      act(() => { restart = view.result.current.startVoiceConversation(); });
      // AudioContext.close is the precise pending await, with no timer assumptions.
      expect(closeAudio).toHaveBeenCalledTimes(1);
      expect(contexts).toHaveBeenCalledTimes(1);
      let stopping: Promise<void> | undefined;
      if (cancel === 'unmount') view.unmount();
      else act(() => { stopping = view.result.current.stopVoiceConversation(); });
      await act(async () => {
        closeBarrier!.resolve();
        await restart;
        await stopping;
      });
      expect(contexts).toHaveBeenCalledTimes(1);
      expect(mic).toHaveBeenCalledTimes(1);
      expect(sdk.connect).toHaveBeenCalledTimes(1);
      if (cancel === 'stop') expect(view.result.current.voiceStatus).toBe('idle');
    });
  }
  it('idle creates no voice resources; normal start creates one session and stop closes it', async () => {
    const view = mount();
    await waitFor(() => expect(view.result.current.voiceAvailable).toBe(true));
    expect(sdk.construct).not.toHaveBeenCalled();
    expect(mic).not.toHaveBeenCalled();
    await act(async () => { await view.result.current.startVoiceConversation(); });
    expect(sdk.connect).toHaveBeenCalledTimes(1);
    expect(view.result.current.voiceStatus).toBe('live');
    await act(async () => { await view.result.current.stopVoiceConversation(); });
    expect(view.result.current.voiceStatus).toBe('idle');
    expect(sdk.close).toHaveBeenCalledTimes(1);
  });
  it('microphone denial remains an actionable error and never connects the SDK', async () => {
    mic.mockRejectedValueOnce(new DOMException('Denied', 'NotAllowedError'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const view = mount();
    await waitFor(() => expect(view.result.current.voiceAvailable).toBe(true));
    await act(async () => { await view.result.current.startVoiceConversation(); });
    expect(view.result.current.voiceStatus).toBe('error');
    expect(view.result.current.voiceError).toMatch(/mikrofon|microphone/i);
    expect(sdk.connect).not.toHaveBeenCalled();
    expect(closeAudio).toHaveBeenCalledTimes(1);
  });
});
