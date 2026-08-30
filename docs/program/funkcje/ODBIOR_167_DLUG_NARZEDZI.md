---
doc_id: funkcje-odbior-167
status: canonical
owner: piotr
truth_type: work-status
established: 2026-08-30
---

# ODBIÓR 167 — spłata długu w narzędziach pomiarowych

**Klasyfikacja per pozycja: P1 = B · P2 = B · P3 = A · P4 = A.**
**Zero naruszeń licencji** — sprawdzone plik po pliku.

Marker `22124537f7`, 6 commitów, 6 plików. `.husky/` nietknięty (wybrano jedno
z dwóch dozwolonych miejsc). `day161-fresh-migration-check.sh` — **suma kontrolna
identyczna przed i po**, czyli wpięto go, nie przepisano.

## P1 — naprawa działa, ale problem jest w połowie zamknięty. **Wina moja.**

Poprawka `server/vitest.config.ts` → `DB_TYPE: process.env.DB_TYPE || 'sqlite'`
zweryfikowana mutacyjnie w niezależnym odtworzeniu (własny kontener, port 6062,
868/868 migracji):

| stan | wynik |
|---|---|
| przed (przywrócona stara linia) | `AssertionError: expected 'sqlite' to be 'postgres'` |
| po | **2/2 PASS** |
| bez podania `DB_TYPE` | zachowanie **niezmienione** — sqlite jak dotąd |

To była najważniejsza część: naprawa, która po cichu przełączyłaby setki testów
na inną bazę, byłaby gorsza od przypięcia. **Nie przełączyła.**

### ★ Czego raport nie ujawnił — i dlaczego to moja odpowiedzialność

`vitest.config.ts:210` w korzeniu repo **nadal ma `DB_TYPE: 'sqlite'` na sztywno**.
To nie jest martwy plik — steruje `tests/integration/**` i `tests/acceptance/**`.

```text
$ grep -rln "process.env.DB_TYPE = 'postgres'" tests/ | wc -l
80
```

**Osiemdziesiąt plików testowych ręcznie obchodzi ten sam błąd.** Jeden z nich
dokumentuje go wprost:

```ts
// vitest.config pins sqlite after reading the shell; restore the explicitly
// requested real-PG mode for this isolated evidence package.
process.env.DB_TYPE = 'postgres';
```

**Defekt był znany i obchodzony osiemdziesiąt razy zamiast naprawiony raz.**

**Ale wykonawca nie mógł go tknąć — bo ja mu nie pozwoliłem.** Moja tabela licencji
wymieniała imiennie **wyłącznie** `server/vitest.config.ts`, mimo że pułapka w tej
samej instrukcji mówiła o **obu** plikach. Wykonawca dotrzymał litery licencji.
**To jest ten sam kształt błędu autorskiego, który kosztował cztery STOP-y w sesji
#11: sprzeczność między częścią wspólną instrukcji a treścią merytoryczną.**

Zarzut wobec raportu zostaje jeden i jest słuszny: **należało dać STOP** — dokładnie
tak, jak zrobiono w P2 dla drugiego pliku testowego. Milczenie o połowie problemu
jest gorsze niż zgłoszenie blokady.

**Do naprawy osobnym dyżurem, z licencją obejmującą root config.**

## P2 — prawdziwa naprawa, nie usunięcie asercji

`aiActionExecutor.wave3-runtime.test.ts` — diff pokazuje **zmianę wartości
oczekiwanej** (`rollback_available` → `rollback_unavailable`, `true` → `false`),
**nie skasowanie sprawdzenia**. To była moja główna obawa. 5/5 PASS.

STOP na `wave3-governance-contract.test.ts:116` **merytorycznie trafny**: ten test
skanuje plik źródłowy jako tekst i sprawdza `toContain('rollback_available')`.
Napis istnieje wyłącznie w **adnotacji typu** (linia 146), a funkcja zawsze zwraca
`'rollback_unavailable'`. **Test mierzy obecność napisu, nie zachowanie** — i przez
to przechodzi, choć produkt zachowuje się odwrotnie.

