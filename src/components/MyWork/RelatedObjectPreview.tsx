// @ts-nocheck
/**
 * RelatedObjectPreview - Preview card for Initiative/Task linked to decision
 * Fetches and displays related object details with navigation
 */

import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckSquare,
  Clock,
  ExternalLink,
  Loader2,
  Target,
  User,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';

interface RelatedObjectPreviewProps {
  type: string;
  id: string;
  onNavigate?: (type: string, id: string) => void;
}

interface InitiativeData {
  id: string;
  name: string;
  status: string;
  priority?: string;
  ownerName?: string;
  owner_business_name?: string;
  owner_business_id?: string;
  category?: string;
  description?: string;
}

interface TaskData {
  id: string;
  title: string;
  status: string;
  priority?: string;
  assigneeName?: string;
  assignee_name?: string;
  assignee_id?: string;
  dueDate?: string;
  due_date?: string;
  description?: string;
}

type RelatedData = InitiativeData | TaskData | null;

// Status badge styles
const getStatusStyle = (status: string) => {
  const s = status?.toLowerCase();
  if (['completed', 'done', 'approved'].includes(s)) {
    return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
  }
  if (['blocked', 'rejected', 'cancelled'].includes(s)) {
    return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
  }
  if (['in_progress', 'executing', 'review'].includes(s)) {
    return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
  }
  if (['pending', 'planning', 'draft'].includes(s)) {
    return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300';
  }
  return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
};

// Get icon for type
const getTypeIcon = (type: string) => {
  switch (type?.toUpperCase()) {
    case 'INITIATIVE':
      return <Target size={16} className="text-purple-500" />;
    case 'TASK':
      return <CheckSquare size={16} className="text-blue-500" />;
    case 'PHASE':
      return <Clock size={16} className="text-emerald-500" />;
    default:
      return <AlertCircle size={16} className="text-slate-400 dark:text-slate-500" />;
  }
};

// Format date
const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const RelatedObjectPreview: React.FC<RelatedObjectPreviewProps> = ({
  type,
  id,
  onNavigate,
}) => {
  const { t } = useTranslation();
  const [data, setData] = useState<RelatedData>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch related object
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        let endpoint = '';
        switch (type?.toUpperCase()) {
          case 'INITIATIVE':
            endpoint = `/initiatives/${id}`;
            break;
          case 'TASK':
            endpoint = `/tasks/${id}`;
            break;
          case 'PHASE':
            endpoint = `/projects/phases/${id}`;
            break;
          default:
            setError(`Unknown type: ${type}`);
            return;
        }

        const result = await Api.get(endpoint);
        setData(result);
      } catch (err) {
        console.error('Failed to fetch related object:', err);
        setError(t('decisions.relatedObjectError', 'Could not load related item'));
      } finally {
        setLoading(false);
      }
    };

    if (type && id) {
      fetchData();
    }
  }, [type, id, t]);

  // Handle navigation
  const handleClick = () => {
    if (onNavigate && type && id) {
      onNavigate(type, id);
    }
  };

  if (loading) {
    return (
      <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-100 dark:border-navy-700 flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-slate-400 dark:text-slate-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-100 dark:border-navy-700 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <AlertCircle size={16} />
        {error || t('decisions.noRelatedObject', 'Related item not found')}
      </div>
    );
  }

  // Render Initiative Preview
  if (type?.toUpperCase() === 'INITIATIVE') {
    const initiative = data as InitiativeData;
    return (
      <div
        onClick={handleClick}
        className={`
                    p-4 bg-white dark:bg-navy-900 rounded-lg 
                    border border-slate-200 dark:border-navy-700
                    ${onNavigate ? 'cursor-pointer hover:border-purple-300 dark:hover:border-purple-500/50 transition-colors group' : ''}
                `}
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0 p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
            <Target size={20} className="text-purple-600 dark:text-purple-400" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium uppercase">
                Initiative
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-medium ${getStatusStyle(initiative.status)}`}
              >
                {initiative.status}
              </span>
            </div>

            <h4 className="text-sm font-medium text-slate-800 dark:text-white mb-1 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
              {initiative.name}
            </h4>

            {initiative.description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">
                {initiative.description}
              </p>
            )}

            <div className="flex items-center gap-4 text-xs text-slate-400 dark:text-slate-500">
              {(initiative.ownerName || initiative.owner_business_name) && (
                <div className="flex items-center gap-1">
                  <User size={12} />
                  <span>{initiative.ownerName || initiative.owner_business_name}</span>
                </div>
              )}
              {initiative.category && <span className="text-slate-300 dark:text-slate-600">•</span>}
              {initiative.category && <span>{initiative.category}</span>}
            </div>
          </div>

          {onNavigate && (
            <ArrowRight
              size={16}
              className="shrink-0 text-slate-300 dark:text-slate-600 group-hover:text-purple-500 transition-colors"
            />
          )}
        </div>
      </div>
    );
  }

  // Render Task Preview
  if (type?.toUpperCase() === 'TASK') {
    const task = data as TaskData;
    const dueDate = task.dueDate || task.due_date;
    const assignee = task.assigneeName || task.assignee_name;

    return (
      <div
        onClick={handleClick}
        className={`
                    p-4 bg-white dark:bg-navy-900 rounded-lg 
                    border border-slate-200 dark:border-navy-700
                    ${onNavigate ? 'cursor-pointer hover:border-blue-300 dark:hover:border-blue-500/50 transition-colors group' : ''}
                `}
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0 p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <CheckSquare size={20} className="text-blue-600 dark:text-blue-400" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium uppercase">
                Task
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-medium ${getStatusStyle(task.status)}`}
              >
                {task.status}
              </span>
            </div>

            <h4 className="text-sm font-medium text-slate-800 dark:text-white mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {task.title}
            </h4>

            {task.description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">
                {task.description}
              </p>
            )}

            <div className="flex items-center gap-4 text-xs text-slate-400 dark:text-slate-500">
              {assignee && (
                <div className="flex items-center gap-1">
                  <User size={12} />
                  <span>{assignee}</span>
                </div>
              )}
              {dueDate && (
                <>
                  {assignee && <span className="text-slate-300 dark:text-slate-600">•</span>}
                  <div className="flex items-center gap-1">
                    <Calendar size={12} />
                    <span>{formatDate(dueDate)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {onNavigate && (
            <ArrowRight
              size={16}
              className="shrink-0 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 transition-colors"
            />
          )}
        </div>
      </div>
    );
  }

  // Generic fallback
  return (
    <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-100 dark:border-navy-700 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
      {getTypeIcon(type)}
      <span>
        {type}: {id}
      </span>
    </div>
  );
};

export default RelatedObjectPreview;
