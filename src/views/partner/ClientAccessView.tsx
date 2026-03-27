/**
 * ClientAccessView
 *
 * Client and employee access management with PMO compliance
 * Aligned with RESOURCE_RESPONSIBILITY PMO domain
 *
 * HubSpot-style: Clients / Employees tabs
 */

import {
  Check,
  Copy,
  Link2,
  MapPin,
  Plus,
  RefreshCw,
  Shield,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import {
  shouldFallbackToLegacyPartner,
  V8PartnerApi,
  type V8PartnerClient,
} from '../../services/api/v8';
import { cn } from '../../utils/cn';

interface Client {
  id: string;
  clientName: string;
  organizationName?: string;
  region: string;
  status: string;
  accessLevel: string;
  plan?: string;
  userCount?: number;
}

interface Employee {
  id: string;
  employeeName: string;
  email: string;
  accessType: string;
  permissionSet?: string;
  clients: string[];
  clientCount?: number;
  status: string;
  lastActive?: string;
}

function normalizeClient(client: Partial<V8PartnerClient> | Record<string, any>): Client {
  return {
    id: String(client.id || client.organizationId || client.clientId || client.name || 'client'),
    clientName: String(client.clientName || client.organizationName || client.name || 'Organization'),
    organizationName:
      typeof client.organizationName === 'string'
        ? client.organizationName
        : typeof client.name === 'string'
          ? client.name
          : undefined,
    region: typeof client.region === 'string' ? client.region : '',
    status: typeof client.status === 'string' ? client.status.toUpperCase() : 'ACTIVE',
    accessLevel: typeof client.accessLevel === 'string' ? client.accessLevel : 'partner access',
    plan: typeof client.plan === 'string' ? client.plan : undefined,
    userCount:
      typeof client.userCount === 'number'
        ? client.userCount
        : typeof client.users === 'number'
          ? client.users
          : undefined,
  };
}

export const ClientAccessView: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'clients' | 'employees'>('clients');
  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [showAddTeamMember, setShowAddTeamMember] = useState(false);
  const [accessLink, setAccessLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);

  // Fetch data from API
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch clients
      try {
        const clientsResponse = await V8PartnerApi.getClients();
        setClients((clientsResponse?.clients || []).map(normalizeClient));
      } catch (error) {
        if (!shouldFallbackToLegacyPartner(error)) {
          throw error;
        }
        const clientsResponse = await Api.get('/api/partners/clients');
        if (clientsResponse?.success && Array.isArray(clientsResponse?.data?.data)) {
          setClients(clientsResponse.data.data.map(normalizeClient));
        }
      }

      // Fetch employees
      const employeesResponse = await Api.get('/api/partners/employees');
      if (employeesResponse?.success && employeesResponse?.data) {
        setEmployees(employeesResponse.data);
      }
    } catch (err: any) {
      console.error('Error fetching client access data:', err);
      setError(
        err?.response?.data?.error || t('partner.clientAccess.loadError', 'Failed to load data')
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Generate access link
  const handleGetAccessLink = useCallback(async () => {
    try {
      setGeneratingLink(true);
      try {
        const response = await V8PartnerApi.getReferralTools();
        const referralLink = response?.tools?.referralLink;
        if (typeof referralLink === 'string' && referralLink.length > 0) {
          setAccessLink(referralLink);
          toast.success(t('partner.clientAccess.linkGenerated', 'Access link generated!'));
          return;
        }
      } catch (error) {
        if (!shouldFallbackToLegacyPartner(error)) {
          throw error;
        }
      }

      const response = await Api.get('/api/partners/referral-tools');
      const referralLink = response?.data?.referralLink;
      if (response?.success && typeof referralLink === 'string' && referralLink.length > 0) {
        setAccessLink(referralLink);
        toast.success(t('partner.clientAccess.linkGenerated', 'Access link generated!'));
      } else {
        toast.error(response?.error || t('partner.clientAccess.linkFailed', 'Failed to generate link'));
      }
    } catch (err: any) {
      console.error('Error generating access link:', err);
      toast.error(
        err?.response?.data?.error ||
          t('partner.clientAccess.linkFailed', 'Failed to generate link')
      );
    } finally {
      setGeneratingLink(false);
    }
  }, [t]);

  // Copy access link
  const handleCopyLink = useCallback(async () => {
    if (!accessLink) return;
    try {
      await navigator.clipboard.writeText(accessLink);
      setCopiedLink(true);
      toast.success(t('common.copied', 'Copied to clipboard!'));
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast.error(t('common.copyFailed', 'Failed to copy'));
    }
  }, [accessLink, t]);

  const filteredClients = selectedRegion
    ? clients.filter((c) => c.region === selectedRegion)
    : clients;
  const activeEmployees = employees.filter((e) => e.status === 'ACTIVE');
  const inactiveEmployees = employees.filter((e) => e.status === 'DEACTIVATED');
  const regions = [...new Set(clients.map((c) => c.region).filter(Boolean))];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error && clients.length === 0 && employees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="p-4 rounded-full bg-red-500/10 mb-4">
          <Users className="w-8 h-8 text-red-400" />
        </div>
        <p className="text-slate-500 mb-4">{error}</p>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {t('common.retry', 'Try Again')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header - HubSpot Style */}
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          {t('partner.clientAccess.title', 'Client Access Manager')}
        </h2>
        <p className="text-slate-500">
          {t(
            'partner.clientAccess.subtitle',
            "Manage your employees' client account access from one place"
          )}
        </p>
      </div>

      {/* Tabs - HubSpot Style */}
      <div className="flex items-center justify-between border-b border-white/10 pb-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('clients')}
            className={cn(
              'px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === 'clients'
                ? 'text-slate-900 dark:text-white border-violet-500'
                : 'text-slate-500 border-transparent hover:text-slate-900 dark:hover:text-white'
            )}
          >
            {t('partner.clientAccess.clients', 'Clients')}
          </button>
          <button
            onClick={() => setActiveTab('employees')}
            className={cn(
              'px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === 'employees'
                ? 'text-slate-900 dark:text-white border-violet-500'
                : 'text-slate-500 border-transparent hover:text-slate-900 dark:hover:text-white'
            )}
          >
            {t('partner.clientAccess.employees', 'Employees')}
          </button>
        </div>
        <button
          onClick={handleGetAccessLink}
          disabled={generatingLink}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/50 text-white rounded-lg text-sm font-medium flex items-center gap-2"
        >
          {generatingLink ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Link2 className="w-4 h-4" />
          )}
          {t('partner.clientAccess.getAccessLink', 'Get access link')}
        </button>
      </div>

      {/* Access Link Display */}
      {accessLink && (
        <div className="bg-violet-500/10 border border-violet-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm text-violet-300 mb-1">
                {t('partner.clientAccess.generatedLink', 'Your access link is ready:')}
              </p>
              <code className="text-sm text-slate-900 dark:text-white bg-slate-50 dark:bg-navy-900/50 px-3 py-1.5 rounded block truncate">
                {accessLink}
              </code>
            </div>
            <button
              onClick={handleCopyLink}
              className="p-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-white"
            >
              {copiedLink ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'clients' ? (
        /* Clients Tab */
        <div className="bg-slate-50 dark:bg-navy-800/50 rounded-xl border border-white/5 p-4">
          {/* Filters */}
          {regions.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => setSelectedRegion(null)}
                className={cn(
                  'rounded-full px-4 py-1.5 text-xs font-medium transition',
                  selectedRegion === null
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-200 dark:bg-navy-700 text-slate-500 hover:text-slate-900 dark:hover:text-white'
                )}
              >
                All Regions
              </button>
              {regions.map((region) => (
                <button
                  key={region}
                  onClick={() => setSelectedRegion(region)}
                  className={cn(
                    'flex items-center gap-1 rounded-full px-4 py-1.5 text-xs font-medium transition',
                    selectedRegion === region
                      ? 'bg-violet-600 text-white'
                      : 'bg-slate-200 dark:bg-navy-700 text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  )}
                >
                  <MapPin className="w-3 h-3" />
                  {region}
                </button>
              ))}
            </div>
          )}

          {/* Clients Table/List */}
          {filteredClients.length > 0 ? (
            <div className="space-y-3">
              {filteredClients.map((client) => (
                <ClientRow key={client.id} client={client} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">
                {t('partner.clientAccess.noClients', 'Nobody here')}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                {t('partner.clientAccess.noClientsDesc', "You don't have any client access.")}
              </p>
            </div>
          )}
        </div>
      ) : (
        /* Employees Tab */
        <div className="bg-slate-50 dark:bg-navy-800/50 rounded-xl border border-white/5 p-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-500">
              {t(
                'partner.clientAccess.employeesDesc',
                "Manage your employees' client account access from one place"
              )}
            </p>
            <button
              onClick={() => setShowAddTeamMember(true)}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              {t('partner.clientAccess.addTeamMember', 'Add new team member')}
            </button>
          </div>

          {/* Employees Table */}
          {employees.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left px-3 py-2 text-xs font-medium text-slate-500 uppercase">
                      {t('partner.clientAccess.employeeName', 'Employee Name')}
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-slate-500 uppercase">
                      {t('partner.clientAccess.permissionSet', 'Permission Set')}
                    </th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-slate-500 uppercase">
                      {t('partner.clientAccess.totalClients', 'Total Clients')}
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-slate-500 uppercase">
                      {t('partner.clientAccess.lastActive', 'Last Active')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {employees.map((employee) => (
                    <tr key={employee.id} className="hover:bg-white/5">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold',
                              employee.status === 'ACTIVE'
                                ? 'bg-violet-500/20 text-violet-400'
                                : 'bg-slate-700 text-slate-400'
                            )}
                          >
                            {employee.employeeName.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                              {employee.employeeName}
                              <span
                                className={cn(
                                  'w-2 h-2 rounded-full',
                                  employee.status === 'ACTIVE' ? 'bg-emerald-400' : 'bg-amber-400'
                                )}
                              />
                            </p>
                            <p className="text-xs text-slate-400">
                              {employee.status === 'ACTIVE' ? 'Active' : 'Deactivated'} |{' '}
                              {employee.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-slate-500">
                          {employee.permissionSet || employee.accessType?.replace('_', ' ') || '--'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="text-slate-900 dark:text-white">
                          {employee.clientCount ?? employee.clients?.length ?? 0}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-slate-500">{employee.lastActive || '--'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <UserPlus className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">
                {t('partner.clientAccess.noEmployees', 'No team members yet')}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                {t(
                  'partner.clientAccess.noEmployeesDesc',
                  'Add team members to manage client access.'
                )}
              </p>
            </div>
          )}
        </div>
      )}

      {/* PMO Compliance Info */}
      <div className="bg-slate-50 dark:bg-navy-800/50 rounded-xl border border-white/5 p-4">
        <div className="flex items-center gap-3 mb-3">
          <Shield className="w-5 h-5 text-orange-400" />
          <h3 className="font-semibold text-slate-900 dark:text-white">
            {t('partner.clientAccess.compliance', 'Access Control Compliance')}
          </h3>
        </div>
        <p className="text-sm text-slate-500">
          {t(
            'partner.clientAccess.complianceDesc',
            'All access changes are logged according to PMO domain RESOURCE_RESPONSIBILITY and mapped to ISO 21500 Resource Subject Group (Clause 4.6).'
          )}
        </p>
      </div>
    </div>
  );
};

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface ClientRowProps {
  client: Client;
}

const ClientRow: React.FC<ClientRowProps> = ({ client }) => {
  const statusColors: Record<string, string> = {
    ACTIVE: 'bg-emerald-500/20 text-emerald-400',
    PENDING: 'bg-amber-500/20 text-amber-400',
    TRIAL: 'bg-blue-500/20 text-blue-400',
    REVOKED: 'bg-red-500/20 text-red-400',
  };

  return (
    <div className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-50/50 dark:bg-navy-900/30 p-4 transition hover:border-violet-500/30">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20 text-sm font-bold text-violet-400">
          {(client.clientName || client.organizationName || 'UN').substring(0, 2).toUpperCase()}
        </div>
        <div>
          <div className="font-medium text-slate-900 dark:text-white">
            {client.clientName || client.organizationName}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            {client.region && (
              <>
                <MapPin className="w-3 h-3" />
                {client.region}
                <span className="text-slate-400">·</span>
              </>
            )}
            {client.plan && <span>{client.plan}</span>}
            {client.userCount !== undefined && (
              <>
                <span className="text-slate-400">·</span>
                <span>{client.userCount} users</span>
              </>
            )}
          </div>
        </div>
      </div>
      <span
        className={cn(
          'rounded-full px-2.5 py-1 text-xs font-medium',
          statusColors[client.status] || statusColors.ACTIVE
        )}
      >
        {client.status?.toLowerCase() || 'active'}
      </span>
    </div>
  );
};

export default ClientAccessView;
