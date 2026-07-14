/**
 * useTablePersistence — domain hook for table hydration and save.
 *
 * Owns: hydrate from API, save to API, loading/saving flags.
 * Delegates column/view/node state to the caller via callbacks.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import {
  formatIdeaMapSyncLabel,
  resolveIdeaMapHydration,
  useIdeaMapSync,
} from '@/components/MyWork/canvas/useIdeaMapSync';
import { Api } from '@/services/api';
import { getNodeArtifactLinks, withNormalizedArtifactLinks } from '@/utils/artifactLinks';

import type { FormatRule } from './ConditionalFormatting';
import type {
  ColumnDef,
  FilterGroup,
  SavedView,
  SortConfig,
  TableEdge,
  TableNode,
} from './tableTypes';
import type { ViewLayout } from './useTableViews';

type CanvasToolType = 'mindmap' | 'whiteboard' | 'process_flow' | 'table';

export interface UseTablePersistenceOpts {
  open: boolean;
  ideaId: string;
  /** Still needed as a boolean: threaded into the shared (canvas-module)
   *  `formatIdeaMapSyncLabel` helper, which predates i18next `t()` adoption
   *  and is out of this hook's scope to refactor. */
  isPl: boolean;
  t: (key: string, fallback?: string) => string;
  locked: boolean;
  refreshToken?: number;
  language: string;
  onSaved?: () => void;

  // State accessors from the orchestrator
  nodes: TableNode[];
  edges: TableEdge[];
  extensions: Record<string, unknown>;
  columns: ColumnDef[];
  savedViews: SavedView[];
  activeViewId: string;
  sort: SortConfig | null;
  filters: FilterGroup;
  groupBy: string | null;
  formatRules: FormatRule[];
  viewLayout: ViewLayout;

  // State setters for hydration
  setNodes: (nodes: TableNode[]) => void;
  setEdges: React.Dispatch<React.SetStateAction<TableEdge[]>>;
  setExtensions: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  mergePersistedColumns: (saved: ColumnDef[]) => void;
  setSavedViews: React.Dispatch<React.SetStateAction<SavedView[]>>;
  setActiveViewId: React.Dispatch<React.SetStateAction<string>>;
  setFormatRules: React.Dispatch<React.SetStateAction<FormatRule[]>>;
  setViewLayout: React.Dispatch<React.SetStateAction<ViewLayout>>;
}

export interface UseTablePersistenceReturn {
  loading: boolean;
  saving: boolean;
  syncState: string;
  saveStatusLabel: string;
  loadError: string | null;
  handleSave: () => Promise<void>;
  refresh: () => Promise<void>;
}

const VALID_NODE_TYPES = ['center', 'branch', 'idea', 'knowledgeCard', 'noteCard', 'evidenceCard'];

