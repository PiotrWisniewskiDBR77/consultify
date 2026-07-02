/**
 * NotebookLibraryContent — Level 1 of the Notebook module.
 *
 * Lists the notebooks (Notatniki) the user can access before they open one.
 * Rendered as an App Table per docs/ui-standards/03-modules/app-table-standard.md
 * (reuses ResizableTable + RowActionsMenu, the Decisions/Ideas canon). The
 * primary "New notebook" CTA lives in Menu 2 (MyWorkHub), not in this body.
 * See docs/product/NOTEBOOK_STRUCTURE_SSOT.md.
 */

import { Archive, BookOpen, ChevronRight, Globe, Lock, Pencil, Trash2, Users } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { type RowActionSection, RowActionsMenu } from '@/components/shared/RowActionsMenu';
import {
  type ColumnDef,
  type ColumnWidths,
  ResizableTable,
  type TableFilters,
} from '@/components/ui/ResizableTable';
import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import type { Notebook, NotebookContextSharing, NotebookScope } from '@/types/myWork';

interface NotebookLibraryContentProps {
  searchQuery?: string;
  refreshTrigger?: number;
  /** Incremented by the Menu 2 "New notebook" CTA to open the create modal. */
  createRequestId?: number;
  /** Scope preset selected in Menu 3 (Command Row). Owns scope filtering. */
  scopeFilter?: 'all' | 'personal' | 'team';
  /** Reports total/personal/team counts up to the Menu 3 chips. */
  onScopeCountsChange?: (counts: { all: number; personal: number; team: number }) => void;
  onOpenNotebook: (notebook: Notebook) => void;
}

interface TeamOption {
  id: string;
  name: string;
}

type ModalState = { mode: 'create' } | { mode: 'edit'; notebook: Notebook } | null;

const formatRelative = (iso: string | null, pl: boolean): string => {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '—';
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return pl ? 'przed chwilą' : 'just now';
  if (mins < 60) return pl ? `${mins} min temu` : `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return pl ? `${hrs} godz. temu` : `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return pl ? `${days} dni temu` : `${days}d ago`;
  return new Date(iso).toLocaleDateString(pl ? 'pl-PL' : 'en-US');
};

const buildColumns = (pl: boolean): ColumnDef[] => [
  {
    id: 'title',
    label: pl ? 'Notatnik' : 'Notebook',
    width: 440,
    minWidth: 260,
    maxWidth: 900,
    resizable: true,
    filterable: false,
  },
  {
    // Scope filtering lives in Menu 3 (Command Row) presets, so the header
    // filter is intentionally omitted here to avoid duplicate controls.
    id: 'scope',
    label: pl ? 'Typ' : 'Type',
    width: 150,
    minWidth: 110,
    maxWidth: 200,
    resizable: true,
    filterable: false,
  },
  {
    id: 'context',
    label: pl ? 'Kontekst' : 'Context',
    width: 170,
    minWidth: 120,
    maxWidth: 230,
    resizable: true,
    filterable: true,
    filterType: 'multiselect',
    filterOptions: [
      { value: 'private', label: pl ? 'Prywatny' : 'Private' },
      { value: 'org_context', label: pl ? 'Kontekst org' : 'Org context' },
    ],
  },
  {
    id: 'notes',
    label: pl ? 'Notatki' : 'Notes',
    width: 110,
    minWidth: 80,
    maxWidth: 150,
    resizable: true,
    filterable: false,
    // canon §3.3 — numeric counts align right.
    align: 'right',
  },
  {
    id: 'date',
    label: pl ? 'Zmieniono' : 'Updated',
    width: 140,
    minWidth: 100,
    maxWidth: 190,
    resizable: true,
    filterable: false,
    // canon §3.3 — dates align left.
    align: 'left',
  },
  {
    id: 'actions',
    label: '',
    width: 56,
    minWidth: 56,
    maxWidth: 56,
    resizable: false,
    filterable: false,
    align: 'right',
  },
];

