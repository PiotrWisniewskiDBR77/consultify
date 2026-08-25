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

import { FilterableTable, type FilterChip } from '../../components/shared/ModuleHub';
import { EntityStatusChip } from '../../components/ui/primitives/chips';
import { Api } from '../../services/api';
import {
  shouldFallbackToLegacyPartner,
  V8PartnerApi,
  type V8PartnerClient,
  type V8PartnerEmployee,
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
  clients?: string[];
  clientCount?: number | null;
  status: string;
  lastActive?: string;
}

/**
 * Detects the stable backend stub response for intentionally non-functional
 * create-actions: HTTP 503 with body { success:false, code:'FEATURE_NOT_AVAILABLE' }.
 * Handles both thrown errors (axios-style) and resolved response bodies.
 */
function isFeatureNotAvailable(input: unknown): boolean {
  if (!input || typeof input !== 'object') return false;
  const obj = input as Record<string, any>;
  const status = obj?.response?.status ?? obj?.status;
  const code = obj?.response?.data?.code ?? obj?.data?.code ?? obj?.code;
  return code === 'FEATURE_NOT_AVAILABLE' || status === 503;
}

type LegacyPartnerClient = Partial<V8PartnerClient> & {
  clientId?: string;
};

type LegacyPartnerEmployee = Partial<V8PartnerEmployee> & {
  first_name?: string;
  last_name?: string;
  userId?: string;
  role?: string;
};

