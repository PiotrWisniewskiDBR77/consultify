import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';

/**
 * EmptyStateWithActions — Reusable empty state with action buttons
 * 
 * Features:
 * - Customizable icon/illustration
 * - Primary and secondary actions
 * - Quick-start templates
 */

export interface EmptyStateAction {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'ghost';
    icon?: React.ComponentType<{ size?: number; className?: string }>;
}

export interface EmptyStateTemplate {
    id: string;
    label: string;
    description: string;
    onClick: () => void;
    icon?: React.ComponentType<{ size?: number; className?: string }>;
}

export interface EmptyStateWithActionsProps {
    title: string;
    description: string;
    icon?: React.ComponentType<{ size?: number; className?: string }>;
    illustration?: string;
    actions?: EmptyStateAction[];
    templates?: EmptyStateTemplate[];
    className?: string;
}

export const EmptyStateWithActions: React.FC<EmptyStateWithActionsProps> = ({
    title,
    description,
    icon: Icon,
    illustration,
    actions = [],
    templates = [],
    className = '',
}) => {
    const getButtonClasses = (variant: EmptyStateAction['variant']) => {
        switch (variant) {
            case 'primary':
                return 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-900/20';
            case 'secondary':
                return 'bg-slate-100 dark:bg-navy-900 hover:bg-slate-200 dark:hover:bg-navy-800 text-navy-900 dark:text-white';
            case 'ghost':
            default:
                return 'text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20';
        }
    };

    return (
        <div className={`flex flex-col items-center justify-center py-12 px-6 text-center ${className}`}>
            {/* Icon or Illustration */}
            {illustration ? (
                <img
                    src={illustration}
                    alt=""
                    className="w-48 h-48 object-contain mb-6 opacity-80"
                />
            ) : Icon ? (
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 flex items-center justify-center mb-6">
                    <Icon size={40} className="text-purple-500 dark:text-purple-400" />
                </div>
            ) : (
                <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-navy-900 flex items-center justify-center mb-6">
                    <Sparkles size={40} className="text-slate-300 dark:text-slate-600" />
                </div>
            )}

            {/* Title */}
            <h3 className="text-xl font-bold text-navy-900 dark:text-white mb-2">
                {title}
            </h3>

            {/* Description */}
            <p className="text-slate-500 dark:text-slate-400 max-w-md mb-6 leading-relaxed">
                {description}
            </p>

            {/* Actions */}
            {actions.length > 0 && (
                <div className="flex items-center gap-3 mb-8">
                    {actions.map((action, index) => {
                        const ActionIcon = action.icon;
                        return (
                            <button
                                key={index}
                                onClick={action.onClick}
                                className={`
                                    flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all
                                    ${getButtonClasses(action.variant || (index === 0 ? 'primary' : 'secondary'))}
                                `}
                            >
                                {ActionIcon && <ActionIcon size={16} />}
                                {action.label}
                                {action.variant === 'primary' && !ActionIcon && <ArrowRight size={16} />}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Templates */}
            {templates.length > 0 && (
                <div className="w-full max-w-lg">
                    <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
                        Lub wybierz szablon
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                        {templates.map((template) => {
                            const TemplateIcon = template.icon;
                            return (
                                <button
                                    key={template.id}
                                    onClick={template.onClick}
                                    className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-700 bg-white dark:bg-navy-800 hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-all text-left group"
                                >
                                    {TemplateIcon && (
                                        <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-navy-900 flex items-center justify-center group-hover:bg-purple-100 dark:group-hover:bg-purple-900/30 transition-colors">
                                            <TemplateIcon size={20} className="text-slate-400 group-hover:text-purple-500 transition-colors" />
                                        </div>
                                    )}
                                    <div className="flex-1">
                                        <p className="font-medium text-navy-900 dark:text-white text-sm">
                                            {template.label}
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {template.description}
                                        </p>
                                    </div>
                                    <ArrowRight size={16} className="text-slate-300 dark:text-slate-600 group-hover:text-purple-500 transition-colors" />
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmptyStateWithActions;
