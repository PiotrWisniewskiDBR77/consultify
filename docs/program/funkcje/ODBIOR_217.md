# ★ 217 GF-AGT-02 — SCALONE PO FIX-217 (`f0290c5142`) — 31.08.2026

## ★★ MODUŁ 17 POZOSTAJE NIEZAMKNIĘTY — uczciwy stan

Dyżur miał zamknąć moduł. Nie zamknął. Poniżej dokładnie, co jest dowiedzione, a co nie.

## Co ZAGRAŁO — pierwszy raz w tym programie model sięgnął po narzędzie sam

Ostatni przebieg budżetu (2/2), zweryfikowany przez nadzorcę w artefakcie:

| | flaga pętli WŁĄCZONA | flaga WYŁĄCZONA |
| --- | --- | --- |
| status | 200 | 200 |
| kroki narzędziowe | **2** (`search_knowledge_base`, realny koszt $0.01) | **0** |

- **(a) TAK** — model **sam zdecydował** o wywołaniu narzędzia. Log serwera z realnym argumentem, `durationMs=5439`.
- **(c) TAK** — ten sam prompt przy wyłączonej fladze daje zero kroków. **Flaga realnie rządzi trasą**, dowiedzione na żywym modelu, nie mutacją kodu.
- **(b) NIE** — model podał `vault_project_id: "Day217 R3 project"`, czyli **nazwę projektu zamiast identyfikatora**. `executeKBSearch` zachował się poprawnie: fail-closed, pusty wynik dla nierozpoznanego projektu. To **nie jest** defekt bramki ani fixture — to luka w kontrakcie narzędzia: opis parametru nie mówi modelowi, że oczekiwany jest UUID.

**To jest jedyna rzecz dzieląca nas od zamknięcia modułu 17.**

## Punkty 1 i 2 — testy wreszcie pilnują tego, co miały pilnować

- **Ogniwo 6 (pamięć organizacji)** — asercja **treściowa** zamiast liczącej wywołania. Mutacja `executeKBSearch` (`toolDefinitions.ts:885`, wymuszony pusty wynik) ⇒ **2 RED**; przywrócenie ⇒ 4/4. Przedtem ta sama mutacja dawała **4/4 PASS** — cała pamięć organizacji mogła paść niezauważona.
- **Ogniwo 2 (kontekst organizacji w promptcie)** — `toContain(ORG_CONTEXT_MARKER)` na wyrenderowanym promptcie. Mutacja `buildOrganizationSection` ⇒ **3 RED**; przywrócenie ⇒ 4/4. Przedtem prompt nie był sprawdzany **ani razu**.

## ★ Trzecia warstwa przyczyn — i nowy sposób, w jaki harness kłamie

Droga do dowodu miała trzy bramy, jedna pod drugą:
1. `TRIAL_PROFILE_INCOMPLETE` — okres łaski 3 wywołań AI wyczerpany przez sam łańcuch (`accessPolicyService.ts:398-416`);
2. `403 ORG_MEMBERSHIP_REVOKED` — sonda nie miała członkostwa (`ai.routes.ts:125-151`); **przyczynę wskazał nadzorca**, sonda pożyczała identyfikatory z artefaktu, a test po sobie sprzątał;
3. **`server/src/database/Database.ts:79-85`** — przy `NODE_ENV=test` bez `RUN_DB_TESTS=1` baza **cicho przełącza się na atrapę**. Surowy `pg.Pool` widział wiersz członkostwa, a `DbPromise.get()` zwracał `null`. Sonda „rozmawiała" z atrapą bazy, nie z bazą.

Punkt 3 to nowy, udokumentowany sposób kłamstwa przyrządu: **dwa różne dostępy do tej samej bazy w tym samym procesie dają różne odpowiedzi.** Naprawione wyłącznie zmienną środowiskową sondy — `requireActiveChatMembership` i `accessPolicyService` **nietknięte**.

## Higiena
Zero zmian w kodzie produktu w pierwszym commicie (322 wstawienia, 0 usunięć — same testy). Wartości domyślne flag nietknięte. Kopia artefaktu pierwszego, nieudanego przebiegu zachowana przed nadpisaniem. Budżet **2/2 zużyty; trzeciego przebiegu nie wykonano** zgodnie z poleceniem.

