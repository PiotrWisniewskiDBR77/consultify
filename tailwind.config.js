/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './views/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './App.tsx',
  ],
  darkMode: 'class',
  theme: {
    screens: {
      xs: '375px', // Small mobile (iPhone SE)
      sm: '640px', // Large mobile
      md: '768px', // Tablet portrait
      lg: '1024px', // Tablet landscape / Desktop
      xl: '1280px', // Desktop
      '2xl': '1536px', // Large desktop
      // Custom aliases for semantic usage
      mobile: { max: '767px' }, // Mobile only
      tablet: { min: '768px', max: '1023px' }, // Tablet only
      touch: { max: '1023px' }, // Mobile + Tablet (touch devices)
      desktop: '1024px', // Desktop and up
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',

        // ========================================
        // SEMANTIC TOKENS (Light Mode System v3.2)
        // SSOT: docs/ui-standards/00-foundation/light-mode-readability.md §16
        // Use these by default; raw palette only in primitives / token file.
        // ========================================
        surface: {
          app: 'rgb(var(--surface-app) / <alpha-value>)',
          DEFAULT: 'rgb(var(--surface-default) / <alpha-value>)',
          subtle: 'rgb(var(--surface-subtle) / <alpha-value>)',
          hover: 'rgb(var(--surface-hover) / <alpha-value>)',
          selected: 'rgb(var(--surface-selected) / <alpha-value>)',
          strong: 'rgb(var(--surface-strong) / <alpha-value>)',
        },
        content: {
          primary: 'rgb(var(--text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--text-secondary) / <alpha-value>)',
          supportive: 'rgb(var(--text-supportive) / <alpha-value>)',
          metadata: 'rgb(var(--text-metadata) / <alpha-value>)',
          inverted: 'rgb(var(--text-inverted) / <alpha-value>)',
        },
        edge: {
          DEFAULT: 'rgb(var(--border-default) / <alpha-value>)',
          strong: 'rgb(var(--border-strong) / <alpha-value>)',
          subtle: 'rgb(var(--border-subtle) / <alpha-value>)',
          selected: 'rgb(var(--border-selected) / <alpha-value>)',
        },
        status: {
          'info-bg': 'rgb(var(--status-info-bg) / <alpha-value>)',
          'info-border': 'rgb(var(--status-info-border) / <alpha-value>)',
          'info-text': 'rgb(var(--status-info-text) / <alpha-value>)',
          'info-icon': 'rgb(var(--status-info-icon) / <alpha-value>)',
          'success-bg': 'rgb(var(--status-success-bg) / <alpha-value>)',
          'success-border': 'rgb(var(--status-success-border) / <alpha-value>)',
          'success-text': 'rgb(var(--status-success-text) / <alpha-value>)',
          'success-icon': 'rgb(var(--status-success-icon) / <alpha-value>)',
          'warning-bg': 'rgb(var(--status-warning-bg) / <alpha-value>)',
          'warning-border': 'rgb(var(--status-warning-border) / <alpha-value>)',
          'warning-text': 'rgb(var(--status-warning-text) / <alpha-value>)',
          'warning-icon': 'rgb(var(--status-warning-icon) / <alpha-value>)',
          'danger-bg': 'rgb(var(--status-danger-bg) / <alpha-value>)',
          'danger-border': 'rgb(var(--status-danger-border) / <alpha-value>)',
          'danger-text': 'rgb(var(--status-danger-text) / <alpha-value>)',
          'danger-icon': 'rgb(var(--status-danger-icon) / <alpha-value>)',
          'primary-bg': 'rgb(var(--status-primary-bg) / <alpha-value>)',
          'primary-border': 'rgb(var(--status-primary-border) / <alpha-value>)',
          'primary-text': 'rgb(var(--status-primary-text) / <alpha-value>)',
          'primary-icon': 'rgb(var(--status-primary-icon) / <alpha-value>)',
          'neutral-bg': 'rgb(var(--status-neutral-bg) / <alpha-value>)',
          'neutral-border': 'rgb(var(--status-neutral-border) / <alpha-value>)',
          'neutral-text': 'rgb(var(--status-neutral-text) / <alpha-value>)',
          'neutral-icon': 'rgb(var(--status-neutral-icon) / <alpha-value>)',
        },
        focus: {
          ring: 'rgb(var(--focus-ring) / <alpha-value>)',
          offset: 'rgb(var(--focus-ring-offset) / <alpha-value>)',
        },
        // ========================================
        // DBR77 COLOR SYSTEM STANDARD
        // See: docs/00_foundation/COLOR_SYSTEM_STANDARD.md
        // ========================================

        // NEUTRAL - Navy-based grays (tła, ramki, tekst)
        // Updated for softer dark mode appearance (HIG refinement)
        navy: {
          950: '#0A0F1E', // Deepest background - Main App BG (softer than pure black)
          900: '#0F172A', // Panel background - Secondary BG (warmer, less harsh)
          850: '#111827', // Lighter panels
          800: '#151E32', // Card background
          700: '#2A3655', // Borders/Separators
          600: '#374151', // Hover states
          500: '#475569', // Muted text
          400: '#64748B', // Labels, placeholders
          300: '#94A3B8', // Hints, disabled
          200: '#CBD5E1', // Light borders
          100: '#E2E8F0', // Hover bg
          50: '#F1F5F9', // Subtle bg
        },

        // PRIMARY - Fiolet (główne akcje, linki, focus)
        primary: {
          DEFAULT: '#7C3AED',
          hover: '#6D28D9',
          light: '#8B5CF6',
          surface: 'rgba(124, 58, 237, 0.1)',
          50: '#F5F3FF',
          100: '#EDE9FE',
          200: '#DDD6FE',
          300: '#C4B5FD',
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#7C3AED',
          700: '#6D28D9',
          800: '#5B21B6',
          900: '#4C1D95',
          950: '#2E1065',
        },

        // SECONDARY - Granatowy (akcje drugorzędne, nawigacja)
        secondary: {
          DEFAULT: '#1E3A5F',
          hover: '#0F2744',
          light: '#2E4A6F',
          surface: 'rgba(30, 58, 95, 0.1)',
          900: '#0F2744',
          800: '#1E3A5F',
          700: '#2E4A6F',
          600: '#3E5A7F',
          500: '#4E6A8F',
          400: '#6E8AAF',
          300: '#8EAACF',
          200: '#AECAEF',
          100: '#DEEAFF',
          50: '#F0F5FF',
        },

        // DANGER - Czerwień (TYLKO: błędy, usuwanie, alarm)
        danger: {
          DEFAULT: '#DC2626',
          hover: '#B91C1C',
          light: '#EF4444',
          surface: 'rgba(220, 38, 38, 0.1)',
          900: '#7F1D1D',
          800: '#991B1B',
          700: '#B91C1C',
          600: '#DC2626',
          500: '#EF4444',
          400: '#F87171',
          300: '#FCA5A5',
          200: '#FECACA',
          100: '#FEE2E2',
          50: '#FEF2F2',
        },

        // SUCCESS - Szmaragdowy (TYLKO: status aktywny, potwierdzenia)
        success: {
          DEFAULT: '#059669',
          hover: '#047857',
          light: '#10B981',
          surface: 'rgba(5, 150, 105, 0.1)',
          900: '#064E3B',
          800: '#065F46',
          700: '#047857',
          600: '#059669',
          500: '#10B981',
          400: '#34D399',
          300: '#6EE7B7',
          200: '#A7F3D0',
          100: '#D1FAE5',
          50: '#ECFDF5',
        },

        // LEGACY ALIASES (for backwards compatibility)
        brand: {
          DEFAULT: '#7C3AED',
          hover: '#6D28D9',
          surface: 'rgba(124, 58, 237, 0.1)',
          50: '#F5F3FF',
          100: '#EDE9FE',
          200: '#DDD6FE',
          300: '#C4B5FD',
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#7C3AED',
          700: '#6D28D9',
          800: '#5B21B6',
          900: '#4C1D95',
          950: '#2E1065',
        },
        dbr77: {
          DEFAULT: '#0B1121',
          light: '#151E32',
          lighter: '#1E293B',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Inter', 'sans-serif'], // Can swap for a more display-oriented font later
        japanese: ['Noto Sans JP', 'Inter', 'sans-serif'], // Japanese font with full character support
      },
      boxShadow: {
        // Legacy shadows
        glow: '0 0 20px -5px rgba(124, 58, 237, 0.3)',
        'glow-lg': '0 0 40px -10px rgba(124, 58, 237, 0.5)',
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        panel: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.15)',
        'inner-light': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.05)',

        // ========================================
        // APPLE HIG DEPTH SYSTEM
        // Replaces flat borders with subtle shadows
        // ========================================
        'hig-xs': '0 1px 2px rgba(0, 0, 0, 0.03), 0 1px 1px rgba(0, 0, 0, 0.04)',
        'hig-sm': '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)',
        'hig-md': '0 4px 6px rgba(0, 0, 0, 0.04), 0 2px 4px rgba(0, 0, 0, 0.06)',
        'hig-lg': '0 10px 15px rgba(0, 0, 0, 0.04), 0 4px 6px rgba(0, 0, 0, 0.05)',
        'hig-xl': '0 20px 25px rgba(0, 0, 0, 0.06), 0 10px 10px rgba(0, 0, 0, 0.04)',
        'hig-2xl': '0 25px 50px rgba(0, 0, 0, 0.08), 0 12px 24px rgba(0, 0, 0, 0.06)',
        'hig-inner': 'inset 0 1px 2px rgba(0, 0, 0, 0.05)',
        'hig-inner-lg': 'inset 0 2px 4px rgba(0, 0, 0, 0.06)',
        // Dark mode optimized shadows (more visible)
        'hig-dark-sm': '0 1px 3px rgba(0, 0, 0, 0.2), 0 1px 2px rgba(0, 0, 0, 0.3)',
        'hig-dark-md': '0 4px 6px rgba(0, 0, 0, 0.25), 0 2px 4px rgba(0, 0, 0, 0.3)',
        'hig-dark-lg': '0 10px 15px rgba(0, 0, 0, 0.3), 0 4px 6px rgba(0, 0, 0, 0.25)',
        'hig-dark-xl': '0 20px 25px rgba(0, 0, 0, 0.35), 0 10px 10px rgba(0, 0, 0, 0.25)',
        // Elevated card hover state
        'hig-hover': '0 8px 16px rgba(0, 0, 0, 0.08), 0 4px 8px rgba(0, 0, 0, 0.06)',
        'hig-hover-dark': '0 8px 16px rgba(0, 0, 0, 0.4), 0 4px 8px rgba(0, 0, 0, 0.3)',
        // Focus ring
        'hig-focus': '0 0 0 3px rgba(124, 58, 237, 0.3)',
        'hig-focus-danger': '0 0 0 3px rgba(220, 38, 38, 0.3)',
      },
      backgroundImage: {
        // Legacy gradients
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'glass-gradient':
          'linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%)',
        'glass-dark':
          'linear-gradient(180deg, rgba(17, 24, 39, 0.7) 0%, rgba(17, 24, 39, 0.4) 100%)',
        shine:
          'linear-gradient(45deg, transparent 25%, rgba(255,255,255,0.1) 50%, transparent 75%)',

        // ========================================
        // APPLE HIG GLASS / VIBRANCY EFFECTS
        // ========================================
        // Light mode glass
        'hig-glass':
          'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.7) 100%)',
        'hig-glass-subtle':
          'linear-gradient(135deg, rgba(255, 255, 255, 0.6) 0%, rgba(255, 255, 255, 0.4) 100%)',
        // Dark mode glass (vibrant)
        'hig-glass-dark':
          'linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(15, 23, 42, 0.6) 100%)',
        'hig-glass-dark-subtle':
          'linear-gradient(135deg, rgba(15, 23, 42, 0.6) 0%, rgba(15, 23, 42, 0.4) 100%)',
        // Elevated surfaces (subtle gradient for depth)
        'hig-elevated':
          'linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgba(248, 250, 252, 1) 100%)',
        'hig-elevated-dark':
          'linear-gradient(180deg, rgba(21, 30, 50, 1) 0%, rgba(11, 17, 33, 1) 100%)',
        // Skeleton loading gradient
        'hig-skeleton':
          'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.4) 50%, transparent 100%)',
        'hig-skeleton-dark':
          'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%)',
        // Accent gradients (for premium CTAs)
        'hig-primary': 'linear-gradient(135deg, #7C3AED 0%, #8B5CF6 100%)',
        'hig-primary-hover': 'linear-gradient(135deg, #6D28D9 0%, #7C3AED 100%)',
      },
      // ========================================
      // APPLE HIG SPACING SCALE
      // Consistent spacing for premium feel
      // ========================================
      spacing: {
        'hig-xs': '4px',
        'hig-sm': '8px',
        'hig-md': '12px',
        'hig-lg': '16px',
        'hig-xl': '20px',
        'hig-2xl': '24px',
        'hig-3xl': '32px',
        'hig-4xl': '40px',
        'hig-5xl': '48px',
      },
      // ========================================
      // APPLE HIG FONT SIZES
      // Typography scale matching Apple's system
      // ========================================
      fontSize: {
        'hig-caption': ['11px', { lineHeight: '13px', letterSpacing: '0.07px' }],
        'hig-footnote': ['13px', { lineHeight: '18px', letterSpacing: '-0.08px' }],
        'hig-subhead': ['15px', { lineHeight: '20px', letterSpacing: '-0.24px' }],
        'hig-body': ['17px', { lineHeight: '22px', letterSpacing: '-0.43px' }],
        'hig-headline': [
          '17px',
          { lineHeight: '22px', fontWeight: '600', letterSpacing: '-0.43px' },
        ],
        'hig-title3': ['20px', { lineHeight: '24px', fontWeight: '400', letterSpacing: '0.38px' }],
        'hig-title2': ['22px', { lineHeight: '28px', fontWeight: '400', letterSpacing: '0.35px' }],
        'hig-title1': ['28px', { lineHeight: '34px', fontWeight: '400', letterSpacing: '0.36px' }],
        'hig-large-title': [
          '34px',
          { lineHeight: '41px', fontWeight: '400', letterSpacing: '0.37px' },
        ],
      },
      backdropBlur: {
        xs: '2px',
        // ========================================
        // APPLE HIG VIBRANCY / GLASS EFFECTS
        // ========================================
        hig: '20px',
        'hig-light': '12px',
        'hig-heavy': '40px',
        'hig-ultra': '60px',
      },
      // ========================================
      // APPLE HIG BORDER RADIUS
      // Consistent rounded corners system
      // ========================================
      borderRadius: {
        'hig-xs': '6px',
        'hig-sm': '8px',
        'hig-md': '12px',
        'hig-lg': '16px',
        'hig-xl': '20px',
        'hig-2xl': '24px',
        'hig-3xl': '28px',
        'hig-full': '9999px',
      },
      // ========================================
      // APPLE HIG ANIMATION CURVES
      // ========================================
      transitionTimingFunction: {
        hig: 'cubic-bezier(0.4, 0, 0.2, 1)',
        'hig-spring': 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        'hig-bounce': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'hig-smooth': 'cubic-bezier(0.25, 0.1, 0.25, 1)',
        'hig-decel': 'cubic-bezier(0, 0, 0.2, 1)',
        'hig-accel': 'cubic-bezier(0.4, 0, 1, 1)',
      },
      transitionDuration: {
        'hig-fast': '100ms',
        'hig-normal': '200ms',
        'hig-slow': '300ms',
        'hig-slower': '400ms',
      },
      animation: {
        // Legacy animations
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.5s ease-out forwards',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        shimmer: 'shimmer 2s linear infinite',

        // ========================================
        // APPLE HIG ANIMATIONS
        // ========================================
        // Entrance animations
        'hig-fade-in': 'higFadeIn 0.2s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'hig-fade-out': 'higFadeOut 0.15s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'hig-slide-up': 'higSlideUp 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
        'hig-slide-down': 'higSlideDown 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
        'hig-slide-left': 'higSlideLeft 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'hig-slide-right': 'higSlideRight 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        // Scale animations (for modals, cards)
        'hig-scale-in': 'higScaleIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
        'hig-scale-out': 'higScaleOut 0.15s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        // Button press feedback
        'hig-press': 'higPress 0.1s ease-out forwards',
        // Skeleton loading
        'hig-skeleton': 'higSkeleton 1.5s ease-in-out infinite',
        // Spinner
        'hig-spin': 'higSpin 0.8s linear infinite',
        // Bounce for notifications
        'hig-bounce-in': 'higBounceIn 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards',
      },
      keyframes: {
        // Legacy keyframes
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },

        // ========================================
        // APPLE HIG KEYFRAMES
        // ========================================
        higFadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        higFadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        higSlideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        higSlideDown: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        higSlideLeft: {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        higSlideRight: {
          '0%': { opacity: '0', transform: 'translateX(-16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        higScaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        higScaleOut: {
          '0%': { opacity: '1', transform: 'scale(1)' },
          '100%': { opacity: '0', transform: 'scale(0.95)' },
        },
        higPress: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(0.97)' },
          '100%': { transform: 'scale(1)' },
        },
        higSkeleton: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        higSpin: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        higBounceIn: {
          '0%': { opacity: '0', transform: 'scale(0.3)' },
          '50%': { transform: 'scale(1.05)' },
          '70%': { transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
