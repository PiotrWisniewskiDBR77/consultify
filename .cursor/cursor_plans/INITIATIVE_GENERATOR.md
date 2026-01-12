# Initiative Generator Documentation

## Overview

The Initiative Generator is a key feature of the Assessment Module that transforms maturity gaps into actionable transformation initiatives. It uses AI to generate initiatives based on assessment results, with customizable constraints for budget, timeline, team size, and risk appetite.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    INITIATIVE GENERATOR                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Assessment Module (2)                    Initiatives Module (3)    │
│  ┌─────────────────┐                     ┌─────────────────┐       │
│  │ Gap Analysis    │                     │ Initiatives     │       │
│  │    Dashboard    │ ─── Transfer ────▶  │    List         │       │
│  │                 │                     │                 │       │
│  └────────┬────────┘                     └─────────────────┘       │
│           │                                                         │
│           ▼                                                         │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │              Initiative Generator Wizard                 │       │
│  │  ┌──────────┬──────────┬──────────┬──────────┐          │       │
│  │  │  Step 1  │  Step 2  │  Step 3  │  Step 4  │          │       │
│  │  │   Gap    │Constraints│  Review  │ Approve  │          │       │
│  │  │Selection │   + AI   │  & Edit  │ Transfer │          │       │
│  │  └──────────┴──────────┴──────────┴──────────┘          │       │
│  └─────────────────────────────────────────────────────────┘       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## User Flow

### Step 1: Gap Selection
- Display all maturity gaps from the approved assessment
- Allow user to select which gaps to address
- Show gap priority (CRITICAL, HIGH, MEDIUM, LOW)
- Show current → target scores

### Step 2: AI Constraints
Configure generation parameters:
- **Max Budget**: Total budget constraint (PLN)
- **Max Timeline**: Maximum implementation time
- **Team Size**: Available team capacity
- **Risk Appetite**: Conservative, Moderate, or Aggressive

### Step 3: Review & Edit
- View AI-generated initiatives
- Edit any initiative details
- Remove unwanted initiatives
- Add custom initiatives manually

### Step 4: Approve & Transfer
- Review final selection
- See total budget, ROI summary
- Approve and transfer to Module 3 (Initiatives)

## Components

### Frontend

| Component | Path | Description |
|-----------|------|-------------|
| `InitiativeGeneratorWizard` | `components/assessment/InitiativeGeneratorWizard.tsx` | Main wizard component |
| `GeneratedInitiativeCard` | `components/assessment/GeneratedInitiativeCard.tsx` | Initiative display card |
| `InitiativeEditor` | `components/assessment/InitiativeEditor.tsx` | Edit modal for initiatives |
| `GapAnalysisDashboard` | `components/assessment/GapAnalysisDashboard.tsx` | Entry point with Generate button |

### React Hook

```typescript
// hooks/useInitiativeGenerator.ts

const {
    // State
    gaps,
    generatedInitiatives,
    draftInitiatives,
    isLoading,
    isGenerating,
    isSaving,
    error,
    
    // Actions
    fetchGaps,
    selectGap,
    selectAllGaps,
    generateWithAI,
    editInitiative,
    removeInitiative,
    addCustomInitiative,
    saveDraft,
    loadDraft,
    approveAndTransfer,
    validateInitiative,
    reset
} = useInitiativeGenerator(assessmentId);
```

### Backend Service

```javascript
// server/services/initiativeGeneratorService.js

class InitiativeGeneratorService {
    // Core methods
    static async generateFromAssessment(assessmentId, constraints) { }
    static async generateWithAI(gaps, constraints, context) { }
    static async validateInitiative(initiative) { }
    static async approveAndTransfer(initiatives, projectId, userId) { }
    static async saveDraft(assessmentId, initiatives) { }
    static async getDraftInitiatives(assessmentId) { }
}
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/initiatives/generate/:assessmentId` | POST | Generate from assessment |
| `/api/initiatives/generate/ai` | POST | AI-powered generation |
| `/api/initiatives/draft/:assessmentId` | GET | Get draft initiatives |
| `/api/initiatives/draft/:assessmentId` | POST | Save draft initiatives |
| `/api/initiatives/validate` | POST | Validate initiative |
| `/api/initiatives/approve` | POST | Approve and transfer |
| `/api/initiatives/gaps/:assessmentId` | GET | Get gaps for wizard |

## TypeScript Types

```typescript
// types.ts

interface GeneratedInitiative {
    id: string;
    assessmentId: string;
    sourceAxisId: DRDAxis;
    name: string;
    description: string;
    objectives: string[];
    estimatedROI: number;
    estimatedBudget: number;
    timeline: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    priority: number;
    status: 'DRAFT' | 'APPROVED' | 'TRANSFERRED';
    aiGenerated: boolean;
    createdAt: Date;
}

interface InitiativeGeneratorConstraints {
    maxBudget?: number;
    maxTimeline?: string;
    teamSize?: string;
    riskAppetite?: 'conservative' | 'moderate' | 'aggressive';
    focusAreas?: DRDAxis[];
}

interface GapForGeneration {
    axisId: DRDAxis;
    axisName: string;
    currentScore: number;
    targetScore: number;
    gap: number;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    selected: boolean;
}
```

## Database Schema

```sql
-- initiative_drafts: Temporary storage for draft initiatives
CREATE TABLE initiative_drafts (
    assessment_id TEXT PRIMARY KEY,
    initiatives_json TEXT NOT NULL,
    updated_at DATETIME
);

-- assessment_initiatives: Link between assessments and initiatives
CREATE TABLE assessment_initiatives (
    id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL,
    initiative_id TEXT NOT NULL,
    source_axis TEXT,
    gap_size REAL,
    created_at DATETIME
);
```

## AI Generation Logic

### Initiative Name Generation
Based on axis type and gap severity:
- **Processes**: "Process Automation Platform", "End-to-End Workflow Digitalization"
- **Digital Products**: "Digital Product Acceleration Program", "IoT/Digital Twin Implementation"
- **Data Management**: "Enterprise Data Lake Implementation", "Master Data Management Platform"
- etc.

### Budget Calculation
```
baseBudget = gap * 50,000 PLN per gap point
adjustedBudget = baseBudget * teamSizeMultiplier
```

### ROI Estimation
```
baseROI = gap * 0.4 + 0.5
adjustedROI = baseROI * priorityMultiplier
```

### Risk Assessment
```
HIGH risk: gap >= 4
MEDIUM risk: gap >= 2
LOW risk: gap < 2
```

## Integration with Module 3

After approval:
1. Initiatives are inserted into `initiatives` table
2. Link created in `assessment_initiatives`
3. Assessment marked with `initiatives_generated = 1`
4. User redirected to Module 3 (Initiatives List)

## Best Practices

1. **Gap Selection**: Focus on 3-5 highest priority gaps for better focus
2. **Budget Constraints**: Set realistic budget to get actionable initiatives
3. **Risk Appetite**: Start with "Moderate" for balanced approach
4. **Review Carefully**: Always review AI-generated content before approval
5. **Save Drafts**: Use draft saving for complex decisions

## Troubleshooting

### No gaps displayed
- Ensure assessment is completed with actual and target scores
- Check that assessment status is APPROVED

### Generation fails
- Verify gaps are selected in Step 1
- Check browser console for API errors

### Transfer fails
- Ensure all initiatives pass validation
- Check project ID is valid

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-12 | Initial implementation |

---

*Part of Assessment Module v2.0 - See [ASSESSMENT_MODULE_COMPLETE.md](./ASSESSMENT_MODULE_COMPLETE.md) for full documentation*

