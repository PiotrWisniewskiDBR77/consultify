# CODEX DAY 107 — Karta Insight: prawda czy atrapa

Data: 2026-08-29  
Gałąź wznowienia: `codex/day107b-karta-insight-20260829`
Baza: wyłącznie lokalna `consultify_w3_interview_owner_day107`, kontener `cx-day107-pg`, port `127.0.0.1:5988`  
Zakres zapisu: wyłącznie ten raport i `modules/02_INTERVIEW/MODULE_ACCEPTANCE.md`. Nie zmieniono produktu ani testów.

## Wznowienie DAY107B — pomiar na naprawionym fixture

Marker wznowienia: `c44c1efe181bd3d5c1cb3bacdc9ec6783b63bbd8`. Naprawiony seeder idempotentnie utworzył syntetycznego właściciela, organizację i aktywne członkostwo. Zalogowano jako właściciel fixture przez formularz na `127.0.0.1:4875`; auth bypass i test support były wyłączone. Hasła nie utrwalono w tym raporcie ani na zrzutach.

Wznowienie usuwa poprzednią blokadę logowania, ale ujawnia następną granicę kontraktu: fixture tworzy `2` sesje, `6` pytań i `2` dystrybucje, lecz **`0` rekordów `interview_insights`**. Sesja review ma status `submitted`, przydział `submitted` i `3 z 3` niepustych odpowiedzi. Jednocześnie realny odczyt sesji przez ApiGateway zwrócił `summaryFacts=[]`, `summaryGaps=[]`, `summaryConstraints=[]`, `summaryPainPoints=[]`, a `GET /api/v8/interview/insights` zwrócił HTTP `200` z `{"data":{"insights":[]},...}`.

UI po prawdziwym logowaniu potwierdził ten stan: zakładka Wnioski pokazuje wszystkie liczniki `0` i pusty ekran „Brak wniosków”. Nie uruchomiono „Generuj wnioski AI”, ponieważ dyżur zakazuje wywołań LLM. Nie utworzono ręcznie Insightu ani nie zmieniono statusów fixture.

### Rozstrzygnięcie trzech wcześniejszych ustaleń

| Ustalenie statyczne | Pomiar DAY107B | Werdykt end-to-end |
| --- | --- | --- |
| `Findings 0` może być atrapą fail-soft | Brak `insightId`, więc trasa findings konkretnej karty nie ma mianownika; lista Insightów zwraca poprawne `200` i pustą tablicę | **NIE POTWIERDZONO I NIE OBALONO na karcie**. Ryzyko kodowe pozostaje udowodnione, ale fixture nie pozwala wymusić ani odróżnić błędu findings od prawdziwego zera. |
| `Confidence —` to uczciwe `UNKNOWN` | Brak karty i brak wartości confidence do renderu | **NIE POTWIERDZONO I NIE OBALONO na karcie**. Statyczny werdykt `UNKNOWN` pozostaje właściwy, lecz nie został wykonany w runtime. |
| `ACTIONS 0` to atrapa semantyczna | Brak karty i jej read-mode badge | **NIE POTWIERDZONO I NIE OBALONO na karcie**. Statycznie badge nadal opisuje tryb podglądu, nie liczbę działań; fixture nie osiąga tego ekranu. |

To jest wynik pomiaru, nie unik: poprawka principalu była skuteczna, ale nie dodała badanego Insightu. Pełna karta wymagałaby uruchomienia generatora AI albo zmiany fixture, czego zakres DAY107 zabrania. Nadal **`0 z 6` pól konkretnej karty** ma pełny łańcuch SQL → trasa → UI. Dodatkowy, mierzalny defekt projekcji: baza ma `3` niepuste odpowiedzi, podczas gdy oba summary API zwracają cztery puste tablice; dlatego ewentualne `OFFICIAL ANSWERS 0` nie byłoby uczciwym licznikiem surowych odpowiedzi tej sesji.

### Dowody wznowienia

