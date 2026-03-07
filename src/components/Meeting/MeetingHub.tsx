import {
  CalendarDays,
  CheckSquare2,
  ClipboardList,
  FileText,
  Plus,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
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
import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';

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

const STORAGE_KEY = 'consultify.meeting.module.v1';

function createMeetingId() {
  return `meeting-${Math.random().toString(36).slice(2, 10)}`;
}

function seedMeetings(): MeetingItem[] {
  return [];
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = seedMeetings();
      setMeetings(initial);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      setMeetings(Array.isArray(parsed) ? parsed : []);
    } catch {
      setMeetings([]);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(meetings));
  }, [meetings]);

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

  const handleCreateMeeting = () => {
    if (!draft.title.trim() || !draft.startAt) return;

    const meeting: MeetingItem = {
      id: createMeetingId(),
      title: draft.title.trim(),
      startAt: draft.startAt,
      endAt: draft.endAt || draft.startAt,
      location: draft.location.trim(),
      attendees: splitLines(draft.attendees),
      preRead: splitLines(draft.preRead),
      agenda: splitLines(draft.agenda),
      decisions: [],
      followUps: [],
      status: 'scheduled',
    };

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
            {t('meeting.sync.localOnly', 'Workspace-local MVP')}
          </div>
        }
        aiControl={
          <button
            type="button"
            onClick={() => navigate('/chat?context=meeting')}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-sm font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 hover:bg-purple-500/15 transition-colors"
          >
            <Sparkles size={14} />
            <span>AI</span>
          </button>
        }
        commandRowContent={commandRowContent}
        availableViewModes={['table', 'calendar']}
        showTabCounts
      >
        {viewMode === 'calendar' ? (
          <MeetingCalendarView meetings={filteredMeetings} isPolish={isPolish} />
        ) : (
          <div className="h-full overflow-hidden">
            <TableWithPreviewLayout<MeetingItem & { title: string }>
              selectedId={selectedId}
              selectedItem={previewItem}
              onSelect={setSelectedId}
              itemIds={filteredMeetings.map((item) => item.id)}
              renderPreview={(item) => <MeetingPreview meeting={item} isPolish={isPolish} />}
            >
              <FilterableTable
                columns={columns}
                data={filteredMeetings}
                selectedRowId={selectedId}
                onRowClick={(row) => {
                  setSelectedId(row.id);
                  const doc = {
                    id: row.id,
                    type: 'report' as const,
                    subType: 'meeting',
                    name: row.title,
                    status: 'DRAFT' as const,
                  };
                  setOpenDocuments((prev) =>
                    prev.some((item) => item.id === row.id) ? prev : [...prev, doc]
                  );
                  setActiveDocumentId(row.id);
                }}
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
                {t('meeting.modal.note', 'External calendar sync stays out of scope for this MVP.')}
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
    </>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <div className="mb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">{label}</div>
    {children}
  </label>
);

const MeetingPreview: React.FC<{ meeting: MeetingItem; isPolish: boolean }> = ({
  meeting,
  isPolish,
}) => (
  <div className="space-y-4">
    <div className="flex items-center gap-2 flex-wrap">
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400">
        {meeting.status === 'completed'
          ? isPolish
            ? 'Zamknięte'
            : 'Completed'
          : isPolish
            ? 'Zaplanowane'
            : 'Scheduled'}
      </span>
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300">
        {formatDateTime(meeting.startAt, isPolish)}
      </span>
    </div>

    <div className="space-y-2">
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
        title={isPolish ? 'Follow-up' : 'Follow-up'}
        items={meeting.followUps.map((item) => `${item.title} · ${item.owner}`)}
        emptyLabel={isPolish ? 'Brak follow-upów' : 'No follow-ups yet'}
      />
    </div>
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
