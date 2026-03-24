# Interview Knowledge Collection System v6 (SSOT)

> **Status:** Draft (to-be v6 redesign)  
> **Owner:** Product + Engineering  
> **Cel:** zdefiniować kanoniczny redesign modułu `Interview` jako systemu do:
> - budowy i publikacji template'ów pytań,
> - premium runtime do odpowiadania,
> - zbierania wiedzy i evidence,
> - generowania insightów konsultingowych bez automatycznego action planningu.
>
> **Ważne:** ten dokument opisuje **docelowe V6**, a nie obecne zachowanie produkcyjne V3. V3 pozostaje as-is do czasu wdrożenia programu z `docs/product/V6_INTERVIEW_IMPLEMENTATION_PROGRAM.md`.

## 0) Powiązane SSOT (MUST)

- `docs/product/INTERVIEW_FORM_ENGINE_V3.md`
- `docs/INTERVIEW_MODULE.md`
- `docs/INTERVIEW_TEMPLATES_AND_AI_ASSIST.md`
- `docs/product/TOOLS_KNOWLEDGE_BANK_V3.md`
- `docs/product/LINK_GRAPH_V3.md`
- `docs/product/SOURCE_TRACEABILITY_SPEC.md`
- `docs/product/modules/ai/AI_DEEP_RESEARCH_EVIDENCE_SYSTEM_V3.md`
- `docs/ui-standards/README.md`
- `docs/ui-standards/00-foundation/visual-language.md`
- `docs/ui-standards/03-modules/module-hub-standard.md`

---

## 1) North star

`Interview` w V6 nie jest już "form engine z pytaniami".  
To jest **system zbierania wiedzy o organizacji** oparty o trzy osobne surfaces:

1. **Templates Studio** — budowa i publikacja template'ów.
2. **Interview Runtime** — premium experience dla respondenta.
3. **Insight Report** — synteza odpowiedzi, evidence i opportunities.

System ma łączyć wzorce:

- **SurveyMonkey / Qualtrics** — biblioteka template'ów, logika, zarządzanie wysyłkami,
- **Typeform** — focus experience podczas odpowiadania,
- **CultureAmp** — porządkowanie wyników w tematy, luki, opportunities,
- **Consultify Evidence Ledger** — traceability: answer -> transcript -> attachment -> link -> insight.

---

## 2) Nienegocjowalne decyzje V6

### 2.1 Product split

V6 rozdziela trzy różne tryby pracy:

- **builder** dla konsultanta/admina,
- **respondent runtime** dla użytkownika odpowiadającego,
- **insight surface** dla konsultanta/reviewera.

Te tryby **nie mogą** używać tego samego rytmu UI.

### 2.2 Runtime default

Domyślny runtime to:

- **one question per screen**
- z **małym, cichym lewym rail'em** pokazującym sekcje / pozycję,
- bez dużego progress bara,
- z lekkim wskaźnikiem typu `7 z 10`.

### 2.3 Voice-first evidence capture

Każda odpowiedź może być udzielona:

- tekstem,
- głosem,
- z załącznikami,
- z linkami,
- z notą kontekstową.

**Voice answer MUST:**

- uruchamiać nagrywanie,
- tworzyć automatyczną transkrypcję,
- pozwalać userowi zatwierdzić / poprawić transcript,
- zachować audio jako source artefact.

### 2.4 Insight scope

Insights w V6 zawierają:

- podsumowanie odpowiedzi,
- syntezę AI,
- consulting interpretation,
- `issues`,
- `opportunities`,
- evidence map.

Insights **nie** generują jeszcze automatycznych `recommended actions`.

### 2.5 Template scopes

Biblioteka template'ów ma trzy poziomy:

- **System** — dostarczane z aplikacją,
- **Organization** — współdzielone w organizacji,
- **Private** — prywatne template'y autora.

### 2.6 AI-first builder

Builder ma promować flow:

- brief -> AI draft -> refine -> publish

manual editing jest dozwolony, ale nie jest główną ścieżką.

---

## 3) Zakres modułu V6

### 3.1 In scope

