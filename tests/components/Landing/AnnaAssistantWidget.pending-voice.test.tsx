/** @vitest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnnaAssistantWidget } from '../../../src/components/Landing/AnnaAssistantWidget';

const sdk = vi.hoisted(() => ({ construct: vi.fn(), connect: vi.fn() }));
vi.mock('@google/genai', () => ({
  GoogleGenAI: class { constructor() { sdk.construct(); } live = { connect: sdk.connect }; },
  Modality: { AUDIO: 'AUDIO' },
}));
vi.mock('react-router-dom', async () => ({
  ...await vi.importActual<typeof import('react-router-dom')>('react-router-dom'),
  useNavigate: () => vi.fn(),
}));
const i18n: any = { language: 'en', resolvedLanguage: 'en', changeLanguage: () => Promise.resolve() };
let releaseContext!: (response: any) => void;
let contextRequested: ReturnType<typeof vi.fn>;
let mic: ReturnType<typeof vi.fn>;
let contextJson: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  contextRequested = vi.fn();
  contextJson = vi.fn(async () => ({ context: 'Local voice test context' }));
  const pendingContext = new Promise(resolve => { releaseContext = resolve; });
  sdk.connect.mockImplementation(async ({ callbacks }) => {
    callbacks.onopen?.();
    return { close: vi.fn(), sendRealtimeInput: vi.fn(), sendClientContent: vi.fn() };
  });
  class AudioContextMock {
    currentTime = 0;
    destination = {};
    close = vi.fn().mockResolvedValue(undefined);
    createMediaStreamSource() { return { connect: vi.fn(), disconnect: vi.fn() }; }
    createScriptProcessor() { return { connect: vi.fn(), disconnect: vi.fn(), onaudioprocess: null }; }
  }
  vi.stubGlobal('AudioContext', AudioContextMock);
  mic = vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn(), enabled: true }] });
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: mic } });
  vi.stubGlobal('fetch', vi.fn(async (input: any) => {
    const url = String(input);
    if (url.includes('/voice-config')) return { ok: true, json: async () => ({ enabled: true, session: { clientToken: 'local-unit-token' }, voiceName: 'Kore' }) };
    if (url.includes('/voice-context')) { contextRequested(); return pendingContext; }
    if (url.includes('/chat')) return { ok: true, json: async () => ({ message: 'Local text reply', knowledgeSources: [] }) };
    return { ok: true, json: async () => ({ success: true }) };
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

async function startPendingVoice() {
  const view = render(<I18nextProvider i18n={i18n}><AnnaAssistantWidget /></I18nextProvider>);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Ask Anna first' })); });
  // Await the real config fetch/effects before starting; contextRequested is
  // the positive proof startup got past capability checks into its pending await.
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start voice conversation' })); });
  await waitFor(() => expect(contextRequested).toHaveBeenCalledTimes(1));
  expect(mic).not.toHaveBeenCalled();
  return view;
}
async function finishContext() {
  await act(async () => {
    releaseContext({ ok: true, json: contextJson });
    await Promise.resolve();
  });
  await waitFor(() => expect(contextJson).toHaveBeenCalledTimes(1));
  await act(async () => { await vi.dynamicImportSettled(); });
}

describe('Anna cancellation while real voice-context bootstrap is pending', () => {
  for (const cancel of ['unmount', 'close'] as const) {
    it(`${cancel} prevents a resumed voice start from acquiring microphone or session`, async () => {
      const view = await startPendingVoice();
      if (cancel === 'unmount') view.unmount();
      else fireEvent.click(screen.getByRole('button', { name: 'Close Anna' }));
      await finishContext();
      expect(sdk.construct).not.toHaveBeenCalled();
      expect(mic).not.toHaveBeenCalled();
      expect(sdk.connect).not.toHaveBeenCalled();
    });
  }
  it('completing the same pending bootstrap normally opens exactly one voice session', async () => {
    await startPendingVoice();
    await finishContext();
    await waitFor(() => expect(sdk.connect).toHaveBeenCalledTimes(1));
    expect(mic).toHaveBeenCalledTimes(1);
  });
});
