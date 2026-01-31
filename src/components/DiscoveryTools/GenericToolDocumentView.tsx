import { Loader2 } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { MarkdownRenderer } from '@/components/AIChat/Artifacts/renderers/MarkdownRenderer';
import { Api } from '@/services/api';
import { hasStrategyToolDoc, loadStrategyToolDocMarkdown } from '@/toolCatalog/strategy/catalog';

type GenericToolDocumentViewProps = {
  sessionId: string;
  toolTypeLabel?: string;
  title?: string;
  statusLabel?: string;
  onBack: () => void;
};

export const GenericToolDocumentView: React.FC<GenericToolDocumentViewProps> = ({
  sessionId,
  toolTypeLabel,
  title,
  statusLabel,
  onBack,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [catalogMarkdown, setCatalogMarkdown] = useState<string | null>(null);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await Api.getToolSession(sessionId);
        if (!mounted) return;
        setSession(data);
      } catch (e: any) {
        if (!mounted) return;
        setError(String(e?.message || 'Failed to load tool session'));
      } finally {
        if (!mounted) return;
        setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [sessionId]);

  const toolSlug = useMemo(() => {
    const raw = session?.toolType || session?.tool_type || '';
    return String(raw).trim().toLowerCase();
  }, [session?.toolType, session?.tool_type]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!toolSlug || !hasStrategyToolDoc(toolSlug)) {
        setCatalogMarkdown(null);
        return;
      }
      setIsCatalogLoading(true);
      try {
        const md = await loadStrategyToolDocMarkdown(toolSlug);
        if (!mounted) return;
        setCatalogMarkdown(md);
      } catch {
        if (!mounted) return;
        setCatalogMarkdown(null);
      } finally {
        if (!mounted) return;
        setIsCatalogLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [toolSlug]);

  const computedTitle = useMemo(() => {
    return title || session?.name || 'Tool session';
  }, [title, session?.name]);

  const computedType = useMemo(() => {
    return toolTypeLabel || session?.toolType || session?.tool_type || 'Unknown';
  }, [toolTypeLabel, session?.toolType, session?.tool_type]);

  const computedStatus = useMemo(() => {
    return statusLabel || session?.status || 'DRAFT';
  }, [statusLabel, session?.status]);

  const copyJson = async (payload: any) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload ?? {}, null, 2));
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span>Loading tool session...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        <div className="text-center max-w-xl">
          <p className="text-lg text-white/80">{computedTitle}</p>
          <p className="text-sm text-slate-400 mt-2">{error}</p>
          <button
            onClick={onBack}
            className="mt-4 px-4 py-2 bg-navy-700 hover:bg-navy-600 text-white rounded-lg text-sm transition-colors"
          >
            Back to List
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 max-w-[1400px] mx-auto">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="min-w-0">
            <button
              onClick={onBack}
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              ← Back to List
            </button>
            <div className="mt-3">
              <div className="text-xs text-slate-500">
                {computedType} · {computedStatus}
              </div>
              <h1 className="text-2xl font-semibold text-white mt-1 truncate">{computedTitle}</h1>
            </div>
          </div>

          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => copyJson(session)}
              className="px-3 py-2 bg-navy-800 hover:bg-navy-700 text-white rounded-lg text-sm border border-navy-700 transition-colors"
            >
              Copy JSON
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: content */}
          <div className="lg:col-span-2 space-y-6">
            {isCatalogLoading && (
              <div className="bg-navy-900 rounded-xl border border-navy-700 p-5">
                <div className="flex items-center gap-3 text-slate-300">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Loading tool documentation...</span>
                </div>
              </div>
            )}

            {catalogMarkdown && (
              <div className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-navy-700/60 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200/60 dark:border-navy-700/60">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    Tool documentation (catalog)
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Source: wdrozenia/modules/tools/catalog/strategy/{toolSlug}.md
                  </div>
                </div>
                <MarkdownRenderer content={catalogMarkdown} className="p-0" />
              </div>
            )}

            <div className="bg-navy-900 rounded-xl border border-navy-700 p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-white">Context Snapshot</h3>
                <button
                  onClick={() => copyJson(session?.contextSnapshot)}
                  className="text-xs text-slate-400 hover:text-white transition-colors"
                >
                  Copy
                </button>
              </div>
              <pre className="mt-3 text-xs text-slate-300 whitespace-pre-wrap break-words">
                {JSON.stringify(session?.contextSnapshot ?? {}, null, 2)}
              </pre>
            </div>

            <div className="bg-navy-900 rounded-xl border border-navy-700 p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-white">Answers / Data</h3>
                <button
                  onClick={() => copyJson(session?.answers)}
                  className="text-xs text-slate-400 hover:text-white transition-colors"
                >
                  Copy
                </button>
              </div>
              <pre className="mt-3 text-xs text-slate-300 whitespace-pre-wrap break-words">
                {JSON.stringify(session?.answers ?? {}, null, 2)}
              </pre>
            </div>
          </div>

          {/* RIGHT: control */}
          <div className="space-y-6">
            <div className="bg-navy-900 rounded-xl border border-navy-700 p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Session Info</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-400">ID</span>
                  <span className="text-slate-200 font-mono text-xs">{session?.id}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-400">Tool Type</span>
                  <span className="text-slate-200">{session?.toolType || computedType}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-400">Status</span>
                  <span className="text-slate-200">{session?.status || computedStatus}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-400">Project</span>
                  <span className="text-slate-200 font-mono text-xs">
                    {session?.projectId || '—'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-navy-900 rounded-xl border border-navy-700 p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Why you saw the placeholder</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                This session uses a tool type that doesn’t have a dedicated UI yet. Instead of
                blocking you, this generic view shows the full session payload so you can work with
                it now.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GenericToolDocumentView;
