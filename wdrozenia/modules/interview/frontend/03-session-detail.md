# Interview – Session Detail (Workspace)

## Status: ✅ ZAIMPLEMENTOWANE

**Plik źródłowy:** `src/components/Interview/InterviewWorkspace.tsx`  
**Pattern:** ClickUp-like workspace z 4 tabami

---

## 📋 Opis

Widok szczegółowy sesji wywiadu - workspace do przeprowadzania wywiadu z:
- Listą pytań (task-list style)
- Notatkami
- Dowodami/załącznikami
- Podsumowaniem (FACTS ONLY)

---

## 🎨 Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ Session: Discovery Interview - Company X                    [Close] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐  ┌──────────────────────────────┐  ┌──────────┐  │
│  │              │  │                              │  │          │  │
│  │  Category    │  │  [Questions][Notes][Evidence]│  │ Company  │  │
│  │  Sidebar     │  │  [Summary]                   │  │ Facts    │  │
│  │              │  │                              │  │          │  │
│  │  ○ Strategy  │  │  ┌────────────────────────┐ │  │ Profile  │  │
│  │  ● Operations│  │  │ Question 1             │ │  │ ───────  │  │
│  │  ○ Digital   │  │  │ Status: In Progress    │ │  │ Industry │  │
│  │  ○ People    │  │  │ Confidence: ●●●○○      │ │  │ Size     │  │
│  │  ○ Finance   │  │  │                        │ │  │ Revenue  │  │
│  │              │  │  │ [Answer text area]     │ │  │          │  │
│  │  Progress    │  │  │                        │ │  │ Gaps     │  │
│  │  ████░░ 60%  │  │  └────────────────────────┘ │  │ ───────  │  │
│  │              │  │                              │  │ - Gap 1  │  │
│  │              │  │  ┌────────────────────────┐ │  │ - Gap 2  │  │
│  │              │  │  │ Question 2             │ │  │          │  │
│  │              │  │  │ Status: Answered ✓     │ │  │          │  │
│  │              │  │  └────────────────────────┘ │  │          │  │
│  │              │  │                              │  │          │  │
│  └──────────────┘  └──────────────────────────────┘  └──────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Komponenty

### InterviewWorkspace.tsx

```tsx
interface InterviewWorkspaceProps {
  sessionId: string;
  onClose: () => void;
}

export const InterviewWorkspace: React.FC<InterviewWorkspaceProps> = ({
  sessionId,
  onClose
}) => {
  const [activeCategory, setActiveCategory] = useState('strategy');
  const [activeTab, setActiveTab] = useState<'questions' | 'notes' | 'evidence' | 'summary'>('questions');
  
  // Pobierz dane sesji
  const { data: session, isLoading, error, refetch } = useInterviewSession(sessionId);
  const { data: questions } = useInterviewQuestions(sessionId);
  const { data: notes } = useInterviewNotes(sessionId);
  const { data: evidence } = useInterviewEvidence(sessionId);
  const { data: context } = useOrganizationContext();

  if (isLoading) return <WorkspaceLoading />;
  if (error) return <WorkspaceError error={error} onRetry={refetch} />;
  if (!session) return <WorkspaceNotFound />;

  return (
    <div className="flex h-full">
      {/* Category Sidebar */}
      <CategorySidebar
        categories={CATEGORIES}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        progress={calculateProgress(questions)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold">{session.name}</h2>
          <button onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          {['questions', 'notes', 'evidence', 'summary'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={cn(
                "px-4 py-2 capitalize",
                activeTab === tab && "border-b-2 border-blue-500"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {activeTab === 'questions' && (
            <QuestionsList
              questions={questions?.filter(q => q.category === activeCategory)}
              onQuestionUpdate={handleQuestionUpdate}
            />
          )}
          {activeTab === 'notes' && (
            <NotesPanel
              notes={notes}
              category={activeCategory}
              onNoteCreate={handleNoteCreate}
              onNoteUpdate={handleNoteUpdate}
              onNoteDelete={handleNoteDelete}
            />
          )}
          {activeTab === 'evidence' && (
            <EvidencePanel
              evidence={evidence}
              onUpload={handleEvidenceUpload}
              onDelete={handleEvidenceDelete}
            />
          )}
          {activeTab === 'summary' && (
            <SummaryView
              sessionId={sessionId}
              questions={questions}
            />
          )}
        </div>
      </div>

      {/* Company Facts Panel */}
      <CompanyFactsPanel context={context} />
    </div>
  );
};
```

### QuestionsList.tsx

