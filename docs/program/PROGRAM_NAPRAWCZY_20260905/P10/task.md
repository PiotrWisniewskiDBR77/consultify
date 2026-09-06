# Zadanie (task) — kontrakt karty N, AUDYT ZGODNOŚCI (P10-B0, DEC-429)

> B0 = audyt, nie budowa od zera. Tabela rundy 1/2 Codexa zachowana w §6a. Ten plik ją
> uzupełnia do formatu §0–§7 i dokłada pomiar NA ŻYWO flagi kontraktu (§6b), który
> **koryguje** zlecenie: flaga NIE jest twardym `return false` — patrz §6b.

## §0. Tożsamość

- **Nazwa PL:** Zadanie · **moduł:** 07_MY_WORK_AGENT (Moja Praca) · **archetyp:** C (Rekord)
- **Trasa:** `/my-work` (bez id w URL — panel otwiera się stanem klienckim, nie routingiem)
- **Jak otworzyć z listy:** Moja Praca → Zadania → wiersz → „Otwórz”
- **Komponent:** `src/components/MyWork/TaskDetailView.tsx:464` (9015 linii)
- **Powłoka dziś:** `StandardArtifactShell`; kontrakt: `src/components/MyWork/taskCardContract.ts`
  (import `TaskDetailView.tsx:163`), 10 kart zadeklarowanych jako `KanonicznaKarta`
- **Rejestr:** `registry.ts` → `task`, klasa **L** (korekta K1 wobec wcześniej domniemanej S)

## §1. Sekcje (katalog kanoniczny `TASK_CARDS`, 10 kart)

| sekcja | po co użytkownikowi | źródło danych (API pole → writer) | reguła pustki | kolejność | S/L |
|---|---|---|---|---|---|
| Opis i zakres (`description-scope`) | rdzeń — co i po co robimy | `description` → `my-work.routes.ts:1519`, prompt `task.strategy` | zawsze widoczna (rdzeń) | 0 | L |
| Pomysły realizacji (`implementation`) | warianty wykonania z AI | ad-hoc `generateIdeasAI`, BRAK klucza w `TASK_SECTION_PROMPTS` | **znika gdy `implementationIdeas.length===0`** (`taskSectionVisibility.ts:16`, DEC-411 — już wdrożone na HEAD) | 1 | L |
| Ryzyko i alternatywy (`risk-alternatives`) | ryzyka i trade-offy z AI | ad-hoc `generateRisksAI`, BRAK klucza backendu | **znika gdy `risks+alternatives===0`** (`taskSectionVisibility.ts:17`) | 2 | L |
| Lista kontrolna (`checklist`) | definition of done | `checklist` → `my-work.routes.ts:1539-1541`, prompt `task.execution` | zawsze widoczna | 3 | L |
| Zależności (`dependencies`) | co blokuje start/koniec | `dependencies` → `my-work.routes.ts`, prompt `task.dependencies` | zawsze widoczna | 4 | L |
| Dowody (`evidence`) | potwierdzenie wykonania | `evidence_refs_json` → `my-work.routes.ts:2891-2930`, prompt `task.evidence` | zawsze widoczna | 5 | L |
| RACI i eskalacja (`governance`) | kto decyduje/eskaluje | MARTWE: brak jednoznacznego writera; prompt `task.raci` (asystuje) | **znika gdy `stakeholders+escalationRules===0`** (`taskSectionVisibility.ts:18`) | 6 | L |
| Załączniki i powiązania (`attachments`→render `attachments-links`) | pliki/linki do innych obiektów | API załączników, writer rozproszony | zawsze widoczna (rolaAI `dane`) | 7 | L |
| Komentarze (`comments`, prawy panel) | dyskusja na zadaniu | API komentarzy task | zawsze widoczna | 8 | prawy panel |
| Aktywność (`activity-log`, prawy panel) | log zdarzeń | systemowy log zdarzeń | zawsze widoczna | 9 | prawy panel |

**K4 uwaga ważna:** reguła pustki NIE jest luką teoretyczną tu — `DEC-411`
(`6bbb03e1a3`) ją już wdrożyła dla 3/10 sekcji. Zrzut na żywo (`evidence/p10b0-kontrakty/task-bez.png`,
rekord „DBR77: Ustawić monitoring…”) pokazuje realnie 5 sekcji (bez Pomysłów/Ryzyka/RACI — ten
rekord ich nie ma). Pozostałe 7 sekcji (opis, checklist, zależności, dowody, załączniki, komentarze,
aktywność) NIE mają reguły pustki — renderują nagłówek nawet bez treści (potencjalne złamanie K4,
nie zmierzone na pustym rekordzie w tej rundzie).

