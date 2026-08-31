/**
 * WSKAŹNIK — JEDNA KARTA N (2026-08-30).
 *
 * ── DECYZJA WŁAŚCICIELA ────────────────────────────────────────────────────
 * `docs/program/grafika/DECYZJA_WYNIKI_TRZY_POZIOMY.md`: wskaźnik i cel mają
 * dostać TĘ SAMĄ formułę co ROI (`roi-jedna-karta.tsx`) — jeden artefakt
 * N-karty, nie zbiór osobnych ekranów. Rozstrzygnięcie nr 1 tej decyzji:
 * „JEDEN wskaźnik, WIELE okresów” — OEE linii pakowania w sierpniu i we
 * wrześniu to TEN SAM wskaźnik oglądany dwa razy, nie dwa byty. Konsekwencja
 * wiążąca: ta karta MUSI nieść historię przez wszystkie okresy — trend,
 * zmiany definicji, przesunięcia progu. Ta karta to właśnie ten dowód.
 *
 * Pięć sekcji jednej narracji (od definicji do działania):
 *   1. Kontrakt              — czym jest ten wskaźnik: definicja, jednostka,
 *                                wzór, źródło, częstotliwość, właściciel, próg
 *   2. Pomiary                — historia wartości przez okresy, z trendem
 *   3. Odchylenia              — gdzie i kiedy przekroczyliśmy próg
 *   4. Działania korygujące    — co zrobiliśmy z odchyleniem, kto i kiedy
 *   5. Rodowód                 — historia zmian SAMEJ DEFINICJI (broni
 *                                wiarygodności liczby)
 *
 * ── HISTORIA KLIENTA (kontynuacja `roi-jedna-karta.tsx`) ───────────────────
 * Ten sam przypadek: NordFood, linia pakowania L3, program SMED. Ten wskaźnik
 * to dokładnie `kpi-czas-przezbrojenia-l3`, który ROI wymienia w swoim
 * prawym panelu „Powiązania” — teraz dostaje własną, pełną kartę. Właściciel
 * wskaźnika: Marek Zieliński (Kierownik Linii L3). Próg REWIDOWANY w trakcie
 * życia wskaźnika (22 min → 26 min, 5 marca 2027) — to samo zdarzenie, które
 * ROI opisuje w sekcji „Wnioski i rekomendacja”. Karta pokazuje okres, w
 * którym wynik się POGORSZYŁ (luty 2027, zmiana nocna) — uczciwość ponad
 * optymizm, zgodnie z wymogiem zadania.
 *
 * ── POWŁOKA ─────────────────────────────────────────────────────────────
 * Te same wspólne cegiełki SPEC-A co ROI: `NModeShell` + `ArtifactRightPanel`
 * (7 sekcji kanonu, `ARTIFACT_PANEL_SECTION_ORDER`) + `ArtifactPropertiesTable`
 * + `PreviewRelations`. Zero własnego layoutu.
 *
 * URL: ?screen=wskaznik-jedna-karta[&lang=pl][&theme=light|dark][&sekcja=kontrakt|pomiary|odchylenia|dzialania-korygujace|rodowod]
 */
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Compass,
  Download,
  FileSpreadsheet,
  FileText,
  Gauge,
  GitBranch,
  History as HistoryIcon,
  Link2,
  MessageSquare,
  Rocket,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import React, { useState } from 'react';

import {
  NModeContentBlock,
  type NModeSection,
  NModeShell,
} from '../../src/components/shared/NModeLayout';
import { PreviewRelations } from '../../src/components/shared/PreviewPane/PreviewRelations';
import { ArtifactPropertiesTable } from '../../src/components/standard/ArtifactPropertiesTable';
import {
  ARTIFACT_PANEL_CARD_CLASS_DOCKED,
  ArtifactRightPanel,
  type ArtifactRightPanelSection,
} from '../../src/components/standard/ArtifactRightPanel';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import { AppProviders } from '../../src/providers/AppProviders';
import { useAppStore } from '../../src/store/useAppStore';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

useAppStore.setState({
  theme: new URLSearchParams(window.location.search).get('theme') === 'dark' ? 'dark' : 'light',
} as any);

const KPI_ID = 'kpi-czas-przezbrojenia-l3';
const SCOPE = `kpi:${KPI_ID}`;

