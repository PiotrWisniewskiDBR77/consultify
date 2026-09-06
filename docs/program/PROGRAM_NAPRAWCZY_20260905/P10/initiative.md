# Inicjatywa (initiative) — kontrakt karty N, AUDYT ZGODNOŚCI (P10-B0, DEC-429)

> Runda 2 (Codexa) już scaliła K1 z rundą 1 — tabele §6a zachowane bez zmian. Ten plik dokłada
> §0/§2–§5 wg formatu wspólnego oraz pomiar NA ŻYWO flagi (§6b). **Dla tej karty wynik różni
> się jakościowo od pozostałych 5**: kontrakt faktycznie zmienia KOLEJNOŚĆ realnego renderu
> (nie tylko nazwy w managerze) — to jedyna z 6 kart, gdzie K5 jest częściowo spełnione z flagą ON.

## §0. Tożsamość

- **Nazwa PL:** Inicjatywa · **moduł:** 05_INITIATIVES (Inicjatywy) · **archetyp:** C (Rekord,
  najcięższy z 6 — 26 sekcji wg właściciela / 35 kart w kontrakcie)
- **Trasa:** `/initiatives?mode=doc&open=<id>` (`getArtifactPath`, `artifactLinks.ts:281`)
- **Jak otworzyć z listy:** Inicjatywy → wiersz → „Otwórz” (lub lista/kanban)
- **Komponent:** `src/components/Initiatives/InitiativeDocumentView.tsx:494` (12109 linii —
  najcięższa karta z 6)
- **Powłoka dziś:** `NModeShell`; kontrakt: `src/components/Initiatives/sections/initiativeCardContract.ts`
  (import `:221`), **35 kart** `KanonicznaKarta`, jedyna karta z jawnym, świadomym usunięciem Teresy
  (DEC-419, `:162-168`)
- **Rejestr:** `registry.ts` → `initiative`

## §1. Sekcje (katalog kanoniczny, grupy — 35 kart)

| grupa | sekcje (przykład) | źródło danych | reguła pustki | S/L |
|---|---|---|---|---|
| ZAKRES I PLAN | Zakres inicjatywy, Zadania, Harmonogram, Zależności, Produkty i kamienie milowe | profil/sekcje → `server/src/services/initiative/*` | brak (DEC-387: „nic nie chowamy”, `INITIATIVE_CONTRACT_HIDDEN_SEED.length===0`) | L |
| DECYZJE I RYZYKO | Decyzje, Ryzyko i RAID, Bramy, Sugerowane zmiany, Dziennik zmian | jw. | brak | L |
| LUDZIE | Zespół, RACI, Właściciele strumieni | jw. | brak | L |
| REZULTATY | Kryteria sukcesu, KPI i korzyści, Analiza finansowa, Wpływ finansowy, OKR, Hipoteza | jw. | brak | L |
| ZAPISY | Zasoby, Załączniki i powiązania, Użyte w (powiązania), Artefakty, Wnioski i lekcje | jw. | brak | L |
| Komentarze/Historia (prawy panel) | — | komentarze/log zdarzeń → serwisy Initiative | brak | prawy panel |

**K4 świadomie NIE wdrożona (`DEC-387: nic nie chowamy`)** — to jedyna z 6 kart, gdzie brak reguły
pustki jest UDOKUMENTOWANĄ DECYZJĄ w kodzie (`InitiativeDocumentView.tsx:9103`), nie luką.

## §2. Prawy panel

| sekcja | obowiązkowość | stan na zrzucie (`07-initiative.png`) |
|---|---|---|
| Akcje | obowiązkowa (K6) | ✓ „Utwórz wariant / Oznacz gotowe” |
| Właściwości (tabela) | obowiązkowa (K7) | ✓ Status→Faza→Następna brama→Priorytet→Właściciel→Termin |
| Powiązania | obowiązkowa (K8) | ✓ obecna |
| Źródła i założenia | obowiązkowa dla AI (K9) | ✓ obecna |
| Rezultaty | dodatkowa | ✓ obecna |
| Komentarze | warunkowa | ✓ obecna |
| Historia | obowiązkowa (K10) | ✓ obecna |

## §3. Menu 5 i nawigacja

Komplet trzech elementów (K12 ✓). Manager „Sekcje ▾”:
- **baseline:** brak nazwanych zestawów widocznych w skrócie tekstu (do potwierdzenia dokładnej
  etykiety osobno — w tej rundzie zmierzyłem tylko listę sekcji, nie nagłówek „ZESTAW DOMYŚLNY”)
