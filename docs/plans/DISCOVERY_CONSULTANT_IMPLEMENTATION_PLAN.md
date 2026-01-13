# Discovery Consultant - Implementation Plan

> **Project:** Discovery Consultant Module  
> **Total Effort:** ~48 hours | **Team Size:** 1-2 developers  
> **Start Date:** TBD | **Target Completion:** 3 weeks

---

## 📋 Executive Summary

### Scope

Implementacja modułu Discovery Consultant - AI-powered rozmowy discovery z live canvas w stylu Miro, integracja z istniejącymi modułami (Assessments, Projects, Initiatives).

### Deliverables

1. Discovery Canvas component (React Flow)
2. New node types (Pain, Insight, Recommendation, etc.)
3. Discovery Consultant View (split layout)
4. AI Entity Extraction service
5. Session persistence & versioning
6. Project conversion flow
7. Tools & Assessment recommendation engine

### Dependencies

- ✅ React Flow (already in project - `StudioCanvas`)
- ✅ AI Streaming (`useAIStream`)
- ✅ Conversation Store (`useConversationStore`)
- ✅ Framework Registry (`frameworkRegistry.ts`)
- ⚠️ Transformation Tools Catalog (needs creation)

---

## 🗓️ Implementation Phases

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        IMPLEMENTATION TIMELINE                           │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PHASE 1        PHASE 2        PHASE 3        PHASE 4        PHASE 5    │
│  Foundation     Canvas         AI Engine      Integration    Polish     │
│  ───────────    ───────────    ───────────    ───────────    ─────────  │
│  Days 1-3       Days 4-7       Days 8-10      Days 11-13     Days 14-15 │
│                                                                          │
│  ┌─────────┐   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌────────┐ │
│  │ Store   │   │ Canvas  │    │ Extract │    │ Project │    │ Tests  │ │
│  │ Types   │   │ Nodes   │    │ Prompt  │    │ Convert │    │ Docs   │ │
│  │ Config  │   │ Layout  │    │ Reco    │    │ Version │    │ Polish │ │
│  └─────────┘   └─────────┘    └─────────┘    └─────────┘    └────────┘ │
│                                                                          │
│  Effort: 8h     Effort: 16h   Effort: 10h    Effort: 8h     Effort: 6h │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 📦 Phase 1: Foundation (Days 1-3, ~8h)

### Goals

- Set up store and types
- Create configuration files
- Prepare component structure

### Tasks

| #   | Task                                   | Est. | Priority | Dependencies |
| --- | -------------------------------------- | ---- | -------- | ------------ |
| 1.1 | Create `useDiscoveryStore.ts`          | 2h   | P0       | -            |
| 1.2 | Define TypeScript types                | 1h   | P0       | -            |
| 1.3 | Create `transformationTools.ts` config | 1.5h | P0       | -            |
| 1.4 | Set up folder structure                | 0.5h | P0       | -            |
| 1.5 | Create Discovery feature flag          | 0.5h | P1       | -            |
| 1.6 | Add translations (i18n)                | 1.5h | P1       | 1.2          |
| 1.7 | Write base types tests                 | 1h   | P2       | 1.2          |

### Deliverables

```
src/
├── components/
│   └── Discovery/              # NEW folder
│       ├── index.ts
│       └── nodes/
│           └── index.ts
├── store/
│   └── useDiscoveryStore.ts    # NEW
├── types/
│   └── discovery.ts            # NEW
└── config/
    └── transformationTools.ts  # NEW
```

### Task Details

#### 1.1 Create `useDiscoveryStore.ts`

