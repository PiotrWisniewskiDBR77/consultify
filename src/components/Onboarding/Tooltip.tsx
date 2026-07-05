import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Tooltip Component — Interactive Walkthroughs
 *
 * Features:
 * - Spotlight effect (highlights target element)
 * - Backdrop overlay
 * - Step navigation
 * - Responsive positioning
 */

export interface TooltipProps {
  targetSelector: string;
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  spotlightPadding?: number;
  showBackdrop?: boolean;
  onNext?: () => void;
  onPrev?: () => void;
  onDismiss?: () => void;
  step?: { current: number; total: number };
  isVisible?: boolean;
}

interface Position {
  top: number;
  left: number;
  arrowPosition: 'top' | 'bottom' | 'left' | 'right';
}

const TOOLTIP_OFFSET = 12;
const ARROW_SIZE = 8;

const calculatePosition = (
  target: DOMRect,
  tooltip: DOMRect,
  preferredPosition: 'top' | 'bottom' | 'left' | 'right'
): Position => {
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight,
  };

  let top = 0;
  let left = 0;
  let arrowPosition = preferredPosition;

  switch (preferredPosition) {
    case 'top':
      top = target.top - tooltip.height - TOOLTIP_OFFSET;
      left = target.left + (target.width - tooltip.width) / 2;
      arrowPosition = 'bottom';
      break;
    case 'bottom':
      top = target.bottom + TOOLTIP_OFFSET;
      left = target.left + (target.width - tooltip.width) / 2;
      arrowPosition = 'top';
      break;
    case 'left':
      top = target.top + (target.height - tooltip.height) / 2;
      left = target.left - tooltip.width - TOOLTIP_OFFSET;
      arrowPosition = 'right';
      break;
    case 'right':
      top = target.top + (target.height - tooltip.height) / 2;
      left = target.right + TOOLTIP_OFFSET;
      arrowPosition = 'left';
      break;
  }

  // Viewport bounds check
  if (left < 10) left = 10;
  if (left + tooltip.width > viewport.width - 10) {
    left = viewport.width - tooltip.width - 10;
  }
  if (top < 10) top = 10;
  if (top + tooltip.height > viewport.height - 10) {
    top = viewport.height - tooltip.height - 10;
  }

  return { top, left, arrowPosition };
};

export const Tooltip: React.FC<TooltipProps> = ({
  targetSelector,
  title,
  content,
  position = 'bottom',
  spotlightPadding = 8,
  showBackdrop = true,
  onNext,
  onPrev,
  onDismiss,
  step,
  isVisible = true,
}) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipPosition, setTooltipPosition] = useState<Position | null>(null);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!isVisible) return;

    const target = document.querySelector(targetSelector);
    if (!target) {
      console.warn(`[Tooltip] Target not found: ${targetSelector}`);
      return;
    }

    const updatePosition = () => {
      const rect = target.getBoundingClientRect();
      setTargetRect(rect);

      if (tooltipRef.current) {
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const pos = calculatePosition(rect, tooltipRect, position);
        setTooltipPosition(pos);
      }
    };

    // Initial position
    updatePosition();

    // Scroll target into view if needed
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Update on scroll/resize
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [targetSelector, position, isVisible]);

  // Second pass for tooltip sizing
  useEffect(() => {
    if (!isVisible || !targetRect || !tooltipRef.current) return;

    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const pos = calculatePosition(targetRect, tooltipRect, position);
    setTooltipPosition(pos);
  }, [targetRect, position, isVisible]);

  if (!isVisible) return null;

  const arrowClasses = {
    top: 'top-0 left-1/2 -translate-x-1/2 -translate-y-full border-l-transparent border-r-transparent border-t-transparent border-b-white dark:border-b-navy-800',
    bottom:
      'bottom-0 left-1/2 -translate-x-1/2 translate-y-full border-l-transparent border-r-transparent border-b-transparent border-t-white dark:border-t-navy-800',
    left: 'left-0 top-1/2 -translate-y-1/2 -translate-x-full border-t-transparent border-b-transparent border-l-transparent border-r-white dark:border-r-navy-800',
    right:
      'right-0 top-1/2 -translate-y-1/2 translate-x-full border-t-transparent border-b-transparent border-r-transparent border-l-white dark:border-l-navy-800',
  };

  return createPortal(
    <>
      {/* Backdrop with spotlight */}
      {showBackdrop && targetRect && (
        <div
          className="fixed inset-0 z-overlay pointer-events-none"
          style={{
            background: `radial-gradient(
                            ellipse ${targetRect.width + spotlightPadding * 2}px ${targetRect.height + spotlightPadding * 2}px
                            at ${targetRect.left + targetRect.width / 2}px ${targetRect.top + targetRect.height / 2}px,
                            transparent 0%,
                            rgba(0, 0, 0, 0.7) 100%
                        )`,
          }}
        />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="fixed z-modal w-80 bg-c-surface-raised rounded-xl shadow-2xl border border-c-border-subtle overflow-hidden"
        style={{
          top: tooltipPosition?.top ?? -9999,
          left: tooltipPosition?.left ?? -9999,
          opacity: tooltipPosition ? 1 : 0,
          transition: 'opacity 0.2s ease',
        }}
      >
        {/* Arrow */}
        {tooltipPosition && (
          <div
            className={`absolute w-0 h-0 border-8 ${arrowClasses[tooltipPosition.arrowPosition]}`}
          />
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-c-accent-soft border-b border-c-border-subtle">
          <h3 className="font-semibold text-c-text text-sm">{title}</h3>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-c-text-secondary hover:text-c-text-secondary dark:text-c-text-muted dark:hover:text-c-text-muted transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="px-4 py-3">
          <p className="text-sm text-c-text-secondary dark:text-c-text-muted leading-relaxed">{content}</p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 bg-c-surface-raised dark:bg-c-surface border-t border-c-border-subtle">
          {/* Step indicator */}
          {step && (
            <span className="text-xs text-c-text-muted">
              {step.current} / {step.total}
            </span>
          )}

          {/* Navigation */}
          <div className="flex items-center gap-2 ml-auto">
            {onPrev && step && step.current > 1 && (
              <button
                onClick={onPrev}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-c-text-secondary dark:text-c-text-muted hover:text-c-text dark:hover:text-c-text transition-colors"
              >
                <ChevronLeft size={14} />
                Wstecz
              </button>
            )}
            {onNext && (
              <button
                onClick={onNext}
 className="flex items-center gap-1 px-4 py-1.5 text-xs font-medium bg-c-text text-c-surface hover:opacity-90 rounded-lg transition-colors"
              >
                {step && step.current === step.total ? 'Zakończ' : 'Dalej'}
                {step && step.current !== step.total && <ChevronRight size={14} />}
              </button>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};

export default Tooltip;
