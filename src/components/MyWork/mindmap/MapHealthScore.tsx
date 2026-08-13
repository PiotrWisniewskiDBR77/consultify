/**
 * MapHealthScore — widget „Zdrowie mapy".
 *
 * PRZED (do 2026-07-28): jedna liczba `overallScore` = średnia z pięciu
 * pod-wskaźników (Balance/Depth/Coverage/Maturity/Connectivity), z których
 * każdy miał wagi wzięte z sufitu (`childScore*0.3 + notesScore*0.2 + …`,
 * `connectivityScore = min(100, crossBranchEdges * 20)`). Właściciel: „nie mam
 * pojęcia jak to działa" — procent nie mówił CO zrobić.
 *
 * PO: żadnego procentu. Lista KONKRETNYCH, policzalnych braków — każdy z
 * prawdziwą liczbą policzoną z grafu i z przejściem na płótno (zaznacza i
 * kadruje winne węzły). Gdy braków nie ma — komunikat wprost, nie pusta lista.
 *
 * Mechanizm przejścia = ten sam, który już działa w produkcie: zdarzenie
 * `idea-workspace-highlight-node` (obsługiwane w IdeaRecommendationMap), tu
 * rozszerzone o `nodeIds` dla zbioru węzłów — 1:1 z pigułką „N niepowiązanych
 * elementów" w Whiteboard (`onActionConnect`: select + fitView na podzbiorze).
 */
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, ChevronUp } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface MapHealthScoreProps {
  nodes: Array<{ id: string; data: any; type?: string }>;
  edges: Array<{ id?: string; source: string; target: string; type?: string; data?: any }>;
  visible?: boolean;
  /** Przejście do problemu. Bez niego komponent użyje zdarzenia globalnego. */
  onFocusNodes?: (nodeIds: string[]) => void;
  /**
   * `true` = karta wewnątrz prawego panelu (sekcja „AI"), bez `absolute`/`z-*`
   * i bez stałej szerokości. Zgłoszenie właściciela 2026-07-28: „ten Map Health
   * wpada mi w okno i nie mogę go przesunąć — przerzuciłbym to do panelu
   * prawego". Flaga `ff_ideaPanel6Sections`; przy OFF zostaje overlay.
   */
  embedded?: boolean;
}

/** Jeden konkretny, policzalny brak. `count` = liczba winnych obiektów. */
interface MapGap {
  key: string;
  count: number;
  nodeIds: string[];
  label: string;
  hint: string;
}

/* ── Per-branch health scoring ─────────────────────────────────────── */

interface BranchHealthResult {
  score: number;
  label: 'healthy' | 'needs-work' | 'empty';
  childCount: number;
  hasNotes: boolean;
  hasEvidence: boolean;
  depthScore: number;
}

function collectDescendants(
  nodeId: string,
  edges: Array<{ source: string; target: string; data?: any }>
): string[] {
  const children = edges
    .filter((e) => e.source === nodeId && (!e.data?.edgeRole || e.data.edgeRole === 'structural'))
    .map((e) => e.target);
  const all: string[] = [...children];
  for (const cid of children) all.push(...collectDescendants(cid, edges));
  return all;
}

export function computeBranchHealth(
  branchNodeId: string,
  nodes: Array<{ id: string; data: any; type?: string }>,
  edges: Array<{ source: string; target: string; data?: any }>
): BranchHealthResult {
  const descendantIds = collectDescendants(branchNodeId, edges);
  const descendants = nodes.filter((n) => descendantIds.includes(n.id));

  const directChildren = edges.filter(
    (e) => e.source === branchNodeId && (!e.data?.edgeRole || e.data.edgeRole === 'structural')
  );
  const childCount = directChildren.length;

  const hasNotes = descendants.some((n) => n.data?.notes && String(n.data.notes).trim().length > 0);
  const hasEvidence = descendants.some(
    (n) => Array.isArray(n.data?.evidenceLinks) && n.data.evidenceLinks.length > 0
  );

  function maxDepth(nodeId: string, currentDepth: number): number {
    const kids = edges
      .filter((e) => e.source === nodeId && (!e.data?.edgeRole || e.data.edgeRole === 'structural'))
      .map((e) => e.target);
    if (kids.length === 0) return currentDepth;
    return Math.max(...kids.map((kid) => maxDepth(kid, currentDepth + 1)));
  }
  const depth = maxDepth(branchNodeId, 0);
  const depthScore = depth >= 3 ? 100 : Math.round((depth / 3) * 100);

  const childScore = childCount === 0 ? 0 : childCount === 1 ? 40 : childCount === 2 ? 70 : 100;
  const notesScore = hasNotes ? 100 : 0;
  const evidenceScore = hasEvidence ? 100 : 0;

  const score = Math.round(
    childScore * 0.3 + notesScore * 0.2 + evidenceScore * 0.2 + depthScore * 0.3
  );

  const label: BranchHealthResult['label'] =
    score >= 70 ? 'healthy' : score >= 30 ? 'needs-work' : 'empty';

  return { score, label, childCount, hasNotes, hasEvidence, depthScore };
}

