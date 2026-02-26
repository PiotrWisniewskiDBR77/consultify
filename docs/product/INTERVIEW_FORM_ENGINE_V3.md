# Interview Form Engine v3 (SSOT)

> **Status:** Draft (v3 SSOT)  
> **Cel:** Kanoniczna definicja narzędzia “Interview Form Engine” (Template Engine + Form Runtime + Assignment workflow + storage odpowiedzi/załączników + approval model).  
> **UI/UX:** v3 ma być “premium SaaS” (focus, przestrzeń, narracja). Szczegółowe standardy UI/UX są w `docs/ui-standards/` — ten dokument opisuje kontrakty produktu i zachowania.  
>
> **Powiązane SSOT:**
> - Operating model v3: `docs/product/OPERATING_MODEL_V3.md`
> - Requirements v3: `docs/product/REQUIREMENTS_V3_SSOT.md`
> - Link Graph v3 (embedded refs + Used-in): `docs/product/LINK_GRAPH_V3.md`
> - UI/UX canon v3: `docs/ui-standards/UI_UX_CANON_V3.md`
> - Module hub standard: `docs/ui-standards/03-modules/module-hub-standard.md`
> - View modes standard: `docs/ui-standards/03-modules/view-modes-standard.md`

---

## 1) Zakres (kontrakt)

Moduł obejmuje:

- **Template Engine** (definicja formularzy + publikacja)
- **Form Runtime Engine** (wypełnianie — respondent UX)
- **Assignment Workflow** (przypisania, deadline, statusy, send-back/approve)
- **Storage** odpowiedzi i supporting materials (pliki, linki, komentarze, linki do obiektów systemu)
- **Approval model**: (A) template approval + (B) submission approval

Moduł nie obejmuje (out of scope v3):

- analizy odpowiedzi (osobny moduł / osobne narzędzia)
- generowania insightów / rekomendacji (poza prostą asystą w trakcie wypełniania)
- dashboardów analitycznych

---

## 2) Kluczowe decyzje SSOT (domknięcie niejednoznaczności)

### 2.1 Sekcje vs “5 kategorii”

- **Sekcje** służą do **UX/flow** (narracja, grouping, progress storytelling).
- **5 kategorii** (Strategy/Operations/Digital/People/Finance) to **meta‑tag** `category_tag` na poziomie pytania.
- Sekcje i kategorie są **niezależne**.

### 2.2 File upload

- W v3 **upload = realny storage** (S3‑like).
- Dopuszczamy **URL/metadata fallback** (kompatybilność migracyjna / integracje), ale “premium UX” bazuje na realnych plikach.

### 2.3 Matrix / Repeatable / Ranking (generator)

- **V1 generatora**: `matrix`, `repeatable_block`
- **V2 generatora**: `ranking` (+ pozostałe “advanced” funkcje optymalizacyjne / presety branżowe)

### 2.4 Approval

W v3 istnieją **dwa niezależne approval flows**:

- **Template approval** (publikacja): `draft → approved → archived`
- **Submission approval** (zatwierdzanie odpowiedzi): `assigned → in_progress → submitted → sent_back → approved`

---

## 3) Główne obiekty systemowe (to‑be v3)

Poniższy model jest kanoniczny dla v3. Implementacja może użyć obecnych tabel/endpointów jako “as‑is”, ale kontrakt danych ma docelowo spełnić ten model.

### 3.1 `InterviewTemplate`

Reprezentuje definicję formularza.

- `template_id`
- `name`
- `description`
- `version`
- `status`: `draft | approved | archived`
- `created_by`, `created_at`, `updated_at`
- `default_flag` (bool)
- `industry_tag?` (opcjonalnie)
- `estimated_time_minutes?`
- `runtime_mode_default`: `task_list | one_question_per_screen` (domyślnie: `task_list`)

### 3.2 `TemplateSection`

Sekcje są **wyłącznie warstwą UX** (nie zastępują kategorii).

- `section_id`
- `template_id`
- `title`
- `description?`
- `order_index`
- `is_optional` (bool)

### 3.3 `TemplateQuestion`

- `question_id`
- `template_id`
- `section_id`
- `type` (patrz lista typów)
- `title` (pytanie)
- `description?` (pomocniczy opis)
- `order_index`
- `required` (bool)
- `category_tag`: `strategy | operations | digital | people | finance`
- `conditional_logic` (JSON)
- `allow_comment` (bool)
- `allow_file_upload` (bool)
- `allow_url` (bool)
- `allow_object_link` (bool) — link do artefaktów systemu (przez Link Graph)
- `config` (JSON) — specyficzne ustawienia typu (np. skale, opcje, limity)

