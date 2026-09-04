/** Dyżur 315: real PrivateModeDetails, opened and focused. */
import React from 'react';

import { PrivateModeDetails } from '../../src/components/AIChat/PrivateModeDetails';

const Screen: React.FC = () => {
  React.useEffect(() => {
    const button = document.querySelector<HTMLButtonElement>(
      '[data-testid="private-mode-badge-trigger"]'
    );
    button?.click();
    button?.focus();
  }, []);
  return (
    <main className="flex min-h-screen justify-end bg-c-bg p-10 text-c-text">
      <PrivateModeDetails isEnabled={() => true} />
    </main>
  );
};

export default Screen;
