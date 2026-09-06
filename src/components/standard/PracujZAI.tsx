/**
 * PracujZAI — JEDNA struktura sterowania AI na poziomie karty N.
 *
 * SSOT: `docs/ssot/STEROWANIE_KART_N_I_AI.md` Zasada 3 + Zasada 2b (DEC-407,
 * potwierdzona przez właściciela 2026-09-06). Słowa właściciela: „zamiast
 * analizy z AI: pracuj z AI (…) który będzie rozwijał listę — uzupełnienie
 * całości, uzupełnienie karty i analizę".
 *
 * ── DLACZEGO KOMPONENT, A NIE ZMIANA POWŁOKI ────────────────────────────────
 * `StandardArtifactShell` ma dziś DWÓCH konsumentów (CaseDetailScreen,
 * MeetingObjectPage), a wszystkie karty z `registry.ts` stoją na `NModeShell`
 * ze `statusMigracji: 'przed'` (pomiar 2026-09-06). Zmiana powłoki nie
 * dotknęłaby więc ANI JEDNEJ karty objętej DEC-407. Dlatego „Pracuj z AI" jest
 * jednym współdzielonym komponentem wstawianym do slotu `aiButton` Menu 5
 * (`NModeMenu2`) każdej karty — do powłoki wróci, gdy karty na nią przejdą.
 *
 * ── TRZY POZYCJE, ZAWSZE TE SAME ────────────────────────────────────────────
 *   Analizuj                 — ocenia kartę, NIE zmienia treści (ścieżka karty).
 *   Uzupełnij tę sekcję      — aktywna sekcja, propozycja do zatwierdzenia.
 *   Uzupełnij cały dokument  — wszystkie sekcje, JEDEN podgląd, JEDNO „Zatwierdź".
 * Nazwy są w komponencie, nie w karcie — sześć kart nie może ich nazwać sześć razy.
 *
 * ── ZAKAZ ZAPISU BEZ ZATWIERDZENIA (twardy) ─────────────────────────────────
 * `ZASADY_AI_TERESA_SSOT` §3: „AI proposes. User reviews. System executes
 * approved scope." Komponent NIE zna setterów karty. Jedyna droga zapisu to
 * `zastosuj()` z `ZrodloUzupelnienia`, wołane WYŁĄCZNIE z przycisku „Zatwierdź"
 * w podglądzie propozycji. Nie ma gałęzi, w której wynik generatora trafia do
 * karty bez kliknięcia człowieka — test mutacyjny w `__tests__` tego pilnuje.
 *
 * ── PRACA CZŁOWIEKA JEST NIETYKALNA ─────────────────────────────────────────
 * Pola z niepustą treścią są POMIJANE (nie nadpisujemy bez pytania) i widać to
 * w podglądzie jako jawny wiersz „pominięto — wypełnione przez człowieka".
 *
 * ZAKAZY KOLORYSTYCZNE (CLAUDE.md pułapka nr 1): zero `primary-*` (crimson),
 * akcent AI wyłącznie token `c-ai`, fokus wyłącznie `c-focus`.
 */

