import i18next, { type i18n } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import plTranslation from '../../../../public/locales/pl/translation.json';
import {
  CANVAS_AI_MESSAGE_MAX_LENGTH,
  requestCanvasQuickAI,
} from '../CanvasEditor/CanvasRichEditor';

vi.unmock('react-i18next');

const polishTooLong =
  'Zaznaczony tekst jest za długi dla tej akcji AI. Skróć zaznaczenie i spróbuj ponownie.';

describe('day374 Canvas too-long Polish translation', () => {
  let testI18n: i18n;

  beforeAll(async () => {
    testI18n = i18next.createInstance();
    await testI18n.use(initReactI18next).init({
      lng: 'pl',
      fallbackLng: false,
      resources: { pl: { translation: plTranslation } },
      interpolation: { escapeValue: false },
    });
  });

  it('resolves canvas.aiMenu.tooLong without the English fallback', () => {
    expect(testI18n.t('canvas.aiMenu.tooLong')).toBe(polishTooLong);
    expect(testI18n.t('canvas.aiMenu.tooLong')).not.toContain('too long for this AI action');
  });

  it('returns the Polish errorLine from the real request boundary', async () => {
    const result = await requestCanvasQuickAI({
      prompt: 'Skróć',
      selectedText: 'x'.repeat(CANVAS_AI_MESSAGE_MAX_LENGTH),
      t: testI18n.t.bind(testI18n),
      language: 'pl',
    });
    expect(result).toEqual({ ok: false, reason: 'too_long', errorLine: polishTooLong });
  });
});
