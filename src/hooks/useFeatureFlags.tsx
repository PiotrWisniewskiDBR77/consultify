/**
 * useFeatureFlags Hook - Feature Flag Management
 *
 * Enterprise-grade feature flag system with local storage persistence,
 * remote flag support, and development tools.
 *
 * @example
 * // Check a feature flag
 * const { isEnabled, flags } = useFeatureFlags();
 * if (isEnabled('newSidebar')) {
 *   return <NewSidebar />;
 * }
 *
 * // Toggle a flag in development
 * const { setFlag } = useFeatureFlags();
 * setFlag('commandPalette', true);
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { API_URL, getHeaders } from '@/services/api';

// ============================================
// TYPES
// ============================================

export interface FeatureFlag {
  /** Unique flag identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Flag description */
  description?: string;
  /** Whether the flag is enabled by default */
  defaultValue: boolean;
  /** Category for organization */
  category: 'ui' | 'ai' | 'performance' | 'experimental' | 'beta';
  /** Flag expiry date (for temporary flags) */
  expiresAt?: Date;
  /** Percentage rollout (0-100) */
  rolloutPercent?: number;
  /** Whether the flag can be toggled locally */
  allowLocalOverride?: boolean;
}

export interface FeatureFlagsConfig {
  /** Available feature flags */
  flags: FeatureFlag[];
  /** Remote endpoint for fetching flags */
  remoteEndpoint?: string;
  /** Allow local overrides (dev-only) */
  enableLocalOverrides?: boolean;
  /** Enable DevTools panel */
  enableDevTools?: boolean;
  /** Storage key prefix */
  storagePrefix?: string;
  /** User ID for consistent rollout */
  userId?: string;
}

export interface UseFeatureFlagsReturn {
  /** Check if a feature flag is enabled */
  isEnabled: (flagId: string) => boolean;
  /** Get all flag values */
  flags: Record<string, boolean>;
  /** Set a local flag override */
  setFlag: (flagId: string, value: boolean) => void;
  /** Clear a local override */
  clearOverride: (flagId: string) => void;
  /** Clear all local overrides */
  clearAllOverrides: () => void;
  /** Get flag metadata */
  getFlagInfo: (flagId: string) => FeatureFlag | undefined;
  /** All flag definitions */
  flagDefinitions: FeatureFlag[];
  /** Loading state for remote flags */
  isLoading: boolean;
  /** Error from remote flag fetch */
  error: Error | null;
  /** Refresh flags from remote */
  refresh: () => Promise<void>;
}

// ============================================
// DEFAULT FLAGS
// ============================================

