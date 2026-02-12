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
  Cloud,
  Clock,
  Edit3,
  Eye,
  FileText,
  Flag,
  FolderOpen,
  HardDrive,
  HelpCircle,
  History,
  Layers,
  Lightbulb,
  Loader2,
  ExternalLink,
  MessageSquare,
  Minus,
  MoreVertical,
  Plus,
  Save,
  Search,
  Settings,
  Share2,
  Sparkles,
  Star,
  Tag,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Upload,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { type SmartOpenConditions, useAccordionSections } from '@/hooks/useAccordionSections';
import { type CloudFile, type CloudProviderId, useCloudIntegrations } from '@/hooks/useCloudIntegrations';
import { usePresentationMode } from '@/hooks/usePresentationMode';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { ROUTES } from '@/routes/routeConfig';
import { useAppStore } from '@/store/useAppStore';
import { useConversationStore } from '@/store/useConversationStore';
import { AppView } from '@/types';
import { buildArtifactCode } from '@/utils/artifactLinks';

import { Api } from '../../services/api';
import { CloudFilePicker } from '../AIChat/CloudFilePicker';
import { DateFilterSortControl } from '../shared/DateFilterSortControl';
import { ArtifactPermalinkButton } from '../shared/ArtifactPermalinkButton';
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

type ConsequenceTimeline = {
  d7: string;
  d30: string;
  d90: string;
};

type ConsequenceScenarios = {
  updatedAt: string;
  source: 'ai' | 'fallback';
  pessimistic: ConsequenceTimeline;
  neutral: ConsequenceTimeline;
  optimistic: ConsequenceTimeline;
};

type CommentPriorityLevel = 'low' | 'normal' | 'high';
type CommentDateFilter = 'all' | 'today' | '7d' | '30d';
type LinkedItemFilter = 'all' | LinkedItem['type'];

type IntegrationChannel = 'slack' | 'teams' | 'webhook' | 'jira';
type CoreDeliveryChannel = 'in_app' | 'email';
type EscalationMode = 'notify_only' | 'manager_review' | 'executive_alert';

type DeliveryConfig = {
  coreChannels: CoreDeliveryChannel[];
  integrationChannels: IntegrationChannel[];
  syncTargets: string[];
};

type ReminderRuleWithDelivery = ReminderRule & {
  delivery?: DeliveryConfig;
};

