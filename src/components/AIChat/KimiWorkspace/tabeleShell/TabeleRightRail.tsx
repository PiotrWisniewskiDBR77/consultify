/**
 * TabeleRightRail — module tools strip + panel registry for the
 * Tabele lane (EPIC-T16 D5).
 *
 * Provides:
 *   * `buildTabeleRightRailTools(args)` — descriptor list for the
 *     `<RightRail>` icon strip in the documented MELS order:
 *     Search → AI Editor → QA Report → Source Pack → Layout →
 *     Share → Analytics.
 *   * `<TabeleRightRailPanel>` — caller-driven panel content host that
 *     renders the matching panel for `activeToolId`.
 *
 * Caller supplies handlers and panel renderers; this module owns the
 * tool taxonomy, icon mapping, default labels, and ordering. This
 * keeps shell + Tabele integration loose-coupled.
 *
 * Constraint (MELS § 2.D + .cursor/rules/ai-actions-menu3.mdc): all
 * AI buttons (AI Editor 8 levels, QA Report) live ONLY in the right
 * rail — never beside the canvas, never as a separate toolbar.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * ★ TRYB ARTEFAKT (2026-08-30, docs/program/grafika/ANALIZA_PRAWY_PANEL.md
 *   §"rozdział o artefakcie od po artefakcie")
 * ═══════════════════════════════════════════════════════════════════════
 * Zmierzony stan: te siedem narzędzi (search…analytics) to w całości
 * PO ARTEFAKCIE — nawigacja i narzędzia archetypu tabeli, poprawnie już jako
 * osobne tryby szyny (nie akordeon). Brakowało O ARTEFAKCIE — kanonu siedmiu
 * sekcji (kim jest, skąd, co z tego). `buildTabeleRightRailTools` dokłada
 * teraz ÓSMY, PIERWSZY tool `'artefakt'` (kanon `ArtifactRightPanel`, sekcje
 * Właściwości/Powiązania/Komentarze — jedyne, dla których ten moduł ma REALNE
 * dane; Akcje/Źródła/Rezultaty/Historia pominięte, kanon: „lepiej brak niż
 * pusty akordeon udający funkcję").
 *
 * Za flagą `isArtifactRightRailEnabled()` (`src/utils/artifactRightRailFlag.ts`,
 * domyślnie OFF) I TYLKO gdy wołający poda `args.artifact` (metadane realne,
 * nie stub). Bez flagi lub bez metadanych — `buildTabeleRightRailTools`
 * zwraca DOKŁADNIE te same 7 narzędzi co dziś, bit w bit (patrz test:
 * `buildTabeleRightRailTools({})` musi dawać 7-elementową listę bez zmian).
 *
 * Ikona `Info` (nie `LayoutGrid`, którego używa kanoniczny `ArtifactRightRail`
 * dla trybu Artefakt) — świadome odejście: `LayoutGrid` jest już zajęty przez
 * istniejące narzędzie „Layout" na tej samej szynie; dwie ikony identyczne
 * o różnym znaczeniu na jednym pasku byłyby nowym defektem wizualnym.
 */

