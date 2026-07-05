/**
 * AvatarUploader - Upload and manage user avatar
 */

import { Camera, Upload } from 'lucide-react';
import React, { useRef } from 'react';

interface AvatarUploaderProps {
  currentAvatar?: string;
  onUpload?: (file: File) => void;
  size?: 'sm' | 'md' | 'lg';
  currentUser?: any;
  onUpdateUser?: (updates: any) => void;
}

export const AvatarUploader: React.FC<AvatarUploaderProps> = ({
  currentAvatar,
  onUpload,
  size = 'md',
  currentUser,
  onUpdateUser,
}) => {
  // Use currentUser's avatar if currentAvatar not provided
  const avatar = currentAvatar || currentUser?.avatarUrl;
  const inputRef = useRef<HTMLInputElement>(null);

  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32',
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (onUpload) {
        onUpload(file);
      } else if (onUpdateUser) {
        // Create object URL for preview
        const url = URL.createObjectURL(file);
        onUpdateUser({ avatarUrl: url });
      }
    }
  };

  return (
    <div className="relative inline-block">
      <div
        className={`${sizeClasses[size]} rounded-full overflow-hidden bg-c-surface-raised flex items-center justify-center`}
      >
        {currentAvatar ? (
          <img src={currentAvatar} alt="Avatar" className="w-full h-full object-cover" />
        ) : (
          <Camera className="w-8 h-8 text-c-text-muted" />
        )}
      </div>
      <button
        onClick={() => inputRef.current?.click()}
        className="absolute bottom-0 right-0 bg-blue-500 text-white rounded-full p-2 shadow-lg hover:bg-blue-600 transition-colors"
      >
        <Upload className="w-4 h-4" />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
};

export default AvatarUploader;
