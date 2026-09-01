# ★★★ SCALONE PO FIX-231 (`cc3c9ff687`) — 1.09.2026

## Odpowiedź na pytanie, dla którego powstała cała fala 18

**Czy konspekt decku powstaje z wiedzy organizacji? TAK — dowiedzione parą rozstrzygającą.**

Audytor wykonał krok `R5b`, **który wykonawca pominął**: atrapa podmienia wyłącznie
`llmService.callStream`, a wołany jest **prawdziwy** łańcuch
`executeReadTool → executeToolCall → executeKBSearch → ragService.hybridSearch`,
przez realną trasę HTTP i realny Postgres, **bez modelu**.

Fakt dowodowy: dwie losowe liczby (`62,43%`, `35,59%`) **wyłącznie w treści
dokumentu**, kod bez wspólnego rdzenia z tytułem decku — żaden z trzech błędów
konstrukcji dowodu, które popełniliśmy przy module 17.

| przebieg | wynik |
| --- | --- |
| flaga ON, dokument w zasięgu | 200 · **obie liczby w konspekcie i w `outline_json`** |
| inna organizacja | 200 · `results: []` · **żadna liczba** |
| pętla narzędziowa wyłączona | narzędzie **nigdy nie zawołane** |

`pairDecisive: true`. **To nie jest dopasowanie po słowach kluczowych** — a właśnie
tym był `generateOutline` przed tym dyżurem: szablon plus słowa kluczowe, zero
modelu, zero organizacji, zero bazy wiedzy.

## ★ Najgroźniejsze, co odbiór wyłapał: stempel pochodzenia KŁAMAŁ

`source_type='org_knowledge_outline'` był **echem flagi**, nie faktem. Czterej
producenccy wołacze nie przekazują tożsamości aktora ⇒ konspekt powstawał **z
szablonu**, a deck dostawał stempel **„z wiedzy organizacji"**. Produkt twierdziłby
o sobie nieprawdę dokładnie w polu, które ma być dowodem.

Naprawione: stempel wystawiany z **faktu** (`groundedOutlineUsed`, ustawiany dopiero
po realnym wywołaniu), nie z ustawienia flagi. Bramka: przebieg bez aktora ⇒
`source_type='manual'`; mutacja przywracająca echo ⇒ **czerwień**.

## ★ Piąty raz w programie: zabezpieczenie zielone, bo nie działa nikomu
Filtr źródeł szukał `documentId`, a wyszukiwarka zwraca wyłącznie
`content`/`documentTitle`/`score` ⇒ **żadne źródło nigdy nie przechodziło**
(`source_refs_json = []` przy obecnym fakcie). Para dowodowa wypadała połowicznie:
„wymyślone odrzucone" TAK, „prawdziwe przechodzi" **strukturalnie niemożliwe**.
Naprawione dopasowaniem znormalizowanym; **obie strony pary teraz zielone**, mutacja
starego filtra ⇒ 3/6 czerwonych.

## Pozostałe naprawy z bramkami
- **strażnik bez pokrycia** — mutacja `if (false)` zostawiała testy 4/4 zielone;
  dopisany test omijający, mutacja ⇒ 1/6 czerwone;
- **`projectId` bez weryfikacji własności** — naprawione wzorem FIX-206 (organizacja
  sprawdzana przed użyciem), plus koperta `try`, limit kosztu `$0,08`, timeout
  i tryb prywatny; dowód na dwóch organizacjach;
- **ukryta zależność od cudzej flagi** — dawała **500 dla każdego**; teraz uczciwy
  `409` z nazwanym powodem.

## Świadomie niezrobione
Test end-to-end z flagą ON (wymaga jednoczesnego włączenia dwóch flag przy
inicjalizacji bramy, realnych embeddingów i doprecyzowania promptu o zasięg
projektu). **Zostawione jawnie otwarte, nie przemilczane.**

## Regresja
19 plików / 30 testów zielonych, w tym cztery obowiązkowe z dyżurów 210, 213 i 217.

---

## Pierwotna karta odbioru adwersaryjnego

# ODBIÓR 231 — GAMMA: DECK Z WIEDZY ORGANIZACJI (audyt adwersaryjny)

Data audytu: 2026-09-01 · Gałąź: `codex/day231-gamma-zwiedzy-20260901` · Marker: `9fb7942a01`
Audytor: sesja adwersaryjna (Opus). Raport wykonawcy traktowany jako hipoteza, nie dowód.

## WERDYKT: **SCALIĆ PO FIX** · ocena **B−**

