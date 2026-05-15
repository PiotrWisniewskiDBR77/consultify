/**
 * Prompt Assistant API Module
 * Shared client for prompt block preview, test bench, and assistant chat flows.
 */

import { API_URL, apiGet, apiPost, fetchWithRetry, handleResponse } from './baseClient';

export interface PromptAssistantBlock {
  code: string;
  name: string;
  category: string;
  semantic: string;
  variables?: string[];
  example?: string;
  usageCount?: number;
}

export interface PromptAssistantBlockCategory {
  name: string;
  description: string;
  icon: string;
  color: string;
}

export interface PromptAssistantSuggestion {
  title: string;
  description: string;
}

export interface PromptAssistantCodeBlock {
  language: string;
  content: string;
}

export interface PromptAssistantBlocksResponse {
  data: PromptAssistantBlock[];
  categories: Record<string, PromptAssistantBlockCategory>;
}

export interface PromptAssistantTestResult {
  language: string;
  success: boolean;
  expectedLanguage: string;
  detectedLanguage: string;
  languageMatch: boolean;
  response?: string;
  tokenCount?: number;
  error?: string;
}

export interface PromptAssistantTestSummary {
  tested: number;
  passed: number;
  languageAccuracy: number;
}

export interface PromptAssistantTestResponse {
  data?: {
    results?: PromptAssistantTestResult[];
    summary?: PromptAssistantTestSummary;
  };
}

export interface PromptAssistantChatResponse {
  data?: {
    conversationId?: string;
    message?: string;
    suggestions?: PromptAssistantSuggestion[];
    codeBlocks?: PromptAssistantCodeBlock[];
  };
}

export const PromptAssistantApi = {
  getBlocks: async (): Promise<PromptAssistantBlocksResponse> => {
    return apiGet<PromptAssistantBlocksResponse>(
      '/prompt-assistant/blocks',
      'Failed to fetch prompt assistant blocks'
    );
  },

  previewBlocks: async (blockCodes: string[]): Promise<{ success?: boolean; preview?: string }> => {
    return apiPost<{ success?: boolean; preview?: string }>(
      '/prompt-assistant/blocks/preview',
      { blockCodes },
      'Failed to preview prompt blocks'
    );
  },

  runTest: async (
    templateCode: string,
    sampleInput: string,
    languages: string[]
  ): Promise<PromptAssistantTestResponse> => {
    return apiPost<PromptAssistantTestResponse>(
      '/prompt-assistant/test',
      { templateCode, sampleInput, languages },
      'Failed to run prompt assistant test'
    );
  },

  sendChatMessage: async (payload: {
    message: string;
    promptId?: string;
    promptContent?: string;
    templateCode?: string;
    conversationId?: string | null;
  }): Promise<PromptAssistantChatResponse> => {
    return apiPost<PromptAssistantChatResponse>(
      '/prompt-assistant/chat',
      payload,
      'Failed to send prompt assistant message'
    );
  },

  clearChatHistory: async (conversationId?: string | null): Promise<unknown> => {
    const res = await fetchWithRetry(`${API_URL}/prompt-assistant/chat/history`, {
      method: 'DELETE',
      body: JSON.stringify({ conversationId }),
    });
    return handleResponse(res, 'Failed to clear prompt assistant history');
  },
};
