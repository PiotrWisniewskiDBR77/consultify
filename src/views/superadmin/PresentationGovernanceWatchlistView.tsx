/**
 * PresentationGovernanceWatchlistView
 *
 * Read-only SuperAdmin surface that lists decks currently flagged
 * BLOCKED_P0 / BLOCKED_P1 by the org's governance cards, sorted by severity.
 *
 * Source: GET /api/presentations/governance/watchlist via
 * {@link fetchPresentationGovernanceWatchlist}. Mirrors the layout of
 * `PresentationTelemetryView` (header + controls, totals strip, table) and
 * surfaces an honest banner for forbidden / unavailable backends instead of
 * fabricating zero-counters. Never exposes raw deck JSON or raw quality gates,
 * only the aggregated metrics already present in the governance card.
 *
 * Auto-refresh: when enabled (default), the view polls the backend every 30s
 * while the tab is visible and the previous load was successful. Each
 * successful refresh diffs the new entries against the prior snapshot via
 * {@link diffWatchlistForNewBlockers} and surfaces a stacked alert region
 * for decks that transitioned INTO `BLOCKED_P0` or `BLOCKED_P1`. Permission
 * loss (`forbidden`) auto-pauses the polling loop honestly instead of
 * retrying in the background.
 */

import {
  AlertCircle,
  AlertTriangle,
  Bookmark,
  ChevronDown,
  Copy,
  Download,
  FileDown,
  FileUp,
  Loader2,
  Pause,
  Play,
  Plus,
  RefreshCcw,
  Search,
  ShieldAlert,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { buildHighlightSegments } from '../../services/highlightTextMatch';
import type { DashboardDeepLink } from '../../services/presentationGovernanceDeepLinks';
import {
  fetchPresentationGovernanceWatchlist,
  type WatchlistEntry,
  type WatchlistFetchStatus,
  type WatchlistResponse,
  type WatchlistVerdict,
} from '../../services/presentationGovernanceWatchlist';
import {
  diffWatchlistForNewBlockers,
  type WatchlistTransition,
} from '../../services/presentationGovernanceWatchlistDiff';
import {
  type ClientWatchlistPreset,
  createWatchlistPreset,
  deleteWatchlistPreset,
  fetchWatchlistPresets,
  type WatchlistPresetFetchStatus,
} from '../../services/presentationWatchlistPresets';
import {
  buildExportBundle,
  bundleToJson,
  type ImportPlan,
  parseImportJson,
  planImport,
  type WatchlistPresetExportBundle,
} from '../../services/presentationWatchlistPresetTransfer';
import {
  type ClientSavedSearchRecord,
  createSavedSearch,
  deleteSavedSearch,
  fetchSavedSearches,
  markSavedSearchUsed,
  type SavedSearchConfidentiality,
  type SavedSearchFetchStatus,
  type SavedSearchVerdict,
} from '../../services/presentationWatchlistSavedSearches';

const LIMIT_OPTIONS: number[] = [10, 25, 50, 100, 200];
const DEFAULT_LIMIT = 50;
const AUTO_REFRESH_INTERVAL_MS = 30_000;
const MAX_TRANSITION_ALERTS = 5;

// Sprint 12: client-side ad-hoc text search + saved-search filters. The
// debounce keeps the table from re-rendering on every keystroke; saved
// searches are applied immediately (they bypass the debounce) so users
// always see an honest preview when they pick from the dropdown.
const SEARCH_DEBOUNCE_MS = 250;
const SAVED_SEARCH_NAME_MAX = 60;
const SAVED_SEARCH_QUERY_MAX = 120;

const VERDICT_CHOICES: WatchlistVerdict[] = [
  'BLOCKED_P0',
  'BLOCKED_P1',
  'PASS_WITH_P2',
  'PASS',
  'INCONCLUSIVE',
];

// The watchlist GET serves confidentialityLevel as a free-form string
// today (`'public' | 'internal' | 'confidential' | string`). Saved-search
// confidentiality is stored using the canonical UPPERCASE codes from
// the policy service; we compare normalized forms to avoid surprising
// mismatches between PUBLIC ↔ public.
function normalizeConfidentialityCode(raw: string | null | undefined): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().toUpperCase();
}

interface ActiveSavedSearchFilters {
  verdicts: SavedSearchVerdict[];
  confidentiality: SavedSearchConfidentiality[];
  minSeverityScore: number;
}

const EMPTY_SAVED_SEARCH_FILTERS: ActiveSavedSearchFilters = {
  verdicts: [],
  confidentiality: [],
  minSeverityScore: 0,
};

function arraysEqualIgnoreOrder<T extends string>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  for (const v of b) if (!setA.has(v)) return false;
  return true;
}

function entryMatchesActiveSearch(
  entry: WatchlistEntry,
  query: string,
  filters: ActiveSavedSearchFilters
): boolean {
  if (query.length > 0) {
    const haystack = (entry.title || '').toLocaleLowerCase();
    const needle = query.toLocaleLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  if (
    filters.verdicts.length > 0 &&
    !filters.verdicts.includes(entry.overallVerdict as SavedSearchVerdict)
  ) {
    return false;
  }
  if (filters.confidentiality.length > 0) {
    const normalized = normalizeConfidentialityCode(entry.confidentialityLevel);
    if (!filters.confidentiality.some((c) => c === normalized)) return false;
  }
  if ((entry.severityScore ?? 0) < filters.minSeverityScore) return false;
  return true;
}

const VERDICT_TONE: Record<WatchlistVerdict, string> = {
  PASS: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  PASS_WITH_P2: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  BLOCKED_P1: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
  BLOCKED_P0: 'bg-danger-100 text-danger-700 dark:bg-danger-500/20 dark:text-danger-300',
  INCONCLUSIVE: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300',
};

function formatRelativeTime(iso: string | null): string {
  if (!iso) return '—';
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return '—';
  const diffMs = Date.now() - ts;
  if (diffMs < 0) return new Date(ts).toLocaleString();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(ts).toLocaleDateString();
}

function formatClockTime(date: Date | null): string {
  if (!date) return '—';
  try {
    return date.toLocaleTimeString();
  } catch {
    return date.toISOString();
  }
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString();
}

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildWatchlistCsv(entries: WatchlistEntry[]): string {
  const columns = [
    'deckId',
    'title',
    'overallVerdict',
    'p0',
    'p1',
    'p2',
    'gateCount',
    'exportsBlocked',
    'lastActivityAt',
    'confidentialityLevel',
    'updatedAt',
    'severityScore',
  ];
  const lines: string[] = [];
  lines.push(columns.join(','));
  for (const e of entries) {
    lines.push(
      [
        e.deckId,
        e.title,
        e.overallVerdict,
        e.p0,
        e.p1,
        e.p2,
        e.gateCount,
        e.exportsBlocked,
        e.lastActivityAt ?? '',
        e.confidentialityLevel,
        e.updatedAt ?? '',
        e.severityScore,
      ]
        .map(escapeCsvCell)
        .join(',')
    );
  }
  // CRLF + UTF-8 BOM for spreadsheet compatibility.
  return '\uFEFF' + lines.join('\r\n');
}

function downloadCsvBlob(filename: string, csv: string): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return;
  try {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    // Best-effort download — failure surfaces nothing dangerous.
  }
}

function downloadJsonBlob(filename: string, json: string): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return;
  try {
    // BOM-free UTF-8: a leading BOM corrupts JSON.parse on some readers.
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    // Best-effort download — failure surfaces nothing dangerous.
  }
}

function statusReason(status: WatchlistFetchStatus | null): string | null {
  if (!status || status === 'ok') return null;
  if (status === 'forbidden') {
    return 'Insufficient permission to load the governance watchlist.';
  }
  if (status === 'not_found') {
    return 'Governance watchlist endpoint not found.';
  }
  if (status === 'unavailable') {
    return 'Governance watchlist is unavailable. The backend may be offline.';
  }
  return 'Could not load the governance watchlist.';
}

function isPageVisible(): boolean {
  if (typeof document === 'undefined') return true;
  return document.visibilityState === 'visible';
}

function transitionKey(t: WatchlistTransition, generatedAt: number): string {
  return `${t.deckId}:${t.toVerdict}:${generatedAt}`;
}