## §2. Prawy panel (`ArtifactRightPanel`)

| sekcja | obowiązkowość | stan na zrzucie |
|---|---|---|
| Akcje | obowiązkowa (K6) | ✓ „Przydziel” — pierwsza sekcja panelu |
| Właściwości (tabela Właściwość\|Wartość) | obowiązkowa (K7) | ✓ Status→Priorytet→Termin→Właściciel→Źródło, tabela prawdziwa |
| Powiązania | obowiązkowa (K8) | ✓ obecna (pusta na tym rekordzie) |
| Źródła i założenia | obowiązkowa dla kart z AI (K9) | ✓ obecna |
| Komentarze | warunkowa | ✓ obecna, bez jawnego powodu pominięcia (bo nie pominięta) |
| Historia | obowiązkowa (K10) | ✓ „HISTORIA — 1” |

Jeden panel, prawa strona, przewija się niezależnie — zgodne z K11 (nie mierzone ponownie `--dom`
w tej rundzie, przyjęte z matrycy `01-task.png`).

## §3. Menu 5 i nawigacja

Pasek ma komplet trzech elementów: „Sekcje ▾” (lewo) · „Edycja/Podgląd” (środek) · „Pracuj z AI ▾”
(prawo) — K12 spełnione. „Sekcje ▾” otwiera manager z zestawami:
- **baseline (flaga OFF):** „Standardowy” / „Minimalny” (`cardSets.ts:568-583`, katalog 10 kart)
- **z kontraktem (flaga ON):** „Kompletne zadanie” / „Rdzeń zadania” / „Pełny” (`taskCardContract.ts:368-370`)

Klasa **L** (pełna strona, nie szuflada) — zgodna z liczbą sekcji (K16). Edycja/Podgląd renderuje się
(użytkownik ma prawo edycji na tym rekordzie) — K14 nie testowane na roli bez prawa w tej rundzie.
Nagłówki sticky (Menu 4 + Menu 5) — przyjęte z matrycy, nie remierzone.

## §4. AI — „Pracuj z AI ▾”

Komponent współdzielony `src/components/standard/PracujZAI.tsx`, podłączony `TaskDetailView.tsx:5895`
przez `zbudujZrodlaPracujZAI` (`:5286`). Trzy pozycje: Analizuj · Uzupełnij tę sekcję · Uzupełnij cały
dokument — zawsze propozycja → Zatwierdź (K21/K22 spełnione, zmierzone na zrzucie).

**Rozjazd nieudokumentowany w rundzie 1:** sekcje `implementation` i `risk-alternatives` MAJĄ
DODATKOWO własne, STARE przyciski ad-hoc — „Create Ideas” (`TaskDetailView.tsx:6049`, `generateIdeasAI`)
i „Analyze” (`:6069`, `generateRisksAI`) — obok wspólnego „Pracuj z AI”. To są DWA wejścia AI do tej
samej treści, złamanie ducha K21 („zakaz osobnych, inaczej nazwanych przycisków AI”), mimo że
formalnie Menu 5 ma jedną listę.

| sekcja | rubryka (`cardAnalysisRubric.ts:96`) | AI może uzupełnić | tylko do odczytu |
|---|---|---|---|
| task (cały typ) | `TASK_CARDS` | opis, pomysły realizacji, ryzyko i alternatywy, lista kontrolna | zależności, dowody, RACI, status |

Teresa: brak wzmianek na zrzucie (K27 ✓, zgodnie z matrycą `01-task.png`).

## §5. Czytelność graficzna

Zrzut 1440 jasny czysty (`task-bez.png`), 0 `primary-[0-9]` widocznych w treści zrzutu (K17 — nie
liczone przez grep na pliku w tej rundzie, przyjęte z matrycy). Pigułka otwartej karty w pasku modułu
obecna (K19 ✓). Brak angielskich literałów na zrzucie poza „AI” (K25 ✓, zgodnie z matrycą). Jeden
literał do potwierdzenia: „Review this draft, then save the task to persist it.” (placeholder AI,
`OCZEKIWANY REZULTAT`) — wygląda na string EN nieprzetłumaczony; nie zlokalizowałem plik:linia w tej
rundzie (STOP — do zlokalizowania osobno, nie zgaduję pliku).

