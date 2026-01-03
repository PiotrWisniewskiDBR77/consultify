
import React, { useState, useEffect, useMemo } from 'react';
import { User } from '../../types';
import { useTranslation } from 'react-i18next';
import {
    UserCircle, Mail, Phone, Building2, Save, Loader2, CheckCircle, Globe,
    Briefcase, Clock, Calendar, Users, MessageCircle, CalendarOff, User as UserIcon
} from 'lucide-react';
import { Api } from '../../services/api';
import { InfoButton } from '../shared/InfoButton';

interface ProfileSettingsProps {
    currentUser: User;
    onUpdateUser: (updates: Partial<User>) => void;
    theme?: 'light' | 'dark' | 'system';
    toggleTheme?: (newTheme?: 'light' | 'dark' | 'system') => void;
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

// Pronouns options
const PRONOUNS_OPTIONS = [
    { value: '', label: 'Prefer not to say' },
    { value: 'he/him', label: 'He/Him' },
    { value: 'she/her', label: 'She/Her' },
    { value: 'they/them', label: 'They/Them' },
    { value: 'other', label: 'Other' },
];

// Department options
const DEPARTMENT_OPTIONS = [
    { value: '', label: 'Select department...' },
    { value: 'Engineering', label: 'Engineering' },
    { value: 'Product', label: 'Product' },
    { value: 'Design', label: 'Design' },
    { value: 'Marketing', label: 'Marketing' },
    { value: 'Sales', label: 'Sales' },
    { value: 'Operations', label: 'Operations' },
    { value: 'Finance', label: 'Finance' },
    { value: 'HR', label: 'Human Resources' },
    { value: 'Legal', label: 'Legal' },
    { value: 'Customer Success', label: 'Customer Success' },
    { value: 'Support', label: 'Support' },
    { value: 'Executive', label: 'Executive' },
    { value: 'Other', label: 'Other' },
];

// Extended form state type
interface ExtendedFormState {
    firstName: string;
    lastName: string;
    phone: string;
    companyName: string;
    jobTitle: string;
    timezone: string;
    dateFormat: string;
    timeFormat: string;
    linkedinId: string;
    // New fields
    displayName: string;
    pronouns: string;
    department: string;
    statusMessage: string;
    isOutOfOffice: boolean;
    outOfOfficeUntil: string;
    outOfOfficeMessage: string;
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
        jobTitle: currentUser.jobTitle || '',
        timezone: currentUser.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        dateFormat: currentUser.dateFormat || 'DD/MM/YYYY',
        timeFormat: currentUser.timeFormat || '24h',
        linkedinId: currentUser.linkedinId || '',
        // New fields
        displayName: currentUser.displayName || '',
        pronouns: currentUser.pronouns || '',
        department: currentUser.department || '',
        statusMessage: currentUser.statusMessage || '',
        isOutOfOffice: currentUser.isOutOfOffice || false,
        outOfOfficeUntil: currentUser.outOfOfficeUntil || '',
        outOfOfficeMessage: currentUser.outOfOfficeMessage || '',
    });

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
            jobTitle: currentUser.jobTitle || '',
            timezone: currentUser.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
            dateFormat: currentUser.dateFormat || 'DD/MM/YYYY',
            timeFormat: currentUser.timeFormat || '24h',
            linkedinId: currentUser.linkedinId || '',
            displayName: currentUser.displayName || '',
            pronouns: currentUser.pronouns || '',
            department: currentUser.department || '',
            statusMessage: currentUser.statusMessage || '',
            isOutOfOffice: currentUser.isOutOfOffice || false,
            outOfOfficeUntil: currentUser.outOfOfficeUntil || '',
            outOfOfficeMessage: currentUser.outOfOfficeMessage || '',
        });
    }, [currentUser]);

    // Handle manual save
    const handleSave = async () => {
        setIsSaving(true);
        try {
            await Api.updateUser(currentUser.id, formState as any);
            onUpdateUser(formState as any);
            setSaveStatus('success');
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (error) {
            setSaveStatus('error');
        } finally {
            setIsSaving(false);
        }
    };

    // Input class for consistent styling
    const inputClass = "w-full px-3 py-2 bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-white/10 rounded-md text-navy-900 dark:text-white focus:ring-2 focus:ring-purple-500/50 outline-none transition-all";
    const inputWithIconClass = "w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-white/10 rounded-md text-navy-900 dark:text-white focus:ring-2 focus:ring-purple-500/50 outline-none transition-all";
    const selectClass = "w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-white/10 rounded-md text-navy-900 dark:text-white focus:ring-2 focus:ring-purple-500/50 outline-none transition-all appearance-none cursor-pointer";
    const labelClass = "text-xs font-medium text-slate-500 dark:text-slate-400";
    const sectionTitleClass = "text-sm font-bold text-navy-900 dark:text-white mb-6 uppercase tracking-wider border-b border-slate-100 dark:border-white/5 pb-2";
    const cardClass = "bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg p-6";

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
            <InfoButton cardId="settings-profile" position="top-right" />

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-navy-900 dark:text-white">
                        {t('settings.profile.header', 'Personal Information')}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        {t('settings.profile.manage', 'Manage your personal information and preferences')}
                    </p>
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
                    <div className={cardClass + " flex flex-col items-center text-center"}>
                        <div className="relative group cursor-pointer mb-4">
                            <div className="w-32 h-32 rounded-full bg-slate-100 dark:bg-navy-800 border-4 border-white dark:border-navy-900 shadow-xl overflow-hidden flex items-center justify-center">
                                {currentUser.avatarUrl ? (
                                    <img src={currentUser.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <UserCircle size={64} className="text-slate-300 dark:text-slate-600" />
                                )}
                            </div>
                            <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-white text-xs font-medium">
                                    {t('settings.profile.changePhoto', 'Change Photo')}
                                </span>
                            </div>
                        </div>
                        <h3 className="text-lg font-bold text-navy-900 dark:text-white">
                            {formState.displayName || `${currentUser.firstName} ${currentUser.lastName}`}
                        </h3>
                        {formState.pronouns && (
                            <p className="text-slate-400 text-xs">({formState.pronouns})</p>
                        )}
                        <p className="text-purple-600 dark:text-purple-400 text-sm font-medium">{currentUser.companyName}</p>

                        {/* Status Badge */}
                        {(formState.statusMessage || formState.isOutOfOffice) && (
                            <div className="mt-3 w-full">
                                {formState.isOutOfOffice ? (
                                    <div className="flex items-center justify-center gap-2 px-3 py-1.5 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-full text-xs font-medium">
                                        <CalendarOff size={12} />
                                        Out of Office
                                        {formState.outOfOfficeUntil && (
                                            <span>until {new Date(formState.outOfOfficeUntil).toLocaleDateString()}</span>
                                        )}
                                    </div>
                                ) : formState.statusMessage && (
                                    <div className="flex items-center justify-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300 rounded-full text-xs font-medium">
                                        <MessageCircle size={12} />
                                        {formState.statusMessage}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="mt-4 flex flex-col items-start w-full gap-2 text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-navy-950 p-4 rounded-lg">
                            <div className="flex items-center gap-2">
                                <Mail size={14} />
                                <span className="truncate">{currentUser.email}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Building2 size={14} />
                                <span className="truncate">{currentUser.role}</span>
                            </div>
                            {formState.department && (
                                <div className="flex items-center gap-2">
                                    <Users size={14} />
                                    <span className="truncate">{formState.department}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Edit Form */}
                <div className="md:col-span-2 space-y-6">

                    {/* Public Profile Section */}
                    <div className={cardClass}>
                        <h4 className={sectionTitleClass}>
                            {t('settings.profile.publicProfile', 'Public Profile')}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1.5 md:col-span-2">
                                <label className={labelClass}>
                                    {t('settings.profile.displayName', 'Display Name')}
                                </label>
                                <div className="relative">
                                    <UserIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        value={formState.displayName}
                                        onChange={e => setFormState({ ...formState, displayName: e.target.value })}
                                        placeholder={`${formState.firstName} ${formState.lastName}`}
                                        className={inputWithIconClass}
                                    />
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">
                                    This is how your name will appear to other users. Leave empty to use your full name.
                                </p>
                            </div>
                            <div className="space-y-1.5">
                                <label className={labelClass}>
                                    {t('settings.profile.pronouns', 'Pronouns')}
                                </label>
                                <div className="relative">
                                    <select
                                        value={formState.pronouns}
                                        onChange={e => setFormState({ ...formState, pronouns: e.target.value })}
                                        className={inputClass + " appearance-none cursor-pointer pr-8"}
                                    >
                                        {PRONOUNS_OPTIONS.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className={labelClass}>
                                    {t('settings.profile.department', 'Department')}
                                </label>
                                <div className="relative">
                                    <Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    <select
                                        value={formState.department}
                                        onChange={e => setFormState({ ...formState, department: e.target.value })}
                                        className={selectClass}
                                    >
                                        {DEPARTMENT_OPTIONS.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Personal Information Section */}
                    <div className={cardClass}>
                        <h4 className={sectionTitleClass}>
                            {t('settings.profile.header', 'Personal Information')}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <label className={labelClass}>{t('settings.profile.firstName', 'First Name')}</label>
                                <input
                                    value={formState.firstName}
                                    onChange={e => setFormState({ ...formState, firstName: e.target.value })}
                                    className={inputClass}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className={labelClass}>{t('settings.profile.lastName', 'Last Name')}</label>
                                <input
                                    value={formState.lastName}
                                    onChange={e => setFormState({ ...formState, lastName: e.target.value })}
                                    className={inputClass}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className={labelClass}>{t('auth.phone', 'Phone')}</label>
                                <div className="relative">
                                    <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        value={formState.phone}
                                        onChange={e => setFormState({ ...formState, phone: e.target.value })}
                                        className={inputWithIconClass}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className={labelClass}>{t('settings.profile.company', 'Company')}</label>
                                <div className="relative">
                                    <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        value={formState.companyName}
                                        onChange={e => setFormState({ ...formState, companyName: e.target.value })}
                                        className={inputWithIconClass}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5 md:col-span-2">
                                <label className={labelClass}>LinkedIn Profile ID</label>
                                <div className="relative">
                                    <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        value={formState.linkedinId}
                                        onChange={e => setFormState({ ...formState, linkedinId: e.target.value })}
                                        placeholder="e.g. piotr-wisniewski-123"
                                        className={inputWithIconClass}
                                    />
                                    <p className="text-[10px] text-slate-400 mt-1 ml-1">
                                        Enter your profile ID from the LinkedIn URL (after /in/)
                                    </p>
                                </div>
                            </div>
                            {/* Job Title with autocomplete */}
                            <div className="space-y-1.5 md:col-span-2">
                                <label className={labelClass}>{t('settings.profile.jobTitle', 'Job Title')}</label>
                                <div className="relative">
                                    <Briefcase size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        value={formState.jobTitle}
                                        onChange={e => setFormState({ ...formState, jobTitle: e.target.value })}
                                        onFocus={() => setShowJobTitleSuggestions(true)}
                                        onBlur={() => setTimeout(() => setShowJobTitleSuggestions(false), 200)}
                                        placeholder={t('settings.profile.jobTitlePlaceholder', 'e.g. Product Manager, Developer...')}
                                        className={inputWithIconClass}
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

                    {/* Availability & Status Section */}
                    <div className={cardClass}>
                        <h4 className={sectionTitleClass}>
                            {t('settings.profile.availability', 'Availability & Status')}
                        </h4>
                        <div className="space-y-6">
                            {/* Status Message */}
                            <div className="space-y-1.5">
                                <label className={labelClass}>
                                    {t('settings.profile.statusMessage', 'Status Message')}
                                </label>
                                <div className="relative">
                                    <MessageCircle size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        value={formState.statusMessage}
                                        onChange={e => setFormState({ ...formState, statusMessage: e.target.value })}
                                        placeholder="e.g. In meetings until 3pm, Working remotely..."
                                        maxLength={100}
                                        className={inputWithIconClass}
                                    />
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">
                                    Let your team know what you're up to ({formState.statusMessage.length}/100)
                                </p>
                            </div>

                            {/* Out of Office */}
                            <div className="p-4 bg-slate-50 dark:bg-navy-950/50 rounded-lg space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${formState.isOutOfOffice ? 'bg-amber-100 dark:bg-amber-500/20' : 'bg-slate-200 dark:bg-white/10'}`}>
                                            <CalendarOff size={18} className={formState.isOutOfOffice ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'} />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-navy-900 dark:text-white">
                                                {t('settings.profile.outOfOffice', 'Out of Office')}
                                            </label>
                                            <p className="text-xs text-slate-500">
                                                Automatically notify others when you're away
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setFormState({ ...formState, isOutOfOffice: !formState.isOutOfOffice })}
                                        className={`relative w-12 h-6 rounded-full transition-colors ${formState.isOutOfOffice ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'
                                            }`}
                                    >
                                        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${formState.isOutOfOffice ? 'left-7' : 'left-1'
                                            }`} />
                                    </button>
                                </div>

                                {formState.isOutOfOffice && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-white/10">
                                        <div className="space-y-1.5">
                                            <label className={labelClass}>
                                                {t('settings.profile.returnDate', 'Return Date')}
                                            </label>
                                            <input
                                                type="date"
                                                value={formState.outOfOfficeUntil}
                                                onChange={e => setFormState({ ...formState, outOfOfficeUntil: e.target.value })}
                                                min={new Date().toISOString().split('T')[0]}
                                                className={inputClass}
                                            />
                                        </div>
                                        <div className="space-y-1.5 md:col-span-2">
                                            <label className={labelClass}>
                                                {t('settings.profile.outOfOfficeMessage', 'Auto-reply Message')}
                                            </label>
                                            <textarea
                                                value={formState.outOfOfficeMessage}
                                                onChange={e => setFormState({ ...formState, outOfOfficeMessage: e.target.value })}
                                                placeholder="I'm currently out of office and will respond when I return..."
                                                rows={3}
                                                className={inputClass + " resize-none"}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Regional Settings */}
                    <div className={cardClass}>
                        <h4 className={sectionTitleClass}>
                            {t('settings.profile.regional', 'Regional Settings')}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Timezone */}
                            <div className="space-y-1.5">
                                <label className={labelClass}>{t('settings.profile.timezone', 'Timezone')}</label>
                                <div className="relative">
                                    <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    <select
                                        value={formState.timezone}
                                        onChange={e => setFormState({ ...formState, timezone: e.target.value })}
                                        className={selectClass}
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
                                <label className={labelClass}>{t('settings.profile.dateFormat', 'Date Format')}</label>
                                <div className="relative">
                                    <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    <select
                                        value={formState.dateFormat}
                                        onChange={e => setFormState({ ...formState, dateFormat: e.target.value })}
                                        className={selectClass}
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
                                <label className={labelClass + " mb-2 block"}>{t('settings.profile.timeFormat', 'Time Format')}</label>
                                <div className="flex gap-4">
                                    {TIME_FORMATS.map(fmt => (
                                        <label
                                            key={fmt.value}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-all ${formState.timeFormat === fmt.value
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

                    {/* Preferences (Theme & Language) */}
                    {theme !== undefined && toggleTheme && (
                        <div>
                            <label className="text-xs font-medium text-slate-500 mb-2 block uppercase tracking-wider">
                                {t('settings.profile.preferences', 'Preferences')}
                            </label>
                            <div className={cardClass + " space-y-6"}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <label className="text-sm font-medium text-navy-900 dark:text-white flex items-center gap-2">
                                            {t('settings.profile.theme', 'Interface Theme')}
                                        </label>
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
                                        <label className="text-sm font-medium text-navy-900 dark:text-white flex items-center gap-2">
                                            {t('settings.profile.language', 'Language')}
                                        </label>
                                        <p className="text-xs text-slate-500 mt-1">Select your preferred language.</p>
                                    </div>
                                    <div className="flex bg-slate-100 dark:bg-navy-950 p-1 rounded-lg flex-wrap gap-1">
                                        {['en', 'pl', 'de', 'ar', 'ja', 'es'].map(lang => (
                                            <button
                                                key={lang}
                                                onClick={() => i18n.changeLanguage(lang)}
                                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${i18n.language === lang
                                                        ? 'bg-white shadow text-navy-900'
                                                        : 'text-slate-500 hover:text-navy-700'
                                                    }`}
                                            >
                                                {t(`common.languages.${lang}`)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Success Toast */}
            {saveStatus === 'success' && (
                <div className="fixed bottom-8 right-8 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
                    <CheckCircle size={16} />
                    {t('settings.profile.saved', 'Saved!')}
                </div>
            )}
        </div>
    );
};

export default ProfileSettings;
