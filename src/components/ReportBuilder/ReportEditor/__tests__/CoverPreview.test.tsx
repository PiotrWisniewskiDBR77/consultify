/**
 * Wpis 88 / D-75a: podgląd bloku `cover` nie może pokazywać surowego JSON-u.
 * Cover jest generowany jako JSON (prompt `reportGenerationService`), ale wyjście
 * LLM bywa ogrodzone ```json``` albo z prozą wokół obiektu — stare renderery
 * parsowały tylko treść zaczynającą się od `{`, więc reszta spadała do markdownu
 * i właściciel widział `{"title": …}` jako tekst na karcie. Dowody tu:
 *  1. cover z pełnymi polami (także ogrodzony ```json) → 4 elementy
 *     (tytuł / podtytuł / firma / data) i zero surowego JSON-u,
 *  2. cover z pustymi polami → brak „{" i „undefined" w tekście,
 *  3. JSON nieparsowalny (ogonowy przecinek) → zastępczy tytuł, nie zrzut,
 *  4. markdownowy cover (seedy) nadal renderuje się jako markdown,
 *  5. podwójnie zakodowany JSON (string w stringu) też się rozpakuje.
 */
import { render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { CoverPreview, parseCoverContent } from '../CoverPreview';

const PELNY_JSON = JSON.stringify({
  title: 'Northwind Packaging — Digital Readiness Diagnosis',
  subtitle: 'Board decision pack',
  companyName: 'Northwind Packaging',
  date: '8 September 2026',
  assessmentType: 'DRD',
});

const OGRODZONY = `Here is the cover page:\n\`\`\`json\n${PELNY_JSON}\n\`\`\``;

const elementyCover = (container: HTMLElement) => ({
  tytul: container.querySelectorAll('h3'),
  podtytul: container.querySelectorAll('p'),
  firma: Array.from(container.querySelectorAll('span')).filter((s) =>
    (s.textContent || '').includes('Northwind Packaging')
  ),
  data: Array.from(container.querySelectorAll('span')).filter((s) =>
    (s.textContent || '').includes('8 September 2026')
  ),
});

describe('Wpis 88 — podgląd bloku cover bez surowego JSON-u', () => {
  it('pełne pola (goły JSON) → 4 elementy: tytuł, podtytuł, firma, data', () => {
    const { container } = render(<CoverPreview content={PELNY_JSON} />);
    const e = elementyCover(container);
    expect(e.tytul).toHaveLength(1);
    expect(e.podtytul).toHaveLength(1);
    expect(e.firma).toHaveLength(1);
    expect(e.data).toHaveLength(1);
    expect(container.textContent).not.toContain('{');
    expect(container.textContent).not.toContain('undefined');
  });

  it('JSON ogrodzony ```json (realne wyjście LLM) → też 4 elementy, nie zrzut', () => {
    const { container } = render(<CoverPreview content={OGRODZONY} />);
    const e = elementyCover(container);
    expect(e.tytul).toHaveLength(1);
    expect(e.podtytul).toHaveLength(1);
    expect(e.firma).toHaveLength(1);
    expect(e.data).toHaveLength(1);
    expect(container.textContent).not.toContain('```');
    expect(container.textContent).not.toContain('"title"');
  });

  it('puste pola ({}) → brak „{" i „undefined", zostaje tytuł zastępczy', () => {
    const { container } = render(<CoverPreview content='{"title": ""}' />);
    expect(container.textContent).not.toContain('{');
    expect(container.textContent).not.toContain('undefined');
    expect(container.querySelectorAll('h3')).toHaveLength(1);
    expect(container.querySelectorAll('p')).toHaveLength(0);
  });

  it('JSON nieparsowalny (ogonowy przecinek) → tytuł zastępczy, nigdy surowy zrzut', () => {
    const { container } = render(
      <CoverPreview content='{"title": "Northwind", "date": "2026-09-08",}' />
    );
    expect(container.textContent).not.toContain('{');
    expect(container.textContent).not.toContain('"title"');
    expect(container.querySelectorAll('h3')).toHaveLength(1);
  });

  it('markdownowy cover (jak w seedzie demo-en) nadal renderuje się jako markdown', () => {
    const { container } = render(
      <CoverPreview content={'# Purpose & Mandate\n\nThe Operational Excellence Charter.'} />
    );
    expect(container.querySelector('h1')?.textContent).toBe('Purpose & Mandate');
  });

  it('parseCoverContent rozpakuje podwójnie zakodowany JSON i odrzuci prozę bez obiektu', () => {
    const podwojny = JSON.stringify(PELNY_JSON);
    expect(parseCoverContent(podwojny)?.title).toBe(
      'Northwind Packaging — Digital Readiness Diagnosis'
    );
    expect(parseCoverContent('# sam markdown\n\nbez obiektu')).toBeNull();
  });
});
