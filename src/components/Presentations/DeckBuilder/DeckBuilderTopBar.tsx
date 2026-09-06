import {
  ArrowLeft,
  BarChart3,
  ChevronRight,
  Clock,
  History,
  MessageSquare,
  Monitor,
  MoreVertical,
  Palette,
  Redo2,
  Share2,
  Shield,
  ShieldCheck,
  Undo2,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
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
  onQualityGates?: () => void;
  onAnalytics?: () => void;
  onAuditLog?: () => void;
  onGovernance?: () => void;
  governanceVerdict?: 'PASS' | 'PASS_WITH_P2' | 'BLOCKED_P1' | 'BLOCKED_P0' | 'INCONCLUSIVE' | null;
  confidentiality?: 'public' | 'internal' | 'confidential';
  lastAgentActivityAt?: string | null;
  /**
   * HP-8 approval status bar slot — DeckBuilder passes a flag-gated
   * `<ArtifactApprovalStatusBar artifactType="deck" .../>` here (mirrors the
   * `statusBar` slot on ArtifactRightPanel used by Decision/Insight). Undefined
   * when the flag is OFF, so the header renders exactly as before.
   */
  statusBar?: React.ReactNode;
}

const GOVERNANCE_DOT_CLASS: Record<string, string> = {
  PASS: 'bg-emerald-500',
  PASS_WITH_P2: 'bg-amber-500',
  BLOCKED_P1: 'bg-orange-500',
  BLOCKED_P0: 'bg-danger-500',
  INCONCLUSIVE: 'bg-c-text-muted',
};

type ConfidentialityLevel = 'public' | 'internal' | 'confidential';

const CONFIDENTIALITY_STYLES: Record<ConfidentialityLevel, { color: string }> = {
  public: { color: 'text-emerald-500' },
  internal: { color: 'text-blue-500' },
  confidential: { color: 'text-danger-500' },
};