export function useTablePersistence(opts: UseTablePersistenceOpts): UseTablePersistenceReturn {
  const {
    open,
    ideaId,
    isPl,
    t,
    locked,
    refreshToken,
    language,
    onSaved,
    nodes,
    edges,
    extensions,
    columns,
    savedViews,
    activeViewId,
    sort,
    filters,
    groupBy,
    formatRules,
    viewLayout,
    setNodes,
    setEdges,
    setExtensions,
    mergePersistedColumns,
    setSavedViews,
    setActiveViewId,
    setFormatRules,
    setViewLayout,
  } = opts;

  const [loading, setLoading] = useState(open);
  const [loadError, setLoadError] = useState<string | null>(null);
  const hydratedOnceRef = useRef(false);
  const didPersistPreferredRef = useRef(false);
  const { saving, syncState, lastSavedAt, queueSync, flushNow, primeServerVersion } =
    useIdeaMapSync({
      ideaId,
      tool: 'table',
      open,
      locked,
    });

  const buildPayload = useCallback(
    () => ({
      nodes: nodes as any,
      edges: edges as any,
      preferredTool: 'table' as CanvasToolType,
      extensions: {
        ...extensions,
        table: {
          columns: columns.map((c) => ({
            key: c.key,
            header: c.header,
            type: c.type,
            visible: c.visible,
            width: c.width,
            options: c.options,
            optionColors: c.optionColors,
            formula: c.formula,
            aiPrompt: c.aiPrompt,
            aggregation: c.aggregation,
          })),
          views: savedViews,
          activeViewId,
          viewState: { sort, filters, groupBy },
          formatting: formatRules,
          viewLayout,
        },
      },
    }),
    [
      activeViewId,
      columns,
      edges,
      extensions,
      filters,
      formatRules,
      groupBy,
      nodes,
      savedViews,
      sort,
      viewLayout,
    ]
  );

  const hydrate = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await Api.getMyIdeaMap(ideaId, { language });
      const hydration = resolveIdeaMapHydration(ideaId, res?.map || {});
      const map = hydration.map || {};
      primeServerVersion(Number(map?.version || 1));
      const nextNodes = Array.isArray(map.nodes) ? (map.nodes as any[]) : [];
      const nextEdges = Array.isArray(map.edges) ? (map.edges as any[]) : [];
      const nextExtensions =
        map?.extensions && typeof map.extensions === 'object' && !Array.isArray(map.extensions)
          ? (map.extensions as Record<string, unknown>)
          : {};

      const parsedNodes: TableNode[] = nextNodes
        .map((n: any) => {
          const normalizedNode = withNormalizedArtifactLinks(n);
          const rawType = n?.type ? String(n.type) : '';
          const inferredType = VALID_NODE_TYPES.includes(rawType)
            ? rawType
            : n?.id === 'root'
              ? 'center'
              : String(n?.id || '').startsWith('branch-')
                ? 'branch'
                : 'idea';
          const rawData =
            normalizedNode?.data && typeof normalizedNode.data === 'object'
              ? normalizedNode.data
              : {};
          const label = rawData.label || rawData.text || rawData.title || '';
          return {
            id: String(normalizedNode?.id || ''),
            type: inferredType,
            data: {
              ...rawData,
              label,
              ...(getNodeArtifactLinks(normalizedNode).length > 0
                ? { artifactLinks: getNodeArtifactLinks(normalizedNode) }
                : {}),
            },
            position: normalizedNode?.position || undefined,
          };
        })
        .filter((n: TableNode) => n.id);

      const parsedEdges: TableEdge[] = nextEdges
        .map((e: any) => ({
          id: String(e?.id || ''),
          source: String(e?.source || ''),
          target: String(e?.target || ''),
          type: e?.type ? String(e.type) : undefined,
          data: e?.data && typeof e.data === 'object' ? e.data : {},
        }))
        .filter((e: TableEdge) => e.id && e.source && e.target);

      setNodes(parsedNodes);
      setEdges(parsedEdges);
      setExtensions(nextExtensions);

      const tblExt = (nextExtensions?.table || {}) as Record<string, unknown>;
      if (Array.isArray(tblExt?.views)) setSavedViews(tblExt.views as SavedView[]);
      if (tblExt?.activeViewId) setActiveViewId(String(tblExt.activeViewId));
      if (Array.isArray(tblExt?.formatting)) setFormatRules(tblExt.formatting as FormatRule[]);
      if (
        tblExt?.viewLayout &&
        ['table', 'kanban', 'timeline', 'calendar', 'matrix', 'grid', 'sticky'].includes(
          String(tblExt.viewLayout)
        )
      ) {
        setViewLayout(tblExt.viewLayout as ViewLayout);
      }
      if (Array.isArray(tblExt?.columns)) {
        mergePersistedColumns(tblExt.columns as ColumnDef[]);
      }

      if (!didPersistPreferredRef.current) {
        didPersistPreferredRef.current = true;
        const preferred = map?.preferredTool ? String(map.preferredTool) : null;
        if (preferred !== 'table') {
          Api.syncMyIdeaMap(ideaId, {
            nodes: nextNodes as any,
            edges: nextEdges as any,
            baseVersion: Number(map?.version || 1),
            preferredTool: 'table',
            extensions: nextExtensions,
          }).catch(() => undefined);
        }
      }
    } catch (err: any) {
      const nextError = err?.message || t('ideas.table.failedToLoadMap', 'Failed to load map');
      toast.error(nextError);
      setLoadError(nextError);
      setNodes([]);
      setEdges([]);
      setExtensions({});
    } finally {
      hydratedOnceRef.current = true;
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, ideaId, t, open]);

  useEffect(() => {
    if (!open) {
      hydratedOnceRef.current = false;
      return;
    }
    didPersistPreferredRef.current = false;
    hydrate();
  }, [hydrate, open, refreshToken]);

  const handleSave = useCallback(async () => {
    if (locked) return;
    try {
      await flushNow(buildPayload(), {
        reason: 'manual',
        createSnapshot: true,
        snapshotLabel: t('ideas.table.tableCheckpoint', 'Table checkpoint'),
      });
      toast.success(t('ideas.table.savedToast', 'Saved'), { duration: 900 });
      onSaved?.();
    } catch (err: any) {
      toast.error(err?.message || t('ideas.table.failedToSave', 'Failed to save'));
    }
  }, [buildPayload, flushNow, t, locked, onSaved]);

  useEffect(() => {
    if (!open || locked || loading || !hydratedOnceRef.current) return;
    queueSync(buildPayload(), { reason: 'draft' });
  }, [buildPayload, loading, locked, open, queueSync]);

  return {
    loading,
    saving,
    syncState,
    saveStatusLabel: formatIdeaMapSyncLabel(syncState, lastSavedAt, isPl),
    loadError,
    handleSave,
    refresh: hydrate,
  };
}
