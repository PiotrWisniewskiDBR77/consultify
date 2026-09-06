// Global styles
import './index.css';
// i18n initialization (side effects)
import './i18n';

import React from 'react';
import { createRoot } from 'react-dom/client';

import { bootstrapClientWebVitals } from './bootstrap/clientWebVitals';
import { installDocumentLifecycleWebPerf } from './bootstrap/documentLifecycleWebPerf';
import { RuntimeDiagnosticPanel } from './components/RuntimeDiagnosticPanel';
import { installCsrfFetchInterceptor } from './services/csrfClient';
import { installFeedbackCollector } from './services/feedbackCollector';
import { getRuntimeDiagnosticMode, logRuntimeDiagnosticMarker } from './utils/runtimeDiagnostics';

declare global {
  interface Window {
    __consultifyBlockAppBoot?: boolean;
  }
}

try {
  installFeedbackCollector({
    appEnv:
      (import.meta.env as Record<string, string>)?.VITE_APP_ENV ||
      (import.meta.env as Record<string, string>)?.MODE ||
      null,
    attachGlobalErrorHandlers: true,
  });
} catch (collectorError) {
  console.warn('[index.tsx] Feedback collector bootstrap failed:', collectorError);
}

// CSRF Faza 1 (evidence/sec-20260905/04_CSRF_FAZA1_RAPORT.md): no-op on the
// wire unless the server has CSRF_MODE=report|enforce, but installed
// unconditionally so the header is already flowing once the server flag
// flips — no separate frontend deploy needed for Faza 2/3.
try {
  installCsrfFetchInterceptor();
} catch (csrfInterceptorError) {
  console.warn('[index.tsx] CSRF fetch interceptor bootstrap failed:', csrfInterceptorError);
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

const diagnosticMode = getRuntimeDiagnosticMode();
if (window.__consultifyBlockAppBoot) {
  logRuntimeDiagnosticMarker('app_boot_blocked_by_cache_reset', {
    pathname: window.location.pathname,
    search: window.location.search,
  });
  rootElement.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#020617;color:#e2e8f0;font-family:Inter,system-ui,sans-serif;padding:24px;">
        <main style="max-width:720px;border:1px solid rgba(148,163,184,.28);border-radius:24px;padding:24px;background:rgba(15,23,42,.86);box-shadow:0 24px 80px rgba(15,23,42,.48);">
          <p style="margin:0 0 8px;color:#38bdf8;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;">Consultify Runtime Diagnostic</p>
          <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;">App boot paused for cache reset</h1>
          <p style="margin:0;color:#cbd5e1;line-height:1.6;">The browser is clearing stale service worker and cache state before React providers mount.</p>
        </main>
      </div>
    `;
} else if (diagnosticMode === 'boot') {
  logRuntimeDiagnosticMarker('boot_screen_only', {
    pathname: window.location.pathname,
    search: window.location.search,
  });
  rootElement.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#020617;color:#e2e8f0;font-family:Inter,system-ui,sans-serif;padding:24px;">
        <main style="max-width:720px;border:1px solid rgba(148,163,184,.28);border-radius:24px;padding:24px;background:rgba(15,23,42,.86);box-shadow:0 24px 80px rgba(15,23,42,.48);">
          <p style="margin:0 0 8px;color:#38bdf8;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;">Consultify Runtime Diagnostic</p>
          <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;">Boot screen loaded before React providers</h1>
          <p style="margin:0 0 16px;color:#cbd5e1;line-height:1.6;">The application bundle executed, but React was intentionally not mounted. Use this mode to confirm whether renderer crashes happen before or after AppProviders.</p>
          <code style="display:block;border-radius:12px;background:#0f172a;padding:12px;color:#bae6fd;">?diag=boot</code>
        </main>
      </div>
    `;
} else {
  const root = createRoot(rootElement);

  const bootReactApp = async () => {
    if (diagnosticMode === 'min-react') {
      logRuntimeDiagnosticMarker('min_react_mount', {
        pathname: window.location.pathname,
        search: window.location.search,
      });
      root.render(
        <React.StrictMode>
          <RuntimeDiagnosticPanel
            mode="min-react"
            title="Minimal React root mounted"
            description="React createRoot and render completed without AppProviders, RouterSync, auth verification, or app shell."
          />
        </React.StrictMode>
      );
    } else if (diagnosticMode === 'providers-only') {
      const { AppProviders } = await import('./providers/AppProviders');
      logRuntimeDiagnosticMarker('providers_only_mount', {
        pathname: window.location.pathname,
        search: window.location.search,
      });
      root.render(
        <React.StrictMode>
          <AppProviders>
            <RuntimeDiagnosticPanel
              mode="providers-only"
              title="AppProviders mounted without AppContent"
              description="Provider tree mounted without RouterSync, auth verification, route rendering, or Canvas components."
            />
          </AppProviders>
        </React.StrictMode>
      );
    } else {
      const { default: App } = await import('./App');
      root.render(
        <React.StrictMode>
          <App />
        </React.StrictMode>
      );
    }
  };

  bootReactApp().catch((error) => {
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
  });
}
