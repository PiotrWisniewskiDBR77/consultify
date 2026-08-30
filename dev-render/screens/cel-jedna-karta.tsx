/**
 * CEL (OKR) — JEDNA KARTA N (2026-08-30).
 *
 * ── DECYZJA WŁAŚCICIELA ────────────────────────────────────────────────────
 * `docs/program/grafika/DECYZJA_WYNIKI_TRZY_POZIOMY.md`: cel dostaje TĘ SAMĄ
 * formułę co ROI (`roi-jedna-karta.tsx`) i tę samą konstrukcję co wskaźnik
 * (`wskaznik-jedna-karta.tsx`) — rozstrzygnięcie nr 3: „Cele mają tę samą
 * konstrukcję co wskaźniki — trzy poziomy, nie cztery. Właściciel celu jest
 * KOLUMNĄ, po której filtrujesz. Jedna konstrukcja dla obu rodzin."
 *
 * Pięć sekcji jednej narracji:
 *   1. Cel                — co chcemy osiągnąć i dlaczego, właściciel, okres
 *   2. Kluczowe rezultaty  — start / cel / bieżąca wartość, jak liczony postęp
 *   3. Postęp              — jak idzie, historia przez okres
 *   4. Powiązania          — z jakimi inicjatywami/wskaźnikami się łączy i co
 *                            to wiązanie REALNIE robi (nie dekoracja)
 *   5. Refleksja           — co wyszło na koniec cyklu, czego się nauczyliśmy
 *
 * ── HISTORIA KLIENTA (kontynuacja `roi-jedna-karta.tsx` i
 * `wskaznik-jedna-karta.tsx`) ───────────────────────────────────────────────
 * Ten sam przypadek: NordFood, linia pakowania L3, program SMED. Ten cel to
 * OKR poziomu operacyjnego: „Zwiększyć przepustowość linii pakowania L3 bez
 * dodatkowego zatrudnienia", właściciel Anna Kowalczyk (Dyrektor Operacyjna),
 * okres Q3 2026 – Q2 2027 (trzy kwartały cyklu, zamknięty). Jeden z trzech
 * kluczowych rezultatów CZYTA WARTOŚĆ bezpośrednio ze wskaźnika
 * `kpi-czas-przezbrojenia-l3` — to jest ta sama liczba widziana z poziomu
 * celu. Jeden kluczowy rezultat NIE ZOSTAŁ osiągnięty na koniec cyklu —
 * uczciwość ponad optymizm, zgodnie z wymogiem zadania.
 *
 * ── POWŁOKA ─────────────────────────────────────────────────────────────
 * Te same wspólne cegiełki SPEC-A co ROI i wskaźnik: `NModeShell` +
 * `ArtifactRightPanel` (7 sekcji kanonu, `ARTIFACT_PANEL_SECTION_ORDER`) +
 * `ArtifactPropertiesTable` + `PreviewRelations`. Zero własnego layoutu.
 *
 * URL: ?screen=cel-jedna-karta[&lang=pl][&theme=light|dark][&sekcja=cel|kluczowe-rezultaty|postep|powiazania|refleksja]
 */
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Compass,
  Download,
  FileSpreadsheet,
  FileText,
  Flag,
  Gauge,
  History as HistoryIcon,
  Link2,
  ListChecks,
  MessageSquare,
  Rocket,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import React, { useState } from 'react';

import { ArtifactPropertiesTable } from '../../src/components/standard/ArtifactPropertiesTable';
import {
  ARTIFACT_PANEL_CARD_CLASS_DOCKED,
  ArtifactRightPanel,
  type ArtifactRightPanelSection,
} from '../../src/components/standard/ArtifactRightPanel';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import { PreviewRelations } from '../../src/components/shared/PreviewPane/PreviewRelations';
import {
  NModeContentBlock,
  NModeShell,
  type NModeSection,
} from '../../src/components/shared/NModeLayout';
import { AppProviders } from '../../src/providers/AppProviders';
import { useAppStore } from '../../src/store/useAppStore';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

useAppStore.setState({
  theme: new URLSearchParams(window.location.search).get('theme') === 'dark' ? 'dark' : 'light',
} as any);

const OKR_ID = 'okr-zdolnosc-l3';
const SCOPE = `okr:${OKR_ID}`;

