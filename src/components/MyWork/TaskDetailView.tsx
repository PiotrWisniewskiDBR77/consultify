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
  Eye,
  FileText,
  Flag,
  History,
  Layers,
  Loader2,
  Minus,
  Pause,
  Play,
  Plus,
  Save,
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

import {
  type AIInsight,
  AIInsightSection,
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

  // Decision blocking
  const [blockedByDecisionId, setBlockedByDecisionId] = useState<string>('');

  // New sections state
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [alternatives, setAlternatives] = useState<Alternative[]>([]);
  const [selectedAlternativeId, setSelectedAlternativeId] = useState<string>('');
  const [implementationIdeas, setImplementationIdeas] = useState<ImplementationIdea[]>([]);
  const [dependencies, setDependencies] = useState<TaskDependency[]>([]);
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
  const [expectedOutcome, setExpectedOutcome] = useState('');
  const [strategicContribution, setStrategicContribution] = useState<
    ('PROCESS_CHANGE' | 'BEHAVIOR_CHANGE' | 'CAPABILITY_CHANGE')[]
  >([]);

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
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);

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

  const handleStartTask = () => {
    setStatus('in_progress');
    setStartDate(new Date().toISOString().split('T')[0]);
    toast.success(isPolish ? 'Zadanie rozpoczęte' : 'Task started');
  };

  const handleCompleteTask = () => {
    setStatus('done');
    toast.success(isPolish ? 'Zadanie ukończone' : 'Task completed');
  };

  const handleRequestReview = () => {
    setStatus('review');
    toast.success(isPolish ? 'Wysłano do przeglądu' : 'Sent for review');
  };

  const handlePauseTask = () => {
    setStatus('todo');
    toast.success(isPolish ? 'Zadanie wstrzymane' : 'Task paused');
  };

  const handleBlockTask = () => {
    setStatus('blocked');
    toast.success(isPolish ? 'Zadanie zablokowane' : 'Task blocked');
  };

  const handleDelegateTask = () => {
    // TODO: Open delegation modal
    toast.success(
      isPolish ? 'Funkcja delegowania w przygotowaniu' : 'Delegation feature coming soon'
    );
  };

  const handleDelete = async () => {
    if (!taskId) return;
    if (
      !confirm(
        isPolish
          ? 'Czy na pewno chcesz usunąć to zadanie?'
          : 'Are you sure you want to delete this task?'
      )
    )
      return;

    try {
      await Api.delete(`/tasks/${taskId}`);
      toast.success(isPolish ? 'Zadanie usunięte' : 'Task deleted');
      onClose();
    } catch (error) {
      toast.error(isPolish ? 'Nie udało się usunąć zadania' : 'Failed to delete task');
    }
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

  // AI Insights handler
  const generateInsightsAI = async () => {
    setIsGeneratingInsights(true);
    await new Promise((r) => setTimeout(r, 2000));
    const newInsights: AIInsight[] = [
      {
        id: Math.random().toString(36).substr(2, 9),
        type: 'recommendation',
        title: isPolish ? 'Rozważ wcześniejszy start' : 'Consider earlier start',
        description: isPolish
          ? 'Na podstawie zależności, wcześniejszy start może przyspieszyć całość'
          : 'Based on dependencies, earlier start could speed up overall',
        confidence: 'high',
        createdAt: new Date().toISOString(),
        actionable: true,
      },
      {
        id: Math.random().toString(36).substr(2, 9),
        type: 'warning',
        title: isPolish ? 'Potencjalne opóźnienie' : 'Potential delay',
        description: isPolish
          ? 'Wykryto ryzyko opóźnienia o 2-3 dni'
          : 'Detected risk of 2-3 day delay',
        confidence: 'medium',
        createdAt: new Date().toISOString(),
      },
    ];
    setAiInsights([...aiInsights, ...newInsights]);
    setIsGeneratingInsights(false);
    toast.success(isPolish ? 'Wygenerowano wskazówki AI' : 'AI insights generated');
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50/30 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 dark:from-blue-500/10 dark:to-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-purple-500/5 to-pink-500/5 dark:from-purple-500/10 dark:to-pink-500/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative flex-shrink-0 px-6 py-4 border-b border-slate-200/80 dark:border-navy-800/80 bg-white/50 dark:bg-navy-900/50 backdrop-blur-xl">
        <div className="flex items-center gap-4">
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

          {taskId && (
            <span className="text-xs font-mono text-slate-400 dark:text-slate-500 bg-slate-100/80 dark:bg-navy-800/80 px-2.5 py-1 rounded-lg">
              #{taskId.slice(0, 8)}
            </span>
          )}
        </div>
      </header>

      {/* Content - Two columns */}
      <div className="relative flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - 2/3 */}
          <div className="lg:col-span-2 space-y-4 order-2 lg:order-1">
            {/* Task Description */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl p-5 border border-slate-200/60 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 dark:from-blue-500/20 dark:to-cyan-500/20">
                  <FileText size={16} className="text-blue-500 dark:text-blue-400" />
                </div>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {isPolish ? 'Opis zadania' : 'Task description'}
                </span>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50/80 dark:bg-navy-800/80 border border-slate-200/80 dark:border-navy-600/80 text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 resize-none transition-all"
                placeholder={isPolish ? 'Opisz szczegóły zadania...' : 'Describe task details...'}
              />
            </motion.div>

            {/* Expected Outcome */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl p-5 border border-slate-200/60 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/20 dark:to-teal-500/20">
                  <Target size={16} className="text-emerald-500 dark:text-emerald-400" />
                </div>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {isPolish ? 'Oczekiwany rezultat' : 'Expected Outcome'}
                </span>
              </div>
              <textarea
                value={expectedOutcome}
                onChange={(e) => setExpectedOutcome(e.target.value)}
                rows={2}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50/80 dark:bg-navy-800/80 border border-slate-200/80 dark:border-navy-600/80 text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/10 resize-none transition-all"
                placeholder={
                  isPolish
                    ? 'Co ma być efektem tego zadania?'
                    : 'What should be the outcome of this task?'
                }
              />
            </motion.div>

            {/* Comments */}
            <CommentsSection
              comments={comments}
              onAddComment={handleAddComment}
              onDeleteComment={handleDeleteComment}
              onLikeComment={handleLikeComment}
              currentUserId="current-user"
              expanded={expandedSections.has('comments')}
              onToggleExpand={() => toggleSection('comments')}
            />

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

            {/* Checklist */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden"
            >
              <motion.button
                whileHover={{ backgroundColor: 'rgba(148, 163, 184, 0.1)' }}
                whileTap={{ scale: 0.98 }}
                onClick={() => toggleSection('checklist')}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors"
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
                  <motion.div
                    animate={{ rotate: expandedSections.has('checklist') ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown size={18} className="text-slate-400" />
                  </motion.div>
                </div>
              </motion.button>

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

            {/* Action Buttons */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-2"
            >
              {/* Primary Actions - Status dependent */}
              {taskId && !isDone && (
                <>
                  {/* Row 1: Main status actions */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* Start - only for todo */}
                    {status === 'todo' && (
                      <motion.button
                        whileHover={{
                          scale: 1.02,
                          boxShadow: '0 4px 20px rgba(59, 130, 246, 0.2)',
                        }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleStartTask}
                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/50 dark:bg-navy-800/50 backdrop-blur-sm border border-blue-400/40 text-blue-500 hover:border-blue-500 hover:bg-blue-500/10 font-medium transition-all shadow-sm"
                      >
                        <Play size={18} />
                        <span>{isPolish ? 'Rozpocznij' : 'Start'}</span>
                      </motion.button>
                    )}

                    {/* Complete - for in_progress or review */}
                    {(status === 'in_progress' || status === 'review') && (
                      <motion.button
                        whileHover={{
                          scale: 1.02,
                          boxShadow: '0 4px 20px rgba(16, 185, 129, 0.2)',
                        }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleCompleteTask}
                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/50 dark:bg-navy-800/50 backdrop-blur-sm border border-emerald-400/40 text-emerald-500 hover:border-emerald-500 hover:bg-emerald-500/10 font-medium transition-all shadow-sm"
                      >
                        <Check size={18} />
                        <span>{isPolish ? 'Ukończ' : 'Complete'}</span>
                      </motion.button>
                    )}

                    {/* Request Review - for in_progress */}
                    {status === 'in_progress' && (
                      <motion.button
                        whileHover={{
                          scale: 1.02,
                          boxShadow: '0 4px 20px rgba(139, 92, 246, 0.2)',
                        }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleRequestReview}
                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/50 dark:bg-navy-800/50 backdrop-blur-sm border border-violet-400/40 text-violet-500 hover:border-violet-500 hover:bg-violet-500/10 font-medium transition-all shadow-sm"
                      >
                        <Eye size={18} />
                        <span>{isPolish ? 'Do przeglądu' : 'Review'}</span>
                      </motion.button>
                    )}

                    {/* Resume - for blocked */}
                    {status === 'blocked' && (
                      <motion.button
                        whileHover={{
                          scale: 1.02,
                          boxShadow: '0 4px 20px rgba(59, 130, 246, 0.2)',
                        }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleStartTask}
                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/50 dark:bg-navy-800/50 backdrop-blur-sm border border-blue-400/40 text-blue-500 hover:border-blue-500 hover:bg-blue-500/10 font-medium transition-all shadow-sm"
                      >
                        <Play size={18} />
                        <span>{isPolish ? 'Wznów' : 'Resume'}</span>
                      </motion.button>
                    )}

                    {/* Delete - always visible */}
                    <motion.button
                      whileHover={{ scale: 1.02, boxShadow: '0 4px 20px rgba(239, 68, 68, 0.2)' }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleDelete}
                      className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/50 dark:bg-navy-800/50 backdrop-blur-sm border border-red-400/40 text-red-500 hover:border-red-500 hover:bg-red-500/10 font-medium transition-all shadow-sm"
                    >
                      <Trash2 size={18} />
                      <span>{isPolish ? 'Usuń' : 'Delete'}</span>
                    </motion.button>
                  </div>

                  {/* Row 2: Secondary actions */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* Pause - for in_progress */}
                    {status === 'in_progress' && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handlePauseTask}
                        className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white/50 dark:bg-navy-800/50 backdrop-blur-sm border border-slate-300/60 dark:border-navy-600/60 text-slate-500 dark:text-slate-400 hover:border-slate-400 dark:hover:border-navy-500 text-sm font-medium transition-all shadow-sm"
                      >
                        <Pause size={16} />
                        <span>{isPolish ? 'Wstrzymaj' : 'Pause'}</span>
                      </motion.button>
                    )}

                    {/* Block - for todo or in_progress */}
                    {(status === 'todo' || status === 'in_progress') && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleBlockTask}
                        className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white/50 dark:bg-navy-800/50 backdrop-blur-sm border border-slate-300/60 dark:border-navy-600/60 text-slate-500 dark:text-slate-400 hover:border-orange-400 hover:text-orange-500 text-sm font-medium transition-all shadow-sm"
                      >
                        <AlertCircle size={16} />
                        <span>{isPolish ? 'Zablokuj' : 'Block'}</span>
                      </motion.button>
                    )}

                    {/* Delegate - always available when not done */}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleDelegateTask}
                      className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white/50 dark:bg-navy-800/50 backdrop-blur-sm border border-slate-300/60 dark:border-navy-600/60 text-slate-500 dark:text-slate-400 hover:border-slate-400 dark:hover:border-navy-500 text-sm font-medium transition-all shadow-sm"
                    >
                      <Share2 size={16} />
                      <span>{isPolish ? 'Deleguj' : 'Delegate'}</span>
                    </motion.button>
                  </div>
                </>
              )}

              {/* Save Button - Always visible */}
              <motion.button
                whileHover={{ scale: 1.02, boxShadow: '0 4px 20px rgba(139, 92, 246, 0.2)' }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSave}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/50 dark:bg-navy-800/50 backdrop-blur-sm border border-purple-400/40 text-purple-500 hover:border-purple-500 hover:bg-purple-500/10 font-medium transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                <span>{isPolish ? 'Zapisz zmiany' : 'Save Changes'}</span>
              </motion.button>
            </motion.div>

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
                <motion.div
                  animate={{ rotate: expandedSections.has('control') ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown size={18} className="text-slate-400" />
                </motion.div>
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

            {/* AI Insights */}
            <AIInsightSection
              insights={aiInsights}
              onGenerateInsights={generateInsightsAI}
              onDismissInsight={(id) => setAiInsights(aiInsights.filter((i) => i.id !== id))}
              isGenerating={isGeneratingInsights}
              expanded={expandedSections.has('aiInsights')}
              onToggleExpand={() => toggleSection('aiInsights')}
            />

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

            {/* Strategic Contribution */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden"
            >
              <motion.button
                whileHover={{ backgroundColor: 'rgba(148, 163, 184, 0.1)' }}
                whileTap={{ scale: 0.98 }}
                onClick={() => toggleSection('strategic')}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500/10 to-purple-500/10 dark:from-violet-500/20 dark:to-purple-500/20">
                    <Sparkles size={18} className="text-violet-500 dark:text-violet-400" />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {isPolish ? 'Wkład strategiczny' : 'Strategic Contribution'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {strategicContribution.length > 0 && (
                    <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                      {strategicContribution.length}
                    </span>
                  )}
                  <motion.div
                    animate={{ rotate: expandedSections.has('strategic') ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown size={18} className="text-slate-400" />
                  </motion.div>
                </div>
              </motion.button>

              <AnimatePresence>
                {expandedSections.has('strategic') && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="border-t border-slate-200 dark:border-navy-700 overflow-hidden"
                  >
                    <div className="p-4 space-y-2">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                        {isPolish
                          ? 'Jakie zmiany wprowadza to zadanie?'
                          : 'What changes does this task introduce?'}
                      </p>
                      {[
                        {
                          key: 'PROCESS_CHANGE',
                          label: { en: 'Process Change', pl: 'Zmiana procesu' },
                          color: 'blue',
                        },
                        {
                          key: 'BEHAVIOR_CHANGE',
                          label: { en: 'Behavior Change', pl: 'Zmiana zachowania' },
                          color: 'emerald',
                        },
                        {
                          key: 'CAPABILITY_CHANGE',
                          label: { en: 'Capability Change', pl: 'Zmiana zdolności' },
                          color: 'purple',
                        },
                      ].map((item) => {
                        const isSelected = strategicContribution.includes(item.key as any);
                        return (
                          <button
                            key={item.key}
                            onClick={() => {
                              if (isSelected) {
                                setStrategicContribution(
                                  strategicContribution.filter((s) => s !== item.key)
                                );
                              } else {
                                setStrategicContribution([
                                  ...strategicContribution,
                                  item.key as any,
                                ]);
                              }
                            }}
                            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                              isSelected
                                ? `bg-${item.color}-50 dark:bg-${item.color}-500/10 border-${item.color}-300 dark:border-${item.color}-500/50 text-${item.color}-700 dark:text-${item.color}-300`
                                : 'bg-slate-50/50 dark:bg-navy-800/50 border-slate-200 dark:border-navy-600 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-navy-500'
                            }`}
                          >
                            <span className="text-sm font-medium">
                              {isPolish ? item.label.pl : item.label.en}
                            </span>
                            {isSelected && <Check size={16} />}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskDetailView;
