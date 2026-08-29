# CODEX DAY 127 — język Czatu i Partnera

Data: 2026-08-29  
Gałąź: `codex/day127-jezyk-czat-partner-20260829`  
Marker: `714faf5f8b0d9cda8204fec9495893c9fe97bed7`  
Commit naprawy: `4d94f4b8bc4d913c018b81547cdb7ffd84b1eb81`

## Werdykt

`PARTIAL / RDZEŃ KODOWY ZROBIONY / ZRZUTY BLOCKED_BY_CONFIRMATION`.

Teza „Czat i Partner są w 100% angielskie” została obalona pomiarem źródeł: dla użytych statycznych kluczy `t()` nie znaleziono ani jednego przypadku EN bez PL (`Czat 0/2088`, `Partner 0/339`). W szczególności istnieją polskie wartości `Nowa rozmowa`, `Archiwum` i `Ważne sygnały`. Potwierdzono natomiast punktową klasę B/D: surowe `Rich/DOC/MD`, żargon Partnera, kod `AMD-PRT-ECONOMICS-002` w fallbacku oraz techniczny identyfikator certyfikatu na ekranie.

## Wejście i tożsamość

`git log --oneline -25 github-backup/codex/m03-admin-20260824` zaczynał się od:

```text
6144dae333 docs(day125-129): FALA PRZEKROJOWA — jedna wada, wszystkie moduly naraz
714faf5f8b merge: dyzur 121 — karta zbudowana za flaga OFF; endpoint nie propaguje checklisty
```

Weryfikacja markera:

```text
MARKER OK
```

Sanity worktree:

```text
714faf5f8b0d9cda8204fec9495893c9fe97bed7
```

Tip uciekł o jeden commit dokumentacyjny. `git diff --name-only marker..tip` wskazał wyłącznie pięć instrukcji dyżurów 125–129. Zgodnie z `DEC-2026-08-26-95` praca rozpoczęła się dokładnie z markera.

Warunki STOP: `/` miał `69 GiB` wolne; porty `6010`, `4920`, `4921` były wolne; worktree i gałąź nie istniały.

## Baza i runtime

- kontener: `cx-day127-pg`, obraz `pgvector/pgvector:pg16`, publikacja tylko `127.0.0.1:6010`;
- baza: `consultify_w3_chat_owner_day127`;
- pierwszy przebieg migracji: `Postgres migrations complete`;
- drugi przebieg: `Applying migrations: 0`, `Postgres migrations complete`;
- runtime kanoniczny: serwer `4920`, klient `4921`, health/ready/frontend `200/200/200`;
- manifest runtime: 863 migracje, SHA serwera i klienta zgodne z markerem, `prohibitedKeysAbsentInOwnedGroupProcesses=true`.

## Protokół Z30

```text
BRAK ZMIENNYCH POCZTY
settings WHERE key LIKE 'smtp%': (0 rows)
Gateway.ts: 0 trafień dla startNotificationOutboxDrainCron|outboxWorker|platformOutboxDrainCron
```

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu poza kanonicznym runtime'em uruchomionym wyłącznie do odczytu i próby zrzutów. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## B.1 — własny mianownik

Komenda klasy A parsowała wszystkie statyczne wywołania `t('klucz')` w plikach `.ts/.tsx` modułu, deduplikowała klucz i porównywała zagnieżdżone wartości EN/PL.

| Moduł | Użyte klucze | A: EN istnieje, PL brak | B: kandydaci literalnego JSX | C: kandydaci surowych etykiet serwera | D: kandydaci słownika żargonu |
| --- | ---: | ---: | ---: | ---: | ---: |
| Czat | 2088 | 0 | 109 | 15 | 39 |
| Partner | 339 | 0 | 38 | 18 | 34 |

Kolumny B–D są pełnym statycznym mianownikiem kandydatów z grepu, a nie twierdzeniem o ich widoczności w każdym stanie runtime. Każdy kandydat wymaga oceny semantycznej; nie zawyżam ich jako potwierdzonych wad.

## B.2/B.3 — zmiana

Przed → po:

- `Rich / DOC / MD` → `Edytor / Dokument / Markdown` w PL oraz `Editor / Document / Markdown` w EN;
- `Canvas view` → `Widok dokumentu` w PL;
- `Governed Partner runtime` → `Current partner programme status` / `Aktualny stan programu partnerskiego`;
- fallback z `AMD-PRT-ECONOMICS-002` → zwykłe wyjaśnienie niedostępności operacji finansowych;
- `ID: W3-PARTNER-CERT-001` → identyfikator usunięty z widoku partnera;
- `Issued`, `Valid until`, komunikat braku certyfikatu → klucze PL+EN.

Nie zmieniono istniejących wartości tłumaczeń; do JSON dopisano nowe wartości. Nie dotknięto kontraktów kart N.

## Dowód mutacyjny w obie strony

Komenda w obu kierunkach:

