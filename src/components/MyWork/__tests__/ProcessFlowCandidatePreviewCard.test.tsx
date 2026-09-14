/**
 * P-T14 (b)+(c) — „Przejrzyj kandydaturę nic nie robi" + „nadmiar UI w Process Flow".
 *
 * Premisa (zmierzona na linii `integracja/20260911`): przycisk MIAŁ realną
 * akcję — `handlePreviewProcessFlowCandidate` w `IdeaMapWorkspace.tsx` woła
 * `Api.previewIdeaProcessFlowCandidate` → `GET /my-work/my-ideas/:id/map/candidate/preview`
 * (trasa istnieje: `server/src/routes/my-work.routes.ts:4719`, więc to nie był
 * fantom flagi). Nic nie działo się WIDOCZNIE: sukces rysował bezimienny blok
 * telemetrii — „3 nodes · 2 edges · v7", surowe etykiety węzłów sklejone
 * strzałkami, nazwy torów i 12 znaków sha256 w `<code>`.
 *
 * Kontrakt naprawy pilnowany tutaj:
 *  1. wynik ma NAZWĘ i zdanie po ludzku (EN+PL) — da się poznać, że coś się stało;
 *  2. surowy `projectionHash` NIE trafia na ekran (zostaje kontraktem `approve`);
 *  3. pusty Process Flow ma jawny komunikat, nie cichy blok zer.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ProcessFlowCandidatePreviewCard } from '../ProcessFlowCandidatePreviewCard';

const PREVIEW = {
  nodeCount: 3,
  edgeCount: 2,
  mapVersion: 7,
  projectionHash: 'a91f3c0b12de4455667788990011223344556677889900aabbccddeeff001122',
};

describe('P-T14(b) ProcessFlowCandidatePreviewCard — klik daje widoczny wynik', () => {
  it('nazywa wynik i opisuje go zdaniem (PL)', () => {
    render(<ProcessFlowCandidatePreviewCard preview={PREVIEW} isPolish onCancel={() => {}} />);
    expect(screen.getByText('Kandydat inicjatywy — podgląd')).toBeTruthy();
    expect(screen.getByTestId('process-flow-candidate-preview-summary').textContent).toContain(
      '3 kroków, 2 połączeń'
    );
  });

  it('nazywa wynik i opisuje go zdaniem (EN)', () => {
    render(
      <ProcessFlowCandidatePreviewCard preview={PREVIEW} isPolish={false} onCancel={() => {}} />
    );
    expect(screen.getByText('Initiative candidate — preview')).toBeTruthy();
    expect(screen.getByTestId('process-flow-candidate-preview-summary').textContent).toContain(
      '3 steps, 2 connections'
    );
  });

  it('nie pokazuje surowego projectionHash ani surowej telemetrii („nodes"/„edges"/„v7")', () => {
    const { container } = render(
      <ProcessFlowCandidatePreviewCard preview={PREVIEW} isPolish={false} onCancel={() => {}} />
    );
    const text = container.textContent || '';
    expect(text).not.toContain('a91f3c0b12de');
    expect(text).not.toContain('nodes ·');
    expect(text).not.toContain('edges');
    expect(container.querySelector('code')).toBeNull();
  });

  it('pusty Process Flow dostaje jawny komunikat, nie cichy blok zer', () => {
    render(
      <ProcessFlowCandidatePreviewCard
        preview={{ nodeCount: 0, edgeCount: 0, mapVersion: 1, projectionHash: 'x' }}
        isPolish
        onCancel={() => {}}
      />
    );
    expect(screen.getByTestId('process-flow-candidate-preview-empty').textContent).toContain(
      'jest pusty'
    );
    expect(screen.queryByTestId('process-flow-candidate-preview-summary')).toBeNull();
  });

  it('„Anuluj" zamyka podgląd', () => {
    const onCancel = vi.fn();
    render(<ProcessFlowCandidatePreviewCard preview={PREVIEW} isPolish onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Anuluj'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
