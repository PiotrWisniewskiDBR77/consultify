# KONTROLA PO NAPRAWACH — pomiar robotnika, 09.09.2026 (20:40–23:00)

> **Uwaga o nazwie pliku.** Zlecenie kazało napisać `RAPORT_KONTROLA.md`. Ten plik
> **już powstał** równolegle na gałęzi nadzorcy (`d23f4c577b`, 21:48). Nie nadpisuję
> go — mój pomiar leży obok, a **jeden jego punkt przeczy tamtemu raportowi** (§2.2).
> Rozstrzygnięcie należy do nadzorcy.

## 0. Stanowisko

| Element | Wartość |
|---|---|
| Baza | `consultify_kontrola` — świeży zrzut stagingu (`kontrola-2056.dump`, 236 MB), Postgres 18, `consultify-pg18`, `127.0.0.1:54418`. Schemat zgodny ze stagingiem **co do sztuki**: 1817 tabel · 6031 indeksów · 16462 ograniczenia · 9 widoków; `pg_restore` 0 błędów |
| Kod | worktree `~/Developer/wt/kontrola-po-naprawach`, gałąź `mvp/kontrola-0909` z `mvp/inicjatywy-lancuch-20260907` (`afac02602f`) |
| API | port 4213, `NODE_ENV=test`, `ENABLE_V8_GLOBAL=true`, `DB_MANAGED_SCHEMA=off`, `DB_*` ze `server.env` **odstrzelone** |
| Vite | port 3231, `--mode test`, 34 flagi `VITE_*` ze stagingowego `server.env` **plus `VITE_MODULE_MEETINGS=true`** (na stagingu tej zmiennej NIE MA) |
| Konto | `james.whitfield@northwind.example` (OWNER), EN, 1440×900, motyw jasny |
| Zrzuty | `evidence/kontrola-po-naprawach-0909/` — 56 zrzutów ścieżek zapisu + 20 ekranów regresji, każdy z `.txt` |

