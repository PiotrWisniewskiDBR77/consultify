# CODEX DAY 218 — ADMIN / POLITYKI AI

Data: 2026-09-01  
Stan: `FIXED / MUTATION_VERIFIED / VISUAL_PROOF_6_OF_6`  
Gałąź: `codex/day218-admin-polityki-20260901`  
Marker: `9fb7942a01`

## Wynik

Ekran nie zamienia już trzech różnych problemów w `Nieznany / 0 / n/d`.
Dodano addytywną tabelę `llm_org_policies`; API niesie niezależne statusy
`governance`, `context`, `llm` (`ok | unavailable`); front czyta realne pola
`currentLevel`, `internetEnabled`, `auditRequired` i `piiRedaction`.
Nieistniejące koncepty `modelCount`, `budgetStatus`, `defaultSensitivity` oraz
`allowExternalContext` nie zostały sfabrykowane.

## Baza, marker i rozbieżność tipa

Wynik §0.1(2), dosłownie:

```text
9fb7942a01 G-3 c.d.: Gamma SAMA ostrzega ze uklady rozjada sie w PPTX (...)
MARKER OK
```

Wynik §0.1(7), dosłownie:

```text
9fb7942a0117aaf4001836f00bf8bbdc4e717669
```

Tip gałęzi bazowej był sześć commitów przed markerem; `git diff --name-only`
pokazał wyłącznie dokumenty instrukcji/pomiarów, bez plików produktu dyżuru.
Zgodnie z DEC-2026-08-26-95 praca wystartowała dokładnie z markera.

## Pomiary T1–T8 i korekty wobec instrukcji

- T1: zero migracji tworzących `llm_org_policies` — potwierdzone.
- T2: handler `:2561`, montaż `Gateway.ts:639` — potwierdzone.
- T3/T3b: backend ma `currentLevel/capabilities/internetEnabled/auditRequired`,
  front czytał `policyLevel/modelCount/budgetStatus` — potwierdzone.
- T4: backend ma `categories/piiRedaction/retention`, front czytał
  `defaultSensitivity/allowExternalContext` — potwierdzone.
- T5: świeży PostgreSQL po pełnych migracjach: `ai_policies` i
  `organization_ai_settings` istnieją; `llm_org_policies` przed zmianą nie.
- T6: selektywne wyciszanie występuje w `all()`, nie w `get()` — potwierdzone.
- T7: trzy niezależne bloki `try/catch` — potwierdzone.
- T8: zero istniejących harnessów tego panelu — potwierdzone.
- Korekta konfiguracji testu: `server/vitest.config.ts` zebrał `0` testów dla
  `adminP32.routes.test.ts`; root config zebrał realne `30/30`. Wyniku 0 nie
  uznano za PASS.
- Korekta fixture: mutacja `policy_level=PROACTIVE` była legalnie ograniczana
  przez `max_policy_level=ASSISTED`; fixture ustawia jawnie `AUTOPILOT`.
- Korekta migratora: po `DROP TABLE` replay daje `Applying migrations: 0`, bo
  ledger pamięta plik. Stan odtwarzano wyłącznie nowym kontenerem.

## Migracje i RealPG

Pierwsza baza markera: `Applying migrations: 876`, replay `0`. Po dodaniu
migracji na nowej pustej bazie: `Applying migrations: 877`, replay `0`.
Realne tabele po łańcuchu:

```text
ai_policies | organization_ai_settings | llm_org_policies
```

Pakiet `tests/integration/adminAiPolicySummary.day218.test.ts`, pełny env w tej
samej linii, `--retry=0`, realny `ApiGateway.initializeRoutes(app)`, podpisany
JWT i PostgreSQL: `3/3 PASS`:

1. SQL `ASSISTED/on` widoczny przez HTTP; mutacja SQL na `PROACTIVE/off`
   zmienia odpowiedź.
2. Tabela istnieje, brak wiersza: `llmPolicy=null`, `statuses.llm=ok`.
3. Tabela usunięta: `llmPolicy=null`, `statuses.llm=unavailable`.

Pułapki Z33: `ENABLE_V8_GLOBAL=true`, `ENABLE_TEST_AUTH_BYPASS=false`,
`RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`, `MOCK_DB=false`,
`DB_TYPE=postgres`; test sam asertuje efektywny `DB_TYPE`. `dbGet` dla LLM ma
`fallback:false`, więc błąd nie może zostać zamieniony w pusty wynik.

