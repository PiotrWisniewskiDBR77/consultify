# Teresa — pomiar 16 modułów

Stan odbioru: **PARTIAL / NOT_PROVEN**. Końcowy przebieg potwierdził 4/16 ścieżek
przed wyczerpaniem dziennego limitu 50 wywołań AI konta audytowego. Nie wyłączono
limitera, nie zmieniono budżetu ani flag. Wiersze z `AI_LIMIT_REACHED` nie są PASS.

| # | Moduł | Trasa | Wejście | Język | used_sources | UnifiedChatPanel DOM | Błędy konsoli | Stan | Odpowiedź / blokada |
|---:|---|---|---|---:|---:|---:|---:|---|---|
| 1 | Czat | `/chat` | Czat główny | pl | 6 | 1 | 0 | PASS | WidzÄ™, Å¼e organizacja Novatek Manufacturing Sp. z o.o. prowadzi kilka inicjatyw, z ktÃ³rych trzy sÄ… obecnie w fazie realizacji: robotyzacja gniazda spawalniczego, system wizyjny kontroli jakoÅ›ci i |
| 2 | Moja Praca | `/my-work` | Teresa | pl | 15 | 1 | 0 | PASS | Novatek Manufacturing Sp. z o.o. to firma z branÅ¼y produkcji dyskretnej o Å›redniej wielkoÅ›ci, zatrudniajÄ…ca 620 pracownikÃ³w i generujÄ…ca przychody rzÄ™du â‚¬120M. Obecnie realizowane sÄ… trzy in |
| 3 | Wywiad | `/interview` | Teresa | pl | 10 | 1 | 0 | PASS | Novatek Manufacturing Sp. z o.o. to firma z branÅ¼y produkcyjnej, o Å›redniej wielkoÅ›ci, z 620 pracownikami i przychodem â‚¬120M. Obecnie firma prowadzi dwa aktywne projekty, ale nie ma jeszcze ukoÅ„ |
| 4 | Narzędzia | `/discovery-tools` | Teresa | pl | 0 | 1 | 0 | PASS | Brak danych w module. |
| 5 | Ocena | `/assessment?tab=library` | Teresa | none | 0 | 1 | 1 | FAIL |  |
| 6 | Inicjatywy | `/initiatives` | Teresa | none | 0 | 1 | 1 | FAIL |  |
| 7 | Realizacja | `/execution?tab=list&view=table` | Teresa | none | 0 | 1 | 1 | FAIL |  |
| 8 | Wyniki | `/results/kpi/ed531550-a7bc-54bb-bbfc-71f2daa14d7f` | Zapytaj Teresę o ten miernik | none | 0 | 1 | 1 | FAIL |  |
| 9 | Finanse | `/finance?tab=statements` | Teresa | none | 0 | 1 | 1 | FAIL |  |
| 10 | Materiały | `/presentations` | Teresa | none | 0 | 1 | 1 | FAIL |  |
| 11 | Audyty | `/audit-programs?tab=library` | Teresa | none | 0 | 1 | 1 | FAIL |  |
| 12 | Spotkania | `/meetings` | Teresa | none | 0 | 1 | 1 | FAIL |  |
| 13 | Administracja | `/admin/team/members` | /^(Teresa\|Zapytaj Teresę)/ | — | 0 | 0 | 0 | STOP | brak wejścia, poza MVP |
| 14 | Ustawienia | `/settings/profile` | /^(Teresa\|Zapytaj Teresę)/ | — | 0 | 0 | 0 | STOP | brak wejścia, poza MVP |
| 15 | Organizacja | `/organization/profile/identity-scale` | Zapytaj Teresę o kontekst organizacji | none | 0 | 1 | 1 | FAIL |  |
| 16 | Partner | `/partner?tab=partner-home` | /^(Teresa\|Zapytaj Teresę)/ | — | 0 | 0 | 0 | STOP | brak wejścia, poza MVP |

## Moduły bez danych

- Narzędzia: `tool_sessions=0`; aktualna odpowiedź: „Brak danych w module.”; `used_sources=0`.
- Audyty: `audit_programs=0`; implementacja wymusza polskie „Brak danych w module.”, lecz końcowy UI jest `NOT_PROVEN` przez `AI_LIMIT_REACHED`.
- Spotkania: `meetings=0`; implementacja wymusza polskie „Brak danych w module.”, lecz końcowy UI jest `NOT_PROVEN` przez `AI_LIMIT_REACHED`.
- Partner: brak ekranu-artefaktu i wejścia Teresy — twardy STOP „brak wejścia, poza MVP”; nie zbudowano nowego ekranu.

## Naprawy

- `6fee1be333` — klasyfikacja obiektowego `routeInfo`, źródła per moduł (Wywiad, Ocena, Wyniki, Finanse, Materiały, Audyty, Spotkania, Organizacja) oraz org-scoped zapytania.
- `a301517249` — deterministyczny polski komunikat dla pustego modułu i korekta pomiaru/selektorów.
- `277575dca4` — pomiar bazowy 16 modułów.

## Zrzuty

Zapisano 16 plików `01-czat.png` … `16-partner.png` w tym katalogu. Zrzuty 1–12 i 15
mają dokładnie jeden composer `UnifiedChatPanel` w DOM; wiersze 5–12 i 15 pokazują
jednak błąd limitu zamiast odpowiedzi, więc nie są dowodem kryterium „Źródła: N”.
Administracja, Ustawienia i Partner nie mają wejścia ani doku z tego ekranu.

## Bramki techniczne

- `server/src/services/ai/__tests__/moduleContextGrounding.test.ts`: 10/10 PASS (baza przed zmianą: 9 testów w tym pliku; brak pogorszenia).
- esbuild zmienionych plików: exit 0.
- `npm run type-check:server`: exit 0.
- `check-list-canon.sh`: OK (361 naruszeń / baseline 364; dług spadł o 3).
- `check-artefakt.sh`: OK (8 / baseline 8).
- `check-teresa-kontrakty.sh`: OK (`tools 19/19`, `entries=13`, `preview=3`, `dead=0`).
- `server/migrations`: 0 zmienionych plików.
- Końcowy Playwright: proces testowy 1/1 PASS jako generator raportu; statusy produktowe są w tabeli i nie są maskowane przez exit test-runnera.

## Co niezmierzone

- Odpowiedź runtime po naprawie dla Oceny, Inicjatyw, Realizacji, Wyników, Finansów,
  Materiałów, Audytów, Spotkań i Organizacji: `AI_LIMIT_REACHED` po 50 wywołaniach.
- 16/16 odpowiedzi i 16 zrzutów z widocznym „Źródła: N”: **NOT_PROVEN**.
- Administracja, Ustawienia i Partner: twardy STOP z zadania — brak ekranu-artefaktu;
  dodanie wejścia wymagałoby nowej powierzchni/ekranu.
