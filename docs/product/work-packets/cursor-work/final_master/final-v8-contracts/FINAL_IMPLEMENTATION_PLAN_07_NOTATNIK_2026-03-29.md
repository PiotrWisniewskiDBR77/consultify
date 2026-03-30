# Final Implementation Contract — Notatnik (Position 7/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (contract wrapper over existing plan)

## 1. Executive summary
- **Intent**: Jest ok, trzeba dobrze połączyć z resztą aplikacji.
- **Primary users**: każdy użytkownik (capture, wiedza operacyjna).
- **Success metric**: frictionless capture + structured note + search-first discovery + powiązania z pracą (inicjatywy/wykonanie/chat).

## 2. Scope
### 2.1 In-scope
- Notebook jako powierzchnia capture i pracy na notatce + linking do reszty systemu.
- Templates + AI propose/review w notatce (w granicach planu).

### 2.2 Out-of-scope / non-goals
- Kopiowanie pełnego Notion „databases-as-product” 1:1.

### 2.3 P07-A canon (scope approval)

Ta sekcja jest **kanonicznym** kontraktem zakresu dla `P07-A` i blokuje “dopowiadanie w locie”. Jej celem jest zamrożenie:

- bounded entry points (capture/open),
- trwałej tożsamości notatki i stabilnych linków,
- języka provenance (źródło vs edycja usera vs transformacja AI) bez “silent loss”,
- baseline dla attachment/upload lifecycle,
- baseline dla search (operator-grade, bounded),
- semantics linkowania i payloadów handoff downstream (Radar/Inicjatywy/Teresa),
- anti-duplicate gate,
- posture degraded/error (minimum 8 scenariuszy),
- checklisty akceptacyjnej (testowalne punkty).

#### 2.3.1 Surfaces: bounded entry points (capture + open)

**Capture (create note) — dopuszczone wejścia (bounded):**
- `My Work > Notebook` — “New note” / quick capture.
- “Add to Notebook” z innych kontekstów pracy (jako akcja pomocnicza, nie nowy moduł): `Chat`, `Inicjatywy`, `Wdrożenia`, `Radar`, `Interview` (wnioski), `Tools` (jeśli generują artefakt/fragment, który ma trafić do pamięci roboczej).
- Capture connectors (z SSOT): `web_clipper`, `email_forward`, `upload/import`, `api_import` (bounded do istniejących konektorów / ich deklaracji w planie).

**Open (read/edit) — dopuszczone wejścia (bounded):**
- z listy Notebook (search/list),
- z wyników search,
- z backlinków / linked artifacts (context panel),
- z deeplinku (stable link).

**Zakaz (anti-parallel):**
- brak osobnego “top-level modułu” poza `My Work`,
- brak “dead inbox”: każdy capture musi dawać natychmiastowy, jawny następny krok (link/convert/move-to-active), zamiast gromadzić się w ukrytej kolejce.

#### 2.3.2 Durable identity for note + stable links

**Durable identity (minimum):**
- notatka ma **kanoniczny, niezmienny** identyfikator `note_id` (UUID).
- `title`, `status`, `maturity`, `tags` i powiązania mogą się zmieniać — **link nie może** zależeć od tych pól.

**Stable links (minimum):**
- wewnętrzny deeplink do notatki musi być stabilny i prowadzić do właściwego kontekstu w `My Work` (zgodnie z kanonem list/preview/open).
- linkowanie “note ↔ note” i “note ↔ artifact” musi wspierać backlinks i **degraded** zachowanie, gdy target nie istnieje / user nie ma uprawnień (nigdy “martwy link bez informacji”).

#### 2.3.3 Provenance language (source vs user edit vs AI transform) — no silent loss

W `Notatka v8` provenance jest obowiązkowa i jawna. Minimalne rozróżnienie:

- **`source`**: treść/metadane pochodzące ze źródła capture (np. web/email/import), cytaty, external references, oraz pochodzenie attachmentów (nazwa/typ/źródło).
- **`user_edit`**: ręczna edycja usera (w tym dodane bloki, zmiany tytułu/metadata).
- **`ai_transform`**: propozycje/transformacje generowane przez AI na podstawie jawnie wskazanych inputów (note blocks/attachments/links). AI nie jest “ghost author”.

