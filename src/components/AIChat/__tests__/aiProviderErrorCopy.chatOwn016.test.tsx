/**
 * CHAT-OWN-016 — komunikat bledu dostawcy AI we froncie.
 *
 * Broni trzech rzeczy naraz:
 *  1. kazdy przypadek ma WLASNE zdanie (nie jeden ogolnik na wszystko),
 *  2. zdanie mowi, co uzytkownik moze zrobic,
 *  3. do widoku nie trafia nic technicznego ani nic z tresci dostawcy.
 */
import React from 'react';

import { render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { beforeAll, describe, expect, it, vi } from 'vitest';

// PUŁAPKA PRZYRZĄDU (zmierzona 2026-09-03): `tests/setup.ts:46` podmienia CAŁY
// `react-i18next` atrapą, której `t(klucz, 'domyslne')` zawsze zwraca wartosc
// domyslna — czyli angielski z kodu. Bez tego odmockowania test „sprawdzalby"
// tlumaczenia PL patrzac na napisy EN i przechodzilby na zielono przy pustym
// pliku pl/translation.json. Tu potrzebujemy PRAWDZIWEGO i18n.
vi.mock('react-i18next', async () => await vi.importActual('react-i18next'));

import en from '../../../../public/locales/en/translation.json';
import pl from '../../../../public/locales/pl/translation.json';
import { AiProviderErrorNotice } from '../AiProviderErrorNotice';
import { getAiErrorCopy, getAiErrorLine, readAiErrorCode } from '../aiProviderErrorCopy';

const KODY = [
  'AI_RATE_LIMIT',
  'AI_UNAVAILABLE',
  'AI_CONFIG',
  'AI_TIMEOUT',
  'AI_STREAM_INTERRUPTED',
  'AI_EMPTY',
  'AI_ERROR',
] as const;

/** Napisy, ktore NIE moga sie pojawic przed oczami uzytkownika. */
const TECHNIKALIA =
  /sk-[a-z0-9]|openrouter|openai|anthropic|https?:\/\/|api[_ ]?key|klucz api|circuit|gpt-|claude-|http \d{3}|\b(4\d\d|5\d\d)\b|OPENROUTER_API_KEY|llm_providers|stack|endpoint|token/i;

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: 'pl',
    fallbackLng: 'en',
    resources: { pl: { translation: pl }, en: { translation: en } },
    interpolation: { escapeValue: false },
  });
});

const t = (key: string, dflt?: string) => i18n.t(key, { defaultValue: dflt }) as string;

describe('CHAT-OWN-016 — kod bledu -> zrozumiale zdanie', () => {
  it.each(KODY)('%s ma wlasne zdanie PL i wlasna podpowiedz dzialania', (kod) => {
    const copy = getAiErrorCopy(t, { errorCode: kod });
    expect(copy.code).toBe(kod);
    expect(copy.message.length).toBeGreaterThan(15);
    expect(copy.action.length).toBeGreaterThan(15);
    // Klucze musza byc realnie przetlumaczone, a nie zostac przy fallbacku EN.
    expect(copy.message).not.toBe(`aiChat.providerError`);
  });

  it('siedem kodow daje siedem roznych zdan (zero jednego ogolnika na wszystko)', () => {
    const zdania = new Set(KODY.map((k) => getAiErrorCopy(t, { errorCode: k }).message));
    expect(zdania.size).toBe(KODY.length);
  });

  it('zadne zdanie nie zawiera technikaliow', () => {
    for (const kod of KODY) {
      const linia = getAiErrorLine(t, { errorCode: kod });
      expect(TECHNIKALIA.test(linia), `technikalia w komunikacie ${kod}: ${linia}`).toBe(false);
    }
  });

  it('klucze istnieja i sa przetlumaczone w OBU jezykach, a PL rozni sie od EN', async () => {
    for (const kod of KODY) {
      const slug = getAiErrorCopy(t, { errorCode: kod });
      await i18n.changeLanguage('pl');
      const plCopy = getAiErrorCopy(t, { errorCode: kod });
      await i18n.changeLanguage('en');
      const enCopy = getAiErrorCopy(t, { errorCode: kod });
      await i18n.changeLanguage('pl');
      expect(plCopy.message, `brak tlumaczenia PL dla ${kod}`).not.toBe(enCopy.message);
      expect(plCopy.action, `brak tlumaczenia PL dla ${kod}`).not.toBe(enCopy.action);
      expect(slug.code).toBe(kod);
    }
  });
});

