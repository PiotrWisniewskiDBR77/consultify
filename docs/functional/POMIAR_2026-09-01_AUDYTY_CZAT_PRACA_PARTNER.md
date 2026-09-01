---
document_id: POMIAR-2026-09-01-AUDYTY-CZAT-PRACA-PARTNER
modules: [11_audits, 01_czat, 02_moja-praca, 19_portal-partnerski]
truth_type: as-is-verified-in-runtime + process-notes
prepared_by: sonnet (sesja dokumentacyjna)
branch: docs/modules-d-audyty-czat-praca-partner-20260901
based_on_marker: 9fb7942a01 / 0a35699021 (dyżury 220-225)
last_reviewed: 2026-09-01
---

# Pomiar 2026-09-01 — Audyty · Czat · Moja Praca · Portal Partnerski

Ten dokument zbiera **prawdę runtime z dyżurów 220-225** (2026-09-01) dla czterech
modułów i mówi wprost, co jest AS-IS (zmierzone dziś, z `plik:linia` albo datą
i sposobem pomiaru), co jest TO-BE (plan właściciela, nie stan produktu), co jest
**znanym, otwartym defektem**, a gdzie pomiar dał wynik **„defektu nie ma"**.

Materiał źródłowy: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY22{0,1,2,3,4}_*.md`,
karty `docs/program/waves/WAVE_03_ACCEPTANCE/modules/{12_AUDITS,13_CHAT,07_MY_WORK_AGENT,16_PARTNER}/MODULE_ACCEPTANCE.md`,
`docs/program/funkcje/ZNALEZISKO_POSTEP_SESJI_AUDYTOW.md`,
`docs/program/funkcje/ODBIOR_ZALACZNIKI_INICJATYW.md`. Wszystkie cytowane pliki
zostały sprawdzone `[ -e "$p" ]` przed cytowaniem.

---

## 1. Audyty (`docs/functional/11_audits/`)

### 1.1 AS-IS — co jest w produkcie dzisiaj

Hub ma **jeden route** `/audit-programs` (`src/routes/AppRoutes.tsx:1625`) i
**sześć zakładek** (`AuditsMethodHub.tsx:371-406`): Biblioteka, Sesje (`processes`),
Wyniki, Raporty, Ustalenia, Inicjatywy. Każda zakładka jest kanoniczną listą
`StandardTable`+`StandardPreview`:

- Biblioteka — `tabs/AuditLibraryTab.tsx:128,313,332`
- Sesje — `AuditProcessesTab.tsx:198,400,419`
- Wyniki — `AuditOutputsTab.tsx:122,308,331`
- Raporty — `AuditReportsTab.tsx:219,438,472`
- Ustalenia — `AuditFindingsTab.tsx:290,605,651`
- Inicjatywy — `AuditInitiativesTab.tsx:106,282,301`

(Źródło: `CODEX_DAY221_AUDYTY_WARSZTAT_REPORT.md`, R1, 2026-09-01.)

**Ten pomiar zastępuje** wcześniejszy zapis w
`docs/functional/11_audits/AUDITS_CURRENT_STATE_AND_SOURCE_REGISTER.md`
(`baseline_sha f3e7df565e`, 2026-08-13), który mówił „cały moduł to 6 plików" i
„brak ekranu artefaktu" — patrz adnotacja **obalone** wprost w tamtym pliku i w
§1.4 poniżej.

Dane techniczne pod spodem już istnieją: program z paginacją, cyklem życia,
członkami i licznikami kryteriów/ustaleń/dowodów (`programService.ts:209-347,1059-1076`);
wersjonowane wyniki ze snapshotem dowodów, kryteriów, ustaleń, odpowiedzi, CAPA
i weryfikacji (`outputService.ts:110-251,410-512`); wersjonowane raporty z
zatwierdzeniem, publikacją, materiałem i renderem dokumentu (`reportService.ts:130-395`).

### 1.2 Znany, otwarty defekt — kolumna „Postęp" pokazuje literalny „/"

**Żywy defekt, widoczny na ekranie, sprzed dyżuru 220, NIE naprawiony** (poza
licencją tamtych dyżurów, zgłoszony świadomie).

Trasa `GET /api/audits/programs` zwraca `criteriaTotal`, `criteriaConcluded`,
`findingsOpen`. Ekran czyta (`AuditProcessesTab.tsx:249`) `row.concludedCriteria`,
`row.applicableCriteria`, `row.openFindings` — **żadna z tych trzech nazw nie
istnieje w odpowiedzi**. `AuditsMethodHub.tsx:227-266` przekazuje dane z
`listPrograms()` bez żadnego przemapowania. Skutek: React renderuje `undefined`
jako nic → kolumna „Postęp" pokazuje **literalnie ukośnik** na każdym wierszu,
a „Ustalenia otwarte" jest **pusta**. Brak błędu, brak czerwieni na ekranie —
brakująca wartość renderuje się cicho.

Pomiar: realny Postgres, realny `ApiGateway`, podpisany token — HTTP fixture
zwrócił `criteriaTotal=1, criteriaConcluded=1` (program ma pełny postęp 1/1),
a ekran mimo to pokazuje „/". Rejestr: `AUD-OR-20260829-005` w karcie modułu —
pole „Postęp" pozostaje `OPEN`.

Źródło: `docs/program/funkcje/ZNALEZISKO_POSTEP_SESJI_AUDYTOW.md`;
`CODEX_DAY220_AUDYTY_REJESTR_REPORT.md` §W5.

### 1.3 Drugi pomiar tego samego dyżuru — wynik „defektu nie ma"

Sprawdzono, czy zakładki Raporty i Inicjatywy pokazują surowe identyfikatory
użytkowników zamiast nazw (podejrzenie analogiczne do kolumny „Postęp"). **Nie
pokazują — bo nie pokazują tych pól w ogóle.** Trasy zwracają
`createdBy`/`approvedBy`/`proposedOwnerId`, ale żaden z komponentów ich nie
czyta ani nie renderuje, a typy frontu nawet ich nie deklarują. Brak
`userNameById` w tych dwóch zakładkach **nie jest defektem** — nie ma czego
rozwiązywać. Ten wynik jest wart tyle samo co znalezisko: rozkaz pomiarowy
`W3` dał odpowiedź „sprawdziliśmy, nie ma problemu".

Osobno, karta Sesji **już rozwiązuje** surowe identyfikatory audytora przez
`userNameById` (istniejący resolver, brak mapowania daje `—`, nie surowy ID);
sześć wskazanych miejsc z pełną treścią (`title=` na tytule pakietu, nazwie
audytora, odbiorcy raportu, poufności, treści ustalenia, nazwie kryterium) ma
pełną wartość dostępną mimo zwartego layoutu tabel.

Źródło: `CODEX_DAY220_AUDYTY_REJESTR_REPORT.md` §R2, §R3.

### 1.4 Warsztat D-5 — prototyp gotowy do akceptu, NIE jest w produkcie

`AUD-OR-20260829-004` pozostaje `OPEN`. Realny produkt jest **tabelarycznym
hubem** (sześć zakładek wyżej) i nie odtwarza wcześniej zaakceptowanego
dev-renderu „warsztat overview" (łańcuch 18 ogniw / 4 fazy / prawy panel).

Prototyp: `dev-render/screens/day221-audyty-warsztat.tsx`, rejestr
`?screen=day221-audyty-warsztat`. Archetyp SPEC-A: C „Rekord", klasa L —
wybrany po odczycie `ARTIFACT_ANATOMY_STANDARD.md` i `TRIADA_KANON.md`.
Wireframe: pasek tożsamości + CTA → pasek postępu/liczników → centrum 4 kolumn
faz (18 klikalnych ogniw) → stały prawy panel. **V1 NIE zapisuje, nie woła
API/AI, nie generuje raportu/PDF, nie zarządza CAPA i nie jest zamontowana pod
`/audit-programs`.**

Flaga `ENABLE_AUDITS_WORKSHOP`: `z.boolean().default(false)`; grep po repo
pokazuje **brak wołacza poza deklaracją i własnym testem flagi** — to znaczy,
że nawet włączenie flagi dziś niczego by nie odsłoniło w produkcie, bo nic jej
nie konsumuje.

**Stan: prototyp gotowy do wizualnego akceptu właściciela; nie wolno tego
mylić z „ekran istnieje w produkcie".**

Źródło: `CODEX_DAY221_AUDYTY_WARSZTAT_REPORT.md` §R2-R6.

### 1.5 Ile ekranów jest dziś nieosiągalnych i dlaczego

| Ekran | Stan | Powód |
| --- | --- | --- |
| Biblioteka, Sesje, Wyniki, Raporty, Ustalenia, Inicjatywy (6 zakładek hubu) | **osiągalne** | zamontowane, `StandardTable`+`StandardPreview`, realny backend |
| Warsztat D-5 (widok programu jako sekwencja faz) | **nieosiągalny** | żyje wyłącznie w `dev-render`; flaga `ENABLE_AUDITS_WORKSHOP` default OFF i **zero wołaczy produktowych**; brak trasy pod `/audit-programs` |

**Liczba: 1 dodatkowy ekran nieosiągalny** (Warsztat D-5) obok 6 osiągalnych
zakładek hubu. Starszy dokument (`AUDITS_CURRENT_STATE_AND_SOURCE_REGISTER.md`,
2026-08-13) twierdził dodatkowo, że `AuditHistoryView.tsx` jest martwy (zero
importów) i że `/api/audit` (tabela `audits`) jest niezamontowane na
demo/produkcji — **te dwa twierdzenia NIE zostały dziś ponownie zmierzone** i
wymagają osobnego pomiaru, zanim trafią tu jako fakt (patrz §1.6).

### 1.6 Zapisy do skorygowania w istniejącej dokumentacji Audytów

- `docs/functional/11_audits/README.md`, sekcja `## AS-IS`: zapis „brak
  pełnego modelu blueprint/evidence/test/finding/action" jest **obalone
  1.09** — model istnieje i działa (§1.1 wyżej: `programService.ts`,
  `outputService.ts`, `reportService.ts`, sześć zakładek). Dopisano adnotację
  w pliku (patrz commit tej sesji).
