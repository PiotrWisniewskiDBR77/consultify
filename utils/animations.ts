/**
 * Animation Utilities - Apple HIG Design System
 * 
 * Centralized animation patterns following Apple Human Interface Guidelines.
 * Uses Framer Motion for smooth, spring-based animations.
 * 
 * @example
 * import { transitions, variants, stagger } from '@/utils/animations';
 * 
 * <motion.div
 *   variants={variants.fadeSlideUp}
 *   initial="hidden"
 *   animate="visible"
 *   transition={transitions.spring}
 * />
 */

import { Variants, Transition } from 'framer-motion';

// ============================================
// TRANSITIONS
// Spring-based transitions for natural motion
// ============================================

export const transitions = {
  /** Default spring for most UI elements */
  spring: {
    type: 'spring',
    stiffness: 300,
    damping: 30,
  } as Transition,

  /** Gentle spring for larger elements */
  gentle: {
    type: 'spring',
    stiffness: 200,
    damping: 20,
  } as Transition,

  /** Snappy spring for quick interactions */
  snappy: {
    type: 'spring',
    stiffness: 500,
    damping: 35,
  } as Transition,

  /** Bouncy spring for playful elements */
  bouncy: {
    type: 'spring',
    stiffness: 400,
    damping: 10,
  } as Transition,

  /** Smooth easing for simple fades */
  smooth: {
    duration: 0.2,
    ease: [0.4, 0, 0.2, 1],
  } as Transition,

  /** Fast easing for quick feedback */
  fast: {
    duration: 0.1,
    ease: 'easeOut',
  } as Transition,

  /** Slow easing for dramatic reveals */
  slow: {
    duration: 0.4,
    ease: [0.25, 0.1, 0.25, 1],
  } as Transition,
};

// ============================================
// VARIANTS
// Reusable animation states
// ============================================

export const variants = {
  /** Simple fade in/out */
  fade: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
  } as Variants,

  /** Fade with slide up */
  fadeSlideUp: {
    hidden: { opacity: 0, y: 12 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: transitions.spring,
    },
    exit: { 
      opacity: 0, 
      y: 8,
      transition: { duration: 0.15 },
    },
  } as Variants,

  /** Fade with slide down */
  fadeSlideDown: {
    hidden: { opacity: 0, y: -12 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: transitions.spring,
    },
    exit: { 
      opacity: 0, 
      y: -8,
      transition: { duration: 0.15 },
    },
  } as Variants,

  /** Fade with slide left */
  fadeSlideLeft: {
    hidden: { opacity: 0, x: 20 },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: transitions.spring,
    },
    exit: { 
      opacity: 0, 
      x: 12,
      transition: { duration: 0.15 },
    },
  } as Variants,

  /** Fade with slide right */
  fadeSlideRight: {
    hidden: { opacity: 0, x: -20 },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: transitions.spring,
    },
    exit: { 
      opacity: 0, 
      x: -12,
      transition: { duration: 0.15 },
    },
  } as Variants,

  /** Scale in/out (for modals, tooltips) */
  scale: {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: transitions.spring,
    },
    exit: { 
      opacity: 0, 
      scale: 0.95,
      transition: { duration: 0.15 },
    },
  } as Variants,

  /** Scale with more bounce (for buttons, notifications) */
  scaleBounce: {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: transitions.bouncy,
    },
    exit: { 
      opacity: 0, 
      scale: 0.8,
      transition: { duration: 0.1 },
    },
  } as Variants,

  /** Page transitions (slide left) */
  pageEnter: {
    hidden: { opacity: 0, x: 20 },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: transitions.gentle,
    },
    exit: { 
      opacity: 0, 
      x: -20,
      transition: { duration: 0.2 },
    },
  } as Variants,

  /** Drawer slide (left) */
  drawerLeft: {
    hidden: { x: '-100%' },
    visible: { 
      x: 0,
      transition: transitions.spring,
    },
    exit: { 
      x: '-100%',
      transition: { duration: 0.2 },
    },
  } as Variants,

  /** Drawer slide (right) */
  drawerRight: {
    hidden: { x: '100%' },
    visible: { 
      x: 0,
      transition: transitions.spring,
    },
    exit: { 
      x: '100%',
      transition: { duration: 0.2 },
    },
  } as Variants,

  /** Drawer slide (bottom) */
  drawerBottom: {
    hidden: { y: '100%' },
    visible: { 
      y: 0,
      transition: transitions.spring,
    },
    exit: { 
      y: '100%',
      transition: { duration: 0.2 },
    },
  } as Variants,

  /** List item (for staggered animations) */
  listItem: {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
  } as Variants,

  /** Button press */
  press: {
    rest: { scale: 1 },
    pressed: { scale: 0.97 },
    hover: { scale: 1.02 },
  } as Variants,

  /** Card hover lift */
  cardHover: {
    rest: { y: 0 },
    hover: { 
      y: -2,
      transition: transitions.snappy,
    },
  } as Variants,
};

// ============================================
// STAGGER HELPERS
// For animating lists of items
// ============================================

export const stagger = {
  /** Fast stagger (0.03s between items) */
  fast: {
    visible: {
      transition: {
        staggerChildren: 0.03,
      },
    },
  } as Variants,

  /** Default stagger (0.05s between items) */
  default: {
    visible: {
      transition: {
        staggerChildren: 0.05,
      },
    },
  } as Variants,

  /** Slow stagger (0.1s between items) */
  slow: {
    visible: {
      transition: {
        staggerChildren: 0.1,
      },
    },
  } as Variants,

  /** Create custom stagger */
  custom: (delay: number): Variants => ({
    visible: {
      transition: {
        staggerChildren: delay,
      },
    },
  }),
};

// ============================================
// GESTURE HELPERS
// For interactive elements
// ============================================

export const gestures = {
  /** Button tap feedback */
  tap: {
    whileTap: { scale: 0.97 },
    transition: transitions.snappy,
  },

  /** Interactive card */
  card: {
    whileHover: { y: -2 },
    whileTap: { scale: 0.99 },
    transition: transitions.spring,
  },

  /** Subtle hover */
  hover: {
    whileHover: { scale: 1.02 },
    transition: transitions.snappy,
  },
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Create delayed variants for staggered animations
 */
export function withDelay(
  variants: Variants, 
  delay: number
): Variants {
  return {
    ...variants,
    visible: {
      ...(typeof variants.visible === 'object' ? variants.visible : {}),
      transition: {
        ...(typeof variants.visible === 'object' && variants.visible.transition 
          ? variants.visible.transition 
          : {}),
        delay,
      },
    },
  };
}

/**
 * Create exit animation variants
 */
export function withExit(
  enterVariants: Variants,
  exitVariants?: Partial<Variants['exit']>
): Variants {
  return {
    ...enterVariants,
    exit: exitVariants || enterVariants.hidden,
  };
}

/**
 * Preset animation for page load
 */
export const pageLoadAnimation = {
  initial: 'hidden',
  animate: 'visible',
  exit: 'exit',
  variants: variants.fadeSlideUp,
};

/**
 * Preset animation for modals
 */
export const modalAnimation = {
  initial: 'hidden',
  animate: 'visible',
  exit: 'exit',
  variants: variants.scale,
};

/**
 * Preset animation for lists
 */
export const listAnimation = {
  initial: 'hidden',
  animate: 'visible',
  exit: 'exit',
  variants: stagger.default,
};

export default {
  transitions,
  variants,
  stagger,
  gestures,
  withDelay,
  withExit,
  pageLoadAnimation,
  modalAnimation,
  listAnimation,
};





