/**
 * U-43 — Deck Builder left STRUCTURE rail, "Review" tab.
 *
 * Mounts the REAL shell (DeckBuilderMelsView in artifactStudioMode) with the
 * REAL PresentationReviewPanel and the REAL DeckReviewPanel; only `fetch` and
 * the approvals/organizations APIs are stubbed, so the screenshot shows the
 * production components, not a drawing of them.
 *
 * ?screen=u43-deck-review&lang=en&theme=light|dark
 */
import React from 'react';

import { DeckBuilderMelsView } from '@/components/Presentations/DeckBuilder/DeckBuilderMelsView';
import { DeckReviewPanel } from '@/components/Presentations/DeckBuilder/DeckReviewPanel';
import { PresentationReviewPanel } from '@/components/Presentations/DeckBuilder/PresentationReviewPanel';

// The fixture is the owner's own deck from U-43 ("Steering Committee —
// September 2026"): 6 slides, one finding that needs attention and four
// suggestions — exactly the state that produced "Deck Score 65 / BLOCKED_P1".
const REPORT = {
  deckId: 'deck-steering-2026-09',
  canExport: false,
  canShare: false,
  score: 65,
  result: 'BLOCKED_P1',
  scorecard: { p0: 0, p1: 1, p2: 4, passVocabulary: 'BLOCKED_P1' },
  checkedAt: '2026-09-16T08:00:00.000Z',
  gates: [
    {
      id: 'qg-low-info',
      gateType: 'LOW_INFORMATION_SLIDES',
      severity: 'error',
      priority: 'P1',
      message:
        '6 slide(s) contain only a heading or a single low-information statement. Add audience-ready evidence and visual structure.',
      cardIndex: 2,
      category: 'content',
    },
    {
      id: 'qg-missing-header-footer',
      gateType: 'MISSING_HEADER_FOOTER',
      severity: 'warning',
      priority: 'P2',
      message: 'Most slides are missing exporter-safe header/footer metadata.',
      category: 'brand',
    },
    {
      id: 'qg-no-brand-kit',
      gateType: 'NO_BRAND_KIT',
      severity: 'info',
      priority: 'P2',
      message: 'No Brand Kit configured for this organization.',
      category: 'brand',
    },
    {
      id: 'qg-missing-cover',
      gateType: 'MISSING_COVER',
      severity: 'warning',
      priority: 'P2',
      message: 'Deck is missing a cover slide. Consider adding one for a professional look.',
      category: 'structure',
    },
    {
      id: 'qg-low-traceability',
      gateType: 'LOW_TRACEABILITY',
      severity: 'warning',
      priority: 'P2',
      message: 'Only 0% of cards have source references. Traceability improves trust.',
      cardIndex: 4,
      category: 'traceability',
    },
  ],
};

const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(typeof input === 'string' ? input : (input as Request).url || input);
  if (url.includes('/quality-gates')) {
    return new Response(JSON.stringify({ success: true, data: REPORT }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return originalFetch(input as never, init);
}) as typeof fetch;

const SLIDES = [
  'Steering Committee — September 2026',
  'Where the programme stands',
  'Line 3 throughput',
  'Cost to serve',
  'Risks and mitigations',
  'Decisions we need today',
];

function SlideSorterFixture(): React.ReactElement {
  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-auto p-3">
      {SLIDES.map((title, index) => (
        <div
          key={title}
          className={`rounded-md border p-2 ${
            index === 2 ? 'border-c-border-strong bg-c-surface-raised' : 'border-c-border-subtle'
          }`}
        >
          <p className="text-[10px] text-c-text-secondary">{index + 1}</p>
          <p className="text-[11px] font-medium text-c-text">{title}</p>
        </div>
      ))}
    </div>
  );
}

export default function U43DeckReviewScreen(): React.ReactElement {
  return (
    <div className="h-[900px] w-full bg-c-bg">
      <DeckBuilderMelsView
        artifactStudioMode
        title="Steering Committee — September 2026"
        topBarHandlers={{
          onHistory: () => {},
          onQa: () => {},
          onGovernance: () => {},
          onAnalytics: () => {},
          onAudit: () => {},
          onShare: () => {},
          onToggleAgent: () => {},
          onRun: () => {},
          onRunFromStart: () => {},
          onPresenter: () => {},
        }}
        leftRail={<SlideSorterFixture />}
        reviewPanel={
          <PresentationReviewPanel
            deckId={REPORT.deckId}
            version={7}
            organizationId="org-northwind"
            currentUserId="author"
            qualityPanel={
              <DeckReviewPanel
                deckId={REPORT.deckId}
                isOpen
                displayMode="embedded"
                totalSlides={SLIDES.length}
                onJumpToCard={() => {}}
                onFixWithAi={() => {}}
              />
            }
          />
        }
        canvas={
          <div className="flex h-full items-center justify-center p-8">
            <div className="flex aspect-video w-full max-w-3xl items-center justify-center rounded-lg border border-c-border-subtle bg-c-surface">
              <p className="text-lg font-semibold text-c-text">Line 3 throughput</p>
            </div>
          </div>
        }
        persistRailState={false}
      />
    </div>
  );
}
