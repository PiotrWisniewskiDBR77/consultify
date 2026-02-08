/**
 * InitiativeSourceLink
 * Displays source link for initiatives (tool, assessment, interview)
 */

import { ClipboardList, ExternalLink, FileText, Sparkles } from 'lucide-react';
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

  const getSourceLabel = () => {
    switch (sourceType.toLowerCase()) {
      case 'tool':
        return isPolish ? 'Narzędzie' : 'Tool';
      case 'assessment':
        return isPolish ? 'Ocena' : 'Assessment';
      case 'interview':
        return isPolish ? 'Wywiad' : 'Interview';
      default:
        return sourceType;
    }
  };

  const getSourceIcon = () => {
    switch (sourceType.toLowerCase()) {
      case 'tool':
        return <Sparkles size={16} className="text-amber-400" />;
      case 'assessment':
        return <FileText size={16} className="text-blue-400" />;
      case 'interview':
        return <ClipboardList size={16} className="text-green-400" />;
      default:
        return <ExternalLink size={16} className="text-slate-400" />;
    }
  };

  const handleNavigate = () => {
    switch (sourceType.toLowerCase()) {
      case 'tool':
        navigate(`/discovery/tools/${sourceId}`);
        break;
      case 'assessment':
        navigate(`/discovery/assessment/${sourceId}`);
        break;
      case 'interview':
        navigate(`/discovery/interview/${sourceId}`);
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
