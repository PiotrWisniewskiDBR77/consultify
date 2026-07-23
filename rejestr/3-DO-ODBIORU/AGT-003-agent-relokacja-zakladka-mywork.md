---
id: AGT-003
tytul: Agent → zakładka My Work (relokacja z menu głównego)
typ: zadanie
waga: wysoka
obszar: AGT
stan: do-odbioru
wlasciciel: wykonawca
blokuje: [AGT-004]
zablokowane_przez: []
zrodlo: "Piotr 2026-07-22 (Run agent jako funkcja My Work) + audyt origin/demo; przepisane z D11 przez Mastera"
stare_id: D11
utworzone: 2026-07-21
---

## 1. PROBLEM

„Run agent" to osobna pozycja w menu głównym. Piotr: ma być **kawałkiem My Work**, nie osobnym modułem.

## 2. PRZYCZYNA

Zadanie budowlane (relokacja powierzchni — NIE dotyka generatora procesu, który jest partią 2). Agent renderuje `src/views/AgentPlanView.tsx:31` → `AgentPlanWorkspace`. Pozycja sidebara `src/components/navigation/Sidebar/menuConfig.ts:88-95` (blok `AGENT_PLAN`). My Work: `MyWorkHub.tsx` (jak w VLT-004).

## 3. ROZWIĄZANIE

1. Rozszerz `ModuleTab` (`MyWorkHub.tsx:188`) o `'agent'`; wpis w `allTabs` (ikona `Bot`); `case 'agent'` w `renderListContent` renderujący `AgentPlanWorkspace`.
2. Dodaj `agent` do `parseMyWorkPath` → `#my-work?tab=agent`.
3. Usuń pozycję sidebara `AGENT_PLAN` z `menuConfig.ts:88-95` (+ etykieta). Route `/agent-plan` zostaw jako redirect na zakładkę.
Sama relokacja — funkcjonalność „katalog 31 manifestów" zostaje jak jest; generator procesu to partia 2 (osobne, nowe AGT-*).

## 4. KRYTERIUM ODBIORU

Master robi zrzut: w menu głównym NIE ma osobnej pozycji „Run agent"; w My Work jest zakładka „Agent", która pokazuje ten sam launcher/panel agenta; stary link `/agent-plan` przenosi do zakładki. Zrzuty dark+light. Dopiero potem Piotr patrzy.

## 5. DOWODY

Gałąź `feat/relokacja-mywork2` (`81ab993a0b`, baza origin/demo). Nie pushowana.
- `MyWorkHub.tsx`: `ModuleTab`+`'agent'` (`:216`), lazy `AgentPlanWorkspace` (bez pośredniego `AgentPlanView`), wpis zakładki „Run agent" (Bot) gejtowany `isAgentPlanEnabled()`, `case 'agent'`→`<AgentPlanWorkspace/>` (`:3697`), deep-link `?tab=agent` (`:473`).
- `menuConfig.ts`: usunięty wpis sidebara `AGENT_PLAN`. `AppRoutes.tsx` (`:1293`): `/agent-plan` → `<Navigate to="/my-work?tab=agent" replace/>`.
- Relokacja sama — katalog manifestów/plan builder bez zmian (generator = AGT-006).
- **Master zweryfikował esbuild — zielone.** Wykonawca: sonda runtime `getMenuStructure()` → `AGENT_PLAN present: false`. eslint 0 nowych.
- ⚠️ **Zrzut zakładki „Agent" w My Work — TODO Master** (ten sam powód co VLT-004: MyWorkHub wymaga providerów/backendu).

## 6. DZIENNIK

**2026-07-22 — przepisane przez Mastera z placeholdera D11.** Zakres = sama relokacja Agent→My Work. **Odblokowane od AGT-001/AGT-002** (te były wejściem do GENERATORA procesu — partia 2, nie do przeniesienia zakładki; relokacja ich nie potrzebuje). Stan zablokowane→otwarte. SSOT: `_SPEC_AGENT_VAULT_2026-07-22.md`.
**2026-07-23 — wykonane** (wykonawca, `feat/relokacja-mywork2`, wspólnie z VLT-004). Zakładka Agent w My Work, `/agent-plan`→redirect, pozycja zdjęta z menu (sonda runtime potwierdza). esbuild zielone (Master). → do-odbioru. Zrzut do zrobienia przez Mastera (reguła #7). Uwaga: AGT-004 (lista „moje agenty" w My Work) nadal zależy od tej zakładki — pozostaje w kolejce.
