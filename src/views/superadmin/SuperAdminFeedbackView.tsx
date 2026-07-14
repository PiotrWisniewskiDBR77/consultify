import { format, formatDistanceToNowStrict } from 'date-fns';
import { enUS, pl } from 'date-fns/locale';
import {
  AlertTriangle,
  ArrowLeft,
  Bug,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  Globe,
  Image as ImageIcon,
  Lightbulb,
  MessageSquare,
  MessageSquareWarning,
  Monitor,
  Palette,
  PanelsTopLeft,
  Search,
  Send,
  Sparkles,
  Star,
  Tag,
  Terminal,
  User,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { InfoButton } from '../../components/shared/InfoButton';
import { LoadingState } from '../../components/ui/primitives';
import { Api } from '../../services/api';

type FeedbackStatus = 'NEW' | 'PENDING' | 'IN_PROGRESS' | 'REVIEWED' | 'RESOLVED' | 'ARCHIVED';
type FeedbackViewMode = 'board' | 'list';

interface FeedbackWorkflow {
  owner?: string | null;
  cluster?: string | null;
  source?: string | null;
  branch?: string | null;
  prUrl?: string | null;
  taskUrl?: string | null;
  linkedTaskId?: string | null;
  deployStatus?: string | null;
  deployTargets?: string[];
  deployedAt?: string | null;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  waitingOn?: string | null;
  lastUpdatedAt?: string | null;
}

interface FeedbackResolution {
  type?: string | null;
  summary?: string | null;
  rootCause?: string | null;
  verificationNotes?: string | null;
  testPlan?: string[];
}

interface StatusHistoryEntry {
  id: string;
  from_status: string | null;
  to_status: string;
  changed_by: string | null;
  note: string | null;
  created_at: string;
}

type AlertChannel = 'in_app' | 'slack' | 'email' | 'whatsapp';

interface AlertDispatchChannelResult {
  status: 'sent' | 'failed' | 'skipped';
  attemptedAt?: string;
  detail?: string;
  recipientCount?: number;
}

interface AlertDispatchSummary {
  attemptedAt?: string;
  appEnv?: string;
  requestedChannels?: AlertChannel[];
  results?: Partial<Record<AlertChannel, AlertDispatchChannelResult>>;
}

interface FeedbackItem {
  organization_id?: string | null;
  id: string;
  user_id: string;
  user_email: string;
  user_name?: string;
  type: 'BUG' | 'IDEA' | 'FEATURE' | 'PULSE';
  title?: string;
  message: string;
  status: FeedbackStatus;
  severity?: string;
  rating?: number;
  metadata?: string;
  admin_response?: string;
  responded_at?: string;
  route_path?: string;
  device_type?: string;
  screen_size?: string;
  ui_language?: string;
  ui_theme?: string;
  source_env?: string;
  priority?: string;
  linked_task_id?: string;
  created_at: string;
  updated_at?: string;
  statusHistory?: StatusHistoryEntry[];
  workflow?: FeedbackWorkflow;
  resolution?: FeedbackResolution;
  workflowTimeline?: WorkflowTimelineEntry[];
  owner?: string | null;
  cluster?: string | null;
  pr_url?: string | null;
  branch?: string | null;
  deploy_status?: string | null;
  deploy_targets?: string[];
  resolution_summary?: string | null;
  duplicate_count?: number;
  duplicate_of?: string | null;
  signature_hash?: string | null;
  has_screenshot?: boolean;
  has_diagnostics?: boolean;
}

interface WorkflowTimelineEntry {
  id: string;
  at: string;
  actor: string | null;
  action: string;
  note?: string | null;
  changes?: string[];
}

interface WorkflowDraft {
  owner: string;
  cluster: string;
  branch: string;
  prUrl: string;
  taskUrl: string;
  linkedTaskId: string;
  deployStatus: string;
  deployTargets: string;
  deployedAt: string;
  verifiedBy: string;
  verifiedAt: string;
  waitingOn: string;
  resolutionType: string;
  resolutionSummary: string;
  rootCause: string;
  verificationNotes: string;
  testPlan: string;
  note: string;
}

const STATUS_ORDER: FeedbackStatus[] = [
  'NEW',
  'PENDING',
  'IN_PROGRESS',
  'REVIEWED',
  'RESOLVED',
  'ARCHIVED',
];

const STATUS_CONFIG: Record<FeedbackStatus, { color: string; bg: string; border: string }> = {
  NEW: {
    color: 'text-blue-700 dark:text-blue-400',
    bg: 'bg-blue-600/10',
    border: 'border-blue-600/20',
  },
  PENDING: {
    color: 'text-yellow-800 dark:text-yellow-400',
    bg: 'bg-yellow-600/10',
    border: 'border-yellow-600/20',
  },
  IN_PROGRESS: {
    color: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-600/10',
    border: 'border-amber-600/20',
  },
  REVIEWED: {
    color: 'text-primary-700 dark:text-primary-400',
    bg: 'bg-primary-600/10',
    border: 'border-primary-600/20',
  },
  RESOLVED: {
    color: 'text-green-700 dark:text-green-400',
    bg: 'bg-green-600/10',
    border: 'border-green-600/20',
  },
  ARCHIVED: {
    color: 'text-slate-700 dark:text-slate-300',
    bg: 'bg-slate-100 dark:bg-slate-700/50',
    border: 'border-slate-200 dark:border-slate-700',
  },
};

const SEVERITY_CONFIG: Record<string, { color: string; icon: React.ReactNode }> = {
  CRITICAL: { color: 'text-danger-700 dark:text-danger-400', icon: <AlertTriangle size={12} /> },
  HIGH: { color: 'text-amber-700 dark:text-amber-400', icon: <AlertTriangle size={12} /> },
  MEDIUM: { color: 'text-amber-700 dark:text-amber-400', icon: <AlertTriangle size={12} /> },
  LOW: { color: 'text-slate-600 dark:text-slate-500', icon: null },
};

const ALERT_CHANNEL_ORDER: AlertChannel[] = ['in_app', 'slack', 'email', 'whatsapp'];
const ALERT_STATUS_CONFIG: Record<
  AlertDispatchChannelResult['status'],
  { badge: string; text: string }
> = {
  sent: {
    badge:
      'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800',
    text: 'text-green-700 dark:text-green-300',
  },
  failed: {
    badge:
      'bg-danger-50 text-danger-700 border-danger-200 dark:bg-danger-900/20 dark:text-danger-300 dark:border-danger-800',
    text: 'text-danger-700 dark:text-danger-300',
  },
  skipped: {
    badge:
      'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800',
    text: 'text-amber-800 dark:text-amber-300',
  },
};

// Client-side mirror of the backend SLA windows (server/services/feedbackSla.ts)
// so "overdue" here matches what the escalation sweep pages on.
const SLA_WINDOW_HOURS: Record<string, number> = {
  CRITICAL: 4,
  HIGH: 24,
  MEDIUM: 72,
  LOW: 168,
};
const OPEN_TICKET_STATUSES = new Set(['NEW', 'PENDING', 'IN_PROGRESS']);
const SEVERITY_RANK: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

function isTicketOverdue(item: {
  severity?: string;
  status?: string;
  created_at: string;
}): boolean {
  if (!OPEN_TICKET_STATUSES.has(String(item.status || 'NEW').toUpperCase())) return false;
  const windowH = SLA_WINDOW_HOURS[String(item.severity || 'MEDIUM').toUpperCase()] ?? 72;
  const created = new Date(item.created_at).getTime();
  if (Number.isNaN(created)) return false;
  return Date.now() > created + windowH * 60 * 60 * 1000;
}

export const SuperAdminFeedbackView: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<FeedbackViewMode>('board');
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [envFilter, setEnvFilter] = useState<string>('ALL');
  const [ownershipFilter, setOwnershipFilter] = useState<'ALL' | 'ASSIGNED' | 'UNASSIGNED'>('ALL');
  const [sortMode, setSortMode] = useState<'recent' | 'severity'>('recent');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<FeedbackItem | null>(null);
  const [screenshotObjectUrl, setScreenshotObjectUrl] = useState<string | null>(null);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [deepLinkStatus, setDeepLinkStatus] = useState<string | null>(null);
  const [workflowDraft, setWorkflowDraft] = useState<WorkflowDraft>({
    owner: '',
    cluster: '',
    branch: '',
    prUrl: '',
    taskUrl: '',
    linkedTaskId: '',
    deployStatus: '',
    deployTargets: '',
    deployedAt: '',
    verifiedBy: '',
    verifiedAt: '',
    waitingOn: '',
    resolutionType: '',
    resolutionSummary: '',
    rootCause: '',
    verificationNotes: '',
    testPlan: '',
    note: '',
  });
  const [isSavingWorkflow, setIsSavingWorkflow] = useState(false);

  const normalizeItem = useCallback(
    (item: any): FeedbackItem => ({
      ...item,
      workflow: (item?.workflow || {}) as FeedbackWorkflow,
      resolution: (item?.resolution || {}) as FeedbackResolution,
      workflowTimeline: Array.isArray(item?.workflowTimeline) ? item.workflowTimeline : [],
      deploy_targets: Array.isArray(item?.deploy_targets) ? item.deploy_targets : [],
    }),
    []
  );

  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [pageLimit, setPageLimit] = useState<number>(1000);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Deep-link support: when another superadmin surface navigates here with
  // `?feedbackId=<id>` (canonical) or `?ticket=<id>` (legacy alias), auto-open that item's
  // detail drawer as soon as it's loaded, then strip the query param so
  // the URL stays clean on back/forward.
  const location = useLocation();
  const navigate = useNavigate();
  const requestedFeedbackId = useMemo(() => {
    try {
      const params = new URLSearchParams(location.search);
      return params.get('feedbackId') || params.get('ticket');
    } catch {
      return null;
    }
  }, [location.pathname, location.search, navigate]);
  const [deepLinkConsumed, setDeepLinkConsumed] = useState(false);

  const fetchFeedback = useCallback(
    async (limit?: number) => {
      setDeepLinkStatus(null);
      try {
        setLoadError(null);
        const page = await Api.getFeedbackPage({ limit: limit ?? pageLimit });
        setFeedback((page.items || []).map((item: any) => normalizeItem(item)));
        setTotalCount(page.total);
        if (limit) setPageLimit(limit);
      } catch (error: any) {
        console.error('Error fetching feedback:', error);
        setLoadError(error?.message || 'Failed to fetch feedback');
        toast.error(error?.message || 'Failed to fetch feedback');
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [normalizeItem, pageLimit]
  );

  const loadMoreFeedback = useCallback(async () => {
    setIsLoadingMore(true);
    await fetchFeedback(pageLimit + 1000);
  }, [fetchFeedback, pageLimit]);

  useEffect(() => {
    fetchFeedback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateStatus = async (id: string, newStatus: FeedbackStatus) => {
    try {
      await Api.updateFeedbackStatus(id, newStatus);
      setFeedback((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
      );
      if (selectedItem?.id === id)
        setSelectedItem((prev) => (prev ? { ...prev, status: newStatus } : null));
      toast.success('Feedback status updated');
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast.error(error?.message || 'Failed to update feedback status');
    }
  };

  const sendResponse = async (id: string) => {
    if (!responseText.trim()) return;
    setIsSending(true);
    try {
      const response = responseText.trim();
      await Api.post(`/feedback/${id}/respond`, { response });
      setFeedback((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                admin_response: response,
                responded_at: new Date().toISOString(),
                status: 'REVIEWED' as FeedbackStatus,
              }
            : item
        )
      );
      if (selectedItem?.id === id) {
        setSelectedItem((prev) =>
          prev
            ? {
                ...prev,
                admin_response: response,
                responded_at: new Date().toISOString(),
                status: 'REVIEWED' as FeedbackStatus,
              }
            : null
        );
      }
      setResponseText('');
      toast.success('Response sent');
    } catch (error: any) {
      console.error('Error sending response:', error);
      toast.error(error?.message || 'Failed to send response');
    } finally {
      setIsSending(false);
    }
  };

  const loadDetail = async (item: FeedbackItem) => {
    try {
      const detail = await Api.get(`/feedback/${item.id}`);
      setSelectedItem(normalizeItem(detail));
    } catch {
      setSelectedItem(item);
    }
  };

  const loadDetailById = useCallback(
    async (id: string) => {
      try {
        const detail = await Api.get(`/feedback/${id}`);
        setSelectedItem(normalizeItem(detail));
        setDeepLinkStatus(null);
      } catch (error) {
        console.error('[Feedback] Deep-link failed to load detail:', error);
        setDeepLinkStatus('Unable to open requested feedback ticket.');
      }
    },
    [normalizeItem]
  );

  useEffect(() => {
    if (!requestedFeedbackId || deepLinkConsumed || isLoading) return;
    // We intentionally don't require the item to already be in the
    // currently-loaded page — older items might live beyond the first
    // page. loadDetailById always hits the server for that specific id.
    loadDetailById(requestedFeedbackId);
    setDeepLinkConsumed(true);
    // Strip the query param so the user can close/reopen the drawer
    // without re-triggering the effect or leaving a stale URL.
    const params = new URLSearchParams(location.search);
    params.delete('feedbackId');
    params.delete('ticket');
    const nextSearch = params.toString();
    navigate(
      { pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : '' },
      { replace: true }
    );
  }, [
    requestedFeedbackId,
    deepLinkConsumed,
    isLoading,
    loadDetailById,
    location.pathname,
    location.search,
    navigate,
  ]);

  useEffect(() => {
    if (!selectedItem) return;
    const workflow = selectedItem.workflow || {};
    const resolution = selectedItem.resolution || {};
    setWorkflowDraft({
      owner: workflow.owner || '',
      cluster: workflow.cluster || '',
      branch: workflow.branch || '',
      prUrl: workflow.prUrl || '',
      taskUrl: workflow.taskUrl || '',
      linkedTaskId: workflow.linkedTaskId || selectedItem.linked_task_id || '',
      deployStatus: workflow.deployStatus || '',
      deployTargets: (workflow.deployTargets || []).join(', '),
      deployedAt: workflow.deployedAt || '',
      verifiedBy: workflow.verifiedBy || '',
      verifiedAt: workflow.verifiedAt || '',
      waitingOn: workflow.waitingOn || '',
      resolutionType: resolution.type || '',
      resolutionSummary: resolution.summary || '',
      rootCause: resolution.rootCause || '',
      verificationNotes: resolution.verificationNotes || '',
      testPlan: (resolution.testPlan || []).join('\n'),
      note: '',
    });
    setResponseText('');
  }, [selectedItem]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const hasFilter =
      params.has('status') || params.has('type') || params.has('severity') || params.has('env');
    const status = params.get('status')?.toUpperCase();
    const type = params.get('type')?.toUpperCase();
    const severity = params.get('severity')?.toUpperCase();
    const env = params.get('env');

    if (status && STATUS_ORDER.includes(status as FeedbackStatus)) {
      setStatusFilter(status as FeedbackStatus);
      setViewMode('list');
    }
    if (type) {
      setTypeFilter(type);
      setViewMode('list');
    }
    if (severity) {
      setSeverityFilter(severity);
      setViewMode('list');
    }
    if (env) {
      setEnvFilter(env);
      setViewMode('list');
    }
    if (hasFilter) {
      navigate({ pathname: location.pathname, search: '' }, { replace: true });
    }
  }, [location.search]);

  const saveWorkflow = async () => {
    if (!selectedItem) return;
    setIsSavingWorkflow(true);
    try {
      const result = await Api.updateFeedbackWorkflow(selectedItem.id, {
        owner: workflowDraft.owner || null,
        cluster: workflowDraft.cluster || null,
        source: 'cursor',
        branch: workflowDraft.branch || null,
        prUrl: workflowDraft.prUrl || null,
        taskUrl: workflowDraft.taskUrl || null,
        linkedTaskId: workflowDraft.linkedTaskId || null,
        deployStatus: workflowDraft.deployStatus || null,
        deployTargets: workflowDraft.deployTargets
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean),
        deployedAt: workflowDraft.deployedAt || null,
        verifiedBy: workflowDraft.verifiedBy || null,
        verifiedAt: workflowDraft.verifiedAt || null,
        waitingOn: workflowDraft.waitingOn || null,
        resolution: {
          type: workflowDraft.resolutionType || null,
          summary: workflowDraft.resolutionSummary || null,
          rootCause: workflowDraft.rootCause || null,
          verificationNotes: workflowDraft.verificationNotes || null,
          testPlan: workflowDraft.testPlan
            .split('\n')
            .map((entry) => entry.trim())
            .filter(Boolean),
        },
        note: workflowDraft.note || null,
      });

      const nextItem = normalizeItem({
        ...selectedItem,
        linked_task_id: workflowDraft.linkedTaskId || null,
        workflow: result?.workflow || {
          ...(selectedItem.workflow || {}),
          owner: workflowDraft.owner || null,
          cluster: workflowDraft.cluster || null,
        },
        resolution: result?.resolution || {
          ...(selectedItem.resolution || {}),
          summary: workflowDraft.resolutionSummary || null,
        },
        workflowTimeline: result?.workflowTimeline || selectedItem.workflowTimeline || [],
      });

      setFeedback((prev) => prev.map((item) => (item.id === nextItem.id ? nextItem : item)));
      setSelectedItem(nextItem);
      setWorkflowDraft((prev) => ({ ...prev, note: '' }));
      toast.success('Feedback workflow updated');
    } catch (error: any) {
      console.error('Error updating workflow:', error);
      toast.error(error?.message || 'Failed to update feedback workflow');
    } finally {
      setIsSavingWorkflow(false);
    }
  };

  const filteredFeedback = useMemo(
    () =>
      feedback
        .filter((item) => {
          if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
          if (typeFilter !== 'ALL' && item.type !== typeFilter) return false;
          if (severityFilter !== 'ALL' && (item.severity || 'NORMAL') !== severityFilter)
            return false;
          if (
            envFilter !== 'ALL' &&
            String(item.source_env || '').toLowerCase() !== envFilter.toLowerCase()
          )
            return false;
          if (ownershipFilter === 'ASSIGNED' && !item.workflow?.owner) return false;
          if (ownershipFilter === 'UNASSIGNED' && item.workflow?.owner) return false;
          if (overdueOnly && !isTicketOverdue(item)) return false;
          return true;
        })
        .filter(
          (item) =>
            !search ||
            (item.title || '').toLowerCase().includes(search.toLowerCase()) ||
            item.message.toLowerCase().includes(search.toLowerCase()) ||
            (item.user_email || '').toLowerCase().includes(search.toLowerCase()) ||
            (item.linked_task_id || '').toLowerCase().includes(search.toLowerCase()) ||
            (item.workflow?.owner || '').toLowerCase().includes(search.toLowerCase()) ||
            (item.workflow?.cluster || '').toLowerCase().includes(search.toLowerCase()) ||
            item.id.toLowerCase().includes(search.toLowerCase())
        )
        .sort((a, b) => {
          if (sortMode === 'severity') {
            const rankDiff =
              (SEVERITY_RANK[String(b.severity || '').toUpperCase()] || 0) -
              (SEVERITY_RANK[String(a.severity || '').toUpperCase()] || 0);
            if (rankDiff !== 0) return rankDiff;
          }
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }),
    [
      envFilter,
      feedback,
      ownershipFilter,
      overdueOnly,
      search,
      severityFilter,
      sortMode,
      statusFilter,
      typeFilter,
    ]
  );

  const formatDate = (date: string) =>
    format(new Date(date), 'PPP p', { locale: i18n.language === 'pl' ? pl : enUS });
  const formatAge = (date: string) =>
    formatDistanceToNowStrict(new Date(date), {
      addSuffix: true,
      locale: i18n.language === 'pl' ? pl : enUS,
    });
  const parseMetadata = (meta?: string): Record<string, unknown> => {
    if (!meta) return {};
    try {
      return JSON.parse(meta);
    } catch {
      return {};
    }
  };

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    setScreenshotObjectUrl(null);
    setScreenshotError(null);

    if (!selectedItem?.id) return;
    const meta = parseMetadata(selectedItem.metadata);
    const artifacts = Array.isArray((meta as any).artifacts)
      ? ((meta as any).artifacts as any[])
      : [];
    const dossier = meta.dossier && typeof meta.dossier === 'object' ? (meta.dossier as any) : {};
    const hasScreenshotArtifact =
      artifacts.some((a) => a && a.kind === 'screenshot') ||
      (typeof dossier.screenshot === 'object' && dossier.screenshot !== null);
    if (!hasScreenshotArtifact) return;

    Api.getFeedbackScreenshotBlob(selectedItem.id)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setScreenshotObjectUrl(objectUrl);
      })
      .catch((error) => {
        if (cancelled) return;
        setScreenshotError(error instanceof Error ? error.message : 'Failed to load screenshot');
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selectedItem?.id, selectedItem?.metadata]);

  const parseAlertDispatch = (meta: Record<string, unknown>): AlertDispatchSummary | null => {
    const raw = meta.alertDispatch;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    return raw as AlertDispatchSummary;
  };

  const pipelineStats = useMemo(() => {
    const criticalProd = feedback.filter(
      (item) =>
        String(item.source_env || '').toLowerCase() === 'production' &&
        (String(item.severity || '').toUpperCase() === 'CRITICAL' ||
          String(item.priority || '').toLowerCase() === 'critical')
    ).length;
    const unassigned = feedback.filter((item) => !item.workflow?.owner).length;
    const reviewPending = feedback.filter((item) => item.status === 'REVIEWED').length;
    const staleNew = feedback.filter((item) => {
      if (item.status !== 'NEW') return false;
      return Date.now() - new Date(item.created_at).getTime() > 24 * 60 * 60 * 1000;
    }).length;
    return { criticalProd, unassigned, reviewPending, staleNew };
  }, [feedback]);

  const envOptions = useMemo(
    () =>
      Array.from(
        new Set(feedback.map((item) => String(item.source_env || '').trim()).filter(Boolean))
      ),
    [feedback]
  );

  const renderItemCard = (item: FeedbackItem, compact = false) => {
    const sConf = STATUS_CONFIG[item.status] || STATUS_CONFIG.NEW;
    return (
      <button
        key={item.id}
        onClick={() => loadDetail(item)}
        className="w-full text-left bg-white dark:bg-navy-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide flex items-center gap-1.5 border ${
                  item.type === 'BUG'
                    ? 'bg-danger-50 text-danger-700 border-danger-200 dark:bg-danger-900/40 dark:text-danger-400 dark:border-danger-900'
                    : item.type === 'FEATURE'
                      ? 'bg-primary-50 text-primary-700 border-primary-200 dark:bg-primary-900/40 dark:text-primary-400 dark:border-primary-900'
                      : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-900'
                }`}
              >
                {item.type === 'BUG' ? <Bug size={12} /> : <Lightbulb size={12} />}
                {item.type}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-bold ${sConf.color} ${sConf.bg} border ${sConf.border}`}
              >
                {item.status}
              </span>
              {item.source_env && (
                <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200 dark:bg-navy-900/40 dark:text-slate-300 dark:border-slate-700">
                  {item.source_env}
                </span>
              )}
              {item.priority && (
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 dark:bg-navy-900/40 dark:text-slate-300 dark:border-slate-700">
                  {String(item.priority).toUpperCase()}
                </span>
              )}
              {item.severity && item.severity !== 'LOW' && (
                <span
                  className={`text-[11px] font-bold ${SEVERITY_CONFIG[item.severity]?.color || 'text-slate-600'} flex items-center gap-1`}
                >
                  {SEVERITY_CONFIG[item.severity]?.icon} {item.severity}
                </span>
              )}
              {typeof item.duplicate_count === 'number' && item.duplicate_count > 0 && (
                <span
                  className="px-2 py-0.5 rounded text-[11px] font-semibold bg-primary-50 text-primary-700 border border-primary-200 dark:bg-primary-900/40 dark:text-primary-300 dark:border-primary-900 inline-flex items-center gap-1"
                  title={t(
                    'feedback.duplicateBadge.title',
                    'Triage wykrył podobne zgłoszenia — otwórz szczegóły żeby je zobaczyć'
                  )}
                >
                  <Copy size={10} />×{item.duplicate_count}
                </span>
              )}
              {item.has_screenshot && (
                <span
                  className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-900 inline-flex items-center gap-1"
                  title={t('feedback.hasScreenshot', 'Zgłoszenie zawiera screenshot')}
                >
                  <ImageIcon size={10} />
                </span>
              )}
              {item.has_diagnostics && (
                <span
                  className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-900 inline-flex items-center gap-1"
                  title={t(
                    'feedback.hasDiagnostics',
                    'Zgłoszenie zawiera logi konsoli / sieci / breadcrumbs'
                  )}
                >
                  <Sparkles size={10} />
                </span>
              )}
            </div>
            {item.title ? (
              <p className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-1">
                {item.title}
              </p>
            ) : null}
            <p
              className={`text-slate-900 dark:text-slate-200 text-sm whitespace-pre-wrap leading-relaxed ${compact ? 'line-clamp-3' : 'line-clamp-2'}`}
            >
              {item.message}
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-500">
              <span className="flex items-center gap-1">
                <User size={12} /> {item.user_email || 'Anonymous'}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={12} /> {formatAge(item.created_at)}
              </span>
              {item.workflow?.owner && (
                <span>
                  Owner: <b>{item.workflow.owner}</b>
                </span>
              )}
              {item.workflow?.cluster && (
                <span>
                  Cluster: <b>{item.workflow.cluster}</b>
                </span>
              )}
              {item.linked_task_id && (
                <span className="flex items-center gap-1">
                  <CheckCircle2 size={12} /> Task {item.linked_task_id}
                </span>
              )}
              {item.workflow?.prUrl && (
                <span className="flex items-center gap-1 text-blue-600 dark:text-blue-300">
                  <ExternalLink size={12} /> PR
                </span>
              )}
              {item.workflow?.deployStatus && (
                <span className="flex items-center gap-1">
                  <PanelsTopLeft size={12} /> {item.workflow.deployStatus}
                </span>
              )}
            </div>
          </div>
          <ChevronRight size={16} className="text-slate-600 mt-2 shrink-0" />
        </div>
      </button>
    );
  };

  if (selectedItem) {
    const meta = parseMetadata(selectedItem.metadata);
    const alertDispatch = parseAlertDispatch(meta);
    const alertResults = alertDispatch?.results || {};
    const dossier = (
      meta.dossier && typeof meta.dossier === 'object'
        ? (meta.dossier as Record<string, unknown>)
        : {}
    ) as Record<string, unknown>;
    const appCtx = (
      dossier.appContext && typeof dossier.appContext === 'object'
        ? (dossier.appContext as Record<string, unknown>)
        : {}
    ) as Record<string, unknown>;
    const consoleLogs = Array.isArray(dossier.consoleLogs)
      ? (dossier.consoleLogs as Array<{ at?: string; level?: string; message?: string }>)
      : [];
    const networkErrorsList = Array.isArray(dossier.networkErrors)
      ? (dossier.networkErrors as Array<{
          at?: string;
          method?: string;
          url?: string;
          status?: number | null;
          durationMs?: number | null;
          error?: string;
        }>)
      : [];
    const breadcrumbs = Array.isArray(dossier.breadcrumbs)
      ? (dossier.breadcrumbs as Array<{
          at?: string;
          kind?: string;
          label?: string;
          target?: string;
        }>)
      : [];
    const lastUncaught = dossier.lastUncaughtError as
      | { message?: string; stack?: string; at?: string; source?: string }
      | undefined;
    const artifacts = Array.isArray(meta.artifacts) ? (meta.artifacts as any[]) : [];
    const hasScreenshot =
      artifacts.some((a) => a && a.kind === 'screenshot') ||
      (typeof dossier.screenshot === 'object' && dossier.screenshot !== null);
    const signatureHash =
      typeof meta.signatureHash === 'string' ? (meta.signatureHash as string) : null;
    const duplicateCandidates = Array.isArray(meta.duplicateCandidates)
      ? (meta.duplicateCandidates as Array<{ id: string; title: string | null }>)
      : [];
    const contextMetaEntries = Object.entries(meta).filter(
      ([k]) =>
        ![
          'userEmail',
          'userName',
          'type',
          'severity',
          'title',
          'feedbackType',
          'linkedTaskId',
          'workflow',
          'resolution',
          'workflowTimeline',
          'alertDispatch',
          'dossier',
          'artifacts',
          'signatureHash',
          'duplicateOf',
          'duplicateCandidates',
        ].includes(k)
    );
    const alertChannels = Array.from(
      new Set([
        ...((alertDispatch?.requestedChannels || []) as AlertChannel[]),
        ...(Object.keys(alertResults) as AlertChannel[]),
      ])
    ).sort(
      (a, b) =>
        ALERT_CHANNEL_ORDER.indexOf(a as AlertChannel) -
        ALERT_CHANNEL_ORDER.indexOf(b as AlertChannel)
    );
    const statusHist = selectedItem.statusHistory || [];
    const sConf = STATUS_CONFIG[selectedItem.status] || STATUS_CONFIG.NEW;
    const nextStatuses = STATUS_ORDER.filter((s) => s !== selectedItem.status);
    const mergedTimeline = [
      ...(selectedItem.workflowTimeline || []).map((entry) => ({
        id: `workflow-${entry.id}`,
        at: entry.at,
        label: entry.action.replace(/_/g, ' '),
        note: entry.note,
        actor: entry.actor,
        color: 'text-blue-700 dark:text-blue-300',
      })),
      ...statusHist.map((entry) => ({
        id: `status-${entry.id}`,
        at: entry.created_at,
        label: `${entry.from_status || '—'} -> ${entry.to_status}`,
        note: entry.note,
        actor: entry.changed_by,
        color:
          STATUS_CONFIG[entry.to_status as FeedbackStatus]?.color ||
          'text-slate-700 dark:text-slate-300',
      })),
    ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => setSelectedItem(null)}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors text-sm"
          >
            <ArrowLeft size={16} /> {t('feedback.backToList', 'Back to list')}
          </button>
          <InfoButton cardId="superadmin-feedback" position="header-inline" size="md" />
        </div>

        <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span
                  className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 border ${
                    selectedItem.type === 'BUG'
                      ? 'bg-danger-50 text-danger-700 border-danger-200 dark:bg-danger-900/40 dark:text-danger-400 dark:border-danger-900'
                      : selectedItem.type === 'FEATURE'
                        ? 'bg-primary-50 text-primary-700 border-primary-200 dark:bg-primary-900/40 dark:text-primary-400 dark:border-primary-900'
                        : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-900'
                  }`}
                >
                  {selectedItem.type === 'BUG' ? <Bug size={12} /> : <Lightbulb size={12} />}
                  {selectedItem.type}
                </span>
                {selectedItem.source_env && (
                  <span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200 dark:bg-navy-900/40 dark:text-slate-300 dark:border-slate-700">
                    {selectedItem.source_env}
                  </span>
                )}
                {selectedItem.severity && selectedItem.severity !== 'LOW' && (
                  <span
                    className={`text-xs font-bold ${SEVERITY_CONFIG[selectedItem.severity]?.color || 'text-slate-600'} flex items-center gap-1`}
                  >
                    {SEVERITY_CONFIG[selectedItem.severity]?.icon} {selectedItem.severity}
                  </span>
                )}
                <span
                  className={`px-2.5 py-1 rounded-md text-xs font-bold ${sConf.color} ${sConf.bg} border ${sConf.border}`}
                >
                  {selectedItem.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <Copy size={10} /> {selectedItem.id}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {nextStatuses.map((s) => (
                <button
                  key={s}
                  onClick={() => updateStatus(selectedItem.id, s)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${STATUS_CONFIG[s].color} ${STATUS_CONFIG[s].bg} ${STATUS_CONFIG[s].border} hover:opacity-80`}
                >
                  → {s}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-navy-900/50 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
            {selectedItem.title ? (
              <p className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
                {selectedItem.title}
              </p>
            ) : null}
            <p className="text-slate-800 dark:text-slate-200 text-sm whitespace-pre-wrap leading-relaxed">
              {selectedItem.message}
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <User size={12} /> {selectedItem.user_email || selectedItem.user_name || 'Anonymous'}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={12} /> {formatDate(selectedItem.created_at)}
            </span>
            <span className="flex items-center gap-1">
              <Tag size={12} /> {formatAge(selectedItem.created_at)}
            </span>
            {selectedItem.rating && (
              <span className="flex items-center gap-1">
                <Star size={12} /> {selectedItem.rating}/5
              </span>
            )}
            {selectedItem.linked_task_id && (
              <span className="flex items-center gap-1">
                <CheckCircle2 size={12} /> Task {selectedItem.linked_task_id}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-300">
                {t('feedback.pipeline.operations', 'Operations')}
              </h3>
              {!selectedItem.workflow?.owner && (
                <button
                  onClick={() =>
                    setWorkflowDraft((prev) => ({
                      ...prev,
                      owner: prev.owner || 'superadmin',
                      note: prev.note || 'Ownership taken from Superadmin pipeline',
                    }))
                  }
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 dark:border-blue-900 dark:text-blue-300 dark:bg-blue-900/20"
                >
                  {t('feedback.takeOwnership', 'Take ownership')}
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="space-y-1 text-xs">
                <span className="text-slate-500">{t('feedback.owner', 'Owner')}</span>
                <input
                  value={workflowDraft.owner}
                  onChange={(e) => setWorkflowDraft((prev) => ({ ...prev, owner: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  placeholder="owner"
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-slate-500">{t('feedback.cluster', 'Cluster')}</span>
                <input
                  value={workflowDraft.cluster}
                  onChange={(e) =>
                    setWorkflowDraft((prev) => ({ ...prev, cluster: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  placeholder="Inbox / Superadmin Users"
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-slate-500">{t('feedback.waitingOn', 'Waiting on')}</span>
                <input
                  value={workflowDraft.waitingOn}
                  onChange={(e) =>
                    setWorkflowDraft((prev) => ({ ...prev, waitingOn: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  placeholder="user verification / deploy / design"
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-slate-500">{t('feedback.linkedTask', 'Linked task')}</span>
                <input
                  value={workflowDraft.linkedTaskId}
                  onChange={(e) =>
                    setWorkflowDraft((prev) => ({ ...prev, linkedTaskId: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  placeholder="task id"
                />
              </label>
            </div>
          </div>

          <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-300">
              {t('feedback.pipeline.delivery', 'Delivery')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="space-y-1 text-xs">
                <span className="text-slate-500">Branch</span>
                <input
                  value={workflowDraft.branch}
                  onChange={(e) =>
                    setWorkflowDraft((prev) => ({ ...prev, branch: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-slate-500">PR URL</span>
                <input
                  value={workflowDraft.prUrl}
                  onChange={(e) => setWorkflowDraft((prev) => ({ ...prev, prUrl: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-slate-500">Task URL</span>
                <input
                  value={workflowDraft.taskUrl}
                  onChange={(e) =>
                    setWorkflowDraft((prev) => ({ ...prev, taskUrl: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-slate-500">Deploy status</span>
                <input
                  value={workflowDraft.deployStatus}
                  onChange={(e) =>
                    setWorkflowDraft((prev) => ({ ...prev, deployStatus: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  placeholder="todo / staging / production / verified"
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-slate-500">Deploy targets</span>
                <input
                  value={workflowDraft.deployTargets}
                  onChange={(e) =>
                    setWorkflowDraft((prev) => ({ ...prev, deployTargets: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  placeholder="staging, production"
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-slate-500">Deployed at</span>
                <input
                  value={workflowDraft.deployedAt}
                  onChange={(e) =>
                    setWorkflowDraft((prev) => ({ ...prev, deployedAt: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  placeholder="2026-04-16T09:00:00Z"
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-slate-500">Verified by</span>
                <input
                  value={workflowDraft.verifiedBy}
                  onChange={(e) =>
                    setWorkflowDraft((prev) => ({ ...prev, verifiedBy: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-slate-500">Verified at</span>
                <input
                  value={workflowDraft.verifiedAt}
                  onChange={(e) =>
                    setWorkflowDraft((prev) => ({ ...prev, verifiedAt: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  placeholder="2026-04-16T09:10:00Z"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-300">
            {t('feedback.pipeline.resolution', 'Resolution')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="space-y-1 text-xs">
              <span className="text-slate-500">Resolution type</span>
              <input
                value={workflowDraft.resolutionType}
                onChange={(e) =>
                  setWorkflowDraft((prev) => ({ ...prev, resolutionType: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                placeholder="fixed / duplicate / not-a-bug"
              />
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-slate-500">Resolution summary</span>
              <input
                value={workflowDraft.resolutionSummary}
                onChange={(e) =>
                  setWorkflowDraft((prev) => ({ ...prev, resolutionSummary: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
              />
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-slate-500">Root cause</span>
              <textarea
                value={workflowDraft.rootCause}
                onChange={(e) =>
                  setWorkflowDraft((prev) => ({ ...prev, rootCause: e.target.value }))
                }
                rows={3}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 resize-none"
              />
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-slate-500">Verification notes</span>
              <textarea
                value={workflowDraft.verificationNotes}
                onChange={(e) =>
                  setWorkflowDraft((prev) => ({ ...prev, verificationNotes: e.target.value }))
                }
                rows={3}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 resize-none"
              />
            </label>
            <label className="space-y-1 text-xs md:col-span-2">
              <span className="text-slate-500">Test plan (one line per step)</span>
              <textarea
                value={workflowDraft.testPlan}
                onChange={(e) =>
                  setWorkflowDraft((prev) => ({ ...prev, testPlan: e.target.value }))
                }
                rows={3}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 resize-none"
              />
            </label>
            <label className="space-y-1 text-xs md:col-span-2">
              <span className="text-slate-500">Update note</span>
              <textarea
                value={workflowDraft.note}
                onChange={(e) => setWorkflowDraft((prev) => ({ ...prev, note: e.target.value }))}
                rows={2}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 resize-none"
                placeholder="What changed in the workflow?"
              />
            </label>
          </div>
          <div className="flex justify-end">
            <button
              onClick={saveWorkflow}
              disabled={isSavingWorkflow}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {isSavingWorkflow ? 'Saving…' : 'Save pipeline data'}
            </button>
          </div>
        </div>

        {(selectedItem.route_path || selectedItem.device_type || contextMetaEntries.length > 0) && (
          <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-300">
              {t('feedback.contextTitle', 'Context & Metadata')}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              {selectedItem.route_path && (
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                  <Globe size={12} />{' '}
                  <span className="text-slate-800 dark:text-slate-300">
                    {selectedItem.route_path}
                  </span>
                </div>
              )}
              {selectedItem.device_type && (
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                  <Monitor size={12} />{' '}
                  <span className="text-slate-800 dark:text-slate-300">
                    {selectedItem.device_type}{' '}
                    {selectedItem.screen_size ? `(${selectedItem.screen_size})` : ''}
                  </span>
                </div>
              )}
              {selectedItem.ui_language && (
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                  <Globe size={12} />{' '}
                  <span className="text-slate-800 dark:text-slate-300">
                    {selectedItem.ui_language}
                  </span>
                </div>
              )}
              {selectedItem.ui_theme && (
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                  <Palette size={12} />{' '}
                  <span className="text-slate-800 dark:text-slate-300">
                    {selectedItem.ui_theme}
                  </span>
                </div>
              )}
              {contextMetaEntries.map(([k, v]) => (
                <div key={k} className="text-slate-600 dark:text-slate-400">
                  <span className="text-slate-500">{k}:</span>{' '}
                  <span className="text-slate-800 dark:text-slate-300">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-300">
            {t('feedback.alertDelivery', 'Alerts & Escalation')}
          </h3>
          {alertDispatch && alertChannels.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-4 text-xs text-slate-600 dark:text-slate-400">
                <span>
                  <span className="text-slate-500">
                    {t('feedback.alertRequestedChannels', 'Planned channels')}:
                  </span>{' '}
                  {(alertDispatch.requestedChannels || [])
                    .map((channel) =>
                      t(`feedback.alertChannel.${channel}`, channel.replace('_', ' ').toUpperCase())
                    )
                    .join(', ')}
                </span>
                {alertDispatch.attemptedAt && (
                  <span>
                    <span className="text-slate-500">
                      {t('feedback.alertAttemptedAt', 'Last attempt')}:
                    </span>{' '}
                    {formatDate(alertDispatch.attemptedAt)}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {alertChannels.map((channel) => {
                  const result = alertResults[channel];
                  const status = result?.status || 'skipped';
                  const statusConfig = ALERT_STATUS_CONFIG[status];
                  return (
                    <div
                      key={channel}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-900/40 p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-slate-900 dark:text-white">
                          {t(
                            `feedback.alertChannel.${channel}`,
                            channel.replace('_', ' ').toUpperCase()
                          )}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md border text-xs font-semibold ${statusConfig.badge}`}
                        >
                          {t(`feedback.alertStatus.${status}`, status)}
                        </span>
                      </div>
                      {result?.detail && (
                        <p className={`text-xs ${statusConfig.text}`}>{result.detail}</p>
                      )}
                      {(typeof result?.recipientCount === 'number' || result?.attemptedAt) && (
                        <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
                          {typeof result?.recipientCount === 'number' && (
                            <span>
                              {t('feedback.alertRecipientCount', 'Recipients')}:{' '}
                              {result.recipientCount}
                            </span>
                          )}
                          {result?.attemptedAt && <span>{formatDate(result.attemptedAt)}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-500 italic">
              {t(
                'feedback.alertDeliveryEmpty',
                'No escalation data has been recorded for this item yet.'
              )}
            </p>
          )}
        </div>

        {(hasScreenshot ||
          consoleLogs.length > 0 ||
          networkErrorsList.length > 0 ||
          breadcrumbs.length > 0 ||
          lastUncaught ||
          signatureHash ||
          duplicateCandidates.length > 0) && (
          <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-300 flex items-center gap-2">
                <Sparkles size={14} /> {t('feedback.cursorDossier', 'Cursor dossier')}
              </h3>
              <div className="flex items-center gap-2">
                {signatureHash && (
                  <span
                    className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-navy-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                    title="signatureHash"
                  >
                    sig {signatureHash}
                  </span>
                )}
                <button
                  onClick={async () => {
                    try {
                      const brief = await Api.getFeedbackCursorBrief(selectedItem.id);
                      await navigator.clipboard.writeText(brief);
                    } catch (err) {
                      console.error('Failed to copy Cursor brief', err);
                    }
                  }}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20"
                >
                  <Copy size={12} /> {t('feedback.copyCursorBrief', 'Copy Cursor brief')}
                </button>
              </div>
            </div>

            {duplicateCandidates.length > 0 && (
              <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <Copy size={12} />
                  {t('feedback.duplicates', 'Possible duplicates')}{' '}
                  <span className="text-[10px] font-normal text-slate-500 dark:text-slate-500">
                    ({duplicateCandidates.length})
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {duplicateCandidates.slice(0, 5).map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => loadDetail({ id: d.id } as FeedbackItem)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors"
                      title={`${d.id} — ${d.title || ''}`}
                    >
                      <ChevronRight size={10} />
                      <span className="font-mono text-[10px]">{d.id.slice(0, 8)}</span>
                      {d.title ? <span className="max-w-[160px] truncate">{d.title}</span> : null}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {hasScreenshot && (
              <div className="space-y-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1">
                    <ImageIcon size={12} /> {t('feedback.screenshot', 'Screenshot')}
                  </span>
                  {screenshotObjectUrl && (
                    <a
                      href={screenshotObjectUrl}
                      download={`feedback-${selectedItem.id.slice(0, 8)}-screenshot.png`}
                      className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-300 hover:underline"
                    >
                      <ExternalLink size={11} />
                      {t('feedback.downloadScreenshot', 'Download')}
                    </a>
                  )}
                </div>
                {screenshotObjectUrl ? (
                  <a href={screenshotObjectUrl} target="_blank" rel="noreferrer">
                    <img
                      src={screenshotObjectUrl}
                      alt="feedback screenshot"
                      className="rounded-lg border border-slate-200 dark:border-slate-700 max-h-[420px] w-auto"
                    />
                  </a>
                ) : screenshotError ? (
                  <div className="rounded-lg border border-danger-200 dark:border-danger-900/40 bg-danger-50 dark:bg-danger-900/10 p-3 text-xs text-danger-700 dark:text-danger-300">
                    {screenshotError}
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-xs text-slate-500">
                    {t('feedback.loadingScreenshot', 'Loading screenshot...')}
                  </div>
                )}
              </div>
            )}

            {lastUncaught?.message && (
              <div className="rounded-lg bg-danger-50 dark:bg-danger-900/10 border border-danger-200 dark:border-danger-900/40 p-3 text-xs">
                <div className="font-semibold text-danger-700 dark:text-danger-300">
                  {t('feedback.lastError', 'Last uncaught error')}
                </div>
                <div className="text-danger-800 dark:text-danger-200 mt-1 font-mono break-all">
                  {lastUncaught.message}
                </div>
                {lastUncaught.stack && (
                  <pre className="mt-2 max-h-40 overflow-auto text-[10px] text-danger-700/80 dark:text-danger-300/80 whitespace-pre-wrap">
                    {lastUncaught.stack}
                  </pre>
                )}
              </div>
            )}

            {breadcrumbs.length > 0 && (
              <details className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-xs">
                <summary className="cursor-pointer font-semibold text-slate-700 dark:text-slate-200">
                  {t('feedback.breadcrumbs', 'Breadcrumbs')} ({breadcrumbs.length})
                </summary>
                <ul className="mt-2 space-y-1 text-slate-600 dark:text-slate-400">
                  {breadcrumbs.slice(-20).map((b, idx) => (
                    <li key={idx} className="flex gap-2">
                      <span className="text-slate-600 text-[10px] shrink-0">
                        {b.at ? format(new Date(b.at), 'HH:mm:ss') : ''}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-slate-600 shrink-0">
                        {b.kind}
                      </span>
                      <span className="break-all">{b.label}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {networkErrorsList.length > 0 && (
              <details className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-xs">
                <summary className="cursor-pointer font-semibold text-slate-700 dark:text-slate-200">
                  {t('feedback.networkErrors', 'Network errors')} ({networkErrorsList.length})
                </summary>
                <ul className="mt-2 space-y-1 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                  {networkErrorsList.slice(-15).map((n, idx) => (
                    <li key={idx} className="break-all">
                      <span className="text-slate-600">
                        {n.at ? format(new Date(n.at), 'HH:mm:ss') : ''}
                      </span>{' '}
                      <span className="text-danger-600 dark:text-danger-400">
                        {n.status ?? 'ERR'}
                      </span>{' '}
                      {n.method} {n.url} ({n.durationMs ?? '?'}ms)
                      {n.error ? ` — ${n.error}` : ''}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {consoleLogs.length > 0 && (
              <details className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-xs">
                <summary className="cursor-pointer font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                  <Terminal size={12} /> {t('feedback.consoleLogs', 'Console logs')} (
                  {consoleLogs.length})
                </summary>
                <pre className="mt-2 max-h-60 overflow-auto text-[11px] bg-slate-50 dark:bg-navy-900 p-2 rounded font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                  {consoleLogs
                    .slice(-30)
                    .map((c) => `[${c.level || 'log'}] ${c.at || ''} ${c.message || ''}`)
                    .join('\n')}
                </pre>
              </details>
            )}

            {Object.keys(appCtx).length > 0 && (
              <details className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-xs">
                <summary className="cursor-pointer font-semibold text-slate-700 dark:text-slate-200">
                  {t('feedback.appContext', 'App context')}
                </summary>
                <pre className="mt-2 max-h-60 overflow-auto text-[10px] text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                  {JSON.stringify(appCtx, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}

        {mergedTimeline.length > 0 && (
          <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-300">
              {t('feedback.pipeline.timeline', 'Pipeline timeline')}
            </h3>
            <div className="space-y-2">
              {mergedTimeline.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400"
                >
                  <span className="text-slate-500">{formatDate(entry.at)}</span>
                  <ChevronRight size={12} />
                  <span className={entry.color}>{entry.label}</span>
                  {entry.actor && <span className="text-slate-500">by {entry.actor}</span>}
                  {entry.note && <span className="text-slate-500 italic">({entry.note})</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-300 flex items-center gap-2">
            <MessageSquare size={14} /> {t('feedback.adminResponse', 'Admin Response')}
          </h3>
          {selectedItem.admin_response ? (
            <div className="bg-green-900/10 border border-green-900/30 rounded-lg p-3">
              <p className="text-sm text-green-300 whitespace-pre-wrap">
                {selectedItem.admin_response}
              </p>
              {selectedItem.responded_at && (
                <p className="text-xs text-green-500/60 mt-2">
                  {formatDate(selectedItem.responded_at)}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">
              {t('feedback.noResponse', 'No response yet')}
            </p>
          )}
          <div className="flex gap-2">
            <textarea
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              placeholder={t('feedback.responsePlaceholder', 'Type your response...')}
              className="flex-1 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 px-3 py-2 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none"
              rows={2}
            />
            <button
              onClick={() => sendResponse(selectedItem.id)}
              disabled={!responseText.trim() || isSending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors self-end"
            >
              <Send size={14} /> {t('feedback.send', 'Send')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {deepLinkStatus ? (
        <div
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300"
        >
          {deepLinkStatus}
        </div>
      ) : null}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
              <MessageSquareWarning className="text-amber-500" size={32} />
              {t('feedback.title', 'User Feedback & Triage')}
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              {t('feedback.subtitle', 'Manage incoming reports, ideas, and feature requests.')}
            </p>
          </div>
          <div className="pt-0.5">
            <InfoButton cardId="superadmin-feedback" position="header-inline" size="md" />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 w-full md:w-auto">
          <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <button
              onClick={() => setViewMode('board')}
              className={`px-3 py-2 text-sm ${
                viewMode === 'board'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-navy-900'
                  : 'bg-white dark:bg-navy-900 text-slate-700 dark:text-slate-300'
              }`}
            >
              Board
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-2 text-sm border-l border-slate-200 dark:border-slate-700 ${
                viewMode === 'list'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-navy-900'
                  : 'bg-white dark:bg-navy-900 text-slate-700 dark:text-slate-300'
              }`}
            >
              List
            </button>
          </div>
          <div className="relative w-full sm:w-auto min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="text"
              placeholder={t('feedback.search', 'Search...')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 pl-9 pr-4 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-64"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-auto"
          >
            <option value="ALL">{t('feedback.allStatuses', 'All Statuses')}</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-auto"
          >
            <option value="ALL">{t('feedback.allTypes', 'All Types')}</option>
            <option value="BUG">Bug</option>
            <option value="IDEA">Idea</option>
            <option value="FEATURE">Feature</option>
            <option value="PULSE">Pulse</option>
          </select>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-auto"
          >
            <option value="ALL">{t('feedback.allSeverities', 'All Severities')}</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <select
            value={envFilter}
            onChange={(e) => setEnvFilter(e.target.value)}
            className="bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-auto"
          >
            <option value="ALL">All envs</option>
            {envOptions.map((env) => (
              <option key={env} value={env}>
                {env}
              </option>
            ))}
          </select>
          <select
            value={ownershipFilter}
            onChange={(e) =>
              setOwnershipFilter(e.target.value as 'ALL' | 'ASSIGNED' | 'UNASSIGNED')
            }
            className="bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-auto"
          >
            <option value="ALL">All ownership</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="UNASSIGNED">Unassigned</option>
          </select>
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as 'recent' | 'severity')}
            className="bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-auto"
            title={t('feedback.sortBy', 'Sortowanie')}
          >
            <option value="recent">{t('feedback.sortRecent', 'Najnowsze')}</option>
            <option value="severity">{t('feedback.sortSeverity', 'Waga (severity)')}</option>
          </select>
          <button
            type="button"
            onClick={() => setOverdueOnly((v) => !v)}
            aria-pressed={overdueOnly}
            className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors w-full sm:w-auto ${
              overdueOnly
                ? 'bg-danger-600 border-danger-600 text-white'
                : 'bg-slate-50 dark:bg-navy-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-danger-400'
            }`}
            title={t('feedback.overdueHint', 'Pokaż tylko zgłoszenia po terminie odpowiedzi (SLA)')}
          >
            {t('feedback.overdueOnly', 'Zaległe (SLA)')}
          </button>
        </div>
      </div>

      {loadError && (
        <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700 dark:border-danger-900/60 dark:bg-danger-900/30 dark:text-danger-300">
          {loadError}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'Critical prod',
            value: pipelineStats.criticalProd,
            tone: 'text-danger-600 dark:text-danger-400',
          },
          {
            label: 'Unassigned',
            value: pipelineStats.unassigned,
            tone: 'text-amber-600 dark:text-amber-400',
          },
          {
            label: 'Awaiting verification',
            value: pipelineStats.reviewPending,
            tone: 'text-primary-600 dark:text-primary-400',
          },
          {
            label: 'NEW > 24h',
            value: pipelineStats.staleNew,
            tone: 'text-amber-600 dark:text-amber-400',
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-navy-800 p-4"
          >
            <div className={`text-2xl font-bold ${card.tone}`}>{card.value}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {STATUS_ORDER.map((s) => {
          const count = feedback.filter((f) => f.status === s).length;
          const conf = STATUS_CONFIG[s];
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? 'ALL' : s)}
              className={`rounded-lg p-3 text-center border transition-colors ${
                statusFilter === s
                  ? `${conf.bg} ${conf.border}`
                  : 'bg-white dark:bg-navy-800/50 border-slate-200 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div className={`text-lg font-bold ${conf.color}`}>{count}</div>
              <div className="text-xs text-slate-600 dark:text-slate-500">{s}</div>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <LoadingState variant="spinner" className="py-12" />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2 text-xs text-slate-600 dark:text-slate-400">
            <div>
              {t('feedback.counter', 'Showing')}{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {filteredFeedback.length}
              </span>{' '}
              {t('feedback.counter.of', 'of')}{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {feedback.length}
              </span>{' '}
              {t('feedback.counter.loaded', 'loaded')}
              {totalCount != null && totalCount > feedback.length && (
                <>
                  {' · '}
                  <span className="text-amber-600 dark:text-amber-400">
                    {totalCount - feedback.length}{' '}
                    {t('feedback.counter.more', 'older ticket(s) not yet loaded')}
                  </span>
                </>
              )}
              {totalCount != null && totalCount === feedback.length && feedback.length > 0 && (
                <>
                  {' · '}
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {t('feedback.counter.all', 'all in')}
                  </span>
                </>
              )}
            </div>
            {totalCount != null && totalCount > feedback.length && (
              <button
                type="button"
                onClick={loadMoreFeedback}
                disabled={isLoadingMore}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoadingMore
                  ? t('feedback.loadingMore', 'Loading…')
                  : t(
                      'feedback.loadMore',
                      `Load ${Math.min(1000, totalCount - feedback.length)} more`
                    )}
              </button>
            )}
          </div>
          {filteredFeedback.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-navy-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
              <p className="text-slate-500">
                {t('feedback.noResults', 'No feedback found matching your criteria.')}
              </p>
            </div>
          ) : viewMode === 'board' ? (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              {STATUS_ORDER.map((status) => {
                const items = filteredFeedback.filter((item) => item.status === status);
                const conf = STATUS_CONFIG[status];
                return (
                  <div
                    key={status}
                    className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-navy-800/60 p-4 space-y-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className={`text-sm font-semibold ${conf.color}`}>{status}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {items.length} item(s)
                        </div>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-lg text-xs font-bold ${conf.bg} ${conf.color} border ${conf.border}`}
                      >
                        {items.length}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {items.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 px-3 py-5 text-xs text-slate-500 text-center">
                          Empty lane
                        </div>
                      ) : (
                        items.map((item) => renderItemCard(item, true))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredFeedback.map((item) => renderItemCard(item))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
