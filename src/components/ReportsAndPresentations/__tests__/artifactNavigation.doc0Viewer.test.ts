/**
 * @vitest-environment jsdom
 *
 * DOC-0 etap 1 (b) (DEC-593, Wpis 68 pkt 5) — rozwidlenie w `artifactNavigation.ts`.
 * Dziś `resolveArtifactOpenPath` `:36` kieruje KAŻDY dokument do Report Buildera
 * (`getArtifactPath('report', id)`). `resolveArtifactOpenTarget` to realne
 * rozwidlenie: przy fladze `VITE_DOC0_DOCUMENT_VIEWER` ON ZATWIERDZONY dokument
 * → `mode:'viewer'` (JEDEN DocumentViewer), wszystko inne — flag OFF, szkic,
 * prezentacja, arkusz, brak artifactId, status nieznany — → `mode:'path'` z
 * DOKŁADNIE dotychczasową trasą (parytet OFF bajt w bajt).
 *
 * MUTACJE (zmierzone, meldunek Wpis 68):
 *  (a) usunięcie warunku flagi (`isDocumentViewerEnabled()`) → test OFF CZERWONY,
 *  (b) zamiana gałęzi viewer na `mode:'path'` (stara ścieżka przy ON) → test ON CZERWONY.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getArtifactPath } from '@/utils/artifactLinks';

import {
  buildDocumentViewerListPath,
  resolveArtifactOpenPath,
  resolveArtifactOpenTarget,
  resolveDocumentViewerPath,
} from '../artifactNavigation';
import { DOCUMENT_VIEWER_FLAG_KEYS } from '../../documents/documentViewerFlag';

const LS_KEY = DOCUMENT_VIEWER_FLAG_KEYS.localStorage;

function docRow(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'document' as const,
    originRecordId: 'rpt-doc0-1',
    artifactId: 'art-doc0-1',
    statusKey: 'ready',
    governance: null,
    ...overrides,
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe('resolveArtifactOpenTarget — flaga OFF (parytet z linią)', () => {
  it('zatwierdzony dokument przy OFF = DOKŁADNIE stara trasa Report Buildera', () => {
    window.localStorage.setItem(LS_KEY, '0');
    const target = resolveArtifactOpenTarget(docRow());
    expect(target).toEqual({
      mode: 'path',
      path: getArtifactPath('report', 'rpt-doc0-1'),
    });
    expect(target.mode === 'path' && target.path).toBe(
      resolveArtifactOpenPath({ kind: 'document', originRecordId: 'rpt-doc0-1', governance: null })
    );
  });

  it('brak jakiejkolwiek flagi (fail-closed) = stara trasa', () => {
    const target = resolveArtifactOpenTarget(docRow());
    expect(target.mode).toBe('path');
  });
});

describe('resolveArtifactOpenTarget — flaga ON (DEC-593)', () => {
  beforeEach(() => {
    window.localStorage.setItem(LS_KEY, '1');
  });

  it('zatwierdzony dokument (ready/exported/shared) → JEDEN viewer z artifactId rejestru', () => {
    for (const statusKey of ['ready', 'exported', 'shared']) {
      expect(resolveArtifactOpenTarget(docRow({ statusKey }))).toEqual({
        mode: 'viewer',
        artifactId: 'art-doc0-1',
      });
    }
  });

  it('szkic/stany robocze/archiwum/status nieznany → stara trasa (fail-closed)', () => {
    for (const statusKey of ['draft', 'generated', 'editing', 'archived', 'coś-dziwnego', '']) {
      const target = resolveArtifactOpenTarget(docRow({ statusKey }));
      expect(target.mode).toBe('path');
      expect(target).toEqual({
        mode: 'path',
        path: getArtifactPath('report', 'rpt-doc0-1'),
      });
    }
  });

  it('prezentacja i arkusz → stara trasa (viewer tylko dla dokumentów)', () => {
    const presentation = resolveArtifactOpenTarget(
      docRow({ kind: 'presentation', originRecordId: 'deck-1', statusKey: 'ready' })
    );
    expect(presentation).toEqual({ mode: 'path', path: getArtifactPath('presentation', 'deck-1') });
    const sheet = resolveArtifactOpenTarget(
      docRow({ kind: 'sheet', originRecordId: 'sheet-1', statusKey: 'ready' })
    );
    expect(sheet).toEqual({ mode: 'path', path: getArtifactPath('sheet', 'sheet-1') });
  });

  it('dokument bez artifactId rejestru → stara trasa (viewer nie ma czego otworzyć)', () => {
    expect(resolveArtifactOpenTarget(docRow({ artifactId: undefined })).mode).toBe('path');
    expect(resolveArtifactOpenTarget(docRow({ artifactId: '  ' })).mode).toBe('path');
  });

  it('jawny governance.openPath przy ON też prowadzi do viewera (każde otwarcie zatwierdzonego dokumentu)', () => {
    const target = resolveArtifactOpenTarget(
      docRow({ governance: { openPath: '/wordy?artifactId=x' } })
    );
    expect(target).toEqual({ mode: 'viewer', artifactId: 'art-doc0-1' });
  });
});

/**
 * DOC-0 etap 2a (DEC-593, Wpis 106 pkt Q1/Q2) — JEDNO źródło trasy viewera dla
 * nowej trasy `/documents/:artifactId` i trzech przełączonych wołaczy
 * (Initiatives · MyWork notebook · CaseWorkspace Rezultaty). Zasada ta sama co
 * w etapie 1: `null` = „zostań przy dzisiejszym celu", więc flaga OFF jest
 * parytetem bajt w bajt w każdym wołaczu (`viewerPath ?? <stara trasa>`).
 *
 * MUTACJE: (a) usunięcie warunku flagi w `resolveDocumentViewerPath` → test OFF
 * CZERWONY; (b) `return null` w gałęzi ON (stary cel) → testy ON CZERWONE;
 * (c) zgubienie `artifactId` w `buildDocumentViewerListPath` → test celu OFF CZERWONY.
 */
