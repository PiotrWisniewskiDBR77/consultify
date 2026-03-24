import React, { useState } from 'react';
import { Check, Save } from 'lucide-react';

import { Api } from '../../../services/api';

interface VirtualWorker {
  id: string;
  slug: string;
  name: string;
  role: string;
  status: string;
  surface: string;
  voice_enabled: boolean;
  voice_name: string | null;
  locale_default: string;
  description: string | null;
}

interface VirtualWorkerProfile {
  id: string;
  version: number;
  persona_description: string | null;
  tone_description: string | null;
  system_prompt: string;
  priority_rules: Record<string, unknown> | null;
  boundaries: Record<string, unknown> | null;
  is_active: boolean;
}

interface WorkerProfileEditorProps {
  worker: VirtualWorker;
  profile: VirtualWorkerProfile | null;
  onProfileUpdated: () => void;
}

export const WorkerProfileEditor: React.FC<WorkerProfileEditorProps> = ({
  worker,
  profile,
  onProfileUpdated,
}) => {
  const [persona, setPersona] = useState(profile?.persona_description || '');
  const [tone, setTone] = useState(profile?.tone_description || '');
  const [systemPrompt, setSystemPrompt] = useState(profile?.system_prompt || '');
  const [priorityRules, setPriorityRules] = useState(
    profile?.priority_rules ? JSON.stringify(profile.priority_rules, null, 2) : '{}'
  );
  const [boundaries, setBoundaries] = useState(
    profile?.boundaries ? JSON.stringify(profile.boundaries, null, 2) : '{}'
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Worker settings
  const [workerName, setWorkerName] = useState(worker.name);
  const [workerStatus, setWorkerStatus] = useState(worker.status);
  const [voiceEnabled, setVoiceEnabled] = useState(worker.voice_enabled);
  const [voiceName, setVoiceName] = useState(worker.voice_name || '');
  const [description, setDescription] = useState(worker.description || '');

  const handleSaveWorker = async () => {
    try {
      await Api.put(`/api/virtual-workers/${worker.id}`, {
        name: workerName,
        status: workerStatus,
        voice_enabled: voiceEnabled,
        voice_name: voiceName || null,
        description: description || null,
      });
    } catch (err) {
      console.error('Failed to update worker:', err);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      let parsedRules: Record<string, unknown> | undefined;
      let parsedBoundaries: Record<string, unknown> | undefined;
      try { parsedRules = JSON.parse(priorityRules); } catch { /* keep undefined */ }
      try { parsedBoundaries = JSON.parse(boundaries); } catch { /* keep undefined */ }

      await handleSaveWorker();

      await Api.put(`/api/virtual-workers/${worker.id}/profile`, {
        persona_description: persona,
        tone_description: tone,
        system_prompt: systemPrompt,
        priority_rules: parsedRules,
        boundaries: parsedBoundaries,
        activate: true,
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onProfileUpdated();
    } catch (err) {
      console.error('Failed to save profile:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Worker Settings */}
      <section className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
          Worker Settings
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name</label>
            <input
              type="text"
              value={workerName}
              onChange={(e) => setWorkerName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-900 text-slate-900 dark:text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
            <select
              value={workerStatus}
              onChange={(e) => setWorkerStatus(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-900 text-slate-900 dark:text-white text-sm"
            >
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-900 text-slate-900 dark:text-white text-sm"
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={voiceEnabled}
                onChange={(e) => setVoiceEnabled(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Voice Enabled
            </label>
            {voiceEnabled && (
              <input
                type="text"
                value={voiceName}
                onChange={(e) => setVoiceName(e.target.value)}
                placeholder="Voice name (e.g. Kore)"
                className="flex-1 px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-900 text-slate-900 dark:text-white text-sm"
              />
            )}
          </div>
        </div>
      </section>

      {/* Persona & Tone */}
      <section className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
          Persona & Tone
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Persona Description
            </label>
            <textarea
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              rows={3}
              placeholder="Describe the worker's personality and character..."
              className="w-full px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-900 text-slate-900 dark:text-white text-sm resize-y"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Tone Description
            </label>
            <textarea
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              rows={2}
              placeholder="Describe the communication tone..."
              className="w-full px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-900 text-slate-900 dark:text-white text-sm resize-y"
            />
          </div>
        </div>
      </section>

      {/* System Prompt */}
      <section className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
          System Prompt
          {profile && (
            <span className="ml-2 text-xs font-normal text-slate-500">
              v{profile.version}
            </span>
          )}
        </h3>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={16}
          className="w-full px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-900 text-slate-900 dark:text-white text-sm font-mono resize-y"
        />
      </section>

      {/* Priority Rules & Boundaries */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
            Priority Rules (JSON)
          </h3>
          <textarea
            value={priorityRules}
            onChange={(e) => setPriorityRules(e.target.value)}
            rows={8}
            className="w-full px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-900 text-slate-900 dark:text-white text-sm font-mono resize-y"
          />
        </section>
        <section className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
            Boundaries (JSON)
          </h3>
          <textarea
            value={boundaries}
            onChange={(e) => setBoundaries(e.target.value)}
            rows={8}
            className="w-full px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-900 text-slate-900 dark:text-white text-sm font-mono resize-y"
          />
        </section>
      </div>

      {/* Save Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSaveProfile}
          disabled={saving || !systemPrompt.trim()}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors text-sm font-medium"
        >
          {saved ? <Check size={16} /> : <Save size={16} />}
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Profile (new version)'}
        </button>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Saving creates a new profile version and activates it.
        </span>
      </div>
    </div>
  );
};
