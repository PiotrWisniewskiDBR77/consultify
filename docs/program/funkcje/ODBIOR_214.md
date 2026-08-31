# ★ SCALONE PO FIX-214 (`ce21a32bc8`) — 31.08.2026

Szkic z rozmowy z Teresą daje się przyjąć jako realny obiekt. Audytor potwierdził
samodzielnie: realny `ApiGateway`, podpisany token, realny Postgres, 11/11
uruchomione jego ręką; karta w czacie **realnie renderowana** (nie sierota);
zaadoptowana inicjatywa widoczna **tą samą trasą**, którą moduł Inicjatyw wczytuje
wszystkie pozostałe; zapis idzie tą samą klasą transakcji i tym samym silnikiem co
normalna rejestracja — wzorzec „jeden writer" zachowany.

## Dlaczego FIX był konieczny
Audytor skasował sprawdzenie uprawnień (`routes.ts:1834` → `if (false)`) i **cały
dostarczony pakiet, 8/8, został ZIELONY**. Jego własny test omijający pokazał, że
aktor bez uprawnień dostaje `201` i **realny wiersz w bazie**. Czwarty raz tego
samego dnia (204, 207, 210, 214) — pierwszy raz **złapany przed scaleniem**.

## FIX-214 — bramki
Trzy testy omijające, każdy z osobną mutacją i osobną czerwienią:
- uprawnienie (`:1834`) ⇒ obserwator dostaje `201` zamiast `403`;
- uwierzytelnienie (`:1825`) ⇒ `500` zamiast `401`;
- kwalifikacja właściciela (`:1838`) ⇒ `400` zamiast `422`.
Po przywróceniu każdej: **7/7 zielono**.

## ★ Uczciwy wynik negatywny — blokada współbieżna
Wykonawca **nie wymusił czerwieni**, której nie było. Zmierzył: usunięcie blokady
(`postgresMaterialCommandUnitOfWork.ts:221-223`) nie daje niezależnej czerwieni,
bo klucz główny na `ie_aggregate_state` we wspólnym silniku i tak serializuje zapis
— nawet podwójna mutacja nie zmieniła wyniku. Test zostaje jako mechaniczne
potwierdzenie inwariantu „nigdy dwie inicjatywy", a nie jako fałszywy dowód
blokady. **To jest właściwe zachowanie**: raport mówi, czego dowieść się nie dało.

## Sprostowanie w dokumencie architektury
Ogniwo P4 sugerowało, że adopcja ma wołać `registerInitiative`. To było
**strukturalnie niemożliwe** — brak `source_proposals` dla szkiców z czatu.
Dopisane addytywnie, żeby następny czytelnik nie uznał rozwiązania za obejście.

## Zrzuty — status pochodzenia podany wprost
`dev-render/screens/day214-teresa-adopt-card.tsx` montuje **realny** komponent
karty, cztery stany napędzane realnymi kliknięciami. **Dane pochodzą z fixture'ów
w harnessie (przechwycony `fetch`), NIE z realnego przebiegu** — zapisane w pliku,
w commicie i tutaj. Zgodne z `CLAUDE.md` §7 (harness z mock-danymi jest metodą
przepisaną), ale czytelnik ma wiedzieć, czego patrzy.

**Flaga `ENABLE_TERESA_ADOPT_CHAT_DRAFT` nadal domyślnie WYŁĄCZONA** — do akceptu
właściciela na zrzutach.

---

## Pierwotna karta odbioru adwersaryjnego

# ODBIÓR 214 — Adopcja szkicu inicjatywy z czatu Teresy (`adopt-chat-draft`)

**Data audytu:** 2026-08-31
**Audytor:** sesja adwersaryjna (obalanie tez wykonawcy)
**Gałąź:** `codex/day214-adopt-draft-20260831` @ `/private/tmp/cx-day214-adopt-draft`
**Merge-base z `origin/demo`:** `e45904dc79`
**Commity:** `2feb3a08aa` (rdzeń), `32b7206de2` (dokumentacja/dowody)

## WERDYKT: SCALIĆ PO FIX

