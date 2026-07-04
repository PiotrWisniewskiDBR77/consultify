/**
 * Help Chatbot Component
 *
 * AI-powered help assistant that answers questions using
 * the help content knowledge base.
 */
import { AnimatePresence, motion } from 'framer-motion';
import {
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
import TeresaMark from '../shared/TeresaMark';

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

export const HelpChatbot: React.FC<HelpChatbotProps> = ({
  onClose,
  initialQuestion,
  contextModule,
}) => {
  const { i18n } = useTranslation();
  const SUPPORTED = ['en', 'pl', 'de', 'ar', 'jp', 'es'] as const;
  const baseLang = (i18n.language || 'en').split('-')[0].toLowerCase();
  const lang = (SUPPORTED as readonly string[]).includes(baseLang) ? baseLang : 'en';

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

  const welcomeMessages: Record<string, string> = {
    en: "Hi! I'm Teresa — your Consultify assistant. How can I help you today? I answer questions based on our knowledge base and always cite my sources.",
    pl: 'Cześć! Jestem Teresa — Twój asystent w Consultify. Jak mogę Ci dzisiaj pomóc? Odpowiadam na pytania na podstawie bazy wiedzy — zawsze podaję źródło.',
    de: 'Hallo! Ich bin Teresa — Ihre Consultify-Assistentin. Wie kann ich Ihnen heute helfen? Ich beantworte Fragen auf Basis unserer Wissensdatenbank und nenne immer die Quelle.',
    ar: 'مرحباً! أنا تيريزا — مساعدتك في Consultify. كيف يمكنني مساعدتك اليوم؟ أجيب على الأسئلة بناءً على قاعدة المعرفة لدينا وأستشهد دائماً بالمصادر.',
    jp: 'こんにちは！テレサです — Consultifyのアシスタントです。今日はどのようにお手伝いできますか？ナレッジベースに基づいて回答し、常に出典を示します。',
    es: '¡Hola! Soy Teresa — tu asistente en Consultify. ¿Cómo puedo ayudarte hoy? Respondo preguntas basándome en nuestra base de conocimiento y siempre cito las fuentes.',
  };

  const suggestionsByLang: Record<string, string[]> = {
    en: [
      'How do I create a new initiative?',
      'How do I manage project team?',
      'How to use AI for analysis?',
      'How to generate reports?',
    ],
    pl: [
      'Jak stworzyć nową inicjatywę?',
      'Jak zarządzać zespołem projektu?',
      'Jak używać AI do analizy?',
      'Jak generować raporty?',
    ],
    de: [
      'Wie erstelle ich eine neue Initiative?',
      'Wie verwalte ich das Projektteam?',
      'Wie nutze ich KI für Analysen?',
      'Wie erstelle ich Berichte?',
    ],
    ar: [
      'كيف أنشئ مبادرة جديدة؟',
      'كيف أدير فريق المشروع؟',
      'كيف أستخدم الذكاء الاصطناعي للتحليل؟',
      'كيف أنشئ التقارير؟',
    ],
    jp: [
      '新しいイニシアチブの作成方法は？',
      'プロジェクトチームの管理方法は？',
      'AI分析の使い方は？',
      'レポートの生成方法は？',
    ],
    es: [
      '¿Cómo creo una nueva iniciativa?',
      '¿Cómo gestiono el equipo del proyecto?',
      '¿Cómo uso la IA para análisis?',
      '¿Cómo genero informes?',
    ],
  };

  useEffect(() => {
    const welcomeMessage: Message = {
      id: 'welcome',
      role: 'assistant',
      content: welcomeMessages[lang] || welcomeMessages.en,
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
  }, [lang]);

  const suggestions = suggestionsByLang[lang] || suggestionsByLang.en;

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
          language: lang,
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
            {
              en: 'Sorry, an error occurred. Please try again later.',
              pl: 'Przepraszam, wystąpił błąd. Spróbuj ponownie później.',
              de: 'Entschuldigung, ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.',
              ar: 'عذراً، حدث خطأ. يرجى المحاولة مرة أخرى لاحقاً.',
              jp: '申し訳ございません。エラーが発生しました。後でもう一度お試しください。',
              es: 'Lo sentimos, ocurrió un error. Inténtalo de nuevo más tarde.',
            }[lang] || 'Sorry, an error occurred. Please try again later.',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [input, isLoading, contextModule, messages, lang]
  );

  // Handle feedback
  const handleFeedback = useCallback(async (messageId: string, isHelpful: boolean) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, feedback: isHelpful ? 'helpful' : 'not_helpful' } : m
      )
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

  const clearMessages: Record<string, string> = {
    en: 'Chat has been cleared. How can I help you?',
    pl: 'Rozmowa została wyczyszczona. Jak mogę Ci pomóc?',
    de: 'Chat wurde gelöscht. Wie kann ich Ihnen helfen?',
    ar: 'تم مسح المحادثة. كيف يمكنني مساعدتك؟',
    jp: 'チャットがクリアされました。どのようにお手伝いしますか？',
    es: 'El chat ha sido borrado. ¿Cómo puedo ayudarte?',
  };

  const handleClear = () => {
    setMessages([
      {
        id: 'welcome-new',
        role: 'assistant',
        content: clearMessages[lang] || clearMessages.en,
        timestamp: new Date(),
      },
    ]);
    setShowSuggestions(true);
  };

  type L6 = Record<string, string>;
  const l = (dict: L6) => dict[lang] || dict.en;
  const t: Record<string, L6> = {
    title: {
      en: 'Teresa — Help',
      pl: 'Teresa — Pomoc',
      de: 'Teresa — Hilfe',
      ar: 'تيريزا — مساعدة',
      jp: 'テレサ — ヘルプ',
      es: 'Teresa — Ayuda',
    },
    placeholder: {
      en: 'Ask Teresa a question...',
      pl: 'Zapytaj Teresę...',
      de: 'Fragen Sie Teresa...',
      ar: 'اسأل تيريزا...',
      jp: 'テレサに質問...',
      es: 'Pregunta a Teresa...',
    },
    send: { en: 'Send', pl: 'Wyślij', de: 'Senden', ar: 'إرسال', jp: '送信', es: 'Enviar' },
    typing: {
      en: 'Typing...',
      pl: 'Pisze...',
      de: 'Schreibt...',
      ar: 'يكتب...',
      jp: '入力中...',
      es: 'Escribiendo...',
    },
    clear: {
      en: 'Clear chat',
      pl: 'Wyczyść czat',
      de: 'Chat löschen',
      ar: 'مسح المحادثة',
      jp: 'チャットをクリア',
      es: 'Borrar chat',
    },
    sources: {
      en: 'Sources',
      pl: 'Źródła',
      de: 'Quellen',
      ar: 'المصادر',
      jp: '出典',
      es: 'Fuentes',
    },
    helpful: {
      en: 'Was this helpful?',
      pl: 'Czy to było pomocne?',
      de: 'War das hilfreich?',
      ar: 'هل كان هذا مفيداً؟',
      jp: '役に立ちましたか？',
      es: '¿Fue útil?',
    },
    suggestions: {
      en: 'Suggested questions',
      pl: 'Sugerowane pytania',
      de: 'Vorgeschlagene Fragen',
      ar: 'أسئلة مقترحة',
      jp: 'おすすめの質問',
      es: 'Preguntas sugeridas',
    },
    poweredBy: {
      en: 'Knowledge-grounded AI',
      pl: 'AI oparte na bazie wiedzy',
      de: 'Wissensbasierte KI',
      ar: 'ذكاء اصطناعي مبني على المعرفة',
      jp: 'ナレッジベースAI',
      es: 'IA basada en conocimiento',
    },
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
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-primary-600 to-crimson-600 text-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <TeresaMark size={18} />
          </div>
          <div>
            <h3 className="font-semibold">{t.title[lang]}</h3>
            <p className="text-xs text-primary-200 flex items-center gap-1">
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
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            >
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
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600'
                        : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600'
                    }`}
                  >
                    {message.role === 'user' ? <User size={14} /> : <TeresaMark size={14} />}
                  </div>

                  <div
                    className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    {/* Message bubble */}
                    <div
                      className={`px-4 py-2.5 rounded-xl ${
                        message.role === 'user'
                          ? 'bg-navy-900 text-white rounded-tr-md'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-md'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>

                    {/* Sources */}
                    {message.sources && message.sources.length > 0 && (
                      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-medium">{t.sources[lang]}:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {message.sources.map((source, i) => {
                            const articleSlug = source.id?.startsWith('kb_')
                              ? source.id.replace(/^kb_/, '')
                              : '';
                            const deepLink = articleSlug
                              ? `${window.location.pathname}?help_article=${encodeURIComponent(articleSlug)}&help_tab=knowledge`
                              : undefined;
                            return (
                              <button
                                key={i}
                                onClick={() => {
                                  if (deepLink) {
                                    window.history.pushState({}, '', deepLink);
                                    window.dispatchEvent(new PopStateEvent('popstate'));
                                  }
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 cursor-pointer"
                              >
                                <HelpCircle size={10} />
                                {source.title}
                                <ExternalLink size={10} />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Feedback */}
                    {message.role === 'assistant' &&
                      message.id !== 'welcome' &&
                      !message.feedback && (
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-slate-600 dark:text-slate-500">
                            {t.helpful[lang]}
                          </span>
                          <button
                            onClick={() => handleFeedback(message.id, true)}
                            className="p-1 text-slate-600 dark:text-slate-500 hover:text-green-500 transition-colors"
                          >
                            <ThumbsUp size={14} />
                          </button>
                          <button
                            onClick={() => handleFeedback(message.id, false)}
                            className="p-1 text-slate-600 dark:text-slate-500 hover:text-danger-500 transition-colors"
                          >
                            <ThumbsDown size={14} />
                          </button>
                        </div>
                      )}
                    {message.feedback && (
                      <div
                        className={`text-xs mt-1 ${
                          message.feedback === 'helpful' ? 'text-green-500' : 'text-danger-500'
                        }`}
                      >
                        {message.feedback === 'helpful'
                          ? {
                              en: '✓ Thanks for your feedback!',
                              pl: '✓ Dziękujemy za opinię!',
                              de: '✓ Danke für Ihr Feedback!',
                              ar: '✓ شكراً على ملاحظاتك!',
                              jp: '✓ フィードバックありがとうございます！',
                              es: '✓ ¡Gracias por tu opinión!',
                            }[lang] || '✓ Thanks for your feedback!'
                          : {
                              en: "✓ Sorry, we'll try to improve!",
                              pl: '✓ Przepraszamy, postaramy się poprawić!',
                              de: '✓ Entschuldigung, wir werden versuchen uns zu verbessern!',
                              ar: '✓ عذراً، سنحاول التحسين!',
                              jp: '✓ 申し訳ございません、改善に努めます！',
                              es: '✓ Lo sentimos, intentaremos mejorar!',
                            }[lang] || "✓ Sorry, we'll try to improve!"}
                      </div>
                    )}

                    {/* Timestamp */}
                    <span className="text-[10px] text-slate-600 dark:text-slate-500 mt-1">
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-start gap-2"
          >
            <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center">
              <TeresaMark size={14} />
            </div>
            <div className="px-4 py-2.5 bg-slate-100 dark:bg-slate-700 rounded-xl rounded-tl-md">
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
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{t.suggestions[lang]}</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion, i) => (
              <button
                key={i}
                onClick={() => handleSend(suggestion)}
                className="px-3 py-1.5 text-xs bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded-full hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
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
            className="flex-grow px-4 py-2.5 bg-slate-100 dark:bg-slate-700 border-0 rounded-xl text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 resize-none focus:ring-2 focus:ring-c-focus focus:outline-none"
            style={{ minHeight: '44px', maxHeight: '120px' }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className={`p-3 rounded-xl transition-all ${
              input.trim() && !isLoading
                ? 'bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] hover:bg-navy-800'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-500 cursor-not-allowed'
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
