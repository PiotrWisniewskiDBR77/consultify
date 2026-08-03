---
doc_kind: UI_UX_DECISION_REGISTER
spec_status: APPROVED_SPEC
owner: Piotr Wisniewski
last_updated: 2026-08-02
authority: docs/ui-standards/CANON.md
---

# Zamknięcie fazy teoretycznej standardu UI/UX

## 1. Wynik

Decyzje właścicielskie (§5) są potwierdzone przez właściciela produktu — patrz pola dowodowe przy O-01/O-02/O-03. To pozostaje w mocy i nie jest przedmiotem tej rewizji.

Werdykt dokumentacji jest inny niż poprzednio zapisany tutaj. Trzeci audyt dał `PASS FOR IMPLEMENTATION` (opisane w `DOCUMENTATION_REACCEPTANCE_2026-08-02.md`), ale **czwarty, niezależny audyt (2026-08-02) ten werdykt cofnął** i zwrócił `FAIL` z siedmioma blokerami P0, m.in.: sprzeczność reguły fokusa między `TRIADA_KANON.md` a `00-foundation/light-mode-readability.md` (zmierzony dług kodu 119 vs 3 pliki), martwa paleta fioletowa w `color-system.md`/`visual-language.md`, 12 z 20 sekcji identycznych bajt-w-bajt we wszystkich 26 kartach rodzin komponentów, pięć różnych szerokości panelu w jednym dokumencie oraz dwa konkurujące modele kebaba i preview.

**Aktualny status dokumentacji: `NEEDS_REMEDIATION`** (od 2026-08-02, do czasu niezależnej weryfikacji poprawek na te siedem blokerów — remediation jest w toku). Ten dokument celowo nie wpisuje w to miejsce nowej oceny liczbowej ani samodzielnego werdyktu „gotowe": nawyk pisania dokumentu, który sam sobie wystawia ocenę (np. „9,6/10"), jest dokładnie tym, co czwarty audyt wskazał jako patologię procesu. Runtime nadal wymaga fixture, testów i odbioru — niezależnie od statusu dokumentacji.

Screenshot jest domyślnie `AUDIT_EVIDENCE`, nie wzorcem. Aktualnymi referencjami kierunku dla kart rekordów są Zadania i Decyzje. Pozostałe widoki mogą zostać podniesione do rangi referencji wyłącznie po audycie.

## 2. Decyzje rozstrzygnięte autonomicznie

| Obszar | Decyzja |
|---|---|
| Biblioteka ikon | `lucide-react`; jedna biblioteka, centralne mapowanie semantyki |
| Status dokumentacji | osobne `spec_status` i `runtime_status` |
| Powierzchnie akcji | toolbar = częste; kebab = komplet rekordu; prawy klik = ekspercki kontekst, nigdy jedyny dostęp |
| Menu artefaktu | Menu 1: 60 px; Menu 2: 48 px; Menu 3 kontekstowe: 44 px |
| Nagłówek aplikacji | stały i niezależny od trzech menu artefaktu |
| Panel preview | prawy drawer 360 px domyślnie, dozwolony zakres 320–420 px; nie zmienia trasy |
| Panel właściwości | 360 px domyślnie; szerszy 420 px tylko dla formularzy wymagających miejsca |
| Gęstość tabel | wiersz 48 px domyślnie, 40 px compact; nagłówek 48 px; checkbox/akcje nie zmieniają wysokości |
| Kontrolki | 36 px domyślnie, 32 px compact, 40 px prominent; dotyk minimum 44 px |
| Breakpoint odbiorowy | desktop 1440 i 1920; tablet 1024 jako adaptacja; mobile nie jest zakresem obecnej naprawy MVP, ale nie wolno blokować przyszłego fallbacku |
| Otwarcie obiektu S | preview drawer; deep link może otworzyć pełny widok; create/edit w drawerze lub modalu zależnie od złożoności |
| Otwarcie obiektu L | pełny workspace z zachowaniem powrotu do listy, filtrów, sortowania i scrolla |
| Lifecycle | draft/idea = edycja; pending/in-review = podgląd z akcjami decyzyjnymi; approved/completed/published/archived = domyślnie read-only z jawną akcją ponownej edycji |
| Stany | loading, empty, populated, selected, editing, saving, success, partial, error, offline/degraded, read-only, no-access i archived są obowiązkowe tam, gdzie mają sens |
| AI | proposal/diff/approval/undo; brak cichych mutacji i atrap |
| Jasny/ciemny | wspólny DOM i semantyka; motyw zmienia tokeny, nie funkcję ani układ |
| Język | polski domyślny w produkcie; kompletne etykiety EN, bez mieszania języków w jednej powierzchni |
| Audyt i Spotkania | poza bieżącym MVP; w menu wyłącznie stan `Soon`, bez aktywnego fałszywego przepływu |
| Źródła wzorca | standardy i zaakceptowane implementacje; screenshoty błędnych ekranów służą diagnozie |