interface KeyedTransition extends WatchlistTransition {
  alertKey: string;
}

interface PresentationGovernanceWatchlistViewProps {
  onJumpToDeck?: (deckId: string) => void;
  deepLink?: DashboardDeepLink;
}

const DEEP_LINK_HIGHLIGHT_MS = 5000;

const PresentationGovernanceWatchlistView: React.FC<PresentationGovernanceWatchlistViewProps> = ({
  onJumpToDeck,
  deepLink,
}) => {
  const [onlyBlocked, setOnlyBlocked] = useState<boolean>(true);
  const [limit, setLimit] = useState<number>(DEFAULT_LIMIT);
  const [data, setData] = useState<WatchlistResponse | null>(null);
  const [status, setStatus] = useState<WatchlistFetchStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasAttempted, setHasAttempted] = useState<boolean>(false);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);
  const [pageVisible, setPageVisible] = useState<boolean>(() => isPageVisible());
  const [transitionAlerts, setTransitionAlerts] = useState<KeyedTransition[]>([]);
  const previousEntriesRef = useRef<WatchlistEntry[] | null>(null);

  // Sprint 9: per-org saved filter presets. We only gate the *initial*
  // watchlist load on the preset bootstrap so a default preset can be
  // applied before the first fetch. Subsequent reloads are not gated.
  const [presets, setPresets] = useState<ClientWatchlistPreset[]>([]);
  const [presetsStatus, setPresetsStatus] = useState<WatchlistPresetFetchStatus | null>(null);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [presetsBootstrapped, setPresetsBootstrapped] = useState<boolean>(false);
  const [presetMenuOpen, setPresetMenuOpen] = useState<boolean>(false);
  const [manageMode, setManageMode] = useState<boolean>(false);
  const [saveFormOpen, setSaveFormOpen] = useState<boolean>(false);
  const [newPresetName, setNewPresetName] = useState<string>('');
  const [newPresetDescription, setNewPresetDescription] = useState<string>('');
  const [newPresetIsDefault, setNewPresetIsDefault] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const presetMenuRef = useRef<HTMLDivElement | null>(null);

  // Sprint 11: JSON export/import for presets. The import flow is
  // explicit-confirm: we never auto-create presets from a file. The
  // bundle/plan are kept in component state so the user can review the
  // partition before committing, then we iterate `plan.toCreate` against
  // `createWatchlistPreset` and surface a final result count.
  const [importBundle, setImportBundle] = useState<WatchlistPresetExportBundle | null>(null);
  const [importPlan, setImportPlan] = useState<ImportPlan | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importBusy, setImportBusy] = useState<boolean>(false);
  const [importResult, setImportResult] = useState<{ created: number; failed: number } | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Deep-link consumption is intentionally one-shot. We snapshot the
  // initial deck/preset values on mount and clear them after they fire so
  // a re-render with the same props does not re-trigger the highlight or
  // re-apply the preset over an explicit user action.
  const [deepLinkHighlightDeckId, setDeepLinkHighlightDeckId] = useState<string | null>(
    deepLink?.deckId ?? null
  );
  const initialDeepLinkRef = useRef<DashboardDeepLink | null>(deepLink ?? null);
  const presetAppliedRef = useRef<boolean>(false);
  const highlightedRowRef = useRef<HTMLTableRowElement | null>(null);

  // Sprint 12: ad-hoc text search + saved searches. The text search is
  // client-side only (server-side fetch stays Sprint-9-shaped) and is
  // debounced so each keystroke doesn't re-render the table; saved
  // searches are applied immediately and bypass the debounce so the
  // dropdown selection feels instant.
  const [searchInput, setSearchInput] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  const [activeSavedFilters, setActiveSavedFilters] = useState<ActiveSavedSearchFilters>(
    EMPTY_SAVED_SEARCH_FILTERS
  );
  const [savedSearches, setSavedSearches] = useState<ClientSavedSearchRecord[]>([]);
  const [savedSearchesStatus, setSavedSearchesStatus] = useState<SavedSearchFetchStatus | null>(
    null
  );
  const [savedSearchesBootstrapped, setSavedSearchesBootstrapped] = useState<boolean>(false);
  const [activeSavedSearchId, setActiveSavedSearchId] = useState<string | null>(null);
  const [savedSearchMenuOpen, setSavedSearchMenuOpen] = useState<boolean>(false);
  const [savedSearchManageMode, setSavedSearchManageMode] = useState<boolean>(false);
  const [savedSearchSaveFormOpen, setSavedSearchSaveFormOpen] = useState<boolean>(false);
  const [newSavedSearchName, setNewSavedSearchName] = useState<string>('');
  const [newSavedSearchIsDefault, setNewSavedSearchIsDefault] = useState<boolean>(false);
  const [savedSearchSaveError, setSavedSearchSaveError] = useState<string | null>(null);
  const [savedSearchSaving, setSavedSearchSaving] = useState<boolean>(false);
  const [savedSearchDeleteConfirmId, setSavedSearchDeleteConfirmId] = useState<string | null>(null);
  const savedSearchAppliedRef = useRef<boolean>(false);
  const savedSearchMenuRef = useRef<HTMLDivElement | null>(null);

  const handleLoad = useCallback(async () => {
    setLoading(true);
    setHasAttempted(true);
    try {
      const result = await fetchPresentationGovernanceWatchlist({ onlyBlocked, limit });
      setStatus(result.status);
      const ok = result.status === 'ok' && !!result.data;
      setData(ok && result.data ? result.data : null);

      if (ok && result.data) {
        const nextEntries = result.data.entries;
        // Skip diff on the very first successful load to avoid alerting on
        // every already-blocked deck. From the second load onward we have a
        // baseline snapshot to compare against.
        const newTransitions =
          previousEntriesRef.current === null
            ? []
            : diffWatchlistForNewBlockers(previousEntriesRef.current, nextEntries);

        previousEntriesRef.current = nextEntries;

        if (newTransitions.length > 0) {
          const stamp = Date.now();
          const keyed: KeyedTransition[] = newTransitions.map((t, idx) => ({
            ...t,
            alertKey: `${transitionKey(t, stamp)}:${idx}`,
          }));
          setTransitionAlerts((prev) => [...keyed, ...prev].slice(0, MAX_TRANSITION_ALERTS));
        }

        setLastRefreshAt(new Date());
      } else if (result.status === 'forbidden') {
        // Permission revoked mid-session — stop polling honestly instead of
        // hammering a 403 every 30 seconds.
        setAutoRefresh(false);
      }
    } finally {
      setLoading(false);
    }
  }, [onlyBlocked, limit]);

  // Bootstrap: load presets first so a default preset (if any) can seed the
  // initial filters before the very first watchlist GET. We only block the
  // initial load — once bootstrapped, the standard handleLoad effect takes
  // over and any preset application is just a normal filter change.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await fetchWatchlistPresets();
      if (cancelled) return;
      setPresetsStatus(result.status);
      if (result.status === 'ok') {
        setPresets(result.presets);
        const def = result.presets.find((p) => p.isDefault);
        if (def) {
          setOnlyBlocked(def.filters.onlyBlocked);
          setLimit(def.filters.limit);
          setActivePresetId(def.id);
        }
      }
      setPresetsBootstrapped(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!presetsBootstrapped) return;
    void handleLoad();
  }, [handleLoad, presetsBootstrapped]);

  // Sprint 12: bootstrap saved searches and apply the default (if any)
  // exactly once on first mount. From that point onward user actions
  // win — re-fetching the saved-search list does not re-apply any
  // default, and the active selection stays where the user left it.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await fetchSavedSearches();
      if (cancelled) return;
      setSavedSearchesStatus(result.status);
      if (result.status === 'ok' && Array.isArray(result.records)) {
        setSavedSearches(result.records);
        if (!savedSearchAppliedRef.current) {
          const def = result.records.find((r) => r.isDefault);
          if (def) {
            setSearchInput(def.queryText);
            setDebouncedQuery(def.queryText);
            setActiveSavedFilters({
              verdicts: (def.filters.verdicts as SavedSearchVerdict[]) ?? [],
              confidentiality: (def.filters.confidentiality as SavedSearchConfidentiality[]) ?? [],
              minSeverityScore: def.filters.minSeverityScore ?? 0,
            });
            setActiveSavedSearchId(def.id);
            savedSearchAppliedRef.current = true;
          }
        }
      }
      setSavedSearchesBootstrapped(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounce the text search input so each keystroke does not re-render
  // the entire table. Saved-search application bypasses this by writing
  // both `searchInput` and `debouncedQuery` synchronously.
  useEffect(() => {
    if (typeof window === 'undefined') {
      setDebouncedQuery(searchInput);
      return;
    }
    const id = window.setTimeout(() => {
      setDebouncedQuery(searchInput);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisibility = () => setPageVisible(isPageVisible());
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Close the saved-searches menu on outside click. Mirror the presets
  // menu behavior — listener is only attached while open so we don't
  // keep a permanent global handler around.
  useEffect(() => {
    if (!savedSearchMenuOpen) return;
    if (typeof document === 'undefined') return;
    const onDocClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (savedSearchMenuRef.current && savedSearchMenuRef.current.contains(target)) {
        return;
      }
      setSavedSearchMenuOpen(false);
      setSavedSearchSaveFormOpen(false);
      setSavedSearchManageMode(false);
      setSavedSearchDeleteConfirmId(null);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [savedSearchMenuOpen]);

  // Close the presets menu on outside click. We only attach the listener
  // while the menu is open to avoid a permanent global click handler.
  useEffect(() => {
    if (!presetMenuOpen) return;
    if (typeof document === 'undefined') return;
    const onDocClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (presetMenuRef.current && presetMenuRef.current.contains(target)) return;
      setPresetMenuOpen(false);
      setSaveFormOpen(false);
      setManageMode(false);
      setDeleteConfirmId(null);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [presetMenuOpen]);

  // Auto-refresh ticker. We restart the timer on every successful load
  // (`lastRefreshAt`) so a manual Reload also resets the 30s window. The
  // interval is suppressed when the tab is hidden, the user paused the
  // toggle, or the previous load did not succeed.
  useEffect(() => {
    if (!autoRefresh) return;
    if (status !== 'ok') return;
    if (!pageVisible) return;
    if (typeof window === 'undefined') return;
    const id = window.setInterval(() => {
      void handleLoad();
    }, AUTO_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [autoRefresh, status, pageVisible, lastRefreshAt, handleLoad]);

  const reasonBanner = useMemo(() => statusReason(status), [status]);

  const handleAction = useCallback(
    (entry: WatchlistEntry) => {
      if (typeof onJumpToDeck === 'function') {
        onJumpToDeck(entry.deckId);
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(entry.deckId).catch(() => {
          // Clipboard may be blocked in some contexts; failure is non-fatal.
        });
      }
    },
    [onJumpToDeck]
  );

  const handleDismissAlert = useCallback((alertKey: string) => {
    setTransitionAlerts((prev) => prev.filter((a) => a.alertKey !== alertKey));
  }, []);

  const handleDismissAllAlerts = useCallback(() => {
    setTransitionAlerts([]);
  }, []);

  const handleToggleAutoRefresh = useCallback(() => {
    setAutoRefresh((v) => !v);
  }, []);

  const handleExportCsv = useCallback(() => {
    if (!data || data.entries.length === 0) return;
    const date = new Date().toISOString().slice(0, 10);
    const filterTag = onlyBlocked ? 'blocked' : 'all';
    const csv = buildWatchlistCsv(data.entries);
    downloadCsvBlob(`governance-watchlist-${filterTag}-${date}.csv`, csv);
  }, [data, onlyBlocked]);

  const activePreset = useMemo(
    () => presets.find((p) => p.id === activePresetId) || null,
    [presets, activePresetId]
  );

  // The preset is "modified" when the live filters drift away from the
  // preset's saved filters. We compare just the dimensions the watchlist GET
  // currently honors (onlyBlocked, limit). MinSeverity / confidentiality are
  // future-proofing for the server contract; we deliberately do not include
  // them here so the modified-indicator stays honest about the filters that
  // actually changed the data shown.
  const isPresetModified = useMemo(() => {
    if (!activePreset) return false;
    return activePreset.filters.onlyBlocked !== onlyBlocked || activePreset.filters.limit !== limit;
  }, [activePreset, onlyBlocked, limit]);

  // Sprint 12: derived state for the active saved-search chip and the
  // client-side filtering pipeline.
  const activeSavedSearch = useMemo(
    () => savedSearches.find((r) => r.id === activeSavedSearchId) || null,
    [savedSearches, activeSavedSearchId]
  );

  const isSavedSearchModified = useMemo(() => {
    if (!activeSavedSearch) return false;
    const savedQuery = (activeSavedSearch.queryText || '').trim();
    if (savedQuery !== searchInput.trim()) return true;
    const savedVerdicts = (activeSavedSearch.filters.verdicts ?? []) as SavedSearchVerdict[];
    if (!arraysEqualIgnoreOrder(savedVerdicts, activeSavedFilters.verdicts)) {
      return true;
    }
    const savedConf = (activeSavedSearch.filters.confidentiality ??
      []) as SavedSearchConfidentiality[];
    if (!arraysEqualIgnoreOrder(savedConf, activeSavedFilters.confidentiality)) {
      return true;
    }
    const savedMin = activeSavedSearch.filters.minSeverityScore ?? 0;
    if (savedMin !== activeSavedFilters.minSeverityScore) return true;
    return false;
  }, [activeSavedSearch, activeSavedFilters, searchInput]);

  // Apply the text query + saved-search filters client-side. Empty query +
  // empty filter arrays + zero minSeverityScore short-circuits to the
  // server-returned entries so the table footer counts match the server
  // view when nothing is active.
  const filteredEntries = useMemo(() => {
    if (!data) return [] as WatchlistEntry[];
    const query = debouncedQuery.trim();
    const noFilters =
      query.length === 0 &&
      activeSavedFilters.verdicts.length === 0 &&
      activeSavedFilters.confidentiality.length === 0 &&
      activeSavedFilters.minSeverityScore === 0;
    if (noFilters) return data.entries;
    return data.entries.filter((entry) =>
      entryMatchesActiveSearch(entry, query, activeSavedFilters)
    );
  }, [data, debouncedQuery, activeSavedFilters]);

  const savedSearchesAvailable = savedSearchesStatus === 'ok' || savedSearchesStatus === null;
  const savedSearchesUnavailableMessage =
    savedSearchesStatus === 'forbidden'
      ? 'Saved searches unavailable (insufficient permission).'
      : savedSearchesStatus === 'unavailable'
        ? 'Saved searches unavailable — apply migration 766.'
        : savedSearchesStatus === 'error'
          ? 'Saved searches unavailable.'
          : null;

  const refreshPresets = useCallback(async (): Promise<ClientWatchlistPreset[] | null> => {
    const result = await fetchWatchlistPresets();
    setPresetsStatus(result.status);
    if (result.status === 'ok') {
      setPresets(result.presets);
      return result.presets;
    }
    return null;
  }, []);

  const handleSelectPreset = useCallback((preset: ClientWatchlistPreset) => {
    setOnlyBlocked(preset.filters.onlyBlocked);
    setLimit(preset.filters.limit);
    setActivePresetId(preset.id);
    setPresetMenuOpen(false);
    setSaveFormOpen(false);
    setManageMode(false);
  }, []);

  // Sprint 10 deep-link entry point: select a preset by id (the contract
  // documented in the cross-tab deep-link service). Lookup-by-id keeps
  // the API stable even if the preset object identity changes between
  // bootstrap fetches.
  const applyPreset = useCallback(
    (presetId: string): boolean => {
      const preset = presets.find((p) => p.id === presetId);
      if (!preset) return false;
      handleSelectPreset(preset);
      return true;
    },
    [presets, handleSelectPreset]
  );

  const handleClearActivePreset = useCallback(() => {
    setActivePresetId(null);
  }, []);

  const handleOpenSaveForm = useCallback(() => {
    setSaveFormOpen(true);
    setSaveError(null);
    setNewPresetName('');
    setNewPresetDescription('');
    setNewPresetIsDefault(false);
  }, []);

  const handleCloseSaveForm = useCallback(() => {
    setSaveFormOpen(false);
    setSaveError(null);
  }, []);

  const handleSavePreset = useCallback(async () => {
    const trimmedName = newPresetName.trim();
    if (!trimmedName) {
      setSaveError('Name is required.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const description = newPresetDescription.trim();
      const result = await createWatchlistPreset({
        name: trimmedName,
        description: description.length > 0 ? description : undefined,
        filters: { onlyBlocked, limit },
        isDefault: newPresetIsDefault,
      });
      if (result.status === 'conflict') {
        // Honest failure surface: never silently overwrite an existing
        // preset with the same name.
        setSaveError('A preset with this name already exists.');
        return;
      }
      if (result.status !== 'ok') {
        setSaveError(`Could not save preset (${result.error || result.status}).`);
        return;
      }
      const refreshed = await refreshPresets();
      const created =
        result.preset ??
        (refreshed ? (refreshed.find((p) => p.name === trimmedName) ?? null) : null);
      if (created) setActivePresetId(created.id);
      setSaveFormOpen(false);
      setPresetMenuOpen(false);
    } finally {
      setSaving(false);
    }
  }, [newPresetName, newPresetDescription, newPresetIsDefault, onlyBlocked, limit, refreshPresets]);

  const handleRequestDelete = useCallback((id: string) => {
    setDeleteConfirmId(id);
  }, []);

  const handleCancelDelete = useCallback(() => {
    setDeleteConfirmId(null);
  }, []);

  const handleConfirmDelete = useCallback(
    async (id: string) => {
      const result = await deleteWatchlistPreset(id);
      if (result.status === 'ok') {
        if (activePresetId === id) setActivePresetId(null);
        await refreshPresets();
        setDeleteConfirmId(null);
      }
    },
    [activePresetId, refreshPresets]
  );

  // ---------------------------------------------------------------------
  // Sprint 12: saved-searches handlers
  // ---------------------------------------------------------------------
  const refreshSavedSearches = useCallback(async (): Promise<ClientSavedSearchRecord[] | null> => {
    const result = await fetchSavedSearches();
    setSavedSearchesStatus(result.status);
    if (result.status === 'ok' && Array.isArray(result.records)) {
      setSavedSearches(result.records);
      return result.records;
    }
    return null;
  }, []);

  const applySavedSearch = useCallback((record: ClientSavedSearchRecord) => {
    setSearchInput(record.queryText);
    setDebouncedQuery(record.queryText);
    setActiveSavedFilters({
      verdicts: (record.filters.verdicts as SavedSearchVerdict[]) ?? [],
      confidentiality: (record.filters.confidentiality as SavedSearchConfidentiality[]) ?? [],
      minSeverityScore: record.filters.minSeverityScore ?? 0,
    });
    setActiveSavedSearchId(record.id);
    setSavedSearchMenuOpen(false);
    setSavedSearchSaveFormOpen(false);
    setSavedSearchManageMode(false);
    // Fire-and-forget — bookkeeping only, never gates UI.
    void markSavedSearchUsed(record.id);
  }, []);

  const handleClearActiveSavedSearch = useCallback(() => {
    setActiveSavedSearchId(null);
  }, []);

  const handleClearActiveSavedFilters = useCallback(() => {
    setSearchInput('');
    setDebouncedQuery('');
    setActiveSavedFilters(EMPTY_SAVED_SEARCH_FILTERS);
    setActiveSavedSearchId(null);
  }, []);

  const handleOpenSaveSearchForm = useCallback(() => {
    setSavedSearchSaveFormOpen(true);
    setSavedSearchSaveError(null);
    setNewSavedSearchName('');
    setNewSavedSearchIsDefault(false);
  }, []);

  const handleCloseSaveSearchForm = useCallback(() => {
    setSavedSearchSaveFormOpen(false);
    setSavedSearchSaveError(null);
  }, []);

  const handleSaveSavedSearch = useCallback(async () => {
    const trimmed = newSavedSearchName.trim();
    if (!trimmed) {
      setSavedSearchSaveError('Name is required.');
      return;
    }
    setSavedSearchSaving(true);
    setSavedSearchSaveError(null);
    try {
      const result = await createSavedSearch({
        name: trimmed,
        queryText: searchInput.trim(),
        filters: {
          verdicts: activeSavedFilters.verdicts,
          confidentiality: activeSavedFilters.confidentiality,
          minSeverityScore: activeSavedFilters.minSeverityScore,
        },
        isDefault: newSavedSearchIsDefault,
      });
      if (result.status === 'name_conflict') {
        setSavedSearchSaveError('A saved search with this name already exists.');
        return;
      }
      if (result.status === 'invalid') {
        const detail =
          result.errors && result.errors.length > 0 ? result.errors.join(', ') : 'invalid';
        setSavedSearchSaveError(`Could not save (${detail}).`);
        return;
      }
      if (result.status !== 'ok') {
        setSavedSearchSaveError(`Could not save (${result.status}).`);
        return;
      }
      const refreshed = await refreshSavedSearches();
      const created =
        result.record ?? (refreshed ? (refreshed.find((r) => r.name === trimmed) ?? null) : null);
      if (created) setActiveSavedSearchId(created.id);
      setSavedSearchSaveFormOpen(false);
      setSavedSearchMenuOpen(false);
    } finally {
      setSavedSearchSaving(false);
    }
  }, [
    newSavedSearchName,
    newSavedSearchIsDefault,
    searchInput,
    activeSavedFilters,
    refreshSavedSearches,
  ]);

  const handleRequestDeleteSavedSearch = useCallback((id: string) => {
    setSavedSearchDeleteConfirmId(id);
  }, []);

  const handleCancelDeleteSavedSearch = useCallback(() => {
    setSavedSearchDeleteConfirmId(null);
  }, []);

  const handleConfirmDeleteSavedSearch = useCallback(
    async (id: string) => {
      const result = await deleteSavedSearch(id);
      if (result.status === 'ok' || result.status === 'not_found') {
        if (activeSavedSearchId === id) setActiveSavedSearchId(null);
        await refreshSavedSearches();
        setSavedSearchDeleteConfirmId(null);
      }
    },
    [activeSavedSearchId, refreshSavedSearches]
  );

  const handleResetImportState = useCallback(() => {
    setImportBundle(null);
    setImportPlan(null);
    setImportErrors([]);
    setImportResult(null);
  }, []);

  const handleExportPresets = useCallback(() => {
    if (presets.length === 0) return;
    const bundle = buildExportBundle({
      presets: presets.map((p) => ({
        name: p.name,
        description: p.description,
        filters: p.filters,
        isDefault: p.isDefault,
      })),
      note: 'Exported from Consultify Watchlist UI',
    });
    const json = bundleToJson(bundle);
    const date = new Date().toISOString().slice(0, 10);
    downloadJsonBlob(`consultify-watchlist-presets-${date}.json`, json);
  }, [presets]);

  const handleImportButtonClick = useCallback(() => {
    handleResetImportState();
    if (fileInputRef.current) {
      // Reset value so re-selecting the same file still triggers `change`.
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  }, [handleResetImportState]);

  const handleImportFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      // User cancelled the file picker — silently no-op per the honest UX rules.
      if (!file) return;

      let text = '';
      try {
        text = await file.text();
      } catch {
        setImportErrors(['Could not read the selected file.']);
        setImportBundle(null);
        setImportPlan(null);
        return;
      }

      const result = parseImportJson(text);
      if (!result.ok || !result.bundle) {
        setImportBundle(null);
        setImportPlan(null);
        setImportErrors(result.errors.length > 0 ? result.errors : ['Invalid bundle.']);
        return;
      }

      const existingNames = presets.map((p) => p.name.trim().toLowerCase());
      const plan = planImport({ bundle: result.bundle, existingNames });
      setImportBundle(result.bundle);
      setImportPlan(plan);
      setImportErrors(result.errors);
      setImportResult(null);
    },
    [presets]
  );

  const handleCancelImport = useCallback(() => {
    handleResetImportState();
  }, [handleResetImportState]);

  const handleConfirmImport = useCallback(async () => {
    if (!importPlan || importPlan.toCreate.length === 0) return;
    setImportBusy(true);
    let created = 0;
    let failed = 0;
    try {
      for (const record of importPlan.toCreate) {
        const res = await createWatchlistPreset({
          name: record.name,
          description: record.description ?? undefined,
          filters: record.filters,
          // Defensive: never let an imported bundle silently flip the
          // active default for the org. The user has to pick a default
          // explicitly via Save current as preset…
          isDefault: false,
        });
        if (res.status === 'ok') {
          created += 1;
        } else {
          failed += 1;
        }
      }
      await refreshPresets();
    } finally {
      setImportBusy(false);
      setImportResult({ created, failed });
      setImportBundle(null);
      setImportPlan(null);
    }
  }, [importPlan, refreshPresets]);

  // Auto-dismiss the success summary after ~5s so the dropdown stays clean.
  useEffect(() => {
    if (!importResult) return;
    if (typeof window === 'undefined') return;
    const id = window.setTimeout(() => setImportResult(null), 5000);
    return () => window.clearTimeout(id);
  }, [importResult]);

  // Deep-link presetId: try once after presets are bootstrapped. We do
  // not retry on prop changes — the user's explicit selection always wins
  // after the first apply.
  useEffect(() => {
    if (presetAppliedRef.current) return;
    if (!presetsBootstrapped) return;
    const desiredPresetId = initialDeepLinkRef.current?.presetId ?? null;
    if (!desiredPresetId) return;
    if (presets.length === 0) return;
    if (applyPreset(desiredPresetId)) {
      presetAppliedRef.current = true;
    }
  }, [presetsBootstrapped, presets, applyPreset]);

  // Deep-link deckId: scroll the matching row into view on first paint
  // after entries arrive, then auto-clear the highlight after 5s so the
  // table doesn't carry a "stuck" focus indicator across refreshes.
  useEffect(() => {
    if (!deepLinkHighlightDeckId) return;
    if (!data || data.entries.length === 0) return;
    if (typeof window === 'undefined') return;
    const node = highlightedRowRef.current;
    if (node && typeof node.scrollIntoView === 'function') {
      try {
        node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch {
        // Some embedded browsers reject the smooth option object — best-effort.
      }
    }
    const timeoutId = window.setTimeout(() => {
      setDeepLinkHighlightDeckId(null);
    }, DEEP_LINK_HIGHLIGHT_MS);
    return () => window.clearTimeout(timeoutId);
  }, [deepLinkHighlightDeckId, data]);

  const autoRefreshPaused = autoRefresh && (status !== 'ok' || !pageVisible);

  const presetsAvailable = presetsStatus === 'ok' || presetsStatus === null;
  const presetsUnavailableMessage =
    presetsStatus === 'forbidden'
      ? 'Presets unavailable (insufficient permission).'
      : presetsStatus === 'unavailable' ||
          presetsStatus === 'not_found' ||
          presetsStatus === 'error'
        ? 'Presets unavailable.'
        : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Governance Watchlist
            </h2>
            {activePreset && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-900/30 dark:text-indigo-300"
                aria-label={
                  isPresetModified
                    ? `Active preset ${activePreset.name} (modified)`
                    : `Active preset ${activePreset.name}`
                }
              >
                <Bookmark size={11} className="shrink-0" />
                <span>
                  Preset: <strong className="font-semibold">{activePreset.name}</strong>
                  {isPresetModified && <span className="ml-1 opacity-70">(modified)</span>}
                </span>
                <button
                  type="button"
                  onClick={handleClearActivePreset}
                  aria-label="Clear active preset"
                  className="rounded p-0.5 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <X size={11} />
                </button>
              </span>
            )}
            {activeSavedSearch && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:border-amber-900/60 dark:bg-amber-900/30 dark:text-amber-300"
                aria-label={
                  isSavedSearchModified
                    ? `Active saved search ${activeSavedSearch.name} (modified)`
                    : `Active saved search ${activeSavedSearch.name}`
                }
              >
                <Search size={11} className="shrink-0" />
                <span>
                  Search: <strong className="font-semibold">{activeSavedSearch.name}</strong>
                  {isSavedSearchModified && <span className="ml-1 opacity-70">(modified)</span>}
                </span>
                <button
                  type="button"
                  onClick={handleClearActiveSavedFilters}
                  aria-label="Clear active saved search"
                  className="rounded p-0.5 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <X size={11} />
                </button>
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Decks currently flagged BLOCKED_P0 or BLOCKED_P1, sorted by severity.
          </p>
          {data && (
            <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-500">
              Generated {new Date(data.generatedAt).toLocaleString()} · {data.entries.length} of{' '}
              {data.totals.decks} deck
              {data.totals.decks === 1 ? '' : 's'} shown
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3" aria-label="Watchlist filters">
          <label className="inline-flex select-none items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={onlyBlocked}
              onChange={(e) => setOnlyBlocked(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900"
            />
            Only blocked
          </label>
          <div className="flex flex-col">
            <label
              htmlFor="presentation-watchlist-limit"
              className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
            >
              Limit
            </label>
            <select
              id="presentation-watchlist-limit"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              {LIMIT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label
              htmlFor="presentation-watchlist-autorefresh"
              className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
            >
              Auto-refresh
            </label>
            <button
              id="presentation-watchlist-autorefresh"
              type="button"
              onClick={handleToggleAutoRefresh}
              aria-pressed={autoRefresh}
              className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[11px] font-medium shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                autoRefresh
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {autoRefresh ? <Pause size={12} /> : <Play size={12} />}
              {autoRefresh ? 'On' : 'Paused'}
            </button>
          </div>
          <div className="flex flex-col" ref={presetMenuRef}>
            <span
              id="presentation-watchlist-presets-label"
              className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
            >
              Presets
            </span>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  if (!presetsAvailable) return;
                  setPresetMenuOpen((v) => !v);
                }}
                aria-expanded={presetMenuOpen}
                aria-haspopup="menu"
                aria-labelledby="presentation-watchlist-presets-label"
                disabled={!presetsAvailable}
                className="inline-flex w-44 items-center justify-between gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                title={presetsUnavailableMessage ?? 'Saved filter presets'}
              >
                <span className="inline-flex items-center gap-1.5 truncate">
                  <Bookmark size={12} />
                  <span className="truncate">{activePreset ? activePreset.name : 'Presets'}</span>
                </span>
                <ChevronDown size={12} className="shrink-0 opacity-70" />
              </button>
              {presetMenuOpen && presetsAvailable && (
                <div
                  role="menu"
                  className="absolute right-0 z-20 mt-1 w-80 rounded-md border border-slate-200 bg-white py-1 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleOpenSaveForm}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Plus size={12} className="text-indigo-500" />
                    Save current as preset…
                  </button>

                  {saveFormOpen && (
                    <div className="border-t border-slate-200 bg-slate-50/60 px-3 py-3 dark:border-slate-800 dark:bg-slate-900/60">
                      <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Name
                      </label>
                      <input
                        type="text"
                        value={newPresetName}
                        maxLength={60}
                        onChange={(e) => {
                          setNewPresetName(e.target.value);
                          if (saveError) setSaveError(null);
                        }}
                        placeholder="e.g. Quarterly review"
                        className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      />
                      <label className="mt-2 block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Description (optional)
                      </label>
                      <textarea
                        value={newPresetDescription}
                        maxLength={280}
                        rows={2}
                        onChange={(e) => setNewPresetDescription(e.target.value)}
                        placeholder="Short note for teammates"
                        className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      />
                      <label className="mt-2 inline-flex select-none items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={newPresetIsDefault}
                          onChange={(e) => setNewPresetIsDefault(e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900"
                        />
                        Save as default
                      </label>
                      {saveError && (
                        <div
                          role="alert"
                          className="mt-2 rounded-md border border-danger-200 bg-danger-50 px-2 py-1 text-[11px] text-danger-700 dark:border-danger-900/60 dark:bg-danger-900/30 dark:text-danger-300"
                        >
                          {saveError}
                        </div>
                      )}
                      <div className="mt-2 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={handleCloseSaveForm}
                          disabled={saving}
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleSavePreset()}
                          disabled={saving}
                          className="inline-flex items-center gap-1 rounded-md border border-indigo-600 bg-indigo-600 px-2 py-1 text-[11px] font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {saving ? <Loader2 size={11} className="animate-spin" /> : null}
                          {saving ? 'Saving…' : 'Save preset'}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="my-1 border-t border-slate-200 dark:border-slate-800" />

                  <div className="flex items-center justify-between px-3 py-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Saved presets
                    </span>
                    {presets.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setManageMode((v) => !v);
                          setDeleteConfirmId(null);
                        }}
                        className="text-[11px] font-medium text-indigo-600 underline-offset-2 hover:underline focus:outline-none dark:text-indigo-300"
                      >
                        {manageMode ? 'Done' : 'Manage presets'}
                      </button>
                    )}
                  </div>

                  {presets.length === 0 ? (
                    <div className="px-3 py-2 text-[11px] text-slate-500 dark:text-slate-400">
                      No presets saved yet.
                    </div>
                  ) : (
                    <ul className="max-h-64 overflow-y-auto py-1">
                      {presets.map((preset) => {
                        const isActive = preset.id === activePresetId;
                        const isConfirmingDelete = deleteConfirmId === preset.id;
                        return (
                          <li
                            key={preset.id}
                            className={`flex items-center gap-2 px-3 py-1.5 text-xs ${
                              isActive
                                ? 'bg-indigo-50 dark:bg-indigo-900/20'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                          >
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => handleSelectPreset(preset)}
                              className="flex min-w-0 flex-1 items-center gap-2 text-left text-slate-700 focus:outline-none dark:text-slate-200"
                            >
                              <span className="min-w-0 truncate">{preset.name}</span>
                              {preset.isDefault && (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                                  <Star size={9} className="shrink-0" />
                                  default
                                </span>
                              )}
                            </button>
                            {manageMode &&
                              (isConfirmingDelete ? (
                                <span className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => void handleConfirmDelete(preset.id)}
                                    className="rounded-md border border-danger-300 bg-danger-50 px-2 py-0.5 text-[10px] font-medium text-danger-700 hover:bg-danger-100 focus:outline-none focus:ring-2 focus:ring-danger-500 dark:border-danger-900/60 dark:bg-danger-900/30 dark:text-danger-300"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleCancelDelete}
                                    className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                                  >
                                    Cancel
                                  </button>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleRequestDelete(preset.id)}
                                  aria-label={`Delete preset ${preset.name}`}
                                  className="rounded p-1 text-slate-500 hover:bg-danger-100 hover:text-danger-600 focus:outline-none focus:ring-2 focus:ring-danger-500 dark:text-slate-400 dark:hover:bg-danger-900/30 dark:hover:text-danger-300"
                                >
                                  <Trash2 size={12} />
                                </button>
                              ))}
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  <div className="my-1 border-t border-slate-200 dark:border-slate-800" />

                  <div className="px-3 py-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Transfer
                    </span>
                  </div>
                  <div className="flex items-center gap-2 px-3 pb-2">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleExportPresets}
                      disabled={presets.length === 0}
                      aria-label="Export presets as JSON"
                      title={
                        presets.length === 0
                          ? 'No presets to export'
                          : 'Download all presets as a JSON bundle'
                      }
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <FileDown size={12} className="text-indigo-500" />
                      Export presets
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleImportButtonClick}
                      aria-label="Import presets from JSON"
                      title="Import presets from a JSON bundle"
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <FileUp size={12} className="text-indigo-500" />
                      Import presets
                    </button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json"
                    onChange={(e) => {
                      void handleImportFileChange(e);
                    }}
                    className="hidden"
                    aria-hidden="true"
                    tabIndex={-1}
                  />

                  {importErrors.length > 0 && !importBundle && (
                    <div
                      role="alert"
                      className="mx-3 mb-2 rounded-md border border-danger-200 bg-danger-50 px-2 py-1.5 text-[11px] text-danger-700 dark:border-danger-900/60 dark:bg-danger-900/30 dark:text-danger-300"
                    >
                      <div className="font-semibold">Could not import bundle</div>
                      <ul className="mt-1 list-disc space-y-0.5 pl-4 opacity-90">
                        {importErrors.slice(0, 3).map((e, i) => (
                          <li key={`${i}-${e}`}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {importBundle && importPlan && (
                    <div className="mx-3 mb-2 rounded-md border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-900/60">
                      <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                        Import preview
                      </div>
                      <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">
                        Will create {importPlan.toCreate.length} · Skip{' '}
                        {importPlan.duplicates.length} duplicate
                        {importPlan.duplicates.length === 1 ? '' : 's'} · Reject{' '}
                        {importPlan.invalid.length} invalid
                      </div>
                      {importPlan.toCreate.length > 0 && (
                        <div className="mt-1.5">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                            Will create
                          </div>
                          <ul className="ml-3 list-disc text-[11px] text-slate-700 dark:text-slate-300">
                            {importPlan.toCreate.slice(0, 5).map((p) => (
                              <li key={`c-${p.name}`} className="truncate">
                                {p.name}
                              </li>
                            ))}
                            {importPlan.toCreate.length > 5 && (
                              <li className="opacity-70">
                                …and {importPlan.toCreate.length - 5} more
                              </li>
                            )}
                          </ul>
                        </div>
                      )}
                      {importPlan.duplicates.length > 0 && (
                        <div className="mt-1.5">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                            Skip (name already exists)
                          </div>
                          <ul className="ml-3 list-disc text-[11px] text-slate-700 dark:text-slate-300">
                            {importPlan.duplicates.slice(0, 5).map((d) => (
                              <li key={`d-${d.name}`} className="truncate">
                                {d.name}
                              </li>
                            ))}
                            {importPlan.duplicates.length > 5 && (
                              <li className="opacity-70">
                                …and {importPlan.duplicates.length - 5} more
                              </li>
                            )}
                          </ul>
                        </div>
                      )}
                      {importPlan.invalid.length > 0 && (
                        <div className="mt-1.5">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-danger-700 dark:text-danger-300">
                            Reject (invalid)
                          </div>
                          <ul className="ml-3 list-disc text-[11px] text-slate-700 dark:text-slate-300">
                            {importPlan.invalid.slice(0, 5).map((iv) => (
                              <li key={`iv-${iv.name}`} className="truncate">
                                {iv.name} <span className="opacity-70">({iv.reason})</span>
                              </li>
                            ))}
                            {importPlan.invalid.length > 5 && (
                              <li className="opacity-70">
                                …and {importPlan.invalid.length - 5} more
                              </li>
                            )}
                          </ul>
                        </div>
                      )}
                      {importErrors.length > 0 && (
                        <div className="mt-1.5 text-[10px] text-amber-700 dark:text-amber-300">
                          {importErrors.length} parse warning
                          {importErrors.length === 1 ? '' : 's'} (some entries were skipped).
                        </div>
                      )}
                      {importPlan.toCreate.length === 0 && (
                        <div
                          role="status"
                          className="mt-1.5 text-[11px] italic text-slate-500 dark:text-slate-400"
                        >
                          Bundle contains no valid presets to import.
                        </div>
                      )}
                      <div className="mt-2 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={handleCancelImport}
                          disabled={importBusy}
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleConfirmImport()}
                          disabled={importBusy || importPlan.toCreate.length === 0}
                          className="inline-flex items-center gap-1 rounded-md border border-emerald-600 bg-emerald-600 px-2 py-1 text-[11px] font-medium text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {importBusy ? <Loader2 size={11} className="animate-spin" /> : null}
                          {importBusy ? 'Importing…' : 'Confirm import'}
                        </button>
                      </div>
                    </div>
                  )}

                  {importResult && (
                    <div
                      role="status"
                      className="mx-3 mb-2 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[11px] text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-900/30 dark:text-emerald-200"
                    >
                      Created {importResult.created} · Failed {importResult.failed}
                    </div>
                  )}
                </div>
              )}
              {!presetsAvailable && presetsUnavailableMessage && (
                <p className="mt-1 text-[10px] text-slate-600 dark:text-slate-500">
                  {presetsUnavailableMessage}
                </p>
              )}
            </div>
          </div>

          {/* Sprint 12: ad-hoc deck-title search input + saved searches dropdown. */}
          <div className="flex flex-col">
            <label
              htmlFor="presentation-watchlist-search"
              className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
            >
              Search
            </label>
            <div className="relative">
              <Search
                size={12}
                className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-500"
                aria-hidden="true"
              />
              <input
                id="presentation-watchlist-search"
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Filter by deck title…"
                maxLength={SAVED_SEARCH_QUERY_MAX}
                aria-label="Filter watchlist by deck title"
                className="w-56 rounded-md border border-slate-200 bg-white py-1.5 pl-7 pr-2 text-xs text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              />
            </div>
          </div>

          <div className="flex flex-col" ref={savedSearchMenuRef}>
            <span
              id="presentation-watchlist-saved-searches-label"
              className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
            >
              Saved searches
            </span>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  if (!savedSearchesAvailable) return;
                  setSavedSearchMenuOpen((v) => !v);
                }}
                aria-expanded={savedSearchMenuOpen}
                aria-haspopup="menu"
                aria-labelledby="presentation-watchlist-saved-searches-label"
                disabled={!savedSearchesAvailable}
                className="inline-flex w-48 items-center justify-between gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                title={savedSearchesUnavailableMessage ?? 'Saved free-text searches'}
              >
                <span className="inline-flex items-center gap-1.5 truncate">
                  <Search size={12} />
                  <span className="truncate">
                    {activeSavedSearch ? activeSavedSearch.name : 'Saved searches'}
                  </span>
                </span>
                <ChevronDown size={12} className="shrink-0 opacity-70" />
              </button>
              {savedSearchMenuOpen && savedSearchesAvailable && (
                <div
                  role="menu"
                  className="absolute right-0 z-20 mt-1 w-80 rounded-md border border-slate-200 bg-white py-1 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleOpenSaveSearchForm}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Plus size={12} className="text-amber-500" />
                    Save current as…
                  </button>

                  {savedSearchSaveFormOpen && (
                    <div className="border-t border-slate-200 bg-slate-50/60 px-3 py-3 dark:border-slate-800 dark:bg-slate-900/60">
                      <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Name
                      </label>
                      <input
                        type="text"
                        value={newSavedSearchName}
                        maxLength={SAVED_SEARCH_NAME_MAX}
                        onChange={(e) => {
                          setNewSavedSearchName(e.target.value);
                          if (savedSearchSaveError) setSavedSearchSaveError(null);
                        }}
                        placeholder="e.g. Phoenix risk review"
                        className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      />
                      <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                        Saves the current title query and active filter selections.
                      </p>
                      <label className="mt-2 inline-flex select-none items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={newSavedSearchIsDefault}
                          onChange={(e) => setNewSavedSearchIsDefault(e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-900"
                        />
                        Save as default
                      </label>
                      {savedSearchSaveError && (
                        <div
                          role="alert"
                          className="mt-2 rounded-md border border-danger-200 bg-danger-50 px-2 py-1 text-[11px] text-danger-700 dark:border-danger-900/60 dark:bg-danger-900/30 dark:text-danger-300"
                        >
                          {savedSearchSaveError}
                        </div>
                      )}
                      <div className="mt-2 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={handleCloseSaveSearchForm}
                          disabled={savedSearchSaving}
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleSaveSavedSearch()}
                          disabled={savedSearchSaving}
                          className="inline-flex items-center gap-1 rounded-md border border-amber-600 bg-amber-600 px-2 py-1 text-[11px] font-medium text-white shadow-sm hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {savedSearchSaving ? (
                            <Loader2 size={11} className="animate-spin" />
                          ) : null}
                          {savedSearchSaving ? 'Saving…' : 'Save search'}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="my-1 border-t border-slate-200 dark:border-slate-800" />

                  <div className="flex items-center justify-between px-3 py-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Saved searches
                    </span>
                    {savedSearches.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setSavedSearchManageMode((v) => !v);
                          setSavedSearchDeleteConfirmId(null);
                        }}
                        className="text-[11px] font-medium text-amber-600 underline-offset-2 hover:underline focus:outline-none dark:text-amber-300"
                      >
                        {savedSearchManageMode ? 'Done' : 'Manage'}
                      </button>
                    )}
                  </div>

                  {savedSearches.length === 0 ? (
                    <div className="px-3 py-2 text-[11px] text-slate-500 dark:text-slate-400">
                      No saved searches yet.
                    </div>
                  ) : (
                    <ul className="max-h-64 overflow-y-auto py-1">
                      {savedSearches.map((record) => {
                        const isActive = record.id === activeSavedSearchId;
                        const isConfirmingDelete = savedSearchDeleteConfirmId === record.id;
                        return (
                          <li
                            key={record.id}
                            className={`flex items-center gap-2 px-3 py-1.5 text-xs ${
                              isActive
                                ? 'bg-amber-50 dark:bg-amber-900/20'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                          >
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => applySavedSearch(record)}
                              className="flex min-w-0 flex-1 items-center gap-2 text-left text-slate-700 focus:outline-none dark:text-slate-200"
                              title={
                                record.queryText
                                  ? `Query: "${record.queryText}"`
                                  : 'Filter-only saved search'
                              }
                            >
                              <span className="min-w-0 truncate">{record.name}</span>
                              {record.isDefault && (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                                  <Star size={9} className="shrink-0" />
                                  default
                                </span>
                              )}
                            </button>
                            {savedSearchManageMode &&
                              (isConfirmingDelete ? (
                                <span className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => void handleConfirmDeleteSavedSearch(record.id)}
                                    className="rounded-md border border-danger-300 bg-danger-50 px-2 py-0.5 text-[10px] font-medium text-danger-700 hover:bg-danger-100 focus:outline-none focus:ring-2 focus:ring-danger-500 dark:border-danger-900/60 dark:bg-danger-900/30 dark:text-danger-300"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleCancelDeleteSavedSearch}
                                    className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                                  >
                                    Cancel
                                  </button>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleRequestDeleteSavedSearch(record.id)}
                                  aria-label={`Delete saved search ${record.name}`}
                                  className="rounded p-1 text-slate-500 hover:bg-danger-100 hover:text-danger-600 focus:outline-none focus:ring-2 focus:ring-danger-500 dark:text-slate-400 dark:hover:bg-danger-900/30 dark:hover:text-danger-300"
                                >
                                  <Trash2 size={12} />
                                </button>
                              ))}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
              {!savedSearchesAvailable && savedSearchesUnavailableMessage && (
                <p className="mt-1 text-[10px] text-slate-600 dark:text-slate-500">
                  {savedSearchesUnavailableMessage}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={!data || data.entries.length === 0}
            aria-label="Export current watchlist as CSV"
            title={
              !data || data.entries.length === 0
                ? 'No entries to export'
                : 'Export current watchlist to CSV'
            }
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Download size={12} />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => void handleLoad()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md border border-indigo-600 bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCcw size={12} />}
            {loading ? 'Loading…' : 'Reload'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
        {autoRefresh ? (
          <span>
            Auto · refreshing every {Math.round(AUTO_REFRESH_INTERVAL_MS / 1000)}s
            {autoRefreshPaused && status !== 'ok' && hasAttempted
              ? ' · paused (backend issue)'
              : ''}
            {autoRefreshPaused && !pageVisible ? ' · paused (tab hidden)' : ''}
          </span>
        ) : (
          <span>Auto-refresh paused</span>
        )}
        <span>·</span>
        <span>Last refreshed: {formatClockTime(lastRefreshAt)}</span>
      </div>

      {transitionAlerts.length > 0 && (
        <TransitionAlertsRegion
          alerts={transitionAlerts}
          onDismiss={handleDismissAlert}
          onDismissAll={handleDismissAllAlerts}
        />
      )}

      {renderBody({
        loading,
        hasAttempted,
        reasonBanner,
        data,
        entries: filteredEntries,
        totalEntries: data?.entries.length ?? 0,
        onlyBlocked,
        warnings: data?.warnings,
        onAction: handleAction,
        canJumpToDeck: typeof onJumpToDeck === 'function',
        highlightDeckId: deepLinkHighlightDeckId,
        highlightedRowRef,
        highlightQuery: debouncedQuery,
        hasActiveTextOrFilters:
          debouncedQuery.length > 0 ||
          activeSavedFilters.verdicts.length > 0 ||
          activeSavedFilters.confidentiality.length > 0 ||
          activeSavedFilters.minSeverityScore > 0,
      })}
    </div>
  );
};

interface TransitionAlertsRegionProps {
  alerts: KeyedTransition[];
  onDismiss: (alertKey: string) => void;
  onDismissAll: () => void;
}

const TransitionAlertsRegion: React.FC<TransitionAlertsRegionProps> = ({
  alerts,
  onDismiss,
  onDismissAll,
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="New blocked deck alerts"
      className="space-y-2"
    >
      {alerts.map((alert) => {
        const tone =
          alert.toVerdict === 'BLOCKED_P0'
            ? 'border-danger-300 bg-danger-50 text-danger-800 dark:border-danger-900/60 dark:bg-danger-900/30 dark:text-danger-200'
            : 'border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-900/60 dark:bg-orange-900/30 dark:text-orange-200';
        const fromLabel = alert.fromVerdict ?? 'new';
        return (
          <div
            key={alert.alertKey}
            className={`flex items-start gap-3 rounded-lg border p-3 text-sm shadow-sm ${tone}`}
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold">
                {alert.title || alert.deckId} escalated to {alert.toVerdict}
              </div>
              <div className="mt-0.5 text-[11px] opacity-80">
                <span className="font-mono">{alert.deckId}</span> · from {fromLabel}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(alert.alertKey)}
              aria-label="Dismiss alert"
              className="shrink-0 rounded p-1 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
      {alerts.length >= 2 && (
        <div className="text-right">
          <button
            type="button"
            onClick={onDismissAll}
            className="text-[11px] font-medium text-slate-600 underline-offset-2 hover:underline focus:outline-none dark:text-slate-300"
          >
            Dismiss all
          </button>
        </div>
      )}
    </div>
  );
};

interface BodyProps {
  loading: boolean;
  hasAttempted: boolean;
  reasonBanner: string | null;
  data: WatchlistResponse | null;
  entries: WatchlistEntry[];
  totalEntries: number;
  onlyBlocked: boolean;
  warnings?: string[];
  onAction: (entry: WatchlistEntry) => void;
  canJumpToDeck: boolean;
  highlightDeckId: string | null;
  highlightedRowRef: React.MutableRefObject<HTMLTableRowElement | null>;
  highlightQuery: string;
  hasActiveTextOrFilters: boolean;
}

function renderBody(props: BodyProps): React.ReactElement {
  const {
    loading,
    hasAttempted,
    reasonBanner,
    data,
    entries,
    totalEntries,
    onlyBlocked,
    warnings,
    onAction,
    canJumpToDeck,
    highlightDeckId,
    highlightedRowRef,
    highlightQuery,
    hasActiveTextOrFilters,
  } = props;

  if (loading && !data) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <Loader2 size={16} className="animate-spin text-indigo-500" />
        Loading watchlist…
      </div>
    );
  }

  if (reasonBanner) {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
      >
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <div>
          <div className="font-semibold">Governance watchlist unavailable</div>
          <div className="mt-1 text-xs opacity-80">{reasonBanner}</div>
        </div>
      </div>
    );
  }

  if (!hasAttempted || !data) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
        Waiting for governance data…
      </div>
    );
  }

  const totals = data.totals;
  const isEmpty = entries.length === 0;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300">
          <span>
            Total decks:{' '}
            <strong className="text-slate-900 dark:text-slate-100">
              {formatNumber(totals.decks)}
            </strong>
          </span>
          <span>·</span>
          <span>
            BLOCKED_P0:{' '}
            <strong className="text-danger-700 dark:text-danger-300">
              {formatNumber(totals.blockedP0)}
            </strong>
          </span>
          <span>·</span>
          <span>
            BLOCKED_P1:{' '}
            <strong className="text-orange-700 dark:text-orange-300">
              {formatNumber(totals.blockedP1)}
            </strong>
          </span>
          <span>·</span>
          <span>
            PASS_WITH_P2:{' '}
            <strong className="text-amber-700 dark:text-amber-300">
              {formatNumber(totals.passWithP2)}
            </strong>
          </span>
          <span>·</span>
          <span>
            PASS:{' '}
            <strong className="text-emerald-700 dark:text-emerald-300">
              {formatNumber(totals.pass)}
            </strong>
          </span>
          <span>·</span>
          <span>
            INCONCLUSIVE:{' '}
            <strong className="text-slate-700 dark:text-slate-200">
              {formatNumber(totals.inconclusive)}
            </strong>
          </span>
        </div>
      </div>

      {warnings && warnings.length > 0 && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
        >
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">Some decks could not be evaluated</div>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 opacity-80">
              {warnings.slice(0, 5).map((w) => (
                <li key={w}>{w}</li>
              ))}
              {warnings.length > 5 && <li>… and {warnings.length - 5} more</li>}
            </ul>
          </div>
        </div>
      )}

      {isEmpty ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          {hasActiveTextOrFilters
            ? `No decks match the active search (${totalEntries} loaded).`
            : onlyBlocked
              ? 'No blocked decks 🎉'
              : 'No decks match the current filters.'}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <ShieldAlert size={14} className="text-slate-500 dark:text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Watchlist entries
              </h3>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {hasActiveTextOrFilters && entries.length !== totalEntries
                ? `${entries.length} of ${totalEntries} entr${totalEntries === 1 ? 'y' : 'ies'}`
                : `${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}`}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table
              /* §27-exempt: lista encji z deep-link highlight wymagajacym refa do <tr> (highlightedRowRef + scrollIntoView + aria-current + mark-segmenty w tytule) — StandardTable nie eksponuje row refs; migracja 1:1 zlamie skok wyszukiwarki; wymaga rozszerzenia fasady, pelna przebudowa — deferred m27-canon-rest 07-15 */ className="min-w-full divide-y divide-slate-200 text-xs dark:divide-slate-800"
            >
              <thead className="bg-slate-50 dark:bg-slate-900/60">
                <tr>
                  <th
                    scope="col"
                    className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                  >
                    Deck
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                  >
                    Verdict
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                  >
                    P0 / P1 / P2
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                  >
                    Exports blocked
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                  >
                    Confidentiality
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                  >
                    Updated
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                  >
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {entries.map((entry) => {
                  const tone = VERDICT_TONE[entry.overallVerdict] || VERDICT_TONE.INCONCLUSIVE;
                  const isHighlighted = highlightDeckId === entry.deckId;
                  const titleSegments =
                    highlightQuery.length > 0
                      ? buildHighlightSegments(entry.title || '', highlightQuery)
                      : null;
                  return (
                    <tr
                      key={entry.deckId}
                      data-deck-id={entry.deckId}
                      ref={isHighlighted ? highlightedRowRef : undefined}
                      aria-current={isHighlighted ? 'true' : undefined}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                        isHighlighted
                          ? 'bg-indigo-50 ring-2 ring-inset ring-indigo-400 dark:bg-indigo-900/20 dark:ring-indigo-500/60'
                          : ''
                      }`}
                    >
                      <td className="px-4 py-2 text-slate-800 dark:text-slate-200">
                        <div className="font-medium">
                          {titleSegments
                            ? titleSegments.map((segment, idx) =>
                                segment.matched ? (
                                  <mark
                                    key={`${entry.deckId}-mark-${idx}`}
                                    className="rounded-sm bg-yellow-200/70 px-0.5 text-slate-900 dark:bg-yellow-500/30 dark:text-slate-100"
                                  >
                                    {segment.text}
                                  </mark>
                                ) : (
                                  <span key={`${entry.deckId}-text-${idx}`}>{segment.text}</span>
                                )
                              )
                            : entry.title}
                        </div>
                        <div className="font-mono text-[10px] text-slate-500 dark:text-slate-500">
                          {entry.deckId}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${tone}`}
                        >
                          {entry.overallVerdict}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">
                        {formatNumber(entry.p0)} / {formatNumber(entry.p1)} /{' '}
                        {formatNumber(entry.p2)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">
                        {formatNumber(entry.exportsBlocked)}
                      </td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-400">
                        {entry.confidentialityLevel}
                      </td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-400">
                        {entry.updatedAt ? (
                          <span title={new Date(entry.updatedAt).toLocaleString()}>
                            {formatRelativeTime(entry.updatedAt)}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => onAction(entry)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          {canJumpToDeck ? (
                            <>Open telemetry</>
                          ) : (
                            <>
                              <Copy size={11} /> Copy deck ID
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-[11px] text-slate-500 dark:text-slate-500">
        Read-only view. Aggregated from per-deck governance cards. Raw deck content and individual
        quality gates are not exposed here.
      </p>
    </div>
  );
}

export default PresentationGovernanceWatchlistView;
