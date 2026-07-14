/**
 * DBR77 Lean 4.0 Report Template
 *
 * Key feature: ONE PAGE PER WORKSTATION
 *
 * Structure:
 * - Executive Summary
 * - Per-Workstation Pages (each workstation gets its own page)
 * - Process Summary
 * - Management Practices Assessment
 * - Recommendations & Roadmap
 */

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  Clock,
  Cpu,
  DollarSign,
  Eye,
  Info,
  Move,
  Package,
  PlusCircle,
  Ruler,
  Settings,
  Star,
  Target,
  TrendingUp,
  Users,
  UserX,
  XCircle,
  Zap,
} from 'lucide-react';
import React from 'react';

import {
  DBR77_AUTOMATION_TECHNOLOGIES,
  DBR77_PHASES,
  DBR77_ROLE_EVOLUTION,
  DBR77_WASTES,
} from '../../../../services/dbr77LeanStructure';
import {
  DBR77AssessmentData,
  DBR77ProcessAssessment,
  DBR77WorkstationAssessment,
} from '../../../../types';

interface DBR77ReportTemplateProps {
  data: DBR77AssessmentData;
  organizationName?: string;
  assessmentDate?: string;
}

// Page break component for print
const PageBreak: React.FC = () => (
  <div className="hidden print:block" style={{ pageBreakAfter: 'always' }} />
);

