import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3001',
          changeOrigin: true,
          secure: false,
        },
        '/uploads': {
          target: 'http://127.0.0.1:3001',
          changeOrigin: true,
          secure: false,
        },
      },
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        'zustand',
        'lucide-react',
        'framer-motion',
        'date-fns',
        'clsx',
        'tailwind-merge',
        // Ensure lodash CJS helpers are prebundled for ESM import safety
        'lodash',
        'lodash/get',
        // React Flow and its dependencies need to be pre-bundled
        'reactflow',
        'use-sync-external-store',
        'use-sync-external-store/shim',
        'use-sync-external-store/shim/with-selector',
        // Ensure react-is matches React 19 version
        'react-is',
        // Prebundle recharts to avoid lodash CJS/ESM import issues
        'recharts',
      ],
      exclude: [
        // Large libs that should be lazy loaded
        'mermaid',
        '@tiptap/react',
        'jspdf',
        'xlsx',
      ],
    },
    build: {
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          // Ensure recharts loads as a separate async chunk
          chunkFileNames: (chunkInfo) => {
            if (
              chunkInfo.name === 'charts' ||
              chunkInfo.moduleIds.some((id) => id.includes('recharts'))
            ) {
              return 'assets/charts-[hash].js';
            }
            return 'assets/[name]-[hash].js';
          },
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
            if (
              id.includes('node_modules/react-router') ||
              id.includes('node_modules/@remix-run/')
            ) {
              return 'react-router';
            }

            // State management
            if (id.includes('node_modules/zustand/')) {
              return 'state-mgmt';
            }

            // Charts libraries (heavy)
            // CRITICAL: recharts must load AFTER react-core to avoid React 19 compatibility issues
            // Keep recharts separate from other chart libraries
            if (id.includes('node_modules/recharts/')) {
              // Don't put recharts in charts chunk - it needs to load after React
              // Return undefined so it goes to vendor chunk, but ensure react-core loads first
              return undefined;
            }
            if (
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
      // Disable source maps in production for smaller bundle
      sourcemap: false,
      // Minification settings
      minify: 'esbuild',
      // Target modern browsers
      target: 'es2020',
      // Reduce bundle size
      reportCompressedSize: true,
      // Tree shaking optimization
      treeshake: {
        moduleSideEffects: 'no-external',
      },
    },
    // CSS optimization
    css: {
      devSourcemap: true,
    },
  };
});
