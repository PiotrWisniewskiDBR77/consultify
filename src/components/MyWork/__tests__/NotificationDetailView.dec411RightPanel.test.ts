/**
 * DEC-411: powiadomienie jest lekką kartą systemową. CTO zatwierdził, że
 * prawy panel pokazuje wyłącznie Akcje i Historię; kod innych sekcji zostaje,
 * ale nie może wejść do widocznego kontraktu.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(path.resolve(__dirname, '../NotificationDetailView.tsx'), 'utf8');

describe('NotificationDetailView — widoczny kontrakt prawego panelu DEC-411', () => {
  it('dopuszcza tylko Akcje i Historię', () => {
    const match = source.match(/notificationRightPanelContract = new Set\(\[([^\]]+)]\)/);
    expect(match).not.toBeNull();
    const ids = [...match![1].matchAll(/'([^']+)'/g)].map((item) => item[1]);
    expect(ids).toEqual(['actions', 'history']);
  });

  it('filtruje panel przez zatwierdzony kontrakt, zachowując implementacje poza ekranem', () => {
    expect(source).toContain('notificationRightPanelContract.has(section.id)');
    for (const retainedImplementation of [
      "id: 'properties'",
      "id: 'relations'",
      "id: 'evidence'",
      "id: 'results'",
      "id: 'comments'",
    ]) {
      expect(source).toContain(retainedImplementation);
    }
  });
});
