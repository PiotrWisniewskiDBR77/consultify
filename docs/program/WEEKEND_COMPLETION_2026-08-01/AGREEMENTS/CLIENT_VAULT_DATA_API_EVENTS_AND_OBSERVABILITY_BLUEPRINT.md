---
document_id: CLIENT-VAULT-DATA-API-EVENTS-OBSERVABILITY
module: My Work / Client Vault
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Client Vault — blueprint danych, API, zdarzeń i obserwowalności

## 1. Kanoniczne encje

| Encja | Odpowiedzialność | Kluczowe relacje |
| --- | --- | --- |
| `VaultSpace` | bezpieczny scope user/project/org | project, owner, policy |
| `VaultFolder` | hierarchia organizacyjna w space | parent, children |
| `VaultDocument` | logiczna tożsamość dokumentu | versions, relations |
| `DocumentVersion` | immutable binary/source snapshot | extraction/index versions |
| `SourceConnectorBinding` | zewnętrzne źródło i sync policy | external folder, vault |
| `DocumentExtraction` | tekst, struktura, OCR i anchors | document version |
| `DocumentIndexVersion` | chunks/embeddings/search config | extraction, model |
| `VaultCollection` | zestaw źródeł do pracy | document versions/query rule |
| `ReviewTable` | definicja analizy zbiorowej | corpus manifest, columns |
| `ReviewColumnVersion` | prompt/schema/validation | dependencies |
| `ReviewCellRun` | wynik per row/column/version | citations, review state |
| `KnowledgeBaseVersion` | zatwierdzony source manifest | audience, policy |
| `RetrievalManifest` | reprodukowalny kontekst runu | query/output/citations |
| `VaultRelation` | link do obiektu Consultify | source, target, relation type |
| `AccessPolicy/AuditEvent` | permission i dowód operacji | actor, resource, decision |

Obecny syntetyczny sejf wyliczany przez `GROUP BY scope/project/owner` może
pozostać read model dla trzech systemowych spaces. Rozbudowane sharing, policy,
retention i KB prawdopodobnie wymagają jawnej encji `VaultSpace` lub policy
record; nie wolno przeciążać folderu jako granicy bezpieczeństwa.

## 2. Identyfikacja i niezmienność

- document ID identyfikuje logiczny dokument;
- version ID identyfikuje bytes/source snapshot i checksum;
- extraction ID wskazuje parser/OCR version;
- index ID wskazuje chunking/embedding/search version;
- cytat zawsze wskazuje version + anchor, nigdy tylko filename;
- external ID + connector ID + tenant tworzą klucz dedup synchronizacji;
- soft delete nie może powodować ponownego ingestu jako „nowego” bez polityki.

## 3. API capability groups

### Spaces i browsing

`listSpaces`, `getSpace`, `listDocuments`, `listFolders`, `searchMetadata`,
`getDocument`, `getVersion`, `preview`, `listRelations`, `listActivity`.

### Mutations

`createUploadSession`, `completeUpload`, `createFolder`, `moveDocuments`,
`updateMetadata`, `changeScopeProposal`, `createVersion`, `archive`,
`deleteRequest`, `restore`, `reindex`, `retryFailed`.

### Analysis

`createAskRun`, `createDeepAnalysisRun`, `createReviewTable`, `runCells`,
`verifyCells`, `createKnowledgeBaseDraft`, `publishKnowledgeBase`,
`bindSourceToWorkflow`.

### Integrations

`previewConnectorFolder`, `createBinding`, `syncNow`, `getSyncState`,
`resolveConflict`, `reauthorize`, `disconnect`.

Każda mutation przyjmuje idempotency key i expected version, zwraca correlation
ID oraz authoritative object/read-back. Bulk endpoint zwraca success/failure per
item. Long-running actions zwracają job ID i nie udają synchronicznego sukcesu.

## 4. Zdarzenia domenowe

Minimum:

- `vault.document.uploaded|scanned|extracted|indexed|failed|quarantined`;
- `vault.document.version_created|metadata_changed|scope_changed|archived|purged`;
- `vault.connector.sync_started|completed|partial|failed|permission_lost`;
- `vault.review.created|run_completed|cell_verified|cell_flagged`;
- `vault.knowledge_base.published|updated|deprecated`;
- `vault.retrieval.executed|source_denied|citation_opened`;
- `vault.relation.proposed|accepted|rejected`.

Event zawiera tenant/resource/version/actor/purpose/correlation, ale nie pełną
treść dokumentu. Konsumenci są idempotentni. Notification service reaguje tylko
na zdarzenia wymagające działania człowieka.

## 5. Observability i SLO

Metryki produktu:

- time-to-ready p50/p95 według formatu/rozmiaru;
- extraction coverage i OCR confidence;
- indexing failure/partial/retry rate;
- search zero-result, citation-open i unsupported-claim rate;
- denied retrieval oraz cross-scope attempt rate;
- connector freshness/lag i permission drift;
- Review Table throughput, error i human correction rate;
- stale Knowledge Bases i overdue reviews;
- storage/index cost per organization/project.

Operacyjny dashboard pokazuje kolejki, poison files, parser/model versions,
failed jobs, connectors requiring reauth oraz ostatni audit anomaly. Alerty
mają runbook, severity, owner i bezpieczny link bez treści klienta.

Proponowane SLO dla staging do kalibracji: 99,9% poprawności policy decisions,
100% cytatów z istniejącym version/anchor, zero cross-tenant results, p95 upload
status response <2 s, a processing jako osobny async SLO zależny od rozmiaru.

## 6. Migration z obecnego modelu

1. Zablokować canonical semantics obecnych `knowledge_docs`, chunks i folders.
2. Dodać version/source/anchor bez łamania aktualnych list.
3. Wprowadzić centralną access policy i przepiąć list/search/RAG/tool calls.
4. Propagować caller user/project roles do retrieval.
5. Dodać manifest runów i cytowania.
6. Dopiero potem Collections, Review Tables i KB.
7. Connector binding korzysta z universal connector platform.
8. Backfill wykonuje raport braków i kwarantannę, nie zgaduje scope/version.

Każdy krok ma dual-read/porównanie, migrację idempotentną, rollback plan i test
na kopii danych staging. Nie usuwamy starej ścieżki przed potwierdzeniem parytetu.

## 7. Pytania do wspólnego odbioru

1. Czy jawna encja `VaultSpace` zastępuje syntetyczny GROUP BY, czy działa obok niego?
2. Jak długo przechowujemy stare extraction/index versions?
3. Czy retrieval manifest zawiera pełne query/prompt, czy redacted hash + metadata?
4. Jakie SLO czasu indeksowania deklarujemy użytkownikowi dla poszczególnych rozmiarów?
5. Czy audit ma być eksportowalny przez organizacyjnego admina w MVP?
