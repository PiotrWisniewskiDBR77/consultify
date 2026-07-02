import {
  ArrowLeft,
  BarChart3,
  ChevronRight,
  Clock,
  History,
  MessageSquare,
  Monitor,
  Palette,
  Pause,
  Play,
  Redo2,
  Share2,
  Shield,
  ShieldCheck,
  Undo2,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

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
  onQualityGates?: () => void;
  onAnalytics?: () => void;
  onAuditLog?: () => void;
  onGovernance?: () => void;
  governanceVerdict?: 'PASS' | 'PASS_WITH_P2' | 'BLOCKED_P1' | 'BLOCKED_P0' | 'INCONCLUSIVE' | null;
  confidentiality?: 'public' | 'internal' | 'confidential';
  lastAgentActivityAt?: string | null;
}

const GOVERNANCE_DOT_CLASS: Record<string, string> = {
  PASS: 'bg-emerald-500',
  PASS_WITH_P2: 'bg-amber-500',
  BLOCKED_P1: 'bg-orange-500',
  BLOCKED_P0: 'bg-danger-500',
  INCONCLUSIVE: 'bg-slate-400',
};

type ConfidentialityLevel = 'public' | 'internal' | 'confidential';

const CONFIDENTIALITY_STYLES: Record<ConfidentialityLevel, { color: string; label: string }> = {
  public: { color: 'text-emerald-500', label: 'Public' },
  internal: { color: 'text-blue-500', label: 'Internal' },
  confidential: { color: 'text-danger-500', label: 'Confidential' },
};

