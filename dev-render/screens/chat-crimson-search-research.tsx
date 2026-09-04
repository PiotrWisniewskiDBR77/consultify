/** Dyżur 315: real ConversationSearch in its product-sized slot. */
import React from 'react';

import { ConversationSearch } from '../../src/components/AIChat/ConversationSearch';

const Screen: React.FC = () => {
  const [value, setValue] = React.useState('');
  React.useEffect(() => {
    document.querySelector<HTMLInputElement>('input')?.focus();
  }, []);
  return (
    <main className="min-h-screen bg-c-bg p-10 text-c-text">
      <div className="w-96 rounded-xl border border-c-border bg-c-surface p-4">
        <ConversationSearch value={value} onChange={setValue} placeholder="Szukaj rozmów" />
      </div>
    </main>
  );
};

export default Screen;
