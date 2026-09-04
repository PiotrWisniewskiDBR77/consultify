# Dyżur 335 — R3, wykonanie kubełka maszynowego

## Protokół Z30

Przed pierwszym zapisem: brak zmiennych `SMTP_`, `RESEND`, `SENDGRID`, `MAIL`; tabela `settings` zwróciła 0 wierszy `smtp%`; `Gateway.ts` nie montuje drenażu. Log: `/private/tmp/cx-day335-g19-regresja-artefakty/z30-przed-zapisem.log`, SHA-256 `842bb19ed1a807480ac7b038e041162199f0d8fb7fbb1a02fbe2e5b17e3f1456`.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Trzy bloki na HEAD

| Blok | Wykonane | Zielone | Czerwone | Artefakt SHA-256 |
| --- | ---: | ---: | ---: | --- |
| 1, UI jednostkowe | 131 | 127 | 4 | `ae680e43cd845daf0fbf7e94aa72b9109cd033a88f6cf6832705fd697c26c335` |
| 2, middleware jednostkowe | 218 | 218 | 0 | `9205e321050497e8bf24e0dd1e17ff3c398da2003bae39a81b21a8fff27fc9dc` |
| 3, trasy przez ApiGateway/JWT/RealPG | 18 | 12 | 6 | `7ccf289092061b3b866f0cc825e0912c473c4052f052a38ade788a0716e59dbd` |

Pierwsza próba Bloku 3 z roota wykonała 0 przypadków i została odrzucona jako błąd komendy. Powyższy wynik pochodzi z `server/` i `server/vitest.config.ts`.

Pułapki §0.2e: Blok 1 mockuje DB (`RUN_DB_TESTS=0`, `MOCK_DB=true`) i dowodzi wyłącznie zachowania komponentów, nie zapisu. Blok 2 jest jednostkowy i nie dowodzi realnego PG. Blok 3 dostał w tej samej linii `RUN_DB_TESTS=1`, `MOCK_DB=false`, `DB_TYPE=postgres`, `NODE_ENV=test`, `ENABLE_V8_GLOBAL=true`, `ENABLE_TEST_AUTH_BYPASS=false`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`, lokalny `DATABASE_URL`, JWT oraz `--retry=0`; 18 wykonanych wyklucza fałszywy exit 0 bez testów.

## Werdykt o dowodzie day307

Test `Day 307 paired cross-org GET flight through ApiGateway denies foreign workload lookup while the owner reads the seeded task` zamyka opisaną w starym G19 granicę dla jednego konkretnego istniejącego obiektu: obcy token dostaje 404 `TASK_WORKLOAD_USER_NOT_FOUND`, a właściciel ten sam `userId` odczytuje jako 200 z `total: 1` i projektem `day307-project-owner`. Test używa produkcyjnego `ApiGateway.initializeRoutes(app)`, dwóch podpisanych JWT i lokalnego PostgreSQL po pełnych migracjach. Nie budowano duplikatu day335.

Seeder 307 był fail-closed na historyczne 6314/cx307. Użyto kopii poza repo, zmieniając wyłącznie guard na przydzielone 6371/cx335; źródło w repo pozostało niezmienione.

## Mutacja zabezpieczenia

- GREEN: 1 wybrany przypadek przeszedł; artefakt `day307-green.json`, SHA-256 `3b59d1d8f94d92ebe312c3176fb577b1d0ef61ecfa316e08dfdf32828740248c`.
- MUTACJA: w `TaskController.getUserWorkload` usunięto `AND organization_id = ?` z prechecku użytkownika, po kopii `cp` do scratch.
- RED: pełna nazwa `Day 307 paired cross-org GET flight through ApiGateway denies foreign workload lookup while the owner reads the seeded task`; obcy zaczął dostawać 200, błąd `expected 200 to be 404`; SHA-256 `e7cec7bb1a8f5ffa924fb437780c7e29ec768b0d2ce492774b68c90b36600578`.
- PRZYWRÓCENIE przez `cp`: ponownie GREEN, SHA-256 `07f5050d7fcb73a7a3e1039cd3af3468e36d0d494034d58f039a36840fc82e1a`.
- `git diff -- server/src/controllers/TaskController.ts` po przywróceniu: pusty.

Pułapki §0.2e dla day307: realny Gateway/PG i jawne env wyłączają atrapę; `ENABLE_TEST_AUTH_BYPASS=false` wymusza `verifyToken`; właścicielski odczyt 200 tego samego obiektu wyklucza fałszywe 404/404; `--retry=0`; mutacja dokładnego filtra daje RED.

## Granica

Ten dowód zamyka konkretną lukę D-a2 dla workload, nie dowodzi wszystkich 1904 tras macierzy 307 ani warstwy wizualnej, języka czy stagingu. Blok 3 ma sześć aktualnych czerwieni, które są sklasyfikowane w R4.
