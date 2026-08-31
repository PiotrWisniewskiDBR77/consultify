---
doc_id: funkcje-modul17-dowod-realnym-modelem
status: canonical
owner: piotr
truth_type: status
established: 2026-08-31
---

# Moduł 17 — dowód realnym modelem: dwa punkty na trzy, i BŁĄD W MOIM KRYTERIUM

| punkt | wynik |
| --- | --- |
| **(a)** model **sam** wywołał narzędzie, bez dyktowania argumentów | **TAK** — 2 kroki `search_knowledge_base`, koszt $0,02, 4386 ms |
| **(c)** ta sama rozmowa przy **wyłączonej** fladze | **TAK** — zero kroków |
| **(b)** znacznik z bazy wiedzy w odpowiedzi | **NIE** — ale patrz niżej |

## ★ Punkt (b) nie przeszedł, bo kryterium było źle postawione — przez nadzorcę

Kryterium brzmiało: „unikalny znacznik z bazy wiedzy **obecny w odpowiedzi**".
Dwie wady, obie moje:

1. **Znacznik siedział wyłącznie w TYTULE dokumentu**, a tytuł był w prompcie. Model
   go powtórzył — więc sprawdzenie nie potrafiło odróżnić „znalazł w bazie" od
   „przepisał z pytania". **Test był z założenia nierozstrzygający.**
2. **Żądanie dosłownego cytatu jest kruche wobec parafrazy.** Model streszcza, a nie
   cytuje — i to jest jego poprawne zachowanie, nie usterka.

## Co odpowiedź modelu mówi NAPRAWDĘ (odczyt nadzorcy z surowego artefaktu)

> „…is an **executive memo** intended for **internal use**. It appears to be
> **concise and written in a consulting style**… it currently **lacks content in
> critical sections** like the key message, findings, and recommendations…"

Prompt zawierał **wyłącznie tytuł**. Typ dokumentu, przeznaczenie, styl i to, że
**sekcje są puste** — tego w pytaniu nie było. Model musiał to wziąć z wyszukiwania.

**Czyli pobranie prawdopodobnie zadziałało, a nie potrafimy tego dowieść, bo dowód
zbudowałem tak, że nie rozstrzyga.** Nie ogłaszam sukcesu na poszlace.

## Drugi brak, uczciwie nazwany przez wykonawcę

Model wybrał `vault_scope: "organization"` i **w ogóle nie podał** `vault_project_id`.
Więc naprawiona dziś ścieżka „nazwa → identyfikator" **nie została na żywym modelu
wywołana ani razu**. Jest dowiedziona deterministycznie atrapą (`fix217.vaultProject
NameContract.pg.test.ts`, 6/6) — ale to nie to samo.

## Stan: MODUŁ 17 NIEZAMKNIĘTY

Nie z powodu wady produktu. Z powodu **dowodu, który nie rozstrzyga**.

## Co trzeba zrobić — konkretnie
1. Znacznik umieścić **w treści dokumentu**, nie w tytule, i **nie podawać go w
   prompcie**. Wtedy jego pojawienie się w odpowiedzi jest rozstrzygające.
2. Kryterium zmienić z dosłownego cytatu na **fakt z treści, którego nie ma w
   pytaniu** (np. konkretna liczba albo nazwa własna ukryta w dokumencie).
3. Prompt sformułować tak, by naturalnie prowadził do zasięgu projektu — inaczej
   ścieżka „nazwa → identyfikator" znów nie zostanie tknięta.
4. Jeden przebieg realnego modelu. Koszt rzędu dwóch groszy.

## Higiena
Zero naruszeń bram dostępu — naprawiono wyłącznie dane fixture. Push wyłącznie do
prywatnego vaulta. Wykonawca odzyskał ~18 GB, usuwając 10 scalonych worktree
(w tym katalog referencyjny nadzorcy — odtworzony).
