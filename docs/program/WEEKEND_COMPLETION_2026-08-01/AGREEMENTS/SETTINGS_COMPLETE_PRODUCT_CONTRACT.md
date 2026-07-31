---
document_id: SETTINGS-COMPLETE-PRODUCT-CONTRACT
module: Settings
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Settings — kompletny kontrakt produktu

## 1. Rola

Settings jest centrum ustawień osobistych użytkownika. Odpowiada na pytanie:
„Jak ja chcę pracować w Consultify w granicach polityk mojej organizacji?”.

Settings nie jest miejscem zarządzania tenantem, zespołami, rolami innych osób,
globalnymi modelami AI, retencją organizacji, billingiem organizacji ani
politykami bezpieczeństwa. Te obszary należą do Admin Panelu albo Superadmina.

## 2. Reguła rozstrzygania ustawień

```text
platform hard limit
 -> organization policy/default
 -> project policy (jeśli dopuszczona)
 -> personal preference
 -> session override
```

Warstwa niższa nie może osłabić warstwy wyższej. UI pokazuje wartość efektywną,
jej źródło oraz przyczynę blokady. Pole kontrolowane przez administratora jest
read-only z linkiem „Zobacz politykę” lub „Poproś administratora”, nie wygląda
jak zepsuty przełącznik.

## 3. Docelowe sekcje

### 3.1 Profil i dostępność

- imię, nazwisko, stanowisko, bio i podstawowe dane kontaktowe;
- avatar;
- język kontaktu i preferred contact method;
- godziny pracy, timezone, out-of-office i status dostępności;
- podpisy użytkownika;
- widoczność poszczególnych pól zgodnie z polityką organizacji.

Dane struktury organizacji, zatrudnienia i roli aplikacyjnej są projekcją
Organization/Admin i nie mogą być samodzielnie zmieniane.

Pełny model pól, visibility, wspólnej karty użytkownika i benchmarku znajduje
się w
[`USER_PROFILE_COMPLETE_CONTRACT_BENCHMARK_AND_VISIBILITY.md`](USER_PROFILE_COMPLETE_CONTRACT_BENCHMARK_AND_VISIBILITY.md).
Remanent istniejącego kodu i plan konsolidacji znajduje się w
[`USER_PROFILE_AS_IS_GAPS_DATA_CONSOLIDATION_AND_GOLDEN_FLOWS.md`](USER_PROFILE_AS_IS_GAPS_DATA_CONSOLIDATION_AND_GOLDEN_FLOWS.md).

### 3.2 Praca i interfejs

- dashboard/start view;
- preferencje tasks/projects i domyślne widoki;
- język, region, format daty/liczb, timezone;
- theme i density;
- accessibility;
- skróty klawiaturowe dopiero po istnieniu globalnego dispatchera;
- zachowanie desktop/mobile.

### 3.3 Teresa i AI

- styl komunikacji i instrukcje osobiste;
- preferowany język, długość, ton i poziom szczegółowości;
- profil jakości/szybkości oraz dozwolony wybór modelu;
- autocomplete i proaktywne sugestie;
- pamięć: włącz/wyłącz, przeglądaj, popraw, usuń;
- privacy/context: jakie osobiste źródła Teresa może wykorzystywać;
- voice/STT/TTS;
- prompt library;
- osobisty usage/cost view bez ujawniania danych innych osób.

Preference nie zastępuje system promptu, zasad metodologii ani polityki
organizacji. Użytkownik nie może instrukcją „bądź autonomiczna” wyłączyć
approval.

### 3.4 Powiadomienia

- kanały: in-app, email, desktop/push oraz podłączone kanały dopuszczone przez
  organizację;
- kategorie: assignments, decisions, approvals, KPI alerts, project updates,
  mentions, security i system;
- urgency oraz wyjątki krytyczne;
- digest, quiet hours, DND, availability i timezone;
- dźwięk oraz desktop behavior;
- reguły osobiste w granicach obowiązkowych alertów.

