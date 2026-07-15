/**
 * Device Management View
 * Manages user devices and device trust
 */

import { Ban } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState } from '../../../components/Admin/AdminState';
import { StandardTable, type TableColumn, type TableRow } from '../../../components/standard';
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

// canon TRIADA §27 — StandardTable columns. Kebab (actions) is auto-appended
// by StandardTable itself; it is intentionally NOT declared here.
const buildColumns = (): TableColumn[] => [
  {
    id: 'device',
    label: 'Device',
    sortable: true,
    sortAccessor: (row: TableRow) => getDeviceLabel(row as unknown as DeviceRow),
    render: (row: TableRow) => (
      <span className="text-slate-900 dark:text-white">
        {getDeviceLabel(row as unknown as DeviceRow)}
      </span>
    ),
  },
  {
    id: 'device_type',
    label: 'Type',
    render: (row: TableRow) => (
      <span className="text-slate-700 dark:text-slate-300">
        {asText((row as unknown as DeviceRow).device_type, '-')}
      </span>
    ),
  },
  {
    id: 'browserOs',
    label: 'Browser/OS',
    render: (row: TableRow) => {
      const device = row as unknown as DeviceRow;
      return (
        <span className="text-slate-700 dark:text-slate-300">
          {asText(device.browser, '-')} / {asText(device.os, '-')}
        </span>
      );
    },
  },
  {
    id: 'ip_address',
    label: 'IP Address',
    render: (row: TableRow) => (
      <span className="text-slate-700 dark:text-slate-300">
        {asText((row as unknown as DeviceRow).ip_address, '-')}
      </span>
    ),
  },
  {
    id: 'last_seen_at',
    label: 'Last Seen',
    sortable: true,
    sortAccessor: (row: TableRow) => String((row as unknown as DeviceRow).last_seen_at || ''),
    render: (row: TableRow) => (
      <span className="text-slate-700 dark:text-slate-300">
        {formatDeviceDate((row as unknown as DeviceRow).last_seen_at)}
      </span>
    ),
  },
  {
    id: 'status',
    label: 'Status',
    render: (row: TableRow) => {
      const device = row as unknown as DeviceRow;
      if (device.is_blocked) {
        return (
          <span className="px-2 py-1 rounded text-xs bg-danger-500/10 text-danger-700 dark:bg-danger-500/20 dark:text-danger-400">
            Blocked
          </span>
        );
      }
      if (device.is_trusted) {
        return (
          <span className="px-2 py-1 rounded text-xs bg-green-500/10 text-green-700 dark:bg-green-500/20 dark:text-green-400">
            Trusted
          </span>
        );
      }
      return (
        <span className="px-2 py-1 rounded text-xs bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300">
          Unknown
        </span>
      );
    },
  },
];

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

  const columns = useMemo(() => buildColumns(), []);

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

      {loadError ? null : (
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
            Device inventory is read-only. Blocking requires a configured device management backend.
          </div>
          <StandardTable
            columns={columns}
            data={devices as unknown as TableRow[]}
            loading={loading}
            empty={{ title: 'No devices found' }}
            rowMenu={(row) => {
              const device = row as unknown as DeviceRow;
              return {
                primary: device.is_blocked
                  ? []
                  : [
                      {
                        id: 'block',
                        label: 'Block device',
                        icon: Ban,
                        disabled: true,
                        note: blockUnavailableMessage,
                        onClick: () => handleBlockDevice(device.id, 'Admin action'),
                      },
                    ],
              };
            }}
          />
        </div>
      )}
    </div>
  );
};
