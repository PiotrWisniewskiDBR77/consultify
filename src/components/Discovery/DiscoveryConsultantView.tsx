/**
 * DiscoveryConsultantView - Main view component
 *
 * Split-screen view with chat panel on the left and discovery canvas on the right.
 * This is the main entry point for the Discovery Consultant module.
 */

import { Bot, Loader2, Send, Sparkles } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAIStream } from '@/hooks/useAIStream';
import { useAppStore } from '@/store/useAppStore';
import { useDiscoveryStore } from '@/store/useDiscoveryStore';
import { ChatMessage } from '@/types';

import { DISCOVERY_SYSTEM_PROMPT, DISCOVERY_WELCOME_MESSAGE } from './ai/discoveryPrompts';
import { DiscoveryCanvas } from './DiscoveryCanvas';
import { DiscoveryFooterActions } from './DiscoveryFooterActions';
import { DiscoveryHeader } from './DiscoveryHeader';
import { useDiscoverySync } from './hooks/useDiscoverySync';
import { ProjectConversionModal } from './ProjectConversionModal';
import { RecommendationPanel } from './RecommendationPanel';

// Simple message component
const MessageBubble: React.FC<{ message: ChatMessage; isLast?: boolean }> = ({ message }) => {
  const isUser = message.role === 'user';

  // Filter out extraction JSON from display
  const displayContent = message.content.replace(/```json\n[\s\S]*?\n```/g, '').trim();

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`
                    max-w-[85%] rounded-xl px-4 py-3
                    ${
                      isUser
                        ? 'bg-blue-500 text-white rounded-br-md'
                        : 'bg-slate-100 dark:bg-navy-800 text-slate-800 dark:text-slate-200 rounded-bl-md'
                    }
                `}
      >
        {!isUser && (
          <div className="flex items-center gap-2 mb-2">
            <Bot size={16} className="text-blue-500" />
            <span className="text-xs font-medium text-blue-500">AI Consultant</span>
          </div>
        )}
        <div className="text-sm whitespace-pre-wrap leading-relaxed">{displayContent}</div>
      </div>
    </div>
  );
};

interface DiscoveryConsultantViewProps {
  onClose?: () => void;
}

