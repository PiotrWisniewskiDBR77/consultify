---
agreement_id: MOD-AGR-02
module: Organization
status: ACCEPTED_WITH_UI_REWORK
owner: piotr
prepared_by: codex
accepted_by: piotr
accepted_at: 2026-07-31
last_reviewed: 2026-07-31
---

# Zatwierdzona karta uzgodnienia — Organization

## 1. Zatwierdzona definicja

**Organization (Organizacja)** to wspólna, kontrolowana pamięć o firmie, dla
której prowadzona jest praca w Consultify. Utrzymuje jej tożsamość, model
działania, cele, wyzwania, strategię, kluczowe fakty i wiedzę wraz ze źródłami,
aktualnością oraz poziomem zaufania.

Organization jest „mózgiem kontekstowym” aplikacji: Teresa i wszystkie moduły
mogą wykorzystywać zatwierdzony kontekst, dzięki czemu użytkownik nie opowiada
tej samej historii firmy przy każdym narzędziu, wywiadzie, raporcie i rozmowie.

Organization nie jest panelem administracyjnym. Członkowie, role, billing,
limity, domeny i techniczna konfiguracja należą do **Admin Panel** albo
**Settings**. Organization może do nich prowadzić, ale nie powinno utrzymywać
drugiej implementacji tych funkcji.

## 2. Użytkownicy

### Główni

- właściciel lub lider organizacji;
- osoba odpowiedzialna za transformację;
- konsultant prowadzący pracę z organizacją;
- właściciel kontekstu dbający o jego jakość i aktualność.

### Współtwórcy

- liderzy funkcji i procesów;
- uczestnicy Interview;
- użytkownicy dostarczający dokumenty, fakty i dowody;
- właściciele KPI, inicjatyw, finansów i innych obiektów źródłowych.

### Konsumenci

- Teresa;
- Interview, Tools, Assessment, Initiatives, Execution, Results, Finance,
  Materials, Audits i Meeting;
- generatory dokumentów, prezentacji i arkuszy.

## 3. Potrzeba użytkownika

Użytkownik chce, aby Consultify:

- rozumiało jego firmę bez ciągłego powtarzania kontekstu;
- odróżniało fakt od celu, opinii, hipotezy i decyzji;
- wiedziało, skąd pochodzi informacja i czy nadal jest aktualna;
- wykrywało sprzeczne informacje zamiast arbitralnie wybierać jedną;
- używało tylko kontekstu dozwolonego dla danego użytkownika i projektu;
- pokazywało, jakie informacje są niepełne albo wymagają potwierdzenia;
- aktualizowało kontekst na podstawie pracy wykonywanej w innych modułach.

## 4. Co należy do Organization

Rekomenduję pięć obszarów:

1. **Profil firmy** — nazwa, branża, lokalizacje, skala, model biznesowy,
   produkty, klienci, sposób działania i kluczowe systemy.
2. **Kierunek** — ambicje, cele, oczekiwane rezultaty, priorytety i ograniczenia.
3. **Wyzwania** — problemy, dowody, przyczyny, ryzyka i nierozstrzygnięte pytania.
4. **Strategia** — zatwierdzone wybory, założenia, scenariusze i granice.
5. **Wiedza organizacyjna** — źródła, twierdzenia, relacje, konflikty,
   aktualność, historia i Knowledge Graph.

Megatrendy nie są częścią Organization — są narzędziem analitycznym w Tools.
Ich zaakceptowane wnioski mogą zasilić kontekst organizacji.

## 5. Typy informacji

Każdy istotny element kontekstu powinien mieć jawny typ:

| Typ | Znaczenie |
| --- | --- |
| **Fakt** | informacja potwierdzona źródłem |
| **Ambicja** | docelowy stan, którego organizacja chce |
| **Decyzja** | zatwierdzony wybór obowiązujący organizację |
| **Założenie** | robocza teza wymagająca walidacji |
| **Opinia** | perspektywa konkretnej osoby lub grupy |
| **Sygnał** | obserwacja wymagająca dalszego sprawdzenia |

