---
doc_id: funkcje-pomiar-modulow-20260831
status: canonical
owner: piotr
truth_type: status
established: 2026-08-31
---

# Pomiar modułów 14·15·16·07 — tablica rekonesansu była w połowie nieaktualna

Tablica w `REKONESANS_ZAMKNIECIA_16_MODULOW.md` powstała **30.08**. Zmierzono ją
ponownie **31.08 wieczorem**, na tipie `9850d2bcd8` — trzynaście dyżurów później.

## Poprawki

| moduł | tablica mówiła | pomiar mówi |
| --- | --- | --- |
| **14 Admin** | 0-1 dyżurów | **ZANIŻONE — realnie 3-5** |
| **15 Ustawienia** | 1 dyżur | **0-1** — komunikat dla roli MEMBER już zrobiony (dyżur 176) |
| **16 Partner** | „G08: 0/25" | **FAŁSZ — 25/25 przejechane**, 17 czystych, dwa błędy backendu naprawione |
| **07 Moja praca** | 4 pozycje | **3 z 4 już zamknięte**; zostają dwa drobiazgi |

## ★ Najpoważniejsze znalezisko: ekran Admina pokazuje dane, których NIE MA

`AI Policy` w module Admin renderuje się poprawnie i po polsku — i pokazuje
„Nieznany / 0 / n/d". Wygląda jak pusta konfiguracja. **Nie jest pusta — jej nie
ma czego czytać.**

`server/src/routes/adminP32.routes.ts:1513-1521` odpytuje tabelę
`llm_org_policies`, a **żadna migracja jej nie tworzy** (`grep -rl llm_org_policies
server/migrations/` ⇒ zero trafień). Zapytanie pada zawsze, `catch` łyka błąd,
wynik to `null`, ekran rysuje zera.

To jest **kłamstwo widoczne dla użytkownika**: administrator patrzy na ekran polityk
AI swojej organizacji i widzi „brak polityk" zamiast „ta funkcja nie istnieje".
Ósma klasa kłamstwa, dopisana do dzisiejszego katalogu: **awaria zamieniona w pustą
wartość i pokazana jako stan faktyczny.**

Pozostałe braki Admina: niezgodność schematu w Billing (`invoices.issue_date`)
i w Security (SCIM `organization_id`), angielski w globalnym pasku nawigacji, oraz
nierozstrzygnięta uwaga właściciela `ADM-OWN-001` o przebudowie menu w siedmiu
obszarach. Guided review właściciela (`G08-G10`): **nigdy nie przeprowadzony**.

## 16 Partner — tablica myliła stan sprzed dyżuru ze stanem dzisiejszym
Dyżur 177 przejechał **25 sekcji × jasny i ciemny = 50 zrzutów** zalogowanym kontem.
Dyżur 188 naprawił dwa realne błędy backendu (500 na podsumowaniu zarobków,
niezgodność typów na Organizacjach i Projektach) — **mutacyjnie**. Dyżur 189 poprawił
polszczyznę na czterech najgorszych ekranach, potwierdzone wzrokiem.
Zostaje **1-2 dyżury**: żywy dowód baneru rozliczeń po naprawie i obcięta kolumna
w Organizacjach.

## 07 Moja praca — zostają dwa drobiazgi, oba zlokalizowane co do linii
1. **Komentarz generowany przez AI nie jest zapisywany** — `generateAIComment`
   (`TaskDetailView.tsx:~2691`) woła wyłącznie `setComments(...)`, **zero wywołania
   API**. Znika po odświeżeniu. Komentarze ręczne zapisują się poprawnie.
2. **Błąd jednolinijkowy** — `DecisionDetailView.tsx:8909`: przycisk w tabeli RACI
   woła `handleDownloadAttachment(a)`, gdzie `a` nie istnieje w tym zasięgu
   (skopiowane z tabeli załączników). Kliknięcie rzuca wyjątek.

## 15 Ustawienia — karta modułu jest nieaktualna wobec kodu
`MODULE_ACCEPTANCE.md` ma bramkę `CLOSED_FINAL` od 25.08 i **nie zawiera wpisu
o dyżurze 176**, który domknął komunikat dla roli MEMBER. Dokładnie ten wzorzec,
którego szukaliśmy: karta twierdzi mniej, niż kod robi.
Do rozstrzygnięcia: martwy `SidebarUsage` + `UsageMeters` (zero importerów,
potwierdzone tranzytywnie) — skasować czy podłączyć.
