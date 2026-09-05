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
