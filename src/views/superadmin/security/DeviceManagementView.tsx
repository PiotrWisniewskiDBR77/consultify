/**
 * Device Management View
 * Manages user devices and device trust
 */

import { Ban } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState } from '../../../components/Admin/AdminState';
import { Api } from '../../../services/api';
import { normalizeApiErrorMessage } from '../../../utils/apiError';

type UserRow = {
  id: string;
  email: unknown;
};

type DeviceRow = {
  id: string;
  device_id?: unknown;
  device_name?: unknown;
  device_type?: unknown;
  browser?: unknown;
  os?: unknown;
  ip_address?: unknown;
  last_seen_at?: unknown;
  is_blocked?: boolean;
  is_trusted?: boolean;
};

const asText = (value: unknown, fallback: string) => {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
};

const formatDeviceDate = (value?: unknown) => {
  if (!value) return '-';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleDateString();
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

const normalizeDevices = (payload: unknown): DeviceRow[] => {
  const normalized = getListPayload<DeviceRow>(payload, ['devices', 'items']);
  if (hasListShape(payload, ['devices', 'items'])) {
    return normalized;
  }
  throw new Error('Devices response was not a list');
};

const getDeviceLabel = (device: DeviceRow) => {
  if (device.device_name) return asText(device.device_name, 'Unknown device');
  if (device.device_id) return asText(device.device_id, 'Unknown device').substring(0, 8);
  return 'Unknown device';
};

export const DeviceManagementView: React.FC = () => {
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const blockUnavailableMessage =
    'Device blocking is unavailable: the backend only exposes read-only device inventory in this environment.';

  const fetchUsers = useCallback(async () => {
    try {
      const userList = await Api.getSuperAdminUsers();
      const normalizedUsers = getListPayload<UserRow>(userList, ['users', 'items']);
      if (!hasListShape(userList, ['users', 'items'])) {
        throw new Error('Users response was not a list');
      }
      setUsers(normalizedUsers);
      setSelectedUserId((current) => current || normalizedUsers[0]?.id || '');
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to fetch users');
      setLoadError(message);
      toast.error(message);
    }
  }, []);

  const fetchDevices = useCallback(async () => {
    if (!selectedUserId) return null;
    setLoading(true);
    setLoadError(null);
    try {
      const deviceList = await Api.getUserDevices(selectedUserId);
      const normalized = normalizeDevices(deviceList);
      setDevices(normalized);
      return normalized;
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to fetch devices');
      setDevices([]);
      setLoadError(message);
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [selectedUserId]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (selectedUserId) {
      void fetchDevices();
    }
  }, [selectedUserId, fetchDevices]);

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
              {asText(user.email, 'Unknown user')}
            </option>
          ))}
        </select>
      </div>

      {loadError && <DegradedState title="Device inventory unavailable" description={loadError} />}

      {loading ? (
        <div className="text-center py-12 text-slate-600 dark:text-slate-400">Loading...</div>
      ) : loadError ? null : (
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
            Device inventory is read-only. Blocking requires a configured device management backend.
          </div>
          <table
            /* §27-todo: lista encji → migracja do FilterableTable + Menu 1/2/3 (kanon §2); swiadomie oznaczona, nie przepisana w tej sesji */ className="w-full"
          >
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
                      {getDeviceLabel(device)}
                    </td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                      {asText(device.device_type, '-')}
                    </td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                      {asText(device.browser, '-')} / {asText(device.os, '-')}
                    </td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                      {asText(device.ip_address, '-')}
                    </td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                      {formatDeviceDate(device.last_seen_at)}
                    </td>
                    <td className="px-6 py-4">
                      {device.is_blocked ? (
                        <span className="px-2 py-1 rounded text-xs bg-danger-500/10 text-danger-700 dark:bg-danger-500/20 dark:text-danger-400">
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
                          aria-label={`Block device ${device.id}`}
                          className="text-slate-600 cursor-not-allowed opacity-60"
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
