# CODEX — Dyżur 110 — Czat — pakiet odbioru właściciela

Data pomiaru: 2026-08-29  
Marker: `74a1d733e9b6f5535c49d003844678fe87d0c9b3`  
Gałąź: `codex/day110-chat-odbior-20260829`

## Stan wejściowy

- Dysk: `53 GiB` wolne, wymagane co najmniej `5 GiB`.
- Marker:

```text
MARKER OK
```

- Sanity worktree:

```text
74a1d733e9b6f5535c49d003844678fe87d0c9b3
```

- Tip gałęzi bazowej uciekł o `1` commit: `c7f2838fbe docs(day109-112): czwarta partia — Audyty, Czat, Administracja, Partner`. Worktree zgodnie z instrukcją powstał dokładnie z markera; scalenie należy do nadzorcy.
- Porty przed startem: `5991`, `4882`, `4883` — `3 z 3 WOLNE`.

## Kontrakt seedera — ustalony przed kontenerem

1. Seeder: `scripts/dev/seed-wave3-chat-owner-review.mjs`; komendy `provision`, `seed`, `readback`, `reset`, `drop` są opisane w `:8-12`.
2. `provision` tworzy bazę i woła migrator (`:127-146`), ale wiążący `§0.2c` tego dyżuru tworzy bazę kontenerem i nakazuje dwa osobne przebiegi migracji; dlatego użyłem `seed`, nie `provision`.
3. Strażnik wymusza loopback i nazwę `consultify_w3_chat_owner_[a-z0-9_]+` (`:65-84`); użyta nazwa: `consultify_w3_chat_owner_day110`.
4. Seeder zakłada organizacje, użytkowników i membershipy (`:192-218`); nie tylko ich szuka. Pułapka zamka nie wystąpiła.

## B.1 — fixture, migracje i readback

- Migracje pierwszy przebieg: `863/863`, `Postgres migrations complete`.
- Migracje drugi przebieg: `0` zmian, `Postgres migrations complete`.
- Dwa przebiegi seedera utworzyły dwa manifesty `0600`; drugi nie dodał duplikatów.
- Niezależny SQL po drugim przebiegu: organizacje `2/2`, użytkownicy `4/4`, membershipy `4/4`, rozmowy `1/1`, wiadomości `1/1`, propozycje `1/1`, receipts `0/0`.
- Seederowy readback: `proposalState=pending`, `targetKind=document`, `citationCount=2`, `receiptCount=0`, provider `none-db-source-only`.

## Z30 — zero wysyłki

Przed seedem i ponownie przed runtime'em:

```text
BRAK ZMIENNYCH POCZTY
SELECT ... FROM settings WHERE key LIKE 'smtp%';
(0 rows)
grep ... server/src/Gateway.ts
(0 trafień)
```

Runtime po kwalifikacji: `prohibitedKeysAbsentInOwnedGroupProcesses=true`, `knownProhibitedValuesAbsentFromServedRootAndMarker=true`, `serverOnlyCredentialsAbsentFromViteGroup=true`.

