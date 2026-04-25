/**
 * IP Whitelist View
 * Manages IP whitelisting for organizations
 */

import { Plus, Search, Shield, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../../services/api';

export const IPWhitelistView: React.FC = () => {
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [whitelist, setWhitelist] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newIP, setNewIP] = useState({ ipAddress: '', ipRange: '', description: '' });
  const [loadError, setLoadError] = useState<string | null>(null);

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
      const orgs = await Api.getOrganizations();
      setOrganizations(orgs);
      if (orgs.length > 0 && !selectedOrgId) {
        setSelectedOrgId(orgs[0].id);
      }
    } catch (err: any) {
      console.error('Failed to fetch organizations:', err);
      setLoadError(err?.message || 'Failed to fetch organizations');
      toast.error(err?.message || 'Failed to fetch organizations');
    }
  };

  const fetchWhitelist = async () => {
    if (!selectedOrgId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const list = await Api.getIPWhitelist(selectedOrgId);
      setWhitelist(list);
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to fetch IP whitelist');
      toast.error(err?.message || 'Failed to fetch IP whitelist');
    } finally {
      setLoading(false);
    }
  };

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
      await Api.addIPWhitelist(selectedOrgId, newIP);
      toast.success('IP added to whitelist');
      setShowAddModal(false);
      setNewIP({ ipAddress: '', ipRange: '', description: '' });
      fetchWhitelist();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add IP');
    }
  };

  const handleRemoveIP = async (ipId: string) => {
    if (!confirm('Remove this IP from whitelist?')) return;
    try {
      await Api.removeIPWhitelist(selectedOrgId, ipId);
      toast.success('IP removed from whitelist');
      fetchWhitelist();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to remove IP');
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
            disabled={!selectedOrgId}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg flex items-center gap-2"
          >
            <Plus size={18} />
            Add IP
          </button>
        </div>
      </div>

      {loadError && (
        <div className="rounded-lg border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
          {loadError}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-600 dark:text-slate-400">Loading...</div>
      ) : (
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
