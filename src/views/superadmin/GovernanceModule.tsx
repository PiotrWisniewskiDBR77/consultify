import {
  ClipboardCheck,
  FileArchive,
  FileCheck,
  FileText,
  History,
  Shield,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import { DataExportPanel } from '../../components/SuperAdmin/data/DataExportPanel';
import { Tab, TabLayout } from '../../components/SuperAdmin/TabLayout';
import { InfoButton } from '../../components/shared/InfoButton';
import { useHelpSidePanel } from '../../contexts/HelpContext';
import { Api } from '../../services/api';
import { ComplianceCenterView } from './ComplianceCenterView';
import ApprovalWorkflowsView from './iam/ApprovalWorkflowsView';
import AdminAuditLogsView from './iam/AdminAuditLogsView';
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
  const [overview, setOverview] = useState<{
    auditStats: any;
    approvalWorkflows: any[];
    exportRequests: any[];
  }>({
    auditStats: null,
    approvalWorkflows: [],
    exportRequests: [],
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
        const [auditStats, approvalWorkflows, exportRequests] = await Promise.all([
          Api.getAdminAuditStats(),
          Api.get('/superadmin/admin/approval-workflows'),
          Api.get('/data-export/requests'),
        ]);
        if (cancelled) return;
        setOverview({
          auditStats: auditStats || null,
          approvalWorkflows: approvalWorkflows?.workflows || approvalWorkflows || [],
          exportRequests: exportRequests?.requests || [],
        });
      } catch {
        if (cancelled) return;
        setOverview({
          auditStats: null,
          approvalWorkflows: [],
          exportRequests: [],
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

  const exportStats = useMemo(() => {
    const pending = overview.exportRequests.filter((item) => item.status === 'pending').length;
    const completed = overview.exportRequests.filter((item) => item.status === 'completed').length;
    return { pending, completed };
  }, [overview.exportRequests]);

  const renderOverview = () => (
    <div className="p-6 space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-900">
          <div className="text-xs uppercase tracking-wide text-slate-500">Audit backlog</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
            {overview.auditStats?.unresolved_count ?? 0}
          </div>
          <div className="mt-2 text-xs text-slate-500">Unresolved audit items across the operator plane.</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-900">
          <div className="text-xs uppercase tracking-wide text-slate-500">High risk entries</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
            {overview.auditStats?.high_risk_count ?? 0}
          </div>
          <div className="mt-2 text-xs text-slate-500">Items that still require explicit operator review.</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-900">
          <div className="text-xs uppercase tracking-wide text-slate-500">Approval workflows</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
            {overview.approvalWorkflows.length}
          </div>
          <div className="mt-2 text-xs text-slate-500">Reusable gates for privileged operator decisions.</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-900">
          <div className="text-xs uppercase tracking-wide text-slate-500">Export queue</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
            {exportStats.pending}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {exportStats.completed} completed exports remain available in history.
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
            Governance control intent
          </h3>
          <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <p>
              This branch is the single truth for audit, approvals, exports, retention, and legal
              evidence. It removes the old split between security-only audit views and compliance-only
              views.
            </p>
            <p>
              Use this area when you need operator evidence, policy history, approval state, or data
              governance posture. Other branches should link here instead of duplicating governance UX.
            </p>
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
