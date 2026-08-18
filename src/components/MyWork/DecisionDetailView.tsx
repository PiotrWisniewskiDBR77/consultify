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
  BookOpen,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
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
  Link2,
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
  Target,
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
import { SkeletonState } from '@/components/shared/states';
import { ArtifactApprovalStatusBar } from '@/components/standard/ArtifactApprovalStatusBar';
import { ArtifactPropertiesTable } from '@/components/standard/ArtifactPropertiesTable';
import {
  ARTIFACT_PANEL_CARD_CLASS_STICKY,
  ArtifactRightPanel,
  type ArtifactRightPanelSection,
} from '@/components/standard/ArtifactRightPanel';
import { EvidencePanelSection } from '@/components/standard/EvidencePanelSection';
import { LoadingState } from '@/components/ui/primitives';
import { type SmartOpenConditions, useAccordionSections } from '@/hooks/useAccordionSections';
import {
  type CloudFile,
  type CloudProviderId,
  useCloudIntegrations,
} from '@/hooks/useCloudIntegrations';
import { useDemoSession } from '@/hooks/useDemoSession';
import { useOpenChatWithContext } from '@/hooks/useOpenChatWithContext';
import { usePresentationMode } from '@/hooks/usePresentationMode';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { ROUTES } from '@/routes/routeConfig';
// ETAP 3 standardu n-Type — „Analizuj z AI" (silnik + panel wyników).
import type { CardAnalysisChange, CardAnalysisField } from '@/services/cardAnalysis';
import { mergeChangeValue } from '@/services/cardAnalysis';
import { useAppStore } from '@/store/useAppStore';
import { useConversationStore } from '@/store/useConversationStore';
import { AppView } from '@/types';
import { isArtifactApprovalUiEnabled } from '@/utils/artifactApprovalUiFlag';
import { buildArtifactCode } from '@/utils/artifactLinks';

import { Api } from '../../services/api';
import { CloudFilePicker } from '../AIChat/CloudFilePicker';
import { AIFieldEnhancer } from '../shared/AIFieldEnhancer';
import { ArtifactPermalinkButton } from '../shared/ArtifactPermalinkButton';
// n-Type §6.2/§6.3: standardowe opisowe pole tekstowe (auto-fit + uchwyt +
// pamięć ręcznej wysokości + tryb Podgląd). Jedna droga budowy pola karty.
import { AutoFitTextarea } from '../shared/AutoFitTextarea';
import { CapabilityGate } from '../shared/CapabilityGate';
import { RequiredProjectPicker } from '../shared/RequiredProjectPicker';
import { NCardAIAnalysisPanel } from '../shared/NModeLayout/NCardAIAnalysisPanel';
// #52 — card-management primitive (show/hide + reorder), same "nakładka"
// wiring as InsightViewer.tsx / TaskDetailView.tsx (see `decisionCardLayout`).
// ETAP 1.2: menu 2 niesie SAM picker „Sekcje" — „+ Nowa karta" zdjęte.
import { SectionsManagerMenu } from '../shared/NModeLayout/NModeCardManager';
import { NModeCardState, type NModeCardStatus } from '../shared/NModeLayout/NModeCardState';
import { NModeHeader } from '../shared/NModeLayout/NModeHeader';
import { NModeLeftNav } from '../shared/NModeLayout/NModeLeftNav';
import { Menu2AIButton, NModeMenu2 } from '../shared/NModeLayout/NModeMenu2';
// SPEC-N §2.4: jedyna dozwolona droga budowy toolbara karty.
import { NModeToolbar, type NModeToolbarAction } from '../shared/NModeLayout/NModeToolbar';
import type { NModeSection } from '../shared/NModeLayout/types';
import { useCardAIAnalysis } from '../shared/NModeLayout/useCardAIAnalysis';
import { type CardLayout, useCardLayout } from '../shared/NModeLayout/useCardLayout';
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
// POC (D-8): kompozycja kart Decision wyprowadzona z WIĄŻĄCEGO kontraktu karty
// (cardContract.types.ts) zamiast z luźnego DECISION_SPEC — patrz decisionCardContract.ts.
import { DECISION_CARD_RENDER_IDS, DECISION_CARD_SPEC } from './decisionCardContract';
import { NotebookMetadataBadges } from './notebook/NotebookMetadataBadges';
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
  type ReminderRule,
  RiskAssessmentCompact,
  type RiskItem,
  type Stakeholder,
  type StakeholderNotificationSettings,
  type StakeholderRole,
  StakeholdersSection,
  type WarningThresholds,
} from './shared';
import { AIConnections } from './shared/AIConnections';
import { buildAskAIMessage } from './shared/askAiHelper';
import { PostDecisionFollowUp } from './shared/PostDecisionFollowUp';
import { RelatedContext } from './shared/RelatedContext';
// Wspólny wzór listy powiązań (Decyzja „Dotyczy" = Zadanie „Wynika z").
// Import wprost z pliku, nie przez `./shared/index.ts` — barrel jest dziś
// równolegle edytowany przez inne fronty.
import { RelatedItemsList } from './shared/RelatedItemsList';

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

export const aggregateDecisionImpact = (
  impact: Pick<ImpactValues, 'scope' | 'schedule' | 'cost' | 'quality'>
): 'low' | 'medium' | 'high' => {
  const levels = [impact.scope, impact.schedule, impact.cost, impact.quality];
  if (levels.includes('high')) return 'high';
  if (levels.includes('medium')) return 'medium';
  return 'low';
};

// VF1-4 (SPEC-A wzorzec, wg VF1-1 Task): gate for the visible loading-guard
// swap (ad-hoc spinner → shared/states SkeletonState, record archetype).
// Default OFF until Piotr accepts on screenshots (reguła #7).
// See docs/ui-standards/TRIADA_KANON.md + ARTIFACT_ANATOMY_STANDARD.md §18.1.
const VF1_DECISION_SPECA = import.meta.env.VITE_VF1_DECISION_SPECA === 'true';

// POC — kompozycja kart Decision przez WIĄŻĄCY kontrakt karty (D-8, KONTRAKT §9).
// Default OFF (zero regresji na demo); w dev/harnessie włącza URL `?cardContract=1`
// (Piotr nie jest pierwszym testerem wizualnym — reguła #7; ja renderuję zrzut sam).
function useDecisionCardContractEnabled(): boolean {
  return useMemo(() => {
    if (import.meta.env.VITE_VF1_DECISION_CARD_CONTRACT === 'true') return true;
    if (import.meta.env.DEV && typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('cardContract') === '1';
    }
    return false;
  }, []);
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
type DecisionWorkflowStage = 'proposed' | 'review' | 'approve' | 'published';

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
    color: 'bg-c-text-muted',
    textColor: 'text-c-text-muted',
  },
  approved: {
    label: { en: 'Approved', pl: 'Zatwierdzona' },
    color: 'bg-c-success',
    textColor: 'text-c-success',
  },
  rejected: {
    label: { en: 'Rejected', pl: 'Odrzucona' },
    color: 'bg-c-danger',
    textColor: 'text-c-danger',
  },
  deferred: {
    label: { en: 'Deferred', pl: 'Odroczona' },
    color: 'bg-c-text-muted',
    textColor: 'text-c-text-muted',
  },
  escalated: {
    label: { en: 'Escalated', pl: 'Eskalowana' },
    color: 'bg-c-info',
    textColor: 'text-c-info',
  },
};

// D-B (2026-07-22): domain status → Menu 1 status-pill tone (NModeHeader
// statusTone, tokeny c-*). Zastępuje nagą kropkę `statusDotColor`. Stany robocze
// (oczekująca/eskalowana) = 'review' (c-info); odroczona = 'neutral'; werdykty
// finalne mapują na 'approved'/'rejected'. Etykieta tekstowa bierze się z
// STATUS_CONFIG[status].label (już zlokalizowana pl/en) — brak surowych kluczy.
const STATUS_TONE: Record<
  keyof typeof STATUS_CONFIG,
  'draft' | 'review' | 'approved' | 'rejected' | 'neutral'
> = {
  pending: 'review',
  approved: 'approved',
  rejected: 'rejected',
  deferred: 'neutral',
  escalated: 'review',
};

const PRIORITY_CONFIG = {
  low: {
    label: { en: 'Low', pl: 'Niski' },
    color: 'bg-c-text-muted',
    textColor: 'text-c-text-muted',
  },
  medium: {
    label: { en: 'Medium', pl: 'Średni' },
    color: 'bg-c-info',
    textColor: 'text-c-info',
  },
  high: {
    label: { en: 'High', pl: 'Wysoki' },
    color: 'bg-c-warning',
    textColor: 'text-c-warning',
  },
  critical: {
    label: { en: 'Critical', pl: 'Krytyczny' },
    color: 'bg-c-danger',
    textColor: 'text-c-danger',
  },
};

const WORKFLOW_STATUS_CONFIG: Record<
  DecisionWorkflowStage,
  { label: { en: string; pl: string }; badgeClass: string }
