# K1-fix W77 — receipt E1

**Werdykt autorski: E1 GREEN, STOP do niezależnego review.** Paczka naprawia trzy P1 z Wpisu 77 bez zmian w kodzie produktu i bez dotykania plików zabronionych.

- Exact base: `dcbd6c052a15f6ef65a6ec698bb0cbda4a7902fe`.
- Odtworzony kandydat K1: cztery commity treści z `775947993ef96b1fcbd4e96fa725a48bae9dc7b3`, przeniesione na exact base.
- Content SHA po naprawie: `e75274e6fb50e371e7a0858bf52a35d4ea4a8117`.
- Gałąź: `codex/a-k1-fix-20260915`.
- Backup: `origin/backup/codex/a-k1-fix-20260915`.

## P1. Wspólny detektor

Helper korzysta z tego samego progu tokenu `>=2`, nazw własnych, fraz własnych i `pomijaneWartosci` co skaner. Nie zmieniono `jezykCzatu.source.test.ts`.

- regresja 12 wskazanych false positives: **12/12 GREEN**;
- dodatni kontrolny tekst PL bez ogonków: **1/1 GREEN**;
- `jezykCzatu.source.test.ts`: **5/5 GREEN**.

## P2. J-małe na linii

Progi są jawne i nie maskują wzrostu (`<=` dla bieżącego stanu, baseline wymaga dokładnej zgodności). Trafienia są długiem realnego angielskiego UI. Próbka w `K1_FIX_W77_JMALE_SAMPLE.json` przechowuje do 10 trafień na moduł; gdy mianownik jest mniejszy, przechowuje cały mianownik.

| Moduł | K4en | Próbka |
|---|---:|---:|
| 13 Organization | 2 | 2/2 |
| 08 Results | 65 | 10/65 |
| 12 Meeting | 0 | 0/0 |
| 03 Interview | 21 | 10/21 |
| 11 Audits | 4 | 4/4 |
| 06 Initiatives | 128 | 10/128 |
| 07 Execution | 139 | 10/139 |

Bramka J-małe: **14/14 GREEN**.

## P3. Precyzja wszystkich kubełków

`wartoscTechniczna()` jest stosowana w K4en, K5en i K8sen, zarówno w skanie pełnym, jak i szybkim. Wieloliniowe literały i tablice/wyrażenia JS nie są zaliczane jako UI.

- K4en: **30/30 realnych trafień + 30/30 pominięć technicznych**;
- K5en: **30/30 + 30/30**;
- K8sen: **30/30 + 30/30**;
- regresja kodu wieloliniowego/tablic: **3/3 pominięcia**;
- pełny miernik E2f-bis: **249/249 GREEN**.

Końcowy pełny pomiar: K4en `4632`, K5en `7164`, K8sen `2487`. Wskazane false positives `CompetencyCatalog.tsx:14` i `OrganizationAdminPanel.tsx:542` nie występują w raporcie. Pozostałe trafienia są zachowane jako dług zamiast ukryte przez wyjątki.

## Porównanie nazw porażek

Na exact base oba bezpośrednio dotknięte zestawy były zielone (`jezykCzatu` 5/5, J-małe 8/8), więc zbiór nazw porażek wynosił `∅`. Po odtworzeniu odrzuconego K1 pojawiło się osiem nazw: jedna bramka Czat, sześć progów modułowych oraz baseline J-małe. Po naprawie oba zestawy są zielone; **nowe nazwy względem exact base: 0**. Znane sześć porażek `PromptRegistryTab.honesty.test.tsx` pozostaje długiem exact base z W77 i nie jest w zakresie ani w diffie tej paczki.

## Bramki

| Bramka | Wynik |
|---|---|
| server TypeScript | `0` błędów, exit 0 |
| front TypeScript | `177` błędów, próg W77 `<=177` |
| `check:jezyk:ci` | GREEN |
| `check:list-canon --all` | GREEN, 349 = baseline 349 |
| `check:artefakt` | GREEN, 8 = baseline 8 |
| build sekwencyjny | GREEN, Vite `built in 39.48s` |
| `git diff --check dcbd6c052a..HEAD` | GREEN |
| pliki zabronione | 0 zmian |
| migracje | 0 |

Build zgłosił istniejące ostrzeżenia CSS/chunk-size, ale zakończył się powodzeniem. Front TSC zachował dopuszczony dług linii i nie jest deklarowany jako czysty.