import { AlertTriangle, Check, ChevronDown, Loader2, Sparkles, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { generujTrescPola } from '@/services/ai/generujTrescPola';

import type {
  PoleDoUzupelnienia,
  PracujZAIProps,
  ZakresUzupelnienia,
  ZrodloUzupelnienia,
} from './PracujZAI.types';

export type {
  PoleDoUzupelnienia,
  PracujZAIProps,
  PracujZAIStan,
  ZakresUzupelnienia,
  ZrodloPol,
  ZrodloUzupelnienia,
} from './PracujZAI.types';

// ── Etykiety ────────────────────────────────────────────────────────────────
// Klucze `karta.pracujZAI.*` żyją w `public/locales/{pl,en}/translation.json`.
// Domyślna wartość przekazana do `t()` jest POLSKA, gdy UI jest polskie —
// brakujący klucz nie może wydrukować angielskiego słowa w polskiej karcie
// (lekcja „klucz istnieje ≠ przetłumaczony").
const L = {
  przycisk: { pl: 'Pracuj z AI', en: 'Work with AI' },
  menu: { pl: 'Pracuj z AI — lista działań', en: 'Work with AI — actions' },
  analizuj: { pl: 'Analizuj', en: 'Analyze' },
  analizujTytul: {
    pl: 'Ocena karty: co jest wypełnione, czego brakuje, co jest słabe. Nie zmienia treści.',
    en: 'Card review: what is filled in, what is missing, what is weak. Changes nothing.',
  },
  uzupelnijSekcje: { pl: 'Uzupełnij tę sekcję', en: 'Fill in this section' },
  uzupelnijDokument: { pl: 'Uzupełnij cały dokument', en: 'Fill in the whole document' },
  brakGeneratora: { pl: 'Brak generatora dla tej karty', en: 'No generator for this card' },
  brakAktywnejSekcji: { pl: 'Najpierw wybierz sekcję', en: 'Select a section first' },
  tylkoOdczyt: { pl: 'Tylko do odczytu', en: 'Read-only' },
  propozycja: { pl: 'Propozycja AI', en: 'AI proposal' },
  zbieranie: { pl: 'AI przygotowuje propozycję…', en: 'AI is preparing a proposal…' },
  zatwierdz: { pl: 'Zatwierdź', en: 'Approve' },
  odrzuc: { pl: 'Odrzuć', en: 'Discard' },
  zamknij: { pl: 'Zamknij', en: 'Close' },
  brakPol: {
    pl: 'Nie ma tu pustych pól do uzupełnienia — wszystko jest już wypełnione.',
    en: 'There are no empty fields to fill in here — everything is already filled.',
  },
  pominiete: {
    pl: 'Pominięto (wypełnione przez człowieka)',
    en: 'Skipped (filled in by a human)',
  },
  nieudane: { pl: 'Nie udało się wygenerować', en: 'Could not generate' },
  nicNiewybrane: { pl: 'Nie wybrano żadnej propozycji.', en: 'No proposal selected.' },
  zgodaTytul: { pl: 'Uruchomić AI?', en: 'Run AI?' },
  postep: { pl: 'Pole {{i}} z {{n}}', en: 'Field {{i}} of {{n}}' },
} as const;

type Para = { pl: string; en: string };
const wybierz = (para: Para, pl: boolean) => (pl ? para.pl : para.en);

/** Wspólna baza przycisku paska — 1:1 z `NModeMenu2.BTN_BASE`. */
const BTN_BASE =
  'inline-flex shrink-0 items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium transition-colors ' +
  'disabled:opacity-40 disabled:cursor-not-allowed ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus';

// ── Model podglądu propozycji ───────────────────────────────────────────────

interface Propozycja {
  poleId: string;
  etykieta: string;
  sekcjaEtykieta?: string;
  tresc: string;
  wybrana: boolean;
}

interface NieudaneGenerowanie {
  etykieta: string;
  powod: string;
}

type StanPanelu =
  | { faza: 'zamkniety' }
  | { faza: 'zgoda'; opis: string; uruchom: () => void | Promise<void> }
  | { faza: 'zbieranie'; zrobione: number; wszystkie: number }
  | {
      faza: 'gotowa';
      propozycje: Propozycja[];
      pominiete: string[];
      nieudane: NieudaneGenerowanie[];
    }
  | { faza: 'pusto'; pominiete: string[] };

/** Powód niepowodzenia bez „coś poszło nie tak" — kod z backendu albo message. */
function powodBledu(err: unknown): string {
  const kod =
    (err as { data?: { code?: string } })?.data?.code ||
    (err as { code?: string })?.code ||
    (err as Error)?.message ||
    '';
  return String(kod);
}

export const PracujZAI: React.FC<PracujZAIProps> = ({
  onAnalizuj,
  analizaWToku = false,
  analizaOtwarta = false,
  uzupelnijSekcje,
  uzupelnijDokument,
  aktywnaSekcja = null,
  kontekstArtefaktu,
  moznaEdytowac,
  powodTylkoOdczyt,
  disabled = false,
  disabledTytul,
  isPolish = false,
  className = '',
  generuj = generujTrescPola,
}) => {
  const { t } = useTranslation();
  const [otwarte, setOtwarte] = useState(false);
  const [panel, setPanel] = useState<StanPanelu>({ faza: 'zamkniety' });
  const [pozycja, setPozycja] = useState<{ top: number; right: number } | null>(null);
  const przyciskRef = useRef<HTMLButtonElement>(null);
  /** Numer przebiegu — odpowiedź na porzucony przebieg nie wchodzi do panelu. */
  const przebiegRef = useRef(0);
  const zywyRef = useRef(true);
  useEffect(() => {
    zywyRef.current = true;
    return () => {
      zywyRef.current = false;
    };
  }, []);

  const et = useCallback(
    (klucz: keyof typeof L) => t(`karta.pracujZAI.${klucz}`, wybierz(L[klucz], isPolish)),
    [t, isPolish]
  );

  // Pozycja listy liczona z przycisku (portal + `fixed`) — ten sam wzorzec, co
  // kebab Menu 1 (`NModeHeader`), żeby lista nie była przycinana przez
  // `overflow-hidden` paska ani przez sticky-stos nagłówków.
  useEffect(() => {
    if (!otwarte) return;
    const zmierz = () => {
      const r = przyciskRef.current?.getBoundingClientRect();
      if (!r) return;
      setPozycja({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
    };
    zmierz();
    window.addEventListener('resize', zmierz);
    window.addEventListener('scroll', zmierz, true);
    return () => {
      window.removeEventListener('resize', zmierz);
      window.removeEventListener('scroll', zmierz, true);
    };
  }, [otwarte]);

  useEffect(() => {
    if (!otwarte) return;
    const naKlawisz = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOtwarte(false);
    };
    document.addEventListener('keydown', naKlawisz);
    return () => document.removeEventListener('keydown', naKlawisz);
  }, [otwarte]);

  // Zmiana aktywnej sekcji unieważnia trwający przebieg — propozycja dla sekcji A
  // pokazana pod nagłówkiem sekcji B byłaby kłamstwem (wzorzec `useCardAIAnalysis`).
  useEffect(() => {
    przebiegRef.current += 1;
    setPanel({ faza: 'zamkniety' });
  }, [aktywnaSekcja]);

  const zamknijPanel = useCallback(() => {
    przebiegRef.current += 1;
    setPanel({ faza: 'zamkniety' });
  }, []);

  // ── Uruchomienie „Uzupełnij…" ─────────────────────────────────────────────
  const uruchomUzupelnienie = useCallback(
    async (zrodlo: ZrodloUzupelnienia, zakres: ZakresUzupelnienia) => {
      setOtwarte(false);

      if (zrodlo.rodzaj === 'wlasnaPropozycja') {
        // Karta ma własny mechanizm propozycji — pytamy o zgodę na uruchomienie
        // i oddajemy jej robotę. Nadal NIC nie dzieje się bez kliknięcia.
        setPanel({ faza: 'zgoda', opis: zrodlo.opis, uruchom: zrodlo.uruchom });
        return;
      }

      const przebieg = ++przebiegRef.current;
      const wszystkiePola = zrodlo.pola(zakres);
      const pominiete = wszystkiePola
        .filter((p) => p.wartosc.trim().length > 0)
        .map((p) => p.etykieta);
      const doUzupelnienia = wszystkiePola.filter((p) => p.wartosc.trim().length === 0);

      if (doUzupelnienia.length === 0) {
        setPanel({ faza: 'pusto', pominiete });
        return;
      }

      setPanel({ faza: 'zbieranie', zrobione: 0, wszystkie: doUzupelnienia.length });

      const propozycje: Propozycja[] = [];
      const nieudane: NieudaneGenerowanie[] = [];

      for (const [i, pole] of doUzupelnienia.entries()) {
        if (!zywyRef.current || przebiegRef.current !== przebieg) return;
        try {
          const tresc = await generuj({
            etykietaPola: pole.etykieta,
            kontekstArtefaktu,
            format: pole.format,
          });
          propozycje.push({
            poleId: pole.id,
            etykieta: pole.etykieta,
            sekcjaEtykieta: pole.sekcjaEtykieta,
            tresc,
            wybrana: true,
          });
        } catch (err) {
          // „AI niedostępne" to poprawny wynik — mówimy powód, nie podstawiamy treści.
          nieudane.push({ etykieta: pole.etykieta, powod: powodBledu(err) });
        }
        if (!zywyRef.current || przebiegRef.current !== przebieg) return;
        setPanel({ faza: 'zbieranie', zrobione: i + 1, wszystkie: doUzupelnienia.length });
      }

      if (!zywyRef.current || przebiegRef.current !== przebieg) return;
      setPanel({ faza: 'gotowa', propozycje, pominiete, nieudane });
    },
    [generuj, kontekstArtefaktu]
  );

  /**
   * JEDYNE miejsce zapisu w tym komponencie. Wołane wyłącznie z „Zatwierdź".
   * Nie ma drugiego wywołania `zastosuj` w pliku — to jest ta bramka.
   */
  const zatwierdz = useCallback(
    (zrodlo: ZrodloUzupelnienia | undefined) => {
      if (!zrodlo || zrodlo.rodzaj !== 'pola') return;
      if (panel.faza !== 'gotowa') return;
      panel.propozycje
        .filter((p) => p.wybrana)
        .forEach((p) => {
          zrodlo.zastosuj(p.poleId, p.tresc);
        });
      zamknijPanel();
    },
    [panel, zamknijPanel]
  );

  /** Które źródło obsługuje aktualnie otwarty podgląd. */
  const [aktywneZrodlo, setAktywneZrodlo] = useState<ZrodloUzupelnienia | undefined>(undefined);

  const klikSekcja = useCallback(() => {
    if (!uzupelnijSekcje || !aktywnaSekcja) return;
    setAktywneZrodlo(uzupelnijSekcje);
    void uruchomUzupelnienie(uzupelnijSekcje, { sekcjaId: aktywnaSekcja, caly: false });
  }, [uzupelnijSekcje, aktywnaSekcja, uruchomUzupelnienie]);

  const klikDokument = useCallback(() => {
    if (!uzupelnijDokument) return;
    setAktywneZrodlo(uzupelnijDokument);
    void uruchomUzupelnienie(uzupelnijDokument, { sekcjaId: aktywnaSekcja, caly: true });
  }, [uzupelnijDokument, aktywnaSekcja, uruchomUzupelnienie]);

  const pozycjeMenu = useMemo(() => {
    const lista: Array<{
      id: string;
      etykieta: string;
      tytul: string;
      onClick?: () => void;
      wylaczona: boolean;
      powodWylaczenia?: string;
    }> = [
      {
        id: 'analizuj',
        etykieta: et('analizuj'),
        tytul: et('analizujTytul'),
        onClick: onAnalizuj,
        wylaczona: false,
      },
    ];

    // ── Zasada 2b: bez prawa edycji pozycje „Uzupełnij…" NIE RENDERUJĄ SIĘ ──
    // (nie „wyszarzone" — ich po prostu nie ma; słowa właściciela: „jeżeli ktoś
    // nie ma uprawnień do edycji, to ten przycisk pośrodku nie ma sensu").
    if (!moznaEdytowac) return lista;

    lista.push({
      id: 'uzupelnij-sekcje',
      etykieta: et('uzupelnijSekcje'),
      tytul: !uzupelnijSekcje
        ? et('brakGeneratora')
        : !aktywnaSekcja
          ? et('brakAktywnejSekcji')
          : et('uzupelnijSekcje'),
      onClick: klikSekcja,
      wylaczona: !uzupelnijSekcje || !aktywnaSekcja,
      powodWylaczenia: !uzupelnijSekcje ? et('brakGeneratora') : et('brakAktywnejSekcji'),
    });

    lista.push({
      id: 'uzupelnij-dokument',
      etykieta: et('uzupelnijDokument'),
      tytul: uzupelnijDokument ? et('uzupelnijDokument') : et('brakGeneratora'),
      onClick: klikDokument,
      wylaczona: !uzupelnijDokument,
      powodWylaczenia: et('brakGeneratora'),
    });

    return lista;
  }, [
    et,
    onAnalizuj,
    moznaEdytowac,
    uzupelnijSekcje,
    uzupelnijDokument,
    aktywnaSekcja,
    klikSekcja,
    klikDokument,
  ]);

  const etykietaPrzycisku = et('przycisk');

  return (
    <>
      <button
        ref={przyciskRef}
        type="button"
        data-menu2-slot="ai"
        data-testid="pracuj-z-ai"
        aria-label={etykietaPrzycisku}
        aria-haspopup="menu"
        aria-expanded={otwarte || analizaOtwarta}
        title={disabled ? (disabledTytul ?? etykietaPrzycisku) : etykietaPrzycisku}
        disabled={disabled}
        onClick={() => setOtwarte((v) => !v)}
        className={`${BTN_BASE} border border-c-ai/40 bg-c-ai/10 text-c-ai hover:bg-c-ai/15 ${className}`}
      >
        {analizaWToku || panel.faza === 'zbieranie' ? (
          <Loader2 size={13} className="animate-spin shrink-0" />
        ) : (
          <Sparkles size={13} className="shrink-0" />
        )}
        <span className="hidden truncate lg:inline">{etykietaPrzycisku}</span>
        <ChevronDown size={12} className="shrink-0 opacity-70" aria-hidden />
      </button>

      {otwarte &&
        pozycja &&
        typeof document !== 'undefined' &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-context-menu"
              onClick={() => setOtwarte(false)}
              aria-hidden="true"
            />
            <div
              role="menu"
              aria-label={et('menu')}
              data-testid="pracuj-z-ai-menu"
              className="fixed z-context-menu min-w-[240px] rounded-lg border border-c-border-subtle bg-c-surface p-1 shadow-lg"
              style={{ top: pozycja.top, right: pozycja.right }}
            >
              {pozycjeMenu.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  role="menuitem"
                  data-pozycja={it.id}
                  data-wylaczona={it.wylaczona ? 'tak' : 'nie'}
                  title={it.tytul}
                  aria-disabled={it.wylaczona || undefined}
                  disabled={it.wylaczona}
                  onClick={() => {
                    if (it.wylaczona) return;
                    it.onClick?.();
                    setOtwarte(false);
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
                      it.wylaczona
                        ? 'cursor-not-allowed text-c-text-muted opacity-50'
                        : 'text-c-text hover:bg-c-surface-raised'
                    }`}
                >
                  <Sparkles size={14} className="shrink-0 text-c-ai" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{it.etykieta}</span>
                </button>
              ))}
              {!moznaEdytowac && powodTylkoOdczyt ? (
                <p
                  data-testid="pracuj-z-ai-tylko-odczyt"
                  className="mt-1 border-t border-c-border-subtle px-3 pb-1 pt-2 text-[11px] leading-snug text-c-text-muted"
                >
                  {`${et('tylkoOdczyt')}: ${powodTylkoOdczyt}`}
                </p>
              ) : null}
            </div>
          </>,
          document.body
        )}

      {panel.faza !== 'zamkniety' && typeof document !== 'undefined'
        ? createPortal(
            <aside
              role="dialog"
              aria-modal="false"
              aria-label={et('propozycja')}
              data-testid="pracuj-z-ai-propozycja"
              className="fixed bottom-5 right-5 z-40 max-h-[70vh] w-[min(460px,calc(100vw-2.5rem))] overflow-y-auto rounded-2xl border border-c-border bg-c-surface p-4 shadow-2xl"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <strong className="flex items-center gap-2 text-sm text-c-text">
                  <Sparkles size={14} className="text-c-ai" aria-hidden />
                  {panel.faza === 'zgoda' ? et('zgodaTytul') : et('propozycja')}
                </strong>
                <button
                  type="button"
                  onClick={zamknijPanel}
                  aria-label={et('zamknij')}
                  className="rounded-lg p-1 text-c-text-secondary hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                >
                  <X size={14} />
                </button>
              </div>

              {panel.faza === 'zgoda' ? (
                <>
                  <p className="text-xs leading-relaxed text-c-text-secondary">{panel.opis}</p>
                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={zamknijPanel}
                      className="rounded-lg border border-c-border-subtle px-3 py-1.5 text-xs text-c-text-secondary hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                    >
                      {et('odrzuc')}
                    </button>
                    <button
                      type="button"
                      data-testid="pracuj-z-ai-zatwierdz"
                      onClick={() => {
                        const uruchom = panel.uruchom;
                        zamknijPanel();
                        void uruchom();
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-c-ai/40 bg-c-ai/10 px-3 py-1.5 text-xs font-medium text-c-ai hover:bg-c-ai/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                    >
                      <Check size={13} />
                      {et('zatwierdz')}
                    </button>
                  </div>
                </>
              ) : null}

              {panel.faza === 'zbieranie' ? (
                <p className="flex items-center gap-2 text-xs text-c-text-secondary">
                  <Loader2 size={13} className="animate-spin" />
                  {`${et('zbieranie')} ${t('karta.pracujZAI.postep', wybierz(L.postep, isPolish), {
                    i: panel.zrobione,
                    n: panel.wszystkie,
                  })}`}
                </p>
              ) : null}

              {panel.faza === 'pusto' ? (
                <p className="text-xs leading-relaxed text-c-text-secondary">{et('brakPol')}</p>
              ) : null}

              {panel.faza === 'gotowa' ? (
                <>
                  <ul className="space-y-2">
                    {panel.propozycje.map((p, idx) => (
                      <li
                        key={p.poleId}
                        className="rounded-xl border border-c-border-subtle bg-c-surface-raised p-2.5"
                      >
                        <label className="flex cursor-pointer items-start gap-2">
                          <input
                            type="checkbox"
                            checked={p.wybrana}
                            onChange={() =>
                              setPanel((prev) =>
                                prev.faza === 'gotowa'
                                  ? {
                                      ...prev,
                                      propozycje: prev.propozycje.map((q, i) =>
                                        i === idx ? { ...q, wybrana: !q.wybrana } : q
                                      ),
                                    }
                                  : prev
                              )
                            }
                            className="mt-0.5 accent-[color:var(--c-ai)]"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[11px] uppercase tracking-wide text-c-text-muted">
                              {p.sekcjaEtykieta ? `${p.sekcjaEtykieta} · ` : ''}
                              {p.etykieta}
                            </span>
                            <span className="mt-1 block whitespace-pre-wrap text-xs text-c-text">
                              {p.tresc}
                            </span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>

                  {panel.pominiete.length > 0 ? (
                    <p className="mt-3 text-[11px] leading-snug text-c-text-muted">
                      {`${et('pominiete')}: ${panel.pominiete.join(', ')}`}
                    </p>
                  ) : null}

                  {panel.nieudane.length > 0 ? (
                    <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-snug text-c-danger">
                      <AlertTriangle size={12} className="mt-px shrink-0" />
                      <span>
                        {`${et('nieudane')}: ${panel.nieudane
                          .map((n) => `${n.etykieta} (${n.powod})`)
                          .join('; ')}`}
                      </span>
                    </p>
                  ) : null}

                  {panel.propozycje.length === 0 ? (
                    <p className="text-xs text-c-text-secondary">{et('nicNiewybrane')}</p>
                  ) : null}

                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      data-testid="pracuj-z-ai-odrzuc"
                      onClick={zamknijPanel}
                      className="rounded-lg border border-c-border-subtle px-3 py-1.5 text-xs text-c-text-secondary hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                    >
                      {et('odrzuc')}
                    </button>
                    <button
                      type="button"
                      data-testid="pracuj-z-ai-zatwierdz"
                      disabled={!panel.propozycje.some((p) => p.wybrana)}
                      onClick={() => zatwierdz(aktywneZrodlo)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-c-ai/40 bg-c-ai/10 px-3 py-1.5 text-xs font-medium text-c-ai hover:bg-c-ai/15 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                    >
                      <Check size={13} />
                      {et('zatwierdz')}
                    </button>
                  </div>
                </>
              ) : null}
            </aside>,
            document.body
          )
        : null}
    </>
  );
};

export default PracujZAI;
