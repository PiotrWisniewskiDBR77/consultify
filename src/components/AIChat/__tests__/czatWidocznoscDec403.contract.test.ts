/**
 * czatWidocznoscDec403.contract — DEC-403 (06.09, słowo właściciela).
 *
 * Trzy elementy Czatu uznane przez właściciela za pozostałość po
 * nieukończonych funkcjach mają zostać UKRYTE (nie usunięte) do czasu
 * Fali 2:
 *   1. wybór/przełącznik gałęzi rozmowy ("Main (2)") — BranchSelector,
 *   2. wejście do "ważnych sygnałów" (ikona nagłówka + panel),
 *   3. system generowania materiałów: wejście do panelu "Plan materiału
 *      wynikowego" (V8ArtifactRunControl) i klasyfikator, który przełączał
 *      odpowiedzi czatu w tryb "Dokument: …".
 *
 * Jedyne miejsce sterujące widocznością: czatWidocznosc.ts (UKRYTE_DEC403).
 * Ten test jest kontraktem dwustronnym:
 *  (a) stałe MUSZĄ być dziś `true` (elementy ukryte) — mutacja jednej z
 *      nich na `false` musi zaświecić ten plik na czerwono;
 *  (b) w UnifiedChatPanel.tsx każde z trzech miejsc renderowania musi
 *      faktycznie czytać odpowiednią stałą z negacją (`!UKRYTE_DEC403.x`)
 *      — usunięcie tego warunku (przywrócenie bezwarunkowego renderu)
 *      również zaświeca ten plik na czerwono.
 *
 * Kod komponentów (BranchSelector.tsx, ChatSignalsPanel.tsx,
 * V8ArtifactRunControl.tsx, deckGenerationChecklist) NIE jest tu dotykany
 * — zostaje w repo gotowy do odkrycia w Fali 2.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { UKRYTE_DEC403 } from '../czatWidocznosc';

const unifiedChatPanelSource = fs.readFileSync(
  path.resolve(__dirname, '../UnifiedChatPanel.tsx'),
  'utf8'
);

describe('DEC-403 — trzy elementy Czatu ukryte do Fali 2', () => {
  it('trzyma wszystkie trzy stałe UKRYTE_DEC403 na `true` (elementy nierenderowane)', () => {
    // Mutacja dowolnej z nich na `false` MUSI zaświecić ten test na czerwono
    // — to jest "elementy nierenderowane, dopóki flaga = true" jako fakt
    // sprawdzalny, nie hipoteza.
    expect(UKRYTE_DEC403.galezie).toBe(true);
    expect(UKRYTE_DEC403.sygnaly).toBe(true);
    expect(UKRYTE_DEC403.generatorMaterialow).toBe(true);
  });

  it('gasi wybór gałęzi (BranchSelector) warunkiem !UKRYTE_DEC403.galezie', () => {
    expect(unifiedChatPanelSource).toContain(
      "{!UKRYTE_DEC403.galezie && activeConversationId && !String(activeConversationId).startsWith('local-') && ("
    );
    // Regresja M01-P03A (canvasSplitTeresaRight.iconParity.test.ts) pilnuje,
    // że sam <BranchSelector> zostaje w drzewie za tym warunkiem.
    expect(unifiedChatPanelSource).toContain('<BranchSelector');
  });

  it('gasi wejście do ważnych sygnałów (ikona + panel) warunkiem !UKRYTE_DEC403.sygnaly', () => {
    const signalsButtonBlock = unifiedChatPanelSource.match(
      /data-testid="chat-signals-button"[\s\S]{0,400}/
    )?.[0];
    expect(signalsButtonBlock).toBeTruthy();

    // Warunek musi poprzedzać zarówno przycisk w nagłówku, jak i panel —
    // sprawdzamy source tuż przed każdym z dwóch miejsc użycia.
    const buttonGateIndex = unifiedChatPanelSource.indexOf(
      'signalsEnabled && !UKRYTE_DEC403.sygnaly'
    );
    const panelGateIndex = unifiedChatPanelSource.lastIndexOf(
      'signalsEnabled && !UKRYTE_DEC403.sygnaly'
    );
    expect(buttonGateIndex).toBeGreaterThan(-1);
    expect(panelGateIndex).toBeGreaterThan(buttonGateIndex);

    const signalsButtonIndex = unifiedChatPanelSource.indexOf('data-testid="chat-signals-button"');
    const signalsPanelIndex = unifiedChatPanelSource.indexOf('<ChatSignalsPanel');
    expect(buttonGateIndex).toBeLessThan(signalsButtonIndex);
    expect(panelGateIndex).toBeLessThan(signalsPanelIndex);
  });

  it('gasi wejście do panelu "Plan materiału wynikowego" (V8ArtifactRunControl) warunkiem !UKRYTE_DEC403.generatorMaterialow', () => {
    const panelGateIndex = unifiedChatPanelSource.indexOf(
      '{!UKRYTE_DEC403.generatorMaterialow && (\n              <V8ArtifactRunControl'
    );
    expect(panelGateIndex).toBeGreaterThan(-1);
  });

  it('gasi klasyfikator trybu "Dokument: …" (detectDocumentIntent / hasStrongDocumentNoun) warunkiem !UKRYTE_DEC403.generatorMaterialow', () => {
    expect(unifiedChatPanelSource).toContain(
      '!UKRYTE_DEC403.generatorMaterialow &&\n        (detectDocumentIntent(text) || hasStrongDocumentNoun(text))'
    );
  });
});
