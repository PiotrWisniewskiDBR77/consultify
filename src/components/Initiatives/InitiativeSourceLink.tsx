/**
 * InitiativeSourceLink
 * Displays source link for initiatives (tool, assessment, interview)
 * Note: sourceType 'tool' displays as "Idea Workspace" (all idea conversions go through tool sessions)
 */

import { ClipboardList, ExternalLink, FileText, Sparkles } from 'lucide-react';

/** Helper to get display label for source type (tool/tool_session/idea -> Idea Workspace) */
export function getSourceDisplayLabel(sourceType: string, isPolish = false): string {
  const t = String(sourceType || '')
    .trim()
    .toLowerCase();
  const ideaTypes = ['tool', 'tool_session', 'idea'];
  if (ideaTypes.includes(t)) {
    return isPolish ? 'Workspace pomysłu' : 'Idea Workspace';
  }
  if (t === 'assessment') return isPolish ? 'Ocena' : 'Assessment';
  if (t === 'interview' || t === 'interview_insight' || t === 'insight') {
    return isPolish ? 'Interview Insight' : 'Interview Insight';
  }
  if (t === 'conclusion') return isPolish ? 'Insight' : 'Insight';
  if (t === 'conclusion_readout') return isPolish ? 'Readout audytu' : 'Audit readout';
  return sourceType || '';
}
import React from 'react';
import { useNavigate } from 'react-router-dom';

interface InitiativeSourceLinkProps {
  sourceType?: string | null;
  sourceId?: string | null;
  isPolish?: boolean;
}

export const InitiativeSourceLink: React.FC<InitiativeSourceLinkProps> = ({
  sourceType,
  sourceId,
  isPolish = false,
}) => {
  const navigate = useNavigate();

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
        return <FileText size={16} className="text-purple-400" />;
      default:
        return <ExternalLink size={16} className="text-slate-400" />;
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
    <div className="bg-navy-900 rounded-xl border border-navy-700 p-5">
      <div className="flex items-center gap-2 mb-2">
        {getSourceIcon()}
        <span className="text-xs font-semibold text-slate-400 uppercase">
          {isPolish ? 'Źródło' : 'Source'} {getSourceLabel()}
        </span>
      </div>
      <button
        onClick={handleNavigate}
        className="flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors group"
      >
        <span className="font-mono text-xs">{sourceId}</span>
        <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    </div>
  );
};

export default InitiativeSourceLink;
