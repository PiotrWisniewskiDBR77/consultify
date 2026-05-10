import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('Wave 2 voice config boundaries', () => {
  it('keeps Teresa voice on server-provided config instead of frontend env keys', () => {
    const hook = readFileSync(resolve(process.cwd(), 'src/hooks/useTeresaVoice.ts'), 'utf8');
    const provider = readFileSync(resolve(process.cwd(), 'src/contexts/TeresaVoiceContext.tsx'), 'utf8');

    expect(hook).not.toContain('NEXT_PUBLIC_GEMINI_API_KEY');
    expect(hook).not.toContain('process.env.GEMINI_API_KEY');
    expect(provider).toContain('/api/v10/teresa/voice-config');
    expect(provider).toContain('session?.clientToken');
    expect(provider).toContain('voice_unavailable');
    expect(provider).toContain('voice_started');
    expect(provider).toContain('voice_error');
  });

  it('keeps Anna public voice on server-provided config instead of frontend env keys', () => {
    const widget = readFileSync(
      resolve(process.cwd(), 'src/components/Landing/AnnaAssistantWidget.tsx'),
      'utf8'
    );

    expect(widget).not.toContain('NEXT_PUBLIC_GEMINI_API_KEY');
    expect(widget).not.toContain('process.env.GEMINI_API_KEY');
    expect(widget).toContain('/api/public/anna/voice-config');
    expect(widget).toContain('session?.clientToken');
  });

  it('does not expose server voice keys as apiKey from voice-config routes', () => {
    const teresaRoute = readFileSync(
      resolve(process.cwd(), 'server/src/routes/v10/teresa.routes.ts'),
      'utf8'
    );
    const annaRoute = readFileSync(
      resolve(process.cwd(), 'server/src/routes/public-anna.routes.ts'),
      'utf8'
    );

    expect(teresaRoute).not.toContain('apiKey: enabled ?');
    expect(teresaRoute).toContain('clientToken');
    expect(annaRoute).not.toContain('apiKey: apiKey');
    expect(annaRoute).toContain('clientToken');
  });

  it('passes Teresa unavailable posture into the canonical chat input', () => {
    const panel = readFileSync(
      resolve(process.cwd(), 'src/components/AIChat/UnifiedChatPanel.tsx'),
      'utf8'
    );
    const input = readFileSync(
      resolve(process.cwd(), 'src/components/AIChat/EnhancedChatInput.tsx'),
      'utf8'
    );

    expect(panel).toContain('teresaVoiceAvailable={teresaVoice.voiceAvailable}');
    expect(panel).toContain('teresaVoiceUnavailableReason={teresaVoice.voiceUnavailableReason}');
    expect(input).toContain('teresaVoiceAvailable');
    expect(input).toContain('teresaVoiceUnavailableReason');
  });
});
