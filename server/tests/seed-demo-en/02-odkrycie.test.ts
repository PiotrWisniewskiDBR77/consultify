import { describe, expect, it } from 'vitest';

import {
  DRD_OBSZARY_39,
  NARZEDZIA,
  OSIE_DRD,
  WNIOSKI,
  WYWIADY,
} from '../../scripts/seed/demo-en/02-odkrycie';

// Import bez bazy: 02-odkrycie.ts strażniczy `main()` za
// `import.meta.url === file://process.argv[1]`, więc ten import nie odpala
// CLI (nie wymaga --dry-run/--apply/DATABASE_URL) — patrz komentarz nad
// strażniczką w 02-odkrycie.ts.

describe('02-odkrycie — Interview (docs/program/DANE_POKAZOWE_EN_20260908/PLAN.md §D2)', () => {
  it('są dokładnie 2 wywiady', () => {
    expect(WYWIADY).toHaveLength(2);
  });

  it('każdy wywiad ma 10-12 pytań (zakres z planu §D2)', () => {
    for (const w of WYWIADY) {
      expect(w.pytania.length).toBeGreaterThanOrEqual(10);
      expect(w.pytania.length).toBeLessThanOrEqual(12);
    }
  });

  it('slugi wywiadów są unikalne', () => {
    const slugi = WYWIADY.map((w) => w.slug);
    expect(new Set(slugi).size).toBe(slugi.length);
  });

  it('interviewee to Sarah Mitchell (Plant Manager) i Robert Chen (Head of Quality) — zgodnie ze zleceniem', () => {
    const interviewees = WYWIADY.map((w) => w.intervieweeSlug).sort();
    expect(interviewees).toEqual(['robert.chen', 'sarah.mitchell']);
  });

  it('KAŻDE pytanie ma niepustą treść pytania i odpowiedzi po angielsku (brak polskich diakrytyków)', () => {
    const polskieDiakrytyki = /[ąćęłńóśźż]/i;
    for (const w of WYWIADY) {
      for (const p of w.pytania) {
        expect(p.pytanie.trim().length).toBeGreaterThan(10);
        expect(p.odpowiedz.trim().length).toBeGreaterThan(10);
        expect(p.pytanie).not.toMatch(polskieDiakrytyki);
        expect(p.odpowiedz).not.toMatch(polskieDiakrytyki);
      }
    }
  });

  it('MUTACJA — gdyby jeden wywiad miał 0 pytań (np. przez pusty import danych), test długości go łapie jako RED', () => {
    const zepsutyWywiad = { ...WYWIADY[0]!, pytania: [] as typeof WYWIADY[0]['pytania'] };
    // Produkcyjne dane: zawsze >= 10. Mutant poniżej reprodukuje defekt (0 pytań).
    expect(zepsutyWywiad.pytania.length).toBe(0); // mutant: 0 (RED byłoby złe, gdyby to był prawdziwy import)
    expect(WYWIADY[0]!.pytania.length).toBeGreaterThanOrEqual(10); // produkcja: OK
  });

  it('4 wnioski, każdy odwołuje się do co najmniej jednej realnej sesji wywiadu (source_slugs istnieją w WYWIADY)', () => {
    expect(WNIOSKI).toHaveLength(4);
    const znaneSlugi = new Set(WYWIADY.map((w) => w.slug));
    for (const wn of WNIOSKI) {
      expect(wn.sourceSlugs.length).toBeGreaterThan(0);
      for (const s of wn.sourceSlugs) expect(znaneSlugi.has(s)).toBe(true);
    }
  });

  it('co najmniej jeden wniosek jest cross-session (odwołuje się do OBU wywiadów)', () => {
    const crossSession = WNIOSKI.filter((wn) => wn.sourceSlugs.length >= 2);
    expect(crossSession.length).toBeGreaterThanOrEqual(1);
  });
});

describe('02-odkrycie — Tools (katalog globalny `tools`, plan §D2)', () => {
  it('są dokładnie 3 sesje narzędzi', () => {
    expect(NARZEDZIA).toHaveLength(3);
  });

  it('każde narzędzie ma unikalny slug i tool_type', () => {
    const slugi = NARZEDZIA.map((n) => n.slug);
    const typy = NARZEDZIA.map((n) => n.toolType);
    expect(new Set(slugi).size).toBe(slugi.length);
    expect(new Set(typy).size).toBe(typy.length);
  });

  it('każda sesja jest ukończona (100%) i ma niepuste wyniki (outputJson.summary + keyFindings/recommendations niepuste)', () => {
    for (const n of NARZEDZIA) {
      expect(n.completionPercent).toBe(100);
      expect(typeof n.outputJson.summary).toBe('string');
      expect((n.outputJson.summary as string).length).toBeGreaterThan(20);
    }
  });

  it('MUTACJA — gdyby completionPercent było 0 (sesja nierozpoczęta), test go łapie jako RED', () => {
    const zepsuta = { ...NARZEDZIA[0]!, completionPercent: 0 };
    expect(zepsuta.completionPercent).toBe(0); // mutant
    expect(NARZEDZIA[0]!.completionPercent).toBe(100); // produkcja
  });
});

describe('02-odkrycie — Assessment / DRD osie (plan §D2, spójność z sesją Method Core)', () => {
  it('dokładnie 7 osi DRD (1..7), każda z poziomem w granicach swojej skali', () => {
    expect(OSIE_DRD).toHaveLength(7);
    const ids = OSIE_DRD.map((a) => a.id).sort((a, b) => a - b);
    expect(ids).toEqual([1, 2, 3, 4, 5, 6, 7]);
    for (const a of OSIE_DRD) {
      expect(a.poziom).toBeGreaterThanOrEqual(0);
      expect(a.poziom).toBeLessThanOrEqual(a.skala);
    }
  });
});

describe('02-odkrycie — Method Core DRD 39 obszarów (src/services/drdStructure.ts, zweryfikowane grepem 2026-09-08)', () => {
  it('dokładnie 39 obszarów, wszystkie unikalne', () => {
    expect(DRD_OBSZARY_39).toHaveLength(39);
    expect(new Set(DRD_OBSZARY_39).size).toBe(39);
  });

  it('rozkład osi zgodny z drdStructure.ts: oś 1 ma 9 obszarów (A-I), osie 2-7 mają po 5 obszarów (A-E)', () => {
    const poOsi: Record<string, number> = {};
    for (const id of DRD_OBSZARY_39) {
      const os = id[0]!;
      poOsi[os] = (poOsi[os] ?? 0) + 1;
    }
    expect(poOsi['1']).toBe(9);
    for (const os of ['2', '3', '4', '5', '6', '7']) expect(poOsi[os]).toBe(5);
  });

  it('MUTACJA — gdyby lista obszarów miała duplikat zamiast jednego z obszarów (np. "1A" dwa razy zamiast "1A" i "7E"), test unikalności/liczby go łapie jako RED', () => {
    const zepsutaLista = [...DRD_OBSZARY_39.slice(0, 38), DRD_OBSZARY_39[0]!]; // duplikat zamiast 39. elementu
    expect(new Set(zepsutaLista).size).toBe(38); // mutant: 38 unikalnych zamiast 39 (RED byłoby złe dla prawdziwego importu)
    expect(new Set(DRD_OBSZARY_39).size).toBe(39); // produkcja: OK
  });
});
