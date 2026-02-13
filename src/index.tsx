// Global styles
import './index.css';
// i18n initialization (side effects)
import './i18n';

import React from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';

function initThemeClass(): void {
  // Initialize theme synchronously before React renders to prevent flicker
  // This reads from localStorage before React hydration
  try {
    const stored = localStorage.getItem('consultinity-storage');
    if (!stored) return;

    const parsed = JSON.parse(stored);
    const theme = parsed?.state?.theme;
    if (!theme) return;

    const root = document.documentElement;
    if (
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    ) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  } catch {
    // Ignore localStorage errors, will be handled by React
  }
}

initThemeClass();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

const root = createRoot(rootElement);

try {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (error) {
  console.error('[index.tsx] Failed to render app:', error);
  rootElement.innerHTML = `
    <div style="padding: 20px; font-family: sans-serif; color: white; background: #1a1a2e;">
      <h1 style="color: #ff6b6b;">Application Error</h1>
      <p>Failed to start the application. Please check the console for details.</p>
      <pre style="background: #0d1117; padding: 10px; border-radius: 4px; overflow: auto; color: #ff6b6b;">${
        error instanceof Error ? error.stack : String(error)
      }</pre>
    </div>
  `;
}

// Register Service Worker (production only)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      // Make sure we check for SW updates on each load.
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
