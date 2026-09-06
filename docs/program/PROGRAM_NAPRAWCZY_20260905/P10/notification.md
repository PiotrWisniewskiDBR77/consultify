# Powiadomienie (notification) — kontrakt karty N, AUDYT ZGODNOŚCI (P10-B0, DEC-429)

> B0 = audyt, nie budowa od zera. Tabela rundy 1 Codexa zachowana w §6a. Ten plik ją
> uzupełnia do formatu §0–§7 i dokłada pomiar NA ŻYWO flagi kontraktu (§6b), który
> **koryguje** zlecenie: flaga NIE jest twardym `return false` — patrz §6b. Dla Powiadomienia
> ten pomiar jest WAŻNIEJSZY niż dla pozostałych 5 kart: tu flaga faktycznie WŁĄCZA brakujący
> element Menu 5 (K12), nie tylko zmienia nazwy w managerze.

## §0. Tożsamość

- **Nazwa PL:** Powiadomienie · **moduł:** 07_MY_WORK_AGENT (Moja Praca) · **archetyp:** C (Rekord)
- **Trasa:** `/my-work` (Skrzynka), bez id w URL
- **Jak otworzyć z listy:** Moja Praca → Skrzynka → wiersz → „Otwórz”
- **Komponent:** `src/components/MyWork/NotificationDetailView.tsx:300` (4059 linii)
- **Powłoka dziś:** `NModeShell` (surowy, nie `StandardArtifactShell`); kontrakt:
  `notificationCardContract.ts` (import `:101`), 4 karty `KanonicznaKarta`, wszystkie klasy **S**
- **Rejestr:** `registry.ts` → `notification`, `statusMigracji: 'przed'`

## §1. Sekcje (katalog kanoniczny, 4 karty, wszystkie klasa S)

| sekcja | po co użytkownikowi | źródło danych (API pole → writer) | reguła pustki | kolejność |
|---|---|---|---|---|
| Co się dzieje (`executive-summary`) | streszczenie zdarzenia | `data.description/whyImportant/blocked` → `notificationService.ts:700-768`, prompt `notification.whats-happening` (asystuje) | brak reguły w kontrakcie, ALE **jest data-driven w kodzie** — patrz §6b | 0 |
| Analiza AI (`ai-analysis`) | dlaczego AI tak sądzi | `data.aiAnalysis` → `notificationService.ts:700-768`, prompt `notification.ai-analysis` (pisze) | **renderuje się TYLKO gdy `hasAIContext`** (`NotificationDetailView.tsx:1400-1408`: typ zawiera „AI” lub ma pola `aiGenerated/riskLevel/recommendation/impact/confidence/savings_annual`) — to jest REALNA reguła pustki, ale zaszyta w komponencie, nie w kontrakcie | 1 |
| Oczekiwana akcja (`artifact-actions`) | co mam zrobić | `data.expectedAction` → `notifications.routes.ts:817-842`, prompt `notification.expected-action` (asystuje) | brak | 2 |
| Historia aktywności (`activity-log`, prawy panel) | log zdarzeń | writer zdarzeń `notificationService.ts` | brak (rolaAI systemowa) | 0 (prawy panel) |

**Uwaga o zakresie:** wiersze „Właściwości / Powiązania / Źródła i założenia / Rezultaty / Komentarze”
z tabeli rundy 1 (§6a) NIE są sekcjami lewej nawigacji objętymi katalogiem `KanonicznaKarta` — to
elementy PRAWEGO PANELU (§2), rządzone innymi regułami (K6–K11), nie K1/K5. Oznaczenie ich w rundzie 1
jako „sekcja poza kontraktem” miesza dwa różne poziomy kontraktu; w tym pliku rozdzielam je w §1/§2.

## §2. Prawy panel

| sekcja | obowiązkowość | stan na zrzucie (`03-notification.png`, `notification2-{bez,z}.png`) |
|---|---|---|
| Akcje | obowiązkowa (K6) | ✓ „Oznacz przeczytane / Odłóż” |
| Właściwości (tabela) | obowiązkowa (K7) | ✓ Status→Priorytet→Źródło→Typ powiadomienia→Kategoria→Data |
| Powiązania | obowiązkowa (K8) | ✓ obecna |
| Źródła i założenia | obowiązkowa dla AI (K9) | ✓ obecna, **pusta** na obu zmierzonych rekordach (K4 „pusta na wyrost” — potwierdzone żywo, nie tylko z rundy 1) |
| Rezultaty | brak w kontrakcie ani w SPEC-N standardzie | ✓ widoczna na rekordzie „AI: Sugestia priorytetu”, pusta — do wyjaśnienia, czy to celowy element czy dług |
| Komentarze | **usunięta świadomie** (`NotificationDetailView.tsx:1434-1443`: „powiadomienie to wiadomość systemowa, nie artefakt współpracy — sekcja Komentarzy znika CAŁKOWICIE”) | zgodne z K10 (pominięcie z jawnym powodem w kodzie) |
| Historia | obowiązkowa (K10) | ✓ „HISTORIA — 2” |

