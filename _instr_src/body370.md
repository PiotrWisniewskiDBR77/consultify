## Po co ten dyżur istnieje

Audyt ekranu „Czat AI” z 2026-09-05 (`docs/program/AUDYT_CZAT_PRZYCISKI_20260905/00_ZESTAWIENIE.md`)
znalazł 449 klikalnych elementów. Dwa z nich okłamują użytkownika co do tego, JAKI rekord
powstaje po kliknięciu — i oba sceptyk potwierdził do końca łańcucha, aż do bazy danych.

**Defekt K4 — „Konwertuj na inicjatywę” nie tworzy inicjatywy.** Przycisk z etykietą
`deepThinking.convertInitiative` pod wynikiem Deep Thinking woła **dokładnie ten sam handler**
co przycisk „Zapisz jako decyzję”:

```text
src/components/AIChat/MessageRenderer.tsx:2412 i :2422
  onClick={() => handleSaveAsDecision(msg.id, userVisibleContent)}   ← IDENTYCZNE, oba przyciski
```

Serwer (`server/src/routes/ai/deep-thinking.routes.ts:57-142`, endpoint `POST /save-decision`)
odbiera pole `type` z body (linia 69), ale używa go **wyłącznie jako tag w kolumnie JSON**
(`tags`, linia 124) — jedyny zapis to `INSERT INTO ai_decision_outcomes`. Tabela `initiatives`
nie jest tam w ogóle dotykana, niezależnie od tego, co front wyśle. **Cała funkcja „Konwertuj na
inicjatywę” jest fasadą od przycisku aż po tabelę bazy danych** (cytat z `V1_weryfikacja_P1.md`
pkt 5, werdykt POTWIERDZONY).

**Defekt K8 — „Zapisz jako pomysł” nie zapisuje niczego z poziomu czatu.** Domyślna ścieżka
(`navigateToMyWork:true`, jedyna używana przez przycisk realnie klikany w
`MessageRenderer.tsx:2196`) **nie wywołuje** `Api.createIdeaFromChat`; ustawia tylko
`useAppStore.setMyWorkIntent({...isNew:true, id:'new-idea-${Date.now()}'...})` i przełącza widok
na My Work:

```text
src/components/AIChat/UnifiedChatPanel.tsx:1462-1565 (saveMessageAsIdea)
  if (navigateToMyWork) { ...; return; }         ← wraca TUTAJ, PRZED linią 1540
  const created = await Api.createIdeaFromChat({...});   ← linia 1540, nigdy nieosiągana z czatu
```

Realne utworzenie rekordu zależy od tego, czy użytkownik w ogóle domontuje
`IdeaMapWorkspace` i czy jej `hydrate()` zdąży wywołać `Api.createMyIdea` — zależność od ekranu
docelowego, nie zapis (werdykt sceptyka w `V2_weryfikacja_P1_i_probka.md` pkt 1: „zły wzorzec, nie
brak zapisu”, P2 po weryfikacji — **ale wciąż realny defekt: klik w czacie sam z siebie niczego
nie zapisuje**).

**Oba defekty mają tanią naprawę, bo poprawny wzorzec już istnieje w tym samym pliku.**
`saveMessageAsNote` (`UnifiedChatPanel.tsx:1567-1631`) zapisuje **synchronicznie, przed**
jakąkolwiek nawigacją — to jest wzorzec do skopiowania dla K8. Dla K4 — inicjatywy mają dziś
jeden kanoniczny lejek tworzenia (`server/src/services/initiative/createInitiativeService.ts`),
który już jest wołany z analogicznego kontekstu „AI tworzy inicjatywę” przez
`server/src/services/aiActionExecutor.ts:1266-1317` (`_executeCreateInitiative`).

## ★ Stan zastany, zmierzony przeze mnie na markerze `9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c`

| Co | Wartość zmierzona | Gdzie |
| --- | --- | --- |
| przyciski K4 z identycznym `onClick` | **2** (`:2412`, `:2422`) | `MessageRenderer.tsx` |
| co robi serwer z polem `type` | **tag w JSON, zero rozgałęzienia** | `deep-thinking.routes.ts:69,124` |
| ścieżka pliku serwera | **`server/src/routes/ai/deep-thinking.routes.ts`** | brief źródłowy cytował bez `/ai/` — NIEAKTUALNE |
| testy broniące rozróżnienia K4 | **0** | 6 plików wspominają handler, żaden nie rozróżnia typu |
| galąź `saveMessageAsIdea` z czatu | **`return` przed `Api.createIdeaFromChat`** | `UnifiedChatPanel.tsx:1485-1538` |
| wzorzec poprawny (K8, notatka) | zapis **przed** nawigacją | `UnifiedChatPanel.tsx:1590` |
| wzorzec poprawny (K8, realne id) | `isRealIdeaId`, komentarz kontraktu | `UnifiedChatPanel.tsx:2226-2266` |
| strażnik przed duplikatem `IdeaMapWorkspace` | `ideaId.startsWith('new-idea-')`, linia **353** | `IdeaMapWorkspace.tsx` |
| kanoniczny lejek inicjatyw | istnieje, wywoływany analogicznie | `createInitiativeService.ts` + `aiActionExecutor.ts:1273` |
| miejsca omijające dziś ten lejek | **20 plików produkcyjnych** (kontekst, nie Twoje zadanie) | `grep INSERT INTO initiatives` |
| trasa `/my-work/my-ideas/from-chat` | już generuje realne `ideaId` + ślad audytu | `my-work.routes.ts:6889-6942`, TYLKO ODCZYT |
| akcje `chatActionRegistry` tworzące rekord wprost | **0 z 14** | `chatActions.ts` — odsyła do INNEGO mechanizmu |
| liście słowników | **pl 35204 / en 33071** | `public/locales/**` |
| bezpieczniki kanonu | `focus=0 list=0 artefakt=0` | trzy z czterech — **czwarty patrz niżej** |
| `reachability --check-baseline` | **`reach=1`** (NIE 0!) | 3 pliki test-only już zacommitowane na markerze, baseline ich nie ma |