```typescript
// src/store/useDiscoveryStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DiscoveryState {
  // Session
  activeSessionId: string | null;
  sessions: DiscoverySession[];

  // Canvas
  nodes: DiscoveryNode[];
  edges: DiscoveryEdge[];

  // Recommendations
  transformationType: TransformationType | null;
  recommendedFrameworks: FrameworkId[];
  recommendedTools: string[];
  initiativeIdeas: InitiativeIdea[];

  // Client context
  clientContext: ClientContext;

  // Phase tracking
  currentPhase: DiscoveryPhase;

  // Actions
  createSession: () => string;
  updateSession: (id: string, data: Partial<DiscoverySession>) => void;
  addNode: (node: DiscoveryNode) => void;
  updateNode: (id: string, data: Partial<DiscoveryNode>) => void;
  removeNode: (id: string) => void;
  addEdge: (edge: DiscoveryEdge) => void;
  setRecommendations: (reco: DiscoveryRecommendations) => void;
  setPhase: (phase: DiscoveryPhase) => void;
  saveVersion: () => Promise<number>;
  loadVersion: (version: number) => Promise<void>;
  convertToProject: () => Promise<string>;
}
```

#### 1.3 Create `transformationTools.ts`

```typescript
// src/config/transformationTools.ts
export interface TransformationTool {
  id: string;
  name: string;
  namePl: string;
  category: string;
  description: string;
  descriptionPl: string;
  icon: string;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
}

export const TRANSFORMATION_TOOLS: Record<TransformationType, TransformationTool[]> = {
  strategic: [
    {
      id: 'swot',
      name: 'SWOT Analysis',
      namePl: 'Analiza SWOT',
      category: 'Analysis',
      description: 'Strengths, Weaknesses, Opportunities, Threats analysis',
      descriptionPl: 'Analiza mocnych i słabych stron, szans i zagrożeń',
      icon: 'Grid3x3',
      effort: 'low',
      impact: 'medium',
    },
    // ... more tools
  ],
  operational: [
    {
      id: 'vsm',
      name: 'Value Stream Mapping',
      namePl: 'Mapowanie strumienia wartości',
      category: 'Process',
      // ...
    },
    // ... more tools
  ],
  digital: [
    {
      id: 'process_mining',
      name: 'Process Mining',
      namePl: 'Process Mining',
      category: 'Analysis',
      // ...
    },
    // ... more tools
  ],
};
```

---

## 📦 Phase 2: Discovery Canvas (Days 4-7, ~16h)

### Goals

- Build Discovery Canvas component
- Create all node types
- Implement auto-layout
- Add canvas interactions

### Tasks

| #    | Task                              | Est. | Priority | Dependencies |
| ---- | --------------------------------- | ---- | -------- | ------------ |
| 2.1  | Create `DiscoveryCanvas.tsx` base | 3h   | P0       | 1.1          |
| 2.2  | Create `PainPointNode.tsx`        | 1.5h | P0       | 2.1          |
| 2.3  | Create `InsightNode.tsx`          | 1h   | P0       | 2.1          |
| 2.4  | Create `OpportunityNode.tsx`      | 1h   | P1       | 2.1          |
| 2.5  | Create `RecommendationNode.tsx`   | 1.5h | P0       | 2.1          |
| 2.6  | Create `QuoteNode.tsx`            | 0.5h | P2       | 2.1          |
| 2.7  | Create `ToolNode.tsx`             | 1h   | P1       | 2.1          |
| 2.8  | Create `AssessmentNode.tsx`       | 1h   | P1       | 2.1          |
| 2.9  | Implement auto-layout algorithm   | 2h   | P0       | 2.1-2.8      |
| 2.10 | Add drag & drop interactions      | 1.5h | P1       | 2.9          |
| 2.11 | Implement grouping/categories     | 1.5h | P1       | 2.9          |
| 2.12 | Add canvas export (image)         | 0.5h | P2       | 2.1          |

### Deliverables

```
src/components/Discovery/
├── DiscoveryCanvas.tsx           # Main canvas component
├── DiscoveryCanvasToolbar.tsx    # Canvas controls
├── CategoryFrame.tsx             # Category grouping frame
├── nodes/
│   ├── index.ts
│   ├── PainPointNode.tsx         # 🔴
│   ├── InsightNode.tsx           # 💡
│   ├── OpportunityNode.tsx       # 💚
│   ├── RecommendationNode.tsx    # ✅
│   ├── QuoteNode.tsx             # 💬
│   ├── ToolNode.tsx              # 🛠️
│   └── AssessmentNode.tsx        # 📊
└── hooks/
    └── useAutoLayout.ts          # Auto-layout hook
```

