import React from 'react';

import { IdeaStageSelectCell } from '@/components/MyWork/IdeaStageSelectCell';
import { ProcessFlowCandidatePreviewCard } from '@/components/MyWork/ProcessFlowCandidatePreviewCard';
import { IDEA_STAGE_BUCKET_LABELS } from '@/components/MyWork/ideaEntryTypes';
import { STAGE_DOT_VAR } from '@/components/MyWork/ideaPreviewMeta';
import type { IdeaStage } from '@/components/MyWork/myIdeasTypes';
import { ChipBase, ChipDot } from '@/components/ui/primitives/chips/chipBase';

/**
 * P-T14 (pilotaż Tomka, DEC-496 pkt XIV) — dwa defekty na jednym ekranie dowodowym.
 *
 * Lewa kolumna PRZED = ODTWORZENIE stanu linii `integracja/20260911`, przepisane
 * 1:1 z kodu linii:
 *   · `IdeasTableContent.tsx` → `renderStageBadge(idea.stage)` — sama odznaka,
 *     zero interakcji; etap zmieniało się kebabem (2 kliknięcia do listy);
 *   · `IdeaMapWorkspace.tsx` → blok podglądu kandydata: „3 nodes · 2 edges · v7",
 *     surowe etykiety węzłów sklejone strzałkami, nazwy torów, 12 znaków sha256
 *     w `<code>` — bez nagłówka i bez zdania.
 * Prawa kolumna PO = REALNE komponenty z tej gałęzi (import, nie przerys).
 *
 * Wzorzec zgodny z CLAUDE.md #7: nadzorca renderuje i robi zrzut sam, zanim
 * właściciel cokolwiek zobaczy.
 */

const PRZYKLADY: Array<{ id: string; title: string; stage: IdeaStage }> = [
  { id: 'i1', title: 'Skrócić obieg faktur kosztowych', stage: 'spark' },
  { id: 'i2', title: 'Jedno źródło danych o zapasach', stage: 'incubating' },
  { id: 'i3', title: 'Standard raportu tygodniowego', stage: 'shaping' },
  { id: 'i4', title: 'Automatyczne przypomnienia SLA', stage: 'ready' },
];

const PRZYKLADY_EN: Array<{ id: string; title: string; stage: IdeaStage }> = [
  { id: 'i1', title: 'Shorten the cost-invoice loop', stage: 'spark' },
  { id: 'i2', title: 'One source of stock data', stage: 'incubating' },
  { id: 'i3', title: 'Weekly report standard', stage: 'shaping' },
  { id: 'i4', title: 'Automatic SLA reminders', stage: 'ready' },
];

const PODGLAD = {
  nodeCount: 3,
  edgeCount: 2,
  mapVersion: 7,
  projectionHash: 'a91f3c0b12de4455667788990011223344556677889900aabbccddeeff001122',
};

/** PRZED — odznaka etapu dokładnie jak na linii (bez listy, bez interakcji). */
function OdznakaEtapuPrzed({
  stage,
  isPolish,
}: {
  stage: IdeaStage;
  isPolish: boolean;
}): React.ReactElement {
  return (
    <ChipBase size="sm" leading={<ChipDot colorVar={STAGE_DOT_VAR[stage]} size="sm" />}>
      {isPolish ? IDEA_STAGE_BUCKET_LABELS[stage].pl : IDEA_STAGE_BUCKET_LABELS[stage].en}
    </ChipBase>
  );
}

/** PRZED — blok podglądu kandydata dokładnie jak na linii (telemetria + sha256). */
function PodgladKandydataPrzed({ isPolish }: { isPolish: boolean }): React.ReactElement {
  return (
    <div className="max-w-xs text-xs text-c-text-secondary">
      <div>
        {PODGLAD.nodeCount} nodes · {PODGLAD.edgeCount} edges · v{PODGLAD.mapVersion}
      </div>
      <div>{isPolish ? 'Start → Weryfikacja → Akcept' : 'Start → Review → Approve'}</div>
      <div>{isPolish ? 'Sprzedaż, Operacje' : 'Sales, Operations'}</div>
      <code>{PODGLAD.projectionHash.slice(0, 12)}…</code>
      <button type="button" className="ml-2 underline">
        {isPolish ? 'Anuluj' : 'Cancel'}
      </button>
    </div>
  );
}

function Kolumna({
  tytul,
  podtytul,
  children,
}: {
  tytul: string;
  podtytul: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section className="flex-1 min-w-0 rounded-xl border border-c-border bg-c-surface p-4">
      <h2 className="text-sm font-semibold text-c-text">{tytul}</h2>
      <p className="mb-4 mt-0.5 text-xs text-c-text-muted">{podtytul}</p>
      {children}
    </section>
  );
}

