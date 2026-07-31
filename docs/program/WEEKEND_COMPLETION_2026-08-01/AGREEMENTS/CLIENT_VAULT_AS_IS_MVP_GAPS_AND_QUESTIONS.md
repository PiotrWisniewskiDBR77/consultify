---
document_id: CLIENT-VAULT-AS-IS-MVP-GAPS-QUESTIONS
module: My Work / Client Vault
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Client Vault — AS-IS, luki MVP i zbiorczy rejestr pytań

## 1. Stan potwierdzony kodem

| Obszar | Dowód | Ocena |
| --- | --- | --- |
| My Work navigation | `MyWorkHub`, redirect starego `/vault` | real |
| Lista sejfów | `VaultSafesTable`, `/knowledge/vault-safes` | real |
| 3 scope | user/project/organization + membership filters | real/partial |
| Dokumenty/foldery | `VaultDocumentsView`, `VaultDocumentPanel`, migration | real |
| Office ingest | `documentTextExtractor` + testy | partial |
| AI search | `search_knowledge_base`, RAG services | real/partial |
| Privacy tests | list, org scope, RAG, tool scope | real, niepełna macierz |
| Review Tables / KB | brak pełnej powierzchni Client Vault | gap |
| Connectors/sync | platform contracts istnieją, Vault flow niekompletny | gap |
| Versions/retention/sharing | brak kompletnego runtime | gap |

## 2. Priorytety

### P0 — stabilny staging i golden flow

1. Przenieść caller identity do całego RAG, aby właściciel mógł bezpiecznie użyć
   dokumentów prywatnych; zachować fail-closed dla innych użytkowników.
2. Zweryfikować każdy jawny `vault_project_id` server-side względem membership;
   argument modelu/UI nie jest dowodem dostępu.
3. Jedna policy function dla list/preview/download/retrieval/export i pełna
   macierz negatywnych testów tenant/user/project.
4. Domknąć upload → scan → extract → index → preview → ask → citation oraz
   naprawę błędu indeksowania na świeżej bazie.
5. Dodać source/version/page anchors i reprodukowalny retrieval manifest.
6. Domknąć project roles, AI visibility, sensitivity i bezpieczny scope change.
7. Usunąć feature-flag/degraded ambiguity: użytkownik widzi prawdziwy stan.

### P1 — kompletne MVP produktu

- Collections i pierwsza Review Table z eksportem XLSX/CSV;
- Knowledge Base draft/review/publish i użycie w Chat/Agent;
- import folderu z co najmniej jednego connectora z one-way sync;
- wersje, dedup, canonical version i impact warning;
- audit dostępu/retrieval/download/share;
- archive, retention i dependency-aware delete;
- linkowanie z Materials, Initiatives, Tasks, Decisions, Tools i Assessment;
- accessibility, mobile scan/upload oraz stany partial/stale/conflict.

### P2

- Shared Spaces/external collaboration;
- wiele DMS, advanced DLP/ethical walls i client-managed keys;
- batch editing, rozbudowane playbooki i deep analysis agents;
- automatyczne knowledge curation z pełnym human governance.

## 3. Golden flows

1. Private: upload DOCX → index → owner Ask z cytatem → drugi user nie widzi
   metadata, search result ani fragmentu odpowiedzi.
2. Project: członek dodaje PDF → project lead zatwierdza AI visibility → Teresa
   używa w projekcie → usunięcie membership natychmiast odbiera dostęp.
3. Organization KB: curated collection → review → publish → Chat/Agent używa tej
   samej wersji → update pokazuje stale outputs.
4. DMS sync: podłączenie minimal scope → folder preview → initial sync → update →
   source deletion policy → reauth failure i recovery.
5. Review: 20 dokumentów → kolumny → wyniki z cytatami → human corrections →
   export i handoff do Materials/Initiative.
6. Delete/retention: dependency preview → archive/grace/hold → purge wszystkich
   warstw danych → audit/tombstone.

## 4. Zbiorczy rejestr pytań

Pytania pozostają w końcowych sekcjach pięciu dokumentów pakietu. Podczas
końcowego odbioru należy odpowiedzieć kolejno na: naming i granicę produktu,
publikację Knowledge Bases, external sharing, domyślny scope, nawigację, foldery,
formaty Review Table, limity ingestu, pliki szyfrowane, P0 connector, politykę
usunięcia w DMS, sposób przechowywania źródła, łączenie z wiedzą ogólną,
obowiązkowość cytatów, reliability score, authoritative fragments, retencję
manifestu, break-glass, okresy retencji, zmianę sensitivity i ethical walls.

## 5. Ocena

`PASS_DOC / PARTIAL_RUNTIME / SECURITY_P0_OPEN`.

Fundament tabel, scope, folderów i indeksowania istnieje. Nie wolno jednak
ogłosić pełnego Client Vault przed naprawą prywatnego retrieval, sprawdzeniem
project membership dla każdego wejścia oraz przejściem sześciu golden flows.

## 6. Definition of Ready zadania implementacyjnego

Zadanie może wejść do kodowania dopiero, gdy ma: `VLT-F-*`, user job, AS-IS
evidence, encje i właściciela prawdy, roles/capabilities i deny cases, API z
idempotency/expected version, wszystkie stany UI, rolę AI i source/citation
policy, audit/events/metrics, testy oraz migration/rollback, jeśli dotyka danych.

## 7. Definition of Done funkcji

Funkcja działa na świeżej bazie, PL/EN, dla owner/member/viewer/denied, na
rzeczywistym pliku, z retry, audytem i poprawnym powrotem. AI ma poprawny cytat
i uczciwe `not found`; sync dowodzi create/update/delete/permission loss;
mutation dowodzi read-back. Każda powierzchnia przechodzi wizualny odbiór
desktop/mobile przed pokazaniem jej właścicielowi.
