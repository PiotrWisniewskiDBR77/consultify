import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { renderDocumentSchemaToDocxBuffer } from '../../documentStudio/documentDocxRenderer.js';
import {
  buildAssessmentDrdReportSchema,
  CONTRACT_V1_MISSING_SLOT_LIMITS,
  type AssessmentReportContract,
} from '../assessmentDrdReportSchemaService.js';

function contract(): AssessmentReportContract {
  const chapters = Array.from({ length: 7 }, (_, index) => {
    const axisId = index + 1;
    const unitId = `${axisId}A`;
    return {
      axisId,
      axisName: `Axis ${axisId}`,
      axisNamePL: `Oś ${axisId}`,
      maxLevel: axisId === 1 || axisId === 4 ? 7 : axisId === 5 || axisId === 6 ? 6 : 5,
      introduction: { content: null, minWords: 120, maxWords: 180 },
      matrix: {
        caption: { content: null, minWords: 30, maxWords: 60 },
        areas: [
          {
            unitId,
            unitName: `Area ${unitId}`,
            unitNamePL: `Obszar ${unitId}`,
            currentLevel: 1,
            targetLevel: Math.min(4, axisId === 1 || axisId === 4 ? 7 : 5),
            gap: 3,
            skipped: false,
            skipCode: null,
            skips: [] as Array<{ questionId: string; skipCode: string }>,
            evidenceState: 'evidenced' as const,
          },
        ],
      },
      areaComments: [
        {
          unitId,
          content: null,
          minWords: 110,
          maxWords: 170,
          microstructure: [
            'stan_faktyczny',
            'ocena_i_wiarygodnosc',
            'znaczenie_dla_przedsiebiorstwa',
            'luka_i_sens_targetu',
            'najblizszy_krok',
          ] as const,
          skipped: false,
          skipCode: null,
          skips: [] as Array<{ questionId: string; skipCode: string }>,
          answerRefs: [],
          evidenceRefs: [],
          sourceLocators: [],
          uncertainty: 'evidenced' as const,
        },
      ],
      conclusion: {
        content: null,
        minWords: 180,
        maxWords: 260,
        decisionLine: {
          direction: null,
          priority: null,
          horizon: null,
          successCondition: null,
        },
      },
    };
  });
  return {
    contractVersion: 'assessment-report-contract-v1',
    sessionId: 'session-day32-schema',
    outputId: 'output-day32-schema',
    revision: 3,
    generatedAt: '2026-08-28T12:00:00.000Z',
    methodVersion: 'drd-v1',
    sessionLabel: { displayName: 'Zakład Ćmielów', source: 'project', projectId: 'project-1' },
    // Cover-metadata fields (W1). Values are deliberately distinctive so a
    // `toContain` on the rendered `word/document.xml` cannot pass by
    // accident on some other string in the document.
    businessProfile: 'Ceramika techniczna · odlewnictwo precyzyjne',
    employment: '3 osoby',
    assessmentPeriod: '11 – 14 sierpnia 2026',
    assessor: 'Anna Kowalczyk',
    clientSponsor: null,
    chapters,
  } as AssessmentReportContract;
}

async function renderedDocumentXml(
  schema: ReturnType<typeof buildAssessmentDrdReportSchema>
): Promise<string> {
  const zip = await JSZip.loadAsync(await renderDocumentSchemaToDocxBuffer(schema));
  const xml = await zip.file('word/document.xml')?.async('string');
  if (!xml) throw new Error('word/document.xml missing from rendered DOCX');
  return xml;
}

function metadata(schema: ReturnType<typeof buildAssessmentDrdReportSchema>) {
  const value = schema.drdReportMetadata;
  if (!value) throw new Error('drdReportMetadata missing — DRD cover profile not built');
  return value;
}

function allText(schema: ReturnType<typeof buildAssessmentDrdReportSchema>): string {
  return JSON.stringify(schema);
}

