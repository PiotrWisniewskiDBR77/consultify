---
doc_id: consultinity-cross-module-flows
title: Consultinity — przepływy między modułami
truth_type: product-target
scope: cały program
status: working
owner: product
last_reviewed: 2026-07-29
---

# Przepływy między modułami

## FLOW-01 — Od rozmowy do wykonania

**Aktor:** lider lub konsultant
**Cel:** zamienić problem w kontrolowaną realizację.

1. Użytkownik opisuje problem w Chat.
2. Chat zbiera kontekst i źródła.
3. Wynik trafia do Interview, Tools albo Assessment.
4. Diagnoza tworzy propozycję inicjatywy.
5. Użytkownik zatwierdza propozycję w Initiatives.
6. Zatwierdzona inicjatywa przechodzi do Execution.
7. Zadania trafiają do My Work odpowiedzialnych osób.
8. Results mierzy rezultat.
9. Finance ocenia skutek finansowy.
10. Materials tworzy raport lub prezentację.

Warunek ukończenia: wynik jest połączony z inicjatywą, wykonaniem i źródłami.

## FLOW-02 — Od wywiadu do rekomendacji

1. Konsultant przygotowuje lub wybiera template Interview.
2. Respondent otrzymuje assignment.
3. Odpowiedzi tworzą sesję i insights.
4. Insights są przeglądane przez człowieka.
5. Zatwierdzone wnioski zasilają Tools, Assessment lub Initiatives.
6. Materiał podsumowujący trafia do Materials.

Warunek ukończenia: insight wskazuje pytania i odpowiedzi źródłowe.

## FLOW-03 — Od assessmentu do portfela zmian

1. Organizacja uruchamia assessment.
2. Respondenci uzupełniają dane.
3. System oblicza wynik i luki.
4. Człowiek zatwierdza interpretację.
5. Luki tworzą kandydatów inicjatyw.
6. Initiatives przejmuje zatwierdzone kandydatury.
7. Raport assessmentu pozostaje dostępny w Materials.

## FLOW-04 — Zarządzanie wykonaniem

1. Execution przyjmuje zatwierdzoną inicjatywę.
2. Tworzy lub łączy zadania, kamienie milowe, zależności i ryzyka.
3. My Work pokazuje każdej osobie jej pracę.
4. Zmiany i blokery są raportowane do Execution.
5. Istotne odchylenie tworzy decyzję lub eskalację.
6. Results aktualizuje KPI i korzyści.
7. Materials publikuje raport postępu.

## FLOW-05 — Materiał z pełnym provenance

1. Użytkownik wybiera źródła z dowolnego modułu.
2. Materials tworzy dokument, arkusz, deck lub raport.
3. AI proponuje strukturę i treść.
4. Użytkownik edytuje i zatwierdza.
5. Artefakt zapisuje źródła, wersję i autora.
6. Eksport lub udostępnienie nie usuwa traceability w systemie.

## FLOW-06 — Spotkanie i follow-up

Status docelowy; moduł Meeting jest oznaczony jako `soon`.

1. Spotkanie otrzymuje agendę, uczestników i materiały.
2. System przechwytuje notatki, decyzje i działania.
3. Człowiek zatwierdza zapis.
4. Zadania trafiają do My Work/Execution.
5. Decyzje łączą się z inicjatywami.
6. Podsumowanie trafia do Materials.

## Przepływy wymagające dalszej weryfikacji AS-IS

- pełny round-trip Chat → Canvas → moduł właścicielski,
- Interview → Assessment bez utraty provenance,
- automatyczna promocja inicjatywy do Execution,
- dwustronna synchronizacja Results ↔ Finance,
- zapis źródeł w każdym formacie Materials,
- runtime Meeting i follow-up.