function Tabelka({
  wiersze,
  isPolish,
  interaktywna,
}: {
  wiersze: Array<{ id: string; title: string; stage: IdeaStage }>;
  isPolish: boolean;
  interaktywna: boolean;
}): React.ReactElement {
  const [stany, setStany] = React.useState<Record<string, IdeaStage>>(
    Object.fromEntries(wiersze.map((w) => [w.id, w.stage]))
  );
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-c-border text-left text-xs text-c-text-muted">
          <th className="px-3 py-2 font-medium">{isPolish ? 'Tytuł' : 'Title'}</th>
          <th className="px-3 py-2 font-medium">{isPolish ? 'Etap' : 'Stage'}</th>
        </tr>
      </thead>
      <tbody>
        {wiersze.map((w) => (
          <tr key={w.id} className="border-b border-c-border-subtle">
            <td className="px-3 py-2.5 align-middle text-c-text">{w.title}</td>
            <td className="px-3 py-2.5 align-middle">
              {interaktywna ? (
                <IdeaStageSelectCell
                  stage={stany[w.id]}
                  isPolish={isPolish}
                  ideaTitle={w.title}
                  onChangeStage={(stage) => setStany((prev) => ({ ...prev, [w.id]: stage }))}
                />
              ) : (
                <OdznakaEtapuPrzed stage={stany[w.id]} isPolish={isPolish} />
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function PT14PomyslyEtapKandydatScreen(): React.ReactElement {
  const isPolish =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('lang') !== 'en';
  const wiersze = isPolish ? PRZYKLADY : PRZYKLADY_EN;

  return (
    <div className="min-h-screen bg-c-bg p-8 text-c-text">
      <h1 className="text-lg font-semibold">
        P-T14 · {isPolish ? 'Pomysły — etap i kandydatura' : 'Ideas — stage and candidate'}
      </h1>
      <p className="mb-6 mt-1 max-w-3xl text-xs text-c-text-secondary">
        {isPolish
          ? 'PRZED = odtworzenie stanu linii integracja/20260911. PO = realne komponenty z tej gałęzi.'
          : 'BEFORE = reproduction of line integracja/20260911. AFTER = real components from this branch.'}
      </p>

      <h2 className="mb-2 text-sm font-semibold">
        (a) {isPolish ? 'Zmiana etapu z wiersza' : 'Stage change from the row'}
      </h2>
      <div className="mb-8 flex gap-4">
        <Kolumna
          tytul={isPolish ? 'PRZED — odznaka do czytania' : 'BEFORE — read-only badge'}
          podtytul={
            isPolish
              ? 'Zmiana etapu tylko kebabem: kebab → blok „Etap” → pozycja. Dwa kliknięcia do listy.'
              : 'Stage change only via kebab: kebab → “Stage” block → item. Two clicks to the list.'
          }
        >
          <Tabelka wiersze={wiersze} isPolish={isPolish} interaktywna={false} />
        </Kolumna>
        <Kolumna
          tytul={isPolish ? 'PO — lista w wierszu' : 'AFTER — list in the row'}
          podtytul={
            isPolish
              ? 'Kliknięcie w odznakę otwiera listę etapów; wybór zapisuje od razu (toast + cofnięcie przy błędzie).'
              : 'Clicking the badge opens the stage list; picking saves immediately (toast + rollback on error).'
          }
        >
          <Tabelka wiersze={wiersze} isPolish={isPolish} interaktywna />
        </Kolumna>
      </div>

      <h2 className="mb-2 text-sm font-semibold">
        (b+c) {isPolish ? '„Przejrzyj kandydaturę” — wynik' : '“Review candidate” — result'}
      </h2>
      <div className="flex gap-4">
        <Kolumna
          tytul={isPolish ? 'PRZED — bezimienna telemetria' : 'BEFORE — unnamed telemetry'}
          podtytul={
            isPolish
              ? 'Bez nagłówka, bez zdania; surowe liczby i 12 znaków sha256 — czytane jako „nic się nie stało”.'
              : 'No heading, no sentence; raw counters and 12 chars of sha256 — read as “nothing happened”.'
          }
        >
          <PodgladKandydataPrzed isPolish={isPolish} />
        </Kolumna>
        <Kolumna
          tytul={isPolish ? 'PO — nazwany wynik' : 'AFTER — named result'}
          podtytul={
            isPolish
              ? 'Nazwa bloku + zdanie po ludzku; hash zostaje w kontrakcie zatwierdzenia, znika z ekranu.'
              : 'Block name + a human sentence; the hash stays in the approve contract, off the screen.'
          }
        >
          <ProcessFlowCandidatePreviewCard
            preview={PODGLAD}
            isPolish={isPolish}
            onCancel={() => {}}
          />
        </Kolumna>
      </div>
    </div>
  );
}
