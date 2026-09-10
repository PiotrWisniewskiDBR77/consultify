# Etap C — onboarding świeżej organizacji i limity TRIAL (2026-09-10, staging)

Konto pomiarowe założone od zera przez `POST /api/auth/register`:
`p1-test-074843@dbr77.com`, organizacja „P1 Test Poczta 074843”
(`ec4e6a43-0d9b-4bba-87f1-a3f26c1bc0b0`). Przeglądarka z `Accept-Language: pl-PL`,
locale `pl-PL`, viewport 1440x900.

## 1. Kreator — premisa zlecenia NIE potwierdzona

Zlecenie mówiło o kreatorze „Krok 1 z 3”. Na stagingu takiego kreatora onboardingu
nie ma. Ciąg „Krok {{step}} z 3” występuje w `public/locales/pl/translation.json`
dokładnie raz, pod kluczem `templateBuilder.wizard.stepOf` — to kreator SZABLONÓW,
nie onboarding organizacji.

Zmierzony przebieg pierwszego wejścia:
- świeże konto po zalogowaniu ląduje OD RAZU na czacie AI (`02-pierwsze-wejscie-po-rejestracji.png`);
  kreator nie uruchamia się sam, mimo że `GET /api/onboarding/status` zwraca
  `completed: false`, `organizationOnboardingStatus: "NOT_STARTED"`;
- `/onboarding` → „Page not found”;
- kreator istnieje pod `/setup/onboarding` i jest JEDNOEKRANOWY, nie trzykrokowy
  (`03-kreator-setup-onboarding.png`).

ŚCIANY BRAK — użytkownik nie jest zablokowany. Brakuje prowadzenia, nie przejścia.

## 2. Język — defekt dla polskiego pilotażu

Przy `Accept-Language: pl-PL` interfejs pierwszego kontaktu jest po ANGIELSKU:
- ekran logowania: „Welcome back”, „Sign in to continue”, „Log in”,
  „Don't have an account? Create one” (`01-logowanie.png`);
- kreator: „Let's fast-track your success.”, „Your Role”, „Biggest Challenge Right Now”,
  „Generate My Strategy” (`03-kreator-setup-onboarding.png`).

Tytuł karty przeglądarki na `/login` renderował się przez chwilę jako SUROWY KLUCZ
`meta.login.title — Consultify`, zanim ustabilizował się na „Sign In — Consultify”.

To poza moim zakresem naprawczym (program językowy J1–J20), ale dotyka
bezpośrednio jutrzejszego pilotażu i dlatego jest tu zapisane z dowodem.

## 3. Limity TRIAL — zmierzone twardo

`GET /api/billing/usage` dla świeżej organizacji:
```
users:    used 1, limit 4
projects: used 0, limit 3
storage:  used 0, limit 100 MB
aiTokens: used 0, limit 100000
```
Zgadza się z `DEFAULT_TRIAL_LIMITS` (`server/src/services/access/AccessTypes.ts:13`).

UWAGA DLA PILOTAŻU: `max_users: 4` to właściciel + 3 zaproszenia. Pilotaż czterech
osób obok właściciela = 5 osób, czyli o jedną PONAD limit planu TRIAL.

Zmierzona niespójność dwóch tras zaproszeń (obie na żywym stagingu):
- `POST /api/invitations` (InvitationController) → 400, w logu
  `Organization has reached maximum seats.`;
- `POST /api/organizations/:orgId/admin/invitations` (AdminIamController) → **201**,
  `delivery: "SENT"`, mail realnie wysłany — TA SAMA organizacja, ten sam moment.
Trasa używana przez UI (`src/services/api.ts:12869`) to ta DRUGA, więc limit miejsc
faktycznie NIE zablokuje pilotażu. Kontrola miejsc po prostu nie obowiązuje na
ścieżce, którą chodzi produkt.

## 4. Limit czatu AI — NIE jest nieme, ale nie zmierzyłem wyczerpania

Blokada ma widoczny komunikat i jedną akcję „co teraz”:
`src/components/AIFreezeBanner.tsx`, zamontowany w `src/layouts/MainLayout.tsx:396`,
z pełnym tłumaczeniem PL (`aiFreezeBanner.*`): „BLOKADA AI AKTYWNA: Osiągnięto twardy
limit budżetu (Globalnie). Funkcje AI są tymczasowo ograniczone.” + przycisk
„Zwiększ budżet” → `/settings/billing`.

N/A z powodem: nie doprowadziłem organizacji do wyczerpania 100 000 tokenów, więc
NIE zmierzyłem, czy `aiFreezeStatus.isFrozen` realnie zapala się na żywo. Sprawdzone
jest istnienie i podłączenie banera oraz jego polska treść — nie jego wyzwolenie.

## 5. Pułapka 404 z zlecenia — nie występuje

`ENABLE_V8_GLOBAL=true` na OBU środowiskach (`railway variables --kv`). Żadne 404
w tym pomiarze nie pochodziło z braku tej flagi.

## Zostawione na stagingu (do sprzątnięcia)
- konto `p1-test-074843@dbr77.com` + organizacja „P1 Test Poczta 074843”;
- zaproszenie `p1-probe-seat@dbr77.com` w organizacji Northwind — **cofnięte**
  (`status: "revoked"`), rekord został w historii zaproszeń.
