/**
 * A6 "Whiteboard finish" — image upload with mandatory base64 fallback.
 *
 * Extracted from IdeaWhiteboardTool's paste/drop handlers so the upload +
 * fallback contract can be unit-tested without mounting the whole canvas.
 *
 * Background: whiteboard images used to be inlined as base64 data URIs
 * directly into node data, bloating nodes_json and making every autosave
 * (/map/sync) ship the full image bytes again on every save. This helper
 * uploads the raw file to POST /api/my-work/whiteboard/images and returns a
 * URL-backed image instead. If the upload fails for ANY reason (network
 * error, 4xx/5xx, timeout) it falls back to the historical behavior — inline
 * base64 — so nothing is ever lost, including fully offline usage.
 */
import { Api } from '@/services/api';

export interface WhiteboardImageUploadResult {
  /** true when the image was persisted to storage and `imageUrl` is set. */
  uploaded: boolean;
  /** Present when uploaded === true — the storage-backed URL for the image. */
  imageUrl?: string;
  /** Present when uploaded === false — the legacy inline base64 data URI. */
  src?: string;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result;
      if (typeof dataUrl === 'string' && dataUrl) {
        resolve(dataUrl);
      } else {
        reject(new Error('FileReader produced an empty result'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads `file` to whiteboard image storage. On any failure, falls back to
 * reading the file as a base64 data URI (the pre-A6 behavior) so the image is
 * never lost. Never rejects — callers can always insert a node from the result.
 */
export async function uploadWhiteboardImageWithFallback(
  file: File
): Promise<WhiteboardImageUploadResult> {
  try {
    const formData = new FormData();
    formData.append('image', file);
    const res = await Api.postMultipart('/my-work/whiteboard/images', formData);
    const url = res?.data?.url ?? res?.url;
    if (typeof url === 'string' && url) {
      return { uploaded: true, imageUrl: url };
    }
    throw new Error('Upload response missing url');
  } catch {
    // Fallback: preserve the historical inline-base64 behavior so offline /
    // degraded-backend usage never loses the pasted/dropped image.
    const src = await readFileAsDataUrl(file);
    return { uploaded: false, src };
  }
}
