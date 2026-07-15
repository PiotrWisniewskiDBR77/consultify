/**
 * IP Whitelist View
 * Manages IP whitelisting for organizations
 */

import { Plus, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState } from '../../../components/Admin/AdminState';
import { StandardTable, type TableColumn, type TableRow } from '../../../components/standard';
import { Api } from '../../../services/api';
import { normalizeApiErrorMessage } from '../../../utils/apiError';

type OrganizationRow = {
  id: string;
  name: string;
};

type IPWhitelistRow = {
  id: string;
  ip_address: string;
  ip_range?: string | null;
  description?: string | null;
  is_active?: boolean;
};

type JsonRecord = Record<string, unknown> & {
  data?: JsonRecord | unknown[];
};

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null;

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

const getCreatedIPWhitelistId = (result: unknown) => {
  if (!isRecord(result)) return '';
  const data = isRecord(result.data) ? result.data : null;
  const nestedData = data && isRecord(data.data) ? data.data : null;
  const ipWhitelist = isRecord(result.ipWhitelist) ? result.ipWhitelist : null;
  return String(
    result.id ||
      ipWhitelist?.id ||
      data?.id ||
      (isRecord(data?.ipWhitelist) ? data.ipWhitelist.id : '') ||
      nestedData?.id ||
      (isRecord(nestedData?.ipWhitelist) ? nestedData.ipWhitelist.id : '') ||
      ''
  );
};

// canon TRIADA §27 — StandardTable columns. Kebab (actions) is auto-appended
// by StandardTable itself; it is intentionally NOT declared here.
const buildColumns = (): TableColumn[] => [
  {
    id: 'ip_address',
    label: 'IP Address',
    sortable: true,
    sortAccessor: (row: TableRow) => String((row as unknown as IPWhitelistRow).ip_address || ''),
    render: (row: TableRow) => (
      <span className="text-slate-900 dark:text-white">
        {(row as unknown as IPWhitelistRow).ip_address}
      </span>
    ),
  },
  {
    id: 'ip_range',
    label: 'IP Range',
    render: (row: TableRow) => (
      <span className="text-slate-700 dark:text-slate-300">
        {(row as unknown as IPWhitelistRow).ip_range || '-'}
      </span>
    ),
  },
  {
    id: 'description',
    label: 'Description',
    render: (row: TableRow) => (
      <span className="text-slate-700 dark:text-slate-300">
        {(row as unknown as IPWhitelistRow).description || '-'}
      </span>
    ),
  },
  {
    id: 'status',
    label: 'Status',
    render: (row: TableRow) => {
      const isActive = (row as unknown as IPWhitelistRow).is_active;
      return (
        <span
          className={`px-2 py-1 rounded text-xs ${
            isActive
              ? 'bg-green-500/10 text-green-700 dark:bg-green-500/20 dark:text-green-400'
              : 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300'
          }`}
        >
          {isActive ? 'Active' : 'Inactive'}
        </span>
      );
    },
  },
];

