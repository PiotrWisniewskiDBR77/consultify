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
        size={14}
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-500 group-focus-within:text-c-focus transition-colors"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-slate-100/60 dark:bg-navy-950/60 border border-slate-200/50 dark:border-navy-700/50 rounded-lg py-1.5 pl-8 pr-7 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:border-c-focus transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-600 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
};

export default ConversationSearch;
