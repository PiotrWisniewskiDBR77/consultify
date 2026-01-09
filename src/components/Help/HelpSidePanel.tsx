/**
 * Help Side Panel
 *
 * A sliding panel that displays contextual help documentation.
 * Contains 4 tabs: Overview, How to Use, FAQ, Video tutorials.
 * Content is dynamically loaded based on current view.
 *
 * Features:
 * - Context breadcrumb showing current module/card
 * - Related modules quick links
 * - Video progress tracking (localStorage)
 * - Search highlighting for FAQs
 */

import type { TFunction } from 'i18next';
import {
    ArrowRight,
    BookOpen,
    Bot,
    CheckCheck,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    Clock,
    ExternalLink,
    Eye,
    HelpCircle,
    Info,
    Lightbulb,
    Link2,
    Loader2,
    MapPin,
    PlayCircle,
    Send,
    Sparkles,
    Target,
    Users,
    X,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getModuleHelp } from '../../config/moduleHelpContent';
import { HelpTab, useHelpSidePanel } from '../../contexts/HelpContext';

// Tab configuration
const TABS: { id: HelpTab; labelKey: string; icon: React.ReactNode }[] = [
    { id: 'ai', labelKey: 'help.sidePanel.tabs.ai', icon: <Bot size={16} /> },
    { id: 'overview', labelKey: 'help.sidePanel.tabs.overview', icon: <BookOpen size={16} /> },
    { id: 'howto', labelKey: 'help.sidePanel.tabs.howto', icon: <Lightbulb size={16} /> },
    { id: 'faq', labelKey: 'help.sidePanel.tabs.faq', icon: <HelpCircle size={16} /> },
    { id: 'video', labelKey: 'help.sidePanel.tabs.video', icon: <PlayCircle size={16} /> },
];

// Dynamic icon component
const DynamicIcon: React.FC<{ name: string; size?: number; className?: string }> = ({ name, size = 20, className }) => {
    const IconComponent = (LucideIcons as any)[name];
    if (!IconComponent) return null;
    return <IconComponent size={size} className={className} />;
};

// Video progress tracking helpers
const VIDEO_PROGRESS_KEY = 'consultinity_video_progress';

const getWatchedVideos = (): string[] => {
    try {
        const stored = localStorage.getItem(VIDEO_PROGRESS_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
};

const markVideoWatched = (videoId: string) => {
    try {
        const watched = getWatchedVideos();
        if (!watched.includes(videoId)) {
            watched.push(videoId);
            localStorage.setItem(VIDEO_PROGRESS_KEY, JSON.stringify(watched));
        }
    } catch {
        // Ignore storage errors
    }
};

const isVideoWatched = (videoId: string): boolean => {
    return getWatchedVideos().includes(videoId);
};

// Helper to safely get translated array (handles missing translations)
const getTranslatedArray = (t: TFunction, key: string): string[] => {
    const result = t(key, { returnObjects: true });
    if (Array.isArray(result)) {
        return result.filter((item): item is string => typeof item === 'string');
    }
    // If translation returns string (key not found), return empty array
    return [];
};

// Search highlight helper
const highlightText = (text: string, query: string): React.ReactNode => {
    if (!query.trim()) return text;

    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));

    return parts.map((part, idx: number) =>
        part.toLowerCase() === query.toLowerCase() ? (
            <mark
                key={idx}
                className="bg-yellow-200 dark:bg-yellow-500/30 text-yellow-900 dark:text-yellow-200 px-0.5 rounded"
            >
                {part}
            </mark>
        ) : (
            part
        ),
    );
};

