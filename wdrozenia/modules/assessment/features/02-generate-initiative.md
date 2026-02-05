# Assessment – Generate Initiatives (Quick batch + Enterprise Wizard 50+)

## Status: ✅ ZAIMPLEMENTOWANE (P0)

**Backend (single batch ≤7):** `server/src/services/AssessmentInitiativeService.ts`  
**Backend (GenerationRun 50+):** `server/src/services/assessmentInitiativeGenerationRunService.ts`  
**Frontend (Manage):** `src/components/assessment/manage/InitiativesManagementPanel.tsx`  
**Frontend (Hub + Wizard modal):** `src/components/assessment/AssessmentHub.tsx`, `src/components/assessment/InitiativesGenerationWizardModal.tsx`

---

## 📋 Opis

System wspiera dwa sposoby generowania inicjatyw w module Assessment:

### A) Quick generate (batch ≤7)

- 5 metodologii priorytetyzacji
- **Max 7 inicjatyw na batch** (stabilność i przewidywalność)
- Inicjatywy są zapisywane jako **`DRAFT`** i linkowane do assessmentu
- Opcjonalny kontekst raportu (`reportId`) – poprawia jakość, nie jest wymagany

### B) Enterprise Wizard + GenerationRun (50+)

- Generowanie portfela (np. 50+) w jednym uruchomieniu
- Serwer dzieli całość na sub-batche (domyślnie 7), zapisuje postęp i retry
- Po zakończeniu run inicjatywy są dostępne jako `DRAFT` w Manage (per-assessment)
- Wizard oferuje preview i bulk akcje, w tym **Submit for review** (`DRAFT → PENDING_REVIEW`)

---

## 🔄 Workflow

```
┌────────────┐     approve     ┌──────────┐     generate     ┌────────────┐
│ ASSESSMENT │ ──────────────► │ APPROVED │ ────────────────► │ INITIATIVES│
│  (scored)  │                 │          │                   │  (DRAFT)   │
└────────────┘                 └──────────┘                   └────────────┘
```

### Warunki Generowania

1. ✅ Assessment musi być APPROVED
2. ✅ Uprawnienie: **ASSESSMENT_GENERATE_INITIATIVES**
3. ✅ Tryb `REPORT_ONLY` wymaga raportu (i jego zatwierdzenia, jeśli raport ma status w danym środowisku)

Uwaga: raport **nie jest wymagany** dla generowania z assessmentu (`ASSESSMENT_REPORT`), ale może być przekazany jako kontekst (`reportId`).

---

## 🎯 5 Metodologii Priorytetyzacji

| Metodologia | Opis | Kryteria |
|-------------|------|----------|
| **impact-feasibility** | Macierz Impact/Feasibility | Impact (1-5) × Feasibility (1-5) |
| **moscow** | MoSCoW | Must/Should/Could/Won't |
| **rice** | RICE Score | Reach × Impact × Confidence / Effort |
| **value-effort** | Value vs Effort | Value (1-5) / Effort (1-5) |
| **strategic-fit** | Strategic Fit | Alignment z celami strategicznymi |

---

## 🎨 UI - GenerateInitiativesModal

