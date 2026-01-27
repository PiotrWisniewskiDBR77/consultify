/**
 * AttachmentsSection
 * Shared attachments component with inline thumbnails + modal preview
 * ClickUp-style design following Golden Standard
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
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
}

export const AttachmentsSection: React.FC<AttachmentsSectionProps> = ({
  attachments,
  onUpload,
  onDelete,
  onDownload,
  readOnly = false,
  maxFiles = 10,
  maxSizeMB = 25,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const getFileIcon = (type: string, size: number = 24) => {
    if (type.startsWith('image/')) return <FileImage size={size} className="text-blue-400" />;
    if (type === 'application/pdf') return <FileText size={size} className="text-red-400" />;
    if (type.includes('spreadsheet') || type.includes('excel') || type === 'text/csv')
      return <FileSpreadsheet size={size} className="text-emerald-400" />;
    if (type.includes('document') || type.includes('word'))
      return <FileText size={size} className="text-blue-400" />;
    return <File size={size} className="text-slate-400" />;
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
          isPolish
            ? `Maksymalnie ${maxFiles} plików`
            : `Maximum ${maxFiles} files allowed`
        );
        return;
      }

      for (const file of Array.from(files)) {
        if (file.size > maxSizeMB * 1024 * 1024) {
          toast.error(
            isPolish
              ? `Plik ${file.name} jest za duży (max ${maxSizeMB}MB)`
              : `File ${file.name} is too large (max ${maxSizeMB}MB)`
          );
          return;
        }
      }

      try {
        setUploading(true);
        await onUpload(files);
        toast.success(
          isPolish
            ? `Przesłano ${files.length} plik(ów)`
            : `Uploaded ${files.length} file(s)`
        );
      } catch (error) {
        console.error('Upload failed', error);
        toast.error(isPolish ? 'Nie udało się przesłać plików' : 'Failed to upload files');
      } finally {
        setUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [attachments.length, isPolish, maxFiles, maxSizeMB, onUpload]
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
        isPolish
          ? `Czy na pewno chcesz usunąć "${attachment.name}"?`
          : `Are you sure you want to delete "${attachment.name}"?`
      )
    ) {
      return;
    }

    try {
      await onDelete(attachment.id);
      toast.success(isPolish ? 'Załącznik usunięty' : 'Attachment deleted');
    } catch (error) {
      toast.error(isPolish ? 'Nie udało się usunąć załącznika' : 'Failed to delete attachment');
    }
  };

  const canPreview = (type: string) => {
    return type.startsWith('image/') || type === 'application/pdf';
  };

  return (
    <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
          <Paperclip size={16} />
          <span className="text-sm font-medium">
            {isPolish ? 'Załączniki' : 'Attachments'}
          </span>
          {attachments.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-400">
              {attachments.length}
            </span>
          )}
        </div>
        {!readOnly && (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || attachments.length >= maxFiles}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
              text-primary-600 dark:text-primary-400 
              hover:bg-primary-50 dark:hover:bg-primary-500/10 
              transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Plus size={14} />
            )}
            <span>{isPolish ? 'Dodaj' : 'Add'}</span>
          </button>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
      />

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
          ${dragOver
            ? 'border-primary-400 bg-primary-50 dark:bg-primary-500/10'
            : 'border-slate-200 dark:border-navy-600'
          }
          ${attachments.length === 0 ? 'flex items-center justify-center p-6' : 'p-3'}
        `}
      >
        {attachments.length === 0 ? (
          <div className="text-center">
            <Upload
              size={32}
              className="mx-auto mb-2 text-slate-300 dark:text-navy-500"
            />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {isPolish
                ? 'Przeciągnij pliki lub kliknij aby dodać'
                : 'Drag files here or click to upload'}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Max {maxSizeMB}MB / {isPolish ? 'plik' : 'file'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {attachments.map((attachment) => (
              <motion.div
                key={attachment.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="group relative bg-slate-50 dark:bg-navy-800 rounded-lg p-3 border border-slate-200 dark:border-navy-600 hover:border-primary-300 dark:hover:border-primary-500/50 transition-all cursor-pointer"
                onClick={() => canPreview(attachment.type) && setPreviewAttachment(attachment)}
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
                <p className="text-xs text-slate-400 dark:text-slate-500">
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
                      title={isPolish ? 'Podgląd' : 'Preview'}
                    >
                      <Eye size={12} className="text-slate-600 dark:text-slate-300" />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDownload?.(attachment) || window.open(attachment.url, '_blank');
                    }}
                    className="p-1.5 rounded bg-white dark:bg-navy-700 shadow-sm hover:bg-slate-100 dark:hover:bg-navy-600"
                    title={isPolish ? 'Pobierz' : 'Download'}
                  >
                    <Download size={12} className="text-slate-600 dark:text-slate-300" />
                  </button>
                  {!readOnly && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(attachment);
                      }}
                      className="p-1.5 rounded bg-white dark:bg-navy-700 shadow-sm hover:bg-red-50 dark:hover:bg-red-500/20"
                      title={isPolish ? 'Usuń' : 'Delete'}
                    >
                      <Trash2 size={12} className="text-red-500" />
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

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
                    title={isPolish ? 'Pobierz' : 'Download'}
                  >
                    <Download size={18} className="text-slate-600 dark:text-slate-300" />
                  </button>
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(previewAttachment.url).then(() =>
                        toast.success(isPolish ? 'Link skopiowany' : 'Link copied')
                      )
                    }
                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
                    title={isPolish ? 'Kopiuj link' : 'Copy link'}
                  >
                    <LinkIcon size={18} className="text-slate-600 dark:text-slate-300" />
                  </button>
                  {!readOnly && (
                    <button
                      onClick={() => {
                        handleDeleteClick(previewAttachment);
                        setPreviewAttachment(null);
                      }}
                      className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/20 transition-colors"
                      title={isPolish ? 'Usuń' : 'Delete'}
                    >
                      <Trash2 size={18} className="text-red-500" />
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
                      {isPolish ? 'Podgląd niedostępny' : 'Preview not available'}
                    </p>
                    <button
                      onClick={() => window.open(previewAttachment.url, '_blank')}
                      className="mt-4 px-4 py-2 rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors"
                    >
                      {isPolish ? 'Pobierz plik' : 'Download file'}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AttachmentsSection;
