import { Check, Search } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface OwnerOption {
  id: string;
  name: string;
  avatar?: string;
}

export interface OwnerPillEditorProps {
  value: string | null;
  options: OwnerOption[];
  onChange: (userId: string) => void;
  onClose: () => void;
}

export const OwnerPillEditor: React.FC<OwnerPillEditorProps> = ({
  value,
  options,
  onChange,
  onClose,
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const filtered = useMemo(
    () =>
      query ? options.filter((o) => o.name.toLowerCase().includes(query.toLowerCase())) : options,
    [options, query]
  );

  return (
    <div className="min-w-[200px] max-h-[240px] rounded-xl border border-c-border-subtle bg-c-surface shadow-lg overflow-hidden flex flex-col">
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-c-border-subtle">
        <Search size={12} className="text-c-text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('sharedComponents.ownerPillEditor.searchPlaceholder')}
          className="flex-1 bg-transparent text-xs text-c-text placeholder:text-c-text-muted focus:outline-none"
          autoFocus
        />
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <div className="px-3 py-2 text-xs text-c-text-muted italic">
            {t('sharedComponents.ownerPillEditor.noResults')}
          </div>
        ) : (
          filtered.map((opt) => (
            <button
              key={opt.id}
              onClick={() => {
                onChange(opt.id);
                onClose();
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs text-c-text hover:bg-c-surface-raised transition-colors"
            >
              {opt.avatar ? (
                <img src={opt.avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <span className="w-5 h-5 rounded-full bg-c-surface-raised flex items-center justify-center text-[9px] font-bold text-c-text-secondary">
                  {opt.name.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="flex-1 truncate">{opt.name}</span>
              {opt.id === value ? <Check size={12} className="text-c-text" /> : null}
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default OwnerPillEditor;