## 3. Kanoniczna anatomia artefaktu

Każdy artefakt otrzymuje jawnie określony archetyp: record, document, table, canvas albo presentation, oraz rozmiar S lub L. Obowiązkowo definiuje:

1. kontekst i breadcrumb;
2. Menu 1 z tożsamością, statusem, współpracą i akcją główną;
3. Menu 2 z trybem, narzędziami i akcjami widoku;
4. opcjonalne Menu 3 wyłącznie dla zaznaczenia lub lokalnego kontekstu;
5. obszar roboczy;
6. prawy panel preview/właściwości/kontekstu;
7. stany danych, nawigację, skróty, a11y, uprawnienia i telemetrykę;
8. listę wszystkich menu, ikon i akcji wraz z kontraktem zachowania;
9. dokładne wymiary przez tokeny, bez lokalnych wartości magicznych;
10. acceptance tests oraz dowody light/dark.

Tabela, preview, modal, drawer, wizard, edytor i canvas nie są „fragmentami obrazu”. Każdy jest osobną rodziną komponentu i musi posiadać kartę zgodną z `COMPONENT_DOCUMENTATION_CARD_STANDARD.md`.

## 4. Bramka gotowości do wdrożenia

Artefakt jest gotowy do implementacji dopiero, gdy:

- ma archetyp S/L i pełną anatomię;
- wszystkie akcje mają właściciela, warunki, skutek, feedback, error i undo/confirmation;
- każda ikona ma potwierdzoną semantykę i nazwę dostępności;
- zdefiniowano preview, pełne wnętrze, create/edit i powrót do kontekstu;
- opisano loading/empty/error/no-access/read-only oraz długie dane;
- określono jasny i ciemny motyw;
- istnieją fixture danych i kryteria visual regression;
- nie ma nierozstrzygniętej decyzji właścicielskiej wpływającej na kontrakt;
- `spec_status` wynosi `APPROVED_SPEC`;
- implementacja po audycie może otrzymać co najmniej `runtime_status: REFERENCE_READY`.

## 5. Decyzje właściciela produktu — zatwierdzone

### O-01. Branding eksportów i materiałów dla klienta

**Decyzja MVP:** wszystkie eksporty i materiały używają wyłącznie brandingu Consultify/DBR77. Branding organizacji, klienta i white-label pozostają poza MVP i mogą zostać zaprojektowane po weryfikacji z pierwszymi klientami.

**Źródło potwierdzenia:** zlecenie audytu, sesja 2026-08-02 — „Dla MVP obowiązuje wyłącznie branding Consultify/DBR77. Nie projektujemy teraz white-labelingu."
**Data potwierdzenia:** 2026-08-02.
**Forma:** pisemne, w treści zlecenia audytu.
**Potwierdził:** Piotr Wiśniewski (product owner).
**Siła dowodu wg skali §5.2:** poziom 1 (pisemny cytat) — najsilniejszy.

### O-02. Udostępnianie poza organizację

**Decyzja MVP:** obiekty mogą być prywatne lub organizacyjne. Jeżeli przepływ wymaga udostępnienia klientowi zewnętrznemu, stosujemy wyłącznie wygasający, rejestrowany link `read-only`. Edycja gościnna pozostaje poza MVP.