- Templates Studio z AI-first generation
- system template library + organization/private scopes
- respondent runtime z voice/transcript/evidence
- reviewer mode
- evidence ingestion do knowledge context
- insight synthesis z traceability
- wysyłki template'ów / assignments
- multi-session knowledge accumulation

### 3.2 Out of scope (na ten etap)

- automatyczny action planning z insightów
- pełne dashboardy analityczne benchmarkowe
- zaawansowana branching mapa typu Qualtrics enterprise
- anonimowe badania masowe z threshold privacy reporting
- marketplace template'ów między organizacjami

---

## 4) Surface 1 — Templates Studio

### 4.1 Cel

`Templates Studio` służy do projektowania list pytań i struktur odpowiedzi tak, aby:

- pytania były krótkie, zrozumiałe i neutralne,
- kolejność pytań budowała narrację,
- expected answer shape była jawna,
- system wiedział, kiedy zachęcać do attachment/link/voice/context.

### 4.2 Hub

Hub template'ów jest surface'em zarządczym i może używać wzorców `ModuleHub/AppTable`.

MUST:

- scopes: `System / Organization / Private`
- search
- filters: `status`, `audience`, `industry`, `estimated time`, `owner`
- view modes: `cards` default + `table` optional
- actions: `Create with AI`, `New`, `Duplicate`, `Preview`, `Publish`

### 4.3 Builder layout

Builder jest pełnym workspace, nie chaotycznym modalem.

Układ:

- **Left rail**
  - template title
  - scope
  - audience
  - description
  - estimated duration
  - sections
  - publish status
- **Center**
  - question list active section
  - reorder
  - AI suggestions
  - add question
- **Right properties panel**
  - edycja wybranego pytania

### 4.4 AI builder workflow

#### Stage A — Brief

User opisuje:

- typ audytu / wysyłki,
- branżę,
- typ respondentów,
- cel,
- expected length,
- desired tone,
- czy chcemy voice / evidence-heavy / quick pulse.

#### Stage B — Draft

AI proponuje:

- sekcje,
- pytania,
- kolejność,
- typy odpowiedzi,
- expected answer shape,
- gdzie zachęcać do evidence,
- estimated duration,
- warning jeśli template jest za długi lub zbyt ciężki poznawczo.

#### Stage C — Refine

AI może:

- skrócić pytanie,
- rozbić pytanie podwójne,
- usunąć sugestywność,
- doprecyzować zakres,
- zmienić typ odpowiedzi,
- zasugerować lepszą kolejność.

### 4.5 Question quality guardrails

System ocenia pytania pod kątem:

- leading question,
- double-barreled question,
- zbyt długie,
- zbyt abstrakcyjne,
- trudne do odpowiedzenia bez danych,
- niejasny expected output,
- brak evidence promptu tam, gdzie powinien istnieć.

---

## 5) Surface 2 — Interview Runtime

### 5.1 Cel

Runtime ma skłaniać do odpowiadania.  
Nie może wyglądać jak ciężki panel operacyjny.

### 5.2 Layout contract

Układ:

- **Left mini rail**
  - sekcje
  - short labels
  - subtle current item
  - dyskretne answered / remaining state
- **Center**
  - jedno pytanie
  - helper text
  - answer composer
  - supporting evidence composer
- **Bottom action row**
  - `Back`
  - `Save`
  - `Next`
  - `Submit` na końcu

### 5.3 Co MUST być widoczne

- nazwa interview / assignment
- sekcja
- pozycja `X z Y`
- required marker
- główne pole odpowiedzi
- lekkie wejścia do:
  - voice,
  - attachment,
  - link,
  - context note

### 5.4 Co MUST NOT dominować ekranu

- confidence chips
- tagi operacyjne
- reviewer metadata
- stakeholders widgets
- preview pane
- ciężkie top bary
- duże paski progresu

### 5.5 Answer modalities

Core typy:

- `short_text`
- `long_text`
- `single_choice`
- `multi_choice`
- `yes_no`
- `rating`
- `number`
- `date`
- `dropdown`
- `voice_answer`

Per question policies:

- `allow_voice`
- `allow_attachment`
- `allow_link`
- `allow_context_note`
- `expected_answer_shape`

