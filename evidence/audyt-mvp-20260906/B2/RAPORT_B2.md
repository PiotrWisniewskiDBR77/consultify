# Audyt gotowości MVP — pakiet B2, na żywo (05/06.09.2026, stanowisko lokalne)

Moduły: 08 Spotkania · 11 Materiały · 12 Audyty · 01 Organizacja · 14 Administracja ·
15 Ustawienia · 16 Partner · powłoka globalna. Środowisko: `localhost:3090` (Vite) →
`127.0.0.1:4100` (API) → lokalny Postgres, org DBR77, konto `audyt@dbr77.local` (OWNER).
Sesja: `ODBIOR_AUTH_STATE=/private/tmp/stanowisko-noc/auth-B.json`. Poprzedni audyt
statyczny: `evidence/audyt-mvp-20260906/B/RAPORT_B.md` (blokada auth na stagingu —
DZIŚ sesja lokalna działała, więc dużo z tamtego "NIE ZMIERZONE" dało się dopiąć na żywo).

## ZASTRZEŻENIE ŚRODOWISKOWE — incydent w trakcie audytu (przeczytaj przed resztą)

Ok. 23:24:47 (05.09) coś (INNY proces we WSPÓLNYM worktree `/private/tmp/m03` — nie ja,
nie uruchamiałem żadnej komendy `git sparse-checkout`) zawęziło ten worktree do
sparse-checkout `/*` + `!/*/` — **1% śledzonych plików materializowanych na dysku**.
Skutek natychmiastowy: `src/`, `public/`, `tests/` zniknęły z dysku (wciąż całe i
nietknięte w obiektach gita — `git show HEAD:plik` działał cały czas), Vite zaczął sztorm
"page reload" po całym drzewie, a `/src/index.tsx` (wejście aplikacji) zaczęło zwracać 404
→ **biały ekran** na porcie 3090 przez ok. 8-9 minut (zmierzone: `_debug1.png`/`_debug2.png`,
`vite.log` z `Pre-transform error: Failed to load url /src/index.tsx`). Ok. 23:33
środowisko samo wróciło (`git sparse-checkout list` → `fatal: this worktree is not sparse`).
**Skutek uboczny, wciąż aktywny na koniec audytu**: cache Vite "optimize-deps" pozostał
uszkodzony przynajmniej dla trasy Document Studio — `504 Outdated Optimize Dep` +
`Failed to fetch dynamically imported module …DocumentStudioView.tsx` odtworzone
DWUKROTNIE, w dwóch niezależnych kontekstach przeglądarki, PO samonaprawie sparse-checkout
(dowód: `_debug2.html`, `11-materials-dokument-czysto.png` — nieskończony spinner,
`_retry-docstudio.png` — ten sam błąd). Inne trasy (Spotkania, Ustawienia, Organizacja,
Materiały-lista) ładują się czysto (0 błędów konsoli) — problem jest zakresowy, nie globalny.

**Zgodnie z mandatem audytora (tylko odczyt, zero restartów) NIE próbowałem naprawić ani
sparse-checkout, ani cache Vite.** To NIE jest defekt produktu — to ryzyko narzędziowe
współdzielonego worktree `m03` (ta sama rodzina problemów co w pamięci sesji:
"Współdzielony worktree m03", "worktree agenta usuwaj po scaleniu"). Praktyczny skutek dla
tego raportu: **Document Studio (tworzenie/edycja Dokumentu, pytanie o "martwe przyciski"
z poprzedniego audytu) NIE zostało dziś zweryfikowane** — trasa jest aktualnie zablokowana
na tym stanowisku. Ktoś z uprawnieniami do restartu procesu Vite powinien to odświeżyć
PRZED jutrzejszym demo, jeśli Document Studio ma być pokazywany.

---

## Powłoka globalna

