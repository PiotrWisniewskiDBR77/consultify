export interface NotebookCaptureMetadata {
  fileOriginalname?: string | null;
  fileMimetype?: string | null;
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
  if (String(captureSource || '').trim().toLowerCase() !== 'upload') {
    return null;
  }

  const originalName = String(captureMetadata?.fileOriginalname || '').trim();
  if (!originalName) {
    return {
      label: isPolish ? 'Wgrany plik' : 'Uploaded file',
      title: isPolish ? 'Notatka utworzona z wgranego pliku' : 'Note created from an uploaded file',
    };
  }

  return {
    label: `${isPolish ? 'Plik' : 'File'}: ${originalName}`,
    title: isPolish
      ? `Notatka utworzona z pliku ${originalName}`
      : `Note created from file ${originalName}`,
  };
}