- `docs/functional/11_audits/AUDITS_CURRENT_STATE_AND_SOURCE_REGISTER.md`
  (baseline `2026-08-13`): twierdzenia „cały moduł to 6 plików", „Brak ekranu
  artefaktu", „moduł nie emituje żadnych zdarzeń domenowych", „Brak store'a" są
  **dramatycznie nieaktualne** wobec dzisiejszego pomiaru (§1.1). Dokument
  pozostaje jako **historia** (nie kasowany), z banerem na górze wskazującym
  ten plik jako aktualny punkt odniesienia dla stanu na 2026-09-01. Rejestr
  Audit Packs (§3 tamtego pliku — presety ISO 27001/New Company,
  klasyfikacja `LEGACY`/`INTERNAL`) **nie był przedmiotem dzisiejszego
  pomiaru** i pozostaje bez zmiany statusu.

---

## 2. Czat (`docs/modules/01_czat/`)

### 2.1 AS-IS — governed proposal renderuje się na realnej ścieżce

Realny render potwierdzony na kanonicznym runtime (nie dev-render, nie
storybook): wiadomość `execution_proposal` przechodzi przez prawdziwy
`UnifiedChatPanel` (import `MessageRenderer` l.134) i `MessageRenderer.tsx`
(import l.53, `set` l.69, warunek l.643, render l.650). Trasa produktowa:
`AI_CHAT: '/chat'` (`routeConfig.ts:31`), `AIChatView` renderuje
`<UnifiedChatPanel .../>` (l.8).