describe('resolveDocumentViewerPath — etap 2a (trasa `/documents/:artifactId`)', () => {
  it('flaga OFF → null, czyli dzisiejszy cel w każdym wołaczu', () => {
    window.localStorage.setItem(LS_KEY, '0');
    expect(resolveDocumentViewerPath('art-doc0-1')).toBeNull();
  });

  it('brak flagi (fail-closed) → null', () => {
    expect(resolveDocumentViewerPath('art-doc0-1')).toBeNull();
  });

  it('flaga ON → `/documents/<artifactId>` rejestru', () => {
    window.localStorage.setItem(LS_KEY, '1');
    expect(resolveDocumentViewerPath('art-doc0-1')).toBe('/documents/art-doc0-1');
  });

  it('flaga ON, ale id puste/brak → null (viewer nie ma czego otworzyć)', () => {
    window.localStorage.setItem(LS_KEY, '1');
    expect(resolveDocumentViewerPath(undefined)).toBeNull();
    expect(resolveDocumentViewerPath(null)).toBeNull();
    expect(resolveDocumentViewerPath('   ')).toBeNull();
  });

  it('flaga ON, id ze znakami specjalnymi → zakodowane w segmencie trasy', () => {
    window.localStorage.setItem(LS_KEY, '1');
    expect(resolveDocumentViewerPath('art/1 b')).toBe('/documents/art%2F1%20b');
  });

  it('cel OFF (`buildDocumentViewerListPath`) trzyma zakładkę Materiałów i ten sam wiersz', () => {
    expect(buildDocumentViewerListPath('art/1 b')).toBe(
      '/presentations?tab=documents&artifactId=art%2F1%20b'
    );
    expect(buildDocumentViewerListPath('')).toBe('/presentations?tab=documents&artifactId=');
  });
});