AI nie może automatycznie podnosić założenia, opinii ani sygnału do rangi faktu.

## 6. Źródła kontekstu

Kontekst może pochodzić z:

- ręcznie uzupełnionego profilu;
- Interview i załączonych dowodów;
- dokumentów w Materials;
- sesji Tools i Assessment;
- decyzji, inicjatyw, wyników, finansów i audytów;
- zatwierdzonego rezultatu Canvas;
- rozmowy z Teresą, gdy użytkownik jawnie wybierze „dodaj do kontekstu”.

Każdy wpis zachowuje źródło, autora, datę, widoczność, pewność i historię.
Usunięcie dokumentu źródłowego nie powinno usuwać śladu pochodzenia, ale musi
oznaczyć źródło jako niedostępne.

## 7. Golden flow

1. Użytkownik tworzy lub wybiera organizację.
2. System pokazuje poziom kompletności i najważniejsze braki kontekstu.
3. Użytkownik uzupełnia podstawowy profil albo przekazuje dokument.
4. Teresa pomaga wydobyć fakty, cele, wyzwania i założenia.
5. System pokazuje propozycje wraz ze źródłem i poziomem zaufania.
6. Uprawniony użytkownik zatwierdza, poprawia albo odrzuca propozycje.
7. Powstaje wersjonowany snapshot kontekstu organizacji.
8. Teresa oraz moduły wykorzystują snapshot zgodnie z uprawnieniami.
9. Nowy Interview, dokument, KPI lub decyzja proponuje aktualizację kontekstu.
10. W przypadku sprzeczności system pokazuje konflikt właścicielowi zamiast
    po cichu nadpisywać informację.
11. Właściciel rozstrzyga konflikt, a historia pozostaje dostępna.

## 8. Główny rezultat

Rezultatem jest **zatwierdzony, wersjonowany i możliwy do ponownego użycia
snapshot kontekstu organizacji**.

Snapshot wskazuje:

- co system wie;
- czego nie wie;
- skąd to wie;
- kiedy informacja została potwierdzona;
- kto może jej używać;
- które informacje są sprzeczne lub niepewne.

## 9. Rola Teresy

Teresa:

- pomaga uzupełnić profil bez wielkiego formularza;
- zadaje pytania tylko o istotne braki;
- wydobywa propozycje faktów i założeń z dokumentów oraz rozmów;
- pokazuje źródła i konflikty;
- informuje, kiedy odpowiedź opiera na kontekście organizacji;
- proponuje aktualizację po ważnym wyniku pracy.

Teresa nie może:

- samodzielnie publikować ważnego faktu, decyzji lub celu;
- usuwać sprzeczności przez wybranie wygodniejszej wersji;
- używać kontekstu innej organizacji;
- ujawniać informacji poza ich zakresem widoczności;
- traktować wygenerowanej przez siebie treści jako niezależnego dowodu.

## 10. Rola Canvas

Canvas służy do wspólnego opracowania większej syntezy: profilu firmy,
strategii, mapy wyzwań albo kierunku transformacji. Dopiero zaakceptowane
elementy trafiają do Organization jako jawne fakty, ambicje, decyzje lub
założenia. Surowy szkic Canvas nie jest automatycznie źródłem prawdy.

## 11. Połączenia z aplikacją

| Moduł | Kontrakt |
| --- | --- |
| Chat/Teresa | otrzymuje zatwierdzony, dozwolony snapshot i wskazuje jego użycie |
| Interview | wnosi odpowiedzi i dowody jako propozycje twierdzeń |
| Tools/Assessment | korzystają z kontekstu; zaakceptowane wyniki mogą go aktualizować |
| Initiatives | pobierają cele i ograniczenia; nie zapisują planów do Organization |
| Execution | może aktualizować potwierdzone fakty operacyjne |
| Results | jest właścicielem KPI i pomiarów; Organization przechowuje tylko kontekst/odnośniki |
| Finance | jest właścicielem wartości finansowych; Organization przechowuje założenia wysokiego poziomu i odnośniki |
| Materials | przechowuje dokumenty źródłowe; Organization przechowuje wydobyte twierdzenia i provenance |
| Audits | dostarczają zatwierdzone ustalenia i ślad kontroli |
| Admin | członkowie, role, dostęp, billing, limity, domeny i konfiguracja |
| Settings | preferencje użytkownika i ustawienia sposobu pracy |

