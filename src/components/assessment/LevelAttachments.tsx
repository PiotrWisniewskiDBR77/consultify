/**
 * LevelAttachments Component
 *
 * Displays and manages file attachments for a specific assessment level.
 * Allows uploading, viewing, and deleting evidence documents.
 */

import {
  Download,
  Eye,
  File,
  FileText,
  Image,
  Loader2,
  Paperclip,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { LevelAttachment, useAssessmentAttachments } from '../../hooks/useAssessmentAttachments';

interface LevelAttachmentsProps {
  assessmentId: string;
  axisId: string;
  levelNumber: number;
  areaId?: string;
  readOnly?: boolean;
  compact?: boolean;
}

const ATTACHMENT_TYPES = [
  { value: 'EVIDENCE', label: 'Evidence' },
  { value: 'SCREENSHOT', label: 'Screenshot' },
  { value: 'DOCUMENT', label: 'Document' },
  { value: 'REPORT', label: 'Report' },
  { value: 'OTHER', label: 'Other' },
] as const;

const getFileIcon = (mimeType: string) => {
  if (mimeType?.startsWith('image/')) return Image;
  if (mimeType?.includes('pdf') || mimeType?.includes('document')) return FileText;
  return File;
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const LevelAttachments: React.FC<LevelAttachmentsProps> = ({
  assessmentId,
  axisId,
  levelNumber,
  areaId,
  readOnly = false,
  compact = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [attachments, setAttachments] = useState<LevelAttachment[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedType, setSelectedType] = useState<LevelAttachment['attachmentType']>('EVIDENCE');
  const [description, setDescription] = useState('');
  const [showUploadForm, setShowUploadForm] = useState(false);

  const {
    uploadAttachment,
    getAttachments,
    deleteAttachment,
    getDownloadUrl,
    isUploading,
    isDeleting,
    error,
  } = useAssessmentAttachments({ assessmentId });

  // Fetch attachments on mount and when dependencies change
  const fetchAttachments = useCallback(async () => {
    const result = await getAttachments(axisId, levelNumber, areaId);
    if (result) {
      setAttachments(result.attachments);
    }
  }, [getAttachments, axisId, levelNumber, areaId]);

  useEffect(() => {
    if (assessmentId) {
      fetchAttachments();
    }
  }, [assessmentId, fetchAttachments]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const result = await uploadAttachment(file, axisId, levelNumber, {
      areaId,
      attachmentType: selectedType,
      description: description || undefined,
    });

    if (result) {
      setAttachments((prev) => [result, ...prev]);
      setDescription('');
      setShowUploadForm(false);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (attachmentId: string) => {
    if (window.confirm('Are you sure you want to delete this attachment?')) {
      const success = await deleteAttachment(attachmentId);
      if (success) {
        setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
      }
    }
  };

  const handleDownload = (attachment: LevelAttachment) => {
    window.open(getDownloadUrl(attachment.id), '_blank');
  };

  // Compact mode - just show count and expand button
  if (compact && !isExpanded) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-primary-500 transition-colors"
        >
          <Paperclip size={14} />
          <span>
            {attachments.length > 0
              ? `${attachments.length} ${attachments.length === 1 ? 'attachment' : 'attachments'}`
              : 'Add attachment'}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="w-full mt-4 border-t border-slate-200 dark:border-navy-700 pt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          <Paperclip size={14} />
          <span>Attachments ({attachments.length})</span>
        </div>

        {!readOnly && (
          <button
            onClick={() => setShowUploadForm(!showUploadForm)}
            className="flex items-center gap-1.5 text-xs font-medium text-primary-500 hover:text-primary-600 transition-colors"
          >
            <Plus size={14} />
            Add
          </button>
        )}

        {compact && (
          <button
            onClick={() => setIsExpanded(false)}
            className="text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:text-slate-400"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Upload Form */}
      {showUploadForm && !readOnly && (
        <div className="mb-4 p-3 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-200 dark:border-navy-700">
          <div className="space-y-3">
            {/* Type Selection */}
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                Attachment type
              </label>
              <select
                value={selectedType}
                onChange={(e) =>
                  setSelectedType(e.target.value as LevelAttachment['attachmentType'])
                }
                className="w-full text-sm bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-md px-2 py-1.5"
              >
                {ATTACHMENT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                Description (optional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short attachment description..."
                className="w-full text-sm bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-md px-2 py-1.5"
              />
            </div>

            {/* File Input */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.csv,.txt,.json"
                className="hidden"
                disabled={isUploading}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-c-text hover:bg-c-text-secondary disabled:bg-c-border-strong text-c-bg text-sm font-medium rounded-md transition-colors"
              >
                {isUploading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    Choose file
                  </>
                )}
              </button>
            </div>

            <p className="text-[10px] text-slate-500 dark:text-slate-400 dark:text-slate-500">
              Allowed: PDF, Word, Excel, PowerPoint, images, CSV, TXT, JSON (max 25MB)
            </p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-3 p-2 bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400 text-xs rounded-md">
          {error}
        </div>
      )}

      {/* Attachments List */}
      {attachments.length > 0 ? (
        <div className="space-y-2">
          {attachments.map((attachment) => {
            const FileIcon = getFileIcon(attachment.mimeType);
            const isCurrentDeleting = isDeleting === attachment.id;

            return (
              <div
                key={attachment.id}
                className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-200 dark:border-navy-700 hover:border-primary-300 dark:hover:border-primary-500/30 transition-colors group"
              >
                {/* Icon */}
                <div className="shrink-0 w-8 h-8 rounded-md bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 flex items-center justify-center">
                  <FileIcon size={16} className="text-slate-500 dark:text-slate-400" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                    {attachment.fileName}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 dark:text-slate-500">
                    <span>{formatFileSize(attachment.fileSize)}</span>
                    <span>•</span>
                    <span>
                      {ATTACHMENT_TYPES.find((t) => t.value === attachment.attachmentType)?.label ||
                        attachment.attachmentType}
                    </span>
                    {attachment.description && (
                      <>
                        <span>•</span>
                        <span className="truncate">{attachment.description}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleDownload(attachment)}
                    className="p-1.5 text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:text-blue-500 transition-colors"
                    title="Download"
                  >
                    <Download size={14} />
                  </button>

                  {!readOnly && (
                    <button
                      onClick={() => handleDelete(attachment.id)}
                      disabled={isCurrentDeleting}
                      className="p-1.5 text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:text-danger-500 transition-colors disabled:opacity-50"
                      title="Delete"
                    >
                      {isCurrentDeleting ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-4 text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">
          No attachments for this level
        </div>
      )}
    </div>
  );
};

export default LevelAttachments;
