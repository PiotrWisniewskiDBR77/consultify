/**
 * Tabs Component - Simple tabs implementation
 *
 * A lightweight tabs component for Consultify
 */

import React, { createContext, useContext, useState } from 'react';

// Context for tabs state
interface TabsContextValue {
    value: string;
    onValueChange: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | undefined>(undefined);

function useTabsContext() {
    const context = useContext(TabsContext);
    if (!context) {
        throw new Error('Tabs components must be used within a Tabs provider');
    }
    return context;
}

// Tabs Root
interface TabsProps {
    value?: string;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
    className?: string;
    children: React.ReactNode;
}

export const Tabs: React.FC<TabsProps> = ({
    value: controlledValue,
    defaultValue = '',
    onValueChange,
    className = '',
    children,
}) => {
    const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);

    const isControlled = controlledValue !== undefined;
    const value = isControlled ? controlledValue : uncontrolledValue;

    const handleValueChange = (newValue: string) => {
        if (!isControlled) {
            setUncontrolledValue(newValue);
        }
        onValueChange?.(newValue);
    };

    return (
        <TabsContext.Provider value={{ value, onValueChange: handleValueChange }}>
            <div className={className}>{children}</div>
        </TabsContext.Provider>
    );
};

// Tabs List
interface TabsListProps {
    className?: string;
    children: React.ReactNode;
}

export const TabsList: React.FC<TabsListProps> = ({ className = '', children }) => {
    return (
        <div role="tablist" className={`flex gap-1 p-1 bg-slate-100 dark:bg-navy-800 rounded-lg ${className}`}>
            {children}
        </div>
    );
};

// Tabs Trigger (Tab Button)
interface TabsTriggerProps {
    value: string;
    className?: string;
    disabled?: boolean;
    children: React.ReactNode;
}

export const TabsTrigger: React.FC<TabsTriggerProps> = ({ value, className = '', disabled = false, children }) => {
    const { value: selectedValue, onValueChange } = useTabsContext();
    const isSelected = selectedValue === value;

    return (
        <button
            role="tab"
            type="button"
            aria-selected={isSelected}
            disabled={disabled}
            onClick={() => onValueChange(value)}
            className={`
        px-4 py-2 text-sm font-medium rounded-md transition-all duration-200
        ${
            isSelected
                ? 'bg-white dark:bg-navy-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-navy-700/50'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
        >
            {children}
        </button>
    );
};

// Tabs Content
interface TabsContentProps {
    value: string;
    className?: string;
    children: React.ReactNode;
}

export const TabsContent: React.FC<TabsContentProps> = ({ value, className = '', children }) => {
    const { value: selectedValue } = useTabsContext();

    if (selectedValue !== value) {
        return null;
    }

    return (
        <div role="tabpanel" className={`focus:outline-none ${className}`}>
            {children}
        </div>
    );
};

export default Tabs;



