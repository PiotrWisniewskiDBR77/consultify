/**
 * MFA View
 * Manages Multi-Factor Authentication for users
 */

import { Key } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState } from '../../../components/Admin/AdminState';
import { Api } from '../../../services/api';
import { normalizeApiErrorMessage } from '../../../utils/apiError';

type UserRow = {
  id: string;
  email: string;
};

type MFAMethodRow = {
  id: string;
  method_type?: string;
  is_enabled?: boolean;
  is_primary?: boolean;
  last_used_at?: string | null;
};

const formatMfaDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleDateString();
};

const asText = (value: unknown, fallback = 'Unknown') => {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
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

export const MFAView: React.FC = () => {
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [mfaMethods, setMfaMethods] = useState<MFAMethodRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  const fetchMFAMethods = useCallback(async () => {
    if (!selectedUserId) return null;
    setLoading(true);
    setLoadError(null);
    try {
      const methods = await Api.getMFAMethods(selectedUserId);
      const normalized = getListPayload<MFAMethodRow>(methods, ['methods', 'items']);
      if (!hasListShape(methods, ['methods', 'items'])) {
        throw new Error('MFA methods response was not a list');
      }
      setMfaMethods(normalized);
      return normalized;
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to fetch MFA methods');
      setMfaMethods([]);
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
      void fetchMFAMethods();
    }
  }, [selectedUserId, fetchMFAMethods]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Multi-Factor Authentication
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
            Manage MFA methods for users
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

      {loadError && <DegradedState title="MFA methods unavailable" description={loadError} />}

      {!selectedUserId ? (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400">
          Select a user to inspect MFA methods
        </div>
      ) : loading ? (
        <div className="text-center py-12 text-slate-600 dark:text-slate-400">Loading...</div>
      ) : loadError ? null : (
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          {mfaMethods.length === 0 ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              No MFA methods configured
            </div>
          ) : (
            <div className="space-y-4">
              {mfaMethods.map((method) => (
                <div
                  key={method.id}
                  className="flex items-center justify-between p-4 bg-slate-50 dark:bg-navy-900 rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        method.is_enabled ? 'bg-green-500/20' : 'bg-slate-100 dark:bg-white/10'
                      }`}
                    >
                      <Key
                        size={20}
                        className={
                          method.is_enabled
                            ? 'text-green-400'
                            : 'text-slate-600 dark:text-slate-400'
                        }
                      />
                    </div>
                    <div>
                      <div className="text-slate-900 dark:text-white font-medium">
                        {asText(method.method_type, 'unknown').toUpperCase()}
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        {method.is_enabled ? 'Enabled' : 'Disabled'}
                        {method.is_primary && ' • Primary'}
                      </div>
                    </div>
                  </div>
                  {method.last_used_at && (
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      Last used: {formatMfaDate(method.last_used_at)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