**★★ Kontekst dla dyżurów 367-369, 371-373 — NIE POWTARZASZ, NIE DOTYKASZ:** to jest osobna
paczka równoległa 05.09, każdy dyżur ma własny obszar, własne porty i własną gałąź — patrz
`§0.2` `Z7` i lista portów.

## ★ Zmierz moje liczby sam

Twierdzę, na markerze: **2** identyczne `onClick` dla K4; **0** testów broniących rozróżnienia
decyzja/inicjatywa; galąź `navigateToMyWork` w `saveMessageAsIdea` kończy się `return` **przed**
jedynym wywołaniem `Api.createIdeaFromChat`; strażnik przed duplikatem w `IdeaMapWorkspace` to
**jedno** porównanie stringów (`ideaId.startsWith('new-idea-')`, linia **353**); kanoniczny lejek
inicjatyw **istnieje** i jest już wołany analogicznie z `aiActionExecutor.ts:1273`; **20** plików
produkcyjnych dziś omija ten lejek (kontekst); trasa `from-chat` już generuje realne id i ślad
audytu (TYLKO ODCZYT); **0 z 14** akcji `chatActionRegistry` tworzy rekord wprost; liście
słowników **pl 35204**, **en 33071**; trzy bezpieczniki kanonu kończą się kodem **0**, czwarty
(`reachability --check-baseline`) kończy się kodem **1** z powodu 3 już-zacommitowanych plików
test-only spoza baseline (stan zastany, nie Twój defekt).

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.**

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: PRZYCISK · HANDLER FRONTU · TRASA · SERWIS · REPOZYTORIUM · TESTY · SŁOWNIKI

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany
brief z `plik:linia` oraz diff **nienałożony**. Pozycja z takim produktem jest
**ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Przycisk K4 (front)** | `src/components/AIChat/MessageRenderer.tsx:319` (typ propa), `:2412`, `:2422` (dwa `onClick`) | **★ WĄSKA LICENCJA:** dodać parametr rozróżniający typ do drugiego przycisku i do sygnatury propa. **Zakaz zmiany etykiet, ikon i reszty komponentu** | Brief z `plik:linia` |
| **Handler K4 (front)** | `src/components/AIChat/UnifiedChatPanel.tsx:5627-5645` (`handleSaveAsDecision`), `:6418` (montaż propa) | **★ WĄSKA LICENCJA:** rozszerzyć sygnaturę o opcjonalny `type` i przekazać go do `Api.saveDeepThinkingDecision`. **Zakaz zmiany zachowania dla `type` nieobecnego/`'decision'`** | Brief |
| **Handler K8 (front, RDZEŃ)** | `src/components/AIChat/UnifiedChatPanel.tsx:1462-1565` (`saveMessageAsIdea`) | **★ PEŁNA LICENCJA w zakresie `R2`:** zapis synchroniczny przed nawigacją, przekazanie realnego `ideaId`. **Zakaz zmiany sygnatury funkcji widocznej dla wywołujących** (`handleSaveAsIdea` wywołuje ją z tymi samymi argumentami) | — |
| **Wzorce referencyjne K8 (front)** | `UnifiedChatPanel.tsx:1567-1631` (`saveMessageAsNote`), `:2150-2266` (drugi wołacz `setMyWorkIntent`) | **TYLKO ODCZYT — kopiujesz KSZTAŁT, nie plik.** Zmiana tu jest naruszeniem rozłączności | Opis w raporcie |
| **Klient API (front)** | `src/services/api.ts:2212-2229` (`saveDeepThinkingDecision`), `:5757-5779` (`createIdeaFromChat`) | **TYLKO ODCZYT — prawdopodobnie ZERO zmian**, obie funkcje już mają potrzebne pola w sygnaturze TS. Jeżeli `R1`/`R2` udowodni brakujące pole — wąska licencja na jego dodanie, opisana w raporcie | Brief z dowodem, czego brakuje |
| **Guard przeciw duplikatowi (front)** | `src/components/MyWork/IdeaMapWorkspace.tsx:353` (`isNewInitial`), `:1632-1721` (`hydrate()`) | **TYLKO ODCZYT, chyba że `R2` udowodni realną lukę** — wtedy wąska licencja na minimalną poprawkę guardu, z dowodem mutacyjnym pokazującym dziurę PRZED zmianą | Brief z dowodem |
| **Typy pomocnicze idei (front)** | `src/components/MyWork/ideaEntryTypes.ts`, `src/components/MyWork/ideaWorkspaceState.ts` | **TYLKO ODCZYT** | Opis w raporcie, czy wymagają dotknięcia |
| **Rejestr akcji czatu (front, inwentarz `R3`)** | `src/services/chatActionRegistry.ts`, `src/services/chatActionHandler.ts`, `src/types/domain/chatActions.ts` | **TYLKO ODCZYT** — produktem `R3` jest tabela w raporcie, nie zmiana kodu | Tabela w raporcie |
| **Trasa serwerowa K4 (RDZEŃ)** | `server/src/routes/ai/deep-thinking.routes.ts:57-142` (`POST /save-decision`) | **★ WĄSKA LICENCJA:** rozgałęzienie po `saveType`; gałąź `'initiative'` woła kanoniczny lejek; gałąź inna (domyślnie `'decision'`) zostaje **bit-do-bitu identyczna**. **Zakaz zmiany URL, metody, middleware `verifyToken`** | — |
| **Kanoniczny lejek inicjatyw** | `server/src/services/initiative/createInitiativeService.ts` | **TYLKO ODCZYT — WOŁASZ, NIE ZMIENIASZ.** Funkcja `createInitiative(orgId, input, options)` już robi wszystko (walidacja, zakotwiczenie projektu, ślad audytu). Jeżeli okaże się niewystarczająca — brief z `plik:linia` i pytanie do właściciela, **nie modyfikujesz jej** | Brief |
| **Wzorzec wołania (referencja)** | `server/src/services/aiActionExecutor.ts:1266-1317` (`_executeCreateInitiative`) | **TYLKO ODCZYT — cudzy, szerszy mechanizm `CREATE_DRAFT_*`.** Kopiujesz KSZTAŁT wywołania lejka, nie dotykasz pliku i nie wołasz z niego niczego innego | Opis w raporcie |
| **Trasa serwerowa K8** | `server/src/routes/my-work.routes.ts:6889-6978` (`POST /my-ideas/from-chat`) | **TYLKO ODCZYT — już generuje realne `ideaId` i ślad audytu.** Twoim dowodem jest pokazanie, że nic tu nie trzeba zmieniać | Brief potwierdzający brak potrzeby zmiany |
| **Pozostałe middleware / bramy platformowe** | `server/src/middleware/**` (w tym `auth.middleware.ts`), `server/src/services/ApiGateway.ts`, `server/src/Gateway.ts` | **NIETYKALNE DO ZAPISU** (`Z12`) | Brief |
| **Nowe testy** | `tests/**` (nowe pliki, `git add -f`) | **★ PEŁNA LICENCJA.** Kładziesz WYŁĄCZNIE w `tests/`, nigdy pod `src/`/`server/src/` | — |
| **Testy istniejące dotykające handlerów K4** | `tests/components/AIChat/UnifiedChatPanel.test.tsx`, `tests/components/AIChat/MessageRenderer.context-save.test.tsx`, `MessageRenderer.direction.test.tsx`, `MessageRenderer.policy.test.tsx`, `MessageRenderer.messageActions.test.tsx`, `tests/components/MyWork/UnifiedNodeDetailDrawer.test.tsx` | **★ WĄSKA LICENCJA:** wolno zaktualizować mocki/wywołania, które Twoja zmiana sygnatury wywraca. **Zakaz osłabienia istniejących asercji** | — |
| **Produkt UI poza wskazanym zakresem** | `src/**` | **TYLKO ODCZYT** | Opis w raporcie |
| **Bezpieczniki i konfiguracja testów** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie |
| **Słowniki** | `public/locales/**` | **NIETYKALNE DO ZAPISU, chyba że `R1`/`R2` wymaga nowego klucza i18n** — wtedy wyłącznie dopisywanie, parytet PL+EN, liście nie mogą zmaleć | Opis w raporcie |
| **Dowody audytu 05.09** | `docs/program/AUDYT_CZAT_PRZYCISKI_20260905/**` | **TYLKO ODCZYT** | — |
| **Nowe dowody** | `evidence/akcje-wiadomosci-20260905/**` (**NIE ISTNIEJE — tworzysz**) | **★ PEŁNA LICENCJA**; commitujesz przez `git add -f` | — |
| **Macierz odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` | **NIETYKALNE DO ZAPISU — żaden wiersz, żaden moduł** | Rekomendacja w raporcie |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA** — jedna nowa sekcja o **pierwszej wolnej literze**, sprawdzonej komendą tuż przed commitem | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY370_AKCJE_WIADOMOSCI_REPORT.md` (**NOWY**) | `R4` — **JEDYNY nowy dokument rejestrowy** (`Z13`) | — |
| **Cudze tereny (paczka 367-373)** | pozostałe obszary dyżurów 367, 368, 369, 371, 372, 373 (porty i pliki rozłączne, patrz `§0.2` `Z7`) | **TYLKO ODCZYT** | Opis w raporcie |
| **Reszta defektów `00_ZESTAWIENIE.md`** | K1, K2, K3, K5, K6, K7, K9, wszystkie rodziny P2 | **TYLKO ODCZYT — poza zakresem tego dyżuru** | Wpis w `R3`/raporcie: `plik:linia`, opis, rekomendacja |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis potrzeby z dowodem `plik:linia` i idziesz dalej |