## Dowód mutacyjny RED → GREEN

Mutacja produkcyjna: usunięto wyłącznie `llmStatus = 'unavailable'` w catch.

```text
RED: 2/3 PASS, 1/3 FAIL
expected 'ok' to be 'unavailable'
```

Po przywróceniu przez kopię: `MUTATION DIFF EMPTY` (bajtowa zgodność `cmp`).

```text
GREEN: 3/3 PASS, 0 FAIL
```

## Zasięg testów pełnymi nazwami

Przed: 32 pełne nazwy (30 routing + 2 istniejący panel). Po: 38 unikalnych
pełnych nazw. `nazwy-diff.txt` pokazuje sześć dodanych nazw i zero znikniętych:
trzy komponentowe oraz trzy RealPG/ApiGateway.

Końcowo: routing `30/30 PASS`, panel `5/5 PASS`, RealPG `3/3 PASS`.
Lint zmienionych plików ujawnił zastane błędy formatowania w wielkim
`dev-render/main.tsx`; nowy błąd formatowania panelu poprawiono ręcznie. Nie
uruchamiano globalnego autofixu.

## Dowód wzrokiem R4

Harness używa realnego `AdminAIControlCenterPanel`, `MemoryRouter` i wąskiego
stuba `fetch` wyłącznie dla `/admin/ai/summary`. Nie są to gołe propsy.
Zrobiono `full`, `empty`, `unavailable` w light/dark — 6/6. Średnia luminancja:

- full: `244.02 / 21.34`, różnica `222.67`;
- empty: `243.99 / 21.37`, różnica `222.62`;
- unavailable: `243.29 / 22.23`, różnica `221.06`.

Wszystkie przekraczają wymagane 150. Pliki i SHA-256:

```text
b64b858d5ea6c10b3d08bcdabd28297d2f4b97bdfe4d094f56004624b264b29a  day218-ai-policy-empty-dark.png
6d7c7c3ee2caba2201b6d7c7410e69a64479605294326307096d196d07b1aced  day218-ai-policy-empty-light.png
126f14b2744bab5224e22192ca2ab843b226d36492b6eaba84eda9b557566f36  day218-ai-policy-full-dark.png
f961d19fd178c58e187441ca12f8d98c9cdbe5e6b0ee9fcae326b99ef593fefc  day218-ai-policy-full-light.png
bcebdb9835ab542f9610377e678ea991169972754b7124f4d170253966129f93  day218-ai-policy-unavailable-dark.png
689c3ef642dd1a29fb8c6babd259e69c93651070425bc48e074108289cdbdf0c  day218-ai-policy-unavailable-light.png
```

Katalog: `/private/tmp/cx-day218-admin-polityki-artefakty/`.

## Bezpieczeństwo poczty

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani
żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało
wysłane.

## Rozłączność z dyżurem 219

Przed pierwszą zmianą i ponownie przed commitem zdalna gałąź
`codex/day219-admin-schematy-20260901` nie istniała. Zmiany w
`adminP32.routes.ts` pozostają wyłącznie w `readAiSummary`; nie dotykają
billlingu ani SCIM.

## TWIERDZENIA NIEZWERYFIKOWANE

- Zależność governance/context od `llm_org_policies`: **zweryfikowana kodem i
  RealPG**, są niezależne.
- Istnienie `ai_policies` i `organization_ai_settings`: **zweryfikowane na
  świeżym kontenerze**.
- Mutacja braku tabeli odróżnia `unavailable` od `ok`: **zweryfikowane RED/GREEN**.
- `modelCount`: brak backendu, zastąpiony realnym `internetEnabled`.
- `budgetStatus`: brak backendu, zastąpiony realnym `auditRequired`.
- `defaultSensitivity`: zastąpione realnym `piiRedaction`.
- `allowExternalContext`: żaden klucz `categories` nie oznacza zewnętrznego
  kontekstu; pokazane jawne `n/d`.
- Zrzuty: **realny komponent + realny fetch przez wąski stub**, nie propsy.
- Kolizja z dyżurem 219 przed pierwszym commitem: **sprawdzona, nie wykryto**.
- Pełny kanoniczny runtime `server/src/index.ts`: **nieuruchamiany i
  niezweryfikowany**; R4 wykonano dozwolonym dev-renderem.

