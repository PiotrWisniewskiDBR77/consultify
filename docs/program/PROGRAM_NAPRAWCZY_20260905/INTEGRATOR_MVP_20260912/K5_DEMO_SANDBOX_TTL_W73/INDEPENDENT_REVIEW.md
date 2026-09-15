# K5 demo sandbox TTL — independent review

**Werdykt: HOLD. Zielony test 3/3 nie dowodzi bezpiecznego, atomowego usuwania; implementacja może częściowo usunąć organizację, połknąć błąd i policzyć ją jako poprawnie usuniętą.**

Kandydat: `88ac55c8acdef602606cea470eb40f9466eb6c1a`  
Baza: `f2628a0d36af85d97bcbe67b820d728c7c2f2f28`  
Zakres przeglądu: wymagania K5 z Wpisu 73, plan 49 tabel
`cto-codex/czystka-dbr77-20260915/plan-demo.txt`, kod i test RealPG.

## Ustalenia blokujące

### P0 — deklarowana transakcja PostgreSQL nie istnieje

`cleanupExpiredDemos()` wysyła `BEGIN`, wywołuje purger i wysyła `COMMIT` przez
oddzielne `DbPromise.run()` (`demoService.ts:230-239`). Repozytorium samo
dokumentuje, że każde takie wywołanie używa potencjalnie innego połączenia z
puli i para `BEGIN`/`COMMIT` nie daje atomowości
(`PostgresDatabase.ts:617-647`, ponownie `:689-705`).

To nie jest ryzyko teoretyczne. Każdy z 63 kroków purgera wykonuje osobne
zapytanie. Awaria po kilku `DELETE` pozostawi częściowo skasowany tenant, mimo
komentarza obiecującego rollback całej organizacji.

### P0 — błędy kasowania są połykane, a licznik zgłasza sukces

Wszystkie `DELETE` w `deleteDemoDatasetForOrganization()` używają
`fallback:true` (`demoSeedService.ts:4462-4477`). `DbPromise.run()` przy błędzie
zwraca wtedy `{success:false}`, zamiast rzucić wyjątek (`DbPromise.ts:460-475`,
`:498-508`). Purger ignoruje wynik. Następnie `cleanupExpiredDemos()` bez
readbacku wykonuje `deleted += 1` (`demoService.ts:236-240`).

Zatem konflikt FK, timeout lub inny błąd może dać jednocześnie częściowe dane
i log `reclaimed`. Test nie ma wstrzykniętej awarii i nie wykrywa tej klasy
błędu.

### P0 — zabezpieczenia nie są sprawdzane ponownie przy usuwaniu

Warunki człowieka, płatności i whitelisty są czytane podczas selekcji
(`demoService.ts:163-195`). Usuwanie rozpoczyna się później, bez blokady rekordu,
bez ponownego sprawdzenia warunków i bez wspólnej transakcji (`:208-240`). Jeśli
po selekcji pojawi się prawdziwy użytkownik albo status płatny, purger nadal
usuwa `users` i `organizations`. Przy fladze domyślnie ON jest to blokujący
wyścig bezpieczeństwa.

## Luki dowodowe

### P1 — „zero sierot w 49 tabelach” nie zostało udowodnione

Test liczy brak tabeli jako wykonane sprawdzenie (`demoCleanup.e2e.test.ts:196-218`),
a meldunek przyznaje brak pięciu tabel: `organization_context_claims`,
`organization_context_items`, `organization_context_snapshots`, `project_kpis`,
`assessment_report_sections`. Asercja `checked + 1 === 50` (`:234`) potwierdza
jedynie długość listy, także dla nieistniejących tabel.

Ponadto fixture tworzy dane tylko w `users`, `projects`, `tasks` i
`task_comments` (`:149-170`). Zero w pozostałych istniejących, lecz pustych
tabelach jest stanem początkowym, a nie dowodem usunięcia. Test child tables
sprawdza globalny brak sierot (`:219-223`), nie usunięcie wierszy fixture z
każdej relacji. Plan ma 50 pozycji wraz z `organizations`; test opisuje je jako
49 zależności plus organizację, ale zachowanie kasowania zostało wykazane tylko
dla małego podzbioru.

### P1 — ochrona płatnej organizacji ma tylko asercję w SQL

Kod wyklucza `paid`, `active` i `past_due` (`demoService.ts:181-190`), lecz test
nie tworzy płatnego kandydata. RealPG dowodzi whitelisty i prawdziwego człowieka,
nie dowodzi ochrony stanu rozliczeń ani wyścigu po selekcji.

### P1 — warunek 24 godzin nie jest bezwzględny

Zapytanie łączy `created_at < 24h` alternatywą z wygasłą/zakończoną sesją
(`demoService.ts:140-160`, `:187`). Świeża organizacja z sesją oznaczoną `ended`
może więc zostać usunięta przed upływem 24 godzin. Test świeżego sandboxu nie
tworzy rekordu sesji, więc nie obejmuje tej ścieżki. To wymaga potwierdzenia
intencji albo dostosowania do literalnego TTL 24 h z W73.

## Co zostało potwierdzone

- Id zawierający `-demo-session-` jest objęty wzorcem; typ organizacji musi być
  dokładnie `DEMO`.
- Flaga `ENABLE_DEMO_SANDBOX_TTL` jest domyślnie ON, jawne `false` zatrzymuje
  kasowanie.
- Limit jest twardo ograniczony do 3, także dla `DEMO_CLEANUP_LIMIT=999`.
- Whitelist jest stosowany przed `LIMIT`; test chroni `Atelier`.
- Test chroni organizację z prawdziwym adresem użytkownika.
- Lista purgera zawiera wszystkie 50 nazw z planu CTO (49 zależności oraz
  `organizations`) i dodatkowe 13 tabel. Statyczna kolejność typowych dzieci
  przed rodzicami jest zachowana.
- Brak migracji i brak zmian UI.

## Niezależnie uruchomione dowody

- Lokalny PostgreSQL `127.0.0.1:6454`, `DB_TYPE=postgres`, `MOCK_DB=false`:
  `demoCleanup.e2e.test.ts --retry=0` → **3/3 PASS**. Wynik jest prawdziwy, ale
  nie pokrywa awarii, realnej atomowości ani pełnego mianownika tabel.
- Server TypeScript `npx tsc --noEmit` → **RC 0**.
- Statyczne porównanie planu: 50 unikalnych nazw; purger: 63; test: 49 tabel
  zależnych oraz osobna asercja `organizations`.

## Warunki zdjęcia HOLD

1. Użyć jednego przypiętego klienta PostgreSQL dla selekcji/re-checku,
   wszystkich `DELETE`, readbacku i `COMMIT`; zwolnić go w `finally`.
2. W transakcji ponownie sprawdzić wzorzec, `DEMO`, TTL, płatność, człowieka i
   whitelistę; zablokować rekord organizacji przed kasowaniem.
3. Każdy błąd `DELETE` ma przerwać operację. Licznik rośnie dopiero po
   potwierdzonym usunięciu organizacji i zerowym readbacku.
4. Dodać fault-injection: błąd w środku listy → rollback zachowuje wszystkie
   wcześniejsze wiersze i organizację; licznik pozostaje 0.
5. Uruchomić test na schemacie zawierającym komplet 49 tabel i umieścić
   reprezentatywny wiersz fixture w każdej sprawdzanej relacji albo jawnie
   zawęzić dowód. Brak tabeli ma przerwać test, nie zwiększać licznik.
6. Dodać kandydatów płatnego oraz świeżego z sesją `ended` i rozstrzygnąć
   bezwzględną granicę 24 godzin.
