import React from 'react';

export interface ArtifactBottomBarProps {
  leading?: React.ReactNode;
  center?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
}

/**
 * View/status surface only. Save, lifecycle, QA and export belong to Menu 2;
 * callers provide the global Teresa trigger in `trailing` when required.
 */
export const ArtifactBottomBar: React.FC<ArtifactBottomBarProps> = ({
  leading,
  center,
  trailing,
  className,
}) => (
  <div
    className={`grid h-full w-full grid-cols-[1fr_auto_1fr] items-center gap-3 text-xs text-c-text-muted ${className ?? ''}`}
    data-testid="artifact-bottom-bar-content"
  >
    <div className="min-w-0 truncate justify-self-start">{leading}</div>
    <div className="min-w-0 truncate justify-self-center">{center}</div>
    <div className="flex min-w-0 items-center gap-2 justify-self-end">{trailing}</div>
  </div>
);

export default ArtifactBottomBar;
