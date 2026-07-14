import { Check, FileText, GitBranch, RefreshCw, X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';

type Wave5Artifact = {
  artifactId: string;
  artifactType: string;
  status: string;
  title: string;
  content: string;
  version: number;
  provenance?: Record<string, unknown>;
  exportManifest?: Record<string, unknown>;
  mutations?: Wave5Mutation[];
  versions?: Array<{ version: number; createdAt: string; mutationId?: string | null }>;
};

type Wave5Mutation = {
  mutationId: string;
  status: string;
  summary?: string;
  diff?: Array<{ line: number; type: string; before?: string; after?: string }>;
};

const DEFAULT_TYPES = [
  'note',
  'decision',
  'task',
  'initiative',
  'report',
  'research_report',
  'slide_deck',
  'spreadsheet',
  'diagram',
  'survey_insight',
  'financial_model',
];

export const Wave5ArtifactRuntimePanel: React.FC = () => {
  const { t } = useTranslation();
  const { i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');

  const [artifactTypes, setArtifactTypes] = React.useState<string[]>(DEFAULT_TYPES);
  const [artifacts, setArtifacts] = React.useState<Wave5Artifact[]>([]);
  const [selected, setSelected] = React.useState<Wave5Artifact | null>(null);
  const [artifactType, setArtifactType] = React.useState('report');
  const [title, setTitle] = React.useState('');
  const [content, setContent] = React.useState('');
  const [proposedContent, setProposedContent] = React.useState('');
  const [template, setTemplate] = React.useState('Business case for {{initiative}} in {{quarter}}');
  const [fieldsJson, setFieldsJson] = React.useState('{\n  "initiative": "",\n  "quarter": ""\n}');
  const [generationKind, setGenerationKind] = React.useState<
    'executive_report' | 'board_deck' | 'kpi_table'
  >('executive_report');
  const [generationPrompt, setGenerationPrompt] = React.useState('');
  const [message, setMessage] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const selectedRef = React.useRef<Wave5Artifact | null>(null);

  React.useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [schemaRes, listRes] = await Promise.all([
        Api.getWave5ArtifactSchema(),
        Api.listWave5Artifacts({ limit: 50 }),
      ]);
      if (Array.isArray(schemaRes?.artifactTypes)) setArtifactTypes(schemaRes.artifactTypes);
      const next = Array.isArray(listRes?.artifacts) ? listRes.artifacts : [];
      setArtifacts(next);
      const selectedArtifact = selectedRef.current;
      if (!selectedArtifact && next.length > 0) {
        const detail = await Api.getWave5Artifact(next[0].artifactId);
        setSelected(detail?.artifact || next[0]);
      }
      if (selectedArtifact) {
        const fresh = next.find(
          (artifact: Wave5Artifact) => artifact.artifactId === selectedArtifact.artifactId
        );
        if (fresh) {
          const detail = await Api.getWave5Artifact(fresh.artifactId);
          setSelected(detail?.artifact || fresh);
        }
      }
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load artifacts');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const refreshSelected = async (artifactId: string) => {
    const res = await Api.getWave5Artifact(artifactId);
    if (res?.artifact) {
      setSelected(res.artifact);
      setArtifacts((prev) =>
        prev.map((artifact) => (artifact.artifactId === artifactId ? res.artifact : artifact))
      );
    }
  };

  const createArtifact = async () => {
    if (!title.trim() || !content.trim()) {
      setMessage(t('aios.wave5ArtifactRuntimePanel.titleAndContentAreRequired'));
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await Api.createWave5Artifact({
        artifactType,
        title: title.trim(),
        content,
        metadata: { createdFrom: 'wave5_runtime_panel' },
      });
      if (res?.success === false) throw new Error(res?.error || 'Create failed');
      setSelected(res.artifact);
      setTitle('');
      setContent('');
      await load();
    } catch (err: any) {
      setMessage(err?.message || 'Failed to create artifact');
    } finally {
      setLoading(false);
    }
  };

  const proposeMutation = async () => {
    if (!selected || !proposedContent.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await Api.proposeWave5ArtifactMutation(selected.artifactId, {
        proposedContent,
        summary: 'Manual artifact update proposal',
        mutationType: 'content_update',
      });
      if (res?.success === false) throw new Error(res?.error || 'Mutation failed');
      if (res?.mutation) {
        setSelected((prev) =>
          prev && prev.artifactId === selected.artifactId
            ? {
                ...prev,
                status: 'proposed',
                mutations: [
                  res.mutation,
                  ...(prev.mutations || []).filter(
                    (mutation) => mutation.mutationId !== res.mutation.mutationId
                  ),
                ],
              }
            : prev
        );
      }
      setProposedContent('');
      await refreshSelected(selected.artifactId);
    } catch (err: any) {
      setMessage(err?.message || 'Failed to propose mutation');
    } finally {
      setLoading(false);
    }
  };

  const approveMutation = async (mutationId: string) => {
    if (!selected) return;
    await Api.approveWave5ArtifactMutation(mutationId);
    await refreshSelected(selected.artifactId);
  };

  const commitMutation = async (mutationId: string) => {
    if (!selected) return;
    await Api.commitWave5ArtifactMutation(mutationId);
    await refreshSelected(selected.artifactId);
  };

  const rejectMutation = async (mutationId: string) => {
    if (!selected) return;
    await Api.rejectWave5ArtifactMutation(mutationId);
    await refreshSelected(selected.artifactId);
  };

  const runTemplateFill = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const fields = JSON.parse(fieldsJson || '{}') as Record<string, unknown>;
      const res = await Api.fillWave5DocumentTemplate({
        artifactId: selected?.artifactId || null,
        artifactType,
        title: title || 'Filled business document',
        template,
        fields,
      });
      if (res?.needsInput) {
        setMessage(`Missing fields: ${(res.missingFields || []).join(', ')}`);
      } else if (res?.artifact) {
        setSelected(res.artifact);
        await load();
      } else if (res?.mutation && selected) {
        await refreshSelected(selected.artifactId);
      }
    } catch (err: any) {
      setMessage(err?.message || 'Template fill failed');
    } finally {
      setLoading(false);
    }
  };

  const generateStructuredArtifact = async () => {
    if (!generationPrompt.trim()) {
      setMessage(t('aios.wave5ArtifactRuntimePanel.generationPromptIsRequired'));
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await Api.generateWave5StructuredArtifact({
        outputKind: generationKind,
        prompt: generationPrompt.trim(),
        title: title || undefined,
      });
      if (res?.success === false) throw new Error(res?.error || 'Generation failed');
      if (res?.artifact) setSelected(res.artifact);
      setGenerationPrompt('');
      await load();
    } catch (err: any) {
      setMessage(err?.message || 'Structured artifact generation failed');
    } finally {
      setLoading(false);
    }
  };

  const exportManifest = async () => {
    if (!selected) return;
    const res = await Api.getWave5ArtifactExportManifest(selected.artifactId);
    if (res?.manifest) {
      setMessage(JSON.stringify(res.manifest, null, 2));
    }
  };

  if (loadError) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[320px] text-center space-y-3">
        <FileText size={32} className="text-slate-400 dark:text-slate-600" />
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {t('aios.wave5ArtifactRuntimePanel.artifactsUnavailable')}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
          {isPolish ? (
            <>
              Środowisko uruchomieniowe artefaktów wymaga ustawienia{' '}
              <code className="font-mono">ENABLE_V8_GLOBAL=true</code> na serwerze. Skontaktuj się z
              administratorem, aby włączyć tę funkcję.
            </>
          ) : (
            <>
              The Artifacts runtime requires{' '}
              <code className="font-mono">ENABLE_V8_GLOBAL=true</code> on the server. Contact your
              administrator to enable this feature.
            </>
          )}
        </p>
        <pre className="mt-2 text-[10px] text-slate-400 dark:text-slate-600 whitespace-pre-wrap max-w-xs">
          {loadError}
        </pre>
        <button
          type="button"
          onClick={() => {
            setLoadError(null);
            load();
          }}
          className="mt-2 text-xs text-primary-600 dark:text-primary-400 hover:underline"
        >
          {t('aios.wave5ArtifactRuntimePanel.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-primary-600 dark:text-primary-300 font-semibold">
          Consultify AI OS
        </p>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
          {t('aios.wave5ArtifactRuntimePanel.wave5ArtifactRuntime')}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {t('aios.wave5ArtifactRuntimePanel.firstClassArtifactsWithMutationProposals')}
        </p>
      </div>

      {message && (
        <pre className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700 whitespace-pre-wrap dark:border-navy-700 dark:bg-navy-950 dark:text-slate-200">
          {message}
        </pre>
      )}

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="rounded-xl border border-slate-200 bg-white dark:border-navy-700 dark:bg-navy-900">
          <div className="border-b border-slate-200 p-4 dark:border-navy-700">
            <h2 className="font-semibold text-slate-900 dark:text-white">
              {t('aios.wave5ArtifactRuntimePanel.generateOutput')}
            </h2>
            <p className="text-xs text-slate-500">
              {t('aios.wave5ArtifactRuntimePanel.createReportDeckOrTableAs')}
            </p>
            <div className="mt-3 space-y-2">
              <select
                value={generationKind}
                onChange={(event) => setGenerationKind(event.target.value as typeof generationKind)}
                className="w-full rounded-md border px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
              >
                <option value="executive_report">
                  {t('aios.wave5ArtifactRuntimePanel.executiveReport')}
                </option>
                <option value="board_deck">{t('aios.wave5ArtifactRuntimePanel.boardDeck')}</option>
                <option value="kpi_table">{t('aios.wave5ArtifactRuntimePanel.kpiTable')}</option>
              </select>
              <textarea
                value={generationPrompt}
                onChange={(event) => setGenerationPrompt(event.target.value)}
                placeholder={t('aios.wave5ArtifactRuntimePanel.describeTheArtifactToGenerate')}
                rows={4}
                className="w-full rounded-md border px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
              />
              <button
                type="button"
                onClick={generateStructuredArtifact}
                disabled={loading || !generationPrompt.trim()}
                className="rounded-md bg-sky-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
              >
                {t('aios.wave5ArtifactRuntimePanel.generateArtifact')}
              </button>
            </div>
          </div>

          <div className="border-b border-slate-200 p-4 dark:border-navy-700">
            <h2 className="font-semibold text-slate-900 dark:text-white">
              {t('aios.wave5ArtifactRuntimePanel.createArtifact')}
            </h2>
            <div className="mt-3 space-y-2">
              <select
                value={artifactType}
                onChange={(event) => setArtifactType(event.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
              >
                {artifactTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t('aios.wave5ArtifactRuntimePanel.artifactTitle')}
                className="w-full rounded-md border px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
              />
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder={t('aios.wave5ArtifactRuntimePanel.artifactContent')}
                rows={5}
                className="w-full rounded-md border px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
              />
              <button
                type="button"
                onClick={createArtifact}
                disabled={loading}
                className="rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-navy-950"
              >
                {t('aios.wave5ArtifactRuntimePanel.createDraftArtifact')}
              </button>
            </div>
          </div>

          <div className="border-b border-slate-200 p-4 dark:border-navy-700">
            <h2 className="font-semibold text-slate-900 dark:text-white">
              {t('aios.wave5ArtifactRuntimePanel.documentFilling')}
            </h2>
            <p className="text-xs text-slate-500">
              {t('aios.wave5ArtifactRuntimePanel.missingFieldsReturnQuestionsNotGuesses')}
            </p>
            <div className="mt-3 space-y-2">
              <textarea
                value={template}
                onChange={(event) => setTemplate(event.target.value)}
                rows={3}
                className="w-full rounded-md border px-3 py-2 text-xs dark:border-navy-700 dark:bg-navy-950"
              />
              <textarea
                value={fieldsJson}
                onChange={(event) => setFieldsJson(event.target.value)}
                rows={5}
                className="w-full rounded-md border px-3 py-2 text-xs dark:border-navy-700 dark:bg-navy-950"
              />
              <button
                type="button"
                onClick={runTemplateFill}
                className="rounded-md border px-3 py-2 text-xs"
              >
                {t('aios.wave5ArtifactRuntimePanel.fillTemplate')}
              </button>
            </div>
          </div>

          <div className="p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 dark:text-white">
                {t('aios.wave5ArtifactRuntimePanel.artifacts')}
              </h2>
              <button type="button" onClick={load} className="rounded-md border px-2 py-1 text-xs">
                <RefreshCw size={12} className="inline mr-1" />
                {t('aios.wave5ArtifactRuntimePanel.refresh')}
              </button>
            </div>
            <div className="mt-3 divide-y divide-slate-200 dark:divide-navy-800">
              {artifacts.length === 0 ? (
                <p className="py-3 text-sm text-slate-500">
                  {t('aios.wave5ArtifactRuntimePanel.noWave5ArtifactsYet')}
                </p>
              ) : (
                artifacts.map((artifact) => (
                  <button
                    key={artifact.artifactId}
                    type="button"
                    onClick={() => setSelected(artifact)}
                    className="w-full py-3 text-left"
                  >
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <FileText size={14} />
                      {artifact.title}
                    </div>
                    <div className="text-xs text-slate-500">
                      {artifact.artifactType} · v{artifact.version} · {artifact.status}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-900">
          {!selected ? (
            <p className="text-sm text-slate-500">
              {t('aios.wave5ArtifactRuntimePanel.selectOrCreateAnArtifact')}
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {selected.title}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {selected.artifactType} · {selected.status} ·{' '}
                    {t('aios.wave5ArtifactRuntimePanel.version')} {selected.version}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={exportManifest}
                  className="rounded-md border px-3 py-1.5 text-xs"
                >
                  {t('aios.wave5ArtifactRuntimePanel.exportManifest')}
                </button>
              </div>

              <pre className="max-h-72 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700 whitespace-pre-wrap dark:bg-navy-950 dark:text-slate-200">
                {selected.content}
              </pre>

              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {t('aios.wave5ArtifactRuntimePanel.proposeMutation')}
                </h3>
                <textarea
                  value={proposedContent}
                  onChange={(event) => setProposedContent(event.target.value)}
                  placeholder={t('aios.wave5ArtifactRuntimePanel.newArtifactContentThisCreatesA')}
                  rows={5}
                  className="mt-2 w-full rounded-md border px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
                />
                <button
                  type="button"
                  onClick={proposeMutation}
                  disabled={loading || !proposedContent.trim()}
                  className="mt-2 rounded-md bg-sky-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                >
                  {t('aios.wave5ArtifactRuntimePanel.createMutationProposal')}
                </button>
              </div>

              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <GitBranch size={14} />
                  {t('aios.wave5ArtifactRuntimePanel.mutationProposals')}
                </h3>
                <div className="mt-2 space-y-3">
                  {(selected.mutations || []).length === 0 ? (
                    <p className="text-sm text-slate-500">
                      {t('aios.wave5ArtifactRuntimePanel.noMutationsYet')}
                    </p>
                  ) : (
                    (selected.mutations || []).map((mutation) => (
                      <div
                        key={mutation.mutationId}
                        className="rounded-lg border p-3 text-xs dark:border-navy-700"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="font-medium">
                              {mutation.summary || mutation.mutationId}
                            </div>
                            <div className="text-slate-500">{mutation.status}</div>
                          </div>
                          {mutation.status === 'proposed' && (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => approveMutation(mutation.mutationId)}
                                className="rounded-md bg-emerald-600 px-2 py-1 text-white"
                              >
                                <Check size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => rejectMutation(mutation.mutationId)}
                                className="rounded-md border px-2 py-1"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          )}
                          {mutation.status === 'approved' && (
                            <button
                              type="button"
                              onClick={() => commitMutation(mutation.mutationId)}
                              className="rounded-md bg-sky-600 px-2 py-1 text-white"
                            >
                              {t('aios.wave5ArtifactRuntimePanel.commit')}
                            </button>
                          )}
                        </div>
                        <div className="mt-2 max-h-40 overflow-auto rounded bg-slate-50 p-2 dark:bg-navy-950">
                          {(mutation.diff || [])
                            .filter((line) => line.type !== 'unchanged')
                            .slice(0, 30)
                            .map((line) => (
                              <div key={`${mutation.mutationId}-${line.line}`}>
                                <span className="mr-2 text-slate-600">{line.line}</span>
                                <span>{line.type}</span>
                                {line.before && (
                                  <div className="text-danger-600">- {line.before}</div>
                                )}
                                {line.after && (
                                  <div className="text-emerald-600">+ {line.after}</div>
                                )}
                              </div>
                            ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {t('aios.wave5ArtifactRuntimePanel.versionLineage')}
                </h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(selected.versions || []).map((version) => (
                    <span key={version.version} className="rounded-full border px-2 py-1 text-xs">
                      v{version.version}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {t('aios.wave5ArtifactRuntimePanel.provenanceFooter')}
                </h3>
                <pre className="mt-2 max-h-44 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700 whitespace-pre-wrap dark:bg-navy-950 dark:text-slate-200">
                  {JSON.stringify(selected.provenance || {}, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Wave5ArtifactRuntimePanel;
