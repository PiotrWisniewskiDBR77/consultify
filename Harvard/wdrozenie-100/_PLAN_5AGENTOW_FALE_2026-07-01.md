# PLAN REALIZACJI — 5 agentów, fale, systematyczna przebudowa
**Data:** 2026-07-01 | **Autor:** Harvard Strateg (koordynator fal)
**Spec (kontrakt):** [ARTIFACT_ANATOMY_STANDARD](ARTIFACT_ANATOMY_STANDARD.md) · **Bugi:** [RAPORT_UIUX_WALKTHROUGH](RAPORT_UIUX_WALKTHROUGH_2026-06-30.md) · **Tokeny:** [RESKIN_AUDIT](RESKIN_AUDIT_2026-06-30.md)
**Tablica statusu (żywa):** [`_AGENCI/_STATUS.md`](_AGENCI/_STATUS.md)

---

## 0. Dwie zasady, które ratują nas przed dotychczasowymi błędami

**Zasada A — Zero utraty kontekstu.** Praca NIE żyje w rozmowie. Każdy agent ma **zlecenie na dysku** (`_AGENCI/agent-X.md`) = kompletny, samowystarczalny brief. Agent, który straci kontekst, **czyta swoje zlecenie i wznawia**. Po każdym zadaniu dopisuje raport do zlecenia. Stan = na dysku, nie w głowie.

**Zasada B — Zero kolizji git.** 5 agentów NIGDY nie pracuje we wspólnym drzewie (to był bug klobrowania commitów). Każdy agent = **osobny worktree + branch `reskin/agent-X/wave-N`**. Klastry są **rozłączne plikowo** → merge zawsze czysty. Strateg merguje po każdej fali.

---

## 1. Podział na 5 agentów (klastry rozłączne plikowo) — POKRYCIE PEŁNE

> Poprawione: klastry pokrywają WSZYSTKIE moduły sidebara + footer + public. Powłoka aplikacji → Fala 0 (bo współdzielona). Nic nie zostaje bez właściciela.

| Agent | Klaster (wszystkie moduły) | Główne katalogi (własność wyłączna) |
|-------|----------------------------|-------------------------------------|
| **A1** | My Work + Notifications + Inbox/Calendar | `src/components/MyWork/**` |
| **A2** | Interview + Tools + Assessment + **Audits** | `src/components/Interview/**` · `src/components/DiscoveryTools/**` · `src/views/discovery-tools/**` · `src/components/assessment/**` · `src/components/Audit/**` |
| **A3** | Initiatives + Execution + **Meeting** | `src/components/Initiatives/**` · `src/components/Execution/**` · `src/components/Portfolio/**` · `src/components/Meeting/**` |
| **A4** | Results + Finance + **Admin/Org/SuperAdmin/Settings/Internal Tools** | `src/components/Benefits/**` · `src/components/Results/**` · `src/components/Economics/**` · `src/components/Admin/**` · `src/views/superadmin/**` · `src/views/settings/**` |
| **A5** | Materiały + Chat + Studio + **Public (Landing/onboarding/auth)** + sieroty (KB/Legal/Partner/Context) | `src/components/DocumentStudio/**` · `src/components/Presentations/**` · `src/components/AIChat/**` · `src/components/Studio/**` · `src/views/legal/**` · `src/views/ContextBuilder/**` · public/landing |

**Agent = ten sam klaster przez WSZYSTKIE fale** — utrzymuje kontekst terytorium, zero cross-agent konfliktów.
**Uwaga obciążenia:** A4 i A5 są cięższe (dołożone footer/public). Jeśli za dużo — rozbijamy footer-admin na osobną rotację po golden-path (patrz §4b).

---

## 2. Fala 0 — FUNDAMENT (blokująca, PRZED równoległością)

> Wszystko downstream importuje te komponenty. Musi wylądować i być podpisane ZANIM ruszą A1-A5. Wykonawca: **1 agent (Foundation) pod nadzorem Strega**, bo to wąskie gardło (mało plików, wysoka kontencja).

