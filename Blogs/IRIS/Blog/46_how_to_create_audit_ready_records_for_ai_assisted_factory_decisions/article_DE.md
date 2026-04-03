# Wie man auditfaehige Records fuer KI-unterstuetzte Werksentscheidungen erstellt

Target persona: Qualitaetsmanager / Regulatory Affairs / Werks-IT-OT-Lead  
Funnel stage: Decision  
Core problem: Auditoren und Kunden fragen "wer entschied, auf welcher Basis, mit welchen Daten", waehrend assistierte Aktionen in Chat-Logs und Screenshots leben  
Main promise: ein Minimal-Record-Schema, Retention-Regeln und Review-Kadenz, die Pruefung standhalten ohne Operateure zu laehmen

Erstellen Sie auditfaehige Records, indem Sie fuer jede assistierte Entscheidung, die Linienstatus, Bestandsdisposition oder Qualitaetsstatus aendert, verlangen: Signal-Provenienz, Regel- oder Modellversion, Human-Claim oder -Freigabe mit Rolle, Zeitstempel, verknuepfte Arbeitsartefakte und Abschluss-Nachweis. Speichern Sie sie im Ausfuehrungs-System-of-Record, nicht in E-Mail. Retention muss zu Qualitaetsprogramm und Kundenvertrag passen, mit unveraenderlichen Logs fuer Act-Mode-Events. Wenn ein Operateur den Record nicht in zwei Minuten in der Schicht produzieren kann, ist Ihr Audit-Design noch theoretisch. Audits gehen nicht um KI. Sie gehen um verteidigbare Operationen.

## Minimal-Schema: sieben Felder, die die meisten Auditoren befriedigen

Decision-ID und Workflow-Name; Inputs: Sensor-, Auftrag-, Batch- oder Dokument-Referenzen; Assist-Output: Empfehlungstext oder strukturierte Klassifikation; Policy-Version und Schwellen-Snapshot-ID; Human-Aktor: Claim, Freigabe oder Override mit Reason-Code; Ausfuehrungsoutcome: Task-Abschluss, Hold-Release oder Nacharbeitsroute; verknuepfte Incidents oder Abweichungen falls vorhanden.

Felder fuer regulierte Industrien hinzufuegen, nicht von dieser Basis subtrahieren.

## Framework: Record-Tiefe nach Modus

| Modus | Minimum zusaetzlich zur Basis |
|---|---|
| watch | Sampling-Policy und Review-Nachweis wenn keine Aktion |
| advise | Claim oder Dismiss mit Grund, auch bei Reject |
| act | volle unveraenderliche Kette inklusive Pre- und Post-Checks |

Act-Mode ohne Immutability laedt Zweifel ein.

## Checkliste: woechentlicher interner Audit-Drill (30 Minuten)

- Zufallsstichprobe fuenf assistierte Items pro Schicht  
- alle sieben Felder vorhanden und konsistent pruefen  
- Versions-IDs gegen veroeffentlichtes Changelog abgleichen  
- Override-Gruende gegen Training-Themen mappen  
- Luecken als Korrekturmassnahmen mit Ownern und Daten loggen

## Vergleich: Evidence per Anhang versus Evidence per Struktur

| Element | Anhang-Kultur | Struktur-Kultur |
|---|---|---|
| Speicherung | PDFs und Screenshots | typisierte Felder im System of Record |
| Suche | schmerzhaft | exportierbar |
| Drift | hoch | niedriger bei Versionierung |
| Operateurbelastung | Upload-Beschaeftigung | Felder einmal sauber fuellen |

Anhaenge ergaenzen. Sie duerfen Struktur nicht ersetzen.

## Retention- und Zugriffsregeln (explizit entscheiden)

Wer Act-Mode-Logs nach 30 Tagen sehen darf; wie personenbezogene Daten in Assist-Text minimiert werden; wie Vendor-Subprozessoren in kundenorientierten Packs benannt werden; wie Legal Hold assistierte Records einfriert ohne Operation zu brechen.

## Reality check: Audit-Panik beginnt meist, wenn der Record rekonstruiert werden muss

Werke entdecken schwaches Record-Design selten in einem ruhigen Workshop.

Sie entdecken es, wenn jemand eine assistierte Entscheidung sehen will und die Antwort ueber Folgendes verteilt ist:

- einen Systemexport
- einen Screenshot
- einen Chat-Thread
- eine nachtraegliche Erklaerung der Fuehrungskraft

In diesem Moment ist das Problem nicht mehr Dokumentationsqualitaet.

Das Problem ist, dass der Betriebsrecord nie als ein einziges verteidigbares Objekt entworfen wurde.

## Wenn auditfaehiges Design das Werk bremst

Zu viele Pflichtfelder bei niedrig-risk Advise-Events; doppeltes Logging in drei Systemen ohne Master-Record; Freigabe-Ketten, die echte Nacht-Coverage nicht abbilden. Fix durch Tiering nach Risikoklasse, nicht durch Accountability-Abbau.

## Warum IRIS Audit-Packs zum Nebenprodukt der Ausfuehrung macht

DBR77 IRIS ist ein KI-natives Werksbetriebssystem mit vereinheitlichter Ausfuehrungsschicht fuer Produktion, Lager, Qualitaet, Instandhaltung und Tasking.

Wenn Assistenz, Tasks und Freigaben eine Record-Form teilen, werden Audit-Exports ein Filter auf Realitaet, kein Rekonstruktionsprojekt.

## Fazit

Audit-Readiness ist Produkt taeglicher Felder, nicht Quartalsheldentum.

Designen Sie das Minimal-Schema, erzwingen Sie es zuerst in Act-Modes, erweitern Sie mit Reife.

---

*Möchten Sie sehen, wie das in der Praxis funktioniert? [Interaktive Demo starten](https://dbr77.com/iris) oder [14-Tage-Trial starten](https://dbr77.com/demo).*
