import { ChevronDown } from 'lucide-react';
import * as React from 'react';

import { cn } from '../../lib/utils';

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  value?: string;
  onChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  id?: string;
  name?: string;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      value,
      onChange,
      options,
      placeholder = 'Select...',
      disabled = false,
      fullWidth = false,
      size = 'md',
      className,
      id,
      name,
    },
    ref
  ) => {
    const sizeClasses = {
      sm: 'h-8 text-xs px-2 py-1',
      md: 'h-10 text-sm px-3 py-2',
      lg: 'h-12 text-base px-4 py-3',
    } as const;

    return (
      <div className={cn('relative', fullWidth && 'w-full')}>
        <select
          ref={ref}
          id={id}
          name={name}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          className={cn(
            'flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white',
            'ring-offset-background placeholder:text-slate-500',
            'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'dark:border-navy-600 dark:bg-navy-800 dark:text-white dark:placeholder:text-slate-400',
            'dark:focus:ring-primary/30 dark:focus:border-primary',
            'appearance-none cursor-pointer',
            sizeClasses[size],
            fullWidth && 'w-full',
            className
          )}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600 pointer-events-none" />
      </div>
    );
  }
);

Select.displayName = 'Select';

// SelectTrigger, SelectContent, SelectItem - compatibility exports for shadcn patterns
interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
}

const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ className, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'flex h-10 w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm',
        'ring-offset-background placeholder:text-slate-500',
        'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'dark:border-navy-600 dark:bg-navy-800 dark:text-white',
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 opacity-50" />
    </button>
  )
);

SelectTrigger.displayName = 'SelectTrigger';

const SelectValue = ({ placeholder }: { placeholder?: string }) => (
  <span className="text-slate-500 dark:text-slate-400">{placeholder}</span>
);

const SelectContent = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      'relative z-dropdown min-w-[8rem] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-md',
      'dark:border-navy-600 dark:bg-navy-800',
      className
    )}
  >
    {children}
  </div>
);

interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  children: React.ReactNode;
}

const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 px-3 text-sm outline-none',
        'hover:bg-slate-100 focus:bg-slate-100',
        'dark:hover:bg-navy-700 dark:focus:bg-navy-700',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);

SelectItem.displayName = 'SelectItem';

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