/* ── BranchHealthDot — small colored indicator ────────────────────── */

/**
 * 2026-08-10 (E13 visual audit, HARD VISUAL FAIL „status conveyed by color
 * alone"): dawniej wyłącznie kolorowe kółko + `title` (hover-only, niepewne
 * dla czytników ekranu i niedostępne dla klawiatury/dotyku). Teraz: właściwa
 * nazwa dostępna (`role="img"` + `aria-label`) NIEZALEŻNA od hovera, plus
 * nie-kolorowy sygnał kształtu (pierścień u „needs-work", podwójny pierścień
 * u „empty") — rozróżnialne bez polegania na odcieniu.
 */
export const BranchHealthDot: React.FC<{ score: number; size?: number }> = ({
  score,
  size = 8,
}) => {
  const { t } = useTranslation();
  const tier: 'healthy' | 'needs-work' | 'empty' =
    score >= 70 ? 'healthy' : score >= 30 ? 'needs-work' : 'empty';
  const color =
    tier === 'healthy' ? 'var(--c-success)' : tier === 'needs-work' ? 'var(--c-warning)' : 'var(--c-danger)';
  const label = t('ideas.mindmap.branchHealthLabel', 'Zdrowie gałęzi: {{score}}%', { score });
  const ringWidth = tier === 'healthy' ? 0 : tier === 'needs-work' ? 1 : 2;
  return (
    <div
      role="img"
      aria-label={label}
      title={label}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: color,
        boxShadow: ringWidth > 0 ? `0 0 0 ${ringWidth}px var(--c-surface)` : undefined,
        outline: ringWidth > 0 ? `1px solid ${color}` : undefined,
        outlineOffset: ringWidth > 0 ? 1 : undefined,
        flexShrink: 0,
        pointerEvents: 'auto',
      }}
    />
  );
};

/* ── Braki mapy — policzalne, nie punktowane ──────────────────────── */

type GapEdge = { source: string; target: string; type?: string; data?: any };
type GapNode = { id: string; data: any; type?: string };

/**
 * Krawędź strukturalna (drzewo) vs relacja użytkownika.
 * Kanon repo: `data.edgeRole === 'relation'` = relacja (useMindMapNodes.getEdgeRole).
 * Dodatkowo `type === 'labeled'` — w mapie myśli WSZYSTKIE relacje rysuje
 * `LabeledEdge`, a struktura `GradientEdge`; starsze zapisy grafu bywają bez
 * `edgeRole`, więc sam typ krawędzi jest tu drugim, równie twardym sygnałem.
 */
function isStructuralGapEdge(e: GapEdge): boolean {
  if (e?.data?.edgeRole === 'relation') return false;
  if (e?.type === 'labeled') return false;
  return true;
}

const isRootNode = (n: GapNode) => n.type === 'center' || n.id === 'root';
const isBranchNode = (n: GapNode) => n.type === 'branch' || n.id.startsWith('branch-');
/** Ramka (Ctrl+G) z założenia nie ma etykiety ani krawędzi — nie jest brakiem. */
const isFrameNode = (n: GapNode) => n.type === 'group';
const labelOf = (n: GapNode) => String(n.data?.label ?? '').trim();

