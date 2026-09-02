/**
 * Dev-render host — EKRAN PORÓWNAWCZY podglądów. NIE jest ekranem produktu.
 *
 * ── CZEMU ISTNIEJE (słowa właściciela, 2026-08-30) ─────────────────────────
 * „Zobacz, to jest wartościowy obrazek, bo pokazuje, jak nieporównywalne są
 *  podglądy, które powinny być takie same."
 *
 * Ekran jest przyrządem pomiarowym: cztery podglądy obok siebie, jeden zrzut,
 * i albo widać, że są takie same, albo widać, że nie są. Nic tu nie ma być
 * ładniejsze niż w produkcie — ma być IDENTYCZNE z produktem.
 *
 * ── CO SIĘ ZMIENIŁO 2026-08-30 ─────────────────────────────────────────────
 * Poprzednia wersja tego pliku sama była częścią problemu, który miała mierzyć:
 * składała cztery stopki RĘCZNIE z prymitywów (`PreviewMetaCard`,
 * `PreviewDetailsSection`, `PreviewAIHintStrip`, `PreviewRelations`,
 * `PreviewActionBar`) w czterech różnych układach, w czterech różnych
 * kolumnach-rusztowaniach. Skutki widoczne na zrzucie PRZED:
 *   • żadna kolumna nie miała bloku 1 (nagłówek: tytuł · Pin · Otwórz · ×) —
 *     zamiast niego był harnessowy `<header>` z nazwą pliku źródłowego;
 *   • Ideas renderował „Co dalej" PRZED akcjami, pozostałe trzy nie miały go
 *     wcale — cztery różne kolejności bloków na jednym obrazku;
 *   • czterokolumnowy wiersz akcji Inboxa wychodził poza kolumnę i nachodził
 *     na sąsiednią;
 *   • Decisions miał doklejony ręcznie pill „Odłóż" obok `PreviewActionBar`.
 *
 * Teraz każda kolumna montuje `StandardPreview` — JEDYNĄ fasadę bloków 1–6
 * (`TABLE_AND_PREVIEW_CANON.md` §7.0/§7.3, `TRIADA_KANON.md` §A7). Ekran
 * deklaruje wyłącznie TREŚĆ (tytuł, chipy meta, opis, chipy AI, powiązania,
 * akcje, „Co dalej"); wygląd, kolejność bloków, geometrię nagłówka i
 * szerokość panelu narzuca komponent. Jeśli po tej zmianie cztery kolumny
 * nadal wyglądają różnie — to znaczy, że rozjazd jest w komponencie, a nie
 * w ekranie, i widać to natychmiast. O to w tym przyrządzie chodzi.
 *
 * Etykiety, ikony, warianty i skróty są przepisane 1:1 z produkcji, z
 * odnośnikiem plik:linia przy każdej kolumnie.
 *
 * Parametry URL (poza ?theme, ?lang z harnessu):
 *   ?legenda=0   ukrywa pasek legendy skutek→wariant (czysty zrzut podglądów)
 */
import {
  AlarmClockOff,
  Archive,
  Bell,
  Bookmark,
  Calendar,
  CalendarClock,
  Check,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Inbox as InboxIcon,
  Lightbulb,
  ListChecks,
  MessageSquare,
  Pause,
  Presentation,
  Rocket,
  Sparkles,
  StickyNote,
  Table as TableIcon,
  Target,
  TrendingUp,
  UserPlus,
  Workflow,
  X,
  Zap,
} from 'lucide-react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { actionPillClass, type MetaPill, type RelationItem } from '@/components/shared/PreviewPane';
import {
  StandardPreview,
  type StandardPreviewActions,
  type StandardPreviewWhatsNext,
} from '@/components/standard/StandardPreview';
import { CANON_PREVIEW } from '@/contracts/tableSurface/canon';

const noop = () => undefined;

