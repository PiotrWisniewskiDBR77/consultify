/**
 * ProfileModule - User Profile & Account Settings
 * 
 * Tabs: Personal Info | Avatar | Connected Accounts | Permission Requests | Activity Log | Password | Billing | Account
 */

import React, { useState } from 'react';
import { 
    User as UserIcon, 
    Image, 
    Key, 
    Settings, 
    CreditCard, 
    Link2, 
    Shield, 
    Activity,
    Send
} from 'lucide-react';
import { TabLayout, Tab } from '../../components/SuperAdmin/TabLayout';
import { ProfileSettings } from '../../components/settings/ProfileSettings';
import { BillingSettings } from '../../components/settings/BillingSettings';
import { AvatarUploader } from '../../components/settings/AvatarUploader';
import { ConnectedAccounts } from '../../components/settings/ConnectedAccounts';
import { PermissionRequestSection } from '../../components/settings/PermissionRequestSection';
import { ActivityLog } from '../../components/settings/ActivityLog';
import { ProfileCompleteness } from '../../components/settings/ProfileCompleteness';
import { useTranslation } from 'react-i18next';
import { User } from '../../types';
import { Api } from '../../services/api';
import toast from 'react-hot-toast';

interface ProfileModuleProps {
    initialTab?: string;
    currentUser: User;
    onUpdateUser: (updates: Partial<User>) => void;
    theme: 'light' | 'dark' | 'system';
    toggleTheme: (newTheme?: 'light' | 'dark' | 'system') => void;
}

