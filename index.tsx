import React from 'react';
import './index.css';
import './i18n'; // Init i18n
import { createRoot } from 'react-dom/client';
import { App } from './App';

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
