import React from 'react';
import { Shield, FileEdit, Zap } from 'lucide-react';

/**
 * AI Roles Model - Role Badge Component
 * Displays the active AI governance role for a project
 */

interface AIRoleBadgeProps {
    role: 'ADVISOR' | 'MANAGER' | 'OPERATOR';
    size?: 'sm' | 'md';
    showDescription?: boolean;
}

const roleConfig = {
    ADVISOR: {
        icon: Shield,
        label: 'Advisor',
        color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        description: 'Read-only assistance'
    },
    MANAGER: {
        icon: FileEdit,
        label: 'Manager',
        color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        description: 'Prepares drafts'
    },
    OPERATOR: {
        icon: Zap,
        label: 'Operator',
        color: 'bg-green-500/20 text-green-400 border-green-500/30',
        description: 'Can execute actions'
    }
};

export const AIRoleBadge: React.FC<AIRoleBadgeProps> = ({
    role,
    size = 'sm',
    showDescription = false
}) => {
    const config = roleConfig[role] || roleConfig.ADVISOR;
    const Icon = config.icon;

    return (
        <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border ${config.color} ${size === 'sm' ? 'text-[10px]' : 'text-xs'
                }`}
            title={config.description}
        >
            <Icon size={size === 'sm' ? 10 : 12} />
            {config.label}
            {showDescription && (
                <span className="ml-1 opacity-75">• {config.description}</span>
            )}
        </span>
    );
};

export default AIRoleBadge;
