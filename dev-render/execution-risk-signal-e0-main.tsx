import '../src/index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';

import ExecutionRiskSignalE0Screen from './screens/execution-risk-signal-e0';

const theme = new URLSearchParams(window.location.search).get('theme');
document.documentElement.classList.toggle('dark', theme === 'dark');

createRoot(document.getElementById('dev-render-root')!).render(
  <React.StrictMode>
    <ExecutionRiskSignalE0Screen />
  </React.StrictMode>
);
