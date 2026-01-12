import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { AuthSlice, createAuthSlice } from './slices/authSlice';
import { ChatSlice, createChatSlice } from './slices/chatSlice';
import { createProjectSlice, ProjectSlice } from './slices/projectSlice';
import { createUISlice, UISlice } from './slices/uiSlice';

// Combine all slice types into AppState
export type AppState = AuthSlice & UISlice & ChatSlice & ProjectSlice;

export const useAppStore = create<AppState>()(
    persist(
        (...a) => ({
            ...createAuthSlice(...a),
            ...createUISlice(...a),
            ...createChatSlice(...a),
            ...createProjectSlice(...a),
        }),
        {
            name: 'consultify-storage', // unique name for localStorage
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                // AuthSlice
                sessionMode: state.sessionMode,
                currentUser: state.currentUser,
                currentOrganization: state.currentOrganization,

                // UISlice
                currentView: state.currentView,
                isChatCollapsed: state.isChatCollapsed,
                chatPanelWidth: state.chatPanelWidth,
                isChatSlidingPanelOpen: state.isChatSlidingPanelOpen,
                previousView: state.previousView,
                theme: state.theme,

                // ChatSlice
                activeChatMessages: state.activeChatMessages,
                projectChatMessages: state.projectChatMessages,
                aiConfig: state.aiConfig,

                // ProjectSlice
                freeSessionData: state.freeSessionData,
                fullSessionData: state.fullSessionData,
                currentProjectId: state.currentProjectId,
                notifications: state.notifications,
            }),
        },
    ),
);
