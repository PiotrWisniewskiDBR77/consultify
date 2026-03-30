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
| P07-A |  |  |  |  |  |
| P07-B |  |  |  |  |  |
| P07-C |  |  |  |  |  |

