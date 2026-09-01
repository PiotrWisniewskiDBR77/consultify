/**
 * PrezentacjeRightRail — module-tools strip + panel registry for the
 * Prezentacje (deck GENERATOR) lane under the MELS shell.
 *
 * Scope note (no phantom controls): `DeckBuilderMelsRightRail` exposes
 * Blocks / Media / Comments / Activity because `DeckBuilder` owns LIVE
 * slide editing (block insertion, media library, comment threads).
 * `PrezentacjeView` is the chat GENERATOR screen upstream of the
 * builder — it does not have block insertion, a media library, or a
 * comment thread. The ONLY canvas-adjacent, genuinely-existing signal
 * on this screen is the generation task timeline
 * (`useKimiArtifactPipeline`'s `taskSteps` / `onReplay` / `onRemix`,
 * rendered inline by the legacy `KimiWorkspaceShell`'s `TaskProgressBar`)
 * — so this rail exposes ONLY `activity` for that. Blocks / Media /
 * Comments are deliberately NOT included here; they belong to the
 * DeckBuilder lane's own MELS rail, not this one.
 *
 * Panel CONTENT wiring is deferred (S4, same as `TabeleMelsView` /
 * `DeckBuilderMelsView`) — callers may pass `rightRailPanels={{}}`.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * ★ ROZWOŻENIE (2026-08-30/31) — jedna z sześciu „trudnych" szyn
 * ═══════════════════════════════════════════════════════════════════════
 * `docs/program/grafika/ANALIZA_PRAWY_PANEL.md` §6/uzupełnienie „dokumenty":
 * ten plik miał WŁASNĄ budowę poza kanonem, z JEDNYM identyfikatorem
 * (`activity`) — dokładnie ten sam byt, który kanon i inne powierzchnie
 * nazywają `history`. Słownik ujednolicony: `activity` ≡ `historia`.
 *
 * Za flagą `isArtifactRightRailEnabled()` (`src/utils/artifactRightRailFlag.ts`,
 * domyślnie OFF — przy OFF ta gałąź nigdy się nie wykonuje, więc ta
 * powierzchnia renderuje się DOKŁADNIE jak przed tą zmianą, co do piksela):
 *  - Ikona szyny nie nazywa się już `activity`, tylko `artefakt` (kanoniczna
 *    ikona `LayoutGrid`, jak w `ArtifactRightRail`/Notatniku/Ideach).
 *  - Treść wcześniej pod `activity` renderuje się WEWNĄTRZ akordeonu
 *    `ArtifactRightPanel`, w JEDYNEJ zastosowanej sekcji kanonu: „Historia"
 *    (`history`). Pozostałe sześć sekcji kanonu (Akcje/Właściwości/
 *    Powiązania/Źródła/Rezultaty/Komentarze) są dziś bez zastosowania na
 *    tym ekranie (generator nie ma jeszcze tych danych — S4, jak w
 *    dokumentacji powyżej) i są POMINIĘTE, nie renderowane jako puste
 *    (kanon: „lepiej brak niż pusty akordeon udający funkcję").
 *  - Brak własnej Teresy/trybów zależnych od typu tutaj — ekran generatora
 *    ma swój przełącznik Teresy w Menu 2 (`topBarHandlers.onToggleAgent`),
 *    osobny od tej szyny; ta praca (tor grafiki) go nie rusza.
 */

import { Activity, LayoutGrid } from 'lucide-react';
import React from 'react';

import { type RightRailToolDescriptor } from '@/components/shared/ExecutiveModuleShell/RightRail';
import {
  ArtifactRightPanel,
  type ArtifactRightPanelSection,
} from '@/components/standard/ArtifactRightPanel';
import { isArtifactRightRailEnabled } from '@/utils/artifactRightRailFlag';

export type PrezentacjeRightRailToolId = 'activity' | 'artefakt';

export interface PrezentacjeRightRailLabels {
  activity?: string;
  /** Etykieta ikony „Artefakt" (za flagą — patrz nagłówek pliku). */
  artefakt?: string;
}

