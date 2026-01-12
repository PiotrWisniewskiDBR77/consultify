# Unified AI Chat System

## Overview

The Unified AI Chat System provides a seamless chat experience across two display modes:
- **Full-screen mode**: Immersive AI Chat experience (like ChatGPT or Claude)
- **Split-screen mode**: Chat alongside workspace content (like OpenAI Canvas or Google AI Studio)

The system preserves conversation context when navigating between modes and makes the AI aware of what the user is currently viewing in the workspace.

## Architecture

```mermaid
flowchart TB
    subgraph stores [Zustand Stores]
        ConvStore[useConversationStore]
        AppStore[useAppStore]
        ProjectStore[useChatProjectStore]
    end
    
    subgraph api [Backend API]
        ConvAPI[/api/conversations]
        ProjAPI[/api/chat-projects]
        AIAPI[/api/ai/stream]
    end
    
    subgraph views [Views]
        FullChat[AIChatWelcomeView]
        SplitView[SplitLayout]
    end
    
    subgraph components [Shared Components]
        Unified[UnifiedChatPanel]
        Input[EnhancedChatInput]
        History[ChatSlidingPanel]
    end
    
    ConvStore --> Unified
    AppStore --> Unified
    Unified --> FullChat
    Unified --> SplitView
    Input --> Unified
    History --> Unified
    
    ConvStore --> ConvAPI
    ProjectStore --> ProjAPI
    Unified --> AIAPI
```

## Key Components

### UnifiedChatPanel

The main chat component that works in both modes.

```typescript
interface UnifiedChatPanelProps {
    /** Display mode: full-screen or split-screen */
    mode?: ChatDisplayMode;
    
    /** Whether to show expand/collapse button */
    showModeToggle?: boolean;
    
    /** Callback when mode toggle is clicked */
    onModeToggle?: () => void;
    
    /** Whether to show the sliding history panel trigger */
    showHistoryTrigger?: boolean;
    
    /** Whether to show focus mode selector */
    showFocusMode?: boolean;
    
    /** Current workspace context (for AI awareness) */
    workspaceContext?: WorkspaceContext | null;
}
```

**Features:**
- EnhancedChatInput with all rich features (files, tools, voice)
- FocusModeSelector (compact in split mode)
- ChatSlidingPanel integration for history
- Message rendering with streaming, thinking, artifacts
- Full keyboard accessibility

### WorkspaceContext

Describes what the user is currently viewing in the workspace panel.

```typescript
interface WorkspaceContext {
    /** Current AppView being displayed */
    view: AppView;
    
    /** Type of content in workspace */
    type: WorkspaceType; // 'task' | 'initiative' | 'assessment' | ...
    
    /** ID of the specific entity being viewed */
    entityId?: string;
    
    /** Name/title of the entity for AI context */
    entityName?: string;
    
    /** PMO project context if applicable */
    projectId?: string;
    projectName?: string;
    
    /** Timestamp when context was set */
    timestamp: Date;
}
```

## Store Extensions

### useConversationStore

Extended with display mode management:

```typescript
// New state
displayMode: 'full' | 'split' | 'collapsed';
workspaceContext: WorkspaceContext | null;
previousView: AppView | null;

// New actions
setDisplayMode: (mode) => void;
setWorkspaceContext: (context) => void;
updateWorkspaceFromView: (view, entityId?, entityData?) => void;
expandToFullScreen: () => void;
collapseToSplit: (workspaceContext?) => void;
isSplitMode: () => boolean;
```

### useAppStore

Extended with navigation context:

```typescript
// New state
previousView: AppView | null;

// New actions
navigateWithChatContext: (view, options?) => void;
returnToFullChat: () => void;
setPreviousView: (view) => void;
```

## Navigation Flows

### Scenario 1: Full Chat → Other View (Split Mode)

1. User is in AI Chat (full-screen)
2. User clicks "My Work" in sidebar
3. System:
   - Saves `previousView = AI_CHAT`
   - Sets `displayMode = 'split'`
   - Creates workspace context for My Work
   - Navigates to My Work view with chat panel visible

### Scenario 2: Split Mode → Full Chat

1. User is in split mode (e.g., My Work + Chat)
2. User clicks expand button on chat panel
3. System:
   - Saves `previousView = MY_WORK`
   - Sets `displayMode = 'full'`
   - Navigates to AI Chat view

