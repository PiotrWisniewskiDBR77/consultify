/**
 * grow-content render harness. Mounts the REAL CardRenderer for one VTS slide.
 * W7 fill-canvas rhythm stays ON in BOTH modes — the ONLY axis is grow-content:
 *   ?mode=before → setGrowContent(false) — W7 rhythm alone (blocks centered but
 *                  rendered at the old small scale: thin KPI chips, 150px chart,
 *                  small hero number)
 *   ?mode=after  → setGrowContent(true)  — dominant blocks grow to fill their
 *                  region (hero metric type, dashboard tiles, tall chart)
 * so the before/after diff isolates the grow-content effect on identical,
 * W7-composed content.
 *   ?slide=<0..6>&mode=before|after
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

import '@/index.css';
import { CardRenderer } from '@/components/Presentations/DeckBuilder/CardRenderer';
import {
  setGrowContent,
  setW7FillCanvas,
} from '@/components/Presentations/DeckBuilder/layouts/LayoutEngine';
import { VTS_CARDS } from '../../w7/fixture.vts';

const params = new URLSearchParams(window.location.search);
const slideIndex = Math.max(0, Math.min(VTS_CARDS.length - 1, Number(params.get('slide') || 0)));
const mode = (params.get('mode') || 'after') === 'before' ? 'before' : 'after';

// W7 rhythm stays ON in both modes; only grow-content toggles.
setW7FillCanvas(true);
setGrowContent(mode === 'after');

const card = VTS_CARDS[slideIndex];

function Stage() {
  return (
    <div
      className="slide-frame"
      style={{
        width: 1280,
        height: 720,
        background: '#ffffff',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div style={{ width: 1280, height: 720 }}>
        <CardRenderer card={card} colorSetId={undefined} isActive={false} animationsEnabled={false} />
      </div>
    </div>
  );
}

const el = document.getElementById('root')!;
createRoot(el).render(
  <MemoryRouter>
    <Stage />
  </MemoryRouter>
);

// Signal readiness for Playwright (fonts + layout settled).
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    (window as unknown as { __GROW_READY?: boolean }).__GROW_READY = true;
  });
});
