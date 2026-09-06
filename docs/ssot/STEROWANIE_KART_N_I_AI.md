---
doc_id: sterowanie-kart-n-i-ai
status: CONFIRMED (DEC-407 potwierdzona słowem właściciela 06.09.2026 13:47 przy karcie sesji narzędzia: „tutaj też powinniśmy mieć WorkWithAI, który będzie rozwijał listę analogicznie jak wcześniej — uzupełnienie całości, uzupełnienie karty i analizę, czyli propozycję; teraz jest jakaś archaiczna formuła”; wdrożenie w pojemniku 1 jako część S1.13)
truth_type: ui-standard (uzupełnienie SPEC-A / SPEC-N)
author: CTO (Fable) ze słów właściciela
---

# Sterowanie kartami N i AI w kartach — trzy zasady (obowiązują we WSZYSTKICH kartach N, we wszystkich narzędziach)

Karta N = ekran-obiekt otwierany z listy (zadanie, decyzja, inicjatywa, notatka, pomysł, miernik, cel, analiza,
kryterium audytu, raport, dokument, prezentacja…). Rejestr: `src/components/standard/registry.ts`,
kontrakty treści: `src/components/standard/cardContract.types.ts` + SPEC-N. Powłoka: `StandardArtifactShell`
(Menu 4 = nagłówek karty, Menu 5 = pasek sekcji/trybu) + prawy panel `ArtifactRightPanel`.

## Zasada 1 — Zakładki i sekcje zgodne z kontraktem
Każda karta N ma spisany kontrakt: jakie zakładki/sekcje, co w nich jest i jak jest pokazane. Kontrakt jest
prawem: ekran nie może mieć sekcji spoza kontraktu ani sekcji pustych „na wyrost”. Program: przegląd
WSZYSTKICH kart N (rejestr) zakładka po zakładce → tabela „kontrakt mówi / ekran pokazuje / rozjazd” →
naprawa rozjazdów albo poprawka kontraktu decyzją właściciela (nigdy w ciszy).

## Zasada 2 — Nagłówki karty zawsze widoczne
Przy przewijaniu treści karty w dół Menu 4 (tytuł, „wstecz”, status, AI, kebab) i Menu 5 (Sekcje, Edycja /
Podgląd, przycisk AI) pozostają PRZYKLEJONE u góry (sticky), żeby użytkownik zawsze wiedział, w jakim
dokumencie jest, i miał nawigację pod ręką. Przewija się tylko treść sekcji (i prawy panel niezależnie).
Dotyczy każdej karty N w każdym narzędziu; jedno miejsce: powłoka `StandardArtifactShell`.

## Zasada 2b — Przełącznik „Edycja / Podgląd” tylko z uprawnieniem
Gdy użytkownik nie ma prawa edycji karty (rola, status zatwierdzony/zamrożony, cudzy rekord), przełącznik
„Edycja / Podgląd” w Menu 5 NIE jest renderowany — karta jest w podglądzie, a powód widać w prawym panelu
(„Tylko do odczytu: …”). Pozycje „Uzupełnij…” z „Pracuj z AI” też znikają (zostaje „Analizuj”); przyciski AI
per obszar nie renderują się. Słowo właściciela: „jeżeli ktoś nie ma uprawnień do edycji, to ten przycisk
pośrodku nie ma sensu”.

## Zasada 3 — Jedna struktura sterowania AI w karcie (trzy poziomy)
1. **Poziom karty (Menu 5, przycisk „Pracuj z AI” — rozwija listę na miejscu)** — nazwa ze słów właściciela („zamiast analizy z AI: pracuj z AI”); trzy pozycje, zawsze te same:
   - **Analizuj** — ocenia dokument: co jest wypełnione, czego brakuje, co jest słabe; pokazuje wynik jako
     raport w karcie (dziś „Analizuj z AI”); NIE zmienia treści.
   - **Uzupełnij tę sekcję** — wypełnia TYLKO sekcję, na którą użytkownik patrzy (aktywna w Menu 5 /
     lewym spisie), z kontekstu karty i modułu; zawsze jako propozycja do zatwierdzenia
     (`ZASADY_AI_TERESA_SSOT`: człowiek potwierdza).
   - **Uzupełnij cały dokument** — to samo dla wszystkich sekcji karty po kolei, z jednym podglądem
     zmian i jednym „Zatwierdź”; sekcje wypełnione przez człowieka nie są nadpisywane bez pytania.
2. **Poziom obszaru (mały przycisk „AI” przy każdym polu/obszarze)** — działa tylko na tym obszarze:
   Wygeneruj · Popraw · Skróć · Rozwiń · Formalny ton (jak dziś w Decyzjach). Zostaje bez zmian, ale ma
   być w KAŻDYM obszarze tekstowym każdej karty N.
3. **Poziom rozmowy (Teresa)** — wejście z Menu 1 (DEC-404), panel Teresy z kontekstem karty; Teresa może
   zaproponować to samo, co poziomy 1–2, ale przez kartę propozycji („Do zatwierdzenia”).
Nazwa przycisku: „Pracuj z AI” (nie „Analizuj z AI”). Zakazy: żaden poziom nie zapisuje bez zatwierdzenia; brak drugiego czatu; nazwy pozycji po polsku, te same
w każdej karcie; brak osobnych, nazwanych inaczej przycisków AI per narzędzie.

## Kolejność wdrożenia (po potwierdzeniu właściciela)
1. Zasada 2 (sticky) — Sonnet, powłoka, jeden obraz per typ karty.
2. Zasada 3 — Opus: lista „AI” w Menu 5 w powłoce + kontrakt serwerowy „uzupełnij sekcję / dokument” na
   istniejących generatorach (`/api/ai/generate` + sekcje kontraktu), przycisk obszaru w każdym polu.
3. Zasada 1 — Codex (funkcja celu): przegląd kart N vs kontrakty, tabela rozjazdów, naprawy.
