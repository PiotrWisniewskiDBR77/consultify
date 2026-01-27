# Interview – Assignments (Workflow)

## Status: ✅ ZAIMPLEMENTOWANE

**Backend:** `server/src/controllers/InterviewController.ts`  
**Frontend:** `src/components/Interview/AssignInterviewModal.tsx`

---

## 📋 Opis

System przydzielania wywiadów do członków zespołu z:
- Workflow statusów (pending → in_progress → submitted → approved)
- Deadline tracking z alertami overdue
- Przypomnienia email
- Team assignments (wielu członków)

---

## 🔄 Workflow Statusów

```
┌─────────┐    start    ┌─────────────┐    submit    ┌───────────┐
│ PENDING │ ──────────► │ IN_PROGRESS │ ───────────► │ SUBMITTED │
└─────────┘             └─────────────┘              └───────────┘
                                                           │
                              ┌─────────────────────────────┤
                              │                             │
                              ▼                             ▼
                        ┌───────────┐               ┌──────────┐
                        │ SENT_BACK │               │ APPROVED │
                        └───────────┘               └──────────┘
                              │
                              │ re-submit
                              ▼
                        ┌───────────┐
                        │ SUBMITTED │
                        └───────────┘
```

---

## 📊 Statusy

| Status | Opis | Akcje dostępne |
|--------|------|----------------|
| `pending` | Oczekuje na rozpoczęcie | Start, Delete |
| `in_progress` | W trakcie realizacji | Submit |
| `submitted` | Wysłane do review | Approve, Send Back |
| `approved` | Zatwierdzone | - |
| `sent_back` | Zwrócone do poprawy | Re-submit |

---

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