### Task Details

#### 2.1 Create `DiscoveryCanvas.tsx`

```typescript
// Key features to implement:
export const DiscoveryCanvas: React.FC<DiscoveryCanvasProps> = ({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onNodeAdd,
  onNodeUpdate,
  readOnly = false,
}) => {
  return (
    <ReactFlowProvider>
      <div className="h-full w-full relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={discoveryNodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          // ...
        >
          <Background variant={BackgroundVariant.Dots} />
          <Controls />
          <MiniMap nodeColor={getNodeColor} />

          {/* Category frames */}
          <CategoryFrame category="pains" title="Pain Points" />
          <CategoryFrame category="insights" title="Insights" />
          <CategoryFrame category="recommendations" title="Recommendations" />
        </ReactFlow>

        <DiscoveryCanvasToolbar onExport={handleExport} />
      </div>
    </ReactFlowProvider>
  );
};
```

#### 2.2 Create `PainPointNode.tsx`

```typescript
const PainPointNode: React.FC<NodeProps<PainPointNodeData>> = ({ data, selected }) => {
  return (
    <div className={`
      bg-red-50 dark:bg-red-900/20
      border-2 border-red-300 dark:border-red-700
      rounded-xl p-3 min-w-[180px] max-w-[220px]
      shadow-md hover:shadow-lg transition-all
      ${selected ? 'ring-2 ring-red-500' : ''}
    `}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-lg">🔴</span>
        <SeverityDots level={data.severity} />
      </div>

      {/* Content */}
      <p className="text-sm font-medium text-red-900 dark:text-red-100 line-clamp-3">
        {data.text}
      </p>

      {/* Impact */}
      {data.impact && (
        <div className="mt-2 pt-2 border-t border-red-200 dark:border-red-800">
          <span className="text-xs text-red-600 dark:text-red-400">
            Impact: {data.impact}
          </span>
        </div>
      )}

      {/* Handles */}
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Left} />
    </div>
  );
};
```

---

## 📦 Phase 3: AI Engine (Days 8-10, ~10h)

### Goals

- Implement entity extraction
- Create recommendation engine
- Integrate with AI streaming

### Tasks

| #   | Task                         | Est. | Priority | Dependencies |
| --- | ---------------------------- | ---- | -------- | ------------ |
| 3.1 | Create Discovery AI prompt   | 2h   | P0       | -            |
| 3.2 | Implement entity extractor   | 3h   | P0       | 3.1          |
| 3.3 | Create recommendation engine | 2.5h | P0       | 1.3          |
| 3.4 | Hook AI to canvas sync       | 1.5h | P0       | 3.2, 2.1     |
| 3.5 | Add extraction validation    | 1h   | P1       | 3.2          |

### Deliverables

```
server/src/services/discovery/
├── discoveryPrompt.ts           # AI prompt configuration
├── entityExtractor.ts           # Extract entities from text
├── recommendationEngine.ts      # Generate recommendations
└── discoveryService.ts          # Main service

src/hooks/
└── useDiscoverySync.ts          # Chat → Canvas sync hook
```

### Task Details

#### 3.1 Create Discovery AI Prompt

```typescript
// server/src/services/discovery/discoveryPrompt.ts
export const DISCOVERY_CONSULTANT_SYSTEM_PROMPT = `
You are a senior transformation consultant conducting a discovery call.

## PERSONA
- Role: Senior Partner at DBR77 Industrial Intelligence
- Style: Warm, professional, uses Socratic questioning
- Language: Polish (switch to English if user writes in English)

## METHODOLOGY
Use SPIN framework adapted for consulting:
- Situation: Understand current state
- Problem: Identify pain points  
- Implication: Quantify impact
- Need-payoff: Show value of solution

## CONVERSATION RULES
1. Ask ONE question at a time
2. Keep responses concise (2-3 sentences max)
3. Always acknowledge user's input before next question
4. After gathering info, offer insights and value
5. Guide towards natural recommendation

## EXTRACTION INSTRUCTIONS
After EACH response, include a JSON block with extracted entities:

