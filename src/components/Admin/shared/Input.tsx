/**
 * Admin Input Components
 *
 * Minimalist form inputs for Admin module
 * Components: TextInput, Select, Toggle, Checkbox
 *
 * Key principles:
 * - Subtle borders
 * - Clean focus states
 * - Consistent sizing
 */

import React, { forwardRef, useId } from 'react';

// Base input styles
const baseInputClass = `
    w-full px-3.5 py-2.5
    bg-slate-800/50 border border-white/[0.06] rounded-lg
    text-slate-200 text-sm
    placeholder:text-slate-500 dark:text-slate-400
    focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20
    transition-colors
    disabled:opacity-50 disabled:cursor-not-allowed
`
  .trim()
  .replace(/\s+/g, ' ');

// Text Input
interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`${baseInputClass} ${error ? 'border-danger-500/50' : ''} ${className}`}
          {...props}
        />
        {error && <p className="text-xs text-danger-400">{error}</p>}
        {hint && !error && <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      </div>
    );
  }
);

TextInput.displayName = 'TextInput';

// Textarea
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={`${baseInputClass} min-h-[100px] resize-y ${error ? 'border-danger-500/50' : ''} ${className}`}
          {...props}
        />
        {error && <p className="text-xs text-danger-400">{error}</p>}
        {hint && !error && <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

// Select
interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label?: string;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, placeholder, error, className = '', id, ...props }, ref) => {
    const generatedId = useId();
    const selectId = id || generatedId;

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`
                    ${baseInputClass}
                    appearance-none cursor-pointer pr-10
                    bg-[url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2394A3B8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")]
                    bg-[length:16px] bg-[right_12px_center] bg-no-repeat
                    ${error ? 'border-danger-500/50' : ''}
                    ${className}
                `.trim()}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-danger-400">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';

// Toggle Switch
interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  size = 'md',
}) => {
  const trackSize = size === 'sm' ? 'w-8 h-4' : 'w-9 h-5';
  const thumbSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  const thumbTranslate = size === 'sm' ? 'translate-x-4' : 'translate-x-4';

  return (
    <label
      className={`flex items-start gap-3 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <div className="relative flex-shrink-0 mt-0.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only peer"
        />
        <div
          className={`
                    ${trackSize} rounded-full transition-colors
                    bg-slate-700 peer-checked:bg-blue-600
                    peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500/50 peer-focus-visible:ring-offset-2
                    peer-focus-visible:ring-offset-slate-900
                `}
        />
        <div
          className={`
                    absolute top-0.5 left-0.5 ${thumbSize} rounded-full bg-white dark:bg-navy-900
                    transition-transform peer-checked:${thumbTranslate}
                `}
        />
      </div>
      {(label || description) && (
        <div className="flex-1">
          {label && <span className="block text-sm text-c-text-secondary">{label}</span>}
          {description && (
            <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {description}
            </span>
          )}
        </div>
      )}
    </label>
  );
};

// Checkbox
interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}) => {
  return (
    <label
      className={`flex items-start gap-3 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <div className="relative flex-shrink-0 mt-0.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only peer"
        />
        <div
          className={`
                    w-4 h-4 rounded border transition-colors
                    border-white/20 bg-slate-800/50
                    peer-checked:bg-blue-600 peer-checked:border-blue-600
                    peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500/50
                `}
        >
          <svg
            className={`w-4 h-4 text-white transition-opacity ${checked ? 'opacity-100' : 'opacity-0'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>
      {(label || description) && (
        <div className="flex-1">
          {label && <span className="block text-sm text-c-text-secondary">{label}</span>}
          {description && (
            <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {description}
            </span>
          )}
        </div>
      )}
    </label>
  );
};

// Form group wrapper
interface FormGroupProps {
  children: React.ReactNode;
  className?: string;
}

export const FormGroup: React.FC<FormGroupProps> = ({ children, className = '' }) => (
  <div className={`space-y-4 ${className}`}>{children}</div>
);

// Form row for horizontal layout
export const FormRow: React.FC<FormGroupProps> = ({ children, className = '' }) => (
  <div className={`grid grid-cols-2 gap-4 ${className}`}>{children}</div>
);

export default TextInput;