// Single Workstation Page
const WorkstationPage: React.FC<{
  workstation: DBR77WorkstationAssessment;
  index: number;
  total: number;
}> = ({ workstation, index, total }) => {
  const roleEvolution = DBR77_ROLE_EVOLUTION[workstation.automationPotential.roleEvolution];

  const getWasteIcon = (wasteId: string) => {
    const icons: Record<string, React.FC<{ className?: string; size?: number }>> = {
      TRANSPORTATION: Package,
      INVENTORY: Package,
      MOTION: Move,
      WAITING: Clock,
      OVERPRODUCTION: PlusCircle,
      OVER_PROCESSING: Settings,
      DEFECTS: XCircle,
      SKILLS: UserX,
    };
    return icons[wasteId] || Package;
  };

  return (
    <div className="bg-white dark:bg-navy-950 p-8 min-h-[calc(100vh-4rem)] print:min-h-0">
      {/* Page Header */}
      <div className="border-b border-slate-200 dark:border-navy-700 pb-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-navy-900 dark:text-white">
                {workstation.name}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {workstation.department} • {workstation.headcount} FTE
              </p>
            </div>
          </div>
          <div className="text-right">
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium bg-${roleEvolution.color}-100 text-${roleEvolution.color}-700`}
            >
              {roleEvolution.name}
            </span>
            <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-1">
              Strona {index + 1} z {total}
            </p>
          </div>
        </div>
      </div>

      {/* Three Phases Grid */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* Phase 1: POMIERZ */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Ruler className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-blue-900 dark:text-blue-300">POMIERZ</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Zadań/dzień:</span>
              <span className="font-bold">{workstation.currentState.tasksPerDay}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Śr. czas zadania:</span>
              <span className="font-bold">{workstation.currentState.avgTaskTime} min</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Błędy:</span>
              <span className="font-bold text-danger-600">
                {workstation.currentState.errorRate}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Nadgodziny:</span>
              <span className="font-bold">{workstation.currentState.overtimeHours}h/tyg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Digital Maturity:</span>
              <span className="font-bold">{workstation.currentState.digitalMaturity}/5</span>
            </div>
          </div>
        </div>

        {/* Phase 2: ZOPTYMALIZUJ */}
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <h3 className="font-bold text-green-900 dark:text-green-300">ZOPTYMALIZUJ</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">5S Level:</span>
              <span className="font-bold">
                {workstation.leanAssessment.workplaceOrganization}/5
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Standard Work:</span>
              <span
                className={`font-bold ${workstation.leanAssessment.standardizedWork ? 'text-green-600' : 'text-danger-600'}`}
              >
                {workstation.leanAssessment.standardizedWork ? 'TAK' : 'NIE'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Cross-Training:</span>
              <span className="font-bold">{workstation.leanAssessment.crossTraining}/5</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Kaizen/miesiąc:</span>
              <span className="font-bold">{workstation.leanAssessment.kaizen}</span>
            </div>
          </div>

          {/* Wastes */}
          {workstation.leanAssessment.wasteInRole.length > 0 && (
            <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-800">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                Zidentyfikowane marnotrawstwa:
              </p>
              <div className="flex flex-wrap gap-1">
                {workstation.leanAssessment.wasteInRole.map((wasteId) => {
                  const waste = DBR77_WASTES.find((w) => w.id === wasteId);
                  return waste ? (
                    <span
                      key={wasteId}
                      className={`px-2 py-0.5 text-xs rounded bg-${waste.color}-100 text-${waste.color}-700`}
                    >
                      {waste.name}
                    </span>
                  ) : null;
                })}
              </div>
            </div>
          )}
        </div>

        {/* Phase 3: AUTOMATYZUJ */}
        <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Cpu className="w-5 h-5 text-primary-600" />
            <h3 className="font-bold text-primary-900 dark:text-primary-300">AUTOMATYZUJ</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">% do automatyzacji:</span>
              <span className="font-bold text-primary-600">
                {workstation.automationPotential.taskAutomationPercent}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">% augmentacji AI:</span>
              <span className="font-bold text-blue-600">
                {workstation.automationPotential.augmentationPercent}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Czas wdrożenia:</span>
              <span className="font-bold">
                {(workstation.automationPotential as any).timeToAutomate || '-'} mies.
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Reskilling:</span>
              <span
                className={`font-bold ${workstation.automationPotential.retrainingNeeded ? 'text-amber-600' : 'text-green-600'}`}
              >
                {workstation.automationPotential.retrainingNeeded ? 'TAK' : 'NIE'}
              </span>
            </div>
          </div>

          {/* Technologies */}
          {workstation.automationPotential.recommendedTechnologies?.length > 0 && (
            <div className="mt-3 pt-3 border-t border-primary-200 dark:border-primary-800">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                Rekomendowane technologie:
              </p>
              <div className="flex flex-wrap gap-1">
                {workstation.automationPotential.recommendedTechnologies.map((techId) => {
                  const tech = DBR77_AUTOMATION_TECHNOLOGIES.find((t) => t.id === techId);
                  return tech ? (
                    <span
                      key={techId}
                      className="px-2 py-0.5 text-xs rounded bg-primary-100 text-primary-700"
                    >
                      {tech.name}
                    </span>
                  ) : null;
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Estimated Savings */}
      <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DollarSign className="w-8 h-8 text-emerald-600" />
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Szacowane oszczędności roczne
            </p>
            <p className="text-2xl font-bold text-emerald-600">
              {(workstation.automationPotential.estimatedSavings || 0).toLocaleString('pl-PL')} PLN
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-500 dark:text-slate-400">Ewolucja roli:</p>
          <p className={`font-bold text-${roleEvolution.color}-600`}>{roleEvolution.name}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-1">
            {roleEvolution.description}
          </p>
        </div>
      </div>

      {/* New Skills Required */}
      {workstation.automationPotential.newSkillsRequired?.length > 0 && (
        <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h4 className="font-bold text-amber-900 dark:text-amber-300">
              Wymagane nowe kompetencje
            </h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {workstation.automationPotential.newSkillsRequired.map((skill, idx: number) => (
              <span
                key={idx}
                className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const DBR77ReportTemplate: React.FC<DBR77ReportTemplateProps> = ({
  data,
  organizationName = 'Organization',
  assessmentDate,
}) => {
  const totalSavings =
    data.workstations.reduce((sum, ws) => sum + (ws.automationPotential.estimatedSavings || 0), 0) +
    data.processes.reduce((sum, p) => sum + (p.automationPotential.estimatedSavings || 0), 0);

  const totalHeadcount = data.workstations.reduce((sum, ws) => sum + ws.headcount, 0);

  return (
    <div className="bg-white dark:bg-navy-950">
      {/* Cover Page */}
      <div className="p-8 min-h-screen flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-6">
            <Zap className="w-10 h-10 text-blue-600" />
          </div>
          <h1 className="text-4xl font-bold text-navy-900 dark:text-white mb-4">
            Lean 4.0 Assessment Report
          </h1>
          <p className="text-xl text-slate-500 dark:text-slate-400 mb-2">
            Metoda DBR77: Pomierz → Zoptymalizuj → Automatyzuj
          </p>
          <p className="text-lg text-slate-500 dark:text-slate-400 dark:text-slate-500">
            {organizationName}
          </p>
          <p className="text-slate-500 dark:text-slate-400 dark:text-slate-500">
            {assessmentDate || new Date().toLocaleDateString('pl-PL')}
          </p>
        </div>

        {/* Legal Notice */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-500/30 rounded-lg p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Metoda DBR77 Lean 4.0</strong> (Pomierz-Zoptymalizuj-Automatyzuj) jest{' '}
            <strong>autorską metodą Consultify</strong>.
          </div>
        </div>
      </div>

      <PageBreak />

      {/* Executive Summary */}
      <div className="p-8 min-h-screen">
        <h2 className="text-2xl font-bold text-navy-900 dark:text-white mb-6 flex items-center gap-2">
          <Target size={24} />
          Podsumowanie Wykonawcze
        </h2>

        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-blue-600">{data.processes.length}</div>
            <div className="text-sm text-blue-600/70">Procesów</div>
          </div>
          <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-primary-600">{data.workstations.length}</div>
            <div className="text-sm text-primary-600/70">Stanowisk</div>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-amber-600">{totalHeadcount}</div>
            <div className="text-sm text-amber-600/70">FTE</div>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-emerald-600">
              {(totalSavings / 1000).toFixed(0)}k
            </div>
            <div className="text-sm text-emerald-600/70">PLN oszczędności/rok</div>
          </div>
        </div>

        {/* Top 5 Automation Targets */}
        <div className="mb-8">
          <h3 className="text-lg font-bold text-navy-900 dark:text-white mb-4">
            Top 5 Stanowisk do Automatyzacji
          </h3>
          <div className="space-y-3">
            {data.workstations
              .sort(
                (a, b) =>
                  (b.automationPotential.estimatedSavings || 0) -
                  (a.automationPotential.estimatedSavings || 0)
              )
              .slice(0, 5)
              .map((ws, idx: number) => (
                <div
                  key={ws.id}
                  className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-navy-900/50 rounded-lg"
                >
                  <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                    <span className="font-bold text-primary-600">{idx + 1}</span>
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-navy-900 dark:text-white">{ws.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {ws.department} • {ws.headcount} FTE
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-emerald-600">
                      {(ws.automationPotential.estimatedSavings || 0).toLocaleString()} PLN
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {ws.automationPotential.taskAutomationPercent}% automatyzacji
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Role Evolution Summary */}
        <div>
          <h3 className="text-lg font-bold text-navy-900 dark:text-white mb-4">Ewolucja Ról</h3>
          <div className="grid grid-cols-4 gap-3">
            {Object.entries(DBR77_ROLE_EVOLUTION).map(([key, config]) => {
              const count = data.workstations.filter(
                (ws: any) => ws.automationPotential.roleEvolution === key
              ).length;
              return (
                <div
                  key={key}
                  className={`p-3 rounded-lg bg-${config.color}-50 dark:bg-${config.color}-900/20 text-center`}
                >
                  <div className={`text-2xl font-bold text-${config.color}-600`}>{count}</div>
                  <div className={`text-xs text-${config.color}-600/70`}>{config.name}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <PageBreak />

      {/* Individual Workstation Pages */}
      {data.workstations.map((ws, idx: number) => (
        <React.Fragment key={ws.id}>
          <WorkstationPage workstation={ws} index={idx} total={data.workstations.length} />
          {idx < data.workstations.length - 1 && <PageBreak />}
        </React.Fragment>
      ))}

      <PageBreak />

      {/* Transformation Roadmap */}
      <div className="bg-white dark:bg-navy-950 p-8">
        <h2 className="text-2xl font-bold text-navy-900 dark:text-white mb-6 flex items-center gap-2">
          <ArrowRight className="text-blue-500" /> Transformation Roadmap
        </h2>
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 font-bold text-sm">
              1
            </div>
            <h3 className="font-bold text-slate-800 dark:text-white">
              Phase 1: Lean Quick Wins (0–30 days)
            </h3>
          </div>
          <div className="ml-10 space-y-2">
            {data.processes
              .filter(
                (p: any) => p.leanAssessment.fiveSLevel < 3 || !p.leanAssessment.standardWorkDefined
              )
              .slice(0, 5)
              .map((p: any) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"
                >
                  <Star className="text-yellow-500 flex-shrink-0" size={14} />
                  <span>
                    {p.name}:{' '}
                    {p.leanAssessment.fiveSLevel < 3
                      ? '5S improvement'
                      : 'Standard work definition'}
                  </span>
                </div>
              ))}
          </div>
        </div>
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 font-bold text-sm">
              2
            </div>
            <h3 className="font-bold text-slate-800 dark:text-white">
              Phase 2: Lean Optimization (30–90 days)
            </h3>
          </div>
          <div className="ml-10 space-y-2">
            {data.processes
              .filter((p: any) => p.leanAssessment.wasteIdentified.length > 0)
              .slice(0, 5)
              .map((p: any) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"
                >
                  <TrendingUp className="text-blue-500 flex-shrink-0" size={14} />
                  <span>
                    {p.name}: Waste elimination ({p.leanAssessment.wasteIdentified.length} wastes)
                  </span>
                </div>
              ))}
          </div>
        </div>
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 font-bold text-sm">
              3
            </div>
            <h3 className="font-bold text-slate-800 dark:text-white">
              Phase 3: Automation & AI (90+ days)
            </h3>
          </div>
          <div className="ml-10 space-y-2">
            {data.processes
              .filter((p: any) => p.automationPotential.feasibility >= 3)
              .sort((a: any, b: any) => b.automationPotential.roi - a.automationPotential.roi)
              .slice(0, 5)
              .map((p: any) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"
                >
                  <Cpu className="text-primary-500 flex-shrink-0" size={14} />
                  <span>
                    {p.name}: {p.automationPotential.recommendedTechnologies.slice(0, 2).join(', ')}{' '}
                    (ROI: {p.automationPotential.roi}%)
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>

      <PageBreak />

      {/* Assessment Conclusions */}
      <div className="bg-white dark:bg-navy-950 p-8">
        <h2 className="text-2xl font-bold text-navy-900 dark:text-white mb-6 flex items-center gap-2">
          <CheckCircle className="text-green-500" /> Assessment Conclusions
        </h2>
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="bg-slate-50 dark:bg-navy-800 rounded-xl p-4">
            <h3 className="font-bold text-slate-800 dark:text-white mb-3">Key Findings</h3>
            <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex items-start gap-2">
                <CheckCircle className="text-green-500 mt-0.5 flex-shrink-0" size={14} />
                <span>
                  {data.processes.length} processes and {data.workstations.length} workstations
                  assessed
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="text-green-500 mt-0.5 flex-shrink-0" size={14} />
                <span>
                  Total headcount:{' '}
                  {data.workstations.reduce((s: number, w: any) => s + w.headcount, 0)} FTE
                </span>
              </div>
              {data.summary?.totalEstimatedSavings > 0 && (
                <div className="flex items-start gap-2">
                  <DollarSign className="text-emerald-500 mt-0.5 flex-shrink-0" size={14} />
                  <span>
                    Estimated savings: {data.summary.totalEstimatedSavings.toLocaleString()} PLN/yr
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-navy-800 rounded-xl p-4">
            <h3 className="font-bold text-slate-800 dark:text-white mb-3">Data Gaps</h3>
            <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              {data.processes
                .filter((p: any) => p.currentState.oee === 0)
                .slice(0, 3)
                .map((p: any) => (
                  <div key={p.id} className="flex items-start gap-2">
                    <Eye className="text-amber-500 mt-0.5 flex-shrink-0" size={14} />
                    <span>{p.name}: OEE not measured</span>
                  </div>
                ))}
              {data.processes.filter((p: any) => p.currentState.oee === 0).length === 0 && (
                <p className="text-slate-500 italic">All key metrics collected</p>
              )}
            </div>
          </div>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-5 border border-blue-200 dark:border-blue-800/30">
          <h3 className="font-bold text-blue-900 dark:text-blue-300 mb-2">Next Steps</h3>
          <div className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
            <div className="flex items-center gap-2">
              <ArrowRight size={14} />
              <span>Approve assessment to unlock initiative generation</span>
            </div>
            <div className="flex items-center gap-2">
              <ArrowRight size={14} />
              <span>Create initiatives from roadmap recommendations</span>
            </div>
            <div className="flex items-center gap-2">
              <ArrowRight size={14} />
              <span>Address data gaps for higher confidence</span>
            </div>
            <div className="flex items-center gap-2">
              <ArrowRight size={14} />
              <span>Schedule follow-up gemba walks</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="p-8 border-t border-slate-200 dark:border-navy-700 text-center text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
        <p>Raport wygenerowany przez Consultify • {new Date().toLocaleDateString('pl-PL')}</p>
        <p className="mt-1">DBR77 Lean 4.0 Assessment • {organizationName}</p>
      </footer>
    </div>
  );
};

export default DBR77ReportTemplate;
