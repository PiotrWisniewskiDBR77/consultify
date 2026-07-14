/**
 * @deprecated This component is LEGACY and will be removed.
 * Use InitiativeDocumentView instead for the canonical full initiative view.
 *
 * InitiativeDetailCard
 * Full initiative detail view as a dynamic card (not modal)
 * Can be rendered directly in ModuleHub content area
 *
 * MIGRATION NOTE: Replace usages with InitiativeDocumentView from './InitiativeDocumentView'
 */

import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Award,
  Brain,
  Calendar,
  CheckCircle,
  Clock,
  DollarSign,
  FileText,
  Globe,
  History,
  MessageSquare,
  Save,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  UserCheck,
  Users,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

import { FullInitiative, InitiativeStatus, StrategicGoal, User } from '../../types';
import { InitiativeFinancialIntegration } from '../Economics/InitiativeFinancialIntegration';
import { InitiativeIntelligenceTab } from '../InitiativeIntelligenceTab';
import { InitiativeTasksTab } from '../InitiativeTasksTab';
import { LoadingState } from '../ui/primitives';
import { Button } from '../ui/primitives/Button';
import { Select } from '../ui/select';
import { InitiativeSourceLink } from './InitiativeSourceLink';

interface InitiativeDetailCardProps {
  initiativeId: string;
  onSave?: (initiative: FullInitiative) => void;
  users?: User[];
  currentUser?: User | null;
  strategicGoals?: StrategicGoal[];
}

type TabType =
  | 'overview'
  | 'tasks'
  | 'definition'
  | 'execution'
  | 'economics'
  | 'governance'
  | 'team'
  | 'comments'
  | 'history'
  | 'intelligence';

