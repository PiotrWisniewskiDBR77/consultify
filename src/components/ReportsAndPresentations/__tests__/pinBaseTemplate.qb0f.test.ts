/**
 * QB0f (Wpis 234/242, DEC-691/DEC-655) — PIN „TRZY bazowe na górze".
 *
 * Predykat `isPinnedBaseTemplate` pinował każdą kartę `scope:'system'` z rodziną
 * z `BASE_TEMPLATE_FAMILIES`. Problem: 20 KEEP TPL-1b (legacy report templates)
 * TEŻ niesie `scope:'system'` + `family:'DOC-BASE'`, więc na bibliotece orgu
 * pinowało się 21 kart DOC-BASE zamiast trzech kanonicznych baz. Zawężenie o
 * `source !== 'legacy'` zostawia wyłącznie kanoniczne bazy z migracji 20262271.
 *
 * Testy karmią REALNE funkcje produktu (`mapCanonicalTemplateArtifact` +
 * `isPinnedBaseTemplate`) REALNYMI wierszami indeksu (kopia dumpu stagingu,
 * org 3935603f) — zero bazy, zero fetch, zero czasu systemowego.
 *
 *  fixture 21-wierszowa (sam DOC-BASE): 20 KEEP + 1 kanoniczna → 1 pinowana / 20 nie.
 *  fixture 3-rodzinowa (DOC+DECK+SHEET kanoniczne + 3 KEEP)   → 3 pinowane / 3 nie.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { TemplateItem } from '../types';
import {
  BASE_TEMPLATE_FAMILIES,
  isPinnedBaseTemplate,
  mapCanonicalTemplateArtifact,
} from '../useRapData';

const FIXTURE_DIR = path.resolve(process.cwd(), 'evidence/qb0f-pin-narrow-20260919');

function loadFixture(name: string): unknown[] {
  return JSON.parse(readFileSync(path.join(FIXTURE_DIR, name), 'utf8')) as unknown[];
}

/** Surowe wiersze indeksu → TemplateItem przez REALNY mapper produktu. */
function mapRows(rows: unknown[]): TemplateItem[] {
  return rows
    .map((row) => mapCanonicalTemplateArtifact(row))
    .filter((item): item is TemplateItem => item !== null);
}

describe('QB0f — fixture 21 wierszy (DOC-BASE only: 20 KEEP + 1 kanoniczna)', () => {
  const items = mapRows(loadFixture('pin-fixture-21-docbase.json'));
  const pinned = items.filter(isPinnedBaseTemplate);

  it('mapper nie gubi żadnego z 21 wierszy', () => {
    expect(items).toHaveLength(21);
  });

  it('pinuje DOKŁADNIE 1 kartę (kanoniczną bazę DOC-BASE), 20 zostaje niepinowanych', () => {
    expect(pinned).toHaveLength(1);
    expect(items.length - pinned.length).toBe(20);
  });

  it('jedyna pinowana to kanoniczna baza, NIE żaden z 20 KEEP', () => {
    expect(pinned[0]?.title).toBe('[System] Client final report (EN)');
    expect(pinned[0]?.source).toBe('canonical');
    expect(pinned[0]?.templateFamily).toBe('DOC-BASE');
  });

  it('żadna karta legacy (source==="legacy") nie jest pinowana', () => {
    const legacy = items.filter((item) => item.source === 'legacy');
    expect(legacy).toHaveLength(20);
    expect(legacy.filter(isPinnedBaseTemplate)).toHaveLength(0);
  });
});

describe('QB0f — fixture 3-rodzinowa (DOC+DECK+SHEET kanoniczne + 3 KEEP)', () => {
  const items = mapRows(loadFixture('pin-fixture-3family.json'));
  const pinned = items.filter(isPinnedBaseTemplate);

  it('mapper mapuje wszystkie 6 wierszy', () => {
    expect(items).toHaveLength(6);
  });

  it('pinuje DOKŁADNIE 3 kanoniczne bazy — dowód intencji „TRZY bazowe na górze"', () => {
    expect(pinned).toHaveLength(3);
    expect(items.length - pinned.length).toBe(3);
  });

  it('trzy pinowane to po jednej bazie każdej rodziny (DOC/DECK/SHEET)', () => {
    const families = pinned.map((item) => item.templateFamily).sort();
    expect(families).toEqual(['DECK-BASE', 'DOC-BASE', 'SHEET-BASE']);
    expect(new Set(pinned.map((item) => item.title))).toEqual(
      new Set(['[System] Client final report (EN)', 'Board deck', 'Supplier scorecard workbook'])
    );
  });

  it('każda pinowana jest kanoniczna i z rodziny bazowej; KEEP nie pinują', () => {
    for (const item of pinned) {
      expect(item.source).toBe('canonical');
      expect(item.scope).toBe('system');
      expect(BASE_TEMPLATE_FAMILIES).toContain(item.templateFamily);
    }
    const keep = items.filter((item) => item.source === 'legacy');
    expect(keep).toHaveLength(3);
    expect(keep.filter(isPinnedBaseTemplate)).toHaveLength(0);
  });
});
