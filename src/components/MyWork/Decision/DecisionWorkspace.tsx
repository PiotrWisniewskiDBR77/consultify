/**
 * MW-DEC-001 — DecisionWorkspace: the canonical, HONEST Decision detail view.
 *
 * Replaces DecisionDetailView.tsx's fake enhancement layer (comments /
 * alternatives / risks / rationale hydrated from and persisted back to
 * `localStorage['consultify-decision-enhancements:<id>']`, with a hardcoded
 * fake author `authorId: 'current-user'` / `authorName: 'Current User'` —
 * see MW-CORE-001_CURRENT_RUNTIME_MAP.md §2/§3/§4) with the real, canonical
 * backend built alongside this component: GET /api/decisions/:id/detail +
 * POST/PUT/DELETE on comments/alternatives/risks + PUT /api/decisions/:id/
 * decide (server/src/routes/pmo/decisions.routes.ts,
 * server/src/controllers/DecisionController.ts,
 * server/src/services/decisionCollaborationService.ts).
 *
 * This component is independently mountable — it does not read or write
 * DecisionDetailView.tsx's localStorage key, does not import from it, and
 * does not assume it is mounted inside MyWorkHub.tsx (though that is the
 * intended integration point — see the header comment in
 * decisionWorkspaceApi.ts and the integration note in the MW-DEC-001 packet
 * for the exact MyWorkHub.tsx wiring).
 *
 * Local component state holds ONLY unsaved drafts (comment text, new
 * alternative/risk form fields, decide rationale/notes — each documented at
 * its own call site) plus transient UI/loading/error flags. Every other
 * value rendered here — status, comments, alternatives, risks, audit trail,
 * decided-by/at — comes straight from the last successful server response.
 * There is no localStorage/sessionStorage usage anywhere in this file or its
 * sibling files in this directory (grep confirms this — see the MW-DEC-001
 * deliverable report).
 */