// Password Settings Component
const PasswordSettings: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const { t } = useTranslation();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!currentPassword || !newPassword || !confirmPassword) {
            toast.error(t('settings.password.fillAll', 'Please fill in all fields'));
            return;
        }

        if (newPassword !== confirmPassword) {
            toast.error(t('settings.password.mismatch', 'New passwords do not match'));
            return;
        }

        if (newPassword.length < 8) {
            toast.error(t('settings.password.tooShort', 'Password must be at least 8 characters'));
            return;
        }

        try {
            setLoading(true);
            await Api.changePassword(currentPassword, newPassword);
            toast.success(t('settings.password.changed', 'Password changed successfully'));
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            toast.error(error.message || t('settings.password.error', 'Failed to change password'));
        } finally {
            setLoading(false);
        }
    };

    // Password strength indicator
    const getPasswordStrength = (password: string): { strength: number; label: string; color: string } => {
        let strength = 0;
        if (password.length >= 8) strength += 25;
        if (password.length >= 12) strength += 15;
        if (/[A-Z]/.test(password)) strength += 20;
        if (/[a-z]/.test(password)) strength += 10;
        if (/[0-9]/.test(password)) strength += 15;
        if (/[^A-Za-z0-9]/.test(password)) strength += 15;

        if (strength < 40) return { strength, label: 'Weak', color: 'bg-red-500' };
        if (strength < 70) return { strength, label: 'Medium', color: 'bg-yellow-500' };
        return { strength, label: 'Strong', color: 'bg-green-500' };
    };

    const passwordStrength = getPasswordStrength(newPassword);

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                    {t('settings.password.title', 'Change Password')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t('settings.password.subtitle', 'Update your password regularly to keep your account secure')}
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 max-w-md">
                {/* Current Password */}
                <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        {t('settings.password.current', 'Current Password')}
                    </label>
                    <div className="relative">
                        <input
                            type={showCurrentPassword ? 'text' : 'password'}
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="w-full px-3 py-2 pr-10 bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500/50 outline-none"
                        />
                        <button
                            type="button"
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                            {showCurrentPassword ? 'Hide' : 'Show'}
                        </button>
                    </div>
                </div>

                {/* New Password */}
                <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        {t('settings.password.new', 'New Password')}
                    </label>
                    <div className="relative">
                        <input
                            type={showNewPassword ? 'text' : 'password'}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full px-3 py-2 pr-10 bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500/50 outline-none"
                        />
                        <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                            {showNewPassword ? 'Hide' : 'Show'}
                        </button>
                    </div>
                    {/* Password Strength */}
                    {newPassword && (
                        <div className="mt-2">
                            <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full ${passwordStrength.color} transition-all`}
                                        style={{ width: `${passwordStrength.strength}%` }}
                                    />
                                </div>
                                <span className={`text-xs font-medium ${
                                    passwordStrength.label === 'Weak' ? 'text-red-500' :
                                    passwordStrength.label === 'Medium' ? 'text-yellow-500' : 'text-green-500'
                                }`}>
                                    {passwordStrength.label}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Confirm Password */}
                <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        {t('settings.password.confirm', 'Confirm New Password')}
                    </label>
                    <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500/50 outline-none"
                    />
                    {confirmPassword && newPassword !== confirmPassword && (
                        <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={loading || !currentPassword || !newPassword || newPassword !== confirmPassword}
                    className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? 'Updating...' : t('settings.password.update', 'Update Password')}
                </button>
            </form>

            {/* Password Requirements */}
            <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-lg mt-6">
                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Password Requirements
                </h4>
                <ul className="text-xs text-slate-500 space-y-1">
                    <li className={newPassword.length >= 8 ? 'text-green-500' : ''}>
                        • At least 8 characters
                    </li>
                    <li className={/[A-Z]/.test(newPassword) ? 'text-green-500' : ''}>
                        • One uppercase letter
                    </li>
                    <li className={/[a-z]/.test(newPassword) ? 'text-green-500' : ''}>
                        • One lowercase letter
                    </li>
                    <li className={/[0-9]/.test(newPassword) ? 'text-green-500' : ''}>
                        • One number
                    </li>
                    <li className={/[^A-Za-z0-9]/.test(newPassword) ? 'text-green-500' : ''}>
                        • One special character (recommended)
                    </li>
                </ul>
            </div>
        </div>
    );
};

// Account Management Component
const AccountSettings: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const { t } = useTranslation();
    const [exporting, setExporting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');

    const handleExportData = async () => {
        try {
            setExporting(true);
            // In real implementation, call API to generate export
            await new Promise(resolve => setTimeout(resolve, 1500));
            toast.success(t('settings.account.exportStarted', 'Data export started. You will receive an email when ready.'));
        } catch (error) {
            toast.error(t('settings.account.exportError', 'Failed to start export'));
        } finally {
            setExporting(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (deleteConfirmText !== 'DELETE') {
            toast.error('Please type DELETE to confirm');
            return;
        }
        // In real implementation, call API to delete account
        toast.error('Account deletion is handled by support. Please contact us.');
        setShowDeleteConfirm(false);
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                    {t('settings.account.title', 'Account Management')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t('settings.account.subtitle', 'Manage your account settings and data')}
                </p>
            </div>
            
            <div className="space-y-4">
                {/* Account Status */}
                <div className="p-4 bg-white dark:bg-navy-800 rounded-lg border border-slate-200 dark:border-white/10">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-slate-900 dark:text-white">
                                {t('settings.account.status', 'Account Status')}
                            </p>
                            <p className="text-sm text-slate-500 mt-0.5">
                                Member since {currentUser.lastLogin ? new Date(currentUser.lastLogin).getFullYear() : 'N/A'}
                            </p>
                        </div>
                        <span className="px-3 py-1 bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300 text-sm font-medium rounded-full">
                            {currentUser.status === 'active' ? 'Active' : currentUser.status}
                        </span>
                    </div>
                </div>

                {/* Account Info */}
                <div className="p-4 bg-white dark:bg-navy-800 rounded-lg border border-slate-200 dark:border-white/10">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="text-slate-500 dark:text-slate-400">Email</p>
                            <p className="font-medium text-slate-900 dark:text-white">{currentUser.email}</p>
                        </div>
                        <div>
                            <p className="text-slate-500 dark:text-slate-400">Role</p>
                            <p className="font-medium text-slate-900 dark:text-white">{currentUser.role || 'USER'}</p>
                        </div>
                        <div>
                            <p className="text-slate-500 dark:text-slate-400">Organization</p>
                            <p className="font-medium text-slate-900 dark:text-white">{currentUser.companyName || 'N/A'}</p>
                        </div>
                        <div>
                            <p className="text-slate-500 dark:text-slate-400">2FA Status</p>
                            <p className={`font-medium ${currentUser.mfaEnabled ? 'text-green-600' : 'text-orange-500'}`}>
                                {currentUser.mfaEnabled ? 'Enabled' : 'Disabled'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Export Data */}
                <div className="p-4 bg-white dark:bg-navy-800 rounded-lg border border-slate-200 dark:border-white/10">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-slate-900 dark:text-white">
                                {t('settings.account.exportData', 'Export Your Data')}
                            </p>
                            <p className="text-sm text-slate-500">
                                {t('settings.account.exportDesc', 'Download a copy of all your data in JSON format')}
                            </p>
                        </div>
                        <button 
                            onClick={handleExportData}
                            disabled={exporting}
                            className="px-4 py-2 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-700 dark:text-white rounded-lg transition-colors disabled:opacity-50"
                        >
                            {exporting ? 'Exporting...' : t('settings.account.export', 'Export')}
                        </button>
                    </div>
                </div>

                {/* Delete Account */}
                <div className="p-4 bg-red-50 dark:bg-red-500/10 rounded-lg border border-red-200 dark:border-red-500/20">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-red-700 dark:text-red-400">
                                {t('settings.account.deleteAccount', 'Delete Account')}
                            </p>
                            <p className="text-sm text-red-600 dark:text-red-300">
                                {t('settings.account.deleteDesc', 'Permanently delete your account and all associated data')}
                            </p>
                        </div>
                        <button 
                            onClick={() => setShowDeleteConfirm(true)}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                        >
                            {t('settings.account.delete', 'Delete')}
                        </button>
                    </div>

                    {/* Delete Confirmation */}
                    {showDeleteConfirm && (
                        <div className="mt-4 p-4 bg-white dark:bg-navy-900 rounded-lg border border-red-300 dark:border-red-500/30">
                            <p className="text-sm text-red-700 dark:text-red-300 mb-3">
                                This action cannot be undone. Type <strong>DELETE</strong> to confirm:
                            </p>
                            <input
                                type="text"
                                value={deleteConfirmText}
                                onChange={(e) => setDeleteConfirmText(e.target.value)}
                                placeholder="Type DELETE"
                                className="w-full px-3 py-2 border border-red-300 dark:border-red-500/30 rounded-lg mb-3"
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        setShowDeleteConfirm(false);
                                        setDeleteConfirmText('');
                                    }}
                                    className="px-4 py-2 bg-slate-200 dark:bg-white/10 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteAccount}
                                    disabled={deleteConfirmText !== 'DELETE'}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg disabled:opacity-50"
                                >
                                    Delete Forever
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export const ProfileModule: React.FC<ProfileModuleProps> = ({ 
    initialTab,
    currentUser,
    onUpdateUser,
    theme,
    toggleTheme
}) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState(initialTab || 'personal');

    const tabs: Tab[] = [
        { 
            id: 'personal', 
            label: t('settings.tabs.personal', 'Personal Info'), 
            icon: <UserIcon size={16} /> 
        },
        { 
            id: 'avatar', 
            label: t('settings.tabs.avatar', 'Avatar'), 
            icon: <Image size={16} /> 
        },
        { 
            id: 'connected', 
            label: t('settings.tabs.connected', 'Connected'), 
            icon: <Link2 size={16} /> 
        },
        { 
            id: 'permissions', 
            label: t('settings.tabs.permissions', 'Requests'), 
            icon: <Send size={16} /> 
        },
        { 
            id: 'activity', 
            label: t('settings.tabs.activity', 'Activity'), 
            icon: <Activity size={16} /> 
        },
        { 
            id: 'password', 
            label: t('settings.tabs.password', 'Password'), 
            icon: <Key size={16} /> 
        },
        { 
            id: 'billing', 
            label: t('settings.tabs.billing', 'Billing'), 
            icon: <CreditCard size={16} /> 
        },
        { 
            id: 'account', 
            label: t('settings.tabs.account', 'Account'), 
            icon: <Settings size={16} /> 
        },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'personal':
                return (
                    <div className="space-y-6">
                        {/* Profile Completeness - Compact version at top */}
                        <ProfileCompleteness 
                            currentUser={currentUser} 
                            onNavigate={setActiveTab}
                            compact={true}
                        />
                        <ProfileSettings
                            currentUser={currentUser}
                            onUpdateUser={onUpdateUser}
                            theme={theme}
                            toggleTheme={toggleTheme}
                        />
                    </div>
                );
            case 'avatar':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <AvatarUploader currentUser={currentUser} onUpdateUser={onUpdateUser} />
                    </div>
                );
            case 'connected':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <ConnectedAccounts currentUser={currentUser} onUpdateUser={onUpdateUser} />
                    </div>
                );
            case 'permissions':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <PermissionRequestSection currentUser={currentUser} />
                    </div>
                );
            case 'activity':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <ActivityLog currentUser={currentUser} />
                    </div>
                );
            case 'password':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <PasswordSettings currentUser={currentUser} />
                    </div>
                );
            case 'billing':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <BillingSettings currentUser={currentUser} />
                    </div>
                );
            case 'account':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <AccountSettings currentUser={currentUser} />
                    </div>
                );
            default:
                return (
                    <ProfileSettings
                        currentUser={currentUser}
                        onUpdateUser={onUpdateUser}
                        theme={theme}
                        toggleTheme={toggleTheme}
                    />
                );
        }
    };

    return (
        <TabLayout
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            title={t('settings.modules.profile', 'Profile')}
            subtitle={t('settings.modules.profileDesc', 'Manage your personal information and account settings')}
        >
            {renderContent()}
        </TabLayout>
    );
};

export default ProfileModule;