\`\`\`json
{
  "extraction": {
    "painPoints": [
      {"text": "...", "severity": 1-5, "area": "process|technology|people|data"}
    ],
    "insights": [
      {"text": "...", "linkedPains": ["pain_text"]}
    ],
    "quotes": [
      {"text": "exact user words", "sentiment": "positive|negative|neutral"}
    ],
    "clientContext": {
      "industry": "...",
      "size": "...",
      "role": "..."
    },
    "phaseProgress": {
      "contextComplete": true/false,
      "painsIdentified": number,
      "readyForRecommendations": true/false
    }
  }
}
\`\`\`

## PHASE MANAGEMENT
- Start: Ice breaking (2-3 questions about context)
- Middle: Pain discovery (3-5 questions, go deep)
- End: Recommendations (only when enough info gathered)

Current conversation context will be provided below.
`;
```

#### 3.2 Implement Entity Extractor

````typescript
// server/src/services/discovery/entityExtractor.ts
export class DiscoveryEntityExtractor {
  extractFromResponse(aiResponse: string): ExtractedEntities | null {
    // Parse JSON block from response
    const jsonMatch = aiResponse.match(/```json\n([\s\S]*?)\n```/);
    if (!jsonMatch) return null;

    try {
      const parsed = JSON.parse(jsonMatch[1]);
      return this.validateAndTransform(parsed.extraction);
    } catch (e) {
      console.error('[DiscoveryExtractor] Parse error:', e);
      return null;
    }
  }

  private validateAndTransform(raw: any): ExtractedEntities {
    return {
      painPoints: (raw.painPoints || []).map(this.validatePainPoint),
      insights: (raw.insights || []).map(this.validateInsight),
      quotes: (raw.quotes || []).map(this.validateQuote),
      clientContext: this.validateClientContext(raw.clientContext),
      phaseProgress: raw.phaseProgress || {},
    };
  }

  private validatePainPoint(pain: any): PainPoint {
    return {
      id: generateId(),
      text: pain.text || '',
      severity: Math.min(5, Math.max(1, pain.severity || 3)),
      area: ['process', 'technology', 'people', 'data'].includes(pain.area) ? pain.area : 'process',
    };
  }
  // ... more validators
}
````

#### 3.3 Create Recommendation Engine

```typescript
// server/src/services/discovery/recommendationEngine.ts
export class DiscoveryRecommendationEngine {
  generateRecommendations(session: DiscoverySession): DiscoveryRecommendations {
    const painAreas = this.analyzePainAreas(session.painPoints);
    const transformationType = this.determineTransformationType(painAreas);
    const matchScore = this.calculateMatchScore(session, transformationType);

    return {
      transformationType,
      matchScore,
      frameworks: this.recommendFrameworks(painAreas, transformationType),
      tools: this.recommendTools(transformationType, session.painPoints),
      initiatives: this.generateInitiativeIdeas(session),
    };
  }

  private determineTransformationType(painAreas: Record<PainArea, number>): TransformationType {
    const scores = {
      strategic: painAreas.people * 2 + painAreas.process,
      operational: painAreas.process * 2 + painAreas.technology,
      digital: painAreas.technology * 2 + painAreas.data * 2,
    };

    return Object.entries(scores).sort(([, a], [, b]) => b - a)[0][0] as TransformationType;
  }

  private recommendFrameworks(
    painAreas: Record<PainArea, number>,
    type: TransformationType
  ): FrameworkId[] {
    const recommendations: FrameworkId[] = [];

    // Always include DRD as baseline
    recommendations.push('DRD');

    // Type-specific
    if (type === 'operational') {
      recommendations.push('LEAN');
      if (painAreas.technology > 0) recommendations.push('SIRI');
    }

    if (type === 'digital') {
      recommendations.push('SIRI', 'ADMA');
    }

    if (painAreas.process > 2) {
      if (!recommendations.includes('CMMI')) recommendations.push('CMMI');
    }

    return recommendations.slice(0, 3); // Max 3
  }

