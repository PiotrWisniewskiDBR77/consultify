import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import {
  buildOkrKeyResultColumns,
  buildOkrKeyResultPreview,
} from '../../../../src/components/ResultsVNext/okr/okrKeyResultPresenters';

const currentUserId = 'd2b6a316-08c5-47cf-9bf7-4ba50311d5a2';
const keyResult = {
  keyResultId: 'kr-1',
  title: 'Osiągnąć zweryfikowany cel realizacji korzyści',
  ownerUserId: currentUserId,
  status: 'at_risk',
  direction: 'increase',
  measurementType: 'numeric',
  currentValue: 58,
  targetValue: 100,
  progress: 58,
  confidence: 'medium',
  weight: 1,
  sourceType: 'manual',
  createdAt: '2026-08-13T00:00:00.000Z',
  updatedAt: '2026-08-13T00:00:00.000Z',
} as any;

describe('OKR Key Result owner presentation', () => {
  it('renders the current owner as You in the registry instead of a UUID', () => {
    const ownerColumn = buildOkrKeyResultColumns(false, 'active', currentUserId).find(
      (column) => column.id === 'owner'
    );
    const html = renderToStaticMarkup(ownerColumn!.render!(keyResult));

    expect(html).toContain('You');
    expect(html).not.toContain(currentUserId);
  });

  it('does not expose the owner UUID in preview details', () => {
    const preview = buildOkrKeyResultPreview(keyResult, {
      isPolish: false,
      parentSetStatus: 'active',
      currentUserId,
      onClose: vi.fn(),
      onOpenCheckIns: vi.fn(),
      onEdit: vi.fn(),
      onCancel: vi.fn(),
    });

    const owner = preview.details?.properties?.find((property) => property.id === 'owner');
    expect(owner?.value).toBe('You');
    expect(JSON.stringify(preview.details)).not.toContain(currentUserId);
  });
});
