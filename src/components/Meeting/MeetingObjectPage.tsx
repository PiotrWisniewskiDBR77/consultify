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
 * ★ POWŁOKA ARTEFAKTU (SPEC-A, archetyp **B „Dokument”, klasa L**) —
 * DEC-2026-08-25-52, KOREKTA ARCHETYPU [U-51] 2026-09-16.
 *
 * KOREKTA [U-51]: ten plik deklarował do 16.09.2026 „archetyp C Rekord”.
 * Kanon mówi co innego i mówi to trzy razy: `ARTIFACT_ANATOMY_STANDARD.md:180`
 * („Meeting Notes | B Dokument”), `:253-254` (mapa nawigacyjna — poz. 35
 * „Meeting | B | L”, poz. 36 „Meeting Notes | B | S”) oraz `:1066`
 * (§13.2 instancjacja archetypu B: ikona `file-text`, Menu 1 primary
 * „Powiąż z zadaniami”, treść „agenda+decyzje+akcje”). Protokół ze spotkania
 * jest DOKUMENTEM (ciągła treść, zatwierdzenie, dystrybucja), nie rekordem z
 * polami — i z tego wynikają trzy rzeczy wprost (§5 „Archetyp B”):
 *  · Menu 2 ISTNIEJE (patrz `toolbar` niżej): Sekcje · Edycja|Podgląd,
 *  · Menu 1 ma PRIMARY (przejście cyklu życia protokołu),
 *  · panel: Akcje · Właściwości · Powiązania · Komentarze · Historia.
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
 * UCZCIWIE o sekcjach panelu bez treści [U-51, stan po korekcie]: `relations`
 * i `comments` są dalej `pominięte` z uzasadnieniem (spotkania nie mają
 * mechanizmu powiązań ani wątku komentarzy w API), natomiast `history`
 * PRZESTAŁA być pominięta: dziennikiem zmian protokołu są realne znaczniki
 * czasu propozycji notatek (`createdAt`, `decidedAt`, `materializedAt` z
 * `GET /api/meeting/:id/notes`) — to jest ten sam zasób, na który stare
 * uzasadnienie się powoływało, więc pominięcie było opisem, nie faktem.
 *
 * PRIMARY [U-51] — ZMIERZONE, nie wymyślone. Zakres zlecenia wskazywał
 * „Approve minutes” (draft) → „Distribute” (approved). Pomiar 31 tras
 * (`server/src/routes/meeting.routes.ts`):
 *  · „Approve minutes” ISTNIEJE — `POST /:id/notes/:noteId/decision`
 *    (`:1076`, `{action:'approve'}`, bramka `requireMeetingAdmin`): robi
 *    zatwierdzenie + materializację jednym wywołaniem,
 *  · „Distribute” NIE ISTNIEJE — jedyna wysyłka to `POST /:id/invitations/send`
 *    (`:577`), która rozsyła ZAPROSZENIA ICS (REQUEST/CANCEL), a nie protokół;
 *    grep „docx|pdf|export|distribut” w `meeting.routes.ts` = 0 trafień.
 * Dlatego primary jest stanowy, ale drugim stanem NIE jest atrapa „Distribute”:
 *  (1) jest propozycja notatki w stanie `proposed` → „Zatwierdź protokół”,
 *  (2) protokół zatwierdzony i ma działania bez zadania → „Powiąż z zadaniami”
 *      (dokładnie primary z kanonu §13.2 dla Meeting Notes, `:1066`), realna
 *      trasa `POST /:id/notes/:noteId/action-items/:index/task` (`:1156`),
 *  (3) nie ma czego zatwierdzić ani powiązać → jawny, uzasadniony BRAK primary
 *      (SPEC-N §2.3) zamiast wyłączonego przycisku-atrapy.
 *
 * ZMIANA D.4/D.5 (2026-08-25, dyżur dnia
 * 10 UI-wiring): sekcja „Decyzje i działania" PRZESTAŁA być czystym odczytem
 * — dodawanie/edycja/usuwanie decyzji i dodawanie/zmiana statusu follow-upów
 * to teraz realne kontrolki zapisu wewnątrz centrum karty, wołające dedykowane
 * zasoby `/decision-records` i `/follow-up-records` (meeting.routes.ts, dzień
 * 10 backendu). To NIE jest nowy `primaryAction` powłoki — to zwykłe kontrolki
 * wewnątrz sekcji, tak jak formularz notatek AI żyje wewnątrz `MeetingHub`.
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
  History,
  Link2,
  ListChecks,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import type { ArtifactCardSpec } from '@/components/shared/NModeLayout/cardSets';
import { SectionsManagerMenu } from '@/components/shared/NModeLayout/NModeCardManager';
import { NModeMenu2 } from '@/components/shared/NModeLayout/NModeMenu2';
import { useCardLayout } from '@/components/shared/NModeLayout/useCardLayout';
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
import {
  Api,
  type GovernedMeetingNoteDto,
  type MeetingDecisionRecordDto,
  type MeetingFollowUpRecordDto,
  type MeetingOperatorBriefDto,
  type MeetingParticipantDto,
} from '@/services/api';

import { deriveMeetingLifecycle, formatDateTime, type MeetingItem } from './MeetingHub';
import { translateOperatorMessage } from './meetingOperatorBriefI18n';

type Section = 'details' | 'minutes' | 'decisions';

/**
 * FIX-M-5a (D.4/D.5 owner review): `Api.*` throws a plain `Error` with
 * `.status` (HTTP status) attached by `handleResponse` (src/services/api.ts,
 * e.g. line ~1105 `err.status = res.status`) — this names that shape so the
 * `catch` blocks below can branch on `.status` without `error: any`. Same
 * convention as `DecisionApiError`
 * (src/components/MyWork/Decision/decisionWorkspaceApi.ts).
 */
interface MeetingApiError extends Error {
  status?: number;
}

function isMeetingApiError(error: unknown): error is MeetingApiError {
  return error instanceof Error;
}

/**
 * DEC-82 (owner right-panel review, 2026-08-26): "czas trwania" metric for
 * the Properties table. No existing formatter in the repo computes a
 * duration from two timestamps (grepped `formatDuration`/duration helpers —
 * none), so this is local to the one metric that needs it. Honest fallback:
 * malformed/zero/negative spans render '—', never a fabricated "0m".
 */