Metoda: dozwolony seed `conversation_messages` w efemerycznej bazie (bez
modelu językowego), realne logowanie, otwarcie `/chat/:conversationId`. DOM
potwierdził grupę „Governed execution proposal", wiadomość użytkownika i
widoczny kompozytor. Zrzuty light/dark, różnica jasności `224,9` (próg >20).

**Nie klikano** `Approve`/`Reject`/`View run` — dyżur dowodzi renderu karty,
nie wykonania cyklu życia propozycji.

Źródło: `CODEX_DAY223_CZAT_RENDER_REPORT.md` §3.

### 2.2 11 „widm" akcji czatu — sprostowanie liczby i stan po wygaszeniu

Brief wcześniej mówił o „~10 widmach" (typach akcji zadeklarowanych w
`ChatActionType`, które nie mają żadnego producenta w interfejsie — użytkownik
nigdy nie zobaczy tej akcji, bo nic jej nie tworzy). **Zmierzona liczba to 11,
nie ~10.**

Po wygaszeniu trzech typów (`CREATE_TASK`, `CREATE_DECISION`,
`CREATE_INITIATIVE` — każdy dostał realnego producenta przez governed
`CREATE_DRAFT_TASK`/`CREATE_DRAFT_DECISION`/`CREATE_DRAFT_INITIATIVE` w
`aiActionExecutor.ts`), zostało **14 typów akcji, 6 z producentem, 8 bez
producenta**:

| Typ bez producenta | Powód braku decyzji |
| --- | --- |
| `START_TOOL` | brak danych, które narzędzie/payload mają być kanoniczne |
| `OPEN_PREVIEW` | brak jednoznacznej relacji `workspaceContext` → typ/ID podglądu |
| `ASSIGN_INTERVIEW` | wymaga decyzji o doborze template i assignees w czacie |
| `START_ARTIFACT_REVIEW` | brak wskazania kanonicznego artefaktu i cyklu review |
| `CHECK_TRUST_STATE` | brak rozstrzygnięcia, który scope trust pokazywać w czacie |
| `ANALYZE_STATEMENT` | nie wiadomo, czy akcja żyje w czacie czy tylko w Finance |
| `REVIEW_MODEL` | jw. |
| `CHECK_LANE_STATUS` | brak kanonicznego `runId` w ogólnym kontekście czatu |

To są **decyzje produktowe do podjęcia przez właściciela**, nie luki
techniczne — każda wymaga rozstrzygnięcia, zanim można zbudować producenta.

Źródło: `CODEX_DAY223_CZAT_RENDER_REPORT.md` §4.

### 2.3 Canvas pozostaje NO_GO — bez zmiany dzisiaj

