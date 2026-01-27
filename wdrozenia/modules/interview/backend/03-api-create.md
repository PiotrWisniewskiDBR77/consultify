# Interview – API Create (Session & Template)

## Status: ✅ ZAIMPLEMENTOWANE

---

## 📋 Tworzenie Sesji Interview

### Endpoint
```http
POST /api/interview/sessions
```

### Request Body
```json
{
  "name": "string (required)",
  "projectId": "uuid (optional)",
  "templateId": "uuid (optional)",
  "assignmentId": "uuid (optional)"
}
```

### Logika Tworzenia

1. **Walidacja** - sprawdzenie wymaganych pól
2. **Sprawdzenie projektu** - jeśli podano projectId
3. **Sprawdzenie szablonu** - jeśli podano templateId
4. **Utworzenie sesji** - INSERT do `interview_sessions`
5. **Kopiowanie pytań** - jeśli użyto szablonu
6. **Aktualizacja przydziału** - jeśli podano assignmentId

### Kod (fragment)

```typescript
// InterviewController.ts
static async createSession(req: Request, res: Response) {
  const { name, projectId, templateId, assignmentId } = req.body;
  const userId = req.user.id;
  const organizationId = req.user.organizationId;

  // Walidacja
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  // Utworzenie sesji
  const sessionId = uuidv4();
  await db.run(`
    INSERT INTO interview_sessions 
    (id, name, user_id, organization_id, project_id, template_id, assignment_id, status, progress)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 0)
  `, [sessionId, name, userId, organizationId, projectId, templateId, assignmentId]);

  // Jeśli szablon - skopiuj pytania
  if (templateId) {
    await copyTemplateQuestions(templateId, sessionId);
  }

  // Jeśli przydzielenie - aktualizuj status
  if (assignmentId) {
    await db.run(`
      UPDATE interview_assignments 
      SET status = 'in_progress', session_id = ?
      WHERE id = ?
    `, [sessionId, assignmentId]);
  }

  return res.status(201).json({ id: sessionId, name, status: 'active' });
}
```

---

## 📋 Tworzenie Szablonu

### Endpoint
```http
POST /api/interview/templates
```

### Request Body
```json
{
  "name": "string (required)",
  "description": "string (optional)",
  "status": "draft | published",
  "questions": [
    {
      "category": "strategy | operations | digital | people | finance",
      "questionText": "string (required)",
      "answerType": "open | select | scale | boolean | number",
      "required": "boolean",
      "order": "number",
      "options": ["array of strings (for select)"],
      "scaleMin": "number (for scale)",
      "scaleMax": "number (for scale)"
    }
  ]
}
```

### Logika Tworzenia

1. **Walidacja** - sprawdzenie wymaganych pól
2. **Sprawdzenie permissions** - INTERVIEW_TEMPLATE_MANAGE
3. **Utworzenie szablonu** - INSERT do `interview_templates`
4. **Utworzenie pytań** - INSERT do `interview_template_questions`

### Kod (fragment)

```typescript
// InterviewController.ts
static async createTemplate(req: Request, res: Response) {
  const { name, description, status, questions } = req.body;
  const userId = req.user.id;
  const organizationId = req.user.organizationId;

  // Walidacja
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const templateId = uuidv4();
  
  // Utworzenie szablonu
  await db.run(`
    INSERT INTO interview_templates 
    (id, name, description, status, organization_id, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [templateId, name, description, status || 'draft', organizationId, userId]);

  // Utworzenie pytań
  if (questions && questions.length > 0) {
    for (const q of questions) {
      await db.run(`
        INSERT INTO interview_template_questions
        (id, template_id, category, question_text, answer_type, required, sort_order, options, scale_min, scale_max)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        uuidv4(), templateId, q.category, q.questionText, 
        q.answerType || 'open', q.required ?? true, q.order || 0,
        JSON.stringify(q.options || []), q.scaleMin, q.scaleMax
      ]);
    }
  }

  return res.status(201).json({ id: templateId, name, status: status || 'draft' });
}
```

---

## 📋 Tworzenie Przydziału

### Endpoint
```http
POST /api/interview/assignments
```

### Request Body
```json
{
  "assigneeUserId": "uuid (required)",
  "templateId": "uuid (required)",
  "projectId": "uuid (optional)",
  "dueAt": "ISO date string (optional)",
  "priority": "low | medium | high",
  "notes": "string (optional)"
}
```

### Logika Tworzenia

1. **Walidacja** - sprawdzenie wymaganych pól
2. **Sprawdzenie permissions** - INTERVIEW_ASSIGN_MANAGE
3. **Sprawdzenie użytkownika** - czy assignee istnieje
4. **Sprawdzenie szablonu** - czy template istnieje
5. **Utworzenie przydziału** - INSERT do `interview_assignments`
6. **Wysłanie notyfikacji** - do assignee

---

## 📋 Tworzenie Insight (AI)

### Endpoint
```http
POST /api/interview/insights
```

### Request Body
```json
{
  "sessionIds": ["uuid array (required, min 1)"],
  "insightType": "string (required)",
  "customPrompt": "string (optional)"
}
```

### Logika Tworzenia

1. **Walidacja** - sprawdzenie wymaganych pól
2. **Sprawdzenie sesji** - czy wszystkie sessionIds istnieją
3. **Utworzenie insight** - INSERT z status='generating'
4. **Uruchomienie AI** - async job do generowania
5. **Aktualizacja statusu** - completed/failed po zakończeniu

### Kod (fragment)

```typescript
// InterviewController.ts
static async createInsight(req: Request, res: Response) {
  const { sessionIds, insightType, customPrompt } = req.body;
  const userId = req.user.id;
  const organizationId = req.user.organizationId;

  // Walidacja
  if (!sessionIds || sessionIds.length === 0) {
    return res.status(400).json({ error: 'At least one session is required' });
  }
  if (!insightType) {
    return res.status(400).json({ error: 'Insight type is required' });
  }

  const insightId = uuidv4();

  // Utworzenie insight
  await db.run(`
    INSERT INTO interview_insights 
    (id, organization_id, insight_type, status, created_by, session_ids, custom_prompt)
    VALUES (?, ?, ?, 'generating', ?, ?, ?)
  `, [insightId, organizationId, insightType, userId, JSON.stringify(sessionIds), customPrompt]);

  // Uruchom generowanie async
  InterviewInsightService.generateInsight(insightId, sessionIds, insightType, customPrompt)
    .catch(err => console.error('[Insight] Generation failed:', err));

  return res.status(201).json({ 
    id: insightId, 
    insightType, 
    status: 'generating' 
  });
}
```

---

## ✅ Weryfikacja

```bash
# Test tworzenia sesji
curl -X POST http://localhost:3000/api/interview/sessions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Session"}'

# Test tworzenia szablonu
curl -X POST http://localhost:3000/api/interview/templates \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "DX Discovery",
    "questions": [
      {"category": "strategy", "questionText": "What are your goals?", "answerType": "open"}
    ]
  }'
```
