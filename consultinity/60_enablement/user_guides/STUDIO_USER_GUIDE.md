# Consultify Studio - User Guide

## Getting Started

### Accessing Studio

1. Log in to Consultify
2. Navigate to **Tools → Studio** in the sidebar
3. Studio opens with a blank canvas and AI chat panel

### First Diagram

**Option 1: AI Generation**
1. Type in chat: "Create a process flow for [your process]"
2. AI generates diagram automatically
3. Edit as needed

**Option 2: Template**
1. Click **New Document** in sidebar
2. Select a template
3. Customize the template

**Option 3: Manual Creation**
1. Use toolbar to add nodes
2. Connect nodes by dragging
3. Edit labels by double-clicking

---

## Interface Overview

### Canvas (Right Panel)
- **Main workspace** for diagram editing
- **Pan**: Click and drag background
- **Zoom**: Mouse wheel or controls
- **Select**: Click nodes/edges
- **Delete**: Select and press Delete key

### Chat Panel (Left Panel)
- **AI Assistant** for diagram generation
- **Quick Actions** for common tasks
- **Message History** of AI interactions
- **Suggestions** for improvements

### Toolbar (Bottom)
- **Node Palette** - Add nodes by type
- **Expand/Collapse** - Show/hide toolbar

### Header
- **Document Name** - Click to edit
- **Save Button** - Manual save
- **Link Button** - Link to Task/Project
- **Export Button** - Export diagram
- **Chat Toggle** - Show/hide chat panel

---

## Creating Diagrams

### Using AI Chat

**Basic Generation:**
```
"Create a process flow for customer support"
```

**Specific Diagram Types:**
```
"Create an organization chart for my company"
"Create a mind map about project planning"
"Create a RACI matrix for the development team"
```

**Modifications:**
```
"Add a decision point after step 3"
"Remove the approval node"
"Connect node A to node B"
"Change the label of 'Review' to 'Manager Review'"
```

### Manual Editing

**Adding Nodes:**
1. Click node type in toolbar
2. Click on canvas to place
3. Drag to reposition

**Connecting Nodes:**
1. Hover over source node handle (right side)
2. Drag to target node handle (left side)
3. Release to create connection

**Editing Labels:**
1. Double-click node
2. Type new label
3. Press Enter or click outside

**Deleting:**
1. Select node/edge
2. Press Delete key
3. Or right-click → Delete

---

## Diagram Types

### Process Flow
Best for: Workflows, procedures, step-by-step processes

**Example Prompts:**
- "Create a process flow for employee onboarding"
- "Show the approval workflow"
- "Map the customer journey"

### Organization Chart
Best for: Company structure, reporting relationships

**Example Prompts:**
- "Create an org chart for a startup"
- "Show the IT department structure"

### Mind Map
Best for: Brainstorming, idea organization, planning

**Example Prompts:**
- "Create a mind map about digital transformation"
- "Map out project ideas"

### RACI Matrix
Best for: Responsibility assignment, role clarity

**Example Prompts:**
- "Create a RACI matrix for the project team"
- "Show responsibilities for the launch"

### Swimlane Diagram
Best for: Cross-functional processes, department workflows

**Example Prompts:**
- "Create a swimlane for order fulfillment"
- "Map the sales-to-delivery process"

---

## Advanced Features

### Snapshots (Version History)

**Create Snapshot:**
1. Click **Save** button
2. Snapshot created automatically
3. Or click camera icon for manual snapshot

**Restore Version:**
1. Open document
2. View snapshots in sidebar (coming soon)
3. Click restore on desired version

### Linking to PMO Entities

**Link to Task:**
1. Click **Link** button in header
2. Select **Tasks** tab
3. Choose task
4. Diagram appears in task attachments

**Link to Project:**
1. Same as above, select **Projects** tab

**Link to Initiative:**
1. Same as above, select **Initiatives** tab

### Sharing

**Generate Share Link:**
1. Click **Share** button (coming soon)
2. Copy share link
3. Share with anyone (no login required)

