/**
 * SuperAdminMetricsView - Conversion Intelligence
 *
 * Redesigned with elegant technological minimalism:
 * - Monochrome metric cards
 * - Clean tables
 * - Subtle progress bars
 */

import { Loader2, RefreshCw } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../services/api';
import { Button } from './components/shared/Button';
import { Card, Section } from './components/shared/Card';
import { SectionHeader } from './components/shared/PageHeader';

export const SuperAdminMetricsView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [funnels, setFunnels] = useState<any>(null);
  const [warnings, setWarnings] = useState<any[]>([]);
  const [attribution, setAttribution] = useState<any>(null);
  const [partners, setPartners] = useState<any[]>([]);
  const [helpMetrics, setHelpMetrics] = useState<any>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [funnelData, warningData, attrData, partnerData, helpData] = await Promise.all([
        Api.getMetricsFunnels(30),
        Api.getMetricsWarnings(),
        Api.getMetricsAttribution(30),
        Api.getMetricsPartners(90),
        Api.getMetricsHelp(30),
      ]);

      setFunnels(funnelData.funnels);
      setWarnings(warningData.warnings);
      setAttribution(attrData);
      setPartners(partnerData.leaderboard);
      setHelpMetrics(helpData);
    } catch (err: any) {
      console.error('Failed to fetch metrics:', err);
      toast.error('Failed to load conversion intelligence data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500 dark:text-slate-400">
        <Loader2 className="animate-spin mr-2" size={20} />
        <span className="text-sm">Loading conversion intelligence...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-5 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Enterprise Analytics & Funnel Monitoring
          </h2>
        </div>
        <Button variant="secondary" icon={RefreshCw} onClick={fetchData}>
          Refresh
        </Button>
      </div>

      {/* Conversion Funnels & Warnings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funnels */}
        <Card variant="bordered" padding="lg">
          <SectionHeader title="Conversion Funnels" subtitle="30-day funnel performance" />
          <div className="space-y-5">
            {funnels &&
              Object.entries(funnels).map(([key, funnel]: [string, any]) => (
                <div key={key}>
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-sm text-slate-600 dark:text-slate-300">
                      {funnel.name}
                    </span>
                    <span className="text-lg font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                      {funnel.conversionRate}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-1000"
                      style={{ width: `${funnel.conversionRate}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <span>{funnel.startCount} started</span>
                    <span>{funnel.endCount} converted</span>
                  </div>
                </div>
              ))}
          </div>
        </Card>

        {/* Early Warnings */}
        <Card variant="bordered" padding="lg">
          <SectionHeader title="Early Warnings" subtitle="Churn risk signals" />
          <div className="space-y-2 max-h-[320px] overflow-y-auto">
            {warnings.length === 0 ? (
              <p className="text-slate-500 dark:text-slate-400 text-sm text-center py-8">
                No critical warnings at this time.
              </p>
            ) : (
              warnings.map((warning, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 border border-slate-100 dark:border-white/[0.04] rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                >
                  <span
                    className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${
                      warning.severity === 'CRITICAL'
                        ? 'bg-danger-400'
                        : warning.severity === 'HIGH'
                          ? 'bg-amber-400'
                          : 'bg-yellow-400'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                        {warning.organizationName || 'Unknown Org'}
                      </p>
                      <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded uppercase">
                        {warning.type}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {warning.message}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Attribution & Partners */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attribution Channels */}
        <Card variant="bordered" padding="lg">
          <SectionHeader title="Attribution Channels" subtitle="Source performance metrics" />
          <div className="overflow-x-auto">
            <table /* §27-exempt: data-viz/render analityczny read-only, nie lista encji */ className="w-full text-left"
            >
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="pb-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Channel
                  </th>
                  <th className="pb-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">
                    Trials
                  </th>
                  <th className="pb-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">
                    Paid
                  </th>
                  <th className="pb-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">
                    Conv. %
                  </th>
                </tr>
              </thead>
              <tbody>
                {attribution?.channels?.map((channel: any, idx: number) => (
                  <tr
                    key={idx}
                    className="border-b border-slate-100 dark:border-white/[0.04] last:border-b-0 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-3 text-sm text-slate-600 dark:text-slate-300">
                      {channel.source}
                    </td>
                    <td className="py-3 text-sm text-slate-700 dark:text-slate-200 text-center tabular-nums">
                      {channel.trials}
                    </td>
                    <td className="py-3 text-sm text-slate-700 dark:text-slate-200 text-center tabular-nums">
                      {channel.conversions}
                    </td>
                    <td className="py-3 text-sm text-right">
                      <span
                        className={`font-semibold tabular-nums ${
                          channel.conversionRate > 20
                            ? 'text-emerald-500 dark:text-emerald-400'
                            : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {channel.conversionRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Partners Leaderboard */}
        <Card variant="bordered" padding="lg">
          <SectionHeader title="Partners Leaderboard" subtitle="Top performing affiliates" />
          <div className="space-y-2">
            {partners.length === 0 ? (
              <p className="text-slate-500 dark:text-slate-400 text-sm text-center py-8">
                No partner data available.
              </p>
            ) : (
              partners.slice(0, 5).map((partner, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 border border-slate-100 dark:border-white/[0.04] rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 text-xs font-semibold">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {partner.partnerName}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {partner.partnerType}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                      ${partner.totalRevenue.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      {partner.orgCount} conversions
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Help Effectiveness */}
      <Section>
        <Card variant="bordered" padding="lg">
          <SectionHeader title="Help Effectiveness" subtitle="Playbook completion metrics" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {helpMetrics?.byPlaybook?.map((playbook: any, idx: number) => (
              <div
                key={idx}
                className="border border-slate-100 dark:border-white/[0.04] rounded-lg p-4 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
              >
                <h3
                  className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate mb-3"
                  title={playbook.playbookKey}
                >
                  {playbook.playbookKey.replace(/_/g, ' ')}
                </h3>
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Completion
                  </span>
                  <span className="text-base font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                    {playbook.completionRate}%
                  </span>
                </div>
                <div className="h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${playbook.completionRate}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-[10px] text-slate-500 dark:text-slate-400">
                  <span>{playbook.started} Started</span>
                  <span>{playbook.completed} Finished</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </Section>
    </div>
  );
};

export default SuperAdminMetricsView;
