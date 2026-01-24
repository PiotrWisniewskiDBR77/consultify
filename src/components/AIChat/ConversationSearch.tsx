import { Search, X } from 'lucide-react';
import React from 'react';

interface ConversationSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const ConversationSearch: React.FC<ConversationSearchProps> = ({
  value,
  onChange,
  placeholder,
}) => {
  return (
    <div className="relative group">
      <Search
        size={16}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-primary-500 transition-colors"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-xl py-2 pl-9 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};

export default ConversationSearch;
