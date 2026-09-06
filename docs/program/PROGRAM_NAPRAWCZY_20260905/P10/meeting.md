# Spotkanie (`meeting`)

**Status:** PROPOZYCJA — do słowa właściciela. Moduł `08_MEETINGS` stoi za flagą
`VITE_MODULE_MEETINGS` (DEC-425, właściciel 06.09.2026: „pełnej niewidzialności — bez wyjątku dla
adminów”, `src/utils/meetingsModuleFlag.ts:2-19`), **domyślnie OFF**. Zrzuty wzięte lokalnie z
własnym vite `VITE_MODULE_MEETINGS=true` (dozwolone wyłącznie lokalnie, CLAUDE.md pkt 7) —
`evidence/p10b8/10-meeting-hub.png`, `11-meeting-new-modal.png` (`bledyKonsoli: []` na obu).
**Brak realnego rekordu spotkania w tej organizacji** (0 pozycji, potwierdzone zrzutem) — próba
utworzenia jednego przez formularz `--wpisz` zawiodła (selektor nie trafił pole „Tytuł”; drzewo po
próbie dalej pokazuje 0 spotkań, więc żadnych danych testowych nie zostało). §6 poniżej jest więc
zmierzony z **kodu + komentarza autorskiego w pliku** (bardzo szczegółowy, cytowany niżej), nie z
otwartego rekordu — oznaczone jawnie tam, gdzie to dotyczy.

## §0. Tożsamość

- Nazwa PL: **Spotkanie** — obiekt z agendą, protokołem (notatki AI) i decyzjami/follow-upami.
- Moduł: `08_MEETINGS`. Archetyp: **C — Rekord**, klasa **L**.
- Trasa: `/meetings/:meetingId` + aliasy `/minutes`, `/decisions`, `/notes/:noteId`
  (`routeConfig.ts:140-143`) — **4 trasy = 1 karta**, sekcja wyprowadzana z `location.pathname`
  (§3 inwentarza, `MeetingObjectPage.tsx:602-608`).
- Otwarcie: `/meetings` (lista, `MeetingHub`) → wiersz → karta.
- Komponent: `src/components/Meeting/MeetingObjectPage.tsx:222` (1365 linii).
- Powłoka: **`StandardArtifactShell`** (SPEC-A archetyp C) — od DEC-2026-08-25-52, zastąpiła
  wcześniejszy bespoke tabbed-card layout. Wzorzec 1:1 z `CaseWorkspace/CaseDetailScreen.tsx`
  (jedyne dwa ekrany dziś realnie wołające `<StandardArtifactShell>` — patrz `case.md`, ta sama
  partia).
- Rejestr: `registry.ts` (`KartaNKey`) **nie zna** klucza `meeting` — powłoka dostaje go rzutowany
  (`karta={'meeting' as KartaNKey}`, `:1332-1338`, z jawnym komentarzem autora tłumaczącym, że
  rzutowanie nie wyłącza żadnej bramki obowiązującej ten ekran, bo klucz steruje tylko treścią
  ostrzeżeń dev i regułą dowodową dla kart pisanych przez AI — nie dotyczy tej karty).

## §1. Sekcje (centrum ekranu)

Trzy sekcje przez `StandardSekcjaDef[]` (`:1104-1144`) — **K1 formalnie spełnione**, w
przeciwieństwie do większości kart w tej partii:

| sekcja | po co użytkownikowi | źródło danych → writer | aiContract | S/L |
|---|---|---|---|---|
| Szczegóły (`details`, `:1105-1117`) | uczestnicy, materiały, agenda, lokalizacja | `meeting.*` → `GET /api/meeting/:id` (`server/src/routes/meeting.routes.ts:344`) | `none: true` — „realne dane spotkania, model ich nie pisze” | L |
| Protokół (`minutes`, `:1119-1131`) | notatki spotkania (w tym propozycje AI wygenerowane z listy) | `GET /api/meeting/:id/notes` (`:1041`) | `none: true` — „sekcja czyta stan, generowanie żyje w widoku listy” | L |
| Decyzje i działania (`decisions`, `:1133-1145`) | zapisuje decyzje i follow-upy ręcznie | `GET/POST/PATCH/DELETE /:id/decision-records` (`:658,673,695,722`) i `/:id/follow-up-records` (`:739,754,775,810`) | `none: true` — „realne dane wpisywane ręcznie (D.4/D.5)” | L |

Wszystkie trzy mają jawny `aiContract.none` z uzasadnieniem tekstowym (K3 ✓ — źródło + powód
jawny). Reguła pustki (K4) nie została zmierzona na żywym rekordzie — nie było go w tej organizacji.

## §2. Prawy panel (`ArtifactRightPanel`, `:1289-1329`)

