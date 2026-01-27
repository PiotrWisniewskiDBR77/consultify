# Interview – New Session Modal

## Status: ✅ ZAIMPLEMENTOWANE

**Plik źródłowy:** `src/components/Interview/NewSessionModal.tsx`

---

## 📋 Opis

Modal do tworzenia nowej sesji wywiadu. Pozwala na:
- Podanie nazwy sesji
- Wybór projektu (opcjonalnie)
- Wybór szablonu (opcjonalnie)
- Powiązanie z przydziałem (opcjonalnie)

---

## 🎨 UI Design

```
┌─────────────────────────────────────────────────────────┐
│ ✕                    New Interview Session              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Session Name *                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Discovery Interview - Company X                  │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Project (optional)                                     │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Select project...                           ▼   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Template (optional)                                    │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Select template...                          ▼   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ ℹ️ Using a template will pre-populate questions │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                              [Cancel]  [Create Session] │
└─────────────────────────────────────────────────────────┘
```

---

## 🔧 Implementacja

### NewSessionModal.tsx

```tsx
interface NewSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (session: InterviewSession) => void;
  assignmentId?: string; // Jeśli tworzenie z przydziału
}

export const NewSessionModal: React.FC<NewSessionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  assignmentId
}) => {
  const [name, setName] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pobierz projekty i szablony
  const { data: projects, isLoading: loadingProjects } = useProjects();
  const { data: templates, isLoading: loadingTemplates } = useInterviewTemplates();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Session name is required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await Api.post('/interview/sessions', {
        name: name.trim(),
        projectId,
        templateId,
        assignmentId
      });

      toast.success('Interview session created');
      onSuccess(response);
      onClose();
    } catch (err: any) {
      const message = err?.message || 'Failed to create session';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-navy-900 rounded-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold">New Interview Session</h2>
          <button onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Session Name */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Session Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Discovery Interview - Company X"
              className="w-full px-3 py-2 border rounded-lg"
              autoFocus
            />
          </div>

          {/* Project Select */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Project (optional)
            </label>
            <select
              value={projectId || ''}
              onChange={(e) => setProjectId(e.target.value || null)}
              className="w-full px-3 py-2 border rounded-lg"
              disabled={loadingProjects}
            >
              <option value="">Select project...</option>
              {projects?.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Template Select */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Template (optional)
            </label>
            <select
              value={templateId || ''}
              onChange={(e) => setTemplateId(e.target.value || null)}
              className="w-full px-3 py-2 border rounded-lg"
              disabled={loadingTemplates}
            >
              <option value="">Select template...</option>
              {templates?.filter(t => t.status === 'published').map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Info */}
          {templateId && (
            <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
              <Info className="w-5 h-5 text-blue-500 mt-0.5" />
              <p className="text-sm text-blue-700">
                Using a template will pre-populate questions for this session.
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || !name.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Create Session'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
```

---

## 📊 Stany

| Stan | Opis |
|------|------|
| `idle` | Formularz gotowy do wypełnienia |
| `loading` | Tworzenie sesji w toku |
| `error` | Błąd walidacji lub API |
| `success` | Sesja utworzona, modal zamknięty |

---

## 🔐 Walidacja

| Pole | Reguły |
|------|--------|
| `name` | Wymagane, min 1 znak |
| `projectId` | Opcjonalne, musi istnieć |
| `templateId` | Opcjonalne, musi być published |

---

## ✅ Weryfikacja

- [ ] Formularz waliduje wymagane pola
- [ ] Loading state podczas tworzenia
- [ ] Error state z komunikatem
- [ ] Toast notification po sukcesie
- [ ] Modal zamyka się po sukcesie
- [ ] Brak mock data - real API
