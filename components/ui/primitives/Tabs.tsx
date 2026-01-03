/**
 * Tabs Component - Apple HIG Design System
 * 
 * A tabbed navigation component with smooth indicator animation.
 * Supports pills and underline variants.
 * 
 * @example
 * <Tabs value={activeTab} onValueChange={setActiveTab}>
 *   <TabsList>
 *     <TabsTrigger value="tab1">Tab 1</TabsTrigger>
 *     <TabsTrigger value="tab2">Tab 2</TabsTrigger>
 *   </TabsList>
 *   <TabsContent value="tab1">Content 1</TabsContent>
 *   <TabsContent value="tab2">Content 2</TabsContent>
 * </Tabs>
 */

import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

// Context
interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
  variant: 'pills' | 'underline';
}

const TabsContext = createContext<TabsContextValue | null>(null);

const useTabsContext = () => {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs components must be used within a Tabs provider');
  }
  return context;
};

// Root component
export interface TabsProps {
  /** Controlled value */
  value?: string;
  /** Default value for uncontrolled */
  defaultValue?: string;
  /** On value change callback */
  onValueChange?: (value: string) => void;
  /** Visual variant */
  variant?: 'pills' | 'underline';
  /** Children */
  children: React.ReactNode;
  /** Additional className */
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  value: controlledValue,
  defaultValue,
  onValueChange,
  variant = 'pills',
  children,
  className = '',
}) => {
  const [internalValue, setInternalValue] = useState(defaultValue || '');

  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;

  const handleValueChange = (newValue: string) => {
    if (!isControlled) {
      setInternalValue(newValue);
    }
    onValueChange?.(newValue);
  };

  return (
    <TabsContext.Provider value={{ value, onValueChange: handleValueChange, variant }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
};

// Tabs List
export interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(
  ({ children, className = '', ...props }, ref) => {
    const { variant } = useTabsContext();
    const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
    const listRef = useRef<HTMLDivElement>(null);

    const isPills = variant === 'pills';

    return (
      <div
        ref={ref}
        role="tablist"
        className={`
          relative flex
          ${isPills
            ? 'gap-1 p-1 bg-slate-100 dark:bg-navy-900 rounded-xl'
            : 'gap-0 border-b border-slate-200 dark:border-white/10'
          }
          ${className}
        `}
        {...props}
      >
        {/* Animated indicator for pills variant */}
        {isPills && indicatorStyle.width > 0 && (
          <motion.div
            layoutId="activeTab"
            className="absolute inset-0 bg-white dark:bg-navy-800 rounded-lg shadow-sm"
            initial={false}
            animate={{
              left: indicatorStyle.left,
              width: indicatorStyle.width,
            }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 } as any}
          />
        )}
        <div ref={listRef} className="relative flex gap-1 w-full">
          {React.Children.map(children, (child) => {
            if (React.isValidElement(child)) {
              return React.cloneElement(child as React.ReactElement<{ setIndicatorStyle?: typeof setIndicatorStyle }>, {
                setIndicatorStyle,
              });
            }
            return child;
          })}
        </div>
      </div>
    );
  }
);

TabsList.displayName = 'TabsList';

// Tabs Trigger
export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Tab value (required) */
  value: string;
  /** Disabled state */
  disabled?: boolean;
  /** Icon */
  icon?: React.ReactNode;
  /** Internal - set by TabsList */
  setIndicatorStyle?: (style: { left: number; width: number }) => void;
}

export const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ value: tabValue, disabled, icon, children, setIndicatorStyle, className = '', ...props }, ref) => {
    const { value, onValueChange, variant } = useTabsContext();
    const buttonRef = useRef<HTMLButtonElement>(null);
    const isActive = value === tabValue;
    const isPills = variant === 'pills';

    // Update indicator position when active
    useEffect(() => {
      if (isActive && isPills && buttonRef.current && setIndicatorStyle) {
        const button = buttonRef.current;
        setIndicatorStyle({
          left: button.offsetLeft,
          width: button.offsetWidth,
        });
      }
    }, [isActive, isPills, setIndicatorStyle]);

    return (
      <button
        ref={(node) => {
          buttonRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        role="tab"
        aria-selected={isActive}
        aria-controls={`tabpanel-${tabValue}`}
        tabIndex={isActive ? 0 : -1}
        disabled={disabled}
        onClick={() => onValueChange(tabValue)}
        className={`
          relative z-10 flex items-center justify-center gap-2
          font-medium transition-colors duration-150
          disabled:opacity-50 disabled:cursor-not-allowed
          ${isPills
            ? `
              px-4 py-2 text-sm rounded-lg
              ${isActive
              ? 'text-navy-900 dark:text-white'
              : 'text-slate-600 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white'
            }
            `
            : `
              px-4 py-3 text-sm border-b-2 -mb-px
              ${isActive
              ? 'text-primary-600 dark:text-primary-400 border-primary-500'
              : 'text-slate-600 dark:text-slate-400 border-transparent hover:text-navy-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600'
            }
            `
          }
          ${className}
        `}
        {...props}
      >
        {icon && (
          <span className="flex-shrink-0">
            {React.isValidElement(icon)
              ? React.cloneElement(icon as React.ReactElement<{ size?: number }>, { size: 16 })
              : icon}
          </span>
        )}
        {children}
      </button>
    );
  }
);

TabsTrigger.displayName = 'TabsTrigger';

// Tabs Content
export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Tab value (required) */
  value: string;
}

export const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ value: tabValue, children, className = '', ...props }, ref) => {
    const { value } = useTabsContext();
    const isActive = value === tabValue;

    if (!isActive) return null;

    return (
      <motion.div
        ref={ref}
        role="tabpanel"
        id={`tabpanel-${tabValue}`}
        aria-labelledby={`tab-${tabValue}`}
        tabIndex={0}
        className={`mt-4 outline-none ${className}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        {...(props as any)}
      >
        {children}
      </motion.div>
    );
  }
);

TabsContent.displayName = 'TabsContent';

export default Tabs;