```text
seeder readback: fixture W3-INTERVIEW-OWNER-v1, status FINAL
principal: istnieje; organization_members: ACTIVE
sesje / pytania / dystrybucje: 2 / 6 / 2
sesja review: submitted, answeredQuestions 3/3
interview_insights: 0
GET /api/v8/interview/insights: HTTP 200, data.insights=[]
runtime: LOCAL @c44c1efe181b, server 4874, client 4875
auth bypass / test support: OFF / OFF
```

Zrzuty po zalogowaniu, bez widocznego hasła:

- light: `/private/tmp/cx-day107b-karta-insight-artefakty/day107b-insights-empty-light.png`, SHA-256 `c306020f9d534b0a74bebf2754b3b1d91e1d52b556cc7d90ab0e691eacc2cae0`;
- dark: `/private/tmp/cx-day107b-karta-insight-artefakty/day107b-insights-empty-dark.png`, SHA-256 `0f6cfc2e29ac53a8d7efe78fd6f32bba06f2bb1e61d994c1a15f353803a7b25d`.

Pokrycie zrzutów: **`2 z 4`** — pusty light i pusty dark. Pełny light/dark: **`0 z 2`**, ponieważ fixture nie zawiera Insightu, a jego wygenerowanie naruszyłoby zakaz LLM. Zrzuty pustego widoku są dowodem realnego stanu produktu, nie substytutem pełnej karty.

### Kryteria po wznowieniu

| Kryterium | Wynik DAY107B |
| --- | --- |
| K1 | SQL wykonany: `3` odpowiedzi w sesji review, `0` Insightów, więc `0 z 6` pól karty ma mianownik |
| K2 | realny podpisany auth i ApiGateway: `GET insights` HTTP `200`; detail/findings karty `N/D` z powodu braku `insightId` |
| K3 | tabela sześciu pól poniżej pozostaje aktualna; dla karty nadal `N/D` |
| K4 | trzy wskazane hipotezy uczciwie pozostają niewykonane E2E, nie zostały ogłoszone jako potwierdzone |
| K5 | bez zmian: hipoteza Document Studio obalona statycznie, runtime nieweryfikowany |
| K6 | `2 z 4` — oba puste motywy; pełna karta `0 z 2` |
| K7 | spełnione — sekcja twierdzeń niezweryfikowanych pozostaje niepusta i została uzupełniona poniżej |
| K8 | spełnione — bez zmian produktu/testów; tylko dwa licencjonowane dokumenty |

### TWIERDZENIA NIEZWERYFIKOWANE — uzupełnienie DAY107B

1. Nie zweryfikowano żadnego z sześciu pól na pełnej karcie, bo naprawiony fixture nadal nie tworzy `interview_insights`.
2. Nie zweryfikowano zachowania trasy findings dla istniejącego Insightu ani jej stanu awarii.
3. Nie zweryfikowano renderu `Confidence —` i `ACTIONS 0` w runtime; zachowano wyłącznie wcześniejsze dowody statyczne.
4. Nie zweryfikowano pełnej karty w light/dark; dwa zrzuty dotyczą kanonicznego pustego widoku.
5. Nie zweryfikowano generatora AI, ponieważ wywołanie LLM było jawnie zabronione.
6. Nie uznano `summaryFacts=[]` za dowód braku odpowiedzi: niezależny SQL wykazał `3` niepuste odpowiedzi, więc jest to rozjazd projekcji summary.

Po pomiarze kanoniczny skrypt zatrzymał wyłącznie należące do dyżuru grupy procesów i potwierdził wolne porty. Następnie usunięto kontener `cx-day107-pg`; kontrola wykazała brak kontenera i brak listenerów na `5988`, `4874`, `4875`.

## Wynik pierwszego przebiegu (historyczny STOP przed markerem `c44c1efe18`)

