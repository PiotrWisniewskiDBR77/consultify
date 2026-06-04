import {
  CalendarDays,
  CheckSquare2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
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

import {
  type FilterChip,
  ModuleHub,
  type ModuleTab,
  type ViewMode,
} from '@/components/shared/ModuleHub';
import { FilterableTable, type TableColumn } from '@/components/shared/ModuleHub';
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
import { type MetaPill, PreviewMetaCard } from '@/components/shared/PreviewPane';
import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import { ErrorState, LoadingState, StatusChip } from '@/components/ui/primitives';
import { Api } from '@/services/api';

type FollowUpStatus = 'open' | 'done';
type MeetingStatus = 'scheduled' | 'completed';

interface FollowUpItem {
  id: string;
  title: string;
  owner: string;
  status: FollowUpStatus;
}

interface MeetingItem {
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

  const [activeTab, setActiveTab] = useState<ModuleTab>('list');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [notesTranscript, setNotesTranscript] = useState('');
  const [generatingNotes, setGeneratingNotes] = useState(false);
  const [generatedNote, setGeneratedNote] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<MeetingItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [operatorBrief, setOperatorBrief] = useState<any>(null);
  const [operatorBriefLoading, setOperatorBriefLoading] = useState(false);
  const [draft, setDraft] = useState({
    title: '',
    startAt: '',
    endAt: '',
    location: '',
    attendees: '',
    preRead: '',
    agenda: '',
  });
  const [followUpDraft, setFollowUpDraft] = useState({
    title: '',
    owner: '',
  });
  const [decisionDraft, setDecisionDraft] = useState('');

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
    }

    return data;
  }, [activeFilters, meetings, searchQuery]);

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
      return;
    }
    setOperatorBriefLoading(true);
    void (Api as any)
      .getAIOperatorMeetingBrief?.(targetMeetingId)
      .then((data: any) => {
        if (!cancelled) setOperatorBrief(data || null);
      })
      .catch(() => {
        if (!cancelled) setOperatorBrief(null);
      })
      .finally(() => {
        if (!cancelled) setOperatorBriefLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [briefingMeeting?.id]);

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
    const now = Date.now();
    return {
      all: meetings.length,
      upcoming: meetings.filter((item) => new Date(item.endAt || item.startAt).getTime() >= now)
        .length,
      followUp: meetings.filter((item) => item.followUps.some((x) => x.status === 'open')).length,
      completed: meetings.filter((item) => item.status === 'completed').length,
    };
  }, [meetings]);

  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'title',
        label: t('meeting.columns.title', 'Meeting'),
        width: '280px',
        render: (row: MeetingItem) => (
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
              {row.title}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {row.location || (isPolish ? 'Bez lokalizacji' : 'No location')}
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
          <span className="text-sm text-slate-600 dark:text-slate-300">
            {formatDateTime(row.startAt, isPolish)}
          </span>
        ),
      },
      {
        id: 'attendees',
        label: t('meeting.columns.attendees', 'Attendees'),
        width: '120px',
        render: (row: MeetingItem) => (
          <span className="text-sm text-slate-600 dark:text-slate-300">{row.attendees.length}</span>
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
        render: (row: MeetingItem) => (
          <StatusChip
            tone={row.status === 'completed' ? 'success' : 'info'}
            label={
              row.status === 'completed'
                ? t('meeting.status.completed', 'Completed')
                : t('meeting.status.scheduled', 'Scheduled')
            }
          />
        ),
      },
      {
        id: 'followUps',
        label: t('meeting.columns.followUps', 'Follow-ups'),
        width: '110px',
        render: (row: MeetingItem) => (
          <span className="text-sm text-slate-600 dark:text-slate-300">
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
        active: activeFilters.some((f) => f.id === 'status:scheduled'),
        onClick: () =>
          setActiveFilters([
            { id: 'status:scheduled', column: 'status', value: 'scheduled', label: 'Scheduled' },
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

  const handleAddFollowUp = async () => {
    if (!activeMeeting || !followUpDraft.title.trim()) return;
    try {
      const response = await (Api as any).addMeetingFollowUp?.(activeMeeting.id, {
        title: followUpDraft.title.trim(),
        owner: followUpDraft.owner.trim() || (isPolish ? 'Nieprzypisane' : 'Unassigned'),
      });
      const meeting = response?.meeting as MeetingItem | undefined;
      if (!meeting) throw new Error('Follow-up was not created');
      setMeetings((prev) => prev.map((item) => (item.id === activeMeeting.id ? meeting : item)));
      setFollowUpDraft({ title: '', owner: '' });
      setShowFollowUpModal(false);
      toast.success(t('meeting.followUp.notifications.created', 'Follow-up added'));
    } catch (error) {
      console.error('Failed to add follow-up:', error);
      toast.error(t('meeting.followUp.errors.createFailed', 'Failed to add follow-up'));
    }
  };

  const handleAddDecision = async () => {
    if (!activeMeeting || !decisionDraft.trim()) return;
    try {
      const response = await (Api as any).addMeetingDecision?.(
        activeMeeting.id,
        decisionDraft.trim()
      );
      const meeting = response?.meeting as MeetingItem | undefined;
      if (!meeting) throw new Error('Decision was not created');
      setMeetings((prev) => prev.map((item) => (item.id === activeMeeting.id ? meeting : item)));
      setDecisionDraft('');
      setShowDecisionModal(false);
      toast.success(t('meeting.decisions.notifications.created', 'Decision added'));
    } catch (error) {
      console.error('Failed to add decision:', error);
      toast.error(t('meeting.decisions.errors.createFailed', 'Failed to add decision'));
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
      if (!note) throw new Error('No notes returned');
      setGeneratedNote(note);
      // The route persisted decisions/follow-ups; refresh the meeting in the list.
      const meeting = response?.meeting as MeetingItem | undefined;
      if (meeting) {
        setMeetings((prev) => prev.map((item) => (item.id === activeMeeting.id ? meeting : item)));
      }
      toast.success(t('meeting.notes.notifications.generated', 'AI notes generated'));
    } catch (error) {
      console.error('Failed to generate meeting notes:', error);
      toast.error(t('meeting.notes.errors.generateFailed', 'Failed to generate notes'));
    } finally {
      setGeneratingNotes(false);
    }
  };

  const handleToggleFollowUpStatus = async (meetingId: string, followUpId: string) => {
    const meeting = meetings.find((item) => item.id === meetingId);
    const followUp = meeting?.followUps.find((item) => item.id === followUpId);
    if (!meeting || !followUp) return;
    const nextStatus = followUp.status === 'done' ? 'open' : 'done';
    try {
      const response = await (Api as any).updateMeetingFollowUpStatus?.(
        meetingId,
        followUpId,
        nextStatus
      );
      const updated = response?.meeting as MeetingItem | undefined;
      if (!updated) throw new Error('Follow-up status update failed');
      setMeetings((prev) => prev.map((item) => (item.id === meetingId ? updated : item)));
    } catch (error) {
      console.error('Failed to update follow-up status:', error);
      toast.error(t('meeting.followUp.errors.statusFailed', 'Failed to update follow-up status'));
    }
  };

  const previewItem = selectedMeeting ? { ...selectedMeeting, title: selectedMeeting.title } : null;

  return (
    <>
      <ModuleHub
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onSearch={setSearchQuery}
        openDocuments={openDocuments}
        activeDocumentId={activeDocumentId}
        onSelectDocument={setActiveDocumentId}
        onCloseDocument={(id) => {
          setOpenDocuments((prev) => prev.filter((doc) => doc.id !== id));
          if (activeDocumentId === id) setActiveDocumentId(null);
        }}
        onShowList={() => setActiveDocumentId(null)}
        activeFilters={activeFilters}
        onRemoveFilter={(id) => setActiveFilters((prev) => prev.filter((item) => item.id !== id))}
        onClearFilters={() => setActiveFilters([])}
        primaryCta={
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-full text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors"
          >
            <span>{t('meeting.actions.new', 'New meeting')}</span>
          </button>
        }
        rightControls={
          <div className="inline-flex items-center rounded-full border border-slate-200/70 dark:border-white/[0.08] px-3 h-9 text-xs text-slate-500 dark:text-slate-400">
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
        availableViewModes={['table', 'calendar']}
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
            onBack={() => setActiveDocumentId(null)}
            onEdit={() => openEditModal(activeMeeting)}
            onDelete={() => setDeleteTarget(activeMeeting)}
            onToggleStatus={() => handleToggleMeetingStatus(activeMeeting.id)}
            onAddDecision={() => setShowDecisionModal(true)}
            onAddFollowUp={() => setShowFollowUpModal(true)}
            onGenerateNotes={() => {
              setGeneratedNote(null);
              setNotesTranscript('');
              setShowNotesModal(true);
            }}
            onToggleFollowUpStatus={(followUpId) =>
              handleToggleFollowUpStatus(activeMeeting.id, followUpId)
            }
          />
        ) : viewMode === 'calendar' ? (
          <MeetingCalendarView
            meetings={filteredMeetings}
            isPolish={isPolish}
            onSelectMeeting={(meeting) => openMeetingDocument(meeting)}
          />
        ) : (
          <div className="h-full overflow-hidden">
            <TableWithPreviewLayout<MeetingItem & { title: string }>
              selectedId={selectedId}
              selectedItem={previewItem}
              onSelect={setSelectedId}
              onOpenFull={(id) => {
                const meeting = meetings.find((item) => item.id === id);
                if (meeting) openMeetingDocument(meeting);
              }}
              itemIds={filteredMeetings.map((item) => item.id)}
              getItemById={(id) => filteredMeetings.find((x) => x.id === id) ?? null}
              renderPreview={(item) => (
                <MeetingPreview
                  meeting={item}
                  isPolish={isPolish}
                  operatorBrief={briefMatchesMeeting(operatorBrief, item.id) ? operatorBrief : null}
                  operatorBriefLoading={operatorBriefLoading && briefingMeeting?.id === item.id}
                />
              )}
            >
              <FilterableTable
                columns={columns}
                data={filteredMeetings}
                selectedRowId={selectedId}
                onRowClick={(row) => setSelectedId(row.id)}
                onRowDoubleClick={(row) => openMeetingDocument(row as MeetingItem)}
                getRowActions={(row) => [
                  {
                    id: 'preview',
                    label: t('common.preview', 'Preview'),
                    onClick: () => setSelectedId(String(row.id)),
                  },
                  {
                    id: 'open',
                    label: t('common.open', 'Open'),
                    onClick: () => openMeetingDocument(row as MeetingItem),
                  },
                  {
                    id: 'edit',
                    label: t('common.edit', 'Edit'),
                    onClick: () => openEditModal(row as MeetingItem),
                  },
                  {
                    id: 'delete',
                    label: t('common.delete', 'Delete'),
                    onClick: () => setDeleteTarget(row as MeetingItem),
                  },
                ]}
                activeFilters={activeFilters}
                onFilterChange={setActiveFilters}
                emptyMessage={t('meeting.empty', 'No meetings yet')}
                canvasClassName="pl-4 pr-1.5 pt-3 pb-4"
              />
            </TableWithPreviewLayout>
          </div>
        )}
      </ModuleHub>

      {showCreateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-navy-700">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  {editingId
                    ? t('meeting.modal.editTitle', 'Edit meeting')
                    : t('meeting.modal.title', 'Create meeting')}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {t('meeting.modal.subtitle', 'Agenda + pre-read + follow-up workspace')}
                </div>
              </div>
              <button
                type="button"
                onClick={closeMeetingModal}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06]"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5">
              <Field label={t('meeting.fields.title', 'Title')}>
                <input
                  className="w-full rounded-xl border border-slate-200 dark:border-white/[0.08] bg-transparent px-3 py-2 text-sm"
                  value={draft.title}
                  onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
                />
              </Field>
              <Field label={t('meeting.fields.location', 'Location / link')}>
                <input
                  className="w-full rounded-xl border border-slate-200 dark:border-white/[0.08] bg-transparent px-3 py-2 text-sm"
                  value={draft.location}
                  onChange={(e) => setDraft((prev) => ({ ...prev, location: e.target.value }))}
                />
              </Field>
              <Field label={t('meeting.fields.start', 'Start')}>
                <input
                  type="datetime-local"
                  className="w-full rounded-xl border border-slate-200 dark:border-white/[0.08] bg-transparent px-3 py-2 text-sm"
                  value={draft.startAt}
                  onChange={(e) => setDraft((prev) => ({ ...prev, startAt: e.target.value }))}
                />
              </Field>
              <Field label={t('meeting.fields.end', 'End')}>
                <input
                  type="datetime-local"
                  className="w-full rounded-xl border border-slate-200 dark:border-white/[0.08] bg-transparent px-3 py-2 text-sm"
                  value={draft.endAt}
                  onChange={(e) => setDraft((prev) => ({ ...prev, endAt: e.target.value }))}
                />
              </Field>
              <Field label={t('meeting.fields.attendees', 'Attendees, one per line')}>
                <textarea
                  className="min-h-28 w-full rounded-xl border border-slate-200 dark:border-white/[0.08] bg-transparent px-3 py-2 text-sm"
                  value={draft.attendees}
                  onChange={(e) => setDraft((prev) => ({ ...prev, attendees: e.target.value }))}
                />
              </Field>
              <Field label={t('meeting.fields.preRead', 'Pre-read links, one per line')}>
                <textarea
                  className="min-h-28 w-full rounded-xl border border-slate-200 dark:border-white/[0.08] bg-transparent px-3 py-2 text-sm"
                  value={draft.preRead}
                  onChange={(e) => setDraft((prev) => ({ ...prev, preRead: e.target.value }))}
                />
              </Field>
              <div className="md:col-span-2">
                <Field label={t('meeting.fields.agenda', 'Agenda items, one per line')}>
                  <textarea
                    className="min-h-32 w-full rounded-xl border border-slate-200 dark:border-white/[0.08] bg-transparent px-3 py-2 text-sm"
                    value={draft.agenda}
                    onChange={(e) => setDraft((prev) => ({ ...prev, agenda: e.target.value }))}
                  />
                </Field>
              </div>
            </div>

            <div className="flex items-center justify-between px-5 py-4 border-t border-slate-200 dark:border-navy-700">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {t('meeting.modal.note', 'Meeting details are stored in the shared workspace.')}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeMeetingModal}
                  className="h-9 px-4 rounded-full border border-slate-200 dark:border-white/[0.08] text-sm"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleSaveMeeting}
                  className="h-9 px-4 rounded-full bg-primary-600 text-white text-sm font-medium"
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
      {showDecisionModal && activeMeeting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-navy-700">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  {t('meeting.decisions.title', 'Add decision')}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {activeMeeting.title}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDecisionModal(false)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06]"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <Field label={t('meeting.decisions.fields.value', 'Decision')}>
                <textarea
                  className="min-h-32 w-full rounded-xl border border-slate-200 dark:border-white/[0.08] bg-transparent px-3 py-2 text-sm"
                  value={decisionDraft}
                  onChange={(e) => setDecisionDraft(e.target.value)}
                />
              </Field>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200 dark:border-navy-700">
              <button
                type="button"
                onClick={() => setShowDecisionModal(false)}
                className="h-9 px-4 rounded-full border border-slate-200 dark:border-white/[0.08] text-sm"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={handleAddDecision}
                className="h-9 px-4 rounded-full bg-primary-600 text-white text-sm font-medium"
              >
                {t('meeting.decisions.actions.add', 'Add decision')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {showFollowUpModal && activeMeeting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-navy-700">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  {t('meeting.followUp.title', 'Add follow-up')}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {activeMeeting.title}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFollowUpModal(false)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06]"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <Field label={t('meeting.followUp.fields.title', 'Action item')}>
                <input
                  className="w-full rounded-xl border border-slate-200 dark:border-white/[0.08] bg-transparent px-3 py-2 text-sm"
                  value={followUpDraft.title}
                  onChange={(e) => setFollowUpDraft((prev) => ({ ...prev, title: e.target.value }))}
                />
              </Field>
              <Field label={t('meeting.followUp.fields.owner', 'Owner')}>
                <input
                  className="w-full rounded-xl border border-slate-200 dark:border-white/[0.08] bg-transparent px-3 py-2 text-sm"
                  value={followUpDraft.owner}
                  onChange={(e) => setFollowUpDraft((prev) => ({ ...prev, owner: e.target.value }))}
                />
              </Field>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200 dark:border-navy-700">
              <button
                type="button"
                onClick={() => setShowFollowUpModal(false)}
                className="h-9 px-4 rounded-full border border-slate-200 dark:border-white/[0.08] text-sm"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={handleAddFollowUp}
                className="h-9 px-4 rounded-full bg-primary-600 text-white text-sm font-medium"
              >
                {t('meeting.followUp.actions.add', 'Add follow-up')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {showNotesModal && activeMeeting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200 dark:border-navy-700">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 dark:text-white inline-flex items-center gap-2">
                  <Sparkles size={16} className="text-[#A51C30]" />
                  {isPolish ? 'Notatki AI ze spotkania' : 'AI Meeting Notes'}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {activeMeeting.title}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNotesModal(false)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06]"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-4 p-5">
              {!generatedNote ? (
                <Field
                  label={isPolish ? 'Wklej transkrypcję spotkania' : 'Paste the meeting transcript'}
                >
                  <textarea
                    className="w-full min-h-[180px] rounded-xl border border-slate-200 dark:border-white/[0.08] bg-transparent px-3 py-2 text-sm"
                    placeholder={
                      isPolish
                        ? 'Wklej tu transkrypcję — Teresa wyciągnie podsumowanie, decyzje i zadania...'
                        : 'Paste the transcript — Teresa will extract a summary, decisions, and action items...'
                    }
                    value={notesTranscript}
                    onChange={(e) => setNotesTranscript(e.target.value)}
                  />
                </Field>
              ) : (
                <div className="space-y-4">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                      {isPolish ? 'Podsumowanie' : 'Summary'}
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-200">
                      {generatedNote.summary}
                    </p>
                  </div>
                  {Array.isArray(generatedNote.keyPoints) && generatedNote.keyPoints.length > 0 && (
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                        {isPolish ? 'Kluczowe punkty' : 'Key points'}
                      </div>
                      <ul className="list-disc pl-5 text-sm text-slate-700 dark:text-slate-200 space-y-1">
                        {generatedNote.keyPoints.map((kp: string, i: number) => (
                          <li key={i}>{kp}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {Array.isArray(generatedNote.decisions) && generatedNote.decisions.length > 0 && (
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                        {isPolish ? 'Decyzje (zapisane)' : 'Decisions (saved)'}
                      </div>
                      <ul className="list-disc pl-5 text-sm text-slate-700 dark:text-slate-200 space-y-1">
                        {generatedNote.decisions.map((d: any, i: number) => (
                          <li key={i}>{d?.decision || String(d)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {Array.isArray(generatedNote.actionItems) &&
                    generatedNote.actionItems.length > 0 && (
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                          {isPolish
                            ? 'Zadania (zapisane jako follow-up)'
                            : 'Action items (saved as follow-ups)'}
                        </div>
                        <ul className="list-disc pl-5 text-sm text-slate-700 dark:text-slate-200 space-y-1">
                          {generatedNote.actionItems.map((a: any, i: number) => (
                            <li key={i}>
                              {a?.task || String(a)}
                              {a?.owner ? (
                                <span className="text-slate-400"> — {a.owner}</span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200 dark:border-navy-700">
              <button
                type="button"
                onClick={() => setShowNotesModal(false)}
                className="h-9 px-4 rounded-full border border-slate-200 dark:border-white/[0.08] text-sm"
              >
                {generatedNote ? t('common.close', 'Close') : t('common.cancel', 'Cancel')}
              </button>
              {!generatedNote && (
                <button
                  type="button"
                  onClick={handleGenerateNotes}
                  disabled={generatingNotes || !notesTranscript.trim()}
                  className="h-9 px-4 rounded-full bg-[#A51C30] text-white text-sm font-medium inline-flex items-center gap-1.5 disabled:opacity-50 hover:bg-[#8a1828]"
                >
                  <Sparkles className="w-4 h-4" />
                  {generatingNotes
                    ? isPolish
                      ? 'Generuję...'
                      : 'Generating...'
                    : isPolish
                      ? 'Wygeneruj notatki'
                      : 'Generate notes'}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-navy-700">
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                {t('meeting.delete.title', 'Delete meeting')}
              </div>
            </div>
            <div className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">
              {t(
                'meeting.delete.confirm',
                'This permanently removes the meeting, its decisions, and follow-ups. This cannot be undone.'
              )}
              <div className="mt-2 font-medium text-slate-900 dark:text-white">
                {deleteTarget.title}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200 dark:border-navy-700">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="h-9 px-4 rounded-full border border-slate-200 dark:border-white/[0.08] text-sm disabled:opacity-60"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={handleDeleteMeeting}
                disabled={deleting}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-60"
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
    <div className="mb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">{label}</div>
    {children}
  </label>
);

const MeetingDetailView: React.FC<{
  meeting: MeetingItem;
  isPolish: boolean;
  operatorBrief?: any;
  operatorBriefLoading?: boolean;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleStatus: () => void;
  onAddDecision: () => void;
  onAddFollowUp: () => void;
  onGenerateNotes: () => void;
  onToggleFollowUpStatus: (followUpId: string) => void;
}> = ({
  meeting,
  isPolish,
  operatorBrief,
  operatorBriefLoading,
  onBack,
  onEdit,
  onDelete,
  onToggleStatus,
  onAddDecision,
  onAddFollowUp,
  onGenerateNotes,
  onToggleFollowUpStatus,
}) => (
  <div className="p-4 lg:p-6">
    <div className="rounded-2xl border border-slate-200/70 dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.04] overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200/70 dark:border-white/[0.08]">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {isPolish ? 'Spotkanie' : 'Meeting'}
          </div>
          <div className="text-lg font-semibold text-slate-900 dark:text-white truncate">
            {meeting.title}
          </div>
          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {formatDateTime(meeting.startAt, isPolish)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="h-9 px-4 rounded-full border border-slate-200 dark:border-white/[0.08] text-sm font-medium"
          >
            {isPolish ? 'Edytuj' : 'Edit'}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="h-9 px-4 rounded-full border border-red-200 text-red-600 dark:border-red-500/30 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-500/10"
          >
            {isPolish ? 'Usuń' : 'Delete'}
          </button>
          <button
            type="button"
            onClick={onToggleStatus}
            className="h-9 px-4 rounded-full border border-slate-200 dark:border-white/[0.08] text-sm font-medium"
          >
            {meeting.status === 'completed'
              ? isPolish
                ? 'Oznacz jako zaplanowane'
                : 'Mark scheduled'
              : isPolish
                ? 'Oznacz jako zakończone'
                : 'Mark completed'}
          </button>
          <button
            type="button"
            onClick={onAddDecision}
            className="h-9 px-4 rounded-full border border-slate-200 dark:border-white/[0.08] text-sm font-medium"
          >
            {isPolish ? 'Dodaj decyzję' : 'Add decision'}
          </button>
          <button
            type="button"
            onClick={onAddFollowUp}
            className="h-9 px-4 rounded-full bg-primary-600 text-white text-sm font-medium"
          >
            {isPolish ? 'Dodaj follow-up' : 'Add follow-up'}
          </button>
          <button
            type="button"
            onClick={onGenerateNotes}
            className="h-9 px-4 rounded-full bg-[#A51C30] text-white text-sm font-medium inline-flex items-center gap-1.5 hover:bg-[#8a1828]"
            title={
              isPolish
                ? 'Wygeneruj notatki AI z transkrypcji (Teresa)'
                : 'Generate AI notes from transcript (Teresa)'
            }
          >
            <Sparkles className="w-4 h-4" />
            {isPolish ? 'Notatki AI' : 'AI Notes'}
          </button>
          <button
            type="button"
            onClick={onBack}
            className="h-9 px-4 rounded-full border border-slate-200 dark:border-white/[0.08] text-sm"
          >
            {isPolish ? 'Wróć do listy' : 'Back to list'}
          </button>
        </div>
      </div>
      <div className="grid gap-4 p-5 lg:grid-cols-2">
        <MeetingOperatorBriefCard
          isPolish={isPolish}
          brief={operatorBrief}
          loading={operatorBriefLoading}
          className="lg:col-span-2"
        />
        <PreviewSection
          icon={<Users size={14} />}
          title={isPolish ? 'Uczestnicy' : 'Attendees'}
          items={meeting.attendees}
          emptyLabel={isPolish ? 'Brak listy uczestników' : 'No attendees yet'}
        />
        <PreviewSection
          icon={<FileText size={14} />}
          title={isPolish ? 'Pre-read' : 'Pre-read'}
          items={meeting.preRead}
          emptyLabel={isPolish ? 'Brak materiałów' : 'No pre-read yet'}
        />
        <PreviewSection
          icon={<ClipboardList size={14} />}
          title={isPolish ? 'Agenda' : 'Agenda'}
          items={meeting.agenda}
          emptyLabel={isPolish ? 'Brak agendy' : 'No agenda yet'}
        />
        <PreviewSection
          icon={<CheckSquare2 size={14} />}
          title={isPolish ? 'Decyzje' : 'Decisions'}
          items={meeting.decisions}
          emptyLabel={isPolish ? 'Brak decyzji' : 'No decisions yet'}
        />
        <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] p-3 lg:col-span-2">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <CheckSquare2 size={14} />
            <span>{isPolish ? 'Follow-upy' : 'Follow-ups'}</span>
          </div>
          {meeting.followUps.length ? (
            <div className="space-y-2">
              {meeting.followUps.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onToggleFollowUpStatus(item.id)}
                  className="w-full rounded-xl border border-slate-200/70 dark:border-white/[0.08] px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {item.title}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{item.owner}</div>
                    </div>
                    <StatusChip
                      tone={item.status === 'done' ? 'success' : 'warning'}
                      label={
                        item.status === 'done'
                          ? isPolish
                            ? 'Zrobione'
                            : 'Done'
                          : isPolish
                            ? 'Otwarte'
                            : 'Open'
                      }
                    />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-600">
              {isPolish ? 'Brak follow-upów' : 'No follow-ups yet'}
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
);

const MeetingPreview: React.FC<{
  meeting: MeetingItem;
  isPolish: boolean;
  operatorBrief?: any;
  operatorBriefLoading?: boolean;
}> = ({ meeting, isPolish, operatorBrief, operatorBriefLoading }) => {
  const pills: MetaPill[] = [
    {
      label:
        meeting.status === 'completed'
          ? isPolish
            ? 'Zamknięte'
            : 'Completed'
          : isPolish
            ? 'Zaplanowane'
            : 'Scheduled',
      className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    },
    {
      label: formatDateTime(meeting.startAt, isPolish),
      className: 'bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300',
    },
  ];

  return (
    <div className="space-y-4 text-sm">
      <PreviewMetaCard pills={pills} />

      <MeetingOperatorBriefCard
        isPolish={isPolish}
        brief={operatorBrief}
        loading={operatorBriefLoading}
      />

      <PreviewSection
        icon={<Users size={14} />}
        title={isPolish ? 'Uczestnicy' : 'Attendees'}
        items={meeting.attendees}
        emptyLabel={isPolish ? 'Brak listy uczestników' : 'No attendees yet'}
      />
      <PreviewSection
        icon={<FileText size={14} />}
        title={isPolish ? 'Pre-read' : 'Pre-read'}
        items={meeting.preRead}
        emptyLabel={isPolish ? 'Brak materiałów' : 'No pre-read yet'}
      />
      <PreviewSection
        icon={<ClipboardList size={14} />}
        title={isPolish ? 'Agenda' : 'Agenda'}
        items={meeting.agenda}
        emptyLabel={isPolish ? 'Brak agendy' : 'No agenda yet'}
      />
      <PreviewSection
        icon={<CheckSquare2 size={14} />}
        title={isPolish ? 'Decyzje' : 'Decisions'}
        items={meeting.decisions}
        emptyLabel={isPolish ? 'Brak decyzji' : 'No decisions yet'}
      />
      <PreviewSection
        icon={<CheckSquare2 size={14} />}
        title={isPolish ? 'Follow-up' : 'Follow-up'}
        items={meeting.followUps.map((item) => `${item.title} · ${item.owner}`)}
        emptyLabel={isPolish ? 'Brak follow-upów' : 'No follow-ups yet'}
      />
    </div>
  );
};

const MeetingOperatorBriefCard: React.FC<{
  isPolish: boolean;
  brief?: any;
  loading?: boolean;
  className?: string;
}> = ({ isPolish, brief, loading = false, className = '' }) => (
  <div
    className={`rounded-xl border border-primary-200/70 dark:border-primary-500/20 bg-primary-50/60 dark:bg-primary-500/5 p-3 ${className}`.trim()}
  >
    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary-700 dark:text-primary-300">
      <Sparkles size={14} />
      <span>{isPolish ? 'Operator brief' : 'Operator brief'}</span>
    </div>
    {loading ? (
      <div className="text-sm text-slate-500 dark:text-slate-400">
        {isPolish ? 'Przygotowuję briefing spotkania...' : 'Preparing meeting brief...'}
      </div>
    ) : brief ? (
      <div className="space-y-2">
        <div className="text-sm text-slate-700 dark:text-slate-200">{brief.prepSummary}</div>
        {Array.isArray(brief.agendaGaps) && brief.agendaGaps.length ? (
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {(brief.agendaGaps as string[]).slice(0, 2).join(' • ')}
          </div>
        ) : null}
        {Array.isArray(brief.followUpSuggestions) && brief.followUpSuggestions.length ? (
          <div className="space-y-1">
            {(brief.followUpSuggestions as string[]).slice(0, 3).map((item) => (
              <div key={item} className="text-xs text-slate-600 dark:text-slate-300">
                {item}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    ) : (
      <div className="text-sm text-slate-500 dark:text-slate-400">
        {isPolish
          ? 'Brak briefingu operatora dla tego spotkania.'
          : 'No operator brief for this meeting.'}
      </div>
    )}
  </div>
);

const PreviewSection: React.FC<{
  icon: React.ReactNode;
  title: string;
  items: string[];
  emptyLabel: string;
}> = ({ icon, title, items, emptyLabel }) => (
  <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] p-3">
    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
      {icon}
      <span>{title}</span>
    </div>
    {items.length ? (
      <div className="space-y-1.5">
        {items.map((item, idx) => (
          <div key={`${title}-${idx}`} className="text-sm text-slate-700 dark:text-slate-200">
            {item}
          </div>
        ))}
      </div>
    ) : (
      <div className="text-sm text-slate-600">{emptyLabel}</div>
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
        <div className="text-sm font-semibold capitalize text-slate-900 dark:text-white">
          {monthLabel}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            aria-label={isPolish ? 'Poprzedni miesiąc' : 'Previous month'}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-white/[0.08] dark:hover:bg-white/[0.04]"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
            className="h-8 rounded-full border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-white/[0.08] dark:text-slate-300 dark:hover:bg-white/[0.04]"
          >
            {isPolish ? 'Dziś' : 'Today'}
          </button>
          <button
            type="button"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            aria-label={isPolish ? 'Następny miesiąc' : 'Next month'}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-white/[0.08] dark:hover:bg-white/[0.04]"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px">
        {weekdayLabels.map((label) => (
          <div
            key={label}
            className="px-2 py-1.5 text-center text-[11px] font-medium uppercase tracking-wide text-slate-600 dark:text-slate-500"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-7 grid-rows-6 gap-px overflow-auto rounded-xl border border-slate-200 bg-slate-200 dark:border-white/[0.08] dark:bg-white/[0.06]">
        {weeks.flat().map((date) => {
          const key = dayKey(date);
          const inMonth = date.getMonth() === cursor.getMonth();
          const dayMeetings = byDay.get(key) || [];
          const isToday = key === todayKey;
          return (
            <div
              key={key}
              className={`min-h-[88px] p-1.5 ${
                inMonth ? 'bg-white dark:bg-navy-900' : 'bg-slate-50 dark:bg-white/[0.02]'
              }`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] ${
                    isToday
                      ? 'bg-primary-600 font-semibold text-white'
                      : inMonth
                        ? 'text-slate-600 dark:text-slate-300'
                        : 'text-slate-600 dark:text-slate-600'
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
                      meeting.status === 'completed'
                        ? 'bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300'
                        : 'bg-primary-500/10 text-primary-700 hover:bg-primary-500/20 dark:text-primary-300'
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
                  <div className="px-1.5 text-[10px] text-slate-600 dark:text-slate-500">
                    +{dayMeetings.length - 3} {isPolish ? 'więcej' : 'more'}
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
