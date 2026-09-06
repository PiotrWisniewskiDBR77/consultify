---
doc_id: karta-n-kontrakt
status: PROPOZYCJA DO AKCEPTU WŁAŚCICIELA (DEC-429, słowa właściciela 06.09.2026 19:2x)
truth_type: ui-standard (kontrakt wiążący dla KAŻDEJ karty N w KAŻDYM narzędziu)
zastepuje: nic — uzupełnia `docs/ssot/STEROWANIE_KART_N_I_AI.md` (3 zasady) o pełny kontrakt K1…K24
zrodla: SPEC-A `Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md` §10.2/§11.2/§13/§18.1 · SPEC-N
  `Harvard/wdrozenie-100/_SPEC_N_KARTY_2026-07-21.md` · `docs/ui-standards/TRIADA_KANON.md` ·
  rejestr `src/components/standard/registry.ts` · rubryka `src/services/cardAnalysis/cardAnalysisRubric.ts`
pomiar: 22 karty na żywo, stanowisko lokalne 4100 / vite 3102, 06.09.2026 19:3x–20:1x,
  dowody `evidence/p10-matryca/`, matryca `docs/program/PROGRAM_NAPRAWCZY_20260905/P10/MATRYCA_21_KART.md`
---

# KARTA N — KONTRAKT (K1…K24)

> Słowa właściciela (06.09.2026, DEC-429): „Każda karta musi mieć określony kontrakt na zawartość,
> musi mieć określoną tę tabelę z prawej strony, musi mieć karty [sekcje], musi być czytelna
> graficznie, i co najważniejsze: przyciski AI do automatyzacji wypełniania muszą być opisane we
> wszystkich typach kart N, nie tylko w inicjatywach."

**Karta N** = ekran-obiekt otwierany z listy (nie lista, nie podgląd boczny): zadanie, decyzja,
powiadomienie, wniosek, inicjatywa, sesja wywiadu, narzędzie, dokument narzędzia, notatka, pomysł,
miernik, cel OKR, analiza ROI, plan, analiza obciążenia, kryterium audytu, raport audytu, raport
oceny, prezentacja, spotkanie, dokument sejfu, karta działania. **Inwentarz = 22 karty**
(13 w `REJESTR_KART_N`, 9 jawnych wyjątków w `registry.kompletnosc.test.ts`).