export const IPWhitelistView: React.FC = () => {
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [organizations, setOrganizations] = useState<OrganizationRow[]>([]);
  const [whitelist, setWhitelist] = useState<IPWhitelistRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newIP, setNewIP] = useState({ ipAddress: '', ipRange: '', description: '' });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isValidIpOrCidr = (value: string) => {
    const trimmed = value.trim();
    const [ip, prefix] = trimmed.split('/');
    const parts = ip.split('.').map(Number);
    const validIp =
      parts.length === 4 &&
      parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255);
    if (!validIp) return false;
    if (prefix === undefined) return true;
    const prefixNumber = Number(prefix);
    return Number.isInteger(prefixNumber) && prefixNumber >= 0 && prefixNumber <= 32;
  };

  const fetchOrganizations = useCallback(async () => {
    try {
      const orgs = await Api.getOrganizations();
      const normalizedOrgs = getListPayload<OrganizationRow>(orgs, ['organizations', 'items']);
      if (!hasListShape(orgs, ['organizations', 'items'])) {
        throw new Error('Organizations response was not a list');
      }
      setOrganizations(normalizedOrgs);
      setSelectedOrgId((current) => current || normalizedOrgs[0]?.id || '');
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to fetch organizations');
      setLoadError(message);
      toast.error(message);
    }
  }, []);

  const fetchWhitelist = useCallback(async (): Promise<IPWhitelistRow[] | null> => {
    if (!selectedOrgId) return null;
    setLoading(true);
    setLoadError(null);
    try {
      const list = await Api.getIPWhitelist(selectedOrgId);
      const normalizedList = getListPayload<IPWhitelistRow>(list, [
        'whitelist',
        'ipWhitelist',
        'items',
      ]);
      if (!hasListShape(list, ['whitelist', 'ipWhitelist', 'items'])) {
        throw new Error('IP whitelist response was not a list');
      }
      setWhitelist(normalizedList);
      return normalizedList;
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to fetch IP whitelist');
      setWhitelist([]);
      setLoadError(message);
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [selectedOrgId]);

  useEffect(() => {
    void fetchOrganizations();
  }, [fetchOrganizations]);

  useEffect(() => {
    if (selectedOrgId) {
      void fetchWhitelist();
    }
  }, [selectedOrgId, fetchWhitelist]);

  const handleAddIP = async () => {
    if (!selectedOrgId || !newIP.ipAddress) {
      toast.error('Please select organization and enter IP address');
      return;
    }
    if (!isValidIpOrCidr(newIP.ipAddress)) {
      toast.error('Enter a valid IPv4 address');
      return;
    }
    if (newIP.ipRange && !isValidIpOrCidr(newIP.ipRange)) {
      toast.error('Enter a valid IPv4 CIDR range');
      return;
    }
    try {
      setActionError(null);
      const result = await Api.addIPWhitelist(selectedOrgId, newIP);
      const createdId = getCreatedIPWhitelistId(result);
      if (!createdId) {
        throw new Error('IP whitelist addition response was incomplete');
      }
      const refreshed = await fetchWhitelist();
      if (!refreshed?.some((item) => item.id === createdId)) {
        throw new Error('IP whitelist addition was not confirmed by the server');
      }
      toast.success('IP added to whitelist');
      setShowAddModal(false);
      setNewIP({ ipAddress: '', ipRange: '', description: '' });
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to add IP');
      setActionError(message);
      toast.error(message);
    }
  };

  const handleRemoveIP = async (ipId: string) => {
    if (!confirm('Remove this IP from whitelist?')) return;
    try {
      setActionError(null);
      const target = whitelist.find((item) => item.id === ipId);
      await Api.removeIPWhitelist(selectedOrgId, ipId);
      const refreshed = await fetchWhitelist();
      if (!refreshed || refreshed.some((item) => item.id === (target?.id || ipId))) {
        throw new Error('IP whitelist removal was not confirmed by the server');
      }
      toast.success('IP removed from whitelist');
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to remove IP');
      setActionError(message);
      toast.error(message);
    }
  };

  const columns = useMemo(() => buildColumns(), []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">IP Whitelist</h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
            Manage IP addresses allowed to access organization accounts
          </p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={selectedOrgId}
            onChange={(e) => setSelectedOrgId(e.target.value)}
            className="bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-4 py-2 rounded-lg"
          >
            <option value="">Select Organization</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowAddModal(true)}
            disabled={!selectedOrgId || Boolean(loadError)}
            className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg flex items-center gap-2"
          >
            <Plus size={18} />
            Add IP
          </button>
        </div>
      </div>

      {loadError && <DegradedState title="IP whitelist unavailable" description={loadError} />}

      {actionError && (
        <div
          role="alert"
          className="rounded-lg border border-danger-200 dark:border-danger-500/20 bg-danger-50 dark:bg-danger-500/10 p-4 text-sm text-danger-700 dark:text-danger-300"
        >
          {actionError}
        </div>
      )}

      {loadError ? null : (
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <StandardTable
            columns={columns}
            data={whitelist as unknown as TableRow[]}
            loading={loading}
            empty={{ title: 'No IP addresses whitelisted' }}
            rowMenu={(row) => {
              const ip = row as unknown as IPWhitelistRow;
              return {
                destructive: {
                  icon: Trash2,
                  onClick: () => void handleRemoveIP(ip.id),
                },
              };
            }}
          />
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-navy-800 rounded-xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
              Add IP to Whitelist
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-700 dark:text-slate-300 mb-2">
                  IP Address *
                </label>
                <input
                  type="text"
                  value={newIP.ipAddress}
                  onChange={(e) => setNewIP({ ...newIP, ipAddress: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-4 py-2 rounded-lg"
                  placeholder="192.168.1.1"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-700 dark:text-slate-300 mb-2">
                  IP Range (CIDR)
                </label>
                <input
                  type="text"
                  value={newIP.ipRange}
                  onChange={(e) => setNewIP({ ...newIP, ipRange: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-4 py-2 rounded-lg"
                  placeholder="192.168.1.0/24"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-700 dark:text-slate-300 mb-2">
                  Description
                </label>
                <input
                  type="text"
                  value={newIP.description}
                  onChange={(e) => setNewIP({ ...newIP, description: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-4 py-2 rounded-lg"
                  placeholder="Office network"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-navy-700"
              >
                Cancel
              </button>
              <button
                onClick={handleAddIP}
                className="flex-1 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg"
              >
                Add IP
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
