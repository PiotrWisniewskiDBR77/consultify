/**
 * Centralized color configuration for DRD Assessment ratings
 * 
 * This file contains all color-related constants and utilities for assessment levels,
 * ensuring consistency across all components (cards, matrices, navigators, etc.)
 */

/**
 * Color classes for "Actual" (current level) state
 */
export const ACTUAL_COLORS = {
    // Primary background and border
    bg: 'bg-blue-600',
    border: 'border-blue-500',
    bgLight: 'bg-blue-50',

    // Text colors
    text: 'text-white',
    textDark: 'text-blue-600',
    textLight: 'text-blue-400',

    // Hover states
    hoverBg: 'hover:bg-blue-500',
    hoverBorder: 'hover:border-blue-500',
    hoverText: 'hover:text-blue-400',

    // Dark mode variants
    darkBg: 'dark:bg-blue-600',
    darkHoverBg: 'dark:hover:bg-blue-500',

    // Shadow and glow effects
    shadow: 'shadow-lg shadow-blue-900/40',
    glow: 'shadow-[0_0_10px_rgba(37,99,235,0.3)]',
    glowStrong: 'shadow-[0_0_15px_rgba(37,99,235,0.4)]',
    glowRing: 'shadow-[0_0_15px_rgba(59,130,246,0.5)]',

    // Small elements (dots, indicators)
    dot: 'bg-blue-600',
    ring: 'border-blue-500',
} as const;

/**
 * Color classes for "Target" (goal level) state
 */
export const TARGET_COLORS = {
    // Primary background and border
    bg: 'bg-purple-600',
    bgLight: 'bg-purple-100',
    bgLightDark: 'dark:bg-purple-600/40',
    border: 'border-purple-500',
    borderDashed: 'border-purple-400 border-dashed',

    // Text colors
    text: 'text-white',
    textDark: 'text-purple-600',
    textDarkMode: 'dark:text-purple-300',
    textLight: 'text-purple-400',
    textNeutral: 'text-purple-900 dark:text-white',

    // Hover states
    hoverBg: 'hover:bg-purple-500',
    hoverBorder: 'hover:border-purple-500',
    hoverText: 'hover:text-purple-400',

    // Dark mode variants
    darkBg: 'dark:bg-purple-600',
    darkHoverBg: 'dark:hover:bg-purple-500',

    // Shadow and glow effects
    shadow: 'shadow-lg shadow-purple-900/40',
    glow: 'shadow-lg shadow-purple-900/30',
    glowRing: 'shadow-[0_0_15px_rgba(168,85,247,0.5)]',

    // Small elements (dots, indicators)
    dot: 'bg-purple-600',
    ring: 'border-purple-400 border-dashed',
} as const;

/**
 * Helper function to get button classes based on state
 * @param type - Either 'actual' or 'target'
 * @param isActive - Whether this button is currently active
 * @returns Tailwind CSS class string
 */
export function getAssessmentButtonClasses(
    type: 'actual' | 'target',
    isActive: boolean
): string {
    if (type === 'actual') {
        return isActive
            ? `${ACTUAL_COLORS.bg} ${ACTUAL_COLORS.border} ${ACTUAL_COLORS.text} ${ACTUAL_COLORS.shadow}`
            : `bg-slate-100 dark:bg-navy-950/30 border-slate-200 dark:border-blue-500/30 text-slate-500 dark:text-slate-300 ${ACTUAL_COLORS.hoverBorder} hover:bg-blue-50 dark:hover:bg-blue-500/10 ${ACTUAL_COLORS.hoverText} dark:hover:text-white hover:shadow-lg hover:shadow-blue-900/20`;
    } else {
        return isActive
            ? `${TARGET_COLORS.bg} ${TARGET_COLORS.border} ${TARGET_COLORS.text} ${TARGET_COLORS.shadow}`
            : `bg-slate-100 dark:bg-navy-950/30 border-slate-200 dark:border-purple-500/30 text-slate-500 dark:text-slate-300 ${TARGET_COLORS.hoverBorder} hover:bg-purple-50 dark:hover:bg-purple-500/10 ${TARGET_COLORS.hoverText} dark:hover:text-white hover:shadow-lg hover:shadow-purple-900/20`;
    }
}

