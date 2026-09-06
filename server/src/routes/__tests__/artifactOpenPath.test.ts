/**
 * Patrz `../artifactOpenPath.ts` — pełny opis pomiaru na stagingu (65 wierszy
 * `native_artifact`, 61× 200 na /document-studio, 4× 404 i wszystkie cztery to
 * dostawy z czatu; ten sam identyfikator daje 200 na /work-canvas/drafts).
 *
 * Test broni ZABEZPIECZENIA: dokument zarejestrowany z czatu nie może dostać
 * adresu Document Studio, bo ten adres jest z definicji martwy.
 *
 * DOWÓD MUTACYJNY (wykonany): zamiana warunku `sourceType === 'chat'` na
 * `false` → czerwienieją 3 z 5 przypadków.
 */
import { describe, expect, it } from 'vitest';

import { resolveNativeArtifactOpenTarget } from '../artifactOpenPath.js';

const CHAT_GENERATION_ID = '8de7d629-a044-4594-b9c3-6da2922a4a96';
const DS_ARTIFACT_ID = 'artifact-bbbb2222-3333-4444-8888-bbbbbbbbbbbb';

describe('resolveNativeArtifactOpenTarget', () => {
  it('dostawa z czatu → kanwa czatu, NIGDY /document-studio', () => {
    const out = resolveNativeArtifactOpenTarget({
      originRecordId: CHAT_GENERATION_ID,
      originSummary: { sourceType: 'chat', sourceId: 'conv-1', kind: 'doc' },
    });
    expect(out.openPath).toBe(`/chat?workPanel=1&canvasDraftId=${CHAT_GENERATION_ID}`);
    expect(String(out.openPath)).not.toContain('/document-studio/');
    expect(out.authority).toBe('chat_canvas');
  });

  it('wielkość liter i spacje w sourceType nie omijają zabezpieczenia', () => {
    const out = resolveNativeArtifactOpenTarget({
      originRecordId: CHAT_GENERATION_ID,
      originSummary: { sourceType: '  Chat ' },
    });
    expect(out.authority).toBe('chat_canvas');
  });

  it('brak originRecordId nie produkuje adresu-śmiecia', () => {
    const out = resolveNativeArtifactOpenTarget({
      originRecordId: '',
      originSummary: { sourceType: 'chat' },
    });
    expect(out.openPath).toBeNull();
  });

  it('realny dokument Document Studio bez zmian (zero regresji)', () => {
    const out = resolveNativeArtifactOpenTarget({
      originRecordId: DS_ARTIFACT_ID,
      originSummary: { sourceType: 'document_studio', templateId: null },
    });
    expect(out.openPath).toBe(`/document-studio/${DS_ARTIFACT_ID}`);
    expect(out.exportPath).toBe(`/api/document-studio/${DS_ARTIFACT_ID}/export/pdf`);
    expect(out.authority).toBe('document_studio');
  });

  it('brak originSummary → dotychczasowe zachowanie Document Studio', () => {
    const out = resolveNativeArtifactOpenTarget({ originRecordId: DS_ARTIFACT_ID });
    expect(out.openPath).toBe(`/document-studio/${DS_ARTIFACT_ID}`);
    expect(out.authority).toBe('document_studio');
  });
});

/**
 * ★ POMIAR 06/07.09 (stanowisko lokalne, baza 54400, organizacja DBR77).
 * `GET /api/artifacts?outputType=report&limit=100` → 14 wierszy; wiersz
 * `99849d62-cdef-4507-bacd-85081b6c430a` (`sourceType: 'work_canvas'`,
 * `sourceTable: 'work_canvas_drafts'`) dostawał
 * `openPath: /document-studio/99849d62-…`, a
 * `GET /api/document-studio/99849d62-…` → 404 `not_found`. Ten sam
 * identyfikator jest wierszem `work_canvas_drafts`.
 *
 * Naprawa z 05.09 rozpoznawała TYLKO `sourceType === 'chat'` — czyli dwóch
 * pisarzy `native_artifact` z pięciu. Poniższe przypadki bronią CAŁEJ
 * rodziny wypisanej w nagłówku `artifactOpenPath.ts`.
 */
