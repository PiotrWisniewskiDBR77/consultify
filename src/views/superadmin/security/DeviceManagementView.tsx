/**
 * Device Management View
 * Manages user devices and device trust
 */

import { Ban, CheckCircle, Shield, Smartphone } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../../services/api';

export const DeviceManagementView: React.FC = () => {
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [users, setUsers] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

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

  const handleBlockDevice = async (deviceId: string, reason: string) => {
    if (!confirm('Block this device?')) return;
    try {
      await Api.blockDevice(deviceId, reason);
      toast.success('Device blocked');
      fetchDevices();
    } catch (err) {
      toast.error('Failed to block device');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Device Management</h2>
          <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">
            Manage and monitor user devices
          </p>
        </div>
        <select
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
          className="bg-navy-800 border border-slate-700 text-white px-4 py-2 rounded-lg"
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
        <div className="text-center py-12">Loading...</div>
      ) : (
        <div className="bg-navy-800 rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-navy-900 border-b border-slate-700">
              <tr>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase">
                  Device
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase">
                  Type
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase">
                  Browser/OS
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase">
                  IP Address
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase">
                  Last Seen
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase">
                  Status
                </th>
                <th className="text-right px-6 py-4 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {devices.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-slate-400 dark:text-slate-500"
                  >
                    No devices found
                  </td>
                </tr>
              ) : (
                devices.map((device) => (
                  <tr key={device.id} className="hover:bg-navy-700/50">
                    <td className="px-6 py-4 text-white">
                      {device.device_name || device.device_id.substring(0, 8)}
                    </td>
                    <td className="px-6 py-4 text-slate-300">{device.device_type || '-'}</td>
                    <td className="px-6 py-4 text-slate-300">
                      {device.browser || '-'} / {device.os || '-'}
                    </td>
                    <td className="px-6 py-4 text-slate-300">{device.ip_address || '-'}</td>
                    <td className="px-6 py-4 text-slate-300">
                      {device.last_seen_at
                        ? new Date(device.last_seen_at).toLocaleDateString()
                        : '-'}
                    </td>
                    <td className="px-6 py-4">
                      {device.is_blocked ? (
                        <span className="px-2 py-1 rounded text-xs bg-red-500/20 text-red-400">
                          Blocked
                        </span>
                      ) : device.is_trusted ? (
                        <span className="px-2 py-1 rounded text-xs bg-green-500/20 text-green-400">
                          Trusted
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded text-xs bg-slate-50 dark:bg-navy-800/300/20 text-slate-400 dark:text-slate-500">
                          Unknown
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {!device.is_blocked && (
                        <button
                          onClick={() => handleBlockDevice(device.id, 'Admin action')}
                          className="text-red-400 hover:text-red-300"
                          title="Block device"
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
