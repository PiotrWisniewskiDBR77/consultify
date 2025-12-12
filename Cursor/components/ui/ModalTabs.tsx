/**
 * ANTYGRACITY REFAKTORING
 * Wspólny komponent tabów dla modali
 * Wyekstrahowany z InitiativeDetailModal i TaskDetailModal
 * gdzie identyczny wzorzec tabów był powielony
 */

import React from 'react';
import { LucideIcon } from 'lucide-react';

// ============================================================================
// TabConfig - konfiguracja pojedynczego taba
// ============================================================================
export interface TabConfig<T extends string> {
    id: T;
    label: string;
    icon?: LucideIcon;
}

// ============================================================================
// ModalTabs - nawigacja tabowa dla modali
// ============================================================================
interface ModalTabsProps<T extends string> {
    tabs: TabConfig<T>[];
    activeTab: T;
    onTabChange: (tabId: T) => void;
    variant?: 'default' | 'compact';
    accentColor?: 'blue' | 'purple' | 'green';
}

export function ModalTabs<T extends string>({
    tabs,
    activeTab,
    onTabChange,
    variant = 'default',
    accentColor = 'blue'
}: ModalTabsProps<T>) {
    const accentClasses = {
        blue: {
            active: 'text-blue-400 border-blue-500',
            inactive: 'text-slate-400 border-transparent hover:text-white'
        },
        purple: {
            active: 'text-purple-400 border-purple-500',
            inactive: 'text-slate-400 border-transparent hover:text-white'
        },
        green: {
            active: 'text-green-400 border-green-500',
            inactive: 'text-slate-400 border-transparent hover:text-white'
        }
    };

    const sizeClasses = variant === 'compact' ? 'py-2 text-xs' : 'py-3 text-sm';

    return (
        <div className="flex border-b border-white/5 bg-navy-900/50 px-6 gap-6">
            {tabs.map(tab => {
                const isActive = activeTab === tab.id;
                const colorClass = isActive 
                    ? accentClasses[accentColor].active 
                    : accentClasses[accentColor].inactive;

                return (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`
                            flex items-center gap-2 font-medium border-b-2 transition-colors
                            ${sizeClasses}
                            ${colorClass}
                        `}
                    >
                        {tab.icon && <tab.icon size={16} />}
                        {tab.label}
                    </button>
                );
            })}
        </div>
    );
}

// ============================================================================
// ModalContainer - wspólny kontener dla modali z backdrop
// ============================================================================
interface ModalContainerProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
    height?: 'auto' | 'full';
}

export const ModalContainer: React.FC<ModalContainerProps> = ({
    isOpen,
    onClose,
    children,
    maxWidth = '3xl',
    height = 'auto'
}) => {
    if (!isOpen) return null;

    const maxWidthClasses = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        '2xl': 'max-w-2xl',
        '3xl': 'max-w-3xl',
        '4xl': 'max-w-4xl',
        '5xl': 'max-w-5xl'
    };

    const heightClass = height === 'full' ? 'h-[90vh]' : 'max-h-[90vh]';

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div 
                className={`
                    bg-navy-900 border border-white/10 rounded-xl w-full 
                    ${maxWidthClasses[maxWidth]} ${heightClass}
                    flex flex-col shadow-2xl overflow-hidden 
                    animate-in fade-in zoom-in duration-200
                `}
            >
                {children}
            </div>
        </div>
    );
};

// ============================================================================
// ModalHeader - nagłówek modalu
// ============================================================================
interface ModalHeaderProps {
    title: string;
    subtitle?: string;
    icon?: React.ReactNode;
    onClose: () => void;
    actions?: React.ReactNode;
}

export const ModalHeader: React.FC<ModalHeaderProps> = ({
    title,
    subtitle,
    icon,
    onClose,
    actions
}) => (
    <div className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-navy-950">
        <div className="flex items-center gap-3">
            {icon && (
                <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                    {icon}
                </div>
            )}
            <div>
                <h2 className="text-lg font-bold text-white">{title}</h2>
                {subtitle && (
                    <div className="text-xs text-slate-400">{subtitle}</div>
                )}
            </div>
        </div>
        <div className="flex items-center gap-2">
            {actions}
            <button 
                onClick={onClose} 
                className="text-slate-400 hover:text-white p-1 transition-colors"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                </svg>
            </button>
        </div>
    </div>
);

// ============================================================================
// ModalFooter - stopka modalu z akcjami
// ============================================================================
interface ModalFooterProps {
    onCancel: () => void;
    onSave?: () => void;
    saveLabel?: string;
    cancelLabel?: string;
    saveIcon?: React.ReactNode;
    isLoading?: boolean;
}

export const ModalFooter: React.FC<ModalFooterProps> = ({
    onCancel,
    onSave,
    saveLabel = 'Save',
    cancelLabel = 'Cancel',
    saveIcon,
    isLoading = false
}) => (
    <div className="h-20 border-t border-white/5 bg-navy-950 px-6 flex items-center justify-between shrink-0">
        <button 
            onClick={onCancel} 
            className="text-slate-400 hover:text-white text-sm font-medium transition-colors"
        >
            {cancelLabel}
        </button>
        {onSave && (
            <button 
                onClick={onSave}
                disabled={isLoading}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
            >
                {saveIcon}
                {isLoading ? 'Saving...' : saveLabel}
            </button>
        )}
    </div>
);