| # | Ekran/krok | Co sprawdzono | Wynik | Dowód | Waga | Plik |
|---|---|---|---|---|---|---|
| G1 | `/login` bez sesji | Treść, konsola, język | OK — w pełni polski, 0 błędów konsoli | `global-login.png` (ŻYWO) | — | — |
| G2 | `/nie-ma-takiej-strony-xyz789` (404), z sesją i bez | Istnienie strony 404 | **Potwierdzone PONOWNIE, dwoma niezależnymi kontekstami**: niezalogowany → cichy redirect na `/` (marketing home), zalogowany → cichy redirect na `/chat`. Zero komunikatu "strona nie istnieje". | `global-404-noauth.png`, `global-404-auth.png` (oba ŻYWO) + kod | **WAŻNY** | `src/routes/AppRoutes.tsx:3811-3818` |
| G3 | Górny pasek — "Dane"/"Model" | Widoczne na każdym zrzucie: "Dane" zielona kropka, "Model" **czerwona/crimson kropka** stale | Semantycznie to prawdopodobnie "model niepodłączony" (poprawne użycie crimson = stan krytyczny wg kanonu), ale WARTO żeby właściciel świadomie to zobaczył PRZED demo — czerwona kropka przy nazwie "Model" na KAŻDYM ekranie robi wrażenie usterki | wszystkie zrzuty B2 | do potwierdzenia z właścicielem | nie zlokalizowano komponentu w budżecie czasu |
| G4 | Marketing home (`/`) — hero | Tekst DOM | Nagłówek zawiera "w jednym **workflow**" (anglicyzm w polskim tekście); osadzony obrazek makiety pokazuje "**Good morning, Piotr**" po angielsku (statyczny asset, nie live-dane) | `global-404-noauth.png` | KOSMETYKA | marketing hero asset/copy |
| G5 | Lewa nawigacja — tooltips na hover | Wymaga hover, narzędzie zrzutu tego nie robi | NIE ZMIERZONE | — | — | — |
| G6 | Pusty stan świeżo zalogowanego (kreator "Krok 1 z 3") | Nie da się bezpiecznie wywołać bez tworzenia nowego konta/org | NIE ZMIERZONE | — | — | — |
| G7 | Tryb ciemny | `zrzut.mjs` nie ma opcji `--ciemny` (`colorScheme` na sztywno `'light'`) — ten sam limit narzędzia co w poprzednim audycie | NIE ZMIERZONE | — | — | `scripts/dev/odbior-zywo/zrzut.mjs:47` |

**Werdykt powłoka: NIEGOTOWY do pełnej oceny** (G5/G6/G7 nie zmierzone), G2 (brak 404)
potwierdzony po raz drugi — to świadoma decyzja do podjęcia przez właściciela, nie
musi blokować jutra, ale powinna być nazwana wprost.

---

## 01 Organizacja (`/organization`)

status.json (05.09 14:23): GOTOWY, "21 ekranów zaakceptowanych". Wszystkie 7 modułów
pakietu B2 były `DO_ZAMROZENIA` (zatwierdzone przez właściciela 05.09 ok. 14:46-14:56).

| # | Ekran/krok | Co sprawdzono | Wynik | Dowód | Waga | Plik |
|---|---|---|---|---|---|---|
| 01-1 | `/organization` flagowy, na żywo | Nagłówek, breadcrumb, treść, konsola | **OK** — nagłówek top-left "Organizacja" (poprzedni bug z angielskim "Organization" potwierdzony naprawiony), breadcrumb spójny, 0 błędów konsoli | `01-organization-flagship.png` (ŻYWO) | — | — |
| 01-2 | Pole "Kraj siedziby" | Wartość | **"PL · Silesia"** — angielska nazwa regionu ("Silesia" zamiast "Śląskie"/"Śląsk") na flagowym ekranie modułu | `01-organization-flagship.png` + kod | WAŻNY (dane seed) | `server/scripts/seed-interview-demo.ts:337` |
| 01-3 | "Gotowość organizacji" (`/organization/readiness/summary`) na żywo | 5 wymiarów, blokady, dane testowe | **CZYSTE** na lokalnym seedzie: 0 konfliktów, 0 twierdzeń, żadnych surowych kluczy pól ani śmieciowych rekordów testowych widocznych — poprzedni BLOKER z audytu B (surowe `myWork.idea` + dane `AUDYT-M06...`) **NIE reprodukuje się tutaj**, bo lokalna baza jest czysta (0 konfliktów) | `01-organization-readiness.png` (ŻYWO) | — | — |
| 01-4 | Czy przyczyna kodowa (2) z audytu B nadal istnieje | `OrganizationReadinessScreen.tsx:308-316` — blok `conflicts.forEach(...)` buduje tytuł `t('organization.readiness.blocker.conflict.title', 'Konflikt: {{path}}', { path: conflict.path })` — **`conflict.path` to surowa ścieżka techniczna (np. `myWork.idea`), ZERO mapowania na etykietę polską/czytelną** | kod, `git show HEAD` | **BLOKER (kod-potwierdzony, nie odtworzony wizualnie dziś z braku konfliktów w danych)** | `src/components/Organization/redesign/OrganizationReadinessScreen.tsx:308-316` |

