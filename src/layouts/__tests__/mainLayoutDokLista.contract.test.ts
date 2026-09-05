import { beforeEach, describe, expect, it } from 'vitest';

import {
  isEmbeddedModuleChatHosted,
  registerEmbeddedModuleChatHost,
  resetEmbeddedModuleChatHost,
} from '@/components/shared/embeddedModuleChatHost';

describe('T5 kontrakt doku globalnego i gospodarza listy', () => {
  beforeEach(resetEmbeddedModuleChatHost);

  it('gospodarz wyłącza dok, a ekran bez gospodarza go zachowuje', () => {
    const shouldMountChatPanel = () => !isEmbeddedModuleChatHosted();
    expect(shouldMountChatPanel()).toBe(true);
    const unregister = registerEmbeddedModuleChatHost();
    expect(shouldMountChatPanel()).toBe(false);
    unregister();
    expect(shouldMountChatPanel()).toBe(true);
  });
});