```bash
RUN_DB_TESTS=0 MOCK_DB=true npx vitest run \
  src/components/AIChat/__tests__/CanvasViewModeControl.ownerBehavior.test.tsx \
  src/components/AIChat/__tests__/WorkCanvasDocumentPanel.ownerFeedback.test.ts \
  tests/components/partner/EarningsSection.policy-gated.test.tsx \
  tests/components/partner/PartnerPortalView.dead-code-removal.test.tsx \
  --retry=0 --reporter=json --outputFile=<artefakt>
```

- po celowym przywróceniu trzech wad: `5/13 FAIL`, exit `1`;
- po odtworzeniu naprawy z kopii: `13/13 PASS`, exit `0`;
- trzy `diff -u` kopia-naprawa → plik po odtworzeniu: puste;
- delta pełnych nazw między zielonymi przebiegami: `0/13`.

Pułapki Z33: pakiet jest czysto komponentowy, nie montuje `ApiGateway`, nie dotyka DB, nie testuje auth ani bramki V8; uruchomiono `RUN_DB_TESTS=0 MOCK_DB=true`. Pułapki (a)–(d) nie leżą na ścieżce. Pułapkę (e) wyłączono kontraktami źródłowymi komponentów rzeczywiście importowanych przez `WorkCanvasDocumentPanel` i `PartnerPortalView`.

## Regresja i jakość

- końcowy focused: `4/4` pliki, `13/13 PASS`, `--retry=0`;
- `git diff --check`: PASS;
- JSON EN i PL: parse PASS;
- pre-commit ratchety: PASS, bez nowych naruszeń;
- `npm run type-check`: `FAIL` na dwóch zastanych błędach: `src/components/billing/UsageMeters.tsx:174` (`t` niezdefiniowane) oraz `src/views/partner/sections/EarningsSection.tsx:448` (porównanie z niemożliwym `certified`). Druga linia jest identyczna w `HEAD`; nie naprawiono jej poza zakresem.

## Artefakty i SHA-256

```text
f4d8ee601cb0ee63158d8778f7b23aaaa7062d645ed98c27a39cc60c91d322aa  day127-focused-mutation-red.json
e6cede2f00d7dddf7ae509e714d0fa2fd591aab1b70f7d129c03fcd836cb5bdf  day127-final-focused-green.json
c8a1abb680e1ab48636471fc19973066fa68c93efd5b5a08838e4d71f6c1e532  consultify-wave3-runtime-manifest-day127.json
6e683585f1f41b961a0d13dd071078e0aecc8769953bfac7740de7a444b89125  cx-day127-chat-manifest.json
3cf5a7d371a4570827a47168272ebf9f008424f528cdaa54dba161d6021512ae  cx-day127-partner-manifest.json
```

## Korekty wobec instrukcji

1. Teza §A o `100%` angielskim interfejsie nie zgadza się ze statycznym pomiarem kluczy: klasa A wynosi `0/2088` i `0/339`; istnieją polskie wartości przykładów z instrukcji. To wynik, nie powód do STOP.
2. Instrukcja odwołuje się do `BLOKU 0`, `§0.4a` i „tabeli licencji”, lecz dokument nie zawiera tych sekcji/tabeli. Zastosowano bezpieczniejszą interpretację §D; zasięg testów zmierzono pełnymi nazwami dla wszystkich czterech bezpośrednio dotkniętych pakietów.
3. Nagłówki B.3 i B.4 występują podwójnie, a wymaganie zrzutów brzmi jednocześnie „4 po zmianach” i „4 przed i po”. Nie zawężono obowiązku; zrzuty pozostają jawnie niewykonane.

## Zrzuty

`0/4 — BLOCKED_BY_CONFIRMATION`. Kanoniczny runtime został uruchomiony i ekran logowania odczytany, ale wykonanie loginu fixture w sterowanej przeglądarce wymaga wpisania lokalnego hasła/PIN-u. Polityka narzędzia wymaga potwierdzenia użytkownika bezpośrednio przed wpisaniem danych uwierzytelniających. Nie obchodzono tej bramki przez testowy auth bypass, localStorage ani atrapę ekranu.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano wzrokiem `4/4` wymaganych stanów i motywów; K5 pozostaje `NOT_PROVEN`.
- Nie udowodniono, że wszystkie statyczne kandydaty B–D są osiągalne w kanonicznym runtime; podano mianownik kandydatów, nie fałszywy mianownik widocznych wad.
- Nie wykonano pełnej suity repo; porównanie nazw obejmuje 13 bezpośrednio dotkniętych testów.
- Pełny type-check nie jest zielony z powodu dwóch nazwanych błędów zastanych.
- Nie ma formalnej akceptacji właściciela ani dowodu deploymentu.

## Stan kryteriów

| Kryterium | Stan |
| --- | --- |
| K1 | PASS dla punktowych klas B/D; teza klasy A obalona |
| K2 | PASS — tylko pliki §D, testy i raport |
| K3 | PASS — 5/13 RED → 13/13 GREEN |
| K4 | PASS w pakiecie wpływu — delta nazw 0/13 |
| K5 | NOT_PROVEN — 0/4 zrzutów |
| K6 | PASS — sekcja niepusta |
| K7 | PASS — brak zmian `*CardContract*` i rendererów kart N |

