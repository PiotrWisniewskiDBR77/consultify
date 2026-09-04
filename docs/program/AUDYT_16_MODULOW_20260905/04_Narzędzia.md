# 04. Narzędzia — audyt stanu na 2026-09-05 rano

Staging: `b852ade6` (wdrożony 04.09 23:33, 30 przełączników włączonych). Lokalnie: `http://localhost:3000` (ten sam kod, ten sam backend stagingu).

## Diagnoza w trzech zdaniach

10 ekranów (7 A, 1 B, 2 nie pokazujemy). Insights: Twoje „ok, obrazy” z 27.08 włączono i tego samego dnia cofnięto (brak tabeli na stagingu) — dziś włączone ponownie, tabela istnieje. SWOT 7 etapów odłożony do fali 2 Twoją decyzją.

## Przełączniki, które decydują o tym, co widzisz

| Co | Zmienna | Stan na stagingu |
|---|---|---|
| Przewód Insights w Narzędziach (Twoje „ok, obrazy” 27.08) | `VITE_TOOLS_INSIGHTS_WIRING` | ON od dziś; był cofnięty 26.08, bo brakowało tabeli tool_outputs — dziś tabela na stagingu istnieje |
| Dedup inicjatyw jako wybór Pomiń/Scal | `VITE_INITIATIVE_DEDUP_ACTIONABLE` | ON od dziś (parytet z demo) |
| SWOT 7 etapów zamiast 5 | `VITE_VF1_DYNAMIC_SWOT_SEVEN_STAGES` | OFF — Twoja decyzja DEC-383/384: fala 2 |

## A. Zatwierdzone obrazy — 10 ekranów (Twoje decyzje z 30.08–02.09)

Ocena: A = do odbioru, B = do odbioru z wyjątkami, C = nie pokazujemy, D = odłożone. Decyzja: Twoje kliknięcie. Uwaga: Twoje słowa, dosłownie.

| Ekran | Nazwa | Ocena | Decyzja | Twoja uwaga | Obraz |
|---|---|---|---|---|---|
| `karta-tool` | Karta narzędzia | A | ok | Zobacz tutaj w karcie ostatniej w przykładzie. Mieliśmy usunąć dwa przykłady, bo mieliśmy trzy. Został jeden, ale w postaci jednej kolumny. To wygląda bez sensu. No i w tym narzędziu nie mam, jak przeklikać samego wypełniania dokumentu. | `evidence/grafika/133-noc-narzedzia-audyty-kanon/karta-tool__PRZED__light.png` |
| `prompt-registry-tab` | Rejestr promptow | A | ok | Znowuż nie mam pojęcia, gdzie to jest, tak szczerze powiedziawszy, i do czego to ma służyć. | `evidence/grafika/grafika-14-ekranow/prompt-registry-tab__PRZED__light.png` |
| `tools-sesja-wyjscie` | Narzędzia — wyjście z sesji | A | ok |  | `evidence/grafika/15-domkniecie/tools-sesja-wyjscie__PRZED__light.png` |
| `tools-swot-initiative-proposal` | SWOT — propozycja inicjatywy | A | ok |  | `evidence/grafika/133-noc-narzedzia-audyty-kanon/tools-swot-initiative-proposal__PRZED__light.png` |
| `tools-swot-library-detail` | Dynamiczny SWOT — karta w bibliotece | A | ok |  | `evidence/grafika/15-domkniecie/tools-swot-library-detail__PRZED__light.png` |
| `tools-swot-report` | Raport SWOT | A | ok | Oczywiście wygląda to dobrze, jakby treść była w porządku, z tym że żaden słod nie będzie tylko tak małą analizą, nie? Ale generalnie wygląda ok. | `evidence/grafika/133-noc-narzedzia-audyty-kanon/tools-swot-report__PRZED__light.png` |
| `tools-swot-session-workspace` | Dynamiczny SWOT — warsztat sesji | A | ok | Jest jakaś prehistoryczna karta jeszcze za tym, zanim przerobiliśmy to. | `evidence/grafika/15-domkniecie/tools-swot-session-workspace__PRZED__light.png` |
| `tools-outputs-insights-tab` | Narzędzia — zakładka wniosków | B | ok |  | `evidence/grafika/15-domkniecie/tools-outputs-insights-tab__PRZED__light.png` |
| `tool-outputs-panel` | Narzędzia — panel rezultatów | C | — |  | `evidence/grafika/15-domkniecie/tool-outputs-panel__PRZED__light.png` |
| `tools-swot-live` | Dynamiczny SWOT — pole na zywo | C | ok |  | `evidence/grafika/15-domkniecie/tools-swot-live__PRZED__light.png` |

