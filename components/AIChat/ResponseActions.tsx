/**
 * ResponseActions
 * 
 * Renders action buttons at the bottom of AI responses.
 * Supports navigation, API calls, expand/collapse, and copy actions.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
    ExternalLink, 
    Play, 
    Copy, 
    Check,
    ChevronDown,
    ChevronUp,
    Target,
    Lightbulb,
    Map,
    FileText,
    Calculator,
    BarChart3,
    Plus
} from 'lucide-react';
import { ChatResponseAction, AppView } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { Api } from '../../services/api';

interface ResponseActionsProps {
    actions: ChatResponseAction[];
    onActionComplete?: (action: ChatResponseAction, result?: any) => void;
}

// Icon mapping for common action icons
const ACTION_ICONS: Record<string, React.ElementType> = {
    'target': Target,
    'assessment': Target,
    'lightbulb': Lightbulb,
    'initiative': Lightbulb,
    'map': Map,
    'roadmap': Map,
    'file': FileText,
    'report': FileText,
    'calculator': Calculator,
    'roi': Calculator,
    'chart': BarChart3,
    'analytics': BarChart3,
    'plus': Plus,
    'add': Plus,
    'external': ExternalLink,
    'navigate': ExternalLink,
    'play': Play,
    'execute': Play,
    'copy': Copy
};

export const ResponseActions: React.FC<ResponseActionsProps> = ({
    actions,
    onActionComplete
}) => {
    const { t } = useTranslation();
    const { setCurrentView } = useAppStore();
    const [loadingAction, setLoadingAction] = useState<string | null>(null);
    const [copiedAction, setCopiedAction] = useState<string | null>(null);

    if (!actions || actions.length === 0) return null;

    const handleAction = async (action: ChatResponseAction) => {
        switch (action.type) {
            case 'navigate':
                if (action.payload.view) {
                    setCurrentView(action.payload.view as AppView);
                }
                onActionComplete?.(action);
                break;

            case 'execute':
                if (action.payload.apiCall) {
                    setLoadingAction(action.id);
                    try {
                        // Generic API call - customize based on your API structure
                        const response = await fetch(action.payload.apiCall, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${localStorage.getItem('token')}`
                            },
                            body: JSON.stringify(action.payload.data || {})
                        });
                        const result = await response.json();
                        onActionComplete?.(action, result);
                    } catch (err) {
                        console.error('[ResponseActions] Execute error:', err);
                    } finally {
                        setLoadingAction(null);
                    }
                }
                break;

            case 'copy':
                const textToCopy = action.payload.copyText || action.label;
                await navigator.clipboard.writeText(textToCopy);
                setCopiedAction(action.id);
                setTimeout(() => setCopiedAction(null), 2000);
                onActionComplete?.(action);
                break;

            case 'expand':
                // Handle expand/collapse - typically managed by parent
                onActionComplete?.(action);
                break;
        }
    };

    const getIcon = (action: ChatResponseAction): React.ElementType => {
        // First check if action has a specific icon
        if (action.icon && ACTION_ICONS[action.icon]) {
            return ACTION_ICONS[action.icon];
        }
        // Fall back to type-based icon
        return ACTION_ICONS[action.type] || ExternalLink;
    };

    return (
        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-navy-700">
            <div className="flex flex-wrap gap-2">
                {actions.map(action => {
                    const Icon = getIcon(action);
                    const isLoading = loadingAction === action.id;
                    const isCopied = copiedAction === action.id;

                    return (
                        <button
                            key={action.id}
                            onClick={() => handleAction(action)}
                            disabled={isLoading}
                            className={`
                                flex items-center gap-1.5 px-3 py-1.5 
                                text-xs font-medium rounded-lg
                                border transition-all duration-200
                                ${action.type === 'navigate'
                                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border-primary-200 dark:border-primary-800 hover:bg-primary-100 dark:hover:bg-primary-900/50'
                                    : action.type === 'execute'
                                        ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/50'
                                        : 'bg-slate-50 dark:bg-navy-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-navy-700 hover:bg-slate-100 dark:hover:bg-navy-700'
                                }
                                ${isLoading ? 'opacity-60 cursor-wait' : ''}
                            `}
                        >
                            {isLoading ? (
                                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : isCopied ? (
                                <Check size={14} className="text-green-500" />
                            ) : (
                                <Icon size={14} />
                            )}
                            <span>{isCopied ? t('common.copied', 'Copied!') : action.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

/**
 * Compact action button for single prominent action
 */
interface PrimaryActionButtonProps {
    action: ChatResponseAction;
    onAction: () => void;
}

export const PrimaryActionButton: React.FC<PrimaryActionButtonProps> = ({
    action,
    onAction
}) => {
    const Icon = ACTION_ICONS[action.icon || action.type] || ExternalLink;

    return (
        <button
            onClick={onAction}
            className="
                flex items-center gap-2 px-4 py-2
                bg-primary-600 hover:bg-primary-500
                text-white text-sm font-medium
                rounded-lg shadow-md shadow-primary-500/20
                transition-all duration-200
            "
        >
            <Icon size={16} />
            {action.label}
        </button>
    );
};

export default ResponseActions;