**Werdykt: GOTOWY Z ZASTRZEŻENIEM.** Ekran dziś wygląda świetnie na CZYSTYCH danych
lokalnych, ale kod, który renderował surowe klucze pól przy realnym konflikcie danych
(BLOKER z audytu B), **jest wciąż nienaprawiony** — ujawni się natychmiast, gdy w
organizacji demo/produkcyjnej pojawi się jakikolwiek konflikt źródeł. Naprawa: słownik
humanizujący `path` (`myWork.idea` → "Pomysł z Mojej Pracy" itp.) w miejscu budowy
`blockers`. Dodatkowo: "Silesia" w seedzie do poprawienia na polską nazwę.

---

## 08 Spotkania (`/meetings`)

status.json: GOTOWY, "3 ekrany zgodne, bez uwag". Brak dedykowanego dokumentu odbioru
właściciela w `docs/program/ODBIOR_CTO_20260905/` dla tego modułu (tylko wpis w
`status.json`) — nie było czego rozliczyć poza tym jednym zdaniem.

| # | Ekran/krok | Co sprawdzono | Wynik | Dowód | Waga | Plik |
|---|---|---|---|---|---|---|
| 08-1 | `/meetings` flagowy, na żywo | Treść, konsola, puste dane | **OK** — pełen polski, "Brak spotkań / Zaplanuj pierwsze spotkanie…", 0 błędów konsoli. Lokalna baza ma 0 spotkań (czyste środowisko, inne niż staging z 05.09, gdzie 1 rekord wyglądał na test) | `08-meetings-flagship.png` (ŻYWO) | — | — |
| 08-2 | "+ Nowe spotkanie" → modal | Formularz | **OK** — "Utwórz spotkanie", pola Tytuł/Lokalizacja/Początek/Koniec/Uczestnicy/Materiały/Agenda, wszystko po polsku, czytelne | `08-meetings-nowe-krok1.png` (ŻYWO) | — | — |
| 08-3 | Wypełnienie formularza i zapis | Próbowano wypełnić i utworzyć `AUDYT-TMP-…` | **NIE ZMIERZONE** — mój selektor pola (`input[placeholder*=Tytuł]`) nie trafił w realne pole (prawdopodobnie `<label>` osobno od inputu bez placeholdera), a druga próba przypadła na moment incydentu środowiskowego (23:24) | `08-meetings-nowe-wypelnione.png` (identyczny z krok1 — formularz pusty) | — | budżet/incydent, nie defekt produktu |
| 08-4 | Publiczny widget rezerwacji | Nie otwierany dziś (budżet) | NIE ZMIERZONE | — | — | — |

**Werdykt: GOTOWY** na tym co dało się zmierzyć — brak nowych defektów, poprzedni
"śmieciowy rekord" z audytu B nie dotyczy lokalnej bazy (dane różne od stagingu).
Pełny przepływ zapis→lista→podgląd **nie zweryfikowany do końca** (formularz, nie zapis).

---

## 11 Materiały (`/presentations`)

status.json: GOTOWY, "35 z 36 ekranów zgodnych". Dedykowany dokument właściciela:
`docs/program/ODBIOR_CTO_20260905/09-10-11.md` (Materiały = 34/36 OK, 1 naprawiony,
1 do decyzji właściciela — patrz niżej).

