# Content Gap Register — podsumowanie (12 narzędzi Wave 3 "coming soon")

> Audyt: repo `codex/method-tools-20260813` @ `3ef119c548`. Worktree: `/Users/piotrwisniewski/.codex/worktrees/method-tools`.
> Zakres: `vsm-builder, constraint-control, decision-engine, control-tower, automation-pipeline,
> robotics-feasibility, logistics-automation, integration-diagnostic, digital-value-pool,
> legacy-analyzer, data-inventory, pain-to-solution`.

## Kluczowe odkrycie mechanizmu (dotyczy wszystkich 12)

Każde z 12 narzędzi ma w repo **dwie warstwy treści marketingowej**, nie jedną:

1. **Bogata warstwa w migracjach SQL** (`server/migrations/559_tools_known_tools_library.sql` dla
   `vsm-builder`, `server/migrations/562_tools_toolsets_speed.sql` dla pozostałych 11 — oba pliki
   **aktywne**, nie w `never-ran/`) — pełny 9‑polowy `library_content_translations` (EN+PL):
   `shortDescription, whenToUse, whatYouGet, inputs, steps, outputs, commonMistakes, example,
   nextSteps` + osobny artykuł KB "how to use" (status `published`, EN+PL).
2. **Uboższa warstwa w kodzie**, `server/src/services/KnownToolsService.ts` —
   `SQLITE_KNOWN_TOOLS_SEED` (tablica TS, linie ~230-680) ma dla każdego z 12 narzędzi wpis z
   `isComingSoon: true` i TYLKO 3‑punktowym `whatYouGet`. `ensureToolsSeedOnce()` (linie 707-768)
   wykonuje ten seed przez `INSERT ... ON CONFLICT (name) DO UPDATE SET
   library_content_translations = EXCLUDED.library_content_translations, is_coming_soon =
   EXCLUDED.is_coming_soon` **przy każdym starcie procesu** (komentarz w kodzie: "required to
   propagate corrections... to existing production DBs") — czyli nadpisuje kolumnę z powrotem do
   samego `whatYouGet`, kasując bogatsze pola z warstwy (1), niezależnie od tego, czy migracja SQL
   kiedykolwiek się wykonała.
3. Dodatkowo `ACTIVE_KNOWN_TOOL_TYPES` (`KnownToolsService.ts:205-228`, hardcoded allowlist 19
   toolType) nie zawiera żadnego z 12 — `isKnownToolActive()` (770-776) zawsze zwraca `false`, a
   `getKnownTool()` (900-902) zwraca `null` dla nieaktywnego narzędzia. Endpoint szczegółu
   narzędzia **nigdy nie odda** `whenToUse/steps/outputs/example` dla żadnego z 12, niezależnie od
   stanu bazy. Niezależny test `tests/components/Discovery/DiscoveryToolsHub.inactiveTools.test.tsx`
   (RV‑028, import z żywego kodu, nie mock) potwierdza brak Open/Start dla wszystkich 12.

**Wniosek**: brief koordynatora ("Library content = thin, tylko whatYouGet") jest zgodny z tym, co
faktycznie SERWUJE runtime (warstwa 2+3) — ale repo zawiera fizycznie bogatszy tekst (warstwa 1),
który jest dziś martwy/nieosiągalny kodowo, nie tylko "cienki z braku pisania". To rozróżnienie ma
znaczenie dla planu naprawy: PRZED jakimkolwiek authoringiem treści merytorycznej trzeba osobno
zdecydować, czy naprawić `ensureToolsSeedOnce()`/`ACTIVE_KNOWN_TOOL_TYPES` (żeby uwolnić już
napisany tekst), niezależnie od tego, że sam ten tekst i tak NIE jest metodyką/silnikiem — to
nadal tylko opis marketingowy Library + 5‑punktowy stub KB "how to use", nie qbank/deepening
ladder/reguły klasyfikacji.

Dodatkowo: 5 z 12 narzędzi (`integration-diagnostic, digital-value-pool, legacy-analyzer,
data-inventory, pain-to-solution`) ma TRZECI, zduplikowany wariant tej samej treści w
`server/migrations/never-ran/618_tools_missing_12_consulting_tools.sql` — plik w klasie martwych
migracji `6XX` (nigdy nie pasuje do wzorca boot-runnera, a nawet przy ręcznym uruchomieniu
zostałby zablokowany przez `ON CONFLICT (id) DO NOTHING`, bo 562 z niższym numerem tworzy ten sam
`id` jako pierwsze). Traktować jako martwy duplikat, nie dodatkowe źródło.

Runtime dla wszystkich 12 jednolicie: `status:'planned'` + puste `steps/sources/outputs` w
`src/config/agentManifests/discoveryToolsRegistry.ts` (`PLANNED_TOOL_IDS`, linie 126-139), generyczne
kroki `TOOLSET_OPERATIONAL_STEPS`/`TOOLSET_DIGITAL_STEPS` w `src/store/useToolStore.ts` (8-9
identycznych nazw kroków dla WSZYSTKICH narzędzi operacyjnych/digital), i jeden dzielony
`OPERATIONAL_SYSTEM_PROMPT` w `src/hooks/discovery/toolAi/systemPrompts.ts` (bez treści
specyficznej dla metodyki). Brak `src/config/<dir>/` dla wszystkich 12 (potwierdzone). Brak
jakichkolwiek `knowledge/tool-kb/<toolType>/` packs dla wszystkich 12 (istnieją tylko dla `drd,
siri, adma, dynamic-swot, kpi`).

`docs/product/KNOWN_TOOLS_CONTENT_COMPLETENESS_AUDIT_V3.md` (status: Draft) twierdzi, że
Library+KB są już "kompletne tekstowo" dla wszystkich 31 narzędzi i jedyny brak to grafika +
wideo — **to twierdzenie nie uwzględnia mechanizmu z punktów 2-3 powyżej i jest mylące**, nie
dowodem gotowości.

---

## Tabela

| toolType | Wiedza w repo | Generyczny step array | Minimalny Pack bez wymyślania? | Przegląd ekspercki | Przegląd prawny |
|---|---|---|---|---|---|
| `vsm-builder` | THIN (Library+KB martwe API-wise; źródło zewn. VSM/Rother&Shook istnieje, nic w repo) | `TOOLSET_OPERATIONAL_STEPS` | NIE (brak notacji/qbank; wymaga cytowania Rother&Shook) | TAK | WARUNKOWO (grafiki/szablony) |
| `constraint-control` | THIN (5 kroków = niecytowana parafraza TOC Goldratta, z odstępstwem terminologicznym) | `TOOLSET_OPERATIONAL_STEPS` | NIE (wymaga korekty terminologii TOC + qbank) | TAK | WARUNKOWO |
| `decision-engine` | THIN (ogólna MCDA/ważona macierz, brak jednego cytowania) | `TOOLSET_OPERATIONAL_STEPS` | NIE (brak mechanizmu agregacji punktów) | TAK | NIE |
| `control-tower` | THIN (wzorzec branżowy, bliski `dms-builder` — granica niejasna) | `TOOLSET_OPERATIONAL_STEPS` | NIE (wymaga decyzji produktowej o relacji do DMS) | TAK | NIE |
| `automation-pipeline` | THIN (ogólna praktyka backlog/funnel, bliska `rpa-scanner`/`process-automation`) | `TOOLSET_OPERATIONAL_STEPS` | NIE (wymaga decyzji o konsolidacji z istniejącymi narzędziami) | TAK | NIE |
| `robotics-feasibility` | THIN (feasibility=ogólna praktyka; bezpieczeństwo=realne normy ISO 10218/15066) | `TOOLSET_DIGITAL_STEPS` | NIE (bezpieczeństwo wymaga eksperta BHP/automatyki, nie tylko konsultanta) | TAK (wysoki priorytet — BHP) | TAK (cytowanie norm ISO) |
| `logistics-automation` | THIN, ale NAJLEPIEJ opisany wizard plan spośród 12 (spec §3.22 pełny) | `TOOLSET_DIGITAL_STEPS` | NIE (brak reguł feasibility scoring, brak benchmarków branżowych) | TAK | NIE |
| `integration-diagnostic` | THIN, KB najuboższy z 12 (tylko Steps+Next steps); spec §3.25 pełny | `TOOLSET_DIGITAL_STEPS` | NIE (TOGAF jako inspiracja istnieje, nic w repo) | TAK | WARUNKOWO (TOGAF) |
| `digital-value-pool` | THIN; koncepcja "value pool" rozpoznawalna w strategy consultingu (McKinsey/BCG), ale bez ustandaryzowanych kroków; spec §3.26 pełny | `TOOLSET_DIGITAL_STEPS` | NIE (spec wprost wymaga "benchmark levers" — zero w repo) | TAK | WARUNKOWO (cytowanie firm doradczych) |
| `legacy-analyzer` | THIN; Gartner TIME model + strangler pattern (Fowler) jako możliwe źródła, nic w repo; spec §3.27 pełny | `TOOLSET_DIGITAL_STEPS` | NIE (definicja 3 wymiarów "drag" jawnie niezdecydowana w spec) | TAK | TAK (Gartner) |
| `data-inventory` | THIN; DAMA-DMBOK jako uznany standard, nic w repo; rozbieżność decision-centric vs asset-centric między spec a Library copy | `TOOLSET_DIGITAL_STEPS` | NIE (rozbieżność zakresu do rozstrzygnięcia produktowo) | TAK | WARUNKOWO (DMBOK) |
| `pain-to-solution` | THIN, NAJSŁABIEJ ugruntowane z 12 — brak jednego źródła zewn., luźna analogia do Value Proposition Canvas; katalog "solution archetypes" (kluczowy element) ZUPEŁNIE nie istnieje | `TOOLSET_DIGITAL_STEPS` | NIE (najgorsza pozycja startowa spośród 12) | TAK (wysoki priorytet) | NIE (ale ryzyko mylącego marketingu) |

Legenda "Wiedza w repo": NONE/THIN/MODERATE — wszystkie 12 to **THIN**: żadne nie ma prawdziwego
silnika (qbank/deepening ladder/klasyfikacja), a bogatsza Library+KB treść jest albo nieosiągalna
z API (wszystkie 12), albo generyczna/niecytowana (10 z 12), albo wewnętrznie niespójna (2 z 12:
`data-inventory`, `pain-to-solution`).

---

## Które mają WIĘCEJ wiedzy niż oczekiwano

Żadne z 12 nie ma realnej wiedzy metodologicznej (qbank/silnik) — pod tym względem brief
koordynatora się potwierdza w 100%. ALE pod względem **napisanego, ale martwego** tekstu
marketingowego, WSZYSTKIE 12 mają więcej niż sugerował brief ("tylko whatYouGet") — każde ma
kompletny 9‑polowy Library JSON + osobny opublikowany artykuł KB, po prostu nieosiągalny z API.
Spośród 12, wyróżniają się pozytywnie co do **jakości opisu procesu** (pełny Define/Inputs &
assumptions/Work surface/Review/Finalize/Outputs w `CONSULTING_TOOLS_TOOL_SPECS_V3.md`, nie tylko
Library copy):

- `logistics-automation` (§3.22) — najbardziej dopracowany brief, gotowy micro-video script.
- `integration-diagnostic` (§3.25), `digital-value-pool` (§3.26), `legacy-analyzer` (§3.27),
  `data-inventory` (§3.28), `pain-to-solution` (§3.29) — wszystkie mają pełny wizard plan.

Te 6 (razem z `logistics-automation`) potwierdza dokładnie to, co sugerował koordynator na
starcie: "reportedly fuller wizard-plan prose" — zweryfikowane jako prawdziwe.

## Które mają genuinely NIC

Pod względem silnika/qbank/notacji/reguł klasyfikacji — **wszystkie 12, bez wyjątku**, mają
genuinely zero. Różnica między nimi jest tylko w jakości opisu marketingowego (Library+KB) i w
tym, czy istnieje wiarygodne źródło zewnętrzne do oparcia przyszłej metodyki:

- **Najsłabsza pozycja startowa**: `pain-to-solution` — brak jednego źródła zewnętrznego, brak
  katalogu "solution archetypes" (element bez którego narzędzie nie ma treści), wewnętrznie
  niespójny opis między migracją a kodem.
- **Najsłabszy opis (KB)**: `integration-diagnostic` — jedyny bez sekcji Purpose/Inputs/Outputs/
  Common mistakes w artykule KB.

## Honest judgement — ile Packów da się dziś napisać bez wymyślania metodyki

**Zero z 12 da się dziś domknąć do "legitymnego minimalnego Packa" bez dodatkowej pracy
researchowej/eksperckiej lub decyzji produktowej.** Powód nie jest jednolity:

- **6 narzędzi ma solidne źródło zewnętrzne do oparcia methodology packa** (`vsm-builder`→VSM/
  Rother&Shook, `constraint-control`→TOC/Goldratt, `robotics-feasibility`→ISO 10218/15066 dla
  warstwy bezpieczeństwa, `legacy-analyzer`→Gartner TIME/Fowler strangler pattern,
  `data-inventory`→DAMA-DMBOK, `digital-value-pool`→nurt "value pools" w strategy consultingu) —
  dla tych sześciu praca do wykonania to głównie: (a) faktyczne przeczytanie/zacytowanie źródła
  (nie parafraza z pamięci), (b) zbudowanie qbanku, (c) przy części z nich review prawny pod kątem
  cytowania. To NAJSZYBSZA ścieżka do prawdziwego Packa.
- **6 narzędzi nie ma jednego kanonicznego źródła zewnętrznego**
  (`decision-engine`→ogólna MCDA, `control-tower`→wzorzec branżowy bliski DMS,
  `automation-pipeline`→ogólna praktyka backlog bliska RPA Scanner/Process Automation,
  `logistics-automation`→domena branżowa bez jednego frameworku, `integration-diagnostic`→TOGAF
  jako luźna inspiracja, `pain-to-solution`→brak źródła) — dla tych sześciu praca wymaga albo (a)
  decyzji produktowej o konsolidacji z istniejącym, już zbudowanym narzędziem o podobnym zakresie
  (`control-tower`↔`dms-builder`, `automation-pipeline`↔`rpa-scanner`/`process-automation`,
  `pain-to-solution`↔`pain-explorer`), albo (b) świadomego uznania ich za Consultify-specyficzną
  syntezę ogólnej praktyki (nie "framework X") i zbudowania metodyki od podstaw z udziałem
  eksperta domenowego — nie z researchu jednego źródła.

We wszystkich 12 przypadkach: **przegląd ekspercki jest wymagany** (bez wyjątku) — nawet tam,
gdzie źródło zewnętrzne istnieje, operacjonalizacja w konkretne pytania/progi/reguły wymaga
praktyka domenowego, nie tylko cytowania książki. Przegląd prawny jest wymagany warunkowo w 7 z 12
(tam gdzie źródło zewnętrzne jest chronione/komercyjne: Gartner, DAMA, ISO, McKinsey/BCG-adjacent,
TOGAF) i wprost w 1 (`robotics-feasibility` — normy ISO).

---

## Pliki

- `vsm-builder.md`, `constraint-control.md`, `decision-engine.md`, `control-tower.md`,
  `automation-pipeline.md`, `robotics-feasibility.md`, `logistics-automation.md`,
  `integration-diagnostic.md`, `digital-value-pool.md`, `legacy-analyzer.md`,
  `data-inventory.md`, `pain-to-solution.md` — po jednym rejestrze per narzędzie, w tym samym
  katalogu.
