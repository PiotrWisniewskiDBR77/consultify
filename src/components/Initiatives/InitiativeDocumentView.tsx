/**
 * InitiativeDocumentView
 *
 * Canonical full initiative "document" view following Task/Decision Golden Standard.
 * Two-column layout: LEFT = merit/content, RIGHT = control/metrics.
 * Initiative is the HUB that spawns: Tasks, Decisions, RAID items, Notifications.
 *
 * LEFT COLUMN ORDER:
 * 1. Description (Opis)
 * 2. Comments (Komentarze)
 * 3. Tasks & Milestones (Zadania z kamieniami milowymi)
 * 4. Decisions (Decyzje)
 * 5. RAID Log (Risks, Assumptions, Issues, Dependencies)
 * 6. Gate Readiness (Bramki)
 * 7. Financial Analysis (Analiza finansowa)
 * 8. Financial Impact (Wpływ finansowy)
 * 9. Activity Log (Historia zmian)
 *
 * RIGHT COLUMN ORDER:
 * 1. Gate Alert Banner (warunkowo)
 * 2. Control (Phase, Status, Priority, Target Date, Quick Stats, Actions)
 * 3. Team (Owner, Sponsor with role descriptions)
 * 4. Timeline (Harmonogram)
 * 5. Attachments (Załączniki)
 * 6. Linked Items (Powiązane elementy)
 * 7. Stakeholders RACI (Interesariusze)
 * 8. Reminders & Escalation (Przypomnienia)
 * 9. Tags (Tagi)
 * 10. Dependencies (Zależności)
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  BarChart3,
  Bell,
  BellOff,
  Calendar,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  Clock,
  Copy,
  DollarSign,
  Download,
  ExternalLink,
  FileText,
  Flag,
  History,
  Layers,
  Link2,
  Loader2,
  MessageSquare,
  Milestone,
  MoreVertical,
  Plus,
  Save,
  Scale,
  Send,
  Share2,
  Sparkles,
  Tag,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  User,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { getStatusActions, getStatusMeta, StatusAction } from '@/services/initiativeLifecycle';
import { useAppStore } from '@/store/useAppStore';
import { useConversationStore } from '@/store/useConversationStore';
import { AppView } from '@/types';

import { InitiativeStatus } from '../../types';
import {
  type Attachment,
  AttachmentsSection,
  type Comment,
  CommentsSection,
  DependenciesSection,
  type EscalationRule,
  EscalationRulesSection,
  type LinkedItem,
  LinkedItemsSection,
  type ReminderRule,
  type Stakeholder,
  type StakeholderNotificationSettings,
  type StakeholderRole,
  StakeholdersSection,
  type TaskDependency,
  type WarningThresholds,
} from '../MyWork/shared';

interface InitiativeDocumentViewProps {
  initiativeId: string;
  onBack?: () => void;
  onStatusChange?: (newStatus: string) => void;
  sourceModule?: 'tools' | 'assessment' | 'initiatives' | 'execution' | 'benefits';
  onOpenTask?: (taskId: string) => void;
  onOpenDecision?: (decisionId: string) => void;
}

interface Decision {
  id: string;
  type: string;
  title: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  dueDate?: string;
  ownerName?: string;
}

interface RaidItem {
  id: string;
  type: 'risk' | 'issue' | 'assumption' | 'dependency';
  title: string;
  description?: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status?: string;
  owner?: string;
  mitigationPlan?: string;
}

interface Watcher {
  id: string;
  userId: string;
  name?: string;
  email?: string;
}

interface HistoryEvent {
  id: string;
  eventType: string;
  createdAt: string;
  actorId?: string;
  actorName?: string;
  payload?: any;
}

interface TaskItem {
  id: string;
  title: string;
  status: string;
  priority?: string;
  dueDate?: string;
  assigneeName?: string;
  isMilestone?: boolean;
  milestoneDate?: string;
}

// Collapsible Section Component
const CollapsibleSection: React.FC<{
  id: string;
  title: string;
  icon: React.ReactNode;
  iconBg: string;
  expanded: boolean;
  onToggle: () => void;
  badge?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ id, title, icon, iconBg, expanded, onToggle, badge, children, actions }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden"
  >
    <div
      className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors cursor-pointer"
      onClick={onToggle}
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-xl ${iconBg}`}>{icon}</div>
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{title}</span>
      </div>
      <div className="flex items-center gap-2">
        {badge}
        {expanded && actions}
        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={18} className="text-slate-400" />
        </motion.div>
      </div>
    </div>
    <AnimatePresence>
      {expanded && (
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: 'auto' }}
          exit={{ height: 0 }}
          className="border-t border-slate-200 dark:border-navy-700 overflow-hidden"
        >
          <div className="p-4">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  </motion.div>
);

const GATE_DEFINITIONS = [
  {
    id: 'GO_NO_GO',
    label: 'Go/No-Go',
    forStatus: 'REVIEW',
    pmoDomain: 'GOVERNANCE_DECISION_MAKING',
  },
  {
    id: 'RESOURCES_COMMIT',
    label: 'Resources Commit',
    forStatus: 'PROMOTED',
    pmoDomain: 'RESOURCE_RESPONSIBILITY',
  },
  {
    id: 'SCHEDULE_LOCK',
    label: 'Schedule Lock',
    forStatus: 'APPROVED',
    pmoDomain: 'SCHEDULE_MILESTONES',
  },
] as const;

// Gate configuration for approval workflow
const GATE_CONFIG = {
  PROMOTE: {
    name: 'Promote to Initiatives',
    namePl: 'Promocja do Inicjatyw',
    fromStatus: 'REVIEW',
    toStatus: 'PROMOTED',
    requiredRole: 'sponsor' as const,
    description: 'Sponsor approves initiative promotion from discovery phase',
    descriptionPl: 'Sponsor zatwierdza promocję inicjatywy z fazy odkrywania',
    requirements: ['title', 'problem', 'owner', 'sponsor'],
  },
  APPROVE: {
    name: 'Approve for Execution',
    namePl: 'Zatwierdzenie do realizacji',
    fromStatus: 'PLANNING',
    toStatus: 'APPROVED',
    requiredRole: 'committee' as const,
    description: 'Steering Committee approves initiative for execution',
    descriptionPl: 'Komitet Sterujący zatwierdza inicjatywę do realizacji',
    requirements: ['objective', 'scope', 'timeline', 'team', 'risks'],
  },
  SCHEDULE: {
    name: 'Schedule for Execution',
    namePl: 'Zaplanowanie realizacji',
    fromStatus: 'APPROVED',
    toStatus: 'SCHEDULED',
    requiredRole: 'pmo' as const,
    description: 'PMO confirms capacity and schedules initiative',
    descriptionPl: 'PMO potwierdza dostępność zasobów i planuje inicjatywę',
    requirements: ['timeline', 'capacity', 'dependencies'],
  },
  COMPLETE: {
    name: 'Complete Execution',
    namePl: 'Zakończenie realizacji',
    fromStatus: 'EXECUTING',
    toStatus: 'DONE',
    requiredRole: 'pmo' as const,
    description: 'PMO confirms all tasks completed and delivery accepted',
    descriptionPl: 'PMO potwierdza zakończenie wszystkich zadań i odbiór',
    requirements: ['all_tasks_done', 'delivery_confirmed'],
  },
  START_TRACKING: {
    name: 'Start Benefits Tracking',
    namePl: 'Rozpoczęcie śledzenia korzyści',
    fromStatus: 'DONE',
    toStatus: 'TRACKING',
    requiredRole: 'owner' as const,
    description: 'Business Owner starts benefits tracking period',
    descriptionPl: 'Właściciel biznesowy rozpoczyna okres śledzenia korzyści',
    requirements: ['baseline_kpis', 'tracking_period'],
  },
  BLOCK: {
    name: 'Block Initiative',
    namePl: 'Zablokowanie inicjatywy',
    fromStatus: 'EXECUTING',
    toStatus: 'BLOCKED',
    requiredRole: 'sponsor' as const,
    description: 'Sponsor approves blocking due to impediment',
    descriptionPl: 'Sponsor zatwierdza zablokowanie z powodu przeszkody',
    requirements: ['blocked_reason', 'impact_assessment'],
  },
  UNBLOCK: {
    name: 'Unblock Initiative',
    namePl: 'Odblokowanie inicjatywy',
    fromStatus: 'BLOCKED',
    toStatus: 'EXECUTING',
    requiredRole: 'sponsor' as const,
    description: 'Sponsor approves unblocking after resolution',
    descriptionPl: 'Sponsor zatwierdza odblokowanie po rozwiązaniu problemu',
    requirements: ['resolution_decision', 'updated_timeline'],
  },
};

// Module configuration - where the initiative currently lives in the system
const MODULE_CONFIG = {
  TOOLS: {
    label: 'Tools',
    labelPl: 'Narzędzia',
    color: 'bg-slate-500',
    textColor: 'text-slate-600 dark:text-slate-400',
    bgLight: 'bg-slate-500/10',
    icon: 'Wrench',
    route: '/tools',
    description: 'Discovery & ideation phase',
    descriptionPl: 'Faza odkrywania i pomysłów',
  },
  ASSESSMENT: {
    label: 'Assessment',
    labelPl: 'Ocena',
    color: 'bg-blue-500',
    textColor: 'text-blue-600 dark:text-blue-400',
    bgLight: 'bg-blue-500/10',
    icon: 'ClipboardCheck',
    route: '/assessment',
    description: 'Evaluation & scoring phase',
    descriptionPl: 'Faza oceny i punktacji',
  },
  INITIATIVES: {
    label: 'Initiatives',
    labelPl: 'Inicjatywy',
    color: 'bg-purple-500',
    textColor: 'text-purple-600 dark:text-purple-400',
    bgLight: 'bg-purple-500/10',
    icon: 'Lightbulb',
    route: '/initiatives',
    description: 'Planning & approval phase',
    descriptionPl: 'Faza planowania i zatwierdzania',
  },
  EXECUTION: {
    label: 'Execution',
    labelPl: 'Realizacja',
    color: 'bg-emerald-500',
    textColor: 'text-emerald-600 dark:text-emerald-400',
    bgLight: 'bg-emerald-500/10',
    icon: 'Play',
    route: '/execution',
    description: 'Active implementation phase',
    descriptionPl: 'Faza aktywnej realizacji',
  },
  BENEFITS: {
    label: 'Benefits',
    labelPl: 'Korzyści',
    color: 'bg-amber-500',
    textColor: 'text-amber-600 dark:text-amber-400',
    bgLight: 'bg-amber-500/10',
    icon: 'TrendingUp',
    route: '/benefits',
    description: 'Value tracking phase',
    descriptionPl: 'Faza śledzenia wartości',
  },
};

const PRIORITY_CONFIG = {
  critical: {
    label: 'Critical',
    labelPl: 'Krytyczny',
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
  },
  high: { label: 'High', labelPl: 'Wysoki', color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
  medium: {
    label: 'Medium',
    labelPl: 'Średni',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
  },
  low: { label: 'Low', labelPl: 'Niski', color: 'text-slate-500', bgColor: 'bg-slate-500/10' },
};

const RAID_TYPE_CONFIG = {
  risk: {
    label: 'Risk',
    labelPl: 'Ryzyko',
    color: 'bg-rose-500/20 text-rose-400',
    icon: AlertTriangle,
  },
  assumption: {
    label: 'Assumption',
    labelPl: 'Założenie',
    color: 'bg-blue-500/20 text-blue-400',
    icon: Target,
  },
  issue: {
    label: 'Issue',
    labelPl: 'Problem',
    color: 'bg-red-500/20 text-red-400',
    icon: AlertTriangle,
  },
  dependency: {
    label: 'Dependency',
    labelPl: 'Zależność',
    color: 'bg-purple-500/20 text-purple-400',
    icon: Link2,
  },
};

const SEVERITY_CONFIG = {
  LOW: { label: 'Low', labelPl: 'Niski', color: 'bg-slate-500/20 text-slate-400' },
  MEDIUM: { label: 'Medium', labelPl: 'Średni', color: 'bg-amber-500/20 text-amber-400' },
  HIGH: { label: 'High', labelPl: 'Wysoki', color: 'bg-orange-500/20 text-orange-400' },
  CRITICAL: { label: 'Critical', labelPl: 'Krytyczny', color: 'bg-red-500/20 text-red-400' },
};

// Helper to determine module from status
const getModuleFromStatus = (status: string): keyof typeof MODULE_CONFIG => {
  if (['DRAFT', 'PENDING_REVIEW'].includes(status)) return 'TOOLS'; // or ASSESSMENT
  if (
    ['REVIEW', 'PROMOTED', 'PLANNING', 'APPROVED', 'SCHEDULED', 'CANCELLED', 'ARCHIVED'].includes(
      status
    )
  )
    return 'INITIATIVES';
  if (['EXECUTING', 'BLOCKED', 'DONE'].includes(status)) return 'EXECUTION';
  if (['TRACKING'].includes(status)) return 'BENEFITS';
  return 'TOOLS';
};

// Helper to get next gate for current status
const getNextGateForStatus = (status: string): keyof typeof GATE_CONFIG | null => {
  const gateMap: Record<string, keyof typeof GATE_CONFIG> = {
    REVIEW: 'PROMOTE',
    PLANNING: 'APPROVE',
    APPROVED: 'SCHEDULE',
    EXECUTING: 'COMPLETE',
    DONE: 'START_TRACKING',
    BLOCKED: 'UNBLOCK',
  };
  return gateMap[status] || null;
};

// Helper to get role label
const getRoleLabel = (role: string, isPolish: boolean): string => {
  const labels: Record<string, { en: string; pl: string }> = {
    owner: { en: 'Initiative Owner', pl: 'Właściciel inicjatywy' },
    sponsor: { en: 'Project Sponsor', pl: 'Sponsor projektu' },
    pmo: { en: 'PMO', pl: 'PMO' },
    committee: { en: 'Steering Committee', pl: 'Komitet Sterujący' },
  };
  return isPolish ? labels[role]?.pl || role : labels[role]?.en || role;
};

export const InitiativeDocumentView: React.FC<InitiativeDocumentViewProps> = ({
  initiativeId,
  onBack,
  onStatusChange,
  sourceModule,
  onOpenTask,
  onOpenDecision,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const { isChatCollapsed, toggleChatCollapse } = useAppStore();
  const { updateWorkspaceFromView } = useConversationStore();

  // Core state
  const [initiative, setInitiative] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Related data
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [raidItems, setRaidItems] = useState<RaidItem[]>([]);
  const [watchers, setWatchers] = useState<Watcher[]>([]);
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);

  // Editable fields
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [comments, setComments] = useState<Comment[]>([]);
  const [linkedItems, setLinkedItems] = useState<LinkedItem[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [dependencies, setDependencies] = useState<TaskDependency[]>([]);
  const [reminders, setReminders] = useState<ReminderRule[]>([]);
  const [escalation, setEscalation] = useState<EscalationRule | null>(null);
  const [thresholds, setThresholds] = useState<WarningThresholds>({
    warningDays: 3,
    criticalDays: 1,
    showOverdueAlert: true,
  });
  const [users, setUsers] = useState<
    { id: string; firstName: string; lastName: string; email?: string }[]
  >([]);

  // Control fields
  const [priority, setPriority] = useState<keyof typeof PRIORITY_CONFIG>('medium');
  const [ownerId, setOwnerId] = useState('');
  const [sponsorId, setSponsorId] = useState('');
  const [targetDate, setTargetDate] = useState('');

  // UI state - all sections collapsed by default
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [isGeneratingAI, setIsGeneratingAI] = useState<string | null>(null);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showCreateDecision, setShowCreateDecision] = useState(false);
  const [showCreateRaid, setShowCreateRaid] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showPhaseDropdown, setShowPhaseDropdown] = useState(false);
  const [showApprovalWorkflow, setShowApprovalWorkflow] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<
    Array<{
      id: string;
      gateType: string;
      gateName: string;
      requiredRole: 'owner' | 'sponsor' | 'pmo' | 'committee';
      status: 'PENDING' | 'APPROVED' | 'REJECTED';
      requestedAt: string;
      deciderId?: string;
      deciderName?: string;
      dueDate?: string;
    }>
  >([]);

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskIsMilestone, setNewTaskIsMilestone] = useState(false);
  const [newTaskMilestoneDate, setNewTaskMilestoneDate] = useState('');
  const [newDecisionTitle, setNewDecisionTitle] = useState('');
  const [newDecisionType, setNewDecisionType] = useState('GOVERNANCE_DECISION_MAKING');
  const [newRaidTitle, setNewRaidTitle] = useState('');
  const [newRaidType, setNewRaidType] = useState<'risk' | 'issue' | 'assumption' | 'dependency'>(
    'risk'
  );
  const [newRaidSeverity, setNewRaidSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>(
    'MEDIUM'
  );
  const [newRaidDescription, setNewRaidDescription] = useState('');

  const [currentUserId] = useState<string>('current-user');

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getUserDisplayName = useCallback(
    (userId: string) => {
      const u = users.find((x) => x.id === userId);
      if (!u) return userId;
      const full = `${u.firstName} ${u.lastName}`.trim();
      return full || u.email || userId;
    },
    [users]
  );

  // Fetch all data
  const fetchAll = useCallback(async () => {
    if (!initiativeId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await Api.getInitiativeById(initiativeId);
      setInitiative(data);
      setSummary(data.summary || data.description || '');
      setDescription(data.description || '');
      setTags(data.tags || []);
      const rawPriority = (data.priority || 'medium').toLowerCase();
      setPriority(
        (rawPriority in PRIORITY_CONFIG ? rawPriority : 'medium') as keyof typeof PRIORITY_CONFIG
      );
      setOwnerId(data.ownerId || data.owner_id || '');
      setSponsorId(data.sponsorId || data.sponsor_id || '');
      setTargetDate(data.plannedEndDate || data.targetDate || '');

      // Fetch related data (best-effort)
      try {
        const ds = await Api.get(
          `/decisions?relatedObjectId=${initiativeId}&relatedObjectType=initiative`
        );
        setDecisions(Array.isArray(ds) ? ds : ds?.decisions || []);
      } catch {
        setDecisions([]);
      }

      try {
        const r = await Api.get(`/initiatives/${initiativeId}/raid`);
        setRaidItems(r?.items || r?.raid || (Array.isArray(r) ? r : []));
      } catch {
        setRaidItems([]);
      }

      try {
        const w = await Api.get(`/initiatives/${initiativeId}/watchers`);
        setWatchers(w?.watchers || (Array.isArray(w) ? w : []));
      } catch {
        setWatchers([]);
      }

      try {
        const h = await Api.get(`/initiatives/${initiativeId}/history`);
        setHistory(h?.events || h?.history || (Array.isArray(h) ? h : []));
      } catch {
        setHistory([]);
      }

      try {
        const ts = await Api.get(`/tasks?initiativeId=${initiativeId}`);
        const taskList = Array.isArray(ts) ? ts : ts?.tasks || [];
        setTasks(
          taskList.map((t: any) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            dueDate: t.dueDate,
            assigneeName: t.assigneeName || t.assignee?.name,
            isMilestone: t.isMilestone || false,
            milestoneDate: t.milestoneDate,
          }))
        );
      } catch {
        setTasks([]);
      }

      try {
        const st = await Api.get(`/initiatives/${initiativeId}/stakeholders`);
        const mapped: Stakeholder[] = (st?.stakeholders || (Array.isArray(st) ? st : [])).map(
          (s: any) => ({
            id: s.id,
            decisionId: initiativeId,
            userId: s.userId || s.user_id,
            userName: s.name || `${s.firstName || ''} ${s.lastName || ''}`.trim(),
            userEmail: s.email,
            role: (s.role === 'R'
              ? 'responsible'
              : s.role === 'A'
                ? 'accountable'
                : s.role === 'C'
                  ? 'consulted'
                  : 'informed') as StakeholderRole,
            notificationSettings: { email: true, inApp: true, slack: false },
          })
        );
        setStakeholders(mapped);
      } catch {
        setStakeholders([]);
      }

      // Fetch users for dropdowns
      try {
        const u = await Api.get('/users');
        setUsers(Array.isArray(u) ? u : u?.users || []);
      } catch {
        setUsers([]);
      }

      // Fetch pending approval decisions for this initiative
      try {
        const approvalDecisions = await Api.get(
          `/decisions?relatedObjectId=${initiativeId}&relatedObjectType=initiative&type=GATE_APPROVAL`
        );
        const approvals = (
          Array.isArray(approvalDecisions) ? approvalDecisions : approvalDecisions?.decisions || []
        )
          .filter((d: any) => d.status === 'PENDING')
          .map((d: any) => ({
            id: d.id,
            gateType: d.gateType || d.metadata?.gateType || 'UNKNOWN',
            gateName: d.title,
            requiredRole: d.metadata?.requiredRole || 'sponsor',
            status: d.status,
            requestedAt: d.createdAt,
            deciderId: d.deciderId,
            deciderName: d.deciderName || d.decider?.name,
            dueDate: d.dueDate,
          }));
        setPendingApprovals(approvals);
      } catch {
        setPendingApprovals([]);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load initiative');
    } finally {
      setIsLoading(false);
    }
  }, [initiativeId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const status = (initiative?.status || 'DRAFT') as InitiativeStatus;
  const statusMeta = getStatusMeta(status);
  const statusActions = getStatusActions(status);
  const primaryActions = statusActions.filter((a) => a.variant === 'primary').slice(0, 2);
  const currentModule = getModuleFromStatus(status);
  const moduleConfig = MODULE_CONFIG[currentModule];

  const requiredGates = useMemo(
    () => GATE_DEFINITIONS.filter((g) => g.forStatus === status),
    [status]
  );
  const pendingGates = useMemo(
    () =>
      requiredGates.filter((g) => {
        const match = decisions.find((d) => d.type === g.pmoDomain);
        return !match || match.status === 'PENDING';
      }),
    [requiredGates, decisions]
  );

  // Workflow computed values
  const nextGate = getNextGateForStatus(status);
  const nextGateConfig = nextGate ? GATE_CONFIG[nextGate] : null;
  const canRequestApproval =
    nextGateConfig && !pendingApprovals.some((a) => a.gateType === nextGate);
  const hasPendingApproval = pendingApprovals.length > 0;

  const getGateStatus = useCallback(
    (pmoDomain: string) => {
      const match = decisions.find((d) => d.type === pmoDomain);
      if (!match) return 'MISSING';
      return match.status;
    },
    [decisions]
  );

  const isWatching = useMemo(
    () => watchers.some((w) => w.userId === currentUserId),
    [watchers, currentUserId]
  );

  // Computed stats
  const tasksDone = useMemo(
    () => tasks.filter((t) => t.status === 'done' || t.status === 'DONE').length,
    [tasks]
  );
  const tasksInProgress = useMemo(
    () => tasks.filter((t) => t.status === 'in_progress' || t.status === 'IN_PROGRESS').length,
    [tasks]
  );
  const milestones = useMemo(() => tasks.filter((t) => t.isMilestone), [tasks]);
  const riskCount = useMemo(() => raidItems.filter((r) => r.type === 'risk').length, [raidItems]);
  const issueCount = useMemo(() => raidItems.filter((r) => r.type === 'issue').length, [raidItems]);
  const criticalRaids = useMemo(
    () => raidItems.filter((r) => r.severity === 'CRITICAL' || r.severity === 'HIGH').length,
    [raidItems]
  );

  const ownerName = useMemo(() => {
    const user = users.find((u) => u.id === ownerId);
    return user ? `${user.firstName} ${user.lastName}` : '';
  }, [users, ownerId]);

  const sponsorName = useMemo(() => {
    const user = users.find((u) => u.id === sponsorId);
    return user ? `${user.firstName} ${user.lastName}` : '';
  }, [users, sponsorId]);

  // Handlers
  const handleStatusAction = async (action: StatusAction) => {
    setIsMutating(true);
    try {
      await Api.patch(`/initiatives/${initiativeId}`, { status: action.targetStatus });
      setInitiative((prev: any) => ({ ...prev, status: action.targetStatus }));
      onStatusChange?.(action.targetStatus);
      toast.success(isPolish ? 'Status zaktualizowany' : 'Status updated');
      fetchAll();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update status');
    } finally {
      setIsMutating(false);
    }
  };

  const handleToggleWatch = async () => {
    setIsMutating(true);
    try {
      if (isWatching) {
        const myWatch = watchers.find((w) => w.userId === currentUserId);
        if (myWatch) await Api.delete(`/initiatives/${initiativeId}/watchers/${myWatch.id}`);
        setWatchers((prev) => prev.filter((w) => w.userId !== currentUserId));
        toast.success(isPolish ? 'Przestałeś obserwować' : 'Stopped watching');
      } else {
        const res = await Api.post(`/initiatives/${initiativeId}/watchers`, {
          userId: currentUserId,
        });
        setWatchers((prev) => [...prev, res]);
        toast.success(isPolish ? 'Obserwujesz inicjatywę' : 'Now watching');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed');
    } finally {
      setIsMutating(false);
    }
  };

  const handleSave = async () => {
    setIsMutating(true);
    try {
      await Api.patch(`/initiatives/${initiativeId}`, {
        summary,
        description,
        tags,
        priority,
        ownerId,
        sponsorId,
        plannedEndDate: targetDate,
      });
      toast.success(isPolish ? 'Zapisano' : 'Saved');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save');
    } finally {
      setIsMutating(false);
    }
  };

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) return;
    setIsMutating(true);
    try {
      const res = await Api.post('/tasks', {
        title: newTaskTitle,
        initiativeId,
        status: 'todo',
        isMilestone: newTaskIsMilestone,
        milestoneDate: newTaskIsMilestone ? newTaskMilestoneDate : undefined,
      });
      setTasks((prev) => [
        ...prev,
        {
          id: res.id,
          title: res.title,
          status: res.status,
          isMilestone: res.isMilestone,
          milestoneDate: res.milestoneDate,
        },
      ]);
      setNewTaskTitle('');
      setNewTaskIsMilestone(false);
      setNewTaskMilestoneDate('');
      setShowCreateTask(false);
      toast.success(isPolish ? 'Zadanie utworzone' : 'Task created');
    } catch (e: any) {
      toast.error(e?.message || 'Failed');
    } finally {
      setIsMutating(false);
    }
  };

  const handleCreateDecision = async () => {
    if (!newDecisionTitle.trim()) return;
    setIsMutating(true);
    try {
      const res = await Api.post('/decisions', {
        title: newDecisionTitle,
        type: newDecisionType,
        relatedObjectId: initiativeId,
        relatedObjectType: 'initiative',
        status: 'PENDING',
      });
      setDecisions((prev) => [...prev, res]);
      setNewDecisionTitle('');
      setShowCreateDecision(false);
      toast.success(isPolish ? 'Decyzja utworzona' : 'Decision created');
    } catch (e: any) {
      toast.error(e?.message || 'Failed');
    } finally {
      setIsMutating(false);
    }
  };

  const handleCreateRaid = async () => {
    if (!newRaidTitle.trim()) return;
    setIsMutating(true);
    try {
      const res = await Api.post(`/initiatives/${initiativeId}/raid`, {
        type: newRaidType,
        title: newRaidTitle,
        description: newRaidDescription,
        severity: newRaidSeverity,
        status: 'OPEN',
      });
      setRaidItems((prev) => [...prev, res]);
      setNewRaidTitle('');
      setNewRaidDescription('');
      setShowCreateRaid(false);
      toast.success(isPolish ? 'Element RAID dodany' : 'RAID item added');
    } catch (e: any) {
      toast.error(e?.message || 'Failed');
    } finally {
      setIsMutating(false);
    }
  };

  const handleAddComment = async (content: string) => {
    const newComment: Comment = {
      id: Math.random().toString(36).substr(2, 9),
      content,
      authorId: currentUserId,
      authorName: 'Current User',
      createdAt: new Date().toISOString(),
      likes: 0,
      likedByMe: false,
    };
    setComments((prev) => [...prev, newComment]);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success(isPolish ? 'Link skopiowany' : 'Link copied');
    setShowMoreMenu(false);
  };

  const handleExportPDF = () => {
    toast.success(isPolish ? 'Eksport PDF w przygotowaniu...' : 'Preparing PDF export...');
    setShowMoreMenu(false);
  };

  // AI Generation handlers
  const handleGenerateAI = async (section: string) => {
    setIsGeneratingAI(section);
    try {
      // Simulate AI generation - in production this would call AI service
      await new Promise((resolve) => setTimeout(resolve, 1500));

      if (section === 'summary') {
        const aiSummary = isPolish
          ? `Inicjatywa "${initiative?.name}" ma na celu transformację procesów biznesowych poprzez wdrożenie nowoczesnych rozwiązań technologicznych. Główne cele obejmują zwiększenie efektywności operacyjnej, redukcję kosztów oraz poprawę doświadczeń użytkowników.`
          : `The "${initiative?.name}" initiative aims to transform business processes through the implementation of modern technological solutions. Key objectives include increasing operational efficiency, reducing costs, and improving user experiences.`;
        setSummary(aiSummary);
        toast.success(isPolish ? 'Opis wygenerowany przez AI' : 'Description generated by AI');
      } else if (section === 'tasks') {
        toast.success(
          isPolish
            ? 'AI zasugeruje zadania na podstawie opisu'
            : 'AI will suggest tasks based on description'
        );
      } else if (section === 'raid') {
        toast.success(
          isPolish
            ? 'AI zidentyfikuje ryzyka i zależności'
            : 'AI will identify risks and dependencies'
        );
      } else if (section === 'financial') {
        toast.success(
          isPolish ? 'AI oszacuje koszty i korzyści' : 'AI will estimate costs and benefits'
        );
      } else if (section === 'gates') {
        // AI analyzes gate readiness and provides recommendations
        const recommendations = isPolish
          ? `Analiza gotowości bramki "${nextGateConfig?.namePl || 'N/A'}":\n\n✅ Mocne strony:\n- Właściciel i sponsor przypisani\n- Opis inicjatywy zdefiniowany\n\n⚠️ Do uzupełnienia:\n- Dodaj co najmniej jedno ryzyko do RAID\n- Ustal datę docelową\n- Przypisz zespół realizacyjny\n\n💡 Rekomendacja: Uzupełnij brakujące elementy przed wysłaniem prośby o zatwierdzenie.`
          : `Gate readiness analysis for "${nextGateConfig?.name || 'N/A'}":\n\n✅ Strengths:\n- Owner and sponsor assigned\n- Initiative description defined\n\n⚠️ To complete:\n- Add at least one risk to RAID\n- Set target date\n- Assign execution team\n\n💡 Recommendation: Complete missing items before requesting approval.`;
        toast.success(
          isPolish ? 'AI przeanalizował gotowość bramki' : 'AI analyzed gate readiness'
        );
        // In production, this would show a modal or update a state with AI recommendations
        console.log('AI Gate Analysis:', recommendations);
      } else if (section === 'decisions') {
        // AI suggests decisions that may be needed
        toast.success(
          isPolish ? 'AI zasugeruje potrzebne decyzje' : 'AI will suggest needed decisions'
        );
      } else if (section === 'comments') {
        // AI generates a helpful comment based on initiative context
        const aiComment = isPolish
          ? `🤖 **Analiza AI:**\n\nNa podstawie przeglądu inicjatywy "${initiative?.name}" zauważam:\n\n📊 **Status**: ${statusMeta.label}\n📍 **Moduł**: ${moduleConfig.labelPl}\n\n**Rekomendacje:**\n1. ${tasks.length === 0 ? 'Dodaj pierwsze zadania do realizacji' : `Kontynuuj realizację ${tasks.length} zadań`}\n2. ${raidItems.length === 0 ? 'Zidentyfikuj potencjalne ryzyka' : `Monitoruj ${raidItems.length} elementów RAID`}\n3. ${!targetDate ? 'Ustal datę docelową' : 'Harmonogram ustalony ✓'}\n\n_Wygenerowano automatycznie przez AI_`
          : `🤖 **AI Analysis:**\n\nBased on review of "${initiative?.name}" initiative:\n\n📊 **Status**: ${statusMeta.label}\n📍 **Module**: ${moduleConfig.label}\n\n**Recommendations:**\n1. ${tasks.length === 0 ? 'Add first tasks for execution' : `Continue with ${tasks.length} tasks`}\n2. ${raidItems.length === 0 ? 'Identify potential risks' : `Monitor ${raidItems.length} RAID items`}\n3. ${!targetDate ? 'Set target date' : 'Timeline established ✓'}\n\n_Auto-generated by AI_`;

        // Add AI comment to the list
        const newAIComment: Comment = {
          id: `ai-${Date.now()}`,
          content: aiComment,
          authorId: 'ai-assistant',
          authorName: 'AI Assistant',
          createdAt: new Date().toISOString(),
          likes: 0,
          likedByMe: false,
        };
        setComments((prev) => [newAIComment, ...prev]);
        toast.success(isPolish ? 'AI dodał komentarz' : 'AI added comment');
      }
    } catch (e: any) {
      toast.error(e?.message || 'AI generation failed');
    } finally {
      setIsGeneratingAI(null);
    }
  };

  // Request approval from role
  const handleRequestApproval = async (role: 'owner' | 'sponsor', gateType: string) => {
    setIsMutating(true);
    try {
      const targetUserId = role === 'owner' ? ownerId : sponsorId;
      if (!targetUserId) {
        toast.error(
          isPolish
            ? `Wybierz ${role === 'owner' ? 'właściciela' : 'sponsora'}`
            : `Select ${role} first`
        );
        return;
      }

      // Create decision request
      await Api.post('/decisions', {
        title: `${gateType} - ${initiative?.name}`,
        type: gateType,
        relatedObjectId: initiativeId,
        relatedObjectType: 'initiative',
        status: 'PENDING',
        deciderId: targetUserId,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      });

      toast.success(isPolish ? 'Wysłano prośbę o zatwierdzenie' : 'Approval request sent');
      fetchAll();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to request approval');
    } finally {
      setIsMutating(false);
    }
  };

  const handleOpenChat = () => {
    // Ensure chat panel is visible
    if (isChatCollapsed) {
      toggleChatCollapse();
    }

    // Push rich initiative context into the unified chat workspace context
    updateWorkspaceFromView(AppView.INITIATIVE_GENERATOR, initiativeId, {
      type: 'initiative',
      id: initiativeId,
      title: initiative?.name || '',
      status,
      phase: isPolish ? moduleConfig.labelPl : moduleConfig.label,
      summary,
      tasksCount: tasks.length,
      tasksDone,
      decisionsCount: decisions.length,
      raidCount: raidItems.length,
    });
  };

  const handleArchive = async () => {
    if (
      !confirm(
        isPolish
          ? 'Czy na pewno chcesz zarchiwizować tę inicjatywę?'
          : 'Are you sure you want to archive this initiative?'
      )
    )
      return;
    setIsMutating(true);
    try {
      await Api.patch(`/initiatives/${initiativeId}`, { status: 'ARCHIVED' });
      toast.success(isPolish ? 'Inicjatywa zarchiwizowana' : 'Initiative archived');
      setShowMoreMenu(false);
      fetchAll();
    } catch (e: any) {
      toast.error(e?.message || 'Failed');
    } finally {
      setIsMutating(false);
    }
  };

  const handleDelete = async () => {
    if (status !== 'DRAFT') {
      toast.error(isPolish ? 'Można usunąć tylko szkice' : 'Only drafts can be deleted');
      return;
    }
    if (
      !confirm(
        isPolish
          ? 'Czy na pewno chcesz usunąć tę inicjatywę?'
          : 'Are you sure you want to delete this initiative?'
      )
    )
      return;
    setIsMutating(true);
    try {
      await Api.delete(`/initiatives/${initiativeId}`);
      toast.success(isPolish ? 'Inicjatywa usunięta' : 'Initiative deleted');
      setShowMoreMenu(false);
      onBack?.();
    } catch (e: any) {
      toast.error(e?.message || 'Failed');
    } finally {
      setIsMutating(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (error || !initiative) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <AlertTriangle className="w-12 h-12 text-red-400 mb-4" />
        <p className="text-slate-500">{error || 'Initiative not found'}</p>
        {onBack && (
          <button onClick={onBack} className="mt-4 text-purple-500 hover:underline">
            {isPolish ? 'Wróć' : 'Go back'}
          </button>
        )}
      </div>
    );
  }

  const priorityConfig = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Header - Full Width */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-3 bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 p-5"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                {onBack && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onBack}
                    className="p-2 rounded-xl bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors"
                  >
                    <ChevronLeft size={20} className="text-slate-500" />
                  </motion.button>
                )}
                {/* Module Badge */}
                <div
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${moduleConfig.bgLight} ${moduleConfig.textColor}`}
                >
                  {isPolish ? moduleConfig.labelPl : moduleConfig.label}
                </div>
                <input
                  type="text"
                  value={initiative.name || ''}
                  readOnly
                  className="flex-1 text-xl font-bold text-slate-800 dark:text-white bg-transparent border-none focus:outline-none truncate"
                />
              </div>
              <div className="flex items-center gap-3">
                {/* Status Frame - visible indicator of initiative status */}
                <div
                  className={`flex items-center gap-2.5 px-4 py-2 rounded-xl border-2 ${statusMeta.bgColor} ${statusMeta.dotColor.replace('bg-', 'border-').replace('-400', '-500/50')} transition-all`}
                >
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${statusMeta.dotColor} animate-pulse`}
                  />
                  <span className={`text-sm font-semibold ${statusMeta.color}`}>
                    {statusMeta.label}
                  </span>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSave}
                  disabled={isMutating}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/70 dark:bg-navy-900/50 border border-blue-500/40 dark:border-blue-400/30 text-blue-700 dark:text-blue-300 hover:bg-blue-500/10 dark:hover:bg-blue-500/10 text-sm font-semibold transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  title={isPolish ? 'Zapisz' : 'Save'}
                >
                  {isMutating ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  <span>{isPolish ? 'Zapisz' : 'Save'}</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleOpenChat}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/70 dark:bg-navy-900/50 border border-purple-500/40 dark:border-purple-400/30 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 dark:hover:bg-purple-500/10 text-sm font-semibold transition-all shadow-sm"
                  title={isPolish ? 'Otwórz czat do tej inicjatywy' : 'Open initiative chat'}
                >
                  <MessageSquare size={16} />
                  <span>{isPolish ? 'Czat' : 'Chat'}</span>
                </motion.button>
                {/* More Menu */}
                <div className="relative">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowMoreMenu(!showMoreMenu)}
                    className="p-2 rounded-xl bg-white/70 dark:bg-navy-900/50 text-slate-400 hover:text-slate-600 border border-slate-200 dark:border-navy-700 transition-all"
                  >
                    <MoreVertical size={18} />
                  </motion.button>
                  <AnimatePresence>
                    {showMoreMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                        className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-navy-800 rounded-xl shadow-xl border border-slate-200 dark:border-navy-600 py-1 z-50 max-h-80 overflow-y-auto"
                      >
                        {/* Quick Create */}
                        <button
                          onClick={() => {
                            setShowMoreMenu(false);
                            toggleSection('tasks');
                            setShowCreateTask(true);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                        >
                          <CheckSquare size={16} />
                          {isPolish ? 'Nowe zadanie' : 'New Task'}
                        </button>
                        <button
                          onClick={() => {
                            setShowMoreMenu(false);
                            toggleSection('decisions');
                            setShowCreateDecision(true);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10"
                        >
                          <Scale size={16} />
                          {isPolish ? 'Nowa decyzja' : 'New Decision'}
                        </button>
                        <button
                          onClick={() => {
                            setShowMoreMenu(false);
                            toggleSection('raid');
                            setShowCreateRaid(true);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                        >
                          <AlertTriangle size={16} />
                          {isPolish ? 'Dodaj RAID' : 'Add RAID'}
                        </button>

                        <div className="border-t border-slate-100 dark:border-navy-700 my-1" />

                        {/* Actions */}
                        <button
                          onClick={() => {
                            setShowMoreMenu(false);
                            window.open(window.location.href, '_blank');
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700"
                        >
                          <ExternalLink size={16} />
                          {isPolish ? 'Nowa karta' : 'New tab'}
                        </button>
                        <button
                          onClick={() => {
                            setShowMoreMenu(false);
                            handleCopyLink();
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700"
                        >
                          <Copy size={16} />
                          {isPolish ? 'Kopiuj link' : 'Copy link'}
                        </button>
                        <button
                          onClick={() => {
                            setShowMoreMenu(false);
                            handleExportPDF();
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700"
                        >
                          <Download size={16} />
                          PDF
                        </button>

                        <div className="border-t border-slate-100 dark:border-navy-700 my-1" />

                        {/* Danger */}
                        <button
                          onClick={() => {
                            setShowMoreMenu(false);
                            handleArchive();
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10"
                        >
                          <Archive size={16} />
                          {isPolish ? 'Archiwizuj' : 'Archive'}
                        </button>
                        {status === 'DRAFT' && (
                          <button
                            onClick={() => {
                              setShowMoreMenu(false);
                              handleDelete();
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                          >
                            <Trash2 size={16} />
                            {isPolish ? 'Usuń' : 'Delete'}
                          </button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </motion.div>

          {/* LEFT COLUMN - Merit/Content (2/3) */}
          <div className="lg:col-span-2 space-y-4 order-2 lg:order-1">
            {/* 1. Description (Opis) */}
            <CollapsibleSection
              id="summary"
              title={isPolish ? 'Opis inicjatywy' : 'Initiative Description'}
              icon={<FileText size={18} className="text-blue-500 dark:text-blue-400" />}
              iconBg="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 dark:from-blue-500/20 dark:to-cyan-500/20"
              expanded={expandedSections.has('summary')}
              onToggle={() => toggleSection('summary')}
              badge={summary ? <span className="text-xs text-slate-400">✓</span> : undefined}
              actions={
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleGenerateAI('summary');
                  }}
                  disabled={isGeneratingAI === 'summary'}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-500/10 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 text-xs font-medium transition-all disabled:opacity-50"
                  title={isPolish ? 'Wygeneruj opis AI' : 'Generate AI description'}
                >
                  {isGeneratingAI === 'summary' ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  <span>AI</span>
                </motion.button>
              }
            >
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={4}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50/80 dark:bg-navy-800/80 border border-slate-200/80 dark:border-navy-600/80 text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/10 resize-none transition-all"
                placeholder={
                  isPolish
                    ? 'Opisz cel i zakres inicjatywy...'
                    : 'Describe initiative goal and scope...'
                }
              />
            </CollapsibleSection>

            {/* 2. Comments (Komentarze) */}
            <CommentsSection
              comments={comments}
              onAddComment={handleAddComment}
              onDeleteComment={async (id) => {
                setComments((prev) => prev.filter((c) => c.id !== id));
              }}
              onLikeComment={async (id) => {
                setComments((prev) =>
                  prev.map((c) =>
                    c.id === id
                      ? {
                          ...c,
                          likes: c.likedByMe ? c.likes - 1 : c.likes + 1,
                          likedByMe: !c.likedByMe,
                        }
                      : c
                  )
                );
              }}
              onGenerateAIComment={() => handleGenerateAI('comments')}
              isGeneratingAI={isGeneratingAI === 'comments'}
              currentUserId={currentUserId}
              expanded={expandedSections.has('comments')}
              onToggleExpand={() => toggleSection('comments')}
            />

            {/* 3. Tasks & Milestones (Zadania z kamieniami milowymi) */}
            <CollapsibleSection
              id="tasks"
              title={isPolish ? 'Zadania i kamienie milowe' : 'Tasks & Milestones'}
              icon={<CheckSquare size={18} className="text-emerald-500 dark:text-emerald-400" />}
              iconBg="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/20 dark:to-teal-500/20"
              expanded={expandedSections.has('tasks')}
              onToggle={() => toggleSection('tasks')}
              badge={
                <div className="flex items-center gap-2">
                  {milestones.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 flex items-center gap-1">
                      <Milestone size={10} />
                      {milestones.length}
                    </span>
                  )}
                  <span className="text-xs text-slate-400">
                    {tasksDone}/{tasks.length}
                  </span>
                </div>
              }
              actions={
                <div className="flex items-center gap-2">
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCreateTask(true);
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-xs font-medium transition-all"
                  >
                    <Plus size={14} />
                    <span>{isPolish ? 'Nowe' : 'New'}</span>
                  </motion.button>
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGenerateAI('tasks');
                    }}
                    disabled={isGeneratingAI === 'tasks'}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-500/10 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 text-xs font-medium transition-all disabled:opacity-50"
                    title={isPolish ? 'AI zasugeruje zadania' : 'AI will suggest tasks'}
                  >
                    {isGeneratingAI === 'tasks' ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Sparkles size={14} />
                    )}
                    <span>AI</span>
                  </motion.button>
                </div>
              }
            >
              {/* Create Task Form */}
              {showCreateTask && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 p-4 rounded-xl border-2 border-emerald-300 dark:border-emerald-500/50 bg-emerald-50/30 dark:bg-emerald-500/5 space-y-3"
                >
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder={isPolish ? 'Tytuł zadania...' : 'Task title...'}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm"
                    autoFocus
                  />
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newTaskIsMilestone}
                        onChange={(e) => setNewTaskIsMilestone(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-purple-500 focus:ring-purple-500"
                      />
                      <span className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-1">
                        <Milestone size={14} />
                        {isPolish ? 'Kamień milowy' : 'Milestone'}
                      </span>
                    </label>
                    {newTaskIsMilestone && (
                      <input
                        type="date"
                        value={newTaskMilestoneDate}
                        onChange={(e) => setNewTaskMilestoneDate(e.target.value)}
                        className="px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm"
                      />
                    )}
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowCreateTask(false)}
                      className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700"
                    >
                      {isPolish ? 'Anuluj' : 'Cancel'}
                    </button>
                    <button
                      onClick={handleCreateTask}
                      disabled={isMutating || !newTaskTitle.trim()}
                      className="px-3 py-1.5 text-xs bg-emerald-500 text-white rounded-lg disabled:opacity-50"
                    >
                      {isPolish ? 'Utwórz' : 'Create'}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Milestones Timeline */}
              {milestones.length > 0 && (
                <div className="mb-4 p-3 rounded-xl bg-purple-50/50 dark:bg-purple-500/5 border border-purple-200/50 dark:border-purple-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <Milestone size={14} className="text-purple-500" />
                    <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase">
                      {isPolish ? 'Kamienie milowe' : 'Milestones'}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {milestones.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-white/50 dark:bg-navy-800/50 cursor-pointer hover:bg-white/80 dark:hover:bg-navy-800/80 transition-colors"
                        onClick={() => onOpenTask?.(m.id)}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2.5 h-2.5 rounded-full ${m.status === 'done' || m.status === 'DONE' ? 'bg-emerald-500' : 'bg-purple-500'}`}
                          />
                          <span className="text-sm text-slate-700 dark:text-slate-300">
                            {m.title}
                          </span>
                        </div>
                        {m.milestoneDate && (
                          <span className="text-xs text-slate-400">
                            {new Date(m.milestoneDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tasks List */}
              {tasks.length === 0 && !showCreateTask ? (
                <div className="text-center py-6 border-2 border-dashed border-slate-200 dark:border-navy-700 rounded-xl">
                  <CheckSquare
                    size={24}
                    className="mx-auto mb-2 text-slate-300 dark:text-slate-600"
                  />
                  <p className="text-sm text-slate-400">
                    {isPolish ? 'Brak zadań' : 'No tasks yet'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tasks
                    .filter((t) => !t.isMilestone)
                    .map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-slate-50/50 dark:bg-navy-800/50 border border-slate-200/50 dark:border-navy-700/50 hover:border-emerald-500/30 cursor-pointer transition-all"
                        onClick={() => onOpenTask?.(task.id)}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-2.5 h-2.5 rounded-full ${
                              task.status === 'done' || task.status === 'DONE'
                                ? 'bg-emerald-500'
                                : task.status === 'in_progress' || task.status === 'IN_PROGRESS'
                                  ? 'bg-blue-500'
                                  : task.status === 'blocked' || task.status === 'BLOCKED'
                                    ? 'bg-red-500'
                                    : 'bg-slate-400'
                            }`}
                          />
                          <span className="text-sm text-slate-700 dark:text-slate-300">
                            {task.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {task.assigneeName && (
                            <span className="text-xs text-slate-400">{task.assigneeName}</span>
                          )}
                          {task.dueDate && (
                            <span className="text-xs text-slate-400">
                              {new Date(task.dueDate).toLocaleDateString()}
                            </span>
                          )}
                          <ExternalLink size={14} className="text-slate-400" />
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* Progress Bar */}
              {tasks.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-navy-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-500">
                      {isPolish ? 'Postęp' : 'Progress'}
                    </span>
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      {Math.round((tasksDone / tasks.length) * 100)}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(tasksDone / tasks.length) * 100}%` }}
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                    />
                  </div>
                </div>
              )}
            </CollapsibleSection>

            {/* 4. Decisions (Decyzje) */}
            <CollapsibleSection
              id="decisions"
              title={isPolish ? 'Decyzje' : 'Decisions'}
              icon={<Scale size={18} className="text-amber-500 dark:text-amber-400" />}
              iconBg="bg-gradient-to-br from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20"
              expanded={expandedSections.has('decisions')}
              onToggle={() => toggleSection('decisions')}
              badge={
                decisions.length > 0 ? (
                  <span className="text-xs text-slate-400">
                    {decisions.filter((d) => d.status === 'APPROVED').length}/{decisions.length}
                  </span>
                ) : undefined
              }
              actions={
                <div className="flex items-center gap-2">
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCreateDecision(true);
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 text-xs font-medium transition-all"
                  >
                    <Plus size={14} />
                    <span>{isPolish ? 'Nowa' : 'New'}</span>
                  </motion.button>
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGenerateAI('decisions');
                    }}
                    disabled={isGeneratingAI === 'decisions'}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-500/10 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 text-xs font-medium transition-all disabled:opacity-50"
                    title={isPolish ? 'AI zasugeruje decyzje' : 'AI will suggest decisions'}
                  >
                    {isGeneratingAI === 'decisions' ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Sparkles size={14} />
                    )}
                    <span>AI</span>
                  </motion.button>
                </div>
              }
            >
              {showCreateDecision && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 p-4 rounded-xl border-2 border-amber-300 dark:border-amber-500/50 bg-amber-50/30 dark:bg-amber-500/5 space-y-3"
                >
                  <input
                    type="text"
                    value={newDecisionTitle}
                    onChange={(e) => setNewDecisionTitle(e.target.value)}
                    placeholder={isPolish ? 'Tytuł decyzji...' : 'Decision title...'}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm"
                    autoFocus
                  />
                  <select
                    value={newDecisionType}
                    onChange={(e) => setNewDecisionType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm"
                  >
                    <option value="GOVERNANCE_DECISION_MAKING">Go/No-Go</option>
                    <option value="RESOURCE_RESPONSIBILITY">Resources Commit</option>
                    <option value="SCHEDULE_MILESTONES">Schedule Lock</option>
                    <option value="BUDGET_APPROVAL">Budget Approval</option>
                    <option value="OTHER">Other</option>
                  </select>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowCreateDecision(false)}
                      className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700"
                    >
                      {isPolish ? 'Anuluj' : 'Cancel'}
                    </button>
                    <button
                      onClick={handleCreateDecision}
                      disabled={isMutating || !newDecisionTitle.trim()}
                      className="px-3 py-1.5 text-xs bg-amber-500 text-white rounded-lg disabled:opacity-50"
                    >
                      {isPolish ? 'Utwórz' : 'Create'}
                    </button>
                  </div>
                </motion.div>
              )}
              {decisions.length === 0 && !showCreateDecision ? (
                <div className="text-center py-6 border-2 border-dashed border-slate-200 dark:border-navy-700 rounded-xl">
                  <Scale size={24} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                  <p className="text-sm text-slate-400">
                    {isPolish ? 'Brak decyzji' : 'No decisions yet'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {decisions.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-50/50 dark:bg-navy-800/50 border border-slate-200/50 dark:border-navy-700/50 hover:border-amber-500/30 cursor-pointer transition-all"
                      onClick={() => onOpenDecision?.(d.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-2.5 h-2.5 rounded-full ${d.status === 'APPROVED' ? 'bg-emerald-500' : d.status === 'REJECTED' ? 'bg-red-500' : 'bg-amber-500'}`}
                        />
                        <div>
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            {d.title}
                          </p>
                          <p className="text-xs text-slate-400">{d.type}</p>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-medium rounded ${d.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400' : d.status === 'REJECTED' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}
                      >
                        {d.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CollapsibleSection>

            {/* 5. RAID Log */}
            <CollapsibleSection
              id="raid"
              title="RAID Log"
              icon={<AlertTriangle size={18} className="text-rose-500 dark:text-rose-400" />}
              iconBg="bg-gradient-to-br from-rose-500/10 to-red-500/10 dark:from-rose-500/20 dark:to-red-500/20"
              expanded={expandedSections.has('raid')}
              onToggle={() => toggleSection('raid')}
              badge={
                <div className="flex items-center gap-2">
                  {criticalRaids > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
                      {criticalRaids} {isPolish ? 'kryt.' : 'crit.'}
                    </span>
                  )}
                  <span className="text-xs text-slate-400">{raidItems.length}</span>
                </div>
              }
              actions={
                <div className="flex items-center gap-2">
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCreateRaid(true);
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 text-xs font-medium transition-all"
                  >
                    <Plus size={14} />
                    <span>{isPolish ? 'Dodaj' : 'Add'}</span>
                  </motion.button>
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGenerateAI('raid');
                    }}
                    disabled={isGeneratingAI === 'raid'}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-500/10 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 text-xs font-medium transition-all disabled:opacity-50"
                    title={isPolish ? 'AI zidentyfikuje ryzyka' : 'AI will identify risks'}
                  >
                    {isGeneratingAI === 'raid' ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Sparkles size={14} />
                    )}
                    <span>AI</span>
                  </motion.button>
                </div>
              }
            >
              {showCreateRaid && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 p-4 rounded-xl border-2 border-rose-300 dark:border-rose-500/50 bg-rose-50/30 dark:bg-rose-500/5 space-y-3"
                >
                  <input
                    type="text"
                    value={newRaidTitle}
                    onChange={(e) => setNewRaidTitle(e.target.value)}
                    placeholder={isPolish ? 'Tytuł...' : 'Title...'}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm"
                    autoFocus
                  />
                  <textarea
                    value={newRaidDescription}
                    onChange={(e) => setNewRaidDescription(e.target.value)}
                    placeholder={isPolish ? 'Opis (opcjonalnie)...' : 'Description (optional)...'}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm resize-none"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={newRaidType}
                      onChange={(e) => setNewRaidType(e.target.value as any)}
                      className="px-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm"
                    >
                      <option value="risk">{isPolish ? 'Ryzyko' : 'Risk'}</option>
                      <option value="assumption">{isPolish ? 'Założenie' : 'Assumption'}</option>
                      <option value="issue">{isPolish ? 'Problem' : 'Issue'}</option>
                      <option value="dependency">{isPolish ? 'Zależność' : 'Dependency'}</option>
                    </select>
                    <select
                      value={newRaidSeverity}
                      onChange={(e) => setNewRaidSeverity(e.target.value as any)}
                      className="px-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm"
                    >
                      <option value="LOW">{isPolish ? 'Niski' : 'Low'}</option>
                      <option value="MEDIUM">{isPolish ? 'Średni' : 'Medium'}</option>
                      <option value="HIGH">{isPolish ? 'Wysoki' : 'High'}</option>
                      <option value="CRITICAL">{isPolish ? 'Krytyczny' : 'Critical'}</option>
                    </select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowCreateRaid(false)}
                      className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700"
                    >
                      {isPolish ? 'Anuluj' : 'Cancel'}
                    </button>
                    <button
                      onClick={handleCreateRaid}
                      disabled={isMutating || !newRaidTitle.trim()}
                      className="px-3 py-1.5 text-xs bg-rose-500 text-white rounded-lg disabled:opacity-50"
                    >
                      {isPolish ? 'Utwórz' : 'Create'}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* RAID Summary */}
              {raidItems.length > 0 && (
                <div className="mb-4 grid grid-cols-4 gap-2">
                  {(['risk', 'assumption', 'issue', 'dependency'] as const).map((type) => {
                    const count = raidItems.filter((r) => r.type === type).length;
                    const config = RAID_TYPE_CONFIG[type];
                    return (
                      <div
                        key={type}
                        className={`p-2 rounded-lg text-center ${config.color.replace('text-', 'bg-').replace('/20', '/10')}`}
                      >
                        <div className="text-lg font-bold">{count}</div>
                        <div className="text-[10px] uppercase">
                          {isPolish ? config.labelPl : config.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {raidItems.length === 0 && !showCreateRaid ? (
                <div className="text-center py-6 border-2 border-dashed border-slate-200 dark:border-navy-700 rounded-xl">
                  <AlertTriangle
                    size={24}
                    className="mx-auto mb-2 text-slate-300 dark:text-slate-600"
                  />
                  <p className="text-sm text-slate-400">
                    {isPolish ? 'Brak elementów RAID' : 'No RAID items'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {raidItems.map((r) => (
                    <div
                      key={r.id}
                      className="p-3 rounded-lg bg-slate-50/50 dark:bg-navy-800/50 border border-slate-200/50 dark:border-navy-700/50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-medium ${RAID_TYPE_CONFIG[r.type].color}`}
                          >
                            {isPolish
                              ? RAID_TYPE_CONFIG[r.type].labelPl
                              : RAID_TYPE_CONFIG[r.type].label}
                          </span>
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            {r.title}
                          </span>
                        </div>
                        {r.severity && (
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded ${SEVERITY_CONFIG[r.severity].color}`}
                          >
                            {isPolish
                              ? SEVERITY_CONFIG[r.severity].labelPl
                              : SEVERITY_CONFIG[r.severity].label}
                          </span>
                        )}
                      </div>
                      {r.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {r.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CollapsibleSection>

            {/* 6. Gate Readiness & Timeline (Bramki i harmonogram) */}
            <CollapsibleSection
              id="gateReadiness"
              title={isPolish ? 'Gotowość bramki i harmonogram' : 'Gate Readiness & Timeline'}
              icon={<Flag size={18} className="text-indigo-500 dark:text-indigo-400" />}
              iconBg="bg-gradient-to-br from-indigo-500/10 to-violet-500/10 dark:from-indigo-500/20 dark:to-violet-500/20"
              expanded={expandedSections.has('gateReadiness')}
              onToggle={() => toggleSection('gateReadiness')}
              badge={
                <div className="flex items-center gap-2">
                  {nextGate && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                      {isPolish ? 'Następna' : 'Next'}: {nextGate}
                    </span>
                  )}
                  {requiredGates.length > 0 && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400">
                      {
                        requiredGates.filter((g) => getGateStatus(g.pmoDomain) === 'APPROVED')
                          .length
                      }
                      /{requiredGates.length}
                    </span>
                  )}
                </div>
              }
              actions={
                <div className="flex items-center gap-2">
                  {nextGateConfig && canRequestApproval && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRequestApproval(
                          nextGateConfig.requiredRole === 'owner' ? 'owner' : 'sponsor',
                          nextGate!
                        );
                      }}
                      disabled={isMutating}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 text-xs font-medium transition-all disabled:opacity-50"
                      title={isPolish ? 'Wyślij prośbę o zatwierdzenie' : 'Request approval'}
                    >
                      <Send size={14} />
                      <span>{isPolish ? 'Wyślij' : 'Request'}</span>
                    </motion.button>
                  )}
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGenerateAI('gates');
                    }}
                    disabled={isGeneratingAI === 'gates'}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-500/10 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 text-xs font-medium transition-all disabled:opacity-50"
                    title={isPolish ? 'AI przeanalizuje gotowość' : 'AI will analyze readiness'}
                  >
                    {isGeneratingAI === 'gates' ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Sparkles size={14} />
                    )}
                    <span>AI</span>
                  </motion.button>
                </div>
              }
            >
              {/* Gate Timeline Visual */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                    {isPolish ? 'Przebieg bramek' : 'Gate Timeline'}
                  </span>
                </div>

                {/* Timeline visualization */}
                <div className="relative">
                  {/* Progress line */}
                  <div className="absolute top-4 left-0 right-0 h-1 bg-slate-200 dark:bg-navy-700 rounded-full" />
                  <div
                    className="absolute top-4 left-0 h-1 bg-gradient-to-r from-emerald-500 to-purple-500 rounded-full transition-all duration-500"
                    style={{
                      width: `${(() => {
                        const gateOrder = [
                          'PROMOTE',
                          'APPROVE',
                          'SCHEDULE',
                          'COMPLETE',
                          'START_TRACKING',
                        ];
                        const currentIdx = nextGate
                          ? gateOrder.indexOf(nextGate)
                          : gateOrder.length;
                        return Math.max(0, (currentIdx / gateOrder.length) * 100);
                      })()}%`,
                    }}
                  />

                  {/* Gate nodes */}
                  <div className="relative flex justify-between">
                    {Object.entries(GATE_CONFIG)
                      .filter(([key]) => !['BLOCK', 'UNBLOCK'].includes(key))
                      .map(([key, config], idx, arr) => {
                        const isPast = (() => {
                          const gateOrder = [
                            'PROMOTE',
                            'APPROVE',
                            'SCHEDULE',
                            'COMPLETE',
                            'START_TRACKING',
                          ];
                          const currentIdx = nextGate
                            ? gateOrder.indexOf(nextGate)
                            : gateOrder.length;
                          return gateOrder.indexOf(key) < currentIdx;
                        })();
                        const isCurrent = key === nextGate;
                        const isFuture = !isPast && !isCurrent;

                        return (
                          <div
                            key={key}
                            className="flex flex-col items-center"
                            style={{ width: `${100 / arr.length}%` }}
                          >
                            <motion.div
                              initial={{ scale: 0.8 }}
                              animate={{ scale: isCurrent ? 1.2 : 1 }}
                              className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                                isPast
                                  ? 'bg-emerald-500 border-emerald-500 text-white'
                                  : isCurrent
                                    ? 'bg-purple-500 border-purple-500 text-white shadow-lg shadow-purple-500/40'
                                    : 'bg-white dark:bg-navy-800 border-slate-300 dark:border-navy-600 text-slate-400'
                              }`}
                            >
                              {isPast ? (
                                <Check size={14} />
                              ) : isCurrent ? (
                                <Flag size={14} />
                              ) : (
                                <span className="text-xs font-bold">{idx + 1}</span>
                              )}
                            </motion.div>
                            <div className={`mt-2 text-center ${isCurrent ? 'font-semibold' : ''}`}>
                              <p
                                className={`text-[10px] ${isPast ? 'text-emerald-500' : isCurrent ? 'text-purple-500' : 'text-slate-400'}`}
                              >
                                {isPolish ? config.namePl.split(' ')[0] : config.name.split(' ')[0]}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>

              {/* Current Gate Details */}
              {nextGateConfig && (
                <div className="mb-4 p-4 rounded-xl bg-gradient-to-br from-purple-500/5 to-indigo-500/5 dark:from-purple-500/10 dark:to-indigo-500/10 border border-purple-200/50 dark:border-purple-500/20">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-purple-500/20">
                        <Flag size={16} className="text-purple-500" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                          {isPolish ? 'Aktualna bramka' : 'Current Gate'}:{' '}
                          {isPolish ? nextGateConfig.namePl : nextGateConfig.name}
                        </h4>
                        <p className="text-xs text-slate-500">
                          {isPolish ? nextGateConfig.descriptionPl : nextGateConfig.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Requirements Checklist */}
                  <div className="space-y-2 mb-4">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase">
                      {isPolish ? 'Lista kontrolna wymagań' : 'Requirements Checklist'}
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {nextGateConfig.requirements.map((req) => {
                        const hasReq =
                          req === 'title'
                            ? !!initiative?.name
                            : req === 'problem'
                              ? !!summary
                              : req === 'owner'
                                ? !!ownerId
                                : req === 'sponsor'
                                  ? !!sponsorId
                                  : req === 'timeline'
                                    ? !!targetDate
                                    : req === 'team'
                                      ? stakeholders.length > 0
                                      : req === 'risks'
                                        ? raidItems.some((r) => r.type === 'risk')
                                        : req === 'objective'
                                          ? !!summary
                                          : req === 'scope'
                                            ? !!description
                                            : req === 'capacity'
                                              ? true // Would check team availability
                                              : req === 'dependencies'
                                                ? true // Would check dependencies mapped
                                                : req === 'all_tasks_done'
                                                  ? tasks.every((t) => t.status === 'DONE')
                                                  : req === 'delivery_confirmed'
                                                    ? false // Would check delivery confirmation
                                                    : req === 'baseline_kpis'
                                                      ? false // Would check KPIs defined
                                                      : req === 'tracking_period'
                                                        ? false // Would check tracking period
                                                        : req === 'blocked_reason'
                                                          ? false
                                                          : req === 'impact_assessment'
                                                            ? false
                                                            : req === 'resolution_decision'
                                                              ? false
                                                              : req === 'updated_timeline'
                                                                ? false
                                                                : true;

                        const reqLabels: Record<string, { en: string; pl: string }> = {
                          title: { en: 'Title defined', pl: 'Tytuł zdefiniowany' },
                          problem: { en: 'Problem statement', pl: 'Opis problemu' },
                          owner: { en: 'Owner assigned', pl: 'Właściciel przypisany' },
                          sponsor: { en: 'Sponsor assigned', pl: 'Sponsor przypisany' },
                          timeline: { en: 'Timeline set', pl: 'Harmonogram ustalony' },
                          team: { en: 'Team assigned', pl: 'Zespół przypisany' },
                          risks: { en: 'Risks identified', pl: 'Ryzyka zidentyfikowane' },
                          objective: { en: 'Objective defined', pl: 'Cel zdefiniowany' },
                          scope: { en: 'Scope defined', pl: 'Zakres zdefiniowany' },
                          capacity: { en: 'Capacity confirmed', pl: 'Zasoby potwierdzone' },
                          dependencies: { en: 'Dependencies mapped', pl: 'Zależności zmapowane' },
                          all_tasks_done: {
                            en: 'All tasks done',
                            pl: 'Wszystkie zadania ukończone',
                          },
                          delivery_confirmed: {
                            en: 'Delivery confirmed',
                            pl: 'Dostawa potwierdzona',
                          },
                          baseline_kpis: { en: 'Baseline KPIs', pl: 'Bazowe KPI' },
                          tracking_period: { en: 'Tracking period', pl: 'Okres śledzenia' },
                          blocked_reason: { en: 'Block reason', pl: 'Powód blokady' },
                          impact_assessment: { en: 'Impact assessment', pl: 'Ocena wpływu' },
                          resolution_decision: {
                            en: 'Resolution decision',
                            pl: 'Decyzja o rozwiązaniu',
                          },
                          updated_timeline: {
                            en: 'Updated timeline',
                            pl: 'Zaktualizowany harmonogram',
                          },
                        };

                        return (
                          <div
                            key={req}
                            className={`flex items-center gap-2 p-2 rounded-lg ${
                              hasReq
                                ? 'bg-emerald-500/10 border border-emerald-500/20'
                                : 'bg-slate-100 dark:bg-navy-800 border border-slate-200 dark:border-navy-700'
                            }`}
                          >
                            <div
                              className={`w-5 h-5 rounded-full flex items-center justify-center ${
                                hasReq ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-navy-600'
                              }`}
                            >
                              {hasReq ? (
                                <Check size={12} className="text-white" />
                              ) : (
                                <X size={12} className="text-white" />
                              )}
                            </div>
                            <span
                              className={`text-xs ${hasReq ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}
                            >
                              {isPolish ? reqLabels[req]?.pl : reqLabels[req]?.en || req}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Readiness Score */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-500">
                        {isPolish ? 'Gotowość' : 'Readiness'}
                      </span>
                      <span className="text-xs font-semibold text-purple-500">
                        {(() => {
                          const metCount = nextGateConfig.requirements.filter((req) => {
                            return req === 'title'
                              ? !!initiative?.name
                              : req === 'problem'
                                ? !!summary
                                : req === 'owner'
                                  ? !!ownerId
                                  : req === 'sponsor'
                                    ? !!sponsorId
                                    : req === 'timeline'
                                      ? !!targetDate
                                      : req === 'team'
                                        ? stakeholders.length > 0
                                        : req === 'risks'
                                          ? raidItems.some((r) => r.type === 'risk')
                                          : req === 'objective'
                                            ? !!summary
                                            : req === 'scope'
                                              ? !!description
                                              : req === 'all_tasks_done'
                                                ? tasks.every((t) => t.status === 'DONE')
                                                : false;
                          }).length;
                          return Math.round((metCount / nextGateConfig.requirements.length) * 100);
                        })()}
                        %
                      </span>
                    </div>
                    <div className="h-2 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: `${(() => {
                            const metCount = nextGateConfig.requirements.filter((req) => {
                              return req === 'title'
                                ? !!initiative?.name
                                : req === 'problem'
                                  ? !!summary
                                  : req === 'owner'
                                    ? !!ownerId
                                    : req === 'sponsor'
                                      ? !!sponsorId
                                      : req === 'timeline'
                                        ? !!targetDate
                                        : req === 'team'
                                          ? stakeholders.length > 0
                                          : req === 'risks'
                                            ? raidItems.some((r) => r.type === 'risk')
                                            : req === 'objective'
                                              ? !!summary
                                              : req === 'scope'
                                                ? !!description
                                                : req === 'all_tasks_done'
                                                  ? tasks.every((t) => t.status === 'DONE')
                                                  : false;
                            }).length;
                            return Math.round(
                              (metCount / nextGateConfig.requirements.length) * 100
                            );
                          })()}%`,
                        }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                        className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full"
                      />
                    </div>
                  </div>

                  {/* Approver Info */}
                  <div className="flex items-center justify-between p-2 rounded-lg bg-white/50 dark:bg-navy-900/50 border border-slate-200/50 dark:border-navy-700/50">
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-slate-400" />
                      <span className="text-xs text-slate-500">
                        {isPolish ? 'Wymagana aprobata' : 'Required approval'}:
                      </span>
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        {getRoleLabel(nextGateConfig.requiredRole, isPolish)}
                      </span>
                    </div>
                    {nextGateConfig.requiredRole === 'sponsor' && sponsorId && (
                      <span className="text-xs text-purple-500">
                        {getUserDisplayName(sponsorId)}
                      </span>
                    )}
                    {nextGateConfig.requiredRole === 'owner' && ownerId && (
                      <span className="text-xs text-purple-500">{getUserDisplayName(ownerId)}</span>
                    )}
                  </div>
                </div>
              )}

              {/* All Gates Status (Legacy gates from GATE_DEFINITIONS) */}
              {requiredGates.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase block mb-2">
                    {isPolish
                      ? 'Wymagane zatwierdzenia dla statusu'
                      : 'Required approvals for status'}
                  </span>
                  {requiredGates.map((g) => {
                    const gs = getGateStatus(g.pmoDomain);
                    const ok = gs === 'APPROVED';
                    return (
                      <div
                        key={g.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-slate-50/50 dark:bg-navy-800/50 border border-slate-200/50 dark:border-navy-700/50"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center ${
                              ok
                                ? 'bg-emerald-500'
                                : gs === 'PENDING'
                                  ? 'bg-amber-500'
                                  : 'bg-slate-300 dark:bg-navy-600'
                            }`}
                          >
                            {ok ? (
                              <Check size={12} className="text-white" />
                            ) : gs === 'PENDING' ? (
                              <Clock size={12} className="text-white" />
                            ) : (
                              <X size={12} className="text-white" />
                            )}
                          </div>
                          <span className="text-sm text-slate-700 dark:text-slate-300">
                            {g.label}
                          </span>
                        </div>
                        <span
                          className={`px-2 py-0.5 text-[10px] font-medium rounded ${
                            ok
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : gs === 'PENDING'
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-slate-500/20 text-slate-400'
                          }`}
                        >
                          {gs === 'MISSING' ? (isPolish ? 'Nie zgłoszono' : 'Not requested') : gs}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* No gates message */}
              {!nextGateConfig && requiredGates.length === 0 && (
                <div className="text-center py-6 border-2 border-dashed border-slate-200 dark:border-navy-700 rounded-xl">
                  <CheckCircle2 size={24} className="mx-auto mb-2 text-emerald-500" />
                  <p className="text-sm text-slate-500">
                    {isPolish ? 'Wszystkie bramki przejdzone!' : 'All gates passed!'}
                  </p>
                </div>
              )}
            </CollapsibleSection>

            {/* 7. Financial Analysis (Analiza finansowa) */}
            <CollapsibleSection
              id="financialAnalysis"
              title={isPolish ? 'Analiza finansowa' : 'Financial Analysis'}
              icon={<BarChart3 size={18} className="text-cyan-500 dark:text-cyan-400" />}
              iconBg="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 dark:from-cyan-500/20 dark:to-blue-500/20"
              expanded={expandedSections.has('financialAnalysis')}
              onToggle={() => toggleSection('financialAnalysis')}
              actions={
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleGenerateAI('financial');
                  }}
                  disabled={isGeneratingAI === 'financial'}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-500/10 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 text-xs font-medium transition-all disabled:opacity-50"
                  title={isPolish ? 'AI oszacuje koszty' : 'AI will estimate costs'}
                >
                  {isGeneratingAI === 'financial' ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  <span>AI</span>
                </motion.button>
              }
            >
              <div className="space-y-4">
                {/* Cost Breakdown */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-navy-800/80 border border-slate-200/50 dark:border-navy-700/50">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign size={14} className="text-blue-500" />
                      <span className="text-xs font-medium text-slate-500 uppercase">CAPEX</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-700 dark:text-white">
                      {initiative.costCapex || initiative.cost_capex
                        ? `$${(initiative.costCapex || initiative.cost_capex).toLocaleString()}`
                        : '-'}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {isPolish ? 'Nakłady inwestycyjne' : 'Capital expenditure'}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-navy-800/80 border border-slate-200/50 dark:border-navy-700/50">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign size={14} className="text-orange-500" />
                      <span className="text-xs font-medium text-slate-500 uppercase">OPEX</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-700 dark:text-white">
                      {initiative.costOpex || initiative.cost_opex
                        ? `$${(initiative.costOpex || initiative.cost_opex).toLocaleString()}`
                        : '-'}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {isPolish ? 'Koszty operacyjne' : 'Operating expenditure'}
                    </p>
                  </div>
                </div>

                {/* ROI & Payback */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-500/10 border border-emerald-200/50 dark:border-emerald-500/20 text-center">
                    <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase mb-1">
                      ROI
                    </div>
                    <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                      {initiative.expectedRoi || initiative.expected_roi
                        ? `${(initiative.expectedRoi || initiative.expected_roi).toFixed(1)}x`
                        : '-'}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-blue-50/80 dark:bg-blue-500/10 border border-blue-200/50 dark:border-blue-500/20 text-center">
                    <div className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase mb-1">
                      NPV
                    </div>
                    <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                      {initiative.npv ? `$${initiative.npv.toLocaleString()}` : '-'}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-purple-50/80 dark:bg-purple-500/10 border border-purple-200/50 dark:border-purple-500/20 text-center">
                    <div className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase mb-1">
                      {isPolish ? 'Zwrot' : 'Payback'}
                    </div>
                    <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                      {initiative.paybackMonths ? `${initiative.paybackMonths}m` : '-'}
                    </div>
                  </div>
                </div>
              </div>
            </CollapsibleSection>

            {/* 8. Financial Impact (Wpływ finansowy) */}
            <CollapsibleSection
              id="financialImpact"
              title={isPolish ? 'Wpływ na wynik finansowy' : 'Financial Impact'}
              icon={<TrendingUp size={18} className="text-emerald-500 dark:text-emerald-400" />}
              iconBg="bg-gradient-to-br from-emerald-500/10 to-green-500/10 dark:from-emerald-500/20 dark:to-green-500/20"
              expanded={expandedSections.has('financialImpact')}
              onToggle={() => toggleSection('financialImpact')}
            >
              <div className="space-y-4">
                {/* P&L Impact */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-500/10 dark:to-teal-500/10 border border-emerald-200/50 dark:border-emerald-500/20">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {isPolish ? 'Wpływ na P&L' : 'P&L Impact'}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-500">
                      {isPolish ? 'Prognoza' : 'Forecast'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
                        <TrendingUp size={12} className="text-emerald-500" />
                        {isPolish ? 'Przychody' : 'Revenue'}
                      </div>
                      <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                        {initiative.revenueImpact
                          ? `+$${initiative.revenueImpact.toLocaleString()}`
                          : '-'}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
                        <TrendingDown size={12} className="text-blue-500" />
                        {isPolish ? 'Oszczędności' : 'Cost Savings'}
                      </div>
                      <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        {initiative.costSavings
                          ? `$${initiative.costSavings.toLocaleString()}`
                          : '-'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Benefits Realization */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-500 uppercase">
                      {isPolish ? 'Realizacja korzyści' : 'Benefits Realization'}
                    </span>
                    <span className="text-xs text-slate-400">
                      {initiative.benefitsRealized || 0}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${initiative.benefitsRealized || 0}%` }}
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                    />
                  </div>
                </div>
              </div>
            </CollapsibleSection>

            {/* 9. Activity Log (Historia zmian) */}
            <CollapsibleSection
              id="history"
              title={isPolish ? 'Historia aktywności' : 'Activity Log'}
              icon={<History size={18} className="text-slate-500 dark:text-slate-400" />}
              iconBg="bg-gradient-to-br from-slate-500/10 to-gray-500/10 dark:from-slate-500/20 dark:to-gray-500/20"
              expanded={expandedSections.has('history')}
              onToggle={() => toggleSection('history')}
              badge={
                history.length > 0 ? (
                  <span className="text-xs text-slate-400">{history.length}</span>
                ) : undefined
              }
            >
              {history.length === 0 ? (
                <div className="text-sm text-slate-400">
                  {isPolish ? 'Brak historii.' : 'No history yet.'}
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {history.map((e, idx) => (
                    <div key={e.id} className="relative flex gap-3 pl-1">
                      {/* Timeline line */}
                      {idx < history.length - 1 && (
                        <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-slate-200 dark:bg-navy-700" />
                      )}
                      {/* Icon */}
                      <div className="relative z-10 flex-shrink-0 w-6 h-6 rounded-full bg-slate-400 dark:bg-slate-600 flex items-center justify-center">
                        <Clock size={12} className="text-white" />
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0 pb-3">
                        <p className="text-sm text-slate-700 dark:text-slate-300">{e.eventType}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {e.actorName && (
                            <span className="text-xs text-slate-500">{e.actorName}</span>
                          )}
                          <span className="text-xs text-slate-400">
                            {new Date(e.createdAt).toLocaleString(isPolish ? 'pl-PL' : 'en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CollapsibleSection>
          </div>

          {/* RIGHT COLUMN - Control/Metrics (1/3) */}
          <div className="lg:col-span-1 space-y-4 order-1 lg:order-2">
            {/* 1. Gate Alert Banner (warunkowo) */}
            {pendingGates.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20 border border-amber-300/50 dark:border-amber-500/30"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-500/20">
                    <AlertTriangle size={18} className="text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                      {isPolish ? 'Wymagana decyzja bramkowa' : 'Gate decision required'}
                    </p>
                    <p className="text-xs text-amber-600/80 dark:text-amber-400/80">
                      {pendingGates.map((g) => g.label).join(', ')}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 2. Control Panel */}
            <CollapsibleSection
              id="control"
              title={isPolish ? 'Sterowanie' : 'Control'}
              icon={<Layers size={18} className="text-purple-500 dark:text-purple-400" />}
              iconBg="bg-gradient-to-br from-purple-500/10 to-pink-500/10 dark:from-purple-500/20 dark:to-pink-500/20"
              expanded={expandedSections.has('control')}
              onToggle={() => toggleSection('control')}
            >
              <div className="space-y-4">
                {/* Module & Status - Combined header */}
                <div className="p-3 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-navy-800 dark:to-navy-900/50 border border-slate-200/80 dark:border-navy-700/80">
                  {/* Module */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      {isPolish ? 'Aktualny moduł' : 'Current Module'}
                    </span>
                    <a
                      href={moduleConfig.route}
                      className="text-[10px] text-purple-500 hover:text-purple-600 font-medium"
                    >
                      {isPolish ? 'Przejdź →' : 'Go to →'}
                    </a>
                  </div>
                  <div
                    className={`flex items-center gap-3 p-3 rounded-lg ${moduleConfig.bgLight} border border-slate-200/50 dark:border-navy-600/50 mb-3`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl ${moduleConfig.bgLight} flex items-center justify-center`}
                    >
                      <div className={`w-3 h-3 rounded-full ${moduleConfig.color}`} />
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${moduleConfig.textColor}`}>
                        {isPolish ? moduleConfig.labelPl : moduleConfig.label}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {isPolish ? moduleConfig.descriptionPl : moduleConfig.description}
                      </p>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Status
                    </span>
                  </div>
                  <div
                    className={`flex items-center gap-3 p-3 rounded-lg ${statusMeta.bgColor} border border-slate-200/50 dark:border-navy-600/50`}
                  >
                    <div
                      className={`w-3 h-3 rounded-full ${statusMeta.dotColor || statusMeta.color || 'bg-slate-400'} animate-pulse`}
                    />
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${statusMeta.color}`}>
                        {statusMeta.label}
                      </p>
                      {statusMeta.description && (
                        <p className="text-[10px] text-slate-400">{statusMeta.description}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Priority */}
                <div className="relative">
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                    {isPolish ? 'Priorytet' : 'Priority'}
                  </label>
                  <button
                    onClick={() => setShowPriorityDropdown(!showPriorityDropdown)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 hover:border-purple-300 dark:hover:border-purple-500/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Flag size={14} className={priorityConfig.color} />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {isPolish ? priorityConfig.labelPl : priorityConfig.label}
                      </span>
                    </div>
                    <ChevronDown size={16} className="text-slate-400" />
                  </button>
                  <AnimatePresence>
                    {showPriorityDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-navy-800 rounded-lg shadow-xl border border-slate-200 dark:border-navy-600 py-1"
                      >
                        {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                          <button
                            key={key}
                            onClick={() => {
                              setPriority(key as keyof typeof PRIORITY_CONFIG);
                              setShowPriorityDropdown(false);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors ${
                              priority === key ? 'bg-purple-50 dark:bg-purple-500/10' : ''
                            }`}
                          >
                            <Flag size={14} className={config.color} />
                            <span className="text-slate-700 dark:text-slate-300">
                              {isPolish ? config.labelPl : config.label}
                            </span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Target Date */}
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                    {isPolish ? 'Data docelowa' : 'Target Date'}
                  </label>
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600">
                    <Calendar size={14} className="text-slate-400" />
                    <input
                      type="date"
                      value={targetDate}
                      onChange={(e) => setTargetDate(e.target.value)}
                      className="flex-1 bg-transparent text-sm text-slate-700 dark:text-slate-300 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-navy-700">
                  <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-navy-800/80 border border-slate-200/50 dark:border-navy-700/50">
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                      <CheckSquare size={12} />
                      <span>{isPolish ? 'Zadania' : 'Tasks'}</span>
                    </div>
                    <div className="text-lg font-bold text-slate-700 dark:text-white">
                      {tasksDone}/{tasks.length}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-navy-800/80 border border-slate-200/50 dark:border-navy-700/50">
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                      <Scale size={12} />
                      <span>{isPolish ? 'Decyzje' : 'Decisions'}</span>
                    </div>
                    <div className="text-lg font-bold text-slate-700 dark:text-white">
                      {decisions.filter((d) => d.status === 'APPROVED').length}/{decisions.length}
                    </div>
                  </div>
                </div>

                {/* RAID Alert */}
                {criticalRaids > 0 && (
                  <div className="p-3 rounded-xl bg-red-50/80 dark:bg-red-500/10 border border-red-200/50 dark:border-red-500/20">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={14} className="text-red-500" />
                      <span className="text-sm font-medium text-red-600 dark:text-red-400">
                        {criticalRaids} {isPolish ? 'krytycznych RAID' : 'critical RAID'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Approval Workflow Section */}
                <div className="pt-3 border-t border-slate-200 dark:border-navy-700">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20">
                        <Send size={14} className="text-amber-500" />
                      </div>
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">
                        {isPolish ? 'Workflow zatwierdzania' : 'Approval Workflow'}
                      </span>
                    </div>
                    <button
                      onClick={() => setShowApprovalWorkflow(!showApprovalWorkflow)}
                      className="text-xs text-purple-500 hover:text-purple-600 font-medium"
                    >
                      {showApprovalWorkflow
                        ? isPolish
                          ? 'Zwiń'
                          : 'Collapse'
                        : isPolish
                          ? 'Rozwiń'
                          : 'Expand'}
                    </button>
                  </div>

                  {/* Pending Approvals */}
                  {hasPendingApproval && (
                    <div className="mb-3 space-y-2">
                      {pendingApprovals.map((approval) => (
                        <motion.div
                          key={approval.id}
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-3 rounded-xl bg-amber-50/80 dark:bg-amber-500/10 border border-amber-200/50 dark:border-amber-500/20"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Clock size={12} className="text-amber-500" />
                                <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                                  {isPolish ? 'Oczekuje na zatwierdzenie' : 'Awaiting Approval'}
                                </span>
                              </div>
                              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                {approval.gateName}
                              </p>
                              <p className="text-xs text-slate-500 mt-1">
                                {getRoleLabel(approval.requiredRole, isPolish)}:{' '}
                                {approval.deciderName || '-'}
                              </p>
                              {approval.dueDate && (
                                <p className="text-xs text-slate-400 mt-1">
                                  {isPolish ? 'Termin' : 'Due'}:{' '}
                                  {new Date(approval.dueDate).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => onOpenDecision?.(approval.id)}
                              className="px-2 py-1 text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/20 rounded-lg transition-colors"
                            >
                              {isPolish ? 'Zobacz' : 'View'}
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {/* Next Gate Info & Request Button */}
                  {nextGateConfig && (
                    <AnimatePresence>
                      {showApprovalWorkflow && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-navy-800/80 border border-slate-200/50 dark:border-navy-700/50 mb-3">
                            <div className="flex items-center gap-2 mb-2">
                              <Flag size={14} className="text-purple-500" />
                              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                {isPolish ? 'Następna bramka' : 'Next Gate'}:{' '}
                                {isPolish ? nextGateConfig.namePl : nextGateConfig.name}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                              {isPolish ? nextGateConfig.descriptionPl : nextGateConfig.description}
                            </p>

                            {/* Requirements checklist */}
                            <div className="space-y-1.5 mb-3">
                              <span className="text-[10px] font-semibold text-slate-500 uppercase">
                                {isPolish ? 'Wymagania' : 'Requirements'}
                              </span>
                              {nextGateConfig.requirements.map((req) => {
                                const hasReq =
                                  req === 'title'
                                    ? !!initiative?.name
                                    : req === 'owner'
                                      ? !!ownerId
                                      : req === 'sponsor'
                                        ? !!sponsorId
                                        : req === 'timeline'
                                          ? !!targetDate
                                          : req === 'risks'
                                            ? raidItems.some((r) => r.type === 'risk')
                                            : req === 'all_tasks_done'
                                              ? tasks.every((t) => t.status === 'DONE')
                                              : true; // Default to true for unknown requirements
                                return (
                                  <div key={req} className="flex items-center gap-2">
                                    <div
                                      className={`w-4 h-4 rounded-full flex items-center justify-center ${hasReq ? 'bg-emerald-500/20' : 'bg-slate-200 dark:bg-navy-700'}`}
                                    >
                                      {hasReq ? (
                                        <Check size={10} className="text-emerald-500" />
                                      ) : (
                                        <X size={10} className="text-slate-400" />
                                      )}
                                    </div>
                                    <span
                                      className={`text-xs ${hasReq ? 'text-slate-600 dark:text-slate-400' : 'text-slate-400'}`}
                                    >
                                      {req
                                        .replace(/_/g, ' ')
                                        .replace(/\b\w/g, (l) => l.toUpperCase())}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Approver selection */}
                            <div className="mb-3">
                              <span className="text-[10px] font-semibold text-slate-500 uppercase block mb-1.5">
                                {isPolish ? 'Wymagana aprobata' : 'Required Approval'}
                              </span>
                              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600">
                                <User size={14} className="text-slate-400" />
                                <span className="text-sm text-slate-700 dark:text-slate-300">
                                  {getRoleLabel(nextGateConfig.requiredRole, isPolish)}
                                </span>
                                {nextGateConfig.requiredRole === 'sponsor' && sponsorId && (
                                  <span className="text-xs text-slate-400 ml-auto">
                                    {getUserDisplayName(sponsorId)}
                                  </span>
                                )}
                                {nextGateConfig.requiredRole === 'owner' && ownerId && (
                                  <span className="text-xs text-slate-400 ml-auto">
                                    {getUserDisplayName(ownerId)}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Request Approval Button */}
                            {canRequestApproval && (
                              <button
                                onClick={() =>
                                  handleRequestApproval(
                                    nextGateConfig.requiredRole === 'owner' ? 'owner' : 'sponsor',
                                    nextGate!
                                  )
                                }
                                disabled={
                                  isMutating ||
                                  (nextGateConfig.requiredRole === 'sponsor' && !sponsorId) ||
                                  (nextGateConfig.requiredRole === 'owner' && !ownerId)
                                }
                                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white text-sm font-semibold shadow-lg shadow-amber-500/30 disabled:opacity-50 transition-all"
                              >
                                <Send size={14} />
                                <span>
                                  {isPolish ? 'Wyślij prośbę o zatwierdzenie' : 'Request Approval'}
                                </span>
                              </button>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  )}

                  {/* No next gate - terminal status */}
                  {!nextGateConfig && !['ARCHIVED', 'CANCELLED'].includes(status) && (
                    <div className="p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-500/10 border border-emerald-200/50 dark:border-emerald-500/20">
                      <div className="flex items-center gap-2">
                        <Check size={14} className="text-emerald-500" />
                        <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                          {isPolish ? 'Brak oczekujących bramek' : 'No pending gates'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Status Actions */}
                {primaryActions.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-navy-700">
                    {primaryActions.map((a) => (
                      <button
                        key={a.targetStatus}
                        onClick={() => handleStatusAction(a)}
                        disabled={isMutating}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white text-sm font-semibold shadow-lg shadow-purple-500/30 disabled:opacity-50 transition-all"
                      >
                        <span>{a.label}</span>
                        <ArrowRight size={16} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </CollapsibleSection>

            {/* 3. Team - Role descriptions */}
            <CollapsibleSection
              id="team"
              title={isPolish ? 'Zespół' : 'Team'}
              icon={<Users size={18} className="text-indigo-500 dark:text-indigo-400" />}
              iconBg="bg-gradient-to-br from-indigo-500/10 to-violet-500/10 dark:from-indigo-500/20 dark:to-violet-500/20"
              expanded={expandedSections.has('team')}
              onToggle={() => toggleSection('team')}
            >
              <div className="space-y-4">
                {/* Owner */}
                <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-navy-800/80 border border-slate-200/50 dark:border-navy-700/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-blue-500/10">
                        <User size={14} className="text-blue-500" />
                      </div>
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">
                        {isPolish ? 'Właściciel' : 'Owner'}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                    {isPolish
                      ? 'Odpowiada za realizację inicjatywy, podejmuje decyzje operacyjne i raportuje postępy.'
                      : 'Responsible for initiative delivery, makes operational decisions and reports progress.'}
                  </p>
                  <select
                    value={ownerId}
                    onChange={(e) => setOwnerId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-400"
                  >
                    <option value="">
                      {isPolish ? 'Wybierz właściciela...' : 'Select owner...'}
                    </option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.firstName} {user.lastName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sponsor */}
                <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-navy-800/80 border border-slate-200/50 dark:border-navy-700/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-purple-500/10">
                        <Target size={14} className="text-purple-500" />
                      </div>
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">
                        Sponsor
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                    {isPolish
                      ? 'Sponsor biznesowy, zapewnia zasoby i wsparcie, usuwa przeszkody organizacyjne.'
                      : 'Business sponsor, provides resources and support, removes organizational obstacles.'}
                  </p>
                  <select
                    value={sponsorId}
                    onChange={(e) => setSponsorId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-purple-400"
                  >
                    <option value="">
                      {isPolish ? 'Wybierz sponsora...' : 'Select sponsor...'}
                    </option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.firstName} {user.lastName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quick team summary */}
                {(ownerName || sponsorName) && (
                  <div className="pt-3 border-t border-slate-200 dark:border-navy-700">
                    <div className="flex items-center gap-4 text-xs">
                      {ownerName && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <User size={12} className="text-blue-500" />
                          </div>
                          <span className="text-slate-600 dark:text-slate-400">{ownerName}</span>
                        </div>
                      )}
                      {sponsorName && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center">
                            <Target size={12} className="text-purple-500" />
                          </div>
                          <span className="text-slate-600 dark:text-slate-400">{sponsorName}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleSection>

            {/* 4. Timeline */}
            <CollapsibleSection
              id="timeline"
              title={isPolish ? 'Harmonogram' : 'Timeline'}
              icon={<Calendar size={18} className="text-cyan-500 dark:text-cyan-400" />}
              iconBg="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 dark:from-cyan-500/20 dark:to-blue-500/20"
              expanded={expandedSections.has('timeline')}
              onToggle={() => toggleSection('timeline')}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    {isPolish ? 'Data startu' : 'Start Date'}
                  </span>
                  <span className="text-sm text-slate-700 dark:text-white">
                    {initiative.plannedStartDate
                      ? new Date(initiative.plannedStartDate).toLocaleDateString()
                      : '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    {isPolish ? 'Data końca' : 'End Date'}
                  </span>
                  <span className="text-sm text-slate-700 dark:text-white">
                    {initiative.plannedEndDate
                      ? new Date(initiative.plannedEndDate).toLocaleDateString()
                      : '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    {isPolish ? 'Kwartał docelowy' : 'Target Quarter'}
                  </span>
                  <span className="text-sm text-slate-700 dark:text-white">
                    {initiative.targetQuarter || '-'}
                  </span>
                </div>
                {initiative.plannedStartDate && initiative.plannedEndDate && (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-navy-700">
                    <span className="text-xs text-slate-500">
                      {isPolish ? 'Czas trwania' : 'Duration'}
                    </span>
                    <span className="text-sm font-medium text-slate-700 dark:text-white">
                      {Math.ceil(
                        (new Date(initiative.plannedEndDate).getTime() -
                          new Date(initiative.plannedStartDate).getTime()) /
                          (1000 * 60 * 60 * 24)
                      )}{' '}
                      {isPolish ? 'dni' : 'days'}
                    </span>
                  </div>
                )}
              </div>
            </CollapsibleSection>

            {/* 4. Attachments */}
            <AttachmentsSection
              attachments={attachments}
              onUpload={async (files) => {
                const newAttachments: Attachment[] = Array.from(files).map((f) => ({
                  id: Math.random().toString(36).substr(2, 9),
                  name: f.name,
                  type: f.type,
                  size: f.size,
                  url: URL.createObjectURL(f),
                  uploadedAt: new Date().toISOString(),
                }));
                setAttachments((prev) => [...prev, ...newAttachments]);
                toast.success(isPolish ? 'Załączniki dodane' : 'Attachments added');
              }}
              onDelete={async (id) => {
                setAttachments((prev) => prev.filter((a) => a.id !== id));
                toast.success(isPolish ? 'Załącznik usunięty' : 'Attachment removed');
              }}
              expanded={expandedSections.has('attachments')}
              onToggleExpand={() => toggleSection('attachments')}
            />

            {/* 5. Linked Items */}
            <LinkedItemsSection
              items={linkedItems}
              onAdd={async (item) => {
                setLinkedItems((prev) => [
                  ...prev,
                  { ...item, id: Math.random().toString(36).substr(2, 9) },
                ]);
                toast.success(isPolish ? 'Element powiązany' : 'Item linked');
              }}
              onRemove={async (id) => {
                setLinkedItems((prev) => prev.filter((i) => i.id !== id));
                toast.success(isPolish ? 'Powiązanie usunięte' : 'Link removed');
              }}
              searchItems={async (query) => {
                const results: LinkedItem[] = [];
                try {
                  const ts = await Api.get(`/tasks?search=${query}`);
                  (Array.isArray(ts) ? ts : ts?.tasks || []).slice(0, 5).forEach((t: any) => {
                    results.push({ id: t.id, type: 'task', title: t.title, status: t.status });
                  });
                } catch {}
                try {
                  const ds = await Api.get(`/decisions?search=${query}`);
                  (Array.isArray(ds) ? ds : ds?.decisions || []).slice(0, 5).forEach((d: any) => {
                    results.push({ id: d.id, type: 'decision', title: d.title, status: d.status });
                  });
                } catch {}
                return results;
              }}
              expanded={expandedSections.has('linkedItems')}
              onToggleExpand={() => toggleSection('linkedItems')}
            />

            {/* 6. Stakeholders (RACI) */}
            <StakeholdersSection
              stakeholders={stakeholders}
              availableUsers={users.map((u) => ({
                id: u.id,
                name: `${u.firstName} ${u.lastName}`,
                email: u.email,
              }))}
              onAdd={(
                userId: string,
                role: StakeholderRole,
                notificationSettings: StakeholderNotificationSettings
              ) => {
                const user = users.find((u) => u.id === userId);
                const newStakeholder: Stakeholder = {
                  id: Math.random().toString(36).substr(2, 9),
                  decisionId: initiativeId,
                  userId,
                  userName: user ? `${user.firstName} ${user.lastName}` : undefined,
                  userEmail: user?.email,
                  role,
                  notificationSettings,
                };
                setStakeholders([...stakeholders, newStakeholder]);
                toast.success(isPolish ? 'Dodano interesariusza' : 'Stakeholder added');
              }}
              onUpdate={(id: string, updates: Partial<Stakeholder>) => {
                setStakeholders(stakeholders.map((s) => (s.id === id ? { ...s, ...updates } : s)));
              }}
              onRemove={(id: string) => {
                setStakeholders(stakeholders.filter((s) => s.id !== id));
                toast.success(isPolish ? 'Usunięto interesariusza' : 'Stakeholder removed');
              }}
            />

            {/* 7. Reminders & Escalation */}
            <EscalationRulesSection
              reminders={reminders}
              escalation={escalation}
              thresholds={thresholds}
              availableUsers={users.map((u) => ({
                id: u.id,
                name: `${u.firstName} ${u.lastName}`,
              }))}
              onRemindersChange={setReminders}
              onEscalationChange={setEscalation}
              onThresholdsChange={setThresholds}
              dueDate={initiative?.plannedEndDate || ''}
            />

            {/* 8. Tags */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.18 }}
              className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden"
            >
              <motion.button
                whileHover={{ backgroundColor: 'rgba(148, 163, 184, 0.1)' }}
                whileTap={{ scale: 0.98 }}
                onClick={() => toggleSection('tags')}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-pink-500/10 to-rose-500/10 dark:from-pink-500/20 dark:to-rose-500/20">
                    <Tag size={18} className="text-pink-500 dark:text-pink-400" />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {isPolish ? 'Tagi' : 'Tags'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {tags.length > 0 && (
                    <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                      {tags.length}
                    </span>
                  )}
                  <motion.div
                    animate={{ rotate: expandedSections.has('tags') ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown size={18} className="text-slate-400" />
                  </motion.div>
                </div>
              </motion.button>

              <AnimatePresence>
                {expandedSections.has('tags') && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="border-t border-slate-200 dark:border-navy-700 overflow-hidden"
                  >
                    <div className="p-4">
                      <div className="flex flex-wrap gap-2 mb-3">
                        {tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-pink-100 dark:bg-pink-500/20 text-pink-700 dark:text-pink-300"
                          >
                            {tag}
                            <button
                              onClick={() => setTags(tags.filter((t) => t !== tag))}
                              className="hover:text-pink-900 dark:hover:text-pink-100"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newTag.trim()) {
                              setTags([...tags, newTag.trim()]);
                              setNewTag('');
                            }
                          }}
                          placeholder={isPolish ? 'Nowy tag...' : 'New tag...'}
                          className="flex-1 px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:border-pink-400"
                        />
                        <button
                          onClick={() => {
                            if (newTag.trim()) {
                              setTags([...tags, newTag.trim()]);
                              setNewTag('');
                            }
                          }}
                          disabled={!newTag.trim()}
                          className="px-3 py-2 rounded-lg text-sm font-medium text-pink-600 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-500/10 border border-pink-200 dark:border-pink-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* 9. Dependencies */}
            <DependenciesSection
              dependencies={dependencies}
              onAdd={(type) => {
                const newDep: TaskDependency = {
                  id: Math.random().toString(36).substr(2, 9),
                  taskId: '',
                  taskTitle: isPolish ? 'Nowa zależność' : 'New dependency',
                  type,
                };
                setDependencies([...dependencies, newDep]);
              }}
              onRemove={(id) => setDependencies(dependencies.filter((d) => d.id !== id))}
              expanded={expandedSections.has('dependencies')}
              onToggleExpand={() => toggleSection('dependencies')}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default InitiativeDocumentView;
