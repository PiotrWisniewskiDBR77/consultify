---
uiux_doc_id: UIUX_IDEA_NOTEBOOK
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Idea Notebook — UX contract (AI Context Notebook Engine)

## Purpose

Zdefiniować docelowy UX dla `Consultify Idea Notebook`: ultra‑szybkie przechwytywanie myśli oraz kontrolowane dojrzewanie notatek do idei, inicjatyw, tasków i artefaktów — jako **context engine**, nie “zwykły notatnik”.

## Naming

- **UI product name**: `Consultify Idea Notebook`
- **Architecture name**: `AI Context Notebook Engine`
- **Internal capability name**: `Thought-to-Initiative Engine`

## Applies To

- Notebook / Notes surface (user capture + rich note)
- Idea extraction + Initiative candidate flow (Idee/Inicjatywy)
- Note→Artifact conversions (Docs/Tables/Presentations/Tasks)
- Semantic search + resurfacing + digests
- Memory candidates + privacy/scope/governance

## Functional Modes (canonical)

- **Quick Capture**: zapis myśli w kilka sekund (bez kategorii przed zapisem)
- **Structured Note**: opcjonalna struktura (kontekst/obserwacje/decyzje/pytania/next steps/źródła)
- **Autonomous Enrichment**: AI dopisuje tytuł/summary/tagi/linki/kandydatów + confidence
- **Convert Note → Idea**: AI proponuje ideę, user zatwierdza, źródło to note
- **Convert Idea → Initiative (candidate)**: AI tworzy kandydat inicjatywy (nie “prawdziwą inicjatywę” bez approve)
- **Link Note to Context**: auto + manual + AI suggested linki do obiektów Consultify
- **Ask AI About Notes**: chat/Q&A nad notatkami z cytowaniem źródeł
- **Notes as Context for AI**: notatki zasilają kontekst wyłącznie przez governance (memory candidates, scope)

## Key Application Components (conceptual contract)

- **Quick Capture Interface**: globalny/łatwo dostępny zapis (tekst + chat-to-note + capture z kontekstu modułów)
- **Rich Note Editor**: blokowy rich editor (MVP: prosty, stabilny) + attachments + mentions
- **AI Note Parser / Enrichment Engine**: detekcja encji i generowanie sugestii (z confidence)
- **Context Linking Engine**: linkowanie do client/project/initiative/idea/task/doc/presentation/table/…
- **Idea Extraction + Initiative Conversion**: pipeline “thought → idea → initiative candidate”
- **Semantic Search Engine**: full-text + semantic + filtry (client/project/author/date/scope)
- **Memory Candidate Engine**: propozycje pamięci + approval + retencja + sensitivity
- **Note Governance Engine**: scope/confidentiality/permissions/audit/versioning/access history
- **Note Inbox / Review Queue**: centralny “decision inbox” dla notatek wymagających akcji
- **Daily/Weekly Intelligence Digest**: resurfacing + podsumowania tematyczne

## Core Objects (UX-visible invariants)

- **Note**:
  - **MUST** mieć `scope` i `confidentiality`
  - **MUST** mieć `author` + `created_at` + status lifecycle (np. `needs_review`)
- **AI Enrichment**:
  - **MUST** być jawnie oznaczone jako sugestia (z `confidence_score`)
  - **MUST NOT** auto-commit krytycznych akcji (link/convert/memory) bez approve
- **Idea**:
  - **MUST** mieć `source_note_ids` (traceability)
- **InitiativeCandidate**:
  - **MUST** powstawać jako kandydat (approval gate), nie jako automatyczna inicjatywa
- **MemoryCandidate**:
  - **MUST** mieć `approval_status`, `proposed_scope`, `sensitivity_level` i zasady retencji

## Must

- **MUST**: Quick Capture jest ultra‑lekki:
  - najpierw zapisujemy, potem porządkujemy,
  - UI nie wymaga kategorii/projektu/klienta przed zapisem,
  - zapis jest “seconds-fast”.
- **MUST**: Capture SLA:
  - notatka jest zapisana w mniej niż 3 sekundy od submit (docelowy P0).
- **MUST**: Notatka jest obiektem operacyjnym (nie tylko tekst):
  - ma scope (private/team/project/client/org),
  - ma confidentiality label,
  - ma ownership i status (np. needs_review),
  - ma linki do obiektów Consultify (manual + AI suggested).
