# CODEX DAY253 — FAŁSZYWE ZAPISY

## Streszczenie

Dyżur wykonany na markerze `df7f13056f`, w izolowanym worktree i na lokalnym
PostgreSQL `cx253` (`127.0.0.1:6246`). Przypadek #9 potwierdziłem jako już
naprawiony. Przypadek #10 naprawiłem: zbiorczy zapis odpowiedzi czeka na wszystkie
promise'y, rozróżnia pełny sukces od częściowej porażki, zostawia nieudane pozycje
do ponowienia i blokuje podwójny klik. Bliźniacza akcja porzucania transkryptu czeka
na zapis i nie pokazuje sukcesu po odrzuceniu promise'a. Commit produktu:
`77b2479a73`.

## Wejście i R1

Marker (wynik dosłowny):

```text
7a733cb63d instrukcje 258 (rodzina mechanizmow AI) + 259 (trzy pliki z realnym kluczem)
...
df7f13056f instrukcje 242 Uprawnienia / 243 Podglad / 244 Organizacja+Ustawienia
MARKER OK
```

Sanity (wynik dosłowny):

```text
df7f13056fa24995be07f64b0e8c877b3faeab45
```

`git status --short | head -3` był pusty. Po utworzeniu worktree było `9.6Gi`
wolne. Porty `6246`, `5226`, `5227` nie miały listenerów. Tip gałęzi bazowej
uciekł do `7a733cb63d`; rozpocząłem zgodnie z regułą roześcia dokładnie od markera.

Przypadek #9: `git log --oneline -3 -- IdeaTableTool.tsx` pokazał
`d0ef02897b fix(idea-table): stop discarding Form Builder saves — reuse FormsIndex`,
a grep `showFormBuilder|<FormBuilder` był pusty. `FormsIndex.tsx` ma realne,
awaitowane `listForms`, `createForm`, `updateForm` i `deleteForm`. Werdykt:
**POTWIERDZONO NAPRAWIONY**; plików #9 nie zmieniałem.

## R2 — przypadek #10

- `ConversationalPanel.tsx`: prop zwraca `Promise<void>`; `applyDraftMappings`
  używa `await Promise.allSettled`, liczy zapisane/nieudane, pełny sukces toastuje
  rzeczywistą liczbą, a częściowy wynik pokazuje błąd `Saved X of N...` i pozostawia
  wyłącznie nieudane mapowania do retry. `applyingMappings` blokuje drugi klik.
- `InterviewWorkspace.tsx`: callback zwraca promise z `handleUpdateQuestion` zamiast
  go porzucać.
- `InterviewSingleQuestionRuntime.tsx`: porzucenie transkryptu czeka na
  `onUpdateQuestion`; rejection daje `toast.error`, bez fałszywego sukcesu.

### Dowód frontu i częściowej porażki

Pakiet:

```text
RUN_DB_TESTS=0 MOCK_DB=true npx vitest run \
  src/components/Interview/__tests__/ConversationalPanel.applyDraftMappings.contract.test.tsx \
  --retry=0 --reporter=json --outputFile=.../po.json
2 passed, 0 failed
```

Pełne nazwy dodane (przed: brak pliku testowego i zero nazw; po: dwie):

```text
ConversationalPanel applyDraftMappings save contract reports partial failure and keeps only failed mappings available for retry
ConversationalPanel applyDraftMappings save contract waits for every accepted answer before reporting the real successful count
```

Nie zniknęła żadna nazwa. Pakiet jest czysto jednostkowy; pułapki Z33(a-d) nie
leżą na jego ścieżce, ponieważ nie montuje serwera ani bazy. Pułapka Z33(e) jest
przedmiotem asercji: promise pozostaje nierozstrzygnięty przed sukcesem, a jedno
odrzucenie z dwóch daje częściowy komunikat i retry jednej pozycji.

Dowód mutacyjny: usunięcie `await` przed `Promise.allSettled` dało `RC=1`, dwie
pełne nazwy czerwone (`mutacja-red.json`). Po przywróceniu kodu ten sam pakiet dał
`RC=0`, `2 passed, 0 failed` (`mutacja-green.json`). Mutację cofnięto przed commitem.

### Dowód realnej ścieżki zaplecza

Pełne migracje na `pgvector/pgvector:pg16` zakończyły się `Postgres migrations
complete`; drugi przebieg zastosował `0` migracji. Skrypt dowodowy poza repo
zamontował `ApiGateway.getInstance().initializeRoutes(app)`, podpisał JWT, utworzył
fixture tenant/user/session/question i wykonał realne HTTP oraz niezależny SQL/GET:

```json
{
  "dbType": "postgres",
  "winnerStatus": 200,
  "staleStatus": 409,
  "getStatus": 200,
  "getAnswer": "day253 winner",
  "sql": { "answer_text": "day253 winner", "status": "answered" }
}
```