Nie ma uczciwej podstawy, aby uznać obserwowane cztery zera za potwierdzoną prawdę o badanym Insighcie. Kanoniczny seeder Interview ma zamek: wymaga istniejącego właściciela, ale go nie tworzy. Po pełnych migracjach w bazie było `0` właścicieli fixture, `0` sesji i `0` Insightów, a próba seedowania przerwała się przed pierwszym zapisem. W efekcie nie powstał badany rekord, nie było realnego `insightId`, żądania przez `ApiGateway` ani karty do sfotografowania.

Jednocześnie audyt kodu rozstrzyga ważną część pytania produktowego:

- `OFFICIAL ANSWERS`, `ISSUES / RISKS` oraz `SIGNALS / OPPORTUNITIES` są licznikami wyliczanymi przez komponent z kilku źródeł i fallbacków, a nie prostym odczytem jednej kolumny;
- `Findings` jest liczbą rekordów z osobnej trasy, lecz błąd tej trasy jest zamieniany w `[]`, więc `0` może być atrapą awarii;
- `Confidence` pokazuje `—` dla braku wartości — to uczciwe `UNKNOWN`, nie zero;
- `ACTIONS 0` w podglądzie jest wymuszoną prezentacją trybu tylko do odczytu, nie liczbą działań biznesowych zapisanych w bazie. Jako miara treści Insightu jest semantycznie mylące.

Wynik zbiorczy wymaganego porównania: **`0 z 6` pól zweryfikowanych end-to-end baza → trasa → karta**. To nie oznacza `0 z 6` zgodnych; oznacza brak mianownika badanego rekordu.

## Korekty wobec instrukcji

1. Zlecenie właściciela podało marker `74a1d733e9` i nakazało start z aktualnego tipa. Wydany dokument w §0.1 podawał starszy marker `5b29e4ec…` i start dokładnie z niego. Po fetchu tip był dokładnie `74a1d733e9b6f5535c49d003844678fe87d0c9b3`, a oba SHA były jego przodkami. Zastosowałem nowszą, bezpośrednią korektę właściciela.
2. Dokument odwołuje się do §0.4a oraz „tabeli licencji”, ale w 711-liniowym wydanym pliku nie ma §0.3, §0.4 ani tabeli licencji. Zastosowałem bezpieczniejszą interpretację: żadnych zmian w kodzie/testach, tylko dwa jawnie licencjonowane dokumenty z §D.
3. W1 zapowiada seeder w jednym z dwóch miejsc; pomiar znalazł wiele seederów, a właściwy plik jednoznacznie wskazał nazwa modułu: `server/scripts/seed-wave3-interview-owner-review.ts`.
4. Hipoteza o strażniku uzasadnienia została **obalona statycznie** dla karty Insight: żadna z tras/komponentu karty nie importuje ani nie wywołuje `documentBlockContentGenerator` lub `enforceBlockGrounding`. Trafienia istnieją wyłącznie w usługach Document Studio. Nie uznaję tego za dowód runtime.

## Wejście i marker — wyniki dosłowne

```text
$ git ... log --oneline -25 github-backup/codex/m03-admin-20260824
74a1d733e9 docs(day105-108): trzecia partia — decyzja Spotkan, os czasu, karta Insight, jezyk
5b29e4ec1b docs(ledger): DEC-335..336 — warunki 1 i 2 stagingu zamkniete, zastrzezenie dev-render
...
$ git ... merge-base --is-ancestor 74a1d733e9 github-backup/codex/m03-admin-20260824
USER MARKER OK
$ git ... merge-base --is-ancestor 5b29e4ec... github-backup/codex/m03-admin-20260824
DOC MARKER OK
$ git -C /private/tmp/cx-day107-karta-insight rev-parse HEAD
74a1d733e9b6f5535c49d003844678fe87d0c9b3
$ git -C /private/tmp/cx-day107-karta-insight status --short | head -3
(brak wyniku)
```

Dysk: `60Gi` wolne (`>5Gi`). Porty `5988`, `4874`, `4875`: brak listenerów przed startem.

## Kontrakt seedera i BLOK 0

Seeder: `server/scripts/seed-wave3-interview-owner-review.ts`.

