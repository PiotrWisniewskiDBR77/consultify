import {
  AlertCircle,
  Check,
  Clock,
  Database,
  FileText,
  HardDrive,
  Mail,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  Shield,
  Table,
  Trash2,
  Users,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { ReadOnlyState } from '../../components/Admin/AdminState';
import { InfoButton } from '../../components/shared/InfoButton';
import type {
  StandardRowMenu,
  TableColumn,
  TableRow,
} from '../../components/standard/StandardTable';
import { StandardTable } from '../../components/standard/StandardTable';
import { Api } from '../../services/api';
import { User, UserRole } from '../../types';
import { normalizeApiErrorMessage } from '../../utils/apiError';
import { isSuperAdminRole } from '../../utils/roleGuards';
import { SuperAdminStorageDetailModal } from './SuperAdminStorageDetailModal';

type SettingsTab =
  | 'GENERAL'
  | 'SECURITY'
  | 'EMAIL'
  | 'LEGAL'
  | 'ADMINS'
  | 'STORAGE'
  | 'AUDIT'
  | 'ADVANCED';

export const SystemSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('GENERAL');
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingSettingKey, setSavingSettingKey] = useState<string | null>(null);

  // Admin Management State
  const [admins, setAdmins] = useState<User[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [adminsLoadError, setAdminsLoadError] = useState<string | null>(null);
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [newAdmin, setNewAdmin] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
  });

  // Storage State
  const [storageStats, setStorageStats] = useState<any>(null);
  const [selectedOrg, setSelectedOrg] = useState<{ id: string; name: string } | null>(null);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditFilter, setAuditFilter] = useState<'all' | 'user' | 'system' | 'security'>('all');
  const [auditLimit, setAuditLimit] = useState(100);
  const [auditHasMore, setAuditHasMore] = useState(true);

  // Database State (Advanced)
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [tableRows, setTableRows] = useState<any[]>([]);
  const [dbSearchTerm, setDbSearchTerm] = useState('');

  useEffect(() => {
    fetchSettings();
    if (activeTab === 'ADMINS') fetchAdmins();
    if (activeTab === 'STORAGE') fetchStorageStats();
    if (activeTab === 'AUDIT') fetchAuditLogs();
    if (activeTab === 'ADVANCED') fetchTables();
  }, [activeTab]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      setLoadError(null);
      const data = await Api.getSystemSettings();
      setSettings(data || {});
    } catch (err) {
      console.error('[SystemSettings] fetchSettings error:', err);
      if (activeTab === 'ADVANCED') return;
      const message = normalizeApiErrorMessage(err, 'Failed to load settings');
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdmins = async () => {
    setAdminsLoading(true);
    try {
      setAdminsLoadError(null);
      const users = await Api.getSuperAdminUsers();
      setAdmins(users.filter((u) => isSuperAdminRole(u.role) && u.status === 'active'));
    } catch (err) {
      const message = normalizeApiErrorMessage(err, 'Failed to load admins');
      setAdminsLoadError(message);
      toast.error(message);
    } finally {
      setAdminsLoading(false);
    }
  };

  const fetchStorageStats = async () => {
    try {
      const data = await Api.adminGetStorageStats();
      setStorageStats(data);
    } catch (err: any) {
      toast.error(normalizeApiErrorMessage(err, 'Failed to load storage stats'));
    }
  };

  const fetchAuditLogs = async (limit = auditLimit) => {
    try {
      const data = await Api.getActivities(limit);
      setAuditLogs(data);
      setAuditHasMore(data.length >= limit);
    } catch (err) {
      toast.error(normalizeApiErrorMessage(err, 'Failed to load audit logs'));
    }
  };

  const fetchTables = async () => {
    try {
      const data = await Api.adminGetDatabaseTables();
      setTables(data);
      if (data.length > 0 && !selectedTable) {
        setSelectedTable(data[0]);
      }
    } catch (err: any) {
      toast.error(normalizeApiErrorMessage(err, 'Failed to load tables'));
    }
  };

  const loadTableRows = async (tableName: string) => {
    try {
      const data = await Api.adminGetTableRows(tableName);
      setTableRows(data);
    } catch (err: any) {
      toast.error(normalizeApiErrorMessage(err, 'Failed to load rows'));
    }
  };

  useEffect(() => {
    if (selectedTable) {
      loadTableRows(selectedTable);
    }
  }, [selectedTable]);

  const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  const handleSaveSetting = async (key: string, value: string) => {
    setSavingSettingKey(key);
    try {
      await Api.saveSetting(key, value ?? '');
      await fetchSettings();
      toast.success('Setting saved');
    } catch (err) {
      toast.error(normalizeApiErrorMessage(err, 'Failed to save setting'));
    } finally {
      setSavingSettingKey(null);
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAdmin(true);
    try {
      await Api.createSuperAdminUser({
        ...newAdmin,
        role: UserRole.SUPERADMIN,
        status: 'active',
      });
      toast.success('Super Admin created');
      setShowAddAdmin(false);
      setNewAdmin({ email: '', password: '', firstName: '', lastName: '' });
      await fetchAdmins();
    } catch (err: any) {
      toast.error(normalizeApiErrorMessage(err, 'Failed to create admin'));
    } finally {
      setSavingAdmin(false);
    }
  };

  const handleDeleteAdmin = async (id: string) => {
    const admin = admins.find((a) => a.id === id);
    const name = admin ? `${admin.firstName} ${admin.lastName} (${admin.email})` : id;
    if (
      !window.confirm(
        `Are you sure you want to permanently remove Super Admin ${name}? This action cannot be undone.`
      )
    )
      return;
    try {
      await Api.deleteSuperAdminUser(id);
      toast.success('Admin removed');
      await fetchAdmins();
    } catch (err) {
      toast.error(normalizeApiErrorMessage(err, 'Failed to remove admin'));
    }
  };

  const isSavingSetting = (key: string) => savingSettingKey === key;

  const renderTabs = () => (
    <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-2 border-b border-slate-200 dark:border-white/[0.04]">
      <button
        onClick={() => setActiveTab('GENERAL')}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
          activeTab === 'GENERAL'
            ? 'bg-c-text text-c-bg'
            : 'text-slate-700 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.04]'
        }`}
      >
        <Settings size={16} /> General
      </button>
      <button
        onClick={() => setActiveTab('SECURITY')}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
          activeTab === 'SECURITY'
            ? 'bg-c-text text-c-bg'
            : 'text-slate-700 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.04]'
        }`}
      >
        <Shield size={16} /> Security
      </button>
      <button
        onClick={() => setActiveTab('EMAIL')}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
          activeTab === 'EMAIL'
            ? 'bg-c-text text-c-bg'
            : 'text-slate-700 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.04]'
        }`}
      >
        <Mail size={16} /> Email
      </button>
      <button
        onClick={() => setActiveTab('LEGAL')}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
          activeTab === 'LEGAL'
            ? 'bg-c-text text-c-bg'
            : 'text-slate-700 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.04]'
        }`}
      >
        <FileText size={16} /> Legal
      </button>
      <button
        onClick={() => setActiveTab('ADMINS')}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
          activeTab === 'ADMINS'
            ? 'bg-c-text text-c-bg'
            : 'text-slate-700 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.04]'
        }`}
      >
        <Users size={16} /> Admins
      </button>
      <button
        onClick={() => setActiveTab('STORAGE')}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
          activeTab === 'STORAGE'
            ? 'bg-c-text text-c-bg'
            : 'text-slate-700 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.04]'
        }`}
      >
        <HardDrive size={16} /> Storage
      </button>
      <button
        onClick={() => setActiveTab('AUDIT')}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
          activeTab === 'AUDIT'
            ? 'bg-c-text text-c-bg'
            : 'text-slate-700 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.04]'
        }`}
      >
        <Clock size={16} /> Audit
      </button>
      <button
        onClick={() => setActiveTab('ADVANCED')}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
          activeTab === 'ADVANCED'
            ? 'bg-danger-600/80 text-white'
            : 'text-slate-700 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.04]'
        }`}
      >
        <Database size={16} /> Advanced
      </button>
    </div>
  );

  const renderGeneral = () => (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/[0.06] rounded-xl p-4">
        <h3 className="text-base font-medium mb-4 text-slate-900 dark:text-slate-100">
          Application Identity
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Application Name
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={settings['app_name'] || ''}
                onChange={(e) => setSettings((prev) => ({ ...prev, app_name: e.target.value }))}
                className="flex-1 px-3.5 py-2.5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/[0.06] rounded-lg text-slate-900 dark:text-slate-200 text-sm focus:border-primary-500/50 focus:outline-none"
                placeholder="Consultify"
              />
              <button
                onClick={() => handleSaveSetting('app_name', settings['app_name'])}
                disabled={isSavingSetting('app_name')}
                className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors disabled:opacity-60"
              >
                <Save size={16} />
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Default Language
            </label>
            <div className="flex gap-2">
              <select
                value={settings['default_language'] || 'EN'}
                onChange={(e) => handleSaveSetting('default_language', e.target.value)}
                disabled={isSavingSetting('default_language')}
                className="flex-1 px-3.5 py-2.5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/[0.06] rounded-lg text-slate-900 dark:text-slate-200 text-sm focus:border-primary-500/50 focus:outline-none"
              >
                <option value="EN">English</option>
                <option value="PL">Polish</option>
                <option value="DE">German</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/[0.06] rounded-xl p-4">
        <h3 className="text-base font-medium mb-4 text-slate-900 dark:text-slate-100">
          System Status
        </h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-900 dark:text-slate-100 font-medium">Maintenance Mode</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Blocks access for non-admin users
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={settings['maintenance_mode'] === 'true'}
              onChange={(e) => handleSaveSetting('maintenance_mode', String(e.target.checked))}
              disabled={isSavingSetting('maintenance_mode')}
            />
            <div className="w-11 h-6 bg-slate-200 dark:bg-navy-900 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-navy-900"></div>
          </label>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-900 dark:text-slate-100 font-medium">System Announcement</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Banner message for all users
              </p>
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              value={settings['system_announcement'] || ''}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, system_announcement: e.target.value }))
              }
              className="flex-1 px-4 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-slate-100 focus:border-primary-500 outline-none"
              placeholder="e.g. Scheduled maintenance at 22:00"
            />
            <button
              onClick={() =>
                handleSaveSetting('system_announcement', settings['system_announcement'])
              }
              disabled={isSavingSetting('system_announcement')}
              className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg disabled:opacity-60"
            >
              <Save size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSecurity = () => (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">
          Access Control
        </h3>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-900 dark:text-slate-100 font-medium">Enforce MFA</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Require Multi-Factor Authentication for all users
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={settings['enforce_mfa'] === 'true'}
                onChange={(e) => handleSaveSetting('enforce_mfa', String(e.target.checked))}
                disabled={isSavingSetting('enforce_mfa')}
              />
              <div className="w-11 h-6 bg-slate-200 dark:bg-navy-900 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-navy-900"></div>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-2">
              Session Timeout (minutes)
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={settings['session_timeout_mins'] || '60'}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, session_timeout_mins: e.target.value }))
                }
                className="flex-1 px-4 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-slate-100 focus:border-primary-500 outline-none"
              />
              <button
                onClick={() =>
                  handleSaveSetting('session_timeout_mins', settings['session_timeout_mins'])
                }
                disabled={isSavingSetting('session_timeout_mins')}
                className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg disabled:opacity-60"
              >
                <Save size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderEmail = () => (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">
          SMTP Configuration
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-2">
              SMTP Host
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={settings['smtp_host'] || ''}
                onChange={(e) => setSettings((prev) => ({ ...prev, smtp_host: e.target.value }))}
                className="flex-1 px-4 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-slate-100 focus:border-primary-500 outline-none"
                placeholder="smtp.example.com"
              />
              <button
                onClick={() => handleSaveSetting('smtp_host', settings['smtp_host'])}
                disabled={isSavingSetting('smtp_host')}
                className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg disabled:opacity-60"
              >
                <Save size={18} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-2">
                SMTP Port
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={settings['smtp_port'] || ''}
                  onChange={(e) => setSettings((prev) => ({ ...prev, smtp_port: e.target.value }))}
                  className="flex-1 px-4 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-slate-100 focus:border-primary-500 outline-none"
                  placeholder="587"
                />
                <button
                  onClick={() => handleSaveSetting('smtp_port', settings['smtp_port'])}
                  disabled={isSavingSetting('smtp_port')}
                  className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg disabled:opacity-60"
                >
                  <Save size={18} />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-2">
                From Email
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={settings['smtp_from'] || ''}
                  onChange={(e) => setSettings((prev) => ({ ...prev, smtp_from: e.target.value }))}
                  className="flex-1 px-4 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-slate-100 focus:border-primary-500 outline-none"
                  placeholder="noreply@consultify.com"
                />
                <button
                  onClick={() => handleSaveSetting('smtp_from', settings['smtp_from'])}
                  disabled={isSavingSetting('smtp_from')}
                  className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg disabled:opacity-60"
                >
                  <Save size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderLegal = () => (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">
          Legal Documents
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-2">
              Terms of Service URL
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={settings['legal_tos_url'] || ''}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, legal_tos_url: e.target.value }))
                }
                className="flex-1 px-4 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-slate-100 focus:border-primary-500 outline-none"
                placeholder="https://..."
              />
              <button
                onClick={() => handleSaveSetting('legal_tos_url', settings['legal_tos_url'])}
                disabled={isSavingSetting('legal_tos_url')}
                className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg disabled:opacity-60"
              >
                <Save size={18} />
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-2">
              Privacy Policy URL
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={settings['legal_privacy_url'] || ''}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, legal_privacy_url: e.target.value }))
                }
                className="flex-1 px-4 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-slate-100 focus:border-primary-500 outline-none"
                placeholder="https://..."
              />
              <button
                onClick={() =>
                  handleSaveSetting('legal_privacy_url', settings['legal_privacy_url'])
                }
                disabled={isSavingSetting('legal_privacy_url')}
                className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg disabled:opacity-60"
              >
                <Save size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ── Kanon §27: Super Administrators → StandardTable ──────────────────────
  const adminRows: TableRow[] = admins.map((a) => ({ ...a, id: String(a.id) }));

  const adminColumns: TableColumn[] = [
    {
      id: 'name',
      label: 'Name',
      sortable: true,
      sortAccessor: (row: TableRow) => `${row.firstName ?? ''} ${row.lastName ?? ''}`,
      render: (row: TableRow) => (
        <span className="font-medium text-slate-900 dark:text-slate-100">
          {row.firstName} {row.lastName}
        </span>
      ),
    },
    {
      id: 'email',
      label: 'Email',
      sortable: true,
      render: (row: TableRow) => (
        <span className="text-slate-700 dark:text-slate-300">{row.email}</span>
      ),
    },
    {
      id: 'status',
      label: 'Status',
      filterable: true,
      filterOptions: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
      ],
      render: (row: TableRow) => (
        <span
          className={`flex items-center gap-1.5 ${
            row.status === 'active'
              ? 'text-emerald-700 dark:text-emerald-400'
              : 'text-danger-700 dark:text-danger-400'
          }`}
        >
          {row.status === 'active' ? <Check size={14} /> : <AlertCircle size={14} />}
          {row.status}
        </span>
      ),
    },
    {
      id: 'lastLogin',
      label: 'Last Login',
      sortable: true,
      render: (row: TableRow) => (
        <span className="text-slate-500 dark:text-slate-400 text-xs">
          {row.lastLogin ? new Date(row.lastLogin as string).toLocaleString() : 'Never'}
        </span>
      ),
    },
  ];

  const adminRowMenu = (row: TableRow): StandardRowMenu => ({
    destructive: {
      label: 'Remove Admin',
      icon: Trash2,
      onClick: savingAdmin ? undefined : () => handleDeleteAdmin(String(row.id)),
      note: savingAdmin ? 'Saving…' : undefined,
    },
  });

  // ── Kanon §27: Storage by Organization → StandardTable ───────────────────
  const storageRows: TableRow[] = (storageStats?.breakdown ?? [])
    .slice()
    .sort((a: any, b: any) => b.size - a.size)
    .map((item: any) => ({ ...item, id: item.name }));

  const storageColumns: TableColumn[] = [
    {
      id: 'displayName',
      label: 'Organization / Folder',
      sortable: true,
      render: (row: TableRow) => (
        <div>
          <div className="font-medium text-slate-900 dark:text-slate-100">{row.displayName}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">{row.name}</div>
        </div>
      ),
    },
    {
      id: 'size',
      label: 'Size',
      align: 'right',
      sortable: true,
      sortAccessor: (row: TableRow) => Number(row.size) || 0,
      render: (row: TableRow) => (
        <span className="text-slate-700 dark:text-slate-300 font-mono">
          {formatBytes(row.size as number)}
        </span>
      ),
    },
    {
      id: 'visual',
      label: 'Visual',
      width: '33%',
      render: (row: TableRow) => {
        const percent =
          storageStats?.totalSize > 0 ? ((row.size as number) / storageStats.totalSize) * 100 : 0;
        return (
          <div className="w-full h-2 bg-slate-200 dark:bg-navy-950 rounded-full overflow-hidden">
            <div
              className="h-full bg-pink-500 rounded-full"
              style={{ width: `${Math.max(percent, 1)}%` }}
            />
          </div>
        );
      },
    },
  ];

  const storageRowMenu = (row: TableRow): StandardRowMenu => ({
    primary: [
      {
        id: 'browse',
        label: 'Browse files',
        icon: HardDrive,
        onClick: () => setSelectedOrg({ id: String(row.name), name: String(row.displayName) }),
      },
    ],
    universalHandlers: {
      preview: () => setSelectedOrg({ id: String(row.name), name: String(row.displayName) }),
    },
    destructive: { note: 'Delete individual files from the file browser' },
  });

  const renderAdmins = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Super Administrators
        </h3>
        <button
          onClick={() => setShowAddAdmin(true)}
          disabled={adminsLoading || savingAdmin}
          className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors disabled:opacity-60"
        >
          <Plus size={16} /> Add Super Admin
        </button>
      </div>

      {adminsLoadError && (
        <div className="rounded-lg border border-danger-200 dark:border-danger-500/20 bg-danger-50 dark:bg-danger-500/10 p-4 text-sm text-danger-700 dark:text-danger-300">
          {adminsLoadError}
        </div>
      )}

      <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden">
        <StandardTable
          columns={adminColumns}
          data={adminRows}
          loading={adminsLoading}
          rowMenu={adminRowMenu}
          empty={{ title: 'No active super administrators found.' }}
          persistKey="superadmin.systemAdmins.list"
        />
      </div>

      {/* Add Admin Modal */}
      {showAddAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-c-surface border border-white/10 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold mb-4 text-c-text">Add Super Admin</h3>
            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-500 mb-1">
                    First Name
                  </label>
                  <input
                    required
                    value={newAdmin.firstName}
                    onChange={(e) => setNewAdmin({ ...newAdmin, firstName: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded text-slate-900 dark:text-white focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-500 mb-1">
                    Last Name
                  </label>
                  <input
                    required
                    value={newAdmin.lastName}
                    onChange={(e) => setNewAdmin({ ...newAdmin, lastName: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded text-slate-900 dark:text-white focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-500 mb-1">
                  Email
                </label>
                <input
                  required
                  type="email"
                  value={newAdmin.email}
                  onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded text-slate-900 dark:text-white focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-500 mb-1">
                  Password
                </label>
                <input
                  required
                  type="password"
                  value={newAdmin.password}
                  onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded text-slate-900 dark:text-white focus:border-blue-500 outline-none"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddAdmin(false)}
                  disabled={savingAdmin}
                  className="flex-1 py-2 bg-transparent border border-white/10 hover:bg-slate-50 dark:hover:bg-navy-800/20 rounded text-slate-600 transition-colors disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAdmin}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white font-medium transition-colors disabled:opacity-60"
                >
                  {savingAdmin ? 'Creating...' : 'Create Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  const renderStorage = () => (
    <div className="space-y-6">
      {/* Total Usage Card */}
      <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
          Total System Storage
        </h2>
        <div className="flex items-end gap-3">
          <span className="text-4xl font-bold text-pink-500">
            {storageStats ? formatBytes(storageStats.totalSize) : '0 Bytes'}
          </span>
          <span className="text-slate-500 dark:text-slate-400 mb-1">consumed</span>
        </div>
      </div>

      {/* Breakdown Table */}
      <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">
            Usage by Organization
          </h3>
          <button
            onClick={fetchStorageStats}
            className="p-2 bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700 rounded-lg text-slate-700 dark:text-slate-300 transition-colors"
          >
            <RefreshCw size={16} />
          </button>
        </div>
        <StandardTable
          columns={storageColumns}
          data={storageRows}
          rowMenu={storageRowMenu}
          onRowClick={(row) =>
            setSelectedOrg({ id: String(row.name), name: String(row.displayName) })
          }
          empty={{ title: 'No uploads found' }}
          persistKey="superadmin.systemStorage.list"
        />
      </div>

      {/* Storage Detail Modal */}
      {selectedOrg && (
        <SuperAdminStorageDetailModal
          orgId={selectedOrg.id}
          orgName={selectedOrg.name}
          onClose={() => setSelectedOrg(null)}
          onUpdate={fetchStorageStats}
        />
      )}
    </div>
  );

  const renderAudit = () => {
    const filteredLogs =
      auditFilter === 'all'
        ? auditLogs
        : auditLogs.filter((log) => {
            if (auditFilter === 'user') return log.entity_type === 'user';
            if (auditFilter === 'system')
              return log.entity_type === 'system' || log.entity_type === 'settings';
            if (auditFilter === 'security')
              return log.action?.includes('login') || log.action?.includes('auth');
            return true;
          });

    // Kanon §27: logi audytowe → StandardTable (read-only, kebab disabled z notą)
    const auditRows: TableRow[] = filteredLogs.map((log: any, idx: number) => ({
      ...log,
      id: String(log.id || idx),
    }));

    const auditColumns: TableColumn[] = [
      {
        id: 'created_at',
        label: 'Timestamp',
        sortable: true,
        render: (row: TableRow) => (
          <span className="text-slate-500 dark:text-slate-400 text-xs">
            {row.created_at ? new Date(row.created_at as string).toLocaleString() : '-'}
          </span>
        ),
      },
      {
        id: 'user',
        label: 'User',
        sortable: true,
        sortAccessor: (row: TableRow) => row.user_name || row.user_email || 'System',
        render: (row: TableRow) => (
          <span className="text-slate-900 dark:text-slate-100">
            {row.user_name || row.user_email || 'System'}
          </span>
        ),
      },
      {
        id: 'action',
        label: 'Action',
        sortable: true,
        render: (row: TableRow) => (
          <span
            className={`px-2 py-1 rounded text-xs font-medium ${
              row.action === 'created'
                ? 'bg-emerald-500/20 text-emerald-400'
                : row.action === 'deleted'
                  ? 'bg-danger-500/20 text-danger-400'
                  : row.action === 'updated'
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            {row.action}
          </span>
        ),
      },
      {
        id: 'entity_type',
        label: 'Entity',
        sortable: true,
        render: (row: TableRow) => (
          <span className="text-slate-700 dark:text-slate-300">{row.entity_type}</span>
        ),
      },
      {
        id: 'details',
        label: 'Details',
        render: (row: TableRow) => (
          <span className="text-slate-500 dark:text-slate-400 max-w-xs truncate block">
            {row.entity_name || (row.entity_id as string | undefined)?.slice(0, 8) || '-'}
          </span>
        ),
      },
    ];

    return (
      <div className="space-y-6">
        {/* Filters */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {(['all', 'user', 'system', 'security'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setAuditFilter(f)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  auditFilter === f
                    ? 'bg-c-text text-c-bg'
                    : 'bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-700'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <button
            onClick={() => fetchAuditLogs()}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-white/10 rounded-lg text-sm transition-colors"
          >
            <RefreshCw size={16} /> Refresh
          </button>
        </div>

        {/* Logs Table */}
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden">
          <StandardTable
            columns={auditColumns}
            data={auditRows}
            rowMenu={() => ({
              destructive: { note: 'Audit logs are immutable' },
            })}
            empty={{ title: 'No audit logs found' }}
            persistKey="superadmin.systemAudit.list"
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Showing {filteredLogs.length} of {auditLogs.length} loaded entries (limit: {auditLimit})
          </span>
          {auditHasMore && (
            <button
              onClick={() => {
                const newLimit = auditLimit + 100;
                setAuditLimit(newLimit);
                fetchAuditLogs(newLimit);
              }}
              className="px-4 py-2 bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 rounded-lg text-sm transition-colors"
            >
              Load More
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderAdvanced = () => {
    const filteredRows = tableRows.filter((row) =>
      JSON.stringify(row).toLowerCase().includes(dbSearchTerm.toLowerCase())
    );
    const columns = tableRows.length > 0 ? Object.keys(tableRows[0]) : [];

    return (
      <div className="space-y-6">
        {/* Warning Banner */}
        <ReadOnlyState
          title="Database viewer is read-only"
          description="This surface can inspect selected tables only. Inline edits and destructive actions are intentionally unavailable here."
        />
        <div className="bg-danger-500/10 border border-danger-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="text-danger-400 shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="font-semibold text-danger-400">Advanced Database Access</h3>
            <p className="text-sm text-danger-300/80 mt-1">
              Direct database access is for debugging only. Changes here bypass all validation. Use
              with extreme caution.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar: Table List */}
          <div className="col-span-3 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-4 max-h-[60vh] overflow-y-auto">
            <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Table size={16} /> Tables ({tables.length})
            </h2>
            <div className="space-y-1">
              {tables.map((table) => (
                <button
                  key={table}
                  onClick={() => setSelectedTable(table)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedTable === table
                      ? 'bg-slate-100 dark:bg-white/[0.08] text-[var(--c-info)] border border-c-info/30'
                      : 'text-slate-700 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800/20'
                  }`}
                >
                  {table}
                </button>
              ))}
            </div>
          </div>

          {/* Main Content: Data Table */}
          <div className="col-span-9 space-y-4">
            <div className="flex items-center gap-4 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 p-2 rounded-lg">
              <Search className="text-slate-500 dark:text-slate-400 ml-2" size={20} />
              <input
                type="text"
                placeholder="Search in current table..."
                value={dbSearchTerm}
                onChange={(e) => setDbSearchTerm(e.target.value)}
                className="bg-transparent border-none text-slate-900 dark:text-slate-100 focus:ring-0 flex-1 placeholder:text-slate-500 dark:placeholder:text-slate-500 outline-none"
              />
            </div>

            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden">
              {tableRows.length === 0 ? (
                <div className="p-12 text-center text-slate-600 dark:text-slate-500">
                  {selectedTable
                    ? `No rows found in ${selectedTable}`
                    : 'Select a table to view data'}
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[50vh]">
                  <table /* §27-exempt: read-only podglad surowych tabel DB (kolumny dynamiczne z dowolnej tabeli, debug-only), nie lista encji */
                    className="w-full text-left text-sm"
                  >
                    <thead className="bg-slate-50 dark:bg-navy-950 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-white/10 sticky top-0">
                      <tr>
                        {columns.map((col) => (
                          <th key={col} className="px-6 py-4 whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredRows.map((row, i) => (
                        <tr
                          key={i}
                          className="hover:bg-slate-50 dark:hover:bg-navy-800/20 transition-colors"
                        >
                          {columns.map((col) => (
                            <td
                              key={`${i}-${col}`}
                              className="px-6 py-4 text-slate-700 dark:text-slate-300 whitespace-nowrap max-w-xs truncate"
                            >
                              {typeof row[col] === 'object'
                                ? JSON.stringify(row[col])
                                : String(row[col] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="p-4 border-t border-slate-200 dark:border-white/10 text-xs text-slate-600 dark:text-slate-400 text-right">
                Showing {filteredRows.length} rows
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-8 overflow-y-auto relative">
      <InfoButton cardId="superadmin-settings" position="top-right" />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          System Settings
        </h1>
        <div className="flex items-center gap-2">
          <InfoButton
            cardId="superadmin-settings"
            position="header-inline"
            size="md"
            showLabel
            label="Help"
          />
          <button
            onClick={fetchSettings}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-navy-800 hover:bg-slate-50 dark:hover:bg-navy-700 border border-slate-200 dark:border-white/10 rounded-lg text-sm transition-colors text-slate-900 dark:text-slate-100 disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {renderTabs()}

      {loadError && (
        <div className="mb-6 rounded-lg border border-danger-200 dark:border-danger-500/20 bg-danger-50 dark:bg-danger-500/10 p-4 text-sm text-danger-700 dark:text-danger-300">
          {loadError}
        </div>
      )}

      {loading && activeTab !== 'STORAGE' && activeTab !== 'AUDIT' && activeTab !== 'ADVANCED' ? (
        <div className="text-slate-500 dark:text-slate-400">Loading settings...</div>
      ) : (
        <>
          {activeTab === 'GENERAL' && renderGeneral()}
          {activeTab === 'SECURITY' && renderSecurity()}
          {activeTab === 'EMAIL' && renderEmail()}
          {activeTab === 'LEGAL' && renderLegal()}
          {activeTab === 'ADMINS' && renderAdmins()}
          {activeTab === 'STORAGE' && renderStorage()}
          {activeTab === 'AUDIT' && renderAudit()}
          {activeTab === 'ADVANCED' && renderAdvanced()}
        </>
      )}
    </div>
  );
};