// Difficulty badge component
const DifficultyBadge: React.FC<{ difficulty: 'beginner' | 'intermediate' | 'advanced' }> = ({ difficulty }) => {
    const colors = {
        beginner: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        intermediate: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        advanced: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    };

    const { t } = useTranslation();

    return (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[difficulty]}`}>
            {t(`help.sidePanel.difficulty.${difficulty}`)}
        </span>
    );
};

// Expandable FAQ item with search highlighting
const FAQItem: React.FC<{ question: string; answer: string; searchQuery?: string }> = ({
    question,
    answer,
    searchQuery = '',
}) => {
    const [isOpen, setIsOpen] = useState(false);

    // Auto-expand if search query matches
    useEffect(() => {
        if (
            searchQuery &&
            (question.toLowerCase().includes(searchQuery.toLowerCase()) ||
                answer.toLowerCase().includes(searchQuery.toLowerCase()))
        ) {
            setIsOpen(true);
        }
    }, [searchQuery, question, answer]);

    return (
        <div className="border-b border-slate-200 dark:border-white/5 last:border-0">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-start gap-3 py-3 px-3 text-left hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            >
                <span className="flex-shrink-0 mt-0.5">
                    {isOpen ? (
                        <ChevronDown size={16} className="text-purple-500" />
                    ) : (
                        <ChevronRight size={16} className="text-slate-400" />
                    )}
                </span>
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                    {highlightText(question, searchQuery)}
                </span>
            </button>
            {isOpen && (
                <div className="pl-10 pb-3 pr-4">
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        {highlightText(answer, searchQuery)}
                    </p>
                </div>
            )}
        </div>
    );
};

// Video card component with progress tracking
const VideoCard: React.FC<{
    id: string;
    title: string;
    description: string;
    duration: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    url: string;
}> = ({ id, title, description, duration, difficulty, url }) => {
    const [watched, setWatched] = useState(() => isVideoWatched(id));
    const { t } = useTranslation();

    const handleWatch = () => {
        markVideoWatched(id);
        setWatched(true);
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    return (
        <div
            className={`rounded-lg p-4 transition-colors relative ${watched
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30'
                    : 'bg-slate-50 dark:bg-navy-900 hover:bg-slate-100 dark:hover:bg-navy-800'
                }`}
        >
            {watched && (
                <div className="absolute -top-2 -right-2">
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500 text-white text-[10px] font-medium rounded-full">
                        <CheckCheck size={10} />
                        {t('help.sidePanel.video.watched')}
                    </span>
                </div>
            )}
            <div className="flex items-start justify-between mb-2">
                <h4
                    className={`text-sm font-medium pr-2 ${watched ? 'text-green-800 dark:text-green-300' : 'text-slate-900 dark:text-white'}`}
                >
                    {title}
                </h4>
                <DifficultyBadge difficulty={difficulty} />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 line-clamp-2">{description}</p>
            <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-xs text-slate-400">
                    <Clock size={12} />
                    {duration}
                </span>
                <button
                    onClick={handleWatch}
                    className={`flex items-center gap-1 text-xs transition-colors ${watched
                            ? 'text-green-600 dark:text-green-400 hover:text-green-700'
                            : 'text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300'
                        }`}
                >
                    {watched ? <Eye size={12} /> : <PlayCircle size={12} />}
                    {watched ? t('help.sidePanel.video.watchAgain') : t('help.sidePanel.video.watch')}
                    <ExternalLink size={10} />
                </button>
            </div>
        </div>
    );
};

// AI Help Chat Component
interface AIMessage {
    role: 'user' | 'assistant';
    content: string;
}

const QUICK_PROMPTS = [
    { key: 'howto', icon: <Lightbulb size={14} />, labelKey: 'help.ai.quick.howto' },
    { key: 'explain', icon: <Info size={14} />, labelKey: 'help.ai.quick.explain' },
    { key: 'troubleshoot', icon: <HelpCircle size={14} />, labelKey: 'help.ai.quick.troubleshoot' },
];

const AIHelpChat: React.FC<{ moduleId: string }> = ({ moduleId }) => {
    const { t } = useTranslation();
    const [messages, setMessages] = useState<AIMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = React.useRef<HTMLDivElement>(null);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Get auth token
    const getToken = () => {
        try {
            const stored = localStorage.getItem('consultinity-storage');
            if (stored) {
                const parsed = JSON.parse(stored);
                return parsed.state?.currentUser?.token || localStorage.getItem('auth_token');
            }
            return localStorage.getItem('auth_token');
        } catch {
            return null;
        }
    };

    const sendMessage = async (message: string) => {
        if (!message.trim() || isLoading) return;

        const userMessage: AIMessage = { role: 'user', content: message };
        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const token = getToken();
            const response = await fetch('/api/help/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    message,
                    context: moduleId,
                    history: messages.slice(-6), // Last 6 messages for context
                }),
            });

            const data = await response.json();
            const assistantMessage: AIMessage = {
                role: 'assistant',
                content: data.message || t('help.ai.error', 'Sorry, I encountered an error.'),
            };
            setMessages((prev) => [...prev, assistantMessage]);
        } catch (err: any) {
            setMessages((prev) => [
                ...prev,
                { role: 'assistant', content: t('help.ai.error', 'Sorry, I encountered an error. Please try again.') },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleQuickPrompt = (key: string) => {
        const prompts: Record<string, string> = {
            howto: t('help.ai.prompts.howto', `How do I use the ${moduleId} module?`),
            explain: t('help.ai.prompts.explain', `Explain what I can do in the ${moduleId} module.`),
            troubleshoot: t('help.ai.prompts.troubleshoot', `I'm having trouble with ${moduleId}. Can you help?`),
        };
        sendMessage(prompts[key] || prompts.howto);
    };

    return (
        <div className="flex flex-col h-full -m-4">
            {/* Messages area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                    <div className="text-center py-8">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                            <Bot size={32} className="text-white" />
                        </div>
                        <h3 className="font-semibold text-navy-900 dark:text-white mb-2">
                            {t('help.ai.welcome.title', 'AI Help Assistant')}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                            {t('help.ai.welcome.subtitle', "Ask me anything about using Consultinity. I'm here to help!")}
                        </p>
                        
                        {/* Quick prompts */}
                        <div className="space-y-2">
                            <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">
                                {t('help.ai.quick.label', 'Quick questions:')}
                            </p>
                            {QUICK_PROMPTS.map((prompt) => (
                                <button
                                    key={prompt.key}
                                    onClick={() => handleQuickPrompt(prompt.key)}
                                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700 text-left text-sm text-slate-600 dark:text-slate-300 transition-colors"
                                >
                                    <span className="text-violet-500">{prompt.icon}</span>
                                    {t(prompt.labelKey, prompt.key)}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    messages.map((msg, idx) => (
                        <div
                            key={idx}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`
                                    max-w-[85%] px-3 py-2 rounded-2xl text-sm
                                    ${msg.role === 'user'
                                        ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white rounded-br-md'
                                        : 'bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-200 rounded-bl-md'
                                    }
                                `}
                            >
                                <div className="whitespace-pre-wrap">{msg.content}</div>
                            </div>
                        </div>
                    ))
                )}
                
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-slate-100 dark:bg-navy-800 px-4 py-3 rounded-2xl rounded-bl-md">
                            <Loader2 size={16} className="animate-spin text-violet-500" />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="border-t border-slate-200 dark:border-white/10 p-3 bg-white dark:bg-navy-900">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        sendMessage(input);
                    }}
                    className="flex gap-2"
                >
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={t('help.ai.placeholder', 'Ask a question...')}
                        className="flex-1 px-3 py-2 rounded-xl bg-slate-100 dark:bg-navy-800 border border-transparent focus:border-violet-500 focus:outline-none text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-white transition-all"
                    >
                        <Send size={16} />
                    </button>
                </form>
            </div>
        </div>
    );
};

