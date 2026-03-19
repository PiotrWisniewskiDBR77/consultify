import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Loader2, MessageCircle, Send, Sparkles, X } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

type AnnaMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type AnnaCopy = {
  title: string;
  subtitle: string;
  intro: string;
  placeholder: string;
  send: string;
  open: string;
  loading: string;
  suggestionsLabel: string;
  privacyBadge: string;
  suggestions: string[];
  error: string;
};

const COPY: Record<'en' | 'pl', AnnaCopy> = {
  en: {
    title: 'Anna',
    subtitle: 'Public product assistant',
    intro:
      'I can explain Consultify, DBR77 Vector, digital transformation, demo, trial, and public security topics. I do not have access to client or project data.',
    placeholder: 'Ask Anna about the product...',
    send: 'Send',
    open: 'Ask Anna',
    loading: 'Anna is thinking...',
    suggestionsLabel: 'Try asking:',
    privacyBadge: 'Public knowledge only',
    suggestions: [
      'What is Consultify?',
      'How does DBR77 Vector fit into Consultify?',
      'Who is Consultify for?',
      'Why start with a demo or trial?',
    ],
    error: 'I could not reach Anna. Please try again in a moment.',
  },
  pl: {
    title: 'Anna',
    subtitle: 'Publiczna asystentka produktowa',
    intro:
      'Moge wyjasnic Consultify, DBR77 Vector, transformacje cyfrowa, demo, trial i publiczne kwestie bezpieczenstwa. Nie mam dostepu do danych klienta ani projektow.',
    placeholder: 'Zapytaj Anne o produkt...',
    send: 'Wyslij',
    open: 'Zapytaj Anne',
    loading: 'Anna analizuje...',
    suggestionsLabel: 'Mozesz zapytac:',
    privacyBadge: 'Tylko wiedza publiczna',
    suggestions: [
      'Czym jest Consultify?',
      'Jak DBR77 Vector wspiera Consultify?',
      'Dla kogo jest Consultify?',
      'Dlaczego warto zaczac od demo lub triala?',
    ],
    error: 'Nie udalo sie polaczyc z Anna. Sprobuj ponownie za chwile.',
  },
};

