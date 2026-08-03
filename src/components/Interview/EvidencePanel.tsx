/**
 * EvidencePanel - File attachments and links for Interview
 *
 * Allows uploading files and adding links as evidence for interview answers.
 * Evidence is organized by category.
 */

import {
  ExternalLink,
  File,
  FileText,
  Image,
  Lightbulb,
  Link,
  MessageSquare,
  MoreVertical,
  Paperclip,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/ui/primitives';

import type { InterviewCategory } from './CategorySidebar';
import { CATEGORY_CONFIG } from './CategorySidebar';

// Types
export type EvidenceType = 'file' | 'link' | 'comment' | 'audio';

export interface InterviewEvidence {
  id: string;
  sessionId: string;
  questionId?: string;
  category?: InterviewCategory;
  evidenceType: EvidenceType;
  evidenceRole?: string;
  title?: string;
  name: string;
  url?: string;
  description?: string;
  fileSize?: number;
  fileType?: string;
  mimeType?: string;
  transcriptText?: string;
  ingestToKnowledge?: boolean;
  knowledgeDocumentId?: string;
  uploadedBy?: string;
  createdAt?: string;
  uploadedAt: string;
}

export interface EvidencePanelProps {
  evidence: InterviewEvidence[];
  activeCategory?: InterviewCategory;
  onUploadFile: (file: File, category?: InterviewCategory) => Promise<void | InterviewEvidence>;
  onAddLink: (
    name: string,
    url: string,
    description?: string,
    category?: InterviewCategory
  ) => Promise<void | InterviewEvidence>;
  onAddComment: (text: string, category?: InterviewCategory) => Promise<void | InterviewEvidence>;
  onDeleteEvidence: (evidenceId: string) => Promise<void>;
  isLoading?: boolean;
  readOnly?: boolean;
}

// File icon helper
const getFileIcon = (mimeType?: string) => {
  if (!mimeType) return File;
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.includes('pdf') || mimeType.includes('document')) return FileText;
  return File;
};

