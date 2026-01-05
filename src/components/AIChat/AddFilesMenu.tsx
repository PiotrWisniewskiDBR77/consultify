import { FileIcon, Plus } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface AddFilesMenuProps {
    onFileSelect: (files: File[]) => void;
    onPmoImport?: (type: string, data: any) => void;
    disabled?: boolean;
}

export const AddFilesMenu: React.FC<AddFilesMenuProps> = ({ onFileSelect, onPmoImport, disabled = false }) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
            onFileSelect(Array.from(e.target.files));
            setIsOpen(false);
        }
    };

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                disabled={disabled}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                title={t('aiChat.menu.addFiles', 'Add Files')}
            >
                <Plus size={20} />
            </button>

            <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileChange} />

            {isOpen && (
                <div className="absolute left-0 bottom-full mb-2 z-50 w-48 py-1 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl shadow-xl animate-in fade-in-0 slide-in-from-bottom-2 duration-150">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
                    >
                        <FileIcon size={16} className="text-slate-400" />
                        {t('aiChat.menu.uploadFiles', 'Upload Files')}
                    </button>
                    {onPmoImport && (
                        <>
                            <div className="my-1 border-t border-slate-200 dark:border-navy-700" />
                            <button
                                onClick={() => {
                                    onPmoImport('assessment', {});
                                    setIsOpen(false);
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
                            >
                                <span className="text-xs text-primary-500 font-bold">PMO</span>
                                {t('aiChat.menu.importAssessment', 'Import Assessment')}
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default AddFilesMenu;