export const HelpSidePanel: React.FC = () => {
    const { t, i18n } = useTranslation();
    const lang = i18n.language === 'pl' ? 'pl' : 'en';

    const { isOpen, setOpen, activeTab, setActiveTab, help } = useHelpSidePanel();
    const [searchQuery, setSearchQuery] = useState('');

    // Reset search when tab changes
    useEffect(() => {
        setSearchQuery('');
    }, [activeTab]);

    if (!isOpen) return null;

    const moduleHelp = help.moduleHelp;
    const cardHelp = help.cardHelp;
    const faqs = help.faqs;
    const videos = help.videos;

    // Filter FAQs by search
    const filteredFAQs = searchQuery
        ? faqs.filter((faq) => {
            const question = lang === 'pl' ? faq.questionPl : faq.question;
            const answer = lang === 'pl' ? faq.answerPl : faq.answer;
            const q = searchQuery.toLowerCase();
            return (question || '').toLowerCase().includes(q) || (answer || '').toLowerCase().includes(q);
        })
        : faqs;

    // Get audience badge
    const getAudienceBadge = (audience: string[]) => {
        if (audience.includes('superadmin'))
            return {
                label: t('help.sidePanel.audience.superadmin'),
                color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
            };
        if (audience.includes('admin'))
            return {
                label: t('help.sidePanel.audience.admin'),
                color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
            };
        return {
            label: t('help.sidePanel.audience.user'),
            color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        };
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 transition-opacity"
                onClick={() => setOpen(false)}
            />

            {/* Panel */}
            <div className="fixed right-0 top-0 h-full w-96 max-w-[90vw] bg-white dark:bg-navy-950 shadow-2xl z-50 flex flex-col animate-slide-in-right">
                {/* Header with Context Breadcrumb */}
                <div className="border-b border-slate-200 dark:border-white/5 bg-gradient-to-r from-purple-500/10 to-indigo-500/10 dark:from-purple-500/20 dark:to-indigo-500/20">
                    {/* Main header */}
                    <div className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3">
                            {moduleHelp && (
                                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                    <DynamicIcon
                                        name={moduleHelp.icon || 'HelpCircle'}
                                        size={18}
                                        className="text-purple-600 dark:text-purple-400"
                                    />
                                </div>
                            )}
                            <div>
                                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                                    {moduleHelp
                                        ? t(`${moduleHelp.translationKey}.name`)
                                        : t('help.sidePanel.content.help')}
                                </h2>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {t('help.sidePanel.content.helpCenter')}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setOpen(false)}
                            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                        >
                            <X size={18} className="text-slate-500" />
                        </button>
                    </div>

                    {/* Context Breadcrumb */}
                    <div className="px-4 pb-2">
                        <div className="flex items-center gap-2 text-xs">
                            <MapPin size={12} className="text-purple-500" />
                            <span className="text-slate-500 dark:text-slate-400">
                                {t('help.sidePanel.content.currentContext')}
                            </span>
                            <div className="flex items-center gap-1.5">
                                <span className="font-medium text-slate-700 dark:text-slate-300">
                                    {moduleHelp ? t(`${moduleHelp.translationKey}.name`) : '—'}
                                </span>
                                {cardHelp && (
                                    <>
                                        <ArrowRight size={10} className="text-slate-400" />
                                        <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-xs font-medium">
                                            {cardHelp.title}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-navy-900">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${activeTab === tab.id
                                    ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-500 bg-white dark:bg-navy-950'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                        >
                            {tab.icon}
                            <span className="hidden sm:inline">{t(tab.labelKey)}</span>
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {/* AI Assistant Tab */}
                    {activeTab === 'ai' && (
                        <AIHelpChat moduleId={help.moduleId} />
                    )}

                    {/* Overview Tab */}
                    {activeTab === 'overview' && moduleHelp && (
                        <div className="space-y-5">
                            {/* Description */}
                            <div>
                                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                    {t(`${moduleHelp.translationKey}.description`)}
                                </p>
                            </div>

                            {/* Purpose */}
                            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Target size={16} className="text-purple-600 dark:text-purple-400" />
                                    <h4 className="text-sm font-semibold text-purple-900 dark:text-purple-300">
                                        {t('help.sidePanel.content.purpose')}
                                    </h4>
                                </div>
                                <p className="text-sm text-purple-800 dark:text-purple-200/80">
                                    {t(`${moduleHelp.translationKey}.purpose`)}
                                </p>
                            </div>

                            {/* Target Audience */}
                            <div className="flex items-center gap-2">
                                <Users size={14} className="text-slate-400" />
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                    {t('help.sidePanel.audience.for')}
                                </span>
                                {(moduleHelp.targetAudience || []).map((audience: any) => {
                                    const badge = getAudienceBadge([audience]);
                                    return (
                                        <span
                                            key={audience}
                                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}
                                        >
                                            {badge.label}
                                        </span>
                                    );
                                })}
                            </div>

                            {/* Key Features */}
                            <div>
                                <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white mb-3">
                                    <Sparkles size={16} className="text-amber-500" />
                                    {t('help.sidePanel.content.keyFeatures')}
                                </h4>
                                <ul className="space-y-2">
                                    {getTranslatedArray(t, `${moduleHelp.translationKey}.keyFeatures`).map(
                                        (feature, idx: number) => (
                                            <li
                                                key={idx}
                                                className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300"
                                            >
                                                <CheckCircle2
                                                    size={14}
                                                    className="text-green-500 flex-shrink-0 mt-0.5"
                                                />
                                                {feature}
                                            </li>
                                        ),
                                    )}
                                </ul>
                            </div>

                            {/* Workflow */}
                            <div>
                                <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white mb-3">
                                    <Info size={16} className="text-blue-500" />
                                    {t('help.sidePanel.content.workflow')}
                                </h4>
                                <ol className="space-y-2">
                                    {getTranslatedArray(t, `${moduleHelp.translationKey}.workflow`).map((step, idx: number) => (
                                        <li
                                            key={idx}
                                            className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300"
                                        >
                                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-200 dark:bg-navy-700 flex items-center justify-center text-xs font-medium text-slate-600 dark:text-slate-300">
                                                {idx + 1}
                                            </span>
                                            {step}
                                        </li>
                                    ))}
                                </ol>
                            </div>

                            {/* Tips */}
                            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4">
                                <h4 className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-300 mb-3">
                                    <Lightbulb size={16} className="text-amber-500" />
                                    {t('help.sidePanel.content.tips')}
                                </h4>
                                <ul className="space-y-2">
                                    {getTranslatedArray(t, `${moduleHelp.translationKey}.tips`).map((tip, idx: number) => (
                                        <li
                                            key={idx}
                                            className="text-sm text-amber-800 dark:text-amber-200/80 flex items-start gap-2"
                                        >
                                            <span className="text-amber-500">•</span>
                                            {tip}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Related Modules Quick Links */}
                            {moduleHelp.relatedModules && moduleHelp.relatedModules.length > 0 && (
                                <div className="bg-slate-50 dark:bg-navy-900 rounded-lg p-4">
                                    <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white mb-3">
                                        <Link2 size={16} className="text-blue-500" />
                                        {t('help.sidePanel.content.relatedModules')}
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {moduleHelp.relatedModules.map((relModuleId) => {
                                            const relModule = getModuleHelp(relModuleId);
                                            if (!relModule) return null;
                                            return (
                                                <div
                                                    key={relModuleId}
                                                    className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-navy-800 border border-slate-200 dark:border-white/10 rounded-lg text-xs"
                                                >
                                                    <DynamicIcon
                                                        name={relModule.icon || 'Link'}
                                                        size={14}
                                                        className="text-slate-500"
                                                    />
                                                    <span className="text-slate-700 dark:text-slate-300">
                                                        {t(`${relModule.translationKey}.name`)}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                                        {t('help.sidePanel.content.relatedModulesDesc')}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* How to Use Tab */}
                    {activeTab === 'howto' && (
                        <div className="space-y-5">
                            {cardHelp ? (
                                <>
                                    {/* Current Context Badge */}
                                    <div className="bg-gradient-to-r from-purple-500/10 to-indigo-500/10 dark:from-purple-500/20 dark:to-indigo-500/20 border border-purple-200 dark:border-purple-800/30 rounded-lg p-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="flex items-center gap-1.5 px-2 py-0.5 bg-purple-500 text-white text-[10px] font-bold rounded-full uppercase tracking-wide">
                                                <MapPin size={10} />
                                                {t('help.sidePanel.content.actualContext')}
                                            </span>
                                        </div>
                                        <p className="text-xs text-purple-700 dark:text-purple-300">
                                            {t('help.sidePanel.content.contextDesc')}
                                        </p>
                                    </div>

                                    <div>
                                        <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">
                                            {cardHelp.title}
                                        </h3>
                                        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                            {cardHelp.description}
                                        </p>
                                    </div>

                                    {/* Features */}
                                    <div>
                                        <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white mb-3">
                                            <Sparkles size={16} className="text-purple-500" />
                                            {t('help.sidePanel.content.features') || 'Features'}
                                        </h4>
                                        <ul className="space-y-2">
                                            {cardHelp.features.map((feature: any, idx: number) => (
                                                <li
                                                    key={idx}
                                                    className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300"
                                                >
                                                    <CheckCircle2
                                                        size={14}
                                                        className="text-green-500 flex-shrink-0 mt-0.5"
                                                    />
                                                    {feature}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* How to Use Steps */}
                                    <div>
                                        <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white mb-3">
                                            <Info size={16} className="text-blue-500" />
                                            {t('help.sidePanel.tabs.howto')}
                                        </h4>
                                        <ol className="space-y-2">
                                            {cardHelp.howToUse.map((step: any, idx: number) => (
                                                <li
                                                    key={idx}
                                                    className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300"
                                                >
                                                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xs font-medium text-blue-600 dark:text-blue-400">
                                                        {idx + 1}
                                                    </span>
                                                    {step}
                                                </li>
                                            ))}
                                        </ol>
                                    </div>

                                    {/* Tips */}
                                    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4">
                                        <h4 className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-300 mb-3">
                                            <Lightbulb size={16} className="text-amber-500" />
                                            {t('help.sidePanel.content.tips')}
                                        </h4>
                                        <ul className="space-y-2">
                                            {cardHelp.tips.map((tip: any, idx: number) => (
                                                <li
                                                    key={idx}
                                                    className="text-sm text-amber-800 dark:text-amber-200/80 flex items-start gap-2"
                                                >
                                                    <span className="text-amber-500">•</span>
                                                    {tip}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* Related Docs */}
                                    {cardHelp.relatedDocs && cardHelp.relatedDocs.length > 0 && (
                                        <div>
                                            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                                                {t('help.sidePanel.content.relatedDocs')}
                                            </h4>
                                            <div className="space-y-2">
                                                {cardHelp.relatedDocs.map((doc: any, idx: number) => (
                                                    <a
                                                        key={idx}
                                                        href={doc.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400 hover:underline"
                                                    >
                                                        <ExternalLink size={14} />
                                                        {doc.title}
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="text-center py-8">
                                    <Info size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        {t('help.sidePanel.content.selectView')}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* FAQ Tab */}
                    {activeTab === 'faq' && (
                        <div className="space-y-4">
                            {/* Search */}
                            <div className="relative">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder={t('help.sidePanel.faq.searchPlaceholder')}
                                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-white/10 rounded-lg bg-white dark:bg-navy-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                />
                            </div>

                            {/* FAQ List */}
                            {filteredFAQs.length > 0 ? (
                                <div className="bg-white dark:bg-navy-900 rounded-lg border border-slate-200 dark:border-white/5">
                                    {filteredFAQs.map((faq) => (
                                        <FAQItem
                                            key={faq.id}
                                            question={(lang === 'pl' ? faq.questionPl : faq.question) || ''}
                                            answer={(lang === 'pl' ? faq.answerPl : faq.answer) || ''}
                                            searchQuery={searchQuery}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <HelpCircle size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        {searchQuery
                                            ? t('help.sidePanel.faq.noResults')
                                            : t('help.sidePanel.faq.noFAQ')}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Video Tab */}
                    {activeTab === 'video' && (
                        <div className="space-y-4">
                            {videos.length > 0 ? (
                                <>
                                    {/* Video Progress Summary */}
                                    <div className="bg-slate-100 dark:bg-navy-800 rounded-lg p-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                                {t('help.sidePanel.video.progress')}
                                            </span>
                                            <span className="text-xs text-slate-500">
                                                {videos.filter((v: any) => isVideoWatched(v.id)).length} / {videos.length}
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-200 dark:bg-navy-700 rounded-full h-2">
                                            <div
                                                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                                                style={{
                                                    width: `${(videos.filter((v: any) => isVideoWatched(v.id)).length / videos.length) * 100}%`,
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        {videos.map((video: any) => (
                                            <VideoCard
                                                key={video.id}
                                                id={video.id}
                                                title={lang === 'pl' ? video.titlePl : video.title}
                                                description={lang === 'pl' ? video.descriptionPl : video.description}
                                                duration={video.duration}
                                                difficulty={video.difficulty}
                                                url={video.url}
                                            />
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-8">
                                    <PlayCircle size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        {t('help.sidePanel.video.noVideos') ||
                                            (lang === 'pl'
                                                ? 'Brak tutoriali wideo dla tego modułu.'
                                                : 'No video tutorials available for this module.')}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-navy-900 flex items-center justify-between gap-3">
                    <button
                        onClick={() => setOpen(false)}
                        className="flex-1 py-2 px-4 bg-white dark:bg-navy-800 border border-slate-300 dark:border-white/10 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors"
                    >
                        {t('common.close', 'Zamknij')}
                    </button>
                    <a
                        href="https://docs.consultinity.app"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
                    >
                        <BookOpen size={14} />
                        <span className="hidden sm:inline">{t('help.sidePanel.content.fullDocumentation')}</span>
                        <ExternalLink size={12} />
                    </a>
                </div>
            </div>
        </>
    );
};

export default HelpSidePanel;
