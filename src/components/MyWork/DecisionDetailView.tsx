/**
 * DecisionDetailView
 * Full-page decision detail view for dynamic tabs
 * Supports 2 presentation modes: N (notion/page-first) / C (clickup/action-first)
 * Note: D mode (accordion) has been removed — N mode is primary
 *
 * @see docs/ui-standards/01-shell-layout/presentation-modes.md
 * @see docs/ui-standards/00-foundation/visual-language.md
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowDownUp,
  ArrowUp,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronsUpDown,
  Clock,
  Cloud,
  Edit3,
  ExternalLink,
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

import { Callout } from '@/components/shared/NModeBlocks';
import { type SmartOpenConditions, useAccordionSections } from '@/hooks/useAccordionSections';
import {
  type CloudFile,
  type CloudProviderId,
  useCloudIntegrations,
} from '@/hooks/useCloudIntegrations';
import { usePresentationMode } from '@/hooks/usePresentationMode';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { ROUTES } from '@/routes/routeConfig';
import { useAppStore } from '@/store/useAppStore';
import { useConversationStore } from '@/store/useConversationStore';
import { AppView } from '@/types';
import { buildArtifactCode } from '@/utils/artifactLinks';

import { Api } from '../../services/api';
import { CloudFilePicker } from '../AIChat/CloudFilePicker';
import { AIFieldEnhancer } from '../shared/AIFieldEnhancer';
import { ArtifactPermalinkButton } from '../shared/ArtifactPermalinkButton';
import { NModeHeader } from '../shared/NModeLayout/NModeHeader';
import { NModeLeftNav } from '../shared/NModeLayout/NModeLeftNav';
import { NModePropertiesStrip } from '../shared/NModeLayout/NModePropertiesStrip';
import type { NModeSection } from '../shared/NModeLayout/types';
import type {
  ActivityLogEntry as NModeActivityLogEntry,
  ActivityStats,
  ActivityTypeMeta,
} from '../shared/NModeSections/ActivityLogCanvas';
import { ActivityLogCanvas } from '../shared/NModeSections/ActivityLogCanvas';
import { AttachmentsLinksCanvas } from '../shared/NModeSections/AttachmentsLinksCanvas';
import type {
  CommentItem as NModeCommentItem,
  CommentPriority,
  DateFilter,
  SortOrder,
} from '../shared/NModeSections/CommentsCanvas';
import { CommentsCanvas } from '../shared/NModeSections/CommentsCanvas';
import { RiskCanvas } from '../shared/NModeSections/RiskCanvas';
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
  {
    id: 'cmt-5',
    content:
      'From implementation side, we can prepare a rollback plan in case generated report quality drops below the acceptance threshold.',
    authorId: 'konrad-dbr77',
    authorName: 'Konrad Milewski',
    createdAt: '2026-02-10T13:20:00Z',
    likes: 1,
  },
  {
    id: 'cmt-6',
    content:
      'Finance confirms budget availability for Option A in Q1, but only if we keep onboarding effort below 40 consulting hours per client.',
    authorId: 'ewa-dbr77',
    authorName: 'Ewa Wójcik',
    createdAt: '2026-02-10T15:05:00Z',
    likes: 0,
  },
  {
    id: 'cmt-7',
    content:
      'Please add explicit quality gates: schema validation, mandatory field checks, and reviewer sign-off before final publishing.',
    authorId: 'piotr-dbr77',
    authorName: 'Piotr Wiśniewski',
    createdAt: '2026-02-10T16:40:00Z',
    likes: 2,
  },
  {
    id: 'cmt-8',
    content:
      'Recommendation: approve pilot scope now and schedule a checkpoint after first 10 generated reports to confirm KPI trend.',
    authorId: 'justyna-dbr77',
    authorName: 'Justyna Laskowska',
    createdAt: '2026-02-10T17:25:00Z',
    likes: 4,
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

  // ── Presentation Mode (N = Notion / C = ClickUp) ──────────────────────────
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
  const [isGeneratingAltProsCons, setIsGeneratingAltProsCons] = useState<Record<string, boolean>>(
    {}
  );
  const [consequenceScenarios, setConsequenceScenarios] = useState<ConsequenceScenarios | null>(
    null
  );
  const [isGeneratingConsequenceScenarios, setIsGeneratingConsequenceScenarios] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentDraftPriority, setCommentDraftPriority] = useState<CommentPriorityLevel>('normal');
  const [commentDateFilter, setCommentDateFilter] = useState<CommentDateFilter>('all');
  const [commentSortOrder, setCommentSortOrder] = useState<'asc' | 'desc'>('desc');
  const commentInputRef = useRef<HTMLInputElement | null>(null);
  const [isEnhancingCommentDraft, setIsEnhancingCommentDraft] = useState(false);
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
    'relative w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-navy-700/50 bg-white/95 dark:bg-navy-900/95 shadow-2xl p-6 space-y-5';
  const governanceTableCardClass =
    'bg-white/70 dark:bg-navy-900/70 rounded-2xl border border-slate-200 dark:border-navy-700/60 p-4 space-y-3 h-[340px] flex flex-col';
  const governanceModalHintClass =
    'rounded-xl border border-slate-200 dark:border-navy-700/60 bg-slate-50/70 dark:bg-navy-800/50 px-3 py-2 text-xs text-slate-600 dark:text-slate-300';
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
          ? source.coreChannels.filter(
              (c): c is CoreDeliveryChannel => c === 'in_app' || c === 'email'
            )
          : backup?.coreChannels || ['in_app'],
      integrationChannels: (source?.integrationChannels || []).filter(
        (c): c is IntegrationChannel => integrationChannelCatalog.some((entry) => entry.key === c)
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

  const normalizeEscalationRule = (
    rule: Partial<EscalationRuleWithConfig>
  ): EscalationRuleWithConfig => ({
    id: String(rule.id || Math.random().toString(36).slice(2, 11)),
    enabled: rule.enabled !== false,
    escalateTo: String(rule.escalateTo || ''),
    escalateToName: rule.escalateToName ? String(rule.escalateToName) : '',
    afterDays: Math.max(1, Number(rule.afterDays ?? 3)),
    warningDays: Math.max(0, Number(rule.warningDays ?? 3)),
    criticalDays: Math.max(0, Number(rule.criticalDays ?? 1)),
    escalationMode: (
      ['notify_only', 'manager_review', 'executive_alert'] as EscalationMode[]
    ).includes(rule.escalationMode as EscalationMode)
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

  // NModeSection-compatible navigation sections (used by NModeLeftNav)
  const notionSections: Array<{
    id: string;
    label: { en: string; pl: string };
    icon: React.FC<{ size?: number; className?: string }>;
  }> = useMemo(
    () => [
      {
        id: 'context-problem',
        label: { en: 'Decision Scope', pl: 'Zakres decyzji' },
        icon: FileText,
      },
      {
        id: 'options-tradeoffs',
        label: { en: 'Options & Trade-offs', pl: 'Opcje i trade-offy' },
        icon: Lightbulb,
      },
      {
        id: 'risk-impact',
        label: { en: 'Risk & Impact', pl: 'Ryzyko i wpływ' },
        icon: AlertTriangle,
      },
      { id: 'consequences', label: { en: 'Consequences', pl: 'Konsekwencje' }, icon: Clock },
      {
        id: 'governance-escalation',
        label: { en: 'RACI & Escalation', pl: 'RACI i eskalacja' },
        icon: Users,
      },
      { id: 'comments', label: { en: 'Comments', pl: 'Komentarze' }, icon: MessageSquare },
      {
        id: 'resources-links',
        label: { en: 'Attachments & Links', pl: 'Załączniki i powiązania' },
        icon: FolderOpen,
      },
      { id: 'activity-log', label: { en: 'Activity Log', pl: 'Logi aktywności' }, icon: History },
    ],
    []
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
      hasBlockingRelations: linkedItems.some((li) => li.linkRelation === 'blocks'),
      isHighImpact: priority === 'high' || priority === 'critical',
    }),
    [status, escalation, linkedItems, priority]
  );

  const { toggleSection, isExpanded } = useAccordionSections({
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
        <div className="rounded-xl border border-slate-200 dark:border-navy-700/60 bg-white/70 dark:bg-navy-900/70 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500">
            {isPolish ? 'Wpisy' : 'Entries'}
          </p>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {activityStats.total}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-navy-700/60 bg-white/70 dark:bg-navy-900/70 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500">
            {isPolish ? 'Zmiany' : 'Changes'}
          </p>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {activityStats.edited}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-navy-700/60 bg-white/70 dark:bg-navy-900/70 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500">
            {isPolish ? 'Eskalacje' : 'Escalations'}
          </p>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {activityStats.escalations}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-navy-700/60 bg-white/70 dark:bg-navy-900/70 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500">
            {isPolish ? 'Współpraca' : 'Collaboration'}
          </p>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {activityStats.collaboration}
          </p>
        </div>
      </div>

      {activityLogSorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300/60 dark:border-navy-700/70 bg-white/40 dark:bg-navy-900/40 p-6 text-center text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
          {isPolish ? 'Brak wpisów w logu.' : 'No activity entries yet.'}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-navy-700/60 bg-white/70 dark:bg-navy-900/70 p-3">
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
                    <p className="text-sm text-slate-700 dark:text-slate-200">
                      {entry.description}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-500">
                      <span>{new Date(entry.timestamp).toLocaleString()}</span>
                      {entry.userName && <span>{`· ${entry.userName}`}</span>}
                      <span className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-navy-700/60">
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
                  <span className="text-[10px] font-mono uppercase tracking-wide text-slate-700 dark:text-slate-300 dark:text-slate-600">
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
      setAlternatives(
        withProsConsFallback(apiAlternatives.length > 0 ? apiAlternatives : DEMO_ALTERNATIVES)
      );
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
            setReminders(
              local.reminders.map((rule: ReminderRuleWithDelivery) => normalizeReminderRule(rule))
            );
          if (local.escalation) setEscalation(local.escalation);
          if (Array.isArray(local.escalationRules) && local.escalationRules.length > 0) {
            setEscalationRules(
              local.escalationRules.map((rule: EscalationRuleWithConfig) =>
                normalizeEscalationRule(rule)
              )
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

  // SaaS autosave: persist edits to backend (debounced).
  useEffect(() => {
    if (!isLocalHydrated || !hasPublishBaseline || !isDirty) return;
    const timer = setTimeout(() => {
      handleSave(true);
    }, 900);
    return () => clearTimeout(timer);
  }, [isLocalHydrated, hasPublishBaseline, isDirty, draftSnapshot]);

  const handleSave = async (silent = false) => {
    if (!title.trim()) {
      if (!silent) toast.error(isPolish ? 'Tytuł jest wymagany' : 'Title is required');
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
        if (!silent) toast.success(isPolish ? 'Decyzja zaktualizowana' : 'Decision updated');
      } else {
        await Api.createDecision(payload);
        if (!silent) toast.success(isPolish ? 'Decyzja utworzona' : 'Decision created');
      }
      setLastPublishedSnapshot(draftSnapshot);
      persistDraft(silent ? 'autosave' : 'publish');
      onSaved?.({ ...payload, id: decisionId });
    } catch (error) {
      console.error('Failed to save decision', error);
      if (!silent)
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
      const recentComments = comments
        .slice(-5)
        .map((c, idx) => `${idx + 1}. ${c.authorName}: ${c.content}`)
        .join('\n');
      const decisionStatus = status || (isPolish ? 'brak statusu' : 'no status');
      const decisionPriority = priority || (isPolish ? 'brak priorytetu' : 'no priority');

      const prompt = isPolish
        ? `Wygeneruj JEDEN konkretny komentarz do decyzji projektowej.
Cel: pomóc zespołowi podjąć najlepszy kolejny krok decyzyjny.

Zasady:
- 2-4 krótkie zdania.
- Maksymalnie 450 znaków.
- Bez markdown, bez emoji, bez list numerowanych.
- Nie powtarzaj treści podobnej do ostatnich komentarzy.
- Komentarz ma być praktyczny i oparty na podanym kontekście.

Kontekst decyzji:
- Tytuł: ${title || 'Brak tytułu'}
- Opis: ${description || 'Brak opisu'}
- Status: ${decisionStatus}
- Priorytet: ${decisionPriority}
- Termin: ${dueDate || 'Brak terminu'}
- Interesariusze: ${stakeholders.length}
- Ryzyka: ${risks.length}
- Alternatywy: ${alternatives.length}

Ostatnie komentarze:
${recentComments || 'Brak komentarzy'}

Zwróć WYŁĄCZNIE gotowy tekst komentarza.`
        : `Generate ONE concrete comment for a project decision.
Goal: help the team choose the most useful next decision step.

Rules:
- 2-4 short sentences.
- Max 450 characters.
- No markdown, no emoji, no numbered lists.
- Do not repeat or paraphrase recent comments.
- Keep it practical and grounded in the provided context.

Decision context:
- Title: ${title || 'Untitled'}
- Description: ${description || 'No description'}
- Status: ${decisionStatus}
- Priority: ${decisionPriority}
- Deadline: ${dueDate || 'No deadline'}
- Stakeholders: ${stakeholders.length}
- Risks: ${risks.length}
- Alternatives: ${alternatives.length}

Recent comments:
${recentComments || 'No comments yet'}

Return ONLY the final comment text.`;

      const aiRes = await Api.post('/ai/chat', {
        message: prompt,
        history: [],
        systemInstruction: isPolish
          ? 'Jesteś praktycznym PMO coachem decyzyjnym. Odpowiadasz konkretnie i bez ogólników.'
          : 'You are a practical PMO decision coach. Be concrete and avoid generic filler.',
        roleName: 'Decision Comment Advisor',
      });

      const raw = String(aiRes?.text || aiRes?.content || '').trim();
      const generatedComment = raw
        .replace(/^```[\w-]*\n?/g, '')
        .replace(/```$/g, '')
        .replace(/^["']|["']$/g, '')
        .trim();

      if (!generatedComment) {
        throw new Error('Empty AI response');
      }

      const recentAIMessages = comments
        .filter((c) => c.authorId === 'ai-assistant')
        .slice(-3)
        .map((c) => c.content.trim().toLowerCase());

      const finalComment = recentAIMessages.includes(generatedComment.toLowerCase())
        ? `${generatedComment} ${isPolish ? 'Skoncentrujmy się na jednym mierzalnym kroku do końca dnia.' : 'Let us focus on one measurable step by end of day.'}`
        : generatedComment;

      const newComment: Comment = {
        id: Math.random().toString(36).substr(2, 9),
        content: finalComment,
        authorId: 'ai-assistant',
        authorName: 'AI Assistant',
        createdAt: new Date().toISOString(),
        likes: 0,
        isAIGenerated: true,
      };

      setComments([...comments, newComment]);
      toast.success(isPolish ? 'Komentarz AI wygenerowany' : 'AI comment generated');
    } catch {
      const fallback = isPolish
        ? `Przed finalną decyzją doprecyzujmy jeden krytyczny warunek akceptacji i przypiszmy właściciela następnego kroku. To obniży ryzyko opóźnień i niejasności odpowiedzialności.`
        : `Before finalizing this decision, clarify one critical acceptance condition and assign an owner for the next step. This will reduce delay risk and responsibility ambiguity.`;

      const newComment: Comment = {
        id: Math.random().toString(36).substr(2, 9),
        content: fallback,
        authorId: 'ai-assistant',
        authorName: 'AI Assistant',
        createdAt: new Date().toISOString(),
        likes: 0,
        isAIGenerated: true,
      };

      setComments((prev) => [...prev, newComment]);
      toast.success(isPolish ? 'Dodano komentarz pomocniczy AI' : 'Added a fallback AI comment');
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
              arr.map((m) => String(m?.userId || m?.id || m?.memberId || '').trim()).filter(Boolean)
            )
            .filter((id, idx, arr) => arr.indexOf(id) === idx);
        } catch {
          // Best-effort only; fallback to org users list.
        }
      }

      const candidateUsers =
        projectMemberIds.length > 0 ? users.filter((u) => projectMemberIds.includes(u.id)) : users;
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
          message: isPolish
            ? 'Decyzja po terminie - wymaga reakcji.'
            : 'Decision overdue - action needed.',
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
            escalationMode: (
              ['notify_only', 'manager_review', 'executive_alert'] as EscalationMode[]
            ).includes(r?.escalationMode)
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
              message:
                prev.message || (isPolish ? 'Termin decyzji za 3 dni.' : 'Decision due in 3 days.'),
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
              escalationMode: (
                ['notify_only', 'manager_review', 'executive_alert'] as EscalationMode[]
              ).includes(r?.escalationMode)
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
    () => linkedItems.filter((item) => item.type === 'task' || item.type === 'decision'),
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
        ? [
            'Wyższy koszt',
            'Większe ryzyko',
            'Wolniej',
            'Większa złożoność',
            'Zależność od dostawcy',
          ]
        : [
            'Higher cost',
            'Higher risk',
            'Slower delivery',
            'Higher complexity',
            'Vendor dependency',
          ],
    [isPolish]
  );
  const riskLevelOptions = useMemo(() => ['low', 'medium', 'high', 'critical'] as const, []);
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
    if (score >= 8) return 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/30';
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
    const recommendation =
      recommendedAlternative?.title || (isPolish ? 'wybraną opcję' : 'selected option');
    const decider =
      deciderName || deciderId || (isPolish ? 'właściciel decyzji' : 'decision owner');
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

  const fallbackRefineText = (input: string, mode: 'improve' | 'shorten' | 'expand' | 'formal') => {
    const normalized = input
      .replace(/\s+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
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
        isPolish ? 'Najpierw wpisz treść do edycji AI' : 'Enter some content first to edit with AI'
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
          const confirmRes = await Api.chatConfirm(
            prompt,
            [],
            systemInstruction,
            undefined,
            undefined
          );
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
        isPolish ? 'Nie udało się poprawić treści przez AI' : 'Failed to refine content with AI'
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
        onClick={() => setAiMenuOpenField((prev) => (prev === fieldKey ? null : fieldKey))}
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
        <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-44 rounded-lg border border-slate-200 dark:border-navy-700/70 bg-white/95 dark:bg-navy-900/95 backdrop-blur p-1 shadow-xl">
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
          : 'border-slate-200 dark:border-navy-600/60';
  const priorityAlertBorderClass =
    priority === 'critical'
      ? 'border-red-400/70 dark:border-red-500/50'
      : priority === 'high'
        ? 'border-amber-400/70 dark:border-amber-500/50'
        : priority === 'medium'
          ? 'border-blue-400/70 dark:border-blue-500/50'
          : 'border-slate-200 dark:border-navy-600/60';
  const dueDateAlertBorderClass = useMemo(() => {
    if (!dueDate) return 'border-slate-200 dark:border-navy-600/60';
    if (status === 'approved' || status === 'rejected')
      return 'border-slate-200 dark:border-navy-600/60';
    const due = new Date(dueDate);
    if (Number.isNaN(due.getTime())) return 'border-slate-200 dark:border-navy-600/60';
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
      if (commentDateFilter === '7d')
        return now.getTime() - created.getTime() <= 7 * 24 * 60 * 60 * 1000;
      if (commentDateFilter === '30d')
        return now.getTime() - created.getTime() <= 30 * 24 * 60 * 60 * 1000;
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

  const getCommentPriority = (comment: Comment): CommentPriorityLevel =>
    ((comment as Comment & { priority?: CommentPriorityLevel }).priority ||
      'normal') as CommentPriorityLevel;

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
    return isPolish ? 'Standardowy komentarz roboczy.' : 'Standard working-level comment.';
  };

  const getPriorityButtonClass = (priority: CommentPriorityLevel, isActive: boolean) => {
    if (isActive && priority === 'high') {
      return 'border-red-400/80 text-red-300 bg-red-500/20 shadow-[0_0_0_1px_rgba(239,68,68,0.3)]';
    }
    if (isActive && priority === 'normal') {
      return 'border-indigo-400/70 text-indigo-300 bg-indigo-500/15 shadow-[0_0_0_1px_rgba(129,140,248,0.2)]';
    }
    if (isActive && priority === 'low') {
      return 'border-emerald-400/80 text-emerald-300 bg-emerald-500/20 shadow-[0_0_0_1px_rgba(16,185,129,0.3)]';
    }
    return 'border-slate-300/55 dark:border-navy-600/60 text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:border-slate-400/70 hover:text-slate-700 dark:text-slate-300';
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
      toast(isPolish ? 'Użyto lokalnej podpowiedzi AI' : 'Applied local AI fallback hint', {
        icon: '⚠️',
      });
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

  const scrollToCommentInput = useCallback(() => {
    commentInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => commentInputRef.current?.focus(), 350);
  }, []);

  // ── CommentsCanvas props mapping (N-mode shared component) ─────────────
  const nModeComments: NModeCommentItem[] = useMemo(
    () =>
      filteredComments.map((c) => ({
        id: c.id,
        authorName: c.authorName,
        content: c.content,
        createdAt: c.createdAt,
        isAIGenerated: c.isAIGenerated,
        priority: getCommentPriority(c) as CommentPriority,
      })),
    [filteredComments]
  );

  // ── ActivityLogCanvas props mapping (N-mode shared component) ──────────
  const nModeActivityEntries: NModeActivityLogEntry[] = useMemo(
    () =>
      activityLogSorted.map((e) => ({
        id: e.id,
        type: e.type,
        description: e.description,
        timestamp: e.timestamp,
        userName: e.userName,
        oldValue: e.oldValue,
        newValue: e.newValue,
      })),
    [activityLogSorted]
  );

  const nModeActivityStats: ActivityStats = useMemo(() => activityStats, [activityStats]);

  const nModeActivityTypeMeta = (type: string): ActivityTypeMeta => {
    return activityTypeMeta(type as ActivityLogEntry['type']);
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

      const title = String(
        entity.title || entity.name || entity.summary || item.title || 'Untitled'
      );
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
      if (
        prev.some((existing) => existing.id === linkedItem.id && existing.type === linkedItem.type)
      ) {
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

  const handleRemoveLinkedItem = async (linkToRemove: string | Pick<LinkedItem, 'id' | 'type'>) => {
    if (isDecisionStageLocked) return;
    if (typeof linkToRemove === 'string') {
      setLinkedItems(linkedItems.filter((i) => i.id !== linkToRemove));
      return;
    }
    setLinkedItems(
      linkedItems.filter((i) => !(i.id === linkToRemove.id && i.type === linkToRemove.type))
    );
  };

  const searchLinkedItems = useCallback(
    async (query: string) => {
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
        ] = await Promise.allSettled([
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
              : (projectsRes.value as any)?.projects || []
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
    },
    [isPolish]
  );

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
          {/* Title Header — uses shared NModeHeader component */}
          <NModeHeader
            title={title}
            onTitleChange={(v) => !isDecisionStageLocked && setTitle(v)}
            titleReadOnly={isDecisionStageLocked}
            titlePlaceholder={{ en: 'Decision title...', pl: 'Tytuł decyzji...' }}
            artifactId={decisionId || undefined}
            artifactType="decision"
            onSave={handleSave}
            saving={saving}
            isDirty={isDirty}
            onChat={handleOpenChat}
            onClose={onClose}
            draftSavedLabel={draftSavedLabel || undefined}
            statusDotColor={statusConfig.color}
            presentationMode={presentationMode}
            onPresentationModeChange={setPresentationMode}
            buildArtifactCode={buildArtifactCode}
          />

          {/* Temporary: C-mode placeholder */}
          {presentationMode === 'c' && (
            <div className="col-span-full mt-4">
              <Callout
                variant="warning"
                title={isPolish ? 'Tryb C jest w budowie' : 'C mode is under construction'}
                action={{
                  label: isPolish ? 'Przełącz na N' : 'Switch to N',
                  onClick: () => setPresentationMode('n'),
                }}
              >
                {isPolish
                  ? 'Ten widok zostanie przebudowany. Na teraz korzystaj z trybu N (page-first).'
                  : 'This view will be rebuilt. For now, please use N mode (page-first).'}
              </Callout>
            </div>
          )}

          {/* ═══════════ N MODE (page-first, 2-pane) ═════════════════════════
               Layout per docs/ui-standards/01-shell-layout/presentation-modes.md §2.5:
               - PropertiesStrip (full-width, under header)
               - 2-pane: LeftNav (fixed ~220px) | Canvas (selected section only)
               Left nav click → shows ONE section at a time (no scroll-all).
               ═══════════════════════════════════════════════════════════════════ */}
          {presentationMode === 'n' && (
            <div className="col-span-full space-y-4">
              {/* ── PropertiesStrip — shared NModePropertiesStrip ─────────── */}
              <NModePropertiesStrip
                fields={[
                  {
                    id: 'status',
                    label: { en: 'Status', pl: 'Status' },
                    type: 'select' as const,
                    value: status,
                    onChange: (v) => setStatus(v as keyof typeof STATUS_CONFIG),
                    options: Object.entries(STATUS_CONFIG).map(([key, config]) => ({
                      value: key,
                      label: config.label,
                    })),
                    alertBorderClass: statusAlertBorderClass,
                  },
                  {
                    id: 'priority',
                    label: { en: 'Priority', pl: 'Priorytet' },
                    type: 'select' as const,
                    value: priority,
                    onChange: (v) => setPriority(v as keyof typeof PRIORITY_CONFIG),
                    options: Object.entries(PRIORITY_CONFIG).map(([key, config]) => ({
                      value: key,
                      label: config.label,
                    })),
                    alertBorderClass: priorityAlertBorderClass,
                  },
                  {
                    id: 'createdAt',
                    label: { en: 'Created date', pl: 'Data utworzenia' },
                    type: 'date' as const,
                    value: createdAt ? createdAt.split('T')[0] : '',
                    onChange: setCreatedAt,
                  },
                  {
                    id: 'dueDate',
                    label: { en: 'Deadline', pl: 'Termin' },
                    type: 'date' as const,
                    value: dueDate,
                    onChange: setDueDate,
                    alertBorderClass: dueDateAlertBorderClass,
                  },
                  {
                    id: 'requester',
                    label: { en: 'Requester', pl: 'Wnioskodawca' },
                    type: 'text' as const,
                    value: requesterName,
                    onChange: setRequesterName,
                    placeholder: { en: 'Requester...', pl: 'Wnioskodawca...' },
                  },
                  {
                    id: 'decider',
                    label: { en: 'Decider', pl: 'Decydent' },
                    type: 'custom' as const,
                    value: deciderId,
                    onChange: setDeciderId,
                    render: () => (
                      <select
                        value={deciderId}
                        onChange={(e) => setDeciderId(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600/60 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-primary-400 transition-colors"
                      >
                        <option value="">—</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.firstName} {u.lastName}
                          </option>
                        ))}
                      </select>
                    ),
                  },
                ]}
              />
              {/* ── Inline ActionBar (kept for now, will migrate to NModeActionBar) */}
              <div className="px-4 py-3 rounded-2xl bg-white/80 dark:bg-navy-900/80 backdrop-blur-xl border border-slate-200 dark:border-navy-700/60">
                {/* Action buttons for pending decisions */}
                {decisionId && isPending && (
                  <div className="flex items-center gap-2">
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
                        title={
                          isPolish
                            ? 'Uruchom analizę konsekwencji przez AI'
                            : 'Run AI consequence analysis'
                        }
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

              {/* ── 2-Pane: LeftNav + Canvas — shared NModeLeftNav ───────── */}
              <div className="flex gap-0 min-h-[60vh]">
                <NModeLeftNav
                  sections={notionSections as NModeSection[]}
                  activeSection={activeNotionSection}
                  onSectionChange={setActiveNotionSection}
                />

                {/* Canvas (shows selected section only) */}
                <div className="flex-1 pl-6 pt-1 min-w-0">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeNotionSection}
                      initial={reducedMotion ? {} : { opacity: 0, y: 3 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reducedMotion ? {} : { opacity: 0, y: -3 }}
                      transition={{ duration: motionDuration }}
                    >
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
                            <label className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500">
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
                              <label className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500">
                                {isPolish ? 'Zakres decyzji' : 'Decision scope'}
                              </label>
                              <AIFieldEnhancer
                                fieldKey="n-description"
                                sectionLabel="Decision Scope"
                                currentValue={description}
                                onApply={setDescription}
                                artifactContext={{ title, status, priority, type: 'decision' }}
                                disabled={isDecisionStageLocked}
                              />
                            </div>
                            <div className="relative">
                              <textarea
                                value={description}
                                onChange={(e) =>
                                  !isDecisionStageLocked && setDescription(e.target.value)
                                }
                                readOnly={isDecisionStageLocked}
                                rows={isDescriptionExpanded ? 10 : 6}
                                className="w-full px-0 py-2 bg-transparent text-sm leading-relaxed text-slate-700 dark:text-slate-300 focus:outline-none placeholder-slate-400 dark:placeholder-slate-600 resize-y border-b border-slate-200 dark:border-navy-700/40 focus:border-primary-400 transition-colors"
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
                              <label className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500">
                                {isPolish ? 'Kontekst uzupełniający' : 'Additional context'}
                              </label>
                              <AIFieldEnhancer
                                fieldKey="n-context"
                                sectionLabel="Additional Context"
                                currentValue={contextDetails}
                                onApply={setContextDetails}
                                artifactContext={{ title, status, priority, type: 'decision' }}
                                disabled={isDecisionStageLocked}
                              />
                            </div>
                            <div className="relative">
                              <textarea
                                value={contextDetails}
                                onChange={(e) =>
                                  !isDecisionStageLocked && setContextDetails(e.target.value)
                                }
                                readOnly={isDecisionStageLocked}
                                rows={isContextExpanded ? 8 : 5}
                                className="w-full px-0 py-2 bg-transparent text-sm leading-relaxed text-slate-700 dark:text-slate-300 focus:outline-none placeholder-slate-400 dark:placeholder-slate-600 resize-y border-b border-slate-200 dark:border-navy-700/40 focus:border-primary-400 transition-colors"
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
                                className="mx-auto mb-3 text-slate-700 dark:text-slate-300 dark:text-slate-600"
                              />
                              <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500 mb-3">
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
                                          className="p-1 text-slate-500 dark:text-slate-400 hover:text-emerald-500 transition-colors"
                                          title="Set recommended"
                                        >
                                          <Star size={13} />
                                        </button>
                                      )}
                                      <button
                                        onClick={() => removeAlternative(alt.id)}
                                        className="p-1 text-slate-500 dark:text-slate-400 hover:text-red-500 transition-colors"
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
                                    <AIFieldEnhancer
                                      fieldKey={`n-alt-${alt.id}`}
                                      sectionLabel={`Option: ${alt.title || 'Option description'}`}
                                      currentValue={alt.description || ''}
                                      onApply={(value) =>
                                        updateAlternative(alt.id, { description: value })
                                      }
                                      artifactContext={{
                                        title,
                                        status,
                                        priority,
                                        type: 'decision',
                                      }}
                                      disabled={isDecisionStageLocked}
                                    />
                                  </div>
                                  {/* Inline pros/cons */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 text-[11px]">
                                    <div className="space-y-1.5">
                                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                        + {alt.pros?.length || 0} {isPolish ? 'za' : 'pros'}
                                      </span>
                                      {(alt.pros || []).map((pro, idx) => (
                                        <div
                                          key={`${alt.id}-pro-${idx}`}
                                          className="flex items-center gap-1.5"
                                        >
                                          <input
                                            value={pro}
                                            onChange={(e) =>
                                              updateAlternativePro(alt.id, idx, e.target.value)
                                            }
                                            className="flex-1 text-[11px] bg-transparent border-b border-emerald-400/20 text-slate-600 dark:text-slate-300 focus:outline-none focus:border-emerald-400"
                                            placeholder={
                                              isPolish ? 'Argument za...' : 'Pro argument...'
                                            }
                                          />
                                          <button
                                            onClick={() => removeAlternativePro(alt.id, idx)}
                                            className="p-0.5 text-slate-500 dark:text-slate-400 hover:text-red-500 transition-colors"
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
                                          className="flex-1 text-[11px] bg-transparent border-b border-slate-200 dark:border-navy-600/60 text-slate-500 dark:text-slate-400 focus:outline-none focus:border-primary-400"
                                          placeholder={
                                            isPolish ? '+ Dodaj argument za' : '+ Add pro'
                                          }
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
                                        <div
                                          key={`${alt.id}-con-${idx}`}
                                          className="flex items-center gap-1.5"
                                        >
                                          <input
                                            value={con}
                                            onChange={(e) =>
                                              updateAlternativeCon(alt.id, idx, e.target.value)
                                            }
                                            className="flex-1 text-[11px] bg-transparent border-b border-red-400/20 text-slate-600 dark:text-slate-300 focus:outline-none focus:border-red-400"
                                            placeholder={
                                              isPolish ? 'Argument przeciw...' : 'Con argument...'
                                            }
                                          />
                                          <button
                                            onClick={() => removeAlternativeCon(alt.id, idx)}
                                            className="p-0.5 text-slate-500 dark:text-slate-400 hover:text-red-500 transition-colors"
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
                                          className="flex-1 text-[11px] bg-transparent border-b border-slate-200 dark:border-navy-600/60 text-slate-500 dark:text-slate-400 focus:outline-none focus:border-primary-400"
                                          placeholder={
                                            isPolish ? '+ Dodaj argument przeciw' : '+ Add con'
                                          }
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
                                        className={`font-medium ${alt.riskLevel === 'high' ? 'text-red-500' : alt.riskLevel === 'medium' ? 'text-amber-500' : 'text-slate-500 dark:text-slate-400'}`}
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
                            className="text-xs font-medium text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:text-primary-500 transition-colors"
                          >
                            + {isPolish ? 'Dodaj opcję' : 'Add option'}
                          </button>
                        </div>
                      )}

                      {/* ── Section: Risk & Impact (shared RiskCanvas) ────── */}
                      {activeNotionSection === 'risk-impact' && (
                        <RiskCanvas
                          risks={risks}
                          onAddRisk={addRisk}
                          onUpdateRisk={(id, updates) => updateRisk(id, updates as any)}
                          onRemoveRisk={removeRisk}
                          onAIGenerate={generateRisksAI}
                          isGeneratingAI={isGeneratingRisks}
                          locked={isDecisionStageLocked}
                          artifactType="decision"
                          artifactContext={{ title, status, priority, type: 'decision' }}
                          fieldKeyPrefix="n"
                        />
                      )}

                      {/* ── Section: Consequences (dedicated menu block) ── */}
                      {activeNotionSection === 'consequences' && (
                        <div className="space-y-6">
                          <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                              {isPolish ? 'Konsekwencje braku decyzji' : 'Consequences of Inaction'}
                            </h2>
                            <AIFieldEnhancer
                              fieldKey="n-rationale-scenarios"
                              sectionLabel="Consequences of Inaction"
                              currentValue={rationale}
                              onApply={setRationale}
                              artifactContext={{ title, status, priority, type: 'decision' }}
                              disabled={isDecisionStageLocked}
                            />
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-500">
                              <span>
                                {isPolish
                                  ? 'Scenariusze AI (real-time)'
                                  : 'AI scenarios (real-time)'}
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
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-500">
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
                                    <span className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500">
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
                                        className="rounded-lg border border-slate-200 dark:border-navy-700/50 bg-white/30 dark:bg-navy-900/25 p-2"
                                      >
                                        <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500">
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
                              <label className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500">
                                {isPolish ? 'Notatka decyzyjna' : 'Decision note'}
                              </label>
                              <AIFieldEnhancer
                                fieldKey="n-rationale-note"
                                sectionLabel="Consequences of Inaction"
                                currentValue={rationale}
                                onApply={setRationale}
                                artifactContext={{ title, status, priority, type: 'decision' }}
                                disabled={isDecisionStageLocked}
                              />
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
                                    <tr className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-navy-700/50">
                                      <th className="text-left py-2 pr-2">
                                        {isPolish ? 'Osoba' : 'Person'}
                                      </th>
                                      <th className="text-left py-2 pr-2">
                                        {isPolish ? 'Rola' : 'Role'}
                                      </th>
                                      <th className="text-left py-2 pr-2">
                                        {isPolish ? 'Email' : 'Email'}
                                      </th>
                                      <th className="text-left py-2 pr-2">
                                        {isPolish ? 'Notyfikacje' : 'Notifications'}
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
                                          className="py-6 text-center text-xs text-slate-500 dark:text-slate-400"
                                        >
                                          {isPolish
                                            ? 'Brak interesariuszy.'
                                            : 'No stakeholders yet.'}
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
                                              {stakeholderChannelLabels(s.notificationSettings).map(
                                                (label) => (
                                                  <span
                                                    key={`${s.id}-${label}`}
                                                    className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-navy-700/60 bg-slate-50/50 dark:bg-navy-800/50 text-[10px] text-slate-500 dark:text-slate-400"
                                                  >
                                                    {label}
                                                  </span>
                                                )
                                              )}
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
                                                className="p-1 text-slate-500 dark:text-slate-400 hover:text-primary-500 disabled:opacity-40"
                                                title={isPolish ? 'Edytuj' : 'Edit'}
                                              >
                                                <Edit3 size={13} />
                                              </button>
                                              <button
                                                disabled={isDecisionStageLocked}
                                                onClick={() =>
                                                  setStakeholders(
                                                    stakeholders.filter((item) => item.id !== s.id)
                                                  )
                                                }
                                                className="p-1 text-slate-500 dark:text-slate-400 hover:text-red-500 disabled:opacity-40"
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
                                        delivery: ensureDeliveryConfig({
                                          coreChannels: ['in_app'],
                                        }),
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
                                    <tr className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-navy-700/50">
                                      <th className="text-left py-2 pr-2">
                                        {isPolish ? 'Typ' : 'Type'}
                                      </th>
                                      <th className="text-left py-2 pr-2">
                                        {isPolish ? 'Dni' : 'Days'}
                                      </th>
                                      <th className="text-left py-2 pr-2">
                                        {isPolish ? 'Do kogo' : 'Recipients'}
                                      </th>
                                      <th className="text-left py-2 pr-2">
                                        {isPolish ? 'Notyfikacje' : 'Notifications'}
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
                                          colSpan={5}
                                          className="py-6 text-center text-xs text-slate-500 dark:text-slate-400"
                                        >
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
                                                <span className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-navy-700/60 bg-slate-50/50 dark:bg-navy-800/50 text-[10px] text-slate-500 dark:text-slate-400">
                                                  {isPolish ? 'Wyłączone' : 'Disabled'}
                                                </span>
                                              )}
                                              {deliveryBadgeLabels(r.delivery, r).map((label) => (
                                                <span
                                                  key={`${r.id}-${label}`}
                                                  className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-navy-700/60 bg-slate-50/50 dark:bg-navy-800/50 text-[10px] text-slate-500 dark:text-slate-400"
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
                                                className="p-1 text-slate-500 dark:text-slate-400 hover:text-primary-500 disabled:opacity-40"
                                                title={isPolish ? 'Edytuj' : 'Edit'}
                                              >
                                                <Edit3 size={13} />
                                              </button>
                                              <button
                                                disabled={isDecisionStageLocked}
                                                onClick={() =>
                                                  setReminders(
                                                    reminders.filter((item) => item.id !== r.id)
                                                  )
                                                }
                                                className="p-1 text-slate-500 dark:text-slate-400 hover:text-red-500 disabled:opacity-40"
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
                                          delivery: ensureDeliveryConfig({
                                            coreChannels: ['in_app', 'email'],
                                          }),
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
                                    <tr className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-navy-700/50">
                                      <th className="text-left py-2 pr-2">
                                        {isPolish ? 'Status' : 'Status'}
                                      </th>
                                      <th className="text-left py-2 pr-2">
                                        {isPolish ? 'Progi W/C' : 'W/C thresholds'}
                                      </th>
                                      <th className="text-left py-2 pr-2">
                                        {isPolish ? 'Eskaluj po' : 'Escalate after'}
                                      </th>
                                      <th className="text-left py-2 pr-2">
                                        {isPolish ? 'Eskaluj do' : 'Escalate to'}
                                      </th>
                                      <th className="text-left py-2 pr-2">
                                        {isPolish ? 'Komunikat' : 'Message'}
                                      </th>
                                      <th className="text-left py-2 pr-2">
                                        {isPolish ? 'Tryb' : 'Mode'}
                                      </th>
                                      <th className="text-left py-2 pr-2">
                                        {isPolish ? 'Kanały' : 'Channels'}
                                      </th>
                                      <th className="text-right py-2">
                                        {isPolish ? 'Akcje' : 'Actions'}
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-200/40 dark:divide-navy-700/40">
                                    {escalationRules.length === 0 ? (
                                      <tr>
                                        <td
                                          colSpan={8}
                                          className="py-6 text-center text-xs text-slate-500 dark:text-slate-400"
                                        >
                                          {isPolish
                                            ? 'Brak reguł eskalacji.'
                                            : 'No escalation rules yet.'}
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
                                                  className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-navy-700/60 bg-slate-50/50 dark:bg-navy-800/50 text-[10px] text-slate-500 dark:text-slate-400"
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
                                                className="p-1 text-slate-500 dark:text-slate-400 hover:text-primary-500 disabled:opacity-40"
                                                title={isPolish ? 'Edytuj' : 'Edit'}
                                              >
                                                <Edit3 size={13} />
                                              </button>
                                              <button
                                                disabled={isDecisionStageLocked}
                                                onClick={() =>
                                                  setEscalationRules(
                                                    escalationRules.filter(
                                                      (item) => item.id !== rule.id
                                                    )
                                                  )
                                                }
                                                className="p-1 text-slate-500 dark:text-slate-400 hover:text-red-500 disabled:opacity-40"
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
                                      className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-600"
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
                                    <div className="rounded-xl border border-slate-200 dark:border-navy-700/60 bg-slate-50/70 dark:bg-navy-800/50 p-3 space-y-2">
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
                                                  enabled:
                                                    !stakeholderDraft.notificationSettings.enabled,
                                                },
                                              }),
                                          },
                                          {
                                            key: 'in_app',
                                            label: 'In-app',
                                            active:
                                              stakeholderDraft.notificationSettings.inAppEnabled,
                                            toggle: () =>
                                              setStakeholderDraft({
                                                ...stakeholderDraft,
                                                notificationSettings: {
                                                  ...stakeholderDraft.notificationSettings,
                                                  inAppEnabled:
                                                    !stakeholderDraft.notificationSettings
                                                      .inAppEnabled,
                                                },
                                              }),
                                          },
                                          {
                                            key: 'email',
                                            label: 'Email',
                                            active:
                                              stakeholderDraft.notificationSettings.emailEnabled,
                                            toggle: () =>
                                              setStakeholderDraft({
                                                ...stakeholderDraft,
                                                notificationSettings: {
                                                  ...stakeholderDraft.notificationSettings,
                                                  emailEnabled:
                                                    !stakeholderDraft.notificationSettings
                                                      .emailEnabled,
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
                                    <div className="rounded-xl border border-slate-200 dark:border-navy-700/60 bg-slate-50/70 dark:bg-navy-800/50 p-3 space-y-2">
                                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                        {isPolish ? 'Kanały integracyjne' : 'Integration channels'}
                                      </div>
                                      <div className="flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
                                        {integrationChannelCatalog.map((channel) => {
                                          const list =
                                            stakeholderDraft.notificationSettings
                                              .integrationChannels || [];
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
                                      value={(
                                        stakeholderDraft.notificationSettings.syncTargets || []
                                      ).join(', ')}
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
                                          {
                                            ...stakeholderDraft,
                                            id: Math.random().toString(36).slice(2, 11),
                                          },
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
                                      className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-600"
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
                                        setReminderDraft({
                                          ...reminderDraft,
                                          enabled: e.target.checked,
                                        })
                                      }
                                    />
                                    {isPolish ? 'Reguła aktywna' : 'Rule enabled'}
                                  </label>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="rounded-xl border border-slate-200 dark:border-navy-700/60 bg-slate-50/70 dark:bg-navy-800/50 p-3 space-y-2">
                                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                        {isPolish ? 'Kanały podstawowe' : 'Core channels'}
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        {(
                                          [
                                            { key: 'in_app', label: 'In-app' },
                                            { key: 'email', label: 'Email' },
                                          ] as Array<{ key: CoreDeliveryChannel; label: string }>
                                        ).map((channel) => {
                                          const delivery = ensureDeliveryConfig(
                                            reminderDraft.delivery,
                                            reminderDraft
                                          );
                                          const enabled = delivery.coreChannels.includes(
                                            channel.key
                                          );
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
                                    <div className="rounded-xl border border-slate-200 dark:border-navy-700/60 bg-slate-50/70 dark:bg-navy-800/50 p-3 space-y-2">
                                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                        {isPolish ? 'Kanały integracyjne' : 'Integration channels'}
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        {integrationChannelCatalog.map((channel) => {
                                          const delivery = ensureDeliveryConfig(
                                            reminderDraft.delivery,
                                            reminderDraft
                                          );
                                          const enabled = delivery.integrationChannels.includes(
                                            channel.key
                                          );
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
                                      value={ensureDeliveryConfig(
                                        reminderDraft.delivery,
                                        reminderDraft
                                      ).syncTargets.join(', ')}
                                      onChange={(e) =>
                                        setReminderDraft({
                                          ...reminderDraft,
                                          delivery: {
                                            ...ensureDeliveryConfig(
                                              reminderDraft.delivery,
                                              reminderDraft
                                            ),
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
                                      setReminderDraft({
                                        ...reminderDraft,
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
                                      className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-600"
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
                                    {isPolish
                                      ? 'Próg ostrzeżenia (dni)'
                                      : 'Warning threshold (days)'}
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
                                    {isPolish
                                      ? 'Próg krytyczny (dni)'
                                      : 'Critical threshold (days)'}
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
                                  <div className="rounded-xl border border-slate-200 dark:border-navy-700/60 bg-slate-50/70 dark:bg-navy-800/50 p-3 space-y-2">
                                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                      {isPolish ? 'Kanały podstawowe' : 'Core channels'}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {(
                                        [
                                          { key: 'in_app', label: 'In-app' },
                                          { key: 'email', label: 'Email' },
                                        ] as Array<{ key: CoreDeliveryChannel; label: string }>
                                      ).map((channel) => {
                                        const delivery = ensureDeliveryConfig(
                                          escalationDraft.delivery
                                        );
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
                                  <div className="rounded-xl border border-slate-200 dark:border-navy-700/60 bg-slate-50/70 dark:bg-navy-800/50 p-3 space-y-2">
                                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                      {isPolish ? 'Kanały integracyjne' : 'Integration channels'}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {integrationChannelCatalog.map((channel) => {
                                        const delivery = ensureDeliveryConfig(
                                          escalationDraft.delivery
                                        );
                                        const enabled = delivery.integrationChannels.includes(
                                          channel.key
                                        );
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
                                    value={ensureDeliveryConfig(
                                      escalationDraft.delivery
                                    ).syncTargets.join(', ')}
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

                      {/* ── Section: Comments (shared CommentsCanvas) ──── */}
                      {activeNotionSection === 'comments' && (
                        <CommentsCanvas
                          comments={nModeComments}
                          onDeleteComment={handleDeleteComment}
                          dateFilter={commentDateFilter as DateFilter}
                          onDateFilterChange={(f) => setCommentDateFilter(f as CommentDateFilter)}
                          sortOrder={commentSortOrder as SortOrder}
                          onToggleSort={() =>
                            setCommentSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
                          }
                          commentDraft={commentDraft}
                          onCommentDraftChange={setCommentDraft}
                          onSubmitComment={() => void submitCommentDraft()}
                          draftPriority={commentDraftPriority as CommentPriority}
                          onDraftPriorityChange={(p) =>
                            setCommentDraftPriority(p as CommentPriorityLevel)
                          }
                          onAIEnhance={enhanceCommentDraftWithAI}
                          isAIEnhancing={isEnhancingCommentDraft}
                          locked={isDecisionStageLocked}
                          getPriorityDotClass={(p) =>
                            getPriorityDotClass(p as CommentPriorityLevel)
                          }
                          getCommentPriority={(c) =>
                            getCommentPriority(c as unknown as Comment) as CommentPriority
                          }
                          getPriorityButtonClass={(p, a) =>
                            getPriorityButtonClass(p as CommentPriorityLevel, a)
                          }
                          getCommentPriorityLabel={(p) =>
                            getCommentPriorityLabel(p as CommentPriorityLevel)
                          }
                          getCommentPriorityHint={(p) =>
                            getCommentPriorityHint(p as CommentPriorityLevel)
                          }
                        />
                      )}

                      {/* ── Section: Attachments & Links ─────────────────── */}
                      {activeNotionSection === 'resources-links' && (
                        <AttachmentsLinksCanvas
                          attachments={attachments}
                          onUploadAttachments={handleUploadAttachments}
                          onDeleteAttachment={handleDeleteAttachment}
                          onEditAttachment={(id, patch) => {
                            setAttachments((prev) =>
                              prev.map((a) => (a.id === id ? { ...a, ...patch } : a))
                            );
                          }}
                          linkedItems={linkedItems}
                          onAddLinkedItem={handleAddLinkedItem}
                          onRemoveLinkedItem={handleRemoveLinkedItem}
                          onEditLinkedItem={(key, patch) => {
                            const [type, id] = key.split(':');
                            setLinkedItems((prev) =>
                              prev.map((item) =>
                                item.type === type && item.id === id ? { ...item, ...patch } : item
                              )
                            );
                          }}
                          onNavigateLinkedItem={openLinkedItemTarget}
                          searchLinkedItems={searchLinkedItems}
                          readOnly={isDecisionStageLocked}
                        />
                      )}

                      {/* ── Section: Activity Log (shared ActivityLogCanvas) */}
                      {activeNotionSection === 'activity-log' && (
                        <ActivityLogCanvas
                          entries={nModeActivityEntries}
                          stats={nModeActivityStats}
                          typeMeta={nModeActivityTypeMeta}
                        />
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════ CLICKUP MODE (action-first) ═════════════════════════ */}
          {presentationMode === 'c' && import.meta.env.VITE_ENABLE_LEGACY_C_MODE === 'true' && (
            <div className="col-span-full space-y-4">
              <div className="flex flex-wrap items-center gap-2 p-2 rounded-xl bg-white/60 dark:bg-navy-900/60 border border-slate-200 dark:border-navy-700/60">
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
                    <div className="bg-white/70 dark:bg-navy-900/70 rounded-2xl border border-slate-200 dark:border-navy-700/60 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                          {isPolish ? 'Przegląd decyzji' : 'Decision Overview'}
                        </h3>
                        <AIFieldEnhancer
                          fieldKey="c-description"
                          sectionLabel="Decision Overview"
                          currentValue={description}
                          onApply={setDescription}
                          artifactContext={{ title, status, priority, type: 'decision' }}
                          disabled={isDecisionStageLocked}
                        />
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
                        <AIFieldEnhancer
                          fieldKey="c-rationale"
                          sectionLabel="Consequences of Inaction"
                          currentValue={rationale}
                          onApply={setRationale}
                          artifactContext={{ title, status, priority, type: 'decision' }}
                          disabled={isDecisionStageLocked}
                        />
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
                      <div className="bg-white/70 dark:bg-navy-900/70 rounded-2xl border border-slate-200 dark:border-navy-700/60 p-4 space-y-3">
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
                              <tr className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-navy-700/50">
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
                                    className="py-6 text-center text-xs text-slate-500 dark:text-slate-400"
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
                                        {stakeholderChannelLabels(s.notificationSettings).map(
                                          (label) => (
                                            <span
                                              key={`${s.id}-clickup-${label}`}
                                              className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-navy-700/60 bg-slate-50/50 dark:bg-navy-800/50 text-[10px]"
                                            >
                                              {label}
                                            </span>
                                          )
                                        )}
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
                                        className="p-1 text-slate-500 dark:text-slate-400 hover:text-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
                      <div className="bg-white/70 dark:bg-navy-900/70 rounded-2xl border border-slate-200 dark:border-navy-700/60 p-4 space-y-3">
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
                              <tr className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-navy-700/50">
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
                                    className="py-6 text-center text-xs text-slate-500 dark:text-slate-400"
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
                                        className="p-1 text-slate-500 dark:text-slate-400 hover:text-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
                      <div className="bg-white/70 dark:bg-navy-900/70 rounded-2xl border border-slate-200 dark:border-navy-700/60 p-4 space-y-3">
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
                              <tr className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-navy-700/50">
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
                                    className="py-6 text-center text-xs text-slate-500 dark:text-slate-400"
                                  >
                                    {isPolish ? 'Brak reguły eskalacji.' : 'No escalation rule.'}
                                  </td>
                                </tr>
                              ) : (
                                <tr className="border-b border-slate-200 dark:border-navy-700/40">
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
                      <div className="bg-white/70 dark:bg-navy-900/70 rounded-2xl border border-slate-200 dark:border-navy-700/60 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                            {isPolish ? 'Załączniki' : 'Attachments'}
                          </h3>
                          <label
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                              isDecisionStageLocked
                                ? 'border-slate-300/40 dark:border-navy-700 text-slate-500 dark:text-slate-400 dark:text-slate-500 cursor-not-allowed'
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
                              <tr className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-navy-700/50">
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
                                    className="py-6 text-center text-xs text-slate-500 dark:text-slate-400"
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
                                        className="p-1 text-slate-500 dark:text-slate-400 hover:text-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
                      <div className="bg-white/70 dark:bg-navy-900/70 rounded-2xl border border-slate-200 dark:border-navy-700/60 p-4 space-y-3">
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
                              <tr className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-navy-700/50">
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
                                    className="py-6 text-center text-xs text-slate-500 dark:text-slate-400"
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
                                        className="p-1 text-slate-500 dark:text-slate-400 hover:text-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
                    <div className="bg-white/70 dark:bg-navy-900/70 rounded-2xl border border-slate-200 dark:border-navy-700/60 p-4 space-y-3">
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

                  <div className="bg-white/80 dark:bg-navy-900/80 rounded-2xl border border-slate-200 dark:border-navy-700/60 p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {isPolish ? 'Panel informacji' : 'Information pane'}
                    </h3>
                    <div className="space-y-2.5 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500 dark:text-slate-400 dark:text-slate-500 text-xs uppercase tracking-wide">
                          {isPolish ? 'Status' : 'Status'}
                        </span>
                        <span className="text-slate-700 dark:text-slate-200 font-medium">
                          {isPolish
                            ? STATUS_CONFIG[status].label.pl
                            : STATUS_CONFIG[status].label.en}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500 dark:text-slate-400 dark:text-slate-500 text-xs uppercase tracking-wide">
                          {isPolish ? 'Priorytet' : 'Priority'}
                        </span>
                        <span className="text-slate-700 dark:text-slate-200 font-medium">
                          {isPolish
                            ? PRIORITY_CONFIG[priority].label.pl
                            : PRIORITY_CONFIG[priority].label.en}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500 dark:text-slate-400 dark:text-slate-500 text-xs uppercase tracking-wide">
                          {isPolish ? 'Termin' : 'Deadline'}
                        </span>
                        <span className="text-slate-700 dark:text-slate-200">{dueDate || '—'}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500 dark:text-slate-400 dark:text-slate-500 text-xs uppercase tracking-wide">
                          {isPolish ? 'Wnioskodawca' : 'Requester'}
                        </span>
                        <span className="text-slate-700 dark:text-slate-200 text-right truncate">
                          {requesterName || '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500 dark:text-slate-400 dark:text-slate-500 text-xs uppercase tracking-wide">
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
                        <span className="text-slate-500 dark:text-slate-400 dark:text-slate-500 text-xs uppercase tracking-wide">
                          {isPolish ? 'Dotyczy' : 'Related to'}
                        </span>
                        <span className="text-slate-700 dark:text-slate-200 text-right max-w-[65%] break-words">
                          {decisionScopeLabel}
                        </span>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-slate-500 dark:text-slate-400 dark:text-slate-500 text-xs uppercase tracking-wide">
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
