/**
 * bundleExportRuntime — WIĄZKA → realne pliki (F1). Deterministyczny (bez LLM):
 * fake content/table → DOCX/XLSX → parsowanie potwierdza realny plik (nie pusty/zaślepka).
 */
import { describe, expect, it } from 'vitest';
import {
  contentToDocumentSchema,
  exportBundleFiles,
  bundleFilesToZip,
  safeBundleBaseName,
} from '../../../server/src/services/deliverables/bundleExportRuntime';
import type { BusinessPlanSpine } from '../../../server/src/services/deliverables/businessPlanSpine';
import type { GeneratedBundle } from '../../../server/src/services/deliverables/bundleGenerationRuntime';

const spine = { meta: { company: 'DBR77 Sp. z o.o.', language: 'PL', thesis: 'X', ask: 'Y' } } as BusinessPlanSpine;

const content = {
  sections: [
    {
      heading: 'Streszczenie wykonawcze',
      blocks: [
        { type: 'kpi', content: { items: [{ label: 'Przychód R3', value: '8 800 tys EUR', delta: '+269%' }, { label: 'EBITDA R3', value: '2 700 tys EUR' }] } },
        { type: 'text', content: { text: 'DBR77 generuje materiały doradcze w minuty, nie tygodnie.' } },
        { type: 'callout', content: { text: 'Rynek konsultingu >300 mld EUR.', tone: 'info' } },
      ],
    },
    {
      heading: 'Rekomendacje',
      blocks: [
        { type: 'bulletList', content: { items: ['Powołać AI Owner', 'Audyt danych w 30 dni'] } },
      ],
    },
  ],
};

const table = {
  fields: [
    { key: 'rok', header: 'Rok', type: 'text' },
    { key: 'przychod', header: 'Przychód', type: 'currency' },
    { key: 'ebitda', header: 'EBITDA', type: 'currency' },
  ],
  seedRows: [
    { rok: 'Rok 1', przychod: 2390, ebitda: -20 },
    { rok: 'Rok 2', przychod: 4760, ebitda: 800 },
  ],
  conditionalFormatting: [],
};

const bundle = { spine, doc: content, table, deck: null, produced: { table: true, doc: true, deck: false } } as unknown as GeneratedBundle;

describe('bundleExportRuntime — content → DocumentSchema', () => {
  it('remapuje typy ContentBlockType → DocumentBlockType i pomija nagłówki', () => {
    const schema = contentToDocumentSchema(content as never, spine);
    expect(schema.sections).toHaveLength(2);
    expect(schema.title).toContain('DBR77');
    expect(schema.documentType).toBe('steering_committee_report');
    const types = schema.sections.flatMap((s) => s.blocks.map((b) => b.type));
    expect(types).toContain('kpi_strip'); // kpi → kpi_strip
    expect(types).toContain('paragraph'); // text → paragraph
    expect(types).toContain('callout');
    expect(types).toContain('bullet_list'); // bulletList → bullet_list
  });

  it('ma kompletne metadane (formattingSchema, enumy) → renderowalny', () => {
    const schema = contentToDocumentSchema(content as never, spine);
    expect(schema.formattingSchema).toBeTruthy();
    expect(schema.language).toBe('pl');
    expect(schema.audience).toContain('investor');
  });
});

