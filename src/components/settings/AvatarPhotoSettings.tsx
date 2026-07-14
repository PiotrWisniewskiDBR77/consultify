/**
 * AvatarPhotoSettings - Full avatar and photo management page
 *
 * Features:
 * - Large avatar preview
 * - Upload new photo with drag & drop
 * - Remove photo option
 * - Photo guidelines (formats, size)
 * - Crop/edit functionality
 */

import {
  AlertCircle,
  Camera,
  Check,
  Image,
  Loader2,
  Save,
  Trash2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { User } from '../../types';
import { normalizeApiErrorMessage } from '../../utils/apiError';

interface AvatarPhotoSettingsProps {
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

const ALLOWED_FORMATS = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const avatarMatchesUpload = (
  persistedUser: User | null,
  avatarUrl: string | undefined
): persistedUser is User => Boolean(avatarUrl) && persistedUser?.avatarUrl === avatarUrl;

const avatarMatchesRemoval = (persistedUser: User | null): persistedUser is User =>
  persistedUser !== null && !persistedUser.avatarUrl;

export const AvatarPhotoSettings: React.FC<AvatarPhotoSettingsProps> = ({
  currentUser,
  onUpdateUser,
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const currentAvatar = previewUrl || currentUser?.avatarUrl;

  const validateFile = useCallback(
    (file: File): string | null => {
      if (!ALLOWED_FORMATS.includes(file.type)) {
        return t(
          'settings.avatar.invalidFormat',
          'Invalid file format. Please use JPG, PNG, GIF or WebP.'
        );
      }
      if (file.size > MAX_FILE_SIZE) {
        return t('settings.avatar.fileTooLarge', 'File is too large. Maximum size is 5MB.');
      }
      return null;
    },
    [t]
  );

  const handleFileSelect = useCallback(
    (file: File) => {
      setError(null);
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    },
    [validateFile]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleUpload = async () => {
    if (!selectedFile || !currentUser?.id) return;

    setIsUploading(true);
    setError(null);

    try {
      const result = await Api.uploadAvatar(currentUser.id, selectedFile);
      const persistedUser = await Api.getMe();
      if (!avatarMatchesUpload(persistedUser, result.avatarUrl)) {
        throw new Error('Profile photo upload was not confirmed by the server');
      }
      onUpdateUser(persistedUser);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(null);
      setSelectedFile(null);
      toast.success(t('settings.avatar.uploadSuccess', 'Profile photo updated successfully!'));
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(
        err,
        t('settings.avatar.uploadError', 'Failed to upload photo')
      );
      setError(message);
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!currentUser?.id) return;

    setIsRemoving(true);
    setError(null);

    try {
      await Api.removeAvatar(currentUser.id);
      const persistedUser = await Api.getMe();
      if (!avatarMatchesRemoval(persistedUser)) {
        throw new Error('Profile photo removal was not confirmed by the server');
      }
      onUpdateUser(persistedUser);
      setPreviewUrl(null);
      setSelectedFile(null);
      toast.success(t('settings.avatar.removeSuccess', 'Profile photo removed'));
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(
        err,
        t('settings.avatar.removeError', 'Failed to remove photo')
      );
      setError(message);
      toast.error(message);
    } finally {
      setIsRemoving(false);
    }
  };

  const handleCancel = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setSelectedFile(null);
    setError(null);
    setZoom(1);
  };

  const getInitials = () => {
    const firstName = currentUser?.firstName || '';
    const lastName = currentUser?.lastName || '';
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || '?';
  };

  return (
    <div className="space-y-8">
      {/* Avatar Preview Section */}
      <div className="bg-c-surface-raised rounded-xl p-8">
        <div className="flex flex-col items-center">
          {/* Large Avatar */}
          <div
            className="relative w-48 h-48 rounded-full overflow-hidden bg-gradient-to-br from-brand/20 to-c-accent-soft border-4 border-white dark:border-navy-700 shadow-xl"
            style={{ transform: `scale(${zoom})` }}
          >
            {currentAvatar ? (
              <img
                src={currentAvatar}
                alt={t('settings.avatar.preview', 'Avatar preview')}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand to-c-accent-soft">
                <span className="text-5xl font-bold text-white">{getInitials()}</span>
              </div>
            )}

            {/* Upload overlay on hover */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
            >
              <div className="text-center text-white">
                <Camera className="w-10 h-10 mx-auto mb-2" />
                <span className="text-sm font-medium">
                  {t('settings.avatar.changePhoto', 'Change Photo')}
                </span>
              </div>
            </button>
          </div>

          {/* User info below avatar */}
          <div className="mt-6 text-center">
            <h3 className="text-xl font-semibold text-c-text">
              {currentUser?.firstName} {currentUser?.lastName}
            </h3>
            <p className="text-c-text-muted">{currentUser?.email}</p>
          </div>

          {/* Zoom controls (when preview active) */}
          {selectedFile && (
            <div className="flex items-center gap-4 mt-4">
              <button
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
                className="p-2 rounded-lg bg-c-surface-raised hover:bg-c-surface-raised dark:hover:bg-navy-600 transition-colors"
              >
                <ZoomOut size={18} />
              </button>
              <span className="text-sm text-c-text-secondary">{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
                className="p-2 rounded-lg bg-c-surface-raised hover:bg-c-surface-raised dark:hover:bg-navy-600 transition-colors"
              >
                <ZoomIn size={18} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-3 p-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-xl text-danger-600 dark:text-danger-400"
        >
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Upload Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !selectedFile && fileInputRef.current?.click()}
        aria-label="Upload profile photo"
        className={`
                    relative p-8 border-2 border-dashed rounded-xl text-center cursor-pointer
                    transition-all duration-200
                    ${
                      isDragging
                        ? 'border-brand bg-brand/5 dark:bg-brand/10'
                        : 'border-c-border-subtle dark:border-navy-600 hover:border-brand hover:bg-c-surface-raised dark:hover:bg-navy-800/50'
                    }
                `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_FORMATS.join(',')}
          onChange={handleInputChange}
          className="hidden"
        />

        {selectedFile ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3">
              <Check className="text-green-500" size={24} />
              <span className="text-c-text font-medium">{selectedFile.name}</span>
              <span className="text-c-text-muted text-sm">
                ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
              </span>
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancel();
                }}
                className="px-4 py-2 rounded-lg bg-c-surface-raised text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-navy-600 transition-colors"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleUpload();
                }}
                disabled={isUploading}
                className="px-4 py-2 rounded-lg bg-navy-900 dark:bg-[#F4F7FB] text-white dark:text-navy-950 hover:bg-navy-800 dark:hover:bg-[#DDE5EF] transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    {t('settings.avatar.uploading', 'Uploading...')}
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    {t('settings.avatar.savePhoto', 'Save Photo')}
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="w-16 h-16 mx-auto rounded-full bg-brand/10 dark:bg-brand/20 flex items-center justify-center">
              <Upload className="text-brand" size={28} />
            </div>
            <div>
              <p className="text-c-text font-medium">
                {t('settings.avatar.dropzone', 'Drop your photo here or click to browse')}
              </p>
              <p className="text-sm text-c-text-muted mt-1">
                {t('settings.avatar.formats', 'Supports JPG, PNG, GIF, WebP up to 5MB')}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Photo Guidelines */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <Image className="text-blue-600 dark:text-blue-400 mt-0.5" size={20} />
          <div>
            <h4 className="font-medium text-blue-900 dark:text-blue-300">
              {t('settings.avatar.guidelines', 'Photo Guidelines')}
            </h4>
            <ul className="mt-2 space-y-1 text-sm text-blue-700 dark:text-blue-400">
              <li>
                • {t('settings.avatar.guideline1', 'Use a clear, well-lit photo of your face')}
              </li>
              <li>• {t('settings.avatar.guideline2', 'Square images work best (1:1 ratio)')}</li>
              <li>
                • {t('settings.avatar.guideline3', 'Minimum recommended size: 400x400 pixels')}
              </li>
              <li>
                •{' '}
                {t(
                  'settings.avatar.guideline4',
                  'Professional photos help build trust with your team'
                )}
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Remove Photo Section */}
      {currentUser?.avatarUrl && !selectedFile && (
        <div className="border border-danger-200 dark:border-danger-800/50 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-c-text">
                {t('settings.avatar.removeTitle', 'Remove Profile Photo')}
              </h4>
              <p className="text-sm text-c-text-muted mt-1">
                {t('settings.avatar.removeDesc', 'Your initials will be displayed instead')}
              </p>
            </div>
            <button
              onClick={handleRemove}
              disabled={isRemoving}
              className="px-4 py-2 rounded-lg border border-danger-300 dark:border-danger-700 text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isRemoving ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}
              {t('settings.avatar.remove', 'Remove Photo')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AvatarPhotoSettings;
