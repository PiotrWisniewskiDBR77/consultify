/**
 * CustomerComplianceView - Customer Compliance Management
 */

import { AlertTriangle, CheckCircle2, FileCheck, Loader2, Shield, XCircle } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '../../../components/Admin/shared/Card';
import { InfoButton } from '../../../components/shared/InfoButton';
import Api from '../../../services/api';

interface ComplianceItem {
  org_id: string;
  org_name: string;
  gdpr_compliant: boolean;
  dpa_signed: boolean;
  data_retention_policy: boolean;
  security_audit_passed: boolean;
  last_audit_date: string | null;
}

const CustomerComplianceView: React.FC = () => {
  const { t } = useTranslation();
  const [items, setItems] = useState<ComplianceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const summary = await Api.getComplianceSummary();

        const complianceItems: ComplianceItem[] = (summary?.items || summary || []).map(
          (item: any) => ({
            org_id: item.org_id,
            org_name: String(
              item.org_name || item.name || t('superadmin.customers.compliance.unknownOrganization')
            ),
            gdpr_compliant: !!item.gdpr_compliant,
            dpa_signed: !!item.dpa_signed,
            data_retention_policy: !!item.data_retention_policy,
            security_audit_passed: !!item.security_audit_passed,
            last_audit_date: item.last_audit_date || null,
          })
        );

        const uniqueItems = new Map<string, ComplianceItem>();
        complianceItems.forEach((item) => {
          uniqueItems.set(item.org_id, item);
        });

        setItems(Array.from(uniqueItems.values()));
      } catch (err) {
        console.error('Failed to fetch compliance:', err);
        setItems([]);
        setError(t('superadmin.customers.compliance.errorLoad'));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  const compliantCount = items.filter((i) => i.gdpr_compliant && i.dpa_signed).length;
  const atRiskCount = items.filter((i) => !i.gdpr_compliant || !i.dpa_signed).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            {t('superadmin.customers.compliance.title')}
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            {t('superadmin.customers.compliance.subtitle')}
          </p>
        </div>
        <InfoButton cardId="superadmin-compliance-customers" />
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-300 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{compliantCount}</p>
              <span className="text-xs text-slate-600 dark:text-slate-400">
                {t('superadmin.customers.compliance.stats.fullyCompliant')}
              </span>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{atRiskCount}</p>
              <span className="text-xs text-slate-600 dark:text-slate-400">
                {t('superadmin.customers.compliance.stats.requiresAttention')}
              </span>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Shield className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {items.filter((i) => i.security_audit_passed).length}
              </p>
              <span className="text-xs text-slate-600 dark:text-slate-400">
                {t('superadmin.customers.compliance.stats.auditPassed')}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Compliance Table */}
      <Card padding="sm">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          {t('superadmin.customers.compliance.table.title')}
        </h3>
        {items.length === 0 ? (
          <div className="py-10 text-center text-slate-600 dark:text-slate-400">
            {t('superadmin.customers.compliance.table.empty')}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left text-slate-500 dark:text-slate-400 text-sm border-b border-slate-200 dark:border-white/10">
                <th className="pb-3">
                  {t('superadmin.customers.compliance.table.columns.organization')}
                </th>
                <th className="pb-3 text-center">
                  {t('superadmin.customers.compliance.table.columns.gdpr')}
                </th>
                <th className="pb-3 text-center">
                  {t('superadmin.customers.compliance.table.columns.dpa')}
                </th>
                <th className="pb-3 text-center">
                  {t('superadmin.customers.compliance.table.columns.dataRetention')}
                </th>
                <th className="pb-3 text-center">
                  {t('superadmin.customers.compliance.table.columns.securityAudit')}
                </th>
                <th className="pb-3">
                  {t('superadmin.customers.compliance.table.columns.lastAudit')}
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.org_id}
                  className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5"
                >
                  <td className="py-3 text-slate-900 dark:text-white font-medium">
                    {item.org_name}
                  </td>
                  <td className="py-3 text-center">
                    {item.gdpr_compliant ? (
                      <CheckCircle2 className="w-5 h-5 text-green-400 mx-auto" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400 mx-auto" />
                    )}
                  </td>
                  <td className="py-3 text-center">
                    {item.dpa_signed ? (
                      <CheckCircle2 className="w-5 h-5 text-green-400 mx-auto" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400 mx-auto" />
                    )}
                  </td>
                  <td className="py-3 text-center">
                    {item.data_retention_policy ? (
                      <CheckCircle2 className="w-5 h-5 text-green-400 mx-auto" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400 mx-auto" />
                    )}
                  </td>
                  <td className="py-3 text-center">
                    {item.security_audit_passed ? (
                      <CheckCircle2 className="w-5 h-5 text-green-400 mx-auto" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400 mx-auto" />
                    )}
                  </td>
                  <td className="py-3 text-slate-600 dark:text-slate-400 text-sm">
                    {item.last_audit_date
                      ? new Date(item.last_audit_date).toLocaleDateString()
                      : t('superadmin.customers.compliance.table.never')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
};

export default CustomerComplianceView;
