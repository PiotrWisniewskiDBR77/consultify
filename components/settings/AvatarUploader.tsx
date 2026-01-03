/**
 * AvatarUploader - Advanced avatar upload component
 * 
 * Features:
 * - Drag & drop support
 * - File picker fallback
 * - Live preview before upload
 * - Simple cropper with 1:1 aspect ratio
 * - Progress indicator
 * - Integration with existing API
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
    Upload, 
    X, 
    Camera, 
    Loader2, 
    Check, 
    AlertCircle,
    ZoomIn,
    ZoomOut,
    RotateCw,
    Trash2,
    User as UserIcon
} from 'lucide-react';
import { Api } from '../../services/api';
import { User } from '../../types';
import toast from 'react-hot-toast';

interface AvatarUploaderProps {
    currentUser: User;
    onUpdateUser: (updates: Partial<User>) => void;
}

type UploadState = 'idle' | 'dragging' | 'preview' | 'cropping' | 'uploading' | 'success' | 'error';

const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export const AvatarUploader: React.FC<AvatarUploaderProps> = ({ currentUser, onUpdateUser }) => {
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);

    const [uploadState, setUploadState] = useState<UploadState>('idle');
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Crop/zoom controls
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDraggingImage, setIsDraggingImage] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    // Cleanup preview URL on unmount
    useEffect(() => {
        return () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl]);

    const validateFile = useCallback((file: File): string | null => {
        if (!ACCEPTED_TYPES.includes(file.type)) {
            return t('settings.avatar.errorType', 'Please upload a JPEG, PNG, or WebP image');
        }
        if (file.size > MAX_FILE_SIZE) {
            return t('settings.avatar.errorSize', 'File size must be less than 5MB');
        }
        return null;
    }, [t]);

    const handleFileSelect = useCallback((file: File) => {
        const error = validateFile(file);
        if (error) {
            setErrorMessage(error);
            setUploadState('error');
            toast.error(error);
            return;
        }

        setErrorMessage(null);
        setSelectedFile(file);
        
        // Create preview
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
        setUploadState('cropping');
        
        // Reset crop controls
        setZoom(1);
        setRotation(0);
        setPosition({ x: 0, y: 0 });

        // Load image for canvas operations
        const img = new Image();
        img.onload = () => {
            imageRef.current = img;
        };
        img.src = url;
    }, [validateFile]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setUploadState('idle');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelect(files[0]);
        }
    }, [handleFileSelect]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setUploadState('dragging');
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setUploadState('idle');
    }, []);

    const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            handleFileSelect(files[0]);
        }
    }, [handleFileSelect]);

    const openFilePicker = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const cancelUpload = useCallback(() => {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }
        setPreviewUrl(null);
        setSelectedFile(null);
        setUploadState('idle');
        setErrorMessage(null);
        setZoom(1);
        setRotation(0);
        setPosition({ x: 0, y: 0 });
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, [previewUrl]);

    // Crop image and prepare for upload
    const cropAndUpload = useCallback(async () => {
        if (!selectedFile || !imageRef.current || !canvasRef.current) return;

        setUploadState('uploading');
        setUploadProgress(0);

        try {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Canvas context not available');

            const img = imageRef.current;
            const size = 400; // Output size
            canvas.width = size;
            canvas.height = size;

            // Clear canvas
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, size, size);

            // Apply transformations
            ctx.save();
            ctx.translate(size / 2, size / 2);
            ctx.rotate((rotation * Math.PI) / 180);
            ctx.scale(zoom, zoom);
            ctx.translate(position.x, position.y);

            // Calculate dimensions to center crop
            const aspectRatio = img.width / img.height;
            let drawWidth, drawHeight;
            
            if (aspectRatio > 1) {
                drawHeight = size;
                drawWidth = size * aspectRatio;
            } else {
                drawWidth = size;
                drawHeight = size / aspectRatio;
            }

            ctx.drawImage(
                img,
                -drawWidth / 2,
                -drawHeight / 2,
                drawWidth,
                drawHeight
            );
            ctx.restore();

            // Simulate progress for better UX
            const progressInterval = setInterval(() => {
                setUploadProgress(prev => Math.min(prev + 10, 90));
            }, 100);

            // Convert canvas to blob
            const blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob(
                    (b) => b ? resolve(b) : reject(new Error('Failed to create blob')),
                    'image/jpeg',
                    0.9
                );
            });

            // Create file from blob
            const croppedFile = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });

            // Upload to server
            const result = await Api.uploadAvatar(currentUser.id, croppedFile);
            
            clearInterval(progressInterval);
            setUploadProgress(100);

            // Update user with new avatar URL
            onUpdateUser({ avatarUrl: result.avatarUrl });
            
            setUploadState('success');
            toast.success(t('settings.avatar.uploadSuccess', 'Avatar uploaded successfully!'));

            // Reset after delay
            setTimeout(() => {
                cancelUpload();
            }, 1500);

        } catch (error) {
            console.error('Avatar upload failed:', error);
            setUploadState('error');
            setErrorMessage(error instanceof Error ? error.message : 'Upload failed');
            toast.error(t('settings.avatar.uploadError', 'Failed to upload avatar'));
        }
    }, [selectedFile, currentUser.id, zoom, rotation, position, onUpdateUser, cancelUpload, t]);

    // Remove current avatar
    const removeAvatar = useCallback(async () => {
        try {
            await Api.updateUser(currentUser.id, { avatarUrl: null });
            onUpdateUser({ avatarUrl: undefined });
            toast.success(t('settings.avatar.removed', 'Avatar removed'));
        } catch (error) {
            toast.error(t('settings.avatar.removeError', 'Failed to remove avatar'));
        }
    }, [currentUser.id, onUpdateUser, t]);

    // Image drag handlers for positioning
    const handleImageMouseDown = useCallback((e: React.MouseEvent) => {
        if (uploadState !== 'cropping') return;
        setIsDraggingImage(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }, [uploadState, position]);

    const handleImageMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDraggingImage) return;
        setPosition({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        });
    }, [isDraggingImage, dragStart]);

    const handleImageMouseUp = useCallback(() => {
        setIsDraggingImage(false);
    }, []);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                    {t('settings.avatar.title', 'Profile Picture')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t('settings.avatar.subtitle', 'Upload a photo to personalize your profile')}
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Current Avatar Display */}
                <div className="flex flex-col items-center">
                    <div className="relative group">
                        <div className="w-40 h-40 rounded-full overflow-hidden border-4 border-white dark:border-navy-800 shadow-xl bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30">
                            {currentUser.avatarUrl ? (
                                <img 
                                    src={currentUser.avatarUrl} 
                                    alt="Current avatar" 
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <UserIcon size={64} className="text-purple-300 dark:text-purple-600" />
                                </div>
                            )}
                        </div>
                        
                        {/* Quick action overlay */}
                        <button
                            onClick={openFilePicker}
                            className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        >
                            <Camera className="text-white" size={32} />
                        </button>
                    </div>

                    {/* Current avatar actions */}
                    {currentUser.avatarUrl && (
                        <button
                            onClick={removeAvatar}
                            className="mt-4 flex items-center gap-2 text-sm text-red-500 hover:text-red-600 transition-colors"
                        >
                            <Trash2 size={14} />
                            {t('settings.avatar.remove', 'Remove photo')}
                        </button>
                    )}
                </div>

                {/* Upload Area */}
                <div className="space-y-4">
                    {/* Drop Zone (shown when not in preview/crop mode) */}
                    {uploadState !== 'cropping' && uploadState !== 'uploading' && uploadState !== 'success' && (
                        <div
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onClick={openFilePicker}
                            className={`
                                relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200
                                ${uploadState === 'dragging' 
                                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/10 scale-[1.02]' 
                                    : 'border-slate-200 dark:border-white/10 hover:border-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-500/5'
                                }
                                ${uploadState === 'error' ? 'border-red-300 bg-red-50 dark:bg-red-500/10' : ''}
                            `}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept={ACCEPTED_TYPES.join(',')}
                                onChange={handleFileInputChange}
                                className="hidden"
                            />

                            <div className="flex flex-col items-center gap-3">
                                {uploadState === 'error' ? (
                                    <AlertCircle className="w-10 h-10 text-red-500" />
                                ) : (
                                    <div className="w-14 h-14 rounded-full bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center">
                                        <Upload className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                                    </div>
                                )}
                                
                                <div>
                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                        {uploadState === 'error' 
                                            ? errorMessage 
                                            : t('settings.avatar.dragDrop', 'Drag & drop your photo here')
                                        }
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        {t('settings.avatar.orClick', 'or click to browse')}
                                    </p>
                                </div>

                                <p className="text-xs text-slate-400">
                                    {t('settings.avatar.formats', 'JPEG, PNG, WebP up to 5MB')}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Crop Preview */}
                    {uploadState === 'cropping' && previewUrl && (
                        <div className="space-y-4">
                            <div 
                                className="relative w-64 h-64 mx-auto rounded-xl overflow-hidden bg-slate-100 dark:bg-navy-800 border border-slate-200 dark:border-white/10 cursor-move"
                                onMouseDown={handleImageMouseDown}
                                onMouseMove={handleImageMouseMove}
                                onMouseUp={handleImageMouseUp}
                                onMouseLeave={handleImageMouseUp}
                            >
                                {/* Preview image with transforms */}
                                <div 
                                    className="absolute inset-0 flex items-center justify-center"
                                    style={{
                                        transform: `scale(${zoom}) rotate(${rotation}deg) translate(${position.x}px, ${position.y}px)`,
                                        transition: isDraggingImage ? 'none' : 'transform 0.1s ease'
                                    }}
                                >
                                    <img 
                                        src={previewUrl} 
                                        alt="Preview" 
                                        className="max-w-none"
                                        draggable={false}
                                    />
                                </div>

                                {/* Circular crop overlay */}
                                <div className="absolute inset-0 pointer-events-none">
                                    <svg className="w-full h-full">
                                        <defs>
                                            <mask id="crop-mask">
                                                <rect width="100%" height="100%" fill="white" />
                                                <circle cx="50%" cy="50%" r="45%" fill="black" />
                                            </mask>
                                        </defs>
                                        <rect 
                                            width="100%" 
                                            height="100%" 
                                            fill="rgba(0,0,0,0.5)" 
                                            mask="url(#crop-mask)" 
                                        />
                                        <circle 
                                            cx="50%" 
                                            cy="50%" 
                                            r="45%" 
                                            fill="none" 
                                            stroke="white" 
                                            strokeWidth="2" 
                                            strokeDasharray="4 4"
                                        />
                                    </svg>
                                </div>
                            </div>

                            {/* Crop Controls */}
                            <div className="flex items-center justify-center gap-4">
                                {/* Zoom */}
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}
                                        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                                        title="Zoom out"
                                    >
                                        <ZoomOut size={18} className="text-slate-600 dark:text-slate-300" />
                                    </button>
                                    <input
                                        type="range"
                                        min="0.5"
                                        max="3"
                                        step="0.1"
                                        value={zoom}
                                        onChange={(e) => setZoom(parseFloat(e.target.value))}
                                        className="w-24 accent-purple-600"
                                    />
                                    <button 
                                        onClick={() => setZoom(z => Math.min(3, z + 0.1))}
                                        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                                        title="Zoom in"
                                    >
                                        <ZoomIn size={18} className="text-slate-600 dark:text-slate-300" />
                                    </button>
                                </div>

                                {/* Rotate */}
                                <button 
                                    onClick={() => setRotation(r => (r + 90) % 360)}
                                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                                    title="Rotate"
                                >
                                    <RotateCw size={18} className="text-slate-600 dark:text-slate-300" />
                                </button>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center justify-center gap-3">
                                <button
                                    onClick={cancelUpload}
                                    className="px-4 py-2 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                                >
                                    {t('common.cancel', 'Cancel')}
                                </button>
                                <button
                                    onClick={cropAndUpload}
                                    className="px-6 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium transition-colors flex items-center gap-2"
                                >
                                    <Upload size={16} />
                                    {t('settings.avatar.upload', 'Upload')}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Uploading State */}
                    {uploadState === 'uploading' && (
                        <div className="flex flex-col items-center gap-4 py-8">
                            <Loader2 className="w-10 h-10 text-purple-600 animate-spin" />
                            <div className="w-full max-w-xs">
                                <div className="h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-purple-600 transition-all duration-300"
                                        style={{ width: `${uploadProgress}%` }}
                                    />
                                </div>
                                <p className="text-sm text-slate-500 mt-2 text-center">
                                    {t('settings.avatar.uploading', 'Uploading...')} {uploadProgress}%
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Success State */}
                    {uploadState === 'success' && (
                        <div className="flex flex-col items-center gap-3 py-8">
                            <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center">
                                <Check className="w-7 h-7 text-green-600 dark:text-green-400" />
                            </div>
                            <p className="text-sm font-medium text-green-600 dark:text-green-400">
                                {t('settings.avatar.uploadSuccess', 'Avatar uploaded successfully!')}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Hidden canvas for image processing */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Tips */}
            <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-100 dark:border-white/5">
                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    {t('settings.avatar.tips', 'Tips for a great profile photo')}
                </h4>
                <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                    <li>• {t('settings.avatar.tip1', 'Use a recent photo where your face is clearly visible')}</li>
                    <li>• {t('settings.avatar.tip2', 'Square images work best (1:1 aspect ratio)')}</li>
                    <li>• {t('settings.avatar.tip3', 'Minimum recommended size: 200x200 pixels')}</li>
                    <li>• {t('settings.avatar.tip4', 'Professional headshots create a better impression')}</li>
                </ul>
            </div>
        </div>
    );
};

export default AvatarUploader;