`STATUS.md` i `09_AS_IS.md` modułu Czat (2026-07-29) opisują Canvas jako
`NO_GO` — brak kompletnego dowodu ścieżki `wybrany wynik → szkic → przegląd →
akceptacja/odrzucenie → odczyt w module właścicielskim`. **Ten dyżur (223) nie
dotyczył Canvas** i nie zmienia tego statusu; karta modułu (`13_CHAT`) notuje
DoD Canvas `5/16` z dyżuru 110 — bez zmiany. Zapis w `STATUS.md`/`09_AS_IS.md`
pozostaje aktualny.

### 2.4 Ile ekranów jest dziś nieosiągalnych i dlaczego

| Powierzchnia | Stan | Powód |
| --- | --- | --- |
| `/chat`, `/chat/:conversationId` | **osiągalne** | zamontowane, realny render potwierdzony |
| Governed proposal (execution_proposal) | **osiągalne** | potwierdzone dziś na realnej ścieżce (§2.1) |
| 8 z 14 typów `ChatActionType` (tabela §2.2) | **nieosiągalne dla użytkownika** | brak producenta w UI — akcja nigdy się nie pojawi |
| Tool-loop write Teresy | **nieosiągalny domyślnie** | `ENABLE_TERESA_TOOL_LOOP_WRITE` ma `default(false)` (`FeatureFlags.ts:37`); flaga przekazana do skryptu startowego dyżuru 223 i tak nie dotarła do serwera (kanoniczny `childEnv(...)` jej nie przepuszcza) |
| Canvas — pełna ścieżka startowa | **nieosiągalna end-to-end** | `NO_GO`, DoD `5/16` (dyżur 110), bez zmiany dzisiaj |
| Feed Sygnałów w czacie (`ChatSignalsFeed`) | **pusty z definicji** | producent wyłączony świadomie; `KNOWN_DECISION / NOT_A_DEFECT` — reguły nie czytają treści czatu (`CHAT-OR-20260829-003`) |

**Liczba: 2 route'y produktowe osiągalne; 8 z 14 zadeklarowanych typów akcji
czatu nieosiągalne dla użytkownika; Canvas i tool-loop write nieosiągalne
end-to-end domyślnie.**

---

## 3. Moja Praca (`docs/modules/02_moja-praca/`)

### 3.1 AS-IS — komentarz AI w zadaniu naprawiony, RACI oczyszczone (dyżur 222)

**§A.1 — komentarz AI: `FIXED_VERIFIED`.** Wcześniej: lokalny obiekt udający
„AI Assistant" istniał tylko w pamięci przeglądarki (nie był zapisywany).
Dziś: `setComments(await addTaskCommentAndReload(Api, taskId, generatedComment))`
— realny `POST`, następnie realny `GET` readback. Oba konsumenci
(`CommentsCanvas`, starszy `CommentsSection`) używają tej samej funkcji.
Komentarz jest przypisany zalogowanemu użytkownikowi po reloadzie; etykieta
„AI Assistant" nie jest utrwalana. Dowód mutacyjny: przed poprawką test padał,
po poprawce przechodził, po cofnięciu pliku znów padał, po odtworzeniu — zielono.

**§A.2 — RACI: `FIXED_WITH_MUTATION_PROOF / COMPONENT_RENDER_PARTIAL`.** Typ
`Stakeholder` nie ma pola załącznika — usunięto bezcelowy przycisk pobierania
z wiersza RACI. Ograniczenie: pełny render+klik całego `DecisionDetailView` nie
osiągnął tej tabeli, bo legacy C-mode automatycznie cofa się do N-mode bez
`VITE_ENABLE_LEGACY_C_MODE=true` — status pozostaje `PARTIAL`, nie `VERIFIED`,
mimo poprawnego dowodu na poziomie źródła/kontraktu typu.

Gate modułu **pozostaje bez zmiany**: `DAY100_PARTIAL_OWNER_PACKET /
3_OF_5_SURFACES_HAVE_FULL_STATE / CORE_DESIGN_TASKS_REQUIRED / NOT_ACCEPTED`.

Źródło: `CODEX_DAY222_MOJAPRACA_REPORT.md`.

### 3.2 Rejestr 56 atomów — rozdział AS-IS/TO-BE per submoduł

Karta modułu (`07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md`) prowadzi pełny rejestr
56 unikalnych obserwacji właściciela (15 Ideas + 6 Notebook + 23 odzyskane +
11 photo-gate + 1 duplikat) ze statusami:

- `ZROBIONE_W_KODZIE` — zrobione i zaryglowane regresją w kodzie,
- `CZĘŚCIOWE` — częściowo zbudowane, luka opisana w Evidence,
- `NIEZROBIONE` — nie zaczęte / nie podłączone,
- `WYMAGA_DECYZJI` — potrzebna decyzja właściciela przed dalszą pracą.

Ten dokument **nie powiela** 56 wierszy (żyją w karcie modułu); zwraca uwagę
na wzorzec powtarzający się w kilku wierszach:

