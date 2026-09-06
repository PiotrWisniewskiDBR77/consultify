// @vitest-environment jsdom

/**
 * DEC-425 (właściciel, 2026-09-06, 1.1-M-3): trasy `/meetings/**` renderują
 * ten neutralny ekran zamiast `MeetingHub`/`MeetingObjectPage` dopóki
 * `VITE_MODULE_MEETINGS` jest OFF (domyślnie — patrz `meetingsModuleFlag.ts`,
 * wiązanie w `AppRoutes.tsx`, i source-slice test
 * `src/routes/__tests__/meetingsCanonicalRoute.test.ts`).
 *
 * Ten plik dowodzi RENDEROWANEGO zachowania (nie tylko obecności komponentu
 * w źródle): realny i18next z prawdziwymi `public/locales/{pl,en}/
 * translation.json` (nie mock zwracający klucz/fallback — tamten przeszedłby
 * nawet gdyby tłumaczenie było zepsute), po polsku i po angielsku, oraz
 * kliknięcie „Wróć do Czatu” nawiguje na ROUTES.AI_CHAT (`/chat`), identycznie
 * jak `NotFoundPage`.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18next, { type i18n } from 'i18next';
import React from 'react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import enTranslation from '../../../../public/locales/en/translation.json';
import plTranslation from '../../../../public/locales/pl/translation.json';
import { MeetingsWave2Placeholder } from '../MeetingsWave2Placeholder';

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
          <Route path="/meetings" element={<MeetingsWave2Placeholder />} />
          <Route path="/chat" element={<div data-testid="chat-landed">chat</div>} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>
  );
}

describe('MeetingsWave2Placeholder (DEC-425)', () => {
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

  it('renderuje polski nagłówek "Spotkania — planowane w Fali 2" (realne tłumaczenie, nie fallback)', () => {
    testI18n.changeLanguage('pl');
    renderAt(testI18n);
    expect(screen.getByText('Spotkania — planowane w Fali 2')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Ten moduł nie wchodzi jeszcze do MVP. Wracamy do niego w kolejnej fali rozwoju.'
      )
    ).toBeInTheDocument();
  });

  it('renderuje angielski nagłówek "Meetings — planned for Wave 2"', async () => {
    await testI18n.changeLanguage('en');
    renderAt(testI18n);
    expect(screen.getByText('Meetings — planned for Wave 2')).toBeInTheDocument();
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