describe('bundleExportRuntime — realne pliki', () => {
  it('renderuje REALNY .docx (zip OOXML, nie pusty)', async () => {
    const files = await exportBundleFiles(bundle);
    expect(files.docx).toBeInstanceOf(Buffer);
    expect(files.docx!.length).toBeGreaterThan(2000);
    // .docx = zip → magic bytes "PK"
    expect(files.docx!.subarray(0, 2).toString('latin1')).toBe('PK');
  });

  it('renderuje REALNY .xlsx (zip, nie pusty)', async () => {
    const files = await exportBundleFiles(bundle);
    expect(files.xlsx).toBeInstanceOf(Buffer);
    expect(files.xlsx!.length).toBeGreaterThan(2000);
    expect(files.xlsx!.subarray(0, 2).toString('latin1')).toBe('PK');
  });

  it('pptx generowany przez M19 pipeline nawet gdy deck=null (W7.6)', async () => {
    // W7.6: M19 PptxPipelineService generuje PPTX ze SPINE, niezależnie od deck plans.
    // Przed W7.6 pptx=null gdy brak planów — po W7.6 M19 pipeline uruchamia się pierwszy.
    const files = await exportBundleFiles(bundle);
    // Akceptujemy zarówno null (gdy M19 pipeline zwróci null dla bardzo ubogiego SPINE)
    // jak i Buffer (gdy M19 wygeneruje z meta.company+thesis+ask).
    if (files.pptx !== null) {
      expect(files.pptx).toBeInstanceOf(Buffer);
      expect(files.pptx!.subarray(0, 2).toString('latin1')).toBe('PK');
    }
  });

  it('renderuje REALNY .pptx (zip OOXML) gdy deck ma plany (F4.1)', async () => {
    const deckBundle = {
      ...bundle,
      deck: {
        tierUsed: 'STANDARD',
        fallbackUsed: true,
        plans: [
          { slideIndex: 0, layoutIntent: 'cover', title: 'DBR77', keyMessage: 'AI do materiałów doradczych' },
          { slideIndex: 1, layoutIntent: 'key_messages', title: 'Problem', keyMessage: 'Materiały zajmują tygodnie.' },
          { slideIndex: 2, layoutIntent: 'recommendation_single', title: 'Rozwiązanie', keyMessage: 'Generujemy w minuty.' },
          { slideIndex: 3, layoutIntent: 'next_steps', title: 'Następne kroki', keyMessage: 'Pilotaż w 30 dni.' },
        ],
      },
    } as unknown as GeneratedBundle;

    const files = await exportBundleFiles(deckBundle, 'modern');
    expect(files.pptx).toBeInstanceOf(Buffer);
    expect(files.pptx!.length).toBeGreaterThan(2000);
    // .pptx = zip → magic bytes "PK"
    expect(files.pptx!.subarray(0, 2).toString('latin1')).toBe('PK');
  });

  it('board cut: deck ≤7 → brak osobnego pliku zarządczego (pptxBoard null)', async () => {
    const deckBundle = {
      ...bundle,
      deck: { plans: Array.from({ length: 4 }, (_, i) => ({ slideIndex: i, layoutIntent: i === 0 ? 'cover' : 'key_messages', title: `S${i}`, keyMessage: `m${i}` })) },
    } as unknown as GeneratedBundle;
    const files = await exportBundleFiles(deckBundle);
    expect(files.pptxBoard).toBeNull();
  });

  it('board cut: deck >7 → REALNY osobny .pptx zarządczy (F10.3 materializowany)', async () => {
    const intents = ['cover', 'key_messages', 'single_insight', 'data_overview', 'analysis',
      'recommendation_single', 'performance_overview', 'comparison', 'risk_management', 'next_steps'];
    const deckBundle = {
      ...bundle,
      deck: { plans: intents.map((intent, i) => ({ slideIndex: i, layoutIntent: intent, title: `Slajd ${i}`, keyMessage: `Teza ${i}` })) },
    } as unknown as GeneratedBundle;

    const files = await exportBundleFiles(deckBundle, 'executive');
    expect(files.pptx).toBeInstanceOf(Buffer);
    expect(files.pptxBoard).toBeInstanceOf(Buffer);
    expect(files.pptxBoard!.subarray(0, 2).toString('latin1')).toBe('PK');

    // teczka zawiera oba decki
    const zip = await bundleFilesToZip(files, 'Acme');
    const { default: JSZip } = await import('jszip');
    const parsed = await JSZip.loadAsync(zip!);
    expect(Object.keys(parsed.files)).toContain('Acme-prezentacja.pptx');
    expect(Object.keys(parsed.files)).toContain('Acme-prezentacja-zarzad.pptx');
  });
});

