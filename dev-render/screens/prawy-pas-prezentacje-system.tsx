/**
 * Dev-render: PREZENTACJE (generator) na wspólnej formule prawego pasa
 * (`docs/program/grafika/ANALIZA_PRAWY_PANEL.md` §6 uzupełnienie „dokumenty",
 * jedna z sześciu „trudnych" szyn — ta miała JEDEN identyfikator `activity`,
 * własną budowę poza kanonem).
 *
 * Montuje REALNY `PrezentacjeMelsView` (nie kopię) z minimalnym, ale
 * prawdziwym kontraktem propsów — dokładnie tak, jak robi to
 * `PrezentacjeView.tsx` (patrz jego wywołanie), plus mock treści sekcji
 * „Historia" (`rightRailPanels.activity`), żeby ścieżka ON (akordeon
 * `ArtifactRightPanel`) miała co pokazać, a nie pusty stan.
 *
 * Flaga `ff_artifact_right_rail` steruje ścieżką (OFF = dzisiejsza ikona
 * „Activity" bez akordeonu; ON = ikona „Artefakt" → akordeon z JEDYNĄ
 * zastosowaną sekcją „Historia"). Czytana przez `isArtifactRightRailEnabled()`
 * wprost z URL — nie trzeba nic przełączać w tym pliku.
 *
 * URL: ?screen=prawy-pas-prezentacje&theme=light|dark&lang=pl
 *      &ff_artifact_right_rail=1   ← ścieżka ON (domyślnie OFF)
 */
import { Bot } from 'lucide-react';
import React, { useEffect } from 'react';

import type { ArtifactPreview } from '@/components/AIChat/KimiWorkspace/KimiWorkspaceShell';
import { PrezentacjeMelsView } from '@/components/AIChat/KimiWorkspace/prezentacjeShell/PrezentacjeMelsView';
import { isArtifactRightRailEnabled } from '@/utils/artifactRightRailFlag';

const PREVIEW: ArtifactPreview & { type: 'deck' } = {
  type: 'deck',
  title: 'Ekspansja DE — plan wejścia',
  deckId: 'deck-dev-render-1',
  deckStatus: 'draft',
  deckSlides: [
    { slideId: 's1', intent: 'title', title: 'Ekspansja DE — plan wejścia' },
    { slideId: 's2', intent: 'context', title: 'Sytuacja rynkowa', bulletPoints: ['Popyt', 'Konkurencja'] },
    { slideId: 's3', intent: 'recommendation', title: 'Rekomendacja', bulletPoints: ['Pilotaż DACH'] },
  ],
};

// ── Mock treści sekcji „Historia" (dawne `activity`) ───────────────────────
function ActivityMock({ isPl }: { isPl: boolean }): React.ReactElement {
  const rows = [
    { who: 'Teresa', what: isPl ? 'Wygenerowała 8 slajdów ze wskazówek' : 'Generated 8 slides from hints', when: '10:42' },
    { who: 'Teresa', what: isPl ? 'Dodała rekomendację na slajdzie 3' : 'Added recommendation to slide 3', when: '10:44' },
  ];
  return (
    <ul className="flex flex-col gap-2.5" data-testid="prezentacje-activity-mock">
      {rows.map((row, i) => (
        <li key={i} className="flex items-start gap-2 text-xs">
          <Bot size={13} className="mt-0.5 shrink-0 text-c-ai" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-c-text">{row.what}</p>
            <p className="text-[11px] text-c-text-muted">
              {row.who} · {row.when}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export interface PrawyPasPrezentacjeSystemScreenProps {
  /** Czy sekcja „Historia"/ikona „Activity" ma treść (default: tak). */
  pustaHistoria?: boolean;
}

export default function PrawyPasPrezentacjeSystemScreen({
  pustaHistoria = false,
}: PrawyPasPrezentacjeSystemScreenProps): React.ReactElement {
  const isPl =
    (document.documentElement.lang || 'pl').startsWith('pl') ||
    new URLSearchParams(window.location.search).get('lang') !== 'en';

  // Narzędzie zrzutowe nie klika UI (patrz `prawy-pas-idea-system.tsx`).
  // `PrezentacjeMelsView` nie eksponuje `activeRightRailToolId` sterowanego
  // z zewnątrz (na dziś jedyny tryb szyny), więc symulujemy PIERWSZY klik w
  // ikonę „Artefakt" po zamontowaniu — WYŁĄCZNIE gdy flaga ON, żeby ścieżka
  // OFF (porównanie sum kontrolnych z PRZED) została zamkniętym panelem 1:1.
  useEffect(() => {
    if (!isArtifactRightRailEnabled()) return;
    const id = window.setTimeout(() => {
      const btn = document.querySelector<HTMLButtonElement>(
        '[data-mels-tool="artefakt"]'
      );
      btn?.click();
    }, 50);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="h-screen w-screen bg-c-bg">
      <PrezentacjeMelsView
        preview={PREVIEW}
        rightRailPanels={pustaHistoria ? {} : { activity: <ActivityMock isPl={isPl} /> }}
        onOpenBuilder={() => undefined}
        onRunPrimary={() => undefined}
        persistRailState={false}
      />
    </div>
  );
}