## §6a. Stan zastany vs kontrakt — tabela Codexa (runda 1, zachowana bez zmian)

| sekcja | kontrakt mówi (plik:linia) | ekran pokazuje (plik:linia + zrzut) | źródło danych | rozjazd | waga |
|---|---|---|---|---|---|
| Opis i zakres | `taskCardContract.ts:105-125` | `TaskDetailView.tsx:3304`; zrzut nie dowodzi sekcji | `description` → `my-work.routes.ts:1519` | brak | kosmetyka |
| Pomysły realizacji | `taskCardContract.ts:126-147` | `TaskDetailView.tsx:3304`; brak dowodu runtime | generacja ad-hoc; kontrakt sam wskazuje brak klucza backendu | pusta na wyrost | ⚠ **NIEAKTUALNE** — DEC-411 (`6bbb03e1a3`) już ukrywa tę sekcję bez danych; zmierzone na żywo §1 |
| Ryzyko i alternatywy | `taskCardContract.ts:148-166` | `TaskDetailView.tsx:3304`; brak dowodu runtime | generacja ad-hoc; brak trwałego klucza backendu | pusta na wyrost | ⚠ **NIEAKTUALNE** — jak wyżej |
| Lista kontrolna | `taskCardContract.ts:167-186` | `TaskDetailView.tsx:3304`; brak dowodu runtime | `checklist` → `my-work.routes.ts:1539-1541` | brak | kosmetyka |
| Zależności | `taskCardContract.ts:187-206` | `TaskDetailView.tsx:3304`; brak dowodu runtime | sekcja generate → `my-work.routes.ts` | brak | kosmetyka |
| Dowody | `taskCardContract.ts:207-227` | `TaskDetailView.tsx:3304`; brak dowodu runtime | `evidence_refs_json` → `my-work.routes.ts:2891-2930` | brak | kosmetyka |
| RACI i eskalacja | `taskCardContract.ts:228-243` | `TaskDetailView.tsx:3304`; brak dowodu runtime | MARTWE: brak jednoznacznego writera task | pusta na wyrost | ⚠ **NIEAKTUALNE** — DEC-411 ukrywa też tę sekcję bez danych |
| Załączniki i powiązania | `taskCardContract.ts:244-269` | `TaskDetailView.tsx:3304`; brak dowodu runtime | API załączników/powiązań → writer rozproszony | brak | kosmetyka |
| Komentarze | `taskCardContract.ts:270-285` | prawy panel `TaskDetailView.tsx:6054`; brak dowodu runtime | API komentarzy task | brak | kosmetyka |
| Aktywność | `taskCardContract.ts:286-310` | prawy panel `TaskDetailView.tsx:6054`; brak dowodu runtime | systemowy log zdarzeń | brak | kosmetyka |

## §6b. POMIAR NA ŻYWO flagi `VITE_VF1_TASK_CARD_CONTRACT` (P10-B0, 06.09.2026, koryguje zlecenie)

**Zlecenie zakładało „twardy `return false`” na `TaskDetailView.tsx:316-317`. To jest NIEŚCISŁE.**
Pełny kod (`TaskDetailView.tsx:290-320`) pokazuje trzypoziomowy odczyt: **URL `?cardContract=1` →
localStorage `ff.cardContract` → env `VITE_VF1_TASK_CARD_CONTRACT` → dopiero wtedy `false`.** Linia
317 to sam OSTATNI fallback (gdy żadne z trzech źródeł nic nie mówi), nie bezwarunkowy return.
**Da się włączyć BEZ zmiany kodu i bez zmiennej środowiskowej** — jednym linkiem `?cardContract=1`,
działa też na produkcji (brak guardu `DEV`, celowo — komentarz `:277-280`).

**Metoda pomiaru:** własny vite (port 3111, `VITE_API_TARGET=127.0.0.1:4100`), sesja
`/private/tmp/stanowisko-noc/auth.json`, realny rekord „DBR77: Ustawić monitoring i alerting dla
backendu”, zrzut 1440 jasny bez i z `?cardContract=1` w URL wejściowym.
Dowody: `evidence/p10b0-kontrakty/task-{bez,z}.png(.json)`,
`evidence/p10b0-kontrakty/task-sekcje-{bez,z}.png(.json)`.

