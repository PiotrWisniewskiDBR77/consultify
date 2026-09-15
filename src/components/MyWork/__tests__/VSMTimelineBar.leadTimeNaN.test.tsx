/**
 * Fala F3 (15.09) — zgłoszenie właściciela: Process Flow → Value Stream
 * pokazywał na pasku dolnym „Lead Time: NaN d" obok poprawnego „VA Time 1.1 d"
 * i „PCE 0.0 %".
 *
 * ZMIERZONA przyczyna (nie hipoteza): pola VSM na węźle są commitowane przez
 * `InlineField` jako TEKST, a `emitFieldChange`
 * (`src/components/MyWork/VSMNodeComponent.tsx:169`) zapisuje wartość
 * nieliczbową bez zmiany — mimo że `VSMNodeData.inventory` deklaruje `number`.
 * Wpisanie w „Qty" czegoś w rodzaju „5 pcs" dawało w pasku
 * `'5 pcs' * 0.5` → NaN → leadTime NaN. Że to była właśnie ta ścieżka, a nie
 * cycleTime, widać po zrzucie właściciela: VA było skończone (1.1 d), a
 * `pce = leadTime > 0 ? ... : 0` dla NaN wchodzi w gałąź `0` — stąd 0,0 %.
 *
 * Kontrakt pilnowany tutaj: żadna wartość pola VSM nie może wyprodukować NaN
 * na ekranie; niepoliczalne wejście = 0, nigdy „NaN d".
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { VSMTimelineBar } from '../VSMTimelineBar';

function renderBar(nodes: Array<{ id: string; data?: any }>) {
  const { container } = render(<VSMTimelineBar nodes={nodes} isPl={false} />);
  return container.textContent || '';
}

describe('F3 — VSMTimelineBar nigdy nie pokazuje NaN', () => {
  it('reprodukcja zrzutu właściciela: VA skończone + Qty jako tekst → brak NaN', () => {
    const text = renderBar([
      { id: 'p1', data: { shape: 'vsm_process', cycleTime: '1.1d' } },
      // dokładnie to, co zapisuje emitFieldChange dla wpisu nieliczbowego
      { id: 'i1', data: { shape: 'vsm_inventory', inventory: '5 pcs' } },
    ]);
    expect(text).not.toContain('NaN');
    // VA nadal policzone — naprawa nie kasuje poprawnej wartości
    expect(text).toContain('1.1 d');
  });

  it('literalny NaN w cycleTime (typeof === "number") też nie wycieka na ekran', () => {
    const text = renderBar([{ id: 'p1', data: { shape: 'vsm_process', cycleTime: Number('') / 0 } }]);
    expect(text).not.toContain('NaN');
  });

  it('inventory jako czysty tekst / null / Infinity → 0, nie NaN', () => {
    for (const bad of ['brak', null, undefined, Infinity, {}]) {
      const text = renderBar([
        { id: 'p1', data: { shape: 'vsm_process', cycleTime: '30' } },
        { id: 'i1', data: { shape: 'vsm_inventory', inventory: bad as any } },
      ]);
      expect(text).not.toContain('NaN');
    }
  });

  it('poprawne dane liczbowe liczą się bez zmian (regresja naprawy)', () => {
    const text = renderBar([
      { id: 'p1', data: { shape: 'vsm_process', cycleTime: '60' } },
      { id: 'i1', data: { shape: 'vsm_inventory', inventory: 120 } },
    ]);
    // VA 60 min, wait 120*0.5 = 60 min, lead 120 min = 2.0 h, PCE 50,0 %
    expect(text).toContain('2.0 h');
    expect(text).toContain('50.0%');
  });
});
