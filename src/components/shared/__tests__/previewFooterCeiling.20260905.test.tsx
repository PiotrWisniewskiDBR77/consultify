/**
 * SUFIT STOPKI PODGLĄDU — zgłoszenie właściciela „preview z tej tabeli nie jest
 * zgodny ze wzorem" (Moja Praca → Pomysły → Tabela → klik w wiersz), trzeci raz.
 *
 * POMIAR NA ŻYWO (1440×900, jasny, `/my-work` → Pomysły → klik w wiersz):
 *   panel 728 px = nagłówek 64 + treść 138 + stopka 500 (69 % panelu).
 * Blok „Szczegóły" ma własną wysokość 264 px, więc w treści zostawał z niego
 * pasek ~70 px: na zrzucie widać nagłówek tabeli właściwości uciety w połowie,
 * bez ani jednego wiersza danych. `CANON_PREVIEW_BLOCK_HEIGHT.detailsMin` = 200
 * px jest twardą dolną granicą tego bloku — 70 < 200, naruszenie arytmetyczne.
 *
 * PO NAPRAWIE (ten sam pomiar): treść 322 px, stopka 316 px.
 *
 * DOWÓD MUTACYJNY: usuń `style={{ maxHeight: PREVIEW_FOOTER_MAX_HEIGHT }}` albo
 * `overflow-y-auto` ze stopki `PreviewPaneShell` — testy „stopka ma sufit"
 * i „sufit zostawia treści kanoniczne minimum" padają.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { PreviewPaneShell } from '@/components/ui/ResizableTable/PreviewPaneShell';
import { CANON_PREVIEW, CANON_PREVIEW_BLOCK_HEIGHT } from '@/contracts/tableSurface/canon';

import {
  PREVIEW_BODY_MIN_PX,
  PREVIEW_FOOTER_MAX_HEIGHT,
  PREVIEW_FOOTER_MIN_PX,
  PREVIEW_HEADER_MIN_PX,
} from '../PreviewPane/previewGeometry';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, fallback?: string) => fallback ?? _k,
    i18n: { language: 'pl' },
  }),
}));

describe('podgląd — sufit stopki (kanon §7.3 pkt 3, detailsMin)', () => {
  it('minimum treści jest ZŁOŻONE z kanonu, nie wpisane liczbą', () => {
    expect(PREVIEW_BODY_MIN_PX).toBe(
      CANON_PREVIEW_BLOCK_HEIGHT.meta +
        CANON_PREVIEW_BLOCK_HEIGHT.detailsMin +
        2 * CANON_PREVIEW.wrapperPadding +
        CANON_PREVIEW.cardGap
    );
    // Blok „Szczegóły" musi się zmieścić w tym, co zostaje treści.
    expect(PREVIEW_BODY_MIN_PX).toBeGreaterThanOrEqual(CANON_PREVIEW_BLOCK_HEIGHT.detailsMin);
  });

  it('sufit odejmuje od panelu nagłówek + kanoniczne minimum treści', () => {
    expect(PREVIEW_FOOTER_MAX_HEIGHT).toBe(
      `max(${PREVIEW_FOOTER_MIN_PX}px, calc(100% - ${
        PREVIEW_HEADER_MIN_PX + PREVIEW_BODY_MIN_PX
      }px))`
    );
  });

  it('stopka ma sufit i własne przewijanie (a treść zostaje `flex-1`)', () => {
    render(
      <PreviewPaneShell title="Pomysł" footer={<div>stopka</div>}>
        <div>treść</div>
      </PreviewPaneShell>
    );
    const stopka = document.querySelector('[data-preview-block="footer"]') as HTMLElement;
    expect(stopka).toBeTruthy();
    expect(stopka.style.maxHeight).toBe(PREVIEW_FOOTER_MAX_HEIGHT);
    expect(stopka.className).toContain('overflow-y-auto');
    expect(screen.getByText('stopka')).toBeInTheDocument();
    expect(screen.getByText('treść')).toBeInTheDocument();
  });

  it('bez stopki nic się nie zmienia — brak pustego boksu', () => {
    render(
      <PreviewPaneShell title="Pomysł">
        <div>treść</div>
      </PreviewPaneShell>
    );
    expect(document.querySelector('[data-preview-block="footer"]')).toBeNull();
  });
});
