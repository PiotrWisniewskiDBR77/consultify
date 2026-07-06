import { Circle } from 'lucide-react';
import * as React from 'react';

import { cn } from '../../lib/utils';

interface RadioGroupContextValue {
  value: string;
  onValueChange: (value: string) => void;
}

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(null);

interface RadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ className, value, defaultValue, onValueChange, ...props }, ref) => {
    const [internalValue, setInternalValue] = React.useState(defaultValue || '');
    const currentValue = value !== undefined ? value : internalValue;

    const handleValueChange = (newValue: string) => {
      if (value === undefined) {
        setInternalValue(newValue);
      }
      onValueChange?.(newValue);
    };

    return (
      <RadioGroupContext.Provider value={{ value: currentValue, onValueChange: handleValueChange }}>
        <div ref={ref} className={`grid gap-2 ${className || ''}`} role="radiogroup" {...props} />
      </RadioGroupContext.Provider>
    );
  }
);
RadioGroup.displayName = 'RadioGroup';

interface RadioGroupItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

const RadioGroupItem = React.forwardRef<HTMLButtonElement, RadioGroupItemProps>(
  ({ className, value, ...props }, ref) => {
    const context = React.useContext(RadioGroupContext);
    if (!context) throw new Error('RadioGroupItem must be used within RadioGroup');

    const isSelected = context.value === value;

    return (
      <button
        type="button"
        role="radio"
        aria-checked={isSelected}
        ref={ref}
        className={cn(
          'aspect-square h-4 w-4 rounded-full border transition-colors',
          'focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-c-surface',
          'disabled:cursor-not-allowed disabled:opacity-50',
          isSelected ? 'border-c-accent text-c-accent' : 'border-c-border-subtle text-c-text',
          className
        )}
        onClick={() => context.onValueChange(value)}
        {...props}
      >
        {isSelected && (
          <span className="flex items-center justify-center">
            <Circle className="h-2.5 w-2.5 fill-current text-current" />
          </span>
        )}
      </button>
    );
  }
);
RadioGroupItem.displayName = 'RadioGroupItem';

export { RadioGroup, RadioGroupItem };
