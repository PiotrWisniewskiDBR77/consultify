---
doc_id: funkcje-pilne-uprawnienia-galaz-produkcyjna
status: canonical
owner: piotr
truth_type: runtime
established: 2026-09-01
---

# PILNE: kod z trzema brakami kontroli dostępu JEST na gałęzi produkcyjnej

## Pytanie
Czy `consultify.ai` — produkcja z danymi realnych klientów — stoi na wersji zawierającej
trzy braki kontroli znalezione dziś? Pytanie postawił tor grafiki i **jest właściwe**.

## Co ZMIERZYŁEM (bez dotykania produkcji)

**1. Produkcja wdraża się z gałęzi `main`** — `.github/workflows/railway-deploy.yml:200`:
ręczne uruchomienie, wyłącznie z `refs/heads/main`, z osobnym potwierdzeniem.

**2. Trzy pliki tras SĄ na `origin/main`** — sprawdzone `git cat-file -e`:
`pmo/project-members.routes.ts` · `studio.routes.ts` · trasy eskalacji.

**3. Montowanie jest na `main` bezwarunkowe** — `/api/project-members` zamontowane
w `Gateway.ts`, **bez warunkowego wyłącznika**.

**4. Kontrola organizacji na `main` jest w tym samym stanie co u nas** — jedno wystąpienie
odwołania do organizacji w całym pliku członków projektu, czyli **tyle samo, ile miała nasza
wersja przed audytem**. **Nie ma tam poprawki, której my nie mamy.**

**5. Trasy istnieją od stycznia 2026** — `project-members` od `17d7557db4` (24.01),
`studio` od `9882eaa0d0` (03.01). To **ponad siedem miesięcy**.

**6. Ostatni commit na `main`: `627b7d93ae`, 16.07.2026.**

## Wniosek — uczciwie, z rozdziałem zmierzonego od nieznanego

**ZMIERZONE: kod z tymi brakami jest na gałęzi, z której wdraża się produkcja, od stycznia,
i nie ma tam żadnej poprawki, której my nie mamy.**

**NIEZNANE: czy produkcja jest dziś wdrożona z tej gałęzi i czy ma realnych klientów z danymi.**
Tego **nie sprawdzam** — `consultify.ai` jest w tym programie **nietykalna**, a łączenie się
z nią wymaga zgody właściciela.

**Traktuję to jak „potencjalnie tak", nie jak „nie wiem".** Różnica jest istotna: „nie wiem"
usypia, „potencjalnie tak" każe działać.

## Co jest do rozstrzygnięcia przez właściciela — DZIŚ
1. **Czy produkcja jest wdrożona i czy ma dane realnych klientów.** Tylko właściciel może
   to sprawdzić (panel Railway, jak przy zmiennej środowiskowej 28.08).
2. Jeśli tak — **czy naprawa idzie na produkcję poza kolejnością**, przed resztą programu.

## Co robimy niezależnie od odpowiedzi
Naprawa trzech żywych dziur **już biegnie** na gałęzi `fix/uprawnienia-trzy-zywe-20260901`,
z parą dowodową w obie strony i zakazem zmiany kształtu odpowiedzi dla uprawnionego
użytkownika. **Kod naprawiamy tak czy inaczej** — pytanie dotyczy wyłącznie **pilności
wdrożenia**.

## Zakres audytu — sześć to DOLNA GRANICA, nie wynik
Przesiew: **6221 tras → 291 plików nietkniętych wcześniejszymi naprawami → 198 kandydatów →
około 30 przeczytanych do samego SQL.**

Nieprzeczytane: **~168 kandydatów**. Niesprawdzone wyrywkowo: **290 plików uznanych
za „już naprawione"**.

★ **Ta druga liczba niepokoi bardziej** — bo „już naprawione" to dokładnie to założenie,
które **dziś rano okazało się fałszywe** przy formularzach: rodzina miała kontrolę na dwóch
trasach z pięciu. **Rekomendacja toru grafiki, którą przyjmuję: wylosować kilkanaście
z tych 290 i przeczytać do SQL. Jeśli trafi się choć jedna dziura, cała kategoria
„już naprawione" przestaje być kategorią.**
