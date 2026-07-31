---
document_id: SETTINGS-AS-IS-MVP-GAPS-GOLDEN-FLOWS-AUDIT
module: Settings
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Settings — remanent, luki MVP i golden flows

## 1. Werdykt

Stan: **VERY BROAD / REAL-PARTIAL / OVERBUILT IA / REQUIRES TRUTH AUDIT**.

Repo zawiera dziesiątki ekranów, rozbudowany `settings.routes.ts`, typed API,
migracje i testy. Historyczna ocena „98/100 Enterprise Ready” nie jest
wystarczającym dowodem. Obecny runtime jawnie ukrywa część sekcji, ogranicza
pilota do Profile/Auth/Language/Theme, a pamięć, integracje i zewnętrzne usługi
mają elementy partial lub zależne od konfiguracji.

## 2. Dowody i problemy

| Obszar | Dowód | Ocena |
| --- | --- | --- |
| shell/router | `SettingsView.tsx`, `SettingsSidebar.tsx` | real |
| profil/appearance/language | dedykowane components + APIs | real/partial |
| AI behavior/models/memory/privacy | wiele components/routes | partial, semantics do audytu |
| notifications | settings + notification routes/hooks | real/partial, duplikacja routes |
| integrations/OAuth/sync/logs | `settings.routes.ts`, components | real/partial, credentials required |
| security/session/recovery | components + advanced routes | real/partial |
| data export/delete | components/routes/tables | runtime workers do potwierdzenia |
| settings history/templates | components/routes | real/partial |
| keyboard shortcuts | component istnieje, sekcja ukryta | nie obiecywać — brak global dispatcher |
| tenant handoffs | sekcje istnieją, ale są ukryte | boundary nieczytelny |
| API keys/webhooks/developer | istnieją | ownership/role do decyzji |

## 3. P0

1. Uprościć IA i usunąć duplikaty/legacy aliases.
2. Każde widoczne ustawienie: prawdziwy load, save, effective read-back i test po
   ponownym logowaniu/urządzeniu.
3. Rozdzielić user preference od admin policy; pokazać lock/source.
4. Profile, Language/Region, Theme/Accessibility, Teresa basics, Notifications,
   Auth/Sessions, Memory/Privacy oraz Connectors jako minimalny spójny zakres.
5. Usunąć lub oznaczyć funkcje zależne od niewdrożonych workers/credentials.
6. Jeden canonical endpoint family; zamknąć niebezpieczne writes z dowolnym
   `userId`.
7. Reauthentication dla operacji bezpieczeństwa i destrukcyjnych.
8. Audit bez sekretów i PII w logach.
9. Pilot access ma świadomy kontrakt, nie przypadkowe znikanie sekcji.
10. Settings search respektuje visibility i prowadzi do kontrolki.

## 4. P1

- effective settings/inheritance API;
- policy change realtime invalidation;
- memory review/delete UI;
- notification rule builder;
- integration health i reconnect workflow;
- settings templates/import/export z diffem;
- pełna settings history/restore;
- cross-device/offline conflict handling;
- global shortcut dispatcher;
- personal usage/cost analytics.

## 5. Golden flows

### GF-SET-01 — preferencja użytkownika

Użytkownik zmienia język/theme, widzi save/read-back, odświeża i loguje się na
drugim urządzeniu. Wartość pozostaje zgodna z deklarowanym sync scope.

### GF-SET-02 — polityka administratora

Admin blokuje public share/model. Settings pokazuje effective value, ownera i
powód, nie pozwala obejść polityki przez UI ani API. Po zmianie polityki widok
aktualizuje się.

### GF-SET-03 — pamięć Teresy

Użytkownik widzi zapisane wpisy, źródła i scope, poprawia jeden, usuwa drugi i
wyłącza dalsze zapisywanie. Teresa nie używa usuniętego wpisu po read-backu.

### GF-SET-04 — powiadomienia

Użytkownik ustawia quiet hours i digest. Zwykłe alerty są odroczone, obowiązkowy
alert bezpieczeństwa dociera z wyjaśnieniem, a ten sam event nie jest
zduplikowany.

### GF-SET-05 — connector

Użytkownik widzi scopes, łączy kalendarz, testuje, synchronizuje, sprawdza log,
reauthorizuje wygasły token i odłącza. System pokazuje wpływ na dane.

### GF-SET-06 — bezpieczeństwo

Użytkownik włącza MFA, przegląda sesje i odwołuje inne urządzenie po
reauthentication. Bieżąca operacja trafia do audytu bez sekretów.

### GF-SET-07 — eksport/usunięcie

Użytkownik zamawia eksport i widzi status joba. Żądanie usunięcia pokazuje
grace period, skutki, legal hold i możliwość anulowania zgodnie z polityką.

## 6. Definition of Done

Settings nie jest gotowe na podstawie liczby komponentów i endpointów. Każda
widoczna kontrolka musi przejść `load -> edit -> validate -> save -> read-back
-> reload`, a ustawienia wpływające na Chat, Teresę, voice, notifications i
connectors muszą zmienić rzeczywiste zachowanie konsumenta.
