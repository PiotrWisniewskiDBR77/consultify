# P0 Approve RBAC — niezależna weryfikacja

**Weryfikator:** niezależna sesja (nie autor naprawy).
**Worktree:** `/Users/piotrwisniewski/consultify-wt/fv3p-f-baseline`
**Gałąź:** `codex/fv3p-p0-approve-rbac` @ `65b85028f1`. Baza porównania: `ee5736a5a6`.
**Baza testowa:** `127.0.0.1:54330`, cztery jednorazowe klony `fv3_template`
(`p0_verify`, `j4_verify`, `full_verify1`, `full_verify2`) — wszystkie usunięte
(`dropdb`) po zakończeniu. Zero połączeń do demo/staging/produkcji.
**Metoda mierzenia exit code:** zawsze `cmd > plik 2>&1; code=$?` — nigdy przez potok.
**Metoda cofania mutantów:** wyłącznie `git show 65b85028f1:<plik> > <plik>`, potwierdzone
pustym `git diff` po każdym. Żaden `git stash`/`reset`/`clean` nie był użyty.

## Tabela werdyktów

| # | Twierdzenie | Mój niezależny pomiar | Werdykt |
|---|---|---|---|
| 1 | Bramka ma dwie niezależne warstwy | 4 mutanty odtworzone osobiście: (a) trasa wyłączona (`if (false && ...)` w `models.routes.ts:121`) → serwis sam blokuje viewera (test `viewer cannot approve` PASS); (b) serwis wyłączony (`artifactVersionService.ts:733`) → trasa sama blokuje (PASS); (c) obie wyłączone, wywołanie `approveVersion()` **bezpośrednio** (bez HTTP) → viewer **zatwierdza** (`result.ok:true`, `approved_by:` viewer, `status:APPROVED`) — potwierdza realną podatność w izolacji, brak trzeciej ukrytej warstwy; (d) obie wyłączone przez HTTP → viewer dostaje **200** zamiast 403 (`expected 200 to be 403`) — dokładna reprodukcja P0. **Realna liczba warstw: 2, dokładnie jak deklarowano.** | **POTWIERDZONE** |
| 2 | `APPROVE_ALLOWED_ROLES` pochodzi z tego samego źródła co `/capabilities` | **NIEPRAWDA w sensie strukturalnym.** `APPROVE_ALLOWED_ROLES` (artifactVersionService.ts:665) to osobna, ręcznie wpisana stała `['approver', 'finance_admin']`. `allowedActionsFromStatus()` (lifecycleService.ts:201-203) ma **własny, oddzielny** literał `role === 'approver' \|\| role === 'finance_admin'` — nie importuje ani nie odwołuje się do `APPROVE_ALLOWED_ROLES`. To dwa niezależne literały, dziś zgodne z przypadku/konwencji komentarza, NIE przez wspólne źródło/import. Rozjazd **jest** możliwy przy pierwszej zmianie jednego z nich bez drugiego — dokładnie ryzyko, przed którym ostrzegał zleceniodawca. Autor sam napisał w komentarzu „not by construction" ale nagłówek twierdzenia w zleceniu nazywa to „tym samym źródłem" — to nieścisłość do naprawienia (najtaniej: jeden literał importuje drugi). | **CZĘŚCIOWO** — wartości zgodne dziś, źródło NIE jest strukturalnie wspólne |
| 3a | Uogólniony przegląd capability↔endpoint dla 9 akcji | Uruchomiłem `approveRbacGate.pg.test.ts` samodzielnie: **20/20 PASS**, w tym pełny zamiatający test dla 9 akcji (`submit_for_review, withdraw, start_review, request_changes, resume_editing, approve, archive, invalidate, reopen`) × role `viewer`/`preparer`. | **POTWIERDZONE** |
| 3b | Przegląd ma wartość dowodową (wykryłby oryginalny P0) | Mutant (d) powyżej **jest** przypadkiem `action=approve` z tego samego zamiatającego testu — po wyłączeniu obu bramek test dla tej akcji **poczerwieniał** (`expected 200 to be 403`). Przegląd faktycznie się czerwieni, gdy bramka znika. | **POTWIERDZONE** |
| 3c | `createComputeSnapshot()` bez kontroli roli | Zweryfikowane DWOMA sposobami: (1) czytanie kodu — `versions.routes.ts` (trasa `POST /versions/:id/compute-snapshot`) w ogóle nie wyciąga `userRole`; `CreateComputeSnapshotParams` (artifactVersionService.ts) nie ma pola `role`; (2) empirycznie — realne wywołanie HTTP jako `viewer` na świeżej bazie zwróciło **201** z prawdziwym `computeSnapshotId`. Nowy, realny, niezałatany defekt (poza allowlistą tej naprawy). | **POTWIERDZONE** |
| 4 | Filtr edytorów — czy klon z `reopenVersion()` jest wykluczony i czy filtr nie jest za wąski | Empirycznie: klon z reopen ma `revision_seq=11` (>1, artefakt-scoped, monotoniczne — nigdy nie resetuje się do 1) i `checkpoint_source=NULL` → **wykluczony** przez filtr, dokładnie jak deklarowano. Ten sam approver po reopen ponownie zatwierdza bez fałszywego `SELF_APPROVAL_FORBIDDEN` (`reapprove.ok:true`). Sprawdziłem WSZYSTKIE 4 produkcyjne miejsca `INSERT INTO finance_working_revisions`: `createArtifact` (revision_seq=1 → łapane drugą gałęzią OR), `checkpointOperationStack`/autosave (checkpoint_source = enum `CheckpointSource` ∈ {AUTOSAVE, EXPLICIT_SAVE, CRASH_RECOVERY_RESTORE}, nigdy pusty), `financeImportService` Excel import (checkpoint_source='EXPLICIT_SAVE' na sztywno), `reopenVersion` klon (jedyny bez obu). **Dla dzisiejszego kodu filtr NIE jest za wąski** — każda prawdziwa edycja ma albo checkpoint_source, albo revision_seq=1. Ryzyko rezydualne: to gwarancja **konwencji**, nie ograniczenia bazodanowego (CHECK/NOT NULL) — przyszła ścieżka zapisu do tej tabeli, która zapomni ustawić `checkpoint_source`, cicho wpadnie w tę samą dziurę bez ostrzeżenia na poziomie schematu. | **POTWIERDZONE obie strony** (nie za szeroki, nie za wąski — dla obecnego kodu), z odnotowanym ryzykiem konwencji |
| 5 | Brak mutacji przy odmowie | `approveRbacGate.pg.test.ts` używa osobnego `pg.Client` (`verifyClient`, własny socket TCP) do weryfikacji każdej odmowy — potwierdzone czytając kod testu i uruchamiając go (20/20 PASS, w tym asercje `after.version === before.version`, `after.approved_by === null`). Dodatkowo mutant (d) pokazuje odwrotność: gdy bramki naprawdę zniknęły, ten sam niezależny odczyt SQL pokazuje realną mutację (`status: APPROVED`) — dowód, że kontrola SQL faktycznie coś mierzy, a nie tylko czyta ciało HTTP 403. | **POTWIERDZONE** |
| 6 | Sonda J4: 37/37 PASS | Uruchomiona samodzielnie na świeżej izolowanej bazie (`j4_verify`): **37 checks, 0 FAIL**, `duration 1121ms`. Liczby zgodne co do jednego. Uwaga poboczna: opis `RULE-SOD-EDITOR-NOT-SUBMITTER-GAP` w kodzie sondy wciąż statycznie brzmi „GAP: ... not caught" (tekst sprzed naprawy), ale jego żywa ewaluacja `pass:` poprawnie odzwierciedla naprawiony stan dla przypadku „twórca artefaktu = edytor" (revision_seq=1) — to nieaktualność opisu w komentarzu sondy, nie fałszywy wynik. | **POTWIERDZONE** |
| 7 | Pełny zestaw realDB finance-v2+canonical: 656/656 | Odtworzone dokładną komendą z raportu autora na świeżej bazie: `Test Files 60 passed (60)`, `Tests 656 passed (656)`, exit 0. **656 jest solidne i powtarzalne.** Różnicy względem „659" z weryfikacji J1 **NIE udało się ustalić** — w tym worktree/branchu nie istnieje żaden ślad raportu J1 ani liczby 659 w kontekście testów (grep po całym `docs/validation/finance-v3/generated/` nie znajduje pasującego raportu). Sprawdziłem alternatywną hipotezę „szerszy zakres" — komenda z `src/services/finance` (bez ograniczenia do `canonical/`) daje **924**, nie 659, więc to nie jest prosta różnica zakresu katalogu. Źródło rozbieżności jest poza tym diffem i nie jest w tej sesji możliwe do zweryfikowania. | 656: **POTWIERDZONE**; rozbieżność z 659: **NIE DA SIĘ ZMIERZYĆ** w tej sesji |
| 8 | `tsc` czysto + wszyscy callerzy `approveVersion` sprawdzeni | `npx tsc -p tsconfig.json --noEmit`: exit 0, 0 linii wyjścia, ~8s (kod mierzony bez potoku). `grep -rn "approveVersion(" server/src` poza testami: dokładnie **jeden** produkcyjny caller — `models.routes.ts:143`. Ryzyko odnotowane zgodne z ostrzeżeniem zlecenia: `server/tsconfig.json` wyklucza `**/*.test.ts`, więc nowy plik testowy `approveRbacGate.pg.test.ts` nie jest objęty tsc (esbuild w vitest nie sprawdza typów) — ale sama bramka bezpieczeństwa (`models.routes.ts`, `artifactVersionService.ts`) JEST objęta i przeszła czysto. | **POTWIERDZONE** |
| 9 | Brak osłabienia 8 testów | `git diff --name-only ee5736a5a6..65b85028f1 -- "*.test.ts"` zwraca **wyłącznie** nowy plik `approveRbacGate.pg.test.ts`. **Zero** istniejących plików testowych (w tym `lineageFreshnessService.pg.test.ts`, gdzie żyje `reopenAndApprove`) zostało dotkniętych w finalnym diffie. To rozstrzyga pytanie wprost: 8 testów, które popsuła pierwsza wersja poprawki (commit `83b2060295`, „UNVERIFIED — test bramki roli, praca przerwana"), zostały naprawione przez doprecyzowanie **kodu produkcyjnego** (filtr `checkpoint_source`/`revision_seq=1`), nie przez zmianę ich asercji — bo gdyby zmieniono asercje, te pliki musiałyby pojawić się w diffie, a nie pojawiają się. | **POTWIERDZONE** |
| 10 | Allowlista | `git diff --stat ee5736a5a6..65b85028f1`: dokładnie 7 plików — `artifactVersionService.ts`, `models.routes.ts`, 2 nowe raporty `.md`, nowy `j4-rbac-probe.ts` + `run_probe.sh`, nowy `approveRbacGate.pg.test.ts`. **Zero** dotknięcia `FinanceHub.tsx`, workspace'ów, `financeV2.api.ts`. | **POTWIERDZONE** |

## Liczba realnych warstw obrony (punkt 1)

**Dokładnie 2**, potwierdzone empirycznie w izolacji (mutant c: bezpośrednie wywołanie
`approveVersion()` z obiema bramkami wyłączonymi kończy się realnym `APPROVED` z
`approved_by` = viewer — brak trzeciej ukrytej warstwy, np. SoD czy walidacji statusu,
która przypadkiem broniłaby tego ataku). Obie warstwy niezależnie wystarczające
(mutant a, mutant b).

## Rozstrzygnięcie filtra edytorów (punkt 4)

Za szeroki? Nie — jedyny wykluczony wiersz (klon z reopen) genuinie nie jest edycją treści.
Za wąski? Nie dla obecnego kodu — wszystkie 3 produkcyjne ścieżki zapisu edycji zawsze
ustawiają `checkpoint_source` lub mają `revision_seq=1`. Ryzyko: to gwarancja konwencji
aplikacyjnej, nie ograniczenie schematu bazy — przyszła ścieżka zapisu bez `checkpoint_source`
przy `revision_seq>1` cicho ominie wykrycie. Warto rozważyć CHECK/komentarz-strażnik przy
tabeli `finance_working_revisions`, ale to nie blokuje tej naprawy.

## Nowe defekty znalezione (potwierdzone niezależnie)

- **`createComputeSnapshot()` (T8a, `versions.routes.ts` + `artifactVersionService.ts`) nie ma
  ŻADNEJ kontroli roli** — potwierdzone czytaniem kodu i realnym wywołaniem HTTP jako `viewer`
  (201, prawdziwy `computeSnapshotId`). To defekt tej samej klasy co pierwotny P0, ale **poza
  allowlistą tej naprawy** — świadomie udokumentowany przez autora jako pozostałe znalezisko,
  nie ukryty. Wymaga osobnego fixa/ticketu.
- Rozbieżność 656 vs 659 (punkt 7) pozostaje niewyjaśniona w tej sesji — nie blokuje werdyktu
  dla TEJ naprawy (656/656 jest wewnętrznie spójne, powtórzone dwukrotnie na świeżych bazach),
  ale warto ją domknąć przy następnej okazji, żeby nie zostawiać rozjazdu w rejestrze liczb.

## Werdykt końcowy

**PASS** dla samego P0 (`POST /models/:modelId/approve` bez bramki roli) — naprawa jest
realna, dwuwarstwowa, zweryfikowana niezależnie na wszystkich 10 punktach zlecenia, bez
osłabienia istniejących testów. Defekt 2 (maker-checker) jest świadomie i poprawnie
udokumentowany jako **częściowy** (editorUserIds naprawione, reviewStartedBy nadal bez
źródła danych — brak kolumny `review_started_by`), zgodnie z twierdzeniem autora — nie
oceniam tego jako ukryte niedopowiedzenie.

Dwa zastrzeżenia do odnotowania w rejestrze, żadne nie unieważnia P0:
1. „Ten sam sourced" (punkt 2) jest nieścisłe — to dwa zgodne dziś literały, nie jedno
   źródło; tani do naprawienia (import).
2. `createComputeSnapshot()` to żywy, potwierdzony, niezałatany gap tej samej klasy —
   powinien dostać własny P0/P1 ticket, nie czekać na kolejny audyt żeby go „odkryć" ponownie.
