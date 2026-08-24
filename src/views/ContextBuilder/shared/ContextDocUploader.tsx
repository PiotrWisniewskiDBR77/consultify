import { AlertCircle, CheckCircle, FileText, Info, Loader2, UploadCloud } from 'lucide-react';
import React, { useRef, useState } from 'react';

import { Api } from '../../../services/api';

interface ContextDocUploaderProps {
  tabName: string;
  suggestions: string[];
}

export const ContextDocUploader: React.FC<ContextDocUploaderProps> = ({ tabName, suggestions }) => {
  const [showHints, setShowHints] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus('idle');

    try {
      await Api.uploadDocument(file, { tabName, type: 'context_support' });
      setUploadStatus('success');
      setStatusMessage(`Przetworzono ${file.name}`);
      // Reset after 3s
      setTimeout(() => {
        setUploadStatus('idle');
        setStatusMessage('');
      }, 3000);
    } catch (error: any) {
      setUploadStatus('error');
      setStatusMessage(error instanceof Error ? error.message : 'Wgrywanie nie powiodło się');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-slate-50 dark:bg-navy-900/50 border border-slate-200 dark:border-navy-700 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6 transition-all hover:border-c-border-strong">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".pdf,.docx,.txt"
        onChange={handleFileSelect}
      />

      <div
        className={`p-2 rounded-lg border shadow-sm shrink-0 transition-colors ${
          uploadStatus === 'success'
            ? 'bg-green-100 border-green-200 text-green-600'
            : uploadStatus === 'error'
              ? 'bg-danger-100 border-danger-200 text-danger-600'
              : 'bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 text-c-text-secondary'
        }`}
      >
        {isUploading ? (
          <Loader2 size={20} className="animate-spin" />
        ) : uploadStatus === 'success' ? (
          <CheckCircle size={20} />
        ) : uploadStatus === 'error' ? (
          <AlertCircle size={20} />
        ) : (
          <FileText size={20} />
        )}
      </div>

      <div className="flex-1">
        <h4 className="text-sm font-bold text-navy-900 dark:text-white flex items-center gap-2">
          Dokumenty pomocnicze
          <span className="text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-500 font-medium bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-full">
            Dla: {tabName}
          </span>
        </h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {uploadStatus === 'success' ? (
            <span className="text-green-600 font-medium">Przetworzono: {statusMessage}</span>
          ) : uploadStatus === 'error' ? (
            <span className="text-danger-600 font-medium">Błąd: {statusMessage}</span>
          ) : (
            <>
              Wgraj pliki, które pomogą AI lepiej zrozumieć kontekst.
              <button
                onClick={() => setShowHints(!showHints)}
                className="ml-2 text-c-text font-medium inline-flex items-center gap-1 transition-colors hover:text-c-text-secondary group"
              >
                Co warto wgrać?
                <Info size={12} className="group-hover:scale-110 transition-transform" />
              </button>
            </>
          )}
        </p>

        {/* Animated Hints */}
        <div
          className={`grid transition-all duration-300 ease-in-out ${showHints && uploadStatus === 'idle' ? 'grid-rows-[1fr] opacity-100 mt-3' : 'grid-rows-[0fr] opacity-0'}`}
        >
          <div className="overflow-hidden">
            <div className="rounded-lg border border-c-border-subtle bg-c-surface-raised p-3">
              <p className="text-[10px] font-bold text-c-text-muted uppercase mb-2">
                Rekomendowane dla: {tabName}
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <span
                    key={s}
                    className="rounded border border-c-border-subtle bg-c-surface px-2 py-1 text-xs text-c-text-secondary"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="px-4 py-2 bg-white dark:bg-navy-800 hover:bg-slate-50 dark:hover:bg-navy-700 text-navy-900 dark:text-white text-xs font-bold border border-slate-200 dark:border-navy-700 rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-2 shrink-0 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isUploading ? (
          'Przetwarzanie…'
        ) : (
          <>
            <UploadCloud size={14} className="text-c-text-muted" />
            Wgraj dokument
          </>
        )}
      </button>
    </div>
  );
};
