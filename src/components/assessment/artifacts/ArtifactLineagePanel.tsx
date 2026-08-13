/**
 * ArtifactLineagePanel — P0D "full history after a restart" surface.
 *
 * Renders `GET /api/method/sessions/:id/lineage`: session → revisions →
 * Output → Report/Presentation → Initiative Proposal. This is the answer to
 * the CLAUDE.md problem statement's "po restarcie użytkownik nie odnajduje
 * swoich zamrożonych Outputów, raportów, prezentacji ani propozycji
 * inicjatyw" — a single place that shows the WHOLE chain for one session,
 * not just one entity at a time.
 *
 * ★ The lineage endpoint's response shape was NOT agreed at field level at
 * the time this was written (the P0D brief describes it only in prose; see
 * `getSessionLineage`'s doc comment in methodCoreApi.ts — the corresponding
 * server route does not exist yet in this worktree). `normalizeLineage`
 * below therefore tries several plausible shapes (`{session, outputs,
 * reports, presentations, initiativeDrafts}` OR a flat `{nodes:[{kind,...}]}`
 * array) and falls back to an HONEST "couldn't read this" error state when
 * neither matches — it never guesses a structure and renders fabricated
 * content. This has not been exercised against a live matching server.
 *
 * This is a read-only lineage PANEL, not a list screen — it intentionally
 * does not use StandardTable (no sort/filter/resize semantics apply to a
 * fixed five-stage chain). It follows the same c-* token / neutral-active
 * discipline as the rest of Triada (no crimson, focus ring = c-focus).
 */
import { ChevronRight, FileText, GitBranch, Lightbulb, Presentation } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getSessionLineage, isAuthError } from '@/method-core/api/methodCoreApi';
import { formatListDate } from '@/utils/listDateFormat';

import { EmptyState, ErrorState } from '../../shared/states';
import { StatusChip } from '../../ui/primitives/chips';

export interface ArtifactLineagePanelProps {
  sessionId: string;
  onClose: () => void;
  onOpenOutput?: (outputId: string) => void;
  onOpenReport?: (reportId: string) => void;
  onOpenPresentation?: (presentationId: string) => void;
  onOpenInitiativeDraft?: (draftId: string) => void;
}

interface LineageGroupItem {
  id: string;
  label: string;
  sublabel: string | null;
  status: string | null;
}

interface NormalizedLineage {
  session: { id: string; label: string } | null;
  outputs: LineageGroupItem[];
  reports: LineageGroupItem[];
  presentations: LineageGroupItem[];
  initiativeDrafts: LineageGroupItem[];
}

function extractArray(source: unknown, keys: readonly string[]): unknown[] {
  if (!source || typeof source !== 'object') return [];
  const record = source as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function toItem(row: unknown, fallbackLabelKeys: readonly string[]): LineageGroupItem | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const id = r.id != null ? String(r.id) : null;
  if (!id) return null;
  let label: string | null = null;
  for (const key of fallbackLabelKeys) {
    const value = r[key];
    if (typeof value === 'string' && value.trim()) {
      label = key === 'outputVersion' ? `v${value}` : value;
      break;
    }
    if (key === 'outputVersion' && typeof value === 'number') {
      label = `v${value}`;
      break;
    }
  }
  const dateField = r.frozenAt ?? r.createdAt ?? null;
  const sublabel = typeof dateField === 'string' ? dateField : null;
  const statusField = r.status;
  const status =
    typeof statusField === 'string'
      ? statusField
      : typeof r.isSuperseded === 'boolean'
        ? r.isSuperseded
          ? 'superseded'
          : 'current'
        : null;
  return { id, label: label ?? id, sublabel, status };
}

/**
 * Tries, in order: (1) named-array envelope, (2) a flat `{nodes:[{kind,...}]}`
 * list grouped by `kind`. Returns `null` only when `raw` isn't even a
 * plausible object — a genuinely empty session (frozen nothing yet) still
 * normalizes successfully, just with empty groups.
 */