## 12. Granice

Organization:

- nie jest repozytorium wszystkich dokumentów;
- nie jest systemem zarządzania projektami;
- nie przechowuje kopii wszystkich KPI, inicjatyw i modeli finansowych;
- nie zastępuje Admin Panel;
- nie jest miejscem analizowania megatrendów;
- nie uznaje każdej wypowiedzi użytkownika za prawdę organizacyjną;
- nie pozwala jednemu użytkownikowi niejawnie nadpisać kontekstu całej firmy.

## 13. Stan obecny

### Mamy

- kanoniczne `/organization/*`; stare `/context/*` przekierowuje do Organization;
- Profil, Cele, Wyzwania, Strategię i Knowledge Graph;
- backendową persystencję per organizacja dla profilu i kontekstu;
- model źródeł, twierdzeń, pewności, widoczności i konfliktów;
- snapshot, audit, timeline oraz reuse contract;
- integracje m.in. z Interview, dokumentami, Tools, My Work, Chat, KPI i Finance;
- banner pokazujący, że Teresa korzysta z kontekstu;
- kontrolę członkostwa przy zmianie organizacji;
- przekierowania sekcji administracyjnych do Admin.

### Fragmentaryczne lub ryzykowne

- UI nadal pokazuje grupę Administration, choć funkcje są przekierowywane;
- `OrganizationView` nadal zawiera awaryjną lokalną implementację admina;
- główny shell i prezentacja powstały przed obecnym kanonem sekcji 2026 i
  pozostają wizualnie niespójne z nowszymi modułami;
- profil, kontekst, Knowledge Graph i system dokumentów kontekstowych tworzą
  kilka nakładających się powierzchni;
- nie wszystkie integracje muszą mieć jednakową semantykę zatwierdzenia;
- automatyczne źródła i ręczne wpisy wymagają jasnej hierarchii zaufania;
- potrzeba runtime evidence dla izolacji tenantów, konfliktów, usunięcia źródła
  i propagacji aktualizacji do Teresy;
- czerwcowy audyt jest częściowo nieaktualny po migracji 779 i późniejszych
  poprawkach, więc nie może być samodzielnym źródłem statusu.

## 14. Źródła prawdy

- `organization_profiles` — podstawowy profil i tożsamość biznesowa;
- organization context items/claims/snapshots — twierdzenia, źródła,
  konflikty i zatwierdzony kontekst;
- Materials/context documents — pliki źródłowe i ich wersje;
- moduł właścicielski — szczegółowe KPI, finanse, inicjatywy i inne obiekty;
- membership/RBAC — uprawnienia, nie treść kontekstu;
- project teams — Organization pokazuje projekty, zespoły, role, staffing,
  allocation i cross-project capacity zgodnie z
  [`PROJECT_TEAM_ROLES_AND_PIPELINE_GOVERNANCE.md`](PROJECT_TEAM_ROLES_AND_PIPELINE_GOVERNANCE.md);
- zatwierdzony snapshot — kontrakt używany przez Teresę i moduły.

## 15. Kryteria ukończenia

