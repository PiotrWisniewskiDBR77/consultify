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

import { Api } from '../../services/api';
import { InitiativeService } from '../../services/initiativeService';

import {
  AttachmentsSection,
  CommentsSection,
  LinkedItemsSection,
  TaskTimer,
  type Attachment,
  type Comment,
  type LinkedItem,
} from './shared';

interface TaskDetailViewProps {
  taskId: string | null;
  onClose: () => void;
  onSaved?: (data: any) => void;
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

export const TaskDetailView: React.FC<TaskDetailViewProps> = ({
  taskId,
  onClose,
  onSaved,
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
  const [estimatedHours, setEstimatedHours] = useState<number | ''>('');
  const [actualHours, setActualHours] = useState<number | ''>('');
  const [blockedReason, setBlockedReason] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [checklist, setChecklist] = useState<{ id: string; text: string; completed: boolean }[]>([]);

  // Context
  const [projectId, setProjectId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [initiativeId, setInitiativeId] = useState('');
  const [initiatives, setInitiatives] = useState<{ id: string; name: string }[]>([]);

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

  // UI State
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['details', 'checklist', 'attachments', 'links', 'comments'])
  );

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
    } else {
      resetForm();
    }
  }, [taskId]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setStatus('todo');
    setPriority('medium');
    setDueDate('');
    setStartDate('');
    setEstimatedHours('');
    setActualHours('');
    setBlockedReason('');
    setTags([]);
    setChecklist([]);
    setInitiativeId('');
    setAssigneeId('');
    setAssigneeName('');
    setProjectId('');
    setProjectName('');
    setAttachments([]);
    setComments([]);
    setLinkedItems([]);
  };

  const loadTask = async (id: string) => {
    try {
      setLoading(true);
      const task = await Api.get(`/tasks/${id}`);
      setTitle(task.title || '');
      setDescription(task.description || '');
      setStatus(task.status || 'todo');
      setPriority(task.priority || 'medium');
      setDueDate(task.dueDate ? task.dueDate.split('T')[0] : '');
      setStartDate(task.startDate ? task.startDate.split('T')[0] : '');
      setEstimatedHours(task.estimatedHours || '');
      setActualHours(task.actualHours || '');
      setBlockedReason(task.blockedReason || '');
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
        startDate: startDate || null,
        estimatedHours: estimatedHours || null,
        actualHours: actualHours || null,
        blockedReason: status === 'blocked' ? blockedReason : '',
        tags,
        checklist,
        initiativeId: initiativeId || null,
        assigneeId: assigneeId || null,
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

  const statusConfig = STATUS_CONFIG[status];
  const priorityConfig = PRIORITY_CONFIG[priority];
  const StatusIcon = statusConfig.icon;

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-navy-950">
      {/* Header */}
      <div className="bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-navy-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${statusConfig.color}/20 flex items-center justify-center`}>
                <StatusIcon size={20} className={statusConfig.color.replace('bg-', 'text-')} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold text-slate-800 dark:text-white">
                    {taskId ? (isPolish ? 'Szczegóły zadania' : 'Task Details') : (isPolish ? 'Nowe zadanie' : 'New Task')}
                  </h1>
                  {taskId && (
                    <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
                      #{taskId.slice(0, 8)}
                    </span>
                  )}
                </div>
                {/* Breadcrumb */}
                <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                  {projectName && (
                    <>
                      <FolderOpen size={12} />
                      <span>{projectName}</span>
                    </>
                  )}
                  {initiativeId && initiatives.find((i) => i.id === initiativeId) && (
                    <>
                      <span className="mx-1">›</span>
                      <Target size={12} />
                      <span>{initiatives.find((i) => i.id === initiativeId)?.name}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-2">
            {taskId && (
              <button
                onClick={handleDelete}
                className="px-3 py-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex items-center gap-2"
              >
                <Trash2 size={16} />
                <span className="hidden sm:inline">{isPolish ? 'Usuń' : 'Delete'}</span>
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-primary-500 to-primary-600 text-white font-medium hover:brightness-110 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              <span>{isPolish ? 'Zapisz' : 'Save'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Title Section */}
          <div className="bg-white dark:bg-navy-900 rounded-xl p-6 border border-slate-200 dark:border-navy-700">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-xl font-semibold bg-transparent text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
              placeholder={isPolish ? 'Wprowadź tytuł zadania...' : 'Enter task title...'}
              autoFocus={!taskId}
            />
          </div>

          {/* Quick Info Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Status Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 hover:border-primary-300 dark:hover:border-primary-500/50 transition-colors"
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
                    {Object.entries(STATUS_CONFIG).map(([key, config]) => {
                      const Icon = config.icon;
                      return (
                        <button
                          key={key}
                          onClick={() => {
                            setStatus(key as keyof typeof STATUS_CONFIG);
                            setShowStatusDropdown(false);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors ${
                            status === key ? 'bg-primary-50 dark:bg-primary-500/10' : ''
                          }`}
                        >
                          <div className={`w-2.5 h-2.5 rounded-full ${config.color}`} />
                          <span className="text-slate-700 dark:text-slate-300">
                            {isPolish ? config.label.pl : config.label.en}
                          </span>
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Priority Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowPriorityDropdown(!showPriorityDropdown)}
                className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 hover:border-primary-300 dark:hover:border-primary-500/50 transition-colors"
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

            {/* Due Date */}
            <div className="relative">
              <div className={`flex items-center gap-2 px-4 py-3 rounded-xl bg-white dark:bg-navy-900 border ${
                isOverdue 
                  ? 'border-red-300 dark:border-red-500/50 bg-red-50 dark:bg-red-500/10' 
                  : 'border-slate-200 dark:border-navy-700'
              }`}>
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
              {isOverdue && (
                <span className="absolute -top-2 -right-2 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-red-500 text-white">
                  {isPolish ? 'Spóźnione' : 'Overdue'}
                </span>
              )}
            </div>

            {/* Assignee */}
            <div className="relative">
              <select
                value={assigneeId}
                onChange={(e) => {
                  setAssigneeId(e.target.value);
                  const user = users.find((u) => u.id === e.target.value);
                  setAssigneeName(user ? `${user.firstName} ${user.lastName}` : '');
                }}
                className="w-full px-4 py-3 rounded-xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-primary-300 dark:focus:border-primary-500/50 appearance-none cursor-pointer"
              >
                <option value="">{isPolish ? 'Nieprzypisane' : 'Unassigned'}</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.firstName} {user.lastName}
                  </option>
                ))}
              </select>
              <User size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Blocked Reason Alert */}
          {status === 'blocked' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-red-50 dark:bg-red-500/10 rounded-xl p-4 border border-red-200 dark:border-red-500/30"
            >
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={16} className="text-red-500" />
                <span className="text-sm font-medium text-red-600 dark:text-red-400">
                  {isPolish ? 'Powód blokady' : 'Reason for blocking'}
                </span>
              </div>
              <input
                type="text"
                value={blockedReason}
                onChange={(e) => setBlockedReason(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300 placeholder-red-400 dark:placeholder-red-400/50 focus:outline-none"
                placeholder={isPolish ? 'Co blokuje to zadanie?' : 'What is blocking this task?'}
              />
            </motion.div>
          )}

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

          {/* Time Tracking with Timer */}
          {taskId && (
            <TaskTimer
              taskId={taskId}
              taskTitle={title}
              initialTime={(actualHours || 0) * 3600}
              onTimeUpdate={(totalSeconds) => {
                const hours = totalSeconds / 3600;
                setActualHours(Math.round(hours * 10) / 10);
              }}
              onTimerStop={(duration) => {
                const additionalHours = duration / 3600;
                setActualHours((prev) => {
                  const current = typeof prev === 'number' ? prev : 0;
                  return Math.round((current + additionalHours) * 10) / 10;
                });
              }}
            />
          )}

          {/* Manual Time Entry */}
          <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={14} className="text-slate-400" />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {isPolish ? 'Czas ręczny' : 'Manual Time Entry'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-500 mb-1">
                  {isPolish ? 'Szacowany czas (h)' : 'Estimated (h)'}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(e.target.value ? parseFloat(e.target.value) : '')}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-primary-300"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-500 mb-1">
                  {isPolish ? 'Rzeczywisty czas (h)' : 'Actual (h)'}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={actualHours}
                  onChange={(e) => setActualHours(e.target.value ? parseFloat(e.target.value) : '')}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-primary-300"
                  placeholder="0"
                />
              </div>
            </div>
            {/* Progress bar comparing estimated vs actual */}
            {estimatedHours && actualHours && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                  <span>{isPolish ? 'Progres czasu' : 'Time progress'}</span>
                  <span className={actualHours > estimatedHours ? 'text-red-500' : 'text-emerald-500'}>
                    {Math.round((actualHours / estimatedHours) * 100)}%
                  </span>
                </div>
                <div className="h-2 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      actualHours > estimatedHours ? 'bg-red-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, (actualHours / estimatedHours) * 100)}%` }}
                  />
                </div>
              </div>
            )}
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
      </div>
    </div>
  );
};

export default TaskDetailView;