| # | Ekran/krok | Co sprawdzono | Wynik | Dowód | Waga | Plik |
|---|---|---|---|---|---|---|
| 11-1 | Rejestr — zakładka Prezentacje, flagowy | Zakładki/kolumny/statusy | **OK** — "Wszystkie/Dokumenty/Prezentacje/Arkusze/Biblioteka wzorców" w pełni po polsku; poprzedni BLOKER audytu B ("100% angielski rejestr") **potwierdzony naprawiony** | `11-materials-flagship.png` (ŻYWO) | — | — |
| 11-2 | "+ Nowa prezentacja" → modal wyboru trybu | "Jak chcesz zacząć? Czysto / Z AI / Z wzorca" | OK, polski, czytelny | `11-materials-nowa-menu.png` (ŻYWO) | — | — |
| 11-3 | Tryb "Czysto" → utworzona realna prezentacja `AUDYT`-owa | Otwarty edytor DeckBuilder | **BLOKER — pierwszy (i jedyny) slajd nowej, czystej prezentacji pokazuje surowy angielski placeholder "Heading"** jako tytuł, na pustym płótnie. To jest DOSŁOWNIE pierwsza rzecz widoczna po kliknięciu "+ Nowa prezentacja → Czysto" | `11-materials-prezentacja-czysto.png` (ŻYWO, rekord `b8fbaa1c05d44964aae35a85ecea53a2`) | **BLOKER** | `src/components/Presentations/DeckBuilder/blocks/HeadingBlock.tsx:13` (`\|\| 'Heading'`) |
| 11-4 | Zakres problemu w kodzie | `getDefaultContent()` — fabryka treści domyślnej dla KAŻDEGO typu bloku dodawanego ręcznie w trybie "Czysto" | **Cały słownik domyślnych treści jest po angielsku, bez `t()`**: nagłówek "New Heading", akapit "Enter text here...", listy "Item 1/2/3", "Step 1/2/3", tabela nagłówki "A/B/C", wykres "Chart", KPI "Metric", notatka "Important note", oś czasu "Start/Mid/End" i inne | kod, `git show HEAD` | **BLOKER (systemowy, nie punktowy)** | `src/components/Presentations/DeckBuilder/DeckBuilder.tsx:2414-2460` |
| 11-5 | Zakładka Dokumenty (osobna od "Prezentacje") | Lista, CTA, breadcrumb | Lista: 12 dokumentów demo (ADMA/SIRI/DRD…), CTA poprawnie zmienia się na "Nowy dokument" (kontekstowe, bez błędu). **Ale breadcrumb top-left staje się redundantny: "Dokumenty › Dokumenty"** zamiast "Materiały › Dokumenty" — moduł "Materiały" znika z górnego okruszka po przełączeniu zakładki | `11-materials-dokumenty-tab.png` (ŻYWO) | WAŻNY | breadcrumb dla `/presentations?tab=documents` |
| 11-6 | "+ Nowy dokument" → "Czysto" → Document Studio | Otwarcie edytora | **NIE ZMIERZONE — zablokowane incydentem środowiskowym** (patrz zastrzeżenie na górze): nieskończony spinner, `504 Outdated Optimize Dep`, `Failed to fetch dynamically imported module …DocumentStudioView.tsx`, powtórzone 2×. Pytanie z audytu B ("martwe przyciski w Document Studio?") **wciąż otwarte** | `11-materials-dokument-czysto.png`, `_retry-docstudio.png` | środowisko, nie produkt | — |
| 11-7 | Decyzja architektoniczna "Z AI w Document Studio" | Z dokumentu właściciela 09-10-11.md: panel "Z AI" dziś to brief+link do globalnej Teresy, NIE czat osadzony — sprzeczność ze starą decyzją "JEDNA TERESA W SWOIM OKNIE" vs zapisem w zleceniu poprzedniego agenta o wyjątku dla Document Studio | Nierozstrzygnięte w dostępnych dokumentach | do wyjaśnienia z właścicielem | INFO | `docs/program/ODBIOR_CTO_20260905/09-10-11.md` |
| 11-8 | Arkusz/Whiteboard/Mapa myśli/Notatnik (Materiały) | Nie utworzone dziś | NIE ZMIERZONE (budżet + incydent środowiskowy zjadły czas) | — | — | — |

**Werdykt: NIEGOTOWY** — 11-3/11-4 to świeży, poprzednio nieznany BLOKER: każda ręcznie
tworzona (tryb "Czysto") prezentacja zaczyna się od widocznego angielskiego tekstu.
Biorąc pod uwagę, że "Czysto" jest RÓWNORZĘDNĄ opcją obok "Z AI" (kafle tej samej
wielkości, ten sam poziom w UI), to realna ścieżka, którą użytkownik/właściciel
prawdopodobnie wybierze podczas jutrzejszego demo "co potrafi produkt". Naprawa:
przepuścić `getDefaultContent()` i `HeadingBlock` fallback przez `t()` z polskimi kluczami
(wzorzec już istnieje w tym samym pliku: `presentations.builder.blocks.heading`).

---

## 12 Audyty (`/audit-programs`)

status.json: GOTOWY, "4 ekrany zgodne". Dedykowany dokument: 09-10-11.md — Audyty
"wszystkie 4 ZGODNE, brak pracy do wykonania" (05.09).

