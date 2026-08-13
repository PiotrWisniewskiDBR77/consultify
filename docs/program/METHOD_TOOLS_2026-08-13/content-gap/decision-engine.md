# Content Gap Register — `decision-engine` (Decision Automation Engine / Silnik automatyzacji decyzji)

> Wave 3 ("Operational and Automation Tools"), `is_coming_soon=1` w live registry.
> Audyt: repo `codex/method-tools-20260813` @ `3ef119c548`.

---

## 1. Co istnieje

### 1.1 Marketing / Library copy (w repo, ale efektywnie nieosiągalna z API)

- `server/migrations/562_tools_toolsets_speed.sql:68-110` (migracja **aktywna**) — pełny 9‑polowy JSON EN+PL: `shortDescription:"A lightweight decision framework for selecting options under constraints.", whenToUse, whatYouGet[3]=["Criteria set","Scored options","Decision rationale"], inputs[4], steps[5]=["Define criteria","Weight criteria","Score options","Stress-test assumptions","Select and document"], outputs[3], commonMistakes[3], example:"Choose 2 automation candidates using impact, effort, risk and dependency weights.", nextSteps[2]`. [REPO_CANON]
- `server/migrations/562_tools_toolsets_speed.sql:743,839-909` — KB `kb-art-tools-decision-engine`, `published`, EN+PL, pełny wariant `Purpose → Inputs → Steps(5) → Outputs → Common mistakes → Next steps`.
- **Content martwy z perspektywy API** — identyczny mechanizm co w `vsm-builder.md`/`constraint-control.md` §1.1: `ACTIVE_KNOWN_TOOL_TYPES` (`KnownToolsService.ts:205-228`) nie zawiera `decision-engine`; `getKnownTool()` zwraca `null` (linie 900-902); `SQLITE_KNOWN_TOOLS_SEED` wpis (linie 455-467) ma `isComingSoon: true` (linia 466) i skrócony `whatYouGetEn: ['Criteria set', 'Scored options', 'Decision rationale']`; `ensureToolsSeedOnce()` (707-768) nadpisuje bogatszą treść z 562 przy każdym boot.
- `tests/components/Discovery/DiscoveryToolsHub.inactiveTools.test.tsx` (RV‑028) — potwierdza brak Open/Start.

### 1.2 Spec dokumentu produktowego

- `docs/product/CONSULTING_TOOLS_TOOL_SPECS_V3.md:596-609` (§3.18) — **cienki** wizard plan, `KB: TBD`, 2‑liniowy Wizard plan (`Work: table-first (decisions & rules) + optional flowchart workspace`).

### 1.3 Runtime / silnik

- `src/config/agentManifests/discoveryToolsRegistry.ts:129` — `PLANNED_TOOL_IDS`, `status:'planned', steps:[]`.
- `src/store/useToolStore.ts:2739` — `TOOLSET_OPERATIONAL_STEPS` (generyczne 8 kroków) — brak kroków „define criteria / weight / score / stress-test".
- `src/hooks/discovery/toolAi/systemPrompts.ts:196` — generyczny `OPERATIONAL_SYSTEM_PROMPT`.
- `src/components/DiscoveryTools/dedicatedToolTypes.ts:25` — w `DEDICATED_TOOL_TYPES` (generyczna powłoka).
- Brak `src/config/decisionengine/`.

### 1.4 Knowledge base

- `knowledge/tool-kb/` — zero katalogu `decision-engine`. [EVIDENCE_MISSING]

### 1.5 Mylący dokument

- `docs/product/KNOWN_TOOLS_CONTENT_COMPLETENESS_AUDIT_V3.md` §3.2 — klasyfikuje jako brakujące wyłącznie `GFX, VID`; nieaktualne wobec §1.1.

---

## 2. Czego brakuje

- **Silnik**: brak jakiejkolwiek logiki ważenia/scoringu (MCDA) — `steps[5]` w Library copy to lista nazw kroków, nie działający algorytm.
- **Bank pytań**: zero — brak `deepeningLadder`/`questionBank`.
- **Struktura tabeli decyzyjnej**: brak schematu danych (kolumny kryteriów, wagi, skala punktowa 1-5 czy 1-10, sposób agregacji — sumowanie ważone? multiplikacja?).
- **Reguły "stress-test assumptions"**: brak jakiejkolwiek definicji, co to znaczy operacyjnie (sensitivity analysis? scenariusze what-if?).
- **Asset**: brak preview graphic i micro-wideo.

