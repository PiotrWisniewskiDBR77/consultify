export type PresentationExportFormat = 'pptx' | 'pdf' | 'png' | 'html';

export interface PresentationExportOptions {
  deckId: string;
  title?: string;
  format?: PresentationExportFormat;
  overrideQualityGate?: boolean;
}

export interface PresentationOverflowWarning {
  slideIndex: number;
  slideTitle: string;
  powod: 'tytul' | 'tresc' | 'kafel' | 'liczba' | 'lista';
  zmierzone: number;
  budzet: number;
  pewnosc: 'wysoka' | 'niska';
}

export class PresentationExportError extends Error {
  code?: string;
  result?: string;
  gates?: unknown[];

  constructor(message: string, details?: { code?: string; result?: string; gates?: unknown[] }) {
    super(message);
    this.name = 'PresentationExportError';
    this.code = details?.code;
    this.result = details?.result;
    this.gates = details?.gates;
  }
}

export async function preflightPresentationExport(
  options: PresentationExportOptions
): Promise<PresentationOverflowWarning[]> {
  const format = options.format || 'pptx';
  // FIX-230 F8: PDF renders through pdfkit, not the PPTX pipeline these
  // character budgets describe (server route mirrors this: it now always
  // returns an empty overflowWarnings list for PDF preflight requests).
  // Don't even ask — a silent [] from the server would look identical to
  // "checked, all clear" when it actually means "not checked".
  if (format !== 'pptx') return [];
  const endpoint = endpointFor(options.deckId, format, options.overrideQualityGate);
  const separator = endpoint.url.includes('?') ? '&' : '?';
  const response = await fetch(`${endpoint.url}${separator}preflight=overflow`, {
    method: endpoint.method,
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });
  if (!response.ok) return [];
  const payload = await response.json().catch(() => null);
  return Array.isArray(payload?.data?.overflowWarnings) ? payload.data.overflowWarnings : [];
}

function endpointFor(
  deckId: string,
  format: PresentationExportFormat,
  overrideQualityGate?: boolean
) {
  const qs = overrideQualityGate ? '?overrideQualityGate=true' : '';
  if (format === 'pptx')
    return {
      url: `/api/presentations/decks/${deckId}/download${qs}`,
      method: 'GET',
      extension: 'pptx',
    };
  if (format === 'png')
    return {
      url: `/api/presentations/decks/${deckId}/export/png${qs}`,
      method: 'POST',
      extension: 'zip',
    };
  return {
    url: `/api/presentations/decks/${deckId}/export/${format}${qs}`,
    method: format === 'pdf' ? 'GET' : 'POST',
    extension: format,
  };
}

export async function exportPresentationDeck(options: PresentationExportOptions) {
  const format = options.format || 'pptx';
  const endpoint = endpointFor(options.deckId, format, options.overrideQualityGate);
  const response = await fetch(endpoint.url, {
    method: endpoint.method,
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });

  if (!response.ok) {
    let payload: any = null;
    try {
      payload = await response.json();
    } catch {
      /* ignore */
    }
    throw new PresentationExportError(payload?.error || 'Export failed', {
      code: payload?.code,
      result: payload?.result,
      gates: payload?.gates,
    });
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${options.title || 'presentation'}.${endpoint.extension}`;
  link.click();
  window.URL.revokeObjectURL(url);

  return { format, extension: endpoint.extension };
}
