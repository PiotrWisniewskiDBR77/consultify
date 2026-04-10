/**
 * Teresa Voice Configuration Constants
 *
 * Central config for Teresa's Gemini Live voice sessions including
 * model parameters, audio rates, and bilingual recovery phrases.
 */

export const TERESA_VOICE_CONFIG = {
  model: 'gemini-2.5-flash-native-audio-preview-09-2025',
  defaultVoiceName: 'Kore',
  sampleRateInput: 16000,
  sampleRateOutput: 24000,
  maxHistoryTurns: 12,
  voiceCommandDebounceMs: 500,
  connectionTimeoutMs: 10000,
  recoveryPhrases: {
    pl: {
      fallbackToText:
        'Przechodzę na tekst, bo głos jest niestabilny. Oto propozycja.',
      repeatRequest: 'Powtórz proszę ostatnią instrukcję.',
      approvalRequired:
        'Nie mogę wykonać tej akcji bez zatwierdzenia. Powiedz: "Zatwierdź" albo kliknij Approve.',
      missingData: 'Wstrzymuję wykonanie — brak wymaganych danych.',
      proposalReady:
        'Mam propozycję. Sprawdź szczegóły na ekranie i powiedz "Zatwierdź" lub "Odrzuć".',
      handoffComplete: 'Gotowe. Przekazałam kontekst do modułu {module}.',
    },
    en: {
      fallbackToText:
        'Switching to text — voice is unstable. Here is the proposal.',
      repeatRequest: 'Please repeat your last instruction.',
      approvalRequired:
        'I cannot perform this action without approval. Say "Approve" or click the Approve button.',
      missingData: 'Pausing execution — required data is missing.',
      proposalReady:
        'I have a proposal ready. Check the details on screen and say "Approve" or "Reject".',
      handoffComplete: 'Done. I handed off the context to the {module} module.',
    },
  },
} as const;

export type TeresaVoiceLanguage = 'pl' | 'en';

export function getRecoveryPhrase(
  key: keyof typeof TERESA_VOICE_CONFIG.recoveryPhrases.en,
  language: string,
  replacements?: Record<string, string>
): string {
  const lang: TeresaVoiceLanguage = language.startsWith('pl') ? 'pl' : 'en';
  let phrase: string = TERESA_VOICE_CONFIG.recoveryPhrases[lang][key];
  if (replacements) {
    for (const [token, value] of Object.entries(replacements)) {
      phrase = phrase.replace(`{${token}}`, value);
    }
  }
  return phrase;
}