Alert bezpieczeństwa lub compliance oznaczony przez Admina jako obowiązkowy nie
może zostać wyciszony; UI wyjaśnia dlaczego.

### 3.5 Integracje osobiste

- connected apps;
- calendar sync;
- status, scope, ostatnia synchronizacja i błędy;
- connect/re-auth/test/sync/disconnect;
- log synchronizacji i możliwość revoke.

Connector dostępny organizacyjnie jest publikowany przez Admin Panel. Settings
pozwala użytkownikowi autoryzować własne konto i ograniczyć jego osobisty scope.
API keys i webhooks są dostępne tylko, gdy plan, rola i polityka je dopuszczają.

### 3.6 Konto, bezpieczeństwo i prywatność

- security overview;
- password/passkey/MFA w zakresie obsługiwanym przez identity provider;
- aktywne sesje, urządzenia i revoke;
- login/security activity;
- recovery options;
- consent i privacy visibility;
- eksport danych użytkownika;
- żądanie usunięcia konta oraz status procesu;
- chat history i personal data retention w granicach polityki.

### 3.7 Billing osobisty

Tylko jeśli użytkownik sam posiada plan indywidualny. W środowisku firmowym
Settings pokazuje plan i zużycie użytkownika read-only, a zarządzanie fakturami,
seatami i subskrypcją prowadzi do Admin Panelu.

### 3.8 Zaawansowane

- export/import własnych preferencji;
- personal settings templates;
- settings history i restore;
- developer/beta features tylko dla uprawnionych użytkowników i realnych flag.

## 4. Wspólny kontrakt pojedynczego ustawienia

Każde ustawienie ma:

- stabilny `settingKey` i schema version;
- typ, wartość dozwoloną i default;
- ownera: user/admin/platform;
- effective value i source layer;
- scope i urządzenia, których dotyczy;
- save strategy: immediate albo explicit;
- sensitivity i audit requirement;
- dependency/impact;
- capability status;
- timestamp i read-back.

Ustawienie nie jest zapisane, dopóki backend nie zwróci wartości efektywnej.

## 5. UX zapisu

Proste przełączniki zapisują natychmiast z `saving/saved/failed` i możliwością
retry. Formularze wielopolowe mają Save/Cancel i informację o niezapisanych
zmianach. Operacje wysokiego ryzyka wymagają reauthentication i confirmation.
Nie używamy toastu „Saved”, jeżeli aplikacja zapisała jedynie localStorage albo
fallback bez potwierdzenia serwera.

## 6. Wyszukiwanie

Search Settings indeksuje etykietę, opis i aliasy. Wynik prowadzi do konkretnej
kontrolki i wskazuje sekcję. Ukryte lub niedozwolone ustawienia nie pojawiają się
w wynikach. Ustawienia admin-owned mogą pojawić się jako read-only handoff, jeśli
użytkownik ma prawo widzieć politykę.

## 7. Teresa w Settings

Teresa może wyjaśnić ustawienie, znaleźć je, opisać wpływ i przygotować zestaw
zmian. Nie zmienia haseł, MFA, zgód, kluczy, webhooków, eksportu ani usunięcia
konta. Dla zwykłych preferencji może przedstawić preview pakietu, a użytkownik
zatwierdza dokładne klucze. Nie proponuje obejścia polityki administratora.

## 8. Pytania do rozstrzygnięcia

1. Czy billing pozostaje w Settings, czy w organizacjach firmowych znika
   całkowicie na rzecz Admin Panelu?
2. Czy API keys/webhooks są funkcją osobistą, czy wyłącznie administracyjną?
3. Jakie alerty są zawsze obowiązkowe?
4. Czy personal settings templates wchodzą do MVP?
5. Czy użytkownik może wybierać konkretnego providera/model, czy tylko profil
   Fast/Balanced/Deep?
