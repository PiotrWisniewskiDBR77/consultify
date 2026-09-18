/**
 * DOC-0 etap 2a (DEC-593, Wpis 106 pkt Q2 wołacz 2, połowa KONSUMENTA).
 *
 * `NotebookContextPanel` dispatchuje `mywork-open-item`; cel liczy handler F3 w
 * `MyWorkHub.tsx`. Do etapu 2a zdarzenie niosło `type`/`id`/`name`, a `id` to
 * `originRecordId` — viewer (`/documents/:artifactId`) otwiera się KLUCZEM
 * REJESTRU, więc payload dostał addytywne `artifactId` (mierzone klikiem na
 * realnym komponencie w `NotebookContextPanel.doc0Etap2a.test.tsx`).
 *
 * DLACZEGO KONTRAKT ŹRÓDŁA, A NIE RENDERU: `MyWorkHub.tsx` to ~5,2 tys. linii i
 * żaden test w repo go nie montuje — siedem sióstrzanych plików w tym katalogu
 * (`MyWorkHub.notebookLoadingCounts`, `MyWorkHub.menu3PanelControls`,
 * `MyWorkHub.photo003.contract`, `MyWorkHub.photo005.contract`,
 * `MyWorkHub.decisionsOwnerFeedback`, `MyWorkHub.ideaTabs.ownerContract`,
 * `MyWorkHub.ptT14.synchronizacjaNazwyIZakladek`) pilnuje go dokładnie tak,
 * jak ten. Wzór czytania źródła 1:1 z `MyWorkHub.notebookLoadingCounts.test.ts`.
 *
 * MUTACJE (przywróć stary cel → RED):
 *  (a) `navigate(viewerPath ?? getArtifactPath(...))` → `navigate(getArtifactPath(...))`
 *      → test celu CZERWONY;
 *  (b) usunięcie `artifactId` z destrukcji detailu → test payloadu CZERWONY;
 *  (c) zamiana `viewerPath ?? …` na `viewerPath || getArtifactPath('report', …)`
 *      z pominięciem `type === 'report'` → test warunku CZERWONY.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.resolve(__dirname, '../MyWorkHub.tsx'), 'utf8');

/** The F3 handler only — assertions must not be satisfiable by another call site. */
const handler = source.slice(
  source.indexOf('// F3: Handle mywork-open-item custom event'),
  source.indexOf('const tabMap: Record<string, ModuleTab>')
);

describe('MyWorkHub F3 — `mywork-open-item` otwiera dokument w viewerze (DOC-0 etap 2a)', () => {
  it('handler istnieje i czyta addytywne `artifactId` z payloadu zdarzenia', () => {
    expect(source).toContain('// F3: Handle mywork-open-item custom event');
    expect(handler).toContain('const { type, id, name, artifactId } = (e as CustomEvent).detail');
  });

  it('importuje JEDNO wspólne źródło trasy viewera, nie własny string `/documents/`', () => {
    expect(source).toContain(
      "import { resolveDocumentViewerPath } from '@/components/ReportsAndPresentations/artifactNavigation'"
    );
    expect(handler).not.toContain("navigate('/documents");
    expect(handler).not.toContain('navigate(`/documents');
  });

  it('dokument (`type === \'report\'`) z `artifactId` → `/documents/:artifactId`, inaczej stara trasa', () => {
    expect(handler).toContain(
      "const viewerPath = type === 'report' ? resolveDocumentViewerPath(artifactId) : null;"
    );
    expect(handler).toContain(
      'navigate(viewerPath ?? getArtifactPath(type as any, String(id)));'
    );
  });

  it('gałąź `navigate` nadal jest za `resolveOpenItemRoute` (lekki work item nie nawiguje)', () => {
    expect(handler).toContain("if (resolveOpenItemRoute(type) === 'navigate')");
    expect(handler.indexOf('resolveOpenItemRoute')).toBeLessThan(handler.indexOf('viewerPath'));
  });

  it('arkusz (`type === \'sheet\'`) wraca PRZED gałęzią nawigacji — viewer go nie dotyczy', () => {
    expect(handler.indexOf("if (type === 'sheet')")).toBeLessThan(
      handler.indexOf('resolveOpenItemRoute')
    );
  });
});