const DEFAULT_LABELS: Required<PrezentacjeRightRailLabels> = {
  activity: 'Activity',
  artefakt: 'Artefakt',
};

export interface PrezentacjeRightRailState {
  /** Count of in-flight/completed task steps — drives the Activity badge. */
  taskStepCount?: number;
  /** Activity dot tone (info while generating). */
  activityTone?: 'success' | 'warning' | 'danger' | 'info' | null;
}

export function buildPrezentacjeRightRailTools(args: {
  state?: PrezentacjeRightRailState;
  labels?: PrezentacjeRightRailLabels;
}): RightRailToolDescriptor[] {
  const { state = {}, labels = {} } = args;
  const L = { ...DEFAULT_LABELS, ...labels };

  const activityBadge =
    typeof state.taskStepCount === 'number' && state.taskStepCount > 0
      ? state.taskStepCount
      : undefined;

  // Za flagą: JEDNA ikona „Artefakt" zamiast „Activity" — treść wędruje do
  // sekcji „Historia" wewnątrz akordeonu (patrz `PrezentacjeRightRailPanel`
  // niżej). Licznik zostaje na ikonie (rail-level badge = sygnał krytyczny
  // wg kontraktu `ArtifactRightRail`, ale to jedyny sygnał tej powierzchni,
  // więc zostaje 1:1 przeniesiony, nie porzucony).
  if (isArtifactRightRailEnabled()) {
    return [
      {
        id: 'artefakt',
        label: L.artefakt,
        icon: LayoutGrid,
        ...(activityBadge !== undefined ? { badge: activityBadge } : {}),
        ...(state.activityTone ? { dotTone: state.activityTone } : {}),
      },
    ];
  }

  return [
    {
      id: 'activity',
      label: L.activity,
      icon: Activity,
      ...(activityBadge !== undefined ? { badge: activityBadge } : {}),
      ...(state.activityTone ? { dotTone: state.activityTone } : {}),
    },
  ];
}

export interface PrezentacjeRightRailPanelRenderers {
  activity?: React.ReactNode;
}

interface PrezentacjeRightRailPanelProps {
  activeToolId: PrezentacjeRightRailToolId | string | null;
  panels: PrezentacjeRightRailPanelRenderers;
  fallback?: React.ReactNode;
  /** PL/EN nagłówek sekcji kanonu (tylko ścieżka ON). Domyślnie EN. */
  isPolish?: boolean;
}

const PANEL_KEY: Record<PrezentacjeRightRailToolId, keyof PrezentacjeRightRailPanelRenderers> = {
  activity: 'activity',
  artefakt: 'activity',
};

export const PrezentacjeRightRailPanel: React.FC<PrezentacjeRightRailPanelProps> = ({
  activeToolId,
  panels,
  fallback,
  isPolish = false,
}) => {
  if (!activeToolId) return null;

  if (isArtifactRightRailEnabled()) {
    if (activeToolId !== 'artefakt') return <>{fallback ?? null}</>;
    // Jedyna zastosowana sekcja kanonu na tym ekranie dziś: Historia
    // (dawne `activity`). Pozostałe sześć — bez zastosowania, pominięte.
    const sections: ArtifactRightPanelSection[] = [
      {
        id: 'history',
        label: isPolish ? 'Historia' : 'History',
        icon: Activity,
        isEmpty: !panels.activity,
        emptyLabel: isPolish
          ? 'Ta prezentacja nie ma jeszcze historii.'
          : 'This presentation has no history yet.',
        children: panels.activity ?? null,
      },
    ];
    return (
      <ArtifactRightPanel
        sections={sections}
        width="100%"
        className="border-l-0"
        ariaLabel={isPolish ? 'Panel artefaktu' : 'Artifact panel'}
      />
    );
  }

  const key = PANEL_KEY[activeToolId as PrezentacjeRightRailToolId];
  if (!key) return <>{fallback ?? null}</>;
  const node = panels[key];
  return <>{node ?? fallback ?? null}</>;
};

export default PrezentacjeRightRailPanel;