- **z kontraktem:** „ZESTAW DOMYŚLNY: Rdzeń inicjatywy / Pełny” (`initiative-sekcje-z.png`) — POJAWIA
  SIĘ nagłówek zestawów, którego przy OFF nie zaobserwowałem w zrzucie

## §4. AI

`PracujZAI` obecny (K21 ✓, `07-initiative.png`). Teresa świadomie USUNIĘTA z karty (DEC-419,
`initiativeCardContract.ts:162-168`) — jedyna karta z jawnym uzasadnieniem w kodzie, nie tylko
nieobecnością.

| sekcja | rubryka (`cardAnalysisRubric.ts:339`) | AI może uzupełnić | tylko do odczytu |
|---|---|---|---|
| initiative (cały typ, 35 kart) | `INITIATIVE_CANONICAL_CARDS` | zakres, opis problemu/rozwiązania, koszt bezczynności, kryteria sukcesu | RAID, bramki, finanse, dziennik zmian |

## §5. Czytelność graficzna

Zrzut 1440 jasny (`07-initiative.png`) czysty, pigułka modułu obecna (K19 ✓, wzorzec zaakceptowany
przez właściciela — „dokładnie taki jak kocham”). „Drift statusu” banner obecny — informacyjny, nie
błąd (raw wartość w bazie różni się od znormalizowanego statusu — zgłoszone administratorowi wprost
na ekranie, nie ukryte).

## §6a. Stan zastany vs kontrakt — tabela Codexa (runda 1+2, zachowana bez zmian)

| sekcja | kontrakt mówi (plik:linia) | ekran pokazuje | źródło danych | rozjazd | waga |
|---|---|---|---|---|---|
| Przegląd–Pilotaż (14 sekcji) | `initiativeCardContract.ts:64-340` | `InitiativeDocumentView.tsx`; brak dowodu runtime | profil/sekcje → `server/src/services/initiative/*` | brak | kosmetyka |
| Komentarze, Historia aktywności | `initiativeCardContract.ts:341-383` | jw. | komentarze/log zdarzeń → serwisy Initiative | brak | kosmetyka |
| Sterowanie–Wnioski i lekcje (20 sekcji) | `initiativeCardContract.ts:384-742` | jw.; brak rekordu | sekcje Initiative → serwisy/repozytoria Initiative | brak | kosmetyka |

### Uzupełnienie K1 po scaleniu (runda 2, zachowane)

| sekcja / pole | kontrakt mówi | ekran pokazuje | źródło danych | rozjazd | waga |
|---|---|---|---|---|---|
| Zakres inicjatywy | `overview` + `problemDefinition` osobno | jedna scalona sekcja `initiative-definition` | dane profilu inicjatywy | kolejność inna | kosmetyka |
| Stan docelowy / Zakres | dwie karty `targetState` + `scope` | jedna sekcja `target-state-scope` pod etykietą „Kryteria sukcesu” | sekcje inicjatywy | etykieta inna | blokuje MVP |
| Wymagania kompetencyjne | karta `competencyRequirements` z promptem | brak renderu w `InitiativeDocumentView` | route `skills-gap.routes.ts` + `skillsGapService.ts` | sekcja z kontraktu nieobecna | blokuje MVP |
| Luka kompetencyjna | karta `skillsGap` z promptem | osierocony `SkillsGapSection.tsx`, zero importów | route `skills-gap.routes.ts` + `skillsGapService.ts` | sekcja z kontraktu nieobecna | blokuje MVP |
| RACI | alias `governance` → `raci` | osobna pozycja „RACI” | sekcja inicjatywy | brak | kosmetyka |

Dowód runtime K1 wskazuje realny rekord „Supply Chain Optimization”; runda 2 powtarza odbiór na
własnym Vite i nie uznaje samego komponentu osieroconego za render.

## §6b. POMIAR NA ŻYWO flagi `isInitiativeCardContractEnabled` (P10-B0, 06.09.2026)

