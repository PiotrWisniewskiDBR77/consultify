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
  Bell,
  BellOff,
  CheckSquare,
  ChevronLeft,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  MessageSquare,
  MoreVertical,
  Save,
  Scale,
  Share2,
  Sparkles,
  Trash2,
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

import {
  InitiativeContext,
  SECTION_REGISTRY,
  DEFAULT_VISIBLE_SECTIONS,
  DEFAULT_SECTION_ORDER,
  getModuleFromStatus,
  MODULE_CONFIG,
  GATE_DEFINITIONS,
  GATE_CONFIG,
  getNextGateForStatus,
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

  // UI state
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

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskIsMilestone, setNewTaskIsMilestone] = useState(false);
  const [newTaskMilestoneDate, setNewTaskMilestoneDate] = useState('');
  const [newDecisionTitle, setNewDecisionTitle] = useState('');
  const [newDecisionType, setNewDecisionType] = useState('GOVERNANCE_DECISION_MAKING');
  const [newRaidTitle, setNewRaidTitle] = useState('');
  const [newRaidType, setNewRaidType] = useState<'risk' | 'issue' | 'assumption' | 'dependency'>('risk');
  const [newRaidSeverity, setNewRaidSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [newRaidDescription, setNewRaidDescription] = useState('');

  const [currentUserId] = useState<string>('current-user');

  // ==========================================
  // COMPUTED VALUES
  // ==========================================

  const status = (initiative?.status || 'DRAFT') as InitiativeStatus;
  const statusMeta = getStatusMeta(status);
  const statusActions = getStatusActions(status);
  const primaryActions = statusActions.filter((a) => a.variant === 'primary').slice(0, 2);
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

  const tasksDone = useMemo(() => tasks.filter((t) => t.status === 'done' || t.status === 'DONE').length, [tasks]);
  const tasksInProgress = useMemo(() => tasks.filter((t) => t.status === 'in_progress' || t.status === 'IN_PROGRESS').length, [tasks]);
  const milestones = useMemo(() => tasks.filter((t) => t.isMilestone), [tasks]);
  const riskCount = useMemo(() => raidItems.filter((r) => r.type === 'risk').length, [raidItems]);
  const issueCount = useMemo(() => raidItems.filter((r) => r.type === 'issue').length, [raidItems]);
  const criticalRaids = useMemo(() => raidItems.filter((r) => r.severity === 'CRITICAL' || r.severity === 'HIGH').length, [raidItems]);
  const ownerName = useMemo(() => { const user = users.find((u) => u.id === ownerId); return user ? `${user.firstName} ${user.lastName}` : ''; }, [users, ownerId]);
  const sponsorName = useMemo(() => { const user = users.find((u) => u.id === sponsorId); return user ? `${user.firstName} ${user.lastName}` : ''; }, [users, sponsorId]);

  const isWatching = useMemo(() => watchers.some((w) => w.userId === currentUserId), [watchers, currentUserId]);

  const requiredGates = useMemo(() => GATE_DEFINITIONS.filter((g) => g.forStatus === status), [status]);
  const pendingGates = useMemo(
    () => requiredGates.filter((g) => { const match = decisions.find((d) => d.type === g.pmoDomain); return !match || match.status === 'PENDING'; }),
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
    const resolvedTypes: SectionTypeInfo[] = sectionTypes.length > 0
      ? sectionTypes
      : Object.keys(DEFAULT_VISIBLE_SECTIONS).map((key) => ({
          id: `default-${key}`,
          key,
          name: key,
          namePl: null,
          description: null,
          descriptionPl: null,
          category: 'content' as const,
          columnPosition: (DEFAULT_SECTION_ORDER[key] !== undefined && ['control', 'team', 'timeline', 'resources', 'stakeholders', 'dependencies', 'attachments', 'linkedItems', 'tags', 'reminders', 'watchers'].includes(key) ? 'right' : 'left') as 'left' | 'right',
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
      .sort((a, b) => (sectionOrder[a.key] ?? a.defaultOrder) - (sectionOrder[b.key] ?? b.defaultOrder));

    const right = visible
      .filter((st) => st.columnPosition === 'right')
      .sort((a, b) => (sectionOrder[a.key] ?? a.defaultOrder) - (sectionOrder[b.key] ?? b.defaultOrder));

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
      setTags(data.tags || []);
      const rawPriority = (data.priority || 'medium').toLowerCase();
      setPriority(rawPriority);
      setOwnerId(data.ownerId || data.owner_id || '');
      setSponsorId(data.sponsorId || data.sponsor_id || '');
      setTargetDate(data.plannedEndDate || data.targetDate || '');

      // Fetch related data (best-effort, parallel)
      const fetches = [
        Api.get(`/decisions?relatedObjectId=${initiativeId}&relatedObjectType=initiative`).then((ds: any) => setDecisions(Array.isArray(ds) ? ds : ds?.decisions || [])).catch(() => setDecisions([])),
        Api.get(`/initiatives/${initiativeId}/raid`).then((r: any) => setRaidItems(r?.items || r?.raid || (Array.isArray(r) ? r : []))).catch(() => setRaidItems([])),
        Api.get(`/initiatives/${initiativeId}/watchers`).then((w: any) => setWatchers(w?.watchers || (Array.isArray(w) ? w : []))).catch(() => setWatchers([])),
        Api.get(`/initiatives/${initiativeId}/history`).then((h: any) => setHistory(h?.events || h?.history || (Array.isArray(h) ? h : []))).catch(() => setHistory([])),
        Api.get(`/tasks?initiativeId=${initiativeId}`).then((ts: any) => {
          const taskList = Array.isArray(ts) ? ts : ts?.tasks || [];
          setTasks(taskList.map((t: any) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, dueDate: t.dueDate, assigneeName: t.assigneeName || t.assignee?.name, isMilestone: t.isMilestone || false, milestoneDate: t.milestoneDate })));
        }).catch(() => setTasks([])),
        Api.get(`/initiatives/${initiativeId}/stakeholders`).then((st: any) => {
          const mapped: Stakeholder[] = (st?.stakeholders || (Array.isArray(st) ? st : [])).map((s: any) => ({
            id: s.id, decisionId: initiativeId, userId: s.userId || s.user_id,
            userName: s.name || `${s.firstName || ''} ${s.lastName || ''}`.trim(), userEmail: s.email,
            role: (s.role === 'R' ? 'responsible' : s.role === 'A' ? 'accountable' : s.role === 'C' ? 'consulted' : 'informed') as StakeholderRole,
            notificationSettings: { email: true, inApp: true, slack: false },
          }));
          setStakeholders(mapped);
        }).catch(() => setStakeholders([])),
        Api.get('/users').then((u: any) => setUsers(Array.isArray(u) ? u : u?.users || [])).catch(() => setUsers([])),
        Api.get(`/decisions?relatedObjectId=${initiativeId}&relatedObjectType=initiative&type=GATE_APPROVAL`).then((ad: any) => {
          const approvals = (Array.isArray(ad) ? ad : ad?.decisions || [])
            .filter((d: any) => d.status === 'PENDING')
            .map((d: any) => ({ id: d.id, gateType: d.gateType || d.metadata?.gateType || 'UNKNOWN', gateName: d.title, requiredRole: d.metadata?.requiredRole || 'sponsor', status: d.status, requestedAt: d.createdAt, deciderId: d.deciderId, deciderName: d.deciderName || d.decider?.name, dueDate: d.dueDate }));
          setPendingApprovals(approvals);
        }).catch(() => setPendingApprovals([])),
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
    if (!tplId) { setInitiativeTemplate(null); return; }
    let cancelled = false;
    Api.get(`/initiatives/templates/${encodeURIComponent(String(tplId))}`)
      .then((resp: any) => { if (!cancelled) setInitiativeTemplate(resp?.template || null); })
      .catch(() => { if (!cancelled) setInitiativeTemplate(null); });
    return () => { cancelled = true; };
  }, [initiative?.initiativeTemplateId, initiative?.initiative_template_id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ==========================================
  // HANDLERS
  // ==========================================

  const handleStatusAction = async (action: StatusAction) => {
    setIsMutating(true);
    try {
      await Api.patch(`/initiatives/${initiativeId}`, { status: action.targetStatus });
      setInitiative((prev: any) => ({ ...prev, status: action.targetStatus }));
      onStatusChange?.(action.targetStatus);
      toast.success(isPolish ? 'Status zaktualizowany' : 'Status updated');
      fetchAll();
    } catch (e: any) { toast.error(e?.message || 'Failed to update status'); }
    finally { setIsMutating(false); }
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
        const res = await Api.post(`/initiatives/${initiativeId}/watchers`, { userId: currentUserId });
        setWatchers((prev) => [...prev, res]);
        toast.success(isPolish ? 'Obserwujesz inicjatywę' : 'Now watching');
      }
    } catch (e: any) { toast.error(e?.message || 'Failed'); }
    finally { setIsMutating(false); }
  };

  const handleSave = async () => {
    setIsMutating(true);
    try {
      await Api.patch(`/initiatives/${initiativeId}`, { summary, description, tags, priority, ownerId, sponsorId, plannedEndDate: targetDate });
      toast.success(isPolish ? 'Zapisano' : 'Saved');
    } catch (e: any) { toast.error(e?.message || 'Failed to save'); }
    finally { setIsMutating(false); }
  };

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) return;
    setIsMutating(true);
    try {
      const res = await Api.post('/tasks', { title: newTaskTitle, initiativeId, status: 'todo', isMilestone: newTaskIsMilestone, milestoneDate: newTaskIsMilestone ? newTaskMilestoneDate : undefined });
      setTasks((prev) => [...prev, { id: res.id, title: res.title, status: res.status, isMilestone: res.isMilestone, milestoneDate: res.milestoneDate }]);
      setNewTaskTitle(''); setNewTaskIsMilestone(false); setNewTaskMilestoneDate(''); setShowCreateTask(false);
      toast.success(isPolish ? 'Zadanie utworzone' : 'Task created');
    } catch (e: any) { toast.error(e?.message || 'Failed'); }
    finally { setIsMutating(false); }
  };

  const handleCreateDecision = async () => {
    if (!newDecisionTitle.trim()) return;
    setIsMutating(true);
    try {
      const res = await Api.post('/decisions', { title: newDecisionTitle, type: newDecisionType, relatedObjectId: initiativeId, relatedObjectType: 'initiative', status: 'PENDING' });
      setDecisions((prev) => [...prev, res]);
      setNewDecisionTitle(''); setShowCreateDecision(false);
      toast.success(isPolish ? 'Decyzja utworzona' : 'Decision created');
    } catch (e: any) { toast.error(e?.message || 'Failed'); }
    finally { setIsMutating(false); }
  };

  const handleCreateRaid = async () => {
    if (!newRaidTitle.trim()) return;
    setIsMutating(true);
    try {
      const res = await Api.post(`/initiatives/${initiativeId}/raid`, { type: newRaidType, title: newRaidTitle, description: newRaidDescription, severity: newRaidSeverity, status: 'OPEN' });
      setRaidItems((prev) => [...prev, res]);
      setNewRaidTitle(''); setNewRaidDescription(''); setShowCreateRaid(false);
      toast.success(isPolish ? 'Element RAID dodany' : 'RAID item added');
    } catch (e: any) { toast.error(e?.message || 'Failed'); }
    finally { setIsMutating(false); }
  };

  const handleAddComment = async (content: string) => {
    const newComment: Comment = { id: Math.random().toString(36).substr(2, 9), content, authorId: currentUserId, authorName: 'Current User', createdAt: new Date().toISOString(), likes: 0, likedByMe: false };
    setComments((prev) => [...prev, newComment]);
  };

  const handleCopyLink = () => { navigator.clipboard.writeText(window.location.href); toast.success(isPolish ? 'Link skopiowany' : 'Link copied'); setShowMoreMenu(false); };
  const handleExportPDF = () => { toast.success(isPolish ? 'Eksport PDF w przygotowaniu...' : 'Preparing PDF export...'); setShowMoreMenu(false); };

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
          setSummary(result.parsedContent || result.content);
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
      toast.error(e?.message || 'AI generation failed');
      return null;
    } finally {
      setIsGeneratingAI(null);
    }
  };

  const handleRequestApproval = async (role: 'owner' | 'sponsor', gateType: string) => {
    setIsMutating(true);
    try {
      const targetUserId = role === 'owner' ? ownerId : sponsorId;
      if (!targetUserId) { toast.error(isPolish ? `Wybierz ${role === 'owner' ? 'właściciela' : 'sponsora'}` : `Select ${role} first`); return; }
      await Api.post('/decisions', { title: `${gateType} - ${initiative?.name}`, type: gateType, relatedObjectId: initiativeId, relatedObjectType: 'initiative', status: 'PENDING', deciderId: targetUserId, dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() });
      toast.success(isPolish ? 'Wysłano prośbę o zatwierdzenie' : 'Approval request sent');
      fetchAll();
    } catch (e: any) { toast.error(e?.message || 'Failed to request approval'); }
    finally { setIsMutating(false); }
  };

  const handleOpenChat = () => {
    if (isChatCollapsed) toggleChatCollapse();
    updateWorkspaceFromView(AppView.INITIATIVE_GENERATOR, initiativeId, {
      type: 'initiative', id: initiativeId, title: initiative?.name || '', status, phase: isPolish ? moduleConfig.labelPl : moduleConfig.label,
      summary, tasksCount: tasks.length, tasksDone, decisionsCount: decisions.length, raidCount: raidItems.length,
    });
  };

  const handleArchive = async () => {
    if (!confirm(isPolish ? 'Czy na pewno chcesz zarchiwizować tę inicjatywę?' : 'Are you sure you want to archive this initiative?')) return;
    setIsMutating(true);
    try { await Api.patch(`/initiatives/${initiativeId}`, { status: 'ARCHIVED' }); toast.success(isPolish ? 'Inicjatywa zarchiwizowana' : 'Initiative archived'); setShowMoreMenu(false); fetchAll(); }
    catch (e: any) { toast.error(e?.message || 'Failed'); }
    finally { setIsMutating(false); }
  };

  const handleDelete = async () => {
    if (status !== 'DRAFT') { toast.error(isPolish ? 'Można usunąć tylko szkice' : 'Only drafts can be deleted'); return; }
    if (!confirm(isPolish ? 'Czy na pewno chcesz usunąć tę inicjatywę?' : 'Are you sure you want to delete this initiative?')) return;
    setIsMutating(true);
    try { await Api.delete(`/initiatives/${initiativeId}`); toast.success(isPolish ? 'Inicjatywa usunięta' : 'Initiative deleted'); setShowMoreMenu(false); onBack?.(); }
    catch (e: any) { toast.error(e?.message || 'Failed'); }
    finally { setIsMutating(false); }
  };

  // ==========================================
  // CONTEXT VALUE
  // ==========================================

  const contextValue = useMemo(() => ({
    initiative, initiativeId, initiativeTemplate, isPolish,
    decisions, setDecisions, raidItems, setRaidItems, watchers, setWatchers,
    history, tasks, setTasks, comments, setComments, linkedItems, setLinkedItems,
    attachments, setAttachments, stakeholders, setStakeholders, dependencies, setDependencies,
    tags, setTags, users, pendingApprovals,
    summary, setSummary, description, setDescription, priority, setPriority,
    ownerId, setOwnerId, sponsorId, setSponsorId, targetDate, setTargetDate,
    reminders, setReminders, escalation, setEscalation, thresholds, setThresholds,
    expandedSections, toggleSection, isGeneratingAI, isMutating, currentUserId,
    status, ownerName, sponsorName, tasksDone, tasksInProgress, milestones,
    riskCount, issueCount, criticalRaids, isWatching, pendingGates, statusActions, primaryActions,
    handleSave, handleStatusAction, handleToggleWatch, handleGenerateAI,
    handleCreateTask, handleCreateDecision, handleCreateRaid, handleAddComment,
    handleRequestApproval, handleOpenChat, handleArchive, handleDelete,
    handleCopyLink, handleExportPDF, fetchAll,
    newTaskTitle, setNewTaskTitle, newTaskIsMilestone, setNewTaskIsMilestone,
    newTaskMilestoneDate, setNewTaskMilestoneDate, showCreateTask, setShowCreateTask,
    newDecisionTitle, setNewDecisionTitle, newDecisionType, setNewDecisionType,
    showCreateDecision, setShowCreateDecision,
    newRaidTitle, setNewRaidTitle, newRaidType, setNewRaidType,
    newRaidSeverity, setNewRaidSeverity, newRaidDescription, setNewRaidDescription,
    showCreateRaid, setShowCreateRaid,
    showMoreMenu, setShowMoreMenu, showStatusDropdown, setShowStatusDropdown,
    showPriorityDropdown, setShowPriorityDropdown, showPhaseDropdown, setShowPhaseDropdown,
    showApprovalWorkflow, setShowApprovalWorkflow,
    newTag, setNewTag,
    onBack, onStatusChange, onOpenTask, onOpenDecision,
  }), [
    initiative, initiativeId, initiativeTemplate, isPolish,
    decisions, raidItems, watchers, history, tasks, comments, linkedItems,
    attachments, stakeholders, dependencies, tags, users, pendingApprovals,
    summary, description, priority, ownerId, sponsorId, targetDate,
    reminders, escalation, thresholds,
    expandedSections, toggleSection, isGeneratingAI, isMutating, currentUserId,
    status, ownerName, sponsorName, tasksDone, tasksInProgress, milestones,
    riskCount, issueCount, criticalRaids, isWatching, pendingGates, statusActions, primaryActions,
    handleSave, handleStatusAction, handleToggleWatch, handleGenerateAI,
    handleCreateTask, handleCreateDecision, handleCreateRaid, handleAddComment,
    handleRequestApproval, handleOpenChat, handleArchive, handleDelete,
    handleCopyLink, handleExportPDF, fetchAll,
    newTaskTitle, newTaskIsMilestone, newTaskMilestoneDate, showCreateTask,
    newDecisionTitle, newDecisionType, showCreateDecision,
    newRaidTitle, newRaidType, newRaidSeverity, newRaidDescription, showCreateRaid,
    showMoreMenu, showStatusDropdown, showPriorityDropdown, showPhaseDropdown, showApprovalWorkflow,
    newTag, onBack, onStatusChange, onOpenTask, onOpenDecision,
  ]);

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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* ====== HEADER - Full Width ====== */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:col-span-3 bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 p-5"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {onBack && (
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={onBack} className="p-2 rounded-xl bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors">
                      <ChevronLeft size={20} className="text-slate-500" />
                    </motion.button>
                  )}
                  <div className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${moduleConfig.bgLight} ${moduleConfig.textColor}`}>
                    {isPolish ? moduleConfig.labelPl : moduleConfig.label}
                  </div>
                  <input type="text" value={initiative.name || ''} readOnly className="flex-1 text-xl font-bold text-slate-800 dark:text-white bg-transparent border-none focus:outline-none truncate" />
                </div>
                <div className="flex items-center gap-3">
                  <div className={`flex items-center gap-2.5 px-4 py-2 rounded-xl border-2 ${statusMeta.bgColor} ${statusMeta.dotColor.replace('bg-', 'border-').replace('-400', '-500/50')} transition-all`}>
                    <div className={`w-2.5 h-2.5 rounded-full ${statusMeta.dotColor} animate-pulse`} />
                    <span className={`text-sm font-semibold ${statusMeta.color}`}>{statusMeta.label}</span>
                  </div>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleSave} disabled={isMutating}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/70 dark:bg-navy-900/50 border border-blue-500/40 dark:border-blue-400/30 text-blue-700 dark:text-blue-300 hover:bg-blue-500/10 dark:hover:bg-blue-500/10 text-sm font-semibold transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed">
                    {isMutating ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    <span>{isPolish ? 'Zapisz' : 'Save'}</span>
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleOpenChat}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/70 dark:bg-navy-900/50 border border-purple-500/40 dark:border-purple-400/30 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 dark:hover:bg-purple-500/10 text-sm font-semibold transition-all shadow-sm">
                    <MessageSquare size={16} />
                    <span>{isPolish ? 'Czat' : 'Chat'}</span>
                  </motion.button>
                  {/* More Menu */}
                  <div className="relative">
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setShowMoreMenu(!showMoreMenu)}
                      className="p-2 rounded-xl bg-white/70 dark:bg-navy-900/50 text-slate-400 hover:text-slate-600 border border-slate-200 dark:border-navy-700 transition-all">
                      <MoreVertical size={18} />
                    </motion.button>
                    <AnimatePresence>
                      {showMoreMenu && (
                        <motion.div initial={{ opacity: 0, y: -8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.95 }}
                          className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-navy-800 rounded-xl shadow-xl border border-slate-200 dark:border-navy-600 py-1 z-50 max-h-80 overflow-y-auto">
                          <button onClick={() => { setShowMoreMenu(false); toggleSection('tasks'); setShowCreateTask(true); }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10">
                            <CheckSquare size={16} />{isPolish ? 'Nowe zadanie' : 'New Task'}
                          </button>
                          <button onClick={() => { setShowMoreMenu(false); toggleSection('decisions'); setShowCreateDecision(true); }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10">
                            <Scale size={16} />{isPolish ? 'Nowa decyzja' : 'New Decision'}
                          </button>
                          <button onClick={() => { setShowMoreMenu(false); toggleSection('raid'); setShowCreateRaid(true); }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10">
                            <AlertTriangle size={16} />{isPolish ? 'Dodaj RAID' : 'Add RAID'}
                          </button>
                          <div className="border-t border-slate-100 dark:border-navy-700 my-1" />
                          <button onClick={() => { setShowMoreMenu(false); window.open(window.location.href, '_blank'); }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700">
                            <ExternalLink size={16} />{isPolish ? 'Nowa karta' : 'New tab'}
                          </button>
                          <button onClick={() => { setShowMoreMenu(false); handleCopyLink(); }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700">
                            <Copy size={16} />{isPolish ? 'Kopiuj link' : 'Copy link'}
                          </button>
                          <button onClick={() => { setShowMoreMenu(false); handleExportPDF(); }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700">
                            <Download size={16} />PDF
                          </button>
                          <div className="border-t border-slate-100 dark:border-navy-700 my-1" />
                          <button onClick={() => { setShowMoreMenu(false); handleArchive(); }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10">
                            <Archive size={16} />{isPolish ? 'Archiwizuj' : 'Archive'}
                          </button>
                          {status === 'DRAFT' && (
                            <button onClick={() => { setShowMoreMenu(false); handleDelete(); }}
                              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10">
                              <Trash2 size={16} />{isPolish ? 'Usuń' : 'Delete'}
                            </button>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </motion.div>

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
          </div>
        </div>
      </div>
    </InitiativeContext.Provider>
  );
};
