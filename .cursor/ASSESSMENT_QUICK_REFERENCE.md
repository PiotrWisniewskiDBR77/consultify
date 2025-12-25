# 🚀 Assessment Module - Quick Reference

> Szybka karta referencyjna dla deweloperów  
> **Wersja:** 2.0 | **Status:** ✅ 100% Complete

---

## 📊 Statystyki Modułu

| Metric | Value |
|--------|-------|
| Components | 31 |
| Services | 12+ |
| API Endpoints | 48+ |
| AI Functions | 26 |
| React Hooks | 3 |

---

## Osie DRD (7 osi)

| ID | Nazwa | Ikona |
|----|-------|-------|
| `processes` | Digital Processes | ⚙️ |
| `digitalProducts` | Digital Products | 📱 |
| `businessModels` | Business Models | 💼 |
| `dataManagement` | Data Management | 📊 |
| `culture` | Culture | 👥 |
| `cybersecurity` | Cybersecurity | 🔒 |
| `aiMaturity` | AI Maturity | 🤖 |

---

## Workflow Status Flow

```
DRAFT → IN_REVIEW → AWAITING_APPROVAL → APPROVED
                                    ↓
                               REJECTED → DRAFT
```

---

## Kluczowe Pliki

### Backend
```
server/services/assessmentWorkflowService.js   # Logika workflow
server/services/aiAssessmentPartnerService.js  # AI Partner
server/services/assessmentReportService.js     # PDF/Excel
server/routes/assessment-workflow.js           # API routes
server/migrations/010_assessment_workflow.sql  # DB schema
```

### Frontend
```
components/assessment/AssessmentWorkflowPanel.tsx  # Panel workflow
components/assessment/AxisCommentsPanel.tsx        # Komentarze
components/assessment/AssessmentStageGate.tsx      # Stage Gates
hooks/useAssessmentCollaboration.tsx               # Real-time
```

---

## API Endpoints - Najważniejsze

```bash
# Workflow
GET  /api/assessment-workflow/:id/status
POST /api/assessment-workflow/:id/submit-for-review
POST /api/assessment-workflow/:id/approve
POST /api/assessment-workflow/:id/reject

# Comments
GET  /api/assessment-workflow/:id/comments?axisId=processes
POST /api/assessment-workflow/:id/comments

# Versions
GET  /api/assessment-workflow/:id/versions
POST /api/assessment-workflow/:id/restore/:version

# Export
POST /api/assessment-workflow/:id/export/pdf
POST /api/assessment-workflow/:id/export/excel

# AI
POST /api/assessment/:id/ai/guidance
POST /api/assessment/:id/ai/validate
POST /api/assessment/:id/ai/insights
```

---

## RBAC Permissions

```javascript
assessmentRBAC('create')  // Tworzenie
assessmentRBAC('read')    // Odczyt
assessmentRBAC('update')  // Edycja, submit, approve
assessmentRBAC('delete')  // Usuwanie
assessmentRBAC('export')  // Eksport PDF/Excel
```

---

## Skala Oceny

| Level | Nazwa | Opis |
|-------|-------|------|
| 1 | Initial | Ad-hoc |
| 2 | Emerging | Pierwsze inicjatywy |
| 3 | Defined | Udokumentowane |
| 4 | Managed | Mierzone |
| 5 | Optimized | Data-driven |
| 6 | Advanced | Zautomatyzowane |
| 7 | Leading | Innowacyjne |

---

## Walidacja Wymagana

✅ Każda oś musi mieć:
- `actualScore` (1-7)
- `targetScore` (1-7)  
- `justification` (min 100 znaków)

✅ Przed submit:
- Wszystkie 7 osi wypełnione
- Min 2 recenzentów przypisanych

---

## Audit Actions

```javascript
'ASSESSMENT_CREATED'
'ASSESSMENT_SUBMITTED_FOR_REVIEW'
'ASSESSMENT_REVIEW_COMPLETED'
'ASSESSMENT_APPROVED'
'ASSESSMENT_REJECTED'
'ASSESSMENT_VERSION_RESTORED'
'ASSESSMENT_COMMENT_ADDED'
'ASSESSMENT_EXPORTED_PDF'
'ASSESSMENT_EXPORTED_EXCEL'
```

---

## Typowe Błędy

| Error | Rozwiązanie |
|-------|-------------|
| `Assessment must be in DRAFT status` | Sprawdź obecny status przed submit |
| `Minimum 2 reviewers required` | Dodaj recenzentów |
| `All axes must be evaluated` | Wypełnij brakujące osie |
| `Justification too short` | Min 100 znaków na uzasadnienie |

---

## React Hook - useAssessmentCollaboration

```tsx
const {
  collaborators,        // Array<CollaboratorPresence>
  activities,           // Array<ActivityEvent>
  isConnected,          // boolean
  setCurrentAxis,       // (axisId: string) => void
  notifyAxisUpdate,     // (axisId, actual, target) => void
  notifyCommentAdded,   // (axisId, preview) => void
  refresh               // () => void
} = useAssessmentCollaboration({
  assessmentId: 'xxx',
  projectId: 'yyy'
});
```

