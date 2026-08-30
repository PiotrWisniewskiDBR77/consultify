/**
 * DeckBuilderMelsRightRail — module-tools strip + panel registry for the
 * DeckBuilder lane under the MELS shell (EE / Deliverables unification
 * WS-A4).
 *
 * Provides:
 *   * `buildDeckBuilderRightRailTools(args)` — descriptor list for the
 *     `<RightRail>` icon strip: Blocks → Media → Activity.
 *   * `<DeckBuilderRightRailPanel>` — caller-driven panel host that
 *     renders the matching panel for `activeToolId`.
 *
 * Mirrors `TabeleRightRail` so the canvas-adjacent tooling lives in the
 * right rail (never floating beside the canvas), consistent with the
 * MELS § 2.D constraint shared across the three editors.
 *
 * Note: governance / audit / version / quality / analytics for the deck
 * are surfaced via the TOP-BAR chips (as overlays) to preserve current
 * DeckBuilder behaviour; only the genuinely canvas-adjacent tools
 * (block insertion, media library, agent activity) live in the rail.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * ★ ROZWOŻENIE (2026-08-30/31) — jedna z sześciu „trudnych" szyn
 * ═══════════════════════════════════════════════════════════════════════
 * `docs/program/grafika/ANALIZA_PRAWY_PANEL.md` §6/uzupełnienie „dokumenty":
 * ten plik miał WŁASNĄ budowę poza kanonem z sześcioma płaskimi
 * identyfikatorami (`blocks`/`media`/`evidence`/`relations`/`comments`/
 * `activity`) na jednej szynie, bez rozróżnienia „o artefakcie" / „po
 * artefakcie". Słownik ujednolicony: `activity` ≡ `historia`,
 * `evidence` ≡ „źródła i założenia".
 *
 * Za flagą `isArtifactRightRailEnabled()` (`src/utils/artifactRightRailFlag.ts`,
 * domyślnie OFF — przy OFF cała poniższa gałąź nigdy się nie wykonuje, ta
 * powierzchnia renderuje się DOKŁADNIE jak przed tą zmianą, co do piksela):
 *
 *  - „PO ARTEFAKCIE" (nawigacja/narzędzia archetypu Deck, zostają
 *    OSOBNYMI ikonami szyny, tak jak dziś): `blocks` (wstawianie slajdu/
 *    bloku — realna, żywa edycja, nie metadana o dokumencie) i `media`
 *    (biblioteka mediów, honest-UI: tylko gdy wołający dostarczył panel).
 *  - „O ARTEFAKCIE" (siedem sekcji kanonu — tu cztery mają dziś
 *    zastosowanie): `evidence`, `relations`, `comments`, `activity`
 *    (→ kanoniczne id `history`) SCALAJĄ SIĘ w JEDNĄ ikonę „Artefakt"
 *    (`LayoutGrid`, jak w `ArtifactRightRail`/Notatniku/Ideach), a ich
 *    treść ląduje jako sekcje akordeonu `ArtifactRightPanel` — w
 *    kolejności kanonu (`ARTIFACT_PANEL_SECTION_ORDER`): Powiązania →
 *    Źródła i założenia → Komentarze → Historia. Sekcja bez treści od
 *    wołającego jest POMINIĘTA (kanon: „lepiej brak niż pusty akordeon
 *    udający funkcję") — dokładnie te same warunki (`includeEvidence`/
 *    `includeMedia`/obecność panelu), tylko przeniesione z ikony na
 *    sekcję.
 *  - Liczniki (`agentActivityCount`/`openCommentCount`) NIE giną —
 *    wędrują z ikony (gdzie `RightRail` maluje je na czerwono, sygnał
 *    KRYTYCZNY wg kontraktu `ArtifactRightRail`) do neutralnego licznika
 *    nagłówka sekcji (`ArtifactRightPanelSection.badge`, `bg-c-surface-
 *    raised`) — to POPRAWKA semantyki, nie utrata sygnału: liczba
 *    otwartych komentarzy nie jest zdarzeniem krytycznym.
 *  - `activityTone` (agent-live sygnał) zostaje na ikonie „Artefakt"
 *    (`dotTone`) — to jedyny naprawdę rail-level sygnał tej grupy
 *    (\"czy dzieje się coś teraz\"), sekcje akordeonu nie mają odpowiednika
 *    `dotTone`.
 */

import { Activity, FileSearch, Image, LayoutGrid, LayoutTemplate, Link2, MessageSquare } from 'lucide-react';
import React from 'react';

import {
  ARTIFACT_PANEL_SECTION_ORDER,
  ArtifactRightPanel,
  type ArtifactRightPanelSection,
} from '@/components/standard/ArtifactRightPanel';
import { type RightRailToolDescriptor } from '@/components/shared/ExecutiveModuleShell/RightRail';
import { isArtifactRightRailEnabled } from '@/utils/artifactRightRailFlag';

