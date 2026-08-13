---
document_id: METHOD-TOOLS-RIGHTS-ATTRIBUTION-REGISTER
module: Tools (31 kanonicznych narzędzi)
status: EVIDENCE_RECORD_NOT_LEGAL_OPINION
owner: piotr
prepared_by: W-C (rejestr praw i atrybucji)
branch: codex/method-tools-20260813
evidence_date: 2026-08-13
---

# Rejestr praw i atrybucji — 31 narzędzi konsultingowych Consultify

## Metoda i ograniczenia

**To jest rejestr dowodów znalezionych w repozytorium, NIE opinia prawna.** Autor
nie jest prawnikiem i nie ocenia, czy Consultify ma prawo komercyjnie
wykorzystywać którąkolwiek z opisanych metodyk. Rejestr wskazuje WYŁĄCZNIE to,
co da się zweryfikować w repo, i oznacza jako `LEGAL_REVIEW_REQUIRED` wszystko,
czego nie da się zweryfikować.

**Wiążące rozstrzygnięcie koordynatora (przyjęte tu bez zmian):** flaga bazy
danych `license='free'` / `is_licensed=0` to **flaga produktowa** (steruje UI —
czy narzędzie wymaga oddzielnej licencji jak DRD/SIRI/ADMA), **nie oświadczenie
prawne** o statusie praw autorskich metodyki. W tym rejestrze żadne narzędzie
nie jest nigdzie opisane jako „Free" w sensie prawnym — tam, gdzie w repo nie ma
potwierdzenia, wpisano `LEGAL_REVIEW_REQUIRED`.

**Co przeszukano (2026-08-13, worktree `method-tools`):**
- `docs/**`, `src/**`, `knowledge/**`, `Harvard/**`, `server/**` — wyszukiwanie
  słów: copyright, ©, ™, ®, licen(c/s)e, all rights reserved, attribution;
- nazwiska/organizacje: Michael Porter, Igor Ansoff, Boston Consulting Group /
  BCG, Shigeo Shingo, Toyota / TPS, Eliyahu Goldratt / Theory of Constraints,
  Barbara Minto / Pyramid Principle / SCQA, Womack & Jones / VSM / Lean;
- sekcje `## Provenance (sources)` w `knowledge/tool-kb/**/*.md`;
- nagłówki komentarzy w `src/config/<narzędzie>/*.ts` (19 katalogów silników
  metody — zweryfikowane osobiście, plik po pliku dla każdego z 31 narzędzi);
- `TOOLS_CANONICAL_ROSTER.md` (Gate T0, ta sama gałąź, ustalony z żywej bazy
  demo) — jego sekcja L10 doszła niezależnie do tej samej konkluzji co ten
  rejestr: **EVIDENCE_MISSING w całości** dla licencji metod bazowych;
- `docs/due-diligence/OPEN_SOURCE_LICENSES.md` — sprawdzone i **odrzucone jako
  źródło**: to inwentarz licencji pakietów npm (MIT/Apache), nie ma nic
  wspólnego z prawami do metodyk konsultingowych;
- migracje `server/migrations/252_tools_system.sql`,
  `server/migrations/559_tools_known_tools_library.sql` — kolumna
  `license_holder TEXT` istnieje w schemacie tabeli `tools`, ale nie jest
  wypełniona dla żadnego z 31 wierszy (NULL).

**Ważne rozróżnienie terminologiczne:** komercyjne „licencjonowane assessmenty"
Consultify (DRD, SIRI, ADMA, CMMI, LEAN) to **INNE znaczenie słowa „licencja"**
(licencja handlowa na framework oceny, z realnymi plikami źródłowymi w
`knowledge/SIRI/*.pdf`, `knowledge/ADMA/*.pdf`) i **NIE należą** do 31 narzędzi
objętych tym rejestrem. Widoczne są w tym samym menu Library (31 narzędzi + 5
frameworków assessment = 36 pozycji na ekranie), ale to osobna domena
(`docs/product/TOOLS_SSOT_SOURCES_V3.md` §4.2–4.3).

