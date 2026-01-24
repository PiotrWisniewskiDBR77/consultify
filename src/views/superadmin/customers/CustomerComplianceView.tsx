/**
 * CustomerComplianceView - Customer Compliance Management
 */

import { AlertTriangle, CheckCircle2, FileCheck, Loader2, Shield, XCircle } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Card } from '../../../components/Admin/shared/Card';
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
  const [items, setItems] = useState<ComplianceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const summary = await Api.getComplianceSummary();

        const complianceItems: ComplianceItem[] = (summary?.items || summary || []).map(
          (item: any) => ({
            org_id: item.org_id,
            org_name: String(item.org_name || item.name || 'Unknown Organization'),
            gdpr_compliant: !!item.gdpr_compliant,
            dpa_signed: !!item.dpa_signed,
            data_retention_policy: !!item.data_retention_policy,
            security_audit_passed: !!item.security_audit_passed,
            last_audit_date: item.last_audit_date || null,
          })
        );

        // Fallback to organizations if summary empty
        if (complianceItems.length === 0) {
          const orgs = await Api.getOrganizations();
          complianceItems.push(
            ...orgs.map((org: any) => ({
              org_id: org.id,
              org_name: String(org.name || org.organization_name || 'Unknown Organization'),
              gdpr_compliant: !!org.gdpr_compliant,
              dpa_signed: !!org.dpa_signed,
              data_retention_policy: !!org.data_retention_policy,
              security_audit_passed: false,
              last_audit_date: null,
            }))
          );
        }

        const uniqueItems = new Map<string, ComplianceItem>();
        complianceItems.forEach((item) => {
          uniqueItems.set(item.org_id, item);
        });

        setItems(Array.from(uniqueItems.values()));
      } catch (err) {
        console.error('Failed to fetch compliance:', err);
        setItems([]);
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
      <div>
        <h2 className="text-2xl font-bold text-white">Compliance Management</h2>
        <p className="text-gray-400 dark:text-gray-500 dark:text-gray-400 mt-1">
          Track customer compliance status and requirements
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-gray-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{compliantCount}</p>
              <span className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400">
                Fully Compliant
              </span>
            </div>
          </div>
        </Card>
        <Card className="bg-gray-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{atRiskCount}</p>
              <span className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400">
                Requires Attention
              </span>
            </div>
          </div>
        </Card>
        <Card className="bg-gray-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Shield className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {items.filter((i) => i.security_audit_passed).length}
              </p>
              <span className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400">
                Audit Passed
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Compliance Table */}
      <Card className="bg-gray-800 p-4">
        <h3 className="text-lg font-semibold text-white mb-4">Organization Compliance Status</h3>
        <table className="w-full">
          <thead>
            <tr className="text-left text-gray-400 dark:text-gray-500 dark:text-gray-400 text-sm border-b border-gray-700">
              <th className="pb-3">Organization</th>
              <th className="pb-3 text-center">GDPR</th>
              <th className="pb-3 text-center">DPA Signed</th>
              <th className="pb-3 text-center">Data Retention</th>
              <th className="pb-3 text-center">Security Audit</th>
              <th className="pb-3">Last Audit</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.org_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-3 text-white font-medium">{item.org_name}</td>
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
                <td className="py-3 text-gray-400 dark:text-gray-500 dark:text-gray-400 text-sm">
                  {item.last_audit_date
                    ? new Date(item.last_audit_date).toLocaleDateString()
                    : 'Never'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

export default CustomerComplianceView;
