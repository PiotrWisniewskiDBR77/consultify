/**
 * LevelAttachments Component
 * 
 * Displays and manages file attachments for a specific assessment level.
 * Allows uploading, viewing, and deleting evidence documents.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
    Paperclip, Upload, X, FileText, Image, File, 
    Download, Trash2, Loader2, Plus, Eye 
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAssessmentAttachments, LevelAttachment } from '../../hooks/useAssessmentAttachments';

interface LevelAttachmentsProps {
    assessmentId: string;
    axisId: string;
    levelNumber: number;
    areaId?: string;
    readOnly?: boolean;
    compact?: boolean;
}

const ATTACHMENT_TYPES = [
    { value: 'EVIDENCE', label: 'Dowód' },
    { value: 'SCREENSHOT', label: 'Zrzut ekranu' },
    { value: 'DOCUMENT', label: 'Dokument' },
    { value: 'REPORT', label: 'Raport' },
    { value: 'OTHER', label: 'Inne' }
] as const;

const getFileIcon = (mimeType: string) => {
    if (mimeType?.startsWith('image/')) return Image;
    if (mimeType?.includes('pdf') || mimeType?.includes('document')) return FileText;
    return File;
};

const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const LevelAttachments: React.FC<LevelAttachmentsProps> = ({
    assessmentId,
    axisId,
    levelNumber,
    areaId,
    readOnly = false,
    compact = false
}) => {
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [attachments, setAttachments] = useState<LevelAttachment[]>([]);
    const [isExpanded, setIsExpanded] = useState(false);
    const [selectedType, setSelectedType] = useState<LevelAttachment['attachmentType']>('EVIDENCE');
    const [description, setDescription] = useState('');
    const [showUploadForm, setShowUploadForm] = useState(false);

    const {
        uploadAttachment,
        getAttachments,
        deleteAttachment,
        getDownloadUrl,
        isUploading,
        isDeleting,
        error
    } = useAssessmentAttachments({ assessmentId });

    // Fetch attachments on mount and when dependencies change
    const fetchAttachments = useCallback(async () => {
        const result = await getAttachments(axisId, levelNumber, areaId);
        if (result) {
            setAttachments(result.attachments);
        }
    }, [getAttachments, axisId, levelNumber, areaId]);

    useEffect(() => {
        if (assessmentId) {
            fetchAttachments();
        }
    }, [assessmentId, fetchAttachments]);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const result = await uploadAttachment(file, axisId, levelNumber, {
            areaId,
            attachmentType: selectedType,
            description: description || undefined
        });

        if (result) {
            setAttachments(prev => [result, ...prev]);
            setDescription('');
            setShowUploadForm(false);
        }

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleDelete = async (attachmentId: string) => {
        if (window.confirm('Czy na pewno chcesz usunąć ten załącznik?')) {
            const success = await deleteAttachment(attachmentId);
            if (success) {
                setAttachments(prev => prev.filter(a => a.id !== attachmentId));
            }
        }
    };

    const handleDownload = (attachment: LevelAttachment) => {
        window.open(getDownloadUrl(attachment.id), '_blank');
    };

    // Compact mode - just show count and expand button
    if (compact && !isExpanded) {
        return (
            <div className="flex items-center gap-2">
                <button
                    onClick={() => setIsExpanded(true)}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-purple-500 transition-colors"
                >
                    <Paperclip size={14} />
                    <span>
                        {attachments.length > 0 
                            ? `${attachments.length} załącznik${attachments.length === 1 ? '' : attachments.length < 5 ? 'i' : 'ów'}`
                            : 'Dodaj załącznik'
                        }
                    </span>
                </button>
            </div>
        );
    }

    return (
        <div className="w-full mt-4 border-t border-slate-200 dark:border-white/5 pt-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <Paperclip size={14} />
                    <span>Załączniki ({attachments.length})</span>
                </div>
                
                {!readOnly && (
                    <button
                        onClick={() => setShowUploadForm(!showUploadForm)}
                        className="flex items-center gap-1.5 text-xs font-medium text-purple-500 hover:text-purple-600 transition-colors"
                    >
                        <Plus size={14} />
                        Dodaj
                    </button>
                )}

                {compact && (
                    <button
                        onClick={() => setIsExpanded(false)}
                        className="text-slate-400 hover:text-slate-600"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>

            {/* Upload Form */}
            {showUploadForm && !readOnly && (
                <div className="mb-4 p-3 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10">
                    <div className="space-y-3">
                        {/* Type Selection */}
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Typ załącznika</label>
                            <select
                                value={selectedType}
                                onChange={(e) => setSelectedType(e.target.value as LevelAttachment['attachmentType'])}
                                className="w-full text-sm bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-md px-2 py-1.5"
                            >
                                {ATTACHMENT_TYPES.map(type => (
                                    <option key={type.value} value={type.value}>{type.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Opis (opcjonalnie)</label>
                            <input
                                type="text"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Krótki opis załącznika..."
                                className="w-full text-sm bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-md px-2 py-1.5"
                            />
                        </div>

                        {/* File Input */}
                        <div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                onChange={handleFileSelect}
                                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.csv,.txt,.json"
                                className="hidden"
                                disabled={isUploading}
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-300 text-white text-sm font-medium rounded-md transition-colors"
                            >
                                {isUploading ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Przesyłanie...
                                    </>
                                ) : (
                                    <>
                                        <Upload size={16} />
                                        Wybierz plik
                                    </>
                                )}
                            </button>
                        </div>

                        <p className="text-[10px] text-slate-400">
                            Dozwolone: PDF, Word, Excel, PowerPoint, obrazy, CSV, TXT, JSON (max 25MB)
                        </p>
                    </div>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs rounded-md">
                    {error}
                </div>
            )}

            {/* Attachments List */}
            {attachments.length > 0 ? (
                <div className="space-y-2">
                    {attachments.map((attachment) => {
                        const FileIcon = getFileIcon(attachment.mimeType);
                        const isCurrentDeleting = isDeleting === attachment.id;

                        return (
                            <div
                                key={attachment.id}
                                className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10 hover:border-purple-300 dark:hover:border-purple-500/30 transition-colors group"
                            >
                                {/* Icon */}
                                <div className="shrink-0 w-8 h-8 rounded-md bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 flex items-center justify-center">
                                    <FileIcon size={16} className="text-slate-500" />
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                                        {attachment.fileName}
                                    </p>
                                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                        <span>{formatFileSize(attachment.fileSize)}</span>
                                        <span>•</span>
                                        <span>{ATTACHMENT_TYPES.find(t => t.value === attachment.attachmentType)?.label || attachment.attachmentType}</span>
                                        {attachment.description && (
                                            <>
                                                <span>•</span>
                                                <span className="truncate">{attachment.description}</span>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => handleDownload(attachment)}
                                        className="p-1.5 text-slate-400 hover:text-blue-500 transition-colors"
                                        title="Pobierz"
                                    >
                                        <Download size={14} />
                                    </button>
                                    
                                    {!readOnly && (
                                        <button
                                            onClick={() => handleDelete(attachment.id)}
                                            disabled={isCurrentDeleting}
                                            className="p-1.5 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
                                            title="Usuń"
                                        >
                                            {isCurrentDeleting ? (
                                                <Loader2 size={14} className="animate-spin" />
                                            ) : (
                                                <Trash2 size={14} />
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-4 text-sm text-slate-400">
                    Brak załączników dla tego poziomu
                </div>
            )}
        </div>
    );
};

export default LevelAttachments;



