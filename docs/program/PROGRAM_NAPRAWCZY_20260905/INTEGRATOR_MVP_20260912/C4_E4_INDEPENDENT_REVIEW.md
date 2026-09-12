# C4 E4 — niezależny review, 2026-09-12

Przedmiot: dokładny commit `172d56adeb9578b5b81f0eafb7f204f4f59f35e2` w C4. **E4 całość HOLD: potwierdzony P1 w cleanup. E4.1 CI i E4.2 pilot — ACCEPT ograniczonego zakresu źródeł i wskazanych autorskich dowodów lokalnych**, bez niezależnego powtórzenia całej macierzy i bez autoryzacji live. Przeczytano pełną 01_INSTRUKCJA.md, 98_RAPORT.md, HANDOFF-ACTIVE.md, E4_LOCAL_ACCEPTANCE.json, trzy skrypty operacyjne, harness, testy i zmianę workflow. Źródła produktu/repo pozostają nietknięte, nie wykonano live.

## P1 — migawka sprzed blokady pozwala skasować klon po włączeniu legal hold

Miejsce: `scripts/dane/sprzatanie-klonow-demo-session-20260912.mjs:29–33` oraz `:47–49`; `scripts/dane/codex4-ops-safety.mjs` connect rozpoczyna SERIALIZABLE. Pierwsze discoverOrganizationScopedColumns wykonuje rzeczywisty SELECT z katalogów, ustanawiając migawkę transakcji. Późniejszy LOCK TABLE nie odświeża migawki. Inserty zakończone w luce discovery→lock pozostają niewidoczne dla kwalifikacji.

Po wskazaniu ryzyka integrator autoryzował wyłącznie nową bazę `cx4_review_cleanup_race` na istniejącym lokalnym `cx-codex4-pg`, loopback6455. Zweryfikowano mapowanie5432→127.0.0.1:6455 i PostgreSQL18.6. Sprawdzono brak tej bazy przed CREATE; nie zmieniano cx4_pilot/cx4_cleanup ani innych baz. Baza ma minimalne7tabel obejmujących dokładne zapytania skryptu. org_policies bezFK odpowiada definicji zastanego baseline `server/migrations/20260719_baseline_gap.sql:6819` (nie dowodzi bieżącego schematu live).

**Realny RED:**
1. Niezmieniony runCleanup zaczyna SERIALIZABLE i kończy catalogSELECT.
2. Instrument zatrzymuje powrót z zapytania, druga rzeczywista sesja robi INSERT org_policies(legal_hold_enabled=1) i COMMIT.
3. Pierwsza sesja uzyskuje rzeczywisty LOCK i odczytuje **0** polityk ze starej migawki.
4. Niezmieniony canonical lifecycle usuwa organizację; CLI wynik `committed:true`, `receiptWritten:true`, `deleted:1`.
5. Świeży PGreadback: **organizacja0, legal_hold1** — organizację skasowano mimo wcześniej zatwierdzonej ochrony, polityka została osierocona.

To nie hipotetyczne niepokrycie testem. Instrument nie zmienia SQL, wyniku query ani guardów: wrapper pg.Client.query zapewnia wyłącznie deterministyczną kolejność dwóch rzeczywistych połączeń. Brak FK umożliwia konkretną anomalię; SERIALIZABLE może ułożyć historię cleanup przed insertem i nie musi wywołać40001. Samo podniesienie izolacji nie zastępuje świeżej kwalifikacji po blokadzie.

Dowody: `codex4-scratch/review-cleanup-race/repro.mjs`, `result.json` SHA256 1175752628db7b8645fe33301f7817b3c78dd0d269e352f11299228158a4bff2. W tym katalogu także prywatny before.dump, target i manifest; nie publikować ich hurtem. Przed próbą wykonano prawdziwy pg_dump i pg_restore --clean --if-exists **wyłącznie w tej nowej bazie**, następnie odczyt sentinel. Nie deklarujemy pełnego restore wszystkich1833tabel dla tej dodatkowej próby. Sama minimalna baza pozostała do review, nie jest oglądana przez użytkowników.

**Naprawa do wydania autorowi:** zapewnić świeżą migawkę kwalifikacji po uzyskaniu wszystkich wymaganych blokad. Rozważyć READ COMMITTED przy zachowaniu tabelowych blokad przez kwalifikację/delete, albo przeprojektować kolejność blokad tak, aby chronione tabele były zablokowane przed pierwszym SELECT ustanawiającym snapshot; sam ruch dynamicznego discovery wymaga ostrożności. Wybrać rozwiązanie po realnym RED→GREEN tej samej próby i drugim scenariuszu, gdzie druga sesja próbuje zapisu już po lock. Nie akceptować wyłącznie unitmock. Wdrożenie cleanup na staging HOLD; przygotowanie/fix lokalny może postępować.

