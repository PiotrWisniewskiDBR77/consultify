/**
 * UploadChaosStep — Path C: Upload Chaos -> Knowledge Map
 *
 * Wizard step that lets users upload multiple files (PDF/DOCX/XLSX/CSV),
 * builds a Knowledge Map from the content, and offers two continuation paths:
 * Path A (Template-based) or Path B (Free Intelligence).
 */

import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FileText,
  Loader2,
  MapPin,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '../../../services/api';

// ==========================================
// TYPES
// ==========================================

export interface ExtractedEntity {
  type: string;
  name: string;
  count: number;
}

export interface KnowledgeMapResult {
  id: string;
  sourceCount: number;
  keyTopics: string[];
  suggestedReportType: string;
  extractedEntities: ExtractedEntity[];
  summary: string;
  uploadedFileIds: string[];
}

export interface UploadChaosStepProps {
  onKnowledgeMapReady: (knowledgeMap: KnowledgeMapResult) => void;
  onChoosePath: (path: 'A' | 'B') => void;
  isLoading: boolean;
}

interface UploadedFile {
  id?: string;
  file: File;
  name: string;
  size: number;
  status: 'uploading' | 'processing' | 'done' | 'error';
  error?: string;
}

const ACCEPTED_EXTENSIONS = '.pdf,.docx,.xlsx,.csv';
const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ==========================================
// COMPONENT
// ==========================================