export type DeckBuilderRightRailToolId =
  | 'blocks'
  | 'media'
  | 'comments'
  | 'activity'
  | 'relations'
  | 'evidence'
  | 'artefakt';

export interface DeckBuilderRightRailLabels {
  blocks?: string;
  media?: string;
  comments?: string;
  activity?: string;
  relations?: string;
  evidence?: string;
  /** Etykieta ikony „Artefakt" (za flagą — patrz nagłówek pliku). */
  artefakt?: string;
}

const DEFAULT_LABELS: Required<DeckBuilderRightRailLabels> = {
  blocks: 'Blocks',
  media: 'Media',
  comments: 'Comments',
  activity: 'Activity',
  relations: 'Relations',
  evidence: 'Sources & assumptions',
  artefakt: 'Artefakt',
};

export interface DeckBuilderRightRailState {
  /** Count of runtime/agent events — drives the badge on the Activity icon. */
  agentActivityCount?: number;
  /** Activity dot tone (info when the agent is live). */
  activityTone?: 'success' | 'warning' | 'danger' | 'info' | null;
  /** Count of open comment threads — drives the badge on the Comments icon. */
  openCommentCount?: number;
}

export function buildDeckBuilderRightRailTools(args: {
  state?: DeckBuilderRightRailState;
  labels?: DeckBuilderRightRailLabels;
  /**
   * HP-17: gdy true, dokłada narzędzie „Źródła i założenia" (evidence) na
   * końcu paska. Wołający włącza je TYLKO za flagą ff_evidencePanel (default
   * OFF) — patrz DeckBuilder.tsx. false/undefined → pasek 1:1 jak przed HP-17.
   */
  includeEvidence?: boolean;
  /**
   * J12-S3 (Honest-UI): pokaż narzędzie „Media" TYLKO gdy wołający dostarczył
   * jego panel. DeckBuilder NIE renderuje panelu media (biblioteka mediów jest
   * dostępna z panelu „Blocks" → overlay MediaLibraryBrowser), więc ikona Media
   * nie może wisieć na pasku otwierając pusty panel. false/undefined → brak
   * ikony Media (mirror includeEvidence).
   */
  includeMedia?: boolean;
}): RightRailToolDescriptor[] {
  const { state = {}, labels = {}, includeEvidence = false, includeMedia = false } = args;
  const L = { ...DEFAULT_LABELS, ...labels };

  const activityBadge =
    typeof state.agentActivityCount === 'number' && state.agentActivityCount > 0
      ? state.agentActivityCount
      : undefined;
  const commentsBadge =
    typeof state.openCommentCount === 'number' && state.openCommentCount > 0
      ? state.openCommentCount
      : undefined;

  if (isArtifactRightRailEnabled()) {
    // „Po artefakcie" — nawigacja/narzędzia archetypu, osobne ikony 1:1 jak
    // dziś (Blocks zawsze, Media honest-UI). „O artefakcie" — evidence /
    // relations / comments / activity(→historia) scalają się w JEDNĄ ikonę
    // „Artefakt"; liczniki wędrują do sekcji (patrz Panel niżej), na ikonie
    // zostaje wyłącznie `activityTone` (jedyny realny rail-level sygnał —
    // „czy dzieje się coś teraz").
    return [
      { id: 'blocks', label: L.blocks, icon: LayoutTemplate },
      ...(includeMedia ? [{ id: 'media', label: L.media, icon: Image }] : []),
      {
        id: 'artefakt',
        label: L.artefakt,
        icon: LayoutGrid,
        ...(state.activityTone ? { dotTone: state.activityTone } : {}),
      },
    ];
  }

  const tools: RightRailToolDescriptor[] = [
    { id: 'blocks', label: L.blocks, icon: LayoutGrid },
    ...(includeMedia ? [{ id: 'media', label: L.media, icon: Image }] : []),
    {
      id: 'comments',
      label: L.comments,
      icon: MessageSquare,
      ...(commentsBadge !== undefined ? { badge: commentsBadge } : {}),
    },
    {
      id: 'activity',
      label: L.activity,
      icon: Activity,
      ...(activityBadge !== undefined ? { badge: activityBadge } : {}),
      ...(state.activityTone ? { dotTone: state.activityTone } : {}),
    },
    { id: 'relations', label: L.relations, icon: Link2 },
  ];
  if (includeEvidence) {
    tools.push({ id: 'evidence', label: L.evidence, icon: FileSearch });
  }
  return tools;
}

export interface DeckBuilderRightRailPanelRenderers {
  blocks?: React.ReactNode;
  media?: React.ReactNode;
  comments?: React.ReactNode;
  activity?: React.ReactNode;
  relations?: React.ReactNode;
  evidence?: React.ReactNode;
}