---

## Komponenty UI

```tsx
// Workflow panel
<AssessmentWorkflowPanel
  assessmentId={id}
  workflowStatus={status}
  currentVersion={version}
  reviewers={reviewers}
  onSubmit={handleSubmit}
  onApprove={handleApprove}
  onReject={handleReject}
/>

// Komentarze
<AxisCommentsPanel
  assessmentId={id}
  axisId="processes"
  axisLabel="Digital Processes"
  onCommentCountChange={setCount}
/>

// Stage Gate
<AssessmentStageGate
  projectId={projectId}
  assessmentStatus={status}
  onPassGate={handlePassGate}
/>

// Presence
<PresenceIndicator collaborators={collaborators} maxVisible={4} />
<ActivityFeed activities={activities} maxItems={10} />
```

---

## Quick Copy-Paste

### Nowy Endpoint

```javascript
router.post('/:assessmentId/action', authMiddleware, assessmentRBAC('update'), async (req, res) => {
    try {
        const { assessmentId } = req.params;
        const userId = req.user.id;
        
        const result = await AssessmentWorkflowService.doAction(assessmentId, userId);
        
        await AssessmentAuditLogger.log({
            userId,
            organizationId: req.user.organizationId,
            action: 'ACTION_NAME',
            resourceType: 'ASSESSMENT',
            resourceId: assessmentId,
            details: {},
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });
        
        res.json(result);
    } catch (error) {
        console.error('[AssessmentWorkflow] Error:', error);
        res.status(400).json({ error: error.message });
    }
});
```

### Nowa Metoda Serwisu

```javascript
static async newMethod(assessmentId, userId, data) {
    const workflow = await this.getWorkflowStatus(assessmentId);
    if (!workflow) {
        throw new Error('Assessment not found');
    }
    
    if (workflow.status !== WORKFLOW_STATES.DRAFT) {
        throw new Error('Assessment must be in DRAFT status');
    }
    
    // Logic here...
    
    return { success: true };
}
```

---

---

## 🆕 Nowe Komponenty (v2.0)

| Komponent | Cel |
|-----------|-----|
| `AssessmentVersionHistory` | Historia wersji z restore |
| `AssessmentVersionDiff` | Porównanie wersji |
| `ReviewerDashboard` | Panel recenzenta |
| `MyAssessmentsList` | Lista ocen użytkownika |
| `AIAssessmentSidebar` | AI assistant sidebar |

## 🆕 Nowe Hooki (v2.0)

```typescript
// Workflow management
const { submitForReview, approve, reject, versions } = useAssessmentWorkflow(id);

// AI assistance  
const { suggestJustification, generateGapAnalysis } = useAssessmentAI(projectId);

// Real-time collaboration
const { activeUsers, broadcastActivity } = useAssessmentCollaboration(id);
```

## 🆕 Nowe AppView (v2.0)

```typescript
AppView.MY_ASSESSMENTS        // Lista ocen użytkownika
AppView.REVIEWER_DASHBOARD    // Panel recenzenta
AppView.ASSESSMENT_DASHBOARD  // Dashboard modułu
AppView.GAP_MAP               // Gap Analysis
AppView.ASSESSMENT_REPORTS    // Archiwum raportów
AppView.INITIATIVE_GENERATOR  // Generator inicjatyw
```

---

## 🆕 Initiative Generator (v2.1)

### Hook

```typescript
const { 
    gaps,                   // GapForGeneration[]
    generatedInitiatives,   // GeneratedInitiative[]
    generateWithAI,         // (constraints) => Promise<void>
    approveAndTransfer      // (projectId) => Promise<{transferred, failed}>
} = useInitiativeGenerator(assessmentId);
```

### API Endpoints

```bash
POST /api/initiatives/generate/:assessmentId  # Generate from assessment
POST /api/initiatives/generate/ai             # AI-powered generation
GET  /api/initiatives/draft/:assessmentId     # Get drafts
POST /api/initiatives/draft/:assessmentId     # Save drafts
POST /api/initiatives/approve                 # Transfer to Module 3
GET  /api/initiatives/gaps/:assessmentId      # Get gaps for wizard
```

### Komponenty

```tsx
<InitiativeGeneratorWizard assessmentId={id} projectId={pid} onComplete={fn} />
<GeneratedInitiativeCard initiative={init} onEdit={fn} onRemove={fn} />
<InitiativeEditor initiative={init} onSave={fn} onCancel={fn} />
```

---

📚 **Dokumentacja:**
- `.cursor/ASSESSMENT_MODULE_COMPLETE.md` - Pełna dokumentacja techniczna
- `.cursor/ASSESSMENT_MODULE_WORKFLOW.md` - Workflow i standardy
- `.cursor/AI_ASSESSMENT_SYSTEM.md` - System AI
- `.cursor/rules/assessment-module.mdc` - Reguły developerskie

