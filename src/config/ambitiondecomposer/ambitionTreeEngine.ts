/**
 * Ambition Decomposer — ambition tree, gap detection & topological sequencing
 * (OXFORD O3).
 *
 * Pattern mirror of src/config/portfolio/portfolioMatrixEngine.ts (dependency
 * graph + cycle detection), retargeted from a portfolio of independent
 * elements to an AMBITION TREE:
 *
 *   ambition (1) -> themes (N, scored by moveValidator.ts) -> initiatives (M,
 *   each delivering exactly one theme, each possibly depending on other
 *   initiatives).
 *
 * Two disciplines this closes (the audit gaps the tool exists to fix):
 *
 *   1. "AMBITION WITHOUT A PATH" — an ambition can look complete on paper (a
 *      statement, a few themes) while nothing under it is actually
 *      executable: a critical theme (foundation/bet, high importance) with
 *      zero initiatives is a stated intention with no delivery path. This is
 *      surfaced as a named gap, not silently accepted.
 *
 *   2. TOPOLOGICAL SEQUENCING — "what goes before what" for the INITIATIVES
 *      themselves (finer-grained than moveValidator's archetype-rank theme
 *      sequencing): initiatives can declare hard dependencies on each other,
 *      and the engine orders them with a real topological sort, detecting
 *      cycles instead of silently producing a nonsensical order.
 *
 * The theme-level W2 sequencing (rationale/trade-off/rejected variant) stays
 * in moveValidator.ts — this module is additive and reads its ranking to break
 * ties, it does not replace it.
 */

import { deriveArchetype, isAccepted, type ThemeItem, type ThemeRanking } from './moveValidator';

// ---------------------------------------------------------------------------
// Ambition tree
// ---------------------------------------------------------------------------

export interface AmbitionInitiativeNode {
  id: string;
  title: string;
  /** The theme this initiative delivers. */
  themeId: string;
  /** Ids of other initiatives that must ship first (hard prerequisite). */
  dependencies?: string[];
  proposalStatus?: string;
}

export interface AmbitionTreeInput {
  context?: { ambitionStatement?: string };
  themes?: ThemeItem[];
  initiatives?: AmbitionInitiativeNode[];
}

export interface AmbitionTreeThemeNode {
  theme: ThemeItem;
  initiatives: AmbitionInitiativeNode[];
}

export interface AmbitionTree {
  ambitionStatement: string;
  themes: AmbitionTreeThemeNode[];
  /** Initiatives whose themeId does not match any accepted theme. */
  orphanInitiatives: AmbitionInitiativeNode[];
}

const isAcceptedInitiative = (init: AmbitionInitiativeNode) =>
  init.proposalStatus !== 'rejected' && init.proposalStatus !== 'rethinking';

/** Groups accepted initiatives under their theme, and surfaces orphans. */
export function buildAmbitionTree(data: AmbitionTreeInput): AmbitionTree {
  const themes = (data.themes || []).filter(isAccepted);
  const initiatives = (data.initiatives || []).filter(isAcceptedInitiative);
  const themeIds = new Set(themes.map((t, i) => t.id || `theme-${i}`));

  const byTheme = new Map<string, AmbitionInitiativeNode[]>();
  const orphanInitiatives: AmbitionInitiativeNode[] = [];
  initiatives.forEach((init) => {
    if (themeIds.has(init.themeId)) {
      const list = byTheme.get(init.themeId) || [];
      list.push(init);
      byTheme.set(init.themeId, list);
    } else {
      orphanInitiatives.push(init);
    }
  });

  return {
    ambitionStatement: data.context?.ambitionStatement || '',
    themes: themes.map((theme, i) => ({
      theme,
      initiatives: byTheme.get(theme.id || `theme-${i}`) || [],
    })),
    orphanInitiatives,
  };
}

// ---------------------------------------------------------------------------
// Gap detection: "ambition without a path"
// ---------------------------------------------------------------------------

export type AmbitionGapCode =
  | 'ambition-without-themes'
  | 'theme-without-initiative'
  | 'orphan-initiative';

export interface AmbitionGap {
  code: AmbitionGapCode;
  themeId?: string;
  themeTitle?: string;
  initiativeId?: string;
  messageEn: string;
  messagePl: string;
}

/**
 * The critical-path check: a theme is CRITICAL when it is a foundation or a
 * bet, or is flagged high importance — these are the themes whose absence of
 * a delivery path is a real risk to the ambition, not a nice-to-have gap.
 */
