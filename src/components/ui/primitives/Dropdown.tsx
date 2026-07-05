/**
 * Dropdown Component - Apple HIG Design System
 *
 * A versatile dropdown menu component for selects and action menus.
 * Supports keyboard navigation and search.
 *
 * @example
 * <Dropdown>
 *   <DropdownTrigger asChild>
 *     <Button>Open Menu</Button>
 *   </DropdownTrigger>
 *   <DropdownContent>
 *     <DropdownItem>Option 1</DropdownItem>
 *     <DropdownItem>Option 2</DropdownItem>
 *   </DropdownContent>
 * </Dropdown>
 */

import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Context
interface DropdownContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLElement>;
  selectedValue?: string;
  onSelect?: (value: string) => void;
}

const DropdownContext = createContext<DropdownContextValue | null>(null);

const useDropdownContext = () => {
  const context = useContext(DropdownContext);
  if (!context) {
    throw new Error('Dropdown components must be used within a Dropdown provider');
  }
  return context;
};

// Root component
export interface DropdownProps {
  /** Controlled open state */
  open?: boolean;
  /** Default open state */
  defaultOpen?: boolean;
  /** On open change callback */
  onOpenChange?: (open: boolean) => void;
  /** Selected value (for select mode) */
  value?: string;
  /** On value change (for select mode) */
  onValueChange?: (value: string) => void;
  /** Children */
  children: React.ReactNode;
}

export const Dropdown: React.FC<DropdownProps> = ({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  value,
  onValueChange,
  children,
}) => {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const triggerRef = useRef<HTMLElement>(null);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const setOpen = (newOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(newOpen);
    }
    onOpenChange?.(newOpen);
  };

  const handleSelect = (itemValue: string) => {
    onValueChange?.(itemValue);
    setOpen(false);
  };

  return (
    <DropdownContext.Provider
      value={{
        open,
        setOpen,
        triggerRef: triggerRef as any,
        selectedValue: value,
        onSelect: onValueChange ? handleSelect : undefined,
      }}
    >
      {children}
    </DropdownContext.Provider>
  );
};

// Trigger
export interface DropdownTriggerProps {
  /** Render as child element */
  asChild?: boolean;
  /** Children */
  children: React.ReactNode;
}

export const DropdownTrigger: React.FC<DropdownTriggerProps> = ({ asChild, children }) => {
  const { open, setOpen, triggerRef } = useDropdownContext();

  const handleClick = () => setOpen(!open);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(!open);
    }
    if (e.key === 'ArrowDown' && !open) {
      e.preventDefault();
      setOpen(true);
    }
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(
      children as React.ReactElement<{
        ref: typeof triggerRef;
        onClick: typeof handleClick;
        onKeyDown: typeof handleKeyDown;
        'aria-expanded': boolean;
        'aria-haspopup': 'menu';
      }>,
      {
        ref: triggerRef as React.RefObject<HTMLButtonElement>,
        onClick: handleClick,
        onKeyDown: handleKeyDown,
        'aria-expanded': open,
        'aria-haspopup': 'menu',
      }
    );
  }

  return (
    <button
      ref={triggerRef as React.RefObject<HTMLButtonElement>}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-expanded={open}
      aria-haspopup="menu"
      className="inline-flex items-center gap-2"
    >
      {children}
    </button>
  );
};

// Content
export interface DropdownContentProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Alignment relative to trigger */
  align?: 'start' | 'center' | 'end';
  /** Side relative to trigger */
  side?: 'top' | 'bottom';
  /** Width behavior */
  width?: 'auto' | 'trigger' | number;
  /** Max height */
  maxHeight?: number;
}

const contentVariants = {
  hidden: { opacity: 0, scale: 0.95, y: -4 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 500, damping: 30 },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -4,
    transition: { duration: 0.1 },
  },
};

