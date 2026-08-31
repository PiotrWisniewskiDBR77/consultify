// views/ContextBuilder/modules/SynthesisSummary.tsx
// Executive Summary Report for Strategic Synthesis

import {
  AlertTriangle,
  Building2,
  CheckCircle,
  FileDown,
  GitMerge,
  Printer,
  Share2,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { SCENARIOS } from '../../../data/transformationScenarios';
import { DynamicListItem } from '../shared/DynamicList';

interface SynthesisSummaryProps {
  companyProfile: {
    companyName: string;
    industry: string;
    revenue: string;
    employeeCount: string;
    currentMaturityLevel?: string;
    targetMaturityLevel?: string;
    activeConstraints: DynamicListItem[];
  };
  challenges: {
    declaredChallenges: DynamicListItem[];
  };
  goals: {
    strategicGoals: DynamicListItem[];
    successMetrics: DynamicListItem[];
  };
  risks: DynamicListItem[];
  strengths: DynamicListItem[];
  selectedScenarioId?: string;
}

export const SynthesisSummary: React.FC<SynthesisSummaryProps> = ({
  companyProfile,
  challenges,
  goals,
  risks,
  strengths,
  selectedScenarioId,
}) => {
  const { t } = useTranslation();
  const [isExporting, setIsExporting] = useState(false);

  const selectedScenario = SCENARIOS.find((s) => s.id === selectedScenarioId);
  const scenarioName = selectedScenario
    ? t(`transformationScenarios.scenarios.${selectedScenario.id}.name`, selectedScenario.name)
    : '';

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      window.print();
      toast.success(
        t(
          'organization.synthesis.executiveBrief.exportToast',
          'Use "Save as PDF" in the print dialog to export this summary.'
        )
      );
    } finally {
      setIsExporting(false);
    }
  };

  const criticalRisks = risks.filter((r) => r.severity === 'Critical' || r.severity === 'High');
  const completedGoals = goals.strategicGoals.filter((g) => g.status === 'Achieved');

  return (
    <div className="space-y-8 pb-12">
      {/* Header with Actions */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-navy-900 dark:text-white flex items-center gap-3">
            <Sparkles className="text-primary-500" size={28} />
            {t('organization.synthesis.executiveBrief.heading', 'Executive Strategic Summary')}
          </h2>
          <p className="text-c-text-muted mt-1">
            {t(
              'organization.synthesis.executiveBrief.subheading',
              'AI-synthesized strategic analysis based on your inputs'
            )}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-navy-900 dark:bg-primary-600 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <FileDown size={16} />
            {isExporting
              ? t('organization.synthesis.executiveBrief.exporting', 'Exporting...')
              : t('organization.synthesis.executiveBrief.exportPdf', 'Export PDF')}
          </button>
          <button className="flex items-center gap-2 px-4 py-2 border border-c-border-subtle text-c-text-secondary rounded-lg hover:bg-c-bg dark:hover:bg-c-surface/5 transition-colors">
            <Printer size={16} />
            {t('organization.synthesis.executiveBrief.print', 'Print')}
          </button>
          <button className="flex items-center gap-2 px-4 py-2 border border-c-border-subtle text-c-text-secondary rounded-lg hover:bg-c-bg dark:hover:bg-c-surface/5 transition-colors">
            <Share2 size={16} />
            {t('organization.synthesis.executiveBrief.share', 'Share')}
          </button>
        </div>
      </div>

      {/* Company Overview Card */}
      <div className="bg-c-surface rounded-xl shadow-lg border border-c-border-subtle overflow-hidden">
        <div className="bg-gradient-to-r from-navy-900 to-navy-800 dark:from-primary-900 dark:to-primary-800 p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-c-surface/10 rounded-xl flex items-center justify-center">
              <Building2 className="text-white" size={32} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white">
                {companyProfile.companyName || (
                  <span className="text-white/60 text-lg font-medium">
                    {t(
                      'organization.synthesis.executiveBrief.companyNameFallback',
                      'No organization name on file'
                    )}
                  </span>
                )}
              </h3>
              {/*
                Brak liczby albo kwoty NIE może renderować „— pracowników" /
                „— przychodu" (odbiór grafiki 2026-08-31): myślnik z jednostką
                czyta się jak urwane zdanie, a nie jak uczciwy brak danych.
                Gdy wartości nie ma, pokazujemy pełny komunikat o braku.
              */}
              <p className="text-white/70">
                {companyProfile.industry ||
                  t(
                    'organization.synthesis.executiveBrief.industryFallback',
                    'No industry on file'
                  )}{' '}
                •{' '}
                {companyProfile.employeeCount
                  ? `${companyProfile.employeeCount} ${t('organization.synthesis.executiveBrief.employeesUnit', 'employees')}`
                  : t(
                      'organization.synthesis.executiveBrief.employeesNoData',
                      'No headcount on file'
                    )}{' '}
                •{' '}
                {companyProfile.revenue
                  ? `${companyProfile.revenue} ${t('organization.synthesis.executiveBrief.revenueUnit', 'revenue')}`
                  : t('organization.synthesis.executiveBrief.revenueNoData', 'No revenue on file')}
              </p>
            </div>
          </div>
        </div>
        <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <div className="text-xs font-bold text-c-text-secondary uppercase tracking-wider mb-1">
              {t('organization.synthesis.executiveBrief.currentMaturity', 'Current Maturity')}
            </div>
            <div className="text-2xl font-bold text-navy-900 dark:text-white">
              {companyProfile.currentMaturityLevel ||
                t('organization.synthesis.executiveBrief.maturityNoData', 'No data')}
            </div>
          </div>
          <div>
            <div className="text-xs font-bold text-c-text-secondary uppercase tracking-wider mb-1">
              {t('organization.synthesis.executiveBrief.targetMaturity', 'Target Maturity')}
            </div>
            <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
              {companyProfile.targetMaturityLevel ||
                t('organization.synthesis.executiveBrief.maturityNoData', 'No data')}
            </div>
          </div>
          <div>
            <div className="text-xs font-bold text-c-text-secondary uppercase tracking-wider mb-1">
              {t('organization.synthesis.executiveBrief.activeConstraints', 'Active Constraints')}
            </div>
            <div className="text-2xl font-bold text-navy-900 dark:text-white">
              {companyProfile.activeConstraints.length}
            </div>
          </div>
          <div>
            <div className="text-xs font-bold text-c-text-secondary uppercase tracking-wider mb-1">
              {t('organization.synthesis.executiveBrief.strategicGoals', 'Strategic Goals')}
            </div>
            <div className="text-2xl font-bold text-navy-900 dark:text-white">
              {goals.strategicGoals.length}
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Risks Summary */}
        <div className="bg-c-surface rounded-xl shadow-md border border-c-border-subtle p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-navy-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="text-danger-500" size={18} />
              {t('organization.synthesis.executiveBrief.riskProfile', 'Risk Profile')}
            </h4>
            <span
              className={`px-2 py-1 rounded text-xs font-bold ${criticalRisks.length > 2 ? 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}
            >
              {criticalRisks.length > 2
                ? t('organization.synthesis.executiveBrief.highRisk', 'High Risk')
                : t('organization.synthesis.executiveBrief.manageable', 'Manageable')}
            </span>
          </div>
          <div className="text-3xl font-bold text-navy-900 dark:text-white mb-2">
            {risks.length}{' '}
            <span className="text-lg font-normal text-c-text-secondary">
              {t('organization.synthesis.executiveBrief.identified', 'identified')}
            </span>
          </div>
          <div className="text-sm text-c-text-muted">
            {criticalRisks.length}{' '}
            {t(
              'organization.synthesis.executiveBrief.criticalPriorityNote',
              'critical/high priority requiring immediate attention'
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-c-border-subtle">
            <div className="text-xs font-bold text-c-text-secondary uppercase tracking-wider mb-2">
              {t('organization.synthesis.executiveBrief.topRisks', 'Top Risks')}
            </div>
            <ul className="space-y-1">
              {risks.slice(0, 3).map((risk) => (
                <li key={risk.id} className="text-sm text-navy-900 dark:text-slate-200 truncate">
                  • {risk.risk as string}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Strengths Summary */}
        <div className="bg-c-surface rounded-xl shadow-md border border-c-border-subtle p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-navy-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="text-green-500" size={18} />
              {t('organization.synthesis.executiveBrief.opportunities', 'Opportunities')}
            </h4>
            <span className="px-2 py-1 rounded text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
              {strengths.length > 3
                ? t('organization.synthesis.executiveBrief.strong', 'Strong')
                : t('organization.synthesis.executiveBrief.developing', 'Developing')}
            </span>
          </div>
          <div className="text-3xl font-bold text-navy-900 dark:text-white mb-2">
            {strengths.length}{' '}
            <span className="text-lg font-normal text-c-text-secondary">
              {t('organization.synthesis.executiveBrief.identified', 'identified')}
            </span>
          </div>
          <div className="text-sm text-c-text-muted">
            {t(
              'organization.synthesis.executiveBrief.keyEnablersNote',
              'Key enablers for transformation success'
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-c-border-subtle">
            <div className="text-xs font-bold text-c-text-secondary uppercase tracking-wider mb-2">
              {t('organization.synthesis.executiveBrief.topStrengths', 'Top Strengths')}
            </div>
            <ul className="space-y-1">
              {strengths.slice(0, 3).map((s) => (
                <li key={s.id} className="text-sm text-navy-900 dark:text-slate-200 truncate">
                  • {s.enabler as string}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Challenges Summary */}
        <div className="bg-c-surface rounded-xl shadow-md border border-c-border-subtle p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-navy-900 dark:text-white flex items-center gap-2">
              <Target className="text-blue-500" size={18} />
              {t('organization.synthesis.executiveBrief.challenges', 'Challenges')}
            </h4>
            <span className="px-2 py-1 rounded text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              {challenges.declaredChallenges.length}{' '}
              {t('organization.synthesis.executiveBrief.active', 'Active')}
            </span>
          </div>
          <div className="text-3xl font-bold text-navy-900 dark:text-white mb-2">
            {challenges.declaredChallenges.length}{' '}
            <span className="text-lg font-normal text-c-text-secondary">
              {t('organization.synthesis.executiveBrief.declared', 'declared')}
            </span>
          </div>
          <div className="text-sm text-c-text-muted">
            {t(
              'organization.synthesis.executiveBrief.operationalPainNote',
              'Operational pain points to address'
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-c-border-subtle">
            <div className="text-xs font-bold text-c-text-secondary uppercase tracking-wider mb-2">
              {t('organization.synthesis.executiveBrief.topChallenges', 'Top Challenges')}
            </div>
            <ul className="space-y-1">
              {challenges.declaredChallenges.slice(0, 3).map((c) => (
                <li key={c.id} className="text-sm text-navy-900 dark:text-slate-200 truncate">
                  • {(c.challenge as string) || (c.name as string)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Selected Scenario */}
      {selectedScenario && (
        <div className="bg-gradient-to-r from-primary-50 to-white dark:from-primary-900/20 dark:to-navy-800 rounded-xl border border-primary-100 dark:border-primary-500/20 p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-navy-900 rounded-xl flex items-center justify-center shrink-0">
              <GitMerge className="text-white" size={24} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-bold text-navy-900 dark:text-white text-lg">
                  {t(
                    'organization.synthesis.executiveBrief.selectedScenario',
                    'Selected Transformation Scenario'
                  )}
                </h4>
                <span className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-600 text-xs font-bold uppercase rounded-full">
                  {scenarioName}
                </span>
              </div>
              <p className="text-c-text-secondary">
                {t(
                  `transformationScenarios.scenarios.${selectedScenario.id}.narrative`,
                  selectedScenario.narrative || selectedScenario.description
                )}
              </p>
              <div className="mt-4 grid grid-cols-3 gap-4">
                <div>
                  <div className="text-xs font-bold text-c-text-secondary uppercase tracking-wider mb-1">
                    {t('organization.synthesis.executiveBrief.timeline', 'Timeline')}
                  </div>
                  <div className="font-bold text-navy-900 dark:text-white">
                    {selectedScenario.timeline || selectedScenario.typicalDuration || '—'}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold text-c-text-secondary uppercase tracking-wider mb-1">
                    {t('organization.synthesis.executiveBrief.investment', 'Investment')}
                  </div>
                  <div className="font-bold text-navy-900 dark:text-white">
                    {selectedScenario.investment || '—'}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold text-c-text-secondary uppercase tracking-wider mb-1">
                    {t('organization.synthesis.executiveBrief.riskLevel', 'Risk Level')}
                  </div>
                  <div className="font-bold text-navy-900 dark:text-white">
                    {selectedScenario.riskLevel || selectedScenario.complexity || '—'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!selectedScenario && (
        <div className="bg-c-surface-raised/50 rounded-xl border-2 border-dashed border-c-border-subtle p-8 text-center">
          <GitMerge className="w-12 h-12 text-c-text-secondary mx-auto mb-4" />
          <h4 className="text-lg font-medium text-navy-900 dark:text-white mb-2">
            {t('organization.synthesis.executiveBrief.noScenarioTitle', 'No Scenario Selected')}
          </h4>
          <p className="text-c-text-muted">
            {t(
              'organization.synthesis.executiveBrief.noScenarioBody',
              'Go to "Transformation Scenarios" tab to select a strategic approach'
            )}
          </p>
        </div>
      )}

      {/* Goals Progress */}
      <div className="bg-c-surface rounded-xl shadow-md border border-c-border-subtle p-6">
        <h4 className="font-bold text-navy-900 dark:text-white text-lg mb-4 flex items-center gap-2">
          <CheckCircle className="text-primary-500" size={20} />
          {t(
            'organization.synthesis.executiveBrief.goalsProgressTitle',
            'Strategic Goals & Success Metrics'
          )}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="text-xs font-bold text-c-text-secondary uppercase tracking-wider mb-3">
              {t('organization.synthesis.executiveBrief.strategicGoalsLabel', 'Strategic Goals')}
            </div>
            {goals.strategicGoals.length === 0 ? (
              <p className="text-c-text-muted italic">
                {t(
                  'organization.synthesis.executiveBrief.noGoalsYet',
                  'No strategic goals defined yet'
                )}
              </p>
            ) : (
              <ul className="space-y-2">
                {goals.strategicGoals.map((goal) => (
                  <li key={goal.id} className="flex items-start gap-2 text-sm">
                    <div
                      className={`mt-1 w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${goal.status === 'Achieved' ? 'bg-green-500' : 'bg-slate-200 dark:bg-slate-600'}`}
                    >
                      {goal.status === 'Achieved' && (
                        <CheckCircle className="text-white" size={10} />
                      )}
                    </div>
                    <span className="text-navy-900 dark:text-slate-200">
                      {(goal.goal as string) || (goal.name as string)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <div className="text-xs font-bold text-c-text-secondary uppercase tracking-wider mb-3">
              {t(
                'organization.synthesis.executiveBrief.successMetricsLabel',
                'Success Metrics (KPIs)'
              )}
            </div>
            {goals.successMetrics.length === 0 ? (
              <p className="text-c-text-muted italic">
                {t(
                  'organization.synthesis.executiveBrief.noMetricsYet',
                  'No success metrics defined yet'
                )}
              </p>
            ) : (
              <ul className="space-y-2">
                {goals.successMetrics.map((metric) => (
                  <li key={metric.id} className="text-sm text-navy-900 dark:text-slate-200">
                    • {(metric.metric as string) || (metric.name as string)}:{' '}
                    <span className="font-bold">{(metric.target as string) || '—'}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* AI Recommendations */}
      <div className="bg-gradient-to-r from-primary-900 to-crimson-900 rounded-xl p-6 text-white">
        <h4 className="font-bold text-xl mb-4 flex items-center gap-2">
          <Sparkles className="text-yellow-300" size={24} />
          {t(
            'organization.synthesis.executiveBrief.aiRecommendationsTitle',
            'AI Strategic Recommendations'
          )}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-c-surface/10 rounded-lg p-4">
            <h5 className="font-bold mb-2">
              {t('organization.synthesis.executiveBrief.immediatePriority', 'Immediate Priority')}
            </h5>
            <p className="text-sm text-white/80">
              {criticalRisks.length > 0
                ? t(
                    'organization.synthesis.executiveBrief.immediatePriorityRisk',
                    'Address "{{risk}}" before initiating transformation to reduce execution risk.',
                    { risk: criticalRisks[0]?.risk }
                  )
                : t(
                    'organization.synthesis.executiveBrief.immediatePriorityManageable',
                    'Risk profile is manageable. Focus on quick wins to build momentum.'
                  )}
            </p>
          </div>
          <div className="bg-c-surface/10 rounded-lg p-4">
            <h5 className="font-bold mb-2">
              {t('organization.synthesis.executiveBrief.strategicLeverage', 'Strategic Leverage')}
            </h5>
            <p className="text-sm text-white/80">
              {strengths.length > 0
                ? t(
                    'organization.synthesis.executiveBrief.strategicLeverageWithData',
                    'Capitalize on "{{strength}}" as a key differentiator in your transformation journey.',
                    { strength: strengths[0]?.enabler }
                  )
                : t(
                    'organization.synthesis.executiveBrief.strategicLeverageEmpty',
                    'Identify internal champions to drive the transformation forward.'
                  )}
            </p>
          </div>
          <div className="bg-c-surface/10 rounded-lg p-4">
            <h5 className="font-bold mb-2">
              {t('organization.synthesis.executiveBrief.nextStep', 'Next Step')}
            </h5>
            <p className="text-sm text-white/80">
              {selectedScenario
                ? t(
                    'organization.synthesis.executiveBrief.nextStepWithScenario',
                    'Develop detailed implementation plan for "{{scenario}}" scenario.',
                    { scenario: scenarioName }
                  )
                : t(
                    'organization.synthesis.executiveBrief.nextStepEmpty',
                    'Select a transformation scenario to proceed with detailed planning.'
                  )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SynthesisSummary;
