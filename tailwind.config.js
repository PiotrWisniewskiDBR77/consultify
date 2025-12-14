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
        extend: {
            colors: {
                navy: {
                    950: '#020617', // Deepest background - Main App BG
                    900: '#0B1121', // Panel background - Secondary BG
                    850: '#111827', // Lighter panels
                    800: '#151E32', // Card background
                    700: '#2A3655', // Borders/Separators
                    600: '#374151', // Hover states
                },
                primary: {
                    50: '#F5F3FF',
                    100: '#EDE9FE',
                    200: '#DDD6FE',
                    300: '#C4B5FD',
                    400: '#A78BFA',
                    500: '#8B5CF6',
                    600: '#7C3AED', // Main Brand Color (Vivid Violet)
                    700: '#6D28D9',
                    800: '#5B21B6',
                    900: '#4C1D95',
                    950: '#2E1065',
                },
                blue: {
                    400: '#60A5FA', // Secondary/Info
                    500: '#3B82F6',
                    600: '#2563EB',
                    900: '#1E3A8A',
                },
                // Semantic Colors
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
                    DEFAULT: '#0B1121', // Strong Navy (matches navy-900)
                    light: '#151E32',   // Matches navy-800
                    lighter: '#1E293B', // Slate element
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
