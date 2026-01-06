import { Check } from 'lucide-react';
import * as React from 'react';

interface CheckboxProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
    ({ className, checked = false, onCheckedChange, ...props }, ref) => {
        return (
            <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                ref={ref}
                className={`peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                    checked ? 'bg-primary text-primary-foreground' : 'bg-background'
                } ${className || ''}`}
                onClick={() => onCheckedChange?.(!checked)}
                {...props}
            >
                {checked && <Check className="h-4 w-4" />}
            </button>
        );
    },
);
Checkbox.displayName = 'Checkbox';

export { Checkbox };

