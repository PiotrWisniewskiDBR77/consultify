import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  DollarSign,
  Download,
  Edit,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState } from '../../../components/Admin/AdminState';
import { InfoButton } from '../../../components/shared/InfoButton';
import { LoadingState } from '../../../components/ui/primitives';
import Api from '../../../services/api';
import { normalizeApiErrorMessage } from '../../../utils/apiError';
import { Card } from '../components/shared/Card';

interface Contract {
  id: string;
  organization_id: string;
  organization_name?: string;
  contract_type: string;
  start_date: string;
  end_date?: string;
  renewal_date?: string;
  value: number;
  currency: string;
  status: string;
  terms_json?: string;
  document_url?: string;
  created_at: string;
  updated_at: string;
}

interface ContractStats {
  total_contracts: number;
  active_contracts: number;
  total_value: number;
  renewals_30d: number;
}

interface UpcomingRenewal {
  id: string;
  organization_name: string;
  renewal_date: string;
  value: number;
  days_until: number;
}

type ContractData = {
  contracts: Contract[];
  stats: ContractStats;
  renewals: UpcomingRenewal[];
};

const safeParseTerms = (terms?: string) => {
  try {
    return JSON.parse(terms || '{}');
  } catch {
    return {};
  }
};

type JsonRecord = Record<string, unknown> & {
  data?: JsonRecord | unknown[];
};

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null;

const safeNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getObjectPayload = (value: unknown) => {
  if (!isRecord(value)) return value;
  const data = isRecord(value.data) ? value.data : null;
  return data && isRecord(data.data) ? data.data : data || value;
};

const getListPayload = <T,>(value: unknown, keys: string[]): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (!isRecord(value)) return [];
  const data = isRecord(value.data) ? value.data : null;
  const nestedData = data && isRecord(data.data) ? data.data : null;
  const candidates = [value, data, nestedData].filter(isRecord);
  for (const candidate of candidates) {
    if (Array.isArray(candidate.data)) return candidate.data as T[];
    for (const key of keys) {
      if (Array.isArray(candidate[key])) return candidate[key] as T[];
    }
  }
  return [];
};

const hasListShape = (value: unknown, keys: string[]) => {
  if (Array.isArray(value)) return true;
  if (!isRecord(value)) return false;
  const data = isRecord(value.data) ? value.data : null;

  return (
    'data' in value ||
    keys.some((key) => key in value) ||
    Boolean(data && keys.some((key) => key in data))
  );
};

const normalizeStats = (value: unknown): ContractStats => {
  const payload = getObjectPayload(value);
  const statsValue = isRecord(payload) ? payload : {};
  return {
    active_contracts: safeNumber(statsValue.active_contracts),
    renewals_30d: safeNumber(statsValue.renewals_30d),
    total_contracts: safeNumber(statsValue.total_contracts),
    total_value: safeNumber(statsValue.total_value),
  };
};

const normalizeContract = (contract: Contract): Contract => ({
  ...contract,
  value: safeNumber(contract.value),
});

const normalizeRenewal = (renewal: UpcomingRenewal): UpcomingRenewal => ({
  ...renewal,
  days_until: safeNumber(renewal.days_until),
  value: safeNumber(renewal.value),
});

const getCreatedContractId = (value: unknown) => {
  if (!isRecord(value)) return '';
  const data = isRecord(value.data) ? value.data : null;
  const nestedData = data && isRecord(data.data) ? data.data : null;
  const contract = isRecord(value.contract) ? value.contract : null;
  return String(
    value.id ||
      contract?.id ||
      data?.id ||
      (isRecord(data?.contract) ? data.contract.id : '') ||
      nestedData?.id ||
      (isRecord(nestedData?.contract) ? nestedData.contract.id : '') ||
      ''
  );
};

const CONTRACT_TYPES = [
  { id: 'subscription', label: 'Subscription Agreement' },
  { id: 'enterprise', label: 'Enterprise License' },
  { id: 'service', label: 'Service Agreement' },
  { id: 'nda', label: 'Non-Disclosure Agreement' },
  { id: 'sla', label: 'Service Level Agreement' },
  { id: 'master', label: 'Master Service Agreement' },
];

const CONTRACT_STATUSES = [
  { id: 'draft', label: 'Draft', color: 'gray' },
  { id: 'active', label: 'Active', color: 'green' },
  { id: 'pending', label: 'Pending', color: 'yellow' },
  { id: 'expired', label: 'Expired', color: 'red' },
  { id: 'terminated', label: 'Terminated', color: 'red' },
];

