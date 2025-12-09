import React, { useState } from 'react';
import { User, Language } from '../types';
import { Api } from '../services/api';
import { UserCircle, Globe, Lock, Bell, CreditCard, Check, Cpu } from 'lucide-react';

interface SettingsViewProps {
    currentUser: User;
    language: Language;
    onUpdateUser: (updates: Partial<User>) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ currentUser, language, onUpdateUser }) => {
    const [activeTab, setActiveTab] = useState<'PROFILE' | 'BILLING' | 'AI'>('PROFILE');
    const [formData, setFormData] = useState({
        firstName: currentUser.firstName,
        lastName: currentUser.lastName,
        role: currentUser.role || '',
        companyName: currentUser.companyName,
    });

    // AI Config State
    const [apiKey, setApiKey] = useState('');
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

    const handleSaveApiKey = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await Api.saveSetting('gemini_api_key', apiKey);
            setIsSaved(true);
            setApiKey(''); // Clear for security or keep it masked? Let's clear.
            alert('API Key saved successfully!');
            setTimeout(() => setIsSaved(false), 2000);
        } catch (err) {
            alert('Failed to save API Key');
        }
    };

    const renderProfile = () => (
        <div className="max-w-2xl">
            <h2 className="text-lg font-semibold text-white mb-6">Personal Information</h2>

            <form onSubmit={handleSave} className="space-y-6">
                <div className="flex items-center gap-6 mb-8">
                    <div className="w-20 h-20 rounded-full bg-navy-800 border-2 border-dashed border-white/20 flex items-center justify-center text-slate-500 cursor-pointer hover:border-purple-500 hover:text-purple-400 transition-colors">
                        <UserCircle size={40} />
                    </div>
                    <div>
                        <h3 className="text-white font-medium">Profile Photo</h3>
                        <p className="text-xs text-slate-500 mt-1">Accepts JPG, PNG up to 2MB</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-300">First Name</label>
                        <input
                            value={formData.firstName}
                            onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                            className="w-full px-4 py-2.5 bg-navy-900 border border-white/10 rounded-lg text-white focus:border-purple-500 outline-none transition-all text-sm"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-300">Last Name</label>
                        <input
                            value={formData.lastName}
                            onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                            className="w-full px-4 py-2.5 bg-navy-900 border border-white/10 rounded-lg text-white focus:border-purple-500 outline-none transition-all text-sm"
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">Role / Job Title</label>
                    <input
                        value={formData.role}
                        onChange={e => setFormData({ ...formData, role: e.target.value })}
                        className="w-full px-4 py-2.5 bg-navy-900 border border-white/10 rounded-lg text-white focus:border-purple-500 outline-none transition-all text-sm"
                    />
                </div>

                <div className="space-y-1.5 opacity-50 cursor-not-allowed">
                    <label className="text-xs font-medium text-slate-300">Email Address (Managed by Admin)</label>
                    <input
                        value={currentUser.email}
                        disabled
                        className="w-full px-4 py-2.5 bg-navy-900 border border-white/10 rounded-lg text-slate-400 outline-none text-sm"
                    />
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

    const renderBilling = () => (
        <div className="max-w-2xl">
            <h2 className="text-lg font-semibold text-white mb-6">Subscription Plan</h2>
            <div className="bg-gradient-to-br from-purple-900/40 to-navy-900 border border-purple-500/30 rounded-xl p-6 mb-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <CreditCard size={120} />
                </div>
                <div className="relative">
                    <div className="inline-block px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold mb-3 border border-purple-500/20">
                        PRO PLAN
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">Full Transformation Access</h3>
                    <p className="text-slate-400 text-sm mb-6 max-w-sm">
                        You have unlimited access to all 6 axes of the Digital Readiness Diagnosis and the Roadmap Generator.
                    </p>
                </div>
            </div>
        </div>
    );

    const renderAIConfig = () => (
        <div className="max-w-2xl">
            <h2 className="text-lg font-semibold text-white mb-6">AI Configuration</h2>
            <div className="bg-navy-900 border border-white/10 rounded-xl p-6 mb-6">
                <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-purple-500/20 text-purple-400">
                        <Cpu size={24} />
                    </div>
                    <div>
                        <h3 className="text-white font-medium mb-1">Google Gemini API</h3>
                        <p className="text-sm text-slate-400 mb-4">
                            Configure your own API key to power the AI consultant features.
                            Your key is stored securely on your local server.
                        </p>

                        <form onSubmit={handleSaveApiKey} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-300">API Key</label>
                                <div className="relative">
                                    <input
                                        type="password"
                                        placeholder="AIzaSy..."
                                        value={apiKey}
                                        onChange={e => setApiKey(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-navy-950 border border-white/10 rounded-lg text-white focus:border-purple-500 outline-none transition-all text-sm font-mono"
                                    />
                                    <div className="absolute right-3 top-2.5 text-slate-500">
                                        <Lock size={16} />
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500">
                                    Get your key from <a href="https://aistudio.google.com/" target="_blank" className="text-purple-400 hover:underline">Google AI Studio</a>.
                                </p>
                            </div>
                            <button className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                                {isSaved ? <Check size={16} /> : null}
                                {isSaved ? 'Saved!' : 'Save Configuration'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex h-full bg-navy-950">
            {/* Settings Navigation */}
            <div className="w-64 border-r border-white/5 bg-navy-900 p-6 flex flex-col gap-1">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 px-3">Settings</h2>

                <button
                    onClick={() => setActiveTab('PROFILE')}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left transition-colors ${activeTab === 'PROFILE' ? 'bg-navy-800 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >
                    <UserCircle size={18} />
                    My Profile
                </button>
                <button
                    onClick={() => setActiveTab('BILLING')}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left transition-colors ${activeTab === 'BILLING' ? 'bg-navy-800 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >
                    <CreditCard size={18} />
                    Billing & Plans
                </button>

                <button
                    onClick={() => setActiveTab('AI')}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left transition-colors ${activeTab === 'AI' ? 'bg-navy-800 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >
                    <Cpu size={18} />
                    AI Configuration
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto p-8 lg:p-12">
                {activeTab === 'PROFILE' && renderProfile()}
                {activeTab === 'BILLING' && renderBilling()}
                {activeTab === 'AI' && renderAIConfig()}
            </div>
        </div>
    );
};
