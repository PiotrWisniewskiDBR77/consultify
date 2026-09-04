# CODEX — dyżur 315 — crimson Czatu i ekrany dowodowe

Stan: W TOKU. Gałąź `codex/day315-crimson-ekrany-20260904`, baza `bc18bc7acac2ec825ebb3db2f1309738ab034d58`.

## Wejście i marker

Dosłowny wynik kontroli markera:

```text
MARKER OK
```

Dosłowny wynik sanity worktree:

```text
bc18bc7acac2ec825ebb3db2f1309738ab034d58
```

`git status --short | head -3` nie zwrócił żadnego wiersza. Tip `github-backup/grafika/m03-20260902` uciekł do przodu o sześć commitów dokumentacyjnych; zgodnie z `DEC-2026-08-26-95` praca zaczęła się dokładnie z markera. Delta obejmuje wyłącznie `_instr_src/**` oraz instrukcje dyżurów 314–323 w `docs/**`; scalenie z tipem pozostaje po stronie nadzorcy.

Dysk przed startem: 76 GiB wolnego, po utworzeniu worktree 64 GiB. Porty 5471 i 6331 były wolne, kontener `cx-day315-pg` nie istniał. Lokalny `pgvector/pgvector:pg16` na `127.0.0.1:6331` zastosował 891 migracji; drugi przebieg: `Applying migrations: 0`.

## R1 — klasyfikacja każdego trafienia `primary-`

Pomiar: 15 trafień w 9 plikach, 10 poza testami. W produkcie jest 5 linii zawierających 7 realnych tokenów klas w 3 plikach. Polecenie `git grep -n 'focus:ring-primary-500' -- src/components/AIChat` zwraca zero; `ToolsMenu`, `MoveToProjectModal` i `CloudFilePicker` mają po zero trafień `primary-`. Tym samym liczby zamówienia 22 / 12 nie opisują markera; obowiązuje pomiar 15 / 0.

| Plik:linia | Treść trafienia | Klasa | Decyzja |
|---|---|---|---|
| `AiProviderErrorNotice.tsx:10` | komentarz `NIGDY primary-*` | NIE-KOLOR — komentarz | nie ruszam |
| `ChatSignalsPanel.tsx:458` | `data-testid="chat-signal-primary-action"` | NIE-KOLOR — literal / data-testid | nie ruszam |
| `ConversationSearch.tsx:19` | `group-focus-within:text-primary-500` | KOLOR — pierścień/obramowanie fokusu | R2: `text-c-focus` |
| `InlineResponseFeedback.tsx:280` | komentarz `primary-*` | NIE-KOLOR — komentarz | nie ruszam |
| `KimiWorkspace/ExceleRightPanel.tsx:17` | komentarz `zero primary-*` | NIE-KOLOR — komentarz | nie ruszam |
| `PrivateModeDetails.tsx:136` | `hover:bg-primary-100 dark:hover:bg-primary-900/40` | KOLOR — CTA albo stan aktywny | R2: neutralne `c-*` |
| `PrivateModeDetails.tsx:136` | `focus:ring-primary-400/50` | KOLOR — pierścień/obramowanie fokusu | R2: `c-focus` |
| `ProjectMembersModal.tsx:298` | `focus:border-primary-500` | KOLOR — pierścień/obramowanie fokusu | R2: `c-focus` |
| `ProjectMembersModal.tsx:421` | `focus:border-primary-500` | KOLOR — pierścień/obramowanie fokusu | R2: `c-focus` |
| `ProjectMembersModal.tsx:432` | `focus:border-primary-500` | KOLOR — pierścień/obramowanie fokusu | R2: `c-focus` |
| `Wave9OutcomeAIOpsPanel.tsx:225` | `provider: 'primary-llm'` | NIE-KOLOR — literal / data-testid | nie ruszam |
| `aiProviderErrorCopy.chatOwn016.test.tsx:126` | nazwa testu `NIGDY primary-*` | NIE-KOLOR — literal / data-testid | nietykalny test, nie ruszam |
| `aiProviderErrorCopy.chatOwn016.test.tsx:131` | regex `/primary-/` | NIE-KOLOR — literal / data-testid | nietykalny test, nie ruszam |
| `aiProviderErrorCopy.chatOwn016.test.tsx:136` | regex `/primary-/` | NIE-KOLOR — literal / data-testid | nietykalny test, nie ruszam |
| `aiProviderErrorCopy.chatOwn016.test.tsx:138` | regex `/primary-\\d/` | NIE-KOLOR — literal / data-testid | nietykalny test, nie ruszam |
| `aiProviderErrorCopy.chatOwn016.test.tsx:139` | regex `/primary-\\d/` | NIE-KOLOR — literal / data-testid | nietykalny test, nie ruszam |

Semantyka krytyczna sprawdzona i pozostawiona: ramka błędu AI w `AiProviderErrorNotice.tsx` używa `c-danger`; etykiety „Blokada” i „Krytyczny” w `ChatSignalsPanel.tsx` pozostają czerwone. Nie są trafieniami `primary-`, ale są jawnie zachowanym wynikiem kontroli.