function isCriticalTheme(theme: ThemeItem): boolean {
  const archetype = deriveArchetype(theme);
  return archetype === 'foundation' || archetype === 'bet' || theme.importance === 'high';
}

/**
 * Detects the "ambition without a path" family of gaps:
 *   - the ambition has an accepted statement but zero accepted themes
 *     (nothing has been decomposed at all — pure slogan);
 *   - a CRITICAL theme (foundation/bet/high-importance) has zero initiatives
 *     under it (the ambition names a critical workstream but nothing
 *     executes it);
 *   - an initiative references a theme that does not exist / is not accepted
 *     (orphaned — untraceable to the ambition tree).
 */
export function detectAmbitionGaps(data: AmbitionTreeInput): AmbitionGap[] {
  const gaps: AmbitionGap[] = [];
  const tree = buildAmbitionTree(data);

  if (tree.ambitionStatement.trim() && tree.themes.length === 0) {
    gaps.push({
      code: 'ambition-without-themes',
      messageEn:
        'The ambition has a statement but zero decomposed themes — there is no path from intention to execution yet.',
      messagePl:
        'Ambicja ma tezę, ale zero zdekomponowanych wątków — nie ma jeszcze ścieżki od intencji do realizacji.',
    });
  }

  tree.themes.forEach(({ theme, initiatives }, i) => {
    if (isCriticalTheme(theme) && initiatives.length === 0) {
      gaps.push({
        code: 'theme-without-initiative',
        themeId: theme.id || `theme-${i}`,
        themeTitle: theme.title,
        messageEn: `Theme "${theme.title}" is critical (${deriveArchetype(theme)}) but has zero initiatives — an ambition without an execution path.`,
        messagePl: `Wątek „${theme.title}" jest krytyczny (${deriveArchetype(theme)}), ale ma zero inicjatyw — ambicja bez ścieżki realizacji.`,
      });
    }
  });

  tree.orphanInitiatives.forEach((init) => {
    gaps.push({
      code: 'orphan-initiative',
      initiativeId: init.id,
      messageEn: `Initiative "${init.title}" references theme "${init.themeId}", which does not exist or was rejected — untraceable to the ambition.`,
      messagePl: `Inicjatywa „${init.title}" odwołuje się do wątku „${init.themeId}", którego nie ma lub został odrzucony — niepowiązana z ambicją.`,
    });
  });

  return gaps;
}

// ---------------------------------------------------------------------------
// Topological sequencing of initiatives ("what before what")
// ---------------------------------------------------------------------------

export interface AmbitionSequencedInitiative {
  id: string;
  title: string;
  themeId: string;
  /** Position in the valid topological order (1-based). */
  order: number;
  unlockedBy: string[];
}

export interface AmbitionInitiativeSequence {
  /** Valid topological order — dependencies always precede dependents. */
  ordered: AmbitionSequencedInitiative[];
  /** Initiatives that could not be scheduled because they sit in a dependency cycle. */
  blocked: { id: string; title: string; reason: string }[];
  /** Circular hard-dependency chains detected (unschedulable as-is). */
  cycles: string[][];
  /** Declared dependencies pointing at initiative ids that do not exist in this set. */
  danglingDependencies: { id: string; missing: string[] }[];
}

/**
 * Topologically sorts initiatives by their declared dependencies. Ties among
 * initiatives with no ordering constraint between them are broken by the
 * theme's priority rank (foundations/enablers first — reuses moveValidator's
 * ranking so the two engines never disagree), then by title for determinism.
 *
 * Cycle handling: initiatives inside a circular dependency chain are excluded
 * from `ordered` and reported in both `blocked` and `cycles` — never silently
 * dropped, never arbitrarily ordered.
 */