  private recommendTools(type: TransformationType, painPoints: PainPoint[]): string[] {
    const tools = TRANSFORMATION_TOOLS[type] || [];

    // Sort by relevance to pain points
    return tools
      .map((tool) => ({
        tool,
        score: this.calculateToolRelevance(tool, painPoints),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((t) => t.tool.id);
  }
}
```

---

## 📦 Phase 4: Integration (Days 11-13, ~8h)

### Goals

- Create main view component
- Implement project conversion
- Add versioning
- Connect all pieces

### Tasks

| #   | Task                                 | Est. | Priority | Dependencies |
| --- | ------------------------------------ | ---- | -------- | ------------ |
| 4.1 | Create `DiscoveryConsultantView.tsx` | 2.5h | P0       | 2.1, 3.4     |
| 4.2 | Implement `RecommendationPanel.tsx`  | 1.5h | P0       | 3.3          |
| 4.3 | Add project conversion flow          | 1.5h | P0       | 4.1          |
| 4.4 | Implement version save/load          | 1.5h | P1       | 1.1          |
| 4.5 | Add footer actions                   | 1h   | P1       | 4.1-4.4      |

### Deliverables

```
src/
├── views/
│   └── DiscoveryConsultantView.tsx    # Main split view
├── components/Discovery/
│   ├── RecommendationPanel.tsx        # Recommendations summary
│   ├── DiscoveryFooterActions.tsx     # Action buttons
│   ├── VersionSelector.tsx            # Version dropdown
│   └── ProjectConversionModal.tsx     # Conversion dialog
```

### Task Details

#### 4.1 Create `DiscoveryConsultantView.tsx`

```typescript
// src/views/DiscoveryConsultantView.tsx
export const DiscoveryConsultantView: React.FC = () => {
  const { t } = useTranslation();

  // Stores
  const {
    nodes, edges,
    clientContext,
    currentPhase,
    addNode, updateNode
  } = useDiscoveryStore();

  const {
    activeChatMessages,
    addChatMessage
  } = useAppStore();

  // AI streaming with extraction callback
  const { isStreaming, streamedContent, startStream } = useAIStream({
    onStreamDone: handleStreamComplete
  });

  // Sync hook
  useDiscoverySync();

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <DiscoveryHeader
        clientContext={clientContext}
        phase={currentPhase}
      />

      {/* Main split view */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Chat */}
        <div className="w-[35%] min-w-[400px] border-r border-slate-200 dark:border-navy-700">
          <ChatPanel
            messages={activeChatMessages}
            onSendMessage={handleSendMessage}
            isTyping={isStreaming}
            title={t('discovery.chatTitle', 'Discovery Consultant')}
            subtitle={t('discovery.chatSubtitle', 'AI-powered discovery')}
          />
        </div>

        {/* Right: Canvas + Recommendations */}
        <div className="flex-1 flex flex-col">
          {/* Canvas */}
          <div className="flex-1 relative">
            <DiscoveryCanvas
              nodes={nodes}
              edges={edges}
              onNodeAdd={addNode}
              onNodeUpdate={updateNode}
            />
          </div>

          {/* Recommendation Panel (collapsible) */}
          <RecommendationPanel />
        </div>
      </div>

      {/* Footer Actions */}
      <DiscoveryFooterActions />
    </div>
  );
};
```

#### 4.3 Add Project Conversion Flow

```typescript
// src/components/Discovery/ProjectConversionModal.tsx
export const ProjectConversionModal: React.FC<Props> = ({
  isOpen,
  onClose,
  session
}) => {
  const [projectName, setProjectName] = useState(
    `Discovery: ${session.clientContext?.companyName || 'New Client'}`
  );
  const [isConverting, setIsConverting] = useState(false);

  const handleConvert = async () => {
    setIsConverting(true);
    try {
      const projectId = await convertSessionToProject(session, {
        name: projectName,
        includeRecommendations: true,
        createInitiatives: createInitiatives
      });

      toast.success(t('discovery.projectCreated'));
      navigate(`/project/${projectId}`);
    } catch (error) {
      toast.error(t('discovery.conversionFailed'));
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <Modal.Header>
        {t('discovery.createProject', 'Create Project from Discovery')}
      </Modal.Header>
      <Modal.Body>
        {/* Project name input */}
        <Input
          label={t('discovery.projectName')}
          value={projectName}
          onChange={setProjectName}
        />

        {/* What will be transferred */}
        <div className="mt-4 p-3 bg-slate-50 dark:bg-navy-900 rounded-lg">
          <h4 className="text-sm font-medium mb-2">
            {t('discovery.whatWillBeTransferred')}
          </h4>
          <ul className="text-sm text-slate-600 space-y-1">
            <li>✅ {session.painPoints.length} pain points</li>
            <li>✅ {session.insights.length} insights</li>
            <li>✅ Recommended transformation: {session.transformationType}</li>
            <li>✅ {session.recommendedFrameworks.length} suggested assessments</li>
            <li>✅ Full conversation history</li>
          </ul>
        </div>

        {/* Options */}
        <div className="mt-4 space-y-2">
          <Checkbox
            checked={createInitiatives}
            onChange={setCreateInitiatives}
            label={t('discovery.createInitiatives')}
          />
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="primary"
          onClick={handleConvert}
          loading={isConverting}
        >
          <Rocket size={16} className="mr-2" />
          {t('discovery.createProject')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
```

---

## 📦 Phase 5: Polish & Testing (Days 14-15, ~6h)

### Goals

- Write tests
- Fix bugs
- Documentation
- Performance optimization

### Tasks

| #   | Task                        | Est. | Priority | Dependencies |
| --- | --------------------------- | ---- | -------- | ------------ |
| 5.1 | Unit tests for nodes        | 1.5h | P1       | Phase 2      |
| 5.2 | Unit tests for extraction   | 1h   | P1       | Phase 3      |
| 5.3 | Integration tests           | 1.5h | P1       | Phase 4      |
| 5.4 | E2E test (happy path)       | 1h   | P2       | Phase 4      |
| 5.5 | Performance optimization    | 0.5h | P2       | All          |
| 5.6 | Update Master Flow Registry | 0.5h | P1       | All          |

### Deliverables

```
tests/
├── components/Discovery/
│   ├── DiscoveryCanvas.test.tsx
│   ├── nodes/
│   │   └── PainPointNode.test.tsx
│   └── RecommendationPanel.test.tsx
├── store/
│   └── useDiscoveryStore.test.ts
├── integration/
│   └── discovery-flow.test.ts
└── e2e/
    └── discovery-consultant.spec.ts
```

---

## 📊 Risk Assessment

| Risk                        | Probability | Impact | Mitigation                  |
| --------------------------- | ----------- | ------ | --------------------------- |
| AI extraction inconsistent  | Medium      | High   | Add fallback manual mode    |
| React Flow performance      | Low         | Medium | Virtualization, node limits |
| Complex canvas interactions | Medium      | Medium | Simplify MVP, iterate       |
| Integration with projects   | Low         | High   | Use existing patterns       |

---

## 🎯 Success Criteria

### MVP (Phase 1-4)

- [ ] User can start discovery conversation
- [ ] AI extracts entities to canvas
- [ ] Canvas shows pain points, insights
- [ ] Recommendations are generated
- [ ] User can convert to project

### Full Release (Phase 5+)

- [ ] All node types implemented
- [ ] Version history works
- [ ] Tests pass (>80% coverage)
- [ ] Performance acceptable (<100ms interactions)
- [ ] Documentation complete

---

## 📝 Post-Launch Tasks

| Task                           | Priority | Est. |
| ------------------------------ | -------- | ---- |
| PDF Export                     | P2       | 4h   |
| Team collaboration (real-time) | P3       | 16h  |
| Mobile responsive              | P2       | 8h   |
| Canvas templates               | P3       | 6h   |
| AI learning from feedback      | P3       | 12h  |

---

## 📚 References

- [Discovery Consultant Module](../modules/DISCOVERY_CONSULTANT_MODULE.md)
- [Discovery Flow](../flows/discovery/DISCOVERY_CONSULTANT_FLOW.md)
- [Unified AI Chat System](../UNIFIED_AI_CHAT_SYSTEM.md)
- [Framework Registry](../../src/services/frameworkRegistry.ts)
