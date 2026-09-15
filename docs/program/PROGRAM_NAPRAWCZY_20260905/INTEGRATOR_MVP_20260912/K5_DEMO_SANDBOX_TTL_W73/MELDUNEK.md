# K5 — demo sandbox TTL, Wpis 73

Werdykt po poprawkach HOLD: READY FOR RE-REVIEW na exact content SHA `517cc884de`.

## Zakres

- TTL 24 h dla organizacji `*-demo-session-*` jest bezwzględny; `ended` ani
  wygasła sesja nie skracają wieku organizacji.
- `ENABLE_DEMO_SANDBOX_TTL` jest domyślnie włączone; jawne `false` zatrzymuje usuwanie.
- Limit jest twardo ograniczony do 3 organizacji na przebieg, także gdy konfiguracja żąda więcej.
- Whitelist, typ `DEMO`, stan rozliczeń i brak realnego użytkownika są sprawdzane
  przed `LIMIT`, a następnie ponownie pod `SELECT … FOR UPDATE` tuż przed kasowaniem.
- Jeden przypięty klient PostgreSQL obejmuje lock, re-check, wszystkie DELETE,
  readback organizacji oraz COMMIT/ROLLBACK.
- Każdy błąd DELETE rzuca wyjątek. Licznik rośnie dopiero po zerowym readbacku
  organizacji i zatwierdzeniu transakcji.
- Purger zachowuje kolejność 63 kroków z poprzedniego freeze, w tym 49 tabel
  zależnych z planu CTO, i usuwa dzieci przed rodzicami.
- Brak migracji i brak zmian UI.

## Dowody

- Real PostgreSQL `127.0.0.1:6455/consultify_k5_fix`, kontener
  `cx-c-k5-fix-w73-pg` (`pgvector/pgvector:pg16`), `MOCK_DB=false`.
- Fresh strict: 918 migracji zakończonych powodzeniem, bez nowej migracji w paczce.
- `tests/acceptance/demoCleanup.e2e.test.ts --retry=0`: **6/6 PASS**.
- Audyt planu: wszystkie 49 tabel zależnych oraz `organizations` istnieją;
  każda z 49 tabel otrzymała rzeczywisty DELETE w przypiętej transakcji. Brak
  tabeli przerywa test zamiast zwiększać licznik.
- Fixture bezpieczeństwa: `paid` zachowane; świeża organizacja z sesją `ended`
  zachowana; zmiana kandydata na `paid` po selekcji wykryta przez re-check i
  pominięta.
- Fault injection po DELETE `tasks`: transakcja cofa wcześniejsze DELETE;
  organizacja, użytkownik, projekt, zadanie i komentarz pozostają **5/5**, a
  wynik cleanupu wynosi 0.
- Importery: `demoSessionDatasetSignal` 9/9 oraz `trialCronDemoCleanup` 3/3.
- Server TypeScript: RC 0.
- Front TypeScript: RC 2, dokładnie 177 błędów, 7424 listFiles; próg W73 zachowany.
- `check:jezyk:ci`: PASS; K4en -68, K7 -1 względem baseline.
- `check:list-canon`: 349, bez wzrostu.
- `check:artefakt`: 8-0-117, bez wzrostu.
- Build produkcyjny: RC 0.
- Nowe `as any`: 0.

## Ryzyko

Test wykonuje realną operację wyłącznie na lokalnej bazie disposable. Nie
uruchamiano cleanupu na stagingu, demo ani żadnym środowisku chronionym.
Surowe logi są w `evidence/k5-demo-ttl-w73-fix/logs/`.