---

## 3. Czy istnieje wiarygodne źródło

**Częściowo.** „Decision Engine" NIE jest jednym, nazwanym, kanonicznym frameworkiem publicznym (w przeciwieństwie do VSM czy TOC). To co jest opisane w `steps[5]` (zdefiniuj kryteria → nadaj wagi → oceń opcje → testuj założenia → wybierz) to standardowa, ogólnie znana technika **Multi-Criteria Decision Analysis (MCDA)** / ważona macierz decyzyjna (weighted decision matrix, czasem nazywana Pugh Matrix w wariancie porównawczym) — technika z domeny publicznej, opisywana w wielu podręcznikach zarządzania i inżynierii decyzji, ale nieprzypisana jednej osobie/publikacji tak jak VSM (Rother&Shook) czy TOC (Goldratt). [AUTHORITATIVE_EXTERNAL_SOURCE — istnieje jako uznana ogólna technika biznesowa/inżynierska, ale bez jednego kanonicznego cytowania; nic z tej techniki nie jest w repo zaimplementowane jako logika]

Element „policy-as-code automation" / symulacja automatyzacji decyzji z Library copy w `docs/product/CONSULTING_TOOLS_TOOL_SPECS_V3.md:596-608` (Goal: "map decision points and define policy rules; simulate automation impact") to dodatkowa, **Consultify-specyficzna warstwa** nałożona na generyczną technikę MCDA — nie ma zewnętrznego źródła dla tej części. [EDITORIAL_DRAFT / Consultify-specific]

---

## 4. Czego NIE WOLNO wygenerować

- Gotowych wag kryteriów bez udziału klienta/konsultanta (wagi MUSZĄ być per-case).
- Wymyślonych progów punktowych ("score >7 = go") bez ustalenia z klientem.
- Fabrykowanego przykładu liczbowego rozszerzającego istniejący `example` ("Choose 2 automation candidates...").
- Twierdzeń, że narzędzie ma formalną certyfikację MCDA lub jest oparte na konkretnej, nazwanej metodzie (np. AHP — Analytic Hierarchy Process) bez faktycznej implementacji tej metody.

---

## 5. Minimalny Pack do authoringu

1. **`methodology/v1`**: jasne stwierdzenie, że to ważona macierz decyzyjna (MCDA) — ogólna technika, nie jeden nazwany framework; definicja kiedy używać/kiedy nie (np. gdy decyzja jest jednoznacznie kwantyfikowalna vs. gdy wymaga jakościowego osądu).
2. **`qbank/v1`**: pytania do definiowania kryteriów, wag, źródeł evidence per opcja.
3. **`help/v1`**: rozbudowa `562:839-909` do 4 bloków, z jawnym wyjaśnieniem mechanizmu agregacji punktów (do ustalenia z Piotrem — obecnie brak w repo).
4. Jawna adnotacja: brak domyślnych wag/progów bez inputu klienta.

---

## 6. Wymagany przegląd ekspercki

**TAK.** Sposób agregacji (suma ważona vs. inne metody), skala punktowa i dobór domyślnych kryteriów wymagają decyzji metodologicznej — łatwo popełnić błąd (np. fałszywe poczucie precyzji z niewłaściwie skalowanych wag). [EXPERT_REVIEW_REQUIRED]

## 7. Wymagany przegląd prawny

**Niskie ryzyko.** MCDA/ważona macierz decyzyjna to technika domeny publicznej — nie wymaga cytowania konkretnego autora. Przegląd prawny potrzebny tylko, jeśli authoring zacznie nazywać narzędzie konkretną, chronioną metodą (np. AHP Saaty'ego ma specyficzną matematykę, której użycie bez implementacji byłoby mylące, ale nie jest to problem praw autorskich). [LEGAL_REVIEW_REQUIRED — nie, chyba że pojawi się fałszywe roszczenie do konkretnej nazwanej metody]

---

## 8. Provenance tags

`REPO_CANON` · `ENGINE_DERIVED` (brak) · `AUTHORITATIVE_EXTERNAL_SOURCE` (MCDA/ważona macierz — technika ogólna) · `EDITORIAL_DRAFT` (warstwa "policy automation" Consultify-specific) · `EXPERT_REVIEW_REQUIRED` · `EVIDENCE_MISSING` (stan bazy live niezweryfikowany).
