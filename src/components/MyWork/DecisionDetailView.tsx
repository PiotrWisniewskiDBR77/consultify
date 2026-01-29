/**
 * DecisionDetailView
 * Full-page decision detail view for dynamic tabs
 * ClickUp-style design following Golden Standard
 * Includes: alternatives with pros/cons, impact matrix, escalation rules
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  FileText,
  Flag,
  FolderOpen,
  HelpCircle,
  Layers,
  Lightbulb,
  Loader2,
  Minus,
  Plus,
  Save,
  Scale,
  Share2,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import {
  type Alternative,
  AlternativesSection,
  type Attachment,
  AttachmentsSection,
  type Comment,
  CommentsSection,
  DeadlineAlertBanner,
  DecisionReadinessBar,
  type DecisionReadinessData,
  DelegationModal,
  type EscalationRule,
  EscalationRulesSection,
  ImpactAssessmentCompact,
  type ImpactValues,
  type LinkedItem,
  LinkedItemsSection,
  type ReminderRule,
  RiskAssessmentCompact,
  type RiskItem,
  type Stakeholder,
  type StakeholderNotificationSettings,
  type StakeholderRole,
  StakeholdersSection,
  type WarningThresholds,
} from './shared';

interface DecisionDetailViewProps {
  decisionId: string | null;
  onClose: () => void;
  onSaved?: (data: any) => void;
}

// Types - Alternative and ImpactValues are imported from ./shared

// Status configuration
const STATUS_CONFIG = {
  pending: {
    label: { en: 'Pending', pl: 'Oczekująca' },
    color: 'bg-amber-500',
    textColor: 'text-amber-500',
  },
  approved: {
    label: { en: 'Approved', pl: 'Zatwierdzona' },
    color: 'bg-emerald-500',
    textColor: 'text-emerald-500',
  },
  rejected: {
    label: { en: 'Rejected', pl: 'Odrzucona' },
    color: 'bg-red-500',
    textColor: 'text-red-500',
  },
  deferred: {
    label: { en: 'Deferred', pl: 'Odroczona' },
    color: 'bg-slate-500',
    textColor: 'text-slate-500',
  },
  escalated: {
    label: { en: 'Escalated', pl: 'Eskalowana' },
    color: 'bg-orange-500',
    textColor: 'text-orange-500',
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

// Normalize priority value to ensure it's a valid key
const normalizePriority = (priority?: string | null): keyof typeof PRIORITY_CONFIG => {
  if (!priority) return 'medium';
  const normalized = priority.toLowerCase();
  if (normalized === 'urgent') return 'critical';
  if (normalized in PRIORITY_CONFIG) return normalized as keyof typeof PRIORITY_CONFIG;
  return 'medium';
};

const CATEGORY_CONFIG = {
  scope_change: { label: { en: 'Scope Change', pl: 'Zmiana zakresu' }, icon: Layers },
  budget_change: { label: { en: 'Budget Change', pl: 'Zmiana budżetu' }, icon: FileText },
  schedule_change: { label: { en: 'Schedule Change', pl: 'Zmiana harmonogramu' }, icon: Calendar },
  resource_allocation: {
    label: { en: 'Resource Allocation', pl: 'Alokacja zasobów' },
    icon: Users,
  },
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
  const [requesterName, setRequesterName] = useState('');
  const [deciderId, setDeciderId] = useState('');
  const [users, setUsers] = useState<
    { id: string; firstName: string; lastName: string; email?: string }[]
  >([]);

  // Initiative (parent)
  const [initiativeId, setInitiativeId] = useState<string | null>(null);
  const [initiativeName, setInitiativeName] = useState<string | null>(null);
  const [availableInitiatives] = useState<
    { id: string; name: string; type: 'project' | 'program' | 'portfolio' }[]
  >([
    { id: 'init-1', name: 'Digital Transformation 2026', type: 'program' },
    { id: 'init-2', name: 'Cloud Migration', type: 'project' },
    { id: 'init-3', name: 'Customer Experience Improvement', type: 'portfolio' },
  ]);
  const [showInitiativeDropdown, setShowInitiativeDropdown] = useState(false);

  // Context
  const [projectName, setProjectName] = useState('');
  const [decisionDate, setDecisionDate] = useState('');
  const [createdAt, setCreatedAt] = useState('');
  const [updatedAt, setUpdatedAt] = useState('');

  // Alternatives
  const [alternatives, setAlternatives] = useState<Alternative[]>([]);
  const [selectedAlternativeId, setSelectedAlternativeId] = useState('');
  const [editingAlternativeId, setEditingAlternativeId] = useState<string | null>(null);

  // Decider name (for display)
  const [deciderName, setDeciderName] = useState('');

  // Impact Assessment
  const [impact, setImpact] = useState<ImpactValues>({
    scope: 'medium',
    schedule: 'medium',
    cost: 'medium',
    quality: 'medium',
    description: '',
  });

  // Risk Assessment
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [isGeneratingRisks, setIsGeneratingRisks] = useState(false);
  const [isGeneratingAlternatives, setIsGeneratingAlternatives] = useState(false);

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

  // Stakeholders & Delegation
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [showDelegationModal, setShowDelegationModal] = useState(false);

  // UI State
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set([]));

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
    setRequesterName('');
    setDeciderId('');
    setProjectName('');
    setAlternatives([]);
    setSelectedAlternativeId('');
    setImpact({
      scope: 'medium',
      schedule: 'medium',
      cost: 'medium',
      quality: 'medium',
      description: '',
    });
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
      setPriority(normalizePriority(decision.priority));
      setCategory(decision.category || 'technical');
      setDueDate(decision.dueDate ? decision.dueDate.split('T')[0] : '');
      setRationale(decision.rationale || '');
      setRequesterName(decision.requestedByName || '');
      setDeciderId(decision.deciderId || '');
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

      // Load stakeholders
      try {
        const stakeholdersResponse = await Api.get(`/decisions/${id}/stakeholders`);
        setStakeholders(stakeholdersResponse?.stakeholders || []);
      } catch {
        // Stakeholders endpoint may not exist yet
        setStakeholders([]);
      }
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

  const handleRequestMoreInfo = async () => {
    if (!decisionId) return;
    try {
      // Add a comment requesting more information
      const requestComment = isPolish
        ? 'Proszę o dostarczenie dodatkowych informacji przed podjęciem decyzji.'
        : 'Please provide additional information before a decision can be made.';

      await handleAddComment(requestComment);

      // Optionally update status to show it needs more info
      // For now, we'll just notify via toast and add the comment
      toast.success(
        isPolish
          ? 'Prośba o więcej informacji została wysłana'
          : 'Request for more information sent'
      );

      // Trigger delegation modal for more detailed request
      setShowDelegationModal(true);
    } catch (error) {
      toast.error(isPolish ? 'Nie udało się wysłać prośby' : 'Failed to send request');
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

  // Risk handlers
  const addRisk = () => {
    const newRisk: RiskItem = {
      id: Math.random().toString(36).substr(2, 9),
      title: '',
      probability: 'medium',
      impact: 'medium',
      category: 'business',
      mitigation: '',
      contingency: '',
    };
    setRisks([...risks, newRisk]);
  };

  const updateRisk = (id: string, updates: Partial<RiskItem>) => {
    setRisks(risks.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };

  const removeRisk = (id: string) => {
    setRisks(risks.filter((r) => r.id !== id));
  };

  // AI Generation handlers
  const generateAlternativesAI = async () => {
    if (!title && !description) {
      toast.error(isPolish ? 'Dodaj tytuł lub opis decyzji' : 'Add title or description first');
      return;
    }

    setIsGeneratingAlternatives(true);
    try {
      // Simulated AI generation - replace with actual API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const generatedAlternatives: Alternative[] = [
        {
          id: Math.random().toString(36).substr(2, 9),
          title: isPolish ? 'Opcja 1: Podejście konserwatywne' : 'Option 1: Conservative approach',
          description: isPolish
            ? 'Minimalne zmiany, niskie ryzyko, stopniowa implementacja'
            : 'Minimal changes, low risk, gradual implementation',
          pros: [
            isPolish ? 'Niskie ryzyko' : 'Low risk',
            isPolish ? 'Łatwa implementacja' : 'Easy implementation',
          ],
          cons: [isPolish ? 'Wolniejsze rezultaty' : 'Slower results'],
          isRecommended: false,
        },
        {
          id: Math.random().toString(36).substr(2, 9),
          title: isPolish ? 'Opcja 2: Podejście agresywne' : 'Option 2: Aggressive approach',
          description: isPolish
            ? 'Szybka implementacja, wyższe ryzyko, szybsze rezultaty'
            : 'Fast implementation, higher risk, faster results',
          pros: [
            isPolish ? 'Szybkie rezultaty' : 'Fast results',
            isPolish ? 'Przewaga konkurencyjna' : 'Competitive advantage',
          ],
          cons: [
            isPolish ? 'Wyższe ryzyko' : 'Higher risk',
            isPolish ? 'Wyższe koszty' : 'Higher costs',
          ],
          isRecommended: false,
        },
        {
          id: Math.random().toString(36).substr(2, 9),
          title: isPolish ? 'Opcja 3: Podejście hybrydowe' : 'Option 3: Hybrid approach',
          description: isPolish
            ? 'Balans między szybkością a bezpieczeństwem'
            : 'Balance between speed and safety',
          pros: [
            isPolish ? 'Zbalansowane ryzyko' : 'Balanced risk',
            isPolish ? 'Elastyczność' : 'Flexibility',
          ],
          cons: [isPolish ? 'Wymaga więcej koordynacji' : 'Requires more coordination'],
          isRecommended: true,
        },
      ];

      setAlternatives([...alternatives, ...generatedAlternatives]);
      toast.success(isPolish ? 'Wygenerowano alternatywy' : 'Alternatives generated');
    } catch (error) {
      toast.error(isPolish ? 'Błąd generowania' : 'Generation failed');
    } finally {
      setIsGeneratingAlternatives(false);
    }
  };

  const generateRisksAI = async () => {
    if (!title && !description) {
      toast.error(isPolish ? 'Dodaj tytuł lub opis decyzji' : 'Add title or description first');
      return;
    }

    setIsGeneratingRisks(true);
    try {
      // Simulated AI generation - replace with actual API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const generatedRisks: RiskItem[] = [
        {
          id: Math.random().toString(36).substr(2, 9),
          title: isPolish ? 'Ryzyko budżetowe' : 'Budget risk',
          probability: 'medium',
          impact: 'high',
          category: 'financial',
          mitigation: isPolish
            ? 'Regularne przeglądy budżetu, bufor 15%'
            : 'Regular budget reviews, 15% buffer',
          contingency: isPolish
            ? 'Redukcja zakresu lub przesunięcie terminu'
            : 'Scope reduction or timeline extension',
        },
        {
          id: Math.random().toString(36).substr(2, 9),
          title: isPolish ? 'Ryzyko techniczne' : 'Technical risk',
          probability: 'low',
          impact: 'high',
          category: 'technical',
          mitigation: isPolish ? 'POC przed pełną implementacją' : 'POC before full implementation',
          contingency: isPolish
            ? 'Alternatywne rozwiązanie techniczne'
            : 'Alternative technical solution',
        },
        {
          id: Math.random().toString(36).substr(2, 9),
          title: isPolish ? 'Ryzyko zasobów' : 'Resource risk',
          probability: 'medium',
          impact: 'medium',
          category: 'operational',
          mitigation: isPolish
            ? 'Cross-training zespołu, dokumentacja'
            : 'Team cross-training, documentation',
          contingency: isPolish ? 'Zewnętrzni konsultanci' : 'External consultants',
        },
      ];

      setRisks([...risks, ...generatedRisks]);
      toast.success(isPolish ? 'Wygenerowano analizę ryzyka' : 'Risk analysis generated');
    } catch (error) {
      toast.error(isPolish ? 'Błąd generowania' : 'Generation failed');
    } finally {
      setIsGeneratingRisks(false);
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

  // Calculate overdue status
  const isOverdue = useMemo(() => {
    if (!dueDate || status !== 'pending') return false;
    return new Date(dueDate) < new Date();
  }, [dueDate, status]);

  const isPending = status === 'pending';
  // Defensive fallbacks (prevents crash on unexpected/null values)
  const statusConfig = (STATUS_CONFIG as any)?.[status] ||
    (STATUS_CONFIG as any)?.pending || {
      label: { en: 'Pending', pl: 'Oczekująca' },
      color: 'bg-amber-500',
      textColor: 'text-amber-500',
    };
  const priorityConfig = (PRIORITY_CONFIG as any)?.[normalizePriority(priority)] ||
    (PRIORITY_CONFIG as any)?.medium || {
      label: { en: 'Medium', pl: 'Średni' },
      color: 'bg-blue-400',
      textColor: 'text-blue-500',
    };
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

  return (
    <div className="min-h-0 bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950">
      <div className="p-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          {/* Main */}
          <div className="space-y-5 order-2 lg:order-1">
            {/* Title Section - Clean Minimal Header */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="relative bg-white/80 dark:bg-navy-900/80 backdrop-blur-xl rounded-2xl p-6 border border-slate-200/50 dark:border-navy-700/50 shadow-lg shadow-purple-500/5 dark:shadow-purple-500/10 overflow-hidden"
            >
              {/* Gradient Accent */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500" />
              <div className="flex items-center gap-3 relative z-10">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onClose}
                  className="p-2 -ml-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-navy-800/80 backdrop-blur-sm transition-all duration-200"
                  title={isPolish ? 'Wróć' : 'Back'}
                >
                  <ChevronLeft size={20} />
                </motion.button>

                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="flex-1 text-2xl font-bold bg-transparent text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 rounded-lg px-2 py-1 -mx-2 -my-1 transition-all"
                  placeholder={isPolish ? 'Wprowadź tytuł decyzji...' : 'Enter decision title...'}
                  autoFocus={!decisionId}
                />
              </div>
            </motion.div>

            {/* Description - Enhanced with Floating Label Effect */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="relative bg-white/80 dark:bg-navy-900/80 backdrop-blur-xl rounded-2xl p-5 border border-slate-200/50 dark:border-navy-700/50 shadow-md hover:shadow-lg transition-shadow duration-300"
            >
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                <FileText size={16} className="text-purple-500" />
                {isPolish ? 'Opis problemu / kontekst' : 'Problem description / context'}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                className="w-full px-4 py-3 rounded-xl bg-gradient-to-br from-slate-50 to-white dark:from-navy-800 dark:to-navy-900 border-2 border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-purple-400 dark:focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 resize-none transition-all duration-200"
                placeholder={
                  isPolish
                    ? 'Opisz kontekst i wymagania decyzji...'
                    : 'Describe the context and requirements...'
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

            {/* Risk Assessment */}
            <RiskAssessmentCompact
              risks={risks}
              onAdd={addRisk}
              onUpdate={updateRisk}
              onRemove={removeRisk}
              onGenerateAI={generateRisksAI}
              expanded={expandedSections.has('risk')}
              onToggleExpand={() => toggleSection('risk')}
              isGenerating={isGeneratingRisks}
            />

            {/* Alternatives */}
            <AlternativesSection
              alternatives={alternatives}
              selectedAlternativeId={selectedAlternativeId}
              status={status}
              onAdd={addAlternative}
              onUpdate={updateAlternative}
              onRemove={removeAlternative}
              onSetRecommended={setRecommendedAlternative}
              onSelect={setSelectedAlternativeId}
              onGenerateAI={generateAlternativesAI}
              expanded={expandedSections.has('alternatives')}
              onToggleExpand={() => toggleSection('alternatives')}
              isGenerating={isGeneratingAlternatives}
            />
          </div>

          {/* Control Sidebar (manage) - Premium Sticky */}
          <div className="space-y-4 lg:sticky lg:top-6 self-start order-1 lg:order-2">
            {/* Deadline Alert - Above Control Panel */}
            <DeadlineAlertBanner dueDate={dueDate} status={status} />

            {/* Actions Panel - Outline Style */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-2"
            >
              {/* Primary Actions - Decision */}
              {decisionId && isPending && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <motion.button
                      whileHover={{ scale: 1.02, borderColor: 'rgb(16, 185, 129)' }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleApprove}
                      className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-transparent border border-emerald-400/60 text-emerald-500 hover:border-emerald-500 hover:bg-emerald-500/10 font-medium transition-all duration-200"
                    >
                      <Check size={18} />
                      <span>{isPolish ? 'Zatwierdź' : 'Approve'}</span>
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02, borderColor: 'rgb(239, 68, 68)' }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleReject}
                      className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-transparent border border-red-400/60 text-red-500 hover:border-red-500 hover:bg-red-500/10 font-medium transition-all duration-200"
                    >
                      <X size={18} />
                      <span>{isPolish ? 'Odrzuć' : 'Reject'}</span>
                    </motion.button>
                  </div>

                  {/* Secondary Actions */}
                  <div className="grid grid-cols-2 gap-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleRequestMoreInfo}
                      className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-transparent border border-slate-300 dark:border-navy-600 text-slate-500 dark:text-slate-400 hover:border-slate-400 dark:hover:border-navy-500 hover:text-slate-600 dark:hover:text-slate-300 text-sm font-medium transition-all duration-200"
                    >
                      <HelpCircle size={16} />
                      <span>{isPolish ? 'Więcej info' : 'Request Info'}</span>
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowDelegationModal(true)}
                      className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-transparent border border-slate-300 dark:border-navy-600 text-slate-500 dark:text-slate-400 hover:border-slate-400 dark:hover:border-navy-500 hover:text-slate-600 dark:hover:text-slate-300 text-sm font-medium transition-all duration-200"
                    >
                      <Share2 size={16} />
                      <span>{isPolish ? 'Deleguj' : 'Delegate'}</span>
                    </motion.button>
                  </div>
                </>
              )}

              {/* Save Button - Purple Outline */}
              <motion.button
                whileHover={{ scale: 1.02, borderColor: 'rgb(168, 85, 247)' }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSave}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-transparent border border-purple-400/60 text-purple-500 hover:border-purple-500 hover:bg-purple-500/10 font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                <span>{isPolish ? 'Zapisz zmiany' : 'Save Changes'}</span>
              </motion.button>
            </motion.div>

            {/* Control - Premium Panel */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-white/80 dark:bg-navy-900/80 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-navy-700/50 shadow-lg overflow-hidden"
            >
              {/* Collapsible Header */}
              <motion.button
                whileHover={{ backgroundColor: 'rgba(148, 163, 184, 0.1)' }}
                whileTap={{ scale: 0.98 }}
                onClick={() => toggleSection('control')}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors duration-200"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 dark:from-purple-500/20 dark:to-pink-500/20">
                    <Flag size={18} className="text-purple-500 dark:text-purple-400" />
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

              {/* Collapsible Content */}
              <AnimatePresence>
                {expandedSections.has('control') && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="border-t border-slate-200 dark:border-navy-700 overflow-hidden"
                  >
                    <div className="p-4 space-y-3">
                      {/* Initiative / Parent */}
                      <div className="relative">
                        <label className="block text-xs text-slate-500 dark:text-slate-500 mb-1">
                          {isPolish ? 'Inicjatywa' : 'Initiative'}
                        </label>
                        <button
                          onClick={() => setShowInitiativeDropdown(!showInitiativeDropdown)}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 hover:border-primary-300 dark:hover:border-primary-500/50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            {initiativeId ? (
                              <>
                                <div className="p-1 rounded bg-blue-500/10">
                                  <Layers size={12} className="text-blue-500" />
                                </div>
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                                  {initiativeName}
                                </span>
                              </>
                            ) : (
                              <>
                                <div className="p-1 rounded bg-slate-200 dark:bg-navy-700">
                                  <Minus size={12} className="text-slate-400" />
                                </div>
                                <span className="text-sm text-slate-400 dark:text-slate-500">
                                  {isPolish ? 'Samodzielna decyzja' : 'Standalone decision'}
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
                              className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-navy-800 rounded-lg shadow-xl border border-slate-200 dark:border-navy-600 py-1 overflow-hidden max-h-60 overflow-y-auto"
                            >
                              {/* Standalone option */}
                              <button
                                onClick={() => {
                                  setInitiativeId(null);
                                  setInitiativeName(null);
                                  setShowInitiativeDropdown(false);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors ${
                                  !initiativeId ? 'bg-primary-50 dark:bg-primary-500/10' : ''
                                }`}
                              >
                                <div className="p-1 rounded bg-slate-200 dark:bg-navy-700">
                                  <Minus size={12} className="text-slate-400" />
                                </div>
                                <span className="text-slate-500 dark:text-slate-400">
                                  {isPolish ? 'Samodzielna decyzja' : 'Standalone decision'}
                                </span>
                              </button>

                              <div className="border-t border-slate-100 dark:border-navy-700 my-1" />

                              {/* Available initiatives */}
                              {availableInitiatives.map((init) => (
                                <button
                                  key={init.id}
                                  onClick={() => {
                                    setInitiativeId(init.id);
                                    setInitiativeName(init.name);
                                    setShowInitiativeDropdown(false);
                                  }}
                                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors ${
                                    initiativeId === init.id
                                      ? 'bg-primary-50 dark:bg-primary-500/10'
                                      : ''
                                  }`}
                                >
                                  <div
                                    className={`p-1 rounded ${
                                      init.type === 'project'
                                        ? 'bg-emerald-500/10'
                                        : init.type === 'program'
                                          ? 'bg-blue-500/10'
                                          : 'bg-purple-500/10'
                                    }`}
                                  >
                                    <Layers
                                      size={12}
                                      className={
                                        init.type === 'project'
                                          ? 'text-emerald-500'
                                          : init.type === 'program'
                                            ? 'text-blue-500'
                                            : 'text-purple-500'
                                      }
                                    />
                                  </div>
                                  <div className="flex-1 text-left">
                                    <span className="text-slate-700 dark:text-slate-300 block">
                                      {init.name}
                                    </span>
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                                      {init.type === 'project'
                                        ? isPolish
                                          ? 'Projekt'
                                          : 'Project'
                                        : init.type === 'program'
                                          ? isPolish
                                            ? 'Program'
                                            : 'Program'
                                          : isPolish
                                            ? 'Portfolio'
                                            : 'Portfolio'}
                                    </span>
                                  </div>
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Status */}
                      <div className="relative">
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
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Priority */}
                      <div className="relative">
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

                      {/* Category */}
                      <div className="relative">
                        <label className="block text-xs text-slate-500 dark:text-slate-500 mb-1">
                          {isPolish ? 'Kategoria' : 'Category'}
                        </label>
                        <button
                          onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 hover:border-primary-300 dark:hover:border-primary-500/50 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <CategoryIcon size={14} className="text-slate-400" />
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                              {isPolish
                                ? CATEGORY_CONFIG[category]?.label.pl
                                : CATEGORY_CONFIG[category]?.label.en}
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
                                    className={`w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors ${
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

                      {/* Due */}
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
                          <Calendar
                            size={14}
                            className={isOverdue ? 'text-red-500' : 'text-slate-400'}
                          />
                          <input
                            type="date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            className={`flex-1 text-sm bg-transparent focus:outline-none ${
                              isOverdue
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-slate-700 dark:text-slate-300'
                            }`}
                          />
                        </div>
                      </div>

                      {/* Requested by + Decider */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="min-w-0">
                          <label className="block text-xs text-slate-500 dark:text-slate-500 mb-1">
                            {isPolish ? 'Zgłoszone przez' : 'Requested by'}
                          </label>
                          <div className="h-[42px] px-3 flex items-center rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300">
                            <span className="truncate">
                              {requesterName || (isPolish ? 'Nieznany' : 'Unknown')}
                            </span>
                          </div>
                        </div>
                        <div className="min-w-0">
                          <label className="block text-xs text-slate-500 dark:text-slate-500 mb-1">
                            {isPolish ? 'Decydent' : 'Decider'}
                          </label>
                          <select
                            value={deciderId}
                            onChange={(e) => {
                              setDeciderId(e.target.value);
                              const user = users.find((u) => u.id === e.target.value);
                              setDeciderName(user ? `${user.firstName} ${user.lastName}` : '');
                            }}
                            className="w-full h-[42px] px-3 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 focus:outline-none truncate"
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
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Stakeholders (RACI) */}
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
                  decisionId: decisionId || 'new',
                  userId,
                  userName: user ? `${user.firstName} ${user.lastName}` : undefined,
                  userEmail: user?.email,
                  role,
                  notificationSettings,
                };
                setStakeholders([...stakeholders, newStakeholder]);
                toast.success(isPolish ? 'Dodano interesariusza' : 'Stakeholder added');

                // If we have a decisionId, also save to API
                if (decisionId) {
                  Api.post(`/decisions/${decisionId}/stakeholders`, {
                    stakeholderUserId: userId,
                    role,
                    notificationSettings,
                  }).catch(() => {
                    // Silently handle API error - local state already updated
                  });
                }
              }}
              onUpdate={(id: string, updates: Partial<Stakeholder>) => {
                setStakeholders(stakeholders.map((s) => (s.id === id ? { ...s, ...updates } : s)));

                // If we have a decisionId, also save to API
                if (decisionId) {
                  const stakeholder = stakeholders.find((s) => s.id === id);
                  if (stakeholder) {
                    Api.post(
                      `/decisions/${decisionId}/stakeholders/${stakeholder.userId}`,
                      updates
                    ).catch(() => {
                      // Silently handle API error
                    });
                  }
                }
              }}
              onRemove={(id: string) => {
                const stakeholder = stakeholders.find((s) => s.id === id);
                setStakeholders(stakeholders.filter((s) => s.id !== id));
                toast.success(isPolish ? 'Usunięto interesariusza' : 'Stakeholder removed');

                // If we have a decisionId, also delete from API
                if (decisionId && stakeholder) {
                  Api.delete(`/decisions/${decisionId}/stakeholders/${stakeholder.userId}`).catch(
                    () => {
                      // Silently handle API error
                    }
                  );
                }
              }}
            />

            {/* Escalation & Reminders */}
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
              allowedTypes={['task', 'risk', 'initiative']}
              expanded={expandedSections.has('linkedItems')}
              onToggleExpand={() => toggleSection('linkedItems')}
            />
          </div>
        </div>
      </div>

      {/* Delegation Modal */}
      {decisionId && (
        <DelegationModal
          isOpen={showDelegationModal}
          onClose={() => setShowDelegationModal(false)}
          decisionId={decisionId}
          decisionTitle={title}
          availableUsers={users.map((u) => ({
            id: u.id,
            name: `${u.firstName} ${u.lastName}`,
          }))}
          currentDeciderId={deciderId}
          onDelegated={() => {
            // Reload decision to get updated data
            loadDecision(decisionId);
          }}
        />
      )}
    </div>
  );
};

export default DecisionDetailView;