export interface MapGapsResult {
  gaps: MapGap[];
  /** Węzły brane pod uwagę (bez ramek). 0 = nie ma czego oceniać. */
  assessedCount: number;
}

/**
 * Liczy braki mapy. Każda pozycja = konkretny, sprawdzalny fakt o grafie
 * („5 węzłów bez etykiety"), nigdy oszacowanie ani wynik ważenia.
 */
export function computeMapGaps(
  nodes: GapNode[],
  edges: GapEdge[],
  labels: {
    label: (key: string, count: number) => string;
    hint: (key: string) => string;
  }
): MapGapsResult {
  const assessable = nodes.filter((n) => !isFrameNode(n));
  if (assessable.length === 0) return { gaps: [], assessedCount: 0 };

  const branches = assessable.filter((n) => isBranchNode(n) && !isRootNode(n));

  // dzieci strukturalne per węzeł (jedno przejście po krawędziach)
  const childrenOf = new Map<string, string[]>();
  const touched = new Set<string>();
  for (const e of edges) {
    touched.add(e.source);
    touched.add(e.target);
    if (!isStructuralGapEdge(e)) continue;
    const list = childrenOf.get(e.source);
    if (list) list.push(e.target);
    else childrenOf.set(e.source, [e.target]);
  }
  const kids = (id: string) => childrenOf.get(id) ?? [];

  const byId = new Map(assessable.map((n) => [n.id, n]));
  const hasEvidence = (n?: GapNode) =>
    Array.isArray(n?.data?.evidenceLinks) && n!.data.evidenceLinks.length > 0;

  /** Wszyscy potomkowie po krawędziach strukturalnych (bez cykli). */
  function descendants(rootId: string): string[] {
    const out: string[] = [];
    const seen = new Set<string>([rootId]);
    const stack = [...kids(rootId)];
    while (stack.length) {
      const id = stack.pop() as string;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
      stack.push(...kids(id));
    }
    return out;
  }

  // 1. Węzły bez etykiety — pusty węzeł nie niesie żadnej treści.
  const noLabel = assessable.filter((n) => !labelOf(n));

  // 2. Elementy niepowiązane z niczym — nie występują w ŻADNEJ krawędzi.
  //    (Korzeń pomijamy: na pustej mapie nie ma się z czym wiązać.)
  const isolated = assessable.filter((n) => !isRootNode(n) && !touched.has(n.id));

  // 3. Gałęzie bez ani jednego pomysłu.
  const emptyBranches = branches.filter((b) => kids(b.id).length === 0);

  // 4. Gałęzie bez rozwinięcia — mają pomysły, ale żaden nie ma poziomu niżej.
  const shallowBranches = branches.filter((b) => {
    const c = kids(b.id);
    return c.length > 0 && c.every((cid) => kids(cid).length === 0);
  });

  // 5. Gałęzie bez dowodów — ani gałąź, ani żaden jej potomek nie ma
  //    podpiętego `evidenceLinks`.
  const noEvidenceBranches = branches.filter(
    (b) => !hasEvidence(b) && !descendants(b.id).some((id) => hasEvidence(byId.get(id)))
  );

  const raw: Array<{ key: string; items: GapNode[] }> = [
    { key: 'gapNoLabel', items: noLabel },
    { key: 'gapIsolated', items: isolated },
    { key: 'gapEmptyBranch', items: emptyBranches },
    { key: 'gapShallowBranch', items: shallowBranches },
    { key: 'gapNoEvidence', items: noEvidenceBranches },
  ];

  const gaps: MapGap[] = raw
    .filter((g) => g.items.length > 0)
    .map((g) => ({
      key: g.key,
      count: g.items.length,
      nodeIds: g.items.map((n) => n.id),
      label: labels.label(g.key, g.items.length),
      hint: labels.hint(g.key),
    }));

  return { gaps, assessedCount: assessable.length };
}

/* ── Widget „Zdrowie mapy" ────────────────────────────────────────── */

