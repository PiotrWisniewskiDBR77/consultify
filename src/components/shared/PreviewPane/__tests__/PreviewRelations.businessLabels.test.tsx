import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PreviewRelations } from '../PreviewRelations';

describe('PreviewRelations business labels', () => {
  it('keeps a UUID available for audit but not as primary chip copy', () => {
    const id = 'd585884f-6cd0-4be2-ae04-abaf0c223659';
    render(<PreviewRelations items={[{ id, type: 'initiative', label: `Inicjatywa · ${id}` }]} />);

    expect(screen.getByText('Powiązana inicjatywa')).toBeInTheDocument();
    expect(screen.queryByText(`Inicjatywa · ${id}`)).not.toBeInTheDocument();
    expect(screen.getByTitle(`Powiązana inicjatywa — Inicjatywa · ${id}`)).toBeInTheDocument();
  });

  it('does not rewrite an explicit business title', () => {
    render(
      <PreviewRelations
        items={[{ type: 'initiative', label: 'Redukcja przezbrojenia linii pakującej' }]}
      />
    );

    expect(screen.getByText('Redukcja przezbrojenia linii pakującej')).toBeInTheDocument();
  });
});
