import { Brain, Check, Lock, RefreshCw, Shield, Trash2, X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';

type Wave6Memory = {
  candidateId: string;
  assistantScope: string;
  memoryScope: string;
  status: string;
  key: string;
  value: string;
  sourceLabel?: string | null;
  privateMode?: boolean;
};

type Wave6AssistantScope = 'anna_public' | 'teresa_tenant';
type Wave6MemoryScope = 'public_product' | 'tenant' | 'org' | 'user' | 'project';
type Wave6SnapshotScope = 'org' | 'project' | 'user';

const MEMORY_KEY_OPTIONS = [
  { value: 'communication_style', label: 'Communication style' },
  { value: 'working_preferences', label: 'Working preferences' },
  { value: 'project_context', label: 'Project context' },
  { value: 'decision_criteria', label: 'Decision criteria' },
] as const;

function humanizeFactKey(key: string): string {
  const known: Record<string, string> = {
    conversationId: 'Conversation context',
    focusMode: 'Focus mode',
    hasScreenContext: 'Screen context',
    userWorkProfilePreferences: 'Work profile preferences',
    userPreferencePreview: 'Preference preview',
    projectId: 'Project scope',
    capturedBy: 'Captured from',
    scope: 'Scope',
  };
  if (known[key]) return known[key];
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatFactValue(key: string, value: unknown): string {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  if (value == null || value === '') return 'Not set';
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? '' : 's'}`;
  if (typeof value === 'number') {
    if (key === 'userWorkProfilePreferences') {
      return `${value} preference${value === 1 ? '' : 's'}`;
    }
    return String(value);
  }
  if (typeof value === 'object') return 'Configured';
  const text = String(value);
  if (/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(text)) return 'Linked';
  if (key.toLowerCase().endsWith('id')) return text ? 'Linked' : 'Not set';
  if (key === 'focusMode') return text.replace(/\b\w/g, (char) => char.toUpperCase());
  if (key === 'capturedBy') return text.replace(/[_-]+/g, ' ');
  return text;
}

function getDisplayFacts(facts: unknown): Array<{ label: string; value: string }> {
  if (!facts || typeof facts !== 'object' || Array.isArray(facts)) return [];
  return Object.entries(facts as Record<string, unknown>).map(([key, value]) => ({
    label: humanizeFactKey(key),
    value: formatFactValue(key, value),
  }));
}

export const Wave6ContextLearningPanel: React.FC = () => {
  const { t } = useTranslation();
  const { i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');
  const [panel, setPanel] = React.useState<any>(null);
  const [projectId, setProjectId] = React.useState('');
  const [snapshotScope, setSnapshotScope] = React.useState<Wave6SnapshotScope>('user');
  const [privateMode, setPrivateMode] = React.useState(false);
  const [assistantScope, setAssistantScope] = React.useState<Wave6AssistantScope>('teresa_tenant');
  const [memoryScope, setMemoryScope] = React.useState<Wave6MemoryScope>('user');
  const [memoryKey, setMemoryKey] = React.useState('communication_style');
  const [memoryValue, setMemoryValue] = React.useState('');
  const [message, setMessage] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await Api.getWave6ContextPanel(projectId || null);
      setPanel(res?.panel || null);
    } catch (err: any) {
      setMessage(err?.message || 'Failed to load context panel');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (assistantScope === 'anna_public') {
      setMemoryScope('public_product');
    } else if (memoryScope === 'public_product') {
      setMemoryScope(projectId.trim() ? 'project' : 'user');
    }
  }, [assistantScope, memoryScope, projectId]);

  const captureSnapshot = async () => {
    if (snapshotScope === 'project' && !projectId.trim()) {
      setMessage('Project snapshot requires a project id.');
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const snapshotType = snapshotScope;
      const snapshotProjectId = snapshotType === 'project' ? projectId.trim() : null;
      const facts = {
        projectId: snapshotProjectId,
        scope: snapshotType,
        userPreferencePreview: memoryValue || null,
        capturedBy: 'wave6_context_panel',
      };
      const res = await Api.captureWave6ContextSnapshot({
        snapshotType,
        projectId: snapshotProjectId,
        facts,
        sourceRefs: [{ sourceType: 'manual_panel', sourceTitle: 'Wave 6 context panel' }],
        permissions: { scope: snapshotType, canForget: true },
        privateMode,
      });
      if (res?.success === false) throw new Error(res?.error || 'Snapshot failed');
      setMessage(
        privateMode
          ? 'Private snapshot captured with limited retention.'
          : `${snapshotType.toUpperCase()} context snapshot captured.`
      );
      await load();
    } catch (err: any) {
      setMessage(err?.message || 'Failed to capture snapshot');
    } finally {
      setLoading(false);
    }
  };

  const captureMemory = async () => {
    if (!memoryKey.trim() || !memoryValue.trim()) {
      setMessage('Memory key and value are required.');
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await Api.captureWave6MemoryCandidate({
        assistantScope,
        memoryScope,
        key: memoryKey.trim(),
        value: memoryValue.trim(),
        projectId: memoryScope === 'project' ? projectId.trim() || null : null,
        sourceLabel: 'Wave 6 panel user request',
        privateMode,
        retentionDays: 180,
      });
      if (res?.blocked) {
        setMessage(`Memory blocked: ${res.reason}`);
      } else {
        const candidate = res?.candidate;
        setMemoryValue('');
        await load();
        if (candidate?.candidateId) {
          setPanel((prev: any) => ({
            ...(prev || {}),
            memories: [
              candidate,
              ...(Array.isArray(prev?.memories)
                ? prev.memories.filter(
                    (memory: Wave6Memory) => memory.candidateId !== candidate.candidateId
                  )
                : []),
            ],
          }));
        }
        setMessage('Memory candidate created and visible in the stewardship queue below.');
        return;
      }
      setMemoryValue('');
      await load();
    } catch (err: any) {
      setMessage(err?.message || 'Failed to capture memory candidate');
    } finally {
      setLoading(false);
    }
  };

  const decideMemory = async (
    candidate: Wave6Memory,
    decision: 'approve' | 'reject' | 'apply' | 'expire'
  ) => {
    setLoading(true);
    setMessage(null);
    try {
      await Api.decideWave6MemoryCandidate(candidate.candidateId, {
        decision,
        reason: `User selected ${decision} from Wave 6 stewardship panel`,
      });
      setMessage(`Memory ${decision} recorded.`);
      await load();
    } catch (err: any) {
      setMessage(err?.message || 'Failed to decide memory candidate');
    } finally {
      setLoading(false);
    }
  };

  const memories: Wave6Memory[] = Array.isArray(panel?.memories) ? panel.memories : [];

  return (
    <div className="mx-auto max-w-7xl p-6 text-slate-900 dark:text-white">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {t('aios.wave6ContextLearningPanel.wave6ContextAndLearning')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {t('aios.wave6ContextLearningPanel.showsWhatAiKnowsWhereIt')}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm disabled:opacity-50 dark:border-navy-700"
        >
          <RefreshCw size={16} /> {t('aios.wave6ContextLearningPanel.refresh')}
        </button>
      </div>

      {message && (
        <div className="mb-4 rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
          {message}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <section className="rounded-xl border bg-white p-4 shadow-sm dark:border-navy-700 dark:bg-navy-900">
          <h2 className="flex items-center gap-2 font-semibold">
            <Shield size={18} /> {t('aios.wave6ContextLearningPanel.contextControls')}
          </h2>
          <div className="mt-4 space-y-3">
            <label className="block text-xs font-medium text-slate-500">
              {t('aios.wave6ContextLearningPanel.projectScope')}
            </label>
            <input
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              placeholder={t('aios.wave6ContextLearningPanel.optionalProjectId')}
              className="w-full rounded-md border px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
            />
            <label className="block text-xs font-medium text-slate-500">
              {t('aios.wave6ContextLearningPanel.snapshotScope')}
            </label>
            <select
              value={snapshotScope}
              onChange={(event) => setSnapshotScope(event.target.value as Wave6SnapshotScope)}
              className="w-full rounded-md border px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
            >
              <option value="user">
                {t('aios.wave6ContextLearningPanel.userWorkProfileSnapshot')}
              </option>
              <option value="org">
                {t('aios.wave6ContextLearningPanel.organizationSnapshot')}
              </option>
              <option value="project" disabled={!projectId.trim()}>
                {t('aios.wave6ContextLearningPanel.projectSnapshot')}
              </option>
            </select>
            <label className="flex items-center gap-2 rounded-md border p-3 text-sm dark:border-navy-700">
              <input
                type="checkbox"
                checked={privateMode}
                onChange={(event) => setPrivateMode(event.target.checked)}
              />
              <Lock size={15} />{' '}
              {t('aios.wave6ContextLearningPanel.privateModeBlocksLearningWrites')}
            </label>
            <button
              type="button"
              onClick={captureSnapshot}
              disabled={loading}
              className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-sky-600"
            >
              {t('aios.wave6ContextLearningPanel.captureContextSnapshot')}
            </button>
          </div>

          <h2 className="mt-6 flex items-center gap-2 font-semibold">
            <Brain size={18} /> {t('aios.wave6ContextLearningPanel.memoryCandidate')}
          </h2>
          <div className="mt-4 space-y-3">
            <label className="block text-xs font-medium text-slate-500">
              {t('aios.wave6ContextLearningPanel.assistantScope')}
            </label>
            <select
              value={assistantScope}
              onChange={(event) => {
                const nextScope = event.target.value as Wave6AssistantScope;
                setAssistantScope(nextScope);
                if (nextScope === 'anna_public') {
                  setMemoryScope('public_product');
                } else if (memoryScope === 'public_product') {
                  setMemoryScope(projectId.trim() ? 'project' : 'user');
                }
              }}
              className="w-full rounded-md border px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
            >
              <option value="teresa_tenant">
                {t('aios.wave6ContextLearningPanel.teresaTenantMemory')}
              </option>
              <option value="anna_public">
                {t('aios.wave6ContextLearningPanel.annaPublicProductMemory')}
              </option>
            </select>
            <label className="block text-xs font-medium text-slate-500">
              {t('aios.wave6ContextLearningPanel.memoryScope')}
            </label>
            <select
              value={memoryScope}
              onChange={(event) => setMemoryScope(event.target.value as Wave6MemoryScope)}
              className="w-full rounded-md border px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
            >
              <option value="user">{t('aios.wave6ContextLearningPanel.user')}</option>
              <option value="project">{t('aios.wave6ContextLearningPanel.project')}</option>
              <option value="org">{t('aios.wave6ContextLearningPanel.organization')}</option>
              <option value="tenant">{t('aios.wave6ContextLearningPanel.tenant')}</option>
              <option value="public_product">
                {t('aios.wave6ContextLearningPanel.publicProduct')}
              </option>
            </select>
            <label className="block text-xs font-medium text-slate-500">
              {t('aios.wave6ContextLearningPanel.memoryKey')}
            </label>
            <select
              value={memoryKey}
              onChange={(event) => setMemoryKey(event.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
            >
              {MEMORY_KEY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <label className="block text-xs font-medium text-slate-500">
              {t('aios.wave6ContextLearningPanel.memoryValue')}
            </label>
            <textarea
              value={memoryValue}
              onChange={(event) => setMemoryValue(event.target.value)}
              placeholder={t('aios.wave6ContextLearningPanel.whatShouldAiRememberExampleI')}
              rows={4}
              className="w-full rounded-md border px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
            />
            <button
              type="button"
              onClick={captureMemory}
              disabled={loading || !memoryValue.trim()}
              className="w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {t('aios.wave6ContextLearningPanel.createMemoryCandidate')}
            </button>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-xl border bg-white p-4 shadow-sm dark:border-navy-700 dark:bg-navy-900">
            <h2 className="font-semibold">{t('aios.wave6ContextLearningPanel.whatAiKnows')}</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {(panel?.snapshots || []).map((snapshot: any) => (
                <div
                  key={snapshot.snapshotId}
                  className="rounded-lg border p-3 text-sm dark:border-navy-700"
                >
                  <div className="font-medium">
                    {snapshot.snapshotType} {t('aios.wave6ContextLearningPanel.snapshot')}
                  </div>
                  <div className="text-xs text-slate-500">
                    {t('aios.wave6ContextLearningPanel.fresh')}:{' '}
                    {snapshot.freshnessAt || t('aios.wave6ContextLearningPanel.unknown')}
                  </div>
                  <div className="mt-2 rounded bg-slate-50 p-2 text-xs dark:bg-navy-950">
                    {getDisplayFacts(snapshot.facts).length > 0 ? (
                      <dl className="grid gap-2">
                        {getDisplayFacts(snapshot.facts).map((fact) => (
                          <div
                            key={`${snapshot.snapshotId}-${fact.label}`}
                            className="flex items-start justify-between gap-3 rounded border border-slate-200 bg-white px-2 py-1.5 dark:border-navy-800 dark:bg-navy-900"
                          >
                            <dt className="text-slate-500 dark:text-slate-400">{fact.label}</dt>
                            <dd className="text-right font-medium text-slate-700 dark:text-slate-200">
                              {fact.value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <div className="text-slate-500 dark:text-slate-400">
                        {t('aios.wave6ContextLearningPanel.noDisplayableFactsForThisSnapshot')}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {(panel?.snapshots || []).length === 0 && (
                <div className="text-sm text-slate-500">
                  {t('aios.wave6ContextLearningPanel.noContextSnapshotsYet')}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border bg-white p-4 shadow-sm dark:border-navy-700 dark:bg-navy-900">
            <h2 className="font-semibold">
              {t('aios.wave6ContextLearningPanel.memoryStewardshipQueue')}
            </h2>
            <div className="mt-3 space-y-3">
              {memories.map((memory) => (
                <div
                  key={memory.candidateId}
                  className="rounded-lg border p-3 text-sm dark:border-navy-700"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">
                        {memory.key}{' '}
                        <span className="text-xs text-slate-500">({memory.status})</span>
                      </div>
                      <div className="mt-1 text-slate-600 dark:text-slate-300">{memory.value}</div>
                      <div className="mt-2 text-xs text-slate-500">
                        {memory.assistantScope} / {memory.memoryScope} /{' '}
                        {t('aios.wave6ContextLearningPanel.source')}:{' '}
                        {memory.sourceLabel || t('aios.wave6ContextLearningPanel.unknown2')}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {memory.status === 'candidate' && (
                        <>
                          <button
                            type="button"
                            onClick={() => decideMemory(memory, 'approve')}
                            className="rounded bg-emerald-600 p-2 text-white"
                            title={t('aios.wave6ContextLearningPanel.approveAndRetain')}
                          >
                            <Check size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => decideMemory(memory, 'reject')}
                            className="rounded bg-danger-600 p-2 text-white"
                            title={t('aios.wave6ContextLearningPanel.reject')}
                          >
                            <X size={14} />
                          </button>
                        </>
                      )}
                      {memory.status === 'retained' && (
                        <button
                          type="button"
                          onClick={() => decideMemory(memory, 'apply')}
                          className="rounded bg-sky-600 p-2 text-white"
                          title={t('aios.wave6ContextLearningPanel.markApplied')}
                        >
                          <Check size={14} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => decideMemory(memory, 'expire')}
                        className="rounded border p-2 dark:border-navy-700"
                        title={t('aios.wave6ContextLearningPanel.expire')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {memories.length === 0 && (
                <div className="text-sm text-slate-500">
                  {t('aios.wave6ContextLearningPanel.noMemoryCandidatesYet')}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Wave6ContextLearningPanel;
