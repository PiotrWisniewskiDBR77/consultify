# CODEX DAY 371 — karty propozycji w czacie

Data: 2026-09-05. Stan: **PARTIAL / rdzeń D-3 naprawiony, R4 STOP produktowo-licencyjny**.

## Tożsamość i izolacja

Instrukcję odczytano w całości z `github-backup/grafika/m03-20260902`, przed
pracą. Dosłowny wynik kontroli markera: `MARKER OK`. Dosłowny sanity:
`9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c` i pusty `git status --short`.
Praca odbyła się w `/private/tmp/cx-day371-karty-propozycji`, na gałęzi
`codex/day371-karty-propozycji-20260905`. Nie dotknięto checkoutu właściciela
poza dozwolonym symlinkiem `node_modules`. Baza: wyłącznie 6442; runtime 5582
nie był potrzebny. Kontener `cx-day371-pg` został usunięty po testach.

Rozbieżność względem ruchomej gałęzi wydania była oczekiwana: start nastąpił
dokładnie z markera, bez merge/rebase/cherry-pick. Słowniki na markerze i po
dyżurze: `pl=35200`, `en=33067`; nie zmalały. Liczby autora instrukcji były
wyższe, bo pochodziły z równolegle zmienianej gałęzi, nie z przypiętego markera.

## D-3 — dowód i naprawa

RED na realnym remoncie pokazał, że `ChatTableProposalCard` z zamrożonym
`pending` po ponownym montażu nadal oferował wykonanie mimo żywego `executed`.
Po zmianie komponent pobiera `getSchemaProposal`, a stan lokalny jest wyłącznie
optymistyczną nakładką na własną akcję. Typowany konflikt 409 przełącza kartę
w stan wykonany; pozostałe błędy zachowują istniejącą obsługę. Callback w
`MessageRenderer` nie jest już no-opem, ale świadomie pozostaje diagnostyczny,
bo w licencji brak trwałego magazynu rodzica.

Mutacja przez odtworzenie starego komponentu: RED; odtworzenie poprawki z kopii
i diff 0: dwa testy ChatTable GREEN. Szczegóły: `evidence/day371-karty-propozycji/R2-live-status.md`.

## RODZINA KART PROPOZYCJI — STAN PO DYŻURZE

| Karta | Źródło stanu | Remount | Decyzja |
|---|---|---:|---|
| ChatTableProposalCard | żywy GET + optymistyczna nakładka | GREEN po RED | naprawiony w tym dyżurze |
| TeresaProposalCard | prop kopiowany do bieżącej propozycji | GREEN | już był poprawny |
| ExecutionProposalMessage | freshProposal + żywy store | GREEN | już był poprawny |
| GovernedChatHandoffCard | `proposal.state` z props | GREEN | już był poprawny |
| GovernedInitiativeHandoffCard | lokalny stan; brak licencjonowanego live source | RED | STOP z licencją |

Pełna suita porównawcza: 22 przypadki, 21 PASS i jeden jawny RED powyżej; zero
skip. Diff `fullName` zachowuje wszystkie 16 wcześniejszych nazw i dodaje sześć
nowych. Nie przedstawiam świadomego testu RED jako zielonej suity.

## R3 — realny ApiGateway, JWT i PostgreSQL

Pierwszy POST zwrócił `200`, zapisał `status=failed` i
`resolved_at=2026-09-05T07:50:30.246Z`. Drugi zwrócił `409`,
`code=PROPOSAL_ALREADY_EXECUTED`, a readback miał dokładnie to samo
`resolved_at`. Fikstura miała realny `target.base_id`; nie wpadła w pułapkę
pustych `operations`. Miarodajny przebieg verbose: 1/1 PASS, bez retry.

Uruchomienie z roota zakończone `No test files found` było błędem komendy, nie
PASS. Dwa późniejsze reporty JSON zatrzymały się przed asercją podczas ciężkiej
inicjalizacji ApiGateway i oznaczyły test jako skipped; również nie są liczone
jako dowód. Szczegóły i ograniczenie: `evidence/day371-karty-propozycji/R3-realpg-conflict.md`.

