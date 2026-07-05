/**
 * @vitest-environment jsdom
 *
 * A3 (Whiteboard finish) — PNG/JSON export of the Ideas whiteboard through the
 * shared IdeaExportMenu, reusing the exact Mind Map export path (html-to-image
 * toPng on the live `.react-flow` container; JSON blob download).
 *
 * Pins the contract:
 *  1. sharePolicy gating: `extensions.whiteboard.sharePolicy.exportAllowed === false`
 *     blocks every export (buttons disabled, no blob/no toPng) and surfaces the
 *     governance message. This is the wire IdeaMapWorkspace now feeds by passing
 *     the full graph extensions (incl. `whiteboard`) into IdeaExportMenu.
 *  2. JSON export is round-trip safe per P13 canon: full node shape survives
 *     (width/height/parentNode/style), `extensions.whiteboard` (drawingPaths,
 *     bgPattern, sessionState, sharePolicy) is embedded, and the payload parses
 *     back through the real `parseDiagramPackage` import path to an identical graph.
 *  3. PNG export renders the live ReactFlow canvas via html-to-image `toPng`
 *     (same mechanism as Mind Map) and triggers a .png blob download.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { parseDiagramPackage } from '@/components/MyWork/canvas/diagramInterop';

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => undefined },
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (_key: string, fallback?: string) => fallback || _key,
  }),
}));

vi.mock('@/services/api', () => ({
  Api: { ideaRequestExport: vi.fn().mockResolvedValue({ id: 'x' }) },
}));

const toPng = vi.fn();
vi.mock('html-to-image', () => ({
  toPng: (...args: unknown[]) => toPng(...args),
  toSvg: vi.fn(),
}));

// Whiteboard-shaped graph: frame parent + resized sticky child with style.
const whiteboardNodes = [
  {
    id: 'frame-1',
    type: 'frameNode',
    position: { x: 0, y: 0 },
    width: 600,
    height: 400,
    zIndex: 0,
    data: { label: 'Sprint frame', semanticType: 'area' },
    selected: true, // transient — must be stripped from the JSON export
  },
  {
    id: 'sticky-1',
    type: 'stickyNote',
    position: { x: 40, y: 60 },
    parentNode: 'frame-1',
    width: 180,
    height: 120,
    style: { background: '#FEF08A' },
    data: { label: 'Idea A', colorIndex: 2 },
    dragging: false,
  },
];
const whiteboardEdges = [
  {
    id: 'e1',
    source: 'frame-1',
    target: 'sticky-1',
    type: 'flowEdge',
    data: { label: 'contains' },
    selected: false,
  },
];
const whiteboardExtensions = {
  activeTool: 'whiteboard',
  whiteboard: {
    mode: 'board',
    bgPattern: 'dots',
    drawingPaths: [{ id: 'p1', points: [{ x: 1, y: 2 }], color: '#000' }],
    sessionState: { active: false, role: 'facilitator' },
    sharePolicy: {
      classification: 'internal',
      watermark: 'Consultify',
      exportAllowed: true,
      shareAllowed: true,
    },
  },
};

const baseProps = {
  open: true,
  onClose: vi.fn(),
  ideaId: 'idea-wb-1',
  title: 'Warsztat whiteboard',
  graphNodes: whiteboardNodes,
  graphEdges: whiteboardEdges,
  extensions: whiteboardExtensions,
};

let createObjectURL: ReturnType<typeof vi.fn>;
let capturedBlobs: Blob[];

beforeEach(() => {
  vi.clearAllMocks();
  capturedBlobs = [];
  createObjectURL = vi.fn((blob: Blob) => {
    capturedBlobs.push(blob);
    return 'blob:mock';
  });
  // jsdom lacks blob URL APIs used by the client-side download path.
  // @ts-expect-error test shim
  globalThis.URL.createObjectURL = createObjectURL;
  // @ts-expect-error test shim
  globalThis.URL.revokeObjectURL = vi.fn();
});

async function loadMenu() {
  const mod = await import('@/components/MyWork/IdeaExportMenu');
  return mod.IdeaExportMenu;
}

// jsdom's Blob has no .text(); read via FileReader instead.
function readBlobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

describe('A3 — whiteboard JSON export (round-trip safe)', () => {
  it('embeds extensions.whiteboard and preserves the full node/edge shape', async () => {
    const IdeaExportMenu = await loadMenu();
    render(<IdeaExportMenu {...baseProps} />);

    fireEvent.click(screen.getByText('JSON (data)'));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(await readBlobText(capturedBlobs[0]));

    // extensions.whiteboard round-trips (sharePolicy, drawings, bg, session).
    expect(payload.extensions.whiteboard).toMatchObject({
      bgPattern: 'dots',
      drawingPaths: [{ id: 'p1' }],
      sharePolicy: { exportAllowed: true, classification: 'internal' },
    });

    // Full node shape survives — visually identical canvas on re-import (P13).
    const frame = payload.nodes.find((n: any) => n.id === 'frame-1');
    const sticky = payload.nodes.find((n: any) => n.id === 'sticky-1');
    expect(frame).toMatchObject({ type: 'frameNode', width: 600, height: 400, zIndex: 0 });
    expect(sticky).toMatchObject({
      parentNode: 'frame-1',
      width: 180,
      height: 120,
      style: { background: '#FEF08A' },
      data: { label: 'Idea A', colorIndex: 2 },
    });
    // Transient interaction state is stripped.
    expect(frame).not.toHaveProperty('selected');
    expect(sticky).not.toHaveProperty('dragging');
    // Edge keeps its type/data.
    expect(payload.edges[0]).toMatchObject({
      id: 'e1',
      type: 'flowEdge',
      data: { label: 'contains' },
    });
  });

  it('round-trips through the real diagram-package import path', async () => {
    const IdeaExportMenu = await loadMenu();
    render(<IdeaExportMenu {...baseProps} />);

    fireEvent.click(screen.getByText('JSON (data)'));
    const raw = await readBlobText(capturedBlobs[0]);

    const imported = parseDiagramPackage(raw);
    expect(imported.title).toBe('Warsztat whiteboard');
    expect(imported.nodes).toHaveLength(2);
    expect(imported.edges).toHaveLength(1);
    expect(imported.nodes.find((n: any) => n.id === 'sticky-1')).toMatchObject({
      parentNode: 'frame-1',
      width: 180,
      height: 120,
    });
    expect((imported.extensions as any).whiteboard.sharePolicy.exportAllowed).toBe(true);
  });
});

describe('A3 — whiteboard PNG export (Mind Map mechanism reuse)', () => {
  it('renders the live .react-flow canvas via html-to-image and downloads a PNG blob', async () => {
    toPng.mockResolvedValue('data:image/png;base64,QUJD');
    const pngBlob = new Blob(['png-bytes'], { type: 'image/png' });
    const fetchMock = vi.fn().mockResolvedValue({ blob: async () => pngBlob });
    vi.stubGlobal('fetch', fetchMock);

    const container = document.createElement('div');
    const flowEl = document.createElement('div');
    flowEl.className = 'react-flow';
    container.appendChild(flowEl);
    const canvasContainerRef = { current: container };

    const IdeaExportMenu = await loadMenu();
    render(<IdeaExportMenu {...baseProps} canvasContainerRef={canvasContainerRef} />);

    fireEvent.click(screen.getByText('PNG (image)'));

    await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
    // Same path as Mind Map: toPng on the live ReactFlow container, white bg, 2x.
    expect(toPng).toHaveBeenCalledWith(
      flowEl,
      expect.objectContaining({ backgroundColor: '#ffffff', pixelRatio: 2 })
    );
    expect(capturedBlobs[0].type).toBe('image/png');
    vi.unstubAllGlobals();
  });
});

describe('A3 — sharePolicy.exportAllowed=false blocks whiteboard export', () => {
  const blockedProps = {
    ...baseProps,
    extensions: {
      ...whiteboardExtensions,
      whiteboard: {
        ...whiteboardExtensions.whiteboard,
        sharePolicy: {
          classification: 'confidential',
          watermark: 'DRD',
          exportAllowed: false,
          shareAllowed: false,
        },
      },
    },
  };

  it('disables formats, shows the governance message, and produces no file', async () => {
    const IdeaExportMenu = await loadMenu();
    render(<IdeaExportMenu {...blockedProps} />);

    expect(screen.getByText(/Export blocked by whiteboard governance/i)).toBeInTheDocument();

    const jsonBtn = screen.getByText('JSON (data)').closest('button') as HTMLButtonElement;
    const pngBtn = screen.getByText('PNG (image)').closest('button') as HTMLButtonElement;
    expect(jsonBtn.disabled).toBe(true);
    expect(pngBtn.disabled).toBe(true);

    fireEvent.click(jsonBtn);
    fireEvent.click(pngBtn);
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(toPng).not.toHaveBeenCalled();
  });
});
