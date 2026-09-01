import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Check,
  Cpu,
  Edit2,
  GripVertical,
  Lock,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useContextBuilderStore } from '../../../store/useContextBuilderStore';
import { AITextArea } from '../shared/AITextArea';
import { ContextDocUploader } from '../shared/ContextDocUploader';
import { DynamicList, DynamicListItem } from '../shared/DynamicList';
export type ChallengeTab = 'challenges' | 'rootcause' | 'blockers' | 'evidence';
export const ChallengeMapModule: React.FC<{ screen?: ChallengeTab }> = ({ screen }) => {
  const { t } = useTranslation();
  const [localActiveTab, setActiveTab] = useState<ChallengeTab>('challenges');
  const activeTab = screen ?? localActiveTab;
  // Store State
  const { challenges, setChallenges, updateChallengesList } = useContextBuilderStore();
  // Derived State Shortcuts
  const declaredChallenges = challenges.declaredChallenges;
  const rootCauseAnswers = challenges.rootCauseAnswers;
  const evidence = challenges.evidence;
  const activeBlockers = challenges.activeBlockers;
  const ROOT_CAUSE_QUESTIONS = t('organization.challenges.rootcause.questions', {
    returnObjects: true,
    defaultValue: [
      { q: 'Where do decisions get stuck?', h: 'e.g. Middle management fear, Lack of data...' },
      {
        q: 'Where is the strongest resistance to change?',
        h: 'e.g. Shop floor, Specific department...',
      },
      {
        q: 'What initiatives failed in the past and why?',
        h: 'e.g. Lean impl failed due to no follow-up...',
      },
      {
        q: 'Is there a gap between management view and reality?',
        h: 'e.g. CEO thinks ERP works, users use Excel...',
      },
    ],
  }) as unknown as Array<{ q: string; h: string }>;
  // Common Blockers Library
  const commonBlockers = [
    {
      id: 'c1',
      type: 'Culture',
      title: t('organization.challenges.blockers.library.c1.title', 'Fear of Failure'),
      desc: t(
        'organization.challenges.blockers.library.c1.desc',
        'Employees hide mistakes instead of reporting them.'
      ),
    },
    {
      id: 'c2',
      type: 'Process',
      title: t('organization.challenges.blockers.library.c2.title', 'Meeting Overload'),
      desc: t(
        'organization.challenges.blockers.library.c2.desc',
        'Productivity lost to excessive alignment meetings.'
      ),
    },
    {
      id: 'c3',
      type: 'Strategy',
      title: t('organization.challenges.blockers.library.c3.title', 'Change Fatigue'),
      desc: t(
        'organization.challenges.blockers.library.c3.desc',
        'Teams are burnt out from too many initiatives.'
      ),
    },
    {
      id: 'c4',
      type: 'Technology',
      title: t('organization.challenges.blockers.library.c4.title', 'Data Fragmentation'),
      desc: t(
        'organization.challenges.blockers.library.c4.desc',
        'Key KPIs are manually aggregated in Excel.'
      ),
    },
  ];
  const blockerTypeLabel = (type: string) =>
    t(`organization.challenges.blockers.types.${type}`, type);
  const addBlocker = (blocker: { id: string; type: string; title: string; desc: string }) => {
    const newBlocker = {
      ...blocker,
      id: Math.random().toString(),
      status: 'confirmed' as const,
      confidence: 'Manual',
    };
    setChallenges({ activeBlockers: [...activeBlockers, newBlocker] });
  };
  const addCustomBlocker = () => {
    const newBlocker = {
      id: Math.random().toString(),
      type: 'Process',
      title: t('organization.challenges.blockers.newObstacleTitle', 'New Obstacle'),
      desc: '',
      status: 'confirmed' as const,
      confidence: 'Manual',
    };
    setChallenges({ activeBlockers: [...activeBlockers, newBlocker] });
  };
  const removeBlocker = (id: string) => {
    setChallenges({ activeBlockers: activeBlockers.filter((b) => b.id !== id) });
  };
  const updateBlocker = (id: string, field: string, value: string) => {
    const updated = activeBlockers.map((b) => (b.id === id ? { ...b, [field]: value } : b));
    setChallenges({ activeBlockers: updated });
  };
  // Handlers
  const createHandler = (
    listName: 'declaredChallenges' | 'evidence',
    currentItems: DynamicListItem[]
  ) => ({
    onAdd: (item: Omit<DynamicListItem, 'id'>) => {
      const newItem = { ...item, id: Math.random().toString(36).substr(2, 9) };
      updateChallengesList(listName, [...currentItems, newItem]);
    },
    onUpdate: (id: string, updates: Partial<DynamicListItem>) => {
      const newItems = currentItems.map((p) => (p.id === id ? { ...p, ...updates } : p));
      updateChallengesList(listName, newItems);
    },
    onDelete: (id: string) => {
      const newItems = currentItems.filter((p) => p.id !== id);
      updateChallengesList(listName, newItems);
    },
  });
  const challengeHandlers = createHandler('declaredChallenges', declaredChallenges);
  const evidenceHandlers = createHandler('evidence', evidence);
  // TABS CONFIG
  const tabs = [
    {
      id: 'challenges',
      label: t('organization.challenges.tabs.challenges', 'Declared Challenges'),
      icon: AlertOctagon,
    },
    {
      id: 'rootcause',
      label: t('organization.challenges.tabs.rootcause', 'Root Cause Signals'),
      icon: Activity,
    },
    {
      id: 'blockers',
      label: t('organization.challenges.tabs.blockers', 'Objective Blockers'),
      icon: Lock,
    },
    { id: 'evidence', label: t('organization.challenges.tabs.evidence', 'Evidence'), icon: Search },
  ];
  return (
    <div className="space-y-6">
      {!screen && (
        <div className="flex border-b border-slate-200 dark:border-navy-700 space-x-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() =>
                setActiveTab(tab.id as 'challenges' | 'rootcause' | 'blockers' | 'evidence')
              }
              className={`
                            flex items-center gap-2 pb-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap
                            ${
                              activeTab === tab.id
                                ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white'
                            }
                        `}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      )}
      <div className="min-h-[400px]">
        {/* TAB 1: DECLARED CHALLENGES */}
        {activeTab === 'challenges' && (
          <div className="space-y-6">
            <ContextDocUploader
              tabName={t('organization.challenges.tabs.challenges', 'Declared Challenges')}
              suggestions={
                t('organization.challenges.declared.suggestions', {
                  returnObjects: true,
                  defaultValue: [
                    'Operational Reports',
                    'Audit Logs',
                    'Customer Complaints',
                    'Shift Handover Notes',
                  ],
                }) as unknown as string[]
              }
            />
            <DynamicList
              title={t('organization.challenges.declared.title', 'Declared Challenges')}
              description={t(
                'organization.challenges.declared.description',
                'Official problems reported by the client (symptoms).'
              )}
              items={declaredChallenges}
              columns={[
                {
                  key: 'challenge',
                  label: t(
                    'organization.challenges.declared.columns.challenge',
                    'Challenge / Symptom'
                  ),
                  width: 'w-1/3',
                  placeholder: t(
                    'organization.challenges.declared.placeholders.challenge',
                    'e.g. High Scrap Rate'
                  ),
                },
                {
                  key: 'area',
                  label: t('organization.challenges.declared.columns.area', 'Functional Area'),
                  width: 'w-1/6',
                  placeholder: t(
                    'organization.challenges.declared.placeholders.area',
                    'e.g. Quality'
                  ),
                },
                {
                  key: 'severity',
                  label: t('organization.challenges.declared.columns.severity', 'Severity'),
                  type: 'select',
                  options: [
                    {
                      label: t(
                        'organization.challenges.declared.severityOptions.Critical',
                        'Critical'
                      ),
                      value: 'Critical',
                    },
                    {
                      label: t('organization.challenges.declared.severityOptions.High', 'High'),
                      value: 'High',
                    },
                    {
                      label: t('organization.challenges.declared.severityOptions.Medium', 'Medium'),
                      value: 'Medium',
                    },
                    {
                      label: t('organization.challenges.declared.severityOptions.Low', 'Low'),
                      value: 'Low',
                    },
                  ],
                  width: 'w-1/6',
                },
                {
                  key: 'notes',
                  label: t('organization.challenges.declared.columns.notes', 'Notes / Context'),
                  width: 'w-1/3',
                  placeholder: t(
                    'organization.challenges.declared.placeholders.notes',
                    'Additional details...'
                  ),
                },
              ]}
              {...challengeHandlers}
            />
          </div>
        )}
        {/* TAB 2: ROOT CAUSE SIGNALS */}
        {activeTab === 'rootcause' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="col-span-1 md:col-span-2">
              <ContextDocUploader
                tabName={t('organization.challenges.tabs.rootcause', 'Root Cause Signals')}
                suggestions={
                  t('organization.challenges.rootcause.suggestions', {
                    returnObjects: true,
                    defaultValue: ['Incident Reports', '5 Whys Docs', 'PFMEA', 'Ishikawa Diagrams'],
                  }) as unknown as string[]
                }
              />
            </div>
            <div className="col-span-1 md:col-span-2 bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg border border-blue-100 dark:border-blue-900/20 text-sm text-blue-800 dark:text-blue-200">
              <strong>
                {t('organization.challenges.rootcause.diagnosticLabel', 'Diagnostic Questions:')}
              </strong>{' '}
              {t(
                'organization.challenges.rootcause.diagnosticBody',
                'These answers help AI identify hidden root causes behind the declared challenges.'
              )}
            </div>
            {ROOT_CAUSE_QUESTIONS.map((item, index) => (
              <div key={index} className="space-y-2">
                <label className="block text-sm font-bold text-navy-900 dark:text-white">
                  {item.q}
                </label>
                <AITextArea
                  value={rootCauseAnswers[index] || ''}
                  onChange={(e) =>
                    setChallenges({
                      rootCauseAnswers: { ...rootCauseAnswers, [index]: e.target.value },
                    })
                  }
                  placeholder={item.h}
                  className="min-h-[120px]"
                  aiContext="blocker"
                />
              </div>
            ))}
          </div>
        )}
        {/* TAB 3: OBJECTIVE BLOCKERS */}
        {activeTab === 'blockers' && (
          <div className="space-y-8">
            <ContextDocUploader
              tabName={t('organization.challenges.tabs.blockers', 'Objective Blockers')}
              suggestions={
                t('organization.challenges.blockers.suggestions', {
                  returnObjects: true,
                  defaultValue: [
                    'Employee Surveys',
                    'Risk Register',
                    'Strategy Deck',
                    'Cultural Assessment',
                  ],
                }) as unknown as string[]
              }
            />
            {/* 1. Suggestion Gallery */}
            <div className="bg-slate-50 dark:bg-navy-900/50 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-sm font-bold text-navy-900 dark:text-white flex items-center gap-2">
                    <Search size={16} className="text-primary-500" />
                    {t('organization.challenges.blockers.suggestedTitle', 'Suggested Obstacles')}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {t(
                      'organization.challenges.blockers.suggestedHint',
                      'Tap to add common issues to your board.'
                    )}
                  </p>
                </div>
                <button
                  onClick={addCustomBlocker}
                  className="px-3 py-1.5 bg-white dark:bg-navy-800 hover:bg-primary-50 dark:hover:bg-primary-900/20 text-primary-600 text-xs font-bold border border-primary-100 dark:border-primary-500/20 rounded-lg shadow-sm transition-all flex items-center gap-2"
                >
                  <Plus size={14} />
                  {t('organization.challenges.blockers.createCustom', 'Create Custom')}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {commonBlockers.map((cb) => {
                  const isAdded = activeBlockers.some((b) => b.title === cb.title);
                  return (
                    <button
                      key={cb.id}
                      onClick={() => !isAdded && addBlocker(cb)}
                      disabled={isAdded}
                      className={`
                                                relative p-3 rounded-xl border text-left transition-all group
                                                ${
                                                  isAdded
                                                    ? 'bg-primary-50 dark:bg-primary-900/10 border-primary-200 dark:border-primary-500/20 opacity-60 cursor-default'
                                                    : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 hover:border-primary-400 hover:shadow-md cursor-pointer'
                                                }
                                            `}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-600 dark:text-slate-500">
                          {blockerTypeLabel(cb.type)}
                        </span>
                        {isAdded ? (
                          <Check size={14} className="text-primary-500" />
                        ) : (
                          <Plus size={14} className="text-slate-600 group-hover:text-primary-600" />
                        )}
                      </div>
                      <div className="font-bold text-xs text-navy-900 dark:text-white leading-tight">
                        {cb.title}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            {/* 2. Active Blockers List (Editable) */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-navy-900 dark:text-white flex items-center gap-2">
                <Lock size={16} className="text-slate-600 dark:text-slate-500" />
                {t('organization.challenges.blockers.activeTitle', 'Active Blockers')}
                <span className="bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full text-xs font-normal">
                  {activeBlockers.length}
                </span>
              </h4>
              {activeBlockers.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-slate-200 dark:border-navy-700 rounded-xl">
                  <p className="text-sm text-slate-600 dark:text-slate-500">
                    {t(
                      'organization.challenges.blockers.emptyMessage',
                      'No blockers identified yet. Add from suggestions or create a custom one.'
                    )}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {activeBlockers.map((blocker, index) => (
                    <div
                      key={blocker.id}
                      className="group relative bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 shadow-sm hover:shadow-md hover:border-primary-200 dark:hover:border-primary-500/30 transition-all p-4"
                    >
                      {/* Action Bar (Hover only) */}
                      <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => removeBlocker(blocker.id)}
                          className="p-1.5 text-slate-600 dark:text-slate-500 hover:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-lg transition-colors"
                          title={t(
                            'organization.challenges.blockers.removeTitle',
                            'Remove Blocker'
                          )}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                        {/* Left: Icon & Type */}
                        <div className="md:col-span-4 space-y-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={`p-2 rounded-lg shrink-0 ${blocker.type === 'Culture' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}
                            >
                              <AlertTriangle size={18} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <input
                                type="text"
                                value={blocker.title}
                                onChange={(e) => updateBlocker(blocker.id, 'title', e.target.value)}
                                className="w-full bg-transparent font-bold text-navy-900 dark:text-white border-none p-0 focus:ring-0 placeholder:text-slate-400 text-sm truncate focus:underline decoration-dashed decoration-slate-300"
                                placeholder={t(
                                  'organization.challenges.blockers.titlePlaceholder',
                                  'Blocker Title'
                                )}
                              />
                              <select
                                value={blocker.type}
                                onChange={(e) => updateBlocker(blocker.id, 'type', e.target.value)}
                                className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 bg-transparent border-none p-0 focus:ring-0 cursor-pointer hover:text-primary-600 transition-colors"
                              >
                                <option value="Culture">
                                  {t('organization.challenges.blockers.types.Culture', 'Culture')}
                                </option>
                                <option value="Process">
                                  {t('organization.challenges.blockers.types.Process', 'Process')}
                                </option>
                                <option value="Technology">
                                  {t(
                                    'organization.challenges.blockers.types.Technology',
                                    'Technology'
                                  )}
                                </option>
                                <option value="Strategy">
                                  {t('organization.challenges.blockers.types.Strategy', 'Strategy')}
                                </option>
                                <option value="People">
                                  {t('organization.challenges.blockers.types.People', 'People')}
                                </option>
                              </select>
                            </div>
                          </div>
                          {/* Confidence Badge (if detected) */}
                          {blocker.status === 'detected' && (
                            <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-500/20 rounded text-[10px] font-bold text-primary-600 dark:text-primary-400">
                              <Cpu size={10} />
                              {t(
                                'organization.challenges.blockers.aiDetected',
                                'AI Detected ({{confidence}})',
                                {
                                  confidence: blocker.confidence,
                                }
                              )}
                            </div>
                          )}
                        </div>
                        {/* Right: Description Editor */}
                        <div className="md:col-span-8">
                          <div className="relative">
                            <AITextArea
                              value={blocker.desc}
                              onChange={(e) => updateBlocker(blocker.id, 'desc', e.target.value)}
                              placeholder={t(
                                'organization.challenges.blockers.descPlaceholder',
                                'Describe the obstacle and its impact...'
                              )}
                              className="min-h-[80px] text-xs bg-slate-50 dark:bg-navy-900/50 border-transparent focus:bg-white dark:focus:bg-navy-900 transition-colors"
                              aiContext="blocker"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        {/* TAB 4: EVIDENCE */}
        {activeTab === 'evidence' && (
          <div className="space-y-6">
            <ContextDocUploader
              tabName={t('organization.challenges.tabs.evidence', 'Evidence')}
              suggestions={
                t('organization.challenges.evidence.suggestions', {
                  returnObjects: true,
                  defaultValue: [
                    'Raw Data Exports',
                    'KPI Dashboards',
                    'System Logs',
                    'Financial Reports',
                  ],
                }) as unknown as string[]
              }
            />
            <DynamicList
              title={t('organization.challenges.evidence.title', 'Evidence & Data Points')}
              description={t(
                'organization.challenges.evidence.description',
                'Hard facts, metrics, or logs that prove the existence of challenges.'
              )}
              items={evidence}
              columns={[
                {
                  key: 'metric',
                  label: t(
                    'organization.challenges.evidence.columns.metric',
                    'Metric / Data Point'
                  ),
                  width: 'w-1/4',
                  placeholder: t(
                    'organization.challenges.evidence.placeholders.metric',
                    'e.g. Scrap Rate 12%'
                  ),
                },
                {
                  key: 'symptom',
                  label: t(
                    'organization.challenges.evidence.columns.symptom',
                    'Symptom / Observation'
                  ),
                  width: 'w-1/4',
                  placeholder: t(
                    'organization.challenges.evidence.placeholders.symptom',
                    'e.g. Line stops every hour'
                  ),
                },
                {
                  key: 'source',
                  label: t(
                    'organization.challenges.evidence.columns.source',
                    'Source System / Doc'
                  ),
                  width: 'w-1/4',
                  placeholder: t(
                    'organization.challenges.evidence.placeholders.source',
                    'e.g. SAP Report'
                  ),
                },
                {
                  key: 'link',
                  label: t('organization.challenges.evidence.columns.link', 'Link / Reference'),
                  width: 'w-1/4',
                  placeholder: t(
                    'organization.challenges.evidence.placeholders.link',
                    'e.g. Page 12'
                  ),
                },
              ]}
              {...evidenceHandlers}
            />
          </div>
        )}
      </div>
    </div>
  );
};