import {
  Activity,
  BookOpen,
  Info,
  LayoutGrid,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { type RightRailToolDescriptor } from '@/components/shared/ExecutiveModuleShell/RightRail';
import {
  ArtifactRightPanel,
  type ArtifactRightPanelSection,
} from '@/components/standard/ArtifactRightPanel';

export type TabeleRightRailToolId =
  | 'artefakt'
  | 'search'
  | 'ai-editor'
  | 'qa-report'
  | 'source-pack'
  | 'layout'
  | 'share'
  | 'analytics';

/**
 * Metadane realne dla trybu Artefakt (o artefakcie) — wołający (`TabeleMelsView`)
 * dostarcza je z `preview`/`confidentiality`/`governanceVerdict`. Brak pola =
 * odpowiadająca treść pomijana, nigdy fabrykowana.
 */
export interface TabeleArtifactRelation {
  fieldName: string;
  targetTableName: string;
  targetCount: number;
}

export interface TabeleArtifactMeta {
  title?: string;
  confidentiality?: string;
  governanceVerdict?: string | null;
  recordCount?: number;
  fieldCount?: number;
  relations?: TabeleArtifactRelation[];
  isPolish?: boolean;
}

export interface TabeleRightRailLabels {
  search?: string;
  aiEditor?: string;
  qaReport?: string;
  sourcePack?: string;
  layout?: string;
  share?: string;
  analytics?: string;
}

const DEFAULT_LABELS: Required<TabeleRightRailLabels> = {
  search: 'Search records',
  aiEditor: 'AI Editor',
  qaReport: 'QA Report',
  sourcePack: 'Source Pack',
  layout: 'Layout',
  share: 'Share',
  analytics: 'Analytics',
};

export interface TabeleRightRailState {
  /** Total count of QA findings — drives the badge on the QA tool icon. */
  qaFindingsCount?: number;
  /** Source Pack item count. */
  sourcePackCount?: number;
  /** When false, AI Editor icon is rendered disabled. */
  aiEditorEnabled?: boolean;
  /** Source Pack tone (warning when low coverage). */
  sourcePackTone?: 'success' | 'warning' | 'danger' | null;
}

export function buildTabeleRightRailTools(args: {
  state?: TabeleRightRailState;
  labels?: TabeleRightRailLabels;
  /**
   * ★ Tryb Artefakt (patrz nagłówek pliku). Podane I flaga ON → tool
   * `'artefakt'` ląduje PIERWSZY na szynie. Pominięte, albo flaga OFF →
   * zero zmian w liście (identyczna z dzisiejszą, patrz test „returns tools
   * in the documented MELS spec order" wołany z `{}`).
   */
  artifact?: TabeleArtifactMeta;
  artifactLabel?: string;
}): RightRailToolDescriptor[] {
  const { state = {}, labels = {}, artifact, artifactLabel } = args;
  const L = { ...DEFAULT_LABELS, ...labels };

  const qaBadge =
    typeof state.qaFindingsCount === 'number' && state.qaFindingsCount > 0
      ? state.qaFindingsCount
      : undefined;

  const tools: RightRailToolDescriptor[] = [
    { id: 'search', label: L.search, icon: Search },
    {
      id: 'ai-editor',
      label: L.aiEditor,
      icon: Sparkles,
      disabled: state.aiEditorEnabled === false,
    },
    {
      id: 'qa-report',
      label: L.qaReport,
      icon: ShieldCheck,
      ...(qaBadge !== undefined ? { badge: qaBadge } : {}),
      ...(qaBadge !== undefined ? { dotTone: 'warning' as const } : {}),
    },
    {
      id: 'source-pack',
      label: L.sourcePack,
      icon: BookOpen,
      ...(state.sourcePackCount !== undefined ? { badge: state.sourcePackCount } : {}),
      ...(state.sourcePackTone ? { dotTone: state.sourcePackTone } : {}),
    },
    { id: 'layout', label: L.layout, icon: LayoutGrid },
    { id: 'share', label: L.share, icon: Share2 },
    { id: 'analytics', label: L.analytics, icon: Activity },
  ];

  if (artifact) {
    tools.unshift({
      id: 'artefakt',
      label: artifactLabel ?? (artifact.isPolish ? 'Artefakt' : 'Artifact'),
      icon: Info,
      testId: 'tabele-right-rail-tool-artefakt',
    });
  }

  return tools;
}

export interface TabeleRightRailPanelRenderers {
  /** ★ Tryb Artefakt — patrz nagłówek pliku. Zwykle `<TabeleArtifactPanel>`. */
  artefakt?: React.ReactNode;
  search?: React.ReactNode;
  aiEditor?: React.ReactNode;
  qaReport?: React.ReactNode;
  sourcePack?: React.ReactNode;
  layout?: React.ReactNode;
  share?: React.ReactNode;
  analytics?: React.ReactNode;
}

interface TabeleRightRailPanelProps {
  activeToolId: TabeleRightRailToolId | string | null;
  panels: TabeleRightRailPanelRenderers;
  /** Optional fallback when no panel matches. */
  fallback?: React.ReactNode;
}

const PANEL_KEY: Record<TabeleRightRailToolId, keyof TabeleRightRailPanelRenderers> = {
  artefakt: 'artefakt',
  search: 'search',
  'ai-editor': 'aiEditor',
  'qa-report': 'qaReport',
  'source-pack': 'sourcePack',
  layout: 'layout',
  share: 'share',
  analytics: 'analytics',
};

/* ------------------------------------------------------------------ */
/*  TRYB ARTEFAKT — sekcje kanonu + panel (treść od tego modułu,        */
/*  wygląd narzuca `ArtifactRightPanel`, patrz nagłówek pliku)          */
/* ------------------------------------------------------------------ */

const PropertyRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-start justify-between gap-3 py-1.5">
    <span className="shrink-0 text-[11px] uppercase tracking-wider text-c-text-muted">
      {label}
    </span>
    <span className="text-right text-xs text-c-text">{value}</span>
  </div>
);

