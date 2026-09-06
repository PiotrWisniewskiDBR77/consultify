# Karta pracy — zadanie/decyzja w Realizacji (`execution-work-doc`)

**Status:** PROPOZYCJA — do słowa właściciela. Pomiar 06.09.2026 na HEAD (kod zmienił się dziś,
1.12-R1/R1b/R2 DEC-427 — zakładka „Praca” jest teraz na realnych danych).

## §0. Tożsamość

- Nazwa PL: **element pracy** — zadanie LUB decyzja kanonicznego rejestru `runtime-v1`
  Realizacji (NIE to samo, co karty `task`/`decision` z Mojej Pracy — patrz §7, duplikat).
- Moduł: `06_EXECUTION`. Archetyp: **C — Rekord** (tożsamość = `row.id` realnego zadania/decyzji
  `execution-cases/:caseId/tasks|decisions/:id`, wersjonowany, z realnymi zapisami — spełnia
  regułę record-identity z `_wzorzec-raport-dokument.md`, choć to NIE dokument-migawka, tylko
  rekord roboczy).
- Otwarcie: `/execution` → zakładka **Praca** → wiersz → „Otwórz zadanie"/„Otwórz decyzję"
  (kebab albo dwuklik) → `documentId` prop (`ExecutionWorkSurface.tsx:408,412`), scalany w
  `ExecutionHub.tsx:2865` jako `work:<executionCaseId>:<id>`, montowanie `ExecutionHub.tsx:6023-6033`.
- Komponent: `src/components/Execution/ExecutionWorkSurface.tsx:404` (1354 linie; tryb dokumentu =
  gałąź `documentId` w tym samym komponencie co lista, nie osobny plik — inwentarz to poprawnie
  oznaczał jako „do rozstrzygnięcia"; rozstrzygnięcie: JEST kartą, bo ma tożsamość i osobny,
  realny writer, mimo że mieszka w jednym pliku z listą).
- Powłoka dziś: **żadna standardowa** — `<section>` z obramowaniem (`ExecutionWorkSurface.tsx:1172`),
  renderuje `CanonicalWorkHardeningPanel` (`shared/CanonicalWorkHardeningPanel`) — komponent
  odziedziczony z innego kontekstu (utwardzanie pracy), nie `ArtifactRightPanel`/`NModeShell`.
- Rekord: dwie encje `runtime-v1` — `TASK` i `DECISION` (server: `executionWork.ts`,
  `executionWorkHardening.ts`), różne od `tasks`/`decisions` tabel My Work.

## §1. Sekcje

| sekcja | po co użytkownikowi | źródło danych → writer | reguła pustki | S/L |
|---|---|---|---|---|
| Nagłówek (tytuł elementu) | wie, co edytuje | `selected.title` z wiersza listy | zawsze | L |
| Panel utwardzania (`CanonicalWorkHardeningPanel`) | pełna treść zadania/decyzji + kontrolki przejść stanu | `item={selected.source}` — pełny obiekt z `readExecutionWork(caseId)` → `GET /execution-cases/:id/work` (`server/src/routes/pmo/initiativesExecutionRuntime.routes.ts:4439`); zapisy: `updateExecutionTask`/`completeExecutionTask` → `PATCH\|POST /execution-cases/:caseId/tasks/:taskId[/complete]` (`:4250,4289,4319`); `requestExecutionDecision`/`decideExecutionDecision` → `POST /execution-cases/:caseId/decisions/:decisionId/request\|decide` (`:4380,4409`) | nie zbadane — panel ma własną logikę stanów, poza zakresem tego dokumentu (żyje w `shared/`, nie w Execution) | L |
| Promień wybuchu kamienia milowego (`TaskMilestoneBlastRadius`) | dla TASK: co się przesunie, jeśli to zadanie się spóźni | `selected.source` (to samo źródło co panel wyżej) | renderuje się TYLKO dla `selected.kind === 'TASK'` (`ExecutionWorkSurface.tsx:1195`) — decyzje jej nie mają, poprawnie | L |

## §2. Prawy panel

**Brak `ArtifactRightPanel`.** Zamiast tego — jeden `<section>` z obramowaniem, tytułem i
przyciskiem „Zamknij workspace” (widoczny tylko gdy `!documentId`, czyli w trybie osadzonym z
listy; w trybie pełnej karty `documentId` przycisk zamykania w ogóle nie istnieje — patrz §7 K11).
Brak sekcji Akcje/Właściwości/Powiązania/Źródła i założenia/Komentarze/Historia jako osobnych,
nazwanych bloków — wszystko, co jest, żyje wewnątrz `CanonicalWorkHardeningPanel` (nieprzebadane
tu jako osobny byt, bo to komponent współdzielony spoza modułu Realizacji).

## §3. Menu 5 i nawigacja

Brak w całości — nie ma „Sekcje ▾”, nie ma przełącznika Edycja/Podgląd, nie ma „Pracuj z AI ▾”.
W trybie osadzonym (klik z listy, `!documentId`) górą jest StandardTable+StandardPreview (poprawny
kanon LISTA), ale sam „workspace” po „Otwórz” nie ma żadnego z elementów Menu 5.

## §4. AI

Zero przycisków AI w tym widoku. `execution_work`/`execution-work-doc` nie istnieje w
`cardAnalysisRubric.ts` ani `registry.ts`. Globalne karty `task`/`decision` (Moja Praca) MAJĄ już
K21 spełnione częściowo (patrz `task.md`/`decision.md`, oba 4/22 z pełnym Menu 5 wg
`KARTA_N_KONTRAKT.md` §7) — ale to inny komponent, inny rekord. **Do rozstrzygnięcia właściciela**:
czy `execution-work-doc` ma dostać WŁASNE AI, czy ma zniknąć na rzecz przekierowania do globalnej
karty `task`/`decision` (patrz §7 pkt 1 — to samo pytanie co dla dubletu).

