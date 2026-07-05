/**
 * CategoryChat
 *
 * Standalone chat component for a single interview category.
 * Can be used in modal or inline context.
 */
import { Loader2, Send, User } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { sendMessageToAI } from '@/services/ai/gemini';
import { useAppStore } from '@/store/useAppStore';

import TeresaMark from '../shared/TeresaMark';

type InsightCategory =
  | 'objective'
  | 'stakeholder'
  | 'risk'
  | 'assumption'
  | 'constraint'
  | 'decision'
  | 'dependency'
  | 'success_criteria';

interface CategoryChatProps {
  category: InsightCategory;
  categoryLabel: string;
  categoryDescription: string;
  initialPrompts: string[];
  onAnswerSaved?: (answers: Array<{ question: string; answer: string }>) => void;
  onComplete?: (summary: string) => void;
  existingAnswers?: Array<{ question: string; answer: string; aiResponse?: string }>;
}

export const CategoryChat: React.FC<CategoryChatProps> = ({
  category,
  categoryLabel,
  categoryDescription,
  initialPrompts,
  onAnswerSaved,
  onComplete,
  existingAnswers = [],
}) => {
  const { currentUser } = useAppStore();
  const language = currentUser?.preferredLanguage || 'en';

  const [messages, setMessages] = useState<Array<{ role: 'user' | 'ai'; content: string }>>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize messages
  useEffect(() => {
    if (existingAnswers.length > 0) {
      // Restore from existing answers
      const restored: Array<{ role: 'user' | 'ai'; content: string }> = [];
      existingAnswers.forEach((qa) => {
        if (qa.question) restored.push({ role: 'ai', content: qa.question });
        if (qa.answer) restored.push({ role: 'user', content: qa.answer });
        if (qa.aiResponse) restored.push({ role: 'ai', content: qa.aiResponse });
      });
      setMessages(restored);
      setQuestionIndex(existingAnswers.length);
    } else {
      // Start fresh
      setMessages([
        {
          role: 'ai',
          content: `Let's discuss **${categoryLabel}**. ${categoryDescription}\n\n${initialPrompts[0]}`,
        },
      ]);
      setQuestionIndex(1);
    }
  }, [categoryLabel, categoryDescription, initialPrompts, existingAnswers]);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message
  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const conversationHistory = messages
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join('\n');

      const systemPrompt = `
You are an expert PMO consultant conducting a structured interview.
Category: ${categoryLabel} - ${categoryDescription}
Language: ${language === 'pl' ? 'Polish' : 'English'}

Conversation so far:
${conversationHistory}

User's response: ${userMessage}

${
  questionIndex < initialPrompts.length
    ? `Ask this follow-up question naturally: "${initialPrompts[questionIndex]}"`
    : 'Provide a brief summary of what you learned and thank the user.'
}

Be professional and concise.
      `;

      const aiResponse = await sendMessageToAI([], systemPrompt);
      setMessages((prev) => [...prev, { role: 'ai', content: aiResponse }]);
      setQuestionIndex((prev) => prev + 1);

      // Notify parent
      if (onAnswerSaved) {
        const qa = messages
          .filter((m) => m.role === 'user')
          .map((m, i) => ({
            question: messages[i * 2]?.content || '',
            answer: m.content,
          }));
        qa.push({ question: messages[messages.length - 1]?.content || '', answer: userMessage });
        onAnswerSaved(qa);
      }

      // Check if complete
      if (questionIndex >= initialPrompts.length && onComplete) {
        onComplete(aiResponse);
      }
    } catch (error) {
      console.error('[CategoryChat] Error:', error);
      setMessages((prev) => [
        ...prev,
        { role: 'ai', content: 'I encountered an error. Please try again.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [
    inputValue,
    isLoading,
    messages,
    questionIndex,
    initialPrompts,
    categoryLabel,
    categoryDescription,
    language,
    onAnswerSaved,
    onComplete,
  ]);

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((message, idx) => (
          <div
            key={idx}
            className={`flex gap-2 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`
                w-7 h-7 rounded-token-pill flex items-center justify-center shrink-0
                ${message.role === 'user' ? 'bg-[var(--c-surface-raised)]' : 'bg-[var(--c-text)]'}
              `}
            >
              {message.role === 'user' ? (
                <User size={12} className="text-[var(--c-text-secondary)]" />
              ) : (
                <TeresaMark size={12} className="text-[var(--c-surface)]" />
              )}
            </div>
            <div
              className={`
                max-w-[85%] px-3 py-2 rounded-token-md text-sm
                ${
                  message.role === 'user'
                    ? 'bg-[var(--c-surface-raised)] text-[var(--c-text)]'
                    : 'bg-[var(--c-surface-raised)] border border-[var(--c-border-subtle)] text-[var(--c-text)]'
                }
              `}
            >
              {message.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-token-pill bg-[var(--c-text)] flex items-center justify-center shrink-0">
              <TeresaMark size={12} className="text-[var(--c-surface)]" />
            </div>
            <div className="px-3 py-2 bg-[var(--c-surface-raised)] border border-[var(--c-border-subtle)] rounded-token-md">
              <Loader2 size={14} className="text-[var(--c-accent)] animate-spin" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 p-3 border-t border-[var(--c-border-subtle)]">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type your answer..."
            className="flex-1 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-token-md px-3 py-2 text-sm text-[var(--c-text)] placeholder:text-[var(--c-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--c-focus)]"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className="px-3 bg-[var(--c-text)] text-[var(--c-surface)] hover:brightness-110 disabled:opacity-50 rounded-token-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CategoryChat;