```
┌─────────────────────────────────────────────────────────────────┐
│ ✕              Generate Transformation Initiatives              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Prioritization Methodology *                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ○ Impact-Feasibility Matrix                             │   │
│  │ ○ MoSCoW Method                                         │   │
│  │ ● RICE Score                                            │   │
│  │ ○ Value vs Effort                                       │   │
│  │ ○ Strategic Fit                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Number of Initiatives                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ [3] ◄────────●────────────► [7]                         │   │
│  │              5                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ☑ Include Interview Context                                    │
│  ☐ Include Chat History                                         │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ℹ️ AI will analyze assessment gaps and generate          │   │
│  │    prioritized transformation initiatives.               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                              [Cancel]  [Generate Initiatives]   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Backend Implementation

### AssessmentInitiativeService.ts

```typescript
export class AssessmentInitiativeService {
  static async generateFromAssessment(
    assessmentId: string,
    options: {
      methodology: string;
      count: number;
      includeInterviewContext: boolean;
      includeChatContext: boolean;
    }
  ): Promise<Initiative[]> {
    // 1. Pobierz assessment z gaps
    const assessment = await getAssessmentWithGaps(assessmentId);
    
    // 2. Pobierz kontekst (opcjonalnie)
    let context = '';
    if (options.includeInterviewContext) {
      context += await getInterviewContext(assessment.projectId);
    }
    if (options.includeChatContext) {
      context += await getChatContext(assessment.projectId);
    }
    
    // 3. Generuj inicjatywy przez AI
    const prompt = buildPrompt(assessment, options.methodology, context);
    const aiResponse = await LLMService.generate(prompt);
    
    // 4. Parsuj i waliduj
    let initiatives = parseInitiatives(aiResponse);
    
    // 5. Fallback jeśli AI zawiedzie
    if (initiatives.length === 0) {
      initiatives = generateFallbackInitiatives(assessment);
    }
    
    // 6. Ogranicz do max count
    initiatives = initiatives.slice(0, options.count);
    
    // 7. Zapisz jako DRAFT
    const saved = await persistInitiatives(initiatives, assessmentId);
    
    return saved;
  }
}
```

### Prompt Building

```typescript
const buildPrompt = (assessment: Assessment, methodology: string, context: string) => {
  const gaps = assessment.gaps.sort((a, b) => b.gap - a.gap);
  
  return `
You are a digital transformation consultant. Based on the following assessment gaps, 
generate transformation initiatives using the ${methodology} prioritization method.

## Assessment Summary
Framework: ${assessment.framework}
Overall Score: ${assessment.overallScore}
Organization: ${assessment.organizationName}

## Top Gaps (priority areas)
${gaps.slice(0, 5).map(g => `- ${g.dimension}: Current ${g.current}, Target ${g.target}, Gap ${g.gap}`).join('\n')}

## Additional Context
${context}

## Instructions
Generate ${assessment.requestedCount} initiatives in JSON format:
[
  {
    "title": "Initiative title",
    "description": "Detailed description",
    "category": "DIGITAL_PROCESSES | DIGITAL_PRODUCTS | ...",
    "priority": "HIGH | MEDIUM | LOW",
    "estimatedEffort": "S | M | L | XL",
    "expectedImpact": "Description of expected impact",
    "dependencies": ["dependency1", "dependency2"]
  }
]
`;
};
```

### Persist Initiatives

```typescript
const persistInitiatives = async (
  initiatives: GeneratedInitiative[],
  assessmentId: string
): Promise<Initiative[]> => {
  const assessment = await getAssessment(assessmentId);
  const saved: Initiative[] = [];
  
  for (const init of initiatives) {
    const id = uuidv4();
    
    await db.run(`
      INSERT INTO initiatives (
        id, title, description, status, priority, category,
        source_type, source_id, organization_id, project_id,
        estimated_effort, expected_impact, created_at
      ) VALUES (?, ?, ?, 'DRAFT', ?, ?, 'assessment', ?, ?, ?, ?, ?, ?)
    `, [
      id, init.title, init.description, init.priority, init.category,
      assessmentId, assessment.organizationId, assessment.projectId,
      init.estimatedEffort, init.expectedImpact, new Date().toISOString()
    ]);
    
    // Link do assessment
    await db.run(`
      INSERT INTO assessment_initiative_links (assessment_id, initiative_id)
      VALUES (?, ?)
    `, [assessmentId, id]);
    
    saved.push({ id, ...init, status: 'DRAFT' });
  }
  
  // Log audit
  await logAudit('assessment_initiatives_generated', assessmentId, {
    count: saved.length,
    methodology: assessment.methodology
  });
  
  return saved;
};
```

---

## 📊 Category Mapping

### Per Framework

```typescript
const ASSESSMENT_CATEGORY_MAPPING: Record<string, Record<string, string>> = {
  DRD: {
    'Cyfrowe Procesy': 'DIGITAL_PROCESSES',
    'Cyfrowe Produkty': 'DIGITAL_PRODUCTS',
    'Cyfrowe Modele': 'DIGITAL_BUSINESS_MODELS',
    'Big Data': 'DATA_ANALYTICS',
    'Kultura': 'DIGITAL_CULTURE',
    'Cyberbezpieczeństwo': 'CYBERSECURITY',
    'AI': 'AI_AUTOMATION'
  },
  SIRI: {
    'Operations': 'OPERATIONS',
    'Supply Chain': 'SUPPLY_CHAIN',
    'Automation': 'AUTOMATION',
    'Connectivity': 'CONNECTIVITY',
    'Intelligence': 'INTELLIGENCE',
    'Talent': 'TALENT',
    'Structure': 'ORGANIZATION',
    'Strategy': 'STRATEGY'
  }
};
```

---

## 🔧 API Endpoint

```http
POST /api/assessment-workflow-v2/:assessmentId/generate-initiatives
Authorization: Bearer {token}
Permission: ASSESSMENT_GENERATE_INITIATIVES

