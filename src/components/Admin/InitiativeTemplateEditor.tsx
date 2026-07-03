/**
 * InitiativeTemplateEditor
 *
 * Comprehensive initiative template editor covering all aspects of
 * project management methodology:
 *
 * Tabs:
 * 1. Basic Info       – name, description, level, sources, category
 * 2. Sections         – section selection, ordering, per-section config
 * 3. Workflow & Gates – phases, gate rules, approval, validation
 * 4. Tasks & Milestones – suggested tasks, milestones, decisions
 * 5. Team & Resources – required roles, FTE, RACI
 * 6. KPIs & Finance   – suggested KPIs, financial requirements, benefits
 * 7. Communication    – notifications, escalation, status reports, RAID
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Bell,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  DollarSign,
  FileText,
  Flag,
  Layers,
  Loader2,
  MessageSquare,
  Milestone,
  Plus,
  Save,
  Scale,
  Shield,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { Api } from '@/services/api';

// ==========================================
// TYPES
// ==========================================

type TemplateLevel = 'quick_win' | 'standard' | 'enterprise' | 'full_charter';

interface SectionType {
  id: string;
  key: string;
  name: string;
  namePl: string | null;
  description: string | null;
  category: 'content' | 'control' | 'meta';
  columnPosition: 'left' | 'right';
  defaultOrder: number;
  icon: string | null;
  iconColor: string | null;
  iconBg: string | null;
  componentKey: string;
  isSystem: boolean;
  isActive: boolean;
}

interface SuggestedTask {
  id: string;
  title: string;
  description?: string;
  taskType: string;
  stepPhase: string;
  priority: string;
  estimatedHours?: number;
}

interface SuggestedMilestone {
  id: string;
  name: string;
  description?: string;
  isGate: boolean;
  orderIndex: number;
}

interface SuggestedDecision {
  id: string;
  title: string;
  type: string;
  priority: string;
  triggerAtStatus?: string;
  pmoDomain?: string;
}

interface SuggestedKpi {
  id: string;
  name: string;
  unit: string;
  targetValue?: number;
  measurementFrequency: string;
}

interface RaidTemplate {
  id: string;
  type: 'RISK' | 'ASSUMPTION' | 'ISSUE' | 'DEPENDENCY';
  title: string;
  description?: string;
  probability?: string;
  impact?: string;
}

interface InitiativeTemplateEditorProps {
  templateId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

// ==========================================
// CONSTANTS
// ==========================================

const LEVEL_OPTIONS: {
  value: TemplateLevel;
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  desc: string;
}[] = [
  {
    value: 'quick_win',
    label: 'Quick Win',
    icon: Zap,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/15 border-emerald-500/30',
    desc: 'Minimal, fast action',
  },
  {
    value: 'standard',
    label: 'Standard',
    icon: FileText,
    color: 'text-blue-500',
    bg: 'bg-blue-500/15 border-blue-500/30',
    desc: 'Standard project',
  },
  {
    value: 'enterprise',
    label: 'Enterprise',
    icon: Target,
    color: 'text-primary-500',
    bg: 'bg-primary-500/15 border-primary-500/30',
    desc: 'Full governance',
  },
  {
    value: 'full_charter',
    label: 'Full Charter',
    icon: Sparkles,
    color: 'text-amber-500',
    bg: 'bg-amber-500/15 border-amber-500/30',
    desc: 'Complete investment case',
  },
];

const SOURCE_OPTIONS = [
  { value: 'assessment', label: 'Assessment' },
  { value: 'tool', label: 'Tool' },
  { value: 'manual', label: 'Manual' },
  { value: 'ai', label: 'AI' },
];

const CATEGORY_COLORS: Record<string, { color: string; bg: string }> = {
  content: { color: 'text-blue-500', bg: 'bg-blue-500/10' },
  control: { color: 'text-primary-500', bg: 'bg-primary-500/10' },
  meta: { color: 'text-slate-500', bg: 'bg-slate-500/10' },
};

const WORKFLOW_PHASES = ['PLAN', 'BUILD', 'TEST', 'DEPLOY', 'REVIEW', 'CLOSE'];
const TASK_PHASES = ['design', 'pilot', 'rollout', 'closeout'];
const TASK_TYPES = [
  'analysis',
  'design',
  'development',
  'testing',
  'deployment',
  'documentation',
  'decision',
  'communication',
];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const DECISION_TYPES = [
  'GO_NO_GO',
  'APPROVAL',
  'RESOURCE_ALLOCATION',
  'PHASE_TRANSITION',
  'SCOPE_CHANGE',
  'BUDGET',
];
const PMO_DOMAINS = [
  'GOVERNANCE_DECISION_MAKING',
  'RESOURCE_RESPONSIBILITY',
  'SCHEDULE_MILESTONES',
  'BENEFITS_REALIZATION',
  'RISK_MANAGEMENT',
];
const KPI_UNITS = ['%', 'PLN', 'USD', 'EUR', 'count', 'hours', 'days', 'score'];
const KPI_FREQUENCIES = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'ONCE'];
const RAID_TYPES: ('RISK' | 'ASSUMPTION' | 'ISSUE' | 'DEPENDENCY')[] = [
  'RISK',
  'ASSUMPTION',
  'ISSUE',
  'DEPENDENCY',
];
const PROBABILITY_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'];
const IMPACT_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const GATE_NAMES = [
  'SUBMIT_FOR_REVIEW',
  'APPROVE_TO_INITIATIVE',
  'APPROVE',
  'START_PLANNING',
  'SCHEDULE',
  'START',
  'COMPLETE',
  'START_TRACKING',
];
const TEAM_ROLES = [
  'lead',
  'member',
  'consultant',
  'stakeholder',
  'sponsor',
  'analyst',
  'architect',
  'tester',
];
const RACI_TYPES = ['R', 'A', 'C', 'I'];
const REPORT_FREQUENCIES = ['weekly', 'biweekly', 'monthly', 'quarterly'];
const TRIGGER_STATUSES = [
  'DRAFT',
  'PENDING_REVIEW',
  'REVIEW',
  'PROMOTED',
  'PLANNING',
  'APPROVED',
  'SCHEDULED',
  'EXECUTING',
  'DONE',
];

type TabId = 'basics' | 'sections' | 'workflow' | 'tasks' | 'team' | 'kpis' | 'comms';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'basics', label: 'Basic Info', icon: FileText },
  { id: 'sections', label: 'Sections', icon: Layers },
  { id: 'workflow', label: 'Workflow & Gates', icon: Shield },
  { id: 'tasks', label: 'Tasks & Milestones', icon: CheckSquare },
  { id: 'team', label: 'Team & Resources', icon: Users },
  { id: 'kpis', label: 'KPIs & Finance', icon: TrendingUp },
  { id: 'comms', label: 'Communication', icon: Bell },
];

// ==========================================
// HELPERS
// ==========================================

const uid = () => Math.random().toString(36).slice(2, 10);

const safeParseJson = (val: any, fallback: any = {}) => {
  if (Array.isArray(val) || (typeof val === 'object' && val !== null)) return val;
  if (typeof val === 'string' && val.trim()) {
    try {
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  }
  return fallback;
};

// Toggle component
const Toggle: React.FC<{ value: boolean; onChange: (v: boolean) => void; size?: 'sm' | 'md' }> = ({
  value,
  onChange,
  size = 'md',
}) => {
  const w = size === 'sm' ? 'w-8 h-4' : 'w-11 h-6';
  const dot = size === 'sm' ? 'w-3 h-3' : 'w-5 h-5';
  const translate = size === 'sm' ? 'translate-x-[16px]' : 'translate-x-[22px]';
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative ${w} rounded-full transition-colors duration-200 ${value ? 'bg-c-surface' : 'bg-slate-300 dark:bg-navy-600'}`}
    >
      <div
        className={`absolute top-0.5 ${dot} rounded-full bg-white shadow-sm transition-transform duration-200 ${value ? translate : 'translate-x-0.5'}`}
      />
    </button>
  );
};

// Card wrapper for setting sections
const SettingCard: React.FC<{
  title: string;
  desc?: string;
  children: React.ReactNode;
  toggle?: { value: boolean; onChange: (v: boolean) => void };
}> = ({ title, desc, children, toggle }) => (
  <div className="p-4 rounded-xl bg-slate-50 dark:bg-navy-800/50 border border-slate-200 dark:border-navy-700">
    <div className="flex items-center justify-between mb-3">
      <div>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{title}</p>
        {desc && <p className="text-xs text-slate-400 mt-0.5">{desc}</p>}
      </div>
      {toggle && <Toggle value={toggle.value} onChange={toggle.onChange} />}
    </div>
    {children}
  </div>
);

// Pill select
const PillSelect: React.FC<{
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
  colorMap?: Record<string, string>;
}> = ({ options, selected, onToggle, colorMap }) => (
  <div className="flex flex-wrap gap-1.5">
    {options.map((opt) => {
      const isActive = selected.includes(opt);
      const color = colorMap?.[opt];
      return (
        <button
          key={opt}
          onClick={() => onToggle(opt)}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition ${
            isActive
              ? color || 'bg-primary-500/15 border-primary-500/30 text-primary-500'
              : 'border-slate-200 dark:border-navy-700 text-slate-400 hover:border-slate-300'
          }`}
        >
          {opt}
        </button>
      );
    })}
  </div>
);

// Inline input for list items
const InlineInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}> = ({ value, onChange, placeholder, className }) => (
  <input
    type="text"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    className={`px-2 py-1 rounded bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition ${className || ''}`}
  />
);

const InlineSelect: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: string[];
  className?: string;
}> = ({ value, onChange, options, className }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className={`px-2 py-1 rounded bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-xs text-slate-900 dark:text-white focus:border-primary-500 transition ${className || ''}`}
  >
    {options.map((o) => (
      <option key={o} value={o}>
        {o}
      </option>
    ))}
  </select>
);

// ==========================================
// MAIN COMPONENT
// ==========================================

export const InitiativeTemplateEditor: React.FC<InitiativeTemplateEditorProps> = ({
  templateId,
  onClose,
  onSaved,
}) => {
  const isNew = !templateId;

  // Data
  const [sectionTypes, setSectionTypes] = useState<SectionType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form state - Basic Info
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('transformation');
  const [level, setLevel] = useState<TemplateLevel>('standard');
  const [sourceTypes, setSourceTypes] = useState<string[]>(['assessment', 'tool', 'manual']);

  // Sections
  const [visibleSections, setVisibleSections] = useState<Record<string, boolean>>({});
  const [sectionOrder, setSectionOrder] = useState<Record<string, number>>({});
  const [sectionConfig, setSectionConfig] = useState<Record<string, any>>({});

  // Workflow
  const [workflowConfig, setWorkflowConfig] = useState<Record<string, any>>({
    phases: ['PLAN', 'BUILD', 'TEST', 'DEPLOY'],
    requireApproval: false,
    requireSteeringCommittee: false,
    autoCreateTasks: false,
    autoCreateMilestones: false,
  });

  // Tasks & Milestones & Decisions
  const [suggestedTasks, setSuggestedTasks] = useState<SuggestedTask[]>([]);
  const [suggestedMilestones, setSuggestedMilestones] = useState<SuggestedMilestone[]>([]);
  const [suggestedDecisions, setSuggestedDecisions] = useState<SuggestedDecision[]>([]);

  // KPIs
  const [suggestedKpis, setSuggestedKpis] = useState<SuggestedKpi[]>([]);

  // Team
  const [teamConfig, setTeamConfig] = useState<Record<string, any>>({
    requireOwnerBusiness: true,
    requireOwnerExecution: true,
    requireSponsor: false,
    minFte: 0,
    requiredRoles: [],
    suggestedRaci: [],
  });

  // Financial
  const [financialConfig, setFinancialConfig] = useState<Record<string, any>>({
    requireFinancialAnalysis: false,
    requireBusinessCase: false,
    requiredFields: [],
    minRoiPercent: null,
    requireCostBenefitAnalysis: false,
  });

  // Benefits
  const [benefitsConfig, setBenefitsConfig] = useState<Record<string, any>>({
    enableBenefitsTracking: false,
    measurementFrequency: 'monthly',
    trackingDurationMonths: 12,
    requireQuantitativeBenefits: false,
  });

  // Escalation
  const [escalationConfig, setEscalationConfig] = useState<Record<string, any>>({
    amberThresholdDays: 3,
    redThresholdDays: 7,
    autoEscalateToSteeringCommittee: false,
    reminderBeforeDays: [1, 3],
  });

  // Gate config
  const [gateConfig, setGateConfig] = useState<Record<string, any>>({
    skipGates: [],
    gates: {},
  });

  // Notifications
  const [notificationConfig, setNotificationConfig] = useState<Record<string, any>>({
    onStatusChange: true,
    onTaskAssigned: true,
    onDecisionNeeded: true,
    onMilestoneReached: true,
    onEscalation: true,
    onBlocked: true,
  });

  // Status reports
  const [statusReportConfig, setStatusReportConfig] = useState<Record<string, any>>({
    reportingFrequency: 'biweekly',
    autoGenerate: false,
    enableAiSummary: false,
  });

  // RAID templates
  const [raidTemplates, setRaidTemplates] = useState<RaidTemplate[]>([]);

  // Validation rules
  const [validationRules, setValidationRules] = useState<Record<string, any>>({
    beforeSubmit: { requiredFields: ['name', 'summary'] },
    beforeApprove: { requiredFields: [] },
    beforeStart: { requiredFields: [] },
    beforeComplete: { requiredFields: [] },
  });

  // UI
  const [activeTab, setActiveTab] = useState<TabId>('basics');
  const [expandedSectionConfig, setExpandedSectionConfig] = useState<string | null>(null);

  // ==========================================
  // DATA LOADING
  // ==========================================

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const types = await Api.get('/initiatives/section-types');
        const sortedTypes = (Array.isArray(types) ? types : []).sort(
          (a: SectionType, b: SectionType) => a.defaultOrder - b.defaultOrder
        );
        setSectionTypes(sortedTypes);

        if (!templateId) {
          const defaultVisible: Record<string, boolean> = {};
          const defaultOrder: Record<string, number> = {};
          sortedTypes.forEach((st: SectionType) => {
            defaultVisible[st.key] = true;
            defaultOrder[st.key] = st.defaultOrder;
          });
          setVisibleSections(defaultVisible);
          setSectionOrder(defaultOrder);
        }

        if (templateId) {
          const resp = await Api.get(`/initiatives/templates/${templateId}`);
          const tpl = resp?.template || resp;
          if (tpl) {
            setName(tpl.name || '');
            setDescription(tpl.description || '');
            setCategory(tpl.category || 'transformation');
            setLevel(tpl.level || 'standard');
            setSourceTypes(
              safeParseJson(tpl.sourceTypes || tpl.source_types, ['assessment', 'tool', 'manual'])
            );

            const vs = safeParseJson(tpl.visibleSections || tpl.visible_sections, {});
            const so = safeParseJson(tpl.sectionOrder || tpl.section_order, {});
            const sc = safeParseJson(tpl.sectionConfig || tpl.section_config, {});

            if (Object.keys(vs).length === 0) {
              const dv: Record<string, boolean> = {};
              sortedTypes.forEach((st: SectionType) => {
                dv[st.key] = true;
              });
              setVisibleSections(dv);
            } else {
              setVisibleSections(vs);
            }

            if (Object.keys(so).length === 0) {
              const d: Record<string, number> = {};
              sortedTypes.forEach((st: SectionType) => {
                d[st.key] = st.defaultOrder;
              });
              setSectionOrder(d);
            } else {
              setSectionOrder(so);
            }

            setSectionConfig(sc);
            setWorkflowConfig(
              safeParseJson(tpl.workflowConfig || tpl.workflow_config, {
                phases: ['PLAN', 'BUILD', 'TEST', 'DEPLOY'],
                requireApproval: false,
                requireSteeringCommittee: false,
              })
            );

            // V3 fields
            setSuggestedTasks(safeParseJson(tpl.suggestedTaskItems || tpl.suggested_tasks, []));
            setSuggestedMilestones(
              safeParseJson(tpl.suggestedMilestones || tpl.suggested_milestones, [])
            );
            setSuggestedDecisions(
              safeParseJson(tpl.suggestedDecisions || tpl.suggested_decisions, [])
            );
            setSuggestedKpis(safeParseJson(tpl.suggestedKpis || tpl.suggested_kpis, []));
            setTeamConfig(
              safeParseJson(tpl.teamConfig || tpl.team_config, {
                requireOwnerBusiness: true,
                requireOwnerExecution: true,
                requireSponsor: false,
                minFte: 0,
                requiredRoles: [],
                suggestedRaci: [],
              })
            );
            setFinancialConfig(
              safeParseJson(tpl.financialConfig || tpl.financial_config, {
                requireFinancialAnalysis: false,
                requireBusinessCase: false,
                requiredFields: [],
                minRoiPercent: null,
                requireCostBenefitAnalysis: false,
              })
            );
            setBenefitsConfig(
              safeParseJson(tpl.benefitsConfig || tpl.benefits_config, {
                enableBenefitsTracking: false,
                measurementFrequency: 'monthly',
                trackingDurationMonths: 12,
                requireQuantitativeBenefits: false,
              })
            );
            setEscalationConfig(
              safeParseJson(tpl.escalationConfig || tpl.escalation_config, {
                amberThresholdDays: 3,
                redThresholdDays: 7,
                autoEscalateToSteeringCommittee: false,
                reminderBeforeDays: [1, 3],
              })
            );
            setGateConfig(
              safeParseJson(tpl.gateConfig || tpl.gate_config, { skipGates: [], gates: {} })
            );
            setNotificationConfig(
              safeParseJson(tpl.notificationConfig || tpl.notification_config, {
                onStatusChange: true,
                onTaskAssigned: true,
                onDecisionNeeded: true,
                onMilestoneReached: true,
                onEscalation: true,
                onBlocked: true,
              })
            );
            setStatusReportConfig(
              safeParseJson(tpl.statusReportConfig || tpl.status_report_config, {
                reportingFrequency: 'biweekly',
                autoGenerate: false,
                enableAiSummary: false,
              })
            );
            setRaidTemplates(safeParseJson(tpl.raidTemplates || tpl.raid_templates, []));
            setValidationRules(
              safeParseJson(tpl.validationRules || tpl.validation_rules, {
                beforeSubmit: { requiredFields: ['name', 'summary'] },
                beforeApprove: { requiredFields: [] },
                beforeStart: { requiredFields: [] },
                beforeComplete: { requiredFields: [] },
              })
            );
          }
        }
      } catch (e: any) {
        toast.error('Failed to load editor data');
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [templateId]);

  // ==========================================
  // SECTION LOGIC
  // ==========================================

  const orderedSections = useMemo(
    () =>
      [...sectionTypes].sort(
        (a, b) => (sectionOrder[a.key] ?? a.defaultOrder) - (sectionOrder[b.key] ?? b.defaultOrder)
      ),
    [sectionTypes, sectionOrder]
  );
  const leftSections = useMemo(
    () => orderedSections.filter((s) => s.columnPosition === 'left'),
    [orderedSections]
  );
  const rightSections = useMemo(
    () => orderedSections.filter((s) => s.columnPosition === 'right'),
    [orderedSections]
  );
  const enabledCount = Object.values(visibleSections).filter(Boolean).length;

  const toggleSection = useCallback((key: string) => {
    setVisibleSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const moveSection = useCallback(
    (key: string, direction: 'up' | 'down', column: 'left' | 'right') => {
      const col = column === 'left' ? leftSections : rightSections;
      const ci = col.findIndex((s) => s.key === key);
      if (ci < 0) return;
      const ti = direction === 'up' ? ci - 1 : ci + 1;
      if (ti < 0 || ti >= col.length) return;
      const co = sectionOrder[col[ci].key] ?? col[ci].defaultOrder;
      const to = sectionOrder[col[ti].key] ?? col[ti].defaultOrder;
      setSectionOrder((prev) => ({ ...prev, [col[ci].key]: to, [col[ti].key]: co }));
    },
    [leftSections, rightSections, sectionOrder]
  );

  const toggleSource = useCallback((s: string) => {
    setSourceTypes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }, []);

  // ==========================================
  // SAVE
  // ==========================================

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Template name is required');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        category,
        level,
        sourceTypes,
        visibleSections,
        sectionOrder,
        sectionConfig,
        requiredFields: [],
        workflowConfig,
        notificationConfig,
        suggestedDecisions,
        suggestedMilestones,
        suggestedKpis,
        // V3
        suggestedTaskItems: suggestedTasks,
        teamConfig,
        financialConfig,
        benefitsConfig,
        escalationConfig,
        gateConfig,
        statusReportConfig,
        raidTemplates,
        validationRules,
      };
      if (isNew) {
        await Api.post('/initiatives/templates', payload);
        toast.success('Template created');
      } else {
        await Api.put(`/initiatives/templates/${templateId}`, payload);
        toast.success('Template updated');
      }
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save template');
    } finally {
      setIsSaving(false);
    }
  };

  // ==========================================
  // RENDER
  // ==========================================

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 40 }}
        className="fixed inset-0 z-50 flex"
      >
        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
        <div className="relative ml-auto w-full max-w-4xl bg-white dark:bg-navy-900 shadow-2xl flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex"
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="relative ml-auto w-full max-w-4xl bg-white dark:bg-navy-900 shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-navy-700">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {isNew ? 'New Initiative Template' : 'Edit Template'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Full project management methodology blueprint
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-primary-500 to-primary-600 text-white border border-white/20 hover:brightness-110 shadow-lg shadow-primary-500/25 transition disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              <span>Save</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-navy-700 px-4 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <Icon size={13} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* ════════════════════════════════════════ */}
          {/* TAB 1: BASIC INFO */}
          {/* ════════════════════════════════════════ */}
          {activeTab === 'basics' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Template Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Enterprise Transformation Blueprint"
                  className="w-full px-3 py-2.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-900 dark:text-white placeholder-slate-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the purpose of this template..."
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-900 dark:text-white placeholder-slate-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition text-sm resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Template Level
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {LEVEL_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const isActive = level === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setLevel(opt.value)}
                        className={`flex items-center gap-3 p-3 rounded-xl border-2 transition text-left ${isActive ? `${opt.bg} shadow-sm` : 'border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-navy-600'}`}
                      >
                        <div
                          className={`p-2 rounded-lg ${isActive ? opt.bg : 'bg-slate-100 dark:bg-navy-800'}`}
                        >
                          <Icon size={18} className={isActive ? opt.color : 'text-slate-400'} />
                        </div>
                        <div>
                          <p
                            className={`text-sm font-medium ${isActive ? opt.color : 'text-slate-700 dark:text-slate-300'}`}
                          >
                            {opt.label}
                          </p>
                          <p className="text-xs text-slate-400">{opt.desc}</p>
                        </div>
                        {isActive && <Check size={16} className={`ml-auto ${opt.color}`} />}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Applicable Sources
                </label>
                <div className="flex flex-wrap gap-2">
                  {SOURCE_OPTIONS.map((src) => (
                    <button
                      key={src.value}
                      onClick={() => toggleSource(src.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${sourceTypes.includes(src.value) ? 'bg-primary-500/15 border-primary-500/30 text-primary-500' : 'border-slate-200 dark:border-navy-700 text-slate-400 hover:border-slate-300'}`}
                    >
                      {src.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Category
                </label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g. transformation, optimization, digital"
                  className="w-full px-3 py-2.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-900 dark:text-white placeholder-slate-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition text-sm"
                />
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════ */}
          {/* TAB 2: SECTIONS */}
          {/* ════════════════════════════════════════ */}
          {activeTab === 'sections' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-3 rounded-xl bg-primary-50 dark:bg-primary-500/10 border border-primary-200 dark:border-primary-500/20">
                <div className="flex items-center gap-3">
                  <Layers size={18} className="text-primary-500" />
                  <span className="text-sm text-primary-700 dark:text-primary-300">
                    <strong>{enabledCount}</strong> of {sectionTypes.length} sections enabled
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {[
                    {
                      label: 'Quick Win',
                      keys: ['overview', 'tasks', 'team', 'timeline', 'control', 'comments'],
                      color:
                        'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20',
                    },
                    {
                      label: 'Standard',
                      keys: [
                        'overview',
                        'problemDefinition',
                        'targetState',
                        'tasks',
                        'decisions',
                        'raid',
                        'team',
                        'timeline',
                        'control',
                        'comments',
                        'attachments',
                        'tags',
                      ],
                      color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20',
                    },
                    {
                      label: 'Enterprise',
                      keys: [
                        'overview',
                        'problemDefinition',
                        'targetState',
                        'scope',
                        'tasks',
                        'decisions',
                        'raid',
                        'gates',
                        'financialAnalysis',
                        'kpis',
                        'team',
                        'timeline',
                        'resources',
                        'stakeholders',
                        'dependencies',
                        'control',
                        'comments',
                        'attachments',
                        'tags',
                      ],
                      color:
                        'bg-primary-500/10 text-primary-600 dark:text-primary-400 hover:bg-primary-500/20',
                    },
                    {
                      label: 'Full',
                      keys: null,
                      color:
                        'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20',
                    },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => {
                        const vs: Record<string, boolean> = {};
                        sectionTypes.forEach((st) => {
                          vs[st.key] = preset.keys ? preset.keys.includes(st.key) : true;
                        });
                        setVisibleSections(vs);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-medium ${preset.color} transition-colors`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                {[
                  {
                    title: 'Left Column',
                    data: leftSections,
                    column: 'left' as const,
                    dot: 'bg-emerald-500',
                  },
                  {
                    title: 'Right Column',
                    data: rightSections,
                    column: 'right' as const,
                    dot: 'bg-amber-500',
                  },
                ].map(({ title, data, column, dot }) => (
                  <div key={column}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-2 h-2 rounded-full ${dot}`} />
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        {title} ({data.length})
                      </h3>
                    </div>
                    <div className="space-y-1">
                      {data.map((st, idx) => (
                        <SectionRow
                          key={st.key}
                          section={st}
                          isEnabled={visibleSections[st.key] !== false}
                          order={sectionOrder[st.key] ?? st.defaultOrder}
                          config={sectionConfig[st.key]}
                          isFirst={idx === 0}
                          isLast={idx === data.length - 1}
                          isConfigExpanded={expandedSectionConfig === st.key}
                          onToggle={() => toggleSection(st.key)}
                          onMoveUp={() => moveSection(st.key, 'up', column)}
                          onMoveDown={() => moveSection(st.key, 'down', column)}
                          onConfigToggle={() =>
                            setExpandedSectionConfig(
                              expandedSectionConfig === st.key ? null : st.key
                            )
                          }
                          onConfigChange={(cfg) =>
                            setSectionConfig((prev) => ({ ...prev, [st.key]: cfg }))
                          }
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════ */}
          {/* TAB 3: WORKFLOW & GATES */}
          {/* ════════════════════════════════════════ */}
          {activeTab === 'workflow' && (
            <div className="space-y-6">
              {/* Phases */}
              <SettingCard
                title="Workflow Phases"
                desc="Select which phases apply to this initiative type"
              >
                <PillSelect
                  options={WORKFLOW_PHASES}
                  selected={workflowConfig.phases || []}
                  onToggle={(p) => {
                    const phases = workflowConfig.phases || [];
                    setWorkflowConfig({
                      ...workflowConfig,
                      phases: phases.includes(p)
                        ? phases.filter((x: string) => x !== p)
                        : [...phases, p],
                    });
                  }}
                />
              </SettingCard>

              {/* Toggles */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  {
                    key: 'requireApproval',
                    label: 'Require Approval',
                    desc: 'Gate transitions need explicit approval',
                  },
                  {
                    key: 'requireSteeringCommittee',
                    label: 'Steering Committee',
                    desc: 'Require steering committee for major decisions',
                  },
                  {
                    key: 'autoCreateTasks',
                    label: 'Auto-Create Tasks',
                    desc: 'Auto-create suggested tasks when initiative starts',
                  },
                  {
                    key: 'autoCreateMilestones',
                    label: 'Auto-Create Milestones',
                    desc: 'Auto-create milestones and gates from template',
                  },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-navy-800/50 border border-slate-200 dark:border-navy-700"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {item.label}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
                    </div>
                    <Toggle
                      value={!!workflowConfig[item.key]}
                      onChange={(v) => setWorkflowConfig({ ...workflowConfig, [item.key]: v })}
                    />
                  </div>
                ))}
              </div>

              {/* Gate Readiness Rules */}
              <SettingCard
                title="Gate Readiness Rules"
                desc="Define skip gates and per-gate required fields"
              >
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1.5 block">
                      Skip Gates (these gates will be auto-passed)
                    </label>
                    <PillSelect
                      options={GATE_NAMES}
                      selected={gateConfig.skipGates || []}
                      onToggle={(g) => {
                        const sk = gateConfig.skipGates || [];
                        setGateConfig({
                          ...gateConfig,
                          skipGates: sk.includes(g)
                            ? sk.filter((x: string) => x !== g)
                            : [...sk, g],
                        });
                      }}
                    />
                  </div>
                </div>
              </SettingCard>

              {/* Validation Rules */}
              <SettingCard
                title="Validation Rules"
                desc="Required fields before key status transitions"
              >
                <div className="space-y-4">
                  {[
                    {
                      key: 'beforeSubmit',
                      label: 'Before Submit for Review',
                      default: ['name', 'summary'],
                    },
                    { key: 'beforeApprove', label: 'Before Approve', default: [] },
                    { key: 'beforeStart', label: 'Before Start Execution', default: [] },
                    { key: 'beforeComplete', label: 'Before Complete', default: [] },
                  ].map((rule) => (
                    <div key={rule.key}>
                      <label className="text-xs font-medium text-slate-500 mb-1 block">
                        {rule.label}
                      </label>
                      <input
                        type="text"
                        value={(validationRules[rule.key]?.requiredFields || []).join(', ')}
                        onChange={(e) =>
                          setValidationRules({
                            ...validationRules,
                            [rule.key]: {
                              requiredFields: e.target.value
                                .split(',')
                                .map((s: string) => s.trim())
                                .filter(Boolean),
                            },
                          })
                        }
                        placeholder="name, summary, owner_business_id..."
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-primary-500 transition"
                      />
                    </div>
                  ))}
                </div>
              </SettingCard>
            </div>
          )}

          {/* ════════════════════════════════════════ */}
          {/* TAB 4: TASKS & MILESTONES */}
          {/* ════════════════════════════════════════ */}
          {activeTab === 'tasks' && (
            <div className="space-y-6">
              {/* Suggested Tasks */}
              <SettingCard
                title="Suggested Tasks"
                desc="Tasks that will be auto-created when an initiative uses this template"
              >
                <div className="space-y-2">
                  {suggestedTasks.map((task, idx) => (
                    <div
                      key={task.id}
                      className="flex items-start gap-2 p-2.5 rounded-lg bg-white dark:bg-navy-900/50 border border-slate-200/50 dark:border-navy-700/50"
                    >
                      <span className="text-[10px] text-slate-400 mt-1.5 w-4 text-right flex-shrink-0">
                        {idx + 1}
                      </span>
                      <div className="flex-1 grid grid-cols-[1fr_auto_auto_auto] gap-2">
                        <InlineInput
                          value={task.title}
                          onChange={(v) => {
                            const n = [...suggestedTasks];
                            n[idx] = { ...n[idx], title: v };
                            setSuggestedTasks(n);
                          }}
                          placeholder="Task title..."
                          className="w-full"
                        />
                        <InlineSelect
                          value={task.stepPhase}
                          onChange={(v) => {
                            const n = [...suggestedTasks];
                            n[idx] = { ...n[idx], stepPhase: v };
                            setSuggestedTasks(n);
                          }}
                          options={TASK_PHASES}
                        />
                        <InlineSelect
                          value={task.priority}
                          onChange={(v) => {
                            const n = [...suggestedTasks];
                            n[idx] = { ...n[idx], priority: v };
                            setSuggestedTasks(n);
                          }}
                          options={PRIORITIES}
                        />
                        <InlineSelect
                          value={task.taskType}
                          onChange={(v) => {
                            const n = [...suggestedTasks];
                            n[idx] = { ...n[idx], taskType: v };
                            setSuggestedTasks(n);
                          }}
                          options={TASK_TYPES}
                        />
                      </div>
                      <button
                        onClick={() =>
                          setSuggestedTasks(suggestedTasks.filter((_, i) => i !== idx))
                        }
                        className="p-1 text-slate-400 hover:text-danger-500 transition-colors flex-shrink-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() =>
                      setSuggestedTasks([
                        ...suggestedTasks,
                        {
                          id: uid(),
                          title: '',
                          taskType: 'analysis',
                          stepPhase: 'design',
                          priority: 'medium',
                        },
                      ])
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary-500 hover:bg-primary-500/10 transition-colors"
                  >
                    <Plus size={13} /> Add Task
                  </button>
                </div>
              </SettingCard>

              {/* Suggested Milestones */}
              <SettingCard
                title="Suggested Milestones"
                desc="Milestones and gates created with the initiative"
              >
                <div className="space-y-2">
                  {suggestedMilestones.map((ms, idx) => (
                    <div
                      key={ms.id}
                      className="flex items-center gap-2 p-2.5 rounded-lg bg-white dark:bg-navy-900/50 border border-slate-200/50 dark:border-navy-700/50"
                    >
                      <span className="text-[10px] text-slate-400 w-4 text-right flex-shrink-0">
                        {idx + 1}
                      </span>
                      <InlineInput
                        value={ms.name}
                        onChange={(v) => {
                          const n = [...suggestedMilestones];
                          n[idx] = { ...n[idx], name: v };
                          setSuggestedMilestones(n);
                        }}
                        placeholder="Milestone name..."
                        className="flex-1"
                      />
                      <label className="flex items-center gap-1.5 text-[10px] text-slate-500 flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={ms.isGate}
                          onChange={(e) => {
                            const n = [...suggestedMilestones];
                            n[idx] = { ...n[idx], isGate: e.target.checked };
                            setSuggestedMilestones(n);
                          }}
                          className="rounded border-slate-300 text-primary-500 focus:ring-primary-500/50"
                        />
                        Gate
                      </label>
                      <button
                        onClick={() =>
                          setSuggestedMilestones(suggestedMilestones.filter((_, i) => i !== idx))
                        }
                        className="p-1 text-slate-400 hover:text-danger-500 transition-colors flex-shrink-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() =>
                      setSuggestedMilestones([
                        ...suggestedMilestones,
                        {
                          id: uid(),
                          name: '',
                          isGate: false,
                          orderIndex: suggestedMilestones.length + 1,
                        },
                      ])
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary-500 hover:bg-primary-500/10 transition-colors"
                  >
                    <Plus size={13} /> Add Milestone
                  </button>
                </div>
              </SettingCard>

              {/* Suggested Decisions */}
              <SettingCard
                title="Suggested Decisions"
                desc="Decisions that should be created for governance"
              >
                <div className="space-y-2">
                  {suggestedDecisions.map((dec, idx) => (
                    <div
                      key={dec.id}
                      className="flex items-center gap-2 p-2.5 rounded-lg bg-white dark:bg-navy-900/50 border border-slate-200/50 dark:border-navy-700/50"
                    >
                      <Scale size={13} className="text-amber-500 flex-shrink-0" />
                      <InlineInput
                        value={dec.title}
                        onChange={(v) => {
                          const n = [...suggestedDecisions];
                          n[idx] = { ...n[idx], title: v };
                          setSuggestedDecisions(n);
                        }}
                        placeholder="Decision title..."
                        className="flex-1"
                      />
                      <InlineSelect
                        value={dec.type}
                        onChange={(v) => {
                          const n = [...suggestedDecisions];
                          n[idx] = { ...n[idx], type: v };
                          setSuggestedDecisions(n);
                        }}
                        options={DECISION_TYPES}
                      />
                      <InlineSelect
                        value={dec.priority}
                        onChange={(v) => {
                          const n = [...suggestedDecisions];
                          n[idx] = { ...n[idx], priority: v };
                          setSuggestedDecisions(n);
                        }}
                        options={['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']}
                      />
                      <InlineSelect
                        value={dec.triggerAtStatus || 'REVIEW'}
                        onChange={(v) => {
                          const n = [...suggestedDecisions];
                          n[idx] = { ...n[idx], triggerAtStatus: v };
                          setSuggestedDecisions(n);
                        }}
                        options={TRIGGER_STATUSES}
                      />
                      <button
                        onClick={() =>
                          setSuggestedDecisions(suggestedDecisions.filter((_, i) => i !== idx))
                        }
                        className="p-1 text-slate-400 hover:text-danger-500 transition-colors flex-shrink-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() =>
                      setSuggestedDecisions([
                        ...suggestedDecisions,
                        {
                          id: uid(),
                          title: '',
                          type: 'GO_NO_GO',
                          priority: 'HIGH',
                          triggerAtStatus: 'REVIEW',
                        },
                      ])
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary-500 hover:bg-primary-500/10 transition-colors"
                  >
                    <Plus size={13} /> Add Decision
                  </button>
                </div>
              </SettingCard>
            </div>
          )}

          {/* ════════════════════════════════════════ */}
          {/* TAB 5: TEAM & RESOURCES */}
          {/* ════════════════════════════════════════ */}
          {activeTab === 'team' && (
            <div className="space-y-6">
              {/* Required Ownership */}
              <SettingCard
                title="Required Ownership"
                desc="Define which ownership roles are mandatory"
              >
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: 'requireOwnerBusiness', label: 'Business Owner' },
                    { key: 'requireOwnerExecution', label: 'Execution Owner' },
                    { key: 'requireSponsor', label: 'Sponsor' },
                  ].map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-navy-900/50 border border-slate-200/50 dark:border-navy-700/50"
                    >
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                        {item.label}
                      </span>
                      <Toggle
                        size="sm"
                        value={!!teamConfig[item.key]}
                        onChange={(v) => setTeamConfig({ ...teamConfig, [item.key]: v })}
                      />
                    </div>
                  ))}
                </div>
              </SettingCard>

              {/* Minimum FTE */}
              <SettingCard
                title="Resource Requirements"
                desc="Minimum team allocation for this initiative type"
              >
                <div className="flex items-center gap-3">
                  <label className="text-xs text-slate-500">Minimum FTE:</label>
                  <input
                    type="number"
                    value={teamConfig.minFte || 0}
                    onChange={(e) =>
                      setTeamConfig({ ...teamConfig, minFte: parseFloat(e.target.value) || 0 })
                    }
                    min={0}
                    step={0.5}
                    className="w-20 px-2 py-1 rounded bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-sm text-slate-900 dark:text-white focus:border-primary-500 transition"
                  />
                </div>
              </SettingCard>

              {/* Required Roles */}
              <SettingCard
                title="Required Team Roles"
                desc="Roles that must be filled before execution"
              >
                <div className="space-y-2">
                  {(teamConfig.requiredRoles || []).map((role: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-navy-900/50 border border-slate-200/50 dark:border-navy-700/50"
                    >
                      <Users size={13} className="text-indigo-500 flex-shrink-0" />
                      <InlineSelect
                        value={role.role || 'member'}
                        onChange={(v) => {
                          const n = [...(teamConfig.requiredRoles || [])];
                          n[idx] = { ...n[idx], role: v };
                          setTeamConfig({ ...teamConfig, requiredRoles: n });
                        }}
                        options={TEAM_ROLES}
                      />
                      <InlineInput
                        value={role.label || ''}
                        onChange={(v) => {
                          const n = [...(teamConfig.requiredRoles || [])];
                          n[idx] = { ...n[idx], label: v };
                          setTeamConfig({ ...teamConfig, requiredRoles: n });
                        }}
                        placeholder="Display label..."
                        className="flex-1"
                      />
                      <label className="flex items-center gap-1 text-[10px] text-slate-500">
                        <input
                          type="checkbox"
                          checked={role.required !== false}
                          onChange={(e) => {
                            const n = [...(teamConfig.requiredRoles || [])];
                            n[idx] = { ...n[idx], required: e.target.checked };
                            setTeamConfig({ ...teamConfig, requiredRoles: n });
                          }}
                          className="rounded border-slate-300 text-primary-500"
                        />
                        Required
                      </label>
                      <button
                        onClick={() => {
                          const n = (teamConfig.requiredRoles || []).filter(
                            (_: any, i: number) => i !== idx
                          );
                          setTeamConfig({ ...teamConfig, requiredRoles: n });
                        }}
                        className="p-1 text-slate-400 hover:text-danger-500 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() =>
                      setTeamConfig({
                        ...teamConfig,
                        requiredRoles: [
                          ...(teamConfig.requiredRoles || []),
                          { role: 'member', label: '', required: true, minCount: 1 },
                        ],
                      })
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary-500 hover:bg-primary-500/10 transition-colors"
                  >
                    <Plus size={13} /> Add Role
                  </button>
                </div>
              </SettingCard>

              {/* RACI Template */}
              <SettingCard title="RACI Template" desc="Default RACI assignments for stakeholders">
                <div className="space-y-2">
                  {(teamConfig.suggestedRaci || []).map((raci: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-navy-900/50 border border-slate-200/50 dark:border-navy-700/50"
                    >
                      <InlineInput
                        value={raci.roleName || ''}
                        onChange={(v) => {
                          const n = [...(teamConfig.suggestedRaci || [])];
                          n[idx] = { ...n[idx], roleName: v };
                          setTeamConfig({ ...teamConfig, suggestedRaci: n });
                        }}
                        placeholder="Role name (e.g. Sponsor, PMO)..."
                        className="flex-1"
                      />
                      <InlineSelect
                        value={raci.raciType || 'I'}
                        onChange={(v) => {
                          const n = [...(teamConfig.suggestedRaci || [])];
                          n[idx] = { ...n[idx], raciType: v };
                          setTeamConfig({ ...teamConfig, suggestedRaci: n });
                        }}
                        options={RACI_TYPES}
                      />
                      <button
                        onClick={() => {
                          const n = (teamConfig.suggestedRaci || []).filter(
                            (_: any, i: number) => i !== idx
                          );
                          setTeamConfig({ ...teamConfig, suggestedRaci: n });
                        }}
                        className="p-1 text-slate-400 hover:text-danger-500 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() =>
                      setTeamConfig({
                        ...teamConfig,
                        suggestedRaci: [
                          ...(teamConfig.suggestedRaci || []),
                          { roleName: '', raciType: 'I' },
                        ],
                      })
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary-500 hover:bg-primary-500/10 transition-colors"
                  >
                    <Plus size={13} /> Add RACI Entry
                  </button>
                </div>
              </SettingCard>
            </div>
          )}

          {/* ════════════════════════════════════════ */}
          {/* TAB 6: KPIs & FINANCE */}
          {/* ════════════════════════════════════════ */}
          {activeTab === 'kpis' && (
            <div className="space-y-6">
              {/* Suggested KPIs */}
              <SettingCard
                title="Suggested KPIs"
                desc="Key performance indicators for tracking initiative success"
              >
                <div className="space-y-2">
                  {suggestedKpis.map((kpi, idx) => (
                    <div
                      key={kpi.id}
                      className="flex items-center gap-2 p-2.5 rounded-lg bg-white dark:bg-navy-900/50 border border-slate-200/50 dark:border-navy-700/50"
                    >
                      <TrendingUp size={13} className="text-blue-500 flex-shrink-0" />
                      <InlineInput
                        value={kpi.name}
                        onChange={(v) => {
                          const n = [...suggestedKpis];
                          n[idx] = { ...n[idx], name: v };
                          setSuggestedKpis(n);
                        }}
                        placeholder="KPI name..."
                        className="flex-1"
                      />
                      <InlineSelect
                        value={kpi.unit}
                        onChange={(v) => {
                          const n = [...suggestedKpis];
                          n[idx] = { ...n[idx], unit: v };
                          setSuggestedKpis(n);
                        }}
                        options={KPI_UNITS}
                      />
                      <input
                        type="number"
                        value={kpi.targetValue || ''}
                        onChange={(e) => {
                          const n = [...suggestedKpis];
                          n[idx] = {
                            ...n[idx],
                            targetValue: parseFloat(e.target.value) || undefined,
                          };
                          setSuggestedKpis(n);
                        }}
                        placeholder="Target"
                        className="w-20 px-2 py-1 rounded bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-primary-500 transition"
                      />
                      <InlineSelect
                        value={kpi.measurementFrequency}
                        onChange={(v) => {
                          const n = [...suggestedKpis];
                          n[idx] = { ...n[idx], measurementFrequency: v };
                          setSuggestedKpis(n);
                        }}
                        options={KPI_FREQUENCIES}
                      />
                      <button
                        onClick={() => setSuggestedKpis(suggestedKpis.filter((_, i) => i !== idx))}
                        className="p-1 text-slate-400 hover:text-danger-500 transition-colors flex-shrink-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() =>
                      setSuggestedKpis([
                        ...suggestedKpis,
                        {
                          id: uid(),
                          name: '',
                          unit: '%',
                          targetValue: undefined,
                          measurementFrequency: 'MONTHLY',
                        },
                      ])
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary-500 hover:bg-primary-500/10 transition-colors"
                  >
                    <Plus size={13} /> Add KPI
                  </button>
                </div>
              </SettingCard>

              {/* Financial Requirements */}
              <SettingCard
                title="Financial Requirements"
                desc="Define financial analysis requirements for this initiative type"
              >
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: 'requireFinancialAnalysis', label: 'Require Financial Analysis' },
                      { key: 'requireBusinessCase', label: 'Require Business Case' },
                      { key: 'requireCostBenefitAnalysis', label: 'Require Cost-Benefit Analysis' },
                    ].map((item) => (
                      <div
                        key={item.key}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-navy-900/50 border border-slate-200/50 dark:border-navy-700/50"
                      >
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                          {item.label}
                        </span>
                        <Toggle
                          size="sm"
                          value={!!financialConfig[item.key]}
                          onChange={(v) =>
                            setFinancialConfig({ ...financialConfig, [item.key]: v })
                          }
                        />
                      </div>
                    ))}
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white dark:bg-navy-900/50 border border-slate-200/50 dark:border-navy-700/50">
                      <span className="text-xs text-slate-600 dark:text-slate-400">Min ROI %:</span>
                      <input
                        type="number"
                        value={financialConfig.minRoiPercent || ''}
                        onChange={(e) =>
                          setFinancialConfig({
                            ...financialConfig,
                            minRoiPercent: parseFloat(e.target.value) || null,
                          })
                        }
                        placeholder="—"
                        className="w-20 px-2 py-1 rounded bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-xs text-slate-900 dark:text-white focus:border-primary-500 transition"
                      />
                    </div>
                  </div>
                </div>
              </SettingCard>

              {/* Benefits Tracking */}
              <SettingCard
                title="Benefits Tracking"
                desc="Configure how benefits are measured after completion"
                toggle={{
                  value: !!benefitsConfig.enableBenefitsTracking,
                  onChange: (v) =>
                    setBenefitsConfig({ ...benefitsConfig, enableBenefitsTracking: v }),
                }}
              >
                {benefitsConfig.enableBenefitsTracking && (
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">Frequency:</span>
                      <InlineSelect
                        value={benefitsConfig.measurementFrequency || 'monthly'}
                        onChange={(v) =>
                          setBenefitsConfig({ ...benefitsConfig, measurementFrequency: v })
                        }
                        options={['monthly', 'quarterly', 'yearly']}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">Duration (months):</span>
                      <input
                        type="number"
                        value={benefitsConfig.trackingDurationMonths || 12}
                        onChange={(e) =>
                          setBenefitsConfig({
                            ...benefitsConfig,
                            trackingDurationMonths: parseInt(e.target.value) || 12,
                          })
                        }
                        className="w-16 px-2 py-1 rounded bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-xs text-slate-900 dark:text-white focus:border-primary-500 transition"
                      />
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-navy-900/50 border border-slate-200/50 dark:border-navy-700/50 col-span-2">
                      <span className="text-xs text-slate-600 dark:text-slate-400">
                        Require Quantitative Benefits
                      </span>
                      <Toggle
                        size="sm"
                        value={!!benefitsConfig.requireQuantitativeBenefits}
                        onChange={(v) =>
                          setBenefitsConfig({ ...benefitsConfig, requireQuantitativeBenefits: v })
                        }
                      />
                    </div>
                  </div>
                )}
              </SettingCard>
            </div>
          )}

          {/* ════════════════════════════════════════ */}
          {/* TAB 7: COMMUNICATION */}
          {/* ════════════════════════════════════════ */}
          {activeTab === 'comms' && (
            <div className="space-y-6">
              {/* Notifications */}
              <SettingCard
                title="Notification Triggers"
                desc="Which events should trigger notifications"
              >
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'onStatusChange', label: 'Status Changes' },
                    { key: 'onTaskAssigned', label: 'Task Assigned' },
                    { key: 'onDecisionNeeded', label: 'Decision Needed' },
                    { key: 'onMilestoneReached', label: 'Milestone Reached' },
                    { key: 'onEscalation', label: 'Escalation' },
                    { key: 'onBlocked', label: 'Blocked' },
                  ].map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-navy-900/50 border border-slate-200/50 dark:border-navy-700/50"
                    >
                      <span className="text-xs text-slate-600 dark:text-slate-400">
                        {item.label}
                      </span>
                      <Toggle
                        size="sm"
                        value={notificationConfig[item.key] !== false}
                        onChange={(v) =>
                          setNotificationConfig({ ...notificationConfig, [item.key]: v })
                        }
                      />
                    </div>
                  ))}
                </div>
              </SettingCard>

              {/* Escalation */}
              <SettingCard
                title="Escalation Rules"
                desc="Automatic escalation thresholds for overdue decisions and tasks"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-amber-500 font-medium">Amber:</span>
                    <input
                      type="number"
                      value={escalationConfig.amberThresholdDays || 3}
                      onChange={(e) =>
                        setEscalationConfig({
                          ...escalationConfig,
                          amberThresholdDays: parseInt(e.target.value) || 3,
                        })
                      }
                      className="w-16 px-2 py-1 rounded bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-xs text-slate-900 dark:text-white focus:border-primary-500 transition"
                    />
                    <span className="text-xs text-slate-400">days</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-danger-500 font-medium">Red:</span>
                    <input
                      type="number"
                      value={escalationConfig.redThresholdDays || 7}
                      onChange={(e) =>
                        setEscalationConfig({
                          ...escalationConfig,
                          redThresholdDays: parseInt(e.target.value) || 7,
                        })
                      }
                      className="w-16 px-2 py-1 rounded bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-xs text-slate-900 dark:text-white focus:border-primary-500 transition"
                    />
                    <span className="text-xs text-slate-400">days</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-navy-900/50 border border-slate-200/50 dark:border-navy-700/50 col-span-2">
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      Auto-escalate to Steering Committee on Red
                    </span>
                    <Toggle
                      size="sm"
                      value={!!escalationConfig.autoEscalateToSteeringCommittee}
                      onChange={(v) =>
                        setEscalationConfig({
                          ...escalationConfig,
                          autoEscalateToSteeringCommittee: v,
                        })
                      }
                    />
                  </div>
                </div>
              </SettingCard>

              {/* Status Reports */}
              <SettingCard title="Status Reports" desc="Periodic status reporting configuration">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Frequency:</span>
                    <InlineSelect
                      value={statusReportConfig.reportingFrequency || 'biweekly'}
                      onChange={(v) =>
                        setStatusReportConfig({ ...statusReportConfig, reportingFrequency: v })
                      }
                      options={REPORT_FREQUENCIES}
                    />
                  </div>
                  <div />
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-navy-900/50 border border-slate-200/50 dark:border-navy-700/50">
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      Auto-Generate Reports
                    </span>
                    <Toggle
                      size="sm"
                      value={!!statusReportConfig.autoGenerate}
                      onChange={(v) =>
                        setStatusReportConfig({ ...statusReportConfig, autoGenerate: v })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-navy-900/50 border border-slate-200/50 dark:border-navy-700/50">
                    <span className="text-xs text-slate-600 dark:text-slate-400">AI Summary</span>
                    <Toggle
                      size="sm"
                      value={!!statusReportConfig.enableAiSummary}
                      onChange={(v) =>
                        setStatusReportConfig({ ...statusReportConfig, enableAiSummary: v })
                      }
                    />
                  </div>
                </div>
              </SettingCard>

              {/* RAID Templates */}
              <SettingCard
                title="RAID Templates"
                desc="Pre-defined risks, assumptions, issues, and dependencies"
              >
                <div className="space-y-2">
                  {raidTemplates.map((raid, idx) => (
                    <div
                      key={raid.id}
                      className="flex items-center gap-2 p-2.5 rounded-lg bg-white dark:bg-navy-900/50 border border-slate-200/50 dark:border-navy-700/50"
                    >
                      <AlertTriangle
                        size={13}
                        className={
                          raid.type === 'RISK'
                            ? 'text-danger-500'
                            : raid.type === 'ASSUMPTION'
                              ? 'text-blue-500'
                              : raid.type === 'ISSUE'
                                ? 'text-amber-500'
                                : 'text-primary-500'
                        }
                      />
                      <InlineSelect
                        value={raid.type}
                        onChange={(v) => {
                          const n = [...raidTemplates];
                          n[idx] = { ...n[idx], type: v as any };
                          setRaidTemplates(n);
                        }}
                        options={RAID_TYPES as any}
                      />
                      <InlineInput
                        value={raid.title}
                        onChange={(v) => {
                          const n = [...raidTemplates];
                          n[idx] = { ...n[idx], title: v };
                          setRaidTemplates(n);
                        }}
                        placeholder="Title..."
                        className="flex-1"
                      />
                      {raid.type === 'RISK' && (
                        <>
                          <InlineSelect
                            value={raid.probability || 'MEDIUM'}
                            onChange={(v) => {
                              const n = [...raidTemplates];
                              n[idx] = { ...n[idx], probability: v };
                              setRaidTemplates(n);
                            }}
                            options={PROBABILITY_LEVELS}
                          />
                          <InlineSelect
                            value={raid.impact || 'MEDIUM'}
                            onChange={(v) => {
                              const n = [...raidTemplates];
                              n[idx] = { ...n[idx], impact: v };
                              setRaidTemplates(n);
                            }}
                            options={IMPACT_LEVELS}
                          />
                        </>
                      )}
                      <button
                        onClick={() => setRaidTemplates(raidTemplates.filter((_, i) => i !== idx))}
                        className="p-1 text-slate-400 hover:text-danger-500 transition-colors flex-shrink-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() =>
                      setRaidTemplates([
                        ...raidTemplates,
                        {
                          id: uid(),
                          type: 'RISK',
                          title: '',
                          probability: 'MEDIUM',
                          impact: 'MEDIUM',
                        },
                      ])
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary-500 hover:bg-primary-500/10 transition-colors"
                  >
                    <Plus size={13} /> Add RAID Item
                  </button>
                </div>
              </SettingCard>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

// ==========================================
// SECTION ROW SUB-COMPONENT
// ==========================================

interface SectionRowProps {
  section: SectionType;
  isEnabled: boolean;
  order: number;
  config?: Record<string, any>;
  isFirst: boolean;
  isLast: boolean;
  isConfigExpanded: boolean;
  onToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onConfigToggle: () => void;
  onConfigChange: (cfg: Record<string, any>) => void;
}

const SectionRow: React.FC<SectionRowProps> = ({
  section,
  isEnabled,
  config,
  isFirst,
  isLast,
  isConfigExpanded,
  onToggle,
  onMoveUp,
  onMoveDown,
  onConfigToggle,
  onConfigChange,
}) => {
  const catColor = CATEGORY_COLORS[section.category] || CATEGORY_COLORS.content;
  return (
    <div
      className={`rounded-lg border transition ${isEnabled ? 'border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800/50' : 'border-slate-100 dark:border-navy-800 bg-slate-50/50 dark:bg-navy-900/30 opacity-60'}`}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          onClick={onToggle}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition flex-shrink-0 ${isEnabled ? 'bg-c-text text-c-bg border-c-border' : 'border-slate-300 dark:border-navy-600 hover:border-primary-400'}`}
        >
          {isEnabled && <Check size={12} />}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
            {section.name}
          </p>
        </div>
        <span
          className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${catColor.bg} ${catColor.color} flex-shrink-0`}
        >
          {section.category}
        </span>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={onMoveUp}
            disabled={isFirst}
            className="p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowUp size={12} />
          </button>
          <button
            onClick={onMoveDown}
            disabled={isLast}
            className="p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowDown size={12} />
          </button>
        </div>
        <button
          onClick={onConfigToggle}
          className="p-0.5 rounded text-slate-400 hover:text-primary-500 transition-colors flex-shrink-0"
        >
          {isConfigExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
      </div>
      <AnimatePresence>
        {isConfigExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 border-t border-slate-100 dark:border-navy-700/50 space-y-2">
              {section.description && (
                <p className="text-[10px] text-slate-400 italic">{section.description}</p>
              )}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400">Component:</span>
                <code className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 font-mono">
                  {section.componentKey}
                </code>
              </div>
              {[
                { key: 'required', label: 'Required for completion' },
                { key: 'collapsedByDefault', label: 'Collapsed by default' },
                { key: 'aiAutoFill', label: 'AI auto-fill enabled' },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">{item.label}</span>
                  <Toggle
                    size="sm"
                    value={!!config?.[item.key]}
                    onChange={() => onConfigChange({ ...config, [item.key]: !config?.[item.key] })}
                  />
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
