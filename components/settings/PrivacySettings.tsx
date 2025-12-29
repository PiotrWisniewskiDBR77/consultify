/**
 * PrivacySettings Component
 * 
 * User privacy preferences:
 * - Show online status
 * - Activity visibility
 * - Profile visibility
 * - Allow mentions
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User } from '../../types';
import { useTranslation } from 'react-i18next';
import { 
    Shield, 
    Eye, 
    EyeOff, 
    Users, 
    UserCircle, 
    AtSign,
    Save,
    Loader2,
    Globe,
    Lock,
    Building2,
    FileText,
    Cookie,
    Database,
    ExternalLink
} from 'lucide-react';
import { Api } from '../../services/api';
import { toast } from 'react-hot-toast';
import { InfoButton } from '../shared/InfoButton';

interface PrivacySettingsProps {
    currentUser: User;
    onUpdateUser: (updates: Partial<User>) => void;
}

interface PrivacyPreferences {
    showOnlineStatus: boolean;
    activityVisibility: 'all' | 'team' | 'private';
    profileVisibility: 'public' | 'organization' | 'private';
    allowMentions: boolean;
    showInDirectory: boolean;
    shareActivityWithAI: boolean;
}

const DEFAULT_PREFERENCES: PrivacyPreferences = {
    showOnlineStatus: true,
    activityVisibility: 'team',
    profileVisibility: 'organization',
    allowMentions: true,
    showInDirectory: true,
    shareActivityWithAI: true
};

export const PrivacySettings: React.FC<PrivacySettingsProps> = ({ currentUser, onUpdateUser }) => {
    const { t } = useTranslation();
    const [preferences, setPreferences] = useState<PrivacyPreferences>(DEFAULT_PREFERENCES);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadPreferences();
    }, [currentUser.id]);

    const loadPreferences = async () => {
        try {
            const data = await Api.get('/settings/preferences/privacy');
            if (data.preferences) {
                setPreferences({ ...DEFAULT_PREFERENCES, ...data.preferences });
            }
        } catch (error) {
            console.error('Failed to load privacy preferences:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await Api.put('/settings/preferences/privacy', { preferences });
            toast.success(t('settings.privacy.saved', 'Privacy settings saved'));
        } catch (error) {
            toast.error(t('settings.privacy.error', 'Failed to save preferences'));
        } finally {
            setSaving(false);
        }
    };

    const updatePreference = <K extends keyof PrivacyPreferences>(key: K, value: PrivacyPreferences[K]) => {
        setPreferences(prev => ({ ...prev, [key]: value }));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 size={32} className="animate-spin text-purple-600" />
            </div>
        );
    }

    const activityVisibilityOptions = [
        { value: 'all', label: t('settings.privacy.visibility.all', 'Everyone'), icon: Globe, description: 'All users can see your activity' },
        { value: 'team', label: t('settings.privacy.visibility.team', 'Team Only'), icon: Users, description: 'Only your team members' },
        { value: 'private', label: t('settings.privacy.visibility.private', 'Private'), icon: Lock, description: 'Only you can see' }
    ];

    const profileVisibilityOptions = [
        { value: 'public', label: t('settings.privacy.profile.public', 'Public'), icon: Globe, description: 'Anyone can view your profile' },
        { value: 'organization', label: t('settings.privacy.profile.organization', 'Organization'), icon: Building2, description: 'Only organization members' },
        { value: 'private', label: t('settings.privacy.profile.private', 'Private'), icon: Lock, description: 'Profile hidden from others' }
    ];

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
            <InfoButton cardId="settings-profile" position="top-right" />
            
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <Shield size={28} className="text-purple-500" />
                        {t('settings.privacy.title', 'Privacy')}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        {t('settings.privacy.description', 'Control who can see your information and activity')}
                    </p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {saving ? t('settings.saving', 'Saving...') : t('settings.save', 'Save Changes')}
                </button>
            </div>

            {/* Online Status */}
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Eye size={20} className="text-green-500" />
                    {t('settings.privacy.statusTitle', 'Online Status')}
                </h3>
                
                <div className="space-y-6">
                    {/* Show Online Status */}
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="block font-medium text-slate-700 dark:text-slate-300">
                                {t('settings.privacy.showOnlineStatus', 'Show Online Status')}
                            </label>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {t('settings.privacy.showOnlineStatusDescription', 'Let others see when you are online')}
                            </p>
                        </div>
                        <button
                            onClick={() => updatePreference('showOnlineStatus', !preferences.showOnlineStatus)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                preferences.showOnlineStatus ? 'bg-green-600' : 'bg-slate-200 dark:bg-slate-700'
                            }`}
                        >
                            <span className={`${preferences.showOnlineStatus ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                        </button>
                    </div>

                    {/* Show in Directory */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/5">
                        <div>
                            <label className="block font-medium text-slate-700 dark:text-slate-300">
                                {t('settings.privacy.showInDirectory', 'Show in Team Directory')}
                            </label>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {t('settings.privacy.showInDirectoryDescription', 'Appear in the organization member directory')}
                            </p>
                        </div>
                        <button
                            onClick={() => updatePreference('showInDirectory', !preferences.showInDirectory)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                preferences.showInDirectory ? 'bg-green-600' : 'bg-slate-200 dark:bg-slate-700'
                            }`}
                        >
                            <span className={`${preferences.showInDirectory ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Activity Visibility */}
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Users size={20} className="text-blue-500" />
                    {t('settings.privacy.activityTitle', 'Activity Visibility')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    {t('settings.privacy.activityDescription', 'Choose who can see your recent activity and contributions')}
                </p>
                
                <div className="grid grid-cols-3 gap-4">
                    {activityVisibilityOptions.map(option => {
                        const Icon = option.icon;
                        const isSelected = preferences.activityVisibility === option.value;
                        return (
                            <button
                                key={option.value}
                                onClick={() => updatePreference('activityVisibility', option.value as PrivacyPreferences['activityVisibility'])}
                                className={`p-4 rounded-xl border-2 transition-all text-left ${
                                    isSelected
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                                        : 'border-slate-200 dark:border-white/10 hover:border-blue-300 dark:hover:border-blue-500/50'
                                }`}
                            >
                                <Icon size={24} className={isSelected ? 'text-blue-600' : 'text-slate-400'} />
                                <div className={`mt-2 font-medium ${isSelected ? 'text-blue-700 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                    {option.label}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">{option.description}</div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Profile Visibility */}
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <UserCircle size={20} className="text-purple-500" />
                    {t('settings.privacy.profileTitle', 'Profile Visibility')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    {t('settings.privacy.profileDescription', 'Control who can view your profile information')}
                </p>
                
                <div className="grid grid-cols-3 gap-4">
                    {profileVisibilityOptions.map(option => {
                        const Icon = option.icon;
                        const isSelected = preferences.profileVisibility === option.value;
                        return (
                            <button
                                key={option.value}
                                onClick={() => updatePreference('profileVisibility', option.value as PrivacyPreferences['profileVisibility'])}
                                className={`p-4 rounded-xl border-2 transition-all text-left ${
                                    isSelected
                                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/10'
                                        : 'border-slate-200 dark:border-white/10 hover:border-purple-300 dark:hover:border-purple-500/50'
                                }`}
                            >
                                <Icon size={24} className={isSelected ? 'text-purple-600' : 'text-slate-400'} />
                                <div className={`mt-2 font-medium ${isSelected ? 'text-purple-700 dark:text-purple-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                    {option.label}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">{option.description}</div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Communication & AI */}
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <AtSign size={20} className="text-amber-500" />
                    {t('settings.privacy.communicationTitle', 'Communication & AI')}
                </h3>
                
                <div className="space-y-6">
                    {/* Allow Mentions */}
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="block font-medium text-slate-700 dark:text-slate-300">
                                {t('settings.privacy.allowMentions', 'Allow @Mentions')}
                            </label>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {t('settings.privacy.allowMentionsDescription', 'Let others mention you in comments and discussions')}
                            </p>
                        </div>
                        <button
                            onClick={() => updatePreference('allowMentions', !preferences.allowMentions)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                preferences.allowMentions ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-700'
                            }`}
                        >
                            <span className={`${preferences.allowMentions ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                        </button>
                    </div>

                    {/* Share Activity with AI */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/5">
                        <div>
                            <label className="block font-medium text-slate-700 dark:text-slate-300">
                                {t('settings.privacy.shareWithAI', 'Share Activity with AI')}
                            </label>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {t('settings.privacy.shareWithAIDescription', 'Allow AI assistant to use your activity for personalized recommendations')}
                            </p>
                        </div>
                        <button
                            onClick={() => updatePreference('shareActivityWithAI', !preferences.shareActivityWithAI)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                preferences.shareActivityWithAI ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-700'
                            }`}
                        >
                            <span className={`${preferences.shareActivityWithAI ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Privacy Documents Section */}
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <FileText size={20} className="text-slate-500" />
                    {t('settings.privacy.documents', 'Privacy Documents')}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <PrivacyDocLink
                        to="/privacy"
                        icon={<Shield className="w-4 h-4" />}
                        title="Privacy Policy"
                        description="How we handle your data"
                    />
                    <PrivacyDocLink
                        to="/cookies"
                        icon={<Cookie className="w-4 h-4" />}
                        title="Cookie Policy"
                        description="Cookies & tracking"
                    />
                    <PrivacyDocLink
                        to="/legal/dpa"
                        icon={<Database className="w-4 h-4" />}
                        title="Data Processing"
                        description="GDPR DPA terms"
                    />
                    <PrivacyDocLink
                        to="/legal/subprocessors"
                        icon={<Users className="w-4 h-4" />}
                        title="Sub-processors"
                        description="Third-party services"
                    />
                </div>
            </div>
        </div>
    );
};

interface PrivacyDocLinkProps {
    to: string;
    icon: React.ReactNode;
    title: string;
    description: string;
}

const PrivacyDocLink: React.FC<PrivacyDocLinkProps> = ({ to, icon, title, description }) => (
    <Link
        to={to}
        className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-white/5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors group"
    >
        <div className="text-slate-400 dark:text-slate-500 group-hover:text-purple-600 dark:group-hover:text-purple-400 mt-0.5">
            {icon}
        </div>
        <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200 group-hover:text-purple-600 dark:group-hover:text-purple-400">
                    {title}
                </span>
                <ExternalLink className="w-3 h-3 text-slate-400 dark:text-slate-500" />
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">{description}</span>
        </div>
    </Link>
);

export default PrivacySettings;

