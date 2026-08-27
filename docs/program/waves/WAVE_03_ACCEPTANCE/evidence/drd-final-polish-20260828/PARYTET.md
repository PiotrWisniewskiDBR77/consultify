# DRD report — final polish (4 wady) — dowód końcowy

Data: 2026-08-27 (środowisko: worktree `fix/drd-report-final-polish-20260828`,
bazowany na `codex/m03-admin-20260824`, tip `87e7cecf3a`). Zero push, zero
kontaktu z Railway/demo/staging.

## Commity (jeden per wada)

| Wada | SHA | Plik(i) |
|---|---|---|
| W1 — metryczka okładki | `020b1cb218` | `assessmentReportContractService.ts`, `assessmentDrdReportSchemaService.ts` |
| W2 — sygnatura sesji | `3681e7b6d7` | `assessmentDrdReportSchemaService.ts` |
| W3 — data wydania (PL) | `cd6c2c976d` | `documentDocxRenderer.ts` |
| W4 — limity linii decyzyjnej (7 tabel osi) | `c9bfe34032` | `assessmentDrdReportSchemaService.ts` |

## W1 — skąd realnie wzięte każde z pięciu pól

Zweryfikowane na własnej bazie PostgreSQL 16 (Docker, port 5681) po
`scripts/seed-demo-drd-metalpol.ts --apply` (dzień 36):

| Pole | Źródło | Wartość po seedzie |
|---|---|---|
| Profil działalności | `organizations.industry` | „Obróbka i przetwórstwo metali · komponenty dla motoryzacji” |
| Zatrudnienie | regex na `projects.description` (jedyne miejsce, gdzie seed dnia 36 zapisuje liczbę zatrudnionych — opisowo: „[demo-seed] Zakład Ostrów Wielkopolski; zatrudnienie 214.”) | „214 osób” |
| Okres oceny | `MIN/MAX(method_events.occurred_at)` dla `type='ANSWER_CONFIRMED'` tej sesji (realny zakres prac, nie znaczniki księgowe sesji/outputu), sformatowane `Intl.DateTimeFormat('pl-PL')` | „27 sierpnia 2026” (seed zapisał wszystkie 23 odpowiedzi w jednej chwili, więc zakres skleja się do jednego dnia — to uczciwy odczyt danych, nie usterka) |
| Oceniający | `users.first_name`+`users.last_name` właściciela sesji (`method_sessions.owner_user_id`); seed dnia 36 NIE ustawia tych kolumn, więc kod spada na `users.email` | „anna.kowalczyk@demo-seed.invalid” |
| Sponsor po stronie klienta | **brak źródła w schemacie** — sprawdzone: `method_session_roles` (`METHOD_PROCESS_ROLES` = owner/lead_assessor/assessor/respondent/evidence_owner/reviewer/approver/observer, brak roli „sponsor”), `projects`, `organizations` — żadna tabela nie niesie pola sponsora | pozostaje uczciwy placeholder „Do uzupełnienia — dane nie są zapisane w sesji oceny.” |

Dowód ilościowy (regex `Do uzupełnienia` w `word/document.xml`, licznik surowy
bez sklejania runów XML spacją): **5 → 1** wystąpień na okładce (przed/po tymi
czterema wadami, na tych samych danych Metalpol). Jedyne pozostałe
wystąpienie to Sponsor — zgodnie z ustaleniem powyżej.

## W2 — sygnatura sesji

`buildSessionSignature()` w `assessmentDrdReportSchemaService.ts`: wzorzec
`DRD-YYYY-MMDD-XXX`, gdzie data pochodzi z `contract.generatedAt`, a `XXX` to
3-literowy szkielet spółgłoskowy nazwy klienta (po odcięciu polskich form
prawnych: „Sp. z o.o.”, „S.A.” itd.). Na zaseedowanej sesji Metalpol:
`DRD-2026-0827-MTL` (wzorzec ręcznie dobrał `DRD-2026-0817-MTP` — inna data,
bo to fikcyjna data w danych demo, i nieco inny skrót, bo nasz jest
wyprowadzony algorytmicznie, nie ręcznie). Surowy UUID sesji
(`demo-metalpol-session`) nie pojawia się już nigdzie w wyrenderowanym DOCX —
zostaje wyłącznie w wewnętrznym polu `documentId`, które nie jest drukowane.

## W3 — data wydania

`DRD_ISSUED_DATE_FORMAT` (`Intl.DateTimeFormat('pl-PL', {day, month: 'long',
year})`), użyty wyłącznie w `renderDrdCoverBlock()` (jedyny wywołujący już
bramkuje przez `isDrdReportProfile`). Efekt: „27 sierpnia 2026” zamiast
„2026-08-27”.

## W4 — limity linii decyzyjnej

Wszystkie 8 tabel „LINIA DECYZYJNA” (7 per-oś + 1 programowa) używają teraz
tego samego `CONTRACT_V1_MISSING_SLOT_LIMITS.decisionLineField` (10–30 słów).
Wizualnie potwierdzone na stronach 4, 10 i 16 renderu (osie 1, 4, 7) — wszystkie
4 komórki każdej tabeli pokazują „Sekcja do uzupełnienia — limit 10–30 słów.”
zamiast błędnego „limit 180–260 słów.”.

## Niezmienność legacy (dokumenty spoza profilu DRD)