**Zasady zamrożone (P0):**
- brak `silent overwrite` i brak `silent delete` w notatce.
- AI może tylko: `observe -> propose -> review -> accept/reject` (zgodnie z SSOT).
- każdy output AI musi mieć **input pointers** (na jakich źródłach pracował) i minimalny audit trail (actor, note_id, operation type, timestamp, resolution).
- eksport/transformacja (np. markdown) nie może “zgubić provenance” — jeśli format nie wspiera pełnych metadanych, musi zachować co najmniej jednoznaczne markery (np. `source:` / `AI:`) + link do oryginału.

#### 2.3.4 Attachment / upload lifecycle baseline — statuses, error taxonomy, retry, “what next”

Attachment to nie “blob wrzucony do treści”, tylko obiekt z lifecycle i recovery. Baseline:

**Statuses (minimum, user-visible):**
- `queued`
- `uploading`
- `processing` (np. AV scan / transcoding / indexing)
- `available`
- `failed`
- `blocked(policy)` (np. typ pliku / size / compliance)

**Error taxonomy (minimum, user-visible category):**
- `network` / `timeout`
- `size_limit` / `quota_exceeded`
- `type_unsupported`
- `permission_denied`
- `virus_scan` (quarantine)
- `storage_unavailable`
- `processing_failed`
- `unknown`

**Retry & safety:**
- retryable errors muszą mieć jawne CTA: “Retry upload” (bez silent drop).
- retry musi być idempotentny (żadnych “podwójnych” attachmentów bez intencji usera).
- jeśli `processing` trwa długo: UI ma pokazać stan i “co dalej” (wait / cancel / retry / contact).

**“What next” guidance (minimum):**
- każdy `failed` / `blocked(policy)` stan musi mieć tekst: co poszło źle, co user może zrobić teraz, i jak nie stracić pracy w notatce (np. zachowanie referencji do pliku + metadanych).

#### 2.3.5 Search baseline (operator-grade, bounded)

Search dla Notebook ma być “operator-grade”, ale **bounded** (bez kopiowania pełnej gramatyki Evernote).

**Query (minimum):**
- `q` (free text)
- filtry (bounded, zgodne z SSOT modelu domenowego): `status`, `maturity`, `tags`, `type`, `owner`, `visibility`, `has_attachments`, `linked_artifact_type`, `linked_artifact_id`, `capture_source`, `updated_at_range`

**Operator hints (optional but bounded, v8 baseline):**
- `tag:<name>`
- `type:<note_type>`
- `status:<inbox|active|converted|archived>`
- `maturity:<seed|growing|mature|actionable>`
- `owner:<me|user_id>`
- `source:<web_clipper|email_forward|upload|api_import>`
- `has:attachment`

**Result contract (minimum):**
- wynik zawsze zwraca: `note_id`, `title`, `snippet` (z highlight), `match_kind` (keyword/semantic/metadata), `updated_at`, oraz podstawowe metadata (status/maturity/tags/has_attachments/linked_artifacts_count).

**Anti-duplicate (hard):**
- brak “search index v2”. Search bazuje na kanonicznym FTS/embeddings torze, bez równoległych indeksów per moduł.

#### 2.3.6 Linking + downstream handoff payload (Notebook → Radar / Inicjatywy / Teresa)

Linking i handoff nie mogą przenosić “gołego tekstu bez kontekstu”. Minimalny payload wspólny:

**Common (`notebook_handoff_context`) — wymagane zawsze:**
- `origin=notebook`
- `note_id`
- `note_deeplink` (stable)
- `title`
- `summary` (≤ 6 bullets; może być AI, ale z provenance)
- `tags[]`, `status`, `maturity`, `note_type?`
- `capture_source` + bounded `capture_metadata`
- `linked_artifacts[]` (type, id, deeplink)
- `attachments[]` (attachment_id, filename, status, download_ref/preview_ref)
- `evidence_pointers[]` (block/attachment refs; bez gubienia provenance)
- `uncertainty_boundary` + `missing_inputs[]` (jeśli coś jest niepewne)
- `owner` + `last_updated_at`

**To `Radar` (P06) — wymagane dodatkowo:**
- `radar_signal_suggestion`: `category`, `why_now`, `priority_hint`, `evidence_pointers[]`, `open_questions[]`, `missing_inputs[]`

**To `Inicjatywy` (P11) — wymagane dodatkowo:**
- `initiative_seed`: `problem_statement`, `proposed_outcome`, `assumptions[]`, `risks[]`, `next_steps[]`, `time_window?`

**To `Teresa` (P08) — wymagane dodatkowo:**
- `assistant_context`: `user_intent`, `constraints[]`, `do_not_assume[]`, `allowed_actions[]`, `citations[]` (evidence pointers)

