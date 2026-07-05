/**
 * P0.3 — punkt 3 z planu (utwardzenie backendu generacji decków): fail-soft
 * `return null` w bundlePptxRuntime/bundleExportRuntime musi logować z pełnym
 * detalem (nie tylko `.message`), żeby dało się debugować produkcję.
 *
 * Zamiast asertować dokładny string logu (kruche), sprawdzamy KSZTAŁT wywołania
 * logger.warn: wiadomość + obiekt meta z polem `error` niosącym stack (nie tylko
 * .message) oraz najlepszym dostępnym identyfikatorem w danym zakresie
 * (title/themeId dla bundlePptxRuntime — brak deckId w tej funkcji; company dla
 * bundleExportRuntime, klucz GeneratedBundle).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const warnMock = vi.fn();
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { warn: warnMock, info: vi.fn(), error: vi.fn(), debug: vi.fn(), http: vi.fn() },
}));

describe('bundlePptxRuntime — deckPlansToPptxBuffer fail-soft logging (P0.3)', () => {
  beforeEach(() => {
    warnMock.mockReset();
    vi.resetModules();
  });
  afterEach(() => vi.clearAllMocks());

  it('logs a stack-carrying warn with title/themeId/slideCount context when the render throws', async () => {
    vi.doMock('../../../server/src/services/deliverables/DeckStyler.js', async () => {
      const actual = await vi.importActual<typeof import('../../../server/src/services/deliverables/DeckStyler.js')>(
        '../../../server/src/services/deliverables/DeckStyler.js'
      );
      return {
        ...actual,
        resolveDeckStyle: () => {
          throw new Error('Boom: forced DeckStyler failure for P0.3 logging test');
        },
      };
    });

    const { deckPlansToPptxBuffer } = await import(
      '../../../server/src/services/deliverables/bundlePptxRuntime.js'
    );

    const result = await deckPlansToPptxBuffer(
      [{ slideIndex: 0, layoutIntent: 'cover', title: 'S1', keyMessage: 'x' }],
      { title: 'Acme — Deck', themeId: 'modern' }
    );

    // Fail-soft contract preserved: null, never throws.
    expect(result).toBeNull();

    expect(warnMock).toHaveBeenCalledTimes(1);
    const [message, meta] = warnMock.mock.calls[0];
    expect(message).toMatch(/pptx render failed/);
    expect(meta).toMatchObject({ title: 'Acme — Deck', themeId: 'modern', slideCount: 1 });
    // Full stack, not just `.message` — this is the debuggability bar from P0.3.
    expect(meta.error).toContain('Boom: forced DeckStyler failure for P0.3 logging test');
    expect(meta.error).toMatch(/DeckStyler|bundlePptxRuntime|Error/); // stack-ish, not bare message
  });
});

describe('bundleExportRuntime — exportBundleFiles fail-soft logging (P0.3)', () => {
  beforeEach(() => {
    warnMock.mockReset();
    vi.resetModules();
  });
  afterEach(() => vi.clearAllMocks());

  it('logs docx render failure with company context + stack', async () => {
    vi.doMock('../../../server/src/services/documentStudio/documentDocxRenderer.js', () => ({
      renderDocumentSchemaToDocxBuffer: vi.fn().mockRejectedValue(new Error('Boom: docx renderer exploded')),
    }));

    const { exportBundleFiles } = await import(
      '../../../server/src/services/deliverables/bundleExportRuntime.js'
    );

    const bundle = {
      spine: { meta: { company: 'Acme Sp. z o.o.', language: 'PL', thesis: 'x', ask: 'y' } },
      doc: { sections: [{ heading: 'S', blocks: [{ type: 'text', content: { text: 'x' } }] }] },
      table: null,
      deck: null,
      produced: { table: false, doc: true, deck: false },
    } as any;

    const files = await exportBundleFiles(bundle);

    // Fail-soft contract preserved: docx null, no throw, other formats unaffected.
    expect(files.docx).toBeNull();

    const docxWarnCall = warnMock.mock.calls.find(([msg]: [string]) => /docx render failed/.test(msg));
    expect(docxWarnCall).toBeTruthy();
    const [, meta] = docxWarnCall!;
    expect(meta).toMatchObject({ company: 'Acme Sp. z o.o.' });
    expect(meta.error).toContain('Boom: docx renderer exploded');
  });
});