**Deliverables (kolejność):**
1. **Bramka tokenów** — ESLint reguła: zakaz `navy-*`/`slate-*`/hex w NOWYM kodzie (§9.3).
2. **40 komponentów współdzielonych do specu §9** (`src/components/ui/**`, `src/components/shared/**`): Button · chip Menu 3 · pill-tab Menu 2 · badge · input · **ColumnSelector (Edit Columns fix)** · checkbox · kebab · drawer · modal · toast · tooltip · progress · avatar · stepper · itd.
3. **POWŁOKA APLIKACJI** (`MainLayout` · `Sidebar` · global topbar · `ModuleHub` · `ModuleNavBar`) → tokeny `c.*`. Promieniuje na wszystkie moduły — dlatego w Fali 0, nie w klastrze.
4. **EDITOR SHELL (D-I)** — wspólna powłoka canvasu (`editor-shell-canon`). Canvas-artefakty A1/A2/A5 (Ideas/Tools/Studio) budują na niej w Fali 2. Reconcile z priorytetem #1 D-I.
5. **Fixy systemowe (radiują):** selection=neutral/blue (SYS-1), Menu 2 pill (A-2), Edit Columns (A-4), chipy Menu 3 w ramkach (A-3).
6. **STAGE-BLOCKER: skrypt czyszczący dane testowe** (E2E/DEMO/Debug) na demo.
7. **Przemianować Menu 1/2/3 → AppBar/ModuleTabs/CommandRow** (footgun) — kod + spec.
8. **Weryfikacja ikon §13** — potwierdzić/przypisać ikony lucide per artefakt (dziś propozycja).

**Bramka G0:** build zielony + 40 komponentów + powłoka + editor-shell zgodne z §9 + Piotr widzi je na demo. Bez G0 fale 1-3 nie startują.

---

## 3. Fale 1-3 — RÓWNOLEGŁE (A1-A5 jednocześnie, każdy swój klaster)

Każdy agent w każdej fali bierze swój klaster i doprowadza JEDEN typ powierzchni do specu, używając komponentów z Fali 0.

| Fala | Typ powierzchni | Spec | DoD |
|------|-----------------|------|-----|
| **1** | LISTY / tabele | §14 | Parity Gate §14.7 (9 czerwonych MUST) |
| **2** | ARTEFAKTY | §11.2 + §13 | DoD Artefaktu §18.1 |
| **3** | INSTRUMENTY + HUBY + CHAT | §15 / §17 / §16 | DoD Instrumentu §18.2 |

**Cykl fali (dla każdego agenta):**
1. Czyta swoje zlecenie `_AGENCI/agent-X.md` + sekcję specu dla fali.
2. Reskin swojego klastra wg specu (własny worktree/branch).
3. `vite build` lokalnie → self-audit wg DoD.
4. Dopisuje **raport** do swojego zlecenia (co zrobione, pliki, screeny, co pominięte).
5. Aktualizuje `_AGENCI/_STATUS.md`.

**Bramka końca fali (Strateg + Piotr):**
- Strateg merguje 5 branchy (czysto — rozłączne pliki) → build → deploy demo.
- Piotr **przechodzi przeskinowane ekrany** (loop koduj→przejdź→popraw).
- Zielono → następna fala. Regresja → runda poprawek w tej fali.

---

## 4. Fala 4 — HARTOWANIE (integracja, mniej agentów)

