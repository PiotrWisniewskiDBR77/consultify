/**
 * Harness: Dynamic SWOT — Output → Report / Presentation.
 *
 * Renderuje REALNY łańcuch, nie makietę:
 *   stan sesji (SWOTItem/SWOTTension/SWOTMove)
 *     → buildSwotOutput()   [reguły silnika: accepted, bramka W2]
 *     → approve()           [niezmienny snapshot]
 *     → renderToolReport()  [deterministyczny renderer]
 *     → ToolReportView      [Executive Paper / Executive Night]
 *
 * Istnieje po to, żeby zrzut powstał ZANIM właściciel zobaczy ekran (CLAUDE.md #7).
 *
 * URL: ?screen=tools-swot-report&theme=light|dark&kind=report|presentation&mode=document|slides
 *
 * `mode=slides` (STREAM H2, 2026-08-13) renderuje `SlideDeckView` zamiast
 * `ToolReportView` — REALNY Slide Mode, na tym samym `doc` z tego samego
 * łańcucha (zero osobnego stanu, zero nowego fetchu).
 */

import React from 'react';

import SlideDeckView from '@/components/DiscoveryTools/report/SlideDeckView';
import ToolReportView from '@/components/DiscoveryTools/report/ToolReportView';
import { buildSwotOutput } from '@/toolOutputs/buildSwotOutput';
import { approve, submitForReview } from '@/toolOutputs/outputLifecycle';
import { renderToolReport } from '@/toolOutputs/renderReport';
import type { SWOTItem, SWOTMove, SWOTTension } from '@/store/useToolStore';

/** Stan sesji — realistyczny, ale w pełni fikcyjny klient demo. */
const ITEMS: SWOTItem[] = [
  {
    id: 'i1',
    text: 'Zespół wdrożeniowy z 40 zamkniętymi projektami',
    impact: 'high',
    quadrant: 'strengths',
    proposalStatus: 'accepted',
    evidenceStatus: 'confirmed',
  },
  {
    id: 'i2',
    text: 'Czas wdrożenia 2× dłuższy niż u konkurencji',
    impact: 'high',
    quadrant: 'weaknesses',
    proposalStatus: 'accepted',
    evidenceStatus: 'confirmed',
  },
  {
    id: 'i3',
    text: 'Popyt w DACH rośnie trzeci kwartał z rzędu',
    impact: 'high',
    quadrant: 'opportunities',
    proposalStatus: 'accepted',
    evidenceStatus: 'declared-unconfirmed',
  },
  {
    id: 'i4',
    text: 'Konkurent obniżył cenę wejścia o 30%',
    impact: 'medium',
    quadrant: 'threats',
    proposalStatus: 'accepted',
    evidenceStatus: 'confirmed',
  },
  // Pozycja NIEZAAKCEPTOWANA — nie może pojawić się w Outputie.
  {
    id: 'i5',
    text: 'Hipoteza: klienci chcą modelu subskrypcyjnego',
    impact: 'low',
    quadrant: 'opportunities',
    proposalStatus: 'ai-proposed',
  },
] as SWOTItem[];

const TENSIONS: SWOTTension[] = [
  {
    id: 't1',
    title: 'Doświadczony zespół × rosnący popyt w DACH',
    type: 'attack',
    linkedCorrelationIds: [],
    linkedItemIds: ['i1', 'i3'],
    insight: 'Przewaga wdrożeniowa jest niewykorzystana w otwierającym się oknie.',
  },
  {
    id: 't2',
    title: 'Długi czas wdrożenia × presja cenowa',
    type: 'protect',
    linkedCorrelationIds: [],
    linkedItemIds: ['i2', 'i4'],
    insight: 'Wolne wdrożenie zwiększa ekspozycję na tańszego konkurenta.',
  },
] as SWOTTension[];