// Format file size
const formatFileSize = (bytes?: number): string => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const EvidencePanel: React.FC<EvidencePanelProps> = ({
  evidence,
  activeCategory,
  onUploadFile,
  onAddLink,
  onAddComment,
  onDeleteEvidence,
  isLoading = false,
  readOnly = false,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const [showAddType, setShowAddType] = useState<'file' | 'link' | 'comment' | null>(null);
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkDescription, setLinkDescription] = useState('');
  const [commentText, setCommentText] = useState('');
  const [showMenuId, setShowMenuId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'category'>('all');
  const [isDragging, setIsDragging] = useState(false);

  // Filter evidence
  const filteredEvidence =
    filter === 'category' && activeCategory
      ? evidence.filter((e) => e.category === activeCategory)
      : evidence;

  // Handle file upload
  const handleFileUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      for (let i = 0; i < files.length; i++) {
        await onUploadFile(files[i], activeCategory);
      }
      setShowAddType(null);
    },
    [activeCategory, onUploadFile]
  );

  // Handle link add
  const handleAddLink = useCallback(async () => {
    if (!linkName.trim() || !linkUrl.trim()) return;
    await onAddLink(linkName.trim(), linkUrl.trim(), linkDescription.trim(), activeCategory);
    setLinkName('');
    setLinkUrl('');
    setLinkDescription('');
    setShowAddType(null);
  }, [linkName, linkUrl, linkDescription, activeCategory, onAddLink]);

  const handleAddComment = useCallback(async () => {
    if (!commentText.trim()) return;
    await onAddComment(commentText.trim(), activeCategory);
    setCommentText('');
    setShowAddType(null);
  }, [activeCategory, commentText, onAddComment]);

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFileUpload(e.dataTransfer.files);
    },
    [handleFileUpload]
  );

  if (isLoading) {
    return <LoadingState variant="spinner" className="h-48 py-0" />;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-c-text dark:text-white">
            {t('interview.evidencePanel.evidence')}
          </h3>
          <span className="px-2 py-0.5 text-xs bg-c-surface-raised text-c-text-secondary rounded-full">
            {filteredEvidence.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter */}
          <div className="flex items-center bg-c-surface-raised rounded-lg p-0.5">
            <button
              onClick={() => setFilter('all')}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${
                filter === 'all'
                  ? 'bg-c-surface-raised text-c-text dark:text-white shadow-sm'
                  : 'text-c-text-muted'
              }`}
            >
              {t('interview.evidencePanel.all')}
            </button>
            <button
              onClick={() => setFilter('category')}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${
                filter === 'category'
                  ? 'bg-c-surface-raised text-c-text dark:text-white shadow-sm'
                  : 'text-c-text-muted'
              }`}
            >
              {t('interview.evidencePanel.category')}
            </button>
          </div>

          {/* Add buttons */}
          {!readOnly && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowAddType('file')}
                className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                title={t('interview.evidencePanel.addFile')}
              >
                <Upload size={14} />
              </button>
              <button
                onClick={() => setShowAddType('link')}
                className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                title={t('interview.evidencePanel.addLink')}
              >
                <Link size={14} />
              </button>
              <button
                onClick={() => setShowAddType('comment')}
                className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                title={t('interview.evidencePanel.addComment')}
              >
                <MessageSquare size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add File Form (Drag & Drop) */}
      {showAddType === 'file' && (
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-c-border-strong'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload className="w-10 h-10 text-c-text-secondary mx-auto mb-3" />
          <p className="text-sm text-c-text-secondary mb-2">
            {t('interview.evidencePanel.dragFilesHereOr')}
          </p>
          <label className="inline-flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg cursor-pointer">
            <span>{t('interview.evidencePanel.browseFiles')}</span>
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
            />
          </label>
          <button
            onClick={() => setShowAddType(null)}
            className="block mx-auto mt-3 text-xs text-c-text-secondary hover:text-c-text-secondary"
          >
            {t('interview.evidencePanel.cancel')}
          </button>
        </div>
      )}

      {/* Add Link Form */}
      {showAddType === 'link' && (
        <div className="bg-c-surface rounded-lg border border-blue-300 dark:border-blue-500/50 p-3 space-y-3">
          <input
            type="text"
            value={linkName}
            onChange={(e) => setLinkName(e.target.value)}
            className="w-full p-2 text-sm border border-c-border rounded-lg bg-c-bg text-c-text dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={t('interview.evidencePanel.linkName')}
            autoFocus
          />
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            className="w-full p-2 text-sm border border-c-border rounded-lg bg-c-bg text-c-text dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="https://..."
          />
          <input
            type="text"
            value={linkDescription}
            onChange={(e) => setLinkDescription(e.target.value)}
            className="w-full p-2 text-sm border border-c-border rounded-lg bg-c-bg text-c-text dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={t('interview.evidencePanel.descriptionOptional')}
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setShowAddType(null);
                setLinkName('');
                setLinkUrl('');
                setLinkDescription('');
              }}
              className="px-3 py-1.5 text-sm text-c-text-secondary hover:text-c-text-secondary"
            >
              {t('interview.evidencePanel.cancel')}
            </button>
            <button
              onClick={handleAddLink}
              disabled={!linkName.trim() || !linkUrl.trim()}
              className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 disabled:bg-c-surface-raised text-white rounded-lg"
            >
              {t('interview.evidencePanel.add')}
            </button>
          </div>
        </div>
      )}

      {showAddType === 'comment' && (
        <div className="bg-c-surface rounded-lg border border-blue-300 dark:border-blue-500/50 p-3 space-y-3">
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            rows={4}
            className="w-full p-2 text-sm border border-c-border rounded-lg bg-c-bg text-c-text dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={t('interview.evidencePanel.addAContextualComment')}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setShowAddType(null);
                setCommentText('');
              }}
              className="px-3 py-1.5 text-sm text-c-text-secondary hover:text-c-text-secondary"
            >
              {t('interview.evidencePanel.cancel')}
            </button>
            <button
              onClick={handleAddComment}
              disabled={!commentText.trim()}
              className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 disabled:bg-c-surface-raised text-white rounded-lg"
            >
              {t('interview.evidencePanel.add')}
            </button>
          </div>
        </div>
      )}

      {/* Evidence List */}
      <div className="space-y-2">
        {filteredEvidence.map((item) => {
          const displayName = item.name || item.title || t('interview.evidencePanel.untitled');
          const uploadedAt = item.uploadedAt || item.createdAt || '';
          const mimeType = item.mimeType || item.fileType;
          const FileIcon =
            item.evidenceType === 'link'
              ? Link
              : item.evidenceType === 'comment'
                ? MessageSquare
                : getFileIcon(mimeType);
          const categoryConfig = item.category ? CATEGORY_CONFIG[item.category] : null;

          return (
            <div
              key={item.id}
              className="flex items-center gap-3 p-3 bg-c-surface rounded-lg border border-c-border"
            >
              {/* Icon */}
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  item.evidenceType === 'link'
                    ? 'bg-blue-100 dark:bg-blue-900/30'
                    : item.evidenceType === 'comment'
                      ? 'bg-amber-100 dark:bg-amber-900/30'
                      : 'bg-c-surface-raised'
                }`}
              >
                <FileIcon
                  size={20}
                  className={
                    item.evidenceType === 'link'
                      ? 'text-blue-600 dark:text-blue-400'
                      : item.evidenceType === 'comment'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-c-text-muted'
                  }
                />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {item.evidenceType === 'link' && item.url ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 truncate"
                    >
                      {displayName}
                      <ExternalLink size={12} className="inline ml-1" />
                    </a>
                  ) : (
                    <span className="text-sm font-medium text-c-text dark:text-white truncate">
                      {displayName}
                    </span>
                  )}
                  {categoryConfig && (
                    <span
                      className={`px-1.5 py-0.5 text-xs rounded shrink-0 ${categoryConfig.bgColor} ${categoryConfig.color}`}
                    >
                      {t(
                        `interview.workspace.categoryLabel.${item.category}`,
                        categoryConfig.labelEn
                      )}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-c-text-secondary mt-0.5">
                  {item.fileSize && <span>{formatFileSize(item.fileSize)}</span>}
                  {item.description && <span className="truncate">{item.description}</span>}
                  {uploadedAt ? <span>{new Date(uploadedAt).toLocaleDateString()}</span> : null}
                </div>
              </div>

              {/* Actions */}
              {!readOnly && (
                <div className="relative shrink-0 flex items-center gap-0.5">
                  <button
                    onClick={() => {
                      window.dispatchEvent(
                        new CustomEvent('interview-attach-to-idea', {
                          detail: {
                            type: 'insight',
                            id: item.id,
                            title: item.title || item.name,
                          },
                        })
                      );
                    }}
                    className="p-1 rounded hover:bg-c-surface-raised dark:hover:bg-c-surface-raised"
                    title={t('interview.evidencePanel.attachToIdea')}
                  >
                    <Lightbulb size={16} className="text-c-text-secondary" />
                  </button>
                  <button
                    onClick={() => setShowMenuId(showMenuId === item.id ? null : item.id)}
                    className="p-1 rounded hover:bg-c-surface-raised dark:hover:bg-c-surface-raised"
                  >
                    <MoreVertical size={16} className="text-c-text-secondary" />
                  </button>

                  {showMenuId === item.id && (
                    <div className="absolute top-full right-0 mt-1 bg-c-surface rounded-lg shadow-lg border border-c-border py-1 z-10 min-w-[100px]">
                      <button
                        onClick={() => {
                          onDeleteEvidence(item.id);
                          setShowMenuId(null);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20"
                      >
                        <Trash2 size={14} />
                        {t('interview.evidencePanel.delete')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Empty State */}
        {filteredEvidence.length === 0 && !showAddType && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Paperclip className="w-12 h-12 text-c-text-secondary mb-3" />
            <p className="text-sm text-c-text-muted mb-3">
              {t('interview.evidencePanel.noEvidenceYet')}
            </p>
            {!readOnly && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddType('file')}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                >
                  <Upload size={16} />
                  {t('interview.evidencePanel.addFile')}
                </button>
                <button
                  onClick={() => setShowAddType('link')}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                >
                  <Link size={16} />
                  {t('interview.evidencePanel.addLink')}
                </button>
                <button
                  onClick={() => setShowAddType('comment')}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                >
                  <MessageSquare size={16} />
                  {t('interview.evidencePanel.addComment')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EvidencePanel;
