export interface NotebookCaptureMetadata {
  fileOriginalname?: string | null;
  fileMimetype?: string | null;
  url?: string | null;
  emailFrom?: string | null;
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
  const normalizedSource = String(captureSource || '').trim().toLowerCase();

  if (normalizedSource === 'web_clipper') {
    const sourceUrl = String(captureMetadata?.url || '').trim();
    return {
      label: isPolish ? 'Web clip' : 'Web clip',
      title: sourceUrl
        ? isPolish
          ? `Notatka utworzona z zapisanej strony: ${sourceUrl}`
          : `Note created from a clipped page: ${sourceUrl}`
        : isPolish
          ? 'Notatka utworzona z zapisanej strony'
          : 'Note created from a clipped page',
    };
  }

  if (normalizedSource === 'email_forward') {
    const sender = String(captureMetadata?.emailFrom || '').trim();
    return {
      label: isPolish ? 'Email' : 'Email',
      title: sender
        ? isPolish
          ? `Notatka utworzona z przesłanego maila od ${sender}`
          : `Note created from a forwarded email from ${sender}`
        : isPolish
          ? 'Notatka utworzona z przesłanego maila'
          : 'Note created from a forwarded email',
    };
  }

  if (normalizedSource === 'api_import') {
    return {
      label: isPolish ? 'Import API' : 'API import',
      title: isPolish
        ? 'Notatka utworzona przez import zewnętrzny'
        : 'Note created from an external import',
    };
  }

  if (normalizedSource !== 'upload') {
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
