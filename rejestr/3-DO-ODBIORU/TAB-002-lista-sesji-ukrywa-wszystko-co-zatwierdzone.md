---
id: TAB-002
tytul: Lista sesji ukrywa wszystko, co zatwierdzone — 62 ze 105 niewidoczne
typ: blad
waga: krytyczna
obszar: TAB
stan: do-odbioru
wlasciciel: wykonawca
blokuje: []
zablokowane_przez: []
zrodlo: "Piotr 07-21: „nie ma tutaj żadnej skończonej sesji, ani jednej" + zapytanie do bazy"
stare_id: N17
utworzone: 2026-07-21
---

## 1. PROBLEM

Na liście sesji nie da się znaleźć żadnej ukończonej pracy. Licznik pokazuje „All 22", a w bazie tej organizacji jest 105 sesji.

Odkryte, gdy Piotr został odesłany do sesji „Dynamic SWOT — Atelier Forward" (zatwierdzona, 100%) — **sesja istnieje w bazie, ale nie da się jej znaleźć na ekranie.**

## 2. PRZYCZYNA

**Ustalona, dowód z żywej bazy demo (Atelier Toys + DBR77):**

| Status w bazie | Ile |
|---|--:|
| APPROVED | **62** |
| DRAFT | 36 |
| REVIEW | 7 |
| **razem** | **105** |

Lista pokazuje „All 22" = Draft 16 + Pending Review 6.

Filtry statusu to wyłącznie **Draft · Pending Review · In Progress**. **Nie ma filtra Approved/Completed**, a zatwierdzone sesje nie są nawet doliczane do licznika „All".

## 3. ROZWIĄZANIE

1. Dodać filtr statusu **Approved** (i sprawdzić, czy potrzebny osobny **Completed** — ustalić, jakie statusy realnie występują w bazie, nie zgadywać z kodu).
2. Naprawić licznik „All" tak, żeby liczył **wszystkie** sesje organizacji, nie tylko te w widocznych filtrach.

**Uwaga dla wykonawcy:** sprawdź, czy zawężenie nie siedzi po stronie zapytania do serwera (lista statusów wysyłana w żądaniu), zanim zaczniesz zmieniać filtry w interfejsie. Zapisz w DOWODACH, gdzie realnie było odcięcie.

## 4. KRYTERIUM ODBIORU

Tools → Sessions.

**Ma być:** jest filtr „Approved" i po jego włączeniu widzisz ukończone sesje · licznik „All" pokazuje 105, nie 22 · sesja „Dynamic SWOT — Atelier Forward" jest do znalezienia na ekranie.

## 5. DOWODY

**Commit:** `273583ca91`, gałąź `fix/TAB-002`, baza `origin/demo` (`79cb925bdb`). Jeden plik:
`src/components/Discovery/DiscoveryToolsHub.tsx`. Nie pushnięte.

**Gdzie realnie było odcięcie — dwa miejsca, nie jedno** (sekcja 3 kazała to ustalić):

1. **Klient, bramka statusu.** `DiscoveryToolsHub.tsx:1020` trzymało w zakładce Sessions wyłącznie
   `DRAFT`/`PENDING_REVIEW`. Zatwierdzone sesje nie szły do zakładki Reports — ta jest budowana
   z artefaktów (`:1025`: assessment reports, report builder, decki), nigdy z sesji narzędzi.
   `allSessions` nie miało żadnego innego odbiorcy, więc APPROVED nie pojawiały się **nigdzie**.
2. **Serwer, limit.** Klient nie podawał `limit`, więc `ToolController.listToolSessions:707`
   brał domyślne `50` (twardy sufit `Math.min(limit, 100)` w `:788`). Lista była ucinana
   niezależnie od filtrów.

**Sonda HTTP, żywy backend, token OWNER, organizacja DBR77:**

```
GET /api/tools              200   zwrócono 50 z 99   DRAFT  7 · REVIEW 6 · APPROVED 37
GET /api/tools?limit=100    200   zwrócono 99 z 99   DRAFT 34 · REVIEW 6 · APPROVED 59
```

**Zapytanie do żywej bazy (tylko SELECT, backend w trybie `DB_READONLY=1`):**