const ConfidentialityBadge: React.FC<{
  confidentiality: ConfidentialityLevel;
  lastAgentActivityAt?: string | null;
}> = ({ confidentiality, lastAgentActivityAt }) => {
  const { t } = useTranslation();
  const { color } = CONFIDENTIALITY_STYLES[confidentiality];
  const label = t(`presentations.builder.confidentiality.${confidentiality}`, confidentiality);

  const isRecentAgentActivity = (() => {
    if (!lastAgentActivityAt) return false;
    const ts = Date.parse(lastAgentActivityAt);
    if (Number.isNaN(ts)) return false;
    return Date.now() - ts <= 60_000;
  })();

  const titleParts = [`${t('presentations.builder.confidentiality.label', 'Confidentiality')}: ${label}`];
  if (isRecentAgentActivity && lastAgentActivityAt) {
    titleParts.push(t('presentations.builder.confidentiality.recentAiActivity', 'Recent AI activity: {{date}}', { date: lastAgentActivityAt }));
  }

  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium text-c-text-secondary"
      title={titleParts.join(' · ')}
    >
      <Shield size={14} className={color} />
      <span className="hidden md:inline">{label}</span>
      {isRecentAgentActivity && (
        // VF1-7: was a raw violet Tailwind palette dot — recent-AI-activity
        // accent → c-info (skill consultify-artefakty: "Akcent AI/info = c-info").
        <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-c-info animate-pulse" />
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
  onQualityGates,
  onAnalytics,
  onAuditLog,
  onGovernance,
  governanceVerdict,
  confidentiality,
  lastAgentActivityAt,
  statusBar,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const goToPresentations = () => navigate('/presentations');

  // R4 — close the "⋯" overflow menu on outside click.
  useEffect(() => {
    if (!moreOpen) return;
    const onClick = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [moreOpen]);

  // VF1-7 a11y — close the "⋯" overflow menu on Escape (kanon §12.3: "Esc →
  // zamknij drawer/modal"). Owns its Escape locally so DeckBuilder's
  // page-level Esc handler doesn't need to know about this menu.
  useEffect(() => {
    if (!moreOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [moreOpen]);

  // R4 — secondary/governance actions consolidated into the overflow menu.
  const overflowItems = [
    onVersionHistory && {
      key: 'history',
      icon: <Clock size={14} />,
      label: t('presentations.builder.versionHistory.title', 'Version History'),
      onClick: onVersionHistory,
    },
    onQualityGates && {
      key: 'qa',
      icon: <Shield size={14} />,
      label: t('presentations.builder.topBar.qualityGates', 'Quality Gates'),
      onClick: onQualityGates,
    },
    onGovernance && {
      key: 'governance',
      icon: <ShieldCheck size={14} />,
      label: t('presentations.builder.topBar.governance', 'Governance'),
      onClick: onGovernance,
      dot: governanceVerdict
        ? GOVERNANCE_DOT_CLASS[governanceVerdict] || 'bg-c-text-muted'
        : undefined,
    },
    onAnalytics && {
      key: 'analytics',
      icon: <BarChart3 size={14} />,
      label: t('presentations.builder.topBar.analytics', 'Share Analytics'),
      onClick: onAnalytics,
    },
    onAuditLog && {
      key: 'audit',
      icon: <History size={14} />,
      label: t('presentations.builder.topBar.auditLog', 'Audit log'),
      onClick: onAuditLog,
    },
  ].filter(Boolean) as Array<{
    key: string;
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    dot?: string;
  }>;

  return (
    <div className="h-12 border-b border-c-border-subtle bg-c-surface flex items-center px-4 gap-3 flex-shrink-0">
      {/* Back / Exit */}
      <button
        onClick={goToPresentations}
        className="flex-shrink-0 p-1.5 rounded-lg text-c-text-muted hover:bg-c-surface-raised hover:text-c-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        title={t('presentations.builder.exit', 'Exit to Presentations')}
        aria-label={t('presentations.builder.exit', 'Exit to Presentations')}
      >
        <ArrowLeft size={18} />
      </button>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-c-text-muted min-w-0 flex-1">
        <button
          onClick={goToPresentations}
          className="flex-shrink-0 hover:text-c-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus rounded"
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
            className="text-c-text font-medium truncate hover:text-c-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus rounded"
          >
            {title || t('presentations.builder.untitled', 'Untitled Deck')}
          </button>
        )}
      </div>

      {/* HP-8 approval status bar (deck) — flag-gated slot, undefined = OFF */}
      {statusBar ? <div className="flex-shrink-0">{statusBar}</div> : null}

      {/* Undo / Redo */}
      <div className="flex items-center gap-1 border-r border-c-border-subtle pr-3 mr-1">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="p-1.5 rounded-lg hover:bg-c-surface-raised disabled:opacity-30 text-c-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          title={`${t('presentations.builder.topBar.undo', 'Undo')} (⌘Z)`}
        >
          <Undo2 size={16} />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="p-1.5 rounded-lg hover:bg-c-surface-raised disabled:opacity-30 text-c-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          title={`${t('presentations.builder.topBar.redo', 'Redo')} (⇧⌘Z)`}
        >
          <Redo2 size={16} />
        </button>
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
        data-testid="deck-theme-btn"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-c-text-secondary hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
      >
        <Palette size={14} />
        <span className="hidden md:inline">{t('presentations.builder.topBar.theme', 'Theme')}</span>
      </button>

      {/* R4 — overflow menu: QA / Governance / Analytics / Audit / History */}
      {overflowItems.length > 0 && (
        <div className="relative" ref={moreRef}>
          <button
            onClick={() => setMoreOpen((v) => !v)}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm text-c-text-secondary hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            title={t('presentations.builder.topBar.more', 'More')}
            aria-label={t('presentations.builder.topBar.more', 'More')}
            aria-haspopup="menu"
            aria-expanded={moreOpen}
          >
            <MoreVertical size={16} />
            {governanceVerdict && (
              <span
                aria-hidden="true"
                className={`w-1.5 h-1.5 rounded-full ${GOVERNANCE_DOT_CLASS[governanceVerdict] || 'bg-c-text-muted'}`}
              />
            )}
          </button>
          {moreOpen && (
            <div
              role="menu"
              // VF1-7: light-mode border was a raw slate Tailwind palette shade —
              // now a token border (dark-mode hairline left as-is, not touched here).
              className="absolute top-full right-0 mt-1 min-w-[12rem] bg-c-surface border border-c-border-subtle dark:border-white/[0.03] rounded-lg shadow-xl p-1 z-50"
            >
              {overflowItems.map((item) => (
                <button
                  key={item.key}
                  role="menuitem"
                  onClick={() => {
                    setMoreOpen(false);
                    item.onClick();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-c-text hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                >
                  {item.icon}
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.dot && (
                    <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full ${item.dot}`} />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        onClick={onShare}
        data-testid="deck-share-btn"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-c-text-secondary hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
      >
        <Share2 size={14} />
        <span className="hidden md:inline">{t('presentations.builder.topBar.share', 'Share')}</span>
      </button>

      <button
        onClick={onPresent}
        data-testid="deck-present-btn"
        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium bg-c-surface text-c-text hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
      >
        <Monitor size={14} />
        <span>{t('presentations.builder.topBar.present', 'Present')}</span>
      </button>
    </div>
  );
};
