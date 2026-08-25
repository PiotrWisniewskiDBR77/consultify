import { Brain, Save, Shield } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { Api } from '../../../services/api';
import type { SystemPrompt, SystemPromptContextConfig } from '../../../types/domain/ai';
export const PersonasPanel: React.FC = () => {
  const { t } = useTranslation(),
    [prompts, setPrompts] = useState<SystemPrompt[]>([]),
    [editing, setEditing] = useState<SystemPrompt | null>(null),
    [error, setError] = useState<string | null>(null);
  const load = async () => {
    try {
      setPrompts(await Api.aiGetSystemPrompts());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load personas');
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    try {
      await Api.aiUpdateSystemPrompt(editing.key, {
        content: editing.content,
        description: editing.description,
        context_config: editing.context_config,
        updatedBy: 'Admin',
      });
      await load();
      setEditing(null);
      toast.success(
        t('admin.aiControlCenter.featuresPrivacy.toasts.promptUpdated', 'System Prompt Updated')
      );
    } catch {
      toast.error(
        t('admin.aiControlCenter.featuresPrivacy.errors.updatePrompt', 'Failed to update prompt')
      );
    }
  };
  const options = [
    ['include_project_context', 'Project Context'],
    ['include_user_profile', 'User Profile'],
    ['include_assessment_data', 'Assessment Data'],
    ['include_kb_articles', 'Knowledge Base'],
    ['include_task_history', 'Task History'],
  ];
  return (
    <div className="space-y-4">
      {error && <div role="alert">{error}</div>}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <h3 className="text-sm font-medium uppercase tracking-wider text-c-text-secondary">
            Available Personas
          </h3>
          {prompts.map((p) => (
            <button
              key={p.key}
              onClick={() => setEditing(p)}
              className="block w-full rounded-xl border border-c-border bg-c-surface p-4 text-left"
            >
              <strong>{p.key}</strong>
              <p className="mt-1 text-xs text-c-text-secondary">{p.description}</p>
            </button>
          ))}
          {prompts.length === 0 && !error && (
            <p className="rounded-xl border border-c-border p-4">No personas configured.</p>
          )}
        </div>
        <div className="h-fit rounded-xl border border-c-border bg-c-surface p-6">
          {editing ? (
            <form onSubmit={save} className="space-y-4">
              <h3 className="font-semibold">Edit: {editing.key}</h3>
              <label className="block text-sm">
                Description
                <input
                  aria-label="Persona description"
                  value={editing.description || ''}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  className="mt-1 block w-full rounded border border-c-border bg-c-surface p-2"
                />
              </label>
              <label className="block text-sm">
                System Prompt
                <textarea
                  aria-label="System Prompt"
                  value={editing.content}
                  onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                  className="mt-1 h-64 w-full rounded border border-c-border bg-c-surface p-3 font-mono"
                />
              </label>
              <fieldset className="rounded border border-c-border p-3">
                <legend className="flex items-center gap-2 text-sm">
                  <Shield className="h-4 w-4" />
                  Context Injection
                </legend>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {options.map(([id, label]) => {
                    const cfg: SystemPromptContextConfig =
                      typeof editing.context_config === 'string'
                        ? JSON.parse(editing.context_config || '{}')
                        : editing.context_config || {};
                    return (
                      <label key={id} className="text-xs">
                        <input
                          type="checkbox"
                          checked={!!cfg[id]}
                          onChange={(e) =>
                            setEditing({
                              ...editing,
                              context_config: { ...cfg, [id]: e.target.checked },
                            })
                          }
                        />{' '}
                        {label}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded bg-c-accent px-3 py-2 text-white"
              >
                <Save className="h-4 w-4" />
                Save Persona
              </button>
            </form>
          ) : (
            <div className="flex h-64 items-center justify-center text-c-text-secondary">
              <Brain className="mr-2 h-6 w-6" />
              Select a persona to edit
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default PersonasPanel;
