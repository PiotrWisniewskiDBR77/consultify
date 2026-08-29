# CODEX DAY 119 — KONTRAKT TRZECH STANÓW

Data: 2026-08-29

Gałąź: `codex/day119-trzy-stany-20260829`

Marker produktu: `86eeb60fb3fd6343536e6a8f0fbddfb63acf5a0e`

Werdykt: **W TOKU — NIE ODEBRANO**

## 0. Tożsamość, marker i stan wejściowy

Dokument dyżuru ma stan `WYDANY`. Dysk przed utworzeniem worktree: `33 GiB`
wolne. Porty `6002`, `4904`, `4905`: `0 z 3` zajętych.

Wynik §0.1 (2), dosłownie:

```text
63b5f8e64b docs(day118-120): fala naprawcza 2
86eeb60fb3 merge: dyzur 117 — kontrakt statusu naprawiony, ekran wola nieistniejaca trase
MARKER OK
```

Pełna lista 25 commitów znajduje się w logu sesji. Wynik §0.1 (7), dosłownie:

```text
86eeb60fb3fd6343536e6a8f0fbddfb63acf5a0e
```

`git status --short | head -3` nie zwrócił żadnej linii. Tip uciekł o jeden
commit `63b5f8e64b`; diff obejmuje wyłącznie trzy instrukcje dyżurów 118–120.
Praca rozpoczęta dokładnie z markera, bez rebase.

## 1. Trzy komponenty wybrane przed zmianą

1. `src/components/assessment/AssessmentHub.tsx` — chip statusu powierzchni
   Insights pokazuje `0`, mimo że hub zna rekordy outputów, ale nie ma ich
   rozkładu statusów.
2. `src/components/Interview/InsightViewer.tsx` — błąd `listFindings` jest
   zamieniany na `[]`, a licznik Findings pokazuje znane zero.
3. `src/components/Interview/InterviewHub.tsx` — błąd pobrania szablonów
   zostawia `[]`, a zakładka Szablony nie dostaje bannera błędu.

## 2. Korekty wobec instrukcji

1. §A każe użyć trzech najdroższych miejsc z Day 113, którego §7 wskazuje
   przekrojowy wzorzec `catch => []`, Spotkania i Assessment. §D jednocześnie
   zakazuje zapisu `src/components/Meeting/MeetingObjectPage.tsx`, naprawionego
   przez Day 115. Bezpieczna interpretacja: nie ruszam Spotkań; wybieram dwa
   jawne wykonawcze przypadki `catch/empty` z pomiaru Day 113 oraz Assessment.
2. W3 oczekuje porównania `successful_migrations` z liczbą trzycyfrową w
   seederze. `server/scripts/seed-wave3-interview-owner-review.ts` nie zawiera
   takiego porównania. To wynik pomiaru, nie powód do improwizacji.
3. Niezależny SQL wykazał `863` wiersze `schema_migrations`; tabela ma kolumnę
   `filename`, a nie `name`, dlatego pierwsza dodatkowa próba `count(DISTINCT
   name)` uczciwie zakończyła się błędem kolumny i została skorygowana do
   wiążącego `count(*)`.
4. Pierwszy wybór trzeciego komponentu, `SuperAdmin/BackupPanel.tsx`, został
   obalony w runtime preflight: pełny grep konsumentów znalazł tylko definicję
   i default export, a `SystemModule.tsx` montuje `EnterpriseBackupPanel.tsx`.
   Wycofałem zmianę z osieroconego pliku.
5. Drugi wybór, `Interview/NewSessionModal.tsx`, również został obalony:
   `rg NewSessionModal InterviewHub.tsx` trafiał wyłącznie w nazwę lokalnego
   stanu, a nie import/render komponentu. Wycofałem tę zmianę. Trzecią
   aplikacją jest osiągalny `InterviewHub.tsx`, który sam pobiera szablony,
   renderuje ich zakładkę i był potwierdzony w runtime na `/interview`.
6. Pierwszy runtime z wymuszonym błędem tabeli szablonów obalił kompletność
   pierwszej implementacji: `templatesPresentation` miało stan `unknown`, ale
   gałąź Szablony nie wywoływała `renderDegradedBanner()`, więc ekran nadal
   mówił „Brak szablonów”. Tabela została natychmiast przywrócona (`24`
   wiersze), a brakujące wywołanie dodane i objęte kontraktem testowym.

## 3. Baza, migracje i Z30

Kontener `cx-day119-pg`, obraz `pgvector/pgvector:pg16`, bind wyłącznie
`127.0.0.1:6002`, baza `consultify_w3_interview_owner_day119`.

- pierwszy przebieg: `Postgres migrations complete`;
- drugi przebieg: `Applying migrations: 0`, `Postgres migrations complete`;
- niezależny SQL: `863` wiersze `schema_migrations`;
- środowisko poczty: `BRAK ZMIENNYCH POCZTY`;
- `settings smtp%`: `0` wierszy;
- dreny w `server/src/Gateway.ts`: `0` trafień.

**Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani
żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało
wysłane.**

## 4. Dowody

Do uzupełnienia po pomiarach red/green, regresji po pełnych nazwach i zrzutach.

## 5. TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano jeszcze zachowania trzech powierzchni w realnym runtime.
- Nie wykonano jeszcze czterech zrzutów przed/po w dwóch motywach.
- Nie porównano jeszcze pełnych nazw przypadków baseline/final.
