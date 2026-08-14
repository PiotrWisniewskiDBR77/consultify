# Content Gap Register — `robotics-feasibility` (Robotics Feasibility / Wykonalność robotyki)

> Wave 3 ("Operational and Automation Tools"), `is_coming_soon=1` w live registry.
> Audyt: repo `codex/method-tools-20260813` @ `3ef119c548`.

---

## 1. Co istnieje

### 1.1 Marketing / Library copy (w repo, ale efektywnie nieosiągalna z API)

- `server/migrations/562_tools_toolsets_speed.sql:220-262` (migracja **aktywna**) — pełny 9‑polowy JSON EN+PL: `shortDescription:"Fast feasibility check for robotics: where it fits and what it takes.", whenToUse, whatYouGet[3]=["Feasibility score","Prerequisites","Quick wins vs bets"], inputs[4]=["Task list","Cycle time and variability","Safety constraints","CapEx/Opex assumptions"], steps[5]=["Select candidates","Check constraints","Define cell concept","Estimate impact","Plan pilot"], outputs[3], commonMistakes[3], example:"Palletizing: stable SKUs + space available → pilot cell with safety fencing.", nextSteps[2]`. [REPO_CANON]
- `server/migrations/562_tools_toolsets_speed.sql:746,1035-1086` — KB `kb-art-tools-robotics-feasibility`, `published`, EN+PL, wariant `Purpose → Steps(5) → Common mistakes → Next steps` (bez osobnej sekcji Inputs/Outputs).
- **Content martwy z perspektywy API** — identyczny mechanizm: `ACTIVE_KNOWN_TOOL_TYPES` (`KnownToolsService.ts:205-228`) nie zawiera `robotics-feasibility`; `getKnownTool()` → `null`; `SQLITE_KNOWN_TOOLS_SEED` (540-552) `isComingSoon: true` (linia 551), skrócony `whatYouGetEn: ['Feasibility score', 'Prerequisites', 'Pilot plan']`; `ensureToolsSeedOnce()` nadpisuje na każdym boot.
- RV-028 test potwierdza brak Open/Start.

### 1.2 Spec dokumentu produktowego

- `docs/product/CONSULTING_TOOLS_TOOL_SPECS_V3.md:674-687` (§3.21) — **cienki** wizard plan, `KB: TBD`, 2‑liniowy Wizard plan (`Work: table-first (candidates) + scoring`).

### 1.3 Runtime / silnik

- `src/config/agentManifests/discoveryToolsRegistry.ts:132` — `PLANNED_TOOL_IDS`, `status:'planned', steps:[]`.
- `src/store/useToolStore.ts:2742` — `TOOLSET_DIGITAL_STEPS` (generyczne kroki: "Digital Context"+"Fill"+reszta operational).
- `src/hooks/discovery/toolAi/systemPrompts.ts:199` — generyczny `OPERATIONAL_SYSTEM_PROMPT`.
- `src/components/DiscoveryTools/dedicatedToolTypes.ts:28` — w `DEDICATED_TOOL_TYPES`.
- `src/views/discovery-tools/DigitalToolsView.tsx` — narzędzie renderowane w widoku "Digital" (generyczna lista, nie dedykowany UI).
- Brak `src/config/roboticsfeasibility/`.

### 1.4 Knowledge base

- `knowledge/tool-kb/` — zero katalogu `robotics-feasibility`. [EVIDENCE_MISSING]

### 1.5 Mylący dokument

- `docs/product/KNOWN_TOOLS_CONTENT_COMPLETENESS_AUDIT_V3.md` §3.3 — klasyfikuje jako brakujące wyłącznie `GFX, VID`; nieaktualne wobec §1.1.

---

## 2. Czego brakuje

- **Silnik**: brak logiki scoringu wykonalności (jak dokładnie liczy się "feasibility score"? jakie wagi mają zmienność/bezpieczeństwo/CapEx?).
- **Bank pytań**: zero.
- **Reguły bezpieczeństwa**: `inputs` wskazuje "Safety constraints" jako wejście, ale brak jakiejkolwiek reprezentacji konkretnych, sprawdzalnych wymagań bezpieczeństwa (np. odniesienia do norm — zob. §3).
- **Wzorce ROI**: brak wzoru/metody liczenia CapEx/Opex vs. impact.
- **Asset**: brak preview graphic i micro-wideo.

