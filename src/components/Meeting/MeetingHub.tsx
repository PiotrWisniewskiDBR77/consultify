import {
  CalendarDays,
  CheckSquare2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  FileText,
  Loader2,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { type FilterChip, type ModuleTab, type ViewMode } from '@/components/shared/ModuleHub';
import { getMenu3AiButtonClass } from '@/components/shared/ModuleHub/menu3ActionButtonStyles';
import { Menu3Row } from '@/components/shared/ModuleHub/Menu3Row';
import { useModuleOpenDocuments } from '@/components/shared/ModuleHub/useModuleOpenDocuments';
import {
  MENU_3_ALL_DOT_CLASS,
  MENU_3_BADGE_ACTIVE,
  MENU_3_BADGE_INACTIVE,
  MENU_3_CHIP_ACTIVE,
  MENU_3_CHIP_INACTIVE,
} from '@/components/shared/ModuleMenu3';
import {
  StandardPreview,
  type StandardPreviewActions,
  standardPreviewShortcuts,
  type StandardRowMenu,
  StandardTable,
  type TableColumn as StandardTableColumn,
} from '@/components/standard';
import { StandardModuleBar } from '@/components/standard/StandardModuleBar';
import { ErrorState, LoadingState } from '@/components/ui/primitives';
import { StatusChip } from '@/components/ui/primitives/chips';
import { Api, type GovernedMeetingNoteDto } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';

type FollowUpStatus = 'open' | 'done';
export type MeetingStatus = 'scheduled' | 'completed';

interface FollowUpItem {
  id: string;
  title: string;
  owner: string;
  status: FollowUpStatus;
}

export interface MeetingItem {
  id: string;
  projectId?: string | null;
  title: string;
  startAt: string;
  endAt: string;
  location: string;
  attendees: string[];
  preRead: string[];
  agenda: string[];
  decisions: string[];
  followUps: FollowUpItem[];
  status: MeetingStatus;
}

export const MeetingHub: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isPolish = i18n.language?.startsWith('pl');
  const currentUser = useAppStore((state) => state.currentUser);
  const canApproveMeetingNotes = ['OWNER', 'ADMIN', 'SUPERADMIN'].includes(
    String(currentUser?.role || '').toUpperCase()
  );

  const [activeTab, setActiveTab] = useState<ModuleTab>('list');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Triada standard (StandardTable MUST #7): checkbox selection, left of each row.
  const [selectedListIds, setSelectedListIds] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [notesTranscript, setNotesTranscript] = useState('');
  const [generatingNotes, setGeneratingNotes] = useState(false);
  const [generatedNote, setGeneratedNote] = useState<any>(null);
  const [governedNotes, setGovernedNotes] = useState<GovernedMeetingNoteDto[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [decidingNoteId, setDecidingNoteId] = useState<string | null>(null);
  const [noteReceiptIds, setNoteReceiptIds] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<MeetingItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [operatorBrief, setOperatorBrief] = useState<any>(null);
  const [operatorBriefLoading, setOperatorBriefLoading] = useState(false);
  // Honest error vs. empty (CANON §4.1): a failed brief fetch must surface a
  // retryable error state, NOT silently fall through to "no brief".
  const [operatorBriefError, setOperatorBriefError] = useState(false);
  const [operatorBriefReloadKey, setOperatorBriefReloadKey] = useState(0);
  const [draft, setDraft] = useState({
    title: '',
    startAt: '',
    endAt: '',
    location: '',
    attendees: '',
    preRead: '',
    agenda: '',
  });

  const { openDocuments, setOpenDocuments, activeDocumentId, setActiveDocumentId } =
    useModuleOpenDocuments('meeting');

  const loadMeetings = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await (Api as any).getMeetings?.();
      const rows = Array.isArray(data) ? data : data?.meetings || [];
      setMeetings(Array.isArray(rows) ? rows : []);
    } catch (error) {
      console.error('Failed to load meetings:', error);
      setMeetings([]);
      setLoadError(t('meeting.errors.loadFailed', 'Failed to load meetings'));
      toast.error(t('meeting.errors.loadFailed', 'Failed to load meetings'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMeetings();
  }, []);

  const filteredMeetings = useMemo(() => {
    let data = [...meetings].sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
    );

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      data = data.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.location.toLowerCase().includes(q) ||
          item.attendees.some((attendee) => attendee.toLowerCase().includes(q))
      );
    }

    for (const filter of activeFilters) {
      if (filter.column === 'status') {
        data = data.filter((item) => item.status === filter.value);
      }
      if (filter.column === 'followUp') {
        data = data.filter((item) => item.followUps.some((x) => x.status === 'open'));
      }
      // M12-F02: "Upcoming" must filter by the SAME predicate its badge counts
      // (isUpcoming), otherwise the chip advertises N and the table shows M.
      // Previously the chip counted by date but filtered by status='scheduled'.
      if (filter.column === 'upcoming') {
        data = data.filter((m) => isUpcoming(m));
      }
      // CB-04/RB-009/RV-024: same M12-F02 discipline for the new "Past — needs
      // update" chip — filter by the identical deriveMeetingLifecycle() call
      // the chip's own count and the row badge use.
      if (filter.column === 'pastNeedsUpdate') {
        data = data.filter((m) => deriveMeetingLifecycle(m) === 'past_needs_update');
      }
    }

    return data;
  }, [activeFilters, meetings, searchQuery]);

  /**
   * M12-F02: `FilterableTable` applies `activeFilters` a SECOND time, matching
   * `row[filter.column]` literally. The Menu 3 chips use semantic columns
   * (`followUp`, `upcoming`) that are not row fields, so that second pass
   * matched `undefined` and wiped the table — "Needs follow-up" advertised 2
   * and rendered "No items found" on demo. Materialising the two derived flags
   * onto each row makes the second pass agree with the first instead of
   * silently emptying the list.
   */
  const tableRows = useMemo(
    () =>
      filteredMeetings.map((item) => ({
        ...item,
        upcoming: isUpcoming(item) ? 'true' : 'false',
        followUp: item.followUps.some((x) => x.status === 'open') ? 'open' : 'none',
        // CB-04/RB-009/RV-024: materialize onto the row for the same reason
        // `upcoming`/`followUp` are — FilterableTable's second filtering pass
        // reads `row[filter.column]` literally.
        pastNeedsUpdate: deriveMeetingLifecycle(item) === 'past_needs_update' ? 'true' : 'false',
      })),
    [filteredMeetings]
  );

  const selectedMeeting = useMemo(
    () => filteredMeetings.find((item) => item.id === selectedId) || null,
    [filteredMeetings, selectedId]
  );
  const activeMeeting = useMemo(
    () => meetings.find((item) => item.id === activeDocumentId) || null,
    [meetings, activeDocumentId]
  );
  const briefingMeeting = activeMeeting || selectedMeeting;

  useEffect(() => {
    let cancelled = false;
    const targetMeetingId = briefingMeeting?.id;
    if (!targetMeetingId) {
      setOperatorBrief(null);
      setOperatorBriefError(false);
      return;
    }
    setOperatorBriefLoading(true);
    setOperatorBriefError(false);
    const briefApi = (Api as any).getAIOperatorMeetingBrief;
    if (typeof briefApi !== 'function') {
      setOperatorBriefLoading(false);
      return;
    }
    void briefApi(targetMeetingId)
      .then((data: any) => {
        if (!cancelled) {
          setOperatorBrief(data || null);
          setOperatorBriefError(false);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setOperatorBrief(null);
        // M12-F04: 404 was treated as "this meeting simply has no brief yet" and
        // rendered as a calm empty state. That reading is wrong on two counts.
        // (a) `aiOperatorService.getMeetingBrief` is deterministic — it ALWAYS
        //     returns a brief for a meeting that exists, and we are rendering
        //     this meeting, so it exists.
        // (b) `/api/ai-operator/*` sits behind `requireInternalToolsAccess`,
        //     which answers **404 {"error":"Not found"}** for every org outside
        //     the internal allowlist. The old mapping turned that access denial
        //     into silent emptiness — the exact "cicha pustka" this module must
        //     not have. Every failure is now an honest, retryable error.
        setOperatorBriefError(true);
      })
      .finally(() => {
        if (!cancelled) setOperatorBriefLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [briefingMeeting?.id, operatorBriefReloadKey]);

  const openMeetingDocument = (row: MeetingItem) => {
    setSelectedId(row.id);
    const doc = {
      id: row.id,
      type: 'report' as const,
      subType: 'meeting',
      name: row.title,
      status: 'DRAFT' as const,
    };
    setOpenDocuments((prev) => (prev.some((item) => item.id === row.id) ? prev : [...prev, doc]));
    setActiveDocumentId(row.id);
  };

  const tabs = useMemo(
    () => [
      {
        id: 'list' as ModuleTab,
        label: t('meeting.tabs.all', 'Meetings'),
        icon: <CalendarDays size={16} />,
        count: meetings.length,
      },
    ],
    [meetings.length, t]
  );

  const counts = useMemo(() => {
    return {
      all: meetings.length,
      upcoming: meetings.filter((m) => isUpcoming(m)).length,
      followUp: meetings.filter((item) => item.followUps.some((x) => x.status === 'open')).length,
      completed: meetings.filter((item) => item.status === 'completed').length,
      // CB-04/RB-009/RV-024: past meetings never auto-marked completed —
      // distinct from `followUp` (open action-item follow-ups on ANY
      // meeting) and from `completed` (genuinely closed out).
      pastNeedsUpdate: meetings.filter((m) => deriveMeetingLifecycle(m) === 'past_needs_update')
        .length,
    };
  }, [meetings]);

  const columns: StandardTableColumn[] = useMemo(
    () => [
      {
        id: 'title',
        label: t('meeting.columns.title', 'Meeting'),
        width: '280px',
        render: (row: MeetingItem) => (
          <div className="min-w-0">
            <div className="text-sm font-medium text-c-text-secondary truncate">{row.title}</div>
            <div className="text-xs text-c-text-muted truncate">
              {row.location || t('meeting.noLocation2')}
            </div>
          </div>
        ),
      },
      {
        id: 'startAt',
        label: t('meeting.columns.when', 'When'),
        width: '180px',
        sortable: true,
        render: (row: MeetingItem) => (
          <span className="text-sm text-c-text-secondary">
            {formatDateTime(row.startAt, isPolish)}
          </span>
        ),
      },
      {
        id: 'attendees',
        label: t('meeting.columns.attendees', 'Attendees'),
        width: '120px',
        align: 'right' as const,
        render: (row: MeetingItem) => (
          <span className="text-sm tabular-nums text-c-text-secondary">{row.attendees.length}</span>
        ),
      },
      {
        id: 'status',
        label: t('meeting.columns.status', 'Status'),
        width: '120px',
        filterable: true,
        filterOptions: [
          {
            value: 'scheduled',
            label: t('meeting.status.scheduled', 'Scheduled'),
            color: 'bg-blue-400',
          },
          {
            value: 'completed',
            label: t('meeting.status.completed', 'Completed'),
            color: 'bg-emerald-400',
          },
        ],
        // CB-04/RB-009/RV-024: three DISPLAY states over the two real
        // `status` values — a past-but-still-`scheduled` meeting gets its
        // own honest warning-tone label instead of reading as identical to
        // a genuinely future one (canon §4.1 EntityStatusChip pattern, but
        // via StatusChip directly since the tone here is lifecycle-derived,
        // not a straight raw-status lookup).
        render: (row: MeetingItem) => {
          const lifecycle = deriveMeetingLifecycle(row);
          return (
            <StatusChip
              tone={
                lifecycle === 'completed'
                  ? 'success'
                  : lifecycle === 'past_needs_update'
                    ? 'warning'
                    : 'info'
              }
              label={
                lifecycle === 'completed'
                  ? t('meeting.status.completed', 'Completed')
                  : lifecycle === 'past_needs_update'
                    ? t('meeting.status.pastNeedsUpdate', 'Past — needs update')
                    : t('meeting.status.scheduled', 'Scheduled')
              }
            />
          );
        },
      },
      {
        id: 'followUps',
        label: t('meeting.columns.followUps', 'Follow-ups'),
        width: '110px',
        align: 'right' as const,
        render: (row: MeetingItem) => (
          <span className="text-sm tabular-nums text-c-text-secondary">
            {row.followUps.filter((item) => item.status === 'open').length}
          </span>
        ),
      },
    ],
    [isPolish, t]
  );

  const commandRowContent = useMemo(() => {
    const chips = [
      {
        id: 'all',
        label: t('meeting.counters.all', 'All'),
        count: counts.all,
        active: !activeFilters.length,
        onClick: () => setActiveFilters([]),
      },
      {
        id: 'upcoming',
        label: t('meeting.counters.upcoming', 'Upcoming'),
        count: counts.upcoming,
        active: activeFilters.some((f) => f.column === 'upcoming'),
        onClick: () =>
          setActiveFilters([
            {
              id: 'upcoming:true',
              column: 'upcoming',
              value: 'true',
              label: t('meeting.counters.upcoming', 'Upcoming'),
            },
          ]),
      },
      {
        // CB-04/RB-009/RV-024: distinct from `followUp` below (open
        // action-item follow-ups on any meeting) — this is meetings whose
        // time has passed but were never marked completed.
        id: 'pastNeedsUpdate',
        label: t('meeting.counters.pastNeedsUpdate', 'Past — needs update'),
        count: counts.pastNeedsUpdate,
        active: activeFilters.some((f) => f.column === 'pastNeedsUpdate'),
        onClick: () =>
          setActiveFilters([
            {
              id: 'pastNeedsUpdate:true',
              column: 'pastNeedsUpdate',
              value: 'true',
              label: t('meeting.counters.pastNeedsUpdate', 'Past — needs update'),
            },
          ]),
      },
      {
        id: 'followUp',
        label: t('meeting.counters.followUp', 'Needs follow-up'),
        count: counts.followUp,
        active: activeFilters.some((f) => f.column === 'followUp'),
        onClick: () =>
          setActiveFilters([
            { id: 'followUp:open', column: 'followUp', value: 'open', label: 'Needs follow-up' },
          ]),
      },
      {
        id: 'completed',
        label: t('meeting.counters.completed', 'Completed'),
        count: counts.completed,
        active: activeFilters.some((f) => f.id === 'status:completed'),
        onClick: () =>
          setActiveFilters([
            { id: 'status:completed', column: 'status', value: 'completed', label: 'Completed' },
          ]),
      },
    ];

    // Canonical Menu 3 layout: left preset chips + right AI action in one justify-between row.
    // NOTE: commandRowRightContent is voided by ModuleNavBar (line 188), so we embed both
    // sides here via the canonical Menu3Row shell (left/right slots over MENU_3 tokens).
    return (
      <Menu3Row
        left={chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={chip.onClick}
            className={chip.active ? MENU_3_CHIP_ACTIVE : MENU_3_CHIP_INACTIVE}
          >
            {chip.id === 'all' ? <span className={MENU_3_ALL_DOT_CLASS} /> : null}
            <span>{chip.label}</span>
            <span className={chip.active ? MENU_3_BADGE_ACTIVE : MENU_3_BADGE_INACTIVE}>
              {chip.count}
            </span>
          </button>
        ))}
        right={
          <button
            type="button"
            disabled={!briefingMeeting}
            onClick={() => {
              if (briefingMeeting) openMeetingDocument(briefingMeeting);
            }}
            className={getMenu3AiButtonClass(Boolean(briefingMeeting && activeDocumentId))}
            title={t('meeting.actions.operatorBrief', 'Open operator brief')}
          >
            <Sparkles size={12} />
            <span>{t('meeting.actions.operatorBrief', 'Operator brief')}</span>
          </button>
        }
      />
    );
  }, [activeDocumentId, activeFilters, briefingMeeting, counts, openMeetingDocument, t]);

  const resetDraft = () => {
    setDraft({
      title: '',
      startAt: '',
      endAt: '',
      location: '',
      attendees: '',
      preRead: '',
      agenda: '',
    });
  };

  const openCreateModal = () => {
    setEditingId(null);
    resetDraft();
    setShowCreateModal(true);
  };

  const openEditModal = (meeting: MeetingItem) => {
    setEditingId(meeting.id);
    setDraft({
      title: meeting.title,
      startAt: toLocalInput(meeting.startAt),
      endAt: toLocalInput(meeting.endAt),
      location: meeting.location || '',
      attendees: meeting.attendees.join('\n'),
      preRead: meeting.preRead.join('\n'),
      agenda: meeting.agenda.join('\n'),
    });
    setShowCreateModal(true);
  };

  const closeMeetingModal = () => {
    setShowCreateModal(false);
    setEditingId(null);
    resetDraft();
  };

  const handleSaveMeeting = async () => {
    if (!draft.title.trim() || !draft.startAt) return;
    const payload = {
      title: draft.title.trim(),
      startAt: draft.startAt,
      endAt: draft.endAt || draft.startAt,
      location: draft.location.trim(),
      attendees: splitLines(draft.attendees),
      preRead: splitLines(draft.preRead),
      agenda: splitLines(draft.agenda),
    };

    if (editingId) {
      try {
        const response = await (Api as any).updateMeeting?.(editingId, payload);
        const meeting = response?.meeting as MeetingItem | undefined;
        if (!meeting) throw new Error('Meeting was not updated');
        setMeetings((prev) => prev.map((item) => (item.id === editingId ? meeting : item)));
        closeMeetingModal();
        toast.success(t('meeting.notifications.updated', 'Meeting updated'));
      } catch (error) {
        console.error('Failed to update meeting:', error);
        toast.error(t('meeting.errors.updateFailed', 'Failed to update meeting'));
      }
      return;
    }

    try {
      const response = await (Api as any).createMeeting?.({ ...payload, decisions: [] });
      const meeting = response?.meeting as MeetingItem | undefined;
      if (!meeting) throw new Error('Meeting was not created');
      setMeetings((prev) => [meeting, ...prev]);
      setSelectedId(meeting.id);
      closeMeetingModal();
      toast.success(t('meeting.notifications.created', 'Meeting created'));
    } catch (error) {
      console.error('Failed to create meeting:', error);
      toast.error(t('meeting.errors.createFailed', 'Failed to create meeting'));
    }
  };

  const handleDeleteMeeting = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await (Api as any).deleteMeeting?.(deleteTarget.id);
      const removedId = deleteTarget.id;
      setMeetings((prev) => prev.filter((item) => item.id !== removedId));
      if (selectedId === removedId) setSelectedId(null);
      if (activeDocumentId === removedId) setActiveDocumentId(null);
      setOpenDocuments((prev) => prev.filter((doc) => doc.id !== removedId));
      setDeleteTarget(null);
      toast.success(t('meeting.notifications.deleted', 'Meeting deleted'));
    } catch (error) {
      console.error('Failed to delete meeting:', error);
      toast.error(t('meeting.errors.deleteFailed', 'Failed to delete meeting'));
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleMeetingStatus = async (meetingId: string) => {
    const current = meetings.find((meeting) => meeting.id === meetingId);
    if (!current) return;
    const nextStatus = current.status === 'completed' ? 'scheduled' : 'completed';
    try {
      const response = await (Api as any).updateMeetingStatus?.(meetingId, nextStatus);
      const meeting = response?.meeting as MeetingItem | undefined;
      if (!meeting) throw new Error('Meeting status update failed');
      setMeetings((prev) => prev.map((item) => (item.id === meetingId ? meeting : item)));
    } catch (error) {
      console.error('Failed to update meeting status:', error);
      toast.error(t('meeting.errors.statusFailed', 'Failed to update meeting status'));
    }
  };

  const handleGenerateNotes = async () => {
    if (!activeMeeting || !notesTranscript.trim()) return;
    setGeneratingNotes(true);
    setGeneratedNote(null);
    try {
      const response = await (Api as any).generateMeetingNotes?.(activeMeeting.id, {
        transcript: notesTranscript.trim(),
        language: isPolish ? 'pl' : 'en',
      });
      const note = response?.note;
      const noteId = response?.meetingNoteId;
      const proposal = response?.proposal;
      if (!note || !noteId || !proposal?.proposalId) {
        throw new Error('The note was not durably proposed');
      }
      const durableNote: GovernedMeetingNoteDto = {
        ...note,
        id: noteId,
        status:
          proposal.state === 'rejected'
            ? 'rejected'
            : proposal.state === 'materialized'
              ? 'approved'
              : 'proposed',
        proposalId: proposal.proposalId,
      };
      setGeneratedNote(durableNote);
      setGovernedNotes((prev) => [durableNote, ...prev.filter((item) => item.id !== noteId)]);
      toast.success(
        t('meeting.notes.notifications.proposed', 'Meeting note proposed for human approval')
      );
    } catch (error) {
      console.error('Failed to generate meeting notes:', error);
      toast.error(t('meeting.notes.errors.generateFailed', 'Failed to generate notes'));
    } finally {
      setGeneratingNotes(false);
    }
  };

  const loadGovernedNotes = async (meetingId: string) => {
    setNotesLoading(true);
    setNotesError(null);
    try {
      const response = await Api.listMeetingNotes(meetingId);
      const notes = Array.isArray(response?.notes) ? response.notes : [];
      setGovernedNotes(notes);
      setNoteReceiptIds(
        Object.fromEntries(
          notes.filter((note) => note.receiptId).map((note) => [note.id, note.receiptId!])
        )
      );
    } catch (error) {
      console.error('Failed to load governed meeting notes:', error);
      setNotesError(t('meeting.notes.errors.loadFailed', 'Could not load meeting note proposals.'));
    } finally {
      setNotesLoading(false);
    }
  };

  const openGovernedNotes = () => {
    if (!activeMeeting) return;
    setGeneratedNote(null);
    setNotesTranscript('');
    setShowNotesModal(true);
    void loadGovernedNotes(activeMeeting.id);
  };

  const decideGovernedNote = async (note: GovernedMeetingNoteDto, action: 'approve' | 'reject') => {
    if (!activeMeeting) return;
    setDecidingNoteId(note.id);
    try {
      const response = await Api.decideMeetingNote(activeMeeting.id, note.id, {
        action,
      });
      if (!response?.note || !response?.proposal) throw new Error('Decision was not persisted');
      setGovernedNotes((prev) => prev.map((item) => (item.id === note.id ? response.note : item)));
      const receiptId = response.receipt?.receiptId;
      if (receiptId) {
        setNoteReceiptIds((prev) => ({ ...prev, [note.id]: receiptId }));
      }
      setGeneratedNote(response.note);
      toast.success(
        action === 'approve'
          ? t('meeting.notes.approved', 'Meeting note approved and materialized')
          : t('meeting.notes.rejected', 'Meeting note rejected')
      );
    } catch (error: any) {
      console.error('Failed to decide meeting note:', error);
      const stale =
        error?.status === 409 || error?.code === 'STALE_WRITE' || error?.code === 'INVALID_STATE';
      toast.error(
        stale
          ? t('meeting.notes.stale', 'This proposal changed. Reloading the authoritative state.')
          : t('meeting.notes.errors.decisionFailed', 'Could not update the proposal.')
      );
      if (stale) await loadGovernedNotes(activeMeeting.id);
    } finally {
      setDecidingNoteId(null);
    }
  };

  // Triada standard (StandardPreview, canon A7): selected row + actions for the
  // table 'list' view preview pane.
  const listPreviewActions: StandardPreviewActions | undefined = useMemo(
    () =>
      selectedMeeting
        ? {
            // canon §7.3 — "Open" usunięte z informational: dublowało onOpenFull
            // przekazywane do StandardPreview w tym samym renderze (header ma już Open).
            // Jedyna pozycja informational była duplikatem, więc tablica znika całkiem.
            resolutions: [
              {
                id: 'toggle-status',
                variant: 'neutral',
                label:
                  selectedMeeting.status === 'completed'
                    ? t('meeting.markScheduled', 'Mark scheduled')
                    : t('meeting.markCompleted', 'Mark completed'),
                icon: CheckSquare2,
                onClick: () => handleToggleMeetingStatus(selectedMeeting.id),
              },
            ],
          }
        : undefined,
    [selectedMeeting, t, openMeetingDocument, handleToggleMeetingStatus]
  );

  // Esc closes preview; single-key shortcuts (O) active while preview open (kanon B.24/B.31).
  useEffect(() => {
    if (viewMode !== 'table' || activeDocumentId || !selectedId) return;
    const shortcuts = standardPreviewShortcuts(listPreviewActions);
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable)
        return;
      if (e.key === 'Escape') {
        setSelectedId(null);
        return;
      }
      const handler = shortcuts[e.key.toUpperCase()];
      if (handler) {
        e.preventDefault();
        handler();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewMode, activeDocumentId, selectedId, listPreviewActions]);

  return (
    <>
      <StandardModuleBar
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onSearch={setSearchQuery}
        openItems={openDocuments}
        activeItemId={activeDocumentId}
        onSelectItem={setActiveDocumentId}
        onCloseItem={(id) => {
          setOpenDocuments((prev) => prev.filter((doc) => doc.id !== id));
          if (activeDocumentId === id) setActiveDocumentId(null);
        }}
        onShowList={() => setActiveDocumentId(null)}
        activeFilters={activeFilters}
        onRemoveFilter={(id) => setActiveFilters((prev) => prev.filter((item) => item.id !== id))}
        onClearFilters={() => setActiveFilters([])}
        primaryCta={{
          label: t('meeting.actions.new', 'New meeting'),
          onClick: openCreateModal,
        }}
        filterControls={
          <div className="inline-flex items-center rounded-full border border-c-border-subtle px-3 h-9 text-xs text-c-text-muted">
            {loading ? (
              <>
                <Loader2 size={12} className="mr-2 animate-spin" />
                <span>{t('meeting.sync.loading', 'Loading workspace')}</span>
              </>
            ) : (
              t('meeting.sync.workspace', 'Shared workspace')
            )}
          </div>
        }
        commandRowContent={commandRowContent}
        viewModes={['table', 'calendar']}
      >
        {loading ? (
          <LoadingState variant="spinner" className="h-full" />
        ) : loadError ? (
          <ErrorState message={loadError} retry={() => void loadMeetings()} />
        ) : activeMeeting ? (
          <MeetingDetailView
            meeting={activeMeeting}
            isPolish={isPolish}
            operatorBrief={
              briefMatchesMeeting(operatorBrief, activeMeeting.id) ? operatorBrief : null
            }
            operatorBriefLoading={operatorBriefLoading}
            operatorBriefError={operatorBriefError && briefingMeeting?.id === activeMeeting.id}
            onRetryOperatorBrief={() => setOperatorBriefReloadKey((k) => k + 1)}
            onBack={() => setActiveDocumentId(null)}
            onEdit={() => openEditModal(activeMeeting)}
            onDelete={() => setDeleteTarget(activeMeeting)}
            onToggleStatus={() => handleToggleMeetingStatus(activeMeeting.id)}
            onGenerateNotes={openGovernedNotes}
          />
        ) : viewMode === 'calendar' ? (
          <MeetingCalendarView
            meetings={filteredMeetings}
            isPolish={isPolish}
            onSelectMeeting={(meeting) => openMeetingDocument(meeting)}
          />
        ) : (
          // Triada standard (docs/ui-standards/TRIADA_KANON.md A4-A7): Meeting
          // list → StandardTable + StandardPreview, 1:1 with the Assessment
          // 'list' / Interview Inbox / Results KPI catalog adopters.
          <div className="h-full flex overflow-hidden">
            <div className="flex-1 min-w-0 overflow-auto pl-4 pr-1.5 pt-3 pb-4">
              <StandardTable
                columns={columns}
                data={tableRows as unknown as Array<Record<string, unknown> & { id: string }>}
                selectedRowId={selectedId}
                onRowClick={(row) => setSelectedId(String((row as any).id))}
                onRowDoubleClick={(row) => openMeetingDocument(row as unknown as MeetingItem)}
                rowDescription={() => null}
                defaultSort={{ columnId: 'startAt', direction: 'asc' }}
                persistKey="meeting.hub.list"
                selection={{ selectedIds: selectedListIds, onChange: setSelectedListIds }}
                empty={{
                  icon: CalendarDays,
                  title: t('meeting.empty', 'No meetings yet'),
                  description: t(
                    'meeting.emptyState.description',
                    'Schedule your first meeting to start tracking agendas and follow-ups.'
                  ),
                  actionLabel: t('meeting.actions.new', 'New meeting'),
                  onAction: openCreateModal,
                }}
                rowMenu={(row): StandardRowMenu => {
                  const meeting = row as unknown as MeetingItem;
                  return {
                    primary: [
                      {
                        id: 'open',
                        label: t('common.open', 'Open'),
                        icon: ExternalLink,
                        onClick: () => openMeetingDocument(meeting),
                      },
                    ],
                    statusTransitions: [
                      {
                        id: 'toggle-status',
                        label:
                          meeting.status === 'completed'
                            ? t('meeting.markScheduled', 'Mark scheduled')
                            : t('meeting.markCompleted', 'Mark completed'),
                        icon: CheckSquare2,
                        onClick: () => handleToggleMeetingStatus(meeting.id),
                      },
                    ],
                    universalHandlers: {
                      preview: () => setSelectedId(meeting.id),
                      edit: () => openEditModal(meeting),
                      // Brak API archiwizacji spotkania — pozycja disabled z notą
                      // (StandardTable dokłada ją sama, canon A6 blok 4).
                    },
                    destructive: {
                      // Confirm dialog, nie natychmiastowy delete — istniejący flow.
                      onClick: () => setDeleteTarget(meeting),
                    },
                  };
                }}
                activeFilters={activeFilters}
                onFilterChange={setActiveFilters}
              />
            </div>

            {selectedMeeting ? (
              <aside className="w-[400px] shrink-0 bg-slate-50 dark:bg-navy-950 p-3 overflow-hidden">
                <StandardPreview
                  title={selectedMeeting.title || t('meeting.meetingLabel', 'Meeting')}
                  onClose={() => setSelectedId(null)}
                  onOpenFull={() => openMeetingDocument(selectedMeeting)}
                  meta={{
                    pills: [
                      (() => {
                        const lifecycle = deriveMeetingLifecycle(selectedMeeting);
                        return {
                          label:
                            lifecycle === 'completed'
                              ? t('meeting.status.completed', 'Completed')
                              : lifecycle === 'past_needs_update'
                                ? t('meeting.status.pastNeedsUpdate', 'Past — needs update')
                                : t('meeting.status.scheduled', 'Scheduled'),
                          tone:
                            lifecycle === 'completed'
                              ? ('success' as const)
                              : lifecycle === 'past_needs_update'
                                ? ('warning' as const)
                                : ('info' as const),
                        };
                      })(),
                    ],
                    trailing: (
                      <span className="text-[11px] font-semibold text-c-text-secondary">
                        {formatDateTime(selectedMeeting.startAt, isPolish)}
                      </span>
                    ),
                  }}
                  details={{
                    // M12-F05: these are label/value pairs, not prose. Joined
                    // with `\n` into `text` they collapsed into one paragraph
                    // ("Uczestnicy: Anna Kowalska Follow-upy: 0 Agenda: — …")
                    // and drove a meaningless "~14 words" counter. `properties`
                    // is the canonical StandardPreview slot for exactly this.
                    properties: [
                      {
                        id: 'attendees',
                        label: t('meeting.columns.attendees', 'Attendees'),
                        value: selectedMeeting.attendees.length
                          ? selectedMeeting.attendees.join(', ')
                          : '—',
                      },
                      {
                        id: 'followUps',
                        label: t('meeting.columns.followUps', 'Follow-ups'),
                        mono: true,
                        value: String(
                          selectedMeeting.followUps.filter((item) => item.status === 'open').length
                        ),
                      },
                      {
                        id: 'agenda',
                        label: t('meeting.agenda', 'Agenda'),
                        value: selectedMeeting.agenda.length
                          ? selectedMeeting.agenda.join(' · ')
                          : '—',
                      },
                      {
                        id: 'decisions',
                        label: t('meeting.decisions2', 'Decisions'),
                        value: selectedMeeting.decisions.length
                          ? selectedMeeting.decisions.join(' · ')
                          : '—',
                      },
                      {
                        id: 'location',
                        label: t('meeting.fields.location', 'Location / link'),
                        value: selectedMeeting.location || t('meeting.noLocation2', 'No location'),
                      },
                    ],
                    propertyLabel: isPolish ? 'Właściwość' : 'Property',
                    valueLabel: isPolish ? 'Wartość' : 'Value',
                    onCopy: () => {
                      void navigator.clipboard?.writeText(
                        `${selectedMeeting.title} — ${formatDateTime(selectedMeeting.startAt, isPolish)}`
                      );
                    },
                  }}
                  ai={{
                    // Real Operator Brief feature (not a placeholder): fetched by the
                    // existing effect keyed on briefingMeeting?.id, which already tracks
                    // selectedMeeting when no full document is open (canon A7 blok 4 —
                    // AI ramka, tu z rzeczywistym wynikiem zamiast samych chipów).
                    hints: [],
                    loading: operatorBriefLoading && briefingMeeting?.id === selectedMeeting.id,
                    error:
                      operatorBriefError && briefingMeeting?.id === selectedMeeting.id
                        ? t('meeting.operatorBriefError', 'Could not load the operator brief.')
                        : null,
                    result: briefMatchesMeeting(operatorBrief, selectedMeeting.id)
                      ? [
                          operatorBrief?.prepSummary,
                          Array.isArray(operatorBrief?.agendaGaps) &&
                          operatorBrief.agendaGaps.length
                            ? (operatorBrief.agendaGaps as string[]).slice(0, 2).join(' • ')
                            : null,
                          Array.isArray(operatorBrief?.followUpSuggestions) &&
                          operatorBrief.followUpSuggestions.length
                            ? (operatorBrief.followUpSuggestions as string[])
                                .slice(0, 3)
                                .join(' • ')
                            : null,
                        ]
                          .filter(Boolean)
                          .join('\n')
                      : null,
                    onRegenerate: () => setOperatorBriefReloadKey((k) => k + 1),
                  }}
                  relations={
                    selectedMeeting.projectId
                      ? [
                          {
                            label: `${t('meeting.project', 'Project')}: ${selectedMeeting.projectId.slice(0, 8)}…`,
                          },
                        ]
                      : []
                  }
                  actions={listPreviewActions}
                />
              </aside>
            ) : null}
          </div>
        )}
      </StandardModuleBar>

      {showCreateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-c-surface border border-slate-200/60 dark:border-white/[0.03]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-c-border-subtle">
              <div>
                <div className="text-sm font-semibold text-c-text">
                  {editingId
                    ? t('meeting.modal.editTitle', 'Edit meeting')
                    : t('meeting.modal.title', 'Create meeting')}
                </div>
                <div className="text-xs text-c-text-muted">
                  {t('meeting.modal.subtitle', 'Agenda + pre-read + follow-up workspace')}
                </div>
              </div>
              <button
                type="button"
                onClick={closeMeetingModal}
                className="p-2 rounded-lg hover:bg-c-surface-raised"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5">
              <Field label={t('meeting.fields.title', 'Title')}>
                <input
                  className="w-full rounded-xl border border-c-border bg-transparent px-3 py-2 text-sm"
                  value={draft.title}
                  onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
                />
              </Field>
              <Field label={t('meeting.fields.location', 'Location / link')}>
                <input
                  className="w-full rounded-xl border border-c-border bg-transparent px-3 py-2 text-sm"
                  value={draft.location}
                  onChange={(e) => setDraft((prev) => ({ ...prev, location: e.target.value }))}
                />
              </Field>
              <Field label={t('meeting.fields.start', 'Start')}>
                <input
                  type="datetime-local"
                  className="w-full rounded-xl border border-c-border bg-transparent px-3 py-2 text-sm"
                  value={draft.startAt}
                  onChange={(e) => setDraft((prev) => ({ ...prev, startAt: e.target.value }))}
                />
              </Field>
              <Field label={t('meeting.fields.end', 'End')}>
                <input
                  type="datetime-local"
                  className="w-full rounded-xl border border-c-border bg-transparent px-3 py-2 text-sm"
                  value={draft.endAt}
                  onChange={(e) => setDraft((prev) => ({ ...prev, endAt: e.target.value }))}
                />
              </Field>
              <Field label={t('meeting.fields.attendees', 'Attendees, one per line')}>
                <textarea
                  className="min-h-28 w-full rounded-xl border border-c-border bg-transparent px-3 py-2 text-sm"
                  value={draft.attendees}
                  onChange={(e) => setDraft((prev) => ({ ...prev, attendees: e.target.value }))}
                />
              </Field>
              <Field label={t('meeting.fields.preRead', 'Pre-read links, one per line')}>
                <textarea
                  className="min-h-28 w-full rounded-xl border border-c-border bg-transparent px-3 py-2 text-sm"
                  value={draft.preRead}
                  onChange={(e) => setDraft((prev) => ({ ...prev, preRead: e.target.value }))}
                />
              </Field>
              <div className="md:col-span-2">
                <Field label={t('meeting.fields.agenda', 'Agenda items, one per line')}>
                  <textarea
                    className="min-h-32 w-full rounded-xl border border-c-border bg-transparent px-3 py-2 text-sm"
                    value={draft.agenda}
                    onChange={(e) => setDraft((prev) => ({ ...prev, agenda: e.target.value }))}
                  />
                </Field>
              </div>
            </div>

            <div className="flex items-center justify-between px-5 py-4 border-t border-c-border-subtle">
              <div className="text-xs text-c-text-muted">
                {t('meeting.modal.note', 'Meeting details are stored in the shared workspace.')}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeMeetingModal}
                  className="h-9 px-4 rounded-full border border-c-border text-sm"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                {/* M12-F03: `handleSaveMeeting` silently `return`s when title or
                    start is empty, so an enabled button produced a dead click —
                    no toast, no inline error, modal frozen open. Mirror the AI
                    notes modal, which already disables its primary action. */}
                <button
                  type="button"
                  onClick={handleSaveMeeting}
                  disabled={!draft.title.trim() || !draft.startAt}
                  title={
                    !draft.title.trim() || !draft.startAt
                      ? t('meeting.modal.requiredHint', 'Title and start time are required')
                      : undefined
                  }
                  className="h-9 px-4 rounded-full bg-c-text text-c-surface text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingId
                    ? t('meeting.actions.save', 'Save changes')
                    : t('meeting.actions.create', 'Create meeting')}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {showNotesModal && activeMeeting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-c-surface border border-slate-200/60 dark:border-white/[0.03] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-c-border-subtle">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-c-text inline-flex items-center gap-2">
                  <Sparkles size={16} className="text-c-text-secondary" />
                  {t('meeting.aiMeetingNotes2')}
                </div>
                <div className="text-xs text-c-text-muted">{activeMeeting.title}</div>
              </div>
              <button
                type="button"
                onClick={() => setShowNotesModal(false)}
                className="p-2 rounded-lg hover:bg-c-surface-raised"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-4 p-5" data-meeting-capture-policy="manual-text-only">
              <div className="rounded-xl border border-c-border-subtle bg-c-surface-raised px-3 py-2 text-xs text-c-text-muted">
                <strong className="text-c-text-secondary">
                  {t('meeting.notes.captureOff', 'Recording and automatic transcription are OFF.')}
                </strong>{' '}
                {t(
                  'meeting.notes.manualTextOnly',
                  'Only text pasted manually is processed. Nothing becomes a decision or follow-up before human approval.'
                )}
              </div>
              {!generatedNote ? (
                <div className="space-y-4">
                  <Field label={t('meeting.notes.manualSourceText', 'Meeting source text')}>
                    <textarea
                      className="w-full min-h-[180px] rounded-xl border border-c-border bg-transparent px-3 py-2 text-sm"
                      placeholder={t(
                        'meeting.notes.manualSourcePlaceholder',
                        'Paste meeting text to prepare a governed note proposal'
                      )}
                      value={notesTranscript}
                      onChange={(e) => setNotesTranscript(e.target.value)}
                    />
                  </Field>
                  <div aria-live="polite" className="space-y-2">
                    <div className="text-[11px] uppercase tracking-wide text-c-text-muted">
                      {t('meeting.notes.proposals', 'Governed note proposals')}
                    </div>
                    {notesLoading ? <LoadingState variant="spinner" /> : null}
                    {notesError ? (
                      <ErrorState
                        message={notesError}
                        retry={() => void loadGovernedNotes(activeMeeting.id)}
                      />
                    ) : null}
                    {!notesLoading && !notesError && governedNotes.length === 0 ? (
                      <p className="text-sm text-c-text-muted">
                        {t('meeting.notes.noProposals', 'No meeting note proposals yet.')}
                      </p>
                    ) : null}
                    {!notesLoading && !notesError
                      ? governedNotes.map((note) => (
                          <div
                            key={note.id}
                            className="rounded-xl border border-c-border-subtle p-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <button
                                type="button"
                                className="min-w-0 flex-1 text-left"
                                onClick={() => setGeneratedNote(note)}
                              >
                                <span className="block truncate text-sm font-medium text-c-text">
                                  {note.summary ||
                                    t('meeting.notes.untitled', 'Meeting note proposal')}
                                </span>
                                <span className="block text-xs text-c-text-muted">
                                  {note.transcriptHash
                                    ? `SHA-256 ${note.transcriptHash.slice(0, 12)}… · `
                                    : ''}
                                  {note.status}
                                </span>
                              </button>
                              <StatusChip
                                tone={
                                  note.status === 'approved'
                                    ? 'success'
                                    : note.status === 'rejected'
                                      ? 'neutral'
                                      : 'warning'
                                }
                                label={
                                  note.status === 'approved'
                                    ? t('meeting.notes.materialized', 'Materialized')
                                    : note.status === 'rejected'
                                      ? t('meeting.notes.rejectedState', 'Rejected')
                                      : t('meeting.notes.awaitingApproval', 'Awaiting approval')
                                }
                              />
                            </div>
                            {note.status === 'proposed' && canApproveMeetingNotes ? (
                              <div className="mt-3 flex justify-end gap-2">
                                <button
                                  type="button"
                                  disabled={decidingNoteId === note.id}
                                  onClick={() => void decideGovernedNote(note, 'reject')}
                                  className="h-8 rounded-full border border-c-border px-3 text-xs disabled:opacity-50"
                                >
                                  {t('meeting.notes.reject', 'Reject')}
                                </button>
                                <button
                                  type="button"
                                  disabled={decidingNoteId === note.id}
                                  onClick={() => void decideGovernedNote(note, 'approve')}
                                  className="h-8 rounded-full bg-c-text px-3 text-xs text-c-surface disabled:opacity-50"
                                >
                                  {decidingNoteId === note.id
                                    ? t('common.saving', 'Saving…')
                                    : t('meeting.notes.approve', 'Approve and materialize')}
                                </button>
                              </div>
                            ) : note.status === 'proposed' ? (
                              <p className="mt-3 text-right text-xs text-c-text-muted">
                                {t(
                                  'meeting.notes.approvalRequiresAdmin',
                                  'Approval requires an active organization owner or administrator.'
                                )}
                              </p>
                            ) : null}
                            {noteReceiptIds[note.id] ? (
                              <p className="mt-2 break-all text-xs text-c-text-muted">
                                {t('meeting.notes.receipt', 'Materialization receipt')}:{' '}
                                {noteReceiptIds[note.id]}
                              </p>
                            ) : null}
                          </div>
                        ))
                      : null}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {generatedNote.source === 'heuristic' && (
                    <div className="flex items-center gap-1.5 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                      <span>⚠</span>
                      <span>{t('meeting.notesGeneratedByKeywordExtractionAi2')}</span>
                    </div>
                  )}
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-c-text-muted mb-1">
                      {t('meeting.summary2')}
                    </div>
                    <p className="text-sm text-c-text-secondary">{generatedNote.summary}</p>
                  </div>
                  {noteReceiptIds[generatedNote.id] ? (
                    <p className="break-all rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                      {t('meeting.notes.receipt', 'Materialization receipt')}:{' '}
                      {noteReceiptIds[generatedNote.id]}
                    </p>
                  ) : null}
                  {Array.isArray(generatedNote.keyPoints) && generatedNote.keyPoints.length > 0 && (
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-c-text-muted mb-1">
                        {t('meeting.keyPoints2')}
                      </div>
                      <ul className="list-disc pl-5 text-sm text-c-text-secondary space-y-1">
                        {generatedNote.keyPoints.map((kp: string, i: number) => (
                          <li key={i}>{kp}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {Array.isArray(generatedNote.decisions) && generatedNote.decisions.length > 0 && (
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-c-text-muted mb-1">
                        {generatedNote.status === 'approved'
                          ? t('meeting.notes.approvedDecisions', 'Approved proposed decisions')
                          : t(
                              'meeting.notes.proposedDecisions',
                              'Proposed decisions — not saved as decisions'
                            )}
                      </div>
                      <ul className="list-disc pl-5 text-sm text-c-text-secondary space-y-1">
                        {generatedNote.decisions.map((d: any, i: number) => (
                          <li key={i}>{d?.decision || String(d)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {Array.isArray(generatedNote.actionItems) &&
                    generatedNote.actionItems.length > 0 && (
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-c-text-muted mb-1">
                          {generatedNote.status === 'approved'
                            ? t('meeting.notes.approvedActions', 'Approved proposed action items')
                            : t(
                                'meeting.notes.proposedActions',
                                'Proposed action items — not saved as follow-ups'
                              )}
                        </div>
                        <ul className="list-disc pl-5 text-sm text-c-text-secondary space-y-1">
                          {generatedNote.actionItems.map((a: any, i: number) => (
                            <li key={i}>
                              {a?.task || String(a)}
                              {a?.owner ? (
                                <span className="text-c-text-secondary"> — {a.owner}</span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-c-border-subtle">
              <button
                type="button"
                onClick={() => (generatedNote ? setGeneratedNote(null) : setShowNotesModal(false))}
                className="h-9 px-4 rounded-full border border-c-border text-sm"
              >
                {generatedNote
                  ? t('meeting.notes.backToProposals', 'Back to proposals')
                  : t('common.close', 'Close')}
              </button>
              {!generatedNote && (
                <button
                  type="button"
                  onClick={handleGenerateNotes}
                  disabled={generatingNotes || !notesTranscript.trim()}
                  className="h-9 px-4 rounded-full bg-c-text text-c-surface text-sm font-medium inline-flex items-center gap-1.5 disabled:opacity-50 hover:opacity-90"
                >
                  <Sparkles className="w-4 h-4" />
                  {generatingNotes ? t('meeting.generating2') : t('meeting.generateNotes2')}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-c-surface border border-slate-200/60 dark:border-white/[0.03]">
            <div className="px-5 py-4 border-b border-c-border-subtle">
              <div className="text-sm font-semibold text-c-text">
                {t('meeting.delete.title', 'Delete meeting')}
              </div>
            </div>
            <div className="px-5 py-4 text-sm text-c-text-secondary">
              {t(
                'meeting.delete.confirm',
                'This permanently removes the meeting, its decisions, and follow-ups. This cannot be undone.'
              )}
              <div className="mt-2 font-medium text-c-text">{deleteTarget.title}</div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-c-border-subtle">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="h-9 px-4 rounded-full border border-c-border text-sm disabled:opacity-60"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={handleDeleteMeeting}
                disabled={deleting}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-c-danger text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : null}
                {t('meeting.delete.action', 'Delete meeting')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <div className="mb-1.5 text-xs font-medium text-c-text-muted">{label}</div>
    {children}
  </label>
);

const MeetingDetailView: React.FC<{
  meeting: MeetingItem;
  isPolish: boolean;
  operatorBrief?: any;
  operatorBriefLoading?: boolean;
  operatorBriefError?: boolean;
  onRetryOperatorBrief?: () => void;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleStatus: () => void;
  onGenerateNotes: () => void;
}> = ({
  meeting,
  isPolish,
  operatorBrief,
  operatorBriefLoading,
  operatorBriefError,
  onRetryOperatorBrief,
  onBack,
  onEdit,
  onDelete,
  onToggleStatus,
  onGenerateNotes,
}) => {
  const { t } = useTranslation();
  return (
    <div className="p-4 lg:p-6">
      <div className="rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-c-border-subtle">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-c-text-muted">
              {t('meeting.meetingLabel')}
            </div>
            <div className="text-lg font-semibold text-c-text truncate">{meeting.title}</div>
            <div className="mt-1 text-sm text-c-text-muted">
              {formatDateTime(meeting.startAt, isPolish)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="h-9 px-4 rounded-full border border-c-border text-sm font-medium"
            >
              {t('meeting.edit2')}
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="h-9 px-4 rounded-full border border-red-200 text-red-600 dark:border-red-500/30 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-500/10"
            >
              {t('meeting.delete4')}
            </button>
            <button
              type="button"
              onClick={onToggleStatus}
              className="h-9 px-4 rounded-full border border-c-border text-sm font-medium"
            >
              {meeting.status === 'completed'
                ? t('meeting.markScheduled')
                : t('meeting.markCompleted')}
            </button>
            <button
              type="button"
              onClick={onGenerateNotes}
              className="h-9 px-4 rounded-full bg-c-text text-c-surface text-sm font-medium inline-flex items-center gap-1.5 hover:opacity-90"
              title={t('meeting.generateAiNotesFromTranscript')}
            >
              <Sparkles className="w-4 h-4" />
              {t('meeting.aiNotes')}
            </button>
            <button
              type="button"
              onClick={onBack}
              className="h-9 px-4 rounded-full border border-c-border text-sm"
            >
              {t('meeting.backToList')}
            </button>
          </div>
        </div>
        <div className="grid gap-4 p-5 lg:grid-cols-2">
          <MeetingOperatorBriefCard
            isPolish={isPolish}
            brief={operatorBrief}
            loading={operatorBriefLoading}
            error={operatorBriefError}
            onRetry={onRetryOperatorBrief}
            className="lg:col-span-2"
          />
          <PreviewSection
            icon={<Users size={14} />}
            title={t('meeting.attendees2')}
            items={meeting.attendees}
            emptyLabel={t('meeting.noAttendeesYet')}
          />
          <PreviewSection
            icon={<FileText size={14} />}
            title={'Pre-read'}
            items={meeting.preRead}
            emptyLabel={t('meeting.noPreReadYet')}
          />
          <PreviewSection
            icon={<ClipboardList size={14} />}
            title={'Agenda'}
            items={meeting.agenda}
            emptyLabel={t('meeting.noAgendaYet')}
          />
          <PreviewSection
            icon={<CheckSquare2 size={14} />}
            title={t('meeting.decisions2')}
            items={meeting.decisions}
            emptyLabel={t('meeting.noDecisionsYet')}
          />
          <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-3 lg:col-span-2">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-c-text-muted">
              <CheckSquare2 size={14} />
              <span>{t('meeting.followUps2')}</span>
            </div>
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
                        label={item.status === 'done' ? t('meeting.done') : t('meeting.open2')}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-c-text-muted">{t('meeting.noFollowUpsYet')}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const MeetingOperatorBriefCard: React.FC<{
  isPolish: boolean;
  brief?: any;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  className?: string;
}> = ({ isPolish, brief, loading = false, error = false, onRetry, className = '' }) => {
  const { t } = useTranslation();
  return (
    <div
      className={`rounded-xl border border-c-border-subtle bg-c-surface-raised p-3 ${className}`.trim()}
    >
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-c-text-secondary">
        <Sparkles size={14} />
        <span>{'Operator brief'}</span>
      </div>
      {loading ? (
        <div className="text-sm text-c-text-muted">{t('meeting.preparingMeetingBrief')}</div>
      ) : error ? (
        <div className="flex flex-col items-start gap-2">
          <div className="text-sm text-amber-600 dark:text-amber-400">
            {t('meeting.operatorBriefError', 'Could not load the operator brief.')}
          </div>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="text-xs font-medium text-c-text-secondary underline underline-offset-2 hover:text-c-text"
            >
              {t('common.retry', 'Retry')}
            </button>
          ) : null}
        </div>
      ) : brief ? (
        <div className="space-y-2">
          <div className="text-sm text-c-text-secondary">{brief.prepSummary}</div>
          {Array.isArray(brief.agendaGaps) && brief.agendaGaps.length ? (
            <div className="text-xs text-c-text-muted">
              {(brief.agendaGaps as string[]).slice(0, 2).join(' • ')}
            </div>
          ) : null}
          {Array.isArray(brief.followUpSuggestions) && brief.followUpSuggestions.length ? (
            <div className="space-y-1">
              {(brief.followUpSuggestions as string[]).slice(0, 3).map((item) => (
                <div key={item} className="text-xs text-c-text-secondary">
                  {item}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="text-sm text-c-text-muted">{t('meeting.noOperatorBrief')}</div>
      )}
    </div>
  );
};

const PreviewSection: React.FC<{
  icon: React.ReactNode;
  title: string;
  items: string[];
  emptyLabel: string;
}> = ({ icon, title, items, emptyLabel }) => (
  <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-3">
    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-c-text-muted">
      {icon}
      <span>{title}</span>
    </div>
    {items.length ? (
      <div className="space-y-1.5">
        {items.map((item, idx) => (
          <div key={`${title}-${idx}`} className="text-sm text-c-text-secondary">
            {item}
          </div>
        ))}
      </div>
    ) : (
      <div className="text-sm text-c-text-muted">{emptyLabel}</div>
    )}
  </div>
);

const dayKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;

const MeetingCalendarView: React.FC<{
  meetings: MeetingItem[];
  isPolish: boolean;
  onSelectMeeting: (meeting: MeetingItem) => void;
}> = ({ meetings, isPolish, onSelectMeeting }) => {
  const { t } = useTranslation();
  const locale = isPolish ? 'pl-PL' : 'en-US';
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  // Group meetings by local day for O(1) cell lookup.
  const byDay = useMemo(() => {
    const map = new Map<string, MeetingItem[]>();
    for (const meeting of meetings) {
      const date = new Date(meeting.startAt);
      if (Number.isNaN(date.getTime())) continue;
      const key = dayKey(date);
      const bucket = map.get(key);
      if (bucket) bucket.push(meeting);
      else map.set(key, [meeting]);
    }
    return map;
  }, [meetings]);

  // Build a Monday-first 6-week grid covering the visible month.
  const weeks = useMemo(() => {
    const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const offset = (firstOfMonth.getDay() + 6) % 7; // 0 = Monday
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(firstOfMonth.getDate() - offset);
    const rows: Date[][] = [];
    const runner = new Date(gridStart);
    for (let week = 0; week < 6; week += 1) {
      const row: Date[] = [];
      for (let day = 0; day < 7; day += 1) {
        row.push(new Date(runner));
        runner.setDate(runner.getDate() + 1);
      }
      rows.push(row);
    }
    return rows;
  }, [cursor]);

  const weekdayLabels = useMemo(() => {
    const ref = new Date(2024, 0, 1); // a Monday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(ref);
      d.setDate(ref.getDate() + i);
      return d.toLocaleDateString(locale, { weekday: 'short' });
    });
  }, [locale]);

  const monthLabel = cursor.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const todayKey = dayKey(today);

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold capitalize text-c-text">{monthLabel}</div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            aria-label={t('meeting.previousMonth')}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-c-border text-c-text-muted hover:bg-c-surface-raised"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
            className="h-8 rounded-full border border-c-border px-3 text-xs font-medium text-c-text-secondary hover:bg-c-surface-raised"
          >
            {t('meeting.today')}
          </button>
          <button
            type="button"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            aria-label={t('meeting.nextMonth')}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-c-border text-c-text-muted hover:bg-c-surface-raised"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px">
        {weekdayLabels.map((label) => (
          <div
            key={label}
            className="px-2 py-1.5 text-center text-[11px] font-medium uppercase tracking-wide text-c-text-muted"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-7 grid-rows-6 gap-px overflow-auto rounded-xl border border-c-border-subtle bg-c-border-subtle">
        {weeks.flat().map((date) => {
          const key = dayKey(date);
          const inMonth = date.getMonth() === cursor.getMonth();
          const dayMeetings = byDay.get(key) || [];
          const isToday = key === todayKey;
          return (
            <div key={key} className={`min-h-[88px] p-1.5 ${inMonth ? 'bg-c-surface' : 'bg-c-bg'}`}>
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] ${
                    isToday
                      ? 'bg-c-focus-solid font-semibold text-white'
                      : inMonth
                        ? 'text-c-text-secondary'
                        : 'text-c-text-secondary'
                  }`}
                >
                  {date.getDate()}
                </span>
              </div>
              <div className="space-y-1">
                {dayMeetings.slice(0, 3).map((meeting) => (
                  <button
                    key={meeting.id}
                    type="button"
                    onClick={() => onSelectMeeting(meeting)}
                    title={meeting.title}
                    className={`block w-full truncate rounded-md px-1.5 py-0.5 text-left text-[11px] font-medium transition-colors ${
                      deriveMeetingLifecycle(meeting) === 'completed'
                        ? 'bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300'
                        : deriveMeetingLifecycle(meeting) === 'past_needs_update'
                          ? 'bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300'
                          : 'bg-sky-500/10 text-sky-700 hover:bg-sky-500/20 dark:text-sky-300'
                    }`}
                  >
                    {new Date(meeting.startAt).toLocaleTimeString(locale, {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    {meeting.title}
                  </button>
                ))}
                {dayMeetings.length > 3 ? (
                  <div className="px-1.5 text-[10px] text-c-text-muted">
                    +{dayMeetings.length - 3} {t('meeting.more')}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Guard that the loaded operator brief belongs to the meeting we are rendering.
 * The brief response carries a `meetingId` (see aiOperatorService.getMeetingBrief);
 * when present we match on it to avoid flashing a stale brief during the
 * meeting→meeting transition. If a future brief omits the id we fall back to
 * trusting the response (the fetch effect is already keyed to the active meeting).
 */
function briefMatchesMeeting(brief: any, meetingId: string): boolean {
  if (!brief) return false;
  if (typeof brief.meetingId === 'string') return brief.meetingId === meetingId;
  return true;
}

/** Convert an ISO/date string into a value the `datetime-local` input accepts. */
function toLocalInput(value: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

/**
 * CB-04/RB-009/RV-024 — the persisted `status` column only ever holds
 * 'scheduled' | 'completed' (no DB change here), but a meeting whose end
 * time has already passed and was never marked completed is neither
 * genuinely upcoming nor actually done — displaying it as plain "Scheduled"
 * (the pre-fix behavior everywhere in this file) is what made every past
 * meeting in the RV-024 repro read as identical to a real future one, and
 * made the Completed counter read 0 even with ten months-old rows.
 *
 * This is a DISPLAY-only derived lifecycle — the real `status` field and the
 * scheduled/completed filter values are untouched. `now` is injectable so
 * tests can assert exact boundary behavior with a fixed clock instead of
 * real wall-clock time.
 */
export type MeetingLifecycle = 'scheduled' | 'past_needs_update' | 'completed';

export function deriveMeetingLifecycle(
  meeting: MeetingItem,
  now: number = Date.now()
): MeetingLifecycle {
  if (meeting.status === 'completed') return 'completed';
  const end = new Date(meeting.endAt || meeting.startAt).getTime();
  if (Number.isNaN(end)) return 'scheduled';
  return end < now ? 'past_needs_update' : 'scheduled';
}

/**
 * A meeting is "upcoming" when it has not been closed AND has not passed yet.
 * Both the Menu 3 badge and the Menu 3 filter go through this one predicate —
 * that is the whole point (M12-F02). Now expressed in terms of the same
 * lifecycle derivation the status badges use, so "Upcoming" and "Scheduled"
 * can never silently disagree about the same meeting again.
 */
function isUpcoming(meeting: MeetingItem, now: number = Date.now()): boolean {
  return deriveMeetingLifecycle(meeting, now) === 'scheduled';
}

function splitLines(value: string): string[] {
  return String(value || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDateTime(value: string, isPolish: boolean): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(isPolish ? 'pl-PL' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default MeetingHub;
