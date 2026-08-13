/**
 * AICopilotMode — Pair ideation AI assistant with streaming responses.
 *
 * Modes:
 * - Brainstorm: AI actively generates ideas in context
 * - Devil's Advocate: AI challenges ideas, finds weaknesses
 * - Expand: AI takes one idea and branches it in N directions
 * - Summarize: AI creates executive summary of all ideas
 *
 * Streams responses in real-time with typing effect.
 */
import {
  AlertTriangle,
  Brain,
  ChevronDown,
  GitBranch,
  Lightbulb,
  Loader2,
  MessageSquare,
  Plus,
  Send,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';

import type { TableNode } from './tableTypes';

type CopilotMode = 'brainstorm' | 'devils_advocate' | 'expand' | 'summarize';

interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  mode?: CopilotMode;
  timestamp: number;
  suggestions?: { label: string; nodeData: Record<string, any> }[];
}

interface AICopilotModeProps {
  open: boolean;
  onClose: () => void;
  nodes: TableNode[];
  ideaId: string;
  onAddRows: (rows: TableNode[]) => void;
  onUpdateNode?: (nodeId: string, data: Record<string, any>) => void;
}

const MODE_CONFIG: Record<
  CopilotMode,
  { icon: React.ReactNode; label: string; labelPl: string; prompt: string; color: string }
> = {
  brainstorm: {
    icon: <Lightbulb size={12} />,
    label: 'Brainstorm',
    labelPl: 'Burza mózgów',
    prompt:
      'Generate creative ideas related to the existing ones. Consider the company context. Return 3-5 new ideas as JSON array: [{ "label": "...", "description": "...", "category": "..." }]',
    color: 'var(--c-warning)',
  },
  devils_advocate: {
    icon: <AlertTriangle size={12} />,
    label: "Devil's Advocate",
    labelPl: 'Adwokat diabła',
    prompt:
      'Challenge these ideas. For each, identify: weaknesses, risks, assumptions that might be wrong, and what could go wrong. Be constructive but critical.',
    color: 'var(--c-danger)',
  },
  expand: {
    icon: <GitBranch size={12} />,
    label: 'Expand',
    labelPl: 'Rozwiń',
    prompt:
      'Take the most promising idea and expand it in 5 different directions. Each direction should be a concrete sub-idea with actionable next steps. Return as JSON: [{ "label": "...", "description": "...", "direction": "..." }]',
    color: 'var(--c-info)',
  },
  summarize: {
    icon: <MessageSquare size={12} />,
    label: 'Summarize',
    labelPl: 'Podsumuj',
    prompt:
      'Create an executive summary of all ideas. Group them thematically, highlight the strongest ones, and provide a recommended prioritization.',
    color: 'var(--c-info)',
  },
};

