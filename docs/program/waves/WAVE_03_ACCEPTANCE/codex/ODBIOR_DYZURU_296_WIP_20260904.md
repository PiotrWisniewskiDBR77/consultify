---
doc_id: odbior-dyzur-296-wip-20260904
status: canonical
data: 2026-09-04
odbierajacy: Opus (odbiorca adwersaryjny), mandat nadzorcy sesji
galaz: codex/day296-wycieki-bledow-tras-20260903
---

# Odbiór dyżuru 296 (WIP Codexa) — wycieki surowych błędów w trasach

**WERDYKT: SCALIĆ Z ZASTRZEŻENIEM (5 zastrzeżeń, 1 z nich produktowy).**

Odbiór zacommitowanego stanu dawał wcześniej „0/294 zamienione — niewykonany". To był
fałsz **przyrządu, nie dyżuru**: praca istniała jako 73 niezacommitowane pliki w worktree
`/private/tmp/cx-day296-wycieki-bledow`. Kształt: *zrobione, ale niezapisane* — odbiór
mierzył `HEAD`, a wynik leżał w drzewie roboczym.

## 1. Co zastałem i co zacommitowałem

| Pomiar | Wartość |
| --- | --- |
| Plików zmodyfikowanych (niezacommitowanych) | **73** (72 × `server/src`, 1 × `scripts/dev`) |
| `git diff --stat` | **73 files changed, 432 insertions(+), 352 deletions(-)** |
| esbuild per plik (72 × `.ts` + 1 × `.mjs`) | **73/73 czyste, 0 błędów** |
| Wstawień mappera (inwentarz dyżuru, marker `984d3658fd`) | **341 miejsc w 71 plikach** |

Commity odbioru na gałęzi:

| SHA | Co |
| --- | --- |
| `613b455fa8` | WIP Codexa (`server/src`) zacommitowany |
| `3646d85c65` | `scripts/dev/codemod-error-mapper.mjs` — narzędzie zgodne z zastosowanym wynikiem (poza `server/src`, dodane po ocenie: bez tego commitu narzędzie w repo nie odtwarza wyniku) |
| `0de9a39eb4` | poprawka asercji jednego testu (patrz §4) |
| `4b3118cdad` | naprawa 14 miejsc uszkodzonych przez codemod + guard 312 celujący w odpowiedzi HTTP z ratchetem długu |

## 2. Mianownik PRZED / PO

Komendą odbiorcy (`error: (err|error as Error).message` · `error: err|error|e.message` · `message: (err|error as Error).message`, `-- server/src/routes`):

| Stan | Linii |
| --- | ---: |
| PRZED — m03 `HEAD` | **305** (nie 294; liczba nadzorcy zaniżona o 11 — sprostowanie) |
| PRZED — `HEAD` gałęzi 296 bez WIP | 305 |
| PO — z WIP | **1** — i ta jedna to *komentarz* w `server/src/routes/__tests__/presentations.error-disclosure.test.ts:20`, nie kod |

**Mianownik odbiorcy pokazuje 100% sukcesu. Szerszy pomiar tej samej rodziny go obala** —
regex odbiorcy (jak i codemodu, jak i guardu 312) nie obejmuje castu `(e as Error)` ani pola
`details`:

| Wzorzec `(error|message|details): <err>.message` w `server/src/routes` | Linii |
| --- | ---: |
| m03 `HEAD` (PRZED) | **396** |
| gałąź 296 z WIP (PO) | **55** |
| — z tego wywołania `logger.*` (uprawnione: log MA nieść surową treść) | 48 |
| **— realne wycieki w odpowiedziach HTTP, które zostały** | **35** |

35 pozostałych wycieków siedzi w **dwóch plikach**: `table-platform.routes.ts` (28) i
`data-collection.routes.ts` (7). Ten drugi **w ogóle nie wszedł w zakres dyżuru** — cały jego
wzorzec to `(e as Error)`, więc codemod go nie zobaczył.

## 3. Diff — czy zamiana jest mechaniczna

