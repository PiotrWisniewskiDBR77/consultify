/**
 * Feature Spotlight Component
 *
 * Highlights specific UI elements with a spotlight effect and tooltip description.
 * Used for new feature announcements and contextual guidance.
 */

import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, ChevronRight, Lightbulb, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface SpotlightPosition {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface FeatureSpotlightProps {
  id: string;
  target: string; // CSS selector
  title: { en: string; pl: string };
  description: { en: string; pl: string };
  placement?: 'top' | 'bottom' | 'left' | 'right';
  ctaText?: { en: string; pl: string };
  ctaAction?: () => void;
  dismissable?: boolean;
  padding?: number;
  onDismiss?: () => void;
  showOnce?: boolean;
}

// Storage key for dismissed spotlights
const DISMISSED_KEY = 'consultify_dismissed_spotlights';

// Get dismissed spotlights
const getDismissed = (): string[] => {
  try {
    const stored = localStorage.getItem(DISMISSED_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

// Mark spotlight as dismissed
const markDismissed = (id: string) => {
  try {
    const dismissed = getDismissed();
    if (!dismissed.includes(id)) {
      dismissed.push(id);
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed));
    }
  } catch {
    // Ignore storage errors
  }
};

export const FeatureSpotlight: React.FC<FeatureSpotlightProps> = ({
  id,
  target,
  title,
  description,
  placement = 'bottom',
  ctaText,
  ctaAction,
  dismissable = true,
  padding = 8,
  onDismiss,
  showOnce = true,
}) => {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'pl' ? 'pl' : 'en';

  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<SpotlightPosition | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Check if already dismissed
  useEffect(() => {
    if (showOnce) {
      const dismissed = getDismissed();
      if (dismissed.includes(id)) {
        return;
      }
    }

    // Find target element
    const element = document.querySelector(target);
    if (!element) {
      console.warn(`[FeatureSpotlight] Target not found: ${target}`);
      return;
    }

    // Calculate position
    const rect = element.getBoundingClientRect();
    queueMicrotask(() => {
      setPosition({
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      });
      setIsVisible(true);
    });

    // Update position on scroll/resize
    const updatePosition = () => {
      const newRect = element.getBoundingClientRect();
      setPosition({
        top: newRect.top - padding,
        left: newRect.left - padding,
        width: newRect.width + padding * 2,
        height: newRect.height + padding * 2,
      });
    };

    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [id, target, padding, showOnce]);

  // Handle dismiss
  const handleDismiss = () => {
    setIsVisible(false);
    if (showOnce) {
      markDismissed(id);
    }
    onDismiss?.();
  };

  // Handle CTA click
  const handleCtaClick = () => {
    ctaAction?.();
    handleDismiss();
  };

  // Calculate tooltip position
  const getTooltipStyle = (): React.CSSProperties => {
    if (!position) return {};

    const baseStyle: React.CSSProperties = {
      position: 'fixed',
      zIndex: 10002,
      maxWidth: '320px',
    };

    switch (placement) {
      case 'top':
        return {
          ...baseStyle,
          bottom: `calc(100vh - ${position.top}px + 12px)`,
          left: position.left + position.width / 2,
          transform: 'translateX(-50%)',
        };
      case 'bottom':
        return {
          ...baseStyle,
          top: position.top + position.height + 12,
          left: position.left + position.width / 2,
          transform: 'translateX(-50%)',
        };
      case 'left':
        return {
          ...baseStyle,
          top: position.top + position.height / 2,
          right: `calc(100vw - ${position.left}px + 12px)`,
          transform: 'translateY(-50%)',
        };
      case 'right':
        return {
          ...baseStyle,
          top: position.top + position.height / 2,
          left: position.left + position.width + 12,
          transform: 'translateY(-50%)',
        };
      default:
        return baseStyle;
    }
  };

  if (!isVisible || !position) return null;

  return (
    <AnimatePresence>
      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[10000] pointer-events-none"
        style={{
          background: `radial-gradient(
                        ellipse ${position.width + 100}px ${position.height + 100}px at ${position.left + position.width / 2}px ${position.top + position.height / 2}px,
                        transparent 0%,
                        transparent 50%,
                        rgba(0, 0, 0, 0.7) 100%
                    )`,
        }}
      />

      {/* Spotlight Ring */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="fixed z-[10001] pointer-events-none"
        style={{
          top: position.top,
          left: position.left,
          width: position.width,
          height: position.height,
          borderRadius: 8,
          border: '2px solid rgba(165,28,48, 0.8)',
          boxShadow: '0 0 0 4px rgba(165,28,48, 0.2), 0 0 20px rgba(165,28,48, 0.4)',
        }}
      />

      {/* Tooltip */}
      <motion.div
        ref={tooltipRef}
        initial={{
          opacity: 0,
          y: placement === 'top' ? 10 : placement === 'bottom' ? -10 : 0,
          x: placement === 'left' ? 10 : placement === 'right' ? -10 : 0,
        }}
        animate={{ opacity: 1, y: 0, x: 0 }}
        exit={{ opacity: 0 }}
        style={getTooltipStyle()}
        className="bg-c-surface-raised rounded-xl shadow-2xl border border-c-border-subtle overflow-hidden pointer-events-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-navy-900 dark:bg-navy-700 text-white">
          <div className="flex items-center gap-2">
            <Lightbulb size={18} />
            <span className="font-semibold">{title[lang]}</span>
          </div>
          {dismissable && (
            <button
              onClick={handleDismiss}
              className="p-1 hover:bg-c-surface-raised rounded transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-c-text-secondary text-sm leading-relaxed">
            {description[lang]}
          </p>

          {/* Actions */}
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={handleDismiss}
              className="text-sm text-c-text-muted hover:text-c-text-secondary dark:hover:text-c-text-muted"
            >
              {lang === 'pl' ? 'Rozumiem' : 'Got it'}
            </button>

            {ctaText && ctaAction && (
              <button
                onClick={handleCtaClick}
                className="flex items-center gap-1 text-sm font-medium text-c-accent dark:text-c-accent hover:text-c-accent dark:hover:text-c-accent"
              >
                {ctaText[lang]}
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Arrow */}
        <div
          className={`absolute w-3 h-3 bg-c-surface-raised border-c-border-subtle transform rotate-45 ${
            placement === 'top'
              ? 'bottom-[-7px] left-1/2 -translate-x-1/2 border-b border-r'
              : placement === 'bottom'
                ? 'top-[-7px] left-1/2 -translate-x-1/2 border-t border-l'
                : placement === 'left'
                  ? 'right-[-7px] top-1/2 -translate-y-1/2 border-r border-t'
                  : 'left-[-7px] top-1/2 -translate-y-1/2 border-l border-b'
          }`}
        />
      </motion.div>
    </AnimatePresence>
  );
};

export default FeatureSpotlight;
