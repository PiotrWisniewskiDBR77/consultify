// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18next, { type i18n } from 'i18next';
import React from 'react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import enTranslation from '../../../../public/locales/en/translation.json';
import plTranslation from '../../../../public/locales/pl/translation.json';
import { FinanceWave2Placeholder } from '../FinanceWave2Placeholder';

// `tests/setup.ts` globally mocks BOTH `react-i18next` (a fixed `t()` that
// always returns the English default-value string, ignoring any real
// I18nextProvider/language) AND `react-router-dom`'s `useNavigate` (a fresh
// no-op `vi.fn()` per call, so a real click never navigates). Both mocks
// exist for unrelated component tests across the suite — this file needs
// the REAL implementations to prove the actual translation.json keys
// resolve and the actual click navigates, so it opts out of both.
vi.unmock('react-i18next');
vi.unmock('react-router-dom');

function renderAt(testI18n: i18n) {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter initialEntries={['/meetings']}>
        <Routes>
          <Route path="/meetings" element={<FinanceWave2Placeholder />} />
          <Route path="/chat" element={<div data-testid="chat-landed">chat</div>} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>
  );
}

describe('FinanceWave2Placeholder (DEC-470)', () => {
  let testI18n: i18n;

  beforeAll(async () => {
    testI18n = i18next.createInstance();
    await testI18n.use(initReactI18next).init({
      lng: 'pl',
      fallbackLng: false,
      resources: {
        pl: { translation: plTranslation },
        en: { translation: enTranslation },
      },
      interpolation: { escapeValue: false },
    });
  });

  it('renderuje polski nagłówek "Finanse — Wkrótce" (realne tłumaczenie, nie fallback)', () => {
    testI18n.changeLanguage('pl');
    renderAt(testI18n);
    expect(screen.getByText('Finanse — Wkrótce')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Analizy finansowe, planowanie i wyceny pojawią się w Fali 2.'
      )
    ).toBeInTheDocument();
  });

  it('renderuje angielski nagłówek "Finance — Coming soon"', async () => {
    await testI18n.changeLanguage('en');
    renderAt(testI18n);
    expect(screen.getByText('Finance — Coming soon')).toBeInTheDocument();
    // Nie odwracamy języka tutaj: kolejny test i tak ustawia 'pl' PRZED
    // renderem, a zmiana języka na już-zamontowanym komponencie z tego testu
    // (przed jego automatycznym unmountem) powodowała ostrzeżenie act().
  });

  it('przycisk "Wróć do Czatu" nawiguje na /chat, nie zostawia na 404/wyjątku', async () => {
    await testI18n.changeLanguage('pl');
    renderAt(testI18n);
    await userEvent.click(screen.getByRole('button', { name: 'Wróć do Czatu' }));
    expect(screen.getByTestId('chat-landed')).toBeInTheDocument();
  });
});
