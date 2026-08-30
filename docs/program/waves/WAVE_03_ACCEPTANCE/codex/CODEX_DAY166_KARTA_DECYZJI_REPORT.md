# CODEX — DYŻUR 166 — KARTA DECYZJI

Data: 2026-08-30  
Marker: `22124537f7`  
Gałąź: `codex/day166-karta-decyzji-20260830`  
Werdykt: **STOP CAŁEGO DYŻURU — ZASÓB WYŁĄCZNY ZAJĘTY**

## §0.1 — baza pracy i marker

Instrukcję wydaną odczytano w całości z
`github-backup/codex/m03-admin-20260824:docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_166_KARTA_DECYZJI.md`.
Worktree utworzono wyłącznie z bare-vaulta w
`/private/tmp/cx-day166-karta-decyzji`.

Wynik komend (2), dosłownie:

```text
bda3e98958 pomiar mechaniki: ROI dziala, wskaznik ma blokade na starcie, cel ma dziure na check-inie
332fa332bd lista inicjatyw: wyrenderowana pod wlasna nazwa — istniala schowana pod ekranem od i18n
d3c30bfb06 docs(codex): dyzury 166 i 167 wydane — domkniecie karty decyzji, splata dlugu narzedzi pomiarowych
76996ee069 odbior: wszystkie 196 ekranow ma opis GDZIE JEST i PO CO
05c8df153d docs(codex): dyzur 165 wydany — wznowienie agenta po akcepcie kroku, koniec klamstwa 'zakolejkowane'
1aa942cb32 ROI: trzy ekrany scalone w JEDNA karte N — prototyp do decyzji
22124537f7 merge: dyzur 161 (lancuch migracji od pustej bazy przechodzi 868/868 — A; bramka niewpieta — C) — odbior adwersaryjny
ac5ba6dc3d odbior 161: lancuch od zera przechodzi (868/868, A), inwentarz B z nieujawniona luka parsera, bramka C bo niewpieta
a84f0deae3 merge: dyzur 162 (napis o cofaniu przestal klamac — A; pochodzenie B) — odbior adwersaryjny nadzorcy
5e022a3e0a odbior 162: klamstwo o cofaniu usuniete (A, mutacja odtworzona), pochodzenie B — plakietka na dzialajacej sciezce nadal klamie
2705ecc435 merge: dyzur 160 (brama zapisu zadan potwierdzona realnym HTTP — A, dowod mutacyjny niezalezny) — odbior adwersaryjny
809414d395 odbior 160: A na rdzeniu z niezaleznym dowodem mutacyjnym; 22 pliki pisza do tabeli tasks; cztery ciche powierzchnie 409
6b48e34d9c kanon: smuga Teresy zostaje czerwona (wyjatek zatwierdzony) + Ocena i Audyt to dwa moduly
174080c277 koordynacja: jedna wspolna paczka odbioru — ekran wchodzi, gdy gotowe sa obie polowy
56d289f0c4 koordynacja: co zostaje torowi funkcji po podlaczeniu karty decyzji
3c62aeab3d karta decyzji: komentarze, alternatywy i ryzyka ida teraz NA SERWER
bced36a6ff docs(day160): record owned resource cleanup
d0b9784cd9 docs(day160): complete task writer evidence and decision brief
21221ca50f docs(day162): record provenance closure evidence
d48031ecfa test(day160): measure task write gate on real postgres
894739cfc6 fix(day162): make task provenance and rollback audit honest
52b6007faf docs(day161): clean report formatting
0fe521cd02 docs(day161): record resumed fresh-chain revalidation
4c8f2750a9 rejestr: cztery warianty prototypu prawego pasa do odbioru
286ff49271 stany bledu + prototyp jednej formuly prawego pasa
MARKER OK
```

Wynik komend (7), dosłownie:

```text
22124537f7c4e5ac523dc97ada2291f955721e3c
```

`git status --short | head -3` nie wypisał żadnej linii.

Wolne miejsce przed startem:

```text
Filesystem        Size    Used   Avail Capacity iused ifree %iused  Mounted on
/dev/disk3s1s1   1.8Ti    12Gi    37Gi    25%    459k  383M    0%   /
```

Marker jest przodkiem tipa. Tip wyprzedza marker o sześć commitów; zgodnie z
`DEC-2026-08-26-95` worktree rozpoczęto dokładnie z markera, bez rebase.

## STOP — BLOK 0 / cały dyżur

