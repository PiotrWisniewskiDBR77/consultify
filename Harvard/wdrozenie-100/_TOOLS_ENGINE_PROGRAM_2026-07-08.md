# Program: Silniki Tools + Asystent Assessment (2026-07-08)

**Zlecenie Piotra (po utracie prądu 07-08):** (A) rozwijać asystenta dla 3 modeli dojrzałości — **SIRI, ADMA, DRD** (CMMI/LEAN na razie zostawić); (B) budować **silniki dla 11 szkieletowych narzędzi Tools** (z 30). Do budowy silników: **wypuścić agentów po wiedzę jak BCG / analogiczne firmy pracują tymi (lub analogicznymi) narzędziami** i udokumentować (bo NIE MA dokumentacji): jaki mają **cel**, jak się nimi **pracuje**, jak się z nich **wnioskuje**.

## ZASADA NADRZĘDNA (doktryna Consultify)
Asystent I narzędzia = **forma zbierania wiedzy i sposobu myślenia**, żeby wygenerować **autentyczne OBSERWACJE** w podsumowaniach istotnych dla organizacji oraz **INSIGHTY** — które w naszym systemie są **głównym narzędziem transformacji**. Każdy silnik i doktryna MUSZĄ być zorientowane na produkcję prawdziwego insightu, NIE na zbieranie danych. „Co z tego wynika dla organizacji" > „jakie dane zebraliśmy".

## Stan (na origin/Londyn, zweryfikowany)
- **19 narzędzi PEŁNE** (10 strategicznych z dedykowanym handlerem toolAi/ + 9 operacyjnych z config+silnikiem). NIE ruszamy — wzorce do naśladowania.
- **11 SZKIELET** (brak config/silnika, tylko generyczny prompt): vsm-builder, constraint-control, decision-engine, control-tower, automation-pipeline, robotics-feasibility, logistics-automation, integration-diagnostic, digital-value-pool, legacy-analyzer, data-inventory.
- Wzorce PEŁNE do kopiowania struktury: operacyjne = `src/config/{smedplanner,inventoryautopilot,rpascanner,aidiscovery}/` (deepeningLadder + conclusionPrompts + silnik domenowy + index).

## Metoda per narzędzie (3 fazy)
1. **DOKTRYNA (research→doc):** agent zbiera wiedzę BCG/McKinsey/analogiczną (web + wiedza) → `_TOOLS_DOKTRYNA/{tool}.md` wg szablonu:
   1. **Cel** — problem, dlaczego istnieje, decyzja którą wspiera.
   2. **Kiedy używać** — sytuacje wyzwalające.
   3. **Inputy** — co zebrać.
   4. **Metoda krok-po-kroku** — jak partner BCG to prowadzi.
   5. **Jak się WNIOSKUJE** — reguły interpretacji, sygnały, progi, pułapki.
   6. **INSIGHTY jakie produkuje** — jakie autentyczne obserwacje/insighty wynikają (RDZEŃ — powiązać z transformacją organizacji).
   7. **Worked example** (konkret).
   8. **Źródła.**
2. **BUILD (doc→silnik):** agent buduje `src/config/{tool}/` (deepeningLadder q-bank + conclusionPrompts + silnik domenowy + index) ugruntowany w doktrynie, wzorem najbliższego PEŁNEGO narzędzia. Wpięcie: OPERATIONAL_AI_TOOLS + promptRegistry summary/suggestion (grounded conclusion). Insight-first w conclusionPrompts.
3. **VALIDATE:** esbuild per plik + tsc (lokalny binarny + symlink node_modules, usuwać po) + wiring check.

## Ścieżka B — Asystent Assessment (SIRI/ADMA/DRD)
Coach (`src/services/assessmentCoach.ts` + `assessmentKnowledge/`) ma wymiary/skale/wiedzę per model. Pogłębienie: generacja autentycznych OBSERWACJI + INSIGHTÓW ze score'ów (nie opis, lecz „co to znaczy dla transformacji"). CMMI/LEAN pominięte.

## Higiena
Branch `feat/tools-assessment-dbr77` (origin/Londyn). Worker guard: **WYKONAJ SAM, zakaz delegacji** (noc: kilku robotników-zombie delegowało). Commit-per-narzędzie. Zero push/deploy/zapisu do bazy demo. Doktryny to pliki .md (wartość same w sobie — pierwsza dokumentacja tych narzędzi).
