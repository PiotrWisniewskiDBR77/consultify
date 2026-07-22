/**
 * AttachmentsSection
 * Shared attachments component with inline thumbnails + modal preview
 * ClickUp-style design following Golden Standard
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown,
  Download,
  Eye,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  Link as LinkIcon,
  Loader2,
  MoreVertical,
  Paperclip,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  uploadedAt: string;
  uploadedBy?: string;
}

interface AttachmentsSectionProps {
  attachments: Attachment[];
  onUpload: (files: FileList) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onDownload?: (attachment: Attachment) => void;
  readOnly?: boolean;
  maxFiles?: number;
  maxSizeMB?: number;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

export const AttachmentsSection: React.FC<AttachmentsSectionProps> = ({
  attachments,
  onUpload,
  onDelete,
  onDownload,
  readOnly = false,
  maxFiles = 10,
  maxSizeMB = 25,
  expanded = false,
  onToggleExpand,
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const getFileIcon = (type: string, size: number = 24) => {
    if (type.startsWith('image/')) return <FileImage size={size} className="text-blue-400" />;
    if (type === 'application/pdf') return <FileText size={size} className="text-danger-400" />;
    if (type.includes('spreadsheet') || type.includes('excel') || type === 'text/csv')
      return <FileSpreadsheet size={size} className="text-emerald-400" />;
    if (type.includes('document') || type.includes('word'))
      return <FileText size={size} className="text-blue-400" />;
    return <File size={size} className="text-slate-600" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFileSelect = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      // Validate
      if (attachments.length + files.length > maxFiles) {
        toast.error(
          t('myWork.attachments.maxFilesExceeded', 'Maximum {{maxFiles}} files allowed', {
            maxFiles,
          })
        );
        return;
      }

      for (const file of Array.from(files)) {
        if (file.size > maxSizeMB * 1024 * 1024) {
          toast.error(
            t(
              'myWork.attachments.fileTooLarge',
              'File {{fileName}} is too large (max {{maxSizeMB}}MB)',
              {
                fileName: file.name,
                maxSizeMB,
              }
            )
          );
          return;
        }
      }

      try {
        setUploading(true);
        await onUpload(files);
        toast.success(
          t('myWork.attachments.uploadedCount', 'Uploaded {{count}} file(s)', {
            count: files.length,
          })
        );
      } catch (error) {
        console.error('Upload failed', error);
        toast.error(t('myWork.attachments.toastError', 'Failed to upload files'));
      } finally {
        setUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [attachments.length, maxFiles, maxSizeMB, onUpload, t]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect]
  );

  const handleDeleteClick = async (attachment: Attachment) => {
    if (
      !confirm(
        t('myWork.attachments.confirmDelete', 'Are you sure you want to delete "{{name}}"?', {
          name: attachment.name,
        })
      )
    ) {
      return;
    }

    try {
      await onDelete(attachment.id);
      toast.success(t('myWork.attachments.toastSuccess', 'Attachment deleted'));
    } catch (error) {
      toast.error(t('myWork.attachments.toastError2', 'Failed to delete attachment'));
    }
  };

  const canPreview = (type: string) => {
    return type.startsWith('image/') || type === 'application/pdf';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/80 dark:bg-navy-900/80 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-navy-700/50 shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden"
    >
      {/* Collapsible Header */}
      <motion.button
        whileHover={{ backgroundColor: 'rgba(148, 163, 184, 0.1)' }}
        whileTap={{ scale: 0.98 }}
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors duration-200"
      >
        <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
          <div className="p-2 rounded-xl bg-blue-500/10 dark:bg-blue-500/20">
            <Paperclip size={18} className="text-blue-500 dark:text-blue-400" />
          </div>
          <span className="text-sm font-semibold">
            {t('myWork.attachments.attachments', 'Attachments')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {attachments.length > 0 && (
            <span className="text-xs font-medium text-slate-600 dark:text-slate-500">
              {attachments.length}
            </span>
          )}
          <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={18} className="text-slate-600" />
          </motion.div>
        </div>
      </motion.button>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
      />

      {/* Collapsible Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="border-t border-slate-200 dark:border-navy-700 overflow-hidden"
          >
            <div className="p-4">
              {/* Drop Zone / Attachments Grid */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!readOnly) setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`
          min-h-[80px] rounded-lg border-2 border-dashed transition-all
          ${
            dragOver
              ? 'border-c-info bg-c-info/5 dark:bg-c-info/10'
              : 'border-slate-200 dark:border-navy-600'
          }
          ${attachments.length === 0 ? 'flex items-center justify-center p-6' : 'p-3'}
        `}
              >
                {attachments.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-8"
                  >
                    <motion.div
                      animate={{ y: [0, -5, 0] }}
                      transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                      className="inline-block mb-4 p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 to-blue-500/10 dark:from-blue-500/20 dark:to-blue-500/20"
                    >
                      <Upload size={40} className="text-blue-500 dark:text-blue-400" />
                    </motion.div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                      {t(
                        'myWork.attachments.dragFilesHereOr',
                        'Drag files here or click to upload'
                      )}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-500">
                      Max {maxSizeMB}MB / {t('myWork.attachments.file', 'file')}
                    </p>
                  </motion.div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {attachments.map((attachment) => (
                      <motion.div
                        key={attachment.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="group relative bg-slate-50 dark:bg-navy-800 rounded-lg p-3 border border-slate-200 dark:border-navy-600 hover:border-c-border-strong dark:hover:border-c-border-strong transition-all cursor-pointer"
                        onClick={() =>
                          canPreview(attachment.type) && setPreviewAttachment(attachment)
                        }
                      >
                        {/* Thumbnail / Icon */}
                        <div className="h-16 flex items-center justify-center mb-2">
                          {attachment.thumbnailUrl && attachment.type.startsWith('image/') ? (
                            <img
                              src={attachment.thumbnailUrl}
                              alt={attachment.name}
                              className="max-h-16 max-w-full rounded object-cover"
                            />
                          ) : (
                            getFileIcon(attachment.type, 32)
                          )}
                        </div>

                        {/* File Name */}
                        <p
                          className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate"
                          title={attachment.name}
                        >
                          {attachment.name}
                        </p>

                        {/* File Size */}
                        <p className="text-xs text-slate-600 dark:text-slate-500">
                          {formatFileSize(attachment.size)}
                        </p>

                        {/* Hover Actions */}
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          {canPreview(attachment.type) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewAttachment(attachment);
                              }}
                              className="p-1.5 rounded bg-white dark:bg-navy-700 shadow-sm hover:bg-slate-100 dark:hover:bg-navy-600"
                              title={t('myWork.attachments.title', 'Preview')}
                            >
                              <Eye size={12} className="text-slate-600 dark:text-slate-300" />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onDownload) {
                                onDownload(attachment);
                              } else {
                                window.open(attachment.url, '_blank');
                              }
                            }}
                            className="p-1.5 rounded bg-white dark:bg-navy-700 shadow-sm hover:bg-slate-100 dark:hover:bg-navy-600"
                            title={t('myWork.attachments.title2', 'Download')}
                          >
                            <Download size={12} className="text-slate-600 dark:text-slate-300" />
                          </button>
                          {!readOnly && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteClick(attachment);
                              }}
                              className="p-1.5 rounded bg-white dark:bg-navy-700 shadow-sm hover:bg-danger-50 dark:hover:bg-danger-500/20"
                              title={t('myWork.attachments.title3', 'Delete')}
                            >
                              <Trash2 size={12} className="text-danger-500" />
                            </button>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewAttachment && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={() => setPreviewAttachment(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-5xl max-h-[90vh] w-full bg-white dark:bg-navy-900 rounded-xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-navy-700">
                <div className="flex items-center gap-3">
                  {getFileIcon(previewAttachment.type, 20)}
                  <div>
                    <p className="font-medium text-slate-800 dark:text-white">
                      {previewAttachment.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatFileSize(previewAttachment.size)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      onDownload?.(previewAttachment) ||
                      window.open(previewAttachment.url, '_blank')
                    }
                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
                    title={t('myWork.attachments.title4', 'Download')}
                  >
                    <Download size={18} className="text-slate-600 dark:text-slate-300" />
                  </button>
                  <button
                    onClick={() =>
                      navigator.clipboard
                        .writeText(previewAttachment.url)
                        .then(() =>
                          toast.success(t('myWork.attachments.toastSuccess2', 'Link copied'))
                        )
                    }
                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
                    title={t('myWork.attachments.title5', 'Copy link')}
                  >
                    <LinkIcon size={18} className="text-slate-600 dark:text-slate-300" />
                  </button>
                  {!readOnly && (
                    <button
                      onClick={() => {
                        handleDeleteClick(previewAttachment);
                        setPreviewAttachment(null);
                      }}
                      className="p-2 rounded-lg hover:bg-danger-50 dark:hover:bg-danger-500/20 transition-colors"
                      title={t('myWork.attachments.title6', 'Delete')}
                    >
                      <Trash2 size={18} className="text-danger-500" />
                    </button>
                  )}
                  <button
                    onClick={() => setPreviewAttachment(null)}
                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
                  >
                    <X size={18} className="text-slate-600 dark:text-slate-300" />
                  </button>
                </div>
              </div>

              {/* Preview Content */}
              <div className="flex items-center justify-center p-4 bg-slate-100 dark:bg-navy-950 min-h-[400px] max-h-[70vh] overflow-auto">
                {previewAttachment.type.startsWith('image/') ? (
                  <img
                    src={previewAttachment.url}
                    alt={previewAttachment.name}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                  />
                ) : previewAttachment.type === 'application/pdf' ? (
                  <iframe
                    src={previewAttachment.url}
                    className="w-full h-[600px] rounded-lg"
                    title={previewAttachment.name}
                  />
                ) : (
                  <div className="text-center py-12">
                    {getFileIcon(previewAttachment.type, 64)}
                    <p className="mt-4 text-slate-500 dark:text-slate-400">
                      {t('myWork.attachments.previewNotAvailable', 'Preview not available')}
                    </p>
                    <button
                      onClick={() => window.open(previewAttachment.url, '_blank')}
                      className="mt-4 px-4 py-2 rounded-lg bg-c-text text-c-bg hover:bg-c-text-secondary transition-colors"
                    >
                      {t('myWork.attachments.downloadFile', 'Download file')}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AttachmentsSection;
