/**
 * Odbiór na żywo 05.09 (04-narzędzia, defekt 5): ten ekran był ANGIELSKIM
 * zrzutem surowego JSON-a i to on witał właściciela na 29 sesjach. Główna
 * przyczyna (sesje `MYWORK`) jest naprawiona osobnym ekranem
 * (MyWorkTraceDocumentView); ten widok zostaje jako ostatnia deska ratunku dla
 * typu, który naprawdę nie ma jeszcze warsztatu — ale mówi po polsku i prowadzi
 * treścią, a nie zrzutem danych. JSON zostaje, bo bywa jedynym sposobem odzyskania
 * pracy — tyle że zwinięty, opisany jako materiał dla wsparcia.
 */
import { Loader2 } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { MarkdownRenderer } from '@/components/AIChat/Artifacts/renderers/MarkdownRenderer';
import { LoadingState } from '@/components/ui/primitives';
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
        setError(String(e?.message || 'Nie udało się wczytać sesji narzędzia'));
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
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
        if (mounted) {
          setIsCatalogLoading(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [toolSlug]);

  const computedTitle = useMemo(() => {
    return title || session?.name || 'Sesja narzędzia';
  }, [title, session?.name]);

  const computedType = useMemo(() => {
    return toolTypeLabel || session?.toolType || session?.tool_type || 'Nieznany typ';
  }, [toolTypeLabel, session?.toolType, session?.tool_type]);

  const computedStatus = useMemo(() => {
    return statusLabel || session?.status || 'DRAFT';
  }, [statusLabel, session?.status]);

  const copyJson = async (payload: any) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload ?? {}, null, 2));
      toast.success('Skopiowano do schowka');
    } catch {
      toast.error('Nie udało się skopiować');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingState variant="spinner" label="Wczytywanie sesji narzędzia…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        <div className="text-center max-w-xl">
          <p className="text-lg text-slate-700 dark:text-white/80">{computedTitle}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{error}</p>
          <button
            onClick={onBack}
            className="mt-4 px-4 py-2 bg-slate-200 dark:bg-navy-700 hover:bg-slate-300 dark:hover:bg-navy-600 text-slate-900 dark:text-white rounded-lg text-sm transition-colors"
          >
            Wróć do listy
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
              className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              ← Wróć do listy
            </button>
            <div className="mt-3">
              <div className="text-xs text-slate-500">
                {computedType} · {computedStatus}
              </div>
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-white mt-1 truncate">
                {computedTitle}
              </h1>
            </div>
          </div>

          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => copyJson(session)}
              className="px-3 py-2 bg-slate-50 dark:bg-navy-800 hover:bg-slate-100 dark:hover:bg-navy-700 text-slate-900 dark:text-white rounded-lg text-sm border border-slate-200 dark:border-navy-700 transition-colors"
            >
              Kopiuj dane (JSON)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: content */}
          <div className="lg:col-span-2 space-y-6">
            {isCatalogLoading && (
              <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-5">
                <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Wczytywanie dokumentacji narzędzia…</span>
                </div>
              </div>
            )}

            {catalogMarkdown && (
              <div className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-navy-700/60 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 dark:border-navy-700/60">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    Dokumentacja narzędzia (katalog)
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Źródło: wdrozenia/modules/tools/catalog/strategy/{toolSlug}.md
                  </div>
                </div>
                <MarkdownRenderer content={catalogMarkdown} className="p-0" />
              </div>
            )}

            <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Kontekst sesji (dane techniczne)
                </h3>
                <button
                  onClick={() => copyJson(session?.contextSnapshot)}
                  className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  Kopiuj
                </button>
              </div>
              <pre className="mt-3 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">
                {JSON.stringify(session?.contextSnapshot ?? {}, null, 2)}
              </pre>
            </div>

            <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Odpowiedzi i dane sesji (dane techniczne)
                </h3>
                <button
                  onClick={() => copyJson(session?.answers)}
                  className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  Kopiuj
                </button>
              </div>
              <pre className="mt-3 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">
                {JSON.stringify(session?.answers ?? {}, null, 2)}
              </pre>
            </div>
          </div>

          {/* RIGHT: control */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                Informacje o sesji
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500 dark:text-slate-400">ID</span>
                  <span className="text-slate-700 dark:text-slate-200 font-mono text-xs">
                    {session?.id}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500 dark:text-slate-400">Typ narzędzia</span>
                  <span className="text-slate-700 dark:text-slate-200">
                    {session?.toolType || computedType}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500 dark:text-slate-400">Status</span>
                  <span className="text-slate-700 dark:text-slate-200">
                    {session?.status || computedStatus}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500 dark:text-slate-400">Projekt</span>
                  <span className="text-slate-700 dark:text-slate-200 font-mono text-xs">
                    {session?.projectId || '—'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                Dlaczego widzisz ten ekran
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Ta sesja korzysta z typu narzędzia, który nie ma jeszcze własnego warsztatu.
                Zamiast blokować, pokazujemy komplet danych sesji — dzięki temu nic nie ginie
                i można je skopiować albo przekazać dalej.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GenericToolDocumentView;
