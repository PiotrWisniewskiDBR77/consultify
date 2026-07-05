/**
 * Tooltip Component - Apple HIG Design System
 *
 * A floating tooltip with smooth animations using Floating UI.
 * Supports multiple placements and delay configurations.
 *
 * @example
 * <Tooltip content="Help text">
 *   <Button>Hover me</Button>
 * </Tooltip>
 */

import { AnimatePresence, motion, type Variants } from 'framer-motion';
import React, { cloneElement, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type TooltipPlacement =
  | 'top'
  | 'top-start'
  | 'top-end'
  | 'bottom'
  | 'bottom-start'
  | 'bottom-end'
  | 'left'
  | 'left-start'
  | 'left-end'
  | 'right'
  | 'right-start'
  | 'right-end';

export interface TooltipProps {
  /** Tooltip content */
  content: React.ReactNode;
  /** Placement relative to trigger */
  placement?: TooltipPlacement;
  /** Delay before showing (ms) */
  delay?: number;
  /** Delay before hiding (ms) */
  hideDelay?: number;
  /** Disabled state */
  disabled?: boolean;
  /** Always show (controlled) */
  open?: boolean;
  /** Arrow visibility */
  arrow?: boolean;
  /** Max width of tooltip */
  maxWidth?: number;
  /** Trigger element */
  children: React.ReactElement;
}

const placementMap: Record<TooltipPlacement, { x: string; y: string; origin: string }> = {
  top: { x: '-50%', y: '-100%', origin: 'bottom center' },
  'top-start': { x: '0%', y: '-100%', origin: 'bottom left' },
  'top-end': { x: '-100%', y: '-100%', origin: 'bottom right' },
  bottom: { x: '-50%', y: '0%', origin: 'top center' },
  'bottom-start': { x: '0%', y: '0%', origin: 'top left' },
  'bottom-end': { x: '-100%', y: '0%', origin: 'top right' },
  left: { x: '-100%', y: '-50%', origin: 'right center' },
  'left-start': { x: '-100%', y: '0%', origin: 'right top' },
  'left-end': { x: '-100%', y: '-100%', origin: 'right bottom' },
  right: { x: '0%', y: '-50%', origin: 'left center' },
  'right-start': { x: '0%', y: '0%', origin: 'left top' },
  'right-end': { x: '0%', y: '-100%', origin: 'left bottom' },
};

const tooltipVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 30,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.1 },
  },
};

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  placement = 'top',
  delay = 200,
  hideDelay = 0,
  disabled = false,
  open: controlledOpen,
  arrow = true,
  maxWidth = 250,
  children,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const showTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const isControlled = controlledOpen !== undefined;
  const showTooltip = isControlled ? controlledOpen : isOpen;

  // Calculate position
  const updatePosition = () => {
    if (!triggerRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const offset = 8;

    let top = 0;
    let left = 0;

    const basePosition = placement.split('-')[0];

    switch (basePosition) {
      case 'top':
        top = triggerRect.top - offset;
        left = triggerRect.left + triggerRect.width / 2;
        if (placement === 'top-start') left = triggerRect.left;
        if (placement === 'top-end') left = triggerRect.right;
        break;
      case 'bottom':
        top = triggerRect.bottom + offset;
        left = triggerRect.left + triggerRect.width / 2;
        if (placement === 'bottom-start') left = triggerRect.left;
        if (placement === 'bottom-end') left = triggerRect.right;
        break;
      case 'left':
        left = triggerRect.left - offset;
        top = triggerRect.top + triggerRect.height / 2;
        if (placement === 'left-start') top = triggerRect.top;
        if (placement === 'left-end') top = triggerRect.bottom;
        break;
      case 'right':
        left = triggerRect.right + offset;
        top = triggerRect.top + triggerRect.height / 2;
        if (placement === 'right-start') top = triggerRect.top;
        if (placement === 'right-end') top = triggerRect.bottom;
        break;
    }

    setPosition({ top, left });
  };

  const handleShow = () => {
    if (disabled || isControlled) return;

    clearTimeout(hideTimeoutRef.current);
    showTimeoutRef.current = setTimeout(() => {
      updatePosition();
      setIsOpen(true);
    }, delay);
  };

  const handleHide = () => {
    if (isControlled) return;

    clearTimeout(showTimeoutRef.current);
    hideTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, hideDelay);
  };

  useEffect(() => {
    return () => {
      clearTimeout(showTimeoutRef.current);
      clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  // Update position when open changes
  useEffect(() => {
    if (showTooltip) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
    return undefined;
  }, [showTooltip]);

  if (!content) return children;

  const { x, y, origin } = placementMap[placement];

  const child = children as React.ReactElement;
  const childHandlers = child.props as {
    onMouseEnter?: React.MouseEventHandler;
    onMouseLeave?: React.MouseEventHandler;
    onFocus?: React.FocusEventHandler;
    onBlur?: React.FocusEventHandler;
  };

  // Clone child with ref and handlers
  const trigger = cloneElement(child as any, {
    ref: triggerRef,
    onMouseEnter: (e: React.MouseEvent) => {
      handleShow();
      childHandlers.onMouseEnter?.(e);
    },
    onMouseLeave: (e: React.MouseEvent) => {
      handleHide();
      childHandlers.onMouseLeave?.(e);
    },
    onFocus: (e: React.FocusEvent) => {
      handleShow();
      childHandlers.onFocus?.(e);
    },
    onBlur: (e: React.FocusEvent) => {
      handleHide();
      childHandlers.onBlur?.(e);
    },
  });

  return (
    <>
      {trigger}
      {typeof window !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {showTooltip && (
              <motion.div
                ref={tooltipRef}
                role="tooltip"
                className="fixed z-dropdown pointer-events-none"
                style={{
                  top: position.top,
                  left: position.left,
                }}
                initial="hidden"
                animate="visible"
                exit="exit"
                variants={tooltipVariants}
              >
                <div
                  className={`
                    px-3 py-2
                    bg-white dark:bg-navy-900
                    text-slate-900 dark:text-white
                    text-sm
                    rounded-lg
                    shadow-lg
                  `}
                  style={{
                    maxWidth,
                    transform: `translate(${x}, ${y})`,
                    transformOrigin: origin,
                  }}
                >
                  {content}
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
};

export default Tooltip;
