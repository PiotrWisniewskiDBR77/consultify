/**
 * @vitest-environment jsdom
 *
 * Odbiór 05.09 (04-narzędzia, defekt 7 „tools-sesja-wyjście"): kebab „Więcej"
 * w nagłówku sesji narzędzia miał WYŁĄCZNIE „Skopiuj kod obiektu" i „Kopiuj
 * link" — ani jednej pozycji o wyjściu z sesji. Wyjść dało się tylko strzałką
 * „<" albo chipem „Lista" w Menu 3.
 *
 * Łańcuch ma trzy ogniwa i każde osobno potrafi skłamać, więc test pilnuje
 * wszystkich trzech:
 *  1. `buildToolSessionOverflowItems` produkuje pozycję wyjścia (i NIE
 *     produkuje pauzy, której backend nie umie zapisać),
 *  2. `NModeHeader` realnie renderuje `extraOverflowItems` w kebabie i woła
 *     ich `onClick` (bez tego pkt 1 byłby biblioteką bez wywołania),
 *  3. `ToolDocumentView` faktycznie podaje tę fabrykę do nagłówka.
 *
 * UCZCIWIE: ogniwo 3 jest sprawdzane na źródle, nie przez zamontowanie
 * `ToolDocumentView` — komponent wywraca się w jsdom przy renderze (rzuca
 * z wnętrza po `toolSync.load()`), a doprowadzenie go do montowania to osobna
 * robota, nie część tej naprawy. To słabsze ogniwo i tak jest nazwane.
 */
import fs from 'node:fs';
import path from 'node:path';

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { buildToolSessionOverflowItems } from '@/components/DiscoveryTools/toolSessionOverflowItems';
import { NModeHeader } from '@/components/shared/NModeLayout/NModeHeader';

const Icon = () => <span />;

describe('buildToolSessionOverflowItems — wyjście jest, pauzy nie ma', () => {
  it('daje „Wyjdź z sesji" wołające przekazany onBack', () => {
    const onBack = vi.fn();
    const items = buildToolSessionOverflowItems({ onBack, isPolish: true, exitIcon: Icon });
    const exit = items.find((i) => i.id === 'exit-session');
    expect(exit).toBeTruthy();
    expect(exit!.label).toBe('Wyjdź z sesji');
    exit!.onClick();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('ma wersję angielską', () => {
    const items = buildToolSessionOverflowItems({
      onBack: () => {},
      isPolish: false,
      exitIcon: Icon,
    });
    expect(items[0].label).toBe('Leave session');
  });

  it('NIE udaje wstrzymania sesji — słownik statusów nie ma takiego stanu', () => {
    const labels = buildToolSessionOverflowItems({
      onBack: () => {},
      isPolish: true,
      exitIcon: Icon,
    })
      .map((i) => `${i.id} ${i.label}`)
      .join(' ');
    expect(labels).not.toMatch(/wstrzym|pauz|pause/i);
  });
});

describe('NModeHeader — kebab Menu 1 realnie renderuje dołożone pozycje', () => {
  it('pokazuje „Wyjdź z sesji" w menu ⋮ i woła jego akcję', () => {
    const onBack = vi.fn();
    render(
      <NModeHeader
        title="Dynamic SWOT — Session"
        onTitleChange={() => {}}
        artifactId="1e9d72f1"
        artifactType="tool"
        onClose={() => {}}
        extraOverflowItems={buildToolSessionOverflowItems({
          onBack,
          isPolish: true,
          exitIcon: Icon,
        })}
      />
    );

    const buttons = Array.from(
      document.querySelectorAll('[data-nmode-header] button')
    ) as HTMLElement[];
    fireEvent.click(buttons[buttons.length - 1]);

    fireEvent.click(screen.getByText('Wyjdź z sesji'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('ToolDocumentView — podaje fabrykę do nagłówka (ogniwo sprawdzane na źródle)', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../../../src/components/DiscoveryTools/ToolDocumentView.tsx'),
    'utf8'
  );

  it('importuje i wywołuje buildToolSessionOverflowItems w konfiguracji nagłówka', () => {
    expect(source).toContain(
      "import { buildToolSessionOverflowItems } from './toolSessionOverflowItems'"
    );
    expect(source).toMatch(
      /extraOverflowItems:\s*buildToolSessionOverflowItems\(\{[\s\S]{0,120}onBack,/
    );
  });
});
