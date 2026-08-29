# CODEX DAY 119 — KONTRAKT TRZECH STANÓW

Data: 2026-08-29

Gałąź: `codex/day119-trzy-stany-20260829`

Marker produktu: `86eeb60fb3fd6343536e6a8f0fbddfb63acf5a0e`

Werdykt: **FIXED / 3 Z 3 OSIĄGALNE APLIKACJE / 4 Z 4 ZRZUTY / OWNER REVIEW PENDING**

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

### 4.1. Wspólny kontrakt i trzy aplikacje

`src/utils/presentationState.ts` definiuje rozłączny kontrakt `known`,
`partial`, `unknown` oraz jeden formatter liczników. Trzy końcowe komponenty:

1. `AssessmentHub.tsx`: znane All, częściowy rozkład statusów z liczbą
   ukrytych outputów i przyczyną, albo jawne unknown;
2. `InsightViewer.tsx`: błąd Findings nie wraca już jako `[]`; licznik jest
   unknown, a prawdziwa pusta odpowiedź pozostaje known `0`;
3. `InterviewHub.tsx`: błąd szablonów nie jest już tylko `[]`; zakładka
   renderuje alert z unknown i przyczyną.

Klucze `presentationState.*` są obecne w PL i EN. Nie dodano ani nie zmieniono
wartości domyślnej żadnej flagi.

### 4.2. Dowód mutacyjny w obie strony

Komenda zielona przed mutacją i po przywróceniu:

```text
RUN_DB_TESTS=0 MOCK_DB=true npx vitest run tests/unit/day119ThreeStates.contract.test.ts --retry=0 --reporter=json --outputFile=...
7 z 7 pełnych nazw: passed
```

Mutacja produkcyjnego `presentationState.ts`: gałąź `unknown` zwracała `'0'`.
Wynik z `--retry=0`:

```text
MUTATED_EXIT=1
failed  Day 119 three-state presentation contract renders an unknown count as an explicit error instead of zero
```

Przywrócenie wykonano przez `cp` ze scratch. Wynik:

```text
7 z 7 pełnych nazw: passed
DIFF_AFTER_RESTORE_BEGIN
DIFF_AFTER_RESTORE_END
```

Sygnatura jest właściwa: czerwieniła się dokładnie semantyka unknown→zero;
pozostałe przypadki pozostały zielone.

### 4.3. Brak regresji po pełnych nazwach i zasięg

`diff -u` list pełnych nazw przed mutacją i po przywróceniu nie zwrócił żadnej
linii: delta `0 z 7`. Instrukcja odwołuje się do nieistniejącego `§0.4a`, więc
wykonano jawny pomiar zastępczy: `1739` plików w `tests/unit`, `1 z 1739`
bezpośrednio wiąże trzy komponenty i wspólny utility. Nie twierdzę, że ten jeden
pakiet pokrywa pozostałe `1738 z 1739` plików.

Pułapki Z33: pakiet jest czysto plikowy/funkcyjny, uruchomiony z
`RUN_DB_TESTS=0 MOCK_DB=true`; nie dowodzi Gateway/PG. Pułapki (a)–(d) nie leżą
na jego ścieżce. Pułapka (e) nie dotyczy pakietu; runtime został zmierzony
oddzielnie przez kanoniczny pełny produkt.

### 4.4. Runtime i zrzuty

Kanoniczny runtime `scripts/dev/start-wave3-owner-runtime.mjs` na końcowym SHA
`70c68154f8770ad41ac76e976aae5591ff789068`: health/ready/frontend `200`,
`863` migracje, marker fixture SQL verified, auth bypass OFF, dotenv izolowany.

Kontrolowany błąd: wyłącznie we własnej efemerycznej bazie tabela
`interview_library_templates` była chwilowo nazwana
`interview_library_templates_day119_hold`. Realny Gateway zwrócił błąd
`GET /interview/templates`; produkt pokazał alert:
`Tryb ograniczony: — · nieznane: nie udało się pobrać szablonów`.
Po zrzutach tabela została przywrócona; readback: relacja istnieje, `24` wiersze.

Zrzuty (`4 z 4`, ta sama zakładka Szablony, known/unknown × light/dark):

- `day119-known-light.png` — `6292dc0a5e755fb2866d65d00bb1f370c0bb6cac1efe015658cbdadfdff77116`;
- `day119-known-dark.png` — `c7eab01550955b5a16be11eb9617d61d800e9daf418b349546bada76893f4207`;
- `day119-unknown-light.png` — `7fb55e5483319b6fdd05eca4d3f207483297dcd37cc26b39820a7b543de78342`;
- `day119-unknown-dark.png` — `bb10357f171719516d3cf0da01b39a9ed2145c0ff1e1a51ca96bd17dc7af20a8`.

Ścieżka: `/private/tmp/cx-day119-trzy-stany-artefakty/`.

**Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Uruchomiłem `server/src/index.ts` wyłącznie
przez kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs`, na lokalnej bazie
dyżuru, tylko w celu wykonania zrzutów. Zweryfikowałem środowisko procesu i log
serwera zgodnie z `§0.2b` (4). Żaden e-mail, zaproszenie kalendarzowe ani
powiadomienie zewnętrzne nie zostało wysłane.**

### 4.5. Type-check i format

Pełny `npm run type-check` zatrzymały dwa zastane błędy poza licencją:
`src/components/billing/UsageMeters.tsx:174` (`t` nie istnieje) oraz
`src/views/partner/sections/EarningsSection.tsx:448` (niemożliwe porównanie
union z `certified`). Nie zmieniono tych plików. Kontrakt `7/7` oraz locale JSON
przeszły. Pre-commit ratchety dla zmienionych plików przeszły bez nowego długu.

### 4.6. Commity i push

- `a2b7106bb3` — wspólny kontrakt i pierwsze aplikacje;
- `a2bda5f3de` — korekta pierwszej sieroty;
- `1736e861e3` — osiągalny stan szablonów Interview;
- `70c68154f8` — brakujące renderowanie bannera wykryte runtime'em.

Każdy etap wypchnięto na
`github-backup/codex/day119-trzy-stany-20260829`; brak pushu na `origin`.

## 5. TWIERDZENIA NIEZWERYFIKOWANE

- Runtime wizualny potwierdził bezpośrednio InterviewHub; AssessmentHub i
  InsightViewer mają dowód kontraktowy, ale nie osobne zrzuty runtime w tym dyżurze.
- Zrzuty pokazują known/unknown po naprawie, nie historyczny ekran markera przed
  naprawą; czerwony stan sprzed domknięcia bannera opisano z DOM, bez zachowanego PNG.
- Pełny type-check nie jest zielony z powodu dwóch nazwanych błędów zastanych.
- Owner nie wykonał odbioru wizualnego; `OWNER REVIEW PENDING`.
