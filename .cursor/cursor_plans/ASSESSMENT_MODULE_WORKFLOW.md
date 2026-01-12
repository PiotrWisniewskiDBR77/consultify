# 📋 Assessment Module - Workflow & Standards

> **Wersja:** 2.0  
> **Data:** 25 grudnia 2025  
> **Status:** ✅ 100% Complete  
> **Projekt:** ANTYGRACITY Consultify  

---

## 📊 Quick Stats

| Kategoria | Ilość |
|-----------|-------|
| Komponenty Frontend | 31 |
| Backend Services | 12+ |
| API Endpoints | 48+ |
| AI Functions | 26 |
| React Hooks | 3 |
| Database Tables | 9 |

**Powiązana dokumentacja:**
- `.cursor/ASSESSMENT_MODULE_COMPLETE.md` - Pełna dokumentacja techniczna
- `.cursor/AI_ASSESSMENT_SYSTEM.md` - Dokumentacja systemu AI
- `.cursor/rules/assessment-module.mdc` - Reguły dla developerów
- `.cursor/rules/ai-assessment.mdc` - Reguły dla AI

---

## 📑 Spis Treści

1. [Przegląd Modułu](#przegląd-modułu)
2. [Architektura DRD](#architektura-drd)
3. [Workflow Oceny](#workflow-oceny)
4. [Role i Uprawnienia](#role-i-uprawnienia)
5. [Zasady Pracy](#zasady-pracy)
6. [Stage Gates](#stage-gates)
7. [Wersjonowanie](#wersjonowanie)
8. [System Komentarzy](#system-komentarzy)
9. [AI Thinking Partner](#ai-thinking-partner)
10. [Raporty Enterprise](#raporty-enterprise)
11. [Real-time Collaboration](#real-time-collaboration)
12. [API Reference](#api-reference)
13. [Komponenty Frontend](#komponenty-frontend)
14. [Best Practices](#best-practices)

---

## 1. Przegląd Modułu

### Cel
Moduł Assessment służy do przeprowadzania **Digital Readiness Diagnosis (DRD)** - kompleksowej oceny dojrzałości cyfrowej organizacji w 7 kluczowych wymiarach.

### Kluczowe Funkcjonalności
- ✅ Ocena 7 osi dojrzałości cyfrowej
- ✅ Multi-stakeholder review process
- ✅ AI-powered guidance (Thinking Partner)
- ✅ Enterprise workflow z approval gates
- ✅ Wersjonowanie i historia zmian
- ✅ Eksport raportów PDF/Excel
- ✅ Real-time collaboration
- ✅ **Initiative Generator** - transformacja gaps w inicjatywy

---

## 2. Architektura DRD

### 7 Osi Dojrzałości Cyfrowej

| # | Oś | ID | Opis |
|---|----|----|------|
| 1 | **Digital Processes** | `processes` | Automatyzacja i cyfryzacja procesów biznesowych |
| 2 | **Digital Products** | `digitalProducts` | Produkty i usługi cyfrowe |
| 3 | **Business Models** | `businessModels` | Cyfrowe modele biznesowe |
| 4 | **Data Management** | `dataManagement` | Zarządzanie danymi i analityka |
| 5 | **Culture** | `culture` | Kultura organizacyjna i kompetencje |
| 6 | **Cybersecurity** | `cybersecurity` | Bezpieczeństwo cyfrowe |
| 7 | **AI Maturity** | `aiMaturity` | Dojrzałość w wykorzystaniu AI |

### Skala Oceny

Każda oś oceniana jest w skali **1-7**:

| Poziom | Nazwa | Opis |
|--------|-------|------|
| 1 | **Initial** | Brak formalnych procesów, działania ad-hoc |
| 2 | **Emerging** | Pierwsze inicjatywy, brak standaryzacji |
| 3 | **Defined** | Udokumentowane procesy, podstawowa standaryzacja |
| 4 | **Managed** | Mierzone i zarządzane procesy |
| 5 | **Optimized** | Ciągłe doskonalenie, data-driven |
| 6 | **Advanced** | Zaawansowana automatyzacja, integracja |
| 7 | **Leading** | Innowacje, przewaga konkurencyjna |

### Struktura Oceny Osi

```typescript
interface AxisAssessment {
  axisId: string;           // np. 'processes'
  actualScore: number;      // 1-7, stan obecny
  targetScore: number;      // 1-7, cel do osiągnięcia
  justification: string;    // uzasadnienie oceny (wymagane)
  evidence: string[];       // dowody wspierające ocenę
  priority: 'HIGH' | 'MEDIUM' | 'LOW';  // priorytet poprawy
  timeline: string;         // planowany czas realizacji
}
```

---

## 3. Workflow Oceny

### Diagram Stanów

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  ┌──────────┐    Submit    ┌───────────────┐    All Reviews    ┌───────────────────┐
│  │  DRAFT   │  ────────►   │   IN_REVIEW   │   ───────────►    │ AWAITING_APPROVAL │
│  └──────────┘              └───────────────┘                   └───────────────────┘
│       ▲                          │                                      │
│       │                          │                                      │
│       │                          │ Reject                               │ Approve
│       │                          ▼                                      ▼
│       │                    ┌──────────┐                          ┌──────────┐
│       └────────────────────│ REJECTED │                          │ APPROVED │
│         Revise & Resubmit  └──────────┘                          └──────────┘
│                                                                         │
│                                                                         │ Archive
│                                                                         ▼
│                                                                   ┌──────────┐
│                                                                   │ ARCHIVED │
│                                                                   └──────────┘
└─────────────────────────────────────────────────────────────────────────┘
```

### Statusy Workflow

| Status | Opis | Możliwe Akcje |
|--------|------|---------------|
| `DRAFT` | Wersja robocza, w edycji | Edycja, Save, Submit for Review |
| `IN_REVIEW` | Przesłany do recenzji stakeholderów | Add Comments, Submit Review |
| `AWAITING_APPROVAL` | Wszystkie recenzje zakończone | Approve, Reject |
| `APPROVED` | Zatwierdzony | Export, Archive |
| `REJECTED` | Odrzucony z feedbackiem | Revise, Resubmit |
| `ARCHIVED` | Zarchiwizowana wersja historyczna | View Only |

### Przejścia Statusów

| Z → Do | Warunki | Wykonuje |
|--------|---------|----------|
| DRAFT → IN_REVIEW | Wszystkie osie ocenione, uzasadnienia wypełnione | Assessment Owner |
| IN_REVIEW → AWAITING_APPROVAL | Min. 2 recenzje zakończone | System (auto) |
| AWAITING_APPROVAL → APPROVED | Decyzja PM/Approver | Project Manager |
| AWAITING_APPROVAL → REJECTED | Decyzja PM/Approver + powód | Project Manager |
| REJECTED → DRAFT | Rewizja zakończona | Assessment Owner |
| APPROVED → ARCHIVED | Nowa wersja zatwierdzona | System (auto) |

---

## 4. Role i Uprawnienia

### Matryca Ról

| Rola | Create | Edit | View | Submit | Review | Approve | Export |
|------|--------|------|------|--------|--------|---------|--------|
| **ADMIN** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **PROJECT_MANAGER** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **CONSULTANT** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| **STAKEHOLDER** | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ |
| **VIEWER** | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |

### Opis Ról

| Rola | Odpowiedzialności |
|------|-------------------|
| **Assessment Owner** | Tworzenie i edycja oceny, przesyłanie do recenzji |
| **Reviewer/Stakeholder** | Recenzja oceny, dodawanie komentarzy, rekomendacje |
| **Approver (PM)** | Finalne zatwierdzenie lub odrzucenie |
| **Viewer** | Tylko przeglądanie zatwierdzonych ocen |

---

## 5. Zasady Pracy

### 5.1 Tworzenie Assessment

**ZASADA #1: Kompletność**
> Każda oś MUSI mieć wypełnione:
> - Ocenę aktualną (1-7)
> - Ocenę docelową (1-7)
> - Uzasadnienie (min. 100 znaków)

**ZASADA #2: Spójność**
> Oceny między osiami powinny być logicznie spójne.
> AI Thinking Partner automatycznie waliduje spójność.

**ZASADA #3: Dowody**
> Każda ocena powinna być poparta konkretnymi dowodami (dokumenty, wywiady, obserwacje).

### 5.2 Proces Recenzji

**ZASADA #4: Minimum 2 Recenzentów**
> Każdy assessment wymaga minimum 2 niezależnych recenzji przed zatwierdzeniem.

**ZASADA #5: Konstruktywny Feedback**
> Komentarze muszą być konstruktywne i wskazywać konkretne sugestie poprawy.

**ZASADA #6: Terminowość**
> Recenzje powinny być zakończone w ciągu 14 dni od przesłania.

### 5.3 Zatwierdzanie

**ZASADA #7: Świadoma Decyzja**
> Approver musi przeczytać wszystkie komentarze recenzentów przed decyzją.

**ZASADA #8: Uzasadnienie Odrzucenia**
> Odrzucenie MUSI zawierać konkretne wskazówki co wymaga poprawy.

### 5.4 Wersjonowanie

**ZASADA #9: Automatyczne Wersje**
> Każde Submit for Review tworzy nową wersję.
> Wersje są immutable (nie można edytować historycznych wersji).

**ZASADA #10: Restore = Nowa Wersja**
> Przywrócenie starej wersji tworzy nową wersję (nie nadpisuje).

---

## 6. Stage Gates

### Integracja z Workflow Projektu

Assessment Module integruje się z Stage Gate system projektu ANTYGRACITY:

```
Phase 1: Discovery → [GATE 1] → Phase 2: Analysis → [GATE 2] → ...
                         ↑
                    Assessment
                    Required
```

### Kryteria Gate dla Assessment

| Gate | Wymagania Assessment |
|------|---------------------|
| **Gate 1: Discovery → Analysis** | Assessment zainicjalizowany |
| **Gate 2: Analysis → Planning** | Assessment APPROVED |
| **Gate 3: Planning → Execution** | Gap Analysis zakończona |
| **Gate 4: Execution → Optimization** | Min. 50% gap closed |
| **Gate 5: Optimization → Close** | Target levels achieved |

### Komponent UI

```typescript
// AssessmentStageGate.tsx
interface StageGateProps {
  assessmentId: string;
  currentPhase: Phase;
  nextPhase: Phase;
  gateStatus: 'READY' | 'NOT_READY';
  completionCriteria: GateCriterion[];
  onPassGate: (notes: string) => void;
}
```

---

## 7. Wersjonowanie

### Model Wersji

```typescript
interface AssessmentVersion {
  id: string;
  assessmentId: string;
  version: number;              // 1, 2, 3...
  assessmentData: object;       // Pełny snapshot oceny
  changeSummary: string;        // Opis zmian
  changedAxes: string[];        // Lista zmienionych osi
  createdBy: string;
  createdAt: Date;
}
```

### Kiedy Tworzona Jest Nowa Wersja

| Akcja | Nowa Wersja? |
|-------|--------------|
| Save Draft | ❌ (nadpisuje draft) |
| Submit for Review | ✅ |
| Approve | ❌ |
| Reject | ❌ |
| Restore Previous Version | ✅ |
| Manual Version Save | ✅ |

### Porównywanie Wersji

Frontend umożliwia porównanie dowolnych dwóch wersji z podświetleniem różnic:

```
Version 3                     Version 5
─────────                     ─────────
Processes: 3 → 4             Processes: 4 (changed ↑)
Culture: 2                   Culture: 3 (changed ↑)
AI: 2                        AI: 2 (unchanged)
```

---

## 8. System Komentarzy

### Struktura Komentarzy

```typescript
interface AxisComment {
  id: string;
  assessmentId: string;
  axisId: string;              // np. 'processes'
  userId: string;
  comment: string;
  parentCommentId?: string;    // Dla wątków (replies)
  isResolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
  createdAt: Date;
}
```

### Zasady Komentowania

| Zasada | Opis |
|--------|------|
| **Kontekst** | Komentarze są przypisane do konkretnej osi |
| **Wątki** | Max 3 poziomy zagnieżdżenia (reply to reply) |
| **Rozwiązywanie** | Komentarze mogą być oznaczone jako "Resolved" |
| **Widoczność** | Wszystkie komentarze widoczne dla wszystkich uczestników |

### Flow Komentowania

```
1. Reviewer klika na oś "Digital Processes"
2. Otwiera się panel komentarzy dla tej osi
3. Dodaje komentarz: "Ocena 4 wydaje się zbyt optymistyczna..."
4. Owner odpowiada (reply)
5. Reviewer oznacza jako Resolved lub kontynuuje dyskusję
```

---

## 9. AI Thinking Partner

### Tryby AI

| Tryb | Opis | Endpoint |
|------|------|----------|
| **Guidance** | Pomoc w ocenie konkretnej osi | `/ai/guidance` |
| **Validation** | Sprawdzenie spójności między osiami | `/ai/validate` |
| **Gap Analysis** | Szczegółowa analiza luk | `/ai/gap/:axisId` |
| **Insights** | Proaktywne spostrzeżenia i rekomendacje | `/ai/insights` |
| **Clarification** | Pytania pogłębiające | `/ai/clarify` |

### Przykład Interakcji

```
User: Oceniłem "Digital Processes" na 3, ale nie jestem pewien...

AI (Guidance):
┌────────────────────────────────────────────────────────────┐
│ 🤔 Kilka pytań pomocniczych:                               │
│                                                            │
│ 1. Czy procesy są udokumentowane w formalny sposób?        │
│ 2. Czy istnieją KPI dla procesów cyfrowych?                │
│ 3. Jaki % procesów jest zautomatyzowany?                   │
│                                                            │
│ 📊 Dla oceny 3 (Defined) typowe wskaźniki to:              │
│ • 20-40% procesów udokumentowanych                         │
│ • Podstawowe narzędzia workflow                            │
│ • Brak zaawansowanej automatyzacji                         │
│                                                            │
│ 💡 Sugestia: Rozważ zwiększenie do 4, jeśli macie          │
│    wdrożone systemy ERP/MES z integracją.                  │
└────────────────────────────────────────────────────────────┘
```

### Automatyczne Walidacje AI

AI automatycznie wykrywa:
- ❌ Niespójności (np. AI Maturity=6, Data Management=2)
- ❌ Brakujące uzasadnienia
- ❌ Zbyt optymistyczne oceny bez dowodów
- ⚠️ Potencjalne obszary do weryfikacji

---

## 10. Raporty Enterprise

### Formaty Eksportu

| Format | Zawartość | Use Case |
|--------|-----------|----------|
| **PDF** | Pełny raport z wykresami | Prezentacje, archiwum |
| **Excel** | Dane tabelaryczne, raw data | Dalsze analizy, import |

### Struktura Raportu PDF

```
┌─────────────────────────────────────────────┐
│ 1. COVER PAGE                               │
│    - Logo, tytuł, data, organizacja         │
├─────────────────────────────────────────────┤
│ 2. EXECUTIVE SUMMARY                        │
│    - Kluczowe KPI (avg score, gap, etc.)    │
│    - High-level insights                    │
├─────────────────────────────────────────────┤
│ 3. MATURITY OVERVIEW                        │
│    - Radar chart 7 osi                      │
│    - Bar chart actual vs target             │
├─────────────────────────────────────────────┤
│ 4. AXIS DETAILS (x7)                        │
│    - Score, justification, evidence         │
│    - Benchmarks vs industry                 │
├─────────────────────────────────────────────┤
│ 5. GAP ANALYSIS                             │
│    - Priority matrix                        │
│    - Recommended actions                    │
├─────────────────────────────────────────────┤
│ 6. RECOMMENDATIONS                          │
│    - Quick wins                             │
│    - Strategic initiatives                  │
├─────────────────────────────────────────────┤
│ 7. APPENDIX                                 │
│    - Methodology                            │
│    - Definitions                            │
│    - Reviewer comments                      │
└─────────────────────────────────────────────┘
```

### Struktura Excel Export

| Sheet | Zawartość |
|-------|-----------|
| **Summary** | Overview KPI |
| **Axis Details** | Wszystkie osie z ocenami |
| **Gap Analysis** | Luki i priorytety |
| **Recommendations** | Rekomendacje |
| **Comments** | Komentarze recenzentów |
| **Raw Data** | JSON data do dalszych analiz |

---

## 11. Real-time Collaboration

### Funkcjonalności

| Feature | Opis |
|---------|------|
| **Presence Indicators** | Widzisz kto aktualnie przegląda assessment |
| **Activity Feed** | Live stream akcji innych użytkowników |
| **Axis Indicators** | Widzisz na której osi ktoś pracuje |
| **Notifications** | Powiadomienia o komentarzach, statusach |

### Hook React

```typescript
const {
  collaborators,       // Lista online users
  activities,          // Activity feed
  isConnected,         // Status połączenia
  setCurrentAxis,      // Ustaw obecną oś (dla presence)
  notifyAxisUpdate,    // Powiadom o zmianie osi
  notifyCommentAdded,  // Powiadom o komentarzu
} = useAssessmentCollaboration({
  assessmentId: 'xxx',
  projectId: 'yyy',
  enablePolling: true,
  pollingInterval: 5000
});
```

### UI Components

```tsx
// Pasek z avatarami obecnych użytkowników
<PresenceIndicator 
  collaborators={collaborators} 
  maxVisible={4} 
/>

// Feed aktywności
<ActivityFeed 
  activities={activities} 
  maxItems={10} 
/>
```

---

## 12. API Reference

### Base URL
```
/api/assessment-workflow
```

### Endpoints

| Method | Endpoint | Opis |
|--------|----------|------|
| GET | `/:assessmentId/status` | Status workflow |
| POST | `/:assessmentId/initialize` | Inicjalizuj workflow |
| POST | `/:assessmentId/submit-for-review` | Wyślij do recenzji |
| GET | `/pending-reviews` | Lista oczekujących recenzji |
| POST | `/reviews/:reviewId/submit` | Zatwierdź recenzję |
| POST | `/:assessmentId/approve` | Zatwierdź assessment |
| POST | `/:assessmentId/reject` | Odrzuć assessment |
| GET | `/:assessmentId/comments` | Pobierz komentarze |
| POST | `/:assessmentId/comments` | Dodaj komentarz |
| GET | `/:assessmentId/versions` | Historia wersji |
| POST | `/:assessmentId/restore/:version` | Przywróć wersję |
| POST | `/:assessmentId/export/pdf` | Eksport PDF |
| POST | `/:assessmentId/export/excel` | Eksport Excel |
| POST | `/:assessmentId/presence` | Update presence |
| GET | `/:assessmentId/activities` | Activity feed |

### AI Endpoints

| Method | Endpoint | Opis |
|--------|----------|------|
| POST | `/:assessmentId/ai/guidance` | AI guidance dla osi |
| POST | `/:assessmentId/ai/validate` | Walidacja spójności |
| POST | `/:assessmentId/ai/gap/:axisId` | Gap analysis |
| POST | `/:assessmentId/ai/insights` | Proaktywne insights |
| POST | `/:assessmentId/ai/clarify` | Pytania wyjaśniające |

---

## 13. Komponenty Frontend

### Hierarchia Komponentów

```
FullAssessmentView
├── AssessmentWorkflowPanel      # Status i akcje workflow
├── AIAssessmentSidebar          # AI Sidebar z sugestiami
├── DRDRadarChart                # Wizualizacja 7 osi
├── AxisAssessmentCard (x7)      # Karty oceny każdej osi
│   └── AxisCommentsPanel        # Komentarze dla osi
├── AssessmentStageGate          # Stage Gate UI
├── AIThinkingPartnerChat        # Panel AI
└── PresenceIndicator            # Współpraca real-time
    └── ActivityFeed

MyAssessmentsList                # Lista ocen użytkownika
├── FilterPanel                  # Filtry: status, typ, data
├── AssessmentRow                # Wiersz z akcjami
└── DeleteConfirmModal           # Potwierdzenie usunięcia

ReviewerDashboard                # Panel recenzenta
├── StatsCards                   # Statystyki
├── TabNavigation                # Zakładki statusów
└── ReviewCard                   # Karta recenzji

AssessmentVersionHistory         # Historia wersji
├── VersionRow                   # Wiersz wersji
└── VersionDetails               # Szczegóły wersji

AssessmentVersionDiff            # Porównanie wersji
├── DiffHeader                   # Nagłówek porównania
├── AxisDiffRow                  # Różnice per oś
└── JustificationDiff            # Diff uzasadnień
```

### Kluczowe Komponenty

| Komponent | Plik | Opis |
|-----------|------|------|
| `AssessmentWorkflowPanel` | `components/assessment/AssessmentWorkflowPanel.tsx` | Główny panel workflow |
| `AxisCommentsPanel` | `components/assessment/AxisCommentsPanel.tsx` | System komentarzy |
| `AssessmentStageGate` | `components/assessment/AssessmentStageGate.tsx` | Stage Gate UI |
| `AIAssessmentSidebar` | `components/assessment/AIAssessmentSidebar.tsx` | AI Sidebar z insights |
| `AssessmentVersionHistory` | `components/assessment/AssessmentVersionHistory.tsx` | Historia wersji |
| `AssessmentVersionDiff` | `components/assessment/AssessmentVersionDiff.tsx` | Porównanie wersji |
| `ReviewerDashboard` | `components/assessment/ReviewerDashboard.tsx` | Panel recenzenta |
| `MyAssessmentsList` | `components/assessment/MyAssessmentsList.tsx` | Lista ocen użytkownika |
| `useAssessmentWorkflow` | `hooks/useAssessmentWorkflow.ts` | Hook zarządzania workflow |
| `useAssessmentCollaboration` | `hooks/useAssessmentCollaboration.tsx` | Hook real-time |
| `useAssessmentAI` | `hooks/useAssessmentAI.ts` | Hook AI dla assessment |

### Nowe AppView

| AppView | Opis |
|---------|------|
| `MY_ASSESSMENTS` | Lista ocen użytkownika |
| `REVIEWER_DASHBOARD` | Panel recenzenta |

---

## 14. Best Practices

### Dla Assessment Owners

1. ✅ **Przygotuj się przed sesją** - zbierz dokumenty, dane, wywiady
2. ✅ **Bądź realistyczny** - nie zawyżaj ocen bez dowodów
3. ✅ **Pisz szczegółowe uzasadnienia** - ułatwia to recenzentom
4. ✅ **Używaj AI Partner** - pomoże wykryć niespójności
5. ✅ **Reaguj na komentarze** - konstruktywna dyskusja poprawia jakość

### Dla Reviewers

1. ✅ **Przeczytaj całość** - nie komentuj fragmentarycznie
2. ✅ **Bądź konstruktywny** - wskazuj rozwiązania, nie tylko problemy
3. ✅ **Używaj komentarzy per oś** - ułatwia tracking
4. ✅ **Dotrzymuj terminów** - 14 dni max
5. ✅ **Oznaczaj resolved** - utrzymuj porządek w dyskusji

### Dla Approvers

1. ✅ **Przeczytaj wszystkie recenzje** - przed decyzją
2. ✅ **Weryfikuj uzasadnienia** - czy są poparte dowodami
3. ✅ **Przy odrzuceniu** - podaj konkretne wskazówki
4. ✅ **Używaj notes** - dokumentuj powód decyzji
5. ✅ **Monitoruj SLA** - reaguj na opóźnienia w recenzjach

### Dla Developerów

1. ✅ **Używaj RBAC middleware** - na każdym endpoint
2. ✅ **Loguj audit trail** - wszystkie akcje workflow
3. ✅ **Testuj state transitions** - wszystkie możliwe ścieżki
4. ✅ **Waliduj na backendzie** - nie ufaj frontendowi
5. ✅ **Obsługuj offline gracefully** - dla collaboration features

---

## 📚 Powiązana Dokumentacja

- [ENTERPRISE_SPEC.md](../docs/00_foundation/ENTERPRISE_SPEC.md) - Specyfikacja enterprise
- [ASSESSMENT_ENTERPRISE_WORKFLOW_IMPLEMENTATION.md](../docs/ASSESSMENT_ENTERPRISE_WORKFLOW_IMPLEMENTATION.md) - Szczegóły implementacji
- [DRD_METHODOLOGY.md](../docs/DRD_METHODOLOGY.md) - Metodologia DRD
- [API_REFERENCE.md](../docs/api/assessment-module-api.md) - Pełna dokumentacja API

---

## 🔄 Changelog

| Wersja | Data | Autor | Zmiany |
|--------|------|-------|--------|
| 1.0 | 2025-12-25 | Cursor AI | Initial version |

---

*Ten dokument jest standardem pracy dla modułu Assessment w projekcie ANTYGRACITY Consultify.*