- komenda `seed|readback`: linie 19–27;
- lokalny URL i nazwa `consultify_w3_interview_owner_*`: linie 32–37;
- seeder nie robi migracji; migracje wykonał osobno `server/scripts/migrate.postgres.ts` dwukrotnie;
- właściciela tylko wyszukuje: `SELECT organization_id, role FROM users WHERE id=$1` w linii 90; brak `INSERT INTO users` i brak `INSERT INTO organization_members` w całym pliku;
- pierwszy zapis fixture zaczyna się dopiero od linii 148–150, już po strażniku tożsamości.

Oba przebiegi migracji zakończyły się `✅ Postgres migrations complete`; drugi podał `Applying migrations: 0`. Niezależny readback po migracjach:

```text
users dla ownerId: (0 rows)
organization_members dla ownerId: (0 rows)
```

Próba seedowania z pełnym lokalnym `DATABASE_URL`:

```text
server/scripts/seed-wave3-interview-owner-review.ts:92
Error: Wave 3 owner does not belong to the requested organization
exit 1
```

Nie dosiałem ręcznie principalu i nie uruchomiłem obcego seedera, ponieważ zmieniłoby to kontrakt badanego fixture i ukryło defekt wejściowy.

## B.1 — SQL: mianownik prawdy

Zapytanie po nieudanym seederze, wykonane bezpośrednio przez `docker exec ... psql`:

```sql
SELECT
  (SELECT count(*) FROM interview_sessions) AS sessions,
  (SELECT count(*) FROM interview_questions
    WHERE answer_text IS NOT NULL AND btrim(answer_text) <> '') AS official_answer_candidates,
  (SELECT count(*) FROM interview_insights) AS insights,
  (SELECT count(*) FROM interview_insight_findings) AS findings;
```

```text
sessions | official_answer_candidates | insights | findings
0        | 0                          | 0        | 0
```

To jest stan **pustej bazy po migracjach**, nie stan badanego Insightu. Zapytanie `SELECT ... FROM interview_insights ... LIMIT 5` zwróciło `(0 rows)`.

## B.2 — baza kontra trasa kontra karta

| Pole | Baza badanego Insightu | Trasa | Karta | Gdzie powstaje/znika wartość | Werdykt |
| --- | ---: | --- | --- | --- | --- |
| OFFICIAL ANSWERS | `N/D` (brak Insightu; globalnie 0 odpowiedzi) | `N/D` | `N/D` | `InsightViewer.tsx:2166-2171` liczy unikalne `facts` z summary sesji; `:2398` przekazuje długość | **NIEZWERYFIKOWANE**; `0` może oznaczać brak facts albo fail-soft summary |
| ISSUES / RISKS | `N/D` (globalnie 0 Insightów) | `N/D` | `N/D` | `:2174-2190`, `:2393` — V6 `issues`, potem fallback z constraints/painPoints/gaps i regexu narracji | **NIEZWERYFIKOWANE**; nie jest prostym SQL count |
| SIGNALS / OPPORTUNITIES | `N/D` | `N/D` | `N/D` | `:2192-2210`, `:2394-2396`, render sumy `:4118-4123` | **NIEZWERYFIKOWANE**; złożona suma z fallbackami |
| Findings | `N/D` (globalnie 0) | `N/D` | `N/D` | trasa `GET /api/v8/interview/insights/:id/findings` w `interview-insights.routes.ts:653-670`; błąd jest zamieniany na `[]` w `InsightViewer.tsx:1604-1615`; render length `:2355-2367`, `:8950-8952` | **ATrapa możliwa i kodowo udowodniona**: awaria odczytu i prawdziwe zero mają ten sam UI |
| Confidence | `N/D` | `N/D` | `N/D` | `InsightViewer.tsx:3781-3787`: finding → analysis topic → `insight.confidence` → null; `:8945-8947`: null → `—` | **UCZCIWE UNKNOWN** w logice prezentacji; runtime nieweryfikowany |
| ACTIONS | brak kanonicznego SQL count dla badge | brak trasy odczytującej „liczbę akcji” | `N/D` | `InsightViewer.tsx:8863-8877`: `readMode` wymusza `badge: 0`; przyciski są przejściami statusu | **ATrapa semantyczna** jako treść karty: `0` znaczy tryb podglądu, nie brak działań/next actions |

