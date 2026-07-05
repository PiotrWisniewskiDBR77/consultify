/**
 * Prompt Assistant Panel
 *
 * AI-powered chat interface for helping SuperAdmins create and optimize
 * language-independent prompt templates.
 */

import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle,
  Copy,
  FileText,
  Info,
  Languages,
  Loader2,
  MessageSquare,
  Minimize2,
  Send,
  Sparkles,
  TestTube,
  Trash2,
  Zap,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PromptAssistantApi } from '../../services/api/promptAssistant.api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: Array<{ title: string; description: string }>;
  codeBlocks?: Array<{ language: string; content: string }>;
}

interface PromptAssistantPanelProps {
  promptId?: string;
  promptContent?: string;
  templateCode?: string;
  onSuggestionApply?: (improvedContent: string) => void;
  onBlockSelect?: (blockCode: string) => void;
  className?: string;
}

export const PromptAssistantPanel: React.FC<PromptAssistantPanelProps> = ({
  promptId,
  promptContent,
  templateCode,
  onSuggestionApply,
  onBlockSelect,
  className = '',
}) => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Add welcome message on mount
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: `👋 **Welcome to Prompt Engineering Assistant!**

I can help you create effective, language-independent prompts for the Consultify platform.

**What I can do:**
- Analyze your prompts for issues
- Suggest improvements and best practices
- Recommend appropriate blocks
- Test prompts across languages
- Explain prompt engineering concepts

**Quick actions:**
- Click "Analyze" to check your current prompt
- Click "Suggest Blocks" to find suitable blocks
- Click "Test" to validate across languages

How can I help you today?`,
          timestamp: new Date(),
        },
      ]);
    }
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const data = await PromptAssistantApi.sendChatMessage({
        message: userMessage.content,
        promptId,
        promptContent,
        templateCode,
        conversationId,
      });

      if (data.data?.conversationId) {
        setConversationId(data.data.conversationId);
      }

      const assistantMessage: Message = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: data.data?.message || 'No response received.',
        timestamp: new Date(),
        suggestions: Array.isArray(data.data?.suggestions)
          ? data.data.suggestions.map((suggestion) =>
              typeof suggestion === 'string' ? { title: suggestion, description: '' } : suggestion
            )
          : undefined,
        codeBlocks: Array.isArray(data.data?.codeBlocks)
          ? data.data.codeBlocks.map((block) =>
              typeof block === 'string' ? { language: 'text', content: block } : block
            )
          : undefined,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: `error_${Date.now()}`,
          role: 'assistant',
          content: '❌ Sorry, I encountered an error. Please try again.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = async (action: string) => {
    let message = '';

    switch (action) {
      case 'analyze':
        message = promptContent
          ? `Please analyze this prompt for issues and suggest improvements:\n\n\`\`\`\n${promptContent.slice(0, 2000)}\n\`\`\``
          : 'Please explain how to analyze a prompt for language independence.';
        break;
      case 'suggest-blocks':
        message =
          'What blocks would you recommend for a strategic consulting prompt that needs to work in multiple languages?';
        break;
      case 'test':
        message = templateCode
          ? `How would I test the template "${templateCode}" across different languages?`
          : 'Explain how to test prompts across multiple languages.';
        break;
      case 'improve':
        message = promptContent
          ? `Please improve this prompt to be more language-independent:\n\n\`\`\`\n${promptContent.slice(0, 2000)}\n\`\`\``
          : 'What are the best practices for creating language-independent prompts?';
        break;
      case 'variables':
        message =
          'What variables are available for language-independent prompts? Show me examples.';
        break;
      case 'best-practices':
        message =
          'What are the top 5 best practices for creating effective, language-independent prompts?';
        break;
    }

    if (message) {
      setInput(message);
      // Auto-send after a brief delay
      setTimeout(() => {
        const textarea = inputRef.current;
        if (textarea) {
          textarea.focus();
        }
      }, 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const applyCodeBlock = (code: string) => {
    if (onSuggestionApply) {
      onSuggestionApply(code);
    }
  };

  const clearHistory = async () => {
    try {
      await PromptAssistantApi.clearChatHistory(conversationId);

      setMessages([]);
      setConversationId(null);
    } catch (error) {
      console.error('Clear history error:', error);
    }
  };

  const renderMessage = (message: Message) => {
    const isUser = message.role === 'user';

    return (
      <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
        <div className={`max-w-[85%] ${isUser ? 'order-2' : 'order-1'}`}>
          {/* Message bubble */}
          <div
            className={`rounded-xl px-4 py-3 ${
              isUser
                ? 'bg-blue-600 text-white rounded-br-md'
                : 'bg-slate-100 dark:bg-navy-800 text-slate-900 dark:text-white rounded-bl-md'
            }`}
          >
            {/* Render markdown-like content */}
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {message.content.split('\n').map((line, i) => {
                // Bold text
                if (line.startsWith('**') && line.endsWith('**')) {
                  return (
                    <p key={i} className="font-bold mb-1">
                      {line.slice(2, -2)}
                    </p>
                  );
                }
                // Bullet points
                if (line.startsWith('- ')) {
                  return (
                    <p key={i} className="ml-4 mb-1">
                      • {line.slice(2)}
                    </p>
                  );
                }
                // Code blocks (simple)
                if (line.startsWith('```')) {
                  return null; // Handle in codeBlocks
                }
                // Regular text
                if (line.trim()) {
                  return (
                    <p key={i} className="mb-1">
                      {line}
                    </p>
                  );
                }
                return <br key={i} />;
              })}
            </div>
          </div>

          {/* Code blocks */}
          {message.codeBlocks?.map((block, idx) => (
            <div
              key={idx}
              className="mt-2 rounded-lg overflow-hidden border border-slate-200 dark:border-navy-700"
            >
              <div className="flex items-center justify-between bg-slate-200 dark:bg-navy-700 px-3 py-1.5 text-xs">
                <span className="text-slate-600 dark:text-slate-400">{block.language}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyToClipboard(block.content, `${message.id}_${idx}`)}
                    className="text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white"
                  >
                    {copiedId === `${message.id}_${idx}` ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                  {onSuggestionApply && (
                    <button
                      onClick={() => applyCodeBlock(block.content)}
                      className="text-blue-500 hover:text-blue-700"
                      title="Apply to editor"
                    >
                      <Zap size={14} />
                    </button>
                  )}
                </div>
              </div>
              <pre className="p-3 bg-slate-50 dark:bg-navy-900 text-xs overflow-x-auto">
                <code>{block.content}</code>
              </pre>
            </div>
          ))}

          {/* Timestamp */}
          <div
            className={`text-xs text-slate-600 dark:text-slate-500 mt-1 ${isUser ? 'text-right' : 'text-left'}`}
          >
            {message.timestamp.toLocaleTimeString()}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className={`flex flex-col h-full bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-navy-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-primary-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-c-text" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
              Prompt Assistant
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              AI-powered prompt engineering help
            </p>
          </div>
        </div>
        <button
          onClick={clearHistory}
          className="p-1.5 text-slate-600 hover:text-slate-600 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800"
          title="Clear history"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Quick Actions */}
      <div className="px-4 py-2 border-b border-slate-200 dark:border-navy-700">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleQuickAction('analyze')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
          >
            <AlertTriangle size={12} />
            Analyze
          </button>
          <button
            onClick={() => handleQuickAction('improve')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
          >
            <Sparkles size={12} />
            Improve
          </button>
          <button
            onClick={() => handleQuickAction('suggest-blocks')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
          >
            <FileText size={12} />
            Blocks
          </button>
          <button
            onClick={() => handleQuickAction('test')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors"
          >
            <TestTube size={12} />
            Test
          </button>
          <button
            onClick={() => handleQuickAction('variables')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors"
          >
            <Languages size={12} />
            Variables
          </button>
          <button
            onClick={() => handleQuickAction('best-practices')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <BookOpen size={12} />
            Tips
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.map(renderMessage)}

        {isLoading && (
          <div className="flex justify-start mb-4">
            <div className="bg-slate-100 dark:bg-navy-800 rounded-xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-slate-200 dark:border-navy-700">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about prompt engineering..."
              className="w-full px-4 py-2.5 pr-12 rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800 text-slate-900 dark:text-white placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
              rows={1}
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="p-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={18} />
          </button>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-500 mt-2 text-center">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
};

export default PromptAssistantPanel;