const MOVES: SWOTMove[] = [
  {
    id: 'm1',
    title: 'Uruchomić pilota referencyjnego w DACH',
    category: 'quick-win',
    rationale:
      'Popyt rośnie, a zdolność wdrożeniowa jest wolna. Referencja z rynku otwiera lejek szybciej niż praca nad produktem.',
    linkedTensionIds: ['t1'],
    linkedItemIds: ['i1', 'i3'],
    expectedImpact: 'high',
    estimatedEffort: 'medium',
    firstStep: 'Wybrać klienta pilotażowego z listy trzech kwalifikowanych',
    ownerRole: 'Dyrektor sprzedaży',
    tradeoff: {
      chosen: 'Pilot w DACH',
      deferred: 'Skrócenie czasu wdrożenia',
      cost: 'Dług operacyjny rośnie o kwartał',
    },
    rejectedAlternative: {
      option: 'Wejście przez partnera lokalnego',
      reason: 'Utrata kontroli nad jakością wdrożenia przy pierwszej referencji',
    },
  },
  {
    id: 'm2',
    title: 'Skrócić ścieżkę wdrożenia o 30%',
    category: 'capability-build',
    rationale:
      'Czas wdrożenia jest jednocześnie słabością i powodem ekspozycji na presję cenową konkurenta.',
    linkedTensionIds: ['t2'],
    linkedItemIds: ['i2', 'i4'],
    expectedImpact: 'high',
    estimatedEffort: 'high',
    firstStep: 'Zmierzyć czas trwania pięciu ostatnich wdrożeń krok po kroku',
    ownerRole: 'Dyrektor operacyjny',
    tradeoff: {
      chosen: 'Standaryzacja wdrożenia',
      deferred: 'Nowe funkcje produktu',
      cost: 'Roadmapa produktu przesuwa się o dwa miesiące',
    },
    rejectedAlternative: {
      option: 'Obniżenie ceny w odpowiedzi na konkurenta',
      reason: 'Marża nie wytrzyma, a przewaga nie jest cenowa',
    },
  },
] as SWOTMove[];

function buildDoc(kind: 'report' | 'presentation') {
  const { output } = buildSwotOutput({
    id: 'out-demo-1',
    organizationId: 'org-demo',
    toolSessionId: 'sess-demo-1',
    methodPackVersion: '1.0.0',
    title: 'Dynamic SWOT — wejście na rynek DACH',
    createdAt: '2026-08-13T10:00:00Z',
    items: ITEMS,
    tensions: TENSIONS,
    moves: MOVES,
  });

  // Dokument klienta powstaje WYŁĄCZNIE z zatwierdzonego Outputu.
  const approved = approve(submitForReview(output), 'piotr', '2026-08-13T12:00:00Z');

  return renderToolReport([approved], {
    id: kind === 'report' ? 'rep-demo-1' : 'deck-demo-1',
    organizationId: 'org-demo',
    kind,
    theme: 'executive-paper',
    title:
      kind === 'report'
        ? 'Dynamic SWOT — wejście na rynek DACH'
        : 'Wejście na rynek DACH — rekomendacja',
  });
}

export default function ToolsSwotReportScreen() {
  const params = new URLSearchParams(window.location.search);
  const kind = params.get('kind') === 'presentation' ? 'presentation' : 'report';
  const mode = params.get('mode') === 'slides' ? 'slides' : 'document';
  // `chrome` lets evidence-gathering force the header/counter/nav bar on even
  // for a Presentation doc (default behaviour hides it — see SlideDeckView's
  // `presentationMode`). Real app default stays doc.kind === 'presentation'.
  const chromeParam = params.get('chrome');
  const presentationModeUI =
    chromeParam === 'full' ? false : chromeParam === 'hidden' ? true : kind === 'presentation';
  const doc = React.useMemo(() => buildDoc(kind), [kind]);

  if (mode === 'slides') {
    // Fixed viewport height so the 16:9 stage has room to compute its size —
    // matches how SlideDeckView is embedded in ToolOutputsPanel (h-[70vh]).
    return (
      <div className="h-screen w-screen bg-c-bg" data-testid="slide-mode-harness">
        <SlideDeckView doc={doc} presentationMode={presentationModeUI} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-c-bg">
      <ToolReportView doc={doc} presentationMode={kind === 'presentation'} />
    </div>
  );
}
