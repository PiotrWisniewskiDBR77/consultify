import { GoogleGenerativeAI } from '@google/generative-ai';

import { AIMessageHistory, LLMProviderConfig } from '../../types';
import { Api } from '../api';

export const UnifiedAI = {
  sendMessage: async (
    config: LLMProviderConfig | undefined,
    history: AIMessageHistory[],
    message: string,
    systemInstruction?: string,
    roleName?: string
  ): Promise<string> => {
    // ALWAYS route through backend API ('system')
    // This ensures the AIPipeline (Server) handles RAG, Memory, Thinking, and Artifacts.
    return (Api as any).chatWithAI(message, history, systemInstruction, roleName, {
      model: config?.modelId,
      temperature: 0.7,
    });
  },

  sendMessageStream: async (
    config: LLMProviderConfig | undefined,
    history: AIMessageHistory[],
    message: string,
    onChunk: (text: string) => void,
    onDone: () => void,
    systemInstruction?: string,
    roleName?: string
  ): Promise<void> => {
    // ALWAYS route through backend API ('system')
    // This ensures the AIPipeline (Server) handles RAG, Memory, Thinking, and Artifacts.
    return (Api as any).chatWithAIStream(
      message,
      history,
      onChunk,
      onDone,
      systemInstruction,
      undefined, // context
      roleName,
      undefined, // language
      undefined, // onThinking - let Api handle it or pass through if we add output
      {
        // OPTIONS
        model: config?.modelId,
        temperature: 0.7,
      }
    );
  },
};