### 5.6 Voice flow

1. User klika `Record answer`
2. Nagrywa odpowiedź
3. System generuje transcript
4. User akceptuje lub poprawia transcript
5. Zapisujemy:
   - transcript jako answer content
   - audio jako supporting evidence
6. User przechodzi dalej

### 5.7 Reviewer mode

Reviewer i respondent nie powinni pracować na tym samym chrome.

Reviewer mode pokazuje:

- source answers,
- evidence completeness,
- send-back / approve,
- gaps,
- trace links.

Respondent mode pozostaje lekki.

---

## 6) Surface 3 — Insight Report

### 6.1 Cel

`Insight Report` ma zamieniać surowe odpowiedzi z wielu interview w uporządkowany consulting artefact.

### 6.2 Three-layer truth model

Każdy insight rozdziela:

1. **Source answers** — co powiedzieli respondenci i jakie dostarczyli evidence.
2. **AI synthesis** — jakie tematy, napięcia i wzorce system widzi.
3. **Consulting interpretation** — co to znaczy biznesowo na poziomie issues i opportunities.

### 6.3 Minimalna struktura insightu

- `Executive summary`
- `Themes`
- `Issues`
- `Opportunities`
- `Signals between the lines`
- `Evidence map`
- `Source answers`

### 6.4 Evidence discipline

Każdy ważny insight SHOULD mieć:

- link do source answer,
- link do transcriptu,
- link do attachment/link evidence,
- strength of evidence,
- ewentualne contraditions / missing data.

### 6.5 Current limit

Na etapie V6-A/V6-B system nie generuje automatycznych action plans.  
Może proponować:

- follow-up areas,
- missing data,
- next interviews worth running.

---

## 7) System zbierania wiedzy (Knowledge Collection System)

### 7.1 Cel

Interview ma nie tylko zbierać odpowiedzi.  
Ma budować **knowledge context** organizacji i projektu.

### 7.2 Co staje się źródłem wiedzy

Każda odpowiedź może wyprodukować:

- `answer_text`
- `answer_transcript`
- `answer_audio`
- `attachments`
- `links`
- `context_note`
- metadata:
  - template
  - section
  - question
  - respondent
  - date
  - project / organization scope

### 7.3 Canonical evidence pipeline

`Interview Input -> Normalization -> Evidence Ledger -> Context Knowledge Base -> Insight Synthesis`

#### Stage 1 — Capture

System zapisuje oryginalne artefakty odpowiedzi.

#### Stage 2 — Normalize

System standaryzuje:

- transcript,
- extracted entities,
- topic tags,
- mentioned systems/processes/owners,
- evidence type,
- confidence of extraction.

#### Stage 3 — Link

Każdy element jest linkowany do:

- `form_id`
- `question_id`
- `answer_id`
- `template_id`
- `project_id`
- `organization_id`

#### Stage 4 — Ingest to knowledge context

Attachments i linki trafiają:

- do odpowiedzi jako local evidence,
- równolegle do kontekstowej bazy wiedzy jako `linked evidence`,
- z pełnym trace back do odpowiedzi źródłowej.

#### Stage 5 — Insight retrieval

Insight engine pobiera:

- source answers,
- transcripts,
- linked evidence,
- existing knowledge context,
- i buduje theme/issue/opportunity synthesis.

### 7.4 Relacja do Link Graph i Evidence Ledger

V6 MUST respektować:

- `Link Graph` dla backlinks i embedded refs,
- `Source Traceability` dla artefaktów powstałych z interview,
- `Evidence Ledger` dla claim -> evidence mapping.

### 7.5 Access and privacy

Knowledge collection MUST respektować:

- visibility scope template'a,
- uprawnienia respondent/reviewer/admin,
- organization boundaries,
- private template isolation,
- restricted rendering tam, gdzie user nie ma dostępu do evidence.

---

## 8) Główne obiekty danych V6

### 8.1 Template layer

#### `InterviewTemplateV6`

