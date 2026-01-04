import * as React from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface SelectContextValue {
    value: string;
    onValueChange: (value: string) => void;
    open: boolean;
    setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const SelectContext = React.createContext<SelectContextValue | null>(null);

interface SelectProps {
    value?: string;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
    children: React.ReactNode;
}

const Select: React.FC<SelectProps> = ({ value, defaultValue, onValueChange, children }) => {
    const [open, setOpen] = React.useState(false);
    const [internalValue, setInternalValue] = React.useState(defaultValue || '');

    const currentValue = value !== undefined ? value : internalValue;
    const handleValueChange = (newValue: string) => {
        if (value === undefined) {
            setInternalValue(newValue);
        }
        onValueChange?.(newValue);
        setOpen(false);
    };

    return (
        <SelectContext.Provider value={{ value: currentValue, onValueChange: handleValueChange, open, setOpen }}>
            <div className="relative">{children}</div>
        </SelectContext.Provider>
    );
};

const SelectTrigger = React.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => {
    const context = React.useContext(SelectContext);
    if (!context) throw new Error('SelectTrigger must be used within Select');

    return (
        <button
            type="button"
            ref={ref}
            className={`flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className || ''}`}
            onClick={() => context.setOpen(!context.open)}
            {...props}
        >
            {children}
            <ChevronDown className="h-4 w-4 opacity-50" />
        </button>
    );
});
SelectTrigger.displayName = 'SelectTrigger';

const SelectValue: React.FC<{ placeholder?: string }> = ({ placeholder }) => {
    const context = React.useContext(SelectContext);
    if (!context) throw new Error('SelectValue must be used within Select');

    return <span>{context.value || placeholder}</span>;
};

const SelectContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, children, ...props }, ref) => {
        const context = React.useContext(SelectContext);
        if (!context) throw new Error('SelectContent must be used within Select');

        if (!context.open) return null;

        return (
            <>
                <div className="fixed inset-0 z-50" onClick={() => context.setOpen(false)} />
                <div
                    ref={ref}
                    className={`absolute z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 top-full left-0 mt-1 w-full ${className || ''}`}
                    {...props}
                >
                    <div className="p-1">{children}</div>
                </div>
            </>
        );
    }
);
SelectContent.displayName = 'SelectContent';

interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
    value: string;
}

const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(
    ({ className, children, value, ...props }, ref) => {
        const context = React.useContext(SelectContext);
        if (!context) throw new Error('SelectItem must be used within Select');

        const isSelected = context.value === value;

        return (
            <div
                ref={ref}
                className={`relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 ${className || ''}`}
                onClick={() => context.onValueChange(value)}
                {...props}
            >
                <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    {isSelected && <Check className="h-4 w-4" />}
                </span>
                {children}
            </div>
        );
    }
);
SelectItem.displayName = 'SelectItem';

const SelectGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={className} {...props} />
    )
);
SelectGroup.displayName = 'SelectGroup';

const SelectLabel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={`py-1.5 pl-8 pr-2 text-sm font-semibold ${className || ''}`} {...props} />
    )
);
SelectLabel.displayName = 'SelectLabel';

const SelectSeparator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={`-mx-1 my-1 h-px bg-muted ${className || ''}`} {...props} />
    )
);
SelectSeparator.displayName = 'SelectSeparator';

export {
    Select,
    SelectGroup,
    SelectValue,
    SelectTrigger,
    SelectContent,
    SelectLabel,
    SelectItem,
    SelectSeparator,
};
