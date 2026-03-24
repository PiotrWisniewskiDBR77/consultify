/**
 * AnimatedBlock — wraps block renderers with viewport-triggered animations.
 * Uses framer-motion's useInView for IntersectionObserver-based triggers.
 * Chart bars draw from zero, KPI widgets count up, bullet lists stagger in.
 */

import { motion, useInView } from 'framer-motion';
import React, { useEffect, useRef, useState } from 'react';

import type { BlockType } from '../wizard/types';

interface AnimatedBlockProps {
  blockType: BlockType | string;
  index: number;
  animationsEnabled: boolean;
  blockStagger: boolean;
  children: React.ReactNode;
}

const BLOCK_VARIANTS: Record<
  string,
  {
    initial: Record<string, unknown>;
    animate: Record<string, unknown>;
    transition: Record<string, unknown>;
  }
> = {
  heading: {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: 'easeOut' },
  },
  paragraph: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, ease: 'easeOut' },
  },
  bullet_list: {
    initial: { opacity: 0, x: -10 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.4, ease: 'easeOut' },
  },
  numbered_list: {
    initial: { opacity: 0, x: -10 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.4, ease: 'easeOut' },
  },
  chart: {
    initial: { opacity: 0, scaleY: 0 },
    animate: { opacity: 1, scaleY: 1 },
    transition: { duration: 0.6, ease: [0.34, 1.56, 0.64, 1] },
  },
  kpi_widget: {
    initial: { opacity: 0, scale: 0.8 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: 0.5, ease: [0.34, 1.56, 0.64, 1] },
  },
  metric_strip: {
    initial: { opacity: 0, y: 15 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: 'easeOut' },
  },
  smart_diagram: {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: 0.6, ease: 'easeOut' },
  },
  smart_layout: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: 'easeOut' },
  },
  image: {
    initial: { opacity: 0, scale: 1.02 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: 0.8, ease: 'easeOut' },
  },
  timeline_block: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.6, ease: 'easeOut' },
  },
  table: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, ease: 'easeOut' },
  },
  callout: {
    initial: { opacity: 0, x: -12 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.4, ease: 'easeOut' },
  },
  artifact_embed: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, ease: 'easeOut' },
  },
  divider: {
    initial: { opacity: 0, scaleX: 0 },
    animate: { opacity: 1, scaleX: 1 },
    transition: { duration: 0.3, ease: 'easeOut' },
  },
};

const DEFAULT_VARIANT = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: 'easeOut' },
};

export const AnimatedBlock: React.FC<AnimatedBlockProps> = ({
  blockType,
  index,
  animationsEnabled,
  blockStagger,
  children,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  if (!animationsEnabled) {
    return <div>{children}</div>;
  }

  const variant = BLOCK_VARIANTS[blockType] || DEFAULT_VARIANT;
  const staggerDelay = blockStagger ? index * 0.15 : 0;

  return (
    <motion.div
      ref={ref}
      initial={variant.initial as any}
      animate={(isInView ? variant.animate : variant.initial) as any}
      transition={{
        ...variant.transition,
        delay: staggerDelay,
      }}
      style={blockType === 'chart' ? { transformOrigin: 'bottom' } : undefined}
    >
      {children}
    </motion.div>
  );
};

/**
 * AnimatedCard — entrance animation for the entire card.
 */
interface AnimatedCardProps {
  entrance: 'fade' | 'slide_up' | 'none';
  animationsEnabled: boolean;
  children: React.ReactNode;
}

export const AnimatedCard: React.FC<AnimatedCardProps> = ({
  entrance,
  animationsEnabled,
  children,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  if (!animationsEnabled || entrance === 'none') {
    return <div ref={ref}>{children}</div>;
  }

  const variants = {
    fade: { initial: { opacity: 0 }, animate: { opacity: 1 } },
    slide_up: { initial: { opacity: 0, y: 40 }, animate: { opacity: 1, y: 0 } },
  };

  const v = variants[entrance] || variants.fade;

  return (
    <motion.div
      ref={ref}
      initial={v.initial}
      animate={isInView ? v.animate : v.initial}
      transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {children}
    </motion.div>
  );
};

/**
 * CountUpNumber — animates a number from 0 to target value.
 * Used inside KpiWidgetBlock and MetricStripBlock.
 */
interface CountUpProps {
  value: number | string;
  duration?: number;
  enabled?: boolean;
}

export const CountUpNumber: React.FC<CountUpProps> = ({
  value,
  duration = 1.2,
  enabled = true,
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const [displayed, setDisplayed] = useState<string>(enabled ? '0' : String(value));

  const numericValue =
    typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : value;
  const prefix = typeof value === 'string' ? value.replace(/[0-9.,%-]+/g, '').trim() : '';
  const isNumeric = !isNaN(numericValue);

  useEffect(() => {
    if (!enabled || !isInView || !isNumeric) {
      setDisplayed(String(value));
      return;
    }

    const startTime = performance.now();
    const durationMs = duration * 1000;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(numericValue * eased);

      if (prefix) {
        setDisplayed(`${prefix}${current.toLocaleString()}`);
      } else {
        setDisplayed(current.toLocaleString());
      }

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        setDisplayed(String(value));
      }
    };

    requestAnimationFrame(tick);
  }, [isInView, enabled, numericValue, duration, value, prefix, isNumeric]);

  return <span ref={ref}>{displayed}</span>;
};
