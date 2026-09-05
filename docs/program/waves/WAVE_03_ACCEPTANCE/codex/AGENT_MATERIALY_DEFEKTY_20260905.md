# Materiały — 7 defektów z odbioru na żywo 05.09

Gałąź: `agent/materialy-defekty-20260905` (baza: `/private/tmp/m03`, tip `2797be574e`).
Wykonawca: robotnik. Zakres: siedem defektów wskazanych w zleceniu, każdy z testem i dowodem
mutacyjnym. Paska arkusza (ikony zamiast słów) NIE ruszałem.

## Skrót werdyktów

| # | Defekt | Werdykt | Gdzie |
|---|--------|---------|-------|
| 1 | Menu „Plik" niewidoczne/nieklikalne | NAPRAWIONE | portal + `useAnchorFixedMenuPosition` |
| 2 | „Użyj wzorca" → 403 | TEZA OBALONA, naprawiony komunikat, bramka ZOSTAJE | nowy kod `TEMPLATE_PROVENANCE_UNVERIFIED` |
| 3 | Martwy przewód „Edytuj" | NAPRAWIONE | czytelnik obok producenta |
| 4 | Blokada wzorca fail-open | NAPRAWIONE | `intakeGate.ts`, fail-closed |
| 5 | Flaga `VITE_ZAI_TERESA_ENABLED` bez efektu | NAPRAWIONE + ZNALEZIONA RODZINA ~112 plików | statyczny odczyt `import.meta.env` |
| 6 | Liczniki 0 przy 79 + pierwszy dokument 404 | OBA NAPRAWIONE | `statusCounts.ts`, `artifactOpenPath.ts` |
| 7 | Język skacze PL/EN | NAPRAWIONE (2 przyczyny) + 1 rzecz do decyzji | `i18n.ts`, `languagePreference.ts` |

---

## 1. Menu „Plik" — przycięte przez `overflow` paska

**Zmierzone.** Panel renderował się `position: absolute` WEWNĄTRZ `mels-topbar-chips`
(`TopBar.tsx`), którego klasa `overflow-x-auto` tworzy kontekst przycinania w OBU osiach.
`z-index: 40` tego nie przebija — `z-index` nie przechodzi przez przycięcie `overflow`.
Stąd obserwacja z odbioru: element w DOM, 260×208, opacity 1, a automat odmawia kliknięcia.

**Naprawa.** Panel przez `createPortal` do `body`, pozycjonowany `fixed` względem prostokąta
przycisku przez `useAnchorFixedMenuPosition`. **Ten współdzielony przyrząd nie miał do dziś
ANI JEDNEGO wołacza w `src/`** (jedenasty kształt fałszywego gotowe — biblioteka bez wywołania);
teraz ma dwa. Handler „klik na zewnątrz" zna portal, więc klik w pozycję menu nie zamyka go
przed wywołaniem akcji.

**RODZEŃSTWO (nieproszone, ale ten sam defekt).** `OverflowMenu` (`⋯`) w `TopBar.tsx` siedzi pod
tym samym przodkiem i miał dokładnie ten sam problem — a jego komentarz twierdził
„Portaled visually via a `z-dropdown`-tokened panel", mimo że portalu tam nie było. Naprawione
tą samą metodą, komentarz sprostowany.

