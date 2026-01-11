/**
 * PartnerDashboardView
 *
 * Main partner dashboard with ecosystem analytics and PMO compliance
 * Aligned with ISO 21500 / PMBOK 7 / PRINCE2
 */

import React, { useCallback } from 'react';

import { EcosystemAnalytics } from '../../components/Partner/EcosystemAnalytics';
import { TrustProgressionIndicator } from '../../components/Partner/TrustProgressionIndicator';
import { usePartnerEcosystem } from '../../hooks/usePartnerEcosystem';
import { useAppStore } from '../../store/useAppStore';
import { AppView } from '../../types';

export const PartnerDashboardView: React.FC = () => {
  const { setCurrentView } = useAppStore();
  const { metrics, trustProgression, currentTrustPhase, loading, getComplianceScore } =
    usePartnerEcosystem();

  const handleNavigate = useCallback(
    (view: AppView) => () => setCurrentView(view),
    [setCurrentView]
  );

  const complianceScore = getComplianceScore();

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-navy-950">
      <div className="space-y-6 px-6 py-4">
        {/* Trust Progression (Compact) */}
        <div className="rounded-xl border border-slate-200 bg-white/90 p-4 dark:border-navy-700 dark:bg-navy-900/60">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-navy-900 dark:text-white">
              Trust Progression
            </div>
            <button
              onClick={handleNavigate(AppView.PARTNER_PROVIDER_HOME)}
              className="text-xs font-semibold text-brand hover:underline"
            >
              View Details →
            </button>
          </div>
          <TrustProgressionIndicator
            trustProgression={trustProgression}
            currentPhase={currentTrustPhase}
            compact
          />
        </div>

        {/* Ecosystem Analytics */}
        <EcosystemAnalytics metrics={metrics} complianceScore={complianceScore} loading={loading} />

        {/* Quick Navigation */}
        <div className="grid gap-4 md:grid-cols-3">
          <QuickNavCard
            title="Commission"
            description="View statements, payments i submit inquiries"
            onClick={handleNavigate(AppView.PARTNER_COMMISSION)}
          />
          <QuickNavCard
            title="Client Access"
            description="Manage client and employee access"
            onClick={handleNavigate(AppView.PARTNER_CLIENT_ACCESS)}
          />
          <QuickNavCard
            title="Directory"
            description="Update your partner profile"
            onClick={handleNavigate(AppView.PARTNER_DIRECTORY)}
          />
        </div>

        {/* PMO Compliance Note */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-navy-700 dark:bg-navy-900/40">
          <h3 className="text-sm font-semibold text-navy-900 dark:text-white">
            PMO Standards Compliance
          </h3>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Wszystkie działania partnerskie są mapowane na standardy ISO 21500, PMBOK 7 i PRINCE2.
            Każdy deal, statement i decyzja otrzymuje automatyczny audit trail z przypisaniem do
            odpowiedniego PMO domain.
          </p>
          <ul className="mt-3 space-y-2 text-xs text-slate-600 dark:text-slate-300">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
              <span>
                <strong>GOVERNANCE_DECISION_MAKING</strong> — Deal registration i approval
              </span>
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
              <span>
                <strong>BENEFITS_REALIZATION</strong> — Commission tracking i settlements
              </span>
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
              <span>
                <strong>RESOURCE_RESPONSIBILITY</strong> — Client access management
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface QuickNavCardProps {
  title: string;
  description: string;
  onClick: () => void;
}

const QuickNavCard: React.FC<QuickNavCardProps> = ({ title, description, onClick }) => (
  <button
    onClick={onClick}
    className="flex flex-col rounded-xl border border-slate-200 bg-white/90 p-4 text-left transition hover:border-brand/30 hover:shadow-md dark:border-navy-700 dark:bg-navy-900/60"
  >
    <div className="font-semibold text-navy-900 dark:text-white">{title}</div>
    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</div>
  </button>
);

export default PartnerDashboardView;
