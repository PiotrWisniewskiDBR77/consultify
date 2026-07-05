/**
 * W7 fill-canvas render harness entry. Mounts the REAL CardRenderer for one VTS
 * slide, with B1's composition PRESENT in BOTH modes (unlike step1b). The only
 * axis is W7 itself:
 *   ?mode=before → setW7FillCanvas(false) — today's top-glued render (dead bottom)
 *   ?mode=after  → setW7FillCanvas(true)  — W7 vertical rhythm (canvas filled)
 * so the before/after diff isolates the W7 fill-canvas + guard-split effect on
 * identical, composition-steered content.
 *   ?slide=<0..6>&mode=before|after
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

import '@/index.css';
import { CardRenderer } from '@/components/Presentations/DeckBuilder/CardRenderer';
import { setW7FillCanvas } from '@/components/Presentations/DeckBuilder/layouts/LayoutEngine';
import { VTS_CARDS } from '../fixture.vts';

const params = new URLSearchParams(window.location.search);
const slideIndex = Math.max(0, Math.min(VTS_CARDS.length - 1, Number(params.get('slide') || 0)));
const mode = (params.get('mode') || 'after') === 'before' ? 'before' : 'after';

// W7 axis: composition stays present; only fill-canvas toggles.
setW7FillCanvas(mode === 'after');

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
    (window as unknown as { __W7_READY?: boolean }).__W7_READY = true;
  });
});
