
import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { useTranslation } from 'react-i18next';
import { UserCircle, Mail, Phone, Building2, Save, Loader2, CheckCircle, Globe } from 'lucide-react';
import { Api } from '../../services/api';
import { MFASetup } from '../../components/Profile/MFASetup';

interface ProfileSettingsProps {
    currentUser: User;
    onUpdateUser: (updates: Partial<User>) => void;
    theme: 'light' | 'dark' | 'system';
    toggleTheme: (newTheme?: 'light' | 'dark' | 'system') => void;
}

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

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({ currentUser, onUpdateUser, theme, toggleTheme }) => {
    const { t, i18n } = useTranslation();
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const [formState, setFormState] = useState({
        firstName: currentUser.firstName || '',
        lastName: currentUser.lastName || '',
        phone: currentUser.phone || '',
        companyName: currentUser.companyName || '',
    });

    // Debounced auto-save
    const debouncedFormState = useDebounce(formState, 1000);

    // Initial state sync
    useEffect(() => {
        setFormState({
            firstName: currentUser.firstName || '',
            lastName: currentUser.lastName || '',
            phone: currentUser.phone || '',
            companyName: currentUser.companyName || '',
        });
    }, [currentUser]);

    // Handle manual save
    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Simulate API call or real API call
            await new Promise(resolve => setTimeout(resolve, 800));
            // In real app: await Api.updateUser(currentUser.id, formState);
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
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-navy-900 dark:text-white">{t('settings.profile.header')}</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{t('settings.profile.manage')}</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20"
                >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {isSaving ? t('settings.profile.saving') : t('settings.profile.save')}
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
                                <span className="text-white text-xs font-medium">{t('settings.profile.changePhoto')}</span>
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
                        <h4 className="text-sm font-bold text-navy-900 dark:text-white mb-6 uppercase tracking-wider border-b border-slate-100 dark:border-white/5 pb-2">{t('settings.profile.header')}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('settings.profile.firstName')}</label>
                                <input
                                    value={formState.firstName}
                                    onChange={e => setFormState({ ...formState, firstName: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-white/10 rounded-md text-navy-900 dark:text-white focus:ring-2 focus:ring-purple-500/50 outline-none transition-all"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('settings.profile.lastName')}</label>
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
                                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('settings.profile.company')}</label>
                                <div className="relative">
                                    <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        value={formState.companyName}
                                        onChange={e => setFormState({ ...formState, companyName: e.target.value })}
                                        className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-white/10 rounded-md text-navy-900 dark:text-white focus:ring-2 focus:ring-purple-500/50 outline-none transition-all"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* PREFERENCES (Now stripped of Language) */}
                    <div>
                        <label className="text-xs font-medium text-slate-500 mb-2 block uppercase tracking-wider">{t('settings.profile.preferences')}</label>
                        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg p-6 space-y-6">

                            <div className="flex items-center justify-between">
                                <div>
                                    <label className="text-sm font-medium text-navy-900 dark:text-white flex items-center gap-2">{t('settings.profile.theme')}</label>
                                    <p className="text-xs text-slate-500 mt-1">Select your interface color theme.</p>
                                </div>
                                <div className="flex bg-slate-100 dark:bg-navy-950 p-1 rounded-lg">
                                    <button
                                        onClick={() => toggleTheme('light')}
                                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${theme === 'light' ? 'bg-white shadow text-navy-900' : 'text-slate-500'}`}
                                    >
                                        {t('settings.profile.light')}
                                    </button>
                                    <button
                                        onClick={() => toggleTheme('dark')}
                                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${theme === 'dark' ? 'bg-navy-800 shadow text-white' : 'text-slate-500'}`}
                                    >
                                        {t('settings.profile.dark')}
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
                                    <label className="text-sm font-medium text-navy-900 dark:text-white flex items-center gap-2">{t('settings.profile.language')}</label>
                                    <p className="text-xs text-slate-500 mt-1">Select your preferred language.</p>
                                </div>
                                <div className="flex bg-slate-100 dark:bg-navy-950 p-1 rounded-lg">
                                    <button
                                        onClick={() => i18n.changeLanguage('en')}
                                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${i18n.language === 'en' ? 'bg-white shadow text-navy-900' : 'text-slate-500 hover:text-navy-700'}`}
                                    >
                                        English
                                    </button>
                                    <button
                                        onClick={() => i18n.changeLanguage('pl')}
                                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${i18n.language === 'pl' ? 'bg-white shadow text-navy-900' : 'text-slate-500 hover:text-navy-700'}`}
                                    >
                                        Polski
                                    </button>
                                    <button
                                        onClick={() => i18n.changeLanguage('de')}
                                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${i18n.language === 'de' ? 'bg-white shadow text-navy-900' : 'text-slate-500 hover:text-navy-700'}`}
                                    >
                                        Deutsch
                                    </button>
                                    <button
                                        onClick={() => i18n.changeLanguage('ar')}
                                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${i18n.language === 'ar' ? 'bg-white shadow text-navy-900' : 'text-slate-500 hover:text-navy-700'}`}
                                    >
                                        العربية
                                    </button>
                                    <button
                                        onClick={() => i18n.changeLanguage('ja')}
                                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${i18n.language === 'ja' ? 'bg-white shadow text-navy-900' : 'text-slate-500 hover:text-navy-700'}`}
                                    >
                                        日本語
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
                    {t('settings.profile.saved')}
                </div>
            )}
        </div>
    );
};
