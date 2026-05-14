/**
 * IP Whitelist View
 * Manages IP whitelisting for organizations
 */

import { Plus, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState } from '../../../components/Admin/AdminState';
import { Api } from '../../../services/api';

const IP_WHITELIST_COPY = {
  unavailableTitle: 'IP whitelist unavailable',
  malformedPayload: 'IP whitelist response was not a list',
  addIncomplete: 'IP whitelist addition response was incomplete',
  addNotConfirmed: 'IP whitelist addition was not confirmed by the server',
  removeNotConfirmed: 'IP whitelist removal was not confirmed by the server',
  genericAddFailure: 'Failed to add IP',
  genericRemoveFailure: 'Failed to remove IP',
};

const LEAKY_ERROR_TOKENS = ['sqlstate', '/var/', 'internal:', 'secret', 'stack', 'trace', 'token'];

function safeErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const detail = message.trim();
  if (!detail) return fallback;
  const lowered = detail.toLowerCase();
  if (LEAKY_ERROR_TOKENS.some((token) => lowered.includes(token))) return fallback;
  return detail;
}

function normalizeOrganizationsPayload(payload: unknown): any[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const anyPayload = payload as any;
  return (
    anyPayload.organizations ||
    anyPayload?.data?.organizations ||
    anyPayload?.data?.data?.organizations ||
    []
  );
}

function normalizeWhitelistPayload(payload: unknown): any[] | null {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return null;
  const anyPayload = payload as any;
  const candidates: unknown[] = [
    anyPayload.whitelist,
    anyPayload.items,
    anyPayload.data,
    anyPayload?.data?.whitelist,
    anyPayload?.data?.items,
    anyPayload?.data?.data?.whitelist,
    anyPayload?.data?.data?.items,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return null;
}

function resolveCreatedWhitelistId(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const anyPayload = payload as any;
  const candidates: unknown[] = [
    anyPayload.id,
    anyPayload?.ipWhitelist?.id,
    anyPayload?.data?.id,
    anyPayload?.data?.ipWhitelist?.id,
    anyPayload?.data?.data?.ipWhitelist?.id,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) return candidate.trim();
  }
  return null;
}

export const IPWhitelistView: React.FC = () => {
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [whitelist, setWhitelist] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorTitle, setErrorTitle] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newIP, setNewIP] = useState({ ipAddress: '', ipRange: '', description: '' });

  useEffect(() => {
    fetchOrganizations();
  }, []);

  useEffect(() => {
    if (selectedOrgId) {
      fetchWhitelist();
    }
  }, [selectedOrgId]);

  const fetchOrganizations = async () => {
    try {
      const raw = await Api.getOrganizations();
      const orgs = normalizeOrganizationsPayload(raw);
      setOrganizations(orgs);
      if (orgs.length > 0 && !selectedOrgId) {
        setSelectedOrgId(orgs[0].id);
      }
    } catch (err) {
      setOrganizations([]);
      setSelectedOrgId('');
      setWhitelist([]);
      setErrorTitle(IP_WHITELIST_COPY.unavailableTitle);
      setErrorDetail(safeErrorMessage(err, 'Failed to load organizations.'));
    }
  };

  const fetchWhitelist = async (): Promise<any[] | null> => {
    if (!selectedOrgId) return;
    setLoading(true);
    setErrorTitle(null);
    setErrorDetail(null);
    try {
      const response = await Api.getIPWhitelist(selectedOrgId);
      const normalized = normalizeWhitelistPayload(response);
      if (!normalized) {
        setWhitelist([]);
        setErrorTitle(IP_WHITELIST_COPY.unavailableTitle);
        setErrorDetail(IP_WHITELIST_COPY.malformedPayload);
        return null;
      }
      setWhitelist(normalized);
      return normalized;
    } catch (err) {
      setWhitelist([]);
      setErrorTitle(IP_WHITELIST_COPY.unavailableTitle);
      setErrorDetail(safeErrorMessage(err, 'Failed to fetch IP whitelist'));
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleAddIP = async () => {
    if (!selectedOrgId || !newIP.ipAddress) {
      toast.error('Please select organization and enter IP address');
      return;
    }
    try {
      setErrorTitle(null);
      setErrorDetail(null);
      const previousCount = whitelist.length;
      const addResponse = await Api.addIPWhitelist(selectedOrgId, newIP);
      const createdId = resolveCreatedWhitelistId(addResponse);
      if (!createdId) {
        setErrorTitle(IP_WHITELIST_COPY.unavailableTitle);
        setErrorDetail(IP_WHITELIST_COPY.addIncomplete);
        return;
      }
      const refreshed = await fetchWhitelist();
      const confirmed =
        !!refreshed &&
        (refreshed.some((entry) => String(entry?.id || '') === createdId) ||
          refreshed.length > previousCount);
      if (!confirmed) {
        setErrorTitle(IP_WHITELIST_COPY.unavailableTitle);
        setErrorDetail(IP_WHITELIST_COPY.addNotConfirmed);
        return;
      }
      toast.success('IP added to whitelist');
      setShowAddModal(false);
      setNewIP({ ipAddress: '', ipRange: '', description: '' });
    } catch (err) {
      setErrorTitle(IP_WHITELIST_COPY.unavailableTitle);
      setErrorDetail(safeErrorMessage(err, IP_WHITELIST_COPY.genericAddFailure));
    }
  };

  const handleRemoveIP = async (ipId: string) => {
    if (!confirm('Remove this IP from whitelist?')) return;
    try {
      const targetEntry = whitelist.find((entry) => String(entry?.id || '') === ipId);
      const previousCount = whitelist.length;
      await Api.removeIPWhitelist(selectedOrgId, ipId);
      const refreshed = await fetchWhitelist();
      const confirmed =
        !!refreshed &&
        (!targetEntry
          ? refreshed.length < previousCount
          : refreshed.every((entry) => String(entry?.id || '') !== String(targetEntry.id || '')));

      if (!confirmed) {
        setErrorTitle(IP_WHITELIST_COPY.unavailableTitle);
        setErrorDetail(IP_WHITELIST_COPY.removeNotConfirmed);
        return;
      }
      toast.success('IP removed from whitelist');
    } catch (err) {
      setErrorTitle(IP_WHITELIST_COPY.unavailableTitle);
      setErrorDetail(safeErrorMessage(err, IP_WHITELIST_COPY.genericRemoveFailure));
    }
  };

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
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg flex items-center gap-2"
          >
            <Plus size={18} />
            Add IP
          </button>
        </div>
      </div>

      {errorTitle ? <DegradedState title={errorTitle} description={errorDetail || undefined} /> : null}

      {loading ? (
        <div className="text-center py-12 text-slate-600 dark:text-slate-400">Loading...</div>
      ) : errorTitle ? null : (
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-navy-900 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  IP Address
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  IP Range
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Description
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Status
                </th>
                <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {whitelist.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-slate-500 dark:text-slate-400"
                  >
                    No IP addresses whitelisted
                  </td>
                </tr>
              ) : (
                whitelist.map((ip) => (
                  <tr key={ip.id} className="hover:bg-slate-50 dark:hover:bg-navy-700/50">
                    <td className="px-6 py-4 text-slate-900 dark:text-white">{ip.ip_address}</td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                      {ip.ip_range || '-'}
                    </td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                      {ip.description || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          ip.is_active
                            ? 'bg-green-500/10 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                            : 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300'
                        }`}
                      >
                        {ip.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleRemoveIP(ip.id)}
                        className="text-red-700 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                        aria-label={`Remove IP ${ip.ip_address}`}
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
                className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg"
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