export const NotebookLibraryContent: React.FC<NotebookLibraryContentProps> = ({
  searchQuery = '',
  refreshTrigger,
  createRequestId,
  scopeFilter = 'all',
  onScopeCountsChange,
  onOpenNotebook,
}) => {
  const { i18n } = useTranslation();
  const pl = (i18n.language || '').toLowerCase().startsWith('pl');
  const currentUserId = useAppStore((s) => (s as any).currentUser?.id as string | undefined);

  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);

  const columns = useMemo(() => buildColumns(pl), [pl]);
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(() =>
    buildColumns(pl).reduce((acc, c) => ({ ...acc, [c.id]: c.width }), {})
  );
  const [tableFilters, setTableFilters] = useState<TableFilters>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const rows = await Api.getNotebooks();
      setNotebooks(Array.isArray(rows) ? (rows as Notebook[]) : []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshTrigger]);

  // Menu 2 CTA → open create modal (skip the initial 0).
  const prevCreateReq = useRef(createRequestId);
  useEffect(() => {
    if (createRequestId !== undefined && createRequestId !== prevCreateReq.current) {
      prevCreateReq.current = createRequestId;
      setModal({ mode: 'create' });
    }
  }, [createRequestId]);

  // Report scope counts (from the full set) up to the Menu 3 chips.
  useEffect(() => {
    const personal = notebooks.filter((n) => n.scope === 'personal').length;
    const team = notebooks.filter((n) => n.scope === 'team').length;
    onScopeCountsChange?.({ all: notebooks.length, personal, team });
  }, [notebooks, onScopeCountsChange]);

  const rows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const contextFilter = (tableFilters.context as string[] | undefined) || [];
    return notebooks.filter((n) => {
      if (q && !(n.title || '').toLowerCase().includes(q)) return false;
      if (scopeFilter !== 'all' && n.scope !== scopeFilter) return false;
      if (contextFilter.length && !contextFilter.includes(n.contextSharing)) return false;
      return true;
    });
  }, [notebooks, searchQuery, scopeFilter, tableFilters]);

  const handleSaved = useCallback(
    (nb: Notebook, mode: 'create' | 'edit') => {
      setModal(null);
      if (mode === 'create') {
        setNotebooks((prev) => [nb, ...prev]);
        onOpenNotebook(nb);
      } else {
        setNotebooks((prev) => prev.map((x) => (x.id === nb.id ? { ...x, ...nb } : x)));
      }
    },
    [onOpenNotebook]
  );

  const handleDelete = useCallback(
    async (nb: Notebook) => {
      const ok = window.confirm(
        pl
          ? `Usunąć notatnik „${nb.title}”? Tej operacji nie można cofnąć.`
          : `Delete notebook "${nb.title}"? This cannot be undone.`
      );
      if (!ok) return;
      try {
        await Api.deleteNotebook(nb.id);
        setNotebooks((prev) => prev.filter((x) => x.id !== nb.id));
        toast.success(pl ? 'Notatnik usunięty' : 'Notebook deleted');
      } catch (e: any) {
        if (e?.status === 409) {
          toast.error(
            pl
              ? 'Notatnik nie jest pusty — najpierw usuń lub przenieś notatki.'
              : 'Notebook is not empty — remove or move its notes first.'
          );
        } else {
          toast.error(pl ? 'Nie udało się usunąć notatnika' : 'Failed to delete notebook');
        }
      }
    },
    [pl]
  );

  // canon §9.2 — Fixed Bottom Manifest. Notebooks have no `due_date`, so the
  // Delay slot (pos. 4) is N/A and omitted. Archive has no backend endpoint yet
  // → disabled slot (never silently dropped). Delete is the hard/danger verb.
  const rowActions = useCallback(
    (nb: Notebook): RowActionSection[] => {
      const isOwner = !!currentUserId && nb.ownerUserId === currentUserId;
      const sections: RowActionSection[] = [
        {
          id: 'context',
          kind: 'context',
          actions: [
            {
              id: 'open',
              label: pl ? 'Otwórz' : 'Open',
              icon: BookOpen,
              variant: 'primary',
              onClick: () => onOpenNotebook(nb),
            },
          ],
        },
        {
          id: 'fixed',
          kind: 'manage',
          actions: [
            {
              id: 'open-preview',
              label: pl ? 'Otwórz podgląd' : 'Open preview',
              icon: ChevronRight,
              onClick: () => onOpenNotebook(nb),
            },
            {
              id: 'edit',
              label: pl ? 'Edytuj' : 'Edit',
              icon: Pencil,
              disabled: !isOwner,
              onClick: () => setModal({ mode: 'edit', notebook: nb }),
            },
            {
              id: 'archive',
              label: pl ? 'Archiwizuj' : 'Archive',
              icon: Archive,
              disabled: true,
              description: pl ? 'Wkrótce (backend)' : 'Coming soon (backend)',
              onClick: () => {},
            },
          ],
        },
      ];
      if (isOwner) {
        sections.push({
          id: 'danger',
          kind: 'danger',
          actions: [
            {
              id: 'delete',
              label: pl ? 'Usuń' : 'Delete',
              icon: Trash2,
              variant: 'danger',
              onClick: () => void handleDelete(nb),
            },
          ],
        });
      }
      return sections;
    },
    [currentUserId, pl, onOpenNotebook, handleDelete]
  );

  return (
    <div className="flex flex-col h-full bg-c-bg">
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
        {loading ? (
          <ResizableTable
            columns={columns}
            showSelectColumn={false}
            filters={tableFilters}
            onFilterChange={setTableFilters}
            onColumnWidthChange={(id, w) => setColumnWidths((prev) => ({ ...prev, [id]: w }))}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <tr key={`sk-${i}`} className="border-b border-c-border-subtle" aria-hidden="true">
                <td style={{ width: columnWidths.title }} className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <span className="h-5 w-5 shrink-0 rounded-md bg-c-border-subtle animate-pulse" />
                    <span className="h-3.5 w-40 rounded bg-c-border-subtle animate-pulse" />
                  </div>
                </td>
                <td style={{ width: columnWidths.scope }} className="px-3 py-3">
                  <span className="block h-4 w-16 rounded-full bg-c-border-subtle animate-pulse" />
                </td>
                <td style={{ width: columnWidths.context }} className="px-3 py-3">
                  <span className="block h-4 w-20 rounded-full bg-c-border-subtle animate-pulse" />
                </td>
                <td style={{ width: columnWidths.notes }} className="px-3 py-3 text-right">
                  <span className="ml-auto block h-3.5 w-8 rounded bg-c-border-subtle animate-pulse" />
                </td>
                <td style={{ width: columnWidths.date }} className="px-3 py-3 text-right">
                  <span className="ml-auto block h-3.5 w-16 rounded bg-c-border-subtle animate-pulse" />
                </td>
                <td style={{ width: columnWidths.actions }} className="px-3 py-3" />
              </tr>
            ))}
          </ResizableTable>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-c-text-muted mb-3">
              {pl ? 'Nie udało się wczytać notatników.' : 'Failed to load notebooks.'}
            </p>
            <button
              type="button"
              onClick={() => void load()}
              className="text-sm text-slate-600 hover:underline"
            >
              {pl ? 'Spróbuj ponownie' : 'Retry'}
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen size={40} className="mx-auto text-c-text-muted mb-3" />
            <p className="text-c-text-secondary font-medium">
              {searchQuery || scopeFilter !== 'all' || Object.keys(tableFilters).length
                ? pl
                  ? 'Brak notatników pasujących do filtrów'
                  : 'No notebooks match your filters'
                : pl
                  ? 'Nie masz jeszcze żadnego notatnika'
                  : 'No notebooks yet'}
            </p>
          </div>
        ) : (
          <ResizableTable
            columns={columns}
            showSelectColumn={false}
            filters={tableFilters}
            onFilterChange={setTableFilters}
            onColumnWidthChange={(id, w) => setColumnWidths((prev) => ({ ...prev, [id]: w }))}
          >
            {rows.map((nb) => (
              <tr
                key={nb.id}
                onClick={() => onOpenNotebook(nb)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onOpenNotebook(nb);
                }}
                tabIndex={0}
                className="group cursor-pointer border-b border-c-border-subtle outline-none transition-colors hover:bg-slate-100/80 hover:shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] dark:hover:bg-white/[0.04] dark:hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)]"
              >
                {/* S1-U2a: Ideas-row anatomy — neutral icon tile + L2 title +
                    L5 meta subtitle (no oversized emoji as identity). */}
                <td style={{ width: columnWidths.title }} className="px-3 py-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-c-border-subtle bg-c-surface-raised">
                      {nb.icon && /\p{Emoji}/u.test(nb.icon) ? (
                        <span className="text-sm leading-none">{nb.icon}</span>
                      ) : (
                        <BookOpen size={14} className="text-c-text-muted" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {nb.title}
                      </div>
                      <div className="truncate text-[11px] leading-4 text-c-text-muted">
                        {nb.pageCount} {pl ? 'notatek' : 'notes'} ·{' '}
                        {formatRelative(nb.updatedAt, pl)}
                      </div>
                    </div>
                  </div>
                </td>
                <td style={{ width: columnWidths.scope }} className="px-3 py-2.5 text-left">
                  {nb.scope === 'team' ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-c-surface-raised text-c-text-secondary">
                      <Users size={11} />
                      {pl ? 'Zespół' : 'Team'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-c-surface-raised text-c-text-secondary">
                      <Lock size={11} />
                      {pl ? 'Osobisty' : 'Personal'}
                    </span>
                  )}
                </td>
                <td style={{ width: columnWidths.context }} className="px-3 py-2.5 text-left">
                  {nb.contextSharing === 'org_context' ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-c-surface-raised text-c-text-secondary">
                      <Globe size={11} />
                      {pl ? 'Kontekst org' : 'Org context'}
                    </span>
                  ) : (
                    <span className="text-c-text-muted">—</span>
                  )}
                </td>
                <td
                  style={{ width: columnWidths.notes }}
                  className="px-3 py-2.5 text-right text-sm text-c-text-muted"
                >
                  {nb.pageCount}
                </td>
                <td
                  style={{ width: columnWidths.date }}
                  className="px-3 py-2.5 text-left text-xs text-c-text-muted"
                >
                  {formatRelative(nb.updatedAt, pl)}
                </td>
                <td
                  style={{ width: columnWidths.actions }}
                  className="px-2 py-2.5 text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  <RowActionsMenu sections={rowActions(nb)} />
                </td>
              </tr>
            ))}
          </ResizableTable>
        )}
      </div>

      {modal && (
        <NotebookModal
          pl={pl}
          editing={modal.mode === 'edit' ? modal.notebook : null}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
};

// ── Create / edit modal ──────────────────────────────────────────────────────

interface NotebookModalProps {
  pl: boolean;
  editing: Notebook | null;
  onClose: () => void;
  onSaved: (nb: Notebook, mode: 'create' | 'edit') => void;
}

const NotebookModal: React.FC<NotebookModalProps> = ({ pl, editing, onClose, onSaved }) => {
  const isEdit = !!editing;
  const [title, setTitle] = useState(editing?.title || '');
  const [scope, setScope] = useState<NotebookScope>(editing?.scope || 'personal');
  const [teamId, setTeamId] = useState(editing?.teamId || '');
  const [contextSharing, setContextSharing] = useState<NotebookContextSharing>(
    editing?.contextSharing || 'private'
  );
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (scope !== 'team' || teams.length) return;
    void (async () => {
      try {
        const fetched = await Api.getTeams();
        const opts: TeamOption[] = (Array.isArray(fetched) ? fetched : [])
          .map((t: any) => ({ id: String(t.id), name: String(t.name || t.title || t.id) }))
          .filter((t: TeamOption) => t.id);
        setTeams(opts);
        if (opts.length && !teamId) setTeamId(opts[0].id);
      } catch {
        setTeams([]);
      }
    })();
  }, [scope, teams.length, teamId]);

  const canSave = title.trim().length > 0 && (scope !== 'team' || !!teamId) && !saving;

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        scope,
        teamId: scope === 'team' ? teamId : null,
        contextSharing,
      };
      const nb = isEdit
        ? await Api.updateNotebook(editing!.id, payload)
        : await Api.createNotebook(payload);
      onSaved(nb as Notebook, isEdit ? 'edit' : 'create');
    } catch (e: any) {
      // Surface the real server reason (e.g. "Only the owner can modify this
      // notebook", "Not a team member", HTTP 5xx) instead of swallowing it —
      // a bare catch made every failure read as an opaque "Failed to save".
      const fallback = isEdit
        ? pl
          ? 'Nie udało się zapisać notatnika'
          : 'Failed to save notebook'
        : pl
          ? 'Nie udało się utworzyć notatnika'
          : 'Failed to create notebook';
      const serverMessage = typeof e?.message === 'string' ? e.message.trim() : '';
      // Hide useless generic JS errors ("Failed to fetch", "Request failed") —
      // only append a message that actually tells the user what went wrong.
      const isUseful =
        serverMessage &&
        !/^failed to (fetch|save|create|update)/i.test(serverMessage) &&
        !/^request failed/i.test(serverMessage);
      toast.error(isUseful ? `${fallback}: ${serverMessage}` : fallback);
      setSaving(false);
    }
  }, [canSave, title, scope, teamId, contextSharing, isEdit, editing, onSaved, pl]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-c-surface shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-c-text mb-4">
          {isEdit
            ? pl
              ? 'Edytuj notatnik'
              : 'Edit notebook'
            : pl
              ? 'Nowy notatnik'
              : 'New notebook'}
        </h3>

        <label className="block text-sm font-medium text-c-text-secondary mb-1">
          {pl ? 'Nazwa' : 'Title'}
        </label>
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canSave) void handleSave();
          }}
          placeholder={pl ? 'np. Strategia 2026' : 'e.g. Strategy 2026'}
          className="w-full px-3 py-2 mb-4 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-slate-800 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-slate-500/30 focus:border-slate-500"
        />

        <span className="block text-sm font-medium text-c-text-secondary mb-1.5">
          {pl ? 'Typ' : 'Type'}
        </span>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            type="button"
            onClick={() => setScope('personal')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
              scope === 'personal'
                ? 'border-slate-500 bg-slate-50 dark:bg-slate-900/20 text-slate-700 dark:text-slate-300'
                : 'border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            <Lock size={15} />
            {pl ? 'Osobisty' : 'Personal'}
          </button>
          <button
            type="button"
            onClick={() => setScope('team')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
              scope === 'team'
                ? 'border-slate-500 bg-slate-50 dark:bg-slate-900/20 text-slate-700 dark:text-slate-300'
                : 'border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            <Users size={15} />
            {pl ? 'Zespół' : 'Team'}
          </button>
        </div>

        {scope === 'team' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-c-text-secondary mb-1">
              {pl ? 'Zespół' : 'Team'}
            </label>
            {teams.length ? (
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-slate-800 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-slate-500/30"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-c-text-muted">
                {pl ? 'Brak dostępnych zespołów' : 'No teams available'}
              </p>
            )}
          </div>
        )}

        <label className="flex items-start gap-2 mb-5 cursor-pointer">
          <input
            type="checkbox"
            checked={contextSharing === 'org_context'}
            onChange={(e) => setContextSharing(e.target.checked ? 'org_context' : 'private')}
            className="mt-0.5"
          />
          <span className="text-sm text-c-text-secondary">
            {pl
              ? 'Udostępnij treść do kontekstu AI organizacji'
              : 'Share content with organization AI context'}
            <span className="block text-xs text-c-text-muted">
              {pl
                ? 'Domyślnie wyłączone. Treść może zasilać pamięć/AI org po zatwierdzeniu.'
                : 'Off by default. Content may feed org memory/AI after approval.'}
            </span>
          </span>
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-c-text-secondary hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          >
            {pl ? 'Anuluj' : 'Cancel'}
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => void handleSave()}
            className="px-4 py-2 rounded-lg text-sm font-medium text-c-surface bg-c-text hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving
              ? pl
                ? 'Zapisywanie…'
                : 'Saving…'
              : isEdit
                ? pl
                  ? 'Zapisz'
                  : 'Save'
                : pl
                  ? 'Utwórz'
                  : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotebookLibraryContent;
