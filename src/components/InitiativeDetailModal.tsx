import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Award,
  BookOpen,
  Brain,
  Calendar,
  CheckCircle,
  Clock,
  Copy,
  DollarSign,
  Download,
  FileText,
  GitBranch,
  Globe,
  History,
  Lightbulb,
  Link2,
  MessageSquare,
  Save,
  Send,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../services/api';
import { trackFunnelEvent } from '../services/funnelAnalytics';
import {
  FullInitiative,
  InitiativeComment,
  InitiativeTeamMember,
  InitiativeVersion,
  RelatedInitiative,
  StakeholderImpact,
  StrategicGoal,
  StrategicIntent,
  User,
} from '../types';
import { InitiativeFinancialIntegration } from './Economics/InitiativeFinancialIntegration';
import { InitiativeIntelligenceTab } from './InitiativeIntelligenceTab';
import { InitiativeTasksTab } from './InitiativeTasksTab';
import { NotebookMetadataBadges } from './MyWork/notebook/NotebookMetadataBadges';
import { Button } from './ui/primitives/Button';
import { Select } from './ui/select';

interface InitiativeDetailModalProps {
  initiative: FullInitiative;
  isOpen: boolean;
  onClose: () => void;
  onSave: (initiative: FullInitiative) => void;
  users?: User[];
  currentUser?: User | null; // Added currentUser
  strategicGoals?: StrategicGoal[];
}

