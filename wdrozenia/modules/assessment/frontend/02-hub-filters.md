# Assessment – Hub Filters

## Status: ✅ ZAIMPLEMENTOWANE

**Plik źródłowy:** `src/components/assessment/AssessmentModuleHub.tsx`

---

## 📋 Opis

Filtry listy assessmentów w AssessmentHub:
- Framework (DRD, SIRI, ADMA, CMMI, Lean)
- Status (Draft, In Review, Approved)
- Owner (użytkownik)
- Date range

---

## 🎨 UI - Filters Bar

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Framework      Status         Owner           Date Range        [Clear] │
│ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌─────────────────┐          │
│ │ All     ▼ │ │ All     ▼ │ │ All     ▼ │ │ 📅 Last 30 days │          │
│ └───────────┘ └───────────┘ └───────────┘ └─────────────────┘          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Implementacja

### AssessmentFilters.tsx

```tsx
interface AssessmentFiltersProps {
  filters: AssessmentFilters;
  onChange: (filters: AssessmentFilters) => void;
  onClear: () => void;
}

interface AssessmentFilters {
  framework?: string;
  status?: string;
  ownerId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const AssessmentFiltersBar: React.FC<AssessmentFiltersProps> = ({
  filters,
  onChange,
  onClear
}) => {
  const { data: users } = useOrganizationUsers();

  return (
    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
      {/* Framework Filter */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Framework</label>
        <select
          value={filters.framework || ''}
          onChange={(e) => onChange({ ...filters, framework: e.target.value || undefined })}
          className="px-3 py-2 border rounded-lg"
        >
          <option value="">All</option>
          <option value="DRD">DRD</option>
          <option value="SIRI">SIRI</option>
          <option value="ADMA">ADMA</option>
          <option value="CMMI">CMMI</option>
          <option value="LEAN">Lean 4.0</option>
        </select>
      </div>

      {/* Status Filter */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Status</label>
        <select
          value={filters.status || ''}
          onChange={(e) => onChange({ ...filters, status: e.target.value || undefined })}
          className="px-3 py-2 border rounded-lg"
        >
          <option value="">All</option>
          <option value="DRAFT">Draft</option>
          <option value="IN_REVIEW">In Review</option>
          <option value="AWAITING_APPROVAL">Awaiting Approval</option>
          <option value="APPROVED">Approved</option>
        </select>
      </div>

      {/* Owner Filter */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Owner</label>
        <select
          value={filters.ownerId || ''}
          onChange={(e) => onChange({ ...filters, ownerId: e.target.value || undefined })}
          className="px-3 py-2 border rounded-lg"
        >
          <option value="">All</option>
          {users?.map(user => (
            <option key={user.id} value={user.id}>{user.name}</option>
          ))}
        </select>
      </div>

      {/* Date Range */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Date Range</label>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={filters.dateFrom || ''}
            onChange={(e) => onChange({ ...filters, dateFrom: e.target.value || undefined })}
            className="px-3 py-2 border rounded-lg"
          />
          <span>to</span>
          <input
            type="date"
            value={filters.dateTo || ''}
            onChange={(e) => onChange({ ...filters, dateTo: e.target.value || undefined })}
            className="px-3 py-2 border rounded-lg"
          />
        </div>
      </div>

      {/* Clear Button */}
      <button
        onClick={onClear}
        className="px-3 py-2 text-gray-500 hover:bg-gray-100 rounded-lg"
      >
        Clear
      </button>
    </div>
  );
};
```

### Hook - useFilteredAssessments

```tsx
export const useFilteredAssessments = (filters: AssessmentFilters) => {
  return useQuery({
    queryKey: ['assessments', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.framework) params.append('framework', filters.framework);
      if (filters.status) params.append('status', filters.status);
      if (filters.ownerId) params.append('ownerId', filters.ownerId);
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);
      
      const response = await Api.get(`/assessment-workflow?${params.toString()}`);
      return response;
    }
  });
};
```

---

## 🔧 Backend - Filter Support

### AssessmentController.ts

```typescript
static async listAssessments(req: Request, res: Response) {
  const { framework, status, ownerId, dateFrom, dateTo } = req.query;
  const organizationId = req.user.organizationId;

  let query = `
    SELECT * FROM assessments 
    WHERE organization_id = ?
  `;
  const params: any[] = [organizationId];

  if (framework) {
    query += ` AND framework = ?`;
    params.push(framework);
  }

  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }

  if (ownerId) {
    query += ` AND owner_id = ?`;
    params.push(ownerId);
  }

  if (dateFrom) {
    query += ` AND created_at >= ?`;
    params.push(dateFrom);
  }

  if (dateTo) {
    query += ` AND created_at <= ?`;
    params.push(dateTo);
  }

  query += ` ORDER BY updated_at DESC`;

  const assessments = await db.all(query, params);
  return res.json(assessments);
}
```

---

## 📊 Quick Filters (Presets)

```tsx
const QUICK_FILTERS = [
  { label: 'My Assessments', filter: { ownerId: currentUserId } },
  { label: 'Pending Review', filter: { status: 'IN_REVIEW' } },
  { label: 'Last 7 days', filter: { dateFrom: getDateDaysAgo(7) } },
  { label: 'DRD Only', filter: { framework: 'DRD' } },
];

<div className="flex gap-2 mb-4">
  {QUICK_FILTERS.map(qf => (
    <button
      key={qf.label}
      onClick={() => setFilters(qf.filter)}
      className="px-3 py-1 text-sm bg-gray-100 rounded-full hover:bg-gray-200"
    >
      {qf.label}
    </button>
  ))}
</div>
```

---

## ✅ Weryfikacja

- [x] Framework filter
- [x] Status filter
- [x] Owner filter
- [x] Date range filter
- [x] Clear all filters
- [x] Quick filter presets
- [x] Backend support
- [x] Real API (brak mock)
