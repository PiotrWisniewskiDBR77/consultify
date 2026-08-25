/**
 * @vitest-environment jsdom
 *
 * DEC-2026-08-25-53 — Interview Initiatives preview (single-click preview
 * pane, "Inicjatywy" tab) was rebuilt onto the shared PreviewPane building
 * blocks per TABLE_AND_PREVIEW_CANON.md §7.3. Before this it hand-rolled its
 * own meta row and a Details block with NO local kebab at all (block 3
 * "kebab lokalny" is a MUST) — the exact violation the owner flagged.
 *
 * This test locks in:
 *  - the Body uses the shared PreviewMetaCard / PreviewDetailsSection /
 *    EntityStatusChip / PriorityChip components (source-level, mirrors the
 *    existing InterviewPreviewFooter.ownerContract.test.ts pattern),
 *  - the Details block always renders its local kebab (⋮) with the
 *    Rozwiń/Zwiń · Kopiuj · Kopiuj ID actions, even when the description is
 *    empty,
 *  - the draft banner ("stays in Interview until handed off", §7.1) only
 *    shows for non-promoted items,
 *  - the "Otwórz dokument inicjatywy" footer pill label stays short enough
 *    to not regress into the 3-line clipping bug found in browser evidence
 *    (INT-C05-A, docs/program/waves/WAVE_03_ACCEPTANCE/evidence/
 *    exact-sha-0050bad8-2026-08-25/interview/EVIDENCE_INDEX.md).
 */

import { fireEvent, render, screen } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import enTranslation from '../../../../public/locales/en/translation.json';
import plTranslation from '../../../../public/locales/pl/translation.json';
import { InterviewInitiativePreviewBody } from '../InterviewInitiativePreview';

const readSource = () =>
  fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/Interview/InterviewInitiativePreview.tsx'),
    'utf8'
  );

describe('InterviewInitiativePreviewBody — canon §7.3 (DEC-2026-08-25-53)', () => {
  it('renders through the shared PreviewMetaCard/PreviewDetailsSection blocks, not bespoke markup', () => {
    const source = readSource();
    const body = source.slice(
      source.indexOf('export const InterviewInitiativePreviewBody'),
      source.indexOf('export interface InterviewInitiativePreviewFooterProps')
    );
    expect(body).toContain('<PreviewMetaCard');
    expect(body).toContain('<PreviewDetailsSection');
    expect(body).toContain('<EntityStatusChip');
    // Details MUST always carry the local kebab (§7.3 pkt 3) — customActions
    // must not be conditional on description being non-empty.
    expect(body).toContain('customActions={customActions}');
  });

  it('renders the status chip, meta pills and a local Details kebab with all three actions', () => {
    render(
      <InterviewInitiativePreviewBody
        initiative={{ id: 'init-1', status: 'DRAFT', priority: 'medium', description: '' }}
        statusLabel="Szkic"
        priorityLevel="medium"
        hasSourceInsight
        dateStr="25.08.2026"
        promoted={false}
        isPolish
        detailsExpanded={false}
        onToggleDetailsExpanded={vi.fn()}
        onCopyDetails={vi.fn()}
        onCopyId={vi.fn()}
      />
    );

    expect(screen.getByText('Szkic')).toBeInTheDocument();
    expect(screen.getByText('Insight')).toBeInTheDocument();
    expect(screen.getByText('25.08.2026')).toBeInTheDocument();

    // Details kebab — present even though description is empty.
    const kebab = screen.getByRole('button', {
      name: 'sharedComponents.previewDetailsSection.detailsOptions',
    });
    fireEvent.click(kebab);

    expect(screen.getByText('interview.initiativePreview.expand')).toBeInTheDocument();
    expect(screen.getByText('interview.initiativePreview.copyDetails')).toBeInTheDocument();
    expect(screen.getByText('interview.initiativePreview.copyId')).toBeInTheDocument();

    // §7.1 draft note — draft stays in Interview until promoted.
    expect(screen.getByText('interview.hub.draftStaysInInterviewUntil')).toBeInTheDocument();
  });

  it('hides the draft note once the initiative is promoted', () => {
    render(
      <InterviewInitiativePreviewBody
        initiative={{ id: 'init-2', status: 'REVIEW', description: 'Some content here.' }}
        statusLabel="Przekazane dalej"
        hasSourceInsight={false}
        dateStr="25.08.2026"
        promoted
        isPolish
        detailsExpanded={false}
        onToggleDetailsExpanded={vi.fn()}
        onCopyDetails={vi.fn()}
        onCopyId={vi.fn()}
      />
    );

    expect(
      screen.queryByText('interview.hub.draftStaysInInterviewUntil')
    ).not.toBeInTheDocument();
    // No source insight → no "Insight" badge.
    expect(screen.queryByText('Insight')).not.toBeInTheDocument();
  });

  it('copy-details action is disabled when there is no description to copy', () => {
    render(
      <InterviewInitiativePreviewBody
        initiative={{ id: 'init-3', status: 'DRAFT', description: '' }}
        statusLabel="Szkic"
        hasSourceInsight={false}
        dateStr="—"
        promoted={false}
        isPolish
        detailsExpanded={false}
        onToggleDetailsExpanded={vi.fn()}
        onCopyDetails={vi.fn()}
        onCopyId={vi.fn()}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'sharedComponents.previewDetailsSection.detailsOptions' })
    );
    expect(
      screen.getByText('interview.initiativePreview.copyDetails').closest('button')
    ).toBeDisabled();
  });
});

describe('Interview Initiatives footer pill label — regression guard for INT-C05-A', () => {
  // The evidence run (2026-08-25) showed "Otwórz dokument inicjatywy" wrapping
  // to 3 lines inside the h-9 action pill and getting clipped by the panel
  // edge. Keep both locales short enough to stay within 2 lines in the
  // clamp(340px, 28%, 480px) two-column action grid.
  const MAX_LABEL_LENGTH = 20;

  it.each([
    ['pl', plTranslation],
    ['en', enTranslation],
  ] as const)('%s label fits without triggering the 3-line pill clip', (_lang, dict) => {
    const label = dict.interview.initiativePreview.openInitiativeDocument as string;
    expect(label.length).toBeLessThanOrEqual(MAX_LABEL_LENGTH);
  });
});