export const AnnaAssistantWidget: React.FC = () => {
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage?.startsWith('pl') ? 'pl' : 'en';
  const copy = COPY[lang];

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<AnnaMessage[]>(() => [
    {
      id: 'anna-welcome',
      role: 'assistant',
      content: copy.intro,
    },
  ]);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMessages([
      {
        id: 'anna-welcome',
        role: 'assistant',
        content: copy.intro,
      },
    ]);
  }, [copy.intro]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    const openAnna = () => setIsOpen(true);
    window.addEventListener('anna:open', openAnna);
    return () => window.removeEventListener('anna:open', openAnna);
  }, []);

  const history = useMemo(
    () =>
      messages
        .filter((message) => message.id !== 'anna-welcome')
        .slice(-8)
        .map((message) => ({
          role: message.role,
          content: message.content,
        })),
    [messages]
  );

  const sendMessage = async (preset?: string) => {
    const content = (preset || input).trim();
    if (!content || isLoading) return;

    const userMessage: AnnaMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/public/anna/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          locale: i18n.resolvedLanguage || i18n.language || lang,
          history,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const answer = typeof data?.message === 'string' ? data.message.trim() : '';
      if (!answer) {
        throw new Error('Empty response');
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: answer,
        },
      ]);
    } catch (err) {
      console.error('[AnnaAssistantWidget] Request failed', err);
      setError(copy.error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed right-5 bottom-5 z-[180] flex max-w-[calc(100vw-1.5rem)] flex-col items-end gap-3">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="w-[380px] max-w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0E0A25]/95 shadow-[0_24px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/8 bg-white/[0.03] px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
                  <Bot size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white">{copy.title}</p>
                    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                      {copy.privacyBadge}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-white/55">{copy.subtitle}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full p-1.5 text-white/45 transition-colors hover:bg-white/8 hover:text-white"
                aria-label="Close Anna"
              >
                <X size={16} />
              </button>
            </div>

            <div className="max-h-[430px] overflow-y-auto px-4 py-4">
              <div className="space-y-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        message.role === 'user'
                          ? 'bg-violet-600 text-white'
                          : 'bg-white/[0.06] text-white/85'
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="inline-flex items-center gap-2 rounded-2xl bg-white/[0.06] px-4 py-3 text-sm text-white/70">
                      <Loader2 size={15} className="animate-spin" />
                      <span>{copy.loading}</span>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="rounded-2xl border border-red-400/15 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {error}
                  </div>
                )}

                {messages.length <= 1 && !isLoading && (
                  <div className="pt-1">
                    <p className="mb-2 text-xs font-medium text-white/45">{copy.suggestionsLabel}</p>
                    <div className="flex flex-wrap gap-2">
                      {copy.suggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => void sendMessage(suggestion)}
                          className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-left text-xs text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div ref={scrollRef} />
              </div>
            </div>

            <div className="border-t border-white/8 px-4 py-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                  rows={1}
                  placeholder={copy.placeholder}
                  className="min-h-[44px] flex-1 resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-violet-400/40"
                />
                <button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={!input.trim() || isLoading}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-600 text-white transition-all hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30"
                  aria-label={copy.send}
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="group inline-flex items-center gap-3 rounded-full border border-white/10 bg-[#140D31]/95 px-4 py-3 text-white shadow-[0_16px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-all hover:bg-[#19123A]"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-[0_0_30px_rgba(168,85,247,0.35)]">
          {isOpen ? <X size={18} /> : <MessageCircle size={18} />}
        </div>
        <div className="hidden text-left sm:block">
          <p className="flex items-center gap-1 text-sm font-semibold text-white">
            <span>{copy.open}</span>
            <Sparkles size={13} className="text-violet-300" />
          </p>
          <p className="text-[11px] text-white/45">{copy.privacyBadge}</p>
        </div>
      </button>
    </div>
  );
};

export default AnnaAssistantWidget;
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Loader2, MessageCircle, Send, Sparkles, X } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

type AnnaMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type AnnaCopy = {
  title: string;
  subtitle: string;
  intro: string;
  placeholder: string;
  send: string;
  open: string;
  loading: string;
  suggestionsLabel: string;
  privacyBadge: string;
  suggestions: string[];
  error: string;
};

const COPY: Record<'en' | 'pl', AnnaCopy> = {
  en: {
    title: 'Anna',
    subtitle: 'Public product assistant',
    intro:
      'I can explain Consultify, DBR77 Vector, digital transformation, demo, trial, and public security topics. I do not have access to client or project data.',
    placeholder: 'Ask Anna about the product...',
    send: 'Send',
    open: 'Ask Anna',
    loading: 'Anna is thinking...',
    suggestionsLabel: 'Try asking:',
    privacyBadge: 'Public knowledge only',
    suggestions: [
      'What is Consultify?',
      'How does DBR77 Vector fit into Consultify?',
      'Who is Consultify for?',
      'Why start with a demo or trial?',
    ],
    error: 'I could not reach Anna. Please try again in a moment.',
  },
  pl: {
    title: 'Anna',
    subtitle: 'Publiczna asystentka produktowa',
    intro:
      'Moge wyjasnic Consultify, DBR77 Vector, transformacje cyfrowa, demo, trial i publiczne kwestie bezpieczenstwa. Nie mam dostepu do danych klienta ani projektow.',
    placeholder: 'Zapytaj Anne o produkt...',
    send: 'Wyslij',
    open: 'Zapytaj Anne',
    loading: 'Anna analizuje...',
    suggestionsLabel: 'Mozesz zapytac:',
    privacyBadge: 'Tylko wiedza publiczna',
    suggestions: [
      'Czym jest Consultify?',
      'Jak DBR77 Vector wspiera Consultify?',
      'Dla kogo jest Consultify?',
      'Dlaczego warto zaczac od demo lub triala?',
    ],
    error: 'Nie udalo sie polaczyc z Anna. Sprobuj ponownie za chwile.',
  },
};