Rodzaj: PROCEDURALNY — jeden z pięciu jawnych warunków zatrzymania całego dyżuru.  
Powód: przybity zasób wyłączny runtime, port `5000`, jest zajęty.  
Licencja, którą sprawdziłem: `Z7`: „Twój JEDYNY port harnessu to 5000 i 5001”; §0.5: „Port 6057 albo 5000 i 5001 jest zajęty — To JEST powód do STOP-u całości — nie bierzesz innego portu”. Wynik: port `5000` zajęty.  
Dowód:

```text
PORT 6057
PORT 5000
COMMAND    PID            USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
ControlCe 1122 piotrwisniewski   11u  IPv4 0x73a0c34d1fb6aa66      0t0  TCP *:5000 (LISTEN)
ControlCe 1122 piotrwisniewski   12u  IPv6 0x6f883606c3a407aa      0t0  TCP *:5000 (LISTEN)
PORT 5001
BRAK KOLIZJI DOCKER
```

Co dostarczyłem ZAMIAST zmiany: wykonany §0.1, dowód markera, pomiar zasobów i
niniejszy raport STOP. Nie uruchomiłem kontenera, migracji, testów ani runtime'u;
nie zmieniłem żadnego pliku produkcyjnego.  
Co zrobiłbym, gdyby zapadła decyzja X: po zwolnieniu przybitego portu `5000`
wznowiłbym od BLOKU 0, postawił `cx-day166-pg` na `6057`, wykonał pełne migracje,
a dopiero potem R1–R4 i dowody mutacyjne. Zmiana przydziału portów wymaga nowej,
jednoznacznej instrukcji; sam nie wybieram portu zastępczego.  
Rekomendacja dla nadzorcy: zwolnić port `5000` albo wydać poprawioną instrukcję z
jednym spójnym zestawem zasobów oraz zaktualizowaną regułą STOP.  
Stan: zacommitowano wyłącznie raport; SHA zostanie uzupełniony przez historię gałęzi.  
Czy kontynuowałem pozostałe pozycje: NIE — §0.5 nakazuje zatrzymać cały dyżur przy
zajętym porcie `5000`.

## Korekty wobec instrukcji

Instrukcja jest wewnętrznie sprzeczna w przydziale zasobów:

- `Z7` przybija bazę `6057` i runtime `5000/5001`, a §0.5 nakazuje STOP przy ich zajęciu;
- tabela licencji w §4 podaje bazę `6066`, runtime `4996/4997` i pozwala wybrać kolejny wolny port.

Wybrano interpretację bezpieczniejszą i wcześniejszą w hierarchii zakazów:
`6057`, `5000/5001`, bez samodzielnego wyboru zamiennika. Wklejka użytkownika jest
zgodna z tym wyborem. Zajętość `5000` uruchomiła STOP całego dyżuru.

## Pomiar wejściowy wykonany przed STOP-em

Pomiar T1–T4 został wykonany w tej samej read-only kontroli zasobów, zanim wynik
portu został oceniony. Nie jest przedstawiany jako ukończenie R1:

- `decision_risks` ma `description`, `severity`, `likelihood`, `mitigation`,
  `owner_id`; brak `category` i `contingency`;
- `decisions.routes.ts` ma zero trafień `stakeholders`, frontend ma trafienia;
- liczba deklaracji tras routera decyzji według przybitego grepu: `29`;
- `UpdateDecisionSchema` już deklaruje `rationale`; notatka o jego utracie jest nieaktualna.

Nie wykonano pełnych tabel R1 ani żadnego dowodu runtime/DB, ponieważ STOP nastąpił
przed BLOKIEM 0.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano działania żadnej ścieżki HTTP przez `ApiGateway`.
- Nie zweryfikowano migracji ani schematu na realnym PostgreSQL dnia 166.
- Nie zweryfikowano round-trip ryzyka ani RACI.
- Nie zweryfikowano izolacji localStorage dwiema tożsamościami.
- Nie wykonano pomiaru zasięgu testów ani dowodu mutacyjnego red-green.
- Nie uruchomiono Railway, demo, stagingu ani produkcji; ich zachowanie pozostaje
  poza zakresem i jest niezweryfikowane.

## Z30 — deklaracja

Nie ustawiono żadnej zmiennej SMTP ani flagi wysyłki. Nie uruchomiono bazy,
`server/src/index.ts`, żadnego drenażu outboxu ani runtime'u. Żaden e-mail,
zaproszenie kalendarzowe ani powiadomienie zewnętrzne nie zostało wysłane.
