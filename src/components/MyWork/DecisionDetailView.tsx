/**
 * DecisionDetailView
 * Full-page decision detail view for dynamic tabs
 * ClickUp-style design following Golden Standard
 * Includes: alternatives with pros/cons, impact matrix, escalation rules
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowUpCircle,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  Clock,
  FileText,
  Flag,
  FolderOpen,
  Layers,
  Lightbulb,
  Loader2,
  MoreVertical,
  Plus,
  Save,
  Scale,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';

import {
  AttachmentsSection,
  CommentsSection,
  LinkedItemsSection,
  EscalationRulesSection,
  type Attachment,
  type Comment,
  type LinkedItem,
  type ReminderRule,
  type EscalationRule,
  type WarningThresholds,
} from './shared';

interface DecisionDetailViewProps {
  decisionId: string | null;
  onClose: () => void;
  onSaved?: (data: any) => void;
}

// Types
interface Alternative {
  id: string;
  title: string;
  description: string;
  pros: string[];
  cons: string[];
  estimatedCost?: number;
  estimatedDuration?: string;
  isRecommended: boolean;
}

interface ImpactAssessment {
  scope: 'low' | 'medium' | 'high';
  schedule: 'low' | 'medium' | 'high';
  cost: 'low' | 'medium' | 'high';
  quality: 'low' | 'medium' | 'high';
  description?: string;
}

// Status configuration
const STATUS_CONFIG = {
  pending: { label: { en: 'Pending', pl: 'Oczekująca' }, color: 'bg-amber-500', textColor: 'text-amber-500' },
  approved: { label: { en: 'Approved', pl: 'Zatwierdzona' }, color: 'bg-emerald-500', textColor: 'text-emerald-500' },
  rejected: { label: { en: 'Rejected', pl: 'Odrzucona' }, color: 'bg-red-500', textColor: 'text-red-500' },
  deferred: { label: { en: 'Deferred', pl: 'Odroczona' }, color: 'bg-slate-500', textColor: 'text-slate-500' },
  escalated: { label: { en: 'Escalated', pl: 'Eskalowana' }, color: 'bg-orange-500', textColor: 'text-orange-500' },
};

const PRIORITY_CONFIG = {
  low: { label: { en: 'Low', pl: 'Niski' }, color: 'bg-slate-400', textColor: 'text-slate-500' },
  medium: { label: { en: 'Medium', pl: 'Średni' }, color: 'bg-blue-400', textColor: 'text-blue-500' },
  high: { label: { en: 'High', pl: 'Wysoki' }, color: 'bg-orange-400', textColor: 'text-orange-500' },
  critical: { label: { en: 'Critical', pl: 'Krytyczny' }, color: 'bg-red-500', textColor: 'text-red-500' },
};

const CATEGORY_CONFIG = {
  scope_change: { label: { en: 'Scope Change', pl: 'Zmiana zakresu' }, icon: Layers },
  budget_change: { label: { en: 'Budget Change', pl: 'Zmiana budżetu' }, icon: FileText },
  schedule_change: { label: { en: 'Schedule Change', pl: 'Zmiana harmonogramu' }, icon: Calendar },
  resource_allocation: { label: { en: 'Resource Allocation', pl: 'Alokacja zasobów' }, icon: Users },
  risk_response: { label: { en: 'Risk Response', pl: 'Odpowiedź na ryzyko' }, icon: AlertTriangle },
  technical: { label: { en: 'Technical', pl: 'Techniczna' }, icon: FileText },
  strategic: { label: { en: 'Strategic', pl: 'Strategiczna' }, icon: Star },
};

const IMPACT_LEVELS = {
  low: { label: { en: 'Low', pl: 'Niski' }, color: 'bg-emerald-500', emoji: '🟢' },
  medium: { label: { en: 'Medium', pl: 'Średni' }, color: 'bg-amber-500', emoji: '🟡' },
  high: { label: { en: 'High', pl: 'Wysoki' }, color: 'bg-red-500', emoji: '🔴' },
};

export const DecisionDetailView: React.FC<DecisionDetailViewProps> = ({
  decisionId,
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
  const [status, setStatus] = useState<keyof typeof STATUS_CONFIG>('pending');
  const [priority, setPriority] = useState<keyof typeof PRIORITY_CONFIG>('medium');
  const [category, setCategory] = useState<keyof typeof CATEGORY_CONFIG>('technical');
  const [dueDate, setDueDate] = useState('');
  const [rationale, setRationale] = useState('');

  // People
  const [requesterId, setRequesterId] = useState('');
  const [requesterName, setRequesterName] = useState('');
  const [deciderId, setDeciderId] = useState('');
  const [deciderName, setDeciderName] = useState('');
  const [users, setUsers] = useState<{ id: string; firstName: string; lastName: string }[]>([]);

  // Context
  const [projectId, setProjectId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [decisionDate, setDecisionDate] = useState('');
  const [createdAt, setCreatedAt] = useState('');
  const [updatedAt, setUpdatedAt] = useState('');

  // Alternatives
  const [alternatives, setAlternatives] = useState<Alternative[]>([]);
  const [selectedAlternativeId, setSelectedAlternativeId] = useState('');

  // Impact Assessment
  const [impact, setImpact] = useState<ImpactAssessment>({
    scope: 'medium',
    schedule: 'medium',
    cost: 'medium',
    quality: 'medium',
    description: '',
  });

  // Escalation & Reminders
  const [reminders, setReminders] = useState<ReminderRule[]>([
    { id: '1', type: 'before_due', daysOffset: 3, recipients: 'decider', enabled: true },
    { id: '2', type: 'before_due', daysOffset: 1, recipients: 'both', enabled: true },
  ]);
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

  // UI State
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['description', 'alternatives', 'impact', 'escalation', 'attachments', 'links', 'comments'])
  );
  const [editingAlternativeId, setEditingAlternativeId] = useState<string | null>(null);

  useEffect(() => {
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

  useEffect(() => {
    if (decisionId) {
      loadDecision(decisionId);
    } else {
      resetForm();
    }
  }, [decisionId]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setStatus('pending');
    setPriority('medium');
    setCategory('technical');
    setDueDate('');
    setRationale('');
    setRequesterId('');
    setRequesterName('');
    setDeciderId('');
    setDeciderName('');
    setProjectId('');
    setProjectName('');
    setAlternatives([]);
    setSelectedAlternativeId('');
    setImpact({ scope: 'medium', schedule: 'medium', cost: 'medium', quality: 'medium' });
    setAttachments([]);
    setComments([]);
    setLinkedItems([]);
  };

  const loadDecision = async (id: string) => {
    try {
      setLoading(true);
      const decision = await Api.getDecision(id);
      setTitle(decision.title || '');
      setDescription(decision.description || '');
      setStatus(decision.status?.toLowerCase() || 'pending');
      setPriority(decision.priority?.toLowerCase() || 'medium');
      setCategory(decision.category || 'technical');
      setDueDate(decision.dueDate ? decision.dueDate.split('T')[0] : '');
      setRationale(decision.rationale || '');
      setRequesterId(decision.requestedBy || '');
      setRequesterName(decision.requestedByName || '');
      setDeciderId(decision.deciderId || '');
      setDeciderName(decision.deciderName || '');
      setProjectId(decision.projectId || '');
      setProjectName(decision.projectName || '');
      setDecisionDate(decision.decisionDate || '');
      setCreatedAt(decision.createdAt || '');
      setUpdatedAt(decision.updatedAt || '');
      setAlternatives(decision.alternatives || []);
      setSelectedAlternativeId(decision.selectedAlternativeId || '');
      if (decision.impact) {
        setImpact(decision.impact);
      }
      setAttachments(decision.attachments || []);
      setComments(decision.comments || []);
      setLinkedItems(decision.linkedItems || []);
    } catch (error) {
      console.error('Failed to load decision', error);
      toast.error(isPolish ? 'Nie udało się załadować decyzji' : 'Failed to load decision');
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
        status: status.toUpperCase(),
        priority: priority.toUpperCase(),
        category,
        dueDate: dueDate || null,
        rationale,
        deciderId: deciderId || null,
        alternatives,
        selectedAlternativeId: selectedAlternativeId || null,
        impact,
      };

      if (decisionId) {
        await Api.updateDecision(decisionId, payload);
        toast.success(isPolish ? 'Decyzja zaktualizowana' : 'Decision updated');
      } else {
        await Api.createDecision(payload);
        toast.success(isPolish ? 'Decyzja utworzona' : 'Decision created');
      }
      onSaved?.({ ...payload, id: decisionId });
    } catch (error) {
      console.error('Failed to save decision', error);
      toast.error(isPolish ? 'Nie udało się zapisać decyzji' : 'Failed to save decision');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!decisionId) return;
    try {
      await Api.updateDecision(decisionId, { status: 'APPROVED' });
      setStatus('approved');
      setDecisionDate(new Date().toISOString());
      toast.success(isPolish ? 'Decyzja zatwierdzona' : 'Decision approved');
      onSaved?.({ title, status: 'approved' });
    } catch (error) {
      toast.error(isPolish ? 'Nie udało się zatwierdzić' : 'Failed to approve');
    }
  };

  const handleReject = async () => {
    if (!decisionId) return;
    try {
      await Api.updateDecision(decisionId, { status: 'REJECTED' });
      setStatus('rejected');
      setDecisionDate(new Date().toISOString());
      toast.success(isPolish ? 'Decyzja odrzucona' : 'Decision rejected');
      onSaved?.({ title, status: 'rejected' });
    } catch (error) {
      toast.error(isPolish ? 'Nie udało się odrzucić' : 'Failed to reject');
    }
  };

  // Alternative handlers
  const addAlternative = () => {
    const newAlt: Alternative = {
      id: Math.random().toString(36).substr(2, 9),
      title: '',
      description: '',
      pros: [],
      cons: [],
      isRecommended: false,
    };
    setAlternatives([...alternatives, newAlt]);
    setEditingAlternativeId(newAlt.id);
  };

  const updateAlternative = (id: string, updates: Partial<Alternative>) => {
    setAlternatives(alternatives.map((a) => (a.id === id ? { ...a, ...updates } : a)));
  };

  const removeAlternative = (id: string) => {
    setAlternatives(alternatives.filter((a) => a.id !== id));
    if (selectedAlternativeId === id) {
      setSelectedAlternativeId('');
    }
  };

  const setRecommendedAlternative = (id: string) => {
    setAlternatives(
      alternatives.map((a) => ({
        ...a,
        isRecommended: a.id === id,
      }))
    );
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

  // Calculate overdue status
  const isOverdue = useMemo(() => {
    if (!dueDate || status !== 'pending') return false;
    return new Date(dueDate) < new Date();
  }, [dueDate, status]);

  const isPending = status === 'pending';
  const statusConfig = STATUS_CONFIG[status];
  const priorityConfig = PRIORITY_CONFIG[priority];
  const CategoryIcon = CATEGORY_CONFIG[category]?.icon || FileText;

  // Attachment handlers (mock)
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

  // Escalation save handler
  const handleSaveEscalation = async (data: {
    reminders: ReminderRule[];
    escalation: EscalationRule | null;
    thresholds: WarningThresholds;
  }) => {
    setReminders(data.reminders);
    setEscalation(data.escalation);
    setThresholds(data.thresholds);
    // Would save to API
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-white dark:bg-navy-950">
        <Loader2 className="animate-spin text-primary-500" size={32} />
      </div>
    );
  }

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
              <div className={`w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center`}>
                <Scale size={20} className="text-purple-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold text-slate-800 dark:text-white">
                    {decisionId ? (isPolish ? 'Szczegóły decyzji' : 'Decision Details') : (isPolish ? 'Nowa decyzja' : 'New Decision')}
                  </h1>
                  {decisionId && (
                    <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
                      DEC-{decisionId.slice(0, 6).toUpperCase()}
                    </span>
                  )}
                </div>
                {/* Breadcrumb */}
                {projectName && (
                  <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                    <FolderOpen size={12} />
                    <span>{projectName}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-2">
            {/* Quick Actions for Pending */}
            {decisionId && isPending && (
              <>
                <button
                  onClick={handleApprove}
                  className="px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors flex items-center gap-2"
                >
                  <Check size={16} />
                  <span className="hidden sm:inline">{isPolish ? 'Zatwierdź' : 'Approve'}</span>
                </button>
                <button
                  onClick={handleReject}
                  className="px-3 py-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors flex items-center gap-2"
                >
                  <X size={16} />
                  <span className="hidden sm:inline">{isPolish ? 'Odrzuć' : 'Reject'}</span>
                </button>
              </>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-purple-600 text-white font-medium hover:brightness-110 transition-all flex items-center gap-2 disabled:opacity-50"
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
              placeholder={isPolish ? 'Wprowadź tytuł decyzji...' : 'Enter decision title...'}
              autoFocus={!decisionId}
            />
          </div>

          {/* Quick Info Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Status */}
            <div className="relative">
              <button
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 hover:border-primary-300 transition-colors"
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
                        onClick={() => {
                          setStatus(key as keyof typeof STATUS_CONFIG);
                          setShowStatusDropdown(false);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-navy-700 ${
                          status === key ? 'bg-primary-50 dark:bg-primary-500/10' : ''
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
              <button
                onClick={() => setShowPriorityDropdown(!showPriorityDropdown)}
                className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 hover:border-primary-300 transition-colors"
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
                        className={`w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-navy-700 ${
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

            {/* Category */}
            <div className="relative">
              <button
                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 hover:border-primary-300 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <CategoryIcon size={14} className="text-slate-400" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                    {isPolish ? CATEGORY_CONFIG[category]?.label.pl : CATEGORY_CONFIG[category]?.label.en}
                  </span>
                </div>
                <ChevronDown size={16} className="text-slate-400" />
              </button>
              <AnimatePresence>
                {showCategoryDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-navy-800 rounded-lg shadow-xl border border-slate-200 dark:border-navy-600 py-1 max-h-48 overflow-y-auto"
                  >
                    {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
                      const Icon = config.icon;
                      return (
                        <button
                          key={key}
                          onClick={() => {
                            setCategory(key as keyof typeof CATEGORY_CONFIG);
                            setShowCategoryDropdown(false);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-navy-700 ${
                            category === key ? 'bg-primary-50 dark:bg-primary-500/10' : ''
                          }`}
                        >
                          <Icon size={14} className="text-slate-400" />
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
          </div>

          {/* People (Requester & Decider) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-2">
                {isPolish ? 'Zgłoszone przez' : 'Requested by'}
              </label>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                  <span className="text-xs font-medium text-white">
                    {requesterName ? requesterName.charAt(0).toUpperCase() : '?'}
                  </span>
                </div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {requesterName || (isPolish ? 'Nieznany' : 'Unknown')}
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-2">
                {isPolish ? 'Decydent' : 'Decider'}
              </label>
              <select
                value={deciderId}
                onChange={(e) => {
                  setDeciderId(e.target.value);
                  const user = users.find((u) => u.id === e.target.value);
                  setDeciderName(user ? `${user.firstName} ${user.lastName}` : '');
                }}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value="">{isPolish ? 'Wybierz decydenta' : 'Select decider'}</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.firstName} {user.lastName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
              {isPolish ? 'Opis problemu / kontekst' : 'Problem description / context'}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none resize-none"
              placeholder={isPolish ? 'Opisz kontekst i wymagania decyzji...' : 'Describe the context and requirements...'}
            />
          </div>

          {/* Impact Assessment */}
          <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
            <button
              onClick={() => toggleSection('impact')}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-navy-800/50"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle size={16} className="text-amber-500" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {isPolish ? 'Ocena wpływu' : 'Impact Assessment'}
                </span>
              </div>
              <ChevronDown
                size={16}
                className={`text-slate-400 transition-transform ${expandedSections.has('impact') ? 'rotate-180' : ''}`}
              />
            </button>
            <AnimatePresence>
              {expandedSections.has('impact') && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="border-t border-slate-200 dark:border-navy-700 overflow-hidden"
                >
                  <div className="p-4">
                    <div className="grid grid-cols-4 gap-3 mb-4">
                      {(['scope', 'schedule', 'cost', 'quality'] as const).map((dimension) => (
                        <div key={dimension} className="text-center">
                          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-2 capitalize">
                            {isPolish
                              ? dimension === 'scope' ? 'Zakres' 
                                : dimension === 'schedule' ? 'Harmonogram'
                                : dimension === 'cost' ? 'Koszt'
                                : 'Jakość'
                              : dimension}
                          </label>
                          <div className="flex justify-center gap-1">
                            {(['low', 'medium', 'high'] as const).map((level) => (
                              <button
                                key={level}
                                onClick={() => setImpact({ ...impact, [dimension]: level })}
                                className={`w-8 h-8 rounded-lg text-lg transition-all ${
                                  impact[dimension] === level
                                    ? `${IMPACT_LEVELS[level].color} shadow-lg scale-110`
                                    : 'bg-slate-100 dark:bg-navy-700 hover:bg-slate-200 dark:hover:bg-navy-600'
                                }`}
                                title={isPolish ? IMPACT_LEVELS[level].label.pl : IMPACT_LEVELS[level].label.en}
                              >
                                {IMPACT_LEVELS[level].emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <textarea
                      value={impact.description || ''}
                      onChange={(e) => setImpact({ ...impact, description: e.target.value })}
                      rows={2}
                      placeholder={isPolish ? 'Opisz wpływ decyzji...' : 'Describe the impact...'}
                      className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none resize-none"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Alternatives */}
          <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
            <button
              onClick={() => toggleSection('alternatives')}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-navy-800/50"
            >
              <div className="flex items-center gap-3">
                <Lightbulb size={16} className="text-amber-500" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {isPolish ? 'Alternatywy' : 'Alternatives'}
                </span>
                {alternatives.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-400">
                    {alternatives.length}
                  </span>
                )}
              </div>
              <ChevronDown
                size={16}
                className={`text-slate-400 transition-transform ${expandedSections.has('alternatives') ? 'rotate-180' : ''}`}
              />
            </button>
            <AnimatePresence>
              {expandedSections.has('alternatives') && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="border-t border-slate-200 dark:border-navy-700 overflow-hidden"
                >
                  <div className="p-4 space-y-3">
                    {alternatives.map((alt, index) => (
                      <div
                        key={alt.id}
                        className={`p-4 rounded-lg border transition-all ${
                          alt.isRecommended
                            ? 'border-amber-300 dark:border-amber-500/50 bg-amber-50 dark:bg-amber-500/10'
                            : selectedAlternativeId === alt.id
                            ? 'border-emerald-300 dark:border-emerald-500/50 bg-emerald-50 dark:bg-emerald-500/10'
                            : 'border-slate-200 dark:border-navy-600 bg-slate-50 dark:bg-navy-800'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-navy-600 flex items-center justify-center text-xs font-medium text-slate-600 dark:text-slate-400">
                              {index + 1}
                            </span>
                            <input
                              type="text"
                              value={alt.title}
                              onChange={(e) => updateAlternative(alt.id, { title: e.target.value })}
                              placeholder={isPolish ? 'Nazwa opcji...' : 'Option name...'}
                              className="font-medium text-slate-800 dark:text-white bg-transparent focus:outline-none"
                            />
                            {alt.isRecommended && (
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-600 dark:text-amber-400">
                                <Star size={10} />
                                {isPolish ? 'Rekomendowana' : 'Recommended'}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setRecommendedAlternative(alt.id)}
                              className={`p-1.5 rounded hover:bg-amber-100 dark:hover:bg-amber-500/20 ${
                                alt.isRecommended ? 'text-amber-500' : 'text-slate-400'
                              }`}
                              title={isPolish ? 'Ustaw jako rekomendowaną' : 'Set as recommended'}
                            >
                              <Star size={14} className={alt.isRecommended ? 'fill-current' : ''} />
                            </button>
                            <button
                              onClick={() => removeAlternative(alt.id)}
                              className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-500/20 text-slate-400 hover:text-red-500"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        <textarea
                          value={alt.description}
                          onChange={(e) => updateAlternative(alt.id, { description: e.target.value })}
                          placeholder={isPolish ? 'Opis opcji...' : 'Option description...'}
                          rows={2}
                          className="w-full mb-3 px-2 py-1 rounded text-sm bg-transparent text-slate-600 dark:text-slate-400 placeholder-slate-400 focus:outline-none resize-none"
                        />

                        <div className="grid grid-cols-2 gap-3">
                          {/* Pros */}
                          <div>
                            <div className="flex items-center gap-1 mb-2 text-xs text-emerald-600 dark:text-emerald-400">
                              <ThumbsUp size={12} />
                              <span>{isPolish ? 'Zalety' : 'Pros'}</span>
                            </div>
                            <div className="space-y-1">
                              {alt.pros.map((pro, i) => (
                                <div key={i} className="flex items-center gap-1 group">
                                  <span className="text-emerald-500">+</span>
                                  <input
                                    type="text"
                                    value={pro}
                                    onChange={(e) => {
                                      const newPros = [...alt.pros];
                                      newPros[i] = e.target.value;
                                      updateAlternative(alt.id, { pros: newPros });
                                    }}
                                    className="flex-1 text-xs bg-transparent text-slate-600 dark:text-slate-400 focus:outline-none"
                                  />
                                  <button
                                    onClick={() => {
                                      updateAlternative(alt.id, {
                                        pros: alt.pros.filter((_, idx) => idx !== i),
                                      });
                                    }}
                                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500"
                                  >
                                    <X size={10} />
                                  </button>
                                </div>
                              ))}
                              <button
                                onClick={() =>
                                  updateAlternative(alt.id, { pros: [...alt.pros, ''] })
                                }
                                className="text-xs text-emerald-500 hover:text-emerald-600"
                              >
                                + {isPolish ? 'Dodaj' : 'Add'}
                              </button>
                            </div>
                          </div>

                          {/* Cons */}
                          <div>
                            <div className="flex items-center gap-1 mb-2 text-xs text-red-600 dark:text-red-400">
                              <ThumbsDown size={12} />
                              <span>{isPolish ? 'Wady' : 'Cons'}</span>
                            </div>
                            <div className="space-y-1">
                              {alt.cons.map((con, i) => (
                                <div key={i} className="flex items-center gap-1 group">
                                  <span className="text-red-500">-</span>
                                  <input
                                    type="text"
                                    value={con}
                                    onChange={(e) => {
                                      const newCons = [...alt.cons];
                                      newCons[i] = e.target.value;
                                      updateAlternative(alt.id, { cons: newCons });
                                    }}
                                    className="flex-1 text-xs bg-transparent text-slate-600 dark:text-slate-400 focus:outline-none"
                                  />
                                  <button
                                    onClick={() => {
                                      updateAlternative(alt.id, {
                                        cons: alt.cons.filter((_, idx) => idx !== i),
                                      });
                                    }}
                                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500"
                                  >
                                    <X size={10} />
                                  </button>
                                </div>
                              ))}
                              <button
                                onClick={() =>
                                  updateAlternative(alt.id, { cons: [...alt.cons, ''] })
                                }
                                className="text-xs text-red-500 hover:text-red-600"
                              >
                                + {isPolish ? 'Dodaj' : 'Add'}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Select as chosen */}
                        {status !== 'pending' && (
                          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-navy-600">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="selectedAlternative"
                                checked={selectedAlternativeId === alt.id}
                                onChange={() => setSelectedAlternativeId(alt.id)}
                                className="text-primary-500"
                              />
                              <span className="text-sm text-slate-600 dark:text-slate-400">
                                {isPolish ? 'Wybrana opcja' : 'Selected option'}
                              </span>
                            </label>
                          </div>
                        )}
                      </div>
                    ))}

                    <button
                      onClick={addAlternative}
                      className="w-full py-3 rounded-lg border-2 border-dashed border-slate-200 dark:border-navy-600 text-slate-500 dark:text-slate-400 hover:border-primary-300 dark:hover:border-primary-500/50 hover:text-primary-500 transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus size={16} />
                      <span>{isPolish ? 'Dodaj alternatywę' : 'Add alternative'}</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Rationale (for decided) */}
          {status !== 'pending' && (
            <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                {isPolish ? 'Uzasadnienie decyzji' : 'Decision Rationale'}
              </label>
              <textarea
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none resize-none"
                placeholder={isPolish ? 'Wyjaśnij powód tej decyzji...' : 'Explain the reasoning...'}
              />
            </div>
          )}

          {/* Escalation & Reminders */}
          <EscalationRulesSection
            reminders={reminders}
            escalation={escalation}
            thresholds={thresholds}
            availableUsers={users.map((u) => ({
              id: u.id,
              name: `${u.firstName} ${u.lastName}`,
            }))}
            onSave={handleSaveEscalation}
            dueDate={dueDate}
          />

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
            allowedTypes={['task', 'risk', 'initiative']}
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
          {decisionId && (
            <div className="text-xs text-slate-400 dark:text-slate-500 space-y-1 pt-4">
              {decisionDate && (
                <p>
                  {isPolish ? 'Data decyzji' : 'Decision date'}:{' '}
                  {new Date(decisionDate).toLocaleDateString(isPolish ? 'pl-PL' : 'en-US')}
                </p>
              )}
              {createdAt && (
                <p>
                  {isPolish ? 'Utworzono' : 'Created'}:{' '}
                  {new Date(createdAt).toLocaleDateString(isPolish ? 'pl-PL' : 'en-US')}
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

export default DecisionDetailView;
