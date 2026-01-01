# Consultify Studio - Visual AI Workspace

## Overview

**Consultify Studio** is an AI-powered visual workspace for creating, editing, and managing diagrams within the Consultify platform. It combines natural language AI chat with an interactive React Flow canvas to enable users to create professional diagrams through conversation.

### Key Features

- 🎨 **AI-Powered Diagram Generation** - Create diagrams by describing them in natural language
- ✏️ **Interactive Canvas** - Drag, drop, connect, and edit nodes visually
- 💬 **Chat Interface** - Conversational AI for diagram creation and modification
- 🔗 **PMO Integration** - Link diagrams to Tasks, Projects, and Initiatives
- 📊 **Multiple Diagram Types** - Process flows, org charts, mind maps, RACI matrices, swimlanes
- 💾 **Version Control** - Snapshots and version history
- 📤 **Export** - PNG, SVG, and JSON export options
- 🎯 **Templates** - Pre-built templates for common diagram types

---

## Architecture

### Technology Stack

- **Frontend**: React + TypeScript
- **Canvas Library**: React Flow (`reactflow`)
- **Backend**: Node.js + Express
- **Database**: SQLite (with PostgreSQL support)
- **AI**: Integrated with Consultify AI Pipeline

### Component Structure

```
components/Studio/
├── StudioCanvas.tsx          # Main canvas component
├── StudioChat.tsx            # AI chat panel
├── StudioToolbar.tsx         # Node palette toolbar
├── StudioSidebar.tsx         # Documents list
├── StudioExportModal.tsx     # Export dialog
├── StudioLinkModal.tsx       # PMO linking dialog
├── nodes/                    # Custom node types
│   ├── ProcessStepNode.tsx
│   ├── DecisionNode.tsx
│   ├── StartEndNode.tsx
│   ├── TextNode.tsx
│   ├── MindmapNode.tsx
│   ├── RACICell.tsx
│   ├── OrgUnitNode.tsx
│   └── SwimLaneNode.tsx
└── hooks/
    ├── useStudioDocument.ts  # Document state management
    └── useStudioAI.ts        # AI interaction
```

---

## Database Schema

### Tables

#### `studio_documents`
Core table storing diagram documents.

