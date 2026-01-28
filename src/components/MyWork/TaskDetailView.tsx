/**
 * TaskDetailView
 * Full-page task detail view for dynamic tabs
 * ClickUp-style design following Golden Standard
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  Clock,
  Edit3,
  Flag,
  FolderOpen,
  Link as LinkIcon,
  Loader2,
  MoreVertical,
  Plus,
  Save,
  Sparkles,
  Tag,
  Target,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { InitiativeService } from '../../services/initiativeService';

import {
  AttachmentsSection,
  CommentsSection,
  LinkedItemsSection,
  type Attachment,
  type Comment,
  type LinkedItem,
} from './shared';

interface TaskDetailViewProps {
  taskId: string | null;
  onClose: () => void;
  onSaved?: (data: any) => void;
  onOpenDecision?: (decisionId: string) => void;
}

// Status configuration
const STATUS_CONFIG = {
  todo: { label: { en: 'To Do', pl: 'Do zrobienia' }, color: 'bg-slate-400', icon: CheckSquare },
  in_progress: { label: { en: 'In Progress', pl: 'W trakcie' }, color: 'bg-blue-500', icon: Clock },
  review: { label: { en: 'Review', pl: 'Przegląd' }, color: 'bg-purple-500', icon: Edit3 },
  done: { label: { en: 'Done', pl: 'Ukończone' }, color: 'bg-emerald-500', icon: CheckCircle2 },
  blocked: { label: { en: 'Blocked', pl: 'Zablokowane' }, color: 'bg-red-500', icon: AlertCircle },
};

const PRIORITY_CONFIG = {
  low: { label: { en: 'Low', pl: 'Niski' }, color: 'bg-slate-400', textColor: 'text-slate-500' },
  medium: { label: { en: 'Medium', pl: 'Średni' }, color: 'bg-blue-400', textColor: 'text-blue-500' },
  high: { label: { en: 'High', pl: 'Wysoki' }, color: 'bg-orange-400', textColor: 'text-orange-500' },
  critical: { label: { en: 'Critical', pl: 'Krytyczny' }, color: 'bg-red-500', textColor: 'text-red-500' },
};

// Normalize priority value to ensure it's a valid key
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
  const [startedAt, setStartedAt] = useState('');
  const [completedAt, setCompletedAt] = useState('');
  const [blockedReason, setBlockedReason] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [backupAssigneeId, setBackupAssigneeId] = useState('');
  const [requiresAcceptance, setRequiresAcceptance] = useState(false);
  const [acceptanceType, setAcceptanceType] = useState<'manual' | 'automatic'>('manual');
  const [acceptorId, setAcceptorId] = useState('');
  const [weight, setWeight] = useState<number>(1);
  const [weightReason, setWeightReason] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [checklist, setChecklist] = useState<{ id: string; text: string; completed: boolean }[]>([]);

  // Context
  const [projectId, setProjectId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [initiativeId, setInitiativeId] = useState('');
  const [initiatives, setInitiatives] = useState<{ id: string; name: string }[]>([]);
  const [initiativeTasks, setInitiativeTasks] = useState<any[]>([]);

  // Assignee
  const [assigneeId, setAssigneeId] = useState('');
  const [assigneeName, setAssigneeName] = useState('');
  const [users, setUsers] = useState<{ id: string; firstName: string; lastName: string }[]>([]);
  const [createdBy, setCreatedBy] = useState('');
  const [createdAt, setCreatedAt] = useState('');
  const [updatedAt, setUpdatedAt] = useState('');

  // Attachments, Comments, Links (mock data for now - would be loaded from API)
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [linkedItems, setLinkedItems] = useState<LinkedItem[]>([]);
  const [taskDecisions, setTaskDecisions] = useState<any[]>([]);
  const [loadingDecisions, setLoadingDecisions] = useState(false);
  const [showDecisionForm, setShowDecisionForm] = useState(false);
  const [newDecisionTitle, setNewDecisionTitle] = useState('');
  const [newDecisionDueDate, setNewDecisionDueDate] = useState('');
  const [newDecisionPriority, setNewDecisionPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [blockedByDecisionId, setBlockedByDecisionId] = useState<string>('');

  // UI State
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement | null>(null);
  const priorityDropdownRef = useRef<HTMLDivElement | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['details', 'checklist', 'attachments', 'links', 'comments'])
  );

  // Close dropdowns on click-outside / Escape
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;

      if (showStatusDropdown && statusDropdownRef.current && !statusDropdownRef.current.contains(target)) {
        setShowStatusDropdown(false);
      }
      if (
        showPriorityDropdown &&
        priorityDropdownRef.current &&
        !priorityDropdownRef.current.contains(target)
      ) {
        setShowPriorityDropdown(false);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowStatusDropdown(false);
        setShowPriorityDropdown(false);
      }
    };

    document.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [showStatusDropdown, showPriorityDropdown]);

  useEffect(() => {
    loadInitiatives();
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await Api.get('/users');
      const usersArray = Array.isArray(response) ? response : response?.users || [];
      setUsers(
        usersArray.map((u: any) => ({ id: u.id, firstName: u.firstName, lastName: u.lastName }))
      );
    } catch (error) {
      console.error('Failed to load users', error);
    }
  };

  const loadInitiatives = async () => {
    try {
      const data = await InitiativeService.getAll();
      const initiativesArray = Array.isArray(data) ? data : (data as any)?.initiatives || [];
      setInitiatives(initiativesArray.map((i: any) => ({ id: i.id, name: i.name })));
    } catch (error) {
      console.error('Failed to load initiatives', error);
    }
  };

  useEffect(() => {
    if (taskId) {
      loadTask(taskId);
      // Load decisions linked to this task
      (async () => {
        try {
          setLoadingDecisions(true);
          const decisions = await Api.getTaskDecisions(taskId);
          setTaskDecisions(Array.isArray(decisions) ? decisions : []);
        } catch {
          setTaskDecisions([]);
        } finally {
          setLoadingDecisions(false);
        }
      })();
    } else {
      resetForm();
    }
  }, [taskId]);

  useEffect(() => {
    const run = async () => {
      if (!initiativeId) {
        setInitiativeTasks([]);
        return;
      }
      try {
        const tasks = await Api.getInitiativeTasks(initiativeId);
        setInitiativeTasks(Array.isArray(tasks) ? tasks : []);
      } catch (e) {
        // Not fatal for task view
        setInitiativeTasks([]);
      }
    };
    run();
  }, [initiativeId]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setStatus('todo');
    setPriority('medium');
    setDueDate('');
    setStartedAt('');
    setCompletedAt('');
    setBlockedReason('');
    setTags([]);
    setChecklist([]);
    setInitiativeId('');
    setAssigneeId('');
    setOwnerId('');
    setBackupAssigneeId('');
    setRequiresAcceptance(false);
    setAcceptanceType('manual');
    setAcceptorId('');
    setWeight(1);
    setWeightReason('');
    setAssigneeName('');
    setProjectId('');
    setProjectName('');
    setAttachments([]);
    setComments([]);
    setLinkedItems([]);
    setTaskDecisions([]);
    setShowDecisionForm(false);
    setNewDecisionTitle('');
    setNewDecisionDueDate('');
    setNewDecisionPriority('medium');
    setBlockedByDecisionId('');
  };

  const handleRequestDecision = async () => {
    if (!taskId) return;
    if (!newDecisionTitle.trim()) {
      toast.error(isPolish ? 'Tytuł decyzji jest wymagany' : 'Decision title is required');
      return;
    }
    try {
      const payload = {
        title: newDecisionTitle.trim(),
        description: `Decision required for task: ${title}`,
        relatedObjectType: 'task',
        relatedObjectId: taskId,
        projectId: projectId || null,
        initiativeId: initiativeId || null,
        decisionOwnerId: ownerId || null,
        dueDate: newDecisionDueDate || null,
        priority: newDecisionPriority,
        decisionType: 'EXECUTION',
        pmoDomain: 'GOVERNANCE_DECISION_MAKING',
      };
      const created = await Api.createDecision(payload);
      toast.success(isPolish ? 'Decyzja utworzona' : 'Decision created');
      setShowDecisionForm(false);
      setNewDecisionTitle('');
      setNewDecisionDueDate('');
      setNewDecisionPriority('medium');
      // Refresh
      const decisions = await Api.getTaskDecisions(taskId);
      setTaskDecisions(Array.isArray(decisions) ? decisions : []);
      // Reload task to reflect decision gate auto-block
      await loadTask(taskId);
      const createdId = created?.id;
      if (createdId && onOpenDecision) onOpenDecision(createdId);
    } catch (e: any) {
      toast.error(
        isPolish
          ? 'Nie udało się utworzyć decyzji (wymagane uprawnienie approve_changes)'
          : 'Failed to create decision (requires approve_changes)'
      );
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
      setStartedAt(task.startedAt ? task.startedAt.split('T')[0] : '');
      setCompletedAt(task.completedAt ? task.completedAt.split('T')[0] : '');
      setBlockedReason(task.blockedReason || '');
      setOwnerId(task.ownerId || '');
      setBackupAssigneeId(task.backupAssigneeId || '');
      setRequiresAcceptance(task.requiresAcceptance || false);
      setAcceptanceType(task.acceptanceType || 'manual');
      setAcceptorId(task.acceptorId || '');
      setWeight(typeof task.weight === 'number' ? task.weight : 1);
      setWeightReason(task.weightReason || '');
      setTags(task.tags || []);
      setChecklist(task.checklist || []);
      setInitiativeId(task.initiativeId || '');
      setAssigneeId(task.assigneeId || '');
      setAssigneeName(task.assigneeName || '');
      setProjectId(task.projectId || '');
      setProjectName(task.projectName || '');
      setCreatedBy(task.createdByName || task.createdBy || '');
      setCreatedAt(task.createdAt || '');
      setUpdatedAt(task.updatedAt || '');
      // Load related data
      setAttachments(task.attachments || []);
      setComments(task.comments || []);
      setLinkedItems(task.linkedItems || []);
      setBlockedByDecisionId(task.blockedByDecisionId || '');
    } catch (error) {
      console.error('Failed to load task', error);
      toast.error(isPolish ? 'Nie udało się załadować zadania' : 'Failed to load task details');
    } finally {
      setLoading(false);
    }
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
        startedAt: startedAt || null,
        completedAt: completedAt || null,
        blockedReason: status === 'blocked' ? blockedReason : '',
        tags,
        checklist,
        initiativeId: initiativeId || null,
        assigneeId: assigneeId || null,
        ownerId: ownerId || null,
        backupAssigneeId: backupAssigneeId || null,
        requiresAcceptance: requiresAcceptance || false,
        acceptanceType: requiresAcceptance ? acceptanceType : null,
        acceptorId: requiresAcceptance ? (acceptorId || null) : null,
        weight,
        weightReason: weightReason || null,
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

  const handleDelete = async () => {
    if (!taskId) return;
    if (!confirm(isPolish ? 'Czy na pewno chcesz usunąć to zadanie?' : 'Are you sure you want to delete this task?')) return;

    try {
      await Api.delete(`/tasks/${taskId}`);
      toast.success(isPolish ? 'Zadanie usunięte' : 'Task deleted');
      onClose();
    } catch (error) {
      console.error('Failed to delete task', error);
      toast.error(isPolish ? 'Nie udało się usunąć zadania' : 'Failed to delete task');
    }
  };

  // Checklist handlers
  const addChecklistItem = () => {
    setChecklist([
      ...checklist,
      { id: Math.random().toString(36).substr(2, 9), text: '', completed: false },
    ]);
  };

  const updateChecklistItem = (id: string, updates: Partial<typeof checklist[0]>) => {
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

  // Calculate progress from checklist
  const checklistProgress = useMemo(() => {
    if (checklist.length === 0) return 0;
    return Math.round((checklist.filter((c) => c.completed).length / checklist.length) * 100);
  }, [checklist]);

  // Calculate overdue status
  const isOverdue = useMemo(() => {
    if (!dueDate || status === 'done') return false;
    return new Date(dueDate) < new Date();
  }, [dueDate, status]);

  const daysUntilDue = useMemo(() => {
    if (!dueDate) return null;
    const diff = Math.ceil((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return diff;
  }, [dueDate]);

  const initiativeMeta = useMemo(() => {
    if (!initiativeId) {
      return {
        total: 0,
        position: null as number | null,
        totalWeight: 0,
        contributionPct: null as number | null,
        overdueCount: 0,
        blockedCount: 0,
        rag: 'NA' as 'GREEN' | 'AMBER' | 'RED' | 'NA',
      };
    }

    const isDone = (s?: string) => {
      const v = (s || '').toLowerCase();
      return v === 'done' || v === 'completed' || v === 'validated';
    };

    const tasks = Array.isArray(initiativeTasks) ? [...initiativeTasks] : [];
    const total = tasks.length;
    const totalWeight = tasks.reduce((acc, t: any) => acc + (typeof t.weight === 'number' ? t.weight : 1), 0);

    const byDueThenCreated = tasks.sort((a: any, b: any) => {
      const ad = a?.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
      const bd = b?.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
      if (ad !== bd) return ad - bd;
      const ac = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bc = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      return ac - bc;
    });
    const positionIdx = taskId ? byDueThenCreated.findIndex((t: any) => t?.id === taskId) : -1;
    const position = positionIdx >= 0 ? positionIdx + 1 : null;

    const now = Date.now();
    const overdueCount = tasks.filter((t: any) => {
      if (isDone(t?.status)) return false;
      if (!t?.dueDate) return false;
      return new Date(t.dueDate).getTime() < now;
    }).length;

    const blockedCount = tasks.filter((t: any) => (t?.status || '').toLowerCase() === 'blocked').length;

    let rag: 'GREEN' | 'AMBER' | 'RED' | 'NA' = 'GREEN';
    if (blockedCount > 0 && overdueCount > 0) rag = 'RED';
    else if (blockedCount > 0) rag = 'RED';
    else if (overdueCount > 0) rag = 'AMBER';

    const contributionPct =
      totalWeight > 0 ? Math.round(((typeof weight === 'number' ? weight : 1) / totalWeight) * 100) : null;

    return { total, position, totalWeight, contributionPct, overdueCount, blockedCount, rag };
  }, [initiativeId, initiativeTasks, taskId, weight]);

  const handleSendToChat = async () => {
    const initiativeName = initiatives.find((i) => i.id === initiativeId)?.name || null;
    const lines = [
      `TASK: ${title || '(no title)'}`,
      taskId ? `ID: ${taskId}` : null,
      projectName ? `Project: ${projectName}` : null,
      initiativeName ? `Initiative: ${initiativeName}` : null,
      `Status: ${status}`,
      `Priority: ${priority}`,
      dueDate ? `Due: ${dueDate}${isOverdue ? ' (OVERDUE)' : ''}` : null,
      startedAt ? `Started: ${startedAt}` : null,
      requiresAcceptance ? `Acceptance: required (${acceptanceType}${acceptorId ? `, acceptor=${acceptorId}` : ''})` : null,
      ownerId ? `Owner: ${ownerId}` : null,
      assigneeId ? `Assignee: ${assigneeId}` : `Assignee: (unassigned)`,
      backupAssigneeId ? `Backup: ${backupAssigneeId}` : null,
      initiativeId
        ? `Initiative impact: ${initiativeMeta.contributionPct ?? '—'}% (task weight=${weight}, total weight=${initiativeMeta.totalWeight || '—'})`
        : null,
      initiativeId && initiativeMeta.total
        ? `Initiative tasks: ${initiativeMeta.position ?? '—'}/${initiativeMeta.total} • Risk: ${initiativeMeta.rag} • Overdue: ${initiativeMeta.overdueCount} • Blocked: ${initiativeMeta.blockedCount}`
        : null,
      '',
      'Description:',
      description || '(empty)',
    ].filter(Boolean);

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast.success(isPolish ? 'Skopiowano do czatu' : 'Copied for chat');
    } catch {
      toast.error(isPolish ? 'Nie udało się skopiować' : 'Failed to copy');
    }
  };

  // Attachment handlers (mock)
  const handleUploadAttachments = async (files: FileList) => {
    // TODO: Implement actual file upload
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

  // Comment handlers (mock)
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
          c.id === parentId
            ? { ...c, replies: [...(c.replies || []), newComment] }
            : c
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

  // Linked items handlers (mock)
  const handleAddLinkedItem = async (item: LinkedItem) => {
    setLinkedItems([...linkedItems, item]);
  };

  const handleRemoveLinkedItem = async (id: string) => {
    setLinkedItems(linkedItems.filter((i) => i.id !== id));
  };

  const searchLinkedItems = async (query: string) => {
    // Mock search - would be API call
    return [];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-white dark:bg-navy-950">
        <Loader2 className="animate-spin text-primary-500" size={32} />
      </div>
    );
  }

  // Defensive fallbacks (prevents crash on unexpected/null values)
  const statusConfig =
    (STATUS_CONFIG as any)?.[status] ||
    (STATUS_CONFIG as any)?.todo || {
      label: { en: 'To Do', pl: 'Do zrobienia' },
      color: 'bg-slate-400',
      icon: CheckSquare,
    };
  const priorityConfig =
    (PRIORITY_CONFIG as any)?.[priority] ||
    (PRIORITY_CONFIG as any)?.medium || {
      label: { en: 'Medium', pl: 'Średni' },
      color: 'bg-blue-400',
      textColor: 'text-blue-500',
    };
  const StatusIcon = (statusConfig as any).icon || CheckSquare;
  const isDecisionBlocked = Boolean(blockedByDecisionId);

  return (
    <div className="min-h-0 bg-slate-50 dark:bg-navy-950">
      {/* Content */}
      <div className="p-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          {/* Main */}
          <div className="space-y-4 order-2 lg:order-1">
          {/* Title Section */}
          <div className="bg-white dark:bg-navy-900 rounded-xl p-6 border border-slate-200 dark:border-navy-700 min-h-[152px] flex flex-col justify-between">
            <div className="flex items-center justify-between gap-3 mb-4">
              <button
                onClick={onClose}
                className="p-2 -ml-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                title={isPolish ? 'Wróć' : 'Back'}
              >
                <ChevronLeft size={20} />
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <div className={`w-2.5 h-2.5 rounded-full ${statusConfig.color}`} />
                  <span className="truncate">
                    {taskId
                      ? isPolish
                        ? 'Szczegóły zadania'
                        : 'Task details'
                      : isPolish
                        ? 'Nowe zadanie'
                        : 'New task'}
                  </span>
                  {taskId && (
                    <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
                      #{taskId.slice(0, 8)}
                    </span>
                  )}
                </div>
                {(projectName || (initiativeId && initiatives.find((i) => i.id === initiativeId))) && (
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-500">
                    {projectName && (
                      <>
                        <FolderOpen size={12} />
                        <span className="truncate">{projectName}</span>
                      </>
                    )}
                    {initiativeId && initiatives.find((i) => i.id === initiativeId) && (
                      <>
                        <span className="mx-1">›</span>
                        <Target size={12} />
                        <span className="truncate">{initiatives.find((i) => i.id === initiativeId)?.name}</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className={`w-10 h-10 rounded-xl ${statusConfig.color}/20 flex items-center justify-center`}>
                <StatusIcon size={20} className={statusConfig.color.replace('bg-', 'text-')} />
              </div>
            </div>

            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-xl font-semibold bg-transparent text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
              placeholder={isPolish ? 'Wprowadź tytuł zadania...' : 'Enter task title...'}
              autoFocus={!taskId}
            />

            {isDecisionBlocked && (
              <div className="mt-4 rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-3 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className="text-red-500 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-red-700 dark:text-red-300">
                      {isPolish ? 'Zablokowane decyzją' : 'Blocked by decision'}
                    </div>
                    <div className="text-xs text-red-600/80 dark:text-red-300/80 mt-0.5">
                      {isPolish
                        ? 'Rozwiąż decyzję blokującą, zanim ustawisz status na DONE.'
                        : 'Resolve the blocking decision before marking this task DONE.'}
                    </div>
                  </div>
                </div>
                {onOpenDecision && (
                  <button
                    onClick={() => onOpenDecision(blockedByDecisionId)}
                    className="px-3 py-2 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition-colors"
                  >
                    {isPolish ? 'Otwórz decyzję' : 'Open decision'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
              {isPolish ? 'Opis' : 'Description'}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-primary-300 dark:focus:border-primary-500/50 resize-none"
              placeholder={isPolish ? 'Opisz szczegóły zadania...' : 'Describe task details...'}
            />
          </div>

          {/* Checklist */}
          <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
            <button
              onClick={() => toggleSection('checklist')}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <CheckSquare size={16} className="text-slate-400" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {isPolish ? 'Lista kontrolna' : 'Checklist'}
                </span>
                {checklist.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-400">
                    {checklist.filter((c) => c.completed).length}/{checklist.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {checklist.length > 0 && (
                  <div className="w-24 h-1.5 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${checklistProgress}%` }}
                    />
                  </div>
                )}
                <ChevronDown
                  size={16}
                  className={`text-slate-400 transition-transform ${expandedSections.has('checklist') ? 'rotate-180' : ''}`}
                />
              </div>
            </button>
            <AnimatePresence>
              {expandedSections.has('checklist') && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-slate-200 dark:border-navy-700"
                >
                  <div className="p-4 space-y-2">
                    {checklist.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 group">
                        <input
                          type="checkbox"
                          checked={item.completed}
                          onChange={(e) =>
                            updateChecklistItem(item.id, { completed: e.target.checked })
                          }
                          className="w-4 h-4 rounded border-slate-300 dark:border-navy-600 text-primary-500 focus:ring-primary-500"
                        />
                        <input
                          type="text"
                          value={item.text}
                          onChange={(e) => updateChecklistItem(item.id, { text: e.target.value })}
                          placeholder={isPolish ? 'Wprowadź element...' : 'Enter item...'}
                          className={`flex-1 px-2 py-1 rounded text-sm bg-transparent text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none ${
                            item.completed ? 'line-through text-slate-400 dark:text-slate-500' : ''
                          }`}
                        />
                        <button
                          onClick={() => removeChecklistItem(item.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 dark:hover:bg-red-500/20 text-slate-400 hover:text-red-500 transition-all"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={addChecklistItem}
                      className="flex items-center gap-2 text-sm text-primary-500 hover:text-primary-600 py-2"
                    >
                      <Plus size={14} />
                      <span>{isPolish ? 'Dodaj element' : 'Add item'}</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Attachments */}
          <AttachmentsSection
            attachments={attachments}
            onUpload={handleUploadAttachments}
            onDelete={handleDeleteAttachment}
          />

          {/* Linked Items */}
          <LinkedItemsSection
            items={linkedItems}
            onAdd={handleAddLinkedItem}
            onRemove={handleRemoveLinkedItem}
            searchItems={searchLinkedItems}
            allowedTypes={['decision', 'risk', 'initiative']}
          />

          {/* Tags */}
          <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
            <div className="flex items-center gap-2 mb-3">
              <Tag size={14} className="text-slate-400" />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {isPolish ? 'Tagi' : 'Tags'}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-500/30"
                >
                  {tag}
                  <button
                    onClick={() => removeTag(tag)}
                    className="hover:text-primary-800 dark:hover:text-primary-300"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTag()}
                  placeholder={isPolish ? 'Dodaj tag...' : 'Add tag...'}
                  className="px-2 py-1 rounded text-sm bg-transparent text-slate-600 dark:text-slate-400 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none w-24"
                />
                {newTag && (
                  <button
                    onClick={addTag}
                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-navy-700 text-slate-400"
                  >
                    <Plus size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Comments */}
          <CommentsSection
            comments={comments}
            onAddComment={handleAddComment}
            onDeleteComment={handleDeleteComment}
            onLikeComment={handleLikeComment}
            currentUserId="current-user"
          />

          {/* Metadata Footer */}
          {taskId && (
            <div className="text-xs text-slate-400 dark:text-slate-500 space-y-1 pt-4">
              {createdBy && (
                <p>
                  {isPolish ? 'Utworzone przez' : 'Created by'}: {createdBy}
                  {createdAt && ` • ${new Date(createdAt).toLocaleDateString(isPolish ? 'pl-PL' : 'en-US')}`}
                </p>
              )}
              {updatedAt && (
                <p>
                  {isPolish ? 'Ostatnia aktualizacja' : 'Last updated'}:{' '}
                  {new Date(updatedAt).toLocaleString(isPolish ? 'pl-PL' : 'en-US')}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Control Sidebar (manage) */}
        <div className="space-y-4 lg:sticky lg:top-6 self-start order-1 lg:order-2">
          {/* Actions */}
          <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
            <div className="flex items-center gap-3">
              {taskId && (
                <button
                  onClick={handleDelete}
                  className="h-9 w-9 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors flex items-center justify-center"
                  title={isPolish ? 'Usuń' : 'Delete'}
                >
                  <Trash2 size={18} />
                </button>
              )}

              <button
                onClick={handleSendToChat}
                className="h-9 px-4 rounded-lg bg-purple-500 hover:bg-purple-600 text-white font-medium transition-colors flex items-center gap-2 shadow-sm"
                title={isPolish ? 'Wyślij do AI' : 'Send to AI'}
              >
                <Sparkles size={16} />
                <span>AI</span>
              </button>

              <button
                onClick={handleSave}
                disabled={saving}
                className="h-9 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                <span>{isPolish ? 'Zapisz' : 'Save'}</span>
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
            <div className="flex items-center gap-2 mb-3">
              <Flag size={14} className="text-slate-400" />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {isPolish ? 'Sterowanie' : 'Control'}
              </span>
            </div>
            <div className="space-y-3">
              {/* Status */}
              <div className="relative" ref={statusDropdownRef}>
                <label className="block text-xs text-slate-500 dark:text-slate-500 mb-1">
                  {isPolish ? 'Status' : 'Status'}
                </label>
                <button
                  onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 hover:border-primary-300 dark:hover:border-primary-500/50 transition-colors"
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
                      className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-navy-800 rounded-lg shadow-xl border border-slate-200 dark:border-navy-600 py-1 overflow-hidden"
                    >
                      {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                        <button
                          key={key}
                          disabled={key === 'done' && isDecisionBlocked}
                          onClick={() => {
                            if (key === 'done' && isDecisionBlocked) {
                              toast.error(
                                isPolish
                                  ? 'Nie możesz ustawić DONE: task jest zablokowany decyzją.'
                                  : 'Cannot set DONE: task is blocked by a decision.'
                              );
                              return;
                            }
                            setStatus(key as keyof typeof STATUS_CONFIG);
                            setShowStatusDropdown(false);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors ${
                            status === key ? 'bg-primary-50 dark:bg-primary-500/10' : ''
                          } ${key === 'done' && isDecisionBlocked ? 'opacity-50 cursor-not-allowed' : ''}`}
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
              <div className="relative" ref={priorityDropdownRef}>
                <label className="block text-xs text-slate-500 dark:text-slate-500 mb-1">
                  {isPolish ? 'Priorytet' : 'Priority'}
                </label>
                <button
                  onClick={() => setShowPriorityDropdown(!showPriorityDropdown)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 hover:border-primary-300 dark:hover:border-primary-500/50 transition-colors"
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
                      className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-navy-800 rounded-lg shadow-xl border border-slate-200 dark:border-navy-600 py-1 overflow-hidden"
                    >
                      {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                        <button
                          key={key}
                          onClick={() => {
                            setPriority(key as keyof typeof PRIORITY_CONFIG);
                            setShowPriorityDropdown(false);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors ${
                            priority === key ? 'bg-primary-50 dark:bg-primary-500/10' : ''
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

              {/* Due / Start */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-500 mb-1">
                    {isPolish ? 'Due' : 'Due'}
                  </label>
                  <div
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border ${
                      isOverdue
                        ? 'border-red-300 dark:border-red-500/50 bg-red-50 dark:bg-red-500/10'
                        : 'border-slate-200 dark:border-navy-600'
                    }`}
                  >
                    <Calendar size={14} className={isOverdue ? 'text-red-500' : 'text-slate-400'} />
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className={`flex-1 text-sm bg-transparent focus:outline-none ${
                        isOverdue ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'
                      }`}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-500 mb-1">
                    {isPolish ? 'Start' : 'Start'}
                  </label>
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600">
                    <Calendar size={14} className="text-slate-400" />
                    <input
                      type="date"
                      value={startedAt}
                      onChange={(e) => setStartedAt(e.target.value)}
                      className="flex-1 text-sm bg-transparent focus:outline-none text-slate-700 dark:text-slate-300"
                    />
                  </div>
                </div>
              </div>

              {status === 'done' && (
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-500 mb-1">
                    {isPolish ? 'Ukończono' : 'Completed'}
                  </label>
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600">
                    <CheckCircle2 size={14} className="text-emerald-400" />
                    <input
                      type="date"
                      value={completedAt}
                      onChange={(e) => setCompletedAt(e.target.value)}
                      className="flex-1 text-sm bg-transparent focus:outline-none text-slate-700 dark:text-slate-300"
                    />
                  </div>
                </div>
              )}

              {status === 'blocked' && (
                <div className="bg-red-50 dark:bg-red-500/10 rounded-lg p-3 border border-red-200 dark:border-red-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle size={14} className="text-red-500" />
                    <span className="text-xs font-medium text-red-600 dark:text-red-400">
                      {isPolish ? 'Powód blokady' : 'Blocked reason'}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={blockedReason}
                    onChange={(e) => setBlockedReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-sm text-red-700 dark:text-red-300 placeholder-red-400 dark:placeholder-red-400/60 focus:outline-none"
                    placeholder={isPolish ? 'Co blokuje to zadanie?' : 'What is blocking this task?'}
                  />
                </div>
              )}
            </div>
          </div>

          {/* People */}
          <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
            <div className="flex items-center gap-2 mb-3">
              <Users size={14} className="text-slate-400" />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {isPolish ? 'Osoby' : 'People'}
              </span>
            </div>
            <div className="space-y-3">
              <div className="relative">
                <label className="block text-xs text-slate-500 dark:text-slate-500 mb-1">
                  {isPolish ? 'Assignee' : 'Assignee'}
                </label>
                <div className="relative">
                <select
                  value={assigneeId}
                  onChange={(e) => {
                    setAssigneeId(e.target.value);
                    const user = users.find((u) => u.id === e.target.value);
                    setAssigneeName(user ? `${user.firstName} ${user.lastName}` : '');
                  }}
                  className="w-full pl-9 pr-9 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-primary-300 dark:focus:border-primary-500/50 appearance-none cursor-pointer"
                >
                  <option value="">{isPolish ? 'Nieprzypisane' : 'Unassigned'}</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.firstName} {user.lastName}
                    </option>
                  ))}
                </select>
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="relative">
                <label className="block text-xs text-slate-500 dark:text-slate-500 mb-1">
                  {isPolish ? 'Owner' : 'Owner'}
                </label>
                <div className="relative">
                <select
                  value={ownerId}
                  onChange={(e) => setOwnerId(e.target.value)}
                  className="w-full pl-9 pr-9 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-primary-300 dark:focus:border-primary-500/50 appearance-none cursor-pointer"
                >
                  <option value="">{isPolish ? 'Brak właściciela' : 'No owner'}</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.firstName} {user.lastName}
                    </option>
                  ))}
                </select>
                <Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="relative">
                <label className="block text-xs text-slate-500 dark:text-slate-500 mb-1">
                  {isPolish ? 'Zastępstwo' : 'Backup'}
                </label>
                <div className="relative">
                <select
                  value={backupAssigneeId}
                  onChange={(e) => setBackupAssigneeId(e.target.value)}
                  className="w-full pl-9 pr-9 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-primary-300 dark:focus:border-primary-500/50 appearance-none cursor-pointer"
                >
                  <option value="">{isPolish ? 'Brak zastępstwa' : 'No backup'}</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.firstName} {user.lastName}
                    </option>
                  ))}
                </select>
                <Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Acceptance */}
          <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 size={14} className="text-slate-400" />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {isPolish ? 'Akceptacja' : 'Acceptance'}
              </span>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={requiresAcceptance}
                onChange={(e) => {
                  setRequiresAcceptance(e.target.checked);
                  if (!e.target.checked) {
                    setAcceptorId('');
                  }
                }}
                className="w-4 h-4 rounded border-slate-300 dark:border-navy-600 text-primary-500 focus:ring-primary-300"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                {isPolish ? 'Wymaga akceptacji przed DONE' : 'Requires approval before DONE'}
              </span>
            </label>
            {requiresAcceptance && (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-500 mb-1">
                    {isPolish ? 'Typ' : 'Type'}
                  </label>
                  <select
                    value={acceptanceType}
                    onChange={(e) => setAcceptanceType(e.target.value as 'manual' | 'automatic')}
                    className="w-full px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300"
                  >
                    <option value="manual">{isPolish ? 'Ręczna' : 'Manual'}</option>
                    <option value="automatic">{isPolish ? 'Automatyczna' : 'Automatic'}</option>
                  </select>
                </div>
                {acceptanceType === 'manual' && (
                  <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-500 mb-1">
                      {isPolish ? 'Akceptujący' : 'Acceptor'}
                    </label>
                    <select
                      value={acceptorId}
                      onChange={(e) => setAcceptorId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300"
                    >
                      <option value="">{isPolish ? 'Wybierz osobę' : 'Select person'}</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.firstName} {user.lastName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Initiative */}
          <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
            <div className="flex items-center gap-2 mb-3">
              <Target size={14} className="text-slate-400" />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {isPolish ? 'Inicjatywa' : 'Initiative'}
              </span>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-500 mb-1">
                  {isPolish ? 'Powiązanie' : 'Link'}
                </label>
                <select
                  value={initiativeId}
                  onChange={(e) => setInitiativeId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300"
                >
                  <option value="">{isPolish ? 'Brak (niepowiązane)' : 'None (unlinked)'}</option>
                  {initiatives.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-500 mb-1">
                    {isPolish ? 'Waga' : 'Weight'}
                  </label>
                  <select
                    value={String(weight)}
                    onChange={(e) => setWeight(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300"
                  >
                    {[1, 2, 3, 4, 5].map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 px-3 py-2.5">
                  <div className="text-[11px] text-slate-500 dark:text-slate-500">
                    {isPolish ? 'Udział' : 'Share'}
                  </div>
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {initiativeId ? `${initiativeMeta.contributionPct ?? 0}%` : '—'}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-500 mb-1">
                  {isPolish ? 'Uzasadnienie (opcjonalnie)' : 'Rationale (optional)'}
                </label>
                <input
                  type="text"
                  value={weightReason}
                  onChange={(e) => setWeightReason(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300"
                  placeholder={isPolish ? 'Dlaczego taka waga?' : 'Why this weight?'}
                />
              </div>

              {initiativeId && (
                <div className="text-xs text-slate-500 dark:text-slate-500">
                  {isPolish
                    ? `Task ${initiativeMeta.position ?? '—'}/${initiativeMeta.total || '—'} • Overdue: ${initiativeMeta.overdueCount} • Blocked: ${initiativeMeta.blockedCount}`
                    : `Task ${initiativeMeta.position ?? '—'}/${initiativeMeta.total || '—'} • Overdue: ${initiativeMeta.overdueCount} • Blocked: ${initiativeMeta.blockedCount}`}
                </div>
              )}
            </div>
          </div>

          {/* Links summary */}
          <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
            <div className="flex items-center gap-2 mb-2">
              <LinkIcon size={14} className="text-slate-400" />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {isPolish ? 'Powiązania' : 'Links'}
              </span>
            </div>
            <div className="text-sm text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-500">{isPolish ? 'Decyzje' : 'Decisions'}</span>
              <span className="font-semibold">{linkedItems.filter((i) => i.type === 'decision').length}</span>
            </div>
            <div className="text-sm text-slate-700 dark:text-slate-300 flex items-center justify-between mt-1">
              <span className="text-slate-500 dark:text-slate-500">{isPolish ? 'Ryzyka' : 'Risks'}</span>
              <span className="font-semibold">{linkedItems.filter((i) => i.type === 'risk').length}</span>
            </div>
          </div>

          {/* Required Decisions (PMO) */}
          <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Flag size={14} className="text-slate-400" />
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  {isPolish ? 'Wymagane decyzje' : 'Required decisions'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-navy-700">
                  {taskDecisions.length}
                </span>
              </div>
              {taskId && (
                <button
                  onClick={() => setShowDecisionForm((v) => !v)}
                  className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
                >
                  {showDecisionForm ? (isPolish ? 'Zamknij' : 'Close') : isPolish ? 'Request' : 'Request'}
                </button>
              )}
            </div>

            {showDecisionForm && taskId && (
              <div className="mb-3 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 p-3 space-y-2">
                <input
                  value={newDecisionTitle}
                  onChange={(e) => setNewDecisionTitle(e.target.value)}
                  placeholder={isPolish ? 'Tytuł decyzji…' : 'Decision title…'}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 focus:outline-none"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={newDecisionDueDate}
                    onChange={(e) => setNewDecisionDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 focus:outline-none"
                  />
                  <select
                    value={newDecisionPriority}
                    onChange={(e) => setNewDecisionPriority(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 focus:outline-none"
                  >
                    <option value="low">{isPolish ? 'Niski' : 'Low'}</option>
                    <option value="medium">{isPolish ? 'Średni' : 'Medium'}</option>
                    <option value="high">{isPolish ? 'Wysoki' : 'High'}</option>
                    <option value="critical">{isPolish ? 'Krytyczny' : 'Critical'}</option>
                  </select>
                </div>
                <button
                  onClick={handleRequestDecision}
                  className="w-full px-3 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 transition-colors"
                >
                  {isPolish ? 'Utwórz decyzję' : 'Create decision'}
                </button>
                <p className="text-[11px] text-slate-500 dark:text-slate-500">
                  {isPolish
                    ? 'Uwaga: tworzenie decyzji wymaga uprawnienia approve_changes.'
                    : 'Note: creating decisions requires approve_changes permission.'}
                </p>
              </div>
            )}

            {loadingDecisions ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-500">
                <Loader2 size={14} className="animate-spin" />
                <span>{isPolish ? 'Ładowanie…' : 'Loading…'}</span>
              </div>
            ) : taskDecisions.length === 0 ? (
              <div className="text-sm text-slate-500 dark:text-slate-500">
                {isPolish ? 'Brak decyzji powiązanych z taskiem.' : 'No decisions linked to this task.'}
              </div>
            ) : (
              <div className="space-y-2">
                {taskDecisions.slice(0, 6).map((d: any) => {
                  const st = String(d.status || '').toUpperCase();
                  const pill =
                    st === 'APPROVED'
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                      : st === 'REJECTED'
                        ? 'bg-red-500/10 text-red-500 border-red-500/20'
                        : st === 'ESCALATED'
                          ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                          : 'bg-slate-500/10 text-slate-500 border-slate-500/20';

                  return (
                    <button
                      key={d.id}
                      onClick={() => (onOpenDecision ? onOpenDecision(d.id) : undefined)}
                      className="w-full text-left p-2 rounded-lg border border-slate-200 dark:border-navy-700 hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors"
                      title={isPolish ? 'Otwórz decyzję' : 'Open decision'}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                            {d.title || d.id}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-500 mt-0.5">
                            {(d.ownerName && `${d.ownerName} • `) || ''}
                            {d.dueDate ? `${isPolish ? 'Due' : 'Due'}: ${String(d.dueDate).slice(0, 10)}` : '—'}
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] border ${pill}`}>{st || 'PENDING'}</span>
                      </div>
                    </button>
                  );
                })}
                {taskDecisions.length > 6 && (
                  <div className="text-xs text-slate-500 dark:text-slate-500">
                    {isPolish ? '…więcej w panelu decyzji' : '…more in Decisions panel'}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};

export default TaskDetailView;
