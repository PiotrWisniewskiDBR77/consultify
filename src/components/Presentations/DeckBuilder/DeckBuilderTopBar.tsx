import {
  BarChart3,
  ChevronRight,
  Clock,
  MessageSquare,
  Monitor,
  Palette,
  Pause,
  Play,
  Redo2,
  Share2,
  Shield,
  Undo2,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PresenceIndicators } from './PresenceIndicators';

interface CollabUser {
  userId: string;
  name: string;
  color: string;
  avatarUrl?: string;
  activeCardIndex?: number;
  isOnline: boolean;
}

interface DeckBuilderTopBarProps {
  title: string;
  onTitleChange: (title: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onToggleAgent: () => void;
  agentOpen: boolean;
  onPresent: () => void;
  onTheme?: () => void;
  onShare?: () => void;
  onVersionHistory?: () => void;
  onToggleAnimations?: () => void;
  animationsEnabled?: boolean;
  collaborators?: CollabUser[];
  isConnected?: boolean;
  connectionStatus?: 'connecting' | 'connected' | 'disconnected' | 'error';
  onQualityGates?: () => void;
  onAnalytics?: () => void;
}

export const DeckBuilderTopBar: React.FC<DeckBuilderTopBarProps> = ({
  title,
  onTitleChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onToggleAgent,
  agentOpen,
  onPresent,
  onTheme,
  onShare,
  onVersionHistory,
  onToggleAnimations,
  animationsEnabled = true,
  collaborators = [],
  isConnected = false,
  connectionStatus = 'disconnected',
  onQualityGates,
  onAnalytics,
}) => {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);

  return (
    <div className="h-12 border-b border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 flex items-center px-4 gap-3 flex-shrink-0">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 min-w-0 flex-1">
        <span className="flex-shrink-0">
          {t('presentations.builder.title', 'Deck Builder')}
        </span>
        <ChevronRight size={14} className="flex-shrink-0" />
        {editing ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => e.key === 'Enter' && setEditing(false)}
            className="bg-transparent border-b border-purple-500 text-slate-900 dark:text-white text-sm font-medium outline-none min-w-[200px]"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-slate-900 dark:text-white font-medium truncate hover:text-purple-600 dark:hover:text-purple-400"
          >
            {title || t('presentations.builder.untitled', 'Untitled Deck')}
          </button>
        )}
      </div>

      {/* Presence Indicators */}
      <PresenceIndicators
        users={collaborators}
        isConnected={isConnected}
        connectionStatus={connectionStatus}
      />

      {/* Undo / Redo + Animation toggle */}
      <div className="flex items-center gap-1 border-r border-slate-200 dark:border-navy-700 pr-3 mr-1">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 disabled:opacity-30 text-slate-500"
          title={`${t('presentations.builder.topBar.undo', 'Undo')} (⌘Z)`}
        >
          <Undo2 size={16} />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 disabled:opacity-30 text-slate-500"
          title={`${t('presentations.builder.topBar.redo', 'Redo')} (⇧⌘Z)`}
        >
          <Redo2 size={16} />
        </button>
        {onToggleAnimations && (
          <button
            onClick={onToggleAnimations}
            className={`p-1.5 rounded-lg transition-colors ${
              animationsEnabled
                ? 'text-purple-500 bg-purple-50 dark:bg-purple-500/10'
                : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800'
            }`}
            title={t(
              animationsEnabled
                ? 'presentations.builder.animations.enabled'
                : 'presentations.builder.animations.disabled',
              animationsEnabled ? 'Animations On' : 'Animations Off'
            )}
          >
            {animationsEnabled ? <Play size={14} /> : <Pause size={14} />}
          </button>
        )}
      </div>

      {/* Action buttons */}
      <button
        onClick={onTheme}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800"
      >
        <Palette size={14} />
        <span className="hidden md:inline">{t('presentations.builder.topBar.theme', 'Theme')}</span>
      </button>

      {onVersionHistory && (
        <button
          onClick={onVersionHistory}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800"
          title={t('presentations.builder.versionHistory.title', 'Version History')}
        >
          <Clock size={14} />
          <span className="hidden lg:inline">History</span>
        </button>
      )}

      {onQualityGates && (
        <button
          onClick={onQualityGates}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800"
          title={t('presentations.builder.topBar.qualityGates', 'Quality Gates')}
        >
          <Shield size={14} />
          <span className="hidden lg:inline">QA</span>
        </button>
      )}

      {onAnalytics && (
        <button
          onClick={onAnalytics}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800"
          title={t('presentations.builder.topBar.analytics', 'Share Analytics')}
        >
          <BarChart3 size={14} />
          <span className="hidden lg:inline">Analytics</span>
        </button>
      )}

      <button
        onClick={onShare}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800"
      >
        <Share2 size={14} />
        <span className="hidden md:inline">{t('presentations.builder.topBar.share', 'Share')}</span>
      </button>

      <button
        onClick={onToggleAgent}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
          agentOpen
            ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800'
        }`}
      >
        <MessageSquare size={14} />
        <span className="hidden md:inline">{t('presentations.builder.topBar.agent', 'Agent')}</span>
      </button>

      <button
        onClick={onPresent}
        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium bg-purple-600 text-white hover:bg-purple-500"
      >
        <Monitor size={14} />
        <span>{t('presentations.builder.topBar.present', 'Present')}</span>
      </button>
    </div>
  );
};