export const MapHealthScore: React.FC<MapHealthScoreProps> = ({
  nodes,
  edges,
  visible = true,
  onFocusNodes,
  embedded,
}) => {
  const { t } = useTranslation();
  // W panelu karta startuje ROZWINIĘTA (lista braków to główna treść sekcji AI);
  // jako overlay nad płótnem — zwinięta, żeby nie zasłaniać mapy (jak dziś).
  const [expanded, setExpanded] = useState(Boolean(embedded));

  const { gaps, assessedCount } = useMemo(
    () =>
      computeMapGaps(nodes, edges, {
        label: (key, count) => t(`myWorkMindmap.health.${key}`, { count }),
        hint: (key) => t(`myWorkMindmap.health.${key}Hint`),
      }),
    [nodes, edges, t]
  );

  /**
   * Przejście do problemu. Preferuje callback powłoki; bez niego korzysta z
   * istniejącego zdarzenia `idea-workspace-highlight-node` (rozszerzonego o
   * `nodeIds`), żeby działać także z prawego panelu, gdzie propa nie ma.
   * `nodeId` zostaje dla zgodności ze starym, jednowęzłowym odbiornikiem.
   */
  const focusNodes = useCallback(
    (nodeIds: string[]) => {
      if (!nodeIds.length) return;
      if (onFocusNodes) {
        onFocusNodes(nodeIds);
        return;
      }
      window.dispatchEvent(
        new CustomEvent('idea-workspace-highlight-node', {
          detail: { nodeIds, nodeId: nodeIds[0] },
        })
      );
    },
    [onFocusNodes]
  );

  // Pusta mapa (albo same ramki) — nie ma czego oceniać, nie kłamiemy „bez braków".
  if (!visible || assessedCount === 0) return null;

  const hasGaps = gaps.length > 0;

  return (
    <div
      className={embedded ? 'w-full' : 'absolute top-14 right-3 z-dropdown'}
      data-testid="map-health-score"
    >
      <div
        className={
          embedded
            ? 'w-full rounded-[11px] bg-c-surface-raised border border-c-border-subtle overflow-hidden'
            : 'rounded-2xl bg-c-surface-raised dark:bg-c-surface backdrop-blur-xl border border-c-border-subtle dark:border-c-border-subtle shadow-2xl overflow-hidden min-w-[212px] max-w-[268px]'
        }
      >
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors"
        >
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              hasGaps ? 'bg-c-warning/15' : 'bg-c-success/15'
            }`}
          >
            {hasGaps ? (
              <AlertTriangle size={14} className="text-c-warning" />
            ) : (
              <CheckCircle2 size={14} className="text-c-success" />
            )}
          </div>
          <div className="flex-1 text-left">
            <div className="text-[10px] font-bold text-c-text-secondary dark:text-c-text-muted">
              {t('ideas.mindmap.mapHealth', 'Map Health')}
            </div>
            <div
              className={`text-[12px] font-bold leading-tight ${
                hasGaps ? 'text-c-warning' : 'text-c-success'
              }`}
            >
              {hasGaps
                ? t('myWorkMindmap.health.gapsCount', { count: gaps.length })
                : t('myWorkMindmap.health.noGaps')}
            </div>
          </div>
          {expanded ? (
            <ChevronUp size={12} className="text-c-text-secondary shrink-0" />
          ) : (
            <ChevronDown size={12} className="text-c-text-secondary shrink-0" />
          )}
        </button>

        {expanded && (
          <div className="px-2 pb-2 space-y-0.5">
            {hasGaps ? (
              gaps.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => focusNodes(g.nodeIds)}
                  title={t('myWorkMindmap.health.showOnMap')}
                  className="group w-full text-left rounded-lg px-2 py-1.5 hover:bg-c-warning/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-c-warning shrink-0" />
                    <span className="flex-1 text-[10px] font-semibold text-c-text dark:text-c-text-secondary">
                      {g.label}
                    </span>
                    <ChevronRight
                      size={11}
                      className="text-c-text-secondary opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    />
                  </div>
                  <div className="pl-3 text-[9px] text-c-text-secondary leading-snug">{g.hint}</div>
                </button>
              ))
            ) : (
              <div className="px-2 py-1.5 text-[9px] text-c-text-secondary leading-snug">
                {t('myWorkMindmap.health.noGapsHint')}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MapHealthScore;
