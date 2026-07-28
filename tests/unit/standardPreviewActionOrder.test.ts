/**
 * Bramka kanonu A6/A8: akcja DESTRUKCYJNA stoi ZAWSZE na końcu stopki podglądu.
 *
 * Powód istnienia tego testu (przegląd 128 zrzutów, 2026-07-27, PILNE-10 / N-83):
 * pięć ekranów naraz — Tools→Assessment, Tools→Reports, Tools→Initiatives,
 * Initiatives→Portfolio — pokazywało `Delete` jako PIERWSZY przycisk stopki,
 * nad `Duplicate`. Wszystkie z tego samego powodu: `Delete` trafiał do rzędu
 * `resolutions`, a rzędy renderują się resolutions → informational → time.
 * Kolejność jest teraz wymuszana w `StandardPreview`, nie w ekranach — ten test
 * pilnuje, żeby wymuszenie nie zniknęło przy kolejnym refaktorze.
 */
import { describe, expect, it } from 'vitest';

import {
  orderPreviewActionRows,
  type StandardPreviewAction,
} from '@/components/standard/StandardPreview';

const akcja = (
  id: string,
  variant: StandardPreviewAction['variant']
): StandardPreviewAction => ({
  id,
  variant,
  label: id,
  onClick: () => undefined,
});

const plaskie = (rows: StandardPreviewAction[][]) => rows.flat().map((a) => a.id);

describe('orderPreviewActionRows — destrukcyjne zawsze na końcu', () => {
  it('przenosi Delete z resolutions za Duplicate z informational (przypadek Tools/Portfolio)', () => {
    const rows = orderPreviewActionRows({
      resolutions: [akcja('delete', 'destructive')],
      informational: [akcja('duplicate', 'neutral')],
    });

    expect(plaskie(rows)).toEqual(['duplicate', 'delete']);
    // Zostaje jeden rząd — destrukcyjna dołącza do ostatniego niepustego.
    expect(rows).toHaveLength(1);
  });

  it('nie rusza pary Approve/Reject (Decisions) — Reject już jest ostatni', () => {
    const rows = orderPreviewActionRows({
      resolutions: [akcja('approve', 'positive'), akcja('reject', 'destructive')],
      time: [akcja('snooze', 'neutral')],
    });

    expect(plaskie(rows)).toEqual(['approve', 'snooze', 'reject']);
  });

  it('zachowuje kolejność i podział rzędów, gdy nie ma akcji destrukcyjnych', () => {
    const rows = orderPreviewActionRows({
      resolutions: [akcja('continue', 'positive')],
      informational: [akcja('more', 'neutral'), akcja('delegate', 'neutral')],
      time: [akcja('snooze', 'neutral')],
    });

    expect(rows.map((r) => r.map((a) => a.id))).toEqual([
      ['continue'],
      ['more', 'delegate'],
      ['snooze'],
    ]);
  });

  it('gdy destrukcyjna jest jedyną akcją — tworzy własny rząd, nie znika', () => {
    const rows = orderPreviewActionRows({
      resolutions: [akcja('delete', 'destructive')],
    });

    expect(rows).toEqual([[expect.objectContaining({ id: 'delete' })]]);
  });

  it('kilka destrukcyjnych z różnych rzędów ląduje razem na końcu', () => {
    const rows = orderPreviewActionRows({
      resolutions: [akcja('delete', 'destructive')],
      informational: [akcja('duplicate', 'neutral')],
      time: [akcja('reject', 'destructive'), akcja('snooze', 'neutral')],
    });

    expect(plaskie(rows)).toEqual(['duplicate', 'snooze', 'delete', 'reject']);
  });

  it('pusty wejściowy zestaw nie produkuje pustych rzędów', () => {
    expect(orderPreviewActionRows(undefined)).toEqual([]);
    expect(orderPreviewActionRows({ resolutions: [], informational: [] })).toEqual([]);
  });
});