- **Zbudowane, ale niepodłączone bez wywoływanej decyzji.** Przykład:
  `MYW-CV-REC-005` (dodanie folderu na poziomie sejfu) wprost **koliduje** z
  już wdrożonym i zaryglowanym regresją `MYW-CV-REC-008` na tym samym ekranie
  — oba zapisy pochodzą z tej samej daty (2026-08-22) i czytają się jako
  sprzeczne polecenie właściciela. Nie rozstrzygnięto który ma pierwszeństwo —
  **sprzeczność, wymaga pomiaru/decyzji właściciela**, nie zgadywania.
- **AI Advice nie istnieje w ogóle** (`MYW-IDEAS-CORE-001`) — zero wystąpień w
  `src`, mimo że dokumentacja oczekiwania mówi o nim jako o istniejącej
  funkcji obok `AI Summary`.
- **Konwersja Idea→Note/Notebook nie ma żadnej ścieżki API** (`MYW-IDEAS-012`,
  `MYW-IDEAS-014`) — rejestr wymienia cel, ale menu i backend go nie mają.

### 3.3 Wzorzec „zbudowane, ale niepodłączone" — dziś potwierdzony ÓSMY raz (kontekst, nie w My Work)

Dla porządku: ósmy potwierdzony przypadek tego wzorca w programie dotyczy
**Inicjatyw**, nie Mojej Pracy — `AttachmentsSection.tsx:25-33` (dodanie pliku
robiło wyłącznie lokalny link w pamięci i pokazywało **bezwarunkowy komunikat
sukcesu**; zaplecze i tak odrzuciłoby zapis, bo dopuszczało tylko
`task`/`decision`; a widok Inicjatywy **nigdy nie wczytywał załączników z
serwera** — trzy przerwane ogniwa naraz). Ten wzorzec **jest instruktażem do
sprawdzenia** w Mojej Pracy i Portalu Partnerskim — wynik poniżej, §3.4 i §4.4.

Źródło: `docs/program/funkcje/ODBIOR_ZALACZNIKI_INICJATYW.md`.

### 3.4 Sprawdzone: bezwarunkowe komunikaty sukcesu w Mojej Pracy

Przeszukano `src/components/MyWork/**` i `src/views/vault/**` pod kątem
uchwytów upload/attach/save, które pokazują sukces **bez** poprzedzającego
realnego wywołania backendu (ten sam kształt co defekt Inicjatyw). **Wynik:
DZIEWIĄTY potwierdzony przypadek wzorca** — Form Builder w narzędziu Tabel
Idei (`IdeaTableTool.tsx:5061-5103`) pokazuje „Formularz zapisany" i wyrzuca
całą konfigurację, mimo że realne API formularzy istnieje i jest gotowe do
użycia. Szczegóły, cytaty i weryfikacja plik-po-pliku: §5.1-5.4.

### 3.5 Ile ekranów jest dziś nieosiągalnych i dlaczego

| Powierzchnia | Stan | Powód |
| --- | --- | --- |
| Notebook — nowy prawy panel `ArtifactRightPanel` (Akcje·Właściwości·Powiązania·Komentarze·Historia) | **nieosiągalny domyślnie** | `ENABLE_NOTEBOOK_SPEC_A_SHELL` ma literalny `default(false)`; OFF zachowuje zastany rail (`MYW-NBK-CORE-001`, dyżur 98) |
| Ideas — docked prawy panel (zamiast trzech osobnych inspektorów) | **nieosiągalny domyślnie** | `ff_ideaDetailsInPanel` default OFF (`utils/ideaDetailsInPanelFlag.ts:35`) |
| RACI (legacy C-mode `DecisionDetailView`) | **nieosiągalny w pełnym teście komponentowym** | auto-cofnięcie do N-mode bez `VITE_ENABLE_LEGACY_C_MODE=true` (dyżur 222, ograniczenie §A.2) |
| AI Advice (Ideas) | **nie istnieje w kodzie** | zero wystąpień w `src` (`MYW-IDEAS-CORE-001`) — nie jest to „wyłączone", tylko niezbudowane |
| Konwersja Idea → Note/Notebook | **nie istnieje w API/menu** | brak w rejestrze celów konwersji i w menu (`MYW-IDEAS-012`) |
| Run Agent / „moduł królewski" | **poza tym rejestrem** | świadomie przeniesiony do modułu 17 (`DEC-2026-08-25-23`), nie liczy się do denominatora My Work |

**Liczba: co najmniej 3 warianty ekranu za domyślnie wyłączonymi flagami
(Notebook Spec-A, Ideas docked panel, legacy RACI), 2 funkcje zadeklarowane w
rejestrze właściciela, które nie istnieją w kodzie wcale (AI Advice, konwersja
do Note/Notebook).** To NIE jest pełny audyt wszystkich ekranów My Work (hub
obejmuje Ideas × 4 narzędzia, Notebook, Inbox, Tasks, Decisions, Calendar,
Manager, Vault, Run Agent) — karta modułu sama notuje otwarte G06/G09/G10 dla
większości tych powierzchni; powyższa tabela to **zmierzone dziś fakty**, nie
ekstrapolacja na cały moduł.

