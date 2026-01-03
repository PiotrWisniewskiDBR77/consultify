/**
 * ConversationSearch
 * 
 * Search input for filtering conversations.
 */

import React from 'react';
import { Search, X } from 'lucide-react';

interface ConversationSearchProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

export const ConversationSearch: React.FC<ConversationSearchProps> = ({
    value,
    onChange,
    placeholder = 'Search...'
}) => {
    return (
        <div className="relative">
            <Search 
                size={16} 
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" 
            />
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="
                    w-full pl-9 pr-8 py-2 text-sm
                    bg-white dark:bg-navy-800
                    border border-slate-200 dark:border-navy-700
                    rounded-lg
                    text-navy-900 dark:text-white
                    placeholder-slate-400 dark:placeholder-slate-500
                    focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500
                    transition-all
                "
            />
            {value && (
                <button
                    onClick={() => onChange('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded transition-colors"
                >
                    <X size={14} />
                </button>
            )}
        </div>
    );
};

export default ConversationSearch;






