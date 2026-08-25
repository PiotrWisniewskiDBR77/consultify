# Partner — raport dyżuru dnia 12 (2026-08-25)

Status dyżuru: `STOP_W_BLOKU_0 / NIE ZMIENIONO RUNTIME / OWNER_PENDING / ECONOMICS_OFF`

Gałąź: `codex/partner-day12-20260825`

Tip startowy: `659a57baedacc71912e2f5c407c1de419bbff05e`

Marker: `5f96e936ac` — `git merge-base --is-ancestor 5f96e936ac codex/m03-admin-20260824` zakończone kodem `0` (`MARKER OK`).

Worktree: `/private/tmp/consultify-partner-day12`

## Decyzja wiążąca D8

> `/partner` = wyłącznie pulpit operacyjny podłączonego partnera (domyślnie
> „Pulpit"). Ekran pierwszego podłączenia = osobny, jednoekranowy stan. Treści
> programowe/marketingowe wyłącznie na publicznych `/become-partner`,
> `/partner/apply`, `/partner/pricing`; siedem wewnętrznych podstron
> marketingowych wycofane z `/partner` z zapisem, gdzie treść żyje dalej.
> Bramki: `connection` decyduje podłączony/nie; `lifecyclePhase` tylko
> o zawartości pulpitu; stan nieznany/błąd nigdy nie pokazuje rejestracji.
> Ekonomia partnerska pozostaje wyłączona polityką AMD-PRT-ECONOMICS-002 —
> poza zakresem tej decyzji.

Źródło: `OWNER_DECISION_LEDGER_2026-08-24.md:30`, `DEC-2026-08-24-08`,
`OWNER_ACCEPT`.

## Blok 0 — weryfikacja mapy

| Kontrola                | Wynik                      | Dowód                                                                                                                                               |
| ----------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Marker i baza           | `PASS`                     | marker jest przodkiem `codex/m03-admin-20260824`; tip instrukcji zawiera marker                                                                     |
| Materiały wiążące       | `PASS`                     | D8: ledger `:30`; `PAR-Q-001`: register `:158`; `getProgramStatus`: klient `:413`; legacy connection: portal `:3046`; `MODULE_ACCEPTANCE.md` obecny |
| Hooki                   | `PASS`                     | `core.hooksPath=.husky`; wykonywalne `pre-commit`, `commit-msg`, `pre-push`                                                                         |
| Zależności              | `PASS`                     | `node_modules` podlinkowany do checkoutu integracyjnego zgodnie z §0.3                                                                              |
| Legacy bramka           | `POTWIERDZONE`             | `PartnerPortalView.tsx:3046` wywołuje `/api/partners/connection`; `:3315–3324` kieruje niepodłączonego do `renderProgramContent()`                  |
| Wyciek A                | `POTWIERDZONE`             | `PartnerPortalView.tsx:3272–3300` mapuje siedem sekcji programu na komponenty marketingowe                                                          |
| Wyciek B                | `POTWIERDZONE`             | `PartnerPortalView.tsx:3223` przekazuje `ProviderHomeView`; `PartnerStartRouter.tsx:152–153` renderuje go dla onboardingu                           |
| Test starego zachowania | `POTWIERDZONE`             | `PartnerPortalView.route-alignment.test.tsx:102–131` oczekuje `Program overview` i `Models and commercial terms` dla `connected:false`              |
| Trasy publiczne         | `POTWIERDZONE`             | faktyczny formularz: `/become-partner/apply`, nie literalne `/partner/apply`; gramatyki tras nie zmieniono                                          |
| i18n                    | `POTWIERDZONE WG ŹRÓDŁA`   | istniejące klucze PL są obecne; bez zmiany renderu nie wykonywano runtime replay                                                                    |
| Crimson                 | `DŁUG ZASTANY`             | grep: `PartnerPortalView.tsx` 49, `ClientAccessView.tsx` 8 wystąpień `primary-[0-9]`                                                                |
| P.6 StandardTable       | `POZA_ZAKRESEM_DO_DECYZJI` | marker/instrukcja nie potwierdza wejścia Partnera w falę triady; domyślne rozstrzygnięcie §3 = NIE                                                  |

## Rozstrzygnięcie §2.4 — `STOP`, nie Wariant 1/2

`program/status` nie jest bezpiecznym substytutem connection (Wariant 2): router
V8 przed handlerem wymaga `requireActiveMembership` i
`requireBoundPartnerTenant`, a sam status dodatkowo podlega bramce odczytu
ekonomii. Brak połączenia nie daje więc jednoznacznego `connected:false`.

Wariant 1 również nie jest implementowalny literą instrukcji bez nowej decyzji:
`partnerConnectionService.ts` eksportuje wyłącznie writer
`connectPartnerOrganization`; nie eksportuje read-only connection. Wywołanie
writera jako odczytu byłoby niebezpieczne i semantycznie nieuczciwe.

Co ważniejsze, zastane resolvery dają potencjalnie niespójne wyniki:

- legacy `getActivePartnerOrgIdForUser(userId)` jest user-scoped, ma fallback
  `created_by`, dziedziczenie po współpracowniku i zapisujący self-heal;
- V8 `getActivePartnerOrgIdForTenantUser(organizationId, userId)` jest
  read-only i wymaga aktywnego linku oraz dokładnego
  `owner_organization_id = organizationId`.

Zatem historyczny/unbound rekord może być `connected:true` w legacy i
`connected:false`/`PARTNER_ORG_REQUIRED` w V8. To jest dokładnie rozjazd opisany
w §2.4 jako obowiązkowy STOP. Nie zmieniono semantyki
`partnerConnectionService`, legacy route ani bramki UI.

### STOP — P.1

Powód: nie istnieje kanoniczny read-only GET o semantyce zgodnej z legacy, a
dostępne resolvery różnią się tenant bindingiem i self-healem.

Dowód: `partnerConnectionService.ts:70` eksportuje tylko connect;
`partnerOrgResolution.ts:11–104` (legacy self-heal) kontra `:107–130` (V8 exact
tenant, read-only); `v8/partner.routes.ts:156–157` blokuje niepodłączonego przed
handlerami innymi niż connect.

Co zrobiłbym, gdyby zapadła decyzja X: po zatwierdzeniu, że kanoniczna semantyka
ma być strict exact-tenant, dodałbym addytywny read-only resolver/kontrakt
connection, jawnie rozstrzygnął los historycznych unbound rekordów i dopiero
potem przepiął UI wraz z testem foreign-tenant.

Stan: `NIE ZACOMMITOWANO` kodu runtime.

## Pozycje P.1–P.6

| Pozycja | Commit SHA | Status                       | Dowód                                                                           |
| ------- | ---------- | ---------------------------- | ------------------------------------------------------------------------------- |
| P.1     | —          | `STOP_SEMANTYKA_CONNECTION`  | rozstrzygnięcie §2.4 powyżej                                                    |
| P.2     | —          | `NIE_ROZPOCZĘTO_PO_STOP_P.1` | zmiana renderu bez wiarygodnej bramki narusza DoD realnych danych               |
| P.3     | —          | `NIE_ROZPOCZĘTO_PO_STOP_P.1` | wykonano wyłącznie read-only mapę retirementu poniżej                           |
| P.4     | —          | `NIE_ROZPOCZĘTO_PO_STOP_P.1` | nie przepisano istniejącej asercji bez implementacji runtime                    |
| P.5     | —          | `NIE_ROZPOCZĘTO_PO_STOP_P.1` | brak dotkniętych powierzchni runtime; długu nie przedstawiono jako naprawionego |
| P.6     | —          | `POZA_ZAKRESEM_DO_DECYZJI`   | brak jawnej zgody na falę triady                                                |

## P.3 — mapa retirementu (read-only, bez usuwania)

| Wewnętrzna sekcja `/partner`          | Publiczny cel zastany                                                                 | Stan                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------- |
| Program overview / `ProviderHomeView` | `/become-partner`                                                                     | `CEL_ISTNIEJE`                               |
| Benefits / `ValueCardsSection`        | `/become-partner` (komponent użyty wprost)                                            | `CEL_ISTNIEJE`                               |
| Stories / `BetaSuccessStories`        | —                                                                                     | `BRAK_CELU_RETIREMENTU`                      |
| Tiers + calculator                    | `/become-partner`; `/partner/pricing` przekierowuje do `#commercial-framework`        | `CEL_ISTNIEJE_Z_OGRANICZENIEM_ECONOMICS_OFF` |
| Onboarding + contact                  | `/become-partner/apply` tylko dla aplikacji; brak publicznego odpowiednika obu sekcji | `BRAK_CELU_RETIREMENTU_CZĘŚCIOWY`            |
| Academy                               | —                                                                                     | `BRAK_CELU_RETIREMENTU`                      |
| Resources                             | `/become-partner` (`FooterResourcesSection`)                                          | `CEL_ISTNIEJE`                               |
| FAQ                                   | `/become-partner` (`FAQSection`)                                                      | `CEL_ISTNIEJE`                               |

Komponentów nie usunięto. `BecomePartnerView.tsx` importuje publikowalne sekcje
z `ProviderHomeView.tsx`; formularz faktycznie żyje na
`/become-partner/apply`. Rozjazdu D8 `/partner/apply` nie skorygowano, ponieważ
Z11 zabrania zmiany gramatyki tras.

## STOP-y komercyjne i zakresowe

- `PAR-Q-001` — finalny harmonogram komercyjny: `OPEN_UNRECONCILED`.
- `PAR-Q-002` — publikowalne referencje: `OPEN_UNRECONCILED`.
- `PAR-Q-003` — granica żywych capability: `OPEN_UNRECONCILED`.
- `PAR-Q-005` — finalna hierarchia informacji: `OPEN_UNRECONCILED`.
- P.3: brak publicznego celu dla Stories, Academy oraz pełnej treści
  Onboarding/Contact; zgodnie z instrukcją nie kasowano treści bez adresu.
- P.6: `POZA_ZAKRESEM_DO_DECYZJI`; nie przebudowano listy klientów.

`PAR-Q-004` uznano za nadpisane przez późniejsze D8; nie jest STOP-em.

## Testy, zasięg i dowody wizualne

ZASIĘG: `NIE DOTYCZY DLA RUNTIME / RAPORT-ONLY`.

Nie zmieniono kodu, testów, tłumaczeń ani handlerów, dlatego nie uruchamiano
testów deklarowanych jako dowód implementacji i nie wytwarzano zrzutów
„after”. Uruchomienie testów nie mogłoby zmienić faktu, że P.1 jest zablokowane
na poziomie kontraktu. Brak zrzutów jest jawny: cztery wymagane stany pozostają
`NIE_WYKONANO_PO_STOP`, a pozycje wizualne nie są przedstawiane jako ukończone.

## Ryzyka i następne zamknięcie

1. Przepięcie na strict V8 bez decyzji o migracji historycznych unbound rekordów
   może wyrzucić realnie podłączonych użytkowników z pulpitu.
2. Użycie `program/status` jako connection splata dwie role sygnałów zakazane
   przez D8 i dodatkowo wiąże bramkę z polityką ekonomii.
3. Użycie connect-writera do odczytu grozi mutacją oraz nie daje uczciwego
   `connected:false` przy wyłączonym self-connect.
4. Retirement jest niepełny bez decyzji o publicznym celu dla Stories, Academy
   i części Onboarding/Contact.
5. Po decyzji technicznej nadal wymagane są: cztery testy zachowania, negatyw
   tenanta, light/dark PL dla czterech stanów, pomiar konsumentów i odbiór
   wizualny nadzorcy. Bramka pozostaje `OWNER_PENDING`; brak release authority.