export const UploadChaosStep: React.FC<UploadChaosStepProps> = ({
  onKnowledgeMapReady,
  onChoosePath,
  isLoading: externalLoading,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isBuildingMap, setIsBuildingMap] = useState(false);
  const [knowledgeMap, setKnowledgeMap] = useState<KnowledgeMapResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isLoading = externalLoading || isUploading || isBuildingMap;

  const handleFilesSelected = useCallback(
    async (selectedFiles: FileList | File[]) => {
      setError(null);
      const newFiles: UploadedFile[] = Array.from(selectedFiles)
        .filter((f) => {
          const ext = f.name.split('.').pop()?.toLowerCase();
          return (
            ACCEPTED_MIME_TYPES.includes(f.type) ||
            ['pdf', 'docx', 'xlsx', 'csv'].includes(ext || '')
          );
        })
        .map((f) => ({
          file: f,
          name: f.name,
          size: f.size,
          status: 'uploading' as const,
        }));

      if (newFiles.length === 0) {
        setError(
          t('reportBuilder.uploadChaosStep.unsupportedFileTypesAllowedPdfDocx', 'Unsupported file types. Allowed: PDF, DOCX, XLSX, CSV.')
        );
        return;
      }

      setFiles((prev) => [...prev, ...newFiles]);
      setIsUploading(true);

      try {
        const formData = new FormData();
        newFiles.forEach((f) => formData.append('files', f.file));

        const response = await Api.postMultipart('/report-builder/upload-chaos', formData);

        const uploadedFileIds: string[] = response.fileIds;

        setFiles((prev) =>
          prev.map((f) => {
            if (f.status !== 'uploading') return f;
            const match = response.files?.find((rf: { name: string }) => rf.name === f.name);
            if (match) {
              return { ...f, id: match.id, status: 'done' as const };
            }
            return { ...f, status: 'done' as const };
          })
        );

        const allFileIds = [...files.filter((f) => f.id).map((f) => f.id!), ...uploadedFileIds];

        setIsBuildingMap(true);
        const map: KnowledgeMapResult = await Api.post('/report-builder/knowledge-map', {
          fileIds: allFileIds,
        });
        setKnowledgeMap(map);
        onKnowledgeMapReady(map);
      } catch (err: any) {
        const msg = err?.message || 'Upload failed';
        setError(msg);
        setFiles((prev) =>
          prev.map((f) =>
            f.status === 'uploading' ? { ...f, status: 'error' as const, error: msg } : f
          )
        );
      } finally {
        setIsUploading(false);
        setIsBuildingMap(false);
      }
    },
    [files, t, onKnowledgeMapReady]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        handleFilesSelected(e.dataTransfer.files);
      }
    },
    [handleFilesSelected]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFilesSelected(e.target.files);
        e.target.value = '';
      }
    },
    [handleFilesSelected]
  );

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const allDone = files.length > 0 && files.every((f) => f.status === 'done');

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="space-y-6">
      {/* Dropzone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleBrowseClick}
        className={`
          relative flex flex-col items-center justify-center p-10 rounded-2xl border-2 border-dashed
          cursor-pointer transition-all duration-200
          ${
            isDragging
              ? 'border-c-accent bg-c-accent-soft scale-[1.01]'
              : 'border-c-border-subtle bg-c-surface-raised hover:border-c-accent hover:bg-c-accent-soft'
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS}
          onChange={handleInputChange}
          className="hidden"
        />

        <div
          className={`p-4 rounded-xl mb-4 ${
            isDragging ? 'bg-c-accent-soft' : 'bg-c-surface-raised'
          }`}
        >
          <Upload className={`w-8 h-8 ${isDragging ? 'text-c-accent' : 'text-c-text-secondary'}`} />
        </div>

        <p className="text-sm font-semibold text-c-text">
          {t('reportBuilder.uploadChaosStep.dragDropFilesHere', 'Drag & drop files here')}
        </p>
        <p className="text-xs text-c-text-secondary mt-1">
          {t('reportBuilder.uploadChaosStep.orClickToBrowsePdfDocx', 'or click to browse • PDF, DOCX, XLSX, CSV • up to 20 MB')}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 text-sm text-danger-700 dark:text-danger-300">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-danger-400 hover:text-danger-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-c-text">
            {t('reportBuilder.uploadChaosStep.uploadedFiles', 'Uploaded files')} ({files.length})
          </h3>
          <div className="space-y-1.5">
            {files.map((f, idx) => (
              <div
                key={`${f.name}-${idx}`}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-c-surface border border-slate-200/60 dark:border-white/[0.03]"
              >
                <FileText className="w-4 h-4 text-c-text-secondary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-c-text truncate">{f.name}</p>
                  <p className="text-xs text-c-text-secondary">{formatFileSize(f.size)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {f.status === 'uploading' && (
                    <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {t('reportBuilder.uploadChaosStep.uploading', 'Uploading...')}
                    </span>
                  )}
                  {f.status === 'processing' && (
                    <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {t('reportBuilder.uploadChaosStep.processing', 'Processing...')}
                    </span>
                  )}
                  {f.status === 'done' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                  {f.status === 'error' && <AlertCircle className="w-4 h-4 text-danger-500" />}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(idx);
                    }}
                    className="text-c-text-secondary hover:text-c-text-secondary"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Building knowledge map spinner */}
      {isBuildingMap && (
        <div className="flex items-center justify-center gap-3 py-6">
          <Loader2 className="w-5 h-5 text-c-accent animate-spin" />
          <span className="text-sm text-c-text-secondary">
            {t('reportBuilder.uploadChaosStep.buildingKnowledgeMap', 'Building knowledge map...')}
          </span>
        </div>
      )}

      {/* Knowledge Map Card */}
      {knowledgeMap && allDone && (
        <div className="rounded-2xl border border-c-accent-soft bg-c-accent-soft p-6 space-y-4">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-c-accent" />
            <h3 className="text-base font-bold text-c-text">
              {t('reportBuilder.uploadChaosStep.knowledgeMap', 'Knowledge Map')}
            </h3>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="px-3 py-2 rounded-lg bg-c-surface">
              <div className="text-lg font-bold text-c-accent">{knowledgeMap.sourceCount}</div>
              <div className="text-xs text-c-text-secondary">{t('reportBuilder.uploadChaosStep.files', 'Files')}</div>
            </div>
            <div className="px-3 py-2 rounded-lg bg-c-surface">
              <div className="text-lg font-bold text-c-accent">{knowledgeMap.keyTopics.length}</div>
              <div className="text-xs text-c-text-secondary">{t('reportBuilder.uploadChaosStep.topics', 'Topics')}</div>
            </div>
            <div className="px-3 py-2 rounded-lg bg-c-surface">
              <div className="text-lg font-bold text-c-accent">
                {knowledgeMap.extractedEntities.length}
              </div>
              <div className="text-xs text-c-text-secondary">{t('reportBuilder.uploadChaosStep.entities', 'Entities')}</div>
            </div>
            <div className="px-3 py-2 rounded-lg bg-c-surface">
              <div className="text-xs font-semibold text-c-accent truncate">
                {knowledgeMap.suggestedReportType.replace(/_/g, ' ')}
              </div>
              <div className="text-xs text-c-text-secondary">
                {t('reportBuilder.uploadChaosStep.reportType', 'Report type')}
              </div>
            </div>
          </div>

          {/* Key topics */}
          {knowledgeMap.keyTopics.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-c-text-secondary mb-1.5">
                {t('reportBuilder.uploadChaosStep.keyTopics', 'Key topics')}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {knowledgeMap.keyTopics.map((topic) => (
                  <span
                    key={topic}
                    className="px-2 py-0.5 text-xs rounded-full bg-c-accent-soft text-c-accent"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          <p className="text-sm text-c-text-secondary leading-relaxed">{knowledgeMap.summary}</p>

          {/* Path selection buttons */}
          <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => onChoosePath('A')}
              disabled={isLoading}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl
                bg-c-surface border-2 border-c-accent
                hover:border-c-accent
                text-c-text font-semibold text-sm
                transition-all hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText className="w-4 h-4 text-c-accent" />
              {t('reportBuilder.uploadChaosStep.useTemplatePathA', 'Use Template (Path A)')}
              <ArrowRight className="w-4 h-4 text-c-text-secondary" />
            </button>

            <button
              onClick={() => onChoosePath('B')}
              disabled={isLoading}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl
                bg-c-text
                text-c-surface font-semibold text-sm
                transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-4 h-4" />
              {t('reportBuilder.uploadChaosStep.freeIntelligencePathB', 'Free Intelligence (Path B)')}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadChaosStep;
