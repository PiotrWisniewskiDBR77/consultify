# C6 — next fix design (read-only, bez decyzji retencji)

Stan odniesienia: `0025c1c4484254ca29435ca0cc30638ba2bd889d`. Dokument projektowy, nie zgoda na implementację, migrację, DB ani live.

## 1. R4 — bezpieczny kontrakt populated deletion

### Twarde invariants

1. Nie wyłączać ani usuwać immutable triggerów, FK, NOT NULL i legal hold.
2. Nie kasować governed receipts/audytu tylko po to, by purge przeszedł.
3. Nie przepinać shared usera do arbitralnie wybranej organizacji. Dostęp B i dane B muszą pozostać bez zmian.
4. Operacja ma być idempotentna, mieć request digest i trwały wynik rozróżniający: `SUCCEEDED`, `REFUSED`, `OUTCOME_UNKNOWN`.
5. Dane produktowe A znikają atomowo albo całość się cofa. Receipt sukcesu nie powstaje przy odmowie/rollback.

### Wniosek po odczycie kanonu: nie ma dziś zgodnego physical-delete

Wariant tombstone + rebind jest odrzucony: `account_deletion_request_receipts` ma bezwarunkowy `BEFORE UPDATE OR DELETE`, więc nawet zmiana samych FK narusza immutable contract. `execution_budget_delete_receipts` ma taki sam zakaz i FK do `organizations`. Bez zmiany istniejącego kanonu nie da się jednocześnie fizycznie usunąć organization row i zachować te rekordy.

Jedyny wariant, który nie mutuje receipts, to **retained lifecycle identity in place**: zachować ten sam `organizations.id` jako niedostępną, logicznie usuniętą tożsamość referencyjną; usunąć dane produktowe i membership A; zanonimizować wyłącznie mutable PII organizacji w granicach istniejącego kanonu. Nie wolno nazywać tego physical delete ani uznać za spełnienie E4 bez decyzji produktowo-retencyjnej integratora. Jeśli canon nie zezwala na anonimizację organization row, jedynym poprawnym stanem jest `REFUSE`.

Nowe `organization_self_service_deletion_receipts` celowo nie ma FK do organizacji/użytkownika i może przeżyć physical delete, ale nie rozwiązuje wcześniejszych governed receipts.

### Macierz znanych rzeczywistych klas

| Tabela/klasa | Referencje | Ochrona | PII/identity | Bez decyzji |
|---|---|---|---|---|
| `account_deletion_request_receipts` | RESTRICT do `gdpr_requests`, `organizations`, `users` | UPDATE i DELETE zawsze odrzucone | org/user/request identity, status, czas | `RETAIN_AS_IS`; wymusza zachowanie wszystkich trzech anchors |
| `gdpr_requests` dla receipt | parent `request_id` | parent chroniony przez RESTRICT | request lifecycle może zawierać PII | `RETAIN_ANCHOR`; anonimizacja tylko po istniejącej zgodzie canon |
| `execution_budget_delete_receipts` | FK do `organizations` i `execution_action_registry` | UPDATE i DELETE zawsze odrzucone | org/actor/result identity | `RETAIN_AS_IS`; wymusza org/action anchors |
| `ai_agent_job_attempts` | FK do `ai_agent_job_receipts` | attempts UPDATE/DELETE odrzucone | worker/error metadata | `RETAIN_AS_IS`; parent receipt nie może być skasowany, gdy ma attempts |
| `organization_self_service_deletion_receipts` | brak FK do lifecycle rows | UPDATE i DELETE odrzucone | kopia nazwy/email aktora | nowy terminal receipt; jego PII/retencja też wymaga jawnego canon |
| shared `users`/`organization_members` | user może należeć do A i B | brak prawa do arbitralnego rehome | bezpośrednie PII użytkownika | usuń tylko membership A; zachowaj user i B bez zmian |

Pełna macierz musi powstać z read-only katalogu wszystkich FK i aktywnych triggerów na własnej kopii po zwolnieniu slotu. Powyższa lista jest minimalnym znanym zestawem ze źródeł, nie deklaracją kompletności.

### Alternatywy wymagające decyzji

- Retained identity/anonymize-in-place: jedyny obecnie możliwy kierunek bez UPDATE receipts, ale wymaga decyzji, które pola anchors wolno anonimizować i czy logiczne usunięcie spełnia cel produktu.
- Controlled refusal dla governed history: jedyny zatwierdzalny stan przejściowy bez nowej decyzji i poprawny rollback, ale nie zamyka E4.

### Plan odbioru DEL-RECEIPT-01

Fixture wyłącznie normalnymi writerami: A z request→cancel receipt, budget-delete receipt i zależnym child receipt; B; shared user A+B; oddzielny user A; legal hold OFF. Najpierw dry-run plan z count/klasą bez danych wrażliwych. Następnie apply przez real ApiGateway/JWT.