/**
 * Szerokość kolumny na tym przyrządzie — WYLICZONA z kanonu, nie wpisana.
 *
 * Kanonem szerokości podglądu jest `clamp(340px, 28%, 480px)` (§7.2), gdzie
 * `28%` liczy się od obszaru roboczego EKRANU, na którym podgląd stoi obok
 * swojej tabeli. Cztery takie panele nie mogą stać obok siebie w jednym
 * wierszu — cztery razy 28% jednej szerokości nigdy się w niej nie zmieści
 * (4·0,28W = 1,12W). Ekran porównawczy pokazuje więc każdy podgląd w
 * szerokości, jaką kanon daje mu na typowym ekranie 1440 px: `clamp` zwinięty
 * do liczby przy tej jednej referencji. Składniki biorę z `CANON_PREVIEW` —
 * ten sam obiekt, z którego powstaje `PREVIEW_PANE_WIDTH` — więc zmiana
 * kanonu przesuwa ten przyrząd sama, bez szukania literałów.
 */
const SZEROKOSC_EKRANU_ODNIESIENIA = 1440;
const SZEROKOSC_PODGLADU = Math.round(
  Math.min(
    CANON_PREVIEW.maxWidth,
    Math.max(CANON_PREVIEW.minWidth, CANON_PREVIEW.preferredRatio * SZEROKOSC_EKRANU_ODNIESIENIA)
  )
);

// ── Legenda: skutek akcji → wariant (kanon §7.3b, tabela rozstrzygająca) ─────
const LEGENDA: {
  wariant: 'emerald' | 'red' | 'amber' | 'neutral' | 'primary';
  skutek: string;
  przyklad: string;
}[] = [
  { wariant: 'emerald', skutek: 'Zamyka sprawę pozytywnie', przyklad: 'Zrobione · Zatwierdź' },
  { wariant: 'red', skutek: 'Odrzuca formalnie / usuwa', przyklad: 'Odrzuć · Usuń' },
  { wariant: 'amber', skutek: 'Podnosi pilność', przyklad: 'Eskaluj' },
  { wariant: 'neutral', skutek: 'Wszystko pozostałe', przyklad: 'Dziś · Deleguj · Zapisz' },
  { wariant: 'primary', skutek: 'Jedyna główna akcja preview', przyklad: 'Konwertuj' },
];

interface OpisPodgladu {
  zakladka: string;
  ikona: React.ElementType;
  zrodlo: string;
  tytul: string;
  meta: MetaPill[];
  termin: string;
  opis: string;
  ai: string[];
  relacje: RelationItem[];
  akcje: StandardPreviewActions;
  coDalej?: StandardPreviewWhatsNext;
}