Ścieżka montażu ustalona greptem: `Gateway.ts:1474-1482` montuje `/api/v8` przez `v8FeatureGate`; `routes/v8/index.ts:58-59` wymaga `verifyToken` i kontekstu org, następnie montuje `interviewInsightsRoutes` pod `/interview`. Komponent najpierw woła `V8InterviewApi.getInsight`, potem findings/analysis/source-pack (`InsightViewer.tsx:1919-1935`).

### K2 — realne żądanie ApiGateway

**`0 z 1`**. Nie uruchomiono żądania bez istniejącego principalu i badanego `insightId`, ponieważ kod odpowiedzi byłby dowodem wyłącznie blokady uwierzytelnienia lub braku rekordu, a nie treści karty. Pułapki Z33: (a) wymagałaby `ENABLE_V8_GLOBAL=true`; (c) pełnego real-PG env; (d) `ENABLE_TEST_AUTH_BYPASS=false`; (e) Gateway może ukryć ciało 500. Nie powstał pakiet dowodowy, więc nie przypisuję mu zielonego wyniku.

## B.3 — zrzuty

**`0 z 4`** (pełny/pusty × light/dark). Runtime `4874/4875` nie został uruchomiony: seeder nie stworzył principalu, sesji ani Insightu. Zrzut logowania/404/pustej bazy byłby innym ekranem niż zamówiona karta i stanowiłby atrapę dowodu. Nie ma plików PNG ani hashy do zgłoszenia.

## B.4 — werdykt

- Dla danych konkretnego ekranu: **STOP MERYTORYCZNY / EVIDENCE_MISSING**, `0 z 6` end-to-end.
- `Confidence —`: zgodnie z kodem uczciwe `UNKNOWN`.
- `ACTIONS 0`: wartość prawdziwa wyłącznie jako „zero kontrolek w readMode”; jako odpowiedź na pytanie o akcje wynikające z Insightu jest atrapą semantyczną.
- `Findings 0`: nie jest fail-closed; komponent zamienia błąd trasy na pustą tablicę. Bez pomiaru HTTP nie można odróżnić prawdziwego zera od atrapy.
- Pozostałe trzy liczniki: źródła są wielowarstwowe, więc bez konkretnego wiersza i odpowiedzi HTTP nie wolno ogłosić ani „prawda”, ani „atrapa”.
- Hipoteza Document Studio: **obalona na poziomie grafu importów/wywołań**, nie jest to ten sam strażnik. Karta ma własny pipeline Interview.

### STOP — B.1–B.3

Rodzaj: MERYTORYCZNY  
Powód: kanoniczny seeder wymaga principalu, którego ani migracje, ani on sam nie tworzą.  
Licencja, którą sprawdziłem: §D pozwala zapisać wyłącznie raport i `MODULE_ACCEPTANCE.md`; brak tabeli licencji w wydanym dokumencie, więc kod pozostał read-only.  
Dowód: `seed-wave3-interview-owner-review.ts:90-92`, `users (0 rows)`, `organization_members (0 rows)`, seeder `exit 1`.  
Co dostarczyłem ZAMIAST zmiany: niezależny SQL stanu pustej bazy, mapa pól `plik:linia`, mapa produkcyjnego montażu i brief defektów fail-soft/semantyki.  
Co zrobiłbym po decyzji X: po jawnej naprawie seedera analogicznej do bootstrapu w seederze Tools powtórzyłbym migracje, seed/readback, JWT przez realny Gateway i cztery zrzuty.  
Rekomendacja dla nadzorcy: osobny dyżur powinien dodać idempotentny bootstrap `organizations` + `users` + `organization_members` do seedera Interview, z testem real-PG; dopiero potem wznowić Day 107.  
Stan: zacommitowano wyłącznie dokumentację.  
Czy kontynuowałem pozostałe pozycje: TAK — statycznie, bez fałszowania runtime.

