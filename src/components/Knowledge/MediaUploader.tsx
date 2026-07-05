/**
 * MediaUploader Component
 *
 * Unified interface for uploading and processing various media types
 * into the AI knowledge base. Supports drag & drop, YouTube URLs,
 * and web URLs.
 *
 * Part of the Multimodal Content Ingestion System
 *
 * @version 1.0.0
 */

import {
  AlertCircle,
  CheckCircle,
  File,
  FileSpreadsheet,
  FileText,
  Globe,
  Image,
  Link2,
  Loader2,
  Music,
  Presentation,
  Upload,
  Video,
  X,
  Youtube,
} from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';

interface ProcessingResult {
  success: boolean;
  docId?: string;
  inputType?: string;
  metadata?: {
    type?: string;
    filename?: string;
    title?: string;
    characterCount?: number;
    wordCount?: number;
    processingTimeMs?: number;
  };
  error?: string;
}

interface MediaUploaderProps {
  onUploadComplete?: (result: ProcessingResult) => void;
  onError?: (error: string) => void;
  projectId?: string;
  language?: string;
  maxFiles?: number;
}

type TabType = 'upload' | 'youtube' | 'url';

const ACCEPTED_TYPES = {
  documents: '.pdf,.docx,.doc,.xlsx,.xls,.csv,.pptx,.txt,.md,.json',
  audio: '.mp3,.wav,.m4a,.webm,.ogg,.flac',
  video: '.mp4,.avi,.mov,.mkv,.wmv',
  images: '.png,.jpg,.jpeg,.gif,.webp,.bmp,.tiff,.tif',
};

const ALL_ACCEPTED = Object.values(ACCEPTED_TYPES).join(',');