**Zlecenie zakładało „twardy `return false`” na `initiativeCardContract.ts:1118`. NIEŚCISŁE** — linia
1118 to `const FLAG_ENV = 'VITE_VF1_INITIATIVE_CARD_CONTRACT'` (nazwa stałej, nie kod bramkujący).
Funkcja `isInitiativeCardContractEnabled` (`:1127-1163`) czyta URL `?ff_initiativeCardContract=1`
**LUB** wspólny alias `?cardContract=1` → localStorage → env → `false`. Da się włączyć jednym linkiem.

**Metoda:** vite port 3111, sesja `stanowisko-noc/auth.json`, rekord „Supply Chain Optimization”
(`fa87dc75-d838-4fa0-8263-590969aa8621`), porównanie PEŁNEGO tekstu strony bez klikania w Sekcje
(canvas realny) ORAZ po kliknięciu „Sekcje” (manager). Dowody:
`evidence/p10b0-kontrakty/initiative-canvas-{bez,z}.png(.json)`,
`initiative-sekcje-{bez,z}.png(.json)`.

**To JEDYNA z 6 kart, gdzie flaga zmienia PRAWDZIWY RENDER, nie tylko manager — kod to WPROST
dokumentuje:** `InitiativeDocumentView.tsx:9119-9121` — „★ DEC-387: to jest CAŁY wkład kontraktu w
wygląd — PORZĄDEK, nie cięcie.” Gdy flaga ON i użytkownik nie ma własnej kolejności w localStorage,
`uporzadkujSekcjeBoarduInicjatywy()` sortuje realnie renderowane sekcje wg katalogu kanonicznego.
Potwierdzone identycznym diff-em na canvas i na manager (nie tylko manager, jak w Task/Decision/Insight):

- Grupa **LUDZIE** (Zespół/Właściciele strumieni/RACI) przesuwa się z pozycji PRZED „REZULTATY” na
  pozycję PO „REZULTATY”.
- W grupie ZAKRES I PLAN: „Produkty i kamienie milowe” przeskakuje przed „Zależności” (było po).
- W grupie REZULTATY: „OKR/Hipoteza” przeskakuje przed „Analiza finansowa/Wpływ finansowy” (było po).
- W grupie LUDZIE: „Właściciele strumieni” i „RACI” zamieniają się miejscami.
- Liczba sekcji NIEZMIENIONA w obu wariantach (kod: „funkcja zwraca permutację wejścia” — potwierdzone,
  `bledyKonsoli:[]` w obu).

**Wniosek — różny od pozostałych 5 kart:** dla Initiative K5 („etykiety i kolejność wg kontraktu”)
JEST częściowo spełnione, gdy flaga ON i użytkownik nie ma zapisanej własnej kolejności. To
najsilniejszy z 6 zmierzonych efektów włączenia flagi. K2 („kontrakt steruje CAŁYM renderem, nie tylko
kolejnością”) nadal niespełnione — etykiety/ikony/treść nadal z `nModeSectionsWithContent` (hardcode),
kontrakt dotyka wyłącznie porządku.

## §7. Luki → naprawa

| # | luka | rozmiar | decyzja właściciela? | rekomendacja |
|---|---|---|---|---|
| 7.1 | Wymagania kompetencyjne / Luka kompetencyjna zadeklarowane w kontrakcie, zero renderu (`SkillsGapSection.tsx` osierocony) | L | tak (z rundy 2, powtórzone) | podłączyć komponent albo usunąć kartę z kontraktu, jeśli funkcja porzucona |
| 7.2 | reorder grup/sekcji przy fladze ON nie ma odbioru na zrzutach (CLAUDE.md reguła 9: zakaz masowego włączania) — dziś nikt nie widział tej nowej kolejności poza tym pomiarem | S | tak — 1 pytanie: czy nowa kolejność (LUDZIE po REZULTATACH, Produkty przed Zależnościami) jest tym, czego właściciel chce, zanim flaga stanie się domyślna | pokazać Piotrowi zrzut `initiative-canvas-z.png` obok baseline PRZED ustawieniem flagi domyślnie ON |
| 7.3 | „Stan docelowy/Zakres” scalone pod etykietą „Kryteria sukcesu” zamiast dwóch kart z kontraktu | M | tak (z rundy 2, powtórzone) | rozdzielić albo zaktualizować kontrakt, żeby nazwać scalenie wprost |

**STOP:** nie testowałem K11/K14 w tej rundzie. Nie potwierdziłem etykiety „ZESTAW DOMYŚLNY” przy
fladze OFF (może być ukryta pod innym niż spodziewany selektor) — do doprecyzowania osobno.
