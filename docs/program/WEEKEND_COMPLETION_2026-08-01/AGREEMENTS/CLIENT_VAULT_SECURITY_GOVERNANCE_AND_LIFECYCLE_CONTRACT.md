---
document_id: CLIENT-VAULT-SECURITY-GOVERNANCE-LIFECYCLE
module: My Work / Client Vault
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Client Vault — bezpieczeństwo, governance i lifecycle

## 1. Model dostępu

Effective access jest przecięciem: tenant isolation, vault scope, project
membership, application role, project role, document ACL, sensitivity,
AI visibility, connector permission i legal/ethical wall. Deny ma pierwszeństwo.
Search, preview, download, AI retrieval, export i share wykonują ten sam policy
check po stronie serwera.

Role zasobu: `owner`, `full_access`, `editor`, `contributor`, `viewer`.
Oddzielne capabilities: view metadata/content, upload, edit metadata, manage
versions, run analysis, view prompts, download, duplicate, export, share,
publish KB, manage ACL/retention i delete.

## 2. Klasyfikacja

Sensitivity: `public`, `internal`, `confidential`, `restricted`. AI visibility:
`allowed`, `requires_approval`, `blocked`. Te osie są odrębne. AI proponuje
klasyfikację, ale podniesienie dostępności lub obniżenie sensitivity wymaga
uprawnionego człowieka. Scope change pokazuje impact na odbiorców, workflowy,
Knowledge Bases i istniejące wyniki.

## 3. Ochrona zawartości

- viewer może mieć wyłączone download, duplicate, export i prompt visibility;
- link sharing nie może obchodzić uwierzytelnienia ani ACL;
- external sharing ma expiry, watermark, domain allowlist i revocation;
- szyfrowanie in transit/at rest, secret vaulting connectorów i klucze zarządzane
  zgodnie z polityką infrastruktury;
- malware quarantine i DLP przed udostępnieniem AI;
- logi nie zawierają treści dokumentu ani tokenów;
- preview-as-user pozwala ownerowi sprawdzić realny dostęp przed share.

## 4. Audyt i administracja

Audit obejmuje upload/import, preview, retrieval, cytowanie, download/export,
share, zmianę ACL/scope/sensitivity, publish/deprecate KB, zmianę retencji,
archive/delete/restore i działania admina. Zdarzenie ma actor, subject, action,
timestamp, organization/project, purpose, result i correlation ID.

Admin widzi health indeksowania/sync, orphaned sources, stale KB, permission
drift, failed connectors, storage, koszty i anomalie eksportu. Nie uzyskuje
automatycznie treści prywatnego sejfu; break-glass ma powód, czas, alert i audyt.

## 5. Retencja i usuwanie

Polityka może działać per organizacja, projekt/klient, kategoria i dokument.
`Archive` ukrywa z aktywnej pracy, ale zachowuje cytowania. `Delete request`
przechodzi grace period, dependency/hold check i zatwierdzenie. Legal hold
blokuje usunięcie. Po purge usuwamy oryginał, tekst, chunks, embeddings, cache i
kopie zgodnie z polityką, pozostawiając minimalny tombstone/audit.

Offboarding projektu lub użytkownika wymaga transferu ownership, decyzji o
retencji, odpięcia workflowów i raportu danych. Nie wolno pozostawiać osieroconych
Knowledge Bases ani aktywnych connector tokens.

## 6. Pytania do wspólnego odbioru

1. Czy organizacyjny admin może zobaczyć zawartość Mojego sejfu w break-glass?
2. Jakie domyślne okresy retencji przyjmujemy dla private/project/organization?
3. Czy external sharing i watermark są wymagane w MVP?
4. Kto może obniżyć sensitivity lub zmienić `AI blocked` na `allowed`?
5. Czy potrzebujemy ethical walls/deny groups już na staging?

## 7. Domyślna macierz capabilities

| Capability | Owner | Full access | Editor | Contributor | Viewer |
| --- | --- | --- | --- | --- | --- |
| view metadata/content | tak | tak | tak | tak | tak |
| upload/create version | tak | tak | tak | tak | nie |
| edit metadata/folders | tak | tak | tak | własne/dozwolone | nie |
| run Ask/Review | tak | tak | tak | tak | wg content controls |
| verify Review cells | tak | tak | tak | przypisane | nie |
| download/duplicate/export | tak | tak | tak | wg policy | wg content controls |
| share/manage members | tak | tak | nie | nie | nie |
| change scope/sensitivity | tak | wg policy | nie | nie | nie |
| publish Knowledge Base | wg publish role | wg publish role | nie | nie | nie |
| retention/hold/delete | owner/admin policy | nie | nie | nie | nie |

Project membership, deny group, sensitivity, ethical wall, connector ACL, legal
hold i polityka organizacji mogą wyłącznie zawężać te uprawnienia.

## 8. Obowiązkowe testy negatywne

| Próba | Oczekiwany wynik |
| --- | --- |
| user A podaje ID private user B | deny/404 bez metadata leak |
| member projektu A podaje project ID B | deny mimo tego samego tenant ID |
| model zmienia `vault_project_id` | effective scope pozostaje server-derived |
| viewer woła download API mimo blokady | deny po stronie serwera |
| connector odbiera permission | natychmiast brak search/retrieval/preview |
| chunk pozostaje po ACL/delete | policy wyklucza go przed retrieval |
| cross-tenant search | zero wyników i bez leak count/timing |
| bulk zawiera niedozwolony plik | per-item deny, bez privilege bypass |
| wygasły/revoked link | nie otwiera bytes ani preview |
| document prompt injection | treść nie zmienia system/tool policy |
| malicious file/ZIP bomb | quarantine przed parser/index |

Test samego UI nie jest dowodem. Macierz obejmuje list, detail, bytes, search,
BM25/vector, Ask, Review, export, sync oraz każde wywołanie narzędzia AI.
