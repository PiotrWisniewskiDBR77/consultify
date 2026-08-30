---
doc_id: funkcje-odbior-133
status: evidence
truth_type: work-status
established: 2026-08-30
---

# Odbiór adwersaryjny — dyżur 133 (kontrakt mutacji w Mojej pracy)

**Werdykt: `B` — działa z nazwanymi ograniczeniami. SCALONY** (merge `f9848d75a0`).

## Co potwierdził nadzorca własnymi rękami

| Bramka | Wynik pomiaru nadzorcy |
| --- | --- |
| licencja | **8 plików, wszystkie z tabeli**, łącznie z rozszerzoną licencją notatnika. Zero zmian w `Initiatives/**`, trasach i migracjach |
| `B1` mutacja | odtworzyłem **dokładnie** mutację z raportu (cofnięcie **trzech widżetów**): **4 czerwone / 4 zielone**, **cztery nazwy identyczne** z raportem. Po naprawie **8/8** |
| `B2` test behawioralny | `grep readFileSync` → **0** |
| `B4` regresja różnicowa | marker **120/120**, HEAD **128/128** — różnica to dokładnie nowy plik testu. **Zero regresji** |

**Rozbieżność, która okazała się moja.** Moja pierwsza mutacja cofnęła sześć plików
i dała **3** porażki zamiast czterech. Raport cofał **tylko trzy widżety**. Powtórzyłem
ich wariant — **4/4, nazwy zgodne**. Liczba wykonawcy jest poprawna, mój pierwszy
pomiar mierzył co innego.

## Rozszerzona licencja notatnika — dotrzymana co do litery

Zmiana w `NotebookAttachmentsSection.tsx` to **wyłącznie typy i adapter wywołania**:
import typu, funkcja `adaptMutation` tłumacząca `Promise<void>` na wynik dyskryminowany,
i dwa miejsca przekazania. **`Api.downloadNotebookAttachment` nietknięte**, zero zmian
zachowania, układu i tekstów.

Sprawdziłem też warunek „adapter nie może ukryć porażki": adapter zwraca `{ok:false}`
przy wyjątku — i **istnieje test pilnujący tego imiennie**:
`preserves notebook upload failure instead of adapting it to success`.

## ★★ Ograniczenie, które trzeba nazwać — ścieżka notatnika NADAL kłamie

`handleUploadNotebookAttachments` w `NotebookContent.tsx:2305-2312` **połyka własny
błąd**: ma `catch`, pokazuje `toast.error` i **nie rzuca dalej**. Obietnica rozwiązuje
się normalnie, więc adapter widzi sukces i widżet pokazuje `toast.success`.

**Użytkownik przy nieudanym wysłaniu w notatniku widzi błąd i sukces jednocześnie.**

**To NIE jest regresja tego dyżuru.** Przed zmianą kod robił `await onUpload(files)`
i pokazywał sukces **bezwarunkowo** — defekt jest starszy. Kontrakt został wdrożony
poprawnie; sygnał porażki ginie **piętro wyżej**, w hoście, który był poza licencją.

**Warunek domknięcia:** `NotebookContent.tsx` musi przestać połykać błąd albo zacząć
zwracać wynik dyskryminowany. To jest osobna pozycja — **nie dokładamy jej do dyżuru,
który już biegł** (zakaz ping-pongu).

## ★★ Znalezisko `R4` — poważniejsze niż sam kontrakt

Potwierdzone pomiarem statycznym wykonawcy i przyjęte: `handleAddComment`
w `TaskDetailView.tsx` i `DecisionDetailView.tsx` wykonuje **wyłącznie `setComments`**.
Zero `fetch`, `Api`, `axios`, `V8MyWorkApi`. Usuwanie i polubienie też lokalne.

**Dla komentarzy Zadania i Decyzji zapis do serwera nie istnieje w ogóle.** Trasy
`my-work.routes.ts` istnieją, ale te handlery ich nie wołają. Kontrakt mutacji jest
konieczny, ale **niewystarczający**: bez wołacza wynik dyskryminowany będzie uczciwie
raportował porażkę operacji, której nikt nie próbuje wykonać.

Wpisane do rejestru jako `DO_ZBUDOWANIA` z dowodem nieistnienia. **To jest pierwszy
kandydat na dyżur po zamknięciu 133.**

## Ograniczenia nazwane — powód oceny `B`

1. Ścieżka notatnika nadal pokazuje sprzeczne komunikaty (wyżej) — defekt zastany.
2. Zapis komentarzy nie istnieje — kontrakt gotowy, wołacza brak.
3. Brak dowodu przez realne żądanie `HTTP` — pakiet jest komponentowy.

## Wniosek metodyczny

**Rozszerzenie licencji po zasadnym `STOP`-ie zadziałało.** Dyżur zatrzymał się,
udowodnił sprzeczność kompilatorem, dostał wąską licencję imienną i domknął pracę
bez ping-pongu. To jest wzorzec do powtarzania: **`STOP` z dowodem → decyzja
nadzorcy na piśmie → wznowienie na tej samej gałęzi.**