`server/src/services/documentStudio/__tests__/day32.rendererParity.test.ts`
— 5/5 zielone, w tym dwa bogate schematy legacy (PL i EN) pinowane przez
`toMatchFileSnapshot` na `word/document.xml`, `word/styles.xml`,
`word/numbering.xml`. `git status --porcelain` na katalogu `fixtures/` po
uruchomieniu testów: **pusty** — żaden fixture nie został nadpisany, czyli
treść renderowana teraz jest bajt-w-bajt identyczna z treścią sprzed tych
czterech napraw.

SHA256 fixture'ów (dla śladu, niezmienione względem HEAD sprzed prac):

```
61e499a33e2120486e83ae48b48e3719a0686e595b1e65f20f9f1df05ef39486  day32.legacy.document.xml
5710987429287cb39d3d2a1e4f1f31ee110ddbc6a15756270333f3d991676f00  day32.legacy.styles.xml
4f5aa81f73d89b1aeaef6a7bfe3d5834cc48b76cc829c687dd01ff79a34737c0  day34-rich-pl.document.xml
a5af8365ff8ccc6f1e8f191a2faa2e3776f48e608912085167fcff1e020308da  day34-rich-pl.styles.xml
1807eaa3eeda4104ec059cf491de9f646a519c16fb9d1294ce0c67f61179d250  day34-rich-pl.numbering.xml
af0310084828567f998b24e706dd7ab246f452fb33070f0dacab0972748ef757  day34-rich-en.document.xml
3e45b8537c4931afa9cd5d9c36ee6d77d1a3b667543fac008cfc739fa529640b  day34-rich-en.styles.xml
1807eaa3eeda4104ec059cf491de9f646a519c16fb9d1294ce0c67f61179d250  day34-rich-en.numbering.xml
```

## Realna trasa użyta do wygenerowania dowodu

`GET /api/method/sessions/demo-metalpol-session/assessment-report.docx`
(supertest przeciw realnemu Express routerowi z `method-core.routes.ts`, JWT
podpisany realnym `config.JWT_SECRET`) — NIE wywołanie funkcji na skróty.

- `.docx`: `RAPORT_DRD_METALPOL.docx` — SHA256
  `1563fda03997ca432b3251d6db29190b58614bf74ce51780f71fe991eec59c16`
- `.pdf` (LibreOffice 26.2.4.2, lokalnie): `RAPORT_DRD_METALPOL.pdf` — SHA256
  `eef157d7c47343bf47a77ad4b3fb0b77f1480323fd39acef3524e0a9cb606da7`
- PNG: `png/page-01.png` … `png-19.png` (pdftoppm -r 100), wszystkie 19 stron
  obejrzane osobiście.

## Strony: nasz vs wzorzec

- Nasz render: **19 stron**
- Wzorzec (`docs/program/waves/WAVE_03_ACCEPTANCE/prototypes/golden-drd-report/RAPORT_DRD_METALPOL_WZORZEC.pdf`,
  gałąź `codex/golden-drd-report-20260827`): **29 stron**

Różnica jest oczekiwana i NIE jest wadą tych czterech napraw: wzorzec to
ręcznie napisany dokument z pełną prozą narracyjną w każdej sekcji; nasz
render z realnych danych Metalpol ma tylko 23/39 obszarów ocenionych
(pozostałe świadomie pominięte kodami skip z dnia 36) i żadna z sekcji
narracyjnych (streszczenie, komentarze obszarów, wnioski rozdziałów,
wnioski końcowe, linia decyzyjna) nie jest jeszcze generowana treściowo —
generowanie narracji jest osobnym, niezaadresowanym w tym zadaniu etapem.

## Odsetek placeholderów przed/po (na tych samych danych Metalpol)

Mierzone na `word/document.xml` dwóch renderów tej samej zaseedowanej sesji:
jeden wygenerowany kodem sprzed tych 4 napraw (`87e7cecf3a`), drugi — po.

| Metryka | Przed | Po |
|---|---|---|
| Placeholdery okładki („Do uzupełnienia…”) | 5 | 1 |
| Placeholdery narracyjne („Sekcja do uzupełnienia — limit N–M słów.”) | 56 | 56 (bez zmiany liczby — W4 zmienia tylko liczby w istniejących komórkach, nie dodaje/usuwa komórek) |
| Udział słów-placeholderów w całości | 12,10% | 12,19% (marginalny wzrost — nowe realne dane w metryczce są krótkie, więc udział placeholderów w mianowniku lekko rośnie mimo że okładka ma teraz mniej pustych pól) |

Placeholdery narracyjne (56) to osobny, nieadresowany w tym zadaniu problem —
dotyczą treści merytorycznej (streszczenie, komentarze obszarów, wnioski),
którą generuje inny etap programu (Teresa / generowanie treści), nie
mechanika renderera naprawiana tutaj.

## Weryfikacja werdyktu

Wszystkie 19 stron obejrzane (`Read` na PNG, nie tylko `grep` na XML).
Cover (`page-01.png`) potwierdza wszystkie 4 poprawki jednocześnie: profil
działalności, zatrudnienie i okres oceny wypełnione realnymi danymi,
oceniający pokazuje realny e-mail (uczciwy fallback), sponsor pozostaje
jawnym placeholderem, sygnatura sesji jest czytelna (`DRD-2026-0827-MTL`),
data wydania w polskim formacie długim. Strony 4/10/16 (osie 1/4/7)
potwierdzają limit 10–30 słów we wszystkich tabelach linii decyzyjnej.