**Źródło potwierdzenia:** pytanie kontrolne, sesja 2026-08-02.
**Data potwierdzenia:** 2026-08-02.
**Forma:** ustne potwierdzenie na pytanie kontrolne.
**Potwierdził:** Piotr Wiśniewski (product owner).
**Siła dowodu wg skali §5.2:** poziom 3 (oświadczenie o rozmowie, bez dosłownego cytatu i bez odwołania do trwałego artefaktu) — najsłabszy dopuszczalny poziom, słabszy niż O-01. Bramka §5.1 pozostaje zamknięta operacyjnie na mocy tej rewizji (decyzja nie jest cofana), ale wpis jest oznaczony jako **dług dowodowy**: wymaga potwierdzenia w formie 1 (cytat) lub 2 (artefakt) przy najbliższej okazji kontaktu z właścicielem.

### O-03. Zakres ośmiu funkcji bez jednoznacznego miejsca nawigacyjnego

Dotyczy: Studio, Knowledge Base, Legal, Partner, Context Builder, Megatrend, Project Intelligence i Executive Summary.

**Decyzja MVP:** żadna z tych funkcji nie otrzymuje nowego samodzielnego modułu w menu. Obowiązuje mapowanie: Studio i Executive Summary → Materials; Context Builder → Organization/onboarding; Megatrend → Context; Project Intelligence → Execution; Knowledge Base → Settings/Help; Legal i Partner → funkcje wewnętrzne poza menu MVP.

**Źródło potwierdzenia:** pytanie kontrolne, sesja 2026-08-02.
**Data potwierdzenia:** 2026-08-02.
**Forma:** ustne potwierdzenie na pytanie kontrolne.
**Potwierdził:** Piotr Wiśniewski (product owner).
**Siła dowodu wg skali §5.2:** poziom 3 (oświadczenie o rozmowie, bez dosłownego cytatu i bez odwołania do trwałego artefaktu) — najsłabszy dopuszczalny poziom, słabszy niż O-01. Bramka §5.1 pozostaje zamknięta operacyjnie na mocy tej rewizji (decyzja nie jest cofana), ale wpis jest oznaczony jako **dług dowodowy**: wymaga potwierdzenia w formie 1 (cytat) lub 2 (artefakt) przy najbliższej okazji kontaktu z właścicielem.

## 5.1 Status bramki właścicielskiej

`OWNER DECISIONS CLOSED` — 2026-08-02. Wszystkie trzy decyzje (O-01/O-02/O-03) mają wypełniony ślad dowodowy (patrz pola przy każdej decyzji w §5) i nie są otwarte jako pytania biznesowe.

**Ten status dotyczy WYŁĄCZNIE tego, że decyzja została podjęta i udokumentowana — nie oznacza, że jest wdrożona w produkcie.** Konkretny przykład: O-01 (branding) jest decyzją zamkniętą, ale `docs/ui-standards/00-foundation/BRAND_EXPORT_CANON.md` §0 dokumentuje pięć niezależnych, niespójnych systemów stylowania eksportu (Deliverables/Report Builder/Document Studio PDF/Status Report PDF/chart series ad-hoc) i jawne zadania konwergencji VF3-2/3/4, które jeszcze nie ruszyły w kodzie. „Decyzja zamknięta" nie znaczy „zrobione" — to rozróżnienie obowiązuje przy odbiorze każdej z ośmiu funkcji z O-03 i przy odbiorze O-02 tak samo.

Etykieta `DOCUMENTATION PASS FOR IMPLEMENTATION`, wcześniej dopisana tutaj do statusu bramki, jest wycofana — patrz §1: czwarty audyt (2026-08-02) cofnął werdykt `PASS` i ustalił status dokumentacji na `NEEDS_REMEDIATION`. Pozostają otwarte: siedem blokerów P0 z czwartego audytu (§1) oraz wszystkie wykonawcze bramki runtime.

**Wg skali dowodowej z §5.2 (dodanej 2026-08-02):** O-01 ma dowód poziomu 1 (pisemny cytat). O-02 i O-03 mają dowód poziomu 3 (oświadczenie o rozmowie, bez cytatu i bez artefaktu) — najsłabszy dopuszczalny poziom. Bramka pozostaje zamknięta operacyjnie na mocy tego dokumentu (decyzje nie są cofane), ale O-02/O-03 są jawnie oznaczone jako **dług dowodowy** do domknięcia mocniejszą formą przy najbliższej okazji kontaktu z właścicielem.

