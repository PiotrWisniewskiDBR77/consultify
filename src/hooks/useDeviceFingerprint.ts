// Device fingerprinting hook
// Generates a unique device fingerprint for session security
// Returns null when fingerprinting is not available

import { useState } from 'react';

// Generate device fingerprint
// Basic implementation — returns null when advanced fingerprinting is not configured
const generateFingerprint = (): string | null => {
  // In a real implementation, this would collect various device characteristics
  // For now, return null
  return null;
};

export const useDeviceFingerprint = (): string | null => {
  // Use lazy initialization to compute fingerprint once
  const [fingerprint] = useState<string | null>(() => generateFingerprint());

  return fingerprint;
};
