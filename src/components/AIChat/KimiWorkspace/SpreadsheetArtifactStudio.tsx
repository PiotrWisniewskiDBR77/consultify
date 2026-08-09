import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  Files,
  History,
  Link2,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  SearchCheck,
  ShieldCheck,
  Search,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ArtifactBottomBar, ArtifactMenu3 } from '@/components/shared/ArtifactStudio';
import {
  CanvasContextMenu,
  type CanvasContextMenuItemDescriptor,
} from '@/components/shared/CanvasContextMenu';
import { ExecutiveModuleShell } from '@/components/shared/ExecutiveModuleShell';
import type { TopBarChipDescriptor } from '@/components/shared/ExecutiveModuleShell/ChipDescriptor';
import { useOpenChatWithContext } from '@/hooks/useOpenChatWithContext';
import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';

import {
  EditableSpreadsheetGrid,
  type EditableSpreadsheetGridHandle,
  type SpreadsheetCellSelection,
} from './EditableSpreadsheetGrid';
import type { ArtifactPreview } from './KimiWorkspaceShell';
import { createSpreadsheetArtifactCommandRegistry } from './spreadsheetArtifactCommands';
import { buildSpreadsheetReplacements, findSpreadsheetMatches } from './spreadsheetFindReplace';
import { useWorkbookStudioController } from './useWorkbookStudioController';
import { recalcWorkbook, type FormulaSheet } from '@/utils/workbookFormulaEngine';

interface SpreadsheetArtifactStudioProps {
  preview: ArtifactPreview;
  workbookId: string;
  onDownload: () => void;
  onCopyLink: () => void;
}

interface StudioSheet extends FormulaSheet {
  id?: string;
  hidden?: boolean;
  name?: string;
}

interface SheetSnapshot {
  sheets: StudioSheet[];
  activeSheet: number;
}

interface ReviewUser {
  id: string;
  name?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
}

const reviewUserName = (user: ReviewUser): string =>
  user.name ||
  [user.first_name, user.last_name].filter(Boolean).join(' ') ||
  user.email ||
  'Użytkownik';

const cloneSheets = (sheets: StudioSheet[]): StudioSheet[] => structuredClone(sheets);

const nextSheetName = (sheets: StudioSheet[]): string => {
  const used = new Set(sheets.map((sheet) => sheet.name));
  let index = sheets.length + 1;
  while (used.has(`Arkusz ${index}`)) index += 1;
  return `Arkusz ${index}`;
};

const createClientSheet = (id: string, name: string): StudioSheet => ({
  id,
  name,
  columns: Array.from({ length: 12 }, (_, index) => ({
    key: `col_${index + 1}`,
    header: '',
  })),
  rows: Array.from({ length: 30 }, () => ({ cells: {} })),
});

const formatSelectionStat = (value: number): string =>
  value.toLocaleString('pl-PL', { maximumFractionDigits: 2 });

const sourceLabel = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of ['title', 'name', 'label', 'ref', 'url', 'id']) {
      if (typeof record[key] === 'string' && record[key]) return record[key] as string;
    }
  }
  try {
    return JSON.stringify(value);
  } catch {
    return 'Nieznane źródło';
  }
};

const sourceAnchor = (value: unknown): { sheet?: string; cell?: string } | null => {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const sheet = ['sheet', 'sheetName', 'sheet_name'].find(
    (key) => typeof record[key] === 'string' && record[key]
  );
  const cell = ['cell', 'address', 'range', 'rangeRef', 'range_ref'].find(
    (key) => typeof record[key] === 'string' && record[key]
  );
  if (!sheet && !cell) return null;
  return {
    sheet: sheet ? (record[sheet] as string) : undefined,
    cell: cell ? (record[cell] as string) : undefined,
  };
};

const parseA1Cell = (address: string): { rowIndex: number; colIndex: number } | null => {
  const match = /^([A-Z]+)(\d+)$/i.exec(address.trim());
  if (!match) return null;
  let colIndex = 0;
  for (const char of match[1].toUpperCase()) colIndex = colIndex * 26 + char.charCodeAt(0) - 64;
  return { rowIndex: Number(match[2]) - 1, colIndex: colIndex - 1 };
};

/**
 * Flagged adapter for an already-open workbook. It intentionally exposes only
 * capabilities backed by the current runtime: sheet switching, cell/formula
 * editing, persistence, export and the global Teresa handoff. Planned Office
 * commands stay absent until the batch-command foundation exists.
 */
