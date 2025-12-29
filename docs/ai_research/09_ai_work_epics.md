# Faza 9: AI Work Epics (Pakiety Prac)

## Executive Summary

Ten dokument definiuje wysokopoziomowe **Epiki (Epics)** oraz powiązane z nimi **User Stories**, które przekładają architekturę AI na konkretny roadmap wdrożeniowy. Epiki są podzielone według metafor anatomicznych systemu: Fundament (Spine), Mądrość (Brain), Pamięć (Memory), Oczy (Eyes), Ręce (Hands) i Tarcza (Shield).

---

## Epic 1: AI Spine (Infrastruktura i Pipeline)
**Cel:** Budowa kręgosłupa systemu, który pozwala na stabilną komunikację z modelami.

- **Story 1.1 (Unified Gateway):** Jako system, chcę mieć jeden punkt wejścia dla wszystkich dostawców (OpenAI, Anthropic, DeepSeek, Ollama), aby łatwo przełączać modele.
- **Story 1.2 (AI Pipeline):** Jako deweloper, chcę korzystać z ujednoliconego Pipeline'u (Request -> Context -> LLM -> Audit), aby uniknąć redundancji kodu.
- **Story 1.3 (Streaming Support):** Jako użytkownik, chcę widzieć odpowiedzi AI generowane w czasie rzeczywistym, aby skrócić postrzegany czas oczekiwania.

---

## Epic 2: AI Brain (Governance i Routing)
**Cel:** Centralne zarządzanie zachowaniem AI i kosztami.

- **Story 2.1 (Prompt Management Hub):** Jako administrator, chcę zarządzać system promptami w bazie danych (bez deployu kodu), aby szybko iterować nad "mądrością" konsultanta.
- **Story 2.2 (Tiered Model Router):** Jako system, chcę automatycznie wybierać najtańszy model (np. GPT-4o-mini) dla prostych zadań i najmądrzejszy dla analiz, aby optymalizować koszty.
- **Story 2.3 (Budget Control Plane):** Jako admin organizacji, chcę ustawiać miesięczne limity wydatków na AI, aby uniknąć niekontrolowanych kosztów.

---

## Epic 3: AI Memory (Kontekst i RAG)
**Cel:** Zapewnienie AI dostępu do wiedzy o projekcie, firmie i metodologii.

- **Story 3.1 (5-Layer Memory):** Jako AI, chcę mieć dostęp do historii sesji, danych projektu i preferencji organizacji, aby udzielać spersonalizowanych porad.
- **Story 3.2 (Knowledge Base / RAG):** Jako AI, chcę przeszukiwać metodologię DRD i standardy PMO przez pgvector, aby bazować na faktach, a nie halucynacjach.
- **Story 3.3 (Project Decision Memory):** Jako AI, chcę pamiętać kluczowe decyzje podjęte wcześniej w projekcie, aby zachować spójność doradztwa.

---

## Epic 4: AI Eyes (Visual Context)
**Cel:** Świadomość tego, co użytkownik robi na ekranie.

- **Story 4.1 (Screen State Serializer):** Jako system, chcę automatycznie przesyłać stan JSON biezacego widoku do AI, aby AI wiedziało o czym rozmawiamy.
- **Story 4.2 (Visual Awareness in Chat):** Jako użytkownik, chcę zadać pytanie "Co o tym sądzisz?" bez opisywania co mam na ekranie, a AI ma odpowiedzieć na podstawie danych z widoku.

---

## Epic 5: AI Hands (MCP & Tools)
**Cel:** Umożliwienie AI wykonywania akcji i pobierania danych.

- **Story 5.1 (Central MCP Server):** Jako system, chcę mieć centralny serwer narzędzi, aby AI mogło bezpiecznie odpytywać bazę danych Consultify.
- **Story 5.2 (Business Logic Tools):** Jako AI, chcę wywoływać narzędzia do obliczeń ROI i analizy ryzyka, aby dostarczać precyzyjne dane liczbowe.
- **Story 5.3 (Action Approval Flow):** Jako użytkownik, chcę zatwierdzać każdą zmianę w danych zaproponowaną przez AI, aby zachować pełną kontrolę.

---

## Epic 6: AI Skills (Capability Suite)
**Cel:** Implementacja konkretnych funkcji biznesowych.

- **Story 6.1 (Magic Wand):** Jako użytkownik, chcę użyć magicznej różdżki do automatycznego uzupełnienia pól formularza na podstawie kontekstu.
- **Story 6.2 (Smart Report Generator):** Jako użytkownik, chcę aby zespół agentów (Analyst -> Strategist -> Reporter) wygenerował dla mnie kompletny raport transformacji.
- **Story 6.3 (Task PMO Coach):** Jako użytkownik, chcę otrzymać poradę jak wykonać konkretne zadanie w oparciu o standardy PRINCE2/PMBOK.

---

## Epic 7: AI Shield (Security & Trust)
**Cel:** Ochrona danych i budowa zaufania.

- **Story 7.1 (PII Scrubber):** Jako organizacja, chcę aby system automatycznie usuwał dane osobowe przed wysłaniem ich do chmurowych modeli LLM.
- **Story 7.2 (Prompt Injection Guard):** Jako system, chcę blokować próby manipulacji instrukcjami AI przez użytkowników, aby zapewnić bezpieczeństwo.
- **Story 7.3 (Full Audit Trail):** Jako administrator, chcę widzieć logi każdego zapytania AI wraz z modelem, kosztem i użytym kontekstem dla celów audytu.

---

## Epic 8: MAX Mode (Deep Reasoning)
**Cel:** Wykorzystanie najpotężniejszych modeli do trudnych problemów.

- **Story 8.1 (o1 Integration):** Jako użytkownik Premium, chcę włączyć tryb MAX, aby system użył modeli o1 (reasoning) do rozwiązania bardzo złożonych problemów strategicznych.
- **Story 8.2 (Multi-Step Reasoning):** Jako system, chcę w trybie MAX przeprowadzić wielokrokową analizę "łańcucha myśli", aby znaleźć nieoczywiste luki w strategii.

---

*Document Version: 1.0*
*Last Updated: December 2024*
*Author: AI Research Team*