Bez Twojej decyzji (1): `tool-outputs-panel`.

## B. Gdzie układ na stagingu może NIE być tym, co zatwierdziłeś — i dlaczego

### B2. Przyrząd pokazał kompozycję, której w produkcie nie ma (audyt przyrządu 01.09)

| Ekran | Kategoria | Co dokładał / zmieniał przyrząd | Ocena, którą dałeś |
|---|---|---|---|
| `tools-swot-initiative-proposal` | Kategoria 1 | ramka karty (`rounded-2xl border`), której `SummaryStep` w produkcji nie ma | **A** |
| `tools-swot-initiative-proposal` | Kategoria 2 | `max-w-3xl` | **A** |
| `tool-outputs-panel` | Kategoria 2 | `max-w-2xl` | C |
| `tools-swot-live` | Kategoria 4 | `SwotLiveArtifact` — **zero wołaczy w `src/`** | **A** |

### B3. Znane wyjątki zapisane przy ekranach (status.json)

- `tools-swot-live`: SwotLiveArtifact nie ma zadnego wolacza w produkcie (grep: zero uzyc poza harnessem i komentarzem) — komponent zbudowany, nigdy nie montowany w ToolWorkspace
- `tools-swot-live`: ★ POMIAR 2026-09-01 (naprawa parytetu, Kategoria 4 audytu przyrządu): grep -rn "<SwotLiveArtifact" src/ server/src/ → ZERO trafień poza własnym plikiem i testami; jedyne wystąpienie w produkcji to komentarz w EvidenceEditor.tsx:41. Żadna sesja narzędzia tego nie montuje — pack `dynamicSwot.pack.ts:2
- `tools-swot-live`: ZBUDOWANY, ALE NIEPODŁĄCZONY (nie martwy): silnik `swotTensionEngine.ts` i mapowanie `toEvidenceKind` są wspólne z żywym Wynikiem SWOT — brakuje JEDNEGO przewodu: gniazda/zakładki w sesji narzędzia Dynamiczny SWOT. Bez nowej trasy i bez zmian w silniku.
- `tools-swot-live`: NIE POKAZUJEMY jako ekranu produktu do czasu podłączenia — właściciel oceniłby funkcję, której użytkownik nie widzi.
- `tools-swot-session-workspace`: COPILOT AI po angielsku (klucz i18n istnieje, PL = kopia EN literalna)
- `tools-outputs-insights-tab`: Zakladka Insighty nie jest slowem polskim (tools.hub.tabs.outputs w locale)
- `tools-outputs-insights-tab`: Nazwy narzedzi Value Chain/Dynamic SWOT surowe w tabeli (karta-tool ma je poprawnie po polsku — inna droga danych)
- `tools-swot-initiative-proposal`: Checklista Mission brief jest jasny — angielskie Mission brief wklejone w polskie zdanie (locale)
- `tools-sesja-wyjscie`: COPILOT AI po angielsku (locale)
- `tools-sesja-wyjscie`: Surowe dynamic-swot w polu Typ narzedzia (identyfikator techniczny, nie nazwa)
- `tool-outputs-panel`: Prawie caly ekran po angielsku: Outputs, SELECTED OUTPUT, Reopen for correction, REPORTS & PRESENTATIONS, REPORT, PRESENTATION, INITIATIVE PROPOSALS, data Aug 13, 2026. Po polsku sa tylko statusy
- `tool-outputs-panel`: Przyczyna ustalona: ~15 kluczy toolOutputs.* nie istnieje w ogole w public/locales/{pl,en}/translation.json — component jest i18n-ready, slownik pusty

## C. Funkcje i przejścia, które nie działają albo nie były sprawdzone

### C1. Twoje uwagi z korpusu 103 — 4 w tym module (2 realnych defektów)

| Ekran | Twoje słowa | Data | Klasa | Co zrobiono (poprawki po Twojej uwadze) |
|---|---|---|---|---|
| `karta-tool` | „Zobacz tutaj w karcie ostatniej w przykładzie. Mieliśmy usunąć dwa przykłady, bo mieliśmy trzy. Został jeden, ale w postaci jednej kolumny. To wygląda bez sensu. No i w tym narzędziu nie mam, jak przeklikać samego wypełniania dokumentu." | 2026-08-30 | DO_NAPRAWY | Sekcja przykladow: jeden przyklad zajmuje teraz pelna szerokosc zamiast siedziec w waskiej kolumnie z pustka obok. Przy okazji CTA 'Rozpoczn |
| `tools-swot-session-workspace` | „Jest jakaś prehistoryczna karta jeszcze za tym, zanim przerobiliśmy to." | 2026-08-30 | DO_NAPRAWY | MIALES RACJE. Za tym ekranem stala prehistoryczna karta — ale nie w produkcie, tylko w MOIM stanowisku pomiarowym: montowalo martwy komponen |
| `prompt-registry-tab` | „Znowuż nie mam pojęcia, gdzie to jest, tak szczerze powiedziawszy, i do czego to ma służyć." | 2026-08-30 | ZROBIONE | — |
| `tools-swot-report` | „Oczywiście wygląda to dobrze, jakby treść była w porządku, z tym że żaden słod nie będzie tylko tak małą analizą, nie? Ale generalnie wygląda ok." | 2026-08-30 | BACKLOG | — |

### C3. Bramki odbioru modułu, które NIE są PASS (MODULE_ACCEPTANCE)

```
G15 |`PARTIAL_PASS / RED_LEGACY_1`| Odbiór adwersaryjny 03.09 (`ODBIOR_DYZUROW_286_290_291_20260903.md` §1.5, koryguje raport dyżuru 286 — baza `f65c4ff6a0` miała nierozstrzygnięty marker konfliktu w `PreviewAIHintStrip.tsx:110`, więc pliki testowe dotykaj�
   G16 |`TECHNICAL_PACKET_READY / OWNER_RETEST_PENDING`| 2026-09-03 (nadzorca, marker `117bc9f743`): pakiet przed/po tego modułu = `evidence/grafika/a11y-fix-03_TOOLS-20260903-reszta.md`, `evidence/grafika/i18n-pl-en-20260903.md`, `evidence/grafika/przewody-odbioru-20260903.md`, `evid
   G19 |`NOT_PROVEN / OWNER_RETEST_PENDING`| Pomiar na markerze zamrożonym `fee24bddb0` (odbiór dyżuru 290 potwierdził niezależnie na własnej bazie — `ODBIOR_DYZUROW_286_290_291_20260903.md` §2). Kotwica: SHA odbioru modułu z wiersza `G18` = `08775ced65` (02.09 17
   G20 |`ENTRY_GATE_MEASURED / BLOCKED_BY_G19_AND_11_P0P1`| Oceniono 7/7 warunków na bazie `2a7273e087`; 0/7 formalnie odhaczone; G19 = `NOT_PROVEN / OWNER_RETEST_PENDING`; P0/P1 = 11 `BLOKUJE` przy mianowniku 121; dowód `evidence/g20/day359/r4-03_TOOLS.md`.
```

### C4. Odłożone do fali 2 Twoją decyzją 03.09 (nie zobaczysz ich jutro i to nie jest defekt)

- `DEC-2026-09-03-383`: Dwa brakujące etapy modelu sesji SWOT (5→7 etapów) (koszt: ŚREDNIE — 3 dni)
- `DEC-2026-09-03-382`: Wspólny kreator inicjatyw z Narzędzi (rozszerzenie zakazu `DEC-238`) (koszt: DUŻE; poza MVP z mocy rozszerzonego `DEC-238`)

## D. Jutro — kolejność przejścia i czego nie zgłaszać (pakiet przelotu)

**Kroki**: otwórz Narzędzia → kliknij realne, wcześniej użyte narzędzie z listy (np. SWOT) →
otwórz podgląd → uruchom narzędzie z realnym kontekstem inicjatywy.

**Co się zmieniło od 22–23.08**: dostępność klawiaturowa i kontrast doprowadzone do zera błędów.

**Czego NIE zgłaszaj**: wspólny kreator inicjatyw z Narzędzi — odłożony do fali 2.

Siedmioetapowy SWOT jest już podłączony w kodzie, ale pozostaje za flagą domyślnie wyłączoną;
bez decyzji o włączeniu nadal zobaczysz pięć etapów i nie jest to defekt. (zdezaktualizowane
przez `937f2d3193` — podłączenie siedmiu etapów SWOT, flaga nadal OFF).

**Pytania (TAK/NIE)**:
- Narzędzie otworzyło się z realnym kontekstem, nie pustym?

---

## Źródła

`docs/program/grafika/status.json`, `ODBIOR_DECYZJE.json`, `odbior.sqlite` (poprawki), `KORPUS_UWAG_20260902.md`, `AUDYT_PRZYRZADU_20260901.md`, `waves/WAVE_03_ACCEPTANCE/AUDYT_PRZEWODOW_ODBIORU_20260903.md`, `modules/03_TOOLS/MODULE_ACCEPTANCE.md`, `PRZELOT_WLASCICIELA_STAGING_20260904.md`, `FALA_2_PO_STAGINGU.md`, pomiar pakietu stagingu 04.09 23:35.