## §5. Czytelność

- `grep -c "primary-[0-9]"` na pliku = 0.
- Fokus: nie zweryfikowano indywidualnie (plik duży, 1354 linie; brak dowodu na złamanie — do
  potwierdzenia na żywo).
- **Pigułka modułu (K19): JEST.** W przeciwieństwie do `execution-report`, tryb `documentId` w
  zakładce „Praca” NIE jest ekranem bezchromowym (`isChromelessTab` w `ExecutionHub.tsx:6292-6295`
  wymienia tylko `people_change`/`rollout`/`summary`) — `handleOpenWorkDocument`
  (`ExecutionHub.tsx:2923`) wpisuje wpis do `openDocuments` z `id`, `type: task|decision`,
  `subType`, `name`, `status`, więc otwarte zadanie/decyzja DOSTAJE pigułkę w pasku modułu.
  To POZYTYWNY wzorzec do skopiowania przy naprawie `execution-report` (§7 tamtego pliku).
- i18n: etykiety w tym pliku są po polsku (`„Element pracy"`, „Otwórz zadanie” itd.) — bez leków
  angielskich zauważonych przy czytaniu.
- Teresa: brak wzmianek w pliku — K27 spełnione przez nieobecność.

## §6. Stan zastany vs kontrakt (K1–K30)

| K | wynik | dowód |
|---|---|---|
| K1 kontrakt sekcji | ✗ | brak wpisu w rejestrze |
| K3 źródło danych | ✓ | `runtimeApi.ts:18-79` (write), `:95` (read); trasy serwera `initiativesExecutionRuntime.routes.ts:4250-4460` |
| K6–K11 prawy panel | ✗ | brak `ArtifactRightPanel`; jeden div-workspace bez nazwanych sekcji |
| K12–K16 Menu 5 | ✗ | brak paska |
| K17 zero primary | ✓ | 0 trafień |
| K19 pigułka modułu | **✓** | jedyny pozytywny wynik K19 w całej partii B5 |
| K21–K24 AI | ✗ | zero, brak wpisu w rubryce |
| K26 podgląd→Otwórz | ✓ | klik z listy = `StandardPreview` (`ExecutionWorkSurface.tsx:1000+`), „Otwórz zadanie/decyzję” = pełny workspace |
| K27 Teresa | ✓ (nieobecność) | — |
| K28–K30 | do zmierzenia na żywo (brak zrzutu w `evidence/p10-matryca/` dla tej karty — patrz §7 STOP, ten sam blokier co `execution-report`: `execution-cases` puste dla org DBR77 na stanowisku) |

## §7. Luki → naprawa

1. **Duplikat encji Task/Decision pod DWOMA renderami.** Dla wierszy z `origin === 'tasks'`
   (dane z zastanej tabeli `tasks`, bez wersji `runtime-v1`) „Otwórz" NIE otwiera tego workspace —
   nawiguje do globalnej karty `getArtifactPath('task', row.id)` → `/my-work?artifact=task:<id>`
   (`ExecutionWorkSurface.tsx:664-667`, komentarz autora to potwierdza). Tylko wiersze z realnym
   `runtime-v1` (`caseId`+`version`) otwierają TEN workspace. Efekt: dwa różne ekrany dla „tego
   samego” pojęcia zadania, w zależności od tego, w którym systemie ono żyje — użytkownik nie ma
   jak przewidzieć, który ekran dostanie. **Pytanie do właściciela** (max 1): czy docelowo WSZYSTKIE
   zadania/decyzje Realizacji mają żyć w `runtime-v1` i korzystać z tego jednego workspace (wtedy
   ten plik dostaje pełny kontrakt kanonu), czy `runtime-v1` ma zniknąć na rzecz zastanych
   `tasks`/`decisions` (wtedy ten plik jest tymczasowy i kontrakt pisać dla `task.md`/`decision.md`
   zamiast tu)? Rekomendacja: pierwsza opcja (`runtime-v1` ma wersjonowanie i realne przejścia
   stanu — zastana tabela `tasks` tego nie ma), ale to decyzja architektoniczna, nie kosmetyczna.
2. **Brak zrzutu (STOP, ten sam blokier co execution-report.md §7 pkt 1):**
   `GET /api/initiatives/runtime-v1/execution-cases` → `{"cases":[]}` dla org DBR77 na stanowisku
   06.09 wieczorem — zero danych `runtime-v1` do otworzenia workspace. Przepis: (a) upewnić się,
   że proces API stanowiska ma dzisiejszy R1/R1b/R2 (patrz health/routing), (b) utworzyć w UI jedno
   zadanie `runtime-v1` przez „Realizacja → Praca → Nowe zadanie”, (c) zrzut 1440 light z otwartym
   workspace, (d) usunąć po zrzucie. Rozmiar: S, zależne od infrastruktury.
3. **Brak prawego panelu/Menu 5/AI** — jak w innych kartach tej partii; doprowadzenie do kontraktu
   wymaga przepięcia na `ArtifactRightPanel` + `PracujZAI`, zachowując `CanonicalWorkHardeningPanel`
   jako zawartość sekcji „Akcje”/dedykowanej sekcji treści. Rozmiar: L (współdzielony komponent
   `CanonicalWorkHardeningPanel` używany też gdzie indziej — zmiana wymaga przeglądu konsumentów).

**STOP do właściciela:** pkt 1 (pytanie architektoniczne o docelowy model danych) — reszta to
naprawa techniczna bez decyzji produktowej.
