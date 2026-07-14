import {
  CheckSquare,
  ChevronDown,
  ChevronRight,
  FileText,
  Lightbulb,
  Scale,
  Sparkles,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Relationship {
  type: string;
  id: string;
  title: string;
  relationship: string;
  strength: number;
}

interface AIConnectionsProps {
  entityType: string;
  entityId: string;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  task: <CheckSquare size={12} className="text-emerald-500" />,
  decision: <Scale size={12} className="text-amber-500" />,
  idea: <Lightbulb size={12} className="text-yellow-500" />,
  notebook: <FileText size={12} className="text-blue-500" />,
};

const RELATIONSHIP_LABELS: Record<string, string> = {
  same_initiative: 'Same initiative',
  potentially_blocking: 'May be blocking',
  keyword_match: 'Related topic',
  mentioned_in: 'Mentioned in',
};

export const AIConnections: React.FC<AIConnectionsProps> = ({ entityType, entityId }) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const [items, setItems] = useState<Relationship[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!expanded || !entityId) return;
    setLoading(true);
    let cancelled = false;
    const fetchRelationships = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(
          `/api/my-work/relationships?entityId=${encodeURIComponent(entityId)}&entityType=${encodeURIComponent(entityType)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );
        if (res.ok && !cancelled) {
          const data = await res.json();
          setItems(data.relationships || []);
        }
      } catch {
        /* ignore */
      }
      if (!cancelled) setLoading(false);
    };
    fetchRelationships();
    return () => {
      cancelled = true;
    };
  }, [expanded, entityType, entityId]);

  const handleOpenItem = (item: Relationship) => {
    window.dispatchEvent(
      new CustomEvent('mywork-open-item', {
        detail: { type: item.type, id: item.id, name: item.title },
      })
    );
  };

  return (
    <div className="border-t border-slate-200 dark:border-navy-700">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors"
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Sparkles size={12} className="text-primary-500" />
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          {t('myWork.aiConnections.aIDiscoveredConnections', 'AI-Discovered Connections')}
        </span>
        {items.length > 0 && (
          <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600">
            {items.length}
          </span>
        )}
      </button>
      {expanded && (
        <div className="px-4 pb-3 space-y-1">
          {loading ? (
            <span className="text-xs text-slate-600">
              {t('myWork.aiConnections.analyzing', 'Analyzing...')}
            </span>
          ) : items.length === 0 ? (
            <span className="text-xs text-slate-600">
              {t('myWork.aiConnections.noConnectionsFound', 'No connections found')}
            </span>
          ) : (
            items.map((item) => (
              <button
                key={`${item.type}-${item.id}`}
                onClick={() => handleOpenItem(item)}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-left hover:bg-slate-100 dark:hover:bg-navy-700/50 transition-colors"
              >
                {TYPE_ICONS[item.type]}
                <div className="min-w-0 flex-1">
                  <span className="text-xs text-slate-700 dark:text-slate-200 truncate block">
                    {item.title}
                  </span>
                  <span className="text-[10px] text-slate-600">
                    {RELATIONSHIP_LABELS[item.relationship] || item.relationship}
                  </span>
                </div>
                <div className="w-8 h-1 rounded-full bg-slate-200 dark:bg-navy-700 shrink-0">
                  <div
                    className="h-full rounded-full bg-navy-900 dark:bg-slate-300"
                    style={{ width: `${item.strength * 100}%` }}
                  />
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};
