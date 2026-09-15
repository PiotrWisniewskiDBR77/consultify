/**
 * F9 (15.09.2026) — filtr projektow w Inicjatywach pokazywal SUROWE UUID.
 * Mutacja: przywrocenie `|| projectId` jako ostatniej deski ratunku wywraca
 * dwa ponizsze wiersze na czerwono.
 */
import { describe, expect, it } from 'vitest';

import { resolveProjectFilterLabel } from '../projectFilterLabel';

const UUID = 'ae6cfbae-1ba8-5328-9048-d86f2a52a09e';

describe('resolveProjectFilterLabel', () => {
  it('bierze nazwe z rekordu inicjatywy, gdy jest', () => {
    expect(resolveProjectFilterLabel(UUID, 'Line 4 retrofit', {}, 'Unnamed project')).toBe(
      'Line 4 retrofit'
    );
  });

  it('spada na katalog projektow, gdy rekord nie niesie nazwy', () => {
    expect(
      resolveProjectFilterLabel(UUID, '', { [UUID]: 'Supplier quality' }, 'Unnamed project')
    ).toBe('Supplier quality');
  });

  it('NIGDY nie zwraca UUID — bez nazwy daje neutralna etykiete', () => {
    expect(resolveProjectFilterLabel(UUID, null, {}, 'Unnamed project')).toBe('Unnamed project');
    expect(resolveProjectFilterLabel(UUID, '   ', {}, 'Unnamed project')).not.toContain(UUID);
  });

  it('bialy znak w nazwie nie udaje nazwy', () => {
    expect(
      resolveProjectFilterLabel(UUID, '  ', { [UUID]: '   ' }, 'Unnamed project')
    ).toBe('Unnamed project');
  });
});
