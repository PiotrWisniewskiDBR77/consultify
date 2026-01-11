import React, { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  value?: string;
  onChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  disabled?: boolean;
}

const sizeStyles = {
  sm: 'py-1.5 pl-3 pr-8 text-xs rounded-lg',
  md: 'py-2.5 pl-4 pr-10 text-sm rounded-xl',
  lg: 'py-3.5 pl-5 pr-12 text-base rounded-xl',
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      options,
      placeholder,
      value,
      onChange,
      className = '',
      size = 'md',
      fullWidth = false,
      disabled = false,
    },
    ref
  ) => {
    return (
      <div className={`relative ${fullWidth ? 'w-full' : 'inline-block'}`}>
        <select
          ref={ref}
          value={value}
          onChange={(e) => onChange && onChange(e.target.value)}
          disabled={disabled}
          className={`
                        appearance-none
                        bg-white dark:bg-navy-900
                        border border-slate-200 dark:border-navy-700
                        text-navy-900 dark:text-white
                        focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500
                        disabled:opacity-50 disabled:cursor-not-allowed
                        transition-all duration-200
                        placeholder:text-slate-400 dark:text-slate-500
                        ${sizeStyles[size]}
                        ${fullWidth ? 'w-full' : ''}
                        ${className}
                    `
            .trim()
            .replace(/\s+/g, ' ')}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 dark:text-slate-400">
          <ChevronDown size={size === 'sm' ? 14 : 16} />
        </div>
      </div>
    );
  }
);

Select.displayName = 'Select';

// Compatibility exports for Radix UI-style API
// These are simplified aliases for our Select component
export const SelectTrigger: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <button
    className={`appearance-none bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 text-navy-900 dark:text-white py-2.5 pl-4 pr-10 text-sm rounded-xl ${className || ''}`}
  >
    {children}
  </button>
);

export const SelectValue: React.FC<{ placeholder?: string }> = ({ placeholder }) => (
  <span className="text-slate-400 dark:text-slate-500">{placeholder}</span>
);

export const SelectContent: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <div
    className={`absolute z-50 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl shadow-lg ${className || ''}`}
  >
    {children}
  </div>
);

export const SelectItem: React.FC<{ value: string; children: React.ReactNode }> = ({
  value,
  children,
}) => (
  <div
    data-value={value}
    className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
  >
    {children}
  </div>
);
