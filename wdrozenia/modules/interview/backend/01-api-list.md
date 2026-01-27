# Interview – API List

## Status: ✅ ZAIMPLEMENTOWANE

**Plik źródłowy:** `server/src/routes/interview.routes.ts`  
**Controller:** `server/src/controllers/InterviewController.ts`  
**Service:** `server/src/services/InterviewInsightService.ts`

---

## 📋 Lista Endpointów (50+)

### Sessions (Sesje wywiadów)

| Metoda | Endpoint | Opis | Permissions |
|--------|----------|------|-------------|
| `GET` | `/api/interview/sessions` | Lista wszystkich sesji | Auth |
| `GET` | `/api/interview/sessions/completed` | Sesje zakończone (dla Insights) | Auth |
| `GET` | `/api/interview/sessions/:id` | Szczegóły sesji | Auth |
| `POST` | `/api/interview/sessions` | Utwórz nową sesję | Auth |
| `PATCH` | `/api/interview/sessions/:id` | Aktualizuj sesję | Auth |

### Assignments (Przydzielanie wywiadów)

| Metoda | Endpoint | Opis | Permissions |
|--------|----------|------|-------------|
| `GET` | `/api/interview/assignments/my` | Moje przydzielone wywiady | Auth |
| `GET` | `/api/interview/assignments/managed` | Wywiady które zarządzam | INTERVIEW_ASSIGN_VIEW |
| `GET` | `/api/interview/assignments/overdue` | Przeterminowane | INTERVIEW_ASSIGN_VIEW |
| `GET` | `/api/interview/assignments/counts` | Liczniki dla użytkownika | Auth |
| `GET` | `/api/interview/assignments` | Lista wszystkich (admin) | INTERVIEW_ASSIGN_VIEW |
| `GET` | `/api/interview/assignments/:id` | Szczegóły przydzielenia | INTERVIEW_ASSIGN_VIEW |
| `POST` | `/api/interview/assignments` | Utwórz przydzielenie | INTERVIEW_ASSIGN_MANAGE |
| `POST` | `/api/interview/assignments/:id/start` | Rozpocznij wywiad | Auth |
| `POST` | `/api/interview/assignments/:id/submit` | Wyślij do review | Auth |
| `POST` | `/api/interview/assignments/:id/remind` | Wyślij przypomnienie | INTERVIEW_REMIND |
| `POST` | `/api/interview/assignments/:id/send-back` | Zwróć do poprawy | INTERVIEW_ASSIGN_MANAGE |
| `PATCH` | `/api/interview/assignments/:id` | Aktualizuj przydzielenie | INTERVIEW_ASSIGN_MANAGE |
| `DELETE` | `/api/interview/assignments/:id` | Usuń (jeśli nie rozpoczęte) | INTERVIEW_ASSIGN_MANAGE |

### Team Members (Członkowie zespołu)

| Metoda | Endpoint | Opis | Permissions |
|--------|----------|------|-------------|
| `GET` | `/api/interview/assignments/:id/members` | Lista członków | INTERVIEW_ASSIGN_VIEW |
| `POST` | `/api/interview/assignments/:id/members` | Dodaj członka | INTERVIEW_ASSIGN_MANAGE |
| `DELETE` | `/api/interview/assignments/:id/members/:userId` | Usuń członka | INTERVIEW_ASSIGN_MANAGE |

### Templates (Szablony)

| Metoda | Endpoint | Opis | Permissions |
|--------|----------|------|-------------|
| `GET` | `/api/interview/templates` | Lista szablonów | INTERVIEW_TEMPLATE_VIEW |
| `GET` | `/api/interview/templates/:id` | Szczegóły szablonu | INTERVIEW_TEMPLATE_VIEW |
| `GET` | `/api/interview/templates/:id/questions` | Pytania szablonu | INTERVIEW_TEMPLATE_VIEW |
| `POST` | `/api/interview/templates` | Utwórz szablon | INTERVIEW_TEMPLATE_MANAGE |
| `POST` | `/api/interview/templates/:id/use` | Użyj szablonu | INTERVIEW_TEMPLATE_USE |
| `POST` | `/api/interview/templates/:id/clone` | Klonuj szablon | INTERVIEW_TEMPLATE_MANAGE |
| `POST` | `/api/interview/templates/:id/questions` | Dodaj pytanie | INTERVIEW_TEMPLATE_MANAGE |
| `PATCH` | `/api/interview/templates/:id` | Aktualizuj szablon | INTERVIEW_TEMPLATE_MANAGE |
| `PATCH` | `/api/interview/templates/:id/questions/:questionId` | Aktualizuj pytanie | INTERVIEW_TEMPLATE_MANAGE |
| `DELETE` | `/api/interview/templates/:id` | Usuń szablon | INTERVIEW_TEMPLATE_MANAGE |
| `DELETE` | `/api/interview/templates/:id/questions/:questionId` | Usuń pytanie | INTERVIEW_TEMPLATE_MANAGE |

### Questions (Pytania - task-list style)