const SEKCJA_PARAM = new URLSearchParams(window.location.search).get('sekcja');
const SECTION_ALIASES: Record<string, string> = {
  cel: 'cel',
  'kluczowe-rezultaty': 'kluczowe-rezultaty',
  postep: 'postep',
  powiazania: 'powiazania',
  refleksja: 'refleksja',
};
const INITIAL_SECTION = (SEKCJA_PARAM && SECTION_ALIASES[SEKCJA_PARAM]) || 'cel';

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
      <div key={r.label} className="flex items-baseline justify-between gap-3 border-b border-c-border-subtle/60 pb-1.5">
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

// Pasek postępu — wyłącznie tokeny c-*, brak crimsonu.
const ProgressBar: React.FC<{ pct: number; tone?: 'neutral' | 'success' | 'warning' | 'danger' }> = ({
  pct,
  tone = 'neutral',
}) => {
  const fillClass =
    tone === 'success'
      ? 'bg-c-success'
      : tone === 'danger'
        ? 'bg-c-danger'
        : tone === 'warning'
          ? 'bg-c-warning'
          : 'bg-c-text-muted';
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-c-surface-raised">
      <div className={`h-full rounded-full ${fillClass}`} style={{ width: `${clamped}%` }} />
    </div>
  );
};

// ── SEKCJA 1: CEL ─────────────────────────────────────────────────────────
const CelContent: React.FC = () => (
  <div className="flex flex-col gap-4">
    <NModeContentBlock blockId="cel-oswiadczenie" scope={SCOPE} title="Co chcemy osiągnąć" readMode>
      <p className="text-xs leading-relaxed text-c-text-secondary">
        Zwiększyć przepustowość linii pakowania L3 na tyle, żeby pokryć rosnący popyt bez
        dodatkowej zmiany ani dodatkowego zatrudnienia — wyłącznie odzyskując czas maszyny
        tracony dziś na przezbrojeniach. Linia pracuje na 91% obłożenia i traci zamówienia,
        których dziś fizycznie nie da się obsłużyć przy obecnym czasie przezbrojeń.
      </p>
    </NModeContentBlock>

    <NModeContentBlock blockId="cel-dlaczego" scope={SCOPE} title="Dlaczego to ważne teraz" readMode>
      <Bullets
        items={[
          'Dział sprzedaży zgłasza popyt przekraczający dzisiejszą zdolność linii L3 o ok. 6% od Q2 2026.',
          'Alternatywa (dodatkowa zmiana lub druga linia) kosztuje wielokrotnie więcej niż program SMED i wymaga rekrutacji.',
          'Program SMED (inicjatywa powiązana) jest już w toku — ten cel nadaje mu miarę biznesową, nie tylko techniczną.',
        ]}
      />
    </NModeContentBlock>

    <NModeContentBlock blockId="cel-parametry" scope={SCOPE} title="Parametry celu" readMode>
      <KV
        rows={[
          { label: 'Właściciel celu', value: 'Anna Kowalczyk (Dyrektor Operacyjna)' },
          { label: 'Okres', value: 'Q3 2026 – Q2 2027 (3 kwartały, cykl zamknięty)' },
          { label: 'Poziom', value: 'Operacyjny — Zakład NordFood, linia pakowania L3' },
          { label: 'Powiązana inicjatywa', value: 'Skrócenie przezbrojeń (SMED), linia pakowania L3' },
          { label: 'Status cyklu', value: 'Zamknięty — 30 czerwca 2027' },
        ]}
      />
    </NModeContentBlock>
  </div>
);