## OCENA: B — mechanizm działa przez realny interfejs, jeden writer (nie kopia), pełne
pochodzenie w bazie; ale dostarczony pakiet testów ma dziurę mutacyjną w bramie
autoryzacji, którą sam audyt wykrył i potwierdził (patrz FIX 1).

---

## 1. Co realnie weszło

Dwa commity, 988 wstawień / 0 usunięć w 11 plikach produktowych + testowych, plus
155 linii dokumentacji. To NIE jest szkielet — migracja z triggerami CHECK/immutable,
pełna metoda transakcji w istniejącej klasie writer'a, trasa z czterema bramkami,
komponent karty czatu wpięty w realny renderer wiadomości, i 11 testów (8 realDB/HTTP
+ 3 DOM), z których 11/11 przeszło pod moim niezależnym uruchomieniem.

| Plik | Rola |
|---|---|
| `server/migrations/20261900_flow_teresa_chat_draft_adoption.sql` | tabela `flow_teresa_chat_draft_adoptions` (append-only, trigger walidujący tożsamość `chat_initiative_id=runtime_initiative_id`) |
| `server/src/config/FeatureFlags.ts` | `ENABLE_TERESA_ADOPT_CHAT_DRAFT`, `default(false)` |
| `server/src/domain/initiatives-execution/adoptChatDraftInitiative.ts` | komenda `initiative.adopt-chat-draft`, woła `executeMaterialCommand` (WSPÓLNY silnik) |
| `server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.ts` | +117 linii: nowa metoda `adoptChatDraftInitiative` na ISTNIEJĄCEJ klasie `PostgresMaterialCommandTransaction` (tej samej, której używa ~40 innych komend, w tym `adoptAcceptedClassicInitiative`) |
| `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts` | `POST /api/initiatives/runtime-v1/adoptions/chat-draft`: flaga→404, auth→401, `initiative.create` capability→403, owner eligibility→422, potem komenda |
| `src/components/AIChat/GovernedInitiativeHandoffCard.tsx` | karta `idle→checking→blocked\|ready→adopting→adopted\|failed`, adopcja wymaga DRUGIEGO klika |
| `src/components/AIChat/MessageRenderer.tsx`, `UnifiedChatPanel.tsx` | wpięcie karty w istniejący event `payloadKind==='initiative'`, stan odtwarzany z `msg.metadata.initiativeHandoff` |

**Nazwane ograniczenia z tytułu commitu „…and limits” — sprawdzone jedno po drugim:**

1. „Równoległy replay tego samego `clientRequestId` nadal wpada w konflikt” —
   **PRAWDA, potwierdzone**: to jest zamierzona własność wspólnego silnika
   `executeMaterialCommand` (advisory lock na agregat), nie defekt tej komendy.
   Wykonawca uczciwie NIE oznaczył tego jako dowiedzionego mutacyjnie w obie strony
   (Z32) — zgadzam się z tą samooceną, to faktycznie NIEZROBIONE, ale nie blokuje
   merge (zachowanie jest bezpieczne fail-closed, tylko niedowiedzione formalnie).
2. „Zrzut karty: NIEZROBIONY” — zgodne z zasadą nienaruszalną #7 (Piotr nigdy
   pierwszym testerem wizualnym): flaga jest domyślnie OFF, więc to nie blokuje
   merge kodu, ale BLOKUJE włączenie flagi Piotrowi bez zrzutu z dev-render.
3. „Szeroki pakiet serwerowy... nie nazywam żadnego z tych przebiegów PASS” —
   uczciwe; potwierdziłem niezależnie że SCOPED regresja (39 plików
   `tests/unit/initiatives-execution/*`, bez realdb) daje 93/93 PASS, zero
   regresji przypisywalnej dyżurowi 214.

---

## 2. JEDEN WRITER — obalenie i wynik

**Teza wykonawcy:** „`initiative.adopt-chat-draft` jest siostrą, nie modyfikacją
mostu SWOT” — próbowałem to obalić jako uzasadnienie do zbudowania trzeciej,
osobnej ścieżki zapisu.

**Co faktycznie znalazłem po przeczytaniu kodu (nie raportu):**