export function sequenceInitiativesTopologically(
  initiatives: AmbitionInitiativeNode[],
  themeRanking?: ThemeRanking
): AmbitionInitiativeSequence {
  const accepted = initiatives.filter(isAcceptedInitiative);
  const byId = new Map(accepted.map((i) => [i.id, i]));
  const idSet = new Set(byId.keys());

  const danglingDependencies: AmbitionInitiativeSequence['danglingDependencies'] = [];
  accepted.forEach((init) => {
    const missing = (init.dependencies || []).filter((d) => !idSet.has(d));
    if (missing.length > 0) danglingDependencies.push({ id: init.id, missing });
  });

  // Only in-set, non-dangling deps gate scheduling.
  const depsOf = (init: AmbitionInitiativeNode) =>
    (init.dependencies || []).filter((d) => idSet.has(d));

  // Cycle detection (DFS, tri-color) — mirror of portfolioMatrixEngine.
  const WHITE = 0,
    GRAY = 1,
    BLACK = 2;
  const color = new Map<string, number>();
  const stack: string[] = [];
  const cycles: string[][] = [];
  const dfs = (id: string) => {
    color.set(id, GRAY);
    stack.push(id);
    const node = byId.get(id);
    if (node) {
      for (const dep of depsOf(node)) {
        const c = color.get(dep) ?? WHITE;
        if (c === WHITE) dfs(dep);
        else if (c === GRAY) {
          const start = stack.indexOf(dep);
          if (start >= 0) cycles.push(stack.slice(start).concat(dep));
        }
      }
    }
    color.set(id, BLACK);
    stack.pop();
  };
  for (const id of idSet) if ((color.get(id) ?? WHITE) === WHITE) dfs(id);
  const inCycle = new Set(cycles.flat());

  const themeRank = new Map<string, number>();
  (themeRanking?.scores || []).forEach((s) => themeRank.set(s.id, s.sequenceRank));

  const schedulable = accepted.filter((i) => !inCycle.has(i.id));
  const scheduledIds = new Set<string>();
  const ordered: AmbitionSequencedInitiative[] = [];
  let order = 1;
  let progress = true;

  while (progress && scheduledIds.size < schedulable.length) {
    progress = false;
    // depsOf() already resolves only to in-set ids, so "ready" simply means
    // every declared dependency has already been scheduled (a dependency
    // stuck in a cycle is, by definition, never scheduled — its dependents
    // correctly stay unready and surface as "blocked" below).
    const ready = schedulable
      .filter((i) => !scheduledIds.has(i.id))
      .filter((i) => depsOf(i).every((d) => scheduledIds.has(d)));

    if (ready.length === 0) break;

    ready.sort((a, b) => {
      const ra = themeRank.get(a.themeId) ?? 99;
      const rb = themeRank.get(b.themeId) ?? 99;
      if (ra !== rb) return ra - rb;
      return a.title.localeCompare(b.title);
    });

    const next = ready[0];
    scheduledIds.add(next.id);
    ordered.push({
      id: next.id,
      title: next.title,
      themeId: next.themeId,
      order: order++,
      unlockedBy: depsOf(next),
    });
    progress = true;
  }

  const blocked: AmbitionInitiativeSequence['blocked'] = [];
  accepted.forEach((init) => {
    if (scheduledIds.has(init.id)) return;
    blocked.push({
      id: init.id,
      title: init.title,
      reason: inCycle.has(init.id)
        ? 'part of a circular dependency chain — cannot be sequenced as declared'
        : 'blocked by an unscheduled dependency',
    });
  });

  return { ordered, blocked, cycles, danglingDependencies };
}

/** Prompt block teaching the model the tree/gap/sequencing contract (PL/EN aware). */
export function buildAmbitionTreePromptRules(language: 'pl' | 'en'): string {
  if (language === 'pl') {
    return `Silnik buduje drzewo ambicji (ambicja -> wątki -> inicjatywy) i liczy DETERMINISTYCZNIE:
- lukę „ambicja bez ścieżki": krytyczny wątek (fundament/zakład/wysoka waga) bez ŻADNEJ inicjatywy = ambicja bez ścieżki realizacji — nazwij to wprost, nie przemilczaj.
- sekwencję topologiczną inicjatyw: inicjatywa z deklarowaną zależnością NIE MOŻE wyprzedzać inicjatywy, od której zależy; cykl zależności = zablokowane, nie zgaduj kolejności.
Każda inicjatywa MUSI wskazywać "themeId" (wątek, który dowozi) i opcjonalnie "dependencies" (id inicjatyw, które muszą być gotowe wcześniej).`;
  }
  return `The engine builds the ambition tree (ambition -> themes -> initiatives) and computes DETERMINISTICALLY:
- the "ambition without a path" gap: a critical theme (foundation/bet/high-importance) with ZERO initiatives = ambition with no delivery path — name it explicitly, do not paper over it.
- a topological sequence of initiatives: an initiative with a declared dependency MUST NOT precede the initiative it depends on; a dependency cycle = blocked, never guess an order.
Every initiative MUST state "themeId" (the theme it delivers) and optionally "dependencies" (ids of initiatives that must be ready first).`;
}
