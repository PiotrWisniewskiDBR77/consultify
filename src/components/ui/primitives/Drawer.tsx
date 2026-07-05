/**
 * Drawer Component - Apple HIG Design System
 *
 * A side panel / bottom sheet component for secondary content.
 * Supports multiple positions and sizes.
 *
 * @example
 * <Drawer open={isOpen} onClose={() => setIsOpen(false)} position="right">
 *   <DrawerHeader title="Settings" />
 *   <DrawerContent>Content here</DrawerContent>
 * </Drawer>
 */

import { AnimatePresence, motion, PanInfo } from 'framer-motion';
import { X } from 'lucide-react';
import React, { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { Button } from './Button';

export type DrawerPosition = 'left' | 'right' | 'bottom' | 'top';
export type DrawerSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface DrawerProps {
  /** Whether the drawer is open */
  open: boolean;
  /** Callback when drawer should close */
  onClose: () => void;
  /** Position of the drawer */
  position?: DrawerPosition;
  /** Size of the drawer */
  size?: DrawerSize;
  /** Show close button */
  showCloseButton?: boolean;
  /** Allow closing by dragging */
  enableDrag?: boolean;
  /** Show overlay backdrop */
  showOverlay?: boolean;
  /** Prevent closing on overlay click */
  preventOverlayClose?: boolean;
  /** Additional className */
  className?: string;
  /** Drawer content */
  children?: React.ReactNode;
}

const sizeStyles: Record<DrawerPosition, Record<DrawerSize, string>> = {
  left: {
    sm: 'w-64',
    md: 'w-80',
    lg: 'w-96',
    xl: 'w-[480px]',
    full: 'w-screen',
  },
  right: {
    sm: 'w-64',
    md: 'w-80',
    lg: 'w-96',
    xl: 'w-[480px]',
    full: 'w-screen',
  },
  top: {
    sm: 'h-32',
    md: 'h-64',
    lg: 'h-96',
    xl: 'h-[480px]',
    full: 'h-screen',
  },
  bottom: {
    sm: 'h-32',
    md: 'h-64',
    lg: 'h-96',
    xl: 'h-[480px]',
    full: 'h-screen',
  },
};

const positionStyles: Record<DrawerPosition, string> = {
  left: 'top-0 left-0 h-full',
  right: 'top-0 right-0 h-full',
  top: 'top-0 left-0 w-full',
  bottom: 'bottom-0 left-0 w-full',
};

const slideVariants: Record<DrawerPosition, { hidden: object; visible: object }> = {
  left: {
    hidden: { x: '-100%' },
    visible: { x: 0 },
  },
  right: {
    hidden: { x: '100%' },
    visible: { x: 0 },
  },
  top: {
    hidden: { y: '-100%' },
    visible: { y: 0 },
  },
  bottom: {
    hidden: { y: '100%' },
    visible: { y: 0 },
  },
};

export const Drawer: React.FC<DrawerProps> = ({
  open,
  onClose,
  position = 'right',
  size = 'md',
  showCloseButton = true,
  enableDrag = true,
  showOverlay = true,
  preventOverlayClose = false,
  className = '',
  children,
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Handle escape key
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  // Focus management
  useEffect(() => {
    if (open) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';

      setTimeout(() => {
        drawerRef.current?.focus();
      }, 0);

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';
        previousActiveElement.current?.focus();
      };
    }
    return undefined;
  }, [open, handleKeyDown]);

  // Handle drag to close
  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (!enableDrag) return;

    const threshold = 100;
    const velocity = 500;

    const shouldClose =
      (position === 'left' && (info.offset.x < -threshold || info.velocity.x < -velocity)) ||
      (position === 'right' && (info.offset.x > threshold || info.velocity.x > velocity)) ||
      (position === 'top' && (info.offset.y < -threshold || info.velocity.y < -velocity)) ||
      (position === 'bottom' && (info.offset.y > threshold || info.velocity.y > velocity));

    if (shouldClose) {
      onClose();
    }
  };

  // Handle overlay click
  const handleOverlayClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget && !preventOverlayClose) {
      onClose();
    }
  };

  if (typeof window === 'undefined') return null;

  const isHorizontal = position === 'left' || position === 'right';
  const dragConstraints = isHorizontal ? { left: 0, right: 0 } : { top: 0, bottom: 0 };
  const dragDirection = isHorizontal ? 'x' : 'y';

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          {showOverlay && (
            <motion.div
              className="fixed inset-0 z-overlay bg-black/30 dark:bg-black/50 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={handleOverlayClick}
            />
          )}

          {/* Drawer */}
          <motion.div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            className={`
              fixed z-modal
              ${positionStyles[position]}
              ${sizeStyles[position][size]}
              bg-white dark:bg-navy-900
              shadow-[0_25px_50px_rgba(0,0,0,0.15)]
              dark:shadow-[0_25px_50px_rgba(0,0,0,0.5)]
              flex flex-col
              outline-none
              ${className}
            `}
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={slideVariants[position] as any}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            drag={enableDrag ? dragDirection : false}
            dragConstraints={dragConstraints}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
          >
            {/* Drag handle for bottom drawer */}
            {position === 'bottom' && enableDrag && (
              <div className="flex justify-center py-2">
                <div className="w-12 h-1 bg-slate-300 dark:bg-slate-600 rounded-full" />
              </div>
            )}

            {/* Close button */}
            {showCloseButton && (
              <div className="absolute top-4 right-4 z-10">
                <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close drawer">
                  <X size={18} />
                </Button>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-auto">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};

// Drawer Header
export interface DrawerHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Header title */
  title?: string;
  /** Header description */
  description?: string;
}

export const DrawerHeader = React.forwardRef<HTMLDivElement, DrawerHeaderProps>(
  ({ title, description, children, className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`px-6 py-4 border-b border-slate-200 dark:border-navy-700 ${className}`}
        {...props}
      >
        {title && (
          <h2 className="text-lg font-semibold text-navy-900 dark:text-white pr-8">{title}</h2>
        )}
        {description && (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
        )}
        {children}
      </div>
    );
  }
);

DrawerHeader.displayName = 'DrawerHeader';

// Drawer Content
export const DrawerContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div ref={ref} className={`flex-1 p-6 overflow-auto ${className}`} {...props}>
        {children}
      </div>
    );
  }
);

DrawerContent.displayName = 'DrawerContent';

// Drawer Footer
export const DrawerFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`px-6 py-4 border-t border-slate-200 dark:border-navy-700 flex items-center justify-end gap-3 ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

DrawerFooter.displayName = 'DrawerFooter';

export default Drawer;
