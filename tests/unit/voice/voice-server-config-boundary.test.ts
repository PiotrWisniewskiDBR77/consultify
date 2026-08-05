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
    const tokenService = readFileSync(
      resolve(process.cwd(), 'server/src/services/ai/geminiLiveTokenService.ts'),
      'utf8'
    );

    // Commit 44f314efcd (2026-06-08, "wire Anna/Teresa voice runtime service
    // and config") replaced the old hand-rolled `apiKey: enabled ? ... : ...`
    // / `apiKey: apiKey` response literals this guard used to check with a
    // shared resolveVoiceRuntime() SSOT (server/src/services/ai/
    // voiceRuntimeService.ts) that both routes now call — the literal string
    // "clientToken" moved out of the route files into
    // geminiLiveTokenService.ts, which mints it onto `session.clientToken`.
    // The route handlers themselves just forward `session: runtime.session`.
    // Re-derive the same two window checks against that reality: (a) the
    // /voice-config response object literal in each route never assigns an
    // `apiKey:` field, and (b) both routes source that response from the
    // shared, audited resolveVoiceRuntime() call rather than building their
    // own token/key handling — with the token-minting service itself proven
    // to still produce a real `clientToken` field.
    const teresaVoiceConfigIdx = teresaRoute.indexOf("'/voice-config'");
    expect(teresaVoiceConfigIdx, 'Teresa /voice-config route not found').toBeGreaterThanOrEqual(0);
    const teresaVoiceConfigBlock = teresaRoute.slice(
      teresaVoiceConfigIdx,
      teresaRoute.indexOf('router.post', teresaVoiceConfigIdx)
    );
    expect(teresaVoiceConfigBlock).not.toMatch(/\bapiKey\s*:/);
    expect(teresaVoiceConfigBlock).toContain('resolveVoiceRuntime');
    expect(teresaVoiceConfigBlock).toContain('session');

    const annaVoiceConfigIdx = annaRoute.indexOf("'/voice-config'");
    expect(annaVoiceConfigIdx, 'Anna /voice-config route not found').toBeGreaterThanOrEqual(0);
    const annaVoiceConfigBlock = annaRoute.slice(
      annaVoiceConfigIdx,
      annaRoute.indexOf("'/voice-context'", annaVoiceConfigIdx)
    );
    expect(annaVoiceConfigBlock).not.toMatch(/\bapiKey\s*:/);
    expect(annaVoiceConfigBlock).toContain('resolveVoiceRuntime');
    expect(annaVoiceConfigBlock).toContain('session');

    // Negative control: this file DOES legitimately use `apiKey` elsewhere
    // (Anna's server-side Gemini text-generation call, unrelated to the
    // voice-config response) — proving the assertion above is scoped to the
    // route block and not vacuously passing because "apiKey" is absent from
    // the whole file.
    expect(annaRoute).toMatch(/\bapiKey\s*:/);

    expect(tokenService).toContain('clientToken');
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
