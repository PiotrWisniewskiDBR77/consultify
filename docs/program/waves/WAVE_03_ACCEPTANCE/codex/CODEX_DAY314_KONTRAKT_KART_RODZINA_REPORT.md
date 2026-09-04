# CODEX DAY 314 — kontrakt kart, rodzina siedmiu typów

Stan roboczy. Baza: `bc18bc7acac2ec825ebb3db2f1309738ab034d58`; gałąź bazowa uciekła do przodu wyłącznie o dokumenty instrukcji. Flaga `ff.cardContract` pozostaje default OFF.

## Wejście

Marker:

```text
MARKER OK
bc18bc7acac2ec825ebb3db2f1309738ab034d58
```

Porty 5470 i 6330 były wolne przed startem. Dysk: 76 GiB wolnego. Kontener: `cx-day314-pg`, `pgvector/pgvector:pg16`, baza `cx314` na `127.0.0.1:6330`. Pierwszy przebieg migracji zakończył się `Postgres migrations complete`; drugi: `Applying migrations: 0` i `Postgres migrations complete`.

SMTP: środowisko `BRAK ZMIENNYCH POCZTY`; `SELECT ... FROM settings WHERE key LIKE 'smtp%'` zwrócił 0 wierszy; `Gateway.ts` nie zawiera drenażu outboxu.

## R1 — pomiar PRZED naprawą

Źródło liczb: `scripts/dev/grafika-zrzuty.mjs --zlicz`; JSON: `/private/tmp/cx-day314-kontrakt-kart-rodzina-artefakty/off.json` i `on.json`. PNG: katalogi `OFF` i `ON` obok JSON. Wszystkie liczby są identyczne w light i dark.

| Typ | Sekcje OFF | Sekcje ON | Grupy OFF | Grupy ON | Różnica sekcji/grup |
|---|---:|---:|---:|---:|---:|
| Initiative | 24 | 24 | 5 | 5 | 0 / 0 |
| Task | 8 | 4 | 0 | 0 | -4 / 0 |
| Decision | 6 | 4 | 0 | 0 | -2 / 0 |
| Notification | 3 | 2 | 0 | 0 | -1 / 0 |
| Insight | 22 | 10 | 5 | 3 | -12 / -2 |
| Interview | 8 | 3 | 3 | 1 | -5 / -2 |
| Tool | 4 | 3 | 3 | 2 | -1 / -1 |

Każdy z 14 wariantów light/dark ma własny plik PNG wskazany w polu `plik` JSON. Pary są różne: Initiative 0.8112/0.8116%, Task 0.3195/0.3196%, Decision 0.0950/0.0950%, Notification 0.1486/0.1482%, Insight 4.5011/7.6164%, Interview 11.0955/11.0684%, Tool 0.3841/0.3842% (light/dark).

Kontrola przyrządu na `karta-task`: bez rozwijania tekst 1081 znaków, z `--rozwin-sekcje=1 --cofnij-jesli-skraca=1` 1363; licznik w obu 8/0. Rozwijanie nie skróciło treści. Walidator oznaczył jednak wszystkie kadry jako `wynik BRAK`, bo menu `Więcej`/`Sekcje`/`Analizuj` pozostały `aria-expanded=false`. PNG i liczniki powstały, ale kompletność rozwinięcia kadru jest `PARTIAL`, nie PASS.

## R2 — przyczyna per typ

Inicjatywa jest zdrowa: puste `INITIATIVE_CONTRACT_HIDDEN_SEED` i permutacja 24 id. Dla każdego z sześciu pozostałych typów przyczyna jest taka sama, potwierdzona w jego własnym kontrakcie: `sets[0].cards = defaultCards` jest zamkniętą allowlistą; konsument przekazuje spec przy ON; `useCardLayout.ts:80-94` zamienia pierwszy zestaw w `visibleSet`; `NModeLeftNav` renderuje tylko widoczne id. Insight ma dodatkowy żywy `hiddenSectionIds`, ale w fiksturze startuje jako pusty; zmierzona strata 22→10 pochodzi z `spec`.

Korekty wobec instrukcji: uchwyt grup to `[data-nmode-section-group]`, nie nieistniejący `data-nmode-group`. Macierz JSON wymienia 7 ekranów, zaś katalog zawiera 8 plików przez dodatkowy `karta-task-pelna`.

## TWIERDZENIA NIEZWERYFIKOWANE

- R5: zachowanie rekordu z niepustym szablonem inicjatywy — jeszcze niezmierzone.
- R6: kanon kolejności grup — jeszcze nieodczytany.
- Pary po naprawie, dowody mutacyjne i końcowe bramki — jeszcze niewykonane.
