# E0 browser receipt — 2026-09-13

Werdykt: **PASS — oba motywy przeszły kontrolę wizualną i mają trwałe, różne pliki PNG.**

- runtime: izolowany dev-render F2-2 E0 na `http://127.0.0.1:5218/execution-risk-signal-e0.html`
- viewport: `1440 × 900`
- motyw jasny: `risk-signal-e0-light-1440x900.png`, SHA-256 `0de99e84b39f4e85013e0a19ff22ef6c9ad06cf1605e170edb7651b7f319ff43`
- motyw ciemny: `risk-signal-e0-dark-1440x900.png`, SHA-256 `85a9713f2dd25d2fc73d997725807aa418f900f54f2da21af4898501b1234f40`
- konsola po sprawdzeniu ciemnego wariantu: `0` błędów, `0` ostrzeżeń
- metryki obu renderów: viewport i scroll `1440 × 900`; brak poziomego i pionowego overflow
- obserwacja: wariant A i legenda wariantu C były czytelne; nie zaobserwowano obcięcia ani nakładania treści
- dowód trwały: lokalny Playwright zapisał oba PNG bez obchodzenia zabezpieczeń narzędzia przeglądarkowego
- zgodność z artefaktem `8c073b0a`: **EVIDENCE_MISSING** — artefakt nie jest dostępny w bazie ani kanale CTO

Ten receipt nie jest akceptacją właściciela i nie otwiera kodowania produkcyjnej sygnalizacji ryzyka.