const ContractManagementView: React.FC = () => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [stats, setStats] = useState<ContractStats | null>(null);
  const [upcomingRenewals, setUpcomingRenewals] = useState<UpcomingRenewal[]>([]);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [newContract, setNewContract] = useState({
    organizationId: '',
    contractType: 'subscription',
    startDate: '',
    endDate: '',
    renewalDate: '',
    value: '',
    currency: 'USD',
    status: 'active',
    terms: {},
    documentUrl: '',
  });

  const fetchData = useCallback(async (): Promise<ContractData | null> => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [contractsData, statsData, renewalsData] = await Promise.all([
        Api.getCustomerContracts(filterStatus ? { status: filterStatus } : undefined),
        Api.getContractStats(),
        Api.getUpcomingRenewals(30),
      ]);
      if (
        !hasListShape(contractsData, ['contracts', 'items']) ||
        !hasListShape(renewalsData, ['renewals', 'items'])
      ) {
        throw new Error('Contract response was missing list data');
      }
      const nextContracts = getListPayload<Contract>(contractsData, ['contracts', 'items']).map(
        normalizeContract
      );
      const nextRenewals = getListPayload<UpcomingRenewal>(renewalsData, ['renewals', 'items']).map(
        normalizeRenewal
      );
      const nextStats = normalizeStats(statsData);
      setContracts(nextContracts);
      setStats(nextStats);
      setUpcomingRenewals(nextRenewals);
      return { contracts: nextContracts, stats: nextStats, renewals: nextRenewals };
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Failed to fetch contract data');
      setContracts([]);
      setStats(null);
      setUpcomingRenewals([]);
      setLoadError(message);
      toast.error(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleCreateContract = async () => {
    const value = Number(newContract.value);
    if (!newContract.organizationId.trim() || !newContract.startDate) {
      toast.error('Organization and start date are required');
      return;
    }
    if (!Number.isFinite(value) || value < 0) {
      toast.error('Contract value must be a non-negative number');
      return;
    }

    try {
      setIsSaving(true);
      setActionError(null);
      const payload = {
        ...newContract,
        organizationId: newContract.organizationId.trim(),
        value,
      };
      if (editingContract) {
        await Api.updateCustomerContract(editingContract.id, payload);
        const refreshed = await fetchData();
        if (
          !refreshed?.contracts.some(
            (contract) => contract.id === editingContract.id && contract.value === value
          )
        ) {
          throw new Error('Contract update was not confirmed by the server');
        }
        toast.success('Contract updated');
      } else {
        const result = await Api.createCustomerContract(payload);
        const createdId = getCreatedContractId(result);
        const refreshed = await fetchData();
        if (
          !refreshed?.contracts.some(
            (contract) =>
              (createdId && contract.id === createdId) ||
              (contract.organization_id === payload.organizationId &&
                contract.contract_type === payload.contractType &&
                contract.value === value)
          )
        ) {
          throw new Error('Contract creation was not confirmed by the server');
        }
        toast.success('Contract created');
      }
      setShowCreateModal(false);
      setEditingContract(null);
      setNewContract({
        organizationId: '',
        contractType: 'subscription',
        startDate: '',
        endDate: '',
        renewalDate: '',
        value: '',
        currency: 'USD',
        status: 'active',
        terms: {},
        documentUrl: '',
      });
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Failed to save contract');
      setActionError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteContract = async (contractId: string) => {
    if (!confirm('Are you sure you want to delete this contract?')) return;

    try {
      setIsSaving(true);
      setActionError(null);
      await Api.deleteCustomerContract(contractId);
      const refreshed = await fetchData();
      if (!refreshed || refreshed.contracts.some((contract) => contract.id === contractId)) {
        throw new Error('Contract deletion was not confirmed by the server');
      }
      toast.success('Contract deleted');
      if (selectedContract?.id === contractId) {
        setSelectedContract(null);
      }
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Failed to delete contract');
      setActionError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const resetContractForm = () => {
    setNewContract({
      organizationId: '',
      contractType: 'subscription',
      startDate: '',
      endDate: '',
      renewalDate: '',
      value: '',
      currency: 'USD',
      status: 'active',
      terms: {},
      documentUrl: '',
    });
  };

  const openCreateContract = () => {
    setEditingContract(null);
    resetContractForm();
    setShowCreateModal(true);
  };

  const openEditContract = (contract: Contract) => {
    setEditingContract(contract);
    setNewContract({
      organizationId: contract.organization_id,
      contractType: contract.contract_type || 'subscription',
      startDate: contract.start_date || '',
      endDate: contract.end_date || '',
      renewalDate: contract.renewal_date || '',
      value: String(contract.value ?? ''),
      currency: contract.currency || 'USD',
      status: contract.status || 'active',
      terms: safeParseTerms(contract.terms_json),
      documentUrl: contract.document_url || '',
    });
    setShowCreateModal(true);
  };

  const getStatusColor = (status: string) => {
    const statusInfo = CONTRACT_STATUSES.find((s) => s.id === status);
    return statusInfo?.color || 'gray';
  };

  const getStatusLabel = (status: string) => {
    const statusInfo = CONTRACT_STATUSES.find((s) => s.id === status);
    return statusInfo?.label || status;
  };

  const formatCurrency = (value: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(safeNumber(value));
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleDateString();
  };

  const getDaysUntil = (dateStr: string) => {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return 'unknown';
    const diff = date.getTime() - new Date().getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  if (isLoading) {
    return <LoadingState variant="spinner" className="h-64" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Contract Management
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Manage customer contracts and renewals
            </p>
          </div>
          <InfoButton cardId="superadmin-contracts" />
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            disabled={Boolean(loadError)}
            className="bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm"
          >
            <option value="">All Statuses</option>
            {CONTRACT_STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            onClick={openCreateContract}
            disabled={Boolean(loadError)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Contract
          </button>
        </div>
      </div>

      {loadError && (
        <DegradedState title="Contract management unavailable" description={loadError} />
      )}

      {actionError && (
        <div
          role="alert"
          className="rounded-lg border border-danger-200 dark:border-danger-500/20 bg-danger-50 dark:bg-danger-500/10 p-4 text-sm text-danger-700 dark:text-danger-300"
        >
          {actionError}
        </div>
      )}

      {loadError ? null : (
        <>
          {/* Overview Stats */}
          {stats && (
            <div className="grid grid-cols-4 gap-4">
              <Card padding="sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <FileText className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {stats.total_contracts}
                    </p>
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      Total Contracts
                    </span>
                  </div>
                </div>
              </Card>
              <Card padding="sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {stats.active_contracts}
                    </p>
                    <span className="text-xs text-slate-600 dark:text-slate-400">Active</span>
                  </div>
                </div>
              </Card>
              <Card padding="sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-500/20 rounded-lg">
                    <DollarSign className="w-5 h-5 text-primary-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {formatCurrency(stats.total_value)}
                    </p>
                    <span className="text-xs text-slate-600 dark:text-slate-400">Total Value</span>
                  </div>
                </div>
              </Card>
              <Card padding="sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-500/20 rounded-lg">
                    <RefreshCw className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {stats.renewals_30d}
                    </p>
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      Renewals (30d)
                    </span>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Upcoming Renewals Alert */}
          {upcomingRenewals.length > 0 && (
            <Card className="bg-yellow-500/10 border border-yellow-500/30 p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Upcoming Renewals
                </h3>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {upcomingRenewals.slice(0, 4).map((renewal) => (
                  <div
                    key={renewal.id}
                    className="bg-white/60 dark:bg-white/5 rounded-lg p-3 border border-yellow-500/20"
                  >
                    <p className="text-slate-900 dark:text-white font-medium truncate">
                      {renewal.organization_name}
                    </p>
                    <p className="text-yellow-400 text-sm">
                      {renewal.days_until} days • {formatCurrency(renewal.value)}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div className="grid grid-cols-12 gap-6">
            {/* Contracts List */}
            <div className="col-span-5">
              <Card padding="sm">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  Contracts ({contracts.length})
                </h3>
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {contracts.length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="w-12 h-12 text-gray-600 dark:text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-500 dark:text-gray-400 text-sm">No contracts found</p>
                    </div>
                  ) : (
                    contracts.map((contract) => (
                      <div
                        key={contract.id}
                        onClick={() => setSelectedContract(contract)}
                        className={`p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedContract?.id === contract.id
                            ? 'bg-blue-600/20 border border-blue-500'
                            : 'bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-blue-400" />
                            <span className="text-slate-900 dark:text-white font-medium truncate">
                              {contract.organization_name || 'Unknown'}
                            </span>
                          </div>
                          <span
                            className={`text-xs px-2 py-1 rounded bg-${getStatusColor(contract.status)}-500/20 text-${getStatusColor(contract.status)}-400`}
                          >
                            {getStatusLabel(contract.status)}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-400">
                            {CONTRACT_TYPES.find((t) => t.id === contract.contract_type)?.label ||
                              contract.contract_type}
                          </span>
                          <span className="text-green-400 font-medium">
                            {formatCurrency(contract.value, contract.currency)}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <Calendar className="w-3 h-3" />
                          <span>
                            {formatDate(contract.start_date)} - {formatDate(contract.end_date)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>

            {/* Contract Details */}
            <div className="col-span-7">
              {selectedContract ? (
                <Card padding="sm">
                  {/* Contract Header */}
                  <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-200 dark:border-white/10">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                        {selectedContract.organization_name || 'Contract Details'}
                      </h3>
                      <p className="text-slate-600 dark:text-slate-400 text-sm">
                        {CONTRACT_TYPES.find((t) => t.id === selectedContract.contract_type)?.label}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedContract.document_url && (
                        <a
                          href={selectedContract.document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-navy-900 dark:hover:bg-navy-700 text-slate-800 dark:text-white px-3 py-2 rounded-lg text-sm transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          Document
                        </a>
                      )}
                      <button
                        onClick={() => openEditContract(selectedContract)}
                        aria-label={`Edit customer contract ${selectedContract.id}`}
                        className="p-2 text-slate-500 hover:text-blue-500 hover:bg-blue-600/10 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteContract(selectedContract.id)}
                        aria-label={`Delete customer contract ${selectedContract.id}`}
                        className="p-2 text-danger-400 hover:bg-danger-600/20 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Contract Details Grid */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-slate-50 dark:bg-white/5 rounded-lg p-3 border border-slate-200 dark:border-white/10">
                      <span className="text-slate-500 dark:text-slate-400 text-xs">Status</span>
                      <p
                        className={`text-${getStatusColor(selectedContract.status)}-400 font-medium mt-1`}
                      >
                        {getStatusLabel(selectedContract.status)}
                      </p>
                    </div>
                    <div className="bg-slate-50 dark:bg-white/5 rounded-lg p-3 border border-slate-200 dark:border-white/10">
                      <span className="text-slate-500 dark:text-slate-400 text-xs">
                        Contract Value
                      </span>
                      <p className="text-green-400 font-bold text-lg mt-1">
                        {formatCurrency(selectedContract.value, selectedContract.currency)}
                      </p>
                    </div>
                    <div className="bg-slate-50 dark:bg-white/5 rounded-lg p-3 border border-slate-200 dark:border-white/10">
                      <span className="text-slate-500 dark:text-slate-400 text-xs">Start Date</span>
                      <p className="text-slate-900 dark:text-white font-medium mt-1">
                        {formatDate(selectedContract.start_date)}
                      </p>
                    </div>
                    <div className="bg-slate-50 dark:bg-white/5 rounded-lg p-3 border border-slate-200 dark:border-white/10">
                      <span className="text-slate-500 dark:text-slate-400 text-xs">End Date</span>
                      <p className="text-slate-900 dark:text-white font-medium mt-1">
                        {formatDate(selectedContract.end_date)}
                      </p>
                    </div>
                    <div className="bg-slate-50 dark:bg-white/5 rounded-lg p-3 border border-slate-200 dark:border-white/10">
                      <span className="text-slate-500 dark:text-slate-400 text-xs">
                        Renewal Date
                      </span>
                      <p className="text-slate-900 dark:text-white font-medium mt-1">
                        {selectedContract.renewal_date ? (
                          <>
                            {formatDate(selectedContract.renewal_date)}
                            <span className="text-yellow-400 text-xs ml-2">
                              ({getDaysUntil(selectedContract.renewal_date)} days)
                            </span>
                          </>
                        ) : (
                          '-'
                        )}
                      </p>
                    </div>
                    <div className="bg-slate-50 dark:bg-white/5 rounded-lg p-3 border border-slate-200 dark:border-white/10">
                      <span className="text-slate-500 dark:text-slate-400 text-xs">Currency</span>
                      <p className="text-slate-900 dark:text-white font-medium mt-1">
                        {selectedContract.currency}
                      </p>
                    </div>
                  </div>

                  {/* Contract Terms */}
                  {selectedContract.terms_json && (
                    <div>
                      <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Contract Terms
                      </h4>
                      <div className="bg-slate-50 dark:bg-white/5 rounded-lg p-3 border border-slate-200 dark:border-white/10">
                        <pre className="text-xs text-slate-700 dark:text-slate-300 overflow-x-auto">
                          {JSON.stringify(safeParseTerms(selectedContract.terms_json), null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Timeline */}
                  <div className="mt-6">
                    <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                      Contract Timeline
                    </h4>
                    <div className="relative">
                      <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-gray-600" />
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 relative">
                          <div className="w-4 h-4 bg-green-500 rounded-full z-10" />
                          <div>
                            <p className="text-slate-900 dark:text-white text-sm">
                              Contract Started
                            </p>
                            <p className="text-slate-600 dark:text-slate-400 text-xs">
                              {formatDate(selectedContract.start_date)}
                            </p>
                          </div>
                        </div>
                        {selectedContract.renewal_date && (
                          <div className="flex items-center gap-3 relative">
                            <div className="w-4 h-4 bg-yellow-500 rounded-full z-10" />
                            <div>
                              <p className="text-slate-900 dark:text-white text-sm">Renewal Due</p>
                              <p className="text-slate-600 dark:text-slate-400 text-xs">
                                {formatDate(selectedContract.renewal_date)}
                              </p>
                            </div>
                          </div>
                        )}
                        {selectedContract.end_date && (
                          <div className="flex items-center gap-3 relative">
                            <div className="w-4 h-4 bg-danger-500 rounded-full z-10" />
                            <div>
                              <p className="text-slate-900 dark:text-white text-sm">
                                Contract Ends
                              </p>
                              <p className="text-slate-600 dark:text-slate-400 text-xs">
                                {formatDate(selectedContract.end_date)}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ) : (
                <Card padding="lg">
                  <div className="flex flex-col items-center justify-center h-64">
                    <FileText className="w-16 h-16 text-gray-600 dark:text-gray-400 mb-4" />
                    <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                      Select a Contract
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 text-center">
                      Choose a contract from the list to view details
                    </p>
                  </div>
                </Card>
              )}
            </div>
          </div>

          {/* Create Contract Modal */}
          {showCreateModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-navy-800 rounded-xl p-6 w-full max-w-lg border border-slate-200 dark:border-navy-700">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                  {editingContract ? 'Edit Contract' : 'Create New Contract'}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Organization ID
                    </label>
                    <input
                      type="text"
                      value={newContract.organizationId}
                      onChange={(e) =>
                        setNewContract({ ...newContract, organizationId: e.target.value })
                      }
                      className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
                      placeholder="Enter organization ID"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Contract Type
                    </label>
                    <select
                      value={newContract.contractType}
                      onChange={(e) =>
                        setNewContract({ ...newContract, contractType: e.target.value })
                      }
                      className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
                    >
                      {CONTRACT_TYPES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={newContract.startDate}
                        onChange={(e) =>
                          setNewContract({ ...newContract, startDate: e.target.value })
                        }
                        className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={newContract.endDate}
                        onChange={(e) =>
                          setNewContract({ ...newContract, endDate: e.target.value })
                        }
                        className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Contract Value
                      </label>
                      <input
                        type="number"
                        value={newContract.value}
                        onChange={(e) => setNewContract({ ...newContract, value: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Currency
                      </label>
                      <select
                        value={newContract.currency}
                        onChange={(e) =>
                          setNewContract({ ...newContract, currency: e.target.value })
                        }
                        className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
                      >
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="GBP">GBP</option>
                        <option value="PLN">PLN</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Status
                    </label>
                    <select
                      value={newContract.status}
                      onChange={(e) => setNewContract({ ...newContract, status: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
                    >
                      {CONTRACT_STATUSES.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Renewal Date
                    </label>
                    <input
                      type="date"
                      value={newContract.renewalDate}
                      onChange={(e) =>
                        setNewContract({ ...newContract, renewalDate: e.target.value })
                      }
                      className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setEditingContract(null);
                    }}
                    className="px-4 py-2 border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateContract}
                    disabled={
                      !newContract.organizationId.trim() || !newContract.startDate || isSaving
                    }
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : editingContract ? 'Save Contract' : 'Create Contract'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ContractManagementView;