const SEKCJA_PARAM = new URLSearchParams(window.location.search).get('sekcja');
const SECTION_ALIASES: Record<string, string> = {
  kontrakt: 'kontrakt',
  pomiary: 'pomiary',
  odchylenia: 'odchylenia',
  'dzialania-korygujace': 'dzialania-korygujace',
  rodowod: 'rodowod',
};
const INITIAL_SECTION = (SEKCJA_PARAM && SECTION_ALIASES[SEKCJA_PARAM]) || 'kontrakt';

// ── drobne prymitywy wizualne (wyłącznie tokeny c-*) ────────────────────────
const StatTile: React.FC<{
  label: string;
  value: string;
  sub?: string;
  tone?: 'neutral' | 'success' | 'danger' | 'warning';
  icon: React.FC<{ size?: number; className?: string }>;
}> = ({ label, value, sub, tone = 'neutral', icon: Icon }) => {
  const toneClass =
    tone === 'success'
      ? 'text-c-success'
      : tone === 'danger'
        ? 'text-c-danger'
        : tone === 'warning'
          ? 'text-c-warning'
          : 'text-c-text';
  return (
    <div className="rounded-xl border border-c-border-subtle bg-c-surface-raised p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-c-text-muted">
        <Icon size={13} className="shrink-0" />
        {label}
      </div>
      <div className={`mt-1.5 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
      {sub ? <div className="mt-0.5 text-[11px] text-c-text-muted">{sub}</div> : null}
    </div>
  );
};

const KV: React.FC<{ rows: { label: string; value: string }[] }> = ({ rows }) => (
  <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
    {rows.map((r) => (
      <div
        key={r.label}
        className="flex items-baseline justify-between gap-3 border-b border-c-border-subtle/60 pb-1.5"
      >
        <dt className="text-xs text-c-text-muted">{r.label}</dt>
        <dd className="text-right text-xs font-medium tabular-nums text-c-text">{r.value}</dd>
      </div>
    ))}
  </dl>
);

const Bullets: React.FC<{ items: string[] }> = ({ items }) => (
  <ul className="flex flex-col gap-1.5">
    {items.map((item, idx) => (
      <li key={idx} className="flex items-start gap-2 text-xs text-c-text-secondary">
        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-c-text-muted" />
        <span className="min-w-0">{item}</span>
      </li>
    ))}
  </ul>
);

const SimpleTable: React.FC<{
  head: string[];
  rows: (string | React.ReactNode)[][];
}> = ({ head, rows }) => (
  <div className="overflow-hidden rounded-lg border border-c-border-subtle">
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className="bg-c-surface-raised">
          {head.map((h, i) => (
            <th
              key={h}
              className={`border-b border-c-border-subtle px-3 py-2 font-medium text-c-text-muted ${
                i === 0 ? 'text-left' : 'text-right'
              }`}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri} className={ri < rows.length - 1 ? 'border-b border-c-border-subtle' : ''}>
            {row.map((cell, ci) => (
              <td
                key={ci}
                className={`px-3 py-2 tabular-nums ${
                  ci === 0 ? 'text-left text-c-text' : 'text-right text-c-text-secondary'
                }`}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ── SEKCJA 1: KONTRAKT ──────────────────────────────────────────────────────
const KontraktContent: React.FC = () => (
  <div className="flex flex-col gap-4">
    <NModeContentBlock
      blockId="kontrakt-definicja"
      scope={SCOPE}
      title="Co mierzy ten wskaźnik"
      readMode
    >
      <p className="text-xs leading-relaxed text-c-text-secondary">
        Średni czas przezbrojenia linii pakowania L3 — od zatrzymania linii po ostatnią sztukę
        poprzedniej partii do pierwszej dobrej sztuki nowej partii. Mierzy, jak szybko linia wraca
        do produkcji po zmianie asortymentu; to wskaźnik prowadzący dla programu SMED i bezpośredni
        wkład do modelu ROI tej inicjatywy.
      </p>
    </NModeContentBlock>

    <NModeContentBlock
      blockId="kontrakt-parametry"
      scope={SCOPE}
      title="Kontrakt wskaźnika"
      readMode
    >
      <KV
        rows={[
          { label: 'Jednostka', value: 'minuty (średnia na przezbrojenie)' },
          {
            label: 'Wzór',
            value: 'suma minut przezbrojeń w okresie ÷ liczba przezbrojeń, ważona wolumenem zmiany',
          },
          {
            label: 'Źródło danych',
            value: 'SAP PM — rejestr zdarzeń przezbrojenia (automatyczny odczyt)',
          },
          {
            label: 'Częstotliwość pomiaru',
            value: 'miesięcznie (podgląd tygodniowy do wykrywania trendu)',
          },
          { label: 'Właściciel wskaźnika', value: 'Marek Zieliński (Kierownik Linii L3)' },
          { label: 'Zatwierdzający próg', value: 'Anna Kowalczyk (Dyrektor Operacyjna)' },
        ]}
      />
    </NModeContentBlock>

    <NModeContentBlock
      blockId="kontrakt-progi"
      scope={SCOPE}
      title="Progi (aktualne, od 5 marca 2027)"
      readMode
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Cel" value="26 min" sub="target po rewizji" tone="success" icon={Target} />
        <StatTile
          label="Ostrzeżenie"
          value="≥ 32 min"
          sub="żółty próg"
          tone="warning"
          icon={AlertTriangle}
        />
        <StatTile
          label="Krytyczny"
          value="≥ 38 min"
          sub="czerwony próg"
          tone="danger"
          icon={AlertTriangle}
        />
        <StatTile
          label="Baseline"
          value="47 min"
          sub="przed programem SMED"
          tone="neutral"
          icon={Gauge}
        />
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-c-text-muted">
        Poprzedni cel (22 min) obowiązywał do 5 marca 2027 — pełna historia zmiany progu i
        uzasadnienie w sekcji „Rodowód”.
      </p>
    </NModeContentBlock>
  </div>
);

// ── SEKCJA 2: POMIARY ────────────────────────────────────────────────────────
const POMIARY_ROWS: {
  okres: string;
  wartosc: number;
  status: 'ok' | 'ostrzezenie' | 'krytyczny';
  komentarz: string;
}[] = [
  {
    okres: 'Sierpień 2026 (baseline)',
    wartosc: 47,
    status: 'krytyczny',
    komentarz: 'Przed startem programu SMED — punkt odniesienia.',
  },
  {
    okres: 'Wrzesień 2026',
    wartosc: 44,
    status: 'krytyczny',
    komentarz: 'Pierwsze szkolenia zmiany dziennej.',
  },
  {
    okres: 'Październik 2026',
    wartosc: 39,
    status: 'ostrzezenie',
    komentarz: 'Zmiana dzienna certyfikowana w 6/8.',
  },
  {
    okres: 'Listopad 2026',
    wartosc: 35,
    status: 'ostrzezenie',
    komentarz: 'Start szkoleń zmiany popołudniowej.',
  },
  {
    okres: 'Grudzień 2026',
    wartosc: 31,
    status: 'ostrzezenie',
    komentarz: 'Zmiana dzienna w pełni certyfikowana (8/8).',
  },
  {
    okres: 'Styczeń 2027',
    wartosc: 29,
    status: 'ok',
    komentarz:
      'Pierwszy miesiąc pod ówczesnym celem 22 min — jeszcze nieosiągnięty, ale w trendzie.',
  },
  {
    okres: 'Luty 2027',
    wartosc: 31,
    status: 'ostrzezenie',
    komentarz:
      'POGORSZENIE względem stycznia — zmiana nocna dalej pracuje starym sposobem (41 min), ciągnie średnią w górę.',
  },
  {
    okres: 'Marzec 2027',
    wartosc: 28,
    status: 'ok',
    komentarz: 'Start coachingu zmiany nocnej (decyzja z 5 marca).',
  },
  {
    okres: 'Kwiecień 2027',
    wartosc: 26,
    status: 'ok',
    komentarz: 'Zmiana nocna: 4/8 certyfikowanych.',
  },
  {
    okres: 'Maj 2027 (ostatni pomiar)',
    wartosc: 25,
    status: 'ok',
    komentarz: 'Poniżej nowego celu 26 min drugi miesiąc z rzędu.',
  },
];

const PomiaryContent: React.FC = () => (
  <div className="flex flex-col gap-4">
    <div
      className="flex items-start gap-2 rounded-lg border border-c-warning/40 bg-c-warning/10 px-3 py-2.5 text-xs text-c-text"
      role="note"
    >
      <TrendingDown size={16} className="mt-0.5 shrink-0 text-c-warning" />
      <span>
        Luty 2027: wynik <strong>pogorszył się</strong> względem stycznia (29 → 31 min) — to nie
        jest błąd pomiaru, tylko realny regres napędzany zmianą nocną. Przyczyna i reakcja opisane w
        sekcjach „Odchylenia” i „Działania korygujące”.
      </span>
    </div>

    <NModeContentBlock
      blockId="pomiary-historia"
      scope={SCOPE}
      title="Historia pomiarów — jeden wskaźnik, dziesięć okresów"
      readMode
    >
      <SimpleTable
        head={['Okres', 'Wartość', 'Status', 'Komentarz']}
        rows={POMIARY_ROWS.map((r) => [
          r.okres,
          <span
            key="v"
            className={
              r.status === 'krytyczny'
                ? 'text-c-danger font-semibold'
                : r.status === 'ostrzezenie'
                  ? 'text-c-warning font-semibold'
                  : 'text-c-success font-semibold'
            }
          >
            {r.wartosc} min
          </span>,
          r.status === 'krytyczny'
            ? 'Krytyczny'
            : r.status === 'ostrzezenie'
              ? 'Ostrzeżenie'
              : 'W normie',
          <span key="c" className="text-left text-c-text-muted">
            {r.komentarz}
          </span>,
        ])}
      />
      <p className="mt-3 text-[11px] leading-relaxed text-c-text-muted">
        To JEDEN wskaźnik oglądany w dziesięciu okresach, nie dziesięć osobnych wskaźników —
        historia trwa od baseline'u (sierpień 2026) do ostatniego pomiaru (maj 2027) bez zerwania
        ciągłości, nawet gdy zmieniał się próg (marzec 2027, patrz „Rodowód”).
      </p>
    </NModeContentBlock>

    <NModeContentBlock blockId="pomiary-trend" scope={SCOPE} title="Trend w liczbach" readMode>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Ostatni pomiar"
          value="25 min"
          sub="maj 2027"
          tone="success"
          icon={TrendingDown}
        />
        <StatTile
          label="Zmiana vs baseline"
          value="−47%"
          sub="47 → 25 min"
          tone="success"
          icon={TrendingUp}
        />
        <StatTile
          label="Najgorszy pomiar"
          value="47 min"
          sub="sierpień 2026"
          tone="danger"
          icon={AlertTriangle}
        />
        <StatTile
          label="Okresów pod celem"
          value="4 / 10"
          sub="od stycznia 2027"
          tone="neutral"
          icon={CheckCircle2}
        />
      </div>
    </NModeContentBlock>
  </div>
);

// ── SEKCJA 3: ODCHYLENIA ─────────────────────────────────────────────────────
const OdchyleniaContent: React.FC = () => (
  <div className="flex flex-col gap-4">
    <NModeContentBlock
      blockId="odchylenia-lista"
      scope={SCOPE}
      title="Przekroczenia progu"
      readMode
    >
      <SimpleTable
        head={[
          'Okres',
          'Wartość',
          'Próg obowiązujący wtedy',
          'Skala przekroczenia',
          'Status sprawy',
        ]}
        rows={[
          [
            'Sierpień – grudzień 2026',
            '47 → 31 min',
            '22 min (cel pierwotny)',
            <span key="a" className="text-c-danger">
              powyżej celu cały okres
            </span>,
            'Oczekiwane — okres rozruchu programu, brak sprawy odchylenia.',
          ],
          [
            'Luty 2027',
            '31 min',
            '22 min (cel pierwotny)',
            <span key="b" className="text-c-danger">
              +9 min ponad cel; zmiana III: 41 min (+19 min)
            </span>,
            'ODCH-0031 — otwarta.',
          ],
        ]}
      />
    </NModeContentBlock>

    <NModeContentBlock
      blockId="odchylenia-szczegoly"
      scope={SCOPE}
      title="ODCH-0031 — co dokładnie przekroczyło próg"
      readMode
    >
      <div className="flex flex-col gap-3 text-xs text-c-text-secondary">
        <p>
          Rozbicie lutowego pomiaru na zmiany pokazuje, że przekroczenie nie jest rozłożone równo —
          zmiana nocna (III) ma dziś tylko <strong className="text-c-text">1 z 8 operatorów</strong>{' '}
          certyfikowanych w metodzie SMED.
        </p>
        <SimpleTable
          head={['Zmiana', 'Luty 2027', 'Cel wtedy', 'Certyfikacja SMED']}
          rows={[
            ['I — dzienna', '23 min', '22 min', '8/8'],
            ['II — popołudniowa', '29 min', '22 min', '5/8'],
            [
              'III — nocna',
              '41 min',
              '22 min',
              <span key="n" className="text-c-danger">
                1/8
              </span>,
            ],
          ]}
        />
        <p>
          Zmiana III odpowiada za ok. 1/3 wolumenu przezbrojeń, ale ciągnie średnią ważoną w górę
          nieproporcjonalnie do swojego udziału — dokładnie ta sama przyczyna, którą opisuje analiza
          ROI tej inicjatywy w sekcji „Wnioski i rekomendacja”.
        </p>
      </div>
    </NModeContentBlock>
  </div>
);

// ── SEKCJA 4: DZIAŁANIA KORYGUJĄCE ──────────────────────────────────────────
const DzialaniaKorygujaceContent: React.FC = () => (
  <div className="flex flex-col gap-4">
    <NModeContentBlock
      blockId="cas-0031"
      scope={SCOPE}
      title="CAS-0031 — reakcja na ODCH-0031"
      readMode
    >
      <KV
        rows={[
          { label: 'Powiązana sprawa odchylenia', value: 'ODCH-0031 (luty 2027)' },
          { label: 'Otwarte', value: '5 marca 2027' },
          { label: 'Właściciel działania', value: 'Marek Zieliński (Kierownik Linii L3)' },
          { label: 'Sponsor informowany', value: 'Anna Kowalczyk (Dyrektor Operacyjna)' },
          { label: 'Status', value: '3 / 4 sesji zamknięte (na dzień ostatniego pomiaru)' },
        ]}
      />
    </NModeContentBlock>

    <NModeContentBlock blockId="cas-dzialania" scope={SCOPE} title="Co zrobiliśmy" readMode>
      <SimpleTable
        head={['Działanie', 'Termin', 'Kto', 'Status']}
        rows={[
          [
            'Sesja coachingu SMED #1 — zmiana III',
            '12 marca 2027',
            'Trener SMED (zewn.), 4 operatorów',
            'Zamknięte',
          ],
          [
            'Sesja coachingu SMED #2 — zmiana III',
            '26 marca 2027',
            'Trener SMED (zewn.), 4 operatorów',
            'Zamknięte',
          ],
          [
            'Sesja coachingu SMED #3 — zmiana III',
            '9 kwietnia 2027',
            'Trener SMED (zewn.), pozostali operatorzy',
            'Zamknięte',
          ],
          [
            'Sesja coachingu SMED #4 — zmiana III',
            '30 kwietnia 2027',
            'Trener SMED (zewn.), certyfikacja końcowa',
            'Zaplanowane',
          ],
        ]}
      />
      <p className="mt-3 text-[11px] leading-relaxed text-c-text-muted">
        Efekt widoczny już w pomiarach: marzec 28 min, kwiecień 26 min, maj 25 min — odchylenie
        ODCH-0031 traktowane jako zamknięte po potwierdzeniu w czerwcowym pomiarze, zgodnie z regułą
        „dwa kolejne okresy pod progiem".
      </p>
    </NModeContentBlock>

    <NModeContentBlock
      blockId="cas-decyzja-towarzysząca"
      scope={SCOPE}
      title="Decyzja towarzysząca"
      readMode
    >
      <div className="flex items-start gap-2 rounded-lg border border-c-info/30 bg-c-info/10 px-3 py-2.5 text-xs text-c-text">
        <Target size={16} className="mt-0.5 shrink-0 text-c-info" />
        <span>
          Równolegle z działaniem korygującym podjęto decyzję o rewizji celu (22 → 26 min) — nie
          jako ucieczka od problemu, tylko urealnienie targetu do czasu domknięcia certyfikacji
          zmiany nocnej. Pełny zapis w sekcji „Rodowód”.
        </span>
      </div>
    </NModeContentBlock>
  </div>
);

// ── SEKCJA 5: RODOWÓD ────────────────────────────────────────────────────────
const RodowodContent: React.FC = () => (
  <div className="flex flex-col gap-4">
    <NModeContentBlock blockId="rodowod-po-co" scope={SCOPE} title="Po co ta sekcja" readMode>
      <p className="text-xs leading-relaxed text-c-text-secondary">
        Ta sekcja broni wiarygodności liczby. Wskaźnik żyje przez wiele okresów (decyzja
        właściciela, sierpień 2026) — więc kiedy próg albo wzór się zmienia, trzeba wiedzieć
        DOKŁADNIE kiedy, dlaczego i kto to zatwierdził, żeby porównanie „25 min dziś vs 47 min na
        starcie" nadal znaczyło to samo.
      </p>
    </NModeContentBlock>

    <NModeContentBlock
      blockId="rodowod-zmiany-definicji"
      scope={SCOPE}
      title="Historia zmian definicji"
      readMode
    >
      <SimpleTable
        head={['Data', 'Co się zmieniło', 'Z / na', 'Zatwierdził']}
        rows={[
          [
            '12 sierpnia 2026',
            'Definicja wzoru ustalona przy tworzeniu wskaźnika',
            'średnia arytmetyczna z rejestru SAP PM',
            'Marek Zieliński',
          ],
          [
            '3 listopada 2026',
            'Zmiana metody agregacji — wykryto, że prosta średnia zniekształca wynik przy różnym wolumenie przezbrojeń między zmianami',
            'średnia arytmetyczna → średnia ważona wolumenem zmiany',
            'Marek Zieliński, potwierdzone przez Annę Kowalczyk',
          ],
          [
            '5 marca 2027',
            'Rewizja celu — target 22 min uznany za nieosiągalny bez pełnej certyfikacji zmiany nocnej w bieżącym cyklu',
            'cel: 22 min → 26 min; ostrzeżenie: 28 → 32 min; krytyczny: 35 → 38 min',
            'Anna Kowalczyk (Sponsor)',
          ],
        ]}
      />
    </NModeContentBlock>

    <NModeContentBlock
      blockId="rodowod-uzasadnienie"
      scope={SCOPE}
      title="Uzasadnienie rewizji progu (5 marca 2027)"
      readMode
    >
      <div className="flex flex-col gap-3 text-xs text-c-text-secondary">
        <p>
          Cytat z decyzji: „Cel 22 minuty zakładał pełną certyfikację SMED wszystkich trzech zmian
          do lutego 2027. Harmonogram szkoleń poślizgnął się przez kolizję z przeglądem UDT linii L3
          — trener dotarł do zmiany nocnej dopiero w tygodniu 14, nie 8. Target zostaje urealniony
          do 26 minut na czas domknięcia coachingu (kwiecień 2027), z powrotem do 22 minut po pełnej
          certyfikacji zmiany III."
        </p>
        <p className="text-[11px] text-c-text-muted">
          Ważne: rewizja progu NIE zmienia historii pomiarów sprzed 5 marca 2027 — wiersze w sekcji
          „Pomiary" z lutego 2026 – lutego 2027 nadal są oceniane względem progu obowiązującego w
          danym momencie (kolumna „Próg obowiązujący wtedy" w sekcji „Odchylenia").
        </p>
      </div>
    </NModeContentBlock>
  </div>
);

// ── DEFINICJE SEKCJI LEWEGO MENU ────────────────────────────────────────────
const SECTIONS: NModeSection[] = [
  {
    id: 'kontrakt',
    icon: ClipboardList,
    label: { en: 'Contract', pl: 'Kontrakt' },
    component: <KontraktContent />,
  },
  {
    id: 'pomiary',
    icon: BarChart3,
    label: { en: 'Measurements', pl: 'Pomiary' },
    component: <PomiaryContent />,
  },
  {
    id: 'odchylenia',
    icon: AlertTriangle,
    label: { en: 'Deviations', pl: 'Odchylenia' },
    component: <OdchyleniaContent />,
  },
  {
    id: 'dzialania-korygujace',
    icon: Wrench,
    label: { en: 'Corrective actions', pl: 'Działania korygujące' },
    component: <DzialaniaKorygujaceContent />,
  },
  {
    id: 'rodowod',
    icon: GitBranch,
    label: { en: 'Lineage', pl: 'Rodowód' },
    component: <RodowodContent />,
  },
];

// ── PRAWY PANEL — 7 sekcji kanonu (ARTIFACT_PANEL_SECTION_ORDER) ───────────
function buildRightPanelSections(): ArtifactRightPanelSection[] {
  return [
    {
      id: 'actions',
      label: 'Akcje',
      icon: Sparkles,
      defaultOpen: true,
      children: (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 text-left text-xs font-medium text-c-text-secondary transition hover:bg-c-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
          >
            <ClipboardList size={13} className="shrink-0 text-c-text-muted" />
            Dodaj ręczny pomiar
          </button>
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 text-left text-xs font-medium text-c-text-secondary transition hover:bg-c-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
          >
            <Wrench size={13} className="shrink-0 text-c-text-muted" />
            Otwórz działanie korygujące
          </button>
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 text-left text-xs font-medium text-c-text-secondary transition hover:bg-c-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
          >
            <Download size={13} className="shrink-0 text-c-text-muted" />
            Eksportuj historię pomiarów (CSV)
          </button>
        </div>
      ),
    },
    {
      id: 'properties',
      label: 'Właściwości',
      icon: FileSpreadsheet,
      defaultOpen: true,
      children: (
        <ArtifactPropertiesTable
          propertyLabel="Właściwość"
          valueLabel="Wartość"
          rows={[
            { id: 'kod', label: 'Numer wskaźnika', value: 'KPI-0087' },
            { id: 'status', label: 'Status', value: 'W normie — 2 okresy pod celem' },
            { id: 'wlasciciel', label: 'Właściciel', value: 'Marek Zieliński' },
            { id: 'jednostka', label: 'Jednostka', value: 'minuty', mono: true },
            { id: 'ostatni', label: 'Ostatni pomiar', value: '25 min (maj 2027)', mono: true },
            { id: 'cel', label: 'Cel (aktualny)', value: '26 min', mono: true },
            { id: 'nastepny', label: 'Następny pomiar', value: 'czerwiec 2027' },
            { id: 'zestawienia', label: 'Należy do zestawień', value: '2 zestawienia okresowe' },
          ]}
        />
      ),
    },
    {
      id: 'relations',
      label: 'Powiązania',
      icon: Link2,
      defaultOpen: false,
      badge: 3,
      children: (
        <PreviewRelations
          title="Powiązane obiekty"
          items={[
            {
              id: 'init-smed-linia-pakowania',
              label: 'Skrócenie przezbrojeń (SMED) — linia pakowania L3',
              type: 'initiative',
              icon: Rocket,
            },
            {
              id: 'roi-smed-linia-pakowania-l3',
              label: 'ROI: Skrócenie przezbrojeń (SMED), linia pakowania L3',
              type: 'analysis',
              icon: BarChart3,
            },
            {
              id: 'okr-zdolnosc-l3',
              label: 'Cel: Zwiększyć przepustowość linii pakowania L3',
              type: 'kpi',
              icon: Target,
            },
          ]}
        />
      ),
    },
    {
      id: 'evidence',
      label: 'Źródła i założenia',
      icon: ShieldCheck,
      defaultOpen: false,
      children: (
        <div className="flex flex-col gap-4">
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-c-text-secondary">
              Dowody, na których stoi pomiar
            </div>
            <Bullets
              items={[
                'SAP PM — automatyczny rejestr zdarzeń przezbrojenia, odczyt co 24h.',
                'Rejestr certyfikacji SMED per operator — dział szkoleń NordFood.',
                'Log zmiany definicji i progu — sekcja „Rodowód" tej karty.',
              ]}
            />
          </div>
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-c-text-secondary">
              Gdzie pomiar przestaje działać
            </div>
            <Bullets
              items={[
                'Wartość ważona wolumenem zmiany — awaria czujnika SAP PM na jednej zmianie zaniża jej wagę w średniej.',
                'Pomiar miesięczny nie wychwytuje pojedynczych złych zdarzeń w trakcie okresu — do tego służy podgląd tygodniowy.',
              ]}
            />
          </div>
        </div>
      ),
    },
    {
      id: 'results',
      label: 'Rezultaty',
      icon: FileText,
      defaultOpen: false,
      badge: 1,
      children: (
        <Bullets
          items={['Protokół rewizji progu (PDF) — zatwierdzony 5 marca 2027, wersja 1.0.']}
        />
      ),
    },
    {
      id: 'comments',
      label: 'Komentarze',
      icon: MessageSquare,
      defaultOpen: false,
      badge: 2,
      children: (
        <div className="flex flex-col gap-3">
          {[
            {
              author: 'Anna Kowalczyk',
              when: '4 marca 2027, 08:52',
              text: 'Zanim zgodzę się na przesunięcie progu — czy mamy pewność, że to problem adopcji, a nie samego wzoru? Chcę zobaczyć rozbicie na zmiany, nie tylko średnią.',
            },
            {
              author: 'Marek Zieliński',
              when: '4 marca 2027, 15:10',
              text: 'Rozbicie w sekcji „Odchylenia" — zmiana III: 41 min, 1/8 certyfikowanych. Wzór działa poprawnie, to czysto adopcja. Stąd wniosek: coaching, nie zmiana metody liczenia.',
            },
          ].map((c) => (
            <div key={c.author + c.when} className="rounded-lg border border-c-border-subtle p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-c-text">{c.author}</span>
                <span className="text-[11px] text-c-text-muted">{c.when}</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-c-text-secondary">{c.text}</p>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'history',
      label: 'Historia',
      icon: HistoryIcon,
      defaultOpen: false,
      badge: 5,
      children: (
        <ul className="flex flex-col gap-2.5">
          {[
            {
              when: '12 sierpnia 2026',
              text: 'Wskaźnik utworzony — powiązany z inicjatywą SMED L3.',
            },
            {
              when: '3 listopada 2026',
              text: 'Zmiana metody agregacji na średnią ważoną (patrz „Rodowód").',
            },
            {
              when: '1 stycznia 2027',
              text: 'Dołączony do zestawienia „KPI procesowe — sierpień 2026" (retro-uzupełnienie okresu).',
            },
            {
              when: '5 marca 2027',
              text: 'Otwarta sprawa odchylenia ODCH-0031, rewizja progu zatwierdzona.',
            },
            {
              when: '30 kwietnia 2027',
              text: 'Ostatnia z czterech sesji coachingu zmiany nocnej zaplanowana na koniec miesiąca.',
            },
          ].map((h) => (
            <li key={h.when} className="flex items-start gap-2 text-xs text-c-text-secondary">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-c-text-muted" />
              <span className="min-w-0">
                <span className="font-medium text-c-text">{h.when}</span> — {h.text}
              </span>
            </li>
          ))}
        </ul>
      ),
    },
  ];
}

export function WskaznikJednaKartaScreen(): React.ReactElement {
  const [activeSection, setActiveSection] = useState<string>(INITIAL_SECTION);

  return (
    <AppProviders>
      <FeatureFlagsProvider showDevTools={false}>
        <div style={{ height: '100vh', width: '100vw', overflow: 'hidden' }} className="bg-c-bg">
          <NModeShell
            presentationMode="n"
            onPresentationModeChange={() => {}}
            showModeSwitcher={false}
            header={{
              sticky: true,
              title: 'KPI — Czas przezbrojenia, linia pakowania L3',
              onTitleChange: () => {},
              titleReadOnly: true,
              artifactId: KPI_ID,
              artifactType: 'kpi',
              onSave: () => {},
              saving: false,
              isDirty: false,
              onClose: () => {},
              statusLabel: 'W normie — 2 okresy pod celem',
              statusTone: 'approved',
            }}
            hideToolbarWhenEmpty
            sections={SECTIONS}
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            rightPanel={
              <ArtifactRightPanel
                sections={buildRightPanelSections()}
                className={ARTIFACT_PANEL_CARD_CLASS_DOCKED}
                ariaLabel="Szczegóły wskaźnika"
              />
            }
          />
        </div>
      </FeatureFlagsProvider>
    </AppProviders>
  );
}

export default WskaznikJednaKartaScreen;
