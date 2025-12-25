# AI Assessment System - Dokumentacja

## Przegląd

System AI dla modułu Assessment zapewnia inteligentne wsparcie w procesie oceny dojrzałości cyfrowej organizacji. Obejmuje sugestie formularzy, walidację, analizę luk, generowanie raportów i wsparcie inicjatyw transformacyjnych.

---

## Architektura

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND LAYER                                │
├─────────────────────────────────────────────────────────────────────┤
│  AssessmentAxisWorkspace.tsx                                        │
│  ├── useAssessmentAI.ts (hook)                                      │
│  ├── AI Quick Actions (Sugeruj, Dowody, Cel, Popraw)               │
│  └── AI Suggestion Panel                                            │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        API LAYER                                     │
├─────────────────────────────────────────────────────────────────────┤
│  routes/assessment.js                                                │
│  ├── /ai/suggest-justification                                       │
│  ├── /ai/suggest-evidence                                            │
│  ├── /ai/suggest-target                                              │
│  ├── /ai/correct-text                                                │
│  ├── /ai/autocomplete                                                │
│  ├── /ai/executive-summary                                           │
│  ├── /ai/stakeholder-view                                            │
│  ├── /ai/generate-initiatives                                        │
│  └── ... (więcej endpointów)                                         │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     BACKEND SERVICES                                 │
├─────────────────────────────────────────────────────────────────────┤
│  aiAssessmentPartnerService.js                                       │
│  ├── Form Assistance (sugestJustification, suggestEvidence, etc.)   │
│  ├── Validation (validateScoreConsistency)                          │
│  ├── Analysis (generateGapAnalysis, generateProactiveInsights)      │
│  ├── Reports (generateExecutiveSummary, generateStakeholderView)    │
│  └── Initiatives (generateInitiativesFromGaps, estimateInitiativeROI)│
│                                                                      │
│  aiAssessmentFormHelper.js                                           │
│  ├── Field Suggestions (getFieldSuggestion)                          │
│  ├── Field Validation (validateFieldValue)                           │
│  ├── Batch Operations (fillMissingFields, reviewAllJustifications)  │
│  └── Quick Actions (getQuickActions, getContextualHelp)             │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     AI PROVIDER                                      │
├─────────────────────────────────────────────────────────────────────┤
│  Google Gemini (gemini-1.5-flash)                                    │
│  ├── Konfiguracja przez GOOGLE_AI_API_KEY lub GEMINI_API_KEY        │
│  └── Fallback responses gdy AI niedostępne                          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Funkcje AI

### 1. Wsparcie Formularzy

#### `suggestJustification(axisId, score, context)`
Generuje sugestię uzasadnienia dla danej oceny.

**Parametry:**
- `axisId` - ID osi DRD (np. `processes`, `digitalProducts`)
- `score` - ocena 1-7
- `context` - kontekst (industry, companySize, existingJustification)

**Zwraca:**
```typescript
{
    suggestion: string;
    mode: 'AI_GENERATED' | 'FALLBACK';
}
```

#### `suggestEvidence(axisId, score, context)`
Sugeruje dowody wspierające daną ocenę.

**Zwraca:**
```typescript
{
    evidence: string[];
    mode: 'AI_GENERATED' | 'FALLBACK';
}
```

#### `suggestTargetScore(axisId, currentScore, ambitionLevel)`
Sugeruje docelowy poziom dojrzałości.

**Parametry:**
- `ambitionLevel` - `conservative` | `balanced` | `aggressive`

**Zwraca:**
```typescript
{
    suggestedTarget: number;
    reasoning: string;
    timeEstimate: string;
}
```

#### `correctJustificationLanguage(text, language)`
Koryguje i poprawia tekst uzasadnienia.

#### `autocompleteJustification(partialText, axisId, score)`
Autouzupełnia częściowy tekst.

---

### 2. Walidacja

