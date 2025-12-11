import React, { useState, useEffect } from 'react';
import { Api } from '../../services/api';
import { User } from '../../types';
import { Save, RefreshCw, Shield, Mail, FileText, Settings, Users, Plus, Trash2, Check, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';



export const SystemSettings: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'GENERAL' | 'SECURITY' | 'EMAIL' | 'LEGAL' | 'ADMINS'>('GENERAL');
    const [settings, setSettings] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);

    // Admin Management State
    const [admins, setAdmins] = useState<User[]>([]);
    const [showAddAdmin, setShowAddAdmin] = useState(false);
    const [newAdmin, setNewAdmin] = useState({ email: '', password: '', firstName: '', lastName: '' });

    useEffect(() => {
        fetchSettings();
        if (activeTab === 'ADMINS') fetchAdmins();
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
            // Filter client-side if API returns all users, though API should probably be scoped. 
            // The existing getSuperAdminUsers returns all users, so we filter for SUPERADMIN role.
            setAdmins(users.filter(u => u.role === 'SUPERADMIN'));
        } catch (_) {
            toast.error('Failed to load admins');
        }
    };

    const handleSaveSetting = async (key: string, value: string) => {
        try {
            await Api.saveSetting(key, value);
            setSettings(prev => ({ ...prev, [key]: value }));
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
        } catch (err: any) {
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
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2 border-b border-white/10">
            <button
                onClick={() => setActiveTab('GENERAL')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'GENERAL' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
                <Settings size={16} /> General
            </button>
            <button
                onClick={() => setActiveTab('SECURITY')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'SECURITY' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
                <Shield size={16} /> Security
            </button>
            <button
                onClick={() => setActiveTab('EMAIL')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'EMAIL' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
                <Mail size={16} /> Email / SMTP
            </button>
            <button
                onClick={() => setActiveTab('LEGAL')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'LEGAL' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
                <FileText size={16} /> Legal
            </button>
            <button
                onClick={() => setActiveTab('ADMINS')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'ADMINS' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
                <Users size={16} /> Super Admins
            </button>
        </div>
    );

    const renderGeneral = () => (
        <div className="space-y-6 max-w-2xl">
            <div className="bg-navy-900 border border-white/10 rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4 text-white">Application Identity</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Application Name</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={settings['app_name'] || ''}
                                onChange={e => setSettings(prev => ({ ...prev, 'app_name': e.target.value }))}
                                className="flex-1 px-4 py-2 bg-navy-950 border border-white/10 rounded-lg text-white focus:border-blue-500 outline-none"
                                placeholder="Consultify"
                            />
                            <button
                                onClick={() => handleSaveSetting('app_name', settings['app_name'])}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg"
                            >
                                <Save size={18} />
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Default Language</label>
                        <div className="flex gap-2">
                            <select
                                value={settings['default_language'] || 'EN'}
                                onChange={e => handleSaveSetting('default_language', e.target.value)}
                                className="flex-1 px-4 py-2 bg-navy-950 border border-white/10 rounded-lg text-white focus:border-blue-500 outline-none"
                            >
                                <option value="EN">English</option>
                                <option value="PL">Polish</option>
                                <option value="DE">German</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-navy-900 border border-white/10 rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4 text-white">System Status</h3>
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
                            onChange={e => handleSaveSetting('maintenance_mode', String(e.target.checked))}
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
                            onChange={e => setSettings(prev => ({ ...prev, 'system_announcement': e.target.value }))}
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
                                onChange={e => handleSaveSetting('enforce_mfa', String(e.target.checked))}
                            />
                            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Session Timeout (minutes)</label>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                value={settings['session_timeout_mins'] || '60'}
                                onChange={e => setSettings(prev => ({ ...prev, 'session_timeout_mins': e.target.value }))}
                                className="flex-1 px-4 py-2 bg-navy-950 border border-white/10 rounded-lg text-white focus:border-blue-500 outline-none"
                            />
                            <button
                                onClick={() => handleSaveSetting('session_timeout_mins', settings['session_timeout_mins'])}
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
                                onChange={e => setSettings(prev => ({ ...prev, 'smtp_host': e.target.value }))}
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
                                    onChange={e => setSettings(prev => ({ ...prev, 'smtp_port': e.target.value }))}
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
                                    onChange={e => setSettings(prev => ({ ...prev, 'smtp_from': e.target.value }))}
                                    className="flex-1 px-4 py-2 bg-navy-950 border border-white/10 rounded-lg text-white focus:border-blue-500 outline-none"
                                    placeholder="noreply@consultify.com"
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
                                onChange={e => setSettings(prev => ({ ...prev, 'legal_tos_url': e.target.value }))}
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
                                onChange={e => setSettings(prev => ({ ...prev, 'legal_privacy_url': e.target.value }))}
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
                        {admins.map(admin => (
                            <tr key={admin.id} className="hover:bg-white/5 transition-colors">
                                <td className="p-4 font-medium text-white">{admin.firstName} {admin.lastName}</td>
                                <td className="p-4 text-slate-300">{admin.email}</td>
                                <td className="p-4">
                                    <span className={`flex items-center gap-1.5 ${admin.status === 'active' ? 'text-green-400' : 'text-red-400'}`}>
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
                                        onChange={e => setNewAdmin({ ...newAdmin, firstName: e.target.value })}
                                        className="w-full px-3 py-2 bg-navy-950 border border-white/10 rounded text-white focus:border-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Last Name</label>
                                    <input
                                        required
                                        value={newAdmin.lastName}
                                        onChange={e => setNewAdmin({ ...newAdmin, lastName: e.target.value })}
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
                                    onChange={e => setNewAdmin({ ...newAdmin, email: e.target.value })}
                                    className="w-full px-3 py-2 bg-navy-950 border border-white/10 rounded text-white focus:border-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Password</label>
                                <input
                                    required
                                    type="password"
                                    value={newAdmin.password}
                                    onChange={e => setNewAdmin({ ...newAdmin, password: e.target.value })}
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

    return (
        <div className="p-8 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-white">System Settings</h1>
                <button
                    onClick={fetchSettings}
                    className="flex items-center gap-2 px-4 py-2 bg-navy-800 hover:bg-navy-700 rounded-lg text-sm transition-colors text-white"
                >
                    <RefreshCw size={16} /> Refresh
                </button>
            </div>

            {renderTabs()}

            {loading ? (
                <div className="text-slate-500">Loading settings...</div>
            ) : (
                <>
                    {activeTab === 'GENERAL' && renderGeneral()}
                    {activeTab === 'SECURITY' && renderSecurity()}
                    {activeTab === 'EMAIL' && renderEmail()}
                    {activeTab === 'LEGAL' && renderLegal()}
                    {activeTab === 'ADMINS' && renderAdmins()}
                </>
            )}
        </div>
    );
};
