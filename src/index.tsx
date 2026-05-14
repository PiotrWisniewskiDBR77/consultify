// Global styles
import './index.css';
// i18n initialization (side effects)
import './i18n';

import React from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import { bootstrapClientWebVitals } from './bootstrap/clientWebVitals';
import { installDocumentLifecycleWebPerf } from './bootstrap/documentLifecycleWebPerf';
import { handleReactRecoverableError } from './bootstrap/reactRecoverableTelemetry';
import { installFeedbackCollector } from './services/feedbackCollector';

try {
  installFeedbackCollector({
    appEnv:
      (import.meta as { env?: Record<string, string> }).env?.VITE_APP_ENV ||
      (import.meta as { env?: Record<string, string> }).env?.MODE ||
      null,
    attachGlobalErrorHandlers: true,
  });
} catch (collectorError) {
  console.warn('[index.tsx] Feedback collector bootstrap failed:', collectorError);
}

bootstrapClientWebVitals();
installDocumentLifecycleWebPerf();

function initThemeClass(): void {
  // Initialize theme synchronously before React renders to prevent flicker
  // This reads from localStorage before React hydration
  try {
    const stored = localStorage.getItem('consultify-storage');
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

const root = createRoot(rootElement, {
  onRecoverableError: handleReactRecoverableError,
});

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
