# R4-P1 — Teresa produkcyjna ma ścieżkę do zlecenia (zrzuty dowodowe)

**Data:** 2026-08-10 · **Stos:** backend `:3001` bez `ENABLE_TEST_AUTH_BYPASS`/`E2E_MODE`
(`scripts/dev/case-workspace-local-backend.sh`) → realny PostgreSQL jednorazowy
(`case-workspace-test-pg`, `127.0.0.1:55432/case_workspace_test`).

## Czym te zrzuty NIE są

Nie pochodzą z atrapy. `POST /api/auth/login` jest realny (bcrypt + realny podpis JWT
dla `cw.local@local.test` / `cw-local-org`); każda trasa poniżej to trasa produkcyjna
importowana wprost przez `Gateway.ts`; każdy SELECT idzie osobnym połączeniem `pg`,
poza odpowiedzią HTTP.

## Pliki

| Plik | Co pokazuje |
|---|---|
| `01-dowod-http-i-baza.png` | Renderowany (Playwright) zrzut transkryptu: propozycja → dwa wywołania potwierdzenia (201, potem 200 z tym samym `caseId`) → SELECT z `case_core` (1 wiersz) → ślad w `case_workspace_event_outbox` (2 zdarzenia, nie 3) → dowód, że `/api/v10/teresa` i `/api/v8/chat` czytają ten sam work order → wynik kontroli negatywnej. |
| `_zadania-sieciowe.txt` | Surowy transkrypt żądań/odpowiedzi HTTP (curl) z tej samej sesji. |
| `_select-i-outbox.txt` | Surowe wyniki SELECT-ów (case_core, outbox) z tej samej sesji. |
| `_dowod.html` | Źródło HTML zrzutu `01-...png` (do odtworzenia/edycji). |

## Co realnie zostało zweryfikowane

1. **Propozycja.** `POST /api/v10/teresa/case-intake/conversations/:id/summary` →
   `200`, `caseCreated:false`, `runCreated:false` — CW-CANON-01 trzyma na trasie
   produkcyjnej (wcześniej ta trasa w ogóle nie istniała pod `/api/v10/teresa`).
2. **Potwierdzenie = dokładnie jeden Case.** Pierwsze `POST .../confirm` → `201`,
   nowy `caseId`. Drugie wywołanie z TYM SAMYM digestem (symulacja odświeżenia
   strony / podwójnego kliknięcia / retry po zerwanym połączeniu) → `200`, **ten sam**
   `caseId`, `caseCreated:false`, `confirmedEventDeduplicated:true`. SELECT z
   `case_core` potwierdza jeden wiersz; SELECT z outboxu potwierdza jedno zdarzenie
   `case.intake.work_order_confirmed` dla tej rozmowy — drugie kliknięcie nie
   dopisało nic nowego.
3. **Digest przeterminowany = odmowa.** (Automatyczny test, nie w zrzucie — patrz
   `teresaProductionIntake.pg.test.ts`, test „a redrafted work order stales the old
   digest…") — przeredagowanie work orderu unieważnia stary digest; próba
   potwierdzenia nim kończy się `409 INTAKE_WORK_ORDER_DIGEST_STALE` i zero Case'ów.
4. **Jeden mechanizm, nie dwa.** `GET /api/v8/chat/conversations/:id/case-intake/work-order`
   (INNA trasa, produkcyjna od dawna) zwraca **identyczny** `workOrderDigest` dla tej
   samej rozmowy — `/api/v10/teresa` deleguje do dokładnie tego samego
   `caseIntakeService`/outboxu, nie do drugiego, równoległego mechanizmu.
5. **Kontrola negatywna.** `server/src/routes/v10/teresa.routes.ts` cofnięty do stanu
   z `HEAD` (bez bloku case-intake) → `teresaProductionIntake.pg.test.ts` **7/7
   czerwonych** (404 na każdej trasie case-intake). Poprawka przywrócona → **7/7
   zielonych**. Bez tego kroku zielone testy nie dowodziłyby niczego o realnej
   przyczynie.

## Co świadomie NIE jest w tym folderze

**Zrzut karty potwierdzenia (`CaseIntakeConfirmCard.tsx`) w interfejsie czatu.**
Komponent istnieje (`src/components/AIChat/CaseIntakeConfirmCard.tsx`), przechodzi
kontrolę składni (esbuild) i jest wpięty w `MessageRenderer.tsx` pod
`msg.metadata?.type === 'case_intake_proposal'` — identycznym wzorcem co istniejąca
karta `table_proposal` → `ChatTableProposalCard`. NIE ma dziś żadnego produkcyjnego
wywołującego: żaden krok w orkiestracji czatu nie ustawia tego typu metadanych, więc
realny użytkownik piszący do Teresy NIE zobaczy tej karty. Zrzucenie jej w izolacji
(bez żadnego wywołującego, poza flagą, bez realnego triggera) złamałoby zasadę CLAUDE.md
§7 — pokazywałoby ekran, którego droga do użytkownika nie istnieje, jakby istniała.
Zamiast tego: literalny opis w raporcie zadania, sekcja PARTIAL.

## Odtworzenie

```bash
bash scripts/dev/case-workspace-local-backend.sh   # backend :3001, realna autoryzacja
# w drugim terminalu — patrz _zadania-sieciowe.txt dla dokładnych żądań curl
```