```tsx
export const QuestionsList: React.FC<Props> = ({ questions, onQuestionUpdate }) => {
  if (!questions || questions.length === 0) {
    return (
      <div className="text-center py-8">
        <FileQuestion className="w-12 h-12 mx-auto text-gray-400" />
        <p>No questions in this category</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {questions.map(question => (
        <QuestionCard
          key={question.id}
          question={question}
          onUpdate={onQuestionUpdate}
        />
      ))}
    </div>
  );
};
```

### QuestionCard.tsx

```tsx
export const QuestionCard: React.FC<Props> = ({ question, onUpdate }) => {
  const [answer, setAnswer] = useState(question.answerText || '');
  const [status, setStatus] = useState(question.status);
  const [confidence, setConfidence] = useState(question.confidenceScore || 0);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await Api.patch(`/interview/questions/${question.id}`, {
        answerText: answer,
        status,
        confidenceScore: confidence
      });
      toast.success('Answer saved');
      onUpdate?.();
    } catch (err) {
      toast.error('Failed to save answer');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg">
      {/* Question Header */}
      <div className="flex items-start justify-between mb-3">
        <h4 className="font-medium">{question.questionText}</h4>
        <StatusBadge status={status} />
      </div>

      {/* Answer Area */}
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Enter your answer..."
        className="w-full p-3 border rounded-lg min-h-[100px]"
      />

      {/* Controls */}
      <div className="flex items-center justify-between mt-3">
        {/* Status Select */}
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-1 border rounded"
        >
          <option value="not_started">Not Started</option>
          <option value="in_progress">In Progress</option>
          <option value="answered">Answered</option>
          <option value="needs_follow_up">Needs Follow-up</option>
        </select>

        {/* Confidence */}
        <div className="flex items-center gap-2">
          <span className="text-sm">Confidence:</span>
          <ConfidenceSelector
            value={confidence}
            onChange={setConfidence}
          />
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
        </button>
      </div>
    </div>
  );
};
```

---

## 📊 Statusy Pytań

| Status | Ikona | Kolor | Opis |
|--------|-------|-------|------|
| `not_started` | ○ | Gray | Brak odpowiedzi |
| `in_progress` | ◐ | Blue | W trakcie |
| `answered` | ● | Green | Odpowiedziane |
| `needs_follow_up` | ⚠ | Orange | Wymaga follow-up |

---

## 🎯 Confidence Score

```tsx
const ConfidenceSelector: React.FC<Props> = ({ value, onChange }) => {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(level => (
        <button
          key={level}
          onClick={() => onChange(level)}
          className={cn(
            "w-4 h-4 rounded-full",
            level <= value ? "bg-blue-500" : "bg-gray-200"
          )}
        />
      ))}
    </div>
  );
};
```

---

## 📝 Summary View

⚠️ **WAŻNE:** Summary zawiera TYLKO FAKTY, bez rekomendacji!

```tsx
export const SummaryView: React.FC<Props> = ({ sessionId, questions }) => {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateSummary = async () => {
    setIsGenerating(true);
    try {
      const result = await Api.post(`/interview/sessions/${sessionId}/summary`);
      setSummary(result);
    } catch (err) {
      toast.error('Failed to generate summary');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div>
      {/* Warning */}
      <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg mb-4">
        <AlertTriangle className="w-5 h-5 text-amber-500" />
        <p className="text-sm text-amber-700">
          <strong>Facts only</strong> - This summary contains only factual findings, 
          no recommendations. Use Tools/Assessment for recommendations.
        </p>
      </div>

      {/* Generate Button */}
      <button
        onClick={generateSummary}
        disabled={isGenerating}
        className="px-4 py-2 bg-blue-500 text-white rounded-lg"
      >
        {isGenerating ? 'Generating...' : 'Generate Summary'}
      </button>

      {/* Summary Content */}
      {summary && (
        <div className="mt-4 space-y-4">
          {Object.entries(summary).map(([category, data]) => (
            <div key={category} className="p-4 border rounded-lg">
              <h4 className="font-bold capitalize">{category}</h4>
              <p>Completed: {data.completedQuestions}/{data.totalQuestions}</p>
              <p>Avg Confidence: {data.avgConfidence.toFixed(1)}</p>
              <ul className="mt-2 list-disc list-inside">
                {data.keyFindings.map((finding, i) => (
                  <li key={i}>{finding}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

---

## ✅ Weryfikacja

- [ ] 4 taby działają (Questions, Notes, Evidence, Summary)
- [ ] Category sidebar z progress
- [ ] Question cards z status i confidence
- [ ] Autosave odpowiedzi
- [ ] Company Facts panel
- [ ] Summary z ostrzeżeniem "Facts only"
- [ ] Brak mock data - real API
