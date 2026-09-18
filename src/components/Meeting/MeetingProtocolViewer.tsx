/**
 * MTG-2a (DEC-607) — the meeting protocol as an archetype-B Document.
 *
 * WHY NOT THE DOC-0 VIEWER (measured, one sentence as the order asks): DOC-0's
 * `DocumentViewer` is bound to `resolveDocumentContent`, which fetches a single
 * markdown body from a content registry (`GET /api/artifacts/:id/content` or a
 * canvas draft); the protocol is not a registry row but a set of structured JSON
 * blocks served by `GET /api/meeting/:id/protocol`, so this component reuses the
 * SAME archetype-B shell (`StandardArtifactShell`, `karta="document"`) directly
 * and maps the 8 generated blocks into continuous B typography in `Meeting/**`.
 *
 * The document is read-only and generated from DATA (agenda, attendance,
 * decisions, actions, task readback) — never AI free text. Empty blocks are
 * already hidden by the generator, so the centre renders only what exists.
 *
 * Lifecycle: draft -> (chair/organizer accept) -> approved v1.0 (frozen);
 * editing an approved protocol creates the next version draft with an errata
 * note (v1.0 stays untouched). Front-end authority gating is MTG-2b's job — the
 * approve/errata routes already enforce the organizer guard and this surface
 * reports a 403 honestly rather than pretending.
 *
 * Colour: `c-*` tokens only. Crimson (`primary-*`, `#85182F`) is critical
 * semantics and a protocol document has none.
 */