{
  "methodologyId": "rice",
  "count": 5,
  "includeChatContext": true,
  "reportId": "optional"
}

Response:
{
  "batchId": "uuid",
  "initiatives": [
    {
      "id": "uuid",
      "title": "Implement Process Mining",
      "description": "...",
      "status": "DRAFT",
      "priority": "HIGH",
      "category": "DIGITAL_PROCESSES"
    },
    ...
  ],
  "generatedAt": "2026-01-27T10:00:00Z"
}
```

### Enterprise: GenerationRun (50+)

```http
POST /api/assessment-workflow-v2/:assessmentId/initiative-generation-runs
Authorization: Bearer {token}
Permission: ASSESSMENT_GENERATE_INITIATIVES

{
  "mode": "ASSESSMENT_REPORT" | "REPORT_ONLY",
  "methodologyId": "impact-feasibility" | "moscow" | "rice" | "value-effort" | "strategic-fit",
  "requestedCount": 50,
  "batchSize": 7,
  "includeChatContext": true,
  "reportId": "required for REPORT_ONLY",
  "templateId": "tpl-card-standard (optional)",
  "consultantBrief": "optional"
}
```

Progress i operacje:

- `GET  /api/assessment-workflow-v2/:assessmentId/initiative-generation-runs/:runId`
- `GET  /api/assessment-workflow-v2/:assessmentId/initiative-generation-runs/:runId/initiatives` (preview)
- `POST /api/assessment-workflow-v2/:assessmentId/initiative-generation-runs/:runId/submit-for-review` (bulk `DRAFT → PENDING_REVIEW`)

### Report-only (wejście raportowe)

```http
POST /api/assessment-reports/:reportId/generate-initiatives
Authorization: Bearer {token}
Permission: ASSESSMENT_GENERATE_INITIATIVES

{
  "methodologyId": "rice",
  "requestedCount": 30,
  "batchSize": 7,
  "templateId": "tpl-card-lite",
  "consultantBrief": "optional"
}
```

Szczegóły GenerationRun: `wdrozenia/modules/assessment/features/03-initiative-generation-runs.md`

---

## 🎯 Fallback Initiatives

Jeśli AI zawiedzie, generowane są fallback initiatives na podstawie gaps:

```typescript
const generateFallbackInitiatives = (assessment: Assessment): GeneratedInitiative[] => {
  return assessment.gaps
    .filter(g => g.gap >= 1.5)
    .slice(0, 5)
    .map(gap => ({
      title: `Improve ${gap.dimension}`,
      description: `Address the gap in ${gap.dimension} (current: ${gap.current}, target: ${gap.target})`,
      category: mapToCategory(gap.dimension, assessment.framework),
      priority: gap.gap >= 2 ? 'HIGH' : 'MEDIUM',
      estimatedEffort: 'M',
      expectedImpact: `Increase ${gap.dimension} score from ${gap.current} to ${gap.target}`
    }));
};
```

---

## ✅ Weryfikacja

- [x] 5 metodologii priorytetyzacji
- [x] Max 7 inicjatyw per batch
- [x] Enterprise GenerationRun (50+) z progress/retry
- [x] AI generation z promptem
- [x] Fallback initiatives
- [x] source_type='assessment'
- [x] Inicjatywy jako DRAFT
- [x] Assessment-Initiative linking
- [x] Audit logging
- [x] Wizard: preview + bulk Submit for review (`DRAFT → PENDING_REVIEW`)
- [x] Template card-scope (`initiatives.initiative_template_id`)