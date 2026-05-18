import TeresaMark from '../../components/shared/TeresaMark';
/**
 * AIPreferencesModule - AI Preferences & Personalization
 *
 * Tabs: Instructions | Memory | Response Style | Automation | Chat History | Voice
 */

import { Brain, FileText, MessageSquare, Sliders, Volume2 } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AIInboxAutomationSettings } from '../../components/settings/ai/AIInboxAutomationSettings';
import { AIMemorySettings } from '../../components/settings/AIMemorySettings';
import { AISettings } from '../../components/settings/AISettings';
import { ChatHistorySettings as CanonicalChatHistorySettings } from '../../components/settings/ChatHistorySettings';
import { VoiceSettingsPanel } from '../../components/settings/VoiceSettingsPanel';
import { Tab, TabLayout } from '../../components/SuperAdmin/TabLayout';
import { User } from '../../types';

interface AIPreferencesModuleProps {
  initialTab?: string;
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

// Response Style Settings Component
const ResponseStyleSettings: React.FC<{
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}> = ({ currentUser, onUpdateUser }) => {
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
      <div className="p-4 bg-white dark:bg-white/5 rounded-lg border border-slate-200 dark:border-navy-700">
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
      <div className="p-4 bg-white dark:bg-white/5 rounded-lg border border-slate-200 dark:border-navy-700">
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
      <div className="p-4 bg-white dark:bg-white/5 rounded-lg border border-slate-200 dark:border-navy-700">
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

export const AIPreferencesModule: React.FC<AIPreferencesModuleProps> = ({
  initialTab,
  currentUser,
  onUpdateUser,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(initialTab || 'instructions');

  const tabs: Tab[] = [
    {
      id: 'instructions',
      label: t('settings.tabs.instructions', 'Instructions'),
      icon: <FileText size={16} />,
    },
    {
      id: 'memory',
      label: t('settings.tabs.memory', 'Memory'),
      icon: <Brain size={16} />,
    },
    {
      id: 'style',
      label: t('settings.tabs.style', 'Response Style'),
      icon: <Sliders size={16} />,
    },
    {
      id: 'automation',
      label: t('settings.tabs.automation', 'Automation'),
      icon: <TeresaMark size={16} />,
    },
    {
      id: 'history',
      label: t('settings.tabs.history', 'Chat History'),
      icon: <MessageSquare size={16} />,
    },
    {
      id: 'voice',
      label: t('settings.tabs.voice', 'Voice'),
      icon: <Volume2 size={16} />,
    },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'instructions':
        return <AISettings currentUser={currentUser} onUpdateUser={onUpdateUser} />;
      case 'memory':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <AIMemorySettings />
          </div>
        );
      case 'style':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <ResponseStyleSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />
          </div>
        );
      case 'automation':
        return <AIInboxAutomationSettings />;
      case 'history':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <CanonicalChatHistorySettings />
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
      subtitle={t(
        'settings.modules.aiPreferencesDesc',
        'Customize AI behavior, memory, automation, and response style'
      )}
    >
      {renderContent()}
    </TabLayout>
  );
};

export default AIPreferencesModule;
