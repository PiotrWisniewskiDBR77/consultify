# Assessment – Hub Search

## Status: ✅ ZAIMPLEMENTOWANE

**Plik źródłowy:** `src/components/assessment/AssessmentModuleHub.tsx`

---

## 📋 Opis

Wyszukiwanie assessmentów w AssessmentHub:
- Full-text search po nazwie i opisie
- Debounced input
- Highlight wyników

---

## 🎨 UI - Search Bar

```
┌─────────────────────────────────────────────────────────────────┐
│ 🔍 Search assessments...                                    ✕   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Implementacja

### AssessmentSearch.tsx

```tsx
interface AssessmentSearchProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
}

export const AssessmentSearch: React.FC<AssessmentSearchProps> = ({
  value,
  onChange,
  onClear
}) => {
  const [localValue, setLocalValue] = useState(value);
  
  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      onChange(localValue);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [localValue, onChange]);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder="Search assessments..."
        className="w-full pl-10 pr-10 py-2 border rounded-lg"
      />
      {localValue && (
        <button
          onClick={() => {
            setLocalValue('');
            onClear();
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2"
        >
          <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
        </button>
      )}
    </div>
  );
};
```

### Hook - useSearchAssessments

```tsx
export const useSearchAssessments = (query: string, filters: AssessmentFilters) => {
  return useQuery({
    queryKey: ['assessments', 'search', query, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query) params.append('search', query);
      // Add other filters...
      
      const response = await Api.get(`/assessment-workflow?${params.toString()}`);
      return response;
    },
    enabled: query.length >= 2 || query.length === 0 // Min 2 chars or empty
  });
};
```

---

## 🔧 Backend - Search Support

### AssessmentController.ts

```typescript
static async listAssessments(req: Request, res: Response) {
  const { search, ...filters } = req.query;
  const organizationId = req.user.organizationId;

  let query = `
    SELECT * FROM assessments 
    WHERE organization_id = ?
  `;
  const params: any[] = [organizationId];

  // Full-text search
  if (search) {
    query += ` AND (
      name LIKE ? OR 
      description LIKE ? OR 
      framework LIKE ?
    )`;
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern);
  }

  // Other filters...
  
  query += ` ORDER BY updated_at DESC`;

  const assessments = await db.all(query, params);
  return res.json(assessments);
}
```

---

## 🎨 Highlight Results

```tsx
const highlightMatch = (text: string, query: string) => {
  if (!query) return text;
  
  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
  const parts = text.split(regex);
  
  return parts.map((part, i) => 
    regex.test(part) ? (
      <mark key={i} className="bg-yellow-200">{part}</mark>
    ) : part
  );
};

// Usage in list
<td>{highlightMatch(assessment.name, searchQuery)}</td>
```

---

## 📊 Search Results Count

```tsx
<div className="flex items-center justify-between mb-4">
  <AssessmentSearch value={search} onChange={setSearch} onClear={() => setSearch('')} />
  {search && (
    <span className="text-sm text-gray-500">
      {assessments?.length || 0} results for "{search}"
    </span>
  )}
</div>
```

---

## ✅ Weryfikacja

- [x] Search input z ikoną
- [x] Debounced search (300ms)
- [x] Clear button
- [x] Min 2 characters
- [x] Backend full-text search
- [x] Results count
- [x] Highlight matches
- [x] Real API (brak mock)
