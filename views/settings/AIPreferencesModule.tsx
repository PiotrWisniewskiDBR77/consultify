/**
 * AIPreferencesModule - AI Preferences & Personalization
 * 
 * Tabs: Instructions | Memory | Response Style | Chat History | Voice
 */

import React, { useState } from 'react';
import { FileText, Brain, Sliders, MessageSquare, Volume2 } from 'lucide-react';
import { TabLayout, Tab } from '../../components/SuperAdmin/TabLayout';
import { AISettings } from '../../components/settings/AISettings';
import { VoiceSettingsPanel } from '../../components/settings/VoiceSettingsPanel';
import { useTranslation } from 'react-i18next';
import { User } from '../../types';

interface AIPreferencesModuleProps {
    initialTab?: string;
    currentUser: User;
    onUpdateUser: (updates: Partial<User>) => void;
}

// AI Memory Settings Component
const AIMemorySettings: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const { t } = useTranslation();
    const [memoryEnabled, setMemoryEnabled] = useState(true);

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                    {t('settings.aiMemory.title', 'AI Memory & Context')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                    {t('settings.aiMemory.description', 'Control what the AI remembers about you across conversations')}
                </p>
            </div>

            {/* Memory Toggle */}
            <div className="p-4 bg-white dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="font-medium text-slate-900 dark:text-white">
                            {t('settings.aiMemory.enable', 'Enable Memory')}
                        </p>
                        <p className="text-sm text-slate-500">
                            {t('settings.aiMemory.enableDesc', 'Allow AI to remember preferences and context between sessions')}
                        </p>
                    </div>
                    <button
                        onClick={() => setMemoryEnabled(!memoryEnabled)}
                        className={`w-12 h-6 rounded-full transition-colors ${
                            memoryEnabled ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-600'
                        }`}
                    >
                        <div className={`w-5 h-5 bg-white rounded-full transform transition-transform ${
                            memoryEnabled ? 'translate-x-6' : 'translate-x-0.5'
                        }`} />
                    </button>
                </div>
            </div>

            {/* What AI Remembers */}
            {memoryEnabled && (
                <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-lg">
                    <h4 className="font-medium text-slate-900 dark:text-white mb-3">
                        {t('settings.aiMemory.remembered', 'What AI Remembers')}
                    </h4>
                    <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                        <li className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                            {t('settings.aiMemory.item1', 'Your preferred communication style')}
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                            {t('settings.aiMemory.item2', 'Industry and role context')}
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                            {t('settings.aiMemory.item3', 'Previous project preferences')}
                        </li>
                    </ul>
                </div>
            )}

            {/* Clear Memory */}
            <div className="p-4 bg-white dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="font-medium text-slate-900 dark:text-white">
                            {t('settings.aiMemory.clear', 'Clear Memory')}
                        </p>
                        <p className="text-sm text-slate-500">
                            {t('settings.aiMemory.clearDesc', 'Delete all stored preferences and start fresh')}
                        </p>
                    </div>
                    <button className="px-4 py-2 bg-red-100 dark:bg-red-500/20 hover:bg-red-200 dark:hover:bg-red-500/30 text-red-700 dark:text-red-300 rounded-lg transition-colors">
                        {t('settings.aiMemory.clearBtn', 'Clear All')}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Response Style Settings Component
const ResponseStyleSettings: React.FC<{ currentUser: User; onUpdateUser: (updates: Partial<User>) => void }> = ({ 
    currentUser,
    onUpdateUser 
}) => {
    const { t } = useTranslation();
    const [responseLength, setResponseLength] = useState<'short' | 'medium' | 'long'>('medium');
    const [tone, setTone] = useState<'formal' | 'casual' | 'professional'>('professional');
    const [format, setFormat] = useState<'bullets' | 'paragraphs' | 'mixed'>('mixed');

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                    {t('settings.responseStyle.title', 'Response Style Preferences')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                    {t('settings.responseStyle.description', 'Customize how AI responds to you')}
                </p>
            </div>

            {/* Response Length */}
            <div className="p-4 bg-white dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10">
                <p className="font-medium text-slate-900 dark:text-white mb-3">
                    {t('settings.responseStyle.length', 'Response Length')}
                </p>
                <div className="flex gap-2">
                    {(['short', 'medium', 'long'] as const).map((len) => (
                        <button
                            key={len}
                            onClick={() => setResponseLength(len)}
                            className={`px-4 py-2 rounded-lg transition-colors ${
                                responseLength === len
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/20'
                            }`}
                        >
                            {t(`settings.responseStyle.${len}`, len.charAt(0).toUpperCase() + len.slice(1))}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tone */}
            <div className="p-4 bg-white dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10">
                <p className="font-medium text-slate-900 dark:text-white mb-3">
                    {t('settings.responseStyle.tone', 'Tone')}
                </p>
                <div className="flex gap-2">
                    {(['formal', 'professional', 'casual'] as const).map((t_) => (
                        <button
                            key={t_}
                            onClick={() => setTone(t_)}
                            className={`px-4 py-2 rounded-lg transition-colors ${
                                tone === t_
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/20'
                            }`}
                        >
                            {t(`settings.responseStyle.${t_}`, t_.charAt(0).toUpperCase() + t_.slice(1))}
                        </button>
                    ))}
                </div>
            </div>

            {/* Format */}
            <div className="p-4 bg-white dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10">
                <p className="font-medium text-slate-900 dark:text-white mb-3">
                    {t('settings.responseStyle.format', 'Format')}
                </p>
                <div className="flex gap-2">
                    {(['bullets', 'paragraphs', 'mixed'] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFormat(f)}
                            className={`px-4 py-2 rounded-lg transition-colors ${
                                format === f
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/20'
                            }`}
                        >
                            {t(`settings.responseStyle.${f}`, f.charAt(0).toUpperCase() + f.slice(1))}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

// Chat History Settings Component
const ChatHistorySettings: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const { t } = useTranslation();
    const [historyEnabled, setHistoryEnabled] = useState(true);

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                    {t('settings.chatHistory.title', 'Chat History')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                    {t('settings.chatHistory.description', 'Manage your conversation history')}
                </p>
            </div>

            {/* History Toggle */}
            <div className="p-4 bg-white dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="font-medium text-slate-900 dark:text-white">
                            {t('settings.chatHistory.enable', 'Save Chat History')}
                        </p>
                        <p className="text-sm text-slate-500">
                            {t('settings.chatHistory.enableDesc', 'Keep a record of your conversations')}
                        </p>
                    </div>
                    <button
                        onClick={() => setHistoryEnabled(!historyEnabled)}
                        className={`w-12 h-6 rounded-full transition-colors ${
                            historyEnabled ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-600'
                        }`}
                    >
                        <div className={`w-5 h-5 bg-white rounded-full transform transition-transform ${
                            historyEnabled ? 'translate-x-6' : 'translate-x-0.5'
                        }`} />
                    </button>
                </div>
            </div>

            {/* Clear History */}
            <div className="p-4 bg-white dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="font-medium text-slate-900 dark:text-white">
                            {t('settings.chatHistory.clear', 'Clear All Chats')}
                        </p>
                        <p className="text-sm text-slate-500">
                            {t('settings.chatHistory.clearDesc', 'Permanently delete all conversation history')}
                        </p>
                    </div>
                    <button className="px-4 py-2 bg-red-100 dark:bg-red-500/20 hover:bg-red-200 dark:hover:bg-red-500/30 text-red-700 dark:text-red-300 rounded-lg transition-colors">
                        {t('settings.chatHistory.clearBtn', 'Clear All')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export const AIPreferencesModule: React.FC<AIPreferencesModuleProps> = ({ 
    initialTab,
    currentUser,
    onUpdateUser
}) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState(initialTab || 'instructions');

    const tabs: Tab[] = [
        { 
            id: 'instructions', 
            label: t('settings.tabs.instructions', 'Instructions'), 
            icon: <FileText size={16} /> 
        },
        { 
            id: 'memory', 
            label: t('settings.tabs.memory', 'Memory'), 
            icon: <Brain size={16} /> 
        },
        { 
            id: 'style', 
            label: t('settings.tabs.style', 'Response Style'), 
            icon: <Sliders size={16} /> 
        },
        { 
            id: 'history', 
            label: t('settings.tabs.history', 'Chat History'), 
            icon: <MessageSquare size={16} /> 
        },
        { 
            id: 'voice', 
            label: t('settings.tabs.voice', 'Voice'), 
            icon: <Volume2 size={16} /> 
        },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'instructions':
                return <AISettings currentUser={currentUser} onUpdateUser={onUpdateUser} />;
            case 'memory':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <AIMemorySettings currentUser={currentUser} />
                    </div>
                );
            case 'style':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <ResponseStyleSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />
                    </div>
                );
            case 'history':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <ChatHistorySettings currentUser={currentUser} />
                    </div>
                );
            case 'voice':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <VoiceSettingsPanel />
                    </div>
                );
            default:
                return <AISettings currentUser={currentUser} onUpdateUser={onUpdateUser} />;
        }
    };

    return (
        <TabLayout
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            title={t('settings.modules.aiPreferences', 'AI Preferences')}
            subtitle={t('settings.modules.aiPreferencesDesc', 'Customize AI behavior, memory, and response style')}
        >
            {renderContent()}
        </TabLayout>
    );
};

export default AIPreferencesModule;







