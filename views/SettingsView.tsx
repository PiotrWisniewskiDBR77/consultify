import React, { useState, useEffect } from 'react';
import { User, Language, AIProviderType } from '../types';
import { Api } from '../services/api';
import { UserCircle, Globe, Lock, Bell, CreditCard, Check, Cpu, Moon, Sun, Monitor } from 'lucide-react';
import { BillingSettings } from './settings/BillingSettings';
import { AIConfigSettings } from './settings/AIConfigSettings';

interface SettingsViewProps {
    currentUser: User;
    language: Language;
    onUpdateUser: (updates: Partial<User>) => void;
    theme: 'light' | 'dark';
    toggleTheme: () => void;
    setLanguage: (lang: Language) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ currentUser, language, onUpdateUser, theme, toggleTheme, setLanguage }) => {
    const [activeTab, setActiveTab] = useState<'PROFILE' | 'BILLING' | 'AI'>('PROFILE');
    const [formData, setFormData] = useState({
        firstName: currentUser.firstName || '',
        lastName: currentUser.lastName || '',
        role: currentUser.role || '',
        companyName: currentUser.companyName || '',
    });

    const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl);

    // Sync state with currentUser changes
    React.useEffect(() => {
        setFormData({
            firstName: currentUser.firstName || '',
            lastName: currentUser.lastName || '',
            role: currentUser.role || '',
            companyName: currentUser.companyName || '',
        });
        setAvatarUrl(currentUser.avatarUrl);
    }, [currentUser]);

    const [isSaved, setIsSaved] = useState(false);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await Api.updateUser(currentUser.id, formData);
            onUpdateUser(formData); // Optimistic update
            setIsSaved(true);
            setTimeout(() => setIsSaved(false), 2000);
        } catch (err) {
            alert('Failed to save settings');
        }
    };

    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Basic validation
        if (file.size > 2 * 1024 * 1024) {
            alert('File size must be less than 2MB');
            return;
        }

        try {
            const result = await Api.uploadAvatar(currentUser.id, file);
            // Construct full URL if returned relative
            const fullUrl = result.avatarUrl.startsWith('http') ? result.avatarUrl : `http://localhost:3001${result.avatarUrl}`;
            setAvatarUrl(fullUrl);
            onUpdateUser({ avatarUrl: fullUrl }); // Update parent state immediately
        } catch (err: any) {
            alert(err.message || 'Failed to upload avatar'); // Corrected typo here, but keeping message same
        }
    };

    const renderProfile = () => (
        <div className="max-w-2xl">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Personal Information</h2>

            <form onSubmit={handleSave} className="space-y-6">
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
                            <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <UserCircle size={40} />
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-xs text-white font-medium">
                            Change
                        </div>
                    </div>
                    <div>
                        <h3 className="text-slate-900 dark:text-white font-medium">Profile Photo</h3>
                        <p className="text-xs text-slate-500 mt-1">Accepts JPG, PNG up to 2MB</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-500 dark:text-slate-300">First Name</label>
                        <input
                            value={formData.firstName}
                            onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                            className="w-full px-4 py-2.5 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white focus:border-purple-500 outline-none transition-all text-sm"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-500 dark:text-slate-300">Last Name</label>
                        <input
                            value={formData.lastName}
                            onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                            className="w-full px-4 py-2.5 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white focus:border-purple-500 outline-none transition-all text-sm"
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-300">Role / Job Title</label>
                    <input
                        value={formData.role}
                        onChange={e => setFormData({ ...formData, role: e.target.value })}
                        className="w-full px-4 py-2.5 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white focus:border-purple-500 outline-none transition-all text-sm"
                    />
                </div>

                <div className="space-y-1.5 opacity-50 cursor-not-allowed">
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-300">Email Address (Managed by Admin)</label>
                    <input
                        value={currentUser.email}
                        disabled
                        className="w-full px-4 py-2.5 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg text-slate-500 dark:text-slate-400 outline-none text-sm"
                    />
                </div>

                {/* Preference Section */}
                <div className="pt-6 mt-6 border-t border-slate-200 dark:border-white/10">
                    <h3 className="text-md font-semibold text-slate-900 dark:text-white mb-4">Preferences</h3>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-slate-500 dark:text-slate-300">Interface Theme</label>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => theme === 'dark' && toggleTheme()}
                                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-all ${theme === 'light'
                                        ? 'bg-purple-600 border-purple-600 text-white shadow-md'
                                        : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                                >
                                    <Sun size={16} />
                                    Light
                                </button>
                                <button
                                    type="button"
                                    onClick={() => theme === 'light' && toggleTheme()}
                                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-all ${theme === 'dark'
                                        ? 'bg-purple-600 border-purple-600 text-white shadow-md'
                                        : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                                >
                                    <Moon size={16} />
                                    Dark
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-medium text-slate-500 dark:text-slate-300">Language</label>
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
                    <button className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                        {isSaved ? <Check size={16} /> : null}
                        {isSaved ? 'Saved!' : 'Save Changes'}
                    </button>
                </div>
            </form>
        </div>
    );

    return (
        <div className="flex h-full bg-slate-50 dark:bg-navy-950 transition-colors duration-300">
            {/* Settings Navigation */}
            <div className="w-64 border-r border-slate-200 dark:border-white/5 bg-white dark:bg-navy-900 p-6 flex flex-col gap-1 transition-colors duration-300">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 px-3">Settings</h2>

                <button
                    onClick={() => setActiveTab('PROFILE')}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left transition-colors ${activeTab === 'PROFILE' ? 'bg-slate-100 dark:bg-navy-800 text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5'}`}
                >
                    <UserCircle size={18} />
                    My Profile
                </button>
                <button
                    onClick={() => setActiveTab('BILLING')}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left transition-colors ${activeTab === 'BILLING' ? 'bg-slate-100 dark:bg-navy-800 text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5'}`}
                >
                    <CreditCard size={18} />
                    Billing & Plans
                </button>

                <button
                    onClick={() => setActiveTab('AI')}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left transition-colors ${activeTab === 'AI' ? 'bg-slate-100 dark:bg-navy-800 text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5'}`}
                >
                    <Cpu size={18} />
                    AI Configuration
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto p-6 lg:p-8">
                {activeTab === 'PROFILE' && renderProfile()}
                {activeTab === 'BILLING' && <BillingSettings currentUser={currentUser} />}
                {activeTab === 'AI' && <AIConfigSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />}
            </div>
        </div>
    );
};