#### 3.3.1 Typy pytań (v3)

Core (MUST):

- `single_choice`
- `multi_choice`
- `yes_no`
- `short_text`
- `long_text`
- `number`
- `date`
- `rating` (np. 1–10)
- `dropdown`

V1 (MUST dla generatora v1):

- `matrix`
- `repeatable_block`

V2 (SHOULD):

- `ranking`

---

## 4) Conditional logic (kontrakt)

Pole: `conditional_logic` (JSON) na `TemplateQuestion` oraz opcjonalnie na `TemplateSection`.

Obsługuje:

- `if answer == X` / `!= X`
- `if rating > Y` / `< Y` / `>=` / `<=`
- `AND / OR`
- nested conditions

Walidacja przed publikacją (MUST):

- brak sprzecznych warunków
- brak dead questions (nigdy nieosiągalnych)
- brak nieskończonych pętli logicznych w flow

---

## 5) Runtime (to‑be v3)

### 5.1 `InterviewForm` (Form Instance / Assignment)

Instancja przypisana do respondenta.

- `form_id`
- `template_id`
- `assigned_to_user_id`
- `assigned_by_user_id`
- `status`: `assigned | in_progress | submitted | sent_back | approved`
- `due_date?`
- `started_at?`, `submitted_at?`, `approved_at?`
- `sent_back_reason?`
- `missing_items_json?` (lista braków do poprawy po `send-back`)
- `progress` (np. `answered_count`, `total_count`, `percent`, `current_section_id?`)

### 5.2 `FormAnswer`

- `answer_id`
- `form_id`
- `question_id`
- `value` (JSON) — **nie string**; trzyma typową strukturę dla pytania (np. bool/number/array/object)
- `comment?` (opcjonalny)
- `created_at`, `updated_at`

### 5.3 Supporting materials (kontekst “sexy”)

Wspólny kontrakt “Supporting materials” (collapsible panel w UI):

- **File attachments** (real storage)
- **Links (URL)**
- **Comment** (tekst)
- **System object links** (Link Graph refs; widoczne i respektujące uprawnienia)

#### 5.3.1 `AnswerAttachment` (real storage)

- `attachment_id`
- `answer_id`
- `file_url`
- `file_name`
- `file_size`
- `mime_type`
- `uploaded_at`
- `uploaded_by`

> v3: brak wersjonowania plików.

---

## 6) Workflow (kanon v3)

### 6.1 Template workflow

- Template powstaje jako `draft`.
- Tylko `approved` może być przypisany (assignment) i użyty do runtime.
- `archived` = nieużywalny do nowych przypisań; historyczne instancje pozostają.

### 6.2 Assignment / Submission workflow

Minimalne akcje (MUST):

- **Assign** (create form instance)
- **Start / in_progress**
- **Save draft** (bez submit)
- **Submit** (przekazanie do przeglądu)
- **Send back** (z powodem)
- **Approve** (zatwierdzenie odpowiedzi)

Reguły blokad edycji (MUST):

- po `submitted` respondent nie edytuje (chyba że `sent_back`)
- po `approved` brak edycji

---

## 7) UX / UI — kanon zachowań v3 (bez wymuszania design‑detali)

Ten rozdział opisuje **kontrakty UX** (co ma działać), a nie implementację design systemu.

### 7.1 Default mode: `task-list` (SSOT alignment)

- Domyślny runner: **task-list** (lista pytań z postępem i statusami).
- Alternatywa (opcjonalna): **one question per screen** dla formularzy wymagających silnego focus flow.
- Decyzja v3: runtime mode jest jawny i przechowywany jako konfiguracja runtime, bez “zgadywania” po stronie UI.

### 7.2 Stała anatomia ekranu (runner)

MUST:

- nazwa formularza / assessmentu
- nazwa sekcji + progress (np. `35% | 7/20`)
- duże pytanie + subtelny opis + required marker
- UI odpowiedzi zależny od typu
- “Add supporting materials (optional)” → collapsible panel
- nawigacja: Back / Save / Next (Submit na końcu)
- subtelne “Save & Exit”

### 7.3 Keyboard contract

MUST:

