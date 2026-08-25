/**
 * `/meetings/:meetingId` — Meeting object card (DEC-2026-08-24-07,
 * OWNER_DECISION_LEDGER). Route grammar per that decision: `/meetings`
 * (list, `MeetingHub`) + `/meetings/:meetingId` (this page, "Szczegóły") +
 * `/meetings/:meetingId/minutes` ("Protokół") +
 * `/meetings/:meetingId/decisions` ("Decyzje i działania") +
 * `/meetings/:meetingId/notes/:noteId` (also "Protokół", scrolled/highlighted
 * to that one note) — all four mount this SAME page, which reads the active
 * section straight off `location.pathname` and re-navigates on tab click.
 *
 * Deliberately NOT a SPEC-A artifact shell (no `ArtifactRightPanel`, no
 * kebab, no Menu 1) — this is a simple, honest read view over REAL meeting
 * data so the object address is never a blank page. There are no write
 * actions here (edit / delete / toggle status / generate AI notes /
 * approve-reject a note) — that is a deliberate, explicit scope cut, not an
 * oversight: those stay on the list route's preview pane (`MeetingHub.tsx`)
 * for now, pending the full artifact shell
 * (`docs/ui-standards/TRIADA_KANON.md` / `ARTIFACT_ANATOMY_STANDARD.md`).
 *
 * Backed by the dedicated `GET /api/meeting/:id` endpoint
 * (`server/src/routes/meeting.routes.ts`) — tenant-scoped from the token,
 * 404 on missing/other-org/non-participant. `error.status === 404` (thrown
 * by `Api.getMeeting`, see `src/services/api.ts` `handleResponse`) drives the
 * honest "not found" empty state below; any other failure is a retryable
 * error, never silently collapsed into the same empty state.
 */
import { CalendarDays, CheckSquare2, ClipboardList, FileText, MapPin, Users } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { Menu3Chip } from '@/components/shared/ModuleMenu3';
import { EmptyState } from '@/components/shared/states';
import { ErrorState, LoadingState } from '@/components/ui/primitives';
import { StatusChip } from '@/components/ui/primitives/chips';
import { ROUTES } from '@/routes/routeConfig';
import { Api, type GovernedMeetingNoteDto } from '@/services/api';

import { deriveMeetingLifecycle, formatDateTime, type MeetingItem } from './MeetingHub';

type Section = 'details' | 'minutes' | 'decisions';

