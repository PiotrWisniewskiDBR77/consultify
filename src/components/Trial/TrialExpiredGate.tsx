import React from 'react';

export const TrialExpiredGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Expired trial UX is centralized in GlobalAccessBanners + AccessBlockedModal.
  return <>{children}</>;
};
