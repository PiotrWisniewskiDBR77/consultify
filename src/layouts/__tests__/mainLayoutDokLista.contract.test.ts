import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  isEmbeddedModuleChatHosted,
  registerEmbeddedModuleChatHost,
  resetEmbeddedModuleChatHost,
} from '@/components/shared/embeddedModuleChatHost';

/**
 * ★ DEC-404 (uzupełnienie 06.09.2026) — TEN KONTRAKT JEST ODWRÓCONY.
 *
 * Do 06.09 plik mierzył regułę „gospodarz P1 wyłącza globalny dok". To ona
 * dawała kształt, który właściciel odrzucił: Teresa lądowała jako zakładka
 * w kolumnie podglądu („tu nie jest jej miejsce", „zupełnie bez sensu").
 *
 * OD TERAZ rejestr gospodarzy P1 ma JEDNO zadanie: powiedzieć Menu 3
 * (`useStandardPanelControls`), że na ekranie jest panel podglądu do
 * pokazania. Doku NIE gasi — dok montuje się także na liście, a gospodarz
 * chowa wtedy swój podgląd (`useJedenPanel.dokOtwarty`).
 */
describe('T5 kontrakt doku globalnego i gospodarza listy (DEC-404)', () => {
  beforeEach(resetEmbeddedModuleChatHost);

  it('rejestr nadal liczy gospodarzy P1 — Menu 3 ma po czym poznać, że jest panel', () => {
    expect(isEmbeddedModuleChatHosted()).toBe(false);
    const zwolnij = registerEmbeddedModuleChatHost();
    expect(isEmbeddedModuleChatHosted()).toBe(true);
    zwolnij();
    expect(isEmbeddedModuleChatHosted()).toBe(false);
  });

  it('MainLayout NIE gasi doku rejestrem — gasi go wyłącznie ścieżka (MUTACJA: dopisz `|| embeddedModuleChatHosted` → RED)', () => {
    const zrodlo = fs.readFileSync(path.resolve('src/layouts/MainLayout.tsx'), 'utf8');
    const linia = zrodlo
      .split('\n')
      .find((wiersz) => wiersz.includes('const hasEmbeddedModuleChat ='));
    expect(linia).toBeDefined();
    expect(linia).toContain('hasEmbeddedModuleChatByPath');
    expect(linia).not.toContain('embeddedModuleChatHosted');
    // Ikona i dok mają JEDEN wspólny warunek — nigdy martwy przycisk, nigdy
    // wejście bez powierzchni.
    expect(zrodlo).toContain('const hasTeresaEntry = shouldMountChatPanel;');
  });

  it('żaden ekran listowy nie montuje własnego UnifiedChatPanel (MUTACJA: przywróć lazy czat → RED)', () => {
    for (const plik of [
      'src/components/shared/TableWithPreviewLayout.tsx',
      'src/components/shared/PreviewPane/JedenPrawyPanel.tsx',
      'src/components/MyWork/NotebookContent.tsx',
    ]) {
      const zrodlo = fs.readFileSync(path.resolve(plik), 'utf8');
      expect(zrodlo, plik).not.toMatch(/from '@\/components\/AIChat\/UnifiedChatPanel'/);
    }
  });
});
