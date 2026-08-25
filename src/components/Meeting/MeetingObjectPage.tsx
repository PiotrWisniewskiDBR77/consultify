/**
 * `/meetings/:meetingId` — Meeting object card (DEC-2026-08-24-07,
 * OWNER_DECISION_LEDGER, route grammar). Route grammar per that decision:
 * `/meetings` (list, `MeetingHub`) + `/meetings/:meetingId` (this page,
 * "Szczegóły") + `/meetings/:meetingId/minutes` ("Protokół") +
 * `/meetings/:meetingId/decisions` ("Decyzje i działania") +
 * `/meetings/:meetingId/notes/:noteId` (also "Protokół", scrolled/highlighted
 * to that one note) — all four mount this SAME page, which reads the active
 * section straight off `location.pathname` and re-navigates on tab click.
 *
 * ★ POWŁOKA ARTEFAKTU (SPEC-A, archetyp C „Rekord") — DEC-2026-08-25-52.
 * Ten ekran stał wcześniej na własnym, bespoke tabbed-card layout (Menu3Chip
 * + ręczne divy) — realne odstępstwo od CLAUDE.md §UI pkt 6/`ARTIFACT_
 * ANATOMY_STANDARD.md` §10.2/§11.2: spotkanie jest OBIEKTEM (ma tożsamość,
 * adres, cykl życia), nie zbiorem wierszy ani czymś bez powłoki. Teraz ekran
 * stoi na `StandardArtifactShell` (`src/components/standard/
 * StandardArtifactShell.tsx`), który opakowuje `NModeShell` i sam renderuje
 * `ArtifactRightPanel` — zero lokalnej imitacji powłoki. Wzorzec 1:1 z
 * `CaseWorkspace/CaseDetailScreen.tsx` (jedyny inny ekran dziś realnie
 * wołający `<StandardArtifactShell>`).
 *
 * Co z tego wynika wprost (§10.2/§11.2):
 *  · Menu 1 = powrót · tytuł · pigułka statusu (cykl życia spotkania) ·
 *    wskaźnik zapisu · kebab z kodem obiektu i linkiem — wszystko z
 *    `NModeHeader`. UCZCIWIE: `ARTIFACT_IDENTITY.meeting.icon` deklaruje
 *    `CalendarDays` (`src/utils/artifactLinks.ts`), ale `NModeHeader.tsx`'s
 *    `TYPE_ICON` (lokalna mapa nazw ikon na komponenty Lucide) nie zna dziś
 *    tego klucza — Menu 1 renderuje więc bez ikony-typu dla „meeting" (cichy
 *    fallback `null`, bez błędu). Dopisanie `CalendarDays` do `TYPE_ICON` to
 *    zmiana wspólnej powłoki (`NModeHeader.tsx`, dzieli ją 7+ artefaktów) —
 *    poza zakresem tego ekranu,
 *  · Szczegóły · Protokół · Decyzje i działania to KANONICZNA nawigacja
 *    powłoki (`sections`), nie własny pasek zakładek,
 *  · prawy panel to accordion o stałej kolejności Akcje · Właściwości ·
 *    Powiązania · Komentarze · Historia.
 *
 * UCZCIWIE o trzech sekcjach panelu bez treści: spotkania nie mają dziś
 * (a) mechanizmu powiązań z innymi artefaktami, (b) wątku komentarzy, ani
 * (c) dziennika zdarzeń w API (`meeting.routes.ts` zwraca tylko rekord
 * spotkania) — każda z trzech jest `pominięta` z konkretnym uzasadnieniem
 * (SPEC-N §2.2), a nie renderowana jako pusty akordeon udający funkcję,
 * której nie ma.
 *
 * Zero nowych akcji zapisu: ekran pozostaje czystym odczytem (primary =
 * świadomy, uzasadniony brak, SPEC-N §2.3) — edycja/usuwanie/AI-notatki
 * zostają na liście (`MeetingHub.tsx`), zgodnie z zakresem DEC-52 („zmienia
 * się tylko warstwa prezentacji").
 *
 * Backed by the dedicated `GET /api/meeting/:id` endpoint
 * (`server/src/routes/meeting.routes.ts`) — tenant-scoped from the token,
 * 404 on missing/other-org/non-participant. `error.status === 404` (thrown
 * by `Api.getMeeting`, see `src/services/api.ts` `handleResponse`) drives the
 * honest "not found" empty state below; any other failure is a retryable
 * error, never silently collapsed into the same empty state. These three
 * top-level states (loading/error/not-found) render BEFORE the shell mounts
 * — there is no honest way to fill Menu 1's title/status pill with data that
 * does not exist yet, so the shell only ever mounts once `meeting` is real.
 */