/**
 * Helper function to get matrix cell classes based on state
 * @param isActual - Whether this cell represents the actual level
 * @param isTarget - Whether this cell represents the target level
 * @returns Tailwind CSS class string
 */
export function getMatrixCellClasses(isActual: boolean, isTarget: boolean): string {
    if (isActual) {
        return `${ACTUAL_COLORS.bg} border-blue-400 ${ACTUAL_COLORS.text} ${ACTUAL_COLORS.glowStrong} z-10 scale-105`;
    } else if (isTarget) {
        return `${TARGET_COLORS.bgLight} ${TARGET_COLORS.bgLightDark} ${TARGET_COLORS.borderDashed} ${TARGET_COLORS.textNeutral}`;
    } else {
        return 'bg-slate-50 dark:bg-navy-900/40 border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-800/40 hover:border-slate-300 dark:hover:border-slate-700';
    }
}

/**
 * Helper function to get level selector number bubble classes
 * @param isActual - Whether this level is the actual level
 * @param isTarget - Whether this level is the target level
 * @param isInGap - Whether this level is between actual and target
 * @returns Tailwind CSS class string
 */
export function getLevelBubbleClasses(
    isActual: boolean,
    isTarget: boolean,
    isInGap: boolean
): string {
    if (isActual) {
        return `${ACTUAL_COLORS.ring} ${ACTUAL_COLORS.textLight} ${ACTUAL_COLORS.glowRing}`;
    } else if (isTarget) {
        return `${TARGET_COLORS.ring} ${TARGET_COLORS.textLight} ${TARGET_COLORS.glowRing}`;
    } else if (isInGap) {
        return 'border-purple-500/30 text-purple-200/50';
    } else {
        return 'border-white/10 text-slate-600';
    }
}

/**
 * Helper function to get badge/label classes for status indicators
 * @param type - Either 'actual' or 'target'
 * @returns Tailwind CSS class string
 */
export function getStatusBadgeClasses(type: 'actual' | 'target'): string {
    if (type === 'actual') {
        return `text-xs font-bold ${ACTUAL_COLORS.text} ${ACTUAL_COLORS.bg} px-2 py-0.5 rounded-full`;
    } else {
        return `text-xs font-bold ${TARGET_COLORS.text} ${TARGET_COLORS.bg} px-2 py-0.5 rounded-full`;
    }
}

/**
 * Helper function to get score badge classes (for displaying numerical scores)
 * @param type - Either 'actual' or 'target'
 * @returns Tailwind CSS class string
 */
export function getScoreBadgeClasses(type: 'actual' | 'target'): string {
    if (type === 'actual') {
        return `px-2 py-0.5 rounded ${ACTUAL_COLORS.bg} font-bold ${ACTUAL_COLORS.text} ${ACTUAL_COLORS.glow}`;
    } else {
        return `px-2 py-0.5 rounded ${TARGET_COLORS.bgLight} ${TARGET_COLORS.bgLightDark} ${TARGET_COLORS.border} ${TARGET_COLORS.textDark} ${TARGET_COLORS.textDarkMode} font-bold`;
    }
}

/**
 * Helper function to get legend dot classes
 * @param type - Either 'actual' or 'target'
 * @returns Tailwind CSS class string
 */
export function getLegendDotClasses(type: 'actual' | 'target'): string {
    if (type === 'actual') {
        return `w-2 h-2 rounded-full ${ACTUAL_COLORS.dot} block`;
    } else {
        return `w-2 h-2 rounded-full ${TARGET_COLORS.ring} block`;
    }
}
