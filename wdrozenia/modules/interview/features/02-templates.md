# Interview – Templates (Library)

## Status: ✅ ZAIMPLEMENTOWANE

**Backend:** `server/src/controllers/InterviewController.ts`  
**Frontend:** `src/components/Interview/TemplateBuilder.tsx`

---

## 📋 Opis

Biblioteka szablonów wywiadów z:
- 5 kategorii pytań (Strategy, Operations, Digital, People, Finance)
- 5 typów odpowiedzi (open, select, scale, boolean, number)
- Wersjonowanie (draft → published)
- Klonowanie szablonów
- RBAC permissions

---

## 📂 Kategorie Pytań

| Kategoria | Ikona | Przykładowe pytania |
|-----------|-------|---------------------|
| **Strategy** | 🎯 | "What are your strategic goals?", "What is your competitive advantage?" |
| **Operations** | ⚙️ | "What are your main operational challenges?", "How do you measure efficiency?" |
| **Digital** | 💻 | "What is your digital maturity level?", "What systems do you use?" |
| **People** | 👥 | "How is your team structured?", "What skills are missing?" |
| **Finance** | 💰 | "What is your IT budget?", "What is your ROI expectation?" |

---

## 📊 Typy Odpowiedzi

| Typ | Opis | UI Component |
|-----|------|--------------|
| `open` | Tekst otwarty | `<textarea>` |
| `select` | Wybór z listy | `<select>` z options |
| `scale` | Skala numeryczna | Slider 1-5 lub 1-10 |
| `boolean` | Tak/Nie | Toggle switch |
| `number` | Wartość liczbowa | `<input type="number">` |

---

## 🎨 UI - TemplateBuilder

```
┌─────────────────────────────────────────────────────────────────┐
│ Template Builder                                        [Save]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Template Name *                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Digital Transformation Discovery                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Description                                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Standard template for DX assessment interviews           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Status: ○ Draft  ● Published                                   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Questions                                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ [Strategy ▼]                                             │   │
│  │                                                          │   │
│  │ 1. What are your strategic goals? *                      │   │
│  │    Type: [Open ▼]  Required: [✓]           [Edit] [🗑]   │   │
│  │                                                          │   │
│  │ 2. Rate your digital maturity                            │   │
│  │    Type: [Scale ▼] Min: 1 Max: 5           [Edit] [🗑]   │   │
│  │                                                          │   │
│  │ [+ Add Question]                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ [Operations ▼]                                           │   │
│  │ ...                                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Implementacja

### TemplateBuilder.tsx

```tsx
interface TemplateBuilderProps {
  templateId?: string; // Edycja istniejącego
  onSave: (template: Template) => void;
  onClose: () => void;
}