import {
  CalendarDays,
  CheckSquare2,
  ClipboardList,
  FileText,
  ListChecks,
  MapPin,
  RefreshCw,
  Users,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { PreviewActionBar } from '@/components/shared/PreviewPane';
import { EmptyState } from '@/components/shared/states';
import { ErrorState, LoadingState } from '@/components/ui/primitives';
import { StatusChip } from '@/components/ui/primitives/chips';
import { ArtifactPropertiesTable } from '@/components/standard/ArtifactPropertiesTable';
import type { KartaNKey } from '@/components/standard/registry';
import {
  StandardArtifactShell,
  type StandardSekcjaDef,
} from '@/components/standard/StandardArtifactShell';
import type { PresentationMode } from '@/hooks/usePresentationMode';
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

function noteStatusTone(
  status: GovernedMeetingNoteDto['status']
): 'success' | 'warning' | 'danger' {
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

  const [operatorBrief, setOperatorBrief] = useState<any>(null);
  const [operatorBriefLoading, setOperatorBriefLoading] = useState(false);
  const [operatorBriefError, setOperatorBriefError] = useState(false);

  const [gestosc, setGestosc] = useState<PresentationMode>('n');

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

  const loadOperatorBrief = async (id: string) => {
    setOperatorBriefLoading(true);
    setOperatorBriefError(false);
    try {
      const loader = Api.getAIOperatorMeetingBrief;
      if (typeof loader !== 'function') {
        setOperatorBrief(null);
        return;
      }
      const response = await loader(id);
      setOperatorBrief(response?.brief || response || null);
    } catch (error: any) {
      if (error?.status === 404) {
        setOperatorBrief(null);
      } else {
        console.error('Failed to load operator brief:', error);
        setOperatorBriefError(true);
      }
    } finally {
      setOperatorBriefLoading(false);
    }
  };

  useEffect(() => {
    void loadMeeting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]);

  useEffect(() => {
    if (meeting?.id) {
      void loadNotes(meeting.id);
      void loadOperatorBrief(meeting.id);
    }
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

  const goToSection = (section: string) => {
    const base = `${ROUTES.MEETINGS.ROOT}/${encodeURIComponent(meetingId)}`;
    navigate(section === 'details' ? base : `${base}/${section}`);
  };

  if (loading) {
    return (
      <div className="p-4 lg:p-6" data-testid="meeting-object-page">
        <LoadingState variant="spinner" className="h-64" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-4 lg:p-6" data-testid="meeting-object-page">
        <button
          type="button"
          onClick={goToList}
          className="mb-3 inline-flex items-center text-sm text-c-text-muted hover:text-c-text"
        >
          ← {t('meeting.backToList', 'Back to list')}
        </button>
        <ErrorState message={loadError} retry={() => void loadMeeting()} />
      </div>
    );
  }

  if (notFound || !meeting) {
    return (
      <div className="p-4 lg:p-6" data-testid="meeting-object-page">
        <button
          type="button"
          onClick={goToList}
          className="mb-3 inline-flex items-center text-sm text-c-text-muted hover:text-c-text"
        >
          ← {t('meeting.backToList', 'Back to list')}
        </button>
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
      </div>
    );
  }

  // ── Centrum: trzy sekcje = te same trasy co dziś (details/minutes/decisions) ──
  const detailsContent = (
    <div className="grid gap-4 p-5 lg:grid-cols-2">
      <ListField
        icon={<Users size={14} />}
        label={t('meeting.attendees2', 'Attendees')}
        items={meeting.attendees}
      />
      <ListField
        icon={<FileText size={14} />}
        label={t('meeting.preRead', 'Pre-read')}
        items={meeting.preRead}
      />
      <ListField
        icon={<ClipboardList size={14} />}
        label={t('meeting.agenda', 'Agenda')}
        items={meeting.agenda}
      />
      <SectionCard
        icon={<ClipboardList size={14} />}
        title={t('meeting.operatorBrief', 'Operator brief')}
      >
        {operatorBriefLoading ? (
          <LoadingState variant="spinner" className="h-20" />
        ) : operatorBriefError ? (
          <ErrorState
            message={t('meeting.operatorBriefError', 'Could not load the operator brief.')}
            retry={() => void loadOperatorBrief(meeting.id)}
          />
        ) : operatorBrief ? (
          <div
            className="space-y-2 text-sm text-c-text-secondary"
            data-testid="meeting-operator-brief"
          >
            {operatorBrief.prepSummary ? <p>{operatorBrief.prepSummary}</p> : null}
            {Array.isArray(operatorBrief.agendaGaps) && operatorBrief.agendaGaps.length ? (
              <ul className="list-disc space-y-1 pl-5">
                {operatorBrief.agendaGaps.map((item: string, index: number) => (
                  <li key={`gap-${index}`}>{item}</li>
                ))}
              </ul>
            ) : null}
            {Array.isArray(operatorBrief.followUpSuggestions) &&
            operatorBrief.followUpSuggestions.length ? (
              <ul className="list-disc space-y-1 pl-5">
                {operatorBrief.followUpSuggestions.map((item: string, index: number) => (
                  <li key={`follow-up-${index}`}>{item}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <div className="text-sm text-c-text-muted">
            {t('meeting.operatorBriefUnavailable', 'No operator brief is available.')}
          </div>
        )}
      </SectionCard>
    </div>
  );

  const minutesContent = (
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
                        {t('meeting.object.actionItems', 'Działania')}
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
  );

  const decisionsContent = (
    <div className="grid gap-4 p-5">
      <ListField
        icon={<CheckSquare2 size={14} />}
        label={t('meeting.decisions2', 'Decisions')}
        items={meeting.decisions}
      />
      <SectionCard icon={<CheckSquare2 size={14} />} title={t('meeting.followUps2', 'Follow-ups')}>
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
                    label={
                      item.status === 'done'
                        ? t('meeting.done', 'Done')
                        : t('meeting.open2', 'Open')
                    }
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
  );

  const sekcje: StandardSekcjaDef[] = [
    {
      id: 'details',
      icon: ClipboardList,
      label: {
        en: t('meeting.object.sectionDetails', 'Szczegóły'),
        pl: t('meeting.object.sectionDetails', 'Szczegóły'),
      },
      component: detailsContent,
      aiContract: {
        none: true,
        reason:
          'Treść tej sekcji to realne dane spotkania (uczestnicy, materiały, agenda) — model językowy jej nie pisze i nie ma tu czego regenerować.',
      },
    },
    {
      id: 'minutes',
      icon: FileText,
      label: {
        en: t('meeting.object.minutes', 'Protokół'),
        pl: t('meeting.object.minutes', 'Protokół'),
      },
      component: minutesContent,
      aiContract: {
        none: true,
        reason:
          'Notatki (propozycje AI) są renderowane HONESTLY z tego, co zwrócił `GET /api/meeting/:id/notes` — sekcja czyta stan, nie generuje go; generowanie żyje w widoku listy (przycisk „AI Meeting Notes").',
      },
    },
    {
      id: 'decisions',
      icon: CheckSquare2,
      label: {
        en: t('meeting.object.sectionDecisions', 'Decyzje i działania'),
        pl: t('meeting.object.sectionDecisions', 'Decyzje i działania'),
      },
      component: decisionsContent,
      aiContract: {
        none: true,
        reason: 'Decyzje i follow-upy to realne dane spotkania — model językowy ich tu nie pisze.',
      },
    },
  ];

  // ── Prawy panel (SPEC-A §11.2) ──────────────────────────────────────────
  const statusLabel =
    lifecycle === 'completed'
      ? t('meeting.status.completed', 'Completed')
      : lifecycle === 'past_needs_update'
        ? t('meeting.status.pastNeedsUpdate', 'Past — needs update')
        : t('meeting.status.scheduled', 'Scheduled');
  const statusTone: 'draft' | 'review' | 'approved' | 'rejected' | 'neutral' =
    lifecycle === 'completed' ? 'approved' : lifecycle === 'past_needs_update' ? 'review' : 'draft';

  const terminValue =
    meeting.endAt && meeting.endAt !== meeting.startAt
      ? `${formatDateTime(meeting.startAt, isPolish)} – ${formatDateTime(meeting.endAt, isPolish)}`
      : formatDateTime(meeting.startAt, isPolish);

  const statusChipTone: 'success' | 'warning' | 'info' =
    lifecycle === 'completed' ? 'success' : lifecycle === 'past_needs_update' ? 'warning' : 'info';

  const wierszeWlasciwosci = [
    {
      id: 'status',
      label: t('meeting.object.propStatus', 'Status'),
      value: <StatusChip tone={statusChipTone} label={statusLabel} />,
    },
    { id: 'termin', label: t('meeting.columns.when', 'When'), value: terminValue, mono: true },
    {
      id: 'lokalizacja',
      label: t('meeting.object.propLocation', 'Location'),
      value: meeting.location || '—',
    },
    {
      id: 'uczestnicy',
      label: t('meeting.attendees2', 'Attendees'),
      value: String(meeting.attendees.length),
    },
    {
      id: 'notatki',
      label: t('meeting.object.propNotes', 'Notes (Minutes)'),
      value: String(notes.length),
    },
  ];

  const prawyPanel = {
    actions: {
      label: t('common.actions', 'Actions'),
      icon: RefreshCw,
      children: (
        <PreviewActionBar
          rows={[
            {
              buttons: [
                {
                  label: t('meeting.object.reload', 'Reload'),
                  icon: RefreshCw,
                  colorScheme: 'neutral' as const,
                  flex: true,
                  onClick: () => void loadMeeting(),
                },
                {
                  label: t('meeting.backToList', 'Back to list'),
                  icon: ListChecks,
                  colorScheme: 'neutral' as const,
                  flex: true,
                  onClick: goToList,
                },
              ],
            },
          ]}
        />
      ),
      actionIds: ['wczytaj-ponownie', 'wroc-do-listy'],
    },
    properties: {
      label: t('meeting.object.properties', 'Properties'),
      children: (
        <ArtifactPropertiesTable
          rows={wierszeWlasciwosci}
          propertyLabel={t('meeting.object.propertyLabel', 'Property')}
          valueLabel={t('meeting.object.valueLabel', 'Value')}
        />
      ),
    },
    relations: {
      pominieta: true as const,
      reason:
        'Spotkania nie mają dziś mechanizmu powiązań z innymi obiektami (brak tabeli/serwisu linków w module Meeting) — pusty akordeon udawałby funkcję, której nie ma.',
    },
    comments: {
      pominieta: true as const,
      reason:
        'Backend spotkań nie ma wątku komentarzy (brak serwisu i tabeli) — rozmowa o spotkaniu toczy się dziś w notatkach (zakładka Protokół), nie w osobnym wątku komentarzy.',
    },
    history: {
      pominieta: true as const,
      reason:
        'Spotkania nie mają dziś dziennika zdarzeń w API (`GET /api/meeting/:id` zwraca wyłącznie bieżący rekord) — jedynym realnym zapisem zmian są propozycje notatek widoczne w zakładce Protokół, z własnymi znacznikami czasu i statusem.',
    },
  };

  return (
    <div className="h-full min-w-0" data-testid="meeting-object-page">
      <StandardArtifactShell
        /*
         * ★ UCZCIWIE: `registry.ts` (SSOT kart N) nie zna dziś klucza
         * „meeting" (zna 7 kart N, patrz `KartaNKey`) — dopisanie ósmego to
         * zmiana rejestru, nie tego ekranu. Klucz jest więc rzutowany —
         * powłoka używa go WYŁĄCZNIE do treści ostrzeżeń dev i do reguły
         * warstwy dowodowej dla kart pisanych przez AI (nie dotyczy tej
         * karty), więc rzutowanie nie wyłącza żadnej bramki obowiązującej ten
         * ekran. Ten sam wzorzec co `CaseDetailScreen.tsx` (klucz „zlecenie").
         */
        karta={'meeting' as KartaNKey}
        klasa="L"
        header={{
          title: meeting.title || '—',
          onTitleChange: () => undefined,
          titleReadOnly: true,
          artifactType: 'meeting',
          artifactId: meeting.id,
          onSave: () => undefined,
          saveState: 'saved',
          lastSavedLabel: t('meeting.object.lastSavedLabel', 'Data read from server'),
          onClose: goToList,
          statusLabel,
          statusTone,
        }}
        primaryAction={{
          intentionallyNone: true,
          reason:
            'Ta karta jest dziś czystym odczytem — edycja, usuwanie i generowanie notatek AI żyją w widoku listy (`MeetingHub.tsx`), zgodnie z zakresem DEC-2026-08-25-52. Wyłączony przycisk byłby atrapą, więc primary po prostu nie powstaje (SPEC-N §2.3: brak jest jawny i uzasadniony, nie przemilczany).',
        }}
        sections={sekcje}
        rightPanel={prawyPanel}
        activeSection={activeSection}
        onSectionChange={goToSection}
        densityMode={gestosc}
        onDensityModeChange={setGestosc}
        panelAriaLabel={t('meeting.object.panelAriaLabel', 'Meeting details')}
        loading={false}
      />
    </div>
  );
};

export default MeetingObjectPage;