/**
 * Sekcje kanonu (`ARTIFACT_PANEL_SECTION_ORDER`) dla trybu Artefakt Tabeli.
 * TYLKO Właściwości/Powiązania/Komentarze — jedyne, dla których ten moduł ma
 * REALNE dane (`TabeleArtifactMeta`, budowane w `TabeleMelsView` z `preview`).
 * Akcje/Źródła i założenia/Rezultaty/Historia pominięte celowo (kanon:
 * „lepiej brak niż pusty akordeon udający funkcję" — patrz
 * `ArtifactRightPanel.tsx` nagłówek).
 */
export function buildTabeleArtifactSections(meta: TabeleArtifactMeta): ArtifactRightPanelSection[] {
  const isPl = meta.isPolish !== false;
  const relations = meta.relations ?? [];

  return [
    {
      id: 'properties',
      label: isPl ? 'Właściwości' : 'Properties',
      defaultOpen: true,
      children: (
        <div className="flex flex-col divide-y divide-c-border-subtle">
          {meta.title ? <PropertyRow label={isPl ? 'Nazwa' : 'Name'} value={meta.title} /> : null}
          {meta.confidentiality ? (
            <PropertyRow
              label={isPl ? 'Poufność' : 'Confidentiality'}
              value={meta.confidentiality}
            />
          ) : null}
          {meta.governanceVerdict ? (
            <PropertyRow label={isPl ? 'Governance' : 'Governance'} value={meta.governanceVerdict} />
          ) : null}
          {typeof meta.recordCount === 'number' ? (
            <PropertyRow label={isPl ? 'Rekordy' : 'Records'} value={meta.recordCount} />
          ) : null}
          {typeof meta.fieldCount === 'number' ? (
            <PropertyRow label={isPl ? 'Pola' : 'Fields'} value={meta.fieldCount} />
          ) : null}
        </div>
      ),
    },
    {
      id: 'relations',
      // Kierunkowy podpis — jednolity z `ArtifactRightRail.SECTION_CAPTIONS`
      // (§2 ANALIZA_PRAWY_PANEL.md: „z czym to sąsiaduje").
      label: isPl ? 'Powiązania — z czym to sąsiaduje' : 'Relations — what this sits next to',
      defaultOpen: false,
      isEmpty: relations.length === 0,
      emptyLabel: isPl ? 'Brak relacji do innych tabel.' : 'No relations to other tables.',
      children:
        relations.length > 0 ? (
          <ul className="divide-y divide-c-border-subtle">
            {relations.map((rel) => (
              <li key={rel.fieldName} className="flex items-center justify-between gap-2 py-1.5">
                <span className="truncate text-xs text-c-text">
                  {rel.fieldName} → {rel.targetTableName}
                </span>
                <span className="shrink-0 text-[11px] tabular-nums text-c-text-muted">
                  {rel.targetCount}
                </span>
              </li>
            ))}
          </ul>
        ) : null,
    },
    {
      id: 'comments',
      label: isPl ? 'Komentarze' : 'Comments',
      defaultOpen: false,
      isEmpty: true,
      emptyLabel: isPl ? 'Brak komentarzy.' : 'No comments yet.',
      children: null,
    },
  ];
}

export const TabeleArtifactPanel: React.FC<{ meta: TabeleArtifactMeta }> = ({ meta }) => {
  const { t, i18n } = useTranslation();
  const isPl = meta.isPolish ?? !!i18n.language?.startsWith('pl');
  const sections = React.useMemo(
    () => buildTabeleArtifactSections({ ...meta, isPolish: isPl }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meta, isPl]
  );
  return (
    <ArtifactRightPanel
      sections={sections}
      width="100%"
      className="border-l-0"
      ariaLabel={t('tabele.rightRail.artefakt', isPl ? 'Artefakt tabeli' : 'Table artifact')}
    />
  );
};

export const TabeleRightRailPanel: React.FC<TabeleRightRailPanelProps> = ({
  activeToolId,
  panels,
  fallback,
}) => {
  if (!activeToolId) return null;
  const key = PANEL_KEY[activeToolId as TabeleRightRailToolId];
  if (!key) return <>{fallback ?? null}</>;
  const node = panels[key];
  return <>{node ?? fallback ?? null}</>;
};

export default TabeleRightRailPanel;
