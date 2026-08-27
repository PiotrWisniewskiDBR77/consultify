import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const dotenvDisabled = process.env.VITE_DOTENV_DISABLED === '1';
  const env = dotenvDisabled ? {} : loadEnv(mode, '.', '');
  const apiTarget = env.VITE_API_TARGET || process.env.VITE_API_TARGET || 'http://127.0.0.1:3001';
  const stableDev = env.VITE_STABLE_DEV === '1' || process.env.VITE_STABLE_DEV === '1';

  // ---------------------------------------------------------------------------
  // BEZPIECZNIK: VITE_QUICK_ACCESS_MAP nie może nigdy trafić do buildu
  // produkcyjnego (2026-08-28).
  //
  // `vite build` wstawia CAŁY obiekt `import.meta.env` w każde miejsce jego
  // użycia — więc jeśli ta zmienna (mapa PIN → e-mail+hasło kont
  // właściciela/Pawła/superadmina) jest ustawiona, ląduje w bundlu JS
  // pobieranym przez przeglądarkę, w wielu chunkach niezwiązanych z
  // logowaniem. Filtr hostowy w runtime (np. isQuickAccessShortcutHost) NIE
  // chroni — build już się wydarzył, sekret jest w plikach na serwerze
  // statycznym.
  //
  // Na tej gałęzi VITE_QUICK_ACCESS_MAP nie jest dziś nigdzie w kodzie
  // używana (kody PIN w src/views/AuthView.tsx są na razie wpisane wprost
  // w źródle — osobny, równolegle prowadzony wątek bezpieczeństwa
  // przenosi je na endpoint serwerowy). Ta bramka jest zabezpieczeniem
  // wyprzedzającym: gdyby ta zmienna trafiła tu przez merge z innej gałęzi
  // albo wróciła w przyszłości, build produkcyjny PADA zamiast po cichu
  // wkleić sekret do bundla — zamiast polegać wyłącznie na komentarzu w
  // pliku `.env.example`, który sam w sobie niczego nie blokuje.
  //
  // Nie dodawaj tu wyjątków ani nie usuwaj tego bloku, żeby "odblokować"
  // wdrożenie — usuń/wyczyść zmienną VITE_QUICK_ACCESS_MAP w Railway zamiast
  // tego.
  if (mode === 'production') {
    const quickAccessMap = (env.VITE_QUICK_ACCESS_MAP ?? process.env.VITE_QUICK_ACCESS_MAP ?? '').trim();
    if (quickAccessMap.length > 0) {
      throw new Error(
        'VITE_QUICK_ACCESS_MAP is set for a production build. This variable carries a PIN -> ' +
          'credential map and must never be baked into a browser-downloadable bundle via Vite. ' +
          'Unset VITE_QUICK_ACCESS_MAP for this build (Railway service variable) and retry.'
      );
    }
  }

  const watchIgnored = [
    '**/coverage/**',
    '**/playwright-report/**',
    '**/test-results/**',
    '**/dist/**',
    '**/data/**',
    '**/Blogs/**',
    '**/server/public/**',
    // Codex/Cursor scratch worktrees can churn (tsconfig changes) and cause reload loops
    '**/.codex-worktrees/**',
    /\/\.codex-worktrees\//,
    // Temporary runtime caches (e.g. e2e node compile cache)
    '**/.tmp/**',
    /\/\.tmp\//,
    '**/.cursor/**',
    '**/agent-transcripts/**',
    // macOS Finder/iCloud duplicate naming patterns (project contains many "... 2.ts", "... 13.tsx", etc.)
    '**/* [0-9]*.*',
    '**/* copy.*',
    // Common macOS metadata files
    '**/.DS_Store',
    '**/._*',
    '**/*.icloud',
  ];

  return {
    envDir: dotenvDisabled ? false : '.',
    plugins: [react()],
    server: {
      port: 3000,
      host: '0.0.0.0',
      warmup: {
        // Dev perf: pre-transform the hottest entry + a few main routes
        // to reduce "waterfall" latency when navigating between modules.
        clientFiles: [
          './index.html',
          './src/index.tsx',
          './src/App.tsx',
          './src/routes/AppRoutes.tsx',
          './src/views/MyWorkView.tsx',
          './src/components/Interview/InterviewHub.tsx',
        ],
      },
      watch: stableDev
        ? {
            // Stable mode: ignore ALL source files so Vite never triggers page reloads
            // while another agent or IDE auto-save modifies files.
            ignored: ['**/*'],
          }
        : {
            ignored: watchIgnored,
            awaitWriteFinish: {
              stabilityThreshold: 200,
              pollInterval: 100,
            },
          },
      hmr: stableDev ? false : undefined,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
        '/ws': {
          target: apiTarget,
          ws: true,
          changeOrigin: true,
          secure: false,
        },
        '/uploads': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
        '/kb': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    preview: {
      // Allow running a production-like frontend on :3000
      // while proxying API calls to the dev backend on :3001.
      port: 3000,
      strictPort: true,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
        '/ws': {
          target: apiTarget,
          ws: true,
          changeOrigin: true,
          secure: false,
        },
        '/uploads': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
        '/kb': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.NEXT_PUBLIC_GEMINI_API_KEY': JSON.stringify(
        env.NEXT_PUBLIC_GEMINI_API_KEY || env.GEMINI_API_KEY
      ),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        react: path.resolve(__dirname, './node_modules/react'),
        'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
        'react/jsx-runtime': path.resolve(__dirname, './node_modules/react/jsx-runtime.js'),
        'react/jsx-dev-runtime': path.resolve(__dirname, './node_modules/react/jsx-dev-runtime.js'),
        '@fullcalendar/core': path.resolve(__dirname, './node_modules/@fullcalendar/core'),
        '@fullcalendar/react': path.resolve(__dirname, './node_modules/@fullcalendar/react'),
        '@fullcalendar/daygrid': path.resolve(__dirname, './node_modules/@fullcalendar/daygrid'),
        '@fullcalendar/timegrid': path.resolve(__dirname, './node_modules/@fullcalendar/timegrid'),
        '@fullcalendar/list': path.resolve(__dirname, './node_modules/@fullcalendar/list'),
        // The bare '@tiptap/react' alias below is a prefix-match that rewrites
        // subpath imports (e.g. '@tiptap/react/menus') to <dir>/menus, bypassing
        // the package's exports map → ENOENT at build. Map the subpath explicitly
        // FIRST (vite matches aliases in order) so BubbleMenu/FloatingMenu resolve.
        '@tiptap/react/menus': path.resolve(
          __dirname,
          './node_modules/@tiptap/react/dist/menus/index.js'
        ),
        '@tiptap/react': path.resolve(__dirname, './node_modules/@tiptap/react'),
        // Force a complete lodash-es package (some nested deps ship an incomplete copy)
        'lodash-es': path.resolve(__dirname, './node_modules/lodash-es'),
      },
      dedupe: [
        'react',
        'react-dom',
        '@fullcalendar/core',
        '@fullcalendar/react',
        '@fullcalendar/daygrid',
        '@fullcalendar/timegrid',
        '@fullcalendar/list',
      ],
    },
    optimizeDeps: {
      // Keep dependency pre-bundling focused on real app entrypoints.
      // A broad glob like `src/**/*.{ts,tsx}` can accidentally pull in vitest files
      // (which may import server-only code) and break the dev server.
      entries: ['index.html', 'src/index.tsx', 'src/App.tsx', 'src/routes/AppRoutes.tsx'],
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
        'use-sync-external-store/with-selector',
        // Ensure react-is matches React 19 version
        'react-is',
        // Prebundle recharts to avoid lodash CJS/ESM import issues
        'recharts',
        // DnD kit — used by MyWork kanban boards; prebundle to avoid 504 on lazy navigation
        '@dnd-kit/core',
        '@dnd-kit/sortable',
        '@dnd-kit/utilities',
        // TipTap editor — used by notebook/task detail views
        '@tiptap/react',
        '@tiptap/starter-kit',
        '@tiptap/extension-placeholder',
        '@tiptap/extension-task-item',
        '@tiptap/extension-task-list',
        // i18n
        'react-i18next',
        'i18next',
        // React Query
        '@tanstack/react-query',
        // Axios
        'axios',
        // PDF / screenshot capture (used by export utilities)
        'html2canvas',
      ],
      exclude: [
        // Large libs that should be lazy loaded
        'mermaid',
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
          // manualChunks disabled — let Rollup use automatic splitting.
          // Staging/CI build: reduces cross-chunk complexity and OOM risk.
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
      // Sourcemaps in dev can add noticeable overhead in very large apps.
      // Keep them on normally, but disable in "stable dev" mode.
      devSourcemap: stableDev ? false : true,
    },
  };
});
