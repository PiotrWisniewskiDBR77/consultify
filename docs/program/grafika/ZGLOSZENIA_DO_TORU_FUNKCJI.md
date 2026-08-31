---
doc_id: grafika-zgloszenia-funkcje
status: living
truth_type: handover
established: 2026-08-31
---

# ZGŁOSZENIA DO TORU FUNKCJI — rejestr

Ten plik zbiera sprawy **wykryte w torze grafiki, które nie należą do toru
grafiki** — nie dotyczą wyglądu ekranów (StandardTable/StandardModuleBar/
ArtifactRightPanel), tylko mechaniki, backendu, treści merytorycznej albo
długu wobec licencjodawcy. Tor grafiki je zauważa (bo ogląda żywe ekrany
oczami i mierzy realny runtime), ale ich naprawa jest poza jego mandatem.

**Zasada:** wpis tu ≠ zamknięcie sprawy. To przekazanie, nie odbiór. Każda
pozycja zostaje, dopóki ktoś z toru funkcji jej nie podejmie i nie oznaczy
jako zamkniętą (dopisując datę/SHA obok pozycji, nie kasując wiersza).

## Format wpisu

| # | Priorytet | Charakter ustalenia | Tytuł | Gdzie (plik:linia) | Status |
| --- | --- | --- | --- | --- | --- |

`Charakter ustalenia` rozróżnia dwie jakości dowodu (patrz `korpus pułapek
harnessu` — hipoteza staje się faktem tylko przez pomiar mutacyjny na żywym
systemie, nie przez lekturę kodu):
- **hipoteza z dowodem kodowym** — ścieżka w kodzie prowadzi jednoznacznie do
  problemu, ale NIE zmierzono efektu na żywym/deployowanym systemie.
- **potwierdzone mutacyjnie** — ktoś wywołał defekt na żywo i zaobserwował
  skutek, nie tylko przeczytał kod.
- **zastane, nienaprawione** — znany od wcześniej, zgłoszenie tu tylko
  konsoliduje odnośnik.

---

## Rejestr

