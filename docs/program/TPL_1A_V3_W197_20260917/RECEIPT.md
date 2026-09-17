# TPL-1a v3 — RECEIPT końcowy

Data: 2026-09-17  
Właściciel paczki: `[B] Codex-2`  
Decyzja odmrożenia: DEC-606  
Baza końcowa: `fa075366be0c8bafa666275c8f8cb7868e5f0099`

## Werdykt

**READY FOR CTO REVIEW — etap 1 + etap 2.** Pięć wad z W197/W194 jest zamkniętych w kodzie,
testach oraz w zachowaniu realnej powłoki Huba. Kandydat został uruchomiony na lokalnej kopii
stagingowej bazy Northwind; odczyt API i oba zrzuty korzystają z tych samych realnych rekordów.

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
| API kandydata na kopii stagingowej | HTTP 200; 107 wzorców; 3/3 wymagane bazy `approved` z opisem i strukturą |
| UI real-data EN, light + dark | 2× JPEG 1440×900; otwarty preview i pełne 4 akcje hover |
| Retest po korekcie siatki galerii | 2/2 PASS; ESLint 0 błędów, 6 zastanych ostrzeżeń |

Pełne listy diagnostyk, wynik testów i dowód mutacji są w `evidence/`.

## Etap 2 — real-data

API kandydata działało na przywróconym lokalnie dumpie stagingowym, bez migracji i bez zapisu do
środowiska współdzielonego. Odczyt `GET /api/artifacts?artifactFamily=template` dla organizacji
Northwind zwrócił HTTP 200 i potwierdził:

- DOC `doc-template-system-en-client_final_report`: `approved`, opis 63 znaki, 8 sekcji;
- DECK `dbr77-deck-board`: `approved`, opis 74 znaki, 8 slajdów;
- SHEET `2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1`: `approved`, opis 91 znaków, 2 arkusze.

Pierwszy realny render ujawnił, że panel preview ściska galerię do trzech kolumn i obcina skrajne
akcje hover. Galeria przechodzi teraz na dwie kolumny, gdy preview jest otwarty; ponowny render
pokazał w jednym rzędzie pełne `Build / Edit`, `Use template`, `Duplicate`, `Preview`.

Dowody:

- `evidence/realdata-api-three-bases.json` — zanonimizowany do danych kontraktu odczyt API;
- `evidence/tpl-v3-realdata-en-light-1440x900.jpg` — EN light, preview + hover 4 akcji;
- `evidence/tpl-v3-realdata-en-dark-1440x900.jpg` — EN dark, preview + hover 4 akcji.

Hash JPEG light: `e2a43b0ecd3a7660112f75d4fbecf1e7b994c392fd91647fabd6ae6a60cc8cd9`.
Hash JPEG dark: `e17793968a6cfbf9de389e32b6868ef4028e838038bff2db287b8cf53bf3ad8e`.
