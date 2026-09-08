# J15 — moduł USTAWIENIA bez obcego języka (DEC-453)

Paczka J15 programu spójności językowej. Zasady: `docs/program/JEZYK_EN_PL_20260908/PLAN.md` §2.
Przyrząd: `node scripts/i18n/pomiar-jezyka.mjs --modul "15 Settings"`.
Wzór metody i pułapek: `evidence/jezyk-j10/README.md`.

## Pomiar przed → po (przyrząd, nie deklaracja)

| Kategoria | Przed | Po | Uwaga |
| --- | --: | --: | --- |
| K1def — polski `defaultValue` w `t()` | 7 | **6** | 6 reszt leży w `components/Onboarding/**` — poza zakresem (STOP 1) |
| K1defWID — z tego widoczne w EN na stałe | 1 | **0** | jedyny taki przypadek modułu naprawiony |
| K3a — klucz tylko w `pl` | 100 | **0** | |
| K3aKLUCZ — z tego bez defaultu w kodzie (EN widział SUROWY KLUCZ) | 16 | **0** | |
| K4pl — polski hardcode w JSX | 30 | **14** | 14 reszt: `Onboarding/**` (13) i `InAppNudges/**` (1) — STOP 1 |
| K4en — angielski hardcode w JSX | 135 | **32** | 31 poza zakresem + 1 zablokowany bramką kanonu (STOP 2) |
| K7 — daty/liczby bez locale | 81 | **6** | 6 reszt w `Help/**`, `Onboarding/**`, `AISettings/**` — STOP 1 |
| K1 — polski w pliku EN | 1 | **1** | fałszywe trafienie: nazwisko „Dr. Piotr Wiśniewski" (STOP 4) |

Raporty przyrządu: `pomiar-przed.txt`, `pomiar-po.txt`. Baseline modułu 15 obniżony
w `docs/program/JEZYK_EN_PL_20260908/baseline.json` (tylko w dół, tylko ten moduł).

Poza zakresem paczki (serwer, paczka J17): K5pl 32, K5en 196 — komunikaty backendu.

## Co zostało zmienione

* **92 klucze dopisane do `en/translation.json`** (`settings.*`, `feedback.*`, `security.*`).
  Treść EN wzięta z `defaultValue` w kodzie, nie z tłumaczenia maszynowego; 6 napisów
  napisanych ręcznie. **4 aliasy sekcji usunięte z PL** zamiast dublowania w EN — trasy
  `/settings/{prompt-library,email-digest,desktop-sounds,availability}` nie istnieją
  (SettingsView sprowadza nieznaną sekcję do `overview`), a klucze kanoniczne
  `notifications-*` / `ai-prompt-library` mają komplet w obu plikach.
* **165 nowych kluczy w OBU plikach** dla napisów przeniesionych z JSX do `t()`
  (22 pliki: AISettings, PrivacyVisibilitySettings, OrganizationSettings, SettingsSearch,
  SettingsHistory, WebAuthnSettings, NotificationRulesBuilder, BillingSubscriptionModule…).
* **43 pliki na SSOT dat i liczb** (`src/utils/listDateFormat.ts`): `formatListDate`,
  `formatListDateTime`, `formatListTime`, `formatListNumber`, a przy własnych opcjach
  `Intl` — `localeListy()` zamiast `undefined`/`'en-US'`.
* **Plik z kodami zapasowymi MFA** (`RecoveryOptionsSettings`, `Profile/MFASetup`) powstaje
  z `t()` — to jedyny artefakt, który użytkownik zapisuje u siebie i czyta wtedy, gdy NIE
  MOŻE się zalogować.
* Etykiety w stałych (funkcje AI, typy limitu, sekcje profilu, staż) rozdzielone na
  `value` + `labelKey`/`label` — tłumaczona jest ETYKIETA, nie wartość zapisywana w bazie.

## Dowód wizualny

`przed/` i `po/` — te same 31 ekranów modułu (wszystkie sekcje bocznego menu Ustawień
+ wyszukiwarka), konto `audyt-j15@dbr77.local`, 1440×900, motyw jasny, EN i PL.
Skrypt: `scripts/dev/jezyk-j15-zrzuty.mjs`. Liczniki: `liczniki-en.json`, `liczniki-pl.json`.

Wynik po naprawie (`po/liczniki-*.json`):

* **EN → 0 polskich napisów interfejsu i 0 surowych kluczy** na 31 ekranach. Jedyne polskie
  trafienie to plakietka środowiska „Środowisko LOCAL" z `src/components/layout/EnvironmentBadge.tsx`
  — komponent wspólny spoza modułu (STOP 3), ten sam, który zgłosiła paczka J10.
* **PL → 0 angielskich napisów** wykrytych detektorem. To NIE znaczy „PL gotowe" — patrz
  ustalenie niżej.

### Czym ten dowód kłamał, zanim zaczął mówić prawdę

