/**
 * ImageAttachment Component
 *
 * Displays image attachments with preview, remove option, and drag-drop support.
 * Supports paste from clipboard and file upload.
 *
 * FLOW-AI-VISION: Frontend image handling
 */

import { Image, Loader2, X, ZoomIn } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

// ==========================================
// TYPES
// ==========================================

export interface ImageAttachmentData {
  id: string;
  file?: File;
  dataUrl: string;
  name: string;
  size: number;
  mimeType: string;
  width?: number;
  height?: number;
  isProcessing?: boolean;
  error?: string;
}

interface ImageAttachmentProps {
  attachment: ImageAttachmentData;
  onRemove: (id: string) => void;
  onPreview?: (attachment: ImageAttachmentData) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

interface ImageAttachmentListProps {
  attachments: ImageAttachmentData[];
  onRemove: (id: string) => void;
  onPreview?: (attachment: ImageAttachmentData) => void;
  className?: string;
}

interface ImageDropZoneProps {
  onImagesDrop: (images: ImageAttachmentData[]) => void;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

// ==========================================
// UTILS
// ==========================================

/**
 * Generate unique ID for attachment
 */
export function generateAttachmentId(): string {
  return `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Read file as data URL
 */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Get image dimensions from data URL
 */
export function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Create ImageAttachmentData from File
 */
export async function fileToImageAttachment(file: File): Promise<ImageAttachmentData> {
  const id = generateAttachmentId();
  const dataUrl = await readFileAsDataUrl(file);
  const dimensions = await getImageDimensions(dataUrl);

  return {
    id,
    file,
    dataUrl,
    name: file.name,
    size: file.size,
    mimeType: file.type,
    width: dimensions.width,
    height: dimensions.height,
  };
}

/**
 * Create ImageAttachmentData from clipboard item
 */
export async function clipboardToImageAttachment(
  item: ClipboardItem
): Promise<ImageAttachmentData | null> {
  // Find image type
  const imageType = item.types.find((type) => type.startsWith('image/'));
  if (!imageType) return null;

  const blob = await item.getType(imageType);
  const file = new File([blob], `pasted-image-${Date.now()}.${imageType.split('/')[1]}`, {
    type: imageType,
  });

  return fileToImageAttachment(file);
}

// ==========================================
// COMPONENTS
// ==========================================

/**
 * Single image attachment with preview
 */
export const ImageAttachment: React.FC<ImageAttachmentProps> = ({
  attachment,
  onRemove,
  onPreview,
  size = 'md',
  className = '',
}) => {
  const { t } = useTranslation();

  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
  };

  return (
    <div
      className={`
        relative group rounded-lg overflow-hidden border border-slate-200 dark:border-navy-700
        bg-slate-100 dark:bg-navy-800 ${sizeClasses[size]} ${className}
      `}
    >
      {/* Image Preview */}
      {attachment.isProcessing ? (
        <div className="w-full h-full flex items-center justify-center">
          <Loader2 size={20} className="animate-spin text-slate-400" />
        </div>
      ) : attachment.error ? (
        <div className="w-full h-full flex items-center justify-center">
          <Image size={20} className="text-danger-400" />
        </div>
      ) : (
        <img
          src={attachment.dataUrl}
          alt={attachment.name}
          className="w-full h-full object-cover"
        />
      )}

      {/* Overlay on hover */}
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
        {onPreview && (
          <button
            onClick={() => onPreview(attachment)}
            className="p-1 rounded bg-white/20 hover:bg-white/30 text-white transition-colors"
            title={t('aiChat.image.preview', 'Preview')}
          >
            <ZoomIn size={14} />
          </button>
        )}
        <button
          onClick={() => onRemove(attachment.id)}
          className="p-1 rounded bg-white/20 hover:bg-danger-500/80 text-white transition-colors"
          title={t('aiChat.image.remove', 'Remove')}
        >
          <X size={14} />
        </button>
      </div>

      {/* Size indicator */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-1 py-0.5">
        <span className="text-[9px] text-white/80">{formatFileSize(attachment.size)}</span>
      </div>
    </div>
  );
};

/**
 * List of image attachments
 */
export const ImageAttachmentList: React.FC<ImageAttachmentListProps> = ({
  attachments,
  onRemove,
  onPreview,
  className = '',
}) => {
  if (attachments.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {attachments.map((attachment) => (
        <ImageAttachment
          key={attachment.id}
          attachment={attachment}
          onRemove={onRemove}
          onPreview={onPreview}
          size="md"
        />
      ))}
    </div>
  );
};

/**
 * Drop zone for drag-and-drop image upload
 */
export const ImageDropZone: React.FC<ImageDropZoneProps> = ({
  onImagesDrop,
  disabled = false,
  className = '',
  children,
}) => {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragging(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled) return;

      const files = Array.from(e.dataTransfer.files).filter((file) =>
        file.type.startsWith('image/')
      );

      if (files.length === 0) return;

      const attachments: ImageAttachmentData[] = [];
      for (const file of files) {
        try {
          const attachment = await fileToImageAttachment(file);
          attachments.push(attachment);
        } catch (err) {
          console.error('[ImageDropZone] Failed to process file:', err);
        }
      }

      if (attachments.length > 0) {
        onImagesDrop(attachments);
      }
    },
    [disabled, onImagesDrop]
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative transition-colors
        ${isDragging ? 'bg-c-surface-raised dark:bg-c-surface-raised border-c-border' : ''}
        ${className}
      `}
    >
      {children}

      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-c-surface-raised border-2 border-dashed border-c-border rounded-xl">
          <div className="text-center">
            <Image size={32} className="mx-auto mb-2 text-c-text-secondary" />
            <p className="text-sm font-medium text-c-text-secondary dark:text-c-text-secondary">
              {t('aiChat.image.dropHere', 'Drop images here')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Image preview modal
 */
export const ImagePreviewModal: React.FC<{
  attachment: ImageAttachmentData | null;
  onClose: () => void;
}> = ({ attachment, onClose }) => {
  const { t } = useTranslation();

  if (!attachment) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
      onClick={onClose}
    >
      <div className="relative max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <img
          src={attachment.dataUrl}
          alt={attachment.name}
          className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
        />
        <div className="absolute top-2 right-2">
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent rounded-b-lg">
          <p className="text-white text-sm truncate">{attachment.name}</p>
          <p className="text-white/70 text-xs">
            {attachment.width}×{attachment.height} • {formatFileSize(attachment.size)}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ImageAttachment;