---

## 4. Portal Partnerski (`docs/modules/19_portal-partnerski/`)

### 4.1 AS-IS — Earnings pokazuje uczciwy pusty stan, nie stary baner błędu

**§A.1 wynik (b).** Stary bursztynowy baner z dnia 189 **nie jest już
osiągalny** tą ścieżką po fixie z dyżuru 188. Trasa `earnings-summary`
(`partner.routes.ts:1099` okolica) łapie
`PARTNER_ACCRUAL_POLICY_BLOCKED_OWNER` i zwraca `reason: 'POLICY_NOT_APPROVED'`
w odpowiedzi `200`, zamiast rzucać błąd. `EarningsSection.tsx` ustawia błąd
tylko, gdy `error && !summary` — w żywym przebiegu ta gałąź nie wystąpiła.

**To NIE jest dowód działania silnika ekonomii** — accrual/payout pozostają
świadomie `OFF` (`AMD-PRT-ECONOMICS-002`).

**Obalone 1.09, było:** Dyżury 62/177 (2026-08-28/30) potwierdziły, że
`GET /api/v8/partner/earnings-summary` zwraca **HTTP 500**
(`PARTNER_ACCRUAL_POLICY_BLOCKED_OWNER`) — `PRT-D62-005 POTWIERDZONY`.
**Jest:** na markerze dyżuru 224 (2026-09-01) ta sama polityka jest dziś
zwracana jako **HTTP 200** z polem `reason`, nie jako 500. Trasa
`partner.routes.ts` między tymi pomiarami zmieniła sposób sygnalizacji błędu
z rzucanego wyjątku (500) na skonstruowaną, uczciwą odpowiedź (200 +
`reason: 'POLICY_NOT_APPROVED'`). Oba pomiary są realne i chronologicznie
zgodne — to jest poprawa, nie sprzeczność.

Źródło: `CODEX_DAY224_PARTNER_REPORT.md` §3; karta `16_PARTNER`, wpis „Day224".

### 4.2 Organizations — kolumny mieszczą się na desktopie, NIE na mobile

Zmiana: `minTableWidth="auto"` w jednym wywołaniu `Organizations`
(`PartnerPortalView.tsx`) usuwa próg `DEFAULT_MIN_TABLE_WIDTH=980`. Dowód
mutacyjny 4-krokowy (przed/po/cofnięcie/przywrócenie) — pełny cykl czerwono-
zielono-czerwono-zielono. Przy 1280px wszystkie sześć kolumn i Status są
widoczne. **Przy 375px (mobile) Status nadal nie jest widoczny** — sześć
kolumn o własnych szerokościach nie mieści się. `PRT-D112-003` pozostaje
`PARTIAL_MOBILE`, wymaga osobnego kontraktu responsywnego (rekomendacja:
nie zamykać tego zadania dla mobile).

Źródło: `CODEX_DAY224_PARTNER_REPORT.md` §4, STOP §A.2 mobile.

### 4.3 „Users: 0" jest uczciwą liczbą, nie ukrytym błędem

Organizacja `b1600000-0000-4000-8000-000000000003` istnieje (dokładnie 1
wiersz w `organizations`), ale `SELECT COUNT(*) FROM users WHERE
organization_id=...` zwraca `0`. Log żywego żądania (`GET
/api/v8/partner/clients`) **nie zawiera** `getPartnerClients user counts
failed` — to nie jest połknięty błąd zapytania ani sierota. Kontrakt usługi
na realnym Postgresie z dodanym użytkownikiem klienta zwrócił poprawnie
`users=1`. **Werdykt: `Users: 0` to uczciwa liczba / dane fixture, nie
defekt.**

Źródło: `CODEX_DAY224_PARTNER_REPORT.md` §5.

### 4.4 Sprawdzone: bezwarunkowe komunikaty sukcesu w Portalu Partnerskim

Przeszukano komponenty Portalu Partnerskiego pod tym samym kątem co w §3.4.
**Wynik: czysty.** Moduł nie ma w ogóle mechanizmu wysyłania plików, więc nie
może mieć tej konkretnej klasy defektu; sprawdzone komunikaty sukcesu są
warunkowane realnym wywołaniem zaplecza. Szczegóły: §5.2.

### 4.5 Ile ekranów jest dziś nieosiągalnych i dlaczego

Najpełniejszy zmierzony mianownik Partnera to **25 sekcji** (dyżur 177,
2026-08-30, marker `consultify_w3_partner_owner_cx177`, realne logowanie,
PL Light+Dark, 50/50 zrzutów zwalidowanych po active+lang+theme):

