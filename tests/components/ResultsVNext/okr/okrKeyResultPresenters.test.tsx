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

// Scalenie 2026-09-03: test przyszedl z demo (2b4063ca0e) i sprawdzal jego
// wlasna naprawe — podmiane surowego UUID na "Ty"/"You". Nasza linia naprawila
// te sama rodzine SZERZEJ: `resolveMemberName` podaje PRAWDZIWE nazwisko
// czlonka organizacji. Gwarancja demo (zaden surowy UUID w tresci) zostaje
// dokladnie ta sama, tylko mechanizm jest mocniejszy — dlatego asercje
// przepisane na nasz kontrakt zamiast usuniete.
const resolveMemberName = (userId: string) =>
  userId === currentUserId ? 'Anna Kowalska' : null;

describe('OKR Key Result owner presentation', () => {
  it('renders the resolved member name in the registry instead of a UUID', () => {
    const ownerColumn = buildOkrKeyResultColumns(false, 'active', resolveMemberName).find(
      (column) => column.id === 'owner'
    );
    const html = renderToStaticMarkup(ownerColumn!.render!(keyResult));
    // Tylko TRESC WIDOCZNA — id w `title=` to korelacja na hover, nie defekt
    // rodziny "surowy identyfikator zamiast etykiety" (REJESTR_SUROWE_ID_20260902.md,
    // sekcja falszywych alarmow: `key=`, `data-*`, `href=`, `title=`).
    const visibleText = html.replace(/<[^>]*>/g, '');

    expect(visibleText).toContain('Anna Kowalska');
    expect(visibleText).not.toContain(currentUserId);
  });

  it('does not expose the owner UUID in preview details', () => {
    const preview = buildOkrKeyResultPreview(keyResult, {
      isPolish: false,
      parentSetStatus: 'active',
      resolveMemberName,
      onClose: vi.fn(),
      onOpenCheckIns: vi.fn(),
      onEdit: vi.fn(),
      onCancel: vi.fn(),
    });

    const owner = preview.details?.properties?.find((property) => property.id === 'owner');
    expect(owner?.value).toBe('Anna Kowalska');
    expect(JSON.stringify(preview.details)).not.toContain(currentUserId);
  });
});