// ═══════════════════════════════════════════════════════════════════════════
// ZAKŁADKA 1 — IDEAS · źródło: src/components/MyWork/IdeasTableContent.tsx:634
// ═══════════════════════════════════════════════════════════════════════════
const IDEAS: OpisPodgladu = {
  zakladka: 'Ideas',
  ikona: Lightbulb,
  zrodlo: 'IdeasTableContent.tsx:634',
  tytul: 'Wejście na rynek DACH — mapa hipotez',
  meta: [
    { label: 'Etap', value: 'Rośnie', tone: 'success' },
    { label: 'Narzędzie', value: 'Mind Map', tone: 'info' },
    { label: 'Właściciel', value: 'Anna Kowalska', tone: 'neutral' },
  ],
  termin: '11.07.2026',
  opis:
    'Gałęzie: popyt mid-market, konkurencja lokalna, kanały sprzedaży, ryzyka regulacyjne. ' +
    'Priorytet na Q3: zwalidować popyt zanim ruszy budowa oferty.',
  ai: ['Rozwiń pomysł', 'Znajdź ryzyka', 'Zaproponuj następny krok'],
  relacje: [
    { label: 'Notatka z zarządu 09.07', icon: FileText, onClick: noop, type: 'note' },
    { label: 'Model finansowy DACH', icon: FileSpreadsheet, onClick: noop, type: 'model' },
  ],
  akcje: {
    resolutions: [
      {
        id: 'konwertuj',
        variant: 'primary',
        label: 'Konwertuj',
        icon: Sparkles,
        onClick: noop,
      },
      {
        id: 'flow',
        variant: 'neutral',
        label: 'Otwórz Flow',
        icon: Workflow,
        onClick: noop,
      },
    ],
  },
  // Jedyna z czterech encji z zaimplementowaną konwersją na artefakt innego
  // modułu — więc jedyna, która wg §7.3c ma mieć ten blok (§7.3a: ikona+hue
  // = moduł docelowy). Pozostałe trzy: strefa NIEOBECNA, nie pusta.
  coDalej: {
    note: 'Najpierw tworzy sesję MyWork',
    items: [
      { id: 'raport', label: 'Raport', icon: FileText, onClick: noop },
      { id: 'deck', label: 'Prezentacja', icon: Presentation, onClick: noop },
      { id: 'tabela', label: 'Tabela', icon: TableIcon, onClick: noop },
      { id: 'notatka', label: 'Notatka', icon: StickyNote, onClick: noop },
      { id: 'inicjatywa', label: 'Inicjatywa', icon: Rocket, onClick: noop },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// ZAKŁADKA 2 — INBOX · źródło: src/components/MyWork/InboxContent.tsx:1396
// ═══════════════════════════════════════════════════════════════════════════
const INBOX: OpisPodgladu = {
  zakladka: 'Inbox',
  ikona: InboxIcon,
  zrodlo: 'InboxContent.tsx:1396',
  tytul: 'ZPUE prosi o przesunięcie warsztatu',
  meta: [
    { label: 'Źródło', value: 'E-mail', tone: 'neutral' },
    { label: 'Priorytet', value: 'Wysoki', tone: 'warning' },
    { label: 'Od', value: 'Marek Zieliński', tone: 'neutral' },
  ],
  termin: 'dziś 09:14',
  opis:
    'Klient prosi o przesunięcie warsztatu diagnostycznego z 24.07 na pierwszy tydzień sierpnia ' +
    '— kolizja z audytem ISO. Pyta też, czy da się skrócić sesję do pół dnia.',
  ai: ['Streść wątek', 'Zaproponuj odpowiedź', 'Wyciągnij zadania'],
  relacje: [
    { label: 'Projekt ZPUE — DRD', icon: Target, onClick: noop, type: 'project' },
    { label: 'Warsztat 24.07', icon: CalendarClock, onClick: noop, type: 'meeting' },
  ],
  akcje: {
    // 'Zrobione' zamyka sprawę pozytywnie — ten sam skutek co Tasks.'Zrobione',
    // więc ten sam wariant `positive` (§7.3b).
    resolutions: [
      {
        id: 'zrobione',
        variant: 'positive',
        label: 'Zrobione',
        icon: CheckCircle2,
        shortcut: 'D',
        onClick: noop,
      },
      {
        id: 'odrzuc',
        variant: 'neutral',
        label: 'Odrzuć',
        icon: Archive,
        shortcut: 'X',
        onClick: noop,
      },
    ],
    informational: [
      {
        id: 'zapisz',
        variant: 'neutral',
        label: 'Zapisz',
        icon: Bookmark,
        shortcut: 'S',
        onClick: noop,
      },
      {
        id: 'notatka',
        variant: 'neutral',
        label: 'Notatka',
        icon: FileText,
        shortcut: 'N',
        onClick: noop,
      },
    ],
    // Rodzina planowania w całości na `neutral` (§7.3b).
    time: [
      { id: 'dzis', variant: 'neutral', label: 'Dziś', icon: Zap, shortcut: 'T', onClick: noop },
      {
        id: 'tydzien',
        variant: 'neutral',
        label: 'Tydzień',
        icon: CalendarClock,
        shortcut: 'W',
        onClick: noop,
      },
      {
        id: 'pozniej',
        variant: 'neutral',
        label: 'Później',
        icon: Calendar,
        shortcut: 'L',
        onClick: noop,
      },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// ZAKŁADKA 3 — TASKS · źródło: src/components/MyWork/MyTasksListContent.tsx:2594
// ═══════════════════════════════════════════════════════════════════════════
const TASKS: OpisPodgladu = {
  zakladka: 'Tasks',
  ikona: ListChecks,
  zrodlo: 'MyTasksListContent.tsx:2594',
  tytul: 'Karta inicjatywy — onboarding 21→7 dni',
  meta: [
    { label: 'Status', value: 'W toku', tone: 'info' },
    { label: 'Termin', value: '23.07', tone: 'warning' },
    { label: 'Przypisane', value: 'Piotr Wiśniewski', tone: 'neutral' },
  ],
  termin: 'za 2 dni',
  opis:
    'Spisać zakres, właściciela i mierniki dla inicjatywy skrócenia onboardingu. ' +
    'Wejście: wnioski z warsztatu 09.07 i dane z trzech ostatnich wdrożeń.',
  ai: ['Rozbij na podzadania', 'Oszacuj czas', 'Kto powinien to robić'],
  relacje: [
    { label: 'Inicjatywa: Onboarding 21→7 dni', icon: Target, onClick: noop, type: 'initiative' },
    { label: 'Decyzja: pilot Logistics', icon: ListChecks, onClick: noop, type: 'decision' },
  ],
  akcje: {
    resolutions: [
      {
        id: 'zrobione',
        variant: 'positive',
        label: 'Zrobione',
        icon: CheckCircle2,
        shortcut: 'D',
        onClick: noop,
      },
    ],
    time: [
      { id: 'dzis', variant: 'neutral', label: 'Dziś', icon: Zap, shortcut: 'T', onClick: noop },
      {
        id: 'odloz',
        variant: 'neutral',
        label: 'Odłóż',
        icon: Pause,
        shortcut: 'Z',
        onClick: noop,
      },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// ZAKŁADKA 4 — DECISIONS · źródło: src/components/MyWork/DecisionPreviewPanel.tsx:402
// ═══════════════════════════════════════════════════════════════════════════
const DECISIONS: OpisPodgladu = {
  zakladka: 'Decisions',
  ikona: ListChecks,
  zrodlo: 'DecisionPreviewPanel.tsx:402',
  tytul: 'Pilot DRD w segmencie Logistics — Q3',
  meta: [
    { label: 'Status', value: 'Czeka na Ciebie', tone: 'warning' },
    { label: 'Wpływ', value: 'Wysoki', tone: 'danger' },
    { label: 'Termin', value: '22.07', tone: 'neutral' },
  ],
  termin: '22.07.2026',
  opis:
    'Czy uruchamiamy pilota w Logistics BU już w Q3, czy czekamy na domknięcie diagnozy ' +
    'Manufacturing. Koszt wejścia 180 tys. zł, zwrot szacowany na 4 kwartały.',
  ai: ['Argumenty za i przeciw', 'Ryzyka odroczenia', 'Kto jeszcze decyduje'],
  relacje: [
    { label: 'Diagnoza Logistics BU', icon: FileText, onClick: noop, type: 'assessment' },
    { label: 'Prezentacja dla zarządu', icon: Presentation, onClick: noop, type: 'deck' },
  ],
  akcje: {
    resolutions: [
      {
        id: 'zatwierdz',
        variant: 'positive',
        label: 'Zatwierdź',
        icon: Check,
        shortcut: 'A',
        onClick: noop,
      },
      {
        id: 'odrzuc',
        variant: 'destructive',
        label: 'Odrzuć',
        icon: X,
        shortcut: 'R',
        onClick: noop,
      },
    ],
    informational: [
      {
        id: 'info',
        variant: 'neutral',
        label: 'Więcej info',
        icon: MessageSquare,
        shortcut: 'I',
        onClick: noop,
      },
      {
        id: 'deleguj',
        variant: 'neutral',
        label: 'Deleguj',
        icon: UserPlus,
        shortcut: 'G',
        onClick: noop,
      },
    ],
    time: [
      {
        id: 'odloz',
        variant: 'neutral',
        label: 'Odłóż',
        icon: AlarmClockOff,
        shortcut: 'Z',
        onClick: noop,
      },
      { id: 'przypomnij', variant: 'neutral', label: 'Przypomnij', icon: Bell, onClick: noop },
      { id: 'eskaluj', variant: 'warning', label: 'Eskaluj', icon: TrendingUp, onClick: noop },
    ],
  },
};

const PODGLADY = [IDEAS, INBOX, TASKS, DECISIONS];

/**
 * Rusztowanie kolumny — WYŁĄCZNIE etykieta pomiarowa nad panelem (skąd wzięta
 * treść). Nie dotyka wnętrza podglądu: szerokość jest kanoniczna
 * (`PREVIEW_PANE_WIDTH`), a wszystko poniżej rysuje `StandardPreview`.
 */
const Kolumna: React.FC<{ opis: OpisPodgladu }> = ({ opis }) => {
  const Ikona = opis.ikona;
  const [przypiete, setPrzypiete] = React.useState(false);
  return (
    <div className="flex shrink-0 flex-col gap-2">
      <div className="flex items-center gap-2 px-1">
        <Ikona size={15} className="shrink-0 text-c-text-muted" />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-c-text-primary">{opis.zakladka}</div>
          <div className="font-mono text-[10px] leading-tight text-c-text-muted/70">
            {opis.zrodlo}
          </div>
        </div>
      </div>
      <div
        data-preview-pane
        className="h-[880px] shrink-0 bg-slate-50 p-3 dark:bg-navy-950"
        style={{ width: SZEROKOSC_PODGLADU }}
      >
        <StandardPreview
          title={opis.tytul}
          onClose={noop}
          onOpenFull={noop}
          pinned={przypiete}
          onTogglePin={() => setPrzypiete((v) => !v)}
          meta={{
            pills: opis.meta,
            trailing: (
              <span className="text-[11px] tabular-nums text-c-text-muted">{opis.termin}</span>
            ),
          }}
          details={{
            label: 'Szczegóły',
            text: opis.opis,
            onCopy: noop,
            onExport: noop,
            onDownload: noop,
          }}
          ai={{ hints: opis.ai }}
          relations={opis.relacje}
          actions={opis.akcje}
          whatsNext={opis.coDalej}
        />
      </div>
    </div>
  );
};

export const Preview4ZakladkiScreen: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  const pokazLegende = params.get('legenda') !== '0';

  return (
    <MemoryRouter initialEntries={['/my-work']}>
      <div className="min-h-screen bg-c-surface p-6">
        {/* `w-fit` (do 2026-09-02) kazał kontenerowi urosnąć do naturalnej
            szerokości czterech kolumn — strona rozjeżdżała się w bok, a na
            zrzucie 1440/1600 px czwarta kolumna (Decisions) była ucięta.
            Teraz kontener bierze szerokość okna, a wiersz skaluje się
            jednorodnie do kadru (`WierszCzterechKolumn`). */}
        <div className="mx-auto w-full">
          <header className="mb-5">
            <h1 className="text-lg font-semibold text-c-text-primary">
              Podglądy — cztery zakładki My Work obok siebie
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-c-text-secondary">
              Przyrząd pomiarowy, nie ekran produktu. Każda kolumna to ten sam komponent{' '}
              <strong className="font-semibold text-c-text-primary">StandardPreview</strong> — ekran
              podaje wyłącznie treść, a nagłówek, kolejność sześciu bloków, geometrię i szerokość
              narzuca komponent. Cztery panele mają wyglądać identycznie wszędzie poza treścią;
              każda różnica poza treścią jest defektem do zgłoszenia.
            </p>
          </header>

          {pokazLegende ? (
            <div className="mb-6 rounded-2xl border border-c-border-subtle bg-c-surface-raised p-3.5">
              <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
                Skutek akcji → wariant (kanon §7.3b)
              </div>
              <div className="flex flex-wrap items-stretch gap-x-6 gap-y-3">
                {LEGENDA.map((l) => (
                  <div key={l.wariant} className="flex items-center gap-2.5">
                    <span className={actionPillClass(l.wariant, 'pointer-events-none')}>
                      {l.wariant}
                    </span>
                    <span className="text-[11px] leading-tight text-c-text-secondary">
                      {l.skutek}
                      <span className="block text-c-text-muted">{l.przyklad}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <WierszCzterechKolumn />

          <footer className="mt-6 rounded-2xl border border-c-border-subtle bg-c-surface-raised px-4 py-3">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
              Co ma być widać na tym zrzucie
            </div>
            <ul className="space-y-1 text-[12px] leading-relaxed text-c-text-secondary">
              <li>
                • <strong className="text-c-text-primary">Blok 1</strong> we wszystkich czterech:
                tytuł · pinezka · „Otwórz" (bez ikony) · „×" — ten sam zestaw, ta sama kolejność, ta
                sama geometria.
              </li>
              <li>
                • <strong className="text-c-text-primary">Kolejność bloków</strong> identyczna: meta
                → Szczegóły (⋮ + licznik słów) → AI → Powiązania → Akcje → „Co dalej".
              </li>
              <li>
                • <strong className="text-c-text-primary">„Co dalej"</strong> tylko w Ideas — jako
                jedyna z czterech encji ma zaimplementowaną konwersję (§7.3c). W pozostałych blok
                jest NIEOBECNY, nie pusty, a kolejność reszty się nie zmienia.
              </li>
              <li>
                • <strong className="text-c-text-primary">Warianty ze skutku, nie z ekranu</strong>:
                „Zrobione" (Inbox, Tasks) i „Zatwierdź" (Decisions) mają ten sam zielony; cała
                rodzina planowania jest neutralna; „Konwertuj" to jedyny primary — granatowo-biały
                kontrast, nie crimson.
              </li>
              <li>
                • <strong className="text-c-text-primary">Szerokość</strong> ta sama we wszystkich
                czterech ({SZEROKOSC_PODGLADU}&nbsp;px) — wyliczona z `CANON_PREVIEW` (clamp
                340–480&nbsp;px przy ekranie {SZEROKOSC_EKRANU_ODNIESIENIA}&nbsp;px), a nie wpisana
                w ekran.
              </li>
            </ul>
          </footer>
        </div>
      </div>
    </MemoryRouter>
  );
};


/**
 * ODSTĘP MIĘDZY KOLUMNAMI — z kanonu, nie z oka. `gap-4` = 16 px.
 */
const ODSTEP_KOLUMN = 16;

/**
 * Wiersz czterech kolumn — mieści się W KADRZE przy każdej szerokości okna.
 *
 * ── CO BYŁO ZMIERZONE (2026-09-02) ─────────────────────────────────────────
 * Cztery kolumny w szerokości kanonicznej to 4 × `SZEROKOSC_PODGLADU`
 * + 3 × 16 px odstępu. Przy oknie 1440–1600 px (tyle ma ekran właściciela)
 * czwarta kolumna — Decisions — wychodziła poza kadr i na zrzucie było ją
 * widać do połowy. Warunek odbioru z rejestru brzmi „WSZYSTKIE CZTERY podglądy
 * W KADRZE mają te same sześć bloków... i tę samą szerokość", więc obcięta
 * czwarta kolumna sama w sobie łamie warunek — niezależnie od tego, jak
 * wygląda pod spodem.
 *
 * Zwężenie kolumn byłoby fałszem pomiaru (mierzylibyśmy inną szerokość niż
 * produkt), dlatego wiersz jest SKALOWANY JEDNORODNIE: każda kolumna zachowuje
 * tę samą, kanoniczną szerokość względem pozostałych, a całość mieści się
 * w oknie. Przy oknie >= wymaganej szerokości skala wynosi 1 i nic się nie
 * dzieje.
 */
const WierszCzterechKolumn: React.FC = () => {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [skala, setSkala] = React.useState(1);
  const wymagana = PODGLADY.length * SZEROKOSC_PODGLADU + (PODGLADY.length - 1) * ODSTEP_KOLUMN;

  React.useEffect(() => {
    const policz = () => {
      const dostepna = ref.current?.getBoundingClientRect().width ?? wymagana;
      setSkala(dostepna > 0 ? Math.min(1, dostepna / wymagana) : 1);
    };
    policz();
    window.addEventListener('resize', policz);
    return () => window.removeEventListener('resize', policz);
  }, [wymagana]);

  return (
    <div ref={ref} className="w-full overflow-hidden">
      <div
        className="flex flex-nowrap items-start gap-4"
        style={{
          width: wymagana,
          transform: `scale(${skala})`,
          transformOrigin: 'top left',
          // Bez tego skalowanie zostawia pod wierszem pustkę wysokości
          // oryginału — kadr rósłby w dół tak, jakby nic nie zeskalowano.
          marginBottom: skala < 1 ? -(1 - skala) * 940 : 0,
        }}
      >
        {PODGLADY.map((opis) => (
          <Kolumna key={opis.zakladka} opis={opis} />
        ))}
      </div>
    </div>
  );
};

export default Preview4ZakladkiScreen;
