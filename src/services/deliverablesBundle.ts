/**
 * deliverablesBundle.ts — FE-side client for the M17 bundle generator (W3.5, W3.6).
 *
 * POST /api/deliverables/generations/bundle/export → ZIP blob → browser download.
 * GET  /api/deliverables/generations/bundles → list of org's bundles.
 * Optional: multipart with brandFile (PPTX/PDF/XLSX) for brand extraction (W1.6).
 *
 * No retry — generation is expensive; one attempt per user action.
 */

import { API_URL, getHeaders } from './api';

export interface BundleExportOptions {
  themeId?: string;
  brandFile?: File;
}

/**
 * Generates full bundle (DOCX + XLSX + PPTX) from a brief and downloads the ZIP.
 * Returns true on success; false when the server signals failure or the call throws.
 *
 * Uses 120 s fetch timeout (generation is CPU-heavy).
 */
export async function downloadBundleZip(
  brief: string,
  opts: BundleExportOptions = {},
): Promise<boolean> {
  try {
    const { token, orgId } = _extractAuth();

    let body: BodyInit;
    let contentType: string | undefined;

    if (opts.brandFile) {
      const form = new FormData();
      form.append('brief', brief);
      if (opts.themeId) form.append('themeId', opts.themeId);
      form.append('brandFile', opts.brandFile);
      body = form;
      // do NOT set Content-Type for FormData; browser sets boundary automatically
    } else {
      body = JSON.stringify({ brief, themeId: opts.themeId });
      contentType = 'application/json';
    }

    const headers = _buildHeaders(token, orgId, contentType);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);

    let res: Response;
    try {
      res = await fetch(`${API_URL}/deliverables/generations/bundle/export`, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) return false;

    const blob = await res.blob();
    const filename = _extractFilename(res) ?? 'bundle.zip';
    _triggerDownload(blob, filename);
    return true;
  } catch {
    return false;
  }
}

function _extractAuth(): { token: string; orgId: string } {
  // getHeaders() returns full headers object — extract token + org from it.
  const h = getHeaders() as Record<string, string>;
  const token = h['Authorization']?.replace('Bearer ', '') ?? '';
  const orgId = h['X-Organization-ID'] ?? '';
  return { token, orgId };
}

function _buildHeaders(
  token: string,
  orgId: string,
  contentType?: string,
): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: token ? `Bearer ${token}` : '',
  };
  if (orgId) h['X-Organization-ID'] = orgId;
  if (contentType) h['Content-Type'] = contentType;
  return h;
}

function _extractFilename(res: Response): string | null {
  const cd = res.headers.get('Content-Disposition') ?? '';
  const m = cd.match(/filename[^;=\n]*=(?:['"]?)([^'"\n;]+)/i);
  return m?.[1] ?? null;
}

/** W3.6 — pobierz listę bundli dla aktualnej org (max 50, posortowane od najnowszych). */
export interface BundleListItem {
  id: string;
  title: string | null;
  lifecycleState: string;
  themeId: string | null;
  language: string;
  isLocked: boolean;
  qualityPassed: boolean | null;
  createdAt: string;
  updatedAt: string;
}

export async function listBundles(): Promise<BundleListItem[]> {
  try {
    const { token, orgId } = _extractAuth();
    const headers = _buildHeaders(token, orgId, 'application/json');
    const res = await fetch(`${API_URL}/deliverables/generations/bundles`, { headers });
    if (!res.ok) return [];
    const data = await res.json() as { success: boolean; bundles?: BundleListItem[] };
    return data.bundles ?? [];
  } catch {
    return [];
  }
}

function _triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
