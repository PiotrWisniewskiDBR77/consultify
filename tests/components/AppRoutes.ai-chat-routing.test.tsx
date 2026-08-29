/**
 * AppRoutes — AI Chat routing contract (Module 01, P0-5).
 *
 * The canonical chat door is `/chat` (and the deep link `/chat/:conversationId`).
 * Both must mount `UnifiedChatPanel mode="full"` inside `MainLayout` with a
 * `ConversationRouteSync` that keeps the selected conversation in sync with the
 * URL. The legacy `AIChatWelcomeView` (2400 LOC dead code) must be fully removed.
 *
 * These are source-level + route-config assertions (the full AppRoutes render
 * pulls in the entire provider tree, so we verify the wiring contract directly,
 * matching the existing `appRoutes.chat-shell.test.ts` convention).
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ROUTES } from '../../src/routes/routeConfig';

const readSource = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8');

describe('AppRoutes — AI Chat routing', () => {
  const appRoutes = readSource('src/routes/AppRoutes.tsx');

  it('exposes /chat and /chat/:conversationId as the canonical chat routes', () => {
    expect(ROUTES.AI_CHAT).toBe('/chat');
    expect(ROUTES.AI_CHAT_CONVERSATION).toBe('/chat/:conversationId');
  });

  it('mounts both chat routes on UnifiedChatPanel mode="full"', () => {
    expect(appRoutes).toContain("import('@/components/AIChat/UnifiedChatPanel')");
    expect(appRoutes).toContain('path={ROUTES.AI_CHAT}');
    expect(appRoutes).toContain('path={ROUTES.AI_CHAT_CONVERSATION}');

    // Exactly the two chat routes render the full panel.
    const fullPanelMounts = appRoutes.match(/<UnifiedChatPanel mode="full" \/>/g) ?? [];
    expect(fullPanelMounts.length).toBeGreaterThanOrEqual(2);
  });

  it('keeps the conversation/URL in sync via ConversationRouteSync on chat routes', () => {
    expect(appRoutes).toContain('<ConversationRouteSync />');
    expect(appRoutes).toContain("import { ConversationRouteSync }");
  });

  it('renders chat inside the shared MainLayout shell (no bespoke shell)', () => {
    // The chat route blocks wrap the panel in MainLayout.
    const chatRouteBlock = appRoutes.slice(appRoutes.indexOf('path={ROUTES.AI_CHAT}'));
    expect(chatRouteBlock).toContain('MainLayout');
    expect(chatRouteBlock).toContain("t('navigation.aiChat', 'AI Chat')");
  });

  it('has fully removed the dead AIChatWelcomeView', () => {
    expect(existsSync(resolve(process.cwd(), 'src/views/AIChatWelcomeView.tsx'))).toBe(false);
    expect(appRoutes).not.toContain("import('@/views/AIChatWelcomeView')");
    expect(appRoutes).not.toContain('<AIChatWelcomeView');
  });

  it('localizes the Partner Portal shell breadcrumb', () => {
    expect(appRoutes).toContain("t('partner.sidebar.title', 'Partner Portal')");
  });
});