## CASE INTAKE — WERDYKT I DLACZEGO

**STOP.** Rachunek kosztu dosłownie: A wymaga zmiany producenta/składania
odpowiedzi poza `AIChat/**`, więc koszt w licencji jest niewykonalny; B usuwa
245 linii, lecz osieroca plik poza licencją i zmienia reachability
`app 3053→3051`, `unreachable 717→718`, więc zostało w całości odwrócone.
Po odwróceniu liczby wróciły do 3053/717. Dowód:
`evidence/day371-karty-propozycji/R4-case-intake-stop.md`.

## §0.2e — pułapki dla uruchomionych pakietów

- Front RTL: dotyczyły (e1) i (e4). Test remountu podaje celowo stale metadata,
  mockuje żywy GET i sprawdza wyrenderowany wynik; osobno używa właściwego
  store dla ExecutionProposalMessage. Nie używa bazy ani bramek (a)-(d).
- Server RealPG: dotyczyły (a)-(e3). Jedna linia środowiska zawierała
  `ENABLE_V8_GLOBAL=true`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`,
  `MOCK_DB=false DB_TYPE=postgres`, `ENABLE_TEST_AUTH_BYPASS=false`; log podał
  `DB_IDENTITY ... 127.0.0.1:6442/cx371`. Operacja miała realny baseId, a brak
  FK workspace zweryfikowano przed seedem. `assertRealPostgresTestEnvironment()`
  wywołano bez argumentów.
- Reachability i trzy skanery kanonu: nie przechodzą przez runtime/auth/DB ani
  kod kart, więc (a)-(e) nie wpływają na ich wynik; dowodem są ich wejścia jako
  statyczny graf importów i skany plików.

## Bramki wspólne i artefakty

Po zmianach: `focus-canon=0`, `list-canon=0`, `artefakt=0`, `reach=1`.
Reach pozostaje czerwony wyłącznie przez dwa nazwane pliki test-only:
`src/components/Initiatives/__tests__/initiativeKartaRealnyRekord.test.ts` oraz
nowy `src/components/AIChat/__tests__/day371.proposalFamily.remount.test.tsx`.
Baseline nie był zmieniany. Artefakty są poza repo w
`/private/tmp/cx-day371-karty-propozycji-artefakty/`; m.in. SHA-256:
`po.json=23cebe9f...`, `fullnames.diff=eccfa9ce...`,
`r4-reach-before.txt=16c0ef48...`, `r4-reach-after.txt=6c3bf153...`.

SMTP: **Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru
nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani
żadnego drenażu outboxu. Nie wysłałem żadnej wiadomości.** Pomiar środowiska:
`BRAK ZMIENNYCH POCZTY`; zapytanie settings: 0 wierszy; grep drenów w
ApiGateway: 0 trafień.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano produkcyjnego F5 w przeglądarce ani wdrożenia.
- Nie zweryfikowano zachowania na urządzeniu ani akceptacji właściciela.
- Nie udowodniono, że GovernedInitiativeHandoffCard ma właściwy żywy kontrakt;
  pomiar dowodzi przeciwnie i pozostaje STOP.
- Nie udowodniono produktu Case Intake w głównym czacie; nie ma producenta.
- Niestabilność inicjalizacji ApiGateway w reporterze JSON nie została usunięta.

## PYTANIA DO WŁAŚCICIELA

1. Czy funkcja „potwierdzenie nowej sprawy wprost z czatu” ma w ogóle wejść do
   produktu w obecnym kształcie (Teresa sama rozpoznaje „nową sprawę” z treści
   rozmowy), czy to zbyt ryzykowne bez jawnej komendy użytkownika?
2. Czy osobny dyżur może objąć producenta wiadomości oraz
   `src/components/CaseWorkspace/apiIntake.ts`, aby wariant A lub pełne
   usunięcie B nie łamały granic i reachability?
3. Jaki kanoniczny żywy kontrakt ma zasilać status
   GovernedInitiativeHandoffCard po remoncie?
