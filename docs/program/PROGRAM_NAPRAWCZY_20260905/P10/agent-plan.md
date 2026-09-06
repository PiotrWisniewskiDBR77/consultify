# Plan agenta — kontrakt karty N (P10-B6, DEC-429)

> **Pomiar na żywo obalił dwa zapisy inwentarza.** `INWENTARZ_KART_N_PELNY.md` §2 wiersz #10 mówi:
> „otwarcie `/agent-plan` (flaga `agentPlanFlag`, **domyślnie OFF**) … montowany z
> `src/views/AgentPlanView.tsx:60`". Zmierzone 06.09.2026 (vite 3141 z `mvp/p10b6-moja-praca`,
> API `127.0.0.1:4100`, DBR77):
>
> 1. **Flaga jest domyślnie ON, nie OFF** — `src/utils/agentPlanFlag.ts:38-49`: `readEnvFlag()`
>    zwraca `parsed === null ? true : parsed`, a `VITE_AGENT_PLAN` nie występuje w `server.env`
>    stanowiska. (To kształt „heurystyka domyślnej flagi kłamie" — ostatni `return false` w tym
>    pliku jest gałęzią `catch`, nie domyślną.)
> 2. **Trasa `/agent-plan` nie prowadzi do karty** — `src/routes/AppRoutes.tsx:1702-1705` to
>    `<Navigate to={ROUTES.MY_WORK} replace />`. Zrzut: `evidence/p10b6/10-agent-plan.png`,
>    `.json` → `url` = `http://127.0.0.1:3141/my-work`. Stan flagi nie ma tu znaczenia: przekierowanie
>    jest bezwarunkowe i zachodzi zanim `AgentPlanView` się zamontuje.
>
> **Wniosek: karta jest dziś nieosiągalna dla użytkownika.** To nie usterka — to wykonana decyzja
> właściciela („05.09.2026: Agent poza MVP (decyzja właściciela)", komentarz przy trasie,
> `AppRoutes.tsx:1697`), potwierdzona usunięciem zakładki „Agent" z Menu 2
> (`MyWorkHub.tsx:222-223`, `:4304`).

## §0. Tożsamość

