# CODEX DAY 155 — ZAŁĄCZNIKI ZADANIA I DECYZJI

Stan: **PARTIAL — kod, kontrakt mutacyjny i realny ApiGateway/PostgreSQL potwierdzone; pełny F5/render UI niezweryfikowany**.

## Stan wejściowy

```text
$ git merge-base --is-ancestor e4ff8e21ae HEAD && echo "BAZA OK" || echo "MARKER BRAK — STOP"
BAZA OK

$ git status --short

$ git branch --show-current
codex/day155-zalaczniki-domkniecie-20260830

$ ls -la node_modules
lrwxr-xr-x@ 1 piotrwisniewski wheel 56 Aug 30 11:50 node_modules -> /Users/piotrwisniewski/Developer/Consultify/node_modules

$ df -h /
Filesystem        Size    Used   Avail Capacity iused ifree %iused Mounted on
/dev/disk3s1s1   1.8Ti    12Gi    27Gi    31%    459k  281M    0% /

$ git rev-parse HEAD
e4ff8e21ae3071592ce40e879a11e44c54998cfb

$ git log --oneline -1
e4ff8e21ae docs(funkcje): odbior 148-152 — pierwszy formalnie oceniony dokument, rubryka FAIL, dwie rozlaczne przyczyny

$ lsof (6041, 4976, 4977) + docker ps
PORT 6041 WOLNY
PORT 4976 WOLNY
PORT 4977 WOLNY
BRAK KOLIZJI W docker ps
```

Tezy T1–T4 zmierzyłem przez `rg` i odczyt właściwych funkcji. T1 i T2 potwierdziły się: `loadTask` i `loadDecision` czytały osadzone pola obiektu, a Decyzja następnie nadpisywała załączniki snapshotem localStorage. T3 potwierdziła się: wbudowana tabela Decyzji nie miała pobierania. T4 dała konkretne miejsca opisane w R4.

## Korekty wobec instrukcji

1. §0.1-BIS nadpisuje §0.1: nie wykonałem fetch, tworzenia worktree, zapisu do vaulta, symlinka ani mkdir. Kontrolą bazy było `merge-base --is-ancestor`, nie równość SHA.
2. Rozstrzygnięcie §0.1-BIS „NIE PUSHUJESZ” zastosowałem zamiast Z34a. Nie wykonano żadnego pushu.
3. Z24 odsyła do nieistniejącego §0.4a; zgodnie z §0.1-BIS martwe odwołanie pominąłem. Samodzielny zakres zmian podaję w W-D.
4. Pułapka configu potwierdziła się: repozytoryjne configi przypinają `DB_TYPE='sqlite'`. Użyłem configu poza repo: `/private/tmp/cx-day155-zalaczniki-domkniecie-scratch/vitest.day155.realpg.config.ts`, bez tego przypięcia.
5. Pierwsze uruchomienie zewnętrznego configu nie zebrało testów, bo import `vitest/config` nie rozwiązał się przez symlink. To brak pomiaru, nie PASS. Config w scratchu poprawiono na dozwolony odczyt przez symlink `node_modules`.
6. Realny pakiet najpierw ujawnił dwie pułapki harnessu: brak `File.arrayBuffer()` w jsdom oraz 401 przy sekrecie podpisującym niezgodnym z efektywnym `Config.JWT_SECRET`. Zastosowano istniejący wzorzec `FileReader` i podpis sekretem efektywnego configu bez wypisywania jego wartości. Kontrolny pakiet Day148 na tym samym configu również dawał 401, co wykluczyło regresję produktu Day155.
7. **Konflikt bezpieczeństwa runtime:** §0.2b(4) wymaga zapytania `settings WHERE key LIKE 'smtp%'` po wszystkich migracjach bezpośrednio przed startem pełnego runtime. Kanoniczny `start-wave3-owner-runtime.mjs` w trybie `create` sam tworzy i migruje nową bazę, a następnie bez punktu zatrzymania uruchamia `server/src/index.ts`; nie pozwala adoptować `cx155`, bo allowlista wymaga nazwy fixture. Bezpieczniejsza interpretacja: nie uruchamiać pełnego runtime ani ręcznego serwera. Skutek: brak dowodu F5 i zrzutów UI, status PARTIAL.

## Bezpieczeństwo Z30 i baza

```text
$ env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL|ENABLE_LIVE_EMAIL)" || echo "BRAK ZMIENNYCH POCZTY"
BRAK ZMIENNYCH POCZTY

$ rg "startNotificationOutboxDrainCron|outboxWorker|platformOutboxDrainCron" server/src/Gateway.ts || echo "BRAK DRENAZY W Gateway.ts"
BRAK DRENAZY W Gateway.ts

$ docker exec cx-day155-pg psql -U postgres -d cx155 -c "SELECT key, left(coalesce(value,''),8) FROM settings WHERE key LIKE 'smtp%';"
 key | left
-----+------
(0 rows)
```

