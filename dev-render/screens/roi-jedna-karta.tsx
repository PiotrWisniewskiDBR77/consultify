/**
 * ROI — JEDNA KARTA N (2026-08-30).
 *
 * ── DECYZJA WŁAŚCICIELA ────────────────────────────────────────────────────
 * Piotr odrzucił trzy osobne ekrany ROI (`results-vnext-roi-registry` →
 * `results-vnext-roi-full-tool` → `results-vnext-roi-model` →
 * `results-vnext-roi-pir-outcomes`) z jednym uzasadnieniem: „ROI to jedna
 * analiza i powinna mieć formułę N-karty. […] To musi być n-karta.” Na
 * kolejnych ekranach powtórzył: „wniosek jest dokładnie taki jak wcześniej —
 * musimy przenieść to do jednej n-karty” i „to jest kolejna N-karta w jednym
 * ROI-u”. Zatwierdzony wzorzec: karta Inicjatywy („Poza tym wygląda
 * zajebiście”).
 *
 * Ten plik to PROTOTYP tej jednej karty — rejestr zostaje listą (poziom
 * wyżej, poza zakresem tego ekranu), a trzy dzisiejsze ekrany (Model / Pełne
 * narzędzie / Wyniki po wdrożeniu) stają się SEKCJAMI tej samej karty:
 *
 *   1. Założenia              — co przyjmujemy (inwestycja, horyzont, stopa,
 *                                źródła liczb)
 *   2. Model                  — jak liczymy (przepływy, wzór, wrażliwość)
 *   3. Wynik                  — ile wychodzi (ROI, NPV, IRR, payback)
 *   4. Wyniki po wdrożeniu    — co wyszło naprawdę, zestawione z prognozą
 *   5. Wnioski i rekomendacja — co z tego wynika dla decyzji
 *
 * ── DLACZEGO NOWY KOMPONENT, A NIE MONTAŻ PRODUKCYJNEGO WIDOKU ────────────
 * W przeciwieństwie do `karta-initiative.tsx` (montuje REALNY
 * `InitiativeDocumentView`), dla ROI nie istnieje jeszcze produkcyjny widok
 * jednej karty — to właśnie ten brak ma zamknąć to zadanie. Ekran składa się
 * więc z tych samych WSPÓLNYCH cegiełek powłoki SPEC-A, których używają
 * realne karty N (Tool, Task, Decision, Initiative):
 *   `NModeShell` (Menu 1 = `NModeHeader`, lewy rail sekcji = `NModeLeftNav`,
 *   centrum = `NModeCanvas` z blokami `NModeContentBlock`) +
 *   `ArtifactRightPanel` (prawy pas, 7 sekcji kanonu, kolejność
 *   `ARTIFACT_PANEL_SECTION_ORDER`) + `ArtifactPropertiesTable` +
 *   `PreviewRelations`. Zero własnego layoutu, zero nowych klas — to jest
 *   dokładnie ta sama powłoka co karta Inicjatywy, wypełniona treścią ROI.
 *
 * ── HISTORIA KLIENTA (spójna z `karta-initiative.tsx`) ─────────────────────
 * Ten sam przypadek co w karcie inicjatywy: NordFood, linia pakowania L3,
 * program SMED (skrócenie czasu przezbrojeń). Sponsor: Anna Kowalczyk
 * (Dyrektor Operacyjna). Właściciel: Marek Zieliński (Kierownik Linii L3).
 * ROI zostaje otwarty ok. 6 miesięcy po starcie inicjatywy — mamy już
 * PIERWSZE dane rzeczywiste, i są GORSZE niż prognoza (uczciwy rozjazd,
 * zgodnie z wymogiem zadania — nie chowamy pogorszenia).
 *
 * URL: ?screen=roi-jedna-karta[&lang=pl][&theme=light|dark][&sekcja=zalozenia|model|wynik|wyniki-po-wdrozeniu|wnioski]
 * `sekcja` ustawia sekcję aktywną przy starcie (do zrzutów per sekcja —
 * scripts/dev/grafika-zrzuty.mjs --parametry='sekcja=...').
 */