**Kanoniczny podział 31 narzędzi w repo** (`src/toolPacks/registry.ts`,
potwierdzony przez `TOOLS_CANONICAL_ROSTER.md`):
1. `dynamic-swot` — jedyne z zapisanym „Tool Knowledge Pack" (`PACK_COMPLETE`).
2. 18 narzędzi z **zweryfikowanym silnikiem metody** w `src/config/<katalog>/`
   (`PACK_NOT_AUTHORED` — silnik jest, opisowy pack wiedzy nie jest spisany).
3. 12 narzędzi **bez żadnej scieżki kodu metodycznego** (`EVIDENCE_MISSING`,
   pokrywają się 1:1 z `is_coming_soon=1` w bazie).

---

## Legenda pól tabeli

- **source_type**: `REPO_CANON` (spisany, kanoniczny dokument produktowy w
  repo) · `ENGINE_DERIVED` (logika/treść wywiedziona z silnika TypeScript w
  `src/config/`, bez cytowanego źródła zewnętrznego) · `AUTHORITATIVE_EXTERNAL_SOURCE`
  (potwierdzone, weryfikowalne w repo źródło zewnętrzne — oficjalna
  publikacja/podręcznik) · `EDITORIAL_DRAFT` (tekst redakcyjny/szablonowy bez
  cytowanego źródła) · `EVIDENCE_MISSING` (brak jakiegokolwiek śladu w repo).
- **copied content**: czy w repo jest zreprodukowany cudzy tekst/diagram.
  `N/D` = nie dotyczy, bo dla narzędzia nie istnieje w repo żadna treść
  metodyczna (nie ma czego kopiować ani nie kopiować).

---

## STRATEGY (10)

