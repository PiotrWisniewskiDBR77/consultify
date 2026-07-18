/**
 * @vitest-environment jsdom
 *
 * M05 / L-05 / D-01 / DP-5 — Server-side idea export is a STUB (records a row in
 * `idea_exports`, no worker ever produces a file). DP-5: do NOT build a server worker;
 * gate the stub behind an OFF-by-default flag so it is never presented as a working action.
 *
 * This test pins the contract:
 *  - With the flag OFF (default), exporting does NOT fire the stub `Api.ideaRequestExport`.
 *  - The genuinely-working client-side export (JSON) still runs (blob download triggered).
 *  - With the flag ON, the stub request IS fired (opt-in only).
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => undefined },
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (_key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key)),
  }),
}));

const ideaRequestExport = vi.fn().mockResolvedValue({ id: 'x' });
vi.mock('@/services/api', () => ({
  Api: { ideaRequestExport: (...args: unknown[]) => ideaRequestExport(...args) },
}));

// Avoid pulling heavy diagram-interop deps into the test surface.
vi.mock('@/components/MyWork/canvas/diagramInterop', () => ({
  buildInteropMappingReport: () => [],
  parseBpmnXml: () => ({ nodes: [], edges: [] }),
  parseDiagramPackage: () => ({ nodes: [], edges: [] }),
  parseDrawIoXml: () => ({ nodes: [], edges: [] }),
}));

const baseProps = {
  open: true,
  onClose: vi.fn(),
  ideaId: 'idea-1',
  title: 'My Idea',
  graphNodes: [{ id: 'n1', type: 'idea', position: { x: 0, y: 0 }, data: { label: 'A' } }],
  graphEdges: [],
};

let createObjectURL: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetModules();
  ideaRequestExport.mockClear();
  createObjectURL = vi.fn().mockReturnValue('blob:mock');
  // jsdom lacks blob URL APIs used by the client-side download path.
  // @ts-expect-error test shim
  globalThis.URL.createObjectURL = createObjectURL;
  // @ts-expect-error test shim
  globalThis.URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

async function loadMenu() {
  const mod = await import('@/components/MyWork/IdeaExportMenu');
  return mod.IdeaExportMenu;
}

describe('M05 L-05/DP-5 — server export stub gated behind OFF-by-default flag', () => {
  it('flag OFF (default): exporting does NOT fire the stub server request', async () => {
    vi.stubEnv('VITE_ENABLE_IDEA_SERVER_EXPORT', '');
    const IdeaExportMenu = await loadMenu();
    render(<IdeaExportMenu {...baseProps} />);

    fireEvent.click(screen.getByText('JSON (data)'));

    expect(ideaRequestExport).not.toHaveBeenCalled();
  });

  it('flag OFF: the genuinely-working client-side export still runs', async () => {
    vi.stubEnv('VITE_ENABLE_IDEA_SERVER_EXPORT', '');
    const IdeaExportMenu = await loadMenu();
    render(<IdeaExportMenu {...baseProps} />);

    fireEvent.click(screen.getByText('JSON (data)'));

    // Client export builds a Blob and triggers a download — proven by createObjectURL.
    expect(createObjectURL).toHaveBeenCalled();
  });

  it('IDEA_SERVER_EXPORT_ENABLED is false when the flag is unset', async () => {
    vi.stubEnv('VITE_ENABLE_IDEA_SERVER_EXPORT', '');
    const mod = await import('@/components/MyWork/IdeaExportMenu');
    expect(mod.IDEA_SERVER_EXPORT_ENABLED).toBe(false);
  });

  it('flag ON (opt-in): the stub server request IS fired', async () => {
    vi.stubEnv('VITE_ENABLE_IDEA_SERVER_EXPORT', 'true');
    const IdeaExportMenu = await loadMenu();
    render(<IdeaExportMenu {...baseProps} />);

    fireEvent.click(screen.getByText('JSON (data)'));

    expect(ideaRequestExport).toHaveBeenCalledWith(
      'idea-1',
      expect.objectContaining({ exportFormat: 'json', exportType: 'whiteboard' })
    );
  });
});