// ── SEKCJA 2: KLUCZOWE REZULTATY ────────────────────────────────────────────
const KluczoweRezultatyContent: React.FC = () => (
  <div className="flex flex-col gap-4">
    <NModeContentBlock blockId="kr-jak-liczymy" scope={SCOPE} title="Jak liczony jest postęp" readMode>
      <p className="text-xs leading-relaxed text-c-text-secondary">
        Postęp każdego kluczowego rezultatu = <strong className="text-c-text">(bieżąca − startowa) ÷ (docelowa − startowa)</strong>,
        ograniczony do przedziału 0–100%. KR1 czyta bieżącą wartość automatycznie z pomiarów
        wskaźnika „Czas przezbrojenia linii L3" (sekcja „Powiązania") — nie jest wpisywany
        ręcznie.
      </p>
    </NModeContentBlock>

    <NModeContentBlock blockId="kr1" scope={SCOPE} title="KR1 — Skrócić czas przezbrojenia" readMode>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-3">
          <StatTile label="Start" value="47 min" sub="sierpień 2026" tone="neutral" icon={Gauge} />
          <StatTile label="Cel" value="26 min" sub="rewidowany 5 marca 2027" tone="neutral" icon={Target} />
          <StatTile label="Bieżąca" value="25 min" sub="maj 2027 (ostatni pomiar)" tone="success" icon={TrendingUp} />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px] text-c-text-muted">
            <span>Postęp</span>
            <span className="font-semibold text-c-success">105% (cel przekroczony)</span>
          </div>
          <ProgressBar pct={100} tone="success" />
        </div>
        <p className="text-[11px] leading-relaxed text-c-text-muted">
          Wartość czytana automatycznie z pomiarów wskaźnika „Czas przezbrojenia linii L3" —
          bieżąca 25 min jest LEPSZA niż rewidowany cel 26 min, stąd postęp powyżej 100%.
        </p>
      </div>
    </NModeContentBlock>

    <NModeContentBlock blockId="kr2" scope={SCOPE} title="KR2 — Zwiększyć liczbę przezbrojeń dziennie" readMode>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-3">
          <StatTile label="Start" value="4 / dzień" sub="sierpień 2026" tone="neutral" icon={Gauge} />
          <StatTile label="Cel" value="6 / dzień" sub="bez zmiany" tone="neutral" icon={Target} />
          <StatTile label="Bieżąca" value="5,4 / dzień" sub="czerwiec 2027 (koniec cyklu)" tone="warning" icon={TrendingUp} />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px] text-c-text-muted">
            <span>Postęp</span>
            <span className="font-semibold text-c-warning">70% — NIE osiągnięty na koniec cyklu</span>
          </div>
          <ProgressBar pct={70} tone="warning" />
        </div>
        <p className="text-[11px] leading-relaxed text-c-text-muted">
          Skrócony czas przezbrojenia (KR1) nie przełożył się w pełni na dodatkowe partie —
          zmiana nocna wciąż odrabia zaległość w certyfikacji, więc rzeczywista liczba
          przezbrojeń rośnie wolniej niż pozwalałby na to sam czas. Rozwinięte w „Refleksji".
        </p>
      </div>
    </NModeContentBlock>

    <NModeContentBlock blockId="kr3" scope={SCOPE} title="KR3 — Podnieść obłożenie linii L3" readMode>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-3">
          <StatTile label="Start" value="91%" sub="sierpień 2026" tone="neutral" icon={Gauge} />
          <StatTile label="Cel" value="97%" sub="bez zmiany" tone="neutral" icon={Target} />
          <StatTile label="Bieżąca" value="94%" sub="czerwiec 2027 (koniec cyklu)" tone="success" icon={TrendingUp} />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px] text-c-text-muted">
            <span>Postęp</span>
            <span className="font-semibold text-c-success">50%</span>
          </div>
          <ProgressBar pct={50} tone="success" />
        </div>
      </div>
    </NModeContentBlock>
  </div>
);

// ── SEKCJA 3: POSTĘP ──────────────────────────────────────────────────────
const PostepContent: React.FC = () => (
  <div className="flex flex-col gap-4">
    <NModeContentBlock blockId="postep-kafle" scope={SCOPE} title="Stan cyklu na dzień zamknięcia (30 czerwca 2027)" readMode>
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="KR1 — czas przezbrojenia" value="105%" tone="success" icon={CheckCircle2} />
        <StatTile label="KR2 — przezbrojeń dziennie" value="70%" tone="warning" icon={AlertTriangle} />
        <StatTile label="KR3 — obłożenie linii" value="50%" tone="success" icon={TrendingUp} />
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-c-text-muted">
        Średni postęp celu: <strong className="text-c-text">75%</strong>. Dwa z trzech
        kluczowych rezultatów osiągnięte lub przekroczone; KR2 zamknięty poniżej targetu —
        cel jako całość NIE uznajemy za w pełni zrealizowany.
      </p>
    </NModeContentBlock>

    <NModeContentBlock blockId="postep-historia" scope={SCOPE} title="Historia przez okres" readMode>
      <SimpleTable
        head={['Kwartał', 'KR1 (czas przezbrojenia)', 'KR2 (przezbrojeń/dzień)', 'KR3 (obłożenie)', 'Komentarz']}
        rows={[
          ['Q3 2026', '44 min', '4,1', '91%', 'Start cyklu, program SMED w rozruchu.'],
          ['Q4 2026', '31 min', '4,6', '92%', 'Zmiana dzienna certyfikowana w pełni.'],
          [
            'Q1 2027',
            <span key="q1" className="text-c-warning">31 min</span>,
            '4,9',
            '93%',
            'Luty: pogorszenie czasu przezbrojenia (zmiana nocna) — patrz karta wskaźnika.',
          ],
          ['Q2 2027 (koniec cyklu)', '25 min', <span key="q2" className="text-c-warning">5,4</span>, '94%', 'Cykl zamknięty — KR2 poniżej targetu.'],
        ]}
      />
    </NModeContentBlock>
  </div>
);

