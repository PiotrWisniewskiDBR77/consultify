/**
 * SettingsToggle Component
 * 
 * Toggle switch with label and description for AI settings.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon, Lock } from 'lucide-react';

interface SettingsToggleProps {
    label: string;
    description?: string;
    icon?: LucideIcon;
    iconColor?: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    locked?: boolean;
    lockedMessage?: string;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export const SettingsToggle: React.FC<SettingsToggleProps> = ({
    label,
    description,
    icon: Icon,
    iconColor = 'text-slate-400',
    checked,
    onChange,
    disabled = false,
    locked = false,
    lockedMessage = 'Controlled by organization',
    size = 'md',
    className = ''
}) => {
    const isDisabled = disabled || locked;
    
    const sizes = {
        sm: { toggle: 'w-8 h-5', knob: 'w-3 h-3', translate: 'translate-x-3.5' },
        md: { toggle: 'w-10 h-6', knob: 'w-4 h-4', translate: 'translate-x-4.5' },
        lg: { toggle: 'w-12 h-7', knob: 'w-5 h-5', translate: 'translate-x-5.5' }
    };
    
    const sizeConfig = sizes[size];

    return (
        <div className={`flex items-start gap-3 ${className}`}>
            {Icon && (
                <div className="flex-shrink-0 mt-0.5">
                    <Icon className={`w-5 h-5 ${iconColor}`} />
                </div>
            )}
            
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className={`font-medium ${isDisabled ? 'text-slate-400 dark:text-slate-500' : 'text-navy-900 dark:text-slate-200'}`}>
                        {label}
                    </span>
                    {locked && (
                        <div className="relative group">
                            <Lock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                            <div className="
                                absolute left-1/2 -translate-x-1/2 bottom-full mb-2
                                px-2 py-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700
                                text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap shadow-lg dark:shadow-none
                                opacity-0 invisible group-hover:opacity-100 group-hover:visible
                                transition-all duration-200 z-50
                            ">
                                {lockedMessage}
                            </div>
                        </div>
                    )}
                </div>
                {description && (
                    <p className={`text-sm mt-0.5 ${isDisabled ? 'text-slate-400 dark:text-slate-600' : 'text-slate-500 dark:text-slate-400'}`}>
                        {description}
                    </p>
                )}
            </div>

            <button
                type="button"
                role="switch"
                aria-checked={checked}
                disabled={isDisabled}
                onClick={() => !isDisabled && onChange(!checked)}
                className={`
                    relative flex-shrink-0 rounded-full p-0.5
                    transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500/50
                    ${sizeConfig.toggle}
                    ${checked 
                        ? 'bg-gradient-to-r from-primary-500 to-primary-600' 
                        : 'bg-slate-300 dark:bg-slate-700'
                    }
                    ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
            >
                <motion.span
                    className={`
                        block rounded-full bg-white shadow-lg
                        ${sizeConfig.knob}
                    `}
                    animate={{ 
                        x: checked ? parseInt(sizeConfig.translate.replace('translate-x-', '').replace('.5', '')) * 4 : 2 
                    }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
            </button>
        </div>
    );
};

export default SettingsToggle;