#### `validateScoreConsistency(assessment)`
Sprawdza spójność ocen między osiami.

**Reguły:**
- AI Maturity nie powinna przekraczać Data Management o więcej niż 2 poziomy
- Cybersecurity nie powinna znacząco odstać od poziomu digitalizacji procesów
- Digital Products wymaga wsparcia procesów
- Business Models wymaga wsparcia kultury

**Zwraca:**
```typescript
{
    hasInconsistencies: boolean;
    inconsistencies: Array<{
        type: 'DEPENDENCY_MISMATCH' | 'RISK_GAP' | 'CAPABILITY_GAP' | 'CULTURE_GAP';
        axes: string[];
        message: string;
        suggestion: string;
    }>;
}
```

#### `validateFieldValue(fieldType, value, context)`
Waliduje wartość pola formularza z feedbackiem AI.

---

### 3. Analiza

#### `generateGapAnalysis(axisId, currentScore, targetScore)`
Generuje szczegółową analizę luki.

**Zwraca:**
```typescript
{
    gap: number;
    gapSeverity: 'LOW' | 'MEDIUM' | 'HIGH';
    pathway: Array<{
        level: number;
        description: string;
        estimatedMonths: number;
        keyActivities: string[];
    }>;
    estimatedTotalMonths: number;
    aiRecommendations: Array<{
        title: string;
        description: string;
        priority: 'HIGH' | 'MEDIUM' | 'LOW';
        timeframe: string;
    }>;
}
```

#### `generateProactiveInsights(assessment)`
Generuje proaktywne wglądy na podstawie oceny.

**Typy insightów:**
- `STRENGTH` - mocne strony
- `PRIORITY_GAP` - priorytetowe luki
- `RISK` - ryzyka
- `OPPORTUNITY` - szanse
- `SUMMARY` - podsumowanie

---

### 4. Generowanie Raportów

#### `generateExecutiveSummary(assessment, options)`
Generuje podsumowanie wykonawcze.

**Zwraca:**
```typescript
{
    summary: string;
    metrics: {
        averageMaturity: string;
        averageTarget: string;
        overallGap: string;
    };
    topStrengths: string[];
    priorityGaps: string[];
}
```

#### `generateStakeholderView(assessment, stakeholderRole)`
Generuje widok dostosowany do interesariusza.

**Role:**
- `CTO` - fokus na technologii
- `CFO` - fokus na ROI i kosztach
- `COO` - fokus na operacjach
- `CEO` - fokus strategiczny
- `BOARD` - fokus na governance

#### `generateBenchmarkCommentary(assessment, benchmarks)`
Generuje komentarz porównawczy z benchmarkami branżowymi.

---

### 5. Wsparcie Inicjatyw

#### `generateInitiativesFromGaps(gapAnalysis, constraints)`
Generuje propozycje inicjatyw transformacyjnych.

**Parametry constraints:**
- `budget` - budżet
- `timeline` - horyzont czasowy
- `resources` - dostępne zasoby

**Zwraca:**
```typescript
{
    initiatives: Array<{
        name: string;
        description: string;
        targetAxes: string[];
        priority: 'HIGH' | 'MEDIUM' | 'LOW';
        estimatedDuration: string;
        estimatedBudget: string;
        expectedImpact: string;
        dependencies: string[];
    }>;
}
```

#### `prioritizeInitiatives(initiatives, criteria)`
Priorytetyzuje listę inicjatyw.

#### `estimateInitiativeROI(initiative, context)`
Szacuje ROI dla inicjatywy.

---

## Frontend Hook: `useAssessmentAI`

### Użycie