## §3. Menu 5 i nawigacja

**To jest kluczowa różnica wobec Task/Decision/Initiative.** Baseline (flaga OFF) ma TYLKO
„Edycja/Podgląd” + „Pracuj z AI ▾” — **brak „Sekcje ▾”** (K12 częściowo niespełnione, potwierdzone
żywo: `notification2-bez.png` nie zawiera słowa „Sekcje”). Z flagą ON, „Sekcje ▾” **pojawia się**
(`notification2-z.png`) — patrz §6b dla mechanizmu. Klasa S (szuflada) — zgodna z K16 (≤4 sekcje).

## §4. AI — „Pracuj z AI ▾”

Obecny w obu wariantach (nie zależy od flagi kontraktu sekcji — to osobny mechanizm).

| sekcja | rubryka (`cardAnalysisRubric.ts:548`) | AI może uzupełnić | tylko do odczytu |
|---|---|---|---|
| notification (cały typ) | `NOTIFICATION_CARDS` | co się dzieje, dlaczego to ważne, co jest blokowane | typ, źródło, kategoria, data |

Teresa: brak wzmianek na obu zmierzonych zrzutach w tej rundzie (K27; matryca `MATRYCA_21_KART.md`
notuje wyciek `TeresaMark` w `:1696,:3453` na INNYM rekordzie/stanie — nie potwierdzone ponownie tu,
zostaje jako rozbieżność do wyjaśnienia, nie odrzucam ustalenia matrycy).

## §5. Czytelność graficzna

Zrzut 1440 jasny (`notification2-bez.png`) czysty, 0 błędów konsoli. Literał „Typ powiadomienia:
Escalation” (matryca `03-notification.png`) **nie zmierzony ponownie** na rekordzie
„Zadanie zbliża się do terminu” (ten rekord ma inny typ) — pozostaje jako otwarte ustalenie z matrycy,
nie odrzucam go, nie potwierdzam go powtórnie w tej rundzie.

## §6a. Stan zastany vs kontrakt — tabela Codexa (runda 1, zachowana bez zmian)

| sekcja | kontrakt mówi (plik:linia) | ekran pokazuje (plik:linia + zrzut) | źródło danych | rozjazd | waga |
|---|---|---|---|---|---|
| Co się dzieje | `notificationCardContract.ts:71-107` | `NotificationDetailView.tsx:1672`; zrzut | `data.description/whyImportant/blocked` → `notificationService.ts:700-768` | brak | kosmetyka |
| Analiza AI | `notificationCardContract.ts:108-137` | brak w nawigacji zrzutu | `data.aiAnalysis` → `notificationService.ts:700-768` | sekcja z kontraktu nieobecna | ⚠ **DOPRECYZOWANE §1** — nieobecność jest DATA-DRIVEN (`hasAIContext`), nie efekt flagi; na rekordzie z kontekstem AI sekcja SIĘ POJAWIA (zmierzone żywo, `notification-z.png`) |
| Oczekiwana akcja | `notificationCardContract.ts:138-170` | `NotificationDetailView.tsx:1672`; zrzut | `data.expectedAction` → `notifications.routes.ts:817-842` | brak | kosmetyka |
| Historia aktywności | `notificationCardContract.ts:171-198` | po Fazie B: „HISTORIA AKTYWNOŚCI”; `po/notification-open.png` | dziennik aktywności → writer zdarzeń `notificationService.ts` | brak | kosmetyka |
| Właściwości | brak kontraktu | widoczna; zrzut | pola rekordu → `notificationService.ts:482-491` | ⚠ **DOPRECYZOWANE §2** — to prawy panel (K7), nie sekcja katalogu; „brak kontraktu” mylące | kosmetyka (nie MVP-blocker — panel ma tabelę) |
| Powiązania | brak kontraktu | widoczna; zrzut | API relacji; writer nieustalony | jw. — prawy panel K8 | kosmetyka |
| Źródła i założenia | brak kontraktu | widoczna; zrzut | MARTWE: brak writera wskazanego przez komponent | prawy panel K9, **pusta na wyrost potwierdzone żywo** | blokuje MVP (potwierdzone) |
| Rezultaty | brak kontraktu | widoczna; zrzut | MARTWE: brak writera wskazanego przez komponent | prawy panel, poza SPEC-N | do wyjaśnienia |
| Komentarze | brak kontraktu | widoczna; zrzut | komentarze API → writer w trasach powiadomień | ⚠ **NIEAKTUALNE** — kod (`:1434-1443`) mówi wprost, że Komentarze zostały USUNIĘTE Z LEWEJ NAWIGACJI CAŁKOWICIE (decyzja świadoma SPEC-N §2.6); nie zmierzyłem obecności/braku w prawym panelu na żywo w tej rundzie — do weryfikacji | — |
| Typ karty „Powiadomienie” | kontrakt/rejestr: polska nazwa „Powiadomienie” | po Fazie B: `MyWorkHub.tsx:2019`; `po/notification-open.png` | i18n `myWork.notificationDetail.notification` | brak | kosmetyka |

