/**
 * Settings API Module
 * Enterprise SaaS Architecture - User & System Settings
 */

import {
  API_URL,
  apiDelete,
  apiGet,
  apiPost,
  apiPut,
  fetchWithRetry,
  getHeaders,
  handleResponse,
} from './baseClient';

export interface Integration {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'inactive' | 'error';
  config?: Record<string, unknown>;
  lastSyncAt?: string;
}

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  status: 'active' | 'inactive';
  secret?: string;
  lastTriggeredAt?: string;
}

type AccessibilityPreferences = {
  fontSize: 'small' | 'medium' | 'large' | 'extra-large';
  highContrastMode: boolean;
  reduceMotion: boolean;
  screenReaderOptimized: boolean;
  showKeyboardShortcuts: boolean;
  focusHighlight: boolean;
  cursorSize: 'default' | 'large' | 'extra-large';
  textSpacing: 'default' | 'relaxed' | 'spacious';
  underlineLinks: boolean;
  colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
  fontFamily: string;
  lineHeight: 'default' | 'relaxed' | 'loose';
  letterSpacing: 'default' | 'wide' | 'wider';
  voiceCommandsEnabled: boolean;
  textToSpeechEnabled: boolean;
  speechToTextEnabled: boolean;
  caretWidth: 'default' | 'thick';
  focusIndicatorStyle: 'default' | 'high-contrast' | 'animated';
};

type PrivacyPreferences = {
  showOnlineStatus: boolean;
  activityVisibility: 'all' | 'team' | 'private';
  profileVisibility: 'public' | 'organization' | 'private';
  allowMentions: boolean;
  showInDirectory: boolean;
  shareActivityWithAI: boolean;
};

type KeyboardShortcutsPreferences = {
  preset: 'default' | 'vscode' | 'sublime' | 'vim' | 'custom';
  enabled: boolean;
  showHints: boolean;
  customShortcuts: Record<string, string>;
  disabledShortcuts: string[];
};

type AppearancePreferences = {
  theme: 'light' | 'dark' | 'system';
  accentColor: string;
  density: 'compact' | 'comfortable' | 'spacious';
  // Percent scale (90/100/110/120) applied to the root font size. The server
  // stores this as a raw multiplier (default 1); normalize/serialize convert
  // between the two representations so the UI always deals in whole percent.
  fontScale: number;
};

type VoicePreferences = {
  ttsEnabled: boolean;
  sttEnabled: boolean;
  voice: string;
  speed: number;
  autoPlay: boolean;
};

type AIPrivacyPreferences = {
  allowProjectData: boolean;
  allowClientData: boolean;
  allowFinancialData: boolean;
  allowPersonalNotes: boolean;
  optOutTraining: boolean;
  dataRetention: 'session' | '7d' | '30d' | '90d' | 'unlimited';
  auditLogEnabled: boolean;
  anonymizeExports: boolean;
};

type RegionalPreferences = {
  timezone: string;
  units: 'metric' | 'imperial';
  currency: string;
  numberFormat: 'en-US' | 'de-DE' | 'pl-PL' | 'fr-FR';
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD' | 'DD.MM.YYYY';
  timeFormat: '12h' | '24h';
  firstDayOfWeek: 'monday' | 'sunday';
};

type AIMemoryPreferences = {
  enabled: boolean;
  retentionDays: number;
  includeConversations: boolean;
  includePreferences: boolean;
  includeContext: boolean;
};

export interface PromptLibraryItem {
  id: string;
  name: string;
  category: 'interview' | 'analysis' | 'report' | 'general';
  prompt: string;
  createdAt: string;
}

export interface SettingsExportPayload {
  version: string;
  exportedAt: string;
  userId: string;
  settings: Record<string, unknown>;
}

