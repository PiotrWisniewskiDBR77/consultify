import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useToolAI } from '@/hooks/discovery/useToolAI';
import { useToolStore } from '@/store/useToolStore';

const startStream = vi.fn();
const abortStream = vi.fn(() => true);
let streamedContent = '';
let streamStartedAt: number | null = null;
// N3: strumien musi dac sie WYLACZYC w tescie — strazniki ciszy reaguja na
// przejscie „trwa -> skonczony", a nie na sam brak tresci.
let isStreaming = false;

vi.mock('@/hooks/useAIStream', () => ({
  useAIStream: () => ({
    startStream,
    abortStream,
    retryLastStream: vi.fn(),
    isStreaming,
    streamedContent,
    streamStartedAt,
    error: null,
    resetStream: vi.fn(),
    sessionId: null,
  }),
}));

describe('useToolAI full-session terminal lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    startStream.mockReset();
    abortStream.mockClear();
    streamedContent = '';
    streamStartedAt = null;
    isStreaming = false;
    useToolStore.getState().createSession('dynamic-swot');
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('joins duplicate generation calls and cancellation settles one attempt without clearing data', async () => {
    startStream.mockImplementation(() => new Promise<void>(() => {}));
    const initialData = useToolStore.getState().currentSession?.inputData;
    const { result } = renderHook(() => useToolAI({ toolType: 'dynamic-swot' }));

    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current.generateFullSession();
      second = result.current.generateFullSession();
    });

    expect(startStream).toHaveBeenCalledTimes(1);
    expect(second).toBeInstanceOf(Promise);

    await act(async () => {
      result.current.abortStream();
      await Promise.all([first, second]);
    });

    expect(abortStream).toHaveBeenCalledTimes(1);
    expect(useToolStore.getState().currentSession?.sessionGenerationStatus).toBe('error');
    expect(useToolStore.getState().currentSession?.inputData).toEqual(initialData);
  });

  it('turns a provider failure into a retryable terminal state and preserves work', async () => {
    startStream.mockRejectedValue(new Error('provider unavailable'));
    const initialData = useToolStore.getState().currentSession?.inputData;
    const { result } = renderHook(() => useToolAI({ toolType: 'dynamic-swot' }));

    await act(async () => {
      await result.current.generateFullSession();
    });

    expect(result.current.error).toContain('work is safe');
    expect(useToolStore.getState().currentSession?.sessionGenerationStatus).toBe('error');
    expect(useToolStore.getState().currentSession?.inputData).toEqual(initialData);
  });

  it('aborts after the bounded timeout and settles without a delayed duplicate start', async () => {
    startStream.mockImplementation(() => new Promise<void>(() => {}));
    const { result } = renderHook(() => useToolAI({ toolType: 'dynamic-swot' }));
    let generation!: Promise<void>;

    act(() => {
      generation = result.current.generateFullSession();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(90_000);
      await generation;
    });

    expect(abortStream).toHaveBeenCalledTimes(1);
    expect(startStream).toHaveBeenCalledTimes(1);
    expect(result.current.error).toContain('timed out');
    expect(useToolStore.getState().currentSession?.sessionGenerationStatus).toBe('error');
  });

  it('applies one successful response and settles ready only for the fresh stream attempt', async () => {
    let startedAt = 1234;
    startStream.mockImplementation(async () => {
      streamStartedAt = startedAt;
      startedAt += 1;
      streamedContent = JSON.stringify({
        signals: [],
        items: [
          {
            text: 'One proposed strength',
            quadrant: 'strengths',
            impact: 'high',
          },
        ],
        correlations: [],
        tensions: [],
        moves: [],
        outputCandidates: [],
        initiatives: [],
        summary: { executiveSummary: 'One bounded synthesis' },
      });
    });
    const { result, rerender } = renderHook(() => useToolAI({ toolType: 'dynamic-swot' }));
    let generation!: Promise<void>;

    await act(async () => {
      generation = result.current.generateFullSession();
      await Promise.resolve();
      rerender();
      await generation;
    });

    expect(startStream).toHaveBeenCalledTimes(1);
    expect(useToolStore.getState().currentSession?.sessionGenerationStatus).toBe('ready');
    expect((useToolStore.getState().currentSession?.inputData as any).items).toHaveLength(1);
  });

  // N3 (zgloszenie testera `6c07439e`, staging 2026-09-14 05:07 UTC): „AI Draft"
  // wisial na 0% ponad 30 s bez zadnego komunikatu — jedyna akcja to Cancel.
  // PRZYCZYNA: efekt stosujacy wynik wychodzil bez sladu przy pustym
  // `streamedContent` (odpowiedz w calosci w `<thinking>`), zostawiajac status
  // `generating` i `error === null` az do licznika 90 s.
  // MUTACJA: usuniecie strażnika `fullSessionWasStreamingRef` wywraca ten test
  // (status zostaje `generating`, error `null`).
  it('zamienia cisze po koncu strumienia na blad z mozliwoscia ponowienia', async () => {
    let endStream: () => void = () => {};
    startStream.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          endStream = resolve;
        })
    );
    isStreaming = true;
    const initialData = useToolStore.getState().currentSession?.inputData;
    const { result, rerender } = renderHook(() => useToolAI({ toolType: 'dynamic-swot' }));

    let generation!: Promise<void>;
    act(() => {
      generation = result.current.generateFullSession();
    });
    expect(useToolStore.getState().currentSession?.sessionGenerationStatus).toBe('generating');

    // Strumien konczy sie nie zostawiajac ani jednego widocznego znaku.
    isStreaming = false;
    streamedContent = '';
    // Rerender i uplyw czasu MUSZA byc w osobnych `act` — inaczej efekt
    // strażnika nie zdazy sie uruchomic przed przesunieciem zegara.
    await act(async () => {
      endStream();
      rerender();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
      await generation;
    });

    expect(useToolStore.getState().currentSession?.sessionGenerationStatus).toBe('error');
    expect(result.current.error).toContain('work is safe');
    // Blad pojawia sie ZANIM zadziala twarda siatka 90 s.
    expect(abortStream).not.toHaveBeenCalled();
    // Dane uzytkownika nietkniete — ponowienie jest bezpieczne.
    expect(useToolStore.getState().currentSession?.inputData).toEqual(initialData);
  });

});
