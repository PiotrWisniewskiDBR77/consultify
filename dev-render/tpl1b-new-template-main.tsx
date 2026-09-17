import '../src/index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';

import { GovernedTemplateBuilderFlow } from '../src/components/TemplateBuilder';
import i18n from '../src/i18n';

const params = new URLSearchParams(window.location.search);
const theme = params.get('theme') === 'dark' ? 'dark' : 'light';
document.documentElement.classList.toggle('dark', theme === 'dark');
void i18n.changeLanguage('en');

const originalFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.startsWith('/api/deliverables/templates?')) {
    return new Response(JSON.stringify({ templates: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return originalFetch(input, init);
};

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nextProvider i18n={i18n}>
      <GovernedTemplateBuilderFlow onClose={() => undefined} />
    </I18nextProvider>
  </React.StrictMode>
);
