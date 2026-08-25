import i18n from '../../../i18n';

export interface NotebookCaptureMetadata {
  fileOriginalname?: string | null;
  fileMimetype?: string | null;
  url?: string | null;
  emailFrom?: string | null;
  /** C4 — provenance written by canvasMaterialize (e.g. 'work_canvas'). */
  sourceType?: string | null;
}

export interface NotebookCaptureSourceSummary {
  label: string;
  title: string;
}

/**
 * `isPolish` is threaded explicitly through this function's args (not read
 * from global i18next state), so `tr()` forces the i18next `lng` per-call —
 * same pattern as useProcessFlowAIProposal.ts / ProcessFlowContextMenu.tsx.
 */
function tr(
  isPolish: boolean,
  key: string,
  defaultValue: string,
  vars?: Record<string, unknown>
): string {
  return i18n.t(`notebook.captureSourceSummary.${key}`, defaultValue, {
    lng: isPolish ? 'pl' : 'en',
    ...vars,
  });
}

export function getNotebookUploadSourceSummary(
  captureSource: string | null | undefined,
  captureMetadata: NotebookCaptureMetadata | null | undefined,
  isPolish: boolean
): NotebookCaptureSourceSummary | null {
  const normalizedSource = String(captureSource || '')
    .trim()
    .toLowerCase();

  // C4 — Canvas provenance pilot. Notes materialized from a Work Canvas draft
  // arrive with capture_source='api_import' + metadata.sourceType='work_canvas'
  // (server/src/services/canvasMaterialize.ts). Surface the real origin instead
  // of the generic API-import label.
  const sourceType = String(captureMetadata?.sourceType || '')
    .trim()
    .toLowerCase();
  if (sourceType === 'work_canvas') {
    return {
      label: 'Canvas',
      title: tr(isPolish, 'title', 'Source: Canvas (conversation)'),
    };
  }

  if (normalizedSource === 'web_clipper') {
    const sourceUrl = String(captureMetadata?.url || '').trim();
    return {
      label: tr(isPolish, 'label', 'Web clip'),
      title: sourceUrl
        ? tr(isPolish, 'clippedPageWithUrl', 'Note created from a clipped page: {{sourceUrl}}', {
            sourceUrl,
          })
        : tr(isPolish, 'label2', 'Note created from a clipped page'),
    };
  }

  if (normalizedSource === 'email_forward') {
    const sender = String(captureMetadata?.emailFrom || '').trim();
    return {
      label: tr(isPolish, 'label3', 'Email'),
      title: sender
        ? tr(isPolish, 'forwardedEmailFrom', 'Note created from a forwarded email from {{sender}}', {
            sender,
          })
        : tr(isPolish, 'label4', 'Note created from a forwarded email'),
    };
  }

  if (normalizedSource === 'api_import') {
    return {
      label: tr(isPolish, 'label5', 'API import'),
      title: tr(isPolish, 'title2', 'Note created from an external import'),
    };
  }

  if (normalizedSource !== 'upload') {
    return null;
  }

  const originalName = String(captureMetadata?.fileOriginalname || '').trim();
  if (!originalName) {
    return {
      label: tr(isPolish, 'label6', 'Uploaded file'),
      title: tr(isPolish, 'title3', 'Note created from an uploaded file'),
    };
  }

  return {
    label: `${tr(isPolish, 'label7', 'File')}: ${originalName}`,
    title: tr(isPolish, 'createdFromFile', 'Note created from file {{originalName}}', {
      originalName,
    }),
  };
}
