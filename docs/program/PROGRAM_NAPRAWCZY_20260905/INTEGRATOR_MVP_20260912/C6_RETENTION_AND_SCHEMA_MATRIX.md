# C6 — retention and schema matrix

Data: 2026-09-12. Zakres: read-only katalog własnego `cx-codex6-pg:6457/cx6_swieza` po identity check oraz odczyt źródeł/SSOT. Nie odczytano wierszy aplikacyjnych, nie uruchomiono API, nie zmieniono source/schema/data. Metadane: `C6_RETENTION_AND_SCHEMA_METADATA.json`.

## Wniosek wiążący

Istniejący SSOT rozstrzyga sprawę bez nowej ogólnej decyzji: `docs/program/evidence/closure/codex/SET-MVP-DELETE-001/DECISION_PACKET.md` ma status **APPROVED_RESTRICTED_SCOPE / DESTRUCTIVE_EXECUTION_OFF**. Dopuszcza request/status/cancel i jawnie **nie dopuszcza anonymization ani purge**. Wszystkie komórki macierzy irreversible action/retention są `UNKNOWN`; blank oznacza `NOT_AUTHORIZED`.

W konsekwencji obecna trasa physical organization deletion nie ma kanonicznej podstawy do wykonania na populated tenant. Ani rebind receipt, ani retained-identity anonymization, ani physical purge nie są obecnie autoryzowane. Jedynym zgodnym zachowaniem dla governed history jest kontrolowana odmowa/rollback. To chroni dane, ale nie zamyka E4.

## Tożsamość i rozmiar schematu

Identity: `cx6_swieza`, rola `consultify`, żądany endpoint `127.0.0.1:6457`; serwer zgłosił adres kontenera `172.17.0.7:5432`, `pg_is_in_recovery=false`.

| Schemat | Tabele | Kandydaci tenant-scoped | Obecny export |
|---|---:|---:|---|
| `public` | 1802 | 1282 | tak, dynamic discovery |
| `v8` | 121 | 111 | nie |

`securityManifest.complete:true` jest zatem niezgodne z fizycznym katalogiem tej kopii. Aktywne biznesowe tabele `v8` obejmują m.in. conflict records/resolutions, content governance, context snapshots, execution runs/signals, output artifacts/exports, provenance ledger, retrieval traces, session insights, workspace sessions i permissions. Nie wolno automatycznie eksportować wszystkich: credentials/auth states wymagają osobnej klasy security, a relacje multi-org osobnej polityki owner/counterparty.

## FK do głównych anchors

| Anchor | CASCADE | NO ACTION | RESTRICT | SET NULL | Wniosek |
|---|---:|---:|---:|---:|---|
| `organizations` | 187 | 97 | 6 | 14 | physical delete wymaga więcej niż dynamicznej kolejności tabel |
| `users` | 96 | 74 | 5 | 95 | shared user nie może być usunięty ani rehomed heurystycznie |
| `gdpr_requests` | 0 | 0 | 1 | 0 | receipt blokuje usunięcie request anchor |

Na kopii jest **109 public + 1 v8** tabel tenant-anchored z aktywnym DELETE guardem typu immutable/append-only/exception. To nie jest jeden specjalny przypadek receipt, lecz dominujący kontrakt governance w licznych modułach.

## Macierz lifecycle/receipt

| Klasa | Przykłady z aktywnego schematu | Anchor/ochrona | PII lub poufna treść | Obecna decyzja |
|---|---|---|---|---|
| Account deletion lifecycle | `account_deletion_request_receipts`, `gdpr_requests` | trzy FK RESTRICT do request/org/user; receipt odrzuca UPDATE i DELETE | user/org/request identity, status, timestamps; reason/metadata w parent | RETAIN przez constraint, ale purge/anonymization `NOT_AUTHORIZED` |
| Execution receipts | `execution_budget_delete_receipts`, `execution_action_audit`, backfill/quarantine | org/action NO ACTION; append-only guards | actor, entry/initiative, reason, result/source snapshots | immutable; irreversible treatment `UNKNOWN` |
| Finance command/source receipts | kilkadziesiąt `finance_*_receipts`, manual mapping decisions, lineage | zwykle org i często user NO ACTION; DELETE/UPDATE guards | `response_json`, `snapshot_json`, source filename, entity name, reason/model snapshots | approved artifacts pozostają w lineage; prawne usunięcie tylko przez nieustaloną retention/GDPR policy |
| Context/tool/results evidence | context upload/bindings, candidate handoffs, initiative closure, RVN receipts | org/user anchors; append-only/immutable | snapshots, provenance, observation payload, actor identity | nie ma zgody na purge/anonymization |
| Partner/audit/security | partner ledgers, audit domain events, backup access audit, operational alert ledgers | często multi-org i actor; immutable | actor/user/org, request/payload/detail JSON | retention/legal/privacy ownership wymagane; obecnie `UNKNOWN` |
| AI job ledger | `ai_agent_job_receipts` → immutable `ai_agent_job_attempts` | child NO ACTION do receipt | worker/error metadata, payload digest, user/org identity in parent | parent purge blokowany przez child; brak zatwierdzonego treatment |
| New org deletion receipt | `organization_self_service_deletion_receipts` | celowo bez FK; UPDATE/DELETE odrzucone | **target name, actor email, free-text reason, deleted_counts JSON**, actor/org identifiers | sam przeżywa delete, ale jego własna PII retention jest `UNKNOWN` |
| Shared identity | `users`, `organization_members`, 270 FK do users | membership A i B mogą wskazywać ten sam user | profil/login/identity | usuwać najwyżej membership A po przyszłej decyzji; user i B pozostają |