- **MUST**: AI enrichment jest sugestią, nie prawdą:
  - każda sugestia ma confidence score,
  - krytyczne linki/konwersje wymagają approval (user control),
  - system unika “produkowania chaosu” przez automatyczne tworzenie inicjatyw bez zgody.
- **MUST**: Istnieje `Review Queue` / “Note Inbox”:
  - notatki bez kontekstu,
  - notatki z wykrytą ideą / taskami,
  - notatki wymagające decyzji (merge/convert/link/privacy/memory).
- **MUST**: Lifecycle prowadzi od notatki do działania:
  - note → idea (po approval),
  - idea → initiative candidate (po approval),
  - note/idea → task (po approval),
  - note → artifact seed (doc/table/presentation) jako kontrolowana konwersja.
- **MUST**: Memory candidate workflow:
  - nie każda notatka trafia do pamięci AI,
  - system proponuje memory candidate,
  - user (lub policy) zatwierdza/odrzuca,
  - prywatne notatki nie są używane poza dozwolonym scope.
- **MUST**: Search jest fundamentem:
  - full‑text + semantic (hybrid),
  - filtrowanie po scope/client/project/author/date,
  - “related notes / similar notes / possible duplicates”.
- **MUST**: Governance i bezpieczeństwo:
  - permissions i tenant boundaries są twarde,
  - audit trail działa dla zmian i dostępu,
  - UI nie myli “brak uprawnień” z “brak danych”.

## Must Not

- **MUST NOT**: Kopiować Notion 1:1 jako general‑purpose workspace.
- **MUST NOT**: Zmuszać usera do wypełniania formularza, zanim zapisze myśl.
- **MUST NOT**: Autonomicznie tworzyć inicjatyw jako “prawdy systemowe” bez jawnego approve.
- **MUST NOT**: Zapamiętywać wrażliwych notatek bez memory approval.

## Should

- **SHOULD**: Voice capture + transcript jako source reference (audio zachowane).
- **SHOULD**: Daily/weekly digests i resurfacing (najważniejsze idee, ryzyka, pytania).
- **SHOULD**: Linkowanie i “graph view” jako widok wtórny (po stabilnym capture/search).
- **SHOULD**: Note types (Quick Thought / Client Insight / Initiative Seed / Risk Note…) jako pomoc w porządkowaniu, nie bariera w capture.

## MVP Roadmap (canonical sequencing)

- **MVP 1 (P0)**: Quick capture + basic notes + autosave + tagi + manual client/project + podstawowe wyszukiwanie
- **MVP 2**: AI enrichment + classification + suggested links + Review Queue (bez auto-initiative)
- **MVP 3**: Note→Idea + Idea→InitiativeCandidate + duplicates + ownership suggestions
- **MVP 4**: Semantic search + memory candidates + context injection + privacy controls + (opcjonalnie) graph view
- **MVP 5**: Enterprise collaboration + permissions + audit/versioning + import/export + integracje cross-module

## Risks (product UX)

- **Risk**: UX zbyt ciężki → **Mitigation**: quick capture bez pól + porządkowanie później
- **Risk**: AI false positives (idee/inicjatywy) → **Mitigation**: confidence + review queue + candidate model
- **Risk**: “AI pamięta wszystko” → **Mitigation**: memory candidates + approval + scope/privacy by design
- **Risk**: notatnik jako śmietnik → **Mitigation**: Review Queue + digest + archive + lifecycle statuses

## Acceptance Criteria

- [ ] Quick capture zapisuje notatkę “od ręki” bez wyboru kategorii.
- [ ] Enrichment pokazuje tytuł/summary/tagi/linki z confidence + user może accept/reject.
- [ ] Review Queue zbiera notatki wymagające decyzji i chroni przed “śmietnikiem”.
- [ ] Konwersje note→idea→initiative są kontrolowane (approval + source note preserved).
- [ ] Memory candidates są jawne i wymagają zgody.
- [ ] Hybrid search znajduje notatki po znaczeniu i jest permissions‑aware.

## Related Sources

- `DRD/consultify/docs/UI_UX/45_PRIVATE_MODE_AND_MEMORY_UI.md`
- `DRD/consultify/docs/UI_UX/51_PERMISSIONS_AND_LOCKED_UI.md`
- `DRD/consultify/docs/UI_UX/52_TENANT_AND_ACL_SAFETY.md`
- `DRD/consultify/docs/UI_UX/53_TRACEABILITY_AND_SOURCE_UI.md`
- `DRD/consultify/docs/UI_UX/97_RAW_IDEA_NOTEBOOK_CONTEXT_ENGINE_2026-05-09.md`

