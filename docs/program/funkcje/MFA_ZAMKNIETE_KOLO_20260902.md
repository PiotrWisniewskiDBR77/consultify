# MFA — zamknięte koło logowania (naprawa 2026-09-02)

Gałąź: `fix/mfa-zamkniete-kolo-20260902` (baza: `github-backup/kandydat/staging-20260902b`, `c7915a6a6d`).
Dowód: lokalny PostgreSQL 17 + pgvector w kontenerze `mfa0902-pg` (127.0.0.1:6412), pełny zestaw
migracji od zera, realne trasy produktu montowane przez `ApiGateway.initializeRoutes`, realne
żądania HTTP. Kontener skasowany po pracy (`docker rm -f -v`).

---

## 1. Mechanizm defektu

`server/src/controllers/AuthController.ts:428` (przed naprawą):

```
} else if (!mfaStatus.enabled && mfaStatus.enforced) {
  res.status(403).json({
    error: 'Your organization requires two-factor authentication. Please set up MFA first.',
    mfaSetupRequired: true,
    gracePeriodRemaining: mfaStatus.gracePeriodRemaining,
  });
```

Trzy fakty, każdy sprawdzony w kodzie i odtworzony na żywym serwerze:

1. **Warunku nie da się spełnić.** Jedyna ścieżka skonfigurowania drugiego składnika to
   `POST /api/mfa/setup` + `POST /api/mfa/verify-setup` (`server/src/routes/mfa.routes.ts`), a cały
   ten router stoi za `router.use(verifyToken, ...)`. Token wydaje logowanie. Logowanie odmawia,
   dopóki nie ma składnika. Koło się zamyka.
2. **Front nie miał nawet obsługi tej odmowy.** `grep mfaSetupRequired src/` przed naprawą: zero
   trafień. Użytkownik widział generyczny błąd logowania, nie instrukcję.
3. **Karencja była liczbą-atrapą.** `MFAService.getMFAStatus` zwracało
   `gracePeriodRemaining: Number(row?.mfa_grace_period_days ?? 0)` — czyli **stałą konfiguracyjną
   organizacji**, nie licznik. Nie było i nie ma w schemacie żadnej daty włączenia wymogu, więc nie
   istniało nic, od czego można te dni odliczyć. Kod „liczył karencję" i mimo to odmawiał, bo tej
   liczby nikt nie porównywał z niczym: nie było ani jednej gałęzi, w której `enforced && !enabled`
   przepuszczałoby logowanie.

Odtworzenie na realnym serwerze (nie z opisu): mutacja **M1** poniżej przywraca dokładnie starą
gałąź warunku — scenariusz (a) natychmiast czerwienieje, czyli użytkownik w karencji dostaje 403.
Mutacja **M2** zabiera bilet z odmowy — scenariusz (b) czerwienieje, czyli odmowa znów jest ślepym
zaułkiem.

**Czego NIE zweryfikowałem sam:** stanu bazy stagingu. W tym worktree nie ma poświadczeń do hosta
`thomas`, a nie zdobywałem ich w obejściu. Wiersze `organizations.mfa_required = 1` / `user_mfa`
puste dla DBR77 pochodzą z pomiaru nadzorcy i są przeze mnie przyjęte jako dane wejściowe, nie jako
mój pomiar. Mechanizm defektu zweryfikowałem u siebie, na tym samym schemacie i tym samym kodzie.

---

## 2. Co karencja robi dziś (po naprawie)

Nowy, czysty moduł arytmetyki: `server/src/services/mfaGracePolicy.ts` (`evaluateMfaGrace`).

| element | przed | po |
|---|---|---|
| kotwica czasu | **nie istniała** | `organizations.mfa_required_since` (migracja `20261901_mfa_grace_anchor.sql`) |
| punkt zerowy odliczania | — | późniejsza z pary: kotwica organizacji / `users.created_at` |
| `gracePeriodRemaining` | stała `mfa_grace_period_days` w ciele odmowy | realna liczba dni, zaokrąglona w górę, 0 po terminie |
| logowanie w karencji | 403 | **200**, plus `mfaEnrollment: { required, daysRemaining, deadline, gracePeriodDays }` |
| logowanie po karencji | 403 bez wyjścia | 403 **z biletem konfiguracyjnym** |
| `mfa_grace_period_days = 0` | ignorowane | świadome „bez karencji" — respektowane |
| brak kotwicy (wiersz sprzed migracji) | — | liczy od daty konta, czyli **egzekwuje**; nie jest to furtka bezterminowa |