| # | Ekran/krok | Co sprawdzono | Wynik | Dowód | Waga | Plik |
|---|---|---|---|---|---|---|
| 12-1 | Biblioteka, flagowy | Nagłówek, zakładki, puste dane | **OK** — nagłówek "Audyty" (poprzedni bug "Audits" po angielsku potwierdzony naprawiony), 6 zakładek po polsku, 0 błędów konsoli | `12-audits-flagship.png` (ŻYWO) | — | — |
| 12-2 | Nagłówek kolumny "ZAKTUALIZOWANO" | Widoczność przy szerokości kanonicznej 1440px | **Ucięty do "ZAKTU"** — tabela ma za dużo kolumn (8 danych + checkbox + akcje) na 1440px, ostatnia kolumna wychodzi poza widoczny obszar bez czytelnej wskazówki przewijania | `12-audits-flagship.png`, crop potwierdzający | WAŻNY (kanon StandardTable, może dotyczyć innych szerokich tabel) | `src/components/shared/ModuleHub/FilterableTable.tsx` (szerokości kolumn) |
| 12-3 | "+ Nowy audyt" → modal | Stan bez opublikowanego pakietu | Modal otwiera się poprawnie, POPRAWNIE tłumaczy dlaczego nie można kontynuować ("Brak opublikowanych pakietów z przypisanym źródłem…"), przycisk "Rozpocznij audyt" poprawnie wyszarzony | `12-audits-nowy.png` (ŻYWO) | — | — |
| 12-4 | Treść komunikatu w modalu | Język | **"Opublikuj pakiet w zakładce Library"** — nazwa zakładki po angielsku ("Library") wewnątrz w pełni polskiego zdania; realna nazwa zakładki w UI to "Biblioteka" | `12-audits-nowy.png` + kod | WAŻNY | `src/components/Audit/method/NewAuditModal.tsx:91` |
| 12-5 | Dalszy przepływ (wybór pakietu → utworzenie audytu) | Zablokowane brakiem opublikowanego pakietu w lokalnej bazie (poza bezpiecznym zakresem audytu — wymagałoby publikacji metodyki) | NIE ZMIERZONE | — | — | — |

**Werdykt: GOTOWY Z KOSMETYKĄ/WAŻNYMI** — moduł działa i jest spójny, ale 12-2 i 12-4
to nowe, konkretne, łatwe do naprawienia usterki nieznalezione 05.09 (bo tamten audyt nie
otwierał modalu "Nowy audyt" na pustym stanie pakietów).

---

## 14 Administracja (`/admin`)

status.json: GOTOWY, "28 ekranów zgodnych, health po polsku".

| # | Ekran/krok | Co sprawdzono | Wynik | Dowód | Waga | Plik |
|---|---|---|---|---|---|---|
| 14-1 | Użytkownicy, flagowy | Karty ról, tabela członków | **OK** — 4 karty (Właściciel/Administrator/Członek/Gość) z jasnymi opisami, tabela z 1 realnym użytkownikiem, 0 błędów konsoli | `14-admin-flagship.png` (ŻYWO) | — | — |
| 14-2 | Nagłówek vs breadcrumb | "Panel Administratora" (nagłówek górny) vs "Panel administratora" (okruszek) | Niespójna wielkość liter między dwoma miejscami tej samej etykiety | `14-admin-flagship.png` | KOSMETYKA | breadcrumb/nagłówek dla `/admin/*` |
| 14-3 | Rola "user"/"member" widoczna gdzieś w tabeli | Tylko 1 członek (OWNER) w organizacji lokalnej — nie da się bezpiecznie odtworzyć roli "user" bez dodania nowego członka (poza bezpiecznym zakresem audytu) | NIE ZMIERZONE (patrz BLOKER w sekcji Ustawienia — ten sam kod dotyczy prawdopodobnie i tu, do sprawdzenia) | — | — | — |

**Werdykt: GOTOWY** — brak nowych defektów w zakresie, który dało się bezpiecznie
zmierzyć na jednoosobowej organizacji demo.

---

## 15 Ustawienia (`/settings`)

status.json: GOTOWY, "8 ekranów zgodnych". Ten sam BLOKER co w audycie B —
zweryfikowany dziś w 100% w kodzie ponownie, PLUS nowy, ŻYWO potwierdzony defekt
breadcrumbu.

