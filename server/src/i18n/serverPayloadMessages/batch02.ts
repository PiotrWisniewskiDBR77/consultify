import type { ServerPayloadMessage } from './index.js';

export const SERVER_PAYLOAD_MESSAGES_BATCH_02: readonly ServerPayloadMessage[] = [
  {
    "en": "An unknown error occurred",
    "pl": "Wystąpił nieznany błąd"
  },
  {
    "en": "Annual benefit must be positive",
    "pl": "Roczny zysk musi być dodatni"
  },
  {
    "en": "Applying proposal would exceed ${MAX_NODES} nodes",
    "pl": "Zastosowanie propozycji przekroczyłoby ${MAX_NODES} węzłów"
  },
  {
    "en": "Approver must differ from ${sod.conflictingRole} for ${riskTier} artifacts",
    "pl": "Zatwierdzający musi różnić się od ${sod.conflictingRole} dla artefaktów ${riskTier}"
  },
  {
    "en": "Area ${areaId}: No justification notes provided for achieved level ${achievedLevel}.",
    "pl": "Obszar ${areaId}: Brak notatek uzasadniających dla osiągniętego poziomu ${achievedLevel}."
  },
  {
    "en": "Artifact keeps source grounding or context lineage",
    "pl": "Artefakt zachowuje źródłowe podstawy lub linię kontekstu"
  },
  {
    "en": "Artifact must be approved before export",
    "pl": "Artefakt musi zostać zatwierdzony przed eksportem"
  },
  {
    "en": "Artifact not found",
    "pl": "Artefakt nie znaleziony"
  },
  {
    "en": "Artifact title snapshot is present",
    "pl": "Obecny jest migawkowy tytuł artefaktu"
  },
  {
    "en": "Artifact type is ${bv.artifact_type}, not VALUATION_CASE — the Valuation Advisor has nothing to say about it",
    "pl": "Typ artefaktu to ${bv.artifact_type}, nie VALUATION_CASE — doradca oceny nic o tym nie mówi"
  },
  {
    "en": "ArtifactRun materialization failed",
    "pl": "Materializacja ArtifactRun nie powiodła się"
  },
  {
    "en": "Assessment must be APPROVED to generate initiatives",
    "pl": "Ocena musi być ZATWIERDZONA, aby wygenerować inicjatywy"
  },
  {
    "en": "Assessment not found",
    "pl": "Ocena nie znaleziona"
  },
  {
    "en": "Assets ≠ Liabilities + Equity",
    "pl": "Aktywa ≠ zobowiązania + kapitał własny"
  },
  {
    "en": "Assignment has no session yet",
    "pl": "Przypisanie nie ma jeszcze sesji"
  },
  {
    "en": "At least one forecast field is required",
    "pl": "Wymagane jest przynajmniej jedno pole prognozy"
  },
  {
    "en": "At least one plan input must change",
    "pl": "Przynajmniej jeden wpis planu musi się zmienić"
  },
  {
    "en": "Attachment exceeds maximum size of 25MB",
    "pl": "Załącznik przekracza maksymalny rozmiar 25 MB"
  },
  {
    "en": "Attachment type not allowed: ${extension}",
    "pl": "Typ załącznika niedozwolony: ${extension}"
  },
  {
    "en": "Authentication and organization context required",
    "pl": "Wymagane uwierzytelnienie i kontekst organizacji"
  },
  {
    "en": "Authoritative succeeded valuation job has no READY DCF_FCFF publication",
    "pl": "Autorytatywna zakończona praca oceny nie ma gotowej publikacji DCF_FCFF"
  },
  {
    "en": "Automation is not a webhook trigger type",
    "pl": "Automatyzacja nie jest typem wyzwalacza webhook"
  },
  {
    "en": "Automation is not active",
    "pl": "Automatyzacja nie jest aktywna"
  },
  {
    "en": "Automation not found",
    "pl": "Automatyzacja nie znaleziona"
  },
  {
    "en": "BS equation FAIL",
    "pl": "Równanie BS NIE POWIODŁO SIĘ"
  },
  {
    "en": "BS equation cannot be verified — missing components",
    "pl": "Nie można zweryfikować równania BS — brak komponentów"
  },
  {
    "en": "BS has ${bsLineCount} lines but ALL are liabilities/equity — assets section likely missing from extraction",
    "pl": "BS ma ${bsLineCount} linii, ale WSZYSTKIE są zobowiązaniami/kapitałem własnym — sekcja aktywów prawdopodobnie brakuje w ekstrakcji"
  },
  {
    "en": "BS has ${bsLineCount} mapped lines but 0 are asset-side (${liabSideLines.length} liability/equity lines). Extraction likely captured only Pasywa section.",
    "pl": "BS ma ${bsLineCount} zmapowanych linii, ale 0 to strona aktywów (${liabSideLines.length} linii zobowiązań/własnego kapitału). Wyodrębnienie prawdopodobnie obejmowało tylko sekcję Pasywa."
  },
  {
    "en": "BS sparse (${bsLineCount} lines) — equation check skipped, sub-components consistent",
    "pl": "BS rzadki (${bsLineCount} linii) — sprawdzenie równania pominięte, podkomponenty spójne"
  },
  {
    "en": "Balance sheet does not tie out: Assets ${assets} vs Liabilities+Equity ",
    "pl": "Równowaga bilansu nie zgadza się: Aktywa ${assets} vs Zobowiązania+Kapitał własny"
  },
  {
    "en": "Balance sheet equation verified",
    "pl": "Równanie bilansu zweryfikowane"
  },
  {
    "en": "Batch ${batchIdx + 1} failed: ${(e as Error).message}",
    "pl": "Partia ${batchIdx + 1} nie powiodła się: ${(e as Error).message}"
  },
  {
    "en": "Batch operations limited to ${MAX_BATCH_SIZE}; received ${totalOps}",
    "pl": "Operacje partii ograniczone do ${MAX_BATCH_SIZE}; otrzymano ${totalOps}"
  },
  {
    "en": "Benefit line ${line.id} is financial but has no amount — excluded from totals, not treated as $0",
    "pl": "Linia korzyści ${line.id} jest finansowa, ale nie ma kwoty — wykluczona z sumy, nie traktowana jako $0"
  },
  {
    "en": "Blocking SECURITY exception is still OPEN",
    "pl": "Blokująca wyjątek bezpieczeństwa jest nadal OTWARTA"
  },
  {
    "en": "Both computed-WACC inputs and direct assumptions exist; select exactly one canonical discount-rate source",
    "pl": "Istnieją zarówno obliczone dane WACC, jak i bezpośrednie założenia; wybierz dokładnie jeden kanoniczny źródło stopy dyskontowej"
  },
  {
    "en": "Budget at ${pct}% — critical threshold reached",
    "pl": "Budżet na ${pct}% — osiągnięto krytyczny próg"
  },
  {
    "en": "Budget at ${pct}% — warning threshold reached",
    "pl": "Budżet na ${pct}% — osiągnięto próg ostrzeżenia"
  },
  {
    "en": "Budget exceeded: ${pct}% of planned (${summary.currency} ${summary.actual.total.toLocaleString()} / ${summary.planned.total.toLocaleString()})",
    "pl": "Budżet przekroczony: ${pct}% zaplanowanego (${summary.currency} ${summary.actual.total.toLocaleString()} / ${summary.planned.total.toLocaleString()})"
  },
  {
    "en": "Business version is ${bv.status}, not content-mutable",
    "pl": "Wersja biznesowa to ${bv.status}, nie zawartość-mutowalna"
  },
  {
    "en": "Business version is ${currentBv.status} — Approved statement packs are immutable. Reopen before importing.",
    "pl": "Wersja biznesowa to ${currentBv.status} — Zatwierdzone zestawy oświadczeń są niemutowalne. Otwórz ponownie przed importem."
  },
  {
    "en": "Business version not found",
    "pl": "Wersja biznesowa nie znaleziona"
  },
  {
    "en": "Business version not found for this artifact",
    "pl": "Wersja biznesowa nie znaleziona dla tego artefaktu"
  },
  {
    "en": "CF reconciliation: scale mismatch detected (likely mixed units), structure OK",
    "pl": "Rekonsyliacja CF: wykryto niezgodność skali (prawdopodobnie mieszane jednostki), struktura OK"
  },
  {
    "en": "CF sparse (${cfLineCount} lines) — limited section extraction, sub-items present",
    "pl": "CF rzadki (${cfLineCount} linii) — ograniczona ekstrakcja sekcji, pod-elementy obecne"
  },
  {
    "en": "CF start line likely misidentified (scale mismatch), P&L flow verified independently",
    "pl": "Linia początkowa CF prawdopodobnie błędnie zidentyfikowana (niezgodność skali), przepływ P&L zweryfikowany niezależnie"
  },
  {
    "en": "COMMIT outcome UNKNOWN — the statement was sent and no answer came back: ${message}. ",
    "pl": "Wynik COMMIT NIEZNANY — oświadczenie zostało wysłane i nie otrzymano odpowiedzi: ${message}. "
  },
  {
    "en": "COMMIT rejected by the server (SQLSTATE ${sqlState}): ${message}",
    "pl": "COMMIT odrzucony przez serwer (SQLSTATE ${sqlState}): ${message}"
  },
  {
    "en": "COMMIT was never sent: the connection had already failed ",
    "pl": "COMMIT nigdy nie został wysłany: połączenie już się nie powiodło "
  },
  {
    "en": "Candidate cannot be marked ready for review without persisted evidence pointers. Mark it as needs evidence first.",
    "pl": "Kandydat nie może zostać oznaczony jako gotowy do przeglądu bez utrwalonych wskaźników dowodów. Najpierw oznacz go jako wymagający dowodów."
  },
  {
    "en": "Candidate must be marked ready for review by an operator before it can be promoted to a P10 finding.",
    "pl": "Kandydat musi zostać oznaczony jako gotowy do przeglądu przez operatora, zanim będzie mógł zostać promowany do wyniku P10."
  },
  {
    "en": "Candidate not found",
    "pl": "Kandydat nie został znaleziony"
  },
  {
    "en": "Cannot ${action}: version is in status ${currentStatus}, which has no such transition",
    "pl": "Nie można ${action}: wersja jest w statusie ${currentStatus}, który nie obsługuje takiej transakcji"
  },
  {
    "en": "Cannot approve: freshness is ${current.freshness}, not CURRENT",
    "pl": "Nie można zatwierdzić: świeżość to ${current.freshness}, a nie CURRENT"
  },
  {
    "en": "Cannot approve: version is in status ${current.status}, not IN_REVIEW",
    "pl": "Nie można zatwierdzić: wersja jest w statusie ${current.status}, a nie IN_REVIEW"
  },
  {
    "en": "Cannot assign a user from another organization to this initiative",
    "pl": "Nie można przypisać użytkownika z innej organizacji do tego inicjatywy"
  },
  {
    "en": "Cannot block an initiative that is ${currentStatus}",
    "pl": "Nie można zablokować inicjatywy, która jest ${currentStatus}"
  },
  {
    "en": "Cannot create a pre-approval compute snapshot: version is in status ${current.status}",
    "pl": "Nie można utworzyć migawki obliczeniowej przed zatwierdzeniem: wersja jest w statusie ${current.status}"
  },
  {
    "en": "Cannot handoff: ${publishCheck.reason}",
    "pl": "Nie można przekazać: ${publishCheck.reason}"
  },
  {
    "en": "Cannot persist comparison findings: primary variant is ${rowA.status} (Advisor is pre-approval by definition)",
    "pl": "Nie można utrwalic wyników porównania: główny wariant to ${rowA.status} (Advisor jest zatwierdzony przez definicję)"
  }
];
