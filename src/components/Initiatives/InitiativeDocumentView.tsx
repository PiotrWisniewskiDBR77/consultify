/**
 * InitiativeDocumentView - Dynamic Section Renderer
 *
 * Refactored from a 3500-line monolith into a dynamic renderer that:
 * 1. Loads section types from the API (initiative_section_types table)
 * 2. Reads the template's visible_sections to determine which sections to show
 * 3. Renders sections dynamically using the Section Registry
 *
 * All section components live in ./sections/ and consume the InitiativeContext.
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Archive,
  Calendar,
  CheckSquare,
  ChevronLeft,
  Copy,
  Crosshair,
  DollarSign,
  Download,
  ExternalLink,
  FileCode,
  FolderOpen,
  GitBranch,
  History,
  Link2,
  ListChecks,
  Loader2,
  MessageSquare,
  Paperclip,
  Play,
  Plus,
  Save,
  Scale,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Undo2,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { usePresentationMode } from '@/hooks/usePresentationMode';
import { Api } from '@/services/api';
import { getContextActions, getModuleForStatus, getStatusActions, getStatusMeta, StatusAction, willChangeModule } from '@/services/initiativeLifecycle';
import { useAppStore } from '@/store/useAppStore';
import { useConversationStore } from '@/store/useConversationStore';
import { AppView } from '@/types';
import { buildArtifactCode, buildArtifactPermalink } from '@/utils/artifactLinks';

import { INITIATIVE_STATUS_METADATA, InitiativeStatus } from '../../types';
import {
  type Attachment,
  type Comment,
  type EscalationRule,
  type LinkedItem,
  type ReminderRule,
  type Stakeholder,
  type StakeholderNotificationSettings,
  type StakeholderRole,
  type TaskDependency,
  type WarningThresholds,
} from '../MyWork/shared';
import { AIFieldEnhancer } from '../shared/AIFieldEnhancer';
import { ArtifactPermalinkButton } from '../shared/ArtifactPermalinkButton';
import {
  NModeCanvas,
  NModeHeader,
  NModeLeftNav,
  NModePropertiesStrip,
  type NModeAction,
  type NModePropertyField,
  type NModeSection,
} from '../shared/NModeLayout';
import { type RowAction, RowActionsMenu } from '../shared/RowActionsMenu';
import { InitiativeScrollView } from './InitiativeScrollView';
import {
  DEFAULT_SECTION_ORDER,
  DEFAULT_VISIBLE_SECTIONS,
  GATE_CONFIG,
  GATE_DEFINITIONS,
  getModuleFromStatus,
  getNextGateForStatus,
  InitiativeContext,
  MODULE_CONFIG,
  SECTION_REGISTRY,
} from './sections';
import type {
  Decision,
  HistoryEvent,
  PendingApproval,
  RaidItem,
  SectionTypeInfo,
  TaskItem,
  UserInfo,
  Watcher,
} from './sections/types';

interface InitiativeDocumentViewProps {
  initiativeId: string;
  onBack?: () => void;
  onStatusChange?: (newStatus: string) => void;
  sourceModule?: 'tools' | 'assessment' | 'initiatives' | 'execution' | 'benefits';
  onOpenTask?: (taskId: string) => void;
  onOpenDecision?: (decisionId: string) => void;
}

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

  // ==========================================
  // STATE
  // ==========================================

  // Core state
  const [initiative, setInitiative] = useState<any | null>(null);
  const [initiativeTemplate, setInitiativeTemplate] = useState<any | null>(null);
  const [sectionTypes, setSectionTypes] = useState<SectionTypeInfo[]>([]);
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
  // Problem definition fields (structured)
  const [symptomDraft, setSymptomDraft] = useState('');
  const [rootCauseDraft, setRootCauseDraft] = useState('');
  const [costOfInactionDraft, setCostOfInactionDraft] = useState('');
  const [marketContextDraft, setMarketContextDraft] = useState('');
  // Target state description
  const [targetDescriptionDraft, setTargetDescriptionDraft] = useState('');
  // Success criteria fields (checklist-style)
  const [targetStateItems, setTargetStateItems] = useState<{ id: string; text: string; done: boolean }[]>([]);
  const [successCriteriaItems, setSuccessCriteriaItems] = useState<{ id: string; text: string; done: boolean }[]>([]);
  const [deliverableItems, setDeliverableItems] = useState<{ id: string; text: string; done: boolean }[]>([]);
  // Scope & boundaries fields
  const [inScopeItems, setInScopeItems] = useState<string[]>([]);
  const [outScopeItems, setOutScopeItems] = useState<string[]>([]);
  const [killCriteriaItems, setKillCriteriaItems] = useState<string[]>([]);
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
  const [users, setUsers] = useState<UserInfo[]>([]);

  // Control fields
  const [priority, setPriority] = useState<string>('medium');
  const [ownerId, setOwnerId] = useState('');
  const [sponsorId, setSponsorId] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  // Presentation mode (N/C) — shared hook with URL sync and localStorage persistence
  const { mode: presentationMode, setMode: setPresentationMode } = usePresentationMode({
    entityType: 'initiative',
    syncURL: true,
  });

  // C-mode layout variant (cards = accordion grid, scroll = single column)
  const cModeLayout = 'cards' as const;
  const [showAssessmentPanel, setShowAssessmentPanel] = useState(false);
  const [activeNSection, setActiveNSection] = useState<string>('description-context');
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
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [demoDataInjected, setDemoDataInjected] = useState(false);

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

  const currentUser = useAppStore((s) => s.currentUser);
  const currentUserId = currentUser?.id || 'current-user';

  // ==========================================
  // COMPUTED VALUES
  // ==========================================

  const status = (initiative?.status || 'DRAFT') as InitiativeStatus;
  const statusMeta = getStatusMeta(status);
  const statusActions = getStatusActions(status);
  const primaryActions = statusActions.filter((a) => a.variant === 'primary').slice(0, 2);
  const contextActions = getContextActions(status);
  const currentModule = getModuleFromStatus(status);
  const moduleConfig = MODULE_CONFIG[currentModule];

  const toggleSection = useCallback((id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

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

  const isWatching = useMemo(
    () => watchers.some((w) => w.userId === currentUserId),
    [watchers, currentUserId]
  );

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

  // ==========================================
  // VISIBLE SECTIONS (template-driven)
  // ==========================================

  const visibleSections = useMemo(() => {
    const templateVS = initiativeTemplate?.visibleSections || {};
    // Merge: template overrides defaults
    return { ...DEFAULT_VISIBLE_SECTIONS, ...templateVS };
  }, [initiativeTemplate]);

  const sectionOrder = useMemo(() => {
    const templateOrder = initiativeTemplate?.sectionOrder || {};
    return { ...DEFAULT_SECTION_ORDER, ...templateOrder };
  }, [initiativeTemplate]);

  // Resolve which sections to render, split by column
  const { leftSections, rightSections } = useMemo(() => {
    // If we have section types from the API, use them; otherwise fall back to defaults
    const resolvedTypes: SectionTypeInfo[] =
      sectionTypes.length > 0
        ? sectionTypes
        : Object.keys(DEFAULT_VISIBLE_SECTIONS).map((key) => ({
            id: `default-${key}`,
            key,
            name: key,
            namePl: null,
            description: null,
            descriptionPl: null,
            category: 'content' as const,
            columnPosition: (DEFAULT_SECTION_ORDER[key] !== undefined &&
            [
              'control',
              'team',
              'timeline',
              'resources',
              'stakeholders',
              'dependencies',
              'attachments',
              'linkedItems',
              'tags',
              'reminders',
              'watchers',
            ].includes(key)
              ? 'right'
              : 'left') as 'left' | 'right',
            defaultOrder: DEFAULT_SECTION_ORDER[key] || 100,
            icon: null,
            iconColor: null,
            iconBg: null,
            componentKey: key,
            isSystem: true,
            isActive: true,
          }));

    const visible = resolvedTypes.filter((st) => {
      const key = st.key;
      return visibleSections[key] !== false && SECTION_REGISTRY[st.componentKey];
    });

    const left = visible
      .filter((st) => st.columnPosition === 'left')
      .sort(
        (a, b) => (sectionOrder[a.key] ?? a.defaultOrder) - (sectionOrder[b.key] ?? b.defaultOrder)
      );

    const right = visible
      .filter((st) => st.columnPosition === 'right')
      .sort(
        (a, b) => (sectionOrder[a.key] ?? a.defaultOrder) - (sectionOrder[b.key] ?? b.defaultOrder)
      );

    return { leftSections: left, rightSections: right };
  }, [sectionTypes, visibleSections, sectionOrder]);

  // ==========================================
  // DATA FETCHING
  // ==========================================

  const fetchAll = useCallback(async () => {
    if (!initiativeId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await Api.getInitiativeById(initiativeId);
      setInitiative(data);
      setInitiativeTemplate(null);
      setSummary(data.summary || data.description || '');
      setDescription(data.description || '');
      // Sync problem definition fields — try structured object first, then parse JSON string
      let pd: Record<string, string> = {};
      const rawPd = data.problemDefinition || data.problem_definition || data.problemStatement || data.problem_statement;
      if (rawPd && typeof rawPd === 'object') {
        pd = rawPd;
      } else if (rawPd && typeof rawPd === 'string') {
        try {
          const parsed = JSON.parse(rawPd);
          if (typeof parsed === 'object' && parsed !== null) {
            pd = parsed;
          }
        } catch {
          // Not JSON — treat as plain text problem statement (legacy)
          pd = { symptom: rawPd };
        }
      }
      setSymptomDraft(pd.symptom || '');
      setRootCauseDraft(pd.rootCause || '');
      setCostOfInactionDraft(pd.costOfInaction || '');
      setMarketContextDraft(data.marketContext || '');
      // Sync success criteria fields
      const td = data.targetState || data.target_state || {};
      if (typeof td === 'object' && td !== null) {
        const tsDesc = td.description || '';
        setTargetDescriptionDraft(tsDesc);
        if (tsDesc) {
          const tsLines = tsDesc.split('\n').filter((l: string) => l.trim());
          setTargetStateItems(tsLines.length > 0
            ? tsLines.map((t: string, i: number) => ({ id: `ts-${i}`, text: t.replace(/^[-•*]\s*/, ''), done: false }))
            : [{ id: 'ts-0', text: tsDesc, done: false }]);
        }
        const sc = td.successCriteria || [];
        setSuccessCriteriaItems(sc.map((t: string, i: number) => ({ id: `sc-${i}`, text: t, done: false })));
        const dl = td.deliverables || data.deliverables || [];
        setDeliverableItems(dl.map((t: string, i: number) => ({ id: `dl-${i}`, text: t, done: false })));
      }
      setTags(data.tags || []);
      // Sync scope & boundaries fields
      const scopeObj = data.scope || {};
      if (typeof scopeObj === 'object') {
        setInScopeItems(scopeObj.inScope || []);
        setOutScopeItems(scopeObj.outScope || []);
      }
      setKillCriteriaItems(
        data.killCriteria || data.kill_criteria ||
        (typeof scopeObj === 'object' ? scopeObj.killCriteria || [] : [])
      );
      const rawPriority = (data.priority || 'medium').toLowerCase();
      setPriority(rawPriority);
      setOwnerId(data.ownerId || data.owner_id || '');
      setSponsorId(data.sponsorId || data.sponsor_id || '');
      setTargetDate(data.plannedEndDate || data.targetDate || '');
      setStartDate(data.plannedStartDate || data.planned_start_date || null);
      setEndDate(data.plannedEndDate || data.planned_end_date || null);

      // Fetch related data (best-effort, parallel)
      const fetches = [
        Api.get(`/decisions?relatedObjectId=${initiativeId}&relatedObjectType=initiative`)
          .then((ds: any) => setDecisions(Array.isArray(ds) ? ds : ds?.decisions || []))
          .catch(() => setDecisions([])),
        Api.get(`/initiatives/${initiativeId}/raid`)
          .then((r: any) => setRaidItems(r?.items || r?.raid || (Array.isArray(r) ? r : [])))
          .catch(() => setRaidItems([])),
        Api.get(`/initiatives/${initiativeId}/watchers`)
          .then((w: any) => setWatchers(w?.watchers || (Array.isArray(w) ? w : [])))
          .catch(() => setWatchers([])),
        Api.get(`/initiatives/${initiativeId}/history`)
          .then((h: any) => setHistory(h?.events || h?.history || (Array.isArray(h) ? h : [])))
          .catch(() => setHistory([])),
        Api.get(`/tasks?initiativeId=${initiativeId}`)
          .then((ts: any) => {
            const taskList = Array.isArray(ts) ? ts : ts?.tasks || [];
            setTasks(
              taskList.map((t: any) => ({
                id: t.id,
                title: t.title,
                source: t.source || 'manual',
                description: t.description,
                status: t.status,
                priority: t.priority,
                dueDate: t.dueDate,
                taskType: t.taskType,
                estimatedHours: t.estimatedHours,
                assigneeId: t.assigneeId || t.assignee_id,
                assigneeName: t.assigneeName || t.assignee?.name,
                isMilestone: t.isMilestone || false,
                milestoneDate: t.milestoneDate,
              }))
            );
          })
          .catch(() => setTasks([])),
        Api.get(`/initiatives/${initiativeId}/stakeholders`)
          .then((st: any) => {
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
          })
          .catch(() => setStakeholders([])),
        Api.get('/users')
          .then((u: any) => setUsers(Array.isArray(u) ? u : u?.users || []))
          .catch(() => setUsers([])),
        Api.get(
          `/decisions?relatedObjectId=${initiativeId}&relatedObjectType=initiative&type=GATE_APPROVAL`
        )
          .then((ad: any) => {
            const approvals = (Array.isArray(ad) ? ad : ad?.decisions || [])
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
          })
          .catch(() => setPendingApprovals([])),
      ];

      await Promise.allSettled(fetches);
    } catch (e: any) {
      setError(e?.message || 'Failed to load initiative');
    } finally {
      setIsLoading(false);
    }
  }, [initiativeId]);

  // Fetch section types once
  useEffect(() => {
    Api.get('/initiatives/section-types')
      .then((data: any) => {
        if (Array.isArray(data)) setSectionTypes(data);
      })
      .catch(() => {
        // Fall back to default sections if API fails
        setSectionTypes([]);
      });
  }, []);

  // Fetch template when initiative loads
  useEffect(() => {
    const tplId = initiative?.initiativeTemplateId || initiative?.initiative_template_id;
    if (!tplId) {
      setInitiativeTemplate(null);
      return;
    }
    let cancelled = false;
    Api.get(`/initiatives/templates/${encodeURIComponent(String(tplId))}`)
      .then((resp: any) => {
        if (!cancelled) setInitiativeTemplate(resp?.template || null);
      })
      .catch(() => {
        if (!cancelled) setInitiativeTemplate(null);
      });
    return () => {
      cancelled = true;
    };
  }, [initiative?.initiativeTemplateId, initiative?.initiative_template_id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    setDemoDataInjected(false);
  }, [initiativeId]);

  // Seed comprehensive demo data for empty initiatives (UI preview/testing).
  useEffect(() => {
    if (isLoading || !initiative || demoDataInjected) return;

    const looksEmpty =
      tasks.length === 0 &&
      stakeholders.length === 0 &&
      dependencies.length === 0 &&
      reminders.length === 0 &&
      raidItems.length === 0 &&
      decisions.length === 0 &&
      comments.length === 0 &&
      linkedItems.length === 0 &&
      inScopeItems.length === 0 &&
      outScopeItems.length === 0 &&
      killCriteriaItems.length === 0;

    if (!looksEmpty) return;

    const now = new Date();
    const dateInDays = (days: number) =>
      new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
    const dateOnlyInDays = (days: number) => dateInDays(days).slice(0, 10);
    const idSuffix = `${initiativeId}-${Date.now()}`;

    const demoTasks: TaskItem[] = [
      {
        id: `demo-task-1-${idSuffix}`,
        title: 'Kick-off workshop with key stakeholders',
        status: 'DONE',
        priority: 'high',
        dueDate: dateOnlyInDays(-3),
        assigneeName: users[0] ? `${users[0].firstName} ${users[0].lastName}` : 'Project Owner',
        assigneeId: users[0]?.id,
        description: 'Align initiative goals, scope and success metrics.',
        estimatedHours: 6,
        source: 'manual',
      },
      {
        id: `demo-task-2-${idSuffix}`,
        title: 'Define target process and acceptance criteria',
        status: 'IN_PROGRESS',
        priority: 'high',
        dueDate: dateOnlyInDays(7),
        assigneeName: users[1] ? `${users[1].firstName} ${users[1].lastName}` : 'Business Analyst',
        assigneeId: users[1]?.id,
        description: 'Document future-state flow and measurable outcomes.',
        estimatedHours: 12,
        source: 'manual',
      },
      {
        id: `demo-task-3-${idSuffix}`,
        title: 'Configure pilot environment and integrations',
        status: 'TODO',
        priority: 'medium',
        dueDate: dateOnlyInDays(14),
        assigneeName: users[2] ? `${users[2].firstName} ${users[2].lastName}` : 'Technical Lead',
        assigneeId: users[2]?.id,
        description: 'Prepare pilot setup and data exchange between systems.',
        estimatedHours: 16,
        source: 'ai',
      },
      {
        id: `demo-task-4-${idSuffix}`,
        title: 'Pilot readiness checkpoint',
        status: 'TODO',
        priority: 'medium',
        isMilestone: true,
        milestoneDate: dateOnlyInDays(21),
        dueDate: dateOnlyInDays(21),
        assigneeName: users[0] ? `${users[0].firstName} ${users[0].lastName}` : 'Project Owner',
        assigneeId: users[0]?.id,
        description: 'Go/no-go checkpoint before pilot launch.',
        source: 'manual',
      },
    ];

    const demoDependencies: TaskDependency[] = [
      {
        id: `demo-dep-1-${idSuffix}`,
        taskId: demoTasks[0].id,
        taskTitle: demoTasks[0].title,
        taskStatus: demoTasks[0].status,
        taskPriority: demoTasks[0].priority,
        taskIndexCode: demoTasks[0].id,
        dependencyType: 'FS',
        lagDays: 0,
        notes: 'Process definition starts after kick-off alignment.',
        direction: 'predecessor',
        createdAt: dateInDays(-2),
      },
      {
        id: `demo-dep-2-${idSuffix}`,
        taskId: demoTasks[2].id,
        taskTitle: demoTasks[2].title,
        taskStatus: demoTasks[2].status,
        taskPriority: demoTasks[2].priority,
        taskIndexCode: demoTasks[2].id,
        dependencyType: 'FS',
        lagDays: 2,
        notes: 'Pilot setup can start 2 days after process definition starts.',
        direction: 'successor',
        createdAt: dateInDays(-1),
      },
    ];

    const stakeholderSettings = (
      triggers: StakeholderNotificationSettings['triggers']
    ): StakeholderNotificationSettings => ({
      enabled: true,
      triggers,
      emailEnabled: true,
      inAppEnabled: true,
    });

    const stakeholderUsers = users.slice(0, 4);
    const demoStakeholders: Stakeholder[] =
      stakeholderUsers.length > 0
        ? stakeholderUsers.map((u, idx) => ({
            id: `demo-stk-${idx + 1}-${idSuffix}`,
            decisionId: initiativeId,
            userId: u.id,
            userName: `${u.firstName} ${u.lastName}`.trim(),
            userEmail: u.email,
            role:
              idx === 0
                ? 'accountable'
                : idx === 1
                  ? 'responsible'
                  : idx === 2
                    ? 'consulted'
                    : 'informed',
            notificationSettings:
              idx <= 1
                ? stakeholderSettings(['on_create', 'on_update', 'on_status_change'])
                : stakeholderSettings(['on_comment', 'on_status_change']),
          }))
        : [
            {
              id: `demo-stk-fallback-1-${idSuffix}`,
              decisionId: initiativeId,
              userId: 'demo-user-accountable',
              userName: 'Business Owner',
              userEmail: 'owner@example.com',
              role: 'accountable',
              notificationSettings: stakeholderSettings([
                'on_create',
                'on_update',
                'on_status_change',
              ]),
            },
            {
              id: `demo-stk-fallback-2-${idSuffix}`,
              decisionId: initiativeId,
              userId: 'demo-user-responsible',
              userName: 'Execution Lead',
              userEmail: 'lead@example.com',
              role: 'responsible',
              notificationSettings: stakeholderSettings(['on_update', 'on_comment']),
            },
          ];

    const demoReminders: ReminderRule[] = [
      {
        id: `demo-rem-1-${idSuffix}`,
        type: 'before_due',
        days: 3,
        recipients: 'both',
        inAppNotification: true,
        emailNotification: true,
        message: 'Prepare status update before target date.',
        enabled: true,
      },
      {
        id: `demo-rem-2-${idSuffix}`,
        type: 'after_due',
        days: 2,
        recipients: 'stakeholders',
        inAppNotification: true,
        emailNotification: false,
        message: 'Task overdue - review blockers and mitigation plan.',
        enabled: true,
      },
    ];

    const escalationUser = users[1] || users[0];
    const demoEscalation: EscalationRule = {
      id: `demo-esc-${idSuffix}`,
      enabled: true,
      escalateTo: escalationUser?.id || 'demo-escalation-owner',
      escalateToName: escalationUser
        ? `${escalationUser.firstName} ${escalationUser.lastName}`.trim()
        : 'Program Sponsor',
      afterDays: 3,
      message: 'Escalate if initiative critical path slips.',
    };

    const demoRaid: RaidItem[] = [
      {
        id: `demo-raid-1-${idSuffix}`,
        type: 'risk',
        title: 'Data quality may delay pilot readiness',
        description: 'Source systems still contain inconsistent master data.',
        severity: 'HIGH',
        status: 'open',
        owner: users[2] ? `${users[2].firstName} ${users[2].lastName}` : 'Technical Lead',
        mitigationPlan: 'Run data cleanup sprint before integration freeze.',
      },
      {
        id: `demo-raid-2-${idSuffix}`,
        type: 'issue',
        title: 'Limited availability of integration specialist',
        description: 'Shared specialist supports multiple initiatives in parallel.',
        severity: 'MEDIUM',
        status: 'monitoring',
        owner: users[0] ? `${users[0].firstName} ${users[0].lastName}` : 'Project Owner',
        mitigationPlan: 'Secure backup resource from partner team.',
      },
      {
        id: `demo-raid-3-${idSuffix}`,
        type: 'dependency',
        title: 'Waiting for security review approval',
        description: 'Pilot cannot start before IAM policy sign-off.',
        severity: 'HIGH',
        status: 'open',
      },
    ];

    const demoDecisions: Decision[] = [
      {
        id: `demo-dec-1-${idSuffix}`,
        type: 'GOVERNANCE_DECISION_MAKING',
        title: 'Approve pilot scope and timeline',
        status: 'PENDING',
        dueDate: dateOnlyInDays(5),
        ownerName: users[0] ? `${users[0].firstName} ${users[0].lastName}` : 'Project Owner',
      },
    ];

    const demoComments: Comment[] = [
      {
        id: `demo-com-1-${idSuffix}`,
        content:
          'Kick-off done. Next step: confirm target process KPIs and owners before pilot build.',
        authorId: users[0]?.id || 'demo-author-1',
        authorName: users[0] ? `${users[0].firstName} ${users[0].lastName}` : 'Project Owner',
        createdAt: dateInDays(-1),
        likes: 2,
      },
    ];

    const demoLinkedItems: LinkedItem[] = [
      {
        id: `demo-linked-1-${idSuffix}`,
        type: 'report',
        title: 'Current process maturity baseline',
        status: 'ready',
        linkRelation: 'informs',
        linkDirection: 'outgoing',
      },
      {
        id: `demo-linked-2-${idSuffix}`,
        type: 'external',
        title: 'Vendor integration guideline',
        externalUrl: 'https://example.com/integration-guideline',
        linkRelation: 'related',
        linkDirection: 'outgoing',
      },
    ];

    if (!summary.trim()) {
      setSummary(
        'Automate and standardize key handover activities to reduce cycle time and improve quality.'
      );
    }
    if (!description.trim()) {
      setDescription(
        'This initiative introduces a structured handover flow with clear ownership, checkpoints and escalation rules.'
      );
    }

    if (inScopeItems.length === 0) {
      setInScopeItems([
        'Standard handover checklist for core process',
        'Pilot automation in one business unit',
        'KPI dashboard for cycle time and quality',
      ]);
    }
    if (outScopeItems.length === 0) {
      setOutScopeItems([
        'Legacy process redesign in all business units',
        'ERP replacement or major platform changes',
      ]);
    }
    if (killCriteriaItems.length === 0) {
      setKillCriteriaItems([
        'No measurable cycle-time improvement after pilot',
        'Security or compliance gate not approved',
      ]);
    }

    if (targetStateItems.length === 0) {
      setTargetStateItems([
        { id: `ts-1-${idSuffix}`, text: 'Consistent handover workflow across teams', done: false },
        { id: `ts-2-${idSuffix}`, text: 'Transparent ownership and accountability', done: false },
      ]);
    }
    if (successCriteriaItems.length === 0) {
      setSuccessCriteriaItems([
        { id: `sc-1-${idSuffix}`, text: 'Reduce average handover time by 25%', done: false },
        { id: `sc-2-${idSuffix}`, text: 'Achieve >= 95% checklist completeness', done: false },
      ]);
    }
    if (deliverableItems.length === 0) {
      setDeliverableItems([
        { id: `dl-1-${idSuffix}`, text: 'Approved pilot process map', done: false },
        { id: `dl-2-${idSuffix}`, text: 'Readiness and escalation playbook', done: false },
      ]);
    }

    if (tasks.length === 0) setTasks(demoTasks);
    if (dependencies.length === 0) setDependencies(demoDependencies);
    if (stakeholders.length === 0) setStakeholders(demoStakeholders);
    if (reminders.length === 0) setReminders(demoReminders);
    if (!escalation) setEscalation(demoEscalation);
    if (raidItems.length === 0) setRaidItems(demoRaid);
    if (decisions.length === 0) setDecisions(demoDecisions);
    if (comments.length === 0) setComments(demoComments);
    if (linkedItems.length === 0) setLinkedItems(demoLinkedItems);
    if (tags.length === 0) setTags(['pilot', 'automation', 'high-impact']);

    setThresholds({
      warningDays: 4,
      criticalDays: 2,
      showOverdueAlert: true,
    });

    if (!ownerId && users[0]?.id) setOwnerId(users[0].id);
    if (!sponsorId && (users[1]?.id || users[0]?.id)) setSponsorId(users[1]?.id || users[0].id);
    if (!targetDate) setTargetDate(dateOnlyInDays(30));
    if (!startDate) setStartDate(dateOnlyInDays(-2));
    if (!endDate) setEndDate(dateOnlyInDays(30));

    setDemoDataInjected(true);
    toast.success(isPolish ? 'Wypełniono dane testowe inicjatywy' : 'Initiative test data filled');
  }, [
    comments.length,
    decisions.length,
    demoDataInjected,
    dependencies.length,
    description,
    endDate,
    inScopeItems.length,
    initiative,
    initiativeId,
    isLoading,
    isPolish,
    killCriteriaItems.length,
    linkedItems.length,
    outScopeItems.length,
    ownerId,
    raidItems.length,
    reminders.length,
    sponsorId,
    stakeholders.length,
    startDate,
    successCriteriaItems.length,
    summary,
    tags.length,
    targetDate,
    targetStateItems.length,
    tasks.length,
    users,
  ]);

  // ==========================================
  // HANDLERS
  // ==========================================

  const handleStatusAction = async (action: StatusAction) => {
    // Warn if this transition moves the initiative to a different module
    const targetStatus = action.targetStatus as InitiativeStatus;
    if (willChangeModule(status, targetStatus)) {
      const targetModule = getModuleForStatus(targetStatus);
      const MODULE_NAMES: Record<string, { en: string; pl: string }> = {
        tools: { en: 'Assessment', pl: 'Ocena' },
        assessment: { en: 'Assessment', pl: 'Ocena' },
        initiatives: { en: 'Initiatives', pl: 'Inicjatywy' },
        execution: { en: 'Execution', pl: 'Realizacja' },
        benefits: { en: 'Benefits', pl: 'Korzyści' },
      };
      const moduleName = MODULE_NAMES[targetModule]?.[isPolish ? 'pl' : 'en'] || targetModule;
      const confirmed = window.confirm(
        isPolish
          ? `Ta zmiana przeniesie inicjatywę do modułu "${moduleName}". Kontynuować?`
          : `This change will move the initiative to the "${moduleName}" module. Continue?`
      );
      if (!confirmed) return;
    }

    setIsMutating(true);
    try {
      await Api.patch(`/initiatives/${initiativeId}`, { status: action.targetStatus });
      setInitiative((prev: any) => ({ ...prev, status: action.targetStatus }));
      onStatusChange?.(action.targetStatus);
      toast.success(isPolish ? 'Status zaktualizowany' : 'Status updated');
      fetchAll();
    } catch (e: any) {
      toast.error(
        e?.message ||
          t('initiatives.toast.statusUpdateError', 'Nie udało się zaktualizować statusu')
      );
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
      toast.error(
        e?.message || t('initiatives.toast.watchError', 'Nie udało się zmienić obserwowania')
      );
    } finally {
      setIsMutating(false);
    }
  };

  const handleSave = async () => {
    setIsMutating(true);
    try {
      // Build structured problem definition as JSON for the problemStatement field
      const problemDefinitionPayload =
        symptomDraft || rootCauseDraft || costOfInactionDraft
          ? JSON.stringify({
              symptom: symptomDraft,
              rootCause: rootCauseDraft,
              costOfInaction: costOfInactionDraft,
            })
          : undefined;

      await Api.patch(`/initiatives/${initiativeId}`, {
        summary,
        description,
        tags,
        priority,
        ownerId,
        sponsorId,
        plannedEndDate: targetDate,
        problemStatement: problemDefinitionPayload,
      });
      toast.success(isPolish ? 'Zapisano' : 'Saved');
    } catch (e: any) {
      toast.error(e?.message || t('initiatives.toast.saveError', 'Nie udało się zapisać'));
    } finally {
      setIsMutating(false);
    }
  };

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) return;
    setIsMutating(true);
    try {
      const projectId = initiative?.projectId || initiative?.project_id || initiative?.project?.id;
      const res = await Api.post('/tasks', {
        title: newTaskTitle,
        projectId,
        initiativeId,
        status: 'todo',
        source: 'manual',
        isMilestone: newTaskIsMilestone,
        milestoneDate: newTaskIsMilestone ? newTaskMilestoneDate : undefined,
      });
      setTasks((prev) => [
        ...prev,
        {
          id: res.id,
          title: res.title,
          source: res.source || 'manual',
          description: res.description,
          status: res.status,
          priority: res.priority,
          dueDate: res.dueDate,
          taskType: res.taskType,
          estimatedHours: res.estimatedHours,
          assigneeId: res.assigneeId,
          assigneeName: res.assigneeName || res.assignee?.name,
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
      toast.error(
        e?.message || t('initiatives.toast.createTaskError', 'Nie udało się utworzyć zadania')
      );
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
      toast.error(
        e?.message || t('initiatives.toast.createDecisionError', 'Nie udało się utworzyć decyzji')
      );
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
      toast.error(
        e?.message || t('initiatives.toast.createRaidError', 'Nie udało się dodać elementu RAID')
      );
    } finally {
      setIsMutating(false);
    }
  };

  const handleAddComment = async (content: string) => {
    const authorName = currentUser
      ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.email || 'User'
      : 'User';

    // Optimistic local update
    const tempId = Math.random().toString(36).substr(2, 9);
    const newComment: Comment = {
      id: tempId,
      content,
      authorId: currentUserId,
      authorName,
      createdAt: new Date().toISOString(),
      likes: 0,
      likedByMe: false,
    };
    setComments((prev) => [...prev, newComment]);

    // Persist to backend
    try {
      const saved = await Api.post(`/initiatives/${initiativeId}/comments`, { content });
      // Replace temp ID with server-generated ID
      if (saved?.id) {
        setComments((prev) =>
          prev.map((c) => (c.id === tempId ? { ...c, id: saved.id } : c))
        );
      }
    } catch {
      // Comment is shown locally even if persist fails (best-effort)
      // Endpoint may not exist yet — no toast to avoid noise
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard
      .writeText(buildArtifactPermalink('initiative', initiativeId))
      .then(() => {
        toast.success(isPolish ? 'Link do inicjatywy skopiowany' : 'Initiative permalink copied');
      })
      .catch(() => {
        toast.error(isPolish ? 'Nie udało się skopiować linku' : 'Failed to copy link');
      })
      .finally(() => {
        setShowMoreMenu(false);
      });
  };
  const handleExportPDF = () => {
    toast(isPolish ? 'Eksport PDF — wkrótce dostępny' : 'PDF export — coming soon', {
      icon: '📄',
    });
    setShowMoreMenu(false);
  };

  const handleGenerateAI = async (section: string): Promise<any> => {
    setIsGeneratingAI(section);
    try {
      const context = {
        sectionKey: section,
        initiativeId,
        initiativeName: initiative?.name || '',
        summary: summary || initiative?.description || '',
        problemStatement: initiative?.problem_statement || '',
        category: initiative?.category || '',
        module: initiative?.module || '',
        status: initiative?.status || '',
        language: isPolish ? 'pl' : 'en',
      };

      const result = await Api.post('/initiatives/generate-section', context);

      if (result?.parsedContent || result?.content) {
        if (section === 'overview' || section === 'summary') {
          // Set the summary
          setSummary(result.parsedContent || result.content);

          // Also generate content for Description & Context sub-fields if they are empty
          const subFieldsToGenerate: { key: string; setter: (v: string) => void; current: string }[] = [
            { key: 'problem_definition', setter: (v: string) => setSymptomDraft(v), current: symptomDraft },
            { key: 'proposed_solution', setter: (v: string) => setRootCauseDraft(v), current: rootCauseDraft },
            { key: 'cost_of_inaction', setter: (v: string) => setCostOfInactionDraft(v), current: costOfInactionDraft },
            { key: 'market_context', setter: (v: string) => setMarketContextDraft(v), current: marketContextDraft },
          ];

          // Generate sub-fields in parallel (only empty ones)
          const emptyFields = subFieldsToGenerate.filter((f) => !f.current.trim());
          if (emptyFields.length > 0) {
            const subResults = await Promise.allSettled(
              emptyFields.map((f) =>
                Api.post('/ai/refine-text', {
                  text: `[GENERATE FROM SCRATCH] Section: ${f.key}. Initiative: ${initiative?.name || ''}. Summary: ${result.parsedContent || result.content}`,
                  mode: 'generate',
                  systemInstruction: isPolish
                    ? `Jesteś ekspertem strategicznym PMO. Wygeneruj profesjonalną treść dla sekcji "${f.key}" inicjatywy "${initiative?.name || ''}". Zwróć TYLKO treść — bez komentarzy, bez cudzysłowów, bez prefiksów. Pisz zwięźle (2-4 zdania). Język: polski.`
                    : `You are a strategic PMO expert. Generate professional content for the "${f.key}" section of initiative "${initiative?.name || ''}". Return ONLY the content — no commentary, no quotes, no prefixes. Write concisely (2-4 sentences). Language: English.`,
                  fieldLabel: f.key,
                  artifactContext: { title: initiative?.name || '', status, priority, type: 'initiative' },
                  language: isPolish ? 'pl' : 'en',
                })
              )
            );

            subResults.forEach((res, idx) => {
              if (res.status === 'fulfilled' && res.value?.text) {
                emptyFields[idx].setter(String(res.value.text).trim());
              }
            });
          }

          toast.success(isPolish ? 'Opis wygenerowany przez AI' : 'Description generated by AI');
        } else if (section === 'comments') {
          const aiComment: Comment = {
            id: `ai-${Date.now()}`,
            content: result.content || (isPolish ? '🤖 Analiza AI' : '🤖 AI Analysis'),
            authorId: 'ai-assistant',
            authorName: 'AI Assistant',
            createdAt: new Date().toISOString(),
            likes: 0,
            likedByMe: false,
          };
          setComments((prev) => [aiComment, ...prev]);
          toast.success(isPolish ? 'AI dodał komentarz' : 'AI added comment');
        } else {
          // For structured sections, the result is returned to the calling component
          toast.success(
            isPolish
              ? `AI wygenerował zawartość: ${section}`
              : `AI generated content for: ${section}`
          );
        }
        return result;
      } else {
        toast.error(isPolish ? 'AI nie zwróciło wyników' : 'AI returned no results');
        return null;
      }
    } catch (e: any) {
      toast.error(
        e?.message || t('initiatives.toast.aiGenerationError', 'Generowanie AI nie powiodło się')
      );
      return null;
    } finally {
      setIsGeneratingAI(null);
    }
  };

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
      await Api.post('/decisions', {
        title: `${gateType} - ${initiative?.name}`,
        type: gateType,
        relatedObjectId: initiativeId,
        relatedObjectType: 'initiative',
        status: 'PENDING',
        deciderId: targetUserId,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
      toast.success(isPolish ? 'Wysłano prośbę o zatwierdzenie' : 'Approval request sent');
      fetchAll();
    } catch (e: any) {
      toast.error(
        e?.message ||
          t('initiatives.toast.approvalRequestError', 'Nie udało się wysłać prośby o zatwierdzenie')
      );
    } finally {
      setIsMutating(false);
    }
  };

  const handleOpenChat = () => {
    if (isChatCollapsed) toggleChatCollapse();
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
      toast.error(e?.message || t('initiatives.toast.archiveError', 'Nie udało się zarchiwizować'));
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
      toast.error(e?.message || t('initiatives.toast.deleteError', 'Nie udało się usunąć'));
    } finally {
      setIsMutating(false);
    }
  };

  // ==========================================
  // CONTEXT VALUE
  // ==========================================

  const contextValue = useMemo(
    () => ({
      initiative,
      initiativeId,
      initiativeTemplate,
      isPolish,
      decisions,
      setDecisions,
      raidItems,
      setRaidItems,
      watchers,
      setWatchers,
      history,
      tasks,
      setTasks,
      comments,
      setComments,
      linkedItems,
      setLinkedItems,
      attachments,
      setAttachments,
      stakeholders,
      setStakeholders,
      dependencies,
      setDependencies,
      tags,
      setTags,
      users,
      pendingApprovals,
      summary,
      setSummary,
      description,
      setDescription,
      priority,
      setPriority,
      ownerId,
      setOwnerId,
      sponsorId,
      setSponsorId,
      targetDate,
      setTargetDate,
      startDate,
      setStartDate,
      endDate,
      setEndDate,
      reminders,
      setReminders,
      escalation,
      setEscalation,
      thresholds,
      setThresholds,
      expandedSections,
      toggleSection,
      isGeneratingAI,
      isMutating,
      currentUserId,
      status,
      ownerName,
      sponsorName,
      tasksDone,
      tasksInProgress,
      milestones,
      riskCount,
      issueCount,
      criticalRaids,
      isWatching,
      pendingGates,
      statusActions,
      primaryActions,
      handleSave,
      handleStatusAction,
      handleToggleWatch,
      handleGenerateAI,
      handleCreateTask,
      handleCreateDecision,
      handleCreateRaid,
      handleAddComment,
      handleRequestApproval,
      handleOpenChat,
      handleArchive,
      handleDelete,
      handleCopyLink,
      handleExportPDF,
      fetchAll,
      newTaskTitle,
      setNewTaskTitle,
      newTaskIsMilestone,
      setNewTaskIsMilestone,
      newTaskMilestoneDate,
      setNewTaskMilestoneDate,
      showCreateTask,
      setShowCreateTask,
      newDecisionTitle,
      setNewDecisionTitle,
      newDecisionType,
      setNewDecisionType,
      showCreateDecision,
      setShowCreateDecision,
      newRaidTitle,
      setNewRaidTitle,
      newRaidType,
      setNewRaidType,
      newRaidSeverity,
      setNewRaidSeverity,
      newRaidDescription,
      setNewRaidDescription,
      showCreateRaid,
      setShowCreateRaid,
      showMoreMenu,
      setShowMoreMenu,
      showStatusDropdown,
      setShowStatusDropdown,
      showPriorityDropdown,
      setShowPriorityDropdown,
      showPhaseDropdown,
      setShowPhaseDropdown,
      showApprovalWorkflow,
      setShowApprovalWorkflow,
      newTag,
      setNewTag,
      onBack,
      onStatusChange,
      onOpenTask,
      onOpenDecision,
    }),
    [
      initiative,
      initiativeId,
      initiativeTemplate,
      isPolish,
      decisions,
      raidItems,
      watchers,
      history,
      tasks,
      comments,
      linkedItems,
      attachments,
      stakeholders,
      dependencies,
      tags,
      users,
      pendingApprovals,
      summary,
      description,
      priority,
      ownerId,
      sponsorId,
      targetDate,
      startDate,
      endDate,
      reminders,
      escalation,
      thresholds,
      expandedSections,
      toggleSection,
      isGeneratingAI,
      isMutating,
      currentUserId,
      status,
      ownerName,
      sponsorName,
      tasksDone,
      tasksInProgress,
      milestones,
      riskCount,
      issueCount,
      criticalRaids,
      isWatching,
      pendingGates,
      statusActions,
      primaryActions,
      handleSave,
      handleStatusAction,
      handleToggleWatch,
      handleGenerateAI,
      handleCreateTask,
      handleCreateDecision,
      handleCreateRaid,
      handleAddComment,
      handleRequestApproval,
      handleOpenChat,
      handleArchive,
      handleDelete,
      handleCopyLink,
      handleExportPDF,
      fetchAll,
      newTaskTitle,
      newTaskIsMilestone,
      newTaskMilestoneDate,
      showCreateTask,
      newDecisionTitle,
      newDecisionType,
      showCreateDecision,
      newRaidTitle,
      newRaidType,
      newRaidSeverity,
      newRaidDescription,
      showCreateRaid,
      showMoreMenu,
      showStatusDropdown,
      showPriorityDropdown,
      showPhaseDropdown,
      showApprovalWorkflow,
      newTag,
      onBack,
      onStatusChange,
      onOpenTask,
      onOpenDecision,
    ]
  );

  // ==========================================
  // N-MODE: SECTION DEFINITIONS (10 sections)
  // ==========================================

  const initiativeNSections: NModeSection[] = useMemo(
    () => [
      {
        id: 'description-context',
        icon: Search,
        label: { en: 'Description & Context', pl: 'Opis i kontekst' },
        component: null,
      },
      {
        id: 'target-success',
        icon: Target,
        label: { en: 'Success Criteria', pl: 'Kryteria sukcesu' },
        component: null,
      },
      {
        id: 'scope-boundaries',
        icon: Crosshair,
        label: { en: 'Scope & Boundaries', pl: 'Zakres i ograniczenia' },
        component: null,
      },
      {
        id: 'delivery-plan',
        icon: ListChecks,
        label: { en: 'Tasks', pl: 'Zadania' },
        badge: tasks.length > 0 ? tasks.length : undefined,
        component: null,
      },
      {
        id: 'dependencies',
        icon: GitBranch,
        label: { en: 'Dependencies', pl: 'Zależności' },
        badge: dependencies.length > 0 ? dependencies.length : undefined,
        component: null,
      },
      {
        id: 'team',
        icon: Users,
        label: { en: 'Team', pl: 'Zespół' },
        component: null,
      },
      {
        id: 'raci-escalation',
        icon: ShieldCheck,
        label: { en: 'RACI & Escalation', pl: 'RACI i eskalacja' },
        badge: stakeholders.length > 0 ? stakeholders.length : undefined,
        component: null,
      },
      {
        id: 'timeline-resources',
        icon: Calendar,
        label: { en: 'Timeline & Resources', pl: 'Harmonogram i zasoby' },
        component: null,
      },
      {
        id: 'economics-risk',
        icon: TrendingUp,
        label: { en: 'Economics & Risk', pl: 'Ekonomia i ryzyko' },
        badge: raidItems.length > 0 ? raidItems.length : undefined,
        component: null,
      },
      {
        id: 'governance-gates',
        icon: Shield,
        label: { en: 'Governance & Gates', pl: 'Governance i bramy' },
        badge: pendingGates.length > 0 ? pendingGates.length : undefined,
        component: null,
      },
      {
        id: 'collaboration-audit',
        icon: History,
        label: { en: 'Collaboration & Audit', pl: 'Współpraca i audyt' },
        badge: comments.length > 0 ? comments.length : undefined,
        component: null,
      },
      {
        id: 'attachments',
        icon: Paperclip,
        label: { en: 'Attachments', pl: 'Załączniki' },
        badge: attachments.length > 0 ? attachments.length : undefined,
        component: null,
      },
      {
        id: 'links',
        icon: Link2,
        label: { en: 'Links', pl: 'Linki' },
        badge: linkedItems.length > 0 ? linkedItems.length : undefined,
        component: null,
      },
      {
        id: 'technical-description',
        icon: FileCode,
        label: { en: 'Technical Description', pl: 'Opis techniczny' },
        component: null,
      },
    ],
    [tasks.length, dependencies.length, stakeholders.length, raidItems.length, pendingGates.length, comments.length, attachments.length, linkedItems.length]
  );

  // ==========================================
  // N-MODE: PROPERTIES STRIP FIELDS
  // ==========================================

  const nModePropertyFields: NModePropertyField[] = useMemo(() => {
    const statusOptions = [
      { value: 'DRAFT', label: { en: 'Draft', pl: 'Szkic' } },
      { value: 'REVIEW', label: { en: 'Review', pl: 'Przegląd' } },
      { value: 'PROMOTED', label: { en: 'Promoted', pl: 'Promowana' } },
      { value: 'PLANNING', label: { en: 'Planning', pl: 'Planowanie' } },
      { value: 'APPROVED', label: { en: 'Approved', pl: 'Zatwierdzona' } },
      { value: 'SCHEDULED', label: { en: 'Scheduled', pl: 'Zaplanowana' } },
      { value: 'EXECUTING', label: { en: 'Executing', pl: 'W realizacji' } },
      { value: 'BLOCKED', label: { en: 'Blocked', pl: 'Zablokowana' } },
      { value: 'DONE', label: { en: 'Done', pl: 'Zakończona' } },
      { value: 'TRACKING', label: { en: 'Tracking', pl: 'Śledzenie' } },
      { value: 'CANCELLED', label: { en: 'Cancelled', pl: 'Anulowana' } },
      { value: 'ARCHIVED', label: { en: 'Archived', pl: 'Zarchiwizowana' } },
    ];

    const priorityOptions = [
      { value: 'critical', label: { en: 'Critical', pl: 'Krytyczny' } },
      { value: 'high', label: { en: 'High', pl: 'Wysoki' } },
      { value: 'medium', label: { en: 'Medium', pl: 'Średni' } },
      { value: 'low', label: { en: 'Low', pl: 'Niski' } },
    ];

    const nextGate = getNextGateForStatus(status);
    const gateConf = nextGate ? GATE_CONFIG[nextGate] : null;
    const gateLabel = gateConf
      ? { en: gateConf.name, pl: gateConf.namePl }
      : { en: '—', pl: '—' };

    // Gate color — depends on whether there's a pending gate and what it targets
    const gateVisual = (() => {
      if (!gateConf) return { dot: 'bg-slate-300', bg: 'bg-slate-100 dark:bg-navy-800', text: 'text-slate-400 dark:text-slate-500' };
      // Map target status to module color
      const targetModule = getModuleFromStatus(gateConf.toStatus);
      const targetModConf = MODULE_CONFIG[targetModule];
      return {
        dot: targetModConf.color,
        bg: targetModConf.bgLight,
        text: targetModConf.textColor,
      };
    })();

    // Status color mapping
    const statusAlertBorder = (() => {
      if (status === 'BLOCKED') return 'border-red-400/60';
      if (status === 'EXECUTING') return 'border-emerald-400/60';
      if (status === 'DONE' || status === 'TRACKING') return 'border-blue-400/60';
      if (status === 'CANCELLED' || status === 'ARCHIVED') return 'border-slate-400/60';
      return undefined;
    })();

    // Priority color mapping
    const priorityAlertBorder = (() => {
      if (priority === 'critical') return 'border-red-400/60';
      if (priority === 'high') return 'border-orange-400/60';
      return undefined;
    })();

    // Gate color
    const gateAlertBorder = pendingGates.length > 0 ? 'border-amber-400/60' : undefined;

    // Helper: get metadata for current status
    const currentStatusMeta = INITIATIVE_STATUS_METADATA[status as InitiativeStatus];
    const currentStatusDot = currentStatusMeta?.dotColor || 'bg-slate-400';
    const currentStatusBg = currentStatusMeta?.bgColor || 'bg-slate-50';
    const currentStatusColor = currentStatusMeta?.color || 'text-slate-700';
    const currentStatusLabel = currentStatusMeta
      ? isPolish ? currentStatusMeta.labelPL : currentStatusMeta.label
      : status;

    // Helper: get metadata for current priority
    const priorityMeta: Record<string, { dot: string; bg: string; text: string; label: string; labelPl: string }> = {
      critical: { dot: 'bg-red-500', bg: 'bg-red-500/10', text: 'text-red-600', label: 'Critical', labelPl: 'Krytyczny' },
      high: { dot: 'bg-orange-500', bg: 'bg-orange-500/10', text: 'text-orange-600', label: 'High', labelPl: 'Wysoki' },
      medium: { dot: 'bg-amber-400', bg: 'bg-amber-400/10', text: 'text-amber-600', label: 'Medium', labelPl: 'Średni' },
      low: { dot: 'bg-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-600', label: 'Low', labelPl: 'Niski' },
    };
    const currentPriorityMeta = priorityMeta[priority] || priorityMeta.medium;

    return [
      {
        id: 'status',
        label: { en: 'Status', pl: 'Status' },
        type: 'custom' as const,
        value: status,
        onChange: (val: string) => {
          const action = statusActions.find((a) => a.targetStatus === val);
          if (action) handleStatusAction(action);
        },
        alertBorderClass: statusAlertBorder,
        render: () => (
          <div className="relative">
            <div className={`flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold ${currentStatusBg} border ${statusAlertBorder || 'border-slate-200/60 dark:border-navy-600/60'} ${currentStatusColor}`}>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${currentStatusDot}`} />
              <span className="flex-1 truncate">{currentStatusLabel}</span>
            </div>
            <select
              value={status}
              onChange={(e) => {
                const action = statusActions.find((a) => a.targetStatus === e.target.value);
                if (action) handleStatusAction(action);
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            >
              {statusOptions.map((opt) => {
                const meta = INITIATIVE_STATUS_METADATA[opt.value as InitiativeStatus];
                return (
                  <option key={opt.value} value={opt.value}>
                    {isPolish ? (meta?.labelPL || opt.label.pl) : (meta?.label || opt.label.en)}
                  </option>
                );
              })}
            </select>
          </div>
        ),
      },
      {
        id: 'phase',
        label: { en: 'Phase', pl: 'Faza' },
        type: 'custom' as const,
        value: isPolish ? moduleConfig.labelPl : moduleConfig.label,
        onChange: () => {},
        readOnly: true,
        render: () => (
          <div className={`flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold ${moduleConfig.bgLight} ${moduleConfig.textColor}`}>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${moduleConfig.color}`} />
            <span className="flex-1 truncate">{isPolish ? moduleConfig.labelPl : moduleConfig.label}</span>
          </div>
        ),
      },
      {
        id: 'gate',
        label: { en: 'Next Gate', pl: 'Następna brama' },
        type: 'custom' as const,
        value: isPolish ? gateLabel.pl : gateLabel.en,
        onChange: () => {},
        readOnly: true,
        render: () => (
          <div className={`flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold ${gateVisual.bg} ${gateVisual.text} ${gateAlertBorder ? `border ${gateAlertBorder}` : ''}`}>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${gateVisual.dot}`} />
            <span className="flex-1 truncate">{isPolish ? gateLabel.pl : gateLabel.en}</span>
          </div>
        ),
      },
      {
        id: 'priority',
        label: { en: 'Priority', pl: 'Priorytet' },
        type: 'custom' as const,
        value: priority,
        onChange: setPriority,
        alertBorderClass: priorityAlertBorder,
        render: () => (
          <div className="relative">
            <div className={`flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold ${currentPriorityMeta.bg} border ${priorityAlertBorder || 'border-slate-200/60 dark:border-navy-600/60'} ${currentPriorityMeta.text}`}>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${currentPriorityMeta.dot}`} />
              <span className="flex-1 truncate">{isPolish ? currentPriorityMeta.labelPl : currentPriorityMeta.label}</span>
            </div>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            >
              {priorityOptions.map((opt) => {
                const pm = priorityMeta[opt.value];
                return (
                  <option key={opt.value} value={opt.value}>
                    {isPolish ? (pm?.labelPl || opt.label.pl) : (pm?.label || opt.label.en)}
                  </option>
                );
              })}
            </select>
          </div>
        ),
      },
      {
        id: 'owner',
        label: { en: 'Owner', pl: 'Właściciel' },
        type: 'custom' as const,
        value: ownerId,
        onChange: setOwnerId,
        render: () => (
          <select
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-50 dark:bg-navy-800 border border-slate-200/60 dark:border-navy-600/60 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-primary-400 transition-colors"
          >
            <option value="">{isPolish ? '— Wybierz —' : '— Select —'}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.firstName} {u.lastName}
              </option>
            ))}
          </select>
        ),
      },
      {
        id: 'targetDate',
        label: { en: 'Target', pl: 'Termin' },
        type: 'date' as const,
        value: targetDate,
        onChange: setTargetDate,
      },
    ];
  }, [
    status, priority, ownerId, sponsorId, startDate, targetDate, tasks.length, tasksDone,
    users, isPolish, moduleConfig, statusActions, handleStatusAction, setPriority,
    setOwnerId, setSponsorId, setStartDate, setTargetDate, pendingGates.length,
  ]);

  // ==========================================
  // N-MODE: SECTION CONTENT BUILDER
  // ==========================================

  const nModeSectionsWithContent: NModeSection[] = useMemo(() => {
    return initiativeNSections.map((section) => {
      let component: React.ReactNode = null;

      switch (section.id) {
        case 'description-context': {
          component = (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                  {isPolish ? 'Opis i kontekst' : 'Description & Context'}
                </h2>
              </div>

              {/* 1) Problem */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      {isPolish ? 'Problem' : 'Problem'}
                    </label>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                      {isPolish ? 'Jaki problem rozwiązuje ta inicjatywa' : 'What problem does this initiative solve'}
                    </p>
                  </div>
                  <AIFieldEnhancer
                    fieldKey="initiative-problem"
                    sectionLabel={isPolish ? 'Problem' : 'Problem'}
                    currentValue={symptomDraft}
                    onApply={setSymptomDraft}
                    artifactContext={{ title: initiative?.name || '', status, priority, type: 'initiative' }}
                  />
                </div>
                <textarea
                  value={symptomDraft}
                  onChange={(e) => setSymptomDraft(e.target.value)}
                  rows={3}
                  className="w-full px-0 py-2 bg-transparent text-sm leading-relaxed text-slate-700 dark:text-slate-300 focus:outline-none placeholder-slate-400 dark:placeholder-slate-600 resize-y border-b border-slate-200 dark:border-navy-700/40 focus:border-primary-400 transition-colors min-h-[60px]"
                  placeholder={isPolish ? 'Jaki problem rozwiązujemy? Co jest nie tak?' : 'What problem are we solving? What is wrong?'}
                />
              </div>

              {/* 2) Proposed Solution */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      {isPolish ? 'Opis rozwiązania' : 'Proposed Solution'}
                    </label>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                      {isPolish ? 'Proponowane podejście i sposób realizacji' : 'Proposed approach and implementation method'}
                    </p>
                  </div>
                  <AIFieldEnhancer
                    fieldKey="initiative-proposed-solution"
                    sectionLabel={isPolish ? 'Opis rozwiązania' : 'Proposed Solution'}
                    currentValue={rootCauseDraft}
                    onApply={setRootCauseDraft}
                    artifactContext={{ title: initiative?.name || '', status, priority, type: 'initiative' }}
                  />
                </div>
                <textarea
                  value={rootCauseDraft}
                  onChange={(e) => setRootCauseDraft(e.target.value)}
                  rows={3}
                  className="w-full px-0 py-2 bg-transparent text-sm leading-relaxed text-slate-700 dark:text-slate-300 focus:outline-none placeholder-slate-400 dark:placeholder-slate-600 resize-y border-b border-slate-200 dark:border-navy-700/40 focus:border-primary-400 transition-colors min-h-[60px]"
                  placeholder={isPolish ? 'Jakie rozwiązanie proponujemy? Jakie podejście?' : 'What solution do we propose? What approach?'}
                />
              </div>

              {/* 3) Cost of Inaction */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      {isPolish ? 'Koszt bezczynności' : 'Cost of Inaction'}
                    </label>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                      {isPolish ? 'Konsekwencje braku działania' : 'Consequences of not taking action'}
                    </p>
                  </div>
                  <AIFieldEnhancer
                    fieldKey="initiative-cost-of-inaction"
                    sectionLabel={isPolish ? 'Koszt bezczynności' : 'Cost of Inaction'}
                    currentValue={costOfInactionDraft}
                    onApply={setCostOfInactionDraft}
                    artifactContext={{ title: initiative?.name || '', status, priority, type: 'initiative' }}
                  />
                </div>
                <textarea
                  value={costOfInactionDraft}
                  onChange={(e) => setCostOfInactionDraft(e.target.value)}
                  rows={3}
                  className="w-full px-0 py-2 bg-transparent text-sm leading-relaxed text-slate-700 dark:text-slate-300 focus:outline-none placeholder-slate-400 dark:placeholder-slate-600 resize-y border-b border-slate-200 dark:border-navy-700/40 focus:border-primary-400 transition-colors min-h-[60px]"
                  placeholder={isPolish ? 'Co się stanie jeśli nie podejmiemy działań?' : 'What happens if we do nothing?'}
                />
              </div>

              {/* 4) Market Context */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      {isPolish ? 'Kontekst rynkowy' : 'Market Context'}
                    </label>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                      {isPolish ? 'Otoczenie rynkowe, konkurencja i trendy' : 'Market environment, competition and trends'}
                    </p>
                  </div>
                  <AIFieldEnhancer
                    fieldKey="initiative-market-context"
                    sectionLabel={isPolish ? 'Kontekst rynkowy' : 'Market Context'}
                    currentValue={marketContextDraft}
                    onApply={setMarketContextDraft}
                    artifactContext={{ title: initiative?.name || '', status, priority, type: 'initiative' }}
                  />
                </div>
                <textarea
                  value={marketContextDraft}
                  onChange={(e) => setMarketContextDraft(e.target.value)}
                  rows={3}
                  className="w-full px-0 py-2 bg-transparent text-sm leading-relaxed text-slate-700 dark:text-slate-300 focus:outline-none placeholder-slate-400 dark:placeholder-slate-600 resize-y border-b border-slate-200 dark:border-navy-700/40 focus:border-primary-400 transition-colors min-h-[60px]"
                  placeholder={isPolish ? 'Kontekst rynkowy, konkurencja, trendy...' : 'Market context, competition, trends...'}
                />
              </div>
            </div>
          );
          break;
        }

        case 'target-success': {
          const mkId = () => Math.random().toString(36).substr(2, 9);
          const addTS = () => setTargetStateItems([...targetStateItems, { id: mkId(), text: '', done: false }]);
          const addSC = () => setSuccessCriteriaItems([...successCriteriaItems, { id: mkId(), text: '', done: false }]);
          const addDL = () => setDeliverableItems([...deliverableItems, { id: mkId(), text: '', done: false }]);
          const updateTS = (id: string, p: Partial<{ text: string; done: boolean }>) => setTargetStateItems(targetStateItems.map((c) => c.id === id ? { ...c, ...p } : c));
          const updateSC = (id: string, p: Partial<{ text: string; done: boolean }>) => setSuccessCriteriaItems(successCriteriaItems.map((c) => c.id === id ? { ...c, ...p } : c));
          const updateDL = (id: string, p: Partial<{ text: string; done: boolean }>) => setDeliverableItems(deliverableItems.map((d) => d.id === id ? { ...d, ...p } : d));
          const removeTS = (id: string) => setTargetStateItems(targetStateItems.filter((c) => c.id !== id));
          const removeSC = (id: string) => setSuccessCriteriaItems(successCriteriaItems.filter((c) => c.id !== id));
          const removeDL = (id: string) => setDeliverableItems(deliverableItems.filter((d) => d.id !== id));

          /* ── Reusable checklist item row ── */
          const renderItem = (
            item: { id: string; text: string; done: boolean },
            onUpdate: (id: string, p: Partial<{ text: string; done: boolean }>) => void,
            onRemove: (id: string) => void,
            placeholder: string,
          ) => (
            <div
              key={item.id}
              className={`group flex items-start gap-2.5 py-1.5 transition-all duration-200 ${item.done ? 'opacity-50 hover:opacity-70' : ''}`}
            >
              <button
                onClick={() => onUpdate(item.id, { done: !item.done })}
                className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                  item.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 dark:border-navy-600 hover:border-emerald-400'
                }`}
              >
                {item.done && (
                  <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
              <input
                type="text"
                value={item.text}
                onChange={(e) => onUpdate(item.id, { text: e.target.value })}
                placeholder={placeholder}
                className={`flex-1 bg-transparent text-sm leading-snug focus:outline-none placeholder-slate-400 dark:placeholder-slate-600 transition-colors ${
                  item.done ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-300'
                }`}
              />
              <button
                onClick={() => onRemove(item.id)}
                className="mt-0.5 opacity-0 group-hover:opacity-100 p-0.5 rounded-md hover:bg-red-50 dark:hover:bg-red-500/20 text-slate-400 hover:text-red-500 transition-all"
              >
                <Trash2 size={12} />
              </button>
            </div>
          );

          /* ── Reusable checklist block (identical for all 3) ── */
          const renderBlock = (
            labelEN: string,
            labelPL: string,
            descEN: string,
            descPL: string,
            items: { id: string; text: string; done: boolean }[],
            onUpdate: (id: string, p: Partial<{ text: string; done: boolean }>) => void,
            onRemove: (id: string) => void,
            onAdd: () => void,
            placeholderEN: string,
            placeholderPL: string,
            aiFieldKey: string,
            setItems: (items: { id: string; text: string; done: boolean }[]) => void,
          ) => (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                    {isPolish ? labelPL : labelEN}
                  </label>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    {isPolish ? descPL : descEN}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={onAdd}
                    className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                  >
                    <Plus size={14} />
                    {isPolish ? 'Dodaj' : 'Add item'}
                  </button>
                  <AIFieldEnhancer
                    fieldKey={aiFieldKey}
                    sectionLabel={isPolish ? labelPL : labelEN}
                    currentValue={items.map((c) => c.text).filter(Boolean).join('\n')}
                    onApply={(val) => {
                      const lines = val.split('\n').filter((l: string) => l.trim());
                      setItems(lines.map((t: string) => ({ id: mkId(), text: t.replace(/^[-•*]\s*/, ''), done: false })));
                    }}
                    artifactContext={{ title: initiative?.name || '', status, priority, type: 'initiative' }}
                  />
                </div>
              </div>
              <div className="border-b border-slate-200 dark:border-navy-700/40 pb-2 min-h-[40px]">
                {items.map((item) => renderItem(item, onUpdate, onRemove, isPolish ? placeholderPL : placeholderEN))}
              </div>
            </div>
          );

          component = (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                  {isPolish ? 'Kryteria sukcesu' : 'Success Criteria'}
                </h2>
              </div>

              {renderBlock(
                'Target State', 'Stan docelowy',
                'Desired end state after initiative completion', 'Pożądany stan końcowy po wdrożeniu inicjatywy',
                targetStateItems, updateTS, removeTS, addTS,
                'Target state item...', 'Element stanu docelowego...',
                'initiative-target-state', setTargetStateItems,
              )}

              {renderBlock(
                'Success Criteria', 'Kryteria sukcesu',
                'Measurable conditions to consider the initiative successful', 'Mierzalne warunki uznania inicjatywy za udaną',
                successCriteriaItems, updateSC, removeSC, addSC,
                'Success criterion...', 'Kryterium sukcesu...',
                'initiative-success-criteria', setSuccessCriteriaItems,
              )}

              {renderBlock(
                'Deliverables', 'Produkty',
                'Specific outputs and results to be delivered', 'Konkretne produkty i wyniki do dostarczenia',
                deliverableItems, updateDL, removeDL, addDL,
                'Deliverable...', 'Deliverable...',
                'initiative-deliverables', setDeliverableItems,
              )}
            </div>
          );
          break;
        }

        case 'scope-boundaries': {
          const mkId = () => Math.random().toString(36).substr(2, 9);
          const addInScope = () => setInScopeItems([...inScopeItems, '']);
          const addOutScope = () => setOutScopeItems([...outScopeItems, '']);
          const addKillCriteria = () => setKillCriteriaItems([...killCriteriaItems, '']);
          const updateInScope = (idx: number, val: string) => setInScopeItems(inScopeItems.map((v, i) => i === idx ? val : v));
          const updateOutScope = (idx: number, val: string) => setOutScopeItems(outScopeItems.map((v, i) => i === idx ? val : v));
          const updateKill = (idx: number, val: string) => setKillCriteriaItems(killCriteriaItems.map((v, i) => i === idx ? val : v));
          const removeInScope = (idx: number) => setInScopeItems(inScopeItems.filter((_, i) => i !== idx));
          const removeOutScope = (idx: number) => setOutScopeItems(outScopeItems.filter((_, i) => i !== idx));
          const removeKill = (idx: number) => setKillCriteriaItems(killCriteriaItems.filter((_, i) => i !== idx));

          /* ── Scope item row with colored dot ── */
          const renderScopeItem = (
            item: string,
            idx: number,
            onUpdate: (idx: number, val: string) => void,
            onRemove: (idx: number) => void,
            dotColor: 'emerald' | 'red',
            placeholder: string,
          ) => (
            <div key={idx} className="group flex items-center gap-2 py-1">
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                dotColor === 'emerald' ? 'bg-emerald-500' : 'bg-red-400'
              }`} />
              <input
                type="text"
                value={item}
                onChange={(e) => onUpdate(idx, e.target.value)}
                placeholder={placeholder}
                autoFocus={!item}
                className="flex-1 bg-transparent text-sm leading-snug focus:outline-none placeholder-slate-400 dark:placeholder-slate-600 text-slate-700 dark:text-slate-300"
              />
              <button
                onClick={() => onRemove(idx)}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded-md hover:bg-red-50 dark:hover:bg-red-500/20 text-slate-400 hover:text-red-500 transition-all"
              >
                <Trash2 size={12} />
              </button>
            </div>
          );

          component = (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                  {isPolish ? 'Zakres i ograniczenia' : 'Scope & Kill Criteria'}
                </h2>
              </div>

              {/* ── Two-column layout: In Scope | Out of Scope with vertical divider ── */}
              <div className="flex gap-0">
                {/* ── In Scope (left) ── */}
                <div className="flex-1 space-y-2 pr-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                      <div>
                        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                          {isPolish ? 'W zakresie' : 'In Scope'}
                        </label>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                          {isPolish ? 'Elementy, procesy i obszary objęte inicjatywą' : 'Elements, processes and areas included in this initiative'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={addInScope}
                        className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                      >
                        <Plus size={14} />
                        {isPolish ? 'Dodaj' : 'Add item'}
                      </button>
                      <AIFieldEnhancer
                        fieldKey="initiative-scope-in"
                        sectionLabel={isPolish ? 'W zakresie' : 'In Scope'}
                        currentValue={inScopeItems.filter(Boolean).join('\n')}
                        onApply={(val) => {
                          const lines = val.split('\n').filter((l: string) => l.trim());
                          setInScopeItems(lines.map((t: string) => t.replace(/^[-•*✓]\s*/, '')));
                        }}
                        artifactContext={{ title: initiative?.name || '', status, priority, type: 'initiative' }}
                      />
                    </div>
                  </div>
                  <div className="border-b border-slate-200 dark:border-navy-700/40 pb-2 min-h-[40px]">
                    {inScopeItems.map((item, i) => renderScopeItem(
                      item, i, updateInScope, removeInScope, 'emerald',
                      isPolish ? 'Element zakresu...' : 'Scope item...',
                    ))}
                    {inScopeItems.length === 0 && (
                      <p className="text-xs text-slate-400 dark:text-slate-500 italic py-2">
                        {isPolish ? 'Brak elementów' : 'No items yet'}
                      </p>
                    )}
                  </div>
                </div>

                {/* ── Vertical divider ── */}
                <div className="w-px bg-slate-200 dark:bg-navy-700/50 shrink-0" />

                {/* ── Out of Scope (right) ── */}
                <div className="flex-1 space-y-2 pl-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-red-400 shrink-0" />
                      <div>
                        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                          {isPolish ? 'Poza zakresem' : 'Out of Scope'}
                        </label>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                          {isPolish ? 'Wykluczenia i ograniczenia poza zakresem' : 'Exclusions and boundaries not covered'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={addOutScope}
                        className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                      >
                        <Plus size={14} />
                        {isPolish ? 'Dodaj' : 'Add item'}
                      </button>
                      <AIFieldEnhancer
                        fieldKey="initiative-scope-out"
                        sectionLabel={isPolish ? 'Poza zakresem' : 'Out of Scope'}
                        currentValue={outScopeItems.filter(Boolean).join('\n')}
                        onApply={(val) => {
                          const lines = val.split('\n').filter((l: string) => l.trim());
                          setOutScopeItems(lines.map((t: string) => t.replace(/^[-•*✗]\s*/, '')));
                        }}
                        artifactContext={{ title: initiative?.name || '', status, priority, type: 'initiative' }}
                      />
                    </div>
                  </div>
                  <div className="border-b border-slate-200 dark:border-navy-700/40 pb-2 min-h-[40px]">
                    {outScopeItems.map((item, i) => renderScopeItem(
                      item, i, updateOutScope, removeOutScope, 'red',
                      isPolish ? 'Wykluczenie...' : 'Exclusion...',
                    ))}
                    {outScopeItems.length === 0 && (
                      <p className="text-xs text-slate-400 dark:text-slate-500 italic py-2">
                        {isPolish ? 'Brak elementów' : 'No items yet'}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Horizontal separator ── */}
              <div className="border-t border-slate-200 dark:border-navy-700/50 mt-2" />

              {/* ── Kill Criteria (full width, below) ── */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                        {isPolish ? 'Kryteria rezygnacji (Kill Criteria)' : 'Kill Criteria'}
                      </label>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                        {isPolish
                          ? 'Warunki, których spełnienie oznacza natychmiastowe zatrzymanie inicjatywy'
                          : 'Conditions that trigger immediate initiative termination'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={addKillCriteria}
                      className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    >
                      <Plus size={14} />
                      {isPolish ? 'Dodaj' : 'Add item'}
                    </button>
                    <AIFieldEnhancer
                      fieldKey="initiative-kill-criteria"
                      sectionLabel={isPolish ? 'Kryteria rezygnacji' : 'Kill Criteria'}
                      currentValue={killCriteriaItems.filter(Boolean).join('\n')}
                      onApply={(val) => {
                        const lines = val.split('\n').filter((l: string) => l.trim());
                        setKillCriteriaItems(lines.map((t: string) => t.replace(/^[-•*!]\s*/, '')));
                      }}
                      artifactContext={{ title: initiative?.name || '', status, priority, type: 'initiative' }}
                    />
                  </div>
                </div>
                <div className="border-b border-red-200/40 dark:border-red-500/20 pb-2 min-h-[40px]">
                  {killCriteriaItems.map((item, i) => (
                    <div key={i} className="group flex items-center gap-2 py-1">
                      <AlertTriangle size={12} className="text-red-500 shrink-0" />
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => updateKill(i, e.target.value)}
                        placeholder={isPolish ? 'Kryterium rezygnacji...' : 'Kill criteria...'}
                        autoFocus={!item}
                        className="flex-1 bg-transparent text-sm leading-snug focus:outline-none placeholder-slate-400 dark:placeholder-slate-600 text-slate-700 dark:text-slate-300"
                      />
                      <button
                        onClick={() => removeKill(i)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded-md hover:bg-red-50 dark:hover:bg-red-500/20 text-slate-400 hover:text-red-500 transition-all"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  {killCriteriaItems.length === 0 && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 italic py-2">
                      {isPolish ? 'Brak kryteriów' : 'No criteria yet'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
          break;
        }

        case 'delivery-plan': {
          const TasksComp = SECTION_REGISTRY['tasks'];
          const tasksST = [...leftSections, ...rightSections].find((s) => s.key === 'tasks');
          component = (
            <div className="space-y-6">
              {/* Progress bar */}
              <div className="flex items-center gap-4">
                <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${tasks.length > 0 ? Math.round((tasksDone / tasks.length) * 100) : 0}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {tasksDone}/{tasks.length} {isPolish ? 'wykonane' : 'done'}
                </span>
                {tasksInProgress > 0 && (
                  <span className="text-xs text-blue-500">{tasksInProgress} {isPolish ? 'w toku' : 'in progress'}</span>
                )}
              </div>
              {/* Tasks section */}
              {tasksST && TasksComp && (
                <TasksComp sectionType={tasksST} expanded={true} onToggle={() => {}} />
              )}
              {/* Effort Profile */}
              {initiative?.effortProfile && (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 block">
                    {isPolish ? 'Profil wysiłku' : 'Effort Profile'}
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {Object.entries(initiative.effortProfile).map(([key, val]) => (
                      <div key={key} className="p-2.5 rounded-lg bg-white/60 dark:bg-navy-900/40 border border-slate-200 dark:border-navy-700/60">
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 capitalize mb-1">{key}</p>
                        <div className="h-1.5 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
                          <div className="h-full rounded-full bg-purple-500" style={{ width: `${val as number}%` }} />
                        </div>
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-0.5">{val as number}%</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
          break;
        }

        case 'dependencies': {
          const DepsTabComp = SECTION_REGISTRY['dependencies'];
          const depsTabST = [...leftSections, ...rightSections].find((s) => s.key === 'dependencies');
          const depsFallbackST = {
            id: 'dependencies',
            key: 'dependencies',
            name: 'Dependencies',
            namePl: 'Zależności',
            description: null,
            descriptionPl: null,
            category: 'content' as const,
            columnPosition: 'right' as const,
            defaultOrder: 60,
            icon: null,
            iconColor: null,
            iconBg: null,
            componentKey: 'dependencies',
            isSystem: false,
            isActive: true,
          };
          component = DepsTabComp ? (
            <div className="space-y-6">
              <DepsTabComp
                sectionType={depsTabST || depsFallbackST}
                expanded={true}
                onToggle={() => {}}
              />
            </div>
          ) : null;
          break;
        }

        case 'team': {
          const InitTeamComp = SECTION_REGISTRY['initiativeTeam'];
          const initTeamFallbackST = {
            id: 'initiativeTeam',
            key: 'initiativeTeam',
            name: 'Team',
            namePl: 'Zespół',
            description: null,
            descriptionPl: null,
            category: 'content' as const,
            columnPosition: 'right' as const,
            defaultOrder: 20,
            icon: null,
            iconColor: null,
            iconBg: null,
            componentKey: 'initiativeTeam',
            isSystem: false,
            isActive: true,
          };
          component = InitTeamComp ? (
            <InitTeamComp
              sectionType={initTeamFallbackST}
              expanded={true}
              onToggle={() => {}}
            />
          ) : null;
          break;
        }

        case 'raci-escalation': {
          const RaciComp = SECTION_REGISTRY['raciEscalation'];
          const raciFallbackST = {
            id: 'raciEscalation',
            key: 'raciEscalation',
            name: 'RACI & Escalation',
            namePl: 'RACI i eskalacja',
            description: null,
            descriptionPl: null,
            category: 'content' as const,
            columnPosition: 'right' as const,
            defaultOrder: 55,
            icon: null,
            iconColor: null,
            iconBg: null,
            componentKey: 'raciEscalation',
            isSystem: false,
            isActive: true,
          };
          component = RaciComp ? (
            <RaciComp
              sectionType={raciFallbackST}
              expanded={true}
              onToggle={() => {}}
            />
          ) : null;
          break;
        }

        case 'timeline-resources': {
          const TimelineComp = SECTION_REGISTRY['timeline'];
          const timelineST = [...leftSections, ...rightSections].find((s) => s.key === 'timeline');
          const ResourcesComp = SECTION_REGISTRY['resources'];
          const resourcesST = [...leftSections, ...rightSections].find((s) => s.key === 'resources');
          component = (
            <div className="space-y-6">
              {/* Timeline summary */}
              <div className="p-4 rounded-xl bg-white/70 dark:bg-navy-900/70 border border-slate-200 dark:border-navy-700/60">
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-slate-500 dark:text-slate-400">{isPolish ? 'Start:' : 'Start:'}</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {startDate ? new Date(startDate).toLocaleDateString(isPolish ? 'pl-PL' : 'en-GB') : '—'}
                  </span>
                  <span className="text-slate-700 dark:text-slate-300 dark:text-slate-600">→</span>
                  <span className="text-slate-500 dark:text-slate-400">{isPolish ? 'Termin:' : 'Target:'}</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {endDate ? new Date(endDate).toLocaleDateString(isPolish ? 'pl-PL' : 'en-GB') : (targetDate ? new Date(targetDate).toLocaleDateString(isPolish ? 'pl-PL' : 'en-GB') : '—')}
                  </span>
                  {initiative?.quarter && (
                    <>
                      <span className="text-slate-700 dark:text-slate-300 dark:text-slate-600">|</span>
                      <span className="px-2 py-0.5 rounded-lg text-[11px] bg-blue-500/10 text-blue-600 dark:text-blue-400">{initiative.quarter}</span>
                    </>
                  )}
                </div>
              </div>
              {/* Timeline section */}
              {timelineST && TimelineComp && (
                <TimelineComp sectionType={timelineST} expanded={true} onToggle={() => {}} />
              )}
              {/* Resources section */}
              {resourcesST && ResourcesComp && (
                <ResourcesComp sectionType={resourcesST} expanded={true} onToggle={() => {}} />
              )}
            </div>
          );
          break;
        }

        case 'economics-risk': {
          const FinAnalComp = SECTION_REGISTRY['financialAnalysis'];
          const finAnalST = [...leftSections, ...rightSections].find((s) => s.key === 'financialAnalysis');
          const FinImpComp = SECTION_REGISTRY['financialImpact'];
          const finImpST = [...leftSections, ...rightSections].find((s) => s.key === 'financialImpact');
          const RaidComp = SECTION_REGISTRY['raid'];
          const raidST = [...leftSections, ...rightSections].find((s) => s.key === 'raid');
          const PilotComp = SECTION_REGISTRY['pilot'];
          const pilotST = [...leftSections, ...rightSections].find((s) => s.key === 'pilot');
          component = (
            <div className="space-y-6">
              {/* Financial summary cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: 'CAPEX', value: initiative?.costCapex, format: 'currency' },
                  { label: 'OPEX', value: initiative?.costOpex || initiative?.firstYearOpex, format: 'currency' },
                  { label: isPolish ? 'Roczna korzyść' : 'Annual Benefit', value: initiative?.annualBenefit, format: 'currency' },
                  { label: 'ROI', value: initiative?.expectedRoi || initiative?.roi, format: 'multiplier' },
                ].map((card) => (
                  <div key={card.label} className="p-3 rounded-xl bg-white/70 dark:bg-navy-900/70 border border-slate-200 dark:border-navy-700/60 text-center">
                    <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{card.label}</p>
                    <p className="text-lg font-bold text-slate-800 dark:text-white">
                      {card.value != null
                        ? card.format === 'currency'
                          ? (card.value as number) >= 1_000_000 ? `$${((card.value as number) / 1_000_000).toFixed(1)}M` : (card.value as number) >= 1_000 ? `$${((card.value as number) / 1_000).toFixed(0)}K` : `$${card.value}`
                          : `${(card.value as number).toFixed(1)}x`
                        : '—'}
                    </p>
                  </div>
                ))}
              </div>
              {/* Financial Analysis */}
              {finAnalST && FinAnalComp && (
                <FinAnalComp sectionType={finAnalST} expanded={true} onToggle={() => {}} />
              )}
              {/* Financial Impact */}
              {finImpST && FinImpComp && (
                <FinImpComp sectionType={finImpST} expanded={true} onToggle={() => {}} />
              )}
              {/* RAID Log */}
              {raidST && RaidComp && (
                <RaidComp sectionType={raidST} expanded={true} onToggle={() => {}} />
              )}
              {/* Pilot */}
              {pilotST && PilotComp && (
                <PilotComp sectionType={pilotST} expanded={true} onToggle={() => {}} />
              )}
            </div>
          );
          break;
        }

        case 'governance-gates': {
          const GatesComp = SECTION_REGISTRY['gates'];
          const gatesST = [...leftSections, ...rightSections].find((s) => s.key === 'gates');
          const DecisionsComp = SECTION_REGISTRY['decisions'];
          const decisionsST = [...leftSections, ...rightSections].find((s) => s.key === 'decisions');
          const RemindersComp = SECTION_REGISTRY['reminders'];
          const remindersST = [...leftSections, ...rightSections].find((s) => s.key === 'reminders');
          component = (
            <div className="space-y-6">
              {/* Pending gates alert */}
              {pendingGates.length > 0 && (
                <div className="p-4 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-300/40 dark:border-amber-500/30">
                  <div className="flex items-center gap-3">
                    <AlertTriangle size={18} className="text-amber-500" />
                    <div>
                      <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                        {isPolish ? 'Wymagana decyzja bramkowa' : 'Gate decision required'}
                      </p>
                      <p className="text-xs text-amber-600/80 dark:text-amber-400/80">
                        {pendingGates.map((g) => g.label).join(', ')}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {/* Gates */}
              {gatesST && GatesComp && (
                <GatesComp sectionType={gatesST} expanded={true} onToggle={() => {}} />
              )}
              {/* Decisions */}
              {decisionsST && DecisionsComp && (
                <DecisionsComp sectionType={decisionsST} expanded={true} onToggle={() => {}} />
              )}
              {/* Reminders */}
              {remindersST && RemindersComp && (
                <RemindersComp sectionType={remindersST} expanded={true} onToggle={() => {}} />
              )}
            </div>
          );
          break;
        }

        case 'collaboration-audit': {
          const CommentsComp = SECTION_REGISTRY['comments'];
          const commentsST = [...leftSections, ...rightSections].find((s) => s.key === 'comments');
          const HistoryComp = SECTION_REGISTRY['history'];
          const historyST = [...leftSections, ...rightSections].find((s) => s.key === 'history');
          const AttachComp = SECTION_REGISTRY['attachments'];
          const attachST = [...leftSections, ...rightSections].find((s) => s.key === 'attachments');
          const LinkedComp = SECTION_REGISTRY['linkedItems'];
          const linkedST = [...leftSections, ...rightSections].find((s) => s.key === 'linkedItems');
          const TagsComp = SECTION_REGISTRY['tags'];
          const tagsST = [...leftSections, ...rightSections].find((s) => s.key === 'tags');
          component = (
            <div className="space-y-6">
              {/* Lessons Learned */}
              {(initiative?.lessonsLearned || initiative?.strategicSurprises || initiative?.nextTimeAvoid) && (
                <div className="space-y-3">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    {isPolish ? 'Wyciągnięte wnioski' : 'Lessons Learned'}
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {initiative?.lessonsLearned && (
                      <div className="p-3 rounded-xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-300/40 dark:border-emerald-500/30">
                        <p className="text-[10px] font-semibold text-emerald-500 uppercase mb-1">{isPolish ? 'Czego się nauczyliśmy' : 'What We Learned'}</p>
                        <p className="text-xs text-slate-700 dark:text-slate-300">{initiative.lessonsLearned}</p>
                      </div>
                    )}
                    {initiative?.strategicSurprises && (
                      <div className="p-3 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-300/40 dark:border-amber-500/30">
                        <p className="text-[10px] font-semibold text-amber-500 uppercase mb-1">{isPolish ? 'Co zaskoczyło' : 'Surprises'}</p>
                        <p className="text-xs text-slate-700 dark:text-slate-300">{initiative.strategicSurprises}</p>
                      </div>
                    )}
                    {initiative?.nextTimeAvoid && (
                      <div className="p-3 rounded-xl bg-red-500/5 dark:bg-red-500/10 border border-red-300/40 dark:border-red-500/30">
                        <p className="text-[10px] font-semibold text-red-500 uppercase mb-1">{isPolish ? 'Czego unikać' : 'Avoid Next Time'}</p>
                        <p className="text-xs text-slate-700 dark:text-slate-300">{initiative.nextTimeAvoid}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {/* Pattern Tags */}
              {initiative?.patternTags && initiative.patternTags.length > 0 && (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 block">
                    {isPolish ? 'Wzorce cross-initiative' : 'Cross-Initiative Patterns'}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {initiative.patternTags.map((tag: string, i: number) => (
                      <span key={i} className="px-2 py-0.5 rounded-lg text-[11px] bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-200/50 dark:border-purple-500/30">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {/* Comments */}
              {commentsST && CommentsComp && (
                <CommentsComp sectionType={commentsST} expanded={true} onToggle={() => {}} />
              )}
              {/* History */}
              {historyST && HistoryComp && (
                <HistoryComp sectionType={historyST} expanded={true} onToggle={() => {}} />
              )}
              {/* Attachments */}
              {attachST && AttachComp && (
                <AttachComp sectionType={attachST} expanded={true} onToggle={() => {}} />
              )}
              {/* Linked Items */}
              {linkedST && LinkedComp && (
                <LinkedComp sectionType={linkedST} expanded={true} onToggle={() => {}} />
              )}
              {/* Tags */}
              {tagsST && TagsComp && (
                <TagsComp sectionType={tagsST} expanded={true} onToggle={() => {}} />
              )}
            </div>
          );
          break;
        }

        case 'attachments': {
          component = (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                  {isPolish ? 'Załączniki' : 'Attachments'}
                </h2>
                <button className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/15 px-3 py-1.5 rounded-lg transition-all">
                  <Plus size={13} />
                  {isPolish ? 'Dodaj załącznik' : 'Add attachment'}
                </button>
              </div>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-navy-800 flex items-center justify-center mb-3">
                  <Paperclip size={20} className="text-slate-400 dark:text-slate-500" />
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                  {isPolish ? 'Brak załączników' : 'No attachments yet'}
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  {isPolish ? 'Dodaj pliki, dokumenty lub inne zasoby' : 'Add files, documents, or other resources'}
                </p>
              </div>
            </div>
          );
          break;
        }

        case 'links': {
          component = (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                  {isPolish ? 'Linki' : 'Links'}
                </h2>
                <button className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/15 px-3 py-1.5 rounded-lg transition-all">
                  <Plus size={13} />
                  {isPolish ? 'Dodaj link' : 'Add link'}
                </button>
              </div>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-navy-800 flex items-center justify-center mb-3">
                  <Link2 size={20} className="text-slate-400 dark:text-slate-500" />
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                  {isPolish ? 'Brak linków' : 'No links yet'}
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  {isPolish ? 'Dodaj linki do zewnętrznych zasobów, dokumentów lub narzędzi' : 'Add links to external resources, documents, or tools'}
                </p>
              </div>
            </div>
          );
          break;
        }

        case 'technical-description': {
          component = (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                  {isPolish ? 'Opis techniczny' : 'Technical Description'}
                </h2>
                <button className="inline-flex items-center gap-1.5 text-xs font-medium text-purple-500 dark:text-purple-400 hover:text-purple-600 bg-purple-50 dark:bg-purple-500/10 hover:bg-purple-100 dark:hover:bg-purple-500/15 px-3 py-1.5 rounded-lg transition-all">
                  <Sparkles size={13} />
                  {isPolish ? 'Generuj z AI' : 'Generate with AI'}
                </button>
              </div>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-navy-800 flex items-center justify-center mb-3">
                  <FileCode size={20} className="text-slate-400 dark:text-slate-500" />
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                  {isPolish ? 'Brak opisu technicznego' : 'No technical description yet'}
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  {isPolish ? 'Dodaj specyfikację techniczną, architekturę lub wymagania' : 'Add technical specification, architecture, or requirements'}
                </p>
              </div>
            </div>
          );
          break;
        }
      }

      return { ...section, component };
    });
  }, [
    initiativeNSections, initiative, isPolish, summary, setSummary,
    tasks, tasksDone, tasksInProgress, ownerName, startDate, endDate, targetDate,
    riskCount, criticalRaids, pendingGates, comments, users, sponsorId,
    leftSections, rightSections, decisions, raidItems, stakeholders,
    attachments, linkedItems,
    // Checklist & draft states — required so useMemo re-computes when items change
    targetStateItems, successCriteriaItems, deliverableItems,
    inScopeItems, outScopeItems, killCriteriaItems,
    symptomDraft, rootCauseDraft, costOfInactionDraft, marketContextDraft,
  ]);

  // N-mode status actions for NModeActionBar
  // Dynamically built from statusActions (workflow transitions) + contextActions (create buttons)
  const nModeActions: NModeAction[] = useMemo(() => {
    const actions: NModeAction[] = [];

    // Helper: pick icon based on action variant and target status
    const getActionIcon = (sa: StatusAction) => {
      if (sa.variant === 'danger' && sa.targetStatus === InitiativeStatus.CANCELLED) return XCircle;
      if (sa.variant === 'danger') return AlertTriangle;
      if (sa.variant === 'secondary' && sa.targetStatus === InitiativeStatus.DRAFT) return Undo2;
      if (sa.variant === 'secondary' && sa.targetStatus === InitiativeStatus.ARCHIVED) return Archive;
      if (sa.targetStatus === InitiativeStatus.EXECUTING) return Play;
      return CheckSquare;
    };

    // Helper: map StatusAction variant to NModeAction variant
    const mapVariant = (sa: StatusAction): 'success' | 'danger' | 'neutral' => {
      if (sa.variant === 'primary') return 'success';
      if (sa.variant === 'danger') return 'danger';
      return 'neutral';
    };

    // 1. Primary status actions first (forward progress)
    for (const sa of statusActions.filter((a) => a.variant === 'primary')) {
      actions.push({
        id: `status-${sa.targetStatus}`,
        label: { en: sa.label, pl: sa.labelPl },
        icon: getActionIcon(sa),
        variant: 'success',
        onClick: () => handleStatusAction(sa),
        disabled: isMutating,
      });
    }

    // 2. Context-dependent create actions (between status actions)
    if (contextActions.includes('task')) {
      actions.push({
        id: 'new-task',
        label: { en: 'New Task', pl: 'Nowe zadanie' },
        icon: CheckSquare,
        variant: 'neutral',
        onClick: () => { toggleSection('tasks'); setShowCreateTask(true); },
      });
    }
    if (contextActions.includes('decision')) {
      actions.push({
        id: 'new-decision',
        label: { en: 'New Decision', pl: 'Nowa decyzja' },
        icon: Scale,
        variant: 'neutral',
        onClick: () => { toggleSection('decisions'); setShowCreateDecision(true); },
      });
    }
    if (contextActions.includes('raid')) {
      actions.push({
        id: 'add-raid',
        label: { en: 'Add RAID', pl: 'Dodaj RAID' },
        icon: AlertTriangle,
        variant: 'neutral',
        onClick: () => { toggleSection('raid'); setShowCreateRaid(true); },
      });
    }

    // 3. Secondary actions (backward/alternative)
    for (const sa of statusActions.filter((a) => a.variant === 'secondary')) {
      actions.push({
        id: `status-${sa.targetStatus}-secondary`,
        label: { en: sa.label, pl: sa.labelPl },
        icon: getActionIcon(sa),
        variant: mapVariant(sa),
        onClick: () => handleStatusAction(sa),
        disabled: isMutating,
      });
    }

    // 4. Danger actions last (block, cancel, reject)
    for (const sa of statusActions.filter((a) => a.variant === 'danger')) {
      actions.push({
        id: `status-${sa.targetStatus}-danger`,
        label: { en: sa.label, pl: sa.labelPl },
        icon: getActionIcon(sa),
        variant: 'danger',
        onClick: () => handleStatusAction(sa),
        disabled: isMutating,
      });
    }

    return actions;
  }, [statusActions, contextActions, handleStatusAction, isMutating, toggleSection, setShowCreateTask, setShowCreateDecision, setShowCreateRaid]);

  // ==========================================
  // LOADING & ERROR STATES
  // ==========================================

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

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <InitiativeContext.Provider value={contextValue}>
      <div className="h-full overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950">
        {/* ═══════════════════════════════════════════════════════════════
            N-MODE RENDER
            ═══════════════════════════════════════════════════════════════ */}
        {presentationMode === 'n' ? (
          <div className="min-h-screen">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              {/* Breadcrumb showing source module context */}
              {sourceModule && sourceModule !== 'initiatives' && (
                <div className="flex items-center gap-1.5 mb-3 text-xs text-slate-400 dark:text-slate-500">
                  <button
                    onClick={onBack}
                    className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  >
                    {sourceModule === 'assessment' ? (isPolish ? 'Ocena' : 'Assessment') :
                     sourceModule === 'execution' ? (isPolish ? 'Realizacja' : 'Execution') :
                     sourceModule === 'benefits' ? (isPolish ? 'Korzyści' : 'Benefits') :
                     sourceModule === 'tools' ? (isPolish ? 'Narzędzia' : 'Tools') :
                     sourceModule}
                  </button>
                  <span className="text-slate-300 dark:text-slate-600">/</span>
                  <span className="text-slate-600 dark:text-slate-300 font-medium">
                    {initiative?.name || (isPolish ? 'Inicjatywa' : 'Initiative')}
                  </span>
                </div>
              )}
              <NModeHeader
                title={initiative?.name || ''}
                onTitleChange={() => {}}
                titleReadOnly
                artifactId={initiativeId}
                artifactType="initiative"
                onSave={handleSave}
                saving={isMutating}
                isDirty={
                  summary !== (initiative?.summary || initiative?.description || '') ||
                  description !== (initiative?.description || '') ||
                  priority !== (initiative?.priority || 'medium').toLowerCase() ||
                  ownerId !== (initiative?.ownerId || initiative?.owner_id || '') ||
                  sponsorId !== (initiative?.sponsorId || initiative?.sponsor_id || '') ||
                  targetDate !== (initiative?.plannedEndDate || initiative?.targetDate || '') ||
                  JSON.stringify(tags) !== JSON.stringify(initiative?.tags || [])
                }
                onChat={handleOpenChat}
                onClose={onBack || (() => {})}
                statusDotColor={statusMeta.dotColor}
                presentationMode={presentationMode}
                onPresentationModeChange={setPresentationMode}
                buildArtifactCode={buildArtifactCode}
              />

              <div className="col-span-full space-y-4 mt-4">
                <NModePropertiesStrip fields={nModePropertyFields} maxColumns={6} />

                {/* Action Bar — grouped: primary | context-create | secondary + danger | AI right-aligned */}
                <div className="px-4 py-3 rounded-2xl bg-white/80 dark:bg-navy-900/80 backdrop-blur-xl border border-slate-200 dark:border-navy-700/60">
                  <div className="flex items-center gap-2 flex-wrap">
                    {(() => {
                      const primaryGroup = nModeActions.filter((a) => a.variant === 'success');
                      const contextGroup = nModeActions.filter((a) => a.variant === 'neutral');
                      const dangerGroup = nModeActions.filter((a) => a.variant === 'danger');

                      const renderButton = (action: NModeAction) => {
                        const Icon = action.icon;
                        const variantClasses = action.variant === 'success'
                          ? 'border-emerald-400/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
                          : action.variant === 'danger'
                            ? 'border-red-400/50 text-red-600 dark:text-red-400 hover:bg-red-500/10'
                            : 'border-slate-300/50 dark:border-navy-600/60 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800/60';
                        return (
                          <button
                            key={action.id}
                            onClick={action.onClick}
                            disabled={action.disabled}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${variantClasses} disabled:opacity-50`}
                          >
                            <Icon size={13} />
                            <span>{isPolish ? action.label.pl : action.label.en}</span>
                          </button>
                        );
                      };

                      return (
                        <>
                          {primaryGroup.map(renderButton)}
                          {primaryGroup.length > 0 && contextGroup.length > 0 && (
                            <div key="sep-1" className="w-px h-5 bg-slate-200 dark:bg-navy-700 mx-0.5" />
                          )}
                          {contextGroup.map(renderButton)}
                          {(primaryGroup.length > 0 || contextGroup.length > 0) && dangerGroup.length > 0 && (
                            <div key="sep-2" className="w-px h-5 bg-slate-200 dark:bg-navy-700 mx-0.5" />
                          )}
                          {dangerGroup.map(renderButton)}

                          {/* Right-aligned AI Generate button */}
                          <div className="flex-1" />
                          <button
                            onClick={async () => {
                              const result = await handleGenerateAI('overview');
                              if (result?.parsedContent || result?.content) {
                                toast.success(isPolish ? 'AI wygenerował treść' : 'AI generated content');
                              }
                            }}
                            disabled={isGeneratingAI === 'overview'}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-violet-400/50 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 transition-colors disabled:opacity-50"
                          >
                            {isGeneratingAI === 'overview' ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Sparkles size={13} />
                            )}
                            <span>{isPolish ? 'Analyze with AI' : 'Analyze with AI'}</span>
                          </button>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* LeftNav + Canvas */}
                <div className="flex gap-0 min-h-[60vh]">
                  <NModeLeftNav
                    sections={nModeSectionsWithContent}
                    activeSection={activeNSection}
                    onSectionChange={setActiveNSection}
                  />
                  <NModeCanvas
                    sections={nModeSectionsWithContent}
                    activeSection={activeNSection}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
        /* ═══════════════════════════════════════════════════════════════
            C-MODE RENDER (legacy D-mode cards + scroll)
            ═══════════════════════════════════════════════════════════════ */
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div
            className={
              cModeLayout === 'cards' ? 'grid grid-cols-1 lg:grid-cols-3 gap-6' : 'flex flex-col gap-6'
            }
          >
            {/* ====== HEADER - Full Width ====== */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:col-span-3 bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 p-5"
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
                  <ArtifactPermalinkButton
                    artifactType="initiative"
                    artifactId={initiativeId}
                    isPolish={isPolish}
                    size={13}
                  />
                </div>
                <div className="flex items-center gap-3">
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
                  >
                    {isMutating ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Save size={16} />
                    )}
                    <span>{isPolish ? 'Zapisz' : 'Save'}</span>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleOpenChat}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/70 dark:bg-navy-900/50 border border-purple-500/40 dark:border-purple-400/30 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 dark:hover:bg-purple-500/10 text-sm font-semibold transition-all shadow-sm"
                  >
                    <MessageSquare size={16} />
                    <span>{isPolish ? 'Czat' : 'Chat'}</span>
                  </motion.button>
                  {/* Presentation mode switcher (N/C) */}
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-slate-100 dark:bg-navy-800 border border-slate-200 dark:border-navy-700/60">
                    <button
                      onClick={() => setPresentationMode('n')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${presentationMode === 'n' ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                      N
                    </button>
                    <button
                      onClick={() => setPresentationMode('c')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${presentationMode === 'c' ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                      C
                    </button>
                  </div>
                  {/* B7.4: Toggle assessment summary panel */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowAssessmentPanel((p) => !p)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all border ${
                      showAssessmentPanel
                        ? 'bg-violet-500/15 border-violet-500/40 text-violet-600 dark:text-violet-400'
                        : 'bg-white/70 dark:bg-navy-900/50 border-slate-200 dark:border-navy-700 text-slate-500 dark:text-slate-400 hover:text-slate-600'
                    }`}
                    title={isPolish ? 'Panel oceny' : 'Assessment panel'}
                  >
                    <Sparkles size={16} />
                  </motion.button>
                  {/* B7.3: RowActionsMenu — z-50, no overlay issues */}
                  <RowActionsMenu
                    actions={
                      [
                        {
                          id: 'new-task',
                          label: isPolish ? 'Nowe zadanie' : 'New Task',
                          icon: CheckSquare,
                          variant: 'primary',
                          onClick: () => {
                            toggleSection('tasks');
                            setShowCreateTask(true);
                          },
                        },
                        {
                          id: 'new-decision',
                          label: isPolish ? 'Nowa decyzja' : 'New Decision',
                          icon: Scale,
                          onClick: () => {
                            toggleSection('decisions');
                            setShowCreateDecision(true);
                          },
                        },
                        {
                          id: 'add-raid',
                          label: isPolish ? 'Dodaj RAID' : 'Add RAID',
                          icon: AlertTriangle,
                          onClick: () => {
                            toggleSection('raid');
                            setShowCreateRaid(true);
                          },
                        },
                        {
                          id: 'new-tab',
                          label: isPolish ? 'Nowa karta' : 'New tab',
                          icon: ExternalLink,
                          divider: true,
                          onClick: () => window.open(window.location.href, '_blank'),
                        },
                        {
                          id: 'copy-link',
                          label: isPolish ? 'Kopiuj link' : 'Copy link',
                          icon: Copy,
                          onClick: handleCopyLink,
                        },
                        {
                          id: 'export-pdf',
                          label: 'PDF',
                          icon: Download,
                          onClick: handleExportPDF,
                        },
                        {
                          id: 'archive',
                          label: isPolish ? 'Archiwizuj' : 'Archive',
                          icon: Archive,
                          variant: 'danger' as const,
                          divider: true,
                          onClick: handleArchive,
                        },
                        ...(status === 'DRAFT'
                          ? [
                              {
                                id: 'delete',
                                label: isPolish ? 'Usuń' : 'Delete',
                                icon: Trash2,
                                variant: 'danger' as const,
                                onClick: handleDelete,
                              },
                            ]
                          : []),
                      ] as RowAction[]
                    }
                    size="md"
                  />
                </div>
              </div>
            </motion.div>

            {/* ====== B7.2: Key Info Bar — 5 sections always visible ====== */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
            >
              {/* 1. Goal / Objective */}
              <div className="p-3 rounded-xl bg-white/70 dark:bg-navy-900/70 backdrop-blur border border-slate-200 dark:border-navy-700/60 shadow-sm">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="p-1 rounded-lg bg-blue-500/10">
                    <Target size={14} className="text-blue-500" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {isPolish ? 'Cel' : 'Goal'}
                  </span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-2 leading-relaxed">
                  {summary ||
                    initiative?.strategicIntent ||
                    initiative?.description ||
                    (isPolish ? 'Brak opisu' : 'No description')}
                </p>
              </div>

              {/* 2. Tasks */}
              <div className="p-3 rounded-xl bg-white/70 dark:bg-navy-900/70 backdrop-blur border border-slate-200 dark:border-navy-700/60 shadow-sm">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="p-1 rounded-lg bg-emerald-500/10">
                    <CheckSquare size={14} className="text-emerald-500" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {isPolish ? 'Zadania' : 'Tasks'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-slate-800 dark:text-white">
                    {tasksDone}/{tasks.length}
                  </span>
                  {tasks.length > 0 && (
                    <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{
                          width: `${tasks.length > 0 ? Math.round((tasksDone / tasks.length) * 100) : 0}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
                {tasksInProgress > 0 && (
                  <p className="text-[10px] text-blue-500 mt-0.5">
                    {tasksInProgress} {isPolish ? 'w toku' : 'in progress'}
                  </p>
                )}
              </div>

              {/* 3. Team */}
              <div className="p-3 rounded-xl bg-white/70 dark:bg-navy-900/70 backdrop-blur border border-slate-200 dark:border-navy-700/60 shadow-sm">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="p-1 rounded-lg bg-purple-500/10">
                    <Users size={14} className="text-purple-500" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {isPolish ? 'Zespół' : 'Team'}
                  </span>
                </div>
                <div className="space-y-0.5">
                  {ownerName ? (
                    <p className="text-xs text-slate-700 dark:text-slate-300 truncate">
                      <span className="text-slate-500 dark:text-slate-400">{isPolish ? 'Właściciel:' : 'Owner:'}</span>{' '}
                      {ownerName}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {isPolish ? 'Brak właściciela' : 'No owner'}
                    </p>
                  )}
                  {sponsorName && (
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                      {isPolish ? 'Sponsor:' : 'Sponsor:'} {sponsorName}
                    </p>
                  )}
                </div>
              </div>

              {/* 4. Resources */}
              <div className="p-3 rounded-xl bg-white/70 dark:bg-navy-900/70 backdrop-blur border border-slate-200 dark:border-navy-700/60 shadow-sm">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="p-1 rounded-lg bg-cyan-500/10">
                    <Calendar size={14} className="text-cyan-500" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {isPolish ? 'Zasoby' : 'Resources'}
                  </span>
                </div>
                <div className="space-y-0.5">
                  {startDate || endDate ? (
                    <p className="text-xs text-slate-700 dark:text-slate-300">
                      {startDate
                        ? new Date(startDate).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                          })
                        : '?'}
                      {' → '}
                      {endDate
                        ? new Date(endDate).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                          })
                        : '?'}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400">{isPolish ? 'Brak dat' : 'No dates'}</p>
                  )}
                  {milestones.length > 0 && (
                    <p className="text-[10px] text-purple-500">
                      {milestones.length} {isPolish ? 'kamieni milowych' : 'milestones'}
                    </p>
                  )}
                </div>
              </div>

              {/* 5. Finances / Risk */}
              <div className="p-3 rounded-xl bg-white/70 dark:bg-navy-900/70 backdrop-blur border border-slate-200 dark:border-navy-700/60 shadow-sm">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="p-1 rounded-lg bg-amber-500/10">
                    <DollarSign size={14} className="text-amber-500" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {isPolish ? 'Finanse / Ryzyko' : 'Finance / Risk'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {initiative?.costCapex || initiative?.cost_capex ? (
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {(() => {
                        const amt = initiative.costCapex || initiative.cost_capex || 0;
                        if (amt >= 1_000_000) return `$${(amt / 1_000_000).toFixed(1)}M`;
                        if (amt >= 1_000) return `$${(amt / 1_000).toFixed(0)}K`;
                        return `$${amt}`;
                      })()}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500 dark:text-slate-400">—</span>
                  )}
                  {(riskCount > 0 || issueCount > 0) && (
                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${criticalRaids > 0 ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}
                    >
                      {riskCount}R / {issueCount}I
                    </span>
                  )}
                </div>
                {initiative?.expectedRoi || initiative?.expected_roi ? (
                  <p className="text-[10px] text-emerald-500 mt-0.5">
                    ROI: {(initiative.expectedRoi || initiative.expected_roi || 0).toFixed(1)}x
                  </p>
                ) : null}
              </div>
            </motion.div>

            {cModeLayout === 'cards' ? (
              <>
                {/* ====== LEFT COLUMN - Dynamic Content Sections ====== */}
                <div className="lg:col-span-2 space-y-4 order-2 lg:order-1">
                  {leftSections.map((sectionType) => {
                    const Component = SECTION_REGISTRY[sectionType.componentKey];
                    if (!Component) return null;
                    return (
                      <Component
                        key={sectionType.key}
                        sectionType={sectionType}
                        expanded={expandedSections.has(sectionType.key)}
                        onToggle={() => toggleSection(sectionType.key)}
                      />
                    );
                  })}
                </div>

                {/* ====== RIGHT COLUMN - Dynamic Control/Meta Sections ====== */}
                <div className="lg:col-span-1 space-y-4 order-1 lg:order-2">
                  {/* Gate Alert Banner (always check, regardless of sections) */}
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

                  {rightSections.map((sectionType) => {
                    const Component = SECTION_REGISTRY[sectionType.componentKey];
                    if (!Component) return null;
                    return (
                      <Component
                        key={sectionType.key}
                        sectionType={sectionType}
                        expanded={expandedSections.has(sectionType.key)}
                        onToggle={() => toggleSection(sectionType.key)}
                      />
                    );
                  })}
                </div>
              </>
            ) : (
              /* ====== SCROLL DOCUMENT VIEW ====== */
              <InitiativeScrollView leftSections={leftSections} rightSections={rightSections} />
            )}
          </div>

          {/* ====== B7.4: Assessment Summary Panel (right side, C-mode only) ====== */}
          <AnimatePresence>
            {showAssessmentPanel && (
              <motion.aside
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 40 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="fixed right-0 top-0 h-full w-80 bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl border-l border-slate-200 dark:border-navy-700 shadow-2xl z-40 overflow-y-auto"
              >
                <div className="p-5 space-y-5">
                  {/* Panel Header */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                      <Sparkles size={16} className="text-violet-500" />
                      {isPolish ? 'Podsumowanie oceny' : 'Assessment Summary'}
                    </h3>
                    <button
                      onClick={() => setShowAssessmentPanel(false)}
                      className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {/* Readiness Score */}
                  <div className="p-4 rounded-xl bg-gradient-to-br from-violet-500/5 to-purple-500/5 dark:from-violet-500/10 dark:to-purple-500/10 border border-violet-200/50 dark:border-violet-500/20">
                    <p className="text-[10px] font-semibold text-violet-500 uppercase tracking-wider mb-2">
                      {isPolish ? 'Gotowość inicjatywy' : 'Initiative Readiness'}
                    </p>
                    <div className="flex items-end gap-2 mb-2">
                      <span className="text-3xl font-bold text-slate-800 dark:text-white">
                        {(() => {
                          let score = 0;
                          if (summary) score += 15;
                          if (ownerName) score += 15;
                          if (sponsorName) score += 10;
                          if (tasks.length > 0) score += 15;
                          if (startDate && endDate) score += 10;
                          if (initiative?.costCapex || initiative?.cost_capex) score += 10;
                          if (raidItems.length > 0) score += 10;
                          if (decisions.length > 0) score += 10;
                          if (stakeholders.length > 0) score += 5;
                          return Math.min(score, 100);
                        })()}
                        %
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                        {isPolish ? 'kompletność' : 'completeness'}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all"
                        style={{
                          width: `${(() => {
                            let score = 0;
                            if (summary) score += 15;
                            if (ownerName) score += 15;
                            if (sponsorName) score += 10;
                            if (tasks.length > 0) score += 15;
                            if (startDate && endDate) score += 10;
                            if (initiative?.costCapex || initiative?.cost_capex) score += 10;
                            if (raidItems.length > 0) score += 10;
                            if (decisions.length > 0) score += 10;
                            if (stakeholders.length > 0) score += 5;
                            return Math.min(score, 100);
                          })()}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Checklist */}
                  <div>
                    <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                      {isPolish ? 'Lista kontrolna' : 'Checklist'}
                    </p>
                    <div className="space-y-1.5">
                      {[
                        { label: isPolish ? 'Opis / cel' : 'Description / goal', done: !!summary },
                        { label: isPolish ? 'Właściciel' : 'Owner assigned', done: !!ownerName },
                        { label: isPolish ? 'Sponsor' : 'Sponsor assigned', done: !!sponsorName },
                        { label: isPolish ? 'Zadania' : 'Tasks defined', done: tasks.length > 0 },
                        {
                          label: isPolish ? 'Harmonogram' : 'Timeline set',
                          done: !!(startDate && endDate),
                        },
                        {
                          label: isPolish ? 'Budżet' : 'Budget defined',
                          done: !!(initiative?.costCapex || initiative?.cost_capex),
                        },
                        {
                          label: isPolish ? 'Ryzyka' : 'Risks identified',
                          done: raidItems.filter((r) => r.type === 'risk').length > 0,
                        },
                        {
                          label: isPolish ? 'Decyzje' : 'Decisions linked',
                          done: decisions.length > 0,
                        },
                        {
                          label: isPolish ? 'Interesariusze' : 'Stakeholders',
                          done: stakeholders.length > 0,
                        },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center gap-2 text-xs">
                          <div
                            className={`w-4 h-4 rounded-full flex items-center justify-center ${item.done ? 'bg-emerald-500/20 text-emerald-500' : 'bg-slate-200 dark:bg-navy-700 text-slate-500 dark:text-slate-400'}`}
                          >
                            {item.done ? '✓' : '○'}
                          </div>
                          <span
                            className={
                              item.done ? 'text-slate-700 dark:text-slate-300' : 'text-slate-500 dark:text-slate-400'
                            }
                          >
                            {item.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div>
                    <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                      {isPolish ? 'Statystyki' : 'Quick Stats'}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-navy-800/50 text-center">
                        <p className="text-lg font-bold text-slate-800 dark:text-white">
                          {tasks.length}
                        </p>
                        <p className="text-[9px] text-slate-500 dark:text-slate-400">
                          {isPolish ? 'Zadania' : 'Tasks'}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-navy-800/50 text-center">
                        <p className="text-lg font-bold text-slate-800 dark:text-white">
                          {decisions.length}
                        </p>
                        <p className="text-[9px] text-slate-500 dark:text-slate-400">
                          {isPolish ? 'Decyzje' : 'Decisions'}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-navy-800/50 text-center">
                        <p
                          className={`text-lg font-bold ${criticalRaids > 0 ? 'text-red-500' : 'text-slate-800 dark:text-white'}`}
                        >
                          {raidItems.length}
                        </p>
                        <p className="text-[9px] text-slate-500 dark:text-slate-400">RAID</p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-navy-800/50 text-center">
                        <p className="text-lg font-bold text-slate-800 dark:text-white">
                          {stakeholders.length}
                        </p>
                        <p className="text-[9px] text-slate-500 dark:text-slate-400">
                          {isPolish ? 'Interesariusze' : 'Stakeholders'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Pending Gates */}
                  {pendingGates.length > 0 && (
                    <div className="p-3 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-200/50 dark:border-amber-500/20">
                      <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider mb-1.5">
                        {isPolish ? 'Oczekujące bramki' : 'Pending Gates'}
                      </p>
                      {pendingGates.map((g) => (
                        <div
                          key={g.id}
                          className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400"
                        >
                          <AlertTriangle size={12} />
                          <span>{g.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.aside>
            )}
          </AnimatePresence>
        </div>
        )}
      </div>
    </InitiativeContext.Provider>
  );
};
