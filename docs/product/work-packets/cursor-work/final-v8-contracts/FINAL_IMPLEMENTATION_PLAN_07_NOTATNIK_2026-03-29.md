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