import {
  CalendarDays,
  CheckSquare,
  ClipboardList,
  Download,
  FileText,
  History,
  ListChecks,
  Loader2,
  MapPin,
  MessageSquareText,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { NModeToolbar } from '@/components/shared/NModeLayout';
import { ArtifactPropertiesTable } from '@/components/standard/ArtifactPropertiesTable';
import { StandardArtifactShell } from '@/components/standard/StandardArtifactShell';
import type { StandardSekcjaDef } from '@/components/standard/StandardArtifactShell.types';
import type { PresentationMode } from '@/hooks/usePresentationMode';

import {
  approveMeetingProtocol,
  blockOf,
  createMeetingProtocolErrata,
  exportMeetingProtocolDocx,
  fetchMeetingProtocolPreview,
  type ProtocolBlock,
  type ProtocolPreview,
} from './meetingProtocolClient';

export interface MeetingProtocolViewerProps {
  meetingId: string;
  meetingTitle?: string | null;
  /**
   * Whether the caller may approve / create an errata. Defaults to true; the
   * routes enforce the real organizer guard and this surface surfaces a 403.
   */
  canManage?: boolean;
  onClose: () => void;
}

const BLOCK = 'rounded-xl border border-c-border-subtle bg-c-surface p-6';
const H2 = 'text-base font-semibold text-c-text';
const LABEL = 'text-xs uppercase tracking-wide text-c-text-muted';
const BODY = 'text-sm text-c-text-secondary';
const PILL =
  'inline-flex items-center rounded-full bg-c-surface-raised px-2 py-0.5 text-xs text-c-text-secondary';
const STATE_BOX =
  'rounded-xl border border-c-border-subtle bg-c-surface p-6 text-sm text-c-text-secondary';

function formatDate(value: string | null, isPolish: boolean): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(isPolish ? 'pl-PL' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function NameList({ title, names }: { title: string; names: string[] }) {
  if (!names.length) return null;
  return (
    <div>
      <div className={LABEL}>{title}</div>
      <ul className="mt-1 space-y-0.5">
        {names.map((name) => (
          <li key={name} className={BODY}>
            {name}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One labelled block wrapper: a heading plus its body, in continuous B typography. */
function Block({
  icon: Icon,
  title,
  children,
}: {
  icon: React.FC<{ size?: number; className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className={BLOCK}>
      <h2 className={`${H2} mb-4 flex items-center gap-2`}>
        <Icon size={18} className="text-c-text-muted" />
        {title}
      </h2>
      {children}
    </section>
  );
}

export function MeetingProtocolViewer(props: MeetingProtocolViewerProps) {
  const { meetingId, meetingTitle, canManage = true, onClose } = props;
  const { t, i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  /** DEC-461: PL key + EN default, zero hardcoded literals. */
  const tr = useCallback(
    (key: string, en: string, opts?: Record<string, unknown>) =>
      t(`meeting.protocol.${key}`, en, opts),
    [t]
  );

  const [preview, setPreview] = useState<ProtocolPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [errataNote, setErrataNote] = useState('');
  const [exporting, setExporting] = useState(false);
  const [densityMode, setDensityMode] = useState<PresentationMode>('n');

  const load = useCallback(async () => {
    setLoading(true);
    setErrorCode(null);
    try {
      setPreview(await fetchMeetingProtocolPreview(meetingId));
    } catch (error) {
      const code = error instanceof Error ? error.message : 'load_failed';
      setErrorCode(code);
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    void load();
  }, [load]);

  const blocks: ProtocolBlock[] = preview?.content.blocks ?? [];
  const version = preview?.version ?? '1.0';
  /**
   * W109b: the working view is ALWAYS a live draft, so `status` is always
   * 'draft' here. Whether anything has been frozen lives in `publishedVersion`
   * — that (not `status`) gates the Approve primary and the errata panel.
   */
  const publishedVersion = preview?.publishedVersion ?? null;
  const isPublished = publishedVersion != null;
  const meta = blockOf(blocks, 'meta');
  const roles = blockOf(blocks, 'roles');
  const attendance = blockOf(blocks, 'attendance');
  const agenda = blockOf(blocks, 'agenda');
  const proceedings = blockOf(blocks, 'proceedings');
  const decisions = blockOf(blocks, 'decisions');
  const actions = blockOf(blocks, 'actions');
  const footer = blockOf(blocks, 'footer');

  const runApprove = useCallback(async () => {
    setBusy(true);
    setActionError(null);
    try {
      await approveMeetingProtocol(meetingId);
      await load();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'approve_failed');
    } finally {
      setBusy(false);
    }
  }, [meetingId, load]);

  const runErrata = useCallback(async () => {
    const note = errataNote.trim();
    if (!note) {
      setActionError('MEETING_PROTOCOL_ERRATA_REQUIRED');
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      await createMeetingProtocolErrata(meetingId, note);
      setErrataNote('');
      await load();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'errata_failed');
    } finally {
      setBusy(false);
    }
  }, [meetingId, errataNote, load]);

  const runExport = useCallback(async () => {
    setExporting(true);
    setActionError(null);
    try {
      await exportMeetingProtocolDocx(meetingId);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'MEETING_PROTOCOL_EXPORT_FAILED');
    } finally {
      setExporting(false);
    }
  }, [meetingId]);

  /** The continuous document — every present block, in generation order. */
  const document = useMemo<React.ReactNode>(() => {
    if (loading) {
      return <div className={STATE_BOX}>{tr('loading', 'Loading the protocol…')}</div>;
    }
    if (errorCode) {
      return (
        <div className={STATE_BOX}>
          {errorCode === 'HTTP_404' || errorCode === 'MEETING_NOT_FOUND'
            ? tr('stateNotFound', 'No protocol is available for this meeting.')
            : tr('stateLoadFailed', 'The protocol could not be loaded. Try again.')}
        </div>
      );
    }
    if (!preview) return null;

    return (
      <div className="space-y-6" data-testid="meeting-protocol-document">
        {/* 1. Meta — always present: the document heading. */}
        <section className={BLOCK}>
          <h1 className="text-xl font-semibold text-c-text">
            {meta?.title?.trim() || meetingTitle?.trim() || tr('untitled', 'Meeting protocol')}
          </h1>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <div className={LABEL}>{tr('when', 'When')}</div>
              <div className={`${BODY} flex items-center gap-1.5`}>
                <CalendarDays size={14} className="text-c-text-muted" />
                {formatDate(meta?.startAt ?? null, isPolish)} — {formatDate(meta?.endAt ?? null, isPolish)}
              </div>
            </div>
            <div>
              <div className={LABEL}>{tr('location', 'Location')}</div>
              <div className={`${BODY} flex items-center gap-1.5`}>
                <MapPin size={14} className="text-c-text-muted" />
                {meta?.location?.trim() || '—'}
              </div>
            </div>
            <div>
              <div className={LABEL}>{tr('type', 'Type')}</div>
              <div className={BODY}>{meta?.meetingType?.trim() || '—'}</div>
            </div>
            <div>
              <div className={LABEL}>{tr('lifecycle', 'Lifecycle')}</div>
              <div className={BODY}>{meta?.lifecycleState?.trim() || '—'}</div>
            </div>
          </div>
        </section>

        {/* 2. Roles — chair / scribe / approver by name. */}
        {roles && (
          <Block icon={Users} title={tr('roles', 'Roles')}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <div className={LABEL}>{tr('chair', 'Chair')}</div>
                <div className={BODY}>{roles.chair || '—'}</div>
              </div>
              <div>
                <div className={LABEL}>{tr('scribe', 'Scribe')}</div>
                <div className={BODY}>{roles.scribe || '—'}</div>
              </div>
              <div>
                <div className={LABEL}>{tr('approver', 'Approver')}</div>
                <div className={BODY}>{roles.approver || '—'}</div>
              </div>
            </div>
          </Block>
        )}

        {/* 3. Attendance — RSVP split. */}
        {attendance && (
          <Block icon={Users} title={tr('attendance', 'Attendance')}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <NameList title={tr('accepted', 'Accepted')} names={attendance.accepted} />
              <NameList title={tr('declined', 'Declined')} names={attendance.declined} />
              <NameList title={tr('pending', 'Pending')} names={attendance.pending} />
            </div>
          </Block>
        )}

        {/* 4. Agenda — ordered points from the agenda register. */}
        {agenda && agenda.items.length > 0 && (
          <Block icon={ListChecks} title={tr('agenda', 'Agenda')}>
            <ol className="space-y-3">
              {agenda.items.map((item) => (
                <li key={`${item.position}-${item.title}`} className="border-b border-c-border-subtle pb-3 last:border-0 last:pb-0">
                  <div className={`${BODY} font-medium text-c-text`}>
                    {item.position}. {item.title}
                  </div>
                  <div className={`${LABEL} mt-0.5 normal-case`}>
                    {[
                      item.durationMinutes ? `${item.durationMinutes} min` : null,
                      item.purpose || null,
                      item.lead ? `${tr('lead', 'Lead')}: ${item.lead}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                  {item.notes?.trim() ? <p className={`${BODY} mt-1`}>{item.notes}</p> : null}
                </li>
              ))}
            </ol>
          </Block>
        )}

        {/* 5. Proceedings — per-point notes with decision/action counts. */}
        {proceedings && proceedings.points.length > 0 && (
          <Block icon={MessageSquareText} title={tr('proceedings', 'Proceedings')}>
            <ol className="space-y-3">
              {proceedings.points.map((point) => (
                <li key={`${point.position}-${point.title}`} className="border-b border-c-border-subtle pb-3 last:border-0 last:pb-0">
                  <div className={`${BODY} font-medium text-c-text`}>
                    {point.position}. {point.title}
                  </div>
                  {point.notes?.trim() ? <p className={`${BODY} mt-1`}>{point.notes}</p> : null}
                  <div className={`${LABEL} mt-1 normal-case`}>
                    {tr('counts', '{{decisions}} decisions · {{actions}} actions', {
                      decisions: point.decisionCount,
                      actions: point.actionCount,
                    })}
                  </div>
                </li>
              ))}
            </ol>
          </Block>
        )}

        {/* 6. Decisions — from the decision register (or approved-note fallback). */}
        {decisions && decisions.items.length > 0 && (
          <Block icon={CheckSquare} title={tr('decisions', 'Decisions')}>
            <div className={`${LABEL} mb-3 normal-case`} data-testid="decisions-source">
              {decisions.source === 'approved_note'
                ? tr('sourceApprovedNote', 'From approved note')
                : tr('sourceDecisionsRegister', 'From decisions register')}
            </div>
            <ol className="space-y-4">
              {decisions.items.map((decision, index) => (
                <li key={`decision-${index}`} className="border-b border-c-border-subtle pb-4 last:border-0 last:pb-0">
                  <div className="text-sm font-medium text-c-text">{decision.statement}</div>
                  {decision.rationale?.trim() ? (
                    <p className={`${BODY} mt-1`}>{decision.rationale}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {decision.owner ? (
                      <span className={BODY}>
                        <span className={LABEL}>{tr('owner', 'Owner')}: </span>
                        {decision.owner}
                      </span>
                    ) : null}
                    {decision.decisionType ? (
                      <span className={BODY}>
                        <span className={LABEL}>{tr('decisionType', 'Type')}: </span>
                        {decision.decisionType}
                      </span>
                    ) : null}
                    {decision.impact ? (
                      <span className={BODY}>
                        <span className={LABEL}>{tr('impact', 'Impact')}: </span>
                        {decision.impact}
                      </span>
                    ) : null}
                    {decision.decidedBy ? (
                      <span className={BODY}>
                        <span className={LABEL}>{tr('decidedBy', 'Decided by')}: </span>
                        {decision.decidedBy}
                      </span>
                    ) : null}
                  </div>
                  {decision.rejectedAlternative ? (
                    <p className={`${BODY} mt-1`}>
                      <span className={LABEL}>{tr('rejectedAlternative', 'Rejected alternative')}: </span>
                      {decision.rejectedAlternative}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          </Block>
        )}

        {/* 7. Actions — follow-ups with task-status readback. */}
        {actions && actions.items.length > 0 && (
          <Block icon={ClipboardList} title={tr('actions', 'Actions')}>
            <div className={`${LABEL} mb-3 normal-case`} data-testid="actions-source">
              {actions.source === 'approved_note'
                ? tr('sourceApprovedNote', 'From approved note')
                : tr('sourceFollowUpsRegister', 'From follow-ups register')}
            </div>
            <ol className="space-y-3">
              {actions.items.map((action, index) => (
                <li key={`action-${index}`} className="border-b border-c-border-subtle pb-3 last:border-0 last:pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-medium text-c-text">{action.title}</div>
                    <span className={PILL}>{action.taskStatus || action.status}</span>
                  </div>
                  <div className={`${LABEL} mt-1 normal-case`}>
                    {[
                      action.owner ? `${tr('owner', 'Owner')}: ${action.owner}` : null,
                      action.dueAt ? `${tr('due', 'Due')}: ${formatDate(action.dueAt, isPolish)}` : null,
                      action.agendaItemTitle ? `${tr('agendaPoint', 'Agenda point')}: ${action.agendaItemTitle}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </li>
              ))}
            </ol>
          </Block>
        )}

        {/* 8. Footer — next occurrence (version history lives in the panel). */}
        <section className={BLOCK}>
          <div className="flex items-center justify-between">
            <div>
              <div className={LABEL}>{tr('nextOccurrence', 'Next occurrence')}</div>
              <div className={BODY}>{footer?.nextOccurrence?.trim() || tr('none', 'None')}</div>
            </div>
            <div className={LABEL}>{tr('version', 'Version') + ` ${version}`}</div>
          </div>
        </section>
      </div>
    );
  }, [
    loading,
    errorCode,
    preview,
    meta,
    roles,
    attendance,
    agenda,
    proceedings,
    decisions,
    actions,
    footer,
    version,
    meetingTitle,
    isPolish,
    tr,
  ]);

  const sections = useMemo<StandardSekcjaDef[]>(
    () => [
      {
        id: 'protocol',
        icon: FileText,
        label: { en: 'Protocol', pl: 'Protokół' },
        title: { en: 'Protocol', pl: 'Protokół' },
        alwaysShow: true,
        component: document,
        aiContract: {
          none: true,
          reason:
            'MTG-2a: the protocol is generated from meeting registers, not an AI draft — there is no AI state to render.',
        },
      },
    ],
    [document]
  );

  const versions = footer?.versions ?? [];
  const statusLabel = isPublished
    ? tr('statusApproved', 'Approved') + ` v${publishedVersion}`
    : tr('statusDraft', 'Draft') + ` v${version}`;

  const rightPanel = useMemo(
    () => ({
      actions:
        !loading && !errorCode && preview
          ? {
              label: tr('actionsPanel', 'Actions'),
              actionIds: ['protocol-export', ...(isPublished && canManage ? ['protocol-errata'] : [])],
              children: (
                <div className="space-y-3">
                  <button
                    type="button"
                    id="protocol-export"
                    data-testid="protocol-export"
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-c-border px-3 py-2 text-sm text-c-text hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:opacity-50"
                    onClick={() => void runExport()}
                    disabled={exporting}
                  >
                    {exporting ? (
                      <Loader2 size={16} className="animate-spin text-c-text-muted" />
                    ) : (
                      <Download size={16} className="text-c-text-muted" />
                    )}
                    {tr('exportDocx', 'Export DOCX')}
                  </button>
                  {isPublished && canManage ? (
                    <div className="space-y-2">
                      <label className={LABEL} htmlFor="protocol-errata-note">
                        {tr('errataNote', 'Errata note')}
                      </label>
                      <textarea
                        id="protocol-errata-note"
                        className="w-full rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                        rows={3}
                        value={errataNote}
                        placeholder={tr('errataPlaceholder', 'Describe the correction…')}
                        onChange={(event) => setErrataNote(event.target.value)}
                      />
                      <button
                        type="button"
                        id="protocol-errata"
                        className="w-full rounded-lg border border-c-border px-3 py-2 text-sm text-c-text hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:opacity-50"
                        onClick={() => void runErrata()}
                        disabled={busy || !errataNote.trim()}
                      >
                        {tr('createErrata', 'Create errata version')}
                      </button>
                    </div>
                  ) : null}
                  {actionError ? <p className="text-xs text-c-text-secondary">{actionError}</p> : null}
                </div>
              ),
            }
          : {
              pominieta: true as const,
              reason:
                loading || !preview
                  ? 'MTG-2c: no protocol is loaded yet — there is nothing to export.'
                  : 'MTG-2c: the protocol failed to load (403/404 or transport) — export would fetch the same forbidden document, so the panel stays closed.',
            },
      properties: {
        label: tr('properties', 'Properties'),
        children: (
          <ArtifactPropertiesTable
            propertyLabel={tr('property', 'Property')}
            valueLabel={tr('value', 'Value')}
            rows={[
              { id: 'status', label: tr('status', 'Status'), value: statusLabel },
              { id: 'version', label: tr('versionProp', 'Version'), value: version, mono: true },
              {
                id: 'published',
                label: tr('published', 'Published'),
                value: publishedVersion || tr('none', 'None'),
                mono: true,
              },
              { id: 'scribe', label: tr('scribe', 'Scribe'), value: roles?.scribe || '—' },
              {
                id: 'approver',
                label: tr('approver', 'Approver'),
                value: preview?.approvedByName || roles?.approver || '—',
              },
              {
                id: 'approvedAt',
                label: tr('approvedAt', 'Approved'),
                value: formatDate(preview?.approvedAt ?? null, isPolish),
                mono: true,
              },
              {
                id: 'generated',
                label: tr('generated', 'Generated'),
                value: formatDate(preview?.content.generatedAt ?? null, isPolish),
                mono: true,
              },
            ]}
          />
        ),
      },
      relations: {
        pominieta: true as const,
        reason: 'MTG-2a: a read-only protocol document has no relations source of its own.',
      },
      comments: {
        pominieta: true as const,
        reason: 'MTG-2a: protocol comments are out of read-only scope (no write path).',
      },
      history: {
        label: tr('history', 'Version history'),
        children: (
          <ul className="space-y-2">
            {versions.length === 0 ? (
              <li className={BODY}>
                {tr('version', 'Version')} {version} · {statusLabel}
              </li>
            ) : (
              versions.map((entry) => (
                <li key={entry.version} className="border-b border-c-border-subtle pb-2 last:border-0 last:pb-0">
                  <div className="flex items-center gap-1.5 text-sm text-c-text">
                    <History size={14} className="text-c-text-muted" />
                    {tr('version', 'Version')} {entry.version}
                    <span className={PILL}>{entry.status}</span>
                  </div>
                  {entry.approvedAt ? (
                    <div className={`${LABEL} mt-0.5 normal-case`}>
                      {formatDate(entry.approvedAt, isPolish)}
                      {entry.approvedBy ? ` · ${entry.approvedBy}` : ''}
                    </div>
                  ) : null}
                  {entry.errata?.trim() ? (
                    <p className={`${BODY} mt-0.5`}>{entry.errata}</p>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        ),
      },
    }),
    [
      isPublished,
      publishedVersion,
      canManage,
      errataNote,
      busy,
      actionError,
      runErrata,
      roles,
      preview,
      versions,
      version,
      statusLabel,
      isPolish,
      tr,
      loading,
      errorCode,
      exporting,
      runExport,
    ]
  );

  return (
    <StandardArtifactShell
      karta="document"
      klasa="L"
      header={{
        title:
          meta?.title?.trim() || meetingTitle?.trim() || tr('untitled', 'Meeting protocol'),
        onTitleChange: () => undefined,
        titleReadOnly: true,
        artifactType: 'report',
        artifactId: meetingId,
        onSave: () => undefined,
        saveState: 'saved',
        onClose,
        statusLabel,
        statusTone: isPublished ? 'approved' : 'draft',
      }}
      primaryAction={
        !isPublished && canManage && !errorCode
          ? {
              id: 'approve-protocol',
              label: { en: tr('approve', 'Approve'), pl: tr('approve', 'Approve') },
              icon: CheckSquare,
              disabled: busy,
              onClick: () => void runApprove(),
              title: {
                en: tr('approveTitle', 'Freeze this protocol as approved v1.0'),
                pl: tr('approveTitle', 'Freeze this protocol as approved v1.0'),
              },
            }
          : {
              intentionallyNone: true,
              reason:
                'MTG-2a: an approved protocol is frozen — editing it creates a new version through the errata action in the panel, so the header has no primary of its own (SPEC-N §2.3).',
            }
      }
      sections={sections}
      rightPanel={rightPanel}
      activeSection="protocol"
      onSectionChange={() => undefined}
      densityMode={densityMode}
      onDensityModeChange={setDensityMode}
      toolbar={
        <NModeToolbar
          isPolish={isPolish}
          activeSectionLabel={tr('open', 'Protocol')}
        />
      }
      panelAriaLabel={tr('panelAriaLabel', 'Protocol details')}
      loading={loading}
    />
  );
}

export default MeetingProtocolViewer;