### ★ STOP stanowiska (zdarzenie, nie wymówka)
O **21:48** równoległa sesja nadzorcy uznała tę paczkę za martwą („13 minut ciszy, zero
commitów, urwany zrzut 59 MB") i przejęła zadanie. W trakcie **skasowała mój worktree**
(został sam katalog `.vite`) **oraz zawartość bazy `consultify_kontrola`** (z 1817 tabel
zostały 4). Stan faktyczny w tamtej chwili: commit `97eff1564b` z etapu 1 **istniał**
(na gałęzi `mvp/kontrola-0909`, nie na gałęzi nadzorcy), a zrzut skończył się o **21:08**
mając **236 MB**, nie 59 MB — 59 MB to była wartość licznika w połowie kopiowania.
Stanowisko odtworzyłem z gałęzi, bazę z zachowanego zrzutu, wszystkie pomiary
poniżej **powtórzyłem po odtworzeniu**. Lekcja dla obu stron: żywotność robotnika mierzy
się `git log` **jego gałęzi** i `mtime` pliku, nie ciszą w kanale.

---

## 1. Przepływy zapisu — sedno paczki

Legenda: PASS = kliknięte w UI i potwierdzone SQL-em · FAIL = kliknięte i nie działa ·
N/A = nie da się kliknąć (powód podany).

| Moduł | Utwórz (UI) | Edytuj | Usuń | Kody API | Potwierdzenie SQL |
|---|---|---|---|---|---|
| **Inicjatywy** (ścieżka ręczna) | **PASS** | **FAIL** (§2) | N/A (brak pozycji w kebabie) | `201 POST /api/initiatives/runtime-v1/source-proposals` + `201 …/registrations`; potem `404 GET /api/initiatives/<id>` i `404 PUT` w pętli | rekord w `ie_aggregate_state`, **nie ma go w tabeli `initiatives`** |
| **Realizacja — zadanie** | **PASS** | FAIL w UI / PASS na API | FAIL w UI / PASS na API | `201 POST /api/tasks`; API: `PUT 200`, `DELETE 200`, `GET po` → `404` | `tasks` → wiersz jest, po `DELETE` znika |
| **Realizacja — decyzja** | **PASS** | PASS na API | PASS na API (miękkie) | `201 POST /api/decisions`; API: `PUT 200`, `DELETE 200` „Decision cancelled" | `decisions` → wiersz jest |
| **Realizacja — RAID** | **PASS** | N/A (nie próbowano) | N/A | `201 POST /api/initiatives/runtime-v1/initiatives/<id>/raid-items/<id>` | `raid_items` → `RISK`/`OPEN` |
| **Moja Praca — zadanie** | **PASS** | N/A | N/A (brak kebaba w wierszu) | `201 POST /api/my-work/personal-tasks` | `tasks` → wiersz jest, widoczny w Inbox |
| **Spotkania** | **PASS** | N/A | N/A | `201 POST /api/meeting`; jedno `404 GET /api/ai-operator/meetings/<id>/brief` (semantyczne: świeże spotkanie nie ma brief-u) | `meetings` → `scheduled`, lista rośnie 2 → 3 |
| **Materiały** | N/A — „New presentation" nie otwiera kreatora w tym przebiegu (zostajemy na `/presentations`) | — | — | brak zapytań zapisu | — |
| **Audyty** | **N/A z powodem** | — | — | — | „New audit" **wygaszony**, pod nim podpis „Frozen until wave 2: uploading audit assumptions and the question generator" |

**Wniosek 1: tworzenie działa wszędzie, gdzie jest czynny przycisk.** To odpowiedź na
poranny incydent: zapis inicjatywy nie kończy się już HTTP 500, tylko `201 APPLIED`.

**Wniosek 2: edycji z interfejsu praktycznie nie ma.** Kebab wiersza w Realizacji ma
tylko „Open task | Open preview" — bez „Edytuj" i bez „Usuń"; w Mojej Pracy wiersz nie
ma kebaba wcale; wpisanie opisu w ekranie-artefakcie zadania **nie wywołuje żadnego
zapytania zapisu** (kolumna `description` w bazie zostaje pusta). Na API ten sam cykl
przechodzi bezbłędnie — brakuje przewodu w UI, nie funkcji w serwerze.

---

## 2. ★ DEFEKT NOWY: edycji inicjatywy nie da się zapisać (12 z 13 rekordów)

Pełny pomiar: [`evidence/kontrola-po-naprawach-0909/zapis/POMIAR-INICJATYWY-EDYCJA.md`](../../../evidence/kontrola-po-naprawach-0909/zapis/POMIAR-INICJATYWY-EDYCJA.md).

### 2.1 Objaw
Otwarcie ekranu-artefaktu **dowolnej** inicjatywy uruchamia autozapis co 1,5 s.
Dla inicjatywy o statusie innym niż `DRAFT` każdy z nich wraca **400**:

    {"error":"Status cannot be changed via this endpoint…",
     "rule":"STATUS_TRANSITION_REQUIRES_GATE","from":"IN_EXECUTION","to":"DRAFT"}

Na ekranie stoi na stałe plakietka **„Unsaved"**, a serwer dostaje kilkadziesiąt
odrzuconych żądań na minutę. Pomiar per status:

| status | `PUT /api/initiatives/:id` |
|---|---|
| DRAFT | **200** „Initiative updated" |
| PROPOSED | **400** |
| APPROVED | **400** |
| IN_EXECUTION | **400** |

`GET /api/initiatives` zwraca 13 inicjatyw, `DRAFT` jest **jedna**.

### 2.2 To przeczy raportowi nadzorcy
Raport `RAPORT_KONTROLA.md` (21:48) mówi: „Zapis działa we wszystkich sprawdzonych
ścieżkach". Sprawdzone tam były **tworzenie** inicjatywy i pełny cykl **zadania** —
i te trzy wiersze potwierdzam co do znaku. **Edycji inicjatywy tamten pomiar nie
obejmował**, a to właśnie ona jest zepsuta. Nie jest to sprzeczność liczb, tylko
dziura w zakresie.

### 2.3 Przyczyna (dwa pliki)
1. `server/src/validators/initiative.validators.ts:70` —
   `status: InitiativeStatusEnum.optional().default('DRAFT')` w schemacie bazowym,
   z którego przez `.partial()` powstaje `UpdateInitiativeSchema`. `validateBody`
   **podmienia `req.body` na obiekt po parsowaniu**, więc brak pola `status`
   w żądaniu zamienia się w `status:'DRAFT'` w ciele widzianym przez kontroler.
   Dowód rozstrzygający: `PUT /api/initiatives/<id>` z ciałem `{"summary":"…"}`
   — jedno pole, zero statusu — zwraca to samo 400 z `to:"DRAFT"`.
2. `server/src/controllers/InitiativeController.ts:822-833` — bramka M13 widzi
   wstrzyknięty `DRAFT` i słusznie odrzuca żądanie jako niebramkowaną zmianę statusu.

Bramka jest w porządku. Do usunięcia jest `default('DRAFT')` na ścieżce **aktualizacji**.

### 2.4 Drugi defekt tej samej rodziny: dwa źródła prawdy
Nowo utworzona inicjatywa:
- **jest** w `/api/initiatives/runtime-v1/initiatives` — i stąd czyta ją lista modułu
  (sprawdzone przechwyceniem wszystkich odpowiedzi zawierających jej tytuł: to jedyna
  taka trasa);
- **nie ma** jej ani w `GET /api/initiatives`, ani w tabeli `initiatives`;
- ekran-artefaktu i autozapis wołają starą trasę → `404`.

Właściciel zobaczy więc rekord na liście, który po otwarciu jest pusty i nie da się go
zapisać.

---

## 3. Regresja 10 napraw (RAPORT_DANE §4) — na ekranie

Zrzuty: `evidence/kontrola-po-naprawach-0909/regresja/`. Na **16 ekranach: 0 błędów
konsoli, 0 odpowiedzi 4xx/5xx**.

| Id | Co miało być | Co widzę | Wynik | Zrzut |
|---|---|---|---|---|
| **D-01** | nazwa oceny zamiast `DRD · <uuid>`, SCORE i CONFIDENCE wypełnione | „Northwind 2027 — Operational Maturity Assessment", SCORE **3.0**, CONFIDENCE **72 %**, status Approved | **PASS** | `D-01-ocena-nazwa.png` |
| **D-02** | brak polskich akapitów w Bibliotece metodyk (EN) | **0** znaków diakrytycznych w całym `innerText` ekranu; w `frameworkRegistry.ts` polszczyzna została wyłącznie w komentarzach | **PASS** | `D-02-ocena-library.png` |
| **D-06** | nazwy zamiast UUID w podglądzie Mojej Pracy | „Source task: Interview: Strategic Direction Discovery", „Recipient: James Whitfield", „Organization: Northwind Manufacturing Ltd." | **PASS** (ale p. §5, defekt N-1) | `D-06-mywork-podglad.png` |
| **D-07** | blok DETAILS w osobnych wierszach | „Owner: Daniel Osei" / „Slides: 6" / „Updated: Sep 8, 2026" — trzy wiersze | **PASS** | `D-07-materialy-podglad.png` |
| **D-09** | chip mówi, co liczy | chipy Kokpitu: „Risks 8 · **To resolve 7**" | **PASS** | `D-09-execution-dashboard.png` |
| **D-10** | e-mail nie wchodzi pod kolumnę ROLE | adresy przycięte wielokropkiem w swojej kolumnie, ROLE czysta | **PASS** | `D-10-admin-members.png` |
| **D-11** | KRYTERIA i ŹRÓDŁO wypełnione | SOURCE „Northwind Operational Excellence Programme — internal audit procedure", CRITERIA **7** | **PASS** | `D-11-audyty-library.png` |
| **D-12a** | etykieta kompletności Finansów bez sklejenia | „P&L / **— BS** / **— CF**" — myślnik z odstępem | **PASS** | `D-12-finanse-completeness.png` |
| **D-12b** | *(poza zakresem naprawy)* data w Wynikach | nadal **„VII 2026"** — rzymski miesiąc, konwencja polska w interfejsie EN | **POZOSTAJE** | `D-12-format-daty.png` |
| **D-15** | ręczna ścieżka tworzenia inicjatywy | menu CTA: „**Fill in the form** — Title, axis, level and a short summary — no AI needed." obok „AI initiative wizard"; formularz zapisuje `201` | **PASS** | `D-15-inicjatywy-menu.png` |
| **D-08** | premisa obalona (backlog/przeciążenie) | „utilisation **46 %**", „backlog **169 h across 6 people**" — kolumna działa, liczby się zgadzają | **premisa nadal obalona** | `D-08-execution-resources.png` |
| **D-17** | premisa obalona (plakietki deweloperskie) | „3 V9 overrides" i „LOCAL @996d9145910b" widoczne — **ale to serwer deweloperski Vite**, dokładnie ten przypadek, który opisuje POMIAR D-17. Produkcyjnego buildu na tym stanowisku nie mierzyłem → **N/A dla stagingu** | **premisa nadal obalona / N/A** | `D-17-v9-overrides.png` |

---

## 4. Dane po dosiewie D9 (5 pozycji z RAPORT_DANE §5)

| # | Pozycja | Na ekranie | Wynik |
|---|---|---|---|
| 1 | Organizacja — profil 13/13 | chipy „All 13 · Filled in 13 · To fill in 0", panel DATA STATE **13/13**, INDUSTRY = **„Manufacturing"** (nie „—") | **PASS** |
| 2 | Wywiad → Inbox ≥1 przydział | Inbox: „All **3** · Answered 1 · Approved 1 · Sent back 0", trzy wiersze zamiast „No assignments" | **PASS** |
| 3 | Wyniki → migawka przeglądu bez 404 | `GET /api/vnext/results/kpi/scorecards/<id>/review-snapshots/published` → **200** ze snapshotem (`reviewPeriodStart 2026-07-01`). To była jedyna odpowiedź 4xx całego testu TEST-DANE | **PASS** |
| 4 | Realizacja → Resources | pasek: „people 9 · demand **1230.4 h** · utilisation **46 %** · backlog **169 h across 6 people**" | **PASS** |
| 5 | Kolumny pochodne (FORMAT · SOURCE · LEVEL · VARIANCE · AREA) | pstryczek kolumn Materiałów włącza obie ukryte kolumny (`defaultVisible:false` — potwierdzone). **FORMAT: 7/7** (XLSX/PPTX/DOCX). **SOURCE: 2/7** („Tool" przy dwóch prezentacjach), pięć wierszy ma „—". AREA w inicjatywach 13/13, axis 13/13 (API) | **CZĘŚCIOWY FAIL** |

**Sprostowanie premisy D9:** README dosiewu podaje „FORMAT i SOURCE 7/7 z tej samej
trasy, z której czyta lista". **Na liście SOURCE jest wypełniony w 2 z 7 wierszy.**
Nie kwestionuję liczby z API — mówię, co widać w kolumnie, którą właściciel włączy.

---

## 5. Defekty nowe (znalezione dzisiaj, nieopisane wcześniej)

| Id | Ekran | Co widać | Waga |
|---|---|---|---|
| **N-1** | Moja Praca → podgląd (pierwszy ekran modułu) | Blok DETAILS renderuje **surowy JSON** wystający poza panel: `{"type":"interview_assignment","assignmentId":"ia_e8453658-59e6-4471-bdd5-f6605c730df2","templateId":"v6_t03_strategic_direction_discovery"}`. Wchodzi z pozycji skrzynki utworzonych dosiewem D9 | **wysoka** — to pierwsze, co właściciel zobaczy w Mojej Pracy |
| **N-2** | Inicjatywy → ekran-artefakt | Autozapis w pętli `400`/`404` co 1,5 s i stała plakietka „Unsaved" (§2) | **blokująca** |
| **N-3** | Realizacja → Work, Moja Praca → Tasks | Kebab wiersza bez „Edytuj" i „Usuń" (Realizacja: tylko „Open task \| Open preview"); w Mojej Pracy wiersz nie ma kebaba | **średnia** |
| **N-4** | Materiały | „New presentation" nie otworzyło kreatora w tym przebiegu — zostajemy na `/presentations`, zero zapytań zapisu | **do potwierdzenia** (jeden przebieg, może być pułapka przyrządu) |

## 6. Defekty pozostałe z listy RAPORT_DANE (nietknięte, świadomie)
D-12b „VII 2026" · D-13 podpowiedź „piotr-wisniewski-123" w Ustawieniach · D-14 „DBR77
Consultify" w Partnerach · D-18 wąskie kolumny · D-19 crimson przy poradzie w kreatorze
· D-20 `t('sidebar.results','Wyniki')` (utajone — klucz EN istnieje, więc na ekranie
jest „Results").

## 7. Konfiguracja produktu po incydencie — kopia vs staging vs demo

| Kontrola | kopia | staging | demo | manifest czystki |
|---|--:|--:|--:|--:|
| `ie_governance_policies ('*','PRODUCT','DEFAULT')` ACTIVE | **1** | **1** | **1** | 1 |
| `document_studio_templates` `__system__` | **44** | **44** | **44** | 44 |
| `v8_output_artifacts` `__system__` | **24** | **24** | **24** | 24 |
| `v8_artifact_origin_links` `__system__` | **24** | **24** | **24** | 24 |
| `security_policies` `__global__` | **4** | **4** | **4** | 4 |
| `knowledge_doc_versions` z pustą organizacją | **222** | **222** | **222** | 222 |
| **razem** | **319** | **319** | **319** | **319** |

Pomiar powtórzony **po** czystce 22 klonów sesji demo z 21:48 — liczby się nie ruszyły,
czyli bezpiecznik `predykatSieroty` z `ac3354f3ff` zadziałał i poranny incydent się nie
powtórzył.

**Organizacje:** demo **4** (docelowe). Staging **8** — te same 4 plus 4 rejestracje
testerów z 09.09 (`TT22TT` ×3, `My Company`). Zgodne z meldunkiem nadzorcy.
*(Mój pomiar z 21:00, przed jego czystką, pokazywał na stagingu 30 organizacji, w tym
22 klony `ateliertoys-demo-session-*`; demo już wtedy miało 4.)*

## 8. Konsola i sieć

| Przebieg | Ekrany | Błędy konsoli | 5xx | 4xx |
|---|--:|--:|--:|---|
| Regresja 10 napraw + dosiew | 16 | **0** | **0** | **0** |
| Ścieżki zapisu: Realizacja, Moja Praca, Materiały, Audyty | ~20 | **0** | **0** | **0** |
| Ścieżka zapisu: Spotkania | 5 | 1 | 0 | `404 GET /api/ai-operator/meetings/<id>/brief` — semantyczne (świeże spotkanie nie ma jeszcze brief-u), ale wypada do konsoli |
| Ścieżka zapisu: Inicjatywy (ekran-artefakt) | 6 | **15** | 0 | `404 GET /api/initiatives/<id>` · `404 GET /api/v8/planning/initiatives/<id>` · `404 GET /api/my-work/object-attachments/initiative/<id>` · `404 PUT /api/initiatives/<id>` ×4 — **wszystkie z defektu N-2**; sama lista `/initiatives?tab=list` ma 0/0 |

## 9. WERDYKT

> **Właściciel może jutro rano przejść system i pokazać go — pod jednym warunkiem: że
> nie otworzy żadnej inicjatywy.** Wszystko, co się liczyło w tej kontroli, jest na
> miejscu: tworzy się inicjatywę, zadanie, decyzję, pozycję RAID, zadanie osobiste
> i spotkanie; każdy z tych rekordów jest w bazie i na liście; konfiguracja produktu
> wróciła w komplecie 319/319 na obu środowiskach i przetrwała wieczorną czystkę; dane
> po dosiewie widać na ekranie; 16 ekranów przeszło bez jednego błędu konsoli i bez
> jednej odpowiedzi 4xx. **Na przeszkodzie stoi jedna rzecz i trzeba ją nazwać wprost:
> otwarcie ekranu inicjatywy uruchamia autozapis, który wali się co półtorej sekundy
> (`400` dla 12 z 13 inicjatyw, `404` dla świeżo utworzonej) i zostawia na widoku stałą
> plakietkę „Unsaved" — czyli produkt na oczach klienta mówi, że nie umie zapisać.**
> Naprawa jest jednowierszowa: zdjąć `default('DRAFT')` ze statusu na ścieżce
> aktualizacji (`initiative.validators.ts:70`). Drugi w kolejności do zamknięcia przed
> pokazem jest surowy JSON w podglądzie Mojej Pracy (N-1) — to pierwszy ekran po
> zalogowaniu.