export const DropdownContent: React.FC<DropdownContentProps> = ({
  align = 'start',
  side = 'bottom',
  width = 'auto',
  maxHeight = 300,
  children,
  className = '',
  ...props
}) => {
  const { open, setOpen, triggerRef } = useDropdownContext();
  const contentRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });

  // Calculate position
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;

    const trigger = triggerRef.current;
    const rect = trigger.getBoundingClientRect();
    const offset = 8;

    const top = side === 'bottom' ? rect.bottom + offset : rect.top - offset;
    let left = rect.left;

    if (align === 'center') {
      left = rect.left + rect.width / 2;
    } else if (align === 'end') {
      left = rect.right;
    }

    setPosition({
      top,
      left,
      width: width === 'trigger' ? rect.width : 0,
    });
  }, [align, side, width, triggerRef]);

  useEffect(() => {
    if (open) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
    return undefined;
  }, [open, updatePosition]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        contentRef.current &&
        !contentRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, setOpen, triggerRef]);

  if (typeof window === 'undefined') return null;

  const alignTransform = {
    start: 'translateX(0)',
    center: 'translateX(-50%)',
    end: 'translateX(-100%)',
  }[align];

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={contentRef}
          role="menu"
          className={`
            fixed z-dropdown
            min-w-[180px]
            py-1
            bg-white dark:bg-navy-900
            rounded-xl
            shadow-[0_10px_40px_rgba(0,0,0,0.12)]
            dark:shadow-[0_10px_40px_rgba(0,0,0,0.4)]
            border border-slate-200/50 dark:border-navy-700
            overflow-hidden
            ${className}
          `}
          style={{
            top: position.top,
            left: position.left,
            transform: alignTransform,
            width: typeof width === 'number' ? width : position.width || 'auto',
            maxHeight,
            overflowY: 'auto',
          }}
          variants={contentVariants as any}
          initial="hidden"
          animate="visible"
          exit="exit"
          {...(props as any)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

// Item
export interface DropdownItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Value for select mode */
  value?: string;
  /** Icon */
  icon?: React.ReactNode;
  /** Destructive style */
  destructive?: boolean;
}

export const DropdownItem = React.forwardRef<HTMLButtonElement, DropdownItemProps>(
  ({ value, icon, destructive, children, className = '', ...props }, ref) => {
    const { selectedValue, onSelect, setOpen } = useDropdownContext();
    const isSelected = value !== undefined && value === selectedValue;

    const handleClick = () => {
      if (value && onSelect) {
        onSelect(value);
      } else {
        setOpen(false);
      }
    };

    return (
      <button
        ref={ref}
        role="menuitem"
        onClick={handleClick}
        className={`
          w-full flex items-center gap-3 px-3 py-2
          text-sm text-left
          transition-colors duration-100
          outline-none
          ${
            destructive
              ? 'text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20'
              : isSelected
                ? 'text-[var(--c-info)] dark:text-[var(--c-info)] bg-slate-100 dark:bg-white/[0.08]'
                : 'text-navy-900 dark:text-white hover:bg-slate-100 dark:hover:bg-white/5'
          }
          ${className}
        `}
        {...props}
      >
        {icon && (
          <span className="flex-shrink-0 w-4 h-4">
            {React.isValidElement(icon)
              ? React.cloneElement(icon as React.ReactElement<{ size?: number }>, { size: 16 })
              : icon}
          </span>
        )}
        <span className="flex-1">{children}</span>
        {isSelected && <Check size={16} className="flex-shrink-0" />}
      </button>
    );
  }
);

DropdownItem.displayName = 'DropdownItem';

// Separator
export const DropdownSeparator: React.FC = () => (
  <div className="my-1 h-px bg-slate-200 dark:bg-white/10" />
);

// Label
export interface DropdownLabelProps {
  children: React.ReactNode;
}

export const DropdownLabel: React.FC<DropdownLabelProps> = ({ children }) => (
  <div className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
    {children}
  </div>
);

// Select component (convenience wrapper)
export interface SelectProps {
  /** Current value */
  value?: string;
  /** On value change */
  onValueChange?: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Options */
  options: { value: string; label: string; icon?: React.ReactNode }[];
  /** Disabled state */
  disabled?: boolean;
  /** Full width */
  fullWidth?: boolean;
}

export const Select: React.FC<SelectProps> = ({
  value,
  onValueChange,
  placeholder = 'Select...',
  options,
  disabled,
  fullWidth,
}) => {
  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <Dropdown value={value} onValueChange={onValueChange}>
      <DropdownTrigger asChild>
        <button
          disabled={disabled}
          className={`
            flex items-center justify-between gap-2
            px-4 py-2.5
            bg-slate-50 dark:bg-navy-900
            text-sm
            rounded-xl
            border border-transparent
            hover:bg-slate-100 dark:hover:bg-navy-800
            focus:border-c-focus-solid focus:ring-2 focus:ring-c-focus
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-150
            ${fullWidth ? 'w-full' : ''}
          `}
        >
          <span className={selectedOption ? 'text-navy-900 dark:text-white' : 'text-slate-600'}>
            {selectedOption?.label || placeholder}
          </span>
          <ChevronDown size={16} className="text-slate-600 dark:text-slate-500" />
        </button>
      </DropdownTrigger>
      <DropdownContent width="trigger">
        {options.map((option) => (
          <DropdownItem key={option.value} value={option.value} icon={option.icon}>
            {option.label}
          </DropdownItem>
        ))}
      </DropdownContent>
    </Dropdown>
  );
};

export default Dropdown;