**Wzorce zaakceptowane przez właściciela** (mierzalny punkt odniesienia, nie opinia):
`InitiativeDocumentView` (inicjatywa — „dokładnie taki jak kocham", `evidence/p10-matryca/07-initiative.png`)
oraz trzy karty Wyników R4 (`kartaWynikow.tsx` → KPI/OKR/ROI, `12-metric.png`, `13-objective.png`, `14-roi.png`).
Każde K niżej ma **jedno zdanie kryterium sprawdzalnego** — sprawdza je osoba trzecia na jednym
zrzucie 1440 jasnym, bez pytania autora.

---

## §1. KONTRAKT TREŚCI — co karta pokazuje (K1–K5)

**K1 — Karta ma spisany kontrakt sekcji.** Dla typu karty istnieje katalog `KanonicznaKarta`
(`src/components/standard/cardContract.types.ts`) albo tablica `StandardSekcjaDef`
(`StandardArtifactShell.types.ts`), wyliczający: id sekcji, etykietę pl+en, kolejność, kolumnę,
rolę AI i prompt (albo jawny brak z powodem).
*Kryterium:* w kodzie istnieje plik/tablica, w której da się policzyć sekcje tej karty; „ekran ma
sekcje" nie jest kontraktem.

**K2 — Kontrakt steruje renderem, nie leży obok.** Sekcje widoczne na ekranie pochodzą z kontraktu;
ekran nie może renderować sekcji spoza kontraktu ani pomijać sekcji kontraktu.
*Kryterium:* wyłączenie sekcji w kontrakcie znika z ekranu bez zmiany komponentu (dziś 7/7 katalogów
`KanonicznaKarta` siedzi za flagą `VITE_VF1_*_CARD_CONTRACT` z twardym `return false` — pomiar §7).

**K3 — Każda sekcja ma źródło danych.** Sekcja deklaruje pole API i writer w `server/src`
(plik:linia) albo jest jawnie oznaczona jako treść statyczna/wyliczana z powodem.
*Kryterium:* dla każdej sekcji da się wskazać writera albo jawny powód jego braku.

**K4 — Reguła pustki: bez danych sekcja się nie renderuje.** Sekcja bez treści znika (nie pokazuje
„—", nie pokazuje pustej ramki „na wyrost"); w spisie sekcji jest wyszarzona z etykietą „brak danych".
*Kryterium:* rekord bez danej sekcji nie pokazuje jej nagłówka.

**K5 — Etykiety i kolejność wg kontraktu.** Nazwa sekcji na ekranie = `label.pl` z kontraktu;
kolejność = `kolejnosc`. Zmiana nazwy/kolejności = zmiana kontraktu, nie refaktor.
*Kryterium:* każda etykieta na zrzucie ma dokładne dopasowanie w katalogu.

---

## §2. PRAWY PANEL — tabela właściwości i reszta (K6–K11)

Jeden komponent: `src/components/standard/ArtifactRightPanel.tsx` (akordeon, sekcje w stałej kolejności).

**K6 — AKCJE (obowiązkowa).** Pierwsza sekcja panelu; wyłącznie akcje tego obiektu; primary CTA
mieszka w Menu 4 (nagłówku), nie tutaj.
*Kryterium:* panel otwiera się sekcją „Akcje" albo deklaruje `pominieta` z powodem.

**K7 — WŁAŚCIWOŚCI = TABELA (obowiązkowa, dwie kolumny „Właściwość | Wartość").**
Renderuje ją `ArtifactPropertiesTable`; wiersze w kolejności: **Status → Właściciel → Priorytet/Waga →
Termin/Okres → Źródło/Kontekst → Utworzono → Zaktualizowano**, każdy z wartością albo „—".
*Kryterium:* na zrzucie widać nagłówek „Właściwość | Wartość"; luźny akapit tekstu NIE jest tabelą
(dziś tak robią `plan` i `capacity_analysis` — `08-plan.png`, `09-capacity.png`).

**K8 — POWIĄZANIA (obowiązkowa).** Lista obiektów powiązanych z licznikiem; puste = „Brak powiązań".

**K9 — ŹRÓDŁA I ZAŁOŻENIA (obowiązkowa dla kart, których treść pisze AI).** Skąd wzięła się treść:
sesje, dokumenty, założenia liczbowe; dla kart `rolaAI: 'pisze'|'asystuje'` nie wolno jej pominąć.
*Kryterium:* karta z AI ma tę sekcję; karta bez AI może ją pominąć z powodem.

**K10 — KOMENTARZE (warunkowa) i HISTORIA (obowiązkowa).** Komentarze wolno pominąć z jawnym
powodem (np. powiadomienie); Historia (dziennik zmian) jest obowiązkowa zawsze.
*Kryterium:* sekcja jest albo ma `pominieta: {reason}` — milczenie jest błędem.

**K11 — Jeden panel, po prawej, przewijany niezależnie.** Dokładnie jeden prawy panel na ekranie;
szerokość stała; przewija się niezależnie od treści.
*Kryterium:* `--dom` liczy 1 element panelu; treść przewinięta w dół nie przewija panelu.

---

## §3. SEKCJE I NAWIGACJA — Menu 5, sticky, drabina S/L (K12–K16)

**K12 — Menu 5 istnieje i ma trzy elementy w stałych miejscach:** po lewej „Sekcje ▾”
(wybór widocznych sekcji), po środku „Edycja / Podgląd”, po prawej „Pracuj z AI ▾”.
*Kryterium:* pasek jest pod Menu 4 i zawiera te trzy elementy (albo Edycję ukrytą wg K14).

**K13 — Lewy spis sekcji z grupami.** Sekcje w lewej kolumnie, pogrupowane, z ikoną i licznikiem;
klik przewija do sekcji i podświetla ją; etykiety nie są ucinane w połowie słowa.
*Kryterium:* żadna pozycja spisu nie kończy się „…" na zrzucie 1440 (dziś łamie to `audit-report`).

**K14 — „Edycja / Podgląd" tylko z uprawnieniem (Zasada 2b).** Bez prawa edycji przełącznik NIE
renderuje się, a powód widać w karcie/panelu („Tylko do odczytu: …").
*Kryterium:* karta zatwierdzona/cudza nie pokazuje przełącznika i podaje powód
(wzorzec działa: `12-metric.png`, `14-roi.png`).

**K15 — Nagłówki przyklejone (Zasada 2).** Menu 4 (tytuł, wstecz, status, kebab) i Menu 5 zostają
u góry przy przewijaniu treści.
*Kryterium:* po przewinięciu treści o 2 ekrany tytuł i „Pracuj z AI" nadal są widoczne.

**K16 — Drabina otwierania S/L (SPEC-A §12.2).** Klik z listy = podgląd boczny; „Otwórz" = karta;
klasa S = szuflada (≤4 sekcje lewej kolumny), klasa L = pełna strona. Klasa w `REJESTR_KART_N` musi
zgadzać się z liczbą sekcji na ekranie.
*Kryterium:* karta klasy S nie pokazuje 5. sekcji; karta klasy L nie otwiera się w szufladzie.

---

## §4. CZYTELNOŚĆ GRAFICZNA (K17–K20)

**K17 — Wyłącznie tokeny `c-*`; ZERO `primary-*`.** `primary-<n>` w Tailwindzie = crimson #85182F
i czerwień jest zarezerwowana dla semantyki krytycznej (błąd, odrzucenie, przekroczony termin).
*Kryterium:* `grep -c "primary-[0-9]" <plik karty>` = 0 (dziś łamie to `ToolDocumentView.tsx`, 2 trafienia).

**K18 — Fokus wyłącznie `c-focus`, akcent AI wyłącznie `c-ai`.**
*Kryterium:* każdy `focus-visible:ring-*` w karcie to `ring-c-focus`.

**K19 — Pasek modułu (Menu 2/3) z pigułką otwartej karty.** Otwarta karta zostaje w module: Menu 2
widoczne, obok „Lista" pigułka `typ · nazwa rekordu` z kropką stanu i „×".
*Kryterium:* na zrzucie karty widać zakładki modułu i pigułkę z nazwą TEGO rekordu
(wzorzec: `01-task.png`, `07-initiative.png`; łamią: `19-audit-report.png`, `20-assessment-report.png`,
`21-presentation.png`, `18-audit-criterion.png`).

**K20 — 1440 i 1280 bez poziomego przewijania i bez ucięć.** Tabela właściwości, spis sekcji i treść
mieszczą się na 1280; szerokie tabele przewijają się we własnym kontenerze.
*Kryterium:* zrzut 1280 nie ma poziomego paska przewijania strony.

---

## §5. AI WE WSZYSTKICH TYPACH KART — nie tylko w inicjatywach (K21–K24)

To jest punkt, o który właściciel prosi wprost. Jeden komponent:
`src/components/standard/PracujZAI.tsx` (+ most `pracujZAIzKartAnalizy.ts`).

**K21 — Każda karta N ma w Menu 5 przycisk „Pracuj z AI ▾" z DOKŁADNIE trzema pozycjami:**
`Analizuj` · `Uzupełnij tę sekcję` · `Uzupełnij cały dokument`. Nazwy mieszkają w komponencie, nie
w karcie — 22 karty nie mogą nazwać ich 22 razy. Zakaz osobnych, inaczej nazwanych przycisków AI per
narzędzie („Analizuj z AI", „Wyostrz z AI", „Szkicuj z AI", „Copilot").
*Kryterium:* klik w przycisk otwiera listę z tymi trzema pozycjami (dziś: 9/22 kart).

**K22 — Zawsze propozycja → „Zatwierdź". Nigdy auto-zapis.** Komponent nie zna setterów karty;
jedyna droga zapisu to `zastosuj()` wołane z przycisku „Zatwierdź". Pola wypełnione przez człowieka
są pomijane i widać to jako wiersz „pominięto — wypełnione przez człowieka".
*Kryterium:* mutacja usuwająca warunek „Zatwierdź" wywala test w `standard/__tests__`.

**K23 — Po polsku i wg uprawnień.** Etykiety i treść generowana idą językiem UI (`jezykAIzUI`);
bez prawa edycji zostaje sama pozycja „Analizuj", a powód jest wypisany pod listą
(wzorzec działa: `12-metric.png` — „Tylko do odczytu: wersja definicji nie jest szkicem").
*Kryterium:* w polskim UI żadna pozycja menu ani żaden komunikat AI nie jest po angielsku.

**K24 — Deklaracja per typ karty: co AI wolno uzupełnić, z czego i co jest tylko do odczytu.**
Karta deklaruje pola (`CardAnalysisField` z `writable`), a rubryka
`src/services/cardAnalysis/cardAnalysisRubric.ts` podaje kryteria oceny i katalog kart tego typu.
Pola `writable: false` (dowody, zależności, wyliczenia, statusy) są odfiltrowane — AI ich nie dotyka.
*Kryterium:* dla każdego typu karty poniższa tabela ma wypełnione wszystkie trzy kolumny.

### Tabela K24 — AI per typ karty (stan zmierzony 06.09; puste = do uzupełnienia w P10 r2)

| karta | kryteria oceny w rubryce | katalog kart (źródło standardu) | co AI może uzupełnić | tylko do odczytu |
|---|---|---|---|---|
| task | `cardAnalysisRubric.ts:96` | `TASK_CARDS` | opis, pomysły realizacji, ryzyko i alternatywy, lista kontrolna | zależności, dowody, RACI, status |
| decision | `:190` | `DECISION_CARDS` | zakres, opcje i trade-offy, ryzyko i wpływ, konsekwencje | dowody, decydent, status, RACI |
| insight | `:245` | `INSIGHT_CARDS` (30 kart) | podsumowanie, odczyt konsultingowy, kluczowe wnioski, rekomendacje | źródła, cytaty, momenty, próbka materiału |
| initiative | `:339` | `INITIATIVE_CANONICAL_CARDS` (35 kart) | zakres, opis problemu/rozwiązania, koszt bezczynności, kryteria sukcesu | RAID, bramki, finanse, dziennik zmian |
| tool | `:459` | `TOOL_CARDS` (4 karty) | — (treść referencyjna, statyczna) | cel, proces, rezultat, przykład |
| notification | `:548` | `NOTIFICATION_CARDS` | co się dzieje, dlaczego to ważne, co jest blokowane | typ, źródło, kategoria, data |
| metric | `:635` | brak katalogu (`[]`) | kontrakt miernika: definicja, proces, polityka odpowiedzi | pomiary, odchylenia, wyniki |
| objective | `:690` | brak katalogu (`[]`) | opis celu, uzasadnienie („dlaczego teraz"), refleksja | kluczowe rezultaty, check-iny, postęp |
| roi_case | `:745` | brak katalogu (`[]`) | założenia opisowe, problem biznesowy, wariant bazowy | wyliczenia, przepływy, realizacja (PIR) |
| interview | **`:627` = `[]` — BRAK kryteriów** | brak katalogu | do decyzji: notatka konsultanta, podsumowanie sesji | odpowiedzi respondenta, materiał |
| action | **`:93` = `[]` — BRAK kryteriów** | brak katalogu | do decyzji: opis działania, kryterium zamknięcia | źródło (odchylenie), właściciel, termin |
| plan | **`:94` = `[]` — BRAK kryteriów** | brak katalogu | nic (treść z solvera) — trzy pozycje mają wołać generator planu | horyzont, okna, konflikty, obciążenie |
| capacity_analysis | **`:95` = `[]` — BRAK kryteriów** | brak katalogu | nic (treść z `capacityOptionsAdvisor`) | arkusz, luki, decyzje |
| note · idea · audit-criterion · audit-report · assessment-report · tool-document · presentation · meeting · vault-document | **poza `CardAnalysisArtifactType` — silnik ich nie zna** | brak | **do rozstrzygnięcia: wejście do rejestru albo jawny wyjątek** | — |

---

## §6. POZOSTAŁE WYMOGI KANONU (K25–K30 — numeracja ciągła kontraktu)

**K25 — i18n pl+en, zero angielskiego w polskim UI.** Każdy literał przez `t()` z kluczem w
`public/locales/{pl,en}/translation.json`; wartość polska nie może być angielskim słowem
(kształt „klucz istnieje ≠ przetłumaczony"). Dziś łamie to m.in. „Typ powiadomienia: **Escalation**"
(`03-notification.png`), „**WEEK** · Europe/Warsaw" (`08-plan.png`), „Macierz **traceability**"
(`19-audit-report.png`).
*Kryterium:* stop-lista EN na tekście zrzutu daje 0 trafień.

**K26 — Podgląd na klik z listy, karta przez „Otwórz".** Pojedynczy klik w wiersz otwiera podgląd
boczny; przycisk „Otwórz" (nazwany rzeczownikowo: „Otwórz KPI", „Otwórz raport") otwiera kartę.
*Kryterium:* z listy da się dojść do karty dwoma kliknięciami, bez znajomości adresu.

**K27 — Teresa WYŁĄCZNIE w Menu 1 (DEC-404/419).** W karcie nie ma drugiego czatu: żadnej zakładki
„Teresa" w prawym panelu, żadnego przycisku „Teresa"/„Zapytaj Teresę" w karcie.
*Kryterium:* zrzut karty nie zawiera słowa „Teresa" poza dokiem Menu 1
(dziś łamią: `idea`, `audit-criterion`, `presentation`, `tool-document`, `notification`).

**K28 — Brak identyfikatorów technicznych w widocznym DOM.** Użytkownik nie widzi UUID, `seed_*`,
`known:*`, `aprog_*`, nazw enumów ani kluczy i18n.
*Kryterium:* tekst zrzutu nie zawiera ciągu 32 znaków hex ani prefiksu `seed_`.

**K29 — Zero błędów konsoli na otwartej karcie.** `bledyKonsoli = 0` w `<zrzut>.json`; 404 na zasób
karty jest błędem, nie szumem (dziś: rejestr KPI ma 3× 404).

**K30 — Odbiór karty = jeden zrzut 1440 jasny z otwartym „Pracuj z AI" i rozwiniętym Menu 5.**
Zwinięta sekcja nie jest dowodem; zrzut z harnessu `dev-render` nie jest dowodem — liczy się realna
trasa z realnym rekordem.

---

## §7. STAN ZASTANY W JEDNEJ LICZBIE (pomiar 06.09.2026, 22 karty)

| wymóg | spełnia | uwaga |
|---|---|---|
| K1 kontrakt sekcji istnieje | 7 / 22 | 7 katalogów `KanonicznaKarta`; `plan`/`capacity_analysis` mają `StandardSekcjaDef` (2 dalsze, słabsze) |
| K2 kontrakt steruje renderem | **0 / 22** | wszystkie 7 flag `VITE_VF1_*_CARD_CONTRACT` mają twardy `return false` i są puste w `server.env` |
| K7 prawy panel z **tabelą** Właściwości | 11 / 22 | + 3 karty mają wiersze bez nagłówka „Właściwość \| Wartość” (idea, presentation, audit-criterion); `plan`/`capacity_analysis` mają akapit; 4 karty nie mają panelu wcale |
| K12 pasek Menu 5 istnieje | 9 / 22 | komplet trzech elementów: **4** (task, decision, insight, initiative); w KPI/OKR/ROI brak przełącznika jest ZGODNY z K14 (rekord tylko do odczytu) |
| K21 „Pracuj z AI" z trzema pozycjami | **9 / 22** | + 2 karty (`plan`, `capacity_analysis`) mają trzy OSOBNE przyciski zamiast listy |
| K19 pigułka otwartej karty w pasku modułu | 12 / 22 | |
| K27 Teresa tylko w Menu 1 | 17 / 22 | wycieki: idea, audit-criterion, presentation, tool-document, notification |

Rozbicie per karta z plikiem, linią i zrzutem:
`docs/program/PROGRAM_NAPRAWCZY_20260905/P10/MATRYCA_21_KART.md`.

---

## §8. DEFINICJA UKOŃCZENIA KARTY (DoD, wzorowana na SPEC-A §18.1)

Karta jest „na kontrakcie", gdy JEDNOCZEŚNIE:
1. ma katalog sekcji (K1) i katalog steruje renderem bez flagi (K2);
2. każda sekcja ma writera albo jawny powód jego braku (K3), a bez danych znika (K4);
3. prawy panel ma Akcje · **tabelę** Właściwości · Powiązania · Źródła i założenia · Historia,
   a Komentarze są albo mają powód pominięcia (K6–K11);
4. Menu 5 ma trzy elementy, nagłówki są sticky, klasa S/L zgadza się z liczbą sekcji (K12–K16);
5. zero `primary-*`, fokus `c-focus`, pigułka w pasku modułu, 1440 i 1280 czysto (K17–K20);
6. „Pracuj z AI" ma trzy pozycje, propozycja→Zatwierdź, po polsku, z wypełnionym wierszem
   w tabeli K24 (K21–K24);
7. i18n pl+en bez angielskiego, Teresa tylko w Menu 1, zero UUID w DOM, zero błędów konsoli
   (K25–K29);
8. odbiór na jednym zrzucie 1440 jasnym z otwartym „Pracuj z AI" (K30).

Karta, która nie spełnia K2 albo K21, **nie jest gotowa** — to są dwa wymogi, o które właściciel
prosi wprost w DEC-429 („kontrakt na zawartość" i „przyciski AI we wszystkich typach kart N").
