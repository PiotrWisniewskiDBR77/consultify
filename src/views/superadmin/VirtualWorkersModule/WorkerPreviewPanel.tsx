import { Eye, Globe, RefreshCw, Sparkles } from 'lucide-react';
import React, { useState } from 'react';

import { Api } from '../../../services/api';

interface WorkerPreviewPanelProps {
  workerId: string;
  workerSlug: string;
  localeDefault: string;
}

interface PreviewPayload {
  answer: string;
  model: {
    id: string;
    provider: string;
  };
  responseMode: string;
  knowledgeSources: string[];
  matchedProducts: string[];
  primaryProducts: string[];
  usedPillSections: string[];
  webUsed: boolean;
  webCitations: Array<{
    id: string;
    title: string;
    link: string;
    excerpt: string;
  }>;
  fallbackReason: string | null;
  knowledgeContextPreview: string;
}

const DEFAULT_PROMPTS: Record<string, string> = {
  anna: 'Jak w 2-3 zdaniach opiszesz wartość produktu i najbliższy sensowny next step dla klienta?',
  teresa: 'Pomóż mi zrozumieć, jak ten worker powinien prowadzić użytkownika przez najbliższy krok w aplikacji.',
};

export const WorkerPreviewPanel: React.FC<WorkerPreviewPanelProps> = ({
  workerId,
  workerSlug,
  localeDefault,
}) => {
  const [message, setMessage] = useState(
    DEFAULT_PROMPTS[workerSlug] || 'Jak ten worker powinien odpowiedzieć na typowe pytanie użytkownika?'
  );
  const [locale, setLocale] = useState(localeDefault || 'pl');
  const [webSearch, setWebSearch] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await Api.post(`/api/virtual-workers/${workerId}/preview`, {
        message,
        locale,
        userEnabledWebSearch: webSearch,
      });
      const payload = response?.data?.data ?? response?.data;
      setPreview(payload || null);
    } catch (err: any) {
      setPreview(null);
      setError(err?.response?.data?.error || 'Failed to generate worker preview.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Preview Sandbox</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Generate a real operator preview using the active worker profile, governed knowledge,
              and optional governed web search.
            </p>
          </div>
          <button
            onClick={handlePreview}
            disabled={loading || !message.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
          >
            {loading ? <RefreshCw size={16} className="animate-spin" /> : <Eye size={16} />}
            {loading ? 'Previewing...' : 'Run Preview'}
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Test message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className="w-full px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-900 text-slate-900 dark:text-white text-sm resize-y"
            />
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="w-full md:w-48">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Locale
              </label>
              <input
                type="text"
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-900 text-slate-900 dark:text-white text-sm"
              />
            </div>
            <label className="inline-flex items-center gap-2 mt-6 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={webSearch}
                onChange={(e) => setWebSearch(e.target.checked)}
              />
              Force governed web search
            </label>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
          {error}
        </div>
      )}

      {preview && (
        <>
          <section className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Preview Answer
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Mode: {preview.responseMode} · Model: {preview.model.provider}/{preview.model.id}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                {preview.webUsed && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs font-medium">
                    <Globe size={12} />
                    web used
                  </span>
                )}
                {preview.fallbackReason && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-xs font-medium">
                    <Sparkles size={12} />
                    fallback: {preview.fallbackReason}
                  </span>
                )}
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 px-4 py-4 text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
              {preview.answer}
            </div>
          </section>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <section className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                Runtime Signals
              </h4>
              <div className="space-y-2 text-sm">
                <p className="text-slate-700 dark:text-slate-300">
                  <strong>Primary products:</strong>{' '}
                  {preview.primaryProducts.length > 0 ? preview.primaryProducts.join(', ') : '—'}
                </p>
                <p className="text-slate-700 dark:text-slate-300">
                  <strong>Matched products:</strong>{' '}
                  {preview.matchedProducts.length > 0 ? preview.matchedProducts.join(', ') : '—'}
                </p>
                <p className="text-slate-700 dark:text-slate-300">
                  <strong>Pill sections used:</strong>{' '}
                  {preview.usedPillSections.length > 0 ? preview.usedPillSections.join(', ') : '—'}
                </p>
              </div>

              <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mt-5 mb-2">
                Knowledge sources
              </h5>
              {preview.knowledgeSources.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">No explicit sources returned.</p>
              ) : (
                <div className="space-y-2">
                  {preview.knowledgeSources.map((source) => (
                    <div
                      key={source}
                      className="rounded-lg bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 px-3 py-2 text-xs text-slate-600 dark:text-slate-300 break-all"
                    >
                      {source}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                Web Citations
              </h4>
              {preview.webCitations.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No web citations were used in this preview.
                </p>
              ) : (
                <div className="space-y-3">
                  {preview.webCitations.map((citation) => (
                    <div
                      key={citation.id}
                      className="rounded-lg bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 px-4 py-3"
                    >
                      <a
                        href={citation.link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        {citation.title}
                      </a>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 break-all">
                        {citation.link}
                      </p>
                      <p className="text-sm text-slate-700 dark:text-slate-300 mt-2">
                        {citation.excerpt}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
              Injected Knowledge Context
            </h4>
            <pre className="whitespace-pre-wrap text-xs text-slate-700 dark:text-slate-300 rounded-lg bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 px-4 py-4 overflow-auto max-h-[420px]">
              {preview.knowledgeContextPreview}
            </pre>
          </section>
        </>
      )}
    </div>
  );
};

export default WorkerPreviewPanel;
