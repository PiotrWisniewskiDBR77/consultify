/**
 * S4 ISOLATED TEST HARNESS entry — see `s4-teresa-panel.html` header for why
 * this is a separate entry point from `dev-render/main.tsx`'s shared screen
 * registry. Mirrors `mw010-vault-main.tsx`'s minimal bootstrap.
 *
 * URL params: &variant=quality-invalid|voice-draft|voice-degraded
 *             &theme=light|dark (default light)
 */
import '../src/index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';

import i18n from '../src/i18n';
import { useAppStore } from '../src/store/useAppStore';
import S4TeresaPanelScreen from './screens/s4-teresa-panel';

const params = new URLSearchParams(window.location.search);
const theme = params.get('theme') || 'light';

const root = document.documentElement;
root.classList.toggle('dark', theme === 'dark');
useAppStore.setState({ theme: theme === 'dark' ? 'dark' : 'light' } as any);
document.body.style.background = 'var(--c-bg)';

void i18n.changeLanguage('pl');

const mount = document.getElementById('dev-render-root')!;

createRoot(mount).render(
  <React.StrictMode>
    <S4TeresaPanelScreen />
  </React.StrictMode>
);
