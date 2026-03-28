import React from 'react';

import { getNotebookUploadSourceSummary } from './notebookCaptureSourceSummary';
import { getNotebookConvertedOutputSummary } from './notebookConvertedOutputSummary';

type NotebookConvertedOutputRef = {
  type?: string | null;
  id?: string | null;
};

type NotebookCaptureMetadata = {
  fileOriginalname?: string | null;
  fileMimetype?: string | null;
} | null;

interface NotebookMetadataBadgesProps {
  captureSource?: string | null;
  captureMetadata?: NotebookCaptureMetadata;
  convertedTo?: NotebookConvertedOutputRef[] | null;
  isPolish: boolean;
  className?: string;
}

export const NotebookMetadataBadges: React.FC<NotebookMetadataBadgesProps> = ({
  captureSource,
  captureMetadata,
  convertedTo,
  isPolish,
  className = '',
}) => {
  const uploadSource = getNotebookUploadSourceSummary(captureSource, captureMetadata, isPolish);
  const convertedSummary = getNotebookConvertedOutputSummary(convertedTo);

  if (!uploadSource && convertedSummary.total === 0) {
    return null;
  }

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`.trim()}>
      {uploadSource ? (
        <span
          className="inline-flex items-center rounded-md bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-600 dark:text-sky-400"
          title={uploadSource.title}
        >
          {uploadSource.label}
        </span>
      ) : null}
      {convertedSummary.total > 0 ? (
        <span
          className="inline-flex items-center rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400"
          title={convertedSummary.visibleTypes.join(', ')}
        >
          {convertedSummary.visibleTypes.join(', ')}
          {convertedSummary.extraCount > 0 ? ` +${convertedSummary.extraCount}` : ''}
        </span>
      ) : null}
    </div>
  );
};