## Co zostaje do zamknięcia modułu 17
**Jedna pozycja:** kontrakt parametru `vault_project_id` w `search_knowledge_base` — albo opis narzędzia ma jasno żądać identyfikatora, albo `executeKBSearch` ma rozpoznawać projekt po nazwie w obrębie organizacji. Potem jeden przebieg z realnym modelem na potwierdzenie punktu (b). Wymaga osobno autoryzowanego budżetu.

---

## Pierwotna karta odbioru adwersaryjnego

# ★ NIE SCALAĆ BEZ FIX-217 — dyżur 217 (GF-AGT-02), gałąź `codex/day217-gf-agt-02-20260831`, tip `0144aaf0ce` — 31.08.2026

**Ocena: B.** Dyżur jest UCZCIWY i technicznie porządny, ale **nie zamyka modułu 17**.
Wykonawca sam to napisał („PARTIAL / moduł 17 NIEZAMKNIĘTY") i nie zawyżył ani jednego
zdania — to rzadkie i warte odnotowania. Audyt potwierdził jego meldunek co do joty i
**znalazł jedną dziurę, której wykonawca nie zauważył**: ostatnie ogniwo łańcucha nie
jest chronione ŻADNĄ asercją.

## Co realnie weszło do repo
Jeden commit, 5 plików, **322 wstawienia, 0 usunięć, zero zmian w kodzie produktu**:
2 dokumenty, 1 raport, `server/scripts/day217-real-model-probe.ts` (nowy skrypt),
`tests/integration/day217-gf-agt-02.realdb.test.ts` (nowy test). Dyżur niczego nie
naprawiał — miał tylko DOWIEŚĆ. Teza z instrukcji **potwierdzona**.

## Łańcuch ogniwo po ogniwie (odtworzony własnymi rękami)
Zbudowałem własne środowisko od zera: kontener `cx-audit217-pg` na porcie **6421**
(cudzy `cx-day217-pg` był już sprzątnięty), pełne migracje na pustej bazie, świeże
markery. **Baza wyjściowa: 4/4 PASS** — powtórzone niezależnie od wykonawcy.

| # | Ogniwo | Dowiedzione? | Czym |
|---|---|---|---|
| 1 | Model sięga po narzędzie READ | **NIE** (mechanicznie: TAK) | Model jest **atrapą** (`vi.mock` `AIPipeline`). To atrapa woła `executeReadTool`, nie model. Dowiedzione jest, że *kontekst READ jest podpięty i działa* — nie, że model po niego sięga. |
| 2 | Kontekst organizacji w promptcie | **CZĘŚCIOWO** | Marker `DAY217-ORG-CONTEXT-89630f9a8a` realnie jest w wyrenderowanym promptcie (widać w artefakcie), ale `captured.prompts` **nie jest asertowane ani razu**. |
| 3 | Propozycja → zgoda → wykonanie → zadanie | **TAK** | Realne HTTP przez `ApiGateway` + podpisany JWT + realny Postgres. Zadanie z `source_type='ai_chat_proposal'`, `source_id=actionId`, widoczne przez GET `/api/my-work/personal-tasks`. Bramka PENDING ma osobny test-wartownik. |
| 4 | Dokument realną drogą | **TAK** | POST `/api/document-studio/generate` → wiersz w `wave5_artifacts`, asercja treściowa `toContain(marker)`. |
| 5 | Wejście do wiedzy z zasięgiem | **TAK** | `knowledge_docs` + `ai_knowledge_embeddings` (2 wektory/przebieg), `scope='organization'`. |
| 6 | **Druga rozmowa korzysta z tego, co powstało** | **MECHANIZM: TAK. BRAMKA: NIE.** | patrz niżej — to jest sedno |

## ★ OGNIWO 6 — mechanizm działa, ale NIC GO NIE PILNUJE
**Dobra wiadomość (odtworzona u mnie, na świeżych markerach):** retrieval międzyrozmowowy
jest PRAWDZIWY i treściowy, nie pusto-prawdziwy:

- przebieg 1 — `search_knowledge_base` zwraca **0 wyników** (nic jeszcze nie istnieje),
- przebieg 2 — zwraca dokument z **markerem przebiegu 1**,
- przebieg 3 — zwraca markery przebiegu **1 i 2**.

Ten narastający wzór (0 → 1 → 2) jest nie do podrobienia przypadkiem. To **nie** jest
defekt pusto-prawdziwej asercji z dyżuru 210: pola są niepuste i niosą losowe markery.

**Zła wiadomość — mój ruch rozstrzygający.** Zepsułem retrieval u samego źródła
(`executeKBSearch`, `server/src/services/ai/toolDefinitions.ts:885` — realna ścieżka
trasy `/chat/stream`, nie `tools/searchKnowledgeBase.ts`, która na tej ścieżce **nie
leży**): każde wyszukanie zwraca pustkę.

> Wynik: **`Test Files 1 passed · Tests 4 passed`** — zieleń 4/4, a w artefakcie
> `results: 0` w każdym z trzech przebiegów.

**Cały łańcuch pamięci może paść, a test tego nie zauważy.** Jedyna asercja dotykająca
odczytów to `expect(captured.reads.length).toBeGreaterThanOrEqual(index)`
(`tests/integration/day217-gf-agt-02.realdb.test.ts:136`) — liczy WYWOŁANIA, nie TREŚĆ.
Dowód ogniwa 6 istnieje wyłącznie jako plik JSON oglądany ludzkim okiem. Regresja
kasująca pamięć organizacji przejdzie na zielono.

*(Uczciwie: mój pierwszy strzał w `tools/searchKnowledgeBase.ts` był chybiony — mutacja
nie ugryzła, bo ten plik nie jest na ścieżce. Gdybym nie sprawdził artefaktu, ogłosiłbym
dziurę na podstawie mutacji-atrapy. Sprawdziłem i poprawiłem.)*

## Mutacje wykonawcy — powtórzone własnymi rękami, obie UCZCIWE
- **R2** (bramka zgody `if (false && action.status !== APPROVED)`): u mnie
  **1 RED / 3 PASS**, `AssertionError: expected true to be false` — zgodne co do joty
  z `day217-r2-mutation-red.json`.
- **R4** (`inferKnowledgeScope => 'organization'`): u mnie **4 RED / 6 PASS**, w tym
  realny przeciek `does not return user A private content to user B` — zgodne z
  `day217-r4-mutation-red.json`.
  **Nieopisany niuans:** czerwień daje pakiet **Day209**, nie test dyżuru 217. Asercja
  zasięgu w 217 jest jednokierunkowa (dokument `internal` → `organization`), więc sama
  nie złapałaby wycieku. Wykonawca oparł się na cudzym pakiecie — słusznie, ale nie
  napisał tego wprost.
- Po przywróceniu: **10/10 PASS** (oba pakiety), `git status` czysty, `git diff` pusty.

## ★ R3 (dowód realnym modelem) — NIE DOSTARCZONY. Ustalenie nadzorcy POTWIERDZONE.
`day217-real-model.json`: `toolSteps: []`, `text: "  "`, `markerPresent: false`,
`durationMs: 50`, `degraded.mode: "blocked"`, `tokens.output: 0` i błąd
`TRIAL_PROFILE_INCOMPLETE` — **identycznie dla ON i OFF**. Model nie zagrał ani razu.
Mutacja flagi w tym przebiegu **nie dowodzi niczego**: obie tury zatrzymały się przed
pętlą narzędziową, więc wynik jest taki sam niezależnie od stanu flagi.

Sam skrypt ma poprawne kryterium (`process.exitCode = 2`, gdy ON nie ma tool-stepów),
więc **własna bramka wykonawcy uznała R3 za porażkę** — i wykonawca to zaraportował.

### Przyczyna — ZMIERZONA, nie zgadnięta (`plik:linia` + brakujący warunek)
`server/src/services/accessPolicyService.ts:398–416`. Bramka wymaga łącznie:
org typu TRIAL · `action='ai_call'` · `organizations.onboarding_status <> 'ORG_SETUP_COMPLETED'`
· `usage_counters.ai_calls_count >= 3` (grace = 3).

Fixture wstawia organizację tylko z `(id, name, status)` →
`organization_type` NULL → **domyślnie TRIAL** (`AccessLimitService.ts:47`), a
`onboarding_status` NULL. Trasa `/chat/stream` liczy każdą turę
(`ai.routes.ts:388` sprawdza, `:398` inkrementuje). **Trzy przebiegi łańcucha zużywają
dokładnie cały budżet łaski 3/3**, a sonda R5 celowo używa TEJ SAMEJ organizacji
(`day217-real-model-probe.ts`, `proof.fixture.organizationId`) — jest turą 4. i 5.

Zmierzone na żywej bazie (wywołanie `checkAccess`, **bez dotykania modelu**):

```
A) świeża org, 0 ai_calls          -> allowed=true
B) ta sama org, ai_calls_count=3   -> allowed=false  TRIAL_PROFILE_INCOMPLETE
C) + onboarding_status=COMPLETED   -> allowed=true
```

**To nie jest hipoteza — to pomiar w obie strony.** Łańcuch R1–R4 stał dokładnie na
krawędzi limitu: czwarta tura w teście też poszłaby na czerwono.

## Atrapy w łańcuchu (pełna lista)
1. **Model językowy — atrapa we WSZYSTKICH zielonych przebiegach** (`vi.mock` `AIPipeline`).
   Instrukcja to dopuszczała (przebiegi „injected"), ale to znaczy, że decyzja *czy*
   sięgnąć po narzędzie i *czy* zacytować znalezisko **nigdy nie została sprawdzona**.
2. **Embeddingi — atrapa** (`vi.spyOn(EmbeddingService...)`, wektor stały 0.01×1536).
   Dopuszczalne; instalowana w `beforeEach` — **poprawnie** (pułapka (b) uszanowana).
3. Klucz dostawcy w bazie: `'injected-not-sent'` — nigdy nie wychodzi na sieć. Dobrze.
4. Reszta łańcucha (trasy, JWT, Postgres, embeddings-tabela, My Work) — **realna**.

## Pułapki 31.08 — wszystkie trzy uszanowane
- **(a) `describe.skipIf`**: nie użyto. Sprawdziłem odwrotnie — przy braku `RUN_DB_TESTS=1`
  pakiet **pada głośno** (`Test Files 1 failed`, `Tests 4 skipped`) z komunikatem
  „Test bazodanowy MUSI padać, a nie być pomijany". Bezpiecznik działa.
- **(b) `clearAllMocks`**: `tests/setup.ts:811` czyści w `beforeEach`; atrapa embeddingu
  instalowana w **lokalnym** `beforeEach` (rejestrowanym później) → przeżywa. Poprawnie.
- **(c) `global.fetch`** podmieniany w `tests/setup.ts:896` — dlatego realny model **musi**
  iść osobnym skryptem `tsx`. Wykonawca to zrobił i **napisał to w komentarzu skryptu**.

## Flagi — CZYSTO
`ENABLE_TERESA_TOOL_LOOP`, `ENABLE_TERESA_TOOL_LOOP_WRITE`, `ENABLE_ARTIFACT_KNOWLEDGE_INDEX`
— wszystkie trzy nadal `z.boolean().default(false)`
(`server/src/config/FeatureFlags.ts:36,37,55`). `FeatureFlags.ts` **nie jest w commicie**.
Flagi włączane wyłącznie przez `process.env` na czas przebiegu. Zgodnie z instrukcją.

## Integralność artefaktów — sprawdzona
`day217-r2-mutation-red.json` i `day217-r4-mutation-red.json`: SHA-256 **zgadzają się**
z zadeklarowanymi w raporcie. `day217-chain.json`: **zgadza się co do bajtu**
(`497472ea…58d4`). `day217-real-model.json`: zadeklarowany skrót ma **63 znaki zamiast
64** — zgubiony jeden znak przy przepisywaniu (treść identyczna). Drobiazg, ale skróty
mają być kopiowane, nie przepisywane.

> **Błąd audytora, zgłoszony:** mój pierwszy (nieudany) przebieg testu wykonał `afterAll`,
> który **nadpisał** `day217-chain.json` wykonawcy, zanim zdążyłem zrobić kopię. Plik
> odtworzyłem z treści odczytanej na starcie — rekonstrukcja hashuje się **dokładnie** na
> zadeklarowane `497472ea…58d4`, co jednocześnie **dowodzi, że skrót wykonawcy był
> uczciwy**. Artefakt jest z powrotem w stanie oryginalnym. Lekcja: artefakt pisany przez
> `afterAll` ginie już przy pierwszym uruchomieniu cudzego testu — kopiuj PRZED.

## Powtarzalność
Trzy przebiegi są, wyniki zgodne, markery i `actionId` świeże w każdym. Potwierdzone
niezależnie na mojej bazie (3 nowe markery, ten sam narastający wzór 0 → 1 → 2).

## FIX-217 (do wykonania przed scaleniem)
1. **FIX-217-1 — asercja treściowa ogniwa 6 (BLOKUJĄCY).**
   `tests/integration/day217-gf-agt-02.realdb.test.ts:136`. Zamienić licznik na dowód
   treści: w przebiegu ≥2 wynik `captured.reads[index-1]` **musi zawierać marker
   przebiegu poprzedniego**, a w przebiegu 1 **musi być pusty** (kontrola pozytywna +
   negatywna). Bramka: mutacja `executeKBSearch` → pustka **musi** dać czerwień.
   Dziś daje zieleń 4/4 — zmierzone.
2. **FIX-217-2 — asercja ogniwa 2 (BLOKUJĄCY).**
   Ten sam plik: `expect(captured.prompts.join('\n')).toContain(ORG_CONTEXT_MARKER)`.
   Dziś `captured.prompts` jest tylko zapisywane do pliku, nigdy sprawdzane.
3. **FIX-217-3 — odblokowanie R3 (BLOKUJĄCY dla domknięcia modułu 17).**
   W fixture (`…realdb.test.ts` `beforeAll`, po wstawieniu organizacji) dodać
   `UPDATE organizations SET onboarding_status='ORG_SETUP_COMPLETED' WHERE id=$1`.
   To **uzupełnienie fixture, nie osłabienie polityki** — bramka nadal w pełni działa dla
   organizacji, które faktycznie nie skończyły konfiguracji (zmierzone: wariant C).
   Alternatywnie sonda ma zakładać **własną, świeżą** organizację zamiast dziedziczyć
   zużyty budżet. Dopiero potem nowy, osobno autoryzowany budżet 2 tur modelu.
4. **FIX-217-4 (drobny).** Poprawić 63-znakowy skrót `day217-real-model.json` w raporcie.
5. **FIX-217-5 (drobny).** `day217-real-model-probe.ts` ustawia flagę przypisaniem
   `(featureFlags as any).ENABLE_TERESA_TOOL_LOOP = enabled`. Przy R3 to nie miało
   znaczenia (obie tury padły wcześniej), ale zanim R3 ruszy — potwierdzić, że to
   przypisanie realnie dociera do trasy, inaczej ramię OFF nie będzie mutacją.

## Werdykt
**SCALIĆ PO FIX** (FIX-217-1, -2, -3). Ocena **B**.

Test jest wartościowy i uczciwie zbudowany — realny gateway, realny JWT, realny Postgres,
realne HTTP, dwie prawdziwe mutacje. Ale **dowodzi mniej, niż sugeruje jego nazwa**:
pilnuje ogniw 3–5, a ogniwa 2 i 6 tylko *pokazuje w pliku*. Bez FIX-217-1 wchodzi do
repo test, który przechodzi przy całkowicie martwej pamięci organizacji.

## Dwie odpowiedzi wprost dla właściciela
1. **Czy pełny łańcuch konsultingowy jest dowiedziony od początku do końca? — NIE.**
   Ogniwa 3, 4 i 5 są dowiedzione twardo. Ogniwo 6 (druga rozmowa korzysta z tego, co
   powstało) **działa naprawdę — zobaczyłem to na własnych danych** — ale nie jest niczym
   pilnowane: zepsułem pamięć do zera i test dalej świecił na zielono. Ogniwa 1 i 6
   z udziałem modelu nie zostały sprawdzone w ogóle.
2. **Czy Teresa zagrała realnym modelem? — NIE. Ani razu.**
   We wszystkich zielonych przebiegach model był atrapą wstrzykniętą przez test.
   W jedynym przebiegu z prawdziwym modelem model **nie został wywołany** — zatrzymała go
   bramka dostępu (`TRIAL_PROFILE_INCOMPLETE`), bo trzy wcześniejsze tury zużyły cały
   limit łaski 3 wywołań AI na tej samej organizacji. Zero tokenów wyjścia, odpowiedź to
   dwie spacje. Wiemy już **dokładnie** dlaczego i jak to odblokować (FIX-217-3), ale
   dopóki tego nie zrobimy — **moduł 17 nie może zostać zamknięty**.