export function normalizeLineage(raw: unknown, sessionId: string): NormalizedLineage | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;

  const nodes = Array.isArray(record.nodes) ? (record.nodes as unknown[]) : null;
  if (nodes) {
    const byKind = (kind: string) => nodes.filter((n) => (n as Record<string, unknown>)?.kind === kind);
    const sessionNode = byKind('session')[0] as Record<string, unknown> | undefined;
    return {
      session: {
        id: (sessionNode?.id as string | undefined) ?? sessionId,
        label: (sessionNode?.label as string | undefined) ?? sessionId,
      },
      outputs: byKind('output')
        .map((n) => toItem(n, ['outputVersion', 'scope', 'label', 'title']))
        .filter((i): i is LineageGroupItem => i !== null),
      reports: byKind('report')
        .map((n) => toItem(n, ['title', 'label']))
        .filter((i): i is LineageGroupItem => i !== null),
      presentations: byKind('presentation')
        .map((n) => toItem(n, ['title', 'label']))
        .filter((i): i is LineageGroupItem => i !== null),
      initiativeDrafts: byKind('initiative_draft')
        .map((n) => toItem(n, ['title', 'label']))
        .filter((i): i is LineageGroupItem => i !== null),
    };
  }

  const sessionRaw = record.session;
  const sessionObj =
    sessionRaw && typeof sessionRaw === 'object' ? (sessionRaw as Record<string, unknown>) : null;

  const outputsRaw = extractArray(record, ['outputs', 'revisions', 'outputRevisions']);
  const reportsRaw = extractArray(record, ['reports', 'reportSnapshots']);
  const presentationsRaw = extractArray(record, ['presentations', 'presentationSnapshots']);
  const draftsRaw = extractArray(record, ['initiativeDrafts', 'drafts', 'initiatives']);

  // Nothing at all recognizable — neither a `session` key nor any of the
  // known array keys. Treat as an unrecognized shape rather than a silently
  // empty result.
  if (!sessionObj && outputsRaw.length === 0 && reportsRaw.length === 0 && presentationsRaw.length === 0 && draftsRaw.length === 0 && Object.keys(record).length === 0) {
    return null;
  }

  return {
    session: {
      id: (sessionObj?.id as string | undefined) ?? sessionId,
      label: (sessionObj?.label as string | undefined) ?? sessionId,
    },
    outputs: outputsRaw
      .map((n) => toItem(n, ['outputVersion', 'scope', 'label', 'title']))
      .filter((i): i is LineageGroupItem => i !== null),
    reports: reportsRaw
      .map((n) => toItem(n, ['title', 'label']))
      .filter((i): i is LineageGroupItem => i !== null),
    presentations: presentationsRaw
      .map((n) => toItem(n, ['title', 'label']))
      .filter((i): i is LineageGroupItem => i !== null),
    initiativeDrafts: draftsRaw
      .map((n) => toItem(n, ['title', 'label']))
      .filter((i): i is LineageGroupItem => i !== null),
  };
}

function statusTone(status: string | null): 'success' | 'neutral' {
  return status === 'current' ? 'success' : 'neutral';
}

function statusLabel(isPolish: boolean, status: string | null): string | null {
  if (!status) return null;
  if (status === 'current') return isPolish ? 'Aktualny' : 'Current';
  if (status === 'superseded') return isPolish ? 'Zastąpiony' : 'Superseded';
  if (status === 'source_updated') return isPolish ? 'Źródło zaktualizowane' : 'Source updated';
  return status;
}

const LineageGroup: React.FC<{
  title: string;
  icon: React.ElementType;
  items: LineageGroupItem[];
  emptyLabel: string;
  isPolish: boolean;
  onOpen?: (id: string) => void;
}> = ({ title, icon: Icon, items, emptyLabel, isPolish, onOpen }) => (
  <div className="rounded-token-md border border-c-border-subtle bg-c-surface p-3">
    <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-c-text-muted">
      <Icon size={12} />
      {title}
      <span className="text-c-text-muted">({items.length})</span>
    </div>
    {items.length === 0 ? (
      <p className="text-xs italic text-c-text-muted">{emptyLabel}</p>
    ) : (
      <ul className="space-y-1.5">
        {items.map((item) => {
          const Tag = onOpen ? 'button' : 'div';
          return (
            <li key={item.id}>
              <Tag
                type={onOpen ? 'button' : undefined}
                onClick={onOpen ? () => onOpen(item.id) : undefined}
                className={`flex w-full items-center justify-between gap-2 rounded-token-sm px-2 py-1.5 text-left text-xs ${
                  onOpen
                    ? 'cursor-pointer hover:bg-c-surface-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus'
                    : ''
                }`}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium text-c-text">{item.label}</span>
                  {item.sublabel ? (
                    <span className="text-[10px] text-c-text-muted">{formatListDate(item.sublabel)}</span>
                  ) : null}
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {item.status ? (
                    <StatusChip label={statusLabel(isPolish, item.status) ?? item.status} tone={statusTone(item.status)} size="sm" />
                  ) : null}
                  {onOpen ? <ChevronRight size={12} className="text-c-text-muted" /> : null}
                </span>
              </Tag>
            </li>
          );
        })}
      </ul>
    )}
  </div>
);