## 5.2 Wymóg śladu dowodowego

Żadna decyzja właścicielska nie może otrzymać statusu zamkniętej bez wypełnionego pola źródła, daty i formy potwierdzenia (wzór zastosowany przy O-01/O-02/O-03 w §5: `Źródło potwierdzenia` / `Data potwierdzenia` / `Forma` / `Potwierdził`). Decyzja spisana w dokumencie, ale bez kompletu tych czterech pól, ma status `PROPOSED_PENDING_OWNER_CONFIRMATION` i **nie zamyka bramki** w §5.1 — niezależnie od tego, jak przekonująco brzmi w tekście i kto ją spisał.

**Sama obecność czterech pól nie wystarcza (rewizja 2026-08-02, panel adwersaryjny).** Wymóg „cztery pola wypełnione" sprawdza formę, nie prawdę: agent AI może wpisać dowolną treść we wszystkie cztery pola i formalnie „zamknąć" decyzję, nie mając od właściciela nic więcej niż własne przekonanie — to jest samopotwierdzenie w przebraniu formularza. Odbiorca sprawdza nie *obecność* pól, tylko czy pole „Źródło potwierdzenia" wskazuje coś, co **osoba trzecia może dziś zweryfikować niezależnie od autora wpisu** — także za pół roku, bez pytania nikogo o pamięć zdarzenia.

**Minimum dowodowe — jedno z dwóch, nie samo oświadczenie:**
1. **Dosłowny cytat** wypowiedzi właściciela produktu, w cudzysłowie, z kontekstem (np. treść zlecenia, wiadomość, transkrypt) — tak jak w O-01.
2. **Odwołanie do konkretnego, trwałego artefaktu**, który wyraża decyzję — plik, commit, zadanie w rejestrze, wiadomość z identyfikatorem — nie samo słowne stwierdzenie, że coś zostało ustalone.

Zapis w rodzaju „ustne potwierdzenie na pytanie kontrolne, sesja YYYY-MM-DD", **bez cytatu i bez odwołania do artefaktu, nie spełnia tego minimum** — to jest oświadczenie autora wpisu o przebiegu rozmowy, nieweryfikowalne przez nikogo innego niż on sam.