| # | Priorytet | Charakter | Tytuł | Gdzie | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | P0-bezpieczeństwo | hipoteza z dowodem kodowym | Okno 300 ms bez ochrony demo przy przełączaniu trybu | `src/store/useAppStore.ts:94-95` → `src/services/api.ts:761,778-780` | otwarte |
| 2 | P1 | hipoteza z dowodem kodowym | `runtimeApi.ts` łyka nie-JSON jako `null` → anonimowy TypeError → mylący `INITIATIVE_DATA_CONTRACT_ERROR` | `src/services/initiatives-execution/runtimeApi.ts:510-516,1059-1078` | otwarte |
| 3 | P1 | potwierdzone mutacyjnie | Arkusz: wpisana wartość znika po Enter | ekran „excele-edytowalna-siatka" (dyżur wcześniejszy) | otwarte — NIE zapalać właścicielowi |
| 4 | P2 | potwierdzone mutacyjnie | `SwotLiveArtifact.tsx` bez wołacza w produkcie | `src/components/.../SwotLiveArtifact.tsx` (przegląd nocny 04-narzedzia) | otwarte |
| 5 | P2 | potwierdzone mutacyjnie | Żargon inżynierski w treści raportu z oceny | `src/method-core/methods/drd/drdSessionRuntime.ts:507,613,621-623` | otwarte |
| 6 | P2 | potwierdzone mutacyjnie | Jądro `FilterableTable` — podłoga 112px w `columnFit` ściska kolumny przy przepełnieniu | jądro `FilterableTable` (228 importerów) + `ExecutionSummaryOneLook.tsx` (tabela „TOP ryzyka", wymuszone 980px) | otwarte — wymaga osobnego nadzorowanego dyżuru |
| 7 | P2 | zastane, nienaprawione (wymaganie właściciela) | System bramki zapisu dla metod licencjonowanych (SIRI) | `KANON_Z_ODBIOROW.md` (wpis 31.08) | otwarte — tor grafiki odpowiada tylko za uczciwy komunikat |
| 8 | P3 | zastane, nienaprawione | Excel: „Zadanie ukończone / 0-z-8" po ponownym otwarciu | ekran „excele-edytowalna-siatka" | otwarte — zgłoszone wcześniej torowi funkcji |

---

## Szczegóły

### 1. [P0-bezpieczeństwo] Okno 300 ms bez ochrony demo przy przełączaniu trybu

**Charakter:** hipoteza z dowodem kodowym — ścieżka w kodzie jest jednoznaczna,
ale NIE zmierzone na żywym backendzie. Wymaga osobnego dyżuru pomiarowego
z instrumentacją (np. przechwycenie realnych żądań w oknie 0-300ms po
przełączeniu), zanim to wejdzie do rejestru jako potwierdzone.

Flaga `isDemoMode` trafia do nagłówka `X-Demo-Mode` przez lustro w
`localStorage`, a nie bezpośrednio z pamięci store'a:

- Zapis do `localStorage` idzie z debounce 300 ms:
  `src/store/useAppStore.ts:94-95` (funkcja `setItem` w `appStoreStorage`,
  `window.setTimeout(..., 300)`).
- `getHeaders()` czyta ten sam `localStorage` przez `getDemoFlags()` i dopina
  `X-Demo-Mode`: `src/services/api.ts:761` (`const { isDemoMode, demoSessionOrgId } = getDemoFlags();`),
  `src/services/api.ts:778-780` (dopięcie nagłówka, tylko gdy `isDemoMode`).
- Przełącznik użytkownika: `src/hooks/useDemo.ts:86` (`toggleDemoMode`) wywołuje
  `setState` na store, co jest natychmiastowe w pamięci, ale localStorage
  aktualizuje się dopiero po debounce.
- Po stronie serwera: `server/src/middleware/auth.middleware.ts:773-777`
  rozstrzyga PRAWDZIWĄ organizację, gdy nagłówek demo nie przyszedł.
  `server/src/middleware/demoGuard.middleware.ts:266` — `demoWriteProtection`
  nie blokuje zapisu, gdy nagłówek jest nieobecny.

**Efekt hipotetyczny:** przez ~300 ms po włączeniu trybu demo żądania mogą
lecieć BEZ `X-Demo-Mode` → serwer rozstrzyga prawdziwą organizację zamiast
demo, `demoWriteProtection` nie blokuje zapisów. Symetrycznie przy
WYŁĄCZANIU trybu demo: przez ~300 ms nagłówek demo może jeszcze być
wysyłany, co przy złej kolejności warunków po stronie serwera dawałoby
fałszywe 403 realnemu użytkownikowi.

**Rekomendacja naprawcza (najlepszy stosunek zysku do ryzyka):** w `setItem`
(`src/store/useAppStore.ts:92-96`) zapisywać `isDemoMode`/`demoSessionOrgId`
NATYCHMIAST (bez debounce) przy zmianie tych dwóch pól konkretnie, zostawiając
debounce dla reszty stanu (UI, aiConfig, itd. — te nie są bramką
bezpieczeństwa).

**Ten sam wzorzec odłożonego odczytu (localStorage zamiast store) występuje
w 7 dalszych miejscach produktu** — nie są to bramki bezpieczeństwa, ale
warto je znać przy naprawie jądra:
- `src/index.tsx:40`
- `src/contexts/HelpContext.tsx:147`
- `src/contexts/AccessPolicyContext.tsx:123`
- `src/components/Help/FeatureUpdatesPanel.tsx:31`
- `src/hooks/useModuleVideoHelp.ts:8`
- `src/store/useConversationStore.ts:1664`

(To 6 pozycji z opisu źródłowego — siódme miejsce to sam
`src/store/useAppStore.ts:94-95`, źródło debounce'a.)

### 2. [P1] `runtimeApi.ts` łyka nie-JSON jako `null`

`src/services/initiatives-execution/runtimeApi.ts:510-516,1059-1078` — brak
strażnika content-type/kształtu odpowiedzi w warstwie odczytu JSON. Gdy
backend (albo — jak w naprawie H2 tego samego dyżuru — dev-render bez
proxy) odda coś innego niż oczekiwany JSON, wywołanie kończy się anonimowym
`TypeError`, który `src/components/Initiatives/initiativeLoadError.ts:20`
tłumaczy na mylący `INITIATIVE_DATA_CONTRACT_ERROR` — komunikat sugeruje
problem z kontraktem danych, nie z siecią/serwerem.

**Naprawa:** strażnik content-type i kształtu odpowiedzi przed próbą
`JSON.parse`/użyciem wyniku. Ten sam wzorzec (`readJson` bez strażnika)
powtarza się w ~20 wywołaniach w tym samym pliku — naprawa jądra ma sens
zamiast łatania punktowo.

**Powiązanie z H2 tego dyżuru:** naprawa vite proxy w dev-render (honest 404
zamiast 200 text/html) jest bezpiecznikiem STANOWISKA POMIAROWEGO, nie tego
kodu — łata objaw (fałszywy `INITIATIVE_DATA_CONTRACT_ERROR` w harnessie),
nie przyczynę (brak strażnika w `runtimeApi.ts`, który zamieni DOWOLNĄ
nie-JSON odpowiedź w mylący komunikat, także na prawdziwym backendzie przy
awarii/przekierowaniu/proxy).

### 3. [P1] Arkusz: wpisana wartość znika po Enter

Defekt zastany, **potwierdzony mutacyjnie** w poprzedniej sesji (nie tylko
przeczytany w kodzie). Wymaga dyżuru z instrumentacją, żeby ustalić
dokładny mechanizm (re-render czyszczący komórkę? race warunku zapisu?
kolizja z autosave?). **NIE zapalać właścicielowi** przed zmierzeniem
przyczyny — pokazanie mu żywego bug'u bez planu naprawy łamie regułę
„Piotr nigdy nie jest pierwszym testerem" w drugą stronę (pierwszym
świadkiem regresji).

### 4. [P2] `SwotLiveArtifact.tsx` bez wołacza w produkcie

Komponent zbudowany i przetestowany, ale **nigdy nie montowany**
w `ToolWorkspace` — jedenasty kształt fałszywego „gotowe" (biblioteka bez
wywołania). Wykryte w przeglądzie nocnym modułu 04-narzedzia. Wymaga
decyzji: albo dopiąć wołacza w `ToolWorkspace`, albo świadomie przenieść do
`ODLOZONE.md` jeśli SWOT ma inną docelową powierzchnię.