| # | Narzędzie (toolType) | Metodologia | Powszechna atrybucja | Źródło w repo | source_type | copied content | Nota trademark/atrybucja | Status komercyjny | Status prawny | Status publikacji | Niepewność |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `dynamic-swot` | SWOT / TOWS | SWOT bywa przypisywany Albertowi Humphreyowi / Stanford Research Institute (atrybucja sporna w literaturze biznesowej); TOWS — Heinz Weihrich. Konsultify nie rości sobie autorstwa metody. | `knowledge/tool-kb/dynamic-swot/methodology/v1/dynamic-swot-methodology.pl.md` + `.../benchmarks/v1/dynamic-swot-benchmarks.pl.md` (pack spisany, treść własna PL) | REPO_CANON (dla samego packu) / EVIDENCE_MISSING (dla źródeł zewnętrznych, patrz niepewność) | Treść packu (własna proza PL): NIE. Materiał źródłowy cytowany w sekcji Provenance: NIEZNANE — patrz niepewność. | Pack cytuje zewnętrzne strony (Creately, Visual Paradigm, Mural, Quantive, Business-to-you, NIBusinessInfo, BSC Designer) jako „Method source"/„Comparison source", ale nie ma noty o ich prawach ani zgodzie na wykorzystanie. | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | **Potwierdzone**: cytowane źródła (`knowledge/Strategie /*.zip`) NIE są weryfikowalne w repo — `.gitignore:173` wyklucza `/knowledge/**/*.zip`, katalog nie istnieje lokalnie w tym worktree. Nie da się sprawdzić, czy prosa packu parafrazuje, czy powiela treść źródeł zewnętrznych. |
| 2 | `market-forces` | Porter's Five Forces | Michael E. Porter („Competitive Strategy", 1979/1980) | `src/config/porter/*.ts` (silnik + bank pytań) | ENGINE_DERIVED | NIE (kod TS i angielskie komentarze inżynierskie; nazwa „Porter" użyta jako etykieta metody, bez cytatu z publikacji Portera) | Nazwa „Porter's Five Forces" użyta wprost w kodzie i UI (`Market Forces (Porter)`); brak noty o prawach/znaku towarowym. | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | Brak jakiejkolwiek cytowanej publikacji źródłowej Portera w repo. |
| 3 | `growth-paths` | Ansoff Matrix (Growth-share) | Igor Ansoff, „Strategies for Diversification" (Harvard Business Review, 1957) | `src/config/ansoff/*.ts` | ENGINE_DERIVED | NIE | Nazwa „Ansoff" wprost w kodzie/UI (`Growth Paths (Ansoff)`); brak cytatu źródła. | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | Brak cytowanej publikacji Ansoffa. |
| 4 | `value-chain` | Value Chain Analysis | Michael E. Porter, „Competitive Advantage" (1985) | `src/config/valuechain/*.ts` | ENGINE_DERIVED | NIE | Nazwa metody generyczna w UI („Value Chain Analysis"), bez wskazania Portera w interfejsie; przypisanie Porterowi jest powszechną wiedzą branżową, nie deklaracją repo. | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | Brak cytowanej publikacji. |
| 5 | `portfolio-priority` | Generyczna macierz 2×2 (kwadranty quick-win/big-bet/fill-in/money-pit), kod nazywa ją wprost „BCG-style" | Nie jest to dosłownie macierz wzrostu BCG (stars/cash cows/dogs/question marks) — Consultify używa własnej nomenklatury kwadrantów, ale komentarz w kodzie mówi „Map a BCG-style portfolio item" | `src/config/portfolio/portfolioMatrixEngine.ts`, `conclusionPrompts.ts` | ENGINE_DERIVED | NIE | Kod wprost przywołuje „BCG-style" — potencjalne skojarzenie ze znakiem/metodą Boston Consulting Group bez licencji ani zgody. | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | Nie zweryfikowano, czy „BCG-style" to tylko luźna inspiracja stylistyczna, czy odwzorowanie metody BCG na tyle bliskie, by rodzić ryzyko atrybucji. |
| 6 | `risk-uncertainty` | Consultify (własna kompozycja) — generyczna macierz ryzyka/niepewności | Brak jednego nazwanego autora zewnętrznego | `src/config/riskuncertainty/*.ts` | ENGINE_DERIVED | NIE | Brak nazwy zewnętrznej metody w kodzie. | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | Niskie ryzyko atrybucji — brak nazwanej metody zewnętrznej, ale i tak brak formalnej noty praw. |
| 7 | `capability-mapper` | Consultify (własna kompozycja) — mapowanie zdolności (maturity × importance) | Brak jednego nazwanego autora; luźno przypomina ogólne modele dojrzałości (np. CMMI), ale nie jest cytowane | `src/config/capabilitymapper/*.ts` | ENGINE_DERIVED | NIE | Brak nazwy zewnętrznej metody. | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | — |
| 8 | `ambition-decomposer` | Consultify (własna kompozycja) | Brak zewnętrznej atrybucji | `src/config/ambitiondecomposer/*.ts` | ENGINE_DERIVED | NIE | Brak nazwy zewnętrznej metody. | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | — |
| 9 | `focus-tradeoff` | Consultify (własna kompozycja) | Brak zewnętrznej atrybucji | `src/config/focustradeoffs/*.ts` | ENGINE_DERIVED | NIE | Brak nazwy zewnętrznej metody. | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | — |
| 10 | `narrative-engine` | Pyramid Principle + SCQA | Barbara Minto (Pyramid Principle); SCQA (Situation-Complication-Question-Answer) powszechnie kojarzone z McKinsey | `src/config/narrativeengine/pyramidQuestionBank.ts`, `docs/standards/CONCLUSION_LAYER_STANDARD.md` | ENGINE_DERIVED | NIE | Kod i doktryna wprost nazywają „piramida Minto" i „McKinsey SCQA" jako inspirację metodyczną; brak cytatu źródła (książka Minto „The Pyramid Principle") ani zgody. | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | Nazwisko Minto i marka McKinsey przywołane wprost w dokumentacji standardu — najbardziej jednoznaczna atrybucja nazwiskowa w całym zbiorze 31 narzędzi. |

---

## OPERATIONS (10)

| # | Narzędzie (toolType) | Metodologia | Powszechna atrybucja | Źródło w repo | source_type | copied content | Nota trademark/atrybucja | Status komercyjny | Status prawny | Status publikacji | Niepewność |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 11 | `a3-problem-solving` | A3 Problem Solving (7 kroków) | Toyota Production System / Toyota; metoda „5-Why" | `src/config/a3problemsolving/a3QuestionBank.ts` (komentarz: „SEVEN canonical steps of a Toyota/Lean...") | ENGINE_DERIVED | NIE | Kod wprost nazywa „Toyota/Lean"; brak cytatu formalnego źródła Toyoty. | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | — |
| 12 | `vsm-builder` | Value Stream Mapping | Toyota Production System; spopularyzowane przez Mike'a Rothera i Johna Shooka („Learning to See", Lean Enterprise Institute) oraz Womacka i Jonesa (Lean) | BRAK — narzędzie „coming soon", brak katalogu `src/config/vsmbuilder` | EVIDENCE_MISSING | N/D | Nazwa metody (VSM) jest w display_name narzędzia w bazie, ale zero treści metodycznej w repo. | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | Narzędzie nieaktywne (`is_coming_soon=1`), ale nazwa zewnętrznej metody już widoczna w Library — ryzyko do oceny przed aktywacją. |
| 13 | `sop-builder` | Standard Operating Procedure | Generyczne pojęcie zarządzania jakością/operacjami, nie przypisywane jednemu autorowi | `src/config/sopbuilder/*.ts` | ENGINE_DERIVED | NIE | Brak nazwy jednego zewnętrznego autora. | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | — |
| 14 | `constraint-control` | Theory of Constraints (TOC) | Eliyahu M. Goldratt, „The Goal" (1984) | BRAK — narzędzie „coming soon" | EVIDENCE_MISSING | N/D | Display name w bazie zawiera „(TOC)" — nazwa metody już widoczna, treści brak. | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | Jak przy VSM — nazwa zewnętrzna widoczna w UI Library mimo braku silnika. |
| 15 | `decision-engine` | Consultify (własna kompozycja) | Brak zewnętrznej atrybucji | BRAK — „coming soon" | EVIDENCE_MISSING | N/D | — | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | — |
| 16 | `control-tower` | Generyczne pojęcie branżowe (supply chain / operations „control tower") | Brak jednego nazwanego autora | BRAK — „coming soon" | EVIDENCE_MISSING | N/D | — | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | — |
| 17 | `automation-pipeline` | Consultify (własna kompozycja) | Brak zewnętrznej atrybucji | BRAK — „coming soon" | EVIDENCE_MISSING | N/D | — | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | — |
| 18 | `smed-planner` | SMED (Single-Minute Exchange of Die) | Shigeo Shingo, „A Revolution in Manufacturing: The SMED System" (1985) | `src/config/smedplanner/changeoverEngine.ts`, `conclusionPrompts.ts`, `deepeningLadder.ts` | ENGINE_DERIVED | NIE | Kod **wielokrotnie i wprost** przywołuje „Shingo order" jako regułę sekwencjonowania faz (separate → convert → streamline → standardize); to najbardziej jawna atrybucja nazwiskowa spośród silników operacyjnych. Brak cytatu źródła (książki Shingo) i noty o prawach. | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | — |
| 19 | `dms-builder` | Daily Management System | Tradycja Lean/TPS (zarządzanie wizualne, hoshin kanri); brak jednego powszechnie cytowanego nazwiska-autora tej konkretnej etykiety | `src/config/dmsbuilder/managementSystemEngine.ts` | ENGINE_DERIVED | NIE | Brak nazwiska w kodzie (w przeciwieństwie do SMED/Shingo). | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | — |
| 20 | `inventory-autopilot` | Consultify (własna kompozycja) — optymalizacja zapasów | Klasyczne pojęcia badań operacyjnych (np. EOQ) mają dawnych autorów (Ford W. Harris), ale nie są tu cytowane ani nazywane | `src/config/inventoryautopilot/inventoryEngine.ts` | ENGINE_DERIVED | NIE | Brak nazwy zewnętrznej metody. | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | — |

---

## DIGITAL / AUTOMATION (11)

| # | Narzędzie (toolType) | Metodologia | Powszechna atrybucja | Źródło w repo | source_type | copied content | Nota trademark/atrybucja | Status komercyjny | Status prawny | Status publikacji | Niepewność |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 21 | `robotics-feasibility` | Consultify (własna kompozycja) | Brak zewnętrznej atrybucji | BRAK — „coming soon" | EVIDENCE_MISSING | N/D | — | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | — |
| 22 | `logistics-automation` | Consultify (własna kompozycja) | Brak zewnętrznej atrybucji | BRAK — „coming soon" | EVIDENCE_MISSING | N/D | — | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | — |
| 23 | `rpa-scanner` | Consultify (własna kompozycja); RPA to generyczny termin branżowy | Brak jednego nazwanego autora metody | `src/config/rpascanner/feasibilityEngine.ts` (silnik istnieje, ale bez gałęzi w `ToolCanvas.tsx` — L4 w `TOOLS_CANONICAL_ROSTER.md`) | ENGINE_DERIVED | NIE | Brak nazwy zewnętrznej metody. | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | Silnik jest, ale niepodłączony w UI — nie zmienia to oceny prawnej, tylko stan wdrożenia. |
| 24 | `ai-discovery` | Consultify (własna kompozycja) | Brak zewnętrznej atrybucji | `src/config/aidiscovery/*.ts` | ENGINE_DERIVED | NIE | Brak nazwy zewnętrznej metody. | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | — |
| 25 | `integration-diagnostic` | Consultify (własna kompozycja) | Brak zewnętrznej atrybucji | BRAK — „coming soon" | EVIDENCE_MISSING | N/D | — | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | — |
| 26 | `digital-value-pool` | „Value pool" — generyczna nomenklatura konsultingowa (kojarzona luźno z analizami typu „digital value at stake" popularyzowanymi m.in. przez McKinsey), nie jest to jedna opatentowana metoda | Brak jednego nazwanego autora | BRAK — „coming soon" | EVIDENCE_MISSING | N/D | Sama nazwa narzędzia przywołuje skojarzenie z terminologią dużych firm doradczych; treści brak. | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | — |
| 27 | `legacy-analyzer` | Consultify (własna kompozycja) | Brak zewnętrznej atrybucji | BRAK — „coming soon" | EVIDENCE_MISSING | N/D | — | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | — |
| 28 | `data-inventory` | Consultify (własna kompozycja) | Brak zewnętrznej atrybucji | BRAK — „coming soon" | EVIDENCE_MISSING | N/D | — | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | — |
| 29 | `pain-to-solution` | Consultify (własna kompozycja) | Brak zewnętrznej atrybucji | BRAK — „coming soon" | EVIDENCE_MISSING | N/D | — | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | — |
| 30 | `pain-explorer` | Consultify (własna kompozycja) | Brak zewnętrznej atrybucji | `src/config/painexplorer/painSynthesisEngine.ts` | ENGINE_DERIVED | NIE | Brak nazwy zewnętrznej metody. | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | — |
| 31 | `process-automation` | Consultify (własna kompozycja) — sekwencja map/standardize/automate/sustain | Luźno przypomina rodzinę metod Lean/Six Sigma dot. standaryzacji przed automatyzacją, ale nie jest to cytowana metoda z nazwiskiem | `src/config/processautomation/automationEngine.ts` | ENGINE_DERIVED | NIE | Brak nazwy zewnętrznej metody. | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | LEGAL_REVIEW_REQUIRED | — |

---

## Ryzyka do decyzji właściciela

Poniżej narzędzia, gdzie luka między **flagą produktową „free"** a **brakiem
jakiegokolwiek dowodu atrybucji w repo** jest najbardziej materialna —
konkretnie te, które niosą w kodzie, UI lub nazwie wprost nazwisko/markę
zewnętrznej, dobrze rozpoznawalnej metody:

1. **`market-forces` (Porter's Five Forces)** — nazwa Portera wprost w
   display_name (`Market Forces (Porter)`) i w kodzie. Zero cytowanego źródła,
   zero noty o prawach.
2. **`growth-paths` (Ansoff)** — analogicznie: nazwa Ansoffa wprost w
   display_name (`Growth Paths (Ansoff)`) i w kodzie.
3. **`narrative-engine`** — jedyne miejsce w repo, gdzie **konkretne nazwisko
   autorki** (Barbara Minto) i **konkretna marka firmy doradczej** (McKinsey,
   przez SCQA) są przywołane wprost w dokumencie standardu
   (`docs/standards/CONCLUSION_LAYER_STANDARD.md`). Najwyższe ryzyko
   atrybucji nazwiskowej w całym zbiorze.
4. **`smed-planner` (SMED wg Shingo)** — kod odwołuje się do „Shingo order"
   wielokrotnie i systemowo (nie jednorazowo) jako reguły biznesowej
   sterującej kolejnością faz silnika. Nazwisko Shigeo Shingo jest częścią
   logiki produktu, nie tylko etykietą marketingową.
5. **`value-chain` (Porter's Value Chain)** — druga metoda przypisywana
   Porterowi w tym samym zestawie 31 narzędzi; podwaja ekspozycję na to samo
   nazwisko/dorobek.
6. **`a3-problem-solving`** — kod wprost nazywa „Toyota/Lean" jako źródło
   siedmiu kanonicznych kroków.
7. **`portfolio-priority`** — komentarz w kodzie („BCG-style") to
   samodzielne przywołanie marki Boston Consulting Group przez zespół
   inżynierski, nie wymóg produktowy; wymaga oceny, czy nazewnictwo
   kwadrantów jest wystarczająco odległe od faktycznej macierzy BCG.
8. **`constraint-control` (TOC)` i `vsm-builder` (VSM)`** — nieaktywne
   („coming soon"), ale nazwy zewnętrznych metod (Goldratt/TOC, Toyota/VSM)
   są już widoczne w interfejsie Library pod display_name. Ryzyko czeka na
   aktywację, nie jest jeszcze zmaterializowane.
9. **`dynamic-swot`** — jedyny pack z realnie cytowanymi źródłami
   zewnętrznymi (Creately, Visual Paradigm, Mural, Quantive, Business-to-you,
   NIBusinessInfo, BSC Designer), ale te źródła są **niearchiwizowane w
   repo w sposób weryfikowalny** (`.zip` na `.gitignore`). To jedyny
   przypadek, gdzie nie tylko brakuje noty prawnej, ale i nie da się dziś
   ustalić, ile treści zostało sparafrazowane a ile mogło być bliżej
   kopiowania.

Dla żadnego z powyższych repo nie zawiera noty o zgodzie, licencji,
opłacie ani jakiejkolwiek formy pozyskania praw do wykorzystania nazwanej
metodyki w produkcie komercyjnym.

---

## Podsumowanie liczbowe

- **31/31** narzędzi: **zero** dowodu licencji/zgody/opłaty za metodykę
  bazową w repo. Kolumna `license_holder` w tabeli `tools` istnieje w
  schemacie, ale jest pusta (NULL) dla wszystkich 31 wierszy.
- **31/31** narzędzi: status `LEGAL_REVIEW_REQUIRED` w każdej z kolumn
  (komercyjny / prawny / publikacji), zgodnie z regułą koordynatora.
- **19/31** narzędzi ma w repo **silnik metody** (`src/config/<katalog>/` —
  18 + dynamic-swot jako 19.) — to dowód implementacji, NIE dowód praw.
- **12/31** narzędzi nie ma żadnej treści metodycznej w repo
  (`EVIDENCE_MISSING` w pełnym sensie — brak nawet silnika).
- **Najwyższe ryzyko atrybucji** (nazwisko/marka wprost w kodzie, UI lub
  dokumentacji standardu): `narrative-engine` (Minto/McKinsey),
  `smed-planner` (Shingo), `market-forces` i `value-chain` (Porter),
  `growth-paths` (Ansoff), `a3-problem-solving` (Toyota/Lean),
  `portfolio-priority` (self-described „BCG-style").
- **Jedyny formalnie spisany „Tool Knowledge Pack"** to `dynamic-swot`, i
  właśnie on jest jedynym przypadkiem z cytowanymi źródłami zewnętrznymi —
  ale są one niezweryfikowalne w repo (archiwa `.zip` na `.gitignore`).