**Skala siły dowodu (od najsilniejszego do najsłabszego jeszcze dopuszczalnego):**
1. **Pisemny cytat** wypowiedzi właściciela — najsilniejszy: tekst istnieje niezależnie od pamięci agenta i od tego, kto go odczytuje.
2. **Odwołanie do trwałego artefaktu** (plik, zadanie, commit), który realizuje lub wprost wyraża decyzję — silny, choć wymaga interpretacji, że dany artefakt rzeczywiście odpowiada tej decyzji.
3. **Oświadczenie o rozmowie** („ustne potwierdzenie", „pytanie kontrolne", „ustalone na spotkaniu") bez cytatu i bez artefaktu — najsłabszy poziom, jaki w ogóle może zamknąć bramkę. Decyzja oparta wyłącznie na poziomie 3 ma status **słabszy**: zamyka bramkę §5.1 **operacyjnie**, ale zostaje oznaczona jako **dług dowodowy** i **wymaga ponownego potwierdzenia w formie 1 lub 2 przy najbliższej okazji kontaktu z właścicielem** (kolejna sesja, kolejny przegląd tego rejestru) — do tego czasu nie jest cofana, ale nie jest też traktowana jako równoważna dowodowi poziomu 1/2.

**Agent AI nie może sam sobie wystawić dowodu.** Wpis w polu „Źródło potwierdzenia" może powstać wyłącznie **w reakcji na faktyczną wypowiedź właściciela**, z jej przytoczeniem lub jednoznacznym wskazaniem — nigdy jako domysł, parafraza „tak by pewnie powiedział" ani wypełnienie formularza z wyprzedzeniem „na wszelki wypadek", zanim rozmowa się odbyła. Jeśli agent nie dysponuje ani cytatem, ani artefaktem, ani realną rozmową do przytoczenia — decyzja pozostaje `PROPOSED_PENDING_OWNER_CONFIRMATION`, bez wyjątku.

To jest reguła egzekwowalna przy odbiorze, nie zalecenie: kto ocenia gotowość tego dokumentu do zamknięcia bramki, ma obowiązek sprawdzić nie tylko obecność, ale **weryfikowalność** wszystkich czterech pól przy każdej decyzji, zanim uzna §5.1 za zamknięte. Brak pola lub pole niemożliwe do zweryfikowania niezależnie od autora wpisu = bramka otwarta, bez wyjątków — także dla przyszłych decyzji dopisanych do tego rejestru.

## 6. Pytania odłożone do audytu ekran po ekranie

Nie są to pytania teoretyczne. Będą zadawane tylko przy konkretnym ekranie, gdy danych nie da się wyprowadzić z kontraktu:

- która akcja jest naprawdę najczęstsza dla tej roli;
- jakie dane domenowe muszą być widoczne bez otwierania rekordu;
- które uprawnienie biznesowe posiada wskazana rola;
- czy konkretny krok procesu wymaga formalnej akceptacji człowieka;
- czy dana informacja jest poufna wobec klienta lub innego zespołu;
- jaki skutek biznesowy ma nieodwracalna akcja.

Pozostałe kwestie wizualne, interakcyjne, dostępnościowe i techniczne rozstrzyga kanon bez angażowania właściciela produktu.

## Changelog

- **2026-08-02 (panel adwersaryjny, K-41):** §5.2 wzmocnione — samo wypełnienie czterech pól przestało wystarczać do zamknięcia bramki. Dodano: minimum dowodowe (cytat dosłowny LUB odwołanie do trwałego artefaktu, nie samo oświadczenie o rozmowie); trzystopniową skalę siły dowodu (1. pisemny cytat, 2. odwołanie do artefaktu, 3. oświadczenie o rozmowie — najsłabsze dopuszczalne, wymaga ponownego potwierdzenia mocniejszą formą przy najbliższej okazji); jawny zakaz samopotwierdzenia przez agenta AI (wpis dowodowy tylko w reakcji na faktyczną wypowiedź właściciela, z przytoczeniem). Przy O-01/O-02/O-03 dopisano pole „Siła dowodu wg skali §5.2": O-01 = poziom 1, O-02 i O-03 = poziom 3 (oświadczenie o rozmowie, bez cytatu/artefaktu) z jawną adnotacją długu dowodowego. §5.1 rozszerzone o to samo rozróżnienie. **Treść merytoryczna decyzji O-01/O-02/O-03 oraz status bramki §5.1 (zamknięta) nie zostały cofnięte** — zmieniono wyłącznie wymagania dowodowe na przyszłość i uczciwie oznaczono słabszy dowód tam, gdzie faktycznie jest słabszy.
- **2026-08-02 (rewizja dowodowa):** Dodano ślad dowodowy (`Źródło potwierdzenia` / `Data potwierdzenia` / `Forma` / `Potwierdził`) do O-01, O-02, O-03 w §5. Dodano §5.2 „Wymóg śladu dowodowego" — reguła egzekwowalna na przyszłość: decyzja bez kompletu tych pól ma status `PROPOSED_PENDING_OWNER_CONFIRMATION` i nie zamyka bramki. §5.1 rozszerzone o jednoznaczne rozdzielenie „decyzja podjęta" od „decyzja wdrożona" (przykład: O-01 zamknięte, ale `BRAND_EXPORT_CANON.md` §0 dokumentuje pięć niespójnych systemów eksportu, konwergencja VF3-2/3/4 nie ruszyła) oraz o wycofanie etykiety `DOCUMENTATION PASS FOR IMPLEMENTATION`. §1 urealnione: czwarty, niezależny audyt (2026-08-02) cofnął werdykt `PASS FOR IMPLEMENTATION` z trzeciego audytu, zwrócił `FAIL` z siedmioma blokerami P0; status dokumentacji zmieniony na `NEEDS_REMEDIATION`. §2 zweryfikowane wobec `docs/ui-standards/00-foundation/FOUNDATION_TOKEN_CONTRACT.md` (Menu 1/2/3, kontrolki, wiersz tabeli) — wartości zgodne, brak rozjazdu, bez zmian. Treść decyzji O-01/O-02/O-03 oraz §2/§3/§4/§6 pozostały merytorycznie nietknięte.