**„Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Uruchomiłem `server/src/index.ts` wyłącznie przez kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs`, na lokalnej bazie dyżuru, tylko w celu wykonania zrzutów. Zweryfikowałem środowisko procesu i log serwera zgodnie z `§0.2b` (4). Żaden e-mail, zaproszenie kalendarzowe ani powiadomienie zewnętrzne nie zostało wysłane.”**

## B.2 — macierz zadeklarowana przed pierwszym zrzutem

Pięć powierzchni wybranych z realnego UI modułu:

1. Główna rozmowa (`New conversation` / pełna rozmowa fixture).
2. Historia (`History`; brak wyników wyszukiwania / lista z rozmową fixture).
3. Ważne sygnały (`Important signals`; pusty stan / pełny stan).
4. Panel roboczy Canvas (`Open work panel`; nowy pusty Canvas / Canvas z treścią startową).
5. Karta zarządzanej propozycji (brak karty w nowej rozmowie / pending proposal w rozmowie fixture).

Macierz docelowa: `5 powierzchni × 2 motywy × 2 stany = 20`. Pełnego stanu Sygnałów nie wolno relabelować: widoczny komunikat mówi, że producent jest wyłączony i lista pozostanie pusta niezależnie od projektu. Jeżeli pozostanie nieosiągalny po maksymalnie trzech uczciwych podejściach, wynik wyniesie co najwyżej `18/20`.

## B.3 — oględziny każdego zrzutu

Wykonano `20/20` plików i obejrzano `20/20`; sensownych semantycznie względem żądanej macierzy jest `18/20`. Pliki `06` i `16` są uczciwym dowodem, że pełny stan Sygnałów jest nieosiągalny, a nie zdjęciami pełnego stanu.

| Pliki | Powierzchnia i stan | Wynik oględzin |
| --- | --- | --- |
| `01`, `11` | Główna rozmowa — pusta — light/dark | Nagłówki i wartości po angielsku. Stan pusty zamierzony i uczciwy. Bez kwot/dat/liczb wymagających lokalizacji, bez surowych ID, bez nachodzenia. Motywy czytelne. |
| `02`, `12` | Główna rozmowa — pełna — light/dark | `1/1` wiadomość i `1/1` karta zgodne z SQL. Nagłówki i wartości po angielsku. Karta ujawnia surowy UUID wiadomości i pełny 64-znakowy hash (`src/components/AIChat/GovernedChatHandoffCard.tsx:146-160`); to żargon/identyfikator właścicielsko nieczytelny. Bez ucięć. Status `Pending review` ma semantyczny warning, nie crimson. |
| `03`, `13` | Historia — pusta — light/dark | Nagłówki i wartości po angielsku. `No conversations found` jest uczciwym wynikiem wyszukiwania. Widoczny fokus jest niebieski. Bez błędnych liczników i surowych ID. |
| `04`, `14` | Historia — pełna — light/dark | Nagłówki i wartości po angielsku. Licznik `This month 1` zgadza się z SQL `1/1`. Tytuł rozmowy jest skrócony wielokropkiem w wąskim panelu; brak nachodzenia, ale pełna wartość nie jest widoczna bez wejścia. |
| `05`, `15` | Ważne sygnały — puste — light/dark | Nagłówki i wartości po angielsku. Wszystkie chipy pokazują `0`; komunikat wprost mówi, że producent jest wyłączony. To uczciwy pusty stan, a nie awaria ani atrapa. Bez surowych ID i bez crimson. |
| `06`, `16` | Ważne sygnały — pełne NIEOSIĄGALNE — light/dark | Podejścia: wejście, `Refresh`, filtr `Execution`; nadal `0`, a produkt potwierdza wyłączony producer. Pliki dowodzą braku stanu pełnego i nie są liczone jako „full”. Po `Refresh` licznik cooldownu był uczciwy. |
| `07`, `17` | Canvas — pusty — light/dark | Pusty dokument jest uczciwy, ale interfejs sam wpisuje angielski prompt do kompozytora. Listwa Canvas jest przeładowana i elementy ściskają/nachodzą sąsiednie strefy; źródło grupy akcji i wielu kontrolek: `WorkCanvasDocumentPanel.tsx:3436-3609`. |
| `08`, `18` | Canvas — pełny — light/dark | Treść, nagłówki i wartości po angielsku. Brak liczb/kwot/dat. Centrum czytelne, dół treści naturalnie poza viewportem. Ta sama kolizja listwy; brak pełnej tożsamości artefaktu i jednego primary CTA. |
| `09`, `19` | Karta propozycji — brak — light/dark | Brak karty w nowej rozmowie jest zgodny z bazą/kontekstem i nie jest relabelowany jako pełny. |
| `10`, `20` | Karta propozycji — pełna — light/dark | `pending`, `2` references, version `1`, `0` receipts są zgodne z readbackiem. Nagłówki i wartości po angielsku; surowy UUID/hash jak wyżej. Bez ucięć i nachodzenia. |

Formaty PL (`1 250,00 €`, `21 sierpnia 2026`) nie wystąpiły na żadnym z `20/20` zrzutów, więc nie były mierzalne. Zrzuty nie zawierają nieuzasadnionego crimson: czerwony stan `Model` wynika z `isUnavailable` i używa semantycznego `danger` (`src/components/LLMSelector.tsx:247-265`); fokus jest niebieski.

## B.4 — DoD §18.1 dla Canvas

Wynik dowodowy: `5/16 PASS`, `7/16 FAIL`, `4/16 NIEZWERYFIKOWANE/warunkowe`.

- PASS: pełne otwarcie klasy L; uczciwe empty/loading; czytelny light+dark; widoczny niebieski focus; obszar rozmowy ma `role=log`.
- FAIL: Menu 1 nie ma kompletnej tożsamości i jednego primary; powłoka/toolbar nachodzi; brak kanonicznego prawego panelu Akcje→Właściwości→Powiązania→Komentarze→Historia/AI; brak first-class relations; slot AI nie ma wymaganej sekcji panelu; brak dowodu guardu niezapisanych zmian; minimalny zestaw klawiaturowy Canvas nie został wykazany.
- NIEZWERYFIKOWANE/warunkowe: pełny cykl Tab/Shift+Tab, pełna kaskada Esc, wizard (ekran nie jest kreatorem w rozumieniu §18.1), zakres AI warunkowy — UI nie pokazało selektora zakresu.

## Zasięg dowodów i testów

- Instrukcja twierdziła `7` plików dowodowych. Samodzielny pomiar repo: `25` PNG + `1` indeks = `26/26` plików w `modules/13_CHAT/evidence`.
- Samodzielny szeroki pomiar nazw: `218` plików testowych powiązanych nazwą/ścieżką z Chat/AIChat; lista: `/private/tmp/cx-day110-chat-artefakty/chat-test-files.txt`. To liczba plików-kandydatów, nie liczba testów i nie twierdzenie o pokryciu runtime.
- Skupiony pakiet czysto jednostkowy: wejściowo wskazane `7/7` plików; runner rozwinął je do `18/18` suit i `52/52 PASS`, `0/52 FAIL`, `--retry=0`. JSON: `/private/tmp/cx-day110-chat-artefakty/day110-ui-contracts.json`.
- Pułapki `Z33` (a)-(e): pakiet był `RUN_DB_TESTS=0 MOCK_DB=true`, nie montował Gateway i nie był dowodem egzekucji; (a), (b), (c), (d), (e) nie leżały na mierzonej ścieżce. Potwierdzeniem są nazwy przypadków i brak jakiegokolwiek twierdzenia HTTP/PG na podstawie tej suity.

## Runtime, trasy i log

- Kanoniczny runtime: health `200`, ready `200`, frontend `200`; SHA serwera/ready/klienta zgodne z markerem; migracje runtime `863`, oba ledgery `ok`; realne logowanie, `ENABLE_TEST_AUTH_BYPASS=false`.
- Trasy z `Gateway.ts`: `/api/ai` (`:571`, `:600`, `:602`), `/api/conversations` z `gatewayVerifyToken` + `orgMembershipGuard` (`:710`), `/api/chat-projects` z tymi samymi bramkami (`:712`). Grep jest mapą montażu, nie dowodem działania.
- Konsola przeglądarki: `0` warning/error w końcowym odczycie.
- Log serwera: zastany błąd `23505` — duplikat PK `factory_w3-chat-owner-org-v1_project_sponsor` w `project_role_templates`; nie naprawiano (`Z40`). Voice uczciwie raportował brak klucza Gemini jako unavailable.
- Drenaże outboxów uruchomiły się w pełnym runtime zgodnie z ostrzeżeniem instrukcji. Nie było żadnej konfiguracji SMTP, żadnej próby transportu ani operacji tworzącej wiadomość/powiadomienie.

## Artefakty i SHA-256

- Katalog: `/private/tmp/cx-day110-chat-artefakty`.
- `20/20` plików; `18/20` odpowiada żądanym stanom semantycznym.
- Pełny indeks SHA-256: `/private/tmp/cx-day110-chat-artefakty/screenshots.sha256`.
- Manifest fixture: SHA-256 `d164a17cd7a0fef70e10c99e14a4a392d34a235747c74e33bf713b4e3938a20a`.

## Korekty wobec instrukcji

- Instrukcja odwołuje się do `§0.4a` i „BLOKU 0”, ale wydany plik przechodzi z `§0.2d` bezpośrednio do `§0.5`; brak sekcji jest wynikiem odczytu. Wykonałem jawnie port check, pomiar diffu i samodzielny pomiar plików/testów zamiast przepisywać nieistniejącą procedurę.
- Teza `§A`: „Czat ma 7 plików dowodowych”. Pomiar `rg --files .../13_CHAT/evidence` dał `26/26` plików (`25` PNG + indeks). Teza obalona; to sukces dyżuru zgodnie z końcową regułą instrukcji.
- `§B.2` żąda pełnego stanu Sygnałów, ale produkt jawnie zgłasza wyłączony producer. Bezpieczna interpretacja: `18/20`, nie relabelowanie pustego ekranu.
- Sprzątanie: najpierw omyłkowo wykonałem `docker rm -fv cx-day110-pg`, a dopiero potem kanoniczny `start-wave3-owner-runtime.mjs stop`. Starter poprawnie odmówił sygnalizacji, bo adoptowana baza była już nieobecna. Zweryfikowałem dosłownie tożsamość własnych grup ze state file (`server PID/PGID 7866`, `client PID/PGID 7887`, ścieżka `/private/tmp/cx-day110-chat`) i wysłałem `TERM` wyłącznie do tych dwóch grup. Wynik końcowy: kontener nie istnieje, porty `5991`, `4882`, `4883` są `3/3 WOLNE`. To korekta proceduralna; nie dotknięto cudzych procesów ani zasobów.

## TWIERDZENIA NIEZWERYFIKOWANE

- Pełny stan Sygnałów — nieosiągalny po trzech podejściach, ponieważ producer jest wyłączony.
- PL i formaty liczb/kwot/dat — runtime pozostał w EN; brak takich wartości na powierzchniach.
- Tablet, zoom i pełny audyt a11y — nie były częścią desktopowej macierzy `20`.
- Live-provider — zakaz modelu w tym dyżurze; provider mode fixture to `none-db-source-only`.
- Canvas zapisany do workspace, Approve/Reject/materialize oraz wysyłka wiadomości — celowo nie klikano, bo runtime miał być tylko do odczytu.
- Pełny Tab/Shift+Tab i kaskada Esc Canvas — nie wykonano kompletnego przejścia.
- Formalny werdykt właściciela — poza autorytetem wykonawcy.