import { AlertTriangle, Loader2, RefreshCw, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { PreviewRelations, type RelationItem } from '@/components/shared/PreviewPane';
import { EmptyState } from '@/components/ui/composed/EmptyState';
import { LoadingState } from '@/components/ui/primitives';
import {
  DueChip,
  EntityStatusChip,
  MetaChip,
  PriorityChip,
  type PriorityLevel,
} from '@/components/ui/primitives/chips';
import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import { getArtifactPath, type ArtifactType } from '@/utils/artifactLinks';

import { DecisionAlternativesSection } from './DecisionAlternativesSection';
import { DecisionAuditTrail } from './DecisionAuditTrail';
import { DecisionCommentsSection } from './DecisionCommentsSection';
import { DecisionDecideBar } from './DecisionDecideBar';
import decisionWorkspaceApi, { readDecisionApiError } from './decisionWorkspaceApi';
import { DecisionRisksSection } from './DecisionRisksSection';
import type { DecisionDetailDTO, WorkspaceUserRef } from './types';
import { useConfirmDialog } from '../shared/ConfirmDialog';
import {
  buildUserNameMap,
  formatDate,
  getInitials,
  isAdminLikeRole,
  isOverdue,
} from './workspaceHelpers';

export interface DecisionWorkspaceProps {
  decisionId: string | null;
  onClose: () => void;
  onSaved?: (data: unknown) => void;
}

const priorityLevel = (priority?: string): PriorityLevel => {
  switch (priority?.toUpperCase()) {
    case 'CRITICAL':
      return 'urgent';
    case 'HIGH':
      return 'high';
    case 'LOW':
      return 'low';
    case 'MEDIUM':
    default:
      return 'medium';
  }
};

type LoadErrorKind = 'not_found' | 'network';

const KNOWN_ARTIFACT_TYPES = new Set<string>([
  'decision',
  'initiative',
  'task',
  'process',
  'role',
  'system',
  'kpi',
  'tool_session',
  'notification',
  'report',
  'assessment',
  'tool',
  'insight',
  'project',
  'risk',
  'external',
  'idea',
  'notebook',
  'presentation',
  'sheet',
  'meeting',
  'financial_model',
  'budget',
  'valuation',
  'analysis',
  'knowledge',
]);

export const DecisionWorkspace: React.FC<DecisionWorkspaceProps> = ({
  decisionId,
  onClose,
  onSaved,
}) => {
  const { t, i18n } = useTranslation();
  const { currentUser } = useAppStore();
  const { dialog: confirmDialog, confirm } = useConfirmDialog();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<DecisionDetailDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ kind: LoadErrorKind; message: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState<WorkspaceUserRef[]>([]);

  const usersById = useMemo(() => buildUserNameMap(users), [users]);

  const fetchUsers = useCallback(async () => {
    try {
      const raw = await Api.getUsers();
      const mapped: WorkspaceUserRef[] = (Array.isArray(raw) ? raw : []).map((u: any) => ({
        id: String(u.id),
        name: String(
          u.name ||
            `${u.firstName || u.first_name || ''} ${u.lastName || u.last_name || ''}`.trim() ||
            u.email ||
            u.id
        ),
        email: u.email ? String(u.email) : undefined,
        avatarUrl: u.avatarUrl || u.avatar_url || undefined,
      }));
      setUsers(mapped);
    } catch {
      // Non-fatal: comment/alternative/risk author names fall back to
      // "Unknown user" per-string rather than blocking the whole workspace.
      setUsers([]);
    }
  }, []);

  const loadDetail = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!decisionId) return;
      if (!opts?.silent) setLoading(true);
      else setRefreshing(true);
      setLoadError(null);
      try {
        const data = await decisionWorkspaceApi.getDetail(decisionId);
        setDetail(data);
      } catch (err) {
        const apiErr = readDecisionApiError(err);
        if (apiErr.status === 404) {
          setLoadError({
            kind: 'not_found',
            message: t(
              'myWork.decisionWorkspace.notFound',
              'This decision no longer exists or you do not have access to it.'
            ),
          });
        } else {
          setLoadError({
            kind: 'network',
            message: t('myWork.decisionWorkspace.loadFailed', 'Could not load this decision. {{msg}}', {
              msg: apiErr.data?.error || apiErr.message || '',
            }),
          });
        }
        setDetail(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [decisionId, t]
  );

  useEffect(() => {
    if (!decisionId) {
      setDetail(null);
      setLoading(false);
      setLoadError(null);
      return;
    }
    void loadDetail();
    void fetchUsers();
    // decisionId drives the fetch; loadDetail/fetchUsers are stable via useCallback deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decisionId]);

  const isPolish = i18n.language?.startsWith('pl');
  const isAdminLike = isAdminLikeRole(currentUser?.role);
  const dateLocale = isPolish ? 'pl-PL' : 'en-US';

  const canEditDossier =
    Boolean(currentUser?.id) &&
    (currentUser?.id === detail?.requestedById ||
      currentUser?.id === detail?.decisionOwnerId ||
      isAdminLike);

  const isFinalized = detail?.status === 'APPROVED' || detail?.status === 'REJECTED';

  const relationItems: RelationItem[] = useMemo(() => {
    if (!detail) return [];
    return detail.links.map((link) => {
      const targetType = link.targetType as ArtifactType;
      const clickable = KNOWN_ARTIFACT_TYPES.has(link.targetType);
      return {
        id: link.id,
        label: `${link.relation}: ${link.targetType}`,
        title: link.targetId,
        onClick: clickable
          ? () => {
              try {
                navigate(getArtifactPath(targetType, link.targetId));
              } catch {
                // Unknown/unsupported target — no-op, chip stays inert.
              }
            }
          : undefined,
      };
    });
  }, [detail, navigate]);

  // ---- Not-yet-created decisions are out of scope for this workspace ----
  // See the MW-DEC-001 integration note: creating a brand-new decision keeps
  // going through the existing creation flow; this component is the detail/
  // collaboration/decide surface for a decision that already exists.
  if (!decisionId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <EmptyState
          title={t('myWork.decisionWorkspace.noIdTitle', 'No decision selected')}
          description={t(
            'myWork.decisionWorkspace.noIdDescription',
            'Creating a new decision is not supported in this view yet.'
          )}
        />
        <button
          onClick={onClose}
          className="h-8 px-3 rounded-lg text-xs font-medium text-c-text-secondary hover:text-c-text hover:bg-c-surface-raised transition-colors"
        >
          {t('myWork.decisionWorkspace.close', 'Close')}
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingState variant="spinner" label={t('myWork.decisionWorkspace.loading', 'Loading decision…')} />
      </div>
    );
  }

  if (loadError?.kind === 'not_found') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <EmptyState
          icon={<AlertTriangle />}
          title={t('myWork.decisionWorkspace.notFoundTitle', 'Decision not found')}
          description={loadError.message}
        />
        <button
          onClick={onClose}
          className="h-8 px-3 rounded-lg text-xs font-medium text-c-text-secondary hover:text-c-text hover:bg-c-surface-raised transition-colors"
        >
          {t('myWork.decisionWorkspace.close', 'Close')}
        </button>
      </div>
    );
  }

  if (loadError?.kind === 'network' || !detail) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <EmptyState
          icon={<AlertTriangle />}
          title={t('myWork.decisionWorkspace.errorTitle', 'Something went wrong')}
          description={loadError?.message}
        />
        <button
          onClick={() => void loadDetail()}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium bg-c-surface-raised border border-c-border-subtle text-c-text hover:bg-c-surface transition-colors"
        >
          <RefreshCw size={13} />
          {t('myWork.decisionWorkspace.retry', 'Retry')}
        </button>
      </div>
    );
  }

  const ownerName = detail.ownerName || t('myWork.decisionWorkspace.unassigned', 'Unassigned');
  const overdue = isOverdue(detail.dueDate) && detail.status === 'PENDING';

  return (
    <div className="flex h-full flex-col overflow-hidden bg-c-bg">
      {confirmDialog}

      {/* Header */}
      <div className="shrink-0 border-b border-c-border-subtle px-5 py-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-c-text truncate">{detail.title}</h1>
              {refreshing ? <Loader2 size={13} className="animate-spin text-c-text-muted" /> : null}
            </div>
            {detail.description ? (
              <p className="mt-1 text-xs text-c-text-secondary line-clamp-2">{detail.description}</p>
            ) : null}
          </div>
          <button
            onClick={onClose}
            aria-label={t('myWork.decisionWorkspace.close', 'Close')}
            className="shrink-0 h-8 w-8 flex items-center justify-center rounded-lg text-c-text-muted hover:text-c-text hover:bg-c-surface-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <EntityStatusChip status={detail.status} />
          {detail.priority ? (
            <PriorityChip level={priorityLevel(detail.priority)} />
          ) : null}
          {detail.dueDate ? (
            <DueChip
              label={formatDate(detail.dueDate, dateLocale)}
              risk={overdue ? 'overdue' : 'none'}
              showIcon
            />
          ) : null}
          <MetaChip
            label={ownerName}
            icon={undefined}
            trailing={
              <span className="w-4 h-4 rounded-full bg-c-surface-raised border border-c-border-subtle flex items-center justify-center text-[8px] font-medium text-c-text-secondary">
                {getInitials(ownerName)}
              </span>
            }
          />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-5">
        {/* What must be decided / why now / recommendation — read-only prose
            fields from `decisions` (no dedicated CRUD endpoint in this
            packet's contract; editing these stays out of scope here). */}
        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-c-text-muted mb-1.5">
            {t('myWork.decisionWorkspace.section.whatAndWhy', 'What must be decided / why now')}
          </h2>
          <p className="text-xs text-c-text-secondary leading-relaxed">
            {detail.description ||
              t('myWork.decisionWorkspace.section.noDescription', 'No description provided.')}
          </p>
          {detail.consequencesOfInaction ? (
            <p className="mt-1.5 text-xs text-c-text-secondary leading-relaxed">
              <span className="font-medium text-c-text-muted">
                {t('myWork.decisionWorkspace.section.consequences', 'Consequences of inaction')}:{' '}
              </span>
              {detail.consequencesOfInaction}
            </p>
          ) : null}
          {detail.recommendation ? (
            <p className="mt-1.5 text-xs text-c-text-secondary leading-relaxed">
              <span className="font-medium text-c-text-muted">
                {t('myWork.decisionWorkspace.section.recommendation', 'Recommendation')}:{' '}
              </span>
              {detail.recommendation}
            </p>
          ) : null}
        </section>

        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-c-text-muted mb-1.5">
            {t('myWork.decisionWorkspace.section.alternatives', 'Alternatives')}
          </h2>
          <DecisionAlternativesSection
            decisionId={detail.id}
            alternatives={detail.dossierAlternatives}
            onChange={(next) => setDetail((d) => (d ? { ...d, dossierAlternatives: next } : d))}
            isFinalized={isFinalized}
            canEdit={canEditDossier}
            onFinalizedRace={() => void loadDetail({ silent: true })}
            confirm={confirm}
          />
        </section>

        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-c-text-muted mb-1.5">
            {t('myWork.decisionWorkspace.section.risks', 'Risks')}
          </h2>
          <DecisionRisksSection
            decisionId={detail.id}
            risks={detail.dossierRisks}
            onChange={(next) => setDetail((d) => (d ? { ...d, dossierRisks: next } : d))}
            isFinalized={isFinalized}
            canEdit={canEditDossier}
            onFinalizedRace={() => void loadDetail({ silent: true })}
            usersById={usersById}
            users={users}
            confirm={confirm}
          />
        </section>

        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-c-text-muted mb-1.5">
            {t('myWork.decisionWorkspace.section.evidence', 'Evidence & links')}
          </h2>
          <PreviewRelations
            items={relationItems}
            emptyLabel={t('myWork.decisionWorkspace.section.noLinks', 'No linked evidence yet.')}
          />
        </section>

        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-c-text-muted mb-1.5">
            {t('myWork.decisionWorkspace.section.comments', 'Comments')}
          </h2>
          <DecisionCommentsSection
            decisionId={detail.id}
            comments={detail.comments}
            onCommentsChange={(next) => setDetail((d) => (d ? { ...d, comments: next } : d))}
            usersById={usersById}
            currentUserId={currentUser?.id}
            isAdminLike={isAdminLike}
          />
        </section>

        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-c-text-muted mb-1.5">
            {t('myWork.decisionWorkspace.section.history', 'Audit history')}
          </h2>
          <DecisionAuditTrail entries={detail.auditTrail} />
        </section>
      </div>

      {/* Footer — the decide action */}
      <div className="shrink-0 border-t border-c-border-subtle px-5 py-3">
        <DecisionDecideBar
          decisionId={detail.id}
          detail={detail}
          currentUserId={currentUser?.id}
          isAdminLike={isAdminLike}
          usersById={usersById}
          onDecided={() => {
            void loadDetail({ silent: true });
            onSaved?.({ id: detail.id });
          }}
          onNotFound={() =>
            setLoadError({
              kind: 'not_found',
              message: t(
                'myWork.decisionWorkspace.notFound',
                'This decision no longer exists or you do not have access to it.'
              ),
            })
          }
          confirm={confirm}
        />
      </div>
    </div>
  );
};

export default DecisionWorkspace;
