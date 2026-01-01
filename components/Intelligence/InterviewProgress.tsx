/**
 * InterviewProgress Component
 * 
 * Shows progress through structured interview topics
 */

import React from 'react';
import { Check, Circle, ArrowRight } from 'lucide-react';
import { InterviewProgress as InterviewProgressType } from '../../types';

// Interview topics configuration
export const INTERVIEW_TOPICS = [
    { id: 'context', label: 'Project Context', questions: ['What is the project about?', 'What problem are we solving?'] },
    { id: 'objectives', label: 'Objectives', questions: ['What are the main goals?', 'What outcomes do we expect?'] },
    { id: 'stakeholders', label: 'Stakeholders', questions: ['Who are the key stakeholders?', 'Who is the sponsor?'] },
    { id: 'scope', label: 'Scope', questions: ['What is in scope?', 'What is out of scope?'] },
    { id: 'risks', label: 'Risks & Issues', questions: ['What are the main risks?', 'Are there any known issues?'] },
    { id: 'assumptions', label: 'Assumptions', questions: ['What assumptions are we making?', 'What constraints exist?'] },
    { id: 'success', label: 'Success Criteria', questions: ['How will we measure success?', 'What are the KPIs?'] },
    { id: 'dependencies', label: 'Dependencies', questions: ['What are the external dependencies?', 'What do we need from others?'] }
];

interface InterviewProgressProps {
    progress: InterviewProgressType;
    onTopicSelect?: (topicId: string) => void;
    compact?: boolean;
    className?: string;
}

export const InterviewProgress: React.FC<InterviewProgressProps> = ({
    progress,
    onTopicSelect,
    compact = false,
    className = ''
}) => {
    const completedSet = new Set(progress.completed);
    const totalTopics = INTERVIEW_TOPICS.length;
    const completedCount = progress.completed.length;
    const progressPercent = Math.round((completedCount / totalTopics) * 100);

    if (compact) {
        return (
            <div className={`bg-white dark:bg-navy-900 rounded-lg border border-slate-200 dark:border-white/10 p-3 ${className}`}>
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                        Interview Progress
                    </span>
                    <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                        {progressPercent}%
                    </span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-navy-800 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
                <div className="flex items-center gap-1 mt-2 flex-wrap">
                    {INTERVIEW_TOPICS.map(topic => {
                        const isCompleted = completedSet.has(topic.id);
                        const isCurrent = progress.current === topic.id;
                        return (
                            <div
                                key={topic.id}
                                className={`w-2 h-2 rounded-full ${
                                    isCompleted 
                                        ? 'bg-green-500' 
                                        : isCurrent 
                                        ? 'bg-purple-500 animate-pulse' 
                                        : 'bg-slate-300 dark:bg-slate-700'
                                }`}
                                title={topic.label}
                            />
                        );
                    })}
                </div>
            </div>
        );
    }

    return (
        <div className={`bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-4 ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-navy-900 dark:text-white">
                    Interview Progress
                </h3>
                <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-slate-100 dark:bg-navy-800 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                    <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                        {progressPercent}%
                    </span>
                </div>
            </div>

            {/* Topics List */}
            <div className="space-y-2">
                {INTERVIEW_TOPICS.map((topic, index) => {
                    const isCompleted = completedSet.has(topic.id);
                    const isCurrent = progress.current === topic.id;
                    const isNext = !isCompleted && !isCurrent && 
                        (progress.current === null || INTERVIEW_TOPICS.findIndex(t => t.id === progress.current) < index);

                    return (
                        <div
                            key={topic.id}
                            onClick={() => onTopicSelect?.(topic.id)}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                                onTopicSelect ? 'cursor-pointer' : ''
                            } ${
                                isCurrent
                                    ? 'bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800'
                                    : isCompleted
                                    ? 'bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30'
                                    : 'hover:bg-slate-50 dark:hover:bg-white/5 border border-transparent'
                            }`}
                        >
                            {/* Status Icon */}
                            <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                                isCompleted
                                    ? 'bg-green-500 text-white'
                                    : isCurrent
                                    ? 'bg-purple-500 text-white animate-pulse'
                                    : 'bg-slate-200 dark:bg-navy-700 text-slate-400 dark:text-slate-500'
                            }`}>
                                {isCompleted ? (
                                    <Check size={14} />
                                ) : isCurrent ? (
                                    <ArrowRight size={14} />
                                ) : (
                                    <span className="text-xs font-medium">{index + 1}</span>
                                )}
                            </div>

                            {/* Topic Info */}
                            <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium ${
                                    isCurrent
                                        ? 'text-purple-700 dark:text-purple-300'
                                        : isCompleted
                                        ? 'text-green-700 dark:text-green-400'
                                        : 'text-slate-600 dark:text-slate-400'
                                }`}>
                                    {topic.label}
                                </p>
                            </div>

                            {/* Status Badge */}
                            {isCurrent && (
                                <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 rounded-full">
                                    Current
                                </span>
                            )}
                            {isCompleted && (
                                <span className="text-xs text-green-600 dark:text-green-400">
                                    Done
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Current Topic Questions */}
            {progress.current && (
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/10">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                        Suggested Questions
                    </p>
                    <div className="space-y-1">
                        {INTERVIEW_TOPICS.find(t => t.id === progress.current)?.questions.map((q, i) => (
                            <p key={i} className="text-sm text-slate-600 dark:text-slate-400">
                                • {q}
                            </p>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default InterviewProgress;


