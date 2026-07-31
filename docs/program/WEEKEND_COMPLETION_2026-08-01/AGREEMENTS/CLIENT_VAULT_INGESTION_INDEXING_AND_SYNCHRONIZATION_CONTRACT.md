---
document_id: CLIENT-VAULT-INGESTION-INDEXING-SYNC
module: My Work / Client Vault
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Client Vault — ingest, indeksowanie i synchronizacja

## 1. Źródła wejściowe

- lokalny upload plików i folderów;
- SharePoint, OneDrive, Google Drive, Box i docelowo systemy klienta przez
  wspólny connector/MCP-like control plane;
- e-mail i załączniki po jawnym wyborze użytkownika;
- URL/web snapshot z datą i źródłem;
- outputs z modułów Consultify jako jawna publikacja lub link;
- skan/zdjęcie z OCR.

Podłączenie ma działać według standardu `connect → capabilities → minimum scope
→ bind to vault → initial scan → preview → activate`. Moduł nie otrzymuje tokenu.

## 2. Pipeline dokumentu

1. Intake zapisuje immutable source record, checksum, autora i destination.
2. Malware scan, MIME verification, limit, password i DLP zatrzymują ryzyko.
3. Dedup rozpoznaje identyczny plik i proponuje wersję/link, zamiast kopii.
4. Parser zachowuje tekst, strukturę, strony, tabele, obrazy i metadane.
5. OCR działa dla skanów z confidence i wskazaniem słabych stron.
6. Klasyfikacja proponuje język, kategorię, sensitivity, tagi i relacje.
7. Chunking respektuje semantykę sekcji/tabel, zachowuje page/section anchors.
8. Embeddings oraz indeks keyword zapisują wersję parsera/modelu/chunkera.
9. Quality check porównuje strony, tekst, fragmenty i wymagane metadane.
10. Dokument przechodzi w `ready`, `partial`, `failed`, `quarantined` albo
    `requires_approval`; użytkownik dostaje konkretną instrukcję.

## 3. Lifecycle i wersje

Lifecycle pliku: `uploading → scanning → extracting → indexing → ready` z
odgałęzieniami `partial`, `failed`, `quarantined`, `archived`, `deleted`.

Nowa treść tego samego źródła tworzy nową immutable version. Link logiczny
wskazuje canonical version. Cytat zachowuje wersję używaną w odpowiedzi.
Reindex nie zmienia wersji źródła, lecz tworzy nową wersję indeksu. Każdy etap
jest retryable i idempotentny; błędy jednego pliku nie blokują całej paczki.

## 4. Synchronizacja

Domyślny DMS sync jest one-way do Vault i read-only dla źródłowych plików.
System zachowuje folder tree, external ID, source URL, version/etag i ostatni
sync. Dodanie, zmiana, przeniesienie i usunięcie są odzwierciedlane według
skonfigurowanej polityki. Konflikt nigdy nie jest rozwiązywany cicho.

Tryby: manual refresh, scheduled polling, webhook/event. Stan connectora:
`connected`, `syncing`, `healthy`, `stale`, `partial`, `reauth_required`,
`permission_lost`, `error`, `disabled`. Wyłączenie connectora nie usuwa danych
bez osobnej polityki retencji.

## 5. Format support i jakość

MVP: PDF, DOCX, XLSX, PPTX, TXT/MD, CSV oraz popularne obrazy z OCR. E-mail/ZIP
tylko po bezpiecznym unpack i limitach. Dla arkuszy indeksujemy wartości,
formuły, sheet/range anchors i tabele; dla prezentacji slajd/notes; dla DOCX
heading/table/comment anchors. Preview i cytat muszą prowadzić do właściwej
strony, slajdu, arkusza albo sekcji.

## 6. Pytania do wspólnego odbioru

1. Jakie maksymalne rozmiary pliku, folderu i sejfu przyjmujemy dla MVP?
2. Czy pliki chronione hasłem obsługujemy na staging, czy oznaczamy unsupported?
3. Które connectory są P0: SharePoint, OneDrive, Google Drive czy Box?
4. Jak traktować usunięcie pliku po stronie DMS: archive, tombstone czy delete?
5. Czy przechowujemy oryginał lokalnie, czy dla części connectorów tylko indeks/cache?
