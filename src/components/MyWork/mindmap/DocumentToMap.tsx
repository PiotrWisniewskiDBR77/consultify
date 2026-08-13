/**
 * DocumentToMap — Upload a document (text/PDF) and AI extracts key ideas as nodes.
 */
import { FileText, Loader2, Sparkles, Upload, X } from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';

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
  const { t, i18n } = useTranslation();

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
        toast.error(t('ideas.mindmap.supportedFormatsTxtMd', 'Supported formats: .txt, .md'));
      }
    },
    [t]
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
      t('myWorkMindmap.documentToMap.addedIdeas', 'Added {{count}} ideas from document', {
        count: extractedIdeas.length,
      }),
      { duration: 1500 }
    );
    setText('');
    setExtractedIdeas([]);
    onClose();
  }, [extractedIdeas, t, onAddNodes, onClose]);

  const containerRef = useRef<HTMLDivElement>(null);
  useDialogA11y({ open, onClose, containerRef });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-c-bg">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-to-map-modal-heading"
        tabIndex={-1}
        className="w-full max-w-lg rounded-2xl bg-c-surface-raised dark:bg-c-surface backdrop-blur-xl shadow-2xl overflow-hidden outline-none"
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-c-border-subtle dark:border-c-border-subtle">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-c-info" />
            <h3 className="text-sm font-bold text-c-text dark:text-c-text" id="document-to-map-modal-heading">
              {t('ideas.mindmap.documentMap', 'Document → Map')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-c-text-secondary hover:text-c-text-secondary dark:hover:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4">
          {/* File upload */}
          <label className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-c-border-subtle dark:border-c-border-subtle hover:border-c-info transition-colors cursor-pointer mb-3">
            <Upload size={16} className="text-c-text-secondary" />
            <span className="text-[11px] text-c-text-secondary dark:text-c-text-muted">
              {t('ideas.mindmap.uploadTxtMdFile', 'Upload .txt or .md file')}
            </span>
            <input type="file" accept=".txt,.md" onChange={handleFileUpload} className="hidden" />
          </label>

          {/* Text input */}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder={t('ideas.mindmap.pasteDocumentTextHere', 'Or paste document text here...')}
            className="w-full px-3 py-2 rounded-xl border border-c-border-subtle dark:border-c-border-subtle bg-c-surface-raised dark:bg-c-surface text-xs text-c-text dark:text-c-text placeholder:text-c-text-muted focus:outline-none focus:ring-2 focus:ring-c-info resize-none mb-3"
          />

          {/* Extract button */}
          <button
            onClick={extractIdeas}
            disabled={!text.trim() || loading || locked}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-c-surface-raised text-[11px] font-bold text-c-info dark:text-c-info transition-all disabled:opacity-40 mb-3"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {loading
              ? t('ideas.mindmap.extracting', 'Extracting...')
              : t('ideas.mindmap.extractIdeasAi', 'Extract ideas with AI')}
          </button>

          {/* Extracted ideas */}
          {extractedIdeas.length > 0 && (
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-c-text-secondary mb-1.5">
                {t('ideas.mindmap.extractedIdeas', 'Extracted ideas')} ({extractedIdeas.length})
              </div>
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {extractedIdeas.map((idea, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2 rounded-xl bg-c-surface-raised border border-c-info"
                  >
                    <Sparkles size={10} className="text-c-info shrink-0" />
                    <span className="text-[11px] text-c-text-secondary dark:text-c-text">
                      {idea}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-c-border-subtle dark:border-c-border-subtle flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-c-border-subtle dark:border-c-border-subtle text-c-text-secondary dark:text-c-text-muted hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors"
          >
            {t('ideas.mindmap.cancel', 'Cancel')}
          </button>
          <button
            onClick={handleApply}
            disabled={extractedIdeas.length === 0 || locked}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-c-surface-raised text-c-info dark:text-c-info border border-c-info transition-all disabled:opacity-40"
          >
            <FileText size={12} />
            {t('myWorkMindmap.documentToMap.addIdeas', 'Add {{count}} ideas', {
              count: extractedIdeas.length,
            })}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentToMap;
