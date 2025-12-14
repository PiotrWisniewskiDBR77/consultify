
import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../store/useAppStore';
import { AppView, SessionMode, AuthStep } from '../../types';

describe('Store Test: useAppStore', () => {
    beforeEach(() => {
        // Reset store to initial state
        const store = useAppStore.getState();
        store.setCurrentView(AppView.WELCOME);
        store.setSessionMode(SessionMode.FREE);
        store.setCurrentUser(null);
        store.setAuthInitialStep(AuthStep.REGISTER);
        store.setIsSidebarOpen(false);
        store.clearChat();
        store.logout();
    });

    it('initializes with correct default values', () => {
        const state = useAppStore.getState();

        expect(state.currentView).toBe(AppView.WELCOME);
        expect(state.sessionMode).toBe(SessionMode.FREE);
        expect(state.currentUser).toBeNull();
        expect(state.isSidebarOpen).toBe(false);
    });

    it('sets current view', () => {
        const store = useAppStore.getState();
        store.setCurrentView(AppView.DASHBOARD_OVERVIEW);

        expect(useAppStore.getState().currentView).toBe(AppView.DASHBOARD_OVERVIEW);
    });

    it('sets session mode', () => {
        const store = useAppStore.getState();
        store.setSessionMode(SessionMode.FULL);

        expect(useAppStore.getState().sessionMode).toBe(SessionMode.FULL);
    });

    it('sets current user', () => {
        const user = { id: '1', email: 'test@example.com', role: 'user' } as any;
        const store = useAppStore.getState();
        store.setCurrentUser(user);

        expect(useAppStore.getState().currentUser).toEqual(user);
    });

    it('toggles sidebar open state', () => {
        const store = useAppStore.getState();
        store.setIsSidebarOpen(true);

        expect(useAppStore.getState().isSidebarOpen).toBe(true);

        store.setIsSidebarOpen(false);
        expect(useAppStore.getState().isSidebarOpen).toBe(false);
    });

    it('toggles sidebar collapse', () => {
        const store = useAppStore.getState();
        const initialCollapsed = store.isSidebarCollapsed;

        store.toggleSidebarCollapse();

        expect(useAppStore.getState().isSidebarCollapsed).toBe(!initialCollapsed);
    });

    it('adds chat message', () => {
        const store = useAppStore.getState();
        const message = { id: '1', role: 'user' as const, content: 'Hello', timestamp: new Date() };

        store.addChatMessage(message);

        const messages = useAppStore.getState().activeChatMessages;
        expect(messages).toHaveLength(1);
        expect(messages[0]).toEqual(message);
    });

    it('sets chat messages', () => {
        const store = useAppStore.getState();
        const messages = [
            { id: '1', role: 'user' as const, content: 'Hello', timestamp: new Date() },
            { id: '2', role: 'ai' as const, content: 'Hi there', timestamp: new Date() },
        ];

        store.setChatMessages(messages);

        expect(useAppStore.getState().activeChatMessages).toEqual(messages);
    });

    it('clears chat', () => {
        const store = useAppStore.getState();
        store.addChatMessage({ id: '1', role: 'user' as const, content: 'Hello', timestamp: new Date() });
        store.clearChat();

        expect(useAppStore.getState().activeChatMessages).toHaveLength(0);
    });

    it('sets bot typing state', () => {
        const store = useAppStore.getState();
        store.setIsBotTyping(true);

        expect(useAppStore.getState().isBotTyping).toBe(true);
    });

    it('sets current stream content', () => {
        const store = useAppStore.getState();
        store.setCurrentStreamContent('Streaming...');

        expect(useAppStore.getState().currentStreamContent).toBe('Streaming...');
    });

    it('updates free session data', () => {
        const store = useAppStore.getState();
        store.setFreeSessionData({ goal: 'Test goal' });

        expect(useAppStore.getState().freeSessionData.goal).toBe('Test goal');
    });

    it('updates free session data with function', () => {
        const store = useAppStore.getState();
        store.setFreeSessionData({ goal: 'Initial' });
        store.setFreeSessionData((prev) => ({ ...prev, goal: 'Updated' }));

        expect(useAppStore.getState().freeSessionData.goal).toBe('Updated');
    });

    it('updates full session data', () => {
        const store = useAppStore.getState();
        store.setFullSessionData({ id: 'session-1' } as any);

        expect(useAppStore.getState().fullSessionData.id).toBe('session-1');
    });

    it('sets AI config', () => {
        const store = useAppStore.getState();
        store.setAIConfig({ autoMode: false, selectedModelId: 'model-1' });

        const config = useAppStore.getState().aiConfig;
        expect(config.autoMode).toBe(false);
        expect(config.selectedModelId).toBe('model-1');
    });

    it('toggles theme', () => {
        const store = useAppStore.getState();
        const initialTheme = store.theme;

        store.toggleTheme();

        expect(useAppStore.getState().theme).toBe(initialTheme === 'dark' ? 'light' : 'dark');
    });

    it('updates last chat message', () => {
        const store = useAppStore.getState();
        store.addChatMessage({ id: '1', role: 'ai' as const, content: 'Initial', timestamp: new Date() });
        store.updateLastChatMessage('Updated');

        const messages = useAppStore.getState().activeChatMessages;
        expect(messages[0].content).toBe('Updated');
    });

    it('logout resets state', () => {
        const store = useAppStore.getState();
        store.setCurrentUser({ id: '1', email: 'test@example.com' } as any);
        store.setCurrentView(AppView.DASHBOARD_OVERVIEW);
        store.addChatMessage({ id: '1', role: 'user' as const, content: 'Hello', timestamp: new Date() });

        store.logout();

        const state = useAppStore.getState();
        expect(state.currentUser).toBeNull();
        expect(state.currentView).toBe(AppView.WELCOME);
        expect(state.activeChatMessages).toHaveLength(0);
    });

    it('sets current project ID', () => {
        const store = useAppStore.getState();
        store.setCurrentProjectId('project-1');

        expect(useAppStore.getState().currentProjectId).toBe('project-1');
    });
});