| pole | wartość |
|---|---|
| nazwa PL | Plan agenta (warsztat agenta) |
| moduł | `07_MY_WORK_AGENT` — **poza MVP** (decyzja właściciela 05.09.2026) |
| archetyp | **A — Canvas** w stanie „plan" (trzy kolumny: sterowanie · schemat · paleta); **C — Rekord** w stanie „launcher" |
| trasa | `ROUTES.AGENT_PLAN = '/agent-plan'` (`routeConfig.ts:63`) → **przekierowanie na `/my-work`** (`AppRoutes.tsx:1702-1705`) |
| jak otworzyć z listy | **NIE DA SIĘ** — brak wejścia w menu (`menuConfig.ts:318` ma samą etykietę „Uruchom agenta", bez pozycji w liście modułów) |
| komponent | `src/components/AIChat/AgentPlanWorkspace.tsx:29` (63 linie) → `AgentManifestLauncher.tsx` (186) albo `AgentPlanPanel.tsx:29` (548) |
| jedyny wołacz produkcyjny | `src/views/AgentPlanView.tsx:60` — sam nieosiągalny (patrz wyżej) |
| drugi wołacz | `src/components/AIChat/AgentHubShell.tsx:1758` — komponent **bez ani jednego importera** (`INWENTARZ_KART_N_PELNY.md` §2, „karty martwe") |
| powłoka | brak powłoki karty N; sam `ArtifactRightPanel` w stanie launcher/ładowanie (`AgentPlanWorkspace.tsx:44`, `AgentPlanPanel.tsx:478`) |
| rejestr | poza — i poza listą 22 kart (ani w `KartaNKey`, ani wśród 9 jawnych wyjątków `registry.kompletnosc.test.ts:30-40`) |

**Martwy komentarz do usunięcia:** nagłówek `AgentPlanWorkspace.tsx:11-12` twierdzi „it is NOT yet
mounted anywhere in the app shell" — `AgentPlanView.tsx` powstał później i go montuje. Komentarz
mówi dziś nieprawdę w drugą stronę niż rzeczywistość.

## §1. SEKCJE (kontrakt zamrożony — do odmrożenia razem z modułem)

Kontrakt sekcji **nie istnieje** (K1 ✗). Stan „plan" nie ma nawet sekcji panelu — to trzy kolumny
zbudowane inline (`AgentPlanPanel.tsx:504-546`). Stan „launcher" ma jedną, niezwijalną sekcję
„Agenci" (`AgentPlanWorkspace.tsx:47-53`).

| sekcja | po co użytkownikowi | źródło danych (API → writer) | reguła pustki | kolejność | S/L |
|---|---|---|---|---|---|
| Katalog agentów (stan przed planem) | wybór gotowego agenta z 31 | manifesty agentów → `AgentManifestLauncher.tsx` (`agentPlan.api.ts`) | brak agentów → „Wczytywanie agentów…" / powód | 1 | S |
| Sterowanie | uruchom, zatrzymaj, zatwierdź krok | `POST /:id/run`, `POST /:id/approve-step`, `cancelAgentPlan` (`server/src/routes/ai/agent-plan.routes.ts`) | plan w stanie `planning` → widoczne tylko „Uruchom" | 2 | L |
| Schemat procesu | co agent zrobi, krok po kroku | kroki planu → `PATCH /:id/steps` (`updateAgentPlanSteps`) | zero klocków → paleta + podpowiedź | 3 | L |
| Paleta klocków | dokładanie kroków z rejestru narzędzi | `AGENT_BLOCK_ENTRIES` (statyczny rejestr) | — | 4 | L |
| Aprobaty | kroki czekające na zgodę człowieka | `requiresApproval` na kroku → `POST /:id/approve-step` | zero → „Brak kroków oczekujących na akceptację" (`agentPlan.approvals.empty`) ✓ | 5 | L |
| Raport | wynik po zakończeniu | pole raportu planu → `GET /:id` | „Raport dostępny po zakończeniu" ✓ | 6 | L |

## §2. PRAWY PANEL

W stanie „plan" **panelu nie ma** (K6–K11 ✗) — `ArtifactRightPanel` żyje tylko w launcherze
(`AgentPlanWorkspace.tsx:44-55`) i w stanie ładowania (`AgentPlanPanel.tsx:478-492`, sekcja
o etykiecie na sztywno `'Wczytywanie'`, poza `t()`).
Kontrakt po odmrożeniu: Akcje · **tabela** Właściwości (Status planu → Właściciel → Agent →
Uruchomiono → Zakończono → Źródło zlecenia) · Powiązania (obiekty utworzone przez agenta) ·
Źródła i założenia (czym agent się karmił) · Historia (dziennik kroków). Komentarze — wolno
pominąć z powodem „plan wykonawczy, nie dokument do dyskusji".

## §3. MENU 5 I NAWIGACJA

Nie istnieje (K12 ✗) — karta nie ma ani Menu 2, ani 3, ani 4, ani 5; `AgentPlanView` rysuje własną
belkę z tytułem i akapitem (`AgentPlanView.tsx:43-58`). Kontrakt po odmrożeniu: pasek modułu
z pigułką `Plan agenta · <tytuł planu>`, Sekcje ▾, Edycja/Podgląd (plan w trakcie wykonania =
tylko do odczytu, z powodem), Pracuj z AI ▾.

## §4. AI

Karta **nie ma** `PracujZAI` ani `useCardAIAnalysis`; nie ma też wpisu w `CardAnalysisArtifactType`
(K21/K24 ✗). Sytuacja jest tu szczególna: **treść karty i tak generuje silnik** (`PlanBuilder`),
więc trzy kanoniczne pozycje mają wołać generator planu — tak samo jak rozstrzygnięto dla `plan`
i `capacity_analysis` w tabeli K24 SSOT.

| sekcja | Analizuj | Uzupełnij tę sekcję | Uzupełnij cały dokument | tylko do odczytu |
|---|---|---|---|---|
| Schemat procesu | czy schemat ma bramkę akceptu przed krokiem o skutkach ubocznych; czy kroki mają wejścia | dołóż brakujący krok w zaznaczonym miejscu | wygeneruj cały schemat z opisu zlecenia (`PlanBuilder`) | kroki już wykonane |
| Sterowanie / Aprobaty / Raport | — | — | — | wszystko (stan wykonania) |

Teresa tylko Menu 1 — ✓ (karta nie ma własnego wejścia do czatu).

## §5. CZYTELNOŚĆ

* `grep -c "primary-[0-9]"` w `AgentPlanWorkspace.tsx`, `AgentPlanPanel.tsx`, `AgentPlanView.tsx`
  = **0** ✓.
* **i18n ✗ — literały poza `t()`** w `AgentPlanPanel.tsx`: `'Schemat procesu'` (`:523`),
  `{executableCount === 1 ? 'krok' : 'kroków'}` (`:526`), `' · schemat zatwierdzony'` (`:527`),
  `'Paleta klocków agenta'` (`:542`), `label: 'Wczytywanie'` (`:484`). W angielskim UI zobaczy je
  po polsku. Do przeniesienia do `public/locales/{pl,en}` — 163 klucze `agentPlan.*` już istnieją
  i są przetłumaczone, te pięć zostało poza nimi.
* Reszta (`AgentPlanView.tsx`, `AgentPlanWorkspace.tsx`) idzie przez `t()` ✓.
* 1440/1280: niezmierzone — ekranu nie da się otworzyć.

## §6. STAN ZASTANY vs KONTRAKT (K1–K30)

Mierzone z kodu + jeden zrzut dowodzący przekierowania. `n/d` = ekran nieosiągalny.

| K | stan | dowód |
|---|---|---|
| K1 kontrakt sekcji | ✗ | brak katalogu i brak `StandardSekcjaDef` |
| K2 steruje renderem | ✗ | — |
| K3 źródło danych | ✓ | `server/src/routes/ai/agent-plan.routes.ts` + `src/services/api/agentPlan.api.ts` |
| K4 reguła pustki | ✓ | „Brak kroków oczekujących na akceptację", „Raport dostępny po zakończeniu" |
| K5 etykiety/kolejność | ✗ | brak kontraktu |
| K6–K11 prawy panel | ✗ | panel tylko w launcherze; w stanie „plan" go nie ma |
| K12 Menu 5 | ✗ | — |
| K13 spis sekcji | ✗ | — |
| K14 Edycja/Podgląd | ✗ | — |
| K15 sticky | n/d | — |
| K16 drabina S/L | ✗ | klasa nieprzypisana (karta poza rejestrem) |
| K17 zero `primary-*` | ✓ | grep = 0 (3 pliki) |
| K18 fokus `c-focus` | ~ | do zweryfikowania w `AgentWorkshopControls`/`AgentPlanCanvas` |
| K19 pigułka | ✗ | brak paska modułu |
| K20 1440/1280 | n/d | ekran nieosiągalny |
| K21 „Pracuj z AI" | ✗ | brak |
| K22 propozycja → Zatwierdź | ✓ (inny mechanizm) | bramka akceptu kroku (`AgentPlanPanel.tsx:33-38`) — właściwa doktryna, poza wspólnym komponentem |
| K23 po polsku / wg praw | ✗ | patrz §5 |
| K24 deklaracja AI per typ | ✗ | poza `CardAnalysisArtifactType` |
| K25 i18n | ✗ | 5 literałów poza `t()` |
| K26 podgląd → „Otwórz" | ✗ | **brak jakiegokolwiek wejścia** |
| K27 Teresa tylko Menu 1 | ✓ | brak wejścia w karcie |
| K28 identyfikatory | n/d | — |
| K29 błędy konsoli | n/d | — |
| K30 odbiór na zrzucie | **n/d** | `evidence/p10b6/10-agent-plan.png` dowodzi przekierowania, nie karty |

**Wynik: ✓ 5 · ~ 1 · ✗ 17 · n/d 7 z 30.**

## §7. LUKI → NAPRAWA

Kontrakt tej karty jest **zamrożony razem z modułem Agent** (poza MVP, decyzja właściciela 05.09).
Nie proponuję pracy nad powłoką, Menu 5 ani AI, dopóki karta nie ma wejścia — to byłaby praca
włożona w ekran, którego nikt nie zobaczy (ten sam błąd co `AgentHubShell`: powłoka standardu
na martwym komponencie).

| # | luka | rozmiar | robić teraz? |
|---|---|---|---|
| 1 | poprawić inwentarz: flaga **ON**, trasa = przekierowanie, karta nieosiągalna | S | **tak — zrobione tym dokumentem** |
| 2 | usunąć nieprawdziwy komentarz `AgentPlanWorkspace.tsx:11-12` („NOT yet mounted") | S | tak, przy najbliższym dotknięciu pliku |
| 3 | 5 literałów poza `t()` w `AgentPlanPanel.tsx` (K25) | S | tak — tanie, niezależne od odmrożenia |
| 4 | powłoka karty N + prawy panel + Menu 5 + `PracujZAI` + wpis do rejestru | L | **nie — po odmrożeniu modułu** |
| 5 | rozstrzygnąć los `AgentHubShell.tsx` (1801 linii, zero importerów, stoi na `StandardArtifactShell`) | M | nie — razem z #4 |

**Pytanie do właściciela (1):** czy „Plan agenta" ma w ogóle pozostać w inwentarzu 72 kart N,
skoro moduł Agent jest poza MVP, trasa przekierowuje, a jedyny drugi wołacz jest martwy?
**Rekomendacja: zostawić w inwentarzu z jawnym statusem „ZAMROŻONA — poza MVP", z tym kontraktem
jako zapisem stanu**, i nie wydawać ani jednego dyżuru na jej powłokę do czasu odmrożenia.
Alternatywa (usunąć kod razem z `AgentHubShell`) oszczędza ~2400 linii, ale wyrzuca działający
silnik `PlanBuilder` — dlatego jej nie rekomenduję.