```typescript
import { useAssessmentAI } from '../hooks/useAssessmentAI';

const MyComponent = ({ projectId }) => {
    const ai = useAssessmentAI(projectId);
    
    // Suggestions
    const handleSuggest = async () => {
        const result = await ai.suggestJustification('processes', 3);
        console.log(result.suggestion);
    };
    
    // Check loading state
    if (ai.isLoading) {
        return <Loader />;
    }
    
    // Handle errors
    if (ai.error) {
        return <Error message={ai.error} onDismiss={ai.clearError} />;
    }
    
    return (
        <button onClick={handleSuggest}>
            Zasugeruj uzasadnienie
        </button>
    );
};
```

### Dostępne metody

| Metoda | Opis |
|--------|------|
| `suggestJustification(axisId, score, existingText?)` | Sugeruje uzasadnienie |
| `suggestEvidence(axisId, score)` | Sugeruje dowody |
| `suggestTarget(axisId, currentScore, ambitionLevel?)` | Sugeruje cel |
| `correctText(text, language?)` | Koryguje tekst |
| `autocomplete(partialText, axisId, score)` | Autouzupełnia |
| `validateField(fieldType, value, context?)` | Waliduje pole |
| `validateConsistency()` | Sprawdza spójność |
| `getGuidance(axisId, currentScore, targetScore?)` | Pobiera wskazówki |
| `generateGapAnalysis(axisId, currentScore, targetScore)` | Analizuje lukę |
| `getInsights()` | Pobiera wglądy |
| `generateExecutiveSummary(options?)` | Generuje podsumowanie |
| `generateStakeholderView(stakeholderRole)` | Widok interesariusza |
| `generateInitiatives(constraints?)` | Generuje inicjatywy |
| `prioritizeInitiatives(initiatives, criteria?)` | Priorytetyzuje |
| `estimateROI(initiative)` | Szacuje ROI |
| `getQuickActions(formState)` | Quick actions |
| `getContextualHelp(formState)` | Pomoc kontekstowa |
| `fillMissingFields(strategy?)` | Wypełnia brakujące |
| `reviewJustifications()` | Przegląda uzasadnienia |

### Stan

| Pole | Typ | Opis |
|------|-----|------|
| `isLoading` | `boolean` | Czy trwa zapytanie |
| `error` | `string \| null` | Komunikat błędu |
| `lastSuggestion` | `AISuggestion \| null` | Ostatnia sugestia |
| `lastValidation` | `AIValidation \| null` | Ostatnia walidacja |
| `insights` | `AIInsight[]` | Wglądy |
| `gapAnalysis` | `AIGapAnalysis \| null` | Analiza luki |
| `executiveSummary` | `AIExecutiveSummary \| null` | Podsumowanie |
| `initiatives` | `AIInitiative[]` | Inicjatywy |
| `quickActions` | `QuickAction[]` | Szybkie akcje |

---

## API Endpoints

### Podstawowe

| Endpoint | Metoda | Opis |
|----------|--------|------|
| `/api/assessment/:projectId/ai/guidance` | POST | Wskazówki dla osi |
| `/api/assessment/:projectId/ai/validate` | POST | Walidacja spójności |
| `/api/assessment/:projectId/ai/gap/:axisId` | POST | Analiza luki |
| `/api/assessment/:projectId/ai/insights` | GET | Wglądy |
| `/api/assessment/:projectId/ai/clarify` | POST | Pytanie wyjaśniające |

### Wsparcie formularzy

| Endpoint | Metoda | Opis |
|----------|--------|------|
| `/api/assessment/:projectId/ai/suggest-justification` | POST | Sugestia uzasadnienia |
| `/api/assessment/:projectId/ai/suggest-evidence` | POST | Sugestia dowodów |
| `/api/assessment/:projectId/ai/suggest-target` | POST | Sugestia celu |
| `/api/assessment/:projectId/ai/correct-text` | POST | Korekta tekstu |
| `/api/assessment/:projectId/ai/autocomplete` | POST | Autouzupełnianie |

### Raporty

