import { CheckSquare, ChevronDown, ChevronRight, FileText, Lightbulb, Scale } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface RelatedItem {
  type: string;
  id: string;
  title: string;
  relevance: string;
}

interface RelatedContextProps {
  entityType: string;
  entityId: string;
  entityTitle: string;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  notebook: <FileText size={14} className="text-blue-500" />,
  task: <CheckSquare size={14} className="text-emerald-500" />,
  decision: <Scale size={14} className="text-amber-500" />,
  idea: <Lightbulb size={14} className="text-yellow-500" />,
};

export const RelatedContext: React.FC<RelatedContextProps> = ({
  entityType,
  entityId,
  entityTitle,
}) => {
  const { t } = useTranslation();
  const [items, setItems] = useState<RelatedItem[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!expanded || !entityId || !entityTitle) return;
    setLoading(true);
    const fetchRelated = async () => {
      try {
        const token = localStorage.getItem('token');
        const params = new URLSearchParams({ entityType, entityId, title: entityTitle });
        const res = await fetch(`/api/my-work/related-context?${params}`, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        if (res.ok) {
          const data = await res.json();
          setItems(data.results || []);
        }
      } catch {
        /* ignore */
      }
      setLoading(false);
    };
    fetchRelated();
  }, [expanded, entityType, entityId, entityTitle]);

  const handleOpenItem = (item: RelatedItem) => {
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
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          {t('myWork.relatedContext.relatedContext', 'Related Context')}
        </span>
        {items.length > 0 && (
          <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-slate-200 dark:bg-navy-700 text-slate-500">
            {items.length}
          </span>
        )}
      </button>
      {expanded && (
        <div className="px-4 pb-3 space-y-1">
          {loading ? (
            <span className="text-xs text-slate-600">
              {t('myWork.relatedContext.searching', 'Searching...')}
            </span>
          ) : items.length === 0 ? (
            <span className="text-xs text-slate-600">
              {t('myWork.relatedContext.noRelatedItemsFound', 'No related items found')}
            </span>
          ) : (
            items.map((item) => (
              <button
                key={`${item.type}-${item.id}`}
                onClick={() => handleOpenItem(item)}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-left hover:bg-slate-100 dark:hover:bg-navy-700/50 transition-colors"
              >
                {TYPE_ICONS[item.type] || <FileText size={14} />}
                <span className="text-xs text-slate-700 dark:text-slate-200 truncate">
                  {item.title}
                </span>
                <span className="text-[10px] text-slate-600 shrink-0">{item.type}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};
