---
module_id: MODULE_MY_WORK
function_id: MW_CLIENT_VAULT
function_name: Client Vault / Sejf klienta
doc_kind: FUNCTION_CONTRACT
status: active
owner: product
last_updated: 2026-07-31
---

# Function Contract — Client Vault / Sejf klienta

> Kompletny pakiet zaczyna się w [`MY_WORK_CLIENT_VAULT_REVIEW.md`](../../../program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/MY_WORK_CLIENT_VAULT_REVIEW.md), a uczciwa ocena runtime znajduje się w [`CLIENT_VAULT_AS_IS_MVP_GAPS_AND_QUESTIONS.md`](../../../program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/CLIENT_VAULT_AS_IS_MVP_GAPS_AND_QUESTIONS.md).

## Tożsamość i cel

- Route: `/my-work?tab=vault`; legacy `/vault` przekierowuje do My Work.
- Job: bezpiecznie przechowywać, porządkować, analizować i udostępniać AI
  dokumenty stanowiące kontekst organizacji, projektów i użytkownika.
- Właściciel prawdy: Knowledge/Vault domain; moduły downstream przechowują link
  i manifest źródła, nie kopię dokumentu.

## Wejścia i wyjścia

Wejścia: upload, folder, skan, connector/DMS, link i jawna publikacja artefaktu
Consultify. Wyjścia: cytowana odpowiedź, Review Table, zatwierdzona Knowledge
Base, finding/insight oraz proposal obiektu downstream. Każde wyjście zachowuje
document ID, version, anchor, scope i provenance.

## Runtime

Komponenty: `ClientDocumentsVault`, `VaultSafesTable`, `VaultDocumentsView`,
`VaultDocumentPanel`. Backend: `knowledge.routes`, `KnowledgeService`,
`documentTextExtractor`, RAG/search tool oraz `vault_folders`. Obecny model
posiada scope `user/project/organization`, foldery, status indeksowania,
chunk count, kategorie, tagi, sensitivity i AI visibility.

## Invariants bezpieczeństwa

- tenant i project membership są sprawdzane na serwerze dla każdej operacji;
- parametr przekazany przez UI/model nie poszerza uprawnienia;
- AI respektuje te same ACL co preview/download;
- prywatne źródło może ugruntować odpowiedź tylko właściciela;
- cytat wskazuje konkretną wersję i fragment;
- brak dostępu nie ujawnia nazwy, snippetów ani liczby wyników;
- zmiana scope, publikacja, export i delete mają audit oraz human approval.

## Bramka MVP

Nie uznajemy funkcji za gotową, dopóki nie przejdą: private retrieval owner-only,
project membership negative tests, upload-to-citation, connector sync, Review
Table, Knowledge Base publish/use i dependency-aware retention/delete.
