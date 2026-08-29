import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

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

  it('niesie pięć zaakceptowanych cech i mianowniki', () => {
    expect(componentSource).toContain('data-testid="task-card-v2"');
    expect(componentSource).toContain('Warunki zamknięcia');
    expect(componentSource).toContain('Brakujące — nazwane, nie „brak danych”');
    expect(componentSource).toContain('Rola i uprawnienia');
    expect(componentSource).toContain('Zablokowane');
    expect(componentSource).toContain('{completed} z {checklist.length} spełnionych');
  });
});