function normalizeClient(client: LegacyPartnerClient): Client {
  return {
    id: String(client.id || client.organizationId || client.clientId || client.name || 'client'),
    clientName: String(
      client.clientName || client.organizationName || client.name || 'Organization'
    ),
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

function normalizeEmployee(employee: LegacyPartnerEmployee): Employee {
  const firstName = typeof employee.first_name === 'string' ? employee.first_name : '';
  const lastName = typeof employee.last_name === 'string' ? employee.last_name : '';
  const combinedName = [firstName, lastName].filter(Boolean).join(' ').trim();

  return {
    id: String(employee.id || employee.userId || employee.email || 'employee'),
    employeeName:
      typeof employee.employeeName === 'string' && employee.employeeName.trim().length > 0
        ? employee.employeeName
        : combinedName || String(employee.email || 'Team Member'),
    email: String(employee.email || ''),
    accessType: String(employee.accessType || employee.role || 'Member'),
    permissionSet:
      typeof employee.permissionSet === 'string'
        ? employee.permissionSet
        : typeof employee.accessType === 'string'
          ? employee.accessType
          : undefined,
    clients: Array.isArray(employee.clients) ? employee.clients.map(String) : undefined,
    clientCount:
      typeof employee.clientCount === 'number' || employee.clientCount === null
        ? employee.clientCount
        : undefined,
    status: typeof employee.status === 'string' ? employee.status.toUpperCase() : 'ACTIVE',
    lastActive: typeof employee.lastActive === 'string' ? employee.lastActive : undefined,
  };
}

export const ClientAccessView: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'clients' | 'employees'>('clients');
  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Canon §5 — per-column filters (status). Source data unchanged.
  const [employeeFilters, setEmployeeFilters] = useState<FilterChip[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
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
      try {
        const employeesResponse = await V8PartnerApi.getEmployees();
        setEmployees((employeesResponse?.employees || []).map(normalizeEmployee));
      } catch (error) {
        if (!shouldFallbackToLegacyPartner(error)) {
          throw error;
        }
        const employeesResponse = await Api.get('/api/partners/employees');
        if (employeesResponse?.success && Array.isArray(employeesResponse?.data)) {
          setEmployees(employeesResponse.data.map(normalizeEmployee));
        }
      }
    } catch (err: any) {
      if (isFeatureNotAvailable(err)) {
        // Stubbed endpoint — present an empty, non-error state rather than a hard failure.
        setError(null);
        return;
      }
      console.error('Error fetching client access data:', err);
      setError(err?.response?.data?.error || t('partner.clientAccess.loadError'));
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
          toast.success(t('partner.clientAccess.linkGenerated'));
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
        toast.success(t('partner.clientAccess.linkGenerated'));
      } else if (isFeatureNotAvailable(response)) {
        toast(t('partner.clientAccess.featureSoon', 'Wkrótce dostępne'));
      } else {
        toast.error(response?.error || t('partner.clientAccess.linkFailed'));
      }
    } catch (err: any) {
      if (isFeatureNotAvailable(err)) {
        toast(t('partner.clientAccess.featureSoon', 'Wkrótce dostępne'));
        return;
      }
      console.error('Error generating access link:', err);
      toast.error(err?.response?.data?.error || t('partner.clientAccess.linkFailed'));
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
        <div className="w-8 h-8 border-4 border-c-border border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error && clients.length === 0 && employees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="p-4 rounded-full bg-danger-500/10 mb-4">
          <Users className="w-8 h-8 text-danger-400" />
        </div>
        <p className="text-slate-500 mb-4">{error}</p>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg text-sm font-medium transition-colors"
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
          {t('partner.clientAccess.title')}
        </h2>
        <p className="text-slate-500">{t('partner.clientAccess.subtitle')}</p>
      </div>

      {/* Tabs - HubSpot Style */}
      <div className="flex items-center justify-between border-b border-c-border-subtle pb-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('clients')}
            className={cn(
              'px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === 'clients'
                ? 'text-slate-900 dark:text-white border-c-border'
                : 'text-slate-500 border-transparent hover:text-slate-900 dark:hover:text-white'
            )}
          >
            {t('partner.clientAccess.clients')}
          </button>
          <button
            onClick={() => setActiveTab('employees')}
            className={cn(
              'px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === 'employees'
                ? 'text-slate-900 dark:text-white border-c-border'
                : 'text-slate-500 border-transparent hover:text-slate-900 dark:hover:text-white'
            )}
          >
            {t('partner.clientAccess.employees')}
          </button>
        </div>
        <button
          onClick={handleGetAccessLink}
          disabled={generatingLink}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-c-text px-4 text-sm font-medium text-c-bg transition-colors hover:bg-c-text-secondary disabled:bg-c-border-strong"
        >
          {generatingLink ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Link2 className="w-4 h-4" />
          )}
          {t('partner.clientAccess.getAccessLink')}
        </button>
      </div>

      {/* Access Link Display */}
      {accessLink && (
        <div className="bg-c-surface-raised border border-c-border rounded-xl p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm text-c-text-secondary mb-1">
                {t('partner.clientAccess.generatedLink')}
              </p>
              <code className="text-sm text-slate-900 dark:text-white bg-slate-50 dark:bg-navy-900/50 px-3 py-1.5 rounded block truncate">
                {accessLink}
              </code>
            </div>
            <button
              onClick={handleCopyLink}
              className="p-2 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg text-white"
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
                    ? 'bg-navy-900 text-white'
                    : 'bg-slate-200 dark:bg-navy-700 text-slate-500 hover:text-slate-900 dark:hover:text-white'
                )}
              >
                {t('partner.clientAccess.allRegions', 'Wszystkie regiony')}
              </button>
              {regions.map((region) => (
                <button
                  key={region}
                  onClick={() => setSelectedRegion(region)}
                  className={cn(
                    'flex items-center gap-1 rounded-full px-4 py-1.5 text-xs font-medium transition',
                    selectedRegion === region
                      ? 'bg-navy-900 text-white'
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
              <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">{t('partner.clientAccess.noClients')}</p>
              <p className="text-sm text-slate-600 mt-1">
                {t('partner.clientAccess.noClientsDesc')}
              </p>
            </div>
          )}
        </div>
      ) : (
        /* Employees Tab */
        <div className="bg-slate-50 dark:bg-navy-800/50 rounded-xl border border-white/5 p-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-500">{t('partner.clientAccess.employeesDesc')}</p>
            {/* MVP: "Add team member" hidden — POST /api/partners/employees is a 503 stub (fast-follow). */}
          </div>

          {/* Employees Table */}
          <FilterableTable
            canvasClassName="p-0"
            persistKey="partner.clientAccess.employees"
            columns={[
              {
                id: 'employeeName',
                label: t('partner.clientAccess.employeeName'),
                render: (employee) => (
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        'w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold',
                        employee.status === 'ACTIVE'
                          ? 'bg-c-surface-raised text-c-text-secondary'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-600'
                      )}
                    >
                      {String(employee.employeeName).substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 dark:text-white flex items-center gap-2 truncate">
                        {employee.employeeName}
                        <span
                          className={cn(
                            'w-2 h-2 shrink-0 rounded-full',
                            employee.status === 'ACTIVE' ? 'bg-c-success' : 'bg-c-warning'
                          )}
                        />
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {employee.status === 'ACTIVE'
                          ? t('partner.clientAccess.statusActive', 'Aktywny')
                          : t('partner.clientAccess.statusDeactivated', 'Dezaktywowany')}{' '}
                        | {employee.email}
                      </p>
                    </div>
                  </div>
                ),
              },
              {
                id: 'permissionSet',
                label: t('partner.clientAccess.permissionSet'),
                width: '180px',
                render: (employee) => (
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    {employee.permissionSet || employee.accessType?.replace('_', ' ') || '--'}
                  </span>
                ),
              },
              {
                id: 'clientCount',
                label: t('partner.clientAccess.totalClients'),
                width: '120px',
                align: 'right',
                render: (employee) => (
                  <span className="text-sm text-slate-900 dark:text-white">
                    {typeof employee.clientCount === 'number'
                      ? employee.clientCount
                      : Array.isArray(employee.clients)
                        ? employee.clients.length
                        : '--'}
                  </span>
                ),
              },
              {
                id: 'status',
                label: t('partner.clientAccess.col.status'),
                width: '130px',
                filterable: true,
                filterOptions: [
                  {
                    value: 'ACTIVE',
                    label: t('partner.clientAccess.statusActive', 'Aktywny'),
                  },
                  {
                    value: 'DEACTIVATED',
                    label: t('partner.clientAccess.statusDeactivated', 'Dezaktywowany'),
                  },
                ],
                render: (employee) => <EntityStatusChip status={String(employee.status)} />,
              },
              {
                id: 'lastActive',
                label: t('partner.clientAccess.lastActive'),
                width: '140px',
                render: (employee) => (
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    {employee.lastActive || '--'}
                  </span>
                ),
              },
            ]}
            data={employees.map((employee) => ({ ...employee, id: employee.id }))}
            activeFilters={employeeFilters}
            onFilterChange={setEmployeeFilters}
            hideRowActions
            emptyMessage={t('partner.clientAccess.noEmployees')}
          />
        </div>
      )}

      {/* PMO Compliance Info */}
      <div className="bg-slate-50 dark:bg-navy-800/50 rounded-xl border border-white/5 p-4">
        <div className="flex items-center gap-3 mb-3">
          <Shield className="w-5 h-5 text-amber-400" />
          <h3 className="font-semibold text-slate-900 dark:text-white">
            {t('partner.clientAccess.compliance')}
          </h3>
        </div>
        <p className="text-sm text-slate-500">{t('partner.clientAccess.complianceDesc')}</p>
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
  const { t } = useTranslation();
  const statusColors: Record<string, string> = {
    ACTIVE: 'bg-emerald-500/20 text-emerald-400',
    PENDING: 'bg-amber-500/20 text-amber-400',
    TRIAL: 'bg-blue-500/20 text-blue-400',
    REVOKED: 'bg-danger-500/20 text-danger-400',
  };

  return (
    <div className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-50/50 dark:bg-navy-900/30 p-4 transition hover:border-c-border">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-c-surface-raised text-sm font-bold text-c-text-secondary">
          {(client.clientName || client.organizationName || 'UN').substring(0, 2).toUpperCase()}
        </div>
        <div>
          <div className="font-medium text-slate-900 dark:text-white">
            {client.clientName || client.organizationName}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-600">
            {client.region && (
              <>
                <MapPin className="w-3 h-3" />
                {client.region}
                <span className="text-slate-600">·</span>
              </>
            )}
            {client.plan && <span>{client.plan}</span>}
            {client.userCount !== undefined && (
              <>
                <span className="text-slate-600">·</span>
                <span>
                  {t('partner.clientAccess.userCount', '{{count}} użytkowników', {
                    count: client.userCount,
                  })}
                </span>
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