export const AnnaAssistantWidget: React.FC = () => {
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage?.startsWith('pl') ? 'pl' : 'en';
  const copy = COPY[lang];

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<AnnaMessage[]>(() => [
    {
      id: 'anna-welcome',
      role: 'assistant',
      content: copy.intro,
    },
  ]);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMessages([
      {
        id: 'anna-welcome',
        role: 'assistant',
        content: copy.intro,
      },
    ]);
  }, [copy.intro]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    const openAnna = () => setIsOpen(true);
    window.addEventListener('anna:open', openAnna);
    return () => window.removeEventListener('anna:open', openAnna);
  }, []);

  const history = useMemo(
    () =>
      messages
        .filter((message) => message.id !== 'anna-welcome')
        .slice(-8)
        .map((message) => ({
          role: message.role,
          content: message.content,
        })),
    [messages]
  );

  const sendMessage = async (preset?: string) => {
    const content = (preset || input).trim();
    if (!content || isLoading) return;

    const userMessage: AnnaMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/public/anna/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          locale: i18n.resolvedLanguage || i18n.language || lang,
          history,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const answer = typeof data?.message === 'string' ? data.message.trim() : '';
      if (!answer) {
        throw new Error('Empty response');
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: answer,
        },
      ]);
    } catch (err) {
      console.error('[AnnaAssistantWidget] Request failed', err);
      setError(copy.error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed right-5 bottom-5 z-[180] flex max-w-[calc(100vw-1.5rem)] flex-col items-end gap-3">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="w-[380px] max-w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0E0A25]/95 shadow-[0_24px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/8 bg-white/[0.03] px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
                  <Bot size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white">{copy.title}</p>
                    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                      {copy.privacyBadge}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-white/55">{copy.subtitle}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full p-1.5 text-white/45 transition-colors hover:bg-white/8 hover:text-white"
                aria-label="Close Anna"
              >
                <X size={16} />
              </button>
            </div>

            <div className="max-h-[430px] overflow-y-auto px-4 py-4">
              <div className="space-y-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        message.role === 'user'
                          ? 'bg-violet-600 text-white'
                          : 'bg-white/[0.06] text-white/85'
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="inline-flex items-center gap-2 rounded-2xl bg-white/[0.06] px-4 py-3 text-sm text-white/70">
                      <Loader2 size={15} className="animate-spin" />
                      <span>{copy.loading}</span>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="rounded-2xl border border-red-400/15 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {error}
                  </div>
                )}

                {messages.length <= 1 && !isLoading && (
                  <div className="pt-1">
                    <p className="mb-2 text-xs font-medium text-white/45">{copy.suggestionsLabel}</p>
                    <div className="flex flex-wrap gap-2">
                      {copy.suggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => void sendMessage(suggestion)}
                          className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-left text-xs text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div ref={scrollRef} />
              </div>
            </div>

            <div className="border-t border-white/8 px-4 py-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                  rows={1}
                  placeholder={copy.placeholder}
                  className="min-h-[44px] flex-1 resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-violet-400/40"
                />
                <button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={!input.trim() || isLoading}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-600 text-white transition-all hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30"
                  aria-label={copy.send}
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="group inline-flex items-center gap-3 rounded-full border border-white/10 bg-[#140D31]/95 px-4 py-3 text-white shadow-[0_16px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-all hover:bg-[#19123A]"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-[0_0_30px_rgba(168,85,247,0.35)]">
          {isOpen ? <X size={18} /> : <MessageCircle size={18} />}
        </div>
        <div className="hidden text-left sm:block">
          <p className="flex items-center gap-1 text-sm font-semibold text-white">
            <span>{copy.open}</span>
            <Sparkles size={13} className="text-violet-300" />
          </p>
          <p className="text-[11px] text-white/45">{copy.privacyBadge}</p>
        </div>
      </button>
    </div>
  );
};

export default AnnaAssistantWidget;