## Ograniczony ACCEPT pozostałych elementów

### CI

Diff workflow ogranicza się do dodania staging do push/pull_request oraz istniejących warunków uruchamiania; brak nowych deployjobów. Stat85+/85− to powtarzane warunki, nie zmiana85rodzin testów. Report uczciwie odróżnia parse/konfig od zielonego rzeczywistego CI i historyczny czas failure od prognozy. Actual staging run/duration NOT_PROVEN, nie blokuje przyjęcia poprawki wyzwalania.

### Konta pilotażu

Dokładnie4potwierdzone adresy wDBR77; nowe MEMBER, istniejące role user/membership zachowane, brak membership/inactive/foreign/ambiguous odmawia. Tabelowy lock w pilot poprzedza pierwszy odczyt kwalifikacji; nie ma tego samego discovery-before-lock wzorca. Nie nadpisuje sharedorg ani zgód prawnych. Brak product forced passwordchange i żywe accessJWT doexpiry opisane jawnie.

Prywatny manifest icredentials0600/wx, canonical parent path poza checkoutem, fsync pliku i katalogu przedCOMMIT. Odmowa zapisu credentials powoduje rollback; utrataACK ma osobnyUNKNOWN, nie fałszywy rollback. Brak receipt po potwierdzonymCOMMIT nie odwraca wyniku. Backup związany zhost/port/db ihashem; wymagany fullcustomdump i osobny dowódrestore, którego treść musi sprawdzić człowiek. Nie ma magicznegoPASS przyjmowanego jako odtwarzalność. Refresh odwołany, reset usunięty; accessJWT limitation pozostaje.

Autorskie realne4loginy, zachowanie ról, powtórna rotacja bez nowychUUID, tokenbeforevalid/afterinvalid, actualSQLrollback outputcollision i freshreadback po exception po realCOMMIT są właściwymi typami dowodów. W tym review odczytano źródła/harness i surowe wyniki, nie logowano ponownie na te konta i nie odczytywano credentials. To source/evidence acceptance do integracji, nie niezależny retest runtime ani upoważnienie rozdania haseł.

## Cleanup — co już działa w badanym wycinku, czego nie wolno uogólniać

ExactID, nie wybór po nazwie; kontrola DEMO/nonpaying/expiry, bazowe/protectedID, seedemail, primary+membership, orphan/externalmembership, obie datylogin, legalhold, activesession. Cała partia kwalifikowana przed pierwszymdelete; canonical lifecycle z exactorgpredicate i savepointFKretry, nie własna kolejność kasowania. Fullbackup potrzebny dla dzieciCASCADE bezorganization_id. Te zabezpieczenia mają sens, ale nie usuwają P1 czasowej szczeliny.

Z autorskich8plików restore-evidence odczytano exit0 i równość obu map1833wpisów (public tablehash/count, sekwencje, largeobjects). To sprawdzenie zachowanych danych dowodowych, nie ponowne wykonanie dump/restore. Surowe8faz wynikowych zgodne z agregatem: późniejszy initiative-probe uzupełnia wcześniejszeNOT_PROVEN; późniejszepilot-security/faults uzupełniają token/COMMITprobe. Nie ukryto wcześniejszych błędówharnessu.4source mutants kasująchronione rekordy na osobnychkopach i mają odpowiadające guardrefusal; mutantorganizationalpredicate/template nadal nie wykonany.

## Pozostałe bramki

- Naprawiony i dwusesyjnie potwierdzony raceP1; dalsza próba członkostwa/session/hold poLOCK.
- Mutation canonical orgpredicate i template; rollback przy błędzie w rzeczywistym cleanup po częściowychdelete (pilot storagefault tego nie dowodzi).
- Realna utrata sieci/ACK/powerloss nieudowodniona; injectedclientexception tylko klasyfikacjaunknown, już uczciwie opisane.
- Aktualne20klonów wstaging i konfiguracja schedulera UNKNOWN; lokalny0nieobala historycznego raportu i nie dowodzi przyczyny. Scheduler nietknięty.
- TLS handshake/operator remote i faktycznyCIstaging nieuruchomione. Manifest środowiska i aktualny dryrun muszą zostać oddzielnie odebrane przedlive.

Nie wymaga się nowego pełnego builda lub tsc dla tego odczytu. Root może integrować zaakceptowane techniczne przygotowanie z jawnym HOLD cleanup, lecz nie przedstawiaćE4 jako w pełni zamkniętego bezpieczeństwa operatora. Autorowi należy wydać odrębną poprawkę P1, bez rozszerzania projektu.
