/**
 * PromptRegistryTab - Development > Prompt Registry (Oxford O5.5)
 *
 * Read-only SuperAdmin surface over the code-level AI prompt registry
 * (server/src/ai/promptRegistry.ts) via GET /api/admin/prompts/registry —
 * gated server-side behind the `ai_ops` superadmin capability. Shows the
 * inventory (18 prompt assets as of O5.5) with checksum drift status; NEVER
 * fetches or displays prompt bodies (some encode proprietary consulting
 * doctrine — see the route's own doc comment).
 *
 * Kanon TRIADA: list of entities → StandardModuleBar (Menu 2 search + Menu 3
 * status chips) + StandardTable + StandardPreview. No bulk/CTA — the surface
 * is read-only by design (bump `version`/`lastReviewed` in the registry file
 * itself, not from this screen).
 *
 * Behind `promptRegistryUi` (default OFF) — see useFeatureFlags DEFAULT_FLAGS.
 * Vegas polishes the visual pass later; this wave wires function only.
 */
import { BookMarked, CheckCircle2, Fingerprint, ShieldAlert } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState } from '@/components/Admin/AdminState';
import { LoadingState } from '@/components/shared/states';
import {
  StandardModuleBar,
  StandardPreview,
  type StandardRowMenu,
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard';
import { JedenPrawyPanel } from '@/components/shared/PreviewPane/JedenPrawyPanel';
import { useJedenPanel } from '@/components/shared/PreviewPane/useJedenPanel';
import { Api } from '@/services/api';
import { normalizeApiErrorMessage } from '@/utils/apiError';
import { cn } from '@/utils/cn';

type PromptChecksumStatus = 'ok' | 'drifted' | 'unverifiable';

interface PromptRegistryRow {
  id: string;
  module: string;
  version: string;
  owner: string;
  path: string;
  exportName?: string;
  description: string;
  languages: string[];
  lastReviewed: string;
  managed: boolean;
  checksumStatus: PromptChecksumStatus;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getObjectPayload = (value: unknown): unknown => {
  if (!isRecord(value)) return value;
  const data = isRecord(value.data) ? value.data : null;
  return data && (isRecord(data.data) || Array.isArray(data.data)) ? data.data : data || value;
};

const asText = (value: unknown, fallback = ''): string =>
  typeof value === 'string' && value.trim() ? value : fallback;

const normalizeRegistry = (value: unknown): { prompts: PromptRegistryRow[]; drifted: string[] } => {
  const payload = getObjectPayload(value);
  if (!isRecord(payload) || !Array.isArray(payload.prompts)) {
    throw new Error('Prompt registry response was not a list');
  }
  const prompts = payload.prompts.filter(isRecord).map((row) => ({
    id: asText(row.id, 'unknown'),
    module: asText(row.module, 'unknown'),
    version: asText(row.version, '—'),
    owner: asText(row.owner, 'unknown'),
    path: asText(row.path, ''),
    exportName: typeof row.exportName === 'string' ? row.exportName : undefined,
    description: asText(row.description, ''),
    languages: Array.isArray(row.languages) ? row.languages.map((l) => asText(l, '')) : [],
    lastReviewed: asText(row.lastReviewed, ''),
    managed: row.managed === true,
    checksumStatus: (['ok', 'drifted', 'unverifiable'] as const).includes(
      row.checksumStatus as PromptChecksumStatus
    )
      ? (row.checksumStatus as PromptChecksumStatus)
      : 'unverifiable',
  }));
  const drifted = Array.isArray(payload.drifted)
    ? payload.drifted.filter((d): d is string => typeof d === 'string')
    : [];
  return { prompts, drifted };
};

const CHECKSUM_TONE: Record<PromptChecksumStatus, string> = {
  ok: 'bg-success-500/15 text-success-700 dark:text-success-400',
  drifted: 'bg-danger-500/15 text-danger-600 dark:text-danger-400',
  unverifiable: 'bg-c-surface-raised text-c-text-secondary',
};

const CHECKSUM_LABEL: Record<PromptChecksumStatus, string> = {
  ok: 'OK',
  drifted: 'Drifted',
  unverifiable: 'Unverifiable',
};

const CHECKSUM_PILL_TONE: Record<PromptChecksumStatus, 'success' | 'danger' | 'neutral'> = {
  ok: 'success',
  drifted: 'danger',
  unverifiable: 'neutral',
};

type ChecksumFilter = 'all' | PromptChecksumStatus;

export const PromptRegistryTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PromptRegistryRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [checksumFilter, setChecksumFilter] = useState<ChecksumFilter>('all');
  // DEC-397b (1.1-K6): klik wiersza / kebab „Podgląd" po zamknięciu panelu
  // (X) mają go ponownie otworzyć — patrz InboxContent.tsx (K5, 2f5161f3b4).
  const jedenPanel = useJedenPanel();
  const [previewId, setPreviewId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await Api.get('/api/admin/prompts/registry');
      const { prompts } = normalizeRegistry(res);
      setRows(prompts);
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Failed to load prompt registry');
      setRows([]);
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const chipCounts = useMemo(
    () => ({
      all: rows.length,
      ok: rows.filter((r) => r.checksumStatus === 'ok').length,
      drifted: rows.filter((r) => r.checksumStatus === 'drifted').length,
      unverifiable: rows.filter((r) => r.checksumStatus === 'unverifiable').length,
    }),
    [rows]
  );

  const filteredRows = useMemo(() => {
    let next = rows;
    if (checksumFilter !== 'all') {
      next = next.filter((r) => r.checksumStatus === checksumFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      next = next.filter(
        (r) =>
          r.id.toLowerCase().includes(q) ||
          r.module.toLowerCase().includes(q) ||
          r.owner.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q)
      );
    }
    return next;
  }, [rows, search, checksumFilter]);

  const tableRows = useMemo<TableRow[]>(() => filteredRows.map((r) => ({ ...r })), [filteredRows]);

  const previewRow = previewId ? (rows.find((r) => r.id === previewId) ?? null) : null;

  const columns = useMemo<TableColumn[]>(
    () => [
      {
        id: 'id',
        label: 'ID',
        sortable: true,
        render: (row: TableRow) => (
          <span className="font-mono text-xs text-c-text">{row.id as string}</span>
        ),
      },
      {
        id: 'module',
        label: 'Module',
        width: '170px',
        sortable: true,
        render: (row: TableRow) => (
          <span className="text-c-text-secondary">{row.module as string}</span>
        ),
      },
      {
        id: 'version',
        label: 'Version',
        width: '90px',
        align: 'center',
        sortable: true,
        render: (row: TableRow) => (
          <span className="font-mono text-xs text-c-text-secondary">{row.version as string}</span>
        ),
      },
      {
        id: 'owner',
        label: 'Owner',
        width: '150px',
        sortable: true,
        render: (row: TableRow) => (
          <span className="text-c-text-secondary">{row.owner as string}</span>
        ),
      },
      {
        id: 'lastReviewed',
        label: 'Last reviewed',
        width: '130px',
        sortable: true,
        render: (row: TableRow) => (
          <span className="text-sm text-c-text-secondary">{row.lastReviewed as string}</span>
        ),
      },
      {
        id: 'checksumStatus',
        label: 'Checksum',
        width: '130px',
        align: 'center',
        sortable: true,
        filterable: true,
        filterOptions: [
          { value: 'ok', label: 'OK' },
          { value: 'drifted', label: 'Drifted' },
          { value: 'unverifiable', label: 'Unverifiable' },
        ],
        render: (row: TableRow) => {
          const status = row.checksumStatus as PromptChecksumStatus;
          return (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                CHECKSUM_TONE[status]
              )}
            >
              {status === 'ok' ? (
                <CheckCircle2 className="w-3 h-3" />
              ) : status === 'drifted' ? (
                <ShieldAlert className="w-3 h-3" />
              ) : (
                <Fingerprint className="w-3 h-3" />
              )}
              {CHECKSUM_LABEL[status]}
            </span>
          );
        },
      },
    ],
    []
  );

  const rowMenu = useCallback((row: TableRow): StandardRowMenu => {
    const prompt = row as unknown as PromptRegistryRow;
    return {
      universalHandlers: {
        preview: () => {
          jedenPanel.otworz();
          setPreviewId(prompt.id);
        },
      },
      destructive: { note: 'Read-only registry — edit server/src/ai/promptRegistry.ts to change' },
    };
  }, []);

  if (loading && rows.length === 0) {
    return <LoadingState template="list" className="py-12" />;
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <StandardModuleBar
        onSearch={setSearch}
        searchValue={search}
        chips={[
          { id: 'all', label: 'All', count: chipCounts.all },
          { id: 'ok', label: 'OK', count: chipCounts.ok, dot: 'bg-success-500' },
          { id: 'drifted', label: 'Drifted', count: chipCounts.drifted, dot: 'bg-danger-500' },
          {
            id: 'unverifiable',
            label: 'Unverifiable',
            count: chipCounts.unverifiable,
            dot: 'bg-c-text-muted',
          },
        ]}
        activeChip={checksumFilter}
        onChipChange={(id) => setChecksumFilter(id as ChecksumFilter)}
      />

      {loadError ? (
        <div className="p-6">
          <DegradedState title="Prompt registry unavailable" description={loadError} />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="flex-1 min-w-0 overflow-auto">
            <StandardTable
              columns={columns}
              data={tableRows}
              empty={{
                icon: BookMarked,
                title: 'No prompt assets match this filter',
              }}
              selectedRowId={previewId}
              onRowClick={(row) => {
                jedenPanel.otworz();
                setPreviewId(String(row.id));
              }}
              rowMenu={rowMenu}
              persistKey="superadmin.aiPlatform.promptRegistry"
            />
          </div>

          <JedenPrawyPanel rekord={previewRow ? (
              <StandardPreview
                title={previewRow.id}
                onClose={() => setPreviewId(null)}
                meta={{
                  pills: [
                    { label: previewRow.module, tone: 'neutral' },
                    { label: previewRow.owner, tone: 'neutral' },
                    {
                      label: CHECKSUM_LABEL[previewRow.checksumStatus],
                      tone: CHECKSUM_PILL_TONE[previewRow.checksumStatus],
                    },
                  ],
                  trailing: (
                    <span className="text-xs text-c-text-secondary">v{previewRow.version}</span>
                  ),
                }}
                details={{
                  text: [
                    previewRow.description,
                    `Source: ${previewRow.path}${previewRow.exportName ? `#${previewRow.exportName}` : ''}`,
                    `Languages: ${previewRow.languages.length ? previewRow.languages.join(', ') : '—'}`,
                    `Last reviewed: ${previewRow.lastReviewed || '—'}`,
                    `Managed (centralized template): ${previewRow.managed ? 'yes' : 'no'}`,
                  ]
                    .filter(Boolean)
                    .join('\n\n'),
                  onCopy: () => {
                    void navigator.clipboard?.writeText(previewRow.id);
                  },
                }}
              />
          ) : null} />
        </div>
      )}
    </div>
  );
};

export default PromptRegistryTab;
