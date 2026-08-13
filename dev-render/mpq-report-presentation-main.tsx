/**
 * CEL 8 / MPQ ISOLATED TEST HARNESS entry — see
 * `mpq-report-presentation.html` header. Mirrors `s4-teresa-panel-main.tsx`.
 *
 * URL params: &surface=report|presentation &theme=light|dark (default light)
 */
import '../src/index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';

import i18n from '../src/i18n';
import { useAppStore } from '../src/store/useAppStore';
import MpqReportPresentationScreen from './screens/mpq-report-presentation';

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
    <MpqReportPresentationScreen />
  </React.StrictMode>
);
