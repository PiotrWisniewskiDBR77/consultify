# Porządki organizacyjne — pomiar i DWA STOP-y (07.09.2026)

Zakres zlecenia: DEC-448 (przeniesienie 7 pozycji RAID do organizacji kanonicznej
na stagingu) i DEC-449 (zdjęcie 3 kont technicznych z katalogu członków na
stanowisku). **Żaden zapis nie został wykonany na żadnej bazie** — oba zadania
trafiły w warunek zatrzymania zapisany w zleceniu.

Bazy pomiaru:
- staging: `DATABASE_PUBLIC_URL` (`thomas.proxy.rlwy.net:52567/railway`), połączenie bez SSL
- stanowisko: `postgresql://postgres:***@127.0.0.1:54400/consultify_noc`
- produkcja `consultify.ai`: **żadnego kontaktu**

---

## 1. Pomiar wyjściowy — potwierdzony samodzielnie

Hipoteza z poprzedniego wykonawcy **potwierdza się co do liczb RAID i użytkowników**,
ale **jest niepełna** co do tego, co wisi w organizacji legacy.

| | kanoniczna `a3e05d4a-5397-419d-b486-8e44366c0063` „DBR77" | legacy `dbr77` „DBR77 Digital Consulting" |
|---|---|---|
| użytkownicy (`users.organization_id`) | 9 | 7 |
| członkowie (`organization_members`) | 9 | 9 |
| pozycje RAID | **0** | **7** |
| tabel z danymi (z 1 274 mających `organization_id`) | 336 | **99** |
| wierszy łącznie | 129 920 | **11 686** |

Właściciele 3 z 7 pozycji RAID (`anna.kowalska`, `marek.nowak`) mają
`users.organization_id` = kanoniczna — to część hipotezy również się potwierdza.
Pozostałych 4 pozycji: `ewa.nowicka`, `jan.zielinski`, `katarzyna.wojcik` (×2) —
wszyscy z `organization_id='dbr77'`.

Pełne liczby: `PRZED-staging-inwentaryzacja-obu-organizacji.csv`.

## 2. STOP nr 1 — przeniesienie RAID osieroca 11 powiązań

Skrypt `server/scripts/przenies-raid-miedzy-organizacjami.ts` (tryb próbny,
domyślny) wylicza osierocenia przed zapisem i **odmawia `--apply`**:

- **7 × INICJATYWA** — wszystkie 7 pozycji RAID wskazuje `initiative_id` na 5 inicjatyw,
  które zostają w organizacji legacy: „Cloud Migration — Azure" (×2), „Data Platform —
  Lakehouse", „Security Hardening", „Process Automation — RPA", „API Gateway v2" (×2).
  Po przeniesieniu ryzyko byłoby w organizacji A, a jego inicjatywa w organizacji B.
- **4 × WŁAŚCICIEL** — `owner_id` wskazuje na użytkowników spoza organizacji docelowej
  (`users.organization_id='dbr77'` i brak wiersza w `organization_members` organizacji
  kanonicznej): `ewa.nowicka`, `jan.zielinski`, `katarzyna.wojcik` (×2).

Skutek dla produktu, gdyby przenieść mimo to:
- `server/src/routes/raid.routes.ts:70` filtruje RAID po projekcie przez
  `initiative_id IN (SELECT id FROM initiatives WHERE project_id=? AND organization_id=?)`
  — przeniesione wiersze zniknęłyby z filtrów po inicjatywie/projekcie;
- `ExecutionController` łączy `LEFT JOIN initiatives` bez filtra organizacji — nazwa
  inicjatywy by się wyświetliła, ale użytkownik nie mógłby jej otworzyć (widok
  inicjatywy filtruje po organizacji). To ekran, który kłamie.
- 4 pozycje miałyby właściciela „spoza organizacji" — dokładnie problem 4 naprawiany
  wcześniej skryptem `napraw-jezyk-i-czlonkostwo.ts`, tylko wprowadzony przez nas.

CSV: `przenies-raid-miedzy-organizacjami-…-plan.csv` (7 wierszy do przeniesienia)
i `…-osierocenia.csv` (11 osierocen).

## 3. STOP nr 2 — konta techniczne mają przypisaną realną pracę

Konta na stanowisku (organizacja `cc9db573-260f-4a19-927f-f3cc1fbaea38`):
`seed_user_…_finance`, `seed_user_…_it`, `seed_user_…_ops_lead`
(adresy `finance+…@seed.local`, `it+…@seed.local`, `ops.lead+…@seed.local`).

Skan **wszystkich 1 797 tabel** po każdej kolumnie tekstowej — trafienia:

