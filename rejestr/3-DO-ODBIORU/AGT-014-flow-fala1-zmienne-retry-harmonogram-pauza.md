---
id: AGT-014
tytul: Warsztat agenta — zmienne między krokami, ponów przy błędzie, Harmonogram, Odczekaj (pauza)
typ: zadanie
waga: wysoka
obszar: agent
stan: do-odbioru
wlasciciel: wykonawca
blokuje: []
zablokowane_przez: []
zrodlo: "Piotr, 2026-07-26 — koncept graficzny zaakceptowany (\"no tak to wygląda super!!!\"), Fala 1 rekomendacji Mastera"
utworzone: 2026-07-26
---

# AGT-014 — Flow Fala 1: zmienne, retry, harmonogram, pauza

## 1. PROBLEM

Warsztat agenta umiał tylko ręczny start i jedną, prostą ścieżkę bez pamięci
między krokami — żaden krok nie widział wyniku poprzedniego, jedna przejściowa
awaria API liczyła się jak trwała porażka kroku, a jedyny sposób na
zaplanowanie startu w czasie lub wstawienie pauzy nie istniał. Zgłoszone przy
przeglądzie warsztatu na żywym demo, rozpisane w koncepcie graficznym
(artefakt `warsztat-flow-koncept.html`) zaakceptowanym przez Piotra.

## 2. PRZYCZYNA

Silnik `agentPlannerService.executePlan` był płaską pętlą bez interpolacji
zmiennych (wzór istniał w martwym `toolChainExecutor.ts`, nieużywany) i bez
prób ponowienia. Kolumna `ai_agent_plans.scheduled_at` istniała w schemacie
od dawna, ale nic jej nie czytało (fantom). Brak mechanizmu auto-wznowienia
kroku po czasie.

## 3. ROZWIĄZANIE

- **Zmienne między krokami**: `$step.N.pole` (N = numer kroku 1-based)
  rozwiązywane tuż przed wykonaniem, DB trzyma szablon.
- **Ponów przy błędzie**: do 3 prób (400ms odstęp) zanim krok trafi do
  istniejącej ścieżki „failed, plan jedzie dalej" (decyzja Piotra 07-16 —
  plan i tak nigdy nie padał od jednego błędu, to ratuje sam krok).
- **Harmonogram**: nowy status `scheduled`, `POST /:id/schedule`, UI
  „Zaplanuj na termin" (datetime-local) obok „Uruchom proces".
- **Odczekaj (pauza)**: nowy klocek `pauza` reużywający bramkę akceptu —
  `resumeAt` liczony przy pierwszym dotarciu do kroku, auto-zdjęcie przez
  cron zamiast człowieka.
- **Nowy cron** (`agentPlanSchedulerJob.ts`, co 2 min): dispatchuje due
  plany + wznawia due pauzy, przez tę samą kolejkę `AGENT_BACKGROUND_TASK`
  co istniejące ścieżki HTTP.

Pełny koncept i uzasadnienie priorytetyzacji: artefakt
`warsztat-flow-koncept.html` (research n8n/Zapier/Make/Airtable/BPMN 2.0).

## 4. KRYTERIUM ODBIORU

Piotr w warsztacie agenta: (a) wstawia klocek „Odczekaj (pauza)", ustawia
liczbę godzin, widzi ikonę zegara i podpis „X godz." zamiast selecta
narzędzia; (b) w sterowaniu klika „Zaplanuj na termin", wybiera datę/godzinę,
plan przechodzi w status „Zaplanowany"; (c) krok z `$step.1.pole` w
argumencie realnie dostaje wartość z wyniku kroku 1 (widoczne w raporcie
kroku po uruchomieniu).

## 5. DOWODY

- Gałąź `feat/flow-fala1-zmienne-harmonogram-pauza`, wdrożona na demo
  (`ac80c6eeec`, health+gitSha potwierdzone 2026-07-26).
- Backend: 78/78 testów zielonych (executePlan zmienne+retry, schedulePlan,
  listScheduledPlansDue, resumeWaitStep pełny cykl, listWaitStepsDue,
  routes, sideEffectTools) — uruchomione niezależnie przez Mastera.
- Render-verify Mastera (dev-render, light+dark, `case=planning`): przycisk
  „Zaplanuj na termin" + datetime-picker; klocek „Odczekaj (pauza)" z ikoną
  zegara i polem godzin działa w canvasie; paleta pokazuje „Odczekaj (pauza)"
  jako aktywny (nie „Wkrótce") w grupie „Kontrola przebiegu" (5 pozycji,
  było 4); narzędzie `wait_until` widoczne w selectach z sufiksem „(zgoda)".
- ★ Znaleziony i naprawiony PRZED wdrożeniem: druga, niezależna mapa
  `Record<PlanBlockKind,LucideIcon>` w `AgentWorkshopPalette.tsx` (osobna od
  `AgentPlanCanvas.tsx`) nie miała wpisu dla `pauza` — esbuild/eslint tego
  nie łapią (brak type-check), złapane na żywym renderze (reguła #7).
- Konsola przeglądarki: 0 błędów na świeżej karcie (stare logi z karty
  sprzed poprawki myliły — potwierdzone czystym tabem).

## 6. DZIENNIK

- 2026-07-26 — Master: zaimplementowane bezpośrednio (bez delegacji do
  wykonawcy — praca sekwencyjna na jednym pliku silnika, rozdzielenie
  zwiększyłoby ryzyko konfliktów). Zweryfikowane testami + renderem, wdrożone
  na demo. Stan → do-odbioru.
