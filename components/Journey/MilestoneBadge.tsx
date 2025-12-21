import React from 'react';
import { CheckCircle2, Star, Zap, Users, Target, FileText, Sparkles } from 'lucide-react';

/**
 * MilestoneBadge — Visual badge for achieved milestones
 */

interface MilestoneBadgeProps {
    milestoneId: string;
    isAchieved: boolean;
    showLabel?: boolean;
    size?: 'sm' | 'md' | 'lg';
    animate?: boolean;
}

const MILESTONE_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
    cta_clicked: Star,
    demo_started: Zap,
    demo_completed: CheckCircle2,
    trial_started: Target,
    memory_activated: Sparkles,
    first_axis_created: Target,
    snapshot_created: FileText,
    second_user_joined: Users,
};

const MILESTONE_COLORS: Record<string, { bg: string; icon: string; glow: string }> = {
    cta_clicked: { bg: 'bg-amber-500', icon: 'text-white', glow: 'shadow-amber-500/30' },
    demo_started: { bg: 'bg-blue-500', icon: 'text-white', glow: 'shadow-blue-500/30' },
    demo_completed: { bg: 'bg-green-500', icon: 'text-white', glow: 'shadow-green-500/30' },
    trial_started: { bg: 'bg-purple-500', icon: 'text-white', glow: 'shadow-purple-500/30' },
    memory_activated: { bg: 'bg-indigo-500', icon: 'text-white', glow: 'shadow-indigo-500/30' },
    first_axis_created: { bg: 'bg-emerald-500', icon: 'text-white', glow: 'shadow-emerald-500/30' },
    snapshot_created: { bg: 'bg-teal-500', icon: 'text-white', glow: 'shadow-teal-500/30' },
    second_user_joined: { bg: 'bg-pink-500', icon: 'text-white', glow: 'shadow-pink-500/30' },
};

const MILESTONE_LABELS: Record<string, string> = {
    cta_clicked: 'First Click',
    demo_started: 'Demo Started',
    demo_completed: 'Demo Master',
    trial_started: 'Trial Pioneer',
    memory_activated: 'Memory Activated',
    first_axis_created: 'First Axis',
    snapshot_created: 'Snapshot Creator',
    second_user_joined: 'Team Builder',
};

const SIZE_CLASSES = {
    sm: { wrapper: 'w-6 h-6', icon: 12 },
    md: { wrapper: 'w-8 h-8', icon: 16 },
    lg: { wrapper: 'w-12 h-12', icon: 24 },
};

export const MilestoneBadge: React.FC<MilestoneBadgeProps> = ({
    milestoneId,
    isAchieved,
    showLabel = false,
    size = 'md',
    animate = false,
}) => {
    const Icon = MILESTONE_ICONS[milestoneId] || Star;
    const colors = MILESTONE_COLORS[milestoneId] || { bg: 'bg-slate-500', icon: 'text-white', glow: '' };
    const label = MILESTONE_LABELS[milestoneId] || milestoneId;
    const sizeClasses = SIZE_CLASSES[size];

    if (!isAchieved) {
        return (
            <div className="flex flex-col items-center gap-1">
                <div
                    className={`
                        ${sizeClasses.wrapper} rounded-full 
                        bg-slate-100 dark:bg-slate-800 
                        flex items-center justify-center
                        opacity-40
                    `}
                >
                    <Icon size={sizeClasses.icon} className="text-slate-400" />
                </div>
                {showLabel && (
                    <span className="text-[10px] text-slate-400 text-center max-w-[60px]">
                        {label}
                    </span>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center gap-1">
            <div
                className={`
                    ${sizeClasses.wrapper} rounded-full 
                    ${colors.bg} 
                    flex items-center justify-center
                    shadow-lg ${colors.glow}
                    ${animate ? 'animate-bounce' : ''}
                    transition-all duration-300
                `}
                title={label}
            >
                <Icon size={sizeClasses.icon} className={colors.icon} />
            </div>
            {showLabel && (
                <span className="text-[10px] font-medium text-navy-900 dark:text-white text-center max-w-[60px]">
                    {label}
                </span>
            )}
        </div>
    );
};

/**
 * MilestoneBadgeRow — Display multiple badges in a row
 */

interface MilestoneBadgeRowProps {
    milestoneIds: string[];
    achievedIds: string[];
    showLabels?: boolean;
    size?: 'sm' | 'md' | 'lg';
}

export const MilestoneBadgeRow: React.FC<MilestoneBadgeRowProps> = ({
    milestoneIds,
    achievedIds,
    showLabels = false,
    size = 'md',
}) => {
    return (
        <div className="flex items-center gap-3">
            {milestoneIds.map(id => (
                <MilestoneBadge
                    key={id}
                    milestoneId={id}
                    isAchieved={achievedIds.includes(id)}
                    showLabel={showLabels}
                    size={size}
                />
            ))}
        </div>
    );
};

export default MilestoneBadge;