import {
  AlertTriangle,
  BarChart3,
  Calculator,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Gauge,
  History as HistoryIcon,
  Link2,
  MessageSquare,
  PauseCircle,
  Percent,
  Rocket,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
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

const ROI_CASE_ID = 'roi-smed-linia-pakowania-l3';
const SCOPE = `roi:${ROI_CASE_ID}`;

const SEKCJA_PARAM = new URLSearchParams(window.location.search).get('sekcja');
const SECTION_ALIASES: Record<string, string> = {
  zalozenia: 'zalozenia',
  model: 'model',
  wynik: 'wynik',
  'wyniki-po-wdrozeniu': 'wyniki-po-wdrozeniu',
  wnioski: 'wnioski',
};
const INITIAL_SECTION = (SEKCJA_PARAM && SECTION_ALIASES[SEKCJA_PARAM]) || 'zalozenia';

// ── liczby formatowane po polsku ────────────────────────────────────────────
const pln = (v: number): string => `${v.toLocaleString('pl-PL')} zł`;
const proc = (v: number): string => `${v.toLocaleString('pl-PL', { maximumFractionDigits: 0 })}%`;

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

// ── SEKCJA 1: ZAŁOŻENIA ─────────────────────────────────────────────────────
const ZalozeniaContent: React.FC = () => (
  <div className="flex flex-col gap-4">
    <NModeContentBlock
      blockId="zalozenia-parametry"
      scope={SCOPE}
      title="Parametry przypadku biznesowego"
      readMode
    >
      <KV
        rows={[
          { label: 'Inwestycja początkowa', value: pln(480000) },
          { label: 'Horyzont analizy', value: '24 miesiące (wrzesień 2026 – sierpień 2028)' },
          { label: 'Stopa dyskontowa', value: `${proc(10)} rocznie (koszt kapitału NordFood)` },
          { label: 'Data startu inwestycji', value: '1 września 2026' },
          { label: 'Metoda liczenia', value: 'DCF, przepływy miesięczne, NPV/IRR/payback' },
          { label: 'Waluta', value: 'PLN, ceny stałe (bez inflacji w prognozie)' },
        ]}
      />
    </NModeContentBlock>

    <NModeContentBlock
      blockId="zalozenia-sklad-inwestycji"
      scope={SCOPE}
      title="Na co idzie 480 000 zł"
      readMode
    >
      <SimpleTable
        head={['Pozycja', 'Kwota']}
        rows={[
          ['Szkolenie operatorów SMED (3 zmiany, 24 osoby)', pln(140000)],
          ['Wózki narzędziowe i oznakowanie stanowisk (6 szt.)', pln(165000)],
          ['Przezbrojenie stanowisk kontrolnych linii L3', pln(120000)],
          ['Rezerwa na wdrożenie i korekty (10%)', pln(55000)],
        ]}
      />
    </NModeContentBlock>

    <NModeContentBlock blockId="zalozenia-zrodla" scope={SCOPE} title="Źródła liczb" readMode>
      <Bullets
        items={[
          'Czas przezbrojeń „przed” — raport SAP PM za 6 miesięcy poprzedzających kickoff (styczeń–czerwiec 2026), 1 118 przezbrojeń.',
          'Stawka roboczogodziny operatora — dział HR NordFood, cennik 2026 (koszt pełny, ze składkami).',
          'Cena przestoju linii L3 — kontroling zakładu, na podstawie utraconej marży na opakowanie zbiorcze.',
          'Docelowy czas przezbrojenia po SMED (22 min) — benchmark z pilotażu na linii L1 w Grupie NordFood (2025).',
          'Właściciel liczb: Marek Zieliński (Kierownik Linii L3), zatwierdzone przez Annę Kowalczyk (Sponsor, Dyrektor Operacyjna).',
        ]}
      />
    </NModeContentBlock>
  </div>
);

// ── SEKCJA 2: MODEL ──────────────────────────────────────────────────────────
const ModelContent: React.FC = () => (
  <div className="flex flex-col gap-4">
    <NModeContentBlock
      blockId="model-jak-liczymy"
      scope={SCOPE}
      title="Jak liczymy oszczędność"
      readMode
    >
      <div className="flex flex-col gap-3 text-xs text-c-text-secondary">
        <p>
          Model liczy wartość odzyskanego czasu maszyny na linii L3. Dziś przezbrojenie trwa
          <strong className="text-c-text"> 47 minut</strong>; cel programu SMED to
          <strong className="text-c-text"> 22 minuty</strong> — różnica{' '}
          <strong className="text-c-text">25 minut</strong> na każde przezbrojenie.
        </p>
        <SimpleTable
          head={['Krok wyliczenia', 'Wartość']}
          rows={[
            ['Przezbrojeń dziennie (3 zmiany)', '6'],
            ['Dni robocze rocznie', '260'],
            ['Przezbrojeń rocznie', '1 560'],
            ['Oszczędność na przezbrojeniu', '25 min'],
            ['Odzyskany czas maszyny rocznie', '650 godz. (39 000 min)'],
            ['Wartość godziny pracy linii L3', pln(1840)],
            ['Roczna wartość odzyskanej zdolności', pln(1196000)],
          ]}
        />
        <p>
          Odzyskany czas przekłada się na dodatkową produkcję (linia L3 pracuje dziś na {proc(91)}{' '}
          obłożenia — jest popyt, który dziś tracimy na przezbrojeniach), nie na redukcję etatów.
          Korzyść liczona jest jako marża na dodatkowych partiach, nie jako oszczędność na pensjach.
        </p>
      </div>
    </NModeContentBlock>

    <NModeContentBlock
      blockId="model-przeplywy"
      scope={SCOPE}
      title="Przepływy w czasie (skrót)"
      readMode
    >
      <SimpleTable
        head={['Okres', 'Nakład', 'Korzyść brutto', 'Przepływ netto']}
        rows={[
          ['Q3 2026 (inwestycja)', pln(480000), '—', `−${pln(480000)}`],
          ['Q4 2026 (rozruch, 60% targetu)', '—', pln(180000), `+${pln(180000)}`],
          ['Q1 2027 (pełen rozruch)', '—', pln(299000), `+${pln(299000)}`],
          [
            'Q2 2027 – Q2 2028 (stabilna praca, 5 kw.)',
            '—',
            `5 × ${pln(299000)}`,
            `+${pln(1495000)}`,
          ],
        ]}
      />
    </NModeContentBlock>

    <NModeContentBlock
      blockId="model-wrazliwosc"
      scope={SCOPE}
      title="Wrażliwość — co zmienia wynik"
      readMode
    >
      <div className="flex flex-col gap-3">
        <SimpleTable
          head={['Scenariusz docelowego czasu przezbrojenia', 'NPV (24 mies.)']}
          rows={[
            ['Pesymistyczny — 30 min (adopcja słabsza)', pln(210000)],
            ['Bazowy — 22 min (założenie modelu)', pln(620000)],
            ['Optymistyczny — 18 min (pełna adopcja 3 zmian)', pln(890000)],
          ]}
        />
        <p className="text-[11px] leading-relaxed text-c-text-muted">
          Największe ryzyko modelu: adopcja metody SMED przez wszystkie 3 zmiany, nie tylko zmianę
          dzienną. Model NIE zakłada redukcji etatów ani zmiany cen sprzedaży — wyłącznie odzyskany
          czas maszyny.
        </p>
      </div>
    </NModeContentBlock>
  </div>
);

// ── SEKCJA 3: WYNIK (prognoza) ───────────────────────────────────────────────
const WynikContent: React.FC = () => (
  <div className="flex flex-col gap-4">
    <NModeContentBlock
      blockId="wynik-kafle"
      scope={SCOPE}
      title="Wynik prognozy (na dzień zatwierdzenia case'u, 28 sierpnia 2026)"
      readMode
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="ROI (24 mies.)"
          value={proc(168)}
          sub="zysk / nakład"
          tone="success"
          icon={TrendingUp}
        />
        <StatTile
          label="NPV"
          value={pln(620000)}
          sub="przy stopie 10%"
          tone="success"
          icon={Calculator}
        />
        <StatTile
          label="IRR"
          value={proc(62)}
          sub="wewnętrzna stopa zwrotu"
          tone="success"
          icon={Percent}
        />
        <StatTile label="Payback" value="9 mies." sub="zwrot nakładu" tone="success" icon={Clock} />
      </div>
    </NModeContentBlock>

    <NModeContentBlock
      blockId="wynik-narastajaco"
      scope={SCOPE}
      title="Przepływ narastająco"
      readMode
    >
      <SimpleTable
        head={['Okres', 'Przepływ narastająco']}
        rows={[
          ['Q3 2026', `−${pln(480000)}`],
          ['Q4 2026', `−${pln(300000)}`],
          ['Q1 2027', `−${pln(1000)}`],
          ['Q2 2027', `+${pln(298000)}`],
          ['Q4 2027', `+${pln(896000)}`],
          ['Q2 2028 (koniec horyzontu)', `+${pln(1494000)}`],
        ]}
      />
      <p className="mt-3 text-[11px] leading-relaxed text-c-text-muted">
        Próg rentowności (przepływ = 0) wypada między Q4 2026 a Q1 2027 — stąd payback ≈ 9 miesięcy
        od startu inwestycji.
      </p>
    </NModeContentBlock>
  </div>
);

// ── SEKCJA 4: WYNIKI PO WDROŻENIU (uczciwy rozjazd) ─────────────────────────
const WynikiPoWdrozeniuContent: React.FC = () => (
  <div className="flex flex-col gap-4">
    <div
      className="flex items-start gap-2 rounded-lg border border-c-warning/40 bg-c-warning/10 px-3 py-2.5 text-xs text-c-text"
      role="note"
    >
      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-c-warning" />
      <span>
        Pomiar na 28 lutego 2027 (6 miesięcy od startu inwestycji): wynik jest{' '}
        <strong>gorszy niż prognoza</strong>. Przyczyna zdiagnozowana niżej — sekcja „Wnioski i
        rekomendacja”.
      </span>
    </div>

    <NModeContentBlock
      blockId="wpw-kafle"
      scope={SCOPE}
      title="Prognoza vs rzeczywistość — stan na dziś"
      readMode
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="ROI do dziś"
          value={proc(71)}
          sub="prognoza na ten punkt: 104%"
          tone="danger"
          icon={TrendingDown}
        />
        <StatTile
          label="NPV (przeliczone)"
          value={pln(365000)}
          sub="prognoza: 620 000 zł"
          tone="warning"
          icon={Calculator}
        />
        <StatTile
          label="IRR (przeliczone)"
          value={proc(34)}
          sub="prognoza: 62%"
          tone="warning"
          icon={Percent}
        />
        <StatTile
          label="Payback (rewizja)"
          value="~14 mies."
          sub="prognoza: 9 mies."
          tone="warning"
          icon={Clock}
        />
      </div>
    </NModeContentBlock>

    <NModeContentBlock
      blockId="wpw-czas-przezbrojenia"
      scope={SCOPE}
      title="Czas przezbrojenia — cel vs zmierzone"
      readMode
    >
      <SimpleTable
        head={['Zmiana', 'Cel (model)', 'Zmierzone (styczeń–luty 2027)', 'Certyfikacja SMED']}
        rows={[
          ['Zmiana I (dzienna)', '22 min', '23 min', '8/8 operatorów'],
          ['Zmiana II (popołudniowa)', '22 min', '29 min', '5/8 operatorów'],
          ['Zmiana III (nocna)', '22 min', '41 min', '1/8 operatorów'],
          ['Średnia ważona linii L3', '22 min', '31 min', '14/24 operatorów'],
        ]}
      />
    </NModeContentBlock>

    <NModeContentBlock
      blockId="wpw-korzysc"
      scope={SCOPE}
      title="Korzyść zrealizowana vs prognozowana"
      readMode
    >
      <SimpleTable
        head={['Okres', 'Korzyść prognozowana', 'Korzyść zrealizowana', 'Rozjazd']}
        rows={[
          [
            'Q4 2026',
            pln(180000),
            pln(112000),
            <span key="q4" className="text-c-danger">
              −{pln(68000)}
            </span>,
          ],
          [
            'Q1 2027',
            pln(299000),
            pln(201000),
            <span key="q1" className="text-c-danger">
              −{pln(98000)}
            </span>,
          ],
          [
            'Razem do dziś',
            pln(479000),
            pln(313000),
            <span key="tot" className="text-c-danger">
              −{pln(166000)}
            </span>,
          ],
        ]}
      />
    </NModeContentBlock>
  </div>
);

// ── SEKCJA 5: WNIOSKI I REKOMENDACJA ─────────────────────────────────────────
const WnioskiContent: React.FC = () => (
  <div className="flex flex-col gap-4">
    <NModeContentBlock
      blockId="wnioski-przyczyna"
      scope={SCOPE}
      title="Przyczyna rozjazdu"
      readMode
    >
      <div className="flex flex-col gap-3 text-xs text-c-text-secondary">
        <p>
          Rozjazd nie leży w modelu, tylko w adopcji. Zmiana nocna (III) ma dziś tylko{' '}
          <strong className="text-c-text">1 z 8 operatorów</strong> certyfikowanych w metodzie SMED
          — reszta pracuje starym sposobem (41 min zamiast 22 min). Zmiana popołudniowa (II) jest w
          połowie drogi. Ponieważ obie zmiany razem odpowiadają za{' '}
          <strong className="text-c-text">2/3</strong> wolumenu przezbrojeń, średnia ważona linii
          ciągnie w dół cały wynik finansowy.
        </p>
        <p>
          Harmonogram szkoleń zakładał, że trener przejdzie przez wszystkie zmiany w ciągu 8 tygodni
          od kickoffu — w praktyce trener miał dostęp do zmiany nocnej dopiero w tygodniu 14. przez
          konflikt z przeglądem UDT linii L3.
        </p>
      </div>
    </NModeContentBlock>

    <NModeContentBlock blockId="wnioski-rekomendacja" scope={SCOPE} title="Rekomendacja" readMode>
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-2 rounded-lg border border-c-info/30 bg-c-info/10 px-3 py-2.5 text-xs text-c-text">
          <Target size={16} className="mt-0.5 shrink-0 text-c-info" />
          <span>
            <strong>Decyzja proponowana:</strong> kontynuować inwestycję, ale zrewidować target
            czasu przezbrojenia do realistycznych 26 minut (nie 22) i przesunąć pełną rentowność
            case'u na Q3 2027.
          </span>
        </div>
        <Bullets
          items={[
            'Dodatkowa runda coachingu SMED dla zmiany nocnej — 4 sesje, dedykowany trener, do końca kwietnia 2027 (właściciel: Marek Zieliński).',
            'Rewizja modelu: docelowy czas przezbrojenia 26 min zamiast 22 min — nowe NPV bazowe do przeliczenia po zamknięciu coachingu.',
            'Przegląd PIR (Post-Implementation Review) zaplanowany na 30 czerwca 2027 — pełne porównanie prognoza/rzeczywistość po roku.',
            'Sponsor (Anna Kowalczyk) informowana miesięcznym raportem odchylenia do czasu domknięcia coachingu zmiany nocnej.',
          ]}
        />
      </div>
    </NModeContentBlock>
  </div>
);

// ── DEFINICJE SEKCJI LEWEGO MENU ────────────────────────────────────────────
const SECTIONS: NModeSection[] = [
  {
    id: 'zalozenia',
    icon: ClipboardList,
    label: { en: 'Assumptions', pl: 'Założenia' },
    component: <ZalozeniaContent />,
  },
  {
    id: 'model',
    icon: Calculator,
    label: { en: 'Model', pl: 'Model' },
    component: <ModelContent />,
  },
  {
    id: 'wynik',
    icon: BarChart3,
    label: { en: 'Result', pl: 'Wynik' },
    component: <WynikContent />,
  },
  {
    id: 'wyniki-po-wdrozeniu',
    icon: Gauge,
    label: { en: 'Post-implementation results', pl: 'Wyniki po wdrożeniu' },
    component: <WynikiPoWdrozeniuContent />,
  },
  {
    id: 'wnioski',
    icon: ScrollText,
    label: { en: 'Conclusions & recommendation', pl: 'Wnioski i rekomendacja' },
    component: <WnioskiContent />,
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
            <Download size={13} className="shrink-0 text-c-text-muted" />
            Eksportuj kartę (PDF)
          </button>
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 text-left text-xs font-medium text-c-text-secondary transition hover:bg-c-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
          >
            <ClipboardList size={13} className="shrink-0 text-c-text-muted" />
            Zaplanuj przegląd PIR
          </button>
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 text-left text-xs font-medium text-c-text-secondary transition hover:bg-c-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
          >
            <PauseCircle size={13} className="shrink-0 text-c-text-muted" />
            Zamroź baseline i skopiuj do wersji roboczej
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
            { id: 'kod', label: 'Numer sprawy', value: 'ANL-0142' },
            { id: 'status', label: 'Status', value: 'W realizacji — rewizja targetu' },
            { id: 'faza', label: 'Faza cyklu', value: 'Realizacja wartości (po wdrożeniu)' },
            { id: 'wlasciciel', label: 'Właściciel', value: 'Marek Zieliński' },
            { id: 'sponsor', label: 'Sponsor', value: 'Anna Kowalczyk' },
            { id: 'inwestycja', label: 'Inwestycja', value: pln(480000), mono: true },
            { id: 'horyzont', label: 'Horyzont', value: '24 mies. (do sie 2028)', mono: true },
            { id: 'aktualizacja', label: 'Ostatnia aktualizacja', value: '28 lutego 2027' },
            { id: 'przeglad', label: 'Następny przegląd (PIR)', value: '30 czerwca 2027' },
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
              id: 'kpi-czas-przezbrojenia-l3',
              label: 'KPI: czas przezbrojenia linii L3',
              type: 'kpi',
              icon: Gauge,
            },
            {
              id: 'dec-budzet-smed',
              label: 'Decyzja: zatwierdzenie budżetu SMED 480 000 zł',
              type: 'decision',
              icon: CheckCircle2,
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
              Dowody, na których stoi model
            </div>
            <Bullets
              items={[
                'Raport SAP PM — czas przezbrojeń styczeń–czerwiec 2026 (1 118 zdarzeń).',
                'Cennik roboczogodziny — dział HR NordFood, 2026.',
                'Cena przestoju linii L3 — kontroling zakładu.',
                'Benchmark 22 min — pilotaż SMED na linii L1, Grupa NordFood 2025.',
              ]}
            />
          </div>
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-c-text-secondary">
              Gdzie model przestaje działać
            </div>
            <Bullets
              items={[
                'Model nie zakłada redukcji etatów — tylko odzyskaną zdolność maszyny.',
                'Ważność benchmarku 22 min zależy od pełnej certyfikacji SMED wszystkich 3 zmian.',
                'Ceny stałe — brak korekty o inflację w horyzoncie 24 miesięcy.',
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
      badge: 2,
      children: (
        <Bullets
          items={[
            'Business case (PDF) — zatwierdzony 28 sierpnia 2026, wersja 1.2.',
            'Raport odchylenia Q4 2026 – Q1 2027 — przekazany Sponsorowi 15 marca 2027.',
          ]}
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
              when: '3 marca 2027, 09:14',
              text: 'Rozjazd na zmianie nocnej mnie nie dziwi — wiedzieliśmy o kolizji z przeglądem UDT. Proszę o plan naprawczy do końca tygodnia, nie o rewizję targetu w dół bez próby domknięcia coachingu.',
            },
            {
              author: 'Marek Zieliński',
              when: '5 marca 2027, 16:40',
              text: 'Plan naprawczy w sekcji „Wnioski i rekomendacja" — 4 sesje coachingu dla zmiany III do końca kwietnia. Target 26 min to scenariusz, jeśli coaching się nie uda w 100%; jeśli się uda, wracamy do 22 min i koryguję ponownie.',
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
              text: 'Case ROI utworzony — powiązany z inicjatywą SMED L3.',
            },
            {
              when: '28 sierpnia 2026',
              text: 'Business case zatwierdzony (Sponsor: Anna Kowalczyk).',
            },
            { when: '1 września 2026', text: 'Baseline zamrożony, inwestycja uruchomiona.' },
            {
              when: '15 marca 2027',
              text: 'Pierwsza migawka rzeczywistych wyników wprowadzona — rozjazd z prognozą wykryty.',
            },
            {
              when: '5 marca 2027',
              text: 'Rekomendacja rewizji targetu (26 min) i plan coachingu zmiany III.',
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

export function RoiJednaKartaScreen(): React.ReactElement {
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
              title: 'ROI — Skrócenie przezbrojeń (SMED), linia pakowania L3',
              onTitleChange: () => {},
              titleReadOnly: true,
              artifactId: ROI_CASE_ID,
              artifactType: 'analysis',
              onSave: () => {},
              saving: false,
              isDirty: false,
              onClose: () => {},
              statusLabel: 'W realizacji — rewizja targetu',
              statusTone: 'review',
            }}
            hideToolbarWhenEmpty
            sections={SECTIONS}
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            rightPanel={
              <ArtifactRightPanel
                sections={buildRightPanelSections()}
                className={ARTIFACT_PANEL_CARD_CLASS_DOCKED}
                ariaLabel="Szczegóły analizy ROI"
              />
            }
          />
        </div>
      </FeatureFlagsProvider>
    </AppProviders>
  );
}

export default RoiJednaKartaScreen;