1. Profil i wszystkie elementy kontekstu są odseparowane per organizacja.
2. Dane przeżywają zmianę przeglądarki, sesji i aktywnej organizacji.
3. Każde twierdzenie ma typ, źródło, autora, datę i widoczność.
4. Fakt/ambicja/decyzja/założenie/opinia/sygnał nie są mieszane.
5. Teresa używa wyłącznie zatwierdzonego, dozwolonego snapshotu.
6. Konflikty są widoczne i rozstrzygane z historią.
7. Usunięcie źródła zmienia jego status i nie zostawia fałszywego provenance.
8. Aktualizacja kontekstu jest widoczna w kolejnej rozmowie i generowanym
   materiale.
9. Organization nie renderuje drugiego panelu administracyjnego.
10. E2E obejmuje: dokument → ekstrakcja → review → snapshot → odpowiedź Teresy
    → konflikt → rozstrzygnięcie.
11. Test izolacji potwierdza brak odczytu i zapisu między organizacjami.
12. UI pokazuje kompletność, aktualność, konflikty i wykorzystane źródła.
13. Nawigacja, nagłówki, sekcje, stany i komponenty są zgodne z aktualnym
    kanonem UI/UX Consultify.

## 16. Rekomendacja Codex

Przyjąć Organization jako **kanoniczną pamięć biznesową organizacji**, a nie
ogólny panel ustawień firmy. Zostawić pięć obszarów biznesowych i usunąć z
nawigacji wewnętrznej grupę Administration — odpowiednie funkcje już mają
właściciela w Admin Panel.

Pierwszy pion do odbioru:

**dokument/profil → propozycje twierdzeń → zatwierdzenie → snapshot → Teresa
odpowiada z kontekstem i źródłem → aktualizacja/konflikt**.

## 17. Decyzje właścicielskie

Do zatwierdzenia lub korekty:

1. Kto może publikować kontekst obowiązujący całą organizację: tylko
   Owner/Admin, czy również wyznaczona rola „Context Owner”?
2. Czy zwykli członkowie mogą dodawać propozycje zmian, które czekają na
   zatwierdzenie?
3. Czy kierunek strategiczny i cele organizacji mają być widoczne wszystkim
   członkom domyślnie, czy wymagają osobnego poziomu poufności?

Rozdzielenie Organization od Admin Panel/Settings zostało zatwierdzone.

## 18. Obowiązkowy przegląd UI/UX

Merytoryczny kontrakt modułu jest zaakceptowany, ale obecna prezentacja nie jest
docelowa. Moduł powstał we wczesnej fazie produktu i wymaga dopasowania do
aktualnego kanonu sekcji 2026.

### Zakres

- sprawdzić, czy pięć obszarów tworzy najlepszą nawigację i kolejność;
- usunąć z nawigacji Organization grupę Administration;
- zastąpić stary settings-like shell aktualnym shellem modułu;
- ujednolicić top bar, nagłówki, szerokości, odstępy, powierzchnie i tokeny;
- zastosować kanoniczne loading, empty, error, stale i conflict states;
- pokazać kompletność, świeżość, źródła i konflikty bez technicznego szumu;
- zachować wygodne przejście do Admin Panel, ale nie jako drugi zestaw sekcji;
- sprawdzić light/dark, responsywność, klawiaturę i dostępność;
- porównać wizualnie z najnowszymi, zaakceptowanymi modułami Consultify.

### Priorytet

`P2 — polish before final staging acceptance`. Moduł jest ważnym źródłem
kontekstu, ale zwykle nie jest codziennym miejscem pracy. Zakres ma być
proporcjonalny: spójny reskin i uproszczenie nawigacji, nie kosztowna przebudowa
logiki.

### Dowód odbioru

- widok pięciu obszarów w light i dark;
- desktop oraz wąski viewport;
- porównanie przed/po z kanonem;
- brak zduplikowanej administracji;
- przejście profil → snapshot → źródła/konflikty bez utraty kontekstu;
- brak regresji istniejącej persystencji i Teresy.

## Prosty odbiór

Odpowiedz:

- `AKCEPTUJĘ`, albo
- `AKCEPTUJĘ Z POPRAWKĄ: ...`, albo
- wskaż wyłącznie numery 1–3 z sekcji decyzji właścicielskich.