**Public View:**
- View-only access
- No editing capabilities
- No authentication required

### Export

**PNG Export:**
1. Click **Export** button
2. Select **PNG**
3. Choose quality (1x, 2x, 3x)
4. Include/exclude background
5. Download

**SVG Export:**
1. Select **SVG** format
2. Scalable vector format
3. Perfect for presentations

**JSON Export:**
1. Select **JSON** format
2. Raw diagram data
3. Import into other tools (coming soon)

---

## Tips & Best Practices

### AI Prompts

**Be Specific:**
✅ "Create a process flow for employee onboarding with 5 steps including manager approval"
❌ "Make a diagram"

**Use Context:**
✅ "Add a decision point for budget approval after the planning step"
❌ "Add something"

**Iterate:**
✅ Start simple, then refine: "Create a basic flow" → "Add decision points" → "Add swimlanes"

### Diagram Design

**Layout:**
- Process flows: Left to right
- Org charts: Top to bottom
- Mind maps: Center outward

**Labels:**
- Keep concise
- Use action verbs for process steps
- Be consistent with terminology

**Connections:**
- Avoid crossing edges when possible
- Use decision nodes for branches
- Label important connections

### Performance

**Large Diagrams:**
- Break into multiple diagrams
- Use templates for common patterns
- Lock canvas when viewing only

**Auto-save:**
- Enabled by default (3 second delay)
- Manual save creates snapshot
- Unsaved changes indicator in header

---

## Keyboard Shortcuts

- `Delete` - Delete selected node/edge
- `Ctrl/Cmd + Z` - Undo (coming soon)
- `Ctrl/Cmd + Y` - Redo (coming soon)
- `Ctrl/Cmd + S` - Save
- `Ctrl/Cmd + E` - Export
- `Space` - Pan mode (coming soon)
- `Enter` - Send chat message

---

## Troubleshooting

### AI Not Responding

**Check:**
- Internet connection
- API keys configured
- Prompt clarity

**Try:**
- Rephrase prompt
- Break into smaller requests
- Check browser console

### Nodes Not Connecting

**Check:**
- Both nodes have handles
- Node types are compatible
- Canvas is not locked

**Try:**
- Unlock canvas (lock icon)
- Check node handles are visible
- Try different node types

### Export Not Working

**Check:**
- Diagram has content
- Browser supports canvas export
- No errors in console

**Try:**
- Different format (PNG vs SVG)
- Lower quality setting
- Refresh page

### Performance Issues

**For Large Diagrams:**
- Reduce node count
- Simplify connections
- Use snapshots for versions
- Lock canvas when viewing

---

## Examples

### Example 1: Employee Onboarding

**Prompt:**
```
Create a process flow for employee onboarding with these steps:
1. HR paperwork
2. IT setup
3. Training
4. Mentor assignment
5. First day complete
```

**Result:** 5-step process flow with connections

### Example 2: Approval Workflow

**Prompt:**
```
Create an approval workflow with:
- Request submission
- Manager review (decision point)
- If approved: Director approval
- If rejected: Return to requester
```

**Result:** Process flow with decision diamond and branches

### Example 3: Team Structure

**Prompt:**
```
Create an organization chart:
- CEO at top
- CTO, CFO, COO reporting to CEO
- Engineering and Product under CTO
- Finance under CFO
```

**Result:** Hierarchical org chart

---

## FAQ

**Q: Can I import diagrams from other tools?**  
A: Not yet, but JSON import is planned.

**Q: Can multiple people edit at once?**  
A: Real-time collaboration is planned for future release.

**Q: How many diagrams can I create?**  
A: Unlimited per organization.

**Q: Are diagrams private?**  
A: Yes, unless you explicitly share them.

**Q: Can I export to PowerPoint?**  
A: PNG/SVG export available now, PowerPoint export planned.

**Q: Does AI use my data for training?**  
A: No, all AI processing is isolated to your organization.

---

## Support

For help:
1. Check this guide
2. Review [Troubleshooting](#troubleshooting)
3. Contact support

---

**Last Updated**: 2025-01-XX


