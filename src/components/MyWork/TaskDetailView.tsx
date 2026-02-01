/**
 * TaskDetailView
 * Full-page task detail view following Decision Panel Golden Standard
 * Two-column layout with collapsible sections
 * Tech-sexy UI with gradients and glassmorphism
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  Clock,
  Edit3,
  ExternalLink,
  Eye,
  FileText,
  Flag,
  GitBranch,
  History,
  Layers,
  Link2,
  Loader2,
  MessageSquare,
  Minus,
  Pause,
  Play,
  Plus,
  Save,
  Scale,
  Search,
  Share2,
  Sparkles,
  Tag,
  Target,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { InitiativeService } from '@/services/initiativeService';
import { useAppStore } from '@/store/useAppStore';
import { useConversationStore } from '@/store/useConversationStore';
import { AppView } from '@/types';

import {
  type Alternative,
  AlternativesSection,
  type Attachment,
  AttachmentsSection,
  type Comment,
  CommentsSection,
  DeadlineAlertBanner,
  DependenciesSection,
  type EscalationRule,
  EscalationRulesSection,
  type EvidenceItem,
  EvidenceSection,
  type EvidenceType,
  type ImplementationIdea,
  ImplementationIdeasSection,
  type LinkedItem,
  LinkedItemsSection,
  type ReminderRule,
  RiskAssessmentCompact,
  type RiskItem,
  type Stakeholder,
  type StakeholderNotificationSettings,
  type StakeholderRole,
  StakeholdersSection,
  type TaskDependency,
  type WarningThresholds,
} from './shared';

interface TaskDetailViewProps {
  taskId: string | null;
  onClose: () => void;
  onSaved?: (data: any) => void;
  onOpenDecision?: (decisionId: string) => void;
}

// Status configuration
const STATUS_CONFIG = {
  todo: {
    label: { en: 'To Do', pl: 'Do zrobienia' },
    color: 'bg-slate-400',
    textColor: 'text-slate-500',
    icon: CheckSquare,
  },
  in_progress: {
    label: { en: 'In Progress', pl: 'W trakcie' },
    color: 'bg-blue-500',
    textColor: 'text-blue-500',
    icon: Clock,
  },
  review: {
    label: { en: 'Review', pl: 'Przegląd' },
    color: 'bg-purple-500',
    textColor: 'text-purple-500',
    icon: Edit3,
  },
  done: {
    label: { en: 'Done', pl: 'Ukończone' },
    color: 'bg-emerald-500',
    textColor: 'text-emerald-500',
    icon: CheckCircle2,
  },
  blocked: {
    label: { en: 'Blocked', pl: 'Zablokowane' },
    color: 'bg-red-500',
    textColor: 'text-red-500',
    icon: AlertCircle,
  },
};

const PRIORITY_CONFIG = {
  low: {
    label: { en: 'Low', pl: 'Niski' },
    color: 'bg-slate-400',
    textColor: 'text-slate-500',
  },
  medium: {
    label: { en: 'Medium', pl: 'Średni' },
    color: 'bg-blue-400',
    textColor: 'text-blue-500',
  },
  high: {
    label: { en: 'High', pl: 'Wysoki' },
    color: 'bg-orange-400',
    textColor: 'text-orange-500',
  },
  critical: {
    label: { en: 'Critical', pl: 'Krytyczny' },
    color: 'bg-red-500',
    textColor: 'text-red-500',
  },
};

const normalizePriority = (priority?: string | null): keyof typeof PRIORITY_CONFIG => {
  if (!priority) return 'medium';
  const normalized = priority.toLowerCase();
  if (normalized === 'urgent') return 'critical';
  if (normalized in PRIORITY_CONFIG) return normalized as keyof typeof PRIORITY_CONFIG;
  return 'medium';
};

export const TaskDetailView: React.FC<TaskDetailViewProps> = ({
  taskId,
  onClose,
  onSaved,
  onOpenDecision,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const { isChatCollapsed, toggleChatCollapse } = useAppStore();
  const { updateWorkspaceFromView } = useConversationStore();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<keyof typeof STATUS_CONFIG>('todo');
  const [priority, setPriority] = useState<keyof typeof PRIORITY_CONFIG>('medium');
  const [dueDate, setDueDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [blockedReason, setBlockedReason] = useState('');

  // People
  const [ownerId, setOwnerId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [users, setUsers] = useState<
    { id: string; firstName: string; lastName: string; email?: string }[]
  >([]);

  // Initiative (parent)
  const [initiativeId, setInitiativeId] = useState<string | null>(null);
  const [initiativeName, setInitiativeName] = useState<string | null>(null);
  const [availableInitiatives, setAvailableInitiatives] = useState<
    { id: string; name: string; type: string }[]
  >([]);
  const [showInitiativeDropdown, setShowInitiativeDropdown] = useState(false);

  // Context
  const [projectId, setProjectId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [createdBy, setCreatedBy] = useState('');
  const [createdAt, setCreatedAt] = useState('');

  // Checklist
  const [checklist, setChecklist] = useState<{ id: string; text: string; completed: boolean }[]>(
    []
  );

  // Tags
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');

  // Escalation & Reminders
  const [reminders, setReminders] = useState<ReminderRule[]>([]);
  const [escalation, setEscalation] = useState<EscalationRule | null>(null);
  const [thresholds, setThresholds] = useState<WarningThresholds>({
    warningDays: 3,
    criticalDays: 1,
    showOverdueAlert: true,
  });

  // Attachments, Comments, Links
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [linkedItems, setLinkedItems] = useState<LinkedItem[]>([]);

  // Stakeholders
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);

  // Decision blocking (legacy)
  const [blockedByDecisionId, setBlockedByDecisionId] = useState<string>('');

  // Related Decisions
  interface RelatedDecision {
    id: string;
    decisionId: string;
    decisionTitle: string;
    decisionStatus: 'pending' | 'approved' | 'rejected' | 'deferred' | 'escalated';
    relationshipType: 'blocks' | 'requires' | 'informs' | 'depends_on';
    note?: string;
  }
  const [relatedDecisions, setRelatedDecisions] = useState<RelatedDecision[]>([]);
  const [showDecisionSearch, setShowDecisionSearch] = useState(false);
  const [decisionSearchQuery, setDecisionSearchQuery] = useState('');
  const [showCreateDecision, setShowCreateDecision] = useState(false);
  const [newDecisionTitle, setNewDecisionTitle] = useState('');
  const [newDecisionDescription, setNewDecisionDescription] = useState('');
  const [newDecisionRelationType, setNewDecisionRelationType] = useState<
    'blocks' | 'requires' | 'informs' | 'depends_on'
  >('requires');
  const [availableDecisions, setAvailableDecisions] = useState<
    { id: string; title: string; status: string }[]
  >([
    { id: 'dec-1', title: 'Zatwierdzenie budżetu Q2', status: 'pending' },
    { id: 'dec-2', title: 'Wybór dostawcy chmury', status: 'pending' },
    { id: 'dec-3', title: 'Go-Live Date Approval', status: 'approved' },
    { id: 'dec-4', title: 'Zatrudnienie Senior Dev', status: 'pending' },
  ]);

  // New sections state
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [alternatives, setAlternatives] = useState<Alternative[]>([]);
  const [selectedAlternativeId, setSelectedAlternativeId] = useState<string>('');
  const [implementationIdeas, setImplementationIdeas] = useState<ImplementationIdea[]>([]);
  const [dependencies, setDependencies] = useState<TaskDependency[]>([]);
  const [expectedOutcome, setExpectedOutcome] = useState('');

  // Evidence & Acceptance
  const [evidenceRequired, setEvidenceRequired] = useState<EvidenceType[]>([]);
  const [evidenceItems, setEvidenceItems] = useState<EvidenceItem[]>([]);
  const [requiresAcceptance, setRequiresAcceptance] = useState(false);
  const [acceptanceType, setAcceptanceType] = useState<'manual' | 'automatic' | null>(null);
  const [acceptorId, setAcceptorId] = useState<string | null>(null);
  const [signedOff, setSignedOff] = useState(false);
  const [signedOffAt, setSignedOffAt] = useState<string | undefined>();
  const [signedOffBy, setSignedOffBy] = useState<string | undefined>();

  // Generation states
  const [isGeneratingRisks, setIsGeneratingRisks] = useState(false);
  const [isGeneratingAlternatives, setIsGeneratingAlternatives] = useState(false);
  const [isGeneratingIdeas, setIsGeneratingIdeas] = useState(false);
  const [isGeneratingAIComment, setIsGeneratingAIComment] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [isGeneratingOutcome, setIsGeneratingOutcome] = useState(false);
  const [isGeneratingChecklist, setIsGeneratingChecklist] = useState(false);

  // Activity Log
  interface ActivityLogEntry {
    id: string;
    type:
      | 'created'
      | 'status_change'
      | 'assignment'
      | 'comment'
      | 'edit'
      | 'attachment'
      | 'deadline'
      | 'priority';
    description: string;
    userId?: string;
    userName?: string;
    timestamp: string;
    oldValue?: string;
    newValue?: string;
  }
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([
    {
      id: '1',
      type: 'created',
      description: isPolish ? 'Zadanie utworzone' : 'Task created',
      userName: createdBy || 'System',
      timestamp: createdAt || new Date().toISOString(),
    },
  ]);

  // Activity Log helper
  const addActivityLogEntry = (
    type: ActivityLogEntry['type'],
    description: string,
    oldValue?: string,
    newValue?: string
  ) => {
    const entry: ActivityLogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      description,
      timestamp: new Date().toISOString(),
      userName: 'Current User',
      oldValue,
      newValue,
    };
    setActivityLog((prev) => [entry, ...prev]);
  };

  // UI State
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set([]));

  // Load data
  useEffect(() => {
    loadUsers();
    loadInitiatives();
  }, []);

  useEffect(() => {
    if (taskId) {
      loadTask(taskId);
    } else {
      resetForm();
    }
  }, [taskId]);

  const loadUsers = async () => {
    try {
      const response = await Api.get('/users');
      const usersArray = Array.isArray(response) ? response : response?.users || [];
      setUsers(
        usersArray.map((u: any) => ({
          id: u.id,
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email,
        }))
      );
    } catch (error) {
      console.error('Failed to load users', error);
    }
  };

  const loadInitiatives = async () => {
    try {
      const data = await InitiativeService.getAll();
      const initiativesArray = Array.isArray(data) ? data : (data as any)?.initiatives || [];
      setAvailableInitiatives(
        initiativesArray.map((i: any) => ({
          id: i.id,
          name: i.name,
          type: i.type || 'project',
        }))
      );
    } catch (error) {
      console.error('Failed to load initiatives', error);
    }
  };

  const loadTask = async (id: string) => {
    try {
      setLoading(true);
      const task = await Api.get(`/tasks/${id}`);
      setTitle(task.title || '');
      setDescription(task.description || '');
      setStatus(task.status || 'todo');
      setPriority(normalizePriority(task.priority));
      setDueDate(task.dueDate ? task.dueDate.split('T')[0] : '');
      setStartDate(task.startedAt ? task.startedAt.split('T')[0] : '');
      setBlockedReason(task.blockedReason || '');
      setOwnerId(task.ownerId || task.assigneeId || '');
      setAssigneeId(task.assigneeId || '');
      setInitiativeId(task.initiativeId || null);
      setProjectId(task.projectId || '');
      setProjectName(task.projectName || '');
      setCreatedBy(task.createdByName || task.createdBy || '');
      setCreatedAt(task.createdAt || '');
      setTags(task.tags || []);
      setChecklist(task.checklist || []);
      setAttachments(task.attachments || []);
      setComments(task.comments || []);
      setLinkedItems(task.linkedItems || []);
      setBlockedByDecisionId(task.blockedByDecisionId || '');

      // Set initiative name if found
      if (task.initiativeId) {
        const init = availableInitiatives.find((i) => i.id === task.initiativeId);
        setInitiativeName(init?.name || null);
      }
    } catch (error) {
      console.error('Failed to load task', error);
      toast.error(isPolish ? 'Nie udało się załadować zadania' : 'Failed to load task');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setStatus('todo');
    setPriority('medium');
    setDueDate('');
    setStartDate('');
    setBlockedReason('');
    setOwnerId('');
    setAssigneeId('');
    setInitiativeId(null);
    setInitiativeName(null);
    setProjectId('');
    setProjectName('');
    setTags([]);
    setChecklist([]);
    setAttachments([]);
    setComments([]);
    setLinkedItems([]);
    setStakeholders([]);
    setReminders([]);
    setEscalation(null);
    setBlockedByDecisionId('');
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error(isPolish ? 'Tytuł jest wymagany' : 'Title is required');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        title,
        description,
        status,
        priority,
        dueDate: dueDate || null,
        startedAt: startDate || null,
        blockedReason: status === 'blocked' ? blockedReason : '',
        tags,
        checklist,
        initiativeId: initiativeId || null,
        assigneeId: assigneeId || null,
        ownerId: ownerId || null,
      };

      // Always persist a local draft before attempting network save (offline safety net)
      try {
        const draftKey = `consultinity-task-draft:${taskId || 'new'}`;
        localStorage.setItem(
          draftKey,
          JSON.stringify({
            schemaVersion: 1,
            source: 'save',
            savedAt: new Date().toISOString(),
            taskId: taskId || null,
            projectId: projectId || null,
            initiativeId: initiativeId || null,
            draft: {
              ...payload,
              projectId: projectId || null,
              initiativeName,
              projectName,
              createdBy,
              createdAt,
              // Extra editable state (best-effort snapshot)
              blockedByDecisionId,
              attachments,
              comments,
              linkedItems,
              stakeholders,
              reminders,
              escalation,
              thresholds,
            },
          })
        );
      } catch (e) {
        // Local draft is best-effort; don't block Save on storage errors
        console.warn('[TaskDetailView] Failed to persist local draft', e);
      }

      if (taskId) {
        await Api.put(`/tasks/${taskId}`, payload);
        toast.success(isPolish ? 'Zadanie zaktualizowane' : 'Task updated');
      } else {
        await Api.post('/tasks', { ...payload, projectId: projectId || null });
        toast.success(isPolish ? 'Zadanie utworzone' : 'Task created');
      }
      onSaved?.({ ...payload, id: taskId });
    } catch (error) {
      console.error('Failed to save task', error);
      toast.error(isPolish ? 'Nie udało się zapisać zadania' : 'Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChat = async () => {
    // Persist local draft so user never loses input (even offline)
    const draftKey = `consultinity-task-draft:${taskId || 'new'}`;
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          schemaVersion: 1,
          source: 'chat',
          savedAt: new Date().toISOString(),
          taskId: taskId || null,
          projectId: projectId || null,
          initiativeId: initiativeId || null,
          draft: {
            title,
            description,
            status,
            priority,
            dueDate: dueDate || null,
            startedAt: startDate || null,
            blockedReason: status === 'blocked' ? blockedReason : '',
            tags,
            checklist,
            initiativeId: initiativeId || null,
            initiativeName,
            assigneeId: assigneeId || null,
            ownerId: ownerId || null,
            projectId: projectId || null,
            projectName,
            blockedByDecisionId,
            attachments,
            comments,
            linkedItems,
            stakeholders,
            reminders,
            escalation,
            thresholds,
          },
        })
      );
    } catch (e) {
      console.warn('[TaskDetailView] Failed to persist local draft (chat)', e);
    }

    // Ensure chat panel is visible
    if (isChatCollapsed) {
      toggleChatCollapse();
    }

    // Push rich task context into the unified chat workspace context (no extra buttons needed)
    updateWorkspaceFromView(AppView.MY_WORK, taskId || 'new', {
      type: 'task',
      id: taskId || null,
      title,
      description,
      status,
      priority,
      dueDate: dueDate || null,
      startedAt: startDate || null,
      blockedReason: status === 'blocked' ? blockedReason : '',
      tags,
      checklist,
      initiativeId: initiativeId || null,
      initiativeName,
      projectId: projectId || null,
      projectName,
      blockedByDecisionId,
    });

    toast.success(isPolish ? 'Zapisano roboczo i otwarto czat' : 'Draft saved and chat opened');
  };

  // Section toggle
  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  // Checklist handlers
  const addChecklistItem = () => {
    setChecklist([
      ...checklist,
      { id: Math.random().toString(36).substr(2, 9), text: '', completed: false },
    ]);
  };

  const updateChecklistItem = (id: string, updates: Partial<(typeof checklist)[0]>) => {
    setChecklist(checklist.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  };

  const removeChecklistItem = (id: string) => {
    setChecklist(checklist.filter((item) => item.id !== id));
  };

  // Tags handlers
  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  // Calculate progress from checklist
  const checklistProgress = useMemo(() => {
    if (checklist.length === 0) return 0;
    return Math.round((checklist.filter((c) => c.completed).length / checklist.length) * 100);
  }, [checklist]);

  // Attachment handlers
  const handleUploadAttachments = async (files: FileList) => {
    const newAttachments: Attachment[] = Array.from(files).map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      type: file.type,
      size: file.size,
      url: URL.createObjectURL(file),
      uploadedAt: new Date().toISOString(),
    }));
    setAttachments([...attachments, ...newAttachments]);
  };

  const handleDeleteAttachment = async (id: string) => {
    setAttachments(attachments.filter((a) => a.id !== id));
  };

  // Comment handlers
  const handleAddComment = async (content: string, parentId?: string) => {
    const newComment: Comment = {
      id: Math.random().toString(36).substr(2, 9),
      content,
      authorId: 'current-user',
      authorName: 'Current User',
      createdAt: new Date().toISOString(),
      likes: 0,
      likedByMe: false,
      parentId,
    };
    if (parentId) {
      setComments(
        comments.map((c) =>
          c.id === parentId ? { ...c, replies: [...(c.replies || []), newComment] } : c
        )
      );
    } else {
      setComments([...comments, newComment]);
    }
  };

  const handleDeleteComment = async (id: string) => {
    setComments(comments.filter((c) => c.id !== id));
  };

  const handleLikeComment = async (id: string) => {
    setComments(
      comments.map((c) =>
        c.id === id
          ? { ...c, likes: c.likedByMe ? c.likes - 1 : c.likes + 1, likedByMe: !c.likedByMe }
          : c
      )
    );
  };

  // Linked items handlers
  const handleAddLinkedItem = async (item: LinkedItem) => {
    setLinkedItems([...linkedItems, item]);
  };

  const handleRemoveLinkedItem = async (id: string) => {
    setLinkedItems(linkedItems.filter((i) => i.id !== id));
  };

  const searchLinkedItems = async (query: string) => {
    return [];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-white dark:bg-navy-950">
        <Loader2 className="animate-spin text-primary-500" size={32} />
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.todo;
  const priorityConfig = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;
  const StatusIcon = statusConfig.icon;
  const isPending = status === 'todo' || status === 'in_progress';
  const isBlocked = status === 'blocked';
  const isDone = status === 'done';
  const isDecisionBlocked = Boolean(blockedByDecisionId);

  // Risk handlers
  const addRisk = () => {
    const newRisk: RiskItem = {
      id: Math.random().toString(36).substr(2, 9),
      title: '',
      probability: 'medium',
      impact: 'medium',
      category: 'technical',
      mitigation: '',
      contingency: '',
    };
    setRisks([...risks, newRisk]);
  };

  const generateRisksAI = async () => {
    setIsGeneratingRisks(true);
    await new Promise((r) => setTimeout(r, 1500));
    const aiRisks: RiskItem[] = [
      {
        id: Math.random().toString(36).substr(2, 9),
        title: isPolish ? 'Opóźnienie w dostawie' : 'Delivery delay',
        probability: 'medium',
        impact: 'high',
        category: 'operational',
        mitigation: '',
        contingency: '',
      },
      {
        id: Math.random().toString(36).substr(2, 9),
        title: isPolish ? 'Brak zasobów' : 'Resource shortage',
        probability: 'low',
        impact: 'medium',
        category: 'business',
        mitigation: '',
        contingency: '',
      },
    ];
    setRisks([...risks, ...aiRisks]);
    setIsGeneratingRisks(false);
    toast.success(isPolish ? 'Wygenerowano ryzyka AI' : 'AI risks generated');
  };

  // Alternative handlers
  const addAlternative = () => {
    const newAlt: Alternative = {
      id: Math.random().toString(36).substr(2, 9),
      title: '',
      description: '',
      pros: [''],
      cons: [''],
      isRecommended: false,
    };
    setAlternatives([...alternatives, newAlt]);
  };

  const generateAlternativesAI = async () => {
    setIsGeneratingAlternatives(true);
    await new Promise((r) => setTimeout(r, 1500));
    const aiAlts: Alternative[] = [
      {
        id: Math.random().toString(36).substr(2, 9),
        title: isPolish ? 'Podejście A' : 'Approach A',
        description: '',
        pros: [isPolish ? 'Szybkie' : 'Fast'],
        cons: [isPolish ? 'Kosztowne' : 'Expensive'],
        isRecommended: true,
      },
      {
        id: Math.random().toString(36).substr(2, 9),
        title: isPolish ? 'Podejście B' : 'Approach B',
        description: '',
        pros: [isPolish ? 'Tanie' : 'Cheap'],
        cons: [isPolish ? 'Wolne' : 'Slow'],
        isRecommended: false,
      },
    ];
    setAlternatives([...alternatives, ...aiAlts]);
    setIsGeneratingAlternatives(false);
    toast.success(isPolish ? 'Wygenerowano alternatywy AI' : 'AI alternatives generated');
  };

  // Implementation ideas handlers
  const addIdea = () => {
    const newIdea: ImplementationIdea = {
      id: Math.random().toString(36).substr(2, 9),
      title: '',
      description: '',
      source: 'manual',
      status: 'idea',
      votes: 0,
      votedByMe: false,
    };
    setImplementationIdeas([...implementationIdeas, newIdea]);
  };

  const generateIdeasAI = async () => {
    setIsGeneratingIdeas(true);
    await new Promise((r) => setTimeout(r, 1500));
    const aiIdeas: ImplementationIdea[] = [
      {
        id: Math.random().toString(36).substr(2, 9),
        title: isPolish ? 'Automatyzacja procesu' : 'Process automation',
        description: '',
        source: 'ai',
        status: 'idea',
        votes: 0,
        votedByMe: false,
      },
    ];
    setImplementationIdeas([...implementationIdeas, ...aiIdeas]);
    setIsGeneratingIdeas(false);
    toast.success(isPolish ? 'Wygenerowano pomysły AI' : 'AI ideas generated');
  };

  // AI Description handler
  const generateAIDescription = async () => {
    if (!title.trim()) {
      toast.error(isPolish ? 'Najpierw wprowadź tytuł' : 'Enter title first');
      return;
    }
    setIsGeneratingDescription(true);
    await new Promise((r) => setTimeout(r, 1500));

    const descriptions = [
      isPolish
        ? `Zadanie "${title}" obejmuje następujące działania:\n\n1. Analiza wymagań i określenie zakresu prac\n2. Przygotowanie niezbędnych zasobów i narzędzi\n3. Realizacja głównych kroków zgodnie z planem\n4. Weryfikacja i testowanie rezultatów\n5. Dokumentacja i przekazanie do akceptacji`
        : `Task "${title}" involves the following activities:\n\n1. Requirements analysis and scope definition\n2. Preparation of necessary resources and tools\n3. Execution of main steps according to plan\n4. Verification and testing of results\n5. Documentation and handover for acceptance`,
      isPolish
        ? `Cel: Realizacja "${title}"\n\nZakres prac:\n- Określenie szczegółowych wymagań\n- Koordynacja z zespołem i interesariuszami\n- Implementacja zgodnie z przyjętymi standardami\n- Kontrola jakości i walidacja\n\nUwagi: Zadanie wymaga regularnej komunikacji z zespołem.`
        : `Goal: Complete "${title}"\n\nScope of work:\n- Define detailed requirements\n- Coordinate with team and stakeholders\n- Implement according to established standards\n- Quality control and validation\n\nNotes: Task requires regular team communication.`,
    ];

    setDescription(descriptions[Math.floor(Math.random() * descriptions.length)]);
    setIsGeneratingDescription(false);
    addActivityLogEntry('edit', isPolish ? 'AI wygenerowało opis' : 'AI generated description');
    toast.success(isPolish ? 'AI wygenerowało opis' : 'AI generated description');
  };

  // AI Expected Outcome handler
  const generateAIOutcome = async () => {
    if (!title.trim()) {
      toast.error(isPolish ? 'Najpierw wprowadź tytuł' : 'Enter title first');
      return;
    }
    setIsGeneratingOutcome(true);
    await new Promise((r) => setTimeout(r, 1200));

    const outcomes = [
      isPolish
        ? `✅ Kryteria sukcesu dla "${title}":\n• Wszystkie wymagania spełnione i zweryfikowane\n• Dokumentacja kompletna i zatwierdzona\n• Brak błędów krytycznych\n• Akceptacja przez interesariuszy`
        : `✅ Success criteria for "${title}":\n• All requirements met and verified\n• Documentation complete and approved\n• No critical errors\n• Stakeholder acceptance`,
      isPolish
        ? `Oczekiwany rezultat:\n1. Zadanie ukończone w terminie\n2. Jakość zgodna ze standardami\n3. Pozytywna walidacja przez zespół QA\n4. Gotowość do wdrożenia/przekazania`
        : `Expected outcome:\n1. Task completed on time\n2. Quality meets standards\n3. Positive QA validation\n4. Ready for deployment/handover`,
    ];

    setExpectedOutcome(outcomes[Math.floor(Math.random() * outcomes.length)]);
    setIsGeneratingOutcome(false);
    addActivityLogEntry('edit', isPolish ? 'AI wygenerowało rezultat' : 'AI generated outcome');
    toast.success(
      isPolish ? 'AI wygenerowało oczekiwany rezultat' : 'AI generated expected outcome'
    );
  };

  // AI Checklist handler
  const generateAIChecklist = async () => {
    if (!title.trim()) {
      toast.error(isPolish ? 'Najpierw wprowadź tytuł' : 'Enter title first');
      return;
    }
    setIsGeneratingChecklist(true);
    await new Promise((r) => setTimeout(r, 1500));

    const checklistItems = isPolish
      ? [
          'Przeanalizować wymagania',
          'Przygotować plan działania',
          'Zebrać niezbędne zasoby',
          'Wykonać główne zadanie',
          'Przetestować rezultaty',
          'Udokumentować wykonane prace',
          'Przekazać do przeglądu',
        ]
      : [
          'Analyze requirements',
          'Prepare action plan',
          'Gather necessary resources',
          'Execute main task',
          'Test results',
          'Document completed work',
          'Submit for review',
        ];

    const newItems = checklistItems.map((text) => ({
      id: Math.random().toString(36).substr(2, 9),
      text,
      completed: false,
    }));

    setChecklist([...checklist, ...newItems]);
    setIsGeneratingChecklist(false);
    addActivityLogEntry('edit', isPolish ? 'AI wygenerowało checklistę' : 'AI generated checklist');
    toast.success(isPolish ? 'AI wygenerowało checklistę' : 'AI generated checklist');
  };

  // AI Comment handler
  const generateAIComment = async () => {
    setIsGeneratingAIComment(true);
    await new Promise((r) => setTimeout(r, 1500));

    // Generate AI analysis comment based on task context
    const aiComments = [
      isPolish
        ? `🤖 **Analiza AI**: Na podstawie opisu zadania "${title || 'bez tytułu'}", sugeruję rozważenie następujących aspektów: priorytetyzacja kroków, identyfikacja potencjalnych blokerów oraz określenie mierzalnych kryteriów sukcesu.`
        : `🤖 **AI Analysis**: Based on the task description "${title || 'untitled'}", I suggest considering the following aspects: step prioritization, identification of potential blockers, and defining measurable success criteria.`,
      isPolish
        ? `🤖 **Wskazówka AI**: Zadanie może wymagać dodatkowej koordynacji z zespołem. Rozważ dodanie checklisty z kluczowymi krokami.`
        : `🤖 **AI Tip**: This task may require additional team coordination. Consider adding a checklist with key steps.`,
      isPolish
        ? `🤖 **Rekomendacja AI**: Bazując na priorytecie i terminie, zalecam podzielenie zadania na mniejsze, łatwiejsze do śledzenia części.`
        : `🤖 **AI Recommendation**: Based on priority and deadline, I recommend breaking this task into smaller, easier-to-track parts.`,
    ];

    const randomComment = aiComments[Math.floor(Math.random() * aiComments.length)];

    const newComment: Comment = {
      id: Math.random().toString(36).substr(2, 9),
      content: randomComment,
      authorId: 'ai-assistant',
      authorName: 'AI Assistant',
      createdAt: new Date().toISOString(),
      likes: 0,
      likedByMe: false,
    };

    setComments([...comments, newComment]);
    setIsGeneratingAIComment(false);
    addActivityLogEntry('comment', isPolish ? 'AI wygenerowało komentarz' : 'AI generated comment');
    toast.success(isPolish ? 'AI wygenerowało komentarz' : 'AI comment generated');
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50/30 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 dark:from-blue-500/10 dark:to-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-purple-500/5 to-pink-500/5 dark:from-purple-500/10 dark:to-pink-500/10 rounded-full blur-3xl" />
      </div>

      {/* Content - Two columns */}
      <div className="relative flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Header - Full width */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-3 bg-gradient-to-r from-white/80 via-purple-50/30 to-white/80 dark:from-navy-900/80 dark:via-purple-900/20 dark:to-navy-900/80 backdrop-blur-xl rounded-2xl border border-purple-200/40 dark:border-purple-500/20 shadow-lg shadow-purple-500/10 dark:shadow-purple-500/20 overflow-hidden ring-1 ring-purple-500/10 dark:ring-purple-400/10"
          >
            <div className="flex items-center gap-4 px-5 py-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onClose}
                className="p-2 -ml-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-navy-800/80 transition-all"
              >
                <ChevronLeft size={20} />
              </motion.button>

              <div className="flex-1 flex items-center gap-3">
                <div
                  className={`w-3 h-3 rounded-full ${statusConfig.color} shadow-lg shadow-${statusConfig.color.replace('bg-', '')}/50`}
                />
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="flex-1 text-xl font-bold bg-transparent text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
                  placeholder={isPolish ? 'Tytuł zadania...' : 'Task title...'}
                  autoFocus={!taskId}
                />
              </div>

              <div className="flex items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/70 dark:bg-navy-900/50 border border-blue-500/40 dark:border-blue-400/30 text-blue-700 dark:text-blue-300 hover:bg-blue-500/10 dark:hover:bg-blue-500/10 text-sm font-semibold transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  title={isPolish ? 'Zapisz' : 'Save'}
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  <span>{isPolish ? 'Zapisz' : 'Save'}</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleOpenChat}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/70 dark:bg-navy-900/50 border border-purple-500/40 dark:border-purple-400/30 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 dark:hover:bg-purple-500/10 text-sm font-semibold transition-all shadow-sm"
                  title={isPolish ? 'Otwórz czat do tego zadania' : 'Open task chat'}
                >
                  <MessageSquare size={16} />
                  <span>{isPolish ? 'Czat' : 'Chat'}</span>
                </motion.button>
              </div>
            </div>
          </motion.div>
          {/* Left Column - 2/3 */}
          <div className="lg:col-span-2 space-y-4 order-2 lg:order-1">
            {/* Task Description */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden"
            >
              <div
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors cursor-pointer"
                onClick={() => toggleSection('description')}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 dark:from-blue-500/20 dark:to-cyan-500/20">
                    <FileText size={18} className="text-blue-500 dark:text-blue-400" />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {isPolish ? 'Opis zadania' : 'Task description'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {description && (
                    <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                      ✓
                    </span>
                  )}
                  {/* AI Button - visible only when expanded */}
                  <AnimatePresence>
                    {expandedSections.has('description') && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          generateAIDescription();
                        }}
                        disabled={isGeneratingDescription}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-500/10 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 dark:hover:bg-violet-500/30 text-xs font-medium transition-all disabled:opacity-50"
                        title={isPolish ? 'Wygeneruj opis AI' : 'Generate AI description'}
                      >
                        {isGeneratingDescription ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Sparkles size={14} />
                        )}
                        <span>AI</span>
                      </motion.button>
                    )}
                  </AnimatePresence>
                  <motion.div
                    animate={{ rotate: expandedSections.has('description') ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown size={18} className="text-slate-400" />
                  </motion.div>
                </div>
              </div>

              <AnimatePresence>
                {expandedSections.has('description') && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="border-t border-slate-200 dark:border-navy-700 overflow-hidden"
                  >
                    <div className="p-4">
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={4}
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-50/80 dark:bg-navy-800/80 border border-slate-200/80 dark:border-navy-600/80 text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 resize-none transition-all"
                        placeholder={
                          isPolish ? 'Opisz szczegóły zadania...' : 'Describe task details...'
                        }
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Expected Outcome */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden"
            >
              <div
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors cursor-pointer"
                onClick={() => toggleSection('expectedOutcome')}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/20 dark:to-teal-500/20">
                    <Target size={18} className="text-emerald-500 dark:text-emerald-400" />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {isPolish ? 'Oczekiwany rezultat' : 'Expected Outcome'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {expectedOutcome && (
                    <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                      ✓
                    </span>
                  )}
                  {/* AI Button - visible only when expanded */}
                  <AnimatePresence>
                    {expandedSections.has('expectedOutcome') && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          generateAIOutcome();
                        }}
                        disabled={isGeneratingOutcome}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-500/10 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 dark:hover:bg-violet-500/30 text-xs font-medium transition-all disabled:opacity-50"
                        title={isPolish ? 'Wygeneruj rezultat AI' : 'Generate AI outcome'}
                      >
                        {isGeneratingOutcome ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Sparkles size={14} />
                        )}
                        <span>AI</span>
                      </motion.button>
                    )}
                  </AnimatePresence>
                  <motion.div
                    animate={{ rotate: expandedSections.has('expectedOutcome') ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown size={18} className="text-slate-400" />
                  </motion.div>
                </div>
              </div>

              <AnimatePresence>
                {expandedSections.has('expectedOutcome') && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="border-t border-slate-200 dark:border-navy-700 overflow-hidden"
                  >
                    <div className="p-4">
                      <textarea
                        value={expectedOutcome}
                        onChange={(e) => setExpectedOutcome(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-50/80 dark:bg-navy-800/80 border border-slate-200/80 dark:border-navy-600/80 text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/10 resize-none transition-all"
                        placeholder={
                          isPolish
                            ? 'Co ma być efektem tego zadania?'
                            : 'What should be the outcome of this task?'
                        }
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Comments */}
            <CommentsSection
              comments={comments}
              onAddComment={handleAddComment}
              onDeleteComment={handleDeleteComment}
              onLikeComment={handleLikeComment}
              onGenerateAIComment={generateAIComment}
              isGeneratingAI={isGeneratingAIComment}
              currentUserId="current-user"
              expanded={expandedSections.has('comments')}
              onToggleExpand={() => toggleSection('comments')}
            />

            {/* Implementation Ideas */}
            <ImplementationIdeasSection
              ideas={implementationIdeas}
              onAdd={addIdea}
              onUpdate={(id, updates) =>
                setImplementationIdeas(
                  implementationIdeas.map((i) => (i.id === id ? { ...i, ...updates } : i))
                )
              }
              onRemove={(id) =>
                setImplementationIdeas(implementationIdeas.filter((i) => i.id !== id))
              }
              onVote={(id) =>
                setImplementationIdeas(
                  implementationIdeas.map((i) =>
                    i.id === id
                      ? {
                          ...i,
                          votes: i.votedByMe ? i.votes - 1 : i.votes + 1,
                          votedByMe: !i.votedByMe,
                        }
                      : i
                  )
                )
              }
              onGenerateAI={generateIdeasAI}
              isGenerating={isGeneratingIdeas}
              expanded={expandedSections.has('ideas')}
              onToggleExpand={() => toggleSection('ideas')}
            />

            {/* Related Decisions */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden"
            >
              <div
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors cursor-pointer"
                onClick={() => toggleSection('relatedDecisions')}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20">
                    <Scale size={18} className="text-amber-500 dark:text-amber-400" />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {isPolish ? 'Powiązane decyzje' : 'Related Decisions'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {relatedDecisions.length > 0 && (
                    <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                      {relatedDecisions.length}
                    </span>
                  )}
                  {relatedDecisions.some(
                    (d) =>
                      d.decisionStatus === 'pending' &&
                      (d.relationshipType === 'blocks' || d.relationshipType === 'requires')
                  ) && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
                  <motion.div
                    animate={{ rotate: expandedSections.has('relatedDecisions') ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown size={18} className="text-slate-400" />
                  </motion.div>
                </div>
              </div>

              <AnimatePresence>
                {expandedSections.has('relatedDecisions') && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="border-t border-slate-200 dark:border-navy-700 overflow-hidden"
                  >
                    <div className="p-4 space-y-3">
                      {/* Related decisions list */}
                      {relatedDecisions.length === 0 &&
                      !showCreateDecision &&
                      !showDecisionSearch ? (
                        <div className="text-center py-6 border-2 border-dashed border-slate-200 dark:border-navy-700 rounded-xl">
                          <Scale
                            size={24}
                            className="mx-auto mb-2 text-slate-300 dark:text-slate-600"
                          />
                          <p className="text-sm text-slate-400 dark:text-slate-500">
                            {isPolish ? 'Brak powiązanych decyzji' : 'No related decisions'}
                          </p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                            {isPolish
                              ? 'Powiąż istniejącą lub utwórz nową decyzję'
                              : 'Link existing or create new decision'}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {relatedDecisions.map((rel) => {
                            const statusColors: Record<string, string> = {
                              pending: 'bg-amber-500',
                              approved: 'bg-emerald-500',
                              rejected: 'bg-red-500',
                              deferred: 'bg-slate-500',
                              escalated: 'bg-orange-500',
                            };
                            const statusLabels: Record<string, { en: string; pl: string }> = {
                              pending: { en: 'Pending', pl: 'Oczekuje' },
                              approved: { en: 'Approved', pl: 'Zatwierdzona' },
                              rejected: { en: 'Rejected', pl: 'Odrzucona' },
                              deferred: { en: 'Deferred', pl: 'Odroczona' },
                              escalated: { en: 'Escalated', pl: 'Eskalowana' },
                            };
                            const relationLabels: Record<string, { en: string; pl: string }> = {
                              blocks: { en: 'Blocks', pl: 'Blokuje' },
                              requires: { en: 'Requires', pl: 'Wymaga' },
                              informs: { en: 'Informs', pl: 'Informuje' },
                              depends_on: { en: 'Depends on', pl: 'Zależy od' },
                            };
                            const isBlocking =
                              (rel.relationshipType === 'blocks' ||
                                rel.relationshipType === 'requires') &&
                              rel.decisionStatus === 'pending';

                            return (
                              <div
                                key={rel.id}
                                className={`p-3 rounded-xl border transition-all ${
                                  isBlocking
                                    ? 'bg-amber-50/50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30'
                                    : 'bg-slate-50/50 dark:bg-navy-800/50 border-slate-200 dark:border-navy-600'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-start gap-3 min-w-0 flex-1">
                                    <div
                                      className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${statusColors[rel.decisionStatus] || 'bg-slate-400'}`}
                                    />
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                        {rel.decisionTitle}
                                      </p>
                                      <div className="flex flex-wrap items-center gap-2 mt-1">
                                        <span
                                          className={`text-xs px-1.5 py-0.5 rounded ${
                                            isBlocking
                                              ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'
                                              : 'bg-slate-100 dark:bg-navy-700 text-slate-500 dark:text-slate-400'
                                          }`}
                                        >
                                          {isPolish
                                            ? relationLabels[rel.relationshipType]?.pl
                                            : relationLabels[rel.relationshipType]?.en}
                                        </span>
                                        <span className="text-xs text-slate-400 dark:text-slate-500">
                                          {isPolish
                                            ? statusLabels[rel.decisionStatus]?.pl
                                            : statusLabels[rel.decisionStatus]?.en}
                                        </span>
                                        {isBlocking && (
                                          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                                            ⚠️ {isPolish ? 'Blokuje' : 'Blocking'}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    {onOpenDecision && (
                                      <button
                                        onClick={() => onOpenDecision(rel.decisionId)}
                                        className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-navy-600 text-slate-400 hover:text-blue-500 transition-all"
                                        title={isPolish ? 'Otwórz decyzję' : 'Open decision'}
                                      >
                                        <ExternalLink size={14} />
                                      </button>
                                    )}
                                    <button
                                      onClick={() =>
                                        setRelatedDecisions(
                                          relatedDecisions.filter((d) => d.id !== rel.id)
                                        )
                                      }
                                      className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/20 text-slate-400 hover:text-red-500 transition-all"
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Create new decision form */}
                      {showCreateDecision && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-4 rounded-xl border-2 border-amber-300 dark:border-amber-500/50 bg-amber-50/30 dark:bg-amber-500/5 space-y-3"
                        >
                          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                            <Plus size={16} />
                            <span className="text-sm font-semibold">
                              {isPolish ? 'Nowa decyzja' : 'New Decision'}
                            </span>
                          </div>

                          {/* Decision title */}
                          <div>
                            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                              {isPolish ? 'Tytuł decyzji *' : 'Decision title *'}
                            </label>
                            <input
                              type="text"
                              value={newDecisionTitle}
                              onChange={(e) => setNewDecisionTitle(e.target.value)}
                              placeholder={
                                isPolish
                                  ? 'Np. Zatwierdzenie budżetu projektu'
                                  : 'E.g. Project budget approval'
                              }
                              className="w-full px-3 py-2 rounded-lg text-sm bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:border-amber-400"
                              autoFocus
                            />
                          </div>

                          {/* Decision description */}
                          <div>
                            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                              {isPolish
                                ? 'Opis problemu / kontekst'
                                : 'Problem description / context'}
                            </label>
                            <textarea
                              value={newDecisionDescription}
                              onChange={(e) => setNewDecisionDescription(e.target.value)}
                              placeholder={
                                isPolish
                                  ? 'Opisz problem wymagający decyzji...'
                                  : 'Describe the problem requiring decision...'
                              }
                              rows={2}
                              className="w-full px-3 py-2 rounded-lg text-sm bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:border-amber-400 resize-none"
                            />
                          </div>

                          {/* Relationship type */}
                          <div>
                            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                              {isPolish ? 'Typ relacji z zadaniem' : 'Relationship with task'}
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {[
                                {
                                  key: 'requires',
                                  label: { en: 'Requires', pl: 'Wymaga' },
                                  desc: {
                                    en: 'Task requires this decision',
                                    pl: 'Zadanie wymaga tej decyzji',
                                  },
                                },
                                {
                                  key: 'blocks',
                                  label: { en: 'Blocks', pl: 'Blokuje' },
                                  desc: {
                                    en: 'Decision blocks task progress',
                                    pl: 'Decyzja blokuje postęp',
                                  },
                                },
                                {
                                  key: 'depends_on',
                                  label: { en: 'Depends', pl: 'Zależy' },
                                  desc: {
                                    en: 'Task depends on outcome',
                                    pl: 'Zadanie zależy od wyniku',
                                  },
                                },
                                {
                                  key: 'informs',
                                  label: { en: 'Informs', pl: 'Informuje' },
                                  desc: {
                                    en: 'Decision informs task',
                                    pl: 'Decyzja informuje zadanie',
                                  },
                                },
                              ].map((type) => (
                                <button
                                  key={type.key}
                                  onClick={() => setNewDecisionRelationType(type.key as any)}
                                  className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                                    newDecisionRelationType === type.key
                                      ? 'bg-amber-100 dark:bg-amber-500/20 border-amber-300 dark:border-amber-500/50 text-amber-700 dark:text-amber-300'
                                      : 'bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-600 text-slate-600 dark:text-slate-400 hover:border-amber-300'
                                  }`}
                                  title={isPolish ? type.desc.pl : type.desc.en}
                                >
                                  {isPolish ? type.label.pl : type.label.en}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="flex gap-2 pt-2">
                            <button
                              onClick={() => {
                                if (!newDecisionTitle.trim()) {
                                  toast.error(
                                    isPolish ? 'Podaj tytuł decyzji' : 'Enter decision title'
                                  );
                                  return;
                                }
                                const newDecisionId = Math.random().toString(36).substr(2, 9);
                                const newDecision = {
                                  id: newDecisionId,
                                  title: newDecisionTitle,
                                  status: 'pending',
                                };
                                setAvailableDecisions([...availableDecisions, newDecision]);
                                const newRelation: RelatedDecision = {
                                  id: Math.random().toString(36).substr(2, 9),
                                  decisionId: newDecisionId,
                                  decisionTitle: newDecisionTitle,
                                  decisionStatus: 'pending',
                                  relationshipType: newDecisionRelationType,
                                };
                                setRelatedDecisions([...relatedDecisions, newRelation]);
                                setShowCreateDecision(false);
                                setNewDecisionTitle('');
                                setNewDecisionDescription('');
                                setNewDecisionRelationType('requires');
                                addActivityLogEntry(
                                  'edit',
                                  isPolish
                                    ? `Utworzono decyzję: ${newDecisionTitle}`
                                    : `Created decision: ${newDecisionTitle}`
                                );
                                toast.success(
                                  isPolish
                                    ? 'Decyzja utworzona i powiązana'
                                    : 'Decision created and linked'
                                );
                              }}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 text-white font-medium hover:bg-amber-600 transition-all"
                            >
                              <Plus size={16} />
                              <span className="text-sm">
                                {isPolish ? 'Utwórz decyzję' : 'Create Decision'}
                              </span>
                            </button>
                            <button
                              onClick={() => {
                                setShowCreateDecision(false);
                                setNewDecisionTitle('');
                                setNewDecisionDescription('');
                              }}
                              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-navy-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-700 transition-all"
                            >
                              <span className="text-sm">{isPolish ? 'Anuluj' : 'Cancel'}</span>
                            </button>
                          </div>

                          {/* Info about full editor */}
                          <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
                            {isPolish
                              ? 'Decyzja zostanie utworzona w trybie szkicu. Możesz ją uzupełnić w pełnym edytorze.'
                              : 'Decision will be created as draft. You can complete it in full editor.'}
                          </p>
                        </motion.div>
                      )}

                      {/* Search existing decisions */}
                      {showDecisionSearch && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="space-y-2"
                        >
                          <div className="relative">
                            <Search
                              size={16}
                              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            />
                            <input
                              type="text"
                              value={decisionSearchQuery}
                              onChange={(e) => setDecisionSearchQuery(e.target.value)}
                              placeholder={
                                isPolish
                                  ? 'Szukaj istniejących decyzji...'
                                  : 'Search existing decisions...'
                              }
                              className="w-full pl-9 pr-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:border-amber-400"
                              autoFocus
                            />
                          </div>

                          <div className="max-h-40 overflow-y-auto space-y-1">
                            {availableDecisions
                              .filter(
                                (d) =>
                                  d.title
                                    .toLowerCase()
                                    .includes(decisionSearchQuery.toLowerCase()) &&
                                  !relatedDecisions.some((r) => r.decisionId === d.id)
                              )
                              .map((decision) => (
                                <button
                                  key={decision.id}
                                  onClick={() => {
                                    const newRelation: RelatedDecision = {
                                      id: Math.random().toString(36).substr(2, 9),
                                      decisionId: decision.id,
                                      decisionTitle: decision.title,
                                      decisionStatus: decision.status as any,
                                      relationshipType: 'requires',
                                    };
                                    setRelatedDecisions([...relatedDecisions, newRelation]);
                                    setShowDecisionSearch(false);
                                    setDecisionSearchQuery('');
                                    addActivityLogEntry(
                                      'edit',
                                      isPolish ? 'Powiązano decyzję' : 'Linked decision'
                                    );
                                    toast.success(
                                      isPolish ? 'Powiązano decyzję' : 'Decision linked'
                                    );
                                  }}
                                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors text-left"
                                >
                                  <div
                                    className={`w-2 h-2 rounded-full ${
                                      decision.status === 'pending'
                                        ? 'bg-amber-500'
                                        : decision.status === 'approved'
                                          ? 'bg-emerald-500'
                                          : 'bg-slate-400'
                                    }`}
                                  />
                                  <span className="text-sm text-slate-700 dark:text-slate-300 truncate">
                                    {decision.title}
                                  </span>
                                </button>
                              ))}
                            {availableDecisions.filter(
                              (d) =>
                                d.title.toLowerCase().includes(decisionSearchQuery.toLowerCase()) &&
                                !relatedDecisions.some((r) => r.decisionId === d.id)
                            ).length === 0 && (
                              <p className="text-center text-sm text-slate-400 dark:text-slate-500 py-4">
                                {isPolish ? 'Brak pasujących decyzji' : 'No matching decisions'}
                              </p>
                            )}
                          </div>

                          <button
                            onClick={() => {
                              setShowDecisionSearch(false);
                              setDecisionSearchQuery('');
                            }}
                            className="w-full text-center text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 py-1"
                          >
                            {isPolish ? 'Anuluj' : 'Cancel'}
                          </button>
                        </motion.div>
                      )}

                      {/* Action buttons */}
                      {!showCreateDecision && !showDecisionSearch && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => setShowCreateDecision(true)}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-amber-300 dark:border-amber-500/50 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-all"
                          >
                            <Plus size={16} />
                            <span className="text-sm font-medium">
                              {isPolish ? 'Nowa decyzja' : 'New Decision'}
                            </span>
                          </button>
                          <button
                            onClick={() => setShowDecisionSearch(true)}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-200 dark:border-navy-600 text-slate-500 dark:text-slate-400 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700 transition-all"
                          >
                            <Link2 size={16} />
                            <span className="text-sm font-medium">
                              {isPolish ? 'Powiąż istniejącą' : 'Link Existing'}
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Risk Analysis */}
            <RiskAssessmentCompact
              risks={risks}
              onAdd={addRisk}
              onUpdate={(id, updates) =>
                setRisks(risks.map((r) => (r.id === id ? { ...r, ...updates } : r)))
              }
              onRemove={(id) => setRisks(risks.filter((r) => r.id !== id))}
              onGenerateAI={generateRisksAI}
              isGenerating={isGeneratingRisks}
              expanded={expandedSections.has('risks')}
              onToggleExpand={() => toggleSection('risks')}
            />

            {/* Alternatives */}
            <AlternativesSection
              alternatives={alternatives}
              selectedAlternativeId={selectedAlternativeId}
              status={status}
              onAdd={addAlternative}
              onUpdate={(id, updates) =>
                setAlternatives(alternatives.map((a) => (a.id === id ? { ...a, ...updates } : a)))
              }
              onRemove={(id) => setAlternatives(alternatives.filter((a) => a.id !== id))}
              onSetRecommended={(id) =>
                setAlternatives(alternatives.map((a) => ({ ...a, isRecommended: a.id === id })))
              }
              onSelect={(id) => setSelectedAlternativeId(id)}
              onGenerateAI={generateAlternativesAI}
              isGenerating={isGeneratingAlternatives}
              expanded={expandedSections.has('alternatives')}
              onToggleExpand={() => toggleSection('alternatives')}
            />

            {/* Checklist */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden"
            >
              <div
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors cursor-pointer"
                onClick={() => toggleSection('checklist')}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20">
                    <CheckSquare size={18} className="text-emerald-500 dark:text-emerald-400" />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {isPolish ? 'Lista kontrolna' : 'Checklist'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {checklist.length > 0 && (
                    <>
                      <div className="w-20 h-1.5 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 transition-all"
                          style={{ width: `${checklistProgress}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                        {checklist.filter((c) => c.completed).length}/{checklist.length}
                      </span>
                    </>
                  )}
                  {/* AI Button - visible only when expanded */}
                  <AnimatePresence>
                    {expandedSections.has('checklist') && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          generateAIChecklist();
                        }}
                        disabled={isGeneratingChecklist}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-500/10 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 dark:hover:bg-violet-500/30 text-xs font-medium transition-all disabled:opacity-50"
                        title={isPolish ? 'Wygeneruj checklistę AI' : 'Generate AI checklist'}
                      >
                        {isGeneratingChecklist ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Sparkles size={14} />
                        )}
                        <span>AI</span>
                      </motion.button>
                    )}
                  </AnimatePresence>
                  <motion.div
                    animate={{ rotate: expandedSections.has('checklist') ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown size={18} className="text-slate-400" />
                  </motion.div>
                </div>
              </div>

              <AnimatePresence>
                {expandedSections.has('checklist') && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="border-t border-slate-200 dark:border-navy-700 overflow-hidden"
                  >
                    <div className="p-4 space-y-2">
                      {checklist.length === 0 ? (
                        <div className="text-center py-6 border-2 border-dashed border-slate-200 dark:border-navy-700 rounded-xl">
                          <CheckSquare
                            size={24}
                            className="mx-auto mb-2 text-slate-300 dark:text-slate-600"
                          />
                          <p className="text-sm text-slate-400 dark:text-slate-500">
                            {isPolish ? 'Brak elementów' : 'No items'}
                          </p>
                          <button
                            onClick={addChecklistItem}
                            className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 transition-colors"
                          >
                            <Plus size={14} />
                            {isPolish ? 'Dodaj element' : 'Add item'}
                          </button>
                        </div>
                      ) : (
                        <>
                          {checklist.map((item) => (
                            <div key={item.id} className="flex items-center gap-3 group">
                              <input
                                type="checkbox"
                                checked={item.completed}
                                onChange={(e) =>
                                  updateChecklistItem(item.id, { completed: e.target.checked })
                                }
                                className="w-4 h-4 rounded border-slate-300 dark:border-navy-600 text-emerald-500 focus:ring-emerald-500"
                              />
                              <input
                                type="text"
                                value={item.text}
                                onChange={(e) =>
                                  updateChecklistItem(item.id, { text: e.target.value })
                                }
                                placeholder={isPolish ? 'Wprowadź element...' : 'Enter item...'}
                                className={`flex-1 px-2 py-1.5 rounded-lg text-sm bg-transparent border border-transparent hover:border-slate-200 dark:hover:border-navy-600 focus:border-emerald-400 dark:focus:border-emerald-500 text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none transition-colors ${
                                  item.completed
                                    ? 'line-through text-slate-400 dark:text-slate-500'
                                    : ''
                                }`}
                              />
                              <button
                                onClick={() => removeChecklistItem(item.id)}
                                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/20 text-slate-400 hover:text-red-500 transition-all"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={addChecklistItem}
                            className="flex items-center gap-2 text-sm text-emerald-500 hover:text-emerald-600 py-2 px-2 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors"
                          >
                            <Plus size={14} />
                            <span>{isPolish ? 'Dodaj element' : 'Add item'}</span>
                          </button>
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Activity Log */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden"
            >
              <motion.button
                whileHover={{ backgroundColor: 'rgba(148, 163, 184, 0.1)' }}
                whileTap={{ scale: 0.98 }}
                onClick={() => toggleSection('activityLog')}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-slate-500/10 to-gray-500/10 dark:from-slate-500/20 dark:to-gray-500/20">
                    <History size={18} className="text-slate-500 dark:text-slate-400" />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {isPolish ? 'Historia zmian' : 'Activity Log'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {activityLog.length > 0 && (
                    <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                      {activityLog.length}
                    </span>
                  )}
                  <motion.div
                    animate={{ rotate: expandedSections.has('activityLog') ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown size={18} className="text-slate-400" />
                  </motion.div>
                </div>
              </motion.button>

              <AnimatePresence>
                {expandedSections.has('activityLog') && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="border-t border-slate-200 dark:border-navy-700 overflow-hidden"
                  >
                    <div className="p-4 max-h-80 overflow-y-auto">
                      {activityLog.length === 0 ? (
                        <div className="text-center py-6 border-2 border-dashed border-slate-200 dark:border-navy-700 rounded-xl">
                          <History
                            size={24}
                            className="mx-auto mb-2 text-slate-300 dark:text-slate-600"
                          />
                          <p className="text-sm text-slate-400 dark:text-slate-500">
                            {isPolish ? 'Brak historii' : 'No activity yet'}
                          </p>
                        </div>
                      ) : (
                        <div className="relative">
                          {/* Timeline line */}
                          <div className="absolute left-3 top-2 bottom-2 w-px bg-slate-200 dark:bg-navy-700" />

                          <div className="space-y-4">
                            {activityLog.map((entry, index) => {
                              const getIcon = () => {
                                switch (entry.type) {
                                  case 'created':
                                    return <Plus size={12} />;
                                  case 'status_change':
                                    return <CheckCircle2 size={12} />;
                                  case 'assignment':
                                    return <User size={12} />;
                                  case 'comment':
                                    return <FileText size={12} />;
                                  case 'edit':
                                    return <Edit3 size={12} />;
                                  case 'attachment':
                                    return <FileText size={12} />;
                                  case 'deadline':
                                    return <Calendar size={12} />;
                                  case 'priority':
                                    return <Flag size={12} />;
                                  default:
                                    return <Clock size={12} />;
                                }
                              };

                              const getColor = () => {
                                switch (entry.type) {
                                  case 'created':
                                    return 'bg-emerald-500 text-white';
                                  case 'status_change':
                                    return 'bg-blue-500 text-white';
                                  case 'assignment':
                                    return 'bg-purple-500 text-white';
                                  case 'comment':
                                    return 'bg-amber-500 text-white';
                                  case 'edit':
                                    return 'bg-slate-500 text-white';
                                  case 'deadline':
                                    return 'bg-red-500 text-white';
                                  case 'priority':
                                    return 'bg-orange-500 text-white';
                                  default:
                                    return 'bg-slate-400 text-white';
                                }
                              };

                              return (
                                <div key={entry.id} className="relative flex gap-3 pl-1">
                                  {/* Icon */}
                                  <div
                                    className={`relative z-10 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${getColor()}`}
                                  >
                                    {getIcon()}
                                  </div>

                                  {/* Content */}
                                  <div className="flex-1 min-w-0 pb-2">
                                    <p className="text-sm text-slate-700 dark:text-slate-300">
                                      {entry.description}
                                      {entry.oldValue && entry.newValue && (
                                        <span className="text-slate-400 dark:text-slate-500">
                                          {' '}
                                          <span className="line-through">
                                            {entry.oldValue}
                                          </span> →{' '}
                                          <span className="font-medium text-slate-600 dark:text-slate-300">
                                            {entry.newValue}
                                          </span>
                                        </span>
                                      )}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                      {entry.userName && (
                                        <span className="text-xs text-slate-500 dark:text-slate-400">
                                          {entry.userName}
                                        </span>
                                      )}
                                      <span className="text-xs text-slate-400 dark:text-slate-500">
                                        {new Date(entry.timestamp).toLocaleString(
                                          isPolish ? 'pl-PL' : 'en-US',
                                          {
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                          }
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>

          {/* Right Column - 1/3 */}
          <div className="space-y-4 lg:sticky lg:top-6 self-start order-1 lg:order-2">
            {/* Deadline Alert */}
            <DeadlineAlertBanner dueDate={dueDate} status={status} />

            {/* Control Panel */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden"
            >
              <motion.button
                whileHover={{ backgroundColor: 'rgba(148, 163, 184, 0.1)' }}
                whileTap={{ scale: 0.98 }}
                onClick={() => toggleSection('control')}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 dark:from-blue-500/20 dark:to-cyan-500/20">
                    <Flag size={18} className="text-blue-500 dark:text-blue-400" />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {isPolish ? 'Sterowanie' : 'Control'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {taskId && (
                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 bg-slate-100/80 dark:bg-navy-800/80 px-2 py-0.5 rounded-lg">
                      #{taskId.slice(0, 8)}
                    </span>
                  )}
                  <motion.div
                    animate={{ rotate: expandedSections.has('control') ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown size={18} className="text-slate-400" />
                  </motion.div>
                </div>
              </motion.button>

              <AnimatePresence>
                {expandedSections.has('control') && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="border-t border-slate-200 dark:border-navy-700 overflow-hidden"
                  >
                    <div className="p-4 space-y-3">
                      {/* Initiative */}
                      <div className="relative">
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                          {isPolish ? 'Inicjatywa' : 'Initiative'}
                        </label>
                        <button
                          onClick={() => setShowInitiativeDropdown(!showInitiativeDropdown)}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 hover:border-blue-300 dark:hover:border-blue-500/50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            {initiativeId ? (
                              <>
                                <div className="p-1 rounded bg-blue-500/10">
                                  <Layers size={12} className="text-blue-500" />
                                </div>
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                                  {initiativeName ||
                                    availableInitiatives.find((i) => i.id === initiativeId)?.name}
                                </span>
                              </>
                            ) : (
                              <>
                                <div className="p-1 rounded bg-slate-200 dark:bg-navy-700">
                                  <Minus size={12} className="text-slate-400" />
                                </div>
                                <span className="text-sm text-slate-400 dark:text-slate-500">
                                  {isPolish ? 'Samodzielne zadanie' : 'Standalone task'}
                                </span>
                              </>
                            )}
                          </div>
                          <ChevronDown size={16} className="text-slate-400" />
                        </button>
                        <AnimatePresence>
                          {showInitiativeDropdown && (
                            <motion.div
                              initial={{ opacity: 0, y: -8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -8 }}
                              className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-navy-800 rounded-lg shadow-xl border border-slate-200 dark:border-navy-600 py-1 max-h-60 overflow-y-auto"
                            >
                              <button
                                onClick={() => {
                                  setInitiativeId(null);
                                  setInitiativeName(null);
                                  setShowInitiativeDropdown(false);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors ${
                                  !initiativeId ? 'bg-blue-50 dark:bg-blue-500/10' : ''
                                }`}
                              >
                                <div className="p-1 rounded bg-slate-200 dark:bg-navy-700">
                                  <Minus size={12} className="text-slate-400" />
                                </div>
                                <span className="text-slate-500 dark:text-slate-400">
                                  {isPolish ? 'Samodzielne zadanie' : 'Standalone task'}
                                </span>
                              </button>
                              <div className="border-t border-slate-100 dark:border-navy-700 my-1" />
                              {availableInitiatives.map((init) => (
                                <button
                                  key={init.id}
                                  onClick={() => {
                                    setInitiativeId(init.id);
                                    setInitiativeName(init.name);
                                    setShowInitiativeDropdown(false);
                                  }}
                                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors ${
                                    initiativeId === init.id ? 'bg-blue-50 dark:bg-blue-500/10' : ''
                                  }`}
                                >
                                  <div className="p-1 rounded bg-blue-500/10">
                                    <Layers size={12} className="text-blue-500" />
                                  </div>
                                  <span className="text-slate-700 dark:text-slate-300">
                                    {init.name}
                                  </span>
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Status */}
                      <div className="relative">
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                          Status
                        </label>
                        <button
                          onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 hover:border-blue-300 dark:hover:border-blue-500/50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${statusConfig.color}`} />
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                              {isPolish ? statusConfig.label.pl : statusConfig.label.en}
                            </span>
                          </div>
                          <ChevronDown size={16} className="text-slate-400" />
                        </button>
                        <AnimatePresence>
                          {showStatusDropdown && (
                            <motion.div
                              initial={{ opacity: 0, y: -8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -8 }}
                              className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-navy-800 rounded-lg shadow-xl border border-slate-200 dark:border-navy-600 py-1"
                            >
                              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                                <button
                                  key={key}
                                  onClick={() => {
                                    setStatus(key as keyof typeof STATUS_CONFIG);
                                    setShowStatusDropdown(false);
                                  }}
                                  className={`w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors ${
                                    status === key ? 'bg-blue-50 dark:bg-blue-500/10' : ''
                                  }`}
                                >
                                  <div className={`w-2.5 h-2.5 rounded-full ${config.color}`} />
                                  <span className="text-slate-700 dark:text-slate-300">
                                    {isPolish ? config.label.pl : config.label.en}
                                  </span>
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Priority */}
                      <div className="relative">
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                          {isPolish ? 'Priorytet' : 'Priority'}
                        </label>
                        <button
                          onClick={() => setShowPriorityDropdown(!showPriorityDropdown)}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 hover:border-blue-300 dark:hover:border-blue-500/50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Flag size={14} className={priorityConfig.textColor} />
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                              {isPolish ? priorityConfig.label.pl : priorityConfig.label.en}
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
                                    priority === key ? 'bg-blue-50 dark:bg-blue-500/10' : ''
                                  }`}
                                >
                                  <Flag size={14} className={config.textColor} />
                                  <span className="text-slate-700 dark:text-slate-300">
                                    {isPolish ? config.label.pl : config.label.en}
                                  </span>
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Due Date */}
                      <div>
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                          {isPolish ? 'Termin' : 'Due Date'}
                        </label>
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600">
                          <Calendar size={14} className="text-slate-400" />
                          <input
                            type="date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            className="flex-1 bg-transparent text-sm text-slate-700 dark:text-slate-300 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Owner / Assignee */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                            {isPolish ? 'Właściciel' : 'Owner'}
                          </label>
                          <select
                            value={ownerId}
                            onChange={(e) => setOwnerId(e.target.value)}
                            className="w-full h-[42px] px-3 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-400"
                          >
                            <option value="">{isPolish ? 'Wybierz' : 'Select'}</option>
                            {users.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.firstName} {user.lastName}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                            {isPolish ? 'Wykonawca' : 'Assignee'}
                          </label>
                          <select
                            value={assigneeId}
                            onChange={(e) => setAssigneeId(e.target.value)}
                            className="w-full h-[42px] px-3 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-400"
                          >
                            <option value="">{isPolish ? 'Wybierz' : 'Select'}</option>
                            {users.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.firstName} {user.lastName}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Blocked Reason */}
                      {status === 'blocked' && (
                        <div>
                          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                            {isPolish ? 'Powód blokady' : 'Blocked Reason'}
                          </label>
                          <textarea
                            value={blockedReason}
                            onChange={(e) => setBlockedReason(e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-red-200 dark:border-red-500/30 text-sm text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:border-red-400 resize-none"
                            placeholder={
                              isPolish ? 'Opisz powód blokady...' : 'Describe blocking reason...'
                            }
                          />
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Attachments */}
            <AttachmentsSection
              attachments={attachments}
              onUpload={handleUploadAttachments}
              onDelete={handleDeleteAttachment}
              expanded={expandedSections.has('attachments')}
              onToggleExpand={() => toggleSection('attachments')}
            />

            {/* Linked Items */}
            <LinkedItemsSection
              items={linkedItems}
              onAdd={handleAddLinkedItem}
              onRemove={handleRemoveLinkedItem}
              searchItems={searchLinkedItems}
              expanded={expandedSections.has('linkedItems')}
              onToggleExpand={() => toggleSection('linkedItems')}
            />

            {/* Stakeholders */}
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
                  decisionId: taskId || 'new',
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

            {/* Reminders & Escalation */}
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
              dueDate={dueDate}
            />

            {/* Tags */}
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
                              onClick={() => removeTag(tag)}
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
                          onKeyDown={(e) => e.key === 'Enter' && addTag()}
                          placeholder={isPolish ? 'Nowy tag...' : 'New tag...'}
                          className="flex-1 px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:border-pink-400"
                        />
                        <button
                          onClick={addTag}
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

            {/* Dependencies */}
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

            {/* Evidence & Acceptance */}
            <EvidenceSection
              evidenceRequired={evidenceRequired}
              evidenceItems={evidenceItems}
              requiresAcceptance={requiresAcceptance}
              acceptanceType={acceptanceType}
              acceptorId={acceptorId}
              signedOff={signedOff}
              signedOffAt={signedOffAt}
              signedOffBy={signedOffBy}
              availableUsers={users.map((u) => ({
                id: u.id,
                name: `${u.firstName} ${u.lastName}`,
              }))}
              onEvidenceRequiredChange={setEvidenceRequired}
              onAddEvidence={(item) =>
                setEvidenceItems([
                  ...evidenceItems,
                  { ...item, id: Math.random().toString(36).substr(2, 9) },
                ])
              }
              onRemoveEvidence={(id) => setEvidenceItems(evidenceItems.filter((e) => e.id !== id))}
              onVerifyEvidence={(id) =>
                setEvidenceItems(
                  evidenceItems.map((e) =>
                    e.id === id ? { ...e, verified: true, verifiedAt: new Date().toISOString() } : e
                  )
                )
              }
              onAcceptanceChange={(requires, type, acceptor) => {
                setRequiresAcceptance(requires);
                setAcceptanceType(type);
                setAcceptorId(acceptor);
              }}
              onSignOff={() => {
                setSignedOff(true);
                setSignedOffAt(new Date().toISOString());
                setSignedOffBy('Current User');
                toast.success(isPolish ? 'Zadanie podpisane' : 'Task signed off');
              }}
              expanded={expandedSections.has('evidence')}
              onToggleExpand={() => toggleSection('evidence')}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskDetailView;