To dowodzi: produkcyjny montaż Gateway, `verifyToken`, realny PATCH, CAS 409,
utrwalenie w PostgreSQL oraz zimny odczyt przez GET i bezpośredni SQL. Pułapki
Z33 wyłączono jawnie w tej samej linii: `DB_TYPE=postgres`,
`ENABLE_V8_GLOBAL=true`, `ENABLE_TEST_AUTH_BYPASS=false`,
`RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`; log zawiera
`DB_IDENTITY ... 127.0.0.1:6246/cx253`.

## R3 — bounded sweep

Sprawdziłem realnie istniejące odpowiedniki wskazanych katalogów:
`src/components/documents`, `src/components/DocumentStudio`, `src/views/vault`
i `src/views/admin`. `src/components/Documents` oraz
`src/components/MaterialsTools` nie istnieją. W czterech realnych obszarach grep
znalazł 41 wywołań `toast.success` (jedno w komentarzu); handlery zapisu w próbce
mają poprzedzające `await` albo sprawdzają wynik/receipts. Nie znalazłem kolejnego
potwierdzonego przypadku wymagającego zmiany. `Opening sheets builder lane` jest
nawigacją, nie obietnicą zapisu. Kandydaci i kontekst są w `r3-docs.txt` oraz
`r3-candidates.txt`.

Nie objąłem: Assessment, Execution, Finance, Meeting,
ReportsAndPresentations, Audit/method ani reszty produktu. Nie twierdzę, że pełne
przemiatanie produktu zostało wykonane.

## Zbiorcza tabela przypadków 1-10

| # | Ekran / plik | Status | Dyżur / commit |
|---|---|---|---|
| 1-7 | Brak kanonicznego wykazu w źródłach licencjonowanych do odczytu | `UNKNOWN` — nie rekonstruuję nazw z domysłu | `EVIDENCE_MISSING` |
| 8 | Załączniki Inicjatyw, `ODBIOR_ZALACZNIKI_INICJATYW.md` | naprawiony/odebrany wg dokumentu źródłowego | dokument odbiorowy |
| 9 | Form Builder, `IdeaTableTool.tsx` | potwierdzono naprawiony na markerze | `d0ef02897b` |
| 10 | Wywiad conversational, `ConversationalPanel.tsx`; bliźniak w `InterviewSingleQuestionRuntime.tsx` | naprawiony i zweryfikowany lokalnie | DAY253 / `77b2479a73` |

Wiersze 1-7 pozostają jawnie nieuzupełnione, ponieważ instrukcja wymaga tabeli,
ale nie dostarcza ich kanonicznych nazw/commitów, a licencja nie upoważnia do
tworzenia nowego rejestru ani zgadywania.

## Z30 — deklaracja testowa

**Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani
żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało
wysłane.**

Dowody: `BRAK ZMIENNYCH POCZTY`; zapytanie `settings WHERE key LIKE 'smtp%'`
zwróciło `(0 rows)`; grep drenaży w `Gateway.ts` był pusty. Model językowy nie
został wywołany (Z15).

## Artefakty

Katalog: `/private/tmp/cx-day253-falszywe-zapisy-artefakty`.

- `gateway-proof.log` — SHA-256 `215698850668657dc98af30515fb9c5c56dbe5dee3b847d67c08f20c736f7632`
- `po.json` — SHA-256 `37eb438bea11a4fe72fb568f80b8ca2cad28c170b15cc32e75934334a822e43c`
- `mutacja-red.json` — SHA-256 `b30b5ca1d841a0b1d91a1423b4f21c93cfcfcf88c14dd7f777cd352b7b242292`
- `mutacja-green.json` — SHA-256 `96a6654ef395babd8a7a698af500051c0e653957490ce68db4222a3f6c97d700`
- `r3-docs.txt` — SHA-256 `b55ecf5fb0be620f054c5169c563549e02502707354fad4dcab25f07f5167e65`

## TWIERDZENIA NIEZWERYFIKOWANE

- Nazwy, ekrany i commity przypadków 1-7: `EVIDENCE_MISSING`.
- Pełne przemiatanie produktu poza bounded R3: `NIE WYKONANO`.
- Zrzuty wizualne: `NIE WYKONANO`; zmiana dotyczy semantyki wyniku async, a
  zachowanie częściowej porażki zweryfikowano kontraktem komponentu.

## Korekty wobec instrukcji

- Marker wspólny kolejki `7a733cb63d` nie jest markerem tego dyżuru. Wiążąca
  ramka wydanego dokumentu podaje `df7f13056f`; ten marker był przodkiem tipa i
  od niego utworzono gałąź.
- Ścieżki `src/components/Documents` i `src/components/MaterialsTools` nie
  istnieją. Zgodnie z procedurą użyłem realnych odpowiedników wymienionych w R3.
- Pakiet „przed” nie istniał, więc Vitest zwrócił `RC=1` i raport z zerem nazw;
  nie nazwałem tego PASS-em. „Po” zawiera dokładnie dwie nowe pełne nazwy.

