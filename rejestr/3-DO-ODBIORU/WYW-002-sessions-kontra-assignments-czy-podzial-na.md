---
id: WYW-002
tytul: Sessions kontra Assignments — czy podział na dwie zakładki jest zamierzony
typ: analiza
waga: srednia
obszar: WYW
stan: do-odbioru
wlasciciel: piotr
blokuje: []
zablokowane_przez: []
zrodlo: "_RAPORT.md PEŁNY INWENTARZ / _REJESTR_ZYWY.md, 20-21.07"
stare_id: A8
utworzone: 2026-07-21
---

## 1. PROBLEM

Nie było jasne, czy rozdzielenie „Sessions" i „Assigned" to świadomy projekt, czy przypadkowy rozjazd do naprawy.

## 2. PRZYCZYNA

Nie dotyczy — analiza.

## 3. ROZWIĄZANIE

Ustalić z kodu i z bazy, jak się mają do siebie te dwa byty.

## 4. KRYTERIUM ODBIORU

**Dokument.** Zamknięte, gdy przyjmiesz, że podział jest zamierzony i nie zlecamy jego scalania.

## 5. DOWODY

**Analiza kodu z dowodem plik:linia** (migracje + kontroler + frontend).

**Dwie osobne tabele, relacja opcjonalna 1:1.** `interview_assignments` = kontrakt zarządczy (status, `due_at`, `priority`, `reminder_count`, `sent_back_reason`) — „kto ma zrobić, do kiedy". `interview_sessions` = instancja treści (`progress_json`, `answered_questions`, `summary_facts/gaps`) — „co realnie odpowiedziano".

Nawet przy przypisaniu zespołowemu **cały zespół dzieli jedną sesję**; `interview_assignment_members.progress_percent` śledzi udział per osoba, ale treść jest wspólna.

**Sesja bez przypisania jest możliwa i zaprojektowana** — 3 niezależne ścieżki (`InterviewController.ts` ok. :1831-1838 / :3083-3110 / :5693-5714).

**Podział na 2 zakładki to jawna, udokumentowana decyzja projektowa** — cytat z kodu (`InterviewHub.tsx` ok. :2158-2165): *„Sessions and Assigned are intentionally SEPARATE tabs and are NOT merged… Merging them would conflate 'my sessions' with 'other people's work'."* Potwierdzone 3 niezależnymi zapytaniami sieciowymi.

**★ Przy okazji znaleziony realny błąd** → wydzielony jako **WYW-010**.

**Uboczne ustalenie:** `interview_sessions.archived_at` i `interview_assignments.archived_at` to niezależne kolumny bez pełnej dwukierunkowej spójności; migracja `920_interview_assignment_archived_via_session.sql` **nie jest w automatycznym runnerze** → wydzielone jako **SYS-004**.

## 6. DZIENNIK

**2026-07-21** — zmigrowane ze źródła A8. **Z analizy wypadły 2 rzeczy, które siedziały w środku opisu** — błąd uprawnień (WYW-010) i migracja poza runnerem (SYS-004). Wydzielone, żeby nie zginęły.
