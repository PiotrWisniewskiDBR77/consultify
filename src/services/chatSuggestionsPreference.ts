/**
 * DEC-386 (2026-09-04) — server-side mirror of the AI Chat "chipy sugestii"
 * toggle (aiConfig.chatSuggestionsEnabled, src/store/slices/chatSlice.ts).
 *
 * Context: the toggle itself stays exactly where it was (ToolsMenu.tsx),
 * only the storage changes. Before this change the ONLY storage was the
 * zustand `persist` blob in localStorage under the `consultify-storage` key
 * (see src/store/useAppStore.ts) — a preference set on one browser/machine
 * never followed the user to another one.
 *
 * This module reuses the existing personal AI-settings endpoint
 * (`GET/PUT /api/ai-settings/user`, server/src/routes/ai/ai-settings.routes.ts
 * -> AISettingsService.getUserSettings/updateUserSettings,
 * server/src/services/aiSettingsService.ts), backed by the
 * `user_ai_settings.chat_suggestions_enabled` column added in
 * server/migrations/963_user_ai_settings_chat_suggestions.sql. No new
 * endpoint — the user tier already existed, it just didn't carry this field.
 *
 * localStorage remains an optimistic cache (so the toggle still renders
 * instantly and still works offline/pre-hydration); the server row is the
 * source of truth. Both functions below fail soft: a network/DB error must
 * never crash the chat UI or the toggle — it just means the cache keeps
 * whatever it already had.
 */
import { Api } from './api';

/**
 * Call once per cold session start (see src/App.tsx verifyAuth effect) after
 * the user is authenticated. Pulls the server value and overwrites the
 * zustand aiConfig.chatSuggestionsEnabled that persist() already rehydrated
 * from localStorage — so a value set on another browser/machine wins once
 * the server is reachable. On any failure (offline, 503 "service not
 * configured", user row not yet migrated) this is a deliberate no-op: the
 * localStorage-rehydrated value is the fallback, never a hard-coded default.
 */
export async function syncChatSuggestionsPreferenceFromServer(): Promise<void> {
  try {
    const settings = await Api.getAIUserSettings();
    const serverValue = settings?.chat_suggestions_enabled;
    if (typeof serverValue !== 'boolean') return;

    const { useAppStore } = await import('../store/useAppStore');
    useAppStore.getState().setAIConfig({ chatSuggestionsEnabled: serverValue });
  } catch {
    // Offline / service unavailable — keep the localStorage-rehydrated value.
  }
}

/**
 * Call whenever the user flips the toggle (ToolsMenu.tsx toggleMode). Fire
 * and forget from the caller's point of view: the local aiConfig update
 * (via setAIConfig, already persisted to localStorage) is the optimistic
 * write; this pushes the same value to the server row so it is what the
 * next cold session (or a teammate's — no, this is per-user, so only this
 * same user on another machine) reads back.
 */
export async function pushChatSuggestionsPreferenceToServer(enabled: boolean): Promise<void> {
  try {
    await Api.updateAIUserSettings({ chat_suggestions_enabled: enabled });
  } catch {
    // Best-effort — localStorage already has the optimistic value.
  }
}