| sekcja | obecna? | treść | uwaga |
|---|---|---|---|
| Akcje | ✓ | Wczytaj ponownie, Wróć do listy, „Edytuj spotkanie — Już wkrótce” (disabled), „Generuj notatki AI — Już wkrótce” (disabled), „Usuń spotkanie — Już wkrótce” (disabled) | trzy z pięciu akcji są jawnie honest-disabled, nie fikcyjne — potwierdzone kodem (`:1246-1279`), i18n obu połówek etykiety zweryfikowane w PL (§5) |
| Właściwości | ✓, **tabela** (`ArtifactPropertiesTable`, `:1296-1300`) | Status, Duration, Decisions, Follow-ups, Location, Organizer | **K7 ✓** — jeden z niewielu przypadków w całym inwentarzu, gdzie tabela jest zrobiona poprawnie od razu |
| Powiązania | pominięta, powód jawny | „Spotkania nie mają dziś mechanizmu powiązań z innymi obiektami” | zgodne z K10 |
| Źródła i założenia | brak wiersza w ogóle (nie ma nawet pominiętej) | — | karta nie ma roli AI (wszystkie sekcje `none:true`), więc K9 nie dotyczy |
| Komentarze | pominięta, powód jawny | „Backend spotkań nie ma wątku komentarzy” | zgodne z K10 |
| Historia | pominięta, powód jawny | „Spotkania nie mają dziś dziennika zdarzeń w API” | **odstępstwo od K10** — Historia jest jedyną z listy K10 opisaną jako zawsze obowiązkowa; tu pominięta, ale z jawnym, zmierzonym powodem (nie milczeniem) |

Kolejność sekcji zgodna z kanonem (Akcje→Właściwości→Powiązania→Komentarze→Historia, Źródła
nieobecne bo nie dotyczy) — **K11 spełnione**, jeden panel.

## §3. Menu 5 i nawigacja

Brak „Sekcje ▾”/„Edycja-Podgląd”/„Pracuj z AI ▾” jako nazwanego paska — `StandardArtifactShell`
renderuje lewą nawigację sekcji przez `NModeLeftNav` (zakładki Szczegóły/Protokół/Decyzje), ale bez
trzeciego elementu (Pracuj z AI), bo żadna sekcja go nie potrzebuje (K12 częściowe: dwa z trzech
elementów obecne w duchu, trzeci brakuje bo niepotrzebny — nie licząc to jako pełne ✓, bo K12
wymaga wszystkich trzech). Nagłówek (`header.title`) jest **`titleReadOnly: true`**, `onSave: () =>
undefined` — edycja tytułu świadomie niedostępna (spójne z Akcjami disabled), więc K14 (przełącznik
znika bez prawa, z powodem) formalnie nie dotyczy — nie ma przełącznika, bo nie ma trybu edycji w
ogóle jeszcze. Brak paska modułu (Menu 2/3) nad kartą — otwarta karta nie zostaje wizualnie w
module (K19 ✗, spójne z tym, co matryca zmierzyła dla `audit-report`/`assessment-report`/
`presentation`/`audit-criterion` w tej samej klasie odstępstwa).

## §4. AI

Zero. Wszystkie trzy sekcje deklarują `aiContract.none: true` z powodem (§1) — nie ma
`<PracujZAI>`, nie ma nawet osobnych przycisków „X z AI” jak w `interview-template`. Jedyna
wzmianka AI to disabled akcja „Generuj notatki AI — Już wkrótce” w panelu Akcje (uczciwie odroczona,
nie fikcyjna) i realne notatki AI generowane z **listy** `MeetingHub` (poza tą kartą — sekcja
Protokół tylko je czyta). `meeting` nie ma wpisu w `cardAnalysisRubric.ts` (K21/K24 ✗ formalnie, ale
uczciwie — karta nie udaje AI, którego nie ma).

## §5. Czytelność

- `grep -c "primary-[0-9]"` = 0 (K17 ✓).
- Fokus: nie próbkowane linia-po-linii, brak dowodu naruszenia.
- i18n: próbka 15 kluczy `meeting.object.*` (Status, Czas trwania, Liczba decyzji, Liczba
  follow-upów, Lokalizacja, Organizator, Wczytaj ponownie, Edytuj spotkanie, Generuj notatki AI,
  Usuń spotkanie, Już wkrótce, Właściwości, Właściwość, Wartość, Dane odczytane z serwera,
  Szczegóły spotkania) — **wszystkie 15 mają polskie tłumaczenie w `translation.json`**, mimo że
  kod używa angielskich stringów jako *domyślnej wartości* `t()` (np. `t('meeting.object.
  propStatus', 'Status')`) — to nie jest naruszenie K25, bo domyślna wartość nigdy nie renderuje
  się dla klucza, który istnieje w PL. K25 ✓ na tej próbce.
- K19 pigułka modułu: ✗ (§3), niepotwierdzone realnym rekordem, ale zgodne z komentarzem autora
  („Menu 1 = powrót · tytuł · pigułka statusu... wszystko z NModeHeader” — nie wspomina paska
  modułu).
- K20: zrzuty hub/modal (1440) bez poziomego przewijania.

## §6. Stan zastany vs kontrakt (K1–K30)