---

## 3. Czy istnieje wiarygodne źródło

**Częściowo — dwie różne warstwy.**

1. **Warstwa bezpieczeństwa**: dla robotyki przemysłowej istnieją realne, autorytatywne, publikowane normy: **ISO 10218‑1/‑2** (bezpieczeństwo robotów przemysłowych) oraz **ISO/TS 15066** (współpraca człowiek-robot, coboty). To są rzeczywiste, cytowalne dokumenty normatywne. [AUTHORITATIVE_EXTERNAL_SOURCE — istnieje, ale nic z treści tych norm nie jest w repo; same normy są płatne/objęte prawami ISO, więc kopiowanie ich treści 1:1 wymaga uwagi prawnej]
2. **Warstwa "feasibility scoring" (dobór kandydatów, cell concept, ROI)**: to ogólna praktyka inżynierii przemysłowej / oceny inwestycji (payback period, ROI analysis) — nie jeden nazwany framework konsultingowy. [Ogólna praktyka biznesowo-inżynierska, brak jednego kanonicznego cytowania]

---

## 4. Czego NIE WOLNO wygenerować

- Konkretnych wymogów normatywnych (np. cytowanych klauzul ISO 10218) bez faktycznego dostępu do i weryfikacji treści normy — normy ISO są płatne i chronione prawami autorskimi, nie wolno parafrazować "z pamięci" jako rzekomo dokładnego cytatu.
- Konkretnych progów ROI/payback (np. "payback <18 miesięcy = feasible") bez danych klienta.
- Fabrykowanych przykładów rozszerzających istniejący `example` ("Palletizing: stable SKUs...").
- Twierdzeń o certyfikacji zgodności z ISO 10218/15066 bez faktycznego audytu.

---

## 5. Minimalny Pack do authoringu

1. **`methodology/v1`**: jasne rozdzielenie warstwy bezpieczeństwa (odesłanie do ISO 10218/15066 jako źródła zewnętrznego, bez kopiowania treści) od warstwy oceny wykonalności biznesowej (ogólna praktyka ROI/payback).
2. **`qbank/v1`**: pytania do doboru kandydatów (task list, cycle time, variability) + pytania bezpieczeństwa (odsyłające do realnej normy, nie wymyślone).
3. **`help/v1`**: rozbudowa `562:1035-1086` do 4 bloków.
4. Jawna adnotacja: żadnych cytatów z norm ISO bez zweryfikowanego dostępu do oryginału.

---

## 6. Wymagany przegląd ekspercki

**TAK, silny wymóg.** Ocena wykonalności robotyzacji dotyka bezpieczeństwa fizycznego ludzi — błędna ocena "prerequisites"/"safety constraints" ma realne konsekwencje BHP. Wymaga recenzji inżyniera automatyki/BHP, nie tylko konsultanta biznesowego. [EXPERT_REVIEW_REQUIRED — wysoki priorytet]

## 7. Wymagany przegląd prawny

**TAK.** Jeśli authoring będzie odwoływał się do norm ISO 10218/15066 (co jest zalecane merytorycznie), wymagany jest przegląd prawny dot. cytowania/parafrazowania treści płatnych norm technicznych — nie wolno reprodukować ich dosłownie bez licencji. [LEGAL_REVIEW_REQUIRED]

---

## 8. Provenance tags

`REPO_CANON` · `ENGINE_DERIVED` (brak) · `AUTHORITATIVE_EXTERNAL_SOURCE` (ISO 10218/15066 dla warstwy bezpieczeństwa) · `EDITORIAL_DRAFT` (Library+KB, warstwa ROI/feasibility — ogólna praktyka) · `LEGAL_REVIEW_REQUIRED` · `EXPERT_REVIEW_REQUIRED` (wysoki priorytet — bezpieczeństwo fizyczne) · `EVIDENCE_MISSING` (stan bazy live niezweryfikowany).