- `template_id`
- `scope`: `system | organization | private`
- `status`: `draft | approved | archived`
- `name`
- `description`
- `audience`
- `industry_tag?`
- `estimated_time_minutes`
- `default_runtime_mode = one_question_per_screen`
- `created_by`
- `organization_id?`
- `version`

#### `TemplateSectionV6`

- `section_id`
- `template_id`
- `title`
- `description?`
- `order_index`
- `optional_flag`

#### `TemplateQuestionV6`

- `question_id`
- `template_id`
- `section_id`
- `title`
- `helper_text?`
- `answer_type`
- `expected_answer_shape`
- `required`
- `category_tag?`
- `allow_voice`
- `allow_attachment`
- `allow_link`
- `allow_context_note`
- `conditional_logic?`
- `sort_order`

### 8.2 Runtime layer

#### `InterviewFormV6`

- `form_id`
- `template_id`
- `assigned_to`
- `assigned_by`
- `status`
- `current_question_id`
- `current_section_id`
- `answered_count`
- `total_count`
- `started_at`
- `submitted_at`
- `approved_at`
- `sent_back_reason?`

#### `FormAnswerV6`

- `answer_id`
- `form_id`
- `question_id`
- `answer_text?`
- `answer_transcript?`
- `answer_audio_url?`
- `answer_transcript_approved`
- `context_note?`
- `structured_value_json?`
- `created_at`
- `updated_at`

#### `AnswerEvidenceV6`

- `evidence_id`
- `answer_id`
- `type`: `file | link | audio | transcript | note`
- `title`
- `url_or_storage_ref`
- `preview_text?`
- `knowledge_linked_flag`
- `source_hash?`

### 8.3 Insight layer

#### `InterviewInsightV6`

- `insight_id`
- `source_forms[]`
- `title`
- `summary`
- `themes_json`
- `issues_json`
- `opportunities_json`
- `signals_json`
- `evidence_map_json`
- `status`: `draft | reviewed | approved`
- `created_at`

---

## 9) Workflow end-to-end

### 9.1 Build

1. User chooses `System`, `Organization`, or `Private`
2. Starts `Create with AI`
3. Enters brief
4. AI creates draft template
5. User refines questions and answer modalities
6. Publishes template

### 9.2 Send

1. User selects template
2. Creates assignment
3. Sends to respondent(s)

### 9.3 Answer

1. Respondent opens assignment
2. Answers one question at a time
3. Optionally adds voice / attachments / links / note
4. Submits

### 9.4 Review

1. Reviewer checks completeness and evidence
2. Approves or sends back

### 9.5 Learn

1. Approved answers ingest into knowledge context
2. Evidence is linked into context knowledge base
3. Insight engine creates synthesis across sessions

---

## 10) UI/UX canon for V6

### 10.1 Templates Studio

- premium SaaS workspace
- compact rows
- no giant accordion cards as primary interaction
- AI-first onboarding

### 10.2 Runtime

- one question per screen
- lots of whitespace
- quiet chrome
- respondent focus first

### 10.3 Insight Report

- structured consulting brief
- no dashboard spam
- evidence first
- clear layers of truth

### 10.4 Visual language

V6 MUST follow DBR77 "Tech Sexy":

- monochromatic chrome
- invisible borders
- one dominant CTA
- outline icons
- warm darks
- spacious center column

---

## 11) Definition of Done for V6 redesign

V6 jest gotowe dopiero, gdy:

- istnieje biblioteka template'ów `System / Organization / Private`,
- builder działa AI-first i manual refine,
- respondent może odpowiedzieć tekstem lub głosem,
- attachments i links są linkowane do answer i knowledge context,
- insight pokazuje `themes / issues / opportunities / evidence map`,
- każdy insight ma trace back do source answers,
- reviewer flow approve/send-back działa,
- i18n PL+EN działa,
- access control respektuje scope i organizację,
- smoke script V6 przechodzi end-to-end.

---

## 12) Powiązane dokumenty V6

- `docs/product/INTERVIEW_TEMPLATES_LIBRARY_V6.md`
- `docs/product/V6_INTERVIEW_ACTION_PLAN.md`
- `docs/product/V6_INTERVIEW_IMPLEMENTATION_PROGRAM.md`
