---
document_id: INITIATIVE-APPROVAL-GOVERNANCE-PROFILES
module: Initiatives / Admin / Settings
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Zatwierdzanie Initiative — profil domyślny i konfiguracja

## 1. Zasada

Domyślny proces ma być prosty i zrozumiały. Organizacja może go rozszerzyć w
Adminie, projekt może wybrać zatwierdzony profil, a Teresa może zaproponować
zmianę. AI nigdy nie aktywuje procesu, nie wyznacza sama decydentów i nie
zatwierdza Initiative.

## 2. Profil domyślny `SIMPLE`

Trzy osoby/role i trzy właściwe decyzje:

| Krok | Przygotowuje | Zatwierdza | Wynik |
| --- | --- | --- | --- |
| 1. Register Candidate | Proposal Owner | **Project Leader** | Registered Initiative trafia do List. |
| 2. Go/No-Go | Initiative Owner | **Sponsor** | Approved Backlog albo Return/Defer/Reject. |
| 3. Schedule & Start | Project Leader | **Project Leader**, jeśli mieści się w zatwierdzonym envelope | Scheduled i handoff do Execution. |

Reguły:

- Initiative Owner może przygotować i wysłać, ale nie zatwierdza własnego
  strategicznego Go/No-Go;
- Project Leader odpowiada za jakość wejścia, zespół, wykonalność i harmonogram;
- Sponsor odpowiada za sens biznesowy, priorytet, budżet envelope i Go/No-Go;
- Schedule nie wymaga ponownego Sponsora, jeżeli termin, koszt, ryzyko, scope i
  capacity mieszczą się w jego zatwierdzonych tolerancjach;
- przekroczenie tolerancji automatycznie eskaluje Schedule Decision do Sponsora.

To jest rekomendowany profil dla większości niewielkich i średnich Initiative.

## 3. Minimalny przepływ

`Proposal Draft → Project Leader Register → Initiative Owner definition and
analysis → Sponsor Go/No-Go → Approved Backlog → Project Leader schedule within
tolerances → Scheduled → Execution`

Teresa przygotowuje readiness, Decision Brief, braki, warianty i impact. Każde
zatwierdzenie pozostaje widoczną czynnością człowieka.

## 4. Automatyczna eskalacja ponad profil SIMPLE

Prosty profil nie może osłabić wymaganej kontroli. System sprawdza przed
decyzją:

- budżet lub ekspozycję finansową ponad próg;
- wysokie ryzyko albo residual risk wymagające akceptacji;
- regulacje, compliance, security, privacy lub safety;
- wpływ międzydziałowy, wieloprojektowy albo zewnętrzny;
- zmianę strategicznego celu, polityki lub operating modelu;
- krytyczną zależność albo niedostępność capacity;
- konflikt interesów lub brak separation of duties;
- przekroczenie tolerancji scope/cost/time/value;
- manualną flagę Sponsor/PMO/Admin.

Trigger przełącza pojedynczą decyzję lub całą Initiative na rozszerzony profil.
System pokazuje przyczynę i wymagany authority; nie próbuje ominąć bramki.

## 5. Profile rozszerzone

### `STANDARD`

- Project Leader rejestruje;
- Initiative Owner kończy Definition;
- PMO/Reviewer potwierdza readiness;
- Sponsor zatwierdza Go/No-Go;
- Project Leader przygotowuje Schedule;
- Sponsor zatwierdza Schedule przekraczający tolerancje.

### `STEERING_CONTROLLED`

- Project Leader/PMO rejestruje;
- niezależni ownerzy Finance, Risk, KPI i Technical zatwierdzają swoje prawdy;
- Sponsor rekomenduje;
- Steering Board podejmuje Go/No-Go i kluczowe wyjątki;
- PMO potwierdza gate completeness;
- Project Leader uruchamia Execution wyłącznie w zatwierdzonym baseline.

### `REGULATED`

Profil organizacyjny definiuje obowiązkowe review funkcjonalne, dowody, podpisy,
separation of duties, retencję i brak możliwości pominięcia gates. Teresa może
pomagać, ale nie zastępuje osoby posiadającej wymagane kwalifikacje.

## 6. Poziomy konfiguracji

Priorytet polityk:

`system hard stops → organization policy → project profile → initiative
override → decision-specific escalation`

### Admin organizacji

Może:

- wybrać domyślny profil organizacji;
- utworzyć wersjonowany custom profile z zatwierdzonego zestawu kroków;
- zdefiniować progi budżetu, ryzyka, regulacji i wpływu;
- mapować required authority na Project Roles;
- ustawić separation of duties, delegation i zastępstwa;
- ustawić SLA, reminders i escalation chain;
- ustalić, które elementy projektu mogą zmieniać Sponsor/Project Leader;
- publikować, wycofywać i migrować profile.

