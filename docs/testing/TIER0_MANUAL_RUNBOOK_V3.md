# Tier‑0 Manual Runbook — V3 / R0

| Pole | Wartość |
| --- | --- |
| Cel | Szybka walidacja krytycznych ścieżek V3 (R0) + evidence dla DD |
| Czas | 20–30 min |
| Warunek | Środowisko dev/stage z zalogowanym użytkownikiem (najlepiej rola PM/Admin) |
| Evidence | ID encji + screeny + (opcjonalnie) wpisy w audit logach |

---

## 0) Setup (2 min)

- Uruchom FE + API jak standardowo dla projektu.
- Zaloguj się jako użytkownik z dostępem do: **My Work**, **Interview**, **Initiatives**, **Reports**, **Presentations**, **SuperAdmin (LLM)**.

**Evidence**
- Screenshot: sidebar po zalogowaniu.

---

## 1) V3‑A02 — persistence dynamic tabs (6 min)

### 1.1 My Work (Ideas/Tasks) — tabs + reload

- Wejdź w `My Work`.
- Otwórz 2 różne elementy jako zakładki (np. task + decision albo idea + task).
- Kliknij “List” i wróć na jedną zakładkę.
- Odśwież stronę (reload).

**Expected**
- Zakładki i aktywna zakładka odtwarzają się po reload.
- Pod topbarem jest **jeden** Command Row (search OR tabs OR counters).

**Evidence**
- Screenshot: 2 otwarte zakładki + po reload.

### 1.2 Interview — tabs + reload

- Wejdź w `Interview`.
- Otwórz 1 sesję i 1 insight jako zakładki.
- Reload.

**Expected**
- Zakładki odtwarzają się po reload.
- Pod topbarem jest **jeden** Command Row.

**Evidence**
- Screenshot: zakładki przed i po reload.

### 1.3 Initiatives + Presentations — tabs + reload

- Wejdź do `Initiatives`, otwórz 1 initiative jako zakładkę → reload.
- Wejdź do `Presentations`, otwórz 1 deck jako zakładkę → reload.

**Expected**
- Zakładki odtwarzają się po reload.

**Evidence**
- Screenshot: open tab w obu hubach.

---

## 2) V3‑A01 — traceability end‑to‑end (8–10 min)

### 2.1 Convert Idea → Initiative (ToolSession materialization)

- Wejdź w `My Work > Ideas`.
- Wybierz istniejący pomysł (albo utwórz nowy) i użyj “Convert to Initiative”.

**Expected**
- Powstaje initiative.
- Odpowiedź/flow zwraca i/lub UI pokazuje `sourceSessionId` / powiązanie źródła.
- Inicjatywa ma ustawione `sourceType/sourceId` (canonical).

**Evidence**
- Zapisz: `ideaId`, `initiativeId`, `toolSessionId` (jeśli widoczne w UI/response).
- Screenshot: potwierdzenie konwersji / otwarta inicjatywa.

### 2.2 Convert Notebook → Report

- Wejdź w `My Work > Notebook`.
- Wybierz stronę i uruchom “Convert to Report”.

**Expected**
- Powstaje report.
- Report ma traceability do tool_session (sourceType=tool, sourceId=toolSessionId).

**Evidence**
- Zapisz: `pageId`, `reportId`, `toolSessionId`.

### 2.3 Convert Notebook → Presentation

- Na tej samej stronie notebook: “Convert to Presentation”.

**Expected**
- Powstaje deck w `presentation_decks`.
- Deck ma `source_type/source_id` ustawione.

**Evidence**
- Zapisz: `deckId`, `toolSessionId`.

---

## 3) V3‑A06 — Model Registry audit log + fallback (4–6 min)

- Wejdź do `SuperAdmin > LLM Management` / Model Registry.
- Zmień/odśwież konfigurację (tylko nieinwazyjnie; jeśli macie środowisko testowe).
- Wymuś warunki fallback (jeśli macie przełącznik/test preset), albo wykonaj zapytanie, które użyje fallback policy.
- Otwórz audit log (`GET /api/llm/audit-log` w UI lub przez przeglądarkę).

**Expected**
- W audit logu są wpisy zmian (legacy writes) oraz ewentualny event `fallback_used`.

**Evidence**
- Screenshot: audit log list + widoczny event `fallback_used` (jeśli udało się wymusić).

---

## 4) V3‑B02 — Chat actions: NAVIGATE (3–5 min)

- Otwórz AI Chat.
- Wywołaj akcję typu NAVIGATE (np. poproś o przejście do Initiatives/Report/Presentation) albo kliknij istniejącą kartę akcji.

**Expected**
- Router normalizuje target i przenosi do właściwego modułu.
- Action card ma stan error/analytics (jeśli akcja się nie powiedzie).

**Evidence**
- Screenshot: action card + docelowy ekran po nawigacji.

---

## 5) Wynik (1 min)

**PASS** jeśli wszystkie sekcje 1–4 spełniają expected, a evidence zostało zebrane.

**FAIL** jeśli:
- brak odtwarzania tabs po reload,
- brak toolSession materialization (konwersja tworzy artefakt bez źródła),
- audit log nie rejestruje zmian/fallback,
- NAVIGATE nie działa / prowadzi w złe miejsce.