export const InitiativeDetailCard: React.FC<InitiativeDetailCardProps> = ({
  initiativeId,
  onSave,
  users: rawUsers = [],
  currentUser,
  strategicGoals = [],
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const users = Array.isArray(rawUsers) ? rawUsers : [];

  // State
  const [initiative, setInitiative] = useState<FullInitiative | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newComment, setNewComment] = useState('');

  // Fetch initiative data
  useEffect(() => {
    const fetchInitiative = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await Api.getInitiativeById(initiativeId);
        // Map to FullInitiative
        const mapped: FullInitiative = {
          id: data.id,
          projectId: data.projectId || data.project_id || '',
          name: data.name || data.title || 'Untitled Initiative',
          description: data.summary || data.description,
          axis: data.axis || 'operational',
          priority: data.priority || 'Medium',
          complexity: data.complexity || 'Medium',
          status: data.status || 'DRAFT',
          currentStage: data.currentStage || data.current_stage,
          summary: data.summary,
          applicantOneLiner: data.applicantOneLiner || data.applicant_one_liner,
          strategicIntent: data.strategicIntent || data.strategic_intent,
          businessValue: data.businessValue || data.business_value,
          capex: data.costCapex || data.cost_capex || 0,
          costCapex: data.costCapex || data.cost_capex || 0,
          costOpex: data.costOpex || data.cost_opex || 0,
          expectedRoi: data.expectedRoi || data.expected_roi || 0,
          annualBenefit: data.annualBenefit || data.annual_benefit,
          valueDriver: data.valueDriver || data.value_driver,
          confidenceLevel: data.confidenceLevel || data.confidence_level || 'Medium',
          valueTiming: data.valueTiming || data.value_timing,
          startDate: data.plannedStartDate || data.planned_start_date,
          endDate: data.plannedEndDate || data.planned_end_date,
          ownerBusinessId: data.ownerBusinessId || data.owner_business_id,
          ownerExecutionId: data.ownerExecutionId || data.owner_execution_id,
          sponsorId: data.sponsorId || data.sponsor_id,
          deliverables: data.deliverables || [],
          successCriteria: data.successCriteria || data.success_criteria || [],
          scopeIn: data.scopeIn || data.scope_in || [],
          scopeOut: data.scopeOut || data.scope_out || [],
          keyRisks: data.keyRisks || data.key_risks || [],
          killCriteria: data.killCriteria || data.kill_criteria || [],
          milestones: data.milestones || [],
          stakeholders: data.stakeholders || [],
          tasks: data.tasks || [],
          problemStatement: data.problemStatement || data.problem_statement,
          problemStructured: data.problemStructured || data.problem_structured,
          targetState: data.targetState || data.target_state,
          decisionToMake: data.decisionToMake || data.decision_to_make,
          decisionOwnerId: data.decisionOwnerId || data.decision_owner_id,
          strategicFit: data.strategicFit || data.strategic_fit,
          sourceType: data.sourceType || data.source_type,
          sourceId: data.sourceId || data.source_id,
        };
        setInitiative(mapped);
      } catch (err: any) {
        console.error('[InitiativeDetailCard] Fetch error:', err);
        setError(err?.message || 'Failed to load initiative');
      } finally {
        setIsLoading(false);
      }
    };

    if (initiativeId) {
      fetchInitiative();
    }
  }, [initiativeId]);

  // Calculate readiness score
  const calculateReadiness = useCallback(() => {
    if (!initiative) return { total: 0, details: {}, maxScores: {} };

    let strategic = 0;
    if (initiative.name && initiative.name.length > 5) strategic += 3;
    if (initiative.strategicIntent) strategic += 4;
    if (initiative.axis) strategic += 4;
    if (initiative.applicantOneLiner && initiative.applicantOneLiner.length > 10) strategic += 4;

    let problem = 0;
    if (initiative.problemStructured?.symptom) problem += 4;
    if (initiative.problemStructured?.rootCause) problem += 4;
    if (initiative.problemStructured?.costOfInaction) problem += 4;
    if (initiative.stakeholders && initiative.stakeholders.length > 0) problem += 3;

    let target = 0;
    if (initiative.targetState?.process?.length) target += 5;
    if (initiative.targetState?.behavior?.length) target += 5;
    if (initiative.targetState?.capability?.length) target += 5;

    let execution = 0;
    if (initiative.killCriteria && initiative.killCriteria.length > 0) execution += 5;
    if (initiative.keyRisks && initiative.keyRisks.length > 0) execution += 5;
    if (initiative.deliverables && initiative.deliverables.length > 0) execution += 5;

    let value = 0;
    if (initiative.businessValue) value += 5;
    if (initiative.capex || initiative.costCapex) value += 4;
    if (initiative.annualBenefit || initiative.expectedRoi) value += 6;

    let governance = 0;
    if (initiative.ownerBusinessId) governance += 5;
    if (initiative.ownerExecutionId) governance += 5;
    if (initiative.sponsorId) governance += 5;

    let timeline = 0;
    if (initiative.startDate) timeline += 4;
    if (initiative.endDate) timeline += 3;
    if (initiative.milestones && initiative.milestones.length > 0) timeline += 3;

    const total = strategic + problem + target + execution + value + governance + timeline;
    return {
      total,
      details: { strategic, problem, target, execution, value, governance, timeline },
      maxScores: {
        strategic: 15,
        problem: 15,
        target: 15,
        execution: 15,
        value: 15,
        governance: 15,
        timeline: 10,
      },
    };
  }, [initiative]);

  const readiness = useMemo(() => calculateReadiness(), [calculateReadiness]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!initiative || !onSave) return;
    setIsSaving(true);
    try {
      await Api.updateInitiative(initiative.id, initiative);
      onSave(initiative);
    } catch (err: any) {
      console.error('[InitiativeDetailCard] Save error:', err);
    } finally {
      setIsSaving(false);
    }
  }, [initiative, onSave]);

  // Loading state
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-c-surface-raised dark:bg-c-bg">
        <LoadingState variant="spinner" label="Loading initiative..." />
      </div>
    );
  }

  // Error state
  if (error || !initiative) {
    return (
      <div className="h-full flex items-center justify-center bg-c-surface-raised dark:bg-c-bg">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-danger-400 mx-auto mb-4" />
          <p className="text-c-text text-lg mb-2">Failed to load initiative</p>
          <p className="text-c-text-muted">{error || 'Initiative not found'}</p>
        </div>
      </div>
    );
  }

  // Tab definitions
  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    {
      id: 'overview',
      label: t('initiative.tabs.overview', 'Overview'),
      icon: <Target size={14} />,
    },
    { id: 'tasks', label: t('initiative.tabs.tasks', 'Tasks'), icon: <CheckCircle size={14} /> },
    {
      id: 'definition',
      label: t('initiative.tabs.definition', 'Definition & Scope'),
      icon: <FileText size={14} />,
    },
    {
      id: 'execution',
      label: t('initiative.tabs.execution', 'Execution & Risks'),
      icon: <Zap size={14} />,
    },
    {
      id: 'economics',
      label: t('initiative.tabs.economics', 'Value & Finance'),
      icon: <DollarSign size={14} />,
    },
    {
      id: 'governance',
      label: t('initiative.tabs.governance', 'Governance'),
      icon: <Shield size={14} />,
    },
    { id: 'team', label: t('initiative.tabs.team', 'Team'), icon: <Users size={14} /> },
    {
      id: 'comments',
      label: t('initiative.tabs.comments', 'Discussion'),
      icon: <MessageSquare size={14} />,
    },
    { id: 'history', label: t('initiative.tabs.history', 'History'), icon: <History size={14} /> },
    {
      id: 'intelligence',
      label: t('initiative.tabs.intelligence', 'Intelligence'),
      icon: <Brain size={14} />,
    },
  ];

  // Status colors
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-c-surface-raised text-c-text-secondary';
      case 'PLANNING':
        return 'bg-[color-mix(in_srgb,var(--c-info)_15%,transparent)] text-c-info';
      case 'REVIEW':
        return 'bg-[color-mix(in_srgb,var(--c-warning)_15%,transparent)] text-c-warning';
      case 'APPROVED':
        return 'bg-[color-mix(in_srgb,var(--c-success)_15%,transparent)] text-c-success';
      case 'EXECUTING':
        return 'bg-[color-mix(in_srgb,var(--c-info)_15%,transparent)] text-c-info';
      case 'BLOCKED':
        return 'bg-[color-mix(in_srgb,var(--c-danger)_15%,transparent)] text-c-danger';
      case 'DONE':
        return 'bg-[color-mix(in_srgb,var(--c-success)_15%,transparent)] text-c-success';
      default:
        return 'bg-c-surface-raised text-c-text-secondary';
    }
  };

  return (
    <div className="h-full flex flex-col bg-c-surface-raised dark:bg-c-bg overflow-hidden">
      {/* Header with Status Indicator */}
      <div className="border-b border-c-border-subtle bg-c-surface">
        {/* Module Progress Indicator */}
        <div className="h-10 border-b border-c-border-subtle flex items-center px-6 gap-0">
          {[
            { module: 'Overview', statuses: ['DRAFT'], color: 'slate', icon: '1' },
            {
              module: 'Initiative Charter',
              statuses: ['PLANNING', 'REVIEW', 'APPROVED'],
              color: 'amber',
              icon: '2',
            },
            {
              module: 'Execution & Risks',
              statuses: ['EXECUTING', 'BLOCKED'],
              color: 'blue',
              icon: '3',
            },
            {
              module: 'Benefits & Closure',
              statuses: ['DONE', 'CANCELLED', 'ARCHIVED'],
              color: 'green',
              icon: '4',
            },
          ].map((mod, idx, arr) => {
            const isActive = mod.statuses.includes(initiative.status || 'DRAFT');
            const isPassed =
              arr.slice(0, idx).some((m) => m.statuses.includes(initiative.status || 'DRAFT')) ||
              idx < arr.findIndex((m) => m.statuses.includes(initiative.status || 'DRAFT'));
            return (
              <React.Fragment key={mod.module}>
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-[color-mix(in_srgb,var(--c-info)_15%,transparent)] text-c-info shadow-sm'
                      : isPassed
                        ? 'bg-[color-mix(in_srgb,var(--c-success)_10%,transparent)] text-c-success'
                        : 'bg-c-surface-raised text-c-text-secondary dark:text-c-text-muted'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isActive
                        ? 'bg-c-info text-white'
                        : isPassed
                          ? 'bg-c-success text-white'
                          : 'bg-c-surface-raised text-c-text-secondary'
                    }`}
                  >
                    {isPassed && !isActive ? '✓' : mod.icon}
                  </span>
                  <span className="uppercase tracking-wide">{mod.module}</span>
                </div>
                {idx < arr.length - 1 && (
                  <div
                    className={`w-8 h-0.5 mx-1 ${isPassed || isActive ? 'bg-[color-mix(in_srgb,var(--c-success)_30%,transparent)]' : 'bg-c-border'}`}
                  />
                )}
              </React.Fragment>
            );
          })}
          <div className="flex-1" />
          <span
            className={`text-xs font-medium px-2 py-1 rounded ${getStatusColor(initiative.status)}`}
          >
            {initiative.status}
          </span>
        </div>

        {/* Main Header */}
        <div className="h-16 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-[color-mix(in_srgb,var(--c-info)_15%,transparent)] text-c-info">
              <Target size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-c-text">{initiative.name}</h2>
              <div className="flex items-center gap-2 text-xs text-c-text-muted">
                <span>ID: {initiative.id?.slice(0, 8)}</span>
                <span className="w-1 h-1 bg-c-border rounded-full" />
                <span>Progress: {readiness.total}%</span>
                <span className="w-1 h-1 bg-c-border rounded-full" />
                <span className="capitalize">{initiative.axis}</span>
              </div>
            </div>
          </div>

          {/* Readiness Score */}
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-c-text-muted mb-1">Charter Readiness</div>
              <div
                className={`text-2xl font-bold ${
                  readiness.total >= 70
                    ? 'text-c-success'
                    : readiness.total >= 40
                      ? 'text-c-warning'
                      : 'text-danger-400'
                }`}
              >
                {readiness.total}%
              </div>
            </div>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-c-info text-white hover:opacity-90"
            >
              <Save size={16} className="mr-2" />
              {isSaving ? 'Saving...' : 'Save Initiative Charter'}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-6 pb-0 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all ${
                activeTab === tab.id
                  ? 'bg-c-surface-raised dark:bg-c-bg text-c-text border-t border-x border-c-border-subtle'
                  : 'text-c-text-muted hover:text-c-text dark:hover:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface-raised'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Decision to Make */}
            <div className="bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertOctagon size={16} className="text-c-warning" />
                <span className="text-xs font-semibold text-c-text-muted uppercase">
                  Decision to Be Made
                </span>
              </div>
              <input
                type="text"
                value={initiative.decisionToMake || ''}
                onChange={(e) => setInitiative({ ...initiative, decisionToMake: e.target.value })}
                placeholder="e.g. Approve Pilot Budget of $50k"
                className="w-full text-xl font-semibold text-c-text bg-transparent border-none focus:outline-none placeholder:text-c-text-muted dark:placeholder:text-c-text-secondary"
              />
              <p className="text-xs text-c-text-muted mt-2">
                Define the specific decision executives need to make today.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Executive One-Liner */}
              <div className="bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={16} className="text-c-accent" />
                  <span className="text-xs font-semibold text-c-text-muted uppercase">
                    Executive One-Liner
                  </span>
                </div>
                <textarea
                  value={initiative.applicantOneLiner || ''}
                  onChange={(e) =>
                    setInitiative({ ...initiative, applicantOneLiner: e.target.value })
                  }
                  placeholder="Achieve [X] by changing [Y] so that [Z improves]"
                  className="w-full h-24 text-sm text-c-text-secondary bg-c-surface-raised border border-c-border-subtle rounded-lg p-3 focus:outline-none focus:border-c-accent resize-none"
                />
              </div>

              {/* Strategic Fit */}
              <div className="bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Target size={16} className="text-c-info" />
                    <span className="text-xs font-semibold text-c-text-muted uppercase">
                      Strategic Fit
                    </span>
                  </div>
                  <button className="text-xs text-c-info hover:opacity-80 flex items-center gap-1">
                    <Sparkles size={12} />
                    Analyze
                  </button>
                </div>
                <div className="space-y-2">
                  {['Alignment with Axis', 'Corporate Goal', 'Pain Point'].map((item) => (
                    <div
                      key={item}
                      className="flex items-center justify-between p-2 bg-c-surface-raised rounded-lg"
                    >
                      <span className="text-sm text-c-text-secondary">{item}</span>
                      <button className="text-c-text-muted hover:text-c-text-secondary dark:hover:text-c-text-muted">
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Problem Statement */}
            <div className="bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] p-5">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle size={16} className="text-c-warning" />
                <span className="text-xs font-semibold text-c-text-muted uppercase">
                  Problem Statement (The Why)
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-c-text-secondary uppercase mb-2 block">
                    Symptom
                  </label>
                  <input
                    type="text"
                    value={initiative.problemStructured?.symptom || ''}
                    onChange={(e) =>
                      setInitiative({
                        ...initiative,
                        problemStructured: {
                          symptom: e.target.value,
                          rootCause: initiative.problemStructured?.rootCause || '',
                          costOfInaction: initiative.problemStructured?.costOfInaction || '',
                        },
                      })
                    }
                    placeholder="What is visible?"
                    className="w-full text-sm text-c-text-secondary bg-c-surface-raised border border-c-border-subtle rounded-lg p-3 focus:outline-none focus:border-c-accent"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-c-text-secondary uppercase mb-2 block">
                    Root Cause
                  </label>
                  <input
                    type="text"
                    value={initiative.problemStructured?.rootCause || ''}
                    onChange={(e) =>
                      setInitiative({
                        ...initiative,
                        problemStructured: {
                          symptom: initiative.problemStructured?.symptom || '',
                          rootCause: e.target.value,
                          costOfInaction: initiative.problemStructured?.costOfInaction || '',
                        },
                      })
                    }
                    placeholder="Why is it happening?"
                    className="w-full text-sm text-c-text-secondary bg-c-surface-raised border border-c-border-subtle rounded-lg p-3 focus:outline-none focus:border-c-accent"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-c-text-secondary uppercase mb-2 block">
                    Cost of Inaction
                  </label>
                  <input
                    type="text"
                    value={initiative.problemStructured?.costOfInaction || ''}
                    onChange={(e) =>
                      setInitiative({
                        ...initiative,
                        problemStructured: {
                          symptom: initiative.problemStructured?.symptom || '',
                          rootCause: initiative.problemStructured?.rootCause || '',
                          costOfInaction: e.target.value,
                        },
                      })
                    }
                    placeholder="What if we do nothing?"
                    className="w-full text-sm text-c-text-secondary bg-c-surface-raised border border-c-border-subtle rounded-lg p-3 focus:outline-none focus:border-c-accent"
                  />
                </div>
              </div>
            </div>
            <InitiativeSourceLink
              sourceType={initiative.sourceType}
              sourceId={initiative.sourceId}
              isPolish={isPolish}
            />

            {/* Summary */}
            <div className="bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] p-5">
              <div className="flex items-center gap-2 mb-3">
                <FileText size={16} className="text-c-text-secondary" />
                <span className="text-xs font-semibold text-c-text-muted uppercase">Summary</span>
              </div>
              <textarea
                value={initiative.summary || ''}
                onChange={(e) => setInitiative({ ...initiative, summary: e.target.value })}
                placeholder="Brief description of this initiative..."
                className="w-full h-32 text-sm text-c-text-secondary bg-c-surface-raised border border-c-border-subtle rounded-lg p-3 focus:outline-none focus:border-c-accent resize-none"
              />
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <InitiativeTasksTab initiativeId={initiative.id} tasks={initiative.tasks || []} />
        )}

        {activeTab === 'economics' && <InitiativeFinancialIntegration initiative={initiative} />}

        {activeTab === 'intelligence' && (
          <InitiativeIntelligenceTab
            initiative={initiative}
            onChange={(updates: Partial<FullInitiative>) =>
              setInitiative({ ...initiative, ...updates })
            }
          />
        )}

        {/* Placeholder for other tabs */}
        {['definition', 'execution', 'governance', 'team', 'comments', 'history'].includes(
          activeTab
        ) && (
          <div className="flex items-center justify-center h-64 text-c-text-muted">
            <div className="text-center">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium text-c-text mb-2">
                {tabs.find((t) => t.id === activeTab)?.label}
              </p>
              <p className="text-sm">This section is available in the full modal view</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InitiativeDetailCard;