#### 2.3.7 Anti-duplicate gate (hard)

Zabronione w `P07` (bez osobnego, jawnego packetu):
- równoległy system attachmentów/uploader (Notebook ma używać jednego kanonicznego lifecycle’u),
- równoległy “search v2 index”,
- równoległy “dead inbox” (osobna kolejka capture poza `status=inbox`),
- równoległy model linków (druga reprezentacja relacji note↔artifact).

#### 2.3.8 Degraded / error posture — minimum scenarios (8+)

Każdy scenariusz musi mieć: **stan widoczny**, **safe next action**, **brak silent data loss**.

1) **Upload failed: network/timeout** → status `failed(network)` + CTA “Retry”, bez utraty referencji do pliku.  
2) **Upload blocked: policy/size/type** → `blocked(policy)` + jasny powód + “what next” (zmień plik/rozmiar/zapytaj admina).  
3) **Processing stuck/slow** → `processing` + komunikat + opcja “wait / cancel / retry later”.  
4) **Preview/readback unavailable** → attachment widoczny, ale z bannerem “preview unavailable”; safe action: download/open externally.  
5) **Semantic search degraded** → banner “semantic unavailable” + fallback do keyword search (bez “0 results” jako silent failure).  
6) **Index stale / delayed** (note świeżo edytowana) → banner “results may be delayed” + opcja “refresh”.  
7) **Deeplink target missing** → strona degraded: “note not found / deleted” + fallback: search by id + activity pointers.  
8) **Link target permission denied** → link widoczny, ale oznaczony `degraded(permission)` + instrukcja “request access / capture context”.  
9) **Concurrent edit conflict** → jawny conflict resolution (wersje), bez silent overwrite.  
10) **AI unavailable** → AI actions disabled z wyjaśnieniem; user edit i core notebook działa dalej.  

#### 2.3.9 Acceptance checklist (scope approval) — testable points (10+)