export const DEFAULT_FLAGS: FeatureFlag[] = [
  {
    id: 'myWorkNotebookV2',
    name: 'My Work Notebook (V2)',
    description: 'Backend-persisted Notebook with search + active notes surfaces',
    defaultValue: true,
    category: 'beta',
    allowLocalOverride: true,
  },
  {
    id: 'myWorkSignalsV2',
    name: 'My Work Signals Feed (V2)',
    description: 'Backend-driven signals feed with mute/snooze/dismiss learning loop',
    defaultValue: true,
    category: 'beta',
    allowLocalOverride: true,
  },
  {
    id: 'abTestingFramework',
    name: 'A/B Testing Framework',
    description: 'Experiment platform for A/B testing features with cohort allocation',
    defaultValue: false,
    category: 'performance',
    allowLocalOverride: true,
  },
  {
    id: 'landingProfitHeroV1',
    name: 'Landing: Profit Hero (V1)',
    description: 'Landing override: profit-first hero + video demo modal',
    defaultValue: false,
    category: 'experimental',
    allowLocalOverride: true,
  },
  {
    id: 'landingEpicHeroV1',
    name: 'Landing: Epic Hero (V1)',
    description: 'Landing override: cinematic hero (100vh) with floating preview + neon ambience',
    defaultValue: false,
    category: 'experimental',
    allowLocalOverride: true,
  },
  {
    id: 'landingHeroExperimentV2',
    name: 'Landing: Hero Experiment (V2)',
    description: '3-way bucketing on LP (control vs profit vs epic) with stable cohorts',
    defaultValue: true,
    category: 'experimental',
    allowLocalOverride: true,
  },
  {
    id: 'tablePlatformMetadataFirst',
    name: 'Table Platform: Metadata-First Backend',
    description:
      'Routes table persistence to the new metadata-first Records API instead of workspace graph',
    // Włączone decyzją Piotra D1 (2026-07-22, plan IDEE→9,5 / Z19). Bezpiecznik
    // w IdeaTableTool (platformLooksEmpty && legacyLooksPopulated → legacy)
    // trzyma zasiedlone legacy-tabele na starym silniku do czasu ich migracji
    // (MigrationService.migrateWorkspace); puste/nowe idą od razu na platformę.
    defaultValue: true,
    category: 'beta',
    allowLocalOverride: true,
  },
  // P3-8: `tablePlatformRecordsApi` usunieta jako FANTOM — zero czytelnikow
  // `isEnabled('tablePlatformRecordsApi')` w calym repo (FE i backend), a
  // endpointy /api/v1/bases i /api/v1/tables sa zamontowane BEZWARUNKOWO
  // (table-platform.routes.ts). Flaga niczego nie bramkowala. Zlota regula:
  // flaga bez implementacji to dlug, ktory myli — usunieta.
  {
    id: 'assessmentInitiativesWizard',
    name: 'Assessment: Initiatives Wizard',
    description: 'Controls the wizard flow for generated assessment initiatives',
    defaultValue: false,
    category: 'experimental',
    allowLocalOverride: false,
  },
  {
    id: 'assessmentMenu3StatusChips',
    name: 'Assessment: Menu 3 status filter chips',
    description:
      '#71 Tools-parity: replaces the 3 static informational Menu 3 chips (active-tab/' +
      'status-filter-label/documents) on AssessmentHub with a real clickable status-filter ' +
      'chip row (dot + count, toggle on click) — same TRIADA_KANON.md §A2/§A3 pattern already ' +
      'live on DiscoveryToolsHub (Tools) non-Library tabs. Counters currently live in Menu 2 ' +
      '(StatusDropdown, canon violation: "Bez liczników w Menu 2"); this moves them to Menu 3.',
    defaultValue: true,
    category: 'ui',
    allowLocalOverride: true,
  },
  {
    id: 'assessmentFiveSurfacesV1',
    name: 'Assessment: Five-surface Hub (Library/Processes/Outputs/Reports/Initiatives)',
    description:
      'ASM-001A: expands AssessmentHub from 3 tab ids (list/reports/initiatives) to 5 stable, ' +
      'URL-synced tab ids — library (new: published-definition picker + Start), processes ' +
      '(renamed from list, identical content/columns/preview), outputs (new placeholder with ' +
      'EmptyState), reports (unchanged), initiatives (unchanged). Library becomes the default ' +
      'tab and `?tab=` becomes the source of truth for the active tab (survives refresh/back/' +
      'forward, deep-linkable); legacy/unknown `?tab=` values (including the old `list`) ' +
      'resolve to processes. defaultValue flipped true 2026-08-01 (ASM-001A fix round): ' +
      'screenshot acceptance gate cleared, so this is now the live default for every ' +
      'authenticated user. Kill-switch is redeploy-based — flip defaultValue back to false ' +
      "and redeploy (Harvard/wdrozenie-100/_RUNBOOK_COFANIA.md, 'dramat wizualny → flaga OFF'). " +
      'A live remote override also exists and takes priority over defaultValue without a ' +
      'redeploy: GET {API_URL}/feature-flags/runtime (server/src/routes/featureFlags.routes.ts) ' +
      'is already called by every authenticated session (useFeatureFlags.tsx fetchRemoteFlags) ' +
      "and, if a `feature_flags` row with flag_key='assessmentFiveSurfacesV1' exists, its " +
      '`enabled` value overrides defaultValue — but that row must be created via a direct ' +
      'POST to /api/feature-flags (exact camelCase flag_key), NOT via the SuperAdmin ' +
      'EnterpriseFeatureFlags UI, which lowercases/underscores the Flag Key input and would ' +
      "create a non-matching key. OFF (legacy path, still fully supported) = today's exact " +
      'behavior — 3 tabs, `list` default, zero `?tab=` reads/writes.',
    defaultValue: true,
    category: 'experimental',
    allowLocalOverride: true,
  },
  {
    id: 'methodWorkspaceShellV1',
    name: 'Method Workspace — shared shell (A5)',
    description:
      'A5: common Method Workspace UI shell (MethodWorkspaceShell + Interview Focus + Live ' +
      'Matrix + Teresa panel + save-state machine) under src/components/method-workspace/, ' +
      'shared by DRD (A6) and SIRI (A7) vertical slices. Presentational only — reads/writes ' +
      'MethodSession/MethodReadiness/Teresa contracts from src/method-core/contracts, no ' +
      'DRD/SIRI-specific rule inside. OFF by default until owner acceptance on the ' +
      'dev-render screenshots (CLAUDE.md #7); A6/A7 mount it behind this same flag.',
    defaultValue: false,
    category: 'experimental',
    allowLocalOverride: true,
  },
  {
    id: 'drdMethodWorkspaceSliceV1',
    name: 'DRD vertical slice — Library→Session→Output→Report→Initiative (A6)',
    description:
      'A6 (2026-08-13): opens a DRD assessment session (`/assessment/drd/:id`) in the shared ' +
      '`MethodWorkspaceShell` (methodWorkspaceShellV1, A5) instead of the legacy ' +
      'DRDForm/DRDAssessmentEditor/DRDMatrixSession editor. Wires compileDrdPack() into the ' +
      'Navigator/Matrix, real event-store-backed answer/evidence recording, Teresa Intent→' +
      'Preview→Commit, freeze→AssessmentOutput bridge, Report Snapshot and Initiative Proposal ' +
      'Draft generation, and reopen→new-revision. Runs against `DrdSessionRuntime` ' +
      '(src/method-core/methods/drd/drdSessionRuntime.ts) — a browser-local mirror of the real ' +
      'kernel rules (contracts + Outputs factories), NOT yet wired over HTTP to ' +
      'server/src/method-core/*Service (that server mechanism is proven independently by ' +
      'server/src/method-core/outputs/__tests__/EventDerivedOutputBridge.test.ts). Also bypasses ' +
      "the DRD pack's `methodology_review` readiness gate for DEMO sessions only (never changes " +
      'the pack manifest itself) — the UI always shows this as an explicit banner, never silently. ' +
      'OFF by default until owner acceptance on dev-render screenshots (CLAUDE.md #7); OFF = the ' +
      "legacy DRD editor is completely untouched by this flag's code path.",
    defaultValue: false,
    category: 'experimental',
    allowLocalOverride: true,
  },
  {
    id: 'mindmapHeuristicAiOverlays',
    name: 'Mind Map: Heuristic AI Overlays (DP-5)',
    description:
      'DP-5 honesty gate for mind-map overlays whose displayed result is a client-side ' +
      'heuristic rather than real LLM output: AIBranchBalancer (no LLM call at all), ' +
      'AISentimentOverlay (sentiment = confidence-threshold mapping), AIAutoClustering ' +
      '(cluster membership = substring match), AIDependencyDetector (node pairs default to ' +
      'indices the backend never returns). OFF by default until backed by real AI analysis.',
    defaultValue: false,
    category: 'ai',
    allowLocalOverride: true,
  },
  {
    id: 'mindmapMultiToolbar',
    name: 'Mind Map: Multi-select Toolbar (M06 Fala 3.2)',
    description:
      'Shows the floating styling toolbar (branch color, shape, priority) when more than one ' +
      'node is selected on the mind map canvas, applying the chosen style to every selected ' +
      'node. OFF = today’s behavior where the toolbar only appears for a single selected node.',
    defaultValue: false,
    category: 'beta',
    allowLocalOverride: true,
  },
  {
    id: 'mindmapAlignSnap',
    name: 'Mind Map: Align/Distribute + Snap (M06 Fala 3.1)',
    description:
      'Positional canvas tools for the mind map (M06 Fala 3.1): align/distribute buttons on the ' +
      'multi-select toolbar (align left/center-H/right/top/middle-V/bottom for 2+ nodes, ' +
      'distribute H/V for 3+), an opt-in snap-to-grid toggle, and smart guide lines while ' +
      'dragging. OFF = today’s free-form positioning with no alignment affordances.',
    defaultValue: false,
    category: 'beta',
    allowLocalOverride: true,
  },
  {
    id: 'mindmapVirtualization',
    name: 'Mind Map: Viewport Virtualization (M06 Fala 3.3)',
    description:
      'Real viewport culling for large mind maps (M06 Fala 3.3): once a map crosses the node ' +
      'threshold, ReactFlow only mounts DOM for nodes intersecting the visible viewport ' +
      '(onlyRenderVisibleElements). All nodes stay in the graph store, so selection, the ' +
      'minimap, smart guides and multi-select styling keep working for off-screen nodes. ' +
      'OFF = today’s behavior where every node is always mounted in the DOM.',
    defaultValue: false,
    category: 'beta',
    allowLocalOverride: true,
  },
  {
    id: 'ENABLE_TERESA_MINDMAP',
    name: 'Teresa: Mind Map Bridge',
    description:
      'Sidekick→chat entity-context bridge for Ideas mind maps (M06 Fala 2 §2.1): kickoff carries ideaId/intent and reuses the existing conversation instead of creating a new one. OFF = today’s local-only kickoff behavior.',
    defaultValue: false,
    category: 'ai',
    allowLocalOverride: true,
  },
  {
    id: 'promptRegistryUi',
    name: 'SuperAdmin: Prompt Registry UI (Oxford O5.5)',
    description:
      'AI Platform > Development > Prompt Registry tab — read-only StandardTable inventory of ' +
      'the code-level prompt registry (server/src/ai/promptRegistry.ts) with checksum-drift ' +
      'status, sourced from GET /api/admin/prompts/registry (gated ai_ops capability). ' +
      'OFF = today’s Development tab list (no Prompt Registry sub-tab). Ships plain/kanoniczny ' +
      '(StandardTable/StandardModuleBar) per rule #7 — Vegas polishes visuals after screenshot ' +
      'acceptance.',
    defaultValue: true, // AKCEPT Piotra 2026-07-15 (zrzuty light+dark, fala 3)
    category: 'ui',
    allowLocalOverride: true,
  },
  {
    id: 'mindmapDrawerUnified',
    name: 'Mind Map: Unified Node Detail Drawer (Fala 4.1b)',
    description:
      'M06 Fala 4.1b consolidation: renders the single canonical UnifiedNodeDetailDrawer in both consumers (IdeaRecommendationMap M06 + IdeaMapWorkspace M05) instead of the two duplicated drawers (NodeDetailDrawer ~1042 LOC + IdeaNodeDetailDrawer ~1383 LOC). Superset of both capabilities (status enum, editable ExtendedNodeData fields, comments, evidence, convert, AI context). OFF = today’s two separate drawers (zero visual change).',
    defaultValue: true, // FLIP ON akcept Piotra 07-16
    category: 'beta',
    allowLocalOverride: true,
  },
  {
    id: 'ideaImportGuardRail',
    name: 'Idea Workspace: Import Guard Rail (P0-2)',
    description:
      'docs/standards/idea-workspace/10_KONWERSJA_EKSPORT_IMPORT_SZABLONY.md §4.1 — draw.io/' +
      'BPMN/diagram-package import into the Idea workspace stops replacing the whole graph on ' +
      'a single click. ON: staged confirm step (shows exactly how many nodes/edges are lost vs ' +
      'gained + source format), a snapshot taken BEFORE the destructive replace, a post-import ' +
      'summary, and one-click undo. OFF = today’s behavior (import runs immediately on click, ' +
      'no confirmation, snapshot only captured after the replace already happened). Visual ' +
      'change — render-verified przez CTO (regula #7 spelniona: zrzuty wykonane przed pokazaniem wlascicielowi), wlaczone domyslnie 2026-07-24, bo OFF znaczy, ze jedno klikniecie nadal kasuje caly graf bez ostrzezenia.',
    defaultValue: true,
    category: 'ui',
    allowLocalOverride: true,
  },
  {
    id: 'ideaSwitcherBottomRight',
    name: 'Idea Workspace: przełącznik reprezentacji w prawym dolnym rogu (D2)',
    description:
      'docs/standards/idea-workspace/03_ARCHITEKTURA_EKRANU.md §7 (decyzja D2) — cztery ' +
      'reprezentacje (Mapa/Tablica/Przepływ/Tabela) przełącza się w PRAWYM DOLNYM ROGU ' +
      'płótna, obok zoom/dopasuj/minimapy. ON: przełącznik w rogu, zdjęty z lewego railа. ' +
      'OFF (domyślnie): dzisiejszy przełącznik na górze lewego railа. Zmiana wizualna — ' +
      'zostaje OFF do akceptu zrzutów przez Piotra (reguła #7).',
    defaultValue: true,
    category: 'ui',
    allowLocalOverride: true,
  },
];

