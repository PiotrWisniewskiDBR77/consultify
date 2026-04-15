# Interview – Assignments (Workflow)

## Status: ✅ ZAIMPLEMENTOWANE

**Backend:** `server/src/controllers/InterviewController.ts`  
**Frontend:** `src/components/Interview/AssignInterviewModal.tsx`

---

## 📋 Opis

System przydzielania wywiadów do członków zespołu z:
- Workflow statusów (assigned → in_progress → submitted → approved)
- Deadline tracking z alertami overdue
- Przypomnienia email
- Team assignments (wielu członków)

---

## ✅ Kanon docelowy: odbiór jakości + rework
Assignments są formalnym mechanizmem „odbioru” wywiadu:
- assignee wypełnia wywiad,
- reviewer ocenia jakość i kompletność,
- jeśli odpowiedzi są niewystarczające → `sent_back` + lista braków,
- dopiero `approved` oznacza, że kontekst może być używany jako wiarygodne wejście do Tools/Assessment i dalej do inicjatyw.

### Poziomy jakości (2‑warstwowo)
1) **Poziom pytania (Question)** – granularnie oznaczamy jakość odpowiedzi:
   - statusy pytań: `not_started`, `in_progress`, `answered`, `needs_follow_up`
   - reviewer powinien móc wskazać konkretne pytania do doprecyzowania.
2) **Poziom całości (Assignment)** – formalny odbiór:
   - statusy assignment: `assigned`, `in_progress`, `submitted`, `approved`.

### Kryteria „Submit” (assignee → review)
Minimalny warunek jakości (kanon, do dopięcia per template):
- wszystkie **required** pytania ≠ `not_started`,
- brak pustych/„placeholder” odpowiedzi w kluczowych sekcjach,
- jeśli w template istnieją „kategorie krytyczne”, to brak `needs_follow_up` w tych kategoriach,
- evidence / notatki są dołączone tam gdzie template tego wymaga.

### Kryteria „Approve” (reviewer – odbiór)
Reviewer zatwierdza tylko jeśli:
- required pytania są merytorycznie odpowiedziane,
- lista braków („gaps”) jest pusta (lub jawnie zaakceptowana jako wyjątek),
- istnieje podsumowanie facts‑only albo reviewer świadomie akceptuje jego brak.

### Kryteria „Send back” (reviewer – rework)
Send-back musi zawierać:
- `reason` (tekst),
- checklistę braków (najlepiej per kategoria/pytanie),
- (opcjonalnie) sugerowany termin i priorytet poprawy.

---

## 🔄 Workflow Statusów

```
┌──────────┐   start    ┌─────────────┐   submit    ┌───────────┐
│ ASSIGNED │ ─────────► │ IN_PROGRESS │ ──────────► │ SUBMITTED │
└──────────┘            └─────────────┘             └───────────┘
                              ▲                           │
                              │                           │ approve
                send-back + feedback                      ▼
                              │                     ┌──────────┐
                              └──────────────────── │ APPROVED │
                                                    └──────────┘
```

---

## 📊 Statusy

| Status | Opis | Akcje dostępne |
|--------|------|----------------|
| `assigned` | Oczekuje na rozpoczęcie | Start, Delete |
| `in_progress` | W trakcie realizacji lub po feedbacku review | Submit |
| `submitted` | Wysłane do review, ale nadal edytowalne przez respondenta | Approve, Send Back, Re-submit |
| `approved` | Zatwierdzone | - |

---

## Gate actions (kanon)
Przejścia assignment traktujemy jako „mini‑gates” (z audytem i notyfikacjami):
- `SUBMIT_INTERVIEW` (assignee): `in_progress → submitted`
- `SEND_BACK_INTERVIEW` (reviewer): `submitted → in_progress` + zapis feedbacku
- `APPROVE_INTERVIEW` (reviewer): `submitted → approved`

Każda akcja:
- zapisuje audit trail (kto/kiedy/komentarz),
- wysyła powiadomienia do właściwych osób (assignee/reviewer/PM),
- może podbijać eskalację przy overdue (zgodnie z polityką projektu).

## 🎨 UI - AssignInterviewModal

```
┌─────────────────────────────────────────────────────────┐
│ ✕                    Assign Interview                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Assignee *                                             │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Select team member...                       ▼   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Template *                                             │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Select template...                          ▼   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Due Date                                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 📅 2026-02-15                                   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Priority                                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │ ○ Low  ● Medium  ○ High                         │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Notes (optional)                                       │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Please complete by Friday...                    │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                              [Cancel]  [Assign]         │
└─────────────────────────────────────────────────────────┘
```

---

