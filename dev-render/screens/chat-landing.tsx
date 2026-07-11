/**
 * Mock host for <ChatLandingLightShell> — the /chat landing-screen light
 * shell. Reuses the REAL component (no re-implementation); wires `onSend` /
 * `onSuggestionClick` to local state so the harness can show what a
 * submitted query looks like without a backend (no real streaming).
 */
import React, { useState } from 'react';

import ChatLandingLightShell, {
  type ChatLandingSuggestionLite,
} from '../../src/components/AIChat/ChatLandingLightShell';

export function ChatLandingScreen(): React.ReactElement {
  const [lastSent, setLastSent] = useState<string | null>(null);

  return (
    <div className="relative h-full">
      <ChatLandingLightShell
        userName="Piotr"
        onSend={(text) => setLastSent(text)}
        onSuggestionClick={(s: ChatLandingSuggestionLite) => setLastSent(s.prompt)}
      />
      {lastSent && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-c-border bg-c-surface px-3 py-1 text-[11px] text-c-text-muted shadow-sm">
          Mock wysłano: “{lastSent}”
        </div>
      )}
    </div>
  );
}

export default ChatLandingScreen;