- Sam OBIEKT inicjatywy (wiersz w `initiatives`, `source_type='teresa_chat'`)
  powstaje GDZIE INDZIEJ i wcześniej — w `server/src/services/ai/tools/generateInitiative.ts`
  (plik NIE dotknięty przez dyżur 214), który *"Reuses the canonical, Postgres-correct
  create path (`initiativeGenerationService` → `initiativeService`) rather than the
  legacy `create_initiative` handler"* (komentarz w pliku, linie 7-9). To jest TEN SAM
  writer, którego (wg komentarza) używa też ręczne tworzenie inicjatywy — dyżur 214
  tego NIE dubluje, bo w ogóle tego nie dotyka.
- To, co dyżur 214 DODAJE, to WYŁĄCZNIE krok gubernacyjny: promocję już
  istniejącego wiersza `initiatives` do rejestru zdarzeniowego runtime-v1
  (`ie_aggregate_state`). Metoda `adoptChatDraftInitiative` (nowa) na klasie
  `PostgresMaterialCommandTransaction` jest STRUKTURALNIE IDENTYCZNA ze wzorcem
  istniejącej, wcześniej zaakceptowanej metody `adoptAcceptedClassicInitiative`
  (linie 90-206 tego samego pliku: advisory lock → walidacja źródła FOR UPDATE →
  sprawdzenie istniejącego paragonu (idempotencja) → INSERT paragonu). Dyżur 214
  **skopiował sprawdzony wzorzec**, nie wymyślił nowego.
- Obie metody (`adoptAcceptedClassicInitiative`, `adoptChatDraftInitiative`) są
  wołane przez `executeMaterialCommand` — DOKŁADNIE ten sam silnik (walidacja
  wersji agregatu, `persistAggregate`, `appendAudit`, `appendOutbox`, `saveReceipt`),
  którego używa też `registerInitiative` (normalna rejestracja z `source_proposals`)
  i ~37 innych komend w tym katalogu. Jeden silnik zapisu, wiele typów komend — to
  jest zamierzona architektura tego modułu, NIE wzorzec z 07-12 (bespoke tabela
  omijająca kanon).

**Rozbieżność z dokumentem P4 (`ARCHITEKTURA_AGENTA_TERESY.md`), warta odnotowania:**
oryginalny opis problemu mówił „draft bez wołania `registerInitiative→handoff→execution_case`”
— sugerując, że naprawą ma być DOSŁOWNE wywołanie `registerInitiative`. Sprawdziłem
`registerInitiative.ts`: wymaga wiersza w `source_proposals` (`getSourceProposalForUpdate`),
którego draft z czatu NIGDY nie ma (bo `generateInitiative.ts` pisze bezpośrednio do
`initiatives`, z pominięciem `source_proposals`). Wołanie `registerInitiative`
dosłownie było NIEMOŻLIWE bez przebudowy generatora czatu (poza zakresem 214).
Wykonawca nie nazwał tego wprost w raporcie (zamiast tego porównał się do SWOT-a) —
to jest niedopowiedzenie, ale wybór inżynierski jest uzasadniony i zgodny z
precedensem w kodzie.

**WERDYKT cząstkowy:** obiekt-inicjatywa powstaje TYM SAMYM writerem co ręczne
tworzenie (potwierdzone przez komentarz w `generateInitiative.ts`, plik poza
zakresem 214 — NIE zweryfikowałem tego niezależnie od zera, bo leży poza diffem
tego dyżuru). Krok ADOPCJI (nowość 214) używa TEGO SAMEGO silnika komend co
`registerInitiative` i `adoptAcceptedClassicInitiative` — nie jest kopią, jest
kolejnym typem komendy w istniejącej, współdzielonej maszynerii. To NIE jest
regresja wzorca „naprawa per-wywołanie odrasta”.

---

## 3. CZWARTA WARSTWA — reachability z interfejsu

Prześledzone łańcuchy, każde ogniwo zweryfikowane w kodzie:

**Backend:** `POST /api/initiatives/runtime-v1/adoptions/chat-draft`
(`initiativesExecutionRuntime.routes.ts:1815`) → `adoptChatDraftInitiative()`
(domain) → `executeMaterialCommand` → `PostgresMaterialCommandTransaction.adoptChatDraftInitiative`
(SQL) → `ie_aggregate_state` + `flow_teresa_chat_draft_adoptions`. Potwierdzone
działające end-to-end przez realny `ApiGateway` + podpisany JWT + realny Postgres
(patrz §4 poniżej — 8/8 testów przeszło pod moim uruchomieniem, nie tylko wg raportu).