Po falach 1-3 cała powierzchnia jest w kanonie (dark). Fala 4 = cross-cutting §19:
- Budżet perf (latencja + ładowanie).
- Copy pustych stanów + błędów (napisane, PL+EN).
- Sygnatura wizualna (moment „wow").
- Próba generalna golden-path.

## 4a. Fala 5 — LIGHT MODE (pełne 100% = oba tryby)

Dark-first przez fale 0-4. Fala 5 = A1-A5 przechodzą swoje klastry w light mode (tokeny już dwutrybowe z §9, więc to głównie weryfikacja + korekty antywzorców: `dark:bg-slate-50`, `bg-white/80` itd. z RESKIN_AUDIT). DoD: każdy ekran czytelny w light. **Bez tego NIE ma 100% UI/UX.**

## 4b. Rotacja footer/admin (jeśli A4/A5 przeciążone)

Admin/Org/SuperAdmin/Settings/Internal Tools + Public/sieroty mają niższy priorytet demo. Jeśli A4/A5 nie wyrabiają w falach 1-3, te obszary idą jako **osobna rotacja po golden-path** (ci sami agenci, dodatkowy przebieg) — ale MUSZĄ być zrobione przed deklaracją 100%.

---

## 5. Anty-utrata-kontekstu — artefakty na dysku

```
Harvard/wdrozenie-100/_AGENCI/
├── _STATUS.md          ← żywa tablica: fala × agent × stan (jedyne źródło prawdy o postępie)
├── _PROTOKOL.md        ← reguły dla każdego agenta (git, DoD, jak wznowić po utracie kontekstu)
├── agent-A1.md         ← zlecenie A1: klaster, pliki, zadania per fala, RAPORTY (dopisywane)
├── agent-A2.md
├── agent-A3.md
├── agent-A4.md
└── agent-A5.md
```

**Reguła wznowienia:** agent bez kontekstu czyta `_PROTOKOL.md` + własne `agent-X.md` + `_STATUS.md` → wie dokładnie gdzie jest i co dalej. **Nigdy nie polegamy na pamięci rozmowy.**

**INWENTARZ POKRYCIA (anty-ciche-pominięcie):** `_STATUS.md` zawiera listę **KAŻDEGO ekranu/powierzchni w aplikacji** (nie klastrów — pojedynczych ekranów), z kolumnami: powierzchnia · agent · fala · DoD-passed. 100% = każdy wiersz zielony. Ekran bez wiersza = nie istnieje w oczach planu → dlatego inwentarz budujemy z realnego routingu (skan agenta), nie z pamięci. To jest mechanizm, który udowadnia 100% — bez niego „wygląda na zrobione" ≠ „zrobione".

---

## 6. Git — dokładny model (bez kolizji)

- Baza: aktualny branch roboczy (`feat/deliverables-w1`).
- Każdy agent: `git worktree add ../reskin-A1 -b reskin/agent-A1/wave-1` (izolowana kopia).
- Rozłączne pliki → zero konfliktów między agentami.
- Po fali: Strateg `merge` 5 branchy → build → demo. Commity per ścieżka, nigdy `-A`.
- PROD (centerbeam) NIETKNIĘTY bez jawnej zgody Piotra. Demo/stage only.

---

## 7. Kolejność uruchomienia (co robimy)

1. **Teraz:** Strateg tworzy `_AGENCI/` (protokół + status + 5 zleceń) — scaffolding.
2. **Fala 0:** 1 agent Foundation → G0 (Piotr podpisuje 40 komponentów).
3. **Fala 1:** wypuszczamy A1-A5 równolegle (worktree) → merge → demo → odbiór.
4. **Fala 2, 3, 4:** jak wyżej, ten sam podział.

**Definicja końca (BRAMKA 100% UI/UX):**
- [ ] Inwentarz pokrycia: **każdy ekran** ma wiersz w `_STATUS.md`, wszystkie zielone
- [ ] Każda LISTA przechodzi Parity Gate §14.7
- [ ] Każdy ARTEFAKT przechodzi DoD §18.1
- [ ] Każdy INSTRUMENT przechodzi DoD §18.2
- [ ] Chat (§16) + Huby (§17) w kanonie
- [ ] Powłoka + editor-shell w tokenach `c.*`
- [ ] Cross-cutting §19 (perf, copy, a11y, motion, gęstość) spełnione
- [ ] **Oba tryby** (dark + light) czytelne
- [ ] Zero `navy-*`/`slate-*`/hex poza tokenami (ESLint zielony)
- [ ] Zero danych testowych w prod; zero błędów ładowania na golden-path
- [ ] Odebrane przez Piotra ekran-po-ekranie

Dopiero gdy WSZYSTKIE ✅ = **100% założeń graficznych UI/UX osiągnięte**.

## 9. Handoff do Harvard (funkcjonalność)
Po bramce 100% UI/UX aplikacja jest wizualnie kompletna → wracamy do programu Harvard (dokończenie funkcjonalności / 4 tory / złota ścieżka L1-L4). UI/UX przestaje być zmienną — każdy nowy ekran funkcjonalny tylko składa gotowe komponenty (CANON §1). To jest właściwa kolejność: **najpierw stabilny język wizualny, potem funkcje na nim**, nie odwrotnie.

---

## 8. Skala (uczciwie)
5 agentów × 4 fale = 20 przebiegów + Fala 0 + hartowanie. To NIE jeden wieczór — ale jest **systematyczne, odporne na utratę kontekstu i równoległe**. Każda fala daje widoczny, odebrany postęp na demo. Nie „plan na plan" — to maszyna wykonawcza.

---

## Następny ruch
Powiedz „scaffolduj" → tworzę `_AGENCI/` (protokół, tablica, 5 zleceń) i przygotowuję Falę 0 do wypuszczenia. Wtedy wypuszczamy agentów.