**Inwentarz wzorca policzony własną metodą: 107 plików / 1557 linii.**
Kontrolne przeliczenie audytora: **104 / 1488** — ten sam rząd wielkości, drobna
różnica metodologiczna. **Obie liczby są jednoznacznie różne od moich szacunków
(247 i 55)** — czyli wykonawca zmierzył sam, zamiast przepisać moją hipotezę.
Dokładnie o to prosiłem.

**Zastrzeżenie do rozstrzygnięcia:** raport twierdzi, że licencja pozwalała
wyłącznie na **linię 116**. Moja instrukcja wymieniała **cały plik**. Audytor
ustalił, że przepisanie testu na wywołanie publicznego `execute()` **było
technicznie wykonalne** w granicach pliku, kosztem powielenia infrastruktury
atrap. Czyli STOP był ostrożniejszy, niż musiał — ale w tę stronę wolę błąd.

## P3 — bramka startuje sama. **A.**

```text
$ grep -r day161 package.json .github/workflows/ .husky/
package.json:12
.github/workflows/day161-fresh-migration-gate.yml
```

Jedno miejsce wpięcia, zgodnie z licencją. Workflow **bez warunku `if:`**, wyzwalany
na `push`/`pull_request` do `main`/`develop`/`Londyn`/`demo`, z filtrem ścieżek
obejmującym `server/migrations/**`. **Realnie odpali się przy zmianie migracji.**

**Czas zmierzony niezależnie: 14,4 s** (raport podaje 23,27 s — ten sam rząd
wielkości). To potwierdza wybór CI zamiast hooka: kilkanaście–kilkadziesiąt sekund
przed **każdym** commitem blokowałoby pracę.

**Dowód mutacyjny odtworzony:** usunięcie strażnika z migracji 159 → bramka
`✗ column k.metadata does not exist`, exit 1. Po przywróceniu — drzewo czyste.

Nie uruchomiono realnego przebiegu w GitHub Actions — **wykonawca przyznał to sam**
jako `PARTIAL`, i słusznie, bo wymagałoby pusha.

## P4 — parser naprawiony. **A.**

Liczby odtworzone **co do cyfry** niezależnym uruchomieniem skryptu:

| | stary parser | nowy |
|---|---|---|
| producenci rozpoznani | 3032 | **3393** |
| nierozpoznani | 424 | **63** |
| kandydaci inwersji | 24 | 27 |

Przypadek kontrolny `trusted_devices.credential_hash` — **druga klauzula**
w wieloklauzulowym `ALTER TABLE` (`20261039_settings_mfa_challenges.sql:16-21`) —
jest teraz rozpoznana. Stary parser ją gubił.

Raport **nie obiecuje**, że znalazł potwierdzone defekty — podaje kandydatów wedle
opisanej metody. Prosiłem o to wprost i zostało dotrzymane.

## Odpowiedź na pytanie odbioru

**Czy kolejny wykonawca odtworzy dowód PG z samego raportu, bez obchodzenia configu?**

**Dla testów pod `server/` — tak.** Dla ~80 testów `tests/integration/**`
sterowanych root configem — **nadal nie**, bo ten plik został nietknięty.

## Czego NIE zweryfikowano

- Pełnego porównania agregatu 13 685 testów przed i po — zaufano logice `||`,
  potwierdzonej bezpośrednio, ale nie przeliczono.
- Realnego przebiegu joba w GitHub Actions — niemożliwe bez pusha.
- Wszystkich 1557 linii inwentarza `toContain` — tylko rząd wielkości.

## Werdykt

**Do scalenia.** Cztery pozycje, dwie na A z niezależnie odtworzonymi dowodami,
dwie na B z nazwanymi ograniczeniami. Zero naruszeń licencji.

**Wniosek dla mnie:** tabela licencji musi wymieniać **wszystkie** pliki, o których
mówi treść merytoryczna. Rozjazd między nimi kosztował tu połowę naprawy —
i po raz kolejny w tym programie.
