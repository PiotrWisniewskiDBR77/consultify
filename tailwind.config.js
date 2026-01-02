/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./views/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./App.tsx"
    ],
    darkMode: 'class',
    theme: {
        screens: {
            'xs': '375px',     // Small mobile (iPhone SE)
            'sm': '640px',     // Large mobile
            'md': '768px',     // Tablet portrait
            'lg': '1024px',    // Tablet landscape / Desktop
            'xl': '1280px',    // Desktop
            '2xl': '1536px',   // Large desktop
            // Custom aliases for semantic usage
            'mobile': { 'max': '767px' },      // Mobile only
            'tablet': { 'min': '768px', 'max': '1023px' }, // Tablet only
            'touch': { 'max': '1023px' },      // Mobile + Tablet (touch devices)
            'desktop': '1024px',               // Desktop and up
        },
        extend: {
            colors: {
                // ========================================
                // DBR77 COLOR SYSTEM STANDARD
                // See: docs/00_foundation/COLOR_SYSTEM_STANDARD.md
                // ========================================
                
                // NEUTRAL - Navy-based grays (tła, ramki, tekst)
                navy: {
                    950: '#020617', // Deepest background - Main App BG
                    900: '#0B1121', // Panel background - Secondary BG
                    850: '#111827', // Lighter panels
                    800: '#151E32', // Card background
                    700: '#2A3655', // Borders/Separators
                    600: '#374151', // Hover states
                    500: '#475569', // Muted text
                    400: '#64748B', // Labels, placeholders
                    300: '#94A3B8', // Hints, disabled
                    200: '#CBD5E1', // Light borders
                    100: '#E2E8F0', // Hover bg
                    50: '#F1F5F9',  // Subtle bg
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
            },
            boxShadow: {
                'glow': '0 0 20px -5px rgba(124, 58, 237, 0.3)',
                'glow-lg': '0 0 40px -10px rgba(124, 58, 237, 0.5)',
                'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
                'panel': '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.15)',
                'inner-light': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.05)',
            },
            backgroundImage: {
                'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
                'glass-gradient': 'linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%)',
                'glass-dark': 'linear-gradient(180deg, rgba(17, 24, 39, 0.7) 0%, rgba(17, 24, 39, 0.4) 100%)',
                'shine': 'linear-gradient(45deg, transparent 25%, rgba(255,255,255,0.1) 50%, transparent 75%)',
            },
            backdropBlur: {
                'xs': '2px',
            },
            animation: {
                'fade-in': 'fadeIn 0.5s ease-out forwards',
                'slide-up': 'slideUp 0.5s ease-out forwards',
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'shimmer': 'shimmer 2s linear infinite',
            },
            keyframes: {
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
                }
            },
        },
    },
    plugins: [],
}
