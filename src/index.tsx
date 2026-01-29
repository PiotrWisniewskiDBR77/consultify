import './index.css';
import './i18n.ts'; // Init i18n

import React from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';

// Vite React Refresh fallback (prevents HMR preamble runtime errors)
if (import.meta.hot && typeof window !== 'undefined') {
  const win = window as unknown as {
    $RefreshReg$?: () => void;
    $RefreshSig$?: () => (type: unknown) => unknown;
  };
  if (!win.$RefreshReg$) {
    win.$RefreshReg$ = () => {};
  }
  if (!win.$RefreshSig$) {
    win.$RefreshSig$ = () => (type: unknown) => type;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

// Initialize theme synchronously before React renders to prevent flicker
// This reads from localStorage before React hydration
try {
  const stored = localStorage.getItem('consultinity-storage');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      const theme = parsed?.state?.theme;
      if (theme) {
        const root = document.documentElement;
        if (
          theme === 'dark' ||
          (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
        ) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      }
    } catch {
      // Ignore parsing errors, will be handled by React
    }
  }
} catch {
  // Ignore localStorage errors, will be handled by React
}

const root = createRoot(rootElement);

// Add error boundary for render errors
try {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (error) {
  console.error('[index.tsx] Failed to render app:', error);
  rootElement.innerHTML = `
        <div style="padding: 20px; font-family: sans-serif;">
            <h1>Application Error</h1>
            <p>Failed to start the application. Please check the console for details.</p>
            <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; overflow: auto;">${error instanceof Error ? error.stack : String(error)}</pre>
        </div>
    `;
}

// Register Service Worker
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      // Make sure we check for SW updates on each load (production only).
      void registration.update();

      // If a new SW takes control, reload to pick up the new index.html/assets.
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });

      console.log('ServiceWorker registration successful with scope: ', registration.scope);
    } catch (err) {
      console.log('ServiceWorker registration failed: ', err);
    }
  });
}