| Metoda | Endpoint | Opis | Permissions |
|--------|----------|------|-------------|
| `GET` | `/api/interview/sessions/:sessionId/questions` | Lista pytań sesji | Auth |
| `POST` | `/api/interview/sessions/:sessionId/questions` | Dodaj pytanie | Auth |
| `PATCH` | `/api/interview/questions/:questionId` | Aktualizuj (odpowiedź, status) | Auth |

### AI Assist (Human-in-the-loop)

| Metoda | Endpoint | Opis | Permissions |
|--------|----------|------|-------------|
| `POST` | `/api/interview/questions/:questionId/ai-suggest` | Sugestia odpowiedzi AI | Auth |
| `POST` | `/api/interview/sessions/:sessionId/ai-parse` | Parsuj transkrypt do odpowiedzi | Auth |

### Notes (Notatki)

| Metoda | Endpoint | Opis | Permissions |
|--------|----------|------|-------------|
| `GET` | `/api/interview/sessions/:sessionId/notes` | Lista notatek | Auth |
| `POST` | `/api/interview/sessions/:sessionId/notes` | Utwórz notatkę | Auth |
| `PATCH` | `/api/interview/notes/:noteId` | Aktualizuj notatkę | Auth |
| `DELETE` | `/api/interview/notes/:noteId` | Usuń notatkę | Auth |

### Evidence (Dowody/załączniki)

| Metoda | Endpoint | Opis | Permissions |
|--------|----------|------|-------------|
| `GET` | `/api/interview/sessions/:sessionId/evidence` | Lista dowodów | Auth |
| `POST` | `/api/interview/sessions/:sessionId/evidence` | Wgraj dowód | Auth |
| `DELETE` | `/api/interview/evidence/:evidenceId` | Usuń dowód | Auth |

### Organization Context (Company Facts)

| Metoda | Endpoint | Opis | Permissions |
|--------|----------|------|-------------|
| `GET` | `/api/interview/context` | Pobierz kontekst organizacji | Auth |
| `PUT` | `/api/interview/context` | Aktualizuj kontekst | Auth |

### Summary & Export

| Metoda | Endpoint | Opis | Permissions |
|--------|----------|------|-------------|
| `POST` | `/api/interview/sessions/:sessionId/summary` | Generuj podsumowanie (FACTS ONLY) | Auth |
| `POST` | `/api/interview/sessions/:sessionId/export` | Eksportuj do Tools/Assessment | Auth |

### Insights (AI-generated - BCG Enterprise Level)

| Metoda | Endpoint | Opis | Permissions |
|--------|----------|------|-------------|
| `GET` | `/api/interview/insights` | Lista insights | Auth |
| `GET` | `/api/interview/insights/:id` | Szczegóły insight | Auth |
| `POST` | `/api/interview/insights` | Utwórz insight (start AI) | Auth |
| `POST` | `/api/interview/insights/:id/regenerate` | Regeneruj insight | Auth |
| `DELETE` | `/api/interview/insights/:id` | Usuń insight | Auth |

---

## 🎯 Typy Insights (10 BCG-level)

| Typ | Nazwa | Opis |
|-----|-------|------|
| `summary` | Executive Summary | Podsumowanie wykonawcze |
| `trends` | Trend Analysis | Analiza trendów |
| `problems` | Problem Discovery | Odkrywanie problemów |
| `recommendations` | Recommendations | Rekomendacje |
| `comparison` | Cross-Interview Comparison | Porównanie między wywiadami |
| `gaps` | Gap Analysis | Analiza luk |
| `risk_assessment` | Risk Assessment | Ocena ryzyka |
| `opportunity_scan` | Opportunity Scan | Skanowanie możliwości |
| `maturity` | Maturity Assessment | Ocena dojrzałości (1-5) |
| `stakeholder_map` | Stakeholder Mapping | Mapowanie interesariuszy |

---

## 📊 Kategorie Pytań (5)

- **Strategy** - Strategia biznesowa
- **Operations** - Operacje
- **Digital** - Transformacja cyfrowa
- **People** - Ludzie i kultura
- **Finance** - Finanse

---

## 🔐 Permissions

| Permission | Opis |
|------------|------|
| `INTERVIEW_ASSIGN_VIEW` | Podgląd przydzieleń |
| `INTERVIEW_ASSIGN_MANAGE` | Zarządzanie przydziałami |
| `INTERVIEW_REMIND` | Wysyłanie przypomnień |
| `INTERVIEW_TEMPLATE_VIEW` | Podgląd szablonów |
| `INTERVIEW_TEMPLATE_USE` | Używanie szablonów |
| `INTERVIEW_TEMPLATE_MANAGE` | Zarządzanie szablonami |

---

## ✅ Weryfikacja

```bash
# Sprawdź czy routing działa
curl -X GET http://localhost:3000/api/interview/sessions \
  -H "Authorization: Bearer $TOKEN"

# Sprawdź insights
curl -X GET http://localhost:3000/api/interview/insights \
  -H "Authorization: Bearer $TOKEN"
```
