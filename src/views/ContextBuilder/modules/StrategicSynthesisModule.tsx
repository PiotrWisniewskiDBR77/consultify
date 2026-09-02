import {
  AlertTriangle,
  BrainCircuit,
  FileText,
  GitMerge,
  Info,
  TrendingUp,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '../../../services/api';
import { useAppStore } from '../../../store/useAppStore';
import { useContextBuilderStore } from '../../../store/useContextBuilderStore';
import { DynamicList, DynamicListItem } from '../shared/DynamicList';
import { SynthesisSummary } from './SynthesisSummary';
import { TransformationScenarios } from './TransformationScenarios';

// The Executive Brief (SynthesisSummary) needs the organization's real
// identity (name, industry, size, revenue) -- the same record the rest of
// the Organization module reads via `/organization-profiles/:orgId`
// (OrganizationProfileModule.tsx). `useContextBuilderStore().companyProfile`
// below is a SEPARATE, purely-local zustand store (never fed by the API --
// its `industry` even defaults to the literal 'Manufacturing') used only by
// the Goals/Challenges/Synthesis mock lists. Mixing the two made the brief
// show 'Company Name' / 'Manufacturing' placeholders instead of the real
// org. This shape mirrors just the fields SynthesisSummary needs.
interface RealOrganizationIdentity {
  name: string;
  industry: string;
  employee_count: number | null;
  annual_revenue: number | null;
  currency: string;
  digital_maturity_overall: number | null;
}

export type SynthesisTab = 'risks' | 'strengths' | 'scenarios' | 'summary';
export const StrategicSynthesisModule: React.FC<{ screen?: SynthesisTab }> = ({ screen }) => {
  const { t } = useTranslation();
  const [localActiveTab, setActiveTab] = useState<SynthesisTab>('risks');
  const activeTab = screen ?? localActiveTab;
  // Store Access
  const { companyProfile, challenges, goals, synthesis, setSynthesis, updateSynthesisList } =
    useContextBuilderStore();
  const { fullSessionData, currentUser, currentOrganization } = useAppStore();
  const orgId = currentOrganization?.id || currentUser?.organizationId;
  const [realOrgIdentity, setRealOrgIdentity] = useState<RealOrganizationIdentity | null>(null);
  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = (await Api.get(`/organization-profiles/${orgId}`)) as {
          exists?: boolean;
          profile?: Partial<RealOrganizationIdentity>;
        };
        if (!cancelled && res?.exists && res.profile) {
          setRealOrgIdentity({
            name: res.profile.name || '',
            industry: res.profile.industry || '',
            employee_count: res.profile.employee_count ?? null,
            annual_revenue: res.profile.annual_revenue ?? null,
            currency: res.profile.currency || '',
            digital_maturity_overall: res.profile.digital_maturity_overall ?? null,
          });
        }
      } catch (err) {
        // Executive brief still renders with an honest "no data" state below.
        console.error('Nie udało się pobrać profilu organizacji dla podsumowania dla zarządu', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId]);
  // Derived State
  const { risks, strengths = [], selectedScenarioId } = synthesis;
  const [selectedRisk, setSelectedRisk] = useState<DynamicListItem | null>(null);
  const [selectedStrength, setSelectedStrength] = useState<DynamicListItem | null>(null);
  const activeConstraintCount =
    companyProfile.activeConstraints.length + challenges.activeBlockers.length;
  // Handlers
  const createHandler = (listName: 'risks' | 'strengths', currentItems: DynamicListItem[]) => ({
    onAdd: (item: Omit<DynamicListItem, 'id'>) => {
      const newItem = { ...item, id: Math.random().toString(36).substr(2, 9) };
      updateSynthesisList(listName, [...currentItems, newItem]);
    },
    onUpdate: (id: string, updates: Partial<DynamicListItem>) => {
      const newItems = currentItems.map((p) => (p.id === id ? { ...p, ...updates } : p));
      updateSynthesisList(listName, newItems);
    },
    onDelete: (id: string) => {
      const newItems = currentItems.filter((p) => p.id !== id);
      updateSynthesisList(listName, newItems);
    },
  });
  const riskHandlers = createHandler('risks', risks);
  const strengthHandlers = createHandler('strengths', strengths);
  // TABS CONFIG
  const tabs = [
    { id: 'risks', label: t('organization.synthesis.tabs.risks', 'Hidden Risks'), icon: AlertTriangle },
    {
      id: 'strengths',
      label: t('organization.synthesis.tabs.strengths', 'Strengths & Opportunities'),
      icon: TrendingUp,
    },
    {
      id: 'scenarios',
      label: t('organization.synthesis.tabs.scenarios', 'Transformation Scenarios'),
      icon: GitMerge,
    },
    { id: 'summary', label: t('organization.synthesis.tabs.summary', 'Executive Report'), icon: FileText },
  ];
  const severityOptions = [
    { label: t('organization.synthesis.risks.severityOptions.Critical', 'Critical'), value: 'Critical' },
    { label: t('organization.synthesis.risks.severityOptions.High', 'High'), value: 'High' },
    { label: t('organization.synthesis.risks.severityOptions.Medium', 'Medium'), value: 'Medium' },
    { label: t('organization.synthesis.risks.severityOptions.Low', 'Low'), value: 'Low' },
  ];
  return (
    <div className="space-y-6 h-full flex flex-col">
      {!screen && (
        <div className="flex justify-between items-end border-b border-slate-200 dark:border-navy-700 shrink-0">
          <div className="flex space-x-6 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() =>
                  setActiveTab(tab.id as 'risks' | 'strengths' | 'scenarios' | 'summary')
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
        </div>
      )}
      <div className="flex-1 overflow-visible min-h-[500px]">
        {/* TAB 1: RISKS */}
        {activeTab === 'risks' && (
          <div className="space-y-6 relative">
            {/* Kanon czerwieni (CLAUDE.md UI#3): to baner METODYCZNY — tlumaczy,
                z czego policzono liste ryzyk. Nie jest awaria ani przekroczonym
                progiem, wiec nie moze byc czerwony (przy zerze ryzyk malowal
                alarm o niczym). Blizniaczy baner zakladki „Szanse" (nizej w tym
                pliku) jest zielony; paleta `c-info` to ta sama, ktorej uzywa
                <Banner variant="info">. */}
            <div className="bg-c-info/[0.08] dark:bg-c-info/[0.08] p-4 rounded-xl border border-c-info/25 flex gap-3 text-c-text">
              <Info size={20} className="shrink-0 mt-0.5 text-c-info" />
              <div className="text-sm">
                <p className="font-bold mb-1">
                  {t('organization.synthesis.risks.bannerTitle', 'Risk Assessment Logic')}
                </p>
                <p className="opacity-90">
                  {t('organization.synthesis.risks.bannerPre', 'Based on your')}{' '}
                  <strong>
                    {t('organization.synthesis.risks.bannerChallenges', '{{count}} declared challenges', {
                      count: challenges.declaredChallenges.length,
                    })}
                  </strong>{' '}
                  {t('organization.synthesis.risks.bannerAnd', 'and')}{' '}
                  <strong>
                    {t('organization.synthesis.risks.bannerConstraints', '{{count}} active constraints', {
                      count: activeConstraintCount,
                    })}
                  </strong>
                  , {t('organization.synthesis.risks.bannerPost', 'we have identified the following risks.')}
                </p>
              </div>
            </div>
            <DynamicList
              title={t('organization.synthesis.risks.listTitle', 'Hidden Risks & Threats')}
              description={t(
                'organization.synthesis.risks.listDescription',
                'What could derail this transformation? (Generated from Constraints + Challenges)'
              )}
              items={risks}
              onRowClick={(item) => setSelectedRisk(item)}
              columns={[
                {
                  key: 'risk',
                  label: t('organization.synthesis.risks.columns.risk', 'Risk / Threat'),
                  width: 'w-1/3',
                  placeholder: t(
                    'organization.synthesis.risks.placeholders.risk',
                    'e.g. Middle Management Resistance'
                  ),
                  render: (item) => (
                    <div className="flex items-center gap-2">
                      {(item.isAiSuggested as boolean) && (
                        <div
                          className="p-1 bg-primary-100 dark:bg-primary-900/30 rounded-md text-primary-600"
                          title={t('organization.synthesis.risks.aiSuggestedTitle', 'AI Suggested Risk')}
                        >
                          <BrainCircuit size={14} />
                        </div>
                      )}
                      <span className="font-medium">{item.risk as string}</span>
                    </div>
                  ),
                },
                {
                  key: 'why',
                  label: t('organization.synthesis.risks.columns.why', 'Why (Root Cause)'),
                  width: 'w-1/4',
                  placeholder: t(
                    'organization.synthesis.risks.placeholders.why',
                    'e.g. Fear of redundancy'
                  ),
                },
                {
                  key: 'severity',
                  label: t('organization.synthesis.risks.columns.severity', 'Severity'),
                  type: 'select',
                  options: severityOptions,
                  width: 'w-1/6',
                  render: (item) => {
                    const colorMap: Record<string, string> = {
                      Critical:
                        'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300',
                      High: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
                      Medium:
                        'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
                      Low: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
                    };
                    const severity = item.severity as string;
                    const colorClass =
                      colorMap[severity as keyof typeof colorMap] ||
                      'bg-slate-100 text-slate-700 dark:text-slate-300';
                    const severityLabel = t(
                      `organization.synthesis.risks.severityOptions.${severity}`,
                      severity
                    );
                    return (
                      <span
                        className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${colorClass}`}
                      >
                        {severityLabel}
                      </span>
                    );
                  },
                },
                {
                  key: 'mitigation',
                  label: t('organization.synthesis.risks.columns.mitigation', 'Mitigation Strategy'),
                  width: 'w-1/4',
                  placeholder: t(
                    'organization.synthesis.risks.placeholders.mitigation',
                    'e.g. Change Mgmt Program'
                  ),
                },
              ]}
              {...riskHandlers}
            />
            {/* Risk Detail Modal / Overlay */}
            {selectedRisk && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/80 backdrop-blur-sm"
                onClick={() => setSelectedRisk(null)}
              >
                <div
                  className="bg-white dark:bg-navy-900 w-full max-w-2xl rounded-xl shadow-2xl border border-slate-200 dark:border-navy-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="bg-slate-50 dark:bg-navy-800 p-6 border-b border-slate-200 dark:border-navy-700 flex justify-between items-start">
                    <div className="flex gap-4">
                      <div
                        className={`mt-1 p-3 rounded-xl ${(selectedRisk.isAiSuggested as boolean) ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30' : 'bg-danger-100 text-danger-600 dark:bg-danger-900/30'}`}
                      >
                        {(selectedRisk.isAiSuggested as boolean) ? (
                          <BrainCircuit size={24} />
                        ) : (
                          <AlertTriangle size={24} />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-xl font-bold text-navy-900 dark:text-white">
                            {selectedRisk.risk as string}
                          </h3>
                          {(selectedRisk.isAiSuggested as boolean) && (
                            <span className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-600 text-[10px] font-bold uppercase rounded-full tracking-wide">
                              {t('organization.synthesis.risks.modal.aiInsight', 'AI Insight')}
                            </span>
                          )}
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">
                          {t(
                            'organization.synthesis.risks.modal.identifiedDuring',
                            'Identified during synthesis phase'
                          )}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedRisk(null)}
                      className="text-slate-600 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                  {/* Content */}
                  <div className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-500 uppercase tracking-wider block mb-2">
                          {t('organization.synthesis.risks.modal.severityLevel', 'Severity Level')}
                        </label>
                        <div
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-sm ${
                            (selectedRisk.severity as string) === 'Critical'
                              ? 'bg-danger-100 text-danger-700'
                              : (selectedRisk.severity as string) === 'High'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          <div
                            className={`w-2 h-2 rounded-full ${
                              (selectedRisk.severity as string) === 'Critical'
                                ? 'bg-danger-500'
                                : (selectedRisk.severity as string) === 'High'
                                  ? 'bg-amber-500'
                                  : 'bg-blue-500'
                            }`}
                          />
                          {t(
                            `organization.synthesis.risks.severityOptions.${selectedRisk.severity as string}`,
                            selectedRisk.severity as string
                          )}{' '}
                          {t('organization.synthesis.risks.modal.priority', 'Priority')}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-500 uppercase tracking-wider block mb-2">
                          {t('organization.synthesis.risks.modal.sourceContext', 'Source / Context')}
                        </label>
                        <div className="text-sm text-navy-900 dark:text-white font-medium">
                          {(selectedRisk.isAiSuggested as boolean)
                            ? t(
                                'organization.synthesis.risks.modal.sourcePattern',
                                'Pattern Recognition Engine'
                              )
                            : t('organization.synthesis.risks.modal.sourceUser', 'User Constraints')}
                        </div>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-black/20 rounded-xl border border-slate-200 dark:border-navy-700 space-y-4">
                      <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-500 uppercase tracking-wider block mb-1">
                          {t(
                            'organization.synthesis.risks.modal.rootCauseAnalysis',
                            'Root Cause Analysis'
                          )}
                        </label>
                        <p className="text-navy-900 dark:text-slate-200">
                          {selectedRisk.why as string}
                        </p>
                      </div>
                      <div className="h-px bg-slate-200 dark:bg-white/5" />
                      <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-500 uppercase tracking-wider block mb-1">
                          {t(
                            'organization.synthesis.risks.modal.recommendedMitigation',
                            'Recommended Mitigation'
                          )}
                        </label>
                        <p className="text-navy-900 dark:text-slate-200">
                          {selectedRisk.mitigation as string}
                        </p>
                      </div>
                    </div>
                    {(selectedRisk.isAiSuggested as boolean) && (
                      <div className="flex gap-3 text-sm text-slate-500 dark:text-slate-400 bg-primary-50 dark:bg-primary-900/10 p-4 rounded-lg border border-primary-100 dark:border-primary-900/20">
                        <BrainCircuit size={16} className="text-primary-500 shrink-0 mt-0.5" />
                        <p>
                          {t(
                            'organization.synthesis.risks.modal.aiSuggestedNotePre',
                            'This risk was suggested because similar organizations in'
                          )}{' '}
                          <strong>
                            {t(
                              'organization.synthesis.risks.modal.aiSuggestedIndustry',
                              'Automotive'
                            )}
                          </strong>{' '}
                          {t(
                            'organization.synthesis.risks.modal.aiSuggestedNotePost',
                            'typically struggle with this compliance gap during digital transformations.'
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                  {/* Footer */}
                  <div className="bg-slate-50 dark:bg-navy-800 p-4 border-t border-slate-200 dark:border-navy-700 flex justify-end gap-3">
                    <button
                      onClick={() => setSelectedRisk(null)}
                      className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/5 rounded-lg text-sm font-medium transition-colors"
                    >
                      {t('organization.synthesis.risks.modal.close', 'Close')}
                    </button>
                    <button className="px-4 py-2 bg-navy-900 dark:bg-primary-600 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
                      {t('organization.synthesis.risks.modal.updateStrategy', 'Update Risk Strategy')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {/* TAB 2: STRENGTHS & OPPORTUNITIES */}
        {activeTab === 'strengths' && (
          <div className="space-y-6">
            <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-xl border border-green-100 dark:border-green-900/30 flex gap-3 text-green-800 dark:text-green-300">
              <TrendingUp size={20} className="shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-bold mb-1">
                  {t('organization.synthesis.strengths.bannerTitle', 'Strategic Advantages')}
                </p>
                <p className="opacity-90">
                  {t(
                    'organization.synthesis.strengths.bannerBody',
                    'Based on your Company Profile and Goals, we have identified these key strengths and market opportunities.'
                  )}
                </p>
              </div>
            </div>
            <DynamicList
              title={t('organization.synthesis.strengths.listTitle', 'Strengths & Opportunities')}
              description={t(
                'organization.synthesis.strengths.listDescription',
                'What strengths can you leverage? (Generated from Profile & Opportunities)'
              )}
              items={strengths}
              columns={[
                {
                  key: 'enabler',
                  label: t(
                    'organization.synthesis.strengths.columns.enabler',
                    'Strength / Opportunity'
                  ),
                  width: 'w-1/3',
                  placeholder: t(
                    'organization.synthesis.strengths.placeholders.enabler',
                    'e.g. Strong Engineering Team'
                  ),
                  render: (item) => (
                    <div className="flex items-center gap-2">
                      {(item.isAiSuggested as boolean) && (
                        <div
                          className="p-1 bg-primary-100 dark:bg-primary-900/30 rounded-md text-primary-600"
                          title={t(
                            'organization.synthesis.strengths.aiSuggestedTitle',
                            'AI Suggested Opportunity'
                          )}
                        >
                          <BrainCircuit size={14} />
                        </div>
                      )}
                      <span className="font-medium">{item.enabler as string}</span>
                    </div>
                  ),
                },
                {
                  key: 'seen',
                  label: t(
                    'organization.synthesis.strengths.columns.seen',
                    'Evidence / Where Seen'
                  ),
                  width: 'w-1/3',
                  placeholder: t(
                    'organization.synthesis.strengths.placeholders.seen',
                    'e.g. R&D Performance'
                  ),
                },
                {
                  key: 'leverage',
                  label: t('organization.synthesis.strengths.columns.leverage', 'How to Leverage'),
                  width: 'w-1/3',
                  placeholder: t(
                    'organization.synthesis.strengths.placeholders.leverage',
                    'e.g. Use as Pilot Champions'
                  ),
                },
              ]}
              onRowClick={(item) => setSelectedStrength(item)}
              {...strengthHandlers}
            />
            {/* Strength Detail Modal */}
            {selectedStrength && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/80 backdrop-blur-sm"
                onClick={() => setSelectedStrength(null)}
              >
                <div
                  className="bg-white dark:bg-navy-900 w-full max-w-2xl rounded-xl shadow-2xl border border-slate-200 dark:border-navy-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="bg-slate-50 dark:bg-navy-800 p-6 border-b border-slate-200 dark:border-navy-700 flex justify-between items-start">
                    <div className="flex gap-4">
                      <div
                        className={`mt-1 p-3 rounded-xl ${selectedStrength.isAiSuggested ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30' : 'bg-green-100 text-green-600 dark:bg-green-900/30'}`}
                      >
                        {selectedStrength.isAiSuggested ? (
                          <BrainCircuit size={24} />
                        ) : (
                          <TrendingUp size={24} />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-xl font-bold text-navy-900 dark:text-white">
                            {selectedStrength.enabler as string}
                          </h3>
                          {(selectedStrength.isAiSuggested as boolean) && (
                            <span className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-600 text-[10px] font-bold uppercase rounded-full tracking-wide">
                              {t('organization.synthesis.strengths.modal.aiOpportunity', 'AI Opportunity')}
                            </span>
                          )}
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">
                          {t(
                            'organization.synthesis.strengths.modal.identifiedStrength',
                            'Identified Strength / Opportunity'
                          )}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedStrength(null)}
                      className="text-slate-600 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                  {/* Content */}
                  <div className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-500 uppercase tracking-wider block mb-2">
                          {t('organization.synthesis.strengths.modal.impactPotential', 'Impact Potential')}
                        </label>
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-sm bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                          {(selectedStrength.impact as string) ||
                            t('organization.synthesis.strengths.modal.medium', 'Medium')}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-500 uppercase tracking-wider block mb-2">
                          {t('organization.synthesis.strengths.modal.confidence', 'Confidence')}
                        </label>
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-sm bg-slate-100 dark:bg-navy-800/40 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {(selectedStrength.confidence as string) ||
                            t('organization.synthesis.strengths.modal.medium', 'Medium')}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {/* TAB 3: SCENARIOS */}
        {activeTab === 'scenarios' && (
          <div className="space-y-6">
            <TransformationScenarios
              currentScenarioId={selectedScenarioId}
              onSelectScenario={(scenarioId) =>
                setSynthesis({ ...synthesis, selectedScenarioId: scenarioId })
              }
            />
          </div>
        )}
        {/* TAB 4: SUMMARY */}
        {activeTab === 'summary' && (
          <div className="space-y-6">
            <SynthesisSummary
              companyProfile={{
                ...companyProfile,
                // Identity fields (name/industry/size/revenue/maturity) come
                // from the REAL organization profile fetched above, not from
                // the local ContextBuilder mock store -- see
                // RealOrganizationIdentity comment. Missing data renders an
                // honest "no data" message in SynthesisSummary, never a
                // placeholder like 'Company Name' / 'Manufacturing'.
                companyName: realOrgIdentity?.name || '',
                industry: realOrgIdentity?.industry || '',
                employeeCount:
                  realOrgIdentity?.employee_count != null
                    ? String(realOrgIdentity.employee_count)
                    : '',
                revenue:
                  realOrgIdentity?.annual_revenue != null
                    ? [realOrgIdentity.annual_revenue.toLocaleString('pl-PL'), realOrgIdentity.currency]
                        .filter(Boolean)
                        .join(' ')
                    : '',
                currentMaturityLevel:
                  realOrgIdentity?.digital_maturity_overall != null
                    ? String(realOrgIdentity.digital_maturity_overall)
                    : '',
                targetMaturityLevel: '',
                activeConstraints: companyProfile.activeConstraints.map((c) => ({
                  id: c,
                  text: companyProfile.constraintDetails[c] || c,
                })),
              }}
              challenges={challenges}
              goals={goals}
              risks={risks}
              strengths={strengths}
              selectedScenarioId={selectedScenarioId}
            />
          </div>
        )}
      </div>
    </div>
  );
};
