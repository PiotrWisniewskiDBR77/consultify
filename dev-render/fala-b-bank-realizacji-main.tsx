import '../src/index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';

import FalaBBankRealizacjiScreen from './screens/fala-b-bank-realizacji';

const theme = new URLSearchParams(window.location.search).get('theme');
document.documentElement.classList.toggle('dark', theme === 'dark');

createRoot(document.getElementById('dev-render-root')!).render(
  <React.StrictMode>
    <FalaBBankRealizacjiScreen />
  </React.StrictMode>
);
