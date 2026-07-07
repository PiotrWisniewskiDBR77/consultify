/**
 * Teresa routing-N — regression tests.
 *
 * BUG1: rich "stwórz inicjatywę: <200-word brief>" must route to the OBJECT tool,
 *       never generate_deliverable(doc). We assert the deterministic pre-classifier
 *       (which AIPipeline uses to DROP generate_deliverable for that turn).
 * BUG2: generate_deliverable / object tools must emit `scorerContent` (the artifact
 *       scope) so the post-stream quality scorer rates the artifact, not the thin
 *       "Utworzyłem…" chat-confirmation.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  classifyChatCreationIntent,
  INTENT_TO_TOOL,
  INTENT_DROP_TOOLS,
} from '../../../server/src/services/ai/chatCreationIntent.js';

const RICH_BRIEF =
  'Stwórz inicjatywę: chcemy zredukować lead time w linii montażowej o 30% w ciągu ' +
  'dwóch kwartałów. Kontekst: obecny lead time to 14 dni, głównie przez wąskie gardło ' +
  'na stanowisku kontroli jakości i długie oczekiwanie na komponenty od dostawców. ' +
  'Cele: wdrożyć kanban dla komponentów, zbudować bufor bezpieczeństwa, przeszkolić ' +
  'zespół z SMED, wprowadzić dzienne stand-upy. Zakres obejmuje trzy zmiany produkcyjne, ' +
  'budżet do 200 tys. zł, właściciel = kierownik produkcji, sponsor = dyrektor operacyjny. ' +
  'Ryzyka: opór zespołu, dostępność dostawców. KPI: lead time, OTIF, poziom zapasów.';

describe('BUG1 — chat creation intent pre-classification (rich prompts route to object tools)', () => {
  it('classifies a RICH multi-paragraph "stwórz inicjatywę" as initiative (not a document)', () => {
    expect(classifyChatCreationIntent(RICH_BRIEF)).toBe('initiative');
    expect(INTENT_TO_TOOL.initiative).toBe('generate_initiative');
  });

  it('classifies simple + inflected initiative phrasings', () => {
    expect(classifyChatCreationIntent('stwórz inicjatywę transformacji')).toBe('initiative');
    expect(classifyChatCreationIntent('Załóż nową inicjatywę dotyczącą OEE')).toBe('initiative');
    expect(classifyChatCreationIntent('create an initiative for supply chain')).toBe('initiative');
    // "plan/transformation/strategy" must NOT flip it into a deliverable
    expect(
      classifyChatCreationIntent(
        'zrób inicjatywę polegającą na zaplanowaniu planu transformacji'
      )
    ).toBe('initiative');
  });

  it('classifies task creation phrasings', () => {
    expect(classifyChatCreationIntent('stwórz zadanie: przygotuj listę dostawców')).toBe('task');
    expect(classifyChatCreationIntent('dodaj zadanie do przygotowania raportu')).toBe('task');
    expect(classifyChatCreationIntent('create a task to send the deck')).toBe('task');
    expect(INTENT_TO_TOOL.task).toBe('create_task');
  });

  it('classifies decision creation phrasings', () => {
    expect(classifyChatCreationIntent('stwórz decyzję o wyborze dostawcy ERP')).toBe('decision');
    expect(classifyChatCreationIntent('zapisz decyzję dotyczącą budżetu')).toBe('decision');
    expect(classifyChatCreationIntent('log a decision to freeze hiring')).toBe('decision');
    expect(INTENT_TO_TOOL.decision).toBe('create_decision');
  });

  it('does NOT fire on plain chat requests (no create-verb + object-noun pair)', () => {
    expect(classifyChatCreationIntent('zrób mapę myśli o transformacji')).toBeNull();
    expect(classifyChatCreationIntent('podsumuj wnioski ze spotkania')).toBeNull(); // "podsumuj" nie jest create-verbem
    expect(classifyChatCreationIntent('jak stworzyć dobrą prezentację?')).toBeNull();
    expect(classifyChatCreationIntent('')).toBeNull();
  });
});

describe('PROBLEM #2 — "wniosek/insight" routuje na DOKUMENT, nie na inicjatywę', () => {
  it('classifies "wygeneruj wniosek strategiczny" as document (→ generate_deliverable)', () => {
    expect(classifyChatCreationIntent('wygeneruj wniosek strategiczny')).toBe('document');
    expect(classifyChatCreationIntent('Wygeneruj wniosek strategiczny dla inicjatywy OEE')).toBe(
      'document',
    );
    expect(INTENT_TO_TOOL.document).toBe('generate_deliverable');
  });

  it('classifies insight/raport/analiza/dokument creation as document', () => {
    expect(classifyChatCreationIntent('przygotuj analizę rynku')).toBe('document');
    expect(classifyChatCreationIntent('stwórz raport z wywiadu')).toBe('document');
    expect(classifyChatCreationIntent('napisz dokument o naszej inicjatywie OEE')).toBe('document');
    expect(classifyChatCreationIntent('generate an insight from the interview')).toBe('document');
  });

  it('document intent DROPS the object creators (so a wniosek can never become an initiative)', () => {
    const drop = INTENT_DROP_TOOLS.document;
    expect(drop).toContain('generate_initiative');
    expect(drop).toContain('create_task');
    expect(drop).toContain('create_decision');
    expect(drop).not.toContain('generate_deliverable');
  });

  it('object intents still drop generate_deliverable (no doc fallback)', () => {
    expect(INTENT_DROP_TOOLS.initiative).toEqual(['generate_deliverable']);
    expect(INTENT_DROP_TOOLS.task).toEqual(['generate_deliverable']);
    expect(INTENT_DROP_TOOLS.decision).toEqual(['generate_deliverable']);
  });

  it('an explicit "stwórz inicjatywę" still wins as initiative (not document)', () => {
    // "inicjatywę" without a document noun in-window → initiative.
    expect(classifyChatCreationIntent('stwórz inicjatywę transformacji')).toBe('initiative');
  });
});

describe('c2MindTable — "tabela/portfel" routes to a TABLE deliverable (not an inline artifact block)', () => {
  it('classifies explicit table-creation phrasings as table', () => {
    expect(
      classifyChatCreationIntent('Stwórz tabelę portfela inicjatyw z kolumnami nazwa, status, ROI')
    ).toBe('table');
    expect(classifyChatCreationIntent('zrób tabelę pomysłów na kampanię')).toBe('table');
    expect(classifyChatCreationIntent('make a table of the top 5 risks')).toBe('table');
    expect(classifyChatCreationIntent('stwórz portfel inicjatyw transformacji')).toBe('table');
    expect(INTENT_TO_TOOL.table).toBe('generate_deliverable');
  });

  it('table intent DROPS the object creators (forces generate_deliverable, no object fallback)', () => {
    const drop = INTENT_DROP_TOOLS.table;
    expect(drop).toContain('generate_initiative');
    expect(drop).toContain('create_task');
    expect(drop).toContain('create_decision');
    expect(drop).not.toContain('generate_deliverable');
  });

  it('a "raport" with an incidental table mention still wins as document (order precedence)', () => {
    // 'document' noun ("raport") sits before the table root in OBJECT_NOUNS, and
    // position-first tie-break keeps the nearer noun — a report is not a table.
    expect(classifyChatCreationIntent('stwórz raport z tabelą wyników')).toBe('document');
  });

  it('does NOT hijack an initiative/task request that merely mentions a table later', () => {
    expect(
      classifyChatCreationIntent('stwórz inicjatywę i dołącz do niej tabelę metryk')
    ).toBe('initiative');
  });
});

describe('BUG2 — generate_deliverable emits scorerContent (artifact scope for the scorer)', () => {
  it('doc deliverable emits scorerContent carrying the intent, not just the confirmation', async () => {
    // Isolate the module graph so our flag/service mocks apply.
    vi.resetModules();

    vi.doMock('../../../server/src/config/FeatureFlags.js', () => ({
      featureFlags: {
        ENABLE_DELIVERABLES_LIGHT: true,
        ENABLE_TERESA_MINDMAP: false,
        ENABLE_TERESA_CANVAS_TOOLS: false,
        ENABLE_TERESA_NOTE_CREATE: false,
      },
    }));
    vi.doMock('../../../server/src/services/presentationAccessPolicyService.js', () => ({
      hasPresentationCapability: () => true,
    }));
    vi.doMock('../../../server/src/services/deliverables/deliverablesGenerationService.js', () => ({
      plan: vi.fn().mockResolvedValue({ generationId: 'gen-123' }),
      start: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock('../../../server/src/services/notebookService.js', () => ({
      createNote: vi.fn(),
    }));

    const mod = await import('../../../server/src/services/ai/tools/generateDeliverable.js');
    const emitted: Array<Record<string, unknown>> = [];

    const intent =
      'A one-page memo summarizing Q3 lead-time reduction results with 4 concrete recommendations.';
    const res = await mod.generateDeliverable(
      { type: 'document', intent, title: 'Q3 Lead-Time Memo' },
      {
        organizationId: 'org-1',
        userId: 'user-1',
        role: 'CONSULTANT',
        language: 'en',
        onDeliverable: (p: Record<string, unknown>) => emitted.push(p),
      }
    );

    expect((res as any).ok).toBe(true);
    expect(emitted).toHaveLength(1);
    const payload = emitted[0];
    // The scorer signal must carry the artifact SCOPE (title + intent), which is
    // far richer than the ~150-char "Utworzyłem dokument…" confirmation message.
    expect(typeof payload.scorerContent).toBe('string');
    expect(String(payload.scorerContent)).toContain('lead-time');
    expect(String(payload.scorerContent).length).toBeGreaterThan(
      String((res as any).message).length * 0.5
    );
    // And it must be strictly richer than a bare title.
    expect(String(payload.scorerContent).length).toBeGreaterThan('Q3 Lead-Time Memo'.length);
  });
});
