import './index.css';
import './i18n'; // Init i18n

import React from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';

const root = createRoot(document.getElementById('root')!);
root.render(<App />);

// Register Service Worker
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(
            (registration) => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            },
            (err) => {
                console.log('ServiceWorker registration failed: ', err);
            },
        );
    });
}
