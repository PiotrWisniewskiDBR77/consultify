/**
 * FeaturesPrivacyTab - AI Features & Privacy
 *
 * Tab 5 of the reorganized AI & Intelligence section
 * Includes: AI Features toggles, Data Policy, Custom Instructions, System Personas
 *
 * NEW FEATURES: Data retention, AI learning settings, external data policy, custom instructions
 */

import { motion } from 'framer-motion';
import {
  BookOpen,
  Brain,
  Check,
  Clock,
  Database,
  Eye,
  FileCode,
  Focus,
  Globe,
  History,
  Lock,
  MessageSquare,
  Mic,
  RefreshCw,
  Save,
  Settings,
  Shield,
  Sparkles,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { LoadingState } from '@/components/ui/primitives';

import { Api } from '../../../services/api';
import { useAppStore } from '../../../store/useAppStore';
import { OrgAISettings } from '../../../types';
import type { SystemPrompt, SystemPromptContextConfig } from '../../../types/domain/ai';
import { SettingsCard, SettingsToggle } from '../../AISettings';

// Data retention options
const RETENTION_OPTIONS = [
  { value: '7d', label: '7 days', description: 'Minimal retention for compliance' },
  { value: '30d', label: '30 days', description: 'Standard retention period' },
  { value: '90d', label: '90 days', description: 'Extended retention for analytics' },
  { value: '365d', label: '1 year', description: 'Long-term retention' },
  { value: 'forever', label: 'Forever', description: 'Never delete (not recommended)' },
];

export const FeaturesPrivacyTab: React.FC = () => {
  const { currentOrganization } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<OrgAISettings | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<
    'features' | 'data' | 'instructions' | 'personas'
  >('features');

  // System prompts state
  const [prompts, setPrompts] = useState<SystemPrompt[]>([]);
  const [editingPrompt, setEditingPrompt] = useState<SystemPrompt | null>(null);

  // Custom instructions state
  const [customInstructions, setCustomInstructions] = useState('');
  const [toneGuidelines, setToneGuidelines] = useState('professional');

  // Data policy state
  const [dataRetention, setDataRetention] = useState('30d');
  const [aiLearningEnabled, setAILearningEnabled] = useState(false);
  const [externalDataEnabled, setExternalDataEnabled] = useState(false);

  const formatPromptDate = (prompt: SystemPrompt) => {
    const timestamp = prompt.updated_at ?? prompt.updatedAt;
    return timestamp ? new Date(timestamp).toLocaleDateString() : '—';
  };

  useEffect(() => {
    if (currentOrganization?.id) {
      loadSettings();
      loadPrompts();
    }
  }, [currentOrganization?.id]);

  const loadSettings = async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    try {
      const settingsRes = await fetch(`/api/ai-settings/org/${currentOrganization.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
    setLoading(false);
  };

  const loadPrompts = async () => {
    try {
      const promptsData = await Api.aiGetSystemPrompts();
      setPrompts(promptsData);
    } catch (e) {
      console.error('Failed to load prompts:', e);
    }
  };

  const saveSettings = async () => {
    if (!settings || !currentOrganization?.id) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/ai-settings/org/${currentOrganization.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
        setHasChanges(false);
        toast.success('Features & Privacy settings saved');
      } else {
        throw new Error('Save failed');
      }
    } catch (error) {
      toast.error('Failed to save settings');
    }
    setSaving(false);
  };

  const updateSetting = <K extends keyof OrgAISettings>(key: K, value: OrgAISettings[K]) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : null));
    setHasChanges(true);
  };

  const handleUpdatePrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPrompt) return;
    try {
      await Api.aiUpdateSystemPrompt(editingPrompt.key, {
        content: editingPrompt.content,
        description: editingPrompt.description,
        context_config: editingPrompt.context_config,
        updatedBy: 'Admin',
      });
      toast.success('System Prompt Updated');
      setEditingPrompt(null);
      loadPrompts();
    } catch (e) {
      toast.error('Failed to update prompt');
    }
  };

  if (loading) {
    return <LoadingState variant="spinner" className="h-64" />;
  }

  return (
    <div className="space-y-6">
      {/* Header with Save Button - DBR77 Compatible */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-navy-900 dark:text-white flex items-center gap-2">
            <Sparkles className="text-primary-600 dark:text-primary-400" size={20} />
            Features & Privacy
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configure AI features, data policies, and custom instructions
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasChanges && (
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-xs text-warning-700 dark:text-amber-400 bg-warning-500/10 px-3 py-1.5 rounded-full border border-warning-500/30 dark:border-transparent"
            >
              Unsaved changes
            </motion.span>
          )}
          <button
            onClick={saveSettings}
            disabled={saving || !hasChanges}
            className={`flex items-center gap-2 p-4 py-2.5 rounded-lg font-medium transition-all ${
              hasChanges
                ? 'bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] shadow-lg shadow-primary-500/20'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-500 cursor-not-allowed'
            }`}
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </div>

      {/* Sub-tabs - DBR77 Compatible */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-navy-700 pb-1">
        <button
          onClick={() => setActiveSubTab('features')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeSubTab === 'features'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white'
          }`}
        >
          <Sparkles size={14} className="inline mr-2" />
          AI Features
        </button>
        <button
          onClick={() => setActiveSubTab('data')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeSubTab === 'data'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white'
          }`}
        >
          <Database size={14} className="inline mr-2" />
          Data Policy
        </button>
        <button
          onClick={() => setActiveSubTab('instructions')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeSubTab === 'instructions'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white'
          }`}
        >
          <MessageSquare size={14} className="inline mr-2" />
          Custom Instructions
        </button>
        <button
          onClick={() => setActiveSubTab('personas')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeSubTab === 'personas'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white'
          }`}
        >
          <Brain size={14} className="inline mr-2" />
          System Personas
        </button>
      </div>

      {/* AI Features */}
      {activeSubTab === 'features' && settings && (
        <SettingsCard
          title="AI Features"
          description="Enable or disable specific AI capabilities for your organization"
          icon={Sparkles}
          iconColor="text-primary-400"
        >
          <div className="space-y-4">
            <SettingsToggle
              label="Artifacts Panel"
              description="Allow AI to generate structured content (code, documents, diagrams)"
              icon={FileCode}
              iconColor="text-blue-400"
              checked={settings.artifactsEnabled}
              onChange={(v) => updateSetting('artifactsEnabled', v)}
            />

            <SettingsToggle
              label="Thinking Steps (Chain of Thought)"
              description="Show AI reasoning process with expandable thinking blocks"
              icon={Brain}
              iconColor="text-primary-400"
              checked={settings.thinkingStepsEnabled}
              onChange={(v) => updateSetting('thinkingStepsEnabled', v)}
            />

            <SettingsToggle
              label="Focus Modes"
              description="Allow users to filter AI context (PMO Docs, Project Data, Research)"
              icon={Focus}
              iconColor="text-blue-400"
              checked={settings.focusModesEnabled}
              onChange={(v) => updateSetting('focusModesEnabled', v)}
            />

            <SettingsToggle
              label="Web Search"
              description="Allow AI to search the internet for current information"
              icon={Eye}
              iconColor="text-emerald-400"
              checked={settings.webSearchEnabled}
              onChange={(v) => updateSetting('webSearchEnabled', v)}
            />

            <SettingsToggle
              label="Voice Conversations"
              description="Enable voice input and output for AI interactions"
              icon={Mic}
              iconColor="text-danger-400"
              checked={settings.voiceEnabled}
              onChange={(v) => updateSetting('voiceEnabled', v)}
            />

            <div className="pt-4 border-t border-c-border/50">
              <h4 className="font-medium text-c-text mb-3">Audit Settings</h4>
              <div className="space-y-3">
                <SettingsToggle
                  label="Audit All AI Requests"
                  description="Log every AI interaction for compliance (increases storage)"
                  icon={History}
                  iconColor="text-amber-400"
                  checked={settings.auditAllRequests}
                  onChange={(v) => updateSetting('auditAllRequests', v)}
                />
                <SettingsToggle
                  label="Audit Policy Changes"
                  description="Track all changes to AI settings"
                  icon={Shield}
                  iconColor="text-amber-400"
                  checked={settings.auditPolicyChanges}
                  onChange={(v) => updateSetting('auditPolicyChanges', v)}
                />
              </div>
            </div>
          </div>
        </SettingsCard>
      )}

      {/* Data Policy */}
      {activeSubTab === 'data' && (
        <div className="space-y-6">
          <SettingsCard
            title="Data Retention"
            description="How long AI conversation data is stored"
            icon={Clock}
            iconColor="text-blue-400"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {RETENTION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDataRetention(opt.value)}
                  className={`p-4 rounded-xl text-left transition-all ${
                    dataRetention === opt.value
                      ? 'bg-primary-500/20 border-2 border-primary-500/50'
                      : 'bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-navy-900 dark:text-white">{opt.label}</span>
                    {dataRetention === opt.value && (
                      <Check size={14} className="text-primary-600 dark:text-primary-400" />
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{opt.description}</p>
                </button>
              ))}
            </div>
          </SettingsCard>

          <SettingsCard
            title="AI Learning"
            description="Control how AI learns from your organization's data"
            icon={BookOpen}
            iconColor="text-emerald-400"
          >
            <div className="space-y-4">
              <div
                className={`p-4 rounded-xl transition-all cursor-pointer ${
                  aiLearningEnabled
                    ? 'bg-success-500/20 border border-success-500/30'
                    : 'bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700/50'
                }`}
                onClick={() => setAILearningEnabled(!aiLearningEnabled)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg ${aiLearningEnabled ? 'bg-success-500/20' : 'bg-slate-200 dark:bg-slate-700'}`}
                    >
                      <Brain
                        size={18}
                        className={
                          aiLearningEnabled
                            ? 'text-success-600 dark:text-emerald-400'
                            : 'text-slate-500 dark:text-slate-400'
                        }
                      />
                    </div>
                    <div>
                      <h4 className="font-medium text-navy-900 dark:text-white">
                        Allow AI to Learn from Organization Data
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        AI will improve responses based on your organization's patterns and
                        decisions
                      </p>
                    </div>
                  </div>
                  <div
                    className={`w-11 h-6 rounded-full transition-colors ${
                      aiLearningEnabled
                        ? 'bg-success-600 dark:bg-emerald-500'
                        : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white dark:bg-navy-900 mt-1 transition-transform ${
                        aiLearningEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-warning-500/10 border border-warning-500/20 rounded-xl">
                <div className="flex gap-3">
                  <Shield
                    size={18}
                    className="text-warning-600 dark:text-amber-400 shrink-0 mt-0.5"
                  />
                  <div>
                    <h4 className="font-medium text-warning-700 dark:text-amber-300">
                      Privacy Notice
                    </h4>
                    <p className="text-xs text-warning-700/70 dark:text-amber-200/70 mt-1">
                      When enabled, AI learning uses only aggregated, anonymized patterns. No
                      personal or sensitive data is used for training.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </SettingsCard>

          <SettingsCard
            title="External Data Policy"
            description="Control AI access to external data sources"
            icon={Globe}
            iconColor="text-blue-400"
          >
            <div
              className={`p-4 rounded-xl transition-all cursor-pointer ${
                externalDataEnabled
                  ? 'bg-info-500/20 border border-info-500/30'
                  : 'bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700/50'
              }`}
              onClick={() => setExternalDataEnabled(!externalDataEnabled)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg ${externalDataEnabled ? 'bg-info-500/20' : 'bg-slate-200 dark:bg-slate-700'}`}
                  >
                    <Globe
                      size={18}
                      className={
                        externalDataEnabled
                          ? 'text-info-600 dark:text-blue-400'
                          : 'text-slate-500 dark:text-slate-400'
                      }
                    />
                  </div>
                  <div>
                    <h4 className="font-medium text-navy-900 dark:text-white">
                      Allow External Data Access
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      AI can fetch industry benchmarks, market data, and external references
                    </p>
                  </div>
                </div>
                <div
                  className={`w-11 h-6 rounded-full transition-colors ${
                    externalDataEnabled
                      ? 'bg-info-600 dark:bg-blue-500'
                      : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white dark:bg-navy-900 mt-1 transition-transform ${
                      externalDataEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </div>
              </div>
            </div>
          </SettingsCard>
        </div>
      )}

      {/* Custom Instructions */}
      {activeSubTab === 'instructions' && (
        <div className="space-y-6">
          <SettingsCard
            title="Organization Instructions"
            description="Custom instructions applied to all AI interactions in your organization"
            icon={MessageSquare}
            iconColor="text-blue-400"
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-500 dark:text-slate-400 mb-2">
                  Tone & Style
                </label>
                <select
                  value={toneGuidelines}
                  onChange={(e) => setToneGuidelines(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-navy-900 dark:text-white focus:border-c-focus-solid outline-none"
                >
                  <option value="professional">
                    Professional - Formal and business-appropriate
                  </option>
                  <option value="friendly">Friendly - Approachable and conversational</option>
                  <option value="technical">Technical - Precise and detailed</option>
                  <option value="concise">Concise - Brief and to the point</option>
                  <option value="educational">
                    Educational - Explanatory and teaching-focused
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-500 dark:text-slate-400 mb-2">
                  Custom System Instructions
                </label>
                <textarea
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder="Add custom instructions that will be applied to all AI interactions...

Example:
- Always mention relevant ISO standards when discussing processes
- Use metric units for all measurements
- Reference company policies when applicable"
                  className="w-full h-48 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-4 text-navy-900 dark:text-white font-mono text-sm focus:border-c-focus-solid outline-none resize-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  These instructions are prepended to every AI request in your organization.
                </p>
              </div>
            </div>
          </SettingsCard>

          {/* Restricted Topics */}
          <SettingsCard
            title="Restricted Topics"
            description="Topics or content types the AI should avoid discussing"
            icon={Lock}
            iconColor="text-danger-400"
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    id: 'no_competitor',
                    label: 'Competitor Analysis',
                    desc: 'Avoid discussing competitor products/services',
                  },
                  {
                    id: 'no_legal',
                    label: 'Legal Advice',
                    desc: "Don't provide legal recommendations",
                  },
                  {
                    id: 'no_financial',
                    label: 'Financial Advice',
                    desc: 'Avoid specific financial recommendations',
                  },
                  {
                    id: 'no_personnel',
                    label: 'Personnel Decisions',
                    desc: "Don't advise on hiring/firing",
                  },
                  {
                    id: 'no_medical',
                    label: 'Medical Topics',
                    desc: 'Avoid health-related advice',
                  },
                  {
                    id: 'no_politics',
                    label: 'Political Topics',
                    desc: 'Stay neutral on political matters',
                  },
                ].map((topic) => (
                  <label
                    key={topic.id}
                    className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700/50 rounded-lg hover:border-slate-300 dark:hover:border-slate-600 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      className="w-4 h-4 mt-0.5 rounded border-slate-300 dark:border-slate-600 text-danger-500 focus:ring-danger-500 bg-white dark:bg-slate-700"
                    />
                    <div>
                      <span className="font-medium text-navy-900 dark:text-white text-sm">
                        {topic.label}
                      </span>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {topic.desc}
                      </p>
                    </div>
                  </label>
                ))}
              </div>

              <div>
                <label className="block text-sm text-slate-500 dark:text-slate-400 mb-2">
                  Custom Restricted Keywords
                </label>
                <textarea
                  placeholder="Enter keywords or phrases the AI should avoid, one per line..."
                  className="w-full h-24 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-navy-900 dark:text-white font-mono text-sm focus:border-c-focus-solid outline-none resize-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>
            </div>
          </SettingsCard>
        </div>
      )}

      {/* System Personas */}
      {activeSubTab === 'personas' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-600 dark:text-slate-500 uppercase tracking-wider">
              Available Personas
            </h3>
            {prompts.map((p) => (
              <div
                key={p.key}
                onClick={() => setEditingPrompt(p)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  editingPrompt?.key === p.key
                    ? 'bg-primary-500/20 border-primary-500'
                    : 'bg-c-surface border-c-border-subtle hover:border-c-border'
                }`}
              >
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold text-c-text">{p.key}</h3>
                  <span className="text-xs text-slate-600 dark:text-slate-500">
                    {formatPromptDate(p)}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-500 line-clamp-2">
                  {p.description}
                </p>
              </div>
            ))}
          </div>

          <div className="bg-c-surface border border-c-border-subtle rounded-xl p-6 h-fit">
            {editingPrompt ? (
              <form onSubmit={handleUpdatePrompt}>
                <h3 className="text-lg font-bold text-c-text mb-4">Edit: {editingPrompt.key}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-500 mb-1">
                      Description
                    </label>
                    <input
                      value={editingPrompt.description}
                      onChange={(e) =>
                        setEditingPrompt({ ...editingPrompt, description: e.target.value })
                      }
                      className="w-full bg-c-text text-c-bg border border-c-border-subtle rounded p-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-500 mb-1">
                      System Prompt
                    </label>
                    <textarea
                      value={editingPrompt.content}
                      onChange={(e) =>
                        setEditingPrompt({ ...editingPrompt, content: e.target.value })
                      }
                      className="w-full h-64 bg-c-text text-c-bg border border-c-border-subtle rounded p-4 font-mono text-sm leading-relaxed focus:border-c-focus-solid outline-none resize-none"
                    />
                  </div>

                  {/* Context Injection Controls */}
                  <div className="bg-c-bg border border-c-border-subtle rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-c-text mb-3 flex items-center gap-2">
                      <Shield size={14} className="text-primary-400" />
                      Context Injection
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: 'include_project_context', label: 'Project Context' },
                        { id: 'include_user_profile', label: 'User Profile' },
                        { id: 'include_assessment_data', label: 'Assessment Data' },
                        { id: 'include_kb_articles', label: 'Knowledge Base' },
                        { id: 'include_task_history', label: 'Task History' },
                      ].map((opt) => {
                        const config: SystemPromptContextConfig =
                          typeof editingPrompt.context_config === 'string'
                            ? (JSON.parse(
                                editingPrompt.context_config || '{}'
                              ) as SystemPromptContextConfig)
                            : editingPrompt.context_config || {};

                        return (
                          <label
                            key={opt.id}
                            className="flex items-center gap-2 cursor-pointer group"
                          >
                            <input
                              type="checkbox"
                              checked={!!config[opt.id]}
                              onChange={(e) => {
                                const newConfig: SystemPromptContextConfig = {
                                  ...config,
                                  [opt.id]: e.target.checked,
                                };
                                setEditingPrompt({
                                  ...editingPrompt,
                                  context_config: newConfig,
                                });
                              }}
                              className="w-4 h-4 rounded border-slate-600 text-primary-500 focus:ring-c-focus bg-c-surface-raised"
                            />
                            <span className="text-xs text-slate-600">{opt.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingPrompt(null)}
                      className="px-4 py-2 text-slate-600 dark:text-slate-500 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg font-medium flex items-center gap-2"
                    >
                      <Save size={16} /> Save Persona
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-500 dark:text-slate-400">
                <div className="text-center">
                  <Brain size={40} className="mx-auto mb-3 opacity-50" />
                  <p>Select a persona to edit</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FeaturesPrivacyTab;
