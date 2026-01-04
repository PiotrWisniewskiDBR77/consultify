import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
        server: {
            port: 3000,
            host: '0.0.0.0',
            proxy: {
                '/api': {
                    target: 'http://127.0.0.1:3005',
                    changeOrigin: true,
                    secure: false,
                },
                '/uploads': {
                    target: 'http://127.0.0.1:3005',
                    changeOrigin: true,
                    secure: false,
                },
            },
        },
        plugins: [react()],
        define: {
            'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
            'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        },
        resolve: {
            alias: {
                '@': path.resolve(__dirname, '.'),
            },
        },
        build: {
            rollupOptions: {
                output: {
                    manualChunks: (id) => {
                        // React core ecosystem
                        if (
                            id.includes('node_modules/react/') ||
                            id.includes('node_modules/react-dom/') ||
                            id.includes('node_modules/scheduler/')
                        ) {
                            return 'react-core';
                        }

                        // React Router
                        if (id.includes('node_modules/react-router') || id.includes('node_modules/@remix-run/')) {
                            return 'react-router';
                        }

                        // State management
                        if (id.includes('node_modules/zustand/')) {
                            return 'state-mgmt';
                        }

                        // Charts libraries (heavy)
                        if (
                            id.includes('node_modules/recharts/') ||
                            id.includes('node_modules/chart.js/') ||
                            id.includes('node_modules/react-chartjs-2/') ||
                            id.includes('node_modules/d3')
                        ) {
                            return 'charts';
                        }

                        // Drag and drop
                        if (id.includes('node_modules/@dnd-kit/')) {
                            return 'dnd-kit';
                        }

                        // Icons (very heavy - 869KB)
                        if (id.includes('node_modules/lucide-react/')) {
                            return 'ui-icons';
                        }

                        // Animations
                        if (id.includes('node_modules/framer-motion/')) {
                            return 'animations';
                        }

                        // AI SDK providers
                        if (id.includes('node_modules/@ai-sdk/') || id.includes('node_modules/ai/')) {
                            return 'ai-sdk';
                        }

                        // Google Generative AI
                        if (id.includes('node_modules/@google/generative-ai/')) {
                            return 'ai-google';
                        }

                        // OpenAI
                        if (id.includes('node_modules/openai/')) {
                            return 'ai-openai';
                        }

                        // Rich text editor (TipTap)
                        if (
                            id.includes('node_modules/@tiptap/') ||
                            id.includes('node_modules/prosemirror') ||
                            id.includes('node_modules/@hocuspocus/')
                        ) {
                            return 'editor';
                        }

                        // PDF generation
                        if (
                            id.includes('node_modules/jspdf/') ||
                            id.includes('node_modules/pdfkit/') ||
                            id.includes('node_modules/html2canvas/') ||
                            id.includes('node_modules/html-to-image/')
                        ) {
                            return 'pdf';
                        }

                        // Flow/diagram tools (heavy)
                        if (id.includes('node_modules/reactflow/') || id.includes('node_modules/@reactflow/')) {
                            return 'flow';
                        }

                        // Mermaid diagrams (heavy)
                        if (
                            id.includes('node_modules/mermaid/') ||
                            id.includes('node_modules/dagre') ||
                            id.includes('node_modules/cytoscape')
                        ) {
                            return 'diagrams';
                        }

                        // KaTeX math rendering
                        if (id.includes('node_modules/katex/')) {
                            return 'katex';
                        }

                        // i18n internationalization
                        if (id.includes('node_modules/i18next') || id.includes('node_modules/react-i18next/')) {
                            return 'i18n';
                        }

                        // Date utilities
                        if (id.includes('node_modules/date-fns/')) {
                            return 'date-utils';
                        }

                        // Form validation
                        if (id.includes('node_modules/zod/') || id.includes('node_modules/joi/')) {
                            return 'validation';
                        }

                        // Stripe billing
                        if (id.includes('node_modules/@stripe/')) {
                            return 'stripe';
                        }

                        // Excel/spreadsheet
                        if (id.includes('node_modules/xlsx/') || id.includes('node_modules/exceljs/')) {
                            return 'excel';
                        }

                        // Markdown rendering
                        if (
                            id.includes('node_modules/react-markdown/') ||
                            id.includes('node_modules/remark') ||
                            id.includes('node_modules/rehype') ||
                            id.includes('node_modules/unified/') ||
                            id.includes('node_modules/micromark/')
                        ) {
                            return 'markdown';
                        }

                        // Toast notifications
                        if (id.includes('node_modules/react-hot-toast/')) {
                            return 'toast';
                        }

                        // Dropzone
                        if (id.includes('node_modules/react-dropzone/')) {
                            return 'dropzone';
                        }

                        // Return undefined for modules that don't match any condition
                        return undefined;
                    },
                },
            },
            // Increase warning limit slightly since we've optimized chunks
            chunkSizeWarningLimit: 500,
            // Enable source maps for production debugging
            sourcemap: false,
            // Minification settings
            minify: 'esbuild',
            // Target modern browsers
            target: 'es2020',
        },
    };
});