type EscalationRuleWithConfig = EscalationRule & {
  warningDays: number;
  criticalDays: number;
  escalationMode: EscalationMode;
  delivery: DeliveryConfig;
};

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
      integrationChannels: ['teams'],
      syncTargets: ['msteams:ops-leadership'],
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
      integrationChannels: ['slack'],
      syncTargets: ['slack:#delivery-dbr77'],
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
      integrationChannels: [],
      syncTargets: [],
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
      integrationChannels: ['webhook'],
      syncTargets: ['webhook:governance-automation'],
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
  const { isChatCollapsed, toggleChatCollapse, currentProjectId } = useAppStore();
  const { updateWorkspaceFromView } = useConversationStore();
  const {
    connectedProviderIds,
    openFilePicker,
    isPickerOpen,
    activeProvider,
    closeFilePicker,
    selectFile,
    isImplemented: isCloudImplemented,
  } = useCloudIntegrations();
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
  const [contextDetails, setContextDetails] = useState('');

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
  const [reminders, setReminders] = useState<ReminderRuleWithDelivery[]>([]);
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
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isContextExpanded, setIsContextExpanded] = useState(false);
  const [aiFieldLoading, setAiFieldLoading] = useState<Record<string, boolean>>({});
  const [aiMenuOpenField, setAiMenuOpenField] = useState<string | null>(null);
  const [aiUndoByField, setAiUndoByField] = useState<Record<string, string>>({});
  const [altProsDraft, setAltProsDraft] = useState<Record<string, string>>({});
  const [altConsDraft, setAltConsDraft] = useState<Record<string, string>>({});
  const [isGeneratingAltProsCons, setIsGeneratingAltProsCons] = useState<Record<string, boolean>>({});
  const [consequenceScenarios, setConsequenceScenarios] = useState<ConsequenceScenarios | null>(null);
  const [isGeneratingConsequenceScenarios, setIsGeneratingConsequenceScenarios] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentDraftPriority, setCommentDraftPriority] = useState<CommentPriorityLevel>('normal');
  const [commentDateFilter, setCommentDateFilter] = useState<CommentDateFilter>('all');
  const [commentSortOrder, setCommentSortOrder] = useState<'asc' | 'desc'>('desc');
  const [attachmentDateFilter, setAttachmentDateFilter] = useState<CommentDateFilter>('all');
  const [attachmentSortOrder, setAttachmentSortOrder] = useState<'asc' | 'desc'>('desc');
  const [linkedItemFilter, setLinkedItemFilter] = useState<LinkedItemFilter>('all');
  const [linkedItemsSortOrder, setLinkedItemsSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isInternalLinkModalOpen, setIsInternalLinkModalOpen] = useState(false);
  const [isExternalLinkModalOpen, setIsExternalLinkModalOpen] = useState(false);
  const [linkSearchQuery, setLinkSearchQuery] = useState('');
  const [linkSearchResults, setLinkSearchResults] = useState<LinkedItem[]>([]);
  const [isLinkSearching, setIsLinkSearching] = useState(false);
  const [externalLinkTitle, setExternalLinkTitle] = useState('');
  const [externalLinkUrl, setExternalLinkUrl] = useState('');
  const [externalLinkComment, setExternalLinkComment] = useState('');
  const [editingLinkedItemKey, setEditingLinkedItemKey] = useState<string | null>(null);
  const [editingLinkedItemDraft, setEditingLinkedItemDraft] = useState<LinkedItem | null>(null);
  const [isAttachmentModalOpen, setIsAttachmentModalOpen] = useState(false);
  const [attachmentDiskFiles, setAttachmentDiskFiles] = useState<File[]>([]);
  const [attachmentSource, setAttachmentSource] = useState<'device' | 'cloud'>('device');
  const [selectedCloudProvider, setSelectedCloudProvider] = useState<CloudProviderId>('google-drive');
  const [editingAttachmentId, setEditingAttachmentId] = useState<string | null>(null);
  const [editingAttachmentDraft, setEditingAttachmentDraft] = useState<Attachment | null>(null);
  const [resourceMenuKey, setResourceMenuKey] = useState<string | null>(null);
  const attachmentsSectionRef = useRef<HTMLDivElement | null>(null);
  const externalLinksSectionRef = useRef<HTMLDivElement | null>(null);
  const internalLinksSectionRef = useRef<HTMLDivElement | null>(null);
  const [isEnhancingCommentDraft, setIsEnhancingCommentDraft] = useState(false);
  const [hoveredCommentPriority, setHoveredCommentPriority] = useState<CommentPriorityLevel | null>(null);
  const [clickupTab, setClickupTab] = useState<
    'overview' | 'resources' | 'risk' | 'options' | 'governance' | 'comments' | 'logs'
  >('overview');
  const [isLocalHydrated, setIsLocalHydrated] = useState(false);
  const [lastPublishedSnapshot, setLastPublishedSnapshot] = useState('');
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<string | null>(null);
  const [editingStakeholderId, setEditingStakeholderId] = useState<string | null>(null);
  const [stakeholderDraft, setStakeholderDraft] = useState<Stakeholder | null>(null);
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);
  const [reminderDraft, setReminderDraft] = useState<ReminderRuleWithDelivery | null>(null);
  const [editingEscalationId, setEditingEscalationId] = useState<string | null>(null);
  const [escalationDraft, setEscalationDraft] = useState<EscalationRuleWithConfig | null>(null);
  const [escalationRules, setEscalationRules] = useState<EscalationRuleWithConfig[]>([]);
  const [isSuggestingStakeholders, setIsSuggestingStakeholders] = useState(false);
  const [isSuggestingReminders, setIsSuggestingReminders] = useState(false);
  const [isSuggestingEscalations, setIsSuggestingEscalations] = useState(false);

  const governanceModalClass =
    'relative w-full max-w-2xl rounded-3xl border border-slate-200/50 dark:border-navy-700/50 bg-white/95 dark:bg-navy-900/95 shadow-2xl p-6 space-y-5';
  const governanceTableCardClass =
    'bg-white/70 dark:bg-navy-900/70 rounded-2xl border border-slate-200/60 dark:border-navy-700/60 p-4 space-y-3 h-[340px] flex flex-col';
  const governanceModalHintClass =
    'rounded-xl border border-slate-200/70 dark:border-navy-700/60 bg-slate-50/70 dark:bg-navy-800/50 px-3 py-2 text-xs text-slate-600 dark:text-slate-300';
  const channelChipClass =
    'px-2 py-1 rounded-md border text-[11px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

  const integrationChannelCatalog: Array<{
    key: IntegrationChannel;
    label: string;
    scope: 'notification' | 'work-management' | 'custom';
  }> = [
    { key: 'slack', label: 'Slack', scope: 'notification' },
    { key: 'teams', label: 'Teams', scope: 'notification' },
    { key: 'jira', label: 'Jira', scope: 'work-management' },
    { key: 'webhook', label: 'Webhook', scope: 'custom' },
  ];

  const escalationModeOptions: Array<{ value: EscalationMode; label: string }> = [
    { value: 'notify_only', label: isPolish ? 'Powiadomienie tylko' : 'Notify only' },
    { value: 'manager_review', label: isPolish ? 'Przegląd managera' : 'Manager review' },
    { value: 'executive_alert', label: isPolish ? 'Alert executive' : 'Executive alert' },
  ];
  const cloudProviderCatalog: Array<{ id: CloudProviderId; name: string; colorClass: string }> = [
    { id: 'google-drive', name: 'Google Drive', colorClass: 'text-emerald-400' },
    { id: 'onedrive', name: 'OneDrive', colorClass: 'text-blue-400' },
    { id: 'dropbox', name: 'Dropbox', colorClass: 'text-sky-400' },
  ];

  const fallbackDeliveryFromReminder = (rule: ReminderRule): DeliveryConfig => ({
    coreChannels: [
      ...(rule.inAppNotification ? (['in_app'] as CoreDeliveryChannel[]) : []),
      ...(rule.emailNotification ? (['email'] as CoreDeliveryChannel[]) : []),
    ],
    integrationChannels: [],
    syncTargets: [],
  });

  const deliveryBadgeLabels = (delivery?: DeliveryConfig, fallback?: ReminderRule) => {
    const source =
      delivery ||
      (fallback
        ? fallbackDeliveryFromReminder(fallback)
        : { coreChannels: [], integrationChannels: [], syncTargets: [] });
    const labels: string[] = [];
    if (source.coreChannels.includes('in_app')) labels.push('In-app');
    if (source.coreChannels.includes('email')) labels.push('Email');
    source.integrationChannels.forEach((channel) => {
      const found = integrationChannelCatalog.find((c) => c.key === channel);
      labels.push(found?.label || channel);
    });
    if (labels.length === 0) labels.push(isPolish ? 'Brak kanałów' : 'No channels');
    return labels;
  };

  const ensureDeliveryConfig = (
    source?: Partial<DeliveryConfig> | null,
    fallback?: ReminderRule
  ): DeliveryConfig => {
    const backup = fallback ? fallbackDeliveryFromReminder(fallback) : undefined;
    return {
      coreChannels:
        source?.coreChannels && source.coreChannels.length > 0
          ? source.coreChannels.filter((c): c is CoreDeliveryChannel => c === 'in_app' || c === 'email')
          : backup?.coreChannels || ['in_app'],
      integrationChannels: (source?.integrationChannels || []).filter((c): c is IntegrationChannel =>
        integrationChannelCatalog.some((entry) => entry.key === c)
      ),
      syncTargets: Array.isArray(source?.syncTargets)
        ? source.syncTargets.map((item) => String(item).trim()).filter(Boolean)
        : [],
    };
  };

  const normalizeReminderRule = (rule: ReminderRuleWithDelivery): ReminderRuleWithDelivery => {
    const delivery = ensureDeliveryConfig(rule.delivery, rule);
    return {
      ...rule,
      inAppNotification: delivery.coreChannels.includes('in_app'),
      emailNotification: delivery.coreChannels.includes('email'),
      delivery,
    };
  };

  const normalizeEscalationRule = (rule: Partial<EscalationRuleWithConfig>): EscalationRuleWithConfig => ({
    id: String(rule.id || Math.random().toString(36).slice(2, 11)),
    enabled: rule.enabled !== false,
    escalateTo: String(rule.escalateTo || ''),
    escalateToName: rule.escalateToName ? String(rule.escalateToName) : '',
    afterDays: Math.max(1, Number(rule.afterDays ?? 3)),
    warningDays: Math.max(0, Number(rule.warningDays ?? 3)),
    criticalDays: Math.max(0, Number(rule.criticalDays ?? 1)),
    escalationMode: (['notify_only', 'manager_review', 'executive_alert'] as EscalationMode[]).includes(
      rule.escalationMode as EscalationMode
    )
      ? (rule.escalationMode as EscalationMode)
      : 'notify_only',
    message: String(rule.message || ''),
    delivery: ensureDeliveryConfig(rule.delivery || null),
  });

  const toggleChannel = <T extends string>(list: T[], key: T, enabled: boolean): T[] => {
    if (enabled) return list.includes(key) ? list : [...list, key];
    return list.filter((entry) => entry !== key);
  };

  const stakeholderRoleLabel = (role: StakeholderRole) => {
    if (role === 'responsible') return isPolish ? 'Odpowiedzialny' : 'Responsible';
    if (role === 'accountable') return isPolish ? 'Rozliczany' : 'Accountable';
    if (role === 'consulted') return isPolish ? 'Konsultowany' : 'Consulted';
    return isPolish ? 'Informowany' : 'Informed';
  };
  const stakeholderChannelLabels = (settings?: StakeholderNotificationSettings) => {
    if (!settings?.enabled) return [isPolish ? 'Wyłączone' : 'Disabled'];
    const labels: string[] = [];
    if (settings.inAppEnabled) labels.push('In-app');
    if (settings.emailEnabled) labels.push('Email');
    const integrations = settings.integrationChannels || [];
    if (integrations.includes('slack')) labels.push('Slack');
    if (integrations.includes('teams')) labels.push('Teams');
    if (integrations.includes('jira')) labels.push('Jira');
    if (integrations.includes('webhook')) labels.push('Webhook');
    return labels.length > 0 ? labels : [isPolish ? 'Brak kanałów' : 'No channels'];
  };

  useEffect(() => {
    if (escalationRules.length === 0) {
      setEscalation(null);
      return;
    }
    const first = escalationRules[0];
    setEscalation({
      id: first.id,
      enabled: first.enabled,
      escalateTo: first.escalateTo,
      escalateToName: first.escalateToName,
      afterDays: first.afterDays,
      message: first.message,
    });
    setThresholds((prev) => ({
      ...prev,
      warningDays: first.warningDays,
      criticalDays: first.criticalDays,
    }));
  }, [escalationRules]);

  const notionSections = useMemo(
    () => [
      {
        id: 'context-problem',
        label: isPolish ? 'Zakres decyzji' : 'Decision Scope',
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
        id: 'consequences',
        label: isPolish ? 'Konsekwencje' : 'Consequences',
        icon: Clock,
      },
      {
        id: 'governance-escalation',
        label: isPolish ? 'RACI i eskalacja' : 'RACI & Escalation',
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

  const publishPayload = useMemo(
    () => ({
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
    }),
    [
      title,
      description,
      status,
      priority,
      category,
      dueDate,
      rationale,
      deciderId,
      alternatives,
      selectedAlternativeId,
      impact,
    ]
  );

  const draftState = useMemo(
    () => ({
      ...publishPayload,
      requesterName,
      stakeholders,
      linkedItems,
      comments,
      attachments,
      risks,
      reminders,
      escalation,
      escalationRules,
      thresholds,
      contextDetails,
      tags,
      consequenceScenarios,
    }),
    [
      publishPayload,
      requesterName,
      stakeholders,
      linkedItems,
      comments,
      attachments,
      risks,
      reminders,
      escalation,
      escalationRules,
      thresholds,
      contextDetails,
      tags,
      consequenceScenarios,
    ]
  );

  const draftSnapshot = useMemo(() => JSON.stringify(draftState), [draftState]);
  const hasPublishBaseline = lastPublishedSnapshot.length > 0;
  const isDirty = hasPublishBaseline && draftSnapshot !== lastPublishedSnapshot;
  const draftSavedLabel = useMemo(() => {
    if (!lastDraftSavedAt) return null;
    const time = new Date(lastDraftSavedAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    return isPolish ? `Szkic autozapisany ${time}` : `Draft autosaved ${time}`;
  }, [lastDraftSavedAt, isPolish]);

  const persistDraft = (source: 'autosave' | 'chat' | 'publish') => {
    const draftKey = `consultinity-decision-draft:${decisionId || 'new'}`;
    const savedAt = new Date().toISOString();
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          schemaVersion: 1,
          source,
          savedAt,
          decisionId: decisionId || null,
          draft: draftState,
        })
      );
      setLastDraftSavedAt(savedAt);
    } catch (e) {
      console.warn(`[DecisionDetailView] Failed to persist local draft (${source})`, e);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    setLastPublishedSnapshot('');
    setLastDraftSavedAt(null);
  }, [decisionId]);

  useEffect(() => {
    if (!isLocalHydrated || hasPublishBaseline) return;
    setLastPublishedSnapshot(draftSnapshot);
  }, [isLocalHydrated, hasPublishBaseline, draftSnapshot]);

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

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-ai-menu-root="true"]')) {
        setAiMenuOpenField(null);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
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

  const activityLogSorted = useMemo(
    () =>
      [...activityLog].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ),
    [activityLog]
  );

  const activityStats = useMemo(() => {
    const edited = activityLog.filter((entry) =>
      ['edit', 'assignment', 'status_change', 'priority', 'deadline'].includes(entry.type)
    ).length;
    const escalations = activityLog.filter((entry) =>
      ['escalated', 'deferred'].includes(entry.type)
    ).length;
    const collaboration = activityLog.filter((entry) => entry.type === 'comment').length;
    return { total: activityLog.length, edited, escalations, collaboration };
  }, [activityLog]);

  const activityTypeMeta = (type: ActivityLogEntry['type']) => {
    if (type === 'approved')
      return {
        icon: <Check size={12} />,
        label: isPolish ? 'Zatwierdzenie' : 'Approval',
        style: 'text-emerald-500 bg-emerald-500/10 border-emerald-400/30',
      };
    if (type === 'rejected')
      return {
        icon: <X size={12} />,
        label: isPolish ? 'Odrzucenie' : 'Rejection',
        style: 'text-red-500 bg-red-500/10 border-red-400/30',
      };
    if (type === 'escalated')
      return {
        icon: <ArrowUp size={12} />,
        label: isPolish ? 'Eskalacja' : 'Escalation',
        style: 'text-amber-500 bg-amber-500/10 border-amber-400/30',
      };
    if (type === 'deferred')
      return {
        icon: <Clock size={12} />,
        label: isPolish ? 'Odroczenie' : 'Deferral',
        style: 'text-slate-500 bg-slate-500/10 border-slate-400/30',
      };
    if (type === 'assignment')
      return {
        icon: <UserCheck size={12} />,
        label: isPolish ? 'Przypisanie' : 'Assignment',
        style: 'text-sky-500 bg-sky-500/10 border-sky-400/30',
      };
    if (type === 'comment')
      return {
        icon: <MessageSquare size={12} />,
        label: isPolish ? 'Komentarz' : 'Comment',
        style: 'text-indigo-500 bg-indigo-500/10 border-indigo-400/30',
      };
    if (type === 'deadline')
      return {
        icon: <Calendar size={12} />,
        label: isPolish ? 'Termin' : 'Deadline',
        style: 'text-rose-500 bg-rose-500/10 border-rose-400/30',
      };
    if (type === 'priority' || type === 'status_change')
      return {
        icon: <Flag size={12} />,
        label: isPolish ? 'Zmiana statusu' : 'Status change',
        style: 'text-violet-500 bg-violet-500/10 border-violet-400/30',
      };
    if (type === 'edit')
      return {
        icon: <Edit3 size={12} />,
        label: isPolish ? 'Edycja' : 'Edit',
        style: 'text-cyan-500 bg-cyan-500/10 border-cyan-400/30',
      };
    return {
      icon: <Plus size={12} />,
      label: isPolish ? 'Utworzenie' : 'Created',
      style: 'text-slate-500 bg-slate-500/10 border-slate-400/30',
    };
  };

  const renderActivityLogPanel = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <div className="rounded-xl border border-slate-200/60 dark:border-navy-700/60 bg-white/70 dark:bg-navy-900/70 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {isPolish ? 'Wpisy' : 'Entries'}
          </p>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {activityStats.total}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200/60 dark:border-navy-700/60 bg-white/70 dark:bg-navy-900/70 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {isPolish ? 'Zmiany' : 'Changes'}
          </p>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {activityStats.edited}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200/60 dark:border-navy-700/60 bg-white/70 dark:bg-navy-900/70 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {isPolish ? 'Eskalacje' : 'Escalations'}
          </p>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {activityStats.escalations}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200/60 dark:border-navy-700/60 bg-white/70 dark:bg-navy-900/70 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {isPolish ? 'Współpraca' : 'Collaboration'}
          </p>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {activityStats.collaboration}
          </p>
        </div>
      </div>

      {activityLogSorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300/60 dark:border-navy-700/70 bg-white/40 dark:bg-navy-900/40 p-6 text-center text-xs text-slate-400 dark:text-slate-500">
          {isPolish ? 'Brak wpisów w logu.' : 'No activity entries yet.'}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200/60 dark:border-navy-700/60 bg-white/70 dark:bg-navy-900/70 p-3">
          <div className="space-y-1">
            {activityLogSorted.map((entry) => {
              const meta = activityTypeMeta(entry.type);
              return (
                <div
                  key={entry.id}
                  className="grid grid-cols-[auto_1fr_auto] gap-3 items-start py-2.5 px-2 rounded-xl hover:bg-slate-50/70 dark:hover:bg-navy-800/40 transition-colors"
                >
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-lg border ${meta.style}`}
                  >
                    {meta.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm text-slate-700 dark:text-slate-200">{entry.description}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
                      <span>{new Date(entry.timestamp).toLocaleString()}</span>
                      {entry.userName && <span>{`· ${entry.userName}`}</span>}
                      <span className="px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-navy-700/60">
                        {meta.label}
                      </span>
                    </div>
                    {(entry.oldValue || entry.newValue) && (
                      <div className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                        {entry.oldValue ? `${isPolish ? 'Było' : 'From'}: ${entry.oldValue}` : ''}
                        {entry.oldValue && entry.newValue ? '  ->  ' : ''}
                        {entry.newValue ? `${isPolish ? 'Jest' : 'To'}: ${entry.newValue}` : ''}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] font-mono uppercase tracking-wide text-slate-300 dark:text-slate-600">
                    {entry.type}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

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
    setContextDetails('');
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
      setContextDetails(decision.contextDetails || decision.context || '');
      setDecisionDate(decision.decisionDate || '');
      setCreatedAt(decision.createdAt || '');
      setUpdatedAt(decision.updatedAt || '');
      // Use API data or fallback to demo data for rich UI testing
      const apiAlternatives = decision.alternatives || [];
      setAlternatives(withProsConsFallback(apiAlternatives.length > 0 ? apiAlternatives : DEMO_ALTERNATIVES));
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
      const loadedReminders = (apiReminders.length > 0 ? apiReminders : DEMO_REMINDERS).map(
        (rule: ReminderRuleWithDelivery) => normalizeReminderRule(rule)
      );
      setReminders(loadedReminders);
      const loadedEscalation = decision.escalation || DEMO_ESCALATION;
      setEscalation(loadedEscalation);
      setEscalationRules([
        normalizeEscalationRule({
          ...loadedEscalation,
          warningDays: thresholds.warningDays,
          criticalDays: thresholds.criticalDays,
        }),
      ]);

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
            setAlternatives(withProsConsFallback(local.alternatives));
          if (Array.isArray(local.reminders) && local.reminders.length > 0)
            setReminders(local.reminders.map((rule: ReminderRuleWithDelivery) => normalizeReminderRule(rule)));
          if (local.escalation) setEscalation(local.escalation);
          if (Array.isArray(local.escalationRules) && local.escalationRules.length > 0) {
            setEscalationRules(
              local.escalationRules.map((rule: EscalationRuleWithConfig) => normalizeEscalationRule(rule))
            );
          }
          if (typeof local.rationale === 'string' && local.rationale.trim())
            setRationale(local.rationale);
          if (typeof local.description === 'string' && local.description.trim())
            setDescription(local.description);
          if (typeof local.contextDetails === 'string') setContextDetails(local.contextDetails);
          if (local.consequenceScenarios) setConsequenceScenarios(local.consequenceScenarios);
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
          escalationRules,
          rationale,
          description,
          contextDetails,
          consequenceScenarios,
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
    escalationRules,
    rationale,
    description,
    contextDetails,
    consequenceScenarios,
  ]);

  // Lightweight autosave to local draft while editing; explicit Save remains publish.
  useEffect(() => {
    if (!isLocalHydrated || !hasPublishBaseline || !isDirty) return;
    const timer = setTimeout(() => {
      persistDraft('autosave');
    }, 900);
    return () => clearTimeout(timer);
  }, [isLocalHydrated, hasPublishBaseline, isDirty, draftSnapshot]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error(isPolish ? 'Tytuł jest wymagany' : 'Title is required');
      return;
    }
    if (!isDirty) {
      return;
    }

    try {
      setSaving(true);
      const payload = publishPayload;

      if (decisionId) {
        await Api.updateDecision(decisionId, payload);
        toast.success(isPolish ? 'Decyzja zaktualizowana' : 'Decision updated');
      } else {
        await Api.createDecision(payload);
        toast.success(isPolish ? 'Decyzja utworzona' : 'Decision created');
      }
      setLastPublishedSnapshot(draftSnapshot);
      persistDraft('publish');
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
    persistDraft('chat');

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
    if (isDecisionStageLocked) {
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
    if (isDecisionStageLocked) return;
    setAlternatives(alternatives.map((a) => (a.id === id ? { ...a, ...updates } : a)));
  };

  const updateAlternativePro = (id: string, index: number, value: string) => {
    if (isDecisionStageLocked) return;
    setAlternatives((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              pros: (a.pros || []).map((p, i) => (i === index ? value : p)),
            }
          : a
      )
    );
  };

  const updateAlternativeCon = (id: string, index: number, value: string) => {
    if (isDecisionStageLocked) return;
    setAlternatives((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              cons: (a.cons || []).map((c, i) => (i === index ? value : c)),
            }
          : a
      )
    );
  };

  const addAlternativePro = (id: string, value: string) => {
    if (isDecisionStageLocked) return;
    const clean = value.trim();
    if (!clean) return;
    setAlternatives((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              pros: [...(a.pros || []), clean],
            }
          : a
      )
    );
    setAltProsDraft((prev) => ({ ...prev, [id]: '' }));
  };

  const addAlternativeCon = (id: string, value: string) => {
    if (isDecisionStageLocked) return;
    const clean = value.trim();
    if (!clean) return;
    setAlternatives((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              cons: [...(a.cons || []), clean],
            }
          : a
      )
    );
    setAltConsDraft((prev) => ({ ...prev, [id]: '' }));
  };

  const removeAlternativePro = (id: string, index: number) => {
    if (isDecisionStageLocked) return;
    setAlternatives((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              pros: (a.pros || []).filter((_, i) => i !== index),
            }
          : a
      )
    );
  };

  const removeAlternativeCon = (id: string, index: number) => {
    if (isDecisionStageLocked) return;
    setAlternatives((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              cons: (a.cons || []).filter((_, i) => i !== index),
            }
          : a
      )
    );
  };

  const generateProsConsForAlternative = async (alt: Alternative) => {
    if (isDecisionStageLocked) return;
    setIsGeneratingAltProsCons((prev) => ({ ...prev, [alt.id]: true }));
    try {
      const prompt = isPolish
        ? `Dla opcji decyzyjnej wygeneruj 3 konkretne "za" i 3 konkretne "przeciw". Zwróć wyłącznie JSON: {"pros":["..."],"cons":["..."]}.\n\nTytuł opcji: ${alt.title || '-'}\nOpis: ${alt.description || '-'}\nKontekst decyzji: ${title || '-'}`
        : `For this decision option, generate 3 concrete pros and 3 concrete cons. Return JSON only: {"pros":["..."],"cons":["..."]}.\n\nOption title: ${alt.title || '-'}\nDescription: ${alt.description || '-'}\nDecision context: ${title || '-'}`;

      let nextPros: string[] = [];
      let nextCons: string[] = [];

      try {
        const aiRes = await Api.post('/ai/chat', {
          message: prompt,
          history: [],
          systemInstruction: isPolish
            ? 'Jesteś asystentem PMO. Zwróć tylko poprawny JSON bez markdown.'
            : 'You are a PMO assistant. Return valid JSON only, no markdown.',
          roleName: 'Decision Option Analyzer',
        });
        const rawText = String(aiRes?.text || aiRes?.content || '').trim();
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(rawText);
        nextPros = Array.isArray(parsed?.pros) ? parsed.pros.map((p: any) => String(p).trim()) : [];
        nextCons = Array.isArray(parsed?.cons) ? parsed.cons.map((c: any) => String(c).trim()) : [];
      } catch {
        nextPros = isPolish
          ? ['Krótszy czas wdrożenia', 'Lepsza skalowalność', 'Wyższa przewidywalność efektu']
          : ['Shorter implementation time', 'Better scalability', 'Higher outcome predictability'];
        nextCons = isPolish
          ? ['Wyższy koszt początkowy', 'Wymaga kompetencji zespołu', 'Ryzyko integracyjne']
          : ['Higher initial cost', 'Requires team capability', 'Integration risk'];
      }

      setAlternatives((prev) =>
        prev.map((a) =>
          a.id === alt.id
            ? {
                ...a,
                pros: Array.from(new Set([...(a.pros || []), ...nextPros.filter(Boolean)])).slice(
                  0,
                  8
                ),
                cons: Array.from(new Set([...(a.cons || []), ...nextCons.filter(Boolean)])).slice(
                  0,
                  8
                ),
              }
            : a
        )
      );
      toast.success(
        isPolish ? 'AI dodało propozycje za i przeciw' : 'AI added suggested pros and cons'
      );
    } finally {
      setIsGeneratingAltProsCons((prev) => ({ ...prev, [alt.id]: false }));
    }
  };

  const removeAlternative = (id: string) => {
    if (isDecisionStageLocked) return;
    setAlternatives(alternatives.filter((a) => a.id !== id));
    if (selectedAlternativeId === id) {
      setSelectedAlternativeId('');
    }
  };

  const setRecommendedAlternative = (id: string) => {
    if (isDecisionStageLocked) return;
    setAlternatives(
      alternatives.map((a) => ({
        ...a,
        isRecommended: a.id === id,
      }))
    );
  };

  // Risk handlers
  const addRisk = () => {
    if (isDecisionStageLocked) {
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
    if (isDecisionStageLocked) return;
    setRisks(risks.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };

  const removeRisk = (id: string) => {
    if (isDecisionStageLocked) return;
    setRisks(risks.filter((r) => r.id !== id));
  };

  // AI Generation handlers
  const generateAlternativesAI = async () => {
    if (isDecisionStageLocked) {
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

      setAlternatives(withProsConsFallback([...alternatives, ...generatedAlternatives]));
      toast.success(isPolish ? 'Wygenerowano alternatywy' : 'Alternatives generated');
    } catch (error) {
      toast.error(isPolish ? 'Błąd generowania' : 'Generation failed');
    } finally {
      setIsGeneratingAlternatives(false);
    }
  };

  const generateDescriptionAI = async () => {
    if (isDecisionStageLocked) {
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
    if (isDecisionStageLocked) {
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

  const suggestStakeholdersAI = async () => {
    if (isDecisionStageLocked || users.length === 0) return;
    setIsSuggestingStakeholders(true);
    try {
      let projectMemberIds: string[] = [];
      if (currentProjectId) {
        try {
          const project = await Api.get(`/projects/${currentProjectId}`);
          const pools = [
            project?.members,
            project?.teamMembers,
            project?.users,
            project?.participants,
          ].filter(Array.isArray) as any[][];
          projectMemberIds = pools
            .flatMap((arr) =>
              arr
                .map((m) => String(m?.userId || m?.id || m?.memberId || '').trim())
                .filter(Boolean)
            )
            .filter((id, idx, arr) => arr.indexOf(id) === idx);
        } catch {
          // Best-effort only; fallback to org users list.
        }
      }

      const candidateUsers =
        projectMemberIds.length > 0
          ? users.filter((u) => projectMemberIds.includes(u.id))
          : users;
      const roster = candidateUsers
        .slice(0, 120)
        .map((u) => `${u.id} | ${u.firstName} ${u.lastName} | ${u.email || '-'}`)
        .join('\n');

      const prompt = isPolish
        ? `Na podstawie danych decyzji zaproponuj skład RACI. Zwróć WYŁĄCZNIE JSON:
{"stakeholders":[{"userId":"...","role":"accountable|responsible|consulted|informed","reason":"..."}]}
Wymagania:
- Dokładnie 1 osoba accountable
- 1-2 osoby responsible
- 1-3 osoby consulted/informed
- Użyj TYLKO userId z listy użytkowników

Decyzja:
- Tytuł: ${title || '-'}
- Opis: ${description || '-'}
- Kategoria: ${category}
- Priorytet: ${priority}
- Termin: ${dueDate || '-'}
- Requester: ${requesterName || '-'}
- Aktualny deciderId: ${deciderId || '-'}

Użytkownicy (preferuj członków projektu):
${roster}`
        : `Based on decision data, propose a RACI team. Return JSON ONLY:
{"stakeholders":[{"userId":"...","role":"accountable|responsible|consulted|informed","reason":"..."}]}
Requirements:
- Exactly 1 accountable
- 1-2 responsible
- 1-3 consulted/informed
- Use ONLY userId from the provided user list

Decision:
- Title: ${title || '-'}
- Description: ${description || '-'}
- Category: ${category}
- Priority: ${priority}
- Due date: ${dueDate || '-'}
- Requester: ${requesterName || '-'}
- Current deciderId: ${deciderId || '-'}

Users (prefer project members):
${roster}`;

      const aiRes = await Api.post('/ai/chat', {
        message: prompt,
        history: [],
        systemInstruction: isPolish
          ? 'Jesteś asystentem PMO. Zwróć tylko poprawny JSON bez markdown.'
          : 'You are a PMO assistant. Return valid JSON only, no markdown.',
        roleName: 'RACI Team Advisor',
      });

      const raw = String(aiRes?.text || aiRes?.content || '').trim();
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
      const aiList = Array.isArray(parsed?.stakeholders) ? parsed.stakeholders : [];

      const next: Stakeholder[] = aiList
        .map((item: any, idx: number) => {
          const userId = String(item?.userId || '').trim();
          const user = users.find((u) => u.id === userId);
          if (!user) return null;
          const role = String(item?.role || '').trim() as StakeholderRole;
          if (!['accountable', 'responsible', 'consulted', 'informed'].includes(role)) return null;
          return {
            id: `ai-stk-${Date.now()}-${idx}`,
            decisionId: decisionId || 'new',
            userId: user.id,
            userName: `${user.firstName} ${user.lastName}`,
            userEmail: user.email,
            role,
            notificationSettings: {
              enabled: true,
              triggers: ['on_status_change'],
              emailEnabled: role === 'accountable',
              inAppEnabled: true,
              integrationChannels: [],
              syncTargets: [],
            },
          } as Stakeholder;
        })
        .filter(Boolean) as Stakeholder[];

      if (next.length === 0) {
        throw new Error('No valid AI stakeholder suggestions');
      }

      // Replace list (not append): user asked for proposal that can be adjusted manually.
      setStakeholders(next);
      toast.success(
        isPolish
          ? `AI zaproponowało i zastosowało skład RACI (${next.length} osób).`
          : `AI proposed and applied a RACI team (${next.length} people).`
      );
    } catch (e) {
      console.error('Failed to suggest stakeholders via AI', e);
      toast.error(
        isPolish
          ? 'Nie udało się wygenerować składu RACI przez AI'
          : 'Failed to generate AI RACI suggestions'
      );
    } finally {
      setIsSuggestingStakeholders(false);
    }
  };

  const suggestRemindersAI = async () => {
    if (isDecisionStageLocked) return;
    setIsSuggestingReminders(true);
    try {
      const prompt = isPolish
        ? `Zaproponuj przypomnienia dla decyzji. Zwróć WYŁĄCZNIE JSON:
{"reminders":[{"type":"before_due|after_due","days":2,"recipients":"requester|decider|both|stakeholders","inAppNotification":true,"emailNotification":false,"message":"...","enabled":true}]}
Uwzględnij priorytet ${priority}, termin ${dueDate || '-'} i status ${status}.`
        : `Propose decision reminders. Return JSON ONLY:
{"reminders":[{"type":"before_due|after_due","days":2,"recipients":"requester|decider|both|stakeholders","inAppNotification":true,"emailNotification":false,"message":"...","enabled":true}]}
Consider priority ${priority}, due date ${dueDate || '-'} and status ${status}.`;
      const aiRes = await Api.post('/ai/chat', {
        message: prompt,
        history: [],
        systemInstruction: isPolish
          ? 'Jesteś asystentem PMO. Zwróć tylko poprawny JSON bez markdown.'
          : 'You are a PMO assistant. Return valid JSON only, no markdown.',
        roleName: 'Reminder Rules Advisor',
      });
      const raw = String(aiRes?.text || aiRes?.content || '').trim();
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
      const next = (Array.isArray(parsed?.reminders) ? parsed.reminders : [])
        .map((r: any, idx: number) => ({
          id: `ai-rem-${Date.now()}-${idx}`,
          type: r?.type === 'after_due' ? 'after_due' : 'before_due',
          days: Math.max(0, Number(r?.days ?? 0)),
          recipients: ['requester', 'decider', 'both', 'stakeholders'].includes(r?.recipients)
            ? r.recipients
            : 'both',
          inAppNotification: r?.inAppNotification !== false,
          emailNotification: !!r?.emailNotification,
          delivery: ensureDeliveryConfig({
            coreChannels: [
              ...(r?.inAppNotification !== false ? (['in_app'] as CoreDeliveryChannel[]) : []),
              ...(r?.emailNotification ? (['email'] as CoreDeliveryChannel[]) : []),
            ],
            integrationChannels: Array.isArray(r?.integrationChannels)
              ? r.integrationChannels
              : Array.isArray(r?.delivery?.integrationChannels)
                ? r.delivery.integrationChannels
                : [],
            syncTargets: Array.isArray(r?.syncTargets)
              ? r.syncTargets
              : Array.isArray(r?.delivery?.syncTargets)
                ? r.delivery.syncTargets
                : [],
          }),
          message: String(r?.message || ''),
          enabled: r?.enabled !== false,
        }))
        .slice(0, 6);
      if (next.length === 0) throw new Error('No reminders returned');
      setReminders(next.map((rule: ReminderRuleWithDelivery) => normalizeReminderRule(rule)));
      toast.success(
        isPolish
          ? `AI zaproponowało i zastosowało reminders (${next.length}).`
          : `AI suggested and applied reminders (${next.length}).`
      );
    } catch (e) {
      console.error('Failed to suggest reminders via AI', e);
      const fallback: ReminderRuleWithDelivery[] = [
        {
          id: `rem-fb-${Date.now()}-1`,
          type: 'before_due',
          days: 3,
          recipients: 'both',
          inAppNotification: true,
          emailNotification: true,
          delivery: ensureDeliveryConfig({ coreChannels: ['in_app', 'email'] }),
          message: isPolish ? 'Termin decyzji za 3 dni.' : 'Decision due in 3 days.',
          enabled: true,
        },
        {
          id: `rem-fb-${Date.now()}-2`,
          type: 'after_due',
          days: 1,
          recipients: 'stakeholders',
          inAppNotification: true,
          emailNotification: false,
          delivery: ensureDeliveryConfig({ coreChannels: ['in_app'] }),
          message: isPolish ? 'Decyzja po terminie - wymaga reakcji.' : 'Decision overdue - action needed.',
          enabled: true,
        },
      ];
      setReminders(fallback.map((rule: ReminderRuleWithDelivery) => normalizeReminderRule(rule)));
      toast.success(
        isPolish ? 'Zastosowano domyślne reminders.' : 'Applied fallback reminder suggestions.'
      );
    } finally {
      setIsSuggestingReminders(false);
    }
  };

  const suggestEscalationsAI = async () => {
    if (isDecisionStageLocked) return;
    setIsSuggestingEscalations(true);
    try {
      const userList = users
        .slice(0, 80)
        .map((u) => `${u.id}|${u.firstName} ${u.lastName}`)
        .join('\n');
      const prompt = isPolish
        ? `Zaproponuj 1-3 reguły eskalacji dla decyzji. Zwróć WYŁĄCZNIE JSON:
{"rules":[{"afterDays":5,"warningDays":3,"criticalDays":1,"escalateToUserId":"...","message":"...","enabled":true}]}
Użyj userId wyłącznie z listy użytkowników:
${userList}`
        : `Propose 1-3 escalation rules for this decision. Return JSON ONLY:
{"rules":[{"afterDays":5,"warningDays":3,"criticalDays":1,"escalateToUserId":"...","message":"...","enabled":true}]}
Use userId only from users list:
${userList}`;
      const aiRes = await Api.post('/ai/chat', {
        message: prompt,
        history: [],
        systemInstruction: isPolish
          ? 'Jesteś asystentem PMO. Zwróć tylko poprawny JSON bez markdown.'
          : 'You are a PMO assistant. Return valid JSON only, no markdown.',
        roleName: 'Escalation Rules Advisor',
      });
      const raw = String(aiRes?.text || aiRes?.content || '').trim();
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
      const next = (Array.isArray(parsed?.rules) ? parsed.rules : [])
        .map((r: any, idx: number) => {
          const selected = users.find((u) => u.id === r?.escalateToUserId) || users[0];
          if (!selected) return null;
          return normalizeEscalationRule({
            id: `ai-esc-${Date.now()}-${idx}`,
            enabled: r?.enabled !== false,
            escalateTo: selected.id,
            escalateToName: `${selected.firstName} ${selected.lastName}`,
            afterDays: Math.max(1, Number(r?.afterDays ?? 3)),
            warningDays: Math.max(0, Number(r?.warningDays ?? 3)),
            criticalDays: Math.max(0, Number(r?.criticalDays ?? 1)),
            escalationMode: (['notify_only', 'manager_review', 'executive_alert'] as EscalationMode[]).includes(
              r?.escalationMode
            )
              ? r.escalationMode
              : 'notify_only',
            delivery: ensureDeliveryConfig({
              coreChannels: [
                ...(r?.inAppNotification !== false ? (['in_app'] as CoreDeliveryChannel[]) : []),
                ...(r?.emailNotification ? (['email'] as CoreDeliveryChannel[]) : []),
              ],
              integrationChannels: Array.isArray(r?.integrationChannels)
                ? r.integrationChannels
                : Array.isArray(r?.delivery?.integrationChannels)
                  ? r.delivery.integrationChannels
                  : [],
              syncTargets: Array.isArray(r?.syncTargets)
                ? r.syncTargets
                : Array.isArray(r?.delivery?.syncTargets)
                  ? r.delivery.syncTargets
                  : [],
            }),
            message: String(r?.message || ''),
          });
        })
        .filter(Boolean)
        .slice(0, 5) as EscalationRuleWithConfig[];
      if (next.length === 0) throw new Error('No escalation rules returned');
      setEscalationRules(next);
      toast.success(
        isPolish
          ? `AI zaproponowało i zastosowało eskalacje (${next.length}).`
          : `AI suggested and applied escalation rules (${next.length}).`
      );
    } catch (e) {
      console.error('Failed to suggest escalations via AI', e);
      const selected = users[0];
      if (selected) {
        setEscalationRules([
          normalizeEscalationRule({
            id: `esc-fb-${Date.now()}-1`,
            enabled: true,
            escalateTo: selected.id,
            escalateToName: `${selected.firstName} ${selected.lastName}`,
            afterDays: 5,
            warningDays: 3,
            criticalDays: 1,
            escalationMode: 'manager_review',
            delivery: ensureDeliveryConfig({ coreChannels: ['in_app', 'email'] }),
            message: isPolish
              ? 'Decyzja eskalowana z powodu braku aktywności.'
              : 'Decision escalated due to inactivity.',
          }),
        ]);
      }
      toast.success(
        isPolish ? 'Zastosowano domyślną regułę eskalacji.' : 'Applied fallback escalation rule.'
      );
    } finally {
      setIsSuggestingEscalations(false);
    }
  };

  const suggestStakeholderDraftAI = async () => {
    if (isDecisionStageLocked || !stakeholderDraft) return;
    setIsSuggestingStakeholders(true);
    try {
      const prompt = isPolish
        ? `Wypełnij konfigurację pojedynczej osoby RACI. Zwróć WYŁĄCZNIE JSON:
{"role":"accountable|responsible|consulted|informed","notifications":{"enabled":true,"inAppEnabled":true,"emailEnabled":false,"integrationChannels":["slack"],"syncTargets":["slack:#ops"]}}
Kontekst: priorytet=${priority}, status=${status}, deadline=${dueDate || '-'}`
        : `Fill configuration for one RACI person. Return JSON ONLY:
{"role":"accountable|responsible|consulted|informed","notifications":{"enabled":true,"inAppEnabled":true,"emailEnabled":false,"integrationChannels":["slack"],"syncTargets":["slack:#ops"]}}
Context: priority=${priority}, status=${status}, deadline=${dueDate || '-'}`;
      const aiRes = await Api.post('/ai/chat', {
        message: prompt,
        history: [],
        systemInstruction: isPolish
          ? 'Jesteś asystentem PMO. Zwróć tylko poprawny JSON bez markdown.'
          : 'You are a PMO assistant. Return valid JSON only, no markdown.',
        roleName: 'RACI Person Form Assistant',
      });
      const raw = String(aiRes?.text || aiRes?.content || '').trim();
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
      const role = ['accountable', 'responsible', 'consulted', 'informed'].includes(parsed?.role)
        ? parsed.role
        : stakeholderDraft.role;
      const notifications = parsed?.notifications || {};
      const integrationChannels = Array.isArray(notifications.integrationChannels)
        ? notifications.integrationChannels.filter((channel: string) =>
            integrationChannelCatalog.some((entry) => entry.key === channel)
          )
        : stakeholderDraft.notificationSettings.integrationChannels || [];
      const syncTargets = Array.isArray(notifications.syncTargets)
        ? notifications.syncTargets.map((item: unknown) => String(item).trim()).filter(Boolean)
        : stakeholderDraft.notificationSettings.syncTargets || [];

      setStakeholderDraft((prev) =>
        prev
          ? {
              ...prev,
              role,
              notificationSettings: {
                ...prev.notificationSettings,
                enabled:
                  typeof notifications.enabled === 'boolean'
                    ? notifications.enabled
                    : prev.notificationSettings.enabled,
                inAppEnabled:
                  typeof notifications.inAppEnabled === 'boolean'
                    ? notifications.inAppEnabled
                    : prev.notificationSettings.inAppEnabled,
                emailEnabled:
                  typeof notifications.emailEnabled === 'boolean'
                    ? notifications.emailEnabled
                    : prev.notificationSettings.emailEnabled,
                integrationChannels,
                syncTargets,
              },
            }
          : prev
      );
      toast.success(
        isPolish ? 'AI uzupełniło formularz osoby RACI.' : 'AI filled the RACI person form.'
      );
    } catch (e) {
      console.error('Failed to suggest stakeholder draft via AI', e);
      setStakeholderDraft((prev) =>
        prev
          ? {
              ...prev,
              notificationSettings: {
                ...prev.notificationSettings,
                enabled: true,
                inAppEnabled: true,
                emailEnabled: prev.role === 'accountable',
              },
            }
          : prev
      );
      toast.success(
        isPolish
          ? 'Zastosowano domyślną konfigurację osoby RACI.'
          : 'Applied fallback RACI person configuration.'
      );
    } finally {
      setIsSuggestingStakeholders(false);
    }
  };

  const suggestReminderDraftAI = async () => {
    if (isDecisionStageLocked || !reminderDraft) return;
    setIsSuggestingReminders(true);
    try {
      const prompt = isPolish
        ? `Wypełnij pojedynczą regułę remindera dla decyzji. Zwróć WYŁĄCZNIE JSON:
{"type":"before_due|after_due","days":2,"recipients":"requester|decider|both|stakeholders","inAppNotification":true,"emailNotification":false,"message":"...","enabled":true}
Kontekst: priorytet=${priority}, status=${status}, deadline=${dueDate || '-'}`
        : `Fill a single reminder rule for this decision. Return JSON ONLY:
{"type":"before_due|after_due","days":2,"recipients":"requester|decider|both|stakeholders","inAppNotification":true,"emailNotification":false,"message":"...","enabled":true}
Context: priority=${priority}, status=${status}, deadline=${dueDate || '-'}`;
      const aiRes = await Api.post('/ai/chat', {
        message: prompt,
        history: [],
        systemInstruction: isPolish
          ? 'Jesteś asystentem PMO. Zwróć tylko poprawny JSON bez markdown.'
          : 'You are a PMO assistant. Return valid JSON only, no markdown.',
        roleName: 'Reminder Form Assistant',
      });
      const raw = String(aiRes?.text || aiRes?.content || '').trim();
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      const r = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
      setReminderDraft((prev) =>
        prev
          ? {
              ...prev,
              type: r?.type === 'after_due' ? 'after_due' : 'before_due',
              days: Math.max(0, Number(r?.days ?? prev.days)),
              recipients: ['requester', 'decider', 'both', 'stakeholders'].includes(r?.recipients)
                ? r.recipients
                : prev.recipients,
              inAppNotification: r?.inAppNotification !== false,
              emailNotification: !!r?.emailNotification,
              delivery: ensureDeliveryConfig({
                coreChannels: [
                  ...(r?.inAppNotification !== false ? (['in_app'] as CoreDeliveryChannel[]) : []),
                  ...(r?.emailNotification ? (['email'] as CoreDeliveryChannel[]) : []),
                ],
                integrationChannels: Array.isArray(r?.integrationChannels)
                  ? r.integrationChannels
                  : Array.isArray(r?.delivery?.integrationChannels)
                    ? r.delivery.integrationChannels
                    : prev.delivery?.integrationChannels || [],
                syncTargets: Array.isArray(r?.syncTargets)
                  ? r.syncTargets
                  : Array.isArray(r?.delivery?.syncTargets)
                    ? r.delivery.syncTargets
                    : prev.delivery?.syncTargets || [],
              }),
              message: String(r?.message || prev.message || ''),
              enabled: r?.enabled !== false,
            }
          : prev
      );
      toast.success(
        isPolish ? 'AI uzupełniło formularz remindera.' : 'AI filled the reminder form.'
      );
    } catch (e) {
      console.error('Failed to suggest reminder draft via AI', e);
      setReminderDraft((prev) =>
        prev
          ? {
              ...prev,
              type: 'before_due',
              days: 3,
              recipients: 'both',
              inAppNotification: true,
              emailNotification: true,
                delivery: ensureDeliveryConfig({ coreChannels: ['in_app', 'email'] }),
              enabled: true,
              message: prev.message || (isPolish ? 'Termin decyzji za 3 dni.' : 'Decision due in 3 days.'),
            }
          : prev
      );
      toast.success(
        isPolish
          ? 'Zastosowano domyślne uzupełnienie remindera.'
          : 'Applied fallback reminder form values.'
      );
    } finally {
      setIsSuggestingReminders(false);
    }
  };

  const suggestEscalationDraftAI = async () => {
    if (isDecisionStageLocked || !escalationDraft) return;
    setIsSuggestingEscalations(true);
    try {
      const userList = users
        .slice(0, 80)
        .map((u) => `${u.id}|${u.firstName} ${u.lastName}`)
        .join('\n');
      const prompt = isPolish
        ? `Wypełnij pojedynczą regułę eskalacji. Zwróć WYŁĄCZNIE JSON:
{"afterDays":5,"warningDays":3,"criticalDays":1,"escalateToUserId":"...","message":"...","enabled":true}
Użyj userId tylko z listy:
${userList}`
        : `Fill one escalation rule. Return JSON ONLY:
{"afterDays":5,"warningDays":3,"criticalDays":1,"escalateToUserId":"...","message":"...","enabled":true}
Use userId only from this list:
${userList}`;
      const aiRes = await Api.post('/ai/chat', {
        message: prompt,
        history: [],
        systemInstruction: isPolish
          ? 'Jesteś asystentem PMO. Zwróć tylko poprawny JSON bez markdown.'
          : 'You are a PMO assistant. Return valid JSON only, no markdown.',
        roleName: 'Escalation Form Assistant',
      });
      const raw = String(aiRes?.text || aiRes?.content || '').trim();
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      const r = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
      const selected = users.find((u) => u.id === r?.escalateToUserId) || users[0];
      if (!selected) throw new Error('No eligible user');
      setEscalationDraft((prev) =>
        prev
          ? {
              ...prev,
              afterDays: Math.max(1, Number(r?.afterDays ?? prev.afterDays)),
              warningDays: Math.max(0, Number(r?.warningDays ?? prev.warningDays)),
              criticalDays: Math.max(0, Number(r?.criticalDays ?? prev.criticalDays)),
              escalationMode: (['notify_only', 'manager_review', 'executive_alert'] as EscalationMode[]).includes(
                r?.escalationMode
              )
                ? r.escalationMode
                : prev.escalationMode,
              delivery: ensureDeliveryConfig({
                coreChannels: [
                  ...(r?.inAppNotification !== false ? (['in_app'] as CoreDeliveryChannel[]) : []),
                  ...(r?.emailNotification ? (['email'] as CoreDeliveryChannel[]) : []),
                ],
                integrationChannels: Array.isArray(r?.integrationChannels)
                  ? r.integrationChannels
                  : Array.isArray(r?.delivery?.integrationChannels)
                    ? r.delivery.integrationChannels
                    : prev.delivery?.integrationChannels || [],
                syncTargets: Array.isArray(r?.syncTargets)
                  ? r.syncTargets
                  : Array.isArray(r?.delivery?.syncTargets)
                    ? r.delivery.syncTargets
                    : prev.delivery?.syncTargets || [],
              }),
              escalateTo: selected.id,
              escalateToName: `${selected.firstName} ${selected.lastName}`,
              message: String(r?.message || prev.message || ''),
              enabled: r?.enabled !== false,
            }
          : prev
      );
      toast.success(
        isPolish ? 'AI uzupełniło formularz eskalacji.' : 'AI filled the escalation form.'
      );
    } catch (e) {
      console.error('Failed to suggest escalation draft via AI', e);
      const selected = users[0];
      if (selected) {
        setEscalationDraft((prev) =>
          prev
            ? {
                ...prev,
                afterDays: 5,
                warningDays: 3,
                criticalDays: 1,
                escalationMode: prev.escalationMode || 'manager_review',
                delivery: ensureDeliveryConfig({
                  coreChannels: ['in_app', 'email'],
                  integrationChannels: prev.delivery?.integrationChannels || [],
                  syncTargets: prev.delivery?.syncTargets || [],
                }),
                escalateTo: selected.id,
                escalateToName: `${selected.firstName} ${selected.lastName}`,
                enabled: true,
                message:
                  prev.message ||
                  (isPolish
                    ? 'Decyzja eskalowana z powodu braku aktywności.'
                    : 'Decision escalated due to inactivity.'),
              }
            : prev
        );
      }
      toast.success(
        isPolish
          ? 'Zastosowano domyślne uzupełnienie eskalacji.'
          : 'Applied fallback escalation form values.'
      );
    } finally {
      setIsSuggestingEscalations(false);
    }
  };

  const generateConsequencesOfInactionAI = () => {
    if (isDecisionStageLocked) {
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
    if (isDecisionStageLocked) {
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
  const WORKFLOW_LOCKS_ENABLED = false; // temporary: full edit mode during model/design phase
  const isDecisionStageLocked = WORKFLOW_LOCKS_ENABLED && isPending;
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
  const relatedDecisionItems = useMemo(
    () =>
      linkedItems.filter(
        (item) => item.type === 'task' || item.type === 'decision'
      ),
    [linkedItems]
  );
  const canExpandDescription = useMemo(
    () => description.length > 260 || description.split('\n').length > 5,
    [description]
  );
  const canExpandContext = useMemo(
    () => contextDetails.length > 220 || contextDetails.split('\n').length > 4,
    [contextDetails]
  );
  const quickProArguments = useMemo(
    () =>
      isPolish
        ? ['Niższy koszt', 'Mniejsze ryzyko', 'Szybciej', 'Lepsza jakość', 'Skalowalność']
        : ['Lower cost', 'Lower risk', 'Faster delivery', 'Better quality', 'Scalability'],
    [isPolish]
  );
  const quickConArguments = useMemo(
    () =>
      isPolish
        ? ['Wyższy koszt', 'Większe ryzyko', 'Wolniej', 'Większa złożoność', 'Zależność od dostawcy']
        : ['Higher cost', 'Higher risk', 'Slower delivery', 'Higher complexity', 'Vendor dependency'],
    [isPolish]
  );
  const riskLevelOptions = useMemo(
    () => ['low', 'medium', 'high', 'critical'] as const,
    []
  );
  const riskCategoryOptions = useMemo(
    () =>
      ['technical', 'business', 'financial', 'operational', 'security'].map((c) => ({
        value: c,
        label:
          c === 'technical'
            ? isPolish
              ? 'Techniczne'
              : 'Technical'
            : c === 'business'
              ? isPolish
                ? 'Biznesowe'
                : 'Business'
              : c === 'financial'
                ? isPolish
                  ? 'Finansowe'
                  : 'Financial'
                : c === 'operational'
                  ? isPolish
                    ? 'Operacyjne'
                    : 'Operational'
                  : isPolish
                    ? 'Bezpieczeństwo'
                    : 'Security',
      })),
    [isPolish]
  );
  const quickMitigationArguments = useMemo(
    () =>
      isPolish
        ? ['POC przed wdrożeniem', 'Przegląd tygodniowy', 'Plan kontroli jakości']
        : ['POC before rollout', 'Weekly review checkpoint', 'Quality control plan'],
    [isPolish]
  );
  const quickContingencyArguments = useMemo(
    () =>
      isPolish
        ? ['Tryb ręczny fallback', 'Eskalacja do PMO', 'Przesunięcie terminu + komunikat']
        : ['Manual fallback mode', 'Escalate to PMO', 'Timeline shift with stakeholder notice'],
    [isPolish]
  );
  const riskLevelToScore = (level?: string) => {
    const normalized = String(level || '').toLowerCase();
    if (normalized === 'critical') return 4;
    if (normalized === 'high') return 3;
    if (normalized === 'medium') return 2;
    return 1;
  };
  const getRiskScore = (risk: RiskItem) =>
    riskLevelToScore(risk.probability) * riskLevelToScore(risk.impact);
  const getRiskScoreClass = (score: number) => {
    if (score >= 12) return 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/30';
    if (score >= 8)
      return 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/30';
    if (score >= 4)
      return 'text-yellow-700 dark:text-yellow-300 bg-yellow-500/10 border-yellow-500/30';
    return 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/30';
  };
  const getRiskLevelClass = (level?: string) => {
    const normalized = String(level || '').toLowerCase();
    if (normalized === 'critical')
      return 'border-red-500/60 bg-red-500/10 text-red-700 dark:text-red-300';
    if (normalized === 'high')
      return 'border-orange-500/55 bg-orange-500/10 text-orange-700 dark:text-orange-300';
    if (normalized === 'medium')
      return 'border-amber-500/55 bg-amber-500/10 text-amber-700 dark:text-amber-300';
    return 'border-emerald-500/45 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  };
  const getRiskLevelLabel = (level: string) => {
    if (isPolish) {
      if (level === 'critical') return 'Krytyczny';
      if (level === 'high') return 'Wysoki';
      if (level === 'medium') return 'Średni';
      return 'Niski';
    }
    if (level === 'critical') return 'Critical';
    if (level === 'high') return 'High';
    if (level === 'medium') return 'Medium';
    return 'Low';
  };
  const sortedRisks = useMemo(
    () =>
      [...risks].sort((a, b) => {
        const byScore = getRiskScore(b) - getRiskScore(a);
        if (byScore !== 0) return byScore;
        return String(a.title || '').localeCompare(String(b.title || ''));
      }),
    [risks]
  );
  const recommendedAlternative = useMemo(
    () => alternatives.find((a) => a.isRecommended) || alternatives[0] || null,
    [alternatives]
  );
  const topRiskTitles = useMemo(
    () =>
      sortedRisks
        .slice(0, 2)
        .map((r) => r.title)
        .filter(Boolean),
    [sortedRisks]
  );
  const blockedItemsCount = relatedDecisionItems.length;
  const pressureSummary = useMemo(() => {
    const weeklyHours = Math.max(8, blockedItemsCount * 6 + sortedRisks.length * 4);
    return {
      d7: isPolish
        ? `${blockedItemsCount || 1} element(y) mogą się zablokować operacyjnie`
        : `${blockedItemsCount || 1} linked item(s) may become operationally blocked`,
      d30: isPolish
        ? `Wzrost pracy manualnej o ok. ${weeklyHours}h/tydzień`
        : `Manual workload may increase by about ${weeklyHours}h/week`,
      d90: isPolish
        ? 'Wysokie ryzyko eskalacji i utraty tempa wykonawczego'
        : 'High risk of escalation and loss of delivery momentum',
    };
  }, [isPolish, blockedItemsCount, sortedRisks.length]);

  const buildConsequencesTemplate = (
    style: 'conservative' | 'executive' | 'action_forcing'
  ): string => {
    const recommendation = recommendedAlternative?.title || (isPolish ? 'wybraną opcję' : 'selected option');
    const decider = deciderName || deciderId || (isPolish ? 'właściciel decyzji' : 'decision owner');
    const due = dueDate || (isPolish ? '[DATA]' : '[DATE]');
    const riskLine = topRiskTitles.length
      ? topRiskTitles.join(', ')
      : isPolish
        ? 'ryzyka operacyjne i jakościowe'
        : 'operational and quality risks';

    if (style === 'conservative') {
      return isPolish
        ? `1) Jeśli decyzja nie zapadnie do ${due}, w ciągu 7 dni:\n- ${pressureSummary.d7}\n\n2) W ciągu 30 dni:\n- ${pressureSummary.d30}\n- Najbardziej narażone obszary: ${riskLine}\n\n3) W ciągu 90 dni:\n- ${pressureSummary.d90}\n\n4) Minimalna decyzja na teraz:\n- Zatwierdzić: ${recommendation}\n- Właściciel: ${decider}`
        : `1) If the decision is not made by ${due}, within 7 days:\n- ${pressureSummary.d7}\n\n2) Within 30 days:\n- ${pressureSummary.d30}\n- Most exposed areas: ${riskLine}\n\n3) Within 90 days:\n- ${pressureSummary.d90}\n\n4) Minimum action now:\n- Approve: ${recommendation}\n- Owner: ${decider}`;
    }

    if (style === 'executive') {
      return isPolish
        ? `Podsumowanie zarządcze:\nBrak decyzji do ${due} zwiększa koszt bezczynności i ryzyko opóźnień wykonawczych.\n\nWpływ:\n- 7 dni: ${pressureSummary.d7}\n- 30 dni: ${pressureSummary.d30}\n- 90 dni: ${pressureSummary.d90}\n\nRekomendacja:\nZatwierdzić ${recommendation} oraz przypisać odpowiedzialność do: ${decider}.`
        : `Executive summary:\nNo decision by ${due} increases cost of inaction and delivery delay risk.\n\nImpact:\n- 7 days: ${pressureSummary.d7}\n- 30 days: ${pressureSummary.d30}\n- 90 days: ${pressureSummary.d90}\n\nRecommendation:\nApprove ${recommendation} and assign ownership to: ${decider}.`;
    }

    return isPolish
      ? `ALERT: brak decyzji do ${due} uruchamia negatywny scenariusz.\n\nCo stracimy:\n- Natychmiast: ${pressureSummary.d7}\n- 30 dni: ${pressureSummary.d30}\n- 90 dni: ${pressureSummary.d90}\n\nNajwyższe ryzyka: ${riskLine}.\n\nDecyzja wymagana TERAZ:\n- Zatwierdzić ${recommendation}\n- Potwierdzić właściciela: ${decider}\n- Utrzymać termin: ${due}`
      : `ALERT: no decision by ${due} triggers a negative scenario.\n\nWhat we lose:\n- Immediate: ${pressureSummary.d7}\n- 30 days: ${pressureSummary.d30}\n- 90 days: ${pressureSummary.d90}\n\nHighest risks: ${riskLine}.\n\nDecision required NOW:\n- Approve ${recommendation}\n- Confirm owner: ${decider}\n- Keep deadline: ${due}`;
  };

  const buildFallbackConsequenceScenarios = (): ConsequenceScenarios => ({
    updatedAt: new Date().toISOString(),
    source: 'fallback',
    pessimistic: {
      d7: isPolish
        ? `Natychmiastowe ryzyko blokady: ${pressureSummary.d7}.`
        : `Immediate blockage risk: ${pressureSummary.d7}.`,
      d30: isPolish
        ? `Koszt bezczynności rośnie: ${pressureSummary.d30}.`
        : `Cost of inaction increases: ${pressureSummary.d30}.`,
      d90: isPolish
        ? `Scenariusz krytyczny: ${pressureSummary.d90}.`
        : `Critical scenario: ${pressureSummary.d90}.`,
    },
    neutral: {
      d7: isPolish
        ? `Utrzymuje się niepewność wykonawcza i spada tempo decyzji.`
        : `Execution uncertainty persists and decision velocity drops.`,
      d30: isPolish
        ? `Rosną zależności między zadaniami, możliwe lokalne opóźnienia.`
        : `Task dependencies grow, causing localized delays.`,
      d90: isPolish
        ? `Projekt wymaga korekty planu i dodatkowych zasobów.`
        : `The project requires plan correction and additional resources.`,
    },
    optimistic: {
      d7: isPolish
        ? `Ryzyko materializacji ograniczone przy monitoringu dziennym.`
        : `Materialization risk remains limited with daily monitoring.`,
      d30: isPolish
        ? `Przy częściowych decyzjach wpływ można utrzymać pod kontrolą.`
        : `With partial decisions, impact can remain under control.`,
      d90: isPolish
        ? `Skutki umiarkowane, jeśli właściciel i termin będą egzekwowane.`
        : `Impact remains moderate if owner and deadline are enforced.`,
    },
  });

  const generateConsequenceScenariosAI = async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    setIsGeneratingConsequenceScenarios(true);
    try {
      const projectContext = {
        decisionTitle: title || null,
        dueDate: dueDate || null,
        status,
        priority,
        recommendedOption: recommendedAlternative?.title || null,
        linkedItems: relatedDecisionItems.slice(0, 8).map((i) => i.title),
        topRisks: sortedRisks.slice(0, 3).map((r) => ({
          title: r.title,
          score: getRiskScore(r),
          probability: r.probability,
          impact: r.impact,
        })),
      };
      const systemInstruction = isPolish
        ? 'Jesteś doradcą PMO. Zwróć wyłącznie poprawny JSON zgodny ze schematem.'
        : 'You are a PMO advisor. Return valid JSON only according to schema.';
      const prompt = isPolish
        ? `Na podstawie kontekstu projektu wygeneruj konsekwencje braku decyzji w 3 scenariuszach: pessimistic, neutral, optimistic. Dla każdego scenariusza podaj d7, d30, d90. Zwróć WYŁĄCZNIE JSON w formacie:
{
  "pessimistic":{"d7":"...","d30":"...","d90":"..."},
  "neutral":{"d7":"...","d30":"...","d90":"..."},
  "optimistic":{"d7":"...","d30":"...","d90":"..."}
}
Kontekst: ${JSON.stringify(projectContext)}`
        : `Based on project context, generate consequences of inaction in 3 scenarios: pessimistic, neutral, optimistic. For each scenario provide d7, d30, d90. Return JSON ONLY in this format:
{
  "pessimistic":{"d7":"...","d30":"...","d90":"..."},
  "neutral":{"d7":"...","d30":"...","d90":"..."},
  "optimistic":{"d7":"...","d30":"...","d90":"..."}
}
Context: ${JSON.stringify(projectContext)}`;

      const aiRes = await Api.post('/ai/chat', {
        message: prompt,
        history: [],
        systemInstruction,
        roleName: 'Decision Consequence Analyst',
      });
      const raw = String(aiRes?.text || aiRes?.content || '').trim();
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
      const normalizeTimeline = (v: any): ConsequenceTimeline => ({
        d7: String(v?.d7 || ''),
        d30: String(v?.d30 || ''),
        d90: String(v?.d90 || ''),
      });

      const next: ConsequenceScenarios = {
        updatedAt: new Date().toISOString(),
        source: 'ai',
        pessimistic: normalizeTimeline(parsed?.pessimistic),
        neutral: normalizeTimeline(parsed?.neutral),
        optimistic: normalizeTimeline(parsed?.optimistic),
      };
      if (!next.pessimistic.d7 || !next.neutral.d30 || !next.optimistic.d90) {
        throw new Error('Incomplete AI scenario response');
      }
      setConsequenceScenarios(next);
      if (!silent) {
        toast.success(
          isPolish
            ? 'Scenariusze konsekwencji zaktualizowane przez AI'
            : 'Consequence scenarios updated by AI'
        );
      }
    } catch {
      const fallback = buildFallbackConsequenceScenarios();
      setConsequenceScenarios(fallback);
      if (!silent) {
        toast(
          isPolish
            ? 'Użyto scenariuszy awaryjnych. AI chwilowo niedostępne.'
            : 'Fallback scenarios applied. AI temporarily unavailable.',
          { icon: '⚠️' }
        );
      }
    } finally {
      setIsGeneratingConsequenceScenarios(false);
    }
  };

  const displayedConsequenceScenarios = useMemo(
    () => consequenceScenarios || buildFallbackConsequenceScenarios(),
    [consequenceScenarios, pressureSummary, isPolish]
  );

  const updateConsequenceScenarioCell = (
    scenarioKey: 'optimistic' | 'neutral' | 'pessimistic',
    timelineKey: 'd7' | 'd30' | 'd90',
    value: string
  ) => {
    if (isDecisionStageLocked) return;
    setConsequenceScenarios((prev) => {
      const base = prev || buildFallbackConsequenceScenarios();
      return {
        ...base,
        source: 'fallback',
        updatedAt: new Date().toISOString(),
        [scenarioKey]: {
          ...base[scenarioKey],
          [timelineKey]: value,
        },
      };
    });
  };

  const getLinkedItemIndex = (item: LinkedItem) => {
    const raw = String(item.id || '').trim();
    if (!raw) return '';
    const normalized = raw.replace(/^.*\//, '');
    return normalized.length > 24 ? `${normalized.slice(0, 24)}...` : normalized;
  };

  const withProsConsFallback = (alts: Alternative[]) =>
    alts.map((alt, idx) => {
      const hasPros = Array.isArray(alt.pros) && alt.pros.length > 0;
      const hasCons = Array.isArray(alt.cons) && alt.cons.length > 0;
      if (hasPros && hasCons) return alt;

      const fallbackPros = isPolish
        ? [
            'Szybsze dostarczenie wartości biznesowej',
            'Lepsza przewidywalność wykonania',
            'Czytelna odpowiedzialność zespołu',
          ]
        : [
            'Faster delivery of business value',
            'Better execution predictability',
            'Clearer team accountability',
          ];
      const fallbackCons = isPolish
        ? [
            'Ryzyko wzrostu kosztów początkowych',
            'Wymaga dodatkowej koordynacji',
            'Potrzebne wsparcie kompetencyjne',
          ]
        : [
            'Risk of higher initial cost',
            'Requires additional coordination',
            'Needs additional capability support',
          ];

      return {
        ...alt,
        pros: hasPros ? alt.pros : [fallbackPros[idx % fallbackPros.length]],
        cons: hasCons ? alt.cons : [fallbackCons[idx % fallbackCons.length]],
      };
    });

  const fallbackRefineText = (
    input: string,
    mode: 'improve' | 'shorten' | 'expand' | 'formal'
  ) => {
    const normalized = input.replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (!normalized) return input;

    if (mode === 'shorten') {
      const target = Math.max(120, Math.floor(normalized.length * 0.65));
      const compact = normalized.slice(0, target).trim();
      return compact.endsWith('.') || compact.endsWith('!') || compact.endsWith('?')
        ? compact
        : `${compact}...`;
    }

    if (mode === 'expand') {
      const appendix = isPolish
        ? '\n\nUzasadnienie biznesowe: decyzja wpływa na terminowość, ryzyko operacyjne i jakość dostarczanych rezultatów. Rekomendowane jest określenie właściciela wdrożenia oraz punktów kontrolnych.'
        : '\n\nBusiness rationale: this decision affects delivery timing, operational risk, and outcome quality. It is recommended to define an implementation owner and key control checkpoints.';
      return `${normalized}${appendix}`;
    }

    if (mode === 'formal') {
      return isPolish
        ? `Niniejszym wskazuje się, że ${normalized.charAt(0).toLowerCase()}${normalized.slice(1)}`
        : `It is hereby noted that ${normalized.charAt(0).toLowerCase()}${normalized.slice(1)}`;
    }

    // improve
    return normalized
      .replace(/\s{2,}/g, ' ')
      .replace(/\.\s*\./g, '.')
      .replace(/(^\w)/, (m) => m.toUpperCase());
  };

  const enhanceFieldWithAI = async (
    fieldKey: string,
    sectionLabel: string,
    currentValue: string,
    applyValue: (value: string) => void,
    mode: 'improve' | 'shorten' | 'expand' | 'formal'
  ) => {
    if (isDecisionStageLocked) {
      toast.error(
        isPolish
          ? 'AI generowanie jest dostępne tylko przed etapem decyzji'
          : 'AI generation is available only before decision stage'
      );
      return;
    }
    if (!currentValue.trim()) {
      toast.error(
        isPolish
          ? 'Najpierw wpisz treść do edycji AI'
          : 'Enter some content first to edit with AI'
      );
      return;
    }

    setAiFieldLoading((prev) => ({ ...prev, [fieldKey]: true }));
    setAiMenuOpenField(null);
    try {
      const instructionByMode = {
        improve: isPolish
          ? 'Popraw tekst tak, aby był klarowny, profesjonalny i konkretny. Zachowaj sens, usuń powtórzenia.'
          : 'Improve the text to be clear, professional, and concise. Keep the meaning and remove repetition.',
        shorten: isPolish
          ? 'Skróć tekst o 30-40%, zachowując kluczowy sens i decyzjotwórcze informacje.'
          : 'Shorten the text by about 30-40% while keeping key meaning and decision-relevant information.',
        expand: isPolish
          ? 'Rozwiń tekst, dodając istotny kontekst, ryzyka i implikacje biznesowe bez lania wody.'
          : 'Expand the text with useful context, risks, and business implications without filler.',
        formal: isPolish
          ? 'Przeredaguj tekst w bardziej formalnym, zarządczym tonie.'
          : 'Rewrite the text in a more formal executive tone.',
      } as const;
      const prompt = isPolish
        ? `Sekcja: ${sectionLabel}\nTryb edycji: ${mode}\nTytuł decyzji: ${title || '-'}\nStatus: ${status}\nPriorytet: ${priority}\n\nInstrukcja: ${instructionByMode[mode]}\n\nTekst do edycji:\n${currentValue}`
        : `Section: ${sectionLabel}\nEdit mode: ${mode}\nDecision title: ${title || '-'}\nStatus: ${status}\nPriority: ${priority}\n\nInstruction: ${instructionByMode[mode]}\n\nText to edit:\n${currentValue}`;

      let refinedText = '';
      try {
        const systemInstruction = isPolish
          ? 'Jesteś redaktorem treści decyzyjnych PMO. Zwróć tylko poprawiony tekst, bez komentarzy.'
          : 'You are a PMO decision content editor. Return only the revised text, no commentary.';

        // 1) Prefer authenticated API path used across app
        const aiRes = await Api.post('/ai/chat', {
          message: prompt,
          history: [],
          systemInstruction,
          roleName: 'Decision Text Editor',
        });
        refinedText = String(aiRes?.text || aiRes?.content || '').trim();

        // 2) Fallback to confirm endpoint (some deployments gate /ai/chat responses)
        if (!refinedText) {
          const confirmRes = await Api.chatConfirm(prompt, [], systemInstruction, undefined, undefined);
          refinedText = String(
            confirmRes?.text ||
              confirmRes?.content ||
              confirmRes?.response ||
              confirmRes?.confirm?.suggestedResponse ||
              ''
          ).trim();
        }
      } catch {
        refinedText = '';
      }

      if (!refinedText) {
        refinedText = fallbackRefineText(currentValue, mode);
        toast(
          isPolish
            ? 'Użyto trybu awaryjnego edycji lokalnej (AI chwilowo niedostępne).'
            : 'Fallback local edit applied (AI temporarily unavailable).',
          { icon: '⚠️' }
        );
      }

      if (!refinedText) {
        throw new Error('Empty AI response');
      }

      setAiUndoByField((prev) => ({ ...prev, [fieldKey]: currentValue }));
      applyValue(refinedText);
      toast.success(
        isPolish
          ? 'Treść zaktualizowana przez AI. Jeśli efekt Ci nie pasuje, kliknij Undo AI.'
          : 'Content updated by AI. If you do not like it, click Undo AI.'
      );
    } catch (error) {
      toast.error(
        isPolish
          ? 'Nie udało się poprawić treści przez AI'
          : 'Failed to refine content with AI'
      );
    } finally {
      setAiFieldLoading((prev) => ({ ...prev, [fieldKey]: false }));
    }
  };

  const renderFieldAIButton = (
    fieldKey: string,
    sectionLabel: string,
    currentValue: string,
    applyValue: (value: string) => void
  ) => (
    <div className="relative" data-ai-menu-root="true">
      <button
        onClick={() =>
          setAiMenuOpenField((prev) => (prev === fieldKey ? null : fieldKey))
        }
        disabled={isDecisionStageLocked || !!aiFieldLoading[fieldKey]}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium text-purple-500 dark:text-purple-400 hover:bg-purple-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        title={isPolish ? 'Akcje AI dla tego pola' : 'AI actions for this field'}
      >
        {aiFieldLoading[fieldKey] ? (
          <Loader2 size={11} className="animate-spin" />
        ) : (
          <Sparkles size={11} />
        )}
        AI
      </button>
      {aiMenuOpenField === fieldKey && !isDecisionStageLocked && !aiFieldLoading[fieldKey] && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-44 rounded-lg border border-slate-200/70 dark:border-navy-700/70 bg-white/95 dark:bg-navy-900/95 backdrop-blur p-1 shadow-xl">
          {[
            ['improve', isPolish ? 'Improve' : 'Improve'],
            ['shorten', isPolish ? 'Shorten' : 'Shorten'],
            ['expand', isPolish ? 'Expand' : 'Expand'],
            ['formal', isPolish ? 'Formal tone' : 'Formal tone'],
          ].map(([modeKey, label]) => (
            <button
              key={modeKey}
              onClick={() =>
                enhanceFieldWithAI(
                  fieldKey,
                  sectionLabel,
                  currentValue,
                  applyValue,
                  modeKey as 'improve' | 'shorten' | 'expand' | 'formal'
                )
              }
              className="w-full text-left px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-md transition-colors"
            >
              {label}
            </button>
          ))}
          {aiUndoByField[fieldKey] !== undefined && (
            <button
              onClick={() => {
                applyValue(aiUndoByField[fieldKey]);
                setAiUndoByField((prev) => {
                  const next = { ...prev };
                  delete next[fieldKey];
                  return next;
                });
                setAiMenuOpenField(null);
                toast.success(
                  isPolish ? 'Przywrócono poprzednią wersję tekstu' : 'Previous text restored'
                );
              }}
              className="mt-1 w-full text-left px-2.5 py-1.5 text-xs text-amber-700 dark:text-amber-300 hover:bg-amber-50/70 dark:hover:bg-amber-500/10 rounded-md transition-colors"
            >
              Undo AI
            </button>
          )}
        </div>
      )}
    </div>
  );
  const createdDateDisplay = useMemo(() => {
    if (!createdAt) return '—';
    const d = new Date(createdAt);
    if (Number.isNaN(d.getTime())) return String(createdAt).split('T')[0] || String(createdAt);
    return d.toLocaleDateString(isPolish ? 'pl-PL' : 'en-GB');
  }, [createdAt, isPolish]);
  const statusAlertBorderClass =
    status === 'escalated' || status === 'rejected'
      ? 'border-red-400/70 dark:border-red-500/50'
      : status === 'pending' || status === 'deferred'
        ? 'border-amber-400/70 dark:border-amber-500/50'
        : status === 'approved'
          ? 'border-emerald-400/70 dark:border-emerald-500/50'
          : 'border-slate-200/60 dark:border-navy-600/60';
  const priorityAlertBorderClass =
    priority === 'critical'
      ? 'border-red-400/70 dark:border-red-500/50'
      : priority === 'high'
        ? 'border-amber-400/70 dark:border-amber-500/50'
        : priority === 'medium'
          ? 'border-blue-400/70 dark:border-blue-500/50'
          : 'border-slate-200/60 dark:border-navy-600/60';
  const dueDateAlertBorderClass = useMemo(() => {
    if (!dueDate) return 'border-slate-200/60 dark:border-navy-600/60';
    if (status === 'approved' || status === 'rejected') return 'border-slate-200/60 dark:border-navy-600/60';
    const due = new Date(dueDate);
    if (Number.isNaN(due.getTime())) return 'border-slate-200/60 dark:border-navy-600/60';
    const now = new Date();
    const daysDiff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff < 0) return 'border-red-400/70 dark:border-red-500/50';
    if (daysDiff <= 3) return 'border-amber-400/70 dark:border-amber-500/50';
    return 'border-emerald-400/60 dark:border-emerald-500/40';
  }, [dueDate, status]);

  // Attachment handlers (mock)
  const handleUploadAttachments = async (files: FileList) => {
    if (isDecisionStageLocked) {
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
    if (isDecisionStageLocked) return;
    setAttachments(attachments.filter((a) => a.id !== id));
  };

  // Comment handlers (mock)
  const handleAddComment = async (
    content: string,
    parentId?: string,
    options?: { force?: boolean; priority?: CommentPriorityLevel }
  ) => {
    if (!options?.force && isDecisionStageLocked) {
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
    (newComment as Comment & { priority?: CommentPriorityLevel }).priority =
      options?.priority || 'normal';
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

  const filteredComments = useMemo(() => {
    const now = new Date();
    const filtered = comments.filter((comment) => {
      const created = new Date(comment.createdAt);
      if (Number.isNaN(created.getTime())) return true;
      if (commentDateFilter === 'today') return created.toDateString() === now.toDateString();
      if (commentDateFilter === '7d') return now.getTime() - created.getTime() <= 7 * 24 * 60 * 60 * 1000;
      if (commentDateFilter === '30d') return now.getTime() - created.getTime() <= 30 * 24 * 60 * 60 * 1000;
      return true;
    });

    return [...filtered].sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      const safeATime = Number.isNaN(aTime) ? 0 : aTime;
      const safeBTime = Number.isNaN(bTime) ? 0 : bTime;
      return commentSortOrder === 'asc' ? safeATime - safeBTime : safeBTime - safeATime;
    });
  }, [comments, commentDateFilter, commentSortOrder]);

  const filteredAttachments = useMemo(() => {
    const now = new Date();
    const filtered = attachments.filter((attachment) => {
      const uploaded = new Date(attachment.uploadedAt || '');
      if (Number.isNaN(uploaded.getTime())) return true;
      if (attachmentDateFilter === 'today') return uploaded.toDateString() === now.toDateString();
      if (attachmentDateFilter === '7d')
        return now.getTime() - uploaded.getTime() <= 7 * 24 * 60 * 60 * 1000;
      if (attachmentDateFilter === '30d')
        return now.getTime() - uploaded.getTime() <= 30 * 24 * 60 * 60 * 1000;
      return true;
    });

    return [...filtered].sort((a, b) => {
      const aTime = new Date(a.uploadedAt || '').getTime();
      const bTime = new Date(b.uploadedAt || '').getTime();
      const safeATime = Number.isNaN(aTime) ? 0 : aTime;
      const safeBTime = Number.isNaN(bTime) ? 0 : bTime;
      return attachmentSortOrder === 'asc' ? safeATime - safeBTime : safeBTime - safeATime;
    });
  }, [attachments, attachmentDateFilter, attachmentSortOrder]);

  const filteredLinkedItems = useMemo(() => {
    const byType =
      linkedItemFilter === 'all'
        ? linkedItems
        : linkedItems.filter((item) => item.type === linkedItemFilter);

    return [...byType].sort((a, b) => {
      const left = `${a.title || ''}`.toLowerCase();
      const right = `${b.title || ''}`.toLowerCase();
      if (left === right) return 0;
      if (linkedItemsSortOrder === 'asc') return left < right ? -1 : 1;
      return left > right ? -1 : 1;
    });
  }, [linkedItems, linkedItemFilter, linkedItemsSortOrder]);

  const filteredInternalLinkedItems = useMemo(
    () => filteredLinkedItems.filter((item) => item.type !== 'external'),
    [filteredLinkedItems]
  );

  const filteredExternalLinkedItems = useMemo(() => {
    const externalItems = linkedItems.filter((item) => item.type === 'external');
    return [...externalItems].sort((a, b) => {
      const left = `${a.title || ''}`.toLowerCase();
      const right = `${b.title || ''}`.toLowerCase();
      if (left === right) return 0;
      if (linkedItemsSortOrder === 'asc') return left < right ? -1 : 1;
      return left > right ? -1 : 1;
    });
  }, [linkedItems, linkedItemsSortOrder]);

  const getCommentPriority = (comment: Comment): CommentPriorityLevel =>
    ((comment as Comment & { priority?: CommentPriorityLevel }).priority || 'normal') as CommentPriorityLevel;

  const getPriorityDotClass = (priority: CommentPriorityLevel) => {
    if (priority === 'high') return 'bg-amber-400';
    if (priority === 'low') return 'bg-emerald-400';
    return 'bg-slate-400';
  };

  const getCommentPriorityLabel = (priority: CommentPriorityLevel) => {
    if (priority === 'high') return isPolish ? 'Wysoki' : 'High';
    if (priority === 'low') return isPolish ? 'Niski' : 'Low';
    return isPolish ? 'Normalny' : 'Normal';
  };

  const getCommentPriorityHint = (priority: CommentPriorityLevel) => {
    if (priority === 'high') {
      return isPolish
        ? 'Wymaga szybkiej reakcji i uwagi decydenta.'
        : 'Needs quick response and decision-maker attention.';
    }
    if (priority === 'low') {
      return isPolish
        ? 'Informacyjny komentarz, bez pilnej akcji.'
        : 'Informational note, no urgent action needed.';
    }
    return isPolish
      ? 'Standardowy komentarz roboczy.'
      : 'Standard working-level comment.';
  };

  const getPriorityButtonClass = (priority: CommentPriorityLevel, isActive: boolean) => {
    if (isActive && priority === 'high') {
      return 'border-amber-400/70 text-amber-300 bg-amber-500/15 shadow-[0_0_0_1px_rgba(251,191,36,0.2)]';
    }
    if (isActive && priority === 'normal') {
      return 'border-indigo-400/70 text-indigo-300 bg-indigo-500/15 shadow-[0_0_0_1px_rgba(129,140,248,0.2)]';
    }
    if (isActive && priority === 'low') {
      return 'border-emerald-400/70 text-emerald-300 bg-emerald-500/15 shadow-[0_0_0_1px_rgba(16,185,129,0.2)]';
    }
    return 'border-slate-300/55 dark:border-navy-600/60 text-slate-400 dark:text-slate-500 hover:border-slate-400/70 hover:text-slate-300';
  };

  const enhanceCommentDraftWithAI = async () => {
    if (isDecisionStageLocked) return;
    setIsEnhancingCommentDraft(true);
    try {
      const prompt = isPolish
        ? `Przygotuj zwięzły i profesjonalny komentarz do decyzji. Priorytet komentarza: ${commentDraftPriority}. Tytuł decyzji: "${title || '-'}". Opis: "${description || '-'}". Obecny szkic użytkownika: "${commentDraft || '-'}". Zwróć sam tekst komentarza (bez cudzysłowów i bez listy).`
        : `Draft a concise and professional decision comment. Comment priority: ${commentDraftPriority}. Decision title: "${title || '-'}". Description: "${description || '-'}". Current user draft: "${commentDraft || '-'}". Return comment text only (no quotes, no list).`;
      const aiRes = await Api.post('/ai/chat', {
        message: prompt,
        history: [],
        systemInstruction: isPolish
          ? 'Jesteś konsultantem PM. Zwracaj krótki komentarz gotowy do publikacji.'
          : 'You are a PM consultant. Return a short comment ready to publish.',
        roleName: 'Comment Writing Assistant',
      });
      const next = String(aiRes?.text || aiRes?.content || '').trim();
      if (next) {
        setCommentDraft(next);
        toast.success(isPolish ? 'AI przygotowało treść komentarza' : 'AI prepared comment text');
      } else {
        throw new Error('Empty AI output');
      }
    } catch {
      if (!commentDraft.trim()) {
        const fallback = isPolish
          ? 'Proponuję krótką walidację opcji na danych historycznych oraz doprecyzowanie właściciela wykonania.'
          : 'I suggest a short validation of this option on historical data and clarifying execution ownership.';
        setCommentDraft(fallback);
      } else {
        setCommentDraft((prev) =>
          `${prev.trim()} ${isPolish ? 'Warto też doprecyzować właściciela i termin.' : 'It is also worth clarifying owner and deadline.'}`.trim()
        );
      }
      toast(isPolish ? 'Użyto lokalnej podpowiedzi AI' : 'Applied local AI fallback hint', { icon: '⚠️' });
    } finally {
      setIsEnhancingCommentDraft(false);
    }
  };

  const submitCommentDraft = async () => {
    const trimmed = commentDraft.trim();
    if (!trimmed) return;
    await handleAddComment(trimmed, undefined, { priority: commentDraftPriority });
    setCommentDraft('');
  };

  // Linked items handlers
  const hydrateLinkedItem = useCallback(
    async (item: LinkedItem): Promise<{ linkedItem: LinkedItem; synced: boolean }> => {
      if (item.type === 'external') return { linkedItem: item, synced: true };

      const encodedId = encodeURIComponent(String(item.id));
      const endpointCandidates =
        item.type === 'task'
          ? [`/tasks/${encodedId}`]
          : item.type === 'decision'
            ? [`/decisions/${encodedId}`]
            : item.type === 'initiative'
              ? [`/initiatives/${encodedId}`]
              : item.type === 'project'
                ? [`/projects/${encodedId}`]
                : item.type === 'assessment'
                  ? [`/assessments/${encodedId}`]
                  : item.type === 'report'
                    ? [`/reports/${encodedId}`]
                    : item.type === 'tool'
                      ? [`/tools/sessions/${encodedId}`, `/tools/${encodedId}`]
                      : item.type === 'insight'
                        ? [`/interview/insights/${encodedId}`]
                        : [];

      let entity: any = null;
      for (const endpoint of endpointCandidates) {
        try {
          entity = await Api.get(endpoint);
          if (entity) break;
        } catch {
          // try next endpoint candidate
        }
      }

      if (!entity) return { linkedItem: item, synced: false };

      const title = String(entity.title || entity.name || entity.summary || item.title || 'Untitled');
      const status = String(entity.status || item.status || '').trim() || undefined;
      const priority = String(entity.priority || item.priority || '').trim() || undefined;
      const fallbackUrl =
        item.type === 'task'
          ? `/my-work/tasks/${encodedId}`
          : item.type === 'decision'
            ? `/my-work/decisions/${encodedId}`
            : item.type === 'initiative'
              ? `/initiatives/${encodedId}`
              : item.type === 'project'
                ? `/projects/${encodedId}`
                : item.type === 'assessment'
                  ? '/assessment'
                  : item.type === 'report'
                    ? `/assessment-reports/${encodedId}`
                    : item.type === 'tool'
                      ? '/tools'
                      : item.type === 'insight'
                        ? '/interview'
                        : item.url;

      return {
        linkedItem: {
          ...item,
          title,
          status,
          priority,
          url: item.url || fallbackUrl,
        },
        synced: true,
      };
    },
    []
  );

  const handleAddLinkedItem = async (item: LinkedItem) => {
    if (isDecisionStageLocked) return;
    if (linkedItems.some((existing) => existing.id === item.id && existing.type === item.type)) {
      toast(isPolish ? 'To powiązanie już istnieje' : 'This link already exists', { icon: 'ℹ️' });
      return;
    }
    const { linkedItem, synced } = await hydrateLinkedItem(item);
    setLinkedItems((prev) => {
      if (prev.some((existing) => existing.id === linkedItem.id && existing.type === linkedItem.type)) {
        return prev;
      }
      return [...prev, linkedItem];
    });
    if (item.type !== 'external' && !synced) {
      toast(
        isPolish
          ? 'Link dodany, ale nie udało się zsynchronizować danych. To sygnał, że linkowanie może nie działać poprawnie.'
          : 'Link added, but metadata sync failed. This is a sign that internal linking may be broken.',
        { icon: '⚠️' }
      );
    }
  };

  const handleRemoveLinkedItem = async (
    linkToRemove: string | Pick<LinkedItem, 'id' | 'type'>
  ) => {
    if (isDecisionStageLocked) return;
    if (typeof linkToRemove === 'string') {
      setLinkedItems(linkedItems.filter((i) => i.id !== linkToRemove));
      return;
    }
    setLinkedItems(
      linkedItems.filter((i) => !(i.id === linkToRemove.id && i.type === linkToRemove.type))
    );
  };

  const searchLinkedItems = useCallback(async (query: string) => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    try {
      const [
        tasksRes,
        initiativesRes,
        decisionsRes,
        projectsRes,
        assessmentsRes,
        reportsRes,
        toolsRes,
        insightsRes,
      ] =
        await Promise.allSettled([
        Api.get('/tasks?limit=50'),
        Api.get('/initiatives'),
        Api.getDecisions(),
        Api.getProjects(),
        Api.get('/assessments'),
        Api.get('/reports'),
        Api.listToolSessions({ limit: 50 }),
        Api.get('/interview/insights'),
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
      const projects =
        projectsRes.status === 'fulfilled'
          ? Array.isArray(projectsRes.value)
            ? projectsRes.value
            : projectsRes.value?.projects || []
          : [];
      const assessments =
        assessmentsRes.status === 'fulfilled'
          ? Array.isArray(assessmentsRes.value)
            ? assessmentsRes.value
            : assessmentsRes.value?.assessments || []
          : [];
      const reports =
        reportsRes.status === 'fulfilled'
          ? Array.isArray(reportsRes.value)
            ? reportsRes.value
            : reportsRes.value?.reports || []
          : [];
      const tools =
        toolsRes.status === 'fulfilled'
          ? Array.isArray(toolsRes.value)
            ? toolsRes.value
            : toolsRes.value?.items || []
          : [];
      const insights =
        insightsRes.status === 'fulfilled'
          ? Array.isArray(insightsRes.value)
            ? insightsRes.value
            : insightsRes.value?.insights || []
          : [];

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
      const mappedProjects: LinkedItem[] = projects
        .filter((p: any) =>
          String(p.name || p.title || '')
            .toLowerCase()
            .includes(q)
        )
        .slice(0, 10)
        .map((p: any) => ({
          id: String(p.id),
          type: 'project',
          title: String(p.name || p.title || 'Project'),
          status: p.status,
          priority: p.priority,
        }));
      const mappedAssessments: LinkedItem[] = assessments
        .filter((a: any) =>
          String(a.title || a.name || '')
            .toLowerCase()
            .includes(q)
        )
        .slice(0, 8)
        .map((a: any) => ({
          id: String(a.id),
          type: 'assessment',
          title: String(a.title || a.name || 'Assessment'),
          status: a.status,
          url: '/assessment',
        }));
      const mappedReports: LinkedItem[] = reports
        .filter((r: any) =>
          String(r.title || r.name || '')
            .toLowerCase()
            .includes(q)
        )
        .slice(0, 8)
        .map((r: any) => ({
          id: String(r.id),
          type: 'report',
          title: String(r.title || r.name || 'Report'),
          status: r.status,
          url: `/assessment-reports/${String(r.id)}`,
        }));
      const mappedTools: LinkedItem[] = tools
        .filter((tool: any) =>
          String(tool.name || tool.title || tool.toolType || '')
            .toLowerCase()
            .includes(q)
        )
        .slice(0, 8)
        .map((tool: any) => ({
          id: String(tool.id),
          type: 'tool',
          title: String(tool.name || tool.title || tool.toolType || 'Tool'),
          status: tool.status,
          url: '/tools',
        }));
      const mappedInsights: LinkedItem[] = insights
        .filter((insight: any) =>
          String(insight.title || insight.name || insight.summary || '')
            .toLowerCase()
            .includes(q)
        )
        .slice(0, 8)
        .map((insight: any) => ({
          id: String(insight.id),
          type: 'insight',
          title: String(insight.title || insight.name || 'Insight'),
          status: insight.status,
          url: '/interview',
        }));

      return [
        ...mappedTasks,
        ...mappedInitiatives,
        ...mappedDecisions,
        ...mappedProjects,
        ...mappedAssessments,
        ...mappedReports,
        ...mappedTools,
        ...mappedInsights,
      ].slice(0, 24);
    } catch {
      return [];
    }
  }, [isPolish]);

  useEffect(() => {
    if (!isInternalLinkModalOpen) {
      setLinkSearchQuery('');
      setLinkSearchResults([]);
      setIsLinkSearching(false);
      return;
    }
    const query = linkSearchQuery.trim();
    if (query.length < 2) {
      setLinkSearchResults([]);
      setIsLinkSearching(false);
      return;
    }

    let cancelled = false;
    setIsLinkSearching(true);
    const timeoutId = window.setTimeout(async () => {
      const results = await searchLinkedItems(query);
      if (cancelled) return;
      const existing = new Set(linkedItems.map((item) => `${item.type}:${item.id}`));
      setLinkSearchResults(results.filter((item) => !existing.has(`${item.type}:${item.id}`)));
      setIsLinkSearching(false);
    }, 260);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [isInternalLinkModalOpen, linkSearchQuery, linkedItems, searchLinkedItems]);

  const handlePickSearchedLinkedItem = async (item: LinkedItem) => {
    await handleAddLinkedItem(item);
    setIsInternalLinkModalOpen(false);
    setLinkSearchQuery('');
    setLinkSearchResults([]);
  };

  const handleSaveExternalLinkedItem = async () => {
    const titleTrimmed = externalLinkTitle.trim();
    const urlTrimmed = externalLinkUrl.trim();
    const commentTrimmed = externalLinkComment.trim();
    if (!urlTrimmed) {
      toast.error(isPolish ? 'Podaj URL linku' : 'Provide link URL');
      return;
    }
    const title = titleTrimmed || urlTrimmed;
    await handleAddLinkedItem({
      id: `external-${Date.now()}`,
      type: 'external',
      title,
      status: isPolish ? 'Zewnętrzny' : 'External',
      externalUrl: urlTrimmed,
      url: urlTrimmed,
      comment: commentTrimmed || undefined,
    });
    setExternalLinkTitle('');
    setExternalLinkUrl('');
    setExternalLinkComment('');
    setIsExternalLinkModalOpen(false);
  };

  const openInternalLinkModal = () => {
    setLinkSearchQuery('');
    setLinkSearchResults([]);
    setResourceMenuKey(null);
    internalLinksSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setIsInternalLinkModalOpen(true);
  };

  const openExternalLinkModal = () => {
    setExternalLinkTitle('');
    setExternalLinkUrl('');
    setExternalLinkComment('');
    setResourceMenuKey(null);
    externalLinksSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setIsExternalLinkModalOpen(true);
  };

  const openAttachmentModal = () => {
    setResourceMenuKey(null);
    attachmentsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setAttachmentDiskFiles([]);
    setAttachmentSource('device');
    setSelectedCloudProvider('google-drive');
    setIsAttachmentModalOpen(true);
  };

  const closeAttachmentModal = useCallback(() => {
    setIsAttachmentModalOpen(false);
    setAttachmentDiskFiles([]);
    setAttachmentSource('device');
    setSelectedCloudProvider('google-drive');
    closeFilePicker();
  }, [closeFilePicker]);

  const openIntegrationsSettings = useCallback(() => {
    window.location.assign(ROUTES.SETTINGS.INTEGRATIONS);
  }, []);

  const handleCloudFilePickerSelect = useCallback(
    async (file: CloudFile) => {
      if (!activeProvider) return;
      const downloadedFile = await selectFile(file, activeProvider);
      if (downloadedFile) {
        setAttachmentDiskFiles((prev) => [...prev, downloadedFile]);
        toast.success(
          isPolish
            ? `Dodano plik z chmury: ${downloadedFile.name}`
            : `Added cloud file: ${downloadedFile.name}`
        );
      } else {
        toast.error(
          isPolish
            ? 'Nie udało się pobrać pliku z chmury'
            : 'Failed to download selected cloud file'
        );
      }
      closeFilePicker();
    },
    [activeProvider, closeFilePicker, isPolish, selectFile]
  );

  const openCloudProviderPicker = useCallback(() => {
    const isConnected = connectedProviderIds.includes(selectedCloudProvider);
    if (!isConnected) {
      toast(
        isPolish
          ? 'Najpierw podłącz wybraną chmurę w Ustawieniach → Integracje'
          : 'Connect this cloud provider first in Settings → Integrations',
        { icon: '🔗' }
      );
      return;
    }
    if (!isCloudImplemented) {
      toast(
        isPolish
          ? 'Integracje chmurowe są przygotowane, pełna obsługa będzie dostępna wkrótce.'
          : 'Cloud integrations are prepared; full support will be available soon.',
        { icon: '⏳' }
      );
      return;
    }
    openFilePicker(selectedCloudProvider);
  }, [connectedProviderIds, isCloudImplemented, isPolish, openFilePicker, selectedCloudProvider]);

  const openEditLinkedItemModal = (item: LinkedItem) => {
    setResourceMenuKey(null);
    setEditingLinkedItemKey(`${item.type}:${item.id}`);
    setEditingLinkedItemDraft({ ...item });
  };

  const saveEditedLinkedItem = () => {
    if (!editingLinkedItemDraft || !editingLinkedItemKey) return;
    const [type, id] = editingLinkedItemKey.split(':');
    setLinkedItems((prev) =>
      prev.map((item) =>
        item.type === type && item.id === id
          ? {
              ...item,
              title: editingLinkedItemDraft.title,
              status: editingLinkedItemDraft.status,
              externalUrl: editingLinkedItemDraft.externalUrl,
              url: editingLinkedItemDraft.url,
              comment: editingLinkedItemDraft.comment,
            }
          : item
      )
    );
    setEditingLinkedItemKey(null);
    setEditingLinkedItemDraft(null);
  };

  const openEditAttachmentModal = (attachment: Attachment) => {
    setResourceMenuKey(null);
    setEditingAttachmentId(attachment.id);
    setEditingAttachmentDraft({ ...attachment });
  };

  useEffect(() => {
    const closeMenu = () => setResourceMenuKey(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      closeAttachmentModal();
      setIsInternalLinkModalOpen(false);
      setLinkSearchQuery('');
      setLinkSearchResults([]);
      setIsExternalLinkModalOpen(false);
      setExternalLinkTitle('');
      setExternalLinkUrl('');
      setExternalLinkComment('');
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [closeAttachmentModal]);

  const saveEditedAttachment = () => {
    if (!editingAttachmentId || !editingAttachmentDraft) return;
    setAttachments((prev) =>
      prev.map((attachment) =>
        attachment.id === editingAttachmentId
          ? {
              ...attachment,
              name: editingAttachmentDraft.name,
              url: editingAttachmentDraft.url,
            }
          : attachment
      )
    );
    setEditingAttachmentId(null);
    setEditingAttachmentDraft(null);
  };

  const saveAttachmentFromModal = async () => {
    if (attachmentDiskFiles.length === 0) {
      toast.error(isPolish ? 'Wybierz co najmniej jeden plik' : 'Choose at least one file');
      return;
    }
    const dt = new DataTransfer();
    attachmentDiskFiles.forEach((file) => dt.items.add(file));
    await handleUploadAttachments(dt.files);
    closeAttachmentModal();
  };

  const getLinkedStatusBadgeClass = (status?: string) => {
    const normalized = String(status || '').trim().toLowerCase();
    if (!normalized) return 'border-slate-300/50 text-slate-400 bg-slate-500/10';
    if (['approved', 'completed', 'done', 'closed', 'mitigated', 'resolved'].includes(normalized)) {
      return 'border-emerald-400/40 text-emerald-400 bg-emerald-500/10';
    }
    if (['in progress', 'in_progress', 'active', 'open', 'monitoring', 'monitored'].includes(normalized)) {
      return 'border-blue-400/40 text-blue-400 bg-blue-500/10';
    }
    if (['pending', 'review', 'deferred', 'draft'].includes(normalized)) {
      return 'border-amber-400/40 text-amber-400 bg-amber-500/10';
    }
    if (['blocked', 'rejected', 'critical', 'overdue'].includes(normalized)) {
      return 'border-red-400/40 text-red-400 bg-red-500/10';
    }
    return 'border-slate-300/50 text-slate-400 bg-slate-500/10';
  };

  const openLinkedItemTarget = (item: LinkedItem) => {
    const explicitUrl = item.externalUrl || item.url;
    const normalizedItemId = String(item.id);
    const fallbackPath =
      item.type === 'task'
        ? `/my-work/tasks/${normalizedItemId}`
        : item.type === 'decision'
          ? `/my-work/decisions/${normalizedItemId}`
          : item.type === 'initiative'
            ? `/initiatives/${normalizedItemId}`
            : item.type === 'project'
              ? `/projects/${normalizedItemId}`
              : item.type === 'assessment'
                ? '/assessment'
                : item.type === 'report'
                  ? `/assessment-reports/${normalizedItemId}`
                  : item.type === 'tool'
                    ? '/tools'
                    : item.type === 'insight'
                      ? '/interview'
            : null;
    const target = explicitUrl || fallbackPath;
    if (!target) {
      toast(isPolish ? 'Brak docelowego linku' : 'No target link available', { icon: 'ℹ️' });
      return;
    }
    window.open(target, '_blank', 'noopener,noreferrer');
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
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
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
                {decisionId && (
                  <>
                    <span className="hidden sm:inline-flex px-2 py-1 rounded-md border border-slate-300/50 dark:border-navy-600/70 text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400">
                      {buildArtifactCode('decision', decisionId)}
                    </span>
                    <ArtifactPermalinkButton
                      artifactType="decision"
                      artifactId={decisionId}
                      isPolish={isPolish}
                      size={14}
                    />
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSave}
                  disabled={saving || !isDirty}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm disabled:cursor-not-allowed ${
                    isDirty
                      ? 'bg-white/70 dark:bg-navy-900/50 border border-blue-500/40 dark:border-blue-400/30 text-blue-700 dark:text-blue-300 hover:bg-blue-500/10 dark:hover:bg-blue-500/10'
                      : 'bg-slate-100/70 dark:bg-navy-900/40 border border-slate-300/50 dark:border-navy-700/60 text-slate-400 dark:text-slate-500'
                  } ${saving ? 'opacity-70' : ''}`}
                  title={
                    isDirty
                      ? isPolish
                        ? 'Zapisz i opublikuj zmiany'
                        : 'Save and publish changes'
                      : isPolish
                        ? 'Brak zmian do zapisu'
                        : 'No changes to save'
                  }
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  <span>
                    {isDirty
                      ? isPolish
                        ? 'Zapisz'
                        : 'Save'
                      : isPolish
                        ? 'Zapisane'
                        : 'Saved'}
                  </span>
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
                {draftSavedLabel && (
                  <span className="hidden xl:inline text-xs text-slate-500 dark:text-slate-400">
                    {draftSavedLabel}
                  </span>
                )}
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
                          <div className="mb-2 flex items-center justify-end">
                            {renderFieldAIButton(
                              'd-description',
                              'Decision Description',
                              description,
                              setDescription
                            )}
                          </div>
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
                            <div className="mb-2 flex items-center justify-between">
                              <label className="block text-xs font-medium text-amber-700 dark:text-amber-300">
                                {isPolish
                                  ? 'Konsekwencje braku decyzji'
                                  : 'Consequences of Inaction'}
                              </label>
                              {renderFieldAIButton(
                                'd-rationale',
                                'Consequences of Inaction',
                                rationale,
                                setRationale
                              )}
                            </div>
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
                  allowedTypes={[
                    'task',
                    'initiative',
                    'decision',
                    'risk',
                    'project',
                    'assessment',
                    'report',
                    'tool',
                    'insight',
                    'external',
                  ]}
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
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as keyof typeof STATUS_CONFIG)}
                      className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-50 dark:bg-navy-800 border ${statusAlertBorderClass} text-slate-700 dark:text-slate-200 focus:outline-none focus:border-primary-400 transition-colors`}
                    >
                      {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                        <option key={key} value={key}>
                          {isPolish ? config.label.pl : config.label.en}
                        </option>
                      ))}
                    </select>
                  </div>
                  {/* Priority */}
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {isPolish ? 'Priorytet' : 'Priority'}
                    </label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as keyof typeof PRIORITY_CONFIG)}
                      className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-50 dark:bg-navy-800 border ${priorityAlertBorderClass} text-slate-700 dark:text-slate-200 focus:outline-none focus:border-primary-400 transition-colors`}
                    >
                      {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                        <option key={key} value={key}>
                          {isPolish ? config.label.pl : config.label.en}
                        </option>
                      ))}
                    </select>
                  </div>
                  {/* Created date */}
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {isPolish ? 'Data utworzenia' : 'Created date'}
                    </label>
                    <input
                      type="date"
                      value={createdAt ? createdAt.split('T')[0] : ''}
                      onChange={(e) => setCreatedAt(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200/60 dark:border-navy-600/60 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-primary-400 transition-colors"
                    />
                  </div>
                  {/* Due date */}
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {isPolish ? 'Termin' : 'Deadline'}
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className={`w-full px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-navy-800 border ${dueDateAlertBorderClass} text-slate-700 dark:text-slate-200 focus:outline-none focus:border-primary-400 transition-colors`}
                    />
                  </div>
                  {/* Requester */}
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {isPolish ? 'Wnioskodawca' : 'Requester'}
                    </label>
                    <input
                      value={requesterName}
                      onChange={(e) => setRequesterName(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200/60 dark:border-navy-600/60 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-primary-400 transition-colors"
                      placeholder={isPolish ? 'Wnioskodawca...' : 'Requester...'}
                    />
                  </div>
                  {/* Decider */}
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {isPolish ? 'Decydent' : 'Decider'}
                    </label>
                    <select
                      value={deciderId}
                      onChange={(e) => setDeciderId(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200/60 dark:border-navy-600/60 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-primary-400 transition-colors"
                    >
                      <option value="">—</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.firstName} {u.lastName}
                        </option>
                      ))}
                    </select>
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
                    {activeNotionSection === 'options-tradeoffs' && (
                      <button
                        onClick={generateAlternativesAI}
                        disabled={isDecisionStageLocked || isGeneratingAlternatives}
                        className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          isGeneratingAlternatives
                            ? 'border-primary-400/50 text-primary-600 dark:text-primary-300 bg-primary-500/10'
                            : 'border-primary-400/50 text-primary-600 dark:text-primary-300 bg-primary-500/10 hover:bg-primary-500/15'
                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                        title={isPolish ? 'Generuj opcje przez AI' : 'Generate options with AI'}
                      >
                        {isGeneratingAlternatives ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Sparkles size={13} />
                        )}
                        {isPolish ? 'Generuj opcje' : 'Generate options'}
                      </button>
                    )}
                    {activeNotionSection === 'risk-impact' && (
                      <button
                        onClick={generateRisksAI}
                        disabled={isDecisionStageLocked || isGeneratingRisks}
                        className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          isGeneratingRisks
                            ? 'border-primary-400/50 text-primary-600 dark:text-primary-300 bg-primary-500/10'
                            : 'border-primary-400/50 text-primary-600 dark:text-primary-300 bg-primary-500/10 hover:bg-primary-500/15'
                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                        title={isPolish ? 'Analizuj ryzyka przez AI' : 'Analyze risks with AI'}
                      >
                        {isGeneratingRisks ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Sparkles size={13} />
                        )}
                        {isPolish ? 'Analizuj ryzyka' : 'Analyze risks'}
                      </button>
                    )}
                    {activeNotionSection === 'governance-escalation' && (
                      <button
                        onClick={suggestStakeholdersAI}
                        disabled={isDecisionStageLocked || isSuggestingStakeholders}
                        className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          isSuggestingStakeholders
                            ? 'border-primary-400/50 text-primary-600 dark:text-primary-300 bg-primary-500/10'
                            : 'border-primary-400/50 text-primary-600 dark:text-primary-300 bg-primary-500/10 hover:bg-primary-500/15'
                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                        title={isPolish ? 'Generuj RACI przez AI' : 'Generate RACI with AI'}
                      >
                        {isSuggestingStakeholders ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Sparkles size={13} />
                        )}
                        {isPolish ? 'Generuj RACI' : 'Generate RACI'}
                      </button>
                    )}
                    {activeNotionSection === 'comments' && (
                      <button
                        onClick={generateAIComment}
                        disabled={isDecisionStageLocked || isGeneratingAIComment}
                        className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          isGeneratingAIComment
                            ? 'border-primary-400/50 text-primary-600 dark:text-primary-300 bg-primary-500/10'
                            : 'border-primary-400/50 text-primary-600 dark:text-primary-300 bg-primary-500/10 hover:bg-primary-500/15'
                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                        title={isPolish ? 'Generuj komentarz przez AI' : 'Generate AI comment'}
                      >
                        {isGeneratingAIComment ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Sparkles size={13} />
                        )}
                        {isPolish ? 'AI komentarze' : 'AI comments'}
                      </button>
                    )}
                    {activeNotionSection === 'consequences' && (
                      <button
                        onClick={() => generateConsequenceScenariosAI()}
                        disabled={isDecisionStageLocked || isGeneratingConsequenceScenarios}
                        className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          isGeneratingConsequenceScenarios
                            ? 'border-primary-400/50 text-primary-600 dark:text-primary-300 bg-primary-500/10'
                            : 'border-primary-400/50 text-primary-600 dark:text-primary-300 bg-primary-500/10 hover:bg-primary-500/15'
                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                        title={isPolish ? 'Uruchom analizę konsekwencji przez AI' : 'Run AI consequence analysis'}
                      >
                        {isGeneratingConsequenceScenarios ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Sparkles size={13} />
                        )}
                        {isPolish ? 'Analizuj konsekwencje' : 'Analyze consequences'}
                      </button>
                    )}
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
                        <div className="space-y-6">
                          <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                              {isPolish ? 'Zakres decyzji' : 'Decision Scope'}
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

                          {/* 1) Related item from linked records */}
                          <div className="space-y-2">
                            <label className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                              {isPolish ? 'Dotyczy' : 'Related to'}
                            </label>
                            {relatedDecisionItems.length === 0 ? (
                              <div className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border border-amber-400/60 text-amber-600 dark:text-amber-300 bg-amber-500/10">
                                {isPolish ? 'Brak podpiętego elementu' : 'No linked item'}
                              </div>
                            ) : (
                              <div className="space-y-1">
                                {relatedDecisionItems.map((item) => (
                                  <div
                                    key={item.id}
                                    className="flex items-center justify-between gap-3 text-sm text-slate-700 dark:text-slate-300"
                                  >
                                    <div className="flex min-w-0 items-center gap-2">
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium border border-primary-400/50 text-primary-600 dark:text-primary-300 bg-primary-500/10 uppercase">
                                        {item.type}
                                      </span>
                                      <span className="truncate">{item.title}</span>
                                    </div>
                                    <span className="shrink-0 text-[11px] font-mono text-slate-500/70 dark:text-slate-500/70">
                                      {getLinkedItemIndex(item)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* 2) Decision scope */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                {isPolish ? 'Zakres decyzji' : 'Decision scope'}
                              </label>
                              {renderFieldAIButton(
                                'n-description',
                                'Decision Scope',
                                description,
                                setDescription
                              )}
                            </div>
                            <div className="relative">
                              <textarea
                                value={description}
                                onChange={(e) =>
                                  !isDecisionStageLocked && setDescription(e.target.value)
                                }
                                readOnly={isDecisionStageLocked}
                                rows={isDescriptionExpanded ? 10 : 6}
                                className="w-full px-0 py-2 bg-transparent text-sm leading-relaxed text-slate-700 dark:text-slate-300 focus:outline-none placeholder-slate-400 dark:placeholder-slate-600 resize-y border-b border-slate-200/40 dark:border-navy-700/40 focus:border-primary-400 transition-colors"
                                placeholder={
                                  isPolish
                                    ? 'Opisz zakres decyzji (co dokładnie podlega decyzji)...'
                                    : 'Describe the decision scope (what exactly is being decided)...'
                                }
                              />
                              {!isDescriptionExpanded && canExpandDescription && (
                                <div className="pointer-events-none absolute bottom-7 left-0 right-0 h-10 bg-gradient-to-t from-white/90 to-transparent dark:from-navy-900/90" />
                              )}
                            </div>
                            {canExpandDescription && (
                              <button
                                onClick={() => setIsDescriptionExpanded((prev) => !prev)}
                                className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                              >
                                {isDescriptionExpanded ? (
                                  <>
                                    <ChevronsUpDown size={12} />
                                    {isPolish ? 'Pokaż mniej' : 'See less'}
                                  </>
                                ) : (
                                  <>
                                    <ChevronsUpDown size={12} />
                                    {isPolish ? 'Pokaż więcej' : 'See more'}
                                  </>
                                )}
                              </button>
                            )}
                          </div>

                          {/* 3) Additional context */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                {isPolish ? 'Kontekst uzupełniający' : 'Additional context'}
                              </label>
                              {renderFieldAIButton(
                                'n-context',
                                'Additional Context',
                                contextDetails,
                                setContextDetails
                              )}
                            </div>
                            <div className="relative">
                              <textarea
                                value={contextDetails}
                                onChange={(e) =>
                                  !isDecisionStageLocked && setContextDetails(e.target.value)
                                }
                                readOnly={isDecisionStageLocked}
                                rows={isContextExpanded ? 8 : 5}
                                className="w-full px-0 py-2 bg-transparent text-sm leading-relaxed text-slate-700 dark:text-slate-300 focus:outline-none placeholder-slate-400 dark:placeholder-slate-600 resize-y border-b border-slate-200/40 dark:border-navy-700/40 focus:border-primary-400 transition-colors"
                                placeholder={
                                  isPolish
                                    ? 'Dodatkowe wyjaśnienie, założenia, ograniczenia (opcjonalnie)...'
                                    : 'Additional explanation, assumptions, constraints (optional)...'
                                }
                              />
                              {!isContextExpanded && canExpandContext && (
                                <div className="pointer-events-none absolute bottom-7 left-0 right-0 h-10 bg-gradient-to-t from-white/90 to-transparent dark:from-navy-900/90" />
                              )}
                            </div>
                            {canExpandContext && (
                              <button
                                onClick={() => setIsContextExpanded((prev) => !prev)}
                                className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                              >
                                {isContextExpanded ? (
                                  <>
                                    <ChevronsUpDown size={12} />
                                    {isPolish ? 'Pokaż mniej' : 'See less'}
                                  </>
                                ) : (
                                  <>
                                    <ChevronsUpDown size={12} />
                                    {isPolish ? 'Pokaż więcej' : 'See more'}
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* ── Section: Options & Trade-offs (InlineTable) ─ */}
                      {activeNotionSection === 'options-tradeoffs' && (
                        <div className="space-y-5">
                          <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                              {isPolish ? 'Opcje i trade-offy' : 'Options & Trade-offs'}
                            </h2>
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
                            <div className="space-y-0 divide-y divide-slate-300/55 dark:divide-navy-600/65">
                              {alternatives.map((alt) => (
                                <div
                                  key={alt.id}
                                  className={`py-5 first:pt-1 group ${alt.isRecommended ? 'relative' : ''}`}
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
                                  <div className="mt-1 flex justify-end gap-2">
                                    {renderFieldAIButton(
                                      `n-alt-${alt.id}`,
                                      `Option: ${alt.title || 'Option description'}`,
                                      alt.description || '',
                                      (value) => updateAlternative(alt.id, { description: value })
                                    )}
                                  </div>
                                  {/* Inline pros/cons */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 text-[11px]">
                                    <div className="space-y-1.5">
                                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                        + {alt.pros?.length || 0} {isPolish ? 'za' : 'pros'}
                                      </span>
                                      {(alt.pros || []).map((pro, idx) => (
                                        <div key={`${alt.id}-pro-${idx}`} className="flex items-center gap-1.5">
                                          <input
                                            value={pro}
                                            onChange={(e) =>
                                              updateAlternativePro(alt.id, idx, e.target.value)
                                            }
                                            className="flex-1 text-[11px] bg-transparent border-b border-emerald-400/20 text-slate-600 dark:text-slate-300 focus:outline-none focus:border-emerald-400"
                                            placeholder={isPolish ? 'Argument za...' : 'Pro argument...'}
                                          />
                                          <button
                                            onClick={() => removeAlternativePro(alt.id, idx)}
                                            className="p-0.5 text-slate-400 hover:text-red-500 transition-colors"
                                          >
                                            <X size={11} />
                                          </button>
                                        </div>
                                      ))}
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          value={altProsDraft[alt.id] || ''}
                                          onChange={(e) =>
                                            setAltProsDraft((prev) => ({
                                              ...prev,
                                              [alt.id]: e.target.value,
                                            }))
                                          }
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              e.preventDefault();
                                              addAlternativePro(alt.id, altProsDraft[alt.id] || '');
                                            }
                                          }}
                                          className="flex-1 text-[11px] bg-transparent border-b border-slate-200/60 dark:border-navy-600/60 text-slate-500 dark:text-slate-400 focus:outline-none focus:border-primary-400"
                                          placeholder={isPolish ? '+ Dodaj argument za' : '+ Add pro'}
                                        />
                                      </div>
                                      <div className="flex flex-wrap gap-1">
                                        {quickProArguments.map((arg) => (
                                          <button
                                            key={`${alt.id}-quick-pro-${arg}`}
                                            onClick={() => addAlternativePro(alt.id, arg)}
                                            className="px-1.5 py-0.5 rounded border border-emerald-400/30 text-emerald-600 dark:text-emerald-400 text-[10px] hover:bg-emerald-500/10 transition-colors"
                                          >
                                            +{arg}
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="space-y-1.5">
                                      <span className="text-red-500 dark:text-red-400 font-medium">
                                        − {alt.cons?.length || 0} {isPolish ? 'przeciw' : 'cons'}
                                      </span>
                                      {(alt.cons || []).map((con, idx) => (
                                        <div key={`${alt.id}-con-${idx}`} className="flex items-center gap-1.5">
                                          <input
                                            value={con}
                                            onChange={(e) =>
                                              updateAlternativeCon(alt.id, idx, e.target.value)
                                            }
                                            className="flex-1 text-[11px] bg-transparent border-b border-red-400/20 text-slate-600 dark:text-slate-300 focus:outline-none focus:border-red-400"
                                            placeholder={isPolish ? 'Argument przeciw...' : 'Con argument...'}
                                          />
                                          <button
                                            onClick={() => removeAlternativeCon(alt.id, idx)}
                                            className="p-0.5 text-slate-400 hover:text-red-500 transition-colors"
                                          >
                                            <X size={11} />
                                          </button>
                                        </div>
                                      ))}
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          value={altConsDraft[alt.id] || ''}
                                          onChange={(e) =>
                                            setAltConsDraft((prev) => ({
                                              ...prev,
                                              [alt.id]: e.target.value,
                                            }))
                                          }
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              e.preventDefault();
                                              addAlternativeCon(alt.id, altConsDraft[alt.id] || '');
                                            }
                                          }}
                                          className="flex-1 text-[11px] bg-transparent border-b border-slate-200/60 dark:border-navy-600/60 text-slate-500 dark:text-slate-400 focus:outline-none focus:border-primary-400"
                                          placeholder={isPolish ? '+ Dodaj argument przeciw' : '+ Add con'}
                                        />
                                      </div>
                                      <div className="flex flex-wrap gap-1">
                                        {quickConArguments.map((arg) => (
                                          <button
                                            key={`${alt.id}-quick-con-${arg}`}
                                            onClick={() => addAlternativeCon(alt.id, arg)}
                                            className="px-1.5 py-0.5 rounded border border-red-400/30 text-red-500 dark:text-red-400 text-[10px] hover:bg-red-500/10 transition-colors"
                                          >
                                            +{arg}
                                          </button>
                                        ))}
                                      </div>
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
                            <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
                              <span>
                                {isPolish
                                  ? 'Posortowane wg najwyższego risk score (P×I)'
                                  : 'Sorted by highest risk score (P×I)'}
                              </span>
                              <span>{isPolish ? `${risks.length} ryzyk` : `${risks.length} risks`}</span>
                            </div>
                          )}

                          {risks.length > 0 && (
                            <div className="space-y-0 divide-y divide-slate-300/55 dark:divide-navy-600/65">
                              <div className="py-2 text-[10px] flex flex-wrap items-center gap-1.5 text-slate-400 dark:text-slate-500">
                                <span>{isPolish ? 'Legenda poziomów:' : 'Level legend:'}</span>
                                {riskLevelOptions.map((level) => (
                                  <span
                                    key={`legend-${level}`}
                                    className={`px-1.5 py-0.5 rounded border font-medium ${getRiskLevelClass(level)}`}
                                  >
                                    {getRiskLevelLabel(level)}
                                  </span>
                                ))}
                              </div>
                              {sortedRisks.map((risk) => (
                                <div key={risk.id} className="py-5 first:pt-2 group">
                                  <div className="p-5 rounded-xl bg-slate-50/20 dark:bg-navy-900/25 space-y-5">
                                    {/* Top full-width: title + score + selectors */}
                                    <div className="space-y-3">
                                      <div className="flex items-start justify-between gap-3">
                                        <input
                                          value={risk.title}
                                          onChange={(e) =>
                                            updateRisk(risk.id, { title: e.target.value })
                                          }
                                          className="flex-1 text-sm font-medium bg-transparent text-slate-800 dark:text-white focus:outline-none placeholder-slate-400"
                                          placeholder={isPolish ? 'Nazwa ryzyka...' : 'Risk name...'}
                                        />
                                        <div className="flex items-center gap-2">
                                          <span
                                            className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${getRiskScoreClass(getRiskScore(risk))}`}
                                          >
                                            Score {getRiskScore(risk)}
                                          </span>
                                          <button
                                            onClick={() => removeRisk(risk.id)}
                                            className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                          >
                                            <X size={12} />
                                          </button>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                        <div className="space-y-1">
                                          <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                            {isPolish ? 'Prawdopodobieństwo' : 'Probability'}
                                          </span>
                                          <select
                                            value={risk.probability}
                                            onChange={(e) =>
                                              updateRisk(risk.id, {
                                                probability: e.target.value as any,
                                              })
                                            }
                                            className={`w-full text-[11px] px-2 py-1 rounded-md border focus:outline-none focus:border-primary-400 ${getRiskLevelClass(
                                              risk.probability
                                            )}`}
                                          >
                                            {riskLevelOptions.map((level) => (
                                              <option key={`p-${risk.id}-${level}`} value={level}>
                                                {getRiskLevelLabel(level)}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                        <div className="space-y-1">
                                          <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                            {isPolish ? 'Wpływ' : 'Impact'}
                                          </span>
                                          <select
                                            value={risk.impact}
                                            onChange={(e) =>
                                              updateRisk(risk.id, { impact: e.target.value as any })
                                            }
                                            className={`w-full text-[11px] px-2 py-1 rounded-md border focus:outline-none focus:border-primary-400 ${getRiskLevelClass(
                                              risk.impact
                                            )}`}
                                          >
                                            {riskLevelOptions.map((level) => (
                                              <option key={`i-${risk.id}-${level}`} value={level}>
                                                {getRiskLevelLabel(level)}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                        <div className="space-y-1">
                                          <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                            {isPolish ? 'Kategoria' : 'Category'}
                                          </span>
                                          <select
                                            value={risk.category || 'business'}
                                            onChange={(e) =>
                                              updateRisk(risk.id, { category: e.target.value as any })
                                            }
                                            className="w-full text-[11px] px-2 py-1 rounded-md bg-slate-50/70 dark:bg-navy-800/70 border border-slate-200/60 dark:border-navy-600/60 text-slate-600 dark:text-slate-300 focus:outline-none focus:border-primary-400"
                                          >
                                            {riskCategoryOptions.map((cat) => (
                                              <option key={`c-${risk.id}-${cat.value}`} value={cat.value}>
                                                {cat.label}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Bottom two columns: left risk, right mitigation */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                                      <div className="space-y-1">
                                        <div className="flex items-center justify-between">
                                          <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                            {isPolish ? 'Ryzyko (materializacja)' : 'Risk (materialized)'}
                                          </span>
                                          {renderFieldAIButton(
                                            `n-risk-con-${risk.id}`,
                                            `Risk contingency: ${risk.title || 'Risk'}`,
                                            risk.contingency || '',
                                            (value) => updateRisk(risk.id, { contingency: value })
                                          )}
                                        </div>
                                        <textarea
                                          value={risk.contingency || ''}
                                          onChange={(e) =>
                                            updateRisk(risk.id, { contingency: e.target.value })
                                          }
                                          rows={4}
                                          className="w-full min-h-[92px] text-xs bg-transparent border-b border-slate-200/60 dark:border-navy-700/60 text-slate-500 dark:text-slate-400 focus:outline-none focus:border-primary-400 resize-y"
                                          placeholder={
                                            isPolish
                                              ? 'Co robimy, gdy ryzyko się zmaterializuje?'
                                              : 'What is the fallback if risk materializes?'
                                          }
                                        />
                                        <div className="flex flex-wrap gap-1">
                                          {quickContingencyArguments.map((arg) => (
                                            <button
                                              key={`${risk.id}-con-${arg}`}
                                              onClick={() =>
                                                updateRisk(risk.id, {
                                                  contingency: risk.contingency
                                                    ? `${risk.contingency}\n- ${arg}`
                                                    : `- ${arg}`,
                                                })
                                              }
                                              className="px-1.5 py-0.5 rounded border border-red-400/30 text-red-500 dark:text-red-400 text-[10px] hover:bg-red-500/10 transition-colors"
                                            >
                                              +{arg}
                                            </button>
                                          ))}
                                        </div>
                                      </div>

                                      <div className="space-y-1">
                                        <div className="flex items-center justify-between">
                                          <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                            {isPolish ? 'Mitigacja' : 'Mitigation'}
                                          </span>
                                          {renderFieldAIButton(
                                            `n-risk-mit-${risk.id}`,
                                            `Risk mitigation: ${risk.title || 'Risk'}`,
                                            risk.mitigation || '',
                                            (value) => updateRisk(risk.id, { mitigation: value })
                                          )}
                                        </div>
                                        <textarea
                                          value={risk.mitigation || ''}
                                          onChange={(e) =>
                                            updateRisk(risk.id, { mitigation: e.target.value })
                                          }
                                          rows={4}
                                          className="w-full min-h-[92px] text-xs bg-transparent border-b border-slate-200/60 dark:border-navy-700/60 text-slate-500 dark:text-slate-400 focus:outline-none focus:border-primary-400 resize-y"
                                          placeholder={
                                            isPolish
                                              ? 'Jak ograniczamy to ryzyko?'
                                              : 'How do we mitigate this risk?'
                                          }
                                        />
                                        <div className="flex flex-wrap gap-1">
                                          {quickMitigationArguments.map((arg) => (
                                            <button
                                              key={`${risk.id}-mit-${arg}`}
                                              onClick={() =>
                                                updateRisk(risk.id, {
                                                  mitigation: risk.mitigation
                                                    ? `${risk.mitigation}\n- ${arg}`
                                                    : `- ${arg}`,
                                                })
                                              }
                                              className="px-1.5 py-0.5 rounded border border-emerald-400/30 text-emerald-600 dark:text-emerald-400 text-[10px] hover:bg-emerald-500/10 transition-colors"
                                            >
                                              +{arg}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
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

                        </div>
                      )}

                      {/* ── Section: Consequences (dedicated menu block) ── */}
                      {activeNotionSection === 'consequences' && (
                        <div className="space-y-6">
                          <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                              {isPolish
                                ? 'Konsekwencje braku decyzji'
                                : 'Consequences of Inaction'}
                            </h2>
                            {renderFieldAIButton(
                              'n-rationale-scenarios',
                              'Consequences of Inaction',
                              rationale,
                              setRationale
                            )}
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
                              <span>
                                {isPolish ? 'Scenariusze AI (real-time)' : 'AI scenarios (real-time)'}
                              </span>
                              <span className="text-[10px]">
                                {displayedConsequenceScenarios.source === 'ai'
                                  ? isPolish
                                    ? 'Źródło: AI'
                                    : 'Source: AI'
                                  : isPolish
                                    ? 'Źródło: fallback'
                                    : 'Source: fallback'}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 dark:text-slate-500">
                              {isGeneratingConsequenceScenarios
                                ? isPolish
                                  ? 'AI aktualizuje scenariusze...'
                                  : 'AI is updating scenarios...'
                                : null}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
                            {(
                              [
                                ['optimistic', isPolish ? 'Optymistyczny' : 'Optimistic'],
                                ['neutral', isPolish ? 'Neutralny' : 'Neutral'],
                                ['pessimistic', isPolish ? 'Pesymistyczny' : 'Pessimistic'],
                              ] as const
                            ).map(([scenarioKey, label]) => {
                              const scenario = displayedConsequenceScenarios[scenarioKey];
                              const cardStyle =
                                scenarioKey === 'optimistic'
                                  ? 'border-emerald-400/35 bg-emerald-500/5'
                                  : scenarioKey === 'neutral'
                                    ? 'border-amber-400/35 bg-amber-500/5'
                                    : 'border-red-400/35 bg-red-500/5';
                              return (
                                <div
                                  key={scenarioKey}
                                  className={`rounded-xl border p-3 space-y-3 shadow-sm ${cardStyle}`}
                                >
                                  <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                      {label}
                                    </h3>
                                    <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                      7 / 30 / 90
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-1 gap-2">
                                    {(
                                      [
                                        ['d7', '7d'],
                                        ['d30', '30d'],
                                        ['d90', '90d'],
                                      ] as const
                                    ).map(([timelineKey, timelineLabel]) => (
                                      <div
                                        key={`${scenarioKey}-${timelineKey}`}
                                        className="rounded-lg border border-slate-200/40 dark:border-navy-700/50 bg-white/30 dark:bg-navy-900/25 p-2"
                                      >
                                        <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                          {timelineLabel}
                                        </p>
                                        <textarea
                                          value={scenario[timelineKey]}
                                          onChange={(e) =>
                                            updateConsequenceScenarioCell(
                                              scenarioKey,
                                              timelineKey,
                                              e.target.value
                                            )
                                          }
                                          readOnly={isDecisionStageLocked}
                                          rows={4}
                                          className="w-full min-h-[92px] bg-transparent text-xs leading-relaxed text-slate-600 dark:text-slate-300 focus:outline-none placeholder-slate-400 dark:placeholder-slate-600 resize-y"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="pl-4 border-l-2 border-amber-400 dark:border-amber-500/60">
                            <div className="mb-2 flex items-center justify-between">
                              <label className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                {isPolish ? 'Notatka decyzyjna' : 'Decision note'}
                              </label>
                              {renderFieldAIButton(
                                'n-rationale-note',
                                'Consequences of Inaction',
                                rationale,
                                setRationale
                              )}
                            </div>
                            <textarea
                              value={rationale}
                              onChange={(e) =>
                                !isDecisionStageLocked && setRationale(e.target.value)
                              }
                              readOnly={isDecisionStageLocked}
                              rows={5}
                              className="w-full min-h-[120px] px-0 py-1 bg-transparent text-sm text-slate-700 dark:text-slate-300 focus:outline-none placeholder-amber-400/50 dark:placeholder-amber-600/40 resize-y leading-relaxed"
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
                            {isPolish ? 'RACI i eskalacja' : 'RACI & Escalation'}
                          </h2>
                          <div className="space-y-4">
                            {/* RACI table */}
                            <div className={governanceTableCardClass}>
                              <div className="flex items-center justify-between">
                                <h3 className="text-base font-semibold text-slate-700 dark:text-slate-100">
                                  {isPolish
                                    ? 'RACI (macierz odpowiedzialności)'
                                    : 'RACI (responsibility matrix)'}
                                </h3>
                                <div className="inline-flex items-center gap-2">
                                  <button
                                    disabled={isDecisionStageLocked}
                                    onClick={() => {
                                      const fallbackUser = users[0];
                                      if (!fallbackUser) return;
                                      setEditingStakeholderId('__new__');
                                      setStakeholderDraft({
                                        id: '__new__',
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
                                          integrationChannels: [],
                                          syncTargets: [],
                                        },
                                      });
                                    }}
                                    className="px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-300/60 dark:border-navy-600 text-slate-500 hover:text-primary-500 hover:border-primary-400/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    + {isPolish ? 'Dodaj osobę' : 'Add person'}
                                  </button>
                                </div>
                              </div>
                              <div className="overflow-auto flex-1">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500 border-b border-slate-200/50 dark:border-navy-700/50">
                                      <th className="text-left py-2 pr-2">{isPolish ? 'Osoba' : 'Person'}</th>
                                      <th className="text-left py-2 pr-2">{isPolish ? 'Rola' : 'Role'}</th>
                                      <th className="text-left py-2 pr-2">{isPolish ? 'Email' : 'Email'}</th>
                                      <th className="text-left py-2 pr-2">
                                        {isPolish ? 'Notyfikacje' : 'Notifications'}
                                      </th>
                                      <th className="text-right py-2">{isPolish ? 'Akcje' : 'Actions'}</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-200/40 dark:divide-navy-700/40">
                                    {stakeholders.length === 0 ? (
                                      <tr>
                                        <td colSpan={5} className="py-6 text-center text-xs text-slate-400">
                                          {isPolish ? 'Brak interesariuszy.' : 'No stakeholders yet.'}
                                        </td>
                                      </tr>
                                    ) : (
                                      stakeholders.map((s) => (
                                        <tr key={s.id}>
                                          <td className="py-2 pr-2 text-slate-700 dark:text-slate-300">
                                            {s.userName || s.userId}
                                          </td>
                                          <td className="py-2 pr-2 text-xs text-slate-600 dark:text-slate-300">
                                            {stakeholderRoleLabel(s.role)}
                                          </td>
                                          <td className="py-2 pr-2 text-slate-500 dark:text-slate-400">
                                            {s.userEmail || '—'}
                                          </td>
                                          <td className="py-2 pr-2 text-xs">
                                            <div className="flex flex-wrap gap-1">
                                              {stakeholderChannelLabels(s.notificationSettings).map((label) => (
                                                <span
                                                  key={`${s.id}-${label}`}
                                                  className="px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-navy-700/60 bg-slate-50/50 dark:bg-navy-800/50 text-[10px] text-slate-500 dark:text-slate-400"
                                                >
                                                  {label}
                                                </span>
                                              ))}
                                            </div>
                                          </td>
                                          <td className="py-2 text-right">
                                            <div className="inline-flex items-center gap-1">
                                              <button
                                                disabled={isDecisionStageLocked}
                                                onClick={() => {
                                                  setEditingStakeholderId(s.id);
                                                  setStakeholderDraft({ ...s });
                                                }}
                                                className="p-1 text-slate-400 hover:text-primary-500 disabled:opacity-40"
                                                title={isPolish ? 'Edytuj' : 'Edit'}
                                              >
                                                <Edit3 size={13} />
                                              </button>
                                              <button
                                                disabled={isDecisionStageLocked}
                                                onClick={() =>
                                                  setStakeholders(stakeholders.filter((item) => item.id !== s.id))
                                                }
                                                className="p-1 text-slate-400 hover:text-red-500 disabled:opacity-40"
                                                title={isPolish ? 'Usuń' : 'Delete'}
                                              >
                                                <Trash2 size={13} />
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {/* Reminders table */}
                            <div className={governanceTableCardClass}>
                              <div className="flex items-center justify-between">
                                <h3 className="text-base font-semibold text-slate-700 dark:text-slate-100">
                                  {isPolish ? 'Przypomnienia' : 'Reminders'}
                                </h3>
                                <div className="inline-flex items-center gap-2">
                                  <button
                                    disabled={isDecisionStageLocked}
                                    onClick={() => {
                                      setEditingReminderId('__new__');
                                      setReminderDraft({
                                        id: '__new__',
                                        type: 'before_due',
                                        days: 2,
                                        recipients: 'both',
                                        inAppNotification: true,
                                        emailNotification: false,
                                        delivery: ensureDeliveryConfig({ coreChannels: ['in_app'] }),
                                        message: '',
                                        enabled: true,
                                      });
                                    }}
                                    className="px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-300/60 dark:border-navy-600 text-slate-500 hover:text-primary-500 hover:border-primary-400/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    + {isPolish ? 'Dodaj reminder' : 'Add reminder'}
                                  </button>
                                </div>
                              </div>
                              <div className="overflow-auto flex-1">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500 border-b border-slate-200/50 dark:border-navy-700/50">
                                      <th className="text-left py-2 pr-2">{isPolish ? 'Typ' : 'Type'}</th>
                                      <th className="text-left py-2 pr-2">{isPolish ? 'Dni' : 'Days'}</th>
                                      <th className="text-left py-2 pr-2">{isPolish ? 'Do kogo' : 'Recipients'}</th>
                                      <th className="text-left py-2 pr-2">
                                        {isPolish ? 'Notyfikacje' : 'Notifications'}
                                      </th>
                                      <th className="text-right py-2">{isPolish ? 'Akcje' : 'Actions'}</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-200/40 dark:divide-navy-700/40">
                                    {reminders.length === 0 ? (
                                      <tr>
                                        <td colSpan={5} className="py-6 text-center text-xs text-slate-400">
                                          {isPolish ? 'Brak reminderów.' : 'No reminders yet.'}
                                        </td>
                                      </tr>
                                    ) : (
                                      reminders.map((r) => (
                                        <tr key={r.id}>
                                          <td className="py-2 pr-2 text-xs text-slate-600 dark:text-slate-300">
                                            {r.type === 'before_due'
                                              ? isPolish
                                                ? 'Przed terminem'
                                                : 'Before due'
                                              : isPolish
                                                ? 'Po terminie'
                                                : 'After due'}
                                          </td>
                                          <td className="py-2 pr-2 text-xs text-slate-600 dark:text-slate-300">
                                            {r.days}
                                          </td>
                                          <td className="py-2 pr-2 text-xs text-slate-600 dark:text-slate-300">
                                            {r.recipients}
                                          </td>
                                          <td className="py-2 pr-2 text-xs">
                                            <div className="flex flex-wrap gap-1">
                                              {!r.enabled && (
                                                <span className="px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-navy-700/60 bg-slate-50/50 dark:bg-navy-800/50 text-[10px] text-slate-500 dark:text-slate-400">
                                                  {isPolish ? 'Wyłączone' : 'Disabled'}
                                                </span>
                                              )}
                                              {deliveryBadgeLabels(r.delivery, r).map((label) => (
                                                <span
                                                  key={`${r.id}-${label}`}
                                                  className="px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-navy-700/60 bg-slate-50/50 dark:bg-navy-800/50 text-[10px] text-slate-500 dark:text-slate-400"
                                                >
                                                  {label}
                                                </span>
                                              ))}
                                            </div>
                                          </td>
                                          <td className="py-2 text-right">
                                            <div className="inline-flex items-center gap-1">
                                              <button
                                                disabled={isDecisionStageLocked}
                                                onClick={() => {
                                                  setEditingReminderId(r.id);
                                                  setReminderDraft(normalizeReminderRule({ ...r }));
                                                }}
                                                className="p-1 text-slate-400 hover:text-primary-500 disabled:opacity-40"
                                                title={isPolish ? 'Edytuj' : 'Edit'}
                                              >
                                                <Edit3 size={13} />
                                              </button>
                                              <button
                                                disabled={isDecisionStageLocked}
                                                onClick={() =>
                                                  setReminders(reminders.filter((item) => item.id !== r.id))
                                                }
                                                className="p-1 text-slate-400 hover:text-red-500 disabled:opacity-40"
                                                title={isPolish ? 'Usuń' : 'Delete'}
                                              >
                                                <Trash2 size={13} />
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {/* Escalation table */}
                            <div className={governanceTableCardClass}>
                              <div className="flex items-center justify-between">
                                <h3 className="text-base font-semibold text-slate-700 dark:text-slate-100">
                                  {isPolish ? 'Eskalacja i zasady' : 'Escalation and rules'}
                                </h3>
                                <div className="inline-flex items-center gap-2">
                                  <button
                                    disabled={isDecisionStageLocked}
                                    onClick={() => {
                                      setEscalationDraft(
                                        normalizeEscalationRule({
                                          id: Math.random().toString(36).slice(2, 11),
                                          enabled: true,
                                          escalateTo: users[0]?.id || '',
                                          escalateToName: users[0]
                                            ? `${users[0].firstName} ${users[0].lastName}`
                                            : '',
                                          afterDays: 3,
                                          warningDays: 3,
                                          criticalDays: 1,
                                          escalationMode: 'manager_review',
                                          delivery: ensureDeliveryConfig({ coreChannels: ['in_app', 'email'] }),
                                          message: '',
                                        })
                                      );
                                      setEditingEscalationId('__new__');
                                    }}
                                    className="px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-300/60 dark:border-navy-600 text-slate-500 hover:text-primary-500 hover:border-primary-400/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    + {isPolish ? 'Dodaj eskalację' : 'Add escalation'}
                                  </button>
                                </div>
                              </div>
                              <div className="overflow-auto flex-1">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500 border-b border-slate-200/50 dark:border-navy-700/50">
                                      <th className="text-left py-2 pr-2">{isPolish ? 'Status' : 'Status'}</th>
                                      <th className="text-left py-2 pr-2">{isPolish ? 'Progi W/C' : 'W/C thresholds'}</th>
                                      <th className="text-left py-2 pr-2">
                                        {isPolish ? 'Eskaluj po' : 'Escalate after'}
                                      </th>
                                      <th className="text-left py-2 pr-2">
                                        {isPolish ? 'Eskaluj do' : 'Escalate to'}
                                      </th>
                                      <th className="text-left py-2 pr-2">
                                        {isPolish ? 'Komunikat' : 'Message'}
                                      </th>
                                      <th className="text-left py-2 pr-2">{isPolish ? 'Tryb' : 'Mode'}</th>
                                      <th className="text-left py-2 pr-2">{isPolish ? 'Kanały' : 'Channels'}</th>
                                      <th className="text-right py-2">{isPolish ? 'Akcje' : 'Actions'}</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-200/40 dark:divide-navy-700/40">
                                    {escalationRules.length === 0 ? (
                                      <tr>
                                        <td colSpan={8} className="py-6 text-center text-xs text-slate-400">
                                          {isPolish ? 'Brak reguł eskalacji.' : 'No escalation rules yet.'}
                                        </td>
                                      </tr>
                                    ) : (
                                      escalationRules.map((rule) => (
                                        <tr key={rule.id}>
                                          <td className="py-2 pr-2 text-xs text-slate-600 dark:text-slate-300">
                                            {rule.enabled
                                              ? isPolish
                                                ? 'Aktywna'
                                                : 'Enabled'
                                              : isPolish
                                                ? 'Wyłączona'
                                                : 'Disabled'}
                                          </td>
                                          <td className="py-2 pr-2 text-xs text-slate-600 dark:text-slate-300">
                                            {rule.warningDays}/{rule.criticalDays} d
                                          </td>
                                          <td className="py-2 pr-2 text-xs text-slate-600 dark:text-slate-300">
                                            {rule.afterDays} d
                                          </td>
                                          <td className="py-2 pr-2 text-xs text-slate-600 dark:text-slate-300">
                                            {rule.escalateToName || '—'}
                                          </td>
                                          <td className="py-2 pr-2 text-xs text-slate-600 dark:text-slate-300">
                                            {rule.message || '—'}
                                          </td>
                                          <td className="py-2 pr-2 text-xs text-slate-600 dark:text-slate-300">
                                            {rule.escalationMode === 'notify_only'
                                              ? isPolish
                                                ? 'Powiadomienie'
                                                : 'Notify'
                                              : rule.escalationMode === 'manager_review'
                                                ? isPolish
                                                  ? 'Manager review'
                                                  : 'Manager review'
                                                : isPolish
                                                  ? 'Executive alert'
                                                  : 'Executive alert'}
                                          </td>
                                          <td className="py-2 pr-2 text-xs">
                                            <div className="flex flex-wrap gap-1">
                                              {deliveryBadgeLabels(rule.delivery).map((label) => (
                                                <span
                                                  key={`${rule.id}-ch-${label}`}
                                                  className="px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-navy-700/60 bg-slate-50/50 dark:bg-navy-800/50 text-[10px] text-slate-500 dark:text-slate-400"
                                                >
                                                  {label}
                                                </span>
                                              ))}
                                            </div>
                                          </td>
                                          <td className="py-2 text-right">
                                            <div className="inline-flex items-center gap-1">
                                              <button
                                                disabled={isDecisionStageLocked}
                                                onClick={() => {
                                                  setEditingEscalationId(rule.id);
                                                  setEscalationDraft({ ...rule });
                                                }}
                                                className="p-1 text-slate-400 hover:text-primary-500 disabled:opacity-40"
                                                title={isPolish ? 'Edytuj' : 'Edit'}
                                              >
                                                <Edit3 size={13} />
                                              </button>
                                              <button
                                                disabled={isDecisionStageLocked}
                                                onClick={() =>
                                                  setEscalationRules(
                                                    escalationRules.filter((item) => item.id !== rule.id)
                                                  )
                                                }
                                                className="p-1 text-slate-400 hover:text-red-500 disabled:opacity-40"
                                                title={isPolish ? 'Usuń' : 'Delete'}
                                              >
                                                <Trash2 size={13} />
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>

                          {/* Stakeholder modal */}
                          {stakeholderDraft && (
                            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                              <div
                                className="absolute inset-0 bg-black/60"
                                onClick={() => {
                                  setEditingStakeholderId(null);
                                  setStakeholderDraft(null);
                                }}
                              />
                              <div className={`${governanceModalClass} min-h-[380px]`}>
                                <div className="flex items-center justify-between">
                                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    {editingStakeholderId === '__new__'
                                      ? isPolish
                                        ? 'Dodaj osobę do RACI'
                                        : 'Add RACI person'
                                      : isPolish
                                        ? 'Edytuj osobę RACI'
                                        : 'Edit RACI person'}
                                  </h4>
                                  <div className="inline-flex items-center gap-2">
                                    <button
                                      disabled={isDecisionStageLocked || isSuggestingStakeholders}
                                      onClick={suggestStakeholderDraftAI}
                                      className="px-2.5 py-1 rounded-lg text-xs font-medium border border-purple-300/40 dark:border-purple-500/30 text-purple-500 hover:text-purple-600 hover:border-purple-400/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
                                    >
                                      {isSuggestingStakeholders ? (
                                        <Loader2 size={12} className="animate-spin" />
                                      ) : (
                                        <Sparkles size={12} />
                                      )}
                                      AI
                                    </button>
                                    <button
                                      className="p-1 text-slate-400 hover:text-slate-600"
                                      onClick={() => {
                                        setEditingStakeholderId(null);
                                        setStakeholderDraft(null);
                                      }}
                                    >
                                      <X size={16} />
                                    </button>
                                  </div>
                                </div>
                                <div className={governanceModalHintClass}>
                                  {isPolish
                                    ? 'Tutaj opisujemy i konfigurujemy odpowiedzialność osoby w RACI oraz kanały komunikacji.'
                                    : 'Use this window to describe and configure person responsibility in RACI and communication channels.'}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <label className="text-xs text-slate-500 dark:text-slate-400">
                                    {isPolish ? 'Osoba' : 'Person'}
                                    <select
                                      value={stakeholderDraft.userId}
                                      onChange={(e) => {
                                        const selected = users.find((u) => u.id === e.target.value);
                                        setStakeholderDraft({
                                          ...stakeholderDraft,
                                          userId: e.target.value,
                                          userName: selected
                                            ? `${selected.firstName} ${selected.lastName}`
                                            : stakeholderDraft.userName,
                                          userEmail: selected?.email || stakeholderDraft.userEmail,
                                        });
                                      }}
                                      className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                                    >
                                      {users.map((u) => (
                                        <option key={u.id} value={u.id}>
                                          {u.firstName} {u.lastName}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="text-xs text-slate-500 dark:text-slate-400">
                                    {isPolish ? 'Rola' : 'Role'}
                                    <select
                                      value={stakeholderDraft.role}
                                      onChange={(e) =>
                                        setStakeholderDraft({
                                          ...stakeholderDraft,
                                          role: e.target.value as StakeholderRole,
                                        })
                                      }
                                      className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                                    >
                                      <option value="responsible">Responsible</option>
                                      <option value="accountable">Accountable</option>
                                      <option value="consulted">Consulted</option>
                                      <option value="informed">Informed</option>
                                    </select>
                                  </label>
                                </div>
                                <div className="space-y-2 flex-1">
                                  <div className="text-xs text-slate-500 dark:text-slate-400">
                                    {isPolish ? 'Kanały notyfikacji' : 'Notification channels'}
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="rounded-xl border border-slate-200/70 dark:border-navy-700/60 bg-slate-50/70 dark:bg-navy-800/50 p-3 space-y-2">
                                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                        {isPolish ? 'Kanały podstawowe' : 'Core channels'}
                                      </div>
                                      <div className="flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
                                        {[
                                          {
                                            key: 'enabled',
                                            label: isPolish ? 'Aktywne' : 'Enabled',
                                            active: stakeholderDraft.notificationSettings.enabled,
                                            toggle: () =>
                                              setStakeholderDraft({
                                                ...stakeholderDraft,
                                                notificationSettings: {
                                                  ...stakeholderDraft.notificationSettings,
                                                  enabled: !stakeholderDraft.notificationSettings.enabled,
                                                },
                                              }),
                                          },
                                          {
                                            key: 'in_app',
                                            label: 'In-app',
                                            active: stakeholderDraft.notificationSettings.inAppEnabled,
                                            toggle: () =>
                                              setStakeholderDraft({
                                                ...stakeholderDraft,
                                                notificationSettings: {
                                                  ...stakeholderDraft.notificationSettings,
                                                  inAppEnabled: !stakeholderDraft.notificationSettings.inAppEnabled,
                                                },
                                              }),
                                          },
                                          {
                                            key: 'email',
                                            label: 'Email',
                                            active: stakeholderDraft.notificationSettings.emailEnabled,
                                            toggle: () =>
                                              setStakeholderDraft({
                                                ...stakeholderDraft,
                                                notificationSettings: {
                                                  ...stakeholderDraft.notificationSettings,
                                                  emailEnabled: !stakeholderDraft.notificationSettings.emailEnabled,
                                                },
                                              }),
                                          },
                                        ].map((channel) => (
                                          <button
                                            key={channel.key}
                                            type="button"
                                            onClick={channel.toggle}
                                            className={`${channelChipClass} ${
                                              channel.active
                                                ? 'border-purple-400/60 text-purple-500 bg-purple-500/10'
                                                : 'border-slate-300/70 text-slate-500 hover:border-slate-400/80'
                                            }`}
                                          >
                                            {channel.label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                    <div className="rounded-xl border border-slate-200/70 dark:border-navy-700/60 bg-slate-50/70 dark:bg-navy-800/50 p-3 space-y-2">
                                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                        {isPolish ? 'Kanały integracyjne' : 'Integration channels'}
                                      </div>
                                      <div className="flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
                                        {integrationChannelCatalog.map((channel) => {
                                          const list =
                                            stakeholderDraft.notificationSettings.integrationChannels || [];
                                          const selected = list.includes(channel.key);
                                          return (
                                            <button
                                              key={channel.key}
                                              type="button"
                                              onClick={() => {
                                                const current =
                                                  stakeholderDraft.notificationSettings
                                                    .integrationChannels || [];
                                                const next = selected
                                                  ? current.filter((c) => c !== channel.key)
                                                  : [...current, channel.key];
                                                setStakeholderDraft({
                                                  ...stakeholderDraft,
                                                  notificationSettings: {
                                                    ...stakeholderDraft.notificationSettings,
                                                    integrationChannels: next,
                                                  },
                                                });
                                              }}
                                              className={`${channelChipClass} ${
                                                selected
                                                  ? 'border-purple-400/60 text-purple-500 bg-purple-500/10'
                                                  : 'border-slate-300/70 text-slate-500 hover:border-slate-400/80'
                                              }`}
                                              title={channel.scope}
                                            >
                                              {channel.label}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                  <label className="text-xs text-slate-500 dark:text-slate-400 block">
                                    {isPolish ? 'Cele synchronizacji' : 'Sync targets'}
                                    <input
                                      value={(stakeholderDraft.notificationSettings.syncTargets || []).join(', ')}
                                      onChange={(e) =>
                                        setStakeholderDraft({
                                          ...stakeholderDraft,
                                          notificationSettings: {
                                            ...stakeholderDraft.notificationSettings,
                                            syncTargets: e.target.value
                                              .split(',')
                                              .map((item) => item.trim())
                                              .filter(Boolean),
                                          },
                                        })
                                      }
                                      className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                                      placeholder="slack:#ops, jira:DRD"
                                    />
                                  </label>
                                </div>
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => {
                                      setEditingStakeholderId(null);
                                      setStakeholderDraft(null);
                                    }}
                                    className="px-3 py-1.5 rounded-md text-xs border border-slate-300/60 dark:border-navy-600 text-slate-500"
                                  >
                                    {isPolish ? 'Anuluj' : 'Cancel'}
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (!stakeholderDraft) return;
                                      if (editingStakeholderId === '__new__') {
                                        setStakeholders([
                                          ...stakeholders,
                                          { ...stakeholderDraft, id: Math.random().toString(36).slice(2, 11) },
                                        ]);
                                      } else {
                                        setStakeholders(
                                          stakeholders.map((item) =>
                                            item.id === editingStakeholderId
                                              ? { ...stakeholderDraft, id: item.id }
                                              : item
                                          )
                                        );
                                      }
                                      setEditingStakeholderId(null);
                                      setStakeholderDraft(null);
                                    }}
                                    className="px-3 py-1.5 rounded-md text-xs bg-purple-600 text-white hover:bg-purple-500"
                                  >
                                    {isPolish ? 'Zapisz' : 'Save'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Reminder modal */}
                          {reminderDraft && (
                            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                              <div
                                className="absolute inset-0 bg-black/60"
                                onClick={() => {
                                  setEditingReminderId(null);
                                  setReminderDraft(null);
                                }}
                              />
                              <div className={`${governanceModalClass} min-h-[380px]`}>
                                <div className="flex items-center justify-between">
                                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    {editingReminderId === '__new__'
                                      ? isPolish
                                        ? 'Dodaj reminder'
                                        : 'Add reminder'
                                      : isPolish
                                        ? 'Edytuj reminder'
                                        : 'Edit reminder'}
                                  </h4>
                                  <div className="inline-flex items-center gap-2">
                                    <button
                                      disabled={isDecisionStageLocked || isSuggestingReminders}
                                      onClick={suggestReminderDraftAI}
                                      className="px-2.5 py-1 rounded-lg text-xs font-medium border border-purple-300/40 dark:border-purple-500/30 text-purple-500 hover:text-purple-600 hover:border-purple-400/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
                                    >
                                      {isSuggestingReminders ? (
                                        <Loader2 size={12} className="animate-spin" />
                                      ) : (
                                        <Sparkles size={12} />
                                      )}
                                      AI
                                    </button>
                                    <button
                                      className="p-1 text-slate-400 hover:text-slate-600"
                                      onClick={() => {
                                        setEditingReminderId(null);
                                        setReminderDraft(null);
                                      }}
                                    >
                                      <X size={16} />
                                    </button>
                                  </div>
                                </div>
                                <div className={governanceModalHintClass}>
                                  {isPolish
                                    ? 'Tutaj opisujemy cel remindera: kiedy ma się uruchamiać, do kogo trafić i jaką wiadomość wysłać.'
                                    : 'Use this window to describe reminder intent: when it should trigger, recipients, and the message.'}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <label className="text-xs text-slate-500 dark:text-slate-400">
                                    {isPolish ? 'Typ' : 'Type'}
                                    <select
                                      value={reminderDraft.type}
                                      onChange={(e) =>
                                        setReminderDraft({
                                          ...reminderDraft,
                                          type: e.target.value as 'before_due' | 'after_due',
                                        })
                                      }
                                      className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                                    >
                                      <option value="before_due">
                                        {isPolish ? 'Przed terminem' : 'Before due'}
                                      </option>
                                      <option value="after_due">
                                        {isPolish ? 'Po terminie' : 'After due'}
                                      </option>
                                    </select>
                                  </label>
                                  <label className="text-xs text-slate-500 dark:text-slate-400">
                                    {isPolish ? 'Dni' : 'Days'}
                                    <input
                                      type="number"
                                      min={0}
                                      value={reminderDraft.days}
                                      onChange={(e) =>
                                        setReminderDraft({
                                          ...reminderDraft,
                                          days: Number(e.target.value) || 0,
                                        })
                                      }
                                      className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                                    />
                                  </label>
                                </div>
                                <label className="text-xs text-slate-500 dark:text-slate-400 block">
                                  {isPolish ? 'Odbiorcy' : 'Recipients'}
                                  <select
                                    value={reminderDraft.recipients}
                                    onChange={(e) =>
                                      setReminderDraft({
                                        ...reminderDraft,
                                        recipients: e.target.value as
                                          | 'requester'
                                          | 'decider'
                                          | 'both'
                                          | 'stakeholders',
                                      })
                                    }
                                    className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                                  >
                                    <option value="requester">Requester</option>
                                    <option value="decider">Decider</option>
                                    <option value="both">{isPolish ? 'Obaj' : 'Both'}</option>
                                    <option value="stakeholders">
                                      {isPolish ? 'Interesariusze' : 'Stakeholders'}
                                    </option>
                                  </select>
                                </label>
                                <div className="space-y-3">
                                  <label className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
                                    <input
                                      type="checkbox"
                                      checked={reminderDraft.enabled}
                                      onChange={(e) =>
                                        setReminderDraft({ ...reminderDraft, enabled: e.target.checked })
                                      }
                                    />
                                    {isPolish ? 'Reguła aktywna' : 'Rule enabled'}
                                  </label>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="rounded-xl border border-slate-200/70 dark:border-navy-700/60 bg-slate-50/70 dark:bg-navy-800/50 p-3 space-y-2">
                                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                        {isPolish ? 'Kanały podstawowe' : 'Core channels'}
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        {([
                                          { key: 'in_app', label: 'In-app' },
                                          { key: 'email', label: 'Email' },
                                        ] as Array<{ key: CoreDeliveryChannel; label: string }>).map((channel) => {
                                          const delivery = ensureDeliveryConfig(
                                            reminderDraft.delivery,
                                            reminderDraft
                                          );
                                          const enabled = delivery.coreChannels.includes(channel.key);
                                          return (
                                            <button
                                              key={channel.key}
                                              type="button"
                                              onClick={() =>
                                                setReminderDraft({
                                                  ...reminderDraft,
                                                  delivery: {
                                                    ...delivery,
                                                    coreChannels: toggleChannel(
                                                      delivery.coreChannels,
                                                      channel.key,
                                                      !enabled
                                                    ),
                                                  },
                                                  inAppNotification:
                                                    channel.key === 'in_app'
                                                      ? !enabled
                                                      : delivery.coreChannels.includes('in_app'),
                                                  emailNotification:
                                                    channel.key === 'email'
                                                      ? !enabled
                                                      : delivery.coreChannels.includes('email'),
                                                })
                                              }
                                              className={`${channelChipClass} ${
                                                enabled
                                                  ? 'border-purple-400/60 text-purple-500 bg-purple-500/10'
                                                  : 'border-slate-300/70 text-slate-500 hover:border-slate-400/80'
                                              }`}
                                            >
                                              {channel.label}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                    <div className="rounded-xl border border-slate-200/70 dark:border-navy-700/60 bg-slate-50/70 dark:bg-navy-800/50 p-3 space-y-2">
                                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                        {isPolish ? 'Kanały integracyjne' : 'Integration channels'}
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        {integrationChannelCatalog.map((channel) => {
                                          const delivery = ensureDeliveryConfig(
                                            reminderDraft.delivery,
                                            reminderDraft
                                          );
                                          const enabled = delivery.integrationChannels.includes(channel.key);
                                          return (
                                            <button
                                              key={channel.key}
                                              type="button"
                                              onClick={() =>
                                                setReminderDraft({
                                                  ...reminderDraft,
                                                  delivery: {
                                                    ...delivery,
                                                    integrationChannels: toggleChannel(
                                                      delivery.integrationChannels,
                                                      channel.key,
                                                      !enabled
                                                    ),
                                                  },
                                                })
                                              }
                                              className={`${channelChipClass} ${
                                                enabled
                                                  ? 'border-purple-400/60 text-purple-500 bg-purple-500/10'
                                                  : 'border-slate-300/70 text-slate-500 hover:border-slate-400/80'
                                              }`}
                                              title={channel.scope}
                                            >
                                              {channel.label}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                  <label className="text-xs text-slate-500 dark:text-slate-400 block">
                                    {isPolish ? 'Cele synchronizacji' : 'Sync targets'}
                                    <input
                                      value={ensureDeliveryConfig(reminderDraft.delivery, reminderDraft).syncTargets.join(
                                        ', '
                                      )}
                                      onChange={(e) =>
                                        setReminderDraft({
                                          ...reminderDraft,
                                          delivery: {
                                            ...ensureDeliveryConfig(reminderDraft.delivery, reminderDraft),
                                            syncTargets: e.target.value
                                              .split(',')
                                              .map((item) => item.trim())
                                              .filter(Boolean),
                                          },
                                        })
                                      }
                                      className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                                      placeholder="slack:#delivery, jira:PROJ, webhook:ops"
                                    />
                                  </label>
                                </div>
                                <label className="text-xs text-slate-500 dark:text-slate-400 block">
                                  {isPolish ? 'Wiadomość' : 'Message'}
                                  <textarea
                                    value={reminderDraft.message || ''}
                                    onChange={(e) =>
                                      setReminderDraft({ ...reminderDraft, message: e.target.value })
                                    }
                                    rows={3}
                                    className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                                  />
                                </label>
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => {
                                      setEditingReminderId(null);
                                      setReminderDraft(null);
                                    }}
                                    className="px-3 py-1.5 rounded-md text-xs border border-slate-300/60 dark:border-navy-600 text-slate-500"
                                  >
                                    {isPolish ? 'Anuluj' : 'Cancel'}
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (!reminderDraft) return;
                                      const normalized = normalizeReminderRule(reminderDraft);
                                      if (editingReminderId === '__new__') {
                                        setReminders([
                                          ...reminders,
                                          {
                                            ...normalized,
                                            id: Math.random().toString(36).slice(2, 11),
                                          },
                                        ]);
                                      } else {
                                        setReminders(
                                          reminders.map((item) =>
                                            item.id === editingReminderId
                                              ? { ...normalized, id: item.id }
                                              : item
                                          )
                                        );
                                      }
                                      setEditingReminderId(null);
                                      setReminderDraft(null);
                                    }}
                                    className="px-3 py-1.5 rounded-md text-xs bg-purple-600 text-white hover:bg-purple-500"
                                  >
                                    {isPolish ? 'Zapisz' : 'Save'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Escalation modal */}
                          {editingEscalationId && escalationDraft && (
                            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                              <div
                                className="absolute inset-0 bg-black/60"
                                onClick={() => {
                                  setEditingEscalationId(null);
                                  setEscalationDraft(null);
                                }}
                              />
                              <div className={governanceModalClass}>
                                <div className="flex items-center justify-between">
                                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    {editingEscalationId === '__new__'
                                      ? isPolish
                                        ? 'Dodaj regułę eskalacji'
                                        : 'Add escalation rule'
                                      : isPolish
                                        ? 'Edytuj regułę eskalacji'
                                        : 'Edit escalation rule'}
                                  </h4>
                                  <div className="inline-flex items-center gap-2">
                                    <button
                                      disabled={isDecisionStageLocked || isSuggestingEscalations}
                                      onClick={suggestEscalationDraftAI}
                                      className="px-2.5 py-1 rounded-lg text-xs font-medium border border-purple-300/40 dark:border-purple-500/30 text-purple-500 hover:text-purple-600 hover:border-purple-400/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
                                    >
                                      {isSuggestingEscalations ? (
                                        <Loader2 size={12} className="animate-spin" />
                                      ) : (
                                        <Sparkles size={12} />
                                      )}
                                      AI
                                    </button>
                                    <button
                                      className="p-1 text-slate-400 hover:text-slate-600"
                                      onClick={() => {
                                        setEditingEscalationId(null);
                                        setEscalationDraft(null);
                                      }}
                                    >
                                      <X size={16} />
                                    </button>
                                  </div>
                                </div>
                                <div className={governanceModalHintClass}>
                                  {isPolish
                                    ? 'Tutaj opisujemy regułę eskalacji: progi, czas eskalacji, osobę docelową i komunikat.'
                                    : 'Use this window to describe escalation rule settings: thresholds, timing, assignee, and message.'}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <label className="text-xs text-slate-500 dark:text-slate-400">
                                    {isPolish ? 'Próg ostrzeżenia (dni)' : 'Warning threshold (days)'}
                                    <input
                                      type="number"
                                      min={0}
                                      value={escalationDraft.warningDays}
                                      onChange={(e) =>
                                        setEscalationDraft({
                                          ...escalationDraft,
                                          warningDays: Number(e.target.value) || 0,
                                        })
                                      }
                                      className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                                    />
                                  </label>
                                  <label className="text-xs text-slate-500 dark:text-slate-400">
                                    {isPolish ? 'Próg krytyczny (dni)' : 'Critical threshold (days)'}
                                    <input
                                      type="number"
                                      min={0}
                                      value={escalationDraft.criticalDays}
                                      onChange={(e) =>
                                        setEscalationDraft({
                                          ...escalationDraft,
                                          criticalDays: Number(e.target.value) || 0,
                                        })
                                      }
                                      className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                                    />
                                  </label>
                                  <label className="text-xs text-slate-500 dark:text-slate-400">
                                    {isPolish ? 'Eskaluj po (dni)' : 'Escalate after (days)'}
                                    <input
                                      type="number"
                                      min={1}
                                      value={escalationDraft.afterDays}
                                      onChange={(e) =>
                                        setEscalationDraft({
                                          ...escalationDraft,
                                          afterDays: Number(e.target.value) || 1,
                                        })
                                      }
                                      className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                                    />
                                  </label>
                                  <label className="text-xs text-slate-500 dark:text-slate-400">
                                    {isPolish ? 'Eskaluj do' : 'Escalate to'}
                                    <select
                                      value={escalationDraft.escalateTo}
                                      onChange={(e) => {
                                        const selected = users.find((u) => u.id === e.target.value);
                                        setEscalationDraft({
                                          ...escalationDraft,
                                          escalateTo: e.target.value,
                                          escalateToName: selected
                                            ? `${selected.firstName} ${selected.lastName}`
                                            : escalationDraft.escalateToName,
                                        });
                                      }}
                                      className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                                    >
                                      <option value="">{isPolish ? 'Wybierz' : 'Select'}</option>
                                      {users.map((u) => (
                                        <option key={u.id} value={u.id}>
                                          {u.firstName} {u.lastName}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                </div>
                                <label className="text-xs text-slate-500 dark:text-slate-400 block">
                                  {isPolish ? 'Tryb eskalacji' : 'Escalation mode'}
                                  <select
                                    value={escalationDraft.escalationMode}
                                    onChange={(e) =>
                                      setEscalationDraft({
                                        ...escalationDraft,
                                        escalationMode: e.target.value as EscalationMode,
                                      })
                                    }
                                    className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                                  >
                                    {escalationModeOptions.map((mode) => (
                                      <option key={mode.value} value={mode.value}>
                                        {mode.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
                                  <input
                                    type="checkbox"
                                    checked={escalationDraft.enabled}
                                    onChange={(e) =>
                                      setEscalationDraft({
                                        ...escalationDraft,
                                        enabled: e.target.checked,
                                      })
                                    }
                                  />
                                  {isPolish ? 'Reguła aktywna' : 'Rule enabled'}
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div className="rounded-xl border border-slate-200/70 dark:border-navy-700/60 bg-slate-50/70 dark:bg-navy-800/50 p-3 space-y-2">
                                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                      {isPolish ? 'Kanały podstawowe' : 'Core channels'}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {([
                                        { key: 'in_app', label: 'In-app' },
                                        { key: 'email', label: 'Email' },
                                      ] as Array<{ key: CoreDeliveryChannel; label: string }>).map((channel) => {
                                        const delivery = ensureDeliveryConfig(escalationDraft.delivery);
                                        const enabled = delivery.coreChannels.includes(channel.key);
                                        return (
                                          <button
                                            key={channel.key}
                                            type="button"
                                            onClick={() =>
                                              setEscalationDraft({
                                                ...escalationDraft,
                                                delivery: {
                                                  ...delivery,
                                                  coreChannels: toggleChannel(
                                                    delivery.coreChannels,
                                                    channel.key,
                                                    !enabled
                                                  ),
                                                },
                                              })
                                            }
                                            className={`${channelChipClass} ${
                                              enabled
                                                ? 'border-purple-400/60 text-purple-500 bg-purple-500/10'
                                                : 'border-slate-300/70 text-slate-500 hover:border-slate-400/80'
                                            }`}
                                          >
                                            {channel.label}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                  <div className="rounded-xl border border-slate-200/70 dark:border-navy-700/60 bg-slate-50/70 dark:bg-navy-800/50 p-3 space-y-2">
                                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                      {isPolish ? 'Kanały integracyjne' : 'Integration channels'}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {integrationChannelCatalog.map((channel) => {
                                        const delivery = ensureDeliveryConfig(escalationDraft.delivery);
                                        const enabled = delivery.integrationChannels.includes(channel.key);
                                        return (
                                          <button
                                            key={channel.key}
                                            type="button"
                                            onClick={() =>
                                              setEscalationDraft({
                                                ...escalationDraft,
                                                delivery: {
                                                  ...delivery,
                                                  integrationChannels: toggleChannel(
                                                    delivery.integrationChannels,
                                                    channel.key,
                                                    !enabled
                                                  ),
                                                },
                                              })
                                            }
                                            className={`${channelChipClass} ${
                                              enabled
                                                ? 'border-purple-400/60 text-purple-500 bg-purple-500/10'
                                                : 'border-slate-300/70 text-slate-500 hover:border-slate-400/80'
                                            }`}
                                            title={channel.scope}
                                          >
                                            {channel.label}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                                <label className="text-xs text-slate-500 dark:text-slate-400 block">
                                  {isPolish ? 'Cele synchronizacji' : 'Sync targets'}
                                  <input
                                    value={ensureDeliveryConfig(escalationDraft.delivery).syncTargets.join(', ')}
                                    onChange={(e) =>
                                      setEscalationDraft({
                                        ...escalationDraft,
                                        delivery: {
                                          ...ensureDeliveryConfig(escalationDraft.delivery),
                                          syncTargets: e.target.value
                                            .split(',')
                                            .map((item) => item.trim())
                                            .filter(Boolean),
                                        },
                                      })
                                    }
                                    className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                                    placeholder="slack:#incident, jira:OPS, webhook:oncall"
                                  />
                                </label>
                                <label className="text-xs text-slate-500 dark:text-slate-400 block">
                                  {isPolish ? 'Komunikat eskalacji' : 'Escalation message'}
                                  <textarea
                                    value={escalationDraft.message || ''}
                                    onChange={(e) =>
                                      setEscalationDraft({
                                        ...escalationDraft,
                                        message: e.target.value,
                                      })
                                    }
                                    rows={3}
                                    className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                                  />
                                </label>
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => {
                                      setEditingEscalationId(null);
                                      setEscalationDraft(null);
                                    }}
                                    className="px-3 py-1.5 rounded-md text-xs border border-slate-300/60 dark:border-navy-600 text-slate-500"
                                  >
                                    {isPolish ? 'Anuluj' : 'Cancel'}
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (!escalationDraft) return;
                                      const normalized = normalizeEscalationRule(escalationDraft);
                                      if (editingEscalationId === '__new__') {
                                        setEscalationRules([
                                          ...escalationRules,
                                          {
                                            ...normalized,
                                            id: Math.random().toString(36).slice(2, 11),
                                          },
                                        ]);
                                      } else {
                                        setEscalationRules(
                                          escalationRules.map((item) =>
                                            item.id === editingEscalationId
                                              ? { ...normalized, id: item.id }
                                              : item
                                          )
                                        );
                                      }
                                      setEditingEscalationId(null);
                                      setEscalationDraft(null);
                                    }}
                                    className="px-3 py-1.5 rounded-md text-xs bg-purple-600 text-white hover:bg-purple-500"
                                  >
                                    {isPolish ? 'Zapisz' : 'Save'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
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
                            <div className="flex items-center justify-end">
                              <DateFilterSortControl
                                options={[
                                  { id: 'all', label: isPolish ? 'Wszystkie' : 'All' },
                                  { id: 'today', label: isPolish ? 'Dziś' : 'Today' },
                                  { id: '7d', label: isPolish ? '7 dni' : '7 days' },
                                  { id: '30d', label: isPolish ? '30 dni' : '30 days' },
                                ]}
                                value={commentDateFilter}
                                onChange={(next) => setCommentDateFilter(next as CommentDateFilter)}
                                sortOrder={commentSortOrder}
                                onToggleSort={() =>
                                  setCommentSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
                                }
                                sortAscLabel={
                                  isPolish
                                    ? 'Sortowanie: od najstarszych do najnowszych'
                                    : 'Sort: oldest to newest'
                                }
                                sortDescLabel={
                                  isPolish
                                    ? 'Sortowanie: od najnowszych do najstarszych'
                                    : 'Sort: newest to oldest'
                                }
                                filterButtonTitle={
                                  isPolish
                                    ? 'Filtr daty komentarzy (klikaj, aby zmienić zakres)'
                                    : 'Comment date filter (click to switch range)'
                                }
                              />
                            </div>

                            {filteredComments.length === 0 ? (
                              <p className="text-xs text-slate-400 dark:text-slate-500 py-4 text-center">
                                {isPolish
                                  ? 'Brak komentarzy dla wybranego zakresu dat.'
                                  : 'No comments for selected date range.'}
                              </p>
                            ) : (
                              <div className="space-y-4">
                                {filteredComments.map((c) => (
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
                                          <span
                                            className={`w-1.5 h-1.5 rounded-full ${getPriorityDotClass(getCommentPriority(c))}`}
                                            title={
                                              isPolish
                                                ? `Priorytet: ${getCommentPriority(c)}`
                                                : `Priority: ${getCommentPriority(c)}`
                                            }
                                          />
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
                              <div className="relative inline-flex items-center gap-1">
                                {([
                                  { id: 'low', label: isPolish ? 'L' : 'L' },
                                  { id: 'normal', label: isPolish ? 'N' : 'N' },
                                  { id: 'high', label: isPolish ? 'H' : 'H' },
                                ] as const).map((prio) => (
                                  <button
                                    key={prio.id}
                                    type="button"
                                    onClick={() => setCommentDraftPriority(prio.id)}
                                    onMouseEnter={() => setHoveredCommentPriority(prio.id)}
                                    onMouseLeave={() => setHoveredCommentPriority(null)}
                                    onFocus={() => setHoveredCommentPriority(prio.id)}
                                    onBlur={() => setHoveredCommentPriority(null)}
                                    className={`w-5 h-5 rounded-full border text-[9px] font-semibold transition-colors ${
                                      getPriorityButtonClass(prio.id, commentDraftPriority === prio.id)
                                    }`}
                                    title={
                                      isPolish
                                        ? `Priorytet komentarza: ${getCommentPriorityLabel(prio.id)}`
                                        : `Comment priority: ${getCommentPriorityLabel(prio.id)}`
                                    }
                                  >
                                    {prio.label}
                                  </button>
                                ))}
                                {hoveredCommentPriority && (
                                  <div className="absolute left-0 -top-12 z-20 min-w-[190px] rounded-lg border border-slate-300/60 dark:border-navy-600/70 bg-white/95 dark:bg-navy-900/95 px-2.5 py-1.5 shadow-lg">
                                    <div className="text-[10px] font-semibold text-slate-700 dark:text-slate-200">
                                      {isPolish ? 'Priorytet' : 'Priority'}:{' '}
                                      {getCommentPriorityLabel(hoveredCommentPriority)}
                                    </div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                      {getCommentPriorityHint(hoveredCommentPriority)}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <input
                                type="text"
                                value={commentDraft}
                                onChange={(e) => setCommentDraft(e.target.value)}
                                placeholder={
                                  isPolish ? 'Napisz komentarz...' : 'Write a comment...'
                                }
                                className="flex-1 text-sm bg-transparent text-slate-700 dark:text-slate-300 focus:outline-none placeholder-slate-400 dark:placeholder-slate-600"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && commentDraft.trim()) {
                                    void submitCommentDraft();
                                  }
                                }}
                              />
                              <button
                                onClick={enhanceCommentDraftWithAI}
                                disabled={isDecisionStageLocked || isEnhancingCommentDraft}
                                className="inline-flex items-center gap-1 text-xs font-medium text-primary-500 hover:text-primary-600 transition-colors disabled:opacity-40"
                                title={isPolish ? 'AI pomoże dopracować komentarz' : 'AI helps refine comment'}
                              >
                                {isEnhancingCommentDraft ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  <Sparkles size={12} />
                                )}
                                AI
                              </button>
                              <button
                                onClick={() => void submitCommentDraft()}
                                disabled={!commentDraft.trim()}
                                className="text-xs font-medium text-primary-500 hover:text-primary-600 transition-colors disabled:opacity-40"
                                title={isPolish ? 'Wyślij komentarz' : 'Send comment'}
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
                            {isPolish
                              ? 'Załączniki, linki wewnętrzne i zewnętrzne'
                              : 'Attachments, Internal Links & External Links'}
                          </h2>

                          {/* Attachments — flat file list */}
                          <div className="space-y-3" ref={attachmentsSectionRef}>
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                                {isPolish ? 'Załączniki' : 'Attachments'}
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-slate-300/40 dark:border-navy-600/60 text-slate-400">
                                  {filteredAttachments.length}
                                </span>
                              </h3>
                              <div className="flex items-center gap-2">
                                <DateFilterSortControl
                                  options={[
                                    { id: 'all', label: isPolish ? 'Wszystkie' : 'All' },
                                    { id: 'today', label: isPolish ? 'Dziś' : 'Today' },
                                    { id: '7d', label: isPolish ? '7 dni' : '7 days' },
                                    { id: '30d', label: isPolish ? '30 dni' : '30 days' },
                                  ]}
                                  value={attachmentDateFilter}
                                  onChange={(next) =>
                                    setAttachmentDateFilter(next as CommentDateFilter)
                                  }
                                  sortOrder={attachmentSortOrder}
                                  onToggleSort={() =>
                                    setAttachmentSortOrder((prev) =>
                                      prev === 'asc' ? 'desc' : 'asc'
                                    )
                                  }
                                  sortAscLabel={
                                    isPolish
                                      ? 'Sortowanie: od najstarszych do najnowszych'
                                      : 'Sort: oldest to newest'
                                  }
                                  sortDescLabel={
                                    isPolish
                                      ? 'Sortowanie: od najnowszych do najstarszych'
                                      : 'Sort: newest to oldest'
                                  }
                                  filterButtonTitle={
                                    isPolish
                                      ? 'Filtr daty załączników (klikaj, aby zmienić zakres)'
                                      : 'Attachment date filter (click to switch range)'
                                  }
                                />
                                <button
                                  onClick={openAttachmentModal}
                                  disabled={isDecisionStageLocked}
                                  className="text-xs font-medium text-primary-500 hover:text-primary-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  + {isPolish ? 'Dodaj plik' : 'Add file'}
                                </button>
                              </div>
                            </div>
                            {filteredAttachments.length === 0 ? (
                              <div className="min-h-[220px] rounded-2xl border border-slate-200/50 dark:border-navy-700/50 bg-slate-50/40 dark:bg-navy-900/30 py-6 text-center flex items-center justify-center">
                                <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">
                                  {isPolish
                                    ? 'Brak załączników dla wybranego zakresu.'
                                    : 'No attachments for selected range.'}
                                </p>
                              </div>
                            ) : (
                              <div className="min-h-[220px] max-h-[380px] overflow-y-auto rounded-2xl border border-slate-200/50 dark:border-navy-700/50 bg-slate-50/40 dark:bg-navy-900/30 px-3">
                                <div className="space-y-0 divide-y divide-slate-200/40 dark:divide-navy-700/40">
                                  {filteredAttachments.map((a) => (
                                    <div
                                      key={a.id}
                                      className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2.5 group"
                                    >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <FileText
                                        size={14}
                                        className="text-slate-400 flex-shrink-0"
                                      />
                                      <button
                                        onClick={() => a.url && window.open(a.url, '_blank', 'noopener,noreferrer')}
                                        className="text-sm text-slate-700 dark:text-slate-300 truncate text-left hover:text-primary-500 transition-colors"
                                        title={isPolish ? 'Otwórz załącznik' : 'Open attachment'}
                                      >
                                        {a.name}
                                      </button>
                                    </div>
                                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                                      {(a.size / 1024).toFixed(0)} KB
                                    </span>
                                    <div
                                      className="relative justify-self-end"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setResourceMenuKey((prev) =>
                                            prev === `attachment:${a.id}` ? null : `attachment:${a.id}`
                                          );
                                        }}
                                        className="p-1 rounded-md text-slate-400/85 hover:text-slate-100 hover:bg-slate-100/10 transition-colors"
                                        title={isPolish ? 'Akcje załącznika' : 'Attachment actions'}
                                      >
                                        <MoreVertical size={14} />
                                      </button>
                                      {resourceMenuKey === `attachment:${a.id}` && (
                                        <div className="absolute right-0 top-7 z-20 min-w-[160px] rounded-lg border border-slate-200/60 dark:border-navy-700/60 bg-white/95 dark:bg-navy-900/95 shadow-lg p-1">
                                          <button
                                            onClick={() => {
                                              setResourceMenuKey(null);
                                              if (a.url) {
                                                window.open(a.url, '_blank', 'noopener,noreferrer');
                                              }
                                            }}
                                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left text-slate-600 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-navy-800/70"
                                          >
                                            <Eye size={12} />
                                            {isPolish ? 'Podgląd' : 'Preview'}
                                          </button>
                                          <button
                                            onClick={() => openEditAttachmentModal(a)}
                                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left text-slate-600 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-navy-800/70"
                                          >
                                            <Edit3 size={12} />
                                            {isPolish ? 'Edytuj' : 'Edit'}
                                          </button>
                                          <button
                                            onClick={() => {
                                              setResourceMenuKey(null);
                                              handleDeleteAttachment(a.id);
                                            }}
                                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left text-red-500 hover:bg-red-500/10"
                                          >
                                            <X size={12} />
                                            {isPolish ? 'Usuń' : 'Delete'}
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Linked Externals */}
                          <div className="space-y-3" ref={externalLinksSectionRef}>
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                                {isPolish ? 'Linki zewnętrzne' : 'Linked externals'}
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-slate-300/40 dark:border-navy-600/60 text-slate-400">
                                  {filteredExternalLinkedItems.length}
                                </span>
                              </h3>
                              <div className="flex items-center gap-2">
                                <DateFilterSortControl
                                  options={[{ id: 'all', label: isPolish ? 'Wszystkie' : 'All' }]}
                                  value="all"
                                  onChange={() => {}}
                                  sortOrder={linkedItemsSortOrder}
                                  onToggleSort={() =>
                                    setLinkedItemsSortOrder((prev) =>
                                      prev === 'asc' ? 'desc' : 'asc'
                                    )
                                  }
                                  sortAscLabel={isPolish ? 'Sortowanie: od A do Z' : 'Sort: A to Z'}
                                  sortDescLabel={isPolish ? 'Sortowanie: od Z do A' : 'Sort: Z to A'}
                                  filterButtonTitle={
                                    isPolish
                                      ? 'Filtr linków zewnętrznych'
                                      : 'External link filter'
                                  }
                                />
                                <button
                                  onClick={openExternalLinkModal}
                                  disabled={isDecisionStageLocked}
                                  className="text-xs font-medium text-primary-500 hover:text-primary-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  + {isPolish ? 'Dodaj link' : 'Add link'}
                                </button>
                              </div>
                            </div>
                            {filteredExternalLinkedItems.length === 0 ? (
                              <div className="py-2 flex items-center justify-between gap-2">
                                <p className="text-xs text-slate-400 dark:text-slate-500">
                                  {isPolish ? 'Brak linków zewnętrznych.' : 'No external links yet.'}
                                </p>
                                <button
                                  onClick={openExternalLinkModal}
                                  disabled={isDecisionStageLocked}
                                  className="text-xs font-medium text-primary-500 hover:text-primary-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  + {isPolish ? 'Dodaj link' : 'Add link'}
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-0 divide-y divide-slate-200/40 dark:divide-navy-700/40">
                                {filteredExternalLinkedItems.map((item) => (
                                  <div
                                    key={item.id}
                                    className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2.5 group"
                                  >
                                    <div className="min-w-0">
                                      <button
                                        onClick={() => openLinkedItemTarget(item)}
                                        className="text-sm text-slate-700 dark:text-slate-300 truncate text-left hover:text-primary-500 transition-colors w-full"
                                        title={isPolish ? 'Otwórz link zewnętrzny' : 'Open external link'}
                                      >
                                        {item.title}
                                      </button>
                                      {item.comment && (
                                        <p
                                          className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500 truncate"
                                          title={item.comment}
                                        >
                                          {item.comment}
                                        </p>
                                      )}
                                    </div>
                                    <div onClick={(e) => e.stopPropagation()}>
                                      <ArtifactPermalinkButton
                                        artifactType={item.type}
                                        artifactId={item.id}
                                        isPolish={isPolish}
                                        size={12}
                                        className="p-1 text-slate-400/85"
                                      />
                                    </div>
                                    <div
                                      className="relative justify-self-end"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setResourceMenuKey((prev) =>
                                            prev === `external:${item.id}` ? null : `external:${item.id}`
                                          );
                                        }}
                                        className="p-1 rounded-md text-slate-400/85 hover:text-slate-100 hover:bg-slate-100/10 transition-colors"
                                        title={isPolish ? 'Akcje linku zewnętrznego' : 'External link actions'}
                                      >
                                        <MoreVertical size={14} />
                                      </button>
                                      {resourceMenuKey === `external:${item.id}` && (
                                        <div className="absolute right-0 top-7 z-20 min-w-[170px] rounded-lg border border-slate-200/60 dark:border-navy-700/60 bg-white/95 dark:bg-navy-900/95 shadow-lg p-1">
                                          <button
                                            onClick={() => {
                                              setResourceMenuKey(null);
                                              openLinkedItemTarget(item);
                                            }}
                                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left text-slate-600 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-navy-800/70"
                                          >
                                            <Eye size={12} />
                                            {isPolish ? 'Podgląd' : 'Preview'}
                                          </button>
                                          <button
                                            onClick={() => openEditLinkedItemModal(item)}
                                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left text-slate-600 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-navy-800/70"
                                          >
                                            <Edit3 size={12} />
                                            {isPolish ? 'Edytuj' : 'Edit'}
                                          </button>
                                          <button
                                            onClick={() => {
                                              setResourceMenuKey(null);
                                              handleRemoveLinkedItem(item);
                                            }}
                                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left text-red-500 hover:bg-red-500/10"
                                          >
                                            <X size={12} />
                                            {isPolish ? 'Usuń' : 'Delete'}
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Linked Internals */}
                          <div className="space-y-3" ref={internalLinksSectionRef}>
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                                {isPolish ? 'Linki wewnętrzne' : 'Linked internals'}
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-slate-300/40 dark:border-navy-600/60 text-slate-400">
                                  {filteredInternalLinkedItems.length}
                                </span>
                              </h3>
                              <div className="flex items-center gap-2">
                                <DateFilterSortControl
                                  options={[
                                    { id: 'all', label: isPolish ? 'Wszystkie' : 'All' },
                                    { id: 'task', label: isPolish ? 'Task' : 'Task' },
                                    { id: 'decision', label: isPolish ? 'Decision' : 'Decision' },
                                    { id: 'initiative', label: isPolish ? 'Initiative' : 'Initiative' },
                                    { id: 'risk', label: isPolish ? 'Risk' : 'Risk' },
                                    { id: 'project', label: isPolish ? 'Projekt' : 'Project' },
                                    { id: 'assessment', label: isPolish ? 'Ocena' : 'Assessment' },
                                    { id: 'report', label: isPolish ? 'Raport' : 'Report' },
                                    { id: 'tool', label: isPolish ? 'Narzędzie' : 'Tool' },
                                    { id: 'insight', label: isPolish ? 'Insight' : 'Insight' },
                                  ]}
                                  value={linkedItemFilter}
                                  onChange={(next) => setLinkedItemFilter(next as LinkedItemFilter)}
                                  sortOrder={linkedItemsSortOrder}
                                  onToggleSort={() =>
                                    setLinkedItemsSortOrder((prev) =>
                                      prev === 'asc' ? 'desc' : 'asc'
                                    )
                                  }
                                  sortAscLabel={
                                    isPolish
                                      ? 'Sortowanie: od A do Z'
                                      : 'Sort: A to Z'
                                  }
                                  sortDescLabel={
                                    isPolish
                                      ? 'Sortowanie: od Z do A'
                                      : 'Sort: Z to A'
                                  }
                                  filterButtonTitle={
                                    isPolish
                                      ? 'Filtr typu powiązań (klikaj, aby zmienić)'
                                      : 'Linked item type filter (click to switch)'
                                  }
                                />
                                <button
                                  onClick={openInternalLinkModal}
                                  disabled={isDecisionStageLocked}
                                  className="text-xs font-medium text-primary-500 hover:text-primary-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  + {isPolish ? 'Dodaj link' : 'Add link'}
                                </button>
                              </div>
                            </div>
                            {filteredInternalLinkedItems.length === 0 ? (
                              <div className="py-2 flex items-center justify-between gap-2">
                                <p className="text-xs text-slate-400 dark:text-slate-500">
                                  {isPolish
                                    ? 'Brak linków wewnętrznych dla wybranego filtra.'
                                    : 'No internal links for selected filter.'}
                                </p>
                                <button
                                  onClick={openInternalLinkModal}
                                  disabled={isDecisionStageLocked}
                                  className="text-xs font-medium text-primary-500 hover:text-primary-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  + {isPolish ? 'Dodaj link' : 'Add link'}
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-0 divide-y divide-slate-200/40 dark:divide-navy-700/40">
                                {filteredInternalLinkedItems.map((item) => (
                                  <div
                                    key={item.id}
                                    className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 py-2.5 group"
                                  >
                                    <span className="text-[10px] font-mono uppercase text-slate-400 dark:text-slate-500 w-14">
                                      {item.type}
                                    </span>
                                    <button
                                      onClick={() => openLinkedItemTarget(item)}
                                      className="text-sm text-slate-700 dark:text-slate-300 truncate text-left hover:text-primary-500 transition-colors"
                                      title={isPolish ? 'Otwórz powiązany rekord' : 'Open linked record'}
                                    >
                                      {item.title}
                                    </button>
                                    <div onClick={(e) => e.stopPropagation()}>
                                      <ArtifactPermalinkButton
                                        artifactType={item.type}
                                        artifactId={item.id}
                                        isPolish={isPolish}
                                        size={12}
                                        className="p-1 text-slate-400/85"
                                      />
                                    </div>
                                    <span
                                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] whitespace-nowrap ${getLinkedStatusBadgeClass(
                                        item.status
                                      )}`}
                                    >
                                      <span>{item.status || '—'}</span>
                                      {(item.externalUrl || item.url) && <ExternalLink size={10} />}
                                    </span>
                                    <div
                                      className="relative justify-self-end"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setResourceMenuKey((prev) =>
                                            prev === `internal:${item.type}:${item.id}`
                                              ? null
                                              : `internal:${item.type}:${item.id}`
                                          );
                                        }}
                                        className="p-1 rounded-md text-slate-400/85 hover:text-slate-100 hover:bg-slate-100/10 transition-colors"
                                        title={isPolish ? 'Akcje linku' : 'Link actions'}
                                      >
                                        <MoreVertical size={14} />
                                      </button>
                                      {resourceMenuKey === `internal:${item.type}:${item.id}` && (
                                        <div className="absolute right-0 top-7 z-20 min-w-[170px] rounded-lg border border-slate-200/60 dark:border-navy-700/60 bg-white/95 dark:bg-navy-900/95 shadow-lg p-1">
                                          <button
                                            onClick={() => {
                                              setResourceMenuKey(null);
                                              openLinkedItemTarget(item);
                                            }}
                                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left text-slate-600 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-navy-800/70"
                                          >
                                            <Eye size={12} />
                                            {isPolish ? 'Podgląd' : 'Preview'}
                                          </button>
                                          <button
                                            onClick={() => openEditLinkedItemModal(item)}
                                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left text-slate-600 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-navy-800/70"
                                          >
                                            <Edit3 size={12} />
                                            {isPolish ? 'Edytuj' : 'Edit'}
                                          </button>
                                          <button
                                            onClick={() => {
                                              setResourceMenuKey(null);
                                              handleRemoveLinkedItem(item);
                                            }}
                                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left text-red-500 hover:bg-red-500/10"
                                          >
                                            <X size={12} />
                                            {isPolish ? 'Usuń' : 'Delete'}
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {isAttachmentModalOpen && (
                            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                              <div
                                className="absolute inset-0 bg-black/60"
                                onClick={closeAttachmentModal}
                              />
                              <div className={governanceModalClass}>
                                <div className="flex items-center justify-between">
                                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    {isPolish ? 'Dodaj załącznik' : 'Add attachment'}
                                  </h4>
                                  <button
                                    className="p-1 text-slate-400 hover:text-slate-600"
                                    onClick={closeAttachmentModal}
                                  >
                                    <X size={16} />
                                  </button>
                                </div>
                                <div className="space-y-3">
                                  <div className="rounded-xl border border-slate-200/60 dark:border-navy-700/60 bg-slate-50/40 dark:bg-navy-800/30 p-1 grid grid-cols-2 gap-1">
                                    <button
                                      onClick={() => setAttachmentSource('device')}
                                      className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                                        attachmentSource === 'device'
                                          ? 'bg-primary-500/20 text-primary-300 shadow-[0_0_0_1px_rgba(168,85,247,0.45)]'
                                          : 'text-slate-500 dark:text-slate-400 hover:bg-white/40 dark:hover:bg-navy-700/60'
                                      }`}
                                    >
                                      <HardDrive size={14} />
                                      {isPolish ? 'Z komputera' : 'From computer'}
                                    </button>
                                    <button
                                      onClick={() => setAttachmentSource('cloud')}
                                      className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                                        attachmentSource === 'cloud'
                                          ? 'bg-primary-500/20 text-primary-300 shadow-[0_0_0_1px_rgba(168,85,247,0.45)]'
                                          : 'text-slate-500 dark:text-slate-400 hover:bg-white/40 dark:hover:bg-navy-700/60'
                                      }`}
                                    >
                                      <Cloud size={14} />
                                      {isPolish ? 'Z chmury' : 'From cloud'}
                                    </button>
                                  </div>

                                  {attachmentSource === 'device' ? (
                                    <div className="space-y-2">
                                      <span className="text-xs text-slate-500 dark:text-slate-400 block">
                                        {isPolish ? 'Wybierz pliki' : 'Choose files'}
                                      </span>
                                      <label className="block cursor-pointer">
                                        <input
                                          type="file"
                                          multiple
                                          className="sr-only"
                                          onChange={(e) =>
                                            setAttachmentDiskFiles((prev) => [
                                              ...prev,
                                              ...Array.from(e.target.files || []),
                                            ])
                                          }
                                        />
                                        <div className="rounded-xl border border-dashed border-primary-500/35 bg-gradient-to-br from-primary-500/15 via-slate-50/40 to-transparent dark:from-primary-500/20 dark:via-navy-800/40 dark:to-transparent p-5 min-h-[112px] transition-all hover:border-primary-400/70 hover:shadow-[0_10px_28px_rgba(17,24,39,0.28)] flex items-center justify-center">
                                          <div className="flex items-center gap-3 text-center">
                                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/25 text-primary-300">
                                              <Upload size={16} />
                                            </span>
                                            <div className="min-w-0">
                                              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                                {isPolish
                                                  ? 'Kliknij, aby dodać pliki z komputera'
                                                  : 'Click to add files from your computer'}
                                              </p>
                                              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                                                {isPolish
                                                  ? 'Możesz wybrać wiele plików jednocześnie.'
                                                  : 'You can select multiple files at once.'}
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      </label>
                                    </div>
                                  ) : (
                                    <div className="space-y-3 rounded-xl border border-slate-200/70 dark:border-navy-700/70 bg-slate-50/40 dark:bg-navy-800/30 p-3">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                          {isPolish ? 'Dostawca chmury' : 'Cloud provider'}
                                        </span>
                                        {connectedProviderIds.length === 0 && (
                                          <button
                                            onClick={openIntegrationsSettings}
                                            className="inline-flex items-center gap-1 rounded-lg border border-primary-500/40 px-2 py-1 text-[10px] font-medium text-primary-400 hover:bg-primary-500/10"
                                          >
                                            <Settings size={12} />
                                            {isPolish
                                              ? 'Podłącz w Ustawieniach'
                                              : 'Connect in Settings'}
                                          </button>
                                        )}
                                      </div>
                                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        {cloudProviderCatalog.map((provider) => {
                                          const connected = connectedProviderIds.includes(provider.id);
                                          return (
                                            <button
                                              key={provider.id}
                                              onClick={() => setSelectedCloudProvider(provider.id)}
                                              className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                                                selectedCloudProvider === provider.id
                                                  ? 'border-primary-500/60 bg-primary-500/10'
                                                  : 'border-slate-200 dark:border-navy-700 hover:bg-slate-100/70 dark:hover:bg-navy-800/60'
                                              }`}
                                            >
                                              <div className="flex items-center justify-between gap-2">
                                                <span className={`text-xs font-semibold ${provider.colorClass} inline-flex items-center gap-1.5`}>
                                                  <span className="h-1.5 w-1.5 rounded-full bg-current opacity-90" />
                                                  {provider.name}
                                                </span>
                                                <span
                                                  className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                                                    connected
                                                      ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                                                      : 'border-slate-300/50 text-slate-400'
                                                  }`}
                                                >
                                                  {connected
                                                    ? isPolish
                                                      ? 'Połączono'
                                                      : 'Connected'
                                                    : isPolish
                                                      ? 'Brak połączenia'
                                                      : 'Not connected'}
                                                </span>
                                              </div>
                                            </button>
                                          );
                                        })}
                                      </div>

                                      {!connectedProviderIds.includes(selectedCloudProvider) ? (
                                        <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-300 flex items-center justify-between gap-2">
                                          <span>
                                            {isPolish
                                              ? 'Wybrana chmura nie jest podłączona.'
                                              : 'Selected cloud is not connected.'}
                                          </span>
                                          <button
                                            onClick={openIntegrationsSettings}
                                            className="text-[10px] font-semibold text-amber-200 underline underline-offset-2"
                                          >
                                            {isPolish ? 'Podłącz' : 'Connect'}
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={openCloudProviderPicker}
                                          className="w-full rounded-lg border border-primary-500/40 bg-primary-500/10 px-3 py-2 text-xs font-medium text-primary-300 hover:bg-primary-500/20 transition-colors"
                                        >
                                          {isPolish
                                            ? 'Wybierz plik z chmury'
                                            : 'Choose file from cloud'}
                                        </button>
                                      )}
                                    </div>
                                  )}

                                  {attachmentDiskFiles.length > 0 && (
                                    <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200/60 dark:border-navy-700/60 bg-slate-50/40 dark:bg-navy-800/40 p-2 text-[11px] text-slate-500 dark:text-slate-400 space-y-1.5">
                                      <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                        {isPolish
                                          ? `Wybrane pliki (${attachmentDiskFiles.length})`
                                          : `Selected files (${attachmentDiskFiles.length})`}
                                      </p>
                                      {attachmentDiskFiles.map((file) => (
                                        <div
                                          key={`${file.name}-${file.size}-${file.lastModified}`}
                                          className="truncate flex items-center justify-between gap-2 rounded-lg border border-slate-200/50 dark:border-navy-700/60 bg-white/70 dark:bg-navy-900/50 px-2 py-1.5"
                                        >
                                          <div className="min-w-0">
                                            <span className="block truncate text-slate-600 dark:text-slate-300">
                                              {file.name}
                                            </span>
                                            <span className="text-[10px] text-slate-400">
                                              {(file.size / 1024).toFixed(0)} KB
                                            </span>
                                          </div>
                                          <button
                                            onClick={() =>
                                              setAttachmentDiskFiles((prev) =>
                                                prev.filter(
                                                  (existing) =>
                                                    !(
                                                      existing.name === file.name &&
                                                      existing.size === file.size &&
                                                      existing.lastModified === file.lastModified
                                                    )
                                                )
                                              )
                                            }
                                            className="text-slate-400 hover:text-red-400 transition-colors"
                                            title={isPolish ? 'Usuń z listy' : 'Remove from list'}
                                          >
                                            <X size={12} />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={closeAttachmentModal}
                                    className="px-3 py-1.5 rounded-md text-xs border border-slate-300/60 dark:border-navy-600 text-slate-500"
                                  >
                                    {isPolish ? 'Anuluj' : 'Cancel'}
                                  </button>
                                  <button
                                    onClick={() => void saveAttachmentFromModal()}
                                    disabled={attachmentDiskFiles.length === 0}
                                    className="px-3 py-1.5 rounded-md text-xs bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    {isPolish ? 'Dodaj' : 'Add'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                          {isAttachmentModalOpen && activeProvider && (
                            <CloudFilePicker
                              isOpen={isPickerOpen}
                              onClose={closeFilePicker}
                              provider={activeProvider}
                              onFileSelect={handleCloudFilePickerSelect}
                            />
                          )}

                          {editingAttachmentDraft && (
                            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                              <div
                                className="absolute inset-0 bg-black/60"
                                onClick={() => {
                                  setEditingAttachmentId(null);
                                  setEditingAttachmentDraft(null);
                                }}
                              />
                              <div className={governanceModalClass}>
                                <div className="flex items-center justify-between">
                                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    {isPolish ? 'Edytuj załącznik' : 'Edit attachment'}
                                  </h4>
                                  <button
                                    className="p-1 text-slate-400 hover:text-slate-600"
                                    onClick={() => {
                                      setEditingAttachmentId(null);
                                      setEditingAttachmentDraft(null);
                                    }}
                                  >
                                    <X size={16} />
                                  </button>
                                </div>
                                <label className="text-xs text-slate-500 dark:text-slate-400 block">
                                  {isPolish ? 'Nazwa' : 'Name'}
                                  <input
                                    value={editingAttachmentDraft.name}
                                    onChange={(e) =>
                                      setEditingAttachmentDraft({
                                        ...editingAttachmentDraft,
                                        name: e.target.value,
                                      })
                                    }
                                    className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                                  />
                                </label>
                                <label className="text-xs text-slate-500 dark:text-slate-400 block">
                                  URL
                                  <input
                                    value={editingAttachmentDraft.url}
                                    onChange={(e) =>
                                      setEditingAttachmentDraft({
                                        ...editingAttachmentDraft,
                                        url: e.target.value,
                                      })
                                    }
                                    className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                                  />
                                </label>
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => {
                                      setEditingAttachmentId(null);
                                      setEditingAttachmentDraft(null);
                                    }}
                                    className="px-3 py-1.5 rounded-md text-xs border border-slate-300/60 dark:border-navy-600 text-slate-500"
                                  >
                                    {isPolish ? 'Anuluj' : 'Cancel'}
                                  </button>
                                  <button
                                    onClick={saveEditedAttachment}
                                    className="px-3 py-1.5 rounded-md text-xs bg-purple-600 text-white hover:bg-purple-500"
                                  >
                                    {isPolish ? 'Zapisz' : 'Save'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {isInternalLinkModalOpen && (
                            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                              <div
                                className="absolute inset-0 bg-black/60"
                                onClick={() => {
                                  setIsInternalLinkModalOpen(false);
                                  setLinkSearchQuery('');
                                  setLinkSearchResults([]);
                                }}
                              />
                              <div className={`${governanceModalClass} min-h-[380px]`}>
                                <div className="flex items-center justify-between">
                                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    {isPolish ? 'Dodaj link wewnętrzny' : 'Add internal link'}
                                  </h4>
                                  <button
                                    className="p-1 text-slate-400 hover:text-slate-600"
                                    onClick={() => {
                                      setIsInternalLinkModalOpen(false);
                                      setLinkSearchQuery('');
                                      setLinkSearchResults([]);
                                    }}
                                  >
                                    <X size={16} />
                                  </button>
                                </div>
                                <div className={governanceModalHintClass}>
                                  {isPolish
                                    ? 'Po podlinkowaniu metadane rekordu (np. status i priorytet) powinny pobrać się automatycznie. Jeśli nie, to ważny sygnał problemu z linkowaniem.'
                                    : 'After linking, record metadata (e.g. status and priority) should load automatically. If not, treat it as an important linking issue signal.'}
                                </div>
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <Search size={13} className="text-slate-400 dark:text-slate-500" />
                                    <input
                                      value={linkSearchQuery}
                                      onChange={(e) => setLinkSearchQuery(e.target.value)}
                                      placeholder={
                                        isPolish
                                          ? 'Szukaj task/decision/initiative/project/assessment/report/tool/insight...'
                                          : 'Search task/decision/initiative/project/assessment/report/tool/insight...'
                                      }
                                      className="flex-1 text-xs bg-transparent text-slate-700 dark:text-slate-300 border-b border-slate-200/60 dark:border-navy-600/60 focus:outline-none focus:border-primary-400 py-1"
                                    />
                                  </div>
                                  {linkSearchQuery.trim().length < 2 ? (
                                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                                      {isPolish
                                        ? 'Wpisz min. 2 znaki, aby wyszukać rekordy wewnętrzne.'
                                        : 'Type at least 2 characters to search internal records.'}
                                    </p>
                                  ) : isLinkSearching ? (
                                    <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                                      <Loader2 size={12} className="animate-spin" />
                                      {isPolish ? 'Wyszukiwanie...' : 'Searching...'}
                                    </div>
                                  ) : linkSearchResults.length === 0 ? (
                                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                                      {isPolish
                                        ? 'Brak wyników lub wszystko jest już podpięte.'
                                        : 'No results or everything is already linked.'}
                                    </p>
                                  ) : (
                                    <div className="min-h-[180px] max-h-56 overflow-y-auto space-y-0 divide-y divide-slate-200/40 dark:divide-navy-700/40 rounded-lg border border-slate-200/50 dark:border-navy-700/50 px-1">
                                      {linkSearchResults.slice(0, 16).map((item) => (
                                        <button
                                          key={`${item.type}:${item.id}`}
                                          onClick={() => void handlePickSearchedLinkedItem(item)}
                                          className="w-full py-2 text-left flex items-center gap-2 hover:bg-slate-100/50 dark:hover:bg-navy-800/40 transition-colors px-1 rounded"
                                        >
                                          <span className="text-[10px] font-mono uppercase text-slate-400 dark:text-slate-500 w-14">
                                            {item.type}
                                          </span>
                                          <span className="text-xs text-slate-700 dark:text-slate-300 truncate flex-1">
                                            {item.title}
                                          </span>
                                          <span className="text-[10px] text-slate-400 whitespace-nowrap">
                                            {item.status || '—'}
                                          </span>
                                          <Plus size={11} className="text-primary-500" />
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => {
                                      setIsInternalLinkModalOpen(false);
                                      setLinkSearchQuery('');
                                      setLinkSearchResults([]);
                                    }}
                                    className="px-3 py-1.5 rounded-md text-xs border border-slate-300/60 dark:border-navy-600 text-slate-500"
                                  >
                                    {isPolish ? 'Anuluj' : 'Cancel'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {isExternalLinkModalOpen && (
                            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                              <div
                                className="absolute inset-0 bg-black/60"
                                onClick={() => {
                                  setIsExternalLinkModalOpen(false);
                                  setExternalLinkTitle('');
                                  setExternalLinkUrl('');
                                  setExternalLinkComment('');
                                }}
                              />
                              <div className={`${governanceModalClass} min-h-[380px]`}>
                                <div className="flex items-center justify-between">
                                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    {isPolish ? 'Dodaj link zewnętrzny' : 'Add external link'}
                                  </h4>
                                  <button
                                    className="p-1 text-slate-400 hover:text-slate-600"
                                    onClick={() => {
                                      setIsExternalLinkModalOpen(false);
                                      setExternalLinkTitle('');
                                      setExternalLinkUrl('');
                                      setExternalLinkComment('');
                                    }}
                                  >
                                    <X size={16} />
                                  </button>
                                </div>
                                <div className="space-y-3">
                                  <label className="text-xs text-slate-500 dark:text-slate-400 block">
                                    {isPolish ? 'Tytuł linku' : 'Link title'}
                                    <input
                                      value={externalLinkTitle}
                                      onChange={(e) => setExternalLinkTitle(e.target.value)}
                                      className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                                    />
                                  </label>
                                  <label className="text-xs text-slate-500 dark:text-slate-400 block">
                                    URL
                                    <input
                                      value={externalLinkUrl}
                                      onChange={(e) => setExternalLinkUrl(e.target.value)}
                                      placeholder="https://..."
                                      className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                                    />
                                  </label>
                                  <label className="text-xs text-slate-500 dark:text-slate-400 block">
                                    {isPolish ? 'Komentarz (opcjonalnie)' : 'Comment (optional)'}
                                    <textarea
                                      rows={5}
                                      value={externalLinkComment}
                                      onChange={(e) => setExternalLinkComment(e.target.value)}
                                      placeholder={
                                        isPolish
                                          ? 'Np. Link do finalnej wersji dokumentu dla zespołu wdrożeniowego.'
                                          : 'e.g. Final document version for the implementation team.'
                                      }
                                      className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 resize-none"
                                    />
                                  </label>
                                  <div className="flex justify-end gap-2">
                                    <button
                                      onClick={() => {
                                        setIsExternalLinkModalOpen(false);
                                        setExternalLinkTitle('');
                                        setExternalLinkUrl('');
                                        setExternalLinkComment('');
                                      }}
                                      className="px-3 py-1.5 rounded-md text-xs border border-slate-300/60 dark:border-navy-600 text-slate-500"
                                    >
                                      {isPolish ? 'Anuluj' : 'Cancel'}
                                    </button>
                                    <button
                                      onClick={() => void handleSaveExternalLinkedItem()}
                                      className="px-3 py-1.5 rounded-md text-xs bg-purple-600 text-white hover:bg-purple-500"
                                    >
                                      {isPolish ? 'Dodaj link' : 'Add link'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {editingLinkedItemDraft && (
                            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                              <div
                                className="absolute inset-0 bg-black/60"
                                onClick={() => {
                                  setEditingLinkedItemKey(null);
                                  setEditingLinkedItemDraft(null);
                                }}
                              />
                              <div className={governanceModalClass}>
                                <div className="flex items-center justify-between">
                                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    {editingLinkedItemDraft?.type === 'external'
                                      ? isPolish
                                        ? 'Edytuj link zewnętrzny'
                                        : 'Edit external link'
                                      : isPolish
                                        ? 'Edytuj link wewnętrzny'
                                        : 'Edit internal link'}
                                  </h4>
                                  <button
                                    className="p-1 text-slate-400 hover:text-slate-600"
                                    onClick={() => {
                                      setEditingLinkedItemKey(null);
                                      setEditingLinkedItemDraft(null);
                                    }}
                                  >
                                    <X size={16} />
                                  </button>
                                </div>
                                <label className="text-xs text-slate-500 dark:text-slate-400 block">
                                  {isPolish ? 'Tytuł' : 'Title'}
                                  <input
                                    value={editingLinkedItemDraft.title}
                                    onChange={(e) =>
                                      setEditingLinkedItemDraft({
                                        ...editingLinkedItemDraft,
                                        title: e.target.value,
                                      })
                                    }
                                    className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                                  />
                                </label>
                                {editingLinkedItemDraft.type !== 'external' && (
                                  <label className="text-xs text-slate-500 dark:text-slate-400 block">
                                    {isPolish ? 'Status' : 'Status'}
                                    <input
                                      value={editingLinkedItemDraft.status || ''}
                                      onChange={(e) =>
                                        setEditingLinkedItemDraft({
                                          ...editingLinkedItemDraft,
                                          status: e.target.value,
                                        })
                                      }
                                      className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                                    />
                                  </label>
                                )}
                                {editingLinkedItemDraft.type === 'external' && (
                                  <>
                                    <label className="text-xs text-slate-500 dark:text-slate-400 block">
                                      URL
                                      <input
                                        value={editingLinkedItemDraft.externalUrl || editingLinkedItemDraft.url || ''}
                                        onChange={(e) =>
                                          setEditingLinkedItemDraft({
                                            ...editingLinkedItemDraft,
                                            externalUrl: e.target.value,
                                            url: e.target.value,
                                          })
                                        }
                                        className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                                      />
                                    </label>
                                    <label className="text-xs text-slate-500 dark:text-slate-400 block">
                                      {isPolish ? 'Komentarz' : 'Comment'}
                                      <textarea
                                        rows={3}
                                        value={editingLinkedItemDraft.comment || ''}
                                        onChange={(e) =>
                                          setEditingLinkedItemDraft({
                                            ...editingLinkedItemDraft,
                                            comment: e.target.value,
                                          })
                                        }
                                        className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 resize-none"
                                      />
                                    </label>
                                  </>
                                )}
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => {
                                      setEditingLinkedItemKey(null);
                                      setEditingLinkedItemDraft(null);
                                    }}
                                    className="px-3 py-1.5 rounded-md text-xs border border-slate-300/60 dark:border-navy-600 text-slate-500"
                                  >
                                    {isPolish ? 'Anuluj' : 'Cancel'}
                                  </button>
                                  <button
                                    onClick={saveEditedLinkedItem}
                                    className="px-3 py-1.5 rounded-md text-xs bg-purple-600 text-white hover:bg-purple-500"
                                  >
                                    {isPolish ? 'Zapisz' : 'Save'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ── Section: Activity Log (end section) ─────────── */}
                      {activeNotionSection === 'activity-log' && (
                        <div className="space-y-6">
                          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                            {isPolish ? 'Logi aktywności' : 'Activity Log'}
                          </h2>
                          {renderActivityLogPanel()}
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
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                          {isPolish ? 'Przegląd decyzji' : 'Decision Overview'}
                        </h3>
                        {renderFieldAIButton(
                          'c-description',
                          'Decision Overview',
                          description,
                          setDescription
                        )}
                      </div>
                      <textarea
                        value={description}
                        onChange={(e) => !isDecisionStageLocked && setDescription(e.target.value)}
                        readOnly={isDecisionStageLocked}
                        rows={6}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm"
                      />
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                          {isPolish ? 'Konsekwencje braku decyzji' : 'Consequences of Inaction'}
                        </label>
                        {renderFieldAIButton(
                          'c-rationale',
                          'Consequences of Inaction',
                          rationale,
                          setRationale
                        )}
                      </div>
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
                                  integrationChannels: [],
                                  syncTargets: [],
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
                                      <div className="flex flex-wrap gap-1">
                                        {stakeholderChannelLabels(s.notificationSettings).map((label) => (
                                          <span
                                            key={`${s.id}-clickup-${label}`}
                                            className="px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-navy-700/60 bg-slate-50/50 dark:bg-navy-800/50 text-[10px]"
                                          >
                                            {label}
                                          </span>
                                        ))}
                                      </div>
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
                                        onClick={() => handleRemoveLinkedItem(item)}
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
                      <h3 className="text-base font-semibold text-slate-700 dark:text-slate-100">
                        {isPolish ? 'Logi aktywności' : 'Activity Log'}
                      </h3>
                      {renderActivityLogPanel()}
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
