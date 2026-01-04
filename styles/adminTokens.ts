/**
 * Admin Module Design Tokens (TypeScript)
 *
 * Elegant Technological Minimalism
 * Usage: Import in React components for consistent styling
 */

export const adminTokens = {
    // Background Colors
    bg: {
        primary: '#0F172A', // navy-950 - Main background
        secondary: '#1E293B', // slate-800 - Cards/sections
        tertiary: '#334155', // slate-700 - Hover states
        elevated: 'rgba(30, 41, 59, 0.5)', // slate-800/50
    },

    // Text Colors
    text: {
        primary: '#F8FAFC', // slate-50 - Headlines
        secondary: '#CBD5E1', // slate-300 - Body text
        tertiary: '#94A3B8', // slate-400 - Muted
        muted: '#64748B', // slate-500 - Labels
        disabled: '#475569', // slate-600
    },

    // Border Colors
    border: {
        default: 'rgba(255, 255, 255, 0.06)',
        subtle: 'rgba(255, 255, 255, 0.04)',
        emphasis: 'rgba(255, 255, 255, 0.10)',
        focus: 'rgba(59, 130, 246, 0.50)',
    },

    // Accent Colors
    accent: {
        primary: '#3B82F6', // blue-500
        hover: '#2563EB', // blue-600
        subtle: 'rgba(59, 130, 246, 0.10)',
        ring: 'rgba(59, 130, 246, 0.20)',
    },

    // Semantic Colors
    semantic: {
        success: '#10B981',
        successSubtle: 'rgba(16, 185, 129, 0.10)',
        warning: '#F59E0B',
        warningSubtle: 'rgba(245, 158, 11, 0.10)',
        error: '#EF4444',
        errorSubtle: 'rgba(239, 68, 68, 0.10)',
        info: '#3B82F6',
        infoSubtle: 'rgba(59, 130, 246, 0.10)',
    },

    // Interaction States
    hover: {
        bg: 'rgba(255, 255, 255, 0.02)',
        active: 'rgba(255, 255, 255, 0.04)',
        selected: 'rgba(59, 130, 246, 0.10)',
    },

    // Spacing (px)
    space: {
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        5: '20px',
        6: '24px',
        8: '32px',
        10: '40px',
    },

    // Border Radius
    radius: {
        sm: '4px',
        md: '6px',
        lg: '8px',
        xl: '12px',
    },

    // Typography
    font: {
        sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        mono: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
    },

    fontSize: {
        xs: '0.75rem', // 12px
        sm: '0.8125rem', // 13px
        base: '0.875rem', // 14px
        md: '1rem', // 16px
        lg: '1.125rem', // 18px
        xl: '1.25rem', // 20px
        '2xl': '1.5rem', // 24px
    },

    // Transitions
    transition: {
        fast: '100ms ease-out',
        base: '150ms ease-out',
        slow: '200ms ease-out',
    },
} as const;

// Tailwind class helpers
export const adminClasses = {
    // Card variants
    card: {
        base: 'bg-slate-800/50 rounded-xl p-5',
        bordered: 'border border-white/[0.06] rounded-xl p-5',
        elevated: 'bg-slate-800 rounded-xl p-5 shadow-lg shadow-black/20',
    },

    // Button variants
    btn: {
        primary:
            'px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50',
        secondary:
            'px-4 py-2 border border-white/10 hover:border-white/20 hover:bg-white/[0.02] text-slate-300 text-sm font-medium rounded-lg transition-colors',
        ghost: 'px-4 py-2 hover:bg-white/[0.04] text-slate-400 hover:text-slate-300 text-sm font-medium rounded-lg transition-colors',
        icon: 'p-2 hover:bg-white/[0.04] text-slate-400 hover:text-slate-300 rounded-lg transition-colors',
    },

    // Input styles
    input: 'w-full px-3.5 py-2.5 bg-slate-800/50 border border-white/[0.06] rounded-lg text-slate-200 text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-colors',
    select: 'w-full px-3.5 py-2.5 bg-slate-800/50 border border-white/[0.06] rounded-lg text-slate-200 text-sm focus:outline-none focus:border-blue-500/50 appearance-none cursor-pointer',

    // Table styles
    table: {
        wrapper: 'overflow-x-auto',
        base: 'w-full text-left',
        th: 'px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-white/[0.06]',
        td: 'px-4 py-3 text-sm text-slate-300',
        row: 'border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors',
    },

    // Badge variants
    badge: {
        success: 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400',
        warning: 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-400',
        error: 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400',
        neutral: 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-500/10 text-slate-400',
    },

    // Text styles
    text: {
        pageTitle: 'text-xl font-semibold text-slate-50 tracking-tight',
        pageSubtitle: 'text-sm text-slate-500 mt-0.5',
        sectionTitle: 'text-lg font-semibold text-slate-100',
        label: 'text-xs font-medium text-slate-500 uppercase tracking-wider',
        body: 'text-sm text-slate-300',
        muted: 'text-xs text-slate-500',
    },

    // Metric card
    metric: {
        label: 'text-xs font-medium text-slate-500 uppercase tracking-wider',
        value: 'text-2xl font-semibold text-slate-50 tabular-nums',
        subtitle: 'text-xs text-slate-500',
    },
} as const;

export default adminTokens;