function ListField({
  icon,
  label,
  items,
}: {
  icon: React.ReactNode;
  label: string;
  items: string[];
}) {
  return (
    <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-c-text-muted">
        {icon}
        <span>{label}</span>
      </div>
      {items.length ? (
        <ul className="space-y-1.5">
          {items.map((item, idx) => (
            <li key={`${label}-${idx}`} className="text-sm text-c-text-secondary">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        // Honest empty state (task brief §3): "—", never invented copy.
        <div className="text-sm text-c-text-muted">—</div>
      )}
    </div>
  );
}

function noteStatusTone(status: GovernedMeetingNoteDto['status']): 'success' | 'warning' | 'danger' {
  if (status === 'approved') return 'success';
  if (status === 'rejected') return 'danger';
  return 'warning';
}

/** `decisions`/`actionItems` on a governed note are `Array<{decision?}|string>`
 * / `Array<{task?, owner?}|string>` (see `GovernedMeetingNoteDto`). Render
 * both shapes honestly instead of assuming the object form. */
function noteDecisionLabel(entry: GovernedMeetingNoteDto['decisions'][number]): string {
  if (typeof entry === 'string') return entry;
  return entry?.decision || '';
}

function noteActionLabel(entry: GovernedMeetingNoteDto['actionItems'][number]): {
  task: string;
  owner: string;
} {
  if (typeof entry === 'string') return { task: entry, owner: '' };
  return { task: entry?.task || '', owner: entry?.owner || '' };
}

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-c-text-muted">
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

export const MeetingObjectPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');
  const navigate = useNavigate();
  const location = useLocation();
  const { meetingId = '', noteId = '' } = useParams<{ meetingId: string; noteId: string }>();

  const [meeting, setMeeting] = useState<MeetingItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [notes, setNotes] = useState<GovernedMeetingNoteDto[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);

  const loadMeeting = async () => {
    setLoading(true);
    setLoadError(null);
    setNotFound(false);
    try {
      const response = await Api.getMeeting(meetingId);
      setMeeting((response?.meeting as MeetingItem) || null);
    } catch (error: any) {
      console.error('Failed to load meeting:', error);
      setMeeting(null);
      // 404 is the honest "does not exist / no access" case (server never
      // leaks cross-tenant/non-participant with a different code) — every
      // other status is a real, retryable failure and must say so.
      if (error?.status === 404) {
        setNotFound(true);
      } else {
        setLoadError(t('meeting.errors.loadFailed', 'Failed to load meetings'));
      }
    } finally {
      setLoading(false);
    }
  };

  const loadNotes = async (id: string) => {
    setNotesLoading(true);
    setNotesError(null);
    try {
      const response = await Api.listMeetingNotes(id);
      setNotes(Array.isArray(response?.notes) ? response.notes : []);
    } catch (error) {
      console.error('Failed to load meeting notes:', error);
      setNotesError(t('meeting.notes.errors.loadFailed', 'Could not load meeting note proposals.'));
    } finally {
      setNotesLoading(false);
    }
  };

  useEffect(() => {
    void loadMeeting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]);

  useEffect(() => {
    if (meeting?.id) void loadNotes(meeting.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting?.id]);

  const goToList = () => navigate(ROUTES.MEETINGS.ROOT);

  const lifecycle = meeting ? deriveMeetingLifecycle(meeting) : null;

  // The active section is derived straight from the URL, never local state,
  // so it can never drift from what the address bar/back-button say —
  // `/minutes` and `/notes/:noteId` both land on "Protokół", `/decisions` on
  // "Decyzje i działania", anything else (the bare object route) on
  // "Szczegóły".
  const activeSection: Section = useMemo(() => {
    if (location.pathname.endsWith('/minutes') || /\/notes\//.test(location.pathname)) {
      return 'minutes';
    }
    if (location.pathname.endsWith('/decisions')) return 'decisions';
    return 'details';
  }, [location.pathname]);

  const goToSection = (section: Section) => {
    const base = `${ROUTES.MEETINGS.ROOT}/${encodeURIComponent(meetingId)}`;
    navigate(section === 'details' ? base : `${base}/${section}`);
  };

  return (
    <div className="p-4 lg:p-6" data-testid="meeting-object-page">
      <button
        type="button"
        onClick={goToList}
        className="mb-3 inline-flex items-center text-sm text-c-text-muted hover:text-c-text"
      >
        ← {t('meeting.backToList', 'Back to list')}
      </button>

      {loading ? (
        <LoadingState variant="spinner" className="h-64" />
      ) : loadError ? (
        <ErrorState message={loadError} retry={() => void loadMeeting()} />
      ) : notFound || !meeting ? (
        <EmptyState
          variant="new"
          icon={CalendarDays}
          title={t('meeting.objectNotFound.title', 'Meeting not found')}
          description={t(
            'meeting.objectNotFound.description',
            'This meeting does not exist, or you do not have access to it.'
          )}
          primaryAction={{
            label: t('meeting.backToList', 'Back to list'),
            onClick: goToList,
          }}
        />
      ) : (
        <div className="rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface overflow-hidden">
          <div className="px-5 py-4 border-b border-c-border-subtle">
            <div className="text-[11px] uppercase tracking-wide text-c-text-muted">
              {t('meeting.meetingLabel', 'Meeting')}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold text-c-text truncate">{meeting.title || '—'}</h1>
              <StatusChip
                tone={
                  lifecycle === 'completed' ? 'success' : lifecycle === 'past_needs_update' ? 'warning' : 'info'
                }
                label={
                  lifecycle === 'completed'
                    ? t('meeting.status.completed', 'Completed')
                    : lifecycle === 'past_needs_update'
                      ? t('meeting.status.pastNeedsUpdate', 'Past — needs update')
                      : t('meeting.status.scheduled', 'Scheduled')
                }
              />
            </div>
            <div className="mt-1 text-sm text-c-text-muted">
              {formatDateTime(meeting.startAt, isPolish)}
              {meeting.endAt && meeting.endAt !== meeting.startAt
                ? ` – ${formatDateTime(meeting.endAt, isPolish)}`
                : ''}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-sm text-c-text-muted">
              <MapPin size={13} />
              <span>{meeting.location || '—'}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-5 py-2.5 border-b border-c-border-subtle overflow-x-auto no-scrollbar">
            <Menu3Chip active={activeSection === 'details'} onClick={() => goToSection('details')}>
              {t('meeting.object.sectionDetails', 'Szczegóły')}
            </Menu3Chip>
            <Menu3Chip active={activeSection === 'minutes'} onClick={() => goToSection('minutes')}>
              {t('meeting.object.minutes', 'Protokół')}
            </Menu3Chip>
            <Menu3Chip active={activeSection === 'decisions'} onClick={() => goToSection('decisions')}>
              {t('meeting.object.sectionDecisions', 'Decyzje i działania')}
            </Menu3Chip>
          </div>

          {activeSection === 'details' ? (
            <div className="grid gap-4 p-5 lg:grid-cols-2">
              <ListField
                icon={<Users size={14} />}
                label={t('meeting.attendees2', 'Attendees')}
                items={meeting.attendees}
              />
              <ListField icon={<FileText size={14} />} label="Pre-read" items={meeting.preRead} />
              <ListField
                icon={<ClipboardList size={14} />}
                label="Agenda"
                items={meeting.agenda}
              />
            </div>
          ) : null}

          {activeSection === 'minutes' ? (
            <div className="p-5">
              <SectionCard icon={<FileText size={14} />} title={t('meeting.object.minutes', 'Protokół')}>
                {notesLoading ? (
                  <LoadingState variant="spinner" className="h-24" />
                ) : notesError ? (
                  <ErrorState message={notesError} retry={() => void loadNotes(meeting.id)} />
                ) : notes.length ? (
                  <div className="space-y-3">
                    {notes.map((note) => {
                      const decisions = (note.decisions || []).map(noteDecisionLabel).filter(Boolean);
                      const actions = (note.actionItems || [])
                        .map(noteActionLabel)
                        .filter((item) => item.task);
                      return (
                        <div
                          key={note.id}
                          className={`rounded-lg border px-3 py-2 ${
                            noteId && note.id === noteId
                              ? 'border-c-focus ring-1 ring-c-focus'
                              : 'border-c-border-subtle'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <StatusChip tone={noteStatusTone(note.status)} label={note.status} />
                            {note.createdAt ? (
                              <span className="text-xs text-c-text-muted">
                                {formatDateTime(note.createdAt, isPolish)}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 text-sm text-c-text-secondary">{note.summary || '—'}</div>

                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            <div>
                              <div className="mb-1 text-[11px] uppercase tracking-wide text-c-text-muted">
                                {t('meeting.decisions2', 'Decisions')}
                              </div>
                              {decisions.length ? (
                                <ul className="space-y-1">
                                  {decisions.map((d, idx) => (
                                    <li key={idx} className="text-xs text-c-text-secondary">
                                      {d}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <div className="text-xs text-c-text-muted">—</div>
                              )}
                            </div>
                            <div>
                              <div className="mb-1 text-[11px] uppercase tracking-wide text-c-text-muted">
                                {t('meeting.object.actionItems', 'Action items')}
                              </div>
                              {actions.length ? (
                                <ul className="space-y-1">
                                  {actions.map((a, idx) => (
                                    <li key={idx} className="text-xs text-c-text-secondary">
                                      {a.task}
                                      {a.owner ? (
                                        <span className="text-c-text-muted"> — {a.owner}</span>
                                      ) : null}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <div className="text-xs text-c-text-muted">—</div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-c-text-muted">—</div>
                )}
              </SectionCard>
            </div>
          ) : null}

          {activeSection === 'decisions' ? (
            <div className="grid gap-4 p-5">
              <ListField
                icon={<CheckSquare2 size={14} />}
                label={t('meeting.decisions2', 'Decisions')}
                items={meeting.decisions}
              />
              <SectionCard
                icon={<CheckSquare2 size={14} />}
                title={t('meeting.followUps2', 'Follow-ups')}
              >
                {meeting.followUps.length ? (
                  <div className="space-y-2">
                    {meeting.followUps.map((item) => (
                      <div
                        key={item.id}
                        className="w-full rounded-xl border border-c-border-subtle px-3 py-2 text-left"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-c-text truncate">{item.title}</div>
                            <div className="text-xs text-c-text-muted">{item.owner}</div>
                          </div>
                          <StatusChip
                            tone={item.status === 'done' ? 'success' : 'warning'}
                            label={item.status === 'done' ? t('meeting.done', 'Done') : t('meeting.open2', 'Open')}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-c-text-muted">—</div>
                )}
              </SectionCard>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default MeetingObjectPage;
