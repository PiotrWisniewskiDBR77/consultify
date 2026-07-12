/**
 * AIChat Components Index
 *
 * Centralized exports for AI Chat system components.
 */

// Menu and sidebar components
export { ChatHistorySidebar } from './ChatHistorySidebar';
export { ConversationActions } from './ConversationActions';
export { ConversationItem } from './ConversationItem';
export { ConversationList } from './ConversationList';
export { ConversationSearch } from './ConversationSearch';

// Input components
export { AddFilesMenu } from './AddFilesMenu';
export { CloudFilePicker } from './CloudFilePicker';
export { EnhancedChatInput } from './EnhancedChatInput';
export { FocusModeBadge, FocusModeSelector } from './Input/FocusModeSelector';
export { TeresaTTSPlayer } from './TeresaTTSPlayer';
export { ToolsMenu } from './ToolsMenu';

// Response components
export { CitationList, CitationMarker } from './CitationList';
export { PrimaryActionButton, ResponseActions } from './ResponseActions';
export { SmartSuggestions, SuggestionChip } from './SmartSuggestions';

// World-Class Chat 2025: Messages
export { MessageActions } from './Messages/MessageActions';
export { MessageBubble } from './Messages/MessageBubble';
export { ThinkingBlock } from './Messages/ThinkingBlock';

// World-Class Chat 2025: Artifacts
export { ArtifactEditor } from './Artifacts/ArtifactEditor';
export { ArtifactsPanel } from './Artifacts/ArtifactsPanel';
export { ArtifactViewer } from './Artifacts/ArtifactViewer';
export { CodeRenderer } from './Artifacts/renderers/CodeRenderer';
// DiagramRenderer is internal and should be lazy loaded via ArtifactViewer
export { HTMLPreview } from './Artifacts/renderers/HTMLPreview';
export { MarkdownRenderer } from './Artifacts/renderers/MarkdownRenderer';
export { PMODocumentRenderer } from './Artifacts/renderers/PMODocumentRenderer';
export { TableRenderer } from './Artifacts/renderers/TableRenderer';
