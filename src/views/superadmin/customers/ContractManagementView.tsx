import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Download,
  Edit,
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Card } from '../../../components/Admin/shared/Card';
import { InfoButton } from '../../../components/ui/InfoButton';
import Api from '../../../services/api';

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

  const [newContract, setNewContract] = useState({
    organizationId: '',
    contractType: 'subscription',
    startDate: '',
    endDate: '',
    renewalDate: '',
    value: '',
    currency: 'USD',
    terms: {},
    documentUrl: '',
  });

  useEffect(() => {
    fetchData();
  }, [filterStatus]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [contractsData, statsData, renewalsData] = await Promise.all([
        Api.getCustomerContracts(filterStatus ? { status: filterStatus } : undefined),
        Api.getContractStats(),
        Api.getUpcomingRenewals(30),
      ]);
      setContracts(contractsData || []);
      setStats(statsData as any);
      setUpcomingRenewals(renewalsData || []);
    } catch (error) {
      console.error('Failed to fetch contract data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateContract = async () => {
    if (!newContract.organizationId || !newContract.startDate) return;

    try {
      await Api.createCustomerContract({
        ...newContract,
        value: parseFloat(newContract.value) || 0,
      });
      setShowCreateModal(false);
      setNewContract({
        organizationId: '',
        contractType: 'subscription',
        startDate: '',
        endDate: '',
        renewalDate: '',
        value: '',
        currency: 'USD',
        terms: {},
        documentUrl: '',
      });
      fetchData();
    } catch (error) {
      console.error('Failed to create contract:', error);
    }
  };

  const handleDeleteContract = async (contractId: string) => {
    if (!confirm('Are you sure you want to delete this contract?')) return;

    try {
      await Api.deleteCustomerContract(contractId);
      if (selectedContract?.id === contractId) {
        setSelectedContract(null);
      }
      fetchData();
    } catch (error) {
      console.error('Failed to delete contract:', error);
    }
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
    }).format(value);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
  };

  const getDaysUntil = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - new Date().getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-2xl font-bold text-white">Contract Management</h2>
            <p className="text-gray-400 dark:text-gray-500 dark:text-gray-400 mt-1">
              Manage customer contracts and renewals
            </p>
          </div>
          <InfoButton cardId="superadmin-contracts" />
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value="">All Statuses</option>
            {CONTRACT_STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Contract
          </button>
        </div>
      </div>

      {/* Overview Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <Card className="bg-gray-800 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <FileText className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.total_contracts}</p>
                <span className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400">
                  Total Contracts
                </span>
              </div>
            </div>
          </Card>
          <Card className="bg-gray-800 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.active_contracts}</p>
                <span className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400">
                  Active
                </span>
              </div>
            </div>
          </Card>
          <Card className="bg-gray-800 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <DollarSign className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{formatCurrency(stats.total_value)}</p>
                <span className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400">
                  Total Value
                </span>
              </div>
            </div>
          </Card>
          <Card className="bg-gray-800 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <RefreshCw className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.renewals_30d}</p>
                <span className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400">
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
            <h3 className="text-lg font-semibold text-white">Upcoming Renewals</h3>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {upcomingRenewals.slice(0, 4).map((renewal) => (
              <div key={renewal.id} className="bg-gray-800/50 rounded-lg p-3">
                <p className="text-white font-medium truncate">{renewal.organization_name}</p>
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
          <Card className="bg-gray-800 p-4">
            <h3 className="text-lg font-semibold text-white mb-4">
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
                        : 'bg-gray-700/50 hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-blue-400" />
                        <span className="text-white font-medium truncate">
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
                      <span className="text-gray-400 dark:text-gray-500 dark:text-gray-400">
                        {CONTRACT_TYPES.find((t) => t.id === contract.contract_type)?.label ||
                          contract.contract_type}
                      </span>
                      <span className="text-green-400 font-medium">
                        {formatCurrency(contract.value, contract.currency)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
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
            <Card className="bg-gray-800 p-4">
              {/* Contract Header */}
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-700">
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {selectedContract.organization_name || 'Contract Details'}
                  </h3>
                  <p className="text-gray-400 dark:text-gray-500 dark:text-gray-400 text-sm">
                    {CONTRACT_TYPES.find((t) => t.id === selectedContract.contract_type)?.label}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedContract.document_url && (
                    <a
                      href={selectedContract.document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Document
                    </a>
                  )}
                  <button
                    onClick={() => handleDeleteContract(selectedContract.id)}
                    className="p-2 text-red-400 hover:bg-red-600/20 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Contract Details Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-700/50 rounded-lg p-3">
                  <span className="text-gray-400 dark:text-gray-500 dark:text-gray-400 text-xs">
                    Status
                  </span>
                  <p
                    className={`text-${getStatusColor(selectedContract.status)}-400 font-medium mt-1`}
                  >
                    {getStatusLabel(selectedContract.status)}
                  </p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-3">
                  <span className="text-gray-400 dark:text-gray-500 dark:text-gray-400 text-xs">
                    Contract Value
                  </span>
                  <p className="text-green-400 font-bold text-lg mt-1">
                    {formatCurrency(selectedContract.value, selectedContract.currency)}
                  </p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-3">
                  <span className="text-gray-400 dark:text-gray-500 dark:text-gray-400 text-xs">
                    Start Date
                  </span>
                  <p className="text-white font-medium mt-1">
                    {formatDate(selectedContract.start_date)}
                  </p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-3">
                  <span className="text-gray-400 dark:text-gray-500 dark:text-gray-400 text-xs">
                    End Date
                  </span>
                  <p className="text-white font-medium mt-1">
                    {formatDate(selectedContract.end_date)}
                  </p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-3">
                  <span className="text-gray-400 dark:text-gray-500 dark:text-gray-400 text-xs">
                    Renewal Date
                  </span>
                  <p className="text-white font-medium mt-1">
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
                <div className="bg-gray-700/50 rounded-lg p-3">
                  <span className="text-gray-400 dark:text-gray-500 dark:text-gray-400 text-xs">
                    Currency
                  </span>
                  <p className="text-white font-medium mt-1">{selectedContract.currency}</p>
                </div>
              </div>

              {/* Contract Terms */}
              {selectedContract.terms_json && (
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Contract Terms</h4>
                  <div className="bg-gray-700/50 rounded-lg p-3">
                    <pre className="text-xs text-gray-300 overflow-x-auto">
                      {JSON.stringify(JSON.parse(selectedContract.terms_json || '{}'), null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-300 mb-3">Contract Timeline</h4>
                <div className="relative">
                  <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gray-600" />
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 relative">
                      <div className="w-4 h-4 bg-green-500 rounded-full z-10" />
                      <div>
                        <p className="text-white text-sm">Contract Started</p>
                        <p className="text-gray-400 dark:text-gray-500 dark:text-gray-400 text-xs">
                          {formatDate(selectedContract.start_date)}
                        </p>
                      </div>
                    </div>
                    {selectedContract.renewal_date && (
                      <div className="flex items-center gap-3 relative">
                        <div className="w-4 h-4 bg-yellow-500 rounded-full z-10" />
                        <div>
                          <p className="text-white text-sm">Renewal Due</p>
                          <p className="text-gray-400 dark:text-gray-500 dark:text-gray-400 text-xs">
                            {formatDate(selectedContract.renewal_date)}
                          </p>
                        </div>
                      </div>
                    )}
                    {selectedContract.end_date && (
                      <div className="flex items-center gap-3 relative">
                        <div className="w-4 h-4 bg-red-500 rounded-full z-10" />
                        <div>
                          <p className="text-white text-sm">Contract Ends</p>
                          <p className="text-gray-400 dark:text-gray-500 dark:text-gray-400 text-xs">
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
            <Card className="bg-gray-800 p-8">
              <div className="flex flex-col items-center justify-center h-64">
                <FileText className="w-16 h-16 text-gray-600 dark:text-gray-400 mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Select a Contract</h3>
                <p className="text-gray-400 dark:text-gray-500 dark:text-gray-400 text-center">
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
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-lg">
            <h3 className="text-xl font-bold text-white mb-4">Create New Contract</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Organization ID
                </label>
                <input
                  type="text"
                  value={newContract.organizationId}
                  onChange={(e) =>
                    setNewContract({ ...newContract, organizationId: e.target.value })
                  }
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  placeholder="Enter organization ID"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Contract Type
                </label>
                <select
                  value={newContract.contractType}
                  onChange={(e) => setNewContract({ ...newContract, contractType: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
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
                  <label className="block text-sm font-medium text-gray-300 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={newContract.startDate}
                    onChange={(e) => setNewContract({ ...newContract, startDate: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">End Date</label>
                  <input
                    type="date"
                    value={newContract.endDate}
                    onChange={(e) => setNewContract({ ...newContract, endDate: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Contract Value
                  </label>
                  <input
                    type="number"
                    value={newContract.value}
                    onChange={(e) => setNewContract({ ...newContract, value: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Currency</label>
                  <select
                    value={newContract.currency}
                    onChange={(e) => setNewContract({ ...newContract, currency: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="PLN">PLN</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Renewal Date</label>
                <input
                  type="date"
                  value={newContract.renewalDate}
                  onChange={(e) => setNewContract({ ...newContract, renewalDate: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateContract}
                disabled={!newContract.organizationId || !newContract.startDate}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                Create Contract
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContractManagementView;
