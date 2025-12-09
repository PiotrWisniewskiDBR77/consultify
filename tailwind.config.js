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
                    50: '#f5f3ff',
                    100: '#ede9fe',
                    200: '#ddd6fe',
                    300: '#c4b5fd',
                    400: '#a78bfa',
                    500: '#8b5cf6',
                    600: '#9333EA', // Main Brand Color
                    700: '#7e22ce',
                    800: '#6b21a8',
                    900: '#581c87',
                    950: '#3b0764',
                },
                blue: {
                    400: '#60A5FA', // Secondary/Info
                    500: '#3B82F6',
                    900: '#1E3A8A',
                },
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
            boxShadow: {
                'glow': '0 0 20px -5px rgba(147, 51, 234, 0.3)',
                'glow-lg': '0 0 30px -5px rgba(147, 51, 234, 0.5)',
                'panel': '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.15)',
            },
            backgroundImage: {
                'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
                'glass': 'linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.03) 100%)',
            },
            animation: {
                'fade-in': 'fadeIn 0.5s ease-out forwards',
                'slide-up': 'slideUp 0.5s ease-out forwards',
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
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
            },
        },
    },
    plugins: [],
}
