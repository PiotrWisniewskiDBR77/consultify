# PLAN 6 NARZĘDZI — AKTUALIZACJA (PRZED → TERAZ → PO)
**Grupa DOKUMENTY · Consultify · 2026-07-22 (wieczór)**
Baza: `origin/demo` @ `10dfcb7897` (po Fali A/B/C + deck-fix A3 + niezależnie „kontrakt karty" 0d5bbfca).
Metoda: ocena RUNTIME (nie docy) — 4 agentów Explore grepujących realnych callerów + live-verify treści w przeglądarce + inspekcja żywej bazy TROLLEY. Poprzednik: `_FRAMEWORK_6_NARZEDZI_DOKUMENTY_2026-07-22.md` (ustalił kryteria + PRZED).

> **Zakres (przypomnienie Piotra):** 6 narzędzi = **3 generatory template'ów** (Prezentacja · Word · Excel) + **3 narzędzia-dokumenty** (Deck · Word · Excel). Dla każdego 5 osi oceny, próg PO = benchmark rynkowy. Ten dokument aktualizuje kartę o kolumnę **TERAZ** (co realnie dostarczyły Fale A/B/C/A3) i przecyzowuje roadmapę do PO.

---

## 0. FORMUŁA (bez zmian — SSOT: doktryna wymiar 4)
- **3 tryby wejścia** każdego narzędzia: ① CZYSTO (ręcznie) · ② z AI (Teresa) · ③ z TEMPLATE (szablon wielorazowy). Stąd potrzeba generatorów template'ów.
- **5 osi (0–10):** ① Menu · ② Nawigacja · ③ Funkcja · ④ Merytoryka · ⑤ Grafika.
- **Progi PO = benchmarki:** Prezentacja→Gamma-lub-lepiej · Word→„dokument konsultingowy klasy partnerskiej" · Excel→„analityk PE" (żywe formuły, model przeliczalny).

---

## 1. KARTA WYNIKÓW — 6 narzędzi × 5 osi (PRZED → **TERAZ** → PO)

| # | Narzędzie | ① Menu | ② Nawig. | ③ Funkcja | ④ Meryt. | ⑤ Grafika | Śr. PRZED | **Śr. TERAZ** | Próg PO |
|---|---|---|---|---|---|---|---|---|---|
| 4 | **Prezentacja (Deck)** | 4→**8** | 5→**8** | 7→**8.5** | 3→**3 ⚠** | 4→**7** | 4.6 | **~6.9** | 8 |
| 5 | **Word / Raport** | 6→**7** | 6→**7** | 7→**8** | 6→**7** | 6→**7** | 6.2 | **~7.2** | 8 |
| 6 | **Excel / Arkusz** | 3→**3** | 2→**2 ⚠** | 5→**6** | 3→**6** | 4→**4** | 3.4 | **~4.2** | 8 |
| 1 | **Gen. tpl. Prezentacji** | 1→**1** | 2→**2** | 2→**3** | –→**2** | 3→**4** | ~2.0 | **~2.4** | 7 |
| 2 | **Gen. tpl. Word** | 4→**5** | 4→**5** | 5→**6** | 5→**5** | 4→**5** | 4.4 | **~5.2** | 8 |
| 3 | **Gen. tpl. Excel** | 2→**3** | 2→**2** | 1→**4** | 1→**4** | 4→**4** | 2.0 | **~3.4** | 7 |

**⚠ = oś-blokada** (nie ruszona lub cofa całe narzędzie): Deck-Merytoryka (treść „brak danych" żyje), Excel-Nawigacja (silnik odcięty flagą/split-brainem).

Średnia grupy: **PRZED ~3.8 → TERAZ ~4.7**. Największy skok: Excel-merytoryka (3→6, grounding dochodzi do promptu) i generatory Excel (funkcja 1→4, koniec fantomu WORKBOOK_TEMPLATES). Najtwardszy zastój: **Deck-merytoryka (3→3)** i **Excel-nawigacja (2→2)** — oba z tego samego powodu: *silnik/naprawa istnieje, ale realna ścieżka użytkownika ich nie dotyka* (patrz §3).

---

## 2. CO KTÓRA FALA REALNIE DOSTARCZYŁA (uczciwie — z live-verify)

| Fala | Zamiar | Werdykt runtime |
|---|---|---|
| **A** Word format założeń | „(założenie)" inline zamiast „Assumption:" co zdanie | ✅ **DZIAŁA** (live: 65%, 280 tys. PLN, ROI 187% oznaczone) |
| **A** Excel grounding | sourcePack→prompt, koniec „[object Object]" | ✅ **DZIAŁA** dla callera z kontekstem (ArtifactActionPanel); ⚠ ExceleView nie wysyła kontekstu |
| **A** Deck koniec „brak danych" | briefInstruction wzmacnia user_instruction | ❌ **NIE DZIAŁA** live — bramkowane na `setup.brief` (pusty na realnej ścieżce) |
| **B** Excel gen. tpl. | podłącz WORKBOOK_TEMPLATES + save-as-sheet | ✅ **DZIAŁA** end-to-end (fantom zlikwidowany); ⚠ 2 rozłączne plany szablonów |
| **B** Deck gen. tpl. | backend AI-draft `/templates/plan` | ✅ backend REAL (parytet z Word); ❌ **BRAK FE** (fantom UX) |
| **C** grafika galerii | tokeny c-* w galeriach Deck | ✅ **DZIAŁA** (DeckTemplateGallery + Governance) |
| **A3** Deck content-pack (obejście silnika) | generator prozy z tematu jak Word | ❌ **NIE DZIAŁA** live — ta sama bramka `setup.brief`; kod poprawny, ścieżka go nie dotyka |

**Wniosek uczciwy:** Word i Excel-merytoryka i generatory-Excel realnie się ruszyły. **Deck-treść stoi** mimo 3 podejść — bo wszystkie 3 celowały poniżej realnego root-cause (patrz §3.1).

---

## 3. WNIOSKI PRZEKROJOWE (zaktualizowane — to steruje roadmapą)

### 3.1 ⭐ Deck-treść: root cause namierzony — DWA tory, czat idzie złym
Istnieją **dwa niezależne tory generacji decka**, a czat „Zrób prezentację…" (Auto) idzie torem **FE-direct**, który OMIJA logikę briefu Teresy:
- **Ogniwo 1 (przechwycenie):** `src/components/AIChat/documentIntentDetector.ts:83` `detectPresentationIntent()` = **regex po słowach kluczowych** (client-side). `UnifiedChatPanel.tsx:2872` przechwytuje prośbę LOKALNIE, zanim trafi do function-callingu Teresy → generuje inline przez `planDeckGeneration` (`:2967`).
- **Ogniwo 2 (źródło — najwyższe do naprawy):** `src/services/deliverablesGeneration.ts:77` `buildDeckSetup()` zwraca **gołe defaulty** `audience:'internal'`, `goal:'inform'`, **bez `brief`, ignoruje `intent`**. Intent jedzie osobnym polem obok setupu i do briefu nigdy nie wchodzi.
- **Ogniwo 3 (dobicie):** `deliverablesGenerations.routes.ts:118` `DeckSetupSchema` **nie ma pola `brief`** → zod stripuje, nawet gdyby wstrzyknąć.
- **Ogniwo 4:** `deliverablesGenerationService.ts:183` gałąź `deck` — `intent` użyty **tylko w logu**, `resolveDeckBrief` **nie wołany** (gałąź `doc/sheet` wstrzykuje intent do setupu, `deck` nie).
- **Tor poprawny, ale OMINIĘTY:** `generateDeliverable.ts:206,629-637` (narzędzie Teresy) MA `resolveDeckBrief` + `brief: intent` — nieosiągalny, bo FE przechwytuje prezentację regexem (Ogniwo 1).

Dlatego 3 naprawy treści (audyt `deckChatBrief`, Fala A `briefInstruction`, A3 content-pack) — wszystkie downstream `setup.brief` — **nigdy nie odpalają**. Klasyczny FANTOM: kod jest, testy zielone, realna ścieżka go omija.
**Fix (najszczelniejszy — łapie każdego callera POST-a, nie tylko UnifiedChatPanel):** w `deliverablesGenerationService.ts:183` (gałąź deck) wołać `resolveDeckBrief(params.intent, setup)` PRZED `generateOutline` (backend już dostaje `intent`, tylko go dla decka ignoruje) + przenieść `brief`+derywowane `audience`/`goal` do setupu przekazywanego do `generateDeck`. Dopiero WTEDY A3/Fala-A zaczynają działać (są gotowe, downstream). Uwaga: `resolveDeckBrief`/`deckChatBrief.ts` istnieje na `origin/demo` — dostępny do reużycia.

### 3.2 Silniki ISTNIEJĄ — blokadą jest WIRING, nie brak
- **Excel:** silnik 5-fazowy + żywe formuły (`threeScenarioPnL`) realnie wołany — ale **tylko z ArtifactActionPanel**. Wejście `/excele` redirectuje na `/tabele` (flaga OFF), a czat „stwórz arkusz" idzie do **markdown GFM** (`docGenerationRuntime`), nie do silnika. **Jeden przełącznik** (flaga `/excele` ON + reroute czatu z GFM na `WorkbookGeneratorService`) odblokowuje jednocześnie Funkcję Excela i Nawigację generatora.
- **Deck grounding:** silnik OK, brakuje danych na wejściu (§3.1).

### 3.3 Generatory template'ów — wzorzec „backend jest, FE brak/niepełny"
- **Word #2:** backend AI-draft + governance + Mode 3 REAL; **edytor struktury = fantom** (sekcje read-only, AI-refiner odrzuca zmiany strukturalne). „Kreator" jest, „edytor" nie.
- **Deck #1:** backend `/templates/plan` REAL (parytet z Word), **zero FE** → jedno zadanie: klon `DocumentStudioTemplateArchitectView` → `PresentationTemplateArchitectView`.
- **Excel #3:** dwa ROZŁĄCZNE plany — parametryczny formułowy (`WORKBOOK_TEMPLATES`, kod, 1 szt., nieedytowalny z FE) vs użytkownicki (`deliverableTemplate 'table'`, płaska lista kolumn, edytowalny). User nie stworzy z FE parametrycznego modelu z formułami.

### 3.4 Powłoka/menu i „3 tryby"
Nigdzie „3 tryby (czysto/AI/template)" nie są jawnym, równorzędnym wyborem na wejściu — wszędzie zlewają się (zakładka + toggle + picker w Word; redirect w Excel). Excel bez SPEC-A. Deck menu/nawigacja/grafika już OK (naprawione 07-19, karta była zaniżona).

---

## 4. STAN PER NARZĘDZIE (skrót — dowód w §agentów)

**#4 Deck (~6.9):** Menu/Nawig/Funkcja/Grafika OK; **Merytoryka 3 = blokada §3.1**. Eksport PPTX real. Storage lokalny (P0).
**#5 Word (~7.2):** najbliżej progu. Silnik+autosave+komentarze+eksport+snapshoty+diff+Mode 3 REAL. Luki: FE czytnika klienta (share-link backend gotowy, brak widoku), twardszy grounding/QA.
**#6 Excel (~4.2):** silnik+grounding+template-match realne, ale odcięte flagą/split-brainem (§3.2). Bez SPEC-A.
**#1 Gen. tpl. Deck (~2.4):** backend gotowy, brak FE (§3.3). Jedno zadanie klonujące.
**#2 Gen. tpl. Word (~5.2):** kreator AI-draft real, edytor struktury fantom (§3.3). Jednostrzałowy formularz (nie „rozmowa"), useLlm default OFF.
**#3 Gen. tpl. Excel (~3.4):** fantom zlikwidowany, save-as-sheet działa, ale dwa rozłączne plany szablonów (§3.3) + wejście przez zablokowany `/excele`.

---

## 5. ROADMAPA DO PO (zaktualizowana kolejność — wg wartości i odblokowania)

Zasada: najpierw **odblokować to, co już zbudowane** (tanie, wysoki zwrot), potem dobudować brakujące FE, na końcu polish.

### FALA A′ — DOKOŃCZ MERYTORYKĘ (odblokowanie gotowych silników)
1. **⭐ Deck root-cause (§3.1)** — w `deliverablesGenerationService.ts:183` (gałąź deck) wołać `resolveDeckBrief(params.intent, setup)` przed `generateOutline` + wpiąć `brief` do setupu. Backend-side, łapie każdego callera. Odczarowuje A3+Fala-A za jednym ruchem. **Najwyższy priorytet — bez tego Deck-merytoryka zostaje 3.**
2. **Excel reroute (§3.2)** — czat „stwórz arkusz" → `WorkbookGeneratorService` (nie GFM); zdjąć flagę `/excele` (po akcepcie) i wpiąć w sidebar. Odblokowuje Funkcję Excela (5→8) i Nawigację generatora Excel.
3. **Excel grounding z ExceleView** — dosłać sourcePack/evidenceRefs z dedykowanej ścieżki (dziś tylko ArtifactActionPanel ma grounding).

### FALA B′ — GENERATORY TEMPLATE'ÓW (jeden wzorzec → 3×)
4. **Gen. tpl. Deck FE (§3.3)** — klon `DocumentStudioTemplateArchitectView` → `PresentationTemplateArchitectView`, wpiąć w Hub. Backend gotowy. **Najkrótsza droga do pierwszego pełnego generatora.**
5. **Gen. tpl. Word — edytor struktury** — dodać add/remove/reorder/rename sekcji + rozluźnić AI-refiner by akceptował zmiany strukturalne. Odczarowuje fantom edytora.
6. **Gen. tpl. Excel — FE szablonów parametrycznych** — pozwolić tworzyć z FE szablon formułowy (`WORKBOOK_TEMPLATES`-klasa), nie tylko listę kolumn; odblokować build-from-template (zależne od kroku 2).

### FALA C′ — POLISH DO PROGU
7. **3 tryby jawnie** na wejściu każdego narzędzia; **Word czytnik klienta** (FE do share-link); **Excel powłoka SPEC-A**; **storage nietrwały P0** (Deck PPTX + załączniki na lokalnym dysku Railway → volume/S3).

---

## 6. DECYZJE DLA PIOTRA
1. **Akcept kolejności Fal A′→B′→C′** (zmiana vs poprzedni plan: Deck-root-cause przeskakuje na #1, bo blokuje najdroższą oś).
2. **Od którego kroku ruszamy** produkcję w pętli (rekomendacja: krok 1 — Deck root-cause, bo odblokowuje 3 gotowe naprawy i zamyka jedyną martwą oś Decka).
3. **Excel flaga `/excele` ON** — wymaga Twojego akceptu na zrzutach (zmiana nawigacji widoczna dla usera).

*Status: KOMPLETNY dla 6/6 narzędzi. Root-cause Decka (§3.1) namierzony do pliku:linii — gotowy do produkcji.*