Obejrzałem diff 10 plików (`auth`, `v8/finance`, `table-platform`, `meeting`,
`resultsVnext/okr`, `documents`, `syncHub`, `pmo/initiatives`, `v8/interview`,
`resultsVnext/kpi`). **Kodów HTTP dyżur nie tknął — potwierdzam.** Kształt odpowiedzi
zachowany (`code`, `details`, `success` zostają; mapper dokłada `errorCode` + `correlationId`).
Ale zamiana **nie jest w pełni mechaniczna** — codemod jest tekstowy, bez AST, i uszkodził
14 miejsc:

| # | Co | Gdzie | Skutek |
| --- | --- | --- | --- |
| U1 | Zepsuty komentarz JSDoc — codemod podmienił kod *w tekście dokumentacji* | `pmo/initiatives.routes.ts:116` | Dokumentacja obrony przed wyciekiem opisywała samą siebie jako mapper |
| U2 | Mapper wstawiony do **5 wywołań `logger.error`** (nie odpowiedzi HTTP) | `table-platform.routes.ts` (SCIM ×5) | Log tracił surową treść **i** mapper sam woła `logger.error` → podwójny wpis na każdy błąd SCIM |
| U3 | Martwy fallback po spreadzie: `{...map(...) \|\| 'Not found'}` / `\|\| 'Storage quota exceeded'` — **8 miejsc** | `resultsVnext/{kpi,kpiDeviation,kpiPerspectives,kpiScorecard,okr,roi}`, `documents`, `v8/interview` | Fallback martwy (obiekt zawsze truthy); śmieć składniowy, mylący przy czytaniu |

**Wszystkie 14 naprawiłem** (`4b3118cdad`); esbuild po naprawie 11/11 czysty.

## 4. Testy tras — PRZED / PO

`cd server && npx vitest run src/routes/__tests__/`. Baza = drugi worktree na m03 `HEAD`
(`0f98fe63e5`; m03 przesuwało się w trakcie odbioru — na koniec `d542b5600c`).

| | Test Files | Tests |
| --- | --- | --- |
| Baza m03 | 65 failed \| 89 passed \| 17 skipped (171) | **271 failed** \| 827 passed \| 144 skipped |
| Gałąź 296 (WIP, przed naprawą) | 63 failed \| 88 passed \| 17 skipped (168) | 272 failed \| 826 passed \| 142 skipped |
| **Gałąź 296 (po naprawach odbioru)** | 62 failed \| 89 passed \| 17 skipped (168) | **271 failed** \| 827 passed \| 142 skipped |

Porównanie po **zbiorach nazw plików**, nie po liczbach (baza ma 3 pliki `.pg`, których gałąź
jeszcze nie zna — powstały po merge-base):