describe('resolveNativeArtifactOpenTarget — rodzina pisarzy native_artifact', () => {
  const CANVAS_DRAFT_ID = '99849d62-cdef-4507-bacd-85081b6c430a';

  it('dostawa z kanwy pracy (work-canvas register-in-outputs) → kanwa, NIGDY /document-studio', () => {
    const out = resolveNativeArtifactOpenTarget({
      originRecordId: CANVAS_DRAFT_ID,
      originSummary: {
        sourceType: 'work_canvas',
        sourceTable: 'work_canvas_drafts',
        contentMdLength: 1309,
      },
    });
    expect(out.openPath).toBe(`/chat?workPanel=1&canvasDraftId=${CANVAS_DRAFT_ID}`);
    expect(String(out.openPath)).not.toContain('/document-studio/');
    expect(out.exportPath).toBeNull();
    expect(out.authority).toBe('chat_canvas');
  });

  it('arkusz z generatora dostaw (deliverables_sheet_generation) też leży w work_canvas_drafts', () => {
    const out = resolveNativeArtifactOpenTarget({
      originRecordId: CANVAS_DRAFT_ID,
      originSummary: {
        sourceType: 'deliverables_sheet_generation',
        sourceTable: 'work_canvas_drafts',
      },
    });
    expect(out.authority).toBe('chat_canvas');
    expect(String(out.openPath)).not.toContain('/document-studio/');
  });

  it('sama deklaracja tabeli wystarczy — nieznany sourceType nie omija zabezpieczenia', () => {
    const out = resolveNativeArtifactOpenTarget({
      originRecordId: CANVAS_DRAFT_ID,
      originSummary: { sourceType: 'jakies_nowe_zrodlo', sourceTable: 'work_canvas_drafts' },
    });
    expect(out.authority).toBe('chat_canvas');
    expect(String(out.openPath)).not.toContain('/document-studio/');
  });

  it('wielkość liter i spacje w sourceTable nie omijają zabezpieczenia', () => {
    const out = resolveNativeArtifactOpenTarget({
      originRecordId: CANVAS_DRAFT_ID,
      originSummary: { sourceTable: '  Work_Canvas_Drafts ' },
    });
    expect(out.authority).toBe('chat_canvas');
  });

  it('protokół spotkania (meeting) MA rekord w wave5 → zostaje przy Document Studio', () => {
    const contentId = 'meeting-material-note-42';
    const out = resolveNativeArtifactOpenTarget({
      originRecordId: contentId,
      originSummary: {
        sourceType: 'meeting',
        sourceId: 'mtg-1',
        sourceTable: 'meeting_notes',
        noteId: 'note-42',
      },
    });
    expect(out.openPath).toBe(`/document-studio/${contentId}`);
    expect(out.authority).toBe('document_studio');
  });

  it('generator dokumentu z dostaw (deliverables_doc_generation) zostaje przy Document Studio', () => {
    const out = resolveNativeArtifactOpenTarget({
      originRecordId: DS_ARTIFACT_ID,
      originSummary: {
        sourceType: 'deliverables_doc_generation',
        sourceTable: 'document_studio_artifacts',
        generationId: 'gen-1',
      },
    });
    expect(out.openPath).toBe(`/document-studio/${DS_ARTIFACT_ID}`);
    expect(out.exportPath).toBe(`/api/document-studio/${DS_ARTIFACT_ID}/export/pdf`);
    expect(out.authority).toBe('document_studio');
  });

  it('brak originRecordId w wierszu kanwy nie produkuje adresu-śmiecia', () => {
    const out = resolveNativeArtifactOpenTarget({
      originRecordId: '',
      originSummary: { sourceType: 'work_canvas', sourceTable: 'work_canvas_drafts' },
    });
    expect(out.openPath).toBeNull();
  });
});