- `Enter` → Next (jeśli input nie wymaga nowej linii)
- `Shift+Enter` → nowa linia (long text)
- strzałki → zmiana opcji (single/rating)
- `1..9` (oraz `0` dla 10) → szybki wybór (single/rating)
- `Esc` → Save draft (i opcjonalnie exit)

### 7.4 Review screen (przed submit)

MUST:

- podsumowanie sekcji
- lista pytań + skrót odpowiedzi
- oznaczenie braków / required missing
- klik → przenosi do pytania

### 7.5 UI inspirations (niewiążące)

Ten moduł ma być inspirowany nowoczesnym standardem 2025/2026: **Typeform + Linear + Notion + modern SaaS enterprise**:

- zero “urzędowego formularza”
- zero excelowych tabel
- dużo przestrzeni, minimalizm, subtelne animacje
- AI jako asystent w tle (nie banner/widget)

> Ten punkt jest **inspiracją**, nie SSOT design spec. Szczegóły designu i komponentów regulują standardy w `docs/ui-standards/`.

---

## 8) Integracje z resztą systemu

### 8.1 Linkowanie “system objects” w supporting materials

Linki do artefaktów systemu (Initiative/Task/Decision/Report/Presentation/Assessment/Workspace/Note…) realizujemy przez kontrakt linkowania i backlinków:

- SSOT: `docs/product/LINK_GRAPH_V3.md`
- UI: pokazuje tylko obiekty dostępne wg uprawnień; brak wycieku tytułów/treści.

### 8.2 Parent object relation (traceability)

`InterviewForm` może być powiązany z:

- Initiative
- Report
- Assessment
- Workspace
- ToolSession

Kontrakt: `parent_object_id`, `parent_object_type` (lub relacja many-to-many).

---

## 9) Mapowanie na “as‑is” kod i API (stan obecny)

Ten rozdział nie jest “planem zmian” — to mapa kompatybilności, żeby SSOT v3 dało się osadzić w realnym systemie.

### 9.1 Frontend (as‑is)

- Moduł Interview hub: `src/components/Interview/InterviewHub.tsx`
- Template builder: `src/components/Interview/TemplateBuilder.tsx`
- Obecny runtime/manager workspace: `src/components/Interview/InterviewWorkspace.tsx`
- Questions list (task-list style): `src/components/Interview/QuestionsList.tsx`
- Evidence panel (metadane/linki): `src/components/Interview/EvidencePanel.tsx`
- Assign modal: `src/components/Interview/AssignInterviewModal.tsx`

### 9.2 Backend (as‑is)

- Routes: `server/src/routes/interview.routes.ts`
- Controller: `server/src/controllers/InterviewController.ts`

Istotne endpointy (as‑is):

- Templates:
  - `GET /interview/templates`
  - `POST /interview/templates`
  - `PATCH /interview/templates/:id` (w tym status)
  - `GET /interview/templates/:id/questions`
  - `POST /interview/templates/:id/questions`
  - `POST /interview/templates/:id/use` (tworzy sesję z template; tylko `approved`)
- Assignments:
  - `POST /interview/assignments`
  - `POST /interview/assignments/:id/submit`
  - `POST /interview/assignments/:id/send-back`
  - `POST /interview/assignments/:id/approve`
- Sessions/questions (task-list runtime):
  - `GET /interview/sessions/:sessionId/questions`
  - `PATCH /interview/questions/:questionId`
- Evidence (as‑is: metadane, nie realny upload):
  - `GET /interview/sessions/:sessionId/evidence`
  - `POST /interview/sessions/:sessionId/evidence`

### 9.3 Główne luki “as‑is vs v3” (do świadomego zamknięcia)

- Runtime questions (sesja) nie niesie dziś pełnego `QuestionSpec` (typy/konfig/opcje) mimo że template je ma.
- Evidence “file” jest dziś rekordem metadata (bez realnego storage).
- Sekcje w template są dziś zastąpione kategoriami; v3 rozdziela te koncepcje.

---

## 10) Co jest “kanonicznym deliverable” v3 dla tego modułu

W v3 “Interview Form Engine” jest kompletnym systemem:

- budowy i publikacji formularzy (templates)
- przypisywania i zbierania odpowiedzi (runtime)
- realnego przechowywania supporting materials (attachments)
- workflow zatwierdzania (template + submission)
- meta-tagowania pytań według 5 kategorii
- integracji linkowania z resztą platformy (Link Graph)

---

**Last updated:** 2026-02-25