## Bezpieczeństwo poczty

Przed pierwszą próbą zapisującą:

```text
BRAK ZMIENNYCH POCZTY
SELECT ... FROM settings WHERE key LIKE 'smtp%': (0 rows)
grep drenów w server/src/Gateway.ts: 0 trafień
```

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Pomiar zasięgu testów

Wydana instrukcja nie zawiera §0.4a mimo odwołań Z24. Niezależne wyszukanie pełnego korpusu (bez `head`) znalazło **`12 z 12` nazwanych plików testowych** odnoszących się do `InsightViewer`, `interview-insights`, `listFindings` lub `getInsight`. Żadnego nie uruchomiono jako dowodu runtime, ponieważ fixture nie powstał. Nie zmieniono kodu ani testów, więc porównanie nazw przed/po jest `0 z 0` pakietów zmienionych.

## Kryteria K1–K8

| Kryterium | Wynik |
| --- | --- |
| K1 | `0 z 6` dla badanego Insightu; dostarczono SQL pustej bazy i nazwano brak mianownika |
| K2 | `0 z 1` — brak principalu i `insightId` |
| K3 | `6 z 6` wierszy tabeli, wszystkie z uczciwym `N/D` tam, gdzie brak egzekucji |
| K4 | `2 z 6` rozstrzygnięte semantycznie (`Confidence`, `ACTIONS`), `4 z 6` nieweryfikowalne dla konkretnego rekordu |
| K5 | `1 z 1` obalone statycznie; runtime niezweryfikowany |
| K6 | `0 z 4` |
| K7 | spełnione — sekcja poniżej niepusta |
| K8 | spełnione: tylko dwa dokumenty, zero `src/`, zero `server/src/` |

## TWIERDZENIA NIEZWERYFIKOWANE

1. Nie zweryfikowano, że ekran widziany przez nadzorcę pochodził z tego samego SHA, bazy lub fixture.
2. Nie zweryfikowano żadnej wartości badanego Insightu przez realny `ApiGateway` ani podpisany JWT.
3. Nie zweryfikowano wizualnie żadnego z czterech stanów/motywów.
4. Nie zweryfikowano, czy w runtime błąd findings faktycznie występuje; udowodniono tylko, że komponent zamieniłby go na `0`.
5. Nie zweryfikowano runtime hipotezy Document Studio; obalono tylko bezpośredni graf importów/wywołań badanej ścieżki.
6. Nie policzono zastosowanych migracji w pierwszym przebiegu, ponieważ instrukcja kazała zachować tylko ostatnie 20 linii, a repo nie utrzymuje tabeli `migrations`; potwierdzono idempotencję drugiego przebiegu (`Applying migrations: 0`).

## Rekomendacje (bez naprawy)

1. Naprawić kontrakt seedera Interview osobnym, licencjonowanym dyżurem i wznowić pełny pomiar Day 107.
2. Findings: nie zamieniać błędu odczytu na `[]`; stan błędu/unknown musi być odróżnialny od prawdziwego `0`.
3. Actions: zmienić etykietę badge albo pokazywać `—`/„tylko podgląd”; obecne `0` nie opisuje treści Insightu.
4. Zachować `Confidence —` jako poprawny fail-closed wzorzec.

## Sprzątanie zasobów

Po zebraniu dowodów wykonano `docker rm -fv cx-day107-pg`; komenda zwróciła nazwę kontenera. Następnie `docker ps -a --filter name=^/cx-day107-pg$` nie zwrócił żadnego wiersza, a `lsof` nie wykazał listenerów na `5988`, `4874` ani `4875`. Lokalna baza i jej wolumen są usunięte; worktree i artefakty tekstowe pozostają do odbioru nadzorcy.
