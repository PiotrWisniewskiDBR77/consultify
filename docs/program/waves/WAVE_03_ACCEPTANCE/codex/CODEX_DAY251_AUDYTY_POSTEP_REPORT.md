# CODEX DAY 251 — Audyty / Postęp — raport dyżuru

## Streszczenie

Naprawa `8510fcb01d` jest obecna na markerze `df7f13056f` i trzyma: jawne mapowanie
liczników, fail-closed przy rozjeździe kontraktu, test negatywny, mock o kształcie serwera
oraz cztery obrazy mutacyjne są obecne. Pakiet kontraktowy przeszedł przed i po zmianach
dokumentacji z identycznym zestawem 15 pełnych nazw. Dopisano wyłącznie sprostowania do
czterech licencjonowanych dokumentów; kod produktu i rejestr decyzji pozostały nietknięte.

## Wejście, marker i zasoby

`git merge-base --is-ancestor df7f13056f github-backup/codex/m03-admin-20260824`:
`MARKER OK`.

Sanity po utworzeniu worktree:

```text
df7f13056fa24995be07f64b0e8c877b3faeab45
```

`git status --short | head -3` nie zwrócił wierszy. Przed startem porty `6242`, `5222`
i `5223` nie miały listenerów. Wolne miejsce: 12 GiB przed worktree i 9.6 GiB po
migracjach. Użyto wyłącznie kontenera `cx-day251-pg` na `127.0.0.1:6242`, bazy `cx251`.
Oba pełne przebiegi migracji zakończyły się sukcesem; drugi podał `Applying migrations: 0`.
Logi: `/private/tmp/cx-day251-audyty-postep-artefakty/migracje-1.log` i `migracje-2.log`.

Tip gałęzi bazowej uciekł do przodu. Zakres `df7f13056f..github-backup/codex/m03-admin-20260824`
zapisano w `/private/tmp/cx-day251-audyty-postep-artefakty/r1-input.txt`; zgodnie z regułą
rozejścia pracę rozpoczęto dokładnie z markera, bez rebase.

## R1 — potwierdzenie naprawy

- T1: `git merge-base --is-ancestor 8510fcb01d HEAD` → `naprawa OBECNA`.
- T2: `mapProgramSummaryRow()` używa `requiredCount()` i rzuca
  `AUDITS_API_CONTRACT_ERROR` dla brakującego lub niepoprawnego licznika.
- T3: test `rejects a programs list row missing the service counters instead of rendering
  "/" and blank cells` istnieje i wykonał się zielono.
- T4: mock `/audits/programs` serializuje `criteriaTotal`, `criteriaConcluded` i
  `findingsOpen`; pola klienckie są destrukturyzowane przed utworzeniem odpowiedzi.
- T5: commit `8510fcb01d --stat` dodaje cztery PNG PRZED/PO; wszystkie cztery są obecne.
- T6: `status.json:2459` ogranicza ocenę A do Biblioteki i kieruje Sesje do odbioru.
- T7: grep SHA `8510fcb01d` w czterech dokumentach przed zmianą był pusty.
- T8: po wejściu pozostawało 9.6 GiB wolnego miejsca.

Pełne wyjścia T1–T8: `/private/tmp/cx-day251-audyty-postep-artefakty/r1-input.txt`.

Pakiet uruchomiono przed zmianami dokumentacji i po nich:

```text
RUN_DB_TESTS=0 MOCK_DB=true npx vitest run src/components/Audit/method/__tests__/auditsMethodApi.contract.test.ts --retry=0 --reporter=json
success=true; 15/15 pełnych nazw zaliczonych
diff przed-nazwy.txt po-nazwy.txt: pusty (0 bajtów)
```

Nazwy: `/private/tmp/cx-day251-audyty-postep-artefakty/przed-nazwy.txt` i
`po-nazwy.txt`; JSON: `przed.json`, `po.json`; diff: `nazwy.diff`.

Pułapki Z33: pakiet jest czysto jednostkowy, mockuje `Api.get` i nie importuje
`v8FeatureGate`, `resultsInternalBetaVisibility`, `auth.middleware` ani `Database`
(potwierdzone pustym `rg` po pliku testu i kliencie). Zatem pułapki (a)–(d) nie leżą na
tej ścieżce. Pułapkę (e) wyłączono przez brak zmian w kodzie produktu: po potwierdzeniu
naprawy zmieniono wyłącznie dokumenty. `--retry=0` podano jawnie.

