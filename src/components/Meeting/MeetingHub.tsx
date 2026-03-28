import {
  CalendarDays,
  CheckSquare2,
  ClipboardList,
  FileText,
  Loader2,
  Plus,
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
import { useModuleOpenDocuments } from '@/components/shared/ModuleHub/useModuleOpenDocuments';
import { type MetaPill, PreviewMetaCard } from '@/components/shared/PreviewPane';
import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
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
    try {
      const data = await (Api as any).getMeetings?.();
      const rows = Array.isArray(data) ? data : data?.meetings || [];
      setMeetings(Array.isArray(rows) ? rows : []);
    } catch (error) {
      console.error('Failed to load meetings:', error);
      setMeetings([]);
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
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              row.status === 'completed'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
            }`}
          >
            {row.status === 'completed'
              ? t('meeting.status.completed', 'Completed')
              : t('meeting.status.scheduled', 'Scheduled')}
          </span>
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

    return (
      <div className="flex items-center gap-2">
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={chip.onClick}
            className={`h-8 inline-flex items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium border transition-colors whitespace-nowrap ${
              chip.active
                ? 'bg-primary-500/10 text-slate-900 dark:text-slate-100 border-primary-500/40'
                : 'bg-slate-50 dark:bg-navy-950/40 text-slate-600 dark:text-slate-400 border-slate-200/70 dark:border-white/[0.06]'
            }`}
          >
            <span>{chip.label}</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200 dark:bg-navy-700">
              {chip.count}
            </span>
          </button>
        ))}
      </div>
    );
  }, [activeFilters, counts, t]);

  const handleCreateMeeting = async () => {
    if (!draft.title.trim() || !draft.startAt) return;
    try {
      const response = await (Api as any).createMeeting?.({
        title: draft.title.trim(),
        startAt: draft.startAt,
        endAt: draft.endAt || draft.startAt,
        location: draft.location.trim(),
        attendees: splitLines(draft.attendees),
        preRead: splitLines(draft.preRead),
        agenda: splitLines(draft.agenda),
        decisions: [],
      });
      const meeting = response?.meeting as MeetingItem | undefined;
      if (!meeting) throw new Error('Meeting was not created');
      setMeetings((prev) => [meeting, ...prev]);
      setSelectedId(meeting.id);
      setShowCreateModal(false);
      setDraft({
        title: '',
        startAt: '',
        endAt: '',
        location: '',
        attendees: '',
        preRead: '',
        agenda: '',
      });
      toast.success(t('meeting.notifications.created', 'Meeting created'));
    } catch (error) {
      console.error('Failed to create meeting:', error);
      toast.error(t('meeting.errors.createFailed', 'Failed to create meeting'));
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
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-full text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors"
          >
            <Plus size={16} />
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
        showTabCounts
      >
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 size={24} className="animate-spin text-slate-400" />
          </div>
        ) : activeMeeting ? (
          <MeetingDetailView
            meeting={activeMeeting}
            isPolish={isPolish}
            operatorBrief={operatorBrief?.meetingId === activeMeeting.id ? operatorBrief : null}
            operatorBriefLoading={operatorBriefLoading}
            onBack={() => setActiveDocumentId(null)}
            onToggleStatus={() => handleToggleMeetingStatus(activeMeeting.id)}
            onAddDecision={() => setShowDecisionModal(true)}
            onAddFollowUp={() => setShowFollowUpModal(true)}
            onToggleFollowUpStatus={(followUpId) =>
              handleToggleFollowUpStatus(activeMeeting.id, followUpId)
            }
          />
        ) : viewMode === 'calendar' ? (
          <MeetingCalendarView meetings={filteredMeetings} isPolish={isPolish} />
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
                  operatorBrief={operatorBrief?.meetingId === item.id ? operatorBrief : null}
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
                  {t('meeting.modal.title', 'Create meeting')}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {t('meeting.modal.subtitle', 'Agenda + pre-read + follow-up workspace')}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
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
                  onClick={() => setShowCreateModal(false)}
                  className="h-9 px-4 rounded-full border border-slate-200 dark:border-white/[0.08] text-sm"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleCreateMeeting}
                  className="h-9 px-4 rounded-full bg-primary-600 text-white text-sm font-medium"
                >
                  {t('meeting.actions.create', 'Create meeting')}
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
  onToggleStatus: () => void;
  onAddDecision: () => void;
  onAddFollowUp: () => void;
  onToggleFollowUpStatus: (followUpId: string) => void;
}> = ({
  meeting,
  isPolish,
  operatorBrief,
  operatorBriefLoading,
  onBack,
  onToggleStatus,
  onAddDecision,
  onAddFollowUp,
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
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        item.status === 'done'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {item.status === 'done'
                        ? isPolish
                          ? 'Zrobione'
                          : 'Done'
                        : isPolish
                          ? 'Otwarte'
                          : 'Open'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-400">
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
    className={`rounded-xl border border-purple-200/70 dark:border-purple-500/20 bg-purple-50/60 dark:bg-purple-500/5 p-3 ${className}`.trim()}
  >
    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-purple-700 dark:text-purple-300">
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
      <div className="text-sm text-slate-400">{emptyLabel}</div>
    )}
  </div>
);

const MeetingCalendarView: React.FC<{ meetings: MeetingItem[]; isPolish: boolean }> = ({
  meetings,
  isPolish,
}) => {
  const grouped = meetings.reduce<Record<string, MeetingItem[]>>((acc, item) => {
    const key = new Date(item.startAt).toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', {
      month: 'long',
      year: 'numeric',
    });
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  if (!meetings.length) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-slate-500 dark:text-slate-400">
        {isPolish ? 'Brak spotkań do pokazania.' : 'No meetings to display.'}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {Object.entries(grouped).map(([month, items]) => (
        <div
          key={month}
          className="rounded-2xl border border-slate-200 dark:border-navy-700 bg-white/70 dark:bg-white/[0.03]"
        >
          <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-700 text-sm font-semibold text-slate-900 dark:text-white">
            {month}
          </div>
          <div className="divide-y divide-slate-200 dark:divide-white/[0.06]">
            {items.map((item) => (
              <div key={item.id} className="px-4 py-3 flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-slate-900 dark:text-white">
                    {item.title}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {formatDateTime(item.startAt, isPolish)} ·{' '}
                    {item.location || (isPolish ? 'Bez lokalizacji' : 'No location')}
                  </div>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {item.followUps.filter((x) => x.status === 'open').length}{' '}
                  {isPolish ? 'open follow-ups' : 'open follow-ups'}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

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