## Bramki kanonu — PRZED

| Bramka | Wynik |
|---|---|
| `check-focus-canon.sh --ci` | PASS względem wzorca: 41 plików / 60 wystąpień; wzorzec widzi tylko `PrivateModeDetails` spośród 3 plików R2 |
| `check-artefakt.sh` | PASS: 8 aktualnych / baseline 9 |
| `check-list-canon.sh` | PASS po pełnym skanie fallback: 157 plików, 368 naruszeń / baseline 368 |

## Pomiar testów — PRZED

Pakiet jednostkowy uruchomiony jako `RUN_DB_TESTS=0 MOCK_DB=true ... --retry=0 --reporter=json`: 95/95 suit i 367/367 pełnych przypadków PASS. Pełne nazwy: `/private/tmp/cx-day315-crimson-ekrany-artefakty/przed-nazwy.txt`. To dowodzi wyłącznie zachowania jednostkowego; nie jest dowodem DB, HTTP ani produkcyjnego runtime. Pułapki `ENABLE_V8_GLOBAL`, beta visibility, `DB_TYPE=sqlite` i auth bypass nie leżą na tej czysto jednostkowej ścieżce; wymuszone `RUN_DB_TESTS=0 MOCK_DB=true` jawnie wyklucza dowód egzekucyjny.

## R2 — naprawa realnego crimsona

| Plik | Zmiana | Dowód |
|---|---|---|
| `ConversationSearch.tsx` | `group-focus-within:text-primary-500` → `group-focus-within:text-c-focus` | `esbuild` PASS, commit `e98a4bbbb5` |
| `PrivateModeDetails.tsx` | hover `primary-100/900` → `c-surface-hover`; ring `primary-400/50` → `c-focus` | `esbuild` PASS, commit `8e37e69f4c` |
| `ProjectMembersModal.tsx` | 3 × `focus:border-primary-500` → `focus:border-c-focus-solid` | `esbuild` PASS, commit `f650615ebf` |

Łącznie zmieniono dokładnie 5 linii i 7 tokenów klas. Hover i fokus w `PrivateModeDetails` są dwiema odrębnymi klasami naprawy mimo wspólnej linii `className`.

## R3 — rozszerzenie bezpiecznika

| Pomiar | Wynik |
|---|---|
| Wzorzec PRZED | `ring-(primary|crimson)-|outline-(primary|crimson)-|ring-offset-(primary|crimson)-` |
| Wzorzec PO | wzorzec PRZED + `(focus|focus-visible|group-focus-within):(border|text)-(primary|crimson)-` |
| Stan po R2 ze starym wzorcem | 40 plików / 59 wystąpień |
| Stan po rozszerzeniu przed baseline | 61 plików / 169 wystąpień, RC=1 |
| Dług odsłonięty | +21 plików / +110 wystąpień |
| Mutacja zabezpieczenia | pojedyncze `focus:border-primary-500` w `ProjectMembersModal.tsx` → RC=1, nowe naruszenie 1 |
| Po cofnięciu mutacji przez `cp` | RC=0, baseline 61 / 169; diff pliku produktu pusty |

**Cytowalne rozstrzygnięcie:** Do baseline weszło 110 wystąpień w 21 plikach jako dług odsłonięty przez poszerzenie miary, nie jako nowa regresja; jednocześnie `PrivateModeDetails.tsx` zniknął z baseline po naprawie R2, a trzy pliki dyżuru 315 mają baseline zero.

Nie użyto `--update-baseline`. Baseline zbudowano z jawnego pełnego pomiaru per plik, zapisano metadane 61/169 i zachowano ratchet per plik. Logi: `/private/tmp/cx-day315-crimson-ekrany-artefakty/focus-expanded-before-baseline.log`, `focus-expanded-counts.txt`, `focus-mutation-red.log`, `focus-mutation-green.log`.

## Korekty wobec instrukcji

- Pomiar potwierdził 15 trafień ogółem i 10 poza testami, a nie 22 z zamówienia nadzorcy.
- W całym `src/components/AIChat` jest zero `focus:ring-primary-500`, a nie 12; realny dług to 5 linii / 7 tokenów klas.
- Dowód braku konfiguracji poczty (`BRAK ZMIENNYCH POCZTY`, 0 wierszy `smtp%`, brak drenaży w `Gateway.ts`) wykonano po migracjach, a nie przed pierwszym zapisem migracyjnym. Migracje dotyczyły wyłącznie pustej lokalnej bazy; nie uruchomiono runtime, outboxu ani transportu. To uchybienie kolejności zostaje jawne i nie będzie powtórzone przed runtime.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano jeszcze nowych ekranów w realnym dev-render ani par PRZED/PO.
- Nie zweryfikowano jeszcze rozszerzonego bezpiecznika mutacją w obie strony.
- Nie rozstrzygnięto jeszcze usunięcia martwego poddrzewa `AgentAudit/` testem i buildem.