## Ekspozycja retained receipts

- `execution_budget_delete_receipts` ma kanoniczny reader w `executionBudgetDeleteCommandService`, który wymaga aktywnego membership, action policy, minimal role oraz dokładnego org/entry/initiative/idempotency/actor scope.
- `account_deletion_request_receipts` jest zapisywany przez trigger; Settings czyta status z `gdpr_requests`, nie znalazłem product route zwracającej surowy receipt.
- `organization_self_service_deletion_receipts` jest obecnie zapisywany przez ownership route. Nie znaleziono product readera; surowy odczyt istnieje w testach/SQL. Brak readera nie usuwa ryzyka: przechowuje nazwę organizacji, email aktora, free-text reason i JSON counts bez ustalonej retencji.
- Obecny tenant export wyklucza kolumny dopasowane do security pattern, ale retained receipt PII nie jest security credential. Jeśli receipt trafi do eksportu przez scope, admin może zobaczyć `actor_email`, `target_organization_name`, `reason` i payload/result JSON. To wymaga jawnej polityki privacy, a nie maskowania jako secret.
- SuperAdmin/audit access pozostaje szerszą powierzchnią. Każdy przyszły reader musi używać minimalnej projekcji, canonical role/membership lub platform-role guard, nie `SELECT *`.

## Już zapisane decyzje retencji i ich granice

1. `SET-MVP-DELETE-001`: destructive execution OFF; request/cancel/status only; no anonymization/purge.
2. `DEC-FIN-007`: approved finance artifacts nie mają zwykłego hard delete; pozostają Superseded/Archived/Invalidated. Prawne usunięcie/anonimizacja wyłącznie przez kontrolowaną politykę retention/GDPR/legal hold z autoryzacją i audytem.
3. `OrgPoliciesService` i V4 contract: legal hold blokuje delete/export; brak tabeli ma legacy exception, błąd odczytu ma fail closed.
4. `compliance.data-retention`: domyślne 365 dni user data, 730 audit, 90 backups oraz `anonymizeInactiveUsers=false`; endpoint przechowuje ustawienia, lecz nie jest zatwierdzonym executorem tenant purge.
5. `retentionPolicyService`: tiered cleanup dotyczy wybranych AI conversations/messages/memory/feedback/logs/metrics; łapie błędy per tabela i nie stanowi kompletnego, audytowalnego organization-delete engine.
6. `data_retention_policies`: ma `auto_delete` i `archive_before_delete`, ale CRUD polityki nie dowodzi wykonania, backup/restore ani zgody na immutable governance classes.

Nie znaleziono obowiązującej decyzji pozwalającej zanonimizować organization/user/request anchors lub PII wewnątrz immutable receipts. Nie wolno wywodzić takiej zgody z samych pól konfiguracyjnych.

## Wpływ na następny kod

Do czasu zmiany wiążącego SSOT:

- organization delete dla populated/governed tenant powinien zwrócić kontrolowaną odmowę przed pierwszą mutacją;
- nie wolno tworzyć success receipt, jeśli nic nie zostało usunięte;
- obecna trasa nie może deklarować pełnego E4 ani gotowości pilotażu;
- można naprawić niezależny race legal-hold/export i prawdziwość manifestu exportu, ale nie implementować purge/anonymization executor.

Po ewentualnym zatwierdzeniu nowej wersjonowanej macierzy wymagane są osobne decyzje dla każdej klasy, backup/restore, jurisdiction, effective date, approvers, exception process i evidence invalidation. Dopiero wtedy projekt techniczny może wybrać physical purge, retained anchors lub anonimizację — per klasa, nie globalnym heurystycznym algorytmem.

## Ograniczenia audytu

- Katalog bazuje na metadanych aktywnej lokalnej kopii, nie na staging/live.
- `tenantScopedCandidates` to szeroki heurystyczny zbiór nazw/FK; jest użyteczny do ujawnienia pominięć, nie jest automatyczną polityką dostępu.
- Liczba immutable tables obejmuje aktywne triggery pasujące semantycznie; szczegółowe zachowanie każdego warunkowego triggera wymaga per-table testu przed przyszłym executorem.
- Nie wykonywano `SELECT` danych użytkowników ani countów per tenant.
