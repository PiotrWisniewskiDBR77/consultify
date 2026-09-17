# TPL-1a v3 — RECEIPT etapu 1

Data: 2026-09-17  
Właściciel paczki: `[B] Codex-2`  
Decyzja odmrożenia: DEC-606  
Baza końcowa: `fa075366be0c8bafa666275c8f8cb7868e5f0099`

## Werdykt

**READY FOR CTO REVIEW — etap 1.** Pięć wad z W197/W194 jest zamkniętych w kodzie i testach.
Akceptacja etapu 2 nadal wymaga ponownego odczytu API oraz zrzutów EN light/dark z Huba na
lokalnej kopii realnej bazy. Dev-render użyty do kontroli układu jest fiksturą i nie jest
przedstawiany jako dowód realnych danych.

## Zachowanie po zmianie

1. DECK zachowuje kanoniczny stan `approved`; usunięto historyczne przepisywanie na `published`.
2. Odczyt biblioteki wzbogaca stare snapshoty z bieżących rekordów kanonicznych:
   - DOC: `purpose` i `section_blueprint`,
   - DECK: `description` i `outline_json`,
   - SHEET: `description` i `schema_snapshot`.
   Test wspólnego odczytu wymaga dla wszystkich trzech baz statusu `approved`, opisu i
   niepustej struktury.
3. `Duplicate` wykonuje realną operację runtime i otwiera nowy obiekt:
   - DOC: `POST /document-studio/templates/:id/new-version`,
   - DECK: `POST /presentations/templates/:id/clone`,
   - SHEET: `POST /workbook/templates/:id/build`.
   Test behawioralny sprawdza trzy wywołania zależności i nowe ścieżki wynikowe.
4. SHEET `Use template` jest jawnie wyłączone z komunikatem kierującym do `Duplicate`; nie
   prowadzi już do listy dziewięciu obcych modeli parametrycznych.
5. Nakładka kafla ma `Build / Edit`, `Use template`, `Duplicate`, `Preview` w jednym rzędzie.
6. W tabeli zakres, status i data są przypięte przy prawym panelu, mają typowe podłogi szerokości
   i tooltipy. Kontrola renderu potwierdziła pełne `Application`, `Approved`, `Published`,
   `Deprecated` oraz pełne daty.
7. `New template` pozostaje wyłączone w Fali 2.

## Bramka

| Kontrola | Wynik |
|---|---|
| Testy toru B i bezpośrednich importerów, `--retry=0` | **95/95 PASS**, 8/8 plików |
| Mutacja DECK `approved → published` | **2/14 RED**, RC=1; po przywróceniu 14/14 PASS |
| TypeScript serwera | RC=0 |
| TypeScript frontu, ta sama metoda i `@types/node 22.19.3` | linia **150**, kandydat **150**, listy bajtowo identyczne |
| Hash list diagnostyk frontu | oba `a0b221476113ce03cc04f90b34b1d1b9628b18583b2903425bc7ec7a156742ae` |
| Diagnostyki w plikach paczki | 0 |
| ESLint plików paczki | 0 błędów; 63 zastane ostrzeżenia |
| `git diff --check` | RC=0 |
| Migracje dodane przez v3 | 0 |
| Pliki toru A | 0 |

Pełne listy diagnostyk, wynik testów i dowód mutacji są w `evidence/`.

## Zakres etapu 2

Na lokalnej kopii realnej bazy należy uruchomić API kandydata, odczytać trzy kanoniczne bazy i
zapisać odpowiedź potwierdzającą: `approved`, niepusty opis oraz odpowiednio sekcje, slajdy i
arkusze. Następnie trzeba wykonać zrzuty EN light/dark 1440×900 w realnej powłoce Huba z
otwartym podglądem oraz hoverem czterech akcji. Bez tych dwóch dowodów akceptacja danych i
wizualna pozostają `NOT_PROVEN`.

