import { StateCreator } from 'zustand';

import { ChatMessage } from '../../types';
import type { AppState } from '../useAppStore';

export interface ChatSlice {
  activeChatMessages: ChatMessage[];
  projectChatMessages: Record<string, ChatMessage[]>;
  isBotTyping: boolean;
  currentStreamContent: string; // Excluded from persistence

  aiConfig: {
    autoMode: boolean;
    maxMode: boolean;
    multiModel: boolean;
    selectedModelId: string | null;
    selectedTier: 'BUDGET' | 'STANDARD' | 'PREMIUM' | 'REASONING' | null;
    // AI Modes (Tryby AI)
    deepResearch: boolean; // Głęboka analiza - dogłębne badanie tematu
    marketResearch: boolean; // Badanie rynku - analiza rynkowa z danymi
    webSearch: boolean; // Wyszukiwanie web - dane w czasie rzeczywistym
    showReasoning: boolean; // Pokaż rozumowanie - widoczny tok myślenia AI
    multiAgent: boolean; // Analiza wieloagentowa - perspektywy CFO/CTO/CHRO/COO
    coThinkerMode: string | null; // Tryb Co-Thinker - persona doradcza
    // Privacy
    privateMode: boolean; // Private mode - disable memory injection/read/write for this chat session
    // Knowledge Sources (Źródła wiedzy)
    knowledgeSources: {
      pmoDocuments: boolean; // Dokumenty PMO - ISO 21500, PMBOK, PRINCE2
      projectData: boolean; // Dane projektu - inicjatywy, zadania, decyzje
      organizationData: boolean; // Dane organizacji - zespoły, role, procesy
    };
    // Response Style (Styl odpowiedzi - domain-specific presets)
    responseStyle:
      | 'normal'
      | 'executive'
      | 'analyst'
      | 'coach'
      | 'concise'
      | 'formal'
      | 'professional'
      | 'friendly';
    // Text-to-Speech (Czytanie odpowiedzi na głos)
    textToSpeech: boolean; // Włącz/wyłącz czytanie odpowiedzi
    ttsVoice: string | null; // Wybrany głos (voice URI)
    ttsRate: number; // Szybkość czytania (0.5-2.0)
    ttsPitch: number; // Wysokość głosu (0.5-2.0)
    // Custom instructions (overrides default persona prompt for this session)
    customInstructions?: string;
    // D-104 (2026-08-30) — owner note on ?screen=teresa-chipy-sugestii: keep
    // the contextual "next step" chips under the composer (some users rely on
    // them) but let them be hidden for people who find them noisy. Persisted
    // like every other AI Mode toggle in this object (see ToolsMenu.tsx).
    chatSuggestionsEnabled: boolean;
  };

  aiFreezeStatus: {
    isFrozen: boolean;
    reason: string | null;
    scope: string | null;
  };

  // Actions
  addChatMessage: (message: ChatMessage) => void;
  setChatMessages: (messages: ChatMessage[]) => void;
  setIsBotTyping: (isTyping: boolean) => void;
  setCurrentStreamContent: (content: string) => void;
  clearChat: () => void;

  // Project Chat Management
  loadProjectChat: () => void;
  saveProjectChat: () => void;

  // Chat Message Management
  editChatMessage: (messageId: string, newContent: string) => void;
  deleteChatMessage: (messageId: string) => void;
  setMessageFeedback: (
    messageId: string,
    feedback: { rating: 'positive' | 'negative'; reason?: string }
  ) => void;
  updateLastChatMessage: (content: string) => void;

  // Config Actions
  setAIConfig: (config: Partial<ChatSlice['aiConfig']>) => void;
  setAiFreezeStatus: (status: Partial<ChatSlice['aiFreezeStatus']>) => void;
}

