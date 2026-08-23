/**
 * AIBehaviorSettings - AI Behavior Configuration
 *
 * Features:
 * - Auto-suggestions toggle
 * - AI in comments toggle
 * - AI in tasks toggle
 * - AI learning from my work toggle
 * - AI personality (professional, casual, technical)
 */

import {
  BookOpen,
  Brain,
  Briefcase,
  Code,
  GraduationCap,
  Info,
  Lightbulb,
  ListTodo,
  Loader2,
  MessageCircle,
  Save,
  Smile,
  Sparkles,
  Wand2,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/ui/primitives';

import { Api } from '../../../services/api';
import { User } from '../../../types';

interface AIBehaviorSettingsProps {
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

type AIPersonality = 'professional' | 'casual' | 'technical' | 'creative' | 'concise';

interface BehaviorSettings {
  // Toggles
  enableAutoSuggestions: boolean;
  enableInComments: boolean;
  enableInTasks: boolean;
  enableLearningFromWork: boolean;
  enableProactiveInsights: boolean;
  enableAutocomplete: boolean;

  // Personality
  personality: AIPersonality;
  responseLength: 'brief' | 'moderate' | 'detailed';
  formality: number; // 0-100
  technicalLevel: number; // 0-100

  // Context
  useProjectContext: boolean;
  useHistoricalData: boolean;
  useTeamPatterns: boolean;
}

const defaultSettings: BehaviorSettings = {
  enableAutoSuggestions: true,
  enableInComments: true,
  enableInTasks: true,
  enableLearningFromWork: true,
  enableProactiveInsights: true,
  enableAutocomplete: true,
  personality: 'professional',
  responseLength: 'moderate',
  formality: 70,
  technicalLevel: 50,
  useProjectContext: true,
  useHistoricalData: true,
  useTeamPatterns: false,
};

const personalities: {
  id: AIPersonality;
  label: string;
  icon: React.ElementType;
  description: string;
}[] = [
  {
    id: 'professional',
    label: 'Professional',
    icon: Briefcase,
    description: 'Formal, business-focused responses',
  },
  { id: 'casual', label: 'Casual', icon: Smile, description: 'Friendly, conversational tone' },
  {
    id: 'technical',
    label: 'Technical',
    icon: Code,
    description: 'Detailed, technical explanations',
  },
  {
    id: 'creative',
    label: 'Creative',
    icon: Sparkles,
    description: 'Imaginative, innovative suggestions',
  },
  { id: 'concise', label: 'Concise', icon: BookOpen, description: 'Brief, to-the-point answers' },
];

export const AIBehaviorSettings: React.FC<AIBehaviorSettingsProps> = ({
  currentUser,
  onUpdateUser,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<BehaviorSettings>(defaultSettings);

  useEffect(() => {
    loadSettings();
  }, [currentUser.id]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await Api.get('/api/user/ai-preferences/behavior');
      if (response.success && response.data) {
        setSettings({ ...defaultSettings, ...response.data });
      }
    } catch (error) {
      console.error('Error loading AI behavior settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await Api.put('/api/user/ai-preferences/behavior', settings);
      toast.success(t('settings.ai.behaviorSaved', 'AI behavior settings saved'));
    } catch (error) {
      toast.error(t('settings.ai.behaviorError', 'Failed to save AI behavior settings'));
    } finally {
      setSaving(false);
    }
  };

  const ToggleCard: React.FC<{
    enabled: boolean;
    onChange: (enabled: boolean) => void;
    icon: React.ElementType;
    title: string;
    description: string;
  }> = ({ enabled, onChange, icon: Icon, title, description }) => (
    <div
      className={`p-4 rounded-xl border-2 transition-all ${
        enabled
          ? 'border-c-accent bg-c-accent-soft dark:bg-c-accent-soft'
          : 'border-c-border-subtle dark:border-navy-700 bg-c-surface-raised'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div
            className={`p-2 rounded-lg ${enabled ? 'bg-c-accent-soft dark:bg-c-accent-soft' : 'bg-c-surface'}`}
          >
            <Icon size={18} className={enabled ? 'text-c-accent' : 'text-c-text-secondary'} />
          </div>
          <div>
            <p className="font-medium text-c-text">{title}</p>
            <p className="text-sm text-c-text-muted">{description}</p>
          </div>
        </div>
        <button
          onClick={() => onChange(!enabled)}
          className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
            enabled ? 'bg-navy-900' : 'bg-c-surface-raised'
          }`}
        >
          <span
            className={`absolute top-1 w-4 h-4 rounded-full bg-c-surface shadow transition-all ${
              enabled ? 'left-7' : 'left-1'
            }`}
          />
        </button>
      </div>
    </div>
  );

  if (loading) {
    return <LoadingState variant="spinner" />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-c-text flex items-center gap-3">
            <Brain size={28} className="text-pink-500" />
            {t('settings.ai.behavior.title', 'AI Behavior')}
          </h2>
          <p className="text-c-text-muted text-sm mt-1">
            {t('settings.ai.behavior.description', 'Customize how AI assists you')}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Save Changes
        </button>
      </div>

      {/* AI Features Toggles */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
          <Wand2 size={20} className="text-pink-500" />
          AI Features
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ToggleCard
            enabled={settings.enableAutoSuggestions}
            onChange={(v) => setSettings({ ...settings, enableAutoSuggestions: v })}
            icon={Lightbulb}
            title="Auto-Suggestions"
            description="Get AI suggestions while working"
          />
          <ToggleCard
            enabled={settings.enableInComments}
            onChange={(v) => setSettings({ ...settings, enableInComments: v })}
            icon={MessageCircle}
            title="AI in Comments"
            description="AI assistance in comment sections"
          />
          <ToggleCard
            enabled={settings.enableInTasks}
            onChange={(v) => setSettings({ ...settings, enableInTasks: v })}
            icon={ListTodo}
            title="AI in Tasks"
            description="AI help with task management"
          />
          <ToggleCard
            enabled={settings.enableAutocomplete}
            onChange={(v) => setSettings({ ...settings, enableAutocomplete: v })}
            icon={Sparkles}
            title="Smart Autocomplete"
            description="AI-powered text completion"
          />
          <ToggleCard
            enabled={settings.enableLearningFromWork}
            onChange={(v) => setSettings({ ...settings, enableLearningFromWork: v })}
            icon={GraduationCap}
            title="Learn from My Work"
            description="AI adapts to your style over time"
          />
          <ToggleCard
            enabled={settings.enableProactiveInsights}
            onChange={(v) => setSettings({ ...settings, enableProactiveInsights: v })}
            icon={Brain}
            title="Proactive Insights"
            description="AI suggests improvements unprompted"
          />
        </div>
      </div>

      {/* AI Personality */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
          <Smile size={20} className="text-amber-500" />
          AI Personality
        </h3>
        <p className="text-sm text-c-text-muted">Choose how AI communicates with you</p>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {personalities.map((p) => {
            const Icon = p.icon;
            return (
              <button
                key={p.id}
                onClick={() => setSettings({ ...settings, personality: p.id })}
                className={`p-4 rounded-xl border-2 text-center transition-all ${
                  settings.personality === p.id
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10'
                    : 'border-c-border-subtle dark:border-navy-700 hover:border-amber-300'
                }`}
              >
                <Icon
                  size={24}
                  className={
                    settings.personality === p.id ? 'text-amber-600' : 'text-c-text-secondary'
                  }
                />
                <p className="font-medium text-c-text mt-2 text-sm">{p.label}</p>
              </button>
            );
          })}
        </div>

        <div className="p-3 bg-c-surface-raised rounded-lg">
          <p className="text-sm text-c-text-secondary">
            <span className="font-medium">
              {personalities.find((p) => p.id === settings.personality)?.label}:
            </span>{' '}
            {personalities.find((p) => p.id === settings.personality)?.description}
          </p>
        </div>
      </div>

      {/* Response Style */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6 space-y-6">
        <h3 className="text-lg font-semibold text-c-text">Response Style</h3>

        {/* Response Length */}
        <div className="space-y-3">
          <label className="font-medium text-c-text">Response Length</label>
          <div className="flex gap-3">
            {(['brief', 'moderate', 'detailed'] as const).map((length) => (
              <button
                key={length}
                onClick={() => setSettings({ ...settings, responseLength: length })}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all capitalize ${
                  settings.responseLength === length
                    ? 'bg-pink-600 text-white'
                    : 'bg-c-surface-raised text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-navy-700'
                }`}
              >
                {length}
              </button>
            ))}
          </div>
        </div>

        {/* Formality Slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="font-medium text-c-text">Formality Level</label>
            <span className="text-sm text-pink-600">{settings.formality}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={settings.formality}
            onChange={(e) => setSettings({ ...settings, formality: parseInt(e.target.value) })}
            className="w-full h-2 bg-c-surface-raised rounded-lg appearance-none cursor-pointer accent-pink-600"
          />
          <div className="flex justify-between text-xs text-c-text-muted">
            <span>Casual</span>
            <span>Formal</span>
          </div>
        </div>

        {/* Technical Level Slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="font-medium text-c-text">Technical Depth</label>
            <span className="text-sm text-pink-600">{settings.technicalLevel}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={settings.technicalLevel}
            onChange={(e) => setSettings({ ...settings, technicalLevel: parseInt(e.target.value) })}
            className="w-full h-2 bg-c-surface-raised rounded-lg appearance-none cursor-pointer accent-pink-600"
          />
          <div className="flex justify-between text-xs text-c-text-muted">
            <span>Simple</span>
            <span>Technical</span>
          </div>
        </div>
      </div>

      {/* Context Settings */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
          <BookOpen size={20} className="text-blue-500" />
          Context Sources
        </h3>
        <p className="text-sm text-c-text-muted">
          What information AI can use for better responses
        </p>

        <div className="space-y-3">
          <ToggleCard
            enabled={settings.useProjectContext}
            onChange={(v) => setSettings({ ...settings, useProjectContext: v })}
            icon={Briefcase}
            title="Current Project Context"
            description="Use current project information"
          />
          <ToggleCard
            enabled={settings.useHistoricalData}
            onChange={(v) => setSettings({ ...settings, useHistoricalData: v })}
            icon={GraduationCap}
            title="Historical Data"
            description="Learn from your past work"
          />
          <ToggleCard
            enabled={settings.useTeamPatterns}
            onChange={(v) => setSettings({ ...settings, useTeamPatterns: v })}
            icon={Brain}
            title="Team Patterns"
            description="Use team's collective patterns"
          />
        </div>
      </div>
    </div>
  );
};

export default AIBehaviorSettings;
