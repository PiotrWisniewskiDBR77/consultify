/**
 * Dev-render: DECK BUILDER na wspólnej formule prawego pasa
 * (`docs/program/grafika/ANALIZA_PRAWY_PANEL.md` §6 uzupełnienie „dokumenty",
 * druga z dwóch „trudnych" szyn przydzielonych torowi grafiki — ta miała
 * SZEŚĆ płaskich identyfikatorów na jednej szynie: blocks/media/evidence/
 * relations/comments/activity, bez rozróżnienia „o artefakcie"/„po artefakcie").
 *
 * Montuje REALNY `DeckBuilderMelsView` (nie kopię) z minimalnym, ale
 * prawdziwym kontraktem propsów — leftRail/canvas jako proste mocki (jak
 * `CanvasMock` w `prawy-pas-idea-system.tsx`), oraz mock treści dla
 * blocks/comments/activity/relations/evidence, żeby akordeon „Artefakt"
 * (ścieżka ON) miał co pokazać zamiast pustych sekcji.
 *
 * Flaga `ff_artifact_right_rail` steruje ścieżką (OFF = dzisiejszych 4-5
 * płaskich ikon; ON = Blocks → Media(opc.) → Artefakt[Powiązania/Źródła/
 * Komentarze/Historia]). Czytana wprost z URL.
 *
 * `tryb` wybiera, który tryb szyny jest otwarty na start — narzędzie
 * zrzutowe nie klika UI (patrz `prawy-pas-idea-system.tsx`).
 *
 * URL: ?screen=prawy-pas-deck-builder&theme=light|dark&lang=pl
 *      &ff_artifact_right_rail=1   ← ścieżka ON (domyślnie OFF)
 */
import { ArrowRight, Bot, FileText } from 'lucide-react';
import React, { useState } from 'react';

import { DeckBuilderMelsView } from '@/components/Presentations/DeckBuilder/DeckBuilderMelsView';

const TITLE = 'Ekspansja DE — plan wejścia';

// ── Mock: lewa szyna (Slide Sorter) ─────────────────────────────────────
function LeftRailMock(): React.ReactElement {
  return (
    <div className="flex flex-col gap-2 p-3" data-testid="deck-left-rail-mock">
      {['Tytuł', 'Sytuacja rynkowa', 'Rekomendacja'].map((label, i) => (
        <div
          key={label}
          className="rounded-lg border border-c-border-subtle bg-c-surface px-2.5 py-2 text-xs text-c-text"
        >
          {i + 1}. {label}
        </div>
      ))}
    </div>
  );
}

// ── Mock: kanwa (karta slajdu) ──────────────────────────────────────────
function CanvasMock(): React.ReactElement {
  return (
    <div className="flex h-full items-center justify-center bg-c-surface-raised p-8">
      <div className="aspect-video w-full max-w-3xl rounded-xl border border-c-border bg-c-surface p-8 shadow-sm">
        <h2 className="text-xl font-semibold text-c-text">{TITLE}</h2>
        <p className="mt-2 text-sm text-c-text-secondary">Warsztat 3 · wersja robocza</p>
      </div>
    </div>
  );
}

