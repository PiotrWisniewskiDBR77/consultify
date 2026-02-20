/**
 * ToolDocumentView
 *
 * Canonical full tool "document" view following Task/Initiative Golden Standard.
 * Two-column layout: LEFT = content/merit, RIGHT = control/management.
 *
 * LEFT COLUMN ORDER:
 * 1. Context (Strategic context, scope, goals)
 * 2. Tool Content (step-specific findings - collapsible sections)
 * 3. Correlations / Analysis (AI-generated insights)
 * 4. Summary & Key Findings
 * 5. Comments
 * 6. Activity Log
 *
 * RIGHT COLUMN ORDER:
 * 1. Control (Status, Progress, Session info, Quick Actions)
 * 2. DoD Checklist (Completion items)
 * 3. AI Configuration (Methodology, count, settings)
 * 4. Decisions (Gate decisions)
 * 5. Generated Initiatives
 * 6. Team / Permissions
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FileText,
  History,
  Lightbulb,
  Loader2,
  MessageSquare,
  MoreVertical,
  Plus,
  Save,
  Send,
  Settings,
  Sparkles,
  Target,
  Trash2,
  User,
  Users,
  Wand2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { useToolAI } from '@/hooks/discovery/useToolAI';
import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import { useConversationStore } from '@/store/useConversationStore';
import { SWOTData, ToolType, useToolStore } from '@/store/useToolStore';
import { AppView } from '@/types';
import { buildArtifactPermalink } from '@/utils/artifactLinks';
import { exportToPDF } from '@/utils/pdfExport';

import { type Comment, CommentsSection } from '../MyWork/shared';
import { ArtifactPermalinkButton } from '../shared/ArtifactPermalinkButton';
import { GenerateInitiativesModal } from './GenerateInitiativesModal';
import { ToolCanvas } from './ToolCanvas';
import { computeToolCompletionItems, computeToolReviewGaps } from './toolCompletion';

// ==================== TYPES ====================

interface ToolDocumentViewProps {
  toolType: ToolType;
  sessionId?: string;
  onBack: () => void;
  onOpenInitiative?: (initiativeId: string) => void;
}

interface HistoryEvent {
  id: string;
  eventType: string;
  createdAt: string;
  actorName?: string;
  payload?: any;
}

interface Decision {
  decision_type: string;
  status: string;
  decision_id?: string;
  decision_status?: string;
  owner_name?: string;
  due_date?: string;
}

// ==================== CONSTANTS ====================

const TOOL_METADATA: Record<
  ToolType,
  {
    name: string;
    namePl: string;
    color: string;
    badge: string;
    gradient: string;
  }
> = {
  'dynamic-swot': {
    name: 'Dynamic SWOT',
    namePl: 'Dynamiczny SWOT',
    color: 'emerald',
    badge: 'SWT',
    gradient: 'from-emerald-500 to-teal-500',
  },
  'market-forces': {
    name: 'Market Forces',
    namePl: 'Siły Rynkowe',
    color: 'blue',
    badge: 'PTR',
    gradient: 'from-blue-500 to-cyan-500',
  },
  'growth-paths': {
    name: 'Growth Paths',
    namePl: 'Ścieżki Wzrostu',
    color: 'purple',
    badge: 'ANS',
    gradient: 'from-purple-500 to-pink-500',
  },
  'value-chain': {
    name: 'Value Chain',
    namePl: 'Łańcuch Wartości',
    color: 'orange',
    badge: 'VCH',
    gradient: 'from-orange-500 to-amber-500',
  },
  'portfolio-priority': {
    name: 'Portfolio Priority',
    namePl: 'Priorytetyzacja Portfolio',
    color: 'pink',
    badge: 'BCG',
    gradient: 'from-pink-500 to-rose-500',
  },
  'ambition-decomposer': {
    name: 'Ambition Decomposer',
    namePl: 'Dekompozycja Ambicji',
    color: 'cyan',
    badge: 'AMB',
    gradient: 'from-cyan-500 to-blue-500',
  },
  'focus-tradeoff': {
    name: 'Focus & Trade-off',
    namePl: 'Fokus i Kompromisy',
    color: 'red',
    badge: 'FOC',
    gradient: 'from-red-500 to-orange-500',
  },
  'risk-uncertainty': {
    name: 'Risk & Uncertainty',
    namePl: 'Ryzyko i Niepewność',
    color: 'amber',
    badge: 'RSK',
    gradient: 'from-amber-500 to-yellow-500',
  },
  'capability-mapper': {
    name: 'Capability Mapper',
    namePl: 'Mapa Kompetencji',
    color: 'indigo',
    badge: 'CAP',
    gradient: 'from-indigo-500 to-purple-500',
  },
  'narrative-engine': {
    name: 'Narrative Engine',
    namePl: 'Silnik Narracji',
    color: 'teal',
    badge: 'NAR',
    gradient: 'from-teal-500 to-emerald-500',
  },
  'sop-builder': {
    name: 'SOP Builder',
    namePl: 'Kreator SOP',
    color: 'blue',
    badge: 'SOP',
    gradient: 'from-blue-500 to-indigo-500',
  },
  'a3-problem-solving': {
    name: 'A3 Problem Solving',
    namePl: 'A3 Rozwiązywanie',
    color: 'amber',
    badge: 'A3',
    gradient: 'from-amber-500 to-orange-500',
  },
  'smed-planner': {
    name: 'SMED Planner',
    namePl: 'Planer SMED',
    color: 'orange',
    badge: 'SMD',
    gradient: 'from-orange-500 to-red-500',
  },
  'dms-builder': {
    name: 'DMS Builder',
    namePl: 'Kreator DMS',
    color: 'emerald',
    badge: 'DMS',
    gradient: 'from-emerald-500 to-green-500',
  },
  'inventory-autopilot': {
    name: 'Inventory Autopilot',
    namePl: 'Autopilot Zapasów',
    color: 'purple',
    badge: 'INV',
    gradient: 'from-purple-500 to-violet-500',
  },
  'vsm-builder': {
    name: 'VSM Builder',
    namePl: 'Kreator VSM',
    color: 'blue',
    badge: 'VSM',
    gradient: 'from-blue-500 to-indigo-500',
  },
  'constraint-control': {
    name: 'Constraint Control',
    namePl: 'Kontrola Ograniczeń',
    color: 'amber',
    badge: 'CON',
    gradient: 'from-amber-500 to-orange-500',
  },
  'decision-engine': {
    name: 'Decision Engine',
    namePl: 'Silnik Decyzji',
    color: 'slate',
    badge: 'DEC',
    gradient: 'from-slate-500 to-zinc-500',
  },
  'control-tower': {
    name: 'Control Tower',
    namePl: 'Control Tower',
    color: 'teal',
    badge: 'CTW',
    gradient: 'from-teal-500 to-cyan-500',
  },
  'automation-pipeline': {
    name: 'Automation Pipeline',
    namePl: 'Pipeline Automatyzacji',
    color: 'purple',
    badge: 'AUT',
    gradient: 'from-purple-500 to-fuchsia-500',
  },
  'robotics-feasibility': {
    name: 'Robotics Feasibility',
    namePl: 'Wykonalność Robotyki',
    color: 'purple',
    badge: 'ROB',
    gradient: 'from-purple-500 to-indigo-500',
  },
  'logistics-automation': {
    name: 'Logistics Automation',
    namePl: 'Automatyzacja Logistyki',
    color: 'blue',
    badge: 'LOG',
    gradient: 'from-blue-500 to-cyan-500',
  },
  'rpa-scanner': {
    name: 'RPA Scanner',
    namePl: 'Skaner RPA',
    color: 'emerald',
    badge: 'RPA',
    gradient: 'from-emerald-500 to-teal-500',
  },
  'ai-discovery': {
    name: 'AI Discovery',
    namePl: 'AI Discovery',
    color: 'cyan',
    badge: 'AID',
    gradient: 'from-cyan-500 to-blue-500',
  },
  'integration-diagnostic': {
    name: 'Integration Diagnostic',
    namePl: 'Diagnostyka Integracji',
    color: 'indigo',
    badge: 'INT',
    gradient: 'from-indigo-500 to-purple-500',
  },
  'digital-value-pool': {
    name: 'Digital Value Pool',
    namePl: 'Pula Wartości Digital',
    color: 'pink',
    badge: 'DVP',
    gradient: 'from-pink-500 to-rose-500',
  },
  'legacy-analyzer': {
    name: 'Legacy Analyzer',
    namePl: 'Analizator Legacy',
    color: 'orange',
    badge: 'LEG',
    gradient: 'from-orange-500 to-amber-500',
  },
  'data-inventory': {
    name: 'Data Inventory',
    namePl: 'Inwentaryzacja Danych',
    color: 'teal',
    badge: 'DAT',
    gradient: 'from-teal-500 to-emerald-500',
  },
  'pain-to-solution': {
    name: 'Pain to Solution',
    namePl: 'Pain → Solution',
    color: 'red',
    badge: 'P2S',
    gradient: 'from-red-500 to-orange-500',
  },
  'pain-explorer': {
    name: 'Pain Explorer',
    namePl: 'Eksplorator Pain',
    color: 'amber',
    badge: 'SPE',
    gradient: 'from-amber-500 to-yellow-500',
  },
  'process-automation': {
    name: 'Process Automation',
    namePl: 'Automatyzacja Procesu',
    color: 'amber',
    badge: 'PAI',
    gradient: 'from-amber-500 to-orange-500',
  },
};

const STATUS_CONFIG = {
  DRAFT: {
    label: { en: 'Draft', pl: 'Wersja robocza' },
    color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    dotColor: 'bg-slate-400',
  },
  REVIEW: {
    label: { en: 'In Review', pl: 'W przeglądzie' },
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    dotColor: 'bg-amber-500',
  },
  APPROVED: {
    label: { en: 'Approved', pl: 'Zatwierdzony' },
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    dotColor: 'bg-emerald-500',
  },
  COMPLETED: {
    label: { en: 'Completed', pl: 'Ukończony' },
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    dotColor: 'bg-blue-500',
  },
  GENERATED: {
    label: { en: 'Generated', pl: 'Wygenerowano' },
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    dotColor: 'bg-blue-500',
  },
};

// ==================== COLLAPSIBLE SECTION ====================

const CollapsibleSection: React.FC<{
  id: string;
  title: string;
  icon: React.ReactNode;
  iconBg: string;
  expanded: boolean;
  onToggle: () => void;
  badge?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ id, title, icon, iconBg, expanded, onToggle, badge, children, actions }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden"
  >
    <div
      className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors cursor-pointer"
      onClick={onToggle}
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-xl ${iconBg}`}>{icon}</div>
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{title}</span>
      </div>
      <div className="flex items-center gap-2">
        {badge}
        {expanded && actions}
        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={18} className="text-slate-500 dark:text-slate-400" />
        </motion.div>
      </div>
    </div>
    <AnimatePresence>
      {expanded && (
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: 'auto' }}
          exit={{ height: 0 }}
          className="border-t border-slate-200 dark:border-navy-700 overflow-hidden"
        >
          <div className="p-5">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  </motion.div>
);

// ==================== MAIN COMPONENT ====================

export const ToolDocumentView: React.FC<ToolDocumentViewProps> = ({
  toolType,
  sessionId,
  onBack,
  onOpenInitiative,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const {
    currentOrganization,
    currentProjectId,
    isChatCollapsed,
    toggleChatCollapse,
    setCurrentView,
    activeChatMessages,
  } = useAppStore();
  const { updateWorkspaceFromView } = useConversationStore();

  // Tool store
  const {
    currentSession,
    currentStep,
    createSession,
    loadSession,
    saveSession,
    setCurrentStep,
    nextStep,
    prevStep,
    canAdvanceStep,
    calculateProgress,
    getStepDefinitions,
    hydrateSessionFromApi,
  } = useToolStore();

  // AI integration
  const {
    isStreaming,
    streamedContent,
    requestSuggestions,
    generateCorrelations,
    generateSummary,
  } = useToolAI({ toolType });

  // Local state
  const [toolSessionId, setToolSessionId] = useState<string | null>(sessionId || null);
  const [toolStatus, setToolStatus] = useState<
    'DRAFT' | 'REVIEW' | 'APPROVED' | 'GENERATED' | 'COMPLETED'
  >('DRAFT');
  const [sessionName, setSessionName] = useState('');
  const [createdAt, setCreatedAt] = useState('');
  const [lastModified, setLastModified] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Data state
  const [generatedInitiatives, setGeneratedInitiatives] = useState<
    { id: string; title: string; status?: string }[]
  >([]);
  const [toolDecisions, setToolDecisions] = useState<Decision[]>([]);
  const [toolPermissions, setToolPermissions] = useState<{
    canRequestReview?: boolean;
    canApproveTool?: boolean;
    canGenerate?: boolean;
  }>({});
  const [comments, setComments] = useState<Comment[]>([]);
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [users, setUsers] = useState<
    { id: string; firstName: string; lastName: string; email?: string }[]
  >([]);

  // UI state
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showRequestReviewModal, setShowRequestReviewModal] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  // Review request form
  const [reviewDueDate, setReviewDueDate] = useState('');
  const [reviewPriority, setReviewPriority] = useState<'low' | 'medium' | 'high' | 'critical'>(
    'medium'
  );
  const [reviewDecisionOwnerId, setReviewDecisionOwnerId] = useState('');

  // Generation settings
  const [generationDefaults, setGenerationDefaults] = useState({
    methodologyId: 'impact-feasibility',
    count: 3,
    includeChatContext: true,
  });

  const toolMeta = TOOL_METADATA[toolType];
  const stepDefs = getStepDefinitions();
  const progress = calculateProgress();

  // ==================== COMPUTED VALUES ====================

  const reviewGaps = useMemo(
    () => computeToolReviewGaps(toolType, currentSession?.inputData, isPolish),
    [toolType, currentSession?.inputData, isPolish]
  );

  const completionReady = reviewGaps.length === 0;

  const completionItems = useMemo(
    () => computeToolCompletionItems(toolType, currentSession?.inputData, isPolish),
    [toolType, currentSession?.inputData, isPolish]
  );

  const handleExportPdf = useCallback(async () => {
    try {
      setIsExportingPdf(true);
      const safeName = (sessionName || toolMeta.name || toolType)
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .toLowerCase();
      const date = new Date().toISOString().slice(0, 10);
      await exportToPDF('tool-report-export', {
        filename: `tool-report-${toolType}-${safeName}-${date}.pdf`,
        title: `${toolMeta.name} • Tool Report`,
        orientation: 'portrait',
      });
      toast.success(isPolish ? 'Wyeksportowano PDF' : 'PDF exported');
    } catch {
      toast.error(isPolish ? 'Nie udało się wyeksportować PDF' : 'PDF export failed');
    } finally {
      setIsExportingPdf(false);
    }
  }, [isPolish, sessionName, toolMeta.name, toolType]);

  const statusConfig = STATUS_CONFIG[toolStatus] || STATUS_CONFIG.DRAFT;

  // ==================== DATA FETCHING ====================

  const fetchAll = useCallback(async () => {
    if (!toolSessionId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Fetch tool session data
      const sessionData = await Api.getToolSession(toolSessionId);
      setToolStatus((sessionData.status || 'DRAFT').toUpperCase() as any);
      setSessionName(sessionData.name || '');
      setCreatedAt(sessionData.createdAt || '');
      setLastModified(sessionData.updatedAt || '');
      setGeneratedInitiatives(sessionData.generatedInitiatives || []);
      setToolDecisions(sessionData.decisions || []);
      setToolPermissions(sessionData.permissions || {});

      // Hydrate answers into store so step components are editable
      hydrateSessionFromApi({
        id: toolSessionId,
        toolType,
        name: sessionData.name,
        createdAt: sessionData.createdAt,
        updatedAt: sessionData.updatedAt,
        status: sessionData.status,
        answers: sessionData.answers || {},
        completionPercent: sessionData.completion_percent ?? sessionData.completionPercent,
      });

      // Fetch users
      const fetchedUsers = await Api.getUsers();
      setUsers(fetchedUsers || []);

      // TODO: Fetch comments and history when API is ready
      // const commentsData = await Api.getToolComments(toolSessionId);
      // setComments(commentsData || []);
      // const historyData = await Api.getToolHistory(toolSessionId);
      // setHistory(historyData || []);
    } catch (error) {
      console.error('Failed to fetch tool session:', error);
      toast.error(isPolish ? 'Błąd ładowania sesji' : 'Failed to load session');
    } finally {
      setLoading(false);
    }
  }, [toolSessionId, loadSession, isPolish]);

  // ==================== EFFECTS ====================

  // Initialize or create session
  useEffect(() => {
    const initSession = async () => {
      if (sessionId) {
        setToolSessionId(sessionId);
        loadSession(sessionId);
      } else if (!currentSession || currentSession.toolType !== toolType) {
        // Create new session
        createSession(toolType);
        const name = `${toolMeta.name} - ${new Date().toLocaleDateString()}`;
        try {
          const created = await Api.createToolSession({
            toolType,
            name,
            projectId: currentProjectId || null,
          });
          setToolSessionId(created.id);
          setToolStatus('DRAFT');
          setSessionName(name);
          setCreatedAt(new Date().toISOString());
        } catch (error) {
          console.error('Failed to create tool session:', error);
        }
      }
    };
    initSession();
  }, [
    sessionId,
    toolType,
    currentSession,
    createSession,
    loadSession,
    currentProjectId,
    toolMeta.name,
  ]);

  // Fetch data when session ID is set
  useEffect(() => {
    if (toolSessionId) {
      fetchAll();
    }
  }, [toolSessionId, fetchAll]);

  // Auto-save
  useEffect(() => {
    if (currentSession && toolSessionId) {
      const saveTimeout = setTimeout(async () => {
        try {
          await Api.updateToolSession(toolSessionId, {
            answers: currentSession.inputData as Record<string, unknown>,
            completionPercent: completionReady ? 100 : progress,
          });
          setLastModified(new Date().toISOString());
        } catch (error) {
          console.error('Auto-save failed:', error);
        }
      }, 2000);
      return () => clearTimeout(saveTimeout);
    }
    return undefined;
  }, [currentSession, toolSessionId, progress, completionReady]);

  // ==================== HANDLERS ====================

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!toolSessionId || !currentSession) return;
    setSaving(true);
    try {
      await Api.updateToolSession(toolSessionId, {
        answers: currentSession.inputData as Record<string, unknown>,
        completionPercent: completionReady ? 100 : progress,
      });
      await saveSession();
      toast.success(isPolish ? 'Zapisano' : 'Saved');
    } catch (error) {
      toast.error(isPolish ? 'Błąd zapisu' : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChat = () => {
    if (currentSession) {
      updateWorkspaceFromView(AppView.DISCOVERY_TOOLS_STRATEGIC, toolSessionId || undefined, {
        toolType,
        sessionName,
      });
    }
    if (isChatCollapsed) {
      toggleChatCollapse();
    }
  };

  const handleCopyToolPermalink = async () => {
    if (!toolSessionId) return;
    try {
      await navigator.clipboard.writeText(buildArtifactPermalink('tool', toolSessionId));
      toast.success(isPolish ? 'Link do narzędzia skopiowany' : 'Tool permalink copied');
    } catch {
      toast.error(isPolish ? 'Nie udało się skopiować linku' : 'Failed to copy link');
    }
  };

  const handleRequestReview = async () => {
    if (!toolSessionId || !completionReady) {
      toast.error(
        isPolish ? 'Wypełnij wszystkie wymagane pola' : 'Complete all required fields first'
      );
      return;
    }
    setShowRequestReviewModal(true);
  };

  const handleConfirmRequestReview = async () => {
    if (!toolSessionId) return;
    try {
      const result = await Api.requestToolReview(toolSessionId, {
        decisionOwnerId: reviewDecisionOwnerId || undefined,
        dueDate: reviewDueDate || undefined,
        priority: reviewPriority,
      });
      setToolStatus((result.status || 'REVIEW').toUpperCase() as any);
      toast.success(isPolish ? 'Wysłano do przeglądu' : 'Sent for review');
      await fetchAll();
      setShowRequestReviewModal(false);
      setReviewDecisionOwnerId('');
      setReviewDueDate('');
      setReviewPriority('medium');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to request review');
    }
  };

  const handleApprove = async () => {
    if (!toolSessionId) return;
    try {
      const result = await Api.approveTool(toolSessionId);
      setToolStatus((result.status || 'APPROVED').toUpperCase() as any);
      toast.success(isPolish ? 'Zatwierdzono' : 'Approved');
      setShowGenerateModal(true);
      await fetchAll();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to approve');
    }
  };

  const handleSendBack = async () => {
    if (!toolSessionId) return;
    const comment = prompt(isPolish ? 'Powód odesłania:' : 'Reason for sending back:');
    if (!comment) return;
    try {
      const result = await Api.sendToolBackToDraft(toolSessionId, comment);
      setToolStatus((result.status || 'DRAFT').toUpperCase() as any);
      toast.success(isPolish ? 'Odesłano do wersji roboczej' : 'Sent back to draft');
      await fetchAll();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send back');
    }
  };

  const handleGenerate = async (payload: {
    methodologyId: string;
    count: number;
    includeChatContext: boolean;
    decisionOwnerId?: string;
  }) => {
    if (!toolSessionId) return;
    if (toolPermissions.canGenerate === false) {
      toast.error(isPolish ? 'Brak uprawnień' : 'Permission denied');
      return;
    }
    try {
      setGenerationDefaults(payload);
      const result = await Api.generateToolInitiatives(toolSessionId, payload);
      if (result?.status) {
        setToolStatus(String(result.status).toUpperCase() as any);
      }
      const updated = await Api.getToolGeneratedInitiatives(toolSessionId);
      setGeneratedInitiatives(updated.initiatives || []);
      await fetchAll();
      setShowGenerateModal(false);
      toast.success(isPolish ? 'Wygenerowano inicjatywy' : 'Initiatives generated');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to generate');
    }
  };

  const handleGenerateAI = async (section: string) => {
    setIsGeneratingAI(true);
    try {
      if (section === 'tool-content') {
        const currentStepDef = stepDefs[currentStep - 1];
        if (currentStepDef?.id === 'correlations') {
          await generateCorrelations();
        } else if (
          ['summary', 'results', 'reasoning', 'prepare', 'initiatives'].includes(
            currentStepDef?.id || ''
          )
        ) {
          await generateSummary();
        } else {
          await requestSuggestions();
        }
      } else if (section === 'correlations') {
        await generateCorrelations();
      } else if (section === 'summary') {
        await generateSummary();
      } else {
        await requestSuggestions();
      }
      toast.success(isPolish ? 'Wygenerowano sugestie AI' : 'AI suggestions generated');
    } catch (error) {
      toast.error(isPolish ? 'Błąd generowania AI' : 'AI generation failed');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // ==================== RENDER ====================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50 dark:bg-navy-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          <p className="text-sm text-slate-500">{isPolish ? 'Ładowanie...' : 'Loading...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950">
      {/* ==================== HEADER ==================== */}
      <div className="bg-white/80 dark:bg-navy-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-navy-700/60 px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left: Back + Title */}
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-600 dark:text-slate-400 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <span
                className={`px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r ${toolMeta.gradient} text-white`}
              >
                {toolMeta.badge}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-semibold text-slate-900 dark:text-white">
                    {isPolish ? toolMeta.namePl : toolMeta.name}
                  </h1>
                  {toolSessionId && (
                    <ArtifactPermalinkButton
                      artifactType="tool"
                      artifactId={toolSessionId}
                      isPolish={isPolish}
                      size={14}
                      className="p-1"
                    />
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{sessionName}</p>
              </div>
            </div>
          </div>

          {/* Center: Status Badge */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${statusConfig.color}`}>
            <span className={`w-2 h-2 rounded-full ${statusConfig.dotColor}`} />
            <span className="text-sm font-medium">
              {isPolish ? statusConfig.label.pl : statusConfig.label.en}
            </span>
            <span className="text-xs opacity-70">({progress}%)</span>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isPolish ? 'Zapisz' : 'Save'}
            </button>

            <button
              onClick={handleOpenChat}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              Chat
            </button>

            {/* More Menu */}
            <div className="relative">
              <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-600 dark:text-slate-400 transition-colors"
              >
                <MoreVertical className="w-5 h-5" />
              </button>

              <AnimatePresence>
                {showMoreMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-navy-800 rounded-xl shadow-xl border border-slate-200 dark:border-navy-700 py-2 z-50"
                  >
                    <button
                      onClick={() => {
                        void handleCopyToolPermalink();
                        setShowMoreMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700"
                    >
                      <Copy className="w-4 h-4" />
                      {isPolish ? 'Kopiuj link' : 'Copy link'}
                    </button>
                    <button
                      onClick={() => {
                        window.open(window.location.href, '_blank');
                        setShowMoreMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700"
                    >
                      <ExternalLink className="w-4 h-4" />
                      {isPolish ? 'Otwórz w nowej karcie' : 'Open in new tab'}
                    </button>
                    <button
                      onClick={() => {
                        setShowMoreMenu(false);
                        void handleExportPdf();
                      }}
                      disabled={isExportingPdf}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700 ${
                        isExportingPdf ? 'opacity-60 cursor-not-allowed' : ''
                      }`}
                    >
                      <Download className="w-4 h-4" />
                      {isExportingPdf
                        ? isPolish
                          ? 'Eksportuję...'
                          : 'Exporting...'
                        : isPolish
                          ? 'Eksportuj PDF'
                          : 'Export PDF'}
                    </button>
                    <div className="border-t border-slate-200 dark:border-navy-700 my-2" />
                    <button
                      onClick={() => {
                        toast.error('Unable to delete this item.');
                        setShowMoreMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="w-4 h-4" />
                      {isPolish ? 'Usuń' : 'Delete'}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Step Progress Pills */}
        <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-2">
          {stepDefs.map((step, index) => {
            const stepNum = index + 1;
            const isCompleted = currentSession?.steps?.some(
              (s) => s.stepId === step.id && s.status === 'completed'
            );
            const isActive = currentStep === stepNum;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setCurrentStep(stepNum)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs whitespace-nowrap ${
                  isActive
                    ? `bg-gradient-to-r ${toolMeta.gradient} text-white shadow-sm`
                    : isCompleted
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                      : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                {isCompleted ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-navy-700 flex items-center justify-center text-[10px]">
                    {stepNum}
                  </span>
                )}
                <span>{isPolish ? step.namePl : step.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ==================== MAIN CONTENT ==================== */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex">
          {/* ==================== LEFT COLUMN ==================== */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Tool Content Section */}
            <CollapsibleSection
              id="tool-content"
              title={isPolish ? 'Zawartość narzędzia' : 'Tool Content'}
              icon={<BarChart3 size={18} className="text-white" />}
              iconBg={`bg-gradient-to-br ${toolMeta.gradient}`}
              expanded={expandedSections.has('tool-content')}
              onToggle={() => toggleSection('tool-content')}
              badge={
                <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400">
                  {completionItems.filter((i) => i.done).length}/{completionItems.length}
                </span>
              }
              actions={
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleGenerateAI('suggestions');
                  }}
                  disabled={isGeneratingAI}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 hover:bg-primary-200"
                >
                  {isGeneratingAI ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  AI
                </button>
              }
            >
              {currentSession ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 dark:border-navy-700/60 overflow-hidden bg-white/50 dark:bg-navy-900/40">
                    <ToolCanvas
                      toolType={toolType}
                      currentStep={currentStep}
                      stepDefinition={stepDefs[currentStep - 1]}
                      session={currentSession}
                      isStreaming={isStreaming}
                      streamedContent={streamedContent || ''}
                      isPolish={isPolish}
                      orgName={currentOrganization?.name}
                      onOpenChat={handleOpenChat}
                      onOpenInitiatives={() => setShowGenerateModal(true)}
                      generatedInitiatives={generatedInitiatives}
                      recentInitiatives={generatedInitiatives.slice(0, 5)}
                      chatSnippets={(activeChatMessages || []).slice(-6).map((m: any) => ({
                        role: m.role,
                        content: m.content,
                      }))}
                      showContextPanel={false}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => prevStep()}
                      disabled={currentStep <= 1}
                      className="px-3 py-2 rounded-lg text-sm bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300 disabled:opacity-50"
                    >
                      {isPolish ? 'Wstecz' : 'Previous'}
                    </button>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {isPolish ? 'Krok' : 'Step'} {currentStep}/{stepDefs.length} —{' '}
                      {isPolish
                        ? stepDefs[currentStep - 1]?.namePl
                        : stepDefs[currentStep - 1]?.name}
                    </div>
                    <button
                      type="button"
                      onClick={() => nextStep()}
                      disabled={currentStep >= stepDefs.length || !canAdvanceStep()}
                      className={`px-3 py-2 rounded-lg text-sm text-white disabled:opacity-50 ${
                        currentStep >= stepDefs.length || !canAdvanceStep()
                          ? 'bg-slate-400'
                          : `bg-gradient-to-r ${toolMeta.gradient}`
                      }`}
                    >
                      {isPolish ? 'Dalej' : 'Next'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  {isPolish ? 'Brak danych sesji' : 'No session data'}
                </div>
              )}
            </CollapsibleSection>

            {/* Analysis / Correlations Section */}
            <CollapsibleSection
              id="analysis"
              title={isPolish ? 'Analiza i wnioski' : 'Analysis & Insights'}
              icon={<Wand2 size={18} className="text-white" />}
              iconBg="bg-gradient-to-br from-purple-500 to-pink-500"
              expanded={expandedSections.has('analysis')}
              onToggle={() => toggleSection('analysis')}
              actions={
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleGenerateAI('correlations');
                  }}
                  disabled={isGeneratingAI}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 hover:bg-primary-200"
                >
                  {isGeneratingAI ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  {isPolish ? 'Generuj' : 'Generate'}
                </button>
              }
            >
              <div className="space-y-4">
                {isStreaming && (
                  <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                      <span className="text-sm font-medium text-purple-700 dark:text-purple-400">
                        {isPolish ? 'Generowanie...' : 'Generating...'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                      {streamedContent}
                    </p>
                  </div>
                )}
                {!isStreaming && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
                    {isPolish
                      ? 'Kliknij "Generuj" aby AI przeanalizowało dane i wygenerowało wnioski.'
                      : 'Click "Generate" for AI to analyze data and generate insights.'}
                  </p>
                )}
              </div>
            </CollapsibleSection>

            {/* Summary Section */}
            <CollapsibleSection
              id="summary"
              title={isPolish ? 'Podsumowanie' : 'Summary'}
              icon={<FileText size={18} className="text-white" />}
              iconBg="bg-gradient-to-br from-teal-500 to-emerald-500"
              expanded={expandedSections.has('summary')}
              onToggle={() => toggleSection('summary')}
              actions={
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleGenerateAI('summary');
                  }}
                  disabled={isGeneratingAI}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 hover:bg-primary-200"
                >
                  {isGeneratingAI ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  AI
                </button>
              }
            >
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <p className="text-slate-600 dark:text-slate-400">
                  {(currentSession?.inputData as any)?.summary?.keyInsights?.join('. ') ||
                    (isPolish
                      ? 'Brak podsumowania. Wygeneruj je za pomocą AI.'
                      : 'No summary yet. Generate one using AI.')}
                </p>
              </div>
            </CollapsibleSection>

            {/* Comments Section */}
            <CollapsibleSection
              id="comments"
              title={isPolish ? 'Komentarze' : 'Comments'}
              icon={<MessageSquare size={18} className="text-white" />}
              iconBg="bg-gradient-to-br from-blue-500 to-indigo-500"
              expanded={expandedSections.has('comments')}
              onToggle={() => toggleSection('comments')}
              badge={
                comments.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                    {comments.length}
                  </span>
                )
              }
            >
              <CommentsSection
                comments={comments}
                onAddComment={async (content) => {
                  // TODO: Implement when API is ready
                  toast.success(isPolish ? 'Komentarz dodany' : 'Comment added');
                }}
                onDeleteComment={async (commentId) => {
                  // TODO: Implement when API is ready
                  toast.success(isPolish ? 'Komentarz usunięty' : 'Comment deleted');
                }}
                onLikeComment={async (commentId) => {
                  // TODO: Implement when API is ready
                }}
                onGenerateAIComment={async () => {
                  await handleGenerateAI('comments');
                }}
                isGeneratingAI={isGeneratingAI}
              />
            </CollapsibleSection>

            {/* Activity Log Section */}
            <CollapsibleSection
              id="activity"
              title={isPolish ? 'Historia aktywności' : 'Activity Log'}
              icon={<History size={18} className="text-white" />}
              iconBg="bg-gradient-to-br from-slate-500 to-slate-600"
              expanded={expandedSections.has('activity')}
              onToggle={() => toggleSection('activity')}
            >
              <div className="space-y-3">
                {history.length === 0 && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                    {isPolish ? 'Brak historii' : 'No activity yet'}
                  </p>
                )}
                {history.map((event) => (
                  <div key={event.id} className="flex items-start gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 mt-2" />
                    <div>
                      <p className="text-slate-700 dark:text-slate-300">{event.eventType}</p>
                      <p className="text-xs text-slate-500">
                        {event.actorName} • {new Date(event.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          </div>

          {/* ==================== RIGHT COLUMN ==================== */}
          <div className="w-96 border-l border-slate-200 dark:border-navy-700/60 bg-slate-50/50 dark:bg-navy-900/50 overflow-y-auto p-6 space-y-4">
            {/* Control Panel */}
            <div className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-navy-700/60 p-5">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
                {isPolish ? 'Panel sterowania' : 'Control Panel'}
              </h3>

              {/* Status */}
              <div className="mb-4">
                <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">
                  {isPolish ? 'Status' : 'Status'}
                </label>
                <div
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${statusConfig.color}`}
                >
                  <span className={`w-2 h-2 rounded-full ${statusConfig.dotColor}`} />
                  <span className="text-sm font-medium">
                    {isPolish ? statusConfig.label.pl : statusConfig.label.en}
                  </span>
                </div>
              </div>

              {/* Progress */}
              <div className="mb-4">
                <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">
                  {isPolish ? 'Postęp' : 'Progress'}
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${toolMeta.gradient} transition-all duration-500`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {progress}%
                  </span>
                </div>
              </div>

              {/* Session Info */}
              <div className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex justify-between">
                  <span>{isPolish ? 'Utworzono' : 'Created'}</span>
                  <span>{createdAt ? new Date(createdAt).toLocaleDateString() : '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span>{isPolish ? 'Ostatnia zmiana' : 'Last modified'}</span>
                  <span>{lastModified ? new Date(lastModified).toLocaleString() : '-'}</span>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-navy-700 space-y-2">
                {toolStatus === 'DRAFT' && (
                  <button
                    onClick={handleRequestReview}
                    disabled={!completionReady || toolPermissions.canRequestReview === false}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      completionReady && toolPermissions.canRequestReview !== false
                        ? 'bg-amber-500 hover:bg-amber-600 text-white'
                        : 'bg-slate-100 dark:bg-navy-800 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <Send className="w-4 h-4" />
                    {isPolish ? 'Wyślij do przeglądu' : 'Request Review'}
                  </button>
                )}

                {toolStatus === 'REVIEW' && (
                  <>
                    <button
                      onClick={handleApprove}
                      disabled={toolPermissions.canApproveTool === false}
                      className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                        toolPermissions.canApproveTool !== false
                          ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                          : 'bg-slate-100 dark:bg-navy-800 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                      {isPolish ? 'Zatwierdź' : 'Approve'}
                    </button>
                    <button
                      onClick={handleSendBack}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      {isPolish ? 'Odeślij do draftu' : 'Send Back'}
                    </button>
                  </>
                )}

                {(toolStatus === 'APPROVED' ||
                  toolStatus === 'GENERATED' ||
                  toolStatus === 'COMPLETED') && (
                  <button
                    onClick={() => setShowGenerateModal(true)}
                    disabled={toolPermissions.canGenerate === false}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      toolPermissions.canGenerate !== false
                        ? `bg-gradient-to-r ${toolMeta.gradient} hover:opacity-90 text-white`
                        : 'bg-slate-100 dark:bg-navy-800 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <Lightbulb className="w-4 h-4" />
                    {isPolish ? 'Generuj inicjatywy' : 'Generate Initiatives'}
                  </button>
                )}
              </div>
            </div>

            {/* DoD Checklist */}
            <div className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-navy-700/60 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {isPolish ? 'Lista kontrolna (DoD)' : 'Completion Checklist (DoD)'}
                </h3>
                {completionReady ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                )}
              </div>

              <div className="space-y-2">
                {completionItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span
                      className={`w-2 h-2 rounded-full ${item.done ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                    />
                    <span
                      className={`text-sm ${item.done ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}`}
                    >
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>

              {reviewGaps.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-navy-700">
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-2">
                    {isPolish ? 'Brakujące elementy:' : 'Missing items:'}
                  </p>
                  <ul className="space-y-1">
                    {reviewGaps.map((gap, idx) => (
                      <li key={idx} className="text-xs text-slate-500 dark:text-slate-400">
                        • {gap}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* AI Configuration */}
            <div className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-navy-700/60 p-5">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                <Settings className="w-4 h-4" />
                {isPolish ? 'Ustawienia generowania' : 'Generation Settings'}
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">
                    {isPolish ? 'Metodyka' : 'Methodology'}
                  </label>
                  <select
                    value={generationDefaults.methodologyId}
                    onChange={(e) =>
                      setGenerationDefaults({
                        ...generationDefaults,
                        methodologyId: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-sm text-slate-700 dark:text-slate-300"
                  >
                    <option value="impact-feasibility">Impact-Feasibility Matrix</option>
                    <option value="strategic-alignment">Strategic Alignment</option>
                    <option value="quick-wins">Quick Wins First</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">
                    {isPolish ? 'Liczba inicjatyw' : 'Number of initiatives'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={generationDefaults.count}
                    onChange={(e) =>
                      setGenerationDefaults({
                        ...generationDefaults,
                        count: parseInt(e.target.value) || 3,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-sm text-slate-700 dark:text-slate-300"
                  />
                </div>

                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <input
                    type="checkbox"
                    checked={generationDefaults.includeChatContext}
                    onChange={(e) =>
                      setGenerationDefaults({
                        ...generationDefaults,
                        includeChatContext: e.target.checked,
                      })
                    }
                    className="rounded border-slate-300 dark:border-navy-600"
                  />
                  {isPolish ? 'Uwzględnij kontekst z chatu' : 'Include chat context'}
                </label>
              </div>
            </div>

            {/* Decisions */}
            {toolDecisions.length > 0 && (
              <div className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-navy-700/60 p-5">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
                  {isPolish ? 'Decyzje bramkowe' : 'Gate Decisions'}
                </h3>

                <div className="space-y-3">
                  {toolDecisions.map((decision, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {decision.decision_type}
                      </span>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          decision.decision_status === 'APPROVED' || decision.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : decision.decision_status === 'REJECTED' ||
                                decision.status === 'REJECTED'
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        }`}
                      >
                        {decision.decision_status || decision.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Generated Initiatives */}
            <div className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-navy-700/60 p-5">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                {isPolish ? 'Wygenerowane inicjatywy' : 'Generated Initiatives'}
              </h3>

              {generatedInitiatives.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                  {isPolish ? 'Brak wygenerowanych inicjatyw' : 'No initiatives generated yet'}
                </p>
              ) : (
                <div className="space-y-2">
                  {generatedInitiatives.map((initiative) => (
                    <button
                      key={initiative.id}
                      onClick={() => onOpenInitiative?.(initiative.id)}
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-navy-800 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors text-left"
                    >
                      <span className="text-sm text-slate-700 dark:text-slate-300 truncate">
                        {initiative.title}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Team / Permissions */}
            <div className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-navy-700/60 p-5">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                <Users className="w-4 h-4" />
                {isPolish ? 'Uprawnienia' : 'Permissions'}
              </h3>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400">
                    {isPolish ? 'Request Review' : 'Request Review'}
                  </span>
                  <span
                    className={
                      toolPermissions.canRequestReview !== false
                        ? 'text-emerald-500'
                        : 'text-slate-400'
                    }
                  >
                    {toolPermissions.canRequestReview !== false ? '✓' : '✗'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400">
                    {isPolish ? 'Approve' : 'Approve'}
                  </span>
                  <span
                    className={
                      toolPermissions.canApproveTool !== false
                        ? 'text-emerald-500'
                        : 'text-slate-400'
                    }
                  >
                    {toolPermissions.canApproveTool !== false ? '✓' : '✗'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400">
                    {isPolish ? 'Generate' : 'Generate'}
                  </span>
                  <span
                    className={
                      toolPermissions.canGenerate !== false ? 'text-emerald-500' : 'text-slate-400'
                    }
                  >
                    {toolPermissions.canGenerate !== false ? '✓' : '✗'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ==================== MODALS ==================== */}
      {showGenerateModal && (
        <GenerateInitiativesModal
          isPolish={isPolish}
          defaults={generationDefaults}
          onClose={() => setShowGenerateModal(false)}
          onGenerate={handleGenerate}
        />
      )}

      {showRequestReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-navy-900 rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden"
          >
            <div className="p-6 border-b border-slate-200 dark:border-navy-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {isPolish ? 'Wyślij do przeglądu' : 'Request Review'}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {isPolish
                  ? 'Sprawdź kompletność i potwierdź wysłanie do review.'
                  : 'Check completeness and confirm sending to review.'}
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    {isPolish ? 'Wszystkie wymagania spełnione' : 'All requirements met'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {isPolish ? 'Decision Owner (opcjonalnie)' : 'Decision Owner (optional)'}
                </label>
                <select
                  value={reviewDecisionOwnerId}
                  onChange={(e) => setReviewDecisionOwnerId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
                >
                  <option value="">{isPolish ? '-- Wybierz --' : '-- Select --'}</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.firstName} {user.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {isPolish ? 'Termin' : 'Due date'}
                </label>
                <input
                  type="date"
                  value={reviewDueDate}
                  onChange={(e) => setReviewDueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {isPolish ? 'Priorytet' : 'Priority'}
                </label>
                <select
                  value={reviewPriority}
                  onChange={(e) => setReviewPriority(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
                >
                  <option value="low">{isPolish ? 'Niski' : 'Low'}</option>
                  <option value="medium">{isPolish ? 'Średni' : 'Medium'}</option>
                  <option value="high">{isPolish ? 'Wysoki' : 'High'}</option>
                  <option value="critical">{isPolish ? 'Krytyczny' : 'Critical'}</option>
                </select>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 dark:border-navy-700 flex justify-end gap-3">
              <button
                onClick={() => setShowRequestReviewModal(false)}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg"
              >
                {isPolish ? 'Anuluj' : 'Cancel'}
              </button>
              <button
                onClick={handleConfirmRequestReview}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium"
              >
                {isPolish ? 'Wyślij do review' : 'Send to review'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Hidden printable Tool Report (used for PDF export) */}
      <div
        id="tool-report-export"
        className="fixed left-[-10000px] top-0 w-[210mm] bg-white text-slate-900 p-8"
      >
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Consultinity • Tools
            </div>
            <h1 className="text-2xl font-bold mt-1">Tool Report</h1>
            <div className="text-sm text-slate-700 mt-1">
              {toolMeta.name} • {sessionName || toolSessionId || '—'}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Organization: {currentOrganization?.name || currentOrganization?.id || '—'}
              {currentProjectId ? ` • Project: ${currentProjectId}` : ''}
            </div>
          </div>
          <div className="text-right text-xs text-slate-600">
            <div>
              <span className="font-semibold text-slate-800">Status:</span> {toolStatus}
            </div>
            <div>
              <span className="font-semibold text-slate-800">Completion:</span>{' '}
              {Math.round(progress)}%
            </div>
            <div>
              <span className="font-semibold text-slate-800">Generated:</span>{' '}
              {new Date().toLocaleString()}
            </div>
          </div>
        </div>

        <hr className="my-5 border-slate-200" />

        <section className="mb-5">
          <h2 className="text-sm font-semibold text-slate-900">Executive Summary</h2>
          <p className="text-xs text-slate-600 mt-1">
            Snapshot export of the current tool session. Use the Reports module for governance /
            management reporting.
          </p>
        </section>

        <section className="mb-5">
          <h2 className="text-sm font-semibold text-slate-900">DoD / Quality</h2>
          <ul className="mt-2 space-y-1 text-xs text-slate-700">
            <li>
              <span className="font-semibold">Completion:</span> {Math.round(progress)}%
            </li>
            <li>
              <span className="font-semibold">Review gaps:</span> {reviewGaps.length}
            </li>
          </ul>
        </section>

        <section className="mb-5">
          <h2 className="text-sm font-semibold text-slate-900">Findings (tool data)</h2>
          <pre className="mt-2 text-[10px] leading-4 bg-slate-50 border border-slate-200 rounded-lg p-3 whitespace-pre-wrap break-words">
            {JSON.stringify(currentSession?.inputData || {}, null, 2)}
          </pre>
        </section>

        <section className="mb-5">
          <h2 className="text-sm font-semibold text-slate-900">Review & approval log</h2>
          {toolDecisions.length === 0 ? (
            <div className="text-xs text-slate-500 mt-2">No decisions recorded.</div>
          ) : (
            <ul className="mt-2 space-y-1 text-xs text-slate-700">
              {toolDecisions.map((d, idx) => (
                <li key={`${d.decision_type}-${d.decision_id || idx}`}>
                  <span className="font-semibold">{d.decision_type}</span> • {d.status}
                  {d.owner_name ? ` • owner: ${d.owner_name}` : ''}
                  {d.due_date ? ` • due: ${d.due_date}` : ''}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mb-2">
          <h2 className="text-sm font-semibold text-slate-900">Generated initiatives</h2>
          {generatedInitiatives.length === 0 ? (
            <div className="text-xs text-slate-500 mt-2">No initiatives generated.</div>
          ) : (
            <ol className="mt-2 space-y-1 text-xs text-slate-700 list-decimal list-inside">
              {generatedInitiatives.map((i) => (
                <li key={i.id}>
                  {i.title}
                  {i.status ? ` • ${i.status}` : ''}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {/* Click outside handler for more menu */}
      {showMoreMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
      )}
    </div>
  );
};

export default ToolDocumentView;