### 5. [P2] Żargon inżynierski w treści raportu z oceny

Sekcja „Ograniczenia i założenia" generowanego raportu cytuje nazwy
wewnętrzne zamiast tłumaczyć je na język biznesowy:
`EventDerivedOutputBridge`, `vertical-slice demo`,
`businessMeaning/recommendation`, `aggregation.byGroup`.

Źródło: `src/method-core/methods/drd/drdSessionRuntime.ts:507,613,621-623`.
Wykryte w przeglądzie nocnym 03/05. To treść trafiająca bezpośrednio do
klienta — priorytet P2 mimo że „tylko tekst", bo psuje wiarygodność
dokumentu przed odbiorcą zewnętrznym.

### 6. [P2] Jądro `FilterableTable` — podłoga 112px w `columnFit`

Mechanizm dopasowania szerokości kolumn ma twardą podłogę 112px, która przy
przepełnieniu ściska WSZYSTKIE kolumny jednakowo (zamiast np. przycinać
najmniej istotne albo włączać przewijanie). Naprawy jak dotąd robione
per-konsument (`OutputsAggregateTabContent`, `ExecutionSummaryOneLook`), nie
w jądrze — bo **228 importerów** i poprzednia zmiana jądra dała regresję
rozrywania wyrazów w produkcji. Zmiana jądra = osobny, nadzorowany dyżur
z pełnym przeglądem importerów, nie punktowa łatka.

**Powiązane, ten sam mechanizm:** tabela „TOP ryzyka" w
`src/components/Execution/ExecutionSummaryOneLook.tsx` ma kolumny
niewidoczne bez przewijania przy wymuszonych 980px szerokości.

### 7. [P2] System bramki zapisu dla metod licencjonowanych (SIRI)

Wymaganie właścicielskie zapisane w `docs/program/grafika/KANON_Z_ODBIOROW.md`
(wpis 31.08): potrzebna bramka klient → Consultify na zapisie efektów metod
objętych licencją zewnętrzną. Kluczowe: dług Consultify wobec
licencjodawcy **NIGDY** nie może zatrzymać klienta (nie jest to jego wina
ani problem, którym ma się przejmować w danej chwili pracy).

Zakres toru grafiki w tej sprawie jest wąski i celowo ograniczony: tor
grafiki odpowiada WYŁĄCZNIE za to, żeby komunikat pokazywany użytkownikowi
przy tej bramce był uczciwy (nie za mechanikę samej bramki, nie za
rozliczenia z licencjodawcą — to należy do toru funkcji/biznesu).

### 8. [P3] Excel: „Zadanie ukończone / 0-z-8" po ponownym otwarciu

Zastany defekt na ekranie „excele-edytowalna-siatka" — po ponownym otwarciu
arkusza licznik zadań resetuje się do „0-z-8" mimo że zadanie było
oznaczone jako ukończone. Zgłoszony wcześniej torowi funkcji; ta pozycja
tylko konsoliduje odnośnik w jednym rejestrze zamiast rozpraszać go po
dziennikach sesji.
