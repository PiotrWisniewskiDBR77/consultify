import { fireEvent, render, screen } from '@testing-library/react';
import i18next, { type i18n } from 'i18next';
import React from 'react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import plTranslation from '../../../../public/locales/pl/translation.json';
import { CanvasAIFloatingMenu } from '../CanvasEditor/CanvasAIFloatingMenu';

vi.unmock('react-i18next');

const expected = {
  'canvas.aiMenu.quickAction.expand': 'Rozwiń',
  'canvas.aiMenu.quickAction.shorten': 'Skróć',
  'canvas.aiMenu.quickAction.rewrite': 'Przepisz',
  'canvas.aiMenu.quickAction.final_polish': 'Doszlifuj',
  'canvas.aiMenu.quickAction.length_concise': 'Długość: zwięzła',
  'canvas.aiMenu.quickAction.length_detailed': 'Długość: rozbudowana',
  'canvas.aiMenu.quickAction.level_exec': 'Dla: zarządu',
  'canvas.aiMenu.quickAction.level_expert': 'Dla: eksperta',
  'canvas.aiMenu.quickAction.level_beginner': 'Dla: laika',
  'canvas.aiMenu.quickAction.translate_en': 'Tłumacz → EN',
  'canvas.aiMenu.quickAction.translate_pl': 'Tłumacz → PL',
  'canvas.aiMenu.tone.tone_formal': 'Formalny',
  'canvas.aiMenu.tone.tone_simple': 'Prostszy',
} as const;

describe('day372 Canvas AI menu Polish translations', () => {
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

  it('resolves all 13 labels without the English fallback', () => {
    for (const [key, value] of Object.entries(expected)) expect(testI18n.t(key)).toBe(value);
  });

  it('renders Polish quick actions and tone labels', async () => {
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', { configurable: true, value: () => ({
      top: 80, bottom: 100, left: 80, right: 100, width: 20, height: 20,
      x: 80, y: 80, toJSON: () => ({}),
    } as DOMRect) });
    const range = document.createRange();
    range.selectNodeContents(document.body);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    const { container } = render(
      <I18nextProvider i18n={testI18n}>
        <CanvasAIFloatingMenu
          editor={{} as never}
          selection={{ selectedText: 'tekst', from: 1, to: 6 }}
          onAIRequest={vi.fn()}
          isProcessing={false}
        />
      </I18nextProvider>
    );
    fireEvent.click(await screen.findByText('Akcje'));
    expect(container.textContent).toContain('Rozwiń');
    expect(container.textContent).not.toContain('Final polish');
    fireEvent.click(screen.getByText('Ton'));
    expect(container.textContent).toContain('Formalny');
    expect(container.textContent).not.toContain('Simpler');
  });
});
