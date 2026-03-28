import { Check } from 'lucide-react';
import React from 'react';

export interface PriorityOption {
  value: string;
  label: string;
  color?: string;
}

export interface PriorityPillEditorProps {
  value: string;
  options: PriorityOption[];
  onChange: (value: string) => void;
  onClose: () => void;
}

export const PriorityPillEditor: React.FC<PriorityPillEditorProps> = ({
  value,
  options,
  onChange,
  onClose,
}) => (
  <div className="min-w-[140px] rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white dark:bg-navy-900 shadow-lg py-1 overflow-hidden">
    {options.map((opt) => (
      <button
        key={opt.value}
        onClick={() => {
          onChange(opt.value);
          onClose();
        }}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors"
      >
        {opt.color ? <span className={`w-2 h-2 rounded-sm ${opt.color}`} /> : null}
        <span className="flex-1">{opt.label}</span>
        {opt.value === value ? <Check size={12} className="text-primary-500" /> : null}
      </button>
    ))}
  </div>
);

export default PriorityPillEditor;