// ============================================
// STORAGE HELPERS
// ============================================

const STORAGE_KEY = 'consultify_feature_flags';
// tablePlatformMetadataFirst zdjęte z czyszczenia 2026-07-22 (D1: flaga default
// ON; stare wyczyszczone lokalne override'y OFF i tak już nie istnieją).
const CLEARED_FLAG_OVERRIDES = new Set<string>([]);

function sanitizeStoredOverrides(overrides: Record<string, boolean>): Record<string, boolean> {
  if (!overrides || typeof overrides !== 'object') return {};
  const next = { ...overrides };
  for (const flagId of CLEARED_FLAG_OVERRIDES) {
    delete next[flagId];
  }
  return next;
}

function getStoredOverrides(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : {};
    const sanitized = sanitizeStoredOverrides(parsed);
    if (stored && JSON.stringify(parsed) !== JSON.stringify(sanitized)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    }
    return sanitized;
  } catch {
    return {};
  }
}

function setStoredOverrides(overrides: Record<string, boolean>): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeStoredOverrides(overrides)));
  } catch {
    // Storage full or unavailable
  }
}

// ============================================
// ROLLOUT HELPERS
// ============================================

/**
 * Deterministic hash for consistent rollout based on user ID and flag ID
 */
function hashStringToNumber(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

function isInRollout(flagId: string, userId: string, percent: number): boolean {
  const hash = hashStringToNumber(`${flagId}:${userId}`);
  return hash % 100 < percent;
}

// ============================================
// HOOK
// ============================================

export function useFeatureFlags(config: Partial<FeatureFlagsConfig> = {}): UseFeatureFlagsReturn {
  const { flags: customFlags = [], remoteEndpoint, userId, enableLocalOverrides = false } = config;

  // Merge default and custom flags
  const flagDefinitions = useMemo(() => {
    const defaultIds = new Set(DEFAULT_FLAGS.map((f) => f.id));
    const uniqueCustom = customFlags.filter((f) => !defaultIds.has(f.id));
    return [...DEFAULT_FLAGS, ...uniqueCustom];
  }, [customFlags]);

  // State
  const [localOverrides, setLocalOverrides] = useState<Record<string, boolean>>(getStoredOverrides);
  const [remoteFlags, setRemoteFlags] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Fetch remote flags
  const fetchRemoteFlags = useCallback(async () => {
    const endpoint = remoteEndpoint ?? `${API_URL}/feature-flags/runtime`;
    const headers = getHeaders();
    const hasAuthToken = Boolean(headers.Authorization && headers.Authorization.trim());

    if (!remoteEndpoint && !hasAuthToken) {
      setRemoteFlags({});
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(endpoint, { headers });

      if (!response.ok) {
        throw new Error(`Failed to fetch flags: ${response.statusText}`);
      }

      const data = await response.json();
      setRemoteFlags(data.flags || {});
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [remoteEndpoint]);

  // Initial fetch
  useEffect(() => {
    fetchRemoteFlags();
  }, [fetchRemoteFlags]);

  // Compute final flag values
  const flags = useMemo(() => {
    const result: Record<string, boolean> = {};

    for (const flag of flagDefinitions) {
      // Check if expired
      if (flag.expiresAt && new Date() > new Date(flag.expiresAt)) {
        result[flag.id] = false;
        continue;
      }

      // Priority: local override > remote > rollout > default
      if (enableLocalOverrides && flag.allowLocalOverride && flag.id in localOverrides) {
        result[flag.id] = localOverrides[flag.id];
        continue;
      }

      if (flag.id in remoteFlags) {
        result[flag.id] = remoteFlags[flag.id];
        continue;
      }

      // Check rollout percentage
      if (flag.rolloutPercent !== undefined && userId) {
        result[flag.id] = isInRollout(flag.id, userId, flag.rolloutPercent);
        continue;
      }

      result[flag.id] = flag.defaultValue;
    }

    for (const [flagId, value] of Object.entries(remoteFlags)) {
      if (!(flagId in result)) {
        result[flagId] = Boolean(value);
      }
    }

    return result;
  }, [enableLocalOverrides, flagDefinitions, localOverrides, remoteFlags, userId]);

  // Check if a flag is enabled
  const isEnabled = useCallback(
    (flagId: string): boolean => {
      return flags[flagId] ?? false;
    },
    [flags]
  );

  // Set a local override
  const setFlag = useCallback(
    (flagId: string, value: boolean): void => {
      const flag = flagDefinitions.find((f) => f.id === flagId);

      // Only allow override if flag exists and permits it
      if (!enableLocalOverrides || !flag || flag.allowLocalOverride === false) {
        console.warn(`Cannot override flag: ${flagId}`);
        return;
      }

      setLocalOverrides((prev) => {
        const updated = { ...prev, [flagId]: value };
        setStoredOverrides(updated);
        return updated;
      });
    },
    [enableLocalOverrides, flagDefinitions]
  );

  // Clear a single override
  const clearOverride = useCallback((flagId: string): void => {
    setLocalOverrides((prev) => {
      const { [flagId]: _, ...rest } = prev;
      setStoredOverrides(rest);
      return rest;
    });
  }, []);

  // Clear all overrides
  const clearAllOverrides = useCallback((): void => {
    setLocalOverrides({});
    setStoredOverrides({});
  }, []);

  // Get flag metadata
  const getFlagInfo = useCallback(
    (flagId: string): FeatureFlag | undefined => {
      return flagDefinitions.find((f) => f.id === flagId);
    },
    [flagDefinitions]
  );

  return {
    isEnabled,
    flags,
    setFlag,
    clearOverride,
    clearAllOverrides,
    getFlagInfo,
    flagDefinitions,
    isLoading,
    error,
    refresh: fetchRemoteFlags,
  };
}

export default useFeatureFlags;