function formatMeetingDuration(startAt: string, endAt: string, isPolish: boolean): string {
  const start = new Date(startAt).getTime();
  const end = new Date(endAt || startAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return '—';
  const totalMinutes = Math.round((end - start) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) {
    return isPolish ? `${hours} godz ${minutes} min` : `${hours}h ${minutes}m`;
  }
  if (hours > 0) return isPolish ? `${hours} godz` : `${hours}h`;
  return isPolish ? `${minutes} min` : `${minutes}m`;
}

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

/**
 * [U-51] Uczestnicy jako OSOBY: nazwisko · rola · RSVP.
 *
 * Właściciel (U-51, 15.09): „ATTENDEES jako surowe adresy e-mail zamiast
 * nazwisk”. Nazwiska, role i statusy odpowiedzi leżą w `meeting_participants`
 * (migracja 20261075) i są zwracane przez `GET /api/meeting/:id/participants`
 * (`meeting.routes.ts:462`) — front nie miał do tej trasy ANI JEDNEGO
 * wołacza. Ten komponent renderuje dokładnie to, co zwrócił serwer; e-mail
 * jest FALLBACKIEM etykiety (gdy `displayName` pusty), a legacy
 * `attendees_json` fallbackiem CAŁEJ sekcji (gdy spotkanie nie ma wierszy
 * uczestników) — nigdy odwrotnie, żeby brak danych nie udawał danych.
 */
function ParticipantsField({
  participants,
  legacyAttendees,
  loading,
  error,
  onRetry,
  t,
}: {
  participants: MeetingParticipantDto[];
  legacyAttendees: string[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  t: (key: string, fallback?: string) => string;
}) {
  const roleLabel = (role: MeetingParticipantDto['role']) =>
    role === 'organizer'
      ? t('meeting.participants.roleOrganizer', 'Organizer')
      : role === 'optional'
        ? t('meeting.participants.roleOptional', 'Optional')
        : t('meeting.participants.roleAttendee', 'Attendee');

  const rsvp = (
    status: MeetingParticipantDto['invitationStatus']
  ): { label: string; tone: 'success' | 'warning' | 'danger' | 'info' } => {
    switch (status) {
      case 'accepted':
        return { label: t('meeting.participants.rsvpAccepted', 'Accepted'), tone: 'success' };
      case 'declined':
        return { label: t('meeting.participants.rsvpDeclined', 'Declined'), tone: 'danger' };
      case 'tentative':
        return { label: t('meeting.participants.rsvpTentative', 'Tentative'), tone: 'warning' };
      case 'invited':
        return { label: t('meeting.participants.rsvpInvited', 'Invited'), tone: 'info' };
      default:
        return { label: t('meeting.participants.rsvpNoResponse', 'No response'), tone: 'warning' };
    }
  };

  return (
    <div
      className="rounded-xl border border-c-border-subtle bg-c-surface p-3"
      data-testid="meeting-participants"
    >
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-c-text-muted">
        <Users size={14} />
        <span>{t('meeting.attendees2', 'Attendees')}</span>
      </div>
      {loading ? (
        <LoadingState variant="spinner" className="h-16" />
      ) : error ? (
        <ErrorState message={error} retry={onRetry} />
      ) : participants.length ? (
        <ul className="space-y-1.5">
          {participants.map((person) => {
            const answer = rsvp(person.invitationStatus);
            const name = person.displayName?.trim() || person.email || '—';
            return (
              <li
                key={person.id}
                className="flex flex-wrap items-center justify-between gap-2 py-0.5"
              >
                <span className="min-w-0 truncate text-sm text-c-text-secondary">{name}</span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className="text-xs text-c-text-muted">{roleLabel(person.role)}</span>
                  <StatusChip tone={answer.tone} label={answer.label} />
                </span>
              </li>
            );
          })}
        </ul>
      ) : legacyAttendees.length ? (
        <div className="space-y-1.5" data-testid="meeting-participants-legacy">
          <ul className="space-y-1.5">
            {legacyAttendees.map((item, idx) => (
              <li key={`legacy-${idx}`} className="text-sm text-c-text-secondary">
                {item}
              </li>
            ))}
          </ul>
          <div className="text-xs text-c-text-muted">
            {t(
              'meeting.participants.legacyHint',
              'Invitation list only — no roles or RSVP recorded for this meeting.'
            )}
          </div>
        </div>
      ) : (
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
  const [actionItemTasks, setActionItemTasks] = useState<Record<string, 'saving' | 'created'>>({});
  const actionItemTaskLocks = useRef(new Set<string>());

  const [operatorBrief, setOperatorBrief] = useState<MeetingOperatorBriefDto | null>(null);
  const [operatorBriefLoading, setOperatorBriefLoading] = useState(false);
  const [operatorBriefError, setOperatorBriefError] = useState(false);

  // D.4/D.5 (day 10 UI wiring): decision-records + follow-up-records section
  // state ("Decyzje i działania"). Independent load/error/loading per
  // resource so one 404/failure doesn't blank the other list, same honest-
  // error discipline as `notes`/`operatorBrief` above.
  const [decisionRecords, setDecisionRecords] = useState<MeetingDecisionRecordDto[]>([]);
  const [decisionRecordsLoading, setDecisionRecordsLoading] = useState(false);
  const [decisionRecordsError, setDecisionRecordsError] = useState<string | null>(null);
  const [decisionStatement, setDecisionStatement] = useState('');
  const [decisionRationale, setDecisionRationale] = useState('');
  const [decisionSaving, setDecisionSaving] = useState(false);
  const [editingDecisionId, setEditingDecisionId] = useState<string | null>(null);
  const [editingDecisionStatement, setEditingDecisionStatement] = useState('');
  const [editingDecisionRationale, setEditingDecisionRationale] = useState('');
  const [decisionActionId, setDecisionActionId] = useState<string | null>(null);

  const [followUpRecords, setFollowUpRecords] = useState<MeetingFollowUpRecordDto[]>([]);
  const [followUpRecordsLoading, setFollowUpRecordsLoading] = useState(false);
  const [followUpRecordsError, setFollowUpRecordsError] = useState<string | null>(null);
  const [followUpTitle, setFollowUpTitle] = useState('');
  const [followUpOwner, setFollowUpOwner] = useState('');
  const [followUpDueAt, setFollowUpDueAt] = useState('');
  const [followUpSaving, setFollowUpSaving] = useState(false);
  const [followUpActionId, setFollowUpActionId] = useState<string | null>(null);

  const [gestosc, setGestosc] = useState<PresentationMode>('n');

  // [U-51] Uczestnicy jako osoby — `GET /api/meeting/:id/participants`.
  const [participants, setParticipants] = useState<MeetingParticipantDto[]>([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [participantsError, setParticipantsError] = useState<string | null>(null);

  // [U-51] Menu 2 (archetyp B): „Edycja | Podgląd”. Podgląd chowa jedyne
  // kontrolki zapisu tej karty (formularze w sekcji „Decyzje i działania”),
  // czyli daje realny tryb „do pokazania klientowi”, a nie dekoracyjny
  // przełącznik.
  const [readMode, setReadMode] = useState(false);

  // [U-51] Menu 2 → „Sekcje”: kanoniczny `SectionsManagerMenu` na kanonicznym
  // szwie `useCardLayout(spec)`. Spec budujemy lokalnie (trzy sekcje = trzy
  // trasy tej karty), zamiast dopisywać ósmy wpis do `DEFAULT_CARD_SETS`.
  const specSekcji = useMemo<ArtifactCardSpec>(
    () => ({
      catalog: [
        {
          id: 'details',
          label: { en: 'Details', pl: 'Szczegóły' },
          // `ICONS` w `NModeCardManager` nie zna `ClipboardList` (cichy
          // fallback na `Layers`) — deklarujemy `Layers` wprost.
          icon: 'Layers',
          core: true,
        },
        { id: 'minutes', label: { en: 'Minutes', pl: 'Protokół' }, icon: 'FileText', core: true },
        {
          id: 'decisions',
          label: { en: 'Decisions & actions', pl: 'Decyzje i działania' },
          icon: 'CheckSquare',
          core: true,
        },
      ],
      sets: [
        {
          id: 'default',
          label: { en: 'Meeting minutes', pl: 'Protokół spotkania' },
          cards: ['details', 'minutes', 'decisions'],
        },
      ],
    }),
    []
  );
  const ukladSekcji = useCardLayout({ artifactType: 'tool', spec: specSekcji });

  // DEC-82: "Organizer" property row resolves `meeting.createdBy` (a user id,
  // see `MeetingItem.createdBy` in MeetingHub.tsx) against the org roster —
  // same pattern as `DecisionDetailView.loadUsers`/`deciderUser`. `GET /users`
  // is ADMIN/OWNER/SUPERADMIN-gated (users.routes.ts) and 403s for a plain
  // member; that failure is swallowed on purpose (best-effort roster) so the
  // Properties table degrades to '—' instead of breaking the card for
  // non-admins.
  const [users, setUsers] = useState<Array<{ id: string; firstName: string; lastName: string }>>(
    []
  );

  const loadUsers = async () => {
    try {
      const response = await Api.getUsers();
      setUsers(
        (Array.isArray(response) ? response : []).map((u) => ({
          id: u.id,
          firstName: u.firstName,
          lastName: u.lastName,
        }))
      );
    } catch (error) {
      console.error('Failed to load organization users for organizer lookup:', error);
    }
  };

  const loadMeeting = async () => {
    setLoading(true);
    setLoadError(null);
    setNotFound(false);
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      const response = await Promise.race([
        Api.getMeeting(meetingId),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(
            () => reject(new Error('Meeting request timed out after 20 seconds')),
            20_000
          );
        }),
      ]);
      setMeeting((response?.meeting as MeetingItem) || null);
    } catch (error: unknown) {
      console.error('Failed to load meeting:', error);
      setMeeting(null);
      // 404 is the honest "does not exist / no access" case (server never
      // leaks cross-tenant/non-participant with a different code) — every
      // other status is a real, retryable failure and must say so.
      if (isMeetingApiError(error) && error.status === 404) {
        setNotFound(true);
      } else {
        setLoadError(t('meeting.errors.loadFailed', 'Failed to load meetings'));
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
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

  const createTaskFromActionItem = async (noteIdValue: string, actionIndex: number) => {
    const key = `${noteIdValue}:${actionIndex}`;
    if (actionItemTaskLocks.current.has(key) || actionItemTasks[key]) return;
    actionItemTaskLocks.current.add(key);
    setActionItemTasks((current) => ({ ...current, [key]: 'saving' }));
    try {
      const response = await fetch(
        `/api/meeting/${encodeURIComponent(meetingId)}/notes/${encodeURIComponent(noteIdValue)}/action-items/${actionIndex}/task`,
        { method: 'POST', credentials: 'include' }
      );
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      setActionItemTasks((current) => ({ ...current, [key]: 'created' }));
      toast.success(t('meetingActionItemsP9.taskCreated', 'Task created'));
    } catch (error) {
      actionItemTaskLocks.current.delete(key);
      console.error('Failed to create task from meeting action item:', error);
      setActionItemTasks((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      toast.error(t('meetingActionItemsP9.taskCreateFailed', 'Could not create task'));
    }
  };

  // [U-51] Uczestnicy po nazwisku + rola + RSVP. 403 (brak prawa do listy) i
  // 404 traktujemy jak „brak wierszy” — sekcja spada wtedy na legacy
  // `attendees_json`; każdy inny błąd jest pokazany wprost, z ponowieniem.
  const loadParticipants = async (id: string) => {
    setParticipantsLoading(true);
    setParticipantsError(null);
    try {
      const response = await Api.listMeetingParticipants(id);
      setParticipants(Array.isArray(response?.participants) ? response.participants : []);
    } catch (error: unknown) {
      setParticipants([]);
      if (isMeetingApiError(error) && (error.status === 403 || error.status === 404)) {
        return;
      }
      console.error('Failed to load meeting participants:', error);
      setParticipantsError(
        t('meeting.participants.loadFailed', 'Could not load the participant list.')
      );
    } finally {
      setParticipantsLoading(false);
    }
  };

  /**
   * [U-51] PRIMARY (2) — „Powiąż z zadaniami” (kanon §13.2 dla Meeting Notes,
   * `ARTIFACT_ANATOMY_STANDARD.md:1066`).
   *
   * Nie nowa mechanika: pętla po tych samych działaniach, które sekcja
   * „Protokół” pokazuje z przyciskiem „Create task”, przez tę samą trasę
   * `POST /:id/notes/:noteId/action-items/:index/task`. Sekwencyjnie, bo
   * `createTaskFromActionItem` trzyma blokadę per pozycja i sam raportuje
   * błędy — równoległy `Promise.all` tylko zdublowałby komunikaty.
   */
  const [linkingTasks, setLinkingTasks] = useState(false);
  const linkActionsToTasks = async (items: Array<{ noteId: string; index: number }>) => {
    if (linkingTasks || !items.length) return;
    setLinkingTasks(true);
    try {
      for (const item of items) {
        await createTaskFromActionItem(item.noteId, item.index);
      }
    } finally {
      setLinkingTasks(false);
    }
  };

  /**
   * [U-51] PRIMARY (1) — „Zatwierdź protokół”.
   *
   * Realna trasa `POST /api/meeting/:id/notes/:noteId/decision`
   * (`meeting.routes.ts:1076`) robi zatwierdzenie I materializację jednym
   * wywołaniem; po niej przeładowujemy notatki, decyzje i follow-upy, żeby
   * liczniki prawego panelu liczyły stan z serwera, nie z pamięci przeglądarki.
   * Bramka `requireMeetingAdmin` zwraca 403 zwykłemu członkowi — mówimy to
   * wprost, zamiast „coś poszło nie tak”.
   */
  const [approvingNote, setApprovingNote] = useState(false);
  const approveMinutes = async (noteIdValue: string) => {
    if (approvingNote) return;
    setApprovingNote(true);
    try {
      await Api.decideMeetingNote(meetingId, noteIdValue, { action: 'approve' });
      toast.success(t('meeting.object.minutesApproved', 'Minutes approved'));
      await Promise.all([
        loadNotes(meetingId),
        loadDecisionRecords(meetingId),
        loadFollowUpRecords(meetingId),
      ]);
    } catch (error: unknown) {
      console.error('Failed to approve meeting minutes:', error);
      toast.error(
        isMeetingApiError(error) && error.status === 403
          ? t(
              'meeting.object.minutesApproveForbidden',
              'Only the meeting organizer or an administrator can approve the minutes.'
            )
          : t('meeting.object.minutesApproveFailed', 'Could not approve the minutes')
      );
    } finally {
      setApprovingNote(false);
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
      // FIX-M-5a: server route (`ai-operator.routes.ts:110`, confirmed)
      // `res.json(brief)`s the brief object directly — never a `{ brief }`
      // wrapper — so the old `response?.brief || response` fallback was dead
      // code for the first branch. Typing the response as
      // `MeetingOperatorBriefDto` (no `.brief` field) makes that honest.
      setOperatorBrief(response || null);
    } catch (error: unknown) {
      if (isMeetingApiError(error) && error.status === 404) {
        setOperatorBrief(null);
      } else {
        console.error('Failed to load operator brief:', error);
        setOperatorBriefError(true);
      }
    } finally {
      setOperatorBriefLoading(false);
    }
  };

  // D.4/D.5 (day 10 UI wiring): decision-records + follow-up-records loaders
  // for the "Decyzje i działania" section. Every write handler below
  // re-invokes these instead of splicing local state — a real GET readback
  // proving the write landed, not an optimistic client-side lie.
  const loadDecisionRecords = async (id: string) => {
    setDecisionRecordsLoading(true);
    setDecisionRecordsError(null);
    try {
      const response = await Api.listMeetingDecisionRecords(id);
      setDecisionRecords(Array.isArray(response?.decisions) ? response.decisions : []);
    } catch (error) {
      console.error('Failed to load meeting decisions:', error);
      setDecisionRecordsError(
        t('meeting.decisionRecords.errors.loadFailed', 'Could not load decisions.')
      );
    } finally {
      setDecisionRecordsLoading(false);
    }
  };

  const loadFollowUpRecords = async (id: string) => {
    setFollowUpRecordsLoading(true);
    setFollowUpRecordsError(null);
    try {
      const response = await Api.listMeetingFollowUpRecords(id);
      setFollowUpRecords(Array.isArray(response?.followUps) ? response.followUps : []);
    } catch (error) {
      console.error('Failed to load meeting follow-ups:', error);
      setFollowUpRecordsError(
        t('meeting.followUpRecords.errors.loadFailed', 'Could not load follow-ups.')
      );
    } finally {
      setFollowUpRecordsLoading(false);
    }
  };

  const handleCreateDecision = async () => {
    if (!meeting || !decisionStatement.trim()) return;
    setDecisionSaving(true);
    try {
      await Api.createMeetingDecisionRecord(meeting.id, {
        statement: decisionStatement.trim(),
        rationale: decisionRationale.trim(),
      });
      setDecisionStatement('');
      setDecisionRationale('');
      await loadDecisionRecords(meeting.id);
      toast.success(t('meeting.decisionRecords.notifications.created', 'Decision recorded'));
    } catch (error) {
      console.error('Failed to create meeting decision:', error);
      toast.error(t('meeting.decisionRecords.errors.createFailed', 'Failed to record decision'));
    } finally {
      setDecisionSaving(false);
    }
  };

  const startEditDecision = (decision: MeetingDecisionRecordDto) => {
    setEditingDecisionId(decision.id);
    setEditingDecisionStatement(decision.statement);
    setEditingDecisionRationale(decision.rationale);
  };

  const cancelEditDecision = () => {
    setEditingDecisionId(null);
    setEditingDecisionStatement('');
    setEditingDecisionRationale('');
  };

  const handleSaveDecisionEdit = async (decisionId: string) => {
    if (!meeting || !editingDecisionStatement.trim()) return;
    setDecisionActionId(decisionId);
    try {
      await Api.updateMeetingDecisionRecord(meeting.id, decisionId, {
        statement: editingDecisionStatement.trim(),
        rationale: editingDecisionRationale.trim(),
      });
      cancelEditDecision();
      await loadDecisionRecords(meeting.id);
      toast.success(t('meeting.decisionRecords.notifications.updated', 'Decision updated'));
    } catch (error) {
      console.error('Failed to update meeting decision:', error);
      toast.error(t('meeting.decisionRecords.errors.updateFailed', 'Failed to update decision'));
    } finally {
      setDecisionActionId(null);
    }
  };

  const handleToggleDecisionStatus = async (decision: MeetingDecisionRecordDto) => {
    if (!meeting) return;
    const nextStatus = decision.status === 'superseded' ? 'recorded' : 'superseded';
    setDecisionActionId(decision.id);
    try {
      await Api.updateMeetingDecisionRecord(meeting.id, decision.id, { status: nextStatus });
      await loadDecisionRecords(meeting.id);
    } catch (error) {
      console.error('Failed to update meeting decision status:', error);
      toast.error(t('meeting.decisionRecords.errors.updateFailed', 'Failed to update decision'));
    } finally {
      setDecisionActionId(null);
    }
  };

  const handleDeleteDecision = async (decisionId: string) => {
    if (!meeting) return;
    setDecisionActionId(decisionId);
    try {
      await Api.deleteMeetingDecisionRecord(meeting.id, decisionId);
      await loadDecisionRecords(meeting.id);
      toast.success(t('meeting.decisionRecords.notifications.deleted', 'Decision deleted'));
    } catch (error) {
      console.error('Failed to delete meeting decision:', error);
      toast.error(t('meeting.decisionRecords.errors.deleteFailed', 'Failed to delete decision'));
    } finally {
      setDecisionActionId(null);
    }
  };

  const handleCreateFollowUp = async () => {
    if (!meeting || !followUpTitle.trim()) return;
    setFollowUpSaving(true);
    try {
      await Api.createMeetingFollowUpRecord(meeting.id, {
        title: followUpTitle.trim(),
        owner: followUpOwner.trim(),
        dueAt: followUpDueAt.trim() || null,
      });
      setFollowUpTitle('');
      setFollowUpOwner('');
      setFollowUpDueAt('');
      await loadFollowUpRecords(meeting.id);
      toast.success(t('meeting.followUpRecords.notifications.created', 'Follow-up added'));
    } catch (error) {
      console.error('Failed to create meeting follow-up:', error);
      toast.error(t('meeting.followUpRecords.errors.createFailed', 'Failed to add follow-up'));
    } finally {
      setFollowUpSaving(false);
    }
  };

  const handleToggleFollowUpStatus = async (followUp: MeetingFollowUpRecordDto) => {
    if (!meeting) return;
    const nextStatus = followUp.status === 'done' ? 'open' : 'done';
    setFollowUpActionId(followUp.id);
    try {
      await Api.updateMeetingFollowUpRecord(meeting.id, followUp.id, { status: nextStatus });
      await loadFollowUpRecords(meeting.id);
    } catch (error) {
      console.error('Failed to update meeting follow-up status:', error);
      toast.error(t('meeting.followUpRecords.errors.updateFailed', 'Failed to update follow-up'));
    } finally {
      setFollowUpActionId(null);
    }
  };

  const handleDeleteFollowUp = async (followUpId: string) => {
    if (!meeting) return;
    setFollowUpActionId(followUpId);
    try {
      await Api.deleteMeetingFollowUpRecord(meeting.id, followUpId);
      await loadFollowUpRecords(meeting.id);
      toast.success(t('meeting.followUpRecords.notifications.deleted', 'Follow-up deleted'));
    } catch (error) {
      console.error('Failed to delete meeting follow-up:', error);
      toast.error(t('meeting.followUpRecords.errors.deleteFailed', 'Failed to delete follow-up'));
    } finally {
      setFollowUpActionId(null);
    }
  };

  useEffect(() => {
    void loadMeeting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]);

  // Org roster for the "Organizer" property row — loaded once, independent
  // of which meeting is open (same roster for every meeting in the org).
  useEffect(() => {
    void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (meeting?.id) {
      void loadNotes(meeting.id);
      void loadParticipants(meeting.id);
      void loadOperatorBrief(meeting.id);
      void loadDecisionRecords(meeting.id);
      void loadFollowUpRecords(meeting.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting?.id]);

  const goToList = () => navigate(ROUTES.MEETINGS.ROOT);

  const lifecycle = meeting ? deriveMeetingLifecycle(meeting) : null;

  const approvedNoteDecisions = notes
    .filter((note) => note.status === 'approved')
    .flatMap((note) =>
      note.decisions
        .map((decision, index) => ({
          key: `${note.id}-${index}`,
          label: noteDecisionLabel(decision),
        }))
        .filter((decision) => decision.label)
    );

  // [U-51] Działania z ZATWIERDZONYCH notatek — zasilają primary „Powiąż z
  // zadaniami” oraz licznik follow-upów.
  const approvedNoteActionItems = notes
    .filter((note) => note.status === 'approved')
    .flatMap((note) =>
      (note.actionItems || []).map((item, index) => ({
        noteId: note.id,
        index,
        ...noteActionLabel(item),
      }))
    )
    .filter((item) => item.task);
  const actionItemsWithoutTask = approvedNoteActionItems.filter(
    (item) => !actionItemTasks[`${item.noteId}:${item.index}`]
  );

  /** [U-51] Propozycja protokołu czekająca na decyzję człowieka. */
  const pendingNote = notes.find((note) => note.status === 'proposed') || null;

  /**
   * [U-51] JEDNO ŹRÓDŁO LICZNIKÓW (właściciel: „Decisions 0 / Follow-ups 0
   * mimo 1 decyzji w Minutes”).
   *
   * Źródłem prawdy zostają rejestry `meeting_decisions` /
   * `meeting_follow_ups` (trasy `/decision-records`, `/follow-up-records`) —
   * tak jak dotąd, bez zmiany schematu. Nowe jest to, że licznik NIE MILCZY o
   * treści, którą sekcja „Protokół” rysuje z `meeting_notes`: pozycje z
   * zatwierdzonej notatki, którym nie odpowiada żaden wiersz rejestru
   * (`sourceKind === 'note'` / `sourceNoteId`), są policzone osobno i pokazane
   * jako „N in minutes, not yet recorded”. Licznik mówi prawdę o obu
   * magazynach, zamiast pokazywać 0 obok widocznej treści.
   */
  const recordedFromNotes = decisionRecords.filter(
    (record) => record.sourceKind === 'note' || record.sourceNoteId
  ).length;
  const decisionsOnlyInMinutes = Math.max(0, approvedNoteDecisions.length - recordedFromNotes);
  const followUpsFromNotes = followUpRecords.filter(
    (record) => record.sourceKind === 'note' || record.sourceNoteId
  ).length;
  const followUpsOnlyInMinutes = Math.max(0, approvedNoteActionItems.length - followUpsFromNotes);

  const licznikZRejestruIProtokolu = (recorded: number, onlyInMinutes: number): string => {
    if (onlyInMinutes <= 0) return String(recorded);
    // `n`, nie `count` — `count` włączyłby w i18next liczbę mnogą (klucze
    // `_one`/`_other`), których ten komunikat nie ma i nie potrzebuje.
    const wProtokole = t('meeting.object.propCountInMinutes', {
      n: onlyInMinutes,
      defaultValue: '{{n}} in minutes, not yet recorded',
    });
    return recorded > 0 ? `${recorded} · ${wProtokole}` : wProtokole;
  };

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
      <ParticipantsField
        participants={participants}
        legacyAttendees={meeting.attendees}
        loading={participantsLoading}
        error={participantsError}
        onRetry={() => void loadParticipants(meeting.id)}
        t={t}
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
            {operatorBrief.prepSummary ? (
              <p>{translateOperatorMessage(operatorBrief.prepSummary, t)}</p>
            ) : null}
            {Array.isArray(operatorBrief.agendaGaps) && operatorBrief.agendaGaps.length ? (
              <ul className="list-disc space-y-1 pl-5">
                {operatorBrief.agendaGaps.map((item, index: number) => (
                  <li key={`gap-${index}`}>{translateOperatorMessage(item, t)}</li>
                ))}
              </ul>
            ) : null}
            {Array.isArray(operatorBrief.followUpSuggestions) &&
            operatorBrief.followUpSuggestions.length ? (
              <ul className="list-disc space-y-1 pl-5">
                {operatorBrief.followUpSuggestions.map((item, index: number) => (
                  <li key={`follow-up-${index}`}>{translateOperatorMessage(item, t)}</li>
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
      <SectionCard icon={<FileText size={14} />} title={t('meeting.object.minutes', 'Minutes')}>
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
                        {t('meeting.object.actionItems', 'Actions')}
                      </div>
                      {actions.length ? (
                        <ul className="space-y-1">
                          {actions.map((a, idx) => {
                            const taskState = actionItemTasks[`${note.id}:${idx}`];
                            return (
                            <li key={idx} className="flex items-center justify-between gap-2 text-xs text-c-text-secondary">
                              <span>{a.task}{a.owner ? <span className="text-c-text-muted"> — {a.owner}</span> : null}</span>
                              <button
                                type="button"
                                disabled={Boolean(taskState)}
                                onClick={() => void createTaskFromActionItem(note.id, idx)}
                                className="shrink-0 rounded-md border border-c-border px-2 py-1 font-medium text-c-text hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {taskState === 'created'
                                  ? t('meetingActionItemsP9.taskCreated', 'Task created')
                                  : taskState === 'saving'
                                    ? t('common.saving', 'Saving...')
                                    : t('meetingActionItemsP9.createTask', 'Create task')}
                              </button>
                            </li>
                          )})}
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

  // D.4/D.5 (day 10 UI wiring): real controls backed by the dedicated
  // `/decision-records` and `/follow-up-records` resources
  // (meeting.routes.ts), replacing the two former display-only atrapy:
  //  (1) this section used to read `meeting.decisions` — the legacy
  //      `decisions_json` array, dead once a meeting note is approved,
  //  (2) `meeting.followUps` was rendered read-only with no way to add one
  //      or mark it done from this card.
  // Both lists below re-fetch from the server after every write (readback),
  // never splice local state optimistically.
  const decisionInputClass =
    'w-full rounded-xl border border-c-border bg-transparent px-3 py-2 text-sm text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus';

  const decisionsContent = (
    <div className="grid gap-4 p-5">
      <SectionCard icon={<CheckSquare2 size={14} />} title={t('meeting.decisions2', 'Decisions')}>
        <div className="space-y-3">
          {/* [U-51] Podglad (Menu 2) = wersja do pokazania klientowi:
              kontrolki zapisu znikaja, tresc protokolu zostaje. */}
          {!readMode && (
            <div className="space-y-2 rounded-xl border border-dashed border-c-border-subtle p-3">
              <input
                className={decisionInputClass}
                placeholder={t('meeting.decisionRecords.statementPlaceholder', 'New decision…')}
                value={decisionStatement}
                onChange={(e) => setDecisionStatement(e.target.value)}
              />
              <textarea
                className={`${decisionInputClass} min-h-16`}
                placeholder={t(
                  'meeting.decisionRecords.rationalePlaceholder',
                  'Rationale (optional)'
                )}
                value={decisionRationale}
                onChange={(e) => setDecisionRationale(e.target.value)}
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void handleCreateDecision()}
                  disabled={!decisionStatement.trim() || decisionSaving}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full bg-c-text px-3 text-xs font-medium text-c-surface hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {decisionSaving ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Plus size={12} />
                  )}
                  {t('meeting.decisionRecords.add', 'Record decision')}
                </button>
              </div>
            </div>
          )}

          {decisionRecordsLoading ? (
            <LoadingState variant="spinner" className="h-16" />
          ) : decisionRecordsError ? (
            <ErrorState
              message={decisionRecordsError}
              retry={() => void loadDecisionRecords(meeting.id)}
            />
          ) : decisionRecords.length || approvedNoteDecisions.length ? (
            <div className="space-y-2">
              {/* [U-51] Te wiersze pochodza z zatwierdzonej notatki, a NIE z
                  rejestru `meeting_decisions` — dokladnie ta roznica, ktora
                  licznik w prawym panelu nazywa „N in minutes, not yet
                  recorded". Bez tej etykiety lista i licznik znow mowilyby
                  dwie rozne rzeczy o tym samym wierszu. */}
              {approvedNoteDecisions.map((decision) => (
                <div
                  key={decision.key}
                  className="rounded-xl border border-c-border-subtle px-3 py-2"
                  data-testid="meeting-decision-from-minutes"
                >
                  <div className="text-sm text-c-text-secondary">{decision.label}</div>
                  <div className="mt-1 text-xs text-c-text-muted">
                    {t('meeting.decisionRecords.fromMinutes', 'From the minutes — not yet recorded')}
                  </div>
                </div>
              ))}
              {decisionRecords.map((decision) => {
                const isEditing = editingDecisionId === decision.id;
                const busy = decisionActionId === decision.id;
                return (
                  <div
                    key={decision.id}
                    className="rounded-xl border border-c-border-subtle px-3 py-2"
                  >
                    {isEditing ? (
                      <div className="space-y-2">
                        <input
                          className={decisionInputClass}
                          value={editingDecisionStatement}
                          onChange={(e) => setEditingDecisionStatement(e.target.value)}
                        />
                        <textarea
                          className={`${decisionInputClass} min-h-16`}
                          value={editingDecisionRationale}
                          onChange={(e) => setEditingDecisionRationale(e.target.value)}
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={cancelEditDecision}
                            className="inline-flex h-8 items-center gap-1 rounded-full border border-c-border px-3 text-xs text-c-text-secondary"
                          >
                            <X size={12} />
                            {t('common.cancel', 'Cancel')}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleSaveDecisionEdit(decision.id)}
                            disabled={!editingDecisionStatement.trim() || busy}
                            className="inline-flex h-8 items-center gap-1 rounded-full bg-c-text px-3 text-xs font-medium text-c-surface disabled:opacity-50"
                          >
                            {busy ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              t('common.save', 'Save')
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm text-c-text-secondary">{decision.statement}</div>
                          {decision.rationale ? (
                            <div className="mt-1 text-xs text-c-text-muted">
                              {decision.rationale}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <StatusChip
                            tone={decision.status === 'superseded' ? 'neutral' : 'success'}
                            label={
                              decision.status === 'superseded'
                                ? t('meeting.decisionRecords.superseded', 'Superseded')
                                : t('meeting.decisionRecords.recorded', 'Recorded')
                            }
                          />
                          <button
                            type="button"
                            title={
                              decision.status === 'superseded'
                                ? t('meeting.decisionRecords.markRecorded', 'Mark recorded')
                                : t('meeting.decisionRecords.markSuperseded', 'Mark superseded')
                            }
                            onClick={() => void handleToggleDecisionStatus(decision)}
                            disabled={busy}
                            className="rounded-lg p-1.5 text-c-text-secondary hover:bg-c-surface-raised disabled:opacity-50"
                          >
                            <CheckSquare2 size={14} />
                          </button>
                          <button
                            type="button"
                            title={t('common.edit', 'Edit')}
                            onClick={() => startEditDecision(decision)}
                            disabled={busy}
                            className="rounded-lg p-1.5 text-c-text-secondary hover:bg-c-surface-raised disabled:opacity-50"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            title={t('common.delete', 'Delete')}
                            onClick={() => void handleDeleteDecision(decision.id)}
                            disabled={busy}
                            className="rounded-lg p-1.5 text-c-text-secondary hover:text-c-danger disabled:opacity-50"
                          >
                            {busy ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Trash2 size={14} />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-c-text-muted">—</div>
          )}
        </div>
      </SectionCard>

      <SectionCard icon={<CheckSquare2 size={14} />} title={t('meeting.followUps2', 'Follow-ups')}>
        <div className="space-y-3">
          {/* [U-51] Podglad (Menu 2) = wersja do pokazania klientowi:
              kontrolki zapisu znikaja, tresc protokolu zostaje. */}
          {!readMode && (
            <div className="grid gap-2 rounded-xl border border-dashed border-c-border-subtle p-3 sm:grid-cols-3">
              <input
                className={`${decisionInputClass} sm:col-span-1`}
                placeholder={t('meeting.followUpRecords.titlePlaceholder', 'Follow-up…')}
                value={followUpTitle}
                onChange={(e) => setFollowUpTitle(e.target.value)}
              />
              <input
                className={`${decisionInputClass} sm:col-span-1`}
                placeholder={t('meeting.followUpRecords.ownerPlaceholder', 'Owner')}
                value={followUpOwner}
                onChange={(e) => setFollowUpOwner(e.target.value)}
              />
              <input
                type="date"
                className={`${decisionInputClass} sm:col-span-1`}
                value={followUpDueAt}
                onChange={(e) => setFollowUpDueAt(e.target.value)}
              />
              <div className="flex justify-end sm:col-span-3">
                <button
                  type="button"
                  onClick={() => void handleCreateFollowUp()}
                  disabled={!followUpTitle.trim() || followUpSaving}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full bg-c-text px-3 text-xs font-medium text-c-surface hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {followUpSaving ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Plus size={12} />
                  )}
                  {t('meeting.followUpRecords.add', 'Add follow-up')}
                </button>
              </div>
            </div>
          )}

          {followUpRecordsLoading ? (
            <LoadingState variant="spinner" className="h-16" />
          ) : followUpRecordsError ? (
            <ErrorState
              message={followUpRecordsError}
              retry={() => void loadFollowUpRecords(meeting.id)}
            />
          ) : followUpRecords.length ? (
            <div className="space-y-2">
              {followUpRecords.map((item) => {
                const busy = followUpActionId === item.id;
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-c-border-subtle px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-c-text truncate">{item.title}</div>
                      <div className="text-xs text-c-text-muted">
                        {[item.owner, item.dueAt ? formatDateTime(item.dueAt, isPolish) : null]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void handleToggleFollowUpStatus(item)}
                        disabled={busy}
                        className="disabled:opacity-50"
                      >
                        <StatusChip
                          tone={item.status === 'done' ? 'success' : 'warning'}
                          label={
                            item.status === 'done'
                              ? t('meeting.done', 'Done')
                              : t('meeting.open2', 'Open')
                          }
                        />
                      </button>
                      <button
                        type="button"
                        title={t('common.delete', 'Delete')}
                        onClick={() => void handleDeleteFollowUp(item.id)}
                        disabled={busy}
                        className="rounded-lg p-1.5 text-c-text-secondary hover:text-c-danger disabled:opacity-50"
                      >
                        {busy ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-c-text-muted">—</div>
          )}
        </div>
      </SectionCard>
    </div>
  );

  const sekcje: StandardSekcjaDef[] = [
    {
      id: 'details',
      icon: ClipboardList,
      label: {
        en: t('meeting.object.sectionDetails', 'Details'),
        pl: t('meeting.object.sectionDetails', 'Details'),
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
        en: t('meeting.object.minutes', 'Minutes'),
        pl: t('meeting.object.minutes', 'Minutes'),
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
        en: t('meeting.object.sectionDecisions', 'Decisions & actions'),
        pl: t('meeting.object.sectionDecisions', 'Decisions & actions'),
      },
      component: decisionsContent,
      aiContract: {
        none: true,
        reason:
          'Decyzje i follow-upy to realne dane spotkania, wpisywane ręcznie przez człowieka przez formularze w tej sekcji (D.4/D.5) — model językowy ich tu nie pisze i nie ma czego regenerować.',
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

  // DEC-82 (owner right-panel review, 2026-08-26): Properties table dostrojona
  // do wzorca Decisions/Initiative — pełna metryczka spotkania, nie tylko
  // status+termin+lokalizacja+uczestnicy+notatki. Kolejność 1:1 z brief
  // właściciela: status cyklu życia · termin · czas trwania · liczba
  // uczestników · liczba decyzji · liczba follow-upów · lokalizacja ·
  // organizator.
  const durationValue = formatMeetingDuration(meeting.startAt, meeting.endAt, isPolish);
  const organizerUser = users.find((u) => u.id === meeting.createdBy);
  const organizerName = organizerUser
    ? `${organizerUser.firstName} ${organizerUser.lastName}`.trim() || '—'
    : '—';

  const wierszeWlasciwosci = [
    {
      id: 'status',
      label: t('meeting.object.propStatus', 'Status'),
      value: <StatusChip tone={statusChipTone} label={statusLabel} />,
    },
    { id: 'termin', label: t('meeting.columns.when', 'When'), value: terminValue, mono: true },
    {
      id: 'czas-trwania',
      label: t('meeting.object.propDuration', 'Duration'),
      value: durationValue,
      mono: true,
    },
    {
      id: 'uczestnicy',
      label: t('meeting.attendees2', 'Attendees'),
      // [U-51] Liczymy wiersze `meeting_participants` (to samo źródło, co
      // sekcja Szczegóły); gdy ich nie ma, spadamy na legacy `attendees_json`
      // — dokładnie tak, jak spada sama sekcja.
      value: participantsLoading ? '…' : String(participants.length || meeting.attendees.length),
    },
    {
      id: 'liczba-decyzji',
      label: t('meeting.object.propDecisionsCount', 'Decisions'),
      value:
        decisionRecordsLoading || notesLoading
          ? '…'
          : licznikZRejestruIProtokolu(decisionRecords.length, decisionsOnlyInMinutes),
    },
    {
      id: 'liczba-follow-upow',
      label: t('meeting.object.propFollowUpsCount', 'Follow-ups'),
      value:
        followUpRecordsLoading || notesLoading
          ? '…'
          : licznikZRejestruIProtokolu(followUpRecords.length, followUpsOnlyInMinutes),
    },
    {
      id: 'lokalizacja',
      label: t('meeting.object.propLocation', 'Location'),
      value: meeting.location || '—',
    },
    {
      id: 'organizator',
      label: t('meeting.object.propOrganizer', 'Organizer'),
      value: organizerName,
    },
  ];

  /**
   * [U-51] Dziennik protokołu z realnych znaczników czasu propozycji notatek.
   * Pozycja bez daty jest POMIJANA (brak pomiaru nie jest wynikiem), a autor
   * decyzji rozwiązywany po rosterze organizacji — tak samo jak wiersz
   * „Organizator” w Właściwościach.
   */
  const historyEvents = notes
    .flatMap((note) => {
      const decider = users.find((u) => u.id === note.decidedBy);
      const deciderName = decider
        ? `${decider.firstName} ${decider.lastName}`.trim()
        : note.decidedBy || '';
      const events: Array<{ id: string; label: string; at: string; sort: number }> = [];
      const push = (id: string, label: string, iso?: string | null) => {
        if (!iso) return;
        const ts = new Date(iso).getTime();
        if (!Number.isFinite(ts)) return;
        events.push({ id, label, at: formatDateTime(iso, isPolish), sort: ts });
      };
      const withWho = (label: string) => (deciderName ? `${label} — ${deciderName}` : label);
      push(
        `${note.id}-created`,
        t('meeting.object.historyProposed', 'Minutes proposed'),
        note.createdAt
      );
      if (note.status === 'approved') {
        push(
          `${note.id}-approved`,
          withWho(t('meeting.object.historyApproved', 'Minutes approved')),
          note.decidedAt
        );
      }
      if (note.status === 'rejected') {
        push(
          `${note.id}-rejected`,
          withWho(t('meeting.object.historyRejected', 'Minutes rejected')),
          note.decidedAt
        );
      }
      push(
        `${note.id}-materialized`,
        t('meeting.object.historyMaterialized', 'Minutes recorded as a document'),
        note.materializedAt
      );
      return events;
    })
    .sort((a, b) => b.sort - a.sort);

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
      // [U-51] Trzy wyszarzone atrapy (Edit meeting · Generate AI notes ·
      // Delete meeting, każda z dopiskiem „In development”) USUNIĘTE.
      // Właściciel czytał je jako „nic tu nie działa”, a wszystkie trzy mają
      // realny dom na liście (`MeetingHub.tsx`), do której prowadzi przycisk
      // obok. Wyłączony przycisk-zapowiedź jest gorszy niż jego brak.
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
    /**
     * [U-51] Historia PRZESTAJE być pominięta.
     *
     * Stare uzasadnienie samo wskazywało źródło: „jedynym realnym zapisem
     * zmian są propozycje notatek widoczne w zakładce Protokół, z własnymi
     * znacznikami czasu i statusem”. To JEST dziennik: kiedy powstała
     * propozycja protokołu, kto i kiedy ją rozstrzygnął, kiedy została
     * zmaterializowana jako dokument. Renderujemy dokładnie te zdarzenia z
     * `GET /api/meeting/:id/notes` — zero nowego backendu, zero wymyślania.
     */
    history: {
      label: t('meeting.object.history', 'History'),
      icon: History,
      children: notesLoading ? (
        <LoadingState variant="spinner" className="h-16" />
      ) : historyEvents.length ? (
        <ol className="space-y-2" data-testid="meeting-history">
          {historyEvents.map((event) => (
            <li key={event.id} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 text-sm text-c-text-secondary">{event.label}</span>
              <span className="shrink-0 text-xs tabular-nums text-c-text-muted">{event.at}</span>
            </li>
          ))}
        </ol>
      ) : (
        <div className="text-sm text-c-text-muted">
          {t('meeting.object.historyEmpty', 'No recorded changes to the minutes yet.')}
        </div>
      ),
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
        /*
         * [U-51] PRIMARY STANOWY — pomiar tras w komentarzu nagłówkowym:
         *  (1) jest propozycja protokołu `proposed` → „Zatwierdź protokół”
         *      (`POST /:id/notes/:noteId/decision`, action=approve),
         *  (2) protokół zatwierdzony, są działania bez zadania → „Powiąż z
         *      zadaniami” (kanon §13.2 dla Meeting Notes),
         *  (3) nie ma czego zatwierdzić ani powiązać → jawny, uzasadniony brak.
         * „Roześlij”/„Distribute” NIE powstaje: w `meeting.routes.ts` nie ma
         * trasy rozsyłania protokołu (jedyna wysyłka to zaproszenia ICS), więc
         * przycisk byłby czwartą atrapą obok trzech właśnie usuniętych.
         */
        primaryAction={
          pendingNote
            ? {
                id: 'zatwierdz-protokol',
                label: { en: 'Approve minutes', pl: 'Zatwierdź protokół' },
                icon: CheckSquare2,
                disabled: approvingNote || readMode,
                onClick: () => void approveMinutes(pendingNote.id),
                title: {
                  en: 'Approve the minutes proposal and record its decisions and actions',
                  pl: 'Zatwierdź propozycję protokołu i zapisz jej decyzje oraz działania',
                },
              }
            : actionItemsWithoutTask.length
              ? {
                  id: 'powiaz-z-zadaniami',
                  label: { en: 'Link to tasks', pl: 'Powiąż z zadaniami' },
                  icon: Link2,
                  disabled: linkingTasks || readMode,
                  onClick: () => void linkActionsToTasks(actionItemsWithoutTask),
                  title: {
                    en: 'Create a task in Execution for every action in the approved minutes',
                    pl: 'Utwórz zadanie w Realizacji dla każdego działania z zatwierdzonego protokołu',
                  },
                }
              : {
                  intentionallyNone: true,
                  reason:
                    'Nie ma propozycji protokołu do zatwierdzenia ani działania bez zadania, a trasy rozesłania protokołu backend nie ma (`meeting.routes.ts` zna wyłącznie wysyłkę zaproszeń ICS `POST /:id/invitations/send`) — wyłączony przycisk „Roześlij” byłby atrapą, więc primary tu po prostu nie powstaje (SPEC-N §2.3).',
                }
        }
        sections={ukladSekcji.applyToSections(sekcje)}
        /*
         * [U-51] MENU 2 — powód, dla którego ten segment w ogóle się renderuje.
         * `NModeShell.tsx:198` liczy `hasActionBar` z paska/akcji; karta nie
         * podawała żadnego, więc CAŁY segment znikał i właściciel widział
         * „brak menu 2” (U-51). Archetyp B ma ten pasek w kanonie (§5
         * „Archetyp B”), więc karta podaje kanoniczny `NModeMenu2`:
         * LEWA = Sekcje, ŚRODEK = Edycja|Podgląd. Przycisku „Analizuj z AI”
         * NIE dokładamy: spotkanie nie ma dziś własnej analizy karty, a
         * neutralny przycisk bez treści byłby kolejną atrapą.
         */
        toolbar={
          <NModeMenu2
            isPolish={isPolish}
            // `isPolish` CELOWO nie jest przekazywane: `SectionsManagerMenu`
            // przy jawnym propie wola `i18n.getFixedT`, ktorego atrapy
            // `react-i18next` w testach nie maja. Bez propu komponent czyta
            // jezyk z wlasnego hooka — ten sam wynik, zero zaleznosci od
            // ksztaltu atrapy.
            sectionsMenu={<SectionsManagerMenu layout={ukladSekcji} />}
            readMode={readMode}
            onReadModeChange={setReadMode}
          />
        }
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
