/**
 * Harness: Dynamic SWOT — LIVE Artifact (S2 sprint).
 *
 * Mounts the REAL component (`SwotLiveArtifact`) over a realistic, fully
 * fictional demo session — no login, no backend, no store wiring. Exists so
 * the session supervisor can screenshot the artifact BEFORE the owner sees
 * it (CLAUDE.md #7).
 *
 * URL: /tools-swot-live.html?theme=light|dark
 */
import React from 'react';

import { SwotLiveArtifact } from '@/components/DiscoveryTools/live/SwotLiveArtifact';
import type { SWOTItem } from '@/store/useToolStore';

const DEMO_ITEMS: SWOTItem[] = [
  {
    id: 'i1',
    text: 'Zespół wdrożeniowy z 40 zamkniętymi projektami',
    impact: 'high',
    quadrant: 'strengths',
    proposalStatus: 'accepted',
    evidenceStatus: 'confirmed',
  },
  {
    id: 'i2',
    text: 'Certyfikacja ISO 27001 od 2023',
    impact: 'medium',
    quadrant: 'strengths',
    proposalStatus: 'accepted',
    evidenceStatus: 'confirmed',
  },
  {
    id: 'i3',
    text: 'Czas wdrożenia 2× dłuższy niż u konkurencji',
    impact: 'high',
    quadrant: 'weaknesses',
    proposalStatus: 'accepted',
    evidenceStatus: 'confirmed',
  },
  {
    id: 'i4',
    text: 'Brak lokalnego zespołu wsparcia w DACH',
    impact: 'medium',
    quadrant: 'weaknesses',
    proposalStatus: 'accepted',
    evidenceStatus: 'declared',
  },
  {
    id: 'i5',
    text: 'Popyt w DACH rośnie trzeci kwartał z rzędu',
    impact: 'high',
    quadrant: 'opportunities',
    proposalStatus: 'accepted',
    evidenceStatus: 'declared',
  },
  {
    id: 'i6',
    text: 'Program dotacji na cyfryzację MŚP w 2026',
    impact: 'medium',
    quadrant: 'opportunities',
    proposalStatus: 'accepted',
  },
  {
    id: 'i7',
    text: 'Konkurent obniżył cenę wejścia o 30%',
    impact: 'medium',
    quadrant: 'threats',
    proposalStatus: 'accepted',
    evidenceStatus: 'confirmed',
  },
  {
    id: 'i8',
    text: 'Nowy gracz z USA zapowiedział wejście na rynek PL',
    impact: 'high',
    quadrant: 'threats',
    proposalStatus: 'accepted',
    evidenceStatus: 'declared',
  },
  // Nie zaakceptowane — muszą zostać POZA polem i poza Outputem.
  {
    id: 'i9',
    text: 'Hipoteza: klienci chcą modelu subskrypcyjnego',
    impact: 'low',
    quadrant: 'opportunities',
    proposalStatus: 'ai-proposed',
  },
  {
    id: 'i10',
    text: 'AI sugeruje: rozważ akwizycję lokalnego butiku',
    impact: 'medium',
    quadrant: 'threats',
    proposalStatus: 'rethinking',
  },
] as SWOTItem[];

export default function ToolsSwotLiveScreen() {
  return (
    <div className="min-h-screen bg-c-bg p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-c-text-muted">
            Dynamic SWOT · Live Artifact
          </div>
          <h1 className="mt-1 text-xl font-semibold text-c-text">
            Wejście na rynek DACH — pole na żywo
          </h1>
        </div>
        <SwotLiveArtifact items={DEMO_ITEMS} />
      </div>
    </div>
  );
}