export const MediaUploader: React.FC<MediaUploaderProps> = ({
  onUploadComplete,
  onError,
  projectId,
  language = 'pl',
  maxFiles = 10,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [webUrl, setWebUrl] = useState('');
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<ProcessingResult[]>([]);
  const [currentProgress, setCurrentProgress] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length + files.length > maxFiles) {
        onError?.(`Maximum ${maxFiles} files allowed`);
        return;
      }
      setFiles((prev) => [...prev, ...droppedFiles]);
    },
    [files, maxFiles, onError]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        const selectedFiles = Array.from(e.target.files);
        if (selectedFiles.length + files.length > maxFiles) {
          onError?.(`Maximum ${maxFiles} files allowed`);
          return;
        }
        setFiles((prev) => [...prev, ...selectedFiles]);
      }
    },
    [files, maxFiles, onError]
  );

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';

    if (['pdf', 'docx', 'doc', 'txt', 'md'].includes(ext)) return <FileText size={16} />;
    if (['xlsx', 'xls', 'csv'].includes(ext)) return <FileSpreadsheet size={16} />;
    if (['pptx'].includes(ext)) return <Presentation size={16} />;
    if (['mp3', 'wav', 'm4a', 'ogg', 'flac'].includes(ext)) return <Music size={16} />;
    if (['mp4', 'avi', 'mov', 'mkv', 'wmv', 'webm'].includes(ext)) return <Video size={16} />;
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tiff'].includes(ext))
      return <Image size={16} />;
    return <File size={16} />;
  };

  const processFiles = async () => {
    if (files.length === 0) return;

    setProcessing(true);
    setResults([]);

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));
      formData.append('language', language);
      if (projectId) formData.append('projectId', projectId);

      setCurrentProgress(`Processing ${files.length} file(s)...`);

      const response = await fetch('/api/media-ingestion/ingest/batch', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const data = await response.json();

      if (data.success) {
        setResults(data.results.map((r: ProcessingResult) => ({ ...r, success: true })));
        data.results.forEach((r: ProcessingResult) => onUploadComplete?.(r));

        if (data.errors?.length > 0) {
          data.errors.forEach((e: { filename: string; error: string }) => {
            setResults((prev) => [
              ...prev,
              { success: false, error: e.error, metadata: { filename: e.filename } },
            ]);
          });
        }
      } else {
        throw new Error(data.error);
      }

      setFiles([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      onError?.(message);
      setResults([{ success: false, error: message }]);
    } finally {
      setProcessing(false);
      setCurrentProgress('');
    }
  };

  const processYouTube = async () => {
    if (!youtubeUrl.trim()) return;

    setProcessing(true);
    setResults([]);

    try {
      setCurrentProgress('Fetching YouTube transcript...');

      const response = await fetch('/api/media-ingestion/ingest/youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: youtubeUrl,
          language,
          projectId,
        }),
        credentials: 'include',
      });

      const data = await response.json();

      if (data.success) {
        setResults([{ success: true, ...data }]);
        onUploadComplete?.(data);
        setYoutubeUrl('');
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'YouTube processing failed';
      onError?.(message);
      setResults([{ success: false, error: message }]);
    } finally {
      setProcessing(false);
      setCurrentProgress('');
    }
  };

  const processUrl = async () => {
    if (!webUrl.trim()) return;

    setProcessing(true);
    setResults([]);

    try {
      setCurrentProgress('Extracting content from URL...');

      const response = await fetch('/api/media-ingestion/ingest/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webUrl,
          projectId,
        }),
        credentials: 'include',
      });

      const data = await response.json();

      if (data.success) {
        setResults([{ success: true, ...data }]);
        onUploadComplete?.(data);
        setWebUrl('');
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'URL processing failed';
      onError?.(message);
      setResults([{ success: false, error: message }]);
    } finally {
      setProcessing(false);
      setCurrentProgress('');
    }
  };

  const isYouTubeUrl = (url: string) => {
    return /(?:youtube\.com|youtu\.be)/.test(url);
  };

  return (
    <div className="bg-c-surface rounded-xl border border-c-border overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-c-border">
        <button
          onClick={() => setActiveTab('upload')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors
                        ${
                          activeTab === 'upload'
                            ? 'bg-c-surface-raised text-c-success border-b-2 border-c-success'
                            : 'text-c-text-secondary dark:text-c-text-muted hover:text-c-text-muted hover:bg-c-surface-raised'
                        }`}
        >
          <Upload size={18} />
          File Upload
        </button>
        <button
          onClick={() => setActiveTab('youtube')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors
                        ${
                          activeTab === 'youtube'
                            ? 'bg-c-surface-raised text-c-danger border-b-2 border-c-danger'
                            : 'text-c-text-secondary dark:text-c-text-muted hover:text-c-text-muted hover:bg-c-surface-raised'
                        }`}
        >
          <Youtube size={18} />
          YouTube
        </button>
        <button
          onClick={() => setActiveTab('url')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors
                        ${
                          activeTab === 'url'
                            ? 'bg-c-surface-raised text-c-info border-b-2 border-c-info'
                            : 'text-c-text-secondary dark:text-c-text-muted hover:text-c-text-muted hover:bg-c-surface-raised'
                        }`}
        >
          <Globe size={18} />
          Web URL
        </button>
      </div>

      {/* Content Area */}
      <div className="p-6">
        {/* File Upload Tab */}
        {activeTab === 'upload' && (
          <div>
            {/* Drop Zone */}
            <div
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all
                                ${
                                  isDragging
                                    ? 'border-c-success bg-[color-mix(in_srgb,var(--c-success)_12%,transparent)]'
                                    : 'border-c-border hover:border-c-border-strong hover:bg-c-surface-raised'
                                }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ALL_ACCEPTED}
                onChange={handleFileSelect}
                className="hidden"
              />

              <div className="flex flex-col items-center gap-3">
                <div
                  className={`p-3 rounded-full ${isDragging ? 'bg-[color-mix(in_srgb,var(--c-success)_18%,transparent)]' : 'bg-c-surface-raised'}`}
                >
                  <Upload
                    size={24}
                    className={
                      isDragging
                        ? 'text-c-success'
                        : 'text-c-text-secondary dark:text-c-text-muted'
                    }
                  />
                </div>
                <div>
                  <p className="text-c-text-muted font-medium">
                    {isDragging ? 'Drop files here' : 'Drag & drop files or click to browse'}
                  </p>
                  <p className="text-c-text-muted text-sm mt-1">
                    PDF, Word, Excel, PowerPoint, Audio, Video, Images
                  </p>
                </div>
              </div>
            </div>

            {/* Selected Files */}
            {files.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-c-text-secondary dark:text-c-text-muted text-sm">
                  {files.length} file(s) selected
                </p>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {files.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-c-surface-raised rounded-lg px-4 py-2"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-c-text-secondary dark:text-c-text-muted">
                          {getFileIcon(file.name)}
                        </span>
                        <span className="text-c-text-muted text-sm truncate max-w-xs">{file.name}</span>
                        <span className="text-c-text-muted text-xs">
                          {(file.size / 1024 / 1024).toFixed(1)} MB
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(index);
                        }}
                        className="text-c-text-secondary dark:text-c-text-muted hover:text-c-danger transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={processFiles}
                  disabled={processing}
                  className="w-full mt-4 bg-c-success hover:opacity-90 disabled:bg-c-border
                                        text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {processing ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload size={18} />
                      Process {files.length} file(s)
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* YouTube Tab */}
        {activeTab === 'youtube' && (
          <div className="space-y-4">
            <div>
              <label className="block text-c-text-secondary dark:text-c-text-muted text-sm mb-2">
                YouTube Video URL
              </label>
              <div className="relative">
                <Youtube
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-c-danger"
                />
                <input
                  type="text"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className="w-full bg-c-surface-raised border border-c-border rounded-lg pl-10 pr-4 py-3
                                        text-c-text-muted placeholder-c-text-muted focus:outline-none focus:border-c-danger"
                />
              </div>
              <p className="text-c-text-muted text-xs mt-2">
                Supports: youtube.com, youtu.be, YouTube Shorts
              </p>
            </div>

            <button
              onClick={processYouTube}
              disabled={processing || !youtubeUrl.trim() || !isYouTubeUrl(youtubeUrl)}
              className="w-full bg-c-danger hover:opacity-90 disabled:bg-c-border
                                text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {processing ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Fetching transcript...
                </>
              ) : (
                <>
                  <Youtube size={18} />
                  Get Transcript
                </>
              )}
            </button>
          </div>
        )}

        {/* URL Tab */}
        {activeTab === 'url' && (
          <div className="space-y-4">
            <div>
              <label className="block text-c-text-secondary dark:text-c-text-muted text-sm mb-2">
                Web Page URL
              </label>
              <div className="relative">
                <Link2
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-c-info"
                />
                <input
                  type="text"
                  value={webUrl}
                  onChange={(e) => setWebUrl(e.target.value)}
                  placeholder="https://example.com/article"
                  className="w-full bg-c-surface-raised border border-c-border rounded-lg pl-10 pr-4 py-3
                                        text-c-text-muted placeholder-c-text-muted focus:outline-none focus:border-c-info"
                />
              </div>
              <p className="text-c-text-muted text-xs mt-2">
                Extracts main content, title, and metadata from web pages
              </p>
            </div>

            <button
              onClick={processUrl}
              disabled={processing || !webUrl.trim() || !webUrl.startsWith('http')}
              className="w-full bg-c-info hover:opacity-90 disabled:bg-c-border
                                text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {processing ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Extracting content...
                </>
              ) : (
                <>
                  <Globe size={18} />
                  Extract Content
                </>
              )}
            </button>
          </div>
        )}

        {/* Processing Progress */}
        {processing && currentProgress && (
          <div className="mt-4 p-3 bg-c-surface-raised rounded-lg flex items-center gap-3">
            <Loader2 size={16} className="animate-spin text-c-success" />
            <span className="text-c-text-secondary text-sm">{currentProgress}</span>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-c-text-secondary dark:text-c-text-muted text-sm font-medium">
              Results
            </p>
            {results.map((result, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg flex items-start gap-3
                                    ${result.success ? 'bg-[color-mix(in_srgb,var(--c-success)_15%,transparent)] border border-c-success' : 'bg-[color-mix(in_srgb,var(--c-danger)_15%,transparent)] border border-c-danger'}`}
              >
                {result.success ? (
                  <CheckCircle size={18} className="text-c-success mt-0.5" />
                ) : (
                  <AlertCircle size={18} className="text-c-danger mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${result.success ? 'text-c-success' : 'text-c-danger'}`}>
                    {result.success
                      ? result.metadata?.filename || result.metadata?.title || 'Content processed'
                      : result.error || 'Processing failed'}
                  </p>
                  {result.success && result.metadata && (
                    <p className="text-xs text-c-text-secondary dark:text-c-text-muted mt-1">
                      {result.metadata.wordCount?.toLocaleString()} words •
                      {result.metadata.processingTimeMs
                        ? ` ${(result.metadata.processingTimeMs / 1000).toFixed(1)}s`
                        : ''}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-c-surface-raised border-t border-c-border">
        <p className="text-c-text-muted text-xs text-center">
          Max file size: 100MB • Audio/Video: max 60 min • Supported: PDF, Word, Excel, PowerPoint,
          Audio, Video, Images, YouTube, Web URLs
        </p>
      </div>
    </div>
  );
};

export default MediaUploader;
