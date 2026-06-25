/**
 * bundleExportRuntime — WIĄZKA → realne pliki (F1). Deterministyczny (bez LLM):
 * fake content/table → DOCX/XLSX → parsowanie potwierdza realny plik (nie pusty/zaślepka).
 */
import { describe, expect, it } from 'vitest';
import {
  contentToDocumentSchema,
  exportBundleFiles,
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

  it('pptx=null gdy brak deck planów w wiązce', async () => {
    const files = await exportBundleFiles(bundle);
    expect(files.pptx).toBeNull();
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
});