Odblokowane: ekran `document-studio-save-as-template` („Zrób z tego wzorzec" leży w tym menu).

Test: `src/components/DocumentStudio/__tests__/DocumentStudioFileMenu.clipping.test.tsx` (4).
Dowód mutacyjny: usunięcie `createPortal` → czerwone.
Zrzut PO: `01-menu-plik-otwarte-PO.png` — menu widoczne z pełnym kompletem pięciu pozycji
(Nowy · Otwórz · Zapisz „Zapisano automatycznie" · Zapisz jako · Zrób z tego wzorzec), zero
błędów konsoli.

## 2. „Użyj wzorca" → 403 — **teza ze zlecenia obalona**

Zlecenie brzmiało „znajdź bramkę uprawnień, napraw dla OWNER/ADMIN/MEMBER". **Bramka nie patrzy
na rolę.** Pomiar (GET z tokenem właściciela, staging, 05.09):

```
GET /api/deliverables/templates-provenance/pending  → 200
  26 wzorców organizacji z provenanceStatus:"unknown"
  w tym DOKŁADNIE: "Board Control Template — DBR77 — 20260806"
```

Czyli ten sam wzorzec, który w Bibliotece jest oznaczony jako ZATWIERDZONY i na którym
właściciel dostał 403, siedzi w kolejce jako **nieatestowany**. Odrzuca go warunek
`provenance_status <> 'approved'` — brak zatwierdzonego **pochodzenia i praw**
(MAT-POL / AMD-MAT-PROVENANCE-WRITER-002, decyzja właściciela 3B: nieatestowany wzorzec
zostaje w kwarantannie z definicji).

**Bramki NIE usunąłem** — to celowe zabezpieczenie licencyjne, nie błąd. Błędem było, że ten stan
wracał pod kodem `TEMPLATE_FORBIDDEN`, więc OWNER czytał, że nie ma dostępu do własnego wzorca.

**Naprawa:** osobny kod `TEMPLATE_PROVENANCE_UNVERIFIED` (409 — konflikt stanu, nie autoryzacja)
i uczciwy komunikat wskazujący istniejące wyjście: Biblioteka wzorców → „Pochodzenie i prawa"
(`TemplateProvenanceApprovalDialog`, już zamontowany na pasku zakładki Szablony). Trzy mapy
komunikatów zaktualizowane razem (Document Studio, Prezentacje, Report Builder) — inaczej dwa
z trzech wejść dalej kłamałyby.

### ⚠️ DO DECYZJI WŁAŚCICIELA — wzorzec SYSTEMOWY nie da się odblokować
„Raport diagnostyczny DRD" **nie może zostać zaatestowany żadną istniejącą drogą**:
`listPendingTemplateProvenance` i `UPDATE` w `approveTemplateProvenance` filtrują
`WHERE organization_id = ?` (organizacja wołającego), a wzorce systemowe należą do
`SYSTEM_ORG_ID`. Potwierdzone pomiarem: DRD **nie ma go** w kolejce 26 pozycji. Dopóki ktoś nie
zaseeduje provenance dla wzorców systemowych albo nie doda ścieżki superadmina, **żaden wzorzec
systemowy nie zadziała nikomu**. Zapis do bazy stagingu jest poza moimi uprawnieniami.

Testy: `creationIntentResolver.test.ts` (30 zielonych; kwarantanna nadal odrzuca — dowód
mutacyjny: skasowanie warunku provenance → 3/30 czerwone; nowy przypadek pilnuje, że kod
kwarantanny NIE zlewa się z kodem cudzej organizacji).

## 3. Martwy przewód „Edytuj"

Producent (`resolveTemplateEditPath`) pisał `?tab=templates&editWorkbookTemplateId=<id>`,
**czytelnika nie było w całym `src/`** — tylko producent i jego test kontraktowy. Adres się
zmieniał, builder nigdy się nie otwierał.

Naprawa: czytelnik `resolveTemplatesDeepLink` leży **w tym samym pliku co producent i pod tym
samym testem** — żeby oba końce przewodu nie mogły znów się rozjechać. Hub tylko go woła. Przy
okazji hub synchronizuje `workbookTemplateId` także przy nawigacji na zamontowanym już ekranie
(bez tego „Edytuj" działałoby wyłącznie przy zimnym wejściu).

Test: `templateLibraryContract.test.ts` (+3, razem 26). Dowód mutacyjny: zaślepienie odczytu → czerwone.
Zrzut PO: `03-edytuj-wzorzec-arkusza-PO.png` — deep link ląduje w „Szablony skoroszytów"
(przedtem adres nie robił NIC).

### ⚠️ CZĘŚCIOWO — przewód żyje, ale cel jest z innej przestrzeni identyfikatorów
Zmierzone: `GET /api/workbook/templates` zwraca 9 modeli parametrycznych o identyfikatorach
`threeScenarioPnL`, `operatingBudget`, `dcfValuation`, … (camelCase). Biblioteka wzorców ma
11 wierszy `sheet_template`, wszystkie z identyfikatorami UUID —
**0 z 11 pasuje do któregokolwiek z 9 modeli**. `ExceleParametricTemplates` preselekcjonuje kartę
tylko przy `templates.find(t => t.id === initialTemplateId)`, więc po kliknięciu „Edytuj" widok
generatora się otworzy, ale KONKRETNY wzorzec nigdy się nie zaznaczy.
Innymi słowy: naprawiłem brakujący przewód (to był realny, mierzalny defekt), ale trasa
`resolveTemplateEditPath(..., 'sheet', …)` prowadzi do narzędzia, które nie zna tych wzorców.
Gdzie NAPRAWDĘ ma się edytować `sheet_template` z rejestru — to pytanie architektoniczne do
właściciela/nadzorcy, nie do robotnika.

## 4. Blokada wzorca była fail-OPEN

Blokada „Nie da się użyć tego wzorca" włączała się **wyłącznie** przy `entry=template`, bo
w łańcuchu ternary gałęzie `docEntryMode==='blank'` i `triMode && 'choose'` stały WYŻEJ niż
sprawdzenie stanu rozwiązania wzorca. Skutki:
- `?templateArtifactId=<nieistniejący>` → zwykła brama „Jak chcesz zacząć dokument?";
- `?entry=blank&templateArtifactId=<nieistniejący>` → **auto-tworzenie pustego dokumentu**.

Naprawa: decyzja w jednej czystej funkcji `resolveDocumentIntakeGate` (`intakeGate.ts`). Decyduje
SAMA obecność `templateArtifactId`, niezależnie od `entry`. Stan `idle` liczy się jak `resolving`
(efekt startuje po pierwszym renderze — inaczej pierwsza klatka byłaby fail-open). Efekt
auto-tworzenia pustego dokumentu też dostał ten warunek, inaczej artefakt powstawałby „w tle"
za blokującym ekranem.

Test: `intakeGate.test.ts` — **iloczyn** wszystkich trybów wejścia × `triMode` × stan rozwiązania
(26 przypadków), nie jeden scenariusz. Dowód mutacyjny: wycięcie gałęzi → 24/26 czerwone.
Zrzut PO: `04-blokada-wzorca-bez-entry-PO.png` — `?templateArtifactId=<nieistniejący>` BEZ
`entry=template` pokazuje blokadę „Nie da się użyć tego wzorca" (przedtem: zwykła brama wyboru).

## 5. Flaga z env — **cała warstwa `import.meta.env` była martwa**

To nie było „wyłączone". To **nigdy nie było podłączone**, w żadnym trybie. Dwa pomiary:

**BUILD.** Mini-projekt, `vite build`, `dist/assets/index-*.js`:
```js
function dynamicRead() { const meta = import.meta; return meta?.env?.[ENV_KEY]; }  // NIEPODSTAWIONE
function staticRead()  { return "true"; }                                          // podstawione
```
Podstawienie jest TEKSTOWE dla wyrażenia `import.meta.env.KLUCZ`; dynamiczny indeks nie jest
podstawiany, a natywne `import.meta` w bundlu nie ma własności `env` → `undefined`.

**DEV.** `GET /src/utils/zaiTeresaFlag.ts` z serwera dev:
- PRZED naprawą: brak preambuły → `import.meta.env` = `undefined`;
- PO naprawie: `import.meta.env = {"BASE_URL":"/", …, "VITE_ZAI_TERESA_ENABLED":"true"}`.

Vite wstrzykuje ten obiekt **tylko** do modułów, których kod po transformacji (czyli już bez
komentarzy) zawiera dosłowny napis `import.meta.env`. Komentarz z kluczem nie ratuje — esbuild
go usuwa, zanim Vite sprawdzi warunek.

Naprawa: odczyt statyczny (wzorzec, który ma już `dynamicSwotSevenStagesFlag.ts`).

### ⚠️ RODZINA — ~112 plików, DO DECYZJI WŁAŚCICIELA, **nie naprawiona**
W `src/utils/` jest **112 modułów flag** z identycznym dynamicznym odczytem (i 214 plików w całym
`src/` z tym wzorcem). Wniosek jest niewygodny: **żadna flaga ustawiana przez `VITE_*` nigdy nie
działała** — działały wyłącznie `?ff_*=1` i `localStorage`. Wszystko, co stoi w `.env.local`
i w env Railway pod flagami wizualnymi, jest dziś bez efektu.

Masowej naprawy **nie zrobiłem świadomie**: włączyłaby kilkadziesiąt flag wizualnych naraz na
żywo, czego zabrania CLAUDE.md §9 („zakaz masowego włączania"). To jest decyzja właściciela,
flaga po fladze, z akceptem na zrzutach.

Test: `zaiTeresaFlag.envStaticRead.test.ts` — broni KSZTAŁTU ODCZYTU w źródle po odjęciu
komentarzy. Test runtime'owy tego nie obroni: vitest sam podstawia prawdziwe `import.meta.env`,
więc obie wersje kodu by przeszły. Dowód mutacyjny: powrót do indeksu → 2/2 czerwone.
Zrzut PO: `05-zai-teresa-flaga-env-PO.png` — samo `?entry=ai`, BEZ `?ff_zai_teresa=1`, otwiera
`DocumentStudioAiEntryPanel`. Flaga z env działa.

**Uwaga do akceptu (nie defekt kodu):** prawy panel to nadal „JAKI DOKUMENT MAM NAPISAĆ?" +
dwa przyciski, a nie czat Teresy z zatwierdzonego obrazu `document-studio-ai-teresa`. To pytanie
o AKCEPT WYGLĄDU, nie o przewód — nie zmieniałem komponentu bez decyzji właściciela.

## 6a. Liczniki statusów 0 przy 79 rekordach

Licznik czytał pole `status`, a wiersze zakładki „Dokumenty" (`UnifiedOutputRow`) pola `status`
**nie mają** — status trzymają w `statusKey` (`types.ts:64`). Filtr tabeli czytał `statusKey`.
**Licznik i filtr czytały dwa różne pola tego samego wiersza**, więc filtrowanie działało, a
liczniki pokazywały 0. Szablony i prezentacje mają realne `status`, więc pole źródłowe jest teraz
wybierane jawnie per zakładka (`statusCounts.ts`).

Test: `statusCounts.test.ts` (6, m.in. „suma chipów = liczba wierszy"). Dowód mutacyjny:
powrót do stałego `'status'` → 4/6 czerwone.
Zrzut PO: `06a-liczniki-statusow-dokumenty-PO.png` — „Wszystkie 79 · Szkic 75 · Gotowy 0 ·
Wyeksportowany 0 · Zarchiwizowany 4" (75+4 = 79; przedtem wszystkie zera przy 79).

## 6b. Pierwszy dokument z listy otwiera 404

**Pomiar na stagingu (DBR77, GET z tokenem właściciela):**
```
GET /api/artifacts?outputType=report&limit=200 → 69 wierszy, 65 × native_artifact
  61 z originRecordId w kształcie Document Studio (artifact-<uuid>) → /api/document-studio/<id> = 200
   4 z originRecordId = generationId dostawy z czatu           → /api/document-studio/<id> = 404
```
Te 4 to **dokładnie** wiersze, które właściciel widział jako „Nie ma tu dokumentu" (m.in.
„Analizę dla rynku polskiego tylko"). Ten sam identyfikator na
`GET /api/work-canvas/drafts/<id>` zwraca **200 z pełnym draftem** — obiekt istnieje, tylko
mieszka pod innym runtime'em.

Przyczyna: dwaj pisarze (`services/ai/tools/generateDeliverable.ts` i
`POST /artifacts/register-chat`) rejestrują dostawę z czatu jako `originRuntime='native_artifact'`
z `originRecordId: generationId`. Taki rekord nigdy nie istniał w Document Studio — **wiersz
rodzi się z martwym linkiem**.

Naprawa (`server/src/routes/artifactOpenPath.ts`): wiersz rozpoznany po SEMANTYCE
(`originSummary.sourceType === 'chat'`), nie po kształcie napisu, dostaje adres miejsca, w którym
obiekt naprawdę jest: `?workPanel=1&canvasDraftId=` — trasę, którą `UnifiedChatPanel` **już
czyta** (ta sama co `buildDuplicateChatUrl` przy akcji „Duplikuj"). Wzorzec jak HOTFIX task#63
dla `assessment_report` w tej samej funkcji. Dokumenty Document Studio bez zmian.

### ⚠️ DO DECYZJI — dostawa z czatu nie ma uczciwego runtime'u
`native_artifact` kłamie o jej pochodzeniu. Poprawnie byłoby nadać jej własną wartość runtime,
ale to migracja CHECK + mapper FE + oba pisarze — szersze niż ta naprawa.

Test: `artifactOpenPath.test.ts` (5). Dowód mutacyjny: wycięcie gałęzi `chat` → 3/5 czerwone.
Zrzut PO: `06b-dokument-z-czatu-otwiera-sie-PO.png` — dokładnie ten dokument, który dawał 404
(„Analizę dla rynku polskiego tylko"), otwiera się z pełną treścią pod nowym adresem.

**Uczciwie o granicy dowodu:** naprawa jest po stronie SERWERA, a mój vite proxuje API do
stagingu, więc lista dalej dostaje STARY `openPath` z niezdeployowanego backendu. Zrzut dowodzi,
że CEL jest poprawny (dokument realnie się tam otwiera); że wiersz poprowadzi właśnie tam,
dowodzi test jednostkowy + pomiar. Pełny dowód end-to-end dopiero po deployu backendu.

## 7. Język skacze PL/EN — dwie przyczyny, obie zmierzone

**GŁÓWNA (`src/i18n.ts`).** Paczka tłumaczeń była pobierana z `cache: 'no-store'`, czyli
z **zakazem** użycia cache przeglądarki: każde wejście na dowolny ekran ciągnęło
`pl/translation.json` (**1,95 MB**) od zera po sieci. Przy `react.useSuspense: false` aplikacja
maluje się nie czekając na ten plik, więc do jego przyjścia `t()` zwraca wartości domyślne wpisane
w kodzie — a te są **mieszanką PL i EN**.

To wyjaśnia dokładnie objaw z odbioru: **„Purpose (wymagane)"** — „Purpose" to angielski default
z `DocumentStudioTemplateArchitectView.tsx:678`, „(wymagane)" to polski literał obok niego.
Sprawdzone: klucz `documentStudio.templateArchitect.purpose` **MA** w `pl/translation.json`
tłumaczenie „Cel" — to nie brak tłumaczenia, tylko **brak pliku w momencie renderu**. To, czy dany
ekran wyjdzie polski czy angielski, było wyścigiem z siecią, rozstrzyganym inaczej za każdym razem.

Naprawa: `cache: 'no-cache'` zamiast `'no-store'` — zachowuje intencję pierwotnego komentarza
(przeglądarka ZAWSZE pyta serwer, więc po deployu nie zostaje przy starym pliku), ale przy
niezmienionej treści dostaje 304 i używa kopii z dysku zamiast pobierać 1,95 MB od nowa.

**OSOBNA (`languagePreference.ts`).** `App.tsx` woła `syncLanguageFromAccount` DWA RAZY na
bootstrap, oba razy przez `void`, a tory mają różną długość (konto kończy natychmiast, organizacja
czeka na `GET /organization-context`) — starsze wywołanie mogło nadpisać język ustawiony przez
nowsze. Dodana bariera kolejności: wynik może być zastosowany tylko, jeśli nie wyprzedziło go
późniejsze wywołanie.

### ⚠️ DO DECYZJI — „konto właściciela = pl" nie da się dziś wymusić kodem
Zmierzone:
- `auth.json` → `user.language` **nie istnieje** (undefined);
- `GET /api/organization-context` dla DBR77 → `"defaultLanguage": null`;
- `localStorage.i18nextLng` = `"en"`.

Obie warstwy, które w kodzie mają wygrywać nad detektorem, są **puste**, więc
`syncLanguageFromAccount` kończy no-opem i detektor i18next legalnie czyta `en`. Determinizm PL
wymaga **ustawienia danych** (język na koncie właściciela albo `defaultLanguage` organizacji) —
zapisu do bazy stagingu ta rola nie ma prawa wykonać. Kod jest gotowy i przetestowany.

Test: `languagePreference.ordering.test.ts` (3). Dowód mutacyjny: usunięcie bariery → czerwone.

---

## Znalezione przy okazji (poza zakresem, do wiadomości nadzorcy)

1. **`/private/tmp/m03/scripts/dev/odbior-zywo/zrzut.mjs` ma NIEROZWIĄZANY KONFLIKT SCALANIA**
   (`git status` → `UU`, w pliku stoją znaczniki `<<<<<<< HEAD` / `=======` / `>>>>>>>`).
   Każdy agent, który go teraz uruchomi, dostanie błąd składni. Zrzuty robiłem czystą kopią
   z własnej gałęzi.
2. **Zastana czerwień (NIE ode mnie):** `DocumentStudioDocumentPanel.test.tsx` →
   „uses the Artifact Studio shell…" oczekuje `client_confidential`, dostaje
   `Client confidential`. Sprawdzone przez cofnięcie moich plików do HEAD: pada tak samo.

---

## Zrzuty PO

`evidence/materialy-20260905/`, jasny motyw, 1440, własny vite na porcie 3097 z kopią
`.env.local`, sesja właściciela z `ODBIOR_AUTH_STATE`:

| Plik | Co dowodzi |
|------|-----------|
| `01-menu-plik-otwarte-PO.png` | menu „Plik" widoczne, 5 pozycji, 0 błędów konsoli |
| `03-edytuj-wzorzec-arkusza-PO.png` | deep link „Edytuj" otwiera Szablony skoroszytów |
| `04-blokada-wzorca-bez-entry-PO.png` | blokada wzorca działa BEZ `entry=template` |
| `05-zai-teresa-flaga-env-PO.png` | flaga z env włącza ścieżkę „Z AI" bez `?ff_` |
| `06a-liczniki-statusow-dokumenty-PO.png` | 79 = 75 Szkic + 4 Zarchiwizowany |
| `06b-dokument-z-czatu-otwiera-sie-PO.png` | dokument spod 404 otwiera się pod nowym adresem |

Pułapka przyrządu, którą po drodze złapałem: dwa pierwsze podejścia do zrzutu menu „Plik" dały
ekran „Coś poszło nie tak". To NIE był defekt produktu — w `.json` obok zrzutu stoi
`504 (Outdated Optimize Dep)`, czyli vite przebudowywał pre-bundle po restarcie. Po rozgrzaniu
modułu ten sam zrzut ma 0 błędów. Gdybym patrzył tylko na obrazek, zgłosiłbym nieistniejącą awarię.

## Czego NIE ruszałem
- **Pasek arkusza (ikony zamiast słów)** — prośba właściciela, zakaz w zleceniu.
- **Bramka provenance** — celowe zabezpieczenie, zmieniony wyłącznie kod błędu i komunikat.
- **Rodzina ~112 flag z dynamicznym odczytem env** — masowe włączenie zakazane przez CLAUDE.md §9.
- **Prawy panel „Z AI"** — rozjazd z zatwierdzonym obrazem to sprawa akceptu, nie przewodu.

## Otwarte, wymaga decyzji (zebrane)
1. Wzorce SYSTEMOWE nie mają drogi do atestacji provenance → są nieużywalne dla wszystkich.
2. Rodzina ~112 flag: czy i w jakiej kolejności naprawiać dynamiczny odczyt `import.meta.env`.
3. Dostawa z czatu nie ma uczciwego `originRuntime` w rejestrze.
4. Gdzie ma się edytować `sheet_template` z rejestru (przestrzenie id są rozłączne).
5. Język właściciela: trzeba USTAWIĆ dane (`users.language` albo `defaultLanguage` organizacji).
6. Prawy panel „Z AI" — akcept wyglądu.
