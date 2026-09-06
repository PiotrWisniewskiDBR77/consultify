/**
 * PracujZAI — bramki DEC-407 (Zasada 2b + zakaz zapisu bez „Zatwierdź").
 *
 * Dwa testy są MUTACYJNE: celują w zabezpieczenie, nie w mechanizm.
 *  (a) skasowanie bramki `if (!moznaEdytowac) return lista` w `pozycjeMenu`
 *      ⇒ „Uzupełnij…" pojawia się bez prawa edycji ⇒ test „bez prawa edycji"
 *      musi paść.
 *  (b) wywołanie `zrodlo.zastosuj(...)` w pętli generowania (zamiast dopiero
 *      w `zatwierdz`) ⇒ karta dostaje treść bez kliknięcia ⇒ test
 *      „nic bez Zatwierdź" musi paść.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { PracujZAI } from '../PracujZAI';
import type { PoleDoUzupelnienia } from '../PracujZAI.types';

// Mock CAŁEGO modułu i18n: `generujTrescPola` ciągnie `@/services/api`, a ten
// importuje `src/i18n.ts`, który potrzebuje `initReactI18next`.
vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  I18nextProvider: ({ children }: { children: React.ReactNode }) => children,
  Trans: ({ children }: { children: React.ReactNode }) => children,
  useTranslation: () => ({
    t: (_key: string, fallback?: unknown, opcje?: Record<string, unknown>) => {
      const tekst = typeof fallback === 'string' ? fallback : _key;
      return opcje
        ? tekst.replace(/\{\{(\w+)\}\}/g, (_m, k) => String(opcje[k] ?? ''))
        : tekst;
    },
  }),
}));

const POLA: PoleDoUzupelnienia[] = [
  { id: 'opis', etykieta: 'Opis i zakres', wartosc: '', sekcjaEtykieta: 'Opis' },
  { id: 'rezultat', etykieta: 'Oczekiwany rezultat', wartosc: 'napisane ręcznie' },
];

function zamontuj(nadpisania: Partial<React.ComponentProps<typeof PracujZAI>> = {}) {
  const zastosuj = vi.fn(() => true);
  const onAnalizuj = vi.fn();
  const generuj = vi.fn(async () => 'treść z AI');
  const utils = render(
    <PracujZAI
      onAnalizuj={onAnalizuj}
      aktywnaSekcja="description-scope"
      kontekstArtefaktu={{ type: 'task', title: 'Zadanie testowe' }}
      moznaEdytowac
      isPolish
      generuj={generuj}
      uzupelnijSekcje={{ rodzaj: 'pola', pola: () => POLA, zastosuj }}
      uzupelnijDokument={{ rodzaj: 'pola', pola: () => POLA, zastosuj }}
      {...nadpisania}
    />
  );
  return { ...utils, zastosuj, onAnalizuj, generuj };
}

const otworzListe = () => fireEvent.click(screen.getByTestId('pracuj-z-ai'));

describe('PracujZAI — jedna struktura sterowania AI (DEC-407)', () => {
  it('pokazuje trzy pozycje o tych samych nazwach, w kolejności SSOT', () => {
    zamontuj();
    otworzListe();
    const pozycje = screen.getAllByRole('menuitem').map((n) => n.textContent);
    expect(pozycje).toEqual(['Analizuj', 'Uzupełnij tę sekcję', 'Uzupełnij cały dokument']);
  });

  it('„Analizuj" woła dzisiejszą ścieżkę karty i niczego nie zapisuje', () => {
    const { onAnalizuj, zastosuj } = zamontuj();
    otworzListe();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Analizuj' }));
    expect(onAnalizuj).toHaveBeenCalledTimes(1);
    expect(zastosuj).not.toHaveBeenCalled();
  });

  // ── MUTACJA (a) — Zasada 2b ──────────────────────────────────────────────
  it('bez prawa edycji renderuje WYŁĄCZNIE „Analizuj" (pozycji „Uzupełnij…" nie ma)', () => {
    zamontuj({ moznaEdytowac: false, powodTylkoOdczyt: 'karta zatwierdzona' });
    otworzListe();
    expect(screen.getAllByRole('menuitem')).toHaveLength(1);
    expect(screen.queryByRole('menuitem', { name: 'Uzupełnij tę sekcję' })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Uzupełnij cały dokument' })).toBeNull();
    expect(screen.getByTestId('pracuj-z-ai-tylko-odczyt').textContent).toContain(
      'karta zatwierdzona'
    );
  });

  it('bez generatora pozycja jest wyszarzona z tytułem „Brak generatora dla tej karty"', () => {
    zamontuj({ uzupelnijSekcje: undefined, uzupelnijDokument: undefined });
    otworzListe();
    const sekcja = screen.getByRole('menuitem', { name: 'Uzupełnij tę sekcję' });
    expect(sekcja.getAttribute('title')).toBe('Brak generatora dla tej karty');
    expect(sekcja).toBeDisabled();
    expect(screen.getByRole('menuitem', { name: 'Uzupełnij cały dokument' })).toBeDisabled();
  });

  // ── MUTACJA (b) — „nic bez Zatwierdź" ────────────────────────────────────
  it('„Uzupełnij cały dokument" NIE zapisuje niczego przed kliknięciem „Zatwierdź"', async () => {
    const { zastosuj, generuj } = zamontuj();
    otworzListe();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Uzupełnij cały dokument' }));

    await waitFor(() => expect(screen.getByTestId('pracuj-z-ai-zatwierdz')).toBeTruthy());
    // Generator zdążył się wykonać, propozycja jest na ekranie…
    expect(generuj).toHaveBeenCalled();
    expect(screen.getByTestId('pracuj-z-ai-propozycja').textContent).toContain('treść z AI');
    // …a mimo to karta NIE dostała ani jednego zapisu.
    expect(zastosuj).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('pracuj-z-ai-zatwierdz'));
    expect(zastosuj).toHaveBeenCalledTimes(1);
    expect(zastosuj).toHaveBeenCalledWith('opis', 'treść z AI');
  });

  it('„Odrzuć" zamyka podgląd i zostawia kartę bit w bit nietkniętą', async () => {
    const { zastosuj } = zamontuj();
    otworzListe();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Uzupełnij cały dokument' }));
    await waitFor(() => expect(screen.getByTestId('pracuj-z-ai-odrzuc')).toBeTruthy());
    fireEvent.click(screen.getByTestId('pracuj-z-ai-odrzuc'));
    expect(zastosuj).not.toHaveBeenCalled();
    expect(screen.queryByTestId('pracuj-z-ai-propozycja')).toBeNull();
  });

  it('pole wypełnione przez człowieka jest pomijane, nie nadpisywane', async () => {
    const { generuj } = zamontuj();
    otworzListe();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Uzupełnij tę sekcję' }));
    await waitFor(() => expect(screen.getByTestId('pracuj-z-ai-zatwierdz')).toBeTruthy());
    expect(generuj).toHaveBeenCalledTimes(1);
    expect(generuj).toHaveBeenCalledWith(
      expect.objectContaining({ etykietaPola: 'Opis i zakres' })
    );
    expect(screen.getByTestId('pracuj-z-ai-propozycja').textContent).toContain(
      'Oczekiwany rezultat'
    );
  });

  it('wariant „własna propozycja" pyta o zgodę i uruchamia dopiero po Zatwierdź', async () => {
    const uruchom = vi.fn();
    zamontuj({
      uzupelnijDokument: {
        rodzaj: 'wlasnaPropozycja',
        uruchom,
        opis: 'Sekcje dostaną stan „szkic AI" do akceptacji.',
      },
    });
    otworzListe();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Uzupełnij cały dokument' }));
    expect(uruchom).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('pracuj-z-ai-zatwierdz'));
    await waitFor(() => expect(uruchom).toHaveBeenCalledTimes(1));
  });

  it('nie używa tokenów primary (crimson) — akcent AI wyłącznie c-ai', () => {
    const { container } = zamontuj();
    otworzListe();
    const html = container.innerHTML + document.body.innerHTML;
    expect(html).not.toContain('primary-');
    expect(html).toContain('c-ai');
  });
});
