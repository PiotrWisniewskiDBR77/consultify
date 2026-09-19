import '../src/index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';

import i18n from '../src/i18n';
import { useAppStore } from '../src/store/useAppStore';
import ExecutionReportDay11Screen from './screens/execution-report-day11';

const language = new URLSearchParams(window.location.search).get('lang') || 'en';
const theme =
  new URLSearchParams(window.location.search).get('theme') === 'dark' ? 'dark' : 'light';
useAppStore.setState({ theme });
void i18n.changeLanguage(language);

createRoot(document.getElementById('dev-render-root')!).render(
  <React.StrictMode>
    <ExecutionReportDay11Screen />
  </React.StrictMode>
);
