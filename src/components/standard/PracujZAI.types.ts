/**
 * PracujZAI.types — kontrakt JEDNEJ struktury sterowania AI w karcie N.
 *
 * SSOT: `docs/ssot/STEROWANIE_KART_N_I_AI.md` Zasada 3 (DEC-407, 2026-09-06).
 * Trzy pozycje, zawsze te same, w każdej karcie: Analizuj · Uzupełnij tę sekcję ·
 * Uzupełnij cały dokument. Karta DEKLARUJE, co pod nimi stoi; komponent NARZUCA
 * nazwy, kolejność, uprawnienia i zakaz zapisu bez „Zatwierdź".
 */

import type { FormatWyjsciaAI, KontekstArtefaktuAI } from '@/services/ai/generujTrescPola';

export type { FormatWyjsciaAI, KontekstArtefaktuAI };

/**
 * Pole karty, które „Uzupełnij…" może zaproponować wypełnić.
 *
 * `wartosc` jest tu po to, żeby komponent mógł wykonać regułę SSOT „sekcje
 * wypełnione przez człowieka NIE są nadpisywane bez pytania": pola z niepustą
 * treścią są POMIJANE, a użytkownik dostaje o tym jawną informację w podglądzie.
 */
export interface PoleDoUzupelnienia {
  /** Id pola w karcie — wraca do `zastosuj()`. */
  id: string;
  /** Czytelna etykieta (idzie do promptu i do podglądu propozycji). */
  etykieta: string;
  /** Aktualna treść pola. Niepusta ⇒ pole pomijamy. */
  wartosc: string;
  /** Oczekiwany kształt wyniku (lista / jedno zdanie / akapit). */
  format?: FormatWyjsciaAI;
  /** Sekcja, z której pole pochodzi — grupuje podgląd „cały dokument". */
  sekcjaId?: string;
  sekcjaEtykieta?: string;
}

/** Zakres pytania o pola: pojedyncza sekcja albo cała karta. */
export interface ZakresUzupelnienia {
  sekcjaId: string | null;
  caly: boolean;
}

export type ZrodloPol = (zakres: ZakresUzupelnienia) => PoleDoUzupelnienia[];

/**
 * Skąd karta bierze uzupełnienie. Dwa uczciwe warianty — trzeciego nie ma:
 *
 *  · `pola` — karta oddaje LISTĘ PÓL i JEDNĄ drogę zapisu. Komponent generuje
 *    treść istniejącym generatorem (`generujTrescPola`), pokazuje propozycję
 *    i woła `zastosuj` DOPIERO po kliknięciu „Zatwierdź".
 *
 *  · `wlasnaPropozycja` — karta ma WŁASNY, już istniejący mechanizm propozycji
 *    (np. sekcje w stanie `ai-draft` z akcją „✓ Zaakceptuj", panel „Propozycje
 *    Teresy"). Komponent nie zna jej pól; pyta człowieka o zgodę na uruchomienie
 *    i oddaje robotę karcie. `opis` mówi, gdzie propozycja się pojawi — bez tego
 *    użytkownik nie wie, czego szukać.
 *
 * Brak wpisu (undefined) ⇒ pozycja renderuje się WYSZARZONA z tytułem
 * „Brak generatora dla tej karty". Nie budujemy nowych generatorów AI.
 */
export type ZrodloUzupelnienia =
  | {
      rodzaj: 'pola';
      pola: ZrodloPol;
      /** Zapis JEDNEGO pola. `false` ⇒ podgląd oznaczy pozycję jako nieudaną. */
      zastosuj: (poleId: string, wartosc: string) => boolean;
    }
  | {
      rodzaj: 'wlasnaPropozycja';
      uruchom: () => void | Promise<void>;
      opis: string;
    };

/** Stan wejścia AI pokazywany na przycisku. */
export type PracujZAIStan = 'bezczynny' | 'wToku' | 'blad';

export interface PracujZAIProps {
  /**
   * „Analizuj" — dzisiejsza ścieżka „Analizuj z AI" tej karty. Ocena, NIE zapis.
   * Wymagana: to jedyna pozycja dostępna bez prawa edycji (Zasada 2b).
   */
  onAnalizuj: () => void;
  /** Analiza w toku — przycisk pokazuje spinner. */
  analizaWToku?: boolean;
  /** Panel analizy otwarty (`aria-expanded` przycisku). */
  analizaOtwarta?: boolean;

  /** Źródło „Uzupełnij tę sekcję". Brak ⇒ pozycja wyszarzona. */
  uzupelnijSekcje?: ZrodloUzupelnienia;
  /** Źródło „Uzupełnij cały dokument". Brak ⇒ pozycja wyszarzona. */
  uzupelnijDokument?: ZrodloUzupelnienia;

  /** Id aktywnej sekcji (Menu 5 / lewy spis). `null` ⇒ „Uzupełnij tę sekcję" nieaktywne. */
  aktywnaSekcja?: string | null;
  /** Kontekst artefaktu do promptu generatora. */
  kontekstArtefaktu: KontekstArtefaktuAI;

  /**
   * Zasada 2b: gdy `false`, pozycje „Uzupełnij…" NIE RENDERUJĄ SIĘ (nie są
   * „wyszarzone" — ich nie ma). Zostaje wyłącznie „Analizuj".
   */
  moznaEdytowac: boolean;
  /** Powód braku prawa edycji — pokazywany w liście jako jedno zdanie. */
  powodTylkoOdczyt?: string;

  /** Całe wejście AI niedostępne (np. wyczerpany budżet / brak licencji). */
  disabled?: boolean;
  /** Tytuł tłumaczący `disabled`. */
  disabledTytul?: string;

  isPolish?: boolean;
  className?: string;

  /**
   * Wstrzykiwany generator — WYŁĄCZNIE dla testów. Produkcyjnie zostaje
   * `generujTrescPola` (istniejąca ścieżka `/ai/refine-text`, tryb `generate`).
   */
  generuj?: (opts: {
    etykietaPola: string;
    kontekstArtefaktu: KontekstArtefaktuAI;
    format?: FormatWyjsciaAI;
  }) => Promise<string>;
}
