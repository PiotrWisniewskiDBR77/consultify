/**
 * STEP 1b render harness entry. Mounts the REAL CardRenderer (the shipped deck
 * render stack) for one VTS slide at a time, in BEFORE (composition stripped →
 * heuristic) or AFTER (composition honoured) mode. Playwright drives it via URL:
 *   ?slide=<0..6>&mode=before|after
 * The rendered .slide-frame is a fixed 1280×720 16:9 stage for a clean screenshot.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

import '@/index.css';
import { CardRenderer } from '@/components/Presentations/DeckBuilder/CardRenderer';
import { VTS_CARDS } from '../fixture.vts';

const params = new URLSearchParams(window.location.search);
const slideIndex = Math.max(0, Math.min(VTS_CARDS.length - 1, Number(params.get('slide') || 0)));
const mode = (params.get('mode') || 'after') === 'before' ? 'before' : 'after';

const base = VTS_CARDS[slideIndex];
const card =
  mode === 'before' ? { ...base, composition: null, layout_id: 'auto' } : base;

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
    (window as unknown as { __STEP1B_READY?: boolean }).__STEP1B_READY = true;
  });
});
