import {
    AlertCircle,
    Check,
    ChevronDown,
    ChevronRight,
    Clock,
    Database,
    Eye,
    EyeOff,
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

import { InfoButton } from '../../components/shared/InfoButton';
import { Api } from '../../services/api';
import { User } from '../../types';
import { SuperAdminStorageDetailModal } from './SuperAdminStorageDetailModal';

type SettingsTab = 'GENERAL' | 'SECURITY' | 'EMAIL' | 'LEGAL' | 'ADMINS' | 'STORAGE' | 'AUDIT' | 'ADVANCED';

export const SystemSettings: React.FC = () => {
    const [activeTab, setActiveTab] = useState<SettingsTab>('GENERAL');
    const [settings, setSettings] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);

    // Admin Management State
    const [admins, setAdmins] = useState<User[]>([]);
    const [showAddAdmin, setShowAddAdmin] = useState(false);
    const [newAdmin, setNewAdmin] = useState({ email: '', password: '', firstName: '', lastName: '' });

    // Storage State
    const [storageStats, setStorageStats] = useState<any>(null);
    const [selectedOrg, setSelectedOrg] = useState<{ id: string; name: string } | null>(null);

    // Audit Logs State
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [auditFilter, setAuditFilter] = useState<'all' | 'user' | 'system' | 'security'>('all');

    // Database State (Advanced)
    const [showAdvanced, setShowAdvanced] = useState(false);
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
            const data = await Api.getSystemSettings();
            setSettings(data);
        } catch (err) {
            console.error(err);
            toast.error('Failed to load settings');
        } finally {
            setLoading(false);
        }
    };

    const fetchAdmins = async () => {
        try {
            const users = await Api.getSuperAdminUsers();
            setAdmins(users.filter((u) => u.role === 'SUPERADMIN'));
        } catch (_) {
            toast.error('Failed to load admins');
        }
    };

    const fetchStorageStats = async () => {
        try {
            const data = await Api.adminGetStorageStats();
            setStorageStats(data);
        } catch (err: unknown) {
            toast.error(err.message || 'Failed to load storage stats');
        }
    };

    const fetchAuditLogs = async () => {
        try {
            const data = await Api.getActivities(100);
            setAuditLogs(data);
        } catch (err) {
            toast.error('Failed to load audit logs');
        }
    };

    const fetchTables = async () => {
        try {
            const data = await Api.adminGetDatabaseTables();
            setTables(data);
            if (data.length > 0 && !selectedTable) {
                setSelectedTable(data[0]);
            }
        } catch (err: unknown) {
            toast.error(err.message || 'Failed to load tables');
        }
    };

    const loadTableRows = async (tableName: string) => {
        try {
            const data = await Api.adminGetTableRows(tableName);
            setTableRows(data);
        } catch (err: unknown) {
            toast.error(err.message || 'Failed to load rows');
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
        try {
            await Api.saveSetting(key, value);
            setSettings((prev) => ({ ...prev, [key]: value }));
            toast.success('Setting saved');
        } catch (_) {
            toast.error('Failed to save setting');
        }
    };

    const handleCreateAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await Api.createSuperAdminUser(newAdmin);
            toast.success('Super Admin created');
            setShowAddAdmin(false);
            setNewAdmin({ email: '', password: '', firstName: '', lastName: '' });
            fetchAdmins();
        } catch (err: unknown) {
            toast.error(err.message || 'Failed to create admin');
        }
    };

    const handleDeleteAdmin = async (id: string) => {
        if (!confirm('Are you sure you want to remove this Super Admin?')) return;
        try {
            await Api.deleteUser(id);
            toast.success('Admin removed');
            fetchAdmins();
        } catch (_) {
            toast.error('Failed to remove admin');
        }
    };

    const renderTabs = () => (
        <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-2 border-b border-white/[0.04]">
            <button
                onClick={() => setActiveTab('GENERAL')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'GENERAL' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'}`}
            >
                <Settings size={16} /> General
            </button>
            <button
                onClick={() => setActiveTab('SECURITY')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'SECURITY' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'}`}
            >
                <Shield size={16} /> Security
            </button>
            <button
                onClick={() => setActiveTab('EMAIL')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'EMAIL' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'}`}
            >
                <Mail size={16} /> Email
            </button>
            <button
                onClick={() => setActiveTab('LEGAL')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'LEGAL' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'}`}
            >
                <FileText size={16} /> Legal
            </button>
            <button
                onClick={() => setActiveTab('ADMINS')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'ADMINS' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'}`}
            >
                <Users size={16} /> Admins
            </button>
            <button
                onClick={() => setActiveTab('STORAGE')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'STORAGE' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'}`}
            >
                <HardDrive size={16} /> Storage
            </button>
            <button
                onClick={() => setActiveTab('AUDIT')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'AUDIT' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'}`}
            >
                <Clock size={16} /> Audit
            </button>
            <button
                onClick={() => setActiveTab('ADVANCED')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'ADVANCED' ? 'bg-red-600/80 text-white' : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'}`}
            >
                <Database size={16} /> Advanced
            </button>
        </div>
    );

    const renderGeneral = () => (
        <div className="space-y-6 max-w-2xl">
            <div className="border border-white/[0.06] rounded-xl p-5">
                <h3 className="text-base font-medium mb-4 text-slate-100">Application Identity</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                            Application Name
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={settings['app_name'] || ''}
                                onChange={(e) => setSettings((prev) => ({ ...prev, app_name: e.target.value }))}
                                className="flex-1 px-3.5 py-2.5 bg-slate-800/50 border border-white/[0.06] rounded-lg text-slate-200 text-sm focus:border-blue-500/50 focus:outline-none"
                                placeholder="TechnoLex"
                            />
                            <button
                                onClick={() => handleSaveSetting('app_name', settings['app_name'])}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                            >
                                <Save size={16} />
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                            Default Language
                        </label>
                        <div className="flex gap-2">
                            <select
                                value={settings['default_language'] || 'EN'}
                                onChange={(e) => handleSaveSetting('default_language', e.target.value)}
                                className="flex-1 px-3.5 py-2.5 bg-slate-800/50 border border-white/[0.06] rounded-lg text-slate-200 text-sm focus:border-blue-500/50 focus:outline-none"
                            >
                                <option value="EN">English</option>
                                <option value="PL">Polish</option>
                                <option value="DE">German</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div className="border border-white/[0.06] rounded-xl p-5">
                <h3 className="text-base font-medium mb-4 text-slate-100">System Status</h3>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-white font-medium">Maintenance Mode</p>
                        <p className="text-sm text-slate-400">Blocks access for non-admin users</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={settings['maintenance_mode'] === 'true'}
                            onChange={(e) => handleSaveSetting('maintenance_mode', String(e.target.checked))}
                        />
                        <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>

                <div className="mt-4 pt-4 border-t border-white/5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-white font-medium">System Announcement</p>
                            <p className="text-sm text-slate-400">Banner message for all users</p>
                        </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                        <input
                            type="text"
                            value={settings['system_announcement'] || ''}
                            onChange={(e) => setSettings((prev) => ({ ...prev, system_announcement: e.target.value }))}
                            className="flex-1 px-4 py-2 bg-navy-950 border border-white/10 rounded-lg text-white focus:border-blue-500 outline-none"
                            placeholder="e.g. Scheduled maintenance at 22:00"
                        />
                        <button
                            onClick={() => handleSaveSetting('system_announcement', settings['system_announcement'])}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg"
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
            <div className="bg-navy-900 border border-white/10 rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4 text-white">Access Control</h3>
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-white font-medium">Enforce MFA</p>
                            <p className="text-sm text-slate-400">Require Multi-Factor Authentication for all users</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={settings['enforce_mfa'] === 'true'}
                                onChange={(e) => handleSaveSetting('enforce_mfa', String(e.target.checked))}
                            />
                            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">
                            Session Timeout (minutes)
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                value={settings['session_timeout_mins'] || '60'}
                                onChange={(e) =>
                                    setSettings((prev) => ({ ...prev, session_timeout_mins: e.target.value }))
                                }
                                className="flex-1 px-4 py-2 bg-navy-950 border border-white/10 rounded-lg text-white focus:border-blue-500 outline-none"
                            />
                            <button
                                onClick={() =>
                                    handleSaveSetting('session_timeout_mins', settings['session_timeout_mins'])
                                }
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg"
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
            <div className="bg-navy-900 border border-white/10 rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4 text-white">SMTP Configuration</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">SMTP Host</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={settings['smtp_host'] || ''}
                                onChange={(e) => setSettings((prev) => ({ ...prev, smtp_host: e.target.value }))}
                                className="flex-1 px-4 py-2 bg-navy-950 border border-white/10 rounded-lg text-white focus:border-blue-500 outline-none"
                                placeholder="smtp.example.com"
                            />
                            <button
                                onClick={() => handleSaveSetting('smtp_host', settings['smtp_host'])}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg"
                            >
                                <Save size={18} />
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-2">SMTP Port</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={settings['smtp_port'] || ''}
                                    onChange={(e) => setSettings((prev) => ({ ...prev, smtp_port: e.target.value }))}
                                    className="flex-1 px-4 py-2 bg-navy-950 border border-white/10 rounded-lg text-white focus:border-blue-500 outline-none"
                                    placeholder="587"
                                />
                                <button
                                    onClick={() => handleSaveSetting('smtp_port', settings['smtp_port'])}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg"
                                >
                                    <Save size={18} />
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-2">From Email</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={settings['smtp_from'] || ''}
                                    onChange={(e) => setSettings((prev) => ({ ...prev, smtp_from: e.target.value }))}
                                    className="flex-1 px-4 py-2 bg-navy-950 border border-white/10 rounded-lg text-white focus:border-blue-500 outline-none"
                                    placeholder="noreply@technolex.com"
                                />
                                <button
                                    onClick={() => handleSaveSetting('smtp_from', settings['smtp_from'])}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg"
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
            <div className="bg-navy-900 border border-white/10 rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4 text-white">Legal Documents</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Terms of Service URL</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={settings['legal_tos_url'] || ''}
                                onChange={(e) => setSettings((prev) => ({ ...prev, legal_tos_url: e.target.value }))}
                                className="flex-1 px-4 py-2 bg-navy-950 border border-white/10 rounded-lg text-white focus:border-blue-500 outline-none"
                                placeholder="https://..."
                            />
                            <button
                                onClick={() => handleSaveSetting('legal_tos_url', settings['legal_tos_url'])}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg"
                            >
                                <Save size={18} />
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Privacy Policy URL</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={settings['legal_privacy_url'] || ''}
                                onChange={(e) =>
                                    setSettings((prev) => ({ ...prev, legal_privacy_url: e.target.value }))
                                }
                                className="flex-1 px-4 py-2 bg-navy-950 border border-white/10 rounded-lg text-white focus:border-blue-500 outline-none"
                                placeholder="https://..."
                            />
                            <button
                                onClick={() => handleSaveSetting('legal_privacy_url', settings['legal_privacy_url'])}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg"
                            >
                                <Save size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderAdmins = () => (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Super Administrators</h3>
                <button
                    onClick={() => setShowAddAdmin(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                >
                    <Plus size={16} /> Add Super Admin
                </button>
            </div>

            <div className="bg-navy-900 border border-white/10 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-navy-950 text-slate-400 text-xs uppercase tracking-wider">
                            <th className="p-4 font-medium">Name</th>
                            <th className="p-4 font-medium">Email</th>
                            <th className="p-4 font-medium">Status</th>
                            <th className="p-4 font-medium">Last Login</th>
                            <th className="p-4 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-sm">
                        {admins.map((admin) => (
                            <tr key={admin.id} className="hover:bg-white/5 transition-colors">
                                <td className="p-4 font-medium text-white">
                                    {admin.firstName} {admin.lastName}
                                </td>
                                <td className="p-4 text-slate-300">{admin.email}</td>
                                <td className="p-4">
                                    <span
                                        className={`flex items-center gap-1.5 ${admin.status === 'active' ? 'text-green-400' : 'text-red-400'}`}
                                    >
                                        {admin.status === 'active' ? <Check size={14} /> : <AlertCircle size={14} />}
                                        {admin.status}
                                    </span>
                                </td>
                                <td className="p-4 text-slate-500 text-xs">
                                    {admin.lastLogin ? new Date(admin.lastLogin).toLocaleString() : 'Never'}
                                </td>
                                <td className="p-4 text-right">
                                    <button
                                        onClick={() => handleDeleteAdmin(admin.id)}
                                        className="p-1.5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded transition-colors"
                                        title="Remove Admin"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Add Admin Modal */}
            {showAddAdmin && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-navy-900 border border-white/10 rounded-xl p-6 w-full max-w-md shadow-2xl">
                        <h3 className="text-xl font-bold mb-4 text-white">Add Super Admin</h3>
                        <form onSubmit={handleCreateAdmin} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">First Name</label>
                                    <input
                                        required
                                        value={newAdmin.firstName}
                                        onChange={(e) => setNewAdmin({ ...newAdmin, firstName: e.target.value })}
                                        className="w-full px-3 py-2 bg-navy-950 border border-white/10 rounded text-white focus:border-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Last Name</label>
                                    <input
                                        required
                                        value={newAdmin.lastName}
                                        onChange={(e) => setNewAdmin({ ...newAdmin, lastName: e.target.value })}
                                        className="w-full px-3 py-2 bg-navy-950 border border-white/10 rounded text-white focus:border-blue-500 outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Email</label>
                                <input
                                    required
                                    type="email"
                                    value={newAdmin.email}
                                    onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                                    className="w-full px-3 py-2 bg-navy-950 border border-white/10 rounded text-white focus:border-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Password</label>
                                <input
                                    required
                                    type="password"
                                    value={newAdmin.password}
                                    onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                                    className="w-full px-3 py-2 bg-navy-950 border border-white/10 rounded text-white focus:border-blue-500 outline-none"
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowAddAdmin(false)}
                                    className="flex-1 py-2 bg-transparent border border-white/10 hover:bg-white/5 rounded text-slate-300 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white font-medium transition-colors"
                                >
                                    Create Admin
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
            <div className="bg-navy-900 border border-white/10 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-2">Total System Storage</h2>
                <div className="flex items-end gap-3">
                    <span className="text-4xl font-bold text-pink-500">
                        {storageStats ? formatBytes(storageStats.totalSize) : '0 Bytes'}
                    </span>
                    <span className="text-slate-500 mb-1">consumed</span>
                </div>
            </div>

            {/* Breakdown Table */}
            <div className="bg-navy-900 border border-white/10 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                    <h3 className="font-semibold text-white">Usage by Organization</h3>
                    <button
                        onClick={fetchStorageStats}
                        className="p-2 bg-navy-800 hover:bg-navy-700 rounded-lg text-slate-300 transition-colors"
                    >
                        <RefreshCw size={16} />
                    </button>
                </div>
                <table className="w-full text-left">
                    <thead className="bg-navy-950 text-slate-400 text-xs uppercase">
                        <tr>
                            <th className="px-6 py-3">Organization / Folder</th>
                            <th className="px-6 py-3 text-right">Size</th>
                            <th className="px-6 py-3 w-1/3">Visual</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-sm">
                        {!storageStats?.breakdown?.length ? (
                            <tr>
                                <td colSpan={3} className="p-6 text-center text-slate-500">
                                    No uploads found
                                </td>
                            </tr>
                        ) : (
                            storageStats.breakdown
                                .sort((a: any, b: any) => b.size - a.size)
                                .map((item: any) => {
                                    const percent =
                                        storageStats.totalSize > 0 ? (item.size / storageStats.totalSize) * 100 : 0;
                                    return (
                                        <tr
                                            key={item.name}
                                            className="hover:bg-white/5 cursor-pointer transition-colors"
                                            onClick={() => setSelectedOrg({ id: item.name, name: item.displayName })}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-white">{item.displayName}</div>
                                                <div className="text-xs text-slate-500 font-mono">{item.name}</div>
                                            </td>
                                            <td className="px-6 py-4 text-right text-slate-300 font-mono">
                                                {formatBytes(item.size)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="w-full h-2 bg-navy-950 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-pink-500 rounded-full"
                                                        style={{ width: `${Math.max(percent, 1)}%` }}
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                        )}
                    </tbody>
                </table>
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
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-navy-800 text-slate-400 hover:text-white hover:bg-navy-700'
                                }`}
                            >
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={fetchAuditLogs}
                        className="flex items-center gap-2 px-4 py-2 bg-navy-800 hover:bg-navy-700 text-white rounded-lg text-sm transition-colors"
                    >
                        <RefreshCw size={16} /> Refresh
                    </button>
                </div>

                {/* Logs Table */}
                <div className="bg-navy-900 border border-white/10 rounded-xl overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-navy-950 text-slate-400 text-xs uppercase">
                            <tr>
                                <th className="px-6 py-4">Timestamp</th>
                                <th className="px-6 py-4">User</th>
                                <th className="px-6 py-4">Action</th>
                                <th className="px-6 py-4">Entity</th>
                                <th className="px-6 py-4">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-sm">
                            {filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-slate-500">
                                        No audit logs found
                                    </td>
                                </tr>
                            ) : (
                                filteredLogs.slice(0, 50).map((log: any, idx: number) => (
                                    <tr key={log.id || idx} className="hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4 text-slate-500 text-xs">
                                            {log.created_at ? new Date(log.created_at).toLocaleString() : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-white">
                                            {log.user_name || log.user_email || 'System'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span
                                                className={`px-2 py-1 rounded text-xs font-medium ${
                                                    log.action === 'created'
                                                        ? 'bg-emerald-500/20 text-emerald-400'
                                                        : log.action === 'deleted'
                                                          ? 'bg-red-500/20 text-red-400'
                                                          : log.action === 'updated'
                                                            ? 'bg-blue-500/20 text-blue-400'
                                                            : 'bg-slate-700 text-slate-300'
                                                }`}
                                            >
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-300">{log.entity_type}</td>
                                        <td className="px-6 py-4 text-slate-500 max-w-xs truncate">
                                            {log.entity_name || log.entity_id?.slice(0, 8) || '-'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const renderAdvanced = () => {
        const filteredRows = tableRows.filter((row) =>
            JSON.stringify(row).toLowerCase().includes(dbSearchTerm.toLowerCase()),
        );
        const columns = tableRows.length > 0 ? Object.keys(tableRows[0]) : [];

        return (
            <div className="space-y-6">
                {/* Warning Banner */}
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={20} />
                    <div>
                        <h3 className="font-semibold text-red-400">Advanced Database Access</h3>
                        <p className="text-sm text-red-300/80 mt-1">
                            Direct database access is for debugging only. Changes here bypass all validation. Use with
                            extreme caution.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-12 gap-6">
                    {/* Sidebar: Table List */}
                    <div className="col-span-3 bg-navy-900 border border-white/10 rounded-xl p-4 max-h-[60vh] overflow-y-auto">
                        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Table size={16} /> Tables ({tables.length})
                        </h2>
                        <div className="space-y-1">
                            {tables.map((table) => (
                                <button
                                    key={table}
                                    onClick={() => setSelectedTable(table)}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                        selectedTable === table
                                            ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                                            : 'text-slate-400 hover:bg-white/5'
                                    }`}
                                >
                                    {table}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Main Content: Data Table */}
                    <div className="col-span-9 space-y-4">
                        <div className="flex items-center gap-4 bg-navy-900 border border-white/10 p-2 rounded-lg">
                            <Search className="text-slate-500 ml-2" size={20} />
                            <input
                                type="text"
                                placeholder="Search in current table..."
                                value={dbSearchTerm}
                                onChange={(e) => setDbSearchTerm(e.target.value)}
                                className="bg-transparent border-none text-white focus:ring-0 flex-1 placeholder:text-slate-600 outline-none"
                            />
                        </div>

                        <div className="bg-navy-900 border border-white/10 rounded-xl overflow-hidden">
                            {tableRows.length === 0 ? (
                                <div className="p-12 text-center text-slate-400">
                                    {selectedTable
                                        ? `No rows found in ${selectedTable}`
                                        : 'Select a table to view data'}
                                </div>
                            ) : (
                                <div className="overflow-x-auto max-h-[50vh]">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-navy-950 text-slate-400 font-semibold uppercase tracking-wider border-b border-white/10 sticky top-0">
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
                                                <tr key={i} className="hover:bg-white/5 transition-colors">
                                                    {columns.map((col) => (
                                                        <td
                                                            key={`${i}-${col}`}
                                                            className="px-6 py-4 text-slate-300 whitespace-nowrap max-w-xs truncate"
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
                            <div className="p-4 border-t border-white/10 text-xs text-slate-500 text-right">
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
                <h1 className="text-2xl font-bold text-white">System Settings</h1>
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
                        className="flex items-center gap-2 px-4 py-2 bg-navy-800 hover:bg-navy-700 rounded-lg text-sm transition-colors text-white"
                    >
                        <RefreshCw size={16} /> Refresh
                    </button>
                </div>
            </div>

            {renderTabs()}

            {loading && activeTab !== 'STORAGE' && activeTab !== 'AUDIT' && activeTab !== 'ADVANCED' ? (
                <div className="text-slate-500">Loading settings...</div>
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