1. **Modal powitalny zasłaniał produkt.** Pierwszy przebieg dał 30 zrzutów z tą samą treścią
   („Meet Teresa…") zamiast 30 ekranów Ustawień — przyrząd pokazywał sam siebie, nie produkt.
   Harness gasi go dziś flagą `consultify_onboarding_done:<userId>` i awaryjnie klika „Skip".
2. **Drugi przebieg kasował liczniki pierwszego.** Skrypt zapisywał jeden `liczniki.json`
   na przebieg, więc uruchomienie PL nadpisywało dowód liczbowy EN. Dlatego liczniki idą
   dziś do `liczniki-<lang>.json`, a `przed/liczniki.json` z pierwszego dnia zawiera
   WYŁĄCZNIE przebieg PL — zrzuty EN „przed" są kompletne, ich licznik nie.

## Bezpiecznik w repozytorium

`src/components/settings/__tests__/jezykUstawien.source.test.ts` czyta ŹRÓDŁO (nie renderuje),
więc obejmuje też ekrany, których żaden zrzut nie odwiedził (kreator MFA, kody zapasowe,
webhooki, klucze API). 5 sprawdzeń: podłoga liczebności zbioru, polski `defaultValue`,
polskie napisy poza `t()`, daty/liczby z locale na sztywno, plik kodów zapasowych z `t()`.

* **Mutacja:** podmiana jednego angielskiego defaultu na polski → RED, przywrócenie → GREEN
  (sprawdzone).
* **Mutacja bramki:** obniżenie `baseline.json` dla `15 Settings / K7` z 6 na 5 wywala
  `pomiar-jezyka.mjs --baseline` kodem 1; oryginał — kod 0 (sprawdzone).
* Test od razu znalazł defekt, którego skaner NIE widzi: jedyna polska etykieta w liście
  walut `OrganizationProfileForm` („PLN – Polski złoty" wśród angielskich).

Testy modułu (`src/components/settings`, `src/components/Profile`, `src/views/settings`):
11 plików / 39 testów zielonych, zero nowych czerwonych. `tsc` frontu: **192** błędy
(próg ≤ 192), zero w plikach tej paczki — dwa błędy wprowadzone przez codemod (brakujący
import `formatListNumber`, brak hooka `t` w `WorkExperienceCard`) zostały złapane i naprawione.

## USTALENIE, które jest ważniejsze niż tabela

**Skaner liczy DOLNĄ granicę długu, nie dług.** Po domknięciu K4en do 32 ten sam zakres plików
zawiera **327 angielskich napisów wpisanych na sztywno w 75 plikach** (szerszy wzorzec:
tekst JSX zaczynający się wielką literą + atrybuty `title/placeholder/aria-label/label/
description`). Widać to gołym okiem na `po/28-historia-ustawien-pl.png`: nagłówek sekcji
„Settings History", „Search changes…", „All Categories", „No settings changes found",
„Total Changes / Categories / Today" stoją po angielsku obok poprawnie przetłumaczonych
podtytułu i zakresów dat.

Wniosek dla programu: **wersja EN modułu 15 jest gotowa** (0 polskiego, 0 surowych kluczy
na 31 ekranach), **wersja PL — nie**. Domknięcie PL to osobna pozycja o rozmiarze
~330 napisów, a nie „reszta po J15". Największe skupiska: `AISettings.tsx` (50),
`security/AdvancedSecuritySettings.tsx` (22), `ProfessionalProfileSection.tsx` (20),
`ai/AIBehaviorSettings.tsx` (20), `ai/AIModelSelectionSettings.tsx` (19).

## STOP-y (do decyzji właściciela)

1. **Pliki modułu 15 wg skanera, ale poza zakresem paczki** — `components/Onboarding/**`,
   `views/OnboardingWizard.tsx`, `views/WelcomeView.tsx`, `components/CookieConsentBanner.tsx`,
   `components/InviteUserModal.tsx`, `components/AISettings/**`, `components/Education/**`,
   `components/InAppNudges/**`, `components/Help/**`. Skaner przypisuje je do modułu 15 po
   prefiksie klucza; w rejestrze zamrożeń NIE należą do `15_SETTINGS` (Help należy do
   `07_MY_WORK_AGENT`, reszta nie jest zamrożona). Zostawiono ich 14 K4pl + 31 K4en + 6 K7 +
   6 K1def. Równolegle pracują paczki ZZ/J4/J14 — dwie ręce w jednym pliku to pewny konflikt.
2. **„What are passkeys?" w `WebAuthnSettings`** zostaje po angielsku. Przepisanie tej linii
   na `t()` zwraca do diffu token `c-accent` (crimson #85182F) i bramka kanonu TRIADY słusznie
   blokuje commit. Prawdziwa naprawa to zmiana koloru, czyli zmiana WYGLĄDU — wymaga akceptu
   właściciela i nie należy do paczki językowej.
3. **Plakietka środowiska** (`layout/EnvironmentBadge.tsx`) ma polski napis na każdym ekranie EN.
   Komponent wspólny, poza modułem — ten sam STOP zgłosiła paczka J10, wciąż otwarty.
4. **K1 = 1 to fałszywe trafienie:** „Guided by Dr. Piotr Wiśniewski" w `en/translation.json`
   (nazwisko). Do dopisania na listę nazw własnych w `scripts/i18n/pomiar-jezyka.wyjatki.json`
   — plik wspólny dla wszystkich paczek, więc nie ruszam go w trakcie równoległej pracy.
5. **Wartości słownikowe `ProfileSurveyNudge`** (dział, poziom stanowiska, kompetencje —
   35 pozycji) zostają po polsku, bo IDĄ DO BAZY jako wartości. Rozdzielenie wartość/etykieta
   wymaga decyzji i ewentualnej migracji danych.
6. **`AISecuritySettings`, `EmailSignatureSettings`, `BrandKitGovernanceSettings`,
   `LoginHistorySettings`, `PrivacyVisibilitySettings`, `WebAuthnSettings`, `ProfileSurveyNudge`
   nie mają ANI JEDNEGO importera** — przetłumaczone, ale dziś niewidoczne dla użytkownika.
   Do rozstrzygnięcia osobno: podpiąć czy usunąć.
