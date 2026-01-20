/**
 * EvidencePanel - File attachments and links for Interview
 * 
 * Allows uploading files and adding links as evidence for interview answers.
 * Evidence is organized by category.
 */

import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ExternalLink,
  File,
  FileText,
  Image,
  Link,
  MoreVertical,
  Paperclip,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

import type { InterviewCategory } from './CategorySidebar';
import { CATEGORY_CONFIG } from './CategorySidebar';

// Types
export type EvidenceType = 'file' | 'link';

export interface InterviewEvidence {
  id: string;
  sessionId: string;
  category?: InterviewCategory;
  evidenceType: EvidenceType;
  name: string;
  url?: string;
  description?: string;
  fileSize?: number;
  mimeType?: string;
  uploadedBy?: string;
  uploadedAt: string;
}

export interface EvidencePanelProps {
  evidence: InterviewEvidence[];
  activeCategory?: InterviewCategory;
  onUploadFile: (file: File, category?: InterviewCategory) => Promise<void>;
  onAddLink: (name: string, url: string, description?: string, category?: InterviewCategory) => Promise<void>;
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
  onDeleteEvidence,
  isLoading = false,
  readOnly = false,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const [showAddType, setShowAddType] = useState<'file' | 'link' | null>(null);
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkDescription, setLinkDescription] = useState('');
  const [showMenuId, setShowMenuId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'category'>('all');
  const [isDragging, setIsDragging] = useState(false);

  // Filter evidence
  const filteredEvidence = filter === 'category' && activeCategory
    ? evidence.filter(e => e.category === activeCategory)
    : evidence;

  // Handle file upload
  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      await onUploadFile(files[i], activeCategory);
    }
    setShowAddType(null);
  }, [activeCategory, onUploadFile]);

  // Handle link add
  const handleAddLink = useCallback(async () => {
    if (!linkName.trim() || !linkUrl.trim()) return;
    await onAddLink(linkName.trim(), linkUrl.trim(), linkDescription.trim(), activeCategory);
    setLinkName('');
    setLinkUrl('');
    setLinkDescription('');
    setShowAddType(null);
  }, [linkName, linkUrl, linkDescription, activeCategory, onAddLink]);

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files);
  }, [handleFileUpload]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-navy-900 dark:text-white">
            {isPolish ? 'Dowody' : 'Evidence'}
          </h3>
          <span className="px-2 py-0.5 text-xs bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 rounded-full">
            {filteredEvidence.length}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Filter */}
          <div className="flex items-center bg-slate-100 dark:bg-navy-800 rounded-lg p-0.5">
            <button
              onClick={() => setFilter('all')}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${
                filter === 'all'
                  ? 'bg-white dark:bg-navy-700 text-navy-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {isPolish ? 'Wszystkie' : 'All'}
            </button>
            <button
              onClick={() => setFilter('category')}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${
                filter === 'category'
                  ? 'bg-white dark:bg-navy-700 text-navy-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {isPolish ? 'Kategoria' : 'Category'}
            </button>
          </div>

          {/* Add buttons */}
          {!readOnly && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowAddType('file')}
                className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                title={isPolish ? 'Dodaj plik' : 'Add file'}
              >
                <Upload size={14} />
              </button>
              <button
                onClick={() => setShowAddType('link')}
                className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                title={isPolish ? 'Dodaj link' : 'Add link'}
              >
                <Link size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add File Form (Drag & Drop) */}
      {showAddType === 'file' && (
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            isDragging
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-slate-300 dark:border-navy-600'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
            {isPolish 
              ? 'Przeciągnij pliki tutaj lub' 
              : 'Drag files here or'
            }
          </p>
          <label className="inline-flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg cursor-pointer">
            <span>{isPolish ? 'Wybierz pliki' : 'Browse files'}</span>
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
            />
          </label>
          <button
            onClick={() => setShowAddType(null)}
            className="block mx-auto mt-3 text-xs text-slate-400 hover:text-slate-600"
          >
            {isPolish ? 'Anuluj' : 'Cancel'}
          </button>
        </div>
      )}

      {/* Add Link Form */}
      {showAddType === 'link' && (
        <div className="bg-white dark:bg-navy-900 rounded-lg border border-blue-300 dark:border-blue-500/50 p-3 space-y-3">
          <input
            type="text"
            value={linkName}
            onChange={(e) => setLinkName(e.target.value)}
            className="w-full p-2 text-sm border border-slate-200 dark:border-navy-700 rounded-lg bg-slate-50 dark:bg-navy-950 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={isPolish ? 'Nazwa linku...' : 'Link name...'}
            autoFocus
          />
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            className="w-full p-2 text-sm border border-slate-200 dark:border-navy-700 rounded-lg bg-slate-50 dark:bg-navy-950 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="https://..."
          />
          <input
            type="text"
            value={linkDescription}
            onChange={(e) => setLinkDescription(e.target.value)}
            className="w-full p-2 text-sm border border-slate-200 dark:border-navy-700 rounded-lg bg-slate-50 dark:bg-navy-950 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={isPolish ? 'Opis (opcjonalny)...' : 'Description (optional)...'}
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setShowAddType(null);
                setLinkName('');
                setLinkUrl('');
                setLinkDescription('');
              }}
              className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 dark:text-slate-400"
            >
              {isPolish ? 'Anuluj' : 'Cancel'}
            </button>
            <button
              onClick={handleAddLink}
              disabled={!linkName.trim() || !linkUrl.trim()}
              className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white rounded-lg"
            >
              {isPolish ? 'Dodaj' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {/* Evidence List */}
      <div className="space-y-2">
        {filteredEvidence.map((item) => {
          const FileIcon = item.evidenceType === 'link' ? Link : getFileIcon(item.mimeType);
          const categoryConfig = item.category ? CATEGORY_CONFIG[item.category] : null;

          return (
            <div
              key={item.id}
              className="flex items-center gap-3 p-3 bg-white dark:bg-navy-900 rounded-lg border border-slate-200 dark:border-navy-700"
            >
              {/* Icon */}
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                item.evidenceType === 'link'
                  ? 'bg-blue-100 dark:bg-blue-900/30'
                  : 'bg-slate-100 dark:bg-navy-800'
              }`}>
                <FileIcon size={20} className={
                  item.evidenceType === 'link'
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-slate-500 dark:text-slate-400'
                } />
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
                      {item.name}
                      <ExternalLink size={12} className="inline ml-1" />
                    </a>
                  ) : (
                    <span className="text-sm font-medium text-navy-900 dark:text-white truncate">
                      {item.name}
                    </span>
                  )}
                  {categoryConfig && (
                    <span className={`px-1.5 py-0.5 text-xs rounded shrink-0 ${categoryConfig.bgColor} ${categoryConfig.color}`}>
                      {isPolish ? categoryConfig.labelPl : categoryConfig.labelEn}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  {item.fileSize && (
                    <span>{formatFileSize(item.fileSize)}</span>
                  )}
                  {item.description && (
                    <span className="truncate">{item.description}</span>
                  )}
                  <span>{new Date(item.uploadedAt).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Actions */}
              {!readOnly && (
                <div className="relative shrink-0">
                  <button
                    onClick={() => setShowMenuId(showMenuId === item.id ? null : item.id)}
                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-navy-800"
                  >
                    <MoreVertical size={16} className="text-slate-400" />
                  </button>

                  {showMenuId === item.id && (
                    <div className="absolute top-full right-0 mt-1 bg-white dark:bg-navy-900 rounded-lg shadow-lg border border-slate-200 dark:border-navy-700 py-1 z-10 min-w-[100px]">
                      <button
                        onClick={() => {
                          onDeleteEvidence(item.id);
                          setShowMenuId(null);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 size={14} />
                        {isPolish ? 'Usuń' : 'Delete'}
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
            <Paperclip className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
              {isPolish ? 'Brak załączników' : 'No evidence yet'}
            </p>
            {!readOnly && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddType('file')}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                >
                  <Upload size={16} />
                  {isPolish ? 'Dodaj plik' : 'Add file'}
                </button>
                <button
                  onClick={() => setShowAddType('link')}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                >
                  <Link size={16} />
                  {isPolish ? 'Dodaj link' : 'Add link'}
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
