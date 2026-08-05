/**
 * CitationList
 *
 * Renders citations from AI responses with links to source data.
 * Follows Perplexity-style inline citation markers [1], [2], etc.
 */

import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  FileText,
  Globe,
  Lightbulb,
  Lock,
  Map,
  Quote,
  Target,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { useAppStore } from '../../store/useAppStore';
import { ChatCitation } from '../../types';
import { AppView } from '../../types';

interface CitationListProps {
  citations: ChatCitation[];
  collapsed?: boolean;
  onToggle?: () => void;
}

const CITATION_ICONS: Record<string, React.ElementType> = {
  assessment: Target,
  initiative: Lightbulb,
  report: FileText,
  roadmap: Map,
  external: Globe,
};

/** M01-P04B (GF-CHAT-08) — the three non-`ready` access states a citation can carry. */
export type CitationAccessStatus = 'ready' | 'stale' | 'failed' | 'no_access';

export function getCitationAccessStatus(citation: ChatCitation): CitationAccessStatus {
  const raw = (citation as any)?.status;
  return raw === 'stale' || raw === 'failed' || raw === 'no_access' ? raw : 'ready';
}

function sanitizeCitationText(value: unknown): string {
  return String(value || '')
    .replace(/\s*\[(?:MEM|DT|BM|KB|WEB|ASS|FIN)\](?=[\s.,;:!?)]|$)/gi, '')
    .replace(/\b(?:MEM|DT|BM|KB|WEB|ASS|FIN):\s*/gi, '')
    .replace(/\b(?:rag|chunk)_\d+\b/gi, '')
    .replace(/^source\s+\d+$/i, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function getUserFacingCitationTitle(citation: ChatCitation): string {
  const rawTitle = sanitizeCitationText((citation as any)?.title);
  const rawReference = sanitizeCitationText((citation as any)?.reference);
  if (rawTitle && !/^source\s+\d+$/i.test(rawTitle) && !/^rag_\d+$/i.test(rawTitle)) {
    return rawTitle;
  }
  if (citation.type === 'external') return 'External source';
  if (rawReference && !/^rag_\d+$/i.test(rawReference)) return rawReference;
  return 'Knowledge base source';
}

/**
 * M01-P04B (GF-CHAT-08) — safe-by-construction render view for a citation.
 * For any non-`ready` status, `title`/`excerpt`/`reference` are REPLACED by a
 * generic, translated label — never the real document title or content, even
 * if the raw citation object still carries them (e.g. it was rendered
 * `ready` before a later status-delta marked it `failed`/`stale`). This is
 * the client-side half of the negative control: a test that feeds a `failed`
 * citation with a real `title` MUST NOT find that title in the rendered DOM.
 */
function getSafeCitationView(
  citation: ChatCitation,
  t: (key: string, fallback: string) => string
): { title: string; excerpt: string | null; reference: string | null; isRedacted: boolean } {
  const status = getCitationAccessStatus(citation);
  if (status === 'failed') {
    return {
      title: t('aiChat.citationUnavailable', 'Source unavailable'),
      excerpt: null,
      reference: null,
      isRedacted: true,
    };
  }
  if (status === 'stale') {
    return {
      title: t('aiChat.citationStale', 'Source may be outdated'),
      excerpt: null,
      reference: null,
      isRedacted: true,
    };
  }
  if (status === 'no_access') {
    return {
      title: t('aiChat.citationNoAccess', 'Source not accessible to you'),
      excerpt: null,
      reference: null,
      isRedacted: true,
    };
  }
  return {
    title: getUserFacingCitationTitle(citation),
    excerpt: citation.excerpt ? sanitizeCitationText(citation.excerpt) : null,
    reference: sanitizeCitationText(citation.reference) || null,
    isRedacted: false,
  };
}

const STATUS_ICON: Partial<Record<CitationAccessStatus, React.ElementType>> = {
  failed: AlertTriangle,
  stale: Clock,
  no_access: Lock,
};

export const CitationList: React.FC<CitationListProps> = ({
  citations,
  collapsed = false,
  onToggle,
}) => {
  const { t } = useTranslation();
  const { setCurrentView } = useAppStore();
  const [internalCollapsed, setInternalCollapsed] = React.useState(collapsed);
  // M01-P04B (GF-CHAT-02): which citation's fragment is currently open.
  const [openFragmentId, setOpenFragmentId] = React.useState<string | null>(null);

  if (!citations || citations.length === 0) return null;

  const isCollapsed = onToggle ? collapsed : internalCollapsed;
  const handleToggle = () => {
    if (onToggle) {
      onToggle();
      return;
    }
    setInternalCollapsed((value) => !value);
  };

  const navigateToSource = (citation: ChatCitation) => {
    // Navigate to source based on type
    switch (citation.type) {
      case 'assessment':
        setCurrentView(AppView.ASSESSMENT_SUMMARY);
        break;
      case 'initiative':
        setCurrentView(AppView.FULL_STEP2_INITIATIVES);
        break;
      case 'report':
        setCurrentView(AppView.FULL_STEP6_REPORTS);
        break;
      case 'roadmap':
        setCurrentView(AppView.FULL_STEP3_ROADMAP);
        break;
      case 'external':
        if (citation.link) {
          window.open(citation.link, '_blank', 'noopener,noreferrer');
        }
        break;
    }
  };

  /**
   * M01-P04B (GF-CHAT-02): a citation that carries a real `fragmentIndex`
   * opens its FRAGMENT inline first (the actual retrieved excerpt, labeled
   * with its ordinal position) rather than jumping straight to the document.
   * Previously every citation click navigated to a generic module view with
   * zero connection to the specific cited passage — the packet's main gap.
   * A redacted (`failed`/`stale`/`no_access`) citation never opens anything —
   * there is no safe fragment to show.
   */
  const handleCitationClick = (citation: ChatCitation) => {
    const status = getCitationAccessStatus(citation);
    if (status !== 'ready') return;
    const hasFragment = typeof citation.fragmentIndex === 'number';
    if (hasFragment) {
      setOpenFragmentId((current) => (current === citation.id ? null : citation.id));
      return;
    }
    navigateToSource(citation);
  };

  return (
    <div className="mt-2 border-t border-slate-200/60 pt-2 dark:border-navy-700/50">
      {/* Header */}
      <button
        onClick={handleToggle}
        className="flex items-center gap-2 text-[11px] font-medium text-slate-600 transition-colors hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
      >
        <span>{t('aiChat.deepSearchSources', 'Deep search sources')}</span>
        <span className="rounded border border-slate-200/70 px-1.5 py-0.5 text-[10px] text-slate-600 dark:border-navy-700 dark:text-slate-500">
          {citations.length}
        </span>
        {isCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
      </button>

      {/* Citations List */}
      {!isCollapsed && (
        <div className="mt-2 space-y-1.5">
          {citations.map((citation, index) => {
            const status = getCitationAccessStatus(citation);
            const StatusIcon = STATUS_ICON[status];
            const Icon = StatusIcon || CITATION_ICONS[citation.type] || FileText;
            const view = getSafeCitationView(citation, t);
            const hasFragment = status === 'ready' && typeof citation.fragmentIndex === 'number';
            const isFragmentOpen = hasFragment && openFragmentId === citation.id;

            return (
              <div key={citation.id}>
                <button
                  onClick={() => handleCitationClick(citation)}
                  disabled={status !== 'ready'}
                  aria-expanded={hasFragment ? isFragmentOpen : undefined}
                  data-testid={`citation-item-${status}`}
                  data-citation-status={status}
                  className={`
                                    w-full flex items-start gap-2 rounded-lg border border-slate-200/70
                                    bg-slate-50/50 p-2 text-left text-slate-500
                                    transition-colors dark:border-navy-700/70 dark:bg-navy-900/30
                                    dark:text-slate-400
                                    ${
                                      status === 'ready'
                                        ? 'hover:bg-slate-100/70 hover:text-slate-700 dark:hover:bg-navy-800/50'
                                        : 'cursor-default opacity-80'
                                    }
                                `}
                >
                  {/* Citation Number */}
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-slate-200 bg-white text-[10px] font-semibold text-slate-600 dark:border-navy-700 dark:bg-navy-900">
                    {index + 1}
                  </span>

                  {/* Icon */}
                  <Icon size={13} className="mt-0.5 shrink-0 text-slate-600 dark:text-slate-500" />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <div className="truncate text-xs font-medium text-slate-600 dark:text-slate-300">
                        {view.title}
                      </div>
                      {/* Feedback #1cbe2baa — explicit "External" tag so
                          users can see at a glance which sources are web-
                          sourced vs workspace/RAG. Previously the Globe
                          icon alone was ambiguous and users asked whether
                          external links were even supposed to appear. */}
                      {status === 'ready' && citation.type === 'external' && (
                        <span className="shrink-0 rounded border border-slate-200 bg-white/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-600 dark:border-navy-700 dark:bg-navy-900/50 dark:text-slate-500">
                          {t('aiChat.citationExternalBadge', 'External')}
                        </span>
                      )}
                      {/* M01-P04B fragment anchor badge — signals this citation
                          opens a specific fragment, not just the document. */}
                      {hasFragment && (
                        <span className="flex shrink-0 items-center gap-0.5 rounded border border-slate-200 bg-white/60 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600 dark:border-navy-700 dark:bg-navy-900/50 dark:text-slate-500">
                          <Quote size={9} />
                          {t(
                            'aiChat.citationFragmentBadge',
                            `Fragment ${(citation.fragmentIndex as number) + 1}`
                          )}
                        </span>
                      )}
                    </div>
                    {view.reference && (
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        {view.reference}
                      </div>
                    )}
                    {view.excerpt && !isFragmentOpen && (
                      <div className="text-[10px] text-slate-600 dark:text-slate-500 mt-0.5 line-clamp-2">
                        "{view.excerpt}"
                      </div>
                    )}
                  </div>

                  {/* Trailing icon: external-link affordance only for citations that
                      actually navigate; a fragment toggle gets a chevron instead. */}
                  {hasFragment ? (
                    isFragmentOpen ? (
                      <ChevronUp size={12} className="shrink-0 text-slate-600 dark:text-slate-500" />
                    ) : (
                      <ChevronDown
                        size={12}
                        className="shrink-0 text-slate-600 dark:text-slate-500"
                      />
                    )
                  ) : (
                    status === 'ready' && (
                      <ExternalLink
                        size={12}
                        className="shrink-0 text-slate-600 dark:text-slate-500"
                      />
                    )
                  )}
                </button>

                {/* M01-P04B (GF-CHAT-02): the opened fragment — the actual
                    retrieved excerpt, not just the document name — plus an
                    explicit secondary action to open the full source. */}
                {isFragmentOpen && (
                  <div
                    data-testid="citation-fragment-open"
                    className="ml-7 mt-1 rounded-lg border border-slate-200/70 bg-white p-2 text-[11px] text-slate-700 dark:border-navy-700/70 dark:bg-navy-900/60 dark:text-slate-200"
                  >
                    <div className="mb-1 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      <Quote size={10} />
                      {t(
                        'aiChat.citationFragmentOpenLabel',
                        `Fragment ${(citation.fragmentIndex as number) + 1}`
                      )}
                    </div>
                    <div className="whitespace-pre-wrap">
                      {view.excerpt || t('aiChat.citationFragmentEmpty', 'No excerpt available.')}
                    </div>
                    {citation.type !== 'external' && (
                      <button
                        type="button"
                        onClick={() => navigateToSource(citation)}
                        className="mt-2 text-[10px] font-medium text-slate-600 underline decoration-dotted hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                      >
                        {t('aiChat.citationOpenSource', 'Open source')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/**
 * Inline citation marker component
 * Renders [1], [2], etc. inline with hover preview
 */
interface CitationMarkerProps {
  number: number;
  citation: ChatCitation;
  onClick?: () => void;
}

export const CitationMarker: React.FC<CitationMarkerProps> = ({ number, citation, onClick }) => {
  const [showTooltip, setShowTooltip] = React.useState(false);
  const Icon = CITATION_ICONS[citation.type] || FileText;
  const title = getUserFacingCitationTitle(citation);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <button
        onClick={onClick}
        className="
                    inline-flex items-center justify-center
                    w-4 h-4 text-[9px] font-bold
                    bg-primary-100 dark:bg-primary-900/40
                    text-primary-700 dark:text-primary-300
                    rounded align-super mx-0.5
                    hover:bg-primary-200 dark:hover:bg-primary-800/50
                    transition-colors cursor-pointer
                "
      >
        {number}
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div
          className="
                    absolute left-0 bottom-full mb-1 z-50
                    w-48 p-2
                    bg-white dark:bg-navy-800
                    border border-slate-200 dark:border-navy-700
                    rounded-lg shadow-lg
                    animate-in fade-in-0 zoom-in-95 duration-100
                "
        >
          <div className="flex items-start gap-2">
            <Icon size={14} className="text-primary-500 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-medium text-navy-900 dark:text-white">{title}</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                {sanitizeCitationText(citation.reference)}
              </div>
            </div>
          </div>
        </div>
      )}
    </span>
  );
};

export default CitationList;
