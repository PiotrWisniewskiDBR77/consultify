/**
 * Dev-render: Deck W4 — nie-blokujący badge jakości na kroku wyniku kreatora.
 *
 * Mounts the REAL `ResultStep` (src/components/Presentations/wizard/ResultStep.tsx)
 * with mock props carrying deck-quality warnings + qualityGates.critic, so the
 * new collapsible "Jakość: N ostrzeżeń" badge (W4 deck-quality-surface) can be
 * screenshotted BEFORE the owner sees it (rule #7). Pure-presentational — no
 * Api/backend. Append &clean=1 for the passed/0-warnings variant.
 *
 * URL: ?screen=deck-quality-badge[&lang=pl|en][&theme=light|dark][&clean=1]
 */
import React from 'react';

import { ResultStep } from '@/components/Presentations/wizard/ResultStep';
import { DEFAULT_WIZARD_SETTINGS } from '@/components/Presentations/wizard/types';

export default function DeckQualityBadgeScreen(): React.ReactElement {
  const clean = new URLSearchParams(window.location.search).get('clean') === '1';

  const result = clean
    ? { slideCount: 8, warnings: [] }
    : {
        slideCount: 8,
        warnings: [
          'deck-quality: 2 slajd(ów) z krytycznym problemem kompozycji (score 62/100; indeksy 3, 5)',
          'deck-quality: slajd 3 — zbyt gęste bullet-points (>6 linii)',
          'content-gate: slajd 5 — tytuł przekracza zalecaną długość',
        ],
        qualityGates: {
          critic: { overallScore: 62, regenerateSlides: [3, 5], passed: false },
          structural: { valid: true, errorCount: 0, warningCount: 1 },
        },
      };

  return (
    <div className="min-h-screen w-screen overflow-y-auto bg-c-bg p-8">
      <div className="mx-auto max-w-3xl">
        <ResultStep
          result={result}
          settings={{ ...DEFAULT_WIZARD_SETTINGS, title: 'Raport dla zarządu — Q3' }}
          onDownload={() => {}}
          onEditOutline={() => {}}
          onOpenBuilder={() => {}}
        />
      </div>
    </div>
  );
}