| Organizacja | APPROVED | DRAFT | REVIEW | razem |
|---|--:|--:|--:|--:|
| DBR77 | 59 | 34 | 6 | **99** |
| E2E Tenant (conv-6785) | 8 | — | — | 8 |
| Atelier Toys | 3 | 2 | 1 (`IN_REVIEW`) | 6 |

**Ekran (zrzuty robione przeze mnie, Piotr nie jest pierwszym testerem):**

- przed: `All 22`, zero zatwierdzonych, brak pigułki Approved
- po: **`All 108` · `Draft 43` · `Pending Review 6` · `In Progress 0` · `Approved 59`**,
  wiersze ze statusem Approved widoczne w tabeli
- po kliknięciu pigułki Approved: `Status: Approved`, `All 59`, lista zawężona do zatwierdzonych
- plakietka builda na zrzucie potwierdza gałąź: `LOCAL @79cb925bdb`, `branch=fix/TAB-002`

**Bramki:** `esbuild` czysty · `eslint` **0 errorów** (190 warningów pre-istniejących: `any`
i hex-e w niezmienianych partiach pliku).

**Higiena:** backend chodził z `DB_READONLY=1`, żaden zapis nie mógł dojść do bazy demo —
zero rekordów testowych. Token weryfikacyjny (2 h) skasowany. Konfiguracja do powtórzenia
weryfikacji: wpis `tab-002-verify` w `.claude/launch.json` (plik poza gitem).

**Czego NIE sprawdziłem:** motywu jasnego — aplikacja steruje motywem własnym ustawieniem,
nie preferencją systemu, a zmiana nie dotyka warstwy stylów (żadnej klasy CSS nie ruszono).

## 6. DZIENNIK

**2026-07-21** — zmigrowane do rejestru ze źródła: N17. Treść przeniesiona wiernie, bez scalania.

**2026-07-21, wykonawca** — wzięte do pracy, `1-OTWARTE` → `2-W-TOKU`.

**2026-07-21, wykonawca — ❌ obalona liczba „105" z sekcji 1 i 4.**
PROBLEM mówi „w bazie **tej organizacji** jest 105 sesji", a tabela w PRZYCZYNIE jest podpisana
„Atelier Toys **+** DBR77". Zapytanie do żywej bazy rozstrzyga na korzyść drugiego odczytu:
105 = DBR77 (99) + Atelier Toys (6), a rozbicie zgadza się co do sztuki
(APPROVED 59+3=62 · DRAFT 34+2=36 · REVIEW 6+1=7).
**Serwer filtruje po `organization_id`, więc 105 nie jest osiągalne dla żadnego użytkownika.**
Poprawna wartość dla Piotra zalogowanego w DBR77 to **99 sesji narzędzi** (na ekranie `All 108`,
bo licznik dolicza 9 sesji Assessment — tak było i przed zmianą).
Kryterium odbioru w części „licznik All pokazuje 105" jest **niewykonalne z definicji** i wymaga
poprawki przez Mastera. Pozostałe dwie części kryterium są spełnione.

**2026-07-21, wykonawca — ❌ obalona teza, że wystarczy dodać filtr.**
Samo dodanie pigułki Approved nie odsłoniłoby danych: przy domyślnym limicie 50 serwer i tak
zwracał 37 z 59 zatwierdzonych. Konieczne były **obie** zmiany. Zapisane, żeby następna sesja
nie „naprawiła" tego jednym filtrem i nie zamknęła zadania z połową danych.

**2026-07-21, wykonawca — ustalenie do sekcji 3 pkt 1:** statusu `COMPLETED` w bazie **nie ma**
w żadnej organizacji, więc pigułki Completed świadomie nie dodano. Występują za to **dwa
zapisy tego samego stanu** — `REVIEW` (DBR77) i `IN_REVIEW` (Atelier Toys); klient mapuje oba
na `PENDING_REVIEW` (`DiscoveryToolsHub.tsx:910-917`), więc nie wymagało to zmiany.

**2026-07-21, wykonawca** — `2-W-TOKU` → `3-DO-ODBIORU`. Dowody w sekcji 5.

**Znalezisko poza zakresem, do decyzji Mastera:** zakładka **Library** nie wstaje na backendzie
w trybie read-only („Library failed to load — blocked a write query"). Znaczy to, że bootstrap
biblioteki narzędzi **zapisuje do bazy przy zwykłym odczycie ekranu**. Nie ruszam tego —
poza zakresem TAB-002, ale wygląda na osobny błąd.
