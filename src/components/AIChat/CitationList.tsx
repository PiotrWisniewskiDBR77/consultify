/**
 * CitationList
 *
 * Renders citations from AI responses with links to source data.
 * Follows Perplexity-style inline citation markers [1], [2], etc.
 */

import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Globe,
  Lightbulb,
  Map,
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

export const CitationList: React.FC<CitationListProps> = ({
  citations,
  collapsed = false,
  onToggle,
}) => {
  const { t } = useTranslation();
  const { setCurrentView } = useAppStore();
  const [internalCollapsed, setInternalCollapsed] = React.useState(collapsed);

  if (!citations || citations.length === 0) return null;

  const isCollapsed = onToggle ? collapsed : internalCollapsed;
  const handleToggle = () => {
    if (onToggle) {
      onToggle();
      return;
    }
    setInternalCollapsed((value) => !value);
  };

  const handleCitationClick = (citation: ChatCitation) => {
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

  return (
    <div className="mt-2 border-t border-slate-200/60 pt-2 dark:border-navy-700/50">
      {/* Header */}
      <button
        onClick={handleToggle}
        className="flex items-center gap-2 text-[11px] font-medium text-slate-400 transition-colors hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
      >
        <span>{t('aiChat.deepSearchSources', 'Deep search sources')}</span>
        <span className="rounded border border-slate-200/70 px-1.5 py-0.5 text-[10px] text-slate-400 dark:border-navy-700 dark:text-slate-500">
          {citations.length}
        </span>
        {isCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
      </button>

      {/* Citations List */}
      {!isCollapsed && (
        <div className="mt-2 space-y-1.5">
          {citations.map((citation, index) => {
            const Icon = CITATION_ICONS[citation.type] || FileText;
            const title = getUserFacingCitationTitle(citation);

            return (
              <button
                key={citation.id}
                onClick={() => handleCitationClick(citation)}
                className={`
                                    w-full flex items-start gap-2 rounded-lg border border-slate-200/70
                                    bg-slate-50/50 p-2 text-left text-slate-500
                                    transition-colors hover:bg-slate-100/70 hover:text-slate-700
                                    dark:border-navy-700/70 dark:bg-navy-900/30
                                    dark:text-slate-400 dark:hover:bg-navy-800/50
                                `}
              >
                {/* Citation Number */}
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-slate-200 bg-white text-[10px] font-semibold text-slate-400 dark:border-navy-700 dark:bg-navy-900">
                  {index + 1}
                </span>

                {/* Icon */}
                <Icon size={13} className="mt-0.5 shrink-0 text-slate-400 dark:text-slate-500" />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <div className="truncate text-xs font-medium text-slate-600 dark:text-slate-300">
                      {title}
                    </div>
                    {/* Feedback #1cbe2baa — explicit "External" tag so
                        users can see at a glance which sources are web-
                        sourced vs workspace/RAG. Previously the Globe
                        icon alone was ambiguous and users asked whether
                        external links were even supposed to appear. */}
                    {citation.type === 'external' && (
                      <span className="shrink-0 rounded border border-slate-200 bg-white/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400 dark:border-navy-700 dark:bg-navy-900/50 dark:text-slate-500">
                        {t('aiChat.citationExternalBadge', 'External')}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {sanitizeCitationText(citation.reference)}
                  </div>
                  {citation.excerpt && (
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-2">
                      "{sanitizeCitationText(citation.excerpt)}"
                    </div>
                  )}
                </div>

                {/* External Link Icon */}
                <ExternalLink size={12} className="shrink-0 text-slate-400 dark:text-slate-500" />
              </button>
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
