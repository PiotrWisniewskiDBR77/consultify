// @vitest-environment node
/**
 * W14.1 — deckAltText: deterministyczny alt-text dla wizualizacji (a11y).
 */
import { describe, expect, it } from 'vitest';
import {
  chartAltText,
  imageAltText,
  slideAltText,
} from '../../../server/src/services/deliverables/deckAltText';

describe('W14.1 — chartAltText: bar_series', () => {
  it('opisuje trend i zakres z danych (nie generyczne)', () => {
    const alt = chartAltText({
      type: 'bar_series',
      labels: ['R1', 'R2', 'R3'],
      series: [{ name: 'Przychód', values: [2400, 4760, 8800] }],
    });
    expect(alt).toContain('Przychód');
    expect(alt).toContain('rosnący');
    expect(alt).toContain('3 okresach');
    expect(alt).not.toBe('Wykres słupkowy.');
  });

  it('trend malejący wykrywany', () => {
    const alt = chartAltText({ type: 'bar_series', labels: ['R1', 'R2'], series: [{ name: 'X', values: [100, 50] }] });
    expect(alt).toContain('malejący');
  });

  it('wiele serii odnotowane', () => {
    const alt = chartAltText({
      type: 'bar_series', labels: ['R1', 'R2'],
      series: [{ name: 'A', values: [1, 2] }, { name: 'B', values: [3, 4] }],
    });
    expect(alt).toContain('2 serie');
  });

  it('puste serie → opis rodzajowy', () => {
    expect(chartAltText({ type: 'bar_series', labels: [], series: [] })).toBe('Wykres słupkowy.');
  });
});

describe('W14.1 — chartAltText: RAG', () => {
  it('liczy statusy', () => {
    const alt = chartAltText({
      type: 'rag',
      items: [
        { label: 'a', status: 'red' }, { label: 'b', status: 'red' },
        { label: 'c', status: 'amber' }, { label: 'd', status: 'green' },
      ],
    });
    expect(alt).toContain('4 pozycji');
    expect(alt).toContain('2 czerwony');
    expect(alt).toContain('1 żółty');
    expect(alt).toContain('1 zielony');
  });
});

describe('W14.1 — chartAltText: marimekko', () => {
  it('wymienia kolumny i największy segment', () => {
    const alt = chartAltText({
      type: 'marimekko',
      columns: [
        { label: 'TAM→SAM', segments: [{ name: 'SAM', value: 1000 }, { name: 'Reszta', value: 9000 }] },
        { label: 'SAM→SOM', segments: [{ name: 'SOM', value: 100 }, { name: 'Reszta SAM', value: 900 }] },
      ],
    });
    expect(alt).toContain('2 kolumny');
    expect(alt).toContain('TAM→SAM');
    expect(alt).toContain('Reszta'); // największy = 9000
  });
});

describe('W14.1 — chartAltText: harvey_balls', () => {
  it('opisuje poziomy słownie', () => {
    const alt = chartAltText({
      type: 'harvey_balls',
      rows: [{ label: 'Dane', level: 3 }, { label: 'Procesy', level: 0 }],
    });
    expect(alt).toContain('Dane: wysoki');
    expect(alt).toContain('Procesy: brak');
  });
});

describe('W14.1 — chartAltText: brak/nieznany', () => {
  it('null/undefined → pusty string', () => {
    expect(chartAltText(null)).toBe('');
    expect(chartAltText(undefined)).toBe('');
  });
});

describe('W14.1 — imageAltText', () => {
  it('łączy tytuł i tezę', () => {
    const alt = imageAltText({ title: 'Rynek AI', keyMessage: 'TAM 300 mld EUR' });
    expect(alt).toContain('Rynek AI');
    expect(alt).toContain('TAM 300 mld EUR');
  });

  it('sam tytuł / sama teza / nic', () => {
    expect(imageAltText({ title: 'X' })).toContain('X');
    expect(imageAltText({ keyMessage: 'Y' })).toContain('Y');
    expect(imageAltText({})).toBe('Ilustracja dekoracyjna.');
  });

  it('ucina do 240 znaków', () => {
    const alt = imageAltText({ title: 'A'.repeat(300), keyMessage: 'B'.repeat(300) });
    expect(alt.length).toBeLessThanOrEqual(240);
  });
});

describe('W14.1 — slideAltText (całość slajdu)', () => {
  it('łączy tytuł + opis wykresu', () => {
    const alt = slideAltText({
      title: 'Wyniki finansowe',
      chartSpec: { type: 'bar_series', labels: ['R1', 'R2'], series: [{ name: 'Przychód', values: [100, 200] }] },
    });
    expect(alt).toContain('Wyniki finansowe');
    expect(alt).toContain('Przychód');
  });

  it('bez wykresu z obrazem → image alt', () => {
    const alt = slideAltText({ title: 'Rynek', keyMessage: 'Duży rynek', hasImage: true });
    expect(alt).toContain('Rynek');
  });

  it('bez wykresu i obrazu → tytuł + teza', () => {
    const alt = slideAltText({ title: 'Teza', keyMessage: 'Kluczowy przekaz' });
    expect(alt).toContain('Teza');
    expect(alt).toContain('Kluczowy przekaz');
  });

  it('pusty slajd → fallback', () => {
    expect(slideAltText({})).toBe('Slajd prezentacji.');
  });

  it('ucina do 500 znaków', () => {
    const alt = slideAltText({ title: 'A'.repeat(400), keyMessage: 'B'.repeat(400) });
    expect(alt.length).toBeLessThanOrEqual(500);
  });
});
