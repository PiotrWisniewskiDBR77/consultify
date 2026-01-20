# Plan wdrozenia: Interview (Kontekst organizacji)

## Instrukcja dla agenta (do rozliczenia)
### Cel
Wdrozyc modul Interview jako pierwszy krok Discovery - zbieranie kontekstu organizacji.

### Zakres
- Widok Interview (workspace)
- Kategorie wywiadu (8 kategorii)
- AI-assisted interview flow
- Zapisywanie kontekstu do wykorzystania w Tools/Assessment
- Integracja z Organization context

### Deliverables (musi dostarczyc)
1) UI/UX workspace interview z progress bar
2) 8 kategorii: objective, stakeholder, risk, assumption, constraint, decision, dependency, success_criteria
3) AI chat per kategoria z zapisem odpowiedzi
4) API zapisujace kontekst organizacji
5) Przekazywanie kontekstu do Tools/Assessment

### Kryteria rozliczenia
- Interview mozna przeprowadzic i zapisac
- Kontekst jest dostepny w Tools/Assessment
- Progress bar pokazuje postep per kategoria

## Cel i kontekst
Interview to opcjonalny, ale wartosciowy pierwszy krok w procesie Discovery. 
Pozwala zebrac kontekst organizacji zanim uzytkownik przejdzie do Tools lub Assessment.

Obecna implementacja:
- `AIInterviewModal.tsx` - modal z AI dla osi assessment (DRD)
- `InterviewProgress.tsx` - progress bar kategorii

Wymagane rozszerzenie:
- Osobny widok Interview (nie tylko modal)
- Zapisywanie kontekstu organizacji do bazy
- Przekazywanie kontekstu do Tools/Assessment jako input

## Zasady domenowe
- Interview jest opcjonalny - mozna przejsc od razu do Tools/Assessment
- Kontekst z Interview wzbogaca generowanie inicjatyw
- Historia wywiadow zapisywana per organizacja
- AI prowadzi wywiad, uzytkownik odpowiada

## Kategorie wywiadu (8)
1. **Objective** - cele transformacji
2. **Stakeholder** - kluczowi interesariusze
3. **Risk** - ryzyka i zagrozenia
4. **Assumption** - zalozenia projektu
5. **Constraint** - ograniczenia
6. **Decision** - kluczowe decyzje do podjecia
7. **Dependency** - zaleznosci zewnetrzne
8. **Success Criteria** - kryteria sukcesu

## UX i UI (opis)
### Widok Interview
- Lewy panel: progress bar z kategoriami
- Srodek: chat AI per kategoria
- Prawy panel: podsumowanie odpowiedzi

### Flow
1. Uzytkownik wybiera kategorie lub AI prowadzi sekwencyjnie
2. AI zadaje pytania, uzytkownik odpowiada
3. AI podsumowuje i przechodzi do nastepnej kategorii
4. Po zakonczeniu - zapis kontekstu

## Polaczenia z reszta aplikacji
### Zrodla danych
- Organization data (nazwa, branża, rozmiar)
- Historia poprzednich wywiadow

### Docelowe destynacje
- Tools: kontekst jako input do generowania inicjatyw
- Assessment: kontekst jako input do analizy
- AI Chat: kontekst jako memory

## DoD (Definition of Done)
- Interview workspace dziala
- 8 kategorii z AI chat
- Kontekst zapisuje sie do bazy
- Tools/Assessment maja dostep do kontekstu
- Progress bar pokazuje postep

## Zadania implementacyjne
### Frontend
- src/views/InterviewView.tsx
- src/components/Interview/InterviewWorkspace.tsx
- src/components/Interview/CategoryChat.tsx
- src/components/Interview/InterviewSummary.tsx

### Backend
- server/src/controllers/InterviewController.ts
- server/src/routes/interview.routes.ts
- server/migrations/XXX_interview_context.sql

### AI
- Prompty per kategoria
- Podsumowanie odpowiedzi
- Ekstrakcja kluczowych insights

## Ryzyka i mitigacje
- Ryzyko: za dlugi wywiad -> mozliwosc skip kategorii
- Ryzyko: brak wartosci -> AI generuje insights z odpowiedzi

## Kryteria akceptacji
- Uzytkownik przeprowadza wywiad przez 8 kategorii
- Kontekst jest zapisany i dostepny w Tools/Assessment
- Progress bar pokazuje postep
- Mozna przerwac i wznowic wywiad

---

## Priorytet wdrozenia
Interview jest OPCJONALNY w MVP. Moze byc wdrozony:
- Jako czesc Assessment (modal per axis)
- Jako osobny widok Discovery
- Po wdrozeniu Assessment i Initiatives

Rekomendacja: wdrozyc po Assessment jako rozszerzenie Discovery flow.