## §6b. POMIAR NA ŻYWO flagi `VITE_VF1_NOTIFICATION_CARD_CONTRACT` (P10-B0, 06.09.2026)

**Zlecenie nie wymieniało notification wprost jako „return false”, ale ten sam wzorzec obowiązuje.**
Kod (`NotificationDetailView.tsx:250-289`) czyta URL `?cardContract=1` → localStorage
`ff.cardContract` → env → `false`. **Da się włączyć jednym linkiem.**

**Metoda:** vite port 3111, sesja `stanowisko-noc/auth.json`, rekord „Zadanie zbliża się do terminu ·
System · DBR77” (WYBRANY CELOWO zamiast rekordu z rundy K1 „AI: Sugestia priorytetu”, bo ten drugi
zmienia tytuł/źródło między odświeżeniami strony — prawdopodobnie asynchroniczne wzbogacanie AI —
i psuje selektor tekstowy; STOP, nie badałem przyczyny tej zmiany, poza zakresem B0).
Dowody: `evidence/p10b0-kontrakty/notification2-{bez,z}.png(.json)`.

**Co się zmienia (jedyna z 6 kart, gdzie flaga zmienia STRUKTURĘ Menu 5, nie tylko nazwy w pickerze):**
kod (`:2192-2249`) pokazuje, że `spec: NOTIFICATION_CARD_SPEC` jest przekazywany DO `useCardLayout`
ZAWSZE (bezwarunkowo), ale filtr/reorder `applyToSections(...)` uruchamia się TYLKO gdy
`notificationCardContractEnabled` — inaczej sekcje idą surowe (`nModeSectionsWithContent`) BEZ
managera. To wyjaśnia, czemu „Sekcje ▾” w Menu 5 jest CAŁKOWICIE NIEOBECNE przy fladze OFF (potwierdza
matrycę `~ brak „Sekcje ▾” (2 sekcje)`) i POJAWIA SIĘ przy fladze ON (potwierdzone zrzutem). To
JEDYNA z 6 kart w tej rundzie, gdzie włączenie flagi naprawia realny brak z K12, a nie tylko kosmetykę
nazw w managerze.

**Co się NIE zmienia:** sam zestaw i etykiety sekcji lewej nawigacji nadal pochodzą z `nModeSections`
(`:1399`, hardcode + `hasAIContext`), nie z `NOTIFICATION_CARD_SPEC.catalog` — K2 („kontrakt steruje
renderem treści”) nadal niespełnione, tylko K12 (obecność managera) się poprawia.

## §7. Luki → naprawa

| # | luka | rozmiar | decyzja właściciela? | rekomendacja |
|---|---|---|---|---|
| 7.1 | „Sekcje ▾” w Menu 5 nieobecne przy fladze OFF — jedyny z 6 audytowanych typów bez K12 domyślnie | S | nie | włączyć `applyToSections` bezwarunkowo (jak w innych 5 kartach) — to najtańsza z 6 napraw, bo `spec` już jest podpięty na stałe |
| 7.2 | „Źródła i założenia” puste na obu zmierzonych rekordach — MARTWE wg komponentu | M | tak — czy ta sekcja ma dostać writer, czy zniknąć wg K4 gdy AI nic nie wygenerowało | ukryć wg K4 do czasu writer'a, zamiast pokazywać pustą ramkę |
| 7.3 | „Rezultaty” w prawym panelu poza SPEC-N i poza kontraktem — cel sekcji niejasny | S | tak — 1 pytanie: czy to ma zostać (i dostać kontrakt) czy to relikt do usunięcia | do decyzji, bez rekomendacji technicznej — brak wystarczających danych w tej rundzie |
| 7.4 | K2 nadal niespełnione — treść sekcji z `nModeSections` (hardcode), nie z katalogu | L | tak — jak w Task 7.1, wspólna decyzja dla wszystkich kart z tym wzorcem | ujednolicić z pozostałymi 5 kartami w jednym kroku programowym |

**STOP:** nie potwierdziłem ponownie literału „Escalation” ani wycieku `TeresaMark` z matrycy — inny
rekord w tej rundzie. Nie badałem, czemu tytuł notyfikacji „AI: Sugestia priorytetu” zmienia się między
odświeżeniami (· System · → · AI ·) — poza zakresem B0, zgłaszam jako obserwację do osobnego zgłoszenia.
