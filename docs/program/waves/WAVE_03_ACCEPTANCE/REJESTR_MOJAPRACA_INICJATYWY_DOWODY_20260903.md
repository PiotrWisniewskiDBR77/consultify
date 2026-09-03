# Rejestr dowodów — Moja Praca i Inicjatywy — dyżur 295

Stan: pomiar własny na markerze `58ef0771d7`; `UNKNOWN` oznacza brak dowodu, nie wynik pozytywny.

## R1 — stan wejściowy

| Obszar | Wynik pomiaru | Dowód |
|---|---|---|
| Cztery narzędzia Idei | Tablica 4916 linii; Proces 4415; Tabela 5325; mapa myśli jest montowana przez `IdeaMapWorkspace.tsx`, a nie osobny `Idea*Tool.tsx` | `wc -l src/components/MyWork/Idea*Tool.tsx`; `src/components/MyWork/IdeaMapWorkspace.tsx:325` |
| Mianownik kontrolek DOM | `NOT_PROVEN` — pomiar dwóch przejść jest zadaniem R2; sama liczba elementów JSX nie jest mianownikiem DOM | pakiet R2 |
| Trasa 409 | `PUT /api/v8/notebook/pages/:noteId/content`; ciało zawiera `code=P07_CONCURRENT_EDIT_CONFLICT`, `yourVersion`, `serverVersion` | `server/src/routes/v8/notebook.routes.ts:420`, `:487-497`, `:549-559` |
| Realny wyścig | 3/3 PASS: trzykrotnie dokładnie jeden 200 i jeden 409; izolacja ownera i tenant | `/private/tmp/cx-day295-mojapraca-inicjatywy-artefakty/conflict-realpg.json` |
| UI konfliktu przed zmianą | Banner trwały, `Odśwież` i `Zapisz mimo to`; brak `Porównaj` | `src/components/MyWork/NotebookContent.tsx:3729-3763` przed zmianą |
| Dowód wizualny Idei przed R4 | tylko katalog `116-idee-notatnik` i `idee-podpowiedz-pasek-20260903.md`; komplet 4×8 nie istnieje | `ls evidence/grafika | grep -iE "idea|idee"` |
| Rekord Inicjatywy | każdy rekord idzie do `InitiativeDocumentView`; test kanonu 6/6 | `tests/unit/initiatives/initiativeRecordCanon.test.ts` |

## Inicjatywy — lista czekowania B

Pomiar kodowy R1; punkty wymagające działania w przeglądarce pozostają `NOT_PROVEN` do R5.

| Punkty | Stan | Dowód / rozjazd |
|---|---|---|
| 1–7 Menu | `PARTIAL` | `StandardModuleBar` w `InitiativesHub.tsx:2383`; interakcje 4–7 `NOT_PROVEN` |
| 8–15 Tabela | `PARTIAL` | `StandardTable` w `CanonicalInitiativeRegister.tsx:166`; zachowanie resize/persist `NOT_PROVEN` |
| 16–18 Pstryczek | `NOT_PROVEN` | wymaga realnego otwarcia popovera |
| 19–23 Kebab | `PARTIAL` | `createInitiativeRegisterRowMenu` ma wejście i uniwersalne preview/archive; brak jawnych bloków lifecycle/delete — większy rozjazd do fali 2 |
| 24–30 Preview | `PARTIAL` | `StandardPreview` ma meta, Details i Relations; brak AI; własna stopka dublowała Open i omijała `PreviewActionBar` |
| 31–32 Przyciski | `NIE` przed naprawą | bespoke klasy w `CanonicalInitiativeRegister.tsx`; naprawa drobna R5 |
| 33–37 Kanban | `NOT_PROVEN` | poza statycznym pomiarem R1 |
| 38–40 Kolor/fokus | `PARTIAL` | tokeny `c-*`; odbiór light/dark `NOT_PROVEN` |
| 41–43 Klawiatura/a11y | `NOT_PROVEN` | wymaga przebiegu Tab/Shift+Tab/Esc i zrzutów |

## MARTWE kontrolki Idei

`NOT_PROVEN` — nie wpisano żadnej kontrolki na podstawie grepu. Tabela zostanie wypełniona wyłącznie po enumeracji realnego DOM w dwóch przejściach.

## Większe rozjazdy do fali 2

| Rozjazd | Koszt wstępny | Dlaczego nie jest drobną naprawą |
|---|---:|---|
| Kebab Inicjatyw nie deklaruje pełnych pięciu bloków domenowych | 1–2 dni | wymaga decyzji lifecycle i uprawnień dla Complete/Edit/Delete, nie tylko stylu |
| Brak bloku AI w preview Inicjatywy | `UNKNOWN` | dodanie handlerów AI byłoby nową funkcją, zakazaną w dyżurze 295 |

