/**
 * BRAMA JĘZYKA POWŁOKI — test zachowania (paczka ZZ, 2026-09-09).
 *
 * Pytanie, na które ten test odpowiada: czy powłoka NAPRAWDĘ czeka, zanim
 * pomaluje pierwszy ekran w języku, którego jeszcze nie zna?
 *
 * Zmierzone PRZED naprawą (evidence/jezyk-jzz, scenariusz `wolne-locale`):
 * konto `users.language='en'` widziało polskie napisy powłoki, bo przy
 * `react.useSuspense: false` `t('klucz', 'Polski tekst')` oddaje wartość
 * domyślną Z KODU dopóki `en/translation.json` (1,9 MB) jest w drodze.
 *
 * Test symuluje dokładnie ten stan: i18next jest zainicjowany, ale zasób dla
 * aktywnego języka dochodzi z opóźnieniem. Brama ma być zamknięta do tego
 * momentu i otworzyć się, gdy zasób dojdzie — a gdy nie dojdzie wcale, otworzyć
 * się po twardym limicie czasu, żeby nie zrobić z siebie białego ekranu.
 */
import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const stanI18n = {
  isInitialized: true,
  language: 'en',
  resolvedLanguage: 'en',
  zasoby: new Set<string>(),
  sluchacze: new Map<string, Set<() => void>>(),
};

vi.mock('@/i18n', () => ({
  default: {
    get isInitialized() {
      return stanI18n.isInitialized;
    },
    get language() {
      return stanI18n.language;
    },
    get resolvedLanguage() {
      return stanI18n.resolvedLanguage;
    },
    hasResourceBundle: (lng: string, ns: string) => stanI18n.zasoby.has(`${lng}:${ns}`),
    on: (event: string, cb: () => void) => {
      if (!stanI18n.sluchacze.has(event)) stanI18n.sluchacze.set(event, new Set());
      stanI18n.sluchacze.get(event)!.add(cb);
    },
    off: (event: string, cb: () => void) => {
      stanI18n.sluchacze.get(event)?.delete(cb);
    },
  },
}));

/** Udaje dojście pliku tłumaczeń — dokładnie zdarzenie `loaded` z i18next. */
function zasobDoszedl(lng = 'en') {
  stanI18n.zasoby.add(`${lng}:translation`);
  for (const cb of stanI18n.sluchacze.get('loaded') || []) cb();
}

import {
  __resetAccountLanguageResolvedForTests,
  markAccountLanguageResolved,
  writeStoredAccountLanguage,
} from '@/services/accountLanguageStorage';
import { LIMIT_CZASU_MS, useLanguageBootReady } from '@/bootstrap/useLanguageBootReady';

const Powloka: React.FC = () => {
  const gotowe = useLanguageBootReady();
  return <div>{gotowe ? 'EKRAN' : 'CZEKA'}</div>;
};

describe('brama języka powłoki', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stanI18n.zasoby.clear();
    stanI18n.sluchacze.clear();
    stanI18n.isInitialized = true;
    stanI18n.language = 'en';
    stanI18n.resolvedLanguage = 'en';
    __resetAccountLanguageResolvedForTests();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it('zalogowane konto: nie maluje ekranu, dopóki zasób języka jest w drodze', () => {
    window.localStorage.setItem('token', 'jwt');
    writeStoredAccountLanguage('en');

    render(<Powloka />);
    // plik jeszcze nie doszedł — dokładnie ten moment, w którym t() oddawało
    // polskie wartości domyślne z kodu
    expect(screen.getByText('CZEKA')).toBeTruthy();

    act(() => {
      zasobDoszedl('en');
    });
    expect(screen.getByText('EKRAN')).toBeTruthy();
  });

  it('zalogowane konto bez zapamiętanego języka: czeka też na rozstrzygnięcie konta', () => {
    window.localStorage.setItem('token', 'jwt');
    stanI18n.zasoby.add('en:translation'); // zasób JEST, ale język konta nieznany

    render(<Powloka />);
    expect(screen.getByText('CZEKA')).toBeTruthy();

    act(() => {
      markAccountLanguageResolved();
    });
    expect(screen.getByText('EKRAN')).toBeTruthy();
  });

  it('brak zalogowania: nie czeka na konto, bo języka pilnuje przeglądarka', () => {
    stanI18n.zasoby.add('en:translation');
    render(<Powloka />);
    expect(screen.getByText('EKRAN')).toBeTruthy();
  });

  it('nie zamienia się w biały ekran: po twardym limicie przepuszcza render', () => {
    window.localStorage.setItem('token', 'jwt');
    // nic nie dochodzi: ani zasób, ani rozstrzygnięcie konta
    render(<Powloka />);
    expect(screen.getByText('CZEKA')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(LIMIT_CZASU_MS + 10);
    });
    expect(screen.getByText('EKRAN')).toBeTruthy();
  });
});
