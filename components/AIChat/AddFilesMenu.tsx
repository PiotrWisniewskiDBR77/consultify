/**
 * AddFilesMenu
 * 
 * Dropdown menu for adding files and importing PMO data.
 */

import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
    Plus, 
    Upload, 
    Clipboard, 
    Link, 
    Target,
    Lightbulb,
    Map,
    FileText
} from 'lucide-react';

interface AddFilesMenuProps {
    onFileSelect: (files: File[]) => void;
    onPmoImport: (type: string, data: any) => void;
    disabled?: boolean;
}

const MENU_ITEMS = [
    { 
        id: 'upload', 
        icon: Upload, 
        labelKey: 'aiChat.menu.uploadFile', 
        label: 'Upload File',
        accept: '.pdf,.docx,.xlsx,.csv,.txt,.json'
    },
    { 
        id: 'paste', 
        icon: Clipboard, 
        labelKey: 'aiChat.menu.pasteContent', 
        label: 'Paste Content'
    },
    { 
        id: 'link', 
        icon: Link, 
        labelKey: 'aiChat.menu.addLink', 
        label: 'Add Link / URL'
    },
    { divider: true },
    { 
        id: 'import-assessment', 
        icon: Target, 
        labelKey: 'aiChat.menu.importAssessment', 
        label: 'Import Assessment',
        pmo: true 
    },
    { 
        id: 'import-initiative', 
        icon: Lightbulb, 
        labelKey: 'aiChat.menu.importInitiative', 
        label: 'Import Initiative',
        pmo: true 
    },
    { 
        id: 'import-roadmap', 
        icon: Map, 
        labelKey: 'aiChat.menu.importRoadmap', 
        label: 'Import Roadmap',
        pmo: true 
    },
    { 
        id: 'import-report', 
        icon: FileText, 
        labelKey: 'aiChat.menu.importReport', 
        label: 'Import Report',
        pmo: true 
    }
];

export const AddFilesMenu: React.FC<AddFilesMenuProps> = ({
    onFileSelect,
    onPmoImport,
    disabled = false
}) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [showLinkInput, setShowLinkInput] = useState(false);
    const [linkValue, setLinkValue] = useState('');
    const menuRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Handle click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setShowLinkInput(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleItemClick = (item: typeof MENU_ITEMS[0]) => {
        if ('divider' in item) return;

        switch (item.id) {
            case 'upload':
                fileInputRef.current?.click();
                setIsOpen(false);
                break;
            case 'paste':
                navigator.clipboard.readText().then(text => {
                    if (text) {
                        // Create a pseudo-file from clipboard content
                        const blob = new Blob([text], { type: 'text/plain' });
                        const file = new File([blob], 'clipboard.txt', { type: 'text/plain' });
                        onFileSelect([file]);
                    }
                });
                setIsOpen(false);
                break;
            case 'link':
                setShowLinkInput(true);
                break;
            case 'import-assessment':
            case 'import-initiative':
            case 'import-roadmap':
            case 'import-report':
                // TODO: Open picker modal for PMO data
                onPmoImport(item.id.replace('import-', ''), {});
                setIsOpen(false);
                break;
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            onFileSelect(files);
        }
        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleLinkSubmit = () => {
        if (linkValue.trim()) {
            // Create a pseudo-file for the URL
            const blob = new Blob([linkValue], { type: 'text/uri-list' });
            const file = new File([blob], 'link.url', { type: 'text/uri-list' });
            onFileSelect([file]);
            setLinkValue('');
            setShowLinkInput(false);
            setIsOpen(false);
        }
    };

    return (
        <div className="relative" ref={menuRef}>
            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.xlsx,.csv,.txt,.json"
                onChange={handleFileChange}
                className="hidden"
            />

            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                disabled={disabled}
                className={`
                    p-2 rounded-lg transition-colors
                    text-slate-400 hover:text-slate-600 dark:hover:text-slate-300
                    hover:bg-slate-100 dark:hover:bg-white/5
                    ${disabled ? 'cursor-not-allowed opacity-50' : ''}
                `}
                title={t('aiChat.menu.addFiles', 'Add Files & Media')}
            >
                <Plus size={20} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="
                    absolute left-0 bottom-full mb-2 z-50
                    w-56 py-1
                    bg-white dark:bg-navy-800
                    border border-slate-200 dark:border-navy-700
                    rounded-xl shadow-xl
                    animate-in fade-in-0 slide-in-from-bottom-2 duration-150
                ">
                    {/* Link Input */}
                    {showLinkInput ? (
                        <div className="p-3">
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                                {t('aiChat.menu.enterUrl', 'Enter URL')}
                            </p>
                            <div className="flex gap-2">
                                <input
                                    type="url"
                                    value={linkValue}
                                    onChange={(e) => setLinkValue(e.target.value)}
                                    placeholder="https://..."
                                    className="
                                        flex-1 px-2 py-1.5 text-sm
                                        bg-slate-50 dark:bg-navy-900
                                        border border-slate-200 dark:border-navy-700
                                        rounded-lg
                                        text-navy-900 dark:text-white
                                        focus:outline-none focus:ring-2 focus:ring-primary-500/50
                                    "
                                    autoFocus
                                    onKeyDown={(e) => e.key === 'Enter' && handleLinkSubmit()}
                                />
                                <button
                                    onClick={handleLinkSubmit}
                                    className="px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-500"
                                >
                                    {t('common.add', 'Add')}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Menu Header */}
                            <div className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                {t('aiChat.menu.addFiles', 'Add Files & Media')}
                            </div>

                            {/* Menu Items */}
                            {MENU_ITEMS.map((item, idx) => {
                                if ('divider' in item && item.divider) {
                                    return (
                                        <div key={idx} className="my-1">
                                            <div className="border-t border-slate-200 dark:border-navy-700" />
                                            <div className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                {t('aiChat.menu.fromPmo', 'From Your PMO Data')}
                                            </div>
                                        </div>
                                    );
                                }

                                const Icon = item.icon;
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => handleItemClick(item)}
                                        className="
                                            w-full flex items-center gap-3 px-3 py-2 text-sm
                                            text-slate-700 dark:text-slate-300
                                            hover:bg-slate-100 dark:hover:bg-navy-700
                                            transition-colors
                                        "
                                    >
                                        <Icon size={16} className={item.pmo ? 'text-primary-500' : 'text-slate-400'} />
                                        {t(item.labelKey, item.label)}
                                    </button>
                                );
                            })}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default AddFilesMenu;


