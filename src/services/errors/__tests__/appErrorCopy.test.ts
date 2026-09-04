import { cleanup, render, screen } from '@testing-library/react';
import i18n from 'i18next';
import React from 'react';
import { initReactI18next } from 'react-i18next';
import { I18nextProvider } from 'react-i18next';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', async () => await vi.importActual('react-i18next'));

import en from '../../../../public/locales/en/translation.json';
import pl from '../../../../public/locales/pl/translation.json';
import { ErrorState } from '../../../components/ui/primitives/ErrorState';
import { getAppErrorCopy, getAppErrorLine, readAppErrorCode } from '../appErrorCopy';

const CODES = [
  'NOT_FOUND',
  'VALIDATION',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'CONFLICT',
  'DB_ERROR',
  'INTERNAL',
] as const;

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: 'pl',
    fallbackLng: 'en',
    resources: { pl: { translation: pl }, en: { translation: en } },
    interpolation: { escapeValue: false },
  });
});

describe('DAY316 widoczny komunikat aplikacyjny', () => {
  it.each(['NOT_FOUND', 'FORBIDDEN', 'INTERNAL'] as const)(
    '%s renderuje polskie zdanie i identyfikator zgłoszenia',
    (errorCode) => {
      cleanup();
      const correlationId = `corr-${errorCode.toLowerCase()}-316`;
      const copy = getAppErrorCopy(t, { errorCode, correlationId });
      render(
        React.createElement(
          I18nextProvider,
          { i18n },
          React.createElement(ErrorState, { source: { errorCode, correlationId } })
        )
      );

      expect(screen.getByText(copy.message)).toBeTruthy();
      expect(screen.getByText(copy.action)).toBeTruthy();
      expect(screen.getByText(`Identyfikator zgłoszenia: ${correlationId}`)).toBeTruthy();
      expect(document.body.textContent).not.toContain('raw-server-message-do-not-show');
    }
  );
});

const t = (key: string, fallback?: string) => i18n.t(key, { defaultValue: fallback }) as string;

describe('DAY316 app error copy', () => {
  it.each(CODES)('%s ma własne polskie zdanie i działanie', (code) => {
    const copy = getAppErrorCopy(t, { errorCode: code });
    expect(copy.code).toBe(code);
    expect(copy.message.length).toBeGreaterThan(15);
    expect(copy.action.length).toBeGreaterThan(15);
    expect(copy.message).not.toMatch(/Something went wrong|could not|do not have/i);
  });

  it('siedem kodów daje siedem różnych polskich zdań', () => {
    expect(new Set(CODES.map((code) => getAppErrorCopy(t, { errorCode: code }).message)).size).toBe(
      CODES.length
    );
  });

  it('nieznany kod nie trafia do tekstu i bezpiecznie przechodzi na INTERNAL', () => {
    expect(readAppErrorCode({ errorCode: 'FEATURE_UNAVAILABLE' })).toBe('INTERNAL');
    expect(getAppErrorLine(t, { errorCode: 'FEATURE_UNAVAILABLE' })).not.toContain(
      'FEATURE_UNAVAILABLE'
    );
  });

  it('czyta kopertę axios i pokazuje identyfikator zgłoszenia', () => {
    const line = getAppErrorLine(t, {
      response: { data: { errorCode: 'FORBIDDEN', correlationId: 'corr-day316-001' } },
    });
    expect(line).toContain('Identyfikator zgłoszenia: corr-day316-001');
  });

  it('wartości PL różnią się od EN dla wszystkich kodów', async () => {
    for (const code of CODES) {
      await i18n.changeLanguage('pl');
      const polish = getAppErrorCopy(t, { errorCode: code });
      await i18n.changeLanguage('en');
      const english = getAppErrorCopy(t, { errorCode: code });
      expect(polish.message).not.toBe(english.message);
      expect(polish.action).not.toBe(english.action);
    }
    await i18n.changeLanguage('pl');
  });
});