export const SpreadsheetArtifactStudio: React.FC<SpreadsheetArtifactStudioProps> = ({
  preview,
  workbookId,
  onDownload,
  onCopyLink,
}) => {
  const navigate = useNavigate();
  const openChatWithContext = useOpenChatWithContext();
  const currentUser = useAppStore((state) => state.currentUser);
  const gridRef = useRef<EditableSpreadsheetGridHandle>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [workbookTitle, setWorkbookTitle] = useState(preview.title);
  const [classification, setClassification] = useState(
    preview.workbookClassification ?? 'internal'
  );
  const [lifecycleStatus, setLifecycleStatus] = useState(preview.workbookLifecycle ?? 'draft');
  const [governanceDialog, setGovernanceDialog] = useState<
    'classification' | 'lifecycleStatus' | null
  >(null);
  const [governanceReason, setGovernanceReason] = useState('');
  const [governanceState, setGovernanceState] = useState<'idle' | 'saving' | 'error'>('idle');
  const [approvalState, setApprovalState] = useState<Awaited<
    ReturnType<typeof Api.getWorkbookApprovalState>
  > | null>(null);
  const [reviewUsers, setReviewUsers] = useState<ReviewUser[]>([]);
  const [reviewerSearch, setReviewerSearch] = useState('');
  const [selectedReviewerId, setSelectedReviewerId] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [sheets, setSheets] = useState<StudioSheet[]>(() => cloneSheets(preview.rawSheets ?? []));
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });
  const [freezePanes, setFreezePanes] = useState(false);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [searchMode, setSearchMode] = useState<'find' | 'replace' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [replacementText, setReplacementText] = useState('');
  const [searchScope, setSearchScope] = useState<'sheet' | 'workbook'>('sheet');
  const [matchCase, setMatchCase] = useState(false);
  const [wholeCell, setWholeCell] = useState(false);
  const [searchIndex, setSearchIndex] = useState(0);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [leftMode, setLeftMode] = useState<'sheets' | 'sources' | 'qa' | 'comments' | 'versions'>(
    'sheets'
  );
  const [comments, setComments] = useState<
    Awaited<ReturnType<typeof Api.listWorkbookComments>>['comments']
  >([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentState, setCommentState] = useState<'idle' | 'loading' | 'saving' | 'error'>('idle');
  const [sourceBindings, setSourceBindings] = useState<
    Awaited<ReturnType<typeof Api.listWorkbookSourceBindings>>['bindings']
  >([]);
  const [sourceLabelDraft, setSourceLabelDraft] = useState('');
  const [sourceRefDraft, setSourceRefDraft] = useState('');
  const [sourceState, setSourceState] = useState<'idle' | 'loading' | 'saving' | 'error'>('idle');
  const [revisions, setRevisions] = useState<
    Awaited<ReturnType<typeof Api.listWorkbookRevisions>>['revisions']
  >([]);
  const [revisionState, setRevisionState] = useState<'idle' | 'loading' | 'restoring' | 'error'>(
    'idle'
  );
  const [openSheetMenuId, setOpenSheetMenuId] = useState<string | null>(null);
  const [renamingSheetId, setRenamingSheetId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    selection: SpreadsheetCellSelection;
  } | null>(null);

  useEffect(() => {
    if (!renamingSheetId) return;
    renameInputRef.current?.focus();
    renameInputRef.current?.select();
  }, [renamingSheetId]);

  useEffect(() => {
    if (!searchMode) return;
    searchInputRef.current?.focus();
  }, [searchMode]);
  const [sheetCommandError, setSheetCommandError] = useState<string | null>(null);
  const sheetUndoRef = useRef<SheetSnapshot[]>([]);
  const sheetRedoRef = useRef<SheetSnapshot[]>([]);
  const pendingSheetSelectionRef = useRef<number | null>(null);
  const pendingFindSelectionRef = useRef<{
    sheetIndex: number;
    rowIndex: number;
    colIndex: number;
  } | null>(null);

  useEffect(() => {
    if (!openSheetMenuId) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('[data-sheet-menu-root]')) return;
      setOpenSheetMenuId(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenSheetMenuId(null);
    };
    document.addEventListener('pointerdown', closeOnPointerDown);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnPointerDown);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [openSheetMenuId]);

  const sheetNames = sheets.length ? sheets.map((sheet) => sheet.name || 'Arkusz') : ['Arkusz'];

  const sourceItems = useMemo(() => {
    const refs = Array.isArray(preview.evidenceRefs) ? preview.evidenceRefs : [];
    const pack = preview.sourcePack;
    const packItems =
      pack && typeof pack === 'object'
        ? Object.entries(pack as Record<string, unknown>).flatMap(([key, value]) => {
            if (Array.isArray(value)) return value.map((item) => ({ key, item }));
            return value == null ? [] : [{ key, item: value }];
          })
        : [];
    return [
      ...refs.map((item, index) => ({ id: `evidence-${index}`, group: 'Dowód', item })),
      ...packItems.map(({ key, item }, index) => ({ id: `source-${index}`, group: key, item })),
      ...sourceBindings.map((binding) => ({
        id: `binding-${binding.id}`,
        group: 'Powiązanie zakresu',
        item: binding,
        bindingId: binding.id,
      })),
    ];
  }, [preview.evidenceRefs, preview.sourcePack, sourceBindings]);

  const qaIssues = useMemo(
    () => (Array.isArray(preview.qualityReport?.issues) ? preview.qualityReport.issues : []),
    [preview.qualityReport]
  );

  const controller = useWorkbookStudioController({
    sheetCount: sheetNames.length,
    workbookId,
    initialVersion: preview.workbookVersion ?? 0,
  });
  const {
    activeSheetIndex: activeSheet,
    selection,
    saveState,
    version,
    commandContext,
    selectSheet,
    setSelection,
    setSaveState,
    applyCommands,
    canUndoCommand,
    canRedoCommand,
    undoCommand,
    redoCommand,
    adoptVersion,
    persistCell,
  } = controller;

  useEffect(() => setWorkbookTitle(preview.title), [preview.title]);
  useEffect(
    () => setClassification(preview.workbookClassification ?? 'internal'),
    [preview.workbookClassification]
  );
  useEffect(
    () => setLifecycleStatus(preview.workbookLifecycle ?? 'draft'),
    [preview.workbookLifecycle]
  );

  const updateGovernance = useCallback(
    async (
      field: 'classification' | 'lifecycleStatus',
      value: 'public' | 'internal' | 'confidential' | 'draft' | 'in_review' | 'approved' | 'final'
    ): Promise<void> => {
      setGovernanceState('saving');
      try {
        const result = await Api.updateWorkbookGovernance(workbookId, {
          field,
          value,
          baseVersion: version,
          reason: governanceReason.trim() || undefined,
        });
        setClassification(result.classification);
        setLifecycleStatus(result.lifecycleStatus);
        adoptVersion(result.version);
        setGovernanceState('idle');
        setGovernanceReason('');
        setGovernanceDialog(null);
      } catch {
        setGovernanceState('error');
      }
    },
    [adoptVersion, governanceReason, version, workbookId]
  );

  const loadApprovalWorkflow = useCallback(async (): Promise<void> => {
    try {
      const [approval, usersResponse] = await Promise.all([
        Api.getWorkbookApprovalState(workbookId),
        Api.get('/users').catch(() => []),
      ]);
      const users = Array.isArray(usersResponse)
        ? usersResponse
        : Array.isArray(usersResponse?.users)
          ? usersResponse.users
          : [];
      setApprovalState(approval);
      setReviewUsers(
        users.filter(
          (user: ReviewUser) =>
            typeof user?.id === 'string' && user.id !== String(currentUser?.id || '')
        )
      );
    } catch {
      setGovernanceState('error');
    }
  }, [currentUser?.id, workbookId]);

  useEffect(() => {
    if (governanceDialog !== 'lifecycleStatus') return;
    setGovernanceState('idle');
    void loadApprovalWorkflow();
  }, [governanceDialog, loadApprovalWorkflow]);

  const submitForReview = useCallback(async (): Promise<void> => {
    if (!selectedReviewerId) return;
    setGovernanceState('saving');
    try {
      const result = await Api.submitWorkbookForReview(workbookId, selectedReviewerId);
      setApprovalState((current) =>
        current
          ? { ...current, ...result, workbookVersion: version }
          : { ...result, workbookVersion: version }
      );
      setLifecycleStatus('in_review');
      setSelectedReviewerId('');
      setGovernanceState('idle');
    } catch {
      setGovernanceState('error');
    }
  }, [selectedReviewerId, version, workbookId]);

  const decideReview = useCallback(
    async (decision: 'approve' | 'reject'): Promise<void> => {
      if (decision === 'reject' && !rejectionReason.trim()) return;
      setGovernanceState('saving');
      try {
        const result =
          decision === 'approve'
            ? await Api.approveWorkbook(workbookId)
            : await Api.rejectWorkbook(workbookId, rejectionReason.trim());
        setApprovalState((current) =>
          current
            ? { ...current, ...result, workbookVersion: version }
            : { ...result, workbookVersion: version }
        );
        setLifecycleStatus(decision === 'approve' ? 'approved' : 'draft');
        setRejectionReason('');
        setGovernanceState('idle');
      } catch {
        setGovernanceState('error');
      }
    },
    [rejectionReason, version, workbookId]
  );

  const renameWorkbook = useCallback(
    async (nextTitle: string): Promise<void> => {
      const title = nextTitle.trim();
      if (!title || title === workbookTitle) return;
      const previousTitle = workbookTitle;
      setWorkbookTitle(title);
      setSaveState('saving');
      setSheetCommandError(null);
      try {
        const result = await Api.renameWorkbook(workbookId, title, version);
        setWorkbookTitle(result.title);
        adoptVersion(result.version);
        setSaveState('saved');
      } catch {
        setWorkbookTitle(previousTitle);
        setSaveState('error');
        setSheetCommandError(
          'Nie udało się zmienić nazwy skoroszytu. Odśwież dane i spróbuj ponownie.'
        );
      }
    },
    [adoptVersion, setSaveState, version, workbookId, workbookTitle]
  );

  const jumpToWorkbookAnchor = useCallback(
    (sheetName?: string, cell?: string | null): void => {
      const sheetIndex = sheetName
        ? sheetNames.findIndex((name) => name === sheetName)
        : activeSheet;
      const targetSheet = sheetIndex >= 0 ? sheetIndex : activeSheet;
      const parsed = cell ? parseA1Cell(cell) : null;
      if (!parsed) {
        if (targetSheet !== activeSheet) selectSheet(targetSheet);
        return;
      }
      pendingFindSelectionRef.current = { sheetIndex: targetSheet, ...parsed };
      if (targetSheet !== activeSheet) selectSheet(targetSheet);
      else {
        requestAnimationFrame(() => {
          gridRef.current?.selectCell(parsed.rowIndex, parsed.colIndex);
          pendingFindSelectionRef.current = null;
        });
      }
    },
    [activeSheet, selectSheet, sheetNames]
  );

  const activeRawSheet = sheets[activeSheet];
  const activeSheetId =
    typeof activeRawSheet?.id === 'string' && activeRawSheet.id ? activeRawSheet.id : undefined;

  const selectionStats = useMemo(() => {
    if (!selection || !activeRawSheet) return null;
    const computedSheet = recalcWorkbook(sheets)[activeSheet];
    if (!computedSheet) return null;
    const startRow = Math.min(selection.rowIndex, selection.endRowIndex ?? selection.rowIndex);
    const endRow = Math.max(selection.rowIndex, selection.endRowIndex ?? selection.rowIndex);
    const startCol = Math.min(selection.colIndex, selection.endColIndex ?? selection.colIndex);
    const endCol = Math.max(selection.colIndex, selection.endColIndex ?? selection.colIndex);
    const values: number[] = [];
    for (let rowIndex = startRow; rowIndex <= endRow; rowIndex += 1) {
      for (let colIndex = startCol; colIndex <= endCol; colIndex += 1) {
        const columnKey = computedSheet.columns[colIndex]?.key;
        const value = columnKey ? computedSheet.rows[rowIndex]?.cells[columnKey]?.computed : null;
        if (typeof value === 'number' && Number.isFinite(value)) values.push(value);
      }
    }
    if (!values.length) return null;
    const sum = values.reduce((total, value) => total + value, 0);
    return {
      sum,
      average: sum / values.length,
      count: values.length,
    };
  }, [activeRawSheet, activeSheet, selection, sheets]);

  const persistCells = React.useCallback(
    async (
      payloads: Array<{
        sheetIndex: number;
        rowIndex: number;
        columnKey: string;
        value?: string | number | boolean | null;
        formula?: string;
      }>
    ): Promise<void> => {
      const operations = payloads.map((payload) => {
        const clear =
          (payload.value === undefined || payload.value === null) && payload.formula === undefined;
        return { type: clear ? ('clearCell' as const) : ('setCell' as const), ...payload };
      });
      const allClear = operations.every((operation) => operation.type === 'clearCell');
      await applyCommands(allClear ? 'xlsx.range.clear' : 'xlsx.range.edit', operations, {
        trackHistory: false,
      });
    },
    [applyCommands]
  );

  const searchMatches = useMemo(
    () =>
      findSpreadsheetMatches(sheets, searchQuery, {
        scope: searchScope,
        activeSheetIndex: activeSheet,
        matchCase,
        wholeCell,
        searchIn: 'all',
      }),
    [activeSheet, matchCase, searchQuery, searchScope, sheets, wholeCell]
  );

  useEffect(() => {
    setSearchIndex((current) =>
      searchMatches.length ? Math.min(current, searchMatches.length - 1) : 0
    );
  }, [searchMatches.length]);

  const focusSearchMatch = useCallback(
    (index: number): void => {
      if (!searchMatches.length) return;
      const normalizedIndex = (index + searchMatches.length) % searchMatches.length;
      const match = searchMatches[normalizedIndex];
      setSearchIndex(normalizedIndex);
      pendingFindSelectionRef.current = {
        sheetIndex: match.sheetIndex,
        rowIndex: match.rowIndex,
        colIndex: match.colIndex,
      };
      if (match.sheetIndex !== activeSheet) selectSheet(match.sheetIndex);
      else {
        requestAnimationFrame(() => {
          gridRef.current?.selectCell(match.rowIndex, match.colIndex);
          pendingFindSelectionRef.current = null;
        });
      }
    },
    [activeSheet, searchMatches, selectSheet]
  );

  useEffect(() => {
    const pending = pendingFindSelectionRef.current;
    if (!pending || pending.sheetIndex !== activeSheet) return;
    requestAnimationFrame(() => {
      gridRef.current?.selectCell(pending.rowIndex, pending.colIndex);
      pendingFindSelectionRef.current = null;
    });
  }, [activeSheet]);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLocaleLowerCase();
      if (key !== 'f' && key !== 'h') return;
      event.preventDefault();
      setSearchMode(key === 'h' ? 'replace' : 'find');
    };
    const onEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && searchMode) setSearchMode(null);
    };
    document.addEventListener('keydown', onShortcut);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('keydown', onShortcut);
      document.removeEventListener('keydown', onEscape);
    };
  }, [searchMode]);

  useEffect(() => {
    const pending = pendingSheetSelectionRef.current;
    if (pending == null) return;
    pendingSheetSelectionRef.current = null;
    selectSheet(Math.min(pending, Math.max(0, sheets.length - 1)));
  }, [selectSheet, sheets.length]);

  useEffect(() => {
    if (leftMode !== 'comments') return;
    let cancelled = false;
    setCommentState('loading');
    void Api.listWorkbookComments(workbookId, { status: 'open' })
      .then((result) => {
        if (cancelled) return;
        setComments(result.comments);
        setCommentState('idle');
      })
      .catch(() => {
        if (!cancelled) setCommentState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [leftMode, workbookId]);

  const loadSourceBindings = useCallback(async (): Promise<void> => {
    setSourceState('loading');
    try {
      const result = await Api.listWorkbookSourceBindings(workbookId);
      setSourceBindings(result.bindings);
      setSourceState('idle');
    } catch {
      setSourceState('error');
    }
  }, [workbookId]);

  useEffect(() => {
    if (leftMode === 'sources') void loadSourceBindings();
  }, [leftMode, loadSourceBindings]);

  const loadRevisions = useCallback(async (): Promise<void> => {
    setRevisionState('loading');
    try {
      const result = await Api.listWorkbookRevisions(workbookId);
      setRevisions(result.revisions);
      setRevisionState('idle');
    } catch {
      setRevisionState('error');
    }
  }, [workbookId]);

  useEffect(() => {
    if (leftMode === 'versions') void loadRevisions();
  }, [leftMode, loadRevisions]);

  const addComment = async (): Promise<void> => {
    const body = commentDraft.trim();
    if (!body) return;
    const range = selection?.address?.split('!').pop();
    setCommentState('saving');
    try {
      await Api.createWorkbookComment(workbookId, {
        body,
        idempotencyKey: crypto.randomUUID(),
        anchor:
          activeSheetId && range
            ? { sheetId: activeSheetId, range }
            : activeSheetId
              ? { sheetId: activeSheetId }
              : undefined,
      });
      const result = await Api.listWorkbookComments(workbookId, { status: 'open' });
      setComments(result.comments);
      setCommentDraft('');
      setCommentState('idle');
    } catch {
      setCommentState('error');
    }
  };

  const resolveComment = async (commentId: string): Promise<void> => {
    try {
      await Api.setWorkbookCommentStatus(workbookId, commentId, 'resolved');
      setComments((current) => current.filter((comment) => comment.id !== commentId));
    } catch {
      setCommentState('error');
    }
  };

  const bindSourceToSelection = async (): Promise<void> => {
    const label = sourceLabelDraft.trim();
    const range = selection?.address?.split('!').pop();
    if (!label || !activeSheetId || !range) return;
    setSourceState('saving');
    try {
      const result = await Api.bindWorkbookSource(workbookId, {
        sheetId: activeSheetId,
        range,
        label,
        sourceRef: sourceRefDraft.trim() || undefined,
        sourceType: 'user',
        baseVersion: version,
        idempotencyKey: crypto.randomUUID(),
      });
      adoptVersion(result.version);
      setSourceLabelDraft('');
      setSourceRefDraft('');
      await loadSourceBindings();
    } catch {
      setSourceState('error');
    }
  };

  const unbindSource = async (bindingId: string): Promise<void> => {
    setSourceState('saving');
    try {
      const result = await Api.unbindWorkbookSource(workbookId, bindingId, version);
      adoptVersion(result.version);
      await loadSourceBindings();
    } catch {
      setSourceState('error');
    }
  };

  const runSheetCommand = async (
    commandId: string,
    operations: Parameters<typeof applyCommands>[1],
    nextSheets: StudioSheet[],
    nextActiveSheet = activeSheet
  ): Promise<void> => {
    setSheetCommandError(null);
    const before = { sheets: cloneSheets(sheets), activeSheet };
    try {
      await applyCommands(commandId, operations);
      sheetUndoRef.current.push(before);
      sheetRedoRef.current = [];
      pendingSheetSelectionRef.current = nextActiveSheet;
      setSheets(nextSheets);
      setOpenSheetMenuId(null);
    } catch {
      setSheetCommandError('Nie udało się zmienić struktury arkuszy. Spróbuj ponownie.');
    }
  };

  const refreshWorkbookSheets = async (): Promise<StudioSheet[]> => {
    const schema = await Api.getWorkbookSchema(workbookId);
    return cloneSheets(schema.sheets as StudioSheet[]);
  };

  const restoreRevision = async (sourceVersion: number): Promise<void> => {
    if (!globalThis.confirm(`Przywrócić wersję ${sourceVersion} jako nową wersję skoroszytu?`)) {
      return;
    }
    setRevisionState('restoring');
    try {
      const result = await Api.restoreWorkbookRevision(workbookId, sourceVersion, version);
      const authoritativeSheets = await refreshWorkbookSheets();
      setSheets(authoritativeSheets);
      adoptVersion(result.version);
      setSelection(null);
      await loadRevisions();
    } catch {
      setRevisionState('error');
    }
  };

  const replaceAllMatches = async (): Promise<void> => {
    if (!searchQuery || !searchMatches.length) return;
    const replacements = buildSpreadsheetReplacements(sheets, searchQuery, replacementText, {
      scope: searchScope,
      activeSheetIndex: activeSheet,
      matchCase,
      wholeCell,
      searchIn: 'all',
    });
    if (!replacements.length) return;

    const before = { sheets: cloneSheets(sheets), activeSheet };
    setSearchError(null);
    try {
      await applyCommands(
        'xlsx.replace.all',
        replacements.map((replacement) => ({ type: 'setCell' as const, ...replacement }))
      );
      const authoritativeSheets = await refreshWorkbookSheets();
      sheetUndoRef.current.push(before);
      sheetRedoRef.current = [];
      setSheets(authoritativeSheets);
      setSearchIndex(0);
    } catch {
      setSearchError('Nie udało się wykonać zamiany. Żadna komórka nie została zmieniona.');
    }
  };

  const syncGridSheets = useCallback((nextSheets: FormulaSheet[]): void => {
    setSheets(cloneSheets(nextSheets as StudioSheet[]));
  }, []);

  const runAxisCommand = async (
    commandId: string,
    operation:
      | { type: 'insertRows' | 'deleteRows'; sheetIndex: number; atIndex: number; count: number }
      | {
          type: 'insertColumns' | 'deleteColumns';
          sheetIndex: number;
          atIndex: number;
          count: number;
        }
  ): Promise<void> => {
    setSheetCommandError(null);
    const before = { sheets: cloneSheets(sheets), activeSheet };
    try {
      await applyCommands(commandId, [operation]);
      const authoritativeSheets = await refreshWorkbookSheets();
      sheetUndoRef.current.push(before);
      sheetRedoRef.current = [];
      setSheets(authoritativeSheets);
      setSelection(null);
    } catch {
      setSheetCommandError('Nie udało się zmienić struktury arkusza. Spróbuj ponownie.');
    }
  };

  type StylePatch = {
    bold?: boolean;
    italic?: boolean;
    alignment?: 'left' | 'center' | 'right';
    wrapText?: boolean;
    numberFormat?: string;
  };

  const selectedBounds = () => {
    const axis = selectedAxis();
    const rowCount = activeRawSheet?.rows?.length ?? 0;
    const columnCount = activeRawSheet?.columns?.length ?? 0;
    if (selection?.kind === 'row') {
      return {
        startRow: axis.start,
        endRow: axis.end,
        startColumn: 0,
        endColumn: Math.max(columnCount - 1, 0),
      };
    }
    if (selection?.kind === 'column') {
      return {
        startRow: 0,
        endRow: Math.max(rowCount - 1, 0),
        startColumn: axis.columnStart,
        endColumn: axis.columnEnd,
      };
    }
    return {
      startRow: axis.start,
      endRow: axis.end,
      startColumn: axis.columnStart,
      endColumn: axis.columnEnd,
    };
  };

  const selectedCellsAllMatch = (key: 'bold' | 'italic' | 'wrapText'): boolean => {
    const bounds = selectedBounds();
    if (!activeRawSheet || !selection) return false;
    const columns = activeRawSheet.columns ?? [];
    const rows = activeRawSheet.rows ?? [];
    for (let rowIndex = bounds.startRow; rowIndex <= bounds.endRow; rowIndex += 1) {
      for (
        let columnIndex = bounds.startColumn;
        columnIndex <= bounds.endColumn;
        columnIndex += 1
      ) {
        const columnKey = columns[columnIndex]?.key;
        if (!columnKey) return false;
        const style = rows[rowIndex]?.cells?.[columnKey]?.style as
          | Record<string, unknown>
          | undefined;
        if (style?.[key] !== true) return false;
      }
    }
    return true;
  };

  const runStyleCommand = async (commandId: string, patch: StylePatch): Promise<void> => {
    if (!selection || !activeRawSheet?.rows?.length || !activeRawSheet.columns?.length) return;
    setSheetCommandError(null);
    const before = { sheets: cloneSheets(sheets), activeSheet };
    const bounds = selectedBounds();
    try {
      await applyCommands(commandId, [
        { type: 'setCellStyle', sheetIndex: activeSheet, ...bounds, patch },
      ]);
      const authoritativeSheets = await refreshWorkbookSheets();
      sheetUndoRef.current.push(before);
      sheetRedoRef.current = [];
      setSheets(authoritativeSheets);
    } catch {
      setSheetCommandError('Nie udało się sformatować zaznaczenia. Spróbuj ponownie.');
    }
  };

  const selectedAxis = () => {
    const start = Math.min(
      selection?.rowIndex ?? 0,
      selection?.endRowIndex ?? selection?.rowIndex ?? 0
    );
    const end = Math.max(
      selection?.rowIndex ?? 0,
      selection?.endRowIndex ?? selection?.rowIndex ?? 0
    );
    const columnStart = Math.min(
      selection?.colIndex ?? 0,
      selection?.endColIndex ?? selection?.colIndex ?? 0
    );
    const columnEnd = Math.max(
      selection?.colIndex ?? 0,
      selection?.endColIndex ?? selection?.colIndex ?? 0
    );
    return {
      start,
      end,
      count: end - start + 1,
      columnStart,
      columnEnd,
      columnCount: columnEnd - columnStart + 1,
    };
  };

  const deleteSelectedRows = async (): Promise<void> => {
    const axis = selectedAxis();
    const rows = activeRawSheet?.rows?.slice(axis.start, axis.end + 1) ?? [];
    const hasContent = rows.some((row) =>
      Object.values(row.cells ?? {}).some((cell) => cell?.value != null || Boolean(cell?.formula))
    );
    if (hasContent && !globalThis.confirm(`Usunąć ${axis.count} zaznaczonych wierszy z danymi?`))
      return;
    await runAxisCommand('xlsx.row.delete', {
      type: 'deleteRows',
      sheetIndex: activeSheet,
      atIndex: axis.start,
      count: axis.count,
    });
  };

  const deleteSelectedColumns = async (): Promise<void> => {
    const axis = selectedAxis();
    const keys = new Set(
      (activeRawSheet?.columns ?? [])
        .slice(axis.columnStart, axis.columnEnd + 1)
        .map((column) => column.key)
    );
    const hasContent = (activeRawSheet?.rows ?? []).some((row) =>
      Object.entries(row.cells ?? {}).some(
        ([key, cell]) => keys.has(key) && (cell?.value != null || Boolean(cell?.formula))
      )
    );
    if (
      hasContent &&
      !globalThis.confirm(`Usunąć ${axis.columnCount} zaznaczonych kolumn z danymi?`)
    )
      return;
    await runAxisCommand('xlsx.column.delete', {
      type: 'deleteColumns',
      sheetIndex: activeSheet,
      atIndex: axis.columnStart,
      count: axis.columnCount,
    });
  };

  const addSheet = async (): Promise<void> => {
    const id = crypto.randomUUID();
    const name = nextSheetName(sheets);
    const next = [...cloneSheets(sheets), createClientSheet(id, name)];
    await runSheetCommand('xlsx.sheet.add', [{ type: 'addSheet', name, sheetId: id }], next);
  };

  const duplicateSheet = async (sheet: StudioSheet, index: number): Promise<void> => {
    if (!sheet.id) return;
    const newSheetId = crypto.randomUUID();
    const name = `${sheet.name || 'Arkusz'} kopia`;
    const copy = { ...structuredClone(sheet), id: newSheetId, name, hidden: false };
    const next = cloneSheets(sheets);
    next.splice(index + 1, 0, copy);
    await runSheetCommand(
      'xlsx.sheet.duplicate',
      [{ type: 'duplicateSheet', sheetId: sheet.id, name, newSheetId }],
      next,
      activeSheet > index ? activeSheet + 1 : activeSheet
    );
  };

  const commitRename = async (sheet: StudioSheet): Promise<void> => {
    const name = renameDraft.trim();
    if (!sheet.id || !name || name === sheet.name) {
      setRenamingSheetId(null);
      return;
    }
    const next = cloneSheets(sheets);
    const target = next.find((candidate) => candidate.id === sheet.id);
    if (target) target.name = name;
    await runSheetCommand(
      'xlsx.sheet.rename',
      [{ type: 'renameSheet', sheetId: sheet.id, name }],
      next
    );
    setRenamingSheetId(null);
  };

  const deleteSheet = async (sheet: StudioSheet, index: number): Promise<void> => {
    if (!sheet.id || sheets.length <= 1) return;
    const hasContent = (sheet.rows ?? []).some((row) =>
      Object.values(row.cells ?? {}).some((cell) => cell?.value != null || Boolean(cell?.formula))
    );
    if (hasContent && !globalThis.confirm(`Usunąć arkusz „${sheet.name || 'Arkusz'}” z danymi?`))
      return;
    const next = cloneSheets(sheets).filter((candidate) => candidate.id !== sheet.id);
    const nextActive =
      activeSheet === index
        ? Math.max(0, index - 1)
        : activeSheet > index
          ? activeSheet - 1
          : activeSheet;
    await runSheetCommand(
      'xlsx.sheet.delete',
      [{ type: 'deleteSheet', sheetId: sheet.id }],
      next,
      nextActive
    );
  };

  const moveSheet = async (sheet: StudioSheet, index: number, delta: -1 | 1): Promise<void> => {
    if (!sheet.id) return;
    const targetIndex = index + delta;
    if (targetIndex < 0 || targetIndex >= sheets.length) return;
    const next = cloneSheets(sheets);
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    const nextActive =
      activeSheet === index ? targetIndex : activeSheet === targetIndex ? index : activeSheet;
    await runSheetCommand(
      'xlsx.sheet.reorder',
      [{ type: 'reorderSheet', sheetId: sheet.id, targetIndex }],
      next,
      nextActive
    );
  };

  const toggleSheetHidden = async (sheet: StudioSheet): Promise<void> => {
    if (!sheet.id) return;
    const hidden = !sheet.hidden;
    const visibleCount = sheets.filter((candidate) => !candidate.hidden).length;
    if (hidden && visibleCount <= 1) return;
    const next = cloneSheets(sheets);
    const target = next.find((candidate) => candidate.id === sheet.id);
    if (target) target.hidden = hidden;
    await runSheetCommand(
      'xlsx.sheet.visibility',
      [{ type: 'setSheetHidden', sheetId: sheet.id, hidden }],
      next
    );
  };

  const undoStudio = async (): Promise<void> => {
    if (historyState.canUndo) {
      gridRef.current?.undo();
      return;
    }
    const snapshot = sheetUndoRef.current.pop();
    if (!snapshot) return;
    try {
      const version = await undoCommand();
      if (version == null) {
        sheetUndoRef.current.push(snapshot);
        return;
      }
      sheetRedoRef.current.push({ sheets: cloneSheets(sheets), activeSheet });
      pendingSheetSelectionRef.current = snapshot.activeSheet;
      setSheets(snapshot.sheets);
    } catch {
      sheetUndoRef.current.push(snapshot);
      setSheetCommandError('Nie udało się cofnąć zmiany arkuszy.');
    }
  };

  const redoStudio = async (): Promise<void> => {
    if (historyState.canRedo) {
      gridRef.current?.redo();
      return;
    }
    const snapshot = sheetRedoRef.current.pop();
    if (!snapshot) return;
    try {
      const version = await redoCommand();
      if (version == null) {
        sheetRedoRef.current.push(snapshot);
        return;
      }
      sheetUndoRef.current.push({ sheets: cloneSheets(sheets), activeSheet });
      pendingSheetSelectionRef.current = snapshot.activeSheet;
      setSheets(snapshot.sheets);
    } catch {
      sheetRedoRef.current.push(snapshot);
      setSheetCommandError('Nie udało się ponowić zmiany arkuszy.');
    }
  };

  const chips = useMemo<TopBarChipDescriptor[]>(
    () => [
      {
        id: 'classification',
        label:
          classification === 'public'
            ? 'Publiczny'
            : classification === 'confidential'
              ? 'Poufny'
              : 'Wewnętrzny',
        group: 'secondary',
        onClick: () => {
          setGovernanceState('idle');
          setGovernanceDialog('classification');
        },
      },
      {
        id: 'lifecycle',
        label:
          lifecycleStatus === 'in_review'
            ? 'Do przeglądu'
            : lifecycleStatus === 'approved'
              ? 'Zatwierdzony'
              : lifecycleStatus === 'final'
                ? 'Finalny'
                : 'Szkic',
        group: 'secondary',
        dotTone: lifecycleStatus === 'final' ? 'success' : 'neutral',
        onClick: () => {
          setGovernanceState('idle');
          setGovernanceDialog('lifecycleStatus');
        },
      },
      {
        id: 'copy-link',
        label: 'Kopiuj link',
        icon: Link2,
        group: 'overflow',
        onClick: onCopyLink,
      },
      {
        id: 'export',
        label: 'Eksportuj XLSX',
        icon: Download,
        kind: 'primary',
        group: 'primary',
        onClick: onDownload,
      },
    ],
    [classification, lifecycleStatus, onCopyLink, onDownload]
  );

  const registry = useMemo(
    () =>
      createSpreadsheetArtifactCommandRegistry({
        editSelectedCell: () => gridRef.current?.editSelectedCell(),
        clearSelectedCell: () => gridRef.current?.clearSelectedCell(),
        copySelection: () => void gridRef.current?.copySelection(),
        cutSelection: () => void gridRef.current?.cutSelection(),
        pasteSelection: () => void gridRef.current?.pasteSelection(),
        undo: () => void undoStudio(),
        redo: () => void redoStudio(),
        canUndo: historyState.canUndo || canUndoCommand,
        canRedo: historyState.canRedo || canRedoCommand,
        insertRowsAbove: () => {
          const axis = selectedAxis();
          void runAxisCommand('xlsx.row.insertAbove', {
            type: 'insertRows',
            sheetIndex: activeSheet,
            atIndex: axis.start,
            count: axis.count,
          });
        },
        insertRowsBelow: () => {
          const axis = selectedAxis();
          void runAxisCommand('xlsx.row.insertBelow', {
            type: 'insertRows',
            sheetIndex: activeSheet,
            atIndex: axis.end + 1,
            count: axis.count,
          });
        },
        deleteRows: () => void deleteSelectedRows(),
        insertColumnsLeft: () => {
          const axis = selectedAxis();
          void runAxisCommand('xlsx.column.insertLeft', {
            type: 'insertColumns',
            sheetIndex: activeSheet,
            atIndex: axis.columnStart,
            count: axis.columnCount,
          });
        },
        insertColumnsRight: () => {
          const axis = selectedAxis();
          void runAxisCommand('xlsx.column.insertRight', {
            type: 'insertColumns',
            sheetIndex: activeSheet,
            atIndex: axis.columnEnd + 1,
            count: axis.columnCount,
          });
        },
        deleteColumns: () => void deleteSelectedColumns(),
        toggleBold: () =>
          void runStyleCommand('xlsx.format.bold', { bold: !selectedCellsAllMatch('bold') }),
        toggleItalic: () =>
          void runStyleCommand('xlsx.format.italic', { italic: !selectedCellsAllMatch('italic') }),
        toggleWrapText: () =>
          void runStyleCommand('xlsx.format.wrap', {
            wrapText: !selectedCellsAllMatch('wrapText'),
          }),
        alignLeft: () => void runStyleCommand('xlsx.format.alignLeft', { alignment: 'left' }),
        alignCenter: () => void runStyleCommand('xlsx.format.alignCenter', { alignment: 'center' }),
        alignRight: () => void runStyleCommand('xlsx.format.alignRight', { alignment: 'right' }),
        formatGeneral: () =>
          void runStyleCommand('xlsx.format.general', { numberFormat: 'General' }),
        formatNumber: () =>
          void runStyleCommand('xlsx.format.number', { numberFormat: '# ##0.00' }),
        formatCurrency: () =>
          void runStyleCommand('xlsx.format.currency', { numberFormat: '# ##0.00 PLN' }),
        formatPercent: () => void runStyleCommand('xlsx.format.percent', { numberFormat: '0.00%' }),
        toggleFreezePanes: () => setFreezePanes((value) => !value),
        openFind: () => setSearchMode('find'),
        openReplace: () => setSearchMode('replace'),
      }),
    [canRedoCommand, canUndoCommand, historyState, sheets, activeSheet, selection]
  );

  const openTeresa = (explicitSelection?: SpreadsheetCellSelection): void => {
    void openChatWithContext({
      entityType: 'workbook',
      entityId: workbookId,
      entityName: workbookTitle,
      reuseActiveConversation: true,
      contextData: {
        artifactType: 'spreadsheet',
        workbookId,
        activeSheetIndex: activeSheet,
        activeSheetName: sheetNames[activeSheet],
        classification,
        versionId: version,
        selection: explicitSelection
          ? {
              kind: explicitSelection.kind ?? 'cell',
              address: explicitSelection.address,
              rowIndex: explicitSelection.rowIndex,
              colIndex: explicitSelection.colIndex,
              endRowIndex: explicitSelection.endRowIndex,
              endColIndex: explicitSelection.endColIndex,
              rawValue: explicitSelection.rawValue,
              sheetId: activeSheetId,
              sheetName: sheetNames[activeSheet],
            }
          : undefined,
      },
    });
  };

  const contextMenuItems = useMemo<CanvasContextMenuItemDescriptor[]>(() => {
    if (!contextMenu) return [];
    const selected = contextMenu.selection;
    return [
      {
        id: 'xlsx.clipboard.copy',
        label: 'Kopiuj',
        shortcut: '⌘C',
        onSelect: () => void gridRef.current?.copySelection(),
      },
      {
        id: 'xlsx.clipboard.cut',
        label: 'Wytnij',
        shortcut: '⌘X',
        onSelect: () => void gridRef.current?.cutSelection(),
      },
      {
        id: 'xlsx.clipboard.paste',
        label: 'Wklej',
        shortcut: '⌘V',
        onSelect: () => void gridRef.current?.pasteSelection(),
      },
      {
        id: 'xlsx.cell.clear',
        label: selected.kind === 'range' ? 'Wyczyść zakres' : 'Wyczyść zawartość',
        separatorBefore: true,
        onSelect: () => gridRef.current?.clearSelectedCell(),
      },
      {
        id: 'xlsx.comment.add',
        label: 'Dodaj komentarz',
        separatorBefore: true,
        onSelect: () => {
          setLeftMode('comments');
          setCommentDraft(`Komentarz do ${selected.address}: `);
        },
      },
      {
        id: 'xlsx.source.open',
        label: 'Pokaż źródło',
        disabled: sourceItems.length === 0,
        disabledReason: 'Skoroszyt nie ma zapisanych źródeł',
        onSelect: () => setLeftMode('sources'),
      },
      {
        id: 'xlsx.teresa.attachSelection',
        label: 'Przekaż Teresie',
        separatorBefore: true,
        onSelect: () => openTeresa(selected),
      },
    ];
  }, [contextMenu, sourceItems.length]);

  const sheetsPanel = (
    <>
      <button
        type="button"
        onClick={() => void addSheet()}
        className="mb-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-c-border text-sm font-medium text-c-text-secondary hover:bg-c-surface-raised hover:text-c-text"
      >
        <Plus size={15} aria-hidden="true" /> Dodaj arkusz
      </button>
      {sheetCommandError ? (
        <p role="alert" className="mb-2 px-2 text-xs text-c-danger">
          {sheetCommandError}
        </p>
      ) : null}
      <div className="space-y-1 overflow-y-auto">
        {sheets.map((sheet, index) => {
          const sheetId = sheet.id || `legacy-${index}`;
          return (
            <div key={sheetId} data-sheet-menu-root className="relative flex items-center gap-1">
              {renamingSheetId === sheetId ? (
                <input
                  ref={renameInputRef}
                  aria-label={`Nowa nazwa arkusza ${sheet.name || index + 1}`}
                  value={renameDraft}
                  onChange={(event) => setRenameDraft(event.target.value)}
                  onBlur={() => void commitRename(sheet)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur();
                    if (event.key === 'Escape') setRenamingSheetId(null);
                  }}
                  className="min-h-10 min-w-0 flex-1 rounded-lg border border-c-focus bg-c-surface px-3 text-sm text-c-text outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => selectSheet(index)}
                  aria-current={activeSheet === index ? 'page' : undefined}
                  className={`min-h-10 min-w-0 flex-1 truncate rounded-lg px-3 text-left text-sm transition-colors ${
                    activeSheet === index
                      ? 'bg-c-focus/10 text-c-focus-solid'
                      : 'text-c-text-secondary hover:bg-c-surface-raised hover:text-c-text'
                  } ${sheet.hidden ? 'opacity-55' : ''}`}
                >
                  {sheet.name || `Arkusz ${index + 1}`}
                  {sheet.hidden ? ' · ukryty' : ''}
                </button>
              )}
              <button
                type="button"
                aria-label={`Akcje arkusza ${sheet.name || index + 1}`}
                aria-expanded={openSheetMenuId === sheetId}
                onClick={() =>
                  setOpenSheetMenuId((current) => (current === sheetId ? null : sheetId))
                }
                disabled={!sheet.id}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-c-text-muted hover:bg-c-surface-raised hover:text-c-text disabled:opacity-30"
              >
                <MoreHorizontal size={15} aria-hidden="true" />
              </button>
              {openSheetMenuId === sheetId ? (
                <div
                  role="menu"
                  className="absolute right-0 top-10 z-30 w-52 rounded-lg border border-c-border bg-c-surface-raised p-1 shadow-xl"
                >
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      setRenameDraft(sheet.name || '');
                      setRenamingSheetId(sheetId);
                      setOpenSheetMenuId(null);
                    }}
                    className="flex min-h-10 w-full items-center gap-2 rounded-md px-3 text-left text-sm hover:bg-c-surface"
                  >
                    <Pencil size={14} /> Zmień nazwę
                  </button>
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => void duplicateSheet(sheet, index)}
                    className="flex min-h-10 w-full items-center gap-2 rounded-md px-3 text-left text-sm hover:bg-c-surface"
                  >
                    <Copy size={14} /> Duplikuj
                  </button>
                  <button
                    role="menuitem"
                    type="button"
                    disabled={index === 0}
                    onClick={() => void moveSheet(sheet, index, -1)}
                    className="flex min-h-10 w-full items-center gap-2 rounded-md px-3 text-left text-sm hover:bg-c-surface disabled:opacity-40"
                  >
                    <ArrowUp size={14} /> Przenieś wyżej
                  </button>
                  <button
                    role="menuitem"
                    type="button"
                    disabled={index === sheets.length - 1}
                    onClick={() => void moveSheet(sheet, index, 1)}
                    className="flex min-h-10 w-full items-center gap-2 rounded-md px-3 text-left text-sm hover:bg-c-surface disabled:opacity-40"
                  >
                    <ArrowDown size={14} /> Przenieś niżej
                  </button>
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => void toggleSheetHidden(sheet)}
                    className="flex min-h-10 w-full items-center gap-2 rounded-md px-3 text-left text-sm hover:bg-c-surface"
                  >
                    {sheet.hidden ? <Eye size={14} /> : <EyeOff size={14} />}{' '}
                    {sheet.hidden ? 'Pokaż' : 'Ukryj'}
                  </button>
                  <button
                    role="menuitem"
                    type="button"
                    disabled={sheets.length <= 1}
                    onClick={() => void deleteSheet(sheet, index)}
                    className="flex min-h-10 w-full items-center gap-2 rounded-md px-3 text-left text-sm text-c-danger hover:bg-c-danger/10 disabled:opacity-40"
                  >
                    <Trash2 size={14} /> Usuń
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </>
  );

  const commentsPanel = (
    <div className="flex min-h-0 flex-1 flex-col gap-2" data-testid="spreadsheet-comments-panel">
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
        {commentState === 'loading' ? (
          <p className="px-2 text-sm text-c-text-muted">Wczytywanie komentarzy…</p>
        ) : comments.length ? (
          comments.map((comment) => (
            <article key={comment.id} className="rounded-lg border border-c-border p-3 text-sm">
              <p className="text-c-text">{comment.body}</p>
              <div className="mt-2 flex items-center justify-between gap-2 text-xs text-c-text-muted">
                <span>{comment.range_ref || (comment.sheet_id ? 'Arkusz' : 'Skoroszyt')}</span>
                <button
                  type="button"
                  onClick={() => void resolveComment(comment.id)}
                  className="rounded px-2 py-1 hover:bg-c-surface-raised hover:text-c-text"
                >
                  Rozwiąż
                </button>
              </div>
            </article>
          ))
        ) : (
          <p className="px-2 text-sm text-c-text-muted">Brak otwartych komentarzy.</p>
        )}
      </div>
      <label className="text-xs font-medium text-c-text-secondary" htmlFor="workbook-comment">
        {selection?.address ? `Komentarz do ${selection.address}` : 'Komentarz do skoroszytu'}
      </label>
      <textarea
        id="workbook-comment"
        value={commentDraft}
        onChange={(event) => setCommentDraft(event.target.value)}
        rows={3}
        className="w-full resize-none rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text outline-none focus:border-c-focus-solid"
      />
      <button
        type="button"
        disabled={!commentDraft.trim() || commentState === 'saving'}
        onClick={() => void addComment()}
        className="min-h-10 rounded-lg bg-c-text px-3 text-sm font-medium text-c-surface disabled:opacity-50"
      >
        {commentState === 'saving' ? 'Zapisywanie…' : 'Dodaj komentarz'}
      </button>
      {commentState === 'error' ? (
        <p role="alert" className="text-xs text-c-danger">
          Nie udało się zapisać komentarza. Treść pozostała w polu.
        </p>
      ) : null}
    </div>
  );

  const sourcesPanel = (
    <div className="min-h-0 flex-1 overflow-y-auto" data-testid="spreadsheet-sources-panel">
      <div className="mb-3 rounded-lg border border-c-border bg-c-surface p-3">
        <h2 className="text-sm font-semibold text-c-text">Źródła i założenia</h2>
        <p className="mt-1 text-xs text-c-text-muted">
          Pochodzenie danych zapisane razem z tym skoroszytem. Brak wpisu oznacza UNKNOWN.
        </p>
      </div>
      <div className="mb-3 space-y-2 rounded-lg border border-c-border bg-c-surface p-3">
        <label htmlFor="workbook-source-label" className="block text-xs font-medium text-c-text">
          Powiąż źródło z zaznaczeniem
        </label>
        <input
          id="workbook-source-label"
          value={sourceLabelDraft}
          onChange={(event) => setSourceLabelDraft(event.target.value)}
          placeholder="Nazwa źródła"
          className="min-h-10 w-full rounded-md border border-c-border bg-c-surface-raised px-3 text-sm text-c-text outline-none focus:border-c-focus-solid"
        />
        <input
          aria-label="Odnośnik do źródła"
          value={sourceRefDraft}
          onChange={(event) => setSourceRefDraft(event.target.value)}
          placeholder="URL lub identyfikator (opcjonalnie)"
          className="min-h-10 w-full rounded-md border border-c-border bg-c-surface-raised px-3 text-sm text-c-text outline-none focus:border-c-focus-solid"
        />
        <button
          type="button"
          onClick={() => void bindSourceToSelection()}
          disabled={
            !sourceLabelDraft.trim() || !activeSheetId || !selection?.address || sourceState === 'saving'
          }
          className="min-h-10 w-full rounded-md bg-c-text px-3 text-sm font-medium text-c-surface disabled:opacity-50"
        >
          {sourceState === 'saving' ? 'Zapisywanie…' : 'Powiąż z zaznaczeniem'}
        </button>
        {!selection?.address ? (
          <p className="text-xs text-c-text-muted">Najpierw zaznacz komórkę lub zakres.</p>
        ) : null}
        {sourceState === 'error' ? (
          <p role="alert" className="text-xs text-c-danger">
            Nie udało się zapisać powiązania. Spróbuj ponownie.
          </p>
        ) : null}
      </div>
      {sourceItems.length ? (
        <div className="space-y-2">
          {sourceItems.map((source) => {
            const label = sourceLabel(source.item);
            const anchor = sourceAnchor(source.item);
            return (
              <article key={source.id} className="rounded-lg border border-c-border p-3">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
                  {source.group}
                </span>
                {anchor ? (
                  <button
                    type="button"
                    className="mt-1 block w-full rounded text-left text-sm text-c-text hover:text-c-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                    aria-label={`Przejdź do źródła ${label}`}
                    onClick={() => jumpToWorkbookAnchor(anchor.sheet, anchor.cell)}
                  >
                    <span className="block break-words">{label}</span>
                    <span className="mt-1 block text-xs text-c-text-muted">
                      {[anchor.sheet, anchor.cell].filter(Boolean).join(' · ')}
                    </span>
                  </button>
                ) : (
                  <p className="mt-1 break-words text-sm text-c-text">{label}</p>
                )}
                {'bindingId' in source && source.bindingId ? (
                  <button
                    type="button"
                    onClick={() => void unbindSource(String(source.bindingId))}
                    className="mt-2 min-h-10 text-xs font-medium text-c-danger hover:underline"
                  >
                    Usuń powiązanie
                  </button>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-c-warning/40 bg-c-warning/10 p-3 text-sm text-c-text-secondary">
          UNKNOWN — do skoroszytu nie przypisano źródeł ani referencji dowodowych.
        </div>
      )}
    </div>
  );

  const qaPanel = (
    <div className="min-h-0 flex-1 overflow-y-auto" data-testid="spreadsheet-qa-panel">
      <div className="mb-3 rounded-lg border border-c-border bg-c-surface p-3">
        <h2 className="text-sm font-semibold text-c-text">Kontrola jakości</h2>
        <p className="mt-1 text-xs text-c-text-muted">
          Konkretne problemy z możliwością przejścia do arkusza lub komórki.
        </p>
      </div>
      {qaIssues.length ? (
        <div className="space-y-2">
          {qaIssues.map((issue, index) => {
            const normalizedSeverity = issue.severity?.toUpperCase();
            const critical = issue.blocking || normalizedSeverity === 'CRITICAL';
            return (
              <button
                key={`${issue.code || 'issue'}-${index}`}
                type="button"
                onClick={() => jumpToWorkbookAnchor(issue.sheet, issue.cell)}
                className={`min-h-11 w-full rounded-lg border p-3 text-left ${critical ? 'border-c-danger/50 bg-c-danger/10' : 'border-c-border hover:bg-c-surface-raised'}`}
              >
                <span
                  className={`text-[11px] font-semibold uppercase tracking-wide ${critical ? 'text-c-danger' : 'text-c-warning'}`}
                >
                  {normalizedSeverity || (critical ? 'CRITICAL' : 'WARNING')}
                </span>
                <p className="mt-1 text-sm text-c-text">{issue.message}</p>
                <p className="mt-1 text-xs text-c-text-muted">
                  {[issue.sheet, issue.cell].filter(Boolean).join(' · ') || 'Cały skoroszyt'}
                  {issue.fix ? ` — ${issue.fix}` : ''}
                </p>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-c-border p-3 text-sm text-c-text-secondary">
          {preview.qualityReport
            ? 'Brak otwartych problemów QA.'
            : 'Raport QA nie jest dostępny dla tej wersji.'}
        </div>
      )}
    </div>
  );

  const revisionLabel = (commandId: string): string => {
    const labels: Record<string, string> = {
      'xlsx.cell.edit': 'Edycja komórki',
      'xlsx.range.edit': 'Edycja zakresu',
      'xlsx.range.clear': 'Wyczyszczenie zakresu',
      'xlsx.replace.all': 'Znajdź i zamień',
      'xlsx.history.undo': 'Cofnięcie zmiany',
      'xlsx.versions.restore': 'Przywrócenie wersji',
      'xlsx.sheet.add': 'Dodanie arkusza',
      'xlsx.sheet.rename': 'Zmiana nazwy arkusza',
      'xlsx.sheet.delete': 'Usunięcie arkusza',
      'xlsx.sheet.duplicate': 'Duplikacja arkusza',
      'xlsx.sheet.reorder': 'Zmiana kolejności arkuszy',
    };
    return labels[commandId] ?? commandId.replace(/^xlsx\./, '').replaceAll('.', ' · ');
  };

  const versionsPanel = (
    <div className="min-h-0 flex-1 overflow-auto p-2" data-testid="spreadsheet-versions-panel">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-c-text">Historia wersji</h3>
          <p className="text-xs text-c-text-muted">Bieżąca wersja: {version}</p>
        </div>
        <button
          type="button"
          disabled={revisionState === 'loading' || revisionState === 'restoring'}
          onClick={() => void loadRevisions()}
          className="min-h-10 rounded-lg border border-c-border px-3 text-xs text-c-text-secondary hover:bg-c-surface disabled:opacity-40"
        >
          Odśwież
        </button>
      </div>
      {revisionState === 'loading' ? (
        <p className="text-sm text-c-text-secondary">Wczytywanie historii…</p>
      ) : revisionState === 'error' ? (
        <div
          role="alert"
          className="rounded-lg border border-c-danger/40 p-3 text-sm text-c-danger"
        >
          Nie udało się wczytać lub przywrócić wersji. Odśwież historię i spróbuj ponownie.
        </div>
      ) : revisions.length ? (
        <ol className="space-y-2">
          {revisions.map((revision) => (
            <li key={revision.id} className="rounded-lg border border-c-border bg-c-surface p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-c-text">
                    Wersja {revision.version}
                    {revision.version === version ? ' · bieżąca' : ''}
                  </p>
                  <p className="mt-1 text-xs text-c-text-secondary">
                    {revisionLabel(revision.command_id)}
                  </p>
                  <p className="mt-1 text-xs text-c-text-muted">
                    {revision.created_by} · {new Date(revision.created_at).toLocaleString('pl-PL')}
                  </p>
                </div>
                {revision.version !== version ? (
                  <button
                    type="button"
                    disabled={revisionState === 'restoring'}
                    onClick={() => void restoreRevision(revision.version)}
                    className="min-h-10 shrink-0 rounded-lg border border-c-border px-3 text-xs font-medium text-c-text hover:bg-c-surface-raised disabled:opacity-40"
                  >
                    Przywróć
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="rounded-lg border border-c-border p-3 text-sm text-c-text-secondary">
          Brak zapisanych rewizji skoroszytu.
        </div>
      )}
    </div>
  );

  const leftRail = (
    <div className="flex min-h-0 flex-1 flex-col p-2" data-testid="spreadsheet-sheets-panel">
      <div className="mb-2 grid grid-cols-5 gap-1 rounded-lg bg-c-surface p-1" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={leftMode === 'sheets'}
          onClick={() => setLeftMode('sheets')}
          className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md text-xs font-medium ${leftMode === 'sheets' ? 'bg-c-surface-raised text-c-text' : 'text-c-text-muted'}`}
        >
          <Files size={14} aria-hidden="true" /> Arkusze
        </button>
        <button
          type="button"
          role="tab"
          aria-label="Źródła i założenia"
          aria-selected={leftMode === 'sources'}
          onClick={() => setLeftMode('sources')}
          className={`inline-flex min-h-10 items-center justify-center rounded-md text-xs font-medium ${leftMode === 'sources' ? 'bg-c-surface-raised text-c-text' : 'text-c-text-muted'}`}
        >
          <SearchCheck size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          role="tab"
          aria-label="Kontrola jakości"
          aria-selected={leftMode === 'qa'}
          onClick={() => setLeftMode('qa')}
          className={`inline-flex min-h-10 items-center justify-center rounded-md text-xs font-medium ${leftMode === 'qa' ? 'bg-c-surface-raised text-c-text' : 'text-c-text-muted'}`}
        >
          <ShieldCheck size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={leftMode === 'comments'}
          onClick={() => setLeftMode('comments')}
          className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md text-xs font-medium ${leftMode === 'comments' ? 'bg-c-surface-raised text-c-text' : 'text-c-text-muted'}`}
        >
          <MessageSquare size={14} aria-hidden="true" /> Komentarze
        </button>
        <button
          type="button"
          role="tab"
          aria-label="Historia wersji"
          aria-selected={leftMode === 'versions'}
          onClick={() => setLeftMode('versions')}
          className={`inline-flex min-h-10 items-center justify-center rounded-md text-xs font-medium ${leftMode === 'versions' ? 'bg-c-surface-raised text-c-text' : 'text-c-text-muted'}`}
        >
          <History size={14} aria-hidden="true" />
        </button>
      </div>
      {leftMode === 'sheets'
        ? sheetsPanel
        : leftMode === 'sources'
          ? sourcesPanel
          : leftMode === 'qa'
            ? qaPanel
            : leftMode === 'comments'
              ? commentsPanel
              : versionsPanel}
    </div>
  );

  const canvas = (
    <div
      className="relative h-full min-h-0 overflow-auto bg-c-canvas p-3"
      data-testid="spreadsheet-canvas"
    >
      {searchMode ? (
        <section
          role="search"
          aria-label={
            searchMode === 'replace' ? 'Znajdź i zamień w skoroszycie' : 'Znajdź w skoroszycie'
          }
          className="sticky right-0 top-0 z-30 mb-3 ml-auto w-full max-w-xl rounded-xl border border-c-border bg-c-surface-raised p-3 shadow-xl"
        >
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-c-text">
              <Search size={16} aria-hidden="true" />
              {searchMode === 'replace' ? 'Znajdź i zamień' : 'Znajdź'}
            </h2>
            <button
              type="button"
              aria-label="Zamknij wyszukiwanie"
              onClick={() => setSearchMode(null)}
              className="inline-flex size-10 items-center justify-center rounded-lg text-c-text-muted hover:bg-c-surface hover:text-c-text"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <input
              ref={searchInputRef}
              aria-label="Szukany tekst"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setSearchIndex(0);
                setSearchError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  focusSearchMatch(event.shiftKey ? searchIndex - 1 : searchIndex + 1);
                }
              }}
              placeholder="Wartość lub formuła"
              className="min-h-10 min-w-0 rounded-lg border border-c-border bg-c-surface px-3 text-sm text-c-text outline-none focus:border-c-focus-solid"
            />
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={!searchMatches.length}
                onClick={() => focusSearchMatch(searchIndex - 1)}
                className="inline-flex min-h-10 items-center rounded-lg border border-c-border px-3 text-xs text-c-text-secondary hover:bg-c-surface disabled:opacity-40"
              >
                Poprzedni
              </button>
              <button
                type="button"
                disabled={!searchMatches.length}
                onClick={() => focusSearchMatch(searchIndex + 1)}
                className="inline-flex min-h-10 items-center rounded-lg border border-c-border px-3 text-xs text-c-text-secondary hover:bg-c-surface disabled:opacity-40"
              >
                Następny
              </button>
            </div>
          </div>
          {searchMode === 'replace' ? (
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                aria-label="Zamień na"
                value={replacementText}
                onChange={(event) => setReplacementText(event.target.value)}
                placeholder="Nowa wartość"
                className="min-h-10 min-w-0 flex-1 rounded-lg border border-c-border bg-c-surface px-3 text-sm text-c-text outline-none focus:border-c-focus-solid"
              />
              <button
                type="button"
                disabled={!searchMatches.length}
                onClick={() => void replaceAllMatches()}
                className="min-h-10 rounded-lg bg-c-text px-4 text-sm font-medium text-c-surface disabled:opacity-40"
              >
                Zamień wszystko ({searchMatches.length})
              </button>
            </div>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-c-text-secondary">
            <select
              aria-label="Zakres wyszukiwania"
              value={searchScope}
              onChange={(event) => setSearchScope(event.target.value as 'sheet' | 'workbook')}
              className="min-h-9 rounded-lg border border-c-border bg-c-surface px-2"
            >
              <option value="sheet">Bieżący arkusz</option>
              <option value="workbook">Cały skoroszyt</option>
            </select>
            <label className="inline-flex min-h-9 items-center gap-2">
              <input
                type="checkbox"
                checked={matchCase}
                onChange={(event) => setMatchCase(event.target.checked)}
              />
              Wielkość liter
            </label>
            <label className="inline-flex min-h-9 items-center gap-2">
              <input
                type="checkbox"
                checked={wholeCell}
                onChange={(event) => setWholeCell(event.target.checked)}
              />
              Cała komórka
            </label>
            <span aria-live="polite">
              {searchQuery
                ? searchMatches.length
                  ? `${searchIndex + 1} z ${searchMatches.length}`
                  : 'Brak wyników'
                : 'Wpisz szukany tekst'}
            </span>
          </div>
          {searchError ? (
            <p role="alert" className="mt-2 text-xs text-c-danger">
              {searchError}
            </p>
          ) : null}
        </section>
      ) : null}
      {sheets.length ? (
        <div
          data-testid="spreadsheet-grid-zoom-surface"
          style={{
            transform: `scale(${zoomPercent / 100})`,
            transformOrigin: 'top left',
            width: `${10000 / zoomPercent}%`,
          }}
        >
          <EditableSpreadsheetGrid
            ref={gridRef}
            workbookId={workbookId}
            sheets={sheets}
            activeSheetIndex={activeSheet}
            onSelectionChange={setSelection}
            onSaveStateChange={setSaveState}
            onHistoryStateChange={setHistoryState}
            onSheetsChange={syncGridSheets}
            freezeFirstColumn={freezePanes}
            persistCell={persistCell}
            persistCells={persistCells}
            onSelectionContextMenu={setContextMenu}
          />
        </div>
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-c-text-secondary">
          Nie udało się wczytać komórek skoroszytu.
        </div>
      )}
    </div>
  );

  return (
    <>
      <ExecutiveModuleShell
        moduleKey="spreadsheet-studio"
        moduleLabel="Arkusze"
        title={workbookTitle}
        onTitleChange={(nextTitle) => void renameWorkbook(nextTitle)}
        onBack={() => navigate('/presentations?tab=sheets')}
        backLabel="Wróć do Materiałów"
        topBarChips={chips}
        topBarTitleTrailingSlot={
          <span className="text-xs text-c-text-muted" data-testid="spreadsheet-save-summary">
            {saveState === 'saving'
              ? 'Zapisywanie…'
              : saveState === 'error'
                ? 'Błąd zapisu'
                : 'Zapisano'}
          </span>
        }
        artifactStudioMode
        artifactMinCanvasWidth={650}
        leftRailTitle={
          leftMode === 'sheets'
            ? 'Arkusze'
            : leftMode === 'sources'
              ? 'Źródła i założenia'
              : leftMode === 'qa'
                ? 'Kontrola jakości'
                : leftMode === 'comments'
                  ? 'Komentarze'
                  : 'Historia wersji'
        }
        leftRailContent={leftRail}
        rightRailTools={[]}
        secondBar={
          <ArtifactMenu3
            registry={registry}
            context={commandContext}
            resolveLabel={(label) => label}
            ariaLabel="Narzędzia arkusza"
          />
        }
        canvas={canvas}
        bottomBar={
          <ArtifactBottomBar
            leading={
              selection?.address ??
              `${sheetNames[activeSheet] ?? 'Arkusz'} · ${activeSheet + 1}/${sheetNames.length}`
            }
            center={
              selectionStats ? (
                <span aria-label="Statystyki zaznaczenia">
                  Suma: {formatSelectionStat(selectionStats.sum)} · Średnia:{' '}
                  {formatSelectionStat(selectionStats.average)} · Licznik: {selectionStats.count}
                </span>
              ) : null
            }
            trailing={
              <>
                <div className="flex items-center" aria-label="Powiększenie arkusza">
                  <button
                    type="button"
                    aria-label="Pomniejsz arkusz"
                    disabled={zoomPercent <= 50}
                    onClick={() => setZoomPercent((value) => Math.max(50, value - 10))}
                    className="inline-flex size-8 items-center justify-center rounded-md text-c-text-secondary hover:bg-c-surface-raised disabled:opacity-40"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    aria-label="Dopasuj arkusz"
                    onClick={() => setZoomPercent(100)}
                    className="min-h-8 min-w-12 rounded-md px-1 text-c-text-secondary hover:bg-c-surface-raised"
                  >
                    {zoomPercent}%
                  </button>
                  <button
                    type="button"
                    aria-label="Powiększ arkusz"
                    disabled={zoomPercent >= 200}
                    onClick={() => setZoomPercent((value) => Math.min(200, value + 10))}
                    className="inline-flex size-8 items-center justify-center rounded-md text-c-text-secondary hover:bg-c-surface-raised disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => openTeresa()}
                  className="inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-c-text-secondary hover:bg-c-surface-raised hover:text-c-text"
                >
                  <Sparkles size={14} aria-hidden="true" />
                  <span>Teresa</span>
                </button>
              </>
            }
          />
        }
        testId="spreadsheet-artifact-studio"
      />
      {governanceDialog ? (
        <div
          className="fixed inset-0 z-overlay flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target && governanceState !== 'saving') {
              setGovernanceDialog(null);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="workbook-governance-title"
            className="w-full max-w-md rounded-xl border border-c-border bg-c-surface p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="workbook-governance-title" className="text-base font-semibold text-c-text">
                  {governanceDialog === 'classification'
                    ? 'Klasyfikacja skoroszytu'
                    : 'Status skoroszytu'}
                </h2>
                <p className="mt-1 text-sm text-c-text-secondary">
                  {governanceDialog === 'classification'
                    ? 'Publiczny link jest dostępny wyłącznie dla materiałów publicznych.'
                    : 'Zatwierdzenie i status finalny wymagają aktualnej akceptacji.'}
                </p>
              </div>
              <button
                type="button"
                aria-label="Zamknij"
                disabled={governanceState === 'saving'}
                onClick={() => setGovernanceDialog(null)}
                className="inline-flex size-10 items-center justify-center rounded-lg text-c-text-secondary hover:bg-c-surface-raised"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="mt-5 grid gap-2">
              {(governanceDialog === 'classification'
                ? [
                    ['public', 'Publiczny'],
                    ['internal', 'Wewnętrzny'],
                    ['confidential', 'Poufny'],
                  ]
                : [
                    ['draft', 'Szkic'],
                    ['final', 'Finalny'],
                  ]
              ).map(([value, label]) => {
                const requiresApproval =
                  governanceDialog === 'lifecycleStatus' &&
                  value === 'final' &&
                  !(approvalState?.currentForVersion ?? preview.workbookApprovalCurrent);
                return (
                  <button
                    key={value}
                    type="button"
                    disabled={governanceState === 'saving' || requiresApproval}
                    title={requiresApproval ? 'Najpierw uzyskaj aktualne zatwierdzenie' : undefined}
                    onClick={() =>
                      void updateGovernance(
                        governanceDialog,
                        value as Parameters<typeof updateGovernance>[1]
                      )
                    }
                    className="flex min-h-11 items-center justify-between rounded-lg border border-c-border px-3 text-left text-sm text-c-text hover:bg-c-surface-raised disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <span>{label}</span>
                    {(governanceDialog === 'classification' ? classification : lifecycleStatus) ===
                    value ? (
                      <span className="text-xs text-c-focus-solid">Aktualny</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            {governanceDialog === 'lifecycleStatus' ? (
              <div className="mt-4 space-y-3 border-t border-c-border pt-4">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-c-text-secondary">Obieg zatwierdzania</span>
                  <span className="rounded-md bg-c-surface-raised px-2 py-1 text-xs text-c-text">
                    {approvalState?.state === 'review'
                      ? 'W przeglądzie'
                      : approvalState?.state === 'approved' && approvalState.currentForVersion
                        ? 'Aktualne zatwierdzenie'
                        : approvalState?.state === 'approved'
                          ? 'Zatwierdzenie nieaktualne'
                          : approvalState?.state === 'rejected'
                            ? 'Zwrócony do poprawy'
                            : 'Nieprzekazany'}
                  </span>
                </div>

                {lifecycleStatus === 'draft' || approvalState?.state === 'rejected' ? (
                  <div className="space-y-2">
                    <label className="block text-sm text-c-text-secondary">
                      Wybierz recenzenta
                      <input
                        type="search"
                        value={reviewerSearch}
                        onChange={(event) => setReviewerSearch(event.target.value)}
                        placeholder="Szukaj po nazwie lub e-mailu"
                        className="mt-2 h-10 w-full rounded-lg border border-c-border bg-c-surface-raised px-3 text-sm text-c-text outline-none focus:border-c-focus-solid"
                      />
                    </label>
                    <div className="max-h-36 space-y-1 overflow-y-auto">
                      {reviewUsers
                        .filter((user) => {
                          const query = reviewerSearch.trim().toLocaleLowerCase('pl');
                          if (!query) return true;
                          return `${reviewUserName(user)} ${user.email || ''}`
                            .toLocaleLowerCase('pl')
                            .includes(query);
                        })
                        .slice(0, 8)
                        .map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => setSelectedReviewerId(user.id)}
                            className={`flex min-h-11 w-full items-center justify-between rounded-lg border px-3 text-left text-sm ${
                              selectedReviewerId === user.id
                                ? 'border-c-focus bg-c-focus/10 text-c-focus-solid'
                                : 'border-c-border text-c-text-secondary hover:bg-c-surface-raised'
                            }`}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-c-text">
                                {reviewUserName(user)}
                              </span>
                              {user.email ? (
                                <span className="block truncate text-xs">{user.email}</span>
                              ) : null}
                            </span>
                            {selectedReviewerId === user.id ? (
                              <Check size={16} aria-hidden="true" />
                            ) : null}
                          </button>
                        ))}
                      {!reviewUsers.length ? (
                        <p className="rounded-lg border border-c-border p-3 text-sm text-c-text-secondary">
                          Brak dostępnego recenzenta innego niż autor.
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      disabled={!selectedReviewerId || governanceState === 'saving'}
                      onClick={() => void submitForReview()}
                      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-c-text px-4 text-sm font-medium text-c-surface disabled:opacity-45"
                    >
                      <Send size={16} aria-hidden="true" />
                      Przekaż do przeglądu
                    </button>
                  </div>
                ) : null}

                {approvalState?.state === 'review' ? (
                  <div className="space-y-2">
                    <button
                      type="button"
                      disabled={governanceState === 'saving'}
                      onClick={() => void decideReview('approve')}
                      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-c-success px-4 text-sm font-medium text-white disabled:opacity-45"
                    >
                      <Check size={16} aria-hidden="true" />
                      Zatwierdź
                    </button>
                    <label className="block text-sm text-c-text-secondary">
                      Powód zwrotu do poprawy
                      <textarea
                        value={rejectionReason}
                        onChange={(event) => setRejectionReason(event.target.value)}
                        className="mt-2 min-h-20 w-full resize-y rounded-lg border border-c-border bg-c-surface-raised p-3 text-sm text-c-text outline-none focus:border-c-focus-solid"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={!rejectionReason.trim() || governanceState === 'saving'}
                      onClick={() => void decideReview('reject')}
                      className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-c-danger px-4 text-sm font-medium text-c-danger disabled:opacity-45"
                    >
                      Zwróć do poprawy
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
            {governanceDialog === 'classification' ? (
              <label className="mt-4 block text-sm text-c-text-secondary">
                Uzasadnienie obniżenia klasyfikacji
                <textarea
                  value={governanceReason}
                  onChange={(event) => setGovernanceReason(event.target.value)}
                  placeholder="Wymagane przy zmianie na mniej restrykcyjną"
                  className="mt-2 min-h-20 w-full resize-y rounded-lg border border-c-border bg-c-surface-raised p-3 text-sm text-c-text outline-none focus:border-c-focus-solid"
                />
              </label>
            ) : null}
            {governanceState === 'error' ? (
              <p role="alert" className="mt-3 text-sm text-c-danger">
                Zmiana została odrzucona przez politykę lub wystąpił konflikt wersji.
              </p>
            ) : null}
          </section>
        </div>
      ) : null}
      {contextMenu ? (
        <CanvasContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
          ariaLabel={`Akcje zaznaczenia ${contextMenu.selection.address}`}
          header={
            <span className="text-xs font-medium text-c-text-secondary">
              {contextMenu.selection.address}
            </span>
          }
          testId="spreadsheet-selection-context-menu"
        />
      ) : null}
    </>
  );
};

export default SpreadsheetArtifactStudio;
