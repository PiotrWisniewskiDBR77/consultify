/**
 * ProactiveNudgeDisplay Component
 * 
 * Displays AI proactive suggestions as floating notifications.
 */

import React, { useState, useEffect } from 'react';
import { 
    Sparkles, 
    X, 
    ThumbsUp, 
    Clock, 
    BellOff,
    MessageCircle,
    Lightbulb,
    TrendingUp,
    AlertCircle,
    FileText
} from 'lucide-react';
import { useProactiveNudges, Nudge } from '../../hooks/useProactiveNudges';
import { useAIContext } from '../../contexts/AIContext';

interface ProactiveNudgeDisplayProps {
    enabled?: boolean;
    position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

const CAPABILITY_ICONS: Record<string, React.ElementType> = {
    assessment_help: Lightbulb,
    assessment_suggestion: TrendingUp,
    report_generation: FileText,
    initiative_suggestion: Sparkles,
    task_advisor: MessageCircle,
    improvement_recommendations: AlertCircle,
    onboarding: Sparkles
};

const CAPABILITY_COLORS: Record<string, string> = {
    assessment_help: 'from-blue-500 to-indigo-600',
    assessment_suggestion: 'from-purple-500 to-pink-600',
    report_generation: 'from-green-500 to-teal-600',
    initiative_suggestion: 'from-orange-500 to-red-600',
    task_advisor: 'from-cyan-500 to-blue-600',
    improvement_recommendations: 'from-yellow-500 to-orange-600',
    onboarding: 'from-indigo-500 to-purple-600'
};

const POSITION_CLASSES = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'top-right': 'top-6 right-6',
    'top-left': 'top-6 left-6'
};

export function ProactiveNudgeDisplay({ 
    enabled = true,
    position = 'bottom-right'
}: ProactiveNudgeDisplayProps) {
    const { openChat } = useAIContext();
    const { 
        currentNudge, 
        pendingCount,
        dismissNudge, 
        actOnNudge,
        clearNudge 
    } = useProactiveNudges({ enabled });

    const [isVisible, setIsVisible] = useState(false);
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        if (currentNudge) {
            // Small delay before showing for smooth animation
            const timer = setTimeout(() => setIsVisible(true), 100);
            return () => clearTimeout(timer);
        } else {
            setIsVisible(false);
        }
    }, [currentNudge]);

    const handleDismiss = async () => {
        if (!currentNudge) return;
        setIsExiting(true);
        await new Promise(r => setTimeout(r, 300));
        await dismissNudge(currentNudge.nudgeId);
        setIsExiting(false);
    };

    const handleNeverShow = async () => {
        if (!currentNudge) return;
        setIsExiting(true);
        await new Promise(r => setTimeout(r, 300));
        // This will be stored to not show this type again
        await dismissNudge(currentNudge.nudgeId);
        setIsExiting(false);
    };

    const handleAccept = async () => {
        if (!currentNudge) return;
        
        // Open chat with the nudge context
        openChat(currentNudge.message);
        
        // Track that user acted on this nudge
        await actOnNudge(currentNudge.nudgeId, 'accepted');
        clearNudge();
    };

    if (!enabled || !currentNudge) {
        return null;
    }

    const Icon = CAPABILITY_ICONS[currentNudge.capability] || Sparkles;
    const gradientClass = CAPABILITY_COLORS[currentNudge.capability] || 'from-indigo-500 to-purple-600';

    return (
        <div 
            className={`fixed ${POSITION_CLASSES[position]} z-50 transition-all duration-300 ${
                isVisible && !isExiting
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-4'
            }`}
        >
            <div className="relative max-w-sm">
                {/* Glow effect */}
                <div className={`absolute inset-0 bg-gradient-to-r ${gradientClass} blur-xl opacity-30 rounded-2xl`} />
                
                {/* Main card */}
                <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    {/* Header with gradient */}
                    <div className={`bg-gradient-to-r ${gradientClass} p-4`}>
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                                    <Icon className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <p className="text-white font-medium text-sm">
                                        Sugestia AI
                                    </p>
                                    <p className="text-white/70 text-xs">
                                        Asystent Consultify
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleDismiss}
                                className="text-white/70 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Message */}
                    <div className="p-4">
                        <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                            {currentNudge.message}
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="px-4 pb-4 flex items-center gap-2">
                        <button
                            onClick={handleAccept}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r ${gradientClass} text-white rounded-xl font-medium text-sm hover:opacity-90 transition-opacity`}
                        >
                            <ThumbsUp className="w-4 h-4" />
                            Tak, pomóż
                        </button>
                        <button
                            onClick={handleDismiss}
                            className="flex items-center justify-center gap-2 py-2.5 px-4 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl font-medium text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                            <Clock className="w-4 h-4" />
                            Nie teraz
                        </button>
                    </div>

                    {/* Don't show again link */}
                    <div className="px-4 pb-3 text-center">
                        <button
                            onClick={handleNeverShow}
                            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 inline-flex items-center gap-1"
                        >
                            <BellOff className="w-3 h-3" />
                            Nie pokazuj więcej
                        </button>
                    </div>

                    {/* Pending count indicator */}
                    {pendingCount > 1 && (
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-lg">
                            {pendingCount}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ProactiveNudgeDisplay;

