/**
 * DEC-461 / fala J1 — the DRD pack compiles in the viewer's language.
 *
 * Premise this test defends: the curated EN corpus
 * (`drdKnowledgeOverridesAxis*.en.ts`, `whyThisMatters.ts` `{en,pl}`) already
 * existed and `getDRDKnowledge(areaId, level, 'en')` already served it — but
 * `compileDrdPack()` called it with a hardcoded `'pl'`, set `whyItMatters`
 * from `whyHint.pl`, named units from `area.namePL`, and declared
 * `manifest.languages: ['pl']`. A library with no caller ("biblioteka bez
 * wywołania"): an EN user read a Polish questionnaire. This file measures the
 * wiring, not the translation.
 */
import { describe, expect, it } from 'vitest';

import { compileDrdPack } from '../compileDrdPack';

/** Any Polish diacritic. The cheapest honest detector of "this is Polish text". */
const POLSKIE_ZNAKI = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

describe('compileDrdPack — language is wired, not hardcoded', () => {
  it('EN: unit names, question wording, whyItMatters and evidence carry no Polish characters', () => {
    const { pack } = compileDrdPack('en');

    expect(pack.units.filter((u) => POLSKIE_ZNAKI.test(u.name))).toEqual([]);
    expect(pack.units.filter((u) => POLSKIE_ZNAKI.test(u.description))).toEqual([]);
    expect(
      pack.questions.filter((q) => POLSKIE_ZNAKI.test(q.canonicalWording)).map((q) => q.questionId)
    ).toEqual([]);
    expect(
      pack.questions.filter((q) => POLSKIE_ZNAKI.test(q.whyItMatters)).map((q) => q.questionId)
    ).toEqual([]);
    expect(
      pack.levels
        .filter((l) => l.expectedEvidence.some((e) => POLSKIE_ZNAKI.test(e)))
        .map((l) => `${l.unitId}#${l.level}`)
    ).toEqual([]);
  });

  it('EN: the "Evidence:" label is stripped the same way the PL "Dowód:" label is', () => {
    const { pack } = compileDrdPack('en');
    const withLabel = pack.levels.filter((l) =>
      l.expectedEvidence.some((e) => /^(Evidence|Dow[oó]d)\s*:/i.test(e))
    );
    expect(withLabel.map((l) => `${l.unitId}#${l.level}`)).toEqual([]);
  });

  it('PL: still the Polish corpus — no accidental flip to English', () => {
    const { pack } = compileDrdPack('pl');

    // Area names: 17 of 39 have Polish diacritics in `namePL`. The point is
    // that SOME do — "0" here would mean PL silently fell through to EN.
    expect(pack.units.filter((u) => POLSKIE_ZNAKI.test(u.name)).length).toBeGreaterThan(0);
    // whyItMatters is the axis hint; all 7 PL hints carry diacritics, so every
    // question must.
    expect(pack.questions.every((q) => POLSKIE_ZNAKI.test(q.whyItMatters))).toBe(true);
  });

  it('PL and EN are the SAME structure — zero regression in shape or ids', () => {
    const pl = compileDrdPack('pl').pack;
    const en = compileDrdPack('en').pack;

    expect(pl.units).toHaveLength(39);
    expect(pl.levels).toHaveLength(233);
    expect(pl.questions).toHaveLength(699);

    expect(en.units.map((u) => u.unitId)).toEqual(pl.units.map((u) => u.unitId));
    expect(en.levels.map((l) => `${l.unitId}#${l.level}`)).toEqual(
      pl.levels.map((l) => `${l.unitId}#${l.level}`)
    );
    expect(en.questions.map((q) => q.questionId)).toEqual(pl.questions.map((q) => q.questionId));
    expect(en.manifest.version).toBe(pl.manifest.version);
    // Scoring must not depend on the label language.
    expect(en.scoringFixtures).toEqual(pl.scoringFixtures);
    expect(compileDrdPack('en').report.coverage).toEqual(compileDrdPack('pl').report.coverage);
  });

  it('the manifest declares both languages and names the one THIS result carries', () => {
    expect(compileDrdPack('en').pack.manifest.languages).toEqual(['en', 'pl']);
    expect(compileDrdPack('en').pack.manifest.compiledLanguage).toBe('en');
    expect(compileDrdPack('pl').pack.manifest.compiledLanguage).toBe('pl');
  });

  it('EN is the default (DEC-461) — a bare call is not Polish', () => {
    expect(compileDrdPack().pack.manifest.compiledLanguage).toBe('en');
    expect(compileDrdPack().pack.units[0].name).toBe(compileDrdPack('en').pack.units[0].name);
  });

  it('the cache is PER LANGUAGE — asking for PL after EN does not hand back the EN pack', () => {
    const en1 = compileDrdPack('en');
    const pl1 = compileDrdPack('pl');
    const en2 = compileDrdPack('en');
    const pl2 = compileDrdPack('pl');

    // Identity: same language -> same cached object (the cheapness the screens rely on).
    expect(en2).toBe(en1);
    expect(pl2).toBe(pl1);
    // ...and the two languages are genuinely different objects with different content.
    expect(en1).not.toBe(pl1);
    expect(en1.pack.questions[0].canonicalWording).not.toBe(pl1.pack.questions[0].canonicalWording);
  });

  /**
   * ★ FALA J3 (2026-09-14) — TEN SAM LICZNIK, ZAMKNIĘTY.
   * Poprzednia wersja tego bloku przypinała liczbę 25 („tyle polskich tytułów
   * poziomów przechodzi do kompilacji EN") jako UCZCIWY POMIAR LUKI. Luka
   * została zamknięta wariantem `titleEN`/`descriptionEN` w `DRD_STRUCTURE`,
   * więc licznik schodzi do ZERA — i zostaje przypięty na zero, żeby usunięcie
   * albo pominięcie wariantu wywróciło ten test, zamiast po cichu wrócić.
   *
   * Dowód mutacyjny: skasuj `titleEN` z dowolnego poziomu osi 5/6 → pierwsza
   * asercja pokazuje ten poziom; cofnij `(lang === 'en' && lvl.titleEN)`
   * w kompilatorze → wraca 25 i 60.
   */
  it('EN: ani jeden tytuł/opis poziomu nie zostaje po polsku (było 25 tytułów, 53 opisy)', () => {
    const en = compileDrdPack('en').pack;

    expect(en.levels.filter((l) => POLSKIE_ZNAKI.test(l.title)).map((l) => `${l.unitId}#${l.level}`)).toEqual([]);
    expect(
      en.levels
        .filter((l) => POLSKIE_ZNAKI.test(l.canonicalDefinition))
        .map((l) => `${l.unitId}#${l.level}`)
    ).toEqual([]);
    // Przesłanka: to naprawdę osie 5 i 6 dostały wariant, a nie „zniknęły"
    // z kompilacji — 60 poziomów, po 30 na oś.
    expect(en.levels.filter((l) => l.unitId.startsWith('5') || l.unitId.startsWith('6'))).toHaveLength(60);
  });

  it('PL: ten sam kompilat zostaje przy polskim oryginale osi 5 i 6', () => {
    const pl = compileDrdPack('pl').pack;
    const polskie = pl.levels.filter((l) => POLSKIE_ZNAKI.test(l.title));
    expect(polskie).toHaveLength(25);
    expect([...new Set(polskie.map((l) => l.unitId[0]))].sort()).toEqual(['5', '6']);
  });

  it('kompilator MÓWI, że angielski wariant osi 5/6 czeka na akcept właściciela metodyki', () => {
    expect(
      compileDrdPack('en').report.discrepancies.some((d) =>
        d.includes("AWAITING THE METHODOLOGY OWNER'S SIGN-OFF")
      )
    ).toBe(true);
  });
});
