/**
 * @vitest-environment jsdom
 *
 * [ODMROZENIE WSPOLNE DEC-496] — feedback Pawła (pawel.mroczkowski@dbr77.com),
 * ticket 66f30ed7-f936-4d49-a635-c786da4e1ce6, 2026-09-14 05:37 UTC:
 * "The Dictate function in Assessment Answers does not recognise languages."
 *
 * ZMIERZONA PRZYCZYNA: `VoiceAnswerChannel` już derywuje `settings.language`
 * z `i18n.language` (naprawa 06.09, commit 3558a39183) — to NIE jest stała
 * `pl-PL`, wbrew premisie zlecenia. Prawdziwy resztkowy defekt siedział w
 * `initWebSpeechRecognition` (src/hooks/useUniversalVoice.ts): mapowanie
 * `settings.language -> SpeechRecognition.lang` obsługiwało tylko 3 z 6
 * wspieranych języków (pl/en/de) i dla ar/ja/es cicho spadało na 'pl-PL'
 * zamiast na język użytkownika — niespójne z `LANG_TO_BCP47`, którego ten
 * sam plik już używa do TTS. Ten test dowodzi, że po naprawie
 * `recognition.lang` pokrywa się z `LANG_TO_BCP47` dla wszystkich 6 języków,
 * z fallbackiem na `en-US` (nie `pl-PL`) dla nieznanego kodu.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useUniversalVoice } from '../useUniversalVoice';

class FakeSpeechRecognition {
  static instances: FakeSpeechRecognition[] = [];
  lang = '';
  continuous = false;
  interimResults = false;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  constructor() {
    FakeSpeechRecognition.instances.push(this);
  }
  start(): void {}
  stop(): void {}
}

beforeEach(() => {
  FakeSpeechRecognition.instances = [];
  (window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition =
    FakeSpeechRecognition;
});

afterEach(() => {
  delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
});

describe('useUniversalVoice — Web Speech recognition.lang mapping', () => {
  const cases: Array<[string, string]> = [
    ['pl', 'pl-PL'],
    ['en', 'en-US'],
    ['de', 'de-DE'],
    ['ar', 'ar-SA'],
    ['ja', 'ja-JP'],
    ['es', 'es-ES'],
  ];

  it.each(cases)(
    'settings.language=%s -> SpeechRecognition.lang=%s (all 6 app languages, not just pl/en/de)',
    async (language, expectedLang) => {
      const { result } = renderHook(() =>
        useUniversalVoice({ settings: { inputMode: 'click-to-talk', sttProvider: 'web', language } })
      );

      await act(async () => {
        result.current.toggleListening();
      });

      const created = FakeSpeechRecognition.instances.at(-1);
      expect(created).toBeTruthy();
      expect(created!.lang).toBe(expectedLang);
    }
  );

  it('falls back to en-US (not pl-PL) for an unknown language code', async () => {
    const { result } = renderHook(() =>
      useUniversalVoice({ settings: { inputMode: 'click-to-talk', sttProvider: 'web', language: 'zz' } })
    );

    await act(async () => {
      result.current.toggleListening();
    });

    const created = FakeSpeechRecognition.instances.at(-1);
    expect(created).toBeTruthy();
    expect(created!.lang).toBe('en-US');
  });
});