Nie może skonfigurować procesu poniżej platformowych hard stops bezpieczeństwa.

### Projekt

Admin/Sponsor wybiera jeden z profili dozwolonych przez organizację. Zmiana
profilu pokazuje impact na otwarte Proposal, Initiative, Decisions i Gates.
Nowa wersja działa domyślnie dla nowych Initiative; migracja aktywnych wymaga
jawnej decyzji.

### Pojedyncza Initiative

Sponsor może wzmocnić governance lub — jeżeli organization policy pozwala —
wybrać prostszy dozwolony profil. Override ma powód, zakres, autora, datę i
expiry. Nie działa wstecz na podjęte decyzje.

## 7. Teresa jako projektant procesu

Teresa może uruchomić `Governance Recommendation`:

1. analizuje typ, wartość, ryzyko, regulacje, liczbę jednostek, capacity,
   poufność i konflikty ról;
2. porównuje wymagania z profilami dozwolonymi przez organizację;
3. rekomenduje profil i konkretne zmiany;
4. wyjaśnia, dlaczego SIMPLE wystarcza albo dlaczego potrzebna jest eskalacja;
5. pokazuje role, które trzeba obsadzić, SLA i wpływ na czas procesu;
6. przygotowuje preview/diff konfiguracji;
7. wysyła propozycję do Sponsor/Admin approval.

Teresa nie może tworzyć dowolnych permission keys, usuwać hard stops, przypisać
samej siebie jako approvera, aktywować profilu ani zmienić trwającego procesu
bez zatwierdzenia.

## 8. Ręczna zmiana procesu

Uprawniony Admin/Sponsor może zmienić profil ręcznie przez ten sam mechanizm:

- wybór dozwolonego profilu;
- reason i effective date;
- impact preview;
- rozwiązanie brakujących ról;
- wybór: tylko nowe Initiative lub jawna migracja wybranych aktywnych;
- zatwierdzenie i publikacja nowej wersji;
- notification do osób, których authority lub praca się zmienia.

Nie edytujemy „żywego” profilu w miejscu. Każda zmiana tworzy nową wersję.
Decisions zachowują snapshot profilu obowiązującego w chwili decyzji.

## 9. Stany decyzji i zastępstwa

Każdy krok zna `preparer`, `decisionMaker`, opcjonalnych reviewers, due/SLA,
quorum, delegation, substitute i escalation target. Jeżeli rola jest nieobsadzona:

- gate jest `BLOCKED_MISSING_ROLE`;
- system proponuje obsadzenie roli albo dozwolone zastępstwo;
- nie przyznaje authority najbliższej osobie automatycznie;
- Admin/Sponsor dostaje actionable notification.

Jeżeli Steering Board jest wyłączony, organization policy może delegować jego
decyzję Sponsorowi lub Portfolio Ownerowi. Delegacja musi być jawna w Decision.

## 10. UI

### Initiative

- badge aktywnego profilu i wersji;
- następny gate, preparer, decydent, due i readiness;
- `Why this approval?` oraz tolerancje;
- `Ask Teresa to review governance`;
- `Propose profile change` dla uprawnionych;
- historia zmian i snapshot przy każdej decyzji.

### Admin / Settings

- profile registry i visual workflow editor;
- role mapping i authority matrix;
- thresholds/triggers;
- SLA/escalations/delegations;
- simulator: „kto zatwierdzi tę Initiative?”;
- draft → test → approve → publish → deprecate;
- audit i lista projektów/Initiative używających wersji.

## 11. Kryteria odbioru

- nowa organizacja otrzymuje aktywny `SIMPLE v1`;
- każda Initiative ma profile ID i immutable version;
- domyślny proces wymaga tylko Project Leader, Initiative Owner i Sponsor;
- Initiative Owner nie zatwierdza własnego Go/No-Go;
- Schedule w tolerancjach zatwierdza Project Leader bez zbędnego drugiego gate;
- przekroczenie progu automatycznie wyznacza właściwy wyższy authority;
- brak roli blokuje decyzję zamiast przyznawać authority domyślnie;
- Teresa wyłącznie rekomenduje zmianę i pokazuje diff;
- ręczna i AI-proponowana zmiana korzystają z tego samego approval flow;
- zmiana profilu nie nadpisuje historycznych decyzji;
- capabilities i gate enforcement są backend-owned;
- testy obejmują SIMPLE, próg eskalacji, brak roli, delegację, zmianę profilu i
  próbę niedozwolonego self-approval.