export const AICopilotMode: React.FC<AICopilotModeProps> = ({
  open,
  onClose,
  nodes,
  ideaId,
  onAddRows,
  onUpdateNode,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [mode, setMode] = useState<CopilotMode>('brainstorm');
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  // Focus entry (initialFocusRef: inputRef below), Escape-to-close, and
  // focus restore to the trigger are owned by useDialogA11y now. This used
  // to be a bespoke `if (open) inputRef.current?.focus()` effect that ran
  // and stole focus BEFORE the hook's own effect captured the
  // previously-focused element (same race as native `autoFocus`), so the
  // hook's "restore focus to trigger on close" bookkeeping never saw the
  // real trigger.

  const simulateStreaming = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      let idx = 0;
      const interval = setInterval(() => {
        idx += Math.floor(Math.random() * 3) + 1;
        if (idx >= text.length) {
          setStreamingText('');
          clearInterval(interval);
          resolve();
        } else {
          setStreamingText(text.slice(0, idx));
        }
      }, 15);
    });
  }, []);

  const handleSend = useCallback(
    async (customPrompt?: string) => {
      const userText = customPrompt || input.trim();
      if (!userText && !customPrompt) return;

      const userMsg: CopilotMessage = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content: userText,
        mode,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setLoading(true);

      try {
        const { Api } = await import('@/services/api');
        const modeConfig = MODE_CONFIG[mode];
        const contextText = nodes
          .slice(0, 15)
          .map((n) => `- ${n.data?.label || n.id}: ${n.data?.description || ''}`)
          .join('\n');

        const result = await Api.getIdeaAISuggestions(ideaId, {
          context: {
            title: `Copilot: ${modeConfig.label}`,
            seedText: `Current ideas:\n${contextText}\n\nUser request: ${userText}`,
            currentNodes: nodes
              .slice(0, 20)
              .map((n) => ({ id: n.id, type: n.type, label: n.data?.label })),
            currentEdges: [],
            activeTool: 'table',
          },
          mode: 'on_demand',
          prompt: `${modeConfig.prompt}\n\nUser says: "${userText}"`,
          language: i18n.language,
        });

        const responseText =
          (result?.suggestions || []).map((s: any) => s.text || s.detail || '').join('\n') ||
          t('myWorkTable.aiCopilotMode.couldNotGenerate');

        await simulateStreaming(responseText);

        let suggestions: CopilotMessage['suggestions'];
        try {
          const jsonMatch = responseText.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed)) {
              suggestions = parsed.map((item: any) => ({
                label: item.label || item.title || '',
                nodeData: item,
              }));
            }
          }
        } catch {
          // not JSON — plain text response
        }

        const assistantMsg: CopilotMessage = {
          id: `msg-${Date.now()}-resp`,
          role: 'assistant',
          content: responseText,
          mode,
          timestamp: Date.now(),
          suggestions,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-err`,
            role: 'system',
            content: t('myWorkTable.aiCopilotMode.connectionError'),
            timestamp: Date.now(),
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [i18n.language, ideaId, input, mode, nodes, simulateStreaming, t]
  );

  const handleAddSuggestion = useCallback(
    (suggestion: { label: string; nodeData: Record<string, any> }) => {
      const newNode: TableNode = {
        id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'idea',
        data: { label: suggestion.label, ...suggestion.nodeData, source: 'ai_copilot' },
        position: { x: 0, y: 0 },
      };
      onAddRows([newNode]);
    },
    [onAddRows]
  );

  const handleQuickAction = useCallback(
    (actionMode: CopilotMode) => {
      setMode(actionMode);
      const config = MODE_CONFIG[actionMode];
      handleSend(isPl ? config.labelPl : config.label);
    },
    [handleSend, isPl]
  );

  const containerRef = useRef<HTMLDivElement>(null);
  useDialogA11y({ open, onClose, containerRef, initialFocusRef: inputRef });

  if (!open) return null;

  const currentModeConfig = MODE_CONFIG[mode];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center bg-black/20 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-copilot-mode-heading"
        tabIndex={-1}
        className="w-[480px] max-w-[95vw] h-[70vh] max-h-[600px] rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-2xl overflow-hidden flex flex-col outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-c-border-subtle">
          <Brain size={16} className="text-c-text-secondary" />
          <span id="ai-copilot-mode-heading" className="text-sm font-bold text-c-text">
            {t('ideas.table.aiCopilot.title', 'AI Copilot')}
          </span>

          {/* Mode selector */}
          <div className="relative ml-2">
            <button
              onClick={() => setShowModeSelector(!showModeSelector)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-colors"
              style={{
                backgroundColor: `color-mix(in srgb, ${currentModeConfig.color} 10%, transparent)`,
                color: currentModeConfig.color,
              }}
            >
              {currentModeConfig.icon}
              {isPl ? currentModeConfig.labelPl : currentModeConfig.label}
              <ChevronDown size={9} />
            </button>
            {showModeSelector && (
              <div className="absolute top-full left-0 mt-1 z-50 w-48 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-xl p-1.5">
                {(
                  Object.entries(MODE_CONFIG) as [CopilotMode, (typeof MODE_CONFIG)[CopilotMode]][]
                ).map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setMode(key);
                      setShowModeSelector(false);
                    }}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[10px] font-bold transition-colors ${mode === key ? 'bg-c-surface-raised text-c-text' : 'text-c-text-secondary hover:bg-c-surface-raised'}`}
                  >
                    <span style={{ color: config.color }}>{config.icon}</span>
                    {isPl ? config.labelPl : config.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1" />
          <span className="text-[9px] text-c-text-secondary">
            {nodes.length} {t('myWorkTable.aiCopilotMode.ideas')}
          </span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-c-surface-raised transition-colors"
          >
            <X size={14} className="text-c-text-secondary" />
          </button>
        </div>

        {/* Quick actions */}
        {messages.length === 0 && (
          <div className="px-4 py-3 border-b border-c-border-subtle">
            <p className="text-[9px] font-bold uppercase tracking-wider text-c-text-secondary mb-2">
              {t('myWorkTable.aiCopilotMode.quickActions')}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(
                Object.entries(MODE_CONFIG) as [CopilotMode, (typeof MODE_CONFIG)[CopilotMode]][]
              ).map(([key, config]) => (
                <button
                  key={key}
                  onClick={() => handleQuickAction(key)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-bold transition-colors hover:opacity-80"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${config.color} 8%, transparent)`,
                    color: config.color,
                  }}
                >
                  {config.icon}
                  {isPl ? config.labelPl : config.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-auto px-4 py-3 space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                  msg.role === 'user'
                    ? 'bg-c-text text-c-surface'
                    : msg.role === 'system'
                      ? 'bg-danger-500/10 text-danger-600 dark:text-danger-400'
                      : 'bg-c-surface-raised text-c-text'
                }`}
              >
                {msg.role === 'assistant' && msg.mode && (
                  <div className="flex items-center gap-1 mb-1">
                    <span style={{ color: MODE_CONFIG[msg.mode].color }}>
                      {MODE_CONFIG[msg.mode].icon}
                    </span>
                    <span
                      className="text-[8px] font-bold uppercase tracking-wider"
                      style={{ color: MODE_CONFIG[msg.mode].color }}
                    >
                      {isPl ? MODE_CONFIG[msg.mode].labelPl : MODE_CONFIG[msg.mode].label}
                    </span>
                  </div>
                )}
                <p className="text-[11px] whitespace-pre-wrap leading-relaxed">{msg.content}</p>

                {/* Actionable suggestions */}
                {msg.suggestions && msg.suggestions.length > 0 && (
                  <div className="mt-2 space-y-1 border-t border-c-border-subtle pt-2">
                    {msg.suggestions.map((sug, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-[10px] text-c-text-secondary flex-1 truncate">
                          {sug.label}
                        </span>
                        <button
                          onClick={() => handleAddSuggestion(sug)}
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg text-[8px] font-bold text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
                        >
                          <Plus size={8} />
                          {t('myWorkTable.aiCopilotMode.add')}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Streaming indicator */}
          {streamingText && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl px-3 py-2 bg-c-surface-raised">
                <p className="text-[11px] text-c-text whitespace-pre-wrap">
                  {streamingText}
                  <span className="animate-pulse">▊</span>
                </p>
              </div>
            </div>
          )}

          {loading && !streamingText && (
            <div className="flex justify-start">
              <div className="rounded-2xl px-3 py-2 bg-c-surface-raised">
                <Loader2 size={14} className="animate-spin text-c-text-secondary" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-c-border-subtle">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={t('myWorkTable.aiCopilotMode.askPlaceholder')}
              disabled={loading}
              className="flex-1 h-9 px-3 rounded-xl text-[11px] bg-c-surface-raised border border-c-border-subtle text-c-text outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50"
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="p-2 rounded-xl bg-c-text text-c-surface hover:opacity-90 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AICopilotMode;