describe('Day 32 — assessment contract to DRD document schema', () => {
  it('builds cover/TOC/summary, seven chapters, conclusions, and appendix deterministically', async () => {
    const input = contract();
    const first = buildAssessmentDrdReportSchema(input);
    const second = buildAssessmentDrdReportSchema(input);
    expect(second).toEqual(first);
    // 11 = streszczenie + 7 osi + wnioski końcowe + Załącznik A (rejestr luk)
    // + Załącznik B (nota metodyczna, dodany 2026-09-06 — siódmy rozdział
    // kontraktu DEC-46, którego dokument dotąd nie miał).
    expect(first.sections).toHaveLength(11);
    expect(first.sections.map((section) => section.sectionId)).toEqual([
      'executive-summary',
      'axis-1',
      'axis-2',
      'axis-3',
      'axis-4',
      'axis-5',
      'axis-6',
      'axis-7',
      'final-conclusions',
      'gap-register',
      'methodology-appendix',
    ]);
    for (const section of first.sections.slice(1, 8)) {
      const headings = section.blocks
        .filter((block) => block.type === 'heading')
        .map((block) => (block.content as { text: string }).text);
      expect(headings).toEqual(
        expect.arrayContaining([
          'Matryca poziomów dojrzałości',
          'Ocena obszarów',
          'Wnioski rozdziału',
        ])
      );
    }
    const zip = await JSZip.loadAsync(await renderDocumentSchemaToDocxBuffer(first));
    const xml = await zip.file('word/document.xml')?.async('string');
    expect(xml).toContain('TOC \\h \\o &quot;1-2&quot;');
    expect(xml).toContain('Zakład Ćmielów');
  });

  it('keeps null levels visible as em dash and never turns them into zero', () => {
    const input = contract();
    input.chapters[0].matrix.areas[0].currentLevel = null;
    input.chapters[0].matrix.areas[0].targetLevel = null;
    input.chapters[0].matrix.areas[0].gap = null;
    const text = allText(buildAssessmentDrdReportSchema(input));
    expect(text).toContain('Poziom obecny: —');
    expect(text).not.toContain('Poziom obecny: 0');
  });

  it('represents an entirely unassessed axis with missing radar points and an explicit notice', () => {
    const input = contract();
    for (const area of input.chapters[2].matrix.areas) {
      area.currentLevel = null;
      area.targetLevel = null;
      area.gap = null;
    }
    const schema = buildAssessmentDrdReportSchema(input);
    const radar = schema.sections[0].blocks.find((block) => block.blockId === 'executive-radar');
    const series = (radar?.content as { series: Array<{ values: Array<number | null> }> }).series;
    expect(series[0].values[2]).toBeNull();
    expect(series[1].values[2]).toBeNull();
    expect(allText(schema)).toContain('Oś nie została oceniona.');
  });

  it('keeps a fully skipped area with its code and excludes it from averages', () => {
    const input = contract();
    const area = input.chapters[0].matrix.areas[0];
    area.skipped = true;
    area.skipCode = 'OUT_OF_SCOPE';
    const schema = buildAssessmentDrdReportSchema(input);
    expect(allText(schema)).toContain('Obszar pominięty w ocenie — kod: OUT_OF_SCOPE.');
    const radar = schema.sections[0].blocks.find((block) => block.blockId === 'executive-radar');
    expect(
      (radar?.content as { series: Array<{ values: Array<number | null> }> }).series[0].values[0]
    ).toBeNull();
  });

  it('keeps a partially skipped area assessed and lists every skipped question', () => {
    const input = contract();
    input.chapters[1].matrix.areas[0].skips = [
      { questionId: '2A-L2', skipCode: 'NO_DATA' },
      { questionId: '2A-L4', skipCode: 'NOT_APPLICABLE' },
    ];
    const schema = buildAssessmentDrdReportSchema(input);
    const text = allText(schema);
    expect(text).toContain('Pominięte pytania: 2A-L2 — NO_DATA; 2A-L4 — NOT_APPLICABLE.');
    const radar = schema.sections[0].blocks.find((block) => block.blockId === 'executive-radar');
    expect(
      (radar?.content as { series: Array<{ values: Array<number | null> }> }).series[0].values[1]
    ).not.toBeNull();
  });

  it('uses placeholders only for null slots and preserves supplied contract content', () => {
    const input = contract();
    (input.chapters[0].introduction as { content: string | null }).content =
      'Treść zatwierdzona w kontrakcie i zachowana bez zmian.';
    const schema = buildAssessmentDrdReportSchema(input);
    const axisOne = schema.sections.find((section) => section.sectionId === 'axis-1')!;
    // 2026-09-06: pusty slot mówi to samo, ale językiem raportu, nie
    // instrukcją redakcyjną („Sekcja do uzupełnienia — limit … słów") —
    // patrz `placeholder()` w schema service. Wszystkie puste sloty mają
    // dziś JEDNO zdanie, więc asercja „ten slot nie jest placeholderem" musi
    // patrzeć na KONKRETNY blok, a nie szukać napisu w całym dokumencie.
    const wstep = axisOne.blocks.find((block) => block.blockId === `axis-${1}-intro`);
    const tekstWstepu = JSON.stringify(wstep ?? axisOne.blocks[0]);
    expect(JSON.stringify(axisOne)).toContain(
      'Treść zatwierdzona w kontrakcie i zachowana bez zmian.'
    );
    expect(tekstWstepu).not.toContain('Brak treści w tej sekcji');
    expect(allText(schema)).toContain(
      'Brak treści w tej sekcji — ocena nie zawiera danych, z których dałoby się ją napisać.'
    );
  });

  it('does not smuggle Metalpol, lorem ipsum, or model-generated prose into the output', () => {
    const text = allText(buildAssessmentDrdReportSchema(contract()));
    expect(text).not.toMatch(/Metalpol|lorem ipsum|jako model|as an AI/i);
    // FIX-3 (nadzorca 2026-08-28, second pass): the area-comment fallback
    // used to be the raw editorial instruction
    // ('Sekcja do uzupełnienia — limit 110–170 słów; wymagane: ...'), which
    // reads as an unfinished template in a client-facing document. It is
    // now an honest, jargon-free sentence — see areaCommentPlaceholder() in
    // assessmentDrdReportSchemaService.ts. The fixture area here is
    // `evidenceState: 'evidenced'` (assessed, just no composed narrative),
    // so the honest sentence does NOT claim "not assessed".
    // (asercja o placeholderze sekcji usunięta 2026-09-06: puste sloty mają
    // dziś jedno wspólne zdanie, więc obecność tego napisu w CAŁYM dokumencie
    // nic nie mówi o komentarzu obszaru; kontrola komentarza jest w linii niżej)
    expect(text).toContain('Komentarz obszaru 1A nie został przygotowany.');
  });

  it('FIX-3: an area with no finding gets an honest "not assessed" comment, never the raw editorial placeholder', () => {
    const input = contract();
    input.chapters[0].matrix.areas[0].evidenceState = 'not_assessed';
    input.chapters[0].matrix.areas[0].currentLevel = null;
    input.chapters[0].matrix.areas[0].targetLevel = null;
    input.chapters[0].matrix.areas[0].gap = null;
    const text = allText(buildAssessmentDrdReportSchema(input));
    expect(text).toContain('Obszaru 1A nie oceniono — brak danych źródłowych.');
    // DEDUP (nadzorca 2026-08-28): this sentence used to print twice for
    // every not-assessed area with no skip notice — once as the dedicated
    // not-assessed notice paragraph, once again as the area-comment
    // fallback (areaCommentPlaceholder). The fallback is now suppressed for
    // `not_assessed` areas, so it must appear exactly once.
    const occurrences = text.split('Obszaru 1A nie oceniono — brak danych źródłowych.').length - 1;
    expect(occurrences).toBe(1);
  });

  it('FIX-3: a deliberately skipped area does not also get a contradicting "not assessed" comment line', () => {
    const input = contract();
    const area = input.chapters[0].matrix.areas[0];
    area.skipped = true;
    area.skipCode = 'OUT_OF_SCOPE';
    const text = allText(buildAssessmentDrdReportSchema(input));
    expect(text).toContain('Obszar pominięty w ocenie — kod: OUT_OF_SCOPE.');
    // The skip notice already explains the gap honestly — no second,
    // contradicting "not assessed" sentence and no raw editorial
    // placeholder underneath it.
    expect(text).not.toContain('nie oceniono — brak danych źródłowych');
    expect(text).not.toContain('Komentarz obszaru 1A nie został przygotowany.');
  });
});