## ★★ WARUNKI WSPÓLNE SERII

Mierzysz **PRZED pierwszym commitem i PO ostatnim**, obie pary liczb do raportu:

```bash
cd "$WT"
# (a) liscie slownikow NIE MOGA ZMALEC
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
#   moje liczby: pl 35204, en 33071

# (b) cztery bezpieczniki - TRZY maja konczyc sie kodem 0, CZWARTY ma stan zastany 1
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus-canon=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list-canon=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo "reach=$?"
#   moje liczby: focus=0, list=0, artefakt=0
#   ★★ reach=1 na MARKERZE, PRZED Twoja praca — 3 pliki test-only juz zacommitowane
#   (dyzury wczesniejsze), baseline nie zaktualizowany. NIE naprawiasz tego (poza licencja,
#   --update-baseline nie jest Twoim narzedziem). Warunek: PO Twoich zmianach `reach` ma
#   nadal zglaszac DOKLADNIE te same 3 nazwy, zero nowych dodatkow. Jezeli Twoje nowe pliki
#   testowe (R1/R2) trafia w klasyfikacje "test-only" i podbija reach o wiecej niz te 3 -
#   to jest STOP MERYTORYCZNY do opisania, nie cichy update baseline.
```

**Jeżeli którakolwiek liczba zmaleje albo bramka zaczerwieni się od Twojej zmiany —
naprawiasz KODEM, nigdy progiem i nigdy `--no-verify`** (`Z35`).

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | przyciski K4 z identycznym `onClick` | `2` | komenda (1) z `§0.3` | TAK — czyta plik komponentu |
| 2 | co serwer robi z `type` | tag JSON, zero rozgałęzienia | komenda (2) | TAK — czyta trasę |
| 3 | testy broniące K4 dziś | `0` | komenda (3) | TAK |
| 4 | linia `return` przed zapisem K8 | `1485-1538` | komenda (4) | TAK |
| 5 | wzorzec poprawny K8 (notatka) | linia `1590` | komenda (5) | TAK |
| 6 | wzorzec poprawny K8 (realne id) | linie `2226-2266` | komenda (6) | TAK |
| 7 | linia strażnika duplikatu | `353` | komenda (7) | TAK |
| 8 | kanoniczny lejek — istnieje i wołany analogicznie | tak, `aiActionExecutor.ts:1273` | komenda (8) | TAK |
| 9 | pliki omijające lejek dziś | `20` | komenda (9) | TAK — kontekst, nie zadanie |
| 10 | trasa `from-chat` — realne id + ślad | tak, linia `6913`, `6926-6936` | komenda (10) | TAK |
| 11 | akcje `chatActionRegistry` tworzące rekord | `0 z 14` | komenda (11) | TAK |
| 12 | liście słowników PL/EN | `35204` / `33071` | blok (a) „WARUNKÓW WSPÓLNYCH” | TAK |
| 13 | `reach --check-baseline` na markerze | `1` (3 pliki test-only) | blok (b) | TAK — stan zastany, nie Twój defekt |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:**
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY370_AKCJE_WIADOMOSCI_REPORT.md` ·
`evidence/akcje-wiadomosci-20260905/**` (nowe) ·
`src/components/AIChat/MessageRenderer.tsx` (drugi `onClick` + typ propa) ·
`src/components/AIChat/UnifiedChatPanel.tsx` (`handleSaveAsDecision`, `saveMessageAsIdea`) ·
`server/src/routes/ai/deep-thinking.routes.ts` (rozgałęzienie `saveType`).

**Zapisujesz WARUNKOWO:**
`src/services/api.ts` (wyłącznie jeśli `R1`/`R2` udowodni brakujące pole w sygnaturze) ·
`src/components/MyWork/IdeaMapWorkspace.tsx` (wyłącznie z dowodem realnej luki w `R2`) ·
istniejące pliki testowe wypisane w tabeli licencji (mocki po zmianie sygnatury) ·
nowe pliki testowe w `tests/` (`git add -f`) ·
`public/locales/**` (wyłącznie dopisywanie, jeśli potrzebny nowy klucz) ·
`docs/program/REJESTR_ZNALEZISK_20260903.md` (jedna nowa sekcja).

**JAWNIE NIE ZAPISZESZ:** `public/locales/**` (bez dowodu potrzeby) ·
`server/src/services/initiative/createInitiativeService.ts` ·
`server/src/services/aiActionExecutor.ts` ·
`server/src/routes/my-work.routes.ts` ·
`src/components/AIChat/UnifiedChatPanel.tsx` funkcje `saveMessageAsNote` (`:1567-1631`) i drugi
wołacz `setMyWorkIntent` (`:2150-2266`) — TYLKO ODCZYT, wzorce referencyjne ·
`server/src/middleware/**`, `server/src/services/ApiGateway.ts`, `server/src/Gateway.ts` ·
`tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`,
`server/vitest.config*.ts`, `.github/workflows/**`, `server/migrations/**` ·
`docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` (**wszystkie 16**) ·
`docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json` ·
`src/services/chatActionRegistry.ts`, `src/services/chatActionHandler.ts` (inwentarz `R3` jest
tylko do odczytu, produktem jest tabela w raporcie).

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day370-akcje-wiadomosci
git diff --name-only --cached | tee /private/tmp/cx-day370-akcje-wiadomosci-artefakty/staged.txt
bash -c "grep -iE '^public/locales/|createInitiativeService|aiActionExecutor|my-work\.routes|^server/src/middleware/|ApiGateway|^server/src/Gateway|saveMessageAsNote|^tests/setup|^tests/helpers|^tests/__mocks__|vitest.*config|^\.github/|^server/migrations/|MODULE_ACCEPTANCE|reachability\.baseline|chatActionRegistry|chatActionHandler' /private/tmp/cx-day370-akcje-wiadomosci-artefakty/staged.txt" \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

## R0 — PIĘĆ TWARDYCH ZASAD TEGO DYŻURU (przeczytaj, zanim cokolwiek zrobisz)

**(1) Asercja na ZACHOWANIU, nigdy na tekście źródła.** Nowy test wywołuje handler albo
renderuje komponent i sprawdza WYNIK: który wiersz w której tabeli powstał, jaki `ideaId` doszedł
do nawigacji, co zwrócił endpoint. `readFileSync` + `toContain` nie jest dowodem.

**(2) Zakaz nowej tabeli dla inicjatyw.** `initiatives` ma dziś kanoniczny lejek tworzenia
(`createInitiativeService.ts`). Gałąź `saveType==='initiative'` MUSI przez niego przejść.

**(3) Kolejność ma znaczenie dla K8.** Dowód nie może pokazywać tylko „rekord w końcu powstał” —
musi pokazywać, że `Api.createIdeaFromChat` wykonało się **przed** `setMyWorkIntent`/nawigacją.
Sam efekt końcowy bez dowodu kolejności jest niewystarczający.

**(4) Zakaz duplikatu.** Po naprawie K8, otwarcie utworzonego pomysłu w `IdeaMapWorkspace` NIE
MOŻE wywołać drugiego zapisu. Dowód mutacyjny: cofnij naprawę (przywróć prefiks `new-idea-`) —
test ma pokazać DWA wiersze `my_ideas` dla jednego kliknięcia; napraw z powrotem — ma zostać
JEDEN.

**(5) Zakaz zmiany zachowania gałęzi „decyzja”.** „Zapisz jako decyzję” musi zostać
bit-do-bitu takie samo po naprawie K4 — te same pola w `INSERT INTO ai_decision_outcomes`, ten
sam kod odpowiedzi, ten sam kształt `tags`.

**Wymagany dowód:** pięć zdań w raporcie, że przeczytałeś te zasady, plus `git show --stat`
każdego commita. **Bez commita — to jest warunek, nie pozycja.**

## R1 — K4: ROZGAŁĘZIENIE „DECYZJA” / „INICJATYWA” (rdzeń)

1. **Pokaż defekt na dziś, dosłownie.** Wykonaj DWA realne żądania HTTP
   `POST /api/ai/deep-thinking/save-decision` przez realny `ApiGateway`, z podpisanym JWT — jedno
   z `{ type: 'decision', ... }`, jedno z `{ type: 'initiative', ... }` — i policz wiersze w
   `ai_decision_outcomes` oraz `initiatives` PRZED i PO każdym. **Oczekiwany wynik na dziś:** oba
   żądania wstawiają wiersz WYŁĄCZNIE do `ai_decision_outcomes`, zero wierszy w `initiatives`
   niezależnie od `type`. To jest Twój dowód wyjściowy.
2. **Rozgałęzienie w `server/src/routes/ai/deep-thinking.routes.ts`.** Gałąź `saveType ===
   'initiative'` (po normalizacji, uwzględnij wielkość liter i puste wartości) woła
   `createInitiative(orgId, input, options)` z `server/src/services/initiative/
   createInitiativeService.ts`, z tytułem wyprowadzonym z tej samej logiki `extractSection`, co
   dziś buduje `executiveSummary`/`recommendation` dla decyzji, oraz z audytowym `sourceType`
   (np. `'ai_chat_deep_thinking'`) i `sourceId` (`conversationId` albo `sessionId` — uzasadnij
   wybór) tak, żeby ślad prowadził z powrotem do wiadomości źródłowej (decyzja właściciela
   02.09: **Inicjatywy = ślad audytu, wariant B**). Gałąź inna (domyślnie `'decision'`) zostaje
   **bez zmian**.
3. **Front.** Rozszerz sygnaturę `handleSaveAsDecision` (`UnifiedChatPanel.tsx:5627-5645`) o
   opcjonalny trzeci parametr typu (`'decision' | 'initiative'`, domyślnie `'decision'`),
   przekaż go do `Api.saveDeepThinkingDecision`. W `MessageRenderer.tsx` przycisk „Convert to
   Initiative” (`:2422`) woła `handleSaveAsDecision(msg.id, userVisibleContent, 'initiative')`,
   przycisk „Save as Decision” (`:2412`) zostaje bez zmian (albo jawnie `'decision'` —
   równoważne). Zaktualizuj typ propa w interfejsie `MessageRendererProps` (`:319`).
4. **KROK 0 dla rodziny.** Zanim uznasz `R1` za zamknięte, zmierz komendą (9) z `§0.3`, ile
   plików produkcyjnych dziś omija kanoniczny lejek (`grep INSERT INTO initiatives`) i napisz w
   raporcie, czy Twoja nowa gałąź jest jedynym NOWYM konsumentem, czy dołącza do istniejącej
   listy — to jest kontekst do pytania dla właściciela, nie zadanie do naprawy w tym dyżurze.
5. **Powtórz dowód z punktu 1 PO naprawie.** Te same dwa żądania, te same JWT, ten sam org.
   Oczekiwany wynik: `type:'decision'` → wiersz WYŁĄCZNIE w `ai_decision_outcomes`, ZERO nowych w
   `initiatives`; `type:'initiative'` → wiersz WYŁĄCZNIE w `initiatives` (z `organization_id`
   wołającego, `source_type`/`source_id` wypełnione), ZERO nowych w `ai_decision_outcomes`.
6. **Izolacja organizacji.** Zapytaj `GET` listy inicjatyw jako użytkownik INNEJ organizacji —
   utworzona inicjatywa nie może się tam pojawić.
7. **Dowód mutacyjny.** Cofnij rozgałęzienie (`cp` ze `SCRATCH`) — powtórzone żądanie
   `type:'initiative'` ma z powrotem wstawić wiersz do `ai_decision_outcomes` (czerwony test);
   przywróć naprawę — ma wrócić do zielonego. `git diff` po cofnięciu **pusty**.
8. **Nie osłabiasz istniejących testów.** Zaktualizuj mocki w plikach z tabeli licencji, jeżeli
   zmiana sygnatury `handleSaveAsDecision` je wywala — bez usuwania asercji.

**Wymagany dowód:** dwa żądania PRZED (liczniki obu tabel) · diff rozgałęzienia serwera i
sygnatury frontu · dwa żądania PO (liczniki obu tabel, izolacja org) · mutacja w obie strony ·
lista testów istniejących zaktualizowanych, z diffem. **Commit po `R1`.**

## R2 — K8: ZAPIS SYNCHRONICZNY PRZED NAWIGACJĄ (rdzeń)

1. **Pokaż defekt na dziś, dosłownie.** Wyrenderuj/wywołaj `saveMessageAsIdea` z
   `navigateToMyWork: true` (domyślna ścieżka realnego kliknięcia) z zamockowanym
   `Api.createIdeaFromChat` — dowód: mock **nie został wywołany ani razu**, mimo że
   `setMyWorkIntent` i nawigacja się wykonały.
2. **Napraw `saveMessageAsIdea` (`UnifiedChatPanel.tsx:1462-1565`).** Zamiast wczesnego
   `return` w gałęzi `navigateToMyWork`, wywołaj `Api.createIdeaFromChat({...})` (te same
   argumenty, co dziś w gałęzi `navigateToMyWork:false`, `:1540-1547`) **PRZED**
   `setMyWorkIntent`/nawigacją, i użyj `created.ideaId` zamiast `` `new-idea-${Date.now()}` ``
   jako `id` w intencji. Zachowaj `creationPayload`/`seedIntent` tak, żeby
   `IdeaMapWorkspace.hydrate()` miał czym zasilić mapę początkową (sprawdź, czy realne `ideaId` z
   `from-chat` wymaga innej gałęzi hydratacji niż dziś zakładana — patrz punkt 4).
3. **Dowód kolejności.** Test musi jawnie sprawdzić, że `Api.createIdeaFromChat` zostało
   wywołane PRZED `setMyWorkIntent`/`setCurrentView` (kolejność wywołań mocków w asercji), nie
   tylko że oba się wykonały.
4. **KROK 0 — rodzina wejść do `IdeaMapWorkspace` z intencją.** Sprawdź WSZYSTKIE miejsca, które
   ustawiają `myWorkIntent.open.type==='idea'` z `data.isNew` z poziomu czatu — dziś są dokładnie
   dwa w `UnifiedChatPanel.tsx` (`:1462-1565`, ten naprawiany, i `:2150-2266`, już poprawny wzorzec
   z realnym `ideaId`). Upewnij się, że Twoja naprawa produkuje `ideaId` w kształcie, który
   `IdeaMapWorkspace.tsx:353` (`isNewInitial = ideaId.startsWith('new-idea-')`) rozpozna jako
   NIE-nowy (czyli NIE zaczyna się od `new-idea-` — realne id z `from-chat` ma postać
   `idea-<timestamp>-<losowe>`, sprawdź to explicite w teście, nie zakładaj).
5. **Dowód braku duplikatu.** Zamontuj `IdeaMapWorkspace` z `ideaId` zwróconym przez naprawę —
   `hydrate()` ma pójść gałęzią `Api.getMyIdea` (istniejący rekord), **NIE** gałęzią
   `Api.createMyIdea`. Policz wywołania `Api.createMyIdea` — mają wynosić `0`.
6. **Dowód mutacyjny.** Cofnij naprawę (`cp` ze `SCRATCH`, przywracając wczesny `return`) —
   test z punktu 1 ma z powrotem zaczerwienić się (mock niewywołany); przywróć naprawę — ma
   zzielenieć. Osobno: podmień realne `ideaId` z powrotem na prefiks `new-idea-` — test z punktu
   5 ma pokazać wywołanie `Api.createMyIdea` (duplikat); przywróć — ma wrócić do `0`. `git diff`
   po każdym cofnięciu **pusty**.
7. **Dowód na realnym PostgreSQL.** Osobny test integracyjny: klik → policz wiersze `my_ideas`
   dla danego `sourceConversationId`/`sourceMessageId` PRZED i PO — ma przybyć dokładnie jeden;
   odśwież/zamontuj workspace ponownie z tym samym `ideaId` — licznik ma zostać ten sam (zero
   duplikatu po powtórnym wejściu).
8. **Toast i UX.** Sprawdź, czy istniejący toast (`myWork.ideas.sentToWorkspaceToast`,
   „Opened in Ideas workspace”) jest nadal uczciwy po naprawie (teraz rekord JUŻ istnieje w
   momencie jego wyświetlenia) — jeśli tekst sugerował wcześniej co innego, zanotuj to jako
   drobną poprawkę tekstu w raporcie (nie zmieniaj klucza i18n bez potrzeby).

**Wymagany dowód:** test „mock niewywołany” PRZED naprawą · diff naprawy `saveMessageAsIdea` ·
test kolejności wywołań · test „brak duplikatu” przy domontowaniu `IdeaMapWorkspace` · mutacja w
obie strony (dwa niezależne cofnięcia) · dowód na realnym PostgreSQL (licznik `my_ideas` przed/po
+ powtórne wejście). **Commit po `R2`.**

## R3 — KROK 0 RODZINA: INWENTARZ WSZYSTKICH AKCJI CZATU TWORZĄCYCH REKORD (nie-rdzeń)

**Nie naprawiasz nic w tej pozycji poza K4 i K8 — wyłącznie inwentaryzujesz i raportujesz.**

1. Wypisz WSZYSTKIE miejsca w `src/components/AIChat/**` i `src/services/chatAction*.ts`, które
   obiecują (etykietą, komentarzem albo nazwą funkcji) utworzenie: zadania, decyzji, inicjatywy,
   pomysłu, notatki lub materiału. Punkt startowy: `saveMessageAsIdea` (K8, naprawiony w `R2`),
   `saveMessageAsNote` (`:1567-1631`), `handleSaveAsDecision` (K4, naprawiony w `R1`), oraz — jeśli
   istnieją — analogiczne handlery dla zadania i materiału (sprawdź `grep -n "handleSaveAs\|
   saveMessageAs"` w całym `UnifiedChatPanel.tsx`, nie tylko miejsca już wymienione w tej
   instrukcji).
2. Osobno zbadaj `chatActionRegistry.ts`/`chatActionHandler.ts`/`chatActions.ts` — moje
   pomiar (komenda 11 z `§0.3`) pokazuje **14 typów akcji, zero z nich tworzy rekord wprost**;
   `ASSIGN_INTERVIEW` jest najbliższy (tworzy przypisanie wywiadu synchronicznie, przed
   jakąkolwiek nawigacją — dobry wzorzec, zanotuj go jako TAKI w tabeli). Komentarz w
   `chatActions.ts:11-12` odsyła do `server/src/services/aiActionExecutor.ts:911-920`
   (`CREATE_DRAFT_TASK`/`CREATE_DRAFT_INITIATIVE`/`CREATE_DRAFT_DECISION`) — to jest INNY,
   znacznie szerszy mechanizm z własnym cyklem propozycja→akceptacja→wykonanie (`ai_actions`),
   nie wołany bezpośrednio z przycisków w `MessageRenderer`. Opisz w raporcie, jak te dwa
   mechanizmy (bezpośrednie `handleSaveAs*` kontra `ai_actions`/`aiActionExecutor`) się mają do
   siebie — czy to zamierzona dwutorowość, czy dług.
3. **Tabela obowiązkowa w raporcie**, jeden wiersz na każde znalezione miejsce: nazwa
   akcji/handlera · plik:linia · endpoint HTTP (jeśli jest) · tabela docelowa w bazie · zapis
   PRZED czy PO nawigacji (albo „brak zapisu” jeśli defekt jak K8 przed naprawą) · czy naprawiony
   w tym dyżurze (TAK dla K4/K8, NIE dla reszty) · rekomendacja jednym zdaniem dla pozycji NIE.
4. Dołącz do tej samej tabeli — jednym zdaniem, z `plik:linia` — pozostałe defekty z
   `00_ZESTAWIENIE.md`, które NIE są K4/K8 (K1, K2, K3, K5, K6, K7, K9 i rodziny P2 istotne dla
   akcji na wiadomościach), bez naprawiania ich.

**Wymagany dowód:** tabela inwentarza (min. 6 wierszy: idea, notatka, decyzja, inicjatywa,
`ASSIGN_INTERVIEW`, jedno miejsce z `aiActionExecutor.ts` CREATE_DRAFT_*) · komenda i wynik grepu
użytego do jej zbudowania · akapit o relacji `handleSaveAs*` kontra `ai_actions`. **Commit po
`R3`.**

## R4 — RAPORT I PYTANIA DO WŁAŚCICIELA

Raport zawiera: dowód defektu K4 na dziś i dowód naprawy (dwa żądania PRZED/PO, izolacja org,
mutacja w obie strony) · dowód defektu K8 na dziś i dowód naprawy (kolejność wywołań, brak
duplikatu, dowód na realnym Postgresie, mutacja w obie strony) · tabelę inwentarza z `R3` ·
listę rozbieżności wobec liczb tej instrukcji (w tym `reach=1` na markerze i ścieżka
`server/src/routes/ai/deep-thinking.routes.ts` różna od brifu źródłowego) · **niepustą sekcję
„TWIERDZENIA NIEZWERYFIKOWANE”** · obowiązkowy akapit `§0.2e` dla każdego uruchomionego pakietu.

★★ **Osobna, obowiązkowa sekcja: „CO NADAL WYMAGA OSOBNEGO ZLECENIA”.** Każdy defekt z
`00_ZESTAWIENIE.md` inny niż K4/K8 (K1, K2, K3, K5, K6, K7, K9, rodziny P2), z `plik:linia` i
jednozdaniowym opisem — bez naprawiania. Dołącz tu też **20 plików** zmierzonych w `R1` punkt 4,
które dziś omijają kanoniczny lejek inicjatyw (kontekst dla przyszłego porządkowania, nie
zadanie tego dyżuru).

★★ **Osobna, obowiązkowa sekcja: „PYTANIA DO WŁAŚCICIELA”.** Pierwsze: czy `sourceType`/
`sourceId` wybrane w `R1` (np. `'ai_chat_deep_thinking'` + `conversationId`) to właściwy kształt
śladu audytu dla inicjatyw tworzonych z czatu, czy właściciel woli inny identyfikator (np.
`messageId`) — **tak/nie/inny**. Drugie: czy toast K8 wymaga zmiany treści po naprawie (rekord
istnieje wcześniej niż wcześniej sugerował tekst) — **tak/nie**. Sekcja **nie może być pusta**.

★ Zanim dopiszesz cokolwiek do jakiegokolwiek dokumentu, sprawdź, czy nie jest GENEROWANY:
`bash -c "grep -rl '<nazwa-pliku>' scripts/"`. Sekcję w `REJESTR_ZNALEZISK_20260903.md` dopisujesz
o **pierwszej wolnej literze** — mój pomiar na markerze pokazuje `AF` jako ostatnią użytą (dyżur
365), więc `AG` jest kandydatem, ale sprawdź komendą
`bash -c "grep -nE '^## [A-Z]+\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"`
**tuż przed commitem**, bo równolegle piszą dyżury 367-369 i 371-373.

**Commit po `R4`.**

## Próg odbioru

**Oba defekty domknięte: „Konwertuj na inicjatywę” tworzy wyłącznie wiersz w `initiatives`
(przez kanoniczny lejek, z izolacją organizacji i śladem audytu do wiadomości źródłowej), zero
wierszy w `ai_decision_outcomes`; „Zapisz jako decyzję” zostaje bit-do-bitu bez zmian; „Zapisz
jako pomysł” zapisuje rekord SYNCHRONICZNIE, przed nawigacją, bez duplikatu przy późniejszym
otwarciu workspace — wszystko z dowodem mutacyjnym w obie strony i na realnym PostgreSQL.
Inwentarz `R3` kompletny, tabelaryczny, z jasnym rozróżnieniem naprawione/zgłoszone.**

Odbiorca odrzuci dyżur, w którym: „Convert to Initiative” nadal woła ten sam handler co „Save as
Decision”; naprawa K4 pisze bezpośredni `INSERT INTO initiatives` zamiast wołać kanoniczny lejek;
dowód K8 pokazuje tylko efekt końcowy bez dowodu kolejności wywołań; po naprawie K8 domontowanie
`IdeaMapWorkspace` tworzy drugi rekord; zachowanie gałęzi „decyzja” się zmieniło; naprawiono
choćby jeden z K1/K2/K3/K5/K6/K7/K9 zamiast go zaraportować; albo zmienił się stan choćby jednego
wiersza macierzy odbioru.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „K4 naprawiony i udowodniony
mutacyjnie, K8 zatrzymany na kroku 4, bo realny kształt `ideaId` z `from-chat` wymaga decyzji
właściciela o polu lineage” — **jest pełnowartościowym wynikiem**, nawet jeżeli żaden z
pozostałych defektów audytu nie zostanie ruszony.

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: **sprawdzasz warunek
NA BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie na zapamiętanym wyniku.** Wynik
ponownego sprawdzenia wklejasz do raportu z datą i godziną.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Napraw K4 przez rozgałęzienie” vs „nie zmieniaj zachowania decyzji” | `R0` (5) i `R1` punkt 2: gałąź `'decision'` zostaje bez zmian, dowód to identyczne pola `INSERT` przed/po |
| „Użyj kanonicznego lejka inicjatyw” vs „lejek jest tylko do odczytu” | Tabela licencji: WOŁASZ funkcję, nie modyfikujesz jej pliku; jeśli niewystarczająca — brief + pytanie, nie edycja |
| „20 miejsc omija lejek” vs „napraw to” | `R1` punkt 4 i `R4`: to jest KONTEKST zmierzony, nie zadanie tego dyżuru — idzie do sekcji „CO NADAL WYMAGA OSOBNEGO ZLECENIA” |
| „Zapisz przed nawigacją” vs „nie zmieniaj sygnatury `saveMessageAsIdea`” | `R2` punkt 2: sygnatura funkcji (parametry wejściowe) zostaje, zmienia się WYŁĄCZNIE ciało (kolejność operacji wewnątrz) |
| „Realne `ideaId` unika duplikatu” vs „strażnik to jeden `startsWith`” | `R2` punkt 4: dowód musi jawnie sprawdzić kształt `ideaId` wobec strażnika, nie zakładać zgodności |
| „Inwentaryzuj WSZYSTKO w `R3`” vs „napraw TYLKO K4/K8” | `R3` nagłówek i `Z17`: produktem jest tabela, nie kod; naprawa poza K4/K8 jest zakazana explicite w `ZAKAZ_WLASCIWY_TEMU_DYZUROWI` |
| „`reach` bezpiecznik ma dawać 0” vs „na markerze daje 1” | `§0.3` komenda (12) i „WARUNKI WSPÓLNE”: stan zastany, nie Twój defekt; warunkiem jest brak NOWYCH dodatków, nie zejście do zera |
| „Brief źródłowy podaje ścieżkę serwera” vs „realna ścieżka ma segment `/ai/`” | Zmierzone `§0.3` komenda (2); Twój pomiar jest wiążący (`Z24`), rozbieżność zapisujesz wprost |
| „Dopisz sekcję do rejestru znalezisk” vs „równolegle piszą inni autorzy (367-373)” | `R4`: literę sprawdzasz komendą tuż przed commitem; mój pomiar `AF`→`AG` może być już nieaktualny w chwili Twojego commita |
| „Kopiuj wzorzec z `saveMessageAsNote`” vs „ten plik jest tylko do odczytu” | Tabela licencji: CZYTASZ kształt, nie edytujesz linii 1567-1631; zmiana tam jest naruszeniem rozłączności |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 10 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — `MessageRenderer.tsx:319,2412,2422`, `UnifiedChatPanel.tsx:1462-1565,1567-1631,2150-2266,5627-5645,6418`, `api.ts:2212-2229,5757-5779`, `IdeaMapWorkspace.tsx:353,1632-1721`, `deep-thinking.routes.ts:57-142` (ścieżka z segmentem `/ai/` zweryfikowana `ls`), `createInitiativeService.ts:217`, `aiActionExecutor.ts:1266-1317`, `my-work.routes.ts:6889-6978` — wszystkie sprawdzone bezpośrednio na markerze; `evidence/akcje-wiadomosci-20260905/` **jawnie oznaczone jako nieistniejące** |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 13 wierszy, wszystkie zmierzone przy wydaniu na markerze |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP” | TAK — przycisk · handler frontu K4 · handler frontu K8 (rdzeń) · wzorce referencyjne · klient API · guard duplikatu · typy pomocnicze · rejestr akcji czatu · trasa serwerowa K4 · lejek inicjatyw · wzorzec wołania · trasa serwerowa K8 · middleware · nowe testy · testy istniejące · UI poza zakresem · infrastruktura testów · słowniki · dowody audytu · nowe dowody · macierz · rejestr znalezisk · raport · cudze tereny paczki 367-373 · reszta defektów audytu |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `R1` dotyka trasy + dwóch plików frontu, `R2` dotyka jednej funkcji, `R3` tylko czyta i raportuje, `R4` składa raport |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — 6441/5581 wolne (`lsof` przy wydaniu), brak kontenera `cx-day370-pg`, brak gałęzi `codex/day370-*` i worktree; 367-369, 371-373 mają rozłączne porty (6438-6440, 6442-6444) i rozłączny obszar (`13_CHAT` inne przyciski/moduły) |
| 7 | Komendy paste-ready | TAK — blok `§0.3` uruchomiony w całości na worktree z markera |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — `§0.2d` w komplecie; pułapki właściwe: ścieżka pliku serwera nieaktualna w brifie, `type` już dociera ale ginie, wzorzec poprawny już istnieje w tym samym pliku (dwa miejsca), brama jakości kanonicznego lejka, strażnik duplikatu to jedno porównanie stringów, atrapa bazy, `grep --include` w `zsh` |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę |
| 10 | Klauzula sprzeczności obecna, `§0.5` z tabelą „STOP proceduralny zakazany”, zero pól szablonu | TAK — kontrola generatora przy wydaniu |