**Front:** `GovernedInitiativeHandoffCard` renderowany w `MessageRenderer.tsx:2002`
gdy `msg.role==='ai' && initiativeHandoff` — źródło danych to
`initiativeHandoffByMessageId` LUB `msg.metadata.initiativeHandoff` (przeżywa
przeładowanie rozmowy). Wpięcie w `UnifiedChatPanel.tsx:2229` (istniejący event
`payloadKind==='initiative'`, dotąd tylko nawigujący — teraz, za flagą, tworzy
wiadomość z metadanymi). `UnifiedChatPanel` NIE jest komponentem-sierotą:
zamontowany w `src/layouts/MainLayout.tsx`, `src/routes/AppRoutes.tsx` i 13 innych
miejsc — to jest realny, globalnie używany panel czatu.

**Odczyt po adopcji:** `GET /api/initiatives/runtime-v1/initiatives/:id` — TA SAMA
trasa, którą woła `InitiativesHub.tsx:931` (produkcyjny moduł Initiatives) do
otwarcia dokumentu inicjatywy. Zaadoptowana inicjatywa jest więc widoczna w TYM
SAMYM module UI co normalnie zarejestrowane — nie osobny, martwy odczyt.

**WERDYKT cząstkowy:** wszystkie cztery warstwy istnieją i są połączone. Żadne
ogniwo nie jest przerwane. (Nie zweryfikowałem wizualnie w przeglądarce — flaga
OFF, zgodnie z zasadą #7 to i tak nie byłby pierwszy test Piotra; dowód opiera się
o realny HTTP + realny DOM test, nie o zrzut ekranu.)

---

## 4. BRAMA ZGODY — dowód mutacyjny, WŁASNY test omijający

Trasa ma cztery bramki: flaga (404) → uwierzytelnienie (401) → capability
`initiative.create` (403 `CAPABILITY_REQUIRED`) → kwalifikowalność właściciela
(422). **Żaden z 11 dostarczonych testów nie wywołuje trasy aktorem BEZ capability
`initiative.create`, BEZ auth, ani z niekwalifikowanym właścicielem** — sprawdzone
grepem (`403|CAPABILITY_REQUIRED|401|AUTH_REQUIRED|INITIATIVE_OWNER_INELIGIBLE|422`
w obu plikach testowych → zero trafień).

**Mutacja wykonana i cofnięta (`server/src/routes/pmo/initiativesExecutionRuntime.routes.ts:1834`):**

```diff
- if (!(await deps.authorize(actor, parsed.data.projectId, 'initiative.create'))) {
+ if (false) {
```

Uruchomiłem CAŁY dostarczony pakiet (`adoptChatDraftInitiative.gateway.realdb.test.ts`
+ `.realdb.test.ts`, 8 testów) pod tą mutacją: **8/8 ZIELONE.** Brama autoryzacji
mogłaby zniknąć z produkcji i żaden dostarczony test by tego nie złapał — dokładnie
wzorzec z 31.08 („testy sprawdzają scenariusz użycia, nie próbują ominąć bramy”).

Napisałem własny test (`adoptChatDraftInitiative.authGate.audit.test.ts`, montuje
router bezpośrednio z realnym `resolveEffectiveAccess`/`hasEffectiveCapability`,
aktor = projekt-członek z rolą `OBSERVER`, czyli KWALIFIKOWALNY właściciel bez
capability `initiative.create`):

- **Pod mutacją:** `expected 403 to be ... received 201` — aktor bez uprawnienia
  DOSTAŁ `APPLIED`, realny wiersz w `ie_aggregate_state` i `flow_teresa_chat_draft_adoptions`
  powstał. Czerwony, poprawnie.
- **Po cofnięciu mutacji:** zielony, 403 `CAPABILITY_REQUIRED`, zero mutacji w bazie.