Pierwszy przebieg migracji: `Applying migrations: 866`, zakończony `✅ Postgres migrations complete`. Drugi: `Applying migrations: 0`, również zakończony poprawnie.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## R1 — Zadanie

`loadTask` nie korzysta już z `task.attachments`. Woła `loadTaskAttachments(Api, id)`, czyli `GET /my-work/object-attachments/task/:id`, i mapuje kanoniczne rekordy serwera.

Dowód realny: plik `task-after-f5.txt` został wysłany przez rzeczywisty `ApiGateway`, zapisany do `object_attachments`, a nowy odczyt startowy zwrócił ten sam `id` i nazwę. To dowodzi ścieżki HTTP/DB/konsumenta, ale nie pełnego renderu po F5; B1 UI pozostaje NIEZWERYFIKOWANE.

Commit: `75672c9faa fix(my-work): reload task attachments from server`.

## R2 — Decyzja

`loadDecision` pobiera listę z `GET /my-work/object-attachments/decision/:id`. Hydratacja `consultify-decision-enhancements:<id>` nadal obsługuje pozostałe pola, ale dla `attachments` zachowuje bieżący stan serwerowy (`selectDecisionAttachments`). Stary snapshot nie może już wygrać.

Dowód realny: `decision-after-f5.txt` został wysłany przez rzeczywisty `ApiGateway`, zapisany do `object_attachments`, a nowy odczyt startowy zwrócił ten sam `id` i nazwę. Oba widoki dostają wspólny stan React `attachments`, lecz render Canvas + tabela po pełnym F5 pozostaje NIEZWERYFIKOWANY z powodu korekty nr 7.

## R3 — pobieranie Decyzji

Dodano `downloadDecisionAttachment` i handler tabeli: `fetch(API_URL + route)` z `getHeaders()`, `credentials: 'include'`, kontrolą `response.ok`, blobem i tymczasowym linkiem `download`. Wbudowana tabela ma przycisk pobierania przy każdym wierszu.

Realny test pobrał przez `ApiGateway` dokładny tekst `decision-after-f5`, rozmiar 17 bajtów i `Content-Type` zawierający `text/plain`. Chroniony `AttachmentsLinksCanvas` nadal używa `window.open(a.url)` bez nagłówków — znana luka poza licencją.

Commit R2–R3: `42166671bd fix(my-work): persist and download decision attachments`.

## R4 — miejsca stanu wyłącznie przeglądarkowego

1. `DecisionDetailView.tsx:771,2090`: `DEMO_ATTACHMENTS` pojawiają się przy `isDemo` i pustej liście serwera. Nie mają rekordu w `object_attachments`.
2. `DecisionDetailView.tsx:2188-2194,2235`: worek `consultify-decision-enhancements:<id>` nadal zapisuje snapshot `attachments`. Po naprawie nie może on wygrać przy odczycie, ale sam przestarzały snapshot nadal może istnieć w przeglądarce.
3. `TaskDetailView.tsx:4534`: lokalny patch metadanych załącznika (`setAttachments(prev.map(...patch))`) zmienia stan UI bez zapisu do `object_attachments`; pełny reload przywraca prawdę serwera.
4. `DecisionDetailView.tsx:8217`: analogiczny lokalny patch metadanych przekazany do Canvas może istnieć tylko w bieżącym stanie React; pełny reload przywraca prawdę serwera.
5. `AttachmentsLinksCanvas.tsx:824,846` (tylko odczyt): otwieranie `a.url` przez `window.open` nie dokłada nagłówków uwierzytelniających. To nie tworzy rekordu tylko w przeglądarce, ale jest osobną luką konsumpcji/pobierania tego samego stanu.
6. `DecisionDetailView.tsx:5161`: inne otwarcie `a.url` przez `window.open` ma ten sam problem uwierzytelnionego pobierania i nie zostało zmienione poza wbudowaną tabelą wskazaną w R3.

Nie zmieniałem żadnego z tych miejsc poza R1–R3.

## W-A — kontrakt mutacyjny

Ta sama komenda, ten sam plik testowy, `--retry=0`, reporter JSON.

Przed zmianą: `success=false`, 4/4 przypadki czerwone po nazwach:

- `reloads task attachments from the canonical object-attachments endpoint` — brak `loadTaskAttachments`;
- `reloads decision attachments from the canonical endpoint` — brak `loadDecisionAttachments`;
- `keeps server attachments authoritative over a stale local snapshot` — brak selekcji server-first;
- `downloads a decision attachment through the authenticated API caller` — brak pobierania Decyzji.