export const DiscoveryConsultantView: React.FC<DiscoveryConsultantViewProps> = ({ onClose }) => {
  const { t } = useTranslation('discovery');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Local state
  const [showConversionModal, setShowConversionModal] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  // Store hooks
  const { createSession, activeSessionId, reset, recommendations, processExtraction } =
    useDiscoveryStore();
  const { isBotTyping, currentStreamContent } = useAppStore();

  // AI Stream hook
  const { startStream, isStreaming, streamedContent } = useAIStream({
    onStreamDone: (fullText) => {
      // Add AI response to messages
      const aiMessage: ChatMessage = {
        id: `ai_${Date.now()}`,
        role: 'ai',
        content: fullText,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);

      // Try to extract entities from response
      tryExtractEntities(fullText);
    },
    onStreamError: (error) => {
      setStreamError(error?.message || 'Stream error');
    },
  });

  // Sync hook
  useDiscoverySync();

  // Extract entities from AI response
  const tryExtractEntities = useCallback(
    (content: string) => {
      // Look for JSON block in response
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
      if (!jsonMatch) return;

      try {
        const parsed = JSON.parse(jsonMatch[1]);
        const extraction = parsed.extraction || parsed;
        if (extraction) {
          processExtraction(extraction);
        }
      } catch (err) {
        console.warn('[DiscoveryConsultantView] Failed to parse extraction:', err);
      }
    },
    [processExtraction]
  );

  // Initialize session and welcome message
  useEffect(() => {
    if (!isInitialized) {
      // Create discovery session
      const sessionId = createSession();

      // Add welcome message
      const welcomeMessage: ChatMessage = {
        id: 'welcome',
        role: 'ai',
        content: DISCOVERY_WELCOME_MESSAGE,
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);
      setIsInitialized(true);

      console.log('[DiscoveryConsultantView] Initialized session:', sessionId);
    }
  }, [isInitialized, createSession]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamedContent, currentStreamContent]);

  // Handlers
  const handleNewSession = useCallback(() => {
    reset();
    setMessages([]);
    setIsInitialized(false);
    setStreamError(null);
  }, [reset]);

  const handleSendMessage = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || isStreaming || isBotTyping) return;

    setStreamError(null);

    // Add user message
    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');

    // Build conversation history for context
    const history = messages.map((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    }));

    // Send to AI with discovery system prompt
    await startStream(text, history, DISCOVERY_SYSTEM_PROMPT);
  }, [inputValue, isStreaming, isBotTyping, messages, startStream]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage]
  );

  const handleStartProject = useCallback(() => {
    setShowConversionModal(true);
  }, []);

  const handleAttachToProject = useCallback(() => {
    console.log('[DiscoveryConsultantView] Attach to project clicked');
  }, []);

  const handleContinueChat = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const hasRecommendations = recommendations.transformationType !== null;
  const isTyping = isStreaming || isBotTyping;
  const currentStream = streamedContent || currentStreamContent;

  return (
    <div className="flex flex-col h-full bg-slate-100 dark:bg-navy-950">
      {/* Header */}
      <DiscoveryHeader onNewSession={handleNewSession} />

      {/* Main content - split view */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Chat Panel */}
        <div className="w-1/2 min-w-[400px] max-w-[600px] flex flex-col border-r border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900">
          {/* Chat Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-navy-800">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg">
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-navy-900 dark:text-white">
                {t('discovery.chatTitle', 'AI Consultant')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('discovery.chatSubtitle', 'Your virtual transformation partner')}
              </p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {/* Streaming response */}
            {isTyping && currentStream && (
              <div className="flex justify-start mb-4">
                <div className="max-w-[85%] rounded-xl rounded-bl-md px-4 py-3 bg-slate-100 dark:bg-navy-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Bot size={16} className="text-blue-500" />
                    <span className="text-xs font-medium text-blue-500">AI Consultant</span>
                    <Loader2 size={12} className="animate-spin text-blue-500" />
                  </div>
                  <div className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                    {currentStream.replace(/```json\n[\s\S]*?\n```/g, '').trim()}
                  </div>
                </div>
              </div>
            )}

            {/* Typing indicator without content */}
            {isTyping && !currentStream && (
              <div className="flex justify-start mb-4">
                <div className="rounded-xl rounded-bl-md px-4 py-3 bg-slate-100 dark:bg-navy-800">
                  <div className="flex items-center gap-2">
                    <Bot size={16} className="text-blue-500" />
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
                      <span
                        className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                        style={{ animationDelay: '0.1s' }}
                      />
                      <span
                        className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                        style={{ animationDelay: '0.2s' }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-slate-100 dark:border-navy-800">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Napisz wiadomość..."
                className="flex-1 resize-none rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800 px-4 py-3 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={1}
                disabled={isTyping}
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isTyping}
                className="p-3 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 dark:disabled:bg-navy-700 text-white rounded-xl transition-colors"
              >
                {isTyping ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
              </button>
            </div>
            {streamError && <p className="mt-2 text-xs text-red-500">{streamError}</p>}
          </div>
        </div>

        {/* Right: Canvas + Recommendations */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Canvas */}
          <div className="flex-1 relative">
            <DiscoveryCanvas />
          </div>

          {/* Recommendations panel (collapsible) */}
          {hasRecommendations && showRecommendations && (
            <div className="h-[280px] border-t border-slate-200 dark:border-navy-700">
              <RecommendationPanel />
            </div>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <DiscoveryFooterActions
        onStartProject={handleStartProject}
        onAttachToProject={handleAttachToProject}
        onContinueChat={handleContinueChat}
      />

      {/* Conversion modal */}
      {showConversionModal && (
        <ProjectConversionModal
          onClose={() => setShowConversionModal(false)}
          onSuccess={(projectId) => {
            setShowConversionModal(false);
            console.log('[DiscoveryConsultantView] Project created:', projectId);
          }}
        />
      )}
    </div>
  );
};

export default DiscoveryConsultantView;