// ── SEKCJA 4: POWIĄZANIA ─────────────────────────────────────────────────────
const PowiazaniaContent: React.FC = () => (
  <div className="flex flex-col gap-4">
    <NModeContentBlock blockId="powiazania-inicjatywa" scope={SCOPE} title="Inicjatywa" readMode>
      <div className="flex items-start gap-2 rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 py-2.5 text-xs text-c-text">
        <Rocket size={16} className="mt-0.5 shrink-0 text-c-text-muted" />
        <span>
          <strong>Skrócenie przezbrojeń (SMED) — linia pakowania L3.</strong> Co robi to
          wiązanie: postęp inicjatywy (kamienie milowe, budżet) jest widoczny z tej karty
          celu przez sekcję Powiązania w prawym panelu; cel z kolei daje inicjatywie miarę
          sukcesu biznesowego — inicjatywa może być „ukończona technicznie" i cel wciąż
          niepełny, dokładnie jak dziś (KR2).
        </span>
      </div>
    </NModeContentBlock>

    <NModeContentBlock blockId="powiazania-wskaznik" scope={SCOPE} title="Wskaźnik" readMode>
      <div className="flex items-start gap-2 rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 py-2.5 text-xs text-c-text">
        <Gauge size={16} className="mt-0.5 shrink-0 text-c-text-muted" />
        <span>
          <strong>KPI: Czas przezbrojenia linii L3.</strong> Co robi to wiązanie: KR1 tej
          karty NIE ma własnej, ręcznie wpisywanej wartości bieżącej — czyta ją automatycznie
          z ostatniego pomiaru wskaźnika. Kiedy wskaźnik dostaje nowy pomiar (co miesiąc),
          KR1 aktualizuje się bez żadnej akcji właściciela celu. To samo dotyczy progu: gdy
          próg wskaźnika się zmienia (patrz „Rodowód" karty wskaźnika), cel KR1 zmienia się
          razem z nim.
        </span>
      </div>
    </NModeContentBlock>

    <NModeContentBlock blockId="powiazania-roi" scope={SCOPE} title="Analiza ROI" readMode>
      <div className="flex items-start gap-2 rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 py-2.5 text-xs text-c-text">
        <BarChart3 size={16} className="mt-0.5 shrink-0 text-c-text-muted" />
        <span>
          <strong>ROI: Skrócenie przezbrojeń (SMED), linia pakowania L3.</strong> Co robi to
          wiązanie: cel tłumaczy postęp operacyjny (minuty, sztuki) na wartość finansową w
          analizie ROI. Rozjazd finansowy opisany w ROI (Q4 2026 – Q1 2027, −166 000 zł
          względem prognozy) to ten sam okres, w którym KR2 tej karty zaczął odstawać od
          targetu — dwa artefakty pokazują tę samą przyczynę z dwóch stron.
        </span>
      </div>
    </NModeContentBlock>
  </div>
);

// ── SEKCJA 5: REFLEKSJA ──────────────────────────────────────────────────────
const RefleksjaContent: React.FC = () => (
  <div className="flex flex-col gap-4">
    <div
      className="flex items-start gap-2 rounded-lg border border-c-warning/40 bg-c-warning/10 px-3 py-2.5 text-xs text-c-text"
      role="note"
    >
      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-c-warning" />
      <span>
        Cykl zamknięty 30 czerwca 2027 z jednym kluczowym rezultatem{' '}
        <strong>nieosiągniętym</strong> (KR2, 70%). Nie chowamy tego — poniżej jest wprost
        napisane, dlaczego.
      </span>
    </div>

    <NModeContentBlock blockId="refleksja-co-wyszlo" scope={SCOPE} title="Co wyszło" readMode>
      <Bullets
        items={[
          'KR1 (czas przezbrojenia) przekroczony — 25 min przy celu 26 min. Program SMED technicznie działa tam, gdzie jest w pełni wdrożony.',
          'KR3 (obłożenie linii) osiągnięte w połowie drogi do celu — realny, mierzalny wzrost zdolności obsłużenia popytu.',
          'Mechanizm automatycznego czytania KR1 ze wskaźnika sprawdził się — zero rozjazdów między kartą wskaźnika a kartą celu przez cały cykl.',
        ]}
      />
    </NModeContentBlock>

    <NModeContentBlock blockId="refleksja-czego-nie" scope={SCOPE} title="Czego nie osiągnęliśmy i dlaczego" readMode>
      <div className="flex flex-col gap-3 text-xs text-c-text-secondary">
        <p>
          KR2 (liczba przezbrojeń dziennie) zamknięty na <strong className="text-c-text">5,4 z 6</strong> —
          70% celu. Skrócony czas przezbrojenia sam w sobie nie wystarczył: żeby zrobić
          więcej przezbrojeń dziennie, potrzebna jest też PEŁNA certyfikacja SMED na
          wszystkich trzech zmianach, a zmiana nocna domknęła certyfikację dopiero pod koniec
          kwietnia 2027 — zbyt późno, żeby nadrobić różnicę do końca cyklu (30 czerwca).
        </p>
        <p>
          Błąd planistyczny do zapamiętania: cel zakładał, że skrócenie czasu przezbrojenia
          (KR1) automatycznie przełoży się na więcej przezbrojeń dziennie (KR2) w tym samym
          tempie. W praktyce KR2 ma własne ograniczenie — harmonogram zmian i dostępność
          certyfikowanych operatorów — które trzeba było modelować jako osobną zależność, nie
          pochodną KR1.
        </p>
      </div>
    </NModeContentBlock>

    <NModeContentBlock blockId="refleksja-dalej" scope={SCOPE} title="Co robimy dalej" readMode>
      <Bullets
        items={[
          'Nowy cykl (Q3 2027 – Q1 2028) przejmuje KR2 z korektą metody: target rozbity na etapy zależne od certyfikacji per zmiana, nie jeden łączny target.',
          'KR1 i KR3 zamknięte jako osiągnięte — nie wchodzą do nowego cyklu w tej formie; wskaźnik czasu przezbrojenia dalej mierzony jako utrzymanie, nie cel wzrostowy.',
          'Właściciel: Anna Kowalczyk. Przegląd otwarcia nowego cyklu zaplanowany na 10 lipca 2027.',
        ]}
      />
    </NModeContentBlock>
  </div>
);

// ── DEFINICJE SEKCJI LEWEGO MENU ────────────────────────────────────────────
const SECTIONS: NModeSection[] = [
  {
    id: 'cel',
    icon: Compass,
    label: { en: 'Objective', pl: 'Cel' },
    component: <CelContent />,
  },
  {
    id: 'kluczowe-rezultaty',
    icon: ListChecks,
    label: { en: 'Key results', pl: 'Kluczowe rezultaty' },
    component: <KluczoweRezultatyContent />,
  },
  {
    id: 'postep',
    icon: TrendingUp,
    label: { en: 'Progress', pl: 'Postęp' },
    component: <PostepContent />,
  },
  {
    id: 'powiazania',
    icon: Link2,
    label: { en: 'Relations', pl: 'Powiązania' },
    component: <PowiazaniaContent />,
  },
  {
    id: 'refleksja',
    icon: Flag,
    label: { en: 'Reflection', pl: 'Refleksja' },
    component: <RefleksjaContent />,
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
            <ArrowUpRight size={13} className="shrink-0 text-c-text-muted" />
            Otwórz nowy cykl (Q3 2027 – Q1 2028)
          </button>
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 text-left text-xs font-medium text-c-text-secondary transition hover:bg-c-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
          >
            <ListChecks size={13} className="shrink-0 text-c-text-muted" />
            Dodaj kluczowy rezultat
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
            { id: 'kod', label: 'Numer celu', value: 'OKR-0019' },
            { id: 'status', label: 'Status', value: 'Zamknięty — 2 / 3 KR osiągnięte' },
            { id: 'wlasciciel', label: 'Właściciel', value: 'Anna Kowalczyk' },
            { id: 'poziom', label: 'Poziom', value: 'Operacyjny — Zakład NordFood' },
            { id: 'okres', label: 'Okres', value: 'Q3 2026 – Q2 2027' },
            { id: 'postep', label: 'Średni postęp', value: '75%', mono: true },
            { id: 'zamkniecie', label: 'Data zamknięcia', value: '30 czerwca 2027' },
            { id: 'nastepny', label: 'Kolejny cykl', value: 'Q3 2027 – Q1 2028' },
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
              label: 'KPI: Czas przezbrojenia linii L3',
              type: 'kpi',
              icon: Gauge,
            },
            {
              id: 'roi-smed-linia-pakowania-l3',
              label: 'ROI: Skrócenie przezbrojeń (SMED), linia pakowania L3',
              type: 'analysis',
              icon: BarChart3,
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
              Dowody, na których stoją kluczowe rezultaty
            </div>
            <Bullets
              items={[
                'KR1 — automatyczny odczyt z wskaźnika „Czas przezbrojenia linii L3" (SAP PM).',
                'KR2 — rejestr harmonogramu produkcji linii L3, dział planowania NordFood.',
                'KR3 — raport obłożenia linii, kontroling zakładu, odczyt miesięczny.',
              ]}
            />
          </div>
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-c-text-secondary">
              Gdzie ten cel przestaje działać
            </div>
            <Bullets
              items={[
                'Cel zakładał liniową zależność KR2 od KR1 — założenie okazało się błędne (patrz „Refleksja").',
                'Postęp KR1 może przekroczyć 100%, jeśli wskaźnik poprawi się bardziej niż zakładał cel — pasek ograniczony do 100% w prezentacji.',
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
          items={[
            'Podsumowanie cyklu (PDF) — zatwierdzone 30 czerwca 2027, wersja 1.0.',
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
              when: '28 czerwca 2027, 11:20',
              text:
                'KR2 na 70% to nie porażka programu — to sygnał, że planowaliśmy zależność KR1→KR2 zbyt prosto. Chcę to rozbicie w otwarciu nowego cyklu, nie tylko w refleksji.',
            },
            {
              author: 'Marek Zieliński',
              when: '29 czerwca 2027, 09:05',
              text:
                'Zgoda. W nowym cyklu proponuję target KR2 rozbity per zmiana, z własną datą osiągnięcia zależną od certyfikacji — szczegóły przygotuję na przegląd 10 lipca.',
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
            { when: '20 sierpnia 2026', text: 'Cel utworzony i powiązany z inicjatywą SMED L3.' },
            { when: '1 września 2026', text: 'Cykl Q3 2026 – Q2 2027 otwarty, baseline KR1–KR3 zamrożony.' },
            { when: '5 marca 2027', text: 'Target KR1 zaktualizowany automatycznie po rewizji progu wskaźnika (22 → 26 min).' },
            { when: '30 czerwca 2027', text: 'Cykl zamknięty — KR1 i KR3 osiągnięte, KR2 na 70%.' },
            { when: '10 lipca 2027', text: 'Zaplanowany przegląd otwarcia nowego cyklu.' },
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

export function CelJednaKartaScreen(): React.ReactElement {
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
              title: 'Cel — Zwiększyć przepustowość linii pakowania L3',
              onTitleChange: () => {},
              titleReadOnly: true,
              artifactId: OKR_ID,
              artifactType: 'kpi',
              onSave: () => {},
              saving: false,
              isDirty: false,
              onClose: () => {},
              statusLabel: 'Zamknięty — 2 / 3 KR osiągnięte',
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
                ariaLabel="Szczegóły celu"
              />
            }
          />
        </div>
      </FeatureFlagsProvider>
    </AppProviders>
  );
}

export default CelJednaKartaScreen;
