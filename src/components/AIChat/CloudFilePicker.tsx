/**
 * CloudFilePicker
 *
 * Modal for browsing and selecting files from cloud storage providers
 * (Google Drive, OneDrive, Dropbox)
 *
 * @version 1.0.0
 */

import { ChevronRight, File, FileText, Folder, Image, Search, Table, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import type { CloudFile, CloudProviderId } from '../../hooks/useCloudIntegrations';
import { Api } from '../../services/api';
import { EmptyState } from '../ui/composed/EmptyState';
import { LoadingState } from '../ui/primitives';
import {
  isSupportedChatAttachment,
  SUPPORTED_CHAT_ATTACHMENT_LABEL,
} from './chatAttachmentSupport';

// Cloud provider icons
const ProviderIcons: Record<string, React.ReactNode> = {
  'google-drive': (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M7.71 3.5L1.15 15l4.58 7.5h13.14L15.29 15l6.56-11.5H7.71zm-.29 1h5.79l-5.5 9.5H2.79l4.63-9.5zm6.79 0h5.5l-4.79 8.5-2.79-4.79L14.21 4.5zm-6 10.5h5.58l2.79 4.5H7.71l.5-4.5z" />
    </svg>
  ),
  onedrive: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M10.5 18.5h8.25a3.75 3.75 0 001.41-7.23 5.25 5.25 0 00-10.32 0A3.75 3.75 0 0010.5 18.5z" />
      <path
        d="M6.75 18.5h1.5a4.5 4.5 0 018.68-1.66 3 3 0 00-3.18-4.59 6 6 0 00-11.5 1.5A4.5 4.5 0 006.75 18.5z"
        opacity="0.7"
      />
    </svg>
  ),
  dropbox: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M6 2l6 3.75L6 9.5 0 5.75 6 2zm12 0l6 3.75-6 3.75-6-3.75L18 2zM0 13.25L6 9.5l6 3.75-6 3.75-6-3.75zm18-3.75l6 3.75-6 3.75-6-3.75 6-3.75zM6 18.25l6-3.75 6 3.75-6 3.75-6-3.75z" />
    </svg>
  ),
};

const ProviderColors: Record<string, string> = {
  'google-drive': 'text-green-500',
  onedrive: 'text-blue-500',
  dropbox: 'text-blue-600',
};

const ProviderNames: Record<string, string> = {
  'google-drive': 'Google Drive',
  onedrive: 'OneDrive',
  dropbox: 'Dropbox',
};

interface CloudFilePickerProps {
  isOpen: boolean;
  onClose: () => void;
  provider: CloudProviderId;
  onFileSelect: (file: CloudFile) => void;
}

// Get icon for file type
const getFileIcon = (mimeType: string, isFolder: boolean) => {
  if (isFolder) return <Folder size={20} className="text-yellow-500" />;
  if (mimeType.startsWith('image/')) return <Image size={20} className="text-primary-500" />;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel'))
    return <Table size={20} className="text-green-500" />;
  if (mimeType.includes('document') || mimeType.includes('word') || mimeType === 'application/pdf')
    return <FileText size={20} className="text-blue-500" />;
  return <File size={20} className="text-slate-600" />;
};