### Scenario 3: New Conversation in Split Mode

1. User clicks "New Chat" in history panel
2. System:
   - Creates new conversation
   - Sets it as active
   - Clears messages
   - Workspace context remains (AI knows where user is)

## AI Context Awareness

The AIContext provides workspace information to the AI:

```typescript
interface AIContextProps {
    // ... existing fields ...
    
    // UNIFIED CHAT SYSTEM
    workspaceContext: WorkspaceContext | null;
    chatDisplayMode: ChatDisplayMode;
    isInSplitMode: boolean;
}
```

This allows AI responses to be contextually relevant:
- In split mode viewing tasks, AI can reference task details
- In assessment view, AI can help with evaluation
- AI knows if user is in full-screen or split mode

## Usage Examples

### Basic Split Layout

```tsx
<SplitLayout
    useUnifiedChat={true}
    currentView={AppView.MY_WORK}
    contextEntityId={selectedTaskId}
>
    <MyWorkContent />
</SplitLayout>
```

### Direct UnifiedChatPanel

```tsx
<UnifiedChatPanel
    mode="split"
    workspaceContext={workspaceContext}
    showModeToggle={true}
    onModeToggle={handleModeToggle}
    showHistoryTrigger={true}
    showFocusMode={true}
/>
```

### Navigation with Context

```typescript
// From sidebar
const navigateToViewWithChat = (viewId: AppView) => {
    setDisplayMode('split');
    const context = createWorkspaceContext(viewId, getDefaultWorkspaceType(viewId));
    setWorkspaceContext(context);
    navigateWithChatContext(viewId, { preserveChat: true });
};
```

## Testing

### Unit Tests

Located in `tests/store/useConversationStore.displayMode.test.ts`:
- Display mode state management
- Workspace context updates
- Mode transitions

Located in `tests/components/AIChat/UnifiedChatPanel.test.tsx`:
- Rendering in both modes
- Message display
- Context awareness
- User interactions

### E2E Tests

Located in `e2e/unified-chat.spec.ts`:
- Full flow from AI Chat to workspace views
- Message preservation across transitions
- History panel functionality
- Mobile/responsive behavior

## Migration Guide

### From Legacy ChatPanel to UnifiedChatPanel

1. Update SplitLayout usage:
```tsx
// Before
<SplitLayout>
    <Content />
</SplitLayout>

// After (unified chat is default)
<SplitLayout 
    useUnifiedChat={true}
    currentView={currentView}
>
    <Content />
</SplitLayout>
```

2. Access conversation data from useConversationStore instead of useAppStore:
```typescript
// Before
const { activeChatMessages } = useAppStore();

// After
const { activeMessages, activeConversationId } = useConversationStore();
```

3. Use the new navigation functions:
```typescript
// Before
setCurrentView(AppView.MY_WORK);

// After (preserves chat context)
navigateWithChatContext(AppView.MY_WORK, { preserveChat: true });
```

## Files Created/Modified

### New Files
- `components/AIChat/UnifiedChatPanel.tsx`
- `types/workspace.ts`
- `tests/store/useConversationStore.displayMode.test.ts`
- `tests/components/AIChat/UnifiedChatPanel.test.tsx`
- `e2e/unified-chat.spec.ts`
- `docs/UNIFIED_AI_CHAT_SYSTEM.md`

### Modified Files
- `store/useConversationStore.ts` - Added displayMode, workspaceContext
- `store/useAppStore.ts` - Added navigation functions
- `components/SplitLayout.tsx` - Integrated UnifiedChatPanel
- `components/Sidebar.tsx` - Smart navigation with chat preservation
- `contexts/AIContext.tsx` - Workspace context integration

## Performance Considerations

1. **State Persistence**: Display mode is persisted to localStorage to maintain user preference
2. **Lazy Loading**: Messages are loaded on-demand when selecting conversations
3. **Streaming Optimization**: Uses dedicated streaming content state to avoid costly re-renders

## Future Enhancements

1. **Keyboard Shortcuts**: Global shortcuts for mode switching
2. **Multi-panel Support**: Multiple workspaces with chat
3. **AI Workspace Actions**: AI can trigger workspace changes directly
4. **Offline Support**: Cache conversations for offline access

