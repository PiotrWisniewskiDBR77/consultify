/**
 * Device Management View
 * Manages user devices and device trust
 */

import { Ban } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../../services/api';

export const DeviceManagementView: React.FC = () => {
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [users, setUsers] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const blockUnavailableMessage =
    'Device blocking is unavailable: the backend only exposes read-only device inventory in this environment.';

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      fetchDevices();
    }
  }, [selectedUserId]);

  const fetchUsers = async () => {
    try {
      const userList = await Api.getSuperAdminUsers();
      setUsers(userList);
      if (userList.length > 0 && !selectedUserId) {
        setSelectedUserId(userList[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  const fetchDevices = async () => {
    if (!selectedUserId) return;
    setLoading(true);
    try {
      const deviceList = await Api.getUserDevices(selectedUserId);
      setDevices(deviceList);
    } catch (err) {
      toast.error('Failed to fetch devices');
    } finally {
      setLoading(false);
    }
  };

  const handleBlockDevice = (_deviceId: string, _reason: string) => {
    toast.error(blockUnavailableMessage);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Device Management</h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
            Manage and monitor user devices
          </p>
        </div>
        <select
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
          className="bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-4 py-2 rounded-lg"
        >
          <option value="">Select User</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.email}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-600 dark:text-slate-400">Loading...</div>
      ) : (
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
            Device inventory is read-only. Blocking requires a configured device management backend.
          </div>
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-navy-900 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Device
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Type
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Browser/OS
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  IP Address
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Last Seen
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
              {devices.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-slate-500 dark:text-slate-400"
                  >
                    No devices found
                  </td>
                </tr>
              ) : (
                devices.map((device) => (
                  <tr key={device.id} className="hover:bg-slate-50 dark:hover:bg-navy-700/50">
                    <td className="px-6 py-4 text-slate-900 dark:text-white">
                      {device.device_name || device.device_id.substring(0, 8)}
                    </td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                      {device.device_type || '-'}
                    </td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                      {device.browser || '-'} / {device.os || '-'}
                    </td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                      {device.ip_address || '-'}
                    </td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                      {device.last_seen_at
                        ? new Date(device.last_seen_at).toLocaleDateString()
                        : '-'}
                    </td>
                    <td className="px-6 py-4">
                      {device.is_blocked ? (
                        <span className="px-2 py-1 rounded text-xs bg-red-500/10 text-red-700 dark:bg-red-500/20 dark:text-red-400">
                          Blocked
                        </span>
                      ) : device.is_trusted ? (
                        <span className="px-2 py-1 rounded text-xs bg-green-500/10 text-green-700 dark:bg-green-500/20 dark:text-green-400">
                          Trusted
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded text-xs bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300">
                          Unknown
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {!device.is_blocked && (
                        <button
                          onClick={() => handleBlockDevice(device.id, 'Admin action')}
                          disabled
                          className="text-slate-400 cursor-not-allowed opacity-60"
                          title={blockUnavailableMessage}
                        >
                          <Ban size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