Mechanizm istnieje i **działa** — udowodniłem to własnymi rękami, czego wykonawca nie zrobił.
Ale prowieniencja jest **zepsuta i w dwóch miejscach kłamie**, a bezpiecznik „fail-closed"
nie ma pokrycia testem. Nie wolno tego włączać na demo przed FIX-1 i FIX-2.

---

## 0. ODPOWIEDŹ NA PYTANIE GŁÓWNE

**Czy konspekt decku powstaje dziś z wiedzy organizacji? TAK — mechanicznie udowodnione,
ale bez sprawdzalnego źródła przy tezie i z fałszywą etykietą pochodzenia na decku.**

Czym udowodniłem (wykonałem `R5b` — krok obowiązkowy, którego wykonawca pominął):
własna sonda `tsx`, atrapa podmieniająca **wyłącznie** `llmService.callStream`, wołająca
PRAWDZIWY `context.executeReadTool` → `executeToolCall` → `executeKBSearch` →
`ragService.hybridSearch`. Realna trasa HTTP `POST /api/presentations/generate/outline`
przez realny `ApiGateway`, realny Postgres (pgvector pg16, port 6633), **zero modelu**.

Konstrukcja faktu zgodna z `R5a` (bez trzech błędów modułu 17): dwie liczby **losowe**
(`62,43%` i `35,59%`) **wyłącznie w treści** dokumentu; kod `Kalinowy-71b23` bez wspólnego
rdzenia z tytułem decku („Kierunki na kolejny kwartał"); zero faktu, tytułu dokumentu
i znacznika w poleceniu; normalizacja białych znaków przed sprawdzeniem obecności.

| Przebieg | Warunek | Wynik zmierzony |
|---|---|---|
| **ZIELONY** | flaga ON, dokument w zasięgu, `vault_scope='project'` | HTTP 200 · **obie liczby w konspekcie i w `outline_json`** |
| **CZERWONY-1** | ta sama sonda, aktor z **innej organizacji** | HTTP 200 · `results: []` („Brak dokumentów w wybranym sejfie Vault") · **żadna liczba** |
| **CZERWONY-2** | `ENABLE_TERESA_TOOL_LOOP=false` (`AIPipeline.ts:466`) | HTTP **500** · narzędzie nigdy nie zawołane |
| ZIELONY-B | ten sam dokument, `vault_scope='organization'` | HTTP 200 · `results: []` · **żadna liczba** |

`VERDICT {"greenCarriesFact":true,"redLosesFact":true,"pairDecisive":true}`

**To nie jest dopasowanie po słowach kluczowych.** Teza wraca z realnego executora wiedzy;
odcięcie dostępu zabiera fakt. Zastrzeżenie uczciwe: sonda dowodzi **transportu**
(wiedza → narzędzie → konspekt → deck), nie dowodzi, że **realny model sam z siebie** wywoła
`search_knowledge_base` z właściwym zasięgiem. To zostaje otwarte (`R5c`, budżet właściciela).

---

## 1. CO REALNIE WESZŁO (od merge-base `9fb7942a01`)

| Warstwa | Pliki | Linie |
|---|---|---|
| **Kod produktu (backend)** | `presentationKnowledgeOutlineService.ts` (nowy, 122) · `presentationGeneratorService.ts` (+50/−10) · `presentations.routes.ts` (+4) · `FeatureFlags.ts` (+9) | ~185 |
| **Kod produktu (front)** | `wizard/OutlineStep.tsx` (+18/−1) · `wizard/types.ts` (+3) | ~20 |
| **Testy** | `day231.presentationKnowledgeOutlineService.test.ts` (36) · `day231.presentationOutline.gateway.pg.test.ts` (78) | 114 |
| **Rusztowanie dowodowe (NIE produkt)** | `dev-render/screens/day231-konspekt-z-wiedzy.tsx` (65) · `dev-render/main.tsx` (+8) | 73 |
| **Dokumentacja** | raport (140) | 140 |

`11f3dcb837 feat(day231): add knowledge outline review evidence screen` — mimo `feat(...)`
to **rusztowanie harnessu**, nie ekran produktu. Produkcyjny krok konspektu (`OutlineStep`
w `PresentationWizard`) istniał przed dyżurem; dyżur dołożył do niego 18 linii chipów źródeł.
Wykonawca opisuje to uczciwie (`R2 — teza instrukcji obalona`) i ma rację: pełna kolejność
konspekt-przed-deckiem już była w produkcji.

---

## 2. „UNRESOLVED CONTENT GATE" — CO DOKŁADNIE ZOSTAŁO NIEROZSTRZYGNIĘTE I CZY TO PODWAŻA CAŁOŚĆ

Wykonawca zgłasza sprzeczność `Z15` („zero modelu językowego") × `R5c` („przebieg z realnym
modelem") i wybiera `Z15`. **Sprzeczność jest realna — ale dotyczy WYŁĄCZNIE `R5c`.**

`R5b` jest w instrukcji opisane dosłownie jako **„Realna trasa HTTP, realna baza, zero LLM"**
i jest oznaczone **KROK OBOWIĄZKOWY**. Licencja plikowa wprost przewiduje nowy skrypt
`server/scripts/day231-*.ts` wzorem `modul17-mock-verify.ts`. `Z15` nie blokuje `R5b`
w żadnym punkcie. Wykonawca użył sprzeczności dotyczącej `R5c` jako powodu do pominięcia
**całej** bramki treściowej, łącznie z jej darmową, bezmodelową połową.

**Czy to podważa całość? Nie podważa produktu — podważa raport.** Wykonany przeze mnie `R5b`
wypadł POZYTYWNIE. Zatrzymanie się przed `R5c` było poprawne; zatrzymanie się przed `R5b`
nie było. Skutek uboczny: wykonawca oddał funkcję, o której sam nie wiedział, że działa,
i **nie zobaczył dwóch defektów, które `R5b` wykrywa natychmiast** (FIX-1, FIX-2 poniżej).

---

## 3. USTERKI ZMIERZONE

### FIX-1 (P0) — PROWIENIENCJA KŁAMIE: `source_type='org_knowledge_outline'` jest ECHEM FLAGI, nie pochodzeniem
`server/src/services/presentationGeneratorService.ts:1597-1602`

```ts
const resolvedSourceType = isDeckFromKnowledgeEnabled() ? 'org_knowledge_outline' : ...
const resolvedSourceId  = isDeckFromKnowledgeEnabled() ? actor?.projectId || setup.projectId || organizationId : ...
```

Warunek pyta o **flagę**, a nie o to, czy gałąź wiedzy została wykonana. Gałąź wiedzy wymaga
`isDeckFromKnowledgeEnabled() && actor?.userId` (`:1530`). **Czterech producenckich wołaczy
`generateOutline` nie przekazuje `actor`:**

- `server/src/services/presentationStudioOrchestrationService.ts:723`
- `server/src/services/notebookConversionService.ts:469`
- `server/src/services/v8/artifactRegistryService.ts:4322`
- `server/src/services/deliverables/deliverablesGenerationService.ts:214`

Dla nich, przy fladze ON, konspekt powstaje **z szablonu i słów kluczowych**, a deck dostaje
etykietę „powstał z wiedzy organizacji". Odtworzone pomiarem na realnym Postgresie:

```text
PROVENANCE_NO_ACTOR {"deckId":"834b9eaf8ae841e7ab7df97c2f7e91ed",
 "source_type":"org_knowledge_outline","source_id":"0642e9ab-...","source_refs_json":"[]"}
```

To jest **dokładnie najgorszy możliwy wynik** nazwany w karcie audytu: dopasowanie po słowach
kluczowych przebrane za wiedzę. Ten sam defekt widać w CZERWONYM-1: brak jakiejkolwiek wiedzy,
a deck i tak stemplowany `org_knowledge_outline`.

**Naprawa:** stempel wystawiać z FAKTU wykonania gałęzi (lokalna flaga `groundedOutlineUsed`
ustawiana w `:1530`), nie z `isDeckFromKnowledgeEnabled()`; `source_id` bez fallbacku na
`organizationId` (dziś każdy deck bez projektu dostaje id organizacji jako „źródło").

### FIX-2 (P0) — FILTR ŹRÓDEŁ JEST ZAMKNIĘTY NA GŁUCHO: żadna teza nie dostanie źródła
`server/src/services/presentationKnowledgeOutlineService.ts:59` × `server/src/services/ai/toolDefinitions.ts:1174-1178`

```ts
zrodla: item.zrodla.filter((source) => evidence.includes(source.id))
```

`evidence` to surowy wynik `executeKBSearch`, który zwraca **wyłącznie** `content`,
`documentTitle`, `score` — **`documentId` NIE JEST ZWRACANY**. Żaden identyfikator dokumentu
nie może więc wystąpić w dowodzie, a zatem **żadne źródło nigdy nie przejdzie filtra**.
Zmierzone na ZIELONYM przebiegu (fakt obecny, obie liczby w tezie):

```text
RUN ZIELONY ... outlineN1=true outlineN2=true source_type=org_knowledge_outline refs="[]"
```

Skutki łańcuchowe: `zrodla: []` → `sourceRefs: []` → `source_refs_json: '[]'` **zawsze** →
chipy źródeł w `OutlineStep.tsx:322-334` **nigdy się nie wyrenderują z realnych danych**.

To jest piąty w tym programie przypadek „zabezpieczenie zielone, bo funkcja nie działa nikomu".
**Para dowodowa wymagana kartą wypada połowicznie:** „wymyślone źródło odrzucone" — TAK
(test jednostkowy + mutacja B); „prawdziwe źródło przechodzi" — **NIE, jest to strukturalnie
niemożliwe**.

**Naprawa:** albo `executeKBSearch` zwraca `documentId` (plik jest ZAKAZ ZAPISU — decyzja
nadzorcy, osobny dyżur), albo dowód dopasowywać po `documentTitle` z normalizacją, albo
budować `zrodla` po stronie serwera z wyniku executora zamiast prosić o nie model.
★ Dopóki FIX-2 nie wejdzie, zrzut `day231-konspekt-*.png` pokazuje stan, którego produkt
**nie umie wyprodukować** (chipy źródeł pochodzą z hardkodowanego fixture `:6-32`).

### FIX-3 (P0) — BEZPIECZNIK FAIL-CLOSED BEZ POKRYCIA (dowód mutacyjny NEGATYWNY)
`server/src/services/presentationKnowledgeOutlineService.ts:112-114`

| Mutacja | Oczekiwane | **Zmierzone** |
|---|---|---|
| bazowy przebieg | zielony | `success=true`, 4/4 |
| **A:** `if (!toolCalls.includes('search_knowledge_base'))` → `if (false)` | **CZERWIEŃ** | **ZIELEŃ, 4/4, exit 0** |
| **B:** `evidence.includes(source.id)` → `true` | czerwień | czerwień, 3/4, exit 1 |

Strażnik „model musi sam sięgnąć po wiedzę" — jedyny element odróżniający deck z wiedzy od
decku halucynowanego — **nie jest chroniony żadnym testem**. Mutacja A przechodzi niezauważona.

### FIX-4 (P1) — OBEJŚCIE FIX-206: `projectId` bez weryfikacji własności
`server/src/services/presentationKnowledgeOutlineService.ts:91-96` vs wzorzec `server/src/routes/ai.routes.ts:4944-4961`

Referencyjna fabryka `executeReadTool` przepuszcza `projectId` do `executeToolCall`
**dopiero po potwierdzeniu, że projekt należy do organizacji z tokena** (FIX-206 P0, zmierzony
wyciek cross-org). Nowa ścieżka bierze `req.body.projectId` (`presentations.routes.ts:1920`)
i wkłada go do executora **bez tej weryfikacji**. Druga warstwa obrony (org-scope w samych
zapytaniach) prawdopodobnie ratuje sytuację — ale wzorzec obrony został skopiowany niepełnie,
a to jest dokładnie ten sam kształt defektu, który już raz kosztował P0.

Brakuje też, wobec wzorca: koperty `try` wokół wywołania (wyjątek z executora wywraca całą
turę — FIX-206 pkt 6), limitu kosztu (`maxPaidCostUsd`), wyścigu z zegarem (TIMEOUT) i
`privateMode` (tryb prywatny rozmowy **nie dociera** do `executeKBSearch` na tej ścieżce).

### FIX-5 (P1) — UKRYTA ZALEŻNOŚĆ OD DRUGIEJ FLAGI, brak jej w raporcie
`ENABLE_DECK_FROM_KNOWLEDGE=true` **sam z siebie psuje generowanie konspektu**: `AIPipeline.ts:466`
wymaga `ENABLE_TERESA_TOOL_LOOP` (default OFF, `FeatureFlags.ts:36,153`), bez niej model nie
dostaje narzędzi, strażnik `:112` rzuca `KNOWLEDGE_OUTLINE_SEARCH_NOT_CALLED`, trasa oddaje
**HTTP 500 dla każdego użytkownika**. Zmierzone (CZERWONY-2). Ani serwis, ani raport tego
nie deklarują. Do runbooka włączenia: obie flagi razem albo żadna.

### FIX-6 (P2) — dowód RealPG mierzy wyłącznie ścieżkę WYŁĄCZONĄ
`server/src/routes/__tests__/day231.presentationOutline.gateway.pg.test.ts:27`
`expect(process.env.ENABLE_DECK_FROM_KNOWLEDGE).not.toBe('true')` — jedyny test end-to-end
biegnie z flagą OFF i asertuje `source_refs_json = []`. Mutacja wykonawcy
(`JSON.stringify(knowledgeSources)` → `NULL`) czerwieni ten test, ale mutowana wartość na
ścieżce OFF jest **zawsze pustą tablicą** — to dowód, że test dotyka INSERT-a, nie że
prowieniencja wiedzy działa. Brakuje bliźniaczego testu z flagą ON (wzorzec: moja sonda).

### FIX-7 (P2) — model nie wie, że ma pytać o zasięg projektu
Prompt (`presentationKnowledgeOutlineService.ts:71-75`) nie podaje ani `vault_scope`, ani
NAZWY projektu. Zmierzone: `vault_scope='organization'` na dokumencie projektowym zwraca
**pustkę** (ZIELONY-B). Realny model, nie znając nazwy projektu, najprawdopodobniej trafi
w pustkę i wywoła fail-closed 500. Wzorzec do skopiowania: `modul17-mock-verify.ts:161-167`
(FIX-217 name-resolution).

### FIX-8 (P2) — gałąź wiedzy zjada szablon i `archetyp` bez walidacji
`presentationGeneratorService.ts:1530` — przy fladze ON `setup.templateId` jest **ignorowany**
(gałąź `else if`), więc włączenie flagi globalnie wyłącza szablony deckowe. `:1541`
`intent: (item.archetyp || ...) as SlideIntent` — surowa wartość od modelu rzutowana na typ
bez walidacji przeciw liście dozwolonych intencji.

---

## 4. PUŁAPKI POMIAROWE — CO ZROBIŁEM, ŻEBY NIE ZOSTAĆ OSZUKANYM

- `NODE_ENV=test` + **`RUN_DB_TESTS=1`, `MOCK_DB=false`, `DB_TYPE=postgres`, jawny `DATABASE_URL`** — atrapa bazy z `Database.ts:80-88` odcięta; `DB_TYPE` z `vitest.config.ts:210` nadpisany env.
- Realny model wołany **wyłącznie** przez skrypt `tsx`, nigdy z `*.test.ts` (`tests/setup.ts:896` podmienia `global.fetch`) — a i tak modelu **nie wołałem wcale**: `OPENROUTER_API_KEY` ustawiony na jawnie fałszywą wartość `AUDIT231-FAKE-NO-NETWORK` tylko po to, żeby `modelRouter.ts:1565` przepuścił routing; `llmService.callStream` podmieniony przed jakimkolwiek ruchem sieciowym.
- `--retry=0` wszędzie (wektor „test leczy się skutkiem własnego ataku").
- Czytany **kod wyjścia** i pola `success`/`numFailedTests` z reportera JSON, nie wiersz `Tests`.
- Normalizacja białych znaków przed sprawdzeniem obecności liczb (pułapka `63 . 4 %`).
- Sonda zwalidowana na znanym przypadku: pierwszy przebieg z `vault_scope='organization'` dał uczciwą pustkę, drugi z `vault_scope='project'` dał fakt — sonda rozróżnia, nie zawsze mówi „tak".
- Atrapa **nie zna faktu**: teza budowana wyłącznie z regexu po treści zwróconej przez PRAWDZIWY executor. Brak wiedzy ⇒ atrapa nie ma czego napisać.

## 5. REGRESJA OBOWIĄZKOWA — ZIELONA

```text
day210.embeddingScope.pg.test.ts          passed
day210.realchain.proof.pg.test.ts         passed
day213.projectScopeRealChain.pg.test.ts   passed
fix217.vaultProjectNameContract.pg.test.ts passed
Test Files 4 passed · Tests 17 passed / 0 failed · success=true · exit=0
```

## 6. HIGIENA

Port 6633 (poza 6161-6176 i 5110-5141), kontener `cx-audit231-pg` usunięty
(`docker rm -f -v`). Zero `git stash` — odkładanie przez `cp`, obie mutacje przywrócone,
`git status --short` **pusty**, tip `7e3bc87337` bez zmian. Sonda audytora usunięta z drzewa.
Zero połączeń do demo/stagingu/produkcji/Railway. Zero pushów. Zero wywołań realnego modelu.

## 7. CO ZOSTAJE OTWARTE PO FIX-ach

- `R5c` — czy **realny model sam** wywoła `search_knowledge_base` z zasięgiem projektu (budżet właściciela; wykonać dopiero po FIX-7).
- Atrybucja każdej liczby wewnątrz `deck_json`/`unified_json` (dziś prowieniencja kończy się na `outline_json`).
- Finalny PPTX z nowej ścieżki — nie generowany ani razu.