## 🔧 API Endpoints

### Create Assignment
```http
POST /api/interview/assignments
Authorization: Bearer {token}
Permission: INTERVIEW_ASSIGN_MANAGE

{
  "assigneeUserId": "uuid",
  "templateId": "uuid",
  "projectId": "uuid",
  "dueAt": "2026-02-15T23:59:59Z",
  "priority": "high",
  "notes": "Please complete by Friday"
}
```

### Start Assignment
```http
POST /api/interview/assignments/:id/start
Authorization: Bearer {token}

Response:
{
  "sessionId": "uuid",
  "message": "Interview session created"
}
```

### Submit Assignment
```http
POST /api/interview/assignments/:id/submit
Authorization: Bearer {token}

Response:
{
  "status": "submitted",
  "submittedAt": "2026-01-27T10:00:00Z"
}
```

### Send Reminder
```http
POST /api/interview/assignments/:id/remind
Authorization: Bearer {token}
Permission: INTERVIEW_REMIND

Response:
{
  "sent": true,
  "to": "user@example.com"
}
```

### Send Back
```http
POST /api/interview/assignments/:id/send-back
Authorization: Bearer {token}
Permission: INTERVIEW_ASSIGN_MANAGE

{
  "reason": "Please add more details to Strategy section"
}
```

---

## 📊 Widoki

### My Assignments (Inbox)

```tsx
export const InboxView: React.FC = () => {
  const { data: assignments, isLoading, error } = useMyAssignments();

  if (isLoading) return <Loading />;
  if (error) return <Error message={error} />;
  if (!assignments?.length) return <EmptyState message="No assignments" />;

  return (
    <div className="space-y-4">
      {assignments.map(assignment => (
        <AssignmentCard
          key={assignment.id}
          assignment={assignment}
          onStart={handleStart}
          onSubmit={handleSubmit}
        />
      ))}
    </div>
  );
};
```

### Managed Assignments (Admin)

```tsx
export const AssignedView: React.FC = () => {
  const { data: assignments, isLoading } = useManagedAssignments();
  const { data: overdue } = useOverdueAssignments();

  return (
    <div>
      {/* Overdue Warning */}
      {overdue?.length > 0 && (
        <div className="p-4 bg-red-50 rounded-lg mb-4">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <span>{overdue.length} overdue assignments</span>
        </div>
      )}

      {/* Assignments List */}
      <table>
        <thead>
          <tr>
            <th>Assignee</th>
            <th>Template</th>
            <th>Status</th>
            <th>Due Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {assignments?.map(a => (
            <tr key={a.id}>
              <td>{a.assigneeName}</td>
              <td>{a.templateName}</td>
              <td><StatusBadge status={a.status} /></td>
              <td className={isOverdue(a.dueAt) ? 'text-red-500' : ''}>
                {formatDate(a.dueAt)}
              </td>
              <td>
                <AssignmentActions assignment={a} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

---

## 🔔 Overdue Alerts

### Badge w NavBar

```tsx
const overdueCount = useOverdueCount();

<Tab id="assigned">
  Assigned
  {overdueCount > 0 && (
    <Badge variant="destructive">{overdueCount}</Badge>
  )}
</Tab>
```

### Email Reminder

```typescript
// InterviewController.ts
static async sendAssignmentReminder(req: Request, res: Response) {
  const { id } = req.params;
  
  const assignment = await getAssignment(id);
  if (!assignment) {
    return res.status(404).json({ error: 'Assignment not found' });
  }

  await NotificationService.sendEmail({
    to: assignment.assigneeEmail,
    subject: `Reminder: Interview assignment due ${formatDate(assignment.dueAt)}`,
    template: 'interview-reminder',
    data: {
      templateName: assignment.templateName,
      dueAt: assignment.dueAt,
      link: `${APP_URL}/interview/assignments/${id}`
    }
  });

  return res.json({ sent: true, to: assignment.assigneeEmail });
}
```

---

## 🔐 Permissions

| Permission | Opis | Role |
|------------|------|------|
| `INTERVIEW_ASSIGN_VIEW` | Podgląd przydziałów | PM, Admin |
| `INTERVIEW_ASSIGN_MANAGE` | Tworzenie/edycja przydziałów | PM, Admin |
| `INTERVIEW_REMIND` | Wysyłanie przypomnień | PM, Admin |

---

## ✅ Weryfikacja

- [ ] Tworzenie przydziału działa
- [ ] Start tworzy sesję
- [ ] Submit zmienia status
- [ ] Send back z powodem
- [ ] Overdue badge w UI
- [ ] Email reminder działa
- [ ] RBAC permissions