`P07-A` jest `approved(scope)` dopiero gdy:
1) Wejścia capture/open są **bounded** i spisane (§2.3.1).  
2) `note_id` jako durable identity + stable deeplink jest zamrożony (§2.3.2).  
3) Provenance language (`source` vs `user_edit` vs `ai_transform`) jest jednoznaczny i ma zasady “no silent loss” (§2.3.3).  
4) Attachment lifecycle ma stany + error taxonomy + retry + “what next” (§2.3.4).  
5) Search baseline ma deklarowane filtry + minimalny kontrakt wyników + brak “search v2” (§2.3.5).  
6) Linking + handoff payload ma wymagane pola wspólne i per-target (Radar/Inicjatywy/Teresa) (§2.3.6).  
7) Anti-duplicate gate jest jawny (attachments/search/inbox/links) (§2.3.7).  
8) Degraded posture ma minimum 8 scenariuszy z safe next action (§2.3.8).  
9) Non-goals są jawne (brak Notion DB parity, brak nowego modułu, brak silent AI writing).  
10) Kontrakt nie tworzy równoległej prawdy względem SSOT/benchmark (sekcja 3 pozostaje authority chain).  
11) Evidence ledger ma uzupełniony wiersz `P07-A` (commit ref) w §10.  

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_NOTATKI_2026-03-29.md`
- Benchmark: `docs/product/NOTATKA_V8_BENCHMARK.md`
- SSOT: `docs/product/NOTATKA_V8_SSOT.md`

## 4. Softs inspirations (benchmark apps)
### 4.1 Primary benchmark family (SSOT)
- Plan modułu wskazuje `Softs/0 Notatki` jako primary benchmark family (`WAVE1_FINAL_IMPLEMENTATION_PLAN_NOTATKI_2026-03-29.md`).

### 4.2 Local Softs evidence (concrete artifacts)
- **Notion (templates + capture + API surfaces)**:
  - `Softs/0 Notatki/Notion help.zip :: Notion help/www.notion.com/templates.html` (marketplace templates; skala “template-first workflows”).
  - `Softs/0 Notatki/Notion help.zip :: Notion help/www.notion.com/web-clipper.html` (web clipper: one-click capture → destination → make actionable; tag/assign).
  - `Softs/0 Notatki/Notion dev.zip :: Notion dev/developers.notion.com/reference/post-search.html` (Search endpoint: pages + data_sources shared with integration).
  - `Softs/0 Notatki/Notion dev.zip :: Notion dev/developers.notion.com/reference/file-upload.html` (File Upload object: śledzi lifecycle uploadu).
  - `Softs/0 Notatki/Notion dev.zip :: Notion dev/developers.notion.com/reference/retrieve-page-markdown.html` (Retrieve page as enhanced markdown).
- **Evernote (capture + search grammar + linking + sync + OCR/recognition)**:
  - `Softs/0 Notatki/evernote dev.zip :: evernote dev/dev.evernote.com/doc/articles/search_grammar.php.html` (search grammar: bogate filtry, źródła, atrybuty).
  - `Softs/0 Notatki/evernote dev.zip :: evernote dev/dev.evernote.com/doc/articles/note_links.php.html` (note links: typy linków; “link directly to individual notes from anywhere”).
  - `Softs/0 Notatki/evernote dev.zip :: evernote dev/dev.evernote.com/doc/articles/image_recognition.php.html` (image recognition: indeksowanie tekstu w obrazach + dostęp do recognition data).
  - `Softs/0 Notatki/evernote dev.zip :: evernote dev/dev.evernote.com/doc/articles/synchronization.php.html` (full synchronization: spec; lokalna kopia metadanych/notatek jako wzorzec “durable working memory”).

### 4.3 Parity checklist vs Softs (approval-grade)
**Parity oznacza “durable working memory + search/linking + provenance”, nie “pełny Notion databases-as-product”.**

- **Frictionless capture + clip-to-action (Notion Web Clipper / Evernote capture doctrine)**:
  - Capture z wielu kontekstów (w tym web) w 1–2 krokach.
  - Po capture: szybka organizacja (destination/tag/assign) i przejście do pracy (nie “martwy inbox”).
- **Templates as a first-class surface (Notion)**:
  - Templates muszą wspierać powtarzalne workflow (nie tylko “ładne przykłady”).
  - Template → nowa notatka z predefiniowaną strukturą i miejscem na evidence/provenance.
- **Search-first discovery (Evernote search grammar + Notion search endpoint)**:
  - Szukanie jest “operator-grade”: query + filtry + przewidywalne wyniki; brak konieczności pamiętania gdzie coś było zapisane.
- **Linking / note links / object linkage (Evernote note links + Consultify spine)**:
  - Notatki mają stabilną tożsamość i linkowalność (do notatek i do obiektów pracy: inicjatywa/zadanie/wniosek).
  - Link nie może być “martwy”: musi prowadzić do właściwego kontekstu i zachowywać provenance.
- **Attachments + upload lifecycle (Notion File Upload + Wave1 gaps)**:
  - Uploady/załączniki muszą mieć spójny lifecycle: dodanie → status → dostępność → błędy/retry.
- **Export/readback surfaces (Notion markdown)**:
  - Czytelny readback i możliwość eksportu/transformacji (np. markdown) bez gubienia sensu i lineage.
- **OCR / recognition posture (Evernote image recognition)**:
  - Jeżeli wspieramy obrazy/PDF: przynajmniej indeksowalność i odzyskiwalność treści (albo jawne ograniczenie + “why”).

### 4.4 Gap ledger vs Softs (what we are missing — derived from current plans)
Źródło prawdy “co mamy / czego brakuje” to: `WAVE1_FINAL_IMPLEMENTATION_PLAN_NOTATKI_2026-03-29.md` + SSOT `NOTATKA_V8_SSOT.md`.

| Capability cluster (Softs parity target) | What Softs implies | Current truth (per plan) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| Attachment/upload breadth | upload lifecycle must be reliable | “uploads/attachments uneven” | Domknąć lifecycle upload/attachment na deklarowanych ścieżkach + recovery | P0 |
| Notebook→other module propagation | links keep context + trust | “propagation not deep enough” | Wzmocnić handoff i link semantics do `Radar`/`Inicjatywy`/`Teresa` | P0 |
| Reviewer/provenance semantics | verified/disputed language clarity | “reviewer semantics lighter” | Ujednolicić gramatykę provenance/review na większej liczbie przypadków | P1 |
| Orchestration coverage | calm capture→reuse | “broader orchestration partial” | Rozszerzyć pokrycie workflow (templates + reuse cues) bez rozszerzania do document suite | P1 |

## 5. Evidence plan (DoD)
### 5.1 Acceptance criteria
- Quick capture działa z wielu kontekstów; notatka ma spójny lifecycle.
- Search i linking pozwalają odzyskać wiedzę (notatki i powiązane obiekty pracy) bez zgadywania.
- Attachment/upload działa przewidywalnie (status, błędy, retry) na deklarowanych ścieżkach.
- Provenance/review language jest spójne: user rozumie co jest źródłem, co jest transformacją/AI, co jest “verified/disputed”.

### 5.2 Tests
- Integracyjne: capture → attach → index/search → open → link-out do obiektu pracy → powrót bez utraty kontekstu.
- Kontraktowe: provenance payload (source badges / reviewer state) renderuje się stabilnie i nie overclaim.
- Regression: upload fail → user widzi stan + “co dalej” + retry (bez silent drop).

### 5.3 Staging proof checklist
- Demo: capture→link→AI propose→accept (z jawnym provenance) + downstream handoff do `Radar` albo `Inicjatywy`.
- Demo: attachment lifecycle (upload → preview/readback → search hit → open).

## 8. Delivery plan
### 8.0 Context pack (read first)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Execution playbook: `docs/product/work-packets/cursor-work/final_master/PROGRAM_EXECUTION_PLAYBOOK.md`
- Authority chain (detailed plan/SSOT): see section 3.
- Softs parity + gaps: see section 4.
- Evidence plan: see section 5.

### 8.1 Bounded delivery packets
#### P07-A — Notebook canon + scope approval
- **Goal**: notebook jako durable working memory (capture+search+linking), bez “Notion DB parity”.
- **Inputs required**: decyzje o linking/provenance minimal; attachment lifecycle baseline.
- **Acceptance**: scope zatwierdzony; non-goals jawne; “no silent provenance loss” zasady spisane.
- **Evidence**: scope approval + linkowane SSOT/benchmark.
- **Tasks** (see library: `docs/product/work-packets/cursor-work/final_master/PACKET_TASKS_AND_DOD_LIBRARY.md`):
  - Freeze linking + provenance minimal contract (what is source vs AI transform).
  - Freeze attachment lifecycle baseline (status/error/retry) and search baseline scope.
  - Freeze downstream handoff payload expectations (Radar/Inicjatywy) (bounded).
- **DoD**:
  - Approved(scope): capture/search/linking/attachments scope is explicit and testable.

#### P07-B — Capture/search/linking closure + attachment lifecycle
- **Goal**: E2E capture→attach→index/search→open→link-out bez utraty kontekstu.
- **Acceptance**: upload ma status + retry; search jest operator-grade (w zadeklarowanym baseline).
- **Evidence**: integracyjne testy + staging demo “attachment lifecycle”.
- **Tasks**:
  - Implement E2E flow capture→attach→index/search→open→link-out (bounded).
  - Implement upload error taxonomy + retry; ensure no silent drop.
  - Add integration tests and run staging attachment demo (5.2/5.3).
- **Staging proof script (click-by-click)**:
  1. Capture a new note from a non-note surface (bounded entry point).
  2. Attach a file and observe upload status; open preview/readback.
  3. Search for the note (and/or attachment text/metadata if in scope) and open it from results.
  4. Create a link-out to a work object (Radar/Inicjatywy) and verify context is preserved on landing.
  5. Induce an upload failure and verify retry + “what next” (no silent drop).
- **DoD**:
  - Search+linking works; attachments are reliable; provenance language is consistent.

#### P07-C — Verification + rollout
- **Goal**: telemetry + regresje + staging proof; rollout bez rozjechania linków.
- **Acceptance**: bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).
- **Tasks**:
  - Capture staging proofs (5.3) and fill ledger rows P07-A/B/C.
  - Validate rollback: disable AI/handoff; preserve notes + links.
- **DoD**:
  - Status `verified(evidence)` with complete ledger entries and known limits.

### 8.2 Rollout strategy
- Inkrementalnie: najpierw capture+readback, potem AI propose/review i downstream handoffs.

### 8.3 Rollback plan
- Wyłącz AI assist/handoff; zachowaj dostęp do notatek i linków; bez destrukcji danych.

## 9. Risks / open questions / decisions
- Ryzyko: “martwy inbox” (capture bez routingu do pracy).
- Ryzyko: upload bez recovery → utrata zaufania.
- Decyzje: minimalny zakres OCR/indexing vs jawne ograniczenia.

## 10. Evidence ledger (fill after delivery)
| Packet ID | Status | PR / commit | Tests (what + result) | Staging proof | Notes / known limits |
| --- | --- | --- | --- | --- | --- |
| P07-A | approved(scope) | `6761b7b279` | N/A — docs/scope only | N/A | Scope frozen: §2.3 canon (capture/provenance/attachments/search/linking+handoff); EXECUTION_INDEX #07 updated; lock P07-A created. |
| P07-B |  |  |  |  |  |
| P07-C |  |  |  |  |  |