Kotwica jest stemplowana przy włączeniu wymogu i czyszczona przy wyłączeniu (obie trasy zapisu), więc
ponowne włączenie daje świeży bieg, a nie zużyty sprzed roku. Migracja backfilluje kotwicę na moment
swojego uruchomienia dla organizacji, które JUŻ mają `mfa_required = 1` — dzięki temu wdrożenie samo
odblokowuje zablokowanych, dając im pełną karencję na realną konfigurację.

Konto założone PO włączeniu wymogu dostaje własny bieg (7 dni od założenia), a nie zastaje termin
przeterminowany w dniu pierwszego logowania.

---

## 3. Wybrana droga wyjścia i uzasadnienie

**Wybrałem ograniczoną sesję („bilet konfiguracyjny"), nie link mailowy.**

- **Mechanizm już istniał w całości.** Konfiguracja TOTP to trzy gotowe handlery w
  `mfa.routes.ts`. Wystarczyło wystawić je pod drugim, węższym strażnikiem — zero nowej logiki
  bezpieczeństwa, zero nowej kryptografii.
- **Link mailowy zależy od kanału, który w tej właśnie sytuacji bywa nieczynny.** Zablokowany
  właściciel to często ten sam człowiek, który nie ma jak sprawdzić, czy `emailService` na danym
  środowisku w ogóle wysyła. Droga wyjścia nie może zależeć od podsystemu, którego stanu nie widać.
- **Bilet nie daje nic ponad to, co użytkownik już udowodnił.** Jest wystawiany dopiero PO
  poprawnej weryfikacji hasła. Nie jest sesją i nią nie zostaje.

Realizacja:

| plik | rola |
|---|---|
| `server/src/services/mfaEnrollmentTicket.ts` | wystawienie/weryfikacja biletu, `purpose: 'mfa_enrollment'`, TTL 15 min |
| `server/src/middleware/mfaEnrollmentToken.middleware.ts` | przyjmuje **wyłącznie** bilet; tożsamość z podpisu, nigdy z ciała żądania |
| `server/src/routes/mfa.routes.ts` (`mfaEnrollmentRouter`) | dokładnie trzy trasy: `/status`, `/setup`, `/verify-setup` |
| `server/src/Gateway.ts` | mount `/api/auth/mfa-enrollment` |
| `server/src/utils/scopedTokenClaims.ts` | `hasScopedPurposeClaim` — jedno źródło prawdy |

**Domknięcie zakresu jest default-deny, nie listą wyjątków.** Bilet jest podpisany tym samym
`JWT_SECRET` co token sesji, więc każde miejsce weryfikujące ten sekret musi go odrzucić. Odrzucają
go: `verifyToken` (401 `SCOPED_TOKEN_NOT_A_SESSION`), `optionalAuth` (nie hydratuje tożsamości),
uścisk dłoni socket.io oraz trzy bramy WebSocket kolaboracji (idea/prezentacje/notatnik). Token
dostępu wystawiany przez `RefreshTokenService` nie nosi claimu `purpose` w ogóle, więc reguła nie
dotyka normalnych logowań.

Pułapka, w którą wpadłem i którą naprawiłem w trakcie: `sanitizeJwtPayload` w `auth.middleware.ts`
jest **białą listą** i cicho usuwa `purpose`. Sprawdzanie zsanityzowanego ładunku zawsze widziałoby
`undefined` i przepuszczałoby każdy bilet jako pełną sesję. Kontrola czyta surowy, zweryfikowany
ładunek — jest to zapisane w komentarzu przy kodzie, bo to dokładnie ten rodzaj szczegółu, który
odrasta przy następnej refaktoryzacji.

---

## 4. Nigdy więcej organizacji bez ani jednego konta zdolnego się zalogować

`server/src/services/mfaEnforcementGuard.ts` → `denyUnsafeMfaEnforcement`.

Blokuje przejście `mfa_required` z 0 na 1, gdy w organizacji **zero** kont ma włączony drugi
składnik. Odpowiedź: `409` + `MFA_ENFORCE_NO_ENROLLED_ACCOUNTS` + komunikat po polsku.

Rodzina tras (obie, nie jedna — to ta sama kolumna):
- `PUT /api/admin/security` → `adminP32.routes.ts:handleUpdateSecurityPolicy` (panel
  `src/components/Admin/AdminSecurityPolicyPanel.tsx`, to jest miejsce, w którym właściciel
  realnie klika przełącznik),
- `PUT /api/security/settings` → `security.routes.ts` (bliźniacza trasa pisząca tę samą kolumnę).

Populacja liczona przez strażnika jest **ta sama**, na której egzekwuje logowanie
(`users.organization_id`). Policzenie innej — np. `organization_members` — dałoby strażnika, który
przepuszcza, a logowanie i tak zamyka drzwi.

Strażnik nie blokuje zapisu formularza, gdy wymóg już był włączony, ani wyłączania wymogu.

---

## 5. Tabela scenariuszy

Uruchomienie: `RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test DB_TYPE=postgres
ENABLE_TEST_AUTH_BYPASS=false DATABASE_URL=postgres://mfa:mfa@127.0.0.1:6412/mfa
npx vitest run tests/integration/mfa-zamkniete-kolo.realdb.test.ts --retry=0`

| # | scenariusz | oczekiwanie | wynik |
|---|---|---|---|
| a | wymóg włączony, karencja trwa, brak składnika | logowanie 200 + `mfaEnrollment.daysRemaining` 1..7 + `deadline` ISO | **PASS** |
| b | karencja wyczerpana | 403 `MFA_SETUP_REQUIRED` + bilet; bilet realnie przechodzi `/setup` → `/verify-setup` → kolejne logowanie wystawia wyzwanie MFA | **PASS** |
| c | drugi składnik skonfigurowany | 200 z `mfaRequired`/`mfaChallenge`, bez `mfaSetupRequired` | **PASS** |
| d | włączenie wymogu tam, gdzie nikt go nie ma (`PUT /api/admin/security`) | 409 `MFA_ENFORCE_NO_ENROLLED_ACCOUNTS`, kolumna nadal 0 | **PASS** |
| d2 | to samo na bliźniaczej trasie `PUT /api/security/settings` | 409, ten sam kod | **PASS** |
| d3 | po skonfigurowaniu składnika przez jedno konto wymóg wchodzi i stempluje kotwicę | 200, `mfa_required = 1`, `mfa_required_since` niepuste | **PASS** |
| e | bilet użyty jako sesja | 401 `SCOPED_TOKEN_NOT_A_SESSION` na `/api/mfa/status`; 401 na `/api/admin/people` | **PASS** |
| e2 | obcy nie dostaje cudzej ścieżki | sesja obcego → 401 na moncie konfiguracyjnym; bilet z podrzuconym `userId` ofiary → działa tylko na własnym koncie, ofiara ma 0 wierszy w `user_mfa`; brak biletu → 401 | **PASS** |

Wynik zbiorczy: **8 passed (8)**, `--retry=0`.

Dodatkowo `tests/unit/backend/services/mfaGracePolicy.test.ts` — 8 przypadków brzegowych arytmetyki
(karencja zerowa, brak kotwicy, konto młodsze od wymogu). **8 passed (8)**.

### Pułapka harnessu, którą trzeba było najpierw usunąć

`tests/setup.ts:487` podmienia **globalnie** `MFAService` atrapą zwracającą zawsze
`{ enabled: false, enforced: false }` — czyli dokładnie ten stan, w którym defektu nie widać.
Pierwsze uruchomienie mojego zestawu dało 5 czerwonych z powodu atrapy, nie produktu. Plik testowy
robi więc jawne `vi.unmock` dla `MFAService` i `auth.middleware`; bez tego cały ten dowód byłby
zielenią atrapy. **Każdy przyszły test MFA w tym repo ma ten sam problem.**

Drugie: `tesseract.js` jest dynamicznie importowany przez
`server/src/services/ai/deckImageSafetyGates.ts`, ale **nie jest zadeklarowany w `package.json`** i
nie jest zainstalowany. Vite nie potrafił rozwiązać grafu modułów żadnego zestawu montującego pełny
Gateway. Dodałem alias na atrapę, która **rzuca przy wywołaniu** (`tests/__mocks__/tesseract-js.js`),
więc nic się nie zieleni na udawanym OCR. Osobne znalezisko do rozstrzygnięcia: ta funkcja jest
martwa również w produkcji.

---

## 6. Cztery dowody mutacyjne (celowane w ZABEZPIECZENIE)

Każda mutacja: usuń zabezpieczenie → uruchom ten sam zestaw → przywróć. Wszystkie `--retry=0`.

| # | usunięte zabezpieczenie | plik | oczekiwana czerwień | zmierzony wynik |
|---|---|---|---|---|
| M1 | przepustka karencji w logowaniu (`&& !mfaStatus.graceActive`) | `AuthController.ts` | (a) | **(a) ×**, reszta ✓ — dokładne odtworzenie starego zamkniętego koła |
| M2 | bilet w ciele odmowy (`mfaSetupToken`) | `AuthController.ts` | (b) | **(b) ×, (e) ×, (e2) ×** — odmowa znów bez wyjścia |
| M3 | wywołanie `denyUnsafeMfaEnforcement` (obie trasy) | `adminP32.routes.ts`, `security.routes.ts` | (d), (d2) | **(d) ×, (d2) ×**, reszta ✓ |
| M4 | `rejectScopedPurposeToken` w `verifyToken` | `auth.middleware.ts` | (e) | **(e) ×**, reszta ✓ — bilet stałby się pełną sesją |

Po przywróceniu wszystkich czterech: **8 passed (8)**.

Mutacje celują w zabezpieczenie, nie w mechanizm: żadna z nich nie psuje logowania jako takiego —
w każdej z nich testy niezwiązane z usuniętym zabezpieczeniem zostają zielone, a czerwienieją
dokładnie te, które to zabezpieczenie chronią.

---

## 7. Ryzyko na demo i produkcji (analiza kodu i konfiguracji, zero połączeń)

**Tak, ten sam defekt grozi na demo i na produkcji.** Uzasadnienie:

1. Demo i produkcja biegną na tym samym kodzie `AuthController.login` / `MFAService.getMFAStatus`,
   z tym samym schematem (`organizations.mfa_required`, `mfa_grace_period_days`) — kolumna istnieje
   w `000_initdb_core_tables.sql` i w `PostgresDatabase.ts`. Nic w tej ścieżce nie jest za flagą
   środowiskową ani za `NODE_ENV`.
2. Żadna migracja ani seed nie ustawia `mfa_required = 1` (sprawdzone: `grep` po
   `server/migrations`, `server/scripts`, `scripts` — jedyne trafienia to definicje `DEFAULT 0`).
   Ryzyko jest więc **utajone**, nie aktywne z urzędu: materializuje się w sekundzie, w której
   dowolny OWNER/ADMIN dowolnej organizacji przestawi przełącznik „MFA enforcement" w
   `/admin/security` albo dowolny klient `PUT /api/security/settings`.
3. Na stagingu ten przełącznik został przestawiony i skutek był natychmiastowy: właściciel przestał
   wchodzić do własnego produktu. Ta sama akcja na produkcji zamyka organizację klienta.

**Do rozstrzygnięcia przed promocją:**

- Przed wdrożeniem na demo/produkcję warto **odczytać** (tylko odczyt), czy istnieją tam organizacje
  z `mfa_required = 1`; jeśli tak, po migracji dostaną kotwicę = moment migracji, czyli pełne
  `mfa_grace_period_days` na realne wdrożenie — to jest pożądane odblokowanie, ale trzeba je
  świadomie zaakceptować, bo przez ten czas logowanie takich kont przechodzi bez drugiego składnika.
- Migracja `20261901_mfa_grace_anchor.sql` jest addytywna (`ADD COLUMN IF NOT EXISTS`) + jeden wąski,
  idempotentny `UPDATE` ograniczony do `mfa_required = 1 AND mfa_required_since IS NULL`. Bez
  rollbacku, zgodnie z regułą sesji.
- Podsystem MFA jest **Postgres-only** także przed tą zmianą (`NOW()`, `gen_random_uuid()::text` w
  `MFAService`/`mfa.routes`). Moje zapisy używają `CURRENT_TIMESTAMP`, czyli składni działającej w
  obu dialektach — nie pogłębiam tego długu, ale go nie likwiduję.

---

## 8. Odpowiedź na pytanie właściciela

**Czy po tej naprawie właściciel wszedłby do produktu BEZ obejścia w bazie?**

Tak — i to dwiema niezależnymi drogami: po wdrożeniu migracja stempluje jego organizacji kotwicę na
moment wdrożenia, więc trafia w świeżą 7-dniową karencję i **loguje się normalnie**, z banerem
i jawnym terminem; a nawet gdyby karencja była wyczerpana, odmowa wydaje mu bilet, którym w tej samej
minucie konfiguruje drugi składnik i wchodzi.