describe('CHAT-OWN-016 — stare kody serwera tez daja zrozumiale zdanie', () => {
  it.each([
    ['RATE_LIMIT', 'AI_RATE_LIMIT'],
    ['CIRCUIT_OPEN', 'AI_UNAVAILABLE'],
    ['NO_LLM_PROVIDER', 'AI_CONFIG'],
    ['INVALID_API_KEY', 'AI_CONFIG'],
    ['EMPTY_STREAM', 'AI_EMPTY'],
    ['PARTIAL_RECOVERY_NOT_FOUND', 'AI_STREAM_INTERRUPTED'],
    ['AI_STREAM_ERROR', 'AI_ERROR'],
    ['cos-czego-nie-znamy', 'AI_ERROR'],
  ])('%s -> %s', (stary, kanoniczny) => {
    expect(readAiErrorCode({ code: stary })).toBe(kanoniczny);
  });

  it('errorCode ma pierwszenstwo przed starym code', () => {
    expect(readAiErrorCode({ errorCode: 'AI_RATE_LIMIT', code: 'AI_STREAM_ERROR' })).toBe(
      'AI_RATE_LIMIT'
    );
  });
});

describe('CHAT-OWN-016 — widok komunikatu', () => {
  const renderNotice = (props: React.ComponentProps<typeof AiProviderErrorNotice>) =>
    render(
      <I18nextProvider i18n={i18n}>
        <AiProviderErrorNotice {...props} />
      </I18nextProvider>
    );

  it('pokazuje zdanie i podpowiedz dzialania', () => {
    renderNotice({ source: { errorCode: 'AI_RATE_LIMIT' } });
    const copy = getAiErrorCopy(t, { errorCode: 'AI_RATE_LIMIT' });
    expect(screen.getByText(copy.message)).toBeTruthy();
    expect(screen.getByText(copy.action)).toBeTruthy();
  });

  it('uzywa tokenow semantyki, NIGDY primary-* (primary = crimson marki)', () => {
    const { container: przejsciowy } = renderNotice({ source: { errorCode: 'AI_RATE_LIMIT' } });
    const klasyPrzejsciowe = przejsciowy.querySelector('[data-testid="ai-provider-error-notice"]')!
      .className;
    expect(klasyPrzejsciowe).toContain('c-warning');
    expect(klasyPrzejsciowe).not.toMatch(/primary-/);

    const { container: trwaly } = renderNotice({ source: { errorCode: 'AI_CONFIG' } });
    const klasyTrwale = trwaly.querySelector('[data-testid="ai-provider-error-notice"]')!.className;
    expect(klasyTrwale).toContain('c-danger');
    expect(klasyTrwale).not.toMatch(/primary-/);

    expect(przejsciowy.innerHTML).not.toMatch(/\bprimary-\d/);
    expect(trwaly.innerHTML).not.toMatch(/\bprimary-\d/);
  });

  it('diagnostyka administratora pokazuje sie WYLACZNIE gdy zostala podana', () => {
    const { container: bez } = renderNotice({ source: { errorCode: 'AI_ERROR' } });
    expect(bez.textContent).not.toMatch(/HTTP 502/);

    renderNotice({
      source: { errorCode: 'AI_ERROR' },
      adminDiagnostic: 'HTTP 502 · AI_STREAM_ERROR · Circuit [openrouter] is OPEN',
    });
    expect(screen.getByText(/Circuit \[openrouter\]/)).toBeTruthy();
  });

  it('zwykly uzytkownik nie widzi zadnych technikaliow', () => {
    for (const kod of KODY) {
      const { container } = renderNotice({ source: { errorCode: kod } });
      const widoczne = container.textContent || '';
      expect(TECHNIKALIA.test(widoczne), `technikalia widoczne dla ${kod}: ${widoczne}`).toBe(false);
    }
  });
});
