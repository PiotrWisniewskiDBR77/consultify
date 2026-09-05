# Odbiór na żywo — pakiet 09-finanse (13 ekranów)

Data: 2026-09-05. Środowisko: localhost:3000 (kod m03, backend+dane stagingu), sesja właściciela.

## Liczby
- ZGODNY: 2 (finance-hub, finance-model-workspace)
- ROZNI_SIE: 6 (finance-analysis-workspace, finance-statement-pack-workspace-v2, finance-prediction-workspace, finance-valuation-workspace, finance-baseline-workspace — oraz pośrednio wszystkie 5 „NIE_DOTARLEM" poniżej to ten sam defekt)
- NIE_DOTARLEM: 5 (finance-comments-panel, finance-lineage-navigator, finance-workspace-bar, finance-saved-views-panel, finance-export-import-panel, finance-compare-panel) — **to 6, nie 5, patrz uwaga niżej**

Poprawne liczby z wyniki.json: ZGODNY 2, ROZNI_SIE 5, NIE_DOTARLEM 6. Razem 13.

## GŁÓWNA PRZYCZYNA (jedna, wspólna dla 11 z 13 ekranów)

Cały pakiet „Finance v3" (5 kanonicznych warsztatów + 5 mini-narzędzi osadzonych w
`FinanceWorkspaceUtilities`) jest zbudowany i widoczny WYŁĄCZNIE w dev-render (harness
z mockiem `?bridge=ok`). W realnej aplikacji każdy z nich jest owinięty w
`FinanceLegacyBridgeGate` (src/components/Finance/shared/FinanceLegacyBridgeGate.tsx —
„ID_BRIDGE, Gate E"), który na PRAWDZIWYCH danych stagingu zawsze zwraca stan
**„unresolved"** (żaden rekord nie ma jeszcze aliasu do nowego systemu) — sprawdzone na
5 realnych rekordach w 5 zakładkach (Sprawozdania/Modele/Analiza/Wycena/Predykcja).
W tym stanie renderuje się `unresolvedFallback` — starszy, uczciwie oznaczony
(„Otwierasz sprawdzony widok klasyczny") komponent — a kanoniczny ekran, który
Piotr zatwierdził na obrazie, nigdy się nie pojawia. Efekt:

- 5 mini-narzędzi (Komentarze, Powiązania/lineage, Zapisane widoki, Eksport/import,
  Porównanie okresów) w ogóle się nie montują — żaden realny rekord nie prowadzi do nich → **NIE_DOTARLEM**.
- Pasek tożsamości (finance-workspace-bar) jest jeszcze bardziej odcięty — kod wprost mówi,
  że żaden z 5 warsztatów go dziś nie montuje, niezależnie od bramki → **NIE_DOTARLEM**.
- 4 kanoniczne warsztaty (Analiza, Sprawozdania v2, Predykcja, Wycena, Baza porównania —
  razem 5) renderują się jako STARSZA wersja ekranu zamiast zatwierdzonej → **ROZNI_SIE**
  (dotarłem do ekranu pod tą samą nazwą/trasą, ale to inny komponent/układ).
- Wycena (finance-valuation-workspace) jest najgorsza: pokazuje pusty stan + toast błędu
  „Legacy valuation is not mapped" + błąd konsoli 409.

Tylko finance-hub i finance-model-workspace są ZGODNE, bo ich zatwierdzony obraz
to właśnie ten sam „widok klasyczny" (legacy), który dziś faktycznie się renderuje.

## Lista różnic (jedno zdanie każda)
1. finance-comments-panel — panel nigdy się nie montuje (bramka ID_BRIDGE zawsze „unresolved" na realnych danych).
2. finance-lineage-navigator — jw., ten sam mechanizm.
3. finance-saved-views-panel — jw.
4. finance-export-import-panel — jw.
5. finance-compare-panel — jw.
6. finance-workspace-bar — komponent w ogóle nie jest wpięty do żadnego z 5 warsztatów Finance (potwierdzone w kodzie, nie tylko na bramce).
7. finance-analysis-workspace — realny ekran pokazuje pusty stan „Dla tej analizy nie ma jeszcze wartości KPI" zamiast tabeli wskaźników z obrazu.
8. finance-statement-pack-workspace-v2 — realny ekran to stary widok P&L/BS/CF + Source Files, nie nowy układ „Sprawozdanie + Rekoncyliacja/Powiązane artefakty/Sekcja raportu".
9. finance-prediction-workspace — realny ekran to proste karty wejściowe, brak trybów scenariusza A/B/C i łańcucha inicjatyw z obrazu.
10. finance-valuation-workspace — realny ekran jest pusty i pokazuje błąd „Legacy valuation is not mapped" (409 w konsoli) zamiast łańcucha pochodzenia wyceny.
11. finance-baseline-workspace — realny ekran to 4-zakładkowy widok wejściowy (jak model), nie 2-zakładkowy „Założenia/Wyliczenia" z pełną tabelą prognozy.

## Lista „nie dotarłem" z powodem
- finance-comments-panel, finance-lineage-navigator, finance-saved-views-panel,
  finance-export-import-panel, finance-compare-panel, finance-workspace-bar —
  wszystkie z tego samego powodu: komponent-hostujący (`FinanceWorkspaceUtilities`
  albo `FinanceWorkspaceBar`) nie montuje się na żadnym realnym rekordzie
  dostępnym dziś na stagingu (0 z ~63 sprawdzonych rekordów w 5 zakładkach ma
  status „resolved" w bramce ID_BRIDGE).

## Czas i trudności
Ok. 70 minut. Największa trudność: zrozumienie, że zatwierdzone obrazy PO dla
5 z 13 ekranów pochodzą z dev-render z zasymulowanym `?bridge=ok`
(dev-render/screens/finance-id-bridge.tsx), a nie z normalnej nawigacji — bez
przeczytania `FinanceHub.tsx` i `FinanceLegacyBridgeGate.tsx` łatwo byłoby
błędnie ocenić te ekrany jako zwykłe niedopasowanie danych. Dodatkowa trudność:
UI apki losowo przełącza się między PL i EN między kolejnymi ładowaniami tej
samej sesji (nieopisane w tym zleceniu, nie oceniane jako defekt — potraktowane
jako różnica językowa dozwolona instrukcją).
