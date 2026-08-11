/**
 * OkrSupportView — RN-G3 lane `okr` (2026-08-11), the "Conversations &
 * Support" mode of the full OKR tool workspace (design §8.3 mode 5;
 * OKR-E006 §8/§10/§13: comments, recognition, support requests,
 * acknowledge/resolve/dismiss, "Request Decision" bridge to the formal
 * Decision workflow — plan §13 "Decisions": "Request Decision is available
 * from a blocker/support context... Resolution is written back to the OKR
 * timeline as an event. A Decision does not become a structural parent of
 * the OKR").
 *
 * One list (`GET /sets/:setId/support-requests`, no `kind` filter by
 * default — Menu 3 chips filter client-side, matching every other RN-G2
 * chip-filter precedent in this program) covers all three kinds
 * (comment/recognition/support_request) since they share one physical table
 * (`okr_vnext_support_requests`, `okrSupportTypes.ts`).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';

import type { StandardBreadcrumb, StandardCounterChip, StandardPreviewProps, TableColumn, TableRow } from '@/components/standard';
import { Modal } from '@/components/ui/primitives';
import { StatusChip } from '@/components/ui/primitives';

import { ResultsVNextRegistryShell } from '../ResultsVNextRegistryShell';
import type { OkrSetDto } from './okrApi';
import { listObjectivesForSet, type OkrObjectiveWithKeyResultsDto } from './okrObjectiveApi';
import { OkrActionDialog, type OkrActionDialogField } from './OkrActionDialog';
import {
  acknowledgeSupportRequest,
  dismissSupportRequest,
  getDecisionLinkForSupportRequest,
  listSupportRequestsForSet,
  newOkrWorkspaceIdempotencyKey,
  OkrWorkspaceApiError,
  postOkrComment,
  postOkrRecognition,
  raiseOkrSupportRequest,
  requestDecisionFromSupportRequest,
  resolveSupportRequest,
  type OkrDecisionLinkWithLiveStatus,
  type OkrSupportRequestDto,
  type OkrSupportRequestKind,
} from './okrWorkspaceApi';
import {
  OKR_SUPPORT_STATUS_TONE,
  okrRecognitionVisibilityLabel,
  okrSupportKindLabel,
  okrSupportStatusLabel,
  shortWorkspaceId,
} from './okrWorkspaceMappers';
import { formatOkrDate } from './okrRegistryMappers';

export interface OkrSupportViewProps {
  set: OkrSetDto;
  isPolish: boolean;
  breadcrumbs: StandardBreadcrumb[];
}

function withId(row: OkrSupportRequestDto): OkrSupportRequestDto & { id: string } {
  return { ...row, id: row.requestId };
}

type ComposeKind = OkrSupportRequestKind;

// Resolve/request-decision/dismiss dialog (replaces three `window.prompt`
// calls — RN-G3 prompt-removal pass, 2026-08-11). One shared dialog keyed
// by {kind, row} rather than three separate `useState` triples, since all
// three share the exact same shape (one target request + N required text
// fields + busy/error/isConflict) — only the field list and endpoint
// differ, and both come straight from each mutation's own Zod schema
// (`ResolveSupportRequestSchema`/`RequestDecisionFromSupportRequestSchema`/
// `DismissSupportRequestSchema`, all fields required, `okrWorkspaceApi.ts`).
type SupportActionKind = 'resolve' | 'request-decision' | 'dismiss';

const SUPPORT_ACTION_FIELDS: Record<SupportActionKind, OkrActionDialogField[]> = {
  resolve: [{ id: 'resolutionNote', label: { pl: 'Notatka rozwiązania', en: 'Resolution note' }, required: true }],
  'request-decision': [
    { id: 'requestedDecision', label: { pl: 'Jaka decyzja jest potrzebna?', en: 'What decision is needed?' }, required: true },
    { id: 'impactOfDelay', label: { pl: 'Jaki jest wpływ opóźnienia?', en: 'What is the impact of delay?' }, required: true },
  ],
  dismiss: [{ id: 'dismissedReason', label: { pl: 'Powód odrzucenia', en: 'Dismissal reason' }, required: true }],
};

const SUPPORT_ACTION_TITLE: Record<SupportActionKind, { pl: string; en: string }> = {
  resolve: { pl: 'Rozwiąż', en: 'Resolve' },
  'request-decision': { pl: 'Poproś o decyzję', en: 'Request decision' },
  dismiss: { pl: 'Odrzuć', en: 'Dismiss' },
};

export const OkrSupportView: React.FC<OkrSupportViewProps> = ({ set, isPolish, breadcrumbs }) => {
  const [items, setItems] = useState<OkrSupportRequestDto[] | null>(null);
  const [objectives, setObjectives] = useState<OkrObjectiveWithKeyResultsDto[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chip, setChip] = useState<'all' | OkrSupportRequestKind>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [decisionLink, setDecisionLink] = useState<OkrDecisionLinkWithLiveStatus | null>(null);

  const [composeOpen, setComposeOpen] = useState(false);
  const [composeKind, setComposeKind] = useState<ComposeKind>('comment');
  const [composeObjectiveId, setComposeObjectiveId] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeAssignee, setComposeAssignee] = useState('');
  const [composeVisibility, setComposeVisibility] = useState<'team' | 'organization'>('team');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // TDZ FIX (2026-08-11): `load` was declared BELOW the dialog callback that
  // lists it as a dependency, so the dependency array read it inside its
  // temporal dead zone. Declared here, before its first use.
  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listSupportRequestsForSet(set.setId)
      .then((rows) => setItems(rows))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [set.setId]);

  const [actionTarget, setActionTarget] = useState<{ kind: SupportActionKind; row: OkrSupportRequestDto } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionConflict, setActionConflict] = useState(false);

  const submitAction = useCallback(
    (values: Record<string, string>) => {
      if (!actionTarget) return;
      const { kind, row } = actionTarget;
      setActionBusy(true);
      setActionError(null);
      setActionConflict(false);
      const idempotencyKey = newOkrWorkspaceIdempotencyKey();
      const req =
        kind === 'resolve'
          ? resolveSupportRequest(row.requestId, { expectedVersion: row.rowVersion, resolutionNote: values.resolutionNote, idempotencyKey })
          : kind === 'request-decision'
            ? requestDecisionFromSupportRequest(row.requestId, {
                expectedVersion: row.rowVersion,
                requestedDecision: values.requestedDecision,
                impactOfDelay: values.impactOfDelay,
                idempotencyKey,
              })
            : dismissSupportRequest(row.requestId, { expectedVersion: row.rowVersion, dismissedReason: values.dismissedReason, idempotencyKey });
      req
        .then(() => {
          setActionTarget(null);
          load();
        })
        .catch((err) => {
          setActionConflict(err instanceof OkrWorkspaceApiError && err.status === 409);
          setActionError(err instanceof Error ? err.message : String(err));
        })
        .finally(() => setActionBusy(false));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [actionTarget, load]
  );


  useEffect(() => {
    load();
    listObjectivesForSet(set.setId)
      .then((rows) => {
        setObjectives(rows);
        if (rows.length > 0) setComposeObjectiveId(rows[0].objectiveId);
      })
      .catch(() => undefined);
  }, [load, set.setId]);

  useEffect(() => {
    if (!selectedId) {
      setDecisionLink(null);
      return;
    }
    const item = (items ?? []).find((i) => i.requestId === selectedId);
    if (!item || !item.decisionLinkId) {
      setDecisionLink(null);
      return;
    }
    getDecisionLinkForSupportRequest(selectedId)
      .then((link) => setDecisionLink(link))
      .catch(() => setDecisionLink(null));
  }, [selectedId, items]);

  const respond = (fn: () => Promise<unknown>) => {
    fn()
      .then(() => load())
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  };

  const bucketCounts = { all: items?.length ?? 0, comment: 0, recognition: 0, support_request: 0 } as Record<
    'all' | OkrSupportRequestKind,
    number
  >;
  for (const item of items ?? []) bucketCounts[item.kind] += 1;

  const chips: StandardCounterChip[] = [
    { id: 'all', label: isPolish ? 'Wszystkie' : 'All', count: bucketCounts.all },
    { id: 'comment', label: isPolish ? 'Komentarze' : 'Comments', count: bucketCounts.comment },
    { id: 'recognition', label: isPolish ? 'Uznania' : 'Recognition', count: bucketCounts.recognition },
    { id: 'support_request', label: isPolish ? 'Prośby o wsparcie' : 'Support requests', count: bucketCounts.support_request },
  ];

  const filtered = (items ?? []).filter((i) => chip === 'all' || i.kind === chip);
  const rows: TableRow[] = filtered.map(withId);
  const selected = filtered.find((i) => i.requestId === selectedId) ?? null;

  const columns: TableColumn[] = [
    {
      id: 'kind',
      label: isPolish ? 'Typ' : 'Kind',
      width: '150px',
      render: (row: OkrSupportRequestDto) => <span className="text-sm text-c-text">{okrSupportKindLabel(row.kind, isPolish)}</span>,
    },
    {
      id: 'body',
      label: isPolish ? 'Treść' : 'Body',
      width: '320px',
      render: (row: OkrSupportRequestDto) => <span className="text-sm text-c-text-secondary line-clamp-2">{row.body}</span>,
    },
    {
      id: 'status',
      label: 'Status',
      width: '160px',
      filterable: true,
      filterOptions: (['open', 'acknowledged', 'resolved', 'dismissed'] as const).map((s) => ({ value: s, label: okrSupportStatusLabel(s, isPolish) })),
      render: (row: OkrSupportRequestDto) =>
        row.status ? (
          <StatusChip label={okrSupportStatusLabel(row.status, isPolish)} tone={OKR_SUPPORT_STATUS_TONE[row.status]} />
        ) : (
          <span className="text-c-text-muted">—</span>
        ),
    },
    {
      id: 'assignedTo',
      label: isPolish ? 'Przypisano do' : 'Assigned to',
      width: '150px',
      render: (row: OkrSupportRequestDto) => <span className="font-mono text-sm text-c-text-secondary">{shortWorkspaceId(row.assignedToUserId)}</span>,
    },
    {
      id: 'createdAt',
      label: isPolish ? 'Utworzono' : 'Created',
      width: '150px',
      render: (row: OkrSupportRequestDto) => <span className="text-sm text-c-text-secondary">{formatOkrDate(row.createdAt, isPolish)}</span>,
    },
  ];

  const preview: StandardPreviewProps | null = selected
    ? {
        title: selected.body.slice(0, 80),
        onClose: () => setSelectedId(null),
        meta: {
          pills: [
            { label: okrSupportKindLabel(selected.kind, isPolish) },
            ...(selected.status ? [{ label: okrSupportStatusLabel(selected.status, isPolish) }] : []),
          ],
        },
        details: {
          propertyLabel: isPolish ? 'Właściwość' : 'Property',
          valueLabel: isPolish ? 'Wartość' : 'Value',
          properties: [
            { id: 'body', label: isPolish ? 'Treść' : 'Body', value: selected.body },
            { id: 'assignedTo', label: isPolish ? 'Przypisano do' : 'Assigned to', value: shortWorkspaceId(selected.assignedToUserId) },
            selected.resolutionNote
              ? { id: 'resolutionNote', label: isPolish ? 'Notatka rozwiązania' : 'Resolution note', value: selected.resolutionNote }
              : null,
            selected.dismissedReason
              ? { id: 'dismissedReason', label: isPolish ? 'Powód odrzucenia' : 'Dismissed reason', value: selected.dismissedReason }
              : null,
            selected.recognitionVisibility
              ? { id: 'visibility', label: isPolish ? 'Widoczność' : 'Visibility', value: okrRecognitionVisibilityLabel(selected.recognitionVisibility, isPolish) }
              : null,
          ].filter((r): r is NonNullable<typeof r> => r !== null),
        },
        relations: decisionLink
          ? [
              {
                id: decisionLink.linkId,
                label: isPolish ? `Decyzja: ${decisionLink.requestedDecision}` : `Decision: ${decisionLink.requestedDecision}`,
                value: decisionLink.decisionStatus ?? undefined,
                icon: ExternalLink,
              },
            ]
          : [],
        actions: {
          informational: [
            selected.status === 'open'
              ? {
                  id: 'ack',
                  variant: 'neutral' as const,
                  label: isPolish ? 'Przyjmij do wiadomości' : 'Acknowledge',
                  onClick: () =>
                    respond(() =>
                      acknowledgeSupportRequest(selected.requestId, { expectedVersion: selected.rowVersion, idempotencyKey: newOkrWorkspaceIdempotencyKey() })
                    ),
                }
              : null,
          ].filter((a): a is NonNullable<typeof a> => a !== null),
        },
      }
    : null;

  return (
    <>
      <ResultsVNextRegistryShell
        domain="okr"
        moduleBar={{
          breadcrumbs,
          chips,
          activeChip: chip,
          onChipChange: (id) => setChip(id as 'all' | OkrSupportRequestKind),
          breadcrumbCta: {
            label: isPolish ? 'Dodaj' : 'Add',
            onClick: () => {
              setFormError(null);
              setComposeBody('');
              setComposeAssignee('');
              setComposeOpen(true);
            },
            testId: 'okr-support-compose-cta',
          },
        }}
        table={{
          columns,
          data: rows,
          persistKey: 'results-vnext.okr-support',
          loading,
          error,
          onRetry: load,
          selectedRowId: selectedId,
          onRowClick: (row) => setSelectedId(String(row.requestId)),
          empty:
            !loading && !error && rows.length === 0
              ? {
                  title: isPolish ? 'Brak wpisów' : 'No entries',
                  description: isPolish
                    ? 'Brak komentarzy, uznań i próśb o wsparcie w tym zestawie.'
                    : 'No comments, recognition, or support requests on this set yet.',
                }
              : undefined,
          rowMenu: (row) => {
            const r = row as unknown as OkrSupportRequestDto;
            const isOpen = r.status === 'open';
            const isAck = r.status === 'acknowledged';
            return {
              primary: [{ id: 'open', label: isPolish ? 'Otwórz' : 'Open', onClick: () => setSelectedId(r.requestId) }],
              universalHandlers: { preview: () => setSelectedId(r.requestId) },
              statusTransitions:
                isOpen || isAck
                  ? [
                      isOpen
                        ? {
                            id: 'ack',
                            label: isPolish ? 'Przyjmij do wiadomości' : 'Acknowledge',
                            onClick: () =>
                              respond(() => acknowledgeSupportRequest(r.requestId, { expectedVersion: r.rowVersion, idempotencyKey: newOkrWorkspaceIdempotencyKey() })),
                          }
                        : undefined,
                      {
                        id: 'resolve',
                        label: isPolish ? 'Rozwiąż' : 'Resolve',
                        onClick: () => {
                          setActionError(null);
                          setActionConflict(false);
                          setActionTarget({ kind: 'resolve', row: r });
                        },
                      },
                      {
                        id: 'request-decision',
                        label: isPolish ? 'Poproś o decyzję' : 'Request decision',
                        onClick: () => {
                          setActionError(null);
                          setActionConflict(false);
                          setActionTarget({ kind: 'request-decision', row: r });
                        },
                      },
                    ].filter((a): a is NonNullable<typeof a> => a !== undefined)
                  : undefined,
              destructive:
                isOpen || isAck
                  ? {
                      label: isPolish ? 'Odrzuć' : 'Dismiss',
                      onClick: () => {
                        setActionError(null);
                        setActionConflict(false);
                        setActionTarget({ kind: 'dismiss', row: r });
                      },
                    }
                  : { label: isPolish ? 'Odrzuć' : 'Dismiss', note: isPolish ? 'Wpis już zamknięty.' : 'Entry already closed.' },
            };
          },
        }}
        preview={preview}
      />

      <Modal
        open={composeOpen}
        onClose={busy ? () => {} : () => setComposeOpen(false)}
        title={isPolish ? 'Nowy wpis' : 'New entry'}
        size="sm"
        preventOverlayClose={busy}
        preventEscapeClose={busy}
        footer={
          <>
            <button
              type="button"
              onClick={() => setComposeOpen(false)}
              disabled={busy}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-c-border bg-transparent px-4 text-sm font-medium text-c-text hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              {isPolish ? 'Wstecz' : 'Back'}
            </button>
            <button
              type="button"
              disabled={busy || !composeBody.trim() || !composeObjectiveId || (composeKind === 'support_request' && !composeAssignee.trim())}
              onClick={() => {
                setBusy(true);
                setFormError(null);
                const idempotencyKey = newOkrWorkspaceIdempotencyKey();
                const req =
                  composeKind === 'comment'
                    ? postOkrComment(set.setId, composeObjectiveId, { body: composeBody.trim(), idempotencyKey })
                    : composeKind === 'recognition'
                      ? postOkrRecognition(set.setId, composeObjectiveId, {
                          body: composeBody.trim(),
                          recognitionVisibility: composeVisibility,
                          idempotencyKey,
                        })
                      : raiseOkrSupportRequest(set.setId, composeObjectiveId, {
                          body: composeBody.trim(),
                          assignedToUserId: composeAssignee.trim(),
                          idempotencyKey,
                        });
                req
                  .then(() => {
                    setComposeOpen(false);
                    load();
                  })
                  .catch((err) => setFormError(err instanceof Error ? err.message : String(err)))
                  .finally(() => setBusy(false));
              }}
              data-testid="okr-support-compose-submit"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-c-border-strong bg-c-text px-4 text-sm font-medium text-c-surface hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? (isPolish ? 'Wysyłanie…' : 'Sending…') : isPolish ? 'Wyślij' : 'Send'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex gap-2">
            {(['comment', 'recognition', 'support_request'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setComposeKind(k)}
                className={`h-8 rounded-full border px-3 text-xs font-medium ${
                  composeKind === k ? 'border-c-border-strong bg-c-text text-c-surface' : 'border-c-border bg-transparent text-c-text'
                }`}
                data-testid={`okr-support-kind-${k}`}
              >
                {okrSupportKindLabel(k, isPolish)}
              </button>
            ))}
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-c-text-muted mb-1.5" htmlFor="okr-support-objective">
              {isPolish ? 'Cel' : 'Objective'}
            </label>
            <select
              id="okr-support-objective"
              value={composeObjectiveId}
              onChange={(e) => setComposeObjectiveId(e.target.value)}
              className="w-full h-9 rounded-lg border border-c-border bg-c-surface px-3 text-sm text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              {(objectives ?? []).map((o) => (
                <option key={o.objectiveId} value={o.objectiveId}>
                  {o.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-c-text-muted mb-1.5" htmlFor="okr-support-body">
              {isPolish ? 'Treść' : 'Body'}
            </label>
            <textarea
              id="okr-support-body"
              value={composeBody}
              onChange={(e) => setComposeBody(e.target.value)}
              className="w-full min-h-[80px] rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              data-testid="okr-support-body-input"
            />
          </div>
          {composeKind === 'recognition' ? (
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-c-text-muted mb-1.5" htmlFor="okr-support-visibility">
                {isPolish ? 'Widoczność' : 'Visibility'}
              </label>
              <select
                id="okr-support-visibility"
                value={composeVisibility}
                onChange={(e) => setComposeVisibility(e.target.value as 'team' | 'organization')}
                className="w-full h-9 rounded-lg border border-c-border bg-c-surface px-3 text-sm text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                <option value="team">{okrRecognitionVisibilityLabel('team', isPolish)}</option>
                <option value="organization">{okrRecognitionVisibilityLabel('organization', isPolish)}</option>
              </select>
            </div>
          ) : null}
          {composeKind === 'support_request' ? (
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-c-text-muted mb-1.5" htmlFor="okr-support-assignee">
                {isPolish ? 'Przypisz do (identyfikator użytkownika)' : 'Assign to (user id)'}
              </label>
              <input
                id="okr-support-assignee"
                value={composeAssignee}
                onChange={(e) => setComposeAssignee(e.target.value)}
                className="w-full h-9 rounded-lg border border-c-border bg-c-surface px-3 text-sm text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                data-testid="okr-support-assignee-input"
              />
            </div>
          ) : null}
          {formError ? (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-[12px] text-c-text">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-c-danger" />
              <span>{formError}</span>
            </div>
          ) : null}
        </div>
      </Modal>

      <OkrActionDialog
        open={!!actionTarget}
        title={actionTarget ? (isPolish ? SUPPORT_ACTION_TITLE[actionTarget.kind].pl : SUPPORT_ACTION_TITLE[actionTarget.kind].en) : ''}
        description={actionTarget ? (isPolish ? `Wpis: ${actionTarget.row.body.slice(0, 80)}` : `Entry: ${actionTarget.row.body.slice(0, 80)}`) : undefined}
        fields={actionTarget ? SUPPORT_ACTION_FIELDS[actionTarget.kind] : []}
        isPolish={isPolish}
        onClose={() => (actionBusy ? undefined : setActionTarget(null))}
        onSubmit={submitAction}
        submitLabel={actionTarget ? (isPolish ? SUPPORT_ACTION_TITLE[actionTarget.kind].pl : SUPPORT_ACTION_TITLE[actionTarget.kind].en) : ''}
        busy={actionBusy}
        errorMessage={actionError}
        isConflict={actionConflict}
        destructive={actionTarget?.kind === 'dismiss'}
      />
    </>
  );
};

export default OkrSupportView;

export { OkrWorkspaceApiError };
