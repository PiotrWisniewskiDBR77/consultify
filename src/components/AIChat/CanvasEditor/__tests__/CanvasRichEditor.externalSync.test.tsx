/**
 * A1 (audyt P1-1): zewnętrzna synchronizacja `contentMd` w CanvasRichEditor.
 *
 * Repro buga „szkielet nie podmienia się na finalną treść po generacji"
 * (i cichego no-op canvas-streamingu): rodzic zmienia prop `contentMd`
 * (np. po evencie deliverables:draft-ready), edytor MUSI przerenderować
 * nową treść bez remountu.
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api', () => ({ Api: { get: vi.fn(), post: vi.fn() } }));

import { CanvasRichEditor } from '../CanvasRichEditor';

const SKELETON_MD =
  '# Raport\n\n> Teresa pisze treść — sekcje wypełnią się po zakończeniu generacji.';
const FINAL_MD = '# Raport\n\n## Synteza\n\nRealna treść po generacji.';

function Harness({ md }: { md: string }) {
  return (
    <CanvasRichEditor contentMd={md} onContentChange={() => {}} onSelectionChange={() => {}} />
  );
}

describe('CanvasRichEditor — external contentMd sync (A1)', () => {
  it('podmienia treść edytora, gdy rodzic zmieni prop contentMd', async () => {
    const { rerender } = render(<Harness md={SKELETON_MD} />);

    await waitFor(() => {
      expect(screen.getByText(/Teresa pisze treść/)).toBeTruthy();
    });

    await act(async () => {
      rerender(<Harness md={FINAL_MD} />);
    });

    await waitFor(() => {
      expect(screen.getByText(/Realna treść po generacji/)).toBeTruthy();
    });
    expect(screen.queryByText(/Teresa pisze treść/)).toBeNull();
  });
});
