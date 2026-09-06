# Raport zarządczy — `management-report`

**Status:** PROPOZYCJA — do słowa właściciela. Karta #62 inwentarza, moduł `11_MATERIALS`.
Klasyfikacja wg testu z `_wzorzec-raport-dokument.md`: **rekord ISTNIEJE po stronie serwera**
(`GET /api/management-reports/:id` realnie zwraca zapisany raport), ale **frontend nie wystawia
tej tożsamości jako trasy** — luka jest we froncie, nie w backendzie (inaczej niż `template`/
`template-architect-*`, gdzie identyfikatora nie ma nigdzie).

## §0. Tożsamość

- Nazwa PL: **Raport zarządczy** — PMO (ISO 21500, PMBOK 7, PRINCE2), dwa typy: Team Meeting
  (Checkpoint), Steering Committee (Highlight) — komentarz nagłówkowy pliku.
- Moduł: `11_MATERIALS`. Archetyp: nominalnie **B**, faktycznie ekran wielostanowy bez trasy
  per-rekord.
- Otwarcie: `/reports/management` (brak dopasowania w `AppRoutes.tsx` dla żadnej trasy
  `reports/management*` — potwierdzone grepem, zero trafień) → wewnątrz komponentu wiersz z
  historii wywołuje `handleViewReport(reportId)` (`:269-279`), które robi
  `GET /api/management-reports/${reportId}` i USTAWIA `viewMode='preview'` — **zero zmiany URL**.
  Zamknięcie karty (odświeżenie strony) gubi, KTÓRY raport był otwarty.
- Komponent: `src/components/Reports/Management/ManagementReportsView.tsx:1` (685 linii).
  Powłoka: żadna ze standardu (zero `ArtifactRightPanel`/`ExecutiveModuleShell`/`NModeShell` —
  potwierdzone grepem). Stan ekranu to `viewMode: 'selector'|'preview'|tab...`
  (`ViewModeExtended`, `:79`), nie routing.
- **Serwer MA prawdziwą tożsamość rekordu**: `GET /api/management-reports/:id` (`:273`),
  `POST /api/management-reports/:id/share` (`:261`), `GET /api/management-reports/:id/pdf`
  (`:249`), `GET /api/management-reports/:id/pptx` (`:255`) — cztery różne operacje po id, więc
  backend traktuje raport jako pełnoprawny obiekt z adresem. Front go po prostu nie eksponuje.

## §1. Sekcje

Treść budują podkomponenty wg typu raportu: `PortfolioHealthReport`, `RaidReport` (importy
`:26-27`) — różne dla Team Meeting/Steering Committee. Brak katalogu `KanonicznaKarta` (K1 nie
spełnione).

## §2. Prawy panel — nie istnieje w ogóle

Zero odpowiednika `ArtifactRightPanel`/Akcji/Właściwości/Powiązań/Źródeł/Komentarzy/Historii w
przeglądzie pliku. Akcje (Pobierz PDF/PPTX, Udostępnij) są przyciskami w nagłówku ekranu, nie w
panelu bocznym.

## §3. Menu 5 i nawigacja

Brak. Nawigacja to zakładki wewnętrzne (`ReportTypeSelector`, `ReportHistoryTable`,
`ReportScheduleView`, `ReportTemplatesView` — importy `:29-34`), przełączane przez `viewMode`,
nie przez trasy.

## §4. AI

Brak `PracujZAI`. Import `Sparkles`/`Wand2` (`:16,18`) sugeruje jakiś przycisk generowania z AI w
nagłówku (`Api.post('/api/management-reports/generate', ...)`, `:176`) — to jest GENERATOR
(jednorazowe tworzenie nowego raportu z parametrów), nie kanoniczne „Analizuj z AI"/„Uzupełnij
sekcję" na gotowym obiekcie. `management_report`/`management-report` poza
`cardAnalysisRubric.ts`/`registry.ts` (K21 nie spełnione, K24 nie spełnione).

## §5. Czytelność

Nie zmierzone szczegółowo w tej partii (brak zrzutu, brak czasu na pełny przegląd 685 linii pod
kątem `primary-[0-9]`/i18n).

## §6. Stan zastany vs kontrakt (K1–K30)

| K | wynik | dowód |
|---|---|---|
| K1 kontrakt sekcji | nie spełnione | brak |
| K6–K11 prawy panel kanonu | nie spełnione, całość | zero `ArtifactRightPanel` |
| K12 Menu 5 | nie spełnione | zakładki wewnętrzne zamiast trasy |
| K21 Pracuj z AI | nie spełnione | generator jednorazowy, nie kanon |
| K24 AI per typ | nie spełnione | brak wpisu |
| Tożsamość rekordu (backend) | **spełnione** | `GET/POST /api/management-reports/:id*` — cztery operacje po id |
| Tożsamość rekordu (frontend, trasa) | **nie spełnione** | `viewMode` lokalny, brak `useParams`/`useSearchParams` dla `reportId` |
| K30 zrzut żywy | brak | nie zmierzone w tej partii |

## §7. Luki → naprawa

1. **Wystawić tożsamość rekordu we froncie** — najprostsza, najbardziej wartościowa naprawa tej
   karty: zamiast `viewMode`/`currentReport` w stanie lokalnym, dodać trasę
   `/reports/management/:reportId` i czytać `reportId` z `useParams`, żeby `handleViewReport`
   robił `navigate()` zamiast tylko `setViewMode`. To NIE wymaga zmian backendu (endpoint już
   istnieje) — czysto frontendowa naprawa. Rozmiar M, Sonnet.
2. **Prawy panel kanonu** — po naprawie pkt 1 (jest sens dodawać `ArtifactRightPanel` dopiero
   gdy karta ma własny adres do otwarcia). Rozmiar M, Sonnet, po pkt 1.
3. **AI** — do decyzji właściciela, czy generator (`Api.post('/generate')`) ma zostać
   generatorem, czy dokleić kanoniczne „Pracuj z AI" na już wygenerowanym raporcie. Rozmiar L,
   Opus, po decyzji.

Otwarta kwestia: brak zrzutu żywego (K30) i pełnego przeglądu czytelności (K17/K25) — priorytet
partii poszedł do dokumentu/prezentacji/arkusza/sejfu. Przepis: naprawić pkt 1 najpierw (bez tego
nie ma czego zrzucać jako „karty" — dziś to stan przeglądarki, nie adres).
