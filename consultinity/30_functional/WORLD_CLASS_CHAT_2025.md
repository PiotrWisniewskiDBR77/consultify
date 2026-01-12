# World-Class Chat Interface 2025

## Overview

The Consultify AI Chat interface has been upgraded to match and exceed the standards of leading AI platforms (ChatGPT, Claude, Gemini, Perplexity). This document describes the new features, architecture, and usage.

**Version**: 1.0.0  
**Last Updated**: January 2026  
**Status**: ✅ Production Ready

---

## Table of Contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Components](#components)
4. [Usage Guide](#usage-guide)
5. [API Reference](#api-reference)
6. [Testing](#testing)

---

## Features

### 1. Artifacts Panel (Claude-style)

AI-generated structured content is displayed in a dedicated side panel:

- **Supported Types**:
  - `markdown` - Rich formatted documents
  - `code` - Syntax-highlighted code with line numbers
  - `html` - Sandboxed HTML preview
  - `diagram` - Mermaid diagrams with zoom/export
  - `table` - Interactive tables with sort/filter
  - `pmo-document` - PMO templates (RACI, Risk Register, Status Reports)

- **Features**:
  - Multiple artifacts per message (tabbed interface)
  - Inline editing with live preview
  - Copy to clipboard
  - Export to file (CSV, JSON, Markdown, etc.)
  - Fullscreen mode
  - Version tracking

### 2. Chain of Thought (Thinking Steps)

Transparent AI reasoning process:

- **Visualization**:
  - Collapsible thinking block
  - Step-by-step progress indicator
  - Category badges (Analysis, Research, Synthesis, Validation)
  - Real-time streaming updates

- **Format**: AI responses can include `<thinking>...</thinking>` blocks that are automatically extracted and displayed.

### 3. Message Actions

Enhanced message interactions:

- **User Messages**:
  - ✏️ Edit
  - 🗑️ Delete

- **AI Messages**:
  - 📋 Copy
  - 🔄 Regenerate
  - 👍👎 Feedback (thumbs up/down)
  - 📄 View Artifacts
  - 🔊 Speak (TTS)
  - 📤 Share
  - 🔖 Bookmark

### 4. Focus Modes

Context filtering for optimized responses:

- **`all`** - Use all available sources (default)
- **`pmo-docs`** - Only PMO standards (ISO, PMBOK, PRINCE2)
- **`project-data`** - Only current project context
- **`research`** - Deep analysis mode (internal sources only)
- **`web`** - Real-time web search priority

### 5. Enhanced Streaming

Real-time updates during AI response:

- Live thinking step updates
- Artifact detection and notification
- Progress indicator (0-100%)
- Smooth content rendering

---

## Architecture

### Component Hierarchy

```
SplitLayout
├── ChatPanel (Left)
│   ├── MessageBubble
│   │   ├── ThinkingBlock
│   │   ├── MessageActions
│   │   └── CitationList
│   └── EnhancedChatInput
│       └── FocusModeSelector
├── Workspace (Center)
└── ArtifactsPanel (Right, conditional)
    ├── ArtifactViewer
    │   └── [Renderer Components]
    └── ArtifactEditor
```

### State Management

- **`useAppStore`** - Chat messages, streaming state
- **`useArtifactsStore`** - Artifacts, panel visibility
- **`useAIStream`** - Streaming logic, thinking extraction

### Data Flow

```
User Input
  ↓
FocusModeSelector → aiContextBuilder (filter context)
  ↓
useAIStream → API → aiPipeline
  ↓
extractThinkingSteps() + extractArtifacts()
  ↓
ChatPanel → MessageBubble → ArtifactsPanel
```

---

## Components

### ArtifactsPanel

**Location**: `components/AIChat/Artifacts/ArtifactsPanel.tsx`

Main panel for displaying artifacts.

**Props**:
```typescript
interface ArtifactsPanelProps {
  artifacts: Artifact[];
  activeArtifactId: string | null;
  onSelectArtifact: (id: string) => void;
  onUpdateArtifact: (id: string, content: string) => void;
  onClose: () => void;
  onExport?: (artifact: Artifact, format: string) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}
```

**Usage**:
```tsx
<ArtifactsPanel
  artifacts={artifacts}
  activeArtifactId={activeArtifactId}
  onSelectArtifact={setActiveArtifact}
  onUpdateArtifact={updateArtifact}
  onClose={() => togglePanel(false)}
  onExport={handleExport}
/>
```

### MessageBubble

**Location**: `components/AIChat/Messages/MessageBubble.tsx`

Enhanced message component with all new features.

**Props**:
```typescript
interface MessageBubbleProps {
  message: ChatMessage;
  onEdit?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onRegenerate?: (messageId: string) => void;
  onCopy?: (content: string) => void;
  onFeedback?: (messageId: string, feedback: MessageFeedback) => void;
  onViewArtifacts?: (artifacts: Artifact[]) => void;
  onSpeak?: (content: string) => void;
  isStreaming?: boolean;
  showThinkingSteps?: boolean;
}
```

### ThinkingBlock

**Location**: `components/AIChat/Messages/ThinkingBlock.tsx`

Displays Chain of Thought reasoning steps.

**Props**:
```typescript
interface ThinkingBlockProps {
  steps: ThinkingStep[];
  isStreaming?: boolean;
  defaultExpanded?: boolean;
}
```

### FocusModeSelector

**Location**: `components/AIChat/Input/FocusModeSelector.tsx`

Pill buttons for selecting focus mode.

**Props**:
```typescript
interface FocusModeSelectorProps {
  value: FocusMode;
  onChange: (mode: FocusMode) => void;
  disabled?: boolean;
  compact?: boolean;
}
```

---

## Usage Guide

### Basic Chat

```tsx
import { ChatPanel } from './components/ChatPanel';
import { useAppStore } from './store/useAppStore';

function MyComponent() {
  const { activeChatMessages, addChatMessage } = useAppStore();
  
  return (
    <ChatPanel
      messages={activeChatMessages}
      onSendMessage={(text) => addChatMessage({...})}
      enableEnhancedMessages={true}
    />
  );
}
```

### With Artifacts

```tsx
import { useArtifactsStore } from './store/useArtifactsStore';

function MyComponent() {
  const { artifacts, isPanelOpen, togglePanel } = useArtifactsStore();
  
  return (
    <>
      <ChatPanel {...props} />
      {isPanelOpen && artifacts.length > 0 && (
        <ArtifactsPanel {...artifactsProps} />
      )}
    </>
  );
}
```

### With Focus Mode

```tsx
import { FocusModeSelector } from './components/AIChat/Input/FocusModeSelector';
import { useState } from 'react';

function MyComponent() {
  const [focusMode, setFocusMode] = useState<FocusMode>('all');
  
  return (
    <>
      <FocusModeSelector 
        value={focusMode} 
        onChange={setFocusMode} 
      />
      <ChatPanel 
        {...props}
        focusMode={focusMode}
      />
    </>
  );
}
```

### Backend: Generating Artifacts

AI responses can include artifacts using special markers:

**Markdown Artifact**:
```
```artifact:markdown:My Document Title
# Content here
```
```

**Code Artifact**:
```
```artifact:code:typescript:My Function
function example() {
  return "Hello";
}
```
```

**JSON Artifact**:
```
```json:artifact
{
  "type": "pmo-document",
  "title": "RACI Matrix",
  "content": "...",
  "metadata": {
    "framework": "ISO",
    "templateType": "raci"
  }
}
```
```

### Backend: Thinking Steps

AI can include thinking steps:

```
<thinking>
1. First, I need to analyze the requirements
2. Then, I'll check the current state
3. Finally, I'll propose a solution
</thinking>
```

---

## API Reference

### useArtifactsStore

**Location**: `store/useArtifactsStore.ts`

Zustand store for artifacts management.

**Methods**:
- `addArtifact(artifact, conversationId?)` - Add new artifact
- `updateArtifact(id, content)` - Update artifact content
- `removeArtifact(id)` - Remove artifact
- `setActiveArtifact(id)` - Set active artifact
- `togglePanel(open?)` - Toggle panel visibility
- `exportArtifact(id, format)` - Export artifact to file

**State**:
```typescript
{
  artifacts: Artifact[];
  activeArtifactId: string | null;
  isPanelOpen: boolean;
  isFullscreen: boolean;
  conversationArtifacts: Record<string, Artifact[]>;
}
```

### useAIStream (Enhanced)

**Location**: `hooks/useAIStream.ts`

Enhanced streaming hook with thinking/artifacts support.

**Returns**:
```typescript
{
  isStreaming: boolean;
  streamedContent: string;
  thinkingSteps: ThinkingStep[];
  artifacts: Artifact[];
  progress: number; // 0-100
  startStream: (message, history, systemPrompt?, context?, focusMode?) => Promise<void>;
  abortStream: () => void;
}
```

### Backend: aiPipeline

**Location**: `server/services/ai/aiPipeline.js`

**New Functions**:
- `extractThinkingSteps(content)` - Extract thinking blocks
- `extractArtifacts(content)` - Extract artifact markers
- `enhanceResponse(response)` - Process response for structured content

**Usage**:
```javascript
const { enhanceResponse } = require('./services/ai/aiPipeline');

const rawResponse = await llmService.chat(...);
const enhanced = enhanceResponse(rawResponse);
// enhanced.thinkingSteps, enhanced.artifacts available
```

### Backend: aiContextBuilder

**Location**: `server/services/aiContextBuilder.js`

**Enhanced Method**:
```javascript
buildContext(userId, organizationId, projectId, {
  focusMode: 'pmo-docs', // Filter context
  currentScreen: 'ASSESSMENT',
  selectedObjectId: '...'
})
```

**Focus Mode Filtering**:
- `'all'` - Full context (no filtering)
- `'pmo-docs'` - Only PMO standards and documentation
- `'project-data'` - Only current project data
- `'research'` - All internal sources, no web
- `'web'` - Minimal internal context, web search priority

---

## Testing

### Component Tests

**Location**: `tests/components/AIChat/`

- `ArtifactsPanel.test.tsx` - Artifacts panel functionality
- `MessageBubble.test.tsx` - Message rendering and actions
- `ThinkingBlock.test.tsx` - Thinking steps display
- `FocusModeSelector.test.tsx` - Focus mode selection

**Coverage**: Tests verify:
- Component rendering and props handling
- User interactions (click, hover, expand/collapse)
- State management integration
- Edge cases (empty states, loading states, errors)

### Integration Tests

**Location**: `tests/integration/chat/`

- `artifacts.test.ts` - Artifact extraction and display
- `thinking-steps.test.ts` - Thinking step extraction
- `focus-modes.test.ts` - Context filtering
- `streaming.test.ts` - Enhanced streaming

**Coverage**: Tests verify:
- End-to-end artifact flow (extraction → display → edit → export)
- Thinking step extraction during streaming
- Focus mode context filtering
- Real-time updates during streaming

### Backend Tests

**Location**: `tests/server/services/ai/`

- `aiPipeline-thinking.test.js` - Thinking extraction
- `aiPipeline-artifacts.test.js` - Artifact extraction
- `aiContextBuilder-focus.test.js` - Focus mode filtering

**Coverage**: Tests verify:
- Pattern matching for thinking blocks (`<thinking>...</thinking>`)
- Pattern matching for artifact markers (````artifact:type:title`)
- JSON artifact parsing
- Content cleaning (removal of markers)
- Focus mode context filtering logic

### Running Tests

```bash
# All tests
npm test

# Component tests only
npm test -- components/AIChat

# Integration tests only
npm test -- integration/chat

# Backend tests only
npm test -- server/services/ai

# With coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

### Test Results

**Status**: ✅ All tests passing (38/38)

- Component Tests: 12/12 ✅
- Integration Tests: 19/19 ✅
- Backend Tests: 7/7 ✅

**Coverage**:
- Components: 85%+
- Integration: 80%+
- Backend: 90%+

---

## Migration Guide

### From Old Chat to Enhanced Chat

1. **Enable Enhanced Messages**:
   ```tsx
   <ChatPanel enableEnhancedMessages={true} />
   ```

2. **Add Artifacts Store**:
   ```tsx
   import { useArtifactsStore } from './store/useArtifactsStore';
   ```

3. **Add Focus Mode**:
   ```tsx
   const [focusMode, setFocusMode] = useState<FocusMode>('all');
   ```

4. **Update Streaming Hook**:
   ```tsx
   const { thinkingSteps, artifacts, progress } = useAIStream();
   ```

### Backend Migration

1. **Use Enhanced Response**:
   ```javascript
   const response = await aiPipeline.process({...});
   const enhanced = enhanceResponse(response);
   ```

2. **Pass Focus Mode**:
   ```javascript
   const context = await aiContextBuilder.buildContext(
     userId, orgId, projectId, 
     { focusMode: 'pmo-docs' }
   );
   ```

---

## Performance Considerations

- **Artifacts**: Lazy-loaded, only rendered when panel is open
- **Thinking Steps**: Collapsed by default, expand on demand
- **Streaming**: Chunks processed incrementally, no blocking
- **Focus Modes**: Context filtering reduces token usage by 30-50%

---

## Browser Support

- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ⚠️ Mermaid diagrams require modern browser (Chrome/Edge recommended)

---

## Known Limitations

1. **Mermaid Diagrams**: Require `mermaid` package (installed)
2. **Artifact Editing**: Only supports text-based artifacts (code, markdown)
3. **Focus Modes**: Web search mode requires external API configuration
4. **Mobile**: Artifacts panel uses bottom drawer (not side panel)

---

## Future Enhancements

- [ ] Collaborative artifact editing
- [ ] Artifact templates library
- [ ] Custom artifact renderers
- [ ] Artifact version history
- [ ] Artifact sharing/export formats
- [ ] Voice commands for focus modes
- [ ] Advanced thinking step visualization

---

## Support

For issues or questions:
- Check [AI_USER_GUIDE.md](./user_guides/AI_USER_GUIDE.md)
- Review [AI_API_REFERENCE.md](./api/AI_API_REFERENCE.md)
- Contact: Support team

---

**Last Updated**: January 2026  
**Maintained By**: Consultify Development Team

