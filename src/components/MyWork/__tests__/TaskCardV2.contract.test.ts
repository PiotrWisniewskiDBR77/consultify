import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import pl from '../../../../public/locales/pl/translation.json';
import { ENABLE_TASK_CARD_V2_DEFAULT } from '../taskCardV2Flag';

const componentSource = readFileSync(
  path.resolve(process.cwd(), 'src/components/MyWork/TaskCardV2.tsx'),
  'utf8'
);
const viewSource = readFileSync(
  path.resolve(process.cwd(), 'src/components/MyWork/TaskDetailView.tsx'),
  'utf8'
);

describe('Karta Zadania V2 — kontrakt właściciela', () => {
  it('pozostaje domyślnie wyłączona i zachowuje starą ścieżkę renderu', () => {
    expect(ENABLE_TASK_CARD_V2_DEFAULT).toBe(false);
    expect(viewSource).toContain("if (presentationMode === 'n' && isTaskCardV2Enabled())");
    expect(
      viewSource.indexOf("if (presentationMode === 'n' && isTaskCardV2Enabled())")
    ).toBeLessThan(viewSource.indexOf("if (presentationMode === 'n')"));
  });

  /**
   * ★ J2 (jezyk EN/PL, 09.09): karta przestala trzymac polskie napisy w kodzie
   * — kazda z pieciu zaakceptowanych cech ma teraz KLUCZ i18n, a polski zyje
   * w `public/locales/pl/translation.json` (PLAN §2.3/§2.4). Asercja idzie po
   * kluczu ORAZ po polskiej wartosci w pliku PL: sam klucz przeszedlby, gdyby
   * ktos skasowal tlumaczenie, a sam napis w kodzie jest dokladnie tym, co ta
   * paczka usuwa. Mutacja: skasuj dowolny klucz z pl/translation.json → RED.
   */
  it('niesie pięć zaakceptowanych cech i mianowniki (przez i18n, nie napisem w kodzie)', () => {
    expect(componentSource).toContain('data-testid="task-card-v2"');
    for (const key of [
      'myWork.taskCardV2.closureConditions',
      'myWork.taskCardV2.missingTitle',
      'myWork.taskCardV2.roleAndRights',
      'myWork.taskCardV2.blocked',
      'myWork.taskCardV2.closureCount',
    ]) {
      expect(componentSource).toContain(key);
    }
    const card = (pl as unknown as Record<string, Record<string, Record<string, string>>>)
      .myWork.taskCardV2;
    expect(card.closureConditions).toBe('Warunki zamknięcia');
    expect(card.missingTitle).toBe('Brakujące — nazwane, nie „brak danych”');
    expect(card.roleAndRights).toBe('Rola i uprawnienia');
    expect(card.blocked).toBe('Zablokowane');
    expect(card.closureCount).toBe('{{completed}} z {{total}} spełnionych');
  });

  /**
   * Bezpiecznik kierunkowy: default w `t()` ma byc ANGIELSKI, a data ma isc
   * przez SSOT list. Mutacja: przywroc `Intl.DateTimeFormat('pl-PL')` albo
   * polski default → RED.
   */
  it('nie trzyma polskiego defaultu ani locale przybitego na sztywno', () => {
    expect(componentSource).not.toMatch(/'(pl-PL|en-US|en-GB)'/);
    expect(componentSource).toContain('formatListDate');
    expect(componentSource).not.toMatch(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ][^\n]*'\s*\)/);
  });
});