- **Nowe czerwone: 0.**
- Jeden test wymagał poprawy asercji: `deliverableTemplates.provenance.test.ts:387` żądał
  `expect(res.body.error).toContain('tmpl-777')` — czyli **wymagał, żeby identyfikator zasobu
  wyciekł w treści błędu**. Zgodnie z rejestrem dyżuru 296 („Statusy HTTP, w tym istniejace
  odpowiedzi 200 z polem `error`, nie sa zmieniane w dyzurze 296") status 404 zostawiłem, a
  kontrakt przeniosłem z surowej treści na `errorCode` + `correlationId` (`0de9a39eb4`).

## 5. Guard 312 (`89619c1adf`) — bezpiecznik zbudowany pod własną naprawę

Test `tests/unit/backend/security/noRawErrorMessage.test.ts` przechodził. Mutacja:

| Mutacja wstawiona w trasę | Guard 312 (oryginalny) | Guard po poprawce odbioru |
| --- | --- | --- |
| `res.json({ error: (err as Error).message })` | **CZERWONY** (poprawnie) | CZERWONY |
| `res.json({ error: (e as Error).message })` | **ZIELONY — przepuszcza** | CZERWONY (ratchet 36 > 35) |
| `logger.error('probe', { error: (e as Error).message })` | CZERWONY (fałszywy alarm — log ma prawo do treści) | ZIELONY |

Guard 312 używał **dosłownie tego samego regexu co codemod**. Nie mógł złapać niczego, czego
codemod nie umiał naprawić — i faktycznie przepuszczał wariant, w którym siedzi 35 realnych
wycieków. To dwudziesty-któryś kształt fałszywego „gotowe": **bezpiecznik odbija zakres
naprawy, nie zakres defektu.**

Poprawiony guard (`4b3118cdad`): (a) celuje w odpowiedzi HTTP, wyklucza `logger.*` i komentarze;
(b) drugi test — ratchet długu na wartości **35** dla pełnej rodziny (`(e as Error)` + `details`),
żeby dług był policzalny i nie rósł. Trzy mutacje wyżej to dowód mutacyjny, nie deklaracja.

## 6. Kontrola scalenia

```
merge-base(m03 HEAD, gałąź) = 984d3658fd   (marker inwentarza dyżuru — zgodny)
git merge-tree --write-tree --messages ...  → CONFLICT: 0
```

## 7. Zastrzeżenia (warunki scalenia)

| # | Zastrzeżenie | Waga |
| --- | --- | --- |
| **Z1** | **Rodzina niedomknięta: 35 realnych wycieków HTTP zostało** — wariant `(e as Error)` (7) i pole `details` (28) w `table-platform.routes.ts` + `data-collection.routes.ts`. Dyżur zamknął jedną gałąź rodziny i zameldowałby „0", gdyby nie szerszy pomiar. **Osobny dyżur naprawczy** (`details` czyta front — wymaga decyzji o kształcie). Dług spięty ratchetem 35. | **Wysoka** |
| **Z2** | **Komunikaty domenowe zastąpione generykiem.** Mapper zwraca surową treść tylko dla `AppError` z `isOperational`. Zweryfikowałem: `OkrCycleProgramNotActiveError`, `FinanceSettingsCommandError`, `TemplateNotFoundError`, `CommandCapabilityDeniedError` — **żadna nie dziedziczy `AppError`** (wszystkie `extends Error`). Skutek: setki komunikatów biznesowych („cykl nie jest aktywny", „szablon już zatwierdzony") stają się „The operation conflicts with the current state." **Regresja UX na ~341 miejscach.** | **Wysoka — produktowa** |
| **Z3** | **`req` przekazywany jako `undefined` we WSZYSTKICH 341 wywołaniach** (codemod nie próbował sięgnąć po `req`). Skutek: `Accept-Language` nieodczytany → **polski słownik komunikatów w mapperze nigdy się nie uruchomi**, użytkownik PL dostaje angielski generyk; `method`/`path` w logu diagnostycznym puste. `correlationId` ratuje `getCorrelationId()` z `RequestStore`. | Średnia |
| **Z4** | **`errorCode` niespójny ze statusem HTTP.** Dowód z testu: `TemplateNotFoundError` → HTTP **404**, ale ciało niesie `errorCode: 'INTERNAL'` i „An unexpected error occurred." — bo `classify()` czyta tylko `statusCode`/`code` z obiektu błędu, a klasy domenowe ich nie mają. Klient nie odróżni „nie ma zasobu" od „awaria". | Średnia |
| **Z5** | **Guard 312 był bezpiecznikiem pod własną naprawę** (§5). Naprawiony w odbiorze; wymaga świadomości, że ratchet 35 to **dług, nie zero**. | Naprawione w odbiorze |

## 8. Werdykt

**SCALIĆ Z ZASTRZEŻENIEM.** Za scaleniem: wyciek informacji to defekt bezpieczeństwa, a dyżur
usuwa 341 z 396 wystąpień; kody HTTP nietknięte; kształt odpowiedzi zachowany (front czytający
`error` nie pęka); 0 nowych czerwonych testów; 0 konfliktów; esbuild 73/73. Przeciw natychmiastowemu
zamknięciu: Z1 (rodzina niedomknięta) i Z2 (regresja UX komunikatów) wymagają dyżurów
następczych — bez nich „wycieki naprawione" byłoby zdaniem nieprawdziwym w obie strony.

Zadania następcze:
1. Dyżur: domknąć 35 wycieków `(e as Error)` / `details` (Z1) — ratchet 35 → 0.
2. Dyżur: klasy błędów domenowych dziedziczą `AppError` z `isOperational` + `statusCode`, żeby
   mapper przepuszczał komunikat biznesowy i wystawiał zgodny `errorCode` (Z2 + Z4 jednym ruchem).
3. Dyżur: przekazać `req` do mappera tam, gdzie jest w zasięgu (Z3) — odblokowuje polskie komunikaty.