const ConfidentialityBadge: React.FC<{
  confidentiality: ConfidentialityLevel;
  lastAgentActivityAt?: string | null;
}> = ({ confidentiality, lastAgentActivityAt }) => {
  const { color, label } = CONFIDENTIALITY_STYLES[confidentiality];

  const isRecentAgentActivity = (() => {
    if (!lastAgentActivityAt) return false;
    const ts = Date.parse(lastAgentActivityAt);
    if (Number.isNaN(ts)) return false;
    return Date.now() - ts <= 60_000;
  })();

  const titleParts = [`Confidentiality: ${label}`];
  if (isRecentAgentActivity && lastAgentActivityAt) {
    titleParts.push(`Recent agent activity at ${lastAgentActivityAt}`);
  }

  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium text-c-text-secondary"
      title={titleParts.join(' · ')}
    >
      <Shield size={14} className={color} />
      <span className="hidden md:inline">{label}</span>
      {isRecentAgentActivity && (
        <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
      )}
    </div>
  );
};

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
  onQualityGates,
  onAnalytics,
  onAuditLog,
  onGovernance,
  governanceVerdict,
  confidentiality,
  lastAgentActivityAt,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);

  const goToPresentations = () => navigate('/presentations');

  return (
    <div className="h-12 border-b border-c-border bg-c-surface flex items-center px-4 gap-3 flex-shrink-0">
      {/* Back / Exit */}
      <button
        onClick={goToPresentations}
        className="flex-shrink-0 p-1.5 rounded-lg text-c-text-muted hover:bg-c-surface-raised hover:text-c-text transition-colors"
        title={t('presentations.builder.exit', 'Exit to Presentations')}
        aria-label={t('presentations.builder.exit', 'Exit to Presentations')}
      >
        <ArrowLeft size={18} />
      </button>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-c-text-muted min-w-0 flex-1">
        <button
          onClick={goToPresentations}
          className="flex-shrink-0 hover:text-c-text transition-colors"
        >
          {t('presentations.builder.title', 'Deck Builder')}
        </button>
        <ChevronRight size={14} className="flex-shrink-0" />
        {editing ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => e.key === 'Enter' && setEditing(false)}
            className="bg-transparent border-b border-c-focus-solid text-c-text text-sm font-medium outline-none focus:ring-2 focus:ring-c-focus min-w-[200px]"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-c-text font-medium truncate hover:text-c-text-secondary"
          >
            {title || t('presentations.builder.untitled', 'Untitled Deck')}
          </button>
        )}
      </div>

      {/* Undo / Redo + Animation toggle */}
      <div className="flex items-center gap-1 border-r border-c-border pr-3 mr-1">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="p-1.5 rounded-lg hover:bg-c-surface-raised disabled:opacity-30 text-c-text-muted"
          title={`${t('presentations.builder.topBar.undo', 'Undo')} (⌘Z)`}
        >
          <Undo2 size={16} />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="p-1.5 rounded-lg hover:bg-c-surface-raised disabled:opacity-30 text-c-text-muted"
          title={`${t('presentations.builder.topBar.redo', 'Redo')} (⇧⌘Z)`}
        >
          <Redo2 size={16} />
        </button>
        {onToggleAnimations && (
          <button
            onClick={onToggleAnimations}
            className={`p-1.5 rounded-lg transition-colors ${
              animationsEnabled
                ? 'text-c-text bg-c-accent-soft'
                : 'text-c-text-secondary hover:bg-c-surface-raised'
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
      {confidentiality && (
        <ConfidentialityBadge
          confidentiality={confidentiality}
          lastAgentActivityAt={lastAgentActivityAt}
        />
      )}

      <button
        onClick={onTheme}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-c-text-secondary hover:bg-c-surface-raised"
      >
        <Palette size={14} />
        <span className="hidden md:inline">{t('presentations.builder.topBar.theme', 'Theme')}</span>
      </button>

      {onVersionHistory && (
        <button
          onClick={onVersionHistory}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-c-text-secondary hover:bg-c-surface-raised"
          title={t('presentations.builder.versionHistory.title', 'Version History')}
        >
          <Clock size={14} />
          <span className="hidden lg:inline">History</span>
        </button>
      )}

      {onQualityGates && (
        <button
          onClick={onQualityGates}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-c-text-secondary hover:bg-c-surface-raised"
          title={t('presentations.builder.topBar.qualityGates', 'Quality Gates')}
        >
          <Shield size={14} />
          <span className="hidden lg:inline">QA</span>
        </button>
      )}

      {onGovernance && (
        <button
          onClick={onGovernance}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-c-text-secondary hover:bg-c-surface-raised"
          title={t('presentations.builder.topBar.governance', 'Governance')}
          aria-label={t('presentations.builder.topBar.governance', 'Governance')}
        >
          <ShieldCheck size={14} />
          <span className="hidden lg:inline">Governance</span>
          {governanceVerdict && (
            <span
              aria-hidden="true"
              className={`ml-0.5 w-1.5 h-1.5 rounded-full ${GOVERNANCE_DOT_CLASS[governanceVerdict] || 'bg-slate-400'}`}
            />
          )}
        </button>
      )}

      {onAnalytics && (
        <button
          onClick={onAnalytics}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-c-text-secondary hover:bg-c-surface-raised"
          title={t('presentations.builder.topBar.analytics', 'Share Analytics')}
        >
          <BarChart3 size={14} />
          <span className="hidden lg:inline">Analytics</span>
        </button>
      )}

      {onAuditLog && (
        <button
          onClick={onAuditLog}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-c-text-secondary hover:bg-c-surface-raised"
          title={t('presentations.builder.topBar.auditLog', 'Audit log')}
          aria-label={t('presentations.builder.topBar.auditLog', 'Audit log')}
        >
          <History size={14} />
          <span className="hidden lg:inline">Audit</span>
        </button>
      )}

      <button
        onClick={onShare}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-c-text-secondary hover:bg-c-surface-raised"
      >
        <Share2 size={14} />
        <span className="hidden md:inline">{t('presentations.builder.topBar.share', 'Share')}</span>
      </button>

      <button
        onClick={onToggleAgent}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
          agentOpen
            ? 'bg-c-accent-soft text-c-text'
            : 'text-c-text-secondary hover:bg-c-surface-raised'
        }`}
      >
        <MessageSquare size={14} />
        <span className="hidden md:inline">
          {t('presentations.builder.topBar.teresa', 'Teresa')}
        </span>
      </button>

      <button
        onClick={onPresent}
        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium bg-c-text text-c-surface hover:opacity-90"
      >
        <Monitor size={14} />
        <span>{t('presentations.builder.topBar.present', 'Present')}</span>
      </button>
    </div>
  );
};