// ── Mock: treść „Blocks" (po artefakcie — wstawianie) ────────────────────
function BlocksMock(): React.ReactElement {
  return (
    <div className="flex flex-col gap-2 text-xs text-c-text" data-testid="deck-blocks-mock">
      {['Tytuł', 'Tekst + obraz', 'Wykres', 'Tabela', 'Cytat'].map((label) => (
        <button
          key={label}
          type="button"
          className="rounded-lg border border-c-border-subtle bg-c-surface px-3 py-2 text-left hover:bg-c-surface-hover"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ── Mock: treść „Komentarze" (o artefakcie) ──────────────────────────────
function CommentsMock({ isPl }: { isPl: boolean }): React.ReactElement {
  return (
    <ul className="flex flex-col gap-2.5 text-xs" data-testid="deck-comments-mock">
      <li className="rounded-lg border border-c-border-subtle bg-c-surface px-3 py-2">
        <p className="font-medium text-c-text">Anna K.</p>
        <p className="mt-0.5 text-c-text-secondary">
          {isPl ? 'Czy mamy dane za Q2?' : 'Do we have Q2 data?'}
        </p>
      </li>
    </ul>
  );
}

// ── Mock: treść „Historia" (dawne `activity`, o artefakcie) ─────────────
function ActivityMock({ isPl }: { isPl: boolean }): React.ReactElement {
  return (
    <ul className="flex flex-col gap-2.5" data-testid="deck-activity-mock">
      <li className="flex items-start gap-2 text-xs">
        <Bot size={13} className="mt-0.5 shrink-0 text-c-ai" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-c-text">
            {isPl ? 'Teresa dodała slajd „Rekomendacja"' : 'Teresa added slide "Recommendation"'}
          </p>
          <p className="text-[11px] text-c-text-muted">10:44</p>
        </div>
      </li>
    </ul>
  );
}

// ── Mock: treść „Powiązania" (o artefakcie) ──────────────────────────────
function RelationsMock({ isPl }: { isPl: boolean }): React.ReactElement {
  return (
    <ul className="flex flex-col gap-1.5 text-xs text-c-text" data-testid="deck-relations-mock">
      <li className="flex items-center gap-2">
        <FileText size={13} className="shrink-0 text-c-text-muted" />
        {isPl ? 'Inicjatywa: pilotaż DACH' : 'Initiative: DACH pilot'}
      </li>
      <li className="flex items-center gap-2">
        <ArrowRight size={13} className="shrink-0 text-c-text-muted" />
        {isPl ? 'Ocena: Ekspansja DE' : 'Assessment: DE expansion'}
      </li>
    </ul>
  );
}

// ── Mock: treść „Źródła i założenia" (o artefakcie, HP-17) ──────────────
function EvidenceMock({ isPl }: { isPl: boolean }): React.ReactElement {
  return (
    <p className="text-xs text-c-text-secondary" data-testid="deck-evidence-mock">
      {isPl
        ? '12 wywiadów partnerskich · model finansowy v3 · założenie: kurs EUR/PLN 4.30'
        : '12 partner interviews · financial model v3 · assumption: EUR/PLN 4.30'}
    </p>
  );
}

export interface PrawyPasDeckBuilderSystemScreenProps {
  /** Który tryb szyny jest otwarty na start. */
  tryb?: 'blocks' | 'artefakt';
}

export default function PrawyPasDeckBuilderSystemScreen({
  tryb,
}: PrawyPasDeckBuilderSystemScreenProps): React.ReactElement {
  const isPl =
    (document.documentElement.lang || 'pl').startsWith('pl') ||
    new URLSearchParams(window.location.search).get('lang') !== 'en';

  // OFF (bez `tryb`): id 'blocks' istnieje w obu ścieżkach, więc jest
  // bezpiecznym wspólnym stanem startowym dla zrzutu bazowego (PRZED/PO
  // porównanie pikseli). ON: `tryb` wybiera 'blocks' albo 'artefakt'.
  const [activeTool, setActiveTool] = useState<string | null>(tryb ?? 'blocks');

  return (
    <div className="h-screen w-screen bg-c-bg">
      <DeckBuilderMelsView
        title={TITLE}
        topBarHandlers={{}}
        rightRailState={{ agentActivityCount: 1, activityTone: 'info', openCommentCount: 1 }}
        rightRailPanels={{
          blocks: <BlocksMock />,
          comments: <CommentsMock isPl={isPl} />,
          activity: <ActivityMock isPl={isPl} />,
          relations: <RelationsMock isPl={isPl} />,
          evidence: <EvidenceMock isPl={isPl} />,
        }}
        activeRightRailToolId={activeTool}
        onActiveRightRailToolChange={setActiveTool}
        leftRail={<LeftRailMock />}
        canvas={<CanvasMock />}
        persistRailState={false}
      />
    </div>
  );
}