export const ArtifactLineagePanel: React.FC<ArtifactLineagePanelProps> = ({
  sessionId,
  onClose,
  onOpenOutput,
  onOpenReport,
  onOpenPresentation,
  onOpenInitiativeDraft,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');

  const [raw, setRaw] = useState<unknown>(undefined);
  const [loading, setLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setHasLoadError(false);
    setForbidden(false);
    getSessionLineage(sessionId)
      .then((data) => {
        if (!cancelled) setRaw(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setRaw(undefined);
        if (isAuthError(err)) {
          setForbidden(true);
        } else {
          setHasLoadError(true);
        }
        // eslint-disable-next-line no-console -- fixed diagnostic only.
        console.error('[ArtifactLineagePanel] failed to load session lineage', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    const cancel = load();
    return cancel;
  }, [load]);

  const normalized = useMemo(
    () => (raw === undefined ? null : normalizeLineage(raw, sessionId)),
    [raw, sessionId]
  );

  const shapeUnrecognized = !loading && !hasLoadError && !forbidden && raw !== undefined && normalized === null;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-token-md border border-c-border-subtle bg-c-surface">
      <div className="flex items-center justify-between border-b border-c-border-subtle px-3 py-2.5">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-c-text">
          <GitBranch size={14} />
          {t('assessment.lineage.title', 'Lineage')}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-token-sm px-2 py-1 text-xs font-medium text-c-text-muted hover:bg-c-surface-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          {t('common.close', isPolish ? 'Zamknij' : 'Close')}
        </button>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-3">
        {loading ? (
          <p className="p-4 text-xs text-c-text-muted">
            {isPolish ? 'Wczytywanie historii pochodzenia…' : 'Loading lineage…'}
          </p>
        ) : forbidden ? (
          <EmptyState
            variant="forbidden"
            compact
            title={t('assessment.lineage.forbidden.title', 'No access to lineage')}
            description={t(
              'assessment.lineage.forbidden.description',
              'Your account does not have permission to view this session’s lineage.'
            )}
          />
        ) : hasLoadError ? (
          <ErrorState
            compact
            title={t('assessment.lineage.error.title', 'Could not load lineage')}
            description={t(
              'assessment.lineage.error.description',
              'The lineage for this session could not be loaded.'
            )}
            onRetry={load}
          />
        ) : shapeUnrecognized ? (
          <ErrorState
            compact
            title={t('assessment.lineage.unrecognized.title', 'Could not read this lineage')}
            description={t(
              'assessment.lineage.unrecognized.description',
              'The server returned a lineage response in an unrecognized shape.'
            )}
            onRetry={load}
          />
        ) : normalized ? (
          <>
            <div className="rounded-token-md border border-c-border-subtle bg-c-surface-raised px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-c-text-muted">
                {t('assessment.lineage.session', 'Session')}
              </div>
              <div className="mt-0.5 truncate text-xs font-medium text-c-text" title={normalized.session?.id}>
                {normalized.session?.label ?? sessionId}
              </div>
            </div>

            <LineageGroup
              title={t('assessment.lineage.outputs', 'Outputs')}
              icon={GitBranch}
              items={normalized.outputs}
              emptyLabel={t('assessment.lineage.outputsEmpty', 'No frozen Output yet.')}
              isPolish={isPolish}
              onOpen={onOpenOutput}
            />
            <LineageGroup
              title={t('assessment.lineage.reports', 'Reports')}
              icon={FileText}
              items={normalized.reports}
              emptyLabel={t('assessment.lineage.reportsEmpty', 'No Report snapshot yet.')}
              isPolish={isPolish}
              onOpen={onOpenReport}
            />
            <LineageGroup
              title={t('assessment.lineage.presentations', 'Presentations')}
              icon={Presentation}
              items={normalized.presentations}
              emptyLabel={t('assessment.lineage.presentationsEmpty', 'No Presentation snapshot yet.')}
              isPolish={isPolish}
              onOpen={onOpenPresentation}
            />
            <LineageGroup
              title={t('assessment.lineage.initiativeDrafts', 'Initiative Proposals')}
              icon={Lightbulb}
              items={normalized.initiativeDrafts}
              emptyLabel={t('assessment.lineage.initiativeDraftsEmpty', 'No Initiative Proposal Draft yet.')}
              isPolish={isPolish}
              onOpen={onOpenInitiativeDraft}
            />
          </>
        ) : null}
      </div>
    </div>
  );
};

export default ArtifactLineagePanel;
