/**
 * motionTokens — V5-IDEA-47 Motion and microinteraction polish.
 *
 * Canonical motion tokens for the Ideas V5 workspace.
 * Per SSOT: functional motion only, no decorative animation.
 * Durations: 120–220ms ease-out.
 */

export const MOTION = {
  fast: 'duration-100 ease-out',
  normal: 'duration-150 ease-out',
  smooth: 'duration-200 ease-out',
  gentle: 'duration-300 ease-out',
  zoom: 'duration-[220ms] ease-out',
} as const;

export const HOVER_SCALE = {
  subtle: 'hover:scale-[1.02] active:scale-[0.98]',
  medium: 'hover:scale-105 active:scale-95',
  icon: 'hover:scale-110 active:scale-95',
} as const;

export const ENTER_ANIMATION = {
  fadeIn: 'animate-in fade-in',
  slideUp: 'animate-in slide-in-from-bottom-2 fade-in',
  slideDown: 'animate-in slide-in-from-top-2 fade-in',
  scaleIn: 'animate-in zoom-in-95 fade-in',
  slideRight: 'animate-in slide-in-from-left-2 fade-in',
} as const;

export const EXIT_ANIMATION = {
  fadeOut: 'animate-out fade-out',
  slideDown: 'animate-out slide-out-to-bottom-2 fade-out',
  scaleOut: 'animate-out zoom-out-95 fade-out',
} as const;

export const FOCUS_RING =
  'focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-offset-1 focus-visible:outline-none';

export const TRANSITION_COLORS = `transition-colors ${MOTION.normal}`;
export const TRANSITION_ALL = `transition-all ${MOTION.smooth}`;
export const TRANSITION_TRANSFORM = `transition-transform ${MOTION.fast}`;