**Co się NIE zmienia** (identyczny tekst zrzutu bez/z, `bledyKonsoli:[]` w obu):
- Treść i etykiety renderowanych sekcji w centrum — pochodzą z OSOBNEJ, ręcznie utrzymywanej tablicy
  `taskNSections` (`TaskDetailView.tsx:3007`), nie z katalogu `TASK_CARDS`. Flaga steruje WYŁĄCZNIE
  filtrem/kolejnością przez `useCardLayout({ spec })` (`:4809-4811`) nałożonym NA tę tablicę —
  **K2 pozostaje niespełnione nawet z flagą włączoną**: kontrakt nie jest źródłem treści, tylko
  dodatkową warstwą sortowania nad równoległą, ręcznie zsynchronizowaną listą.
- Reguła pustki (DEC-411) działa identycznie bez względu na flagę (kod w `taskSectionVisibility.ts`
  nie odwołuje się do niej wcale).
- Zero błędów konsoli w obu wariantach (K29 ✓ w obu).

**Co się zmienia** (potwierdzone zrzutem `task-sekcje-{bez,z}.png`):
- Nazwy zestawów w managerze „Sekcje ▾”: „Standardowy/Minimalny” (OFF) →
  „Kompletne zadanie/Rdzeń zadania/Pełny” (ON).
- Kolejność pozycji w SPISIE sekcji managera: OFF ma „…Komentarze, Załączniki i powiązania,
  Aktywność”; ON ma „…Załączniki i powiązania, Komentarze, Aktywność” (zgodne z `kolejnosc: 7` vs `8`
  w `taskCardContract.ts:238,280` — Załączniki PRZED Komentarzami w kontrakcie).
- Klucz localStorage layoutu zmienia namespace `v1`→`v2-contract` (`:4771-4773`) — użytkownik, który
  poukładał sobie sekcje z flagą OFF, straci to ustawienie przy włączeniu (i odwrotnie) — brak migracji.

**Weryfikacja mutacyjna dev-only ostrzeżenia:** `TaskDetailView.tsx:4841-4851` loguje
`console.warn('[taskCardContract] …')`, gdy `taskNSections` ma id spoza `TASK_CARD_RENDER_IDS` —
ale TYLKO `import.meta.env.DEV && taskCardContractEnabled`; poza DEV rozjazd katalog↔render jest
CICHY nawet z flagą włączoną.

## §7. Luki → naprawa

| # | luka | rozmiar | decyzja właściciela? | rekomendacja |
|---|---|---|---|---|
| 7.1 | K2: kontrakt nie steruje renderem nawet przy fladze ON — `taskNSections` (hardcode) i `TASK_CARDS` (kontrakt) to dwie osobne listy synchronizowane ręcznie | L | tak — czy Task ma przejść na `spec.catalog` jako JEDYNE źródło labeli/ikon (usunięcie `taskNSections`), czy kontrakt zostaje tylko warstwą sortowania | przejść na jedno źródło (kontrakt), bo dziś każda zmiana etykiety wymaga edycji w 2 miejscach — ryzyko rozjazdu przy każdej kolejnej zmianie |
| 7.2 | dwa wejścia AI dla `implementation`/`risk-alternatives` (stare przyciski „Create Ideas”/„Analyze” obok wspólnego „Pracuj z AI”) | S | nie | usunąć stare przyciski, przenieść ich handlery pod `PracujZAI.uzupelnijSekcje` |
| 7.3 | 7/10 sekcji nie ma reguły pustki (K4) — tylko 3 warunkowe mają DEC-411 | M | tak — czy puste „Opis”/„Checklist”/„Dowody”/„Załączniki” mają też chować się bez treści, czy to rdzeń/domyślne zawsze widoczne z powodu | zostawić jak jest dla rdzenia (`description-scope` ma być zawsze), ale rozważyć K4 dla `evidence`/`attachments`, jeśli rekord ich nie ma |
| 7.4 | literał „Review this draft, then save the task to persist it.” wygląda po angielsku w polskim UI | S | nie | zlokalizować plik:linia (grep w komponencie generatora oczekiwanego rezultatu) i przepisać przez `t()` |
| 7.5 | brak migracji localStorage layoutu przy przełączaniu flagi (`v1`↔`v2-contract`) | S | nie | przy realnym włączeniu na stałe — jednorazowy skrypt/fallback czytający stary klucz, jeśli nowy pusty |

**STOP:** nie testowałem K14 (Edycja/Podgląd bez prawa) ani K11 (`--dom` policz paneli) w tej rundzie —
poza zakresem B0 (audyt zgodności), zostawiam jako lukę pomiarową.
