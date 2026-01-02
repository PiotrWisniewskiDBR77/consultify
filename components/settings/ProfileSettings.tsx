
import React, { useState, useEffect, useMemo } from 'react';
import { User } from '../../types';
import { useTranslation } from 'react-i18next';
import { UserCircle, Mail, Phone, Building2, Save, Loader2, CheckCircle, Globe, Briefcase, Clock, Calendar } from 'lucide-react';
import { Api } from '../../services/api';
import { MFASetup } from '../../components/Profile/MFASetup';
import { InfoButton } from '../shared/InfoButton';

interface ProfileSettingsProps {
    currentUser: User;
    onUpdateUser: (updates: Partial<User>) => void;
    theme: 'light' | 'dark' | 'system';
    toggleTheme: (newTheme?: 'light' | 'dark' | 'system') => void;
}

// Job title suggestions
const JOB_TITLE_SUGGESTIONS = [
    'CEO', 'CTO', 'CFO', 'COO', 'CMO',
    'VP of Engineering', 'VP of Product', 'VP of Operations',
    'Director', 'Senior Manager', 'Manager',
    'Project Manager', 'Product Manager', 'Program Manager',
    'Team Lead', 'Tech Lead', 'Engineering Lead',
    'Senior Developer', 'Developer', 'Software Engineer',
    'Business Analyst', 'Data Analyst', 'Data Scientist',
    'Consultant', 'Senior Consultant', 'Principal Consultant',
    'Designer', 'UX Designer', 'Product Designer',
    'Other'
];

