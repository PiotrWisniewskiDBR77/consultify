/**
 * DEDYKOWANE wejście harnessu dla materials-registry (materials-registry-fix,
 * 2026-08-25). Ten sam powód co tool-outputs-panel-main.tsx: NIE korzysta z
 * dev-render/main.tsx (współdzielony plik z zastanym, niezwiązanym defektem
 * importu) — własne wejście, żeby zrzut powstał ZANIM Piotr zobaczy ekran
 * (CLAUDE.md #7).
 *
 * URL: /materials-registry.html?theme=light|dark
 */
import '../src/index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';

import MaterialsRegistryScreen from './screens/materials-registry';

const el = document.getElementById('root');
if (el) {
  createRoot(el).render(
    <React.StrictMode>
      <MaterialsRegistryScreen />
    </React.StrictMode>
  );
}
