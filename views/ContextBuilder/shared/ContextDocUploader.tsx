import React, { useState, useRef } from 'react';
import { FileText, Info, UploadCloud, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
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
            setStatusMessage(`Accessed ${file.name}`);
            // Reset after 3s
            setTimeout(() => {
                setUploadStatus('idle');
                setStatusMessage('');
            }, 3000);
        } catch (error: unknown) {
            setUploadStatus('error');
            setStatusMessage(error instanceof Error ? error.message : 'Upload failed');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="bg-slate-50 dark:bg-navy-900/50 border border-slate-200 dark:border-white/5 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6 transition-all hover:border-purple-200 dark:hover:border-purple-500/30">
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".pdf,.docx,.txt"
                onChange={handleFileSelect}
            />

            <div className={`p-2 rounded-lg border shadow-sm shrink-0 transition-colors ${uploadStatus === 'success' ? 'bg-green-100 border-green-200 text-green-600' :
                    uploadStatus === 'error' ? 'bg-red-100 border-red-200 text-red-600' :
                        'bg-white dark:bg-navy-800 border-slate-100 dark:border-white/5 text-purple-600'
                }`}>
                {isUploading ? <Loader2 size={20} className="animate-spin" /> :
                    uploadStatus === 'success' ? <CheckCircle size={20} /> :
                        uploadStatus === 'error' ? <AlertCircle size={20} /> :
                            <FileText size={20} />
                }
            </div>

            <div className="flex-1">
                <h4 className="text-sm font-bold text-navy-900 dark:text-white flex items-center gap-2">
                    Supporting Documents
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-full">For {tabName}</span>
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                    {uploadStatus === 'success' ? <span className="text-green-600 font-medium">Successfully processed: {statusMessage}</span> :
                        uploadStatus === 'error' ? <span className="text-red-600 font-medium">Error: {statusMessage}</span> :
                            <>Upload relevant files to help AI understand your context better.
                                <button
                                    onClick={() => setShowHints(!showHints)}
                                    className="ml-2 text-purple-600 hover:text-purple-700 font-medium inline-flex items-center gap-1 transition-colors group"
                                >
                                    What should I upload?
                                    <Info size={12} className="group-hover:scale-110 transition-transform" />
                                </button>
                            </>
                    }
                </p>

                {/* Animated Hints */}
                <div className={`grid transition-all duration-300 ease-in-out ${showHints && uploadStatus === 'idle' ? 'grid-rows-[1fr] opacity-100 mt-3' : 'grid-rows-[0fr] opacity-0'}`}>
                    <div className="overflow-hidden">
                        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-500/10 rounded-lg p-3">
                            <p className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase mb-2">Recommended for {tabName}:</p>
                            <div className="flex flex-wrap gap-2">
                                {suggestions.map(s => (
                                    <span key={s} className="px-2 py-1 bg-white dark:bg-navy-900 border border-purple-100 dark:border-purple-500/20 rounded text-xs text-purple-600 dark:text-purple-300">
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
                className="px-4 py-2 bg-white dark:bg-navy-800 hover:bg-slate-50 dark:hover:bg-navy-700 text-navy-900 dark:text-white text-xs font-bold border border-slate-200 dark:border-white/10 rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-2 shrink-0 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isUploading ? 'Processing...' : (
                    <>
                        <UploadCloud size={14} className="text-purple-500" />
                        Upload Document
                    </>
                )}
            </button>
        </div>
    );
};