// Format file size
const formatSize = (bytes: number): string => {
  if (bytes === 0) return '—';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export const CloudFilePicker: React.FC<CloudFilePickerProps> = ({
  isOpen,
  onClose,
  provider,
  onFileSelect,
}) => {
  const { t } = useTranslation();
  const [files, setFiles] = useState<CloudFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPath, setCurrentPath] = useState<{ id: string; name: string }[]>([
    // Keep a stable internal marker; display label is translated at render time.
    { id: 'root', name: 'root' },
  ]);
  const [selectedFile, setSelectedFile] = useState<CloudFile | null>(null);
  // Load files for current folder from backend API
  const loadFiles = useCallback(
    async (folderId: string = 'root') => {
      setIsLoading(true);
      try {
        const response = await Api.listCloudFiles(
          provider,
          folderId === 'root' ? undefined : folderId
        );
        const cloudFiles: CloudFile[] = Array.isArray(response)
          ? response
          : ((response as any)?.files ?? []);
        setFiles(cloudFiles);
      } catch (error: any) {
        const isNotImplemented = error?.message?.toLowerCase?.().includes('not implemented');
        console.error('[CloudFilePicker] Failed to load files:', error);
        toast.error(
          isNotImplemented
            ? t('aiChat.cloudPicker.notAvailable', 'Integracje chmurowe nie są dostępne')
            : t('aiChat.cloudPicker.loadError', 'Nie udało się załadować plików')
        );
        setFiles([]);
      } finally {
        setIsLoading(false);
      }
    },
    [provider, t]
  );

  // Load files when modal opens or path changes
  useEffect(() => {
    if (isOpen) {
      const currentFolder = currentPath[currentPath.length - 1];
      loadFiles(currentFolder.id);
    }
  }, [isOpen, currentPath, loadFiles]);

  // Handle folder navigation
  const navigateToFolder = (folder: CloudFile) => {
    setCurrentPath((prev) => [...prev, { id: folder.id, name: folder.name }]);
    setSelectedFile(null);
  };

  // Handle breadcrumb navigation
  const navigateToBreadcrumb = (index: number) => {
    setCurrentPath((prev) => prev.slice(0, index + 1));
    setSelectedFile(null);
  };

  // Handle file click
  const handleFileClick = (file: CloudFile) => {
    if (file.isFolder) {
      navigateToFolder(file);
    } else {
      setSelectedFile(file);
    }
  };

  // Handle file selection
  const handleSelect = () => {
    if (selectedFile && !selectedFile.isFolder) {
      onFileSelect(selectedFile);
      toast.success(t('aiChat.cloudPicker.downloading', { name: selectedFile.name }), {
        duration: 2000,
      });
      onClose();
    }
  };

  // Filter files by search
  const filteredFiles = files.filter(
    (file) =>
      isSupportedChatAttachment(file) && file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[80vh] bg-white dark:bg-navy-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-navy-700">
          <div className="flex items-center gap-3">
            <span className={ProviderColors[provider]}>{ProviderIcons[provider]}</span>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
              {ProviderNames[provider]}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
          >
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-slate-200 dark:border-navy-700 overflow-x-auto">
          {currentPath.map((item, index) => (
            <React.Fragment key={item.id}>
              {index > 0 && <ChevronRight size={14} className="text-slate-600 shrink-0" />}
              <button
                onClick={() => navigateToBreadcrumb(index)}
                className={`text-sm px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors whitespace-nowrap ${
                  index === currentPath.length - 1
                    ? 'text-primary-600 dark:text-primary-400 font-medium'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {item.id === 'root' ? t('common.root', 'Root') : item.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Search */}
        <div className="px-4 py-2 border-b border-slate-200 dark:border-navy-700">
          <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
            {t('aiChat.cloudPicker.supportedTypes', 'Supported in chat: {{types}}', {
              types: SUPPORTED_CHAT_ATTACHMENT_LABEL,
            })}
          </p>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
            <input
              type="text"
              placeholder={t('common.search', 'Szukaj...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-100 dark:bg-navy-700 border-0 rounded-lg focus-visible:ring-2 focus-visible:ring-c-focus text-slate-800 dark:text-slate-200 placeholder-slate-400"
            />
          </div>
        </div>

        {/* File List */}
        <div className="flex-1 overflow-y-auto min-h-[300px]">
          {isLoading ? (
            <LoadingState variant="spinner" className="h-full justify-center" />
          ) : filteredFiles.length === 0 ? (
            <EmptyState
              className="h-full justify-center"
              icon={<Folder />}
              title={t('aiChat.cloudPicker.noFiles', 'Brak plików')}
              description=""
            />
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-navy-700">
              {filteredFiles.map((file) => (
                <button
                  key={file.id}
                  onClick={() => handleFileClick(file)}
                  onDoubleClick={() => file.isFolder && navigateToFolder(file)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    selectedFile?.id === file.id
                      ? 'bg-primary-50 dark:bg-primary-900/20'
                      : 'hover:bg-slate-50 dark:hover:bg-navy-700'
                  }`}
                >
                  {getFileIcon(file.mimeType ?? '', Boolean(file.isFolder))}
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-sm font-medium truncate ${
                        selectedFile?.id === file.id
                          ? 'text-primary-700 dark:text-primary-300'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {file.name}
                    </div>
                    {!file.isFolder && file.modifiedAt && (
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {file.modifiedAt}
                      </div>
                    )}
                  </div>
                  {!file.isFolder && (
                    <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
                      {formatSize(file.size ?? 0)}
                    </span>
                  )}
                  {file.isFolder && <ChevronRight size={16} className="text-slate-600 shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900">
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {selectedFile ? (
              <span className="text-primary-600 dark:text-primary-400">{selectedFile.name}</span>
            ) : (
              t('aiChat.cloudPicker.selectFile', 'Wybierz plik')
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-700 rounded-lg transition-colors"
            >
              {t('common.cancel', 'Anuluj')}
            </button>
            <button
              onClick={handleSelect}
              disabled={!selectedFile || selectedFile.isFolder}
              className="px-4 py-2 text-sm font-medium text-c-bg bg-c-text hover:bg-c-text-secondary disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {t('common.select', 'Wybierz')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CloudFilePicker;
