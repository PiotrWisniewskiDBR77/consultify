/**
 * ChatMenu
 *
 * Floating flyout menu for AI Chat with:
 * - New conversation
 * - Daily brief
 * - Conversation history (expandable)
 * - Pinned prompts (expandable)
 * - Export conversation
 */

import {
  ChevronDown,
  ChevronRight,
  Download,
  History,
  Menu,
  MessageSquare,
  Plus,
  Star,
  Sunrise,
  Trash2,
  X,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Conversation,
  groupConversations,
  useConversationStore,
} from '../../store/useConversationStore';

interface PinnedPrompt {
  id: string;
  prompt: string;
  label?: string;
  usage_count: number;
}

interface ChatMenuProps {
  projectId?: string;
  onNewChat: () => void;
  onExport?: () => void;
  onDailyBrief?: () => void;
  onPromptSelect?: (prompt: string) => void;
  className?: string;
}

export const ChatMenu: React.FC<ChatMenuProps> = ({
  projectId,
  onNewChat,
  onExport,
  onDailyBrief,
  onPromptSelect,
  className = '',
}) => {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);

  // Menu state
  const [isOpen, setIsOpen] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [pinnedExpanded, setPinnedExpanded] = useState(false);
  const [pinnedPrompts, setPinnedPrompts] = useState<PinnedPrompt[]>([]);
  const [pinnedLoading, setPinnedLoading] = useState(false);

  // Conversation store
  const {
    conversations,
    groupedConversations,
    activeConversationId,
    fetchConversations,
    setActiveConversation,
    clearActiveChat,
    toggleSidebar,
  } = useConversationStore();

  // Fetch conversations and pinned prompts when menu opens
  // Note: fetchConversations is a stable Zustand action - we exclude it from deps to prevent infinite loops
  useEffect(() => {
    if (isOpen) {
      fetchConversations({ projectId });
      fetchPinnedPrompts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, projectId]);

  const fetchPinnedPrompts = async () => {
    setPinnedLoading(true);
    try {
      const response = await fetch('/api/pinned-prompts', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setPinnedPrompts(data.prompts || []);
      }
    } catch (err) {
      console.error('[ChatMenu] Failed to fetch pinned prompts:', err);
    } finally {
      setPinnedLoading(false);
    }
  };

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleNewChat = () => {
    clearActiveChat();
    onNewChat();
    setIsOpen(false);
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversation(id);
    setIsOpen(false);
  };

  const handleExport = () => {
    onExport?.();
    setIsOpen(false);
  };

  const handleDailyBrief = () => {
    onDailyBrief?.();
    setIsOpen(false);
  };

  const handleSelectPrompt = async (prompt: PinnedPrompt) => {
    // Track usage
    try {
      await fetch(`/api/pinned-prompts/${prompt.id}/use`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
    } catch (err) {
      console.error('[ChatMenu] Failed to track prompt usage:', err);
    }

    onPromptSelect?.(prompt.prompt);
    setIsOpen(false);
  };

  // Get visible history groups (non-empty, excluding archived)
  const visibleGroups = Object.entries(groupedConversations)
    .filter(([key, items]) => items.length > 0 && key !== 'archived')
    .slice(0, 5); // Limit to 5 groups

  return (
    <div ref={menuRef} className={`relative ${className}`}>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
                    p-2 rounded-xl transition-all duration-200
                    ${
                      isOpen
                        ? 'bg-primary-600 text-white shadow-lg'
                        : 'bg-white dark:bg-navy-800 text-slate-600 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 shadow-md border border-slate-200 dark:border-navy-700'
                    }
                    hover:shadow-lg
                `}
        title={t('aiChat.chatMenuTitle', 'Menu')}
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Flyout Menu */}
      {isOpen && (
        <div
          className="
                    absolute top-full left-0 mt-2 w-72
                    bg-white dark:bg-navy-900
                    border border-slate-200 dark:border-navy-700
                    rounded-xl shadow-xl
                    py-2 z-50
                    animate-in fade-in slide-in-from-top-2 duration-200
                "
        >
          {/* New Conversation */}
          <button
            onClick={handleNewChat}
            className="
                            w-full flex items-center gap-3 px-4 py-2.5
                            text-left text-sm font-medium
                            text-navy-900 dark:text-white
                            hover:bg-slate-50 dark:hover:bg-navy-800
                            transition-colors
                        "
          >
            <Plus size={18} className="text-primary-500" />
            {t('aiChat.newChat', 'Nowa rozmowa')}
          </button>

          {/* Daily Brief */}
          <button
            onClick={handleDailyBrief}
            className="
                            w-full flex items-center gap-3 px-4 py-2.5
                            text-left text-sm
                            text-slate-700 dark:text-slate-300
                            hover:bg-slate-50 dark:hover:bg-navy-800
                            transition-colors
                        "
          >
            <Sunrise size={18} className="text-amber-500" />
            {t('aiChat.dailyBrief', 'Dzienny brief')}
          </button>

          <div className="h-px bg-slate-100 dark:bg-navy-800 my-1" />

          {/* History Section */}
          <div>
            <button
              onClick={() => setHistoryExpanded(!historyExpanded)}
              className="
                                w-full flex items-center justify-between gap-3 px-4 py-2.5
                                text-left text-sm
                                text-slate-700 dark:text-slate-300
                                hover:bg-slate-50 dark:hover:bg-navy-800
                                transition-colors
                            "
            >
              <div className="flex items-center gap-3">
                <History size={18} className="text-slate-400 dark:text-slate-500" />
                <span>{t('aiChat.history', 'Historia rozmów')}</span>
              </div>
              {historyExpanded ? (
                <ChevronDown size={16} className="text-slate-400 dark:text-slate-500" />
              ) : (
                <ChevronRight size={16} className="text-slate-400 dark:text-slate-500" />
              )}
            </button>

            {/* History List */}
            {historyExpanded && (
              <div className="max-h-64 overflow-y-auto px-2">
                {visibleGroups.length === 0 ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500 px-4 py-2">
                    {t('aiChat.noConversations', 'Brak rozmów')}
                  </p>
                ) : (
                  <>
                    {visibleGroups.map(([groupKey, items]) => (
                      <div key={groupKey} className="mb-2">
                        <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 py-1">
                          {t(`aiChat.groups.${groupKey}`, groupKey)}
                        </p>
                        {(items as Conversation[]).slice(0, 5).map((conv) => (
                          <button
                            key={conv.id}
                            onClick={() => handleSelectConversation(conv.id)}
                            className={`
                                                            w-full flex items-center gap-2 px-3 py-1.5 rounded-lg
                                                            text-left text-xs truncate
                                                            ${
                                                              activeConversationId === conv.id
                                                                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                                                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800'
                                                            }
                                                            transition-colors
                                                        `}
                          >
                            <MessageSquare size={12} className="shrink-0 opacity-50" />
                            <span className="truncate">{conv.title}</span>
                          </button>
                        ))}
                      </div>
                    ))}
                    {/* Full History Panel Button */}
                    <button
                      onClick={() => {
                        toggleSidebar();
                        setIsOpen(false);
                      }}
                      className="w-full text-center text-xs text-primary-600 dark:text-primary-400 hover:underline py-2 mt-1"
                    >
                      {t('aiChat.viewFullHistory', 'Zobacz pełną historię →')}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Pinned Prompts Section */}
          <div>
            <button
              onClick={() => setPinnedExpanded(!pinnedExpanded)}
              className="
                                w-full flex items-center justify-between gap-3 px-4 py-2.5
                                text-left text-sm
                                text-slate-700 dark:text-slate-300
                                hover:bg-slate-50 dark:hover:bg-navy-800
                                transition-colors
                            "
            >
              <div className="flex items-center gap-3">
                <Star size={18} className="text-slate-400 dark:text-slate-500" />
                <span>{t('aiChat.pinnedPrompts', 'Przypięte prompty')}</span>
              </div>
              {pinnedExpanded ? (
                <ChevronDown size={16} className="text-slate-400 dark:text-slate-500" />
              ) : (
                <ChevronRight size={16} className="text-slate-400 dark:text-slate-500" />
              )}
            </button>

            {/* Pinned Prompts List */}
            {pinnedExpanded && (
              <div className="max-h-48 overflow-y-auto px-2 py-1">
                {pinnedLoading ? (
                  <div className="flex justify-center py-2">
                    <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : pinnedPrompts.length === 0 ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500 italic px-2 py-1">
                    {t('aiChat.noPinnedPrompts', 'Brak przypiętych promptów')}
                  </p>
                ) : (
                  pinnedPrompts.map((prompt) => (
                    <button
                      key={prompt.id}
                      onClick={() => handleSelectPrompt(prompt)}
                      className="
                                                w-full flex items-center gap-2 px-3 py-1.5 rounded-lg
                                                text-left text-xs truncate
                                                text-slate-600 dark:text-slate-400
                                                hover:bg-slate-50 dark:hover:bg-navy-800
                                                transition-colors
                                            "
                    >
                      <Star size={12} className="shrink-0 text-amber-400 fill-amber-400" />
                      <span className="truncate">{prompt.label || prompt.prompt.slice(0, 40)}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="h-px bg-slate-100 dark:bg-navy-800 my-1" />

          {/* Export */}
          <button
            onClick={handleExport}
            disabled={!activeConversationId}
            className={`
                            w-full flex items-center gap-3 px-4 py-2.5
                            text-left text-sm
                            ${
                              activeConversationId
                                ? 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
                                : 'text-slate-400 dark:text-slate-600 cursor-not-allowed'
                            }
                            transition-colors
                        `}
          >
            <Download size={18} className="text-slate-400 dark:text-slate-500" />
            {t('aiChat.exportChat', 'Eksportuj rozmowę')}
          </button>
          {/* AI Settings moved to main Settings */}
        </div>
      )}
    </div>
  );
};

export default ChatMenu;