| Endpoint | Metoda | Opis |
|----------|--------|------|
| `/api/assessment/:projectId/ai/executive-summary` | POST | Podsumowanie wykonawcze |
| `/api/assessment/:projectId/ai/stakeholder-view` | POST | Widok interesariusza |
| `/api/assessment/:projectId/ai/benchmark-commentary` | POST | Komentarz benchmarkowy |

### Inicjatywy

| Endpoint | Metoda | Opis |
|----------|--------|------|
| `/api/assessment/:projectId/ai/generate-initiatives` | POST | Generowanie inicjatyw |
| `/api/assessment/:projectId/ai/prioritize-initiatives` | POST | Priorytetyzacja |
| `/api/assessment/:projectId/ai/estimate-roi` | POST | Szacowanie ROI |

### Operacje batch

| Endpoint | Metoda | Opis |
|----------|--------|------|
| `/api/assessment/:projectId/ai/fill-missing` | POST | Wypełnianie brakujących pól |
| `/api/assessment/:projectId/ai/review-justifications` | POST | Przegląd uzasadnień |
| `/api/assessment/:projectId/ai/contextual-help` | POST | Pomoc kontekstowa |
| `/api/assessment/:projectId/ai/quick-actions` | POST | Szybkie akcje |
| `/api/assessment/:projectId/ai/validate-field` | POST | Walidacja pola |

---

## Konfiguracja

### Zmienne środowiskowe

```bash
# Google AI API Key (jeden z tych)
GOOGLE_AI_API_KEY=your-api-key
GEMINI_API_KEY=your-api-key
```

### Konfiguracja AI Partner

```javascript
const AI_PARTNER_CONFIG = {
    mode: 'THINKING_PARTNER',
    
    allowed: [
        'ASK_CLARIFYING_QUESTION',
        'EXPLAIN_WHY_ASKING',
        'REFLECT_BACK',
        'SURFACE_TENSION',
        'PROPOSE_AXIS',
        'VALIDATE_SCORE',
        'SUGGEST_EVIDENCE',
        'BENCHMARK_CONTEXT',
        'GAP_ANALYSIS',
        'PATHWAY_SUGGESTION'
    ],
    
    blocked: [
        'JUMP_TO_CONCLUSION',
        'SUMMARIZE_PREMATURELY',
        'SUGGEST_SOLUTION',
        'EVALUATE_ANSWERS'
    ],
    
    tone: {
        style: 'partner',
        formality: 'professional',
        length: 'concise',
        language: 'pl'
    }
};
```

---

## Osie DRD

| ID | Nazwa | Opis |
|----|-------|------|
| `processes` | Digital Processes | Poziom automatyzacji i digitalizacji procesów |
| `digitalProducts` | Digital Products & Services | Cyfrowe możliwości produktów/usług |
| `businessModels` | Digital Business Models | Cyfrowe modele biznesowe |
| `dataManagement` | Data & Analytics | Dojrzałość infrastruktury danych |
| `culture` | Organizational Culture | Kultura digital-first |
| `cybersecurity` | Cybersecurity & Risk | Bezpieczeństwo i zarządzanie ryzykiem |
| `aiMaturity` | AI & Machine Learning | Adopcja AI/ML |

### Poziomy dojrzałości (1-7)

1. Brak/podstawowy
2. Początkowa digitalizacja
3. Dedykowane narzędzia
4. Integracja i automatyzacja
5. Zaawansowane możliwości
6. AI/autonomizacja
7. Pełna autonomia

---

## Best Practices

### 1. Obsługa błędów

```typescript
const ai = useAssessmentAI(projectId);

try {
    const result = await ai.suggestJustification(axis, score);
    // handle success
} catch (err) {
    if (err.name === 'AbortError') {
        // Request was cancelled - ignore
        return;
    }
    console.error('AI error:', err);
}
```

### 2. Debouncing dla autocomplete

```typescript
import { useMemo } from 'react';
import debounce from 'lodash/debounce';

const debouncedAutocomplete = useMemo(
    () => debounce((text) => ai.autocomplete(text, axis, score), 500),
    [ai, axis, score]
);
```