export const TemplateBuilder: React.FC<TemplateBuilderProps> = ({
  templateId,
  onSave,
  onClose
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Pobierz istniejący szablon
  useEffect(() => {
    if (templateId) {
      loadTemplate(templateId);
    }
  }, [templateId]);

  const handleAddQuestion = (category: string) => {
    setQuestions([
      ...questions,
      {
        id: uuidv4(),
        category,
        questionText: '',
        answerType: 'open',
        required: true,
        order: questions.filter(q => q.category === category).length + 1
      }
    ]);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Template name is required');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description,
        status,
        questions
      };

      let result;
      if (templateId) {
        result = await Api.patch(`/interview/templates/${templateId}`, payload);
      } else {
        result = await Api.post('/interview/templates', payload);
      }

      toast.success('Template saved');
      onSave(result);
    } catch (err) {
      toast.error('Failed to save template');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-bold">Template Builder</h2>
        <div className="flex gap-2">
          <button onClick={onClose} className="px-4 py-2 text-gray-600">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg"
          >
            {isSaving ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Basic Info */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Template Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={status === 'draft'}
                  onChange={() => setStatus('draft')}
                />
                Draft
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={status === 'published'}
                  onChange={() => setStatus('published')}
                />
                Published
              </label>
            </div>
          </div>
        </div>

        {/* Questions by Category */}
        {CATEGORIES.map(category => (
          <CategoryQuestions
            key={category.id}
            category={category}
            questions={questions.filter(q => q.category === category.id)}
            onAdd={() => handleAddQuestion(category.id)}
            onUpdate={handleUpdateQuestion}
            onDelete={handleDeleteQuestion}
            onReorder={handleReorderQuestions}
          />
        ))}
      </div>
    </div>
  );
};
```

### QuestionEditor.tsx

```tsx
export const QuestionEditor: React.FC<Props> = ({ question, onUpdate, onDelete }) => {
  return (
    <div className="p-4 border rounded-lg">
      {/* Question Text */}
      <input
        type="text"
        value={question.questionText}
        onChange={(e) => onUpdate({ ...question, questionText: e.target.value })}
        placeholder="Enter question..."
        className="w-full px-3 py-2 border rounded-lg mb-3"
      />

      <div className="flex items-center gap-4">
        {/* Answer Type */}
        <select
          value={question.answerType}
          onChange={(e) => onUpdate({ ...question, answerType: e.target.value })}
          className="px-3 py-1 border rounded"
        >
          <option value="open">Open Text</option>
          <option value="select">Select</option>
          <option value="scale">Scale</option>
          <option value="boolean">Yes/No</option>
          <option value="number">Number</option>
        </select>

        {/* Scale Options */}
        {question.answerType === 'scale' && (
          <>
            <input
              type="number"
              value={question.scaleMin || 1}
              onChange={(e) => onUpdate({ ...question, scaleMin: +e.target.value })}
              className="w-16 px-2 py-1 border rounded"
              placeholder="Min"
            />
            <span>to</span>
            <input
              type="number"
              value={question.scaleMax || 5}
              onChange={(e) => onUpdate({ ...question, scaleMax: +e.target.value })}
              className="w-16 px-2 py-1 border rounded"
              placeholder="Max"
            />
          </>
        )}

        {/* Required */}
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={question.required}
            onChange={(e) => onUpdate({ ...question, required: e.target.checked })}
          />
          Required
        </label>

        {/* Delete */}
        <button onClick={onDelete} className="text-red-500 hover:bg-red-50 p-2 rounded">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Select Options */}
      {question.answerType === 'select' && (
        <OptionsEditor
          options={question.options || []}
          onChange={(options) => onUpdate({ ...question, options })}
        />
      )}
    </div>
  );
};
```

---

## 🔧 API Endpoints

### List Templates
```http
GET /api/interview/templates
Authorization: Bearer {token}
Permission: INTERVIEW_TEMPLATE_VIEW
```

### Create Template
```http
POST /api/interview/templates
Authorization: Bearer {token}
Permission: INTERVIEW_TEMPLATE_MANAGE

{
  "name": "DX Discovery",
  "description": "...",
  "status": "draft",
  "questions": [...]
}
```

### Clone Template
```http
POST /api/interview/templates/:id/clone
Authorization: Bearer {token}
Permission: INTERVIEW_TEMPLATE_MANAGE

Response:
{
  "id": "new-uuid",
  "name": "DX Discovery (Copy)",
  ...
}
```

### Use Template (Create Session)
```http
POST /api/interview/templates/:id/use
Authorization: Bearer {token}
Permission: INTERVIEW_TEMPLATE_USE

{
  "sessionName": "Interview - Company X"
}

Response:
{
  "sessionId": "uuid",
  "questionsCount": 25
}
```

---

## 🔐 Permissions

| Permission | Opis | Role |
|------------|------|------|
| `INTERVIEW_TEMPLATE_VIEW` | Podgląd szablonów | All |
| `INTERVIEW_TEMPLATE_USE` | Używanie szablonów | PM, Consultant |
| `INTERVIEW_TEMPLATE_MANAGE` | Tworzenie/edycja | PM, Admin |

---

## ✅ Weryfikacja

- [ ] Tworzenie szablonu działa
- [ ] 5 kategorii pytań
- [ ] 5 typów odpowiedzi
- [ ] Drag & drop reorder
- [ ] Clone template
- [ ] Use template tworzy sesję
- [ ] Draft/Published status
- [ ] RBAC permissions