const normalizeAccessibilityPreferences = (
  preferences: Record<string, unknown> = {}
): AccessibilityPreferences => ({
  fontSize: (preferences.fontSize as AccessibilityPreferences['fontSize']) || 'medium',
  highContrastMode: Boolean(preferences.highContrastMode),
  reduceMotion: Boolean(preferences.reduceMotion),
  screenReaderOptimized: Boolean(preferences.screenReaderOptimized),
  showKeyboardShortcuts: Boolean(
    preferences.showKeyboardShortcuts ?? preferences.showShortcuts ?? true
  ),
  focusHighlight: Boolean(preferences.focusHighlight ?? true),
  cursorSize: (preferences.cursorSize as AccessibilityPreferences['cursorSize']) || 'default',
  textSpacing: (preferences.textSpacing as AccessibilityPreferences['textSpacing']) || 'default',
  underlineLinks: Boolean(preferences.underlineLinks),
  colorBlindMode:
    (preferences.colorBlindMode as AccessibilityPreferences['colorBlindMode']) || 'none',
  fontFamily: (preferences.fontFamily as string) || 'system',
  lineHeight: (preferences.lineHeight as AccessibilityPreferences['lineHeight']) || 'default',
  letterSpacing:
    (preferences.letterSpacing as AccessibilityPreferences['letterSpacing']) || 'default',
  voiceCommandsEnabled: Boolean(preferences.voiceCommandsEnabled ?? preferences.voiceCommands),
  textToSpeechEnabled: Boolean(preferences.textToSpeechEnabled ?? preferences.textToSpeech),
  speechToTextEnabled: Boolean(preferences.speechToTextEnabled ?? preferences.speechToText),
  caretWidth:
    (preferences.caretWidth as AccessibilityPreferences['caretWidth']) ||
    ((preferences.textCursorWidth as AccessibilityPreferences['caretWidth']) ?? 'default'),
  focusIndicatorStyle:
    (preferences.focusIndicatorStyle as AccessibilityPreferences['focusIndicatorStyle']) ||
    ((preferences.focusIndicator as AccessibilityPreferences['focusIndicatorStyle']) ?? 'default'),
});

const serializeAccessibilityPreferences = (
  preferences: AccessibilityPreferences
): Record<string, unknown> => ({
  fontSize: preferences.fontSize,
  highContrastMode: preferences.highContrastMode,
  reduceMotion: preferences.reduceMotion,
  screenReaderOptimized: preferences.screenReaderOptimized,
  showShortcuts: preferences.showKeyboardShortcuts,
  focusHighlight: preferences.focusHighlight,
  cursorSize: preferences.cursorSize,
  textSpacing: preferences.textSpacing,
  underlineLinks: preferences.underlineLinks,
  colorBlindMode: preferences.colorBlindMode,
  fontFamily: preferences.fontFamily,
  lineHeight: preferences.lineHeight,
  letterSpacing: preferences.letterSpacing,
  voiceCommands: preferences.voiceCommandsEnabled,
  textToSpeech: preferences.textToSpeechEnabled,
  speechToText: preferences.speechToTextEnabled,
  textCursorWidth: preferences.caretWidth,
  focusIndicator: preferences.focusIndicatorStyle,
});

export const FONT_SCALE_STEPS = [90, 100, 110, 120];

export const normalizeFontScale = (raw: unknown): number => {
  const n = typeof raw === 'number' && Number.isFinite(raw) ? raw : NaN;
  if (Number.isNaN(n) || n <= 0) return 100;
  // The server's default preference row stores a multiplier (e.g. 1 = 100%);
  // anything already saved from this UI is a whole percent (90/100/110/120).
  const percent = Math.round(n <= 2 ? n * 100 : n);
  return FONT_SCALE_STEPS.reduce((closest, step) =>
    Math.abs(step - percent) < Math.abs(closest - percent) ? step : closest
  );
};

export const normalizeAppearancePreferences = (
  preferences: Record<string, unknown> = {}
): AppearancePreferences => ({
  theme: (preferences.theme as AppearancePreferences['theme']) || 'system',
  accentColor: (preferences.accentColor as string) || '#A51C30',
  density:
    (preferences.density as AppearancePreferences['density']) ||
    ((preferences.uiDensity as AppearancePreferences['density']) ?? 'comfortable'),
  fontScale: normalizeFontScale(preferences.fontScale),
});

export const serializeAppearancePreferences = (
  preferences: AppearancePreferences
): Record<string, unknown> => ({
  theme: preferences.theme,
  accentColor: preferences.accentColor,
  uiDensity: preferences.density,
  fontScale: preferences.fontScale,
});

const normalizePromptLibrary = (items: unknown): PromptLibraryItem[] => {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    id: String((item as any).id),
    name: String((item as any).name || ''),
    category: ((item as any).category || 'general') as PromptLibraryItem['category'],
    prompt: String((item as any).prompt || ''),
    createdAt: String((item as any).createdAt || new Date().toISOString().split('T')[0]),
  }));
};

