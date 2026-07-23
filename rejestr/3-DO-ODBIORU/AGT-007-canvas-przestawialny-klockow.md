---
id: AGT-007
tytul: Frontend — przestawialny schemat klocków (dodaj/usuń/przestaw)
typ: zadanie
waga: wysoka
obszar: AGT
stan: do-odbioru
wlasciciel: wykonawca
blokuje: [AGT-009]
zablokowane_przez: []
zrodlo: "SPEC _SPEC_AGENT_VAULT_2026-07-22.md §4 + koncept AGT-005 (zaakceptowany)"
utworzone: 2026-07-22
ekran: agent-plan-canvas
wysokosc: 900
klik: "Przestawiaj klocki, dodawaj/usuwaj kroki."
---

## 1. PROBLEM

Użytkownik nie może ułożyć ani zmienić procesu — panel agenta to liniowa lista tylko-do-odczytu. Nie ma ścieżki ② (ręcznie z klocków) ani przestawiania gotowego schematu ze ścieżki ①.

## 2. PRZYCZYNA

`src/components/AIChat/AgentPlanPanel.tsx` renderuje kroki jako `<ol>` read-only; zero edycji/przestawiania.

## 3. ROZWIĄZANIE

Wg konceptu AGT-005: podnieś panel do **przestawialnego schematu liniowego** — dodaj/usuń/przestaw klocek (v1 liniowy, drag kolejności). Domyślny schemat (**klasyczny 5-fazowy** ze ścieżki ①) ładuje się jako punkt startu; user go modyfikuje. Ścieżka ② = start od pustego. Zapis układu do modelu planu (AGT-006). Trzymaj standard wyglądu (rozstrzygnięcie lista vs powierzchnia robocza wg AGT-005 — panel roboczy → `consultify-artefakty`/`consultify-gestosc`).

## 4. KRYTERIUM ODBIORU

Master robi zrzut (dev-render, bez logowania Piotra): widać schemat klocków; można dodać, usunąć i przestawić klocek; zmiana się utrwala; ścieżka ① pokazuje 5 faz klasycznych od startu, ścieżka ② pusty schemat. Dark+light. Dopiero potem Piotr patrzy.

## 5. DOWODY

Gałąź `feat/agt-007-canvas` (`fe5904604e`, baza origin/demo). Nie pushowana.
- `src/components/AIChat/AgentPlanCanvas.tsx` (nowy) — przestawialny schemat: dodaj/usuń/przestaw (strzałki góra/dół, nie DnD — dostępność, brak biblioteki), rename inline, `<select>` typu (Etap-moduł/AI-Teresa/Vault-kontekst/Bramka).
- `src/config/agentManifests/classicFivePhaseSchema.ts` (nowy) — domyślny 5-fazowy Kubr dla ścieżki ①.
- `src/components/AIChat/AgentPlanPanel.tsx` — przy `status='planning'` renderuje edytowalny canvas; poza tym read-only 1:1 jak wcześniej.
- `dev-render/screens/agent-plan-canvas.tsx` + mocks — harness bez logowania.
- **Master zweryfikował esbuild (browser) 3 plików — zielone.** Wykonawca zweryfikował w dev-render (port 3199): ① 5 klocków klasycznych / ② pusty; reorder/usuń/dodaj/rename/typ; **persystencja po reload (localStorage per planId)**; „Uruchom" zamraża canvas; dark+light tokeny c-*, zero crimson; brak błędów konsoli/sieci.
- ⚠️ **Master odtworzy oficjalny zrzut** (`?screen=agent-plan-canvas`) przed pokazaniem Piotrowi (reguła #7) — TODO finalizacja.
- **BRAK backendowego endpointu edycji kroków** (`agent-plan.routes.ts`: tylko POST/GET/:id/approve/cancel) — edycja lokalna+localStorage jako pomost; realne wpięcie „propozycja→przestaw→Uruchom" = AGT-009 (przesunąć dispatch ZA edycję, bo `createAgentPlan` dispatchuje natychmiast).

## 6. DZIENNIK

**2026-07-22** — utworzone przez Mastera (partia 2). **Odblokowane po akcepcie AGT-005** (zależność usunięta, zablokowane→otwarte). Reguła #7: pierwszy render + zrzut robi Master.
**2026-07-23 — wykonane** (wykonawca, `feat/agt-007-canvas`). Canvas przestawialny + domyślny 5-fazowy schemat, zweryfikowany w dev-render (reorder/add/remove/persist/dark+light, zero błędów). esbuild zielone (Master). → do-odbioru. **★ Do domknięcia w AGT-009:** backend edycji kroków + przesunięcie dispatchu za edycję (dziś `createAgentPlan` dispatchuje od razu). Master odtworzy zrzut przed akceptem Piotra.