Odbiór po ewentualnej decyzji retained identity: A nie jest dostępna ani listowana jako aktywny tenant; wszystkie dane produktowe A objęte macierzą PURGE nie istnieją; B, membership B i dane B są byte-for-byte niezmienione; immutable receipts i ich anchors istnieją bez UPDATE; dozwolone PII anchors są zanonimizowane zgodnie z decyzją; brak sierot; terminal receipt ma digest/counts; replay nie tworzy mutacji. Jeśli decyzja nadal wymaga physical delete organization row, test ma oczekiwać `REFUSE`, ponieważ istniejące RESTRICT+immutable czynią ten wynik niewykonalnym bez zmiany canon.

### Plan wyniku po COMMIT

Audit emission po COMMIT nie może zmienić sukcesu w pozorny rollback. Endpoint zapisuje terminal receipt w transakcji; po utracie ACK klient wykonuje readback po idempotency key/request digest. Fault injection po COMMIT ma zwrócić sukces z trwałego receipt albo `OUTCOME_UNKNOWN` z instrukcją bezpiecznego readback, nigdy zachętę do ślepego powtórzenia.

## 2. Legal hold i export — deterministyczna kolejność

Wzorzec implementacyjny wymaga dedykowanego clienta i **session-level advisory lock przed transakcją**: `SELECT pg_advisory_lock(key)` → dopiero po uzyskaniu `BEGIN ISOLATION LEVEL REPEATABLE READ` → pierwszy snapshot-producing SELECT policy → export → COMMIT/ROLLBACK → `pg_advisory_unlock(key)` w `finally`. Sam `SELECT pg_advisory_xact_lock` wykonany już wewnątrz REPEATABLE READ może ustanowić snapshot przed oczekiwaniem, więc nie jest wystarczający dla absent-row race. Authorization wykonuje się przed session lockiem osobnym read path i jest ponownie związana z org identity w zablokowanej transakcji.

Client z session lockiem nie może wrócić do puli, dopóki unlock nie został potwierdzony. Przy błędzie unlock/utracie połączenia należy zniszczyć/discard client, nie `release()` go do puli. Timeout/cancel musi również przejść przez tę ścieżkę cleanup.

Canonical policy writer zachowuje ten sam klucz przez istniejący transaction-level advisory lock przed SELECT/INSERT/UPDATE. Session lock eksportu i xact lock writera konfliktują w tej samej przestrzeni; absent row jest więc serializowany przed utworzeniem snapshotu eksportu, a existing row dodatkowo przez row lock.

### EX-HOLD-ABSENT

1. Brak `org_policies` row.
2. Sesja writer bierze advisory lock i rozpoczyna canonical pierwszy INSERT hold=1, ale nie commit.
3. Uruchomiony HTTP GET export musi być widoczny jako oczekujący na ten sam advisory lock (sprawdzić backend PID/`pg_stat_activity`, nie sleep).
4. Writer COMMIT; export po locku tworzy snapshot, widzi hold i zwraca 423 bez pliku dla JSON i CSV.
5. Mutacja usuwająca advisory lock ma dać RED dla tego samego fullName.

### EX-HOLD-EXISTING

Analogicznie dla istniejącego hold=0 aktualizowanego canonical writerem do 1. Osobno release 1→0 przed snapshotem ma pozwolić na eksport. W obu przypadkach sprawdzić brak częściowego body/Content-Disposition przy 423 i spójność z istniejącą data-export route.

## 3. Kolejne obowiązkowe próby

- EX-SCHEMA: read-only inventory ledger + aktywne tenantowe relacje `public`/`v8`; jawny covered-set manifest. Dla relacji wieloorganizacyjnych określić pole owner vs counterpart; `OR` po wszystkich FK nie może automatycznie oznaczać prawa do wszystkich pól.
- E3-COST-CONCURRENT: kontrolowany lokalny provider bez zewnętrznego klucza; atomowa rezerwacja maksymalnego kosztu przed providerem, settle/refund po rzeczywistych tokenach, N równoległych żądań nie przekracza limitu. Fail recordUsage nie może być tylko logiem.
- E3-MEMBERSHIP: revoked membership dla GET usage i PUT settings → 403, brak SQL mutation; błąd membership read → 503.
- E3-RESET-RACE: reset i record/reservation w kontrolowanym przeplataniu; brak drugiego zerowania po naliczeniu.
- E1: każda operacja create klikana od pustej organizacji, z disabled/dead-button/error/empty-action assertions i screenshotami.
- E2: seeded KPI widoczne w rzeczywistym rejestrze UI.
- E5: Feedback → admin journal UI z organization, user, route, appVersion i browser; tenant/admin negative controls.

## 4. Kolejność po zwolnieniu slotu

1. Export hold absent/existing serialization.
2. R4 decyzja macierzy retencji; bez niej tylko refusal test, bez schema mutation.
3. Public/v8 inventory i manifest truthfulness.
4. E3 reservation/settlement, membership i reset races.
5. E1, E2, E5 UI gaps.
6. Server tsc, frontend esbuild per touched file, per-file tests retry=0, RED→GREEN, nowe exact-SHA independent review.
