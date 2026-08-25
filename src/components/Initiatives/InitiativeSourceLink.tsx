/**
 * InitiativeSourceLink
 * Displays source link for initiatives (tool, assessment, interview)
 * Note: sourceType 'tool' displays as "Idea Workspace" (all idea conversions go through tool sessions)
 */

import { ClipboardList, ExternalLink, FileText, Sparkles } from 'lucide-react';

import i18n from '@/i18n';

/** Helper to get display label for source type (tool/tool_session/idea -> Idea Workspace) */
export function getSourceDisplayLabel(sourceType: string, _isPolish = false): string {
  const t = String(sourceType || '')
    .trim()
    .toLowerCase();
  const ideaTypes = ['tool', 'tool_session', 'idea'];
  if (ideaTypes.includes(t)) {
    return i18n.t('initiatives.initiativeSourceLink.ideaWorkspace');
  }
  if (t === 'assessment') return i18n.t('initiatives.initiativeSourceLink.assessment');
  if (t === 'interview' || t === 'interview_insight' || t === 'insight') {
    return i18n.t('initiatives.initiativeSourceLink.interviewInsight');
  }
  if (t === 'conclusion') return i18n.t('initiatives.initiativeSourceLink.insight');
  if (t === 'conclusion_readout') return i18n.t('initiatives.initiativeSourceLink.auditReadout');
  if (t === 'task' || t === 'task_set') return i18n.t('initiatives.initiativeSourceLink.task');
  if (t === 'decision') return i18n.t('initiatives.initiativeSourceLink.decision');
  if (t === 'notebook' || t === 'notebook_page') {
    return i18n.t('initiatives.initiativeSourceLink.notebook');
  }
  if (t === 'initiative') return i18n.t('initiatives.initiativeSourceLink.initiativeLabel');
  if (t === 'report') return i18n.t('initiatives.initiativeSourceLink.report');
  if (t === 'presentation') return i18n.t('initiatives.initiativeSourceLink.presentation');
  if (t === 'team_chat') return i18n.t('initiatives.initiativeSourceLink.teamChat');
  // MYW-IDEAS-CORE-001: never surface a raw, unmapped source-type slug to the
  // owner (e.g. "process_flow_candidate") — fall back to a Title Case label
  // instead of the lowercase/underscored technical value.
  if (!t) return '';
  return t
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

interface InitiativeSourceLinkProps {
  sourceType?: string | null;
  sourceId?: string | null;
  /**
   * Optional explicit language override. When omitted the component
   * self-localizes from the active i18n language, so callers no longer
   * need to pass this to get the correct PL/EN labels.
   */
  isPolish?: boolean;
}

export const InitiativeSourceLink: React.FC<InitiativeSourceLinkProps> = ({
  sourceType,
  sourceId,
  isPolish: isPolishProp,
}) => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isPolish = isPolishProp ?? i18n.language === 'pl';

  if (!sourceType || !sourceId) {
    return null;
  }

  const getSourceLabel = () => getSourceDisplayLabel(sourceType, isPolish) || sourceType;

  const getSourceIcon = () => {
    switch (sourceType.toLowerCase()) {
      case 'tool':
      case 'tool_session':
      case 'idea':
        return <Sparkles size={16} className="text-amber-400" />;
      case 'assessment':
        return <FileText size={16} className="text-blue-400" />;
      case 'interview':
      case 'interview_insight':
      case 'insight':
        return <ClipboardList size={16} className="text-green-400" />;
      case 'conclusion':
      case 'conclusion_readout':
        return <FileText size={16} className="text-c-info" />;
      default:
        return <ExternalLink size={16} className="text-slate-600" />;
    }
  };

  const handleNavigate = () => {
    switch (sourceType.toLowerCase()) {
      case 'tool':
      case 'tool_session':
      case 'idea':
        navigate(`/my-work?tab=ideas&sessionId=${sourceId}`);
        break;
      case 'assessment':
        navigate(`/interview?assessmentId=${sourceId}`);
        break;
      case 'interview':
      case 'interview_insight':
      case 'insight':
      case 'conclusion':
        navigate(`/interview?insightId=${sourceId}`);
        break;
      case 'conclusion_readout':
        navigate('/presentations?tab=documents');
        break;
      default:
        break;
    }
  };

  return (
    <div className="bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] p-5">
      <div className="flex items-center gap-2 mb-2">
        {getSourceIcon()}
        <span className="text-xs font-semibold text-c-text-muted uppercase">
          {t('initiatives.initiativeSourceLink.source')} {getSourceLabel()}
        </span>
      </div>
      <button
        onClick={handleNavigate}
        className="flex items-center gap-2 text-sm text-c-text-secondary hover:text-c-text transition-colors group"
      >
        <span className="font-mono text-xs">{sourceId}</span>
        <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    </div>
  );
};

export default InitiativeSourceLink;
