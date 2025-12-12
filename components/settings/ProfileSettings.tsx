import React, { useState, useRef, useEffect, useCallback } from 'react';
import { User, Language } from '../../types';
import { useTranslation } from 'react-i18next';
import { Api } from '../../services/api';
import { UserCircle, Check, Sun, Moon } from 'lucide-react';
import { compressImage } from '../../utils/imageUtils';
import { useAutoSave } from '../../src/context/AutoSaveContext';


interface ProfileSettingsProps {
    currentUser: User;
    onUpdateUser: (updates: Partial<User>) => void;
    theme: 'light' | 'dark';
    toggleTheme: () => void;
    language: Language;
    setLanguage: (lang: Language) => void;
}

// Simple debounce implementation if lodash is not available
function simpleDebounce<T extends (...args: any[]) => void>(func: T, wait: number) {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({ currentUser, onUpdateUser, theme, toggleTheme, language, setLanguage }) => {
    const { t } = useTranslation();
    const { setStatus, setLastSaved } = useAutoSave();

    // Initial state derived from currentUser
    const [formData, setFormData] = useState({
        firstName: currentUser.firstName || '',
        lastName: currentUser.lastName || '',
        role: currentUser.role || '',
        companyName: currentUser.companyName || '',
    });

    const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Track if first load to avoid initial auto-save trigger
    const isFirstLoad = useRef(true);

    // Sync state if currentUser changes from outside (e.g. reload or other updates)
    useEffect(() => {
        setFormData({
            firstName: currentUser.firstName || '',
            lastName: currentUser.lastName || '',
            role: currentUser.role || '',
            companyName: currentUser.companyName || '',
        });
        setAvatarUrl(currentUser.avatarUrl);
    }, [currentUser]);

    const saveChanges = async (data: typeof formData) => {
        setStatus('saving');
        try {
            await Api.updateUser(currentUser.id, data);
            onUpdateUser(data);
            setStatus('saved');
            setLastSaved(new Date());
        } catch (err) {
            console.error('Auto-save failed:', err);
            setStatus('error');
        }
    };

    // Create a callback that is debounced
     
    const debouncedSave = useCallback(
        simpleDebounce((data: typeof formData) => {
            saveChanges(data);
        }, 2000),
        [currentUser.id] // Re-create if user changes, though unlikely in this view
    );

    // Effect to trigger save when formData changes
    useEffect(() => {
        if (isFirstLoad.current) {
            isFirstLoad.current = false;
            return;
        }

        setStatus('unsaved');
        debouncedSave(formData);
    }, [formData, debouncedSave, setStatus]);

    // Manual Save (Changes "Saving..." to immediate if debounce is pending, but here we just call save directly)
    const handleManualSave = async (e: React.FormEvent) => {
        e.preventDefault();
        // Cancel pending debounce if possible? simpleDebounce doesn't expose cancel lightly without refs.
        // We'll just force save. The redundant debounce save might run but it's safe (idempotent-ish).
        saveChanges(formData);
    };

    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            // Compress image client-side before upload
            const compressedFile = await compressImage(file, 0.8, 800, 800);

            const result = await Api.uploadAvatar(currentUser.id, compressedFile);
            const fullUrl = result.avatarUrl.startsWith('http') ? result.avatarUrl : `http://localhost:3005${result.avatarUrl}`;
            setAvatarUrl(fullUrl);
            onUpdateUser({ avatarUrl: fullUrl });
        } catch (err: any) {
            console.error('Avatar upload error:', err);
            alert(err.message || 'Failed to upload avatar');
        }
    };

    const handleChange = (field: keyof typeof formData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div className="max-w-2xl">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">{t('settings.profile.header')}</h2>

            <form onSubmit={handleManualSave} className="space-y-6">
                <div className="flex items-center gap-6 mb-8">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/png, image/jpeg, image/webp"
                        className="hidden"
                    />
                    <div
                        onClick={handleAvatarClick}
                        className="w-20 h-20 rounded-full bg-slate-100 dark:bg-navy-800 border-2 border-dashed border-slate-300 dark:border-white/20 flex items-center justify-center text-slate-500 cursor-pointer hover:border-purple-500 hover:text-purple-400 transition-colors overflow-hidden relative group"
                    >
                        {avatarUrl ? (
                            <img src={avatarUrl} alt="Profile" className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                            <UserCircle size={40} />
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-xs text-white font-medium">
                            {t('settings.profile.change')}
                        </div>
                    </div>
                    <div>
                        <h3 className="text-slate-900 dark:text-white font-medium">{t('settings.profile.photo')}</h3>
                        <p className="text-xs text-slate-500 mt-1">{t('settings.profile.photoHint')}</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-500 dark:text-slate-300">{t('settings.profile.firstName')}</label>
                        <input
                            value={formData.firstName}
                            onChange={e => handleChange('firstName', e.target.value)}
                            className="w-full px-4 py-2.5 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white focus:border-purple-500 outline-none transition-all text-sm"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-500 dark:text-slate-300">{t('settings.profile.lastName')}</label>
                        <input
                            value={formData.lastName}
                            onChange={e => handleChange('lastName', e.target.value)}
                            className="w-full px-4 py-2.5 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white focus:border-purple-500 outline-none transition-all text-sm"
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-300">{t('settings.profile.role')}</label>
                    <input
                        value={formData.role}
                        onChange={e => handleChange('role', e.target.value)}
                        className="w-full px-4 py-2.5 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white focus:border-purple-500 outline-none transition-all text-sm"
                    />
                </div>

                <div className="space-y-1.5 opacity-50 cursor-not-allowed">
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-300">{t('settings.profile.email')}</label>
                    <input
                        value={currentUser.email}
                        disabled
                        className="w-full px-4 py-2.5 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg text-slate-500 dark:text-slate-400 outline-none text-sm"
                    />
                </div>

                <div className="pt-6 mt-6 border-t border-slate-200 dark:border-white/10">
                    <h3 className="text-md font-semibold text-slate-900 dark:text-white mb-4">{t('settings.profile.preferences')}</h3>
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-slate-500 dark:text-slate-300">{t('settings.profile.theme')}</label>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => theme === 'dark' && toggleTheme()}
                                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-all ${theme === 'light'
                                        ? 'bg-purple-600 border-purple-600 text-white shadow-md'
                                        : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                                >
                                    <Sun size={16} />
                                    {t('settings.profile.light')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => theme === 'light' && toggleTheme()}
                                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-all ${theme === 'dark'
                                        ? 'bg-purple-600 border-purple-600 text-white shadow-md'
                                        : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                                >
                                    <Moon size={16} />
                                    {t('settings.profile.dark')}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-medium text-slate-500 dark:text-slate-300">{t('settings.profile.language')}</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setLanguage('EN')}
                                    className={`px-3 py-2.5 rounded-lg border text-sm transition-all ${language === 'EN'
                                        ? 'bg-purple-600 border-purple-600 text-white shadow-md'
                                        : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                                >
                                    English
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setLanguage('PL')}
                                    className={`px-3 py-2.5 rounded-lg border text-sm transition-all ${language === 'PL'
                                        ? 'bg-purple-600 border-purple-600 text-white shadow-md'
                                        : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                                >
                                    Polski
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setLanguage('DE')}
                                    className={`px-3 py-2.5 rounded-lg border text-sm transition-all ${language === 'DE'
                                        ? 'bg-purple-600 border-purple-600 text-white shadow-md'
                                        : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                                >
                                    Deutsch
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setLanguage('AR')}
                                    className={`px-3 py-2.5 rounded-lg border text-sm transition-all ${language === 'AR'
                                        ? 'bg-purple-600 border-purple-600 text-white shadow-md'
                                        : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                                >
                                    العربية
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-4 border-t border-white/5">
                    <button type="submit" className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                        {t('settings.profile.save')}
                    </button>
                    <p className="text-xs text-slate-400 mt-2">Changes are automatically saved</p>
                </div>
            </form>
        </div>
    );
};