// Common timezones
const COMMON_TIMEZONES = [
    { value: 'Europe/Warsaw', label: 'Warsaw (CET/CEST)' },
    { value: 'Europe/London', label: 'London (GMT/BST)' },
    { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
    { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
    { value: 'America/New_York', label: 'New York (EST/EDT)' },
    { value: 'America/Chicago', label: 'Chicago (CST/CDT)' },
    { value: 'America/Denver', label: 'Denver (MST/MDT)' },
    { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)' },
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
    { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
    { value: 'Asia/Dubai', label: 'Dubai (GST)' },
    { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
    { value: 'UTC', label: 'UTC' },
];

// Date format options
const DATE_FORMATS = [
    { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (31/12/2024)' },
    { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (12/31/2024)' },
    { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2024-12-31)' },
    { value: 'DD.MM.YYYY', label: 'DD.MM.YYYY (31.12.2024)' },
];

// Time format options
const TIME_FORMATS = [
    { value: '24h', label: '24-hour (14:30)' },
    { value: '12h', label: '12-hour (2:30 PM)' },
];

// Simple debounce implementation if lodash is not available
const useDebounce = (value: any, delay: number) => {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
};

// Extended User type for new fields
interface ExtendedFormState {
    firstName: string;
    lastName: string;
    phone: string;
    companyName: string;
    jobTitle: string;
    timezone: string;
    dateFormat: string;
    timeFormat: string;
}

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({ currentUser, onUpdateUser, theme, toggleTheme }) => {
    const { t, i18n } = useTranslation();
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [showJobTitleSuggestions, setShowJobTitleSuggestions] = useState(false);

    const [formState, setFormState] = useState<ExtendedFormState>({
        firstName: currentUser.firstName || '',
        lastName: currentUser.lastName || '',
        phone: currentUser.phone || '',
        companyName: currentUser.companyName || '',
        jobTitle: (currentUser as any).jobTitle || '',
        timezone: currentUser.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        dateFormat: (currentUser as any).dateFormat || 'DD/MM/YYYY',
        timeFormat: (currentUser as any).timeFormat || '24h',
    });

    // Debounced auto-save
    const debouncedFormState = useDebounce(formState, 1000);

    // Filter job title suggestions
    const filteredJobTitles = useMemo(() => {
        if (!formState.jobTitle) return JOB_TITLE_SUGGESTIONS;
        return JOB_TITLE_SUGGESTIONS.filter(title => 
            title.toLowerCase().includes(formState.jobTitle.toLowerCase())
        );
    }, [formState.jobTitle]);

    // Initial state sync
    useEffect(() => {
        setFormState({
            firstName: currentUser.firstName || '',
            lastName: currentUser.lastName || '',
            phone: currentUser.phone || '',
            companyName: currentUser.companyName || '',
            jobTitle: (currentUser as any).jobTitle || '',
            timezone: currentUser.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
            dateFormat: (currentUser as any).dateFormat || 'DD/MM/YYYY',
            timeFormat: (currentUser as any).timeFormat || '24h',
        });
    }, [currentUser]);

    // Handle manual save
    const handleSave = async () => {
        setIsSaving(true);
        try {
            await Api.updateUser(currentUser.id, formState);
            onUpdateUser(formState);
            setSaveStatus('success');
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (error) {
            setSaveStatus('error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
            <InfoButton cardId="settings-profile" position="top-right" />
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-navy-900 dark:text-white">{t('settings.profile.header', 'Personal Information')}</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{t('settings.profile.manage', 'Manage your personal information and preferences')}</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20"
                >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {isSaving ? t('settings.profile.saving', 'Saving...') : t('settings.profile.save', 'Save Changes')}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Left Column: Avatar & Basic Info */}
                <div className="md:col-span-1 space-y-6">
                    <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg p-6 flex flex-col items-center text-center">
                        <div className="relative group cursor-pointer mb-4">
                            <div className="w-32 h-32 rounded-full bg-slate-100 dark:bg-navy-800 border-4 border-white dark:border-navy-900 shadow-xl overflow-hidden flex items-center justify-center">
                                {currentUser.avatarUrl ? (
                                    <img src={currentUser.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <UserCircle size={64} className="text-slate-300 dark:text-slate-600" />
                                )}
                            </div>
                            <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-white text-xs font-medium">{t('settings.profile.changePhoto', 'Change Photo')}</span>
                            </div>
                        </div>
                        <h3 className="text-lg font-bold text-navy-900 dark:text-white">{currentUser.firstName} {currentUser.lastName}</h3>
                        <p className="text-purple-600 dark:text-purple-400 text-sm font-medium">{currentUser.companyName}</p>
                        <div className="mt-4 flex flex-col items-start w-full gap-2 text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-navy-950 p-4 rounded-lg">
                            <div className="flex items-center gap-2">
                                <Mail size={14} />
                                <span className="truncate">{currentUser.email}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Building2 size={14} />
                                <span className="truncate">{currentUser.role}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Edit Form */}
                <div className="md:col-span-2 space-y-6">
                    <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg p-6">
                        <h4 className="text-sm font-bold text-navy-900 dark:text-white mb-6 uppercase tracking-wider border-b border-slate-100 dark:border-white/5 pb-2">{t('settings.profile.header', 'Personal Information')}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('settings.profile.firstName', 'First Name')}</label>
                                <input
                                    value={formState.firstName}
                                    onChange={e => setFormState({ ...formState, firstName: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-white/10 rounded-md text-navy-900 dark:text-white focus:ring-2 focus:ring-purple-500/50 outline-none transition-all"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('settings.profile.lastName', 'Last Name')}</label>
                                <input
                                    value={formState.lastName}
                                    onChange={e => setFormState({ ...formState, lastName: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-white/10 rounded-md text-navy-900 dark:text-white focus:ring-2 focus:ring-purple-500/50 outline-none transition-all"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('auth.phone')}</label>
                                <div className="relative">
                                    <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        value={formState.phone}
                                        onChange={e => setFormState({ ...formState, phone: e.target.value })}
                                        className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-white/10 rounded-md text-navy-900 dark:text-white focus:ring-2 focus:ring-purple-500/50 outline-none transition-all"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('settings.profile.company', 'Company')}</label>
                                <div className="relative">
                                    <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        value={formState.companyName}
                                        onChange={e => setFormState({ ...formState, companyName: e.target.value })}
                                        className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-white/10 rounded-md text-navy-900 dark:text-white focus:ring-2 focus:ring-purple-500/50 outline-none transition-all"
                                    />
                                </div>
                            </div>
                            {/* Job Title with autocomplete */}
                            <div className="space-y-1.5 md:col-span-2">
                                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('settings.profile.jobTitle', 'Job Title')}</label>
                                <div className="relative">
                                    <Briefcase size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        value={formState.jobTitle}
                                        onChange={e => setFormState({ ...formState, jobTitle: e.target.value })}
                                        onFocus={() => setShowJobTitleSuggestions(true)}
                                        onBlur={() => setTimeout(() => setShowJobTitleSuggestions(false), 200)}
                                        placeholder={t('settings.profile.jobTitlePlaceholder', 'e.g. Product Manager, Developer...')}
                                        className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-white/10 rounded-md text-navy-900 dark:text-white focus:ring-2 focus:ring-purple-500/50 outline-none transition-all"
                                    />
                                    {/* Suggestions dropdown */}
                                    {showJobTitleSuggestions && filteredJobTitles.length > 0 && (
                                        <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto bg-white dark:bg-navy-800 border border-slate-200 dark:border-white/10 rounded-lg shadow-lg">
                                            {filteredJobTitles.map((title) => (
                                                <button
                                                    key={title}
                                                    type="button"
                                                    onClick={() => {
                                                        setFormState({ ...formState, jobTitle: title });
                                                        setShowJobTitleSuggestions(false);
                                                    }}
                                                    className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors"
                                                >
                                                    {title}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Regional Settings */}
                    <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg p-6">
                        <h4 className="text-sm font-bold text-navy-900 dark:text-white mb-6 uppercase tracking-wider border-b border-slate-100 dark:border-white/5 pb-2">
                            {t('settings.profile.regional', 'Regional Settings')}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Timezone */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('settings.profile.timezone', 'Timezone')}</label>
                                <div className="relative">
                                    <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    <select
                                        value={formState.timezone}
                                        onChange={e => setFormState({ ...formState, timezone: e.target.value })}
                                        className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-white/10 rounded-md text-navy-900 dark:text-white focus:ring-2 focus:ring-purple-500/50 outline-none transition-all appearance-none cursor-pointer"
                                    >
                                        {COMMON_TIMEZONES.map(tz => (
                                            <option key={tz.value} value={tz.value}>{tz.label}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </div>
                                <p className="text-xs text-slate-400 mt-1">
                                    {t('settings.profile.timezoneHint', 'Current local time:')} {new Date().toLocaleTimeString('en-US', { timeZone: formState.timezone, hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>

                            {/* Date Format */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('settings.profile.dateFormat', 'Date Format')}</label>
                                <div className="relative">
                                    <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    <select
                                        value={formState.dateFormat}
                                        onChange={e => setFormState({ ...formState, dateFormat: e.target.value })}
                                        className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-white/10 rounded-md text-navy-900 dark:text-white focus:ring-2 focus:ring-purple-500/50 outline-none transition-all appearance-none cursor-pointer"
                                    >
                                        {DATE_FORMATS.map(fmt => (
                                            <option key={fmt.value} value={fmt.value}>{fmt.label}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </div>
                            </div>

                            {/* Time Format */}
                            <div className="space-y-1.5 md:col-span-2">
                                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 block">{t('settings.profile.timeFormat', 'Time Format')}</label>
                                <div className="flex gap-4">
                                    {TIME_FORMATS.map(fmt => (
                                        <label 
                                            key={fmt.value}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-all ${
                                                formState.timeFormat === fmt.value 
                                                    ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border-2 border-purple-500' 
                                                    : 'bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-purple-300'
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name="timeFormat"
                                                value={fmt.value}
                                                checked={formState.timeFormat === fmt.value}
                                                onChange={e => setFormState({ ...formState, timeFormat: e.target.value })}
                                                className="sr-only"
                                            />
                                            <span className="text-sm font-medium">{fmt.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* PREFERENCES (Now stripped of Language) */}
                    <div>
                        <label className="text-xs font-medium text-slate-500 mb-2 block uppercase tracking-wider">{t('settings.profile.preferences', 'Preferences')}</label>
                        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg p-6 space-y-6">

                            <div className="flex items-center justify-between">
                                <div>
                                    <label className="text-sm font-medium text-navy-900 dark:text-white flex items-center gap-2">{t('settings.profile.theme', 'Interface Theme')}</label>
                                    <p className="text-xs text-slate-500 mt-1">Select your interface color theme.</p>
                                </div>
                                <div className="flex bg-slate-100 dark:bg-navy-950 p-1 rounded-lg">
                                    <button
                                        onClick={() => toggleTheme('light')}
                                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${theme === 'light' ? 'bg-white shadow text-navy-900' : 'text-slate-500'}`}
                                    >
                                        {t('settings.profile.light', 'Light')}
                                    </button>
                                    <button
                                        onClick={() => toggleTheme('dark')}
                                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${theme === 'dark' ? 'bg-navy-800 shadow text-white' : 'text-slate-500'}`}
                                    >
                                        {t('settings.profile.dark', 'Dark')}
                                    </button>
                                    <button
                                        onClick={() => toggleTheme('system')}
                                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${theme === 'system' ? 'bg-white dark:bg-navy-800 shadow text-purple-600' : 'text-slate-500'}`}
                                    >
                                        System
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-6 border-t border-slate-100 dark:border-white/5">
                                <div>
                                    <label className="text-sm font-medium text-navy-900 dark:text-white flex items-center gap-2">{t('settings.profile.language', 'Language')}</label>
                                    <p className="text-xs text-slate-500 mt-1">Select your preferred language.</p>
                                </div>
                                <div className="flex bg-slate-100 dark:bg-navy-950 p-1 rounded-lg">
                                    <button
                                        onClick={() => i18n.changeLanguage('en')}
                                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${i18n.language === 'en' ? 'bg-white shadow text-navy-900' : 'text-slate-500 hover:text-navy-700'}`}
                                    >
                                        {t('common.languages.en')}
                                    </button>
                                    <button
                                        onClick={() => i18n.changeLanguage('pl')}
                                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${i18n.language === 'pl' ? 'bg-white shadow text-navy-900' : 'text-slate-500 hover:text-navy-700'}`}
                                    >
                                        {t('common.languages.pl')}
                                    </button>
                                    <button
                                        onClick={() => i18n.changeLanguage('de')}
                                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${i18n.language === 'de' ? 'bg-white shadow text-navy-900' : 'text-slate-500 hover:text-navy-700'}`}
                                    >
                                        {t('common.languages.de')}
                                    </button>
                                    <button
                                        onClick={() => i18n.changeLanguage('ar')}
                                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${i18n.language === 'ar' ? 'bg-white shadow text-navy-900' : 'text-slate-500 hover:text-navy-700'}`}
                                    >
                                        {t('common.languages.ar')}
                                    </button>
                                    <button
                                        onClick={() => i18n.changeLanguage('ja')}
                                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${i18n.language === 'ja' ? 'bg-white shadow text-navy-900' : 'text-slate-500 hover:text-navy-700'}`}
                                    >
                                        {t('common.languages.ja')}
                                    </button>
                                    <button
                                        onClick={() => i18n.changeLanguage('es')}
                                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${i18n.language === 'es' ? 'bg-white shadow text-navy-900' : 'text-slate-500 hover:text-navy-700'}`}
                                    >
                                        {t('common.languages.es')}
                                    </button>
                                </div>
                            </div>


                        </div>
                    </div>
                </div>
            </div>

            {/* MFA Settings - Outside Grid */}
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg p-6">
                <label className="text-sm font-bold text-navy-900 dark:text-white mb-6 uppercase tracking-wider block border-b border-slate-100 dark:border-white/5 pb-2">Security</label>
                <MFASetup
                    isEnabled={!!currentUser.mfaEnabled}
                    onUpdate={() => {
                        window.location.reload();
                    }}
                />
            </div>

            {saveStatus === 'success' && (
                <div className="fixed bottom-8 right-8 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
                    <CheckCircle size={16} />
                    {t('settings.profile.saved', 'Saved!')}
                </div>
            )}
        </div>
    );
};
