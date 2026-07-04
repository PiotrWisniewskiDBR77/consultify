import { Cpu, MapPin, Maximize2, MessageCircle, Shield, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAIContext } from '../../contexts/AIContext';
import { useAIStream } from '../../hooks/useAIStream';
import { useAppStore } from '../../store/useAppStore';
import { AppView, ChatMessage, ChatOption } from '../../types';
import { AIUsageIndicator } from '../AIUsageIndicator';
import { LLMSelector } from '../LLMSelector';
import { AIRoleBadge } from './AIRoleBadge';
import { UnifiedChatPanel } from './UnifiedChatPanel';

interface ChatOverlayProps {
  hideTrigger?: boolean;
}

export const ChatOverlay: React.FC<ChatOverlayProps> = ({ hideTrigger = false }) => {
  const { t } = useTranslation();
  const { isChatOpen, toggleChat, screenContext, pmoContext, globalContext } = useAIContext();
  const { activeChatMessages, addChatMessage, isBotTyping, setCurrentView } = useAppStore();

  const { isStreaming, streamedContent, startStream } = useAIStream();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [regulatoryModeEnabled, setRegulatoryModeEnabled] = useState(false);
  // New: Toggle for Thinking Process visualization
  const [showThinking, setShowThinking] = useState(true);

  // Fetch regulatory mode status when project changes
  useEffect(() => {
    const fetchRegulatoryStatus = async () => {
      if (!pmoContext.projectId) {
        setRegulatoryModeEnabled(false);
        return;
      }
      try {
        const res = await fetch(`/api/projects/${pmoContext.projectId}/regulatory-mode`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        if (res.ok) {
          const data = await res.json();
          setRegulatoryModeEnabled(data.enabled);
        }
      } catch (err) {
        console.error('Failed to fetch regulatory mode status:', err);
      }
    };
    fetchRegulatoryStatus();
  }, [pmoContext.projectId]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeChatMessages, streamedContent, isChatOpen]);

  const handleSendMessage = (text: string) => {
    // Check if we have enough context
    if (!pmoContext.projectId) {
      const warningMsg: ChatMessage = {
        id: `warn-${Date.now()}`,
        role: 'ai',
        content:
          '⚠️ **No Project Selected**\n\nPlease select a project first to get context-aware assistance. I can still help with general questions.',
        timestamp: new Date(),
      };
      addChatMessage(warningMsg);
    }

    // Add User Message
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    addChatMessage(userMsg);

    // Prepare History
    const history = activeChatMessages.map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

    // Build full context for AI
    const fullContext = {
      screenContext,
      pmo: pmoContext,
      global: globalContext,
    };

    // Start stream with full context
    startStream(text, history, undefined, fullContext);
  };

  const handleOptionSelect = (option: ChatOption) => {
    handleSendMessage(option.label);
  };

  if (!isChatOpen) {
    if (hideTrigger) return null;

    return (
      <button
        data-tour="ai-panel"
        onClick={toggleChat}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-500 hover:to-indigo-500 text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 z-50 group"
      >
        <MessageCircle size={28} className="group-hover:animate-pulse" />
        {/* Badge indicator when context is loaded */}
        {pmoContext.projectId && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-navy-900 animate-pulse" />
        )}
        {/* Regulatory Mode indicator */}
        {regulatoryModeEnabled && (
          <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-amber-500 rounded-full border-2 border-white dark:border-navy-900 flex items-center justify-center">
            <Shield size={8} className="text-white" />
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      data-tour="ai-chat"
      className="fixed bottom-6 right-6 w-[400px] h-[900px] max-h-[calc(100vh-3rem)] bg-white dark:bg-navy-900 rounded-xl shadow-2xl border border-slate-200 dark:border-navy-700 flex flex-col z-50 overflow-hidden animate-in slide-in-from-bottom-10 fade-in zoom-in-95 duration-200"
    >
      {/* Header */}
      <div className="bg-navy-950 shrink-0 border-b border-c-border-subtle">
        <div className="h-14 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center text-white font-bold">
              <Cpu size={18} />
            </div>
            <div>
              <div className="text-sm font-bold text-white leading-tight flex items-center gap-2">
                PMO Assistant
                {/* AI Roles Model: Display active role badge */}
                {pmoContext.projectId && <AIRoleBadge role={pmoContext.aiRole} size="sm" />}
              </div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                <MapPin size={8} />
                {pmoContext.currentPhase} • {pmoContext.userRole}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* LLM Model Selector */}
            <LLMSelector />

            {/* Thinking Process Info Button */}
            <button
              onClick={() => setShowThinking(!showThinking)}
              className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors ${
                showThinking
                  ? 'bg-primary-500/20 text-primary-300 ring-1 ring-c-info/50'
                  : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-800/40 hover:text-white'
              }`}
              title={showThinking ? 'Hide Thinking Process' : 'Show Thinking Process'}
            >
              <Cpu size={14} className={showThinking ? 'animate-pulse' : ''} />
            </button>

            {/* AI Usage Indicator */}
            <AIUsageIndicator compact />

            {/* Expand to fullscreen button */}
            <button
              onClick={() => {
                toggleChat(); // Close the overlay
                setCurrentView(AppView.AI_ACTION_PROPOSALS); // Open fullscreen chat
              }}
              className="w-8 h-8 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-white transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-navy-800/40"
              title={t('aiChat.expandFullScreen', 'Expand to full screen')}
            >
              <Maximize2 size={16} />
            </button>
            <button
              onClick={toggleChat}
              className="w-8 h-8 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-white transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-navy-800/40"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        {/* Context Bar with Regulatory Mode Badge */}
        {pmoContext.projectId && (
          <div className="px-4 pb-2 flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 flex-wrap">
            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded border border-green-500/30">
              Context Loaded
            </span>
            {/* Regulatory Mode Badge */}
            {regulatoryModeEnabled && (
              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded border border-amber-500/30 flex items-center gap-1">
                <Shield size={10} />
                Regulatory Mode: Advisor-only
              </span>
            )}
            <span className="truncate">{pmoContext.currentScreen}</span>
          </div>
        )}
      </div>

      {/* Content using UnifiedChatPanel */}
      <div className="flex-1 overflow-hidden relative flex flex-col">
        <UnifiedChatPanel
          mode="split" // Use split mode for compact overlay look
          showModeToggle={true}
          onModeToggle={() => {
            toggleChat();
            setCurrentView(AppView.AI_CHAT);
          }}
          showHistoryTrigger={true}
          showFocusMode={false} // Keep it simple in overlay
          workspaceContext={
            {
              type: 'project',
              projectId: pmoContext.projectId || undefined,
              entityName: pmoContext.currentScreen,
            } as any
          }
        />
      </div>
    </div>
  );
};
