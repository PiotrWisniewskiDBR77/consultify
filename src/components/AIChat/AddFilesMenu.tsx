/**
 * AddFilesMenu
 *
 * File upload menu with cloud storage integrations (like OpenAI):
 * - Upload from device
 * - Google Drive
 * - OneDrive
 * - Dropbox
 *
 * @version 2.0.0
 */

import { Cloud, HardDrive, Link2, Plus, Settings } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import type { CloudProviderId } from '../../hooks/useCloudIntegrations';

// Cloud provider configurations
interface CloudProvider {
  id: CloudProviderId;
  name: string;
  icon: string; // SVG path or emoji
  color: string;
  connected: boolean;
}

interface AddFilesMenuProps {
  onFileSelect: (files: File[]) => void;
  onCloudFileSelect?: (provider: CloudProviderId, fileId: string, fileName: string) => void;
  onConnectCloud?: (provider: CloudProviderId) => void;
  connectedProviders?: CloudProviderId[];
  disabled?: boolean;
}

// Cloud provider icons (simplified SVG-like representations)
const CloudIcons: Record<string, React.ReactNode> = {
  'google-drive': (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
      <path d="M7.71 3.5L1.15 15l4.58 7.5h13.14L15.29 15l6.56-11.5H7.71zm-.29 1h5.79l-5.5 9.5H2.79l4.63-9.5zm6.79 0h5.5l-4.79 8.5-2.79-4.79L14.21 4.5zm-6 10.5h5.58l2.79 4.5H7.71l.5-4.5z" />
    </svg>
  ),
  onedrive: (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
      <path d="M10.5 18.5h8.25a3.75 3.75 0 001.41-7.23 5.25 5.25 0 00-10.32 0A3.75 3.75 0 0010.5 18.5z" />
      <path
        d="M6.75 18.5h1.5a4.5 4.5 0 018.68-1.66 3 3 0 00-3.18-4.59 6 6 0 00-11.5 1.5A4.5 4.5 0 006.75 18.5z"
        opacity="0.7"
      />
    </svg>
  ),
  dropbox: (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
      <path d="M6 2l6 3.75L6 9.5 0 5.75 6 2zm12 0l6 3.75-6 3.75-6-3.75L18 2zM0 13.25L6 9.5l6 3.75-6 3.75-6-3.75zm18-3.75l6 3.75-6 3.75-6-3.75 6-3.75zM6 18.25l6-3.75 6 3.75-6 3.75-6-3.75z" />
    </svg>
  ),
};

const CLOUD_PROVIDERS: CloudProvider[] = [
  {
    id: 'google-drive',
    name: 'Google Drive',
    icon: 'google-drive',
    color: 'text-green-500',
    connected: false,
  },
  {
    id: 'onedrive',
    name: 'OneDrive',
    icon: 'onedrive',
    color: 'text-blue-500',
    connected: false,
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    icon: 'dropbox',
    color: 'text-blue-600',
    connected: false,
  },
];

export const AddFilesMenu: React.FC<AddFilesMenuProps> = ({
  onFileSelect,
  onCloudFileSelect,
  onConnectCloud,
  connectedProviders = [],
  disabled = false,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Merge connected status with providers
  const providers = CLOUD_PROVIDERS.map((p) => ({
    ...p,
    connected: connectedProviders.includes(p.id),
  }));

  const connectedCount = providers.filter((p) => p.connected).length;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      onFileSelect(files);
      setIsOpen(false);
      toast.success(
        files.length === 1 ? `Dodano: ${files[0].name}` : `Dodano ${files.length} plików`,
        { duration: 2000 }
      );
    }
  };

  const handleCloudClick = (provider: CloudProvider) => {
    if (provider.connected) {
      // Open file picker for this provider
      onCloudFileSelect?.(provider.id, '', '');
      toast.success(`Otwieranie ${provider.name}...`, { duration: 1500 });
    } else {
      // Prompt to connect
      onConnectCloud?.(provider.id);
      toast(`Przekierowanie do ustawień integracji`, { icon: '🔗', duration: 2000 });
    }
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          p-2 rounded-lg transition-colors
          ${connectedCount > 0 ? 'text-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'}
          ${disabled ? 'cursor-not-allowed opacity-50' : ''}
        `}
        title={t('aiChat.menu.addFiles', 'Dodaj pliki')}
      >
        <Plus size={20} />
      </button>

      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        multiple
        accept=".pdf,.doc,.docx,.txt,.csv,.xlsx,.xls,.pptx,.ppt,.md,.json"
        onChange={handleFileChange}
      />

      {isOpen && (
        <div className="absolute left-0 bottom-full mb-2 z-50 w-64 py-1 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl shadow-xl animate-in fade-in-0 slide-in-from-bottom-2 duration-150">
          {/* Upload from device */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
          >
            <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-navy-700">
              <HardDrive size={14} className="text-slate-500 dark:text-slate-400" />
            </div>
            <div className="flex-1 font-medium">
              {t('aiChat.menu.uploadFromDevice', 'Z urządzenia')}
            </div>
          </button>

          {/* Divider */}
          <div className="my-2 border-t border-slate-200 dark:border-navy-700" />

          {/* Cloud Storage Header */}
          <div className="px-3 py-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {t('aiChat.menu.cloudStorage', 'Chmura')}
            </span>
            {connectedCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 font-medium">
                {connectedCount} {t('common.connected', 'połączone')}
              </span>
            )}
          </div>

          {/* Cloud Providers */}
          {providers.map((provider) => (
            <button
              key={provider.id}
              onClick={() => handleCloudClick(provider)}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
            >
              <div
                className={`p-1.5 rounded-lg ${provider.connected ? 'bg-green-50 dark:bg-green-900/20' : 'bg-slate-100 dark:bg-navy-700'}`}
              >
                <span
                  className={
                    provider.connected ? provider.color : 'text-slate-400 dark:text-slate-500'
                  }
                >
                  {CloudIcons[provider.icon]}
                </span>
              </div>
              <div className="flex-1 text-left">
                <div
                  className={`font-medium ${provider.connected ? 'text-slate-700 dark:text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}
                >
                  {provider.name}
                </div>
              </div>
              {provider.connected ? (
                <Cloud size={14} className="text-green-500" />
              ) : (
                <Link2 size={14} className="text-slate-400 dark:text-slate-500" />
              )}
            </button>
          ))}

          {/* Connect more hint */}
          {connectedCount < providers.length && (
            <>
              <div className="my-2 border-t border-slate-200 dark:border-navy-700" />
              <div className="px-3 py-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Settings size={12} />
                <span>
                  {t('aiChat.menu.connectInSettings', 'Połącz więcej w Ustawieniach → Integracje')}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AddFilesMenu;