| K | wynik | dowód |
|---|---|---|
| K1 kontrakt sekcji | ✓ | `StandardSekcjaDef[]`, `:1104-1144` |
| K2 kontrakt steruje renderem | ✓ (brak flagi) | sekcje renderowane wprost z tablicy, żadna flaga `VITE_VF1_*` nie dotyczy tej karty |
| K3 sekcja→writer/powód | ✓ | wszystkie 3 mają `aiContract` z powodem i realny writer (§1) |
| K6 Akcje | ✓ | `:1226-1281`, 3/5 honest-disabled |
| K7 Właściwości tabela | **✓** | `ArtifactPropertiesTable`, nie akapit — rzadki przypadek poprawny od razu |
| K8 Powiązania | pominięta z powodem | ✓ zgodnie z K10 |
| K9 Źródła i założenia | n/d | karta bez roli AI |
| K10 Komentarze/Historia | Komentarze ✓ pominięta z powodem; **Historia pominięta z powodem** (odstępstwo formalne, ale jawne) | §2 |
| K11 jeden panel | ✓ | kolejność zgodna z kanonem |
| K12 Menu 5 (3 elementy) | ✗ (częściowe: 2/3 w duchu) | brak „Pracuj z AI”, bo niepotrzebne; brak nazwanego paska Sekcje/Edycja-Podgląd |
| K14 Edycja/Podgląd z powodem | n/d | brak trybu edycji w ogóle (świadomie, `titleReadOnly`) |
| K17 zero primary | ✓ | 0 trafień |
| K19 pigułka modułu | ✗ | brak paska modułu nad kartą (kod), niepotwierdzone zrzutem realnego rekordu |
| K21 Pracuj z AI | ✗ (uczciwie, nie fikcyjnie) | zero AI, jedna disabled akcja |
| K25 i18n | ✓ (próbka 15/15) | §5 |
| K27 Teresa tylko Menu 1 | ✓ | zero wzmianek „Teresa” w pliku |
| K29 zero błędów konsoli | ✓ | `bledyKonsoli: []`, oba zrzuty |
| K30 zrzut 1440 z realnym rekordem | **✗ — brak rekordu** | 0 spotkań w organizacji; zmierzone tylko hub (pusty) i modal tworzenia |

## §7. Luki → naprawa

1. **Domknąć trzy akcje „Już wkrótce” (Edytuj/Generuj notatki AI/Usuń).** To jest zakres
   produktowy (Fala 2 wg DEC-425), nie błąd kodu — świadomie odroczone i uczciwie oznaczone.
   Rozmiar: L (poza tą partią, wymaga decyzji właściciela o priorytecie Fali 2).
2. **Dopisać `meeting` do `registry.ts`** zamiast rzutowania `as KartaNKey` — usunie potrzebę
   komentarza-uzasadnienia w kodzie i odblokuje przyszłe podpięcie AI/Menu 5. Rozmiar: S.
3. **Pasek modułu z pigułką (K19).** Ten sam wzorzec braku co `audit-report`/`assessment-report`/
   `presentation`/`audit-criterion` (`KARTA_N_KONTRAKT.md` §7) — jedna naprawa współdzielona.
   Rozmiar: M (razem z tamtymi, nie osobno dla `meeting`).
4. **Zmierzyć na żywym rekordzie po odmrożeniu modułu.** Prawdziwy test §1/§4 (reguła pustki, realne
   notatki AI, decyzje/follow-upy) wymaga chociaż jednego spotkania — dziś niemożliwe bez ręcznego
   utworzenia rekordu przez UI (próba w tej sesji zawiodła na poziomie selektora formularza, nie
   backendu — `POST /:id` istnieje i działa, patrz `meeting.routes.ts:356`).

**Pytanie do właściciela (max 1):** moduł jest za flagą do Fali 2 (DEC-425) — czy ma sens dociągać
kanon (Menu 5, pigułka modułu, rejestr) TERAZ, skoro klient go nie widzi, czy odłożyć całość razem
z odmrożeniem? Rekomendacja: dopisać do `registry.ts` teraz (koszt S, zero ryzyka wizualnego za
flagą OFF), resztę odłożyć do odmrożenia — bo #2 jest tanie i odblokowuje przyszłą pracę bez
dotykania niczego widocznego.

**STOP:** brak żywego rekordu do zmierzenia K4/reguły pustki i realnego renderu Protokołu/Decyzji —
opisany wyżej jako luka #4, nie zgadywane. Przepis: włączyć moduł (`VITE_MODULE_MEETINGS=true`),
`/meetings` → „Nowe spotkanie” → wypełnić pole „Tytuł” (selektor: pierwszy `<input>` w gridzie
formularza, `MeetingHub.tsx:1139`, prawdopodobnie potrzebuje selektora precyzyjniejszego niż
`input >> nth=0`, bo w tej próbie trafił w element poza modalem) → „Utwórz spotkanie” → otworzy się
karta pod `/meetings/:meetingId` → zrzut z rozwiniętym „Pracuj z AI” (którego nie ma — więc zrzut z
otwartymi wszystkimi trzema sekcjami zamiast tego, K30 wymaga adaptacji dla kart bez AI).
