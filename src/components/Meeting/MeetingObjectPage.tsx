/**
 * `/meetings/:meetingId` — Meeting object card (stage 1, DEC-2026-08-24-07,
 * OWNER_DECISION_LEDGER). Route grammar per that decision: `/meetings`
 * (list, `MeetingHub`) + `/meetings/:meetingId` (this page) +
 * `/meetings/:meetingId/minutes|decisions|notes/:noteId` (mounted onto this
 * SAME page for now — see `routeConfig.ts` `ROUTES.MEETINGS` doc comment;
 * splitting those into distinct in-page views/deep-linked tabs is stage 2's
 * job once the full artifact ships).
 *
 * Deliberately NOT a SPEC-A artifact shell (no `ArtifactRightPanel`, no
 * kebab, no Menu 1) — stage 1 scope is "trasy + karta obiektu": a simple,
 * honest read view over REAL meeting data so the object address is never a
 * blank page. Write actions (edit / delete / toggle status / generate AI
 * notes / approve-reject a note) and the "Operator brief" panel that
 * `MeetingHub`'s inline document view also renders stay on the list route
 * for now — carrying them over here is stage 2's job once the full artifact
 * shell lands (`docs/ui-standards/TRIADA_KANON.md` / `ARTIFACT_ANATOMY_STANDARD.md`).
 *
 * There is no dedicated `GET /api/meeting/:id` endpoint on the backend
 * (`server/src/routes/meeting.routes.ts` only has `GET /` (list, org-scoped)
 * and `GET /:id/notes`) — this mirrors exactly what `MeetingHub` itself
 * already does to resolve a single meeting: fetch the org's full list and
 * find by id client-side. Flagged for stage 2 / nadzorca: a dedicated
 * single-meeting GET would be more efficient and would let this page return
 * a real "not found vs. no access" distinction instead of collapsing both
 * into the same honest-empty state.
 */
import { CalendarDays, CheckSquare2, ClipboardList, FileText, MapPin, Users } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { EmptyState } from '@/components/shared/states';
import { ErrorState, LoadingState } from '@/components/ui/primitives';
import { StatusChip } from '@/components/ui/primitives/chips';
import { ROUTES } from '@/routes/routeConfig';
import { Api, type GovernedMeetingNoteDto } from '@/services/api';

import { deriveMeetingLifecycle, formatDateTime, type MeetingItem } from './MeetingHub';

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

export const MeetingObjectPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');
  const navigate = useNavigate();
  const { meetingId = '' } = useParams<{ meetingId: string }>();

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
      const data = await (Api as any).getMeetings?.();
      const rows: MeetingItem[] = Array.isArray(data) ? data : data?.meetings || [];
      const found = rows.find((item) => item.id === meetingId) || null;
      setMeeting(found);
      setNotFound(!found);
    } catch (error) {
      console.error('Failed to load meeting:', error);
      setMeeting(null);
      setLoadError(t('meeting.errors.loadFailed', 'Failed to load meetings'));
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

          <div className="grid gap-4 p-5 lg:grid-cols-2">
            <ListField
              icon={<Users size={14} />}
              label={t('meeting.attendees2', 'Attendees')}
              items={meeting.attendees}
            />
            <ListField icon={<FileText size={14} />} label="Pre-read" items={meeting.preRead} />
            <ListField icon={<ClipboardList size={14} />} label="Agenda" items={meeting.agenda} />
            <ListField
              icon={<CheckSquare2 size={14} />}
              label={t('meeting.decisions2', 'Decisions')}
              items={meeting.decisions}
            />

            <div className="lg:col-span-2 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-c-text-muted">
                <FileText size={14} />
                <span>{t('meeting.object.minutes', 'Minutes')}</span>
              </div>
              {notesLoading ? (
                <LoadingState variant="spinner" className="h-24" />
              ) : notesError ? (
                <ErrorState message={notesError} retry={() => void loadNotes(meeting.id)} />
              ) : notes.length ? (
                <div className="space-y-2">
                  {notes.map((note) => (
                    <div key={note.id} className="rounded-lg border border-c-border-subtle px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <StatusChip tone={noteStatusTone(note.status)} label={note.status} />
                        {note.createdAt ? (
                          <span className="text-xs text-c-text-muted">
                            {formatDateTime(note.createdAt, isPolish)}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-sm text-c-text-secondary">{note.summary || '—'}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-c-text-muted">—</div>
              )}
            </div>

            <div className="lg:col-span-2 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-c-text-muted">
                <CheckSquare2 size={14} />
                <span>{t('meeting.followUps2', 'Follow-ups')}</span>
              </div>
              {meeting.followUps.length ? (
                <div className="space-y-2">
                  {meeting.followUps.map((item) => (
                    <div key={item.id} className="w-full rounded-xl border border-c-border-subtle px-3 py-2 text-left">
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetingObjectPage;
