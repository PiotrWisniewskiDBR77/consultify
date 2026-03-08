/**
 * MFA View
 * Manages Multi-Factor Authentication for users
 */

import { Key } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../../services/api';

export const MFAView: React.FC = () => {
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [users, setUsers] = useState<any[]>([]);
  const [mfaMethods, setMfaMethods] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      fetchMFAMethods();
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

  const fetchMFAMethods = async () => {
    if (!selectedUserId) return;
    setLoading(true);
    try {
      const methods = await Api.getMFAMethods(selectedUserId);
      const normalized = Array.isArray(methods)
        ? methods
        : (methods as any)?.methods || (methods as any)?.items || [];
      setMfaMethods(normalized);
    } catch (err) {
      toast.error('Failed to fetch MFA methods');
    } finally {
      setLoading(false);
    }
  };

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
              {user.email}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-600 dark:text-slate-400">Loading...</div>
      ) : (
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
                        {method.method_type.toUpperCase()}
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        {method.is_enabled ? 'Enabled' : 'Disabled'}
                        {method.is_primary && ' • Primary'}
                      </div>
                    </div>
                  </div>
                  {method.last_used_at && (
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      Last used: {new Date(method.last_used_at).toLocaleDateString()}
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
