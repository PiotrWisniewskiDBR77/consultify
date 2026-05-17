/**
 * DocumentToMap — Upload a document (text/PDF) and AI extracts key ideas as nodes.
 */
import { FileText, Loader2, Sparkles, Upload, X } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

interface DocumentToMapProps {
  open: boolean;
  onClose: () => void;
  ideaId: string;
  ideaTitle: string;
  locked: boolean;
  onAddNodes: (labels: string[], branchKey?: string) => void;
}

export const DocumentToMap: React.FC<DocumentToMapProps> = ({
  open,
  onClose,
  ideaId,
  ideaTitle,
  locked,
  onAddNodes,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [text, setText] = useState('');
  const [extractedIdeas, setExtractedIdeas] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          setText(String(ev.target?.result || ''));
        };
        reader.readAsText(file);
      } else {
        toast.error(isPl ? 'Obsługiwane formaty: .txt, .md' : 'Supported formats: .txt, .md');
      }
    },
    [isPl]
  );

  const extractIdeas = useCallback(async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const res = await Api.getMyIdeaAISuggestions(ideaId, {
        seedText: `Extract key ideas from this document for the idea "${ideaTitle}": ${text.slice(0, 3000)}`,
        mapNodes: [],
        activeTool: 'mindmap',
        language: i18n.language,
      });

      if (res?.suggestions && Array.isArray(res.suggestions)) {
        setExtractedIdeas(res.suggestions.map((s: any) => s.text).filter(Boolean));
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to extract ideas');
    } finally {
      setLoading(false);
    }
  }, [i18n.language, ideaId, ideaTitle, text]);

  const handleApply = useCallback(() => {
    if (extractedIdeas.length === 0) return;
    onAddNodes(extractedIdeas);
    toast.success(
      isPl
        ? `Dodano ${extractedIdeas.length} pomysłów z dokumentu`
        : `Added ${extractedIdeas.length} ideas from document`,
      { duration: 1500 }
    );
    setText('');
    setExtractedIdeas([]);
    onClose();
  }, [extractedIdeas, isPl, onAddNodes, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-lg rounded-2xl bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200/60 dark:border-navy-700/60">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-blue-500" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">
              {isPl ? 'Dokument → Mapa' : 'Document → Map'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4">
          {/* File upload */}
          <label className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-slate-300/60 dark:border-navy-600/60 hover:border-blue-400/60 transition-colors cursor-pointer mb-3">
            <Upload size={16} className="text-slate-400" />
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {isPl ? 'Załaduj plik .txt lub .md' : 'Upload .txt or .md file'}
            </span>
            <input type="file" accept=".txt,.md" onChange={handleFileUpload} className="hidden" />
          </label>

          {/* Text input */}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder={
              isPl ? 'Lub wklej tekst dokumentu tutaj...' : 'Or paste document text here...'
            }
            className="w-full px-3 py-2 rounded-xl border border-slate-200/60 dark:border-navy-700/60 bg-white/50 dark:bg-navy-950/30 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400/60 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none mb-3"
          />

          {/* Extract button */}
          <button
            onClick={extractIdeas}
            disabled={!text.trim() || loading || locked}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500/15 to-blue-500/10 text-[11px] font-bold text-blue-700 dark:text-blue-300 hover:from-blue-500/25 hover:to-blue-500/15 transition-all disabled:opacity-40 mb-3"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {loading
              ? isPl
                ? 'Ekstrakcja...'
                : 'Extracting...'
              : isPl
                ? 'Wyodrębnij pomysły z AI'
                : 'Extract ideas with AI'}
          </button>

          {/* Extracted ideas */}
          {extractedIdeas.length > 0 && (
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400 mb-1.5">
                {isPl ? 'Wyodrębnione pomysły' : 'Extracted ideas'} ({extractedIdeas.length})
              </div>
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {extractedIdeas.map((idea, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2 rounded-xl bg-blue-500/5 border border-blue-400/10"
                  >
                    <Sparkles size={10} className="text-blue-500 shrink-0" />
                    <span className="text-[11px] text-slate-700 dark:text-slate-200">{idea}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-200/60 dark:border-navy-700/60 flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300/60 dark:border-navy-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
          >
            {isPl ? 'Anuluj' : 'Cancel'}
          </button>
          <button
            onClick={handleApply}
            disabled={extractedIdeas.length === 0 || locked}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-blue-500/15 to-blue-500/10 text-blue-700 dark:text-blue-300 hover:from-blue-500/25 hover:to-blue-500/15 border border-blue-500/10 transition-all disabled:opacity-40"
          >
            <FileText size={12} />
            {isPl
              ? `Dodaj ${extractedIdeas.length} pomysłów`
              : `Add ${extractedIdeas.length} ideas`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentToMap;
