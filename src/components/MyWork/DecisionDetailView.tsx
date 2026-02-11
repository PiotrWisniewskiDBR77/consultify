/**
 * DecisionDetailView
 * Full-page decision detail view for dynamic tabs
 * Supports 3 presentation modes: accordion / notion / clickup
 * Accordion mode: "summary-first + smart open" per doc canon
 *
 * @see docs/ui-standards/detail-view-presentation-modes.md
 * @see docs/00_foundation/DBR77_VISUAL_LANGUAGE_STANDARD.md
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowUp,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronsDownUp,
  ChevronsUpDown,
  Clock,
  Edit3,
  FileText,
  Flag,
  FolderOpen,
  HelpCircle,
  History,
  Layers,
  Lightbulb,
  Loader2,
  MessageSquare,
  Minus,
  Plus,
  Save,
  Share2,
  Sparkles,
  Star,
  Tag,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { type SmartOpenConditions, useAccordionSections } from '@/hooks/useAccordionSections';
import { usePresentationMode } from '@/hooks/usePresentationMode';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useAppStore } from '@/store/useAppStore';
import { useConversationStore } from '@/store/useConversationStore';
import { AppView } from '@/types';

import { Api } from '../../services/api';
import {
  type Alternative,
  AlternativesSection,
  type Attachment,
  AttachmentsSection,
  type Comment,
  CommentsSection,
  DecisionReadinessBar,
  type DecisionReadinessData,
  DelegationModal,
  type EscalationRule,
  EscalationRulesSection,
  ImpactAssessmentCompact,
  type ImpactValues,
  type LinkedItem,
  LinkedItemsSection,
  PresentationModeSwitcher,
  type ReminderRule,
  RiskAssessmentCompact,
  type RiskItem,
  type Stakeholder,
  type StakeholderNotificationSettings,
  type StakeholderRole,
  StakeholdersSection,
  type WarningThresholds,
} from './shared';

// ── Decision accordion section IDs ──────────────────────────────────────────
const DECISION_SECTION_IDS = [
  'description',
  'alternatives',
  'risk',
  'consequencesOfInaction',
  'comments',
  'activityLog',
  'control',
  'stakeholders',
  'escalation',
  'tags',
  'attachments',
  'linkedItems',
] as const;

// Default open sections per doc 1.1.1.3
const DECISION_DEFAULT_OPEN = [
  'description', // Problem description / context
  'alternatives', // Options (short form)
  'consequencesOfInaction', // Recommendation + Consequences of Inaction
  'control', // Right column control + primary CTA
];

// Smart-open rules per doc 1.1.1.3
const DECISION_SMART_OPEN_RULES: Record<string, (c: SmartOpenConditions) => boolean> = {
  stakeholders: (c) =>
    c.status === 'pending' ||
    c.status === 'escalated' ||
    c.status === 'deferred' ||
    (c.escalationLevel ?? 0) > 0,
  escalation: (c) =>
    c.status === 'pending' || c.status === 'escalated' || (c.escalationLevel ?? 0) > 0,
  linkedItems: (c) => !!c.hasBlockingRelations,
  risk: (c) => !!c.isHighImpact,
};

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

// ── DEMO DATA (populate N/C views for testing) ────────────────────────────────
const DEMO_ALTERNATIVES: Alternative[] = [
  {
    id: 'alt-1',
    title: 'Automated DRD report generation pipeline',
    description:
      'Build a fully automated pipeline using AI models that generates DRD reports from raw interview data. Includes template engine, quality validation and multi-format export (PDF, DOCX, PPTX).',
    pros: [
      'Eliminates 90% of manual report writing',
      'Consistent quality across all reports',
      'Scalable for 100+ concurrent projects',
    ],
    cons: [
      'High upfront development cost (~3 sprints)',
      'Requires AI model fine-tuning',
      'May need human review for edge cases',
    ],
    estimatedCost: 45000,
    estimatedDuration: '6 weeks',
    isRecommended: true,
    riskLevel: 'medium',
    confidence: 'high',
    impactScore: { scope: 'high', schedule: 'medium', cost: 'medium', quality: 'high' },
  },
  {
    id: 'alt-2',
    title: 'Semi-automated with human-in-the-loop',
    description:
      'AI generates draft sections, a consultant reviews and edits before final assembly. Hybrid approach that balances speed with quality assurance.',
    pros: [
      'Lower risk — human validation at every step',
      'Faster to implement (~1.5 sprints)',
      'Maintains consulting expertise in outputs',
    ],
    cons: [
      'Still requires 30-40% manual effort',
      'Bottleneck on available reviewers',
      'Inconsistent turnaround times',
    ],
    estimatedCost: 20000,
    estimatedDuration: '3 weeks',
    isRecommended: false,
    riskLevel: 'low',
    confidence: 'high',
    impactScore: { scope: 'medium', schedule: 'low', cost: 'low', quality: 'high' },
  },
  {
    id: 'alt-3',
    title: 'Template-based manual generation',
    description:
      'Provide structured templates with pre-filled sections from interview data. Consultants fill remaining gaps manually. Minimal AI involvement.',
    pros: ['Lowest implementation effort', 'Full control over content', 'No AI dependency'],
    cons: [
      'No significant time savings',
      'Cannot scale beyond current team capacity',
      'Quality varies by consultant',
    ],
    estimatedCost: 5000,
    estimatedDuration: '1 week',
    isRecommended: false,
    riskLevel: 'low',
    confidence: 'medium',
    impactScore: { scope: 'low', schedule: 'low', cost: 'low', quality: 'medium' },
  },
];

const DEMO_RISKS: RiskItem[] = [
  {
    id: 'risk-1',
    title: 'AI hallucination in generated report content',
    probability: 'medium',
    impact: 'high',
    category: 'technical',
    mitigation:
      'Implement factual grounding against interview transcripts. Add confidence scoring per section with mandatory human review below 85% threshold.',
    contingency: 'Fallback to semi-automated mode. Flag sections for manual rewrite.',
  },
  {
    id: 'risk-2',
    title: 'Client data privacy breach during AI processing',
    probability: 'low',
    impact: 'critical',
    category: 'legal',
    mitigation:
      'All processing on-premise or in EU data centers. PII anonymization before AI inference. SOC 2 compliance audit.',
    contingency: 'Immediate incident response. Client notification within 24h per GDPR.',
  },
  {
    id: 'risk-3',
    title: 'Template rigidity limiting report customization',
    probability: 'high',
    impact: 'medium',
    category: 'business',
    mitigation:
      'Design modular template system with customizable sections. Allow per-client overrides via configuration.',
    contingency: 'Engage client for manual customization requests. Track as backlog items.',
  },
  {
    id: 'risk-4',
    title: 'Team resistance to AI-generated outputs',
    probability: 'medium',
    impact: 'medium',
    category: 'operational',
    mitigation:
      'Early stakeholder engagement. Pilot with 2-3 willing consultants. Show before/after quality comparison.',
    contingency: 'Maintain parallel manual process during transition period.',
  },
];

const DEMO_STAKEHOLDERS: Stakeholder[] = [
  {
    id: 'stk-1',
    decisionId: '',
    userId: 'piotr-dbr77',
    userName: 'Piotr Wisniewski',
    userEmail: 'piotr@dbr77.com',
    role: 'accountable' as StakeholderRole,
    notificationSettings: {
      enabled: true,
      triggers: ['on_status_change', 'on_deadline_approaching'],
      emailEnabled: true,
      inAppEnabled: true,
    },
  },
  {
    id: 'stk-2',
    decisionId: '',
    userId: 'anna-dbr77',
    userName: 'Anna Kowalska',
    userEmail: 'anna@dbr77.com',
    role: 'responsible' as StakeholderRole,
    notificationSettings: {
      enabled: true,
      triggers: ['on_update', 'on_comment'],
      emailEnabled: false,
      inAppEnabled: true,
    },
  },
  {
    id: 'stk-3',
    decisionId: '',
    userId: 'marek-dbr77',
    userName: 'Marek Nowak',
    userEmail: 'marek@dbr77.com',
    role: 'consulted' as StakeholderRole,
    notificationSettings: {
      enabled: true,
      triggers: ['on_decision_made'],
      emailEnabled: true,
      inAppEnabled: true,
    },
  },
  {
    id: 'stk-4',
    decisionId: '',
    userId: 'karolina-dbr77',
    userName: 'Karolina Zielińska',
    userEmail: 'karolina@dbr77.com',
    role: 'informed' as StakeholderRole,
    notificationSettings: {
      enabled: true,
      triggers: ['on_decision_made'],
      emailEnabled: false,
      inAppEnabled: true,
    },
  },
];

const DEMO_COMMENTS: Comment[] = [
  {
    id: 'cmt-1',
    content:
      'I reviewed the automated pipeline option. The ROI projection looks strong — estimated 60% time saving per report cycle. However, we need to validate against ADMA assessment data quality first.',
    authorId: 'anna-dbr77',
    authorName: 'Anna Kowalska',
    createdAt: '2026-02-09T14:30:00Z',
    likes: 3,
    likedByMe: true,
  },
  {
    id: 'cmt-2',
    content:
      'Agreed on validation. I suggest a 2-week pilot with the Cloud Migration project data — it has the most complete interview dataset. We can measure accuracy against manually created reports.',
    authorId: 'marek-dbr77',
    authorName: 'Marek Nowak',
    createdAt: '2026-02-09T16:15:00Z',
    likes: 1,
  },
  {
    id: 'cmt-3',
    content:
      'AI analysis: Based on historical project data, the automated pipeline (Option A) shows optimal cost-to-value ratio. Recommended confidence: 87%. Key risk factor: data quality variance across different interview formats.',
    authorId: 'ai-assistant',
    authorName: 'AI Consultant',
    createdAt: '2026-02-10T09:00:00Z',
    likes: 5,
    isAIGenerated: true,
  },
  {
    id: 'cmt-4',
    content:
      'Legal cleared the data processing approach for Option A. All client data stays within EU infrastructure. We need to update the DPA for 3 existing clients.',
    authorId: 'karolina-dbr77',
    authorName: 'Karolina Zielińska',
    createdAt: '2026-02-10T11:45:00Z',
    likes: 2,
  },
];

const DEMO_ATTACHMENTS: Attachment[] = [
  {
    id: 'att-1',
    name: 'DRD_Report_Pipeline_Architecture.pdf',
    type: 'application/pdf',
    size: 2457600,
    url: '/attachments/att-1',
    uploadedAt: '2026-02-08T10:00:00Z',
    uploadedBy: 'Anna Kowalska',
  },
  {
    id: 'att-2',
    name: 'ROI_Analysis_Report_Generation.xlsx',
    type: 'application/vnd.ms-excel',
    size: 847200,
    url: '/attachments/att-2',
    uploadedAt: '2026-02-09T14:00:00Z',
    uploadedBy: 'Marek Nowak',
  },
  {
    id: 'att-3',
    name: 'AI_Model_Benchmark_Results.png',
    type: 'image/png',
    size: 1253400,
    url: '/attachments/att-3',
    thumbnailUrl: '/attachments/att-3/thumb',
    uploadedAt: '2026-02-10T08:30:00Z',
    uploadedBy: 'Piotr Wisniewski',
  },
];

const DEMO_LINKED_ITEMS: LinkedItem[] = [
  {
    id: 'link-1',
    type: 'initiative',
    title: 'Digital Transformation 2026',
    status: 'In Progress',
    priority: 'high',
  },
  {
    id: 'link-2',
    type: 'task',
    title: 'Evaluate AI model providers for report generation',
    status: 'Completed',
    priority: 'high',
  },
  {
    id: 'link-3',
    type: 'task',
    title: 'Design report template engine architecture',
    status: 'In Progress',
    priority: 'medium',
  },
  {
    id: 'link-4',
    type: 'decision',
    title: 'Select cloud infrastructure for AI workloads',
    status: 'Approved',
    priority: 'high',
  },
  {
    id: 'link-5',
    type: 'risk',
    title: 'AI processing latency exceeding SLA targets',
    status: 'Monitored',
    priority: 'medium',
  },
];

const DEMO_REMINDERS: ReminderRule[] = [
  {
    id: 'rem-1',
    type: 'before_due',
    days: 3,
    recipients: 'both',
    inAppNotification: true,
    emailNotification: true,
    message: 'Decision deadline approaching — 3 days remaining',
    enabled: true,
  },
  {
    id: 'rem-2',
    type: 'after_due',
    days: 1,
    recipients: 'stakeholders',
    inAppNotification: true,
    emailNotification: false,
    message: 'Decision is overdue — escalation may follow',
    enabled: true,
  },
];

const DEMO_ESCALATION: EscalationRule = {
  id: 'esc-1',
  enabled: true,
  escalateTo: 'piotr-dbr77',
  escalateToName: 'Piotr Wisniewski',
  afterDays: 5,
  message: 'This decision has been escalated due to inactivity.',
};
// ── END DEMO DATA ─────────────────────────────────────────────────────────────

export const DecisionDetailView: React.FC<DecisionDetailViewProps> = ({
  decisionId,
  onClose,
  onSaved,
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
  const [isGeneratingAIComment, setIsGeneratingAIComment] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);

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

  // Tags
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');

  // Activity Log
  interface ActivityLogEntry {
    id: string;
    type:
      | 'status_change'
      | 'assignment'
      | 'comment'
      | 'edit'
      | 'deadline'
      | 'priority'
      | 'created'
      | 'approved'
      | 'rejected'
      | 'escalated'
      | 'deferred';
    description: string;
    timestamp: string;
    userId?: string;
    userName?: string;
    oldValue?: string;
    newValue?: string;
  }
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([
    {
      id: '1',
      type: 'created',
      description: isPolish ? 'Decyzja utworzona' : 'Decision created',
      timestamp: new Date().toISOString(),
      userName: 'System',
    },
  ]);

  // Stakeholders & Delegation
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [showDelegationModal, setShowDelegationModal] = useState(false);

  // ── Presentation Mode (Accordion / Notion / ClickUp) ──────────────────────
  const { mode: presentationMode, setMode: setPresentationMode } = usePresentationMode({
    entityType: 'decision',
    syncURL: true,
  });
  const reducedMotion = useReducedMotion();

  // Motion helpers: respect prefers-reduced-motion (DBR77 §9.2)
  const motionDuration = reducedMotion ? 0 : 0.18; // 180ms base
  const sectionMotionProps = reducedMotion
    ? {}
    : { initial: { height: 0 }, animate: { height: 'auto' as const }, exit: { height: 0 } };

  // UI State
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [activeNotionSection, setActiveNotionSection] = useState('context-problem');
  const [clickupTab, setClickupTab] = useState<
    'overview' | 'resources' | 'risk' | 'options' | 'governance' | 'comments' | 'logs'
  >('overview');
  const [isLocalHydrated, setIsLocalHydrated] = useState(false);

  const notionSections = useMemo(
    () => [
      {
        id: 'context-problem',
        label: isPolish ? 'Kontekst i problem' : 'Context & Problem',
        icon: FileText,
      },
      {
        id: 'options-tradeoffs',
        label: isPolish ? 'Opcje i trade-offy' : 'Options & Trade-offs',
        icon: Lightbulb,
      },
      {
        id: 'risk-impact',
        label: isPolish ? 'Ryzyko i wpływ' : 'Risk & Impact',
        icon: AlertTriangle,
      },
      {
        id: 'governance-escalation',
        label: isPolish ? 'RACI i reguły eskalacji' : 'RACI & Escalation Rules',
        icon: Users,
      },
      {
        id: 'comments',
        label: isPolish ? 'Komentarze' : 'Comments',
        icon: MessageSquare,
      },
      {
        id: 'resources-links',
        label: isPolish ? 'Załączniki i powiązania' : 'Attachments & Links',
        icon: FolderOpen,
      },
      {
        id: 'activity-log',
        label: isPolish ? 'Logi aktywności' : 'Activity Log',
        icon: History,
      },
    ],
    [isPolish]
  );

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (presentationMode !== 'n') return;

    const onScroll = () => {
      let bestId = notionSections[0]?.id ?? 'context-problem';
      let bestDistance = Number.POSITIVE_INFINITY;

      for (const section of notionSections) {
        const el = document.getElementById(section.id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const distance = Math.abs(rect.top - 150);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestId = section.id;
        }
      }

      setActiveNotionSection(bestId);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [notionSections, presentationMode]);

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

  // ── Smart-open conditions for accordion (doc 1.1.1.3) ───────────────────
  const smartOpenConditions = useMemo<SmartOpenConditions>(
    () => ({
      status,
      escalationLevel: escalation ? 1 : 0,
      hasBlockingRelations: linkedItems.some(
        (li) => li.relationshipType === 'blocks' || li.relationshipType === 'blocked_by'
      ),
      isHighImpact: priority === 'high' || priority === 'critical',
    }),
    [status, escalation, linkedItems, priority]
  );

  const { expandedSections, toggleSection, expandAll, collapseAll, isExpanded } =
    useAccordionSections({
      entityType: 'decision',
      entityId: decisionId,
      defaultOpenSections: DECISION_DEFAULT_OPEN,
      smartOpenRules: DECISION_SMART_OPEN_RULES,
      smartOpenConditions,
      allSectionIds: [...DECISION_SECTION_IDS],
    });

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

  useEffect(() => {
    if (decisionId) {
      loadDecision(decisionId);
    } else {
      resetForm();
    }
  }, [decisionId]);

  const resetForm = () => {
    setIsLocalHydrated(false);
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
    setRisks([]);
    setReminders([]);
    setEscalation(null);
    setActivityLog([
      {
        id: '1',
        type: 'created',
        description: isPolish ? 'Decyzja utworzona' : 'Decision created',
        timestamp: new Date().toISOString(),
        userName: 'System',
      },
    ]);
    setIsLocalHydrated(true);
  };

  const loadDecision = async (id: string) => {
    try {
      setLoading(true);
      setIsLocalHydrated(false);
      const decision = await Api.getDecision(id);
      setTitle(decision.title || '');
      setDescription(decision.description || '');
      setStatus(decision.status?.toLowerCase() || 'pending');
      setPriority(normalizePriority(decision.priority));
      setCategory(decision.category || 'technical');
      setDueDate(decision.dueDate ? decision.dueDate.split('T')[0] : '');
      setRationale(
        decision.rationale ||
          'Delayed decision on report generation approach will block 4 active client projects from receiving their DRD reports on time. Each week of delay increases manual effort costs by ~€8,000 and risks client satisfaction scores dropping below SLA thresholds. Two enterprise clients have contractual deadlines in March 2026.'
      );
      setRequesterName(decision.requestedByName || '');
      setDeciderId(decision.deciderId || '');
      setProjectName(decision.projectName || '');
      setDecisionDate(decision.decisionDate || '');
      setCreatedAt(decision.createdAt || '');
      setUpdatedAt(decision.updatedAt || '');
      // Use API data or fallback to demo data for rich UI testing
      const apiAlternatives = decision.alternatives || [];
      setAlternatives(apiAlternatives.length > 0 ? apiAlternatives : DEMO_ALTERNATIVES);
      setSelectedAlternativeId(decision.selectedAlternativeId || '');
      if (decision.impact) {
        setImpact(decision.impact);
      }
      const apiAttachments = decision.attachments || [];
      setAttachments(apiAttachments.length > 0 ? apiAttachments : DEMO_ATTACHMENTS);
      const apiComments = decision.comments || [];
      setComments(apiComments.length > 0 ? apiComments : DEMO_COMMENTS);
      const apiLinkedItems = decision.linkedItems || [];
      setLinkedItems(apiLinkedItems.length > 0 ? apiLinkedItems : DEMO_LINKED_ITEMS);

      // Risks — demo fallback
      const apiRisks = decision.risks || [];
      setRisks(apiRisks.length > 0 ? apiRisks : DEMO_RISKS);

      // Reminders & escalation — demo fallback
      const apiReminders = decision.reminders || [];
      setReminders(apiReminders.length > 0 ? apiReminders : DEMO_REMINDERS);
      setEscalation(decision.escalation || DEMO_ESCALATION);

      // Load stakeholders
      try {
        const stakeholdersResponse = await Api.get(`/decisions/${id}/stakeholders`);
        const apiStakeholders = stakeholdersResponse?.stakeholders || [];
        setStakeholders(
          apiStakeholders.length > 0
            ? apiStakeholders
            : DEMO_STAKEHOLDERS.map((s) => ({ ...s, decisionId: id }))
        );
      } catch {
        // Stakeholders endpoint may not exist yet — use demo data
        setStakeholders(DEMO_STAKEHOLDERS.map((s) => ({ ...s, decisionId: id })));
      }

      // Load decision history from real API
      try {
        const historyRows = await Api.getDecisionHistory(id);
        if (historyRows.length > 0) {
          const mapped: ActivityLogEntry[] = historyRows.map((h: any) => {
            const action = String(h.action || h.type || '').toLowerCase();
            const mapType = (): ActivityLogEntry['type'] => {
              if (action.includes('approve')) return 'approved';
              if (action.includes('reject')) return 'rejected';
              if (action.includes('escalat')) return 'escalated';
              if (action.includes('defer')) return 'deferred';
              if (action.includes('assign') || action.includes('delegat')) return 'assignment';
              if (action.includes('comment')) return 'comment';
              if (action.includes('deadline')) return 'deadline';
              if (action.includes('priority')) return 'priority';
              if (action.includes('status')) return 'status_change';
              return 'edit';
            };
            return {
              id: String(h.id || Math.random().toString(36).substr(2, 9)),
              type: mapType(),
              description: String(h.description || h.action || 'Decision updated'),
              timestamp: String(
                h.changedAt ||
                  h.changed_at ||
                  h.createdAt ||
                  h.created_at ||
                  new Date().toISOString()
              ),
              userName: h.userName || h.changedByName || h.changed_by_name || undefined,
              oldValue: h.oldValue || h.old_value || undefined,
              newValue: h.newValue || h.new_value || undefined,
            };
          });
          setActivityLog(mapped);
        }
      } catch {
        // history endpoint optional
      }

      // Hydrate local enhancements (for fields without backend persistence yet)
      try {
        const raw = localStorage.getItem(`consultinity-decision-enhancements:${id}`);
        if (raw) {
          const local = JSON.parse(raw);
          if (Array.isArray(local.comments) && local.comments.length > 0)
            setComments(local.comments);
          if (Array.isArray(local.attachments) && local.attachments.length > 0)
            setAttachments(local.attachments);
          if (Array.isArray(local.linkedItems) && local.linkedItems.length > 0)
            setLinkedItems(local.linkedItems);
          if (Array.isArray(local.risks) && local.risks.length > 0) setRisks(local.risks);
          if (Array.isArray(local.alternatives) && local.alternatives.length > 0)
            setAlternatives(local.alternatives);
          if (Array.isArray(local.reminders) && local.reminders.length > 0)
            setReminders(local.reminders);
          if (local.escalation) setEscalation(local.escalation);
          if (typeof local.rationale === 'string' && local.rationale.trim())
            setRationale(local.rationale);
          if (typeof local.description === 'string' && local.description.trim())
            setDescription(local.description);
        }
      } catch {
        // ignore broken local cache
      }
    } catch (error) {
      console.error('Failed to load decision', error);
      toast.error(isPolish ? 'Nie udało się załadować decyzji' : 'Failed to load decision');
    } finally {
      setLoading(false);
      setIsLocalHydrated(true);
    }
  };

  // Persist local enhancements for parts that do not have backend endpoints yet
  useEffect(() => {
    if (!isLocalHydrated || !decisionId) return;
    try {
      localStorage.setItem(
        `consultinity-decision-enhancements:${decisionId}`,
        JSON.stringify({
          schemaVersion: 1,
          savedAt: new Date().toISOString(),
          comments,
          attachments,
          linkedItems,
          risks,
          alternatives,
          reminders,
          escalation,
          rationale,
          description,
        })
      );
    } catch {
      // ignore quota / storage errors
    }
  }, [
    isLocalHydrated,
    decisionId,
    comments,
    attachments,
    linkedItems,
    risks,
    alternatives,
    reminders,
    escalation,
    rationale,
    description,
  ]);

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

  const handleOpenChat = async () => {
    // Persist local draft so user never loses input
    const draftKey = `consultinity-decision-draft:${decisionId || 'new'}`;
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          schemaVersion: 1,
          source: 'chat',
          savedAt: new Date().toISOString(),
          decisionId: decisionId || null,
          draft: {
            title,
            description,
            status,
            priority,
            category,
            dueDate: dueDate || null,
            rationale,
            deciderId: deciderId || null,
            alternatives,
            selectedAlternativeId,
            impact,
            comments,
            attachments,
            linkedItems,
            stakeholders,
            reminders,
            escalation,
            thresholds,
            tags,
          },
        })
      );
    } catch (e) {
      console.warn('[DecisionDetailView] Failed to persist local draft (chat)', e);
    }

    // Ensure chat panel is visible
    if (isChatCollapsed) {
      toggleChatCollapse();
    }

    // Push rich decision context into the unified chat workspace context
    updateWorkspaceFromView(AppView.MY_WORK, decisionId || 'new', {
      type: 'decision',
      id: decisionId || null,
      title,
      description,
      status,
      priority,
      category,
      dueDate: dueDate || null,
      rationale,
      deciderId: deciderId || null,
      alternativesCount: alternatives.length,
      selectedAlternativeId,
      commentsCount: comments.length,
      attachmentsCount: attachments.length,
    });
  };

  const handleApprove = async () => {
    if (!decisionId) return;
    try {
      await Api.updateDecision(decisionId, { status: 'APPROVED' });
      const oldStatus = status;
      setStatus('approved');
      setDecisionDate(new Date().toISOString());
      addActivityLogEntry(
        'approved',
        isPolish ? 'Decyzja zatwierdzona' : 'Decision approved',
        isPolish ? 'Oczekująca' : 'Pending',
        isPolish ? 'Zatwierdzona' : 'Approved'
      );
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
      const oldStatus = status;
      setStatus('rejected');
      setDecisionDate(new Date().toISOString());
      addActivityLogEntry(
        'rejected',
        isPolish ? 'Decyzja odrzucona' : 'Decision rejected',
        isPolish ? 'Oczekująca' : 'Pending',
        isPolish ? 'Odrzucona' : 'Rejected'
      );
      toast.success(isPolish ? 'Decyzja odrzucona' : 'Decision rejected');
      onSaved?.({ title, status: 'rejected' });
    } catch (error) {
      toast.error(isPolish ? 'Nie udało się odrzucić' : 'Failed to reject');
    }
  };

  const handleDefer = async () => {
    if (!decisionId) return;
    try {
      await Api.updateDecision(decisionId, { status: 'DEFERRED' });
      setStatus('deferred');
      addActivityLogEntry(
        'deferred',
        isPolish ? 'Decyzja odroczona' : 'Decision deferred',
        isPolish ? 'Oczekująca' : 'Pending',
        isPolish ? 'Odroczona' : 'Deferred'
      );
      toast.success(isPolish ? 'Decyzja odroczona' : 'Decision deferred');
      onSaved?.({ title, status: 'deferred' });
    } catch (error) {
      toast.error(isPolish ? 'Nie udało się odroczyć' : 'Failed to defer');
    }
  };

  const handleEscalate = async () => {
    if (!decisionId) return;
    try {
      await Api.updateDecision(decisionId, { status: 'ESCALATED' });
      setStatus('escalated');
      addActivityLogEntry(
        'escalated',
        isPolish ? 'Decyzja eskalowana' : 'Decision escalated',
        isPolish ? 'Oczekująca' : 'Pending',
        isPolish ? 'Eskalowana' : 'Escalated'
      );
      toast.success(isPolish ? 'Decyzja eskalowana' : 'Decision escalated');
      onSaved?.({ title, status: 'escalated' });
    } catch (error) {
      toast.error(isPolish ? 'Nie udało się eskalować' : 'Failed to escalate');
    }
  };

  const handleRequestMoreInfo = async () => {
    if (!decisionId) return;
    try {
      // Add a comment requesting more information
      const requestComment = isPolish
        ? 'Proszę o dostarczenie dodatkowych informacji przed podjęciem decyzji.'
        : 'Please provide additional information before a decision can be made.';

      await handleAddComment(requestComment, undefined, { force: true });

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
    if (status === 'pending' || status === 'escalated' || status === 'deferred') {
      toast.error(
        isPolish
          ? 'W etapie podejmowania decyzji treść jest zablokowana'
          : 'Content is locked during decision-making stage'
      );
      return;
    }
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
    if (status === 'pending' || status === 'escalated' || status === 'deferred') return;
    setAlternatives(alternatives.map((a) => (a.id === id ? { ...a, ...updates } : a)));
  };

  const removeAlternative = (id: string) => {
    if (status === 'pending' || status === 'escalated' || status === 'deferred') return;
    setAlternatives(alternatives.filter((a) => a.id !== id));
    if (selectedAlternativeId === id) {
      setSelectedAlternativeId('');
    }
  };

  const setRecommendedAlternative = (id: string) => {
    if (status === 'pending' || status === 'escalated' || status === 'deferred') return;
    setAlternatives(
      alternatives.map((a) => ({
        ...a,
        isRecommended: a.id === id,
      }))
    );
  };

  // Risk handlers
  const addRisk = () => {
    if (status === 'pending' || status === 'escalated' || status === 'deferred') {
      toast.error(
        isPolish
          ? 'W etapie podejmowania decyzji treść jest zablokowana'
          : 'Content is locked during decision-making stage'
      );
      return;
    }
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
    if (status === 'pending' || status === 'escalated' || status === 'deferred') return;
    setRisks(risks.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };

  const removeRisk = (id: string) => {
    if (status === 'pending' || status === 'escalated' || status === 'deferred') return;
    setRisks(risks.filter((r) => r.id !== id));
  };

  // AI Generation handlers
  const generateAlternativesAI = async () => {
    if (status === 'pending' || status === 'escalated' || status === 'deferred') {
      toast.error(
        isPolish
          ? 'AI generowanie jest dostępne tylko przed etapem decyzji'
          : 'AI generation is available only before decision stage'
      );
      return;
    }
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

  const generateDescriptionAI = async () => {
    if (status === 'pending' || status === 'escalated' || status === 'deferred') {
      toast.error(
        isPolish
          ? 'AI generowanie jest dostępne tylko przed etapem decyzji'
          : 'AI generation is available only before decision stage'
      );
      return;
    }
    setIsGeneratingDescription(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const generatedDescription = isPolish
        ? `## Kontekst decyzji\n\nDecyzja dotyczy wyboru optymalnego rozwiązania dla ${title || 'bieżącego problemu'}.\n\n### Tło\nW ramach analizy zidentyfikowano następujące kluczowe czynniki:\n- Wymagania biznesowe i techniczne\n- Ograniczenia budżetowe i czasowe\n- Wpływ na obecne procesy\n\n### Zakres\nDecyzja obejmuje:\n1. Wybór dostawcy/technologii\n2. Określenie harmonogramu wdrożenia\n3. Alokację zasobów\n\n### Oczekiwane rezultaty\n- Poprawa efektywności procesów\n- Redukcja kosztów operacyjnych\n- Zwiększenie konkurencyjności`
        : `## Decision Context\n\nThis decision concerns selecting the optimal solution for ${title || 'the current issue'}.\n\n### Background\nThe analysis has identified the following key factors:\n- Business and technical requirements\n- Budget and timeline constraints\n- Impact on existing processes\n\n### Scope\nThe decision covers:\n1. Vendor/technology selection\n2. Implementation timeline definition\n3. Resource allocation\n\n### Expected Outcomes\n- Process efficiency improvement\n- Operational cost reduction\n- Increased competitiveness`;

      setDescription(generatedDescription);
      toast.success(isPolish ? 'Opis wygenerowany przez AI' : 'Description generated by AI');
    } catch {
      toast.error(isPolish ? 'Błąd generowania opisu' : 'Error generating description');
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  const generateAIComment = async () => {
    if (status === 'pending' || status === 'escalated' || status === 'deferred') {
      toast.error(
        isPolish
          ? 'AI generowanie jest dostępne tylko przed etapem decyzji'
          : 'AI generation is available only before decision stage'
      );
      return;
    }
    setIsGeneratingAIComment(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const aiComments = [
        isPolish
          ? `Na podstawie analizy tej decyzji, warto rozważyć następujące aspekty:\n\n1. **Wpływ na interesariuszy**: ${stakeholders.length > 0 ? `Zidentyfikowano ${stakeholders.length} interesariuszy` : 'Brak zdefiniowanych interesariuszy'}\n2. **Ocena ryzyka**: ${risks.length > 0 ? `${risks.length} ryzyk do monitorowania` : 'Brak zidentyfikowanych ryzyk'}\n3. **Alternatywy**: ${alternatives.length > 0 ? `${alternatives.length} opcji do rozważenia` : 'Brak alternatyw'}\n\nRekomendacja: Przed podjęciem decyzji upewnij się, że wszystkie kluczowe aspekty zostały przeanalizowane.`
          : `Based on the analysis of this decision, consider the following aspects:\n\n1. **Stakeholder impact**: ${stakeholders.length > 0 ? `${stakeholders.length} stakeholders identified` : 'No stakeholders defined'}\n2. **Risk assessment**: ${risks.length > 0 ? `${risks.length} risks to monitor` : 'No risks identified'}\n3. **Alternatives**: ${alternatives.length > 0 ? `${alternatives.length} options to consider` : 'No alternatives'}\n\nRecommendation: Before making the decision, ensure all key aspects have been analyzed.`,
      ];

      const newComment: Comment = {
        id: Math.random().toString(36).substr(2, 9),
        content: aiComments[0],
        authorId: 'ai-assistant',
        authorName: 'AI Assistant',
        createdAt: new Date().toISOString(),
        likes: 0,
        isAIGenerated: true,
      };

      setComments([...comments, newComment]);
      toast.success(isPolish ? 'Komentarz AI wygenerowany' : 'AI comment generated');
    } catch {
      toast.error(isPolish ? 'Błąd generowania komentarza' : 'Error generating comment');
    } finally {
      setIsGeneratingAIComment(false);
    }
  };

  const generateConsequencesOfInactionAI = () => {
    if (status === 'pending' || status === 'escalated' || status === 'deferred') {
      toast.error(
        isPolish
          ? 'AI generowanie jest dostępne tylko przed etapem decyzji'
          : 'AI generation is available only before decision stage'
      );
      return;
    }
    const generated = isPolish
      ? `Jeśli decyzja "${title || 'ta decyzja'}" nie zostanie podjęta, najbardziej prawdopodobne konsekwencje to:
- narastająca niepewność operacyjna i opóźnienie wykonawcze,
- zwiększone koszty (czas, zasoby, ryzyko reworku),
- ryzyko eskalacji i utraty momentum biznesowego.

Rekomendacja: wyznaczyć decydenta, termin i minimalny zakres decyzji do zatwierdzenia.`
      : `If "${title || 'this decision'}" is not made in time, likely consequences are:
- growing operational uncertainty and delivery delays,
- increased cost (time, resources, rework risk),
- escalation risk and loss of business momentum.

Recommendation: assign a decider, deadline, and minimum decision scope to approve.`;

    setRationale(generated);
    toast.success(
      isPolish ? 'Wygenerowano konsekwencje braku decyzji' : 'Consequences of inaction generated'
    );
  };

  const generateRisksAI = async () => {
    if (status === 'pending' || status === 'escalated' || status === 'deferred') {
      toast.error(
        isPolish
          ? 'AI generowanie jest dostępne tylko przed etapem decyzji'
          : 'AI generation is available only before decision stage'
      );
      return;
    }
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

  // Calculate overdue status
  const isOverdue = useMemo(() => {
    if (!dueDate || status !== 'pending') return false;
    return new Date(dueDate) < new Date();
  }, [dueDate, status]);

  // Show action buttons for any status that requires action (not just 'pending')
  const isPending = status === 'pending' || status === 'escalated' || status === 'deferred';
  const isDecisionStageLocked = isPending;
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
  const decisionScopeLabel =
    projectName ||
    initiativeName ||
    (isPolish ? CATEGORY_CONFIG[category]?.label?.pl : CATEGORY_CONFIG[category]?.label?.en) ||
    '—';
  const decisionIndexLabel =
    decisionId || `draft-${title.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 20) || 'new'}`;

  // Attachment handlers (mock)
  const handleUploadAttachments = async (files: FileList) => {
    if (status === 'pending' || status === 'escalated' || status === 'deferred') {
      toast.error(
        isPolish
          ? 'W etapie podejmowania decyzji treść jest zablokowana'
          : 'Content is locked during decision-making stage'
      );
      return;
    }
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
    if (status === 'pending' || status === 'escalated' || status === 'deferred') return;
    setAttachments(attachments.filter((a) => a.id !== id));
  };

  // Comment handlers (mock)
  const handleAddComment = async (
    content: string,
    parentId?: string,
    options?: { force?: boolean }
  ) => {
    if (
      !options?.force &&
      (status === 'pending' || status === 'escalated' || status === 'deferred')
    ) {
      toast.error(
        isPolish
          ? 'W etapie podejmowania decyzji treść jest zablokowana'
          : 'Content is locked during decision-making stage'
      );
      return;
    }
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
    addActivityLogEntry('comment', isPolish ? 'Dodano komentarz' : 'Comment added');
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
    if (status === 'pending' || status === 'escalated' || status === 'deferred') return;
    setLinkedItems([...linkedItems, item]);
  };

  const handleRemoveLinkedItem = async (id: string) => {
    if (status === 'pending' || status === 'escalated' || status === 'deferred') return;
    setLinkedItems(linkedItems.filter((i) => i.id !== id));
  };

  const searchLinkedItems = async (query: string) => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    try {
      const [tasksRes, initiativesRes, decisionsRes] = await Promise.allSettled([
        Api.get('/tasks?limit=50'),
        Api.get('/initiatives'),
        Api.getDecisions(),
      ]);

      const tasks =
        tasksRes.status === 'fulfilled'
          ? Array.isArray(tasksRes.value)
            ? tasksRes.value
            : tasksRes.value?.tasks || []
          : [];
      const initiatives =
        initiativesRes.status === 'fulfilled'
          ? Array.isArray(initiativesRes.value)
            ? initiativesRes.value
            : initiativesRes.value?.initiatives || []
          : [];
      const decisions = decisionsRes.status === 'fulfilled' ? decisionsRes.value || [] : [];

      const mappedTasks: LinkedItem[] = tasks
        .filter((t: any) =>
          String(t.title || '')
            .toLowerCase()
            .includes(q)
        )
        .slice(0, 10)
        .map((t: any) => ({
          id: String(t.id),
          type: 'task',
          title: String(t.title || 'Task'),
          status: t.status,
          priority: t.priority,
        }));
      const mappedInitiatives: LinkedItem[] = initiatives
        .filter((i: any) =>
          String(i.name || i.title || '')
            .toLowerCase()
            .includes(q)
        )
        .slice(0, 10)
        .map((i: any) => ({
          id: String(i.id),
          type: 'initiative',
          title: String(i.name || i.title || 'Initiative'),
          status: i.status,
          priority: i.priority,
        }));
      const mappedDecisions: LinkedItem[] = decisions
        .filter((d: any) =>
          String(d.title || '')
            .toLowerCase()
            .includes(q)
        )
        .slice(0, 10)
        .map((d: any) => ({
          id: String(d.id),
          type: 'decision',
          title: String(d.title || 'Decision'),
          status: d.status,
          priority: d.priority,
        }));

      return [...mappedTasks, ...mappedInitiatives, ...mappedDecisions].slice(0, 20);
    } catch {
      return [];
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-white dark:bg-navy-950">
        <Loader2 className="animate-spin text-primary-500" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950">
      <div className="p-6">
        <div
          className={`${presentationMode === 'c' ? 'max-w-none w-full' : 'max-w-6xl'} mx-auto grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6`}
        >
          {/* Main */}
          {/* Title Header with Save & Chat */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="col-span-full bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden"
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
                  onChange={(e) => !isDecisionStageLocked && setTitle(e.target.value)}
                  readOnly={isDecisionStageLocked}
                  className="flex-1 text-xl font-bold bg-transparent text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
                  placeholder={isPolish ? 'Tytuł decyzji...' : 'Decision title...'}
                  autoFocus={!decisionId}
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
                  title={isPolish ? 'Otwórz czat do tej decyzji' : 'Open decision chat'}
                >
                  <MessageSquare size={16} />
                  <span>{isPolish ? 'Czat' : 'Chat'}</span>
                </motion.button>

                {/* Presentation Mode Switcher — between Chat and AI (doc §5.1) */}
                <div className="w-px h-6 bg-slate-200 dark:bg-navy-700" />
                <PresentationModeSwitcher value={presentationMode} onChange={setPresentationMode} />
              </div>
            </div>
          </motion.div>
          {/* ═══════════ ACCORDION MODE (default) ═══════════════════════════ */}
          {presentationMode === 'd' && (
            <>
              <div className="space-y-5 order-2 lg:order-1">
                {/* Expand All / Collapse All (doc 1.1.1.7) */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={expandAll}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 border border-slate-200/60 dark:border-navy-700/60 transition-all"
                      title={isPolish ? 'Rozwiń wszystko' : 'Expand all'}
                    >
                      <ChevronsUpDown size={14} />
                      <span>{isPolish ? 'Rozwiń wszystko' : 'Expand all'}</span>
                    </button>
                    <button
                      onClick={collapseAll}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 border border-slate-200/60 dark:border-navy-700/60 transition-all"
                      title={isPolish ? 'Zwiń wszystko' : 'Collapse all'}
                    >
                      <ChevronsDownUp size={14} />
                      <span>{isPolish ? 'Zwiń wszystko' : 'Collapse all'}</span>
                    </button>
                  </div>
                </div>

                {/* Description - Collapsible with AI + preview */}
                <motion.div
                  initial={reducedMotion ? undefined : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: motionDuration }}
                  className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden"
                >
                  <motion.button
                    whileHover={
                      reducedMotion ? undefined : { backgroundColor: 'rgba(148, 163, 184, 0.1)' }
                    }
                    whileTap={reducedMotion ? undefined : { scale: 0.98 }}
                    onClick={() => toggleSection('description')}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 dark:from-purple-500/20 dark:to-pink-500/20">
                        <FileText size={18} className="text-purple-500 dark:text-purple-400" />
                      </div>
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {isPolish ? 'Opis problemu / kontekst' : 'Problem description / context'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* AI Button - visible only when expanded */}
                      <AnimatePresence>
                        {isExpanded('description') && (
                          <motion.button
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              generateDescriptionAI();
                            }}
                            disabled={isGeneratingDescription}
                            className="p-1.5 rounded-lg bg-gradient-to-r from-purple-500/10 to-pink-500/10 hover:from-purple-500/20 hover:to-pink-500/20 text-purple-500 dark:text-purple-400 transition-all disabled:opacity-50"
                            title={isPolish ? 'Generuj opis AI' : 'Generate AI description'}
                          >
                            {isGeneratingDescription ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Sparkles size={14} />
                            )}
                          </motion.button>
                        )}
                      </AnimatePresence>
                      {description && (
                        <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                          {description.length > 0 ? `${description.length}` : ''}
                        </span>
                      )}
                      <motion.div
                        animate={{ rotate: isExpanded('description') ? 180 : 0 }}
                        transition={{ duration: motionDuration }}
                      >
                        <ChevronDown size={18} className="text-slate-400" />
                      </motion.div>
                    </div>
                  </motion.button>

                  {/* Preview when collapsed (doc 1.1.1.6) */}
                  {!isExpanded('description') && description && (
                    <div className="px-5 pb-3 -mt-1">
                      <p className="text-xs text-slate-400 dark:text-slate-500 line-clamp-2 leading-relaxed">
                        {description.slice(0, 200)}
                      </p>
                    </div>
                  )}

                  <AnimatePresence>
                    {isExpanded('description') && (
                      <motion.div
                        {...sectionMotionProps}
                        className="border-t border-slate-200 dark:border-navy-700 overflow-hidden"
                      >
                        <div className="p-4">
                          <textarea
                            value={description}
                            onChange={(e) =>
                              !isDecisionStageLocked && setDescription(e.target.value)
                            }
                            readOnly={isDecisionStageLocked}
                            rows={6}
                            className="w-full px-4 py-3 rounded-xl bg-gradient-to-br from-slate-50 to-white dark:from-navy-800 dark:to-navy-900 border-2 border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-purple-400 dark:focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 resize-none transition-all duration-200"
                            placeholder={
                              isPolish
                                ? 'Opisz kontekst i wymagania decyzji...'
                                : 'Describe the context and requirements...'
                            }
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* ── Consequences of Inaction (doc 1.1.1.3: callout always visible) ── */}
                <motion.div
                  initial={reducedMotion ? undefined : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12, duration: motionDuration }}
                  className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden"
                >
                  <motion.button
                    whileHover={
                      reducedMotion ? undefined : { backgroundColor: 'rgba(148, 163, 184, 0.1)' }
                    }
                    whileTap={reducedMotion ? undefined : { scale: 0.98 }}
                    onClick={() => toggleSection('consequencesOfInaction')}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/10 to-red-500/10 dark:from-amber-500/20 dark:to-red-500/20">
                        <AlertTriangle size={18} className="text-amber-500 dark:text-amber-400" />
                      </div>
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {isPolish
                          ? 'Rekomendacja + Konsekwencje braku decyzji'
                          : 'Recommendation + Consequences of Inaction'}
                      </span>
                    </div>
                    <motion.div
                      animate={{ rotate: isExpanded('consequencesOfInaction') ? 180 : 0 }}
                      transition={{ duration: motionDuration }}
                    >
                      <ChevronDown size={18} className="text-slate-400" />
                    </motion.div>
                  </motion.button>

                  {/* Always-visible callout (even when collapsed) */}
                  {!isExpanded('consequencesOfInaction') && (
                    <div className="px-5 pb-3 -mt-1">
                      <div className="px-3 py-2 rounded-lg bg-amber-50/80 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/20">
                        <p className="text-xs text-amber-700 dark:text-amber-300 line-clamp-2">
                          {rationale
                            ? rationale.slice(0, 160)
                            : isPolish
                              ? '⚠ Uzupełnij konsekwencje braku decyzji…'
                              : '⚠ Describe consequences of inaction…'}
                        </p>
                      </div>
                    </div>
                  )}

                  <AnimatePresence>
                    {isExpanded('consequencesOfInaction') && (
                      <motion.div
                        {...sectionMotionProps}
                        className="border-t border-slate-200 dark:border-navy-700 overflow-hidden"
                      >
                        <div className="p-4 space-y-3">
                          {/* Recommendation callout */}
                          <div className="p-3 rounded-xl bg-amber-50/80 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/20">
                            <label className="block text-xs font-medium text-amber-700 dark:text-amber-300 mb-2">
                              {isPolish ? 'Konsekwencje braku decyzji' : 'Consequences of Inaction'}
                            </label>
                            <textarea
                              value={rationale}
                              onChange={(e) =>
                                !isDecisionStageLocked && setRationale(e.target.value)
                              }
                              readOnly={isDecisionStageLocked}
                              rows={4}
                              className="w-full px-3 py-2 rounded-lg bg-white/80 dark:bg-navy-800/80 border border-amber-200 dark:border-amber-500/30 text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-400 dark:focus:border-amber-500 resize-none text-sm"
                              placeholder={
                                isPolish
                                  ? 'Co się stanie, jeśli decyzja nie zostanie podjęta na czas?'
                                  : 'What will happen if the decision is not made in time?'
                              }
                            />
                          </div>
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
                  expanded={isExpanded('comments')}
                  onToggleExpand={() => toggleSection('comments')}
                />

                {/* Risk Assessment */}
                <RiskAssessmentCompact
                  risks={risks}
                  onAdd={addRisk}
                  onUpdate={updateRisk}
                  onRemove={removeRisk}
                  onGenerateAI={generateRisksAI}
                  expanded={isExpanded('risk')}
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
                  expanded={isExpanded('alternatives')}
                  onToggleExpand={() => toggleSection('alternatives')}
                  isGenerating={isGeneratingAlternatives}
                />

                {/* Activity Log (default closed with preview — doc 1.1.1.3) */}
                <motion.div
                  initial={reducedMotion ? undefined : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: motionDuration }}
                  className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden"
                >
                  <motion.button
                    whileHover={
                      reducedMotion ? undefined : { backgroundColor: 'rgba(148, 163, 184, 0.1)' }
                    }
                    whileTap={reducedMotion ? undefined : { scale: 0.98 }}
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
                        animate={{ rotate: isExpanded('activityLog') ? 180 : 0 }}
                        transition={{ duration: motionDuration }}
                      >
                        <ChevronDown size={18} className="text-slate-400" />
                      </motion.div>
                    </div>
                  </motion.button>

                  {/* Preview when collapsed (doc 1.1.1.6) */}
                  {!isExpanded('activityLog') && activityLog.length > 0 && (
                    <div className="px-5 pb-3 -mt-1">
                      <p className="text-xs text-slate-400 dark:text-slate-500 line-clamp-1">
                        {activityLog[0]?.description}
                        {activityLog[0]?.userName ? ` — ${activityLog[0].userName}` : ''}
                      </p>
                    </div>
                  )}

                  <AnimatePresence>
                    {isExpanded('activityLog') && (
                      <motion.div
                        {...sectionMotionProps}
                        className="border-t border-slate-200 dark:border-navy-700 overflow-hidden"
                      >
                        <div className="p-4">
                          {activityLog.length === 0 ? (
                            <div className="text-center py-6 text-slate-400 dark:text-slate-500">
                              <History size={24} className="mx-auto mb-2 opacity-50" />
                              <p className="text-sm">{isPolish ? 'Brak wpisów' : 'No entries'}</p>
                            </div>
                          ) : (
                            <div className="relative">
                              {/* Timeline line */}
                              <div className="absolute left-3 top-3 bottom-3 w-px bg-slate-200 dark:bg-navy-700" />

                              <div className="space-y-3">
                                {activityLog.map((entry, index) => {
                                  const getIcon = () => {
                                    switch (entry.type) {
                                      case 'status_change':
                                        return <Flag size={12} />;
                                      case 'approved':
                                        return <Check size={12} />;
                                      case 'rejected':
                                        return <X size={12} />;
                                      case 'escalated':
                                        return <ArrowUp size={12} />;
                                      case 'deferred':
                                        return <Clock size={12} />;
                                      case 'assignment':
                                        return <UserCheck size={12} />;
                                      case 'comment':
                                        return <MessageSquare size={12} />;
                                      case 'edit':
                                        return <Edit3 size={12} />;
                                      case 'deadline':
                                        return <Calendar size={12} />;
                                      case 'priority':
                                        return <Flag size={12} />;
                                      case 'created':
                                        return <Plus size={12} />;
                                      default:
                                        return <History size={12} />;
                                    }
                                  };

                                  const getColor = () => {
                                    switch (entry.type) {
                                      case 'approved':
                                        return 'bg-emerald-500 text-white';
                                      case 'rejected':
                                        return 'bg-red-500 text-white';
                                      case 'escalated':
                                        return 'bg-orange-500 text-white';
                                      case 'deferred':
                                        return 'bg-slate-500 text-white';
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
                                      case 'created':
                                        return 'bg-emerald-500 text-white';
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
                                              </span>{' '}
                                              →{' '}
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

              {/* Control Sidebar (manage) - Premium Sticky — Accordion mode */}
              <div className="space-y-4 lg:sticky lg:top-6 self-start order-1 lg:order-2">
                {/* Actions Panel - Outline Style (always accessible, NOT inside collapsed section — doc §3 CTA) */}
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
                </motion.div>

                {/* Control - Premium Panel (Red when overdue) */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 }}
                  className={`backdrop-blur-xl rounded-2xl shadow-lg overflow-hidden ${
                    isOverdue
                      ? 'bg-red-500/10 dark:bg-red-500/10 border border-red-500/40 dark:border-red-400/30'
                      : 'bg-white/80 dark:bg-navy-900/80 border border-slate-200/50 dark:border-navy-700/50'
                  }`}
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
                    <div className="flex items-center gap-2">
                      {decisionId && (
                        <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 bg-slate-100/80 dark:bg-navy-800/80 px-2 py-0.5 rounded-lg">
                          #{decisionId.slice(0, 8)}
                        </span>
                      )}
                      <motion.div
                        animate={{ rotate: isExpanded('control') ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown size={18} className="text-slate-400" />
                      </motion.div>
                    </div>
                  </motion.button>

                  {/* Collapsible Content */}
                  <AnimatePresence>
                    {isExpanded('control') && (
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
                                        priority === key
                                          ? 'bg-primary-50 dark:bg-primary-500/10'
                                          : ''
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
                                          category === key
                                            ? 'bg-primary-50 dark:bg-primary-500/10'
                                            : ''
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
                    setStakeholders(
                      stakeholders.map((s) => (s.id === id ? { ...s, ...updates } : s))
                    );

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
                      Api.delete(
                        `/decisions/${decisionId}/stakeholders/${stakeholder.userId}`
                      ).catch(() => {
                        // Silently handle API error
                      });
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

                {/* Tags */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.28 }}
                  className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden"
                >
                  <motion.button
                    whileHover={{ backgroundColor: 'rgba(148, 163, 184, 0.1)' }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => toggleSection('tags')}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-pink-500/10 dark:bg-pink-500/20">
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
                        animate={{ rotate: isExpanded('tags') ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown size={18} className="text-slate-400" />
                      </motion.div>
                    </div>
                  </motion.button>

                  <AnimatePresence>
                    {isExpanded('tags') && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="border-t border-slate-200 dark:border-navy-700 overflow-hidden"
                      >
                        <div className="p-4 space-y-3">
                          {/* Tags list */}
                          {tags.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {tags.map((tag, index) => (
                                <motion.span
                                  key={index}
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-pink-500/10 to-purple-500/10 dark:from-pink-500/20 dark:to-purple-500/20 text-pink-700 dark:text-pink-300 text-xs font-medium"
                                >
                                  #{tag}
                                  <button
                                    onClick={() => setTags(tags.filter((_, i) => i !== index))}
                                    className="p-0.5 rounded-full hover:bg-pink-500/20 transition-colors"
                                  >
                                    <X size={12} />
                                  </button>
                                </motion.span>
                              ))}
                            </div>
                          )}

                          {/* Add tag input */}
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newTag}
                              onChange={(e) => setNewTag(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && newTag.trim()) {
                                  if (!tags.includes(newTag.trim().toLowerCase())) {
                                    setTags([...tags, newTag.trim().toLowerCase()]);
                                  }
                                  setNewTag('');
                                }
                              }}
                              placeholder={isPolish ? 'Dodaj tag...' : 'Add tag...'}
                              className="flex-1 px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:border-pink-400"
                            />
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => {
                                if (newTag.trim() && !tags.includes(newTag.trim().toLowerCase())) {
                                  setTags([...tags, newTag.trim().toLowerCase()]);
                                  setNewTag('');
                                }
                              }}
                              className="px-4 py-2 rounded-lg bg-pink-500/10 dark:bg-pink-500/20 text-pink-600 dark:text-pink-400 hover:bg-pink-500/20 dark:hover:bg-pink-500/30 text-sm font-medium transition-all"
                            >
                              <Plus size={16} />
                            </motion.button>
                          </div>

                          {/* Quick tags */}
                          {tags.length === 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {[
                                isPolish ? 'pilne' : 'urgent',
                                isPolish ? 'strategiczne' : 'strategic',
                                isPolish ? 'budżet' : 'budget',
                                isPolish ? 'techniczne' : 'technical',
                              ].map((quickTag) => (
                                <button
                                  key={quickTag}
                                  onClick={() => setTags([...tags, quickTag])}
                                  className="px-2.5 py-1 rounded-full text-xs bg-slate-100 dark:bg-navy-700 text-slate-500 dark:text-slate-400 hover:bg-pink-100 dark:hover:bg-pink-500/20 hover:text-pink-600 dark:hover:text-pink-400 transition-colors"
                                >
                                  #{quickTag}
                                </button>
                              ))}
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
                  expanded={isExpanded('attachments')}
                  onToggleExpand={() => toggleSection('attachments')}
                />

                {/* Linked Items */}
                <LinkedItemsSection
                  items={linkedItems}
                  onAdd={handleAddLinkedItem}
                  onRemove={handleRemoveLinkedItem}
                  searchItems={searchLinkedItems}
                  allowedTypes={['task', 'initiative', 'decision', 'risk', 'project', 'external']}
                  expanded={isExpanded('linkedItems')}
                  onToggleExpand={() => toggleSection('linkedItems')}
                />
              </div>
            </>
          )}

          {/* ═══════════ N MODE (page-first, 2-pane) ═════════════════════════
               Layout per docs/ui-standards/detail-view-presentation-modes.md §2.5:
               - PropertiesStrip (full-width, under header)
               - 2-pane: LeftNav (fixed ~220px) | Canvas (selected section only)
               Left nav click → shows ONE section at a time (no scroll-all).
               ═══════════════════════════════════════════════════════════════════ */}
          {presentationMode === 'n' && (
            <div className="col-span-full space-y-0">
              {/* ── PropertiesStrip (§2.5.4) ─────────────────────────────── */}
              <div className="mb-4 p-4 rounded-2xl bg-white/80 dark:bg-navy-900/80 backdrop-blur-xl border border-slate-200/60 dark:border-navy-700/60">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {/* Status */}
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Status
                    </label>
                    <div className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-50 dark:bg-navy-800 border border-slate-200/60 dark:border-navy-600/60 text-slate-700 dark:text-slate-200 truncate">
                      {isPolish ? STATUS_CONFIG[status].label.pl : STATUS_CONFIG[status].label.en}
                    </div>
                  </div>
                  {/* Decider */}
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {isPolish ? 'Decydent' : 'Decider'}
                    </label>
                    <div className="px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200/60 dark:border-navy-600/60 text-slate-500 dark:text-slate-400 truncate">
                      {(() => {
                        const decider = users.find((u) => u.id === deciderId);
                        return decider ? `${decider.firstName} ${decider.lastName}` : '—';
                      })()}
                    </div>
                  </div>
                  {/* Priority */}
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {isPolish ? 'Priorytet' : 'Priority'}
                    </label>
                    <div className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-50 dark:bg-navy-800 border border-slate-200/60 dark:border-navy-600/60 text-slate-700 dark:text-slate-200 truncate">
                      {isPolish
                        ? PRIORITY_CONFIG[priority].label.pl
                        : PRIORITY_CONFIG[priority].label.en}
                    </div>
                  </div>
                  {/* Due date */}
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {isPolish ? 'Termin' : 'Deadline'}
                    </label>
                    <div className="px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200/60 dark:border-navy-600/60 text-slate-500 dark:text-slate-400 truncate">
                      {dueDate || '—'}
                    </div>
                  </div>
                  {/* Requester */}
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {isPolish ? 'Wnioskodawca' : 'Requester'}
                    </label>
                    <div className="px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200/60 dark:border-navy-600/60 text-slate-500 dark:text-slate-400 truncate">
                      {requesterName || '—'}
                    </div>
                  </div>
                  {/* Initiative */}
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {isPolish ? 'Inicjatywa' : 'Initiative'}
                    </label>
                    <div className="px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200/60 dark:border-navy-600/60 text-slate-500 dark:text-slate-400 truncate">
                      {initiativeName || (isPolish ? 'Samodzielna' : 'Standalone')}
                    </div>
                  </div>
                </div>
                {/* Action buttons for pending decisions */}
                {decisionId && isPending && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-200/40 dark:border-navy-700/40">
                    <button
                      onClick={handleApprove}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-emerald-400/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                    >
                      <Check size={13} /> {isPolish ? 'Zatwierdź' : 'Approve'}
                    </button>
                    <button
                      onClick={handleReject}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-red-400/50 text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <X size={13} /> {isPolish ? 'Odrzuć' : 'Reject'}
                    </button>
                    <button
                      onClick={handleRequestMoreInfo}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300/60 dark:border-navy-600/60 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                    >
                      <HelpCircle size={13} /> {isPolish ? 'Więcej info' : 'Request info'}
                    </button>
                    <button
                      onClick={() => setShowDelegationModal(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300/60 dark:border-navy-600/60 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                    >
                      <Share2 size={13} /> {isPolish ? 'Deleguj' : 'Delegate'}
                    </button>
                  </div>
                )}
              </div>

              {/* ── 2-Pane: LeftNav + Canvas ──────────────────────────────── */}
              <div className="flex gap-0 min-h-[60vh]">
                {/* Left Navigation Rail (fixed ~220px) */}
                <nav className="w-[220px] flex-shrink-0 pr-4 border-r border-slate-200/40 dark:border-navy-700/40">
                  <div className="sticky top-28 space-y-1">
                    {notionSections.map((section) => {
                      const isActive = activeNotionSection === section.id;
                      const Icon = section.icon;
                      return (
                        <button
                          key={section.id}
                          onClick={() => setActiveNotionSection(section.id)}
                          className={`group w-full text-left px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-[180ms] ${
                            isActive
                              ? 'bg-primary-500/10 dark:bg-primary-500/15 text-primary-700 dark:text-primary-300 border-l-2 border-primary-500'
                              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-navy-800/60 border-l-2 border-transparent'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <Icon
                              size={14}
                              className={`${
                                isActive
                                  ? 'text-primary-500 dark:text-primary-400'
                                  : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-500 dark:group-hover:text-slate-300'
                              }`}
                            />
                            {section.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </nav>

                {/* Canvas (shows selected section only) */}
                <div className="flex-1 pl-6 min-w-0">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeNotionSection}
                      initial={reducedMotion ? {} : { opacity: 0, y: 3 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reducedMotion ? {} : { opacity: 0, y: -3 }}
                      transition={{ duration: motionDuration }}
                    >
                      {/* ═══════════════════════════════════════════════
                          N BLOCKS KIT — flat, quiet UI (§2.5.3 / §2.5.5)
                          Typography + whitespace, NOT frames.
                          ═══════════════════════════════════════════════ */}

                      {/* ── Section: Context & Problem ───────────────── */}
                      {activeNotionSection === 'context-problem' && (
                        <div className="space-y-5">
                          <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                              {isPolish ? 'Kontekst i problem' : 'Context & Problem'}
                            </h2>
                            <button
                              onClick={generateDescriptionAI}
                              disabled={isDecisionStageLocked || isGeneratingDescription}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-purple-500 dark:text-purple-400 hover:bg-purple-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              {isGeneratingDescription ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <Sparkles size={13} />
                              )}{' '}
                              AI
                            </button>
                          </div>
                          <textarea
                            value={description}
                            onChange={(e) =>
                              !isDecisionStageLocked && setDescription(e.target.value)
                            }
                            readOnly={isDecisionStageLocked}
                            rows={8}
                            className="w-full px-0 py-2 bg-transparent text-sm leading-relaxed text-slate-700 dark:text-slate-300 focus:outline-none placeholder-slate-400 dark:placeholder-slate-600 resize-y border-b border-slate-200/40 dark:border-navy-700/40 focus:border-primary-400 transition-colors"
                            placeholder={
                              isPolish
                                ? 'Opisz kontekst i wymagania decyzji...'
                                : 'Describe the context and requirements...'
                            }
                          />
                        </div>
                      )}

                      {/* ── Section: Options & Trade-offs (InlineTable) ─ */}
                      {activeNotionSection === 'options-tradeoffs' && (
                        <div className="space-y-5">
                          <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                              {isPolish ? 'Opcje i trade-offy' : 'Options & Trade-offs'}
                            </h2>
                            <button
                              onClick={generateAlternativesAI}
                              disabled={isDecisionStageLocked || isGeneratingAlternatives}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-colors disabled:opacity-50"
                            >
                              {isGeneratingAlternatives ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <Sparkles size={13} />
                              )}
                              {isPolish ? 'Generuj opcje' : 'Generate options'}
                            </button>
                          </div>

                          {alternatives.length === 0 ? (
                            /* EmptyStateInline */
                            <div className="py-10 text-center">
                              <Lightbulb
                                size={28}
                                className="mx-auto mb-3 text-slate-300 dark:text-slate-600"
                              />
                              <p className="text-sm text-slate-400 dark:text-slate-500 mb-3">
                                {isPolish
                                  ? 'Brak zdefiniowanych opcji.'
                                  : 'No options defined yet.'}
                              </p>
                              <button
                                onClick={addAlternative}
                                className="text-xs font-medium text-primary-500 hover:text-primary-600 transition-colors"
                              >
                                + {isPolish ? 'Dodaj opcję' : 'Add option'}
                              </button>
                            </div>
                          ) : (
                            /* InlineTable — flat comparison */
                            <div className="space-y-0 divide-y divide-slate-200/50 dark:divide-navy-700/50">
                              {alternatives.map((alt) => (
                                <div
                                  key={alt.id}
                                  className={`py-4 first:pt-0 group ${alt.isRecommended ? 'relative' : ''}`}
                                >
                                  {alt.isRecommended && (
                                    <span
                                      className="absolute -left-4 top-5 w-1.5 h-1.5 rounded-full bg-emerald-500"
                                      title="Recommended"
                                    />
                                  )}
                                  <div className="flex items-start justify-between gap-3 mb-2">
                                    <div className="flex-1 min-w-0">
                                      <input
                                        value={alt.title}
                                        onChange={(e) =>
                                          updateAlternative(alt.id, { title: e.target.value })
                                        }
                                        className="w-full text-sm font-medium bg-transparent text-slate-800 dark:text-white focus:outline-none placeholder-slate-400"
                                        placeholder={isPolish ? 'Nazwa opcji...' : 'Option name...'}
                                      />
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      {!alt.isRecommended && (
                                        <button
                                          onClick={() => setRecommendedAlternative(alt.id)}
                                          className="p-1 text-slate-400 hover:text-emerald-500 transition-colors"
                                          title="Set recommended"
                                        >
                                          <Star size={13} />
                                        </button>
                                      )}
                                      <button
                                        onClick={() => removeAlternative(alt.id)}
                                        className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </div>
                                  <textarea
                                    value={alt.description}
                                    onChange={(e) =>
                                      updateAlternative(alt.id, { description: e.target.value })
                                    }
                                    rows={2}
                                    className="w-full text-xs bg-transparent text-slate-500 dark:text-slate-400 focus:outline-none placeholder-slate-300 dark:placeholder-slate-600 resize-none leading-relaxed"
                                    placeholder={isPolish ? 'Opis...' : 'Description...'}
                                  />
                                  {/* Inline pros/cons */}
                                  <div className="flex gap-6 mt-2 text-[11px]">
                                    <div className="flex-1">
                                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                        + {alt.pros?.length || 0} {isPolish ? 'za' : 'pros'}
                                      </span>
                                    </div>
                                    <div className="flex-1">
                                      <span className="text-red-500 dark:text-red-400 font-medium">
                                        − {alt.cons?.length || 0} {isPolish ? 'przeciw' : 'cons'}
                                      </span>
                                    </div>
                                    {alt.riskLevel && (
                                      <span
                                        className={`font-medium ${alt.riskLevel === 'high' ? 'text-red-500' : alt.riskLevel === 'medium' ? 'text-amber-500' : 'text-slate-400'}`}
                                      >
                                        {isPolish ? 'ryzyko' : 'risk'}: {alt.riskLevel}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          <button
                            onClick={addAlternative}
                            className="text-xs font-medium text-slate-400 dark:text-slate-500 hover:text-primary-500 transition-colors"
                          >
                            + {isPolish ? 'Dodaj opcję' : 'Add option'}
                          </button>
                        </div>
                      )}

                      {/* ── Section: Risk & Impact (flat list + Callout) ── */}
                      {activeNotionSection === 'risk-impact' && (
                        <div className="space-y-6">
                          <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                              {isPolish ? 'Ryzyko i wpływ' : 'Risk & Impact'}
                            </h2>
                            <button
                              onClick={generateRisksAI}
                              disabled={isDecisionStageLocked || isGeneratingRisks}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 dark:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                            >
                              {isGeneratingRisks ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <Sparkles size={13} />
                              )}
                              {isPolish ? 'Generuj ryzyka' : 'Generate risks'}
                            </button>
                          </div>

                          {/* Risk items — flat list */}
                          {risks.length === 0 ? (
                            <div className="py-8 text-center">
                              <AlertTriangle
                                size={24}
                                className="mx-auto mb-2 text-slate-300 dark:text-slate-600"
                              />
                              <p className="text-sm text-slate-400 dark:text-slate-500 mb-3">
                                {isPolish
                                  ? 'Brak zidentyfikowanych ryzyk.'
                                  : 'No risks identified.'}
                              </p>
                              <button
                                onClick={addRisk}
                                className="text-xs font-medium text-primary-500 hover:text-primary-600 transition-colors"
                              >
                                + {isPolish ? 'Dodaj ryzyko' : 'Add risk'}
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-0 divide-y divide-slate-200/50 dark:divide-navy-700/50">
                              {risks.map((risk) => (
                                <div key={risk.id} className="py-3 first:pt-0 group">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                      <input
                                        value={risk.title}
                                        onChange={(e) =>
                                          updateRisk(risk.id, { title: e.target.value })
                                        }
                                        className="w-full text-sm font-medium bg-transparent text-slate-800 dark:text-white focus:outline-none placeholder-slate-400"
                                        placeholder={isPolish ? 'Nazwa ryzyka...' : 'Risk name...'}
                                      />
                                    </div>
                                    <div className="flex items-center gap-2 text-[11px]">
                                      <span
                                        className={`px-1.5 py-0.5 rounded font-medium ${
                                          risk.probability === 'critical' ||
                                          risk.probability === 'high'
                                            ? 'text-red-600 dark:text-red-400 bg-red-500/10'
                                            : risk.probability === 'medium'
                                              ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10'
                                              : 'text-slate-500 bg-slate-500/10'
                                        }`}
                                      >
                                        P: {risk.probability}
                                      </span>
                                      <span
                                        className={`px-1.5 py-0.5 rounded font-medium ${
                                          risk.impact === 'critical' || risk.impact === 'high'
                                            ? 'text-red-600 dark:text-red-400 bg-red-500/10'
                                            : risk.impact === 'medium'
                                              ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10'
                                              : 'text-slate-500 bg-slate-500/10'
                                        }`}
                                      >
                                        I: {risk.impact}
                                      </span>
                                      <button
                                        onClick={() => removeRisk(risk.id)}
                                        className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                      >
                                        <X size={12} />
                                      </button>
                                    </div>
                                  </div>
                                  {(risk.mitigation || risk.contingency) && (
                                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
                                      {risk.mitigation}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          <button
                            onClick={addRisk}
                            className="text-xs font-medium text-slate-400 dark:text-slate-500 hover:text-primary-500 transition-colors"
                          >
                            + {isPolish ? 'Dodaj ryzyko' : 'Add risk'}
                          </button>

                          {/* Callout: Consequences of Inaction (§2.5.5 Callout block) */}
                          <div className="mt-2 pl-4 border-l-2 border-amber-400 dark:border-amber-500/60">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                                {isPolish
                                  ? 'Konsekwencje braku decyzji'
                                  : 'Consequences of Inaction'}
                              </h3>
                              <button
                                onClick={generateConsequencesOfInactionAI}
                                disabled={isDecisionStageLocked}
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <Sparkles size={11} />
                                {isPolish ? 'Wypełnij AI' : 'Fill with AI'}
                              </button>
                            </div>
                            <textarea
                              value={rationale}
                              onChange={(e) =>
                                !isDecisionStageLocked && setRationale(e.target.value)
                              }
                              readOnly={isDecisionStageLocked}
                              rows={3}
                              className="w-full px-0 py-1 bg-transparent text-sm text-slate-700 dark:text-slate-300 focus:outline-none placeholder-amber-400/50 dark:placeholder-amber-600/40 resize-y leading-relaxed"
                              placeholder={
                                isPolish
                                  ? 'Co się stanie, jeśli decyzja nie zostanie podjęta?'
                                  : 'What happens if the decision is not made?'
                              }
                            />
                          </div>
                        </div>
                      )}

                      {/* ── Section: Governance & Escalation (flat) ───── */}
                      {activeNotionSection === 'governance-escalation' && (
                        <div className="space-y-8">
                          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                            {isPolish ? 'Governance i eskalacja' : 'Governance & Escalation'}
                          </h2>

                          {/* Stakeholders (RACI) — inline table */}
                          <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                              {isPolish ? 'Interesariusze (RACI)' : 'Stakeholders (RACI)'}
                            </h3>
                            {stakeholders.length === 0 ? (
                              <p className="text-xs text-slate-400 dark:text-slate-500 py-2">
                                {isPolish
                                  ? 'Brak przypisanych interesariuszy.'
                                  : 'No stakeholders assigned.'}
                              </p>
                            ) : (
                              <div className="space-y-0 divide-y divide-slate-200/40 dark:divide-navy-700/40">
                                {stakeholders.map((s) => (
                                  <div
                                    key={s.id}
                                    className="flex items-center justify-between py-2 group"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="w-6 h-6 rounded-full bg-primary-500/15 flex items-center justify-center text-[10px] font-bold text-primary-600 dark:text-primary-400 uppercase">
                                        {(s.userName || s.userId).charAt(0)}
                                      </div>
                                      <span className="text-sm text-slate-700 dark:text-slate-300">
                                        {s.userName || s.userId}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                                        {s.role}
                                      </span>
                                      <button
                                        onClick={() =>
                                          setStakeholders(
                                            stakeholders.filter((st) => st.id !== s.id)
                                          )
                                        }
                                        className="p-0.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                      >
                                        <X size={12} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            <button
                              onClick={() => {
                                if (users.length > 0) {
                                  const user = users[0];
                                  const newS: Stakeholder = {
                                    id: Math.random().toString(36).substr(2, 9),
                                    decisionId: decisionId || 'new',
                                    userId: user.id,
                                    userName: `${user.firstName} ${user.lastName}`,
                                    userEmail: user.email,
                                    role: 'consulted',
                                    notificationSettings: {
                                      enabled: true,
                                      triggers: ['on_status_change'],
                                      emailEnabled: false,
                                      inAppEnabled: true,
                                    },
                                  };
                                  setStakeholders([...stakeholders, newS]);
                                }
                              }}
                              className="text-xs font-medium text-slate-400 dark:text-slate-500 hover:text-primary-500 transition-colors"
                            >
                              + {isPolish ? 'Dodaj interesariusza' : 'Add stakeholder'}
                            </button>
                          </div>

                          {/* Escalation — simple summary */}
                          <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                              {isPolish ? 'Reguły eskalacji' : 'Escalation Rules'}
                            </h3>
                            <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                              <p>
                                {isPolish ? 'Ostrzeżenie' : 'Warning'}: {thresholds.warningDays}d |{' '}
                                {isPolish ? 'Krytyczne' : 'Critical'}: {thresholds.criticalDays}d
                              </p>
                              {escalation?.enabled && (
                                <p className="text-amber-600 dark:text-amber-400">
                                  {isPolish ? 'Eskaluj do' : 'Escalate to'}:{' '}
                                  {escalation.escalateToName || escalation.escalateTo} (
                                  {isPolish ? 'po' : 'after'} {escalation.afterDays}d)
                                </p>
                              )}
                              {reminders.filter((r) => r.enabled).length > 0 && (
                                <p>
                                  {reminders.filter((r) => r.enabled).length}{' '}
                                  {isPolish ? 'aktywnych przypomnień' : 'active reminders'}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ── Section: Comments (flat) ─────────────────────── */}
                      {activeNotionSection === 'comments' && (
                        <div className="space-y-8">
                          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                            {isPolish ? 'Komentarze' : 'Comments'}
                          </h2>

                          {/* Comments — ActivityStream style */}
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                                {isPolish ? 'Komentarze' : 'Comments'}
                              </h3>
                              <button
                                onClick={generateAIComment}
                                disabled={isDecisionStageLocked || isGeneratingAIComment}
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-500 dark:text-purple-400 hover:text-purple-600 transition-colors disabled:opacity-50"
                              >
                                {isGeneratingAIComment ? (
                                  <Loader2 size={11} className="animate-spin" />
                                ) : (
                                  <Sparkles size={11} />
                                )}{' '}
                                AI
                              </button>
                            </div>

                            {comments.length === 0 ? (
                              <p className="text-xs text-slate-400 dark:text-slate-500 py-4 text-center">
                                {isPolish
                                  ? 'Brak komentarzy. Rozpocznij dyskusję.'
                                  : 'No comments yet. Start the conversation.'}
                              </p>
                            ) : (
                              <div className="space-y-4">
                                {comments.map((c) => (
                                  <div key={c.id} className="group">
                                    <div className="flex items-start gap-3">
                                      <div className="w-6 h-6 rounded-full bg-primary-500/15 flex items-center justify-center text-[10px] font-bold text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5">
                                        {(c.authorName || '?').charAt(0)}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                            {c.authorName}
                                          </span>
                                          <span className="text-[10px] text-slate-400">
                                            {new Date(c.createdAt).toLocaleDateString()}
                                          </span>
                                          {c.isAIGenerated && (
                                            <span className="text-[9px] text-purple-500 font-medium">
                                              AI
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                          {c.content}
                                        </p>
                                      </div>
                                      <button
                                        onClick={() => handleDeleteComment(c.id)}
                                        className="p-0.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                                      >
                                        <X size={12} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Inline comment input */}
                            <div className="flex items-center gap-3 pt-2 border-t border-slate-200/40 dark:border-navy-700/40">
                              <input
                                type="text"
                                placeholder={
                                  isPolish ? 'Napisz komentarz...' : 'Write a comment...'
                                }
                                className="flex-1 text-sm bg-transparent text-slate-700 dark:text-slate-300 focus:outline-none placeholder-slate-400 dark:placeholder-slate-600"
                                onKeyDown={(e) => {
                                  if (
                                    e.key === 'Enter' &&
                                    (e.target as HTMLInputElement).value.trim()
                                  ) {
                                    handleAddComment((e.target as HTMLInputElement).value);
                                    (e.target as HTMLInputElement).value = '';
                                  }
                                }}
                              />
                              <button
                                onClick={() => {
                                  const input = document.querySelector<HTMLInputElement>(
                                    '[placeholder*="comment"], [placeholder*="komentarz"]'
                                  );
                                  if (input?.value.trim()) {
                                    handleAddComment(input.value);
                                    input.value = '';
                                  }
                                }}
                                className="text-xs font-medium text-primary-500 hover:text-primary-600 transition-colors"
                              >
                                {isPolish ? 'Wyślij' : 'Send'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ── Section: Attachments & Links (flat) ─────────── */}
                      {activeNotionSection === 'resources-links' && (
                        <div className="space-y-8">
                          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                            {isPolish ? 'Załączniki i powiązania' : 'Attachments & Links'}
                          </h2>

                          {/* Attachments — flat file list */}
                          <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                              {isPolish ? 'Załączniki' : 'Attachments'}
                            </h3>
                            {attachments.length === 0 ? (
                              <div className="py-6 text-center">
                                <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">
                                  {isPolish ? 'Brak załączników.' : 'No attachments.'}
                                </p>
                                <label className="text-xs font-medium text-primary-500 hover:text-primary-600 transition-colors cursor-pointer">
                                  + {isPolish ? 'Dodaj plik' : 'Add file'}
                                  <input
                                    type="file"
                                    multiple
                                    className="hidden"
                                    onChange={(e) =>
                                      e.target.files &&
                                      handleUploadAttachments(Array.from(e.target.files))
                                    }
                                  />
                                </label>
                              </div>
                            ) : (
                              <>
                                <div className="space-y-0 divide-y divide-slate-200/40 dark:divide-navy-700/40">
                                  {attachments.map((a) => (
                                    <div
                                      key={a.id}
                                      className="flex items-center justify-between py-2 group"
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <FileText
                                          size={14}
                                          className="text-slate-400 flex-shrink-0"
                                        />
                                        <span className="text-sm text-slate-700 dark:text-slate-300 truncate">
                                          {a.name}
                                        </span>
                                        <span className="text-[10px] text-slate-400">
                                          {(a.size / 1024).toFixed(0)}KB
                                        </span>
                                      </div>
                                      <button
                                        onClick={() => handleDeleteAttachment(a.id)}
                                        className="p-0.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                      >
                                        <X size={12} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                                <label className="text-xs font-medium text-slate-400 dark:text-slate-500 hover:text-primary-500 transition-colors cursor-pointer">
                                  + {isPolish ? 'Dodaj plik' : 'Add file'}
                                  <input
                                    type="file"
                                    multiple
                                    className="hidden"
                                    onChange={(e) =>
                                      e.target.files &&
                                      handleUploadAttachments(Array.from(e.target.files))
                                    }
                                  />
                                </label>
                              </>
                            )}
                          </div>

                          {/* Linked Items — merged with attachments section */}
                          <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                              {isPolish ? 'Powiązane elementy' : 'Linked Items'}
                            </h3>
                            {linkedItems.length === 0 ? (
                              <p className="text-xs text-slate-400 dark:text-slate-500 py-2">
                                {isPolish ? 'Brak powiązanych elementów.' : 'No linked items.'}
                              </p>
                            ) : (
                              <div className="space-y-0 divide-y divide-slate-200/40 dark:divide-navy-700/40">
                                {linkedItems.map((item) => (
                                  <div
                                    key={item.id}
                                    className="flex items-center justify-between py-2 group"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="text-[10px] font-mono uppercase text-slate-400 dark:text-slate-500 w-14">
                                        {item.type}
                                      </span>
                                      <span className="text-sm text-slate-700 dark:text-slate-300 truncate">
                                        {item.title}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {item.status && (
                                        <span className="text-[11px] text-slate-400">
                                          {item.status}
                                        </span>
                                      )}
                                      <button
                                        onClick={() => handleRemoveLinkedItem(item.id)}
                                        className="p-0.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                      >
                                        <X size={12} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            <button
                              onClick={() =>
                                handleAddLinkedItem({
                                  id: Math.random().toString(36).substr(2, 9),
                                  type: 'task',
                                  title: 'New linked item',
                                })
                              }
                              className="text-xs font-medium text-slate-400 dark:text-slate-500 hover:text-primary-500 transition-colors"
                            >
                              + {isPolish ? 'Dodaj powiązanie' : 'Link item'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ── Section: Activity Log (end section) ─────────── */}
                      {activeNotionSection === 'activity-log' && (
                        <div className="space-y-6">
                          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                            {isPolish ? 'Logi aktywności' : 'Activity Log'}
                          </h2>
                          {activityLog.length === 0 ? (
                            <p className="text-xs text-slate-400 dark:text-slate-500 py-6 text-center">
                              {isPolish ? 'Brak wpisów w logu.' : 'No activity entries yet.'}
                            </p>
                          ) : (
                            <div className="space-y-0 divide-y divide-slate-200/40 dark:divide-navy-700/40">
                              {activityLog.map((entry) => {
                                const entryIcon =
                                  entry.type === 'approved' ? (
                                    <Check size={12} />
                                  ) : entry.type === 'rejected' ? (
                                    <X size={12} />
                                  ) : entry.type === 'escalated' ? (
                                    <ArrowUp size={12} />
                                  ) : entry.type === 'deferred' ? (
                                    <Clock size={12} />
                                  ) : entry.type === 'assignment' ? (
                                    <UserCheck size={12} />
                                  ) : entry.type === 'comment' ? (
                                    <MessageSquare size={12} />
                                  ) : entry.type === 'edit' ? (
                                    <Edit3 size={12} />
                                  ) : entry.type === 'deadline' ? (
                                    <Calendar size={12} />
                                  ) : entry.type === 'priority' ||
                                    entry.type === 'status_change' ? (
                                    <Flag size={12} />
                                  ) : (
                                    <Plus size={12} />
                                  );

                                return (
                                  <div key={entry.id} className="py-3 flex items-start gap-3">
                                    <div className="mt-0.5 text-slate-400 dark:text-slate-500">
                                      {entryIcon}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm text-slate-700 dark:text-slate-300">
                                        {entry.description}
                                      </p>
                                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                                        {new Date(entry.timestamp).toLocaleString()}
                                        {entry.userName ? ` · ${entry.userName}` : ''}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════ CLICKUP MODE (action-first) ═════════════════════════ */}
          {presentationMode === 'c' && (
            <div className="col-span-full space-y-4">
              <div className="flex flex-wrap items-center gap-2 p-2 rounded-xl bg-white/60 dark:bg-navy-900/60 border border-slate-200/60 dark:border-navy-700/60">
                {(
                  [
                    ['overview', isPolish ? 'Overview' : 'Overview'],
                    ['resources', isPolish ? 'Załączniki + Linki' : 'Attachments + Links'],
                    ['risk', isPolish ? 'Ryzyko' : 'Risk'],
                    ['options', isPolish ? 'Opcje' : 'Options'],
                    ['governance', isPolish ? 'RACI + Eskalacja' : 'RACI + Escalation'],
                    ['comments', isPolish ? 'Komentarze' : 'Comments'],
                    ['logs', isPolish ? 'Logi' : 'Logs'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setClickupTab(key)}
                    className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                      clickupTab === key
                        ? 'bg-primary-500/15 border-primary-400/50 text-primary-600 dark:text-primary-300'
                        : 'bg-transparent border-slate-200 dark:border-navy-700 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.9fr)_330px] gap-4">
                <div className="space-y-4 min-w-0">
                  {clickupTab === 'overview' && (
                    <div className="bg-white/70 dark:bg-navy-900/70 rounded-2xl border border-slate-200/60 dark:border-navy-700/60 p-4 space-y-3">
                      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        {isPolish ? 'Przegląd decyzji' : 'Decision Overview'}
                      </h3>
                      <textarea
                        value={description}
                        onChange={(e) => !isDecisionStageLocked && setDescription(e.target.value)}
                        readOnly={isDecisionStageLocked}
                        rows={6}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm"
                      />
                      <label className="block text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                        {isPolish ? 'Konsekwencje braku decyzji' : 'Consequences of Inaction'}
                      </label>
                      <textarea
                        value={rationale}
                        onChange={(e) => !isDecisionStageLocked && setRationale(e.target.value)}
                        readOnly={isDecisionStageLocked}
                        rows={4}
                        className="w-full px-3 py-2 rounded-xl bg-amber-50/80 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/30 text-sm"
                        placeholder={
                          isPolish ? 'Konsekwencje braku decyzji...' : 'Consequences of inaction...'
                        }
                      />
                    </div>
                  )}

                  {clickupTab === 'options' && (
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
                      expanded
                      onToggleExpand={() => {}}
                      isGenerating={isGeneratingAlternatives}
                    />
                  )}

                  {clickupTab === 'risk' && (
                    <RiskAssessmentCompact
                      risks={risks}
                      onAdd={addRisk}
                      onUpdate={updateRisk}
                      onRemove={removeRisk}
                      onGenerateAI={generateRisksAI}
                      expanded
                      onToggleExpand={() => {}}
                      isGenerating={isGeneratingRisks}
                    />
                  )}

                  {clickupTab === 'governance' && (
                    <div className="space-y-4">
                      {/* RACI table */}
                      <div className="bg-white/70 dark:bg-navy-900/70 rounded-2xl border border-slate-200/60 dark:border-navy-700/60 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                            {isPolish ? 'RACI' : 'RACI'}
                          </h3>
                          <button
                            disabled={isDecisionStageLocked}
                            onClick={() => {
                              const fallbackUser = users[0];
                              if (!fallbackUser) return;
                              const newStakeholder: Stakeholder = {
                                id: Math.random().toString(36).substr(2, 9),
                                decisionId: decisionId || 'new',
                                userId: fallbackUser.id,
                                userName: `${fallbackUser.firstName} ${fallbackUser.lastName}`,
                                userEmail: fallbackUser.email,
                                role: 'consulted',
                                notificationSettings: {
                                  enabled: true,
                                  triggers: ['on_status_change'],
                                  emailEnabled: false,
                                  inAppEnabled: true,
                                },
                              };
                              setStakeholders([...stakeholders, newStakeholder]);
                            }}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-300/60 dark:border-navy-600 text-slate-500 hover:text-primary-500 hover:border-primary-400/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            + {isPolish ? 'Dodaj' : 'Add'}
                          </button>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500 border-b border-slate-200/50 dark:border-navy-700/50">
                                <th className="text-left py-2 pr-2">
                                  {isPolish ? 'Rola' : 'Role'}
                                </th>
                                <th className="text-left py-2 pr-2">
                                  {isPolish ? 'Osoba' : 'Person'}
                                </th>
                                <th className="text-left py-2 pr-2">
                                  {isPolish ? 'Email' : 'Email'}
                                </th>
                                <th className="text-left py-2 pr-2">
                                  {isPolish ? 'Powiadomienia' : 'Notifications'}
                                </th>
                                <th className="text-right py-2">
                                  {isPolish ? 'Akcje' : 'Actions'}
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200/40 dark:divide-navy-700/40">
                              {stakeholders.length === 0 ? (
                                <tr>
                                  <td
                                    colSpan={5}
                                    className="py-6 text-center text-xs text-slate-400"
                                  >
                                    {isPolish ? 'Brak interesariuszy.' : 'No stakeholders yet.'}
                                  </td>
                                </tr>
                              ) : (
                                stakeholders.map((s) => (
                                  <tr key={s.id}>
                                    <td className="py-2 pr-2">
                                      <select
                                        value={s.role}
                                        disabled={isDecisionStageLocked}
                                        onChange={(e) =>
                                          setStakeholders(
                                            stakeholders.map((item) =>
                                              item.id === s.id
                                                ? {
                                                    ...item,
                                                    role: e.target.value as StakeholderRole,
                                                  }
                                                : item
                                            )
                                          )
                                        }
                                        className="w-full px-2 py-1 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 disabled:opacity-60"
                                      >
                                        <option value="responsible">Responsible</option>
                                        <option value="accountable">Accountable</option>
                                        <option value="consulted">Consulted</option>
                                        <option value="informed">Informed</option>
                                      </select>
                                    </td>
                                    <td className="py-2 pr-2 text-slate-700 dark:text-slate-300">
                                      {s.userName || s.userId}
                                    </td>
                                    <td className="py-2 pr-2 text-slate-500 dark:text-slate-400">
                                      {s.userEmail || '—'}
                                    </td>
                                    <td className="py-2 pr-2 text-slate-500 dark:text-slate-400 text-xs">
                                      {s.notificationSettings?.enabled
                                        ? `${s.notificationSettings.triggers?.length || 0} ${
                                            isPolish ? 'triggerów' : 'triggers'
                                          }`
                                        : isPolish
                                          ? 'Wyłączone'
                                          : 'Disabled'}
                                    </td>
                                    <td className="py-2 text-right">
                                      <button
                                        disabled={isDecisionStageLocked}
                                        onClick={() =>
                                          setStakeholders(
                                            stakeholders.filter((item) => item.id !== s.id)
                                          )
                                        }
                                        className="p-1 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Reminders table */}
                      <div className="bg-white/70 dark:bg-navy-900/70 rounded-2xl border border-slate-200/60 dark:border-navy-700/60 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                            {isPolish ? 'Reminders' : 'Reminders'}
                          </h3>
                          <button
                            disabled={isDecisionStageLocked}
                            onClick={() =>
                              setReminders([
                                ...reminders,
                                {
                                  id: Math.random().toString(36).substr(2, 9),
                                  type: 'before_due',
                                  days: 2,
                                  recipients: 'both',
                                  inAppNotification: true,
                                  emailNotification: false,
                                  message: '',
                                  enabled: true,
                                },
                              ])
                            }
                            className="px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-300/60 dark:border-navy-600 text-slate-500 hover:text-primary-500 hover:border-primary-400/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            + {isPolish ? 'Dodaj' : 'Add'}
                          </button>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500 border-b border-slate-200/50 dark:border-navy-700/50">
                                <th className="text-left py-2 pr-2">
                                  {isPolish ? 'Aktywne' : 'Active'}
                                </th>
                                <th className="text-left py-2 pr-2">
                                  {isPolish ? 'Kiedy' : 'When'}
                                </th>
                                <th className="text-left py-2 pr-2">{isPolish ? 'Dni' : 'Days'}</th>
                                <th className="text-left py-2 pr-2">
                                  {isPolish ? 'Do kogo' : 'To whom'}
                                </th>
                                <th className="text-left py-2 pr-2">
                                  {isPolish ? 'Kanały' : 'Channels'}
                                </th>
                                <th className="text-left py-2 pr-2">
                                  {isPolish ? 'Wiadomość' : 'Message'}
                                </th>
                                <th className="text-right py-2">
                                  {isPolish ? 'Akcje' : 'Actions'}
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200/40 dark:divide-navy-700/40">
                              {reminders.length === 0 ? (
                                <tr>
                                  <td
                                    colSpan={7}
                                    className="py-6 text-center text-xs text-slate-400"
                                  >
                                    {isPolish ? 'Brak reminderów.' : 'No reminders yet.'}
                                  </td>
                                </tr>
                              ) : (
                                reminders.map((r) => (
                                  <tr key={r.id}>
                                    <td className="py-2 pr-2">
                                      <input
                                        type="checkbox"
                                        checked={r.enabled}
                                        disabled={isDecisionStageLocked}
                                        onChange={(e) =>
                                          setReminders(
                                            reminders.map((item) =>
                                              item.id === r.id
                                                ? { ...item, enabled: e.target.checked }
                                                : item
                                            )
                                          )
                                        }
                                      />
                                    </td>
                                    <td className="py-2 pr-2">
                                      <select
                                        value={r.type}
                                        disabled={isDecisionStageLocked}
                                        onChange={(e) =>
                                          setReminders(
                                            reminders.map((item) =>
                                              item.id === r.id
                                                ? {
                                                    ...item,
                                                    type: e.target.value as
                                                      | 'before_due'
                                                      | 'after_due',
                                                  }
                                                : item
                                            )
                                          )
                                        }
                                        className="w-full px-2 py-1 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 disabled:opacity-60"
                                      >
                                        <option value="before_due">
                                          {isPolish ? 'Przed terminem' : 'Before due'}
                                        </option>
                                        <option value="after_due">
                                          {isPolish ? 'Po terminie' : 'After due'}
                                        </option>
                                      </select>
                                    </td>
                                    <td className="py-2 pr-2">
                                      <input
                                        type="number"
                                        min={0}
                                        value={r.days}
                                        disabled={isDecisionStageLocked}
                                        onChange={(e) =>
                                          setReminders(
                                            reminders.map((item) =>
                                              item.id === r.id
                                                ? { ...item, days: Number(e.target.value) || 0 }
                                                : item
                                            )
                                          )
                                        }
                                        className="w-20 px-2 py-1 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 disabled:opacity-60"
                                      />
                                    </td>
                                    <td className="py-2 pr-2">
                                      <select
                                        value={r.recipients}
                                        disabled={isDecisionStageLocked}
                                        onChange={(e) =>
                                          setReminders(
                                            reminders.map((item) =>
                                              item.id === r.id
                                                ? {
                                                    ...item,
                                                    recipients: e.target.value as
                                                      | 'requester'
                                                      | 'decider'
                                                      | 'both'
                                                      | 'stakeholders',
                                                  }
                                                : item
                                            )
                                          )
                                        }
                                        className="w-full px-2 py-1 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 disabled:opacity-60"
                                      >
                                        <option value="requester">
                                          {isPolish ? 'Requester' : 'Requester'}
                                        </option>
                                        <option value="decider">
                                          {isPolish ? 'Decider' : 'Decider'}
                                        </option>
                                        <option value="both">{isPolish ? 'Obaj' : 'Both'}</option>
                                        <option value="stakeholders">
                                          {isPolish ? 'Interesariusze' : 'Stakeholders'}
                                        </option>
                                      </select>
                                    </td>
                                    <td className="py-2 pr-2 text-xs text-slate-500 dark:text-slate-400">
                                      <label className="inline-flex items-center gap-1 mr-2">
                                        <input
                                          type="checkbox"
                                          checked={r.inAppNotification}
                                          disabled={isDecisionStageLocked}
                                          onChange={(e) =>
                                            setReminders(
                                              reminders.map((item) =>
                                                item.id === r.id
                                                  ? { ...item, inAppNotification: e.target.checked }
                                                  : item
                                              )
                                            )
                                          }
                                        />
                                        In-app
                                      </label>
                                      <label className="inline-flex items-center gap-1">
                                        <input
                                          type="checkbox"
                                          checked={r.emailNotification}
                                          disabled={isDecisionStageLocked}
                                          onChange={(e) =>
                                            setReminders(
                                              reminders.map((item) =>
                                                item.id === r.id
                                                  ? { ...item, emailNotification: e.target.checked }
                                                  : item
                                              )
                                            )
                                          }
                                        />
                                        Email
                                      </label>
                                    </td>
                                    <td className="py-2 pr-2">
                                      <input
                                        value={r.message || ''}
                                        disabled={isDecisionStageLocked}
                                        onChange={(e) =>
                                          setReminders(
                                            reminders.map((item) =>
                                              item.id === r.id
                                                ? { ...item, message: e.target.value }
                                                : item
                                            )
                                          )
                                        }
                                        className="w-full px-2 py-1 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 disabled:opacity-60"
                                        placeholder={
                                          isPolish ? 'Treść remindera...' : 'Reminder text...'
                                        }
                                      />
                                    </td>
                                    <td className="py-2 text-right">
                                      <button
                                        disabled={isDecisionStageLocked}
                                        onClick={() =>
                                          setReminders(reminders.filter((item) => item.id !== r.id))
                                        }
                                        className="p-1 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Escalation table */}
                      <div className="bg-white/70 dark:bg-navy-900/70 rounded-2xl border border-slate-200/60 dark:border-navy-700/60 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                            {isPolish ? 'Escalation' : 'Escalation'}
                          </h3>
                          {!escalation && (
                            <button
                              disabled={isDecisionStageLocked}
                              onClick={() =>
                                setEscalation({
                                  id: Math.random().toString(36).substr(2, 9),
                                  enabled: true,
                                  escalateTo: users[0]?.id || '',
                                  escalateToName: users[0]
                                    ? `${users[0].firstName} ${users[0].lastName}`
                                    : undefined,
                                  afterDays: 3,
                                  message: '',
                                })
                              }
                              className="px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-300/60 dark:border-navy-600 text-slate-500 hover:text-primary-500 hover:border-primary-400/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              + {isPolish ? 'Dodaj' : 'Add'}
                            </button>
                          )}
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500 border-b border-slate-200/50 dark:border-navy-700/50">
                                <th className="text-left py-2 pr-2">
                                  {isPolish ? 'Aktywne' : 'Enabled'}
                                </th>
                                <th className="text-left py-2 pr-2">
                                  {isPolish ? 'Po ilu dniach' : 'After days'}
                                </th>
                                <th className="text-left py-2 pr-2">
                                  {isPolish ? 'Eskaluj do' : 'Escalate to'}
                                </th>
                                <th className="text-left py-2 pr-2">
                                  {isPolish ? 'Wiadomość' : 'Message'}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {!escalation ? (
                                <tr>
                                  <td
                                    colSpan={4}
                                    className="py-6 text-center text-xs text-slate-400"
                                  >
                                    {isPolish ? 'Brak reguły eskalacji.' : 'No escalation rule.'}
                                  </td>
                                </tr>
                              ) : (
                                <tr className="border-b border-slate-200/40 dark:border-navy-700/40">
                                  <td className="py-2 pr-2">
                                    <input
                                      type="checkbox"
                                      checked={escalation.enabled}
                                      disabled={isDecisionStageLocked}
                                      onChange={(e) =>
                                        setEscalation({ ...escalation, enabled: e.target.checked })
                                      }
                                    />
                                  </td>
                                  <td className="py-2 pr-2">
                                    <input
                                      type="number"
                                      min={1}
                                      value={escalation.afterDays}
                                      disabled={isDecisionStageLocked}
                                      onChange={(e) =>
                                        setEscalation({
                                          ...escalation,
                                          afterDays: Number(e.target.value) || 1,
                                        })
                                      }
                                      className="w-24 px-2 py-1 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 disabled:opacity-60"
                                    />
                                  </td>
                                  <td className="py-2 pr-2">
                                    <select
                                      value={escalation.escalateTo}
                                      disabled={isDecisionStageLocked}
                                      onChange={(e) => {
                                        const selected = users.find((u) => u.id === e.target.value);
                                        setEscalation({
                                          ...escalation,
                                          escalateTo: e.target.value,
                                          escalateToName: selected
                                            ? `${selected.firstName} ${selected.lastName}`
                                            : escalation.escalateToName,
                                        });
                                      }}
                                      className="w-full px-2 py-1 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 disabled:opacity-60"
                                    >
                                      <option value="">{isPolish ? 'Wybierz' : 'Select'}</option>
                                      {users.map((u) => (
                                        <option key={u.id} value={u.id}>
                                          {u.firstName} {u.lastName}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="py-2 pr-2">
                                    <input
                                      value={escalation.message || ''}
                                      disabled={isDecisionStageLocked}
                                      onChange={(e) =>
                                        setEscalation({ ...escalation, message: e.target.value })
                                      }
                                      className="w-full px-2 py-1 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 disabled:opacity-60"
                                      placeholder={
                                        isPolish ? 'Treść eskalacji...' : 'Escalation message...'
                                      }
                                    />
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {clickupTab === 'comments' && (
                    <div className="space-y-4">
                      <CommentsSection
                        comments={comments}
                        onAddComment={handleAddComment}
                        onDeleteComment={handleDeleteComment}
                        onLikeComment={handleLikeComment}
                        onGenerateAIComment={generateAIComment}
                        isGeneratingAI={isGeneratingAIComment}
                        currentUserId="current-user"
                        expanded
                        onToggleExpand={() => {}}
                      />
                    </div>
                  )}

                  {clickupTab === 'resources' && (
                    <div className="space-y-4">
                      {/* Attachments table */}
                      <div className="bg-white/70 dark:bg-navy-900/70 rounded-2xl border border-slate-200/60 dark:border-navy-700/60 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                            {isPolish ? 'Załączniki' : 'Attachments'}
                          </h3>
                          <label
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                              isDecisionStageLocked
                                ? 'border-slate-300/40 dark:border-navy-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                                : 'border-slate-300/60 dark:border-navy-600 text-slate-500 hover:text-primary-500 hover:border-primary-400/50 cursor-pointer'
                            }`}
                          >
                            + {isPolish ? 'Dodaj' : 'Add'}
                            <input
                              type="file"
                              multiple
                              disabled={isDecisionStageLocked}
                              className="hidden"
                              onChange={(e) =>
                                e.target.files && handleUploadAttachments(e.target.files)
                              }
                            />
                          </label>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500 border-b border-slate-200/50 dark:border-navy-700/50">
                                <th className="text-left py-2 pr-2">
                                  {isPolish ? 'Nazwa' : 'Name'}
                                </th>
                                <th className="text-left py-2 pr-2">{isPolish ? 'Typ' : 'Type'}</th>
                                <th className="text-left py-2 pr-2">
                                  {isPolish ? 'Rozmiar' : 'Size'}
                                </th>
                                <th className="text-left py-2 pr-2">
                                  {isPolish ? 'Dodano' : 'Uploaded'}
                                </th>
                                <th className="text-left py-2 pr-2">{isPolish ? 'Przez' : 'By'}</th>
                                <th className="text-right py-2">
                                  {isPolish ? 'Akcje' : 'Actions'}
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200/40 dark:divide-navy-700/40">
                              {attachments.length === 0 ? (
                                <tr>
                                  <td
                                    colSpan={6}
                                    className="py-6 text-center text-xs text-slate-400"
                                  >
                                    {isPolish ? 'Brak załączników.' : 'No attachments.'}
                                  </td>
                                </tr>
                              ) : (
                                attachments.map((a) => (
                                  <tr key={a.id}>
                                    <td className="py-2 pr-2 text-slate-700 dark:text-slate-300 max-w-[280px] truncate">
                                      {a.name}
                                    </td>
                                    <td className="py-2 pr-2 text-slate-500 dark:text-slate-400 text-xs">
                                      {a.type || '—'}
                                    </td>
                                    <td className="py-2 pr-2 text-slate-500 dark:text-slate-400">
                                      {(a.size / 1024 / 1024).toFixed(1)} MB
                                    </td>
                                    <td className="py-2 pr-2 text-slate-500 dark:text-slate-400">
                                      {a.uploadedAt
                                        ? new Date(a.uploadedAt).toLocaleDateString()
                                        : '—'}
                                    </td>
                                    <td className="py-2 pr-2 text-slate-500 dark:text-slate-400">
                                      {a.uploadedBy || '—'}
                                    </td>
                                    <td className="py-2 text-right">
                                      <button
                                        disabled={isDecisionStageLocked}
                                        onClick={() => handleDeleteAttachment(a.id)}
                                        className="p-1 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Linked items table */}
                      <div className="bg-white/70 dark:bg-navy-900/70 rounded-2xl border border-slate-200/60 dark:border-navy-700/60 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                            {isPolish ? 'Powiązane elementy' : 'Linked Items'}
                          </h3>
                          <button
                            disabled={isDecisionStageLocked}
                            onClick={() =>
                              handleAddLinkedItem({
                                id: Math.random().toString(36).substr(2, 9),
                                type: 'task',
                                title: isPolish ? 'Nowe powiązanie' : 'New linked item',
                              })
                            }
                            className="px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-300/60 dark:border-navy-600 text-slate-500 hover:text-primary-500 hover:border-primary-400/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            + {isPolish ? 'Dodaj' : 'Add'}
                          </button>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500 border-b border-slate-200/50 dark:border-navy-700/50">
                                <th className="text-left py-2 pr-2">{isPolish ? 'Typ' : 'Type'}</th>
                                <th className="text-left py-2 pr-2">
                                  {isPolish ? 'Tytuł' : 'Title'}
                                </th>
                                <th className="text-left py-2 pr-2">
                                  {isPolish ? 'Status' : 'Status'}
                                </th>
                                <th className="text-left py-2 pr-2">
                                  {isPolish ? 'Priorytet' : 'Priority'}
                                </th>
                                <th className="text-right py-2">
                                  {isPolish ? 'Akcje' : 'Actions'}
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200/40 dark:divide-navy-700/40">
                              {linkedItems.length === 0 ? (
                                <tr>
                                  <td
                                    colSpan={5}
                                    className="py-6 text-center text-xs text-slate-400"
                                  >
                                    {isPolish ? 'Brak powiązanych elementów.' : 'No linked items.'}
                                  </td>
                                </tr>
                              ) : (
                                linkedItems.map((item) => (
                                  <tr key={item.id}>
                                    <td className="py-2 pr-2 text-slate-500 dark:text-slate-400 text-xs uppercase">
                                      {item.type}
                                    </td>
                                    <td className="py-2 pr-2 text-slate-700 dark:text-slate-300 max-w-[380px] truncate">
                                      {item.title}
                                    </td>
                                    <td className="py-2 pr-2 text-slate-500 dark:text-slate-400">
                                      {item.status || '—'}
                                    </td>
                                    <td className="py-2 pr-2 text-slate-500 dark:text-slate-400">
                                      {item.priority || '—'}
                                    </td>
                                    <td className="py-2 text-right">
                                      <button
                                        disabled={isDecisionStageLocked}
                                        onClick={() => handleRemoveLinkedItem(item.id)}
                                        className="p-1 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {clickupTab === 'logs' && (
                    <div className="bg-white/70 dark:bg-navy-900/70 rounded-2xl border border-slate-200/60 dark:border-navy-700/60 p-4 space-y-3">
                      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        {isPolish ? 'Logi aktywności' : 'Activity Log'}
                      </h3>
                      {activityLog.length === 0 ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400 py-2 text-center">
                          {isPolish ? 'Brak wpisów w logu.' : 'No activity entries yet.'}
                        </p>
                      ) : (
                        <div className="space-y-0 divide-y divide-slate-200/50 dark:divide-navy-700/50">
                          {activityLog.map((entry) => (
                            <div key={entry.id} className="py-2.5 flex items-start gap-2.5">
                              <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                                {entry.type === 'approved'
                                  ? '✓'
                                  : entry.type === 'rejected'
                                    ? '✕'
                                    : entry.type === 'escalated'
                                      ? '↑'
                                      : entry.type === 'deferred'
                                        ? '⏱'
                                        : entry.type === 'comment'
                                          ? '💬'
                                          : entry.type === 'assignment'
                                            ? '👤'
                                            : '•'}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm text-slate-700 dark:text-slate-300">
                                  {entry.description}
                                </p>
                                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                                  {new Date(entry.timestamp).toLocaleString()}
                                  {entry.userName ? ` · ${entry.userName}` : ''}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-4 lg:sticky lg:top-28 self-start">
                  {decisionId && isPending && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleApprove}
                        className="px-3 py-2 rounded-xl border border-emerald-400/50 text-emerald-500 hover:bg-emerald-500/10 text-sm font-medium"
                      >
                        {isPolish ? 'Zatwierdź' : 'Approve'}
                      </button>
                      <button
                        onClick={handleReject}
                        className="px-3 py-2 rounded-xl border border-red-400/50 text-red-500 hover:bg-red-500/10 text-sm font-medium"
                      >
                        {isPolish ? 'Odrzuć' : 'Reject'}
                      </button>
                      <button
                        onClick={handleRequestMoreInfo}
                        className="px-3 py-2 rounded-xl border border-slate-300 dark:border-navy-600 text-slate-500 text-sm"
                      >
                        {isPolish ? 'Więcej info' : 'Request info'}
                      </button>
                      <button
                        onClick={() => setShowDelegationModal(true)}
                        className="px-3 py-2 rounded-xl border border-slate-300 dark:border-navy-600 text-slate-500 text-sm"
                      >
                        {isPolish ? 'Deleguj' : 'Delegate'}
                      </button>
                    </div>
                  )}

                  <div className="bg-white/80 dark:bg-navy-900/80 rounded-2xl border border-slate-200/60 dark:border-navy-700/60 p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {isPolish ? 'Panel informacji' : 'Information pane'}
                    </h3>
                    <div className="space-y-2.5 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-400 dark:text-slate-500 text-xs uppercase tracking-wide">
                          {isPolish ? 'Status' : 'Status'}
                        </span>
                        <span className="text-slate-700 dark:text-slate-200 font-medium">
                          {isPolish
                            ? STATUS_CONFIG[status].label.pl
                            : STATUS_CONFIG[status].label.en}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-400 dark:text-slate-500 text-xs uppercase tracking-wide">
                          {isPolish ? 'Priorytet' : 'Priority'}
                        </span>
                        <span className="text-slate-700 dark:text-slate-200 font-medium">
                          {isPolish
                            ? PRIORITY_CONFIG[priority].label.pl
                            : PRIORITY_CONFIG[priority].label.en}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-400 dark:text-slate-500 text-xs uppercase tracking-wide">
                          {isPolish ? 'Termin' : 'Deadline'}
                        </span>
                        <span className="text-slate-700 dark:text-slate-200">{dueDate || '—'}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-400 dark:text-slate-500 text-xs uppercase tracking-wide">
                          {isPolish ? 'Wnioskodawca' : 'Requester'}
                        </span>
                        <span className="text-slate-700 dark:text-slate-200 text-right truncate">
                          {requesterName || '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-400 dark:text-slate-500 text-xs uppercase tracking-wide">
                          {isPolish ? 'Decydent' : 'Decider'}
                        </span>
                        <span className="text-slate-700 dark:text-slate-200 text-right truncate">
                          {(() => {
                            const decider = users.find((u) => u.id === deciderId);
                            return decider ? `${decider.firstName} ${decider.lastName}` : '—';
                          })()}
                        </span>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-slate-400 dark:text-slate-500 text-xs uppercase tracking-wide">
                          {isPolish ? 'Dotyczy' : 'Related to'}
                        </span>
                        <span className="text-slate-700 dark:text-slate-200 text-right max-w-[65%] break-words">
                          {decisionScopeLabel}
                        </span>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-slate-400 dark:text-slate-500 text-xs uppercase tracking-wide">
                          {isPolish ? 'Indeks decyzji' : 'Decision index'}
                        </span>
                        <span className="text-slate-700 dark:text-slate-200 text-right max-w-[65%] break-all text-xs font-mono">
                          {decisionIndexLabel}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
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
          onDelegated={async () => {
            try {
              // Reload decision to get updated data
              await loadDecision(decisionId);
              addActivityLogEntry(
                'assignment',
                isPolish ? 'Decyzja delegowana' : 'Decision delegated'
              );
            } catch (error) {
              console.error('[DecisionDetailView] Failed to reload after delegation:', error);
              toast.error(
                isPolish
                  ? 'Delegacja zapisana, ale nie udało się odświeżyć danych'
                  : 'Delegation saved, but failed to refresh data'
              );
            }
          }}
        />
      )}
    </div>
  );
};

export default DecisionDetailView;
