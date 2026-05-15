import {
  AlertTriangle,
  ClipboardCheck,
  FileArchive,
  FileCheck,
  FileText,
  History,
  Shield,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import { InfoButton } from '../../components/shared/InfoButton';
import { DataExportPanel } from '../../components/SuperAdmin/data/DataExportPanel';
import { Tab, TabLayout } from '../../components/SuperAdmin/TabLayout';
import { useHelpSidePanel } from '../../contexts/HelpContext';
import { Api } from '../../services/api';
import { ComplianceCenterView } from './ComplianceCenterView';
import AdminAuditLogsView from './iam/AdminAuditLogsView';
import ApprovalWorkflowsView from './iam/ApprovalWorkflowsView';
import AuditEventsViewer from './iam/AuditEventsViewer';
import { SuperAdminLegalView } from './SuperAdminLegalView';

interface GovernanceModuleProps {
  initialTab?: string;
}

const TAB_HELP_CARDS: Record<string, string> = {
  overview: 'superadmin_governance',
  audit: 'superadmin_security_audit',
  approvals: 'superadmin_security_workflows',
  compliance: 'superadmin_compliance',
  exports: 'superadmin_governance_exports',
  legal: 'superadmin_governance_legal',
};

export const GovernanceModule: React.FC<GovernanceModuleProps> = ({ initialTab }) => {
  const [activeTab, setActiveTab] = useState(initialTab || 'overview');
  const [overviewNotice, setOverviewNotice] = useState<string | null>(null);
  const [overview, setOverview] = useState<{
    audit: any;
    approvals: any;
    sessions: any;
    compliance: any;
    timeline: any[];
  }>({
    audit: null,
    approvals: null,
    sessions: null,
    compliance: null,
    timeline: [],
  });
  const { setHelpDocumentIdOverride } = useHelpSidePanel();

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const mapping: Record<string, string> = {
      overview: 'superadmin_governance',
      audit: 'superadmin_security_audit',
      approvals: 'superadmin_security_workflows',
      compliance: 'superadmin_compliance',
      exports: 'superadmin_governance_exports',
      legal: 'superadmin_governance_legal',
    };
    setHelpDocumentIdOverride(mapping[activeTab] || 'superadmin_governance');
    return () => setHelpDocumentIdOverride(null);
  }, [activeTab, setHelpDocumentIdOverride]);

  useEffect(() => {
    if (activeTab !== 'overview') return;
    let cancelled = false;

    (async () => {
      try {
        setOverviewNotice(null);
        const [operatorOverview, operatorTimeline] = await Promise.all([
          Api.getSuperAdminOperatorOverview(),
          Api.getSuperAdminOperatorTimeline(8),
        ]);
        if (cancelled) return;
        setOverview({
          audit: operatorOverview?.audit || null,
          approvals: operatorOverview?.approvals || null,
          sessions: operatorOverview?.sessions || null,
          compliance: operatorOverview?.compliance || null,
          timeline: operatorTimeline?.items || [],
        });
      } catch {
        if (cancelled) return;
        setOverviewNotice(
          'Operator overview is temporarily unavailable. Showing an empty degraded state.'
        );
        setOverview({
          audit: null,
          approvals: null,
          sessions: null,
          compliance: null,
          timeline: [],
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  const tabs: Tab[] = [
    { id: 'overview', label: 'Overview', icon: <Shield size={16} /> },
    { id: 'audit', label: 'Audit Timeline', icon: <History size={16} /> },
    { id: 'approvals', label: 'Approvals', icon: <ClipboardCheck size={16} /> },
    { id: 'compliance', label: 'Compliance', icon: <FileCheck size={16} /> },
    { id: 'exports', label: 'Exports & Retention', icon: <FileArchive size={16} /> },
    { id: 'legal', label: 'Legal & Policies', icon: <FileText size={16} /> },
  ];

  const renderOverview = () => (
    <div className="p-6 space-y-6">
      {overviewNotice && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
          {overviewNotice}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-900">
          <div className="text-xs uppercase tracking-wide text-slate-500">Audit backlog</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
            {overview.audit?.unresolved ?? 0}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Unresolved audit items across the operator plane.
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-900">
          <div className="text-xs uppercase tracking-wide text-slate-500">Approval queue</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
            {overview.approvals?.pending ?? 0}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Requests waiting for privileged operator decision.
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-900">
          <div className="text-xs uppercase tracking-wide text-slate-500">Privileged sessions</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
            {overview.sessions?.active ?? 0}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Active privileged sessions with visible MFA/JIT posture.
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-900">
          <div className="text-xs uppercase tracking-wide text-slate-500">Compliance posture</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
            {overview.compliance?.legalHolds ?? 0}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {overview.compliance?.residencyReview ?? 0} tenants still need residency review.
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-navy-700 dark:bg-navy-900">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Unified operator lifecycle
          </h3>
          <div className="mt-4 space-y-3 text-sm">
            {[
              'Requested: privileged action enters approval or review queue.',
              'Approved: workflow or operator review clears the action for execution.',
              'Executed: control plane applies the change and writes append-only audit evidence.',
              'Propagated: downstream systems receive the intended policy or control state.',
              'Recovered: rollback or remediation guidance is visible to the operator.',
            ].map((item) => (
              <div
                key={item}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-navy-700 dark:bg-navy-950/40"
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-navy-700 dark:bg-navy-900">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Latest operator timeline
          </h3>
          <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
            {overview.timeline.length === 0 ? (
              <div className="rounded-lg bg-slate-50 px-3 py-3 dark:bg-navy-950/40">
                No operator events available.
              </div>
            ) : (
              overview.timeline.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 dark:border-navy-700 dark:bg-navy-950/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-slate-900 dark:text-white">{item.action}</div>
                    <span className="text-xs uppercase tracking-wide text-slate-500">
                      {item.state}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {item.resourceType} {item.resourceId || ''}{' '}
                    {item.timestamp ? `• ${new Date(item.timestamp).toLocaleString()}` : ''}
                  </div>
                  {item.summary && (
                    <div className="mt-2 flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                      <span>{item.summary}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverview();
      case 'audit':
        return (
          <div className="p-6 space-y-6">
            <AdminAuditLogsView />
            <AuditEventsViewer />
          </div>
        );
      case 'approvals':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <ApprovalWorkflowsView />
          </div>
        );
      case 'compliance':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <ComplianceCenterView />
          </div>
        );
      case 'exports':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <DataExportPanel />
          </div>
        );
      case 'legal':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <SuperAdminLegalView />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <TabLayout
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      title="Governance & Compliance"
      subtitle="Unified audit, approval, export, retention, and legal evidence plane"
      actions={<InfoButton cardId={TAB_HELP_CARDS[activeTab] || 'superadmin_governance'} />}
    >
      {renderContent()}
    </TabLayout>
  );
};

export default GovernanceModule;