Po zmianie: `success=true`, te same 4/4 nazwy `passed`. Artefakty: `day155-unit-before.json` oraz `day155-unit-final.json`.

## W-C — pomiar różnicowy

Pomiar marker/po zmianie wykonano tą samą komendą jednostkową na tym samym kontrakcie Day155: marker zachowania 0 PASS / 4 FAIL; po zmianie 4 PASS / 0 FAIL. Porównano `fullName`, nie same liczby.

Real-PG final: 2 PASS / 0 FAIL po nazwach:

- `reloads task and decision attachments from rows created through ApiGateway`;
- `downloads the decision attachment with exact bytes and content type`.

## Pułapki (a)–(e)

Pakiet jednostkowy nie montuje bramek ani DB: (a)–(d) nie leżą na ścieżce; (e) jest bezpośrednio sprawdzona przez wywołanie `selectDecisionAttachments(server, staleLocal)`. Nie jest dowodem egzekucji backendu.

Pakiet real-PG uruchomiono z pełnym env w tej samej linii: `ENABLE_V8_GLOBAL=true` wyłącza (a), `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` wyłącza (b), zewnętrzny config bez przypięcia plus asercja `DB_TYPE=postgres` wyłącza (c), `ENABLE_TEST_AUTH_BYPASS=false` i podpisany JWT wyłączają (d). Pułapka (e) jest dowiedziona osobno w pakiecie jednostkowym; real-PG dowodzi kanonicznej listy i pobierania, nie localStorage.

## W-D — granica zmian

```text
$ git diff --name-only e4ff8e21ae..HEAD
src/components/MyWork/DecisionDetailView.tsx
src/components/MyWork/TaskDetailView.tsx
src/components/MyWork/__tests__/day155.attachmentPersistence.realpg.test.ts
src/components/MyWork/__tests__/day155.attachmentPersistence.test.ts
```

Po dodaniu niniejszego raportu dochodzi wyłącznie licencjonowana ścieżka raportu. Zero zmian w `server/**`, migracjach, `MyWork/shared/*Section.tsx`, `AttachmentsLinksCanvas.tsx` i notebooku. Kontrakty Canvas pozostają `(files) => Promise<void>` oraz `(id) => Promise<void>`.

## Lint

Zakres czterech zmienionych plików: `0 errors`, `268 warnings`. Ostrzeżenia są zastane w wielkich widokach; nie były wyciszane ani naprawiane poza zakresem. `git diff --check` bez błędów.

## Artefakty i SHA-256

Katalog: `/private/tmp/cx-day155-zalaczniki-domkniecie-artefakty`.

```text
58166316528232d691209011b0b3d914ca5901c8788d11d87fe1c30886f3a426  day155-unit-before.json
8317b540caf4ef26cbdc010934e13496ad596eebbf8f71c0c82948c958ec0bfe  day155-unit-final.json
e27f74eda0cf9afbfee36657519f2ad5845762c2fff0565c814b2c2291b41059  day155-realpg-final.json
b0c1da5573edf02e3000e8b795dd035f5c4802c8f158b6477ec451e7f3936e28  migrations-first.log
02efb2ecb953e088b0d0289c5f8d5b3016504ffb9a897ae5524fecd231381e5b  migrations-second.log
27ea0615877066b2f149cfb36c2aeae6cbe79c5fd95088f00305cc388f438e2c  day155-eslint-final.log
```

## TWIERDZENIA NIEZWERYFIKOWANE

1. Nie wykonano pełnego F5 w przeglądarce na widoku Zadania; zgodność renderu B1 z DB jest NIEZWERYFIKOWANA.
2. Nie wykonano jednego pełnego F5 Decyzji i jednoczesnego zrzutu Canvas + wbudowanej tabeli; wizualna część B2 jest NIEZWERYFIKOWANA.
3. Nie kliknięto przycisku pobierania w pełnym runtime; B3 jest potwierdzone na realnym HTTP/ApiGateway/PG i dokładnych bajtach, ale nie interakcją przeglądarkową.
4. Nie udowodniono, że `window.open(a.url)` w chronionym Canvas kończy się 401/403 w pełnym runtime; statycznie brak mu nagłówków, lecz wynik runtime pozostaje NIEZWERYFIKOWANY.
5. Nie uruchomiono pełnego `server/src/index.ts`, ponieważ nie dało się jednocześnie spełnić kanonicznego startu i obowiązkowego punktu kontrolnego SMTP z §0.2b(4) bez improwizacji.

## Commity

```text
75672c9faa fix(my-work): reload task attachments from server
42166671bd fix(my-work): persist and download decision attachments
e890ca3985 test(my-work): normalize day155 attachment evidence
```

Nie pushowano.