const EXPORT_CATEGORY_MAP: Record<string, string[]> = {
  profile: ['profile', 'regional', 'working-hours'],
  security: ['shortcuts'],
  privacy: ['privacy', 'ai-privacy', 'gdpr-consents', 'gdpr-retention'],
  aiPreferences: [
    'ai-instructions',
    'ai-model',
    'ai-parameters',
    'ai-personality',
    'ai-autocomplete',
    'ai-memory',
    'ai-voice',
    'ai-privacy',
    'prompt-library',
  ],
  notifications: [
    'notifications',
    'quietHours',
    'dnd',
    'notification-sounds',
    'notification-digest',
  ],
  integrations: ['calendar-connections', 'calendar-settings'],
  appearance: ['appearance', 'accessibility'],
  keyboard: ['shortcuts'],
};

const expandExportCategories = (categories?: string[]): string[] | undefined => {
  if (!categories?.length) return undefined;
  return Array.from(
    new Set(categories.flatMap((category) => EXPORT_CATEGORY_MAP[category] || [category]))
  );
};

export const SettingsApi = {
  // ==========================================
  // SYSTEM SETTINGS
  // ==========================================

  getSystemSettings: async (): Promise<unknown> => {
    const res = await fetch(`${API_URL}/settings`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch settings');
    return res.json();
  },

  saveSetting: async (key: string, value: string): Promise<void> => {
    const res = await fetch(`${API_URL}/settings`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ key, value }),
    });
    if (!res.ok) throw new Error('Failed to save setting');
  },

  // ==========================================
  // USER PREFERENCES
  // ==========================================

  getAccessibilityPreferences: async (): Promise<{ preferences: AccessibilityPreferences }> => {
    const data = await apiGet<{ preferences?: Record<string, unknown> }>(
      '/settings/preferences/accessibility',
      'Failed to fetch accessibility preferences'
    );
    return {
      preferences: normalizeAccessibilityPreferences(data?.preferences || {}),
    };
  },

  updateAccessibilityPreferences: async (
    preferences: AccessibilityPreferences
  ): Promise<{ success: boolean }> => {
    return apiPut<{ success: boolean }>(
      '/settings/preferences/accessibility',
      { preferences: serializeAccessibilityPreferences(preferences) },
      'Failed to save accessibility preferences'
    );
  },

  getShortcutsPreferences: async (): Promise<{ preferences: KeyboardShortcutsPreferences }> => {
    const data = await apiGet<{ preferences?: Partial<KeyboardShortcutsPreferences> }>(
      '/settings/preferences/shortcuts',
      'Failed to fetch shortcut preferences'
    );
    return {
      preferences: {
        preset: 'default',
        enabled: true,
        showHints: true,
        customShortcuts: {},
        disabledShortcuts: [],
        ...(data?.preferences || {}),
      },
    };
  },

  updateShortcutsPreferences: async (
    preferences: KeyboardShortcutsPreferences
  ): Promise<{ success: boolean }> => {
    return apiPut<{ success: boolean }>(
      '/settings/preferences/shortcuts',
      preferences,
      'Failed to save shortcut preferences'
    );
  },

  getPrivacyPreferences: async (): Promise<{ preferences: PrivacyPreferences }> => {
    return apiGet<{ preferences: PrivacyPreferences }>(
      '/settings/preferences/privacy',
      'Failed to fetch privacy preferences'
    );
  },

  updatePrivacyPreferences: async (
    preferences: PrivacyPreferences
  ): Promise<{ success: boolean }> => {
    return apiPut<{ success: boolean }>(
      '/settings/preferences/privacy',
      { preferences },
      'Failed to save privacy preferences'
    );
  },

  getAppearancePreferences: async (): Promise<{ preferences: AppearancePreferences }> => {
    const data = await apiGet<{ preferences?: Record<string, unknown> }>(
      '/settings/preferences/appearance',
      'Failed to fetch appearance preferences'
    );
    return {
      preferences: normalizeAppearancePreferences(data?.preferences || {}),
    };
  },

  updateAppearancePreferences: async (
    preferences: AppearancePreferences
  ): Promise<{ success: boolean; preferences: Record<string, unknown> }> => {
    return apiPut<{ success: boolean; preferences: Record<string, unknown> }>(
      '/settings/preferences/appearance',
      serializeAppearancePreferences(preferences),
      'Failed to save appearance preferences'
    );
  },

  getAIVoicePreferences: async (): Promise<{ preferences: VoicePreferences }> => {
    return apiGet<{ preferences: VoicePreferences }>(
      '/settings/preferences/ai-voice',
      'Failed to fetch AI voice preferences'
    );
  },

  updateAIVoicePreferences: async (
    preferences: VoicePreferences
  ): Promise<{ success: boolean }> => {
    return apiPut<{ success: boolean }>(
      '/settings/preferences/ai-voice',
      { preferences },
      'Failed to save AI voice preferences'
    );
  },

  getRegionalPreferences: async (): Promise<{ preferences: Partial<RegionalPreferences> }> => {
    return apiGet<{ preferences: Partial<RegionalPreferences> }>(
      '/settings/preferences/regional',
      'Failed to fetch regional preferences'
    );
  },

  updateRegionalPreferences: async (
    preferences: RegionalPreferences
  ): Promise<{ success: boolean }> => {
    return apiPut<{ success: boolean }>(
      '/settings/preferences/regional',
      { preferences },
      'Failed to save regional preferences'
    );
  },

  getAIMemoryPreferences: async (): Promise<{ preferences: AIMemoryPreferences }> => {
    return apiGet<{ preferences: AIMemoryPreferences }>(
      '/settings/preferences/ai-memory',
      'Failed to fetch AI memory preferences'
    );
  },

  updateAIMemoryPreferences: async (
    preferences: AIMemoryPreferences
  ): Promise<{ success: boolean }> => {
    return apiPut<{ success: boolean }>(
      '/settings/preferences/ai-memory',
      { preferences },
      'Failed to save AI memory preferences'
    );
  },

  clearAIMemoryPreferences: async (): Promise<{ success: boolean }> => {
    return apiDelete<{ success: boolean }>(
      '/settings/preferences/ai-memory/clear',
      'Failed to clear AI memory'
    );
  },

  getAIPrivacyPreferences: async (): Promise<{ preferences: AIPrivacyPreferences }> => {
    return apiGet<{ preferences: AIPrivacyPreferences }>(
      '/settings/preferences/ai-privacy',
      'Failed to fetch AI privacy preferences'
    );
  },

  updateAIPrivacyPreferences: async (
    preferences: AIPrivacyPreferences
  ): Promise<{ success: boolean }> => {
    return apiPut<{ success: boolean }>(
      '/settings/preferences/ai-privacy',
      { preferences },
      'Failed to save AI privacy preferences'
    );
  },

  getPromptLibrary: async (): Promise<{ prompts: PromptLibraryItem[] }> => {
    const data = await apiGet<{ prompts?: unknown }>(
      '/settings/preferences/prompt-library',
      'Failed to fetch prompt library'
    );
    return { prompts: normalizePromptLibrary(data?.prompts) };
  },

  savePromptLibrary: async (prompts: PromptLibraryItem[]): Promise<{ success: boolean }> => {
    return apiPut<{ success: boolean }>(
      '/settings/preferences/prompt-library',
      { prompts },
      'Failed to save prompt library'
    );
  },

  getDeveloperSettings: async (): Promise<{ settings: Record<string, unknown> }> => {
    return apiGet<{ settings: Record<string, unknown> }>(
      '/settings/developer',
      'Failed to fetch developer settings'
    );
  },

  saveDeveloperSettings: async (
    settings: Record<string, unknown>
  ): Promise<{ success: boolean }> => {
    return apiPut<{ success: boolean }>(
      '/settings/developer',
      settings,
      'Failed to save developer settings'
    );
  },

  exportSettings: async (
    categories?: string[]
  ): Promise<{ data: SettingsExportPayload; filename?: string }> => {
    return apiPost<{ data: SettingsExportPayload; filename?: string }>(
      '/settings/export',
      { categories: expandExportCategories(categories) || [] },
      'Failed to export settings'
    );
  },

  importSettings: async (
    data: Record<string, unknown>,
    overwrite = true
  ): Promise<{ success: boolean; imported: string[]; skipped: string[] }> => {
    return apiPost<{ success: boolean; imported: string[]; skipped: string[] }>(
      '/settings/import',
      { data, overwrite },
      'Failed to import settings'
    );
  },

  getSettingsHistory: async (
    category?: string,
    days?: number
  ): Promise<{ entries: unknown[]; stats?: unknown }> => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (days) params.set('days', String(days));
    return apiGet<{ entries: unknown[]; stats?: unknown }>(
      `/settings/history${params.toString() ? `?${params.toString()}` : ''}`,
      'Failed to fetch settings history'
    );
  },

  restoreSettingsHistoryEntry: async (entryId: string): Promise<{ success: boolean }> => {
    return apiPost<{ success: boolean }>(
      `/settings/history/restore/${entryId}`,
      {},
      'Failed to restore settings history entry'
    );
  },

  getSettingsTemplates: async (): Promise<{ templates: unknown[] }> => {
    return apiGet<{ templates: unknown[] }>(
      '/settings/templates',
      'Failed to fetch settings templates'
    );
  },

  createSettingsTemplate: async (
    data: Record<string, unknown>
  ): Promise<{ success: boolean; template: Record<string, unknown> }> => {
    return apiPost<{ success: boolean; template: Record<string, unknown> }>(
      '/settings/templates',
      data,
      'Failed to create settings template'
    );
  },

  updateSettingsTemplate: async (
    templateId: string,
    data: Record<string, unknown>
  ): Promise<{ success: boolean }> => {
    return apiPut<{ success: boolean }>(
      `/settings/templates/${templateId}`,
      data,
      'Failed to update settings template'
    );
  },

  deleteSettingsTemplate: async (templateId: string): Promise<{ success: boolean }> => {
    return apiDelete<{ success: boolean }>(
      `/settings/templates/${templateId}`,
      'Failed to delete settings template'
    );
  },

  applySettingsTemplate: async (
    templateId: string
  ): Promise<{ success: boolean; applied?: Record<string, unknown> }> => {
    return apiPost<{ success: boolean; applied?: Record<string, unknown> }>(
      `/settings/templates/${templateId}/apply`,
      {},
      'Failed to apply settings template'
    );
  },

  // ==========================================
  // INTEGRATIONS
  // ==========================================

  getIntegrations: async (organizationId: string): Promise<Integration[]> => {
    const res = await fetchWithRetry(
      `${API_URL}/settings/integrations?organizationId=${organizationId}`,
      {
        headers: getHeaders(),
      }
    );
    if (!res.ok) return [];
    return res.json();
  },

  saveIntegration: async (integration: Partial<Integration>): Promise<Integration> => {
    const res = await fetchWithRetry(`${API_URL}/settings/integrations`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(integration),
    });
    return handleResponse(res, 'Failed to save integration');
  },

  deleteIntegration: async (id: string): Promise<void> => {
    const res = await fetchWithRetry(`${API_URL}/settings/integrations/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete integration');
  },

  // ==========================================
  // WEBHOOKS
  // ==========================================

  getWebhooks: async (): Promise<Webhook[]> => {
    const res = await fetchWithRetry(`${API_URL}/integrations/webhooks`, { headers: getHeaders() });
    const data = await handleResponse<{ webhooks: Webhook[] }>(res, 'Failed to fetch webhooks');
    return data.webhooks || [];
  },

  createWebhook: async (webhook: Partial<Webhook>): Promise<Webhook> => {
    const res = await fetchWithRetry(`${API_URL}/integrations/webhooks`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(webhook),
    });
    return handleResponse(res, 'Failed to create webhook');
  },

  updateWebhook: async (id: string, updates: Partial<Webhook>): Promise<void> => {
    const res = await fetchWithRetry(`${API_URL}/integrations/webhooks/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    await handleResponse(res, 'Failed to update webhook');
  },

  deleteWebhook: async (id: string): Promise<void> => {
    const res = await fetchWithRetry(`${API_URL}/integrations/webhooks/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete webhook');
  },

  // ==========================================
  // API KEYS
  // ==========================================

  getUserApiKeys: async (): Promise<unknown[]> => {
    const res = await fetchWithRetry(`${API_URL}/settings/api-keys`, { headers: getHeaders() });
    const data = await handleResponse<{ keys: unknown[] }>(res, 'Failed to fetch API keys');
    return data.keys || [];
  },

  createUserApiKey: async (name: string, scopes: string[] = []): Promise<unknown> => {
    const res = await fetchWithRetry(`${API_URL}/settings/api-keys`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name, permissions: scopes }),
    });
    return handleResponse(res, 'Failed to create API key');
  },

  deleteUserApiKey: async (id: string): Promise<void> => {
    const res = await fetchWithRetry(`${API_URL}/settings/api-keys/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    await handleResponse(res, 'Failed to delete API key');
  },

  getApiKeyUsage: async (keyId: string): Promise<unknown> => {
    const res = await fetchWithRetry(`${API_URL}/settings/api-keys/${keyId}/usage`, {
      headers: getHeaders(),
    });
    const data = await handleResponse(res, 'Failed to fetch API key usage');
    return data || {};
  },

  rotateApiKey: async (keyId: string): Promise<unknown> => {
    const res = await fetchWithRetry(`${API_URL}/settings/api-keys/${keyId}/rotate`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to rotate API key');
  },

  updateApiKey: async (keyId: string, updates: unknown): Promise<void> => {
    const res = await fetchWithRetry(`${API_URL}/settings/api-keys/${keyId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    await handleResponse(res, 'Failed to update API key');
  },
};