interface DeckBuilderRightRailPanelProps {
  activeToolId: DeckBuilderRightRailToolId | string | null;
  panels: DeckBuilderRightRailPanelRenderers;
  /** Optional fallback when no panel matches. */
  fallback?: React.ReactNode;
  /** PL/EN nagłówki sekcji kanonu (tylko ścieżka ON). Domyślnie EN. */
  isPolish?: boolean;
  /**
   * Liczniki, żeby przenieść je z ikony (rail badge = czerwony/krytyczny) do
   * neutralnego licznika nagłówka sekcji (tylko ścieżka ON — patrz nagłówek
   * pliku). Pominięte → sekcje bez licznika (nie fabrykujemy zera).
   */
  state?: DeckBuilderRightRailState;
}

const PANEL_KEY: Record<DeckBuilderRightRailToolId, keyof DeckBuilderRightRailPanelRenderers> = {
  blocks: 'blocks',
  media: 'media',
  comments: 'comments',
  activity: 'activity',
  relations: 'relations',
  evidence: 'evidence',
  artefakt: 'blocks', // nieużywane w ścieżce ON (branch niżej obsługuje 'artefakt' osobno); wymagane dla wyczerpującego typu Record.
};

const SECTION_CAPTIONS: Record<'relations' | 'evidence' | 'comments' | 'history', { pl: string; en: string }> = {
  relations: { pl: 'Powiązania — z czym to sąsiaduje', en: 'Relations — what this sits next to' },
  evidence: {
    pl: 'Źródła i założenia — na czym to oparto',
    en: 'Sources and assumptions — what this is based on',
  },
  comments: { pl: 'Komentarze', en: 'Comments' },
  history: { pl: 'Historia', en: 'History' },
};

export const DeckBuilderRightRailPanel: React.FC<DeckBuilderRightRailPanelProps> = ({
  activeToolId,
  panels,
  fallback,
  isPolish = false,
  state,
}) => {
  if (!activeToolId) return null;

  if (isArtifactRightRailEnabled()) {
    if (activeToolId !== 'artefakt') {
      // „Po artefakcie" (blocks/media) — passthrough 1:1, bez akordeonu:
      // to żywe narzędzia pełnej wysokości, nie metadane o dokumencie.
      const key = PANEL_KEY[activeToolId as DeckBuilderRightRailToolId];
      if (!key) return <>{fallback ?? null}</>;
      const node = panels[key];
      return <>{node ?? fallback ?? null}</>;
    }

    const commentsBadge =
      typeof state?.openCommentCount === 'number' && state.openCommentCount > 0
        ? state.openCommentCount
        : undefined;
    const activityBadge =
      typeof state?.agentActivityCount === 'number' && state.agentActivityCount > 0
        ? state.agentActivityCount
        : undefined;

    const byId: Partial<Record<ArtifactRightPanelSection['id'], ArtifactRightPanelSection>> = {};
    if (panels.relations) {
      byId.relations = {
        id: 'relations',
        label: isPolish ? SECTION_CAPTIONS.relations.pl : SECTION_CAPTIONS.relations.en,
        icon: Link2,
        children: panels.relations,
      };
    }
    if (panels.evidence) {
      byId.evidence = {
        id: 'evidence',
        label: isPolish ? SECTION_CAPTIONS.evidence.pl : SECTION_CAPTIONS.evidence.en,
        icon: FileSearch,
        children: panels.evidence,
      };
    }
    if (panels.comments) {
      byId.comments = {
        id: 'comments',
        label: isPolish ? SECTION_CAPTIONS.comments.pl : SECTION_CAPTIONS.comments.en,
        icon: MessageSquare,
        badge: commentsBadge,
        children: panels.comments,
      };
    }
    if (panels.activity) {
      byId.history = {
        id: 'history',
        label: isPolish ? SECTION_CAPTIONS.history.pl : SECTION_CAPTIONS.history.en,
        icon: Activity,
        badge: activityBadge,
        children: panels.activity,
      };
    }
    const sections = ARTIFACT_PANEL_SECTION_ORDER.map((id) => byId[id]).filter(
      (section): section is ArtifactRightPanelSection => section !== undefined
    );

    return (
      <ArtifactRightPanel
        sections={sections}
        width="100%"
        className="border-l-0"
        ariaLabel={isPolish ? 'Panel artefaktu' : 'Artifact panel'}
      />
    );
  }

  const key = PANEL_KEY[activeToolId as DeckBuilderRightRailToolId];
  if (!key) return <>{fallback ?? null}</>;
  const node = panels[key];
  return <>{node ?? fallback ?? null}</>;
};

export default DeckBuilderRightRailPanel;