| Wynik sekcji | Liczba | Uwaga |
| --- | --- | --- |
| renderuje się | **17 / 25** | — |
| błąd | **7 / 25** | w tym potwierdzone `PRT-D62-005` (earnings 500 — od dyżuru 224 już 200, patrz §4.1 „obalone") i `PRT-D62-006` (`uuid = text` w Projects, UI pokazuje fałszywe zero) |
| pusta | **1 / 25** | — |

Dodatkowo: ekonomia (accrual/payout) jest **świadomie wyłączona**
(`PARTNER_ECONOMICS_POLICY_DISABLED`, gate `ECONOMICS_OFF`) — to decyzja
produktowa, nie defekt dostępności.

**Liczba: z 25 zmierzonych sekcji, 7 kończyło się błędem w dniu pomiaru
(30.08); jedna z tych siedmiu (earnings-summary) została od tego czasu
naprawiona z 500 na uczciwe 200 (dyżur 224, 1.09) — pozostałe sześć NIE
zostało dziś ponownie zmierzone i wymaga osobnego retestu, zanim ktoś ogłosi
je naprawionymi.**

---

## 5. Bezwarunkowe komunikaty sukcesu — My Work i Partner (wynik przeszukania)

### 5.1 POTWIERDZONY DEFEKT — dziewiąty przypadek wzorca „fałszywa obietnica zapisu" (Moja Praca)

Przeszukano `src/components/MyWork/**` i `src/views/vault/**` pod kątem
uchwytów upload/attach/save pokazujących sukces bez poprzedzającego realnego
wywołania backendu — ten sam kształt co ósmy potwierdzony przypadek
(Inicjatywy, §3.3).

**Znaleziony: `src/components/MyWork/IdeaTableTool.tsx:5061-5103`** — kreator
formularzy (Form Builder) w narzędziu Tabel Idei.

- `onSave` (`:5089-5092`) **ignoruje przekazane dane**, nie woła zaplecza i
  **bezwarunkowo** pokazuje `toast.success(... 'Form saved')`, po czym zamyka
  okno. `onDelete` (`:5093-5095`) tylko zamyka okno, bez wywołania.
- Obiekt formularza przekazywany do kreatora (`:5071-5079`) jest **twardo
  wpisanym literałem** (`name: 'New Form'`, `config: { fields: [] }`,
  `is_published: false`) tworzonym **od nowa przy każdym otwarciu** — nigdy
  nie pobieranym z zaplecza.

**Skutek dla użytkownika:** konfiguruje pola, publikuje formularz, klika
Zapisz, widzi „Formularz zapisany" — a **cała konfiguracja jest wyrzucana**.
Po ponownym otwarciu widzi znowu pusty formularz domyślny; „opublikowany"
formularz **nigdy nie jest żywy**.

**To NIE jest niedokończona integracja** — komplet realnych funkcji zaplecza
**istnieje i jest nieużywany**: `src/services/api/tablePlatform.api.ts:796`
(`createForm`), `:808` (`listForms`), `:815` (`getForm`), `:822`
(`updateForm`), `:834` (`deleteForm`) — zweryfikowane bezpośrednio w pliku.
Ten sam plik woła zaplecze intensywnie w innych miejscach; zero wywołań akurat
tej rodziny funkcji z `IdeaTableTool.tsx`.

**Stan: zgłoszone, świadomie NIE naprawione** — zgodnie z zasadą „opisz, nie
naprawiaj" tego zadania dokumentacyjnego.

### 5.2 Obszary sprawdzone i CZYSTE — wynik „nie ma problemu"

Wspólne klocki Mojej Pracy (`AttachmentsSection`, `CommentsSection`,
`LinkedItemsSection`) **warunkują komunikat sukcesu wynikiem operacji**, a w
repozytorium istnieje dedykowany test regresyjny pilnujący dokładnie tej
klasy błędu:
`src/components/MyWork/shared/__tests__/MutationResult.redContract.test.tsx`
(zweryfikowano istnienie pliku). Karta zadania, karta decyzji, notatnik,
tablica i skarbiec dokumentów — wszystkie czekają na odpowiedź zaplecza przed
komunikatem sukcesu.

**Portal Partnerski: czysty.** Moduł **nie ma w ogóle mechanizmu wysyłania
plików** — nie może mieć tego konkretnego defektu. Każdy sprawdzony komunikat
sukcesu jest warunkowany realnym wywołaniem zaplecza.

### 5.3 Obserwacja (NIE defekt) — okno między komunikatem a zapisem w Decisions

`src/components/MyWork/DecisionDetailView.tsx:3582` — komunikat o
zastosowaniu zespołu RACI przez AI (`toast.success(...'aiRaciApplied'...)`)
pada **zaraz po** `setStakeholders(next)` (`:3581`), synchronicznie ze zmianą
stanu lokalnego. Realny zapis na serwer idzie **osobno, z opóźnieniem**: osobny
`useEffect` (`:2499-2507`) obserwuje `stakeholders` i po 500 ms debounce woła
`replaceDecisionStakeholdersOnServer(Api, decisionId, stakeholders)`.

Realne wywołanie zaplecza **istnieje** — to nie jest ten sam błąd co §5.1. Jest
jednak krótkie okno (do 500 ms), w którym komunikat sukcesu już padł, a zapis
na serwer jeszcze się nie wykonał — jeśli użytkownik odświeży stronę w tym
oknie, może stracić zmianę mimo widzianego komunikatu. Zapisane jako
obserwacja do dalszej obserwacji, nie jako potwierdzony defekt.

### 5.4 Wniosek — zabezpieczenie w warstwie wspólnej nie chroni przed wywołaniem, które je omija

Wspólna warstwa Mojej Pracy (`AttachmentsSection`/`CommentsSection`/
`LinkedItemsSection`) **ma zabezpieczenie i test regresyjny** (§5.2). Defekt
§5.1 siedzi w **osobnym, równoległym komponencie** (`FormBuilder` wewnątrz
`IdeaTableTool.tsx`), który tę warstwę **całkowicie omija** — buduje własny
`onSave` zamiast reużyć chroniony wzorzec. Test regresyjny warstwy wspólnej
nie mógł tego złapać, bo nigdy nie widzi tego wywołania.

To jest ta sama rodzina ryzyka co lekcja „Naprawa per-wywołanie odrasta" z
notatnika metodycznego właściciela (plik osobisty, poza tym repozytorium —
NIE cytuję ścieżki repo, bo taki plik tu nie istnieje; sprawdzono
`[ -e ... ]`) — naprawa jednego wywołania nie chroni pozostałych, jeśli nie ma
wymuszenia reużycia wzorca na poziomie code review/lint, nie tylko testu
jednego miejsca.

---

## 6. Sprzeczności nierozstrzygnięte (wymagają pomiaru/decyzji właściciela, nie zgadywania)

1. **Audyty — nazewnictwo powierzchni.** `AUDITS_CURRENT_STATE_AND_SOURCE_REGISTER.md`
   (2026-08-13) rekomendował `Library · Processes · Outputs · Reports ·
   Initiatives` (pięć nazw, zgodnie z żywym Assessment). Dzisiejszy pomiar
   (§1.1) potwierdza **sześć** zakładek w żywym kodzie: Biblioteka, Sesje,
   Wyniki, Raporty, **Ustalenia**, Inicjatywy — „Ustalenia" jako osobna
   zakładka nie figurowały w rekomendacji z sierpnia. Karta modułu
   (`AUD-OR-20260829-003`/`-004`) notuje tę samą rozbieżność jako dowód
   brakujący, nie rozwiązany w dyżurze 220. **Wymaga jednego pomiaru:** czy
   sześć zakładek to docelowy kanon, czy „Ustalenia" ma się scalić z inną
   zakładką.
2. **Moja Praca — `MYW-CV-REC-005` vs `MYW-CV-REC-008`.** Ta sama data
   (2026-08-22), ten sam ekran (otwarty sejf Vault), przeciwstawne życzenia
   dot. przycisku tworzenia folderu — jedno mówi „dodaj", drugie (zaryglowane
   regresją w kodzie) mówi „nie twórz tu folderów". Nie rozstrzygnięto które
   ma pierwszeństwo (patrz §3.2).
