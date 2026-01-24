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
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(
      (registration) => {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      },
      (err) => {
        console.log('ServiceWorker registration failed: ', err);
      }
    );
  });
}
