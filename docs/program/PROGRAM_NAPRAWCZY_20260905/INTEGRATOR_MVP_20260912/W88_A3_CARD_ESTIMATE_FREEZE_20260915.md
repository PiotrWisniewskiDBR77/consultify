# W88 A3 — karty N z wyceną — READY FOR CTO REVIEW

**Werdykt:** paczka A3 jest zamrożona jako **READY FOR CTO REVIEW** na bazie
`8c023561c4`; nie była uruchamiana ani zapisywana na stagingu.

## Zakres

- rozszerzenie istniejącego, niezmiennego silnika kart DEC-489 o wycenę, podstawę,
  autora i czas bez budowy drugiego obiegu zatwierdzania;
- addytywna migracja `20262240_initiative_card_estimate.sql` z zasadą: komplet
  czterech pól wyceny albo wszystkie pola `NULL`;
- publikacja wyceny i przeniesienie tego samego śladu do niezależnej wersji
  `ACCEPTED`;
- karta Definition pokazuje wycenę oraz widoczną, wyłączoną akcję akceptacji
  użytkownikowi bez uprawnienia;
- flaga `VITE_INITIATIVES_PORTFOLIO_ANALYSIS` pozostaje domyślnie `false` i ma
  wymagane `ARG`/`ENV` w `Dockerfile.api`.

## Dowody zachowania

- realny PostgreSQL 16 + pgvector, baza `a3_w88`, migracja wykonana dwukrotnie:
  druga próba idempotentna;
- `initiativeCardEstimate.pg.test.ts`: **2/2 PASS** — zwykła karta zachowuje
  pełny tuple wyceny jako `NULL`; karta z wyceną zachowuje autora/czas i kopiuje
  ten sam ślad do wersji zaakceptowanej;
- importery i zachowanie UI/API: **17/17 PASS**, `--retry=0`;
- `check:flagi:dockerfile`: **PASS**, `analyzedFlags=193`, `dockerArgs=204`,
  `wyjatki=13`, `brakujace=0`;
- `check:artefakt`, `check:list-canon`, `check:jezyk:ci`: **PASS**; nowych
  `as any` względem bazy: **0**;
- produkcyjny `npm run build`: **PASS** przy projekowym limicie Node 8 GiB,
  10 952 moduły; pierwsza próba przy domyślnych 4 GiB zakończyła się OOM;
- serwerowy TypeScript: **22 istniejące błędy** poza plikami paczki; frontendowy
  TypeScript nie zakończył się w limicie 120 s, więc pozostaje `NOT_PROVEN`.

## Dowód wizualny i kolejka akceptu

- dokładnie jeden obraz:
  `evidence/a1-card-estimate/a3-initiative-card-estimate-en-light.png`
  (2880×2400, 696 859 B), sprawdzony wizualnie; pokazuje wycenę `40–60 h`,
  podstawę, autora, czas oraz brak uprawnienia do akceptacji;
- docelowy URL po wdrożeniu CTO:
  `https://staging.consultify.ai/initiatives` → podgląd inicjatywy → Definition;
- wymagane flagi: `VITE_INITIATIVES_PORTFOLIO_ANALYSIS=true` oraz istniejąca
  `ENABLE_INITIATIVE_APPROVAL_V2=true`;
- pozycja odbiorowa: `TRZY_POJEMNIKI_PRACY_20260906.md`, kolejka **#12**.

## Granice odbioru

Paczka nie zawiera wdrożenia, zmiany zmiennych Railway ani zapisu danych na
stagingu. Żywy URL i dane Northwind wymagają scalenia, wdrożenia i włączenia flag
przez CTO; do tego czasu dowód stagingowy pozostaje `BLOCKED BY CTO DEPLOY`.