3. **Portal Partnerski — status earnings-summary.** Formalnie **obalone
   1.09** (§4.1), ale sześć pozostałych błędnych sekcji z pomiaru 25-sekcyjnego
   (dyżur 177) nie zostało dziś ponownie sprawdzonych — nie wiadomo, czy
   naprawa earnings-summary jest odosobniona czy częścią szerszej korekty.

---

## 7. Metodyka i pułapki tego pomiaru

- Każdy plik cytowany w tym dokumencie został sprawdzony `[ -e "$plik" ]`
  przed cytowaniem (zgodnie z instrukcją — trzy potwierdzone dziś przypadki
  cytowania nieistniejących plików w innych raportach tej fali).
- `grep --include` nie był używany w tej sesji (znana pułapka pustego wyniku
  w tej powłoce); wyszukiwania szły przez `grep -rn` bez `--include` lub przez
  potok.
- Runtime cytowany tu pochodzi z realnych pomiarów dyżurów 220-225 (realny
  Postgres, realny `ApiGateway`, `--retry=0`, `DB_TYPE=postgres`,
  `MOCK_DB=false`, `ENABLE_TEST_AUTH_BYPASS=false`) — nie z docs ani z
  wyłączonych flag. Gdzie pomiar był ograniczony do dev-render/mock-props
  (Audyty §1.4, Czat §2.1 wstępnie), zaznaczono to wprost jako dowód wizualny,
  nie dowód osiągalności produkcyjnej.