```sql
CREATE TABLE studio_documents (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'process_flow',
    nodes_json TEXT DEFAULT '[]',
    edges_json TEXT DEFAULT '[]',
    viewport_json TEXT DEFAULT '{}',
    conversation_id TEXT,
    ai_context_json TEXT DEFAULT '{}',
    linked_task_id TEXT,
    linked_project_id TEXT,
    linked_initiative_id TEXT,
    is_public INTEGER DEFAULT 0,
    share_token TEXT UNIQUE,
    thumbnail_url TEXT,
    tags_json TEXT DEFAULT '[]',
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### `studio_snapshots`
Version history for documents.

```sql
CREATE TABLE studio_snapshots (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    name TEXT,
    nodes_json TEXT NOT NULL,
    edges_json TEXT NOT NULL,
    viewport_json TEXT,
    snapshot_reason TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### `studio_templates`
Reusable diagram templates.

```sql
CREATE TABLE studio_templates (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    nodes_json TEXT NOT NULL DEFAULT '[]',
    edges_json TEXT NOT NULL DEFAULT '[]',
    is_public INTEGER DEFAULT 0,
    usage_count INTEGER DEFAULT 0
);
```

#### `studio_comments`
Comments on diagram nodes.

```sql
CREATE TABLE studio_comments (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    text TEXT NOT NULL,
    ai_response TEXT,
    resolved INTEGER DEFAULT 0
);
```

#### `studio_ai_sessions`
AI conversation context.

```sql
CREATE TABLE studio_ai_sessions (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    messages_json TEXT DEFAULT '[]',
    intent_history_json TEXT DEFAULT '[]',
    total_generations INTEGER DEFAULT 0,
    total_modifications INTEGER DEFAULT 0
);
```

---

## API Endpoints

### Documents

- `GET /api/studio/documents` - List documents
- `POST /api/studio/documents` - Create document
- `GET /api/studio/documents/:id` - Get document
- `PUT /api/studio/documents/:id` - Update document
- `DELETE /api/studio/documents/:id` - Delete document

### Snapshots

- `POST /api/studio/documents/:id/snapshot` - Create snapshot
- `POST /api/studio/documents/:id/restore/:snapshotId` - Restore from snapshot

### Sharing

- `POST /api/studio/documents/:id/share` - Generate share link
- `GET /api/studio/shared/:token` - Get shared document (public)

### Templates

- `GET /api/studio/templates` - List templates
- `POST /api/studio/templates` - Create template

### AI

- `POST /api/studio/ai/generate` - Generate diagram from text
- `POST /api/studio/ai/modify` - Modify existing diagram
- `POST /api/studio/ai/chat` - Process chat message
- `POST /api/studio/ai/suggest` - Get optimization suggestions
- `POST /api/studio/ai/classify` - Classify user intent

### Linking

- `POST /api/studio/documents/:id/link` - Link to Task/Project/Initiative

See [API Reference](./api/studio-api.md) for detailed endpoint documentation.

---

## Diagram Types

### Process Flow
Linear or branching processes with steps and decisions.

**Node Types**: `processStep`, `decision`, `startEnd`, `textNode`

### Organization Chart
Hierarchical organization structures.

**Node Types**: `orgUnit` (person/department/team)

### Mind Map
Radial brainstorming diagrams.

**Node Types**: `mindmapNode` (with levels 0-3)

### RACI Matrix
Responsibility assignment matrices.

**Node Types**: `raciCell` (R/A/C/I values)

### Swimlane Diagram
Cross-functional process flows with role lanes.

**Node Types**: `swimlane`, `processStep`, `decision`

---

## AI Service

### Intent Classification

The AI service classifies user messages into intents:

- `CREATE_DIAGRAM` - Generate new diagram
- `ADD_NODE` - Add elements
- `REMOVE_NODE` - Delete elements
- `MODIFY_NODE` - Edit existing elements
- `CONNECT_NODES` - Create connections
- `CHANGE_LAYOUT` - Rearrange diagram
- `EXPLAIN` - Explain diagram
- `UNKNOWN` - Unclear intent

### Diagram Generation

The AI service converts natural language descriptions into React Flow node/edge structures:

```typescript
{
    nodes: [
        {
            id: "uuid",
            type: "processStep",
            position: { x: 0, y: 0 },
            data: { label: "Step Name" }
        }
    ],
    edges: [
        {
            id: "edge-uuid",
            source: "node-1",
            target: "node-2",
            type: "smoothstep"
        }
    ]
}
```

---

## Usage Examples

### Creating a Diagram via Chat

1. Open Studio from **Tools → Studio** in sidebar
2. Type in chat: "Create a process flow for employee onboarding"
3. AI generates diagram with nodes and connections
4. Edit manually or ask AI to modify: "Add a decision point for manager approval"

### Manual Editing

1. Use toolbar to add nodes (Process Step, Decision, etc.)
2. Drag nodes to reposition
3. Connect nodes by dragging from handle to handle
4. Double-click nodes to edit labels
5. Right-click for context menu (coming soon)

### Linking to PMO Entities

1. Click **Link** button in header
2. Select Task, Project, or Initiative
3. Diagram appears as attachment in linked entity

### Exporting

1. Click **Export** button
2. Choose format: PNG, SVG, or JSON
3. Configure quality and background
4. Download file

---

## Templates

### Built-in Templates

1. **Simple Process Flow** - Basic linear process
2. **Approval Workflow** - Process with decision points
3. **Onboarding Process** - Employee onboarding template
4. **Simple Org Chart** - 3-level hierarchy
5. **Project Brainstorm** - Mind map template
6. **RACI Matrix** - Responsibility matrix
7. **Cross-Functional Process** - Swimlane template

### Creating Templates

1. Create or open a diagram
2. Design your template
3. Click **Save as Template** (coming soon)
4. Template available for reuse

---

## Testing

### Test Coverage

- **Unit Tests**: 95 tests passing
  - Component tests (StudioCanvas, StudioChat, StudioToolbar)
  - Hook tests (useStudioDocument, useStudioAI)
  - Node type tests

- **Integration Tests**: 71 tests passing
  - API endpoint verification
  - Database schema verification
  - AI service method verification

### Running Tests

```bash
# Run all Studio tests
npm test tests/components/Studio tests/integration/studio-api.test.ts

# Run specific test file
npm test tests/components/Studio/StudioCanvas.test.tsx
```

### Test Files

```
tests/
├── components/Studio/
│   ├── StudioCanvas.test.tsx
│   ├── StudioChat.test.tsx
│   ├── StudioView.test.tsx
│   ├── StudioToolbar.test.tsx
│   ├── useStudioDocument.test.ts
│   └── useStudioAI.test.ts
└── integration/
    ├── studio-api.test.ts
    └── studio-flow.test.tsx
```

---

## Development

### Adding New Node Types

1. Create node component in `components/Studio/nodes/`
2. Export from `components/Studio/nodes/index.ts`
3. Add to `nodeTypes` mapping in `StudioCanvas.tsx`
4. Update AI service prompts to support new type
5. Add tests

### Adding New Diagram Types

1. Add configuration to `DIAGRAM_CONFIGS` in `studioAIService.js`
2. Update AI system prompts
3. Add template if needed
4. Update documentation

### Extending AI Capabilities

1. Add new intent type to `INTENT_TYPES`
2. Implement handler in `processMessage()`
3. Update `classifyIntent()` if needed
4. Add tests

---

## Performance Considerations

- **Auto-save**: Configurable delay (default 3 seconds)
- **Snapshot limits**: Last 10 snapshots per document
- **Message history**: Last 50 messages per session
- **Canvas optimization**: React Flow handles large diagrams efficiently
- **Lazy loading**: Components loaded on demand

---

## Security

- **Authentication**: All endpoints require `verifyToken` middleware
- **Authorization**: Organization-scoped access
- **Sharing**: Optional public sharing with tokens
- **Data validation**: Input sanitization on all endpoints
- **Rate limiting**: Integrated with API rate limits

---

## Future Enhancements

- [ ] Real-time collaboration
- [ ] Comment threads on nodes
- [ ] Advanced styling options
- [ ] Custom node shapes
- [ ] Animation support
- [ ] Import from other tools (Visio, Lucidchart)
- [ ] Template marketplace
- [ ] AI-powered diagram analysis
- [ ] Export to PowerPoint/PDF
- [ ] Mobile support

---

## Troubleshooting

### Diagram not generating

- Check AI service is configured
- Verify API keys are set
- Check browser console for errors
- Ensure prompt is clear and specific

### Nodes not connecting

- Verify both nodes have compatible handles
- Check node types support connections
- Ensure canvas is not locked

### Export failing

- Check browser supports canvas export
- Verify diagram has content
- Try different format (PNG vs SVG)

---

## Related Documentation

- [Studio API Reference](./api/studio-api.md)
- [Studio User Guide](./user_guides/STUDIO_USER_GUIDE.md)
- [React Flow Documentation](https://reactflow.dev/)
- [AI Pipeline Documentation](./ai_research/AI_MASTER_ARCHITECTURE.md)

---

## Changelog

### v1.0.0 (2025-01-XX)
- Initial release
- 8 custom node types
- 5 diagram types
- AI-powered generation
- PMO integration
- Export functionality
- Template library

---

## Support

For issues or questions:
- Check [Troubleshooting](#troubleshooting) section
- Review test files for usage examples
- Contact development team

---

**Last Updated**: 2025-01-XX  
**Version**: 1.0.0  
**Status**: ✅ Production Ready