### 3. Fallback graceful degradation

Wszystkie metody AI mają wbudowany fallback gdy API jest niedostępne:

```javascript
if (!this.model) {
    return { 
        suggestion: this._getFallbackJustification(axisId, score),
        mode: 'FALLBACK'
    };
}
```

### 4. Kontekstowe wzbogacenie

Zawsze przekazuj maksymalny kontekst dla lepszych wyników:

```typescript
const result = await ai.suggestJustification(axis, score, existingText);
// existingText pozwala AI na rozbudowę istniejącego tekstu
```

---

## Rozszerzalność

### Dodawanie nowych funkcji AI

1. Dodaj metodę w `aiAssessmentPartnerService.js`
2. Dodaj endpoint w `routes/assessment.js`
3. Dodaj metodę w `useAssessmentAI.ts`
4. Zintegruj w komponentach UI

### Przykład:

```javascript
// Backend
async analyzeTrend(assessmentHistory) {
    const prompt = `Analyze trend...`;
    const result = await this.model.generateContent(prompt);
    return { trend: result.response.text() };
}

// Route
router.post('/:projectId/ai/analyze-trend', verifyToken, async (req, res) => {
    const result = await aiAssessmentPartner.analyzeTrend(req.body.history);
    res.json(result);
});

// Hook
const analyzeTrend = useCallback(async (history) => {
    return apiCall('/ai/analyze-trend', 'POST', { history });
}, [apiCall]);
```

---

---

## Dodatkowe Komponenty

### AIAssessmentSidebar

Kontekstowy panel AI dla assessment z trzema zakładkami:

```typescript
import { AIAssessmentSidebar } from './components/assessment/AIAssessmentSidebar';

<AIAssessmentSidebar
    projectId={projectId}
    currentAxis="processes"
    currentScore={3}
    targetScore={5}
    isOpen={true}
    onClose={() => setOpen(false)}
    onApplySuggestion={(text) => setJustification(text)}
    onNavigateToAxis={(axisId) => navigateTo(axisId)}
/>
```

**Zakładki:**
1. **Insighty** - Proaktywne wglądy z oceny
2. **Sugestie** - Quick actions AI (sugestie, dowody, cele)
3. **Gap** - Analiza luki z pathway

### AIAssessmentReportGenerator

Dedykowany serwis do generowania raportów:

```javascript
const { aiAssessmentReportGenerator, REPORT_TYPES, STAKEHOLDER_ROLES } = 
    require('./services/aiAssessmentReportGenerator');

// Typy raportów
REPORT_TYPES = {
    EXECUTIVE_SUMMARY: 'executive_summary',
    FULL_ASSESSMENT: 'full_assessment',
    STAKEHOLDER_VIEW: 'stakeholder_view',
    BENCHMARK_COMPARISON: 'benchmark_comparison',
    GAP_ANALYSIS: 'gap_analysis',
    TRANSFORMATION_ROADMAP: 'transformation_roadmap',
    INITIATIVE_PLAN: 'initiative_plan'
};

// Role interesariuszy
STAKEHOLDER_ROLES = {
    CTO: 'CTO',
    CFO: 'CFO',
    COO: 'COO',
    CEO: 'CEO',
    BOARD: 'BOARD',
    PROJECT_MANAGER: 'PROJECT_MANAGER',
    CONSULTANT: 'CONSULTANT'
};
```

**Metody:**
- `generateFullReport(assessment, options)` - Pełny raport ze wszystkimi sekcjami
- `generateStakeholderReport(assessment, stakeholderRole, options)` - Widok dla interesariusza
- `generateBenchmarkReport(assessment, benchmarks, options)` - Porównanie z branżą
- `generateInitiativePlan(assessment, constraints, options)` - Plan inicjatyw z timeline

### Integracja z Chat (AIContext)