export const InitiativeDetailModal: React.FC<InitiativeDetailModalProps> = React.memo(
  ({
    initiative: initialInitiative,
    isOpen,
    onClose,
    onSave,
    users: rawUsers = [],
    currentUser,
    strategicGoals = [],
  }) => {
    const { t, i18n } = useTranslation();
    const isPolish = i18n.language === 'pl';
    // Ensure users is always an array to prevent .map() errors
    const users = Array.isArray(rawUsers) ? rawUsers : [];
    const [initiative, setInitiative] = useState<FullInitiative>({ ...initialInitiative });
    const [activeTab, setActiveTab] = useState<
      | 'overview'
      | 'tasks'
      | 'definition'
      | 'execution'
      | 'economics'
      | 'governance'
      | 'team'
      | 'comments'
      | 'history'
      | 'intelligence'
    >('overview');

    // T009: Suggested ideas (private) while editing initiative
    const [suggestedIdeas, setSuggestedIdeas] = useState<
      { id: string; title: string; body?: string; tags?: string[]; createdAt?: string }[]
    >([]);
    const [suggestedIdeasLoading, setSuggestedIdeasLoading] = useState(false);
    // T011: Suggested notebook pages
    const [suggestedNotes, setSuggestedNotes] = useState<
      {
        id: string;
        title: string;
        contentText?: string;
        tags?: string[];
        updatedAt?: string;
        captureSource?: string | null;
        captureMetadata?: { fileOriginalname?: string | null; fileMimetype?: string | null } | null;
        convertedTo?: Array<{ type?: string | null; id?: string | null }> | null;
      }[]
    >([]);
    const [suggestedNotesLoading, setSuggestedNotesLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [newComment, setNewComment] = useState('');

    useEffect(() => {
      const q = [
        initiative?.name,
        initiative?.decisionToMake,
        initiative?.applicantOneLiner,
        initiative?.problemStructured?.symptom,
        initiative?.problemStructured?.rootCause,
      ]
        .filter(Boolean)
        .join(' ')
        .trim();
      if (!q) {
        setSuggestedIdeas([]);
        setSuggestedNotes([]);
        return;
      }

      const handle = window.setTimeout(async () => {
        try {
          setSuggestedIdeasLoading(true);
          const ideas = await Api.suggestMyIdeas(String(q).slice(0, 400), 5);
          const arr = Array.isArray(ideas) ? ideas : [];
          setSuggestedIdeas(arr);
          if (arr.length > 0) {
            trackFunnelEvent('my_idea_suggested', { surface: 'initiative', count: arr.length });
          }
        } catch {
          setSuggestedIdeas([]);
        } finally {
          setSuggestedIdeasLoading(false);
        }

        try {
          setSuggestedNotesLoading(true);
          const notes = await Api.getNotebookPages({ q: String(q).slice(0, 400), limit: 5 });
          const arr = Array.isArray(notes) ? notes : [];
          setSuggestedNotes(arr);
          if (arr.length > 0) {
            trackFunnelEvent('active_notes_suggested', {
              surface: 'initiative',
              count: arr.length,
            });
          }
        } catch {
          setSuggestedNotes([]);
        } finally {
          setSuggestedNotesLoading(false);
        }
      }, 450);

      return () => window.clearTimeout(handle);
    }, [
      initiative?.name,
      initiative?.decisionToMake,
      initiative?.applicantOneLiner,
      initiative?.problemStructured?.symptom,
      initiative?.problemStructured?.rootCause,
    ]);

    // OPTIMIZED: Enhanced Readiness Score Calculation (v2)
    const calculateReadiness = useCallback(() => {
      // 1. Strategic (15%) - Clear strategic alignment
      let strategic = 0;
      if (initiative.name && initiative.name.length > 5) strategic += 3;
      if (initiative.strategicIntent) strategic += 4;
      if (initiative.axis) strategic += 4;
      if (initiative.applicantOneLiner && initiative.applicantOneLiner.length > 10) strategic += 4;

      // 2. Problem (15%) - Well-defined problem
      let problem = 0;
      if (initiative.problemStructured?.symptom) problem += 4;
      if (initiative.problemStructured?.rootCause) problem += 4;
      if (initiative.problemStructured?.costOfInaction) problem += 4;
      if (initiative.stakeholders && initiative.stakeholders.length > 0) problem += 3;

      // 3. Target (15%) - Clear target state
      let target = 0;
      if (initiative.targetState?.process?.length) target += 5;
      if (initiative.targetState?.behavior?.length) target += 5;
      if (initiative.targetState?.capability?.length) target += 5;

      // 4. Execution (15%) - Execution planning
      let execution = 0;
      if (initiative.killCriteria && initiative.killCriteria.length > 0) execution += 5;
      if (initiative.keyRisks && initiative.keyRisks.length > 0) execution += 5;
      if (initiative.deliverables && initiative.deliverables.length > 0) execution += 5;

      // 5. Value (15%) - Business case
      let value = 0;
      if (initiative.businessValue) value += 5;
      if (initiative.capex || initiative.costCapex) value += 4;
      if (initiative.annualBenefit || initiative.expectedRoi) value += 6;

      // 6. Governance (15%) - Ownership and accountability
      let governance = 0;
      if (initiative.ownerBusinessId) governance += 5;
      if (initiative.ownerExecutionId) governance += 5;
      if (initiative.sponsorId) governance += 5;

      // 7. Timeline (10%) - Planning readiness
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

    const readinessData = calculateReadiness();
    const readiness = readinessData.total;
    const isReady = readiness >= 80;

    // OPTIMIZED: Memoized callbacks to prevent unnecessary re-renders
    const generateSummary = useCallback(() => {
      // Mock generation
      setInitiative((prev) => ({
        ...prev,
        summary: `** Executive Summary(AI Generated) **\n\nThis initiative aims to ${prev.strategicIntent?.toLowerCase() || 'improve'} the organization by addressing ${prev.problemStatement?.slice(0, 30)}...\n\nIt is aligned with our goal to ${prev.applicantOneLiner || 'drive value'}.`,
      }));
    }, []);

    const generateExecutionStrategy = useCallback(async () => {
      setIsGenerating(true);
      try {
        const res = await fetch('/api/ai/execution-strategy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initiative, userId: currentUser?.id }),
        });
        if (!res.ok) throw new Error('AI Generation Failed');

        const data = await res.json();

        setInitiative((prev) => ({
          ...prev,
          killCriteria: data.killCriteria,
          keyRisks: data.keyRisks?.map((r: any) => ({ ...r, metric: r.metric as any })) || [],
          milestones:
            data.milestones?.map((m: any) => ({
              ...m,
              isDecisionGate: !!m.isDecisionGate,
              decision: m.decision || 'continue',
            })) || [],
        }));
      } catch (error) {
        console.error(error);
        alert('Failed to generate strategy via AI. Please try again.');
      } finally {
        setIsGenerating(false);
      }
    }, [initiative, currentUser?.id]);

    if (!isOpen) return null;

    const handleCheckStrategicFit = async () => {
      setIsGenerating(true);
      try {
        const res = await fetch('/api/ai/strategic-fit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initiative, strategicGoals, userId: currentUser?.id }),
        });
        if (!res.ok) throw new Error('AI Generation Failed');

        const data = await res.json();
        setInitiative((prev) => ({
          ...prev,
          strategicFit: data,
        }));
      } catch (error) {
        console.error(error);
        alert('Failed to check Strategic Fit via AI.');
      } finally {
        setIsGenerating(false);
      }
    };

    const handleGenerateList = async (targetField: any, subField: string | null = null) => {
      setIsGenerating(true);
      try {
        const contextStr = `Initiative: ${initiative.name}\nObjective: ${initiative.applicantOneLiner}`;
        let listType = targetField;
        if (subField) listType += ` (${subField})`;

        const res = await fetch('/api/ai/generate-list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            context: contextStr,
            listType,
            count: 3,
            userId: currentUser?.id,
          }),
        });
        const items = await res.json();

        if (!Array.isArray(items)) return;

        setInitiative((prev) => {
          const copy = { ...prev };
          if (targetField === 'targetState' && subField) {
            const ts = { ...copy.targetState } as any;
            ts[subField] = [...(ts[subField] || []), ...items];
            copy.targetState = ts;
          } else if (targetField === 'deliverables') {
            copy.deliverables = [...(copy.deliverables || []), ...items];
          } else if (targetField === 'scopeIn') {
            copy.scopeIn = [...(copy.scopeIn || []), ...items];
          } else if (targetField === 'scopeOut') {
            copy.scopeOut = [...(copy.scopeOut || []), ...items];
          } else if (targetField === 'assumptions' && subField) {
            const assum = { ...copy.assumptions } as any;
            // For assumptions we want a single string usually, but if list returned, join it or take first?
            // The UI has inputs, not lists for assumptions.
            // Wait, existing UI: input value={initiative.assumptions?.org}.
            // So we expect a single string.
            // I will change generate-list to just return one string if we request count=1 or join them.
            assum[subField] = items.join('. ');
            copy.assumptions = assum;
          } else if (targetField === 'successCriteria') {
            const newCriteria = items.map((val: string) => ({
              type: 'Metric' as const,
              value: val,
            }));
            copy.structuredSuccessCriteria = [
              ...(copy.structuredSuccessCriteria || []),
              ...newCriteria,
            ];
          }
          return copy;
        });
      } catch (e) {
        console.error('AI List Gen Error', e);
      } finally {
        setIsGenerating(false);
      }
    };

    const handleAutoFill = async () => {
      setIsGenerating(true);
      try {
        const res = await fetch('/api/ai/autofill-initiative', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initiative, userId: currentUser?.id }),
        });
        if (!res.ok) throw new Error('AI Autofill Failed');
        const data = await res.json();
        setInitiative((prev) => ({
          ...prev,
          ...data,
        }));
      } catch (error) {
        console.error(error);
        alert('Failed to autofill initiative via AI.');
      } finally {
        setIsGenerating(false);
      }
    };

    const handleSave = () => {
      // Validation
      if (!initiative.strategicIntent) {
        alert('Strategic Intent is mandatory.');
        return;
      }
      if (!initiative.applicantOneLiner || initiative.applicantOneLiner.length < 10) {
        alert('Executive One-Liner is mandatory and must be meaningful.');
        return;
      }
      // AI Behavior: Block generic descriptions
      const isGeneric = (text?: string) =>
        !text || text.includes('Brief overview') || text.length < 50;
      if (isGeneric(initiative.summary)) {
        alert('Executive Summary is too generic or short. Please elaborate.');
        return;
      }

      if (!initiative.killCriteria || initiative.killCriteria.length < 10) {
        alert(
          'Kill Criteria is mandatory. Please define under what conditions this initiative should be stopped.'
        );
        return;
      }

      onSave(initiative);
      onClose();
    };

    const handleArrayChange = (
      field: 'deliverables' | 'successCriteria' | 'scopeIn' | 'scopeOut',
      index: number,
      value: string
    ) => {
      const newArray = [...(initiative[field] || [])];
      newArray[index] = value;
      setInitiative({ ...initiative, [field]: newArray });
    };

    const addArrayItem = (field: 'deliverables' | 'successCriteria' | 'scopeIn' | 'scopeOut') => {
      setInitiative({ ...initiative, [field]: [...(initiative[field] || []), ''] });
    };

    const removeArrayItem = (
      field: 'deliverables' | 'successCriteria' | 'scopeIn' | 'scopeOut',
      index: number
    ) => {
      const newArray = [...(initiative[field] || [])];
      newArray.splice(index, 1);
      setInitiative({ ...initiative, [field]: newArray });
    };

    return (
      <div className="fixed inset-0 z-overlay flex items-center justify-center bg-slate-900/50 dark:bg-black/80 backdrop-blur-sm p-4 transition-all">
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
          {/* Header with Module Indicator */}
          <div className="border-b border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950">
            {/* Module Transition Indicator */}
            <div className="h-8 border-b border-slate-200 dark:border-navy-700 flex items-center px-6 gap-0">
              {[
                {
                  module: t('initiative.tabs.overview'),
                  statuses: ['DRAFT'],
                  color: 'slate',
                  icon: '1',
                },
                {
                  module: t('initiative.charterTitle'),
                  statuses: ['PLANNING', 'REVIEW', 'APPROVED'],
                  color: 'amber',
                  icon: '2',
                },
                {
                  module: t('initiative.tabs.execution'),
                  statuses: ['EXECUTING', 'BLOCKED', 'DONE'],
                  color: 'blue',
                  icon: '3',
                },
              ].map((mod, idx, arr) => {
                const isActive = mod.statuses.includes(initiative.status || 'DRAFT');
                const isPassed =
                  arr
                    .slice(0, idx)
                    .some((m) => m.statuses.includes(initiative.status || 'DRAFT')) ||
                  idx < arr.findIndex((m) => m.statuses.includes(initiative.status || 'DRAFT'));
                return (
                  <React.Fragment key={mod.module}>
                    <div
                      className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold transition-all ${
                        isActive
                          ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 shadow-sm'
                          : isPassed
                            ? 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-500'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${
                          isActive
                            ? 'bg-blue-500 text-white'
                            : isPassed
                              ? 'bg-green-500 text-white'
                              : 'bg-slate-300 dark:bg-slate-600 text-white'
                        }`}
                      >
                        {isPassed && !isActive ? '✓' : mod.icon}
                      </span>
                      <span className="uppercase tracking-wide">{mod.module}</span>
                    </div>
                    {idx < arr.length - 1 && (
                      <div
                        className={`w-8 h-0.5 ${isPassed || isActive ? 'bg-green-300 dark:bg-green-500/30' : 'bg-slate-200 dark:bg-slate-700'}`}
                      />
                    )}
                  </React.Fragment>
                );
              })}
              <div className="flex-1" />
              <span className="text-[10px] text-slate-600 dark:text-slate-500">
                {initiative.status === 'ARCHIVED'
                  ? `📦 ${t('status.ARCHIVED')}`
                  : initiative.status === 'CANCELLED'
                    ? `❌ ${t('status.CANCELLED')}`
                    : ''}
              </span>
            </div>

            {/* Main Header */}
            <div className="h-14 flex items-center justify-between px-6">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400`}
                >
                  <Target size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-navy-900 dark:text-white">
                    {t('initiative.charterTitle')}
                  </h2>
                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-500">
                    <span className="uppercase">
                      {initiative.id
                        ? `${t('initiative.idLabel')} ${initiative.id.slice(0, 8)}`
                        : t('initiative.newInitiative')}
                    </span>
                    <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
                    <span
                      className={`uppercase font-bold ${
                        initiative.status === 'BLOCKED'
                          ? 'text-danger-400'
                          : initiative.status === 'DONE'
                            ? 'text-green-400'
                            : initiative.status === 'EXECUTING'
                              ? 'text-blue-400'
                              : 'text-amber-400'
                      }`}
                    >
                      {t(`status.${initiative.status || 'DRAFT'}`).replace('_', ' ')}
                    </span>
                    <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
                    <div className="flex items-center gap-1 text-blue-400">
                      <TrendingUp size={12} />
                      <span>
                        {t('initiative.progressLabel')} {initiative.progress || 0}%
                      </span>
                    </div>
                    <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
                    <div
                      className={`flex items-center gap-1 ${isReady ? 'text-green-400' : 'text-amber-400'}`}
                    >
                      <Brain size={12} />
                      <span>
                        {t('initiative.readinessLabel')} {readiness}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={onClose} aria-label="Close">
                  <X size={20} />
                </Button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900/50 px-6 gap-6">
            {[
              { id: 'overview', label: t('initiative.tabs.overview'), icon: FileText },
              { id: 'tasks', label: t('initiative.tabs.tasks'), icon: CheckCircle },
              { id: 'definition', label: t('initiative.tabs.definition'), icon: Target },
              { id: 'execution', label: t('initiative.tabs.execution'), icon: Calendar },
              { id: 'economics', label: t('initiative.tabs.economics'), icon: DollarSign },
              { id: 'governance', label: t('initiative.tabs.governance'), icon: Shield },
              { id: 'team', label: t('initiative.tabs.team'), icon: Users },
              { id: 'comments', label: t('initiative.tabs.discussion'), icon: MessageSquare },
              { id: 'history', label: t('initiative.tabs.history'), icon: History },
              { id: 'intelligence', label: t('initiative.tabs.intelligence'), icon: Brain },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-500'
                    : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-navy-900 dark:hover:text-white'
                } `}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-navy-900">
            {/* TASKS TAB */}
            {activeTab === 'tasks' && (
              <InitiativeTasksTab
                initiativeId={initiative.id}
                users={users}
                currentUser={currentUser!}
                initiative={initiative}
              />
            )}

            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="space-y-8 pb-10">
                {/* Relevant ideas (T009) */}
                <div className="bg-slate-50 dark:bg-navy-950 rounded-xl p-4 border border-slate-200 dark:border-navy-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-navy-900 dark:text-white flex items-center gap-2">
                      <Lightbulb size={16} className="text-amber-500 dark:text-amber-400" />{' '}
                      {t('myWork.ideas.suggestions', 'Relevant ideas')}
                    </h3>
                    {suggestedIdeasLoading ? (
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {t('common.loading', 'Loading…')}
                      </span>
                    ) : null}
                  </div>

                  {suggestedIdeas.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t(
                        'myWork.ideas.suggestionsEmpty',
                        'No suggestions yet. Save ideas from chat to build your private library.'
                      )}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {suggestedIdeas.map((idea) => (
                        <div
                          key={idea.id}
                          className="bg-white dark:bg-navy-900 rounded-lg border border-slate-200 dark:border-navy-700 p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-navy-900 dark:text-white truncate">
                                {idea.title}
                              </div>
                              {idea.body ? (
                                <div className="mt-1 text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                                  {idea.body}
                                </div>
                              ) : null}
                            </div>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                const insert = [
                                  initiative.applicantOneLiner || '',
                                  '',
                                  `---`,
                                  `${t('myWork.ideas.idea', 'Idea')}: ${idea.title}`,
                                  idea.body || '',
                                ]
                                  .filter(Boolean)
                                  .join('\n');
                                setInitiative({ ...initiative, applicantOneLiner: insert });
                                trackFunnelEvent('my_idea_used', {
                                  surface: 'initiative',
                                  ideaId: idea.id,
                                });
                                toast.success(t('myWork.ideas.insertedToast', 'Inserted'));
                              }}
                            >
                              {t('myWork.ideas.insert', 'Insert')}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Relevant notes (T011) */}
                <div className="bg-slate-50 dark:bg-navy-950 rounded-xl p-4 border border-slate-200 dark:border-navy-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-navy-900 dark:text-white flex items-center gap-2">
                      <BookOpen size={16} className="text-slate-700 dark:text-slate-300" />{' '}
                      {t('myWork.notebook.suggestions', 'Relevant notes')}
                    </h3>
                    {suggestedNotesLoading ? (
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {t('common.loading', 'Loading…')}
                      </span>
                    ) : null}
                  </div>

                  {suggestedNotes.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t(
                        'myWork.notebook.suggestionsEmpty',
                        'No suggestions yet. Create notebook pages to build a searchable library.'
                      )}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {suggestedNotes.map((note) => (
                        <div
                          key={note.id}
                          className="bg-white dark:bg-navy-900 rounded-lg border border-slate-200 dark:border-navy-700 p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-navy-900 dark:text-white truncate">
                                {note.title}
                              </div>
                              {note.contentText ? (
                                <div className="mt-1 text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                                  {note.contentText}
                                </div>
                              ) : null}
                              <NotebookMetadataBadges
                                captureSource={note.captureSource}
                                captureMetadata={note.captureMetadata}
                                convertedTo={note.convertedTo}
                                isPolish={isPolish}
                                className="mt-1.5"
                              />
                            </div>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                const insert = [
                                  initiative.applicantOneLiner || '',
                                  '',
                                  `---`,
                                  `${t('myWork.notebook.note', 'Note')}: ${note.title}`,
                                  note.contentText || '',
                                ]
                                  .filter(Boolean)
                                  .join('\n');
                                setInitiative({ ...initiative, applicantOneLiner: insert });
                                trackFunnelEvent('active_notes_inserted', {
                                  surface: 'initiative',
                                  noteId: note.id,
                                });
                                toast.success(t('myWork.notebook.insertedToast', 'Inserted'));
                              }}
                            >
                              {t('myWork.notebook.insert', 'Insert')}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 1. Decision Framing */}
                <div className="bg-slate-50 dark:bg-navy-950 p-4 rounded-xl border border-slate-200 dark:border-blue-500/30 shadow-sm dark:shadow-blue-900/10 flex items-start gap-6">
                  <div className="flex-1 space-y-2">
                    <label className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-2">
                      <AlertOctagon size={14} /> {t('initiative.decisionToMake')}
                    </label>
                    <input
                      className="w-full bg-white dark:bg-navy-900 border-b-2 border-blue-500/50 text-xl font-bold text-navy-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 py-2 placeholder:text-slate-400 dark:placeholder:text-blue-900/50"
                      placeholder="e.g. Approve Pilot Budget of $50k"
                      value={initiative.decisionToMake || ''}
                      onChange={(e) =>
                        setInitiative({ ...initiative, decisionToMake: e.target.value })
                      }
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Define the specific decision executives need to make today.
                    </p>
                  </div>
                  <div className="w-64 space-y-2">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-500 uppercase tracking-wider">
                      {t('initiative.decisionOwner')}
                    </label>
                    <Select
                      value={initiative.decisionOwnerId || ''}
                      onChange={(val: string) =>
                        setInitiative({ ...initiative, decisionOwnerId: val })
                      }
                      placeholder="Select Owner..."
                      options={users.map((u) => ({
                        value: u.id,
                        label: `${u.firstName} ${u.lastName}`,
                      }))}
                    />
                  </div>
                </div>

                {/* 2. Executive Definition */}
                <div className="grid grid-cols-12 gap-6">
                  <div className="col-span-8 space-y-6">
                    <div className="bg-slate-50 dark:bg-navy-950 rounded-xl p-4 border border-slate-200 dark:border-navy-700 space-y-4">
                      <h3 className="text-sm font-bold text-navy-900 dark:text-white flex items-center gap-2">
                        <Sparkles size={16} className="text-primary-600 dark:text-primary-400" />{' '}
                        {t('initiative.oneLiner')}
                      </h3>
                      <div className="bg-white dark:bg-navy-900 p-4 rounded-lg border border-slate-200 dark:border-navy-700 space-y-3">
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mb-2">
                          Structure: Achieve [X] by changing [Y] so that [Z improves]
                        </p>
                        <textarea
                          className="w-full bg-transparent text-lg font-medium text-navy-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none resize-none h-20"
                          placeholder="This initiative exists to..."
                          value={initiative.applicantOneLiner || ''}
                          onChange={(e) =>
                            setInitiative({
                              ...initiative,
                              applicantOneLiner: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-navy-950 rounded-xl p-4 border border-slate-200 dark:border-navy-700 space-y-4">
                      <h3 className="text-sm font-bold text-navy-900 dark:text-white flex items-center gap-2">
                        <AlertTriangle size={16} className="text-amber-500 dark:text-amber-400" />{' '}
                        {t('initiative.problemStatement')}
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">
                            {t('initiative.symptom')}
                          </label>
                          <input
                            className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded p-2 text-navy-900 dark:text-white text-sm"
                            placeholder="What is visible?"
                            value={initiative.problemStructured?.symptom || ''}
                            onChange={(e) =>
                              setInitiative({
                                ...initiative,
                                problemStructured: {
                                  ...(initiative.problemStructured || {
                                    symptom: '',
                                    rootCause: '',
                                    costOfInaction: '',
                                  }),
                                  symptom: e.target.value,
                                },
                              })
                            }
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">
                            {t('initiative.rootCause')}
                          </label>
                          <input
                            className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded p-2 text-navy-900 dark:text-white text-sm"
                            placeholder="Why is it happening?"
                            value={initiative.problemStructured?.rootCause || ''}
                            onChange={(e) =>
                              setInitiative({
                                ...initiative,
                                problemStructured: {
                                  ...(initiative.problemStructured || {
                                    symptom: '',
                                    rootCause: '',
                                    costOfInaction: '',
                                  }),
                                  rootCause: e.target.value,
                                },
                              })
                            }
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">
                            {t('initiative.costOfInaction')}
                          </label>
                          <input
                            className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded p-2 text-navy-900 dark:text-white text-sm"
                            placeholder="What if we do nothing?"
                            value={initiative.problemStructured?.costOfInaction || ''}
                            onChange={(e) =>
                              setInitiative({
                                ...initiative,
                                problemStructured: {
                                  ...(initiative.problemStructured || {
                                    symptom: '',
                                    rootCause: '',
                                    costOfInaction: '',
                                  }),
                                  costOfInaction: e.target.value,
                                },
                              })
                            }
                          />
                        </div>

                        {/* Legacy Textarea Fallback (if user wants to write generic text) */}
                        <div className="col-span-2 mt-2">
                          <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">
                            {t('initiative.fullDescriptionLabel')}
                          </p>
                          <textarea
                            className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded p-2 text-slate-600 dark:text-slate-400 text-xs h-16 resize-none"
                            value={initiative.problemStatement || ''}
                            onChange={(e) =>
                              setInitiative({
                                ...initiative,
                                problemStatement: e.target.value,
                              })
                            }
                            placeholder="Additional context..."
                          />
                        </div>
                      </div>
                    </div>

                    {/* Basic Fields */}
                    <div className="grid grid-cols-2 gap-4">
                      <InputGroup label={t('initiative.nameLabel')}>
                        <input
                          className="w-full bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg p-3 text-navy-900 dark:text-white focus:border-blue-500 outline-none"
                          value={initiative.name}
                          onChange={(e) => setInitiative({ ...initiative, name: e.target.value })}
                        />
                      </InputGroup>
                      <InputGroup label={t('initiative.strategicIntentLabel')}>
                        <Select
                          value={initiative.strategicIntent || ''}
                          onChange={(val: string) =>
                            setInitiative({
                              ...initiative,
                              strategicIntent: val as StrategicIntent,
                            })
                          }
                          placeholder="Select Intent..."
                          options={[
                            { value: 'Grow', label: 'Grow' },
                            { value: 'Fix', label: 'Fix' },
                            { value: 'Stabilize', label: 'Stabilize' },
                            { value: 'De-risk', label: 'De-risk' },
                            { value: 'Build capability', label: 'Build capability' },
                          ]}
                        />
                      </InputGroup>
                    </div>
                  </div>

                  <div className="col-span-4 space-y-6">
                    {/* Strategic Fit Panel */}
                    <div className="bg-slate-50 dark:bg-navy-950 rounded-xl p-4 border border-slate-200 dark:border-navy-700 h-full">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-bold text-navy-900 dark:text-white">
                          {t('initiative.strategicFitTitle')}
                        </h3>
                        <button
                          onClick={handleCheckStrategicFit}
                          disabled={isGenerating}
                          className="text-blue-600 dark:text-blue-400 hover:text-navy-900 dark:hover:text-white"
                        >
                          {isGenerating ? (
                            <div className="w-4 h-4 rounded-full border-2 border-t-transparent border-blue-500 animate-spin" />
                          ) : (
                            <Sparkles size={14} />
                          )}
                        </button>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-2 bg-white dark:bg-navy-900 rounded border border-slate-200 dark:border-navy-700">
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {t('initiative.alignmentWithAxis')}
                          </span>
                          {initiative.strategicFit?.axisAlign ? (
                            <CheckCircle size={14} className="text-green-500" />
                          ) : (
                            <X size={14} className="text-slate-600 dark:text-slate-400" />
                          )}
                        </div>
                        <div className="flex items-center justify-between p-2 bg-white dark:bg-navy-900 rounded border border-slate-200 dark:border-navy-700">
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {t('initiative.corporateGoal')}
                          </span>
                          {initiative.strategicFit?.goalAlign ? (
                            <CheckCircle size={14} className="text-green-500" />
                          ) : (
                            <X size={14} className="text-slate-600 dark:text-slate-400" />
                          )}
                        </div>
                        <div className="flex items-center justify-between p-2 bg-white dark:bg-navy-900 rounded border border-slate-200 dark:border-navy-700">
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {t('initiative.painPoint')}
                          </span>
                          {initiative.strategicFit?.painPointAlign ? (
                            <CheckCircle size={14} className="text-green-500" />
                          ) : (
                            <X size={14} className="text-slate-600 dark:text-slate-400" />
                          )}
                        </div>
                        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-500/10 rounded border border-blue-100 dark:border-blue-500/20">
                          <p className="text-xs text-blue-700 dark:text-blue-300 italic h-24 overflow-y-auto">
                            {initiative.strategicFit?.reasoning || 'Click Sparkles to analyze...'}
                          </p>
                        </div>

                        {/* Enhanced Readiness Breakdown v2 */}
                        <div className="mt-6 pt-6 border-t border-slate-200 dark:border-navy-700">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-xs font-bold text-navy-900 dark:text-white">
                              {t('initiative.charterReadiness')}
                            </h4>
                            <div
                              className={`text-lg font-bold ${readiness >= 80 ? 'text-green-500' : readiness >= 50 ? 'text-amber-500' : 'text-danger-500'}`}
                            >
                              {readiness}%
                            </div>
                          </div>
                          <div className="space-y-2">
                            {Object.entries(readinessData.details).map(([key, score]) => {
                              const maxScore =
                                readinessData.maxScores[
                                  key as keyof typeof readinessData.maxScores
                                ] || 15;
                              const percentage = (score / maxScore) * 100;
                              const isComplete = score >= maxScore;
                              return (
                                <div key={key} className="flex items-center gap-3">
                                  <div
                                    className={`w-2 h-2 rounded-full ${isComplete ? 'bg-green-500' : percentage > 50 ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                                  />
                                  <span className="text-xs text-slate-500 dark:text-slate-400 capitalize flex-1">
                                    {key}
                                  </span>
                                  <div className="w-24 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full transition-all ${isComplete ? 'bg-green-500' : percentage > 50 ? 'bg-amber-500' : 'bg-blue-500'}`}
                                      style={{ width: `${percentage}%` }}
                                    />
                                  </div>
                                  <span
                                    className={`text-xs font-medium ${isComplete ? 'text-green-500' : 'text-slate-500 dark:text-slate-400'}`}
                                  >
                                    {score}/{maxScore}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                          {readiness < 80 && (
                            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-200 dark:border-amber-500/20">
                              <p className="text-xs text-amber-700 dark:text-amber-400">
                                <span className="font-bold">{t('initiative.incompleteLabel')}</span>{' '}
                                Fill in missing sections to reach 80% before advancing to Review.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Target State Snapshot */}
                <div className="bg-slate-50 dark:bg-navy-950 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
                  <h3 className="text-sm font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
                    <Target size={16} className="text-blue-500 dark:text-blue-400" />{' '}
                    {t('initiative.targetStateSnapshot')}
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    {['Process', 'Behavior', 'Capability'].map((type) => (
                      <div
                        key={type}
                        className="bg-white dark:bg-navy-900 p-3 rounded-lg border border-slate-200 dark:border-navy-700"
                      >
                        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 border-b border-slate-200 dark:border-navy-700 pb-1 flex justify-between">
                          {t(`initiative.${type.toLowerCase()}Changes`)}
                          <button
                            onClick={() => handleGenerateList('targetState', type.toLowerCase())}
                            disabled={isGenerating}
                            className="text-blue-500 hover:text-primary-500"
                          >
                            <Sparkles size={10} />
                          </button>
                        </h4>
                        <div className="space-y-2">
                          {(
                            initiative.targetState?.[
                              type.toLowerCase() as keyof typeof initiative.targetState
                            ] || []
                          ).map((item: string, idx: number) => (
                            <div key={idx} className="flex gap-1 group">
                              <span className="text-blue-500">•</span>
                              <input
                                className="w-full bg-transparent text-xs text-slate-700 dark:text-slate-300 focus:outline-none border-none p-0"
                                value={item}
                                onChange={(e) => {
                                  const newState = {
                                    ...(initiative.targetState || {
                                      process: [],
                                      behavior: [],
                                      capability: [],
                                    }),
                                  };
                                  const key = type.toLowerCase() as keyof typeof newState;
                                  const arr = [...(newState[key] || [])];
                                  arr[idx] = e.target.value;
                                  newState[key] = arr;
                                  setInitiative({
                                    ...initiative,
                                    targetState: newState,
                                  });
                                }}
                              />
                              <button
                                onClick={() => {
                                  const newState = {
                                    ...(initiative.targetState || {
                                      process: [],
                                      behavior: [],
                                      capability: [],
                                    }),
                                  };
                                  const key = type.toLowerCase() as keyof typeof newState;
                                  const arr = [...(newState[key] || [])];
                                  arr.splice(idx, 1);
                                  newState[key] = arr;
                                  setInitiative({
                                    ...initiative,
                                    targetState: newState,
                                  });
                                }}
                                className="opacity-0 group-hover:opacity-100 text-slate-600 dark:text-slate-400 hover:text-danger-500"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => {
                              const newState = {
                                ...(initiative.targetState || {
                                  process: [],
                                  behavior: [],
                                  capability: [],
                                }),
                              };
                              const key = type.toLowerCase() as keyof typeof newState;
                              (newState[key] as string[]).push('New item...');
                              setInitiative({ ...initiative, targetState: newState });
                            }}
                            className="text-xs text-blue-500 hover:text-blue-400"
                          >
                            + {t('initiative.addBullet')}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. Governance & Evidence */}
                <div className="grid grid-cols-2 gap-6">
                  {/* Attachments */}
                  <div className="bg-slate-50 dark:bg-navy-950 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
                    <h3 className="text-sm font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
                      <FileText size={16} className="text-blue-500 dark:text-blue-400" />{' '}
                      {t('initiative.evidenceTitle')}
                    </h3>
                    <div className="space-y-2">
                      {(initiative.attachments || []).map((att, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between bg-white dark:bg-navy-900 p-2 rounded border border-slate-200 dark:border-navy-700"
                        >
                          <div className="flex items-center gap-2">
                            <div className="p-1 bg-blue-100 dark:bg-blue-500/20 rounded">
                              <FileText size={12} className="text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <p className="text-xs text-navy-900 dark:text-white font-medium">
                                {att.name}
                              </p>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">
                                {att.type}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              const list = [...(initiative.attachments || [])];
                              list.splice(idx, 1);
                              setInitiative({ ...initiative, attachments: list });
                            }}
                            className="text-slate-600 dark:text-slate-400 hover:text-danger-500"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          const list = [...(initiative.attachments || [])];
                          list.push({
                            id: Date.now().toString(),
                            name: 'New Evidence.pdf',
                            type: 'strategy',
                            url: '',
                            uploadedAt: new Date().toISOString(),
                          });
                          setInitiative({ ...initiative, attachments: list });
                        }}
                        className="text-xs text-blue-500 hover:text-blue-400"
                      >
                        + {t('initiative.addAttachmentMock')}
                      </button>
                    </div>
                  </div>

                  {/* Change Log */}
                  <div className="bg-slate-50 dark:bg-navy-950 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
                    <h3 className="text-sm font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
                      <TrendingUp size={16} className="text-primary-600 dark:text-primary-400" />{' '}
                      {t('initiative.strategicChangeLog')}
                    </h3>
                    <div className="space-y-3">
                      {(initiative.changeLog || []).map((log, idx) => (
                        <div
                          key={idx}
                          className="bg-white dark:bg-navy-900 p-2 rounded border border-slate-200 dark:border-navy-700"
                        >
                          <div className="flex justify-between mb-1">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                              {log.date}
                            </span>
                            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1 rounded">
                              {log.user}
                            </span>
                          </div>
                          <p className="text-xs text-navy-900 dark:text-white mb-1">{log.change}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 italic">
                            Why: {log.reason}
                          </p>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          const list = [...(initiative.changeLog || [])];
                          list.push({
                            id: Date.now().toString(),
                            date: new Date().toISOString().split('T')[0],
                            user: currentUser?.firstName || 'User',
                            change: 'Updated strategy',
                            reason: 'Market shift',
                            impact: 'High',
                          });
                          setInitiative({ ...initiative, changeLog: list });
                        }}
                        className="text-xs text-primary-500 hover:text-primary-400"
                      >
                        + {t('initiative.addLogEntry')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* DEFINITION & SCOPE TAB */}
            {activeTab === 'definition' && (
              <div className="grid grid-cols-2 gap-8 h-full">
                <div className="space-y-8 overflow-y-auto pr-2">
                  {/* Strategic Roadmap Attributes (New) */}
                  <div className="bg-slate-50 dark:bg-navy-950 rounded-xl p-4 border border-slate-200 dark:border-navy-700 space-y-4">
                    <h3 className="text-navy-900 dark:text-white font-bold flex items-center gap-2 border-b border-slate-200 dark:border-navy-700 pb-2">
                      <GitBranch size={18} className="text-blue-500" />{' '}
                      {t('initiative.strategicRoadmapAttributes')}
                    </h3>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2 md:col-span-1">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">
                          {t('initiative.strategicRole')}
                        </label>
                        <Select
                          value={initiative.strategicRole || ''}
                          onChange={(val: string) =>
                            setInitiative({ ...initiative, strategicRole: val as any })
                          }
                          placeholder="Select Role..."
                          options={[
                            { value: 'Platform', label: 'Platform (Enabler)' },
                            { value: 'Engine', label: 'Engine (Core Business)' },
                            { value: 'Pilot', label: 'Pilot (Experiment)' },
                            { value: 'Scale', label: 'Scale (Growth)' },
                            { value: 'Transformation', label: 'Transformation' },
                          ]}
                        />
                      </div>
                      <div className="col-span-2 md:col-span-1">
                        {/* Placeholder for future field or spacing */}
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                          {t('initiative.placementReason')}
                        </label>
                        <button
                          onClick={async () => {
                            setIsGenerating(true);
                            try {
                              const res = await fetch('/api/ai/placement-reason', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ initiative }),
                              });
                              const data = await res.json();
                              setInitiative((prev) => ({
                                ...prev,
                                placementReason: data.reason,
                              }));
                            } catch (e) {
                              console.error(e);
                            }
                            setIsGenerating(false);
                          }}
                          disabled={isGenerating}
                          className="text-[10px] text-blue-400 hover:text-white flex items-center gap-1"
                        >
                          <Sparkles size={10} />{' '}
                          {isGenerating ? t('common.generating') : t('initiative.autoFillWithAI')}
                        </button>
                      </div>
                      <textarea
                        className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded p-2 text-sm text-navy-900 dark:text-slate-300 h-20 focus:outline-none focus:border-blue-500/50"
                        placeholder={t('initiative.placementReasonPlaceholder')}
                        value={initiative.placementReason || ''}
                        onChange={(e) =>
                          setInitiative({ ...initiative, placementReason: e.target.value })
                        }
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-3 block">
                        {t('initiative.effortProfile')}
                      </label>
                      <div className="space-y-3">
                        {[
                          {
                            label: t('initiative.analytical'),
                            key: 'analytical',
                            color: 'bg-blue-500',
                          },
                          {
                            label: t('initiative.operational'),
                            key: 'operational',
                            color: 'bg-emerald-500',
                          },
                          {
                            label: t('initiative.changeMgmt'),
                            key: 'change',
                            color: 'bg-danger-500',
                          },
                        ].map((metric) => (
                          <div key={metric.key} className="flex items-center gap-3">
                            <span className="text-xs text-slate-500 dark:text-slate-400 w-20">
                              {metric.label}
                            </span>
                            <div className="flex-1 flex items-center gap-3">
                              <input
                                type="range"
                                min="1"
                                max="5"
                                step="1"
                                className="w-full accent-blue-500 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                                value={
                                  initiative.effortProfile?.[
                                    metric.key as keyof typeof initiative.effortProfile
                                  ] || 1
                                }
                                onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  setInitiative({
                                    ...initiative,
                                    effortProfile: {
                                      analytical: initiative.effortProfile?.analytical || 1,
                                      operational: initiative.effortProfile?.operational || 1,
                                      change: initiative.effortProfile?.change || 1,
                                      [metric.key]: val,
                                    },
                                  });
                                }}
                              />
                              <span
                                className={`text-xs font-bold w-4 text-center ${initiative.effortProfile?.[metric.key as keyof typeof initiative.effortProfile] === 5 ? 'text-danger-500 dark:text-danger-400' : 'text-slate-600 dark:text-slate-300'}`}
                              >
                                {initiative.effortProfile?.[
                                  metric.key as keyof typeof initiative.effortProfile
                                ] || 1}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Success Criteria (Enhanced) */}
                  <div className="bg-slate-50 dark:bg-navy-950 rounded-xl p-4 border border-slate-200 dark:border-navy-700 space-y-4">
                    <h3 className="text-navy-900 dark:text-white font-bold flex items-center gap-2 border-b border-slate-200 dark:border-navy-700 pb-2">
                      <Award size={18} className="text-blue-500" />{' '}
                      {t('initiative.successCriteriaTyped')}
                      <button
                        onClick={() => handleGenerateList('successCriteria')}
                        disabled={isGenerating}
                        className="ml-auto text-xs flex items-center gap-1 text-primary-500 bg-primary-100 dark:bg-primary-500/10 px-2 py-1 rounded hover:bg-primary-200"
                      >
                        <Sparkles size={12} /> {t('initiative.autoSuggest')}
                      </button>
                    </h3>

                    {(
                      initiative.structuredSuccessCriteria ||
                      initiative.successCriteria?.map((s) => ({ type: 'Metric', value: s })) ||
                      []
                    ).map((item: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex gap-2 bg-slate-50 dark:bg-navy-950 p-2 rounded border border-slate-200 dark:border-navy-700"
                      >
                        <select
                          className="bg-white dark:bg-navy-900 text-xs text-blue-600 dark:text-blue-400 font-bold border-none outline-none rounded p-1 w-24"
                          value={item.type}
                          onChange={(e) => {
                            const list = [
                              ...(initiative.structuredSuccessCriteria ||
                                initiative.successCriteria?.map((s) => ({
                                  type: 'Metric',
                                  value: s,
                                })) ||
                                []),
                            ];
                            list[idx] = { ...item, type: e.target.value };
                            setInitiative({
                              ...initiative,
                              structuredSuccessCriteria: list,
                            });
                          }}
                        >
                          <option value="Metric">{t('initiative.metric')}</option>
                          <option value="Behavior">{t('initiative.behavior')}</option>
                          <option value="Process">{t('initiative.process')}</option>
                          <option value="Capability">{t('initiative.capability')}</option>
                        </select>
                        <input
                          className="flex-1 bg-transparent border-none p-1 text-sm text-navy-900 dark:text-white focus:ring-0"
                          value={item.value}
                          onChange={(e) => {
                            const list = [
                              ...(initiative.structuredSuccessCriteria ||
                                initiative.successCriteria?.map((s) => ({
                                  type: 'Metric',
                                  value: s,
                                })) ||
                                []),
                            ];
                            list[idx] = { ...item, value: e.target.value };
                            setInitiative({
                              ...initiative,
                              structuredSuccessCriteria: list,
                            });
                          }}
                          placeholder={t('initiative.criteriaDescriptionPlaceholder')}
                        />
                        <button
                          onClick={() => {
                            const list = [
                              ...(initiative.structuredSuccessCriteria ||
                                initiative.successCriteria?.map((s) => ({
                                  type: 'Metric',
                                  value: s,
                                })) ||
                                []),
                            ];
                            list.splice(idx, 1);
                            setInitiative({
                              ...initiative,
                              structuredSuccessCriteria: list,
                            });
                          }}
                          className="text-slate-500 dark:text-slate-400 hover:text-danger-500"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        const list = [
                          ...(initiative.structuredSuccessCriteria ||
                            initiative.successCriteria?.map((s) => ({
                              type: 'Metric',
                              value: s,
                            })) ||
                            []),
                        ];
                        list.push({ type: 'Metric', value: '' });
                        setInitiative({ ...initiative, structuredSuccessCriteria: list });
                      }}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 font-medium"
                    >
                      + {t('initiative.addCriteria')}
                    </button>
                  </div>

                  {/* EXPLICIT ASSUMPTIONS (NEW) */}
                  <div className="space-y-4">
                    <h3 className="text-navy-900 dark:text-white font-bold flex items-center gap-2 border-b border-slate-200 dark:border-navy-700 pb-2">
                      <AlertOctagon size={18} className="text-primary-600 dark:text-primary-500" />{' '}
                      {t('initiative.explicitAssumptions')}
                      <span className="text-xs text-slate-600 dark:text-slate-500 font-normal ml-2">
                        ({t('common.clickLabelToAutoFill')})
                      </span>
                    </h3>

                    <div className="grid grid-cols-1 gap-4">
                      <div className="bg-slate-50 dark:bg-navy-950 p-3 rounded border border-slate-200 dark:border-navy-700">
                        <label
                          className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-2 cursor-pointer hover:text-primary-500"
                          onClick={() => handleGenerateList('assumptions', 'org')}
                        >
                          {t('initiative.organizational')} <Sparkles size={10} />
                        </label>
                        <input
                          className="w-full bg-transparent text-sm text-navy-900 dark:text-slate-300 focus:outline-none"
                          placeholder={t('initiative.organizationalPlaceholder')}
                          value={initiative.assumptions?.org || ''}
                          onChange={(e) =>
                            setInitiative({
                              ...initiative,
                              assumptions: {
                                ...initiative.assumptions,
                                org: e.target.value,
                              },
                            })
                          }
                        />
                      </div>
                      <div className="bg-slate-50 dark:bg-navy-950 p-3 rounded border border-slate-200 dark:border-navy-700">
                        <label
                          className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-2 cursor-pointer hover:text-primary-500"
                          onClick={() => handleGenerateList('assumptions', 'data')}
                        >
                          {t('initiative.dataTech')} <Sparkles size={10} />
                        </label>
                        <input
                          className="w-full bg-transparent text-sm text-navy-900 dark:text-slate-300 focus:outline-none"
                          placeholder={t('initiative.dataTechPlaceholder')}
                          value={initiative.assumptions?.data || ''}
                          onChange={(e) =>
                            setInitiative({
                              ...initiative,
                              assumptions: {
                                ...initiative.assumptions,
                                data: e.target.value,
                              },
                            })
                          }
                        />
                      </div>
                      <div className="bg-slate-50 dark:bg-navy-950 p-3 rounded border border-slate-200 dark:border-navy-700">
                        <label
                          className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-2 cursor-pointer hover:text-primary-500"
                          onClick={() => handleGenerateList('assumptions', 'budget')}
                        >
                          {t('initiative.budgetResources')} <Sparkles size={10} />
                        </label>
                        <input
                          className="w-full bg-transparent text-sm text-navy-900 dark:text-slate-300 focus:outline-none"
                          placeholder={t('initiative.budgetResourcesPlaceholder')}
                          value={initiative.assumptions?.budget || ''}
                          onChange={(e) =>
                            setInitiative({
                              ...initiative,
                              assumptions: {
                                ...initiative.assumptions,
                                budget: e.target.value,
                              },
                            })
                          }
                        />
                      </div>
                      <div className="bg-slate-50 dark:bg-navy-950 p-3 rounded border border-slate-200 dark:border-navy-700">
                        <label
                          className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-2 cursor-pointer hover:text-primary-500"
                          onClick={() => handleGenerateList('assumptions', 'people')}
                        >
                          {t('initiative.peopleSkills')} <Sparkles size={10} />
                        </label>
                        <input
                          className="w-full bg-transparent text-sm text-navy-900 dark:text-slate-300 focus:outline-none"
                          placeholder={t('initiative.peopleSkillsPlaceholder')}
                          value={initiative.assumptions?.people || ''}
                          onChange={(e) =>
                            setInitiative({
                              ...initiative,
                              assumptions: {
                                ...initiative.assumptions,
                                people: e.target.value,
                              },
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-navy-900 dark:text-white font-bold flex items-center gap-2 border-b border-slate-200 dark:border-navy-700 pb-2">
                    <CheckCircle size={18} className="text-green-500" />{' '}
                    {t('initiative.keyDeliverables')}
                    <button
                      onClick={() => handleGenerateList('deliverables')}
                      disabled={isGenerating}
                      className="ml-auto text-xs flex items-center gap-1 text-primary-500 bg-primary-100 dark:bg-primary-500/10 px-2 py-1 rounded hover:bg-primary-200"
                    >
                      <Sparkles size={12} /> {t('initiative.autoSuggest')}
                    </button>
                  </h3>
                  {initiative.deliverables?.map((item, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        className="flex-1 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded p-2 text-sm text-navy-900 dark:text-white"
                        value={item}
                        onChange={(e) => handleArrayChange('deliverables', idx, e.target.value)}
                        placeholder="Deliverable description..."
                      />
                      <button
                        onClick={() => removeArrayItem('deliverables', idx)}
                        className="text-slate-500 dark:text-slate-400 hover:text-danger-500"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addArrayItem('deliverables')}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 font-medium"
                  >
                    + {t('initiative.addDeliverable')}
                  </button>

                  <div className="mt-8">
                    <h3 className="text-navy-900 dark:text-white font-bold flex items-center gap-2 border-b border-slate-200 dark:border-navy-700 pb-2">
                      <Target size={18} className="text-amber-500" /> {t('initiative.scopeGuard')}
                    </h3>
                    <div className="bg-amber-500/5 p-4 rounded border border-amber-500/10 mt-2">
                      <p className="text-xs text-amber-800 dark:text-amber-200 mb-2">
                        Scope In / Out definition determines the boundary of AI monitoring.
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-xs font-bold text-green-600 dark:text-green-400 uppercase mb-2 flex justify-between">
                            {t('initiative.inScope')}{' '}
                            <button onClick={() => handleGenerateList('scopeIn')}>
                              <Sparkles size={10} />
                            </button>
                          </h4>
                          {initiative.scopeIn?.map((s, idx) => (
                            <div key={idx} className="flex gap-1 mb-1">
                              <input
                                className="w-full bg-white dark:bg-navy-900 text-xs p-1 rounded border border-amber-500/20 dark:border-navy-700 text-navy-900 dark:text-white"
                                value={s}
                                onChange={(e) => handleArrayChange('scopeIn', idx, e.target.value)}
                              />
                              <button onClick={() => removeArrayItem('scopeIn', idx)}>
                                <X size={12} className="text-slate-500 dark:text-slate-400" />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => addArrayItem('scopeIn')}
                            className="text-xs text-green-600 dark:text-green-400"
                          >
                            + {t('common.add')}
                          </button>
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-danger-600 dark:text-danger-400 uppercase mb-2 flex justify-between">
                            {t('initiative.outOfScope')}{' '}
                            <button onClick={() => handleGenerateList('scopeOut')}>
                              <Sparkles size={10} />
                            </button>
                          </h4>
                          {initiative.scopeOut?.map((s, idx) => (
                            <div key={idx} className="flex gap-1 mb-1">
                              <input
                                className="w-full bg-white dark:bg-navy-900 text-xs p-1 rounded border border-amber-500/20 dark:border-navy-700 text-navy-900 dark:text-white"
                                value={s}
                                onChange={(e) => handleArrayChange('scopeOut', idx, e.target.value)}
                              />
                              <button onClick={() => removeArrayItem('scopeOut', idx)}>
                                <X size={12} className="text-slate-500 dark:text-slate-400" />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => addArrayItem('scopeOut')}
                            className="text-xs text-danger-400"
                          >
                            + {t('common.add')}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* EXECUTION & RISKS TAB */}
            {activeTab === 'execution' && (
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="bg-blue-500/5 p-4 rounded border border-blue-500/10 flex items-start gap-3">
                    <Brain size={24} className="text-blue-500 mt-1" />
                    <div>
                      <h4 className="text-sm font-bold text-navy-900 dark:text-white">
                        {t('initiative.autoFill')}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                        {t('initiative.autoFillDescription')}
                      </p>
                      <button
                        onClick={handleAutoFill}
                        disabled={isGenerating}
                        className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20"
                      >
                        <Sparkles size={14} className={isGenerating ? 'animate-spin' : ''} />
                        {isGenerating ? t('common.analyzing') : t('initiative.autoFillExecution')}
                      </button>
                    </div>
                  </div>
                  <h3 className="text-navy-900 dark:text-white font-bold mb-4 flex items-center justify-between">
                    <span>{t('initiative.timelineMilestones')}</span>
                    <button
                      onClick={generateExecutionStrategy}
                      disabled={isGenerating}
                      className={`text-xs flex items-center gap-1 border rounded px-2 py-1 transition-colors ${
                        isGenerating
                          ? 'text-slate-500 dark:text-slate-400 border-slate-700 bg-transparent cursor-not-allowed'
                          : 'text-primary-400 hover:text-primary-300 border-primary-500/30 bg-primary-500/10'
                      }`}
                    >
                      <Sparkles size={12} className={isGenerating ? 'animate-spin' : ''} />
                      {isGenerating ? t('common.generating') : t('initiative.autoFillExecution')}
                    </button>
                  </h3>

                  <InputGroup label={t('initiative.killCriteriaMandatory')}>
                    <div className="bg-danger-50 dark:bg-danger-500/5 border border-danger-200 dark:border-danger-500/20 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2 text-danger-600 dark:text-danger-400 text-xs font-bold uppercase">
                        <AlertTriangle size={12} />
                        <span>{t('initiative.stopConditions')}</span>
                      </div>
                      <textarea
                        className="w-full bg-transparent border-none p-0 text-slate-700 dark:text-slate-300 focus:ring-0 placeholder:text-slate-400 dark:placeholder:text-slate-600 h-24 resize-none text-sm"
                        value={
                          Array.isArray(initiative.killCriteria)
                            ? initiative.killCriteria.join('\n')
                            : initiative.killCriteria || ''
                        }
                        onChange={(e) =>
                          setInitiative({
                            ...initiative,
                            killCriteria: e.target.value.split('\n'),
                          })
                        }
                        placeholder={t('initiative.killCriteriaPlaceholder')}
                      />
                    </div>
                  </InputGroup>

                  <div className="grid grid-cols-2 gap-4">
                    <InputGroup label={t('initiative.startDate')}>
                      <input
                        type="date"
                        className="w-full bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded p-2 text-navy-900 dark:text-white"
                        value={initiative.startDate ? initiative.startDate.split('T')[0] : ''}
                        onChange={(e) =>
                          setInitiative({ ...initiative, startDate: e.target.value })
                        }
                      />
                    </InputGroup>
                    <InputGroup label={t('initiative.endDate')}>
                      <input
                        type="date"
                        className="w-full bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded p-2 text-navy-900 dark:text-white"
                        value={initiative.endDate ? initiative.endDate.split('T')[0] : ''}
                        onChange={(e) => setInitiative({ ...initiative, endDate: e.target.value })}
                      />
                    </InputGroup>
                    <InputGroup label={t('initiative.pilotEnd')}>
                      <input
                        type="date"
                        className="w-full bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded p-2 text-navy-900 dark:text-white"
                        value={initiative.pilotEndDate ? initiative.pilotEndDate.split('T')[0] : ''}
                        onChange={(e) =>
                          setInitiative({ ...initiative, pilotEndDate: e.target.value })
                        }
                      />
                    </InputGroup>
                  </div>

                  {/* Milestones UI */}
                  <div className="bg-slate-50 dark:bg-navy-950 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
                    <h4 className="text-sm font-bold text-navy-900 dark:text-white mb-2 flex justify-between items-center">
                      <span>{t('initiative.milestonesAndGates')}</span>
                      <button
                        onClick={() => {
                          const newMilestones = [
                            ...(initiative.milestones || []),
                            { name: '', date: '', status: 'pending' as const },
                          ];
                          setInitiative({ ...initiative, milestones: newMilestones });
                        }}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:text-navy-900 dark:hover:text-white"
                      >
                        + {t('common.add')}
                      </button>
                    </h4>
                    <div className="space-y-3">
                      {initiative.milestones?.map((m, idx: number) => (
                        <div
                          key={idx}
                          className={`p-3 rounded border transition-colors ${m.isDecisionGate ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-500/30' : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700'} `}
                        >
                          <div className="flex gap-2 mb-2">
                            <input
                              type="date"
                              className="w-24 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded p-1 text-xs text-navy-900 dark:text-white"
                              value={m.date}
                              onChange={(e) => {
                                const list = [...(initiative.milestones || [])];
                                list[idx] = { ...m, date: e.target.value };
                                setInitiative({ ...initiative, milestones: list });
                              }}
                            />
                            <input
                              className="flex-1 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded p-1 text-xs text-navy-900 dark:text-white"
                              placeholder={t('initiative.milestoneNamePlaceholder')}
                              value={m.name}
                              onChange={(e) => {
                                const list = [...(initiative.milestones || [])];
                                list[idx] = { ...m, name: e.target.value };
                                setInitiative({ ...initiative, milestones: list });
                              }}
                            />
                            <button
                              onClick={() => {
                                const list = [...(initiative.milestones || [])];
                                list.splice(idx, 1);
                                setInitiative({ ...initiative, milestones: list });
                              }}
                              className="text-slate-500 dark:text-slate-400 hover:text-danger-500"
                            >
                              <X size={14} />
                            </button>
                          </div>

                          <div className="flex items-center gap-4 pl-1">
                            <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-300 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={m.isDecisionGate || false}
                                onChange={(e) => {
                                  const list = [...(initiative.milestones || [])];
                                  list[idx] = {
                                    ...m,
                                    isDecisionGate: e.target.checked,
                                  };
                                  setInitiative({ ...initiative, milestones: list });
                                }}
                                className="rounded bg-white dark:bg-navy-950 border-slate-300 dark:border-white/20 text-blue-600 dark:text-blue-500 focus:ring-offset-white dark:focus:ring-offset-navy-900"
                              />
                              {t('initiative.decisionGate')}
                            </label>

                            {m.isDecisionGate && (
                              <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                  {t('initiative.decision')}:
                                </span>
                                <select
                                  className={`text-xs border rounded px-2 py-0.5 outline-none ${
                                    m.decision === 'stop'
                                      ? 'bg-danger-500/20 text-danger-400 border-danger-500/30'
                                      : m.decision === 'adjust'
                                        ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                                        : 'bg-green-500/20 text-green-400 border-green-500/30'
                                  } `}
                                  value={m.decision || 'continue'}
                                  onChange={(e) => {
                                    const list = [...(initiative.milestones || [])];
                                    // @ts-expect-error - decision type is dynamic
                                    list[idx] = { ...m, decision: e.target.value };
                                    setInitiative({
                                      ...initiative,
                                      milestones: list,
                                    });
                                  }}
                                >
                                  <option value="continue">{t('initiative.continue')}</option>
                                  <option value="adjust">{t('initiative.adjust')}</option>
                                  <option value="stop">{t('initiative.stop')}</option>
                                </select>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-navy-950 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
                    <h4 className="text-sm font-bold text-navy-900 dark:text-white mb-2">
                      {t('initiative.requiredCompetencies')}
                    </h4>
                    <input
                      className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded p-2 text-sm text-slate-600 dark:text-slate-300"
                      placeholder={t('initiative.competenciesPlaceholder')}
                      value={initiative.competenciesRequired?.join(', ') || ''}
                      onChange={(e) =>
                        setInitiative({
                          ...initiative,
                          competenciesRequired: e.target.value.split(',').map((s) => s.trim()),
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-navy-900 dark:text-white font-bold mb-4 flex items-center gap-2">
                    <AlertTriangle size={18} className="text-amber-500" />{' '}
                    {t('initiative.keyRisks')}
                  </h3>
                  {/* Simplified Risk Input for now (future: array of objects) */}
                  <div className="bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/10 rounded-xl p-4">
                    <p className="text-sm text-amber-800 dark:text-amber-200 mb-2">
                      {t('initiative.keyRisksDescription')}
                    </p>
                    {/* We are storing risks as simple array in JSON for this iteration, or strictly adhering to types updated */}
                    {/* Currently logic stores keyRisks as JSON array. Let's make it simple strings for now or update UI for complex objects later. */}
                    {/* To match updated types { risk: string; mitigation: string; metric: 'Low' | 'Medium' | 'High' }[] */}
                    {initiative.keyRisks?.map((risk, idx: number) => (
                      <div
                        key={idx}
                        className="mb-4 bg-white dark:bg-navy-900 p-3 rounded border border-slate-200 dark:border-navy-700"
                      >
                        <input
                          className="w-full bg-transparent border-b border-slate-200 dark:border-navy-700 mb-2 text-sm text-navy-900 dark:text-white focus:outline-none"
                          placeholder={t('initiative.riskDescriptionPlaceholder')}
                          value={risk.risk || ''}
                          onChange={(e) => {
                            const newRisks = [...(initiative.keyRisks || [])];
                            newRisks[idx] = { ...risk, risk: e.target.value };
                            setInitiative({ ...initiative, keyRisks: newRisks });
                          }}
                        />
                        <input
                          className="w-full bg-transparent text-xs text-slate-600 dark:text-slate-500 focus:outline-none"
                          placeholder={t('initiative.mitigationStrategyPlaceholder')}
                          value={risk.mitigation || ''}
                          onChange={(e) => {
                            const newRisks = [...(initiative.keyRisks || [])];
                            newRisks[idx] = { ...risk, mitigation: e.target.value };
                            setInitiative({ ...initiative, keyRisks: newRisks });
                          }}
                        />
                        <button
                          onClick={() => {
                            const newRisks = [...(initiative.keyRisks || [])];
                            newRisks.splice(idx, 1);
                            setInitiative({ ...initiative, keyRisks: newRisks });
                          }}
                          className="text-xs text-danger-500 mt-2"
                        >
                          {t('common.remove')}
                        </button>
                      </div>
                    ))}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={(initiative.keyRisks?.length || 0) >= 5}
                      onClick={() => {
                        const newRisks = [...(initiative.keyRisks || [])];
                        if (newRisks.length >= 5) return;
                        newRisks.push({ risk: '', mitigation: '', metric: 'Medium' });
                        setInitiative({ ...initiative, keyRisks: newRisks });
                      }}
                    >
                      {(initiative.keyRisks?.length || 0) >= 5
                        ? t('initiative.maxRisksReached')
                        : t('initiative.addRisk')}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* ECONOMICS TAB */}
            {activeTab === 'economics' && (
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-6">
                  <InputGroup label={t('initiative.businessValue')}>
                    <Select
                      value={initiative.businessValue || ''}
                      onChange={(val) =>
                        setInitiative({
                          ...initiative,
                          businessValue: val as 'High' | 'Medium' | 'Low',
                        })
                      }
                      options={[
                        { value: 'High', label: t('common.high') },
                        { value: 'Medium', label: t('common.medium') },
                        { value: 'Low', label: t('common.low') },
                      ]}
                    />
                  </InputGroup>

                  <div className="grid grid-cols-2 gap-4">
                    <InputGroup label={t('initiative.valueDriver')}>
                      <Select
                        value={initiative.valueDriver || ''}
                        onChange={(val) =>
                          setInitiative({ ...initiative, valueDriver: val as any })
                        }
                        placeholder={t('initiative.selectDriverPlaceholder')}
                        options={[
                          { value: 'Cost', label: t('initiative.costOptimization') },
                          { value: 'Revenue', label: t('initiative.revenueGrowth') },
                          { value: 'Capital', label: t('initiative.capitalEfficiency') },
                          { value: 'Risk', label: t('initiative.riskReduction') },
                          { value: 'Capability', label: t('initiative.strategicCapability') },
                        ]}
                      />
                    </InputGroup>
                    <InputGroup label={t('initiative.confidenceLevel')}>
                      <Select
                        value={initiative.confidenceLevel || ''}
                        onChange={(val) =>
                          setInitiative({ ...initiative, confidenceLevel: val as any })
                        }
                        placeholder={t('initiative.confidencePlaceholder')}
                        options={[
                          { value: 'High', label: t('common.high') },
                          { value: 'Medium', label: t('common.medium') },
                          { value: 'Low', label: t('common.low') },
                        ]}
                      />
                    </InputGroup>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <InputGroup label={t('initiative.capexEst')}>
                      <input
                        type="number"
                        className="w-full bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg p-3 text-navy-900 dark:text-white focus:border-blue-500 outline-none"
                        value={initiative.costCapex || 0}
                        onChange={(e) =>
                          setInitiative({
                            ...initiative,
                            costCapex: parseInt(e.target.value),
                          })
                        }
                      />
                    </InputGroup>
                    <InputGroup label={t('initiative.opexEst')}>
                      <input
                        type="number"
                        className="w-full bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg p-3 text-navy-900 dark:text-white focus:border-blue-500 outline-none"
                        value={initiative.costOpex || 0}
                        onChange={(e) =>
                          setInitiative({ ...initiative, costOpex: parseInt(e.target.value) })
                        }
                      />
                    </InputGroup>
                  </div>

                  <InputGroup label={t('initiative.valueTiming')}>
                    <Select
                      value={initiative.valueTiming || ''}
                      onChange={(val) => setInitiative({ ...initiative, valueTiming: val as any })}
                      placeholder={t('initiative.expectedRealizationPlaceholder')}
                      options={[
                        { value: 'Immediate', label: t('initiative.valueTimingImmediate') },
                        { value: 'Short term', label: t('initiative.valueTimingShortTerm') },
                        { value: 'Long term', label: t('initiative.valueTimingLongTerm') },
                      ]}
                    />
                  </InputGroup>
                </div>

                <div className="bg-slate-50 dark:bg-navy-950 rounded-xl p-6 border border-slate-200 dark:border-navy-700 flex flex-col items-center justify-center text-center relative">
                  <TrendingUp
                    size={48}
                    className={`mb-4 opacity-50 ${initiative.valueDriver === 'Capability' ? 'text-primary-500' : 'text-green-500'} `}
                  />
                  <h3 className="text-xl font-bold text-navy-900 dark:text-white mb-2">
                    {t('initiative.financialSummary')}
                  </h3>

                  <div className="mb-4">
                    {initiative.valueDriver === 'Capability' ? (
                      <span className="px-3 py-1 rounded-full bg-primary-500/20 text-primary-400 text-xs font-bold border border-primary-500/30">
                        {t('initiative.capabilityPlay')}
                      </span>
                    ) : initiative.valueDriver ? (
                      <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-bold border border-green-500/30">
                        {t('initiative.cashPlay')}
                      </span>
                    ) : null}
                  </div>

                  <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                    {t('initiative.totalInvestment')}:{' '}
                    <span className="text-navy-900 dark:text-white font-mono">
                      ${((initiative.costCapex || 0) + (initiative.costOpex || 0)).toLocaleString()}
                    </span>
                  </p>

                  {/* Sanity Check Logic Display */}
                  {initiative.costCapex && initiative.costCapex > 0 && !initiative.valueDriver && (
                    <div className="flex items-center gap-2 text-amber-400 text-xs bg-amber-500/10 p-2 rounded w-full justify-center mb-4">
                      <AlertTriangle size={12} />
                      <span>{t('initiative.missingValueDriverWarning')}</span>
                    </div>
                  )}

                  <div className="w-full bg-white dark:bg-navy-900 rounded-lg p-4 border border-slate-200 dark:border-navy-700 text-left">
                    <span className="text-xs uppercase text-slate-500 dark:text-slate-400">
                      {t('initiative.socialImpact')}
                    </span>
                    <p className="text-navy-900 dark:text-white mt-1 text-sm">
                      {initiative.socialImpact || t('common.notDefined')}
                    </p>
                  </div>
                </div>

                {/* Detailed Financial Analysis Integration */}
                <div className="col-span-2 mt-4">
                  <InitiativeFinancialIntegration
                    initiative={{
                      id: initiative.id,
                      name: initiative.name,
                      costCapex: initiative.costCapex,
                      costOpex: initiative.costOpex,
                      annualBenefit: initiative.annualBenefit,
                      expectedRoi: initiative.expectedRoi,
                      valueDriver: initiative.valueDriver,
                    }}
                    onNavigateToAnalysis={(analysisId) => {
                      // Navigate to economics module with the analysis
                      window.location.href = `/economics?analysis=${analysisId}`;
                    }}
                  />
                </div>
              </div>
            )}

            {/* GOVERNANCE TAB */}
            {activeTab === 'governance' && (
              <div className="space-y-8 pb-10">
                {/* Roles & Ownership */}
                <div className="bg-slate-50 dark:bg-navy-950 rounded-xl p-6 border border-slate-200 dark:border-navy-700">
                  <h3 className="text-lg font-bold text-navy-900 dark:text-white mb-6 flex items-center gap-2">
                    <Users size={20} className="text-blue-500" /> {t('initiative.rolesOwnership')}
                  </h3>
                  <div className="grid grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-2">
                        <UserCheck size={12} /> {t('initiative.businessOwner')}
                      </label>
                      <p className="text-[10px] text-slate-600 dark:text-slate-500 mb-2">
                        {t('initiative.businessOwnerDescription')}
                      </p>
                      <Select
                        value={initiative.ownerBusinessId || ''}
                        onChange={(val) => setInitiative({ ...initiative, ownerBusinessId: val })}
                        placeholder={t('initiative.selectBusinessOwnerPlaceholder')}
                        options={users.map((u) => ({
                          value: u.id,
                          label: `${u.firstName} ${u.lastName}`,
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-2">
                        <UserCheck size={12} /> {t('initiative.executionOwner')}
                      </label>
                      <p className="text-[10px] text-slate-600 dark:text-slate-500 mb-2">
                        {t('initiative.executionOwnerDescription')}
                      </p>
                      <Select
                        value={initiative.ownerExecutionId || ''}
                        onChange={(val) => setInitiative({ ...initiative, ownerExecutionId: val })}
                        placeholder={t('initiative.selectExecutionOwnerPlaceholder')}
                        options={users.map((u) => ({
                          value: u.id,
                          label: `${u.firstName} ${u.lastName}`,
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-2">
                        <Shield size={12} /> {t('initiative.sponsor')}
                      </label>
                      <p className="text-[10px] text-slate-600 dark:text-slate-500 mb-2">
                        {t('initiative.sponsorDescription')}
                      </p>
                      <Select
                        value={initiative.sponsorId || ''}
                        onChange={(val) => setInitiative({ ...initiative, sponsorId: val })}
                        placeholder={t('initiative.selectSponsorPlaceholder')}
                        options={users.map((u) => ({
                          value: u.id,
                          label: `${u.firstName} ${u.lastName}`,
                        }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Approval Workflow Status */}
                <div className="bg-slate-50 dark:bg-navy-950 rounded-xl p-6 border border-slate-200 dark:border-navy-700">
                  <h3 className="text-lg font-bold text-navy-900 dark:text-white mb-6 flex items-center gap-2">
                    <Clock size={20} className="text-primary-500" />{' '}
                    {t('initiative.approvalWorkflow')}
                  </h3>

                  {/* Status Timeline */}
                  <div className="flex items-center justify-between mb-8">
                    {[
                      { status: 'DRAFT', label: t('status.DRAFT'), done: true },
                      {
                        status: 'PLANNING',
                        label: t('status.PLANNING'),
                        done: initiative.status !== 'DRAFT',
                      },
                      {
                        status: 'REVIEW',
                        label: t('status.REVIEW'),
                        done: ['REVIEW', 'APPROVED', 'EXECUTING', 'DONE'].includes(
                          initiative.status
                        ),
                      },
                      {
                        status: 'APPROVED',
                        label: t('status.APPROVED'),
                        done: ['APPROVED', 'EXECUTING', 'DONE'].includes(initiative.status),
                      },
                      {
                        status: 'EXECUTING',
                        label: t('status.EXECUTING'),
                        done: ['EXECUTING', 'DONE'].includes(initiative.status),
                      },
                    ].map((step, idx, arr) => (
                      <React.Fragment key={step.status}>
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                              initiative.status === step.status
                                ? 'bg-blue-500 border-blue-500 text-white'
                                : step.done
                                  ? 'bg-green-500/20 border-green-500 text-green-400'
                                  : 'bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-500'
                            }`}
                          >
                            {step.done && initiative.status !== step.status ? '✓' : idx + 1}
                          </div>
                          <span
                            className={`text-xs mt-2 font-medium ${
                              initiative.status === step.status
                                ? 'text-blue-400'
                                : step.done
                                  ? 'text-green-400'
                                  : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {step.label}
                          </span>
                        </div>
                        {idx < arr.length - 1 && (
                          <div
                            className={`flex-1 h-1 mx-2 rounded ${step.done ? 'bg-green-500/50' : 'bg-slate-300 dark:bg-slate-700'}`}
                          />
                        )}
                      </React.Fragment>
                    ))}
                  </div>

                  {/* Current Status Info */}
                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-navy-900 p-4 rounded-lg border border-slate-200 dark:border-navy-700">
                      <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-3">
                        {t('initiative.currentStatus')}
                      </h4>
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-3 h-3 rounded-full ${
                            initiative.status === 'BLOCKED'
                              ? 'bg-danger-500'
                              : initiative.status === 'DONE'
                                ? 'bg-green-500'
                                : initiative.status === 'EXECUTING'
                                  ? 'bg-blue-500 animate-pulse'
                                  : 'bg-amber-500'
                          }`}
                        />
                        <span className="text-lg font-bold text-navy-900 dark:text-white">
                          {initiative.status.replace('_', ' ')}
                        </span>
                      </div>
                      {initiative.status === 'BLOCKED' && (
                        <p className="text-xs text-danger-400 mt-2">
                          {t('common.reason')}:{' '}
                          {(initiative as any).blockedReason || t('common.notSpecified')}
                        </p>
                      )}
                    </div>

                    <div className="bg-white dark:bg-navy-900 p-4 rounded-lg border border-slate-200 dark:border-navy-700">
                      <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-3">
                        {t('initiative.nextAction')}
                      </h4>
                      {initiative.status === 'DRAFT' && (
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          {t('initiative.nextActionDraft')}{' '}
                          <span className="text-amber-400 font-medium">{t('status.PLANNING')}</span>
                        </p>
                      )}
                      {initiative.status === 'PLANNING' && (
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          {t('initiative.nextActionPlanning')}{' '}
                          <span className="text-primary-400 font-medium">{t('status.REVIEW')}</span>
                        </p>
                      )}
                      {initiative.status === 'REVIEW' && (
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          {t('initiative.nextActionReview')}{' '}
                          <span className="text-blue-400 font-medium">
                            {t('initiative.sponsorApproval')}
                          </span>
                        </p>
                      )}
                      {initiative.status === 'APPROVED' && (
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          {t('initiative.nextActionApproved')}{' '}
                          <span className="text-blue-400 font-medium">{t('status.EXECUTING')}</span>
                        </p>
                      )}
                      {initiative.status === 'EXECUTING' && (
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          {t('initiative.nextActionExecuting')}{' '}
                          <span className="text-green-400 font-medium">{t('status.DONE')}</span>
                        </p>
                      )}
                      {initiative.status === 'DONE' && (
                        <p className="text-sm text-green-400 font-medium">
                          ✓ {t('initiative.completedSuccessfully')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Decision Required (if pending) */}
                {initiative.decisionToMake && (
                  <div className="bg-gradient-to-r from-blue-500/10 to-primary-500/10 rounded-xl p-6 border border-blue-500/20">
                    <h3 className="text-lg font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
                      <AlertOctagon size={20} className="text-blue-400" />{' '}
                      {t('initiative.decisionRequired')}
                    </h3>
                    <div className="bg-white dark:bg-navy-900 p-4 rounded-lg border border-blue-500/20 mb-4">
                      <p className="text-lg text-navy-900 dark:text-white font-medium">
                        {initiative.decisionToMake}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-600 dark:text-slate-500">
                          {t('initiative.decisionOwner')}:
                        </span>
                        <span className="text-sm text-white font-medium">
                          {users.find((u) => u.id === initiative.decisionOwnerId)?.firstName ||
                            t('common.notAssigned')}{' '}
                          {users.find((u) => u.id === initiative.decisionOwnerId)?.lastName || ''}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            /* TODO: View decision brief */
                          }}
                        >
                          {t('initiative.viewBrief')}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Audit Trail */}
                <div className="bg-slate-50 dark:bg-navy-950 rounded-xl p-6 border border-slate-200 dark:border-navy-700">
                  <h3 className="text-lg font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
                    <FileText size={20} className="text-slate-600 dark:text-slate-500" />{' '}
                    {t('initiative.governanceAuditTrail')}
                  </h3>
                  <div className="space-y-3 max-h-48 overflow-y-auto">
                    {initiative.changeLog && initiative.changeLog.length > 0 ? (
                      initiative.changeLog
                        .slice(-5)
                        .reverse()
                        .map((log, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-3 p-3 bg-white dark:bg-navy-900 rounded border border-slate-200 dark:border-navy-700"
                          >
                            <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
                            <div className="flex-1">
                              <p className="text-sm text-navy-900 dark:text-white">{log.change}</p>
                              <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
                                <span>{log.user}</span>
                                <span>•</span>
                                <span>{new Date(log.date).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>
                        ))
                    ) : (
                      <p className="text-sm text-slate-500 dark:text-slate-400 italic">
                        {t('initiative.noGovernanceEvents')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TEAM TAB - Resource Allocation */}
            {activeTab === 'team' && (
              <div className="space-y-8 pb-10">
                {/* Team Members Grid */}
                <div className="bg-slate-50 dark:bg-navy-950 rounded-xl p-6 border border-slate-200 dark:border-navy-700">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-navy-900 dark:text-white flex items-center gap-2">
                      <Users size={20} className="text-blue-500" /> {t('initiative.teamMembers')}
                    </h3>
                    <button
                      onClick={() => {
                        const newMember: InitiativeTeamMember = {
                          id: Date.now().toString(),
                          initiativeId: initiative.id,
                          userId: '',
                          role: 'CONTRIBUTOR',
                          allocation: 50,
                          assignedAt: new Date().toISOString(),
                          assignedBy: 'current-user',
                        };
                        setInitiative({
                          ...initiative,
                          teamMembers: [...(initiative.teamMembers || []), newMember],
                        });
                      }}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <UserPlus size={14} /> {t('initiative.addMember')}
                    </button>
                  </div>

                  {/* Team Members List */}
                  <div className="space-y-3">
                    {(initiative.teamMembers || []).length === 0 ? (
                      <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                        <Users size={40} className="mx-auto mb-2 opacity-30" />
                        <p>{t('initiative.noTeamMembersAssigned')}</p>
                      </div>
                    ) : (
                      (initiative.teamMembers || []).map((member, idx) => (
                        <div
                          key={member.id}
                          className="bg-white dark:bg-navy-900 p-4 rounded-lg border border-slate-200 dark:border-navy-700 flex items-center gap-4"
                        >
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-primary-500 flex items-center justify-center text-white font-bold">
                            {member.user?.firstName?.[0] || '?'}
                          </div>
                          <div className="flex-1">
                            <select
                              value={member.userId}
                              onChange={(e) => {
                                const updated = [...(initiative.teamMembers || [])];
                                const user = users.find((u) => u.id === e.target.value);
                                updated[idx] = {
                                  ...updated[idx],
                                  userId: e.target.value,
                                  user,
                                };
                                setInitiative({ ...initiative, teamMembers: updated });
                              }}
                              className="bg-transparent text-sm font-medium text-navy-900 dark:text-white outline-none border-b border-dashed border-slate-300 dark:border-slate-600 w-48"
                            >
                              <option value="">{t('initiative.selectMember')}</option>
                              {users.map((u) => (
                                <option
                                  key={u.id}
                                  value={u.id}
                                  className="bg-white dark:bg-navy-900"
                                >
                                  {u.firstName} {u.lastName}
                                </option>
                              ))}
                            </select>
                          </div>
                          <select
                            value={member.role}
                            onChange={(e) => {
                              const updated = [...(initiative.teamMembers || [])];
                              updated[idx] = {
                                ...updated[idx],
                                role: e.target.value as any,
                              };
                              setInitiative({ ...initiative, teamMembers: updated });
                            }}
                            className="text-xs bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded border border-slate-200 dark:border-navy-700"
                          >
                            <option value="CONTRIBUTOR">{t('role.CONTRIBUTOR')}</option>
                            <option value="REVIEWER">{t('role.REVIEWER')}</option>
                            <option value="SME">{t('role.SME')}</option>
                            <option value="STAKEHOLDER">{t('role.STAKEHOLDER')}</option>
                            <option value="OBSERVER">{t('role.OBSERVER')}</option>
                          </select>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {t('initiative.allocation')}:
                            </span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={member.allocation || 0}
                              onChange={(e) => {
                                const updated = [...(initiative.teamMembers || [])];
                                updated[idx] = {
                                  ...updated[idx],
                                  allocation: parseInt(e.target.value) || 0,
                                };
                                setInitiative({ ...initiative, teamMembers: updated });
                              }}
                              className="w-14 text-center text-sm bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded px-2 py-1"
                            />
                            <span className="text-xs text-slate-500 dark:text-slate-400">%</span>
                          </div>
                          <button
                            onClick={() => {
                              const updated = (initiative.teamMembers || []).filter(
                                (_, i) => i !== idx
                              );
                              setInitiative({ ...initiative, teamMembers: updated });
                            }}
                            className="p-1.5 text-slate-600 dark:text-slate-500 hover:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/10 rounded transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Related Initiatives */}
                <div className="bg-slate-50 dark:bg-navy-950 rounded-xl p-6 border border-slate-200 dark:border-navy-700">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-navy-900 dark:text-white flex items-center gap-2">
                      <Link2 size={20} className="text-primary-500" />{' '}
                      {t('initiative.relatedInitiatives')}
                    </h3>
                    <button
                      onClick={() => {
                        const newRelation: RelatedInitiative = {
                          id: Date.now().toString(),
                          initiativeId: initiative.id,
                          relatedInitiativeId: '',
                          relationType: 'RELATED_TO',
                          createdAt: new Date().toISOString(),
                          createdBy: 'current-user',
                        };
                        setInitiative({
                          ...initiative,
                          relatedInitiatives: [
                            ...(initiative.relatedInitiatives || []),
                            newRelation,
                          ],
                        });
                      }}
                      className="px-3 py-1.5 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] text-sm font-medium rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <Link2 size={14} /> {t('initiative.linkInitiative')}
                    </button>
                  </div>

                  <div className="space-y-3">
                    {(initiative.relatedInitiatives || []).length === 0 ? (
                      <div className="text-center py-6 text-slate-500 dark:text-slate-400 border-2 border-dashed border-slate-200 dark:border-navy-700 rounded-lg">
                        <GitBranch size={32} className="mx-auto mb-2 opacity-30" />
                        <p className="text-sm">{t('initiative.noLinkedInitiatives')}</p>
                      </div>
                    ) : (
                      (initiative.relatedInitiatives || []).map((rel, idx) => (
                        <div
                          key={rel.id}
                          className="bg-white dark:bg-navy-900 p-3 rounded-lg border border-slate-200 dark:border-navy-700 flex items-center gap-3"
                        >
                          <select
                            value={rel.relationType}
                            onChange={(e) => {
                              const updated = [...(initiative.relatedInitiatives || [])];
                              updated[idx] = {
                                ...updated[idx],
                                relationType: e.target.value as any,
                              };
                              setInitiative({
                                ...initiative,
                                relatedInitiatives: updated,
                              });
                            }}
                            className="text-xs bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 px-2 py-1 rounded border border-primary-200 dark:border-primary-500/20"
                          >
                            <option value="DEPENDS_ON">{t('relation.DEPENDS_ON')}</option>
                            <option value="BLOCKS">{t('relation.BLOCKS')}</option>
                            <option value="RELATED_TO">{t('relation.RELATED_TO')}</option>
                            <option value="PARENT_OF">{t('relation.PARENT_OF')}</option>
                            <option value="CHILD_OF">{t('relation.CHILD_OF')}</option>
                          </select>
                          <input
                            type="text"
                            value={rel.relatedInitiativeId}
                            onChange={(e) => {
                              const updated = [...(initiative.relatedInitiatives || [])];
                              updated[idx] = {
                                ...updated[idx],
                                relatedInitiativeId: e.target.value,
                              };
                              setInitiative({
                                ...initiative,
                                relatedInitiatives: updated,
                              });
                            }}
                            placeholder={t('initiative.initiativeIdOrNamePlaceholder')}
                            className="flex-1 bg-transparent text-sm text-navy-900 dark:text-white outline-none border-b border-dashed border-slate-300 dark:border-slate-600"
                          />
                          <button
                            onClick={() => {
                              const updated = (initiative.relatedInitiatives || []).filter(
                                (_, i) => i !== idx
                              );
                              setInitiative({
                                ...initiative,
                                relatedInitiatives: updated,
                              });
                            }}
                            className="p-1.5 text-slate-600 dark:text-slate-500 hover:text-danger-500 rounded"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* COMMENTS TAB - Discussion Thread */}
            {activeTab === 'comments' && (
              <div className="space-y-6 pb-10">
                {/* New Comment Input */}
                <div className="bg-white dark:bg-navy-950 rounded-xl p-4 border border-slate-200 dark:border-navy-700 shadow-sm">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-400 flex items-center justify-center text-white font-bold shrink-0">
                      {t('common.you')}
                    </div>
                    <div className="flex-1">
                      <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder={t('initiative.addCommentPlaceholder')}
                        className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg p-3 text-sm text-navy-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-blue-500/50 resize-none h-20"
                      />
                      <div className="flex justify-end mt-2">
                        <button
                          onClick={() => {
                            if (!newComment.trim()) return;
                            const comment: InitiativeComment = {
                              id: Date.now().toString(),
                              initiativeId: initiative.id,
                              userId: 'current-user',
                              content: newComment,
                              createdAt: new Date().toISOString(),
                              user: {
                                id: 'current-user',
                                firstName: 'You',
                                lastName: '',
                                avatarUrl: '',
                              },
                            };
                            setInitiative({
                              ...initiative,
                              comments: [comment, ...(initiative.comments || [])],
                            });
                            setNewComment('');
                          }}
                          disabled={!newComment.trim()}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors"
                        >
                          <Send size={14} /> {t('initiative.postComment')}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Comments List */}
                <div className="space-y-4">
                  {(initiative.comments || []).length === 0 ? (
                    <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                      <MessageSquare size={48} className="mx-auto mb-3 opacity-20" />
                      <p className="text-lg font-medium">{t('initiative.noCommentsYet')}</p>
                      <p className="text-sm">{t('initiative.startDiscussion')}</p>
                    </div>
                  ) : (
                    (initiative.comments || []).map((comment) => (
                      <div
                        key={comment.id}
                        className="bg-white dark:bg-navy-950 rounded-xl p-4 border border-slate-200 dark:border-navy-700"
                      >
                        <div className="flex gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-white font-bold shrink-0">
                            {comment.user?.firstName?.[0] || '?'}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-navy-900 dark:text-white">
                                {comment.user?.firstName} {comment.user?.lastName}
                              </span>
                              <span className="text-xs text-slate-600 dark:text-slate-500">
                                {new Date(comment.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                              {comment.content}
                            </p>
                            <div className="flex gap-4 mt-2">
                              <button className="text-xs text-slate-600 dark:text-slate-500 hover:text-blue-500">
                                {t('common.reply')}
                              </button>
                              <button className="text-xs text-slate-600 dark:text-slate-500 hover:text-blue-500">
                                {t('common.react')}
                              </button>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              const updated = (initiative.comments || []).filter(
                                (c) => c.id !== comment.id
                              );
                              setInitiative({ ...initiative, comments: updated });
                            }}
                            className="p-1 text-slate-600 dark:text-slate-500 hover:text-danger-500"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* HISTORY TAB - Version History */}
            {activeTab === 'history' && (
              <div className="space-y-6 pb-10">
                {/* Export & Clone Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      // Mock PDF export
                      const data = JSON.stringify(initiative, null, 2);
                      const blob = new Blob([data], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `initiative-${initiative.id}-charter.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <Download size={16} /> {t('initiative.exportCharter')}
                  </button>
                  <button
                    onClick={() => {
                      // Create a clone of the initiative
                      const clone = {
                        ...initiative,
                        id: '',
                        name: `${initiative.name} (Copy)`,
                        status: 'DRAFT' as const,
                        createdAt: new Date().toISOString(),
                        comments: [],
                        versions: [],
                        teamMembers: [],
                      };
                      // In real implementation, this would call onSave with isClone flag
                      alert(
                        `Clone created: "${clone.name}"\n\nIn production, this would save as a new initiative.`
                      );
                    }}
                    className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] text-sm font-medium rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <Copy size={16} /> {t('initiative.cloneAsTemplate')}
                  </button>
                </div>

                {/* Version History */}
                <div className="bg-slate-50 dark:bg-navy-950 rounded-xl p-6 border border-slate-200 dark:border-navy-700">
                  <h3 className="text-lg font-bold text-navy-900 dark:text-white mb-6 flex items-center gap-2">
                    <History size={20} className="text-amber-500" />{' '}
                    {t('initiative.versionHistory')}
                  </h3>

                  <div className="space-y-0">
                    {/* Current Version Indicator */}
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-4 h-4 rounded-full bg-green-500 border-4 border-green-200 dark:border-green-500/30" />
                        <div className="w-0.5 h-full bg-slate-200 dark:bg-slate-700" />
                      </div>
                      <div className="pb-6">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-navy-900 dark:text-white">
                            {t('initiative.currentVersion')}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 rounded-full">
                            {t('initiative.live')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {t('common.statusLabel')} {t(`status.${initiative.status}`)} • Last
                          updated:{' '}
                          {initiative.updatedAt
                            ? new Date(initiative.updatedAt).toLocaleString()
                            : 'Now'}
                        </p>
                      </div>
                    </div>

                    {/* Past Versions */}
                    {(initiative.versions || []).length === 0 ? (
                      <div className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-600" />
                        </div>
                        <div className="pb-4">
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {t('initiative.initialCreation')}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-500">
                            {initiative.createdAt
                              ? new Date(initiative.createdAt).toLocaleString()
                              : 'Unknown'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      (initiative.versions || []).map((version, idx) => (
                        <div key={version.id} className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div
                              className={`w-3 h-3 rounded-full ${
                                version.changeType === 'APPROVAL'
                                  ? 'bg-blue-500'
                                  : version.changeType === 'STATUS_CHANGE'
                                    ? 'bg-blue-500'
                                    : 'bg-slate-400'
                              }`}
                            />
                            {idx < (initiative.versions || []).length - 1 && (
                              <div className="w-0.5 h-full bg-slate-200 dark:bg-slate-700" />
                            )}
                          </div>
                          <div className="pb-4">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-navy-900 dark:text-white">
                                v{version.version}
                              </span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  version.changeType === 'APPROVAL'
                                    ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400'
                                    : version.changeType === 'STATUS_CHANGE'
                                      ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400'
                                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                                }`}
                              >
                                {version.changeType.replace('_', ' ')}
                              </span>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                              {version.changeSummary}
                            </p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-slate-600 dark:text-slate-500">
                              <span>
                                {version.createdByUser?.firstName} {version.createdByUser?.lastName}
                              </span>
                              <span>•</span>
                              <span>{new Date(version.createdAt).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Save Version Button */}
                  <button
                    onClick={() => {
                      const newVersion: InitiativeVersion = {
                        id: Date.now().toString(),
                        initiativeId: initiative.id,
                        version: (initiative.versions || []).length + 1,
                        snapshot: initiative,
                        changeType: 'MANUAL_SAVE',
                        changeSummary: 'Manual snapshot saved',
                        createdAt: new Date().toISOString(),
                        createdBy: 'current-user',
                        createdByUser: { id: 'current-user', firstName: 'You', lastName: '' },
                      };
                      setInitiative({
                        ...initiative,
                        versions: [newVersion, ...(initiative.versions || [])],
                      });
                    }}
                    className="mt-4 w-full py-2 border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-blue-500 hover:text-blue-500 text-sm font-medium rounded-lg transition-colors"
                  >
                    + Save Version Snapshot
                  </button>
                </div>
              </div>
            )}

            {/* INTELLIGENCE TAB */}
            {activeTab === 'intelligence' && (
              <InitiativeIntelligenceTab
                initiative={initiative}
                onChange={(updates) => setInitiative({ ...initiative, ...updates })}
              />
            )}
          </div>

          {/* Footer */}
          <div className="h-20 border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 px-6 flex items-center justify-between shrink-0">
            <button
              onClick={onClose}
              className="text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white text-sm font-medium"
            >
              Cancel
            </button>
            <Button onClick={handleSave} icon={<Save size={18} />}>
              Save Initiative Charter
            </Button>
          </div>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison function for React.memo
    // Only re-render if initiative data or isOpen changes
    return (
      prevProps.isOpen === nextProps.isOpen &&
      prevProps.initiative.id === nextProps.initiative.id &&
      JSON.stringify(prevProps.initiative) === JSON.stringify(nextProps.initiative) &&
      (prevProps.users?.length || 0) === (nextProps.users?.length || 0)
    );
  }
);

// Helper for Input fields
const InputGroup = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="mb-4">
    <label className="block text-xs uppercase text-slate-500 dark:text-slate-400 font-bold mb-1">
      {label}
    </label>
    {children}
  </div>
);