// ---------------------------------------------------------------------------
// FIX-1 (nadzorca 2026-08-28): the four W1–W4 cover fixes shipped with ZERO
// test coverage — reverting all three changed files left the suite result
// bit-identical (55 PASS / 1 FAIL before and after). Exactly one test reached
// the cover code and it asserted no metadata field at all. Every `it` below
// is written so that reverting its fix turns it red; the mutation proof is
// recorded in the task report.
// ---------------------------------------------------------------------------
describe('DRD cover — regression guards for the W1–W4 fixes', () => {
  it('W2 — session signature is a human-readable code, never the raw session id', () => {
    const input = contract();
    const signature = metadata(buildAssessmentDrdReportSchema(input)).sessionSignature;
    expect(signature).toMatch(/^DRD-\d{4}-\d{4}-[A-Z]{3}/);
    expect(signature).not.toBe(input.sessionId);
    expect(signature).not.toContain(input.sessionId);
  });

  it('W2/FIX-2 — the signature identifies the session, and is stable on re-render', () => {
    const first = contract();
    const second = contract();
    second.sessionId = 'session-day32-schema-SECOND';
    const firstSignature = metadata(buildAssessmentDrdReportSchema(first)).sessionSignature;
    const secondSignature = metadata(buildAssessmentDrdReportSchema(second)).sessionSignature;
    // Two different sessions of the same client, frozen the same day, must
    // not share a signature — the pre-FIX-2 `(clientName, generatedAt)`
    // input collided here (measured: Metalpol Sp. z o.o. / Metalpolska S.A.
    // / Metal Polska all produced DRD-2026-0827-MTL).
    expect(secondSignature).not.toBe(firstSignature);
    expect(secondSignature).toMatch(/^DRD-\d{4}-\d{4}-[A-Z]{3}/);
    // Same frozen output rendered twice reproduces the identical code.
    expect(metadata(buildAssessmentDrdReportSchema(contract())).sessionSignature).toBe(
      firstSignature
    );
  });

  it('W2/FIX-2 — Ł is transliterated, not deleted, in the client skeleton', () => {
    const input = contract();
    input.sessionLabel.displayName = 'Łódź S.A.';
    const signature = metadata(buildAssessmentDrdReportSchema(input)).sessionSignature;
    // Before the fix NFD left `Ł` intact and `[^a-zA-Z]` deleted it, so the
    // client's own initial vanished: `Łódź S.A.` -> `ODZ`.
    expect(signature).toMatch(/^DRD-\d{4}-\d{4}-LDZ-/);
    expect(signature).not.toMatch(/^DRD-\d{4}-\d{4}-ODZ/);
  });

  it('W3 — the rendered cover date is Polish long form and no ISO date survives', async () => {
    const xml = await renderedDocumentXml(buildAssessmentDrdReportSchema(contract()));
    expect(xml).toContain('28 sierpnia 2026');
    expect(xml).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('W4 — every non-Horyzont decision-line cell carries the short field limit (24 of them); Horyzont is always the honest FIX-3 sentence (8 of them)', () => {
    const schema = buildAssessmentDrdReportSchema(contract());
    // 2026-09-06: limit słów przestał być drukowany w treści dla klienta —
    // slot pusty mówi to wprost zdaniem raportu. Limity nadal żyją w
    // kontrakcie (`CONTRACT_V1_MISSING_SLOT_LIMITS`), tylko nie w pliku.
    void CONTRACT_V1_MISSING_SLOT_LIMITS.decisionLineField;
    const expected =
      'Brak treści w tej sekcji — ocena nie zawiera danych, z których dałoby się ją napisać.';
    // FIX-3 (nadzorca 2026-08-28): "Horyzont" is never populated by the
    // composer (assessmentNarrativeComposer.ts always sets `horizon: null`)
    // — printing the raw editorial placeholder there is therefore not a
    // "missing slot", it's a structural certainty, so it gets its own
    // honest sentence instead (see HORIZON_PLACEHOLDER). The other three
    // cells (Kierunek/Priorytet/Warunek sukcesu) are unaffected by this fix
    // and keep the generic placeholder when genuinely empty.
    // 7 per-axis decision tables + 1 programme-level table, 4 cells each:
    // 3 generic-placeholder cells + 1 Horyzont cell per table.
    // 2026-09-06: zliczanie po napisie przestało rozróżniać sloty (wszystkie
    // puste sloty mają jedno zdanie), więc liczymy STRUKTURALNIE — komórki
    // tabel linii decyzyjnej, a nie wystąpienia napisu w całym dokumencie.
    const komorkiLiniiDecyzyjnej = schema.sections
      .flatMap((section) => section.blocks)
      .filter((block) => /decision/.test(block.blockId) && block.type === 'table')
      .flatMap((block) => (block.content as { rows: unknown[][] }).rows)
      .map((row) => String(row[1]));
    const genericOccurrences = komorkiLiniiDecyzyjnej.filter((cell) => cell === expected).length;
    expect(genericOccurrences).toBe(24);
    const horizonOccurrences = komorkiLiniiDecyzyjnej.filter(
      (cell) => cell === 'Nie określono — brak źródła w danych.'
    ).length;
    expect(horizonOccurrences).toBe(8);
    for (const section of schema.sections) {
      const decision = section.blocks.find((block) => block.blockId.endsWith('-decision'));
      if (!decision) continue;
      const rows = (decision.content as { rows: Array<Array<unknown>> }).rows;
      expect(rows).toHaveLength(4);
      for (const row of rows) {
        if (row[0] === 'Horyzont') {
          expect(row[1]).toBe('Nie określono — brak źródła w danych.');
        } else {
          expect(row[1]).toBe(expected);
        }
      }
    }
  });

  it('W1 — every cover field supplied by the contract reaches the rendered cover', async () => {
    const input = contract();
    const schema = buildAssessmentDrdReportSchema(input);
    const meta = metadata(schema);
    expect(meta.businessProfile).toBe(input.businessProfile);
    expect(meta.employment).toBe(input.employment);
    expect(meta.assessmentPeriod).toBe(input.assessmentPeriod);
    expect(meta.assessor).toBe(input.assessor);

    const xml = await renderedDocumentXml(schema);
    for (const value of [
      'Ceramika techniczna · odlewnictwo precyzyjne',
      '3 osoby',
      '11 – 14 sierpnia 2026',
      'Anna Kowalczyk',
    ]) {
      expect(xml).toContain(value);
    }
    // Sponsor has no source in the schema — it must stay an honest gap, and
    // it must be the ONLY remaining gap on the cover.
    expect(meta.clientSponsor).toBeNull();
    expect(xml.match(/Do uzupełnienia/g)).toHaveLength(1);
  });

  it('W1 — a contract with no cover data renders honest placeholders, never invented text', async () => {
    const input = contract();
    input.businessProfile = null;
    input.employment = null;
    input.assessmentPeriod = null;
    input.assessor = null;
    const xml = await renderedDocumentXml(buildAssessmentDrdReportSchema(input));
    expect(xml.match(/Do uzupełnienia/g)).toHaveLength(5);
    expect(xml).not.toContain('General');
    expect(xml).not.toMatch(/@[a-z0-9.-]+\.[a-z]{2,}/i);
  });
});