| tabela | kolumna | wierszy |
|---|---|---|
| `interview_sessions` | `owner_id` | 3 |
| `interview_questions` | `answered_by` | 21 |
| `interview_assignments` | `assignee_user_id` | 5 |
| `interview_assignment_members` | `user_id` | 2 |
| `organization_members` | `user_id` | 3 |
| `users` | `id` | 3 |

To **nie są puste rekordy**: 3 sesje wywiadu („Discovery — Operations bottlenecks",
„Discovery — Data & metrics trust", „Submitted — Cost baseline"), z tego 2 `completed`
i 1 `active`, 21 pytań z **niepustą treścią odpowiedzi**, oraz 5 zleceń wywiadu
pokrywających 5 różnych stanów (`approved`, `completed`, `submitted`, `in_progress`,
`assigned`). Te trzy konta są nośnikiem całej fikstury pokazowej modułu Wywiad.

Zgodnie ze zleceniem („jeśli cokolwiek realnego jest przypisane — NIE usuwaj")
**nie zdjęto ich z katalogu członków**.

**Staging: tych kont nie ma w ogóle** (0 użytkowników `seed_user_%` / `@seed.local`,
0 wierszy w `organization_members`, 0 sesji wywiadu). Problem dotyczy wyłącznie stanowiska.

## 4. Co ZOSTAJE w organizacji legacy `dbr77` (dla właściciela)

Legacy to nie resztka po RAID — to **kompletny, spójny drugi zestaw danych**:

| obszar | wierszy |
|---|---|
| artefakty v8 (output) | 185 |
| zadania | 56 |
| artefakty wave5 | 31 |
| prezentacje (decks) | 20 |
| moje pomysły | 20 |
| mapy myśli | 19 |
| decyzje | 12 |
| członkowie (`organization_members`) | 9 |
| inicjatywy | 7 |
| **pozycje RAID** | **7** |
| użytkownicy | 7 |
| pytania wywiadu | 6 |
| spotkania | 5 |
| sesje wywiadu | 2 |
| oceny, projekty, OKR (program), KPI (definicja), ROI (przypadek) | po 1 |

Plus warstwa techniczna: 9 113 `api_logs`, 570 `activity_logs`, 430 `audit_log`,
236 `artifact_lineage_events`, 121 `collab_sessions`.

Inicjatywy: „[ACCEPTANCE] Benefits realization", „API Gateway v2", „Cloud Migration —
Azure", „Customer Portal Redesign", „Data Platform — Lakehouse", „Process Automation —
RPA", „Security Hardening".
Decyzje (12) i spotkania (5) to ta sama historia programu, po polsku
(„Zatwierdzenie budżetu Q2 — Cloud Migration", „Executive Steering Committee", …).

**Pytanie do właściciela:** przeniesienie samego RAID rozerwałoby tę historię na dwie
organizacje. Do rozstrzygnięcia jest, czy przenosimy **cały** zestaw legacy
(7 inicjatyw + 56 zadań + 12 decyzji + 7 RAID + 5 spotkań + reszta, wraz z 7
użytkownikami i ich członkostwami), czy zostawiamy go w spokoju i pokaz idzie
wyłącznie na organizacji kanonicznej.

## 5. Zrzut ekranu

**Nie mam zrzutu ekranu.** Nie dysponuję ważną sesją do stagingu: jedyny plik sesji
w środowisku (`/private/tmp/odbior-auth/auth.json`) jest sesją lokalną — jego
`refresh_token` nie istnieje w tabeli `refresh_tokens` na stagingu, a
`POST /api/auth/refresh` zwraca `Invalid or expired refresh token`. Nie zakładam
konta ani nie podaję hasła. Nie twierdzę więc, że widziałem ekran Realizacja →
Decyzje i ryzyka. Ponieważ **żaden zapis nie został wykonany**, para PRZED/PO i tak
byłaby dwa razy tym samym obrazem.

Stan bazowy do porównania (do zrobienia przez kogoś z sesją stagingu): ekran
Realizacja → Decyzje i ryzyka na organizacji kanonicznej pokazuje **0 pozycji RAID**
(baza: `SELECT count(*) FROM raid_items WHERE organization_id='a3e05d4a-…'` = 0).

## 6. Pliki dowodowe w tym katalogu

- `PRZED-staging-raid_items-dbr77.csv` — pełne 7 wierszy RAID (kopia stanu)
- `PRZED-staging-inwentaryzacja-obu-organizacji.csv` — 336 tabel, liczby dla obu organizacji
- `PRZED-staging-uzytkownicy-obu-organizacji.csv` — 16 użytkowników
- `PRZED-stanowisko-konta-techniczne-przypisania.csv` — co wisi na kontach seed
- `PRZED-stanowisko-organization_members-konta-techniczne.csv` — 3 wiersze katalogu członków
- `przenies-raid-miedzy-organizacjami-…-plan.csv` / `…-osierocenia.csv` — wynik trybu próbnego