export const createChatSlice: StateCreator<AppState, [], [], ChatSlice> = (set) => ({
  activeChatMessages: [],
  projectChatMessages: {},
  isBotTyping: false,
  currentStreamContent: '',

  aiConfig: {
    autoMode: true,
    maxMode: false,
    multiModel: false,
    selectedModelId: null,
    // Default chat quality should be competitive with mainstream assistants.
    // Budget tier remains available as an explicit user choice.
    selectedTier: 'STANDARD',
    // AI Modes
    deepResearch: false,
    marketResearch: false,
    // Enable by default for Chat-like behavior on external queries.
    // Backend will gracefully degrade if web search is unavailable.
    webSearch: true,
    showReasoning: false,
    multiAgent: false,
    coThinkerMode: null,
    privateMode: false,
    // Knowledge Sources (default: use internal context where safe/useful)
    knowledgeSources: {
      pmoDocuments: true,
      projectData: true,
      organizationData: true,
    },
    // Response Style (default: normal)
    responseStyle: 'normal',
    // Text-to-Speech (default: disabled)
    textToSpeech: false,
    ttsVoice: null,
    ttsRate: 1.0,
    ttsPitch: 1.0,
    // Default ON — this only changes behaviour for users who explicitly turn
    // it off (D-104: "wyrzucenie tego całkiem nie jest okej").
    chatSuggestionsEnabled: true,
  },

  aiFreezeStatus: {
    isFrozen: false,
    reason: null,
    scope: null,
  },

  setAIConfig: (newConfig) =>
    set((state) => ({
      aiConfig: { ...state.aiConfig, ...newConfig },
    })),

  setAiFreezeStatus: (status) =>
    set((state) => ({
      aiFreezeStatus: { ...state.aiFreezeStatus, ...status },
    })),

  setIsBotTyping: (isTyping) => set({ isBotTyping: isTyping }),
  setCurrentStreamContent: (content) => set({ currentStreamContent: content }),

  addChatMessage: (message) =>
    set((state) => {
      const MAX_MESSAGES = 100;
      const newMessages = [...state.activeChatMessages, message].slice(-MAX_MESSAGES);
      const projectKey = state.currentProjectId || 'global';

      return {
        activeChatMessages: newMessages,
        projectChatMessages: {
          ...state.projectChatMessages,
          [projectKey]: newMessages,
        },
      };
    }),

  setChatMessages: (messages) =>
    set((state) => {
      const projectKey = state.currentProjectId || 'global';
      const trimmedMessages = messages.slice(-100);
      return {
        activeChatMessages: trimmedMessages,
        projectChatMessages: {
          ...state.projectChatMessages,
          [projectKey]: trimmedMessages,
        },
      };
    }),

  clearChat: () =>
    set((state) => {
      const projectKey = state.currentProjectId || 'global';
      return {
        activeChatMessages: [],
        projectChatMessages: {
          ...state.projectChatMessages,
          [projectKey]: [],
        },
      };
    }),

  // Project Chat Management
  loadProjectChat: () =>
    set((state) => {
      const projectKey = state.currentProjectId || 'global';
      const messages = state.projectChatMessages[projectKey] || [];
      return { activeChatMessages: messages };
    }),

  saveProjectChat: () =>
    set((state) => {
      const projectKey = state.currentProjectId || 'global';
      const MAX_MESSAGES = 100;
      const trimmedMessages = state.activeChatMessages.slice(-MAX_MESSAGES);
      return {
        projectChatMessages: {
          ...state.projectChatMessages,
          [projectKey]: trimmedMessages,
        },
      };
    }),

  editChatMessage: (messageId, newContent) =>
    set((state) => {
      const projectKey = state.currentProjectId || 'global';
      const messages = state.activeChatMessages.map((msg) =>
        msg.id === messageId ? { ...msg, content: newContent, canEdit: true } : msg
      );
      return {
        activeChatMessages: messages,
        projectChatMessages: {
          ...state.projectChatMessages,
          [projectKey]: messages,
        },
      };
    }),

  deleteChatMessage: (messageId) =>
    set((state) => {
      const projectKey = state.currentProjectId || 'global';
      const messages = state.activeChatMessages.filter((msg) => msg.id !== messageId);
      return {
        activeChatMessages: messages,
        projectChatMessages: {
          ...state.projectChatMessages,
          [projectKey]: messages,
        },
      };
    }),

  setMessageFeedback: (messageId, feedback) =>
    set((state) => {
      const projectKey = state.currentProjectId || 'global';
      const messages = state.activeChatMessages.map((msg) =>
        msg.id === messageId
          ? {
              ...msg,
              feedback: {
                rating: feedback.rating,
                reason: feedback.reason,
                timestamp: new Date(),
              },
            }
          : msg
      );
      return {
        activeChatMessages: messages,
        projectChatMessages: {
          ...state.projectChatMessages,
          [projectKey]: messages,
        },
      };
    }),

  updateLastChatMessage: (content) =>
    set((state) => {
      const messages = [...state.activeChatMessages];
      if (messages.length > 0) {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg.role === 'ai') {
          messages[messages.length - 1] = { ...lastMsg, content: content };
        }
      }
      return { activeChatMessages: messages };
    }),
});