## R2 — sprostowanie dokumentów

Dopisano, bez kasowania treści historycznej, osobne sekcje „Sprostowanie” do:

- `AUDYT_ROZJAZDY_NAZW_POL.md` — wynik szerokiego audytu pozostaje historyczny;
- `ZNALEZISKO_POSTEP_SESJI_AUDYTOW.md` — żywy pomiar PG pozostaje dowodem stanu PRZED;
- `KSZTALT_21_ATRAPA_UWIARYGODNIA_DEFEKT.md` — reguła „atrapa najpierw” została zastosowana;
- `ROZJAZD_NAZW_POL_20260901.md` — dwa wiersze ZMIERZONE są naprawione w obecnym kodzie.

Pokrewieństwo sprawdzono grafem, nie czasem: `eb9732e513`, `bacbf4081c` i `5c17eaed6e`
nie są potomkami `8510fcb01d` (trzy razy kod 1 z `merge-base --is-ancestor`).

## R3 — domknięcie odbioru

SHA-256 dowodów:

```text
f3ea7973ea036dff9fcd680b453a617a4bd8b3c42f973091e75479ff09ca1f1e  PO dark
4209f5d79abc4eb52e08d1a71ec893ce1f5d6aa6ae38243880a3c77422276d1e  PO light
d364563afdb4419c887d192f8264c0001583ed37f952d78c43134b2b51d8e302  PRZED dark
49ba7cf013ee93de1bf73780901764afe4f543034fef36d1720c27aa0c4b3196  PRZED light
```

Otworzyłem oba obrazy PO narzędziem obrazowym. W obu motywach kolumna „Postęp” pokazuje
liczby (`0/42`, `12/42`, `27/27`, `40/42`, `39/39`, `9/24`), a „Ustalenia otwarte”
wartości (`0`, `4`, `6`, `2`, `1`, `0`, `2`), nie ukośnik ani pustkę.

### Errata gotowa dla OWNER_DECISION_LEDGER (rejestru nie edytowano)

DEC-2026-08-26-81 „Audits r2 — odbiór partii K” powinien być czytany jako odbiór
udokumentowanych widoków, w tym Biblioteki, a nie jako dowód zakładki Sesje. Sesje nie
były wtedy osobno sfotografowane; rozjazd liczników naprawił później `8510fcb01d`, z
osobnym dowodem PRZED/PO. `status.json` już jawnie zachowuje to ograniczenie. Rekomendacja:
nadzorca może dopisać tę adnotację do DEC-81, bez zmiany historycznej decyzji.

## Bezpieczeństwo wysyłki

`env` podał `BRAK ZMIENNYCH POCZTY`; zapytanie `settings WHERE key LIKE 'smtp%'` zwróciło
0 wierszy; grep drenaży w `server/src/Gateway.ts` był pusty. Nie ustawiłem żadnej zmiennej
SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie
uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie
kalendarzowe nie zostało wysłane.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie wykonano nowego realnego HTTP/ApiGateway/PostgreSQL ani nowych zrzutów runtime;
  dyżur weryfikuje istniejącą naprawę pakietem jednostkowym i istniejącym dowodem mutacyjnym.
- Nie wykonano odbioru właściciela zakładki Sesje; `status.json` nadal go wymaga.

## Korekty wobec instrukcji

- Obowiązkowa komenda T4 z `grep ... | head -10` pokazuje wcześniejsze, prawidłowe użycia
  `applicableCriteria`, ale obcina właściwy mock `/audits/programs` z linii około 975.
  Nie uznałem tego za regresję: odczyt zakresu `965,1015` potwierdził destrukturyzację pól
  klienta i serializację trzech pól serwera. To wynik pułapki obciętego grepu, opisanej
  również w instrukcji.
- Instrukcja raz nazywa pakiet kontraktowy wariantem B, a w R1 i wariancie C klasyfikuje
  go jako czysto jednostkowy. Wybrano bezpieczniejszy wariant C wskazany dosłownie w R1;
  importy oraz mock `Api.get` potwierdzają brak egzekucji DB/HTTP.

## Zakres zmian

Zmodyfikowano dokładnie cztery licencjonowane dokumenty oraz ten raport. Nie zmieniono
kodu produktu, infrastruktury testowej, `status.json` ani `OWNER_DECISION_LEDGER`.