Rozszerzony kontekst dla rozmów o assessment:

```typescript
const { 
    assessmentContext,
    updateAssessmentContext,
    requestAssessmentGuidance,
    requestGapAnalysis 
} = useAIContext();

// Aktualizuj kontekst przy zmianie osi
updateAssessmentContext({
    currentAxis: 'processes',
    currentScore: 3,
    targetScore: 5
});

// Otwórz chat z guidance dla osi
requestAssessmentGuidance('processes');

// Otwórz chat z analizą luk
requestGapAnalysis();
```

---

## Nowe API Endpoints (Report Generator)

| Endpoint | Metoda | Opis |
|----------|--------|------|
| `/api/assessment/:projectId/ai/reports/full` | POST | Pełny raport assessment |
| `/api/assessment/:projectId/ai/reports/stakeholder` | POST | Raport dla interesariusza |
| `/api/assessment/:projectId/ai/reports/benchmark` | POST | Raport benchmarkowy |
| `/api/assessment/:projectId/ai/reports/initiative-plan` | POST | Plan inicjatyw |
| `/api/assessment/:projectId/ai/reports/types` | GET | Dostępne typy raportów |

---

## Komponenty Frontend

### AIAssessmentSidebar

Kontekstowy panel AI zintegrowany z `FullAssessmentView`:

```tsx
<AIAssessmentSidebar
    projectId={projectId}
    currentAxis={currentAxisId}
    currentScore={axisData?.actual}
    targetScore={axisData?.target}
    isOpen={isAISidebarOpen}
    onClose={() => setIsAISidebarOpen(false)}
    onApplySuggestion={(suggestion) => handleUpdate(suggestion)}
    onNavigateToAxis={(axisId) => navigateTo(axisId)}
/>
```

**Funkcje:**
- Zakładki: Insights, Suggestions, Gap Analysis
- Quick Actions z AI
- Integracja z `useAssessmentAI` hook

### useAssessmentWorkflow Hook

Zarządzanie stanem workflow:

```tsx
const {
    workflowStatus,
    reviews,
    versions,
    submitForReview,
    approve,
    reject,
    restoreVersion
} = useAssessmentWorkflow(assessmentId);
```

### AssessmentVersionHistory

Lista wersji z opcjami View, Compare, Restore.

### AssessmentVersionDiff

Porównanie side-by-side dwóch wersji assessment.

### ReviewerDashboard

Dashboard dla recenzentów z listą pending reviews i statystykami.

### MyAssessmentsList

Lista wszystkich ocen użytkownika z filtrami i akcjami.

---

## Changelog

### v1.2.0 (2024-12)
- **NEW:** useAssessmentWorkflow hook - zarządzanie workflow
- **NEW:** AssessmentVersionHistory - historia wersji
- **NEW:** AssessmentVersionDiff - porównanie wersji
- **NEW:** ReviewerDashboard - panel recenzenta
- **NEW:** MyAssessmentsList - lista ocen użytkownika
- **NEW:** AI Sidebar integration w FullAssessmentView
- **NEW:** AppView.MY_ASSESSMENTS i AppView.REVIEWER_DASHBOARD
- **NEW:** Linki w Sidebar do nowych widoków
- **UPDATED:** TypeScript types dla workflow

### v1.1.0 (2024-12)
- **NEW:** AIAssessmentSidebar - kontekstowy panel AI
- **NEW:** AIAssessmentReportGenerator - dedykowany serwis raportów
- **NEW:** Integracja z ChatPanel via AIContext
- **NEW:** Assessment context w globalnym stanie AI
- **NEW:** 5 nowych endpointów dla raportów

### v1.0.0 (2024-12)
- Initial release
- Form assistance (suggestions, evidence, targets)
- Validation and consistency checks
- Gap analysis with pathways
- Executive summary and stakeholder views
- Initiative generation and prioritization
- ROI estimation
- Frontend hook integration