| # | Ekran/krok | Co sprawdzono | Wynik | Dowód | Waga | Plik |
|---|---|---|---|---|---|---|
| 15-1 | Profil, flagowy | Treść, rola wyświetlana | **OK dla roli OWNER** — "Właściciel" poprawnie po polsku (bo klucz `settings.profile.roles.owner` istnieje) | `15-settings-flagship.png` (ŻYWO) | — | — |
| 15-2 | Kod roli "user" | `ProfileSettings.tsx:603`: `t(\`settings.profile.roles.${role.toLowerCase()}\`)` **bez fallbacku**; `translation.json` ma klucze dla owner/admin/member/superadmin/product/sales/… ale **NIE ma `settings.profile.roles.user`**, mimo że `UserRole` (`src/types/domain/user.ts:14-26`) zawiera `'user'`/`'USER'` — prawdopodobnie najliczniejsza rola w realnej organizacji | Kod-zweryfikowany 100%, NIE odtworzony wizualnie (konto audytowe = OWNER, brak w bazie lokalnej użytkownika z rolą "user" — dodanie nowego członka wykraczało poza bezpieczny zakres) | **BLOKER (kod-potwierdzony, wysoka pewność, drugi raz z rzędu)** | `src/components/settings/ProfileSettings.tsx:603` |
| 15-3 | Bezpieczeństwo → Przegląd bezpieczeństwa | Treść, MFA | **OK** — breadcrumb górny TYM RAZEM poprawnie zaktualizowany na "Ustawienia › Bezpieczeństwo"; "0% Wymaga poprawy" (czerwony baner, semantycznie poprawny crimson); MFA jawnie oznaczone "Odroczone — Nieuwzględnione w demo MVP" (transparentna, świadoma decyzja, NIE ukryta); NIE włączano MFA zgodnie z zadaniem | `15-settings-security.png` (ŻYWO) | — | — |
| 15-4 | Zaawansowane → Import/Eksport ustawień | Górny globalny breadcrumb (obok logo "77") vs lokalny breadcrumb strony | **POTWIERDZONY NA ŻYWO, DZIŚ, dokładnie ten sam defekt co w audycie B**: górny pasek pokazuje "Ustawienia › **Profil**" (nieaktualne), podczas gdy lokalny breadcrumb i treść strony poprawnie pokazują "Ustawienia › Import/Eksport ustawień", a lewe menu poprawnie podświetla "Import/Eksport" | `15-settings-import-eksport.png` (ŻYWO — **DWA NIEZALEŻNE potwierdzenia dziś, przed i pod nazwą "Zaawansowane"**) | **WAŻNY (żywo potwierdzony 2×)** | `src/hooks/useBreadcrumbs.ts:294-324` |
| 15-5 | Przyczyna kodowa 15-4 | `useBreadcrumbs.ts` ma jawną mapę `currentView → sub` TYLKO dla 8 podstron Ustawień (Profil/Rozliczenia/AI/Powiadomienia/Integracje/Bezpieczeństwo/Wygląd/Organizacja) — **Import/Eksport, Szablony, Deweloper, Preferencje pracy, Godziny pracy, Awatar, Podpisy e-mail, Dane i prywatność NIE są objęte** i albo dostają pusty `sub` (samo "Ustawienia"), albo — jak zaobserwowano żywo — pokazują POPRZEDNIĄ wartość (możliwy efekt cache'owania w `MainLayout`, nie zbadany do końca w budżecie) | kod | WAŻNY | `src/hooks/useBreadcrumbs.ts:324` (`else { sub = ''; }`) |
| 15-6 | Eksport/Import ustawień — treść ekranu | Etykiety, checkboxy | OK, w pełni po polsku, 8 kategorii eksportu, drag&drop importu opisany po polsku | `15-settings-import-eksport.png` | — | — |

**Werdykt: NIEGOTOWY** — 15-2 to NAJSILNIEJSZY defekt całego pakietu B2 (identyczny z
audytem B, wciąż żywy, teraz podwójnie potwierdzony w dwóch niezależnych sesjach audytu),
plus nowy, żywo-podwójnie-potwierdzony 15-4/15-5.

---

## 16 Partner (`/partner`, `/become-partner/*`)

status.json: GOTOWY, "21 ekranów, 5 defektów naprawionych + 1 stacking-context".
Dedykowany dokument: `16-19.md` — wszystkie zgłoszone naprawy zweryfikowane dziś żywo.

| # | Ekran/krok | Co sprawdzono | Wynik | Dowód | Waga | Plik |
|---|---|---|---|---|---|---|
| 16-1 | `/partner` (portal, niepodłączony), na żywo | Treść, boczne menu | **OK** — "Profil partnera nie jest jeszcze podłączony", menu Start wyszarzone, reszta sekcji aktywna, w pełni polskie | `16-partner-flagship.png` (ŻYWO) | — | — |
| 16-2 | `/become-partner/apply`, na żywo, BEZ sesji | Naprawy z 16-19.md (stacking-context, angielski formularz) | **OBIE NAPRAWY POTWIERDZONE ŻYWO**: ciemne tło hero czytelne (kontrast OK), CAŁY formularz po polsku (Imię i nazwisko/Służbowy e-mail/Firma/Strona/Kraj/Rola/Wielkość zespołu/Obszar/uzasadnienie) | `16-partner-apply-public.png` (ŻYWO) | — | — |
| 16-3 | `/partner/pricing` → `/become-partner#commercial-framework`, na żywo | Treść | OK, polski, "Software house" (anglicyzm branżowy) jedyna uwaga | `16-partner-pricing-public.png` (ŻYWO) | KOSMETYKA | — |
| 16-4 | CTA crimson na stronach marketingowych | Kolor przycisków "Rozpocznij trial"/"Wyślij zgłoszenie" | Crimson — zgodnie z poprzednim audytem, prawdopodobnie świadomy branding stron PUBLICZNYCH (odrębny od zakazu w APLIKACJI) | oba zrzuty publiczne | do świadomego potwierdzenia właściciela | — |

**Werdykt: GOTOWY** — wszystkie zgłoszone 05.09 naprawy potwierdzone żywo dziś, brak
nowych defektów w części dostępnej bez podłączonego konta partnerskiego. Portal
"podłączony" (dashboard z prawdziwym partnerem) pozostaje nie do zweryfikowania na tym
koncie (poprawne ograniczenie bezpieczeństwa, nie defekt).

---

## Lista defektów wg wagi (z reprodukcją)

### BLOKER

1. **Nowa prezentacja w trybie "Czysto" zaczyna się od angielskiego placeholdera
   "Heading".** Repro: `/presentations` → "Nowa prezentacja" → "Czysto". Pierwszy slajd
   pokazuje tytuł "Heading". Plik: `src/components/Presentations/DeckBuilder/blocks/
   HeadingBlock.tsx:13` (`(block.content.text as string) || 'Heading'`). Naprawa:
   `t('presentations.builder.blocks.headingDefaultText', 'Nagłówek')` zamiast literału.

2. **Cała fabryka domyślnych treści bloków w edytorze prezentacji jest po angielsku.**
   Repro: jak wyżej, potem "Nowy slajd" → dowolny typ bloku z paska narzędzi (Pole
   tekstowe, tabela, wykres, KPI, oś czasu…). Plik:
   `src/components/Presentations/DeckBuilder/DeckBuilder.tsx:2414-2460`
   (`getDefaultContent()`) — "New Heading", "Enter text here...", "Item 1/2/3",
   "Step 1/2/3", "A/B/C", "Chart", "Metric", "Important note", "Start/Mid/End" itd.
   Naprawa: przepuścić całą funkcję przez `t()` z polskimi kluczami.

3. **Ustawienia → Profil: rola "user" pokazuje surowy klucz i18n zamiast "Użytkownik".**
   (Powtórka z audytu B, wciąż nienaprawione.) Plik:
   `src/components/settings/ProfileSettings.tsx:603`; brakujący klucz
   `settings.profile.roles.user` w `public/locales/pl/translation.json`. Naprawa:
   jednowierszowa — dodać klucz albo przywrócić fallback `t(key, currentUser.role)`.

4. **Organizacja → "Gotowość organizacji": tytuł blokady renderuje surową ścieżkę pola
   (`Konflikt: myWork.idea`) bez humanizacji**, gdy tylko pojawi się realny konflikt
   danych. Nie odtworzone wizualnie dziś (lokalna baza ma 0 konfliktów), ale kod
   niezmieniony od audytu B. Plik:
   `src/components/Organization/redesign/OrganizationReadinessScreen.tsx:308-316`.

### WAŻNY

5. **Brak strony 404** — cichy redirect na `/chat`/`/` dla dowolnej nieznanej trasy.
   `src/routes/AppRoutes.tsx:3811-3818`. Potwierdzone żywo 2× (z sesją i bez).
6. **Ustawienia — górny globalny breadcrumb nie aktualizuje się** dla podstron poza
   ośmioma "znanymi" (Profil/Rozliczenia/AI/Powiadomienia/Integracje/Bezpieczeństwo/
   Wygląd/Organizacja) — potwierdzone żywo DWUKROTNIE dziś na "Import/Eksport".
   `src/hooks/useBreadcrumbs.ts:294-324`.
7. **Materiały → zakładka "Dokumenty": breadcrumb traci tożsamość modułu** —
   "Dokumenty › Dokumenty" zamiast "Materiały › Dokumenty". Potwierdzone żywo.
8. **Audyty → modal "Nowy audyt" na pustym stanie: "zakładce Library"** zamiast
   "zakładce Biblioteka" — anglicyzm w polskim zdaniu. Potwierdzone żywo.
   `src/components/Audit/method/NewAuditModal.tsx:91`.
9. **Organizacja, pole "Kraj siedziby": "PL · Silesia"** — angielska nazwa regionu w
   danych demo, widoczna na ekranie flagowym. `server/scripts/seed-interview-demo.ts:337`.
10. **Audyty — nagłówek ostatniej kolumny tabeli ("ZAKTUALIZOWANO") ucięty do "ZAKTU"**
    przy kanonicznej szerokości 1440px, bez widocznej wskazówki przewijania. Może
    dotyczyć innych tabel z 8+ kolumnami (kanon `StandardTable`/`FilterableTable`).

### KOSMETYKA

11. Marketing home: anglicyzm "workflow" w nagłówku; osadzony obrazek makiety pokazuje
    angielski tekst "Good morning, Piotr" (statyczny asset).
12. `/partner/pricing`: "Software house" — anglicyzm branżowy, prawdopodobnie akceptowalny.
13. Panel Administratora: niespójność wielkości liter nagłówek vs breadcrumb
    ("Panel Administratora" / "Panel administratora").
14. `FilterableTable.tsx` `OverflowTooltip` — teoretyczne ryzyko `[object Object]`/
    `undefined` dla nie-tekstowych komórek bez `column.render` (niezmienione od audytu B,
    nie potwierdzone na żywo).

### DO WYJAŚNIENIA Z WŁAŚCICIELEM (nie defekt, decyzja produktowa)

15. Document Studio, panel "Z AI": dziś brief+link do globalnej Teresy, nie czat osadzony
    — sprzeczność między decyzją "JEDNA TERESA W SWOIM OKNIE" (01.09) a zapisanym
    wyjątkiem dla Document Studio w zleceniu poprzedniego audytora. Nierozstrzygnięte.
16. Czerwona/crimson kropka przy "Model" w górnym pasku, widoczna na KAŻDYM ekranie —
    prawdopodobnie poprawna semantyka (model niepodłączony), ale warto świadomego
    potwierdzenia przed demo (pierwsze wrażenie "coś jest zepsute").

---

## Czego NIE dało się zmierzyć dziś (wprost)

- **Document Studio w całości** (tworzenie/edycja dokumentu, pytanie o "martwe przyciski"
  z audytu wcześniejszego) — trasa zablokowana uszkodzonym cache Vite po incydencie
  środowiskowym (patrz zastrzeżenie na górze). Wymaga odświeżenia procesu Vite przez
  osobę z uprawnieniami do restartu.
- Arkusz, Whiteboard, Mapa myśli, Notatnik w kontekście modułu Materiały — nie utworzone
  (budżet czasu zjedzony przez incydent środowiskowy + dochodzenie jego przyczyny).
- Teresa: wejście z prawego panelu + "Podsumuj co tu widzisz" — dla ŻADNEGO z 7 modułów
  (priorytet poszedł w stronę dokończenia przepływów klikanych i weryfikacji BLOKERÓW).
- Kebab (menu wiersza) w tabelach — nie klikane w tej turze.
- Lewa nawigacja — etykiety/tooltips na hover.
- Pusty stan świeżo zalogowanego użytkownika / kreator "Krok 1 z 3".
- Tryb ciemny — narzędzie zrzutu nie ma tej opcji (ten sam limit co w audycie B).
- Rola "user"/"member" wizualnie (Ustawienia/Administracja) — organizacja lokalna ma
  tylko 1 członka (OWNER); dodanie nowego członka wykraczało poza bezpieczny zakres
  audytu tylko-do-odczytu.
- Pełny zapis formularza "Nowe spotkanie" (utworzenie rekordu) — modal się otwiera i
  wygląda poprawnie, ale wypełnienie/zapis nie zostało potwierdzone.
- Dalszy przepływ "Nowy audyt" po wyborze opublikowanego pakietu — lokalna baza nie ma
  żadnego opublikowanego pakietu audytowego.
- Uwagi właściciela dla modułów 08/01/14 — brak dedykowanych dokumentów w
  `docs/program/ODBIOR_CTO_20260905/` (tylko jednolinijkowe wpisy w `status.json`);
  dla 11/12/16 dokumenty istnieją i zostały przeczytane w całości.

## Werdykty modułów (podsumowanie)

| Moduł | Werdykt |
|---|---|
| Powłoka globalna | NIEGOTOWY do pełnej oceny (braki pomiarowe) — 1 WAŻNY potwierdzony (brak 404) |
| 01 Organizacja | GOTOWY Z ZASTRZEŻENIEM — 1 BLOKER kod-potwierdzony (nie widoczny na czystych danych), 1 WAŻNY (dane seed) |
| 08 Spotkania | GOTOWY na tym co zmierzone — pełny zapis formularza nie potwierdzony |
| 11 Materiały | **NIEGOTOWY** — 2 nowe BLOKERY (angielskie placeholdery w edytorze prezentacji) |
| 12 Audyty | GOTOWY Z KOSMETYKĄ/WAŻNYMI — 2 nowe drobne, łatwe do naprawienia usterki |
| 14 Administracja | GOTOWY |
| 15 Ustawienia | **NIEGOTOWY** — BLOKER roli "user" (powtórka), WAŻNY breadcrumb (nowy, podwójnie potwierdzony) |
| 16 Partner | GOTOWY — wszystkie naprawy z 05.09 potwierdzone żywo |