Plik testowy usunięty po dowodzie (nie commitowany, zgodnie z zakresem audytu) —
treść testu jest w transkrypcie audytu; do wniesienia jako FIX-214 pkt 1.

**WERDYKT cząstkowy: brama ISTNIEJE i DZIAŁA w kodzie produkcyjnym (potwierdzone
moim testem na nieomutowanym kodzie), ale dostarczony pakiet testów jej NIE
chroni.** To jest realna dziura pomiarowa, nie iluzja — wymaga FIX przed scaleniem
(dodanie testu, nie zmiana produktu).

---

## 5. KOMPLET PÓL I POCHODZENIE — zweryfikowane bezpośrednio w bazie

Uruchomiłem migrację na czystym Postgresie (lokalny kontener, port 6322, sprzątnięty
na końcu) i wykonałem realną adopcję przez router. Odczyt bezpośrednio z tabel:

`ie_aggregate_state.payload_json` (agregat inicjatywy):
```json
{"initiativeId":"...", "projectId":"...", "initiativeOwnerId":"...",
 "source":{"sourceType":"teresa_chat","sourceId":"...","freshness":"CURRENT"},
 "adoptionReceiptId":"...", "governance":{"policyId":"...","policyVersion":1},
 "lifecycleState":"REGISTERED_DRAFT"}
```

`flow_teresa_chat_draft_adoptions` (paragon append-only):
`organization_id`, `chat_initiative_id`, `runtime_initiative_id`, `project_id`,
`adopted_by` (=actorId), `adopted_at`, `policy_id`, `policy_version`, `correlation_id`.

Właściciel ✓ (`initiativeOwnerId` + `adopted_by`), organizacja ✓
(`organization_id` na obu poziomach), projekt ✓ (`projectId`/`project_id`),
pochodzenie ✓ (`source.sourceType='teresa_chat'` + `source.sourceId`, plus
`chat_initiative_id` jako FK do oryginalnego wiersza czatu w `initiatives`).
Wzorzec z 207 (`source_type='ai_chat_proposal'`+`source_id=<actionId>`) NIE jest
kalką 1:1 — tu `source_type='teresa_chat'` (dziedziczone z oryginalnego wiersza,
nie z „action” czatu), co jest spójne z tym, że obiekt czatu ISTNIAŁ już wcześniej
(inaczej niż w 207, gdzie adopcja BYŁA aktem tworzenia). Brak orphana: każdy pod-krok
ma FK/wymagalność (CHECK w trigerze migracji wymusza `title`, `problem_statement`,
`owner_execution_id`/`owner_business_id`, `project_id` PRZED adopcją).

---

## 6. FLAGA

`ENABLE_TERESA_ADOPT_CHAT_DRAFT`, `z.boolean().default(false)`
(`server/src/config/FeatureFlags.ts:35`). Realna implementacja za flagą w TRZECH
miejscach (nie fantom): trasa (`routes:1820`, 404 gdy OFF), front
(`UnifiedChatPanel.tsx:809`, `isEnabled(...)` steruje czy karta w ogóle powstaje
zamiast starej nawigacji). Dowód behawioralny: mój test i dostarczony test
gateway OBA potwierdzają 404 przy OFF; dostarczony test potwierdza 201 przy ON.

---

## 7. PUŁAPKI POMIAROWE

(a) `clearAllMocks`: nie dotyczy — żaden test dyżuru 214 nie instaluje atrap w
`beforeAll`/`beforeEach` (testy realDB używają prawdziwego Postgresa i prawdziwego
`ApiGateway`, front-testy używają `vi.fn()` per-test, nie globalnych mocków).
(b) `describe.skipIf`: sprawdzone grepem w obu plikach realdb + audit-teście —
zero wystąpień `describe.skip`/`.skipIf`. Jeden plik (`adoptChatDraftInitiative.realdb.test.ts`)
ma `describeRealDb = databaseUrl ? describe : describe.skip` — TO JEST znany wzorzec
ryzyka (cichy skip bez `DATABASE_URL`), ale w moim uruchomieniu `DATABASE_URL` był
ustawiony i testy REALNIE wykonały się (potwierdzone: 3 testy z realnymi zapytaniami
SQL, nie 0 assercji). Ryzyko teoretycznie obecne w CI bez zmiennej — analogiczne do
reszty testów realdb w tym repo, nie unikalne dla 214.