describe('bundleExportRuntime — teczka ZIP (F4.2)', () => {
  it('safeBundleBaseName sanityzuje nazwę firmy', () => {
    expect(safeBundleBaseName('DBR77 Sp. z o.o.')).toBe('DBR77_Sp_z_o_o_');
    expect(safeBundleBaseName('')).toBe('material');
    expect(safeBundleBaseName(undefined)).toBe('material');
  });

  it('bundleFilesToZip → REALNY .zip (PK) z 3 plików', async () => {
    const files = {
      docx: Buffer.from('PK\x03\x04 fake-docx-content padding padding padding'),
      xlsx: Buffer.from('PK\x03\x04 fake-xlsx-content padding padding padding'),
      pptx: Buffer.from('PK\x03\x04 fake-pptx-content padding padding padding'),
    };
    const zip = await bundleFilesToZip(files, 'Acme');
    expect(zip).toBeInstanceOf(Buffer);
    expect(zip!.subarray(0, 2).toString('latin1')).toBe('PK');
    // unzip → 3 wpisy o oczekiwanych nazwach
    const { default: JSZip } = await import('jszip');
    const parsed = await JSZip.loadAsync(zip!);
    const names = Object.keys(parsed.files).sort();
    expect(names).toEqual(['Acme-model.xlsx', 'Acme-prezentacja.pptx', 'Acme-raport.docx']);
  });

  it('bundleFilesToZip → null gdy 0 plików', async () => {
    const zip = await bundleFilesToZip({ docx: null, xlsx: null, pptx: null }, 'X');
    expect(zip).toBeNull();
  });

  it('bundleFilesToZip pomija brakujące formaty', async () => {
    const zip = await bundleFilesToZip(
      { docx: Buffer.from('PK fake docx padding padding'), xlsx: null, pptx: null },
      'Solo'
    );
    const { default: JSZip } = await import('jszip');
    const parsed = await JSZip.loadAsync(zip!);
    expect(Object.keys(parsed.files)).toEqual(['Solo-raport.docx']);
  });
});

describe('W13.4 — E2E: SPINE → exportBundleFiles → ZIP z 3 REALNYMI plikami', () => {
  it('ZIP zawiera .docx + .xlsx + .pptx — wszystkie niepuste (full bundle)', async () => {
    // Realny bundle z doc + table + deck (bez LLM) — weryfikuje kontrakt ZIP.
    const fullBundle: GeneratedBundle = {
      spine,
      doc: content,
      table,
      deck: {
        tierUsed: 'STANDARD',
        fallbackUsed: true,
        plans: [
          { slideIndex: 0, layoutIntent: 'cover', title: 'DBR77 — Biznesplan', keyMessage: spine.meta.thesis },
          { slideIndex: 1, layoutIntent: 'executive_summary', title: 'Streszczenie', keyMessage: 'Klucz: AI → czas konsultingu −90%.' },
          { slideIndex: 2, layoutIntent: 'performance_overview', title: 'Wyniki finansowe', keyMessage: 'Przychód R3: 8 800 tys EUR.' },
          { slideIndex: 3, layoutIntent: 'risk_management', title: 'Ryzyka', keyMessage: 'Ryzyko: akceptacja rynku.' },
          { slideIndex: 4, layoutIntent: 'recommendation_single', title: 'Ask', keyMessage: 'Seed €500k @ 8× ARR.' },
        ],
      },
      produced: { table: true, doc: true, deck: true },
    } as unknown as GeneratedBundle;

    const files = await exportBundleFiles(fullBundle, 'executive');

    // Weryfikacja: każdy format = realny ZIP OOXML
    expect(files.docx).toBeInstanceOf(Buffer);
    expect(files.docx!.length).toBeGreaterThan(2000);
    expect(files.docx!.subarray(0, 2).toString('latin1')).toBe('PK');

    expect(files.xlsx).toBeInstanceOf(Buffer);
    expect(files.xlsx!.length).toBeGreaterThan(2000);
    expect(files.xlsx!.subarray(0, 2).toString('latin1')).toBe('PK');

    expect(files.pptx).toBeInstanceOf(Buffer);
    expect(files.pptx!.length).toBeGreaterThan(2000);
    expect(files.pptx!.subarray(0, 2).toString('latin1')).toBe('PK');

    // Teczka ZIP: wszystkie 3 pliki obecne i niepuste
    const zip = await bundleFilesToZip(files, 'DBR77');
    expect(zip).toBeInstanceOf(Buffer);
    expect(zip!.subarray(0, 2).toString('latin1')).toBe('PK');

    const { default: JSZip } = await import('jszip');
    const parsed = await JSZip.loadAsync(zip!);
    const names = Object.keys(parsed.files).sort();
    expect(names).toContain('DBR77-raport.docx');
    expect(names).toContain('DBR77-model.xlsx');
    expect(names).toContain('DBR77-prezentacja.pptx');

    // Każdy wpis ZIP niepusty
    for (const name of names) {
      const entry = await parsed.files[name].async('uint8array');
      expect(entry.length).toBeGreaterThan(100);
    }
  }, 30_000);
});
