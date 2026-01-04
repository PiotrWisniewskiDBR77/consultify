/**
 * Help Chatbot Component
 *
 * AI-powered help assistant that answers questions using
 * the help content knowledge base.
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
    Bot,
    ExternalLink,
    HelpCircle,
    Maximize2,
    MessageCircle,
    Minimize2,
    RefreshCw,
    Send,
    Sparkles,
    ThumbsDown,
    ThumbsUp,
    User,
    X,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Api from '../../services/api';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    sources?: { id: string; type: string; title: string }[];
    feedback?: 'helpful' | 'not_helpful';
}

interface HelpChatbotProps {
    onClose?: () => void;
    initialQuestion?: string;
    contextModule?: string;
}

export const HelpChatbot: React.FC<HelpChatbotProps> = ({ onClose, initialQuestion, contextModule }) => {
    const { i18n } = useTranslation();
    const lang = i18n.language === 'pl' ? 'pl' : 'en';

    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState(initialQuestion || '');
    const [isLoading, setIsLoading] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(true);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Scroll to bottom
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Add welcome message
    useEffect(() => {
        const welcomeMessage: Message = {
            id: 'welcome',
            role: 'assistant',
            content:
                lang === 'pl'
                    ? 'Cześć! Jestem Twoim asystentem Consultify. Jak mogę Ci dzisiaj pomóc? Możesz zapytać o dowolną funkcję aplikacji.'
                    : "Hi! I'm your Consultify assistant. How can I help you today? Feel free to ask about any feature of the application.",
            timestamp: new Date(),
        };
        setMessages([welcomeMessage]);
    }, [lang]);

    // Suggested questions
    const suggestions =
        lang === 'pl'
            ? [
                  'Jak stworzyć nową inicjatywę?',
                  'Jak zarządzać zespołem projektu?',
                  'Jak używać AI do analizy?',
                  'Jak generować raporty?',
              ]
            : [
                  'How do I create a new initiative?',
                  'How do I manage project team?',
                  'How to use AI for analysis?',
                  'How to generate reports?',
              ];

    // Send message
    const handleSend = useCallback(
        async (messageText?: string) => {
            const text = messageText || input.trim();
            if (!text || isLoading) return;

            setShowSuggestions(false);
            setInput('');

            // Add user message
            const userMessage: Message = {
                id: `user-${Date.now()}`,
                role: 'user',
                content: text,
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, userMessage]);

            setIsLoading(true);

            try {
                const response = await Api.post('/help/chat', {
                    message: text,
                    context: contextModule,
                    history: messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
                });

                const assistantMessage: Message = {
                    id: `assistant-${Date.now()}`,
                    role: 'assistant',
                    content: response.data.message,
                    timestamp: new Date(),
                    sources: response.data.sources,
                };
                setMessages((prev) => [...prev, assistantMessage]);
            } catch (error) {
                console.error('Chat error:', error);
                const errorMessage: Message = {
                    id: `error-${Date.now()}`,
                    role: 'assistant',
                    content:
                        lang === 'pl'
                            ? 'Przepraszam, wystąpił błąd. Spróbuj ponownie później.'
                            : 'Sorry, an error occurred. Please try again later.',
                    timestamp: new Date(),
                };
                setMessages((prev) => [...prev, errorMessage]);
            } finally {
                setIsLoading(false);
            }
        },
        [input, isLoading, contextModule, messages, lang],
    );

    // Handle feedback
    const handleFeedback = useCallback(async (messageId: string, isHelpful: boolean) => {
        setMessages((prev) =>
            prev.map((m) => (m.id === messageId ? { ...m, feedback: isHelpful ? 'helpful' : 'not_helpful' } : m)),
        );

        try {
            await Api.post('/help/feedback', {
                content_type: 'chat',
                content_id: messageId,
                is_helpful: isHelpful,
            });
        } catch (error) {
            console.error('Failed to submit feedback:', error);
        }
    }, []);

    // Handle key press
    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Clear chat
    const handleClear = () => {
        setMessages([
            {
                id: 'welcome-new',
                role: 'assistant',
                content:
                    lang === 'pl'
                        ? 'Rozmowa została wyczyszczona. Jak mogę Ci pomóc?'
                        : 'Chat has been cleared. How can I help you?',
                timestamp: new Date(),
            },
        ]);
        setShowSuggestions(true);
    };

    // Text
    const t = {
        title: { en: 'Help Assistant', pl: 'Asystent Pomocy' },
        placeholder: { en: 'Ask a question...', pl: 'Zadaj pytanie...' },
        send: { en: 'Send', pl: 'Wyślij' },
        typing: { en: 'Typing...', pl: 'Pisze...' },
        clear: { en: 'Clear chat', pl: 'Wyczyść czat' },
        sources: { en: 'Sources', pl: 'Źródła' },
        helpful: { en: 'Was this helpful?', pl: 'Czy to było pomocne?' },
        suggestions: { en: 'Suggested questions', pl: 'Sugerowane pytania' },
        poweredBy: { en: 'Powered by AI', pl: 'Napędzany przez AI' },
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`bg-white dark:bg-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col ${
                isExpanded ? 'fixed inset-4 z-50' : 'w-96 h-[500px]'
            }`}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                        <Bot size={18} />
                    </div>
                    <div>
                        <h3 className="font-semibold">{t.title[lang]}</h3>
                        <p className="text-xs text-purple-200 flex items-center gap-1">
                            <Sparkles size={12} />
                            {t.poweredBy[lang]}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                        title={isExpanded ? 'Minimize' : 'Maximize'}
                    >
                        {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                    </button>
                    <button
                        onClick={handleClear}
                        className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                        title={t.clear[lang]}
                    >
                        <RefreshCw size={18} />
                    </button>
                    {onClose && (
                        <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                            <X size={18} />
                        </button>
                    )}
                </div>
            </div>

            {/* Messages */}
            <div className="flex-grow overflow-y-auto p-4 space-y-4">
                <AnimatePresence>
                    {messages.map((message) => (
                        <motion.div
                            key={message.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div className={`max-w-[85%] ${message.role === 'user' ? 'order-2' : 'order-1'}`}>
                                {/* Avatar */}
                                <div
                                    className={`flex items-start gap-2 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                                >
                                    <div
                                        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                                            message.role === 'user'
                                                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600'
                                                : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600'
                                        }`}
                                    >
                                        {message.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                                    </div>

                                    <div
                                        className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}
                                    >
                                        {/* Message bubble */}
                                        <div
                                            className={`px-4 py-2.5 rounded-2xl ${
                                                message.role === 'user'
                                                    ? 'bg-purple-600 text-white rounded-tr-md'
                                                    : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-md'
                                            }`}
                                        >
                                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                        </div>

                                        {/* Sources */}
                                        {message.sources && message.sources.length > 0 && (
                                            <div className="mt-2 text-xs text-slate-500">
                                                <span className="font-medium">{t.sources[lang]}:</span>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {message.sources.map((source, i) => (
                                                        <a
                                                            key={i}
                                                            href="#"
                                                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600"
                                                        >
                                                            <HelpCircle size={10} />
                                                            {source.title}
                                                            <ExternalLink size={10} />
                                                        </a>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Feedback */}
                                        {message.role === 'assistant' &&
                                            message.id !== 'welcome' &&
                                            !message.feedback && (
                                                <div className="flex items-center gap-2 mt-2">
                                                    <span className="text-xs text-slate-400">{t.helpful[lang]}</span>
                                                    <button
                                                        onClick={() => handleFeedback(message.id, true)}
                                                        className="p-1 text-slate-400 hover:text-green-500 transition-colors"
                                                    >
                                                        <ThumbsUp size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleFeedback(message.id, false)}
                                                        className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                                                    >
                                                        <ThumbsDown size={14} />
                                                    </button>
                                                </div>
                                            )}
                                        {message.feedback && (
                                            <div
                                                className={`text-xs mt-1 ${
                                                    message.feedback === 'helpful' ? 'text-green-500' : 'text-red-500'
                                                }`}
                                            >
                                                {message.feedback === 'helpful'
                                                    ? lang === 'pl'
                                                        ? '✓ Dziękujemy za opinię!'
                                                        : '✓ Thanks for your feedback!'
                                                    : lang === 'pl'
                                                      ? '✓ Przepraszamy, postaramy się poprawić!'
                                                      : "✓ Sorry, we'll try to improve!"}
                                            </div>
                                        )}

                                        {/* Timestamp */}
                                        <span className="text-[10px] text-slate-400 mt-1">
                                            {message.timestamp.toLocaleTimeString([], {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {/* Loading indicator */}
                {isLoading && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-2">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center">
                            <Bot size={14} />
                        </div>
                        <div className="px-4 py-2.5 bg-slate-100 dark:bg-slate-700 rounded-2xl rounded-tl-md">
                            <div className="flex items-center gap-1">
                                <span
                                    className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                                    style={{ animationDelay: '0ms' }}
                                />
                                <span
                                    className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                                    style={{ animationDelay: '150ms' }}
                                />
                                <span
                                    className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                                    style={{ animationDelay: '300ms' }}
                                />
                            </div>
                        </div>
                    </motion.div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Suggestions */}
            {showSuggestions && messages.length <= 1 && (
                <div className="px-4 pb-2">
                    <p className="text-xs text-slate-500 mb-2">{t.suggestions[lang]}</p>
                    <div className="flex flex-wrap gap-2">
                        {suggestions.map((suggestion, i) => (
                            <button
                                key={i}
                                onClick={() => handleSend(suggestion)}
                                className="px-3 py-1.5 text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-full hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                            >
                                {suggestion}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Input */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-end gap-2">
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder={t.placeholder[lang]}
                        rows={1}
                        className="flex-grow px-4 py-2.5 bg-slate-100 dark:bg-slate-700 border-0 rounded-xl text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 resize-none focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        style={{ minHeight: '44px', maxHeight: '120px' }}
                    />
                    <button
                        onClick={() => handleSend()}
                        disabled={!input.trim() || isLoading}
                        className={`p-3 rounded-xl transition-all ${
                            input.trim() && !isLoading
                                ? 'bg-purple-600 text-white hover:bg-purple-700'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                        }`}
                    >
                        <Send size={18} />
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

export default HelpChatbot;


