---
id: AGT-010
tytul: Run agent — powłoka z 2 zakładkami + tabela „Moje procesy"
typ: zadanie
waga: wysoka
obszar: AGT
stan: do-odbioru
wlasciciel: wykonawca
blokuje: [AGT-011]
zablokowane_przez: []
zrodlo: "Piotr 2026-07-24 (zrzut demo): wejście w Run agent ma pokazywać tabelę pozycji jak Decisions, nie od razu listę 31 gotowców"
utworzone: 2026-07-24
---

## 1. PROBLEM

Wchodząc w zakładkę **Run agent** trafiasz od razu w listę 31 gotowych agentów. Brakuje warstwy pośredniej. Masz **wiele uruchomionych/zapisanych procesów** — powinno być jak w Decisions: zakładka → tabela pozycji → wejście do jednego.

## 2. PRZYCZYNA

`MyWorkHub.tsx` — `case 'agent'` renderuje `AgentPlanWorkspace` bezpośrednio (od razu launcher). Brak warstwy listy. Endpoint `GET /api/ai/agent-plan` (`listAgentPlans`) istnieje, ale żaden ekran go nie konsumuje (to samo znalezisko co AGT-004).

## 3. ROZWIĄZANIE

Decyzja Piotra: **dwie zakładki wewnątrz Agenta — „Moje procesy" + „Szablony"** (Szablony = AGT-011). To zadanie robi powłokę + „Moje procesy":
1. Powłoka zakładki `agent` z pod-zakładkami „Moje procesy" | „Szablony" (kanon `consultify-triada`/`consultify-gestosc`).
2. **„Moje procesy"** = tabela z `listAgentPlans` (kolumny: nazwa, status planning/executing/awaiting_approval/completed, postęp kroków, data). Wejście w wiersz → `AgentPlanWorkspace`/canvas tego planu.
3. Przycisk **„Nowy proces"** → generator kładzie domyślny klasyczny 5-fazowy w trybie `draft` (plan zostaje w `planning`, canvas do przestawienia) — reużyj flow AGT-006/AGT-009.
Konsumuje AGT-004 (lista planów) — po wdrożeniu AGT-010 zadanie AGT-004 domknąć jako pokryte.

## 4. KRYTERIUM ODBIORU

Master zrzut: wejście w Run agent pokazuje dwie zakładki; „Moje procesy" = tabela uruchomionych/zapisanych planów ze statusem i postępem; klik w plan otwiera jego canvas/panel; „Nowy proces" kładzie klasyczny 5-fazowy schemat w trybie edycji. Dark+light. Dopiero potem Piotr.

## 5. DOWODY

Gałąź `feat/agt-010-powloka` (`f32f66fc60`, `cb970238eb`, baza origin/demo). Nie pushowana.
- `src/components/AIChat/AgentHubShell.tsx` (nowy) — `StandardModuleBar` (pigułki „Moje procesy"/„Szablony" + CTA „Nowy proces") + `StandardTable` nad `listAgentPlans({mine:true})`: nazwa / status (`EntityStatusChip`) / postęp x/5 / data. Kebab: „Otwórz" + „Anuluj" (disabled na terminalnych). „Szablony" = placeholder pod AGT-011.
- Klik w wiersz → istniejący `AgentPlanWorkspace` z `initialPlanId` (canvas AGT-006/007/009 **adoptowany 1:1**, bez przebudowy).
- „Nowy proces" → `createAgentPlan({processId:'classic-5', draft:true})` → plan zostaje w `planning`, canvas edytowalny od razu (flow AGT-009).
- `MyWorkHub.tsx` — `case 'agent'` renderuje `AgentHubShell` (zmiana minimalna, `case 'vault'` nietknięty).
- `src/services/api/agentPlan.api.ts` — dodane `processId`/`processContext` do typu (backend już wspierał).
- `dev-render/screens/agent-hub.tsx` + mocks (5 planów, wszystkie statusy), `?screen=agent-hub`.
- **Master zweryfikował: zrzut powłoki** — 2 pigułki, CTA „Nowy proces", tabela 5 procesów ze statusami Planning/Executing/Awaiting approval/Completed/Failed (tony info/warning/success/danger) i postępem x/5. Wykonawca: „Otwórz" otwiera canvas z 5 klockami, „Nowy proces" tworzy draft, dark+light, konsola czysta. esbuild+eslint 0 nowych.

**Pokrywa AGT-004** (lista planów — `listAgentPlans` ma wreszcie realnego konsumenta) → AGT-004 domknąć jako zrealizowane tym zadaniem.
**Do domknięcia po deployu:** zrzut z żywego demo.

## 6. DZIENNIK

**2026-07-24** — utworzone przez Mastera z uwagi Piotra (zrzut demo). Decyzja: 2 zakładki (Moje procesy | Szablony). Baza: origin/demo (partia AGT wdrożona `7b1ba021c2`). Wzór: `case 'decisions'` + `consultify-triada`.
