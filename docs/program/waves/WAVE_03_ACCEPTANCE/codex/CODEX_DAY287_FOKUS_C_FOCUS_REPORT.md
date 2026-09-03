# CODEX — dyżur 287 — fokus `c-focus`

## Baza i sanity

```text
MARKER OK
35afcb15fd7a432ab83df04208eb2114f1aa44e9
```

`git status --short | head -3` nie zwrócił żadnego wiersza. Dysk przed startem: 36 GiB wolne. Porty 6291, 5252 i 5253 były wolne.

Tip `github-backup/grafika/m03-20260902` uciekł przed marker; zgodnie z DEC-2026-08-26-95 praca startuje dokładnie z markera, bez rebase. Pełny log i lista różnic zostały zmierzone przed zmianami.

## R1 — pomiar i wzorzec

- PRZED: 193 wystąpienia w 94 plikach.
- Baseline PRZED: 227 wystąpień w 112 plikach.
- Kanon istniejący w repo: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus`.
- `VIOLATION_RE='ring-primary-|outline-primary-|ring-offset-primary-'` łapie `focus-visible:ring-primary-*` przez dopasowanie podciągu, ale nie łapie `crimson-*`. Naprawa przyrządu jest wymagana w R5.

## Korekty wobec instrukcji

Na markerze pomiar potwierdził tezę 193/94. Nowszy tip zawiera równoległe naprawy G14 i baseline, lecz nie został scalony, ponieważ instrukcja nakazuje start dokładnie z markera i zakazuje rebase.

## Wynik R2–R5

- R2: komponenty współdzielone zmierzone 193→180, 94→86; każdy zmieniony TSX przeszedł esbuild.
- Pełny diff produktu: 193→0 i 94→0; wszystkie 86 zmienionych TSX przeszły esbuild, `git diff --check` bez błędów.
- Zacommitowany, samospójny podzbiór: 110 usuniętych wystąpień; HEAD pozostawia 83/35 i ma zgodny baseline.
- Test: `focus canon zero guard keeps the baseline and tracked src debt at zero` — GREEN na pełnym diffie roboczym.
- Mutacja `focus:ring-primary-500`: guard RED rc=1, test RED rc=1; po cofnięciu przez `cp`: guard GREEN rc=0, test GREEN rc=0.

Pułapki (a)–(d) nie leżą na ścieżce: test czyta plik baseline i uruchamia wyłącznie lokalny `git grep`; nie montuje Gateway, auth ani DB. Pułapka (e) jest przedmiotem testu: jawny wzorzec obejmuje `focus`/`focus-visible`, `primary`/`crimson`, a zwykłe pierścienie stanu pozostają poza zakresem.

## Pomiar nazw testów

PRZED: brak testu (plik pusty). PO dodana pełna nazwa: `focus canon zero guard keeps the baseline and tracked src debt at zero`. Brak nazw znikniętych. Artefakty: `/private/tmp/cx-day287-fokus-artefakty/przed-nazwy.txt`, `po-nazwy.txt`, `nazwy.diff`.

## STOP — commit pozostałych 35 plików

Rodzaj: MERYTORYCZNY (konflikt dwóch wiążących bramek).

Powód: `check-triada` traktuje zastane klasy crimson na tej samej linii jako nowe naruszenia, a Z40 bezwzględnie zabrania dotykania czegokolwiek poza klasami pierścienia/obrysu fokusu.

Licencja, którą sprawdziłem: R3/R4 pozwalają wyłącznie na klasy fokusu; Z40 zakazuje zmian `bg-primary-*`, `text-primary-*`, `border-primary-*`, `hover:*`; hook musi być naprawiony kodem i nie wolno go ominąć.

Dowód: `/private/tmp/cx-day287-fokus-artefakty/triada-blocked-files.txt` — 36 plików pierwotnie sklasyfikowanych, z czego zacommitowany test kontraktowy pozostawia 35 plików produktu / 83 wystąpienia w HEAD. Przykład hooka: `AIConfigCore.tsx` blokowany przez zastane `text-primary-600 dark:text-primary-500`, mimo że diff zmienia tylko `focus:ring-primary-500/50` na `focus-visible:ring-c-focus`.

Co dostarczyłem ZAMIAST zmiany: pełny, zweryfikowany diff roboczy do zera; legalny podzbiór zacommitowany i wypchnięty; baseline cofnięty z 0 do uczciwego 83/35 dla zacommitowanego HEAD.

Co zrobiłbym, gdyby zapadła decyzja X: właściciel może zezwolić na jednoczesne usunięcie pozostałych klas crimson albo nadzorca może poprawić `check-triada`, aby porównywał tokeny dodane/usunięte zamiast całych linii. Wtedy gotowy diff 35 plików można commitować bez `--no-verify`.

Rekomendacja dla nadzorcy: naprawić promień hooka lub wydać osobną licencję na pozostałe tokeny; nie dodawać allowlisty i nie omijać hooka.

Stan: częściowo zacommitowano w `b91e835511`, baseline zgodny z HEAD w `b6542f5238`; pozostały diff niezacommitowany.

Czy kontynuowałem pozostałe pozycje: TAK — mechaniczna naprawa, esbuild, guard, test i mutacja wykonane; R6 nieuruchomione, bo zrzuty PO z niezacommitowanego, nieakceptowalnego przez hook drzewa nie stanowiłyby dowodu kandydatury do integracji.

## R6 — stan

`NOT_PROVEN`: nie wykonano 32 wymaganych kadrów PRZED/PO light/dark. Nie twierdzę, że zmiana została zweryfikowana wizualnie na ośmiu ekranach.

## Artefakty SHA-256

- `mutation-guard-red.txt`: `f0696a69c3653e127ff9419e6d10d5ffab92ab6efdd2b0701f3ed3977d7422b1`
- `mutation-test-red.json`: `9cd3c6ac3a4b890c234af84fc341765e8b4c21b652673ccee2a460533f476f77`
- `mutation-guard-green.txt`: `ed86d3273f718611f6c40870dafaf33b50362af3fad4ce8d4129a44c485c86c2`
- `mutation-test-green.json`: `829f2f68c59239b6f85255bc7a8939bc153956bd96a99e74f2d018eacf94135b`
- `triada-blocked-files.txt`: `68489f3f471e6ad5f705b1101ef9604539c0206ca27f30473a07a0f8ac1214ee`

## Deklaracja Z30

Nie uruchomiono bazy, serwera, Gateway ani runtime. Nie ustawiono zmiennych SMTP i nie uruchomiono drenaży. Żaden e-mail, zaproszenie kalendarzowe ani powiadomienie zewnętrzne nie zostało wysłane.