---

## 8. REGRESJA

Scoped, bez pełnego `tsc`/`vitest`:
- `tests/unit/initiatives-execution/*.test.ts` (39 plików, bez realdb): **93/93 PASS**, zero regresji.
- 14 plików dotykających `MessageRenderer`/`UnifiedChatPanel`/chat: **112/112 PASS**.
- `npx tsc -p server/tsconfig.json --noEmit`: **exit 0**, potwierdzone niezależnie.
- 8 dostarczonych testów realDB/HTTP (`adoptChatDraftInitiative.*.realdb.test.ts`): **8/8 PASS** pod moim uruchomieniem (nie tylko wg raportu wykonawcy).
- Front DOM (`GovernedInitiativeHandoffCard.test.tsx`): **3/3 PASS**.

Brak regresji przypisywalnej dyżurowi 214 w zakresie sprawdzonym.

---

## FIX-y wymagane przed SCALIĆ

1. **`tests/integration/initiatives-execution/adoptChatDraftInitiative.gateway.realdb.test.ts`** —
   dodać test bramy autoryzacji: aktor będący kwalifikowalnym członkiem projektu
   (np. rola `OBSERVER`) BEZ capability `initiative.create` → oczekiwane 403
   `CAPABILITY_REQUIRED`, zero wierszy w `ie_aggregate_state`/`flow_teresa_chat_draft_adoptions`.
   Wzorzec gotowy (napisany i zweryfikowany mutacyjnie w tym audycie — patrz §4).
2. **Ta sama trasa** — dodać analogiczny test dla 401 (`AUTH_REQUIRED`, brak `req.user`)
   i 422 (`INITIATIVE_OWNER_INELIGIBLE`, właściciel spoza projektu) — oba gałęzie
   `initiativesExecutionRuntime.routes.ts:1826` i `:1839` są równie nieosłonięte.
3. **Dokumentacja P4 w `ARCHITEKTURA_AGENTA_TERESY.md`** — dopisać wprost, że
   `registerInitiative` był strukturalnie niemożliwy do użycia (brak
   `source_proposals` dla draftów czatu) i że wybrano wzorzec
   `adoptAcceptedClassicInitiative` zamiast tego — inaczej następny wykonawca
   przeczyta P4 dosłownie i albo zdubluje pracę, albo zgubi uzasadnienie.
4. Nie blokuje merge, ale zanotować jako otwarte przed pokazaniem Piotrowi:
   zrzut dev-render karty (zgodnie z zasadą #7) i dowód mutacyjny w obie strony
   dla advisory locka (Z32, self-admitted NIEZROBIONY).

---

## Odpowiedź wprost

**Czy szkic z rozmowy da się dziś przyjąć przez interfejs?** TAK — potwierdzone
realnym HTTP przez produkcyjny `ApiGateway`, realnym JWT, realnym Postgresem
(8/8 dostarczonych testów + moje niezależne uruchomienie), oraz realnym renderem
karty w `MessageRenderer`/`UnifiedChatPanel` (3/3 DOM). Ścieżka jest kompletna:
trasa → komenda → writer → agregat → ten sam odczyt co moduł Initiatives.

**Czy powstaje tym samym writerem co obiekt tworzony normalnie?** TAK, w dwóch
warstwach: (1) sam wiersz inicjatywy powstaje przez `initiativeGenerationService`
(niezmieniony przez 214, wg jego własnego komentarza „canonical... create path”);
(2) krok adopcji/gubernacji używa TEGO SAMEGO silnika komend
(`executeMaterialCommand` + `PostgresMaterialCommandTransaction`), którego używa
`registerInitiative` i pokrewna, wcześniej zaakceptowana `adoptAcceptedClassicInitiative`
— nowy kod jest kolejnym typem komendy w istniejącej maszynerii, nie kopią writera
ani trzecią, dziką ścieżką zapisu.

Jedyna realna luka to POMIAROWA, nie produktowa: brama autoryzacji działa, ale
żaden dostarczony test tego nie dowodzi — potwierdzone mutacyjnie w obie strony
w tym audycie (§4).
