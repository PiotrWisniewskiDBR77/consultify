import React from 'react';

type TeresaMarkProps = {
  size?: number;
  className?: string;
  strokeWidth?: number;
};

/**
 * TeresaMark
 *
 * Unified assistant symbol for Teresa surfaces across the app.
 */
export const TeresaMark: React.FC<TeresaMarkProps> = ({
  size = 16,
  className,
  strokeWidth = 1.8,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={strokeWidth} />
      <path
        d="M7.5 8.5H16.5M12 8.5V15.5M9.5 15.5H14.5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="17.8" cy="6.2" r="1.15" fill="currentColor" />
    </svg>
  );
};

export default TeresaMark;
