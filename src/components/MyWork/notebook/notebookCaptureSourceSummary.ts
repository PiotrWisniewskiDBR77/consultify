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
      title: i18n.t('notebook.captureSourceSummary.title', 'Source: Canvas (conversation)'),
    };
  }

  if (normalizedSource === 'web_clipper') {
    const sourceUrl = String(captureMetadata?.url || '').trim();
    return {
      label: i18n.t('notebook.captureSourceSummary.label', 'Web clip'),
      title: sourceUrl
        ? i18n.t(
            'notebook.captureSourceSummary.clippedPageWithUrl',
            'Note created from a clipped page: {{sourceUrl}}',
            {
              sourceUrl,
            }
          )
        : i18n.t('notebook.captureSourceSummary.label2', 'Note created from a clipped page'),
    };
  }

  if (normalizedSource === 'email_forward') {
    const sender = String(captureMetadata?.emailFrom || '').trim();
    return {
      label: i18n.t('notebook.captureSourceSummary.label3', 'Email'),
      title: sender
        ? i18n.t(
            'notebook.captureSourceSummary.forwardedEmailFrom',
            'Note created from a forwarded email from {{sender}}',
            { sender }
          )
        : i18n.t('notebook.captureSourceSummary.label4', 'Note created from a forwarded email'),
    };
  }

  if (normalizedSource === 'api_import') {
    return {
      label: i18n.t('notebook.captureSourceSummary.label5', 'API import'),
      title: i18n.t('notebook.captureSourceSummary.title2', 'Note created from an external import'),
    };
  }

  if (normalizedSource !== 'upload') {
    return null;
  }

  const originalName = String(captureMetadata?.fileOriginalname || '').trim();
  if (!originalName) {
    return {
      label: i18n.t('notebook.captureSourceSummary.label6', 'Uploaded file'),
      title: i18n.t('notebook.captureSourceSummary.title3', 'Note created from an uploaded file'),
    };
  }

  return {
    label: `${i18n.t('notebook.captureSourceSummary.label7', 'File')}: ${originalName}`,
    title: i18n.t(
      'notebook.captureSourceSummary.createdFromFile',
      'Note created from file {{originalName}}',
      {
        originalName,
      }
    ),
  };
}
