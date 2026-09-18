/**
 * Harness dev-render dla REALNEGO `DocumentSidePanel` — zgłoszenie P-P05
 * (Paweł, 14.09): „Document upload finishes silently but the file never
 * appears". Serwer jest tu atrapą na poziomie `window.fetch`: listy
 * dokumentów są puste, a `POST /api/documents/upload` odpowiada 400
 * `DOCUMENTS_PROJECT_ID_REQUIRED` — dokładnie tak, jak na stagingu przy
 * wysyłce do „Dokumentów projektu" bez projektu.
 *
 * Parametry URL:
 *   ?projekt=1   — panel dostaje projectId (wysyłka realnie leci na serwer)
 *   ?loading=1   — fetch listy dokumentów nigdy się nie rozstrzyga, więc panel
 *                  zostaje w stanie `loading` i spinner listy jest widoczny
 *                  (D-87: zrzut tokenu neutralnego spinera)
 *   (bez)        — panel bez projektu
 */
import React, { useEffect } from 'react';

import { DocumentSidePanel } from '../../src/components/documents/DocumentSidePanel';
import { useAppStore } from '../../src/store/useAppStore';

const params = new URLSearchParams(window.location.search);
const zProjektem = params.get('projekt') === '1';
const trybLadowania = params.get('loading') === '1';

const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const odp = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  if (url.includes('/documents/upload')) {
    return odp(
      { error: 'Project id is required for project-scoped uploads.', code: 'DOCUMENTS_PROJECT_ID_REQUIRED' },
      400
    );
  }
  // D-87: hold the list fetch pending so the loading spinner stays on screen.
  if (url.includes('/documents') && trybLadowania) return new Promise<Response>(() => {});
  if (url.includes('/documents')) return odp([]);
  return realFetch(input, init);
};

export function PawelDokumentyUploadScreen(): React.ReactElement {
  useEffect(() => {
    useAppStore.setState({ activeSidePanel: 'DOCUMENTS' } as never);
  }, []);
  return (
    <div style={{ height: '100vh', overflow: 'hidden' }}>
      <DocumentSidePanel projectId={zProjektem ? 'proj-harness' : undefined} />
    </div>
  );
}

export default PawelDokumentyUploadScreen;
