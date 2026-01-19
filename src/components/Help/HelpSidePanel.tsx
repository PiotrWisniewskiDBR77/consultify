/**
 * Help Side Panel
 *
 * A sliding panel that displays contextual help documentation.
 * Contains 3 tabs: AI Assistant, Overview, FAQ (styled like FeedbackSidePanel)
 * Content is dynamically loaded based on current view.
 *
 * Features:
 * - AI Assistant with context-aware quick prompts
 * - Overview combining purpose, features, workflow, tips and videos
 * - FAQ with default questions for all modules
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
  Search,
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

// Tab configuration - simplified to 3 tabs like Feedback panel
const TABS: { id: HelpTab; icon: typeof Bot; label: string; labelKey: string }[] = [
  { id: 'ai', icon: Bot, label: 'AI Assistant', labelKey: 'help.sidePanel.tabs.ai' },
  { id: 'overview', icon: BookOpen, label: 'Overview', labelKey: 'help.sidePanel.tabs.overview' },
  { id: 'faq', icon: HelpCircle, label: 'FAQ', labelKey: 'help.sidePanel.tabs.faq' },
];

// Dynamic icon component
const DynamicIcon: React.FC<{ name: string; size?: number; className?: string }> = ({
  name,
  size = 20,
  className,
}) => {
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
    )
  );
};

// Difficulty badge component
const DifficultyBadge: React.FC<{ difficulty: 'beginner' | 'intermediate' | 'advanced' }> = ({
  difficulty,
}) => {
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
    <div className="border-b border-slate-200 dark:border-navy-700 last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-start gap-3 py-3 px-3 text-left hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
      >
        <span className="flex-shrink-0 mt-0.5">
          {isOpen ? (
            <ChevronDown size={16} className="text-purple-500" />
          ) : (
            <ChevronRight size={16} className="text-slate-400 dark:text-slate-500" />
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
      className={`rounded-lg p-4 transition-colors relative ${
        watched
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
        <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
          <Clock size={12} />
          {duration}
        </span>
        <button
          onClick={handleWatch}
          className={`flex items-center gap-1 text-xs transition-colors ${
            watched
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

// Dynamic quick prompts based on module context
const getQuickPromptsForModule = (moduleId: string, t: any) => {
  // Module-specific prompts
  const modulePrompts: Record<
    string,
    { key: string; icon: React.ReactNode; label: string; prompt: string }[]
  > = {
    dashboard: [
      {
        key: 'metrics',
        icon: <Target size={14} />,
        label: t('help.ai.quick.metrics', 'Explain my metrics'),
        prompt: 'What do the metrics on my dashboard mean and how can I improve them?',
      },
      {
        key: 'actions',
        icon: <ArrowRight size={14} />,
        label: t('help.ai.quick.nextSteps', 'What should I do next?'),
        prompt: 'Based on my dashboard, what should I focus on next?',
      },
      {
        key: 'help',
        icon: <HelpCircle size={14} />,
        label: t('help.ai.quick.troubleshoot', 'Help me troubleshoot'),
        prompt: "I'm having trouble understanding my dashboard. Can you help?",
      },
    ],
    assessment: [
      {
        key: 'framework',
        icon: <BookOpen size={14} />,
        label: t('help.ai.quick.framework', 'Which framework?'),
        prompt: 'Which assessment framework should I use for my organization?',
      },
      {
        key: 'interpret',
        icon: <Eye size={14} />,
        label: t('help.ai.quick.interpret', 'Interpret results'),
        prompt: 'How do I interpret my assessment results and what do the scores mean?',
      },
      {
        key: 'improve',
        icon: <Target size={14} />,
        label: t('help.ai.quick.improve', 'How to improve?'),
        prompt: 'Based on my assessment, what areas should I prioritize for improvement?',
      },
    ],
    initiatives: [
      {
        key: 'create',
        icon: <Sparkles size={14} />,
        label: t('help.ai.quick.create', 'Create initiative'),
        prompt: 'How do I create a new initiative and what information do I need?',
      },
      {
        key: 'stagegate',
        icon: <CheckCircle2 size={14} />,
        label: t('help.ai.quick.stagegate', 'Stage gates'),
        prompt: 'Explain how stage gates work and how to move initiatives through them.',
      },
      {
        key: 'track',
        icon: <Info size={14} />,
        label: t('help.ai.quick.track', 'Track progress'),
        prompt: 'How can I effectively track and report on initiative progress?',
      },
    ],
    reports: [
      {
        key: 'create',
        icon: <Sparkles size={14} />,
        label: t('help.ai.quick.createReport', 'Create report'),
        prompt: 'How do I create a custom report and what data can I include?',
      },
      {
        key: 'share',
        icon: <ExternalLink size={14} />,
        label: t('help.ai.quick.share', 'Share reports'),
        prompt: 'How can I share reports with external stakeholders securely?',
      },
      {
        key: 'template',
        icon: <BookOpen size={14} />,
        label: t('help.ai.quick.template', 'Use templates'),
        prompt: 'What report templates are available and how do I use them?',
      },
    ],
    settings: [
      {
        key: 'notifications',
        icon: <Info size={14} />,
        label: t('help.ai.quick.notifications', 'Notifications'),
        prompt: 'How do I configure my notification preferences?',
      },
      {
        key: 'security',
        icon: <HelpCircle size={14} />,
        label: t('help.ai.quick.security', 'Security settings'),
        prompt: 'What security settings should I enable for my account?',
      },
      {
        key: 'integrations',
        icon: <Link2 size={14} />,
        label: t('help.ai.quick.integrations', 'Integrations'),
        prompt: 'What integrations are available and how do I set them up?',
      },
    ],
    admin: [
      {
        key: 'invite',
        icon: <Users size={14} />,
        label: t('help.ai.quick.invite', 'Invite team'),
        prompt: 'How do I invite team members and manage their access?',
      },
      {
        key: 'roles',
        icon: <HelpCircle size={14} />,
        label: t('help.ai.quick.roles', 'Manage roles'),
        prompt: 'What are the different user roles and their permissions?',
      },
      {
        key: 'billing',
        icon: <Info size={14} />,
        label: t('help.ai.quick.billing', 'Billing help'),
        prompt: 'How do I manage billing, subscriptions, and view invoices?',
      },
    ],
  };

  // Default prompts for unknown modules
  const defaultPrompts = [
    {
      key: 'howto',
      icon: <Lightbulb size={14} />,
      label: t('help.ai.quick.howto', 'How do I use this module?'),
      prompt: `How do I use the ${moduleId} module effectively?`,
    },
    {
      key: 'explain',
      icon: <Info size={14} />,
      label: t('help.ai.quick.explain', 'Explain what I can do here'),
      prompt: `What can I do in the ${moduleId} module and what are its main features?`,
    },
    {
      key: 'troubleshoot',
      icon: <HelpCircle size={14} />,
      label: t('help.ai.quick.troubleshoot', 'Help me troubleshoot an issue'),
      prompt: `I'm having trouble with ${moduleId}. Can you help me troubleshoot?`,
    },
  ];

  return modulePrompts[moduleId] || defaultPrompts;
};

const AIHelpChat: React.FC<{ moduleId: string }> = ({ moduleId }) => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Get dynamic quick prompts for current module
  const quickPrompts = useMemo(() => getQuickPromptsForModule(moduleId, t), [moduleId, t]);

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
        {
          role: 'assistant',
          content: t('help.ai.error', 'Sorry, I encountered an error. Please try again.'),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    sendMessage(prompt);
  };

  return (
    <div className="flex flex-col h-full -m-4">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Bot size={32} className="text-white" />
            </div>
            <h3 className="font-semibold text-navy-900 dark:text-white mb-2">
              {t('help.ai.welcome.title', 'AI Help Assistant')}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              {t(
                'help.ai.welcome.subtitle',
                "Ask me anything about using Consultinity. I'm here to help!"
              )}
            </p>

            {/* Quick prompts */}
            <div className="space-y-2">
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">
                {t('help.ai.quick.label', 'Quick questions:')}
              </p>
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt.key}
                  onClick={() => handleQuickPrompt(prompt.prompt)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700 text-left text-sm text-slate-600 dark:text-slate-300 transition-colors"
                >
                  <span className="text-violet-500">{prompt.icon}</span>
                  {prompt.label}
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
                                    max-w-[85%] px-3 py-2 rounded-xl text-sm
                                    ${
                                      msg.role === 'user'
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
            <div className="bg-slate-100 dark:bg-navy-800 px-4 py-3 rounded-xl rounded-bl-md">
              <Loader2 size={16} className="animate-spin text-violet-500" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-slate-200 dark:border-navy-700 p-3 bg-white dark:bg-navy-900">
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

  // Safety check: ensure help is available
  if (!help) {
    return (
      <div className="fixed right-0 top-0 h-full w-96 bg-white dark:bg-navy-900 border-l border-slate-200 dark:border-navy-700 z-50 shadow-xl">
        <div className="p-6 text-center text-slate-500 dark:text-slate-400">
          Loading help content...
        </div>
      </div>
    );
  }

  const moduleHelp = help.moduleHelp;
  const cardHelp = help.cardHelp;
  const faqs = help.faqs || [];
  const videos = help.videos || [];

  // Filter FAQs by search
  const filteredFAQs = searchQuery
    ? faqs.filter((faq) => {
        const question = lang === 'pl' ? faq.questionPl : faq.question;
        const answer = lang === 'pl' ? faq.answerPl : faq.answer;
        const q = searchQuery.toLowerCase();
        return (
          (question || '').toLowerCase().includes(q) || (answer || '').toLowerCase().includes(q)
        );
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
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity"
        onClick={() => setOpen(false)}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-[380px] max-w-[90vw] bg-white dark:bg-navy-950 shadow-2xl z-50 flex flex-col animate-slide-in-right border-l border-slate-200 dark:border-navy-700">
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-slate-200 dark:border-navy-700 shrink-0 bg-slate-50 dark:bg-navy-900">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <div className="w-5 h-5 flex items-center justify-center">
              <HelpCircle size={18} className="text-purple-500" />
            </div>
            {moduleHelp && moduleHelp.translationKey
              ? t(`${moduleHelp.translationKey}.name`, moduleHelp.title)
              : moduleHelp?.title || t('help.sidePanel.content.help')}
          </h2>
          <button
            onClick={() => setOpen(false)}
            className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs - styled like FeedbackSidePanel */}
        <div className="flex border-b border-slate-200 dark:border-navy-700 px-2 shrink-0">
          {TABS.map(({ id, icon: Icon, label, labelKey }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all border-b-2 ${
                activeTab === id
                  ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Icon size={14} />
              {t(labelKey, label)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Search */}
          <div className="bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl px-3 py-2.5 flex items-center gap-2 focus-within:ring-2 focus-within:ring-purple-500 focus-within:border-transparent transition-all">
            <Search size={14} className="text-slate-400 dark:text-slate-500" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('help.sidePanel.searchPlaceholder', 'Search help...')}
              className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
          {/* AI Assistant Tab */}
          {activeTab === 'ai' && <AIHelpChat moduleId={help.moduleId} />}

          {/* Overview Tab - Combined with How to Use and Videos */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* Module Title */}
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                {moduleHelp?.translationKey
                  ? t(
                      `${moduleHelp.translationKey}.name`,
                      moduleHelp?.title ||
                        t('help.sidePanel.content.welcome', 'Welcome to Consultinity')
                    )
                  : moduleHelp?.title ||
                    t('help.sidePanel.content.welcome', 'Welcome to Consultinity')}
              </h3>

              {/* Description */}
              {moduleHelp && (
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {moduleHelp.translationKey
                    ? t(`${moduleHelp.translationKey}.description`, moduleHelp.description)
                    : moduleHelp.description}
                </p>
              )}

              {/* Purpose */}
              {moduleHelp?.translationKey && (
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Target size={16} className="text-purple-600 dark:text-purple-400" />
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                      {t('help.sidePanel.content.purpose', 'Purpose')}
                    </h4>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-200">
                    {t(`${moduleHelp.translationKey}.purpose`, 'Purpose of this module')}
                  </p>
                </div>
              )}

              {/* Target Audience */}
              {moduleHelp?.targetAudience && moduleHelp.targetAudience.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Users size={14} className="text-slate-400 dark:text-slate-500" />
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {t('help.sidePanel.audience.for', 'For:')}
                  </span>
                  {moduleHelp.targetAudience.map((audience: any) => {
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
              )}

              {/* Key Features */}
              {moduleHelp?.translationKey && (
                <div>
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white mb-3">
                    <Sparkles size={16} className="text-amber-500 dark:text-amber-400" />
                    {t('help.sidePanel.content.keyFeatures', 'Key Features')}
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
                            className="text-emerald-500 dark:text-emerald-400 flex-shrink-0 mt-0.5"
                          />
                          {feature}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}

              {/* Workflow / How to Use */}
              {moduleHelp?.translationKey && (
                <div>
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white mb-3">
                    <Info size={16} className="text-blue-500 dark:text-blue-400" />
                    {t('help.sidePanel.content.workflow', 'How to Use')}
                  </h4>
                  <ol className="space-y-2">
                    {getTranslatedArray(t, `${moduleHelp.translationKey}.workflow`).map(
                      (step, idx: number) => (
                        <li
                          key={idx}
                          className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300"
                        >
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 dark:bg-navy-800 flex items-center justify-center text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {idx + 1}
                          </span>
                          {step}
                        </li>
                      )
                    )}
                  </ol>
                </div>
              )}

              {/* Tips */}
              {moduleHelp?.translationKey &&
                getTranslatedArray(t, `${moduleHelp.translationKey}.tips`).length > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 rounded-lg p-4">
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-200 mb-3">
                      <Lightbulb size={16} className="text-amber-600 dark:text-amber-400" />
                      {t('help.sidePanel.content.tips', 'Tips')}
                    </h4>
                    <ul className="space-y-2">
                      {getTranslatedArray(t, `${moduleHelp.translationKey}.tips`).map(
                        (tip, idx: number) => (
                          <li
                            key={idx}
                            className="text-sm text-amber-700 dark:text-amber-100 flex items-start gap-2"
                          >
                            <span className="text-amber-500">•</span>
                            {tip}
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                )}

              {/* Video Tutorials Section */}
              {videos.length > 0 && (
                <div>
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white mb-3">
                    <PlayCircle size={16} className="text-purple-500 dark:text-purple-400" />
                    {t('help.sidePanel.tabs.video', 'Video Tutorials')}
                  </h4>
                  <div className="space-y-2">
                    {videos.slice(0, 3).map((video: any) => (
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
                </div>
              )}

              {/* Related Modules Quick Links */}
              {moduleHelp?.relatedModules && moduleHelp.relatedModules.length > 0 && (
                <div className="bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg p-4">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white mb-3">
                    <Link2 size={16} className="text-blue-500 dark:text-blue-400" />
                    {t('help.sidePanel.content.relatedModules', 'Related Modules')}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {moduleHelp.relatedModules.map((relModuleId) => {
                      const relModule = getModuleHelp(relModuleId);
                      if (!relModule) return null;
                      return (
                        <div
                          key={relModuleId}
                          className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-xs"
                        >
                          <DynamicIcon
                            name={relModule.icon || 'Link'}
                            size={14}
                            className="text-slate-500 dark:text-slate-400"
                          />
                          <span className="text-slate-700 dark:text-slate-300">
                            {relModule.translationKey
                              ? t(`${relModule.translationKey}.name`, relModule.title)
                              : relModule.title}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Welcome state when no specific module help */}
              {!moduleHelp && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                    <HelpCircle size={32} className="text-white" />
                  </div>
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
                    {t('help.sidePanel.content.welcomeTitle', 'Welcome to Help Center')}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-[280px] mx-auto">
                    {t(
                      'help.sidePanel.content.welcomeDesc',
                      'Get contextual help for the current page. Navigate to different modules to see specific documentation.'
                    )}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* FAQ Tab */}
          {activeTab === 'faq' && (
            <div className="space-y-4">
              {/* Search in FAQ */}
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('help.sidePanel.faq.searchPlaceholder', 'Search questions...')}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-navy-700 rounded-lg bg-white dark:bg-navy-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* FAQ List */}
              {filteredFAQs.length > 0 ? (
                <div className="bg-white dark:bg-navy-900 rounded-lg border border-slate-200 dark:border-navy-700">
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
                  <HelpCircle
                    size={32}
                    className="mx-auto text-slate-300 dark:text-slate-600 mb-3"
                  />
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    {searchQuery
                      ? t('help.sidePanel.faq.noResults', 'No matching questions found.')
                      : t('help.sidePanel.faq.noFAQ', 'No FAQ available for this module.')}
                  </p>
                  {/* Suggestion to use AI */}
                  <button
                    onClick={() => setActiveTab('ai')}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg text-sm font-medium hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                  >
                    <Bot size={16} />
                    {t('help.sidePanel.faq.askAI', 'Ask AI Assistant')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 flex items-center justify-between gap-3">
          <button
            onClick={() => setOpen(false)}
            className="flex-1 py-2 px-4 bg-white dark:bg-navy-800 border border-slate-300 dark:border-navy-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors"
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
            <span className="hidden sm:inline">
              {t('help.sidePanel.content.fullDocumentation')}
            </span>
            <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </>
  );
};

export default HelpSidePanel;