> = {
  proposed: {
    label: { en: 'Proposed', pl: 'Propozycja' },
    badgeClass:
      'bg-c-text-secondary/10 text-c-text-secondary border border-c-border/70 dark:border-c-border-subtle/60',
  },
  review: {
    label: { en: 'In review', pl: 'W przeglądzie' },
    badgeClass:
      'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200/70 dark:border-amber-900/40',
  },
  approve: {
    label: { en: 'Approved for publish', pl: 'Gotowa do publikacji' },
    badgeClass:
      'bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200/70 dark:border-blue-900/40',
  },
  published: {
    label: { en: 'Published', pl: 'Opublikowana' },
    badgeClass:
      'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-900/40',
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
  high: { label: { en: 'High', pl: 'Wysoki' }, color: 'bg-danger-500', emoji: '🔴' },
};

// English defaults for risk category labels — the actual rendered text is resolved
// via t(`decisions.detail.riskCategory.${key}`, RISK_CATEGORY_EN_LABELS[key]) so the
// fallback source stays statically analyzable for the i18n bare-missing gate.
const RISK_CATEGORY_EN_LABELS: Record<string, string> = {
  technical: 'Technical',
  business: 'Business',
  financial: 'Financial',
  operational: 'Operational',
  security: 'Security',
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

// ── Decision section AI helpers (wzorzec N: POST /decisions/:id/generate-section) ──
// The endpoint (DecisionController.generateSection → decisionService.generateSection)
// returns { sectionKey, content, isJson, parsedContent, model, tokensUsed }. When no
// LLM provider is configured the service degrades honestly: model === 'placeholder'
// and content is a bracketed "[…]" notice. We treat that as a soft failure so the
// card lands on `error` (retry available) instead of persisting a placeholder draft.
/**
 * Typy powiązań, na których decyzja się OPIERA (wiedza wejściowa), a nie
 * takie, które z niej wynikają lub jej towarzyszą. Sterują rozdziałem między
 * sekcją „Powiązania" (③) a „Źródła i założenia" (④) w prawym panelu — n-Type
 * §6.2. Bez tego rozdziału ten sam rekord stałby w obu sekcjach.
 */
const DECISION_SOURCE_LINK_TYPES = new Set([
  'insight',
  'report',
  'assessment',
  'notebook',
  'note',
  'document',
  'interview',
  'session',
]);

const isDecisionSectionPlaceholder = (res: any): boolean =>
  String(res?.model || '') === 'placeholder' || /^\s*\[.*\]\s*$/.test(String(res?.content || ''));

const extractDecisionSectionContent = (res: any): string => {
  if (isDecisionSectionPlaceholder(res)) {
    throw new Error('AI provider unavailable (placeholder response)');
  }
  const content = String(res?.content || '').trim();
  if (!content) {
    throw new Error('Empty AI section content');
  }
  return content;
};

const extractDecisionSectionJson = (res: any): any => {
  if (isDecisionSectionPlaceholder(res)) {
    throw new Error('AI provider unavailable (placeholder response)');
  }
  if (res?.parsedContent && typeof res.parsedContent === 'object') {
    return res.parsedContent;
  }
  // Fallback: parse the raw content (fenced or bare JSON) if the server did not.
  const raw = String(res?.content || '');
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidate = fenced ? fenced[1] : raw;
  return JSON.parse(candidate);
};

const normalizeRiskLevel = (v: any): 'low' | 'medium' | 'high' | 'critical' => {
  const s = String(v || '').toLowerCase();
  return s === 'critical' || s === 'high' || s === 'medium' || s === 'low'
    ? (s as 'low' | 'medium' | 'high' | 'critical')
    : 'medium';
};

const normalizeRiskCategory = (
  v: any
): 'technical' | 'business' | 'operational' | 'financial' | 'legal' | 'other' => {
  const s = String(v || '').toLowerCase();
  // Backend enum: scope|schedule|cost|quality|business|operational.
  // FE enum: technical|business|operational|financial|legal|other.
  const map: Record<
    string,
    'technical' | 'business' | 'operational' | 'financial' | 'legal' | 'other'
  > = {
    scope: 'operational',
    schedule: 'operational',
    cost: 'financial',
    quality: 'technical',
    business: 'business',
    operational: 'operational',
    technical: 'technical',
    financial: 'financial',
    legal: 'legal',
    other: 'other',
  };
  return map[s] || 'other';
};

export const DecisionDetailView: React.FC<DecisionDetailViewProps> = ({
  decisionId,
  onClose,
  onSaved,
}) => {
  const { i18n, t } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const { isDemo } = useDemoSession();
  const {
    isChatCollapsed,
    toggleChatCollapse,
    setChatKickoffMessage,
    currentProjectId,
    emitMyWorkEvent,
    currentUser,
  } = useAppStore();
  const { updateWorkspaceFromView } = useConversationStore();
  const openChatWithContext = useOpenChatWithContext();
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
  const [showFollowUp, setShowFollowUp] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [decisionProjectId, setDecisionProjectId] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<keyof typeof STATUS_CONFIG>('pending');
  const [workflowStatus, setWorkflowStatus] = useState<DecisionWorkflowStage>('proposed');
  const [workflowActionLoading, setWorkflowActionLoading] = useState(false);
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

  // ── N-card state per content section (wzorzec N §3.2) ──────────────────────
  // Tracks the AI-draft / edited / done lifecycle for the 4 main content cards
  // (Description · Alternatives · Risk/Impact · Consequences of Inaction). Empty
  // by default; a successful AI generation flips the card to `ai-draft`, a manual
  // edit → `edited`, and the Accept action → `done`.
  type DecisionCardKey = 'description' | 'alternatives' | 'risk' | 'consequences';
  const [cardStates, setCardStates] = useState<Record<DecisionCardKey, NModeCardStatus>>({
    description: 'empty',
    alternatives: 'empty',
    risk: 'empty',
    consequences: 'empty',
  });
  const setCardState = useCallback((key: DecisionCardKey, next: NModeCardStatus) => {
    setCardStates((prev) => (prev[key] === next ? prev : { ...prev, [key]: next }));
  }, []);
  // ── Read/Edit toggle (Menu 1, klasa S) ─────────────────────────────────────
  // "Do pokazania klientowi": read = wszystkie karty/pola read-only, brak pasków
  // akcji (hideActions). ORuje się do isDecisionStageLocked (patrz niżej), więc
  // przewleka się przez WSZYSTKIE istniejące bramki edycji jednym stanem.
  // Z31/#31 (parytet #37): karta otwiera się DOMYŚLNIE na READ gdy już istnieje
  // (decisionId). Wyjątek: świeżo tworzona decyzja (brak decisionId — jeszcze
  // nie zapisana, z definicji pusta) → EDIT od razu. Drugi wyjątek (decyzja
  // właśnie utworzona i pusta, wiek < 2 min) — patrz loadDecision.
  const [readMode, setReadMode] = useState<boolean>(() => Boolean(decisionId));
  // Init: nowa decyzja (brak decisionId) → EDIT od razu. Istniejąca startuje na
  // READ, a `loadDecision` koryguje wg reguły stanu D-A (2026-07-22): stan roboczy
  // → Edycja, werdykt finalny (zatwierdzona/odrzucona) → Podgląd.
  // Human edit on a card demotes an AI-draft/done card to `edited` (badge switch).
  const markCardEdited = useCallback((key: DecisionCardKey) => {
    setCardStates((prev) =>
      prev[key] === 'ai-draft' || prev[key] === 'done' ? { ...prev, [key]: 'edited' } : prev
    );
  }, []);

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

  // Origin tracking
  const [sourceType, setSourceType] = useState<string | null>(null);
  const [sourceId, setSourceId] = useState<string | null>(null);

  // Tags
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');

  // Related Notes (notebook pages mentioning decision title)
  const [relatedNotes, setRelatedNotes] = useState<
    {
      id: string;
      title: string;
      captureSource?: string | null;
      captureMetadata?: { fileOriginalname?: string | null; fileMimetype?: string | null } | null;
      convertedTo?: Array<{ type?: string | null; id?: string | null }> | null;
    }[]
  >([]);
  const [relatedNotesExpanded, setRelatedNotesExpanded] = useState(true);

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
      description: t('decisions.detail.activityLog.decisionCreated', 'Decision created'),
      timestamp: new Date().toISOString(),
      userName: 'System',
    },
  ]);

  // Stakeholders & Delegation
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [showDelegationModal, setShowDelegationModal] = useState(false);

  // GRID ETAP 5 (2026-07-24) — SSOT §Wymagania/Decyzja: „ograniczyć liczbę
  // widocznych akcji w prawym panelu" + „jedna główna akcja, reszta w More".
  // Sekcja Akcje potrafi wystawić naraz do 6 przycisków (Zatwierdź decyzję +
  // 2 przejścia workflow + Odrzuć + Więcej info + Deleguj + Udostępnij) —
  // zwinięte domyślnie za tym przełącznikiem, poza primary/destructive.
  const [showMoreDecisionActions, setShowMoreDecisionActions] = useState(false);

  // ── Presentation Mode (N = Notion / C = ClickUp) ──────────────────────────
  const { mode: presentationMode, setMode: setPresentationMode } = usePresentationMode({
    entityType: 'decision',
    syncURL: true,
  });
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (presentationMode === 'c' && import.meta.env.VITE_ENABLE_LEGACY_C_MODE !== 'true') {
      setPresentationMode('n');
    }
  }, [presentationMode, setPresentationMode]);

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
  // `isDescriptionExpanded` / `isContextExpanded` usunięte 2026-07-23 — obsługiwały
  // parę „Pokaż więcej / Pokaż mniej" nad polem o stałej liczbie wierszy. Auto-fit
  // (n-Type §6.3) pokazuje całą treść bez tego przełącznika, więc stan osierocił
  // się w tym samym commicie, w którym zniknął jego jedyny konsument.
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
    'relative w-full max-w-2xl rounded-3xl border border-c-border-subtle/50 bg-c-surface/95 shadow-2xl p-6 space-y-5';
  const governanceTableCardClass =
    'bg-c-surface/70 rounded-2xl border border-c-border-subtle/60 p-4 space-y-3 h-[340px] flex flex-col';
  const governanceModalHintClass =
    'rounded-xl border border-c-border-subtle/60 bg-c-surface/70 dark:bg-c-surface-raised/50 px-3 py-2 text-xs text-c-text-secondary';
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
    { value: 'notify_only', label: t('decisions.detail.escalationMode.notifyOnly', 'Notify only') },
    {
      value: 'manager_review',
      label: t('decisions.detail.escalationMode.managerReview', 'Manager review'),
    },
    {
      value: 'executive_alert',
      label: t('decisions.detail.escalationMode.executiveAlert', 'Executive alert'),
    },
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
    if (labels.length === 0) labels.push(t('decisions.detail.channels.noChannels', 'No channels'));
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
    if (role === 'responsible') return t('decisions.detail.raci.responsible', 'Responsible');
    if (role === 'accountable') return t('decisions.detail.raci.accountable', 'Accountable');
    if (role === 'consulted') return t('decisions.detail.raci.consulted', 'Consulted');
    return t('decisions.detail.raci.informed', 'Informed');
  };
  const stakeholderChannelLabels = (settings?: StakeholderNotificationSettings) => {
    if (!settings?.enabled) return [t('decisions.detail.channels.disabled', 'Disabled')];
    const labels: string[] = [];
    if (settings.inAppEnabled) labels.push('In-app');
    if (settings.emailEnabled) labels.push('Email');
    const integrations = settings.integrationChannels || [];
    if (integrations.includes('slack')) labels.push('Slack');
    if (integrations.includes('teams')) labels.push('Teams');
    if (integrations.includes('jira')) labels.push('Jira');
    if (integrations.includes('webhook')) labels.push('Webhook');
    return labels.length > 0 ? labels : [t('decisions.detail.channels.noChannels', 'No channels')];
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
  //
  // SPEC-N §2.1 (zarezerwowane identyfikatory): `comments` · `history` ·
  // `activity-log` NIE MOGA byc sekcja lewej nawigacji — naleza wylacznie do
  // prawego panelu. Do 2026-07-21 Decision lamal to podwojnie: obie sekcje
  // byly w lewej nawigacji (pelny canvas) I JEDNOCZESNIE w prawym panelu
  // (skrocona lista 6/8 pozycji) — ten sam material renderowal sie dwa razy
  // naraz. Rozstrzygniecie SPEC-N §2.6 (jedna akcja/tresc = jedno miejsce):
  // zostaje to, co widoczne ZAWSZE, czyli prawy panel; sekcje znikaja z lewej
  // nawigacji, a PELNA tresc (CommentsCanvas / ActivityLogCanvas) przenosi sie
  // do panelu — patrz `rightPanelSections` nizej.
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
      {
        id: 'resources-links',
        label: { en: 'Attachments & Links', pl: 'Załączniki i powiązania' },
        icon: FolderOpen,
      },
    ],
    []
  );

  // ── Kontrakt AI per sekcja (SPEC-N §2.5) ──────────────────────────────────
  // Wymog: KAZDA sekcja deklaruje kontrakt AI albo jawne wykluczenie
  // `{none, reason}`. Milczenie przestaje byc dopuszczalne — do dzis Decision
  // deklarowal 4 z 8 sekcji, a RACI/Komentarze/Zalaczniki/Logi nie mowily nic.
  //
  // Decision renderuje centrum per-id (`activeNotionSection === '<id>'`), a nie
  // z tablicy `sections[]` jak Task/Insight, wiec kontrakt nie da sie tu wpiac
  // jako pole deklaracji sekcji. Ta mapa jest wiec jawnym, JEDNYM zrodlem:
  // czyta ja slot `aiSectionButton` w NModeToolbar nizej (wiec nie jest martwym
  // komentarzem — sekcja bez kontraktu po prostu nie dostaje przycisku AI).
  // Po przepieciu karty na `StandardArtifactShell` (osobna fala) mapa przechodzi
  // 1:1 w pole `aiContract` deklaracji sekcji.
  //
  // Zasieg = 8/8 pozycji: 6 sekcji lewej nawigacji + 2 sekcje prawego panelu
  // (`comments`, `history`), ktore po §2.1 przestaly byc sekcjami lewej nawigacji,
  // ale nadal sa sekcjami tej karty i podlegaja temu samemu wymogowi.
  const decisionAiContract: Record<
    string,
    | { kind: 'ai'; handler: 'options' | 'risk' | 'consequences' | 'raci' | 'comment' }
    | { kind: 'none'; reason: string }
  > = useMemo(
    () => ({
      // — sekcje z realnym kontraktem AI (NModeCardState w centrum) —
      'options-tradeoffs': { kind: 'ai', handler: 'options' },
      'risk-impact': { kind: 'ai', handler: 'risk' },
      consequences: { kind: 'ai', handler: 'consequences' },
      'governance-escalation': { kind: 'ai', handler: 'raci' },
      comments: { kind: 'ai', handler: 'comment' },
      // — jawne wykluczenia —
      // Zakres decyzji ma generacje opisu, ale prowadzi ja NModeCardState
      // wewnatrz sekcji (onRegenerate), nie przycisk toolbara — dublowanie
      // wejscia lamaloby §2.6.
      'context-problem': {
        kind: 'none',
        reason:
          'generacja prowadzona przez NModeCardState sekcji (onRegenerate), nie przez toolbar',
      },
      'resources-links': {
        kind: 'none',
        reason: 'pliki i powiazania wskazuje uzytkownik — AI nie ma czego wygenerowac',
      },
      history: {
        kind: 'none',
        reason: 'log zdarzen jest zapisem faktow, tresc generowana bylaby falszem',
      },
    }),
    []
  );

  // ── Card-management primitive (#52, wzorzec N §3.5) ───────────────────────
  // Same "nakładka" wiring as InsightViewer.tsx / TaskDetailView.tsx:
  // `useCardLayout` (DECISION_SPEC) drives show/hide + reorder OVER the
  // existing NModeLeftNav + single-active-section canvas (`activeNotionSection`
  // conditionals below) instead of replacing it. Decision's canvas renders
  // content per-id via direct `activeNotionSection === '<id>'` checks (no
  // `sections[]` array like Task/Insight), so only `notionSections` (the nav
  // list) needs to be filtered/ordered — the content blocks stay untouched.
  // POC (D-8): gdy włączony kontrakt, layout ma INNE znaczenie (węższy zestaw
  // domyślny), więc namespace klucza jest osobny — stary 8-kartowy layout nie
  // hydratuje się nad węższy domyślny, a wyłączenie flagi wraca do 'v1' bez utraty.
  const decisionCardContractEnabled = useDecisionCardContractEnabled();
  const decisionCardLayoutStorageKey = `decision:nmode:card-layout:${
    decisionCardContractEnabled ? 'v2-contract' : 'v1'
  }:${decisionId ?? 'new'}`;
  const initialDecisionCardLayout = useMemo<CardLayout | null>(() => {
    try {
      const raw = localStorage.getItem(decisionCardLayoutStorageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return null;
      const cleaned = parsed.filter(
        (c: unknown): c is { id: string; visible: boolean; order: number } =>
          !!c &&
          typeof (c as { id?: unknown }).id === 'string' &&
          typeof (c as { visible?: unknown }).visible === 'boolean' &&
          typeof (c as { order?: unknown }).order === 'number'
      );
      return cleaned.length > 0 ? cleaned : null;
    } catch {
      return null;
    }
    // Hydrate once per decision id; layout state is owned by the hook afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decisionCardLayoutStorageKey]);

  const persistDecisionCardLayout = useCallback(
    (next: CardLayout) => {
      try {
        localStorage.setItem(decisionCardLayoutStorageKey, JSON.stringify(next));
      } catch {
        // Ignore storage errors; card management still works for this session.
      }
    },
    [decisionCardLayoutStorageKey]
  );

  const decisionCardLayout = useCardLayout({
    artifactType: 'decision',
    // POC: gdy flaga ON, katalog + zestawy płyną z kontraktu kanonicznego
    // (DECISION_CARD_SPEC — stała moduł-const, stabilna referencja); gdy OFF,
    // `undefined` ⇒ useCardLayout czyta DEFAULT_CARD_SETS['decision'] jak dotąd.
    spec: decisionCardContractEnabled ? DECISION_CARD_SPEC : undefined,
    initialLayout: initialDecisionCardLayout,
    onLayoutChange: persistDecisionCardLayout,
  });

  // R2 (KONTRAKT §9): każda sekcja renderowana przez Decision ma wpis w katalogu
  // kanonicznym i odwrotnie. Cichy dev-only sygnał rozjazdu id kod↔katalog —
  // nie blokuje renderu, ale ostrzega, gdyby alias został źle zmapowany.
  useEffect(() => {
    if (!import.meta.env.DEV || !decisionCardContractEnabled) return;
    const missing = notionSections
      .map((s) => s.id)
      .filter((id) => !DECISION_CARD_RENDER_IDS.includes(id));
    if (missing.length > 0) {
      // eslint-disable-next-line no-console
      console.warn('[decisionCardContract] sekcje lewej nawigacji bez wpisu w katalogu:', missing);
    }
  }, [decisionCardContractEnabled, notionSections]);

  const orderedNotionSections = useMemo(
    () => decisionCardLayout.applyToSections(notionSections),
    [decisionCardLayout, notionSections]
  );

  useEffect(() => {
    if (orderedNotionSections.length === 0) return;
    if (!orderedNotionSections.some((section) => section.id === activeNotionSection)) {
      setActiveNotionSection(orderedNotionSections[0].id);
    }
  }, [orderedNotionSections, activeNotionSection]);

  const publishPayload = useMemo(
    () => ({
      title,
      projectId: decisionProjectId || undefined,
      description,
      status: status.toUpperCase(),
      priority: priority.toLowerCase(),
      category,
      dueDate: dueDate || null,
      rationale,
      decisionOwnerId: deciderId || null,
      deciderId: deciderId || null,
      alternatives,
      selectedAlternativeId: selectedAlternativeId || null,
      impact: aggregateDecisionImpact(impact),
    }),
    [
      title,
      decisionProjectId,
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
    return t('decisions.detail.draftAutosaved', 'Draft autosaved {{time}}', { time });
  }, [lastDraftSavedAt, t]);

  const persistDraft = (source: 'autosave' | 'chat' | 'publish') => {
    const draftKey = `consultify-decision-draft:${decisionId || 'new'}`;
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

  // Fetch related notebook pages that mention the decision title
  useEffect(() => {
    const q = (title || '').trim();
    if (!q) {
      setRelatedNotes([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const pages = await Api.getNotebookPages({ q, limit: 5 });
        const arr = Array.isArray(pages) ? pages : [];
        if (!cancelled) {
          setRelatedNotes(
            arr.map((p: any) => ({
              id: p.id,
              title: p.title || '',
              captureSource: p.captureSource ?? null,
              captureMetadata: p.captureMetadata ?? null,
              convertedTo: Array.isArray(p.convertedTo) ? p.convertedTo : null,
            }))
          );
        }
      } catch {
        if (!cancelled) setRelatedNotes([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [title]);

  useEffect(() => {
    setLastPublishedSnapshot('');
    setLastDraftSavedAt(null);
  }, [decisionId]);

  useEffect(() => {
    if (!isLocalHydrated || hasPublishBaseline) return;
    setLastPublishedSnapshot(draftSnapshot);
  }, [isLocalHydrated, hasPublishBaseline, draftSnapshot]);

  // Seed N-card states from hydrated content: a card that already carries content
  // starts as `edited` (human-owned) so its badge + action bar are visible; empty
  // cards stay `empty` → placeholder with the "Generate with AI" path. Only seeds
  // cards still in `empty`, so a live AI-draft is never clobbered by rehydration.
  useEffect(() => {
    if (!isLocalHydrated) return;
    const seed: Partial<Record<DecisionCardKey, boolean>> = {
      description: (description || '').trim().length > 0,
      alternatives: alternatives.length > 0,
      risk: risks.length > 0,
      consequences: !!consequenceScenarios || (rationale || '').trim().length > 0,
    };
    setCardStates((prev) => {
      let changed = false;
      const next = { ...prev };
      (Object.keys(seed) as DecisionCardKey[]).forEach((k) => {
        if (prev[k] === 'empty' && seed[k]) {
          next[k] = 'edited';
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocalHydrated, description, alternatives, risks, consequenceScenarios, rationale]);

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
        label: t('decisions.detail.activityLog.approval', 'Approval'),
        style: 'text-emerald-500 bg-emerald-500/10 border-emerald-400/30',
      };
    if (type === 'rejected')
      return {
        icon: <X size={12} />,
        label: t('decisions.detail.activityLog.rejection', 'Rejection'),
        style: 'text-danger-500 bg-danger-500/10 border-danger-400/30',
      };
    if (type === 'escalated')
      return {
        icon: <ArrowUp size={12} />,
        label: t('decisions.detail.activityLog.escalation', 'Escalation'),
        style: 'text-amber-500 bg-amber-500/10 border-amber-400/30',
      };
    if (type === 'deferred')
      return {
        icon: <Clock size={12} />,
        label: t('decisions.detail.activityLog.deferral', 'Deferral'),
        style: 'text-c-text-secondary bg-c-text-secondary/10 border-c-border-strong/30',
      };
    if (type === 'assignment')
      return {
        icon: <UserCheck size={12} />,
        label: t('decisions.detail.activityLog.assignment', 'Assignment'),
        style: 'text-sky-500 bg-sky-500/10 border-sky-400/30',
      };
    if (type === 'comment')
      return {
        icon: <MessageSquare size={12} />,
        label: t('decisions.detail.activityLog.comment', 'Comment'),
        style: 'text-indigo-500 bg-indigo-500/10 border-indigo-400/30',
      };
    if (type === 'deadline')
      return {
        icon: <Calendar size={12} />,
        label: t('decisions.detail.activityLog.deadline', 'Deadline'),
        style: 'text-danger-500 bg-danger-500/10 border-danger-400/30',
      };
    if (type === 'priority' || type === 'status_change')
      return {
        icon: <Flag size={12} />,
        label: t('decisions.detail.activityLog.statusChange', 'Status change'),
        // VF1-4: was crimson `primary-*` — distinct hue from escalated/deferred/comment/deadline.
        style: 'text-c-info bg-c-info/10 border-c-info/30',
      };
    if (type === 'edit')
      return {
        icon: <Edit3 size={12} />,
        label: t('decisions.detail.activityLog.edit', 'Edit'),
        style: 'text-blue-500 bg-blue-500/10 border-blue-400/30',
      };
    return {
      icon: <Plus size={12} />,
      label: t('decisions.detail.activityLog.created', 'Created'),
      style: 'text-c-text-secondary bg-c-text-secondary/10 border-c-border-strong/30',
    };
  };

  const renderActivityLogPanel = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <div className="rounded-xl border border-c-border-subtle/60 bg-c-surface/70 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-c-text-secondary dark:text-c-text-muted dark:text-c-text-secondary">
            {t('decisions.detail.activityLog.entriesTab', 'Entries')}
          </p>
          <p className="text-sm font-semibold text-c-text">{activityStats.total}</p>
        </div>
        <div className="rounded-xl border border-c-border-subtle/60 bg-c-surface/70 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-c-text-secondary dark:text-c-text-muted dark:text-c-text-secondary">
            {t('decisions.detail.activityLog.changesTab', 'Changes')}
          </p>
          <p className="text-sm font-semibold text-c-text">{activityStats.edited}</p>
        </div>
        <div className="rounded-xl border border-c-border-subtle/60 bg-c-surface/70 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-c-text-secondary dark:text-c-text-muted dark:text-c-text-secondary">
            {t('decisions.detail.activityLog.escalationsTab', 'Escalations')}
          </p>
          <p className="text-sm font-semibold text-c-text">{activityStats.escalations}</p>
        </div>
        <div className="rounded-xl border border-c-border-subtle/60 bg-c-surface/70 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-c-text-secondary dark:text-c-text-muted dark:text-c-text-secondary">
            {t('decisions.detail.activityLog.collaborationTab', 'Collaboration')}
          </p>
          <p className="text-sm font-semibold text-c-text">{activityStats.collaboration}</p>
        </div>
      </div>

      {activityLogSorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-c-border-subtle/60 dark:border-c-border-subtle/70 bg-c-surface/40 p-6 text-center text-xs text-c-text-secondary dark:text-c-text-muted dark:text-c-text-secondary">
          {t('decisions.detail.activityLog.noEntries', 'No activity entries yet.')}
        </div>
      ) : (
        <div className="rounded-2xl border border-c-border-subtle/60 bg-c-surface/70 p-3">
          <div className="space-y-1">
            {activityLogSorted.map((entry) => {
              const meta = activityTypeMeta(entry.type);
              return (
                <div
                  key={entry.id}
                  className="grid grid-cols-[auto_1fr_auto] gap-3 items-start py-2.5 px-2 rounded-xl hover:bg-c-surface/70 dark:hover:bg-c-surface-raised/40 transition-colors"
                >
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-lg border ${meta.style}`}
                  >
                    {meta.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm text-c-text">{entry.description}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-c-text-secondary dark:text-c-text-muted dark:text-c-text-secondary">
                      <span>{new Date(entry.timestamp).toLocaleString()}</span>
                      {entry.userName && <span>{`· ${entry.userName}`}</span>}
                      <span className="px-1.5 py-0.5 rounded border border-c-border-subtle/60">
                        {meta.label}
                      </span>
                    </div>
                    {(entry.oldValue || entry.newValue) && (
                      <div className="mt-1.5 text-[11px] text-c-text-secondary dark:text-c-text-muted">
                        {entry.oldValue
                          ? `${t('decisions.detail.activityLog.from', 'From')}: ${entry.oldValue}`
                          : ''}
                        {entry.oldValue && entry.newValue ? '  ->  ' : ''}
                        {entry.newValue
                          ? `${t('decisions.detail.activityLog.to', 'To')}: ${entry.newValue}`
                          : ''}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] font-mono uppercase tracking-wide text-c-text-muted">
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
        description: t('decisions.detail.activityLog.decisionCreated', 'Decision created'),
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
      const normalizedStatus = (decision.status?.toLowerCase() ||
        'pending') as keyof typeof STATUS_CONFIG;
      setStatus(normalizedStatus);
      // D-A (2026-07-22): tryb otwarcia zależny od stanu. Decyzja z finalnym
      // werdyktem (zatwierdzona/odrzucona) = czysta prezentacja → Podgląd.
      // Każdy stan roboczy (oczekująca/eskalowana/odroczona) = warsztat → Edycja,
      // gotowa do pisania. Zastępuje wadę „martwej karty" (zawsze Podgląd).
      const isFinalizedDecision =
        normalizedStatus === 'approved' || normalizedStatus === 'rejected';
      setReadMode(isFinalizedDecision);
      setWorkflowStatus(
        ['proposed', 'review', 'approve', 'published'].includes(
          String(decision.workflowStatus || '').toLowerCase()
        )
          ? (String(decision.workflowStatus).toLowerCase() as DecisionWorkflowStage)
          : 'proposed'
      );
      setPriority(normalizePriority(decision.priority));
      setCategory(decision.category || 'technical');
      setDueDate(decision.dueDate ? decision.dueDate.split('T')[0] : '');
      setRationale(
        decision.rationale ||
          (isDemo
            ? 'Delayed decision on report generation approach will block 4 active client projects from receiving their DRD reports on time. Each week of delay increases manual effort costs by ~€8,000 and risks client satisfaction scores dropping below SLA thresholds. Two enterprise clients have contractual deadlines in March 2026.'
            : '')
      );
      setRequesterName(decision.requestedByName || '');
      setDeciderId(decision.deciderId || '');
      setProjectName(decision.projectName || '');
      setContextDetails(decision.contextDetails || decision.context || '');
      setDecisionDate(decision.decisionDate || '');
      setCreatedAt(decision.createdAt || '');
      setUpdatedAt(decision.updatedAt || '');

      // Z31 (parytet #37): świeżo utworzona decyzja (bez opisu, wiek < 2 min)
      // → otwórz na EDIT, nie READ (default). Tani sygnał — bez systemu
      // uprawnień (to gate #28).
      const createdAtMs = decision.createdAt ? new Date(decision.createdAt).getTime() : NaN;
      const isFreshAndEmpty =
        !decision.description?.trim() &&
        !Number.isNaN(createdAtMs) &&
        Date.now() - createdAtMs < 2 * 60 * 1000;
      if (isFreshAndEmpty) {
        setReadMode(false);
      }
      // Use API data; demo fallback only in demo sessions
      const apiAlternatives = decision.alternatives || [];
      // Bez dosypywania zaszytych plusów/minusów: pusta lista argumentów jest
      // uczciwym stanem opcji, wymyślony argument decyzyjny nie jest.
      setAlternatives(
        apiAlternatives.length > 0 ? apiAlternatives : isDemo ? DEMO_ALTERNATIVES : []
      );
      setSelectedAlternativeId(decision.selectedAlternativeId || '');
      if (decision.impact) {
        setImpact(decision.impact);
      }
      const apiAttachments = decision.attachments || [];
      setAttachments(apiAttachments.length > 0 ? apiAttachments : isDemo ? DEMO_ATTACHMENTS : []);
      const apiComments = decision.comments || [];
      setComments(apiComments.length > 0 ? apiComments : isDemo ? DEMO_COMMENTS : []);
      const apiLinkedItems = decision.linkedItems || [];
      setLinkedItems(apiLinkedItems.length > 0 ? apiLinkedItems : isDemo ? DEMO_LINKED_ITEMS : []);
      setSourceType(decision.sourceType || decision.source_type || null);
      setSourceId(decision.sourceId || decision.source_id || null);

      // Risks — demo fallback
      const apiRisks = decision.risks || [];
      setRisks(apiRisks.length > 0 ? apiRisks : isDemo ? DEMO_RISKS : []);

      // Reminders & escalation — demo fallback
      const apiReminders = decision.reminders || [];
      const loadedReminders = (
        apiReminders.length > 0 ? apiReminders : isDemo ? DEMO_REMINDERS : []
      ).map((rule: ReminderRuleWithDelivery) => normalizeReminderRule(rule));
      setReminders(loadedReminders);
      const loadedEscalation = decision.escalation || (isDemo ? DEMO_ESCALATION : null);
      setEscalation(loadedEscalation);
      setEscalationRules(
        loadedEscalation
          ? [
              normalizeEscalationRule({
                ...loadedEscalation,
                warningDays: thresholds.warningDays,
                criticalDays: thresholds.criticalDays,
              }),
            ]
          : []
      );

      // Load stakeholders
      try {
        const stakeholdersResponse = await Api.get(`/decisions/${id}/stakeholders`);
        const apiStakeholders = stakeholdersResponse?.stakeholders || [];
        setStakeholders(
          apiStakeholders.length > 0
            ? apiStakeholders
            : isDemo
              ? DEMO_STAKEHOLDERS.map((s) => ({ ...s, decisionId: id }))
              : []
        );
      } catch {
        // Stakeholders endpoint may not exist yet — demo fallback only in demo sessions
        setStakeholders(isDemo ? DEMO_STAKEHOLDERS.map((s) => ({ ...s, decisionId: id })) : []);
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
        const raw = localStorage.getItem(`consultify-decision-enhancements:${id}`);
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
      toast.error(t('decisions.detail.toast.loadFailed', 'Failed to load decision'));
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
        `consultify-decision-enhancements:${decisionId}`,
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
    if (!decisionId && !decisionProjectId) return;
    const timer = setTimeout(() => {
      handleSave(true);
    }, 900);
    return () => clearTimeout(timer);
  }, [isLocalHydrated, hasPublishBaseline, isDirty, draftSnapshot, decisionId, decisionProjectId]);

  const handleSave = async (silent = false) => {
    if (!title.trim()) {
      if (!silent) toast.error(t('decisions.detail.toast.titleRequired', 'Title is required'));
      return;
    }
    if (!decisionId && !decisionProjectId) {
      if (!silent) toast.error(t('decisions.detail.toast.projectRequired', 'Project is required'));
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
        if (!silent) toast.success(t('decisions.detail.toast.decisionUpdated', 'Decision updated'));
        emitMyWorkEvent({ type: 'item:updated', entityType: 'decision', entityId: decisionId });
      } else {
        await Api.createDecision(payload);
        if (!silent)
          toast.success(t('decisions.detail.activityLog.decisionCreated', 'Decision created'));
      }
      setLastPublishedSnapshot(draftSnapshot);
      persistDraft(silent ? 'autosave' : 'publish');
      onSaved?.({ ...payload, id: decisionId });
    } catch (error) {
      console.error('Failed to save decision', error);
      if (!silent) toast.error(t('decisions.detail.toast.saveFailed', 'Failed to save decision'));
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChat = async () => {
    setChatKickoffMessage(
      buildAskAIMessage({
        type: 'decision',
        title,
        status,
        priority,
        dueDate: dueDate || undefined,
        description: description || undefined,
      })
    );

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

  // #33 — contextual AI-CTA on the Decision card ("Przeanalizuj opcje" /
  // "Analyze options"), same doctrine (D17) as TaskDetailView's "Create Ideas"
  // and InsightViewer's openInsightConsultant: ONE docked Teresa panel, opened
  // with entity context (useOpenChatWithContext) + a pre-seeded, action-specific
  // kickoff message (setChatKickoffMessage) — mirrors MyWorkHub's combined usage
  // of both. Complements (does not replace) the local "Generate options" button,
  // which drafts alternatives directly; this one opens a conversation to reason
  // through them with Teresa.
  const handleAnalyzeOptionsWithAI = useCallback(async () => {
    await openChatWithContext({
      entityType: 'decision',
      entityId: decisionId || 'new',
      entityName: title,
      contextData: {
        module: 'decision',
        status,
        priority,
        alternativesCount: alternatives.length,
      },
    });
    setChatKickoffMessage(
      t('decisions.detail.ai.analyzeOptionsKickoff', {
        title: title || t('decisions.detail.ai.analyzeOptionsKickoffUntitled', 'untitled'),
        defaultValue:
          'Analyze the options for decision "{{title}}": compare pros/cons, risks, and propose a recommendation.',
      })
    );
    if (isChatCollapsed) {
      toggleChatCollapse();
    }
  }, [
    openChatWithContext,
    decisionId,
    title,
    status,
    priority,
    alternatives.length,
    t,
    isChatCollapsed,
    toggleChatCollapse,
    setChatKickoffMessage,
  ]);

  const handleApprove = async () => {
    if (!decisionId) return;
    try {
      await Api.decideDecision(decisionId, 'approved', rationale || undefined);
      setStatus('approved');
      setDecisionDate(new Date().toISOString());
      addActivityLogEntry(
        'approved',
        t('decisions.detail.toast.decisionApproved', 'Decision approved'),
        t('decisions.detail.toast.pending', 'Pending'),
        t('decisions.detail.toast.approved', 'Approved')
      );
      toast.success(t('decisions.detail.toast.decisionApproved', 'Decision approved'));
      emitMyWorkEvent({ type: 'item:completed', entityType: 'decision', entityId: decisionId! });
      onSaved?.({ title, status: 'approved' });
      setShowFollowUp(true);
    } catch (error) {
      toast.error(t('decisions.detail.toast.approveFailed', 'Failed to approve'));
    }
  };

  const handleWorkflowTransition = async (nextStatus: DecisionWorkflowStage) => {
    if (!decisionId) return;
    try {
      setWorkflowActionLoading(true);
      const previousWorkflow = workflowStatus;
      const result = await Api.transitionDecisionWorkflow(decisionId, nextStatus);
      const resolvedWorkflow = ['proposed', 'review', 'approve', 'published'].includes(
        String(result.workflowStatus || '').toLowerCase()
      )
        ? (String(result.workflowStatus).toLowerCase() as DecisionWorkflowStage)
        : nextStatus;

      setWorkflowStatus(resolvedWorkflow);
      addActivityLogEntry(
        'status_change',
        t('decisions.detail.toast.workflowStageChanged', 'Decision workflow stage changed'),
        t(
          `decisions.detail.workflowStage.${previousWorkflow}`,
          WORKFLOW_STATUS_CONFIG[previousWorkflow].label.en
        ),
        t(
          `decisions.detail.workflowStage.${resolvedWorkflow}`,
          WORKFLOW_STATUS_CONFIG[resolvedWorkflow].label.en
        )
      );

      const createdCount = Array.isArray(result.createdTaskIds) ? result.createdTaskIds.length : 0;
      if (resolvedWorkflow === 'published' && createdCount > 0) {
        toast.success(
          t(
            'decisions.detail.toast.publishedWithTasks',
            'Decision published and {{count}} task{{taskSuffix}} created',
            { count: createdCount, taskSuffix: createdCount === 1 ? '' : 's' }
          )
        );
      } else {
        toast.success(
          t('decisions.detail.toast.workflowSetTo', 'Workflow set to {{label}}', {
            label: t(
              `decisions.detail.workflowStage.${resolvedWorkflow}`,
              WORKFLOW_STATUS_CONFIG[resolvedWorkflow].label.en
            ),
          })
        );
      }
      emitMyWorkEvent({ type: 'item:updated', entityType: 'decision', entityId: decisionId });
      onSaved?.({
        id: decisionId,
        title,
        status,
        workflowStatus: resolvedWorkflow,
        createdTaskIds: result.createdTaskIds || [],
      });
    } catch (error) {
      console.error('Failed to transition decision workflow', error);
      toast.error(
        t('decisions.detail.toast.workflowUpdateFailed', 'Failed to update decision workflow')
      );
    } finally {
      setWorkflowActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!decisionId) return;
    try {
      await Api.decideDecision(decisionId, 'rejected', rationale || undefined);
      setStatus('rejected');
      setDecisionDate(new Date().toISOString());
      addActivityLogEntry(
        'rejected',
        t('decisions.detail.toast.decisionRejected', 'Decision rejected'),
        t('decisions.detail.toast.pending', 'Pending'),
        t('decisions.detail.toast.rejected', 'Rejected')
      );
      toast.success(t('decisions.detail.toast.decisionRejected', 'Decision rejected'));
      emitMyWorkEvent({ type: 'item:completed', entityType: 'decision', entityId: decisionId! });
      onSaved?.({ title, status: 'rejected' });
      setShowFollowUp(true);
    } catch (error) {
      toast.error(t('decisions.detail.toast.rejectFailed', 'Failed to reject'));
    }
  };

  const handleDefer = async () => {
    if (!decisionId) return;
    try {
      await Api.decideDecision(decisionId, 'deferred', rationale || undefined);
      setStatus('deferred');
      addActivityLogEntry(
        'deferred',
        t('decisions.detail.toast.decisionDeferred', 'Decision deferred'),
        t('decisions.detail.toast.pending', 'Pending'),
        t('decisions.detail.toast.deferred', 'Deferred')
      );
      toast.success(t('decisions.detail.toast.decisionDeferred', 'Decision deferred'));
      onSaved?.({ title, status: 'deferred' });
    } catch (error) {
      toast.error(t('decisions.detail.toast.deferFailed', 'Failed to defer'));
    }
  };

  const handleEscalate = async () => {
    if (!decisionId) return;
    try {
      await Api.escalateDecision(
        decisionId,
        t('decisions.detail.toast.escalatedFromDetail', 'Escalated from decision detail')
      );
      setStatus('escalated');
      addActivityLogEntry(
        'escalated',
        t('decisions.detail.toast.decisionEscalated', 'Decision escalated'),
        t('decisions.detail.toast.pending', 'Pending'),
        t('decisions.detail.toast.escalated', 'Escalated')
      );
      toast.success(t('decisions.detail.toast.decisionEscalated', 'Decision escalated'));
      onSaved?.({ title, status: 'escalated' });
    } catch (error) {
      toast.error(t('decisions.detail.toast.escalateFailed', 'Failed to escalate'));
    }
  };

  const handleRequestMoreInfo = async () => {
    if (!decisionId) return;
    try {
      // Add a comment requesting more information
      const requestComment = t(
        'decisions.detail.toast.requestMoreInfoComment',
        'Please provide additional information before a decision can be made.'
      );

      await handleAddComment(requestComment, undefined, { force: true });

      // Optionally update status to show it needs more info
      // For now, we'll just notify via toast and add the comment
      toast.success(t('decisions.detail.toast.requestSent', 'Request for more information sent'));

      // Trigger delegation modal for more detailed request
      setShowDelegationModal(true);
    } catch (error) {
      toast.error(t('decisions.detail.toast.requestFailed', 'Failed to send request'));
    }
  };

  // Alternative handlers
  const addAlternative = () => {
    if (isDecisionStageLocked) {
      toast.error(
        t('decisions.detail.toast.contentLocked', 'Content is locked during decision-making stage')
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

  // ── AI karty DECYZJA: jeden DZIAŁAJĄCY endpoint + UCZCIWY błąd ──────────────
  // Do 2026-07-23 wszystkie akcje AI tej karty wołały `/ai/chat`, czyli
  // ORKIESTRATOR (`server/src/routes/ai.routes.ts` → `{role, intent, prompt…}`).
  // Ten endpoint NIGDY nie zwraca `text`/`content`, więc każde takie wywołanie
  // było martwe: token spalony, odpowiedź wyrzucona, front szedł w `catch`,
  // a `catch` podstawiał ZASZYTĄ treść i meldował sukces. Dwie naprawy naraz:
  //  1) wołamy `/ai/generate` (kontrakt `{ text }`, bramka dostępu, mapowanie błędów),
  //  2) gdy AI nie odpowie — mówimy to WPROST i NIE ruszamy treści użytkownika.
  // „AI niedostępne" to poprawny wynik. Zmyślona treść podpisana AI — nie jest.
  const aiFailureReason = (err: unknown): string => {
    const code = String(
      (err as { data?: { code?: string } })?.data?.code || (err as { code?: string })?.code || ''
    ).toUpperCase();
    switch (code) {
      case 'NO_LLM_PROVIDER':
        return t('decisions.detail.ai.errNoProvider', 'no AI provider is configured');
      case 'AI_BUDGET_EXHAUSTED':
        return t('decisions.detail.ai.errBudget', 'the AI budget is exhausted');
      case 'ACCESS_BLOCKED':
        return t('decisions.detail.ai.errAccessBlocked', 'AI access is blocked for this workspace');
      case 'EMPTY_LLM_RESPONSE':
      case 'EMPTY_AI_RESPONSE':
        return t('decisions.detail.ai.errEmpty', 'AI returned an empty response');
      case 'LLM_CALL_FAILED':
        return t('decisions.detail.ai.errCallFailed', 'the AI call failed');
      case 'AI_BAD_JSON':
        return t('decisions.detail.ai.errBadJson', 'the AI response could not be parsed');
      default:
        return (
          String((err as Error)?.message || '').trim() ||
          t('decisions.detail.ai.errUnavailable', 'AI is temporarily unavailable')
        );
    }
  };

  /**
   * Uczciwy komunikat porażki AI: CO się nie udało + DLACZEGO.
   * Wywołanie tej funkcji jest jedyną dozwoloną reakcją na brak odpowiedzi AI —
   * żadna gałąź awaryjna nie może dopisywać treści do karty.
   */
  const notifyAiFailure = (whatFailed: string, err: unknown) => {
    console.error('[DecisionDetailView] AI request failed:', whatFailed, err);
    toast.error(
      t('decisions.detail.toast.aiFailedWithReason', '{{what}} — {{reason}}.', {
        what: whatFailed,
        reason: aiFailureReason(err),
      })
    );
  };

  /** Pojedyncze wywołanie AI zwracające czysty tekst (`/ai/generate` → `{ text }`). */
  const requestAiText = async (opts: {
    message: string;
    systemInstruction: string;
    roleName: string;
  }): Promise<string> => {
    const res = await Api.post('/ai/generate', {
      message: opts.message,
      systemInstruction: opts.systemInstruction,
      roleName: opts.roleName,
    });
    const text = String(res?.text ?? '')
      .replace(/^```[\w-]*\n?/g, '')
      .replace(/```$/g, '')
      .replace(/^["']|["']$/g, '')
      .trim();
    if (!text) {
      const err = new Error('Empty AI response') as Error & { code?: string };
      err.code = 'EMPTY_AI_RESPONSE';
      throw err;
    }
    return text;
  };

  /** To samo, ale wynik ma być JSON-em wg schematu podanego w prompcie. */
  const requestAiJson = async <T,>(opts: {
    message: string;
    systemInstruction?: string;
    roleName: string;
  }): Promise<T> => {
    const raw = await requestAiText({
      message: opts.message,
      systemInstruction:
        opts.systemInstruction ||
        t(
          'decisions.detail.ai.pmoJsonSystemInstruction',
          'You are a PMO assistant. Return valid JSON only, no markdown.'
        ),
      roleName: opts.roleName,
    });
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    try {
      return JSON.parse(jsonMatch ? jsonMatch[0] : raw) as T;
    } catch {
      const err = new Error('AI response is not valid JSON') as Error & { code?: string };
      err.code = 'AI_BAD_JSON';
      throw err;
    }
  };

  /** Rzuca uczciwy błąd „pusto", gdy AI odpowiedziało, ale bez użytecznej treści. */
  const emptyAiResult = (detail: string) => {
    const err = new Error(detail) as Error & { code?: string };
    err.code = 'EMPTY_AI_RESPONSE';
    return err;
  };

  const generateProsConsForAlternative = async (alt: Alternative) => {
    if (isDecisionStageLocked) return;
    setIsGeneratingAltProsCons((prev) => ({ ...prev, [alt.id]: true }));
    try {
      const prompt = t(
        'decisions.detail.ai.prosConsPrompt',
        'For this decision option, generate 3 concrete pros and 3 concrete cons. Return JSON only: {"pros":["..."],"cons":["..."]}.\n\nOption title: {{altTitle}}\nDescription: {{altDescription}}\nDecision context: {{decisionTitle}}',
        {
          altTitle: alt.title || '-',
          altDescription: alt.description || '-',
          decisionTitle: title || '-',
        }
      );

      const parsed = await requestAiJson<{ pros?: unknown; cons?: unknown }>({
        message: prompt,
        roleName: 'Decision Option Analyzer',
      });
      const nextPros = Array.isArray(parsed?.pros)
        ? parsed.pros.map((p: unknown) => String(p).trim()).filter(Boolean)
        : [];
      const nextCons = Array.isArray(parsed?.cons)
        ? parsed.cons.map((c: unknown) => String(c).trim()).filter(Boolean)
        : [];
      if (nextPros.length === 0 && nextCons.length === 0) {
        throw emptyAiResult('No pros/cons returned by AI');
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
        t('decisions.detail.toast.aiAddedProsCons', 'AI added suggested pros and cons')
      );
    } catch (err) {
      notifyAiFailure(
        t('decisions.detail.toast.aiProsConsFailed', 'AI could not generate pros and cons'),
        err
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
        t('decisions.detail.toast.contentLocked', 'Content is locked during decision-making stage')
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
        t(
          'decisions.detail.toast.aiGenAvailableOnlyBeforeDecision',
          'AI generation is available only before decision stage'
        )
      );
      return;
    }
    if (!title && !description) {
      toast.error(
        t('decisions.detail.toast.addTitleOrDescription', 'Add title or description first')
      );
      return;
    }

    setIsGeneratingAlternatives(true);
    setCardState('alternatives', 'generating');
    try {
      const res = await Api.post(`/decisions/${decisionId}/generate-section`, {
        sectionKey: 'alternatives',
        language: t('myWork.decisionDetail.language', 'en'),
      });
      const parsed = extractDecisionSectionJson(res);
      const rawAlternatives = Array.isArray(parsed?.alternatives) ? parsed.alternatives : [];
      if (rawAlternatives.length === 0) {
        throw new Error('No alternatives returned by AI');
      }

      const generatedAlternatives: Alternative[] = rawAlternatives.map((a: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        title: String(a?.title || '').trim(),
        description: String(a?.description || a?.estimatedCostTime || '').trim(),
        pros: Array.isArray(a?.pros) ? a.pros.map((p: any) => String(p)) : [],
        cons: Array.isArray(a?.cons) ? a.cons.map((c: any) => String(c)) : [],
        isRecommended: false,
      }));

      setAlternatives([...alternatives, ...generatedAlternatives]);
      setCardState('alternatives', 'ai-draft');
      toast.success(t('decisions.detail.toast.alternativesGenerated', 'Alternatives generated'));
    } catch (error) {
      setCardState('alternatives', 'error');
      toast.error(t('decisions.detail.toast.generationFailed', 'Generation failed'));
    } finally {
      setIsGeneratingAlternatives(false);
    }
  };

  const generateDescriptionAI = async () => {
    if (isDecisionStageLocked) {
      toast.error(
        t(
          'decisions.detail.toast.aiGenAvailableOnlyBeforeDecision',
          'AI generation is available only before decision stage'
        )
      );
      return;
    }
    setIsGeneratingDescription(true);
    setCardState('description', 'generating');
    try {
      const res = await Api.post(`/decisions/${decisionId}/generate-section`, {
        sectionKey: 'description',
        language: t('myWork.decisionDetail.language2', 'en'),
      });
      const content = extractDecisionSectionContent(res);

      setDescription(content);
      setCardState('description', 'ai-draft');
      toast.success(
        t('decisions.detail.toast.descriptionGenerated', 'Description generated by AI')
      );
    } catch {
      setCardState('description', 'error');
      toast.error(
        t('decisions.detail.toast.descriptionGenerationError', 'Error generating description')
      );
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  const generateAIComment = async () => {
    if (isDecisionStageLocked) {
      toast.error(
        t(
          'decisions.detail.toast.aiGenAvailableOnlyBeforeDecision',
          'AI generation is available only before decision stage'
        )
      );
      return;
    }
    setIsGeneratingAIComment(true);
    try {
      const recentComments = comments
        .slice(-5)
        .map((c, idx) => `${idx + 1}. ${c.authorName}: ${c.content}`)
        .join('\n');
      const decisionStatus = status || t('decisions.detail.ai.commentNoStatus', 'no status');
      const decisionPriority =
        priority || t('decisions.detail.ai.commentNoPriority', 'no priority');

      const prompt = t(
        'decisions.detail.ai.commentPrompt',
        `Generate ONE concrete comment for a project decision.
Goal: help the team choose the most useful next decision step.

Rules:
- 2-4 short sentences.
- Max 450 characters.
- No markdown, no emoji, no numbered lists.
- Do not repeat or paraphrase recent comments.
- Keep it practical and grounded in the provided context.

Decision context:
- Title: {{title}}
- Description: {{description}}
- Status: {{status}}
- Priority: {{priority}}
- Deadline: {{dueDate}}
- Stakeholders: {{stakeholdersCount}}
- Risks: {{risksCount}}
- Alternatives: {{alternativesCount}}

Recent comments:
{{recentComments}}

Return ONLY the final comment text.`,
        {
          title: title || t('decisions.detail.untitled', 'Untitled'),
          description: description || t('decisions.detail.noDescription', 'No description'),
          status: decisionStatus,
          priority: decisionPriority,
          dueDate: dueDate || t('decisions.detail.noDeadline', 'No deadline'),
          stakeholdersCount: stakeholders.length,
          risksCount: risks.length,
          alternativesCount: alternatives.length,
          recentComments: recentComments || t('decisions.detail.noCommentsYet', 'No comments yet'),
        }
      );

      const generatedComment = await requestAiText({
        message: prompt,
        systemInstruction: t(
          'decisions.detail.ai.decisionCoachSystemInstruction',
          'You are a practical PMO decision coach. Be concrete and avoid generic filler.'
        ),
        roleName: 'Decision Comment Advisor',
      });

      const recentAIMessages = comments
        .filter((c) => c.authorId === 'ai-assistant')
        .slice(-3)
        .map((c) => c.content.trim().toLowerCase());

      const finalComment = recentAIMessages.includes(generatedComment.toLowerCase())
        ? `${generatedComment} ${t('decisions.detail.ai.duplicateCommentAppend', 'Let us focus on one measurable step by end of day.')}`
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
      toast.success(t('decisions.detail.toast.aiCommentGenerated', 'AI comment generated'));
    } catch (err) {
      // Żaden komentarz NIE powstaje, gdy AI nie odpowiedziało. Dopisanie tu
      // zaszytego zdania podpisanego „AI Assistant" (isAIGenerated: true) było
      // najcięższą atrapą tej karty — fałszowało wkład AI w wątku decyzji.
      notifyAiFailure(
        t('decisions.detail.toast.aiCommentFailed', 'AI could not generate a comment'),
        err
      );
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

      const raciSchema =
        '{"stakeholders":[{"userId":"...","role":"accountable|responsible|consulted|informed","reason":"..."}]}';
      const prompt = t(
        'decisions.detail.ai.raciTeamPrompt',
        `Based on decision data, propose a RACI team. Return JSON ONLY:
{{schema}}
Requirements:
- Exactly 1 accountable
- 1-2 responsible
- 1-3 consulted/informed
- Use ONLY userId from the provided user list

Decision:
- Title: {{title}}
- Description: {{description}}
- Category: {{category}}
- Priority: {{priority}}
- Due date: {{dueDate}}
- Requester: {{requesterName}}
- Current deciderId: {{deciderId}}

Users (prefer project members):
{{roster}}`,
        {
          schema: raciSchema,
          title: title || '-',
          description: description || '-',
          category,
          priority,
          dueDate: dueDate || '-',
          requesterName: requesterName || '-',
          deciderId: deciderId || '-',
          roster,
        }
      );

      const parsed = await requestAiJson<{ stakeholders?: unknown }>({
        message: prompt,
        roleName: 'RACI Team Advisor',
      });
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
        throw emptyAiResult('No valid AI stakeholder suggestions');
      }

      // Replace list (not append): user asked for proposal that can be adjusted manually.
      setStakeholders(next);
      toast.success(
        t(
          'decisions.detail.toast.aiRaciApplied',
          'AI proposed and applied a RACI team ({{count}} people).',
          { count: next.length }
        )
      );
    } catch (err) {
      notifyAiFailure(
        t('decisions.detail.toast.aiRaciSuggestFailed', 'AI could not propose a RACI team'),
        err
      );
    } finally {
      setIsSuggestingStakeholders(false);
    }
  };

  const suggestRemindersAI = async () => {
    if (isDecisionStageLocked) return;
    setIsSuggestingReminders(true);
    try {
      const remindersSchema =
        '{"reminders":[{"type":"before_due|after_due","days":2,"recipients":"requester|decider|both|stakeholders","inAppNotification":true,"emailNotification":false,"message":"...","enabled":true}]}';
      const prompt = t(
        'decisions.detail.ai.remindersPrompt',
        `Propose decision reminders. Return JSON ONLY:
{{schema}}
Consider priority {{priority}}, due date {{dueDate}} and status {{status}}.`,
        { schema: remindersSchema, priority, dueDate: dueDate || '-', status }
      );
      const parsed = await requestAiJson<{ reminders?: unknown }>({
        message: prompt,
        roleName: 'Reminder Rules Advisor',
      });
      const next = (Array.isArray(parsed?.reminders) ? parsed.reminders : [])
        .map(
          (r: any, idx: number): ReminderRuleWithDelivery => ({
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
          })
        )
        .slice(0, 6);
      if (next.length === 0) throw emptyAiResult('No reminders returned by AI');
      setReminders(next.map((rule: ReminderRuleWithDelivery) => normalizeReminderRule(rule)));
      toast.success(
        t(
          'decisions.detail.toast.aiRemindersApplied',
          'AI suggested and applied reminders ({{count}}).',
          { count: next.length }
        )
      );
    } catch (err) {
      // Brak odpowiedzi AI NIE tworzy reguł. Wcześniej wstawiane były dwie
      // zaszyte reguły (3 dni przed / 1 dzień po) i meldowany sukces — użytkownik
      // dostawał konfigurację powiadomień, o którą nikt nie prosił.
      notifyAiFailure(
        t('decisions.detail.toast.aiRemindersFailed', 'AI could not propose reminders'),
        err
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
      const escalationsSchema =
        '{"rules":[{"afterDays":5,"warningDays":3,"criticalDays":1,"escalateToUserId":"...","message":"...","enabled":true}]}';
      const prompt = t(
        'decisions.detail.ai.escalationsPrompt',
        `Propose 1-3 escalation rules for this decision. Return JSON ONLY:
{{schema}}
Use userId only from users list:
{{userList}}`,
        { schema: escalationsSchema, userList }
      );
      const parsed = await requestAiJson<{ rules?: unknown }>({
        message: prompt,
        roleName: 'Escalation Rules Advisor',
      });
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
      if (next.length === 0) throw emptyAiResult('No escalation rules returned by AI');
      setEscalationRules(next);
      toast.success(
        t(
          'decisions.detail.toast.aiEscalationsApplied',
          'AI suggested and applied escalation rules ({{count}}).',
          { count: next.length }
        )
      );
    } catch (err) {
      // Nie wstawiamy zaszytej reguły eskalacji na losową osobę (`users[0]`).
      notifyAiFailure(
        t('decisions.detail.toast.aiEscalationsFailed', 'AI could not propose escalation rules'),
        err
      );
    } finally {
      setIsSuggestingEscalations(false);
    }
  };

  const suggestStakeholderDraftAI = async () => {
    if (isDecisionStageLocked || !stakeholderDraft) return;
    setIsSuggestingStakeholders(true);
    try {
      const raciPersonSchema =
        '{"role":"accountable|responsible|consulted|informed","notifications":{"enabled":true,"inAppEnabled":true,"emailEnabled":false,"integrationChannels":["slack"],"syncTargets":["slack:#ops"]}}';
      const prompt = t(
        'decisions.detail.ai.raciPersonPrompt',
        `Fill configuration for one RACI person. Return JSON ONLY:
{{schema}}
Context: priority={{priority}}, status={{status}}, deadline={{dueDate}}`,
        { schema: raciPersonSchema, priority, status, dueDate: dueDate || '-' }
      );
      const parsed = await requestAiJson<{ role?: string; notifications?: any }>({
        message: prompt,
        roleName: 'RACI Person Form Assistant',
      });
      const role: StakeholderRole = [
        'accountable',
        'responsible',
        'consulted',
        'informed',
      ].includes(String(parsed?.role))
        ? (String(parsed.role) as StakeholderRole)
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
        t('decisions.detail.toast.aiRaciPersonFormFilled', 'AI filled the RACI person form.')
      );
    } catch (err) {
      // Formularz zostaje dokładnie taki, jaki wypełnił użytkownik.
      notifyAiFailure(
        t('decisions.detail.toast.aiRaciPersonFailed', 'AI could not fill the RACI person form'),
        err
      );
    } finally {
      setIsSuggestingStakeholders(false);
    }
  };

  const suggestReminderDraftAI = async () => {
    if (isDecisionStageLocked || !reminderDraft) return;
    setIsSuggestingReminders(true);
    try {
      const reminderFormSchema =
        '{"type":"before_due|after_due","days":2,"recipients":"requester|decider|both|stakeholders","inAppNotification":true,"emailNotification":false,"message":"...","enabled":true}';
      const prompt = t(
        'decisions.detail.ai.reminderFormPrompt',
        `Fill a single reminder rule for this decision. Return JSON ONLY:
{{schema}}
Context: priority={{priority}}, status={{status}}, deadline={{dueDate}}`,
        { schema: reminderFormSchema, priority, status, dueDate: dueDate || '-' }
      );
      const r = await requestAiJson<any>({
        message: prompt,
        roleName: 'Reminder Form Assistant',
      });
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
        t('decisions.detail.toast.aiReminderFormFilled', 'AI filled the reminder form.')
      );
    } catch (err) {
      notifyAiFailure(
        t('decisions.detail.toast.aiReminderFormFailed', 'AI could not fill the reminder form'),
        err
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
      const escalationFormSchema =
        '{"afterDays":5,"warningDays":3,"criticalDays":1,"escalateToUserId":"...","message":"...","enabled":true}';
      const prompt = t(
        'decisions.detail.ai.escalationFormPrompt',
        `Fill one escalation rule. Return JSON ONLY:
{{schema}}
Use userId only from this list:
{{userList}}`,
        { schema: escalationFormSchema, userList }
      );
      const r = await requestAiJson<any>({
        message: prompt,
        roleName: 'Escalation Form Assistant',
      });
      const selected = users.find((u) => u.id === r?.escalateToUserId) || users[0];
      if (!selected) throw emptyAiResult('No eligible user for escalation');
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
        t('decisions.detail.toast.aiEscalationFormFilled', 'AI filled the escalation form.')
      );
    } catch (err) {
      notifyAiFailure(
        t('decisions.detail.toast.aiEscalationFormFailed', 'AI could not fill the escalation form'),
        err
      );
    } finally {
      setIsSuggestingEscalations(false);
    }
  };

  const generateConsequencesOfInactionAI = async () => {
    if (isDecisionStageLocked) {
      toast.error(
        t(
          'decisions.detail.toast.aiGenAvailableOnlyBeforeDecision',
          'AI generation is available only before decision stage'
        )
      );
      return;
    }
    setCardState('consequences', 'generating');
    try {
      const res = await Api.post(`/decisions/${decisionId}/generate-section`, {
        sectionKey: 'consequencesOfInaction',
        language: t('myWork.decisionDetail.language3', 'en'),
      });
      const content = extractDecisionSectionContent(res);

      setRationale(content);
      setCardState('consequences', 'ai-draft');
      toast.success(
        t('decisions.detail.toast.consequencesGenerated', 'Consequences of inaction generated')
      );
    } catch {
      setCardState('consequences', 'error');
      toast.error(t('decisions.detail.toast.generationFailed', 'Generation failed'));
    }
  };

  const generateRisksAI = async () => {
    if (isDecisionStageLocked) {
      toast.error(
        t(
          'decisions.detail.toast.aiGenAvailableOnlyBeforeDecision',
          'AI generation is available only before decision stage'
        )
      );
      return;
    }
    if (!title && !description) {
      toast.error(
        t('decisions.detail.toast.addTitleOrDescription', 'Add title or description first')
      );
      return;
    }

    setIsGeneratingRisks(true);
    setCardState('risk', 'generating');
    try {
      const res = await Api.post(`/decisions/${decisionId}/generate-section`, {
        sectionKey: 'risk',
        language: t('myWork.decisionDetail.language4', 'en'),
      });
      const parsed = extractDecisionSectionJson(res);
      const rawRisks = Array.isArray(parsed?.risks) ? parsed.risks : [];
      if (rawRisks.length === 0) {
        throw new Error('No risks returned by AI');
      }

      const generatedRisks: RiskItem[] = rawRisks.map((r: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        title: String(r?.title || '').trim(),
        probability: normalizeRiskLevel(r?.probability),
        impact: normalizeRiskLevel(r?.impact),
        category: normalizeRiskCategory(r?.category),
        mitigation: String(r?.mitigation || '').trim(),
        contingency: String(r?.contingency || '').trim(),
      }));

      setRisks([...risks, ...generatedRisks]);
      setCardState('risk', 'ai-draft');
      toast.success(t('decisions.detail.toast.riskAnalysisGenerated', 'Risk analysis generated'));
    } catch (error) {
      setCardState('risk', 'error');
      toast.error(t('decisions.detail.toast.generationFailed', 'Generation failed'));
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
  // readMode (toggle "do pokazania klientowi") ORuje się do bramki edycji, więc
  // wszystkie readOnly/hideActions/disabled już wpięte w isDecisionStageLocked
  // automatycznie respektują tryb Read bez zmiany każdego call-site.
  const isDecisionStageLocked = readMode || (WORKFLOW_LOCKS_ENABLED && isPending);
  // `workflowMeta` (badge etapu) usunięty razem z belką workflow (§3.2) — stan
  // etapu czyta się ze Statusu w Właściwościach; WORKFLOW_STATUS_CONFIG dalej
  // steruje tonem przycisków przejść w sekcji Akcje przez `workflowActions`.
  const workflowActions = (() => {
    switch (workflowStatus) {
      case 'proposed':
        return [
          {
            id: 'review',
            label: t('decisions.detail.workflow.sendToReview', 'Send to review'),
            onClick: () => handleWorkflowTransition('review'),
            tone: 'primary' as const,
          },
        ];
      case 'review':
        return [
          {
            id: 'approve',
            label: t('decisions.detail.workflow.approveStage', 'Approve stage'),
            onClick: () => handleWorkflowTransition('approve'),
            tone: 'success' as const,
          },
          {
            id: 'proposed',
            label: t('decisions.detail.workflow.backToDraft', 'Back to draft'),
            onClick: () => handleWorkflowTransition('proposed'),
            tone: 'neutral' as const,
          },
        ];
      case 'approve':
        return [
          {
            id: 'published',
            label: t('decisions.detail.workflow.publishAndCreateTasks', 'Publish and create tasks'),
            onClick: () => handleWorkflowTransition('published'),
            tone: 'success' as const,
          },
          {
            id: 'review',
            label: t('decisions.detail.workflow.backToReview', 'Back to review'),
            onClick: () => handleWorkflowTransition('review'),
            tone: 'neutral' as const,
          },
        ];
      case 'published':
      default:
        return [];
    }
  })();
  // Defensive fallbacks (prevents crash on unexpected/null values)
  const statusConfig = (STATUS_CONFIG as any)?.[status] ||
    (STATUS_CONFIG as any)?.pending || {
      label: { en: 'Pending', pl: 'Oczekująca' },
      color: 'bg-c-text-muted',
      textColor: 'text-c-text-muted',
    };
  const priorityConfig = (PRIORITY_CONFIG as any)?.[normalizePriority(priority)] ||
    (PRIORITY_CONFIG as any)?.medium || {
      label: { en: 'Medium', pl: 'Średni' },
      color: 'bg-c-info',
      textColor: 'text-c-info',
    };
  const CategoryIcon = CATEGORY_CONFIG[category]?.icon || FileText;
  const decisionScopeLabel =
    projectName ||
    initiativeName ||
    (CATEGORY_CONFIG[category]?.label?.en
      ? t(`decisions.detail.category.${category}`, CATEGORY_CONFIG[category].label.en)
      : undefined) ||
    '—';
  const decisionIndexLabel =
    decisionId || `draft-${title.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 20) || 'new'}`;
  const relatedDecisionItems = useMemo(
    () => linkedItems.filter((item) => item.type === 'task' || item.type === 'decision'),
    [linkedItems]
  );
  // `canExpandDescription` / `canExpandContext` (progi „czy pokazać Pokaż więcej")
  // usunięte razem z samym przełącznikiem — patrz komentarz przy stanie wyżej.
  const quickProArguments = useMemo(
    () => [
      t('decisions.detail.quickArgs.proLowerCost', 'Lower cost'),
      t('decisions.detail.quickArgs.proLowerRisk', 'Lower risk'),
      t('decisions.detail.quickArgs.proFaster', 'Faster delivery'),
      t('decisions.detail.quickArgs.proBetterQuality', 'Better quality'),
      t('decisions.detail.quickArgs.proScalability', 'Scalability'),
    ],
    [i18n.language, t]
  );
  const quickConArguments = useMemo(
    () => [
      t('decisions.detail.quickArgs.conHigherCost', 'Higher cost'),
      t('decisions.detail.altGen.higherRisk', 'Higher risk'),
      t('decisions.detail.quickArgs.conSlower', 'Slower delivery'),
      t('decisions.detail.quickArgs.conComplexity', 'Higher complexity'),
      t('decisions.detail.quickArgs.conVendorDependency', 'Vendor dependency'),
    ],
    [i18n.language, t]
  );
  const riskLevelOptions = useMemo(() => ['low', 'medium', 'high', 'critical'] as const, []);
  const riskCategoryOptions = useMemo(
    () =>
      ['technical', 'business', 'financial', 'operational', 'security'].map((c) => ({
        value: c,
        label: t(`decisions.detail.riskCategory.${c}`, RISK_CATEGORY_EN_LABELS[c]),
      })),
    [i18n.language]
  );
  const quickMitigationArguments = useMemo(
    () => [
      t('decisions.detail.quickArgs.mitigationPOC', 'POC before rollout'),
      t('decisions.detail.quickArgs.mitigationWeeklyReview', 'Weekly review checkpoint'),
      t('decisions.detail.quickArgs.mitigationQAPlan', 'Quality control plan'),
    ],
    [i18n.language]
  );
  const quickContingencyArguments = useMemo(
    () => [
      t('decisions.detail.quickArgs.contingencyManualFallback', 'Manual fallback mode'),
      t('decisions.detail.quickArgs.contingencyEscalatePMO', 'Escalate to PMO'),
      t(
        'decisions.detail.quickArgs.contingencyTimelineShift',
        'Timeline shift with stakeholder notice'
      ),
    ],
    [i18n.language]
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
    if (score >= 12)
      return 'text-danger-600 dark:text-danger-400 bg-danger-500/10 border-danger-500/30';
    if (score >= 8) return 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/30';
    if (score >= 4)
      return 'text-yellow-700 dark:text-yellow-300 bg-yellow-500/10 border-yellow-500/30';
    return 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/30';
  };
  const getRiskLevelClass = (level?: string) => {
    const normalized = String(level || '').toLowerCase();
    if (normalized === 'critical')
      return 'border-danger-500/60 bg-danger-500/10 text-danger-700 dark:text-danger-300';
    if (normalized === 'high')
      return 'border-amber-500/55 bg-amber-500/10 text-amber-700 dark:text-amber-300';
    if (normalized === 'medium')
      return 'border-amber-500/55 bg-amber-500/10 text-amber-700 dark:text-amber-300';
    return 'border-emerald-500/45 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  };
  const getRiskLevelLabel = (level: string) => {
    if (level === 'critical') return t('decisions.detail.riskLevel.critical', 'Critical');
    if (level === 'high') return t('decisions.detail.riskLevel.high', 'High');
    if (level === 'medium') return t('decisions.detail.riskLevel.medium', 'Medium');
    return t('decisions.detail.riskLevel.low', 'Low');
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
      d7: t(
        'decisions.detail.pressure.linkedItemsBlocked',
        '{{count}} linked item(s) may become operationally blocked',
        { count: blockedItemsCount || 1 }
      ),
      d30: t(
        'decisions.detail.pressure.manualWorkloadIncrease',
        'Manual workload may increase by about {{hours}}h/week',
        { hours: weeklyHours }
      ),
      d90: t(
        'decisions.detail.pressure.escalationRisk',
        'High risk of escalation and loss of delivery momentum'
      ),
    };
  }, [
    i18n.language,
    blockedItemsCount,
    sortedRisks.length,
    /* + t: tlumaczenia ladowane async — bez tego memo zwraca surowy klucz na stale (2026-07-21) */ t,
  ]);

  const buildConsequencesTemplate = (
    style: 'conservative' | 'executive' | 'action_forcing'
  ): string => {
    const recommendation =
      recommendedAlternative?.title ||
      t('decisions.detail.consequences.selectedOptionFallback', 'selected option');
    const decider =
      deciderName ||
      deciderId ||
      t('decisions.detail.consequences.decisionOwnerFallback', 'decision owner');
    const due = dueDate || t('decisions.detail.consequences.dateFallback', '[DATE]');
    const riskLine = topRiskTitles.length
      ? topRiskTitles.join(', ')
      : t('decisions.detail.consequences.riskLineFallback', 'operational and quality risks');

    if (style === 'conservative') {
      return t(
        'decisions.detail.consequences.conservativeTemplate',
        '1) If the decision is not made by {{due}}, within 7 days:\n- {{d7}}\n\n2) Within 30 days:\n- {{d30}}\n- Most exposed areas: {{riskLine}}\n\n3) Within 90 days:\n- {{d90}}\n\n4) Minimum action now:\n- Approve: {{recommendation}}\n- Owner: {{decider}}',
        {
          due,
          d7: pressureSummary.d7,
          d30: pressureSummary.d30,
          riskLine,
          d90: pressureSummary.d90,
          recommendation,
          decider,
        }
      );
    }

    if (style === 'executive') {
      return t(
        'decisions.detail.consequences.executiveTemplate',
        'Executive summary:\nNo decision by {{due}} increases cost of inaction and delivery delay risk.\n\nImpact:\n- 7 days: {{d7}}\n- 30 days: {{d30}}\n- 90 days: {{d90}}\n\nRecommendation:\nApprove {{recommendation}} and assign ownership to: {{decider}}.',
        {
          due,
          d7: pressureSummary.d7,
          d30: pressureSummary.d30,
          d90: pressureSummary.d90,
          recommendation,
          decider,
        }
      );
    }

    return t(
      'decisions.detail.consequences.actionForcingTemplate',
      'ALERT: no decision by {{due}} triggers a negative scenario.\n\nWhat we lose:\n- Immediate: {{d7}}\n- 30 days: {{d30}}\n- 90 days: {{d90}}\n\nHighest risks: {{riskLine}}.\n\nDecision required NOW:\n- Approve {{recommendation}}\n- Confirm owner: {{decider}}\n- Keep deadline: {{due}}',
      {
        due,
        d7: pressureSummary.d7,
        d30: pressureSummary.d30,
        d90: pressureSummary.d90,
        riskLine,
        recommendation,
        decider,
      }
    );
  };

  /**
   * PUSTE scenariusze — stan wyjściowy sekcji „Konsekwencje bezczynności".
   * Wcześniej funkcja zwracała dziewięć gotowych zdań-wypełniaczy („Execution
   * uncertainty persists…"), pokazywanych pod nagłówkiem „AI scenarios" — czyli
   * zmyśloną analizę wyglądającą jak wynik pracy silnika. Puste pola do wpisania
   * są uczciwe; treść bierze się z AI albo od użytkownika.
   */
  const buildEmptyConsequenceScenarios = (): ConsequenceScenarios => ({
    updatedAt: new Date().toISOString(),
    source: 'fallback',
    pessimistic: { d7: '', d30: '', d90: '' },
    neutral: { d7: '', d30: '', d90: '' },
    optimistic: { d7: '', d30: '', d90: '' },
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
      const systemInstruction = t(
        'decisions.detail.ai.pmoAdvisorSystemInstruction',
        'You are a PMO advisor. Return valid JSON only according to schema.'
      );
      const consequenceScenariosSchema =
        '{\n  "pessimistic":{"d7":"...","d30":"...","d90":"..."},\n  "neutral":{"d7":"...","d30":"...","d90":"..."},\n  "optimistic":{"d7":"...","d30":"...","d90":"..."}\n}';
      const prompt = t(
        'decisions.detail.ai.consequenceScenariosPrompt',
        'Based on project context, generate consequences of inaction in 3 scenarios: pessimistic, neutral, optimistic. For each scenario provide d7, d30, d90. Return JSON ONLY in this format:\n{{schema}}\nContext: {{context}}',
        { schema: consequenceScenariosSchema, context: JSON.stringify(projectContext) }
      );

      const parsed = await requestAiJson<any>({
        message: prompt,
        systemInstruction,
        roleName: 'Decision Consequence Analyst',
      });
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
        throw emptyAiResult('Incomplete AI scenario response');
      }
      setConsequenceScenarios(next);
      setCardState('consequences', 'ai-draft');
      if (!silent) {
        toast.success(
          t(
            'decisions.detail.toast.consequenceScenariosUpdated',
            'Consequence scenarios updated by AI'
          )
        );
      }
    } catch (err) {
      // Nie oznaczamy karty jako `ai-draft` i nie wstawiamy szablonu — inaczej
      // użytkownik dostawał dziewięć zmyślonych zdań opisanych jako scenariusze AI.
      setCardState('consequences', 'error');
      if (!silent) {
        notifyAiFailure(
          t(
            'decisions.detail.toast.aiConsequenceScenariosFailed',
            'AI could not generate consequence scenarios'
          ),
          err
        );
      } else {
        console.error('[DecisionDetailView] AI consequence scenarios failed (silent)', err);
      }
    } finally {
      setIsGeneratingConsequenceScenarios(false);
    }
  };

  const displayedConsequenceScenarios = useMemo(
    () => consequenceScenarios || buildEmptyConsequenceScenarios(),
    [consequenceScenarios, i18n.language]
  );

  const updateConsequenceScenarioCell = (
    scenarioKey: 'optimistic' | 'neutral' | 'pessimistic',
    timelineKey: 'd7' | 'd30' | 'd90',
    value: string
  ) => {
    if (isDecisionStageLocked) return;
    setConsequenceScenarios((prev) => {
      const base = prev || buildEmptyConsequenceScenarios();
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

  // `getLinkedItemIndex` USUNIĘTY 2026-07-24 — jego jedynym zadaniem było
  // pokazać właścicielowi surowy identyfikator powiązania („link-2", „link-3")
  // obok tytułu. Sekcja „Dotyczy" renderuje dziś `RelatedItemsList`
  // (typ po polsku + tytuł), więc funkcja nie miała już wywołań.

  // Lokalny przycisk AI przy polu (menu Popraw/Skróć/Rozwiń/Formalnie) usunięty
  // 2026-07-23. Był to MARTWY KOD: `renderFieldAIButton` nie miał ani jednego
  // wywołania w drzewie renderu — wszystkie pola karty używają współdzielonego
  // `AIFieldEnhancer`. Trzymał przy tym dwie martwe ścieżki (`/ai/chat` i
  // `Api.chatConfirm` → `/ai/chat/confirm`, żadna nie zwraca tekstu) oraz
  // lokalny `fallbackRefineText`, w którym „Skróć" = `slice(0, 65%)`, czyli
  // ucięcie zdania użytkownika w połowie podane jako wynik AI.
  const createdDateDisplay = useMemo(() => {
    if (!createdAt) return '—';
    const d = new Date(createdAt);
    if (Number.isNaN(d.getTime())) return String(createdAt).split('T')[0] || String(createdAt);
    return d.toLocaleDateString(i18n.language === 'pl' ? 'pl-PL' : 'en-GB');
  }, [createdAt, i18n.language]);
  const statusAlertBorderClass =
    status === 'escalated' || status === 'rejected'
      ? 'border-danger-400/70 dark:border-danger-500/50'
      : status === 'pending' || status === 'deferred'
        ? 'border-amber-400/70 dark:border-amber-500/50'
        : status === 'approved'
          ? 'border-emerald-400/70 dark:border-emerald-500/50'
          : 'border-c-border/60';
  const priorityAlertBorderClass =
    priority === 'critical'
      ? 'border-danger-400/70 dark:border-danger-500/50'
      : priority === 'high'
        ? 'border-amber-400/70 dark:border-amber-500/50'
        : priority === 'medium'
          ? 'border-blue-400/70 dark:border-blue-500/50'
          : 'border-c-border/60';
  const dueDateAlertBorderClass = useMemo(() => {
    if (!dueDate) return 'border-c-border/60';
    if (status === 'approved' || status === 'rejected') return 'border-c-border/60';
    const due = new Date(dueDate);
    if (Number.isNaN(due.getTime())) return 'border-c-border/60';
    const now = new Date();
    const daysDiff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff < 0) return 'border-danger-400/70 dark:border-danger-500/50';
    if (daysDiff <= 3) return 'border-amber-400/70 dark:border-amber-500/50';
    return 'border-emerald-400/60 dark:border-emerald-500/40';
  }, [dueDate, status]);

  // Attachment handlers (mock)
  const handleUploadAttachments = async (files: FileList) => {
    if (isDecisionStageLocked) {
      toast.error(
        t('decisions.detail.toast.contentLocked', 'Content is locked during decision-making stage')
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
        t('decisions.detail.toast.contentLocked', 'Content is locked during decision-making stage')
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
    addActivityLogEntry('comment', t('decisions.detail.activityLog.commentAdded', 'Comment added'));
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
    return 'bg-c-text-muted';
  };

  const getCommentPriorityLabel = (priority: CommentPriorityLevel) => {
    if (priority === 'high') return t('decisions.detail.riskLevel.high', 'High');
    if (priority === 'low') return t('decisions.detail.riskLevel.low', 'Low');
    return t('decisions.detail.commentPriority.normal', 'Normal');
  };

  const getCommentPriorityHint = (priority: CommentPriorityLevel) => {
    if (priority === 'high') {
      return t(
        'decisions.detail.commentPriority.highHint',
        'Needs quick response and decision-maker attention.'
      );
    }
    if (priority === 'low') {
      return t(
        'decisions.detail.commentPriority.lowHint',
        'Informational note, no urgent action needed.'
      );
    }
    return t('decisions.detail.commentPriority.normalHint', 'Standard working-level comment.');
  };

  const getPriorityButtonClass = (priority: CommentPriorityLevel, isActive: boolean) => {
    if (isActive && priority === 'high') {
      return 'border-danger-400/80 text-danger-300 bg-danger-500/20 shadow-[0_0_0_1px_rgba(244,63,94,0.3)]';
    }
    if (isActive && priority === 'normal') {
      return 'border-indigo-400/70 text-indigo-300 bg-indigo-500/15 shadow-[0_0_0_1px_rgba(129,140,248,0.2)]';
    }
    if (isActive && priority === 'low') {
      return 'border-emerald-400/80 text-emerald-300 bg-emerald-500/20 shadow-[0_0_0_1px_rgba(16,185,129,0.3)]';
    }
    return 'border-c-border-subtle/55 dark:border-c-border/60 text-c-text-secondary dark:text-c-text-muted dark:text-c-text-secondary hover:border-c-border-strong/70 hover:text-c-text-secondary';
  };

  const enhanceCommentDraftWithAI = async () => {
    if (isDecisionStageLocked) return;
    setIsEnhancingCommentDraft(true);
    try {
      const prompt = t(
        'decisions.detail.ai.commentDraftPrompt',
        'Draft a concise and professional decision comment. Comment priority: {{priority}}. Decision title: "{{title}}". Description: "{{description}}". Current user draft: "{{draft}}". Return comment text only (no quotes, no list).',
        {
          priority: commentDraftPriority,
          title: title || '-',
          description: description || '-',
          draft: commentDraft || '-',
        }
      );
      const next = await requestAiText({
        message: prompt,
        systemInstruction: t(
          'decisions.detail.ai.pmConsultantSystemInstruction',
          'You are a PM consultant. Return a short comment ready to publish.'
        ),
        roleName: 'Comment Writing Assistant',
      });
      setCommentDraft(next);
      toast.success(t('decisions.detail.toast.aiCommentPrepared', 'AI prepared comment text'));
    } catch (err) {
      // Szkic użytkownika zostaje nietknięty — bez podmiany na zaszyte zdanie
      // i bez doklejania „warto doprecyzować właściciela i termin".
      notifyAiFailure(
        t('decisions.detail.toast.aiCommentDraftFailed', 'AI could not prepare comment text'),
        err
      );
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
      toast(t('decisions.detail.toast.linkAlreadyExists', 'This link already exists'), {
        icon: 'ℹ️',
      });
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
        t(
          'decisions.detail.toast.linkAddedSyncFailed',
          'Link added, but metadata sync failed. This is a sign that internal linking may be broken.'
        ),
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
  }, []);

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
      toast(t('decisions.detail.toast.noTargetLink', 'No target link available'), { icon: 'ℹ️' });
      return;
    }
    window.open(target, '_blank', 'noopener,noreferrer');
  };

  // ── Prawy panel artefaktu (SPEC-A) — 5 sekcji z realnych danych, konsolidacja ──
  // Kanon n-Type (ARTIFACT_PANEL_SECTION_ORDER): Akcje · Właściwości ·
  // Powiązania · [Źródła i założenia] · [Rezultaty] · Komentarze · Historia.
  // Decyzja nie ma dziś sekcji Źródła/Rezultaty — są POMINIĘTE (nie puste
  // ramki); obecne sekcje trzymają kanoniczną kolejność.
  // Wyłącznie odczyt istniejących stanów/handlerów; treść tokenami c-*.
  const dash = '—';
  // `fmtDateTime` usuniete 2026-07-21 — jego JEDYNYMI konsumentami byly skrocone
  // listy Komentarzy i Historii w tym panelu, zastapione pelnymi CommentsCanvas /
  // ActivityLogCanvas (SPEC-N §2.1). Oba komponenty formatuja daty same.
  // To nie jest sprzatanie legacy (fala po migracjach), tylko domkniecie wlasnej
  // zmiany: helper osierocil sie w tym samym commicie.
  const rpKeyClass = 'text-xs text-c-text-muted shrink-0';
  const rpPill =
    'inline-flex items-center h-5 px-2 rounded-md text-xs bg-c-surface-raised text-c-text';
  // `rpBtn` (przycisk panelu h-8, szerokość treści) usunięty 2026-07-23 —
  // jedynym konsumentem był „Deleguj" w sekcji Akcje, a n-Type §6.3 wymaga tam
  // przycisków PEŁNEJ szerokości (`rpActionNeutral` niżej). Helper osierocił się
  // w tym samym commicie, więc znika razem z nim, a nie „kiedyś przy sprzątaniu".
  const rpChipBtn =
    'inline-flex items-center gap-1.5 h-6 px-2 rounded-md text-xs font-medium bg-c-surface-raised text-c-text border border-c-border-subtle truncate hover:bg-c-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]';

  // ── Akcje decyzji w prawym panelu (n-Type §6.3 / 01_DECYZJA §2.2) ─────────
  // Decyzja ma ZŁOŻONY zestaw przejść workflow, więc reguła „jedna oczywista
  // akcja w nagłówku" jej nie dotyczy — nagłówek traci `primaryAction`, a
  // WSZYSTKIE działania (zatwierdzenie etapu, cofnięcie do draftu, zatwierdzenie
  // decyzji, odrzucenie, prośba o informacje, delegowanie) żyją TU.
  // Układ: pionowo, przyciski pełnej szerokości, JEDNA akcja wyróżniona.
  // Crimson (`primary-*`) świadomie nieużywany; `danger` = odrzucenie
  // (semantyka krytyczna), reszta neutralna `c-*`.
  const rpActionBtn =
    'w-full inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] disabled:opacity-50 disabled:cursor-not-allowed';
  /* karty-n-ok — po zdjęciu `primaryAction` z nagłówka to JEDYNY solid CTA karty
     (SPEC-N §2.3 dopuszcza dokładnie jeden; tu jego miejscem jest panel).
     ── 2026-07-24: ZIELEŃ ZDJĘTA Z CTA ────────────────────────────────────────
     BYŁO: `bg-emerald-600` + biały tekst = kontrast 4,35:1 — PONIŻEJ progu WCAG
     AA 4,5:1, zmierzone na żywym renderze. Do tego kolor na CTA łamie CLAUDE.md
     #3 („CTA/stany aktywne = neutralne; kolor tylko semantyka krytyczna"), a na
     6 kart-artefaktów tylko 2 robiły to na zielono — to był BRAK, nie konwencja.
     JEST: neutralny solid `bg-c-text`/`text-c-bg` — ten sam wzorzec, którym
     wyróżniają CTA pozostałe karty (por. NotificationDetailView). Kontrast
     17,6:1 w light i tyle samo w dark (tokeny odwracają się razem z motywem).
     Sukces zostaje semantyką STANU (badge etapu, pigułki), nie tła przycisku. */
  const rpActionPrimary = `${rpActionBtn} bg-c-text border-c-text text-c-bg hover:bg-c-text-secondary hover:border-c-text-secondary`;
  const rpActionDestructive = `${rpActionBtn} bg-transparent border-danger-400/60 text-danger-600 dark:text-danger-400 hover:bg-danger-500/10`;
  const rpActionNeutral = `${rpActionBtn} bg-c-surface-raised border-c-border-subtle text-c-text hover:bg-c-surface`;

  // Przejścia etapów pokazujemy tylko dla zapisanej decyzji (draft nie ma
  // workflow po stronie serwera). `workflowActions` liczy je z `workflowStatus`.
  const panelWorkflowActions = decisionId ? workflowActions : [];
  const canApproveDecision = Boolean(decisionId && isPending);
  // Dokładnie JEDNO wyróżnienie: zatwierdzenie decyzji ma pierwszeństwo przed
  // przejściem etapu „do przodu"; gdy decyzja nie czeka na werdykt — wyróżniamy
  // przejście do przodu (jedyne, które posuwa sprawę).
  const highlightedWorkflowActionId = canApproveDecision
    ? null
    : (panelWorkflowActions.find((a) => a.tone === 'success' || a.tone === 'primary')?.id ?? null);

  // Czy mountować `ArtifactApprovalStatusBar` — uzasadnienie przy samym slocie
  // `statusBar` niżej (sprzeczne stany w Podglądzie + zmyślony „Szkic").
  const showApprovalBar =
    isArtifactApprovalUiEnabled() &&
    Boolean(decisionId) &&
    !readMode &&
    workflowStatus === 'proposed';

  // ── Rozdział POWIĄZAŃ od ŹRÓDEŁ (n-Type §6.2 poz. 3 vs 4) ────────────────
  // Panel dostał sekcję „Źródła i założenia", więc powiązania wiedzowe (wnioski
  // z wywiadów, raporty, oceny, notatki/sesje) przestają być zwykłą listą
  // powiązań — to na nich decyzja się OPIERA. Rozdzielamy je RAZ, żeby ten sam
  // rekord nie pojawił się w dwóch sekcjach naraz.
  const relationLinkedItems = linkedItems.filter(
    (li) => !DECISION_SOURCE_LINK_TYPES.has(String(li.type))
  );
  const evidenceLinkedItems = linkedItems.filter((li) =>
    DECISION_SOURCE_LINK_TYPES.has(String(li.type))
  );

  const deciderUser = users.find((u) => u.id === deciderId);
  const deciderDisplayName =
    deciderName ||
    (deciderUser ? `${deciderUser.firstName} ${deciderUser.lastName}`.trim() : '') ||
    dash;

  const rightPanelSections: ArtifactRightPanelSection[] = [
    {
      id: 'actions',
      // #27/#37: AI przeniesiony do nagłówka (NModeHeader, showChatButton) —
      // header ma wolny slot obok Save/mode-switcher, więc rozpisany
      // przycisk AI w tej sekcji był zbędnym duplikatem (Z29/Z30 go tu
      // zostawiły tylko z braku slotu M3 dla klasy S; teraz jest taniej).
      // Save+Delegate dzielą teraz jeden rząd (był z AI pomiędzy nimi).
      //
      // SPEC-N §2.6 (anty-duplikacja): 2026-07-21 zdjety takze SAVE. Ten sam
      // handler (`handleSave`) renderowal sie tu ORAZ w naglowku
      // (`NModeHeader.onSave`), ktory dodatkowo pokazuje stan zapisu
      // ("Saved"/autosave przez `draftSavedLabel`). Zgodnie z zasada
      // rozstrzygajaca zostaje miejsce, ktore niesie wiecej informacji i jest
      // czescia powloki — naglowek; z panelu znika DUPLIKAT, nie funkcja.
      //
      // ── n-Type §6.3 / 01_DECYZJA §2.2 (2026-07-23) ──
      // Sekcja przejmuje WSZYSTKIE działania decyzji: zatwierdzenie decyzji,
      // przejścia etapu (wyślij do przeglądu / zatwierdź etap / opublikuj),
      // cofnięcia (do draftu, do przeglądu), odrzucenie, prośbę o informacje
      // i delegowanie. Nagłówek nie ma już `primaryAction`, a pasek karty
      // (NModeToolbar) nie ma już przejść ani overflow z Reject/Request info —
      // te same handlery renderowały się w 2-3 miejscach naraz.
      label: t('myWork.decisionDetail.label', 'Actions'),
      icon: Save,
      // Pusto TYLKO w trybie Podgląd („do pokazania klientowi") — w Edycji
      // zawsze zostaje co najmniej „Deleguj". Etap 4 gridu n-Type
      // (_GRID_STABILIZATION_COMMAND_2026-07-24.md): w Podglądzie sekcja jest
      // ZWINIĘTA z licznikiem 0, bez komunikatu opisowego (był tu tekst
      // „Actions are hidden in preview mode" — SSOT go zakazuje wprost).
      defaultOpen: !readMode,
      isEmpty: readMode,
      badge: readMode ? 0 : undefined,
      showZeroBadge: true,
      children: readMode ? null : (
        <div className="flex flex-col gap-2">
          {/* 1) DOKŁADNIE JEDNA akcja primary (SSOT §Hierarchia akcji): zatwierdzenie
                 decyzji ma pierwszeństwo; gdy karta nie czeka na werdykt, wyróżnione
                 jest jedyne przejście workflow „do przodu" (highlightedWorkflowActionId,
                 liczone wyżej). Zeszła TU z nagłówka (§2.2: decyzja ma zbyt złożony
                 zestaw przejść, by wskazywać jedno w powłoce). */}
          {canApproveDecision && (
            <CapabilityGate capability="decision.approve" gateMode="disable">
              <button type="button" onClick={handleApprove} className={rpActionPrimary}>
                <Check size={14} />
                {t('decisions.detail.actions.approveDecision', 'Approve decision')}
              </button>
            </CapabilityGate>
          )}
          {!canApproveDecision &&
            panelWorkflowActions
              .filter((action) => action.id === highlightedWorkflowActionId)
              .map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={action.onClick}
                  disabled={workflowActionLoading}
                  className={rpActionPrimary}
                >
                  {workflowActionLoading ? <Loader2 size={13} className="animate-spin" /> : null}
                  {action.label}
                </button>
              ))}

          {/* 2) Werdykt negatywny — jedyna akcja destrukcyjna (danger), zawsze
                 widoczna jako czerwony outline (SSOT: destrukcyjne NIE chowamy
                 w More, dostają odrębny, rozpoznawalny styl). */}
          {canApproveDecision && (
            <CapabilityGate capability="decision.approve" gateMode="disable">
              <button type="button" onClick={handleReject} className={rpActionDestructive}>
                <X size={14} />
                {t('decisions.detail.actions.reject', 'Reject')}
              </button>
            </CapabilityGate>
          )}

          {/* 3) GRID ETAP 5 (2026-07-24) — SSOT §Wymagania/Decyzja: „ograniczyć
                 liczbę widocznych akcji" + „jedna główna akcja, reszta w More".
                 Przejścia workflow spoza primary, „Więcej info", „Deleguj" i
                 „Udostępnij" zwinięte za jednym przełącznikiem zamiast stać
                 osobno — panel bez tego pokazywał do 6 przycisków naraz. */}
          {(() => {
            const secondaryWorkflowActions = panelWorkflowActions.filter(
              (action) => canApproveDecision || action.id !== highlightedWorkflowActionId
            );
            const moreCount =
              secondaryWorkflowActions.length +
              (canApproveDecision ? 1 : 0) + // Więcej info
              1 + // Deleguj
              (decisionId ? 1 : 0); // Udostępnij

            if (!showMoreDecisionActions) {
              if (moreCount === 0) return null;
              return (
                <button
                  type="button"
                  onClick={() => setShowMoreDecisionActions(true)}
                  className={`${rpActionNeutral} justify-between`}
                >
                  <span>{t('myWork.decisionDetail.moreActions', 'More')}</span>
                  <span className="inline-flex items-center gap-1 text-c-text-muted">
                    {moreCount}
                    <ChevronDown size={14} />
                  </span>
                </button>
              );
            }

            return (
              <>
                {secondaryWorkflowActions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={action.onClick}
                    disabled={workflowActionLoading}
                    className={rpActionNeutral}
                  >
                    {workflowActionLoading ? <Loader2 size={13} className="animate-spin" /> : null}
                    {action.label}
                  </button>
                ))}
                {canApproveDecision && (
                  <button type="button" onClick={handleRequestMoreInfo} className={rpActionNeutral}>
                    <HelpCircle size={14} className="text-c-text-muted" />
                    {t('decisions.detail.actions.requestInfo', 'Request info')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowDelegationModal(true)}
                  className={rpActionNeutral}
                >
                  <Share2 size={14} className="text-c-text-muted" />
                  {t('myWork.decisionDetail.delegate', 'Delegate')}
                </button>
                {decisionId && (
                  <div className="flex items-center justify-between h-8 px-3 rounded-lg border border-c-border-subtle bg-c-surface-raised">
                    <span className="text-xs text-c-text-muted">
                      {t('myWork.decisionDetail.share', 'Share')}
                    </span>
                    <ArtifactPermalinkButton
                      artifactType="decision"
                      artifactId={decisionId}
                      isPolish={isPolish}
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setShowMoreDecisionActions(false)}
                  className="inline-flex items-center justify-center gap-1 h-7 text-[11px] text-c-text-muted hover:text-c-text transition-colors"
                >
                  {t('myWork.decisionDetail.showLess', 'Show less')}
                  <ChevronDown size={12} className="rotate-180" />
                </button>
              </>
            );
          })()}
        </div>
      ),
    },
    {
      id: 'properties',
      label: t('myWork.decisionDetail.label2', 'Properties'),
      icon: Flag,
      defaultOpen: true,
      children: (
        <ArtifactPropertiesTable
          propertyLabel={t('myWork.decisionDetail.property', 'Property')}
          valueLabel={t('myWork.decisionDetail.value', 'Value')}
          rows={[
            {
              id: 'status',
              label: t('myWork.decisionDetail.status', 'Status'),
              value: (
                <span className={rpPill}>
                  {statusConfig.label[t('myWork.decisionDetail.en', 'en')]}
                </span>
              ),
            },
            {
              // §3.2 / 01_DECYZJA §8: etap workflow (Draft/Analiza/Rekomendacja/
              // Decyzja) NIE jest trzecim paskiem szkieletu — jego STAN czyta
              // się tu, we Właściwościach; przejścia żyją w sekcji Akcje.
              id: 'workflow',
              label: t('decisions.detail.workflow.label', 'Workflow'),
              value: (
                <span className={rpPill}>
                  {t(
                    `decisions.detail.workflowStage.${workflowStatus}`,
                    (WORKFLOW_STATUS_CONFIG[workflowStatus] || WORKFLOW_STATUS_CONFIG.proposed)
                      .label.en
                  )}
                </span>
              ),
            },
            {
              id: 'priority',
              label: t('myWork.decisionDetail.priority', 'Priority'),
              value: (
                <span className={rpPill}>
                  {priorityConfig.label[t('myWork.decisionDetail.en2', 'en')]}
                </span>
              ),
            },
            {
              id: 'dueDate',
              label: t('myWork.decisionDetail.dueDate', 'Due date'),
              value: dueDate || dash,
              mono: true,
            },
            {
              id: 'decider',
              label: t('myWork.decisionDetail.decider', 'Decider'),
              value: deciderDisplayName,
            },
          ]}
        />
      ),
    },
    {
      id: 'relations',
      label: t('myWork.decisionDetail.label3', 'Relations'),
      icon: Link2,
      // Kanon n-Type: domyslnie rozwiniete TYLKO Akcje i Wlasciwosci.
      defaultOpen: false,
      isEmpty:
        !initiativeName &&
        !(sourceType && sourceId) &&
        risks.length === 0 &&
        relationLinkedItems.length === 0,
      emptyLabel: t('myWork.decisionDetail.emptyLabel', 'No relations'),
      children: (
        <div className="flex flex-col gap-2">
          {initiativeName ? (
            <div className="flex items-center gap-2">
              <span className={rpKeyClass}>
                {t('myWork.decisionDetail.initiative', 'Initiative')}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (initiativeId) {
                    window.dispatchEvent(
                      new CustomEvent('mywork-open-item', {
                        detail: { type: 'initiative', id: initiativeId, name: initiativeName },
                      })
                    );
                  }
                }}
                className={rpChipBtn}
              >
                <Target size={12} className="text-c-text-muted shrink-0" />
                <span className="truncate">{initiativeName}</span>
              </button>
            </div>
          ) : null}
          {sourceType && sourceId ? (
            <div className="flex items-center gap-2">
              <span className={rpKeyClass}>{t('myWork.decisionDetail.source', 'Source')}</span>
              <button
                type="button"
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent('mywork-open-item', {
                      detail: {
                        type: sourceType === 'notebook' ? 'notebook' : sourceType,
                        id: sourceId,
                        name: `Source ${sourceType}`,
                        initialTool: sourceType === 'idea' ? 'mindmap' : undefined,
                      },
                    })
                  )
                }
                className={rpChipBtn}
              >
                <FileText size={12} className="text-c-text-muted shrink-0" />
                <span className="truncate">{sourceType}</span>
              </button>
            </div>
          ) : null}
          {risks.length > 0 ? (
            <button
              type="button"
              onClick={() => setActiveNotionSection('risk-impact')}
              className="flex items-center justify-between gap-3 hover:bg-c-surface-raised rounded-md px-1 -mx-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
            >
              <span className={rpKeyClass}>{t('myWork.decisionDetail.risks', 'Risks')}</span>
              <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full text-[11px] font-semibold tabular-nums text-c-text-muted bg-c-surface-raised">
                {risks.length}
              </span>
            </button>
          ) : null}
          {/* Powiązania NIE-źródłowe. Wnioski/raporty/oceny/notatki zjechały do
              sekcji „Źródła i założenia" (n-Type §6.2) — decyzja się na nich
              OPIERA, a nie tylko z nimi sąsiaduje. Rekord nie stoi w obu. */}
          {relationLinkedItems.slice(0, 5).map((li) => (
            <button
              key={`${li.type}:${li.id}`}
              type="button"
              onClick={() => openLinkedItemTarget(li)}
              className="flex items-center gap-2 text-left hover:bg-c-surface-raised rounded-md px-1 -mx-1 py-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
            >
              <Link2 size={12} className="text-c-text-muted shrink-0" />
              <span className="text-xs text-c-text truncate">{li.title}</span>
            </button>
          ))}
          {/* Załączniki: był tu sam LICZNIK, teraz jest imienna lista w sekcji
              „Źródła i założenia" (to dokumenty źródłowe, nie relacja). */}
        </div>
      ),
    },
    {
      // ── ④ Źródła i założenia (n-Type §6.2 / 01_DECYZJA §6.2) ───────────────
      // Sekcji NIE BYŁO — decyzja pokazywała czym jest i z czym się wiąże, ale
      // nie NA CZYM STOI. Zbiera cztery klasy wejść w jednym miejscu:
      //   · źródłowy artefakt (z czego decyzja powstała),
      //   · dokumenty źródłowe (załączniki — dotąd sam licznik w Powiązaniach),
      //   · sesje, notatki, wnioski, raporty i oceny (powiązania wiedzowe),
      //   · koperta dowodowa: cytaty, założenia (użytkownik / AI / Teresa /
      //     benchmark), pozycje do weryfikacji i poziom pewności.
      //
      // `isEmpty` CELOWO nieustawione: `EvidencePanelSection` dociąga kopertę
      // ASYNCHRONICZNIE i ma własny stan pusty, a `isEmpty` liczy się przy
      // budowie tablicy sekcji (przed odpowiedzią sieci) — ustawione tu
      // zjadłoby treść, która dopiero przyjdzie.
      id: 'evidence',
      label: t('myWork.decisionDetail.sourcesAndAssumptions', 'Sources & assumptions'),
      icon: BookOpen,
      defaultOpen: false,
      children: (
        <div className="flex flex-col gap-3">
          {sourceType && sourceId ? (
            <div className="flex items-center gap-2">
              <span className={rpKeyClass}>
                {t('myWork.decisionDetail.sourceArtifact', 'Source artifact')}
              </span>
              <button
                type="button"
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent('mywork-open-item', {
                      detail: {
                        type: sourceType === 'notebook' ? 'notebook' : sourceType,
                        id: sourceId,
                        name: `Source ${sourceType}`,
                        initialTool: sourceType === 'idea' ? 'mindmap' : undefined,
                      },
                    })
                  )
                }
                className={rpChipBtn}
              >
                <FileText size={12} className="text-c-text-muted shrink-0" />
                <span className="truncate">{sourceType}</span>
              </button>
            </div>
          ) : null}

          {attachments.length > 0 ? (
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <FileText size={12} className="text-c-text-muted" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
                  {t('myWork.decisionDetail.sourceDocuments', 'Source documents')}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {attachments.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      if (a.url) {
                        window.open(a.url, '_blank', 'noopener,noreferrer');
                        return;
                      }
                      // Załącznik bez URL (świeżo dodany, jeszcze nie wysłany) —
                      // otwieramy kartę, w której da się nim zarządzać. Kanoniczne
                      // `attachments` renderuje się w Decision pod id
                      // `resources-links` (patrz decisionCardContract.ts).
                      setActiveNotionSection('resources-links');
                    }}
                    className="flex items-center gap-2 text-left hover:bg-c-surface-raised rounded-md px-1 -mx-1 py-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
                  >
                    <FileText size={12} className="text-c-text-muted shrink-0" />
                    <span className="text-xs text-c-text truncate">{a.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {evidenceLinkedItems.length > 0 ? (
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Layers size={12} className="text-c-text-muted" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
                  {t('myWork.decisionDetail.sessionsAndNotes', 'Sessions, notes & findings')}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {evidenceLinkedItems.map((li) => (
                  <button
                    key={`${li.type}:${li.id}`}
                    type="button"
                    onClick={() => openLinkedItemTarget(li)}
                    className="flex items-center gap-2 text-left hover:bg-c-surface-raised rounded-md px-1 -mx-1 py-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
                  >
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase text-c-text-muted bg-c-surface-raised shrink-0">
                      {li.type}
                    </span>
                    <span className="text-xs text-c-text truncate">{li.title}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Cytaty i dowody, założenia (użytkownik / AI / Teresa / benchmark),
              „do weryfikacji" i poziom pewności — wspólny komponent standardu,
              ten sam, którego używa Insight. */}
          <EvidencePanelSection
            artifactType="decision"
            artifactId={decisionId || undefined}
            isPolish={isPolish}
          />
        </div>
      ),
    },
    {
      id: 'comments',
      label: t('myWork.decisionDetail.label4', 'Comments'),
      icon: MessageSquare,
      defaultOpen: false,
      badge: comments.length,
      // SPEC-N §2.1/§2.6: PELNA tresc komentarzy (CommentsCanvas) — ta sama
      // instancja, ktora do 2026-07-21 stala w centrum jako sekcja lewej
      // nawigacji. Tam byla dubletem tej listy; teraz jest tu jedynym miejscem.
      //
      // `isEmpty`/`emptyLabel` CELOWO zdjete: ArtifactRightPanel podmienia nimi
      // children w calosci, wiec przy zerowej liczbie komentarzy znikneloby
      // takze pole pisania — nie dalo by sie dodac PIERWSZEGO komentarza.
      // CommentsCanvas ma wlasny stan pusty, wiec nic sie nie gubi.
      children: (
        <div className="flex flex-col gap-2">
          {/* Wejscie AI do komentarzy — przeniesione z bespoke "Inline ActionBar",
              gdzie bylo pod warunkiem `activeNotionSection === 'comments'`; po
              zdjeciu tej sekcji z lewej nawigacji warunek nigdy by nie zaszedl,
              wiec funkcja zniknelaby uzytkownikowi (SPEC-N §2.6: znika duplikat,
              nie funkcja). Akcent AI = c-info/teal, nigdy czerwien. */}
          <button
            type="button"
            onClick={generateAIComment}
            disabled={isDecisionStageLocked || isGeneratingAIComment}
            className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border border-c-info/50 text-c-info bg-c-info/10 hover:bg-c-info/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
            title={t('decisions.detail.actions.generateCommentTitle', 'Generate AI comment')}
          >
            {isGeneratingAIComment ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Sparkles size={13} />
            )}
            {t('decisions.detail.actions.aiComments', 'AI comments')}
          </button>
          <CommentsCanvas
            comments={nModeComments}
            onDeleteComment={handleDeleteComment}
            dateFilter={commentDateFilter as DateFilter}
            onDateFilterChange={(f) => setCommentDateFilter(f as CommentDateFilter)}
            sortOrder={commentSortOrder as SortOrder}
            onToggleSort={() => setCommentSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
            commentDraft={commentDraft}
            onCommentDraftChange={setCommentDraft}
            onSubmitComment={() => void submitCommentDraft()}
            draftPriority={commentDraftPriority as CommentPriority}
            onDraftPriorityChange={(p) => setCommentDraftPriority(p as CommentPriorityLevel)}
            onAIEnhance={enhanceCommentDraftWithAI}
            isAIEnhancing={isEnhancingCommentDraft}
            locked={isDecisionStageLocked}
            getPriorityDotClass={(p) => getPriorityDotClass(p as CommentPriorityLevel)}
            getCommentPriority={(c) =>
              getCommentPriority(c as unknown as Comment) as CommentPriority
            }
            getPriorityButtonClass={(p, a) => getPriorityButtonClass(p as CommentPriorityLevel, a)}
            getCommentPriorityLabel={(p) => getCommentPriorityLabel(p as CommentPriorityLevel)}
            getCommentPriorityHint={(p) => getCommentPriorityHint(p as CommentPriorityLevel)}
          />
        </div>
      ),
    },
    {
      id: 'history',
      label: t('myWork.decisionDetail.label5', 'History'),
      icon: History,
      defaultOpen: false,
      badge: activityLogSorted.length,
      // SPEC-N §2.1/§2.6: PELNA tresc logu (ActivityLogCanvas) — do 2026-07-21
      // stala w centrum jako sekcja lewej nawigacji `activity-log`, a tutaj
      // dublowal ja skrot 8 pozycji. `isEmpty` zdjete dla symetrii z sekcja
      // Komentarzy — canvas ma wlasny stan pusty (statystyki + komunikat).
      children: (
        <ActivityLogCanvas
          entries={nModeActivityEntries}
          stats={nModeActivityStats}
          typeMeta={nModeActivityTypeMeta}
        />
      ),
    },
  ];

  // ── VF1-4 a11y: Esc = back/zamknij (kanon §12.3/§17) ─────────────────────
  // Skips when typing in a field or while a local dropdown/draft editor is
  // open (those own their close-affordance); keyboard-only, no visual change.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      if (
        editingStakeholderId ||
        editingReminderId ||
        editingEscalationId ||
        editingAlternativeId ||
        showInitiativeDropdown ||
        showStatusDropdown ||
        showPriorityDropdown ||
        showCategoryDropdown ||
        showDelegationModal ||
        showFollowUp
      ) {
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    onClose,
    editingStakeholderId,
    editingReminderId,
    editingEscalationId,
    editingAlternativeId,
    showInitiativeDropdown,
    showStatusDropdown,
    showPriorityDropdown,
    showCategoryDropdown,
    showDelegationModal,
    showFollowUp,
  ]);

  // ── ETAP 3 standardu n-Type: „Analizuj z AI" AKTYWNEJ KARTY ────────────────
  // Kryteria oceny Decyzji (kontrakt właściciela 2026-07-23) żyją w rubryce
  // silnika (`ARTIFACT_CRITERIA.decision`): jakość opcji i trade-offów · ryzyko ·
  // konsekwencje · gotowość do zatwierdzenia.
  const decisionAnalysisFields = useMemo<CardAnalysisField[]>(() => {
    switch (activeNotionSection) {
      case 'context-problem':
        return [
          {
            id: 'description',
            label: isPolish ? 'Opis decyzji' : 'Decision description',
            value: description,
            kind: 'text',
            writable: true,
          },
          {
            id: 'contextDetails',
            label: isPolish ? 'Kontekst' : 'Context',
            value: contextDetails,
            kind: 'text',
            writable: true,
          },
          {
            id: 'rationale',
            label: isPolish ? 'Uzasadnienie' : 'Rationale',
            value: rationale,
            kind: 'text',
            writable: true,
          },
        ];

      case 'options-tradeoffs':
        return [
          {
            id: 'alternatives',
            label: isPolish ? 'Opcje i trade-offy' : 'Options & trade-offs',
            value: alternatives
              .map(
                (a) =>
                  `- ${a.title}${a.description ? `: ${a.description}` : ''}` +
                  `${a.pros?.length ? `\n  + ${a.pros.join(' | ')}` : ''}` +
                  `${a.cons?.length ? `\n  − ${a.cons.join(' | ')}` : ''}` +
                  `${a.id === selectedAlternativeId ? `  <<< ${isPolish ? 'WYBRANA' : 'SELECTED'}` : ''}`
              )
              .join('\n'),
            kind: 'list',
            writable: true,
            hint: isPolish
              ? 'Format dopisania: „Tytuł: opis". Wyboru opcji AI NIE zmienia — to decyzja człowieka.'
              : 'Append format: "Title: description". AI does NOT change the selection — that is a human decision.',
          },
        ];

      case 'risk-impact':
        return [
          {
            id: 'risks',
            label: isPolish ? 'Ryzyka' : 'Risks',
            value: risks
              .map(
                (r) =>
                  `- ${r.title} (${isPolish ? 'prawdop.' : 'prob.'} ${r.probability}, ${isPolish ? 'skutek' : 'impact'} ${r.impact})${r.mitigation ? ` — ${isPolish ? 'mitygacja' : 'mitigation'}: ${r.mitigation}` : ''}`
              )
              .join('\n'),
            kind: 'list',
            writable: true,
          },
          {
            id: 'impactDescription',
            label: isPolish ? 'Opis wpływu' : 'Impact description',
            value: impact.description ?? '',
            kind: 'text',
            writable: true,
          },
        ];

      case 'consequences':
        return [
          {
            id: 'consequences-readonly',
            label: isPolish ? 'Konsekwencje braku decyzji' : 'Consequences of inaction',
            // Scenariusze to sztywna macierz 3 × (d7/d30/d90) budowana przez
            // `generateConsequenceScenariosAI`. Płaski tekst nie zmapuje się na
            // tę strukturę bez zgadywania, więc karta zostaje do odczytu —
            // AI może wskazać braki i sprzeczności, ale nie wpisze ich za nas.
            value: consequenceScenarios
              ? JSON.stringify(consequenceScenarios, null, 2)
              : isPolish
                ? '(scenariusze nie zostały wygenerowane)'
                : '(scenarios have not been generated)',
            kind: 'text',
            writable: false,
          },
        ];

      default:
        // governance-escalation (RACI = decyzja organizacyjna człowieka) oraz
        // resources-links (pliki i powiązania = fakty) — bez pól do zapisu.
        return [];
    }
  }, [
    activeNotionSection,
    isPolish,
    description,
    contextDetails,
    rationale,
    alternatives,
    selectedAlternativeId,
    risks,
    impact.description,
    consequenceScenarios,
  ]);

  const decisionWritableFieldIds = useMemo(
    () => decisionAnalysisFields.filter((f) => f.writable).map((f) => f.id),
    [decisionAnalysisFields]
  );

  const buildDecisionAnalysisInput = useCallback(() => {
    const ctx = [
      `${isPolish ? 'Status' : 'Status'}: ${status}`,
      // „gotowość do zatwierdzenia" bez etapu workflow byłaby zgadywaniem.
      `${isPolish ? 'Etap workflow' : 'Workflow stage'}: ${workflowStatus}`,
      `${isPolish ? 'Priorytet' : 'Priority'}: ${priority}`,
      `${isPolish ? 'Kategoria' : 'Category'}: ${category}`,
      dueDate ? `${isPolish ? 'Termin' : 'Due date'}: ${dueDate}` : '',
      deciderName ? `${isPolish ? 'Decydent' : 'Decider'}: ${deciderName}` : '',
      initiativeName ? `${isPolish ? 'Inicjatywa' : 'Initiative'}: ${initiativeName}` : '',
      `${isPolish ? 'Wpływ' : 'Impact'}: ${isPolish ? 'zakres' : 'scope'} ${impact.scope}, ${isPolish ? 'harmonogram' : 'schedule'} ${impact.schedule}, ${isPolish ? 'koszt' : 'cost'} ${impact.cost}, ${isPolish ? 'jakość' : 'quality'} ${impact.quality}`,
      activeNotionSection !== 'context-problem'
        ? `${isPolish ? 'Opis decyzji' : 'Decision description'}: ${description}`
        : '',
      activeNotionSection !== 'options-tradeoffs'
        ? `${isPolish ? 'Opcje' : 'Options'}: ${alternatives.map((a) => a.title).join('; ') || '—'}`
        : '',
      activeNotionSection !== 'risk-impact'
        ? `${isPolish ? 'Ryzyka' : 'Risks'}: ${risks.map((r) => r.title).join('; ') || '—'}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    return {
      artifactType: 'decision' as const,
      cardId: activeNotionSection,
      artifactTitle: title,
      artifactContext: ctx,
      fields: decisionAnalysisFields,
      isPolish,
    };
  }, [
    activeNotionSection,
    isPolish,
    title,
    status,
    workflowStatus,
    priority,
    category,
    dueDate,
    deciderName,
    initiativeName,
    impact,
    description,
    alternatives,
    risks,
    decisionAnalysisFields,
  ]);

  const applyDecisionAnalysisChange = useCallback(
    (change: CardAnalysisChange): boolean => {
      // Blokada etapu workflow jest NADRZĘDNA — ta sama bramka, co dla ręcznej
      // edycji. Panel oznaczy pozycję jako nieudaną zamiast po cichu nie zapisać.
      if (isDecisionStageLocked) return false;
      const newId = () => Math.random().toString(36).slice(2, 11);
      const linesOf = (text: string) =>
        String(text || '')
          .split('\n')
          .map((l) =>
            l
              .trim()
              .replace(/^(?:[-*•]\s+|\d+[.)]\s+)/, '')
              .trim()
          )
          .filter(Boolean);

      switch (change.fieldId) {
        case 'description':
          setDescription((prev) => mergeChangeValue(change, prev));
          markCardEdited('description');
          return true;

        case 'contextDetails':
          setContextDetails((prev) => mergeChangeValue(change, prev));
          return true;

        case 'rationale':
          setRationale((prev) => mergeChangeValue(change, prev));
          return true;

        case 'impactDescription':
          setImpact((prev) => ({
            ...prev,
            description: mergeChangeValue(change, prev.description ?? ''),
          }));
          return true;

        case 'risks': {
          const incoming = linesOf(change.proposedValue);
          if (incoming.length === 0) return false;
          const toRisk = (riskTitle: string): RiskItem => ({
            id: newId(),
            title: riskTitle,
            probability: 'medium',
            impact: 'medium',
            category: 'operational',
            mitigation: '',
            contingency: '',
          });
          setRisks((prev) =>
            change.mode === 'append' ? [...prev, ...incoming.map(toRisk)] : incoming.map(toRisk)
          );
          markCardEdited('risk');
          return true;
        }

        case 'alternatives': {
          // Tylko DOPISANIE opcji. „replace" świadomie odrzucone: przepisanie
          // listy skasowałoby `selectedAlternativeId`, czyli sam WYBÓR — a wybór
          // opcji jest decyzją człowieka, nie treścią do wygenerowania.
          const incoming = linesOf(change.proposedValue).filter((l) => !/^[+−-]\s/.test(l));
          if (incoming.length === 0) return false;
          const toAlt = (line: string): Alternative => {
            const [head, ...rest] = line.split(':');
            return {
              id: newId(),
              title: head.trim(),
              description: rest.join(':').trim(),
              pros: [],
              cons: [],
              isRecommended: false,
            };
          };
          setAlternatives((prev) => [...prev, ...incoming.map(toAlt)]);
          markCardEdited('alternatives');
          return true;
        }

        default:
          return false;
      }
    },
    [isDecisionStageLocked, markCardEdited]
  );

  const decisionCardAnalysis = useCardAIAnalysis({
    activeCardId: activeNotionSection,
    buildInput: buildDecisionAnalysisInput,
    applyChange: applyDecisionAnalysisChange,
  });

  // ── Loading guard (AFTER all hooks to respect Rules of Hooks) ────────────
  // VF1-4 (SPEC-A): swap ad-hoc spinner for the shared shared/states library
  // (record archetype) — gated (visible change, needs Piotr's screenshot
  // sign-off per reguła #7).
  if (loading) {
    if (VF1_DECISION_SPECA) {
      return (
        <div className="flex h-full items-center justify-center bg-c-bg p-8">
          <div className="w-full max-w-xl">
            <SkeletonState variant="record" />
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center h-full bg-c-surface">
        <LoadingState variant="spinner" />
      </div>
    );
  }

  // ── Zasilenie NModeToolbar (SPEC-N §2.4) ─────────────────────────────────
  // Zwykle stale, NIE hooki — jestesmy PO wczesnym `return` bramki ladowania,
  // wiec `useMemo` lamalby tu Rules of Hooks.
  //
  // Kontekst: do 2026-07-21 karta miala wlasny "Inline ActionBar" z komentarzem
  // "kept for now, will migrate to NModeActionBar" (dlug nigdy nie splacony).
  // SPEC-N §2.4 mowi wprost: jedna droga budowy toolbara — `NModeToolbar`.
  // Mapowanie bespoke → sloty komponentu:
  //   badge etapu workflow      → sectionsDropdown (lewa grupa)
  //   przejscia workflow        → newButton        (lewa grupa)
  //   kontekstowe AI sekcji     → aiSectionButton
  //   Reject / Request info     → overflowActions  (drugorzedne, §2.4)
  //
  // ETAP 1.2 (2026-07-23): `activeSectionLabel` USUNIETA — nazwa aktywnej karty
  // dublowala lewa nawigacje i nie nalezy do zadnej z trzech stref menu 2.

  // Kontraktowy przycisk AI aktywnej sekcji (§2.5). Sekcja z `{kind:'none'}`
  // nie dostaje przycisku — dlatego mapa kontraktu jest realnym mechanizmem,
  // a nie deklaracja do czytania.
  const aiSectionSpec = decisionAiContract[activeNotionSection];
  const aiSectionButton = (() => {
    if (!aiSectionSpec || aiSectionSpec.kind !== 'ai') return undefined;
    const cfg = {
      options: {
        onClick: generateAlternativesAI,
        busy: isGeneratingAlternatives,
        label: t('decisions.detail.actions.generateOptions', 'Generate options'),
        title: t('decisions.detail.actions.generateOptionsTitle', 'Generate options with AI'),
      },
      risk: {
        onClick: generateRisksAI,
        busy: isGeneratingRisks,
        label: t('decisions.detail.actions.analyzeRisks', 'Analyze risks'),
        title: t('decisions.detail.actions.analyzeRisksTitle', 'Analyze risks with AI'),
      },
      consequences: {
        onClick: () => generateConsequenceScenariosAI(),
        busy: isGeneratingConsequenceScenarios,
        label: t('decisions.detail.actions.analyzeConsequences', 'Analyze consequences'),
        title: t(
          'decisions.detail.actions.analyzeConsequencesTitle',
          'Run AI consequence analysis'
        ),
      },
      raci: {
        onClick: suggestStakeholdersAI,
        busy: isSuggestingStakeholders,
        label: t('decisions.detail.actions.generateRaci', 'Generate RACI'),
        title: t('decisions.detail.actions.generateRaciTitle', 'Generate RACI with AI'),
      },
      // `comment` po §2.1 nie moze byc aktywna sekcja lewej nawigacji — wpis
      // zostaje dla kompletnosci mapy; przycisk AI komentarzy zyje w panelu.
      comment: {
        onClick: generateAIComment,
        busy: isGeneratingAIComment,
        label: t('decisions.detail.actions.aiComments', 'AI comments'),
        title: t('decisions.detail.actions.generateCommentTitle', 'Generate AI comment'),
      },
    }[aiSectionSpec.handler];
    return (
      <button
        type="button"
        onClick={cfg.onClick}
        disabled={isDecisionStageLocked || cfg.busy}
        title={cfg.title}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border border-c-info/50 text-c-info bg-c-info/10 hover:bg-c-info/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
      >
        {cfg.busy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
        {cfg.label}
      </button>
    );
  })();

  // Akcje drugorzedne pod "…" — komponent renderuje trigger i menu sam
  // (§2.4); karta NIE pisze wlasnego "...".
  //
  // 2026-07-23 (n-Type §6.3): Reject i Request info ZNIKŁY stąd — razem z
  // "Approve decision" z nagłówka i przejściami etapu ze slotu `newButton`
  // tworzyły trzy różne miejsca na jeden zestaw działań. Wszystkie żyją teraz
  // w sekcji AKCJE prawego panelu. Overflow zostaje dla akcji NIE-workflow.
  const toolbarOverflowActions: NModeToolbarAction[] = [];
  if (activeNotionSection === 'options-tradeoffs') {
    // Druga akcja AI tej samej sekcji ("omow opcje z Teresa"). Slot
    // `aiSectionButton` jest JEDEN, wiec zamiast dokladac drugi przycisk obok
    // (plaski wysyp — DOKTRYNA_GESTOSCI) ladzie ja w overflow. Funkcja zostaje.
    toolbarOverflowActions.push({
      label: t('decisions.detail.actions.analyzeOptions', 'Analyze options'),
      icon: Sparkles,
      onClick: handleAnalyzeOptionsWithAI,
      disabled: isDecisionStageLocked,
    });
  }

  return (
    // Z34-parity (Task fix 246ad9e5f9): N-mode root must scroll internally
    // (h-full overflow-y-auto), not via document scroll (min-h-screen) —
    // the parent shell renders this inside an overflow-hidden container so
    // min-h-screen content below the fold was unreachable.
    <div className="h-full overflow-y-auto bg-gradient-to-br from-c-surface via-c-surface to-c-surface dark:from-c-bg dark:to-c-bg">
      {/* GEOMETRIA CHROMU (2026-07-24): `pt-4` zamiast `pt-6` — ten sam odstęp
          od góry co w powłoce `NModeShell` (:153), której trzymają się Wniosek
          i Narzędzie. Zmierzone na renderze: Menu 1 stało na 24 px w Decyzji /
          Zadaniu / Powiadomieniu i na 16 px w pozostałych trzech kartach.
          Boki (`px-6`) i dół (`pb-6`) bez zmian. */}
      <div className="px-6 pt-4 pb-6">
        {/* GRID ETAP 6 (2026-07-24, naprawa P0-2): `max-w-6xl` (1152px stałe)
            zamrażał centrum na ~592px i zostawiał martwe marginesy na 1920px.
            Wzorzec z Zadania (TaskDetailView.tsx:5306-5311) — token
            `--ntype-content-document-max-width` zamiast stałej. */}
        <div
          className="mx-auto xl:flex xl:gap-6 xl:items-start space-y-0"
          style={{
            maxWidth:
              'calc(var(--ntype-left-panel-width) + var(--ntype-column-gap) + var(--ntype-content-document-max-width) + var(--ntype-column-gap) + var(--ntype-right-panel-width))',
          }}
        >
          <div className="xl:flex-1 xl:min-w-0 space-y-0">
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
              showChatButton
              onClose={onClose}
              lastSavedLabel={draftSavedLabel || undefined}
              statusLabel={statusConfig.label[isPolish ? 'pl' : 'en']}
              statusTone={STATUS_TONE[status] || 'neutral'}
              presentationMode={presentationMode}
              onPresentationModeChange={setPresentationMode}
              // ETAP 1.1 n-Type: karta N ma JEDEN widok — bez przełącznika N/C.
              showModeSwitcher={false}
              buildArtifactCode={buildArtifactCode}
              /* n-Type §6.3 / 01_DECYZJA §2.2 (2026-07-23): `primaryAction`
                 CELOWO nieustawiony. Reguła „jedna oczywista akcja w nagłówku"
                 zakłada artefakt o jednym przejściu do przodu; decyzja ma ich
                 kilka naraz (etap workflow × werdykt), więc wskazanie jednego w
                 powłoce kłamało o modelu. Wszystkie działania — zatwierdzenie
                 etapu, cofnięcie, zatwierdzenie decyzji, odrzucenie, prośba o
                 informacje, delegowanie — żyją w sekcji AKCJE prawego panelu
                 (`rightPanelSections[0]`), pionowo i bez duplikatów. */
            />

            {/* M02-005: this legacy view is now reachable ONLY via the
                m05DecisionWorkspaceFlag kill-switch (default ON routes to the
                real-backend DecisionWorkspace instead — see MyWorkHub.tsx).
                Comments / alternatives / risks / rationale / notes edited
                here persist to `localStorage['consultify-decision-enhancements:
                <id>']` only (see loadDecision's "Hydrate local enhancements"
                block above) — never to the server, never shared with
                teammates, and gone if this browser's storage is cleared.
                Nothing before this fix said so; a user could reasonably
                believe a posted comment was saved for the team. Neutral
                tokens only (CANON: crimson is reserved for critical
                semantics) — this is an honest capability notice, not an
                error. */}
            <div
              role="status"
              className="mb-3 flex items-start gap-2 rounded-md border border-c-border bg-c-surface-2 px-3 py-2.5 text-xs text-c-text-muted"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                {t(
                  'decisions.detail.legacyLocalOnlyNotice',
                  'Legacy view: comments, alternatives, risks and notes on this screen are saved only in this browser, not on the server or shared with your team.'
                )}
              </span>
            </div>

            {!decisionId && (
              <div className="mb-3 rounded-md border border-c-border bg-c-surface px-3 py-3">
                <RequiredProjectPicker
                  value={decisionProjectId}
                  onChange={setDecisionProjectId}
                  disabled={saving}
                  language={isPolish ? 'pl' : 'en'}
                />
              </div>
            )}

            {/* ═══════════ N MODE (page-first, 2-pane) ═════════════════════════
               Layout per docs/ui-standards/01-shell-layout/presentation-modes.md §2.5:
               - PropertiesStrip (full-width, under header)
               - 2-pane: LeftNav (fixed ~242px) | Canvas (selected section only)
               Left nav click → shows ONE section at a time (no scroll-all).
               ═══════════════════════════════════════════════════════════════════ */}
            {presentationMode === 'n' && (
              <div className="col-span-full space-y-4 pt-4">
                {/* RYTM PIONOWY (2026-07-24): `pt-4` = 16 px między Menu 1 a Menu 2 —
                    tyle, ile daje powłoka `NModeShell` (mt-2 na pasku + py-2 w środku)
                    Wnioskowi i Narzędziu. `mt-*` tu NIE DZIAŁA: rodzic ma `space-y-0`,
                    które nadpisuje margin-top dzieci (wyższa specyficzność selektora
                    `.space-y-0 > * ~ *`). Dlatego padding, nie margines. */}
                {/* ── MENU 2 (ETAP 1.2 standardu n-Type) ─────────────────────
                    Wspólny `NModeMenu2`: Sekcje po lewej · Edycja|Podgląd
                    w dokładnym środku geometrycznym · Analizuj z AI (fiolet)
                    skrajnie po prawej. „+ Nowa karta" zdjęte — karty są
                    predefiniowane, widocznością steruje Sekcje.

                    UWAGA (kontrakt właściciela pkt 6): pasek workflow
                    (Draft/Analiza/Rekomendacja/Decyzja) NIE zastępuje menu 2.
                    Żyje osobno, NIŻEJ, jako własny komponent karty. */}
                <NModeMenu2
                  isPolish={isPolish}
                  sectionsMenu={
                    <SectionsManagerMenu layout={decisionCardLayout} isPolish={isPolish} />
                  }
                  readMode={readMode}
                  onReadModeChange={setReadMode}
                  aiButton={
                    // ETAP 3: przycisk ANALIZUJE aktywną kartę i otwiera panel
                    // wyników. Było: `handleOpenChat` — ogólny czat, bez oceny
                    // karty i bez propozycji zmian do zatwierdzenia.
                    <Menu2AIButton
                      isPolish={isPolish}
                      busy={decisionCardAnalysis.loading}
                      aria-expanded={decisionCardAnalysis.open}
                      onClick={decisionCardAnalysis.run}
                    />
                  }
                />
                {/* ── Origin Badge ──────────────────────────────────── */}
                {sourceType && sourceId && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200/50 dark:border-amber-800/30 text-xs">
                    {sourceType === 'idea' && <Lightbulb size={14} className="text-amber-500" />}
                    {sourceType === 'notebook' && <FileText size={14} className="text-blue-500" />}
                    {sourceType === 'task' && (
                      <Settings size={14} className="text-c-text-secondary" />
                    )}
                    <span className="text-c-text-secondary">
                      {sourceType === 'idea'
                        ? t('decisions.detail.source.createdFromIdea', 'Created from Idea')
                        : sourceType === 'notebook'
                          ? t('decisions.detail.source.createdFromNote', 'Created from Note')
                          : `Created from ${sourceType}`}
                    </span>
                    <button
                      onClick={() => {
                        window.dispatchEvent(
                          new CustomEvent('mywork-open-item', {
                            detail: {
                              type: sourceType === 'notebook' ? 'notebook' : sourceType,
                              id: sourceId,
                              name: `Source ${sourceType}`,
                              initialTool: sourceType === 'idea' ? 'mindmap' : undefined,
                            },
                          })
                        );
                      }}
                      className="text-amber-600 dark:text-amber-400 hover:underline font-medium"
                    >
                      {sourceType === 'idea'
                        ? t(
                            'decisions.detail.source.viewSourceInMindmap',
                            'View source in mindmap →'
                          )
                        : t('decisions.detail.source.viewSource', 'View source →')}
                    </button>
                  </div>
                )}

                {/* ── Toolbar karty (SPEC-N §2.4: jedna droga budowy) ──────
                    Bylo: bespoke "Inline ActionBar" z komentarzem "kept for now,
                    will migrate to NModeActionBar" — migracja nigdy nie doszla do
                    skutku, wiec Decision byl jedna z kart budujacych pasek recznie
                    z <div>. Teraz pasek stawia `NModeToolbar`; karta deklaruje
                    tylko TRESC slotow, a komponent narzuca uklad, gestosc i overflow.
                    Read mode ("do pokazania klientowi"): caly pasek akcji znika.

                    2026-07-23 (§3.2 / 01_DECYZJA §8): pasek NIE jest trzecim
                    paskiem szkieletu. Stan workflow czyta się ze Statusu
                    (Właściwości) a przejścia z sekcji Akcje — wcześniejszy
                    BADGE etapu w tym pasku dublował Status i tworzył pełną,
                    pustą-poza-badgem trzecią belkę pod menu 2 (zgłoszenie
                    właściciela). Dlatego `sectionsDropdown` (badge workflow)
                    ZDJĘTY, a pasek renderuje się WYŁĄCZNIE gdy niesie realną
                    treść karty (kontekstowe AI sekcji lub akcje overflow).
                    Gdy jej nie ma — brak belki, nie pusta ramka. */}
                {!readMode && (aiSectionButton || toolbarOverflowActions.length > 0) && (
                  <div className="px-3 py-2 rounded-xl border border-c-border-subtle bg-c-surface">
                    <NModeToolbar
                      isPolish={isPolish}
                      /* ETAP 1.2 (menu2): `activeSectionLabel` ZDJĘTA — nazwa
                         aktywnej karty dublowała lewą nawigację. */
                      aiSectionButton={aiSectionButton}
                      overflowActions={
                        toolbarOverflowActions.length > 0 ? toolbarOverflowActions : undefined
                      }
                      overflowLabel={t('decisions.detail.toolbar.moreActions', 'More actions')}
                      visibleActionCount={aiSectionButton ? 1 : 0}
                      /* `newButton`/`sectionsDropdown` (przejścia + badge etapu
                         workflow) CELOWO puste — workflow żyje w Statusie
                         (Właściwości) i w sekcji Akcje prawego panelu (§3.2). */
                    />
                  </div>
                )}

                {/* ── 2-Pane: LeftNav + Canvas — shared NModeLeftNav ───────── */}
                <div className="flex gap-0 min-h-[60vh]">
                  <NModeLeftNav
                    sections={orderedNotionSections as NModeSection[]}
                    activeSection={activeNotionSection}
                    onSectionChange={setActiveNotionSection}
                    onSectionReorder={(ids) => decisionCardLayout.reorderByIds(ids)}
                    /* SPEC-A §4.4: w trybie Podgląd uchwyty przeciągania (GripVertical)
                       są ukryte — nawigacja jest do czytania, nie do przestawiania. */
                    readMode={readMode}
                  />

                  {/* Canvas (shows selected section only). Bez pl-* — odstęp
                      lewy panel ↔ centrum (24px) niesie wyłącznie NModeLeftNav
                      przez token --ntype-column-gap. Ta karta ma własną kopię
                      kanwy (nie NModeCanvas), więc duplikat pl-6 trzeba było zdjąć
                      tu osobno, inaczej odstęp podwajał się do 48px (SSOT:
                      _GRID_STABILIZATION_COMMAND_2026-07-24). */}
                  <div
                    className="flex-1 pt-1 min-w-0"
                    style={{ maxWidth: 'var(--ntype-content-document-max-width)' }}
                  >
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
                          <NModeCardState
                            state={isGeneratingDescription ? 'generating' : cardStates.description}
                            sectionName={{ en: 'Decision Scope', pl: 'Zakres decyzji' }}
                            aiGenerated={
                              cardStates.description === 'ai-draft' ||
                              cardStates.description === 'edited'
                            }
                            hideActions={isDecisionStageLocked}
                            /* Podgląd = widok dla klienta: badge stanu redakcyjnego znika.
                               Edycja bez zmian (badge zależy tylko od readMode, nie od blokady etapu). */
                            hideBadge={readMode}
                            onRegenerate={generateDescriptionAI}
                            onEdit={() => setCardState('description', 'edited')}
                            onAccept={() => setCardState('description', 'done')}
                            onGenerate={generateDescriptionAI}
                            onFillManually={() => setCardState('description', 'edited')}
                            onRetry={generateDescriptionAI}
                          >
                            <div className="space-y-6">
                              {/* Był tu drugi, RĘCZNIE zrobiony przycisk AI opisu,
                                  schowany pod `className="hidden"` — nigdy nie
                                  widoczny, w kolorze teal (n-Type §4.6 wymaga
                                  jednego tokenu `c-ai`) i poza wspólnym menu
                                  operacji. Usunięty 2026-07-23; funkcję niesie
                                  `AIFieldEnhancer` w prawym górnym rogu pola,
                                  a `generateDescriptionAI` żyje dalej w
                                  `NModeCardState` (onGenerate/onRegenerate/onRetry). */}

                              {/* 1) Related item from linked records */}
                              <div className="space-y-2">
                                <label className="text-[11px] uppercase tracking-wide text-c-text-secondary dark:text-c-text-muted dark:text-c-text-secondary">
                                  {t('decisions.detail.scope.relatedTo', 'Related to')}
                                </label>
                                {relatedDecisionItems.length === 0 ? (
                                  <div className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border border-amber-400/60 text-amber-600 dark:text-amber-300 bg-amber-500/10">
                                    {t('decisions.detail.scope.noLinkedItem', 'No linked item')}
                                  </div>
                                ) : (
                                  <RelatedItemsList items={relatedDecisionItems} />
                                )}
                              </div>

                              {/* 2) Decision scope
                                  n-Type §6.2/§6.3: auto-fit zamiast pary
                                  „stały `rows` + Pokaż więcej/mniej + gradient".
                                  Tamta para UKRYWAŁA treść (gradient nakładał się
                                  na ostatnie linie), a standard wymaga, by cała
                                  treść była widoczna bez wewnętrznego scrolla. */}
                              <AutoFitTextarea
                                value={description}
                                onValueChange={(v) => {
                                  setDescription(v);
                                  markCardEdited('description');
                                }}
                                previewMode={isDecisionStageLocked}
                                minRows={6}
                                containerClassName="space-y-2"
                                label={
                                  <span className="text-[11px] uppercase tracking-wide text-c-text-secondary dark:text-c-text-muted dark:text-c-text-secondary">
                                    {t(
                                      'decisions.detail.scope.decisionScopeLabel',
                                      'Decision scope'
                                    )}
                                  </span>
                                }
                                aiSlot={
                                  <AIFieldEnhancer
                                    fieldKey="n-description"
                                    sectionLabel="Decision Scope"
                                    currentValue={description}
                                    onApply={setDescription}
                                    artifactContext={{ title, status, priority, type: 'decision' }}
                                    disabled={isDecisionStageLocked}
                                  />
                                }
                                autoFitLabel={t(
                                  'decisions.detail.field.backToAutoFit',
                                  'Back to auto-fit'
                                )}
                                className="w-full px-0 py-2 bg-transparent text-sm leading-relaxed text-c-text-secondary focus:outline-none placeholder-c-text-muted"
                                editClassName="border-b border-c-border-subtle/40 focus:border-c-focus-solid focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] transition-colors"
                                placeholder={t(
                                  'decisions.detail.scope.descriptionPlaceholder',
                                  'Describe the decision scope (what exactly is being decided)...'
                                )}
                              />

                              {/* 3) Additional context */}
                              <AutoFitTextarea
                                value={contextDetails}
                                onValueChange={setContextDetails}
                                previewMode={isDecisionStageLocked}
                                minRows={5}
                                containerClassName="space-y-2"
                                label={
                                  <span className="text-[11px] uppercase tracking-wide text-c-text-secondary dark:text-c-text-muted dark:text-c-text-secondary">
                                    {t(
                                      'decisions.detail.scope.additionalContext',
                                      'Additional context'
                                    )}
                                  </span>
                                }
                                aiSlot={
                                  <AIFieldEnhancer
                                    fieldKey="n-context"
                                    sectionLabel="Additional Context"
                                    currentValue={contextDetails}
                                    onApply={setContextDetails}
                                    artifactContext={{ title, status, priority, type: 'decision' }}
                                    disabled={isDecisionStageLocked}
                                  />
                                }
                                autoFitLabel={t(
                                  'decisions.detail.field.backToAutoFit',
                                  'Back to auto-fit'
                                )}
                                className="w-full px-0 py-2 bg-transparent text-sm leading-relaxed text-c-text-secondary focus:outline-none placeholder-c-text-muted"
                                editClassName="border-b border-c-border-subtle/40 focus:border-c-focus-solid focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] transition-colors"
                                placeholder={t(
                                  'decisions.detail.scope.contextPlaceholder',
                                  'Additional explanation, assumptions, constraints (optional)...'
                                )}
                              />
                            </div>
                          </NModeCardState>
                        )}

                        {/* ── Section: Options & Trade-offs (InlineTable) ─ */}
                        {activeNotionSection === 'options-tradeoffs' && (
                          <NModeCardState
                            state={
                              isGeneratingAlternatives
                                ? 'generating'
                                : alternatives.length === 0 && cardStates.alternatives === 'empty'
                                  ? 'empty'
                                  : cardStates.alternatives === 'empty'
                                    ? 'edited'
                                    : cardStates.alternatives
                            }
                            sectionName={{ en: 'Options & Trade-offs', pl: 'Opcje i trade-offy' }}
                            aiGenerated={
                              cardStates.alternatives === 'ai-draft' ||
                              cardStates.alternatives === 'edited'
                            }
                            hideActions={isDecisionStageLocked}
                            /* Podgląd = widok dla klienta: badge stanu redakcyjnego znika.
                               Edycja bez zmian (badge zależy tylko od readMode, nie od blokady etapu). */
                            hideBadge={readMode}
                            onRegenerate={generateAlternativesAI}
                            onEdit={() => setCardState('alternatives', 'edited')}
                            onAccept={() => setCardState('alternatives', 'done')}
                            onGenerate={generateAlternativesAI}
                            onFillManually={() => {
                              setCardState('alternatives', 'edited');
                              addAlternative();
                            }}
                            onRetry={generateAlternativesAI}
                          >
                            <div className="space-y-5">
                              {alternatives.length === 0 ? (
                                /* EmptyStateInline */
                                <div className="py-10 text-center">
                                  <Lightbulb size={28} className="mx-auto mb-3 text-c-text-muted" />
                                  <p className="text-sm text-c-text-secondary dark:text-c-text-muted dark:text-c-text-secondary mb-3">
                                    {t(
                                      'decisions.detail.options.noOptions',
                                      'No options defined yet.'
                                    )}
                                  </p>
                                  <button
                                    onClick={addAlternative}
                                    className="text-xs font-medium text-c-text-secondary hover:text-c-text transition-colors"
                                  >
                                    + {t('decisions.detail.options.addOption', 'Add option')}
                                  </button>
                                </div>
                              ) : (
                                /* InlineTable — flat comparison */
                                <div className="space-y-0 divide-y divide-c-border-subtle/55 dark:divide-c-border-subtle/65">
                                  {alternatives.map((alt) => (
                                    <div
                                      key={alt.id}
                                      className={`py-5 first:pt-1 group ${alt.isRecommended ? 'relative' : ''}`}
                                    >
                                      {alt.isRecommended && (
                                        <span
                                          className="absolute -left-4 top-5 w-1.5 h-1.5 rounded-full bg-emerald-500"
                                          title={t(
                                            'decisions.detail.options.recommended',
                                            'Recommended'
                                          )}
                                        />
                                      )}
                                      <div className="flex items-start justify-between gap-3 mb-2">
                                        <div className="flex-1 min-w-0">
                                          <input
                                            value={alt.title}
                                            onChange={(e) =>
                                              updateAlternative(alt.id, { title: e.target.value })
                                            }
                                            className="w-full text-sm font-medium bg-transparent text-c-text dark:text-white focus:outline-none placeholder-c-text-muted"
                                            placeholder={t(
                                              'decisions.detail.options.namePlaceholder',
                                              'Option name...'
                                            )}
                                          />
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                          {!alt.isRecommended && (
                                            <button
                                              onClick={() => setRecommendedAlternative(alt.id)}
                                              className="p-1 text-c-text-secondary dark:text-c-text-muted hover:text-emerald-500 transition-colors"
                                              title={t(
                                                'decisions.detail.options.setRecommended',
                                                'Set recommended'
                                              )}
                                            >
                                              <Star size={13} />
                                            </button>
                                          )}
                                          <button
                                            onClick={() => removeAlternative(alt.id)}
                                            className="p-1 text-c-text-secondary dark:text-c-text-muted hover:text-danger-500 transition-colors"
                                          >
                                            <Trash2 size={13} />
                                          </button>
                                        </div>
                                      </div>
                                      {/* n-Type §6.2: AI wędruje SPOD pola do jego
                                          PRAWEGO GÓRNEGO ROGU — jedna pozycja we
                                          wszystkich polach karty. Pole dostaje
                                          auto-fit i uchwyt (było `resize-none`
                                          + `rows=2`, czyli opis ucinany bez
                                          jakiegokolwiek sposobu na podejrzenie). */}
                                      <AutoFitTextarea
                                        value={alt.description || ''}
                                        onValueChange={(v) =>
                                          updateAlternative(alt.id, { description: v })
                                        }
                                        previewMode={isDecisionStageLocked}
                                        minRows={2}
                                        autoFitLabel={t(
                                          'decisions.detail.field.backToAutoFit',
                                          'Back to auto-fit'
                                        )}
                                        className="w-full text-xs bg-transparent text-c-text-secondary dark:text-c-text-muted focus:outline-none placeholder-c-text-muted leading-relaxed"
                                        editClassName="focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] transition-colors"
                                        placeholder={t(
                                          'decisions.detail.options.descriptionPlaceholder',
                                          'Description...'
                                        )}
                                        aiSlot={
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
                                        }
                                      />
                                      {/* Inline pros/cons */}
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 text-[11px]">
                                        <div className="space-y-1.5">
                                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                            + {alt.pros?.length || 0}{' '}
                                            {t('decisions.detail.options.prosLabel', 'pros')}
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
                                                className="flex-1 text-[11px] bg-transparent border-b border-emerald-400/20 text-c-text-secondary focus:outline-none focus:border-emerald-400"
                                                placeholder={t(
                                                  'decisions.detail.options.proArgumentPlaceholder',
                                                  'Pro argument...'
                                                )}
                                              />
                                              <button
                                                onClick={() => removeAlternativePro(alt.id, idx)}
                                                className="p-0.5 text-c-text-secondary dark:text-c-text-muted hover:text-danger-500 transition-colors"
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
                                                  addAlternativePro(
                                                    alt.id,
                                                    altProsDraft[alt.id] || ''
                                                  );
                                                }
                                              }}
                                              className="flex-1 text-[11px] bg-transparent border-b border-c-border/60 text-c-text-secondary dark:text-c-text-muted focus:outline-none focus:border-c-focus-solid focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
                                              placeholder={t(
                                                'decisions.detail.options.addProPlaceholder',
                                                '+ Add pro'
                                              )}
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
                                          <span className="text-danger-500 dark:text-danger-400 font-medium">
                                            − {alt.cons?.length || 0}{' '}
                                            {t('decisions.detail.options.consLabel', 'cons')}
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
                                                className="flex-1 text-[11px] bg-transparent border-b border-danger-400/20 text-c-text-secondary focus:outline-none focus:border-danger-400"
                                                placeholder={t(
                                                  'decisions.detail.options.conArgumentPlaceholder',
                                                  'Con argument...'
                                                )}
                                              />
                                              <button
                                                onClick={() => removeAlternativeCon(alt.id, idx)}
                                                className="p-0.5 text-c-text-secondary dark:text-c-text-muted hover:text-danger-500 transition-colors"
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
                                                  addAlternativeCon(
                                                    alt.id,
                                                    altConsDraft[alt.id] || ''
                                                  );
                                                }
                                              }}
                                              className="flex-1 text-[11px] bg-transparent border-b border-c-border/60 text-c-text-secondary dark:text-c-text-muted focus:outline-none focus:border-c-focus-solid focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
                                              placeholder={t(
                                                'decisions.detail.options.addConPlaceholder',
                                                '+ Add con'
                                              )}
                                            />
                                          </div>
                                          <div className="flex flex-wrap gap-1">
                                            {quickConArguments.map((arg) => (
                                              <button
                                                key={`${alt.id}-quick-con-${arg}`}
                                                onClick={() => addAlternativeCon(alt.id, arg)}
                                                className="px-1.5 py-0.5 rounded border border-danger-400/30 text-danger-500 dark:text-danger-400 text-[10px] hover:bg-danger-500/10 transition-colors"
                                              >
                                                +{arg}
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                        {alt.riskLevel && (
                                          <span
                                            className={`font-medium ${alt.riskLevel === 'high' ? 'text-danger-500' : alt.riskLevel === 'medium' ? 'text-amber-500' : 'text-c-text-secondary dark:text-c-text-muted'}`}
                                          >
                                            {t('decisions.detail.options.riskLabel', 'risk')}:{' '}
                                            {alt.riskLevel}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              <button
                                onClick={addAlternative}
                                className="text-xs font-medium text-c-text-secondary dark:text-c-text-muted dark:text-c-text-secondary hover:text-teal-500 transition-colors"
                              >
                                + {t('decisions.detail.options.addOption', 'Add option')}
                              </button>
                            </div>
                          </NModeCardState>
                        )}

                        {/* ── Section: Risk & Impact (shared RiskCanvas) ────── */}
                        {activeNotionSection === 'risk-impact' && (
                          <NModeCardState
                            state={
                              isGeneratingRisks
                                ? 'generating'
                                : risks.length === 0 && cardStates.risk === 'empty'
                                  ? 'empty'
                                  : cardStates.risk === 'empty'
                                    ? 'edited'
                                    : cardStates.risk
                            }
                            sectionName={{ en: 'Risk & Impact', pl: 'Ryzyko i wpływ' }}
                            aiGenerated={
                              cardStates.risk === 'ai-draft' || cardStates.risk === 'edited'
                            }
                            hideActions={isDecisionStageLocked}
                            /* Podgląd = widok dla klienta: badge stanu redakcyjnego znika.
                               Edycja bez zmian (badge zależy tylko od readMode, nie od blokady etapu). */
                            hideBadge={readMode}
                            onRegenerate={generateRisksAI}
                            onEdit={() => setCardState('risk', 'edited')}
                            onAccept={() => setCardState('risk', 'done')}
                            onGenerate={generateRisksAI}
                            onFillManually={() => {
                              setCardState('risk', 'edited');
                              addRisk();
                            }}
                            onRetry={generateRisksAI}
                          >
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
                          </NModeCardState>
                        )}

                        {/* ── Section: Consequences (dedicated menu block) ── */}
                        {activeNotionSection === 'consequences' && (
                          <NModeCardState
                            state={
                              isGeneratingConsequenceScenarios
                                ? 'generating'
                                : cardStates.consequences
                            }
                            sectionName={{
                              en: 'Consequences of Inaction',
                              pl: 'Konsekwencje bezczynności',
                            }}
                            aiGenerated={
                              cardStates.consequences === 'ai-draft' ||
                              cardStates.consequences === 'edited'
                            }
                            hideActions={isDecisionStageLocked}
                            /* Podgląd = widok dla klienta: badge stanu redakcyjnego znika.
                               Edycja bez zmian (badge zależy tylko od readMode, nie od blokady etapu). */
                            hideBadge={readMode}
                            onRegenerate={() => generateConsequenceScenariosAI()}
                            onEdit={() => setCardState('consequences', 'edited')}
                            onAccept={() => setCardState('consequences', 'done')}
                            onGenerate={() => generateConsequenceScenariosAI()}
                            onFillManually={() => setCardState('consequences', 'edited')}
                            onRetry={() => generateConsequenceScenariosAI()}
                          >
                            <div className="space-y-6">
                              <div className="flex items-center justify-end">
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
                                <div className="flex items-center gap-2 text-[11px] text-c-text-secondary dark:text-c-text-muted dark:text-c-text-secondary">
                                  <span>
                                    {t(
                                      'decisions.detail.consequencesSection.aiScenariosRealtime',
                                      'AI scenarios (real-time)'
                                    )}
                                  </span>
                                  {/* Etykieta źródła mówi prawdę o TYCH komórkach:
                                      „AI" po udanym wygenerowaniu, „ręcznie" po
                                      edycji użytkownika, a przy pustej siatce —
                                      „brak danych" (dawniej stało tu „Źródło:
                                      fallback" nad dziewięcioma zdaniami, których
                                      nie napisał ani AI, ani użytkownik). */}
                                  <span className="text-[10px]">
                                    {!consequenceScenarios
                                      ? t(
                                          'decisions.detail.consequencesSection.sourceNone',
                                          'Source: no data yet'
                                        )
                                      : displayedConsequenceScenarios.source === 'ai'
                                        ? t(
                                            'decisions.detail.consequencesSection.sourceAI',
                                            'Source: AI'
                                          )
                                        : t(
                                            'decisions.detail.consequencesSection.sourceManual',
                                            'Source: manual entry'
                                          )}
                                  </span>
                                </div>
                                <div className="text-[11px] text-c-text-secondary dark:text-c-text-muted dark:text-c-text-secondary">
                                  {isGeneratingConsequenceScenarios
                                    ? t(
                                        'decisions.detail.consequencesSection.aiUpdating',
                                        'AI is updating scenarios...'
                                      )
                                    : null}
                                </div>
                              </div>
                              <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
                                {(
                                  [
                                    [
                                      'optimistic',
                                      t(
                                        'decisions.detail.consequencesSection.optimistic',
                                        'Optimistic'
                                      ),
                                    ],
                                    [
                                      'neutral',
                                      t('decisions.detail.consequencesSection.neutral', 'Neutral'),
                                    ],
                                    [
                                      'pessimistic',
                                      t(
                                        'decisions.detail.consequencesSection.pessimistic',
                                        'Pessimistic'
                                      ),
                                    ],
                                  ] as const
                                ).map(([scenarioKey, label]) => {
                                  const scenario = displayedConsequenceScenarios[scenarioKey];
                                  const cardStyle =
                                    scenarioKey === 'optimistic'
                                      ? 'border-emerald-400/35 bg-emerald-500/5'
                                      : scenarioKey === 'neutral'
                                        ? 'border-amber-400/35 bg-amber-500/5'
                                        : 'border-danger-400/35 bg-danger-500/5';
                                  return (
                                    <div
                                      key={scenarioKey}
                                      className={`rounded-xl border p-3 space-y-3 shadow-sm ${cardStyle}`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-semibold text-c-text">
                                          {label}
                                        </h3>
                                        <span className="text-[10px] uppercase tracking-wide text-c-text-secondary dark:text-c-text-muted dark:text-c-text-secondary">
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
                                            className="rounded-lg border border-c-border-subtle/50 bg-c-surface/30 p-2"
                                          >
                                            {/* n-Type §6.2: komórka scenariusza to też
                                                opisowe pole tekstowe — dostaje AI w
                                                prawym górnym rogu (dotąd JEDYNE pole
                                                karty całkiem bez AI) i auto-fit. */}
                                            <AutoFitTextarea
                                              value={scenario[timelineKey]}
                                              onValueChange={(v) =>
                                                updateConsequenceScenarioCell(
                                                  scenarioKey,
                                                  timelineKey,
                                                  v
                                                )
                                              }
                                              previewMode={isDecisionStageLocked}
                                              minRows={4}
                                              label={
                                                <span className="text-[10px] uppercase tracking-wide text-c-text-secondary dark:text-c-text-muted dark:text-c-text-secondary">
                                                  {timelineLabel}
                                                </span>
                                              }
                                              aiSlot={
                                                <AIFieldEnhancer
                                                  fieldKey={`n-consequence-${scenarioKey}-${timelineKey}`}
                                                  sectionLabel={`Consequence scenario ${label} — ${timelineLabel}`}
                                                  currentValue={scenario[timelineKey] || ''}
                                                  onApply={(v) =>
                                                    updateConsequenceScenarioCell(
                                                      scenarioKey,
                                                      timelineKey,
                                                      v
                                                    )
                                                  }
                                                  artifactContext={{
                                                    title,
                                                    status,
                                                    priority,
                                                    type: 'decision',
                                                  }}
                                                  disabled={isDecisionStageLocked}
                                                  iconOnly
                                                />
                                              }
                                              autoFitLabel={t(
                                                'decisions.detail.field.backToAutoFit',
                                                'Back to auto-fit'
                                              )}
                                              className="w-full bg-transparent text-xs leading-relaxed text-c-text-secondary focus:outline-none placeholder-c-text-muted"
                                              editClassName="focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] transition-colors"
                                            />
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="pl-4 border-l-2 border-amber-400 dark:border-amber-500/60">
                                <AutoFitTextarea
                                  value={rationale}
                                  onValueChange={(v) => {
                                    setRationale(v);
                                    markCardEdited('consequences');
                                  }}
                                  previewMode={isDecisionStageLocked}
                                  minRows={5}
                                  label={
                                    <span className="text-[11px] uppercase tracking-wide text-c-text-secondary dark:text-c-text-muted dark:text-c-text-secondary">
                                      {t(
                                        'decisions.detail.consequencesSection.decisionNote',
                                        'Decision note'
                                      )}
                                    </span>
                                  }
                                  aiSlot={
                                    <AIFieldEnhancer
                                      fieldKey="n-rationale-note"
                                      sectionLabel="Consequences of Inaction"
                                      currentValue={rationale}
                                      onApply={setRationale}
                                      artifactContext={{
                                        title,
                                        status,
                                        priority,
                                        type: 'decision',
                                      }}
                                      disabled={isDecisionStageLocked}
                                    />
                                  }
                                  autoFitLabel={t(
                                    'decisions.detail.field.backToAutoFit',
                                    'Back to auto-fit'
                                  )}
                                  className="w-full px-0 py-1 bg-transparent text-sm text-c-text-secondary focus:outline-none placeholder-amber-400/50 dark:placeholder-amber-600/40 leading-relaxed"
                                  editClassName="focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] transition-colors"
                                  placeholder={t(
                                    'decisions.detail.consequencesSection.notePlaceholder',
                                    'What happens if the decision is not made?'
                                  )}
                                />
                              </div>
                            </div>
                          </NModeCardState>
                        )}

                        {/* ── Section: Governance & Escalation (flat) ───── */}
                        {activeNotionSection === 'governance-escalation' && (
                          <div className="space-y-8">
                            <h2 className="text-lg font-semibold text-c-text dark:text-white">
                              {t('decisions.detail.governance.title', 'RACI & Escalation')}
                            </h2>
                            <div className="space-y-4">
                              {/* RACI table */}
                              <div className={governanceTableCardClass}>
                                <div className="flex items-center justify-between">
                                  <h3 className="text-base font-semibold text-c-text">
                                    {t(
                                      'decisions.detail.governance.raciMatrixTitle',
                                      'RACI (responsibility matrix)'
                                    )}
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
                                      className="px-2.5 py-1 rounded-lg text-xs font-medium border border-c-border-subtle/60 dark:border-c-border text-c-text-secondary hover:text-c-text hover:border-c-border-strong transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                      + {t('decisions.detail.governance.addPerson', 'Add person')}
                                    </button>
                                  </div>
                                </div>
                                <div className="overflow-auto flex-1">
                                  <table
                                    /* §27-exempt: sub-tabela w widoku szczegolow, nie samodzielna lista */ className="w-full text-sm"
                                  >
                                    <thead>
                                      <tr className="text-[11px] uppercase tracking-wide text-c-text-secondary dark:text-c-text-muted dark:text-c-text-secondary border-b border-c-border-subtle/50">
                                        <th className="text-left py-2 pr-2">
                                          {t('decisions.detail.governance.colPerson', 'Person')}
                                        </th>
                                        <th className="text-left py-2 pr-2">
                                          {t('decisions.detail.governance.colRole', 'Role')}
                                        </th>
                                        <th className="text-left py-2 pr-2">
                                          {t('decisions.detail.governance.colEmail', 'Email')}
                                        </th>
                                        <th className="text-left py-2 pr-2">
                                          {t(
                                            'decisions.detail.governance.colNotifications',
                                            'Notifications'
                                          )}
                                        </th>
                                        <th className="text-right py-2">
                                          {t('decisions.detail.governance.colActions', 'Actions')}
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-c-border-subtle/40">
                                      {stakeholders.length === 0 ? (
                                        <tr>
                                          <td
                                            colSpan={5}
                                            className="py-6 text-center text-xs text-c-text-secondary dark:text-c-text-muted"
                                          >
                                            {t(
                                              'decisions.detail.governance.noStakeholders',
                                              'No stakeholders yet.'
                                            )}
                                          </td>
                                        </tr>
                                      ) : (
                                        stakeholders.map((s) => (
                                          <tr key={s.id}>
                                            <td className="py-2 pr-2 text-c-text-secondary">
                                              {s.userName || s.userId}
                                            </td>
                                            <td className="py-2 pr-2 text-xs text-c-text-secondary">
                                              {stakeholderRoleLabel(s.role)}
                                            </td>
                                            <td className="py-2 pr-2 text-c-text-secondary dark:text-c-text-muted">
                                              {s.userEmail || '—'}
                                            </td>
                                            <td className="py-2 pr-2 text-xs">
                                              <div className="flex flex-wrap gap-1">
                                                {stakeholderChannelLabels(
                                                  s.notificationSettings
                                                ).map((label) => (
                                                  <span
                                                    key={`${s.id}-${label}`}
                                                    className="px-1.5 py-0.5 rounded border border-c-border-subtle/60 bg-c-surface/50 dark:bg-c-surface-raised/50 text-[10px] text-c-text-secondary dark:text-c-text-muted"
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
                                                  className="p-1 text-c-text-secondary dark:text-c-text-muted hover:text-c-text disabled:opacity-40"
                                                  title={t(
                                                    'decisions.detail.activityLog.edit',
                                                    'Edit'
                                                  )}
                                                >
                                                  <Edit3 size={13} />
                                                </button>
                                                <button
                                                  disabled={isDecisionStageLocked}
                                                  onClick={() =>
                                                    setStakeholders(
                                                      stakeholders.filter(
                                                        (item) => item.id !== s.id
                                                      )
                                                    )
                                                  }
                                                  className="p-1 text-c-text-secondary dark:text-c-text-muted hover:text-danger-500 disabled:opacity-40"
                                                  title={t(
                                                    'decisions.detail.governance.delete',
                                                    'Delete'
                                                  )}
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
                                  <h3 className="text-base font-semibold text-c-text">
                                    {t('decisions.detail.governance.remindersTitle', 'Reminders')}
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
                                      className="px-2.5 py-1 rounded-lg text-xs font-medium border border-c-border-subtle/60 dark:border-c-border text-c-text-secondary hover:text-c-text hover:border-c-border-strong transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                      +{' '}
                                      {t('decisions.detail.governance.addReminder', 'Add reminder')}
                                    </button>
                                  </div>
                                </div>
                                <div className="overflow-auto flex-1">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="text-[11px] uppercase tracking-wide text-c-text-secondary dark:text-c-text-muted dark:text-c-text-secondary border-b border-c-border-subtle/50">
                                        <th className="text-left py-2 pr-2">
                                          {t('decisions.detail.governance.colType', 'Type')}
                                        </th>
                                        <th className="text-left py-2 pr-2">
                                          {t('decisions.detail.governance.colDays', 'Days')}
                                        </th>
                                        <th className="text-left py-2 pr-2">
                                          {t(
                                            'decisions.detail.governance.colRecipients',
                                            'Recipients'
                                          )}
                                        </th>
                                        <th className="text-left py-2 pr-2">
                                          {t(
                                            'decisions.detail.governance.colNotifications',
                                            'Notifications'
                                          )}
                                        </th>
                                        <th className="text-right py-2">
                                          {t('decisions.detail.governance.colActions', 'Actions')}
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-c-border-subtle/40">
                                      {reminders.length === 0 ? (
                                        <tr>
                                          <td
                                            colSpan={5}
                                            className="py-6 text-center text-xs text-c-text-secondary dark:text-c-text-muted"
                                          >
                                            {t(
                                              'decisions.detail.governance.noReminders',
                                              'No reminders yet.'
                                            )}
                                          </td>
                                        </tr>
                                      ) : (
                                        reminders.map((r) => (
                                          <tr key={r.id}>
                                            <td className="py-2 pr-2 text-xs text-c-text-secondary">
                                              {r.type === 'before_due'
                                                ? t(
                                                    'decisions.detail.governance.beforeDue',
                                                    'Before due'
                                                  )
                                                : t(
                                                    'decisions.detail.governance.afterDue',
                                                    'After due'
                                                  )}
                                            </td>
                                            <td className="py-2 pr-2 text-xs text-c-text-secondary">
                                              {r.days}
                                            </td>
                                            <td className="py-2 pr-2 text-xs text-c-text-secondary">
                                              {r.recipients}
                                            </td>
                                            <td className="py-2 pr-2 text-xs">
                                              <div className="flex flex-wrap gap-1">
                                                {!r.enabled && (
                                                  <span className="px-1.5 py-0.5 rounded border border-c-border-subtle/60 bg-c-surface/50 dark:bg-c-surface-raised/50 text-[10px] text-c-text-secondary dark:text-c-text-muted">
                                                    {t(
                                                      'decisions.detail.channels.disabled',
                                                      'Disabled'
                                                    )}
                                                  </span>
                                                )}
                                                {deliveryBadgeLabels(r.delivery, r).map((label) => (
                                                  <span
                                                    key={`${r.id}-${label}`}
                                                    className="px-1.5 py-0.5 rounded border border-c-border-subtle/60 bg-c-surface/50 dark:bg-c-surface-raised/50 text-[10px] text-c-text-secondary dark:text-c-text-muted"
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
                                                    setReminderDraft(
                                                      normalizeReminderRule({ ...r })
                                                    );
                                                  }}
                                                  className="p-1 text-c-text-secondary dark:text-c-text-muted hover:text-c-text disabled:opacity-40"
                                                  title={t(
                                                    'decisions.detail.activityLog.edit',
                                                    'Edit'
                                                  )}
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
                                                  className="p-1 text-c-text-secondary dark:text-c-text-muted hover:text-danger-500 disabled:opacity-40"
                                                  title={t(
                                                    'decisions.detail.governance.delete',
                                                    'Delete'
                                                  )}
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
                                  <h3 className="text-base font-semibold text-c-text">
                                    {t(
                                      'decisions.detail.governance.escalationTitle',
                                      'Escalation and rules'
                                    )}
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
                                      className="px-2.5 py-1 rounded-lg text-xs font-medium border border-c-border-subtle/60 dark:border-c-border text-c-text-secondary hover:text-c-text hover:border-c-border-strong transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                      +{' '}
                                      {t(
                                        'decisions.detail.governance.addEscalation',
                                        'Add escalation'
                                      )}
                                    </button>
                                  </div>
                                </div>
                                <div className="overflow-auto flex-1">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="text-[11px] uppercase tracking-wide text-c-text-secondary dark:text-c-text-muted dark:text-c-text-secondary border-b border-c-border-subtle/50">
                                        <th className="text-left py-2 pr-2">
                                          {t('decisions.detail.governance.colStatus', 'Status')}
                                        </th>
                                        <th className="text-left py-2 pr-2">
                                          {t(
                                            'decisions.detail.governance.colThresholds',
                                            'W/C thresholds'
                                          )}
                                        </th>
                                        <th className="text-left py-2 pr-2">
                                          {t(
                                            'decisions.detail.governance.colEscalateAfter',
                                            'Escalate after'
                                          )}
                                        </th>
                                        <th className="text-left py-2 pr-2">
                                          {t(
                                            'decisions.detail.governance.colEscalateTo',
                                            'Escalate to'
                                          )}
                                        </th>
                                        <th className="text-left py-2 pr-2">
                                          {t('decisions.detail.governance.colMessage', 'Message')}
                                        </th>
                                        <th className="text-left py-2 pr-2">
                                          {t('decisions.detail.governance.colMode', 'Mode')}
                                        </th>
                                        <th className="text-left py-2 pr-2">
                                          {t('decisions.detail.governance.colChannels', 'Channels')}
                                        </th>
                                        <th className="text-right py-2">
                                          {t('decisions.detail.governance.colActions', 'Actions')}
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-c-border-subtle/40">
                                      {escalationRules.length === 0 ? (
                                        <tr>
                                          <td
                                            colSpan={8}
                                            className="py-6 text-center text-xs text-c-text-secondary dark:text-c-text-muted"
                                          >
                                            {t(
                                              'decisions.detail.governance.noEscalationRules',
                                              'No escalation rules yet.'
                                            )}
                                          </td>
                                        </tr>
                                      ) : (
                                        escalationRules.map((rule) => (
                                          <tr key={rule.id}>
                                            <td className="py-2 pr-2 text-xs text-c-text-secondary">
                                              {rule.enabled
                                                ? t(
                                                    'decisions.detail.governance.enabledStatus',
                                                    'Enabled'
                                                  )
                                                : t(
                                                    'decisions.detail.channels.disabled',
                                                    'Disabled'
                                                  )}
                                            </td>
                                            <td className="py-2 pr-2 text-xs text-c-text-secondary">
                                              {rule.warningDays}/{rule.criticalDays} d
                                            </td>
                                            <td className="py-2 pr-2 text-xs text-c-text-secondary">
                                              {rule.afterDays} d
                                            </td>
                                            <td className="py-2 pr-2 text-xs text-c-text-secondary">
                                              {rule.escalateToName || '—'}
                                            </td>
                                            <td className="py-2 pr-2 text-xs text-c-text-secondary">
                                              {rule.message || '—'}
                                            </td>
                                            <td className="py-2 pr-2 text-xs text-c-text-secondary">
                                              {rule.escalationMode === 'notify_only'
                                                ? t(
                                                    'decisions.detail.governance.escalationModeNotify',
                                                    'Notify'
                                                  )
                                                : rule.escalationMode === 'manager_review'
                                                  ? t(
                                                      'decisions.detail.escalationMode.managerReview',
                                                      'Manager review'
                                                    )
                                                  : t(
                                                      'decisions.detail.escalationMode.executiveAlert',
                                                      'Executive alert'
                                                    )}
                                            </td>
                                            <td className="py-2 pr-2 text-xs">
                                              <div className="flex flex-wrap gap-1">
                                                {deliveryBadgeLabels(rule.delivery).map((label) => (
                                                  <span
                                                    key={`${rule.id}-ch-${label}`}
                                                    className="px-1.5 py-0.5 rounded border border-c-border-subtle/60 bg-c-surface/50 dark:bg-c-surface-raised/50 text-[10px] text-c-text-secondary dark:text-c-text-muted"
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
                                                  className="p-1 text-c-text-secondary dark:text-c-text-muted hover:text-c-text disabled:opacity-40"
                                                  title={t(
                                                    'decisions.detail.activityLog.edit',
                                                    'Edit'
                                                  )}
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
                                                  className="p-1 text-c-text-secondary dark:text-c-text-muted hover:text-danger-500 disabled:opacity-40"
                                                  title={t(
                                                    'decisions.detail.governance.delete',
                                                    'Delete'
                                                  )}
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
                                    <h4 className="text-sm font-semibold text-c-text">
                                      {editingStakeholderId === '__new__'
                                        ? t(
                                            'decisions.detail.stakeholderModal.addTitle',
                                            'Add RACI person'
                                          )
                                        : t(
                                            'decisions.detail.stakeholderModal.editTitle',
                                            'Edit RACI person'
                                          )}
                                    </h4>
                                    <div className="inline-flex items-center gap-2">
                                      <button
                                        disabled={isDecisionStageLocked || isSuggestingStakeholders}
                                        onClick={suggestStakeholderDraftAI}
                                        className="px-2.5 py-1 rounded-lg text-xs font-medium border border-c-info/40 text-c-info hover:border-c-info/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
                                      >
                                        {isSuggestingStakeholders ? (
                                          <Loader2 size={12} className="animate-spin" />
                                        ) : (
                                          <Sparkles size={12} />
                                        )}
                                        AI
                                      </button>
                                      <button
                                        className="p-1 text-c-text-secondary dark:text-c-text-muted hover:text-c-text-secondary"
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
                                    {t(
                                      'decisions.detail.stakeholderModal.hint',
                                      'Use this window to describe and configure person responsibility in RACI and communication channels.'
                                    )}
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <label className="text-xs text-c-text-secondary dark:text-c-text-muted">
                                      {t('decisions.detail.governance.colPerson', 'Person')}
                                      <select
                                        value={stakeholderDraft.userId}
                                        onChange={(e) => {
                                          const selected = users.find(
                                            (u) => u.id === e.target.value
                                          );
                                          setStakeholderDraft({
                                            ...stakeholderDraft,
                                            userId: e.target.value,
                                            userName: selected
                                              ? `${selected.firstName} ${selected.lastName}`
                                              : stakeholderDraft.userName,
                                            userEmail:
                                              selected?.email || stakeholderDraft.userEmail,
                                          });
                                        }}
                                        className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-c-surface-raised border border-c-border"
                                      >
                                        {users.map((u) => (
                                          <option key={u.id} value={u.id}>
                                            {u.firstName} {u.lastName}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                    <label className="text-xs text-c-text-secondary dark:text-c-text-muted">
                                      {t('decisions.detail.governance.colRole', 'Role')}
                                      <select
                                        value={stakeholderDraft.role}
                                        onChange={(e) =>
                                          setStakeholderDraft({
                                            ...stakeholderDraft,
                                            role: e.target.value as StakeholderRole,
                                          })
                                        }
                                        className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-c-surface-raised border border-c-border"
                                      >
                                        <option value="responsible">
                                          {t('decisions.detail.raci.responsible', 'Responsible')}
                                        </option>
                                        <option value="accountable">
                                          {t('decisions.detail.raci.accountable', 'Accountable')}
                                        </option>
                                        <option value="consulted">
                                          {t('decisions.detail.raci.consulted', 'Consulted')}
                                        </option>
                                        <option value="informed">
                                          {t('decisions.detail.raci.informed', 'Informed')}
                                        </option>
                                      </select>
                                    </label>
                                  </div>
                                  <div className="space-y-2 flex-1">
                                    <div className="text-xs text-c-text-secondary dark:text-c-text-muted">
                                      {t(
                                        'decisions.detail.stakeholderModal.notificationChannels',
                                        'Notification channels'
                                      )}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      <div className="rounded-xl border border-c-border-subtle/60 bg-c-surface/70 dark:bg-c-surface-raised/50 p-3 space-y-2">
                                        <div className="text-[11px] font-semibold uppercase tracking-wide text-c-text-secondary dark:text-c-text-muted">
                                          {t(
                                            'decisions.detail.stakeholderModal.coreChannels',
                                            'Core channels'
                                          )}
                                        </div>
                                        <div className="flex flex-wrap gap-2 text-xs text-c-text-secondary">
                                          {[
                                            {
                                              key: 'enabled',
                                              label: t(
                                                'decisions.detail.governance.enabledStatus',
                                                'Enabled'
                                              ),
                                              active: stakeholderDraft.notificationSettings.enabled,
                                              toggle: () =>
                                                setStakeholderDraft({
                                                  ...stakeholderDraft,
                                                  notificationSettings: {
                                                    ...stakeholderDraft.notificationSettings,
                                                    enabled:
                                                      !stakeholderDraft.notificationSettings
                                                        .enabled,
                                                  },
                                                }),
                                            },
                                            {
                                              key: 'in_app',
                                              label: t('decisions.detail.notify.inApp', 'In-app'),
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
                                              label: t('decisions.detail.notify.email', 'Email'),
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
                                                  ? 'border-c-border-strong text-c-text bg-c-surface-raised'
                                                  : 'border-c-border-subtle/70 text-c-text-secondary hover:border-c-border-strong/80'
                                              }`}
                                            >
                                              {channel.label}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                      <div className="rounded-xl border border-c-border-subtle/60 bg-c-surface/70 dark:bg-c-surface-raised/50 p-3 space-y-2">
                                        <div className="text-[11px] font-semibold uppercase tracking-wide text-c-text-secondary dark:text-c-text-muted">
                                          {t(
                                            'decisions.detail.stakeholderModal.integrationChannels',
                                            'Integration channels'
                                          )}
                                        </div>
                                        <div className="flex flex-wrap gap-2 text-xs text-c-text-secondary">
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
                                                    ? 'border-c-border-strong text-c-text bg-c-surface-raised'
                                                    : 'border-c-border-subtle/70 text-c-text-secondary hover:border-c-border-strong/80'
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
                                    <label className="text-xs text-c-text-secondary dark:text-c-text-muted block">
                                      {t(
                                        'decisions.detail.stakeholderModal.syncTargets',
                                        'Sync targets'
                                      )}
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
                                        className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-c-surface-raised border border-c-border"
                                        placeholder={t(
                                          'decisions.detail.integrations.placeholderOps',
                                          'slack:#ops, jira:DRD'
                                        )}
                                      />
                                    </label>
                                  </div>
                                  <div className="flex justify-end gap-2">
                                    <button
                                      onClick={() => {
                                        setEditingStakeholderId(null);
                                        setStakeholderDraft(null);
                                      }}
                                      className="px-3 py-1.5 rounded-md text-xs border border-c-border-subtle/60 dark:border-c-border text-c-text-secondary"
                                    >
                                      {t('decisions.detail.stakeholderModal.cancel', 'Cancel')}
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
                                      /* SPEC-N §2.3 (R1): stonowane z solid navy/white CTA na neutralny
                                         outline na tokenach c-*. Poza slotem primary
                                         naglowka nic na tej karcie nie moze wygladac jak CTA;
                                         to Zapisz w modalu, nie decyzja karty. */
                                      className="px-3 py-1.5 rounded-md text-xs font-medium border border-c-border-strong text-c-text hover:bg-state-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
                                    >
                                      {t('decisions.detail.stakeholderModal.save', 'Save')}
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
                                    <h4 className="text-sm font-semibold text-c-text">
                                      {editingReminderId === '__new__'
                                        ? t(
                                            'decisions.detail.governance.addReminder',
                                            'Add reminder'
                                          )
                                        : t(
                                            'decisions.detail.reminderModal.editTitle',
                                            'Edit reminder'
                                          )}
                                    </h4>
                                    <div className="inline-flex items-center gap-2">
                                      <button
                                        disabled={isDecisionStageLocked || isSuggestingReminders}
                                        onClick={suggestReminderDraftAI}
                                        className="px-2.5 py-1 rounded-lg text-xs font-medium border border-c-info/40 text-c-info hover:border-c-info/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
                                      >
                                        {isSuggestingReminders ? (
                                          <Loader2 size={12} className="animate-spin" />
                                        ) : (
                                          <Sparkles size={12} />
                                        )}
                                        AI
                                      </button>
                                      <button
                                        className="p-1 text-c-text-secondary dark:text-c-text-muted hover:text-c-text-secondary"
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
                                    {t(
                                      'decisions.detail.reminderModal.hint',
                                      'Use this window to describe reminder intent: when it should trigger, recipients, and the message.'
                                    )}
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <label className="text-xs text-c-text-secondary dark:text-c-text-muted">
                                      {t('decisions.detail.governance.colType', 'Type')}
                                      <select
                                        value={reminderDraft.type}
                                        onChange={(e) =>
                                          setReminderDraft({
                                            ...reminderDraft,
                                            type: e.target.value as 'before_due' | 'after_due',
                                          })
                                        }
                                        className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-c-surface-raised border border-c-border"
                                      >
                                        <option value="before_due">
                                          {t('decisions.detail.governance.beforeDue', 'Before due')}
                                        </option>
                                        <option value="after_due">
                                          {t('decisions.detail.governance.afterDue', 'After due')}
                                        </option>
                                      </select>
                                    </label>
                                    <label className="text-xs text-c-text-secondary dark:text-c-text-muted">
                                      {t('decisions.detail.governance.colDays', 'Days')}
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
                                        className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-c-surface-raised border border-c-border"
                                      />
                                    </label>
                                  </div>
                                  <label className="text-xs text-c-text-secondary dark:text-c-text-muted block">
                                    {t('decisions.detail.governance.colRecipients', 'Recipients')}
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
                                      className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-c-surface-raised border border-c-border"
                                    >
                                      <option value="requester">
                                        {t('decisions.detail.reminderModal.requester', 'Requester')}
                                      </option>
                                      <option value="decider">
                                        {t('decisions.detail.reminderModal.decider', 'Decider')}
                                      </option>
                                      <option value="both">
                                        {t('decisions.detail.reminderModal.both', 'Both')}
                                      </option>
                                      <option value="stakeholders">
                                        {t(
                                          'decisions.detail.reminderModal.stakeholders',
                                          'Stakeholders'
                                        )}
                                      </option>
                                    </select>
                                  </label>
                                  <div className="space-y-3">
                                    <label className="inline-flex items-center gap-1 text-xs text-c-text-secondary">
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
                                      {t(
                                        'decisions.detail.reminderModal.ruleEnabled',
                                        'Rule enabled'
                                      )}
                                    </label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      <div className="rounded-xl border border-c-border-subtle/60 bg-c-surface/70 dark:bg-c-surface-raised/50 p-3 space-y-2">
                                        <div className="text-[11px] font-semibold uppercase tracking-wide text-c-text-secondary dark:text-c-text-muted">
                                          {t(
                                            'decisions.detail.stakeholderModal.coreChannels',
                                            'Core channels'
                                          )}
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                          {(
                                            [
                                              {
                                                key: 'in_app',
                                                label: t('decisions.detail.notify.inApp', 'In-app'),
                                              },
                                              {
                                                key: 'email',
                                                label: t('decisions.detail.notify.email', 'Email'),
                                              },
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
                                                    ? 'border-c-border-strong text-c-text bg-c-surface-raised'
                                                    : 'border-c-border-subtle/70 text-c-text-secondary hover:border-c-border-strong/80'
                                                }`}
                                              >
                                                {channel.label}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                      <div className="rounded-xl border border-c-border-subtle/60 bg-c-surface/70 dark:bg-c-surface-raised/50 p-3 space-y-2">
                                        <div className="text-[11px] font-semibold uppercase tracking-wide text-c-text-secondary dark:text-c-text-muted">
                                          {t(
                                            'decisions.detail.stakeholderModal.integrationChannels',
                                            'Integration channels'
                                          )}
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
                                                    ? 'border-c-border-strong text-c-text bg-c-surface-raised'
                                                    : 'border-c-border-subtle/70 text-c-text-secondary hover:border-c-border-strong/80'
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
                                    <label className="text-xs text-c-text-secondary dark:text-c-text-muted block">
                                      {t(
                                        'decisions.detail.stakeholderModal.syncTargets',
                                        'Sync targets'
                                      )}
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
                                        className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-c-surface-raised border border-c-border"
                                        placeholder={t(
                                          'decisions.detail.integrations.placeholderDelivery',
                                          'slack:#delivery, jira:PROJ, webhook:ops'
                                        )}
                                      />
                                    </label>
                                  </div>
                                  <label className="text-xs text-c-text-secondary dark:text-c-text-muted block">
                                    {t('decisions.detail.governance.colMessage', 'Message')}
                                    <textarea
                                      value={reminderDraft.message || ''}
                                      onChange={(e) =>
                                        setReminderDraft({
                                          ...reminderDraft,
                                          message: e.target.value,
                                        })
                                      }
                                      rows={3}
                                      className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-c-surface-raised border border-c-border"
                                    />
                                  </label>
                                  <div className="flex justify-end gap-2">
                                    <button
                                      onClick={() => {
                                        setEditingReminderId(null);
                                        setReminderDraft(null);
                                      }}
                                      className="px-3 py-1.5 rounded-md text-xs border border-c-border-subtle/60 dark:border-c-border text-c-text-secondary"
                                    >
                                      {t('decisions.detail.stakeholderModal.cancel', 'Cancel')}
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
                                      /* SPEC-N §2.3 (R1): stonowane z solid navy/white CTA na neutralny
                                         outline na tokenach c-*. Poza slotem primary
                                         naglowka nic na tej karcie nie moze wygladac jak CTA;
                                         to Zapisz w modalu, nie decyzja karty. */
                                      className="px-3 py-1.5 rounded-md text-xs font-medium border border-c-border-strong text-c-text hover:bg-state-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
                                    >
                                      {t('decisions.detail.stakeholderModal.save', 'Save')}
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
                                    <h4 className="text-sm font-semibold text-c-text">
                                      {editingEscalationId === '__new__'
                                        ? t(
                                            'decisions.detail.escalationModal.addTitle',
                                            'Add escalation rule'
                                          )
                                        : t(
                                            'decisions.detail.escalationModal.editTitle',
                                            'Edit escalation rule'
                                          )}
                                    </h4>
                                    <div className="inline-flex items-center gap-2">
                                      <button
                                        disabled={isDecisionStageLocked || isSuggestingEscalations}
                                        onClick={suggestEscalationDraftAI}
                                        className="px-2.5 py-1 rounded-lg text-xs font-medium border border-c-info/40 text-c-info hover:border-c-info/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
                                      >
                                        {isSuggestingEscalations ? (
                                          <Loader2 size={12} className="animate-spin" />
                                        ) : (
                                          <Sparkles size={12} />
                                        )}
                                        AI
                                      </button>
                                      <button
                                        className="p-1 text-c-text-secondary dark:text-c-text-muted hover:text-c-text-secondary"
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
                                    {t(
                                      'decisions.detail.escalationModal.hint',
                                      'Use this window to describe escalation rule settings: thresholds, timing, assignee, and message.'
                                    )}
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <label className="text-xs text-c-text-secondary dark:text-c-text-muted">
                                      {t(
                                        'decisions.detail.escalationModal.warningThreshold',
                                        'Warning threshold (days)'
                                      )}
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
                                        className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-c-surface-raised border border-c-border"
                                      />
                                    </label>
                                    <label className="text-xs text-c-text-secondary dark:text-c-text-muted">
                                      {t(
                                        'decisions.detail.escalationModal.criticalThreshold',
                                        'Critical threshold (days)'
                                      )}
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
                                        className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-c-surface-raised border border-c-border"
                                      />
                                    </label>
                                    <label className="text-xs text-c-text-secondary dark:text-c-text-muted">
                                      {t(
                                        'decisions.detail.escalationModal.escalateAfterDays',
                                        'Escalate after (days)'
                                      )}
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
                                        className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-c-surface-raised border border-c-border"
                                      />
                                    </label>
                                    <label className="text-xs text-c-text-secondary dark:text-c-text-muted">
                                      {t(
                                        'decisions.detail.governance.colEscalateTo',
                                        'Escalate to'
                                      )}
                                      <select
                                        value={escalationDraft.escalateTo}
                                        onChange={(e) => {
                                          const selected = users.find(
                                            (u) => u.id === e.target.value
                                          );
                                          setEscalationDraft({
                                            ...escalationDraft,
                                            escalateTo: e.target.value,
                                            escalateToName: selected
                                              ? `${selected.firstName} ${selected.lastName}`
                                              : escalationDraft.escalateToName,
                                          });
                                        }}
                                        className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-c-surface-raised border border-c-border"
                                      >
                                        <option value="">
                                          {t('decisions.detail.escalationModal.select', 'Select')}
                                        </option>
                                        {users.map((u) => (
                                          <option key={u.id} value={u.id}>
                                            {u.firstName} {u.lastName}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                  </div>
                                  <label className="text-xs text-c-text-secondary dark:text-c-text-muted block">
                                    {t(
                                      'decisions.detail.escalationModal.escalationMode',
                                      'Escalation mode'
                                    )}
                                    <select
                                      value={escalationDraft.escalationMode}
                                      onChange={(e) =>
                                        setEscalationDraft({
                                          ...escalationDraft,
                                          escalationMode: e.target.value as EscalationMode,
                                        })
                                      }
                                      className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-c-surface-raised border border-c-border"
                                    >
                                      {escalationModeOptions.map((mode) => (
                                        <option key={mode.value} value={mode.value}>
                                          {mode.label}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="inline-flex items-center gap-1 text-xs text-c-text-secondary">
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
                                    {t(
                                      'decisions.detail.reminderModal.ruleEnabled',
                                      'Rule enabled'
                                    )}
                                  </label>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="rounded-xl border border-c-border-subtle/60 bg-c-surface/70 dark:bg-c-surface-raised/50 p-3 space-y-2">
                                      <div className="text-[11px] font-semibold uppercase tracking-wide text-c-text-secondary dark:text-c-text-muted">
                                        {t(
                                          'decisions.detail.stakeholderModal.coreChannels',
                                          'Core channels'
                                        )}
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        {(
                                          [
                                            {
                                              key: 'in_app',
                                              label: t('decisions.detail.notify.inApp', 'In-app'),
                                            },
                                            {
                                              key: 'email',
                                              label: t('decisions.detail.notify.email', 'Email'),
                                            },
                                          ] as Array<{ key: CoreDeliveryChannel; label: string }>
                                        ).map((channel) => {
                                          const delivery = ensureDeliveryConfig(
                                            escalationDraft.delivery
                                          );
                                          const enabled = delivery.coreChannels.includes(
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
                                                  ? 'border-c-border-strong text-c-text bg-c-surface-raised'
                                                  : 'border-c-border-subtle/70 text-c-text-secondary hover:border-c-border-strong/80'
                                              }`}
                                            >
                                              {channel.label}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                    <div className="rounded-xl border border-c-border-subtle/60 bg-c-surface/70 dark:bg-c-surface-raised/50 p-3 space-y-2">
                                      <div className="text-[11px] font-semibold uppercase tracking-wide text-c-text-secondary dark:text-c-text-muted">
                                        {t(
                                          'decisions.detail.stakeholderModal.integrationChannels',
                                          'Integration channels'
                                        )}
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
                                                  ? 'border-c-border-strong text-c-text bg-c-surface-raised'
                                                  : 'border-c-border-subtle/70 text-c-text-secondary hover:border-c-border-strong/80'
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
                                  <label className="text-xs text-c-text-secondary dark:text-c-text-muted block">
                                    {t(
                                      'decisions.detail.stakeholderModal.syncTargets',
                                      'Sync targets'
                                    )}
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
                                      className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-c-surface-raised border border-c-border"
                                      placeholder={t(
                                        'decisions.detail.integrations.placeholderIncident',
                                        'slack:#incident, jira:OPS, webhook:oncall'
                                      )}
                                    />
                                  </label>
                                  <label className="text-xs text-c-text-secondary dark:text-c-text-muted block">
                                    {t(
                                      'decisions.detail.escalationModal.escalationMessage',
                                      'Escalation message'
                                    )}
                                    <textarea
                                      value={escalationDraft.message || ''}
                                      onChange={(e) =>
                                        setEscalationDraft({
                                          ...escalationDraft,
                                          message: e.target.value,
                                        })
                                      }
                                      rows={3}
                                      className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-c-surface-raised border border-c-border"
                                    />
                                  </label>
                                  <div className="flex justify-end gap-2">
                                    <button
                                      onClick={() => {
                                        setEditingEscalationId(null);
                                        setEscalationDraft(null);
                                      }}
                                      className="px-3 py-1.5 rounded-md text-xs border border-c-border-subtle/60 dark:border-c-border text-c-text-secondary"
                                    >
                                      {t('decisions.detail.stakeholderModal.cancel', 'Cancel')}
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
                                      /* SPEC-N §2.3 (R1): stonowane z solid navy/white CTA na neutralny
                                         outline na tokenach c-*. Poza slotem primary
                                         naglowka nic na tej karcie nie moze wygladac jak CTA;
                                         to Zapisz w modalu, nie decyzja karty. */
                                      className="px-3 py-1.5 rounded-md text-xs font-medium border border-c-border-strong text-c-text hover:bg-state-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
                                    >
                                      {t('decisions.detail.stakeholderModal.save', 'Save')}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* SPEC-N §2.1: sekcja Komentarzy przeniesiona STAD do prawego
                            panelu (jedyne miejsce). Zarezerwowane id `comments` nie moze
                            byc sekcja lewej nawigacji, a canvas i skrot w panelu
                            renderowaly sie do 2026-07-21 jednoczesnie. */}

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
                                  item.type === type && item.id === id
                                    ? { ...item, ...patch }
                                    : item
                                )
                              );
                            }}
                            onNavigateLinkedItem={openLinkedItemTarget}
                            searchLinkedItems={searchLinkedItems}
                            readOnly={isDecisionStageLocked}
                          />
                        )}

                        {decisionId && title && (
                          <RelatedContext
                            entityType="decision"
                            entityId={decisionId}
                            entityTitle={title}
                          />
                        )}

                        {decisionId && (
                          <AIConnections entityType="decision" entityId={decisionId} />
                        )}

                        {/* SPEC-N §2.1: sekcja Logu aktywnosci przeniesiona STAD do
                            prawego panelu (sekcja "History"). Zarezerwowane id
                            `activity-log` nie moze byc sekcja lewej nawigacji. */}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════ CLICKUP MODE (action-first) ═════════════════════════ */}
            {presentationMode === 'c' && import.meta.env.VITE_ENABLE_LEGACY_C_MODE === 'true' && (
              <div className="col-span-full space-y-4">
                <div className="flex flex-wrap items-center gap-2 p-2 rounded-xl bg-c-surface/60 border border-c-border-subtle/60">
                  {(
                    [
                      ['overview', t('decisions.detail.clickupTabs.overview', 'Overview')],
                      [
                        'resources',
                        t('decisions.detail.clickupTabs.resources', 'Attachments + Links'),
                      ],
                      ['risk', t('decisions.detail.clickupTabs.risk', 'Risk')],
                      ['options', t('decisions.detail.clickupTabs.options', 'Options')],
                      [
                        'governance',
                        t('decisions.detail.clickupTabs.governance', 'RACI + Escalation'),
                      ],
                      ['comments', t('decisions.detail.clickupTabs.comments', 'Comments')],
                      ['logs', t('decisions.detail.clickupTabs.logs', 'Logs')],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setClickupTab(key)}
                      className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                        clickupTab === key
                          ? 'bg-c-surface-raised border-c-border text-c-text'
                          : 'bg-transparent border-c-border-subtle text-c-text-secondary dark:text-c-text-muted'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.9fr)_330px] gap-4">
                  <div className="space-y-4 min-w-0">
                    {clickupTab === 'overview' && (
                      <div className="bg-c-surface/70 rounded-2xl border border-c-border-subtle/60 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-c-text">
                            {t('decisions.detail.clickupOverview.title', 'Decision Overview')}
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
                          className="w-full px-3 py-2 rounded-xl bg-c-surface-raised border border-c-border text-sm"
                        />
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                            {t(
                              'decisions.detail.consequencesSection.title',
                              'Consequences of Inaction'
                            )}
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
                          placeholder={t(
                            'decisions.detail.consequencesSection.placeholderClickup',
                            'Consequences of inaction...'
                          )}
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
                        <div className="bg-c-surface/70 rounded-2xl border border-c-border-subtle/60 p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-c-text">
                              {t('decisions.detail.governance.raciTitleShort', 'RACI')}
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
                              className="px-2.5 py-1 rounded-lg text-xs font-medium border border-c-border-subtle/60 dark:border-c-border text-c-text-secondary hover:text-c-info hover:border-c-info/50 hover:bg-c-surface-raised transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              + {t('decisions.detail.governance.add', 'Add')}
                            </button>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-[11px] uppercase tracking-wide text-c-text-secondary dark:text-c-text-muted dark:text-c-text-secondary border-b border-c-border-subtle/50">
                                  <th className="text-left py-2 pr-2">
                                    {t('decisions.detail.governance.colRole', 'Role')}
                                  </th>
                                  <th className="text-left py-2 pr-2">
                                    {t('decisions.detail.governance.colPerson', 'Person')}
                                  </th>
                                  <th className="text-left py-2 pr-2">
                                    {t('decisions.detail.governance.colEmail', 'Email')}
                                  </th>
                                  <th className="text-left py-2 pr-2">
                                    {t(
                                      'decisions.detail.governance.colNotifications',
                                      'Notifications'
                                    )}
                                  </th>
                                  <th className="text-right py-2">
                                    {t('decisions.detail.governance.colActions', 'Actions')}
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-c-border-subtle/40">
                                {stakeholders.length === 0 ? (
                                  <tr>
                                    <td
                                      colSpan={5}
                                      className="py-6 text-center text-xs text-c-text-secondary dark:text-c-text-muted"
                                    >
                                      {t(
                                        'decisions.detail.governance.noStakeholders',
                                        'No stakeholders yet.'
                                      )}
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
                                          className="w-full px-2 py-1 rounded-md text-xs bg-c-surface-raised border border-c-border disabled:opacity-60"
                                        >
                                          <option value="responsible">
                                            {t('decisions.detail.raci.responsible', 'Responsible')}
                                          </option>
                                          <option value="accountable">
                                            {t('decisions.detail.raci.accountable', 'Accountable')}
                                          </option>
                                          <option value="consulted">
                                            {t('decisions.detail.raci.consulted', 'Consulted')}
                                          </option>
                                          <option value="informed">
                                            {t('decisions.detail.raci.informed', 'Informed')}
                                          </option>
                                        </select>
                                      </td>
                                      <td className="py-2 pr-2 text-c-text-secondary">
                                        {s.userName || s.userId}
                                      </td>
                                      <td className="py-2 pr-2 text-c-text-secondary dark:text-c-text-muted">
                                        {s.userEmail || '—'}
                                      </td>
                                      <td className="py-2 pr-2 text-c-text-secondary dark:text-c-text-muted text-xs">
                                        <div className="flex flex-wrap gap-1">
                                          {stakeholderChannelLabels(s.notificationSettings).map(
                                            (label) => (
                                              <span
                                                key={`${s.id}-clickup-${label}`}
                                                className="px-1.5 py-0.5 rounded border border-c-border-subtle/60 bg-c-surface/50 dark:bg-c-surface-raised/50 text-[10px]"
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
                                          className="p-1 text-c-text-secondary dark:text-c-text-muted hover:text-danger-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
                        <div className="bg-c-surface/70 rounded-2xl border border-c-border-subtle/60 p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-c-text">
                              {t('decisions.detail.governance.remindersTitle', 'Reminders')}
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
                              className="px-2.5 py-1 rounded-lg text-xs font-medium border border-c-border-subtle/60 dark:border-c-border text-c-text-secondary hover:text-c-info hover:border-c-info/50 hover:bg-c-surface-raised transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              + {t('decisions.detail.governance.add', 'Add')}
                            </button>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-[11px] uppercase tracking-wide text-c-text-secondary dark:text-c-text-muted dark:text-c-text-secondary border-b border-c-border-subtle/50">
                                  <th className="text-left py-2 pr-2">
                                    {t('decisions.detail.governance.active', 'Active')}
                                  </th>
                                  <th className="text-left py-2 pr-2">
                                    {t('decisions.detail.governance.when', 'When')}
                                  </th>
                                  <th className="text-left py-2 pr-2">
                                    {t('decisions.detail.governance.colDays', 'Days')}
                                  </th>
                                  <th className="text-left py-2 pr-2">
                                    {t('decisions.detail.governance.colRecipientsAlt', 'To whom')}
                                  </th>
                                  <th className="text-left py-2 pr-2">
                                    {t('decisions.detail.governance.colChannels', 'Channels')}
                                  </th>
                                  <th className="text-left py-2 pr-2">
                                    {t('decisions.detail.governance.colMessage', 'Message')}
                                  </th>
                                  <th className="text-right py-2">
                                    {t('decisions.detail.governance.colActions', 'Actions')}
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-c-border-subtle/40">
                                {reminders.length === 0 ? (
                                  <tr>
                                    <td
                                      colSpan={7}
                                      className="py-6 text-center text-xs text-c-text-secondary dark:text-c-text-muted"
                                    >
                                      {t(
                                        'decisions.detail.governance.noReminders',
                                        'No reminders yet.'
                                      )}
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
                                          className="w-full px-2 py-1 rounded-md text-xs bg-c-surface-raised border border-c-border disabled:opacity-60"
                                        >
                                          <option value="before_due">
                                            {t(
                                              'decisions.detail.governance.beforeDue',
                                              'Before due'
                                            )}
                                          </option>
                                          <option value="after_due">
                                            {t('decisions.detail.governance.afterDue', 'After due')}
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
                                          className="w-20 px-2 py-1 rounded-md text-xs bg-c-surface-raised border border-c-border disabled:opacity-60"
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
                                          className="w-full px-2 py-1 rounded-md text-xs bg-c-surface-raised border border-c-border disabled:opacity-60"
                                        >
                                          <option value="requester">
                                            {t('decisions.detail.infoPane.requester', 'Requester')}
                                          </option>
                                          <option value="decider">
                                            {t('decisions.detail.infoPane.decider', 'Decider')}
                                          </option>
                                          <option value="both">
                                            {t('decisions.detail.reminderModal.both', 'Both')}
                                          </option>
                                          <option value="stakeholders">
                                            {t(
                                              'decisions.detail.reminderModal.stakeholders',
                                              'Stakeholders'
                                            )}
                                          </option>
                                        </select>
                                      </td>
                                      <td className="py-2 pr-2 text-xs text-c-text-secondary dark:text-c-text-muted">
                                        <label className="inline-flex items-center gap-1 mr-2">
                                          <input
                                            type="checkbox"
                                            checked={r.inAppNotification}
                                            disabled={isDecisionStageLocked}
                                            onChange={(e) =>
                                              setReminders(
                                                reminders.map((item) =>
                                                  item.id === r.id
                                                    ? {
                                                        ...item,
                                                        inAppNotification: e.target.checked,
                                                      }
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
                                                    ? {
                                                        ...item,
                                                        emailNotification: e.target.checked,
                                                      }
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
                                          className="w-full px-2 py-1 rounded-md text-xs bg-c-surface-raised border border-c-border disabled:opacity-60"
                                          placeholder={t(
                                            'decisions.detail.governance.reminderTextPlaceholder',
                                            'Reminder text...'
                                          )}
                                        />
                                      </td>
                                      <td className="py-2 text-right">
                                        <button
                                          disabled={isDecisionStageLocked}
                                          onClick={() =>
                                            setReminders(
                                              reminders.filter((item) => item.id !== r.id)
                                            )
                                          }
                                          className="p-1 text-c-text-secondary dark:text-c-text-muted hover:text-danger-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
                        <div className="bg-c-surface/70 rounded-2xl border border-c-border-subtle/60 p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-c-text">
                              {t('decisions.detail.activityLog.escalation', 'Escalation')}
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
                                className="px-2.5 py-1 rounded-lg text-xs font-medium border border-c-border-subtle/60 dark:border-c-border text-c-text-secondary hover:text-c-info hover:border-c-info/50 hover:bg-c-surface-raised transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                + {t('decisions.detail.governance.add', 'Add')}
                              </button>
                            )}
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-[11px] uppercase tracking-wide text-c-text-secondary dark:text-c-text-muted dark:text-c-text-secondary border-b border-c-border-subtle/50">
                                  <th className="text-left py-2 pr-2">
                                    {t('decisions.detail.governance.enabledStatus', 'Enabled')}
                                  </th>
                                  <th className="text-left py-2 pr-2">
                                    {t(
                                      'decisions.detail.governance.colEscalateAfterDays',
                                      'After days'
                                    )}
                                  </th>
                                  <th className="text-left py-2 pr-2">
                                    {t('decisions.detail.governance.colEscalateTo', 'Escalate to')}
                                  </th>
                                  <th className="text-left py-2 pr-2">
                                    {t('decisions.detail.governance.colMessage', 'Message')}
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {!escalation ? (
                                  <tr>
                                    <td
                                      colSpan={4}
                                      className="py-6 text-center text-xs text-c-text-secondary dark:text-c-text-muted"
                                    >
                                      {t(
                                        'decisions.detail.governance.noEscalationRule',
                                        'No escalation rule.'
                                      )}
                                    </td>
                                  </tr>
                                ) : (
                                  <tr className="border-b border-c-border-subtle/40">
                                    <td className="py-2 pr-2">
                                      <input
                                        type="checkbox"
                                        checked={escalation.enabled}
                                        disabled={isDecisionStageLocked}
                                        onChange={(e) =>
                                          setEscalation({
                                            ...escalation,
                                            enabled: e.target.checked,
                                          })
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
                                        className="w-24 px-2 py-1 rounded-md text-xs bg-c-surface-raised border border-c-border disabled:opacity-60"
                                      />
                                    </td>
                                    <td className="py-2 pr-2">
                                      <select
                                        value={escalation.escalateTo}
                                        disabled={isDecisionStageLocked}
                                        onChange={(e) => {
                                          const selected = users.find(
                                            (u) => u.id === e.target.value
                                          );
                                          setEscalation({
                                            ...escalation,
                                            escalateTo: e.target.value,
                                            escalateToName: selected
                                              ? `${selected.firstName} ${selected.lastName}`
                                              : escalation.escalateToName,
                                          });
                                        }}
                                        className="w-full px-2 py-1 rounded-md text-xs bg-c-surface-raised border border-c-border disabled:opacity-60"
                                      >
                                        <option value="">
                                          {t('decisions.detail.escalationModal.select', 'Select')}
                                        </option>
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
                                        className="w-full px-2 py-1 rounded-md text-xs bg-c-surface-raised border border-c-border disabled:opacity-60"
                                        placeholder={t(
                                          'decisions.detail.governance.escalationTextPlaceholder',
                                          'Escalation message...'
                                        )}
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
                        <div className="bg-c-surface/70 rounded-2xl border border-c-border-subtle/60 p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-c-text">
                              {t('decisions.detail.attachments.title', 'Attachments')}
                            </h3>
                            <label
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                                isDecisionStageLocked
                                  ? 'border-c-border-subtle/40 dark:border-c-border-subtle text-c-text-secondary dark:text-c-text-muted dark:text-c-text-secondary cursor-not-allowed'
                                  : 'border-c-border-subtle/60 dark:border-c-border text-c-text-secondary hover:text-c-info hover:border-c-info/50 hover:bg-c-surface-raised cursor-pointer'
                              }`}
                            >
                              + {t('decisions.detail.governance.add', 'Add')}
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
                                <tr className="text-[11px] uppercase tracking-wide text-c-text-secondary dark:text-c-text-muted dark:text-c-text-secondary border-b border-c-border-subtle/50">
                                  <th className="text-left py-2 pr-2">
                                    {t('decisions.detail.attachments.colName', 'Name')}
                                  </th>
                                  <th className="text-left py-2 pr-2">
                                    {t('decisions.detail.governance.colType', 'Type')}
                                  </th>
                                  <th className="text-left py-2 pr-2">
                                    {t('decisions.detail.attachments.colSize', 'Size')}
                                  </th>
                                  <th className="text-left py-2 pr-2">
                                    {t('decisions.detail.attachments.colUploaded', 'Uploaded')}
                                  </th>
                                  <th className="text-left py-2 pr-2">
                                    {t('decisions.detail.attachments.colBy', 'By')}
                                  </th>
                                  <th className="text-right py-2">
                                    {t('decisions.detail.governance.colActions', 'Actions')}
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-c-border-subtle/40">
                                {attachments.length === 0 ? (
                                  <tr>
                                    <td
                                      colSpan={6}
                                      className="py-6 text-center text-xs text-c-text-secondary dark:text-c-text-muted"
                                    >
                                      {t('decisions.detail.attachments.none', 'No attachments.')}
                                    </td>
                                  </tr>
                                ) : (
                                  attachments.map((a) => (
                                    <tr key={a.id}>
                                      <td className="py-2 pr-2 text-c-text-secondary max-w-[280px] truncate">
                                        {a.name}
                                      </td>
                                      <td className="py-2 pr-2 text-c-text-secondary dark:text-c-text-muted text-xs">
                                        {a.type || '—'}
                                      </td>
                                      <td className="py-2 pr-2 text-c-text-secondary dark:text-c-text-muted">
                                        {(a.size / 1024 / 1024).toFixed(1)} MB
                                      </td>
                                      <td className="py-2 pr-2 text-c-text-secondary dark:text-c-text-muted">
                                        {a.uploadedAt
                                          ? new Date(a.uploadedAt).toLocaleDateString()
                                          : '—'}
                                      </td>
                                      <td className="py-2 pr-2 text-c-text-secondary dark:text-c-text-muted">
                                        {a.uploadedBy || '—'}
                                      </td>
                                      <td className="py-2 text-right">
                                        <button
                                          disabled={isDecisionStageLocked}
                                          onClick={() => handleDeleteAttachment(a.id)}
                                          className="p-1 text-c-text-secondary dark:text-c-text-muted hover:text-danger-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
                        <div className="bg-c-surface/70 rounded-2xl border border-c-border-subtle/60 p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-c-text">
                              {t('decisions.detail.linkedItems.title', 'Linked Items')}
                            </h3>
                            <button
                              disabled={isDecisionStageLocked}
                              onClick={() =>
                                handleAddLinkedItem({
                                  id: Math.random().toString(36).substr(2, 9),
                                  type: 'task',
                                  title: t(
                                    'decisions.detail.linkedItems.newLinkedItem',
                                    'New linked item'
                                  ),
                                })
                              }
                              className="px-2.5 py-1 rounded-lg text-xs font-medium border border-c-border-subtle/60 dark:border-c-border text-c-text-secondary hover:text-c-info hover:border-c-info/50 hover:bg-c-surface-raised transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              + {t('decisions.detail.governance.add', 'Add')}
                            </button>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-[11px] uppercase tracking-wide text-c-text-secondary dark:text-c-text-muted dark:text-c-text-secondary border-b border-c-border-subtle/50">
                                  <th className="text-left py-2 pr-2">
                                    {t('decisions.detail.governance.colType', 'Type')}
                                  </th>
                                  <th className="text-left py-2 pr-2">
                                    {t('decisions.detail.linkedItems.colTitle', 'Title')}
                                  </th>
                                  <th className="text-left py-2 pr-2">
                                    {t('decisions.detail.governance.colStatus', 'Status')}
                                  </th>
                                  <th className="text-left py-2 pr-2">
                                    {t('decisions.detail.linkedItems.colPriority', 'Priority')}
                                  </th>
                                  <th className="text-right py-2">
                                    {t('decisions.detail.governance.colActions', 'Actions')}
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-c-border-subtle/40">
                                {linkedItems.length === 0 ? (
                                  <tr>
                                    <td
                                      colSpan={5}
                                      className="py-6 text-center text-xs text-c-text-secondary dark:text-c-text-muted"
                                    >
                                      {t('decisions.detail.linkedItems.none', 'No linked items.')}
                                    </td>
                                  </tr>
                                ) : (
                                  linkedItems.map((item) => (
                                    <tr key={item.id}>
                                      <td className="py-2 pr-2 text-c-text-secondary dark:text-c-text-muted text-xs uppercase">
                                        {item.type}
                                      </td>
                                      <td className="py-2 pr-2 text-c-text-secondary max-w-[380px] truncate">
                                        {item.title}
                                      </td>
                                      <td className="py-2 pr-2 text-c-text-secondary dark:text-c-text-muted">
                                        {item.status || '—'}
                                      </td>
                                      <td className="py-2 pr-2 text-c-text-secondary dark:text-c-text-muted">
                                        {item.priority || '—'}
                                      </td>
                                      <td className="py-2 text-right">
                                        <button
                                          disabled={isDecisionStageLocked}
                                          onClick={() => handleRemoveLinkedItem(item)}
                                          className="p-1 text-c-text-secondary dark:text-c-text-muted hover:text-danger-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
                      <div className="bg-c-surface/70 rounded-2xl border border-c-border-subtle/60 p-4 space-y-3">
                        <h3 className="text-base font-semibold text-c-text">
                          {t('decisions.detail.activityLog.title', 'Activity Log')}
                        </h3>
                        {renderActivityLogPanel()}
                      </div>
                    )}
                  </div>

                  <div className="space-y-4 lg:sticky lg:top-28 self-start">
                    {decisionId && isPending && (
                      <div className="grid grid-cols-2 gap-2">
                        {/* FAZA C: bramka decision.approve (fail-open, shadow = bez zmian) */}
                        <CapabilityGate capability="decision.approve" gateMode="disable">
                          <button
                            onClick={handleApprove}
                            className="px-3 py-2 rounded-xl border border-emerald-400/50 text-emerald-500 hover:bg-emerald-500/10 text-sm font-medium"
                          >
                            {t('decisions.detail.actions.approve', 'Approve')}
                          </button>
                        </CapabilityGate>
                        <CapabilityGate capability="decision.approve" gateMode="disable">
                          <button
                            onClick={handleReject}
                            className="px-3 py-2 rounded-xl border border-danger-400/50 text-danger-500 hover:bg-danger-500/10 text-sm font-medium"
                          >
                            {t('decisions.detail.actions.reject', 'Reject')}
                          </button>
                        </CapabilityGate>
                        <button
                          onClick={handleRequestMoreInfo}
                          className="px-3 py-2 rounded-xl border border-c-border-subtle dark:border-c-border text-c-text-secondary text-sm"
                        >
                          {t('decisions.detail.actions.requestInfo', 'Request info')}
                        </button>
                        <button
                          onClick={() => setShowDelegationModal(true)}
                          className="px-3 py-2 rounded-xl border border-c-border-subtle dark:border-c-border text-c-text-secondary text-sm"
                        >
                          {t('decisions.detail.actions.delegate', 'Delegate')}
                        </button>
                      </div>
                    )}

                    <div className="bg-c-surface/80 rounded-2xl border border-c-border-subtle/60 p-4 space-y-3">
                      <h3 className="text-sm font-semibold text-c-text">
                        {t('decisions.detail.infoPane.title', 'Information pane')}
                      </h3>
                      <div className="space-y-2.5 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-c-text-secondary dark:text-c-text-muted dark:text-c-text-secondary text-xs uppercase tracking-wide">
                            {t('decisions.detail.governance.colStatus', 'Status')}
                          </span>
                          <span className="text-c-text font-medium">
                            {t(
                              `decisions.detail.statusValue.${status}`,
                              STATUS_CONFIG[status].label.en
                            )}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-c-text-secondary dark:text-c-text-muted dark:text-c-text-secondary text-xs uppercase tracking-wide">
                            {t('decisions.detail.linkedItems.colPriority', 'Priority')}
                          </span>
                          <span className="text-c-text font-medium">
                            {t(
                              `decisions.detail.priorityValue.${priority}`,
                              PRIORITY_CONFIG[priority].label.en
                            )}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-c-text-secondary dark:text-c-text-muted dark:text-c-text-secondary text-xs uppercase tracking-wide">
                            {t('decisions.detail.activityLog.deadline', 'Deadline')}
                          </span>
                          <span className="text-c-text">{dueDate || '—'}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-c-text-secondary dark:text-c-text-muted dark:text-c-text-secondary text-xs uppercase tracking-wide">
                            {t('decisions.detail.infoPane.requester', 'Requester')}
                          </span>
                          <span className="text-c-text text-right truncate">
                            {requesterName || '—'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-c-text-secondary dark:text-c-text-muted dark:text-c-text-secondary text-xs uppercase tracking-wide">
                            {t('decisions.detail.infoPane.decider', 'Decider')}
                          </span>
                          <span className="text-c-text text-right truncate">
                            {(() => {
                              const decider = users.find((u) => u.id === deciderId);
                              return decider ? `${decider.firstName} ${decider.lastName}` : '—';
                            })()}
                          </span>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-c-text-secondary dark:text-c-text-muted dark:text-c-text-secondary text-xs uppercase tracking-wide">
                            {t('decisions.detail.scope.relatedTo', 'Related to')}
                          </span>
                          <span className="text-c-text text-right max-w-[65%] break-words">
                            {decisionScopeLabel}
                          </span>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-c-text-secondary dark:text-c-text-muted dark:text-c-text-secondary text-xs uppercase tracking-wide">
                            {t('decisions.detail.infoPane.decisionIndex', 'Decision index')}
                          </span>
                          <span className="text-c-text text-right max-w-[65%] break-all text-xs font-mono">
                            {decisionIndexLabel}
                          </span>
                        </div>
                      </div>
                    </div>

                    {relatedNotes.length > 0 && (
                      <div className="bg-c-surface/80 rounded-2xl border border-c-border-subtle/60 overflow-hidden">
                        <motion.button
                          whileHover={{ backgroundColor: 'rgba(148, 163, 184, 0.1)' }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setRelatedNotesExpanded((e) => !e)}
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-c-surface/80 dark:hover:bg-c-surface-raised/50 transition-colors duration-200"
                        >
                          <div className="flex items-center gap-2.5 text-c-text">
                            <BookOpen
                              size={16}
                              className="text-c-text-secondary dark:text-c-text-muted"
                            />
                            <span className="text-sm font-semibold">
                              {t('myWork.decisions.relatedNotes', 'Related Notes')}
                            </span>
                          </div>
                          <motion.div
                            animate={{ rotate: relatedNotesExpanded ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronDown
                              size={16}
                              className="text-c-text-secondary dark:text-c-text-muted"
                            />
                          </motion.div>
                        </motion.button>
                        <AnimatePresence>
                          {relatedNotesExpanded && (
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: 'auto' }}
                              exit={{ height: 0 }}
                              className="border-t border-c-border-subtle overflow-hidden"
                            >
                              <div className="p-3 space-y-2">
                                {relatedNotes.map((note) => (
                                  <button
                                    key={note.id}
                                    type="button"
                                    onClick={() => {
                                      window.dispatchEvent(
                                        new CustomEvent('mywork-open-item', {
                                          detail: {
                                            type: 'notebook',
                                            id: note.id,
                                            name: note.title,
                                          },
                                        })
                                      );
                                    }}
                                    className="w-full text-left p-2.5 rounded-lg border border-c-border-subtle/60 bg-c-surface/50 hover:bg-c-surface-raised/60 transition-colors text-sm font-medium text-c-text truncate"
                                  >
                                    <span className="block truncate">{note.title}</span>
                                    <NotebookMetadataBadges
                                      captureSource={note.captureSource}
                                      captureMetadata={note.captureMetadata}
                                      convertedTo={note.convertedTo}
                                      isPolish={isPolish}
                                      className="mt-1"
                                    />
                                  </button>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          {/* ── Dokowany prawy panel artefaktu ──────────────────────────
              GRID ETAP 6 (2026-07-24, naprawa P0-1): BEZ `hidden xl:block`
              (wzorzec z Powiadomienia, NotificationDetailView.tsx:4196) —
              ta karta pokazywała panel tylko od 1280px, ukrywając na
              1024px (minimalny wspierany desktop) całe Akcje/Właściwości/
              Komentarze/Historię. Regresja funkcji pod pretekstem
              geometrii, nie estetyka. */}
          <div className="shrink-0 sticky top-4 self-start">
            <ArtifactRightPanel
              sections={rightPanelSections}
              className={ARTIFACT_PANEL_CARD_CLASS_STICKY}
              ariaLabel={t('myWork.decisionDetail.ariaLabel', 'Decision details')}
              statusBar={
                // HP-8 workflow-engine status bar — za `ff_artifactApprovalUi`.
                //
                // ── 2026-07-24: DWIE BRAMKI DOŁOŻONE (zmierzone na renderze) ──
                // (a) `!readMode` — w Podglądzie sekcja „Akcje" mówi wprost
                //     „Akcje są ukryte w trybie Podgląd", a NAD nią stał aktywny
                //     przycisk „Zgłoś do recenzji" z tego paska. Dwa sprzeczne
                //     komunikaty w jednym panelu. Podgląd = „do pokazania
                //     klientowi", więc wewnętrzny obieg akceptacji tam nie należy.
                // (b) `showApprovalBar` — pasek pokazywał „Szkic" na decyzji,
                //     której własny status brzmiał „Oczekująca" / etap
                //     „W przeglądzie". Powód: `ArtifactApprovalStatusBar` czyta
                //     WŁASNY rekord HP-7 i przy jego braku (albo błędzie
                //     endpointu) spada na `state ?? 'draft'` — czyli ZMYŚLA
                //     „Szkic". Dopóki pasek nie przyjmuje stanu z zewnątrz,
                //     mountujemy go tylko wtedy, gdy własny cykl życia karty
                //     JEST szkicem (`workflowStatus === 'proposed'`) — wtedy
                //     pasek i status karty mówią to samo. Poza szkicem prawdą
                //     jest status karty (Właściwości + przejścia w „Akcje").
                showApprovalBar ? (
                  <ArtifactApprovalStatusBar
                    artifactType="decision"
                    artifactId={decisionId as string}
                    currentUserId={currentUser?.id}
                    canReview
                  />
                ) : undefined
              }
            />
          </div>
        </div>
      </div>

      {/* ── ETAP 3: panel wyników „Analizuj z AI" ─────────────────────────────
          Slide-over przy prawej krawędzi (nie modal, nie przyciemnia kanwy).
          `readMode` ORuje się z blokadą etapu workflow — panel wyłącza
          „Zastosuj" dokładnie tam, gdzie ręczna edycja też jest zablokowana. */}
      <NCardAIAnalysisPanel
        open={decisionCardAnalysis.open}
        onClose={decisionCardAnalysis.close}
        loading={decisionCardAnalysis.loading}
        result={decisionCardAnalysis.result}
        errorCode={decisionCardAnalysis.errorCode}
        serverErrorCode={decisionCardAnalysis.serverErrorCode}
        onRerun={decisionCardAnalysis.rerun}
        onApplyChange={decisionCardAnalysis.applyChange}
        writableFieldIds={decisionWritableFieldIds}
        readMode={isDecisionStageLocked}
        isPolish={isPolish}
      />

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
                t('decisions.detail.activityLog.decisionDelegated', 'Decision delegated')
              );
            } catch (error) {
              console.error('[DecisionDetailView] Failed to reload after delegation:', error);
              toast.error(
                t(
                  'decisions.detail.toast.delegationSavedRefreshFailed',
                  'Delegation saved, but failed to refresh data'
                )
              );
            }
          }}
        />
      )}

      {showFollowUp && decisionId && (
        <PostDecisionFollowUp
          decision={{ id: decisionId, title, status, description, category }}
          onClose={() => setShowFollowUp(false)}
          onTasksCreated={(count) => {
            toast.success(
              t('decisions.detail.toast.tasksCreated', 'Created {{count}} tasks', { count })
            );
            setShowFollowUp(false);
          }}
        />
      )}
    </div>
  );
};

export default DecisionDetailView;
