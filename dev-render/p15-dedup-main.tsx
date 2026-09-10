/**
 * DEDYKOWANE wejście harnessu dla P15 (dedup po tożsamości, nie po nazwie).
 * Wzór: dev-render/materials-registry-main.tsx — własne wejście, żeby nie
 * ciągnąć zastanych defektów importu z dev-render/main.tsx.
 *
 * URL: /p15-dedup.html?theme=light|dark&stan=przed|po
 */
import '../src/index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';

import P15DedupDokumentyScreen from './screens/p15-dedup-dokumenty';

const el = document.getElementById('root');
if (el) {
  createRoot(el).render(
    <React.StrictMode>
      <P15DedupDokumentyScreen />
    </React.StrictMode>
  );
}
